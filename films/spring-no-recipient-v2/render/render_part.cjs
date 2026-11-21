// node render/render_part.cjs <term|world> <frameStart> <frameEnd(excl)> <out.mkv>
// Renders frames t = i/30 deterministically and pipes PNGs into ffmpeg (x264, near-lossless).
const { chromium } = require('playwright');
const { spawn } = require('child_process');
(async () => {
  const [part, a, b, out] = process.argv.slice(2);
  const f0 = +a, f1 = +b;
  const page = part === 'term' ? 'term.html' : 'index.html';
  const args = part === 'term' ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  const br = await chromium.launch({ args });
  const p = await br.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => console.log('[pageerror]', e.message));
  await p.goto(`http://localhost:8766/spring-no-recipient-v2/film/${page}`);
  await p.waitForFunction('window.ready', null, { timeout: 1200000 });
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '10', '-pix_fmt', 'yuv420p', '-r', '30', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let i = f0; i < f1; i++) {
    await p.evaluate(async t => { await window.renderAt(t); }, i / 30);
    const buf = await p.screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((i - f0) % 30 === 0) console.log(`[${part} ${f0}-${f1}] frame ${i}  ${((Date.now() - t0) / (i - f0 + 1) / 1000).toFixed(2)} s/frame`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await br.close();
  console.log('done', out);
})();
