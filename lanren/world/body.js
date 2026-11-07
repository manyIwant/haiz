// The walker: a building-block figure in the same world as the tree (three.js r170).
//
// Only the walker is stylised: square blocks, a few pixels of texture, real joints at hip,
// knee, shoulder and elbow so the steps, the leap and the landing read. The campus and the
// tree stay as they are. Original design (HAIZ colours: a white school shirt with a green
// collar, dark green trousers, clay shoes); no game character's look is copied.
//
// In first person the head is not drawn (the eye is inside it); looking down shows the chest,
// the arms and the legs. Fifteen small meshes, five shared materials, one blob of contact
// shade under the feet: a few draw calls, nothing to load.
import * as THREE from 'three';
import { DIM, angles } from './skeleton.js';

function pixels(w, h, paint) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  paint(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// a little value noise per pixel, so a block face reads as cloth or skin rather than plastic
function noisy(g, w, h, base, k = 10, seed = 1) {
  let a = seed * 9301 + 49297;
  const rnd = () => { a = (a * 9301 + 49297) % 233280; return a / 233280; };
  const [r, gg, b] = base;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = (rnd() - 0.5) * k;
    g.fillStyle = `rgb(${r + d | 0},${gg + d | 0},${b + d | 0})`;
    g.fillRect(x, y, 1, 1);
  }
}

function materials() {
  const std = (map, rough = 0.85) => new THREE.MeshStandardMaterial({ map, roughness: rough, metalness: 0 });
  const shirt = pixels(8, 8, (g, w, h) => { noisy(g, w, h, [236, 232, 220], 9, 2); g.fillStyle = '#2f5a48'; g.fillRect(0, 0, w, 1); g.fillStyle = '#d9d3c4'; g.fillRect(3, 2, 2, 5); g.fillStyle = '#2f5a48'; g.fillRect(5, 2, 2, 1); });
  const sleeve = pixels(8, 8, (g, w, h) => { noisy(g, w, h, [236, 232, 220], 9, 3); g.fillStyle = '#d6cfbf'; g.fillRect(0, h - 1, w, 1); });
  const skin = pixels(8, 8, (g, w, h) => noisy(g, w, h, [214, 166, 128], 10, 4));
  const trousers = pixels(8, 8, (g, w, h) => { noisy(g, w, h, [44, 66, 56], 8, 5); g.fillStyle = '#1d2b25'; g.fillRect(0, 0, w, 1); });
  const shoe = pixels(8, 8, (g, w, h) => { noisy(g, w, h, [108, 84, 64], 10, 6); g.fillStyle = '#e8e2d4'; g.fillRect(0, h - 2, w, 2); });
  const hair = pixels(8, 8, (g, w, h) => { noisy(g, w, h, [214, 166, 128], 10, 7); g.fillStyle = '#231d19'; g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 1, 5); g.fillRect(w - 1, 0, 1, 5); g.fillStyle = '#2a2420'; g.fillRect(2, 4, 1, 1); g.fillRect(5, 4, 1, 1); });
  return { shirt: std(shirt), sleeve: std(sleeve), skin: std(skin, 0.7), trousers: std(trousers, 0.9), shoe: std(shoe, 0.8), hair: std(hair, 0.8) };
}

/** a block hanging from its joint (top at y = 0), optionally moved */
function block(w, h, d, mat, y = -h / 2, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(0, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function createBody() {
  const M = materials();
  const root = new THREE.Group(); root.name = 'walker';
  const hips = new THREE.Group(); root.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  torso.add(block(DIM.torsoW, DIM.torso, DIM.torsoD, M.shirt, DIM.torso / 2));
  // a belt line where the shirt meets the trousers
  torso.add(block(DIM.torsoW + 0.004, 0.08, DIM.torsoD + 0.004, M.trousers, 0.04));
  const neck = new THREE.Group(); neck.position.y = DIM.torso; torso.add(neck);
  const head = block(DIM.head, DIM.head, DIM.head, M.hair, DIM.head / 2); neck.add(head);
  const arm = (side) => {
    const sh = new THREE.Group(); sh.position.set(side * DIM.shoulderX, DIM.shoulderY, 0); torso.add(sh);
    const out = new THREE.Group(); sh.add(out);
    out.add(block(DIM.limb, DIM.upper, DIM.limb, M.sleeve));
    const el = new THREE.Group(); el.position.y = -DIM.upper; out.add(el);
    el.add(block(DIM.limb - 0.01, DIM.fore, DIM.limb - 0.01, M.skin));
    el.add(block(DIM.limb - 0.005, DIM.hand, DIM.limb + 0.01, M.skin, -DIM.fore - DIM.hand / 2));
    return { sh, out, el };
  };
  const leg = (side) => {
    const hp = new THREE.Group(); hp.position.set(side * DIM.hipW, 0, 0); hips.add(hp);
    hp.add(block(DIM.leg, DIM.thigh, DIM.legD, M.trousers));
    const kn = new THREE.Group(); kn.position.y = -DIM.thigh; hp.add(kn);
    kn.add(block(DIM.leg - 0.008, DIM.shin, DIM.legD - 0.008, M.trousers));
    kn.add(block(DIM.leg + 0.01, DIM.foot, DIM.legD + 0.07, M.shoe, -DIM.shin - DIM.foot / 2, 0.035));
    return { hp, kn };
  };
  const L = { arm: arm(1), leg: leg(1) }, R = { arm: arm(-1), leg: leg(-1) };

  // contact shade on the ground (the sun's own shadow only reaches near the tree)
  const blobTex = pixels(32, 32, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  blobTex.magFilter = blobTex.minFilter = THREE.LinearFilter;
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.renderOrder = 2;
  const group = new THREE.Group(); group.name = 'walker-group';
  group.add(root, blob);
  group.visible = false;

  let firstPerson = true;
  const api = {
    group, root, head,
    /** first person hides the head (the eye is inside it) */
    setFirstPerson(on) { firstPerson = !!on; head.visible = !firstPerson; },
    get firstPerson() { return firstPerson; },
    /**
     * Place and pose: feet at (x, y, z), facing yaw (degrees, heading), with the pose values of
     * skeleton.js. groundY: the ground under the feet (for the contact shade).
     */
    set(b, groundY = b.y) {
      const a = angles(b);
      root.position.set(b.x, b.y, b.z);
      root.rotation.y = (b.yaw * Math.PI) / 180;
      hips.position.y = a.hip;
      torso.rotation.x = a.lean;                 // leaning forward (+Z is the walker's front)
      neck.rotation.y = a.look;
      // forward-positive angles: a limb hanging down swings towards +Z with a negative x rotation
      L.leg.hp.rotation.x = -a.legL; R.leg.hp.rotation.x = -a.legR;
      L.leg.kn.rotation.x = a.kneeL; R.leg.kn.rotation.x = a.kneeR;
      L.arm.sh.rotation.x = -a.armL; R.arm.sh.rotation.x = -a.armR;
      L.arm.out.rotation.z = a.armOut; R.arm.out.rotation.z = -a.armOut;
      L.arm.el.rotation.x = -a.elbowL; R.arm.el.rotation.x = -a.elbowR;
      const above = Math.max(0, b.y - groundY);
      blob.position.set(b.x, groundY + 0.025, b.z);
      blob.material.opacity = Math.max(0, 1 - above / 3);
      blob.scale.setScalar(1 + above * 0.25);
    },
    dispose() { group.traverse((o) => { o.geometry?.dispose(); }); for (const m of Object.values(M)) { m.map?.dispose(); m.dispose(); } }
  };
  api.setFirstPerson(true);
  return api;
}
