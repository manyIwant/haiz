// Chapter 02 · 根脉 — climbing a hundred years along the tree.
//
// One world, one renderer, one tree (like lanren/map). Between V4's shot 02
// (p = 1, the foot of the trunk) and shot 03 (p = 2, the new leaves) this module
// gives home.js a longer stretch of scroll and its own camera rail: up the
// trunk from 1923, over the fork, out along the limb to the leaves of today.
//
//   the bark   each station's year or photograph is cast onto the bark as light,
//              from the camera's side, so it reads undistorted from the station
//              and turns back into bark as the camera moves on. Art, not record.
//   the words  real text beside it: year, title, one sentence, how sure we are.
//   reading    a paper sheet with the photograph flat and uncropped, the facts,
//              every source, and what is not known. The page holds still; the
//              camera leans in, and leans back when the sheet closes.
//   finding    a year finder (the trunk, read upwards) jumps to any station;
//              「跳过」 goes straight on to 03.
//
// Nothing here owns the scroll system: home.js maps scroll to p and asks this
// module for its stations, its pose and whether it is in charge of the frame.
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { NODES, PHOTOS, SOURCES, GRADES, shortYear } from './history.js';
import { buildFrames, poseOn, stationS, stationAt, lean, lookOf, axisAt } from './path.js';

const CSS = new URL('./roots.css?v=1', import.meta.url).href;
const BASE = new URL('../../', import.meta.url);
const TOKEN = 'haiz.roots';
const K = NODES.length;            // stations 1..K are nodes; 0 is shot 02, K + 1 is shot 03
const M = K + 2;
const SEG = 1 / (M - 1);
const S = stationS(K);
/** scroll length of the whole chapter, in screen heights (one stretch per station) */
export const SPAN = (M - 1) * 0.8;

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ------------------------------------------------------------------ the tree as a screen
// Each station's photograph or year is projected from the camera's own position
// onto everything in front of it: trunk, limbs, leaves and the ground. From the
// station the image therefore reads whole and true; as the camera moves on it
// breaks apart along the real depth of the tree and gathers again at the next.
const PROJ_GLSL = /* glsl */`
uniform mat4 uRPM0; uniform mat4 uRPM1; uniform sampler2D uRPT0; uniform sampler2D uRPT1;
uniform vec3 uRPP0; uniform vec3 uRPP1; uniform vec4 uRPA; uniform vec4 uRPB; uniform vec3 uRPCol; uniform float uRPTwo;
float rpHash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
// A: x reference distance, y intensity, z develop (0..1), w reach beyond the reference
vec3 rootsProj(mat4 M, sampler2D T, vec3 P, vec4 A, vec3 wp, vec3 wn){
  if (A.y < 0.001) return vec3(0.0);
  vec4 c = M * vec4(wp, 1.0);
  if (c.w <= 0.0) return vec3(0.0);
  vec2 uv = c.xy / c.w * 0.5 + 0.5;
  // how far outside the frame (a projector's light does not stop dead at the frame's edge)
  float outK = length(max(max(-uv, uv - 1.0), 0.0));
  if (outK > 0.5) return vec3(0.0);
  vec3 toP = P - wp; float dist = length(toP); vec3 l = toP / dist;
  float reach = 1.0 - smoothstep(A.x + A.w * 0.55, A.x + A.w, dist);
  float nearCut = smoothstep(0.3, 0.75, dist);
  float nd = dot(wn, l);
  float facing = uRPTwo > 0.5 ? 0.45 + 0.55 * abs(nd) : smoothstep(-0.05, 0.4, nd);
  float fall = clamp(pow(A.x / dist, 0.8), 0.0, 1.5);
  vec2 uvc = clamp(uv, 0.0, 1.0);
  vec2 e = min(uvc, 1.0 - uvc);
  float edge = smoothstep(0.0, 0.06, e.x) * smoothstep(0.0, 0.06, e.y) * (1.0 - step(1e-4, outK));
  // develops upwards, grain by grain
  float g = rpHash(floor(uvc * vec2(420.0, 320.0)));
  float shown = 1.0 - smoothstep(-0.05, 0.05, uvc.y + (g - 0.5) * 0.14 - (A.z * 1.2 - 0.1));
  vec3 col = texture2D(T, uvc).rgb * edge * shown;
  // the beam's own faint wash over the frame and a soft spill round it: in the low light of the
  // early years it is what lets the bark's relief be read around the year (it develops with the image)
  float wash = 0.075 * exp(-outK * 7.5) * smoothstep(0.0, 0.6, A.z);
  return (col + vec3(wash)) * uRPCol * A.y * reach * nearCut * facing * fall;
}`;

function patchReceiver(mat, U, two = false) {
  if (!mat || mat.userData.roots) return;
  mat.userData.roots = true;
  const prev = mat.onBeforeCompile;
  const own = { uRPTwo: { value: two ? 1 : 0 } };
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    Object.assign(sh.uniforms, U, own);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + PROJ_GLSL)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
  {
    mat3 rpVI = transpose(mat3(viewMatrix));
    vec3 rpWP = cameraPosition + rpVI * (-vViewPosition);
    vec3 rpWN = normalize(rpVI * normal);
    vec3 rpL = rootsProj(uRPM0, uRPT0, uRPP0, uRPA, rpWP, rpWN) + rootsProj(uRPM1, uRPT1, uRPP1, uRPB, rpWP, rpWN);
    // light falls on the surface's own colour, with a floor so dark bark and deep leaves still carry it
    // a screen keeps the picture's colours: the surface's own tint is mostly neutralised
    vec3 rpAlb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15))), 0.7);
    // (dark glossy leaves get a higher floor than bark: a photograph has to hold together on them)
    reflectedLight.directDiffuse += max(rpAlb, uRPTwo > 0.5 ? vec3(0.115, 0.11, 0.1) : vec3(0.075, 0.07, 0.062)) * rpL;
  }`);
  };
  const key = mat.customProgramCacheKey?.bind(mat);
  mat.customProgramCacheKey = () => (key ? key() : '') + '-roots3';
  mat.needsUpdate = true;
}

// ------------------------------------------------------------------ a film being developed
// Silver black-and-white at the roots, toned monochrome in the years of the old
// photograph, faded colour coming back after 1988, full colour today, so the
// new leaves are the first fully saturated thing in the chapter.
const FilmShader = {
  uniforms: { tDiffuse: { value: null }, uBW: { value: 0 }, uTone: { value: 0 }, uFade: { value: 0 }, uFilm: { value: 0 }, uMove: { value: 1 }, uTime: { value: 0 }, uTexel: { value: new THREE.Vector2(1 / 1024, 1 / 1024) } },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
uniform sampler2D tDiffuse; uniform float uBW; uniform float uTone; uniform float uFade; uniform float uFilm; uniform float uMove; uniform float uTime; uniform vec2 uTexel;
varying vec2 vUv;
float fh(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
void main(){
  // the film breathes a little in the gate
  vec2 uv = vUv + uFilm * uMove * vec2(sin(uTime * 7.3) * 0.0005, sin(uTime * 5.1 + 1.3) * 0.0008);
  vec3 c = texture2D(tDiffuse, uv).rgb;
  // halation: bright edges bleed a warm glow into the emulsion
  vec3 h = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398;
    vec2 o = vec2(cos(a), sin(a)) * uTexel * 9.0;
    h += max(texture2D(tDiffuse, uv + o).rgb - 0.62, 0.0);
  }
  c += h / 8.0 * vec3(1.0, 0.42, 0.24) * 0.9 * uFilm;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  // silver: cool shadows, warm paper highlights; toned: sepia
  vec3 silver = mix(vec3(0.93, 0.96, 1.02), vec3(1.04, 1.0, 0.92), smoothstep(0.15, 0.85, l)) * l;
  vec3 sepia = vec3(l) * vec3(1.09, 0.97, 0.80);
  vec3 mono = mix(silver, sepia, uTone);
  mono = clamp((mono - 0.5) * (1.0 + 0.12 * uBW) + 0.5, 0.0, 1.0);
  // a print keeps detail in its shadows: the deepest tones are lifted a touch, never crushed to black
  mono += vec3(0.032, 0.031, 0.03) * (1.0 - smoothstep(0.0, 0.32, l));
  c = mix(c, mono, uBW);
  // faded colour: lifted blacks, softer contrast, a little warm
  c = mix(c, c * vec3(0.86, 0.85, 0.80) + vec3(0.06, 0.05, 0.035), uFade);
  // grain: stronger in the shadows, moving with the film
  float n = fh(gl_FragCoord.xy + floor(uTime * 24.0) * vec2(17.0, 31.0) * uMove) - 0.5;
  c += n * (0.045 + 0.05 * (1.0 - l)) * uFilm;
  c *= 1.0 + uFilm * uMove * (sin(uTime * 21.0) * 0.012 + sin(uTime * 9.7) * 0.008);
  c *= 1.0 - uFilm * 0.28 * smoothstep(0.3, 0.92, length((vUv - 0.5) * vec2(1.15, 1.0)));
  gl_FragColor = vec4(c, 1.0);
}`
};

/** A year (or an empty frame) set as light: white on black, read as projected light. */
function typeTexture([big, small], { voidFrame = false } = {}) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 640;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  if (voidFrame) {
    // a frame of light with nothing in it
    const grd = g.createRadialGradient(512, 320, 40, 512, 320, 520);
    grd.addColorStop(0, 'rgba(255,240,215,.42)'); grd.addColorStop(1, 'rgba(255,240,215,.16)');
    g.fillStyle = grd; g.fillRect(70, 70, 884, 500);
    g.strokeStyle = 'rgba(255,246,230,1)'; g.lineWidth = 16; g.strokeRect(70, 70, 884, 500);
  } else {
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillStyle = '#fff6e6';
    const fs = big.length > 5 ? 190 : 270;
    g.font = `400 ${fs}px "Cormorant Garamond", "Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", Georgia, serif`;
    g.fillText(big, 512, 380);
    g.globalAlpha = 0.86;
    g.font = '500 84px "Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", "SimSun", serif';
    g.fillText(small, 512, 520);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ------------------------------------------------------------------ the light of each era
// bw: black-and-white amount · tone: silver → sepia · fade: faded colour · film: grain, halation,
// gate weave · expo / sun: exposure and sunlight multipliers. Shots 02 and 03 are V4 as it was.
const NEUTRAL = { bw: 0, tone: 0, fade: 0, film: 0, expo: 1, sun: 1 };
const LOOKS = {
  '1923': { bw: 1, tone: 0.15, fade: 0, film: 1, expo: 0.95, sun: 1 },
  '1924': { bw: 1, tone: 0.25, fade: 0, film: 1, expo: 1, sun: 1 },
  '1938': { bw: 1, tone: 0, fade: 0, film: 1, expo: 0.34, sun: 0.12 },   // the light nearly goes out
  '1950': { bw: 1, tone: 0.35, fade: 0, film: 0.95, expo: 1.05, sun: 1.1 },
  '1959': { bw: 0.97, tone: 0.55, fade: 0, film: 0.9, expo: 1, sun: 1 },
  'gate-old': { bw: 0.94, tone: 0.75, fade: 0.1, film: 0.85, expo: 1, sun: 0.9 },
  gap: { bw: 0.9, tone: 0.3, fade: 0.2, film: 0.8, expo: 0.62, sun: 0.4 },     // grey dusk, an empty frame
  '1988': { bw: 0.42, tone: 0.5, fade: 0.75, film: 0.55, expo: 1, sun: 1 },   // colour seeps back, faded
  '2013': { bw: 0.18, tone: 0.3, fade: 0.45, film: 0.32, expo: 1, sun: 1 },
  '2015': { bw: 0.08, tone: 0.2, fade: 0.25, film: 0.2, expo: 1.02, sun: 1.05 },
  '2023': { bw: 0, tone: 0, fade: 0.05, film: 0.1, expo: 1.12, sun: 1.35 },    // out above the branch, into the sun
  people: { bw: 0, tone: 0, fade: 0, film: 0.04, expo: 1.06, sun: 1.15 },
  today: NEUTRAL
};

// ------------------------------------------------------------------ attach
/**
 * @param ctx { world, cam, state, goTo, shot, reduceMotion, entry, stops, onPose }
 * @returns hooks for home.js
 */
export function attach(ctx) {
  const { world, cam, state, goTo } = ctx;
  const reduce = !!ctx.reduceMotion;
  const body = document.body;
  const stops = ctx.stops;
  // the chapter's own stretch of scroll (home.js maps scroll ⇄ p through the stops' real offsets).
  // Set and laid out before the stylesheet below is inserted: while a sheet is loading, Chrome can
  // answer layout queries with the old style, and ScrollTrigger would measure a short page.
  stops[1].style.height = `calc(${SPAN} * 100svh)`;
  stops[1].dataset.roots = '';
  void stops[1].offsetHeight;
  if (!document.querySelector(`link[href="${CSS}"]`)) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CSS; document.head.append(l); }

  // ---------------------------------------------------------------- the nodes, found on the real bark
  const ray = new THREE.Raycaster();
  const nodes = NODES.map((n) => ({ ...n, at: { ...n.at } }));
  const found = nodes.map((n) => {
    const at = n.at;
    // keep the eye above the island and the water
    const ground = world.heightAt ? world.heightAt(at.eye[0], at.eye[2]) : -0.85;
    if (at.eye[1] < ground + 0.38) at.eye = [at.eye[0], ground + 0.38, at.eye[2]];
    if (!at.target) return null;
    const o = new THREE.Vector3(...at.eye), t = new THREE.Vector3(...at.target);
    ray.set(o, t.clone().sub(o).normalize());
    ray.far = o.distanceTo(t) + 1.6;
    const hit = ray.intersectObjects([world.bark, world.island].filter(Boolean), false)[0];
    if (hit && hit.point.distanceTo(t) < 1.4) { at.target = hit.point.toArray(); return { point: hit.point.clone(), d: hit.distance }; }
    return { point: t, d: o.distanceTo(t), missed: true };
  });
  let frames = null, framesKey = '';
  const getFrames = () => {
    const s1 = ctx.shot(1), s2 = ctx.shot(2);
    const key = [s1.ex, s1.yaw, s2.ex, s2.ey, s2.yaw, s2.fov].map((v) => v.toFixed(3)).join();
    if (key !== framesKey) { framesKey = key; frames = buildFrames(nodes, s1, s2); }
    return frames;
  };

  // ---------------------------------------------------------------- projector
  const U = {
    uRPM0: { value: new THREE.Matrix4() }, uRPM1: { value: new THREE.Matrix4() },
    uRPT0: { value: null }, uRPT1: { value: null },
    uRPP0: { value: new THREE.Vector3() }, uRPP1: { value: new THREE.Vector3() },
    uRPA: { value: new THREE.Vector4(0, 0, 0, 0) }, uRPB: { value: new THREE.Vector4(0, 0, 0, 0) },
    uRPCol: { value: new THREE.Color(1.0, 0.92, 0.8) }
  };
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); blank.needsUpdate = true;
  U.uRPT0.value = U.uRPT1.value = blank;
  patchReceiver(world.bark.material, U);
  patchReceiver(world.canopy?.mesh?.material, U, true);
  patchReceiver(world.island?.material, U);
  const film = new ShaderPass(FilmShader);
  film.enabled = false;
  world.composer.addPass(film);
  film.uniforms.uMove.value = reduce ? 0 : 1;
  const lookAt = (s) => {
    // per station, eased like the camera: each era holds its own light
    const q = clamp(s, 0, 1) * (M - 1), j = Math.min(M - 2, Math.floor(q)), f = q - j;
    const t = f * f * (3 - 2 * f);
    const A = j === 0 ? NEUTRAL : LOOKS[nodes[j - 1].id] || NEUTRAL;
    const B = j + 1 >= M - 1 ? NEUTRAL : LOOKS[nodes[j].id] || NEUTRAL;
    const o = {};
    for (const k of Object.keys(NEUTRAL)) o[k] = A[k] + (B[k] - A[k]) * t;
    return o;
  };

  const texCache = new Map();
  const loader = new THREE.TextureLoader();
  function lightTexture(n) {
    if (texCache.has(n.id)) return texCache.get(n.id);
    let entry = null;
    if (n.light?.photo) {
      const ph = PHOTOS[n.light.photo];
      entry = { tex: blank, aspect: ph.w / ph.h, h: 0.9, ready: false, photo: true };
      loader.load(new URL(ph.light || ph.src, BASE).href, (t) => {
        t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
        entry.tex = t; entry.aspect = t.image.width / t.image.height; entry.ready = true;
        for (const sl of slots) if (sl.node === n) bindSlot(sl);
      });
    } else if (n.light?.type || n.light?.void) {
      entry = { tex: typeTexture(n.light.type || ['', ''], { voidFrame: !!n.light.void }), aspect: 1024 / 640, h: n.light.void ? 0.82 : 0.7, ready: true };
    }
    texCache.set(n.id, entry);
    return entry;
  }
  // the four photographs are small: load them now, so a jump from the year finder finds its light ready
  for (const n of nodes) if (n.light?.photo) lightTexture(n);
  const slots = [0, 1].map((i) => ({ i, node: null, dev: 0, I: 0, M: i ? U.uRPM1 : U.uRPM0, T: i ? U.uRPT1 : U.uRPT0, P: i ? U.uRPP1 : U.uRPP0, V: i ? U.uRPB : U.uRPA }));
  const projCam = new THREE.PerspectiveCamera(30, 1, 0.1, 40);
  function bindSlot(sl) {
    const n = sl.node, k = nodes.indexOf(n), f = found[k], L = lightTexture(n);
    if (!f || !L) { sl.V.value.y = 0; return; }
    // the projector stands where the station's camera stands and looks where it looks,
    // so from the station the image reads whole and undistorted on whatever it falls on
    const pos = new THREE.Vector3(...n.at.eye).add(new THREE.Vector3(0, 0.02, 0));
    const look = new THREE.Vector3(...lookOf(n.at));
    const view = look.clone().sub(pos).normalize();
    const side = new THREE.Vector3().crossVectors(view, new THREE.Vector3(0, 1, 0)).normalize();
    // how much of the station's frame the image fills (photographs keep their whole proportion)
    const frame = n.at.frame || (L.photo ? 0.66 : n.light?.void ? 0.72 : 0.6);
    projCam.position.copy(pos);
    projCam.aspect = L.aspect;
    projCam.fov = (n.at.fov || 44) * frame;
    projCam.near = 0.2; projCam.far = 30;
    projCam.up.set(0, 1, 0);
    // a year is written along the grain where the station looks along a limb;
    // photographs always stay upright (a photograph is never a tilted card)
    if (!L.photo && n.at.along !== false) {
      const ax = new THREE.Vector3(...axisAt(f.point.toArray()));
      const right = ax.clone().addScaledVector(view, -ax.dot(view));
      if (right.lengthSq() > 1e-4 && Math.abs(ax.y) < 0.8) {
        right.normalize();
        if (right.dot(side) < 0) right.negate();   // read left to right from the station
        // never steeper than ~28°: it is a title, not a puzzle
        const sgn = Math.sign(new THREE.Vector3().crossVectors(side, right).dot(view)) || 1;
        const r2 = side.clone().applyAxisAngle(view, sgn * Math.min(0.49, right.angleTo(side)));
        projCam.up.crossVectors(r2, view).normalize();
      }
    }
    projCam.lookAt(look);
    projCam.updateProjectionMatrix(); projCam.updateMatrixWorld();
    sl.M.value.multiplyMatrices(projCam.projectionMatrix, projCam.matrixWorldInverse);
    sl.P.value.copy(pos);
    sl.T.value = L.tex;
    sl.V.value.x = pos.distanceTo(f.point);
    sl.V.value.w = n.at.reach ?? 7;
  }

  // ---------------------------------------------------------------- DOM
  const layer = document.createElement('div');
  layer.className = 'roots';
  layer.innerHTML = `
    <div class="roots-cap" aria-live="polite">
      <p class="roots-year"></p>
      <h3 class="roots-title"></h3>
      <p class="roots-lead"></p>
      <p class="roots-meta"><span class="roots-grade"></span><button type="button" class="roots-open">展开阅读</button></p>
    </div>
    <nav class="roots-find" aria-label="第二幕 · 按年代前往">
      <p class="roots-find-head"><b>02</b><span>根脉 · 1923 → 今天</span></p>
      <ol>${nodes.map((n, k) => `<li><button type="button" data-j="${k + 1}" aria-label="${esc(n.year + ' ' + n.title)}"><i aria-hidden="true"></i><span>${esc(shortYear(n))}</span></button></li>`).join('')}</ol>
      <p class="roots-find-tools"><button type="button" class="roots-list">全部年代</button><button type="button" class="roots-skip">跳过 · 进入 03 <span aria-hidden="true">→</span></button></p>
    </nav>`;
  document.body.append(layer);
  const sheet = document.createElement('dialog');
  sheet.className = 'roots-sheet';
  sheet.setAttribute('aria-labelledby', 'rootsSheetTitle');
  document.body.append(sheet);
  const $ = (q) => layer.querySelector(q);
  const cap = $('.roots-cap');
  const findBtns = [...layer.querySelectorAll('.roots-find [data-j]')];

  // ---------------------------------------------------------------- moving along
  const sOf = (p) => clamp(p - 1, 0, 1);
  const yForS = (s) => stops[1].offsetTop + s * (stops[2].offsetTop - stops[1].offsetTop);
  function goStation(j, instant = false) {
    j = clamp(j, 0, M - 1);
    const y = yForS(S[j]);
    if (instant || reduce || reading) { scrollTo(0, y); if (reduce || instant) state.p = 1 + S[j]; return; }
    scrollTo({ top: y, behavior: 'smooth' });
  }
  for (const b of findBtns) b.addEventListener('click', () => goStation(+b.dataset.j));
  $('.roots-skip').addEventListener('click', () => { if (reading) closeSheet(); goTo(2); });
  $('.roots-open').addEventListener('click', () => openSheet(cur));
  $('.roots-list').addEventListener('click', () => openSheet(null));

  // ---------------------------------------------------------------- reading
  let reading = false, readNode = null, leanK = 0, savedY = 0;
  function sourceList(n) {
    if (!n.sources.length) return '';
    return `<h4>出处</h4><ul class="roots-src">${n.sources.map((k) => {
      const s = SOURCES[k];
      const out = s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)} <span aria-hidden="true">↗</span></a>` : esc(s.name);
      const local = s.local ? ` · <a href="${esc(s.local)}">本站页面</a>` : '';
      return `<li>${out}${local}<small>${esc(s.checked)}</small></li>`;
    }).join('')}</ul>`;
  }
  function nodeHtml(n) {
    const g = GRADES[n.grade];
    const ph = n.photo ? PHOTOS[n.photo] : null;
    const k = nodes.indexOf(n);
    return `
      <header><p class="roots-s-year">${esc(n.year)}</p><h2 id="rootsSheetTitle">${esc(n.title)}</h2>
        <p class="roots-s-grade" data-grade="${n.grade}"><b>${esc(g.label)}</b>${esc(g.note)}</p></header>
      ${ph ? `<figure><img src="${esc(ph.src)}" width="${ph.w}" height="${ph.h}" alt="${esc(ph.alt)}" decoding="async"><figcaption>${esc(ph.credit)}</figcaption></figure>` : ''}
      <div class="roots-s-body">${n.body.map((t) => `<p>${esc(t)}</p>`).join('')}</div>
      ${sourceList(n)}
      ${n.links?.length ? `<p class="roots-s-links">${n.links.map((l) => `<a href="${esc(l.href)}">${esc(l.label)} <span aria-hidden="true">→</span></a>`).join('')}</p>` : ''}
      <nav class="roots-s-step" aria-label="上一条与下一条">
        <button type="button" data-step="-1" ${k <= 0 ? 'disabled' : ''}>← ${k > 0 ? esc(shortYear(nodes[k - 1])) : ''}</button>
        <button type="button" data-step="list">全部年代</button>
        <button type="button" data-step="1" ${k >= K - 1 ? 'disabled' : ''}>${k < K - 1 ? esc(shortYear(nodes[k + 1])) : ''} →</button>
      </nav>`;
  }
  function listHtml() {
    return `
      <header><p class="roots-s-year">1923 → 今天</p><h2 id="rootsSheetTitle">按年代阅读</h2>
        <p class="roots-s-grade"><b>不看镜头</b>逐条阅读第二幕的史料、照片与出处</p></header>
      <ol class="roots-s-list">${nodes.map((n) => `<li><button type="button" data-node="${esc(n.id)}"><span>${esc(n.year)}</span><b>${esc(n.title)}</b><small>${esc(GRADES[n.grade].label)} · ${esc(GRADES[n.grade].note)}</small></button></li>`).join('')}</ol>
      <p class="roots-s-note">树皮上的光影是镜头的表达，不是年轮，也不是史料。数字榄仁树是依物种特征创作的概念模型。</p>`;
  }
  function fillSheet(n) {
    readNode = n;
    sheet.innerHTML = `<button type="button" class="roots-close" aria-label="合上，回到树干">合上</button><div class="roots-s-in">${n ? nodeHtml(n) : listHtml()}</div>`;
    sheet.querySelector('.roots-close').addEventListener('click', closeSheet);
    for (const b of sheet.querySelectorAll('[data-step]')) b.addEventListener('click', () => {
      if (b.dataset.step === 'list') return fillSheet(null);
      const k = nodes.indexOf(readNode) + +b.dataset.step;
      if (k >= 0 && k < K) { fillSheet(nodes[k]); goStation(k + 1, true); }
    });
    for (const b of sheet.querySelectorAll('[data-node]')) b.addEventListener('click', () => {
      const k = nodes.findIndex((x) => x.id === b.dataset.node);
      fillSheet(nodes[k]); goStation(k + 1, true);
    });
    sheet.querySelector('.roots-s-in').scrollTop = 0;
    (sheet.querySelector('h2') || sheet).focus?.({ preventScroll: true });
  }
  function openSheet(n) {
    if (reading) { fillSheet(n); return; }
    reading = true;
    savedY = scrollY;
    fillSheet(n);
    document.documentElement.classList.add('roots-reading');
    cam.enabled = false; cam.releaseLook?.();
    if (typeof sheet.showModal === 'function') sheet.showModal(); else sheet.setAttribute('open', '');
    sheet.querySelector('h2')?.setAttribute('tabindex', '-1');
    sheet.querySelector('h2')?.focus({ preventScroll: true });
  }
  function closeSheet() {
    if (!reading) return;
    if (sheet.open) { if (typeof sheet.close === 'function') sheet.close(); else sheet.removeAttribute('open'); }
  }
  sheet.addEventListener('close', () => {
    reading = false;
    document.documentElement.classList.remove('roots-reading');
    cam.enabled = true;
    // the page never scrolled underneath; keep the station the reader ended on
    $('.roots-open').focus({ preventScroll: true });
  });
  sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });   // the backdrop

  // ---------------------------------------------------------------- tokens, deep links
  function saveToken(n) { try { sessionStorage.setItem(TOKEN, JSON.stringify({ id: n.id, t: Date.now() })); } catch { /* storage blocked */ } }
  function readToken() { try { const t = JSON.parse(sessionStorage.getItem(TOKEN) || 'null'); return t && Date.now() - t.t < 30 * 60000 ? t : null; } catch { return null; } }
  /** after home.js has placed the walk: a #roots/<id> link, or a return from a page opened here */
  function arrive(entry) {
    const m = /^#(?:roots|campus)\/(.+)$/.exec(entry?.hash || '');
    let id = m ? decodeURIComponent(m[1]) : null;
    if (!id && /^#(roots|campus)?$/.test(entry?.hash || '') && Math.round(state.p) === 1) id = readToken()?.id;
    const k = nodes.findIndex((n) => n.id === id);
    if (k >= 0) { goStation(k + 1, true); cam.snap(); }
  }

  // ---------------------------------------------------------------- per frame
  let cur = null, curJ = -1, shown = false, lastHash = '', wasOn = false;
  const owns = (p) => { const s = p - 1; return s > SEG * 0.45 && s < 1 - SEG * 0.45; };
  function pose(p) {
    if (!(p > 1 && p < 2)) return null;
    const s = sOf(p);
    let q = poseOn(getFrames(), s);
    if (leanK > 0.001 && readNode) {
      const f = found[nodes.indexOf(readNode)];
      q = lean(q, f ? f.point.toArray() : lookOf(readNode.at), leanK);
    }
    return q;
  }
  function tick(dt) {
    const p = state.p, s = sOf(p);
    const inChapter = p > 0.72 && p < 1.97;
    body.classList.toggle('roots-near', inChapter);
    const on = owns(p);
    body.classList.toggle('roots-on', on);
    // the navigator's label: inside the climb we are in 02 (no chapter panel is up to say so)
    if (on !== wasOn) {
      wasOn = on;
      if (on) { const wi = document.getElementById('whereIdx'), wn = document.getElementById('whereName'); if (wi) wi.textContent = '02'; if (wn) wn.textContent = '根脉'; }
    }
    const { j, settle } = stationAt(s, K);
    const node = j >= 1 && j <= K && p > 1 && p < 2 ? nodes[j - 1] : null;
    // reading: lean in, lean back
    leanK += ((reading && readNode ? 1 : 0) - leanK) * Math.min(1, dt * (reduce ? 30 : 2.4));
    // the bark: up to two nodes lit at once, cross-fading between stations
    const q = s * (M - 1);
    for (const sl of slots) {
      const k = nodes.findIndex((n, idx) => idx % 2 === sl.i && Math.abs(q - (idx + 1)) < 1);
      const n = k >= 0 && p > 1 && p < 2 ? nodes[k] : (reading && readNode && nodes.indexOf(readNode) % 2 === sl.i ? readNode : null);
      if (n !== sl.node) { sl.node = n; sl.dev = reduce ? 1 : 0; if (n) bindSlot(sl); }
      if (!n) { sl.I += (0 - sl.I) * Math.min(1, dt * 6); sl.V.value.y = sl.I; continue; }
      // one year at a time: the last one has mostly gone before the next develops (they break apart in between)
      const near = 1 - smooth(0.15, 0.62, Math.abs(q - (nodes.indexOf(n) + 1)));
      const L = texCache.get(n.id);
      const target = (L?.ready ? (n.light?.photo ? 3.2 : 2.4) * (n.at.glow || 1) : 0) * Math.max(near, reading && n === readNode ? 1 : 0);
      sl.I += (target - sl.I) * Math.min(1, dt * 4);
      if (near > 0.6) sl.dev = Math.min(1, sl.dev + dt / (reduce ? 0.01 : 2.2));
      sl.V.value.y = sl.I; sl.V.value.z = sl.dev;
    }
    // prefetch the next photograph
    const nxt = nodes[clamp(j, 0, K - 1)];
    if (nxt) lightTexture(nxt);
    // words
    const want = !!node && settle > 0.35 && owns(p) || (!!node && reading);
    if (node !== cur && node) {
      cur = node; curJ = j;
      const g = GRADES[node.grade];
      $('.roots-year').textContent = node.year;
      $('.roots-title').textContent = node.title;
      $('.roots-lead').textContent = node.lead;
      const gr = $('.roots-grade');
      gr.textContent = `${g.label} · ${g.note}`;
      gr.dataset.grade = node.grade;
      findBtns.forEach((b, i) => b.toggleAttribute('aria-current', i === j - 1));
      saveToken(node);
    }
    if (!node && cur) { cur = null; curJ = -1; findBtns.forEach((b) => b.removeAttribute('aria-current')); }
    if (want !== shown) { shown = want; cap.classList.toggle('on', want); cap.inert = !want; }
    // the address follows the station the camera rests at
    if (node && settle > 0.9 && !reading) {
      const h = '#roots/' + node.id;
      if (h !== lastHash && location.hash !== h) { history.replaceState(history.state, '', h); }
      lastHash = h;
    } else if (!node) lastHash = '';
    // the finder's progress: how far up the tree
    layer.style.setProperty('--climb', s.toFixed(4));
  }
  /** each era's light: exposure and sun here, the film grade in its own pass */
  function light(L, p) {
    const on = p > 1 && p < 2;
    const lk = on ? lookAt(sOf(p)) : NEUTRAL;
    film.enabled = on && (lk.bw > 0.003 || lk.film > 0.003 || lk.fade > 0.003);
    if (!on) return;
    // a shallow focus would smear the picture across the leaves that carry it: keep the
    // depth of field small inside the climb, returning to V4's own just before shot 03
    const s = sOf(p), back = smooth(1 - SEG * 1.2, 1, s);
    L.aperture *= 0.2 + 0.8 * back;
    L.exposure *= lk.expo;
    L.I *= lk.sun;
    L.rays *= lk.sun;
    const u = film.uniforms;
    u.uBW.value = lk.bw; u.uTone.value = lk.tone; u.uFade.value = lk.fade; u.uFilm.value = lk.film;
    // while someone reads, the picture holds still: no gate weave, no flicker
    u.uMove.value = reduce || reading ? 0 : 1;
    u.uTime.value = performance.now() / 1000;
    const r = world.renderer.domElement;
    u.uTexel.value.set(1 / Math.max(1, r.width), 1 / Math.max(1, r.height));
  }
  /** a tap on the lit bark opens that node */
  function tap(e) {
    if (!owns(state.p) || !cur || reading) return false;
    const k = nodes.indexOf(cur), f = found[k];
    if (!f || !cur.light) return false;
    const r = world.renderer.domElement.getBoundingClientRect();
    const v = f.point.clone().project(world.camera);
    const sx = (v.x * 0.5 + 0.5) * r.width + r.left, sy = (-v.y * 0.5 + 0.5) * r.height + r.top;
    if (Math.hypot(e.clientX - sx, e.clientY - sy) > Math.min(r.width, r.height) * 0.22) return false;
    openSheet(cur);
    return true;
  }
  addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !reading && owns(state.p) && cur && (document.activeElement === document.body || !document.activeElement)) { e.preventDefault(); openSheet(cur); }
  });

  return {
    pose, owns, tick, light, tap, arrive,
    /** p of every station, for scroll snapping */
    stations: () => S.map((s) => 1 + s),
    api: { nodes, found, goStation,
      /** review stills: let the light on the bark finish developing now */
      settle: () => { for (const sl of slots) sl.dev = 1; },
      get lightsReady() { return nodes.every((n) => !n.light?.photo || texCache.get(n.id)?.ready); }, open: (id) => openSheet(nodes.find((n) => n.id === id) || null), close: closeSheet,
      get reading() { return reading; }, get current() { return cur && cur.id; }, get slots() { return slots.map((s) => ({ node: s.node?.id || null, I: +s.I.toFixed(3), dev: +s.dev.toFixed(3) })); } }
  };
}
