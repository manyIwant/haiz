import { createClient } from './api.js';
import { createWorkspace } from './workspace.js';
import * as ui from './ui.js';

const client = createClient();
const workspace = createWorkspace({ root: document.body, academicClient: client });
function loginError(message) {
  ui.byId('login-error').textContent = message;
  ui.byId('login-error').hidden = !message;
}
function showLogin() {
  ui.byId('entry').hidden = false;
  ui.byId('app').hidden = true;
  ui.byId('who').hidden = true;
}
function showApp(identity) {
  ui.byId('entry').hidden = true;
  ui.byId('app').hidden = false;
  ui.byId('who').hidden = false;
  ui.byId('who-name').textContent = identity?.role === 'admin' ? '管理员' : identity ? '教师' : '离线整理';
  ui.byId('logout').textContent = identity ? '退出' : '返回登录';
  if (!identity) ui.byId('logout').onclick = () => location.reload();
}
ui.byId('login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.target;
  if (!form.reportValidity()) return;
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true; loginError('');
  try {
    await client.send('/api/auth/login', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
    ui.byId('login-password').value = '';
    workspace.authChanged();
    const { identity } = await workspace.boot(); showApp(identity);
  } catch (error) { loginError(error.message || '登录失败，请检查账号和密码。'); }
  finally { submit.disabled = false; }
});
ui.byId('offline-mode').onclick = () => {
  try { workspace.offline(); showApp(null); }
  catch (error) { loginError(error.message); }
};
showLogin();
workspace.boot().then(({ identity }) => showApp(identity)).catch(error => {
  showLogin();
  if (error.status !== 401) loginError(error.message || '暂时无法连接教务服务。可先离线整理草稿。');
});
