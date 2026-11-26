// HAIZ · 自由移动 — Physics Engine Integration (cannon-es 0.20.0, MIT License)
//
// Bridges HAIZ's surveyed campus world into a real rigid-body physics world:
//   1. Static campus buildings & ground plane mirrored from world.hulls / world.model.buildings
//   2. Kinematic player-vehicle proxy collider that transfers real impulses to dynamic campus props
//   3. Dynamic campus props (basketballs on 篮球场, soccer ball on 操场, painted wooden cones by forecourt)
//      rendered in HAIZ's exact cel + outline style and blown by the vortex wake as well as bumped by wheels
//   4. Spring-damper suspension integrator (bicycle fork + saddle compression, skateboard bushing & landing squat)
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { cel } from '../../lanren/ruhua-stroll/atmos.js';
import { outlineMaterial } from '../../lanren/ruhua-stroll/student.js';

function makePropMat(hex, soft = 0.2, extra = '') {
  return cel({
    name: 'phys-' + hex,
    key: 'phys-' + hex + (extra ? '-x' : ''),
    color: new THREE.Color(hex),
    soft,
    fragment: { albedo: extra },
  });
}

function addOutline(mesh, width = 0.004) {
  const m = outlineMaterial();
  m.uniforms.uWidth.value = width;
  const e = new THREE.Mesh(mesh.geometry, m);
  e.castShadow = false;
  e.receiveShadow = false;
  e.userData.noOutline = true;
  mesh.add(e);
}

function basketballTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#c85a26';
  g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#251e1a';
  g.lineWidth = 4;
  g.beginPath(); g.moveTo(0, 64); g.lineTo(256, 64); g.stroke();
  g.beginPath(); g.moveTo(64, 0); g.lineTo(64, 128); g.moveTo(192, 0); g.lineTo(192, 128); g.stroke();
  g.beginPath(); g.arc(0, 64, 42, -1.2, 1.2); g.stroke();
  g.beginPath(); g.arc(128, 64, 42, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(256, 64, 42, Math.PI - 1.2, Math.PI + 1.2); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function soccerTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#f0ebe0';
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#222629';
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 3; j++) {
      if ((i + j) % 2 === 0) {
        g.beginPath();
        g.arc(i * 44 + 22, j * 44 + 20, 14, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createPhysics({ world, layer, heightAt }) {
  const cw = new CANNON.World();
  cw.gravity.set(0, -9.81, 0);
  cw.broadphase = new CANNON.SAPBroadphase(cw);
  cw.allowSleep = true;

  const matGround = new CANNON.Material('ground');
  const matBall = new CANNON.Material('ball');
  const matCone = new CANNON.Material('cone');
  const matRider = new CANNON.Material('rider');

  cw.addContactMaterial(new CANNON.ContactMaterial(matGround, matBall, { friction: 0.45, restitution: 0.72 }));
  cw.addContactMaterial(new CANNON.ContactMaterial(matGround, matCone, { friction: 0.6, restitution: 0.22 }));
  cw.addContactMaterial(new CANNON.ContactMaterial(matRider, matBall, { friction: 0.3, restitution: 0.85 }));
  cw.addContactMaterial(new CANNON.ContactMaterial(matRider, matCone, { friction: 0.4, restitution: 0.35 }));

  const groundY = world.geo.frame.ground;
  const groundBody = new CANNON.Body({ mass: 0, material: matGround });
  groundBody.addShape(new CANNON.Plane());
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  groundBody.position.set(0, groundY, 0);
  cw.addBody(groundBody);

  // Static building solids from HAIZ's hulls/buildings
  const byId = new Map(world.model.buildings.map((b) => [b.id, b]));
  const hulls = world.hulls?.length ? world.hulls : [];
  const added = new Set();
  const addBox = (cx, cz, hw, hd, h, rot = 0) => {
    const body = new CANNON.Body({ mass: 0, material: matGround });
    body.addShape(new CANNON.Box(new CANNON.Vec3(Math.max(0.4, hw), h * 0.5, Math.max(0.4, hd))));
    body.position.set(cx, groundY + h * 0.5, cz);
    body.quaternion.setFromEuler(0, rot, 0);
    cw.addBody(body);
  };
  for (const h of hulls) {
    const b = byId.get(h.id);
    if (!b || b.form === 'corr') continue;
    addBox(h.cx, h.cz, h.hw, h.hd, b.height || 12, h.rot || 0);
    added.add(h.id);
  }
  for (const b of world.model.buildings) {
    if (b.form === 'corr' || added.has(b.id)) continue;
    addBox(b.cx, b.cz, b.w * 0.5, b.d * 0.5, b.height || 12, b.rot || 0);
  }

  // Kinematic rider collider that physically knocks balls & cones as you move past
  const riderBody = new CANNON.Body({
    mass: 0,
    type: CANNON.Body.KINEMATIC,
    material: matRider,
    shape: new CANNON.Cylinder(0.48, 0.48, 1.5, 8),
  });
  riderBody.position.set(0, groundY + 1, -10);
  cw.addBody(riderBody);

  // Interactive campus physics props (basketballs, soccer balls, slalom cones)
  const group = new THREE.Group();
  group.name = 'campus-physics-props';
  const props = [];

  const bballMat = cel({ name: 'phys-bball', key: 'phys-bball', map: basketballTexture(), soft: 0.2 });
  const soccerMat = cel({ name: 'phys-soccer', key: 'phys-soccer', map: soccerTexture(), soft: 0.2 });
  const coneMat = makePropMat('#cf582e', 0.16, 'float band = step(0.18, fract(vWP.y * 5.5)) * step(fract(vWP.y * 5.5), 0.36); albedo = mix(albedo, vec3(0.95, 0.92, 0.85), band);\n');

  function spawnBall(kind, x, z) {
    const r = kind === 'bball' ? 0.145 : 0.135;
    const gy = heightAt(x, z);
    const body = new CANNON.Body({
      mass: kind === 'bball' ? 0.62 : 0.45,
      material: matBall,
      shape: new CANNON.Sphere(r),
      linearDamping: 0.22,
      angularDamping: 0.28,
    });
    body.position.set(x, gy + r + 0.05, z);
    cw.addBody(body);

    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), kind === 'bball' ? bballMat : soccerMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    addOutline(mesh, 0.003);
    group.add(mesh);
    props.push({ kind, body, mesh, home: [x, gy + r + 0.1, z], r, windDrag: 0.42 });
  }

  function spawnCone(x, z) {
    const gy = heightAt(x, z);
    const h = 0.42, r = 0.13;
    const body = new CANNON.Body({
      mass: 0.85,
      material: matCone,
      shape: new CANNON.Cylinder(0.04, r, h, 8),
      linearDamping: 0.35,
      angularDamping: 0.45,
    });
    body.position.set(x, gy + h * 0.5 + 0.02, z);
    cw.addBody(body);

    const g = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 12), coneMat);
    const base = new THREE.Mesh(new THREE.BoxGeometry(r * 2.1, 0.035, r * 2.1), makePropMat('#3a3530', 0.2));
    base.position.y = -h * 0.5 + 0.017;
    cone.castShadow = true; cone.receiveShadow = true;
    addOutline(cone, 0.003);
    g.add(cone, base);
    group.add(g);
    props.push({ kind: 'cone', body, mesh: g, home: [x, gy + h * 0.5 + 0.05, z], r: 0.16, windDrag: 0.28 });
  }

  // Basketballs on 篮球场, soccer balls on 操场, slalom skate cones along the sunlit forecourt avenue
  spawnBall('bball', -126, 44);
  spawnBall('bball', -138, 56);
  spawnBall('bball', -122, 58);
  spawnBall('soccer', -201, -58.8);
  spawnBall('soccer', -182, -45);
  // Slalom skate/bike cones on the wide sunlit paved plaza west of the century tree
  for (let i = 0; i < 5; i++) {
    spawnCone(-26 - i * 4.5, -18 + (i % 2 ? 1.4 : -1.4));
  }

  group.traverse((o) => o.layers.set(layer));
  world.group.add(group);

  // Spring-damper suspension state (shared helper for bike fork/saddle & board bushings)
  const susp = {
    forkY: 0, forkV: 0,
    saddleY: 0, saddleV: 0,
    pitch: 0, pitchV: 0,
    lastSlab: 0,
  };

  function stepSuspension(dt, { speed, surface, brakeForce, accelForce, bumpImpulse, air }) {
    if (air) {
      susp.forkY += (0.025 - susp.forkY) * Math.min(1, dt * 8);
      susp.forkV *= 0.85;
      susp.saddleY += (0 - susp.saddleY) * Math.min(1, dt * 8);
      susp.pitch += (0 - susp.pitch) * Math.min(1, dt * 6);
      return susp;
    }
    // Road seam pulse every ~2m on paving, continuous micro-bumps on lawn
    let excite = bumpImpulse * 1.4;
    if (speed > 0.6) {
      if (surface === 'lawn') {
        const t = performance.now() * 0.001;
        excite += (Math.sin(t * 23 + speed) * 0.6 + Math.sin(t * 37.3) * 0.4) * Math.min(1, speed / 4) * 0.35;
      } else {
        susp.lastSlab += speed * dt;
        if (susp.lastSlab > 2.0) {
          susp.lastSlab -= 2.0;
          excite -= Math.min(0.45, speed * 0.045);
        }
      }
    }
    // Fork spring-damper (natural freq ~28 rad/s, lightly damped)
    const targetFork = -brakeForce * 0.035 + accelForce * 0.015;
    const kf = 180, cf = 16;
    susp.forkV += (kf * (targetFork - susp.forkY) - cf * susp.forkV + excite * 12) * dt;
    susp.forkY = THREE.MathUtils.clamp(susp.forkY + susp.forkV * dt, -0.065, 0.045);

    // Rear saddle shock (softer)
    const ks = 120, cs = 14;
    susp.saddleV += (ks * (-susp.saddleY) - cs * susp.saddleV + excite * 6) * dt;
    susp.saddleY = THREE.MathUtils.clamp(susp.saddleY + susp.saddleV * dt, -0.04, 0.035);

    // Weight-transfer chassis pitch (nose dips under braking, lifts lightly on hard push)
    const targetPitch = -brakeForce * 0.055 + accelForce * 0.028;
    susp.pitchV += (75 * (targetPitch - susp.pitch) - 11 * susp.pitchV) * dt;
    susp.pitch = THREE.MathUtils.clamp(susp.pitch + susp.pitchV * dt, -0.1, 0.08);
    return susp;
  }

  const windOut = [0, 0, 0, 0];
  let stepAcc = 0;

  function update(dt, playerPos, playerVel, vortex) {
    // Update kinematic rider body position & velocity so collisions impart real momentum
    riderBody.position.set(playerPos.x, playerPos.y + 0.78, playerPos.z);
    riderBody.velocity.set(playerVel.x, playerVel.y, playerVel.z);

    // Wake wind blows physics props (balls roll across the court/field when broom skims over!)
    if (vortex) {
      for (const p of props) {
        const b = p.body;
        const dx = b.position.x - playerPos.x, dz = b.position.z - playerPos.z;
        if (dx * dx + dz * dz > 400) continue;
        const mag = vortex.sample(b.position.x, b.position.y + 0.15, b.position.z, windOut);
        if (mag > 0.35) {
          b.wakeUp();
          const f = p.windDrag * b.mass * 2.2;
          b.applyForce(new CANNON.Vec3(windOut[0] * f, Math.max(0, windOut[1]) * f * 0.6, windOut[2] * f));
        }
      }
    }

    // Fixed-timestep cannon-es simulation (1/60s, max 3 substeps)
    stepAcc = Math.min(stepAcc + dt, 0.05);
    while (stepAcc >= 1 / 60) {
      cw.step(1 / 60);
      stepAcc -= 1 / 60;
    }

    // Sync visuals and clamp to actual campus heightAt (decks/ramps)
    for (const p of props) {
      const b = p.body;
      const gy = heightAt(b.position.x, b.position.z) + p.r;
      if (b.position.y < gy - 0.02) {
        b.position.y = gy;
        if (b.velocity.y < 0) b.velocity.y *= -0.5;
      }
      // Reset runaway props that leave campus bounds
      if (Math.hypot(b.position.x - p.home[0], b.position.z - p.home[2]) > 90) {
        b.position.set(...p.home);
        b.velocity.setZero();
        b.angularVelocity.setZero();
      }
      p.mesh.position.set(b.position.x, b.position.y, b.position.z);
      p.mesh.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
    }
  }

  return {
    world: cw,
    props,
    susp,
    stepSuspension,
    update,
    stats: () => ({ bodies: cw.bodies.length, props: props.length }),
  };
}
