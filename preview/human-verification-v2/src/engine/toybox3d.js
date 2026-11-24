/**
 * HAIZ Toybox V2 — Bespoke Localized WebGL2 Velvet-PBR Engine
 */

import {
  m4Identity,
  m4Multiply,
  m4ComposeTRS,
  m4Perspective,
  m4Ortho,
  m4LookAt,
  m4NormalMat3,
  hexToRgb
} from './math3d.js';

export const FABRIC = Object.freeze({
  PLUSH: 0,
  CORDUROY: 1,
  WOVEN: 2,
  SATIN: 3,
  METAL: 4,
  GLASS_EYE: 5,
  ACRYLIC: 6
});

export class Node3D {
  constructor(name = '') {
    this.name = name;
    this.position = [0, 0, 0];
    this.rotation = [0, 0, 0];
    this.scale = [1, 1, 1];
    this.visible = true;
    this.children = [];
    this.parent = null;
    this.userData = {};
    this.localMatrix = m4Identity();
    this.worldMatrix = m4Identity();
  }

  add(...nodes) {
    for (const n of nodes) {
      if (!n) continue;
      if (n.parent) n.parent.remove(n);
      n.parent = this;
      this.children.push(n);
    }
    return this;
  }

  remove(node) {
    const idx = this.children.indexOf(node);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      node.parent = null;
    }
    return this;
  }

  updateWorldMatrix(parentWorld = null) {
    m4ComposeTRS(this.position, this.rotation, this.scale, this.localMatrix);
    if (parentWorld) {
      m4Multiply(parentWorld, this.localMatrix, this.worldMatrix);
    } else {
      this.worldMatrix.set(this.localMatrix);
    }
    for (let i = 0; i < this.children.length; i++) {
      this.children[i].updateWorldMatrix(this.worldMatrix);
    }
  }
}

export class Mesh3D extends Node3D {
  constructor(geometry, material, name = '') {
    super(name);
    this.isMesh = true;
    this.geometry = geometry;
    this.material = {
      color: [0.9, 0.9, 0.9],
      roughness: 0.85,
      metalness: 0.0,
      fuzz: 0.55,
      fabric: FABRIC.PLUSH,
      opacity: 1.0,
      emissive: [0, 0, 0],
      emissiveIntensity: 0.0,
      castShadow: true,
      receiveShadow: true,
      ...material
    };
    if (typeof this.material.color === 'number' || typeof this.material.color === 'string') {
      this.material.color = hexToRgb(this.material.color);
    }
    if (typeof this.material.emissive === 'number' || typeof this.material.emissive === 'string') {
      this.material.emissive = hexToRgb(this.material.emissive);
    }
  }
}

const SHADOW_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;
uniform mat4 uLightVP;
uniform mat4 uModel;
void main() {
  gl_Position = uLightVP * uModel * vec4(aPos, 1.0);
}
`;

const SHADOW_FS = `#version 300 es
precision highp float;
out vec4 fragColor;
void main() {
  fragColor = vec4(1.0);
}
`;

const MAIN_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUv;

uniform mat4 uVP;
uniform mat4 uModel;
uniform mat3 uNormalMat;
uniform mat4 uLightVP;

out vec3 vWorldPos;
out vec3 vLocalPos;
out vec3 vNormal;
out vec2 vUv;
out vec4 vShadowCoord;

void main() {
  vec4 wp = uModel * vec4(aPos, 1.0);
  vWorldPos = wp.xyz;
  vLocalPos = aPos;
  vNormal = normalize(uNormalMat * aNormal);
  vUv = aUv;
  vShadowCoord = uLightVP * wp;
  gl_Position = uVP * wp;
}
`;

const MAIN_FS = `#version 300 es
precision highp float;

in vec3 vWorldPos;
in vec3 vLocalPos;
in vec3 vNormal;
in vec2 vUv;
in vec4 vShadowCoord;

uniform vec3 uCamPos;
uniform vec3 uColor;
uniform float uRoughness;
uniform float uMetalness;
uniform float uFuzz;
uniform int uFabric;
uniform float uOpacity;
uniform vec3 uEmissive;
uniform float uEmissiveIntensity;
uniform float uReceiveShadow;

uniform vec3 uKeyDir;
uniform vec3 uKeyColor;
uniform vec3 uFillDir;
uniform vec3 uFillColor;
uniform vec3 uRimDir;
uniform vec3 uRimColor;
uniform vec3 uSkyColor;
uniform vec3 uGroundColor;
uniform float uExposure;

uniform sampler2D uShadowMap;

out vec4 fragColor;

float hash3(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i + vec3(0,0,0)), hash3(i + vec3(1,0,0)), f.x),
        mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x),
        mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y),
    f.z
  );
}

float computeShadow(vec4 sc, vec3 N, vec3 L) {
  if (uReceiveShadow < 0.5) return 1.0;
  vec3 proj = sc.xyz / sc.w * 0.5 + 0.5;
  if (proj.x < 0.01 || proj.x > 0.99 || proj.y < 0.01 || proj.y > 0.99 || proj.z > 0.995) {
    return 1.0;
  }
  float bias = max(0.0028 * (1.0 - dot(N, L)), 0.0012);
  vec2 texel = vec2(1.0 / 1024.0);
  float lit = 0.0;
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      float d = texture(uShadowMap, proj.xy + vec2(float(x), float(y)) * texel).r;
      lit += (proj.z - bias <= d) ? 1.0 : 0.0;
    }
  }
  return mix(0.56, 1.0, lit / 9.0);
}

vec3 acesToneMap(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCamPos - vWorldPos);
  vec3 albedo = uColor;
  float rough = uRoughness;

  if (uFabric == 0) {
    float g1 = noise3(vLocalPos * 46.0);
    float g2 = noise3(vLocalPos * 98.0);
    float fiber = (g1 * 0.65 + g2 * 0.35) - 0.5;
    albedo *= (1.0 + fiber * 0.075);
    N = normalize(N + vec3(fiber, -fiber * 0.6, fiber * 0.8) * 0.12);
  } else if (uFabric == 1) {
    float rib = sin(vUv.x * 165.0) * 0.5 + 0.5;
    albedo *= mix(0.89, 1.05, rib);
    N = normalize(N + vec3(cos(vUv.x * 165.0) * 0.16, 0.0, 0.0));
  } else if (uFabric == 2) {
    float wx = sin(vUv.x * 130.0);
    float wy = sin(vUv.y * 95.0);
    float weave = (wx * wy) * 0.5 + 0.5;
    albedo *= mix(0.88, 1.07, weave);
    N = normalize(N + vec3(wx * 0.08, wy * 0.08, 0.0));
  } else if (uFabric == 4) {
    float streak = noise3(vec3(vLocalPos.x * 6.0, vLocalPos.y * 85.0, vLocalPos.z * 6.0)) - 0.5;
    albedo *= (1.0 + streak * 0.07);
    rough = clamp(rough + streak * 0.08, 0.12, 0.65);
  }

  float NdotV = max(dot(N, V), 0.001);
  vec3 Lkey = normalize(uKeyDir);
  vec3 Lfill = normalize(uFillDir);
  vec3 Lrim = normalize(uRimDir);

  float shadow = computeShadow(vShadowCoord, N, Lkey);

  float wrap = (uFabric <= 2) ? 0.28 : 0.05;
  float diffKey = max((dot(N, Lkey) + wrap) / (1.0 + wrap), 0.0) * shadow;
  float diffFill = max((dot(N, Lfill) + wrap) / (1.0 + wrap), 0.0);

  vec3 Hkey = normalize(Lkey + V);
  float shininess = mix(120.0, 8.0, rough * rough);
  float specKey = pow(max(dot(N, Hkey), 0.0), shininess) * shadow;
  vec3 Hrim = normalize(Lrim + V);
  float specRim = pow(max(dot(N, Hrim), 0.0), shininess * 0.6);

  vec3 F0 = mix(vec3(0.04), albedo, uMetalness);
  float fresnel = pow(1.0 - NdotV, 4.0);
  vec3 specTint = mix(F0, vec3(1.0), fresnel * (1.0 - rough * 0.7));

  float hemiT = N.y * 0.5 + 0.5;
  vec3 hemiAmb = mix(uGroundColor, uSkyColor, hemiT) * (0.34 + 0.12 * hemiT);

  vec3 diffuseColor = albedo * (1.0 - uMetalness * 0.88);
  vec3 color = diffuseColor * (hemiAmb + uKeyColor * diffKey * 0.88 + uFillColor * diffFill * 0.34);

  float specWeight = (uFabric <= 2) ? 0.08 : (uFabric == 4 ? 1.15 : (uFabric == 5 ? 1.85 : 0.45));
  color += specTint * (uKeyColor * specKey + uRimColor * specRim * 0.55) * specWeight;

  if (uFuzz > 0.01) {
    float sheenCurve = pow(1.0 - NdotV, 2.65);
    vec3 fuzzColor = mix(albedo * 1.28 + vec3(0.10, 0.09, 0.07), uSkyColor, 0.25);
    float topMask = smoothstep(-0.4, 0.85, N.y) * 0.65 + 0.35;
    color += fuzzColor * sheenCurve * uFuzz * topMask * 0.36;
  }

  if (uFabric == 5) {
    vec3 R = reflect(-V, N);
    float softbox1 = smoothstep(0.92, 0.985, dot(R, normalize(vec3(0.38, 0.55, 0.74))));
    float softbox2 = smoothstep(0.96, 0.995, dot(R, normalize(vec3(-0.45, -0.25, 0.85))));
    color += vec3(1.0, 0.99, 0.97) * softbox1 * 1.15 + vec3(0.88, 0.95, 1.0) * softbox2 * 0.55;
  }

  if (uFabric == 6) {
    float edgeGlow = pow(1.0 - NdotV, 2.2);
    color = mix(color, vec3(0.96, 0.98, 1.0), edgeGlow * 0.72);
    float finalAlpha = clamp(uOpacity + edgeGlow * 0.42, 0.0, 0.88);
    color = pow(acesToneMap(color * uExposure), vec3(1.0 / 2.2));
    fragColor = vec4(color, finalAlpha);
    return;
  }

  color += uEmissive * uEmissiveIntensity;
  color = pow(acesToneMap(color * uExposure), vec3(1.0 / 2.2));
  fragColor = vec4(color, uOpacity);
}
`;

export class ToyboxRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: Boolean(options.preserveDrawingBuffer),
      powerPreference: 'high-performance'
    });
    if (!gl) {
      throw new Error('WebGL2 context unavailable');
    }
    this.gl = gl;
    this.clearColor = [0.91, 0.88, 0.83];
    this.lights = {
      keyDir: [0.42, 0.88, 0.62],
      keyColor: [1.0, 0.95, 0.88],
      fillDir: [-0.72, 0.35, 0.55],
      fillColor: [0.76, 0.84, 0.94],
      rimDir: [-0.35, 0.65, -0.75],
      rimColor: [1.0, 0.92, 0.82],
      skyColor: [0.98, 0.95, 0.90],
      groundColor: [0.74, 0.67, 0.60],
      exposure: 0.84
    };

    this._geoCache = new WeakMap();
    this._allBuffers = [];
    this._destroyed = false;

    this._mainProg = this._createProgram(MAIN_VS, MAIN_FS);
    this._shadowProg = this._createProgram(SHADOW_VS, SHADOW_FS);
    this._initShadowMap();

    this._uMain = this._cacheUniforms(this._mainProg, [
      'uVP', 'uModel', 'uNormalMat', 'uLightVP', 'uCamPos',
      'uColor', 'uRoughness', 'uMetalness', 'uFuzz', 'uFabric',
      'uOpacity', 'uEmissive', 'uEmissiveIntensity', 'uReceiveShadow',
      'uKeyDir', 'uKeyColor', 'uFillDir', 'uFillColor', 'uRimDir', 'uRimColor',
      'uSkyColor', 'uGroundColor', 'uExposure', 'uShadowMap'
    ]);
    this._uShadow = this._cacheUniforms(this._shadowProg, ['uLightVP', 'uModel']);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
  }

  _compileShader(type, src) {
    const gl = this.gl;
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error(`Shader compile error: ${log}`);
    }
    return s;
  }

  _createProgram(vsSrc, fsSrc) {
    const gl = this.gl;
    const vs = this._compileShader(gl.VERTEX_SHADER, vsSrc);
    const fs = this._compileShader(gl.FRAGMENT_SHADER, fsSrc);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`Program link error: ${gl.getProgramInfoLog(prog)}`);
    }
    return prog;
  }

  _cacheUniforms(prog, names) {
    const map = {};
    for (const n of names) {
      map[n] = this.gl.getUniformLocation(prog, n);
    }
    return map;
  }

  _initShadowMap() {
    const gl = this.gl;
    this._shadowSize = 1024;
    this._shadowTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._shadowTex);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24,
      this._shadowSize, this._shadowSize, 0,
      gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this._shadowFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._shadowFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this._shadowTex, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  _getGeoGpu(geo) {
    let entry = this._geoCache.get(geo);
    if (entry) return entry;
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const pBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pBuf);
    gl.bufferData(gl.ARRAY_BUFFER, geo.positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    const nBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, nBuf);
    gl.bufferData(gl.ARRAY_BUFFER, geo.normals, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

    const uBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uBuf);
    gl.bufferData(gl.ARRAY_BUFFER, geo.uvs, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);

    const iBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.indices, gl.STATIC_DRAW);

    gl.bindVertexArray(null);
    entry = { vao, count: geo.indices.length, pBuf, nBuf, uBuf, iBuf };
    this._geoCache.set(geo, entry);
    this._allBuffers.push(entry);
    return entry;
  }

  setSize(cssWidth, cssHeight, maxDpr = 2) {
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    const w = Math.max(2, Math.round(cssWidth * dpr));
    const h = Math.max(2, Math.round(cssHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.width = w;
    this.height = h;
  }

  _collectMeshes(root, opaque, transparent) {
    if (!root.visible) return;
    if (root.isMesh && root.geometry) {
      if (root.material.opacity < 0.99 || root.material.fabric === FABRIC.ACRYLIC) {
        transparent.push(root);
      } else {
        opaque.push(root);
      }
    }
    for (let i = 0; i < root.children.length; i++) {
      this._collectMeshes(root.children[i], opaque, transparent);
    }
  }

  render(root, camera) {
    if (this._destroyed) return;
    const gl = this.gl;
    root.updateWorldMatrix(null);

    const opaque = [];
    const transparent = [];
    this._collectMeshes(root, opaque, transparent);

    const lightEye = [
      this.lights.keyDir[0] * 5.6,
      this.lights.keyDir[1] * 5.6,
      this.lights.keyDir[2] * 5.6
    ];
    const lightView = m4LookAt(lightEye, camera.shadowTarget || [0, -0.1, 0], [0, 1, 0]);
    const sr = camera.shadowExtent || 3.4;
    const lightProj = m4Ortho(-sr, sr, -sr, sr, 0.5, 16.0);
    const lightVP = m4Multiply(lightProj, lightView);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this._shadowFbo);
    gl.viewport(0, 0, this._shadowSize, this._shadowSize);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this._shadowProg);
    gl.uniformMatrix4fv(this._uShadow.uLightVP, false, lightVP);
    gl.cullFace(gl.FRONT);

    for (let i = 0; i < opaque.length; i++) {
      const m = opaque[i];
      if (!m.material.castShadow) continue;
      const gpu = this._getGeoGpu(m.geometry);
      gl.uniformMatrix4fv(this._uShadow.uModel, false, m.worldMatrix);
      gl.bindVertexArray(gpu.vao);
      gl.drawElements(gl.TRIANGLES, gpu.count, gl.UNSIGNED_SHORT, 0);
    }
    gl.cullFace(gl.BACK);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.viewport(0, 0, this.width || this.canvas.width, this.height || this.canvas.height);
    gl.clearColor(this.clearColor[0], this.clearColor[1], this.clearColor[2], 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const aspect = (this.width || this.canvas.width) / Math.max(1, this.height || this.canvas.height);
    const proj = m4Perspective((camera.fov || 30) * Math.PI / 180, aspect, 0.1, 40.0);
    const view = m4LookAt(camera.eye, camera.target, [0, 1, 0]);
    const vp = m4Multiply(proj, view);

    gl.useProgram(this._mainProg);
    gl.uniformMatrix4fv(this._uMain.uVP, false, vp);
    gl.uniformMatrix4fv(this._uMain.uLightVP, false, lightVP);
    gl.uniform3fv(this._uMain.uCamPos, camera.eye);
    gl.uniform3fv(this._uMain.uKeyDir, this.lights.keyDir);
    gl.uniform3fv(this._uMain.uKeyColor, this.lights.keyColor);
    gl.uniform3fv(this._uMain.uFillDir, this.lights.fillDir);
    gl.uniform3fv(this._uMain.uFillColor, this.lights.fillColor);
    gl.uniform3fv(this._uMain.uRimDir, this.lights.rimDir);
    gl.uniform3fv(this._uMain.uRimColor, this.lights.rimColor);
    gl.uniform3fv(this._uMain.uSkyColor, this.lights.skyColor);
    gl.uniform3fv(this._uMain.uGroundColor, this.lights.groundColor);
    gl.uniform1f(this._uMain.uExposure, this.lights.exposure);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._shadowTex);
    gl.uniform1i(this._uMain.uShadowMap, 0);

    const normMat = new Float32Array(9);
    const drawMesh = (m) => {
      const gpu = this._getGeoGpu(m.geometry);
      const mat = m.material;
      m4NormalMat3(m.worldMatrix, normMat);
      gl.uniformMatrix4fv(this._uMain.uModel, false, m.worldMatrix);
      gl.uniformMatrix3fv(this._uMain.uNormalMat, false, normMat);
      gl.uniform3fv(this._uMain.uColor, mat.color);
      gl.uniform1f(this._uMain.uRoughness, mat.roughness);
      gl.uniform1f(this._uMain.uMetalness, mat.metalness);
      gl.uniform1f(this._uMain.uFuzz, mat.fuzz);
      gl.uniform1i(this._uMain.uFabric, mat.fabric);
      gl.uniform1f(this._uMain.uOpacity, mat.opacity);
      gl.uniform3fv(this._uMain.uEmissive, mat.emissive);
      gl.uniform1f(this._uMain.uEmissiveIntensity, mat.emissiveIntensity);
      gl.uniform1f(this._uMain.uReceiveShadow, mat.receiveShadow ? 1.0 : 0.0);
      gl.bindVertexArray(gpu.vao);
      gl.drawElements(gl.TRIANGLES, gpu.count, gl.UNSIGNED_SHORT, 0);
    };

    gl.disable(gl.BLEND);
    gl.depthMask(true);
    for (let i = 0; i < opaque.length; i++) drawMesh(opaque[i]);

    if (transparent.length > 0) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      for (let i = 0; i < transparent.length; i++) drawMesh(transparent[i]);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    gl.bindVertexArray(null);
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    const gl = this.gl;
    for (const b of this._allBuffers) {
      gl.deleteVertexArray(b.vao);
      gl.deleteBuffer(b.pBuf);
      gl.deleteBuffer(b.nBuf);
      gl.deleteBuffer(b.uBuf);
      gl.deleteBuffer(b.iBuf);
    }
    this._allBuffers.length = 0;
    if (this._shadowTex) gl.deleteTexture(this._shadowTex);
    if (this._shadowFbo) gl.deleteFramebuffer(this._shadowFbo);
    if (this._mainProg) gl.deleteProgram(this._mainProg);
    if (this._shadowProg) gl.deleteProgram(this._shadowProg);
  }
}
