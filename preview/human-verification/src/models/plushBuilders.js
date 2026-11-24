/**
 * HAIZ Human Verification — 6 Original Sculpted 3D Campus Plushies
 * Every character is modular, organically rounded, and crafted with distinct silhouettes.
 */

import { createCapsuleGeometry, createGlassEye, createCheekBlush } from './materials.js';
import { getRegisteredCustomPlushies } from './plushCatalog.js';

function enableShadows(root) {
  root.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  return root;
}

/**
 * 1. 椰阳小黄鸭 (Sunshine Duck) — Buttercup velvet duckling with jaunty woven straw sun-hat.
 */
function buildSunshineDuck(THREE, matLib) {
  const root = new THREE.Group();
  const bodyMat = matLib.makePlush(0xf8cc3e, { roughness: 0.86 });
  const billMat = matLib.makeSatinPlastic(0xee7432, 0.34);
  const hatMat = matLib.makePlush(0xdfc088, { straw: true, roughness: 0.92, bumpScale: 0.03 });
  const ribbonMat = matLib.makePlush(0x3a6f8f, { roughness: 0.82 });

  // Plump pear-shaped body
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.36, 28, 22), bodyMat);
  body.scale.set(1.06, 0.88, 1.12);
  body.position.set(0, 0.30, -0.02);
  root.add(body);

  // Cute upturned tail tuft
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.22, 16), bodyMat);
  tail.position.set(0, 0.42, -0.36);
  tail.rotation.x = -0.82;
  root.add(tail);

  // Rounded head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 28, 22), bodyMat);
  head.scale.set(1.02, 0.96, 1.0);
  head.position.set(0, 0.68, 0.06);
  root.add(head);

  // Sculpted upper & lower bill
  const upperBill = new THREE.Mesh(new THREE.SphereGeometry(0.125, 22, 16), billMat);
  upperBill.scale.set(1.18, 0.46, 0.95);
  upperBill.position.set(0, 0.635, 0.33);
  root.add(upperBill);

  const lowerBill = new THREE.Mesh(new THREE.SphereGeometry(0.095, 18, 14), billMat);
  lowerBill.scale.set(1.05, 0.34, 0.84);
  lowerBill.position.set(0, 0.59, 0.30);
  root.add(lowerBill);

  // Soft side wings
  [-1, 1].forEach((side) => {
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 14), bodyMat);
    wing.scale.set(0.42, 0.82, 1.15);
    wing.position.set(side * 0.35, 0.34, -0.02);
    wing.rotation.z = side * -0.28;
    wing.rotation.y = side * 0.18;
    root.add(wing);

    const eye = createGlassEye(THREE, matLib, 0.042);
    eye.position.set(side * 0.125, 0.72, 0.295);
    root.add(eye);

    const blush = createCheekBlush(THREE, matLib, 0.05, 0.03);
    blush.position.set(side * 0.175, 0.645, 0.265);
    blush.rotation.y = side * 0.42;
    root.add(blush);
  });

  // Jaunty miniature Hainan straw sun-hat
  const hatGroup = new THREE.Group();
  hatGroup.position.set(0.04, 0.92, 0.04);
  hatGroup.rotation.set(-0.14, 0.1, -0.18);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.028, 28), hatMat);
  hatGroup.add(brim);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.15, 0.12, 24), hatMat);
  crown.position.y = 0.065;
  hatGroup.add(crown);
  const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.016, 10, 28), ribbonMat);
  ribbon.rotation.x = Math.PI / 2;
  ribbon.position.y = 0.022;
  hatGroup.add(ribbon);
  root.add(hatGroup);

  root.userData.grabHeight = 0.76;
  return enableShadows(root);
}

/**
 * 2. 榄仁小芽 (Lanren Leaf Spirit) — Cream plush teardrop wearing a sculpted almond-leaf beret & acorn charm.
 */
function buildLanrenSpirit(THREE, matLib) {
  const root = new THREE.Group();
  const creamMat = matLib.makePlush(0xf4ecdc, { roughness: 0.88 });
  const leafGreenMat = matLib.makePlush(0x4c8d59, { roughness: 0.84 });
  const leafTipMat = matLib.makePlush(0xc77738, { roughness: 0.85 });
  const stemMat = matLib.makePlush(0x6c4c34, { roughness: 0.90 });
  const acornMat = matLib.makeSatinPlastic(0xb8763e, 0.35);

  // Teardrop plush body
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.33, 28, 22), creamMat);
  body.scale.set(1.0, 1.12, 0.96);
  body.position.set(0, 0.38, 0);
  root.add(body);

  // Stubby cozy arms & feet
  [-1, 1].forEach((side) => {
    const arm = new THREE.Mesh(createCapsuleGeometry(THREE, 0.072, 0.14, 8, 16), creamMat);
    arm.position.set(side * 0.31, 0.38, 0.05);
    arm.rotation.z = side * 0.52;
    root.add(arm);

    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), creamMat);
    foot.scale.set(1.0, 0.65, 1.35);
    foot.position.set(side * 0.14, 0.07, 0.09);
    root.add(foot);

    const eye = createGlassEye(THREE, matLib, 0.04);
    eye.position.set(side * 0.105, 0.50, 0.285);
    root.add(eye);

    const blush = createCheekBlush(THREE, matLib, 0.048, 0.028);
    blush.position.set(side * 0.165, 0.435, 0.27);
    blush.rotation.y = side * 0.35;
    root.add(blush);
  });

  // Sculpted Terminalia catappa (榄仁叶) layered beret cap
  const beretGroup = new THREE.Group();
  beretGroup.position.set(0, 0.70, 0);
  beretGroup.rotation.set(-0.08, 0.12, -0.06);

  const mainLeaf = new THREE.Mesh(new THREE.SphereGeometry(0.32, 28, 18), leafGreenMat);
  mainLeaf.scale.set(1.16, 0.36, 1.06);
  beretGroup.add(mainLeaf);

  // Autumn-tinted secondary almond leaf overlapping
  const autumnLeaf = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 14), leafTipMat);
  autumnLeaf.scale.set(1.35, 0.26, 0.78);
  autumnLeaf.position.set(0.18, 0.05, -0.04);
  autumnLeaf.rotation.set(0.12, -0.35, -0.22);
  beretGroup.add(autumnLeaf);

  // Tiny twig stem on top
  const stem = new THREE.Mesh(createCapsuleGeometry(THREE, 0.022, 0.11, 6, 12), stemMat);
  stem.position.set(0.01, 0.14, -0.02);
  stem.rotation.z = -0.22;
  beretGroup.add(stem);
  root.add(beretGroup);

  // Leaf-collar & wooden acorn charm
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.032, 10, 28), leafGreenMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0.29, 0.02);
  root.add(collar);

  const acorn = new THREE.Mesh(new THREE.SphereGeometry(0.052, 14, 12), acornMat);
  acorn.scale.set(0.9, 1.15, 0.9);
  acorn.position.set(0, 0.24, 0.275);
  root.add(acorn);

  root.userData.grabHeight = 0.72;
  return enableShadows(root);
}

/**
 * 3. 校园橘猫 (Campus Ginger Cat) — Plump ginger-and-cream seated plushie with collar bell & curled tail.
 */
function buildCampusCat(THREE, matLib) {
  const root = new THREE.Group();
  const gingerMat = matLib.makePlush(0xe5974e, { roughness: 0.87 });
  const creamMat = matLib.makePlush(0xf7efe4, { roughness: 0.88 });
  const stripeMat = matLib.makePlush(0xc7742e, { roughness: 0.89 });
  const innerEarMat = matLib.makePlush(0xf0b8ae, { roughness: 0.90 });
  const collarMat = matLib.makePlush(0xb84f3e, { roughness: 0.82 });
  const brassMat = matLib.makeBrushedMetal(0xe3c268, 0.22, 0.85);

  // Seated body
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 26, 20), gingerMat);
  body.scale.set(1.04, 0.96, 1.0);
  body.position.set(0, 0.29, 0);
  root.add(body);

  // Cream belly patch
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.24, 22, 16), creamMat);
  belly.scale.set(0.95, 0.92, 0.62);
  belly.position.set(0, 0.26, 0.18);
  root.add(belly);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 26, 20), gingerMat);
  head.scale.set(1.12, 0.95, 0.98);
  head.position.set(0, 0.67, 0.03);
  root.add(head);

  // Cream muzzle puffs
  [-1, 1].forEach((side) => {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.088, 16, 14), creamMat);
    puff.scale.set(1.15, 0.85, 0.92);
    puff.position.set(side * 0.068, 0.60, 0.27);
    root.add(puff);

    // Triangular cat ears
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.105, 0.21, 16), gingerMat);
    ear.position.set(side * 0.185, 0.93, 0.01);
    ear.rotation.z = side * -0.26;
    root.add(ear);

    const innerEar = new THREE.Mesh(new THREE.ConeGeometry(0.058, 0.13, 12), innerEarMat);
    innerEar.position.set(side * 0.185, 0.92, 0.048);
    innerEar.rotation.z = side * -0.26;
    root.add(innerEar);

    const eye = createGlassEye(THREE, matLib, 0.041);
    eye.position.set(side * 0.118, 0.695, 0.28);
    root.add(eye);

    const blush = createCheekBlush(THREE, matLib, 0.046, 0.026);
    blush.position.set(side * 0.19, 0.625, 0.24);
    blush.rotation.y = side * 0.48;
    root.add(blush);

    // Little cream paws
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.082, 16, 12), creamMat);
    paw.scale.set(1.0, 0.78, 1.2);
    paw.position.set(side * 0.14, 0.11, 0.26);
    root.add(paw);
  });

  // Tiny pink nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), innerEarMat);
  nose.scale.set(1.2, 0.85, 0.8);
  nose.position.set(0, 0.635, 0.325);
  root.add(nose);

  // Forehead tabby stripes
  [-0.065, 0, 0.065].forEach((offset, idx) => {
    const stripe = new THREE.Mesh(createCapsuleGeometry(THREE, 0.016, idx === 1 ? 0.085 : 0.06, 6, 10), stripeMat);
    stripe.position.set(offset, 0.835, 0.22);
    stripe.rotation.x = 0.45;
    stripe.rotation.z = -offset * 2.1;
    root.add(stripe);
  });

  // Terracotta collar + brushed brass bell
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.215, 0.028, 10, 26), collarMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0.44, 0.03);
  root.add(collar);

  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.048, 16, 14), brassMat);
  bell.position.set(0, 0.405, 0.245);
  root.add(bell);

  // Curled tail hugging right side
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.052, 12, 22, Math.PI * 1.15), gingerMat);
  tail.position.set(0.24, 0.17, -0.14);
  tail.rotation.set(Math.PI / 2.2, 0.2, -0.7);
  root.add(tail);

  root.userData.grabHeight = 0.76;
  return enableShadows(root);
}

/**
 * 4. 书包小棕熊 (Schoolbag Bear) — Cocoa fleece bear wearing sky-blue collared vest & ochre satchel.
 */
function buildSchoolbagBear(THREE, matLib) {
  const root = new THREE.Group();
  const furMat = matLib.makePlush(0x9b6e50, { roughness: 0.88 });
  const snoutMat = matLib.makePlush(0xebd8c1, { roughness: 0.89 });
  const noseMat = matLib.makeSatinPlastic(0x3a261d, 0.28);
  const vestMat = matLib.makePlush(0x7ac0e6, { corduroy: true, roughness: 0.84, bumpScale: 0.022 });
  const collarMat = matLib.makePlush(0xf7f8fa, { roughness: 0.85 });
  const bagMat = matLib.makePlush(0xd97d36, { roughness: 0.82 });
  const buckleMat = matLib.makeBrushedMetal(0xdcb963, 0.25, 0.84);

  // Body wearing sky-blue HAIZ-inspired knit vest
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.32, 26, 20), vestMat);
  torso.scale.set(1.02, 1.04, 0.94);
  torso.position.set(0, 0.31, 0);
  root.add(torso);

  // Crisp white shirt collar peek
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.036, 10, 24), collarMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0.49, 0.01);
  root.add(collar);

  // Bear head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 26, 20), furMat);
  head.scale.set(1.06, 0.97, 0.98);
  head.position.set(0, 0.72, 0.02);
  root.add(head);

  // Cream muzzle + chocolate nose
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.115, 18, 14), snoutMat);
  snout.scale.set(1.15, 0.86, 0.9);
  snout.position.set(0, 0.66, 0.26);
  root.add(snout);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.036, 14, 12), noseMat);
  nose.scale.set(1.22, 0.84, 0.8);
  nose.position.set(0, 0.69, 0.355);
  root.add(nose);

  [-1, 1].forEach((side) => {
    // Round bear ears
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.092, 18, 14), furMat);
    ear.scale.set(1.0, 1.0, 0.62);
    ear.position.set(side * 0.22, 0.95, 0.0);
    root.add(ear);

    const earIn = new THREE.Mesh(new THREE.SphereGeometry(0.052, 14, 12), snoutMat);
    earIn.scale.set(1.0, 1.0, 0.5);
    earIn.position.set(side * 0.22, 0.945, 0.035);
    root.add(earIn);

    const eye = createGlassEye(THREE, matLib, 0.039);
    eye.position.set(side * 0.112, 0.755, 0.265);
    root.add(eye);

    const blush = createCheekBlush(THREE, matLib, 0.044, 0.026);
    blush.position.set(side * 0.175, 0.685, 0.24);
    blush.rotation.y = side * 0.4;
    root.add(blush);

    // Arms
    const arm = new THREE.Mesh(createCapsuleGeometry(THREE, 0.078, 0.18, 8, 14), furMat);
    arm.position.set(side * 0.33, 0.36, 0.04);
    arm.rotation.z = side * 0.42;
    root.add(arm);

    // Seated legs
    const leg = new THREE.Mesh(createCapsuleGeometry(THREE, 0.088, 0.15, 8, 14), furMat);
    leg.position.set(side * 0.16, 0.10, 0.22);
    leg.rotation.x = Math.PI / 2.2;
    root.add(leg);

    // Ochre backpack shoulder straps across chest
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.024, 8, 22), bagMat);
    strap.position.set(side * 0.19, 0.36, 0.02);
    strap.rotation.y = Math.PI / 2;
    root.add(strap);

    // Brass strap buckle
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.036, 0.022), buckleMat);
    buckle.position.set(side * 0.19, 0.33, 0.19);
    root.add(buckle);
  });

  // Ochre-orange school backpack mounted on back
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.32, 0.16), bagMat);
  bag.position.set(0, 0.34, -0.30);
  root.add(bag);
  const flap = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.11, 0.175), bagMat);
  flap.position.set(0, 0.45, -0.30);
  root.add(flap);

  root.userData.grabHeight = 0.79;
  return enableShadows(root);
}

/**
 * 5. 潮汐小鲸 (Tide Whale) — Cerulean plush whale with cream corduroy belly & pearlescent water-drop crest.
 */
function buildOceanWhale(THREE, matLib) {
  const root = new THREE.Group();
  const whaleMat = matLib.makePlush(0x5c96be, { roughness: 0.85 });
  const bellyMat = matLib.makePlush(0xf2ece0, { corduroy: true, roughness: 0.88, bumpScale: 0.028 });
  const dropMat = matLib.makeSatinPlastic(0xc8ecff, 0.14);

  // Plump whale body
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.36, 28, 22), whaleMat);
  body.scale.set(1.08, 0.88, 1.18);
  body.position.set(0, 0.34, 0.02);
  root.add(body);

  // Cream corduroy underbelly
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.33, 24, 18), bellyMat);
  belly.scale.set(1.02, 0.56, 1.12);
  belly.position.set(0, 0.21, 0.07);
  root.add(belly);

  // Side flippers & eyes
  [-1, 1].forEach((side) => {
    const flipper = new THREE.Mesh(new THREE.SphereGeometry(0.14, 18, 14), whaleMat);
    flipper.scale.set(1.25, 0.36, 0.72);
    flipper.position.set(side * 0.39, 0.24, 0.05);
    flipper.rotation.z = side * -0.25;
    flipper.rotation.y = side * -0.22;
    root.add(flipper);

    const eye = createGlassEye(THREE, matLib, 0.042);
    eye.position.set(side * 0.21, 0.38, 0.35);
    root.add(eye);

    const blush = createCheekBlush(THREE, matLib, 0.055, 0.032);
    blush.position.set(side * 0.27, 0.31, 0.30);
    blush.rotation.y = side * 0.55;
    root.add(blush);
  });

  // Upturned heart tail fluke
  const tailStem = new THREE.Mesh(createCapsuleGeometry(THREE, 0.095, 0.22, 8, 16), whaleMat);
  tailStem.position.set(0, 0.38, -0.39);
  tailStem.rotation.x = -0.68;
  root.add(tailStem);

  [-1, 1].forEach((side) => {
    const fluke = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 12), whaleMat);
    fluke.scale.set(1.28, 0.32, 0.76);
    fluke.position.set(side * 0.13, 0.52, -0.47);
    fluke.rotation.z = side * 0.32;
    fluke.rotation.y = side * 0.28;
    root.add(fluke);
  });

  // Pearlescent water-droplet tuft on crown
  const drop = new THREE.Mesh(new THREE.SphereGeometry(0.068, 18, 14), dropMat);
  drop.scale.set(0.85, 1.32, 0.85);
  drop.position.set(0, 0.72, 0.04);
  root.add(drop);

  root.userData.grabHeight = 0.62;
  return enableShadows(root);
}

/**
 * 6. 坡鹿小团 (Hainan Fawn) — Cinnamon Eld's deer with cream dapples, velvety antlers & Li-woven scarf.
 */
function buildHainanFawn(THREE, matLib) {
  const root = new THREE.Group();
  const fawnMat = matLib.makePlush(0xc78b60, { roughness: 0.88 });
  const creamMat = matLib.makePlush(0xf5ead8, { roughness: 0.89 });
  const antlerMat = matLib.makePlush(0x7c5a43, { roughness: 0.86 });
  const scarfMat = matLib.makePlush(0xb64f40, { corduroy: true, roughness: 0.84 });
  const scarfTrimMat = matLib.makePlush(0x365470, { roughness: 0.85 });
  const noseMat = matLib.makeSatinPlastic(0x3b261c, 0.26);

  // Body
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.30, 26, 20), fawnMat);
  body.scale.set(0.96, 1.02, 1.05);
  body.position.set(0, 0.29, 0);
  root.add(body);

  // Cream belly & delicate dorsal dapples
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 14), creamMat);
  belly.scale.set(0.92, 0.9, 0.58);
  belly.position.set(0, 0.26, 0.18);
  root.add(belly);

  [
    [-0.14, 0.36, -0.22],
    [0.12, 0.40, -0.20],
    [-0.04, 0.28, -0.28],
    [0.16, 0.26, -0.24]
  ].forEach(([dx, dy, dz]) => {
    const spot = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 10), creamMat);
    spot.position.set(dx, dy, dz);
    root.add(spot);
  });

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.265, 26, 20), fawnMat);
  head.scale.set(1.02, 1.0, 1.06);
  head.position.set(0, 0.68, 0.04);
  root.add(head);

  // Cream muzzle & nose
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.095, 16, 14), creamMat);
  muzzle.scale.set(1.12, 0.86, 0.95);
  muzzle.position.set(0, 0.625, 0.26);
  root.add(muzzle);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), noseMat);
  nose.position.set(0, 0.655, 0.34);
  root.add(nose);

  [-1, 1].forEach((side) => {
    // Leaf-shaped deer ears
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), fawnMat);
    ear.scale.set(1.25, 0.52, 0.42);
    ear.position.set(side * 0.26, 0.82, 0.0);
    ear.rotation.z = side * 0.38;
    root.add(ear);

    // Velvety nub antlers
    const antler = new THREE.Mesh(createCapsuleGeometry(THREE, 0.026, 0.14, 6, 12), antlerMat);
    antler.position.set(side * 0.10, 0.96, 0.01);
    antler.rotation.z = side * -0.24;
    root.add(antler);

    const tine = new THREE.Mesh(createCapsuleGeometry(THREE, 0.018, 0.075, 6, 10), antlerMat);
    tine.position.set(side * 0.15, 0.99, 0.03);
    tine.rotation.z = side * -0.82;
    root.add(tine);

    const eye = createGlassEye(THREE, matLib, 0.04);
    eye.position.set(side * 0.112, 0.71, 0.255);
    root.add(eye);

    const blush = createCheekBlush(THREE, matLib, 0.044, 0.026);
    blush.position.set(side * 0.17, 0.64, 0.23);
    blush.rotation.y = side * 0.44;
    root.add(blush);

    const hoof = new THREE.Mesh(createCapsuleGeometry(THREE, 0.068, 0.14, 6, 12), antlerMat);
    hoof.position.set(side * 0.13, 0.09, 0.21);
    hoof.rotation.x = Math.PI / 2.2;
    root.add(hoof);
  });

  // Woven terracotta & indigo knit scarf
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.215, 0.052, 12, 26), scarfMat);
  scarf.rotation.x = Math.PI / 2;
  scarf.position.set(0, 0.47, 0.03);
  root.add(scarf);

  const scarfTail = new THREE.Mesh(createCapsuleGeometry(THREE, 0.045, 0.17, 6, 12), scarfTrimMat);
  scarfTail.position.set(0.11, 0.36, 0.23);
  scarfTail.rotation.z = 0.24;
  root.add(scarfTail);

  root.userData.grabHeight = 0.78;
  return enableShadows(root);
}

const BUILTIN_BUILDERS = {
  'sunshine-duck': buildSunshineDuck,
  'lanren-spirit': buildLanrenSpirit,
  'campus-cat': buildCampusCat,
  'schoolbag-bear': buildSchoolbagBear,
  'ocean-whale': buildOceanWhale,
  'hainan-fawn': buildHainanFawn
};

export function buildPlushMesh(THREE, matLib, plushId) {
  const custom = getRegisteredCustomPlushies();
  if (custom.has(plushId)) {
    return enableShadows(custom.get(plushId).builderFn(THREE, matLib));
  }
  const builder = BUILTIN_BUILDERS[plushId] || buildSunshineDuck;
  return builder(THREE, matLib);
}
