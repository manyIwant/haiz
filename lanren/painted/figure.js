// Layer 5 · the 入画 people, painted into the same picture.
//
// The campus's bodies, their gait (three-procedural-locomotion), their days and the walker you play stay
// exactly as they are (lanren/life). What changes is how they are painted, so that a person is drawn with
// the campus and not pasted on it:
//
//   cel      a film draws its people in flat colour with a clean turn between light and shade (Painted
//            Valley's wanderer does the same); clothes and hair turn crisply, skin over a broader, softer
//            edge (a face is a smooth form). The shade is a colour of its own: the hour's sky light,
//            nearly neutral, pulled toward the hour's cool shade hue — the same shade the walls and the
//            lawn take, which is what makes them one picture
//   place    they stand in the same light: tree shade and building shadow from the same shadow map
//            (crisp, as the background's), the drifting cloud shade, and the colour of the ground under
//            their feet bounced up into their undersides — warm off paving, green off a lawn
//   folds    the deep of a fold where cloth turns away from the eye on its shade side
//   rim      a thin warm rim when the sun is behind them
//   cloth    the shirt's hem and the hair's ends answer the same gust field the grass and the crowns lean
//            in, and lag behind the walker's own movement (inertia), a few centimetres — no simulation, a
//            shaped displacement after skinning
//   ink      their lines are drawn by the finish from what they write here (figure, and a part code per
//            garment) — the hull outlines are retired in the painted look
import * as THREE from 'three';
import { celPlus, writeInfo, INFO, ART, TOGGLES } from './art.js';

const FIG_V_HEAD = 'uniform vec3 uClothVel; uniform float uArt; uniform vec4 uArtL;\n';
const FIG_V_WORLD = /* glsl */`
{
  float kC = uArt * uArtL.w;
  float kind = aData.a;
  vec3 origin = modelMatrix[3].xyz;
  float h = vWP.y - origin.y;
  float hem = smoothstep(1.14, 0.93, h) * smoothstep(0.84, 0.9, h) * step(0.85, kind);
  float ends = smoothstep(1.6, 1.42, h) * smoothstep(1.2, 1.35, h) * step(0.35, kind) * step(kind, 0.6);
  float wgt = hem + ends * 0.45;
  if (wgt > 0.001 && kC > 0.001) {
    float gq = windField(vWP.xz);
    vec2 wd = uWindDir;
    float flap = sin(uTime * 7.5 + dot(vWP.xz, vec2(9.0, 7.0)) + h * 20.0);
    vec3 push = vec3(wd.x, 0.0, wd.y) * (0.006 + 0.014 * gq) * uWindSway * (1.0 + 0.4 * flap);
    // inertia: the hem lags the body's motion and flutters with the pace
    float sp = length(uClothVel.xz);
    push += -uClothVel * 0.011 + normalize(vec3(-uClothVel.x, 0.0, -uClothVel.z) + 1e-4) * sp * 0.004 * flap;
    vec3 off = push * wgt * kC;
    vWP += off;
    #if defined( USE_SHADOWMAP )
      worldPosition.xyz += off;
    #endif
    gl_Position = projectionMatrix * viewMatrix * vec4(vWP, 1.0);
  }
}
`;
const FIG_F_HEAD = 'uniform sampler2D uGPaint; uniform vec2 uGPaintO; uniform float uGPaintS;\n';
const FIG_F_AFTER = /* glsl */`
{
  float kP = uArt * uArtL.w;
  float kind = vData.a;
  vec3 V = normalize(cameraPosition - vWP);
  float skin = step(0.6, kind) * step(kind, 0.85);
  float ndl = dot(N, uSunDir);
  float w = mix(0.03, 0.16, skin);
  float sh = smoothstep(0.36, 0.64, shadow);
  float lit = smoothstep(-w, w, ndl + 0.04) * sh * cloudShade(vWP);
  vec3 skyL = mix(uGroundAmb, uSkyAmb, N.y * 0.5 + 0.5) * ao;
  float gl = artLuma(skyL);
  vec3 shadeL = mix(mix(skyL, vec3(gl), 0.45), gl * uShadeHue * 1.45, min(1.0, uShadeMix * 1.35));
  vec3 litL = shadeL + uSunColor * 0.84;
  vec2 puv = (vWP.xz - uGPaintO) / uGPaintS;
  vec3 gcol = pow(texture2D(uGPaint, vec2(puv.x, 1.0 - puv.y)).rgb, vec3(2.2));
  vec3 bounce = gcol * uSunColor * 0.34 * clamp(0.45 - N.y * 0.6, 0.0, 1.0) * max(uSunDir.y, 0.15);
  vec3 col = albedo * mix(shadeL, litL, lit) + albedo * bounce;
  float deep = (1.0 - lit) * smoothstep(0.38, 0.12, dot(N, V)) * (1.0 - skin);
  col *= 1.0 - deep * 0.3;
  col += albedo * vec3(0.18, 0.055, 0.03) * (1.0 - lit) * skin;
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += uRim * albedo * smoothstep(0.5, 0.72, fres) * max(0.0, dot(-V, uSunDir)) * sh * 1.1;
  // the hair keeps its own lifted highlight from the walk's material (outCol carries it): add the difference
  float hair = step(0.35, kind) * step(kind, 0.6);
  outCol = mix(outCol, col + hair * max(outCol - albedo * mix(shadeL, litL, lit), vec3(0.0)) * 0.6, kP * step(0.35, kind));
  haizInfo = vec4(1.0, fract(kind * 2.7 + dot(vData.rgb, vec3(1.3, 2.1, 0.7))), 0.0, 0.0);
}
`;

export function createFigureArt(world) {
  const cache = new Map();
  // the retired hull outlines come back when the painted look is switched off (A/B)
  const hulls = new Set();
  TOGGLES.push({ on() { for (const m of hulls) m.visible = false; }, off() { for (const m of hulls) m.visible = true; } });
  const ground = world.ground;
  const shared = {
    uGPaint: { value: ground.paintTex }, uGPaintO: { value: new THREE.Vector2(ground.paint.x0, ground.paint.z0) }, uGPaintS: { value: ground.paint.span },
  };
  const up = (m) => {
    if (!m?.userData?.celOpts || m.userData.art || !/^figure/.test(m.name)) return null;
    if (!cache.has(m)) {
      const n = celPlus(m, {
        key: 'figure', info: INFO.figure,
        uniforms: { ...shared, uClothVel: { value: new THREE.Vector3() } },
        vertex: { head: FIG_V_HEAD, world: FIG_V_WORLD },
        fragment: { head: FIG_F_HEAD, after: FIG_F_AFTER },
      });
      cache.set(m, n);
    }
    return cache.get(m);
  };
  return {
    /** restyle every figure under root (the walker, the campus's people as they arrive); returns how many meshes changed */
    apply(root) {
      let n = 0;
      root.traverse((o) => {
        if (!o.isMesh) return;
        // the hull outlines are retired: the finish inks the figure from the info attachment
        if (o.isSkinnedMesh && o.material?.side === THREE.BackSide && o.material.uniforms?.uWidth) {
          if (!hulls.has(o.material)) { hulls.add(o.material); o.material.visible = ART.uArt.value < 0.5; writeInfo(o.material, INFO.figure); }
          return;
        }
        const next = up(o.material);
        if (next && o.material !== next) { o.material = next; n++; }
        // whatever a person carries is inked with them
        const list = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of list) writeInfo(m, INFO.figure);
      });
      return n;
    },
    /** the walker's own velocity drives the inertia of the hem (m/s, world) */
    setVelocity(root, vx, vz) {
      root.traverse((o) => { const u = o.isSkinnedMesh && o.material?.userData?.uniforms?.uClothVel; if (u) u.value.set(vx, 0, vz); });
    },
    cache,
  };
}
