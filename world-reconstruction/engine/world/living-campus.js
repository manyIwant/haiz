/**
 * HAIZ · World Reconstruction — Living Campus Ecosystem & Citizens.
 *
 * Connects people, animals, plants, and weather into ONE coherent living world:
 *   1. 6 Scheduled Campus Citizens (reusing HAIZ's CC0 51-bone MakeHuman student/teacher/worker
 *      GLBs when loaded, with clean stylized fallback) walking real campus roads via A* nav,
 *      sheltering under colonnades/pavilions or raising umbrellas during rain, and reacting
 *      warmly to the player's proximity and bicycle bell!
 *   2. Campus Orange Tabby Cat (橘猫): patrols shaded lanes around Library, Block 2 & Canteen 1,
 *      seeks sunlight in cool morning, deep shade at midday, shelters under eaves during rain,
 *      and approaches when you walk calmly!
 *   3. Tropical Butterflies (凤蝶): flutter around bougainvillea beds & Yanchi in dry sun, hide in rain.
 *   4. Courtyard Swifts (海口燕群): glide smoothly across the sky above Teaching Block 1 & Terminalia.
 *   5. Yanchi Pond Koi & Cascade Mist: living ripples & swimming koi silhouettes in Yanchi.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const CITIZEN_SPECS = [
  {
    id: 'lin', name: '林知夏', role: '高二（3）班 · 植物社',
    model: 'student-f.glb', speed: 1.32, accent: '#3d7a5a',
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
    model: 'student-m.glb', speed: 1.72, accent: '#2f5f9e',
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
    model: 'teacher-f.glb', speed: 1.18, accent: '#5a4e68',
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
    model: 'student-f.glb', speed: 1.24, accent: '#7c5340',
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
    model: 'worker-m.glb', speed: 1.05, accent: '#6b6345',
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
    model: 'student-m.glb', speed: 1.38, accent: '#9a3d33',
    route: ['arts', 'yanchi', 'science', 'canteen1', 'dorm_m'],
    shelter: 'arts',
    lines: {
      clear: ['艺术中心排练刚结束，砚池风吹过来特别凉快。', '晚饭去一堂还是三堂？'],
      rain: ['艺术中心大门廊刚好能听着雨声看砚池起涟漪。'],
      bell: ['叮当声真清脆！'],
    },
  },
];

function createUmbrellaMesh() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 0.92, 6),
    new THREE.MeshStandardMaterial({ color: '#333', roughness: 0.5 })
  );
  pole.position.y = 0.46;
  const dome = new THREE.Mesh(
    new THREE.ConeGeometry(0.58, 0.24, 10, 1, true),
    new THREE.MeshStandardMaterial({ color: '#2b5e4c', roughness: 0.45, side: THREE.DoubleSide })
  );
  dome.position.y = 0.88;
  g.add(pole, dome);
  g.visible = false;
  return g;
}

function createStylizedCitizen(accent) {
  const g = new THREE.Group();
  const uniformTop = new THREE.MeshStandardMaterial({ color: '#f3f6f7', roughness: 0.72 });
  const trousers = new THREE.MeshStandardMaterial({ color: '#2c5a8a', roughness: 0.78 });
  const skin = new THREE.MeshStandardMaterial({ color: '#e6bfa0', roughness: 0.68 });
  const hair = new THREE.MeshStandardMaterial({ color: '#24201f', roughness: 0.75 });
  const bagMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.65 });

  const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.56, 4, 8), trousers);
  legL.position.set(-0.10, 0.36, 0); legL.castShadow = true;
  const legR = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.56, 4, 8), trousers);
  legR.position.set(0.10, 0.36, 0); legR.castShadow = true;
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.34, 4, 10), uniformTop);
  torso.position.set(0, 1.02, 0); torso.castShadow = true;
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.30, 0.12), bagMat);
  bag.position.set(0, 1.03, -0.17); bag.castShadow = true;
  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.40, 4, 6), uniformTop);
  armL.position.set(-0.22, 0.98, 0); armL.castShadow = true;
  const armR = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.40, 4, 6), uniformTop);
  armR.position.set(0.22, 0.98, 0); armR.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.125, 10, 10), skin);
  head.position.set(0, 1.48, 0); head.castShadow = true;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.132, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.58), hair);
  cap.position.set(0, 1.50, -0.01);

  g.add(legL, legR, torso, bag, armL, armR, head, cap);
  g.userData.parts = { legL, legR, armL, armR, torso, head };
  return g;
}

export class LivingCampus {
  constructor(scene, spatial, atmosphere, { lifeAssetBaseUrl, onSpeak = () => {} }) {
    this.scene = scene;
    this.spatial = spatial;
    this.atmosphere = atmosphere;
    this.lifeAssetBaseUrl = lifeAssetBaseUrl;
    this.onSpeak = onSpeak;

    this.root = new THREE.Group();
    this.root.name = 'haiz_living_ecosystem';
    scene.add(this.root);

    this.citizens = [];
    this._initCitizens();
    this.cat = this._createCampusCat();
    this.butterflies = this._createButterflies();
    this.swifts = this._createSwifts();
    this.koi = this._createYanchiKoi();
    this._lastSpeakTime = -10;
  }

  _initCitizens() {
    const loader = new GLTFLoader();
    for (let i = 0; i < CITIZEN_SPECS.length; i++) {
      const cfg = CITIZEN_SPECS[i];
      const holder = new THREE.Group();
      holder.name = `citizen_${cfg.id}`;
      const body = createStylizedCitizen(cfg.accent);
      const umbrella = createUmbrellaMesh();
      umbrella.position.set(0.22, 1.10, 0.12);
      holder.add(body, umbrella);

      const startPlace = this.spatial.places[cfg.route[0]];
      const sx = startPlace.x, sz = -startPlace.y;
      const sy = this.spatial.heightAtThree(sx, sz);
      holder.position.set(sx, sy, sz);
      this.root.add(holder);

      const agent = {
        cfg,
        holder,
        body,
        umbrella,
        skinned: null,
        bones: null,
        routeIdx: 0,
        path: [],
        pathIdx: 0,
        phase: i * 1.4,
        waitTimer: i * 1.2,
        sheltering: false,
        x: sx,
        z: sz,
        yaw: 0,
      };
      this.citizens.push(agent);

      // Upgrade asynchronously to HAIZ's CC0 51-bone MakeHuman model if available!
      if (this.lifeAssetBaseUrl) {
        loader.loadAsync(new URL(cfg.model, this.lifeAssetBaseUrl).href).then((gltf) => {
          const m = gltf.scene;
          m.traverse((o) => {
            if (o.isMesh) {
              o.castShadow = true;
              o.receiveShadow = true;
              const mats = Array.isArray(o.material) ? o.material : [o.material];
              for (const mt of mats) {
                if (!mt) continue;
                if (typeof mt.roughness === 'number') mt.roughness = Math.max(0.62, mt.roughness);
                if (mt.color) mt.color.multiplyScalar(1.22);
              }
            }
          });
          // Normalize height cleanly to ~1.68m standing on y=0
          const box = new THREE.Box3().setFromObject(m);
          const h = box.max.y - box.min.y;
          if (h > 0.1) {
            const sc = (cfg.id === 'lin' || cfg.id === 'wang' ? 1.63 : 1.72) / h;
            m.scale.setScalar(sc);
            m.position.y = -box.min.y * sc;
          }
          // Grab key bones for smooth procedural walking
          const bones = {};
          m.traverse((o) => {
            if (!o.isBone) return;
            const n = o.name.toLowerCase();
            if (n.includes('upperleg') || n.includes('thigh')) bones[n.includes('l') || n.includes('left') ? 'thighL' : 'thighR'] = o;
            else if (n.includes('lowerleg') || n.includes('shin') || n.includes('calf')) bones[n.includes('l') || n.includes('left') ? 'shinL' : 'shinR'] = o;
            else if (n.includes('upperarm')) bones[n.includes('l') || n.includes('left') ? 'armL' : 'armR'] = o;
          });
          agent.body.visible = false;
          agent.holder.add(m);
          agent.skinned = m;
          agent.bones = bones;
        }).catch(() => {});
      }
    }
  }

  _createCampusCat() {
    // Stylized sculpted orange tabby campus cat (橘猫) roaming near Library, Terminalia & Canteen 1
    const g = new THREE.Group();
    g.name = 'haiz_campus_cat';
    const ginger = new THREE.MeshStandardMaterial({ color: '#d8762c', roughness: 0.72 });
    const cream = new THREE.MeshStandardMaterial({ color: '#f2dec0', roughness: 0.78 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.10, 0.24, 4, 8), ginger);
    body.rotation.x = Math.PI * 0.5;
    body.position.set(0, 0.19, 0);
    body.castShadow = true;
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), cream);
    belly.position.set(0, 0.15, 0.02);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), ginger);
    head.position.set(0, 0.27, 0.19);
    for (const sx of [-0.05, 0.05]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.055, 4), ginger);
      ear.position.set(sx, 0.35, 0.18);
      g.add(ear);
    }
    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.24, 4, 6), ginger);
    tail.position.set(0, 0.25, -0.22);
    tail.rotation.x = -0.65;
    g.add(body, belly, head, tail);

    // Patrol waypoints between Terminalia, Library steps, Block 1 colonnade & Canteen lane
    const spots = [
      { x: 42.0, z: -18.5, sheltered: false },
      { x: 35.0, z: -2.0, sheltered: true },   // under Block 1 east colonnade!
      { x: 64.0, z: -10.0, sheltered: false },
      { x: 68.0, z: 22.0, sheltered: false },
      { x: 52.0, z: 106.0, sheltered: false }, // near Yanchi!
    ];
    g.position.set(spots[0].x, this.spatial.heightAtThree(spots[0].x, spots[0].z), spots[0].z);
    this.root.add(g);
    return { mesh: g, tail, spots, idx: 0, t: 0, state: 'stroll', x: spots[0].x, z: spots[0].z };
  }

  _createButterflies() {
    const count = 18;
    const grp = new THREE.Group();
    grp.name = 'haiz_butterflies';
    const colors = ['#f4c644', '#e86838', '#f5f2e6', '#56b4d8'];
    const list = [];
    for (let i = 0; i < count; i++) {
      const bf = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.45, side: THREE.DoubleSide });
      const wL = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.065), mat);
      wL.position.x = -0.045;
      const wR = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.065), mat);
      wR.position.x = 0.045;
      bf.add(wL, wR);
      // Anchor around Centenary Terminalia, Yanchi, and Fengqitang flower beds
      const anchor = i < 7 ? [39, -18] : i < 13 ? [46, 114] : [-40, -58];
      grp.add(bf);
      list.push({ bf, wL, wR, anchor, r: 3.0 + (i % 5) * 1.8, ph: i * 1.13, speed: 0.55 + (i % 4) * 0.14 });
    }
    this.root.add(grp);
    return { grp, list };
  }

  _createSwifts() {
    // High gliding Haikou swifts circling gracefully over Teaching Block 1 & Terminalia
    const count = 10;
    const grp = new THREE.Group();
    grp.name = 'haiz_swifts';
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
    grp.name = 'haiz_yanchi_koi';
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

  onPlayerBell(playerPos) {
    for (const a of this.citizens) {
      const d = Math.hypot(a.x - playerPos.x, a.z - playerPos.z);
      if (d < 16) {
        const line = a.cfg.lines.bell[0];
        this.onSpeak(a.cfg.name, a.cfg.role, line);
        // Turn gently toward rider
        a.yaw = Math.atan2(playerPos.x - a.x, playerPos.z - a.z);
        return;
      }
    }
  }

  update(dt, runtime, playerPos) {
    const t = runtime.simTime;
    const isRain = this.atmosphere.uniforms.uRain.value > 0.35;
    const isNight = runtime.hour < 6.0 || runtime.hour > 22.8;

    // 1. Update Campus Citizens
    for (const a of this.citizens) {
      // Raise umbrella in rain unless safely sheltered under colonnade/pavilion
      const sheltered = this.spatial.isShelteredThree(a.x, a.z);
      a.umbrella.visible = isRain && !sheltered;

      if (isRain && !a.sheltering) {
        a.sheltering = true;
        const sh = this.spatial.places[a.cfg.shelter];
        a.path = this.spatial.findPathThree(a.x, a.z, sh.x, -sh.y);
        a.pathIdx = 0;
        a.waitTimer = 0;
      } else if (!isRain && a.sheltering) {
        a.sheltering = false;
        a.path = [];
      }

      let moving = false;
      if (a.waitTimer > 0) {
        a.waitTimer -= dt;
      } else {
        if (!a.path.length || a.pathIdx >= a.path.length) {
          if (a.sheltering) {
            a.waitTimer = 5.0;
          } else {
            a.routeIdx = (a.routeIdx + 1) % a.cfg.route.length;
            const dest = this.spatial.places[a.cfg.route[a.routeIdx]];
            a.path = this.spatial.findPathThree(a.x, a.z, dest.x, -dest.y);
            a.pathIdx = 1;
          }
        }
        if (a.pathIdx < a.path.length) {
          const tgt = a.path[a.pathIdx];
          const dx = tgt.x - a.x;
          const dz = tgt.z - a.z;
          const dist = Math.hypot(dx, dz);
          const spd = a.cfg.speed * (isRain ? 1.35 : 1.0);
          if (dist < 0.45) {
            a.pathIdx++;
            if (a.pathIdx >= a.path.length) a.waitTimer = 3.5 + (a.phase % 4);
          } else {
            const step = Math.min(dist, spd * dt);
            a.x += (dx / dist) * step;
            a.z += (dz / dist) * step;
            const targetYaw = Math.atan2(dx, dz);
            let diff = targetYaw - a.yaw;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            a.yaw += diff * Math.min(1, dt * 7);
            moving = true;
          }
        }
      }

      const gy = this.spatial.heightAtThree(a.x, a.z);
      a.holder.position.set(a.x, gy, a.z);
      a.holder.rotation.y = a.yaw;

      // Animate walk cycle (both stylized fallback and 51-bone MakeHuman skeleton!)
      if (moving) a.phase += dt * 7.2 * (isRain ? 1.25 : 1.0);
      const sw = moving ? Math.sin(a.phase) * 0.46 : 0;
      if (a.body.visible && a.body.userData.parts) {
        const p = a.body.userData.parts;
        p.legL.rotation.x = sw;
        p.legR.rotation.x = -sw;
        p.armL.rotation.x = -sw * 0.7;
        p.armR.rotation.x = a.umbrella.visible ? -0.85 : sw * 0.7;
        p.torso.position.y = 1.02 + Math.abs(sw) * 0.04;
      } else if (a.bones) {
        if (a.bones.thighL) a.bones.thighL.rotation.x = sw * 0.85;
        if (a.bones.thighR) a.bones.thighR.rotation.x = -sw * 0.85;
        if (a.bones.armL) a.bones.armL.rotation.x = -sw * 0.55;
        if (a.bones.armR) a.bones.armR.rotation.x = a.umbrella.visible ? -0.9 : sw * 0.55;
      }

      // Friendly contextual greeting when player walks close
      if (playerPos && t - this._lastSpeakTime > 12) {
        const dPlayer = Math.hypot(a.x - playerPos.x, a.z - playerPos.z);
        if (dPlayer < 4.8) {
          this._lastSpeakTime = t;
          const pool = isRain ? a.cfg.lines.rain : a.cfg.lines.clear;
          this.onSpeak(a.cfg.name, a.cfg.role, pool[Math.floor(t) % pool.length]);
        }
      }
    }

    // 2. Campus Orange Cat (seeks shelter under Block 1 colonnade in rain!)
    const cat = this.cat;
    const catGoal = isRain ? cat.spots[1] : cat.spots[cat.idx];
    const cdx = catGoal.x - cat.x, cdz = catGoal.z - cat.z;
    const cdist = Math.hypot(cdx, cdz);
    if (cdist > 0.35) {
      const step = Math.min(cdist, 0.95 * dt);
      cat.x += (cdx / cdist) * step;
      cat.z += (cdz / cdist) * step;
      cat.mesh.rotation.y = Math.atan2(cdx, cdz);
      cat.tail.rotation.z = Math.sin(t * 5.0) * 0.25;
    } else if (!isRain) {
      cat.t += dt;
      if (cat.t > 7.5) { cat.t = 0; cat.idx = (cat.idx + 1) % cat.spots.length; }
      cat.tail.rotation.z = Math.sin(t * 2.2) * 0.14;
    }
    cat.mesh.position.set(cat.x, this.spatial.heightAtThree(cat.x, cat.z), cat.z);

    // 3. Butterflies (active in dry sunlit daytime; hide under foliage during rain/night!)
    this.butterflies.grp.visible = !isRain && !isNight;
    if (this.butterflies.grp.visible) {
      for (const b of this.butterflies.list) {
        const a = t * b.speed + b.ph;
        const x = b.anchor[0] + Math.cos(a) * b.r + Math.sin(a * 2.3) * 1.1;
        const z = b.anchor[1] + Math.sin(a * 0.9) * b.r;
        const gy = this.spatial.heightAtThree(x, z);
        b.bf.position.set(x, gy + 1.15 + Math.sin(a * 3.1) * 0.45, z);
        b.bf.rotation.y = -a;
        const flap = Math.sin(t * 18.0 + b.ph) * 0.85;
        b.wL.rotation.y = flap;
        b.wR.rotation.y = -flap;
      }
    }

    // 4. Courtyard Swifts gliding high above campus
    this.swifts.grp.visible = !isNight;
    if (this.swifts.grp.visible) {
      for (const s of this.swifts.list) {
        const a = t * s.speed + s.ph;
        const x = 10 + Math.cos(a) * s.radius;
        const z = -16 + Math.sin(a) * s.radius * 0.78;
        s.bird.position.set(x, s.alt + Math.sin(a * 2.0) * 1.8, z);
        s.bird.rotation.y = -a;
        const fl = Math.sin(t * 7.5 + s.ph) * 0.35;
        s.wingL.rotation.z = fl;
        s.wingR.rotation.z = -fl;
      }
    }

    // 5. Yanchi Pond Koi silhouettes swimming beneath the reflective surface
    for (const k of this.koi.list) {
      const a = t * k.spd + k.ph;
      const x = k.cx + Math.cos(a) * k.r;
      const z = k.cz + Math.sin(a * 1.2) * (k.r * 0.75);
      k.mesh.position.set(x, -0.39, z);
      k.mesh.rotation.y = -a;
    }
  }

  getCitizenMapPoints() {
    const out = this.citizens.map((a) => ({ id: a.cfg.id, name: a.cfg.name, x: a.x, z: a.z, kind: 'npc' }));
    out.push({ id: 'cat', name: '校园橘猫', x: this.cat.x, z: this.cat.z, kind: 'cat' });
    return out;
  }
}
