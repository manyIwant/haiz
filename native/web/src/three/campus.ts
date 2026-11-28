// @ts-nocheck — three.js scene code
/**
 * 校园 · the real campus as one homologous scene (006).
 *
 * Buildings: architecture.glb — the Blender V3 models of 26 SITE_* nodes that Experiment 003 drew
 * (一号教学楼's portico and 43k window panes, 北门's glazed tiles, the library dome …), in the
 * campus model's own coordinates. Experiment 005 had replaced them with rounded prisms; 006 puts
 * the real models back, and the line drawing is again derived from them, pixel for pixel.
 * Ground: roads, lawns, the field, ponds and gardens from the same campus.json, laid as thin slabs
 * so they draw as a plan. Trees: the 300 surveyed trees as soft crowns; the 榄仁 among them wear
 * this month's leaf colour (season.js), so the map and the 榄仁 page agree.
 *
 * plan px → metres:  X = (px − 900) · 0.167,  Z = −(py − 784) · 0.167   (campus.json meta.transform)
 */
import * as THREE from "three";
import { loadArchitecture } from "./assets";
import { makeNormalIdMaterial, type HomologousStage } from "./homologous";
import { seasonAt, leafColour } from "../culture/season";

const OX = 900, OY = 784, S = 0.167;
const wx = (px: number) => (px - OX) * S;
const wz = (py: number) => -(py - OY) * S;

export type Place = { id: string; key: string; name: string; category: string; box: THREE.Box3; node: THREE.Object3D; top: THREE.Vector3 };

const FLAT_COL: Record<string, number> = { field: 0x6f9150, botanic: 0x86a066, garden: 0x8fa874, pond: 0x7da2ab };

/**
 * Native 001 · the campus is built once per month and re-attached on later visits (its buffers and
 * programs stay resident on the shared renderer instead of being rebuilt and re-uploaded).
 */
const built = new Map<string, Promise<any>>();
export async function mountCampus(stage: HomologousStage, campus: any, { month = 10 } = {}) {
  const key = String(month);
  if (!built.has(key)) built.set(key, buildCampus(campus, month));
  const c = await built.get(key)!;
  stage.scene.add(c.root);
  stage.registerObject(c.root, { customNd: (o) => (o === c.crowns ? c.crownNd : null) });
  // sun over the campus, a shadow box that covers it
  const sun = stage.sun;
  sun.position.set(140, 220, 120);
  Object.assign(sun.shadow.camera, { left: -260, right: 260, top: 260, bottom: -260, near: 10, far: 900 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.mapSize.set(2048, 2048);
  stage.renderer.shadowMap.needsUpdate = true;
  return c.result;
}

async function buildCampus(campus: any, month: number) {
  const gltf = await loadArchitecture();
  const root = new THREE.Group();
  const arch = gltf.scene.clone(true);
  const sites = new Map<string, THREE.Object3D>();
  arch.traverse((n) => {
    if (n.name?.startsWith("SITE_")) sites.set(n.name.slice(5), n);
    if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; }
  });
  root.add(arch);

  // ---- ground ----
  // the site plate: the extent of everything surveyed, plus a margin, so its edge sits inside the frame
  let px0 = 1e9, px1 = -1e9, py0 = 1e9, py1 = -1e9;
  const grow = (x: number, y: number) => { px0 = Math.min(px0, x); px1 = Math.max(px1, x); py0 = Math.min(py0, y); py1 = Math.max(py1, y); };
  for (const g of [...campus.roads, ...campus.lawns, ...campus.fields, ...campus.water, ...campus.buildings]) { grow(g.rect[0], g.rect[1]); grow(g.rect[2], g.rect[3]); }
  for (const t of campus.trees) grow(t.p[0], t.p[1]);
  const M = 40;
  const site = [px0 - M, py0 - M, px1 + M, py1 + M];
  const ground = new THREE.Mesh(new THREE.BoxGeometry((site[2] - site[0]) * S, 0.4, (site[3] - site[1]) * S), new THREE.MeshStandardMaterial({ name: "Ground", color: 0xdcd7c9, roughness: 0.98 }));
  ground.position.set(wx((site[0] + site[2]) / 2), -0.21, wz((site[1] + site[3]) / 2));
  ground.receiveShadow = true;
  root.add(ground);
  const slab = (r: number[], h: number, mat: THREE.Material, y = 0) => {
    const w = Math.abs(r[2] - r[0]) * S, d = Math.abs(r[3] - r[1]) * S;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(wx((r[0] + r[2]) / 2), y + h / 2, wz((r[1] + r[3]) / 2));
    m.receiveShadow = true;
    root.add(m);
    return m;
  };
  const road = new THREE.MeshStandardMaterial({ name: "Road", color: 0xc8c3b6, roughness: 0.95 });
  const lawn = new THREE.MeshStandardMaterial({ name: "Lawn", color: 0x7c9860, roughness: 0.95 });
  const water = new THREE.MeshStandardMaterial({ name: "Water", color: 0x7aa0aa, roughness: 0.25, metalness: 0.1 });
  const track = new THREE.MeshStandardMaterial({ name: "Track", color: 0xb06a4f, roughness: 0.9 });
  for (const r of campus.roads) slab(r.rect, 0.06, road);
  for (const l of campus.lawns) slab(l.rect, 0.12, lawn);
  for (const f of campus.fields) {
    slab(f.rect, 0.1, track);
    const [x0, y0, x1, y1] = f.rect, ix = (x1 - x0) * 0.16, iy = (y1 - y0) * 0.2;
    slab([x0 + ix, y0 + iy, x1 - ix, y1 - iy], 0.16, lawn);
  }
  for (const w of campus.water) slab(w.rect, 0.05, water, -0.02);

  // places: every campus.json entry that is a point of interest gets a box to pick and a node to light
  const places: Place[] = [];
  const flatMats: Record<string, THREE.Material> = {};
  campus.buildings.forEach((b: any, i: number) => {
    const key = b.id + i;
    let node: THREE.Object3D | null = sites.get(b.id) ?? null;
    if (!node && ["field", "botanic", "garden", "pond"].includes(b.form)) {
      if (b.form === "field") return; // drawn above
      flatMats[b.form] ??= new THREE.MeshStandardMaterial({ name: "Flat-" + b.form, color: FLAT_COL[b.form] ?? 0x8fa874, roughness: 0.95 });
      node = slab(b.rect, b.form === "pond" ? 0.05 : 0.14, flatMats[b.form]);
    }
    if (!node && b.form === "rock") {
      const g = new THREE.IcosahedronGeometry(1, 1);
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ name: "Taihu", color: 0x8d877b, roughness: 0.9, flatShading: true }));
      m.scale.set(b.size[0] * 0.3, b.size[1] * 0.55, b.size[2] * 0.3);
      m.position.set(wx((b.rect[0] + b.rect[2]) / 2), b.size[1] * 0.4, wz((b.rect[1] + b.rect[3]) / 2));
      m.castShadow = true;
      root.add(m); node = m;
    }
    if (!node) return;
    node.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(node);
    if (b.form === "oldtree") { /* the century tree: its crowns are added below, box from the plan */ }
    const top = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2);
    places.push({ id: b.id, key, name: b.name, category: b.category, box, node, top });
  });

  // ---- trees: soft crowns, coloured by kind; the 榄仁 by this month ----
  const doy = (month + 0.5) / 12 * 365;
  const ss = seasonAt(doy);
  const lc = leafColour(ss.turn > 0 ? Math.min(1, Math.max(0, (ss.turn - 0.25) * 0.95)) : 0, 0.3, ss.flush < 0.95 ? (1 - ss.flush) * 0.9 : 0, 0.5);
  const bare = ss.fallen > 0.85 && ss.flush < 0.12;
  const lanColor = bare ? new THREE.Color(0.24, 0.17, 0.11) : new THREE.Color(lc[0] * 1.6, lc[1] * 1.6, lc[2] * 1.6);
  const KIND: Record<string, number> = { banyan: 0x3f6b3a, palm: 0x6b8a44, kapok: 0x5b7d3e, fengling: 0x56803f, hongdou: 0x4d7340, chongyang: 0x58783a, huoyan: 0x5f7f3a, shrub: 0x6f8e4e, botanic: 0x5d8547, mixed: 0x557a40 };
  const crownGeo = new THREE.IcosahedronGeometry(1, 2);
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.2, 1, 6);
  const crownMat = new THREE.MeshStandardMaterial({ name: "Canopy", color: 0xffffff, roughness: 0.9 });
  const trunkMat = new THREE.MeshStandardMaterial({ name: "Trunk", color: 0x6b5a48, roughness: 0.9 });
  const T = campus.trees;
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, T.length);
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, T.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
  const lanIdx: number[] = [];
  T.forEach((t: any, i: number) => {
    const x = wx(t.p[0]), z = wz(t.p[1]);
    const palm = t.t === "palm";
    const r = (palm ? 1.5 : t.t === "terminalia" ? 3.1 : t.t === "banyan" ? 3.0 : t.t === "shrub" ? 1.2 : 2.3) * t.s;
    const hTrunk = (palm ? 6.5 : t.t === "shrub" ? 0.4 : 3.2) * t.h;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.r || 0);
    p.set(x, hTrunk + r * (palm ? 0.25 : 0.55), z); sc.set(r, r * (palm ? 0.45 : t.t === "terminalia" ? 0.5 : 0.72), r);
    m4.compose(p, q, sc); crowns.setMatrixAt(i, m4);
    p.set(x, hTrunk / 2, z); sc.set(1, hTrunk, 1); m4.compose(p, q, sc); trunks.setMatrixAt(i, m4);
    if (t.t === "terminalia") { crowns.setColorAt(i, lanColor); lanIdx.push(i); }
    else crowns.setColorAt(i, col.setHex(KIND[t.t] ?? 0x5a7d42).offsetHSL(0, 0, ((t.v ?? 0) - 1) * 0.03));
  });
  crowns.castShadow = true; trunks.castShadow = true;
  crowns.instanceColor.needsUpdate = true;
  root.add(crowns, trunks);
  const crownNd = makeNormalIdMaterial({ matId: 0.5 });
  crownNd.uniforms.uMatA.value = 0.89;

  // the century 榄仁 at its place: a tiered crown, on the place's box
  const lan = places.find((pl) => pl.id === "lanshu");
  if (lan) {
    const b = campus.buildings.find((x: any) => x.id === "lanshu");
    const cx = wx((b.rect[0] + b.rect[2]) / 2), cz = wz((b.rect[1] + b.rect[3]) / 2);
    const g = new THREE.Group();
    const tm = new THREE.MeshStandardMaterial({ name: "Lanren", color: lanColor, roughness: 0.85 });
    for (const [dy, r, sy] of [[5.2, 7.2, 1.6], [7.6, 5.8, 1.4], [9.6, 3.8, 1.2]]) {
      const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), tm);
      c.scale.set(r, sy, r * 0.85); c.position.set(cx, dy, cz); c.castShadow = true; g.add(c);
    }
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 5.4, 8), trunkMat);
    tr.position.set(cx, 2.7, cz); tr.castShadow = true; g.add(tr);
    root.add(g);
    lan.node = g; g.updateWorldMatrix(true, true); lan.box = new THREE.Box3().setFromObject(g);
    lan.top.set(cx, lan.box.max.y, cz);
  }

  crownNd.userData.keep = true;
  const all = new THREE.Box3().setFromObject(arch);
  const plate = new THREE.Box3().setFromObject(ground);
  return { root, crowns, crownNd, result: { root, places, bounds: all, plate, lanColor: "#" + lanColor.getHexString(), season: ss } };
}
