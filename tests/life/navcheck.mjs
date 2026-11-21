// quick reachability survey (dev): every door and spot from the tree, with a PNG of the grid and routes
import fs from 'fs';
import { buildGeo } from '../../lanren/map/geo.js';
import { buildNav } from '../../lanren/life/nav.js';
import { PLACES, SPOTS, placePoint } from '../../lanren/life/places.js';
const campus = JSON.parse(fs.readFileSync(new URL('../../assets/walk/campus.json', import.meta.url)));
const col = JSON.parse(fs.readFileSync(new URL('../fixtures/life-colliders.json', import.meta.url)));
const geo = buildGeo(campus, null, { rotation: 0 });
const t0 = performance.now();
const nav = buildNav({ colliders: col, features: geo.features, bounds: { x0: -300, x1: 200, z0: -140, z1: 300 } });
console.log('nav', nav.nx, 'x', nav.nz, (performance.now() - t0).toFixed(0), 'ms');
const keys = [...Object.keys(PLACES).flatMap((k) => PLACES[k].doors.map((_, i) => [k, i])), ...Object.keys(SPOTS).map((k) => [k, 0])];
let bad = 0;
const routes = [];
for (const [k, i] of keys) {
  const p = placePoint(k, i);
  const s = nav.snap(p.x, p.z, 3);
  const r = nav.path(-1.5, -8.2, p.x, p.z);
  const ok = s && r;
  if (!ok) bad++;
  if (r) routes.push(r.points);
  console.log(ok ? 'ok ' : 'BAD', (k + '#' + i).padEnd(16), p.label.padEnd(10), s ? `snap ${Math.hypot(s.x - p.x, s.z - p.z).toFixed(1)}m` : 'no-snap', r ? `${r.length.toFixed(0)} m, ${r.points.length} pts` : '');
}
console.log(bad ? `${bad} unreachable` : 'all reachable');
if (process.argv[2]) {
  const { createCanvas } = await import(process.argv[2]);
  const c = createCanvas(nav.nx, nav.nz), g = c.getContext('2d'); const img = g.createImageData(nav.nx, nav.nz);
  const C = { open: [205, 203, 192], road: [150, 150, 150], court: [160, 170, 190], field: [170, 190, 160], corridor: [210, 170, 120], pavilion: [210, 170, 120], gate: [120, 120, 120], garden: [160, 196, 150], botanic: [130, 178, 128], water: [90, 130, 190] };
  for (let k = 0; k < nav.nx * nav.nz; k++) img.data.set([...(nav.solid[k] ? [40, 40, 40] : C[nav.SURF[nav.surf[k]]]), 255], k * 4);
  g.putImageData(img, 0, 0);
  g.strokeStyle = '#d0302b'; g.lineWidth = 1;
  for (const pts of routes) { g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q.x - nav.x0, q.z - nav.z0) : g.moveTo(q.x - nav.x0, q.z - nav.z0))); g.stroke(); }
  fs.writeFileSync(process.argv[3], c.toBuffer('image/png'));
}
