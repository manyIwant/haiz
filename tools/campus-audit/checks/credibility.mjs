// Is every spatial statement tagged, and does nothing pretend to be measured?
import fs from 'node:fs';
import path from 'node:path';
import { finding } from '../lib/model.mjs';

const C = 'credibility';
const SURVEY_EXT = /\.(kml|gpx|geojson|json|csv|txt|dxf|dwg|las|laz|e57|ply)$/i;
export const SURVEY_META = ['method', 'date', 'surveyor', 'accuracy'];

/**
 * Does the file look like real survey data? Text formats must contain parseable coordinates;
 * binary point-cloud / CAD formats must carry their format signature. An empty '{}' is not survey data.
 */
export function validateSurveyFile(file) {
  if (!fs.existsSync(file)) return { ok: false, why: 'file does not exist' };
  const buf = fs.readFileSync(file);
  if (buf.length < 16) return { ok: false, why: 'file is (nearly) empty' };
  const ext = path.extname(file).toLowerCase();
  const head = buf.subarray(0, 16).toString('latin1');
  const num = (v) => typeof v === 'number' && Number.isFinite(v);
  const coordsOk = (c) => Array.isArray(c) && (c.length >= 2 && num(c[0]) && num(c[1]) || c.some(coordsOk));
  switch (ext) {
    case '.geojson': case '.json': {
      let j; try { j = JSON.parse(buf.toString('utf8')); } catch (e) { return { ok: false, why: 'not valid JSON' }; }
      const feats = j.type === 'FeatureCollection' ? j.features || [] : j.type === 'Feature' ? [j] : [];
      const good = feats.filter((f) => f.geometry && coordsOk(f.geometry.coordinates));
      return good.length ? { ok: true, n: good.length } : { ok: false, why: 'no GeoJSON feature with numeric coordinates' };
    }
    case '.kml': {
      const m = buf.toString('utf8').match(/<coordinates>\s*([-\d.]+,[-\d.]+)/);
      return m ? { ok: true } : { ok: false, why: 'no <coordinates> with numeric pairs' };
    }
    case '.gpx': return /<(trkpt|wpt|rtept)\s+lat="-?\d/.test(buf.toString('utf8')) ? { ok: true } : { ok: false, why: 'no GPX points' };
    case '.csv': case '.txt': {
      const rows = buf.toString('utf8').split(/\r?\n/).filter((l) => (l.split(/[,;\t ]+/).filter((x) => x !== '' && Number.isFinite(Number(x)))).length >= 2);
      return rows.length >= 2 ? { ok: true, n: rows.length } : { ok: false, why: 'fewer than two rows with two or more numeric columns' };
    }
    case '.dxf': { const t = buf.toString('latin1'); return /SECTION/.test(t) && /ENTITIES/.test(t) ? { ok: true } : { ok: false, why: 'no DXF SECTION / ENTITIES' }; }
    case '.dwg': return /^AC10\d\d/.test(head) ? { ok: true } : { ok: false, why: 'no DWG signature' };
    case '.las': case '.laz': return head.startsWith('LASF') ? { ok: true } : { ok: false, why: 'no LASF signature' };
    case '.e57': return head.startsWith('ASTM-E57') ? { ok: true } : { ok: false, why: 'no E57 signature' };
    case '.ply': return head.startsWith('ply') ? { ok: true } : { ok: false, why: 'no PLY header' };
    default: return { ok: false, why: 'unsupported format' };
  }
}

const TAGS = ['surveyed', 'public-map', 'estimated', 'invented', 'documented'];

/** Which defaults block applies to a campus feature. */
export function classOf(b) {
  if (b.form === 'corr') return 'corridor';
  if (['garden', 'botanic', 'field', 'pond', 'pavilion', 'oldtree', 'rock'].includes(b.form)) return 'landscape';
  return 'building';
}

/** Expand defaults + items over every feature: rows of { id, name, class, aspect, tag, basis, sources }. */
export function expand(cred, campus, places) {
  const rows = [];
  const push = (id, name, cls) => {
    const d = cred.defaults[cls] || {}, o = cred.items[id] || {};
    for (const aspect of new Set([...Object.keys(d), ...Object.keys(o)])) {
      const e = { ...(d[aspect] || {}), ...(o[aspect] || {}) };
      rows.push({ id, name, class: cls, aspect, tag: e.tag, basis: e.basis, sources: e.sources || [], survey: e.survey, override: !!o[aspect] });
    }
  };
  for (const b of campus.buildings) push(b.id, b.name, classOf(b));
  for (const r of campus.roads || []) push(r.id, r.id, 'road');
  for (const s of campus.sports || []) push(s.id, s.name, 'court');
  // one row per tree point, so an individual point can be overridden (items["tree-12"]) and traced
  (campus.trees || []).forEach((t, i) => push(`tree-${i}`, `${t.t} tree #${i}`, 'tree'));
  if (places?.PLACES) push('doors', `${Object.values(places.PLACES).reduce((n, p) => n + p.doors.length, 0)} doors (lanren/life/places.js)`, 'door');
  if (places?.SPOTS) push('spots', `${Object.keys(places.SPOTS).length} outdoor spots`, 'spot');
  push('views', `${(campus.views || []).length} camera views`, 'view');
  for (const [id, o] of Object.entries(cred.items)) if (!rows.some((r) => r.id === id)) for (const [aspect, e] of Object.entries(o)) rows.push({ id, name: id, class: 'tour-only', aspect, tag: e.tag, basis: e.basis, sources: e.sources || [], override: true });
  for (const [aspect, e] of Object.entries(cred.global || {})) rows.push({ id: 'campus', name: 'whole campus', class: 'global', aspect, tag: e.tag, basis: e.basis, sources: e.sources || [], override: false });
  return rows;
}

// Words that claim measurement. A hit is fine when the same sentence also says it is NOT measured.
const CLAIM = /实测|测绘|surveyed|measured/i;
const NEGATED = /(不是|并非|非|未|没有|不能|不承诺|不声称|尚未|待|not|never|no |interpreted|approximate|近似|推演|缺失|missing|unverified)/i;
// Files that carry campus geometry or describe it to visitors
const CLAIM_FILES = [
  'assets/walk/campus.json', 'data/buildings.json', 'data/campus-sports.json', 'data/architecture.json',
  'lanren/life/places.js', 'lanren/map/geo.js', 'assets/walk/world.js', 'assets/js/three-campus.js',
  'campus-3d.html', 'campus-stroll.html', 'campus-stroll-v2.html', 'index.html', 'README.md', 'START-HERE.md'
];

export function lintClaims(root) {
  const hits = [];
  for (const rel of CLAIM_FILES) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    // split into sentence-ish chunks so a single negation nearby counts
    const re = /[^。；;.\n"]{0,160}(实测|测绘|surveyed|measured)[^。；;.\n"]{0,120}/gi;
    let m;
    while ((m = re.exec(text))) {
      const s = m[0].trim();
      if (NEGATED.test(s)) continue;
      if (/实测\s*\d/.test(s)) continue; // a counted test result ("实测 300 棵中 61 棵"), not a spatial claim
      const line = text.slice(0, m.index).split('\n').length;
      hits.push({ file: rel, line, text: s.slice(0, 200) });
    }
  }
  // de-duplicate identical sentences in the same file (copies of the same note)
  const seen = new Set();
  return hits.filter((h) => { const k = h.file + h.text; if (seen.has(k)) return false; seen.add(k); return true; });
}

export function run(S) {
  const out = [];
  const cred = S.credibility;
  if (!cred) return { rows: [], findings: [finding(C, 'error', 'data/campus-credibility.json', 'credibility annotations missing')] };
  const rows = expand(cred, S.campus, S.places);
  const bad = rows.filter((r) => !TAGS.includes(r.tag));
  for (const r of bad) out.push(finding(C, 'error', `${r.id}.${r.aspect}`, `unknown or missing tag '${r.tag}'`));
  // the one hard rule: "surveyed" needs a raw survey file in the repo that parses as survey data,
  // plus survey metadata (method, date, surveyor, accuracy) on the statement itself
  for (const r of rows.filter((x) => x.tag === 'surveyed')) {
    const subject = `${r.id}.${r.aspect}`;
    const cited = (r.sources || []).map((s) => s.split('#')[0]).filter((f) => SURVEY_EXT.test(f));
    if (!cited.length) { out.push(finding(C, 'error', subject, 'tagged surveyed but no raw survey file (kml/gpx/geojson/csv/dxf/las…) is cited; tag it estimated or public-map until the measurement is committed')); continue; }
    const valid = [];
    for (const f of cited) {
      const v = validateSurveyFile(path.join(S.root, f));
      if (v.ok) valid.push(f); else out.push(finding(C, 'error', subject, `cited survey file ${f} is not usable survey data: ${v.why}`));
    }
    const missingMeta = SURVEY_META.filter((k) => !(r.survey && String(r.survey[k] || '').trim()));
    if (missingMeta.length) out.push(finding(C, 'error', subject, `tagged surveyed without survey metadata: ${missingMeta.join(', ')} (add "survey": {method, date, surveyor, accuracy})`));
    else if (valid.length) out.push(finding(C, 'pass', subject, `surveyed: ${valid.join(', ')} · ${r.survey.method}, ${r.survey.date}, ±${r.survey.accuracy}`));
  }
  for (const r of rows) for (const s of r.sources) {
    const f = s.split('#')[0];
    if (!/^https?:/.test(f) && !fs.existsSync(path.join(S.root, f))) out.push(finding(C, 'warn', `${r.id}.${r.aspect}`, `cited source ${f} does not exist`));
  }
  const nTrees = (S.campus.trees || []).length;
  const unknownItems = Object.keys(cred.items).filter((id) => !(/^tree-(\d+)$/.test(id) && Number(id.slice(5)) < nTrees) && !S.campus.buildings.some((b) => b.id === id) && !(S.campus.sports || []).some((s) => s.id === id) && !(S.campus.tour || []).some((t) => t.id === id));
  for (const id of unknownItems) out.push(finding(C, 'warn', id, 'credibility item names nothing in campus data or the tour'));
  const count = {};
  for (const r of rows) count[r.tag] = (count[r.tag] || 0) + 1;
  if (!bad.length) out.push(finding(C, 'pass', 'coverage', `${rows.length} statements tagged across ${new Set(rows.map((r) => r.id)).size} subjects: ${TAGS.map((t) => `${t} ${count[t] || 0}`).join(', ')}`));
  if (!count.surveyed) out.push(finding(C, 'info', 'surveyed', 'no statement is tagged surveyed: the repository holds no raw survey data (the legacy KML no_project2.xml and its conversion script are missing)'));

  // history chapter grades (already graded at source; summarised here)
  let history = null;
  if (S.history?.NODES || S.history?.default) {
    const nodes = S.history.NODES || S.history.default;
    history = {};
    for (const n of nodes) history[n.grade] = (history[n.grade] || 0) + 1;
  }
  // claims lint
  const claims = lintClaims(S.root);
  for (const h of claims) out.push(finding(C, 'warn', `${h.file}:${h.line}`, `wording claims measurement without qualification: “${h.text}”`));
  if (!claims.length) out.push(finding(C, 'pass', 'wording', 'no unqualified measurement claims found in campus data and visitor pages'));
  out.push(finding(C, 'info', 'scope', 'tags describe the evidence behind each statement; a tag is not an accuracy figure. Tree points are tagged one by one, but all 300 share the same invented basis: no individual tree has been traced to a real tree'));
  return { rows, count, history, claims, treeCount: (S.campus.trees || []).length, findings: out };
}
