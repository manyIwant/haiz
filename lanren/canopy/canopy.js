// Chapter 03 · 青春 · 生长 — the works canopy.
//
// One world, one renderer, one tree. Like chapter 04's map (lanren/map/map.js), this
// module borrows V4's camera and input only while the visitor is inside it:
//
//   shot     V4 as it was: the details shot of new leaves. Scrolling passes straight on
//            to 04; nothing here takes over unless asked.
//   enter    the leaves in front of the lens part, the camera draws back along the real
//            limb they grow on, and the crown comes into full leaf. ~2 s.
//   canopy   explore. The camera circles the crown at leaf height (never through it):
//            a limb per creative direction, each in its own light; the works are real
//            leaves on that limb. Choosing one moves in to it in the composition of V4's
//            own details shot, and a quiet sheet opens to read, watch or listen.
//   leave    back to exactly the frame you entered from; V4 takes its camera and scroll
//            back. Same tree, same growth, same place on the walk. The page never reloads.
//
// Contract with home.js (all optional, all cheap when idle):
//   tick(dt, wall)  grow(g) → g'  light(L)  camera(dt, wall) → owns?  overlay()  tap(e) → handled?
//   arrive(entry)   api (tests, integration: enter/exit/suspend/resume/state)
//
// History: #leaves (the shot) → #leaves/<direction>|all (inside) → #leaves/w/<work id>
// (a work open). Back steps out one level at a time; a #leaves/w/<id> link opens that
// leaf from a cold start: the shareable address of "my leaf".
import * as THREE from 'three';
import { UNIFORMS, openAt } from '../js/foliage.js';
import { DIRECTIONS, byId, midAzimuth } from './directions.js';
import { buildSlots, resolve, AXIS, home as limbHome } from './address.js';
import { lens as lensOf, related, chain, currentIssue } from './model.js';
import { loadWorks, drafts, account } from './source.js';
import { createWorkLeaves, OWN_GROW } from './leaves.js';
import * as UI from './ui.js';
import { parseHash } from './route.js';

const CSS = new URL('./canopy.css?v=1', import.meta.url).href;
const D2R = Math.PI / 180;
const GROW_IN = 0.86;          // the crown in full working season while inside
const UP = new THREE.Vector3(0, 1, 0);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const wrapPi = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const lerpDeg = (a, b, t) => { let d = b - a; while (d > 180) d -= 360; while (d < -180) d += 360; return a + d * t; };

export { parseHash };

export function attach(ctx) {
  const { world, cam, state, goTo, DwellCamera } = ctx;
  const reduce = !!ctx.reduceMotion;
  const body = document.body;
  const canvas = world.renderer.domElement;
  const camera = world.camera;
  const STUDY = 2;
  if (!document.querySelector(`link[href="${CSS}"]`)) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CSS; document.head.append(l); }

  const dom = UI.buildDom();
  const { $, $$ } = dom;
  const say = (t) => { $('.cnp-live').textContent = t; };
  const table = buildSlots(world.rosettes, world.stride);
  const ros = world.rosettes, st = world.stride;
  const rosPos = (i) => new THREE.Vector3(ros[i * st], ros[i * st + 1], ros[i * st + 2]);

  // The crown's real outline: how far out the foliage reaches at each bearing and height
  // (rosettes + a blade). A camera kept outside it never looks at the crown from inside,
  // where the limbs are dark silhouettes against the sky.
  const crownR = (() => {
    const AZ = 72, Y0 = -1, YB = 0.75, NY = 24, R = new Float32Array(AZ * NY);
    for (let i = 0; i < ros.length; i += st) {
      const dx = ros[i] - AXIS.x, dz = ros[i + 2] - AXIS.z;
      const a = Math.floor(((Math.atan2(dx, dz) / (2 * Math.PI)) + 1) * AZ) % AZ;
      const b = clamp(Math.floor((ros[i + 1] - Y0) / YB), 0, NY - 1);
      R[b * AZ + a] = Math.max(R[b * AZ + a], Math.hypot(dx, dz) + 0.4);
    }
    return (th, y) => {
      const a = Math.floor(((th / (2 * Math.PI)) + 1) * AZ) % AZ, b = Math.floor((y - Y0) / YB);
      let r = 0;
      for (let j = b - 2; j <= b + 1; j++) for (let k = -2; k <= 2; k++) if (j >= 0 && j < NY) r = Math.max(r, R[j * AZ + ((a + k + AZ) % AZ)]);
      return r;
    };
  })();
  /** push an eye out to at least `margin` m beyond the crown's outline at its bearing and height */
  function outside(eye, margin, k = 1) {
    const dx = eye.x - AXIS.x, dz = eye.z - AXIS.z, r = Math.hypot(dx, dz) || 1e-6;
    const need = crownR(Math.atan2(dx, dz), eye.y) + margin;
    if (r >= need || k <= 0) return eye;
    const nr = r + (need - r) * k;
    eye.x = AXIS.x + (dx / r) * nr; eye.z = AXIS.z + (dz / r) * nr;
    return eye;
  }

  // ---------------------------------------------------------------- the crown opening (foliage.js openField)
  // Around the limb you are at, its twigs and leaves relax apart and its layers spread in depth;
  // reading a work, the leaves round that one leaf make room. Bark, leaves and shadows move as one.
  const OPEN = { amt: 0, C: new THREE.Vector3(), ax: new THREE.Vector2(1, 0), R: 1.9, deep: 3 };   // deep: the reach (m)
  let openScale = 1;   // review: compare the opening with the crown as it was (api.openScale)
  function setOpen(C, toward, amt, R = 1.9, deep = 3) {
    amt *= openScale;
    const ax = new THREE.Vector2(toward.x - C.x, toward.z - C.z);
    if (ax.lengthSq() < 1e-6) ax.set(1, 0); else ax.normalize();
    OPEN.C.copy(C); OPEN.ax.copy(ax); OPEN.amt = amt; OPEN.R = R; OPEN.deep = deep;
    UNIFORMS.uOpenC.value.set(C.x, C.y, C.z, amt);
    UNIFORMS.uOpenA.value.set(ax.x, ax.y, R, deep);
  }
  // reading: the chosen leaf (and only what grows right beside it) comes a little forward out of its
  // clump, and the leaves in front of it part (the passage is never narrower than 1.1 m)
  const READ = { R: 0.42, reach: 0.75 };
  /** how far a limb's leaves come out (its heart moves this much; a work leaf, flex 0.7, a little less) */
  const reachOf = (id) => (byId(id)?.open?.reach ?? 3) * 0.7;
  const shown = new THREE.Vector3(), push = new THREE.Vector3();
  /** where a work leaf is drawn right now (its rosette, moved by the opening) */
  const drawnAt = (P) => shown.copy(P).add(openAt(P, 0.7, push));

  const S = { mode: 'shot', owns: false, mix: 0, dir: 'photo', lens: 'all', sel: null, reading: false, quiet: false,
    status: 'loading', notice: '', lockY: 0, fovK: 1, hover: null, cascade: -1, mine: null };
  let works = [], byWork = new Map(), leafOf = new Map(), posOf = new Map(), itemOf = new Map();
  let leaves = null, marks = new Map(), dirLabels = new Map();
  let from = null;            // the camera you came in with
  let cur = null, tween = null;
  const off = { az: 0, pitch: 0 }, offT = { az: 0, pitch: 0 };
  const light = { az: 0, el: 34, ready: false };
  let restoring = null, pendingPops = 0;
  const queued = [];
  const hist = (fn) => { if (pendingPops > 0) queued.push(fn); else fn(); };
  const goBack = (n = 1) => { pendingPops++; history.go(-n); };
  const landed = () => { pendingPops = Math.max(0, pendingPops - 1); while (pendingPops === 0 && queued.length) queued.shift()(); };

  // ---------------------------------------------------------------- data
  const ready = loadWorks().then((r) => {
    S.status = r.status; S.notice = r.notice;
    works = r.works.filter((w) => w.state === 'public' && resolve(w.address, table) !== null);
    byWork = new Map(works.map((w) => [w.id, w]));
    const items = [];
    const today = Date.now();
    works.forEach((w, k) => {
      const i = resolve(w.address, table);
      leafOf.set(w.id, i);
      posOf.set(w.id, rosPos(i));
      itemOf.set(w.id, k);
      const age = w.published ? clamp((today - Date.parse(w.published)) / (240 * 86400000), 0, 1) : 0.5;
      items.push({ key: w.id, index: i, blades: (w.contributors || []).length, kind: w.kind, age });
    });
    if (items.length) {
      leaves = createWorkLeaves(world, items);
      leaves.mesh.visible = true;
      world.scene.add(leaves.mesh);
    }
    buildMarks();
    syncChrome();
    return r;
  });

  // ---------------------------------------------------------------- poses
  const poseOf = (eye, look, fov) => ({ eye: eye.clone(), look: look.clone(), fov });
  const outOf = (p) => new THREE.Vector3(p.x - AXIS.x, 0, p.z - AXIS.z).normalize();
  const inDir = (id) => works.filter((w) => w.direction === id);
  function limbAnchor(id) {
    const ws = inDir(id);
    const pts = ws.length ? ws.map((w) => posOf.get(w.id)) : table.get(id).slice(0, 6).map(rosPos);
    const c = new THREE.Vector3();
    pts.forEach((p) => c.add(p));
    return c.multiplyScalar(1 / pts.length);
  }
  function limbPose(id) {
    // outside the crown's own outline, a little above the limb and looking slightly down into it:
    // the limb is seen against the shaded inside of the crown, not against a white sky
    // the limb has reached out of the crown towards you: frame where its leaves are now
    const C = limbAnchor(id), out = outOf(C);
    const n = Math.max(1, inDir(id).length);
    const at = C.clone().addScaledVector(out, reachOf(id));
    const back = 3.5 + Math.min(1.6, n * 0.2);
    // phones (portrait: the lens shift already lifts the subject) stand level with the limb, so
    // what fills the lower frame is more crown, not the islet below
    const tall = innerWidth / innerHeight < 0.85;
    const eye = outside(at.clone().addScaledVector(out, back).addScaledVector(UP, tall ? 0.45 : 0.55), 0.9);
    return poseOf(eye, at.clone().addScaledVector(UP, tall ? 0.95 : -0.05), 38);
  }
  function overviewPose() {
    // stand back across the water from the limb you were at, high enough to see the crown whole
    const a = (S.dir ? midAzimuth(byId(S.dir)) : 65) * D2R;
    const eye = new THREE.Vector3(AXIS.x + Math.sin(a) * 31, 12.5, AXIS.z + Math.cos(a) * 31);
    return poseOf(eye, new THREE.Vector3(AXIS.x, 8.2, AXIS.z), 46);
  }
  // reading a leaf: of a few eyes round its outward side, the one with no limb or twig across the
  // view and the fewest leaves in the way (computed once per leaf; the bark at rest)
  const clearView = new Map();
  const viewRay = new THREE.Raycaster();
  function leafPose(id) {
    // V4's details shot, re-aimed at this leaf: a little above, just outside its clump, looking in.
    // "Outside" is the clump's own outward side (rosette − clump centre), blended with the crown's,
    // so the lens never ends up inside the foliage pad.
    const i = leafOf.get(id), o = i * st;
    const P = posOf.get(id);
    const pad = new THREE.Vector3(ros[o] - ros[o + 12], (ros[o + 1] - ros[o + 13]) * 0.5, ros[o + 2] - ros[o + 14]);
    const n = pad.lengthSq() > 1e-4 ? pad.normalize() : new THREE.Vector3();
    n.addScaledVector(outOf(P), 0.8).normalize();
    const nh = new THREE.Vector3(n.x, 0, n.z).normalize();
    const Q = P.clone().addScaledVector(nh, READ.reach * 0.7);
    const look = Q.clone().addScaledVector(n, -0.08).add(new THREE.Vector3(0, -0.03, 0));
    if (!clearView.has(id)) {
      let best = null;
      for (const sideK of [0.32, -0.32, 0.62, -0.62, 0]) for (const up of [0.3, 0.12, 0.55]) {
        const dir = n.clone().applyAxisAngle(UP, sideK).add(new THREE.Vector3(0, up, 0)).normalize();
        const eye = Q.clone().addScaledVector(dir, 1.3);
        const seg = look.clone().sub(eye), len = seg.length();
        viewRay.set(eye, seg.clone().normalize());
        viewRay.far = len - 0.12;
        let score = Math.abs(sideK - 0.32) * 0.6 + Math.abs(up - 0.3) * 0.8;
        if (world.bark && viewRay.intersectObject(world.bark, false).length) score += 10;
        // leaves in the way: rosettes close to the line of sight (not the leaf's own)
        const L2 = len * len;
        for (let k = 0; k < ros.length; k += st) {
          const qx = ros[k], qy = ros[k + 1], qz = ros[k + 2];
          if ((qx - P.x) ** 2 + (qy - P.y) ** 2 + (qz - P.z) ** 2 < 0.16) continue;
          const t = ((qx - eye.x) * seg.x + (qy - eye.y) * seg.y + (qz - eye.z) * seg.z) / L2;
          if (t <= 0.04 || t >= 0.9) continue;
          if ((eye.x + seg.x * t - qx) ** 2 + (eye.y + seg.y * t - qy) ** 2 + (eye.z + seg.z * t - qz) ** 2 < 0.09) score += 0.35;
        }
        if (!best || score < best.score) best = { score, dir };
      }
      clearView.set(id, best.dir);
    }
    const eye = Q.clone().addScaledVector(clearView.get(id), 1.3);
    return poseOf(eye, look, 28);
  }
  function snapshot() {
    const dir = camera.getWorldDirection(new THREE.Vector3());
    const dist = Math.hypot(cam.s.lx - cam.s.ex, cam.s.ly - cam.s.ey, cam.s.lz - cam.s.ez) || 2;
    return { eye: camera.position.clone(), look: camera.position.clone().addScaledVector(dir, dist), fov: cam.s.fov, auth: cam.s.auth || 0 };
  }

  // cylindrical flight around the trunk–crown axis: the camera circles the tree, never cuts through it
  const cyl = (p) => ({ th: Math.atan2(p.x - AXIS.x, p.z - AXIS.z), r: Math.hypot(p.x - AXIS.x, p.z - AXIS.z), y: p.y });
  const fromCyl = (c) => new THREE.Vector3(AXIS.x + Math.sin(c.th) * c.r, c.y, AXIS.z + Math.cos(c.th) * c.r);
  function flight(a, b, e, bulge, lift) {
    const ce = cyl(a.eye), de = cyl(b.eye), cl = cyl(a.look), dl = cyl(b.look);
    const s = Math.sin(Math.PI * e);
    const eye = fromCyl({ th: ce.th + wrapPi(de.th - ce.th) * e, r: lerp(ce.r, de.r, e) + bulge * s, y: lerp(ce.y, de.y, e) + lift * s });
    // between two limbs the camera stays outside the crown (the ends are already where they belong)
    outside(eye, 1.6, Math.min(1, s * 3));
    // the look target moves on a straight line when both are near the axis (the overview)
    const look = (cl.r < 1.5 || dl.r < 1.5) ? a.look.clone().lerp(b.look, e)
      : fromCyl({ th: cl.th + wrapPi(dl.th - cl.th) * e, r: lerp(cl.r, dl.r, e), y: lerp(cl.y, dl.y, e) });
    return { eye, look, fov: lerp(a.fov, b.fov, e) + (bulge > 1 ? 5 * s : 0), auth: lerp(a.auth || 0, b.auth || 0, e) };
  }
  const bez = (p0, p1, p2, p3, t) => {
    const u = 1 - t;
    return p0.clone().multiplyScalar(u * u * u).addScaledVector(p1, 3 * u * u * t).addScaledVector(p2, 3 * u * t * t).addScaledVector(p3, t * t * t);
  };
  /**
   * From one new leaf to the limb it grows on. The camera first steps back from the leaf along
   * its own outward side, keeping it in frame while the lens widens (the leaf becomes a cluster,
   * the cluster a limb), then swings round outside the crown to face the limb, which has opened.
   * Never through the foliage: the path is held outside the crown's real outline.
   */
  function entering(a, b, e) {
    const o0 = outOf(a.look), o1 = outOf(b.look);
    const eye = bez(a.eye, a.eye.clone().addScaledVector(o0, 3.6).addScaledVector(UP, 0.15),
      b.eye.clone().addScaledVector(o1, 2.4).addScaledVector(UP, 0.2), b.eye, e);
    outside(eye, 1.7, smooth(clamp((e - 0.06) / 0.22, 0, 1)) * (1 - smooth(clamp((e - 0.9) / 0.1, 0, 1))));
    // the eye holds on the leaf while stepping back, then hands over to the limb
    const h = smooth(clamp((e - 0.28) / 0.6, 0, 1));
    const look = a.look.clone().lerp(b.look, h);
    // the lens opens with the step back, then settles to the limb's
    const fov = e < 0.45 ? lerp(a.fov, 46, smooth(e / 0.45)) : lerp(46, b.fov, smooth((e - 0.45) / 0.55));
    return { eye, look, fov, auth: lerp(a.auth || 0, b.auth || 0, e) };
  }
  function flyTo(b, { done, kind = 'move' } = {}) {
    const a = { eye: cur.eye.clone(), look: cur.look.clone(), fov: cur.fov, auth: cur.auth || 0 };
    const dth = Math.abs(wrapPi(cyl(b.eye).th - cyl(a.eye).th));
    const dist = a.eye.distanceTo(b.eye);
    let dur = kind === 'enter' ? 3.4 : kind === 'leave' ? 2.4 : clamp(0.9 + dth * 0.9 + dist * 0.03, 0.8, 2.6);
    if (reduce) dur = 0;
    offT.az = 0; offT.pitch = 0;
    const bulge = dth > 0.35 ? 2.5 + dth * 3 : 0, lift = dth > 0.35 ? 0.8 + dth * 1.4 : 0;
    if (dur <= 0) { Object.assign(cur, b); tween = null; done?.(); return; }
    tween = { a, b, t0: performance.now(), dur: dur * 1000, bulge, lift, done, kind };
  }

  // ---------------------------------------------------------------- owning the camera and the page
  const shelved = ['#p-leaves', '#p-archive', '#orbit'].map((q) => document.querySelector(q)).filter(Boolean);
  const shelve = (on) => shelved.forEach((el) => { el.inert = on || (/^p-/.test(el.id) && body.dataset.chapter !== String(STUDY)); });
  function take() {
    from = snapshot();
    cur = { eye: from.eye.clone(), look: from.look.clone(), fov: from.fov, auth: from.auth };
    S.owns = true;
    S.lockY = scrollY;
    cam.enabled = false;
    cam.releaseLook();
    canvas.style.touchAction = 'none';
    shelve(true);
    body.classList.add('cnp-on');
    dom.root.setAttribute('aria-hidden', 'false');
    claimWorld(true);
  }
  function handBack() {
    if (!S.owns) return;
    S.owns = false;
    tween = null;
    // V4's camera continues from exactly here and settles on its own rail (no jump)
    const look = from ? from.look : cur.look;
    Object.assign(cam.s, { ex: cur.eye.x, ey: cur.eye.y, ez: cur.eye.z, lx: look.x, ly: look.y, lz: look.z, fov: from ? from.fov : cur.fov, auth: from ? from.auth : 0 });
    cam.off.az = cam.offTarget.az = 0; cam.off.pitch = cam.offTarget.pitch = 0;
    cam.enabled = true;
    canvas.style.touchAction = '';
    canvas.style.cursor = '';
    shelve(false);
    body.classList.remove('cnp-on', 'cnp-reading', 'cnp-quiet', 'cnp-overview', 'cnp-leaving');
    dom.root.setAttribute('aria-hidden', 'true');
    OPEN.amt = 0; UNIFORMS.uOpenC.value.w = 0;
    claimWorld(false);
  }
  // acts 05/06 keep one owner of camera and input (lanren/world/state.js on their branch):
  // when that is present and knows a 'canopy' owner, tell it; otherwise this module's own lock applies
  function claimWorld(on) {
    const W = ctx.worldState;
    if (!W) return;
    try { if (on) W.claim('canopy'); else W.release('canopy'); } catch { /* that world has no canopy owner yet */ }
  }

  // ---------------------------------------------------------------- entering and leaving
  function enter({ dir = 'photo', fromHistory = false, instant = false, then = null } = {}) {
    if (S.owns) { if (then) then(); return; }
    if (Math.abs(state.p - STUDY) > 0.35) { goTo(STUDY, true); }
    take();
    S.mode = 'enter';
    S.dir = dir;
    S.cascade = 0;
    rustle(1.6);
    syncChrome();
    flyTo(dir ? limbPose(dir) : overviewPose(), { kind: instant ? 'move' : 'enter', done: () => { S.mode = 'canopy'; then?.(); } });
    if (instant) { if (tween) { Object.assign(cur, tween.b); const d = tween.done; tween = null; d?.(); } }
    if (!fromHistory) hist(() => history.pushState({ cnp: 'canopy' }, '', '#leaves/' + (dir || 'all')));
    say(S.status === 'demo' ? '已进入作品树冠（开发演示，作品均为虚构）。左右方向键切换创作方向，Esc 回到新叶。' : '已进入作品树冠。树上还没有公开作品。Esc 回到新叶。');
  }
  function exit({ fromHistory = false, then = null } = {}) {
    if (!S.owns || S.mode === 'leave') return;
    closeSheets();
    if (S.reading) closeWork({ fromHistory: true, keepCamera: true });
    S.mode = 'leave';
    body.classList.add('cnp-leaving');
    flyTo(from, { kind: 'leave', done: () => { S.mode = 'shot'; handBack(); then?.(); } });
    if (!fromHistory) {
      const st = history.state?.cnp;
      hist(() => { if (st === 'work') goBack(2); else if (st === 'canopy') goBack(1); else history.replaceState(null, '', '#leaves'); });
    }
    say('回到第三幕：新叶特写。继续滚动可前往第四幕。');
  }
  function setDir(id, { push = false } = {}) {
    if (!S.owns) return;
    if (S.reading) closeWork({ fromHistory: true, keepCamera: true });
    S.dir = id || null;
    flyTo(id ? limbPose(id) : overviewPose());
    syncChrome();
    const h = '#leaves/' + (id || 'all');
    hist(() => history[push ? 'pushState' : 'replaceState'](history.state?.cnp ? history.state : { cnp: 'canopy' }, '', h));
    const d = byId(id);
    say(d ? `${d.zh}：${inDir(id).length} 件公开作品。${d.mood}` : '全部方向：整棵树冠。');
  }

  // ---------------------------------------------------------------- reading
  function open(id, { fromHistory = false, push = true } = {}) {
    const w = byWork.get(id);
    if (!S.owns) enter({ dir: w ? w.direction : 'photo', instant: true, fromHistory: true });
    if (!w) {
      showPaper(UI.renderUnavailable(id));
      S.sel = null;
      if (!fromHistory) hist(() => history[push ? 'pushState' : 'replaceState']({ cnp: 'work' }, '', '#leaves/w/' + id));
      return;
    }
    S.sel = id;
    S.dir = w.direction;
    flyTo(leafPose(id));
    const share = location.origin + location.pathname + '#leaves/w/' + id;
    showPaper(UI.renderWork(w, { rel: related(works, id), issue: currentIssue(works), share }));
    syncChrome();
    if (!fromHistory) hist(() => history[push && history.state?.cnp !== 'work' ? 'pushState' : 'replaceState']({ cnp: 'work' }, '', '#leaves/w/' + id));
    say(`《${w.title}》，${UI.authors(w)}。${UI.leafLabel(w)}。`);
  }
  function showPaper(html) {
    const sheet = $('.cnp-read'), paper = $('.cnp-paper');
    paper.innerHTML = html;
    paper.scrollTop = 0;
    sheet.hidden = false;
    S.reading = true;
    body.classList.add('cnp-reading');
    requestAnimationFrame(() => paper.focus({ preventScroll: true }));
  }
  function closeWork({ fromHistory = false, keepCamera = false } = {}) {
    if (!S.reading) return;
    const was = S.sel;
    S.reading = false; S.sel = null;
    setQuiet(false);
    $('.cnp-read').hidden = true;
    $$('.cnp-read audio, .cnp-read video').forEach((m) => m.pause());
    body.classList.remove('cnp-reading');
    if (!keepCamera && S.owns) flyTo(S.dir ? limbPose(S.dir) : overviewPose());
    syncChrome();
    if (!fromHistory) hist(() => { if (history.state?.cnp === 'work') goBack(1); else history.replaceState({ cnp: 'canopy' }, '', '#leaves/' + (S.dir || 'all')); });
    if (was) marks.get(was)?.el.focus({ preventScroll: true });
  }
  function setQuiet(on) {
    S.quiet = on;
    body.classList.toggle('cnp-quiet', on);
    $('.cnp-quiet').setAttribute('aria-pressed', String(on));
  }
  let chainRun = null;
  function walkChain() {
    if (!S.sel) return;
    const c = chain(works, S.sel);
    if (c.length < 2) return;
    let k = 0;
    clearTimeout(chainRun);
    const next = () => { if (!S.owns) return; open(c[k].id, { push: false }); k++; if (k < c.length) chainRun = setTimeout(next, reduce ? 600 : 3200); };
    next();
    say(`沿着接力：${c.map((w) => w.title).join(' → ')}`);
  }

  // ---------------------------------------------------------------- find my leaf
  function closeSheets() { $$('dialog.cnp-sheet[open]').forEach((d) => d.close()); $('.cnp-index').hidden = true; $('[data-act="index"]').setAttribute('aria-expanded', 'false'); }
  async function openFind() {
    const dlg = $('.cnp-find');
    const me = await account();
    dlg.querySelector('form').innerHTML = UI.renderFind(works, { status: S.status, me });
    dlg.showModal();
  }
  function findGo(q) {
    const m = /(?:#leaves\/w\/)?([\w-]{1,100})\s*$/.exec(String(q || '').trim());
    const msg = $('.cnp-find-msg');
    if (!m) { if (msg) msg.textContent = '请粘贴叶子链接或作品编号。'; return; }
    $('.cnp-find').close();
    found(m[1]);
  }
  function found(id) {
    S.mine = id;
    if (!S.owns) enter({ dir: byWork.get(id)?.direction || 'photo', instant: reduce, then: () => open(id) });
    else open(id);
  }
  async function openCreate() {
    const dlg = $('.cnp-create');
    let list = [], where = 'device';
    try { where = await drafts.where(); list = await drafts.list(); } catch (err) { console.warn('drafts unavailable', err); }
    dlg.querySelector('form').innerHTML = UI.renderCreate({ where, list });
    const sel = dlg.querySelector('select[name="direction"]');
    if (sel && S.dir) sel.value = S.dir;
    dlg.showModal();
  }
  async function saveDraft(form) {
    const f = new FormData(form);
    const d = { kind: f.get('kind'), direction: f.get('direction'), title: String(f.get('title') || '').trim(), body: String(f.get('body') || '') };
    const msg = form.querySelector('.cnp-save-msg');
    const { validateDraft } = await import('./model.js');
    const errs = validateDraft(d);
    if (errs.length) { msg.textContent = errs.join('；'); return; }
    try {
      const saved = await drafts.save(d);
      msg.textContent = saved.where === 'account' ? `已保存到你的 HAIZ 账号：《${saved.title}》（私人草稿，仅你可见）。` : `已保存在这台设备：《${saved.title}》（私人草稿，未上传）。`;
      form.querySelector('.cnp-drafts ol').innerHTML = UI.renderDrafts(await drafts.list());
      form.querySelector('input[name="title"]').value = ''; form.querySelector('textarea[name="body"]').value = '';
    } catch (err) {
      msg.textContent = '没有保存成功：' + (err.message || err);
    }
  }

  // ---------------------------------------------------------------- chrome
  function syncChrome() {
    const d = byId(S.dir);
    $('.cnp-dirname').textContent = S.owns ? (d ? d.zh : '全部方向') : '';
    $('.cnp-mood').textContent = d ? d.mood : '五根主枝，五种创作方向。新的细枝经过审核后才会长出来。';
    body.classList.toggle('cnp-overview', S.owns && !S.dir);
    $$('.cnp-dir').forEach((b) => b.setAttribute('aria-current', String((b.dataset.dir || null) === S.dir)));
    $$('[data-lens]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lens === S.lens)));
    for (const x of DIRECTIONS) {
      const n = inDir(x.id), p = n.filter((w) => w.kind === 'project').length;
      const el = $(`[data-count="${x.id}"]`);
      if (el) el.textContent = n.length ? `${n.length - p} 件作品${p ? ` · ${p} 个项目` : ''}` : '还没有公开作品';
    }
    const notice = $('.cnp-notice');
    notice.textContent = S.status === 'demo' ? '开发演示：树上的作品、作者、推荐与精选均为虚构，用来检验空间与流程，不是真实学生作品。' : S.notice;
    notice.classList.toggle('demo', S.status === 'demo');
    renderIndex();
  }
  function lensList() {
    const L = lensOf(works, S.lens);
    return S.dir ? L.filter((w) => w.direction === S.dir) : L;
  }
  function renderIndex() {
    const list = lensList();
    $('.cnp-index ol').innerHTML = list.map((w) => `<li><button type="button" data-work="${UI.esc(w.id)}"><i>${UI.esc(UI.leafLabel(w))}</i><b>${UI.esc(w.title)}</b><span>${UI.esc(UI.authors(w))}${w.kind === 'project' ? ' · 进行中' : ''}</span></button></li>`).join('');
    const empty = $('.cnp-index-empty');
    empty.hidden = list.length > 0;
    empty.textContent = works.length ? '这个方向里还没有符合的作品。' : '树上还没有公开作品。';
  }
  function buildMarks() {
    const box = $('.cnp-marks');
    box.replaceChildren();
    marks = new Map();
    for (const w of works) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cnp-mark' + (w.kind === 'project' ? ' project' : '');
      b.dataset.work = w.id;
      b.innerHTML = `<i aria-hidden="true"></i><span class="ln" aria-hidden="true"></span><span class="n">${UI.esc(UI.leafLabel(w).split(' · ')[1])}</span><span class="t"><b>${UI.esc(w.title)}</b><small>${UI.esc(UI.authors(w))}${w.kind === 'project' ? ' · 进行中' : ''}</small></span>`;
      b.setAttribute('aria-label', `${w.title}，${UI.authors(w)}，${UI.leafLabel(w)}`);
      box.append(b);
      marks.set(w.id, { el: b, w, on: false });
    }
    // where each limb's first leaf will grow (only for limbs still empty): an honest invitation
    for (const d of DIRECTIONS) {
      if (inDir(d.id).length) continue;
      const b = document.createElement('span');
      b.className = 'cnp-mark ghost';
      b.innerHTML = `<i aria-hidden="true"></i><span class="ln" aria-hidden="true"></span><span class="t"><b>第一片叶子会长在这里</b><small>${UI.esc(d.zh)} · 01</small></span>`;
      box.append(b);
      marks.set('ghost:' + d.id, { el: b, ghost: d.id, on: false });
    }
    const labs = $('.cnp-dirlabels');
    labs.replaceChildren();
    dirLabels = new Map();
    for (const d of DIRECTIONS) {
      const el = document.createElement('p');
      el.className = 'cnp-dirlabel';
      el.innerHTML = `<b>${UI.esc(d.zh)}</b><small>${UI.esc(d.en)}</small>`;
      labs.append(el);
      dirLabels.set(d.id, { el, at: limbAnchor(d.id).add(new THREE.Vector3(0, 1.2, 0)) });
    }
  }

  // ---------------------------------------------------------------- input
  const onClick = (e) => {
    const t = e.target instanceof Element ? e.target : null;
    const b = t?.closest('button, a');
    if (!b) return;
    if (b.dataset.work) { e.preventDefault(); if (b.dataset.mine) { $('.cnp-find').close(); found(b.dataset.work); return; } closeSheets(); return open(b.dataset.work); }
    if ('dir' in b.dataset) return setDir(b.dataset.dir || null);
    if (b.dataset.lens) { S.lens = b.dataset.lens; syncChrome(); say(`看：${b.textContent}`); return undefined; }
    if (b.dataset.person) {
      const mine = works.filter((w) => (w.contributors || []).some((c) => c.name === b.dataset.person));
      $('.cnp-mine').innerHTML = UI.renderMine(mine);
      return undefined;
    }
    if (b.dataset.draftDel) {
      e.preventDefault();
      drafts.list().then((l) => l.find((d) => d.id === b.dataset.draftDel)).then((d) => d && drafts.remove(d)).then(() => drafts.list())
        .then((l) => { $('.cnp-drafts ol').innerHTML = UI.renderDrafts(l); }).catch((err) => console.warn(err));
      return undefined;
    }
    switch (b.dataset.act) {
      case 'exit': return exit();
      case 'close': return closeWork();
      case 'quiet': return setQuiet(!S.quiet);
      case 'chain': return walkChain();
      case 'find': return openFind();
      case 'find-go': e.preventDefault(); return findGo($('.cnp-find input[name="q"]')?.value);
      case 'create': return openCreate();
      case 'save': e.preventDefault(); return saveDraft(b.closest('form'));
      case 'index': { const ix = $('.cnp-index'); ix.hidden = !ix.hidden; b.setAttribute('aria-expanded', String(!ix.hidden)); if (!ix.hidden) ix.querySelector('button')?.focus(); return undefined; }
      case 'index-close': $('.cnp-index').hidden = true; $('[data-act="index"]').setAttribute('aria-expanded', 'false'); return $('[data-act="index"]').focus();
      case 'copy': {
        const inp = $('.cnp-share input');
        navigator.clipboard?.writeText(inp.value).then(() => say('已复制这片叶子的链接。'), () => { inp.select(); say('请手动复制链接。'); });
        if (!navigator.clipboard) inp.select();
        return undefined;
      }
      case 'report': say('举报与内容处理需要审核服务，将在下一阶段开放。现在不会发送任何内容。'); return undefined;
      default: return undefined;
    }
  };
  dom.root.addEventListener('click', onClick);
  dom.sheets.addEventListener('click', onClick);
  dom.sheets.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement && e.target.name === 'q') { e.preventDefault(); findGo(e.target.value); }
  });
  // the chapter's own slab gains the way in
  for (const b of document.querySelectorAll('[data-action="canopy-enter"]')) b.addEventListener('click', (e) => { e.preventDefault(); ready.then(() => enter()); });
  for (const b of document.querySelectorAll('[data-action="canopy-find"]')) b.addEventListener('click', (e) => { e.preventDefault(); ready.then(() => openFind()); });

  // drag looks round; a tap on a work leaf opens it
  const pts = new Map();
  let moved = 0, downT = 0;
  canvas.addEventListener('pointerdown', (e) => {
    if (!S.owns) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = 0; downT = e.timeStamp;
    if (e.pointerType !== 'touch') canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!S.owns) return;
    const p = pts.get(e.pointerId);
    if (!p) { hoverAt(e); return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    if (moved < 6) return;
    const k = e.pointerType === 'touch' ? 0.004 : 0.0028;
    offT.az = clamp(offT.az + dx * k, -0.6, 0.6);
    offT.pitch = clamp(offT.pitch + dy * k * 0.8, -0.35, 0.45);
  });
  const up = (e) => {
    const p = pts.get(e.pointerId);
    pts.delete(e.pointerId);
    if (!S.owns || !p || moved > 6 || e.type !== 'pointerup' || e.timeStamp - downT > 600) return;
    const hit = pick(e);
    if (hit) open(hit);
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    let best = null, bd = Infinity;
    for (const [id, P0] of posOf) {
      const P = drawnAt(P0).clone();
      const along = P.clone().sub(ray.ray.origin).dot(ray.ray.direction);
      if (along <= 0.05) continue;
      const tol = Math.max(0.2, along * (e.pointerType === 'touch' ? 0.06 : 0.04));
      if (ray.ray.distanceSqToPoint(P) < tol * tol && along < bd) { bd = along; best = id; }
    }
    return best;
  }
  function hoverAt(e) {
    if (e.pointerType === 'touch') return;
    const id = pick(e);
    if (id !== S.hover) { S.hover = id; canvas.style.cursor = id ? 'pointer' : ''; }
  }
  // the page holds still while the canopy has it (anything scrollable keeps its scrolling)
  const scrollable = (t) => {
    for (let el = t instanceof Element ? t : null; el && el !== document.body; el = el.parentElement) {
      if (el.matches('dialog[open], .cnp-paper, .cnp-index')) return true;
      const oy = getComputedStyle(el).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) return true;
    }
    return false;
  };
  addEventListener('wheel', (e) => {
    if (!S.owns || scrollable(e.target)) return;
    e.preventDefault();
    if (e.target !== canvas || S.reading) return;
    S.fovK = clamp(S.fovK * Math.exp(clamp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0012), -0.3, 0.3)), 0.62, 1.25);
  }, { passive: false });
  addEventListener('touchmove', (e) => { if (S.owns && !scrollable(e.target)) e.preventDefault(); }, { passive: false });
  addEventListener('scroll', () => { if (S.owns && Math.abs(scrollY - S.lockY) > 1) scrollTo(0, S.lockY); }, { passive: true });
  addEventListener('keydown', (e) => {
    if (!S.owns) return;
    const t = e.target;
    if (t instanceof Element && t.closest('input, textarea, select, dialog[open]')) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (!$('.cnp-index').hidden) { $('.cnp-index').hidden = true; $('[data-act="index"]').focus(); } else if (S.reading) closeWork(); else exit();
      return;
    }
    if (S.reading) return;   // the reading sheet keeps its arrows for scrolling
    const order = [null, ...DIRECTIONS.map((d) => d.id)];
    const i = order.indexOf(S.dir);
    if (e.key === 'ArrowRight') { e.preventDefault(); setDir(order[(i + 1) % order.length]); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); setDir(order[(i - 1 + order.length) % order.length]); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const list = lensList();
      if (!list.length) return;
      const at = list.findIndex((w) => marks.get(w.id)?.el === document.activeElement);
      const n = (at + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length;
      marks.get(list[at < 0 ? 0 : n].id)?.el.focus();
    } else if (['PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key) && !(t instanceof Element && t.closest('button, a'))) e.preventDefault();
  }, true);
  addEventListener('popstate', () => {
    if (pendingPops > 0) { landed(); return; }
    const h = parseHash(location.hash);
    if (!h || h.shot) { if (S.owns) exit({ fromHistory: true }); return; }
    if (!S.owns) {
      if (Math.abs(state.p - STUDY) > 0.05) return;
      restoring = { ...h, soft: true };
      return;
    }
    if (h.work) { if (S.sel !== h.work) open(h.work, { fromHistory: true }); }
    else { if (S.reading) closeWork({ fromHistory: true }); if (h.dir !== S.dir) { S.dir = h.dir; flyTo(h.dir ? limbPose(h.dir) : overviewPose()); syncChrome(); } }
  });

  // ---------------------------------------------------------------- per frame
  let rustleT = 0, rustleLeft = 0, touchIdx = 0;
  function rustle(seconds) { rustleLeft = reduce ? 0 : seconds; }
  function brushAlong(dt) {
    if (rustleLeft <= 0) return;
    rustleLeft -= dt;
    rustleT += dt;
    if (rustleT < 0.11) return;
    rustleT = 0;
    // the leaves in front of the lens move aside as it passes (V4's own touch response)
    const t = UNIFORMS.uTime.value, dir = camera.getWorldDirection(new THREE.Vector3());
    const i = 2 + (touchIdx++ % 2);   // two of V4's four touch slots; the pointer keeps the others
    UNIFORMS.uTouchO.value[i].set(camera.position.x, camera.position.y, camera.position.z, t);
    UNIFORMS.uTouchD.value[i].set(dir.x, dir.y, dir.z, 1.5);
  }
  function tick(dt, wall = dt) {
    if (restoring && Math.abs(state.p - STUDY) < 0.01 && S.status !== 'loading') {
      const r = restoring; restoring = null;
      if (r.work) found(r.work);
      else if (r.inside) enter({ dir: r.dir, fromHistory: true, instant: !r.soft });
    }
    // the canopy's season and light follow its own presence, eased (also on the way out)
    const target = S.owns && S.mode !== 'leave' ? 1 : 0;
    S.mix += (target - S.mix) * (1 - Math.exp(-wall * (target ? 1.6 : 2.2)));
    if (Math.abs(target - S.mix) < 1e-3) S.mix = target;
    OWN_GROW.value = lerp(clamp(UNIFORMS.uGrow.value + 0.5, 0, 1), 1, S.mix);
    if (leaves) {
      // emphasis: on entering, the work leaves catch the sun one after another (in leaf order)
      if (S.cascade >= 0) S.cascade += wall;
      const lensed = new Set(lensOf(works, S.lens).map((w) => w.id));
      works.forEach((w, k) => {
        const inside = S.owns ? 1 : 0;
        const order = (k + 1) * 0.16;
        const wave = S.cascade >= 0 ? clamp(1 - Math.abs(S.cascade - 1.1 - order) / 0.5, 0, 1) : 0;
        const base = inside * (S.lens === 'all' ? 0.3 : lensed.has(w.id) ? 0.75 : 0.0);
        const sel = w.id === S.sel ? 1 : w.id === S.mine ? 0.7 : 0;
        const hov = w.id === S.hover || marks.get(w.id)?.el === document.activeElement ? 0.45 : 0;
        leaves.set(k, inside * Math.max(base, wave, hov), inside * sel);
      });
      if (S.cascade > 2.4 + works.length * 0.16) S.cascade = -1;
      leaves.update(wall);
    }
    brushAlong(wall);
  }
  function grow(g) { return S.mix > 0 ? lerp(g, GROW_IN, smooth(S.mix)) : g; }
  function lightHook(L) {
    if (S.mix <= 0) { UNIFORMS.uFall.value.w = 0; return; }
    const m = smooth(S.mix);
    const d = byId(S.dir);
    const T = d ? d.temper : { sunAz: 28, sunEl: 40, I: 1, rays: 0.3, exposure: 0.98, warm: 0.55, contrast: 1.06, sat: 1.06 };
    // the sun: from behind the limb (or the leaf being read), as V4's details shot lights its cluster
    const P = S.sel ? posOf.get(S.sel) : d ? limbAnchor(d.id) : null;
    const behind = P ? Math.atan2(-(P.x - AXIS.x), -(P.z - AXIS.z)) / D2R : L.sunAz;
    const az = behind + (S.sel ? 28 : T.sunAz), el = S.sel ? 34 : T.sunEl;
    if (!light.ready) { light.az = L.sunAz; light.el = L.sunEl; light.ready = true; }
    const k = 1 - Math.exp(-0.05 * 1.8);
    light.az = lerpDeg(light.az, az, k); light.el = lerp(light.el, el, k);
    L.sunAz = lerpDeg(L.sunAz, light.az, m);
    L.sunEl = lerp(L.sunEl, light.el, m);
    L.I = lerp(L.I, L.I * (T.I ?? 1), m);
    for (const key of ['rays', 'exposure', 'warm', 'contrast', 'sat']) if (T[key] !== undefined) L[key] = lerp(L[key], T[key], m);
    if (T.mist !== undefined) L.mist = lerp(L.mist, T.mist, m);
    // a shallow focus on the leaf being read; a little depth on a limb; none from afar
    const ap = S.sel ? 1.0 : d ? 0.72 : 0;
    L.aperture = lerp(L.aperture, ap, m);
    if (cur && ap > 0) L.focus = cur.eye.distanceTo(cur.look);
    // the light falls away into the crown behind the limb in focus: the limb stands in the sun,
    // the depth of the crown behind it is shade (a gentle falloff, as under a real canopy)
    const fall = S.sel ? 0.4 : d ? 0.55 : 0;
    UNIFORMS.uFall.value.set(cur ? cur.eye.distanceTo(cur.look) : 4, S.sel ? 1.2 : 1.0, S.sel ? 5.0 : 6.5, fall * m);
  }
  /** where the crown should be open now, and how far: the limb you face, or room round the leaf you read */
  function openGoal() {
    if (S.sel && posOf.get(S.sel)) {
      const P = posOf.get(S.sel);
      return { C: P, toward: leafPose(S.sel).eye, R: READ.R, deep: READ.reach, amt: 1 };
    }
    if (S.dir) { const C = limbAnchor(S.dir), o = byId(S.dir)?.open || {}; return { C, toward: C.clone().add(outOf(C)), R: o.R || 1.9, deep: o.reach ?? 3, amt: 1 }; }
    return null;
  }
  function openStep(wall) {
    const g = openGoal();
    const k = 1 - Math.exp(-wall * 2.2);
    let amt = g ? g.amt : 0;
    const C = g ? g.C : OPEN.C, toward = g ? g.toward : OPEN.C.clone().add(new THREE.Vector3(OPEN.ax.x, 0, OPEN.ax.y));
    if (tween?.kind === 'enter' || tween?.kind === 'leave') {
      // tied to the move itself, so a held frame (review, reduced motion) is exact
      const u = tween.hold ?? Math.min(1, (performance.now() - tween.t0) / tween.dur);
      amt = tween.kind === 'enter' ? smooth(clamp((u - 0.22) / 0.62, 0, 1)) * amt : (1 - smooth(clamp(u / 0.55, 0, 1))) * OPEN.amt;
      setOpen(C, toward, amt, g ? g.R : OPEN.R, g ? g.deep : OPEN.deep);
      return;
    }
    if (reduce) { setOpen(C, toward, amt, g ? g.R : OPEN.R, g ? g.deep : OPEN.deep); return; }
    const nC = OPEN.C.lengthSq() ? OPEN.C.clone().lerp(C, k) : C.clone();
    const ax0 = new THREE.Vector3(OPEN.ax.x, 0, OPEN.ax.y), ax1 = toward.clone().sub(C).setY(0).normalize();
    const ax = ax0.lerp(ax1, k).normalize();
    setOpen(nC, nC.clone().add(ax), OPEN.amt + (amt - OPEN.amt) * k, lerp(OPEN.R, g ? g.R : OPEN.R, k), lerp(OPEN.deep, g ? g.deep : OPEN.deep, k));
  }
  function cameraHook(dt, wall = dt) {
    if (!S.owns) return false;
    if (tween) {
      const u = tween.hold ?? Math.min(1, (performance.now() - tween.t0) / tween.dur);
      const e = tween.kind === 'enter' ? smooth(u) * 0.45 + easeInOut(u) * 0.55 : easeInOut(u);
      Object.assign(cur, tween.kind === 'enter' ? entering(tween.a, tween.b, e)
        : tween.kind === 'leave' ? entering(tween.b, tween.a, 1 - e)
          : flight(tween.a, tween.b, e, tween.bulge, tween.lift));
      if (u >= 1) { const done = tween.done; Object.assign(cur, { eye: tween.b.eye.clone(), look: tween.b.look.clone(), fov: tween.b.fov, auth: tween.b.auth || 0 }); tween = null; done?.(); }
    }
    if (!S.owns) { setOpen(OPEN.C, OPEN.C.clone().add(new THREE.Vector3(OPEN.ax.x, 0, OPEN.ax.y)), 0, OPEN.R, OPEN.deep); return false; }   // done() may have handed the camera back
    openStep(wall);
    off.az += (offT.az - off.az) * (1 - Math.exp(-6 * wall));
    off.pitch += (offT.pitch - off.pitch) * (1 - Math.exp(-6 * wall));
    // reading on a wide screen: the sheet covers the right, so the leaf sits in the open left part
    const wide = innerWidth > 860;
    // (three.js looks down +z with screen-right towards −x: a smaller yaw moves the subject left)
    const shift = S.reading && wide ? 0.19 * (tween ? easeInOut(Math.min(1, (performance.now() - tween.t0) / tween.dur)) : 1) : 0;
    // reading on a phone: the sheet rises over the lower part, so the leaf moves up into the band left above it
    const lift = S.reading && !wide ? 0.21 * (tween ? easeInOut(Math.min(1, (performance.now() - tween.t0) / tween.dur)) : 1) : 0;
    const look = cur.look.clone().sub(cur.eye);
    const len = look.length() || 1;
    const yaw = Math.atan2(look.x, look.z) - off.az - shift;
    const pitch = clamp(Math.asin(clamp(look.y / len, -1, 1)) - off.pitch - lift, -1.4, 1.4);
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    const screen = DwellCamera.screen(camera);
    const t = performance.now() / 1000;
    const breath = reduce ? 0 : Math.sin(t * 0.9) * 0.008;
    camera.position.set(cur.eye.x, cur.eye.y + breath, cur.eye.z);
    camera.lookAt(camera.position.clone().add(dir));
    const fov = DwellCamera.fovFor(cur.fov * (S.mode === 'canopy' && !S.reading ? S.fovK : 1), screen, cur.auth || 0);
    if (Math.abs(fov - camera.fov) > 0.01 || camera.userData.cnpShape !== screen) {
      camera.userData.cnpShape = screen;
      camera.fov = fov;
      DwellCamera.applyShift(camera);
      camera.updateProjectionMatrix();
    }
    // each direction's temperament includes its air: leaves move more where sound lives
    const d = byId(S.dir);
    if (d && !reduce) UNIFORMS.uWind.value *= lerp(1, d.temper.wind || 1, smooth(S.mix));
    return true;
  }
  const tmp = new THREE.Vector3();
  /**
   * Captions beside their leaves, never over another caption, another leaf's mark or the chrome.
   * The mark stays on its leaf; the caption takes the first free place round it (away from the
   * middle of the frame first) and a hairline joins them. With no room, only the mark and its
   * number remain (the caption returns on hover / focus, and every work is in the index).
   * Phones show at most two captions besides the selected one.
   */
  function layoutCaptions(placed, W, H) {
    const phone = W < 760;
    const top = phone ? 150 : 128, bottom = H - (phone ? 210 : 150);
    const right = S.reading && innerWidth > 860 ? W * 0.55 : W - 18;
    const focus = document.activeElement;
    const pri = (p) => (p.key === S.sel ? -1e6 : 0) + (p.m.el === focus || p.key === S.hover ? -1e5 : 0) + Math.hypot(p.x - W * 0.45, p.y - H * 0.48);
    placed.sort((a, b) => pri(a) - pri(b));
    const dots = placed.map((p) => [p.x - 12, p.y - 12, 24, 24]);
    const taken = [];
    const hit = (r) => r[0] < 14 || r[1] < top || r[0] + r[2] > right || r[1] + r[3] > bottom
      || taken.some((t) => r[0] < t[0] + t[2] + 10 && t[0] < r[0] + r[2] + 10 && r[1] < t[1] + t[3] + 6 && t[1] < r[1] + r[3] + 6)
      || dots.some((d, i) => d !== r.self && r[0] < d[0] + d[2] && d[0] < r[0] + r[2] && r[1] < d[1] + d[3] && d[1] < r[1] + r[3]);
    let captions = 0;
    placed.forEach((p, k) => {
      const t = p.m.el.querySelector('.t');
      if (!p.m.cw || p.m.cwFor !== t.textContent) { p.m.cw = t.offsetWidth || 140; p.m.ch = t.offsetHeight || 38; p.m.cwFor = t.textContent; }
      const cw = p.m.cw, ch = p.m.ch;
      const lead = p.key === S.sel || p.m.el === focus || p.key === S.hover;
      let best = null;
      if (!phone || lead || captions < 2) {
        const leftFirst = p.x > W * 0.58;
        const sides = leftFirst ? [-1, 1] : [1, -1];
        for (const lift of [1, 0, 2, -1, 3]) {
          for (const sd of sides) {
            const dx = sd > 0 ? 26 + Math.abs(lift) * 6 : -26 - cw - Math.abs(lift) * 6;
            const dy = -ch / 2 - lift * (ch * 0.62 + 10);
            const r = [p.x + dx, p.y + dy, cw, ch];
            r.self = dots[k];
            if (!hit(r)) { best = { dx, dy }; taken.push(r); break; }
          }
          if (best) break;
        }
      }
      const el = p.m.el;
      el.classList.toggle('bare', !best || (S.reading && p.key === S.sel));
      if (best) {
        captions++;
        const ex = best.dx > 0 ? best.dx : best.dx + cw, ey = best.dy + ch / 2;
        const len = Math.max(0, Math.hypot(ex, ey) - 9), ang = Math.atan2(ey, ex);
        const v = `${best.dx.toFixed(0)}|${best.dy.toFixed(0)}`;
        if (el.dataset.cap !== v) {
          el.dataset.cap = v;
          el.style.setProperty('--cx', best.dx.toFixed(0) + 'px');
          el.style.setProperty('--cy', best.dy.toFixed(0) + 'px');
          el.style.setProperty('--ll', len.toFixed(0) + 'px');
          el.style.setProperty('--la', ang.toFixed(3) + 'rad');
          el.classList.toggle('left', best.dx < 0);
        }
      }
    });
  }
  function overlayHook() {
    const box = $('.cnp-marks');
    if (!S.owns || S.mode === 'leave') { if (box.dataset.on) { box.dataset.on = ''; for (const m of marks.values()) { m.el.classList.remove('on'); m.on = false; } for (const l of dirLabels.values()) l.el.classList.remove('on'); } return; }
    box.dataset.on = '1';
    const W = canvas.clientWidth, H = canvas.clientHeight;
    const settled = !tween;
    const rel = S.sel ? new Set(related(works, S.sel).map((r) => r.work.id)) : null;
    const lensed = S.lens === 'all' ? null : new Set(lensOf(works, S.lens).map((w) => w.id));
    const placed = [];
    for (const [key, m] of marks) {
      let P, show;
      if (m.ghost) { P = rosPos(table.get(m.ghost)[0]); show = settled && S.dir === m.ghost && !S.reading; }
      else {
        P = drawnAt(posOf.get(key));
        show = settled && (S.reading ? (key === S.sel || rel?.has(key)) : S.dir ? m.w.direction === S.dir : false);
        if (show && lensed && !lensed.has(key) && key !== S.sel) show = false;
      }
      let x = 0, y = 0;
      if (show) {
        tmp.copy(P).project(camera);
        x = (tmp.x * 0.5 + 0.5) * W; y = (-tmp.y * 0.5 + 0.5) * H;
        show = tmp.z < 1 && x > 12 && x < W - 12 && y > 60 && y < H - 60;
        if (show && S.reading && innerWidth > 860 && x > W * 0.56) show = false;
      }
      if (show !== m.on) { m.on = show; m.el.classList.toggle('on', show); }
      if (show) {
        // while the camera rests a label holds completely still (V4's rule for links: the breath of the
        // camera must not make a target creep under the pointer); it follows the leaf when the view moves
        const px = m.px ?? -1e4, py = m.py ?? -1e4;
        if (!settled || Math.abs(x - px) > 3 || Math.abs(y - py) > 3) {
          m.px = x; m.py = y;
          m.el.dataset.at = `${x.toFixed(0)},${y.toFixed(0)}`;
          m.el.style.transform = `translate3d(${x.toFixed(0)}px, ${y.toFixed(0)}px, 0)`;
        } else { x = px; y = py; }
        placed.push({ m, x, y, key });
        m.el.classList.toggle('sel', key === S.sel);
      }
    }
    layoutCaptions(placed, W, H);
    // the five limbs' names over the whole crown: nearest the camera first; a name that would
    // overprint another steps up above it (its hairline grows to reach the limb)
    const names = [];
    for (const [id, l] of dirLabels) {
      let show = settled && !S.dir;
      if (show) {
        tmp.copy(l.at).project(camera);
        const x = (tmp.x * 0.5 + 0.5) * W, y = (-tmp.y * 0.5 + 0.5) * H;
        show = tmp.z < 1 && x > 40 && x < W - 40 && y > 80 && y < H - 80;
        if (show) names.push({ l, x, y, z: tmp.z });
        l.el.querySelector('small').textContent = `${byId(id).en} · ${inDir(id).length} 件`;
      }
      l.el.classList.toggle('on', show);
    }
    names.sort((a, b) => a.z - b.z);
    const put = [];
    for (const n of names) {
      let dy = 0;
      for (let k = 0; k < 6; k++) {
        const clash = put.some((q) => Math.abs(q.x - n.x) < 128 && Math.abs(q.y - (n.y - dy)) < 46);
        if (!clash) break;
        dy += 48;
      }
      put.push({ x: n.x, y: n.y - dy });
      n.l.el.style.transform = `translate3d(${n.x.toFixed(0)}px, ${n.y.toFixed(0)}px, 0) translate(-50%, -100%)`;
      n.l.el.style.setProperty('--stem', (22 + dy).toFixed(0) + 'px');
    }
  }
  /** V4's details shot: a tap on a work leaf (when one is in frame) opens it. */
  function tap(e) {
    if (S.owns || Math.abs(state.p - STUDY) > 0.05 || !works.length) return false;
    const id = pick(e);
    if (!id) return false;
    found(id);
    return true;
  }
  /** called by home.js once the page has settled on its start chapter */
  function arrive(entry) {
    const h = parseHash(entry?.hash || '');
    if (!h || h.shot) return;
    ready.then(() => {
      if (h.work) restoring = { work: h.work };
      else restoring = { ...h, soft: false };
      // a fresh deep link builds the steps Back walks down; a reload of our own entry keeps them
      if (!entry.state?.cnp) history.replaceState(null, '', '#leaves');
    });
  }

  const api = {
    get mode() { return S.mode; },
    get works() { return works; },
    ready,
    info: () => ({ mode: S.mode, owns: S.owns, dir: S.dir, lens: S.lens, sel: S.sel, reading: S.reading, status: S.status, works: works.length, mix: +S.mix.toFixed(3), moving: !!tween, hash: location.hash,
      cam: cur && { eye: cur.eye.toArray().map((v) => +v.toFixed(2)), fov: +cur.fov.toFixed(1) } }),
    enter: (dir = 'photo') => enter({ dir }),
    exit: () => exit(),
    dir: (id) => setDir(id),
    open: (id) => open(id),
    close: () => closeWork(),
    find: (id) => found(id),
    lens: (id) => { S.lens = id; syncChrome(); },
    chain: () => walkChain(),
    quiet: (on = true) => setQuiet(on),
    /** finish any camera move now (stills and tests) */
    settle() {
      if (tween) { const b = tween.b, d = tween.done; Object.assign(cur, { eye: b.eye.clone(), look: b.look.clone(), fov: b.fov, auth: b.auth || 0 }); tween = null; d?.(); }
      S.mix = S.owns ? 1 : 0; S.cascade = -1;
      const g = S.owns ? openGoal() : null;
      if (g) setOpen(g.C, g.toward, g.amt, g.R, g.deep); else { OPEN.amt = 0; UNIFORMS.uOpenC.value.w = 0; }
    },
    openScale(k = 1) { openScale = k; },
    get opening() { return { amt: +OPEN.amt.toFixed(3), C: OPEN.C.toArray().map((v) => +v.toFixed(2)), R: OPEN.R }; },
    /** review stills: hold the current camera move at u (0…1); release with hold(null) */
    hold(u) { if (tween) { if (u === null) { tween.t0 = performance.now() - (tween.hold ?? 0) * tween.dur; delete tween.hold; } else tween.hold = u; } },
    /** integration: give the input back for a moment (e.g. a global menu) and take it again */
    suspend() { if (S.owns) { cam.enabled = false; canvas.style.touchAction = ''; } },
    resume() { if (S.owns) canvas.style.touchAction = 'none'; },
    /** where a work's leaf is (world position) and where it is on screen */
    leaf: (id) => posOf.get(id)?.toArray(),
    project: (id) => { const P = posOf.get(id); if (!P) return null; const v = drawnAt(P).clone().project(camera); const r = canvas.getBoundingClientRect(); return [(v.x * 0.5 + 0.5) * r.width + r.left, (-v.y * 0.5 + 0.5) * r.height + r.top, v.z]; },
    slots: (dir, n = 8) => table.get(dir).slice(0, n),
    limbHome: (id) => limbHome(byId(id))
  };
  return { tick, grow, light: lightHook, camera: cameraHook, overlay: overlayHook, tap, arrive, api };
}
