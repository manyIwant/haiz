// Loads every place in the repository that states where something on the campus is.
// Read-only: nothing here writes to the sources.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const p = (rel, root) => path.join(root, rel);

export const SOURCES = {
  campus: 'assets/walk/campus.json',              // canonical: read by the walk, the chapter-04 map, life and the V3 loader
  campusJs: 'assets/walk/campus-data.js',         // generated copy for file:// (scripts/build-campus-data.cjs)
  buildings: 'data/buildings.json',               // older copy of the same model
  sports: 'data/campus-sports.json',
  places: 'lanren/life/places.js',                // doors and outdoor spots (world frame, tree at origin)
  glb: 'lanren/assets/campus-v3/architecture.glb',// Blender V3 buildings, SITE_<id> anchors in campus metres
  colliders: 'tests/fixtures/life-colliders.json',
  imagery: 'assets/cinematic/aligned/manifest.json',
  history: 'lanren/roots/history.js',
  credibility: 'data/campus-credibility.json',
  controlPoints: 'tools/campus-audit/control-points.json'
};

/**
 * Sources an acceptance-level audit cannot do without. If one is missing the audit reports an
 * error (fail closed) unless it is run with { allowIncomplete: true }, which marks the whole
 * result INCOMPLETE. The rest only add cross-checks.
 */
export const REQUIRED = ['campus', 'campusJs', 'buildings', 'sports', 'places', 'glb', 'imagery', 'controlPoints', 'credibility'];
export const OPTIONAL = ['colliders', 'history'];

export function readJson(rel, root = ROOT) {
  return JSON.parse(fs.readFileSync(p(rel, root), 'utf8'));
}
export const exists = (rel, root = ROOT) => fs.existsSync(p(rel, root));

/** window.CAMPUS_DATA = {...}; → object */
export function readCampusJs(rel, root = ROOT) {
  const src = fs.readFileSync(p(rel, root), 'utf8');
  const i = src.indexOf('=');
  return JSON.parse(src.slice(i + 1).trim().replace(/;\s*$/, ''));
}

/** The JSON chunk of a binary glTF: node names and translations, no mesh decoding. */
export function readGlbNodes(rel, root = ROOT) {
  const buf = fs.readFileSync(p(rel, root));
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(rel + ' is not a GLB');
  const len = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + len).toString('utf8'));
  return (json.nodes || []).map((n) => {
    const q = n.rotation || [0, 0, 0, 1];
    // yaw about +Y from a unit quaternion (x, y, z, w); exact when the rotation is a pure yaw
    const yaw = 2 * Math.atan2(q[1], q[3]);
    return { name: n.name || '', t: n.translation || [0, 0, 0], yaw, scale: n.scale || [1, 1, 1] };
  });
}

export async function importModule(rel, root = ROOT) {
  return import(pathToFileURL(p(rel, root)).href);
}

/** Everything, keyed by source; a missing optional source becomes null with a note. */
export async function loadAll(root = ROOT) {
  const out = { root, missing: [] };
  const opt = async (key, fn) => {
    try { out[key] = await fn(); } catch (e) { out[key] = null; out.missing.push({ key, source: SOURCES[key], required: REQUIRED.includes(key), error: String(e.message || e) }); }
  };
  await opt('campus', () => readJson(SOURCES.campus, root));
  await opt('campusJs', () => readCampusJs(SOURCES.campusJs, root));
  await opt('buildings', () => readJson(SOURCES.buildings, root));
  await opt('sports', () => readJson(SOURCES.sports, root));
  await opt('places', () => importModule(SOURCES.places, root));
  await opt('glb', () => readGlbNodes(SOURCES.glb, root));
  await opt('colliders', () => readJson(SOURCES.colliders, root));
  await opt('imagery', () => {
    const m = readJson(SOURCES.imagery, root);
    // the manifest is useless without the imagery it describes
    for (const l of m.layers || []) if (!exists(l.path, root)) throw new Error('imagery layer file missing: ' + l.path);
    return m;
  });
  await opt('history', () => importModule(SOURCES.history, root));
  await opt('credibility', () => readJson(SOURCES.credibility, root));
  await opt('controlPoints', () => readJson(SOURCES.controlPoints, root));
  return out;
}
