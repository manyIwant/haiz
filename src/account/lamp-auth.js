(() => {
  const $ = id => document.getElementById(id);
  const scene = $('scene'), panel = $('panel'), form = $('login-form');
  const username = $('username'), password = $('password'), confirmation = $('confirm-password'), invite = $('invite');
  const login = $('submit'), loginText = $('submit-text'), status = $('status');
  const motionOff = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const identityChannel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('haiz-account-state') : null;
  let submitting = false, authenticated = false, errorLatched = false, mode = 'login', registration = false;
  let redirection = null;
  function destination() {
    try {
      const next = new URLSearchParams(location.search).get('next');
      const url = new URL(next || '/account/', location.origin);
      if (url.origin === location.origin && !['/login', '/login/', '/login/index.html'].includes(url.pathname)) return url.pathname + url.search + url.hash;
    } catch {}
    return '/account/';
  }
  function phase(value) { scene.dataset.phase = value; }
  function message(content, type = 'info') { status.textContent = content; status.className = 'status visible ' + type; }
  function clearMessage() { status.textContent = ''; status.className = 'status'; }
  function updateFocusState() {
    if (authenticated || submitting || errorLatched) return;
    const focus = document.activeElement;
    if (focus === password || focus === confirmation || focus === invite) phase('password');
    else if (focus === username) phase('username');
    else if ((mode === 'invite' && invite.value) || (username.value.trim() && password.value)) phase('ready');
    else if (username.value.trim()) phase('username'); else phase('idle');
  }
  function deny(content) {
    errorLatched = true; phase('error'); message(content, 'error');
    if (!motionOff) { panel.classList.remove('shake'); void panel.offsetWidth; panel.classList.add('shake'); }
  }
  for (const input of [username, password, confirmation, invite]) {
    input.addEventListener('focus', updateFocusState);
    input.addEventListener('input', () => { errorLatched = false; clearMessage(); updateFocusState(); });
    input.addEventListener('blur', () => requestAnimationFrame(updateFocusState));
  }
  $('toggle-password').addEventListener('click', () => {
    const show = password.type === 'password'; password.type = show ? 'text' : 'password';
    $('toggle-password').setAttribute('aria-pressed', String(show)); $('toggle-password').setAttribute('aria-label', show ? '隐藏密码' : '显示密码'); password.focus({ preventScroll: true });
  });
  $('forgot').addEventListener('click', () => message('暂未提供自助找回。如遗失密码，请联系站点管理员核验处理。'));
  function setMode(value) {
    if (submitting || authenticated) return;
    if (value === 'register' && !registration) { deny('当前暂未开放新账号注册，请使用已有账号或邀请。'); return; }
    mode = value; errorLatched = false; clearMessage();
    $('login-title').textContent = mode === 'register' ? '注册' : mode === 'invite' ? '接受邀请' : '登录';
    $('username-group').hidden = mode === 'invite'; $('password-group').hidden = mode === 'invite';
    $('confirm-group').hidden = mode !== 'register'; $('invite-group').hidden = mode !== 'invite';
    $('forgot').hidden = mode !== 'login';
    password.autocomplete = mode === 'register' ? 'new-password' : 'current-password'; password.minLength = mode === 'register' ? 12 : 1;
    loginText.textContent = mode === 'register' ? '注册并进入' : mode === 'invite' ? '验证邀请' : '登 录';
    $('mode-copy').textContent = mode === 'login' ? '还没有账号？' : '已有账号？';
    $('mode-toggle').textContent = mode === 'login' ? '注册账号' : '返回登录';
    $('invite-toggle').textContent = mode === 'invite' ? '返回密码登录' : '使用管理员提供的邀请';
    $('auth-description').textContent = mode === 'register' ? '账号名为 3 至 40 位字母、数字或下划线，密码至少 12 个字符。' : '每个账号只访问自己的个人记录。';
    updateFocusState();
  }
  $('mode-toggle').addEventListener('click', () => setMode(mode === 'login' ? 'register' : 'login'));
  $('invite-toggle').addEventListener('click', () => setMode(mode === 'invite' ? 'login' : 'invite'));
  $('replay').addEventListener('click', () => {
    if (submitting || authenticated) return;
    if (redirection) clearTimeout(redirection);
    errorLatched = false; scene.classList.remove('success'); panel.classList.remove('shake'); clearMessage(); phase('idle'); updateFocusState();
  });
  function illuminate() {
    if (!authenticated) return;
    phase('success'); scene.classList.add('success'); login.disabled = true;
    loginText.textContent = '验证成功'; message('身份已验证，正在进入你的 HAIZ 空间。');
    redirection = setTimeout(() => location.assign(destination()), motionOff ? 150 : 1450);
  }
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (submitting || authenticated) return;
    const account = username.value.trim(), secret = password.value;
    if (mode === 'invite') { if (!invite.value.trim()) { deny('请输入一次性邀请码。'); invite.focus(); return; } }
    else {
      if (!account) { deny('请输入账号。'); username.focus(); return; }
      if (!secret) { deny('请输入密码。'); password.focus(); return; }
      if (mode === 'register' && (!/^[A-Za-z0-9][A-Za-z0-9_-]{2,39}$/.test(account) || secret.length < 12)) { deny('账号名须为 3 至 40 位字母或数字等字符，密码至少 12 个字符。'); return; }
      if (mode === 'register' && secret !== confirmation.value) { deny('两次密码不一致，请重新核对。'); confirmation.focus(); return; }
    }
    errorLatched = false; submitting = true; phase('checking'); login.disabled = true;
    loginText.innerHTML = '<span class="busy" aria-label="正在验证"></span>'; message('正在安全验证身份…');
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(mode === 'invite' ? '/api/flow/login' : '/api/auth/' + mode, { method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mode === 'invite' ? { invite: invite.value.trim(), remember: $('remember').checked } : { username: account, password: secret, remember: $('remember').checked }), signal: controller.signal });
      const result = await response.json().catch(() => null);
      if (!response.ok) { deny(result?.error || '账号服务暂不可用，请稍后再试。'); return; }
      if (!result?.identity?.id || result.authenticated !== true) { deny('未获得有效的身份认证结果。'); return; }
      identityChannel?.postMessage({ type: 'identity-changed' });
      const sessionResponse = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store', headers: { 'X-HAIZ-User': result.identity.id }, signal: controller.signal });
      const session = sessionResponse.ok ? await sessionResponse.json().catch(() => null) : null;
      if (session?.authenticated !== true || session.identity?.id !== result.identity.id) { deny('会话验证未通过，请重新登录。'); return; }
      password.value = ''; confirmation.value = ''; invite.value = ''; authenticated = true; illuminate();
    } catch (error) { deny(error?.name === 'AbortError' ? '验证超时，请检查网络后重试。' : '无法连接账号服务，请检查网络后重试。'); }
    finally { clearTimeout(timer); submitting = false; if (!authenticated) { login.disabled = false; loginText.textContent = mode === 'register' ? '注册并进入' : mode === 'invite' ? '验证邀请' : '登 录'; } }
  });
  fetch('/api/v1/auth/config', { cache: 'no-store', credentials: 'same-origin' }).then(response => response.ok ? response.json() : null).then(config => {
    registration = config?.registration === true;
    if (new URLSearchParams(location.search).get('mode') === 'register' && registration) setMode('register');
  }).catch(() => {});
})();
