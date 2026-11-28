/**
 * 墙 · the lamp wall (HAIZ Native 001).
 *
 * The earlier HAIZ wall-light login (login/index.html + src/account/lamp-auth.js: a brick wall
 * at night whose lamp warms as you type, dims on an error and floods on success) is kept as the
 * behaviour; the picture is now computed instead of painted, so the light is real:
 *
 *   - bricks, mortar, bevels and grit are a height field; its normals take the light, so a lamp
 *     grazing the wall from above lights the brick tops and leaves the lower lips in shadow
 *   - each campus identity has its own pendant lamp (after the Whitespace "pendant lamp" study:
 *     grab it, swing it, throw it); its cone sweeps the wall as it swings
 *   - what you type is set into the wall as raised dots of paint (after "dot form"), visible only
 *     where the light reaches them
 *
 * One full-screen fragment shader, drawn only when something changed (a swing, a fade, a new
 * letter) on the app's single clock; a still wall costs nothing.
 */

export type LampState = { x: number; len: number; angle: number; on: number; tone: [number, number, number] };
export const TONES: Record<string, [number, number, number]> = {
  amber: [1.0, 0.70, 0.40],
  ivory: [1.0, 0.86, 0.68],
  jade: [0.70, 1.0, 0.82],
  dusk: [0.86, 0.74, 1.0],
};

const VS = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
const FS = `
precision highp float;
uniform vec2 uRes;            // css px
uniform float uDpr;
uniform float uShift;         // wall pan, css px
uniform vec4 uLamp[4];        // x (wall px), bulb y, angle, intensity
uniform vec3 uTone[4];
uniform float uLen[4];
uniform int uN;
uniform sampler2D uText;      // dot-text mask, wall space
uniform vec4 uTextBox;        // x, y, w, h (wall px)
uniform float uFlood;         // success: the whole wall comes up
uniform float uTime;

float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }

const vec2 BR = vec2(66.0, 27.0);   // brick pitch
const float MORTAR = 3.4;

// height of the wall at p (wall px), and the brick id
float height(vec2 p, out vec2 id){
  float row = floor(p.y / BR.y);
  vec2 q = vec2(p.x + mod(row, 2.0) * BR.x * 0.5, p.y);
  id = floor(q / BR);
  vec2 f = q - id * BR;                       // 0..BR inside the cell
  vec2 e = min(f, BR - f) - MORTAR * 0.5;     // distance to the mortar line
  float edge = min(e.x, e.y);
  float r = h21(id);
  float chip = vnoise(p * 0.55 + r * 17.0) * 1.6;
  float brick = smoothstep(-0.2, 2.6 + r * 1.4, edge - chip * 0.45);
  float face = 1.0 + (vnoise(p * 0.09 + r * 9.0) - 0.5) * 0.35 + (h21(floor(p * 0.9)) - 0.5) * 0.05;
  float mortar = 0.22 + vnoise(p * 0.8) * 0.08;
  return mix(mortar, face, brick);
}

vec3 albedo(vec2 p, vec2 id, float hgt){
  float r = h21(id), r2 = h21(id + 7.1);
  vec3 a = mix(vec3(0.090, 0.150, 0.300), vec3(0.135, 0.205, 0.390), r);      // the navy brick of the old wall
  a = mix(a, vec3(0.20, 0.17, 0.20), step(0.86, r2) * 0.35);                    // the odd weathered brick
  a *= 0.82 + vnoise(p * 0.21 + r * 3.0) * 0.3;
  vec3 m = vec3(0.12, 0.13, 0.15) * (0.8 + vnoise(p * 1.3) * 0.4);
  return mix(m, a, smoothstep(0.3, 0.6, hgt));
}

float dots(vec2 p){
  vec2 uv = (p - uTextBox.xy) / uTextBox.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0;
  const float pitch = 4.6;
  vec2 c = (floor(p / pitch) + 0.5) * pitch;
  vec2 cuv = (c - uTextBox.xy) / uTextBox.zw;
  float m = texture2D(uText, cuv).a;
  float rr = 1.85 * sqrt(m);
  return smoothstep(rr + 0.6, rr - 0.6, length(p - c)) * step(0.06, m);
}

vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

void main(){
  vec2 s = vec2(gl_FragCoord.x, uRes.y * uDpr - gl_FragCoord.y) / uDpr;     // screen css px, y down
  vec2 p = s + vec2(uShift, 0.0);                                            // wall px
  vec2 id, idx, idy;
  float h0 = height(p, id);
  float hx = height(p + vec2(0.9, 0.0), idx), hy = height(p + vec2(0.0, 0.9), idy);
  float paint = dots(p);
  float hp = h0 + paint * 0.5;
  vec3 N = normalize(vec3(-(hx - h0) * 3.4, (hy - h0) * 3.4, 1.0));          // y up in light space
  vec3 alb = mix(albedo(p, id, h0), vec3(0.93, 0.90, 0.84), paint);

  // moonlight: a cold, low ambient from the upper left
  vec3 col = alb * vec3(0.040, 0.058, 0.105) * (0.65 + 0.35 * dot(N, normalize(vec3(-0.4, 0.5, 0.8))));
  col += alb * uFlood * vec3(0.55, 0.47, 0.38);

  for (int i = 0; i < 4; i++) {
    if (i >= uN) break;
    vec4 L = uLamp[i];
    float I = L.w;
    if (I < 0.002) continue;
    float a = L.z;
    vec2 bulb = vec2(L.x, L.y);
    vec3 lp = vec3(bulb.x, -bulb.y, 70.0);                    // the bulb hangs 70 px in front of the wall
    vec3 P = vec3(p.x, -p.y, hp * 6.0);
    vec3 d = lp - P;
    float dist = length(d);
    vec3 l = d / dist;
    vec3 axis = normalize(vec3(sin(a), -cos(a), -0.42));       // down along the cord, tipped toward the wall
    float cosA = dot(-l, axis);
    float cone = smoothstep(0.50, 0.86, cosA);
    float hot = smoothstep(0.80, 0.985, cosA);
    float att = 1.0 / (1.0 + dist * dist / (250.0 * 250.0));
    float dif = max(dot(N, l), 0.0) * 0.7 + 0.3;
    vec3 hv = normalize(l + vec3(0.0, 0.0, 1.0));
    float spec = pow(max(dot(N, hv), 0.0), 28.0) * (0.06 + paint * 0.25);
    vec3 tone = uTone[i];
    col += tone * I * att * (cone * 1.9 + hot * 1.1) * (alb * dif * 2.4 + spec);
    // light that leaks out of the shade's top and the glow around the bulb
    float g = length(p - bulb);
    col += tone * I * (exp(-g / 26.0) * 0.55 + exp(-g / 120.0) * 0.06) * (0.6 + 0.4 * dif);
    col += tone * I * alb * 0.18 * exp(-max(0.0, -(p.y - bulb.y)) / 60.0) * exp(-abs(p.x - bulb.x) / 140.0);
  }

  // vignette, tone map, film grain
  vec2 uv = s / uRes;
  col *= 1.0 - 0.38 * pow(length((uv - vec2(0.5, 0.42)) * vec2(1.1, 0.9)), 1.6);
  col = aces(col * 1.25);
  col = pow(col, vec3(1.0 / 2.2));
  col += (h21(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) * 0.012;
  gl_FragColor = vec4(col, 1.0);
}`;

export class Wall {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private prog: WebGLProgram;
  private U: Record<string, WebGLUniformLocation | null> = {};
  private tex: WebGLTexture;
  private textCanvas = document.createElement("canvas");
  private textBox = [0, 0, 1, 1];
  private w = 1; private h = 1; private dpr = 1;
  lamps: LampState[] = [];
  shift = 0;
  flood = 0;
  lost = false;

  constructor(host: HTMLElement, maxDpr = 1.5) {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "wl-gl";
    host.prepend(this.canvas);
    const gl = this.canvas.getContext("webgl", { antialias: false, alpha: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: "high-performance" });
    if (!gl) throw new Error("no webgl");
    this.gl = gl;
    const sh = (t: number, src: string) => { const s = gl.createShader(t)!; gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader"); return s; };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
    gl.bindAttribLocation(p, 0, "p"); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || "link");
    this.prog = p; gl.useProgram(p);
    for (const n of ["uRes", "uDpr", "uShift", "uLamp", "uTone", "uLen", "uN", "uText", "uTextBox", "uFlood", "uTime"]) this.U[n] = gl.getUniformLocation(p, n);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.setText([]);
    this.canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); this.lost = true; });
    this.maxDpr = maxDpr;
    this.resize();
  }
  private maxDpr: number;

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    this.canvas.width = Math.round(this.w * this.dpr); this.canvas.height = Math.round(this.h * this.dpr);
  }
  get size() { return { w: this.w, h: this.h }; }

  /** lines of text set into the wall as dots, centred at wall-x cx, starting at y */
  setText(lines: { text: string; size: number; weight?: number; family?: string }[], cx = 0, y = 0) {
    const c = this.textCanvas, g = c.getContext("2d")!;
    const W = 1024, H = 256;
    c.width = W; c.height = H;
    g.clearRect(0, 0, W, H);
    let yy = 0, maxW = 1;
    const scale = 2;
    const metrics = lines.map((l) => { g.font = `${l.weight ?? 600} ${l.size * scale}px ${l.family ?? '"Noto Serif SC", serif'}`; return g.measureText(l.text).width; });
    maxW = Math.max(1, ...metrics);
    const totalH = lines.reduce((a, l) => a + l.size * 1.35 * scale, 0) || 1;
    const k = Math.min(1, (W - 8) / maxW, (H - 8) / totalH);
    g.fillStyle = "#fff"; g.textBaseline = "top"; g.textAlign = "center";
    for (const l of lines) { g.font = `${l.weight ?? 600} ${l.size * scale * k}px ${l.family ?? '"Noto Serif SC", serif'}`; g.fillText(l.text, W / 2, yy + 4); yy += l.size * 1.35 * scale * k; }
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    const ww = W / scale / k * k, hh = H / scale;   // wall px covered by the canvas
    this.textBox = [cx - ww / 2, y, ww, hh];
  }

  draw(time = 0) {
    if (this.lost) return;
    const gl = this.gl, U = this.U;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.prog);
    gl.uniform2f(U.uRes, this.w, this.h);
    gl.uniform1f(U.uDpr, this.dpr);
    gl.uniform1f(U.uShift, this.shift);
    const n = Math.min(4, this.lamps.length);
    const lamp = new Float32Array(16), tone = new Float32Array(12), len = new Float32Array(4);
    for (let i = 0; i < n; i++) {
      const l = this.lamps[i];
      lamp.set([l.x + Math.sin(l.angle) * l.len, Math.cos(l.angle) * l.len, l.angle, l.on], i * 4);
      tone.set(l.tone, i * 3); len[i] = l.len;
    }
    gl.uniform4fv(U.uLamp, lamp); gl.uniform3fv(U.uTone, tone); gl.uniform1fv(U.uLen, len);
    gl.uniform1i(U.uN, n);
    gl.uniform4f(U.uTextBox, this.textBox[0], this.textBox[1], this.textBox[2], this.textBox[3]);
    gl.uniform1f(U.uFlood, this.flood);
    gl.uniform1f(U.uTime, time);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex); gl.uniform1i(U.uText, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose() { const ext = this.gl.getExtension("WEBGL_lose_context"); ext?.loseContext(); this.canvas.remove(); }
}
