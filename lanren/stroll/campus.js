// The buildings, V2: the same Blender V3 model (geometry, anchors, colliders, decks untouched —
// the school's identity and layout stay as surveyed in the project), dressed so it belongs to the
// painted world instead of standing in it as an untextured model.
//
//   walls     painted large-scale tone variation; a darker, warmer band at the foot (bounce light
//             and grime) and contact occlusion where wall meets paving; faint rain streaks under
//             the eaves; the shade side turns lavender-blue through the shared light
//   big planes  storey joints every 3.6 m and faint panel joints give blank walls a human scale
//   glass     every pane is its own: some show a curtain, some a dark room, reflections vary in
//             strength, only a few carry the painted highlight streak; all mirror the shared sky
//   roofs     terracotta with tile courses; green glazed trims a shade lighter than V1
import * as THREE from 'three';
import { buildCampus } from '../map/campus3d.js';
import { loadCampusV3 } from '../map/campus-v3.js';
import { cel } from './atmos.js';

const LOOK = {
  'Wall': { tint: '#f0e6d2', simplify: 0.62, wall: 1 },
  'Concrete': { tint: '#d3cab7', simplify: 0.66, wall: 1, joints: 1 },
  'Granite': { tint: '#cbc4b5', simplify: 0.55, wall: 1 },
  'Facade stone': { color: '#aca592', wall: 1, joints: 1 },
  'Aluminum': { color: '#aeb6b2' },
  'Interior': { color: '#26302f' },
  'Terracotta': { color: '#b65a3d', tiles: 1 },
  'Jade': { color: '#4c8f70' },
  'Gold': { color: '#c99a48' },
  'Roof membrane': { color: '#8b938c' },
  'Red timber': { color: '#a8452f' },
};

const WALL = /* glsl */`
{
  float hgt = vWP.y - uGroundY;
  float vertical = 1.0 - abs(N.y);
  float big = aFbm(vWP.xz * 0.025 + vec2(vWP.y * 0.04));
  albedo *= 0.93 + 0.13 * big;
  albedo *= mix(0.84, 1.0, smoothstep(0.0, 0.7, hgt));
  albedo = mix(albedo * vec3(1.03, 0.97, 0.9), albedo, smoothstep(0.0, 0.9, hgt));
  float along = dot(vWP.xz, normalize(vec2(-N.z, N.x) + 1e-4));
  float streak = aNoise(vec2(along * 1.7, vWP.y * 0.09));
  albedo *= 1.0 - vertical * 0.07 * smoothstep(0.6, 0.92, streak) * smoothstep(1.5, 6.0, hgt);
  ao = mix(0.75, 1.0, smoothstep(0.0, 1.2, hgt));
#ifdef JOINTS
  float fl = abs(fract(hgt / 3.6 + 0.02) - 0.5);
  albedo *= 1.0 - vertical * 0.055 * (1.0 - smoothstep(0.475, 0.49, fl));
#endif
  wallBounce = vertical * (1.0 - smoothstep(0.0, 10.0, hgt));
}
`;
const TILES = /* glsl */`
{
  float course = abs(fract((vWP.y - uGroundY) * 3.2) - 0.5);
  albedo *= 0.92 + 0.08 * smoothstep(0.35, 0.5, course);
  albedo *= 0.92 + 0.14 * aNoise(vWP.xz * 0.4);
}
`;
const GLASS = /* glsl */`
{
  vec3 V = normalize(cameraPosition - vWP);
  float hgt = vWP.y - uGroundY;
  vec2 tng = normalize(vec2(-N.z, N.x) + 1e-4);
  float along = dot(vWP.xz, tng);
  vec2 pane = vec2(floor(along / 1.75), floor(hgt / 3.6));
  float h1 = aHash(pane + 11.3), h2 = aHash(pane * 1.7 + 3.1), h3 = aHash(pane * 2.3 + 7.7);
  vec3 R = reflect(-V, N);
  vec3 sky = skyColor(R);
  if (R.y < 0.0) sky = mix(uGroundAmb * 0.9, uHorizon * 0.8, 0.35);
  float fres = 0.16 + 0.84 * pow(1.0 - max(dot(N, V), 0.0), 3.0);
  // the room behind the glass: dark, or a curtain catching daylight
  vec3 room = vec3(0.04, 0.065, 0.075) * (uSkyAmb + 0.15);
  vec3 cc = h3 < 0.3 ? vec3(0.78, 0.76, 0.68) : h3 < 0.55 ? vec3(0.5, 0.64, 0.7) : h3 < 0.75 ? vec3(0.62, 0.7, 0.55) : vec3(0.76, 0.66, 0.52);
  vec3 curtain = cc * (uSkyAmb * 0.6 + uSunColor * 0.14);
  float hasCurtain = step(0.52, h1);
  float curtainH = mix(0.35, 0.95, h2);
  float py = fract(hgt / 3.6);
  room = mix(room, curtain, hasCurtain * step(1.0 - curtainH, py));
  float refl = mix(0.6, 1.0, h2) * (1.0 - 0.45 * step(0.88, h3));
  vec3 g = mix(room, sky, clamp(fres * refl, 0.0, 1.0));
  // a painted highlight streak on some panes only
  float d = (along + hgt * 0.8) * 0.9 + h1 * 3.0;
  float streak = smoothstep(0.86, 0.9, fract(d * 0.25)) * (1.0 - smoothstep(0.9, 0.95, fract(d * 0.25)));
  g += sky * streak * 0.5 * step(0.62, h2);
  float spec = pow(max(dot(R, uSunDir), 0.0), 140.0);
  g += uSunGlow * step(0.3, spec) * 2.2 * shadow;
  outCol = g;
}
`;

// light bounced up from sunlit paving and lawns warms the lower walls, most visibly in shade
const BOUNCE = 'outCol += albedo * uGroundAmb * uSunColor * 0.22 * wallBounce * max(uSunDir.y, 0.2);\n';

function makeLook(src) {
  const name = src.name || '';
  if (/glass/i.test(name)) return cel({ name: 'glass', key: 'glass-v2', fragment: { after: GLASS } });
  const look = LOOK[name] || { color: '#' + (src.color?.getHexString?.() || 'cccccc') };
  const defines = look.joints ? { JOINTS: '' } : undefined;
  const albedo = (look.wall ? 'float wallBounce = 0.0;\n' + WALL : '') + (look.tiles ? TILES : '');
  const after = look.wall ? BOUNCE : '';
  if (src.map && look.tint) {
    const m = cel({ name: 'campus-' + name, key: 'campus-tex-' + (look.joints ? 'j' : ''), map: src.map, color: new THREE.Color(look.tint), defines,
      fragment: { head: 'uniform float uSimplify; uniform vec3 uMean;\n', albedo: `albedo = mix(albedo, uMean * diffuse, uSimplify);\n${albedo}`, after },
      uniforms: { uSimplify: { value: look.simplify }, uMean: { value: new THREE.Vector3(...meanOf(src.map)) } } });
    m.map.colorSpace = THREE.SRGBColorSpace;
    return m;
  }
  return cel({ name: 'campus-' + name, key: 'campus-' + name, color: new THREE.Color(look.color || look.tint), defines, fragment: { albedo, after } });
}

function meanOf(texture) {
  const img = texture?.image;
  if (!img || !img.width) return [0.5, 0.5, 0.5];
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const g = c.getContext('2d');
  try { g.drawImage(img, 0, 0, 16, 16); } catch { return [0.5, 0.5, 0.5]; }
  const d = g.getImageData(0, 0, 16, 16).data;
  let r = 0, gg = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
  const n = d.length / 4, lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return [lin(r / n), lin(gg / n), lin(b / n)];
}

export async function createCampus(geo, model = buildCampus(geo.campus, geo.frame)) {
  const v3 = await loadCampusV3(geo, model.buildings);
  const cache = new Map();
  let tris = 0;
  v3.scene.traverse((o) => {
    if (!o.isMesh) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    const next = list.map((m) => {
      const key = (m.name || '') + (m.map ? ':' + m.map.uuid : '');
      if (!cache.has(key)) cache.set(key, makeLook(m));
      return cache.get(key);
    });
    o.material = Array.isArray(o.material) ? next : next[0];
    o.castShadow = true; o.receiveShadow = true;
    tris += (o.geometry.index ? o.geometry.index.count : o.geometry.getAttribute('position').count) / 3;
  });
  const decks = v3.decks;
  const heightAt = (x, z) => {
    let y = geo.frame.ground + 0.02;
    for (const deck of decks) {
      const dx = x - deck.cx, dz = z - deck.cz;
      if (Math.abs(dx * deck.c - dz * deck.s) <= deck.hw && Math.abs(dx * deck.s + dz * deck.c) <= deck.hd) y = Math.max(y, deck.y);
    }
    return y;
  };
  return { scene: v3.scene, hulls: v3.hulls, decks, heightAt, buildings: model.buildings, tris: Math.round(tris), materials: cache.size };
}
