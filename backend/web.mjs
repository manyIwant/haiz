import { readFile } from 'node:fs/promises';
const files = new Map([['/account/', ['index.html', 'text/html; charset=utf-8']], ['/account/index.html', ['index.html', 'text/html; charset=utf-8']], ['/account/app.js', ['app.js', 'text/javascript; charset=utf-8']], ['/account/style.css', ['style.css', 'text/css; charset=utf-8']]]);
files.set('/account/session-guard.js', ['session-guard.js', 'text/javascript; charset=utf-8']);
files.set('/src/account/lamp-auth.js', ['lamp-auth.js', 'text/javascript; charset=utf-8']);
files.set('/login/', ['lamp-login', 'text/html; charset=utf-8']);
files.set('/login/index.html', ['lamp-login', 'text/html; charset=utf-8']);
export async function serveAccount(req, res, pathname) {
  if (!files.has(pathname)) return false;
  const [file, type] = files.get(pathname);
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(req.method === 'HEAD' ? undefined : await readFile(file === 'lamp-login' ? new URL('../login/index.html', import.meta.url) : new URL('../src/account/' + file, import.meta.url)));
  return true;
}
