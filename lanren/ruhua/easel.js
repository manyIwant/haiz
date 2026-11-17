// 入画 · the easel.
//
// 写生: the walker sets up an easel in the forecourt and paints the tree sight-size — the canvas
// stands between the eye and the tree, and what is painted on it is exactly what it hides (the
// principle of Magritte's easel before the window; here it is also how the painting will reach the
// world). Everything on the canvas is kept in the painter's screen space, so from the painter's eye
// the painting and the world agree to the pixel; from anywhere else the canvas is flat paint.
//
//   reference   the painted world from the painter's eye under today's sky (pipeline.js)
//   strokes     planned from it (strokes.js), laid where the player drags: the strokes of the
//               current stage nearest the brush go down first, each laid along its length
//   canvas      linen, charcoal, paint with its relief, catching the light; a seal and a dated line
//   spill       strokes painted past the canvas edge land on the world at once (projector map)
//   departure   the paint leaves the canvas, stroke by stroke, along the painter's sight lines; the
//               larger strokes are seen flying, and land on what they depict (the tree first)
import * as THREE from 'three';
import { U, GLSL } from '../ruhua-stroll/atmos.js';
import { PAINT, PAINT_GLSL } from './paintfield.js';
import { planStrokes } from './strokes.js';

const SRGB2LIN = 'vec3 s2l(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }\n';

// ---------------------------------------------------------------- strokes into the painter's screen
const STROKE_VERT = /* glsl */`
attribute vec2 aUV; attribute vec3 aCol; attribute vec4 aMeta; attribute float aRev;
uniform float uClock; uniform float uAspect;
varying vec2 vUV; varying vec3 vCol; varying vec4 vMeta; varying float vShown; varying vec2 vScreen;
void main() {
  vUV = aUV; vCol = aCol; vMeta = aMeta;
  float lay = 0.16 + 0.05 * float(aMeta.y > 1.5);
  vShown = (uClock - aRev) / lay - aUV.x;           // the brush travels along the stroke
  vScreen = position.xy;
  gl_Position = vec4(position.xy * 2.0 - 1.0, 0.0, 1.0);
}`;
const STROKE_FRAG = (mode) => /* glsl */`
uniform float uClock; uniform vec4 uRect; uniform float uClip;
varying vec2 vUV; varying vec3 vCol; varying vec4 vMeta; varying float vShown; varying vec2 vScreen;
float sh(vec2 p) { p = fract(p * vec2(443.8, 441.4)); p += dot(p, p + 19.19); return fract(p.x * p.y); }
float sn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(sh(i), sh(i + vec2(1, 0)), f.x), mix(sh(i + vec2(0, 1)), sh(i + vec2(1, 1)), f.x), f.y); }
void main() {
  if (vShown < 0.0) discard;
  if (uClip > 0.5 && (vScreen.x < uRect.x || vScreen.x > uRect.z || vScreen.y < uRect.y || vScreen.y > uRect.w)) discard;
  float seed = vMeta.w;
  float charcoal = step(vMeta.y, -0.5);
  float bristle = sn(vec2(vUV.y * (charcoal > 0.5 ? 3.0 : 7.0) + seed * 37.0, vUV.x * 1.2 + seed));
  float bristle2 = sn(vec2(vUV.y * 19.0 + seed * 11.0, vUV.x * 3.0));
  float load = mix(1.0, 0.5, vUV.x);                // the brush runs dry along the stroke
  // a round loaded tip where the brush lands, a ragged, thinning tail where it lifts
  float tipIn = sqrt(clamp(vUV.x / 0.16, 0.0, 1.0)), tipOut = sqrt(clamp((1.0 - vUV.x) / (0.22 + 0.2 * bristle2), 0.0, 1.0));
  float profile = min(tipIn, tipOut);
  float edge = 1.0 - smoothstep(0.6 * profile, profile, abs(vUV.y) + (bristle - 0.5) * 0.4);
  float ends = smoothstep(0.0, 0.03, vUV.x) * (1.0 - smoothstep(0.94, 1.0, vUV.x));
  float dry = mix(1.0, step(0.38 - 0.2 * load, bristle2), smoothstep(0.55, 1.0, vUV.x));
  float a = edge * ends * dry;
  if (charcoal > 0.5) a *= (0.3 + 0.7 * step(0.35, bristle2)) * 0.42;   // charcoal: grainy, light, catching the weave
  if (a < 0.02) discard;
  ${mode === 'color' ? `
  vec3 c = vCol * (0.93 + 0.14 * bristle) * (0.97 + 0.06 * bristle2);
  gl_FragColor = vec4(c * a, a);` : mode === 'height' ? `
  float h = (0.35 + 0.65 * bristle2) * load * a * (1.0 - charcoal) * (vMeta.y < 0.5 ? 0.5 : 0.85);
  gl_FragColor = vec4(h, h, h, 1.0);` : `
  if (a < 0.35 || charcoal > 0.5) discard;
  gl_FragColor = vec4(vMeta.z, vMeta.x, 0.0, 1.0);`}
}`;

function strokeMaterial(mode, uniforms) {
  const blend = mode === 'color' ? { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor }
    : mode === 'height' ? { blending: THREE.AdditiveBlending } : { blending: THREE.NoBlending };
  return new THREE.ShaderMaterial({ uniforms, vertexShader: STROKE_VERT, fragmentShader: STROKE_FRAG(mode), depthTest: false, depthWrite: false, transparent: mode !== 'proj', side: THREE.DoubleSide, ...blend });
}

/** ribbons for a list of strokes; meta = (projTravels 1/0, layer, projTime, seed) */
function ribbons(list, aspect, capacity = 0) {
  let nv = 0, ni = 0;
  for (const s of list) { const m = s.pts.length / 2; nv += m * 2; ni += (m - 1) * 6; }
  const NV = Math.max(nv, capacity * 2 * 12), NI = Math.max(ni, capacity * 6 * 11);
  const pos = new Float32Array(NV * 3), uv = new Float32Array(NV * 2), col = new Float32Array(NV * 3), meta = new Float32Array(NV * 4), rev = new Float32Array(NV).fill(1e9);
  const index = new Uint32Array(NI);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aUV', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aMeta', new THREE.BufferAttribute(meta, 4));
  g.setAttribute('aRev', new THREE.BufferAttribute(rev, 1));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  const R = { g, v: 0, i: 0, ranges: [] };
  R.add = (s, metaV) => {
    const m = s.pts.length / 2, v0 = R.v;
    let len = 0;
    const cum = [0];
    for (let k = 1; k < m; k++) { len += Math.hypot((s.pts[k * 2] - s.pts[k * 2 - 2]) * aspect, s.pts[k * 2 + 1] - s.pts[k * 2 - 1]); cum.push(len); }
    for (let k = 0; k < m; k++) {
      const a = Math.max(0, k - 1), b = Math.min(m - 1, k + 1);
      let tx = (s.pts[b * 2] - s.pts[a * 2]) * aspect, ty = s.pts[b * 2 + 1] - s.pts[a * 2 + 1];
      const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      // half the width (a fraction of the image width) as an offset in uv, perpendicular in true proportions
      const half = s.w * 0.5;
      const nx = -ty * half, ny = tx * half * aspect;
      const x = s.pts[k * 2], y = s.pts[k * 2 + 1];
      for (const side of [-1, 1]) {
        const v = R.v++;
        pos.set([x + nx * side, y + ny * side, 0], v * 3);
        uv.set([len > 0 ? cum[k] / len : k / Math.max(1, m - 1), side], v * 2);
        col.set(s.col, v * 3);
        meta.set(metaV, v * 4);
      }
    }
    for (let k = 0; k < m - 1; k++) { const a = v0 + k * 2; index.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], R.i); R.i += 6; }
    R.ranges.push([v0, R.v]);
    g.setDrawRange(0, R.i);
    for (const n of ['position', 'aUV', 'aCol', 'aMeta']) g.getAttribute(n).needsUpdate = true;
    g.index.needsUpdate = true;
    return R.ranges.length - 1;
  };
  R.reveal = (k, t) => {
    const [a, b] = R.ranges[k];
    rev.fill(t, a, b);
    const at = g.getAttribute('aRev');
    at.addUpdateRange(a, b - a); at.needsUpdate = true;
  };
  return R;
}

// ---------------------------------------------------------------- the canvas, the easel, the brush
const LINEN = /* glsl */`
float weave(vec2 uv) {
  vec2 p = uv * vec2(520.0, 420.0);
  float wx = 0.5 + 0.5 * sin(p.x * 3.14159) * sign(sin(p.y * 3.14159 * 0.5));
  float wy = 0.5 + 0.5 * sin(p.y * 3.14159) * sign(sin(p.x * 3.14159 * 0.5));
  return 0.5 * (wx + wy);
}`;
const CANVAS_VERT = /* glsl */`
varying vec2 vUv; varying vec3 vWP; varying vec3 vN;
void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWP = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;
const CANVAS_FRAG = /* glsl */`
${GLSL}
${PAINT_GLSL}
${SRGB2LIN}
${LINEN}
uniform sampler2D tPaint; uniform sampler2D tHeight; uniform sampler2D tChar; uniform sampler2D tSeal;
uniform vec2 uTexel; uniform float uSeal; uniform float uExpo; uniform vec3 uL6; uniform float uFront; uniform float uEmpty;
varying vec2 vUv; varying vec3 vWP; varying vec3 vN;
void main() {
  vec4 c4 = uProjVP * vec4(vWP, 1.0);
  vec2 puv = c4.xy / c4.w * 0.5 + 0.5;
  float w = weave(vUv);
  vec3 col = vec3(0.93, 0.9, 0.84) * (0.9 + 0.1 * w);
  vec4 ch = texture2D(tChar, puv);
  col = col * (1.0 - ch.a) + ch.rgb;
  vec4 pm = texture2D(uProjMap, puv);
  float stays = uEmpty > 0.5 ? 0.0 : (uPaintOn > 0.5 && pm.a > 0.5 && pm.g > 0.5) ? step(uPaintClock, uProjStart + pm.r) : 1.0;
  vec4 p = texture2D(tPaint, puv) * stays;
  col = p.rgb + col * (1.0 - p.a);
  // seal and the dated line, lower right
  vec4 s = texture2D(tSeal, vUv);
  col = mix(col, s.rgb, s.a * uSeal);
  // relief: the paint's ridges catch the light; fresh oil is glossy
  float h0 = texture2D(tHeight, puv).r * stays;
  float hx = texture2D(tHeight, puv + vec2(uTexel.x, 0.0)).r * stays, hy = texture2D(tHeight, puv + vec2(0.0, uTexel.y)).r * stays;
  vec3 Nf = normalize(vN);
  vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), Nf)), B = cross(Nf, T);
  vec3 N = normalize(Nf + (T * (h0 - hx) + B * (h0 - hy)) * 2.4 + Nf * 0.0 + (T * (w - 0.5) + B * (0.5 - w)) * 0.05 * (1.0 - p.a));
  // light: chapter 06's sun until the painted world reaches the easel, then today's
  float now = uPaintOn > 0.5 ? smoothstep(-0.3, 0.6, uPaintClock - uFront) : 1.0;
  vec3 L = normalize(mix(uL6, uSunDir, now));
  vec3 V = normalize(cameraPosition - vWP);
  float ndl = dot(N, L);
  float diff = mix(0.86, 1.08, smoothstep(-0.2, 0.9, ndl));
  float spec = pow(max(dot(reflect(-L, N), V), 0.0), 36.0) * p.a * 0.35;
  vec3 lin = s2l(col) * diff + vec3(spec);
  vec3 today = toonLight(s2l(col), N, vWP, 1.0, 1.0, 0.3) * 0.8;
  gl_FragColor = vec4(mix(lin / uExpo, today, now * 0.6), 1.0);
}`;

const WOOD_FRAG = /* glsl */`
${GLSL}
${PAINT_GLSL}
uniform vec3 uColor; uniform vec3 uL6; uniform float uFront; uniform float uExpo;
varying vec2 vUv; varying vec3 vWP; varying vec3 vN;
void main() {
  vec3 N = normalize(vN);
  float grain = 0.9 + 0.1 * aNoise(vec2(vUv.x * 4.0, vUv.y * 60.0));
  vec3 albedo = uColor * grain;
  float now = uPaintOn > 0.5 ? smoothstep(-0.3, 0.6, uPaintClock - uFront) : 1.0;
  vec3 L = normalize(mix(uL6, uSunDir, now));
  vec3 lit = albedo * (0.55 + 0.6 * max(dot(N, L), 0.0)) / uExpo;
  vec3 today = toonLight(albedo, N, vWP, 1.0, 1.0, 0.2);
  gl_FragColor = vec4(mix(lit, today, now), 1.0);
}`;

function sealTexture(lines) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 768;
  const g = c.getContext('2d');
  const x = 1024 * 0.79, y = 768 * 0.87, s = 74;
  // the seal: 海中, white characters cut from red
  g.fillStyle = 'rgba(176,32,28,0.92)';
  g.fillRect(x, y, s, s);
  g.fillStyle = 'rgba(245,236,226,0.95)';
  g.font = `700 ${s * 0.42}px "STKaiti","KaiTi","Kaiti SC","LXGW WenKai","Noto Serif SC",serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('海', x + s * 0.5, y + s * 0.28); g.fillText('中', x + s * 0.5, y + s * 0.72);
  g.fillStyle = 'rgba(40,34,30,0.85)';
  g.font = `500 26px "STKaiti","KaiTi","Kaiti SC","LXGW WenKai","Noto Serif SC",serif`;
  g.textAlign = 'right';
  lines.forEach((t, i) => g.fillText(t, x - 14, y + 22 + i * 30));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace; t.flipY = true;
  return t;
}

// the flying strokes: each travels from the canvas along its sight line and lands on what it depicts
const FLY_VERT = /* glsl */`
${PAINT_GLSL}
attribute vec3 aRay; attribute vec4 aSize; attribute vec3 aCol; attribute vec4 aFly;   // size: w, len (m at 1 m), angle, seed; fly: jit, canvasD, target, -
uniform vec3 uRight; uniform vec3 uUp;
varying vec2 vUv; varying vec3 vCol; varying float vSeed; varying float vA;
void main() {
  float t = uPaintClock - (uProjStart + aFly.x);
  float d = aFly.y + max(t, 0.0) * uProjSpeed;
  float alive = step(0.0, t) * step(d, aFly.z) * step(0.5, uPaintOn);
  vec3 p = uProjEye + aRay * d;
  float ca = cos(aSize.z), sa = sin(aSize.z);
  // a flake in flight: it flutters about its length
  float flut = cos(t * (5.0 + 4.0 * aSize.w) + aSize.w * 20.0);
  vec2 k = vec2(position.x * aSize.y, position.y * aSize.x * (0.35 + 0.65 * abs(flut)));
  vec2 r = vec2(k.x * ca - k.y * sa, k.x * sa + k.y * ca);
  p += (uRight * r.x + uUp * r.y) * d * alive;
  vUv = uv; vCol = aCol; vSeed = aSize.w; vA = alive * (1.0 - smoothstep(aFly.z * 0.85, aFly.z, d));
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  if (alive < 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
const FLY_FRAG = /* glsl */`
${SRGB2LIN}
uniform float uExpo;
varying vec2 vUv; varying vec3 vCol; varying float vSeed; varying float vA;
float sh(vec2 p) { p = fract(p * vec2(443.8, 441.4)); p += dot(p, p + 19.19); return fract(p.x * p.y); }
void main() {
  vec2 q = vUv * 2.0 - 1.0;
  float bristle = sh(vec2(floor(q.y * 7.0 + vSeed * 30.0), vSeed));
  // a dab of paint: a round loaded head, a thinning ragged tail
  float u = q.x * 0.5 + 0.5;
  float prof = min(sqrt(clamp(u / 0.25, 0.0, 1.0)), sqrt(clamp((1.0 - u) / (0.35 + 0.3 * bristle), 0.0, 1.0)));
  float a = 1.0 - smoothstep(0.55 * prof, prof, abs(q.y) + (bristle - 0.5) * 0.35);
  if (a * vA < 0.45) discard;
  gl_FragColor = vec4(s2l(vCol) * (0.95 + 0.15 * bristle) / uExpo, 1.0);
}`;

export function createEasel({ renderer, pipeline, world, layerPaint = 2, mobile = false }) {
  const group = new THREE.Group();
  group.name = 'easel';
  const L6 = { value: new THREE.Vector3(0.4, 0.7, 0.3) };
  const expo = { value: 1 };
  const front = { value: 1e6 };
  const S = {
    stage: 'idle', P: null, rect: [0.25, 0.12, 0.75, 0.8], aspect: 16 / 9, plan: null, rib: null, spill: null,
    layers: [], cur: 0, revealed: [], clock: 0, ink: 0, pointer: null, down: false, idle: 0, auto: false, stageT: 0,
    spillAmount: 0, done: false, seal: { value: 0 },
  };
  const res = mobile ? 768 : 1152;
  let paintRT, heightRT, charRT, projRT, depthRT, refRT;
  const sUniforms = { uClock: { value: 0 }, uAspect: { value: 1 }, uRect: { value: new THREE.Vector4() }, uClip: { value: 1 } };
  const matColor = strokeMaterial('color', sUniforms), matHeight = strokeMaterial('height', sUniforms), matProj = strokeMaterial('proj', sUniforms);
  const matSpill = strokeMaterial('proj', { ...sUniforms, uClip: { value: 0 } });
  const ortho = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
  const strokeScene = new THREE.Scene();
  const strokeMesh = new THREE.Mesh(new THREE.BufferGeometry(), matColor);
  strokeMesh.frustumCulled = false;
  strokeScene.add(strokeMesh);

  // ---- the objects (drawn with the painted world's pass: their colours must match the reference)
  const canvasMat = new THREE.ShaderMaterial({ vertexShader: CANVAS_VERT, fragmentShader: CANVAS_FRAG,
    uniforms: { ...U, ...PAINT, tPaint: { value: null }, tHeight: { value: null }, tChar: { value: null }, tSeal: { value: null }, uTexel: { value: new THREE.Vector2() },
      uSeal: S.seal, uExpo: expo, uL6: L6, uFront: front, uEmpty: { value: 0 } } });
  const woodMat = (hex) => new THREE.ShaderMaterial({ vertexShader: CANVAS_VERT, fragmentShader: WOOD_FRAG, uniforms: { ...U, ...PAINT, uColor: { value: new THREE.Color(hex) }, uL6: L6, uFront: front, uExpo: expo } });
  const canvasMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), canvasMat);
  const frameMat = woodMat('#c9b18c');
  const backMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), frameMat);
  const legMat = woodMat('#8a6a48');
  const legs = new THREE.Group();
  const legGeo = new THREE.BoxGeometry(0.035, 1, 0.035);
  for (let i = 0; i < 3; i++) legs.add(new THREE.Mesh(legGeo, legMat));
  const tray = new THREE.Mesh(new THREE.BoxGeometry(1, 0.03, 0.08), legMat);
  legs.add(tray);
  // the brush: a long handle, a ferrule, a loaded tip
  const brush = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0085, 0.3, 8).translate(0, 0.17, 0), woodMat('#3d2a20'));
  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0058, 0.035, 8).translate(0, 0.0175, 0), woodMat('#b8b3a6'));
  const tipMat = woodMat('#556b3a');
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.0065, 0.026, 8).rotateX(Math.PI).translate(0, -0.012, 0), tipMat);
  brush.add(handle, ferrule, tip);
  group.add(canvasMesh, backMesh, legs, brush);
  group.traverse((o) => { o.layers.set(layerPaint); o.frustumCulled = false; });
  group.visible = false;
  // flying strokes
  const flyGeo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  flyGeo.index = quad.index; flyGeo.setAttribute('position', quad.getAttribute('position')); flyGeo.setAttribute('uv', quad.getAttribute('uv'));
  const flyMat = new THREE.ShaderMaterial({ vertexShader: FLY_VERT, fragmentShader: FLY_FRAG, side: THREE.DoubleSide,
    uniforms: { ...PAINT, uRight: { value: new THREE.Vector3() }, uUp: { value: new THREE.Vector3() }, uExpo: expo } });
  const fly = new THREE.Mesh(flyGeo, flyMat);
  fly.frustumCulled = false; fly.layers.set(layerPaint); fly.visible = false;

  const toRT = (opts = {}) => new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false, ...opts });

  /** the painter's eye, the canvas on the easel in front of it, and the reference */
  async function setup(P, { portrait = false, lines = [] } = {}) {
    S.P = P.clone();
    S.P.layers.enableAll();
    S.aspect = P.aspect;
    const w = res, h = Math.round(res / S.aspect);
    paintRT?.dispose(); heightRT?.dispose(); charRT?.dispose(); projRT?.dispose(); depthRT?.dispose(); refRT?.dispose();
    paintRT = toRT(); paintRT.setSize(w, h);
    charRT = toRT(); charRT.setSize(w, h);
    heightRT = toRT({ type: THREE.HalfFloatType }); heightRT.setSize(w, h);
    projRT = toRT({ type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter }); projRT.setSize(w, h);
    // the canvas: a rectangle of the painter's screen, set on the easel 1.25 m in front of the eye
    S.rect = portrait ? [0.08, 0.24, 0.92, 0.72] : [0.27, 0.2, 0.73, 0.86];
    const D = 1.25;
    const un = (u, v) => new THREE.Vector3(u * 2 - 1, v * 2 - 1, 0.5).unproject(S.P).sub(S.P.position).normalize();
    const fwd = S.P.getWorldDirection(new THREE.Vector3());
    const at = (u, v) => { const r = un(u, v); return S.P.position.clone().addScaledVector(r, D / r.dot(fwd)); };
    const [x0, y0, x1, y1] = S.rect;
    const c00 = at(x0, y0), c10 = at(x1, y0), c01 = at(x0, y1), c11 = at(x1, y1);
    const centre = c00.clone().add(c11).multiplyScalar(0.5);
    const right = c10.clone().sub(c00), up = c01.clone().sub(c00);
    const cw = right.length(), chh = up.length();
    right.normalize(); up.normalize();
    const n = new THREE.Vector3().crossVectors(right, up).normalize();
    const basis = new THREE.Matrix4().makeBasis(right, up, n);
    canvasMesh.position.copy(centre); canvasMesh.quaternion.setFromRotationMatrix(basis); canvasMesh.scale.set(cw, chh, 1);
    backMesh.position.copy(centre).addScaledVector(n, -0.014); backMesh.quaternion.copy(canvasMesh.quaternion); backMesh.scale.set(cw + 0.02, chh + 0.02, 0.024);
    // the easel: front legs from the tray under the canvas to the ground, a mast and a back leg behind it
    const gy = world.heightAt(centre.x, centre.z);
    const ground = (p) => new THREE.Vector3(p.x, gy, p.z);
    const bottom = centre.clone().addScaledVector(up, -chh * 0.5 - 0.02);
    const behindTop = centre.clone().addScaledVector(up, chh * 0.5 + 0.12).addScaledVector(n, -0.06);
    const ends = [
      [bottom.clone().addScaledVector(right, -cw * 0.3).addScaledVector(n, 0.01), ground(bottom.clone().addScaledVector(right, -cw * 0.42).addScaledVector(n, 0.18))],
      [bottom.clone().addScaledVector(right, cw * 0.3).addScaledVector(n, 0.01), ground(bottom.clone().addScaledVector(right, cw * 0.42).addScaledVector(n, 0.18))],
      [behindTop, ground(centre.clone().addScaledVector(n, -0.8))],
    ];
    tray.position.copy(centre).addScaledVector(up, -chh * 0.5 - 0.016).addScaledVector(n, 0.025);
    tray.quaternion.copy(canvasMesh.quaternion); tray.scale.set(cw * 1.05, 1, 1);
    // the reference: the painted world from the painter's eye (neutral grade: no vignette, no tone split)
    const g = pipeline.gradeB.uniforms, keep = [g.uVignette.value, g.uShadowTone.value.clone(), g.uHighTone.value.clone(), g.uSat.value];
    g.uVignette.value = 0; g.uShadowTone.value.setRGB(1, 1, 1); g.uHighTone.value.setRGB(1, 1, 1); g.uSat.value = 1;
    const sw = pipeline.rtB.width, shh = pipeline.rtB.height;
    refRT = new THREE.WebGLRenderTarget(sw, shh);
    pipeline.renderPaintedTo(world.sceneRoot, S.P, refRT);
    g.uVignette.value = keep[0]; g.uShadowTone.value.copy(keep[1]); g.uHighTone.value.copy(keep[2]); g.uSat.value = keep[3];
    // its distances (from the painted pass's depth) and a small copy for planning
    const gw = mobile ? 384 : 512, gh = Math.round(gw / S.aspect);
    depthRT = toRT({ type: THREE.HalfFloatType }); depthRT.setSize(gw, gh);
    const small = toRT(); small.setSize(gw, gh);
    const q = new FullQuad();
    q.draw(renderer, small, `uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = texture2D(t, vUv); }`, { t: { value: refRT.texture } });
    q.draw(renderer, depthRT, `#include <packing>
uniform sampler2D t; uniform float n; uniform float f; uniform mat4 pinv; varying vec2 vUv;
void main(){ float z = texture2D(t, vUv).x; if (z >= 0.99999) { gl_FragColor = vec4(9000.0); return; }
  vec4 v = pinv * vec4(vUv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0); v /= v.w; gl_FragColor = vec4(length(v.xyz)); }`,
    { t: { value: pipeline.rtB.depthTexture }, n: { value: S.P.near }, f: { value: S.P.far }, pinv: { value: S.P.projectionMatrixInverse.clone() } });
    const rgba = new Uint8Array(gw * gh * 4);
    renderer.readRenderTargetPixels(small, 0, 0, gw, gh, rgba);
    const half = new Uint16Array(gw * gh * 4);
    renderer.readRenderTargetPixels(depthRT, 0, 0, gw, gh, half);
    const dist = new Float32Array(gw * gh);
    for (let i = 0; i < gw * gh; i++) dist[i] = THREE.DataUtils.fromHalfFloat(half[i * 4]);
    small.dispose();
    S.dist = dist; S.gw = gw; S.gh = gh;
    // the plan
    const plan = planStrokes(rgba, dist, gw, gh, S.rect, { seed: 20261117, scale: gw / 512 });
    S.plan = plan;
    const all = [plan.charcoal, ...plan.layers];
    const rib = ribbons(all.flat(), S.aspect, 0);
    S.layers = all.map((list, li) => list.map((s) => {
      const jit = li === 0 ? 0 : (4 - li) * 0.45 + Math.random() * 0.8;
      const k = rib.add(s, [1, li === 0 ? -1 : li - 1, jit, Math.random()]);
      return { k, x: s.pts[0], y: s.pts[1], s, jit, shown: false };
    }));
    S.rib = rib;
    strokeMesh.geometry = rib.g;
    S.spill = ribbons([], S.aspect, 500);
    S.spillMesh = new THREE.Mesh(S.spill.g, matSpill);
    S.spillMesh.frustumCulled = false;
    S.cur = 0; S.revealed = all.map(() => 0); S.ink = 0; S.stage = 'paint'; S.stageT = 0; S.spillAmount = 0; S.seal.value = 0; S.done = false;
    sUniforms.uRect.value.set(...S.rect); sUniforms.uAspect.value = S.aspect;
    // the projector: the painter's eye and its distances
    PAINT.uProjVP.value.multiplyMatrices(S.P.projectionMatrix, S.P.matrixWorldInverse);
    PAINT.uProjEye.value.copy(S.P.position);
    PAINT.uProjMap.value = projRT.texture;
    PAINT.uProjDepth.value = depthRT.texture;
    canvasMat.uniforms.tPaint.value = paintRT.texture; canvasMat.uniforms.tHeight.value = heightRT.texture; canvasMat.uniforms.tChar.value = charRT.texture;
    canvasMat.uniforms.uTexel.value.set(1 / w, 1 / h);
    canvasMat.uniforms.tSeal.value?.dispose();
    canvasMat.uniforms.tSeal.value = sealTexture(lines);
    for (const rt of [paintRT, charRT, heightRT, projRT]) { renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); }
    renderer.setRenderTarget(null);
    buildFlight();
    group.visible = true;
    return { strokes: all.reduce((a, l) => a + l.length, 0) };
  }

  function buildFlight() {
    const list = [];
    S.layers.slice(2, 5).forEach((L) => { for (const st of L) list.push(st); });
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    const pick = list.slice(0, mobile ? 2200 : 4200);
    const n = pick.length;
    const ray = new Float32Array(n * 3), size = new Float32Array(n * 4), col = new Float32Array(n * 3), fl = new Float32Array(n * 4);
    const fwd = S.P.getWorldDirection(new THREE.Vector3());
    const tanY = Math.tan(THREE.MathUtils.degToRad(S.P.fov) / 2);
    pick.forEach((st, i) => {
      const s = st.s, m = s.pts.length / 2;
      let cx = 0, cy = 0; for (let k = 0; k < m; k++) { cx += s.pts[k * 2]; cy += s.pts[k * 2 + 1]; } cx /= m; cy /= m;
      const r = new THREE.Vector3(cx * 2 - 1, cy * 2 - 1, 0.5).unproject(S.P).sub(S.P.position).normalize();
      const dx = (s.pts[(m - 1) * 2] - s.pts[0]) * S.aspect, dy = s.pts[(m - 1) * 2 + 1] - s.pts[1];
      const len = Math.max(Math.hypot(dx, dy), s.w * 0.8);
      const gx = Math.min(S.gw - 1, Math.max(0, Math.round(cx * S.gw))), gy = Math.min(S.gh - 1, Math.max(0, Math.round(cy * S.gh)));
      const target = Math.min(S.dist[gy * S.gw + gx], 900);
      ray.set([r.x, r.y, r.z], i * 3);
      // world size per metre of distance: one image height spans 2·tan(fov/2); widths are fractions of the image width
      const wide = Math.min(s.w * S.aspect * 2 * tanY, 0.012);
      size.set([wide, Math.min(len * 2 * tanY + wide * 0.5, 0.03), Math.atan2(dy, dx), Math.random()], i * 4);
      col.set(s.col, i * 3);
      fl.set([st.jit, 1.25 / Math.max(0.2, r.dot(fwd)), target, 0], i * 4);
    });
    flyGeo.setAttribute('aRay', new THREE.InstancedBufferAttribute(ray, 3));
    flyGeo.setAttribute('aSize', new THREE.InstancedBufferAttribute(size, 4));
    flyGeo.setAttribute('aCol', new THREE.InstancedBufferAttribute(col, 3));
    flyGeo.setAttribute('aFly', new THREE.InstancedBufferAttribute(fl, 4));
    flyGeo.instanceCount = n;
    flyMat.uniforms.uRight.value.setFromMatrixColumn(S.P.matrixWorld, 0);
    flyMat.uniforms.uUp.value.setFromMatrixColumn(S.P.matrixWorld, 1);
    fly.visible = true;
  }

  // ---- revealing strokes near the brush
  function nearest(layer, x, y) {
    let best = -1, bd = 1e9;
    for (let i = 0; i < layer.length; i++) {
      const st = layer[i];
      if (st.shown) continue;
      const d = (st.x - x) * (st.x - x) * S.aspect * S.aspect + (st.y - y) * (st.y - y) + Math.random() * 0.0015;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  function revealOne(li, x, y) {
    const L = S.layers[li];
    const i = nearest(L, x, y);
    if (i < 0) return false;
    L[i].shown = true;
    S.rib.reveal(L[i].k, S.clock);
    S.revealed[li]++;
    return true;
  }
  const STAGES = ['起稿', '铺色', '塑形', '点叶'];
  function stageName() { return S.stage === 'paint' ? STAGES[Math.min(3, S.cur === 0 ? 0 : S.cur <= 1 ? 1 : S.cur <= 2 ? 2 : 3)] : S.stage === 'seal' ? '落款' : S.stage === 'spill' ? '越出画框' : ''; }

  // the spill: strokes past the canvas edge land on the world at once
  let lastSpill = null, spillPath = [];
  function spillAt(x, y) {
    if (x > S.rect[0] && x < S.rect[2] && y > S.rect[1] && y < S.rect[3]) { spillPath = []; return; }
    spillPath.push(x, y);
    if (spillPath.length > 12) spillPath.splice(0, 2);
    if (!lastSpill || Math.hypot((x - lastSpill[0]) * S.aspect, y - lastSpill[1]) > 0.035) {
      if (spillPath.length >= 4 && S.spill.ranges.length < 480) {
        const k = S.spill.add({ pts: spillPath.slice(), w: 0.05 + Math.random() * 0.02, col: [1, 1, 1] }, [0, 0, S.clock, Math.random()]);
        S.spill.reveal(k, S.clock - 1);
        S.spillAmount++;
      }
      lastSpill = [x, y];
    }
  }

  const q2 = { pos: new THREE.Vector3(), aim: new THREE.Vector3() };
  function placeBrush(x, y, dt) {
    if (!S.P) return;
    const fwd = S.P.getWorldDirection(new THREE.Vector3());
    const r = new THREE.Vector3(x * 2 - 1, y * 2 - 1, 0.5).unproject(S.P).sub(S.P.position).normalize();
    const p = S.P.position.clone().addScaledVector(r, 1.235 / r.dot(fwd));
    const k = 1 - Math.exp(-dt * 18);
    q2.pos.lerp(p, k);
    brush.position.copy(q2.pos);
    const right = new THREE.Vector3().setFromMatrixColumn(S.P.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(S.P.matrixWorld, 1);
    const handleDir = right.multiplyScalar(0.55).addScaledVector(up, -0.6).addScaledVector(fwd, -0.55).normalize();
    brush.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), handleDir);
    // the tip carries the colour of the last stroke laid
  }

  function renderStrokes() {
    sUniforms.uClock.value = S.clock;
    const draw = (rt, mat, clear = true) => {
      strokeMesh.material = mat;
      renderer.setRenderTarget(rt);
      if (clear) { renderer.setClearColor(0x000000, 0); renderer.clear(); }
      renderer.render(strokeScene, ortho);
    };
    // charcoal on its own sheet (it stays on the canvas when the paint has gone); its ribbons come first
    let ci = 0; for (const st of S.layers[0]) { const [a, b] = S.rib.ranges[st.k]; ci += ((b - a) / 2 - 1) * 6; }
    S.rib.g.setDrawRange(0, ci);
    draw(charRT, matColor);
    S.rib.g.setDrawRange(ci, S.rib.i - ci);
    draw(paintRT, matColor);
    draw(heightRT, matHeight);
    draw(projRT, matProj);
    // spill strokes into the projector map (no clear)
    strokeMesh.geometry = S.spill.g;
    strokeMesh.material = matSpill;
    renderer.setRenderTarget(projRT);
    const ac = renderer.autoClear; renderer.autoClear = false;
    renderer.render(strokeScene, ortho);
    renderer.autoClear = ac;
    strokeMesh.geometry = S.rib.g;
    S.rib.g.setDrawRange(0, S.rib.i);
    renderer.setRenderTarget(null);
  }

  const api = {
    group, fly, state: S, canvasMesh,
    rts: () => ({ paintRT, charRT, heightRT, projRT, depthRT }),
    setup, stageName,
    get progress() { const tot = S.layers.reduce((a, l) => a + l.length, 0) || 1; return S.revealed.reduce((a, b) => a + b, 0) / tot; },
    /** pointer in the painter's screen (0..1, y up), down or not */
    pointer(x, y, down) {
      if (S.pointer && down && S.down) S.ink += Math.hypot((x - S.pointer[0]) * S.aspect, y - S.pointer[1]);
      S.pointer = [x, y]; S.down = down;
      if (down) S.idle = 0;
    },
    /** hold to paint (keyboard): the brush wanders by itself */
    hold(on) { S.auto = on; if (on) S.idle = 0; },
    setLight(l6, exposure) { L6.value.copy(l6); expo.value = exposure; },
    setFront(t) { front.value = t; },
    /** the stage machine; returns events: 'stage', 'sealed', 'spillReady' */
    update(dt, clock) {
      S.clock = clock;
      S.stageT += dt;
      S.idle += dt;
      let ev = null;
      const inCanvas = S.pointer && S.pointer[0] > S.rect[0] && S.pointer[0] < S.rect[2] && S.pointer[1] > S.rect[1] && S.pointer[1] < S.rect[3];
      let bx = S.pointer ? S.pointer[0] : 0.5, by = S.pointer ? S.pointer[1] : 0.5;
      const autoOn = S.auto || S.idle > 5;
      if (autoOn && (S.stage === 'paint' || S.stage === 'spill')) {
        // the brush wanders on its own (a slow figure across the canvas, past its edges in the spill)
        const t = clock * (S.auto ? 0.9 : 0.55);
        const sp = S.stage === 'spill' ? 1.25 : 0.9;
        bx = 0.5 + (S.rect[2] - S.rect[0]) * 0.5 * sp * Math.sin(t * 1.3) * Math.cos(t * 0.37);
        by = 0.5 + (S.rect[3] - S.rect[1]) * 0.5 * sp * Math.sin(t * 0.9 + 1.1);
      }
      if (S.stage === 'paint') {
        const L = S.layers[S.cur];
        const n = L.length;
        const rate = n / (S.cur === 0 ? 1.3 : 2.4);                       // strokes per unit of brush travel (screen heights)
        let k = 0;
        if (S.down && inCanvas) k += S.ink * rate + dt * n / 14;            // dragging paints; holding still paints slowly
        if (autoOn) k += dt * n / (S.auto ? 5 : 9);
        S.ink = 0;
        S.acc = (S.acc || 0) + k;
        while (S.acc >= 1) { S.acc -= 1; if (!revealOne(S.cur, bx, by)) break; }
        if (S.revealed[S.cur] / Math.max(1, n) > 0.86) {
          // finish the rest of this stage briskly, then the next
          S.sweep = (S.sweep || 0) + dt * n / 0.9;
          while (S.sweep >= 1) { S.sweep -= 1; if (!revealOne(S.cur, 0.5 + (Math.random() - 0.5) * 0.6, 0.5 + (Math.random() - 0.5) * 0.7)) break; }
          if (S.revealed[S.cur] >= n) {
            S.cur++; S.sweep = 0; S.acc = 0; ev = 'stage';
            if (S.cur >= S.layers.length) { S.stage = 'seal'; S.stageT = 0; }
          }
        }
      } else if (S.stage === 'seal') {
        S.seal.value = Math.min(1, S.stageT / 1.4);
        if (S.stageT > 1.8) { S.stage = 'spill'; S.stageT = 0; ev = 'spillReady'; }
      } else if (S.stage === 'spill') {
        if ((S.down || autoOn) && !inCanvas) spillAt(bx, by);
        else if (autoOn) spillAt(bx, by);
      }
      if (S.stage === 'paint' || S.stage === 'seal' || S.stage === 'spill') { placeBrush(bx, by, dt); renderStrokes(); }
      brush.visible = S.stage === 'paint' || S.stage === 'spill' || S.stage === 'seal';
      return ev;
    },
    /** the paint leaves the canvas at uProjStart (set by the director) */
    depart() { S.stage = 'depart'; brush.visible = false; },
    get spillAmount() { return S.spillAmount; },
    reset() { group.visible = false; fly.visible = false; S.stage = 'idle'; canvasMat.uniforms.uEmpty.value = 0; },
    /** the paint has gone into the world: the canvas keeps its charcoal and its seal */
    empty() { canvasMat.uniforms.uEmpty.value = 1; fly.visible = false; },
  };
  return api;
}

// a minimal full-screen pass for one-off conversions
class FullQuad {
  constructor() {
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.scene = new THREE.Scene(); this.scene.add(this.mesh);
  }
  draw(renderer, target, frag, uniforms) {
    this.mesh.material = new THREE.ShaderMaterial({ uniforms, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: frag, depthTest: false, depthWrite: false });
    renderer.setRenderTarget(target); renderer.render(this.scene, this.cam); renderer.setRenderTarget(null);
    this.mesh.material.dispose();
  }
}
