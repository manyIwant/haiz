// The campus buildings in the stylized walk: the same Blender V3 model the six chapters and the
// first-person walk use (lanren/assets/campus-v3/architecture.glb, loaded and anchored by
// lanren/map/campus-v3.js), re-dressed. Painted backgrounds simplify surfaces to a few clean values
// and let the light do the work, so each of the model's twelve materials becomes a cel material
// with an anime-bright base colour; textured walls keep a little of their texture (pulled toward
// its mean colour); glass mirrors the painted sky with the diagonal highlight streaks of
// background art. Geometry, anchors, colliders and walkable decks are untouched.
import * as THREE from 'three';
import { buildCampus } from '../map/campus3d.js';
import { loadCampusV3 } from '../map/campus-v3.js';
import { toonMaterial, textureMean } from './toon.js';
import { SKY } from './sky.js';

// name → base colour (sRGB) and how much of an existing texture survives (simplify: 0 = all)
const LOOK = {
  'Wall': { tint: '#f3ecdc', simplify: 0.6 },
  'Concrete': { tint: '#e2ddd0', simplify: 0.65 },
  'Granite': { tint: '#cfc9bd', simplify: 0.55 },
  'Facade stone': { color: '#8e9b92' },
  'Aluminum': { color: '#aeb8b4' },
  'Interior': { color: '#2c3a3c' },
  'Terracotta': { color: '#c0583a' },
  'Jade': { color: '#3f8a6a' },
  'Gold': { color: '#d6a54a' },
  'Roof membrane': { color: '#7f8c86' },
  'Red timber': { color: '#b2412c' },
};

const GLASS_FRAG = /* glsl */`
{
  vec3 V = normalize(cameraPosition - vToonWP);
  vec3 R = reflect(-V, toonN);
  float t = pow(clamp(R.y, 0.0, 1.0), 0.45);
  vec3 sky = mix(uFogColor * 1.02, uZenith, t);
  if (R.y < 0.0) sky = mix(uGroundAmb * 0.9, uFogColor, 0.35);
  float fres = 0.18 + 0.82 * pow(1.0 - max(dot(toonN, V), 0.0), 3.0);
  vec3 inside = vec3(0.05, 0.08, 0.09) * (uSkyAmb + 0.2);
  // painted glass: two diagonal highlight streaks sliding over each pane
  float d = (vToonWP.x + vToonWP.z) * 0.35 + vToonWP.y * 0.55;
  float streak = smoothstep(0.86, 0.9, fract(d * 0.25)) * (1.0 - smoothstep(0.9, 0.96, fract(d * 0.25)));
  streak += 0.6 * smoothstep(0.7, 0.72, fract(d * 0.25 + 0.31)) * (1.0 - smoothstep(0.72, 0.75, fract(d * 0.25 + 0.31)));
  vec3 g = mix(inside, sky, fres);
  g += sky * streak * 0.55;
  float sunSpec = pow(max(dot(R, uSunDir), 0.0), 120.0);
  g += uFogSun * step(0.3, sunSpec) * 2.5 * toonShadow;
  toonOut = g;
}
`;

function makeLook(src) {
  const name = src.name || '';
  if (/glass/i.test(name)) {
    return toonMaterial({ name: 'glass', key: 'glass', uniforms: { uZenith: SKY.uZenith },
      fragment: { head: 'uniform vec3 uZenith;\n', after: GLASS_FRAG } });
  }
  const look = LOOK[name] || { color: '#' + (src.color?.getHexString?.() || 'cccccc') };
  if (src.map && look.tint) {
    const mean = textureMean(src.map);
    const m = toonMaterial({ name: 'campus-' + name, key: 'campus-tex', map: src.map, color: new THREE.Color(look.tint), simplify: look.simplify, mean });
    m.map.colorSpace = THREE.SRGBColorSpace;
    return m;
  }
  return toonMaterial({ name: 'campus-' + name, key: 'campus', color: new THREE.Color(look.color || look.tint) });
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
    o.castShadow = true;
    o.receiveShadow = true;
    tris += (o.geometry.index ? o.geometry.index.count : o.geometry.getAttribute('position').count) / 3;
  });
  // walkable deck heights (covered walkways and pavilions), as in lanren/map/section.js walkHeight
  const decks = v3.decks;
  const heightAt = (x, z) => {
    let y = geo.frame.ground + 0.02;
    for (const deck of decks) {
      const dx = x - deck.cx, dz = z - deck.cz;
      if (Math.abs(dx * deck.c - dz * deck.s) <= deck.hw && Math.abs(dx * deck.s + dz * deck.c) <= deck.hd) y = Math.max(y, deck.y);
    }
    return y;
  };
  return { scene: v3.scene, hulls: v3.hulls, decks, heightAt, buildings: model.buildings, entries: v3.entries, tris: Math.round(tris), materials: cache.size };
}
