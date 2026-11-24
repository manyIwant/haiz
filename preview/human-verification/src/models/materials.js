/**
 * HAIZ Human Verification — Procedural PBR Materials, Textures & Geometry Helpers
 * Compatible with Three.js r128 through modern ES builds.
 */

export function createMaterialLibrary(THREE, renderer) {
  const disposables = [];
  const track = (item) => {
    disposables.push(item);
    return item;
  };

  // 1. Procedural velvet/plush micro-fiber bump texture
  const plushBump = track(createPlushBumpTexture(THREE, 256));
  const corduroyBump = track(createCorduroyBumpTexture(THREE, 256));
  const brushedMetalMap = track(createBrushedMetalTexture(THREE, 256));
  const strawBump = track(createStrawWeaveTexture(THREE, 256));

  // 2. Procedural Studio Softbox PMREM Environment Map (for realistic metal, glass & eyes)
  let envMap = null;
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envCanvas = createStudioEnvCanvas();
    const envTex = new THREE.CanvasTexture(envCanvas);
    envTex.mapping = THREE.EquirectangularReflectionMapping;
    if ('colorSpace' in envTex && THREE.SRGBColorSpace) {
      envTex.colorSpace = THREE.SRGBColorSpace;
    } else if (THREE.sRGBEncoding) {
      envTex.encoding = THREE.sRGBEncoding;
    }
    const rt = pmrem.fromEquirectangular(envTex);
    envMap = rt.texture;
    disposables.push(rt, envTex, pmrem);
  } catch (_e) {
    envMap = null;
  }

  function makePlush(hex, opts = {}) {
    const mat = new THREE.MeshStandardMaterial({
      color: hex,
      roughness: opts.roughness !== undefined ? opts.roughness : 0.88,
      metalness: opts.metalness !== undefined ? opts.metalness : 0.02,
      bumpMap: opts.corduroy ? corduroyBump : opts.straw ? strawBump : plushBump,
      bumpScale: opts.bumpScale !== undefined ? opts.bumpScale : 0.018,
      envMap,
      envMapIntensity: 0.25,
      map: opts.map || null
    });
    return track(mat);
  }

  function makeSatinPlastic(hex, roughness = 0.26) {
    return track(
      new THREE.MeshStandardMaterial({
        color: hex,
        roughness,
        metalness: 0.05,
        envMap,
        envMapIntensity: 0.75
      })
    );
  }

  function makeBrushedMetal(hex = 0xd6dce2, roughness = 0.24, metalness = 0.88) {
    return track(
      new THREE.MeshStandardMaterial({
        color: hex,
        roughness,
        metalness,
        bumpMap: brushedMetalMap,
        bumpScale: 0.008,
        envMap,
        envMapIntensity: 1.25
      })
    );
  }

  const eyeBlack = track(
    new THREE.MeshStandardMaterial({
      color: 0x15171c,
      roughness: 0.06,
      metalness: 0.12,
      envMap,
      envMapIntensity: 1.6
    })
  );

  const eyeHighlight = track(
    new THREE.MeshBasicMaterial({
      color: 0xffffff
    })
  );

  const cheekBlush = track(
    new THREE.MeshStandardMaterial({
      color: 0xf29c96,
      roughness: 0.92,
      metalness: 0.0,
      transparent: true,
      opacity: 0.62
    })
  );

  return {
    envMap,
    plushBump,
    corduroyBump,
    brushedMetalMap,
    strawBump,
    eyeBlack,
    eyeHighlight,
    cheekBlush,
    makePlush,
    makeSatinPlastic,
    makeBrushedMetal,
    track,
    dispose() {
      disposables.forEach((d) => {
        try {
          if (d && typeof d.dispose === 'function') d.dispose();
        } catch (_e) {}
      });
      disposables.length = 0;
    }
  };
}

function createStudioEnvCanvas() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#ffffff');
  grad.addColorStop(0.28, '#f1f3f7');
  grad.addColorStop(0.52, '#dde2ea');
  grad.addColorStop(0.75, '#c7cdd6');
  grad.addColorStop(1.0, '#a6aeb9');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Overhead studio softbox panels
  ctx.fillStyle = 'rgba(255, 252, 244, 0.95)';
  ctx.fillRect(60, 18, 160, 52);
  ctx.fillStyle = 'rgba(226, 240, 255, 0.85)';
  ctx.fillRect(290, 26, 150, 44);
  ctx.fillStyle = 'rgba(255, 246, 232, 0.55)';
  ctx.fillRect(190, 110, 130, 32);
  return c;
}

function createPlushBumpTexture(THREE, size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < data.length; i += 4) {
    const v = 112 + Math.floor(rand() * 34);
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // Subtle micro-fibers
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 420; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const a = rand() * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * 4, y + Math.sin(a) * 4);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

function createCorduroyBumpTexture(THREE, size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#7c7c7c';
  ctx.fillRect(0, 0, size, size);
  const ribs = 32;
  const step = size / ribs;
  for (let i = 0; i < ribs; i++) {
    const g = ctx.createLinearGradient(i * step, 0, (i + 1) * step, 0);
    g.addColorStop(0, '#505050');
    g.addColorStop(0.5, '#cfcfcf');
    g.addColorStop(1, '#505050');
    ctx.fillStyle = g;
    ctx.fillRect(i * step, 0, step, size);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

function createBrushedMetalTexture(THREE, size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  let seed = 4242;
  const rand = () => {
    seed = (seed * 48271) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let y = 0; y < size; y++) {
    const shade = 114 + Math.floor(rand() * 28);
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.fillRect(0, y, size, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

function createStrawWeaveTexture(THREE, size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#909090';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#c8c8c8';
  ctx.lineWidth = 3;
  for (let y = 0; y < size; y += 10) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }
  ctx.strokeStyle = '#686868';
  ctx.lineWidth = 2;
  for (let x = 0; x < size; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

/**
 * Version-independent smooth CapsuleGeometry via LatheGeometry (works in Three.js r128+).
 */
export function createCapsuleGeometry(THREE, radius = 0.2, length = 0.4, capSegs = 8, radSegs = 20) {
  const pts = [];
  const half = length * 0.5;
  for (let i = 0; i <= capSegs; i++) {
    const a = -Math.PI / 2 + (i / capSegs) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.max(0.001, Math.cos(a) * radius), -half + Math.sin(a) * radius));
  }
  for (let i = 0; i <= capSegs; i++) {
    const a = (i / capSegs) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.max(0.001, Math.cos(a) * radius), half + Math.sin(a) * radius));
  }
  return new THREE.LatheGeometry(pts, radSegs);
}

/**
 * Glossy dark toy eye with dual crisp specular catchlights.
 */
export function createGlassEye(THREE, matLib, radius = 0.044) {
  const group = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(radius, 18, 16), matLib.eyeBlack);
  group.add(ball);
  const glint1 = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.30, 10, 10), matLib.eyeHighlight);
  glint1.position.set(radius * 0.32, radius * 0.34, radius * 0.82);
  group.add(glint1);
  const glint2 = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.14, 8, 8), matLib.eyeHighlight);
  glint2.position.set(-radius * 0.22, -radius * 0.20, radius * 0.90);
  group.add(glint2);
  return group;
}

export function createCheekBlush(THREE, matLib, rx = 0.052, ry = 0.032) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 12), matLib.cheekBlush);
  mesh.scale.set(rx, ry, 0.015);
  return mesh;
}
