/**
 * Minimal pure-ESM Radiance RGBE (.hdr) decoder -> HalfFloat RGBA DataTexture -> PMREM IBL.
 * Enables loading HAIZ's calibrated `assets/walk/textures/campus-light.hdr` natively in
 * ES module Three.js scenes with zero UMD shim overhead.
 */
import * as THREE from 'three';

export async function loadHdrEnvironment(url, renderer) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HDR load failed (${res.status}): ${url}`);
  const buf = new Uint8Array(await res.arrayBuffer());

  // Parse ASCII header lines up to empty line + resolution line
  let pos = 0;
  const readLine = () => {
    const start = pos;
    while (pos < buf.length && buf[pos] !== 10) pos++;
    const line = new TextDecoder().decode(buf.subarray(start, pos)).replace(/\r$/, '');
    if (pos < buf.length && buf[pos] === 10) pos++;
    return line;
  };

  let header = readLine();
  if (!header.startsWith('#?')) throw new Error('Invalid Radiance HDR header');
  while (pos < buf.length) {
    const line = readLine();
    if (line === '') break;
  }
  const sizeLine = readLine();
  const match = /-Y\s+(\d+)\s+\+X\s+(\d+)/i.exec(sizeLine);
  if (!match) throw new Error(`Unsupported HDR resolution line: ${sizeLine}`);
  const height = Number(match[1]);
  const width = Number(match[2]);

  const out = new Uint16Array(width * height * 4);
  const scan = new Uint8Array(width * 4);
  const oneHalf = THREE.DataUtils.toHalfFloat(1.0);

  for (let y = 0; y < height; y++) {
    // Support standard RGBE RLE scanlines & raw uncompressed scanlines
    const b0 = buf[pos];
    const b1 = buf[pos + 1];
    const b2 = buf[pos + 2];
    const b3 = buf[pos + 3];
    if (width >= 8 && width <= 0x7fff && b0 === 2 && b1 === 2 && ((b2 << 8) | b3) === width) {
      pos += 4;
      for (let ch = 0; ch < 4; ch++) {
        let ptr = 0;
        const chOff = ch * width;
        while (ptr < width) {
          const code = buf[pos++];
          if (code > 128) {
            const count = code - 128;
            const val = buf[pos++];
            scan.fill(val, chOff + ptr, chOff + ptr + count);
            ptr += count;
          } else {
            const count = code;
            scan.set(buf.subarray(pos, pos + count), chOff + ptr);
            pos += count;
            ptr += count;
          }
        }
      }
    } else {
      for (let x = 0; x < width; x++) {
        scan[x] = buf[pos++];
        scan[width + x] = buf[pos++];
        scan[2 * width + x] = buf[pos++];
        scan[3 * width + x] = buf[pos++];
      }
    }

    // Flip Y for WebGL DataTexture upload & convert RGBE -> HalfFloat RGBA
    const dstRow = (height - 1 - y) * width * 4;
    for (let x = 0; x < width; x++) {
      const r = scan[x];
      const g = scan[width + x];
      const b = scan[2 * width + x];
      const e = scan[3 * width + x];
      const d = dstRow + x * 4;
      if (e > 0) {
        const f = Math.ldexp ? Math.ldexp(1.0, e - (128 + 8)) : Math.pow(2.0, e - (128 + 8));
        out[d] = THREE.DataUtils.toHalfFloat(r * f);
        out[d + 1] = THREE.DataUtils.toHalfFloat(g * f);
        out[d + 2] = THREE.DataUtils.toHalfFloat(b * f);
      } else {
        out[d] = 0;
        out[d + 1] = 0;
        out[d + 2] = 0;
      }
      out[d + 3] = oneHalf;
    }
  }

  const tex = new THREE.DataTexture(out, width, height, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envRT = pmrem.fromEquirectangular(tex);
  tex.dispose();
  pmrem.dispose();
  return envRT;
}
