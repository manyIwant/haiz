// HAIZ Campus Toybox — Standalone Character Art Gallery 3D Turntable Scene.
// Renders any registered character on a teak-and-terrazzo exhibition plinth with OrbitControls,
// switchable lighting environments (Afternoon Sun, Qilou Lantern, Tide Mist, Silhouette Check),
// theme variant switching, and full animation clip playback.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createToy } from '../toys/registry.js';
import { terrazzoColor, woodColor, contactShadow } from '../toys/kit/textures.js';
import { brass, lacquer } from '../toys/kit/materials.js';

export const ENVIRONMENTS = {
  afternoon: {
    label: '海南午后阳光',
    keyColor: '#fff1d4', keyInt: 2.1, keyPos: [0.8, 1.4, 1.0],
    fillColor: '#cde8e4', fillInt: 0.7,
    hemiSky: '#fff7e6', hemiGround: '#c4a682', hemiInt: 0.9,
    envInt: 0.6, exposure: 1.08, silhouette: false,
  },
  lantern: {
    label: '骑楼暖灯',
    keyColor: '#ffc675', keyInt: 2.3, keyPos: [-0.6, 1.1, 0.9],
    fillColor: '#5c7c89', fillInt: 0.55,
    hemiSky: '#ffe1b5', hemiGround: '#3d2a1d', hemiInt: 0.5,
    envInt: 0.35, exposure: 0.98, silhouette: false,
  },
  tide: {
    label: '海口晚潮',
    keyColor: '#e6f6ff', keyInt: 1.85, keyPos: [0.9, 1.2, 0.8],
    fillColor: '#f6c3a4', fillInt: 0.85,
    hemiSky: '#d9f2f2', hemiGround: '#6e8c91', hemiInt: 0.85,
    envInt: 0.72, exposure: 1.05, silhouette: false,
  },
  silhouette: {
    label: '剪影轮廓检视',
    keyColor: '#ffffff', keyInt: 0, keyPos: [0, 1, 1],
    fillColor: '#ffffff', fillInt: 0,
    hemiSky: '#ffffff', hemiGround: '#ffffff', hemiInt: 0,
    envInt: 0, exposure: 1.0, silhouette: true,
  },
};

export class GalleryScene {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this._envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this._envRT.texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.02, 10);
    this.camera.position.set(0.12, 0.17, 0.44);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.target.set(0, 0.085, 0);
    this.controls.minDistance = 0.22;
    this.controls.maxDistance = 0.82;
    this.controls.maxPolarAngle = Math.PI * 0.54;

    // Lights
    this.hemi = new THREE.HemisphereLight('#fff7e6', '#c4a682', 0.9);
    this.scene.add(this.hemi);
    this.keyLight = new THREE.DirectionalLight('#fff1d4', 2.1);
    this.keyLight.position.set(0.8, 1.4, 1.0);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 0.1;
    this.keyLight.shadow.camera.far = 4;
    this.keyLight.shadow.camera.left = -0.3;
    this.keyLight.shadow.camera.right = 0.3;
    this.keyLight.shadow.camera.top = 0.3;
    this.keyLight.shadow.camera.bottom = -0.3;
    this.keyLight.shadow.bias = -0.0004;
    this.scene.add(this.keyLight);
    this.fillLight = new THREE.DirectionalLight('#cde8e4', 0.7);
    this.fillLight.position.set(-0.9, 0.6, -0.8);
    this.scene.add(this.fillLight);

    // Museum plinth: teak base + brass ring + terrazzo top disc
    this.plinth = new THREE.Group();
    const topDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.115, 0.118, 0.012, 48),
      new THREE.MeshStandardMaterial({ map: terrazzoColor(), roughness: 0.55 })
    );
    topDisc.position.y = -0.006;
    topDisc.receiveShadow = true;
    this.plinth.add(topDisc);

    const brassBand = new THREE.Mesh(new THREE.TorusGeometry(0.117, 0.003, 12, 48), brass({ roughness: 0.26 }));
    brassBand.rotation.x = Math.PI / 2;
    brassBand.position.y = -0.011;
    this.plinth.add(brassBand);

    const woodBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.118, 0.132, 0.036, 48),
      lacquer('#ffffff', { map: woodColor('#6c432a', 15), roughness: 0.45 })
    );
    woodBase.position.y = -0.03;
    woodBase.receiveShadow = true;
    this.plinth.add(woodBase);

    const sh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.16, 0.16),
      new THREE.MeshBasicMaterial({ map: contactShadow(), transparent: true, opacity: 0.48, depthWrite: false })
    );
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.001;
    this.plinth.add(sh);
    this.scene.add(this.plinth);

    this.silhouetteMat = new THREE.MeshBasicMaterial({ color: '#1c1814' });
    this._origMats = new Map();
    this.currentToy = null;
    this.currentEnv = 'afternoon';
    this.autoRotate = false;

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this._onVis = () => (document.hidden ? this.pause() : this.resume());
    document.addEventListener('visibilitychange', this._onVis);

    this.resize();
    this._paused = false;
    this._last = performance.now();
    this._tick = this._tick.bind(this);
    this._raf = requestAnimationFrame(this._tick);
  }

  resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  loadCharacter(id, variant = 'classic') {
    if (this.currentToy) {
      this._restoreSilhouette();
      this.scene.remove(this.currentToy.root);
      this.currentToy.dispose();
      this.currentToy = null;
    }
    this.currentToy = createToy(id, { variant });
    this.scene.add(this.currentToy.root);
    this.controls.target.set(0, this.currentToy.rig.height * 0.5, 0);
    if (this.currentEnv === 'silhouette') this._applySilhouette();
    return this.currentToy.entry;
  }

  playClip(clip) {
    this.currentToy?.behavior.play(clip);
  }

  setEnvironment(key) {
    const env = ENVIRONMENTS[key] || ENVIRONMENTS.afternoon;
    this.currentEnv = key;
    this.keyLight.color.set(env.keyColor);
    this.keyLight.intensity = env.keyInt;
    this.keyLight.position.set(...env.keyPos);
    this.fillLight.color.set(env.fillColor);
    this.fillLight.intensity = env.fillInt;
    this.hemi.color.set(env.hemiSky);
    this.hemi.groundColor.set(env.hemiGround);
    this.hemi.intensity = env.hemiInt;
    this.scene.environmentIntensity = env.envInt;
    this.renderer.toneMappingExposure = env.exposure;
    this.plinth.visible = !env.silhouette;
    if (env.silhouette) this._applySilhouette();
    else this._restoreSilhouette();
  }

  _applySilhouette() {
    if (!this.currentToy) return;
    this._origMats.clear();
    this.currentToy.root.traverse((o) => {
      if (o.isMesh) {
        this._origMats.set(o, o.material);
        o.material = this.silhouetteMat;
      }
    });
  }

  _restoreSilhouette() {
    for (const [mesh, mat] of this._origMats.entries()) {
      mesh.material = mat;
    }
    this._origMats.clear();
  }

  _tick(now) {
    if (this._paused) return;
    this._raf = requestAnimationFrame(this._tick);
    const dt = Math.min((now - this._last) / 1000, 0.05);
    this._last = now;
    this.controls.autoRotate = this.autoRotate;
    this.controls.autoRotateSpeed = 1.6;
    this.controls.update();
    this.currentToy?.behavior.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  pause() { this._paused = true; cancelAnimationFrame(this._raf); }
  resume() {
    if (!this._paused) return;
    this._paused = false;
    this._last = performance.now();
    this._raf = requestAnimationFrame(this._tick);
  }

  dispose() {
    this.pause();
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('visibilitychange', this._onVis);
    this.currentToy?.dispose();
    this.silhouetteMat.dispose();
    this._envRT?.dispose();
    this.controls.dispose();
    this.renderer.dispose();
  }
}
