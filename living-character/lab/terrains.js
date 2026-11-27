import * as THREE from 'three';
import { MultiSurfaceGroundDetector, sampleDiscreteStairs } from '../engine/foot-ik-terrain.js';

function createLimestoneTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ddd6c7';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle architectural stone tile grid (1m reference scale)
  ctx.strokeStyle = 'rgba(110, 102, 88, 0.22)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  // Soft watercolor speckling
  for (let i = 0; i < 1600; i++) {
    const x = (i * 73) % 512;
    const y = (i * 197) % 512;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(90,82,70,0.08)';
    ctx.fillRect(x, y, 2, 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 16);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Create a clean test stage & matching analytical MultiSurfaceGroundDetector
 * supporting: 'flat' | 'stairs' | 'slopes' | 'course'
 */
export function buildLabTerrainStage(scene) {
  const group = new THREE.Group();
  group.name = 'HAIZ_Lab_Terrains';
  scene.add(group);

  const stoneTex = createLimestoneTexture();
  const baseMat = new THREE.MeshStandardMaterial({
    map: stoneTex,
    roughness: 0.88,
    metalness: 0.02,
  });
  const stairMat = new THREE.MeshStandardMaterial({
    color: 0xc8bfa8,
    roughness: 0.85,
    metalness: 0.04,
  });
  const slopeMat = new THREE.MeshStandardMaterial({
    color: 0xbda991,
    roughness: 0.86,
    metalness: 0.03,
  });

  // Base continuous ground plane
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), baseMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // Subtle meter calibration markers along Z (-10m..+24m)
  const markGroup = new THREE.Group();
  const markMat = new THREE.MeshBasicMaterial({ color: 0x8f8574, transparent: true, opacity: 0.38 });
  for (let z = -12; z <= 24; z += 2) {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 0.03), markMat);
    bar.rotation.x = -Math.PI / 2;
    bar.position.set(0, 0.002, z);
    markGroup.add(bar);
  }
  group.add(markGroup);

  // Build Staircase Assembly (at X = 0, Z = 1.5 .. 8.85 for stairs/course mode)
  const stairGroup = new THREE.Group();
  const STAIR_COUNT = 8;
  const STEP_D = 0.34;
  const STEP_H = 0.145;
  const TOP_Y = STAIR_COUNT * STEP_H; // 1.16 m
  const Z_UP_START = 1.6;
  const LANDING_LEN = 2.4;
  const Z_TOP_START = Z_UP_START + STAIR_COUNT * STEP_D;
  const Z_DN_START = Z_TOP_START + LANDING_LEN;
  const Z_DN_END = Z_DN_START + STAIR_COUNT * STEP_D;

  for (let i = 0; i < STAIR_COUNT; i++) {
    const hUp = (i + 1) * STEP_H;
    const stepUp = new THREE.Mesh(new THREE.BoxGeometry(3.8, hUp, STEP_D + 0.004), stairMat);
    stepUp.position.set(0, hUp * 0.5, Z_UP_START + (i + 0.5) * STEP_D);
    stepUp.castShadow = true;
    stepUp.receiveShadow = true;
    stairGroup.add(stepUp);

    const hDn = (STAIR_COUNT - i) * STEP_H;
    const stepDn = new THREE.Mesh(new THREE.BoxGeometry(3.8, hDn, STEP_D + 0.004), stairMat);
    stepDn.position.set(0, hDn * 0.5, Z_DN_START + (i + 0.5) * STEP_D);
    stepDn.castShadow = true;
    stepDn.receiveShadow = true;
    stairGroup.add(stepDn);
  }
  const landing = new THREE.Mesh(new THREE.BoxGeometry(3.8, TOP_Y, LANDING_LEN + 0.02), stairMat);
  landing.position.set(0, TOP_Y * 0.5, Z_TOP_START + LANDING_LEN * 0.5);
  landing.castShadow = true;
  landing.receiveShadow = true;
  stairGroup.add(landing);
  group.add(stairGroup);

  // Build Ramp / Slopes Assembly (at Z = 11.2 .. 22.8)
  const slopeGroup = new THREE.Group();
  const Z_SLOPE_START = 11.2;
  const RAMP1_LEN = 5.4; // ~10 deg up (rise 0.95m)
  const CREST_Y = 0.95;
  const CREST_LEN = 2.0;
  const RAMP2_LEN = 3.6; // ~15 deg down

  const buildRampMesh = (z0, z1, y0, y1, width = 3.8) => {
    const dx = width * 0.5;
    const verts = new Float32Array([
      -dx, y0, z0,  dx, y0, z0,  dx, y1, z1,
      -dx, y0, z0,  dx, y1, z1, -dx, y1, z1,
      -dx, 0, z0,   -dx, y0, z0, -dx, y1, z1,
      -dx, 0, z0,   -dx, y1, z1, -dx, 0, z1,
       dx, 0, z0,    dx, y1, z1,  dx, y0, z0,
       dx, 0, z0,    dx, 0, z1,   dx, y1, z1,
    ]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, slopeMat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  slopeGroup.add(buildRampMesh(Z_SLOPE_START, Z_SLOPE_START + RAMP1_LEN, 0, CREST_Y));
  const crestMesh = new THREE.Mesh(new THREE.BoxGeometry(3.8, CREST_Y, CREST_LEN), slopeMat);
  crestMesh.position.set(0, CREST_Y * 0.5, Z_SLOPE_START + RAMP1_LEN + CREST_LEN * 0.5);
  crestMesh.castShadow = true;
  crestMesh.receiveShadow = true;
  slopeGroup.add(crestMesh);
  const zR2 = Z_SLOPE_START + RAMP1_LEN + CREST_LEN;
  slopeGroup.add(buildRampMesh(zR2, zR2 + RAMP2_LEN, CREST_Y, 0));
  group.add(slopeGroup);

  const flights = [
    { minX: -1.9, maxX: 1.9, minZ: Z_UP_START, maxZ: Z_TOP_START, axis: 'z', yStart: 0, yEnd: TOP_Y, steps: STAIR_COUNT },
    { minX: -1.9, maxX: 1.9, minZ: Z_DN_START, maxZ: Z_DN_END, axis: 'z', yStart: TOP_Y, yEnd: 0, steps: STAIR_COUNT },
  ];

  let activeTerrain = 'flat';

  const setTerrainMode = (mode) => {
    activeTerrain = mode;
    stairGroup.visible = mode === 'stairs' || mode === 'course';
    slopeGroup.visible = mode === 'slopes' || mode === 'course';
  };
  setTerrainMode('flat');

  const analyticalHeight = (x, z, _refY, outNormal) => {
    outNormal.set(0, 1, 0);
    if (activeTerrain === 'flat') return 0;

    if ((activeTerrain === 'stairs' || activeTerrain === 'course') && Math.abs(x) <= 1.95) {
      if (z >= Z_UP_START && z <= Z_DN_END) {
        if (z >= Z_TOP_START && z <= Z_DN_START) return TOP_Y;
        const sh = sampleDiscreteStairs(flights, x, z);
        if (sh !== null) return sh;
      }
    }

    if ((activeTerrain === 'slopes' || activeTerrain === 'course') && Math.abs(x) <= 1.95) {
      if (z >= Z_SLOPE_START && z < Z_SLOPE_START + RAMP1_LEN) {
        const t = (z - Z_SLOPE_START) / RAMP1_LEN;
        const dy = CREST_Y / RAMP1_LEN;
        outNormal.set(0, 1, -dy).normalize();
        return t * CREST_Y;
      }
      if (z >= Z_SLOPE_START + RAMP1_LEN && z <= zR2) {
        return CREST_Y;
      }
      if (z > zR2 && z <= zR2 + RAMP2_LEN) {
        const t = (z - zR2) / RAMP2_LEN;
        const dy = -CREST_Y / RAMP2_LEN;
        outNormal.set(0, 1, -dy).normalize();
        return (1 - t) * CREST_Y;
      }
    }
    return 0;
  };

  const groundDetector = new MultiSurfaceGroundDetector({
    analyticalHeight,
  });

  return {
    group,
    groundDetector,
    setTerrainMode,
    getTerrainMode: () => activeTerrain,
    stairBounds: { Z_UP_START, Z_DN_END, Z_SLOPE_START, zR2End: zR2 + RAMP2_LEN },
  };
}
