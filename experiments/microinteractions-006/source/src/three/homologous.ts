// @ts-nocheck — three.js scene code ported from JavaScript; typed at its public edge (HomologousStage).
/**
 * HAIZ 006 · 同源显影 (homologous rendering), inherited from Experiment 003.
 *
 * This is Experiment 003's engine (haiz-microinteractions-lab-003/src/engine/homologous-renderer.js,
 * by Gemini), ported into 006 rather than reinvented. ONE real asset, three passes, one camera:
 *   pass 1  real materials and light              (rtPBR)
 *   pass 2  view normals + material id + depth    (rtND)  — the leaves keep their clump normals
 *   pass 3  composite: line drawing (0) ↔ paper clay (0.5) ↔ real (1), pixel-locked
 *
 * What 006 adds, without changing what 003 proved:
 *   - it runs on 005's one clock (slow-motion, pause, frame-step and idle sleep apply to it too)
 *   - its paper, ink and accent are read from the page's tokens, so the canvas is the page's paper
 *   - INK-IN: before a drawing exists, its lines are drawn outward from a point (the place the
 *     user's gesture came from) — paper → line drawing
 *   - DEVELOP: a second wavefront carries the drawing to another reveal level from a point,
 *     the way a photograph develops from the centre of the tray
 *   - per-object reveal: a hovered building can be real while the campus around it stays ink
 *   - an inverted loupe (a botanist's lens that shows the structure inside a real tree)
 *   - picking by bounding boxes, world → screen projection, and a hook for live animation
 */
import * as THREE from "three";
import { clock, spring, stepS, SP, clamp } from "../kernel/motion";

const QUAD_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

/** View-space normal in RGB, material id / highlight flag in A (003's encoding). */
export function makeNormalIdMaterial({ matId = 0.25, highlighted = false, map = null, alphaTest = 0, doubleSide = true } = {}) {
  const packedA = highlighted ? 0.99 : clamp(0.12 + matId * 0.74, 0.12, 0.86);
  return new THREE.ShaderMaterial({
    side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    uniforms: {
      uMatA: { value: packedA },
      uMap: { value: map },
      uUseAlpha: { value: map && alphaTest > 0 ? 1.0 : 0.0 },
      uAlphaTest: { value: alphaTest },
    },
    vertexShader: /* glsl */ `
      varying vec3 vVN;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 n = normal;
        #ifdef USE_INSTANCING
          n = normalize(mat3(instanceMatrix) * n);
          vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        #else
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
        #endif
        vVN = normalize(normalMatrix * n);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uMatA; uniform sampler2D uMap; uniform float uUseAlpha; uniform float uAlphaTest;
      varying vec3 vVN; varying vec2 vUv;
      void main() {
        if (uUseAlpha > 0.5) { if (texture2D(uMap, vUv).a < uAlphaTest) discard; }
        vec3 n = normalize(vVN);
        if (!gl_FrontFacing) n = -n;
        gl_FragColor = vec4(n * 0.5 + 0.5, uMatA);
      }
    `,
  });
}

const HOMOLOGOUS_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D tPBR; uniform sampler2D tND; uniform sampler2D tDepth;
  uniform vec2 uTexel; uniform vec2 uRes;
  uniform float uNear; uniform float uFar; uniform float uOrtho;
  uniform int uMode;                 // 0 dial · 2 loupe
  uniform float uReveal;             // global dial [0..1]
  uniform float uReveal0;            // the level the DEVELOP wave starts from
  uniform vec2 uDevC; uniform float uDevR;   // develop wavefront (uv centre, radius in screen heights)
  uniform vec2 uInkC; uniform float uInkR;   // ink-in wavefront
  uniform vec2 uLoupe; uniform float uLoupeR; uniform float uLoupeOn; uniform float uLoupeInvert;
  uniform float uHiReveal;           // highlighted objects reveal to at least this
  uniform vec3 uPaper; uniform vec3 uInk; uniform vec3 uInkDim;
  uniform vec3 uClayLit; uniform vec3 uClayShade; uniform vec3 uAccent;
  uniform float uIsDark;
  uniform float uCreaseLo; uniform float uCreaseHi; uniform float uDepthScale; uniform float uRealInk;
  uniform float uGridShow; uniform float uRealPaper;
  varying vec2 vUv;

  float linearZ(float d) {
    if (uOrtho > 0.5) return uNear + d * (uFar - uNear);
    return (uNear * uFar) / max(1e-5, (uFar - d * (uFar - uNear)));
  }
  vec3 khronosNeutral(vec3 c) {
    const float sc = 0.76; const float ds = 0.14;
    float x = min(c.r, min(c.g, c.b));
    float off = x < 0.08 ? x - 6.25 * x * x : 0.04;
    c = max(c - off, 0.0);
    float pk = max(c.r, max(c.g, c.b));
    if (pk < sc) return c;
    float d = 1.0 - sc;
    float np = 1.0 - d * d / (pk + d - sc);
    c *= np / pk;
    float g = 1.0 - 1.0 / (ds * (pk - np) + 1.0);
    return mix(c, vec3(np), g);
  }
  vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(max(c, 0.0), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
  float hash12(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    vec4 ndC = texture2D(tND, vUv);
    float dC = texture2D(tDepth, vUv).x;
    bool isObj = ndC.a > 0.04;
    bool isHi = ndC.a > 0.94;
    vec2 o = uTexel * 1.18;
    vec4 ndL = texture2D(tND, vUv + vec2(-o.x, 0.0)); vec4 ndR = texture2D(tND, vUv + vec2(o.x, 0.0));
    vec4 ndU = texture2D(tND, vUv + vec2(0.0, o.y));  vec4 ndD = texture2D(tND, vUv + vec2(0.0, -o.y));
    vec4 ndUL = texture2D(tND, vUv + vec2(-o.x, o.y)); vec4 ndUR = texture2D(tND, vUv + vec2(o.x, o.y));
    vec4 ndDL = texture2D(tND, vUv + vec2(-o.x, -o.y)); vec4 ndDR = texture2D(tND, vUv + vec2(o.x, -o.y));
    float zC = linearZ(dC);
    float zL = linearZ(texture2D(tDepth, vUv + vec2(-o.x, 0.0)).x); float zR = linearZ(texture2D(tDepth, vUv + vec2(o.x, 0.0)).x);
    float zU = linearZ(texture2D(tDepth, vUv + vec2(0.0, o.y)).x);  float zD = linearZ(texture2D(tDepth, vUv + vec2(0.0, -o.y)).x);

    float aMax = max(ndC.a, max(max(ndL.a, ndR.a), max(ndU.a, ndD.a)));
    float aMin = min(ndC.a, min(min(ndL.a, ndR.a), min(ndU.a, ndD.a)));
    float bgSil = smoothstep(0.02, 0.08, step(0.04, aMax) - step(0.04, aMin));
    float zRef = max(1.0, min(zC, min(min(zL, zR), min(zU, zD))));
    float zDiff = max(max(abs(zC - zL), abs(zC - zR)), max(abs(zC - zU), abs(zC - zD)));
    float zLap = abs(zL + zR - 2.0 * zC) + abs(zU + zD - 2.0 * zC);
    float normDepthJump = (uOrtho > 0.5) ? (zDiff / (uFar - uNear) * 140.0) : (zDiff / zRef * 14.0);
    float normLap = (uOrtho > 0.5) ? (zLap / (uFar - uNear) * 90.0) : (zLap / zRef * 9.0);
    float depthSil = smoothstep(0.45 * uDepthScale, 1.35 * uDepthScale, max(normDepthJump, normLap)) * step(0.04, aMax);
    float silEdge = max(bgSil, depthSil);

    vec3 nC = normalize(ndC.rgb * 2.0 - 1.0);
    float nJump = 0.0;
    if (isObj) {
      float d1 = ndL.a > 0.04 ? (1.0 - dot(nC, normalize(ndL.rgb * 2.0 - 1.0))) : 0.0;
      float d2 = ndR.a > 0.04 ? (1.0 - dot(nC, normalize(ndR.rgb * 2.0 - 1.0))) : 0.0;
      float d3 = ndU.a > 0.04 ? (1.0 - dot(nC, normalize(ndU.rgb * 2.0 - 1.0))) : 0.0;
      float d4 = ndD.a > 0.04 ? (1.0 - dot(nC, normalize(ndD.rgb * 2.0 - 1.0))) : 0.0;
      float d5 = ndUL.a > 0.04 ? (1.0 - dot(nC, normalize(ndUL.rgb * 2.0 - 1.0))) : 0.0;
      float d6 = ndDR.a > 0.04 ? (1.0 - dot(nC, normalize(ndDR.rgb * 2.0 - 1.0))) : 0.0;
      float d7 = ndUR.a > 0.04 ? (1.0 - dot(nC, normalize(ndUR.rgb * 2.0 - 1.0))) : 0.0;
      float d8 = ndDL.a > 0.04 ? (1.0 - dot(nC, normalize(ndDL.rgb * 2.0 - 1.0))) : 0.0;
      nJump = max(max(max(d1, d2), max(d3, d4)), 0.72 * max(max(d5, d6), max(d7, d8)));
    }
    float creaseEdge = smoothstep(uCreaseLo, uCreaseHi, nJump);
    float matJump = 0.0;
    if (isObj && aMin > 0.04) matJump = max(max(abs(ndC.a - ndL.a), abs(ndC.a - ndR.a)), max(abs(ndC.a - ndU.a), abs(ndC.a - ndD.a)));
    float matEdge = smoothstep(0.035, 0.075, matJump);
    float hiNear = aMax > 0.94 ? 1.0 : 0.0;
    bool isFoliage = abs(ndC.a - 0.89) < 0.025;
    // inside the crown (foliage on every side) only the pads' own outlines are drawn: no leaf-to-leaf
    // depth chatter, so the line drawing reads as tiers of leaf clouds rather than an engraving
    bool deepLeaf = isFoliage && abs(aMin - 0.89) < 0.03 && abs(aMax - 0.89) < 0.03;
    if (deepLeaf) {
      depthSil *= smoothstep(2.2, 4.0, max(normDepthJump, normLap) / max(0.2, uDepthScale)) * 0.7;
      silEdge = max(bgSil, depthSil);
      creaseEdge = smoothstep(0.55, 0.95, nJump) * 0.8;
    }
    float silAlpha = isFoliage ? 0.56 : (uIsDark > 0.5 ? 0.84 : 0.92);
    float crAlpha = isFoliage ? 0.22 : 0.6;
    vec3 primaryInk = mix(uInk, uAccent, hiNear);
    vec3 detailInk = mix(uInkDim, uAccent, hiNear * 0.88);

    vec3 paperBg = uPaper;
    if (!isObj && uGridShow > 0.5) {
      vec2 g = abs(fract(gl_FragCoord.xy / 44.0 - 0.5) - 0.5) / (1.0 / 44.0);
      float gLine = 1.0 - smoothstep(0.0, 1.0, min(g.x, g.y));
      paperBg = mix(uPaper, uInkDim, gLine * (uIsDark > 0.5 ? 0.07 : 0.045));
    }

    // A · line drawing: opaque paper faces (hidden lines stay hidden), bright silhouette, dim creases
    vec3 blueprintCol = paperBg;
    if (isObj) {
      float planeLift = clamp(nC.y * 0.5 + 0.5, 0.0, 1.0);
      blueprintCol = mix(uPaper, uPaper * (uIsDark > 0.5 ? 1.12 : 0.986), (1.0 - planeLift) * 0.65);
    }
    blueprintCol = mix(blueprintCol, detailInk, clamp(max(creaseEdge * crAlpha, matEdge * 0.42), 0.0, 1.0));
    blueprintCol = mix(blueprintCol, primaryInk, silEdge * silAlpha);

    // B · paper clay
    vec4 pbrRaw = texture2D(tPBR, vUv);
    vec3 pbrTone = toSRGB(clamp(khronosNeutral(pbrRaw.rgb * 1.04), 0.0, 1.0));
    float pbrLum = dot(pbrTone, vec3(0.299, 0.587, 0.114));
    vec3 keyDir = normalize(vec3(0.42, 0.72, 0.55));
    float ndl = isObj ? clamp(dot(nC, keyDir) * 0.55 + 0.45, 0.0, 1.0) : 1.0;
    float clayLight = isFoliage ? ndl * 0.9 + 0.12 : mix(ndl, clamp(pbrLum * 1.08 + 0.08, 0.0, 1.0), 0.42);
    vec3 clayCol = isObj ? mix(uClayShade, uClayLit, smoothstep(0.12, 0.92, clayLight)) : paperBg;
    if (isHi) clayCol = mix(clayCol, uAccent, uIsDark > 0.5 ? 0.24 : 0.14);
    if (isObj && ndl < 0.36) {
      float hWave = smoothstep(0.68, 0.92, abs(fract((gl_FragCoord.x + gl_FragCoord.y) / 6.5) - 0.5) * 2.0);
      clayCol = mix(clayCol, uInkDim, hWave * smoothstep(0.36, 0.16, ndl) * 0.14);
    }
    clayCol = mix(clayCol, detailInk, clamp(max(creaseEdge * 0.48, matEdge * 0.32), 0.0, 1.0));
    clayCol = mix(clayCol, primaryInk, silEdge * 0.82);

    // C · real. On a page the ground stays paper; the light's shadow on it (pass 1 alpha) is kept.
    vec3 realBg = uRealPaper > 0.5 ? paperBg : (uIsDark > 0.5
      ? mix(vec3(0.062, 0.072, 0.092), vec3(0.11, 0.128, 0.16), smoothstep(0.0, 1.0, vUv.y))
      : mix(vec3(0.925, 0.935, 0.945), vec3(0.845, 0.892, 0.935), smoothstep(0.15, 0.95, vUv.y)));
    vec3 realCol = (isObj && pbrRaw.a > 0.5) ? pbrTone : realBg;   // the line pass may be fuller than the colour pass (inflated crown)
    if (isHi) realCol = mix(realCol, uAccent, max(silEdge * 0.7, creaseEdge * 0.3));
    else if (uRealInk > 0.001) realCol = mix(realCol, uInk, silEdge * uRealInk);

    float asp = uRes.x / max(1.0, uRes.y);
    vec2 P = vUv * vec2(asp, 1.0);

    // the develop wave carries reveal0 → reveal outward from its centre
    float dDev = length(P - uDevC * vec2(asp, 1.0));
    float devK = 1.0 - smoothstep(uDevR - 0.16, uDevR, dDev);
    float t = mix(uReveal0, uReveal, devK);
    float guide = 0.0;
    if (uLoupeOn > 0.5) {
      float dist = length(P - uLoupe * vec2(asp, 1.0));
      float inL = 1.0 - smoothstep(uLoupeR * 0.7, uLoupeR, dist);
      t = uLoupeInvert > 0.5 ? mix(t, 0.0, inL) : mix(t, 1.0, inL);
      guide = (1.0 - smoothstep(0.7, 1.7, abs(dist - uLoupeR) * uRes.y)) * 0.55;
    }
    if (isHi) t = max(t, uHiReveal);

    vec3 outCol = t <= 0.5
      ? mix(blueprintCol, clayCol, smoothstep(0.0, 1.0, t * 2.0))
      : mix(clayCol, realCol, smoothstep(0.0, 1.0, (t - 0.5) * 2.0));
    if (guide > 0.01) outCol = mix(outCol, uAccent, guide);

    // the ink-in wave: nothing but paper ahead of it, a wet line at its front, the drawing behind
    float dInk = length(P - uInkC * vec2(asp, 1.0));
    float inkK = 1.0 - smoothstep(uInkR - 0.09, uInkR, dInk);
    float front = smoothstep(uInkR - 0.09, uInkR - 0.02, dInk) * inkK;
    outCol = mix(paperBg, outCol, inkK);
    outCol = mix(outCol, uAccent, front * silEdge * 0.8);

    outCol += (hash12(gl_FragCoord.xy) - 0.5) * 0.005;
    gl_FragColor = vec4(clamp(outCol, 0.0, 1.0), 1.0);
  }
`;

const cssColor = (name: string, fallback: string) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return new THREE.Color(v || fallback);
};

export type View = { az?: number; el?: number; dist?: number; span?: number; tx?: number; ty?: number; tz?: number; fov?: number };
export type HomologousStage = ReturnType<typeof createHomologousStage>;

export function createHomologousStage({
  host,
  reveal = 0,
  ortho = false,
  creaseLo = 0.22,
  creaseHi = 0.48,
  depthScale = 1.0,
  realInk = 0.04,
  gridShow = false,
  realPaper = true,
  view = { az: 45, el: 30, dist: 160, span: 120, tx: 0, ty: 0, tz: 0, fov: 26 } as View,
  orbit = { az: true, el: true, zoom: true, elMin: 6, elMax: 84 },
  maxDpr = 1.75,
  onFrame = null as null | ((dt: number) => boolean | void),
}) {
  host.innerHTML = "";
  const canvas = document.createElement("canvas");
  canvas.className = "homo-canvas";
  host.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", alpha: false, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;

  const scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight(0xf6f8ff, 0xddd4c6, 1.38);
  const sun = new THREE.DirectionalLight(0xfff4e2, 2.05);
  sun.position.set(110, 165, 115);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  const fill = new THREE.DirectionalLight(0xcbe0f7, 0.65);
  fill.position.set(-120, 65, -90);
  scene.add(hemi, sun, fill);

  let isOrtho = ortho;
  const perspCam = new THREE.PerspectiveCamera(view.fov ?? 26, 1.25, 0.5, 2200);
  const orthoCam = new THREE.OrthographicCamera(-60, 60, 48, -48, -600, 2200);
  const cam = () => (isOrtho ? orthoCam : perspCam);

  const makeRT = (w, h, withDepth) => {
    const opts: any = { minFilter: withDepth ? THREE.NearestFilter : THREE.LinearFilter, magFilter: withDepth ? THREE.NearestFilter : THREE.LinearFilter, format: THREE.RGBAFormat, type: THREE.UnsignedByteType };
    if (withDepth) { opts.depthTexture = new THREE.DepthTexture(w, h); opts.depthTexture.minFilter = THREE.NearestFilter; opts.depthTexture.magFilter = THREE.NearestFilter; }
    return new THREE.WebGLRenderTarget(w, h, opts);
  };
  let rtPBR = makeRT(4, 4, false);
  let rtND = makeRT(4, 4, true);

  const U = {
    tPBR: { value: rtPBR.texture }, tND: { value: rtND.texture }, tDepth: { value: rtND.depthTexture },
    uTexel: { value: new THREE.Vector2(1 / 800, 1 / 600) }, uRes: { value: new THREE.Vector2(800, 600) },
    uNear: { value: 0.5 }, uFar: { value: 2200 }, uOrtho: { value: isOrtho ? 1 : 0 },
    uMode: { value: 0 }, uReveal: { value: reveal }, uReveal0: { value: reveal },
    uDevC: { value: new THREE.Vector2(0.5, 0.5) }, uDevR: { value: 9 },
    uInkC: { value: new THREE.Vector2(0.5, 0.5) }, uInkR: { value: 9 },
    uLoupe: { value: new THREE.Vector2(0.5, 0.5) }, uLoupeR: { value: 0.2 }, uLoupeOn: { value: 0 }, uLoupeInvert: { value: 0 },
    uHiReveal: { value: 0 },
    uPaper: { value: new THREE.Color(0xf4f2ec) }, uInk: { value: new THREE.Color(0x1b1f1c) }, uInkDim: { value: new THREE.Color(0x6b736d) },
    uClayLit: { value: new THREE.Color(0xf5f2eb) }, uClayShade: { value: new THREE.Color(0xd2ccc0) }, uAccent: { value: new THREE.Color(0x2f7a5b) },
    uIsDark: { value: 0 }, uCreaseLo: { value: creaseLo }, uCreaseHi: { value: creaseHi }, uDepthScale: { value: depthScale },
    uRealInk: { value: realInk }, uGridShow: { value: gridShow ? 1 : 0 }, uRealPaper: { value: realPaper ? 1 : 0 },
  };
  const compMat = new THREE.ShaderMaterial({ vertexShader: QUAD_VERT, fragmentShader: HOMOLOGOUS_FRAG, depthTest: false, depthWrite: false, uniforms: U });
  const qScene = new THREE.Scene();
  const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  qScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), compMat));

  // springs on 005's clock
  const CAM = { k: 70, c: 16.5 };
  const S = {
    az: spring(view.az ?? 45, CAM), el: spring(view.el ?? 30, CAM), dist: spring(view.dist ?? 160, CAM), span: spring(view.span ?? 120, CAM),
    tx: spring(view.tx ?? 0, CAM), ty: spring(view.ty ?? 0, CAM), tz: spring(view.tz ?? 0, CAM), fov: spring(view.fov ?? 26, CAM),
    rev: spring(reveal, { k: 60, c: 15.5 }), hi: spring(0, SP.soft),
    lx: spring(0.5, SP.follow), ly: spring(0.5, SP.follow), lr: spring(0, SP.ui),
    vaz: 0,
  };
  let ink = { on: false, t0: 0, dur: 1, c: [0.5, 0.5] }, dev = { on: false, t0: 0, dur: 1, c: [0.5, 0.5] };
  let width = 1, height = 1, dpr = 1, disposed = false, dirty = true, live = false, visible = true, clockT = 0;

  const entries: any[] = [];
  const matIds = new Map<string, number>();
  let hiKey: string | null = null;
  let hiSet: Set<any> | null = null;

  function registerObject(root, { customNd = null } = {}) {
    root.traverse((obj) => {
      if (!obj.isMesh) return;
      const pbr = obj.material;
      const name = Array.isArray(pbr) ? pbr[0]?.name || "multi" : pbr?.name || obj.userData.matKey || "solid";
      if (!matIds.has(name)) matIds.set(name, (matIds.size + 1) / 16);
      const matId = matIds.get(name);
      let nd = customNd ? customNd(obj, name, matId) : null;
      if (!nd) {
        const single = Array.isArray(pbr) ? pbr[0] : pbr;
        nd = makeNormalIdMaterial({ matId, map: single?.alphaTest > 0 ? single.map : null, alphaTest: single?.alphaTest || 0 });
      }
      const baseA = nd?.uniforms?.uMatA?.value ?? clamp(0.12 + matId * 0.74, 0.12, 0.86);
      obj.userData.__homo = { pbr, nd, key: name, baseA };
      entries.push(obj);
    });
    renderer.shadowMap.needsUpdate = true;
    wake();
  }
  function applyHighlight() {
    for (const o of entries) {
      const h = o.userData.__homo;
      if (!h?.nd?.uniforms?.uMatA) continue;
      const on = (hiKey && h.key === hiKey) || (hiSet && hiSet.has(o));
      h.nd.uniforms.uMatA.value = on ? 0.99 : h.baseA;
    }
    wake();
  }

  function syncTheme() {
    const t = document.documentElement.dataset.theme;
    const dark = t === "dark" || (!t && matchMedia("(prefers-color-scheme: dark)").matches);
    U.uIsDark.value = dark ? 1 : 0;
    U.uPaper.value.copy(cssColor("--paper", dark ? "#0f1210" : "#f4f2ec"));
    U.uInk.value.copy(cssColor("--ink", dark ? "#e7eae4" : "#1b1f1c"));
    U.uInkDim.value.copy(cssColor("--ink-3", dark ? "#8a948d" : "#6b736d"));
    U.uAccent.value.copy(cssColor("--lit", dark ? "#5fc497" : "#2f7a5b"));
    if (dark) { U.uClayLit.value.set(0x2a302c); U.uClayShade.value.set(0x151917); hemi.intensity = 0.9; sun.intensity = 1.5; sun.color.set(0xdfe8ff); }
    else { U.uClayLit.value.set(0xf6f3ec); U.uClayShade.value.set(0xd4cec2); hemi.intensity = 1.42; sun.intensity = 2.08; sun.color.set(0xfff4e2); }
    // the composite writes straight to the screen: keep its palette in sRGB, exactly the page's tokens
    for (const k of ["uPaper", "uInk", "uInkDim", "uAccent", "uClayLit", "uClayShade"]) U[k].value.convertLinearToSRGB();
    wake();
  }

  function resize() {
    const w = Math.max(160, Math.round(host.clientWidth || 640));
    const h = Math.max(160, Math.round(host.clientHeight || 480));
    const nd = Math.min(window.devicePixelRatio || 1, maxDpr);
    if (w === width && h === height && nd === dpr) return;
    width = w; height = h; dpr = nd;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    const rw = Math.max(4, Math.round(w * dpr)), rh = Math.max(4, Math.round(h * dpr));
    rtPBR.dispose(); rtND.dispose();
    rtPBR = makeRT(rw, rh, false); rtND = makeRT(rw, rh, true);
    U.tPBR.value = rtPBR.texture; U.tND.value = rtND.texture; U.tDepth.value = rtND.depthTexture;
    U.uTexel.value.set(1 / rw, 1 / rh); U.uRes.value.set(rw, rh);
    wake();
  }

  function updateCamera() {
    const aspect = width / Math.max(1, height);
    const azR = THREE.MathUtils.degToRad(S.az.x), elR = THREE.MathUtils.degToRad(clamp(S.el.x, 2, 88));
    const dist = Math.max(2, S.dist.x);
    const cx = S.tx.x + dist * Math.cos(elR) * Math.sin(azR), cy = S.ty.x + dist * Math.sin(elR), cz = S.tz.x + dist * Math.cos(elR) * Math.cos(azR);
    if (isOrtho) {
      const hh = Math.max(1.2, S.span.x * 0.5), hw = hh * aspect;
      Object.assign(orthoCam, { left: -hw, right: hw, top: hh, bottom: -hh, near: -Math.max(300, dist * 3), far: Math.max(600, dist * 6) });
      orthoCam.position.set(cx, cy, cz); orthoCam.lookAt(S.tx.x, S.ty.x, S.tz.x); orthoCam.updateProjectionMatrix();
      U.uNear.value = orthoCam.near; U.uFar.value = orthoCam.far; U.uOrtho.value = 1;
    } else {
      perspCam.aspect = aspect; perspCam.fov = S.fov.x;
      perspCam.near = Math.max(0.15, dist * 0.015); perspCam.far = Math.max(800, dist * 12);
      perspCam.position.set(cx, cy, cz); perspCam.lookAt(S.tx.x, S.ty.x, S.tz.x); perspCam.updateProjectionMatrix();
      U.uNear.value = perspCam.near; U.uFar.value = perspCam.far; U.uOrtho.value = 0;
    }
  }

  function render() {
    updateCamera();
    const c = cam();
    U.uReveal.value = clamp(S.rev.x, 0, 1);
    U.uHiReveal.value = clamp(S.hi.x, 0, 1);
    U.uLoupe.value.set(S.lx.x, S.ly.x);
    U.uLoupeR.value = Math.max(0, S.lr.x);
    U.uLoupeOn.value = S.lr.x > 0.002 ? 1 : 0;
    for (const m of entries) m.material = m.userData.__homo.pbr;
    renderer.setRenderTarget(rtPBR); renderer.setClearColor(0x000000, 0); renderer.clear(true, true, false); renderer.render(scene, c);
    for (const m of entries) m.material = m.userData.__homo.nd;
    renderer.setRenderTarget(rtND); renderer.setClearColor(0x000000, 0); renderer.clear(true, true, false); renderer.render(scene, c);
    for (const m of entries) m.material = m.userData.__homo.pbr;
    renderer.setRenderTarget(null); renderer.render(qScene, qCam);
    dirty = false;
  }

  const ease = (x: number) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  const tick = (dt: number, now: number) => {
    if (disposed) return false;
    clockT += dt;
    let moving = false;
    if (!drag && Math.abs(S.vaz) > 0.01) { S.az.t += S.vaz * dt; S.vaz *= Math.exp(-dt * 3.2); moving = true; }
    for (const k of ["az", "el", "dist", "span", "tx", "ty", "tz", "fov", "rev", "hi", "lx", "ly", "lr"]) if (stepS(S[k], dt)) moving = true;
    // wavefronts run on the clock's (scalable) time
    for (const [w, R] of [[ink, U.uInkR], [dev, U.uDevR]] as const) {
      if (!w.on) continue;
      w.t0 += dt;
      const k = ease(w.t0 / w.dur);
      R.value = k * 2.6;
      if (k >= 1) { w.on = false; R.value = 9; if (w === dev) U.uReveal0.value = U.uReveal.value; }
      moving = true;
    }
    if (onFrame && onFrame(dt)) moving = true;
    if (!visible) return moving && false;
    if (moving || dirty || live) render();
    return moving || live;
  };
  const off = clock.add(tick);
  function wake() { if (disposed) return; dirty = true; clock.wake(); }

  // ---- orbit, zoom, loupe ----
  let drag = false, lastX = 0, lastY = 0, moved = 0;
  canvas.addEventListener("pointerdown", (e) => {
    drag = true; moved = 0; lastX = e.clientX; lastY = e.clientY; S.vaz = 0;
    canvas.setPointerCapture?.(e.pointerId); canvas.style.cursor = "grabbing";
  });
  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    S.lx.t = clamp((e.clientX - r.left) / r.width, 0, 1);
    S.ly.t = clamp(1 - (e.clientY - r.top) / r.height, 0, 1);
    if (U.uLoupeOn.value || S.lr.t > 0) wake();
    if (!drag) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    if (orbit.az) { S.az.t -= dx * 0.38; S.vaz = -dx * 0.38 / 0.016 * 0.25; }
    if (orbit.el) S.el.t = clamp(S.el.t + dy * 0.3, orbit.elMin, orbit.elMax);
    wake();
  });
  const end = () => { drag = false; canvas.style.cursor = ""; };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  if (orbit.zoom) canvas.addEventListener("wheel", (e) => {
    if (!e.ctrlKey && !e.metaKey && !orbit.freeWheel) return; // plain wheel scrolls the page
    e.preventDefault();
    const f = e.deltaY > 0 ? 1.08 : 0.92;
    S.span.t = clamp(S.span.t * f, 4, 520); S.dist.t = clamp(S.dist.t * f, 6, 900);
    wake();
  }, { passive: false });

  const ro = new ResizeObserver(() => resize());
  ro.observe(host);
  const mo = new MutationObserver(() => syncTheme());
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake(); });
  io.observe(host);
  syncTheme();
  resize();

  const ray = new THREE.Raycaster();
  const v2 = new THREE.Vector2();
  const v3 = new THREE.Vector3();

  return {
    scene, renderer, sun, hemi, fill, canvas, U,
    get camera() { return cam(); },
    get dragged() { return moved > 6; },
    registerObject, wake,
    setLive(on: boolean) { live = !!on; if (live) wake(); },
    setReveal(v: number, immediate = false) { S.rev.t = clamp(v, 0, 1); if (immediate) { S.rev.x = S.rev.t; S.rev.v = 0; U.uReveal0.value = S.rev.t; } wake(); },
    /** carry the drawing to `v` with a wavefront from uv (0..1, origin bottom-left) */
    develop(v: number, uv = [0.5, 0.5], dur = 1.25) {
      U.uReveal0.value = clamp(S.rev.x, 0, 1);
      S.rev.x = S.rev.t = clamp(v, 0, 1); S.rev.v = 0;
      dev = { on: true, t0: 0, dur, c: uv }; U.uDevC.value.set(uv[0], uv[1]); U.uDevR.value = 0;
      wake();
    },
    /** draw the lines outward from uv; paper before the front */
    inkIn(uv = [0.5, 0.5], dur = 1.1) { ink = { on: true, t0: 0, dur, c: uv }; U.uInkC.value.set(uv[0], uv[1]); U.uInkR.value = 0; wake(); },
    get reveal() { return S.rev.x; },
    setLoupe(r: number, invert = false) { S.lr.t = r; U.uLoupeInvert.value = invert ? 1 : 0; wake(); },
    setHighlightKey(k: string | null) { hiKey = k; applyHighlight(); },
    setHighlightObjects(list: any[] | null, reveal = 0) {
      hiSet = null;
      if (list && list.length) { hiSet = new Set(); for (const r of list) r.traverse((o) => o.isMesh && hiSet.add(o)); }
      S.hi.t = list && list.length ? reveal : 0;
      applyHighlight();
    },
    setOrtho(f: boolean) { isOrtho = !!f; wake(); },
    setView(v: View, immediate = false) {
      for (const k of ["az", "el", "dist", "span", "tx", "ty", "tz", "fov"]) if (v[k] !== undefined) { S[k].t = v[k]; if (immediate) { S[k].x = v[k]; S[k].v = 0; } }
      wake();
    },
    getView() { return { az: S.az.x, el: S.el.x, dist: S.dist.x, span: S.span.x, tx: S.tx.x, ty: S.ty.x, tz: S.tz.x }; },
    setTuning({ creaseLo: a, creaseHi: b, depthScale: c, realInk: d, gridShow: g }: any) {
      if (a !== undefined) U.uCreaseLo.value = a; if (b !== undefined) U.uCreaseHi.value = b;
      if (c !== undefined) U.uDepthScale.value = c; if (d !== undefined) U.uRealInk.value = d; if (g !== undefined) U.uGridShow.value = g ? 1 : 0;
      wake();
    },
    /** nearest of `boxes` ({box: Box3, id}) under a client point */
    pick(clientX: number, clientY: number, boxes: { box: THREE.Box3; id: string }[]) {
      const r = canvas.getBoundingClientRect();
      v2.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      updateCamera();
      ray.setFromCamera(v2, cam());
      let best: string | null = null, bd = Infinity;
      for (const b of boxes) { const hit = ray.ray.intersectBox(b.box, v3); if (hit) { const d = hit.distanceTo(ray.ray.origin); if (d < bd) { bd = d; best = b.id; } } }
      return best;
    },
    rayAt(clientX: number, clientY: number) {
      const r = canvas.getBoundingClientRect();
      v2.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      updateCamera(); ray.setFromCamera(v2, cam());
      return ray.ray;
    },
    /** world point → px within the canvas */
    project(p: THREE.Vector3) { updateCamera(); v3.copy(p).project(cam()); return { x: (v3.x * 0.5 + 0.5) * width, y: (-v3.y * 0.5 + 0.5) * height, z: v3.z }; },
    get time() { return clockT; },
    get size() { return { width, height }; },
    dispose() {
      disposed = true; off(); ro.disconnect(); mo.disconnect(); io.disconnect();
      rtPBR.dispose(); rtND.dispose(); compMat.dispose();
      for (const o of entries) o.userData.__homo?.nd?.dispose?.();
      renderer.dispose();
      renderer.forceContextLoss?.();
    },
  };
}
