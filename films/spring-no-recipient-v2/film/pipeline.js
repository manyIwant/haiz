// Multi-pass renderer: reflection -> opaque HDR -> water composite -> glass -> shafts -> bloom -> grade.
import * as THREE from 'three';
import { U } from './world.js';

const FSQ_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function fsq(frag, uniforms, extra = {}) {
  const m = new THREE.ShaderMaterial({ uniforms, vertexShader: FSQ_VERT, fragmentShader: frag, depthTest: false, depthWrite: false, ...extra });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m);
  mesh.frustumCulled = false;
  const sc = new THREE.Scene(); sc.add(mesh);
  return { mat: m, scene: sc, mesh };
}
const ORTHO = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const AGX = /* glsl */`
// AgX (Troy Sobotka), same fit as three.js' AgXToneMapping
vec3 agxContrast(vec3 x){ vec3 x2=x*x, x4=x2*x2; return 15.5*x4*x2 - 40.14*x4*x + 31.96*x4 - 6.868*x2*x + 0.4298*x2 + 0.1191*x - 0.00232; }
vec3 agx(vec3 color){
  const mat3 AgXInsetMatrix = mat3( vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
    vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ), vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 ) );
  const mat3 AgXOutsetMatrix = mat3( vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
    vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ), vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 ) );
  const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3( vec3( 1.6605, - 0.1246, - 0.0182 ), vec3( - 0.5876, 1.1329, - 0.1006 ), vec3( - 0.0728, - 0.0083, 1.1187 ) );
  const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3( vec3( 0.6274, 0.0691, 0.0164 ), vec3( 0.3293, 0.9195, 0.0880 ), vec3( 0.0433, 0.0113, 0.8956 ) );
  const float AgxMinEv = - 12.47393; const float AgxMaxEv = 4.026069;
  color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
  color = AgXInsetMatrix * color;
  color = max( color, 1e-10 );
  color = log2( color );
  color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
  color = clamp( color, 0.0, 1.0 );
  color = agxContrast( color );
  color = AgXOutsetMatrix * color;
  color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
  color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
  return clamp( color, 0.0, 1.0 );
}
vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
`;

export class Pipeline {
  constructor(renderer, W, width, height, opts = {}) {
    this.r = renderer; this.W = W; this.w = width; this.h = height;
    const HF = THREE.HalfFloatType;
    const mk = (w, h, o = {}) => new THREE.WebGLRenderTarget(w, h, { type: HF, colorSpace: THREE.LinearSRGBColorSpace, ...o });
    this.opaque = mk(width, height, { samples: opts.msaa ?? 4, depthTexture: new THREE.DepthTexture(width, height, THREE.FloatType) });
    this.opaque.depthTexture.format = THREE.DepthFormat;
    this.opaqueResolved = this.opaque;
    const rs = opts.reflScale ?? 0.5;
    this.refl = mk(Math.round(width * rs), Math.round(height * rs), { samples: 2 });
    this.reflAlt = mk(Math.round(width * rs), Math.round(height * rs), { samples: 2 });
    this.comp = mk(width, height, { depthBuffer: true });
    this.blooms = [];
    let bw = width >> 1, bh = height >> 1;
    for (let i = 0; i < 5; i++) { this.blooms.push([mk(bw, bh), mk(bw, bh)]); bw = Math.max(1, bw >> 1); bh = Math.max(1, bh >> 1); }
    this.mirrorCam = new THREE.PerspectiveCamera();
    this.altCam = new THREE.PerspectiveCamera();
    this.clipUp = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.0);

    // copy opaque colour + depth into comp (so glass can depth-test after the water)
    this.copy = fsq(`uniform sampler2D tColor, tDepth; varying vec2 vUv;
      void main(){ gl_FragColor = texture2D(tColor, vUv); gl_FragDepth = texture2D(tDepth, vUv).x; }`,
      { tColor: { value: null }, tDepth: { value: null } }, { depthTest: true, depthWrite: true, depthFunc: THREE.AlwaysDepth });

    // god rays: march through the sun's shadow map inside a box (the classroom)
    this.sunDepth = new THREE.WebGLRenderTarget(2048, 2048, { depthTexture: new THREE.DepthTexture(2048, 2048, THREE.FloatType) });
    this.sunCam = new THREE.OrthographicCamera(-12, 12, 12, -12, 0.1, 120);
    this.depthMat = new THREE.MeshDepthMaterial();
    this.shafts = fsq(/* glsl */`
      uniform sampler2D tDepth, tSunDepth; uniform mat4 invProjView, sunMat; uniform vec3 camPos, boxMin, boxMax, sunCol;
      uniform float strength, camNear, camFar, frame, anis; uniform vec3 sunDir;
      varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + frame * 0.618) * 43758.5453); }
      vec2 boxHit(vec3 ro, vec3 rd){ vec3 t0 = (boxMin - ro) / rd, t1 = (boxMax - ro) / rd; vec3 a = min(t0, t1), b = max(t0, t1);
        return vec2(max(max(a.x, a.y), a.z), min(min(b.x, b.y), b.z)); }
      void main(){
        float z = texture2D(tDepth, vUv).x;
        vec4 ndc = vec4(vUv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0);
        vec4 wp = invProjView * ndc; wp /= wp.w;
        vec3 rd = wp.xyz - camPos; float dmax = length(rd); rd /= dmax;
        vec2 bh = boxHit(camPos, rd);
        float t0 = max(bh.x, 0.0), t1 = min(bh.y, dmax);
        if (t1 <= t0) { gl_FragColor = vec4(0.0); return; }
        const int N = 56; float acc = 0.0; float j = h(gl_FragCoord.xy);
        float dt = (t1 - t0) / float(N);
        for (int i = 0; i < N; i++) {
          vec3 p = camPos + rd * (t0 + (float(i) + j) * dt);
          vec4 sp = sunMat * vec4(p, 1.0); sp.xyz = sp.xyz / sp.w * 0.5 + 0.5;
          float sd = texture2D(tSunDepth, sp.xy).x;
          acc += step(sp.z - 0.0015, sd);
        }
        acc *= dt;
        float g = anis; float mu = dot(rd, sunDir);
        float phase = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * mu, 1.5) * 0.08;
        gl_FragColor = vec4(sunCol * acc * strength * phase, 1.0);
      }`, {
      tDepth: { value: null }, tSunDepth: { value: null }, invProjView: { value: new THREE.Matrix4() }, sunMat: { value: new THREE.Matrix4() },
      camPos: { value: new THREE.Vector3() }, boxMin: { value: new THREE.Vector3() }, boxMax: { value: new THREE.Vector3() },
      sunCol: { value: new THREE.Color() }, strength: { value: 0 }, camNear: { value: 0.05 }, camFar: { value: 6000 }, frame: { value: 0 },
      anis: { value: 0.55 }, sunDir: { value: new THREE.Vector3() },
    }, { blending: THREE.AdditiveBlending, transparent: true });

    // screen-space light scattering from the sun (only bright sky pixels emit)
    this.raysA = mk(width >> 1, height >> 1); this.raysB = mk(width >> 1, height >> 1);
    this.raySrc = fsq(`uniform sampler2D tColor, tDepth; uniform vec2 sunUV; uniform float aspect; varying vec2 vUv;
      void main(){ float sky = step(0.99999, texture2D(tDepth, vUv).x); vec3 c = texture2D(tColor, vUv).rgb;
        vec2 d = (vUv - sunUV) * vec2(aspect, 1.0); float w = exp(-dot(d, d) * 9.0);
        float l = max(max(c.r, c.g), c.b); gl_FragColor = vec4(c * sky * w * smoothstep(0.4, 2.0, l), 1.0); }`,
      { tColor: { value: null }, tDepth: { value: null }, sunUV: { value: new THREE.Vector2() }, aspect: { value: width / height } });
    this.rayBlur = fsq(`uniform sampler2D tSrc; uniform vec2 sunUV; uniform float frame; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + frame) * 43758.5453); }
      void main(){ vec2 dlt = (vUv - sunUV) / 64.0 * 0.92; vec2 uv = vUv - dlt * h(gl_FragCoord.xy); vec3 acc = vec3(0.0); float dec = 1.0;
        for (int i = 0; i < 64; i++) { uv -= dlt; acc += texture2D(tSrc, uv).rgb * dec; dec *= 0.965; }
        gl_FragColor = vec4(acc / 22.0, 1.0); }`, { tSrc: { value: null }, sunUV: { value: new THREE.Vector2() }, frame: { value: 0 } });
    this.bright = fsq(`uniform sampler2D tSrc; uniform float thr; varying vec2 vUv;
      void main(){ vec3 c = texture2D(tSrc, vUv).rgb; float l = max(max(c.r,c.g),c.b); gl_FragColor = vec4(c * smoothstep(thr, thr * 2.5, l), 1.0); }`,
      { tSrc: { value: null }, thr: { value: 1.0 } });
    this.blur = fsq(`uniform sampler2D tSrc; uniform vec2 dir; varying vec2 vUv;
      void main(){ vec3 s = texture2D(tSrc, vUv).rgb * 0.227;
        s += (texture2D(tSrc, vUv + dir * 1.38).rgb + texture2D(tSrc, vUv - dir * 1.38).rgb) * 0.316;
        s += (texture2D(tSrc, vUv + dir * 3.23).rgb + texture2D(tSrc, vUv - dir * 3.23).rgb) * 0.070;
        gl_FragColor = vec4(s, 1.0); }`, { tSrc: { value: null }, dir: { value: new THREE.Vector2() } });
    this.add = fsq(`uniform sampler2D tSrc; uniform float k; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tSrc, vUv).rgb * k, 1.0); }`,
      { tSrc: { value: null }, k: { value: 1 } }, { blending: THREE.AdditiveBlending, transparent: true });

    this.final = fsq(/* glsl */`
      uniform sampler2D tSrc, tB0, tB1, tB2, tB3, tB4; uniform float exposure, bloom, vign, grain, frame, sat, contrast, fade, ca;
      uniform vec3 lift, gamma, gain, fadeCol, tint; uniform vec2 res;
      varying vec2 vUv;
      ${AGX}
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + frame * 0.6180339) * 43758.5453); }
      void main(){
        vec2 d = vUv - 0.5;
        vec3 c;
        c.r = texture2D(tSrc, vUv - d * ca * 0.004).r;
        c.g = texture2D(tSrc, vUv).g;
        c.b = texture2D(tSrc, vUv + d * ca * 0.004).b;
        vec3 b = texture2D(tB0, vUv).rgb * 0.6 + texture2D(tB1, vUv).rgb * 0.8 + texture2D(tB2, vUv).rgb + texture2D(tB3, vUv).rgb * 1.1 + texture2D(tB4, vUv).rgb * 1.2;
        c += b * bloom;
        c *= tint;
        c *= exposure;
        c = agx(c);
        // grade in display-referred space
        c = pow(max(c, 0.0), vec3(1.0 / 2.2));
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, sat);
        c = (c - 0.5) * contrast + 0.5;
        c = pow(max(c * gain + lift * (1.0 - c), 0.0), 1.0 / gamma);
        float v = 1.0 - dot(d * vec2(1.0, 0.8), d * vec2(1.0, 0.8)) * vign * 1.7;
        c *= clamp(v, 0.0, 1.0);
        c = mix(c, fadeCol, fade);
        // film grain (luma-weighted), then dither
        float gn = (h(gl_FragCoord.xy) + h(gl_FragCoord.xy + 17.3) - 1.0);
        c += gn * grain * (0.35 + 0.65 * (1.0 - abs(l - 0.45) * 1.6));
        c += (h(gl_FragCoord.xy * 1.37 + 3.1) - 0.5) / 255.0;
        gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
      }`, {
      tSrc: { value: null }, tB0: { value: null }, tB1: { value: null }, tB2: { value: null }, tB3: { value: null }, tB4: { value: null },
      exposure: { value: 1 }, bloom: { value: 0.04 }, vign: { value: 0.25 }, grain: { value: 0.035 }, frame: { value: 0 },
      sat: { value: 1 }, contrast: { value: 1 }, fade: { value: 0 }, ca: { value: 0.6 },
      lift: { value: new THREE.Vector3(0, 0, 0) }, gamma: { value: new THREE.Vector3(1, 1, 1) }, gain: { value: new THREE.Vector3(1, 1, 1) },
      fadeCol: { value: new THREE.Vector3(0, 0, 0) }, tint: { value: new THREE.Vector3(1, 1, 1) }, res: { value: new THREE.Vector2(width, height) },
    });
  }

  mirror(cam, out, level = 0) {
    out.copy(cam);
    out.position.copy(cam.position); out.position.y = 2 * level - cam.position.y;
    const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd); fwd.y = -fwd.y;
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion); up.y = -up.y;
    out.up.copy(up);
    out.lookAt(out.position.clone().add(fwd));
    out.updateMatrixWorld(); out.projectionMatrix.copy(cam.projectionMatrix); out.projectionMatrixInverse.copy(cam.projectionMatrixInverse);
    const m = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    return m.multiply(out.projectionMatrix).multiply(out.matrixWorldInverse);
  }

  render(cam, P) {
    const r = this.r, W = this.W, sc = W.scene;
    const gl = r.getContext(); const prof = window.PROF ? {} : null; let tp = performance.now();
    const mark = (k) => { if (!prof) return; gl.finish(); const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); const n = performance.now(); prof[k] = Math.round(n - tp); tp = n; };
    this.lastProf = prof;
    const water = W.water;
    r.setRenderTarget(null);
    const waterOn = P.water !== false;
    // 1. reflections
    if (waterOn) {
      water.visible = false;
      const m = this.mirror(cam, this.mirrorCam, 0);
      r.clippingPlanes = [this.clipUp];
      if (P.beforeRefl) P.beforeRefl();
      r.setRenderTarget(this.refl); r.clear(); r.render(sc, this.mirrorCam);
      if (P.afterRefl) P.afterRefl();
      water.material.uniforms.reflMatrix.value.copy(m);
      if (P.altRefl) {           // an impossible reflection: render the world in another configuration
        const ma = this.mirror(P.altCam || cam, this.altCam, 0);
        P.altRefl(true);
        r.setRenderTarget(this.reflAlt); r.clear(); r.render(sc, this.altCam);
        P.altRefl(false);
        water.material.uniforms.reflAltMatrix.value.copy(ma);
        water.material.uniforms.tReflAlt.value = this.reflAlt.texture;
      }
      r.clippingPlanes = [];
      water.material.uniforms.tRefl.value = this.refl.texture;
    }
    mark('refl');
    // 2. opaque (+ glass hidden)
    water.visible = false;
    const glass = W.groups.glass || [];
    const glassVis = glass.map(g => g.visible);
    for (const g of glass) g.visible = false;
    if (W.dyn.sash_glass) W.dyn.sash_glass.visible = false;
    if (P.shafts && P.shafts.strength > 0) this.renderSunDepth(P.shafts);
    if (P.beforeOpaque) P.beforeOpaque(this);
    mark('sundepth');
    r.setRenderTarget(this.opaque); r.clear(); r.render(sc, cam);
    mark('opaque');
    // 3. composite: copy colour + depth, draw water, then glass
    this.copy.mat.uniforms.tColor.value = this.opaque.texture;
    this.copy.mat.uniforms.tDepth.value = this.opaque.depthTexture;
    r.setRenderTarget(this.comp); r.clear(); r.render(this.copy.scene, ORTHO);
    const keep = sc.children.map(c => c.visible);
    if (waterOn) {
      const wu = water.material.uniforms;
      wu.tOpaque.value = this.opaque.texture; wu.tDepth.value = this.opaque.depthTexture;
      wu.resolution.value.set(this.w, this.h); wu.camNear.value = cam.near; wu.camFar.value = cam.far;
      sc.children.forEach(c => c.visible = false);
      water.visible = true;
      r.autoClear = false; r.render(sc, cam); r.autoClear = true;
      sc.children.forEach((c, i) => c.visible = keep[i]);
      water.visible = false;
    }
    // glass panes, depth-tested against the copied opaque depth
    if (glass.length) {
      const vis = sc.children.map(c => c.visible);
      const hidden = [];
      sc.traverse(o => { if (o.isMesh && o.visible && !glass.includes(o) && o !== W.dyn.sash_glass) { hidden.push(o); o.visible = false; } });
      glass.forEach((g, i) => g.visible = glassVis[i]);
      if (W.dyn.sash_glass) W.dyn.sash_glass.visible = true;
      r.autoClear = false; r.render(sc, cam); r.autoClear = true;
      hidden.forEach(o => o.visible = true);
      sc.children.forEach((c, i) => c.visible = vis[i]);
    }
    mark('water+glass');
    // 4. light shafts
    if (P.shafts && P.shafts.strength > 0) this.renderShafts(cam, P.shafts);
    if (P.rays && P.rays.strength > 0) {
      this.raySrc.mat.uniforms.tColor.value = this.comp.texture; this.raySrc.mat.uniforms.tDepth.value = this.opaque.depthTexture;
      this.raySrc.mat.uniforms.sunUV.value.set(...P.rays.uv);
      r.setRenderTarget(this.raysA); r.render(this.raySrc.scene, ORTHO);
      this.rayBlur.mat.uniforms.tSrc.value = this.raysA.texture; this.rayBlur.mat.uniforms.sunUV.value.set(...P.rays.uv); this.rayBlur.mat.uniforms.frame.value = (P.frame || 0) % 97;
      r.setRenderTarget(this.raysB); r.render(this.rayBlur.scene, ORTHO);
      this.add.mat.uniforms.tSrc.value = this.raysB.texture; this.add.mat.uniforms.k.value = P.rays.strength;
      r.setRenderTarget(this.comp); r.autoClear = false; r.render(this.add.scene, ORTHO); r.autoClear = true;
    }
    mark('shafts');
    // 5. bloom
    let src = this.comp.texture;
    this.bright.mat.uniforms.tSrc.value = src; this.bright.mat.uniforms.thr.value = P.bloomThr ?? 1.2;
    r.setRenderTarget(this.blooms[0][0]); r.render(this.bright.scene, ORTHO);
    for (let i = 0; i < this.blooms.length; i++) {
      const [a, b] = this.blooms[i];
      if (i > 0) { this.add.mat.uniforms.tSrc.value = this.blooms[i - 1][0].texture; this.add.mat.uniforms.k.value = 1; this.add.mat.blending = THREE.NoBlending; r.setRenderTarget(a); r.render(this.add.scene, ORTHO); this.add.mat.blending = THREE.AdditiveBlending; }
      this.blur.mat.uniforms.tSrc.value = a.texture; this.blur.mat.uniforms.dir.value.set(1 / a.width, 0); r.setRenderTarget(b); r.render(this.blur.scene, ORTHO);
      this.blur.mat.uniforms.tSrc.value = b.texture; this.blur.mat.uniforms.dir.value.set(0, 1 / a.height); r.setRenderTarget(a); r.render(this.blur.scene, ORTHO);
    }
    // 6. grade to screen
    const fu = this.final.mat.uniforms;
    fu.tSrc.value = this.comp.texture;
    ['tB0', 'tB1', 'tB2', 'tB3', 'tB4'].forEach((k, i) => fu[k].value = this.blooms[i][0].texture);
    const G = P.grade || {};
    fu.exposure.value = G.exposure ?? 1; fu.bloom.value = G.bloom ?? 0.05; fu.vign.value = G.vign ?? 0.28;
    fu.grain.value = G.grain ?? 0.03; fu.sat.value = G.sat ?? 1; fu.contrast.value = G.contrast ?? 1;
    fu.fade.value = G.fade ?? 0; fu.ca.value = G.ca ?? 0.6; fu.frame.value = P.frame || 0;
    fu.lift.value.set(...(G.lift || [0, 0, 0])); fu.gamma.value.set(...(G.gamma || [1, 1, 1])); fu.gain.value.set(...(G.gain || [1, 1, 1]));
    fu.tint.value.set(...(G.tint || [1, 1, 1])); fu.fadeCol.value.set(...(G.fadeCol || [0, 0, 0]));
    r.setRenderTarget(P.target || null); r.render(this.final.scene, ORTHO);
    mark('post');
  }

  renderSunDepth(S) {
    const r = this.r, W = this.W;
    const sd = U.uSunDir.value;
    const c = new THREE.Vector3(...S.center);
    this.sunCam.position.copy(c).addScaledVector(sd, 60);
    this.sunCam.lookAt(c);
    this.sunCam.updateMatrixWorld();
    const ov = W.scene.overrideMaterial;
    const water = W.water.visible, sky = W.sky.visible;
    W.water.visible = false; W.sky.visible = false;
    const glass = [...(W.groups.glass || []), W.dyn.sash_glass].filter(Boolean);
    const gv = glass.map(g => g.visible); glass.forEach(g => g.visible = false);
    W.scene.overrideMaterial = this.depthMat;
    r.setRenderTarget(this.sunDepth); r.clear(); r.render(W.scene, this.sunCam);
    W.scene.overrideMaterial = ov; W.water.visible = water; W.sky.visible = sky;
    glass.forEach((g, i) => g.visible = gv[i]);
    this.shafts.mat.uniforms.sunMat.value.copy(this.sunCam.projectionMatrix).multiply(this.sunCam.matrixWorldInverse);
  }

  renderShafts(cam, S) {
    const r = this.r, W = this.W;
    const sd = U.uSunDir.value;
    const u = this.shafts.mat.uniforms;
    u.tDepth.value = this.opaque.depthTexture; u.tSunDepth.value = this.sunDepth.depthTexture;
    u.invProjView.value.copy(cam.projectionMatrix).multiply(cam.matrixWorldInverse).invert();
    u.camPos.value.copy(cam.position); u.boxMin.value.set(...S.boxMin); u.boxMax.value.set(...S.boxMax);
    u.sunCol.value.copy(U.uSunCol.value); u.strength.value = S.strength; u.frame.value = S.frame || 0;
    u.sunDir.value.copy(sd); u.anis.value = S.anis ?? 0.55;
    r.setRenderTarget(this.comp); r.autoClear = false; r.render(this.shafts.scene, ORTHO); r.autoClear = true;
  }
}
