// node render/render_part.cjs <term|world> <frameStart> <frameEnd(excl)> <outdir>
// Renders frames t = i/30 deterministically to <outdir>/NNNNN.png. Resumable: existing frames
// are skipped, so a crashed or interrupted worker can simply be started again.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [part, a, b, out] = process.argv.slice(2);
  const f0 = +a, f1 = +b;
  fs.mkdirSync(out, { recursive: true });
  const todo = []; for (let i = f0; i < f1; i++) if (!fs.existsSync(`${out}/${String(i).padStart(5, '0')}.png`)) todo.push(i);
  if (!todo.length) { console.log('nothing to do', out); return; }
  const page = part === 'term' ? 'term.html' : 'index.html';
  const args = part === 'term' ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  const br = await chromium.launch({ args });
  const p = await br.newPage({ viewport: { width: 1920, height: 1080 } });
  p.setDefaultTimeout(600000);
  p.on('pageerror', e => console.log('[pageerror]', e.message));
  await p.goto(`http://localhost:8766/spring-no-recipient-v2/film/${page}`);
  await p.waitForFunction('window.ready', null, { timeout: 1800000 });
  const t0 = Date.now(); let n = 0;
  for (const i of todo) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await p.evaluate(async t => { await window.renderAt(t); }, i / 30);
        const file = `${out}/${String(i).padStart(5, '0')}.png`;
        await p.screenshot({ path: file + '.tmp.png', type: 'png', timeout: 600000 });
        fs.renameSync(file + '.tmp.png', file);
        break;
      } catch (e) { console.log('retry', i, e.message.slice(0, 120)); }
    }
    n++;
    if (n % 30 === 1) console.log(`[${part} ${f0}-${f1}] frame ${i}  ${((Date.now() - t0) / n / 1000).toFixed(2)} s/frame  (${todo.length - n} left)`);
  }
  await br.close();
  console.log('done', out);
})();
