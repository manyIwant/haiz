// 抽出一年 · the wood, drawn on the GPU.
//
// Two programs share one table of days (one texel per day, one row per year):
//   disc    the cross-section, per pixel: polar position → (fisheye/gap LUT) → ring → day.
//           Same rules as lanren/rings/disc.js paint(), which this ports to a shader so the
//           rings can swell under the finger and close up around a pulled-out year.
//   ribbon  one year as a band of wood: a triangle strip whose centre line is moved every
//           frame by the physics in app.js. Because both programs read the same texels, a
//           year looks exactly the same in the trunk, in your hand and laid out flat.

const DISC_VS = `#version 300 es
in vec2 aPos;
uniform vec2 uRes;
out vec2 vPx;
void main() {
  vPx = aPos;
  vec2 c = aPos / uRes * 2.0 - 1.0;
  gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
}`;

const DISC_FS = `#version 300 es
precision highp float;
precision highp int;
in vec2 vPx;
out vec4 frag;
uniform sampler2D uData;   // rgb: colour of the day; a: 255 day, 120 future, 60 blank year, 0 none
uniform sampler2D uFlags;  // r: first of a month, g: knot, b: gale scar
uniform sampler2D uLUT;    // screen radius → original radius (R32F); < -0.5 = groove
uniform sampler2D uEdges;  // original ring edges (R32F)
uniform int uNR;
uniform int uLutN;
uniform float uLutMax;
uniform vec2 uCenter;
uniform float uR;          // px per disc unit
uniform float uRot;
uniform float uHover;      // ring index under the pointer, -1 none
uniform float uHoverAmt;
uniform float uPulled;     // ring that has left the trunk, -1 none
uniform float uDim;
uniform float uAlpha;
uniform float uYear0;

const float TAU = 6.28318530718;
const float PITH = 0.035;
const float BARK = 0.05;

float wobble(float th) { return 1.0 + 0.030 * sin(2.0 * th + 0.6) + 0.017 * sin(5.0 * th + 2.1) + 0.009 * sin(9.0 * th + 4.0); }
float hash(float x, float y) { float s = sin(x * 127.1 + y * 311.7) * 43758.5453; return fract(s); }
float edge(int k) { return texelFetch(uEdges, ivec2(k, 0), 0).r; }
float lut(float rs) {
  float f = clamp(rs / uLutMax, 0.0, 1.0) * float(uLutN - 1);
  int i = int(floor(f));
  int j = min(i + 1, uLutN - 1);
  float a = texelFetch(uLUT, ivec2(i, 0), 0).r, b = texelFetch(uLUT, ivec2(j, 0), 0).r;
  if (a < -0.5 || b < -0.5) return -1.0;
  return mix(a, b, f - float(i));
}
bool leap(int y) { return (y % 4 == 0 && y % 100 != 0) || y % 400 == 0; }

void main() {
  vec2 d = (vPx - uCenter) / uR;
  float rr = length(d);
  float th = mod(atan(d.x, -d.y) - uRot + TAU * 2.0, TAU);
  float w = wobble(th);
  float rs = rr / w;
  float outer = edge(uNR);
  // a soft shadow cast down-right onto the paper
  vec2 ds = d - vec2(0.018, 0.035);
  float shadow = (1.0 - smoothstep(0.92, 1.16, length(ds) / wobble(th))) * 0.30;
  vec4 col = vec4(0.0);
  float rn = lut(rs);
  if (rs > outer + BARK + 0.02 && rn > outer + BARK) { frag = vec4(0.0, 0.0, 0.0, shadow * uAlpha); return; }
  if (rn < -0.5) {
    // the groove a pulled-out year leaves behind
    col = vec4(vec3(0.20, 0.13, 0.09), 1.0);
  } else if (rn >= outer) {
    float depth = (rn - outer) / BARK;
    float rag = 0.78 + 0.22 * hash(floor(th * 220.0), 3.0) + 0.1 * sin(th * 37.0);
    if (depth > rag) { frag = vec4(0.0, 0.0, 0.0, shadow * uAlpha); return; }
    float n = hash(floor(th * 520.0), floor(depth * 9.0));
    float l = 0.55 + 0.45 * n - depth * 0.25;
    col = vec4(vec3(58.0 * l + 16.0, 40.0 * l + 11.0, 29.0 * l + 9.0) / 255.0, clamp((rag - depth) * 12.0, 0.0, 1.0));
  } else if (rn < edge(0)) {
    col = vec4(96.0 / 255.0, 66.0 / 255.0, 44.0 / 255.0, 1.0);
  } else {
    int lo = 0, hi = uNR - 1;
    for (int it = 0; it < 8; it++) {
      if (lo >= hi) break;
      int mid = (lo + hi + 1) / 2;
      if (edge(mid) <= rn) lo = mid; else hi = mid - 1;
    }
    int y = int(uYear0) + lo;
    int len = leap(y) ? 366 : 365;
    int day = min(len - 1, int(floor(th / TAU * float(len))));
    vec4 t = texelFetch(uData, ivec2(day, lo), 0);
    vec4 fl = texelFetch(uFlags, ivec2(day, lo), 0);
    vec3 c = t.rgb;
    float a = 1.0;
    if (t.a < 0.3) { c = vec3(226.0, 213.0, 188.0) / 255.0; a = 0.62; }
    else if (t.a < 0.6) { c = vec3(221.0, 226.0, 190.0) / 255.0; a = 0.45; }
    // the line where one year stops and the next begins, a little stronger each decade
    float e0 = edge(lo), e1 = edge(lo + 1);
    float fw = max(fwidth(rn), 1e-6);
    float dIn = (rn - e0) / fw, dOut = (e1 - rn) / fw;
    float thick = (e1 - e0) / fw;
    if (thick > 2.2) {
      if (dIn < 0.9) c *= (y % 10 == 0) ? 0.6 : 0.82;
      else if (dOut < 0.4) c *= 0.93;
    }
    if (fl.g > 0.5) c *= 0.55;                  // a dated event: a knot
    else if (fl.g > 0.2) c *= 0.78;             // only the month is known: a streak
    c *= 0.965 + 0.07 * hash(floor(th * 900.0), 7.0);
    if (float(lo) == uHover) {
      c = mix(c, vec3(1.0, 0.97, 0.9), 0.32 * uHoverAmt);
      if (thick > 3.0 && (dIn < 1.2 || dOut < 1.2)) c = mix(c, vec3(0.15, 0.08, 0.04), 0.8 * uHoverAmt);
    }
    col = vec4(c, a);
  }
  col.rgb *= 1.0 - uDim;
  float alpha = col.a * uAlpha;
  // over the shadow
  float sa = shadow * uAlpha * (1.0 - alpha);
  frag = vec4(col.rgb * alpha, alpha + sa);
}`;

const RIB_VS = `#version 300 es
in vec2 aCenter;
in vec2 aNormal;
in float aU;
in float aV;
in float aHalf;
uniform vec2 uRes;
uniform vec2 uOffset;
uniform float uWidthScale;
out float vU;
out float vV;
out float vHalf;
void main() {
  vU = aU; vV = aV; vHalf = aHalf * uWidthScale;
  vec2 p = aCenter + aNormal * aV * aHalf * uWidthScale + uOffset;
  vec2 c = p / uRes * 2.0 - 1.0;
  gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
}`;

const RIB_FS = `#version 300 es
precision highp float;
in float vU;
in float vV;
in float vHalf;
out vec4 frag;
uniform sampler2D uData;
uniform sampler2D uFlags;
uniform float uRow;
uniform float uLen;
uniform float uShadow;   // 0 wood, >0 the shadow pass (its opacity)
uniform float uAlpha;
uniform float uFocusDay; // the day under the pointer, -1 none
uniform float uSelDay;   // the day that is open, -1 none

float hash(float x, float y) { float s = sin(x * 127.1 + y * 311.7) * 43758.5453; return fract(s); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float a = hash(i.x, i.y), b = hash(i.x + 1.0, i.y), c = hash(i.x, i.y + 1.0), d = hash(i.x + 1.0, i.y + 1.0);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

void main() {
  float av = abs(vV);
  float aa = max(fwidth(vV) * 1.2, 1e-4);
  if (uShadow > 0.0) {
    float s = (1.0 - smoothstep(0.15, 1.0, av)) * uShadow * uAlpha;
    frag = vec4(0.0, 0.0, 0.0, s);
    return;
  }
  float edgeA = 1.0 - smoothstep(1.0 - aa, 1.0, av);
  float day = clamp(floor(vU), 0.0, uLen - 1.0);
  vec4 t = texelFetch(uData, ivec2(int(day), int(uRow)), 0);
  vec4 fl = texelFetch(uFlags, ivec2(int(day), int(uRow)), 0);
  vec3 c = t.rgb;
  if (t.a < 0.3) c = vec3(0.89, 0.84, 0.74);
  else if (t.a < 0.6) c = vec3(0.87, 0.88, 0.76);
  // fibres run along the band: it was cut along the ring
  float fib = noise(vec2(vU * 0.08, vV * 9.0 + noise(vec2(vU * 0.02, 0.0)) * 3.0));
  c *= 0.93 + 0.1 * fib;
  // a rounded plank: lighter along the crown, darker at the two edges
  c *= 0.84 + 0.2 * (1.0 - av * av) + 0.05 * smoothstep(0.2, -0.9, vV);
  float pxPerDay = 1.0 / max(fwidth(vU), 1e-4);
  float fu = fract(vU);
  float px = min(fu, 1.0 - fu) * pxPerDay;
  if (pxPerDay > 6.0) c *= mix(1.0, 0.82, (1.0 - smoothstep(0.0, 1.0, px)) * smoothstep(6.0, 14.0, pxPerDay));
  if (fl.r > 0.5 && fu * pxPerDay < 1.4) c *= 0.55;   // the first day of a month
  // knots: a tiny cross-section inside the band — the rings again, in a single day
  if (fl.g > 0.5) {
    float dx = (fu - 0.5) * pxPerDay;
    float dy = vV * vHalf;
    float rad = min(vHalf * 0.62, 4.0 + pxPerDay * 0.38);
    float r = length(vec2(dx, dy * 1.25)) / rad;
    if (r < 1.0) c *= 0.5 + 0.22 * (0.5 + 0.5 * cos(r * 18.0)) + 0.18 * r;
    else if (r < 1.6) c *= 0.85 + 0.15 * smoothstep(1.0, 1.6, r);
  } else if (fl.g > 0.2) {
    c *= 1.0 - 0.28 * (1.0 - smoothstep(0.25, 0.6, av));
  }
  if (fl.b > 0.5) c *= 0.8 - 0.25 * (1.0 - smoothstep(0.0, 0.5, abs(vV + 0.2 * sin(vU * 3.0))));
  if (day == uFocusDay) c = mix(c, vec3(1.0, 0.98, 0.92), 0.22);
  if (day == uSelDay) {
    float ring = 1.0 - smoothstep(0.0, 1.5, min(px, (1.0 - av) * vHalf));
    c = mix(c, vec3(1.0, 0.97, 0.88), 0.18);
    c = mix(c, vec3(0.12, 0.07, 0.04), ring);
  }
  float a = edgeA * uAlpha * (t.a < 0.3 ? 0.9 : 1.0);
  frag = vec4(c * a, a);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}

export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: true, alpha: true });
  if (!gl) return null;
  gl.getExtension('OES_texture_float_linear');
  const disc = program(gl, DISC_VS, DISC_FS);
  const rib = program(gl, RIB_VS, RIB_FS);
  const quad = gl.createBuffer();
  const ribBuf = gl.createBuffer();
  const tex = {};
  const STRIDE = 7; // cx, cy, nx, ny, u, v, half

  function texture(name, w, h, internal, format, type, data, unit) {
    if (!tex[name]) tex[name] = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex[name]);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  function bindAll() {
    const order = ['data', 'flags', 'lut', 'edges'];
    order.forEach((n, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex[n]); });
  }

  let W = 1, H = 1, nRings = 0, year0 = 1923, lutN = 0;
  const api = {
    gl,
    resize(w, h, dpr) {
      W = w; H = h;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      gl.viewport(0, 0, canvas.width, canvas.height);
    },
    setDays(data, flags, cols, rows, firstYear) {
      nRings = rows; year0 = firstYear;
      texture('data', cols, rows, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, data, 0);
      texture('flags', cols, rows, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, flags, 1);
    },
    setEdges(edges) { texture('edges', edges.length, 1, gl.R32F, gl.RED, gl.FLOAT, edges, 3); },
    setLUT(lutArr) { lutN = lutArr.length; texture('lut', lutN, 1, gl.R32F, gl.RED, gl.FLOAT, lutArr, 2); },
    clear() {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    },
    drawDisc(o) {
      const { cx, cy, R } = o;
      const s = R * 1.25;
      const x0 = cx - s, y0 = cy - s, x1 = cx + s, y1 = cy + s;
      gl.useProgram(disc.p);
      bindAll();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([x0, y0, x1, y0, x0, y1, x1, y1]), gl.DYNAMIC_DRAW);
      const loc = gl.getAttribLocation(disc.p, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const u = disc.u;
      gl.uniform2f(u.uRes, W, H);
      gl.uniform1i(u.uData, 0); gl.uniform1i(u.uFlags, 1); gl.uniform1i(u.uLUT, 2); gl.uniform1i(u.uEdges, 3);
      gl.uniform1i(u.uNR, nRings); gl.uniform1i(u.uLutN, lutN); gl.uniform1f(u.uLutMax, o.lutMax);
      gl.uniform2f(u.uCenter, cx, cy); gl.uniform1f(u.uR, R); gl.uniform1f(u.uRot, o.rot || 0);
      gl.uniform1f(u.uHover, o.hover ?? -1); gl.uniform1f(u.uHoverAmt, o.hoverAmt ?? 0);
      gl.uniform1f(u.uPulled, o.pulled ?? -1); gl.uniform1f(u.uDim, o.dim ?? 0); gl.uniform1f(u.uAlpha, o.alpha ?? 1);
      gl.uniform1f(u.uYear0, year0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.disableVertexAttribArray(loc);
    },
    /** nodes: Float32Array of [x, y] centre points; normals likewise; half: Float32Array; u: day coordinate per node */
    drawRibbon(o) {
      const { nodes, normals, half, us, n } = o;
      const buf = new Float32Array(n * 2 * STRIDE);
      for (let i = 0; i < n; i++) {
        for (let s = 0; s < 2; s++) {
          const b = (i * 2 + s) * STRIDE;
          buf[b] = nodes[i * 2]; buf[b + 1] = nodes[i * 2 + 1];
          buf[b + 2] = normals[i * 2]; buf[b + 3] = normals[i * 2 + 1];
          buf[b + 4] = us[i]; buf[b + 5] = s ? 1 : -1; buf[b + 6] = half[i];
        }
      }
      gl.useProgram(rib.p);
      bindAll();
      gl.bindBuffer(gl.ARRAY_BUFFER, ribBuf);
      gl.bufferData(gl.ARRAY_BUFFER, buf, gl.DYNAMIC_DRAW);
      const names = [['aCenter', 2, 0], ['aNormal', 2, 2], ['aU', 1, 4], ['aV', 1, 5], ['aHalf', 1, 6]];
      const locs = names.map(([nm, size, off]) => {
        const l = gl.getAttribLocation(rib.p, nm);
        gl.enableVertexAttribArray(l);
        gl.vertexAttribPointer(l, size, gl.FLOAT, false, STRIDE * 4, off * 4);
        return l;
      });
      const u = rib.u;
      gl.uniform2f(u.uRes, W, H);
      gl.uniform1i(u.uData, 0); gl.uniform1i(u.uFlags, 1);
      gl.uniform1f(u.uRow, o.row); gl.uniform1f(u.uLen, o.len);
      gl.uniform1f(u.uAlpha, o.alpha ?? 1);
      gl.uniform1f(u.uFocusDay, o.focusDay ?? -1); gl.uniform1f(u.uSelDay, o.selDay ?? -1);
      // shadow first, lifted a little higher the further the band is from the paper
      const lift = o.lift ?? 0.5;
      gl.uniform1f(u.uShadow, 0.18 + 0.16 * lift);
      gl.uniform2f(u.uOffset, 3 + 6 * lift, 5 + 14 * lift);
      gl.uniform1f(u.uWidthScale, 1.25 + 0.5 * lift);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, n * 2);
      gl.uniform1f(u.uShadow, 0);
      gl.uniform2f(u.uOffset, 0, 0);
      gl.uniform1f(u.uWidthScale, 1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, n * 2);
      locs.forEach((l) => gl.disableVertexAttribArray(l));
    }
  };
  return api;
}
