import { createReadStream, existsSync } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.hdr': 'application/octet-stream', '.bin': 'application/octet-stream', '.txt': 'text/plain; charset=utf-8' };
const blocked = new Set(['backend', 'services', 'tests', 'scripts', 'docs', 'pilot', 'node_modules', 'release', 'src', 'remotion', 'portable']);
export function staticHandler(root, privateDirectory) {
  const prototype = existsSync(path.join(root, 'public/haiz'));
  const publicRoot = prototype ? path.join(root, 'public') : path.join(root, 'prototypes/haiz-world/public');
  const clientRoot = prototype ? path.join(root, 'dist/client') : root;
  const accountLink = '<a href="/account/" aria-label="我的数据与账号" style="position:fixed;right:16px;top:86px;z-index:2147483000;background:#faf8f2;color:#244d42;border:1px solid #b8c4b3;border-radius:6px;padding:10px 14px;font:14px/24px sans-serif;text-decoration:none;box-shadow:0 2px 12px #193c3314">我的数据</a>';
  return async (req, res, pathname, nonce) => {
    if (!['GET', 'HEAD'].includes(req.method)) return false;
    let relative;
    try { relative = decodeURIComponent(pathname); } catch { return false; }
    const parts = relative.split('/');
    if (parts.some(p => p.startsWith('.') || blocked.has(p)) || relative.includes('\\') || relative.includes('\0') || /(^|\/)(package(-lock)?\.json|.*\.test\..*)$/.test(relative)) return false;
    if (relative.startsWith('/world/')) relative = '/haiz' + relative;
    if (relative.endsWith('/')) relative += 'index.html';
    const extension = path.extname(relative).toLowerCase();
    if (!mime[extension]) return false;
    const base = relative.startsWith('/haiz/') || relative.startsWith('/design/') ? publicRoot : clientRoot;
    let file, info;
    try {
      const [resolvedRoot, resolvedFile] = await Promise.all([realpath(base), realpath(path.resolve(base, '.' + relative))]);
      if (!resolvedFile.startsWith(resolvedRoot + path.sep)) return false;
      if (privateDirectory && (resolvedFile === privateDirectory || resolvedFile.startsWith(privateDirectory + path.sep))) return false;
      if (path.relative(resolvedRoot, resolvedFile).split(path.sep).some(p => p.startsWith('.') || blocked.has(p))) return false;
      file = resolvedFile; info = await stat(file); if (!info.isFile()) return false;
    } catch { return false; }
    if (extension === '.html') {
      let html = await readFile(file, 'utf8');
      if (req.haizIdentity) html = html.replace(/<head(?:\s[^>]*)?>/i, head => head + `<script src="/account/session-guard.js" data-haiz-user="${req.haizIdentity}"></script>`);
      if (/\/world\/(flow|stillroom)\/index\.html$/.test(relative)) {
        const baseTag = relative.includes('/flow/') ? '<base href="/world/flow/">' : '<base href="/world/stillroom/">';
        html = html.replace('<head>', `<head>${baseTag}<script nonce="${nonce}">window.HAIZ_PILOT=true;window.HAIZ_BACKEND=true;</script>`);
      }
      // Only the top-level page needs navigation; embedded 3D scenes keep their controls.
      if (!/\/(atlas-engine|campus|immersive)\//.test(relative) && !relative.endsWith('/atlas-engine.html')) html = html.replace(/<\/body>/i, accountLink + '</body>');
      res.writeHead(200, { 'Content-Type': mime[extension], 'Cache-Control': 'no-store', 'Vary': 'Cookie' });
      res.end(req.method === 'HEAD' ? undefined : html); return true;
    }
    const etag = `W/"${info.size.toString(16)}-${Math.trunc(info.mtimeMs).toString(16)}"`;
    res.setHeader('ETag', etag); res.setHeader('Last-Modified', info.mtime.toUTCString());
    res.setHeader('Cache-Control', extension === '.html' || relative.endsWith('/sw.js') ? 'no-cache' : 'public, max-age=300');
    if (req.headers['if-none-match']?.split(',').map(s => s.trim()).includes(etag)) { res.writeHead(304); res.end(); return true; }
    let start = 0, end = info.size - 1, status = 200;
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (match) {
        start = match[1] ? Number(match[1]) : Math.max(0, info.size - Number(match[2]));
        end = match[1] ? (match[2] ? Math.min(Number(match[2]), info.size - 1) : info.size - 1) : info.size - 1;
      }
      if (!match || start > end || start >= info.size) { res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); res.end(); return true; }
      status = 206; res.setHeader('Content-Range', `bytes ${start}-${end}/${info.size}`);
    }
    res.writeHead(status, { 'Content-Type': mime[extension], 'Content-Length': Math.max(0, end - start + 1), 'Accept-Ranges': 'bytes' });
    if (req.method === 'HEAD' || info.size === 0) res.end();
    else await pipeline(createReadStream(file, { start, end }), res).catch(error => { if (!res.destroyed) throw error; });
    return true;
  };
}
