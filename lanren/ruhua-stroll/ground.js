// The ground, V2. V1 painted flat fills: big cream voids of paving, a lime lawn, hard edges. Here
// the paving is a mid value with joints, kerbs and tone variation; every building stands in a soft
// pool of occlusion; every tree has a pool of cool shade-litter under it (the terminalias drop red
// leaves on the paving in late autumn); lawn edges are soft. On the lawns the shader adds brush
// strokes combed by the wind and the moving sheen of the same wind field the grass blades lean in,
// so the far lawn moves with the near grass.
// Ground cover between the surveyed features is interpretive (DESIGN.md: approximate models are labelled).
import * as THREE from 'three';
import { cel, U, GLSL } from './atmos.js';

const PAD = 260;

export function painter(frame, size) {
  const s = frame.sheet;
  const x0 = s.x0 - 20, z0 = s.z0 - 20, w = s.x1 - s.x0 + 40, d = s.z1 - s.z0 + 40;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const k = size / Math.max(w, d);
  return { c, g, k, x0, z0, span: Math.max(w, d), toPx: (x, z) => [(x - x0) * k, (z - z0) * k] };
}

function rectPath(g, P, f, grow = 0, round = 0) {
  const [cx, cz] = P.toPx(f.cx, f.cz);
  g.save(); g.translate(cx, cz); g.rotate(-f.rot);
  const hw = (f.hw + grow) * P.k, hd = (f.hd + grow) * P.k;
  g.beginPath();
  if (round > 0 && g.roundRect) g.roundRect(-hw, -hd, hw * 2, hd * 2, Math.min(round * P.k, hw, hd)); else g.rect(-hw, -hd, hw * 2, hd * 2);
  g.restore();
}
/** rasterise what has been drawn so far: a deferred canvas otherwise replays one huge clipped display list */
const flush = (g) => { g.getImageData(0, 0, 1, 1); };

function seeded(seed) { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; }

function dabs(g, n, colors, size, seed, alpha = [0.1, 0.16]) {
  const r = seeded(seed);
  for (let i = 0; i < n; i++) {
    const x = r() * g.canvas.width, y = r() * g.canvas.height, s = size * (0.4 + r());
    g.fillStyle = colors[(r() * colors.length) | 0];
    g.globalAlpha = alpha[0] + r() * alpha[1];
    g.beginPath(); g.ellipse(x, y, s, s * (0.3 + r() * 0.4), r() * Math.PI, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
}

function gardenPath(g, P, f, style, width) {
  const [cx, cz] = P.toPx(f.cx, f.cz);
  g.save(); g.translate(cx, cz); g.rotate(-f.rot);
  g.strokeStyle = style; g.lineWidth = width * P.k; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-f.hw * P.k, -f.hd * 0.3 * P.k);
  g.bezierCurveTo(-f.hw * 0.3 * P.k, f.hd * 0.6 * P.k, f.hw * 0.2 * P.k, -f.hd * 0.6 * P.k, f.hw * P.k, f.hd * 0.25 * P.k);
  g.stroke(); g.restore();
}

function stadium(g, L, r) {
  g.beginPath(); g.moveTo(-L, -r); g.lineTo(L, -r); g.arc(L, 0, r, -Math.PI / 2, Math.PI / 2); g.lineTo(-L, r); g.arc(-L, 0, r, Math.PI / 2, Math.PI * 1.5); g.closePath();
}
function trackGeom(f, k) {
  const long = Math.max(f.hw, f.hd), short = Math.min(f.hw, f.hd);
  const R = Math.min(short - 2, 36.5) * k, L = Math.min(long - 4 - R / k, 42.2) * k;
  return { R, L, long, short };
}
function drawTrack(g, P, f) {
  const [cx, cz] = P.toPx(f.cx, f.cz);
  g.save(); g.translate(cx, cz); g.rotate(-f.rot); if (f.hd > f.hw) g.rotate(Math.PI / 2);
  const k = P.k, { R, L, long, short } = trackGeom(f, k);
  g.fillStyle = '#679845'; g.fillRect(-long * k, -short * k, long * 2 * k, short * 2 * k);
  stadium(g, L, R + 1.5 * k); g.fillStyle = '#ad5a42'; g.fill();
  stadium(g, L, R - 7.4 * k); g.fillStyle = '#6a9e48'; g.fill();
  g.save(); stadium(g, L, R - 7.6 * k); g.clip();
  for (let i = -12; i <= 12; i += 2) { g.fillStyle = 'rgba(255,255,220,0.06)'; g.fillRect(i * 5 * k, -R, 5 * k, R * 2); }
  g.strokeStyle = 'rgba(250,250,240,0.75)'; g.lineWidth = Math.max(1, 0.12 * k);
  g.strokeRect(-52.5 * k, -34 * k, 105 * k, 68 * k);
  g.beginPath(); g.moveTo(0, -34 * k); g.lineTo(0, 34 * k); g.stroke();
  g.beginPath(); g.arc(0, 0, 9.15 * k, 0, Math.PI * 2); g.stroke();
  g.restore();
  g.strokeStyle = 'rgba(250,238,222,0.7)'; g.lineWidth = Math.max(1, 0.08 * k);
  for (let lane = 0; lane <= 8; lane++) { stadium(g, L, R - 7.2 * k + lane * 1.08 * k); g.stroke(); }
  g.restore();
}
function drawCourts(g, P, f) {
  const [cx, cz] = P.toPx(f.cx, f.cz);
  g.save(); g.translate(cx, cz); g.rotate(-f.rot);
  const k = P.k, hw = f.hw * k, hd = f.hd * k;
  const volley = f.sport === 'volleyball';
  g.fillStyle = volley ? '#a8806a' : '#5f8295'; g.fillRect(-hw, -hd, hw * 2, hd * 2);
  const [gx, gz] = f.grid || [1, 1];
  const [pw, pl] = volley ? [9, 18] : [15, 28];
  g.strokeStyle = 'rgba(250,250,245,0.8)'; g.lineWidth = Math.max(1, 0.08 * k);
  const cw = (hw * 2) / gx, cd = (hd * 2) / gz;
  for (let i = 0; i < gx; i++) for (let j = 0; j < gz; j++) {
    const x = -hw + cw * (i + 0.5), z = -hd + cd * (j + 0.5);
    const rot = cw > cd, a = (rot ? pl : pw) * k / 2, b = (rot ? pw : pl) * k / 2;
    const s = Math.min(1, (cw * 0.92) / (a * 2), (cd * 0.92) / (b * 2));
    g.fillStyle = volley ? '#bd8c70' : '#6b91a4';
    g.fillRect(x - a * s, z - b * s, a * 2 * s, b * 2 * s); g.strokeRect(x - a * s, z - b * s, a * 2 * s, b * 2 * s);
    g.beginPath(); if (rot) { g.moveTo(x, z - b * s); g.lineTo(x, z + b * s); } else { g.moveTo(x - a * s, z); g.lineTo(x + a * s, z); } g.stroke();
    if (!volley) { g.beginPath(); g.arc(x, z, 1.8 * k * s, 0, Math.PI * 2); g.stroke(); }
  }
  g.restore();
}

/** a Path2D of rotated rects (world features → canvas), for clipping */
function rectsPath(P, list, grow = 0, round = 0) {
  const path = new Path2D();
  for (const f of list) {
    const [cx, cz] = P.toPx(f.cx, f.cz);
    const m = new DOMMatrix().translate(cx, cz).rotate(-f.rot * 180 / Math.PI);
    const hw = (f.hw + grow) * P.k, hd = (f.hd + grow) * P.k;
    const r = new Path2D();
    if (round > 0 && r.roundRect) r.roundRect(-hw, -hd, hw * 2, hd * 2, Math.min(round * P.k, hw, hd)); else r.rect(-hw, -hd, hw * 2, hd * 2);
    path.addPath(r, m);
  }
  return path;
}

/** a repeating slab pattern (tone variation + joints), so paving is one fill, not 100k little ones */
function slabPattern(g, P, seed, joint) {
  const step = Math.max(3, Math.round(2 * P.k)), n = 8;
  const c = document.createElement('canvas');
  c.width = c.height = step * n;
  const t = c.getContext('2d');
  const r = seeded(seed);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const v = r();
    if (v < 0.55) continue;
    t.fillStyle = v > 0.82 ? 'rgba(255,248,232,0.07)' : 'rgba(60,50,35,0.06)';
    t.fillRect(x * step, y * step, step, step);
  }
  t.strokeStyle = joint; t.lineWidth = Math.max(1, 0.06 * P.k);
  t.beginPath();
  for (let i = 0; i <= n; i++) { t.moveTo(0, i * step + 0.5); t.lineTo(c.width, i * step + 0.5); t.moveTo(i * step + 0.5, 0); t.lineTo(i * step + 0.5, c.height); }
  t.stroke();
  return g.createPattern(c, 'repeat');
}

/** paving: a mid value, 2 m slabs with faint joints and a little tone variation per slab */
function pave(g, P, path, seed, base, joint) {
  g.save();
  g.clip(path);
  g.fillStyle = base; g.fillRect(0, 0, g.canvas.width, g.canvas.height);
  g.fillStyle = slabPattern(g, P, seed, joint); g.fillRect(0, 0, g.canvas.width, g.canvas.height);
  dabs(g, 1200, ['#8c8475', '#c8bfab', '#9a9282', '#b9a98f'], g.canvas.width / 60, seed + 1, [0.05, 0.09]);
  g.restore();
}

/** soft occlusion: shapes drawn into a quarter-size scratch canvas, blurred there, multiplied onto the paint */
function occlusion(P, draw, blurM, strength) {
  const q = 4, size = Math.ceil(P.c.width / q);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, size, size);
  g.fillStyle = `rgba(0,0,0,${strength})`;
  g.scale(1 / q, 1 / q);
  draw(g);
  const out = document.createElement('canvas');
  out.width = out.height = size;
  const o = out.getContext('2d');
  o.filter = `blur(${Math.max(1, blurM * P.k / q).toFixed(1)}px)`;
  o.drawImage(c, 0, 0);
  P.g.save();
  P.g.globalCompositeOperation = 'multiply';
  P.g.imageSmoothingQuality = 'high';
  P.g.drawImage(out, 0, 0, P.c.width, P.c.height);
  P.g.restore();
}

export function paintGround(geo, trees, size = 4096) {
  const P = painter(geo.frame, size);
  const g = P.g;
  const F = geo.features;
  // lawn, dabbed in strokes
  g.fillStyle = '#62903f'; g.fillRect(0, 0, size, size);
  dabs(g, Math.round(2000 * size / 4096), ['#588a3c', '#76a64c', '#8aae54', '#537c38', '#9db75c', '#6f9b47'], size / 85, 7);
  flush(g);
  // paving: aprons round buildings and gates, and the roads
  const aprons = F.filter((f) => f.kind === 'building' || f.kind === 'gate');
  const roads = F.filter((f) => f.kind === 'road');
  pave(g, P, rectsPath(P, aprons, 4.5, 2), 11, '#b0a690', 'rgba(105,95,78,0.13)');
  pave(g, P, rectsPath(P, roads), 13, '#a89f8b', 'rgba(100,92,76,0.11)');
  flush(g);
  // kerbs: a light stone line and a darker gutter along every road
  g.strokeStyle = 'rgba(222,214,196,0.75)'; g.lineWidth = Math.max(1, 0.25 * P.k);
  g.stroke(rectsPath(P, roads, -0.2));
  g.strokeStyle = 'rgba(80,72,58,0.35)'; g.lineWidth = Math.max(1, 0.18 * P.k);
  g.stroke(rectsPath(P, roads, 0.1));
  // gardens and the botanic garden: deeper green with their winding paths
  for (const f of F) if (f.kind === 'garden' || f.kind === 'botanic') {
    rectPath(g, P, f, 0, 3); g.fillStyle = f.kind === 'botanic' ? '#4f8540' : '#5a8d41'; g.fill();
    g.save(); g.clip(rectsPath(P, [f], 0, 3));
    dabs(g, 260, ['#457a38', '#62984a', '#71a650', '#8cae55'], size / 110, 17 + (f.index || 0));
    g.restore();
    gardenPath(g, P, f, '#c3b597', 1.8);
  }
  for (const f of F) if (f.kind === 'court') drawCourts(g, P, f);
  for (const f of F) if (f.kind === 'field') drawTrack(g, P, f);
  flush(g);
  // footprints and pond rims
  for (const f of F) if (f.kind === 'building' || f.kind === 'gate' || f.kind === 'pavilion') { rectPath(g, P, f, 0.3); g.fillStyle = '#9f977f'; g.fill(); }
  for (const f of F) if (f.kind === 'water') { rectPath(g, P, f, 1.2, 1.5); g.fillStyle = '#b3ad9d'; g.fill(); rectPath(g, P, f, 0, 1); g.fillStyle = '#35605f'; g.fill(); }
  // occlusion: buildings sit in soft pools; every tree has its pool of cooler shade
  occlusion(P, (o) => { o.fill(rectsPath(P, F.filter((f) => f.kind === 'building'), 0.6)); }, 2.2, 0.38);
  flush(g);
  occlusion(P, (o) => {
    for (const t of trees) {
      const [x, z] = P.toPx(t.x, t.z);
      const r = (t.kind === 'palm' ? 1.6 : t.kind === 'shrub' ? 1.0 : t.kind === 'lanshu' ? 9 : 3.2) * (t.s || 1) * P.k;
      o.beginPath(); o.arc(x, z, r, 0, Math.PI * 2); o.fill();
    }
  }, 2.0, 0.24);
  flush(g);
  // fallen terminalia leaves on the paving under the 榄仁 (late autumn), and the soil ring of the old tree
  g.save();
  g.clip(rectsPath(P, [...aprons, ...roads], 4.5));
  const r = seeded(29);
  for (const t of trees) {
    if (t.kind !== 'terminalia' && t.kind !== 'lanshu') continue;
    const n = t.kind === 'lanshu' ? 160 : 26, R = (t.kind === 'lanshu' ? 11 : 3.6) * (t.s || 1);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R;
      const [x, z] = P.toPx(t.x + Math.cos(a) * d, t.z + Math.sin(a) * d);
      g.fillStyle = ['#9c4a2c', '#b4642e', '#8a3a24', '#c08a3a'][(r() * 4) | 0];
      g.globalAlpha = 0.75;
      g.beginPath(); g.ellipse(x, z, 0.14 * P.k, 0.08 * P.k, r() * Math.PI, 0, Math.PI * 2); g.fill();
    }
  }
  g.restore();
  g.globalAlpha = 1;
  const [tx, tz] = P.toPx(0, 0);
  const grad = g.createRadialGradient(tx, tz, 0, tx, tz, 7 * P.k);
  grad.addColorStop(0, 'rgba(108,88,64,0.9)'); grad.addColorStop(0.6, 'rgba(100,92,66,0.45)'); grad.addColorStop(1, 'rgba(100,120,70,0)');
  g.fillStyle = grad; g.beginPath(); g.arc(tx, tz, 7 * P.k, 0, Math.PI * 2); g.fill();
  return P;
}

/** where grass grows (R density, G height class) — soft-edged, so blades taper toward paving */
export function paintGrassMask(geo, size = 1024) {
  const P = painter(geo.frame, size);
  const g = P.g;
  const F = geo.features;
  g.fillStyle = 'rgb(255,150,0)'; g.fillRect(0, 0, size, size);            // lawn: medium height
  const fill = (list, grow, style, round = 0) => { g.fillStyle = style; g.fill(rectsPath(P, list, grow, round)); };
  for (const f of F) if (f.kind === 'garden') { fill([f], 0, 'rgb(255,215,0)', 3); }
  for (const f of F) if (f.kind === 'botanic') { fill([f], 0, 'rgb(255,255,0)', 3); }
  for (const f of F) if (f.kind === 'field') fill([f], -2, 'rgb(170,40,0)');      // short turf
  fill(F.filter((f) => f.kind === 'building' || f.kind === 'gate'), 4.3, 'rgb(0,0,0)', 2);
  fill(F.filter((f) => ['road', 'court', 'pavilion', 'corridor', 'rock'].includes(f.kind)), 0.25, 'rgb(0,0,0)');
  fill(F.filter((f) => f.kind === 'water'), 1.5, 'rgb(0,0,0)');
  for (const f of F) if (f.kind === 'garden' || f.kind === 'botanic') gardenPath(g, P, f, 'rgb(0,0,0)', 2.3);
  for (const f of F) if (f.kind === 'field') {
    const [cx, cz] = P.toPx(f.cx, f.cz);
    g.save(); g.translate(cx, cz); g.rotate(-f.rot); if (f.hd > f.hw) g.rotate(Math.PI / 2);
    const { R, L } = trackGeom(f, P.k);
    g.lineWidth = 9.2 * P.k; g.strokeStyle = 'rgb(0,0,0)'; stadium(g, L, R - 2.9 * P.k); g.stroke();
    g.restore();
  }
  const [tx, tz] = P.toPx(0, 0);
  g.fillStyle = 'rgb(0,0,0)'; g.beginPath(); g.arc(tx, tz, 5 * P.k, 0, Math.PI * 2); g.fill();
  // soften: blades should thin out toward an edge, not stop at a cut line
  const soft = document.createElement('canvas');
  soft.width = soft.height = size;
  const sg = soft.getContext('2d');
  sg.filter = `blur(${(0.9 * P.k).toFixed(1)}px)`;
  sg.drawImage(P.c, 0, 0);
  return { ...P, c: soft, g: sg };
}

export function createGround(geo, trees, size = 2048) {
  const P = paintGround(geo, trees, size);
  const M = paintGrassMask(geo);
  const tex = new THREE.CanvasTexture(P.c);
  tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = 8; tex.minFilter = THREE.LinearMipmapLinearFilter;
  const mtex = new THREE.CanvasTexture(M.c);
  mtex.colorSpace = THREE.NoColorSpace; mtex.minFilter = THREE.LinearFilter; mtex.generateMipmaps = false;
  const span = P.span, extent = span + PAD * 2;
  const geom = new THREE.PlaneGeometry(extent, extent, 1, 1);
  geom.rotateX(-Math.PI / 2);
  geom.translate(P.x0 + span / 2, geo.frame.ground, P.z0 + span / 2);
  const uniforms = {
    uPaint: { value: tex }, uMask: { value: mtex }, uPaintO: { value: new THREE.Vector2(P.x0, P.z0) }, uPaintS: { value: span },
  };
  const mat = cel({
    name: 'ground', key: 'ground-v2', uniforms,
    fragment: {
      head: 'uniform sampler2D uPaint; uniform sampler2D uMask; uniform vec2 uPaintO; uniform float uPaintS;\n',
      albedo: /* glsl */`
vec2 puv = (vWP.xz - uPaintO) / uPaintS;
vec2 tuv = vec2(puv.x, 1.0 - puv.y);
float inside = step(0.0, puv.x) * step(puv.x, 1.0) * step(0.0, puv.y) * step(puv.y, 1.0);
vec3 paint = pow(texture2D(uPaint, tuv).rgb, vec3(2.2));
float lawn = texture2D(uMask, tuv).r * inside;
// beyond the campus: rough city ground in the haze
vec3 outside = mix(vec3(0.14, 0.22, 0.08), vec3(0.26, 0.28, 0.18), aFbm(vWP.xz * 0.02));
albedo = mix(outside, paint, inside);
// lawns: strokes combed along the wind, and the moving sheen of the gusts
vec2 wd = uWindDir;
vec2 q = vec2(dot(vWP.xz, wd), dot(vWP.xz, vec2(-wd.y, wd.x)));
float stroke = aNoise(vec2(q.x * 0.9, q.y * 3.2)) * 0.6 + aNoise(vec2(q.x * 0.25, q.y * 0.9)) * 0.4;
float gust = windField(vWP.xz);
float patchC = aFbm(vWP.xz * 0.014 + 7.0);
albedo *= mix(vec3(1.0), mix(vec3(0.9, 0.97, 1.05), vec3(1.1, 1.03, 0.82), patchC), lawn);
albedo *= mix(1.0, 0.86 + 0.26 * stroke, lawn);
albedo = mix(albedo, albedo * vec3(1.12, 1.16, 0.86) + vec3(0.012, 0.016, 0.0), lawn * gust * 0.55);
// fine grain everywhere, so no surface is a flat fill up close
albedo *= 0.95 + 0.1 * aNoise(vWP.xz * 3.1);
// weather: paving darkens when wet, lawns a little; water stands in the paving's hollows
float paving = (1.0 - lawn) * inside;
float pud = puddleAt(vWP.xz) * paving;
albedo = wetAlbedo(albedo, uWet, mix(0.4, 1.0, paving));
`,
      after: /* glsl */`
if (uWet > 0.001 || pud > 0.001) {
  vec3 V = normalize(cameraPosition - vWP);
  vec2 rip = rainRipple(vWP.xz) * (0.25 + 0.75 * pud);
  vec3 Nw = normalize(vec3(rip.x, 1.0, rip.y));
  vec3 R = reflect(-V, Nw);
  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(Nw, V), 0.0), 5.0);
  vec3 skyR = skyColor(R);
  // a wet film is a weak, broken sheen; standing water is a dark mirror
  float film = uWet * paving * (0.35 + 0.65 * aNoise(vWP.xz * 1.7));
  outCol = mix(outCol, outCol * 0.5, pud * 0.45);
  float k = max(film * fres * 0.7, pud * mix(0.3, 1.0, fres));
  outCol = mix(outCol, skyR * (0.5 + 0.5 * shadow), clamp(k, 0.0, 0.92));
  float spec = pow(max(dot(R, uSunDir), 0.0), 220.0);
  outCol += uSunGlow * spec * shadow * (pud + film * 0.5) * 2.2;
}
`,
    },
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  return { mesh, paint: P, mask: M, paintTex: tex, maskTex: mtex };
}

/** ponds: deep teal that mirrors the sky at grazing angles, with sun glints and slow ripples */
export function createWater(geo) {
  const group = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U },
    vertexShader: 'varying vec3 vWP; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: '#include <common>\nvarying vec3 vWP;\n' + WATER_FRAG,
  });
  for (const f of geo.features) {
    if (f.kind !== 'water') continue;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(f.hw * 2, f.hd * 2), mat);
    m.rotation.x = -Math.PI / 2; m.rotation.z = f.rot;
    m.position.set(f.cx, geo.frame.ground - 0.12, f.cz);
    m.userData.haizWaterId = f.id;
    group.add(m);
  }
  return group;
}

const WATER_FRAG = GLSL + /* glsl */`
void main() {
  vec3 V = normalize(cameraPosition - vWP);
  vec2 p = vWP.xz * 0.9;
  float e = 0.08;
  float h0 = aNoise(p + uTime * 0.25) + aNoise(p * 2.3 - uTime * 0.31) * 0.5;
  float hx = aNoise(p + vec2(e, 0) + uTime * 0.25) + aNoise((p + vec2(e, 0)) * 2.3 - uTime * 0.31) * 0.5;
  float hz = aNoise(p + vec2(0, e) + uTime * 0.25) + aNoise((p + vec2(0, e)) * 2.3 - uTime * 0.31) * 0.5;
  vec2 rip = rainRipple(vWP.xz);
  vec3 N = normalize(vec3((h0 - hx) * 0.3 + rip.x, 1.0, (h0 - hz) * 0.3 + rip.y));
  vec3 R = reflect(-V, N);
  vec3 sky = skyColor(R);
  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 deep = vec3(0.025, 0.1, 0.11) * (uSkyAmb + uSunColor * 0.25);
  vec3 col = mix(deep, sky, clamp(fres * 1.2, 0.0, 1.0));
  float glint = pow(max(dot(R, uSunDir), 0.0), 240.0);
  col += uSunGlow * step(0.35, glint) * 3.0;
  gl_FragColor = vec4(aerial(col, vWP), 1.0);
}`;
