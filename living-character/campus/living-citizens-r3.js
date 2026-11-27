import * as THREE from 'three';
import { LivingCharacterAgent } from '../engine/motion-engine.js';

const CITIZEN_SPECS_R3 = [
  {
    id: 'lin', name: '林知夏', role: '高二（3）班 · 植物社',
    archetype: 'student_f', bags: { backpack: false, crossbody: true }, speed: 1.32, seed: 11,
    route: ['terminalia', 'yihao_portal', 'inner_court', 'yanchi', 'arts', 'library'],
    shelter: 'yihao_portal',
    lines: {
      clear: ['这棵百年榄仁的枝影，每天下午四点最美。', '刚从砚池那边写生回来，今天水色很清。'],
      rain: ['下雨了，一号楼柱廊下面淋不到雨。', '热带阵雨来得快，等会儿地上就会反光。'],
      bell: ['听见车铃啦，林荫道慢点骑哦！'],
    },
  },
  {
    id: 'chen', name: '陈屿', role: '高一（7）班 · 篮球队',
    archetype: 'student_hero', bags: { backpack: true, crossbody: false }, speed: 1.72, seed: 23,
    route: ['basketball', 'track_entry', 'forecourt', 'taihu_plaza', 'dorm_m'],
    shelter: 'fengqiting',
    lines: {
      clear: ['六片球场全开！去打半场吗？', '跑道那边的晚霞绝了，快去看看！'],
      rain: ['哎呀场地湿了，先去凤栖亭避一避！'],
      bell: ['让路让路——车骑得挺帅！'],
    },
  },
  {
    id: 'fu', name: '符老师', role: '物理组教师',
    archetype: 'teacher_f', bags: { backpack: false, crossbody: false }, speed: 1.18, seed: 37,
    route: ['science', 'erhao', 'inner_court', 'yihao_portal', 'north_gate'],
    shelter: 'yihao_portal',
    lines: {
      clear: ['刚在科学馆整理完光学实验，下午光线正适合看砚池倒影。', '同学们下课注意看路。'],
      rain: ['带好雨伞，别在湿滑石阶上奔跑。'],
      bell: ['嗯，提前打铃很有礼貌。'],
    },
  },
  {
    id: 'wang', name: '王书瑶', role: '高三（1）班 · 天文社',
    archetype: 'student_f', bags: { backpack: true, crossbody: false }, speed: 1.24, seed: 53,
    route: ['library', 'yanlinting', 'forecourt', 'fengqitang', 'library'],
    shelter: 'yanlinting',
    lines: {
      clear: ['今晚如果云散了，图书馆天文台能看到木星。', '衍林亭那边很安静，适合背书。'],
      rain: ['海口阵雨之后空气最通透，晚上观星反而更好。'],
      bell: ['啊，抱歉走神挡路了。'],
    },
  },
  {
    id: 'wu', name: '吴伯', role: '校园园艺与后勤',
    archetype: 'worker_m', bags: { backpack: false, crossbody: false }, speed: 1.05, seed: 71,
    route: ['north_gate', 'palm_avenue', 'forecourt', 'terminalia', 'fengqitang'],
    shelter: 'fengqiting',
    lines: {
      clear: ['刚扫完椰林大道的落叶，风一吹又掉几片。', '老榄仁树和太湖石都精神着呢。'],
      rain: ['雨大起来咯，快进走廊躲躲。'],
      bell: ['好好好，慢些骑，莫急。'],
    },
  },
  {
    id: 'zhou', name: '周明朗', role: '高二（9）班 · 合唱团',
    archetype: 'student_hero', bags: { backpack: false, crossbody: true }, speed: 1.38, seed: 89,
    route: ['arts', 'yanchi', 'science', 'canteen1', 'dorm_m'],
    shelter: 'arts',
    lines: {
      clear: ['艺术中心排练刚结束，砚池风吹过来特别凉快。', '晚饭去一堂还是三堂？'],
      rain: ['艺术中心大门廊刚好能听着雨声看砚池起涟漪。'],
      bell: ['叮当声真清脆！'],
    },
  },
];

function createUmbrella() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.011, 0.88, 6),
    new THREE.MeshStandardMaterial({ color: '#2b2d30' })
  );
  pole.position.y = 0.44;
  const dome = new THREE.Mesh(
    new THREE.ConeGeometry(0.56, 0.22, 10, 1, true),
    new THREE.MeshStandardMaterial({ color: '#276754', roughness: 0.5, side: THREE.DoubleSide })
  );
  dome.position.y = 0.86;
  g.add(pole, dome);
  g.visible = false;
  return g;
}

/**
 * Round 3 Living Campus Ecosystem:
 *  - Upgrades all 6 named campus citizens to LivingCharacterAgent (`lod1` + 60/30/15Hz Anim LOD
 *    + quantized stairs IK + turn cascade + secondary spring bags/hair + desynchronized gaits).
 *  - Preserves Round 2's ambient orange cat, tropical butterflies, swifts & Yanchi koi.
 */
export class LivingCampusR3 {
  constructor(scene, spatial, atmosphere, groundDetector, { onSpeak = () => {} } = {}) {
    this.scene = scene;
    this.spatial = spatial;
    this.atmosphere = atmosphere;
    this.groundDetector = groundDetector;
    this.onSpeak = onSpeak;
    this.root = new THREE.Group();
    this.root.name = 'haiz_living_campus_r3';
    scene.add(this.root);

    this.citizens = [];
    this.lastSpeakTime = -10;
    this.lastSpeaker = null;
    this._tmpHand = new THREE.Vector3();

    this.cat = this._createCampusCat();
    this.butterflies = this._createButterflies(16);
    this.swifts = this._createSwifts(12);
    this.koi = this._createYanchiKoi();
  }

  async loadCitizens() {
    const built = await Promise.all(CITIZEN_SPECS_R3.map(async (cfg, idx) => {
      const startPlace = this.spatial.places[cfg.route[0]];
      const sx = startPlace.x + ((idx % 3) - 1) * 1.4;
      const sz = -startPlace.y + (idx % 2 === 0 ? 1.2 : -1.2);
      const sy = this.spatial.heightAtThree(sx, sz);

      const agent = await LivingCharacterAgent.create({
        archetype: cfg.archetype,
        lod: 'lod1',
        groundDetector: this.groundDetector,
        shaderUniforms: this.atmosphere.uniforms,
        showBackpack: cfg.bags.backpack,
        showCrossbody: cfg.bags.crossbody,
        config: { walkSpeed: cfg.speed },
      });
      this.root.add(agent.model);
      agent.setPosition(sx, sy, sz, (idx * 1.1) % (Math.PI * 2));
      // Desynchronize starting stride phase so NPCs never march like clones
      agent.mocapLayer.idleTimer = idx * 1.73;

      const umbrella = createUmbrella();
      this.root.add(umbrella);

      return {
        cfg,
        agent,
        umbrella,
        routeIdx: 0,
        path: [],
        pathIdx: 0,
        waitTimer: idx * 0.75,
        sheltering: false,
      };
    }));
    this.citizens.push(...built);
  }

  _createCampusCat() {
    const g = new THREE.Group();
    const fur = new THREE.MeshStandardMaterial({ color: '#d98a36', roughness: 0.78 });
    const white = new THREE.MeshStandardMaterial({ color: '#f3ece2', roughness: 0.78 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.10, 0.28, 4, 8), fur);
    body.rotation.x = Math.PI * 0.5;
    body.position.y = 0.21;
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), fur);
    head.position.set(0, 0.28, 0.20);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.015, 0.30, 6), fur);
    tail.position.set(0, 0.26, -0.24);
    tail.rotation.x = -0.65;
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), white);
    chest.position.set(0, 0.20, 0.14);
    g.add(body, head, tail, chest);
    const p = { x: 26, z: 32, yaw: 0.5, tail };
    g.position.set(p.x, this.spatial.heightAtThree(p.x, p.z), p.z);
    this.root.add(g);
    return { group: g, state: p, speed: 0.85, routeIdx: 0, waypoints: [[26, 32], [38, 12], [58, -14], [14, -18], [-12, -26]] };
  }

  _createButterflies(count) {
    const grp = new THREE.Group();
    const cols = ['#f2b838', '#3384c8', '#efe4c8', '#e26a40'];
    const list = [];
    for (let i = 0; i < count; i++) {
      const m = new THREE.MeshBasicMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide });
      const b = new THREE.Group();
      const wL = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.08), m);
      wL.position.x = -0.05;
      const wR = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.08), m);
      wR.position.x = 0.05;
      b.add(wL, wR);
      const cx = (i % 4 - 1.5) * 18 + 8;
      const cz = (Math.floor(i / 4) - 1.5) * 26 - 10;
      b.position.set(cx, 1.3, cz);
      grp.add(b);
      list.push({ b, wL, wR, cx, cz, ph: i * 1.3, rad: 2.2 + (i % 3) * 1.4 });
    }
    this.root.add(grp);
    return { grp, list };
  }

  _createSwifts(count) {
    const grp = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: '#273138', roughness: 0.7, side: THREE.DoubleSide });
    const list = [];
    for (let i = 0; i < count; i++) {
      const bird = new THREE.Group();
      const wingL = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0.14), new THREE.Vector3(-0.34, 0, -0.08), new THREE.Vector3(0, 0, -0.10),
      ]), mat);
      const wingR = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0.14), new THREE.Vector3(0, 0, -0.10), new THREE.Vector3(0.34, 0, -0.08),
      ]), mat);
      bird.add(wingL, wingR);
      grp.add(bird);
      list.push({ bird, wingL, wingR, radius: 28 + i * 5.2, alt: 24 + (i % 4) * 4.5, ph: i * 0.72, speed: 0.22 + (i % 3) * 0.04 });
    }
    this.root.add(grp);
    return { grp, list };
  }

  _createYanchiKoi() {
    const grp = new THREE.Group();
    const list = [];
    const cols = ['#df4a24', '#f2a233', '#f4efe6', '#d63e22'];
    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.055, 0.24, 3, 6),
        new THREE.MeshStandardMaterial({ color: cols[i % cols.length], roughness: 0.25 })
      );
      mesh.rotation.x = Math.PI * 0.5;
      grp.add(mesh);
      list.push({ mesh, cx: 48.0 + (i % 3) * 3.2 - 3.0, cz: 116.5 + Math.floor(i / 3) * 3.0 - 3.0, r: 2.2 + (i % 3) * 0.9, ph: i * 0.85, spd: 0.35 + (i % 3) * 0.12 });
    }
    this.root.add(grp);
    return { grp, list };
  }

  getCitizenMapPoints() {
    return this.citizens.map((c) => ({
      x: c.agent.human.position.x,
      z: c.agent.human.position.z,
      name: c.cfg.name,
      color: '#1b7a5d',
    }));
  }

  onPlayerBell(playerPos) {
    for (const c of this.citizens) {
      const p = c.agent.human.position;
      if (Math.hypot(p.x - playerPos.x, p.z - playerPos.z) < 16) {
        this.onSpeak(c.cfg.name, c.cfg.role, c.cfg.lines.bell[0]);
        c.agent.setMoveTarget(0, Math.atan2(playerPos.x - p.x, playerPos.z - p.z));
        return;
      }
    }
  }

  update(dt, runtime, playerPos, cameraPos = playerPos) {
    const t = runtime.simTime;
    const isRain = this.atmosphere.uniforms.uRain.value > 0.35;
    const isNight = runtime.hour < 6.0 || runtime.hour > 22.8;

    for (const c of this.citizens) {
      const pos = c.agent.human.position;
      c.agent.setCameraDistance(pos.distanceTo(cameraPos));
      c.agent.setWind(this.atmosphere.uniforms.uWindDir.value, this.atmosphere.uniforms.uWindStrength.value);

      if (isRain && !c.sheltering) {
        c.sheltering = true;
        const sh = this.spatial.places[c.cfg.shelter];
        c.path = this.spatial.findPathThree(pos.x, pos.z, sh.x, -sh.y);
        c.pathIdx = 0;
        c.waitTimer = 0;
      } else if (!isRain && c.sheltering) {
        c.sheltering = false;
        c.path = [];
      }

      let desiredSpd = 0;
      let desiredHdg = c.agent.desiredHeading;
      if (c.waitTimer > 0) {
        c.waitTimer -= dt;
      } else {
        if (!c.path.length || c.pathIdx >= c.path.length) {
          if (c.sheltering) {
            c.waitTimer = 5.0;
          } else {
            c.routeIdx = (c.routeIdx + 1) % c.cfg.route.length;
            const dest = this.spatial.places[c.cfg.route[c.routeIdx]];
            c.path = this.spatial.findPathThree(pos.x, pos.z, dest.x, -dest.y);
            c.pathIdx = 1;
          }
        }
        if (c.pathIdx < c.path.length) {
          const tgt = c.path[c.pathIdx];
          const dx = tgt.x - pos.x;
          const dz = tgt.z - pos.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.55) {
            c.pathIdx++;
            if (c.pathIdx >= c.path.length) c.waitTimer = 3.2 + (c.cfg.seed % 4);
          } else {
            desiredSpd = c.cfg.speed * (isRain ? 1.32 : 1.0);
            desiredHdg = Math.atan2(dx, dz);
          }
        }
      }

      // Greet player warmly when nearby
      const dPlayer = Math.hypot(pos.x - playerPos.x, pos.z - playerPos.z);
      c.agent.mocapLayer.setTalkWeight(dPlayer < 4.5 ? 1.0 : 0.0);
      if (dPlayer < 3.6 && t - this.lastSpeakTime > 9.0 && this.lastSpeaker !== c.cfg.id) {
        this.lastSpeakTime = t;
        this.lastSpeaker = c.cfg.id;
        const pool = isRain ? c.cfg.lines.rain : c.cfg.lines.clear;
        this.onSpeak(c.cfg.name, c.cfg.role, pool[Math.floor(t) % pool.length]);
      }

      c.agent.setMoveTarget(desiredSpd, desiredHdg);
      c.agent.step(dt, { measureTelemetry: false });

      const sheltered = this.spatial.isShelteredThree(pos.x, pos.z);
      c.umbrella.visible = isRain && !sheltered;
      if (c.umbrella.visible && c.agent.bones.handR) {
        c.agent.bones.handR.getWorldPosition(this._tmpHand);
        c.umbrella.position.copy(this._tmpHand);
      }
    }

    // Wildlife updates
    {
      const c = this.cat;
      const wp = c.waypoints[c.routeIdx];
      const dx = wp[0] - c.state.x;
      const dz = wp[1] - c.state.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.45) c.routeIdx = (c.routeIdx + 1) % c.waypoints.length;
      else {
        c.state.x += (dx / dist) * c.speed * dt;
        c.state.z += (dz / dist) * c.speed * dt;
        c.state.yaw = Math.atan2(dx, dz);
      }
      c.group.position.set(c.state.x, this.spatial.heightAtThree(c.state.x, c.state.z), c.state.z);
      c.group.rotation.y = c.state.yaw;
      c.state.tail.rotation.z = Math.sin(t * 2.6) * 0.25;
    }

    this.butterflies.grp.visible = !isRain && !isNight;
    if (this.butterflies.grp.visible) {
      for (const b of this.butterflies.list) {
        const a = t * 0.75 + b.ph;
        b.b.position.set(b.cx + Math.cos(a) * b.rad, 1.15 + Math.sin(a * 2.1) * 0.35, b.cz + Math.sin(a * 0.8) * b.rad);
        const flap = Math.sin(t * 14 + b.ph) * 0.78;
        b.wL.rotation.z = flap;
        b.wR.rotation.z = -flap;
      }
    }

    this.swifts.grp.visible = !isRain && !isNight;
    if (this.swifts.grp.visible) {
      for (const s of this.swifts.list) {
        const a = t * s.speed + s.ph;
        s.bird.position.set(Math.cos(a) * s.radius, s.alt + Math.sin(a * 2) * 1.4, Math.sin(a) * s.radius - 10);
        s.bird.rotation.y = -a;
        const flap = Math.sin(t * 9.5 + s.ph) * 0.55;
        s.wingL.rotation.z = flap;
        s.wingR.rotation.z = -flap;
      }
    }

    for (const k of this.koi.list) {
      const a = t * k.spd + k.ph;
      k.mesh.position.set(k.cx + Math.cos(a) * k.r, -0.18, k.cz + Math.sin(a * 0.9) * k.r);
      k.mesh.rotation.y = -a + Math.PI * 0.5;
    }
  }
}
