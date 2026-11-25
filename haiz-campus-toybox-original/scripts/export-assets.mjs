// HAIZ Campus Toybox — Standalone GLB / Texture / Registry Exporter.
// Uses Vite + headless Google Chrome (via playwright-core) so Three.js GLTFExporter runs with
// genuine browser Canvas2D textures and bakes procedural ToyBehavior clips into standard glTF
// AnimationClips.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MODELS_DIR = path.join(ROOT, 'assets', 'models');
const TEX_DIR = path.join(ROOT, 'assets', 'textures');
fs.mkdirSync(MODELS_DIR, { recursive: true });
fs.mkdirSync(TEX_DIR, { recursive: true });

const server = await createServer({
  root: ROOT,
  server: { port: 0, host: '127.0.0.1' },
  logLevel: 'error',
});
await server.listen();
const port = server.httpServer.address().port;
const url = `http://127.0.0.1:${port}/gallery.html`;

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

try {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });

  const exported = await page.evaluate(async () => {
    const { exportAllAssets } = await import('/src/toys/export-helper.js');
    return exportAllAssets();
  });

  const registryOut = {
    spec: exported.spec,
    generatedAt: new Date().toISOString(),
    characters: [],
    textures: [],
  };

  for (const m of exported.models) {
    const buf = Buffer.from(m.glbBase64, 'base64');
    const outPath = path.join(MODELS_DIR, `${m.id}.glb`);
    fs.writeFileSync(outPath, buf);
    const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    const { glbBase64, ...rest } = m;
    registryOut.characters.push({ ...rest, fileSizeBytes: buf.length, sha256 });
    console.log(`Exported ${m.modelPath} (${(buf.length / 1024).toFixed(1)} KB, ${m.stats.triangles} tris, ${m.stats.clips.length} clips)`);
  }

  for (const t of exported.textures) {
    const b64 = t.dataUrl.replace(/^data:image\/png;base64,/, '');
    const buf = Buffer.from(b64, 'base64');
    const outPath = path.join(TEX_DIR, `${t.name}.png`);
    fs.writeFileSync(outPath, buf);
    registryOut.textures.push({ name: t.name, path: `assets/textures/${t.name}.png`, width: t.width, height: t.height, fileSizeBytes: buf.length });
    console.log(`Exported assets/textures/${t.name}.png (${t.width}x${t.height})`);
  }

  fs.writeFileSync(path.join(ROOT, 'assets', 'registry.json'), JSON.stringify(registryOut, null, 2));
  console.log('Wrote assets/registry.json');
} finally {
  await browser.close();
  await server.close();
}
