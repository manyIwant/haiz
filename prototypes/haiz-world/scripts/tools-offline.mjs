import { createHash } from 'node:crypto';

export function toolsOffline() {
  return {
    name: 'haiz-tools-offline',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const included = new Set();
      const visit = file => {
        if (included.has(file)) return;
        const chunk = bundle[file];
        if (!chunk) return;
        included.add(file);
        if (chunk.type === 'chunk') {
          chunk.imports.forEach(visit);
          chunk.viteMetadata?.importedCss?.forEach(visit);
        }
      };
      for (const [file, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk' && (chunk.isEntry || chunk.facadeModuleId?.endsWith('/tools/ToolsApp.jsx'))) visit(file);
        if (chunk.type === 'asset' && file.startsWith('assets/tools-') && file.endsWith('.css')) visit(file);
      }
      const shell = bundle['index.html'];
      if (!shell || shell.type !== 'asset') throw Error('Missing Tools offline shell');
      const html = String(shell.source).replace('<title>HAIZ WORLD · 校园图谱</title>', '<title>HAIZ Tools · 学习与教学</title>');
      this.emitFile({ type: 'asset', fileName: 'tools/index.html', source: html });
      const urls = ['/tools/', ...[...included].map(file => '/' + file)];
      const version = createHash('sha256').update(JSON.stringify(urls) + html).digest('hex').slice(0, 12);
      const worker = `const CACHE = ${JSON.stringify('haiz-tools-shell-' + version)};
const URLS = ${JSON.stringify(urls)};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(URLS))));
self.addEventListener('activate', event => event.waitUntil((async () => {
  const names = await caches.keys();
  await Promise.all(names.filter(name => name.startsWith('haiz-tools-shell-') && name !== CACHE).map(name => caches.delete(name)));
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate' && /^\\/tools(?:\\/|$)/.test(url.pathname)) {
    event.respondWith(fetch(event.request).then(response => response.ok ? response : caches.match('/tools/')).catch(() => caches.match('/tools/')));
  } else if (URLS.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(url.pathname)) || fetch(event.request)));
  }
});
`;
      this.emitFile({ type: 'asset', fileName: 'tools/sw.js', source: worker });
    },
  };
}
