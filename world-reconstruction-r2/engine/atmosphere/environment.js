/**
 * HAIZ · World Reconstruction — Unified Tropical Haikou Atmosphere, Sky, Weather & Multi-Lens System.
 *
 * One atmospheric truth drives the entire campus:
 *   1. True 20.0 deg N Haikou solar & lunar ephemeris mapped into HAIZ-ENU-2026.
 *   2. Procedural Rayleigh + Mie tropical sky dome with drifting trade-wind cumulus clouds & stars.
 *   3. Shared GLSL shader uniform hub injected cleanly into every PBR material (`enhanceMaterial`):
 *        - Synchronized trade-wind gusts swaying palms, Terminalia, banyans & shrubs
 *        - Wetness darkening, specular sheen & falling-rain puddle ripples on stone/asphalt
 *        - Automatic evening self-study classroom illumination & warm 3-globe campus lamps
 *        - Three unified artistic lenses on the EXACT SAME THREE.Scene (0 reload):
 *            0: 南海晴光 (Sunlit Tropical Architectural Realism)
 *            1: 入画水粉 (Painterly Gouache — cobalt-lavender shadows & warm sunlit bounce)
 *            2: 建筑剖面 (1.2m Architectural Plan Cutaway & Drafting Blueprint)
 *   4. 3D Falling Tropical Rain + Drifting Autumn Terminalia Leaves.
 */
import * as THREE from 'three';
import { FRAME, skyBearingToThreeDir } from '../core/coord.js';

const DEG = Math.PI / 180;

/** Approximate Haikou (20.0°N, 110.34°E) solar position for any local wall-clock hour (0..24) */
export function haikouSunAtHour(hour, dayOfYear = 305) {
  const lat = FRAME.originLat * DEG;
  const decl = -23.44 * DEG * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10));
  // Solar noon in Haikou (~110.34°E vs 120°E UTC+8 meridian) is ~12:38 local time
  const solarNoon = 12.64;
  const ha = (hour - solarNoon) * 15 * DEG;
  const sinAlt = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const cosAz = (Math.sin(decl) - Math.sin(alt) * Math.sin(lat)) / (Math.cos(alt) * Math.cos(lat) + 1e-6);
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz)));
  if (ha > 0) az = 2 * Math.PI - az; // afternoon -> west
  const bearingDeg = (az / DEG + 360) % 360;
  const dir = skyBearingToThreeDir(alt, bearingDeg);
  return { altDeg: alt / DEG, bearingDeg, dir: new THREE.Vector3(dir[0], dir[1], dir[2]).normalize() };
}

export class CampusAtmosphere {
  constructor(scene, renderer, { shadowSize = 2048 } = {}) {
    this.scene = scene;
    this.renderer = renderer;

    // Shared reactive uniforms referenced by Sky, Water, Flora, Buildings, Rain & Leaves
    this.uniforms = {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.5, 0.45, 0.7).normalize() },
      uSunColor: { value: new THREE.Color('#ffdfb3') },
      uSkyZenith: { value: new THREE.Color('#1d5ca8') },
      uSkyHorizon: { value: new THREE.Color('#c8dff0') },
      uCloudCover: { value: 0.38 },
      uWetness: { value: 0.0 },
      uRain: { value: 0.0 },
      uNight: { value: 0.0 },
      uLamps: { value: 0.0 },
      uWindDir: { value: new THREE.Vector2(0.76, 0.65) },
      uWindStrength: { value: 1.0 },
      uLensMode: { value: 0.0 },     // 0 = Sunlit PBR, 1 = Gouache, 2 = Plan Cutaway
      uCutHeight: { value: 999.0 },  // 999 normal, ~2.2 in Plan Cutaway mode
    };

    // Weather targets (smoothly eased each frame)
    this._targets = { cloud: 0.38, wet: 0.0, rain: 0.0, wind: 1.0 };
    this._enhancedMats = new Set();

    // Fog synced with tropical coastal horizon
    this.fog = new THREE.FogExp2('#c8dff0', 0.0014);
    scene.fog = this.fog;

    // Primary Haikou Sun Directional Light + Soft Tropical Hemisphere Fill
    this.sunLight = new THREE.DirectionalLight('#ffecd1', 2.8);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(shadowSize, shadowSize);
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 420;
    const d = 115;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.00045;
    this.sunLight.shadow.normalBias = 0.04;
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    this.hemiLight = new THREE.HemisphereLight('#8cbce8', '#8d7a60', 0.88);
    scene.add(this.hemiLight);

    // Subtle secondary bounce light from sunlit tropical paving
    this.bounceLight = new THREE.DirectionalLight('#ffd9a8', 0.35);
    this.bounceLight.position.set(-40, 22, 60);
    scene.add(this.bounceLight);

    // Procedural Tropical Sky Dome
    this.skyMesh = this._createSkyDome();
    scene.add(this.skyMesh);

    // 3D Tropical Rain Streaks & Autumn Terminalia Falling Leaves
    this.rainSystem = this._createRainSystem();
    scene.add(this.rainSystem);

    this.leafSystem = this._createFallingLeaves();
    scene.add(this.leafSystem);

    // Evening warm point lights along North Gate & Forecourt
    this.eveningLights = this._createEveningLamps();
    scene.add(this.eveningLights);
  }

  _createSkyDome() {
    const geo = new THREE.SphereGeometry(1400, 32, 20);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform vec3 uSkyZenith;
        uniform vec3 uSkyHorizon;
        uniform float uCloudCover;
        uniform float uNight;
        uniform float uLensMode;

        float hash(vec2 p) {
          p = fract(p * vec2(127.1, 311.7));
          p += dot(p, p + 34.5);
          return fract(p.x * p.y);
        }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }
        float fbm(vec2 p) {
          float s = 0.0, a = 0.5;
          for (int i = 0; i < 4; i++) {
            s += a * noise(p);
            p = p * 2.04 + vec2(13.7, 9.2);
            a *= 0.5;
          }
          return s;
        }

        void main() {
          vec3 d = normalize(vDir);
          float y = max(d.y, 0.0);
          float grad = pow(y, 0.48);
          vec3 sky = mix(uSkyHorizon, uSkyZenith, grad);

          // Plan Cutaway Lens -> calm warm archival paper backdrop
          if (uLensMode > 1.5) {
            vec3 paper = mix(vec3(0.95, 0.93, 0.89), vec3(0.87, 0.90, 0.89), grad);
            gl_FragColor = vec4(paper, 1.0);
            return;
          }

          // Tropical Mie solar halo & crisp sun disc
          float sunDot = max(dot(d, normalize(uSunDir)), 0.0);
          float horizonBoost = 1.0 - smoothstep(0.0, 0.55, y);
          sky += uSunColor * pow(sunDot, 7.0) * (0.38 + 0.35 * horizonBoost) * (1.0 - uNight * 0.85);
          sky += uSunColor * smoothstep(0.9985, 0.9997, sunDot) * 2.2 * (1.0 - uNight);

          // Layered Haikou trade-wind cumulus clouds
          if (d.y > 0.02) {
            vec2 uv = d.xz / (d.y + 0.16) * 0.65 + vec2(uTime * 0.008, uTime * 0.005);
            float n = fbm(uv * 2.2);
            float n2 = fbm(uv * 4.5 - vec2(uTime * 0.004, 0.0));
            float cov = smoothstep(0.68 - uCloudCover * 0.44, 0.88 - uCloudCover * 0.28, n * 0.72 + n2 * 0.28);
            float lit = smoothstep(-0.2, 0.85, dot(normalize(vec3(d.x, d.y + 0.3, d.z)), normalize(uSunDir)));
            vec3 cloudLit = mix(vec3(0.96, 0.96, 0.97), uSunColor * 1.15, 0.45) * (1.0 - uNight * 0.84);
            vec3 cloudShd = mix(uSkyHorizon * 0.78, vec3(0.32, 0.42, 0.58), 0.38) * (1.0 - uNight * 0.78);
            vec3 cloudCol = mix(cloudShd, cloudLit, 0.35 + 0.65 * lit);
            float horizonFade = smoothstep(0.02, 0.18, d.y);
            sky = mix(sky, cloudCol, cov * horizonFade * 0.88);
          }

          // Crisp pinpoint starry tropical night sky
          if (uNight > 0.25 && d.y > 0.08) {
            vec2 sp = d.xz / (d.y + 0.25) * 165.0;
            vec2 starCell = floor(sp);
            vec2 starFrac = fract(sp) - 0.5;
            float st = hash(starCell);
            if (st > 0.992) {
              vec2 jitter = vec2(hash(starCell + 17.3) - 0.5, hash(starCell + 51.7) - 0.5) * 0.6;
              float dist = length(starFrac - jitter);
              float pin = smoothstep(0.16, 0.03, dist);
              float tw = 0.65 + 0.35 * sin(uTime * 2.2 + st * 90.0);
              sky += vec3(0.88, 0.94, 1.0) * smoothstep(0.25, 0.85, uNight) * pin * tw * 0.95;
            }
          }

          // Gouache lens subtle warm glaze
          if (uLensMode > 0.5 && uLensMode < 1.5) {
            sky = mix(sky, sky * vec3(1.03, 1.01, 0.96) + vec3(0.02, 0.01, 0.0), 0.35);
          }

          gl_FragColor = vec4(sky, 1.0);
        }
      `,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'haiz_sky_dome';
    mesh.frustumCulled = false;
    return mesh;
  }

  _createRainSystem() {
    const count = 1400;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 90;
      positions[i * 3 + 1] = Math.random() * 28;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 90;
      seeds[i * 3] = Math.random();
      seeds[i * 3 + 1] = 0.7 + Math.random() * 0.6;
      seeds[i * 3 + 2] = Math.random() * 6.28;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        ...this.uniforms,
        uCenter: { value: new THREE.Vector3() },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aSeed;
        uniform float uTime;
        uniform float uRain;
        uniform vec2 uWindDir;
        uniform vec3 uCenter;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          float speed = 17.0 * aSeed.y;
          p.y = mod(p.y - uTime * speed, 28.0);
          p.x += uWindDir.x * (28.0 - p.y) * 0.14;
          p.z += uWindDir.y * (28.0 - p.y) * 0.14;
          p.x = mod(p.x - uCenter.x + 45.0, 90.0) - 45.0 + uCenter.x;
          p.z = mod(p.z - uCenter.z + 45.0, 90.0) - 45.0 + uCenter.z;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(26.0 / max(-mv.z, 1.0), 1.5, 5.0) * step(0.02, uRain);
          vAlpha = uRain * 0.55 * smoothstep(0.0, 2.0, p.y);
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float streak = smoothstep(0.18, 0.02, abs(c.x)) * smoothstep(0.5, 0.1, abs(c.y));
          if (streak * vAlpha < 0.02) discard;
          gl_FragColor = vec4(0.84, 0.90, 0.96, streak * vAlpha);
        }
      `,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.visible = false;
    pts.name = 'haiz_tropical_rain';
    return pts;
  }

  _createFallingLeaves() {
    const count = 90;
    const geo = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(0.24, 0.15);
    geo.index = base.index;
    geo.setAttribute('position', base.getAttribute('position'));
    geo.setAttribute('uv', base.getAttribute('uv'));
    const seeds = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      seeds[i * 4] = Math.random();
      seeds[i * 4 + 1] = Math.random();
      seeds[i * 4 + 2] = Math.random();
      seeds[i * 4 + 3] = Math.random();
    }
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    geo.instanceCount = count;

    const mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        attribute vec4 aSeed;
        uniform float uTime;
        uniform vec2 uWindDir;
        uniform float uWindStrength;
        varying vec2 vUv;
        varying float vTone;
        void main() {
          vUv = uv;
          vTone = aSeed.w;
          float life = fract(uTime * (0.055 + aSeed.y * 0.03) + aSeed.x);
          // Centered around Centenary Terminalia (spec 38.9, 17.7 -> three 38.9, -17.7)
          float a = aSeed.z * 6.28318;
          float r = 1.5 + aSeed.w * 12.5;
          vec3 center = vec3(38.9 + cos(a) * r, 11.5 - life * 10.9, -17.7 + sin(a) * r);
          center.xz += uWindDir * life * (4.5 * uWindStrength);
          center.x += sin(uTime * 1.7 + aSeed.x * 20.0) * 0.55;
          center.z += cos(uTime * 1.4 + aSeed.y * 20.0) * 0.55;
          float spin = uTime * (2.2 + aSeed.y * 2.5) + aSeed.z * 12.0;
          vec3 v = position;
          v.xy = mat2(cos(spin), -sin(spin), sin(spin), cos(spin)) * v.xy;
          v.yz = mat2(cos(spin * 0.7), -sin(spin * 0.7), sin(spin * 0.7), cos(spin * 0.7)) * v.yz;
          float s = smoothstep(0.0, 0.08, life) * smoothstep(1.0, 0.92, life);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(center + v * s, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        varying float vTone;
        uniform float uNight;
        void main() {
          vec2 d = (vUv - 0.5) * vec2(2.0, 2.2);
          if (dot(d, d) > 1.0) discard;
          vec3 green = vec3(0.32, 0.54, 0.20);
          vec3 gold = vec3(0.76, 0.48, 0.16);
          vec3 crimson = vec3(0.68, 0.20, 0.11);
          vec3 col = vTone < 0.45 ? green : (vTone < 0.78 ? gold : crimson);
          col *= (1.0 - uNight * 0.75);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.name = 'haiz_terminalia_falling_leaves';
    return mesh;
  }

  _createEveningLamps() {
    const grp = new THREE.Group();
    grp.name = 'haiz_evening_lights';
    const spots = [
      [0, 5.2, -106],    // North Gate
      [0, 5.5, -36],     // Forecourt Plaza
      [38.9, 5.0, -18],  // Centenary Terminalia
      [48.0, 4.5, 114],  // Yanchi
    ];
    this._lampLights = spots.map(([x, y, z]) => {
      const l = new THREE.PointLight('#ffbe6e', 0, 42, 1.4);
      l.position.set(x, y, z);
      grp.add(l);
      return l;
    });
    return grp;
  }

  /**
   * Patch any loaded campus PBR material with our Unified Tropical Atmosphere Shader Hook:
   *   - Trade-wind sway on foliage/palms
   *   - Rain wetness, specular reflections & puddle ripples on ground/roads/plazas
   *   - Evening self-study classroom illumination on glass
   *   - Multi-lens switching (Sunlit PBR / Painted Gouache / 1.2m Architectural Plan Cutaway)
   */
  enhanceMaterial(mat) {
    if (!mat || !mat.isMeshStandardMaterial || this._enhancedMats.has(mat)) return;
    this._enhancedMats.add(mat);
    const name = mat.name || '';
    const isFoliage = /foliage|flower|hedge/i.test(name);
    const isGlass = /glass/i.test(name);
    const isWater = /water_yanchi/i.test(name);
    const isLawn = /lawn/i.test(name);
    const isGround = /paving|ground|track|court/i.test(name) && !isLawn;
    const isLamp = /lamp_globe/i.test(name);
    const isCuttable = !isGround && !isWater && !isLawn;

    mat.customProgramCacheKey = () => `haiz-wr-${isFoliage ? 'f' : ''}${isGlass ? 'g' : ''}${isWater ? 'w' : ''}${isGround ? 'p' : ''}${isLawn ? 'n' : ''}${isLamp ? 'l' : ''}`;

    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float uTime;
          uniform vec2 uWindDir;
          uniform float uWindStrength;
          varying vec3 vWorldPos;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vec4 haizWpTmp = modelMatrix * vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            haizWpTmp = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
          #endif
          ${
            isFoliage
              ? `{
                float gust = sin(dot(haizWpTmp.xz, uWindDir) * 0.08 - uTime * 1.45) * 0.5 + 0.5;
                float swayAmt = clamp((haizWpTmp.y - 1.2) * 0.045, 0.0, 0.36) * uWindStrength * (0.45 + 0.85 * gust);
                float ph = dot(haizWpTmp.xz, vec2(0.41, 0.27)) + position.y * 0.7;
                transformed.x += (uWindDir.x * sin(uTime * 1.9 + ph) + 0.3 * cos(uTime * 3.1 + ph)) * swayAmt;
                transformed.z += (uWindDir.y * sin(uTime * 1.9 + ph) + 0.3 * sin(uTime * 2.8 + ph)) * swayAmt;
              }`
              : isWater
              ? `{
                transformed.y += (sin(haizWpTmp.x * 1.8 + uTime * 2.2) + cos(haizWpTmp.z * 2.1 - uTime * 1.8)) * 0.015;
              }`
              : ''
          }`
        )
        .replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
          vec4 haizWp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            haizWp = instanceMatrix * haizWp;
          #endif
          haizWp = modelMatrix * haizWp;
          vWorldPos = haizWp.xyz;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float uTime;
          uniform float uWetness;
          uniform float uRain;
          uniform float uLamps;
          uniform float uNight;
          uniform float uLensMode;
          uniform float uCutHeight;
          uniform vec3 uSkyHorizon;
          uniform vec3 uSunColor;
          varying vec3 vWorldPos;
          float hHash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
          float hNoise(vec2 p){
            vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
            return mix(mix(hHash(i), hHash(i+vec2(1,0)), f.x), mix(hHash(i+vec2(0,1)), hHash(i+vec2(1,1)), f.x), f.y);
          }`
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          ${isCuttable ? 'if (vWorldPos.y > uCutHeight) discard;' : ''}
          // Subtle base contact grounding & warm paving bounce across campus walls
          float hBase = smoothstep(0.0, 1.4, vWorldPos.y);
          diffuseColor.rgb *= mix(0.92, 1.0, hBase);
          ${
            isGround
              ? `{
                float n1 = hNoise(vWorldPos.xz * 0.11);
                float n2 = hNoise(vWorldPos.xz * 0.27 + vec2(7.3, 4.1));
                float pud = smoothstep(0.54 - uWetness * 0.22, 0.70 - uWetness * 0.20, n1 * 0.65 + n2 * 0.35);
                diffuseColor.rgb *= mix(1.0, 0.68, uWetness * (0.42 + 0.58 * pud));
                if (uRain > 0.05 && pud > 0.25) {
                  // Organic sparkling raindrop micro-glints on wet stone puddles (no bullseye grid!)
                  float sp1 = hNoise(vWorldPos.xz * 3.8 + vec2(uTime * 1.9, -uTime * 1.3));
                  float sp2 = hNoise(vWorldPos.xz * 6.4 - vec2(uTime * 2.4, uTime * 1.6));
                  float glint = smoothstep(0.76, 0.96, sp1 * sp2 * 1.55);
                  diffuseColor.rgb = mix(diffuseColor.rgb, uSkyHorizon * 0.68, 0.22 * uWetness * pud);
                  diffuseColor.rgb += uSkyHorizon * glint * 0.22 * uRain * pud;
                }
              }`
              : isLawn
              ? `{
                // Rich rain-dampened tropical grass without artificial rings
                diffuseColor.rgb *= mix(1.0, 0.78, uWetness * 0.65);
              }`
              : isWater
              ? `{
                // Authentic deep emerald-ink Yanchi pond with subtle organic depth variation
                float w1 = hNoise(vWorldPos.xz * 0.42 + vec2(uTime * 0.25, -uTime * 0.18));
                float w2 = hNoise(vWorldPos.xz * 0.95 - vec2(uTime * 0.35, uTime * 0.28));
                float wave = w1 * 0.6 + w2 * 0.4;
                vec3 deepInk = vec3(0.05, 0.19, 0.16);
                vec3 shallowJade = vec3(0.11, 0.31, 0.25);
                diffuseColor.rgb = mix(deepInk, shallowJade, wave);
                diffuseColor.rgb = mix(diffuseColor.rgb, uSkyHorizon * 0.75, 0.24 + 0.16 * wave);
              }`
              : `{
                diffuseColor.rgb *= mix(1.0, 0.84, uWetness * 0.45);
              }`
          }
          // Lens 1 (入画水粉): unmistakable vibrant tropical gouache painting aesthetic
          if (uLensMode > 0.5 && uLensMode < 1.5) {
            float luma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
            // Subtle stepped gouache pigment clusters & paper grain
            float paper = hNoise(vWorldPos.xz * 2.2 + vWorldPos.y * 1.7) * 0.055 - 0.025;
            vec3 satCol = mix(vec3(luma), diffuseColor.rgb, 1.38);
            float qLuma = (floor(luma * 6.0 + 0.35) / 6.0);
            vec3 gouache = satCol * mix(0.88, 1.12, smoothstep(0.0, 1.0, qLuma));
            // Warm sunlit cream paper glaze in lights, luminous teal-cobalt tint in darks
            vec3 shadowTint = vec3(0.18, 0.28, 0.46);
            vec3 highlightGlaze = vec3(1.08, 1.03, 0.93);
            gouache = mix(mix(gouache, shadowTint, 0.24), gouache * highlightGlaze, smoothstep(0.18, 0.65, luma));
            diffuseColor.rgb = clamp(gouache + paper, 0.0, 1.0);
          }
          // Lens 2 (建筑剖面 1.2m Plan): architectural cream-slate studio aesthetic
          if (uLensMode > 1.5) {
            float luma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
            vec3 paperCol = mix(vec3(0.24, 0.30, 0.29), vec3(0.92, 0.89, 0.83), smoothstep(0.12, 0.88, luma));
            diffuseColor.rgb = mix(diffuseColor.rgb, paperCol, 0.68);
          }`
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          ${
            isGround
              ? `{
                float n1r = hNoise(vWorldPos.xz * 0.11);
                float n2r = hNoise(vWorldPos.xz * 0.27 + vec2(7.3, 4.1));
                float pudR = smoothstep(0.54 - uWetness * 0.22, 0.70 - uWetness * 0.20, n1r * 0.65 + n2r * 0.35);
                roughnessFactor = mix(roughnessFactor, 0.10, uWetness * (0.38 + 0.62 * pudR));
              }`
              : isWater
              ? `roughnessFactor = 0.08;`
              : isLawn
              ? `roughnessFactor = mix(roughnessFactor, 0.72, uWetness * 0.5);`
              : 'roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.62, uWetness);'
          }
          if (uLensMode > 0.5 && uLensMode < 1.5) {
            roughnessFactor = mix(roughnessFactor, 0.86, 0.65);
          }`
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          ${
            isGlass
              ? `{
                if (uLamps > 0.01) {
                  vec2 roomId = floor(vec2((vWorldPos.x + vWorldPos.z) * 0.26, vWorldPos.y * 0.30));
                  float rnd = hHash(roomId);
                  float litRoom = step(0.30, rnd) * uLamps;
                  // Warm golden-amber study classroom glow mixed with soft warm-white tubes
                  vec3 tubeCol = rnd > 0.52 ? vec3(1.0, 0.78, 0.44) : vec3(0.98, 0.90, 0.72);
                  float intensityVar = 0.72 + 0.55 * hHash(roomId + 19.3);
                  totalEmissiveRadiance += tubeCol * litRoom * intensityVar * 1.15;
                }
              }`
              : isLamp
              ? `{
                totalEmissiveRadiance += vec3(1.0, 0.82, 0.48) * (0.28 + uLamps * 4.4);
              }`
              : isWater
              ? `{
                // Smooth domain-warped organic sun shimmer across Yanchi surface (zero polka-dot grid!)
                vec2 wp = vWorldPos.xz * 0.55;
                float warp = hNoise(wp + vec2(uTime * 0.35, -uTime * 0.25));
                float sw = hNoise(wp * 2.1 + vec2(warp * 2.4 + uTime * 0.55, -uTime * 0.42));
                float shimmer = smoothstep(0.66, 0.92, sw);
                totalEmissiveRadiance += uSunColor * shimmer * 0.28 * (1.0 - uNight * 0.68);
                totalEmissiveRadiance += vec3(0.10, 0.22, 0.20) * 0.14 * (1.0 - uNight * 0.5);
              }`
              : ''
          }
          // Lens 1 (入画水粉): luminous tropical cobalt-lavender ambient bounce in shadows
          if (uLensMode > 0.5 && uLensMode < 1.5) {
            totalEmissiveRadiance += mix(vec3(0.06, 0.08, 0.14), diffuseColor.rgb * 0.22, 0.55) * (1.0 - uNight * 0.65);
          }`
        );
    };
    mat.needsUpdate = true;
  }

  setWeather(weather) {
    if (weather === 'clear') this._targets = { cloud: 0.34, wet: 0.0, rain: 0.0, wind: 1.0 };
    else if (weather === 'cloudy') this._targets = { cloud: 0.74, wet: 0.15, rain: 0.0, wind: 1.35 };
    else if (weather === 'rain') this._targets = { cloud: 0.92, wet: 0.95, rain: 1.0, wind: 2.15 };
    else if (weather === 'after_rain') this._targets = { cloud: 0.46, wet: 0.82, rain: 0.0, wind: 0.85 };
  }

  setLens(lensIndex) {
    this.uniforms.uLensMode.value = lensIndex;
    this.uniforms.uCutHeight.value = lensIndex === 2 ? 2.4 : 999.0;
    if (lensIndex === 2) {
      this.fog.density = 0.0002;
    }
  }

  update(dt, runtime, focusPos = null) {
    this.uniforms.uTime.value += dt;
    const ease = 1.0 - Math.exp(-dt * 2.8);
    this.uniforms.uCloudCover.value += (this._targets.cloud - this.uniforms.uCloudCover.value) * ease;
    this.uniforms.uWetness.value += (this._targets.wet - this.uniforms.uWetness.value) * ease;
    this.uniforms.uRain.value += (this._targets.rain - this.uniforms.uRain.value) * ease;
    this.uniforms.uWindStrength.value += (this._targets.wind - this.uniforms.uWindStrength.value) * ease;

    // 1. Compute authentic 20°N Haikou sun & lighting palette from runtime.hour
    const sun = haikouSunAtHour(runtime.hour);
    const alt = sun.altDeg;
    const dayFactor = Math.max(0, Math.min(1, (alt + 5) / 18));
    const golden = Math.exp(-Math.pow((alt - 11) / 12, 2));
    const night = 1.0 - dayFactor;
    const cloud = this.uniforms.uCloudCover.value;
    const rain = this.uniforms.uRain.value;

    this.uniforms.uSunDir.value.copy(sun.dir);
    this.uniforms.uNight.value = night;
    // Evening study lamps illuminate naturally between 18:10 and 23:00 (or heavy rain dusk)
    const lampTarget = (runtime.hour >= 18.0 || runtime.hour < 6.3) ? Math.min(1.0, night * 1.2 + 0.35) : rain * 0.45;
    this.uniforms.uLamps.value += (lampTarget - this.uniforms.uLamps.value) * ease;

    // Colors: crisp tropical Hainan azure noon -> glowing golden amber -> readable marine cobalt night
    const sunCol = new THREE.Color('#fff8eb')
      .lerp(new THREE.Color('#ffbd73'), golden * 0.78)
      .lerp(new THREE.Color('#8cb0e6'), night)
      .lerp(new THREE.Color('#c2cdd8'), cloud * 0.50);

    const zenithCol = new THREE.Color('#1c6ec4')
      .lerp(new THREE.Color('#2d5996'), golden * 0.45)
      .lerp(new THREE.Color('#10203d'), night)
      .lerp(new THREE.Color('#647687'), cloud * 0.62);

    const horizonCol = new THREE.Color('#d2e8f7')
      .lerp(new THREE.Color('#f7cea0'), golden * 0.72)
      .lerp(new THREE.Color('#223859'), night)
      .lerp(new THREE.Color('#99a8b5'), cloud * 0.68);

    this.uniforms.uSunColor.value.copy(sunCol);
    this.uniforms.uSkyZenith.value.copy(zenithCol);
    this.uniforms.uSkyHorizon.value.copy(horizonCol);

    this.sunLight.color.copy(sunCol);
    const sunEnergy = (0.58 + dayFactor * 3.15) * (1.0 - cloud * 0.42) * (1.0 - rain * 0.22);
    this.sunLight.intensity = Math.max(0.45, sunEnergy);

    // Keep shadow frustum centered near camera/player focus so shadows stay razor sharp everywhere!
    const fx = focusPos ? focusPos.x : 0;
    const fz = focusPos ? focusPos.z : -25;
    const lightDir = sun.dir.y > 0.08 ? sun.dir : new THREE.Vector3(-0.35, 0.55, 0.75).normalize();
    this.sunLight.target.position.set(fx, 0, fz);
    this.sunLight.position.set(fx + lightDir.x * 160, Math.max(24, lightDir.y * 160), fz + lightDir.z * 160);

    this.hemiLight.color.copy(zenithCol).lerp(new THREE.Color('#d8ebfa'), 0.52);
    this.hemiLight.groundColor.set('#9e8b70').lerp(new THREE.Color('#2c3a50'), night);
    this.hemiLight.intensity = 0.54 + dayFactor * 0.76;
    this.bounceLight.intensity = 0.14 + dayFactor * 0.42 * (1.0 - cloud * 0.45);

    for (const lp of this._lampLights) {
      lp.intensity = this.uniforms.uLamps.value * 38.0;
    }

    // Coastal haze density (thicker during rain/mist, crystal clear in Plan Cutaway)
    if (this.uniforms.uLensMode.value > 1.5) {
      this.fog.color.set('#f1ede5');
      this.fog.density = 0.00025;
    } else {
      this.fog.color.copy(horizonCol);
      this.fog.density = 0.0011 + rain * 0.0018 + (runtime.hour < 8.0 ? 0.0005 : 0);
    }

    // Follow player/camera with sky dome & rain box
    if (focusPos) {
      this.skyMesh.position.set(focusPos.x, 0, focusPos.z);
      this.rainSystem.material.uniforms.uCenter.value.set(focusPos.x, 0, focusPos.z);
    }
    this.rainSystem.visible = this.uniforms.uRain.value > 0.03;
  }

  dispose() {
    this.skyMesh.geometry.dispose();
    this.skyMesh.material.dispose();
    this.rainSystem.geometry.dispose();
    this.rainSystem.material.dispose();
    this.leafSystem.geometry.dispose();
    this.leafSystem.material.dispose();
  }
}
