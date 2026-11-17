// The third-person student (scripts/toon/build_student.py → lanren/assets/toon/student.glb).
// One skinned mesh, one draw call: colours live in COLOR_0 (rgb) with a material kind in alpha
// (1 cloth, .75 skin, .5 hair, .25 unlit). Skin gets a warm shade, hair an anime highlight band,
// eyes stay unlit. A thin inverted-hull outline gives the figure the drawn edge the reference's
// character has, without outlining the whole world. Clips blend by speed (idle → walk → run) with
// walk and run kept in step, so a change of pace never resets the legs.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { toonMaterial, GLSL_COMMON, TOON } from './toon.js';

export const WALK_SPEED = 1.45;   // m/s the Walk clip covers at timeScale 1 (build_student.py)
export const RUN_SPEED = 4.3;

function bodyMaterial() {
  return toonMaterial({
    name: 'student', key: 'student',
    vertex: { head: 'attribute vec4 aData; varying vec4 vData;\n', world: 'vData = aData;' },
    fragment: {
      head: 'varying vec4 vData;\n',
      albedo: /* glsl */`
toonAlbedo = vData.rgb;
float kind = vData.a;
toonSoft = kind < 0.85 && kind > 0.6 ? 0.06 : 0.02;
`,
      after: /* glsl */`
{
  float kind = vData.a;
  vec3 V = normalize(cameraPosition - vToonWP);
  if (kind < 0.35) {
    toonOut = toonAlbedo * (uSkyAmb * 0.35 + uSunColor * 0.32);            // eyes: flat
  } else if (kind < 0.6) {
    // hair: a narrow highlight band where the half vector grazes the strands
    vec3 H = normalize(uSunDir + V);
    float band = smoothstep(0.72, 0.76, dot(toonN, H)) * (1.0 - smoothstep(0.86, 0.9, dot(toonN, H)));
    toonOut += uSunColor * 0.12 * band * toonShadow;
  } else if (kind < 0.85) {
    // skin: the shade turns warm (light scattering under skin), never grey
    float ndl = dot(toonN, uSunDir);
    float shade = 1.0 - smoothstep(-0.05, 0.12, ndl) * toonShadow;
    toonOut += toonAlbedo * vec3(0.22, 0.06, 0.03) * shade;
  }
}
`,
    },
  });
}

function outlineMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...TOON, uWidth: { value: 0.012 }, uColor: { value: new THREE.Color(0.11, 0.1, 0.13) } },
    vertexShader: /* glsl */`
#include <common>
#include <skinning_pars_vertex>
uniform float uWidth;
void main() {
  #include <skinbase_vertex>
  #include <beginnormal_vertex>
  #include <skinnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  vec4 wp = modelMatrix * vec4(transformed, 1.0);
  vec3 wn = normalize(mat3(modelMatrix) * objectNormal);
  float d = length(cameraPosition - wp.xyz);
  wp.xyz += wn * uWidth * clamp(d * 0.25, 0.6, 2.5);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`,
    fragmentShader: /* glsl */`
uniform vec3 uColor; uniform vec3 uSkyAmb; uniform vec3 uSunColor;
void main() { gl_FragColor = vec4(uColor * (0.6 + 0.4 * (uSkyAmb + uSunColor * 0.2)), 1.0); }`,
    side: THREE.BackSide,
  });
}

export async function createStudent(url) {
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
  const root = new THREE.Group();
  root.name = 'student';
  const model = gltf.scene;
  let skinned = null;
  model.traverse((o) => { if (o.isSkinnedMesh) skinned = o; });
  if (!skinned) throw new Error('student.glb has no skinned mesh');
  const geo = skinned.geometry;
  geo.setAttribute('aData', geo.getAttribute('color'));
  geo.deleteAttribute('color');
  skinned.material = bodyMaterial();
  skinned.castShadow = true;
  skinned.receiveShadow = true;
  skinned.frustumCulled = false;
  const outline = new THREE.SkinnedMesh(geo, outlineMaterial());
  outline.bind(skinned.skeleton, skinned.bindMatrix);
  outline.frustumCulled = false;
  outline.position.copy(skinned.position); outline.quaternion.copy(skinned.quaternion); outline.scale.copy(skinned.scale);
  skinned.parent.add(outline);
  // a soft contact shadow, so the feet sit on the grass even where the shadow map is coarse
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(0.05, 0.08, 0.12, 0.38 * (1.0 - smoothstep(0.2, 1.0, d))); }',
  }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.02;
  blob.renderOrder = 2;
  root.add(model, blob);

  const mixer = new THREE.AnimationMixer(model);
  const clip = (n) => gltf.animations.find((a) => a.name === n);
  const act = {};
  for (const n of ['Idle', 'Walk', 'Run', 'Jump']) {
    const a = mixer.clipAction(clip(n));
    a.play();
    a.setEffectiveWeight(n === 'Idle' ? 1 : 0);
    act[n] = a;
  }
  const head = model.getObjectByName('head');
  let air = 0;   // 0 grounded → 1 airborne (blend)
  let w = { Idle: 1, Walk: 0, Run: 0 };

  return {
    root, mixer, head, outline, skinned,
    /** speed m/s along the ground, airborne flag, dt */
    update(speed, airborne, dt) {
      const k = 1 - Math.exp(-dt * 10);
      air += ((airborne ? 1 : 0) - air) * (1 - Math.exp(-dt * (airborne ? 14 : 9)));
      const walkT = THREE.MathUtils.clamp(speed / 0.9, 0, 1);
      const runT = THREE.MathUtils.clamp((speed - 2.0) / (RUN_SPEED - 2.0), 0, 1);
      const target = { Idle: 1 - walkT, Walk: walkT * (1 - runT), Run: walkT * runT };
      for (const n of ['Idle', 'Walk', 'Run']) {
        w[n] += (target[n] - w[n]) * k;
        act[n].setEffectiveWeight(w[n] * (1 - air));
      }
      act.Jump.setEffectiveWeight(air);
      // keep walk and run in phase: one cycle clock, each clip at the speed it was made for
      const walkRate = Math.max(0.55, speed / WALK_SPEED);
      const runRate = Math.max(0.6, speed / RUN_SPEED);
      const blendRate = walkRate * (1 - runT) + (runRate * act.Walk.getClip().duration / act.Run.getClip().duration) * runT;
      act.Walk.timeScale = blendRate;
      act.Run.timeScale = blendRate * act.Run.getClip().duration / act.Walk.getClip().duration;
      act.Run.time = (act.Walk.time / act.Walk.getClip().duration) * act.Run.getClip().duration;
      mixer.update(dt);
    },
    setVisible(v) { model.visible = v; blob.visible = v; },
  };
}
