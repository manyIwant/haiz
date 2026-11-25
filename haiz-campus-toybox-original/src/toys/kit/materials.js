// HAIZ Campus Toybox — material library.
// One vocabulary of physically based "craft" materials shared by every toy, so that six
// very different characters still feel like they came out of the same atelier.
import * as THREE from 'three';
import { feltNormal, plushNormal, wovenNormal } from './textures.js';

const lighten = (hex, amt) => new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), amt);

/**
 * Pressed wool felt. Sheen gives the soft rim-glow fabric has at grazing angles —
 * the single most important cue that makes a 3D shape read as "touchable".
 */
export function felt(color, o = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    name: o.name || 'felt',
    color: new THREE.Color(color),
    roughness: o.roughness ?? 0.9,
    metalness: 0,
    sheen: o.sheen ?? 1,
    sheenRoughness: o.sheenRoughness ?? 0.55,
    sheenColor: o.sheenColor ? new THREE.Color(o.sheenColor) : lighten(color, 0.55),
    normalMap: feltNormal(),
    normalScale: new THREE.Vector2(o.normal ?? 0.45, o.normal ?? 0.45),
    vertexColors: !!o.vertexColors,
    side: o.side ?? THREE.FrontSide,
  });
  return m;
}

/** Short-pile minky plush — used for fur. */
export function plush(color, o = {}) {
  return new THREE.MeshPhysicalMaterial({
    name: o.name || 'plush',
    color: new THREE.Color(color),
    roughness: o.roughness ?? 0.95,
    sheen: o.sheen ?? 1,
    sheenRoughness: o.sheenRoughness ?? 0.4,
    sheenColor: o.sheenColor ? new THREE.Color(o.sheenColor) : lighten(color, 0.7),
    normalMap: plushNormal(),
    normalScale: new THREE.Vector2(o.normal ?? 0.6, o.normal ?? 0.6),
    vertexColors: !!o.vertexColors,
  });
}

/** Cotton canvas (schoolbag, uniform). */
export function canvasCloth(color, o = {}) {
  return new THREE.MeshPhysicalMaterial({
    name: o.name || 'canvas',
    color: new THREE.Color(color),
    roughness: 0.85,
    sheen: 0.5,
    sheenRoughness: 0.7,
    sheenColor: lighten(color, 0.4),
    normalMap: wovenNormal(),
    normalScale: new THREE.Vector2(o.normal ?? 0.5, o.normal ?? 0.5),
    vertexColors: !!o.vertexColors,
  });
}

/** Embroidery / sewing thread. */
export function thread(color = '#3a2a22', o = {}) {
  return new THREE.MeshStandardMaterial({ name: o.name || 'thread', color: new THREE.Color(color), roughness: 0.7 });
}

/** Glossy safety-eye bead. */
export function bead(color = '#1d1512', o = {}) {
  return new THREE.MeshPhysicalMaterial({
    name: o.name || 'bead',
    color: new THREE.Color(color),
    roughness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    metalness: 0,
  });
}

/** Tiny catch-light painted on the bead (keeps eyes alive under any light). */
export function catchLight() {
  return new THREE.MeshBasicMaterial({ name: 'catchlight', color: new THREE.Color('#fffaf0'), toneMapped: false });
}

/** Frosted soft-vinyl / sea-glass resin. */
export function seaGlass(color, o = {}) {
  return new THREE.MeshPhysicalMaterial({
    name: o.name || 'seaglass',
    color: new THREE.Color(color),
    roughness: o.roughness ?? 0.32,
    metalness: 0,
    transmission: o.transmission ?? 0,
    thickness: 0.02,
    transparent: true,
    opacity: o.opacity ?? 0.82,
    clearcoat: 0.8,
    clearcoatRoughness: 0.25,
    sheen: 0.3,
    sheenColor: lighten(color, 0.8),
    emissive: new THREE.Color(o.emissive || color).multiplyScalar(o.emissiveIntensity ?? 0.12),
    depthWrite: o.depthWrite ?? true,
    side: o.side ?? THREE.FrontSide,
  });
}

/** Lacquered wood (toy hardware, stems, buttons). */
export function lacquer(color, o = {}) {
  return new THREE.MeshPhysicalMaterial({
    name: o.name || 'lacquer',
    color: new THREE.Color(color),
    roughness: o.roughness ?? 0.42,
    clearcoat: o.clearcoat ?? 0.6,
    clearcoatRoughness: 0.3,
    map: o.map || null,
  });
}

/** Brushed brass. */
export function brass(o = {}) {
  return new THREE.MeshStandardMaterial({
    name: o.name || 'brass',
    color: new THREE.Color(o.color || '#c9a35c'),
    metalness: 1,
    roughness: o.roughness ?? 0.32,
  });
}
