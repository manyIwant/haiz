// 年轮 · weather the tree stands in: rain, rings on the water, stars.
// Added to V4's scene only while the ring is open; nothing here touches V4's
// own materials. Rain falls along the day's wind; stars are a plain random
// field (not a star chart) and fade under cloud and moonlight.
import * as THREE from 'three';
import { mulberry } from '../js/foliage.js';

const RAIN_N = 9000;
const BOX = new THREE.Vector3(46, 26, 46);

export function createWeather(water) {
  const group = new THREE.Group();
  group.name = 'rings-weather';
  group.visible = false;

  // ---------------------------------------------------------------- rain
  const rand = mulberry(8841);
  const seed = new Float32Array(RAIN_N * 2 * 4);
  for (let i = 0; i < RAIN_N; i++) {
    const a = rand(), b = rand(), c = rand(), d = rand();
    for (let e = 0; e < 2; e++) seed.set([a, b, c, d + e * 2], (i * 2 + e) * 4);   // .w: random, +2 marks the streak's tail
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RAIN_N * 2 * 3), 3));
  rainGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const rainMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uCam: { value: new THREE.Vector3() }, uBox: { value: BOX }, uWind: { value: new THREE.Vector3() },
      uCol: { value: new THREE.Color(0.7, 0.75, 0.8) }, uAlpha: { value: 0.3 }, uLen: { value: 0.5 } },
    vertexShader: /* glsl */`
uniform float uT; uniform vec3 uCam; uniform vec3 uBox; uniform vec3 uWind; uniform float uLen;
attribute vec4 aSeed; varying float vA;
void main(){
  float tail = step(1.5, aSeed.w), rnd = aSeed.w - tail * 2.0;
  float speed = 13.0 + 6.0 * rnd;
  vec3 vel = vec3(uWind.x, -speed, uWind.z);
  // a box of drops that travels with the camera: positions wrap inside it
  vec3 p = aSeed.xyz * uBox + vel * uT;
  p = mod(p - uCam + uBox * 0.5, uBox) - uBox * 0.5 + uCam;
  p -= normalize(vel) * tail * uLen * (0.7 + 0.6 * rnd);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  // drops close to the lens would be thick smears; far ones thin out
  vA = smoothstep(0.6, 3.5, -mv.z) * (1.0 - smoothstep(16.0, 23.0, -mv.z)) * (1.0 - tail * 0.75);
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */`uniform vec3 uCol; uniform float uAlpha; varying float vA; void main(){ gl_FragColor = vec4(uCol * uAlpha * vA, 1.0); }`
  });
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false;
  rain.renderOrder = 6;
  group.add(rain);

  // ---------------------------------------------------------------- rings on the water
  const rippleMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uRain: { value: 0 }, uCol: { value: new THREE.Color(0.6, 0.66, 0.72) } },
    vertexShader: /* glsl */`varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
uniform float uT; uniform float uRain; uniform vec3 uCol; varying vec3 vW;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float layer(vec2 uv, float t){
  vec2 id = floor(uv), f = fract(uv) - 0.5;
  float n = h21(id), ph = fract(t * (0.55 + 0.4 * n) + n * 7.0);
  vec2 c = (vec2(h21(id + 3.1), h21(id + 7.7)) - 0.5) * 0.5;
  float d = length(f - c), r = ph * 0.42;
  // only some cells are struck at a time: more of them the harder it rains
  float on = step(1.0 - (0.25 + 0.75 * uRain), h21(id + floor(t * (0.55 + 0.4 * n) + n * 7.0)));
  return on * smoothstep(0.035, 0.0, abs(d - r)) * (1.0 - ph) * (1.0 - ph);
}
void main(){
  float dist = length(vW.xz - cameraPosition.xz);
  float a = layer(vW.xz * 1.6, uT) + layer(vW.xz * 2.7 + 11.3, uT * 1.2) * 0.7;
  a *= uRain * (1.0 - smoothstep(18.0, 46.0, dist));
  gl_FragColor = vec4(uCol * a * 0.5, 1.0);
}`
  });
  const ripples = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), rippleMat);
  ripples.rotation.x = -Math.PI / 2;
  ripples.position.y = water + 0.02;
  ripples.renderOrder = -3;
  group.add(ripples);

  // ---------------------------------------------------------------- stars
  const STAR_N = 1600;
  const sp = new Float32Array(STAR_N * 3), sa = new Float32Array(STAR_N);
  for (let i = 0; i < STAR_N; i++) {
    const y = 0.02 + rand() * 0.98, a = rand() * Math.PI * 2, r = Math.sqrt(1 - y * y);
    sp.set([Math.cos(a) * r * 520, y * 520, Math.sin(a) * r * 520], i * 3);
    sa[i] = Math.pow(rand(), 3.2);   // a few bright ones, many faint
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  starGeo.setAttribute('aMag', new THREE.BufferAttribute(sa, 1));
  const starMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uNight: { value: 0 }, uPx: { value: 1 }, uT: { value: 0 } },
    vertexShader: /* glsl */`
uniform float uPx; uniform float uT; attribute float aMag; varying float vB;
void main(){
  vec4 mv = viewMatrix * vec4(position + cameraPosition, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = 0.82 + 0.18 * sin(uT * (1.3 + aMag * 3.0) + position.x * 0.37);
  vB = (0.16 + 0.84 * aMag) * tw * smoothstep(0.0, 0.2, normalize(position).y);
  gl_PointSize = (1.3 + 2.2 * aMag) * uPx;
}`,
    fragmentShader: /* glsl */`
uniform float uNight; varying float vB;
void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(0.82, 0.88, 1.0) * vB * uNight * smoothstep(0.5, 0.1, d) * 1.5, 1.0); }`
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  stars.renderOrder = -9;
  group.add(stars);

  const wind = new THREE.Vector3();
  return {
    group,
    /** s: { rain 0..1, wind 0..1.75, windDir [x,0,z], stars 0..1, horizon [r,g,b] } */
    update(t, camera, s, pixelRatio = 1) {
      const raining = s.rain > 0.01;
      rain.visible = ripples.visible = raining;
      if (raining) {
        rainMat.uniforms.uT.value = t;
        rainMat.uniforms.uCam.value.copy(camera.position);
        wind.set(s.windDir[0], 0, s.windDir[2]).multiplyScalar(2 + s.wind * 9);
        rainMat.uniforms.uWind.value.copy(wind);
        rainMat.uniforms.uAlpha.value = 0.10 + 0.22 * s.rain;
        rainMat.uniforms.uLen.value = 0.35 + 0.5 * s.rain;
        rainMat.uniforms.uCol.value.setRGB(s.horizon[0] * 0.9 + 0.25, s.horizon[1] * 0.9 + 0.27, s.horizon[2] * 0.9 + 0.3);
        rainGeo.setDrawRange(0, Math.round(RAIN_N * (0.18 + 0.82 * s.rain)) * 2);
        rippleMat.uniforms.uT.value = t;
        rippleMat.uniforms.uRain.value = s.rain;
        rippleMat.uniforms.uCol.value.setRGB(s.horizon[0] + 0.12, s.horizon[1] + 0.13, s.horizon[2] + 0.14);
      }
      stars.visible = s.stars > 0.01;
      starMat.uniforms.uNight.value = s.stars;
      starMat.uniforms.uPx.value = pixelRatio;
      starMat.uniforms.uT.value = t;
    },
    dispose() { for (const o of [rain, ripples, stars]) { o.geometry.dispose(); o.material.dispose(); } }
  };
}
