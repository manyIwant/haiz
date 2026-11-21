// HAIZ · the walk, again — a body that carries its weight (see docs/life-20261117.md, 第一部分).
//
// The 入画 v1 walker (lanren/ruhua/walker.js) built a walk out of parts: feet on a timer-like phase, a
// pelvis bob, arms swung against the legs. Looked at in the motion lab (walker-lab.html), what read as
// "strange" was not one bug but the absence of the things that make weight visible: the cadence grew
// linearly with speed, so steps were short and quick; the body's speed came from the controller instantly,
// so the legs had to catch up with a body that was already moving (feet slid on start, stop and turn: up
// to a quarter of all stance frames); the foot swung on a symmetric arc and landed flat; the trunk did
// not lean into an acceleration until after it had happened; the arms hung from a rest pose with locked
// elbows; turns rotated the root and then asked the feet to follow.
//
// Here the motion comes from three-procedural-locomotion (MIT, lanren/vendor/procedural-locomotion), a
// procedural gait tuned curve by curve against CMU motion capture: cadence ∝ √speed, a stance that sits
// behind the hip, heel strike and roll over the toes, knees that cushion the weight, a pelvis that
// rises over the standing leg, drops on the swing side and tilts twice a stride, arms as damped
// pendulums, turns that slow the body and land each foot already pointing the new way, closing steps
// when stopping. Crucially the body's own motion is simulated with the gait (acceleration, braking,
// turn rate), so the feet are never asked to explain a velocity they did not produce.
//
// HAIZ adds: the figure's materials and outline, the campus ground and walls, the student's look (head
// turns toward what the player looks at), an umbrella in the rain, and a personality per character
// (a few parameters: tempo, stride, arm swing, posture) so the people of the campus do not all walk alike.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { createProceduralHuman, applyBasicControls, defaultConfig, stylePresets } from '../vendor/procedural-locomotion/procedural-locomotion.min.js';
import { bodyMaterial, outlineMaterial } from '../ruhua-stroll/student.js';
import { cel, celLike } from '../ruhua-stroll/atmos.js';

const clamp = THREE.MathUtils.clamp;
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

// scripts/ruhua/build_student.py names the bones like a Rigify metarig, more plainly
export const HAIZ_MAPPING = {
  hips: 'hips',
  left: { thigh: 'thigh.L', shin: 'shin.L', foot: 'foot.L', toe: 'toe.L' },
  right: { thigh: 'thigh.R', shin: 'shin.R', foot: 'foot.R', toe: 'toe.R' },
  spine: 'spine', chest: 'chest', neck: 'neck', head: 'head',
  leftArm: { shoulder: 'shoulder.L', upperArm: 'upperarm.L', forearm: 'forearm.L', hand: 'hand.L' },
  rightArm: { shoulder: 'shoulder.R', upperArm: 'upperarm.R', forearm: 'forearm.R', hand: 'hand.R' },
};

// the living campus's figures add five three-joint fingers to each hand (the gait relaxes them)
const fingers = (sd) => Object.fromEntries(['thumb', 'index', 'middle', 'ring', 'pinky'].map((f) => [f, [1, 2, 3].map((j) => `${f}.0${j}.${sd}`)]));
export const HAIZ_MAPPING_HANDS = {
  ...HAIZ_MAPPING,
  leftArm: { ...HAIZ_MAPPING.leftArm, fingers: fingers('L') },
  rightArm: { ...HAIZ_MAPPING.rightArm, fingers: fingers('R') },
};

// The player's student: brisk, light, a little bounce — a 16-year-old crossing the campus, not a soldier
// and not a tired adult. Speeds stay what the walk's camera and distances were designed for.
export const STUDENT = {
  walkSpeed: 1.5, runStartSpeed: 1.95, runTransition: 0.7, runSpeed: 3.9,
  acceleration: 2.4, deceleration: 4.0, speedEasing: 0.22,
  turnSpeed: 200, turnAcceleration: 900, maxLateralAcceleration: 4.2,
  stepFrequency: 1.95, stepHeight: 0.05,
  runStepLength: 1.45, runStepFrequency: 2.95, runCrouch: 0.045, runBounce: 0.035, runLean: 9,
  armSwing: 14, elbowBend: 26, armAbduction: 4, idleArmAbduction: 7,
  jumpSpeed: 3.6,
};

/** The campus ground for the gait: a height function (no triangles to raycast). */
export function heightGround(heightAt) {
  return {
    castDown(origin, maxDistance, out) {
      const y = heightAt(origin.x, origin.z);
      if (origin.y - y > maxDistance) return false;
      out.point.set(origin.x, y, origin.z);
      out.normal.set(0, 1, 0);
      out.distance = origin.y - y;
      return true;
    },
  };
}

// the drawn edge of the figure: V2's inverted hull, but none on the eyes and inside the mouth (their colour
// carries kind < 0.3), where a hull pushed out along the normals would poke through the narrow creases
function figureOutline() {
  const m = outlineMaterial();
  m.vertexShader = m.vertexShader
    .replace('uniform float uWidth;', 'uniform float uWidth;\nattribute vec4 aData;')
    .replace('wp.xyz += wn * uWidth', 'wp.xyz += wn * uWidth * step(0.3, aData.a)');
  m.needsUpdate = true;
  return m;
}

function umbrella() {
  const g = new THREE.Group();
  const canopyMat = cel({ name: 'umbrella', key: 'umbrella', color: new THREE.Color('#2f5f57'), side: THREE.DoubleSide, soft: 0.2,
    fragment: { albedo: 'float rib = abs(fract(atan(vWP.x, vWP.z) * 1.27) - 0.5); albedo *= 0.9 + 0.12 * smoothstep(0.05, 0.0, rib);\n' } });
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.2, 16, 1, true).translate(0, 0.86, 0), canopyMat);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.9, 6).translate(0, 0.42, 0), cel({ name: 'umb-shaft', key: 'umb-shaft', color: new THREE.Color('#3a3530') }));
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.009, 6, 10, Math.PI).rotateZ(Math.PI).translate(0.035, 0, 0), shaft.material);
  g.add(canopy, shaft, handle);
  g.traverse((o) => { o.castShadow = true; });
  g.userData.canopy = canopy;
  return g;
}

const cache = new Map();
async function loadFigure(url) {
  if (!cache.has(url)) cache.set(url, new GLTFLoader().loadAsync(url));
  return cache.get(url);
}

/**
 * opts: { heightAt(x, z), x, z, yaw, preset, config (gait parameters), basic (applyBasicControls values),
 *         seed, palette: { shirt, trousers, bag, hair, skin } (recolour, for the campus's other people),
 *         outline (true), shadow (true) }
 */
export async function createWalker(url, opts = {}) {
  const gltf = await loadFigure(url);
  const model = SkeletonUtils.clone(gltf.scene);
  // the figure's parts (scripts/life/build_people.py): the body in its uniform, several hairstyles, a bag;
  // this person keeps the body, one hairstyle and (or not) the bag. (The 入画 v1 figure is one mesh.)
  const meshes = [];
  model.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
  if (!meshes.length) throw new Error('gait: no skinned mesh');
  const hairs = meshes.filter((m) => /^Hair-/.test(m.name));
  const hairName = 'Hair-' + (opts.hair || (hairs[0] ? hairs[0].name.slice(5) : ''));
  const keep = meshes.filter((m) => !/^Hair-|^Bag|^Glasses/.test(m.name) || m.name === hairName || (m.name.startsWith('Bag') && opts.bag !== false) || (m.name.startsWith('Glasses') && opts.glasses));
  for (const m of meshes) if (!keep.includes(m)) m.parent.remove(m);
  // the campus's people can dissolve (into a doorway): a painterly breakup in world space, not a fade
  const uFade = { value: 1 };
  const material = opts.fade ? celLike(bodyMaterial(), { key: 'fade', uniforms: { uFade },
    fragment: { head: 'uniform float uFade;\n', pre: 'if (uFade < 0.999 && aNoise(vWP.xy * 11.0 + vWP.zy * 7.0) * 0.8 + aNoise(vWP.xz * 31.0) * 0.2 > uFade * 1.08 - 0.04) discard;\n' } }) : bodyMaterial();
  const outlines = [];
  for (const sk of keep) {
    let geo = sk.geometry;
    if (!geo.getAttribute('aData')) {
      geo = geo.clone();
      geo.setAttribute('aData', geo.getAttribute('color').clone());
      geo.deleteAttribute('color');
      if (opts.palette) recolour(geo, opts.palette);
      sk.geometry = geo;
    }
    sk.material = material;
    sk.castShadow = opts.shadow !== false; sk.receiveShadow = true;
    sk.frustumCulled = false;
    if (opts.outline !== false) {
      const ol = new THREE.SkinnedMesh(geo, figureOutline());
      ol.material.uniforms.uWidth.value = 0.006;
      ol.bind(sk.skeleton, sk.bindMatrix);
      ol.frustumCulled = false;
      ol.position.copy(sk.position); ol.quaternion.copy(sk.quaternion); ol.scale.copy(sk.scale);
      sk.parent.add(ol);
      outlines.push(ol);
    }
  }
  const skinned = keep.find((m) => !/^Hair-|^Bag|^Glasses/.test(m.name)) || keep[0];
  const outline = outlines[0] || null;
  const root = new THREE.Group();
  root.name = 'walker';
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.4, 24), new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(0.05, 0.08, 0.12, 0.34 * (1.0 - smoothstep(0.2, 1.0, d))); }' }));
  blob.rotation.x = -Math.PI / 2; blob.renderOrder = 2;
  root.add(model, blob);

  const heightAt = opts.heightAt || (() => 0);
  // created facing +Z (the figure's own front): the gait's heading is measured from the orientation at
  // creation, and HAIZ steers in world yaw, so every body starts square and is turned afterwards (place)
  model.position.set(opts.x ?? 0, heightAt(opts.x ?? 0, opts.z ?? 0), opts.z ?? 0);
  model.rotation.set(0, 0, 0);
  model.updateMatrixWorld(true);
  // a style preset (the campus's other people: 'athletic', 'tired'…) is the base instead of the student's
  // tuning; per-person overrides go on top, then the high-level controls computed from all of that
  let config = { ...(opts.preset ? stylePresets[opts.preset] : STUDENT), ...(opts.config || {}) };
  if (opts.basic) config = { ...config, ...applyBasicControls({ ...defaultConfig, ...config }, opts.basic) };
  const hasFingers = !!model.getObjectByName('thumb01L');
  const human = createProceduralHuman({
    model, mapping: hasFingers ? HAIZ_MAPPING_HANDS : HAIZ_MAPPING, ground: heightGround(heightAt), config, seed: opts.seed ?? 1,
    forward: new THREE.Vector3(0, 0, 1),
  });

  const bone = (n) => model.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(n));
  const B = { neck: bone('neck'), head: bone('head'), armR: bone('upperarm.R'), foreR: bone('forearm.R'), handR: bone('hand.R'), armL: bone('upperarm.L'), foreL: bone('forearm.L'), handL: bone('hand.L') };
  const umb = opts.umbrella === false ? null : umbrella();
  if (umb) { umb.visible = false; B.handR.add(umb); umb.position.set(0, 0.06, 0); }

  const G = { look: { y: 0, p: 0, w: 0, ty: 0, tp: 0, tw: 0 }, umb: 0, umbWant: false, time: 0, visible: true, fade: 1, hold: null, holdK: {} };
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qc = new THREE.Quaternion(), v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const qUp = new THREE.Quaternion(), right = new THREE.Vector3();
  // arms that hold something, in the body's frame (Euler: x forward-up, z out to the side), blended over
  // whatever the gait does: an umbrella up at the chest, a book read in front, a folder at the side, a broom
  const E = (x, y, z) => new THREE.Euler(x, y, z);
  const HOLDS = {
    umbrella: { R: [E(-0.95, 0, 0.35), E(-1.25, 0, 0.1)] },
    book: { R: [E(-0.55, 0, 0.32), E(-1.55, 0, 0.55)], L: [E(-0.55, 0, -0.32), E(-1.55, 0, -0.55)] },
    folder: { L: [E(-0.12, 0, -0.12), E(-1.35, 0, -0.35)] },
    sketchbook: { L: [E(-0.1, 0, -0.1), E(-0.9, 0, -0.2)] },
    broom: { R: [E(-0.5, 0, 0.18), E(-0.6, 0, 0.05)], L: [E(-0.75, 0, -0.28), E(-0.95, 0, -0.3)] },
    // 课间操: arms out to the sides, then up
    // (about the forward axis +z turns an arm toward the walker's left: out for the left arm, in for the right)
    armsOut: { R: [E(0, 0, -1.45), E(0, 0, -1.45)], L: [E(0, 0, 1.45), E(0, 0, 1.45)] },
    armsUp: { R: [E(-2.85, 0, -0.25), E(-2.85, 0, -0.25)], L: [E(-2.85, 0, 0.25), E(-2.85, 0, 0.25)] },
  };
  function applyHold(name, k) {
    const h = HOLDS[name], bodyQ = model.getWorldQuaternion(qc);
    for (const side of ['R', 'L']) {
      if (!h[side]) continue;
      for (const [b, e] of [[B['arm' + side], h[side][0]], [B['fore' + side], h[side][1]]]) {
        b.updateWorldMatrix(true, false);
        const cur = b.getWorldQuaternion(qa);
        const target = qb.setFromEuler(e).premultiply(bodyQ).multiply(b.userData.bindInBody);
        cur.slerp(target, k);
        const pq = b.parent.getWorldQuaternion(qUp).invert();
        b.quaternion.copy(pq.multiply(cur));
      }
    }
  }

  function post(dt) {
    G.time += dt;
    // the head: an additive turn toward what the player looks at, on top of the gait's own gaze
    const lk = G.look;
    lk.y += (lk.ty - lk.y) * (1 - Math.exp(-dt * 5)); lk.p += (lk.tp - lk.p) * (1 - Math.exp(-dt * 5)); lk.w += (lk.tw - lk.w) * (1 - Math.exp(-dt * 3));
    const ly = clamp(lk.y, -1.2, 1.2) * lk.w, lp = clamp(lk.p, -0.6, 0.75) * lk.w;
    if (Math.abs(ly) + Math.abs(lp) > 1e-3) {
      // rotate about the body's vertical and its own left-right axis, in world terms, then back to local
      const bodyQ = model.getWorldQuaternion(qc);
      right.set(1, 0, 0).applyQuaternion(bodyQ);
      for (const [b, ky, kp] of [[B.neck, 0.4, 0.35], [B.head, 0.6, 0.65]]) {
        b.updateWorldMatrix(true, false);
        const wq = b.getWorldQuaternion(qa);
        qb.setFromAxisAngle(up, ly * ky).multiply(qUp.setFromAxisAngle(right, -lp * kp)).multiply(wq);
        const pq = b.parent.getWorldQuaternion(qUp).invert();
        b.quaternion.copy(pq.multiply(qb));
      }
    }
    // what the hands hold (each eases in and out on its own)
    for (const name of Object.keys(HOLDS)) {
      const want = name === 'umbrella' ? (G.umbWant && umb ? 1 : 0) : G.hold === name && !(G.umbWant && umb && HOLDS[name].R) ? 1 : 0;
      const k = G.holdK[name] = (G.holdK[name] || 0) + (want - (G.holdK[name] || 0)) * (1 - Math.exp(-dt * (name === 'umbrella' ? 2.2 : 3.5)));
      if (k > 0.01) applyHold(name, smooth(k));
    }
    // the umbrella opens and stays upright whatever the walk does
    if (umb) {
      G.umb = G.holdK.umbrella || 0;
      umb.visible = G.umb > 0.05 && G.visible;
      if (umb.visible) {
        const c = smooth((G.umb - 0.05) / 0.95);
        umb.userData.canopy.scale.set(0.25 + 0.75 * c, 0.6 + 0.4 * c, 0.25 + 0.75 * c);
        B.handR.updateWorldMatrix(true, false);
        umb.quaternion.copy(B.handR.getWorldQuaternion(qa).invert());
      }
    }
    // the contact shadow stays under the body
    blob.position.set(model.position.x, heightAt(model.position.x, model.position.z) + 0.02, model.position.z);
  }
  // record each arm bone's rest orientation relative to the model (before the gait first moves them)
  model.updateMatrixWorld(true);
  {
    human.restPose();
    model.updateMatrixWorld(true);
    const inv = model.getWorldQuaternion(new THREE.Quaternion()).invert();
    for (const b of [B.armR, B.foreR, B.armL, B.foreL]) b.userData.bindInBody = inv.clone().multiply(b.getWorldQuaternion(new THREE.Quaternion()));
    human.reset();
  }

  if (opts.yaw) { model.rotation.set(0, opts.yaw, 0); model.updateMatrixWorld(true); human.reset(); human.targetHeading = human.heading; }

  return {
    root, model, skinned, outline, outlines, human, G, blob,
    get position() { return human.position; },
    get speed() { return human.speed; },
    get heading() { return human.heading; },
    get airborne() { return human.airborne; },
    /** real m/s per configured m/s (a 1.68 m student walks and runs a little slower than the 1.83 m reference) */
    get speedScale() { return human.speedScale; },
    /** steer: desired speed (m/s) and heading (rad, three.js yaw: 0 = +Z, + turns toward +X) */
    steer(speed, heading) { human.targetSpeed = speed; human.targetHeading = human.heading + wrap(heading - human.heading); },
    jump() { return human.jump(); },
    /** advance the body and pose it */
    tick(dt) { if (dt > 0) { human.update(dt); post(dt); } },
    /** move the whole body without changing its motion (the walls push it back) */
    shift(dx, dz) { if (dx || dz) human.shiftOrigin(v.set(dx, 0, dz)); },
    /** stand at (x, z) facing yaw, still */
    place(x, z, yaw) {
      model.position.set(x, heightAt(x, z), z); model.rotation.set(0, yaw, 0); model.updateMatrixWorld(true);
      human.reset(); human.targetSpeed = 0; human.targetHeading = human.heading;
    },
    // ---- the old walker's interface (player.js, main.js)
    update() { /* the gait advances in tick(); the old controller's per-frame call is a no-op */ },
    lookAt(yaw, pitch, weight = 1) { G.look.ty = yaw; G.look.tp = pitch; G.look.tw = weight; },
    setVisible(vis) { G.visible = vis; model.visible = vis && G.fade > 0.01; blob.visible = vis && G.fade > 0.01; },
    setUmbrella(on) { G.umbWant = on; },
    /** hold something: 'book' | 'folder' | 'sketchbook' | 'broom' | null */
    setHold(name) { G.hold = name; },
    /** 1 = solid … 0 = gone (people of the campus going through a door) */
    setFade(f) {
      G.fade = f; uFade.value = f;
      const vis = G.visible && f > 0.01;
      model.visible = vis; blob.visible = vis; blob.material.opacity = f;
      for (const ol of outlines) ol.visible = f > 0.98;
      for (const sk of keep) sk.castShadow = opts.shadow !== false && f > 0.5;
    },
    bone,
    on: (...a) => human.on(...a),
  };
}

// the campus's other people wear other clothes. COLOR_0 holds linear rgb + a material kind in alpha
// (1 cloth, .75 skin, .5 hair, .25 eyes); the student's cloth colours are distinct groups (measured from
// lanren/assets/ruhua/student.glb), so each is matched exactly and swapped. Without a bag (a teacher, the
// worker), the bag and its straps fold away inside the torso.
const GROUPS = {
  shirt: [0.93, 0.93, 0.90], trousers: [0.09, 0.12, 0.20], bag: [0.78, 0.30, 0.10], straps: [0.25, 0.22, 0.20],
};
function recolour(geo, pal) {
  const a = geo.getAttribute('aData'), pos = geo.getAttribute('position');
  const near = (i, g) => Math.abs(a.getX(i) - g[0]) + Math.abs(a.getY(i) - g[1]) + Math.abs(a.getZ(i) - g[2]) < 0.04;
  const isCol = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
  const set = (i, hex) => { if (!isCol(hex)) return; const t = new THREE.Color(hex); a.setXYZ(i, t.r, t.g, t.b); };
  for (let i = 0; i < a.count; i++) {
    const kind = a.getW(i);
    if (kind > 0.85) {
      if (near(i, GROUPS.shirt) && pos.getY(i) > 0.5) { if (pal.shirt) set(i, pal.shirt); }
      else if (near(i, GROUPS.trousers)) { if (pal.trousers) set(i, pal.trousers); }
      else if (near(i, GROUPS.bag) || near(i, GROUPS.straps)) {
        if (pal.noBag) pos.setXYZ(i, 0, 1.22, -0.02);
        else if (pal.bag && near(i, GROUPS.bag)) set(i, pal.bag);
      }
    } else if (kind > 0.6) { if (pal.skin) set(i, pal.skin); }
    else if (kind > 0.35) { if (pal.hair) set(i, pal.hair); }
  }
  a.needsUpdate = true; pos.needsUpdate = true;
}
