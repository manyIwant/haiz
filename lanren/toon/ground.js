// The campus ground, painted from the project's own plan data (assets/walk/campus.json via geo.js):
// one canvas holds the ground's colours (lawns, paving, courts, the running track) as a background
// painter would block them in, and a second, smaller canvas tells the grass where it may grow and
// how tall (density in R, height in G). Water is its own surface. Ground cover between the surveyed
// features is interpretive (DESIGN.md: approximate models are labelled as approximate).
import * as THREE from 'three';
import { toonMaterial, TOON } from './toon.js';
import { featureSDF } from '../map/geo.js';

const PAD = 260;   // painted ground beyond the campus sheet (m); the surroundings start there

function painter(frame, size) {
  const s = frame.sheet;
  const x0 = s.x0 - 20, z0 = s.z0 - 20, w = s.x1 - s.x0 + 40, d = s.z1 - s.z0 + 40;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const k = size / Math.max(w, d);
  const toPx = (x, z) => [(x - x0) * k, (z - z0) * k];
  return { c, g, k, x0, z0, w, d, toPx, span: Math.max(w, d) };
}

function rectPath(g, P, f, grow = 0, round = 0) {
  const [cx, cz] = P.toPx(f.cx, f.cz);
  g.save();
  g.translate(cx, cz);
  g.rotate(-f.rot);
  const hw = (f.hw + grow) * P.k, hd = (f.hd + grow) * P.k;
  g.beginPath();
  if (round > 0 && g.roundRect) g.roundRect(-hw, -hd, hw * 2, hd * 2, Math.min(round * P.k, hw, hd));
  else g.rect(-hw, -hd, hw * 2, hd * 2);
  g.restore();
}

function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
}

/** paint strokes of colour variation, the way lawns are dabbed in painted backgrounds */
function dabs(g, P, n, colors, size, seed, clip) {
  const r = seeded(seed);
  g.save();
  if (clip) g.clip(clip);
  for (let i = 0; i < n; i++) {
    const x = r() * g.canvas.width, y = r() * g.canvas.height;
    const s = size * (0.4 + r());
    g.fillStyle = colors[(r() * colors.length) | 0];
    g.globalAlpha = 0.12 + r() * 0.16;
    g.beginPath();
    g.ellipse(x, y, s, s * (0.35 + r() * 0.4), r() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  g.globalAlpha = 1;
}

/** a winding path through a garden (drawn into the paint and, in black, into the grass mask) */
function gardenPath(g, P, f, style, width) {
  const [cx, cz] = P.toPx(f.cx, f.cz);
  g.save(); g.translate(cx, cz); g.rotate(-f.rot);
  g.strokeStyle = style; g.lineWidth = width * P.k; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-f.hw * P.k, -f.hd * 0.3 * P.k);
  g.bezierCurveTo(-f.hw * 0.3 * P.k, f.hd * 0.6 * P.k, f.hw * 0.2 * P.k, -f.hd * 0.6 * P.k, f.hw * P.k, f.hd * 0.25 * P.k);
  g.stroke(); g.restore();
}

function drawTrack(g, P, f) {
  // a 400 m stadium track fitted to the field rect: straights along the long side
  const [cx, cz] = P.toPx(f.cx, f.cz);
  g.save();
  g.translate(cx, cz);
  g.rotate(-f.rot);
  const long = Math.max(f.hw, f.hd), short = Math.min(f.hw, f.hd);
  if (f.hd > f.hw) g.rotate(Math.PI / 2);
  const k = P.k;
  const R = Math.min(short - 2, 36.5) * k, L = Math.min(long - 4 - R / k, 42.2) * k;
  const stadium = (r) => {
    g.beginPath();
    g.moveTo(-L, -r); g.lineTo(L, -r);
    g.arc(L, 0, r, -Math.PI / 2, Math.PI / 2);
    g.lineTo(-L, r);
    g.arc(-L, 0, r, Math.PI / 2, Math.PI * 1.5);
    g.closePath();
  };
  g.fillStyle = '#5aa64a';
  g.fillRect(-long * k, -short * k, long * 2 * k, short * 2 * k);
  stadium(R + 1.5 * k); g.fillStyle = '#b8573d'; g.fill();
  stadium(R - 7.4 * k); g.fillStyle = '#5fae4b'; g.fill();
  // mowing stripes on the infield
  g.save(); stadium(R - 7.6 * k); g.clip();
  for (let i = -12; i <= 12; i++) { if (i % 2) continue; g.fillStyle = 'rgba(255,255,230,0.07)'; g.fillRect(i * 5 * k, -R, 5 * k, R * 2); }
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = Math.max(1, 0.12 * k);
  g.strokeRect(-52.5 * k, -34 * k, 105 * k, 68 * k);
  g.beginPath(); g.moveTo(0, -34 * k); g.lineTo(0, 34 * k); g.stroke();
  g.beginPath(); g.arc(0, 0, 9.15 * k, 0, Math.PI * 2); g.stroke();
  g.restore();
  g.strokeStyle = 'rgba(255,244,230,0.8)'; g.lineWidth = Math.max(1, 0.08 * k);
  for (let lane = 0; lane <= 8; lane++) { stadium(R - 7.2 * k + lane * 1.08 * k); g.stroke(); }
  g.restore();
}

function drawCourts(g, P, f) {
  const [cx, cz] = P.toPx(f.cx, f.cz);
  g.save();
  g.translate(cx, cz);
  g.rotate(-f.rot);
  const k = P.k, hw = f.hw * k, hd = f.hd * k;
  g.fillStyle = f.sport === 'volleyball' ? '#b47e64' : '#5d8399';
  g.fillRect(-hw, -hd, hw * 2, hd * 2);
  const [gx, gz] = f.grid || [1, 1];
  const [pw, pl] = f.sport === 'volleyball' ? [9, 18] : [15, 28];
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = Math.max(1, 0.08 * k);
  const cw = (hw * 2) / gx, cd = (hd * 2) / gz;
  for (let i = 0; i < gx; i++) for (let j = 0; j < gz; j++) {
    const x = -hw + cw * (i + 0.5), z = -hd + cd * (j + 0.5);
    const rotate = cw > cd;
    const a = (rotate ? pl : pw) * k / 2, b = (rotate ? pw : pl) * k / 2;
    const s = Math.min(1, (cw * 0.92) / (a * 2), (cd * 0.92) / (b * 2));
    g.fillStyle = f.sport === 'volleyball' ? '#c98e6f' : '#6b93a8';
    g.fillRect(x - a * s, z - b * s, a * 2 * s, b * 2 * s);
    g.strokeRect(x - a * s, z - b * s, a * 2 * s, b * 2 * s);
    g.beginPath();
    if (rotate) { g.moveTo(x, z - b * s); g.lineTo(x, z + b * s); } else { g.moveTo(x - a * s, z); g.lineTo(x + a * s, z); }
    g.stroke();
    if (f.sport !== 'volleyball') { g.beginPath(); g.arc(x, z, 1.8 * k * s, 0, Math.PI * 2); g.stroke(); }
  }
  g.restore();
}

export function paintGround(geo, size = 4096) {
  const P = painter(geo.frame, size);
  const g = P.g;
  // base: lawn, dabbed
  g.fillStyle = '#62a548';
  g.fillRect(0, 0, size, size);
  dabs(g, P, 2600, ['#4f9440', '#76b552', '#88c25a', '#5a9a44', '#9ccc64'], size / 90, 7);
  const F = geo.features;
  // paving round every building and gate (forecourts, aprons), then roads
  g.fillStyle = '#b9b19d';
  for (const f of F) if (f.kind === 'building' || f.kind === 'gate') { rectPath(g, P, f, 4.5, 2); g.fill(); }
  for (const f of F) if (f.kind === 'road') { rectPath(g, P, f, 0, 0); g.fillStyle = '#beb6a2'; g.fill(); }
  // road edges: a kerb line and a darker gutter, painted thin
  g.strokeStyle = 'rgba(150,140,118,0.55)'; g.lineWidth = Math.max(1, 0.25 * P.k);
  for (const f of F) if (f.kind === 'road') { rectPath(g, P, f, 0, 0); g.stroke(); }
  // gardens and the botanic garden: deeper, lusher green
  for (const f of F) if (f.kind === 'garden' || f.kind === 'botanic') {
    rectPath(g, P, f, 0, 3); g.fillStyle = '#4c8f3e'; g.fill();
    const clip = new Path2D(); const [cx, cz] = P.toPx(f.cx, f.cz);
    clip.ellipse(cx, cz, f.hw * P.k, f.hd * P.k, -f.rot, 0, Math.PI * 2);
    dabs(g, P, 220, ['#3f7f37', '#5d9e46', '#6fae4f'], size / 120, 11, clip);
    gardenPath(g, P, f, '#cdbf9f', 1.8);
  }
  for (const f of F) if (f.kind === 'court') drawCourts(g, P, f);
  for (const f of F) if (f.kind === 'field') drawTrack(g, P, f);
  // under the buildings and the ponds' stone rims
  for (const f of F) if (f.kind === 'building' || f.kind === 'gate' || f.kind === 'pavilion') { rectPath(g, P, f, 0.4, 0); g.fillStyle = '#bdb5a2'; g.fill(); }
  for (const f of F) if (f.kind === 'water') { rectPath(g, P, f, 1.2, 1.5); g.fillStyle = '#b9b3a4'; g.fill(); rectPath(g, P, f, 0, 1); g.fillStyle = '#3e6f73'; g.fill(); }
  // a soft soil ring under the old tree
  const [tx, tz] = P.toPx(0, 0);
  const grad = g.createRadialGradient(tx, tz, 0, tx, tz, 9 * P.k);
  grad.addColorStop(0, 'rgba(120,98,70,0.85)'); grad.addColorStop(0.55, 'rgba(110,100,70,0.45)'); grad.addColorStop(1, 'rgba(100,120,70,0)');
  g.fillStyle = grad; g.beginPath(); g.arc(tx, tz, 9 * P.k, 0, Math.PI * 2); g.fill();
  return P;
}

/** Where the grass grows (R = density 0..1, G = height 0..1) on the same mapping as the paint. */
export function paintGrassMask(geo, size = 1024) {
  const P = painter(geo.frame, size);
  const g = P.g;
  g.fillStyle = 'rgb(255,200,0)';
  g.fillRect(0, 0, size, size);
  const F = geo.features;
  const fill = (f, grow, style, round = 0) => { rectPath(g, P, f, grow, round); g.fillStyle = style; g.fill(); };
  for (const f of F) if (f.kind === 'garden' || f.kind === 'botanic') { fill(f, 0, 'rgb(255,255,0)', 3); gardenPath(g, P, f, 'rgb(0,0,0)', 2.2); }
  for (const f of F) if (f.kind === 'field') fill(f, -2, 'rgb(150,60,0)');     // short turf on the infield
  for (const f of F) if (f.kind === 'building' || f.kind === 'gate') fill(f, 4.2, 'rgb(0,0,0)', 2);
  for (const f of F) if (f.kind === 'road' || f.kind === 'court' || f.kind === 'water' || f.kind === 'pavilion' || f.kind === 'corridor' || f.kind === 'rock') fill(f, f.kind === 'water' ? 1.5 : 0.3, 'rgb(0,0,0)');
  // the track ring itself carries no grass: clear a stadium band inside the field
  for (const f of F) if (f.kind === 'field') {
    const [cx, cz] = P.toPx(f.cx, f.cz);
    g.save(); g.translate(cx, cz); g.rotate(-f.rot); if (f.hd > f.hw) g.rotate(Math.PI / 2);
    const long = Math.max(f.hw, f.hd), short = Math.min(f.hw, f.hd), k = P.k;
    const R = Math.min(short - 2, 36.5) * k, L = Math.min(long - 4 - R / k, 42.2) * k;
    g.lineWidth = 9.2 * k; g.strokeStyle = 'rgb(0,0,0)';
    g.beginPath(); g.moveTo(-L, -(R - 2.9 * k)); g.lineTo(L, -(R - 2.9 * k)); g.arc(L, 0, R - 2.9 * k, -Math.PI / 2, Math.PI / 2); g.lineTo(-L, R - 2.9 * k); g.arc(-L, 0, R - 2.9 * k, Math.PI / 2, Math.PI * 1.5); g.stroke();
    g.restore();
  }
  // soft edges, then the trunk ring of the old tree
  const [tx, tz] = P.toPx(0, 0);
  g.fillStyle = 'rgb(0,0,0)'; g.beginPath(); g.arc(tx, tz, 4.5 * P.k, 0, Math.PI * 2); g.fill();
  g.filter = 'blur(1px)';
  g.drawImage(P.c, 0, 0);
  g.filter = 'none';
  return P;
}

export function createGround(geo) {
  const P = paintGround(geo);
  const tex = new THREE.CanvasTexture(P.c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  const span = P.span;
  const size = span + PAD * 2;
  const geom = new THREE.PlaneGeometry(size, size, 1, 1);
  geom.rotateX(-Math.PI / 2);
  const cx = P.x0 + span / 2, cz = P.z0 + span / 2;
  geom.translate(cx, geo.frame.ground, cz);
  const uniforms = {
    uPaint: { value: tex }, uPaintO: { value: new THREE.Vector2(P.x0, P.z0) }, uPaintS: { value: span },
  };
  const mat = toonMaterial({
    name: 'ground', key: 'ground', uniforms,
    fragment: {
      head: /* glsl */`
uniform sampler2D uPaint; uniform vec2 uPaintO; uniform float uPaintS;
`,
      albedo: /* glsl */`
vec2 puv = (vToonWP.xz - uPaintO) / uPaintS;
vec3 paint = pow(texture2D(uPaint, vec2(puv.x, 1.0 - puv.y)).rgb, vec3(2.2));   // sRGB canvas, read raw
float inside = step(0.0, puv.x) * step(puv.x, 1.0) * step(0.0, puv.y) * step(puv.y, 1.0);
// beyond the campus: rough city ground under the haze
float n = tFbm(vToonWP.xz * 0.02);
vec3 outside = mix(vec3(0.16, 0.26, 0.09), vec3(0.3, 0.32, 0.2), n);
toonAlbedo = mix(outside, paint, inside);
// painted mottling at two scales so lawns never read as a flat fill
float m = tFbm(vToonWP.xz * 0.11) * 0.6 + tFbm(vToonWP.xz * 0.5) * 0.4;
toonAlbedo *= 0.86 + 0.28 * m;
toonSoft = 0.0;
`,
    },
  });
  tex.colorSpace = THREE.NoColorSpace;
  const mesh = new THREE.Mesh(geom, mat);
  mesh.receiveShadow = true;
  mesh.name = 'toon-ground';
  return { mesh, painter: P };
}

/** Ponds: deep teal water that mirrors the sky at grazing angles, with sun glints and slow ripples. */
export function createWater(geo, sky) {
  const group = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...TOON, ...sky },
    vertexShader: /* glsl */`
varying vec3 vWP;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: '#include <common>\nuniform vec3 uZenith;\nvarying vec3 vWP;\n' + WATER_FRAG,
  });
  for (const f of geo.features) {
    if (f.kind !== 'water') continue;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(f.hw * 2, f.hd * 2), mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = f.rot;
    m.position.set(f.cx, geo.frame.ground - 0.12, f.cz);
    group.add(m);
  }
  return group;
}

const WATER_FRAG = /* glsl */`
uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uFogColor; uniform vec3 uFogSun; uniform float uTime;
uniform float uFogDensity; uniform float uFogFalloff; uniform float uFogMax; uniform float uGroundY; uniform vec3 uSkyAmb;
uniform vec3 uGroundAmb; uniform vec3 uShadeTint; uniform vec3 uRimColor; uniform vec2 uWind; uniform float uCloudShadow; uniform float uCloudCover;
float wh(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float wn(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(wh(i), wh(i + vec2(1, 0)), u.x), mix(wh(i + vec2(0, 1)), wh(i + vec2(1, 1)), u.x), u.y); }
void main() {
  vec3 V = normalize(cameraPosition - vWP);
  vec2 p = vWP.xz * 0.9;
  float e = 0.08;
  float h0 = wn(p + uTime * 0.25) + wn(p * 2.3 - uTime * 0.31) * 0.5;
  float hx = wn(p + vec2(e, 0) + uTime * 0.25) + wn((p + vec2(e, 0)) * 2.3 - uTime * 0.31) * 0.5;
  float hz = wn(p + vec2(0, e) + uTime * 0.25) + wn((p + vec2(0, e)) * 2.3 - uTime * 0.31) * 0.5;
  vec3 N = normalize(vec3((h0 - hx) * 0.35, 1.0, (h0 - hz) * 0.35));
  vec3 R = reflect(-V, N);
  float t = pow(clamp(R.y, 0.0, 1.0), 0.45);
  vec3 sky = mix(uFogColor, uZenith, t);
  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 deep = vec3(0.03, 0.12, 0.13) * (uSkyAmb + uSunColor * 0.25);
  vec3 col = mix(deep, sky, clamp(fres * 1.3, 0.0, 1.0));
  float glint = pow(max(dot(R, uSunDir), 0.0), 220.0);
  col += uFogSun * step(0.35, glint) * 3.0;
  // the same air as everything else
  float d = length(vWP - cameraPosition);
  col = mix(col, uFogColor, clamp(1.0 - exp(-d * uFogDensity), 0.0, uFogMax));
  gl_FragColor = vec4(col, 1.0);
}`;
