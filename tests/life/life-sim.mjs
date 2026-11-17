// dev: print where everyone is through a day, check positions are walkable and continuous
import fs from 'fs';
import { buildGeo } from '../../lanren/map/geo.js';
import { buildNav } from '../../lanren/life/nav.js';
import { createLife } from '../../lanren/life/life.js';
const campus = JSON.parse(fs.readFileSync(new URL('../../assets/walk/campus.json', import.meta.url)));
const col = JSON.parse(fs.readFileSync(new URL('../fixtures/life-colliders.json', import.meta.url)));
const geo = buildGeo(campus, null, { rotation: 0 });
const nav = buildNav({ colliders: col, features: geo.features, bounds: { x0: -300, x1: 200, z0: -140, z1: 300 } });
let raining = false;
const life = createLife({ nav, isRaining: () => raining });
const day0 = Date.UTC(2026, 10, 17) - 8 * 3600000;    // Tue 17 Nov 2026, 00:00 Haikou
const t0 = performance.now();
let prev = {}, maxJump = {}, blocked = {}, outdoorsMin = {};
for (let h = 6; h < 23; h += 1 / 120) {                 // every 30 s
  if (process.argv.includes('--rain')) raining = h > 12.6 && h < 15.2;
  const ms = day0 + h * 3600000;
  life.update(ms);
  for (const a of life.agents) {
    const s = a.state, p = prev[a.id];
    if (p && !s.inside && !s.away && !p.inside && !p.away) maxJump[a.id] = Math.max(maxJump[a.id] || 0, Math.hypot(s.x - p.x, s.z - p.z) / 30);
    if (!s.inside && !s.away && !nav.isFree(s.x, s.z) && s.act !== 'laps') blocked[a.id] = (blocked[a.id] || 0) + 1;
    if (!s.inside && !s.away) outdoorsMin[a.id] = (outdoorsMin[a.id] || 0) + 0.5;
    prev[a.id] = s;
  }
  if (Math.abs(h * 4 - Math.round(h * 4)) < 1e-6 && process.argv.includes('-v')) {
    console.log(String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.round((h % 1) * 60) % 60).padStart(2, '0'), life.agents.map((a) => `${a.person.name}:${a.state.inside ? '[' + a.state.label + ']' : a.state.away ? '—' : a.state.moving ? '→' + a.state.toLabel : a.state.label + '·' + a.state.what}`).join('  '));
  }
}
console.log('sim ms', (performance.now() - t0).toFixed(0));
for (const a of life.agents) console.log(a.person.name.padEnd(4), 'max speed', (maxJump[a.id] || 0).toFixed(2), 'm/s', 'off-grid samples', blocked[a.id] || 0, 'outdoors', (outdoorsMin[a.id] || 0).toFixed(0), 'min');
