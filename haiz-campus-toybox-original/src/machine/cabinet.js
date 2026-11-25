// HAIZ Campus Toybox — Hainan Qilou (骑楼) Craft Toybox Claw Machine.
// Architectural miniature cabinet in lime-wash stucco, teak wood, brushed brass, terrazzo floor,
// and block-printed Terminalia leaf wallpaper.
//
// Diegetic target display: built directly into the Qilou arched roof pediment is an illuminated
// brass-and-glass Showcase Vitrine with a slowly rotating miniature terrazzo turntable holding a
// LIVE 3D instance of the target character (real model, PBR materials, live idle animation),
// flanked by enamel plaques reading "请抓住这位伙伴 →" with the character name as secondary info.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { terrazzoColor, stuccoColor, woodColor, leafWallpaper } from '../toys/kit/textures.js';
import { brass, lacquer } from '../toys/kit/materials.js';
import { mesh, pivot } from '../toys/kit/shape.js';

// Playfield dimensions in meters (matches normalized [-1, 1] layout space)
export const PLAYFIELD = Object.freeze({
  floorY: 0.0,
  halfX: 0.34,
  halfZ: 0.28,
  ceilingY: 0.56,
  chuteX: -0.245,
  chuteZ: 0.185,
  chuteR: 0.09,
});

/** Convert normalized contract coords [-1,1] to cabinet floor meters. */
export function normToWorld(nx, nz) {
  return { x: nx * (PLAYFIELD.halfX - 0.055), z: nz * (PLAYFIELD.halfZ - 0.055) };
}

/** Draw the left pediment enamel plaque (primary task prompt pointing toward the 3D showcase). */
function drawLeftPlaque(canvas, primaryText = '请抓住这位伙伴 →', subText = 'HAIZ · 校园玩偶屋') {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = '#fbf4e4';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#c9a35c';
  ctx.lineWidth = 7;
  ctx.strokeRect(8, 8, w - 16, h - 16);
  ctx.strokeStyle = '#33584f';
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, w - 36, h - 36);

  ctx.fillStyle = '#7e603e';
  ctx.font = '600 20px "Georgia", "Songti SC", serif';
  ctx.textAlign = 'left';
  ctx.fillText(subText, 30, 52);

  ctx.fillStyle = '#c4533a';
  ctx.font = 'bold 34px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText(primaryText, 30, 102);
}

/** Draw the right pediment enamel plaque (secondary character name & title). */
function drawRightPlaque(canvas, targetEntry, customSub = '') {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = '#fbf4e4';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#c9a35c';
  ctx.lineWidth = 7;
  ctx.strokeRect(8, 8, w - 16, h - 16);
  ctx.strokeStyle = '#33584f';
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, w - 36, h - 36);

  ctx.fillStyle = '#7e603e';
  ctx.font = '600 19px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(customSub || '← 橱窗里的伙伴', 30, 50);

  if (targetEntry) {
    // Accent color dot + secondary name
    ctx.fillStyle = targetEntry.badgeColor || '#4d8657';
    ctx.beginPath();
    ctx.arc(42, 92, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2d4e47';
    ctx.font = 'bold 30px "Songti SC", "PingFang SC", serif';
    ctx.fillText(`${targetEntry.name} · ${targetEntry.enName}`, 62, 102);

    ctx.fillStyle = '#6c5a49';
    ctx.font = '500 17px sans-serif';
    ctx.fillText(targetEntry.title, 30, 134);
  }
}

export function buildCabinet() {
  const root = new THREE.Group();
  root.name = 'haiz_qilou_cabinet';

  // Shared architectural materials
  const stuccoMat = new THREE.MeshStandardMaterial({
    name: 'mat_stucco',
    map: stuccoColor('#eed2b5', 7),
    roughness: 0.86,
    metalness: 0.0,
  });
  const trimGreenMat = new THREE.MeshStandardMaterial({
    name: 'mat_arcade_green',
    color: new THREE.Color('#345b51'),
    roughness: 0.52,
    metalness: 0.05,
  });
  const velvetGreenMat = new THREE.MeshStandardMaterial({
    name: 'mat_vitrine_velvet',
    color: new THREE.Color('#1d3b35'),
    roughness: 0.92,
    metalness: 0.0,
  });
  const woodMat = lacquer('#ffffff', { map: woodColor('#7f5134', 12), roughness: 0.48, clearcoat: 0.35, name: 'mat_teak' });
  const darkWoodMat = lacquer('#ffffff', { map: woodColor('#4c2f1f', 19), roughness: 0.55, clearcoat: 0.25, name: 'mat_dark_teak' });
  const brassMat = brass({ name: 'mat_brass', roughness: 0.28 });
  const rubberMat = new THREE.MeshStandardMaterial({ name: 'mat_rubber', color: '#c45b42', roughness: 0.85 });

  // ── 1. LOWER BASE PEDESTAL (houses control deck + prize showcase window)
  const baseW = 0.82, baseH = 0.26, baseD = 0.68;
  const baseBody = mesh(new RoundedBoxGeometry(baseW, baseH, baseD, 4, 0.018), stuccoMat, 'cabinet_base');
  baseBody.position.set(0, -baseH / 2 - 0.01, 0);
  root.add(baseBody);

  const plinth = mesh(new RoundedBoxGeometry(baseW + 0.04, 0.04, baseD + 0.04, 3, 0.01), darkWoodMat, 'cabinet_plinth');
  plinth.position.set(0, -baseH - 0.01, 0);
  root.add(plinth);

  const waist = mesh(new RoundedBoxGeometry(baseW + 0.03, 0.032, baseD + 0.03, 3, 0.008), woodMat, 'cabinet_waist');
  waist.position.set(0, -0.024, 0);
  root.add(waist);

  const lowerPanel = mesh(new RoundedBoxGeometry(0.42, 0.16, 0.015, 2, 0.005), trimGreenMat, 'cabinet_lower_panel');
  lowerPanel.position.set(0.14, -0.145, baseD / 2 + 0.003);
  root.add(lowerPanel);
  const panelFrame = mesh(new RoundedBoxGeometry(0.435, 0.175, 0.01, 2, 0.004), brassMat, 'cabinet_lower_frame');
  panelFrame.position.set(0.14, -0.145, baseD / 2);
  root.add(panelFrame);

  // ── 2. FRONT-LEFT PRIZE SHOWCASE WINDOW (opens on success!)
  const chuteWin = pivot('prize_window', root, -0.22, -0.145, baseD / 2 + 0.002);
  chuteWin.add(mesh(new RoundedBoxGeometry(0.22, 0.175, 0.022, 3, 0.006), woodMat, 'prize_win_frame'));
  const winBack = mesh(new THREE.BoxGeometry(0.185, 0.145, 0.12), new THREE.MeshStandardMaterial({ color: '#2b2019', roughness: 0.9 }), 'prize_win_cavity');
  winBack.position.set(0, 0, -0.065);
  chuteWin.add(winBack);
  const winLedge = mesh(new RoundedBoxGeometry(0.22, 0.018, 0.11, 2, 0.004), brassMat, 'prize_win_ledge');
  winLedge.position.set(0, -0.082, 0.045);
  chuteWin.add(winLedge);

  const flapPivot = pivot('prize_flap_pivot', chuteWin, 0, 0.072, 0.012);
  const flapGlass = mesh(
    new THREE.BoxGeometry(0.178, 0.142, 0.008),
    new THREE.MeshPhysicalMaterial({ color: '#fff8ec', roughness: 0.15, transparent: true, opacity: 0.32, clearcoat: 1 }),
    'prize_flap_glass'
  );
  flapGlass.position.set(0, -0.071, 0);
  flapPivot.add(flapGlass);
  const flapHandle = mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.065, 12), brassMat, 'prize_flap_handle');
  flapHandle.rotation.z = Math.PI / 2;
  flapHandle.position.set(0, -0.122, 0.008);
  flapPivot.add(flapHandle);

  const prizeLight = new THREE.PointLight('#ffd27d', 0, 0.6, 2);
  prizeLight.position.set(-0.22, -0.1, baseD / 2 + 0.06);
  root.add(prizeLight);

  // ── 3. PLAYFIELD FLOOR (Hainan school terrazzo + recessed chute)
  const floorMat = new THREE.MeshStandardMaterial({
    name: 'mat_terrazzo',
    map: terrazzoColor(),
    roughness: 0.58,
    metalness: 0.04,
  });
  const floor = mesh(new THREE.BoxGeometry(PLAYFIELD.halfX * 2 + 0.04, 0.018, PLAYFIELD.halfZ * 2 + 0.04), floorMat, 'cabinet_floor');
  floor.position.set(0, -0.009, 0);
  floor.castShadow = false;
  root.add(floor);

  const chuteRim = mesh(new THREE.TorusGeometry(PLAYFIELD.chuteR, 0.007, 12, 32), brassMat, 'chute_rim');
  chuteRim.rotation.x = Math.PI / 2;
  chuteRim.position.set(PLAYFIELD.chuteX, 0.004, PLAYFIELD.chuteZ);
  root.add(chuteRim);
  const chuteHole = mesh(
    new THREE.CylinderGeometry(PLAYFIELD.chuteR - 0.004, PLAYFIELD.chuteR - 0.004, 0.012, 28),
    new THREE.MeshStandardMaterial({ color: '#1e1612', roughness: 0.95 }),
    'chute_hole'
  );
  chuteHole.position.set(PLAYFIELD.chuteX, 0.001, PLAYFIELD.chuteZ);
  chuteHole.castShadow = false;
  root.add(chuteHole);

  const targetRing = new THREE.Mesh(
    new THREE.RingGeometry(0.036, 0.048, 36),
    new THREE.MeshBasicMaterial({ color: '#ffdf8c', transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false })
  );
  targetRing.rotation.x = -Math.PI / 2;
  targetRing.position.set(0, 0.004, 0);
  root.add(targetRing);

  // ── 4. BACK WALL (Terminalia wallpaper) + 4 QILOU CORNER COLUMNS + GLASS
  const cabH = PLAYFIELD.ceilingY + 0.04;
  const backWall = mesh(
    new THREE.BoxGeometry(PLAYFIELD.halfX * 2 + 0.08, cabH, 0.028),
    new THREE.MeshStandardMaterial({ map: leafWallpaper(), roughness: 0.88, name: 'mat_wallpaper' }),
    'cabinet_backwall'
  );
  backWall.position.set(0, cabH / 2, -PLAYFIELD.halfZ - 0.03);
  backWall.castShadow = false;
  root.add(backWall);

  const backShell = mesh(new THREE.BoxGeometry(baseW, cabH, 0.02), stuccoMat, 'cabinet_backshell');
  backShell.position.set(0, cabH / 2, -PLAYFIELD.halfZ - 0.052);
  root.add(backShell);

  const colPositions = [
    [-PLAYFIELD.halfX - 0.03, -PLAYFIELD.halfZ - 0.02],
    [PLAYFIELD.halfX + 0.03, -PLAYFIELD.halfZ - 0.02],
    [-PLAYFIELD.halfX - 0.03, PLAYFIELD.halfZ + 0.02],
    [PLAYFIELD.halfX + 0.03, PLAYFIELD.halfZ + 0.02],
  ];
  for (let i = 0; i < 4; i++) {
    const [cx, cz] = colPositions[i];
    const col = mesh(new RoundedBoxGeometry(0.042, cabH, 0.042, 3, 0.006), woodMat, 'cabinet_col_' + i);
    col.position.set(cx, cabH / 2, cz);
    root.add(col);
    for (const cy of [0.02, cabH - 0.02]) {
      const cap = mesh(new RoundedBoxGeometry(0.05, 0.024, 0.05, 2, 0.004), brassMat, 'cabinet_cap_' + i + '_' + cy);
      cap.position.set(cx, cy, cz);
      root.add(cap);
    }
  }

  const glassMat = new THREE.MeshPhysicalMaterial({
    name: 'mat_showcase_glass',
    color: '#fffef9',
    roughness: 0.06,
    metalness: 0.0,
    transparent: true,
    opacity: 0.1,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    depthWrite: false,
  });
  const frontGlass = new THREE.Mesh(new THREE.PlaneGeometry(PLAYFIELD.halfX * 2 + 0.02, cabH - 0.04), glassMat);
  frontGlass.position.set(0, cabH / 2, PLAYFIELD.halfZ + 0.022);
  frontGlass.renderOrder = 5;
  root.add(frontGlass);
  for (const s of [-1, 1]) {
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(PLAYFIELD.halfZ * 2 + 0.02, cabH - 0.04), glassMat);
    sg.rotation.y = s * Math.PI / 2;
    sg.position.set(s * (PLAYFIELD.halfX + 0.032), cabH / 2, 0);
    sg.renderOrder = 5;
    root.add(sg);
  }

  // ── 5. QILOU ROOF CORNICE + DIEGETIC 3D TARGET SHOWCASE VITRINE & ENAMEL PLAQUES
  const roof = mesh(new RoundedBoxGeometry(baseW + 0.04, 0.046, baseD + 0.04, 3, 0.01), woodMat, 'cabinet_roof');
  roof.position.set(0, cabH + 0.018, 0);
  root.add(roof);

  // Left & Right Qilou stucco wings flanking the central 3D showcase vitrine
  const wingY = cabH + 0.118;
  const wingZ = PLAYFIELD.halfZ - 0.035;
  for (const s of [-1, 1]) {
    const wing = mesh(new RoundedBoxGeometry(0.28, 0.15, 0.11, 3, 0.012), stuccoMat, 'pediment_wing_' + s);
    wing.position.set(s * 0.275, wingY, wingZ);
    root.add(wing);
    const wingTrim = mesh(new RoundedBoxGeometry(0.29, 0.016, 0.12, 2, 0.004), woodMat, 'pediment_trim_' + s);
    wingTrim.position.set(s * 0.275, wingY + 0.078, wingZ);
    root.add(wingTrim);
  }

  // Left enamel plaque ("请抓住这位伙伴 →")
  const leftCanvas = document.createElement('canvas');
  leftCanvas.width = 400; leftCanvas.height = 160;
  drawLeftPlaque(leftCanvas);
  const leftTex = new THREE.CanvasTexture(leftCanvas);
  leftTex.colorSpace = THREE.SRGBColorSpace;
  leftTex.anisotropy = 4;
  const leftPlaque = mesh(
    new THREE.PlaneGeometry(0.255, 0.112),
    new THREE.MeshStandardMaterial({ map: leftTex, roughness: 0.72, metalness: 0.02 }),
    'marquee_left'
  );
  leftPlaque.position.set(-0.275, wingY, wingZ + 0.057);
  root.add(leftPlaque);

  // Right enamel plaque (secondary character name + title)
  const rightCanvas = document.createElement('canvas');
  rightCanvas.width = 400; rightCanvas.height = 160;
  drawRightPlaque(rightCanvas, null);
  const rightTex = new THREE.CanvasTexture(rightCanvas);
  rightTex.colorSpace = THREE.SRGBColorSpace;
  rightTex.anisotropy = 4;
  const rightPlaque = mesh(
    new THREE.PlaneGeometry(0.255, 0.112),
    new THREE.MeshStandardMaterial({ map: rightTex, roughness: 0.72, metalness: 0.02 }),
    'marquee_right'
  );
  rightPlaque.position.set(0.275, wingY, wingZ + 0.057);
  root.add(rightPlaque);

  // Central Illuminated Qilou Arched 3D Target Showcase Vitrine!
  // Note: in Three.js CylinderGeometry, theta = 0 is +Z (front) and theta = PI is -Z (back).
  const vitrine = pivot('target_vitrine', root, 0, cabH + 0.042, PLAYFIELD.halfZ - 0.02);
  // Dark emerald velvet curved alcove around the BACK (-Z), leaving the front (-75°..+75°) wide open!
  const alcoveCyl = mesh(
    new THREE.CylinderGeometry(0.132, 0.132, 0.21, 32, 1, true, Math.PI * 0.42, Math.PI * 1.16),
    velvetGreenMat,
    'vitrine_alcove'
  );
  alcoveCyl.material.side = THREE.DoubleSide;
  alcoveCyl.position.set(0, 0.11, -0.01);
  vitrine.add(alcoveCyl);

  // Outer stucco shell hugging the back of the alcove
  const vitrineBack = mesh(
    new THREE.CylinderGeometry(0.144, 0.144, 0.22, 32, 1, true, Math.PI * 0.42, Math.PI * 1.16),
    stuccoMat,
    'vitrine_outer'
  );
  vitrineBack.material.side = THREE.DoubleSide;
  vitrineBack.position.set(0, 0.115, -0.012);
  vitrine.add(vitrineBack);

  // Qilou arched teak & brass crown dome cap above the vitrine
  const domeRoof = mesh(new THREE.SphereGeometry(0.148, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.45), trimGreenMat, 'vitrine_dome');
  domeRoof.scale.set(1, 0.62, 0.92);
  domeRoof.position.set(0, 0.22, -0.01);
  vitrine.add(domeRoof);
  const finial = mesh(new THREE.SphereGeometry(0.018, 16, 12), brassMat, 'vitrine_finial');
  finial.position.set(0, 0.312, -0.01);
  vitrine.add(finial);
  const crownRing = mesh(new THREE.TorusGeometry(0.144, 0.008, 12, 40), brassMat, 'vitrine_crown_ring');
  crownRing.rotation.x = Math.PI / 2;
  crownRing.position.set(0, 0.222, -0.01);
  vitrine.add(crownRing);

  // Front thin brass framing pillars on either side of the showcase opening
  for (const s of [-1, 1]) {
    const post = mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.22, 12), brassMat, 'vitrine_post_' + s);
    post.position.set(s * 0.125, 0.112, 0.068);
    vitrine.add(post);
  }

  // Slowly rotating miniature terrazzo & brass turntable pedestal inside the vitrine
  const targetTurntable = pivot('target_turntable', vitrine, 0, 0.022, 0.01);
  const ttDisc = mesh(new THREE.CylinderGeometry(0.088, 0.094, 0.02, 32), floorMat, 'vitrine_turntable_disc');
  ttDisc.position.y = -0.01;
  targetTurntable.add(ttDisc);
  const ttRim = mesh(new THREE.TorusGeometry(0.091, 0.0045, 10, 36), brassMat, 'vitrine_turntable_rim');
  ttRim.rotation.x = Math.PI / 2;
  ttRim.position.y = -0.005;
  targetTurntable.add(ttRim);

  // Curved glass front shield (ultra-clear so it protects the toy without dulling colors)
  const vitrineGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.132, 0.132, 0.21, 28, 1, true, -Math.PI * 0.35, Math.PI * 0.7),
    new THREE.MeshPhysicalMaterial({
      color: '#ffffff', roughness: 0.05, transparent: true, opacity: 0.09, clearcoat: 1, depthWrite: false,
    })
  );
  vitrineGlass.position.set(0, 0.11, -0.01);
  vitrineGlass.renderOrder = 6;
  vitrine.add(vitrineGlass);

  // Dedicated warm spotlight inside the Qilou vitrine so the rotating 3D target gleams like a jewel
  const vitrineLight = new THREE.PointLight('#fff0cf', 1.25, 0.65, 1.6);
  vitrineLight.position.set(0.05, 0.2, 0.11);
  vitrine.add(vitrineLight);

  // ── 6. TACTILE CONTROL DECK (physical joystick, brass grab button, 5 attempt bulbs)
  const deck = pivot('control_deck', root, 0.08, -0.026, baseD / 2 + 0.055);
  const deckBody = mesh(new RoundedBoxGeometry(0.46, 0.048, 0.145, 3, 0.01), darkWoodMat, 'deck_body');
  deckBody.rotation.x = 0.18;
  deck.add(deckBody);

  const joyBase = pivot('joystick_base', deck, -0.12, 0.024, 0.005);
  joyBase.add(mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.012, 20), brassMat, 'joystick_plate'));
  const joyStick = pivot('joystick_stick', joyBase, 0, 0.006, 0);
  const shaft = mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.048, 12), brassMat, 'joystick_shaft');
  shaft.position.y = 0.024;
  joyStick.add(shaft);
  const ball = mesh(new THREE.SphereGeometry(0.022, 20, 16), lacquer('#c94d38', { name: 'lacquer_joy_ball' }), 'joystick_ball');
  ball.position.y = 0.052;
  joyStick.add(ball);

  const btnBezel = mesh(new THREE.CylinderGeometry(0.035, 0.039, 0.014, 24), brassMat, 'grab_btn_bezel');
  btnBezel.position.set(0.055, 0.022, 0.008);
  deck.add(btnBezel);
  const grabBtn = pivot('grab_btn_cap', deck, 0.055, 0.034, 0.008);
  grabBtn.add(mesh(new THREE.CylinderGeometry(0.028, 0.029, 0.018, 24), lacquer('#d8563c', { name: 'lacquer_grab_btn' }), 'grab_btn_mesh'));

  const bulbs = [];
  for (let i = 0; i < 5; i++) {
    const bx = 0.13 + i * 0.022;
    const bezel = mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.008, 12), brassMat, 'bulb_bezel_' + i);
    bezel.position.set(bx, 0.024, -0.026);
    deck.add(bezel);
    const mat = new THREE.MeshStandardMaterial({
      color: '#ffd27a',
      emissive: new THREE.Color('#ffaa33'),
      emissiveIntensity: 1.4,
      roughness: 0.25,
    });
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 12, 10), mat);
    b.position.set(bx, 0.03, -0.026);
    deck.add(b);
    bulbs.push(b);
  }

  // ── 7. MECHANICAL BRASS GANTRY RAILS + ARTICULATED 3-PRONG CLAW
  const railY = PLAYFIELD.ceilingY - 0.02;
  for (const s of [-1, 1]) {
    const r = mesh(new THREE.CylinderGeometry(0.006, 0.006, PLAYFIELD.halfZ * 2 + 0.02, 10), brassMat, 'rail_z_' + s);
    r.rotation.x = Math.PI / 2;
    r.position.set(s * (PLAYFIELD.halfX + 0.004), railY, 0);
    root.add(r);
  }
  const gantryZ = pivot('gantry_z', root, 0, railY, 0);
  for (const dz of [-0.012, 0.012]) {
    const bar = mesh(new THREE.CylinderGeometry(0.0055, 0.0055, PLAYFIELD.halfX * 2 + 0.02, 10), brassMat, 'rail_x_' + dz);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 0, dz);
    gantryZ.add(bar);
  }
  const trolley = pivot('trolley_x', gantryZ, 0, -0.008, 0);
  trolley.add(mesh(new RoundedBoxGeometry(0.068, 0.026, 0.048, 2, 0.005), darkWoodMat, 'trolley_box'));
  const drum = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.032, 14), brassMat, 'winch_drum');
  drum.rotation.z = Math.PI / 2;
  drum.position.y = -0.014;
  trolley.add(drum);

  const cableGeo = new THREE.CylinderGeometry(0.0022, 0.0022, 1, 8);
  cableGeo.translate(0, -0.5, 0);
  const cable = mesh(cableGeo, new THREE.MeshStandardMaterial({ color: '#5b483a', roughness: 0.8 }), 'claw_cable');
  cable.position.set(0, -0.016, 0);
  trolley.add(cable);

  const clawHead = pivot('claw_head', trolley, 0, -0.075, 0);
  clawHead.add(mesh(new THREE.CylinderGeometry(0.02, 0.028, 0.028, 18), brassMat, 'claw_bell'));
  const hub = mesh(new THREE.SphereGeometry(0.016, 14, 10), woodMat, 'claw_hub');
  hub.position.y = -0.016;
  clawHead.add(hub);

  const prongs = [];
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const pHolder = pivot('prong_holder_' + i, clawHead, 0, -0.014, 0);
    pHolder.rotation.y = ang;
    const pJoint = pivot('prong_joint_' + i, pHolder, 0.018, 0, 0);

    const upper = mesh(new THREE.CapsuleGeometry(0.0042, 0.044, 4, 8), brassMat, 'prong_upper_' + i);
    upper.position.set(0.014, -0.02, 0);
    upper.rotation.z = 0.52;
    pJoint.add(upper);

    const lower = mesh(new THREE.CapsuleGeometry(0.004, 0.048, 4, 8), brassMat, 'prong_lower_' + i);
    lower.position.set(0.016, -0.06, 0);
    lower.rotation.z = -0.42;
    pJoint.add(lower);

    const tip = mesh(new THREE.SphereGeometry(0.0075, 12, 10), rubberMat, 'prong_tip_' + i);
    tip.position.set(0.003, -0.084, 0);
    pJoint.add(tip);

    prongs.push(pJoint);
  }

  return {
    root,
    gantryZ,
    trolley,
    cable,
    clawHead,
    prongs,
    targetRing,
    targetTurntable,
    vitrineLight,
    joyStick,
    grabBtn,
    bulbs,
    flapPivot,
    prizeLight,
    setMarquee(targetEntry, primaryText = '请抓住这位伙伴 →', rightSub = '← 橱窗里的伙伴') {
      drawLeftPlaque(leftCanvas, primaryText);
      leftTex.needsUpdate = true;
      drawRightPlaque(rightCanvas, targetEntry, rightSub);
      rightTex.needsUpdate = true;
    },
    setAttempts(left) {
      bulbs.forEach((b, idx) => {
        const on = idx < left;
        b.material.emissiveIntensity = on ? 1.5 : 0.05;
        b.material.color.set(on ? '#ffd27a' : '#55473a');
      });
    },
    setClawOpen(openAmt) {
      const angle = -0.14 + openAmt * 0.56;
      for (const p of prongs) p.rotation.z = angle;
    },
    setClawDrop(dropLen) {
      const len = Math.max(0.055, dropLen);
      clawHead.position.y = -len;
      cable.scale.y = Math.max(0.01, len - 0.016);
    },
    dispose() {
      leftTex.dispose();
      rightTex.dispose();
      const geos = new Set(), mats = new Set();
      root.traverse((o) => {
        if (o.geometry) geos.add(o.geometry);
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => mats.add(m));
      });
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}
