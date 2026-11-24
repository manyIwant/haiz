/**
 * HAIZ Campus Toybox V2 — 6 Redesigned Original IP Plushies + Life Animation System
 */

import { Node3D, Mesh3D, FABRIC } from '../engine/toybox3d.js';
import {
  createSphere,
  createMochiBody,
  createCapsule,
  createCylinder,
  createCone,
  createTorus,
  createBox
} from '../engine/geometry.js';
import { getCharacterMeta, getCustomCharacterBuilder } from './characterRegistry.js';

const GEO = {
  sphere24: createSphere(1.0, 24, 18),
  sphere16: createSphere(1.0, 16, 12),
  mochiPear: createMochiBody(0.36, 0.72, 0.25, 0.34, 30, 22),
  mochiRound: createMochiBody(0.37, 0.64, 0.16, 0.30, 30, 22),
  mochiWhale: createMochiBody(0.41, 0.56, 0.18, 0.36, 30, 22),
  armStub: createCapsule(0.088, 0.13, 8, 16),
  footStub: createCapsule(0.095, 0.11, 8, 16),
  earCone: createCone(0.115, 0.22, 18),
  collarRing: createTorus(0.24, 0.036, 12, 26),
  scarfRing: createTorus(0.23, 0.062, 14, 28),
  tailCurve: createTorus(0.18, 0.056, 12, 22, Math.PI * 1.15),
  cyl16: createCylinder(1.0, 1.0, 1.0, 20),
  box1: createBox(1, 1, 1)
};

function plushMat(color, opts = {}) {
  return {
    color,
    roughness: opts.roughness ?? 0.90,
    metalness: 0.0,
    fuzz: opts.fuzz ?? 0.72,
    fabric: opts.fabric ?? FABRIC.PLUSH,
    ...opts
  };
}

function makeEye(radius = 0.044) {
  const g = new Node3D('eye');
  const ball = new Mesh3D(GEO.sphere16, {
    color: 0x161418,
    roughness: 0.06,
    metalness: 0.08,
    fuzz: 0.0,
    fabric: FABRIC.GLASS_EYE
  });
  ball.scale = [radius, radius * 1.06, radius * 0.88];
  g.add(ball);
  return g;
}

function makeBlush(rx = 0.056, ry = 0.034, color = 0xec928c) {
  const m = new Mesh3D(GEO.sphere16, {
    color,
    roughness: 0.94,
    fuzz: 0.45,
    fabric: FABRIC.PLUSH,
    castShadow: false
  });
  m.scale = [rx, ry, 0.016];
  return m;
}

function makeTinySmile(color = 0x5c3e32) {
  const m = new Mesh3D(createTorus(0.036, 0.009, 8, 14, Math.PI * 0.85), {
    color,
    roughness: 0.85,
    fuzz: 0.2,
    fabric: FABRIC.PLUSH,
    castShadow: false
  });
  m.rotation = [0, 0, Math.PI * 1.08];
  return m;
}

function buildLanrenSpirit() {
  const root = new Node3D('lanren-spirit');
  const bodyPivot = new Node3D('bodyPivot');
  root.add(bodyPivot);

  const cream = plushMat(0xf4ead7, { fuzz: 0.82 });
  const leafDark = plushMat(0x437e50, { fuzz: 0.72 });
  const leafAutumn = plushMat(0xc97438, { fuzz: 0.72 });
  const leafVein = plushMat(0x6ea877, { fuzz: 0.55 });
  const stemBrown = plushMat(0x6d4b34, { fuzz: 0.50 });
  const acornMat = { color: 0xb6723b, roughness: 0.34, metalness: 0.05, fuzz: 0.1, fabric: FABRIC.SATIN };

  const torso = new Mesh3D(GEO.mochiPear, cream, 'torso');
  torso.position = [0, 0.36, 0];
  bodyPivot.add(torso);

  const headPivot = new Node3D('headPivot');
  headPivot.position = [0, 0.50, 0.02];
  bodyPivot.add(headPivot);

  const leftEye = makeEye(0.044);
  leftEye.position = [-0.118, 0.03, 0.305];
  const rightEye = makeEye(0.044);
  rightEye.position = [0.118, 0.03, 0.305];
  headPivot.add(leftEye, rightEye);

  const lBlush = makeBlush(0.058, 0.034, 0xee968d);
  lBlush.position = [-0.185, -0.025, 0.268];
  lBlush.rotation = [0, -0.45, 0];
  const rBlush = makeBlush(0.058, 0.034, 0xee968d);
  rBlush.position = [0.185, -0.025, 0.268];
  rBlush.rotation = [0, 0.45, 0];
  headPivot.add(lBlush, rBlush);

  const smile = makeTinySmile(0x5b4435);
  smile.position = [0, 0.005, 0.325];
  headPivot.add(smile);

  const beret = new Node3D('beret');
  beret.position = [0, 0.21, -0.01];
  beret.rotation = [-0.10, 0.08, -0.05];
  headPivot.add(beret);

  const mainLeaf = new Mesh3D(GEO.sphere24, leafDark);
  mainLeaf.scale = [0.40, 0.14, 0.37];
  beret.add(mainLeaf);

  const vein = new Mesh3D(createCapsule(0.018, 0.38, 6, 12), leafVein);
  vein.position = [0, 0.125, 0.02];
  vein.rotation = [Math.PI / 2, 0, 0.12];
  beret.add(vein);

  const autumnLeaf = new Mesh3D(GEO.sphere24, leafAutumn);
  autumnLeaf.scale = [0.23, 0.065, 0.15];
  autumnLeaf.position = [0.22, 0.06, -0.02];
  autumnLeaf.rotation = [0.14, -0.35, -0.26];
  beret.add(autumnLeaf);

  const sprout = new Node3D('sprout');
  sprout.position = [0, 0.13, -0.02];
  const stem = new Mesh3D(createCapsule(0.024, 0.12, 6, 12), stemBrown);
  stem.position = [0, 0.05, 0];
  stem.rotation = [0, 0, -0.18];
  const bud = new Mesh3D(GEO.sphere16, leafVein);
  bud.scale = [0.062, 0.036, 0.042];
  bud.position = [0.05, 0.115, 0.01];
  bud.rotation = [0, 0, 0.38];
  sprout.add(stem, bud);
  beret.add(sprout);

  const collar = new Mesh3D(GEO.collarRing, leafDark);
  collar.position = [0, 0.33, 0.02];
  collar.rotation = [Math.PI / 2, 0, 0];
  collar.scale = [1.22, 1.15, 0.85];
  bodyPivot.add(collar);

  const acorn = new Mesh3D(GEO.sphere16, acornMat);
  acorn.scale = [0.052, 0.062, 0.052];
  acorn.position = [0, 0.27, 0.31];
  bodyPivot.add(acorn);

  const leftArm = new Mesh3D(GEO.armStub, cream, 'leftArm');
  leftArm.position = [-0.34, 0.33, 0.06];
  leftArm.rotation = [0, 0, 0.65];
  const rightArm = new Mesh3D(GEO.armStub, cream, 'rightArm');
  rightArm.position = [0.34, 0.33, 0.06];
  rightArm.rotation = [0, 0, -0.65];
  bodyPivot.add(leftArm, rightArm);

  [-1, 1].forEach((s) => {
    const foot = new Mesh3D(GEO.footStub, cream);
    foot.position = [s * 0.145, 0.075, 0.12];
    foot.rotation = [Math.PI / 2.2, s * -0.15, 0];
    bodyPivot.add(foot);
  });

  root.userData.grabHeight = 0.78;
  return { root, parts: { bodyPivot, headPivot, leftEye, rightEye, leftArm, rightArm, accessory: sprout, beret } };
}

function buildSunshineDuck() {
  const root = new Node3D('sunshine-duck');
  const bodyPivot = new Node3D('bodyPivot');
  root.add(bodyPivot);

  const yellow = plushMat(0xf4c43d, { fuzz: 0.84 });
  const creamBelly = plushMat(0xfbf1d4, { fuzz: 0.80 });
  const billMat = { color: 0xe9773f, roughness: 0.38, metalness: 0.02, fuzz: 0.18, fabric: FABRIC.SATIN };
  const hatStraw = plushMat(0xdec087, { fabric: FABRIC.WOVEN, fuzz: 0.35, roughness: 0.90 });
  const ribbonBlue = plushMat(0x3b7196, { fuzz: 0.55 });

  const body = new Mesh3D(GEO.mochiRound, yellow);
  body.position = [0, 0.31, -0.02];
  body.scale = [1.06, 0.98, 1.08];
  bodyPivot.add(body);

  const belly = new Mesh3D(GEO.sphere24, creamBelly);
  belly.scale = [0.27, 0.22, 0.18];
  belly.position = [0, 0.25, 0.23];
  bodyPivot.add(belly);

  const tail = new Mesh3D(GEO.earCone, yellow);
  tail.position = [0, 0.37, -0.37];
  tail.rotation = [-0.95, 0, 0];
  tail.scale = [1.0, 0.85, 1.0];
  bodyPivot.add(tail);

  const headPivot = new Node3D('headPivot');
  headPivot.position = [0, 0.63, 0.05];
  bodyPivot.add(headPivot);

  const head = new Mesh3D(GEO.sphere24, yellow);
  head.scale = [0.32, 0.295, 0.30];
  headPivot.add(head);

  const upperBill = new Mesh3D(GEO.sphere24, billMat);
  upperBill.scale = [0.135, 0.056, 0.11];
  upperBill.position = [0, -0.04, 0.29];
  const lowerBill = new Mesh3D(GEO.sphere16, billMat);
  lowerBill.scale = [0.105, 0.036, 0.088];
  lowerBill.position = [0, -0.085, 0.265];
  headPivot.add(upperBill, lowerBill);

  const leftEye = makeEye(0.043);
  leftEye.position = [-0.142, 0.03, 0.262];
  const rightEye = makeEye(0.043);
  rightEye.position = [0.142, 0.03, 0.262];
  headPivot.add(leftEye, rightEye);

  const lBlush = makeBlush(0.056, 0.034, 0xf29384);
  lBlush.position = [-0.215, -0.04, 0.215];
  lBlush.rotation = [0, -0.58, 0];
  const rBlush = makeBlush(0.056, 0.034, 0xf29384);
  rBlush.position = [0.215, -0.04, 0.215];
  rBlush.rotation = [0, 0.58, 0];
  headPivot.add(lBlush, rBlush);

  const hat = new Node3D('hat');
  hat.position = [0.05, 0.265, -0.01];
  hat.rotation = [-0.14, 0.08, -0.20];
  const brim = new Mesh3D(createCylinder(0.24, 0.275, 0.032, 26), hatStraw);
  const crown = new Mesh3D(createCylinder(0.125, 0.155, 0.115, 22), hatStraw);
  crown.position = [0, 0.06, 0];
  const ribbon = new Mesh3D(createTorus(0.148, 0.018, 10, 26), ribbonBlue);
  ribbon.position = [0, 0.022, 0];
  ribbon.rotation = [Math.PI / 2, 0, 0];
  hat.add(brim, crown, ribbon);
  headPivot.add(hat);

  const leftArm = new Mesh3D(GEO.sphere24, yellow, 'leftWing');
  leftArm.scale = [0.09, 0.15, 0.18];
  leftArm.position = [-0.38, 0.34, 0.0];
  leftArm.rotation = [0, 0.18, 0.35];
  const rightArm = new Mesh3D(GEO.sphere24, yellow, 'rightWing');
  rightArm.scale = [0.09, 0.15, 0.18];
  rightArm.position = [0.38, 0.34, 0.0];
  rightArm.rotation = [0, -0.18, -0.35];
  bodyPivot.add(leftArm, rightArm);

  [-1, 1].forEach((s) => {
    const foot = new Mesh3D(GEO.sphere16, billMat);
    foot.scale = [0.095, 0.042, 0.125];
    foot.position = [s * 0.15, 0.042, 0.19];
    foot.rotation = [0, s * -0.22, 0];
    bodyPivot.add(foot);
  });

  root.userData.grabHeight = 0.78;
  return { root, parts: { bodyPivot, headPivot, leftEye, rightEye, leftArm, rightArm, accessory: hat } };
}

function buildCampusCat() {
  const root = new Node3D('campus-cat');
  const bodyPivot = new Node3D('bodyPivot');
  root.add(bodyPivot);

  const ginger = plushMat(0xdf8d44, { fuzz: 0.85 });
  const cream = plushMat(0xf7eee1, { fuzz: 0.85 });
  const stripe = plushMat(0xbf6b29, { fuzz: 0.78 });
  const pink = plushMat(0xf0b1a8, { fuzz: 0.70 });
  const collarGreen = plushMat(0x37664e, { fuzz: 0.65 });
  const brass = { color: 0xe3c268, roughness: 0.22, metalness: 0.86, fuzz: 0.0, fabric: FABRIC.METAL };

  const body = new Mesh3D(GEO.mochiPear, ginger);
  body.position = [0, 0.33, 0];
  body.scale = [1.02, 0.92, 1.0];
  bodyPivot.add(body);

  const bib = new Mesh3D(GEO.sphere24, cream);
  bib.scale = [0.24, 0.23, 0.15];
  bib.position = [0, 0.27, 0.22];
  bodyPivot.add(bib);

  const headPivot = new Node3D('headPivot');
  headPivot.position = [0, 0.66, 0.03];
  bodyPivot.add(headPivot);

  const head = new Mesh3D(GEO.sphere24, ginger);
  head.scale = [0.34, 0.29, 0.295];
  headPivot.add(head);

  [-1, 1].forEach((s) => {
    const puff = new Mesh3D(GEO.sphere16, cream);
    puff.scale = [0.095, 0.072, 0.075];
    puff.position = [s * 0.068, -0.065, 0.255];
    headPivot.add(puff);
  });

  const nose = new Mesh3D(GEO.sphere16, pink);
  nose.scale = [0.034, 0.024, 0.022];
  nose.position = [0, -0.032, 0.305];
  headPivot.add(nose);

  const leftEye = makeEye(0.043);
  leftEye.position = [-0.132, 0.025, 0.268];
  const rightEye = makeEye(0.043);
  rightEye.position = [0.132, 0.025, 0.268];
  headPivot.add(leftEye, rightEye);

  const lBlush = makeBlush(0.052, 0.030, 0xee968d);
  lBlush.position = [-0.21, -0.045, 0.22];
  lBlush.rotation = [0, -0.52, 0];
  const rBlush = makeBlush(0.052, 0.030, 0xee968d);
  rBlush.position = [0.21, -0.045, 0.22];
  rBlush.rotation = [0, 0.52, 0];
  headPivot.add(lBlush, rBlush);

  const leftEar = new Node3D('leftEar');
  leftEar.position = [-0.21, 0.23, 0.0];
  leftEar.rotation = [0, 0, 0.28];
  const rightEar = new Node3D('rightEar');
  rightEar.position = [0.21, 0.23, 0.0];
  rightEar.rotation = [0, 0, -0.28];
  [leftEar, rightEar].forEach((earGroup) => {
    const outer = new Mesh3D(GEO.earCone, ginger);
    outer.position = [0, 0.06, 0];
    const inner = new Mesh3D(GEO.earCone, pink);
    inner.scale = [0.58, 0.62, 0.45];
    inner.position = [0, 0.05, 0.045];
    earGroup.add(outer, inner);
    headPivot.add(earGroup);
  });

  [-0.072, 0, 0.072].forEach((ox, idx) => {
    const st = new Mesh3D(createCapsule(0.018, idx === 1 ? 0.095 : 0.065, 6, 10), stripe);
    st.position = [ox, 0.195, 0.21];
    st.rotation = [0.55, 0, -ox * 2.0];
    headPivot.add(st);
  });

  const collar = new Mesh3D(GEO.collarRing, collarGreen);
  collar.position = [0, 0.44, 0.03];
  collar.rotation = [Math.PI / 2, 0, 0];
  bodyPivot.add(collar);

  const bell = new Mesh3D(GEO.sphere16, brass);
  bell.scale = [0.052, 0.052, 0.052];
  bell.position = [0, 0.40, 0.28];
  bodyPivot.add(bell);

  const leftArm = new Mesh3D(GEO.footStub, cream, 'leftPaw');
  leftArm.position = [-0.155, 0.11, 0.27];
  leftArm.rotation = [Math.PI / 2.2, 0.12, 0];
  const rightArm = new Mesh3D(GEO.footStub, cream, 'rightPaw');
  rightArm.position = [0.155, 0.11, 0.27];
  rightArm.rotation = [Math.PI / 2.2, -0.12, 0];
  bodyPivot.add(leftArm, rightArm);

  const tailPivot = new Node3D('tailPivot');
  tailPivot.position = [0.23, 0.18, -0.16];
  const tail = new Mesh3D(GEO.tailCurve, ginger);
  tail.rotation = [Math.PI / 2.3, 0.15, -0.75];
  tailPivot.add(tail);
  bodyPivot.add(tailPivot);

  root.userData.grabHeight = 0.78;
  return { root, parts: { bodyPivot, headPivot, leftEye, rightEye, leftArm, rightArm, leftEar, rightEar, accessory: tailPivot } };
}

function buildSchoolbagBear() {
  const root = new Node3D('schoolbag-bear');
  const bodyPivot = new Node3D('bodyPivot');
  root.add(bodyPivot);

  const cocoa = plushMat(0x94664a, { fuzz: 0.85 });
  const creamSnout = plushMat(0xecdbc4, { fuzz: 0.82 });
  const vestBlue = plushMat(0x74b8df, { fabric: FABRIC.CORDUROY, fuzz: 0.55 });
  const shirtWhite = plushMat(0xf7f8fa, { fuzz: 0.65 });
  const bagOchre = plushMat(0xd67c35, { fuzz: 0.62 });
  const noseMat = { color: 0x3b261c, roughness: 0.30, metalness: 0.04, fuzz: 0.05, fabric: FABRIC.SATIN };
  const brass = { color: 0xdfb962, roughness: 0.24, metalness: 0.85, fuzz: 0.0, fabric: FABRIC.METAL };

  const torso = new Mesh3D(GEO.mochiPear, vestBlue);
  torso.position = [0, 0.33, 0];
  torso.scale = [1.0, 0.94, 0.96];
  bodyPivot.add(torso);

  const collar = new Mesh3D(GEO.collarRing, shirtWhite);
  collar.position = [0, 0.48, 0.02];
  collar.rotation = [Math.PI / 2, 0, 0];
  collar.scale = [0.92, 0.92, 1.0];
  bodyPivot.add(collar);

  const headPivot = new Node3D('headPivot');
  headPivot.position = [0, 0.71, 0.02];
  bodyPivot.add(headPivot);

  const head = new Mesh3D(GEO.sphere24, cocoa);
  head.scale = [0.32, 0.295, 0.295];
  headPivot.add(head);

  const snout = new Mesh3D(GEO.sphere24, creamSnout);
  snout.scale = [0.125, 0.095, 0.095];
  snout.position = [0, -0.055, 0.255];
  headPivot.add(snout);

  const nose = new Mesh3D(GEO.sphere16, noseMat);
  nose.scale = [0.04, 0.028, 0.026];
  nose.position = [0, -0.022, 0.34];
  headPivot.add(nose);

  const leftEye = makeEye(0.041);
  leftEye.position = [-0.128, 0.032, 0.258];
  const rightEye = makeEye(0.041);
  rightEye.position = [0.128, 0.032, 0.258];
  headPivot.add(leftEye, rightEye);

  const lBlush = makeBlush(0.048, 0.028, 0xe88e84);
  lBlush.position = [-0.195, -0.035, 0.225];
  lBlush.rotation = [0, -0.45, 0];
  const rBlush = makeBlush(0.048, 0.028, 0xe88e84);
  rBlush.position = [0.195, -0.035, 0.225];
  rBlush.rotation = [0, 0.45, 0];
  headPivot.add(lBlush, rBlush);

  [-1, 1].forEach((s) => {
    const ear = new Mesh3D(GEO.sphere16, cocoa);
    ear.scale = [0.10, 0.10, 0.062];
    ear.position = [s * 0.235, 0.225, 0.0];
    const earIn = new Mesh3D(GEO.sphere16, creamSnout);
    earIn.scale = [0.058, 0.058, 0.035];
    earIn.position = [s * 0.235, 0.22, 0.038];
    headPivot.add(ear, earIn);
  });

  [-1, 1].forEach((s) => {
    const strap = new Mesh3D(createTorus(0.17, 0.025, 10, 22), bagOchre);
    strap.position = [s * 0.195, 0.37, 0.02];
    strap.rotation = [0, Math.PI / 2, 0];
    bodyPivot.add(strap);

    const buckle = new Mesh3D(GEO.box1, brass);
    buckle.scale = [0.046, 0.038, 0.022];
    buckle.position = [s * 0.195, 0.33, 0.195];
    bodyPivot.add(buckle);
  });

  const bag = new Mesh3D(GEO.box1, bagOchre);
  bag.scale = [0.36, 0.33, 0.17];
  bag.position = [0, 0.34, -0.32];
  const bagFlap = new Mesh3D(GEO.box1, bagOchre);
  bagFlap.scale = [0.375, 0.12, 0.185];
  bagFlap.position = [0, 0.455, -0.32];
  bodyPivot.add(bag, bagFlap);

  const leftArm = new Mesh3D(GEO.armStub, cocoa, 'leftArm');
  leftArm.position = [-0.34, 0.36, 0.05];
  leftArm.rotation = [0, 0, 0.52];
  const rightArm = new Mesh3D(GEO.armStub, cocoa, 'rightArm');
  rightArm.position = [0.34, 0.36, 0.05];
  rightArm.rotation = [0, 0, -0.52];
  bodyPivot.add(leftArm, rightArm);

  [-1, 1].forEach((s) => {
    const leg = new Mesh3D(GEO.footStub, cocoa);
    leg.position = [s * 0.16, 0.09, 0.24];
    leg.rotation = [Math.PI / 2.2, s * -0.1, 0];
    bodyPivot.add(leg);
  });

  root.userData.grabHeight = 0.80;
  return { root, parts: { bodyPivot, headPivot, leftEye, rightEye, leftArm, rightArm } };
}

function buildOceanWhale() {
  const root = new Node3D('ocean-whale');
  const bodyPivot = new Node3D('bodyPivot');
  root.add(bodyPivot);

  const whaleBlue = plushMat(0x558fb8, { fuzz: 0.82 });
  const corduroyCream = plushMat(0xf1e8d8, { fabric: FABRIC.CORDUROY, fuzz: 0.62 });
  const pearlDrop = { color: 0xcbeeff, roughness: 0.14, metalness: 0.10, fuzz: 0.0, fabric: FABRIC.SATIN };

  const body = new Mesh3D(GEO.mochiWhale, whaleBlue);
  body.position = [0, 0.32, 0.02];
  body.scale = [1.05, 1.08, 1.16];
  bodyPivot.add(body);

  const belly = new Mesh3D(GEO.sphere24, corduroyCream);
  belly.scale = [0.37, 0.19, 0.42];
  belly.position = [0, 0.19, 0.08];
  bodyPivot.add(belly);

  const headPivot = new Node3D('headPivot');
  headPivot.position = [0, 0.34, 0.05];
  bodyPivot.add(headPivot);

  const leftEye = makeEye(0.044);
  leftEye.position = [-0.245, 0.035, 0.355];
  const rightEye = makeEye(0.044);
  rightEye.position = [0.245, 0.035, 0.355];
  headPivot.add(leftEye, rightEye);

  const lBlush = makeBlush(0.060, 0.036, 0xef948e);
  lBlush.position = [-0.315, -0.03, 0.295];
  lBlush.rotation = [0, -0.65, 0];
  const rBlush = makeBlush(0.060, 0.036, 0xef948e);
  rBlush.position = [0.315, -0.03, 0.295];
  rBlush.rotation = [0, 0.65, 0];
  headPivot.add(lBlush, rBlush);

  const smile = makeTinySmile(0x2a4d66);
  smile.position = [0, -0.03, 0.445];
  headPivot.add(smile);

  const leftArm = new Mesh3D(GEO.sphere24, whaleBlue, 'leftFlipper');
  leftArm.scale = [0.19, 0.06, 0.11];
  leftArm.position = [-0.43, 0.22, 0.04];
  leftArm.rotation = [0, 0.24, 0.25];
  const rightArm = new Mesh3D(GEO.sphere24, whaleBlue, 'rightFlipper');
  rightArm.scale = [0.19, 0.06, 0.11];
  rightArm.position = [0.43, 0.22, 0.04];
  rightArm.rotation = [0, -0.24, -0.25];
  bodyPivot.add(leftArm, rightArm);

  const tailPivot = new Node3D('tailPivot');
  tailPivot.position = [0, 0.34, -0.40];
  const stem = new Mesh3D(createCapsule(0.095, 0.20, 8, 16), whaleBlue);
  stem.rotation = [-0.72, 0, 0];
  tailPivot.add(stem);
  [-1, 1].forEach((s) => {
    const fluke = new Mesh3D(GEO.sphere16, whaleBlue);
    fluke.scale = [0.17, 0.045, 0.105];
    fluke.position = [s * 0.145, 0.15, -0.09];
    fluke.rotation = [0.18, s * 0.28, s * 0.30];
    tailPivot.add(fluke);
  });
  bodyPivot.add(tailPivot);

  const droplet = new Node3D('droplet');
  droplet.position = [0, 0.66, 0.04];
  const dropMesh = new Mesh3D(GEO.sphere24, pearlDrop);
  dropMesh.scale = [0.068, 0.095, 0.068];
  droplet.add(dropMesh);
  bodyPivot.add(droplet);

  root.userData.grabHeight = 0.65;
  return { root, parts: { bodyPivot, headPivot, leftEye, rightEye, leftArm, rightArm, accessory: tailPivot, droplet } };
}

function buildHainanFawn() {
  const root = new Node3D('hainan-fawn');
  const bodyPivot = new Node3D('bodyPivot');
  root.add(bodyPivot);

  const cinnamon = plushMat(0xc38459, { fuzz: 0.85 });
  const cream = plushMat(0xf5e9d6, { fuzz: 0.85 });
  const antlerBrown = plushMat(0x74523d, { fuzz: 0.65 });
  const scarfRed = plushMat(0xb84e3e, { fabric: FABRIC.CORDUROY, fuzz: 0.60 });
  const scarfIndigo = plushMat(0x365470, { fabric: FABRIC.WOVEN, fuzz: 0.55 });
  const noseMat = { color: 0x3b261c, roughness: 0.28, metalness: 0.04, fuzz: 0.05, fabric: FABRIC.SATIN };

  const body = new Mesh3D(GEO.mochiPear, cinnamon);
  body.position = [0, 0.32, 0];
  body.scale = [0.96, 0.92, 1.02];
  bodyPivot.add(body);

  const belly = new Mesh3D(GEO.sphere24, cream);
  belly.scale = [0.22, 0.21, 0.14];
  belly.position = [0, 0.26, 0.21];
  bodyPivot.add(belly);

  [[-0.14, 0.38, -0.22], [0.13, 0.41, -0.20], [-0.03, 0.29, -0.29], [0.16, 0.27, -0.24]].forEach(([x, y, z]) => {
    const sp = new Mesh3D(GEO.sphere16, cream);
    sp.scale = [0.042, 0.042, 0.036];
    sp.position = [x, y, z];
    bodyPivot.add(sp);
  });

  const headPivot = new Node3D('headPivot');
  headPivot.position = [0, 0.67, 0.04];
  bodyPivot.add(headPivot);

  const head = new Mesh3D(GEO.sphere24, cinnamon);
  head.scale = [0.29, 0.28, 0.30];
  headPivot.add(head);

  const muzzle = new Mesh3D(GEO.sphere24, cream);
  muzzle.scale = [0.11, 0.088, 0.095];
  muzzle.position = [0, -0.055, 0.245];
  headPivot.add(muzzle);

  const nose = new Mesh3D(GEO.sphere16, noseMat);
  nose.scale = [0.034, 0.025, 0.024];
  nose.position = [0, -0.025, 0.33];
  headPivot.add(nose);

  const leftEye = makeEye(0.043);
  leftEye.position = [-0.125, 0.032, 0.252];
  const rightEye = makeEye(0.043);
  rightEye.position = [0.125, 0.032, 0.252];
  headPivot.add(leftEye, rightEye);

  const lBlush = makeBlush(0.048, 0.028, 0xee9488);
  lBlush.position = [-0.19, -0.038, 0.215];
  lBlush.rotation = [0, -0.48, 0];
  const rBlush = makeBlush(0.048, 0.028, 0xee9488);
  rBlush.position = [0.19, -0.038, 0.215];
  rBlush.rotation = [0, 0.48, 0];
  headPivot.add(lBlush, rBlush);

  const leftEar = new Node3D('leftEar');
  leftEar.position = [-0.24, 0.14, -0.01];
  leftEar.rotation = [0, 0, -0.35];
  const rightEar = new Node3D('rightEar');
  rightEar.position = [0.24, 0.14, -0.01];
  rightEar.rotation = [0, 0, 0.35];
  [leftEar, rightEar].forEach((eg, idx) => {
    const ear = new Mesh3D(GEO.sphere16, cinnamon);
    ear.scale = [0.14, 0.062, 0.048];
    ear.position = [idx === 0 ? -0.04 : 0.04, 0, 0];
    eg.add(ear);
    headPivot.add(eg);
  });

  [-1, 1].forEach((s) => {
    const ant = new Mesh3D(createCapsule(0.028, 0.14, 6, 12), antlerBrown);
    ant.position = [s * 0.105, 0.27, 0.01];
    ant.rotation = [0, 0, s * -0.24];
    const tine = new Mesh3D(createCapsule(0.02, 0.08, 6, 10), antlerBrown);
    tine.position = [s * 0.16, 0.30, 0.03];
    tine.rotation = [0, 0, s * -0.82];
    headPivot.add(ant, tine);
  });

  const scarf = new Mesh3D(GEO.scarfRing, scarfRed);
  scarf.position = [0, 0.46, 0.03];
  scarf.rotation = [Math.PI / 2, 0, 0];
  bodyPivot.add(scarf);

  const scarfTail = new Mesh3D(createCapsule(0.048, 0.17, 6, 12), scarfIndigo);
  scarfTail.position = [0.115, 0.35, 0.24];
  scarfTail.rotation = [0, 0, 0.24];
  bodyPivot.add(scarfTail);

  const leftArm = new Mesh3D(GEO.footStub, antlerBrown);
  leftArm.position = [-0.14, 0.09, 0.23];
  leftArm.rotation = [Math.PI / 2.2, 0.1, 0];
  const rightArm = new Mesh3D(GEO.footStub, antlerBrown);
  rightArm.position = [0.14, 0.09, 0.23];
  rightArm.rotation = [Math.PI / 2.2, -0.1, 0];
  bodyPivot.add(leftArm, rightArm);

  root.userData.grabHeight = 0.78;
  return { root, parts: { bodyPivot, headPivot, leftEye, rightEye, leftArm, rightArm, leftEar, rightEar } };
}

const BUILTIN_BUILDERS = {
  'lanren-spirit': buildLanrenSpirit,
  'sunshine-duck': buildSunshineDuck,
  'campus-cat': buildCampusCat,
  'schoolbag-bear': buildSchoolbagBear,
  'ocean-whale': buildOceanWhale,
  'hainan-fawn': buildHainanFawn
};

export function createToyboxCharacter(id, options = {}) {
  const meta = getCharacterMeta(id) || getCharacterMeta('lanren-spirit');
  const customBuilder = getCustomCharacterBuilder(id);
  const built = customBuilder ? customBuilder() : (BUILTIN_BUILDERS[id] || buildLanrenSpirit)();
  const { root, parts } = built;

  const rest = {
    bodyScale: [...parts.bodyPivot.scale],
    bodyPos: [...parts.bodyPivot.position],
    headRot: parts.headPivot ? [...parts.headPivot.rotation] : [0, 0, 0],
    leftArmRot: parts.leftArm ? [...parts.leftArm.rotation] : [0, 0, 0],
    rightArmRot: parts.rightArm ? [...parts.rightArm.rotation] : [0, 0, 0],
    leftEarRot: parts.leftEar ? [...parts.leftEar.rotation] : [0, 0, 0],
    rightEarRot: parts.rightEar ? [...parts.rightEar.rotation] : [0, 0, 0],
    accRot: parts.accessory ? [...parts.accessory.rotation] : [0, 0, 0],
    leftEyeScale: parts.leftEye ? [...parts.leftEye.scale] : [1, 1, 1],
    rightEyeScale: parts.rightEye ? [...parts.rightEye.scale] : [1, 1, 1]
  };

  const phaseOffset = options.phaseOffset ?? Math.random() * Math.PI * 2;
  let blinkCooldown = 2.2 + Math.random() * 2.6;
  let blinkTimer = 0;
  let bounceTimer = 0;

  function triggerBounce() {
    bounceTimer = 0.55;
  }

  function animate(time, dt, mode = 'idle', reducedMotion = false) {
    if (reducedMotion) {
      parts.bodyPivot.scale = [...rest.bodyScale];
      parts.bodyPivot.position = [...rest.bodyPos];
      if (parts.headPivot) parts.headPivot.rotation = [...rest.headRot];
      return;
    }

    const t = time + phaseOffset;

    blinkCooldown -= dt;
    if (blinkCooldown <= 0) {
      blinkTimer = 0.16;
      blinkCooldown = (meta.personality === 'cozy' ? 2.6 : 3.2) + Math.random() * 2.8;
    }
    let eyeScaleY = 1.0;
    if (blinkTimer > 0) {
      blinkTimer = Math.max(0, blinkTimer - dt);
      const b = Math.sin((blinkTimer / 0.16) * Math.PI);
      eyeScaleY = Math.max(0.14, 1.0 - b * 0.88);
    }
    if (parts.leftEye) parts.leftEye.scale = [rest.leftEyeScale[0], rest.leftEyeScale[1] * eyeScaleY, rest.leftEyeScale[2]];
    if (parts.rightEye) parts.rightEye.scale = [rest.rightEyeScale[0], rest.rightEyeScale[1] * eyeScaleY, rest.rightEyeScale[2]];

    let squashX = 1.0, squashY = 1.0, hopY = 0.0;
    if (bounceTimer > 0) {
      bounceTimer = Math.max(0, bounceTimer - dt);
      const p = 1.0 - bounceTimer / 0.55;
      const damp = Math.exp(-5.0 * p) * Math.sin(p * Math.PI * 3.2);
      squashY = 1.0 - damp * 0.18;
      squashX = 1.0 + damp * 0.12;
    }

    if (mode === 'grabbed') {
      parts.bodyPivot.scale = [0.95, 1.06, 0.95];
      parts.bodyPivot.position = [rest.bodyPos[0], rest.bodyPos[1], rest.bodyPos[2]];
      if (parts.headPivot) {
        parts.headPivot.rotation = [0.06, Math.sin(t * 4.5) * 0.10, Math.sin(t * 3.8) * 0.08];
      }
      if (parts.leftArm) parts.leftArm.rotation = [rest.leftArmRot[0], rest.leftArmRot[1], rest.leftArmRot[2] + Math.sin(t * 7.5) * 0.22];
      if (parts.rightArm) parts.rightArm.rotation = [rest.rightArmRot[0], rest.rightArmRot[1], rest.rightArmRot[2] - Math.sin(t * 7.5) * 0.22];
      return;
    }

    if (mode === 'celebrate') {
      const bounce = Math.abs(Math.sin(time * 5.6));
      hopY = bounce * 0.11;
      squashY = 0.94 + bounce * 0.11;
      squashX = 1.05 - bounce * 0.07;
      parts.bodyPivot.position = [rest.bodyPos[0], rest.bodyPos[1] + hopY, rest.bodyPos[2]];
      parts.bodyPivot.scale = [squashX, squashY, squashX];
      if (parts.headPivot) {
        parts.headPivot.rotation = [-0.06 + Math.sin(time * 5.6) * 0.08, Math.sin(time * 3.2) * 0.18, Math.sin(time * 4.8) * 0.14];
      }
      if (parts.leftArm) parts.leftArm.rotation = [rest.leftArmRot[0], rest.leftArmRot[1], rest.leftArmRot[2] + 0.45 + Math.sin(time * 9.0) * 0.30];
      if (parts.rightArm) parts.rightArm.rotation = [rest.rightArmRot[0], rest.rightArmRot[1], rest.rightArmRot[2] - 0.45 - Math.sin(time * 9.0) * 0.30];
      if (parts.accessory) {
        parts.accessory.rotation = [rest.accRot[0], rest.accRot[1] + Math.sin(time * 7.5) * 0.25, rest.accRot[2] + Math.sin(time * 6.0) * 0.18];
      }
      return;
    }

    const breatheSpeed = meta.personality === 'lively' ? 2.5 : meta.personality === 'cozy' ? 1.5 : 1.9;
    const breathe = Math.sin(t * breatheSpeed) * 0.024;
    parts.bodyPivot.scale = [squashX * (1 - breathe * 0.55), squashY * (1 + breathe), squashX * (1 - breathe * 0.55)];
    parts.bodyPivot.position = [rest.bodyPos[0], rest.bodyPos[1] + hopY, rest.bodyPos[2]];

    if (parts.headPivot) {
      if (meta.personality === 'curious') {
        parts.headPivot.rotation = [Math.sin(t * 0.9) * 0.04, Math.sin(t * 0.75) * 0.11, Math.sin(t * 1.1) * 0.09];
      } else if (meta.personality === 'lively') {
        parts.headPivot.rotation = [Math.sin(t * 2.4) * 0.06, Math.sin(t * 1.2) * 0.08, Math.sin(t * 1.8) * 0.05];
      } else if (meta.personality === 'cozy') {
        parts.headPivot.rotation = [0.04 + Math.sin(t * 0.8) * 0.03, Math.sin(t * 0.55) * 0.06, Math.sin(t * 0.7) * 0.05];
      } else if (meta.personality === 'shy') {
        parts.headPivot.rotation = [0, Math.sin(t * 0.85) * 0.14, Math.sin(t * 0.65) * 0.04];
      } else {
        parts.headPivot.rotation = [Math.sin(t * 1.1) * 0.04, Math.sin(t * 0.7) * 0.07, 0];
      }
    }

    if (parts.leftArm && parts.rightArm) {
      const armWave = meta.personality === 'lively' ? Math.sin(t * 3.2) * 0.14 : Math.sin(t * 1.6) * 0.06;
      parts.leftArm.rotation = [rest.leftArmRot[0], rest.leftArmRot[1], rest.leftArmRot[2] + armWave];
      parts.rightArm.rotation = [rest.rightArmRot[0], rest.rightArmRot[1], rest.rightArmRot[2] - armWave];
    }

    if (parts.leftEar && parts.rightEar) {
      const twitch = Math.pow(Math.max(0, Math.sin(t * 1.35)), 16) * 0.22;
      parts.leftEar.rotation = [rest.leftEarRot[0], rest.leftEarRot[1], rest.leftEarRot[2] + twitch];
      parts.rightEar.rotation = [rest.rightEarRot[0], rest.rightEarRot[1], rest.rightEarRot[2] - twitch * 0.6];
    }

    if (parts.accessory) {
      const wag = meta.personality === 'cozy' ? Math.sin(t * 1.8) * 0.18 : Math.sin(t * 2.2) * 0.14;
      parts.accessory.rotation = [rest.accRot[0], rest.accRot[1] + wag, rest.accRot[2] + wag * 0.5];
    }
  }

  return { id: meta.id, meta, root, parts, animate, triggerBounce };
}
