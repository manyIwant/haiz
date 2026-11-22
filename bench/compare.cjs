#!/usr/bin/env node
// Compare two bench/home-bench.cjs runs: timings, draw calls, and the stills
// pixel by pixel (no image library needed: the comparison runs in Chromium).
//
//   node bench/compare.cjs bench/results/baseline bench/results/optimized [--out bench/results/compare.md]
//
// Image metrics per chapter: PSNR (dB, higher is closer; ∞ = identical),
// mean absolute error in 8-bit levels, and the share of pixels whose largest
// channel difference exceeds 2 and 8 levels. A diff heat map (×8 gain) is
// written next to the "after" stills.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const [aDir, bDir] = process.argv.slice(2).filter((x) => !x.startsWith('--'));
const outIdx = process.argv.indexOf('--out');
if (!aDir || !bDir) { console.error('usage: compare.cjs <before-dir> <after-dir> [--out file.md]'); process.exit(2); }
// a full bench report, or only stills (bench/stills.cjs)
const read = (d) => JSON.parse(fs.readFileSync(path.join(d, fs.existsSync(path.join(d, 'report.json')) && !process.argv.includes('--stills') ? 'report.json' : 'stills.json')));
const A = read(aDir), B = read(bDir);
const out = outIdx > 0 ? process.argv[outIdx + 1] : path.join(bDir, 'compare.md');

const pct = (a, b) => (a ? ((b - a) / a * 100).toFixed(1) + '%' : 'n/a');
const dataUrl = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const lines = [];
  lines.push(`# Homepage bench: \`${A.label}\` (${A.commit}) → \`${B.label}\` (${B.commit})`, '');
  if (B.environment) lines.push(`Environment: ${B.environment.gl}, ${B.environment.viewport} @${B.environment.dpr}x, CPU throttle ${B.environment.cpuThrottle}×, ${B.environment.cores} cores.`);
  if (B.caveat) lines.push('', `> ${B.caveat}`, '');
  for (const tb of B.tiers) {
    const ta = A.tiers.find((t) => t.quality === tb.quality);
    if (!ta) continue;
    lines.push(`## Tier \`${tb.quality}\``, '');
    if (ta.load && tb.load) {
    lines.push('| | before | after | Δ |', '|---|---:|---:|---:|');
    lines.push(`| time to ready (ms) | ${ta.load.readyMs} | ${tb.load.readyMs} | ${pct(ta.load.readyMs, tb.load.readyMs)} |`);
    lines.push(`| scroll frame p50 (ms) | ${ta.scroll.ms.p50} | ${tb.scroll.ms.p50} | ${pct(ta.scroll.ms.p50, tb.scroll.ms.p50)} |`);
    lines.push(`| scroll frame p90 (ms) | ${ta.scroll.ms.p90} | ${tb.scroll.ms.p90} | ${pct(ta.scroll.ms.p90, tb.scroll.ms.p90)} |`);
    lines.push(`| scroll frame max (ms) | ${ta.scroll.ms.max} | ${tb.scroll.ms.max} | ${pct(ta.scroll.ms.max, tb.scroll.ms.max)} |`);
    lines.push(`| environment bakes during scroll | ${ta.scroll.bakes} | ${tb.scroll.bakes} | |`);
    lines.push(`| environment bake time during scroll (ms) | ${ta.scroll.bakeMsTotal} | ${tb.scroll.bakeMsTotal} | ${pct(ta.scroll.bakeMsTotal, tb.scroll.bakeMsTotal)} |`);
    if (ta.jsStep && tb.jsStep) lines.push(`| simulation-only step p50 (ms, CPU-throttled) | ${ta.jsStep.p50} | ${tb.jsStep.p50} | ${pct(ta.jsStep.p50, tb.jsStep.p50)} |`);
    lines.push(`| textures / geometries | ${ta.memory.textures} / ${ta.memory.geometries} | ${tb.memory.textures} / ${tb.memory.geometries} | |`);
    lines.push(`| JS heap (MB) | ${ta.memory.jsHeapMB} | ${tb.memory.jsHeapMB} | |`, '');
    lines.push('| chapter | frame p50 before | after | Δ | draw calls before → after | post passes before → after |', '|---|---:|---:|---:|---|---|');
    for (const cb of tb.chapters) {
      const ca = ta.chapters.find((c) => c.chapter === cb.chapter);
      lines.push(`| ${cb.chapter + 1} | ${ca.ms.p50} | ${cb.ms.p50} | ${pct(ca.ms.p50, cb.ms.p50)} | ${ca.calls} → ${cb.calls} | ${ca.passes.length} → ${cb.passes.length} |`);
    }
    lines.push('');
    }
    if (tb.shots?.length && ta.shots?.length) {
      var sheet = [];
      lines.push('| still | PSNR (dB) | mean abs error (levels) | px > 2 levels | px > 8 levels |', '|---|---:|---:|---:|---:|');
      for (let i = 0; i < tb.shots.length; i++) {
        const fa = path.resolve(__dirname, '..', ta.shots[i]), fb = path.resolve(__dirname, '..', tb.shots[i]);
        if (!fs.existsSync(fa) || !fs.existsSync(fb)) continue;
        const r = await page.evaluate(async ([a, b]) => {
          const load = (src) => new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = src; });
          const [ia, ib] = await Promise.all([load(a), load(b)]);
          const w = Math.min(ia.width, ib.width), h = Math.min(ia.height, ib.height);
          const px = (im) => { const c = new OffscreenCanvas(w, h), g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, w, h).data; };
          const da = px(ia), db = px(ib);
          const c = new OffscreenCanvas(w, h), g = c.getContext('2d'), heat = g.createImageData(w, h);
          let se = 0, ae = 0, over2 = 0, over8 = 0;
          for (let k = 0; k < da.length; k += 4) {
            let m = 0;
            for (let ch = 0; ch < 3; ch++) { const d = da[k + ch] - db[k + ch]; se += d * d; ae += Math.abs(d); m = Math.max(m, Math.abs(d)); }
            if (m > 2) over2++; if (m > 8) over8++;
            const v = Math.min(255, m * 8);
            heat.data[k] = v; heat.data[k + 1] = v * 0.35; heat.data[k + 2] = 0; heat.data[k + 3] = 255;
          }
          g.putImageData(heat, 0, 0);
          const blob = await c.convertToBlob({ type: 'image/png' });
          const buf = new Uint8Array(await blob.arrayBuffer());
          let bin = ''; for (let k = 0; k < buf.length; k += 0x8000) bin += String.fromCharCode(...buf.subarray(k, k + 0x8000));
          const n = w * h, mse = se / (n * 3);
          return { psnr: mse === 0 ? Infinity : 10 * Math.log10(255 * 255 / mse), mae: ae / (n * 3), over2: over2 / n, over8: over8 / n, heat: btoa(bin) };
        }, [dataUrl(fa), dataUrl(fb)]);
        const heatFile = fb.replace(/\.png$/, '.diff.png');
        fs.writeFileSync(heatFile, Buffer.from(r.heat, 'base64'));
        sheet.push([fa, fb, heatFile]);
        lines.push(`| ${path.basename(fb)} | ${r.psnr === Infinity ? '∞ (identical)' : r.psnr.toFixed(1)} | ${r.mae.toFixed(3)} | ${(r.over2 * 100).toFixed(2)}% | ${(r.over8 * 100).toFixed(3)}% |`);
      }
      lines.push('');
      // a small contact sheet (before | after | diff ×8) that can live in the repository
      if (sheet.length) {
        const jpg = await page.evaluate(async (rows) => {
          const load = (src) => new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = src; });
          const ims = await Promise.all(rows.flat().map(load));
          const W = 180, H = Math.round(W * ims[0].height / ims[0].width), gap = 4;
          const c = new OffscreenCanvas(3 * W + 4 * gap, rows.length * (H + gap) + gap), g = c.getContext('2d');
          g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height);
          ims.forEach((im, k) => g.drawImage(im, gap + (k % 3) * (W + gap), gap + Math.floor(k / 3) * (H + gap), W, H));
          const blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.82 });
          const buf = new Uint8Array(await blob.arrayBuffer());
          let bin = ''; for (let k = 0; k < buf.length; k += 0x8000) bin += String.fromCharCode(...buf.subarray(k, k + 0x8000));
          return btoa(bin);
        }, sheet.map((row) => row.map(dataUrl)));
        const f = path.join(path.dirname(out), `contact-${tb.quality}.jpg`);
        fs.writeFileSync(f, Buffer.from(jpg, 'base64'));
        lines.push(`![${tb.quality}: before | after | difference ×8](${path.basename(f)})`, '');
      }
    }
  }
  await browser.close();
  fs.writeFileSync(out, lines.join('\n') + '\n');
  console.log(lines.join('\n'));
  console.log('\nwrote ' + out);
})().catch((e) => { console.error(e); process.exitCode = 1; });
