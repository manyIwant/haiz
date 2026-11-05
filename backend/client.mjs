// Same-origin browser client. Session secrets remain in HttpOnly cookies.
export function createHaizClient({ base = '', fetch: request = globalThis.fetch, EventSource: Events = globalThis.EventSource } = {}) {
  let expectedUser = null, authEpoch = 0;
  const activeRooms = new Set();
  const closeRooms = () => { for (const room of [...activeRooms]) room.close(); };
  async function call(path, { method = 'GET', body, key, signal } = {}) {
    const authenticating = ['/api/v1/auth/register', '/api/v1/auth/login', '/api/flow/login'].includes(path);
    if (authenticating || ['/api/v1/auth/logout', '/api/v1/auth/logout-all', '/api/v1/auth/password', '/api/v1/auth/account'].includes(path)) closeRooms();
    const publicIdentity = authenticating || ['/api/v1/auth/me', '/api/v1/auth/config'].includes(path);
    const ticket = authenticating ? ++authEpoch : authEpoch;
    const response = await request(base + path, { method, credentials: 'same-origin',
      headers: { ...(!publicIdentity && expectedUser ? { 'X-HAIZ-User': expectedUser } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: signal || AbortSignal.timeout(10000) });
    const data = await response.json();
    if (!response.ok) { if (response.status === 401 || data.identityChanged) closeRooms(); throw Object.assign(new Error(data.error || '请求失败'), { status: response.status, requestId: data.requestId, remote: data.remote, identityChanged: data.identityChanged }); }
    if (ticket === authEpoch && data.identity?.id) { if (expectedUser && expectedUser !== data.identity.id) closeRooms(); expectedUser = data.identity.id; }
    if (['/api/v1/auth/logout', '/api/v1/auth/logout-all', '/api/v1/auth/password', '/api/v1/auth/account'].includes(path)) { expectedUser = null; authEpoch++; }
    return data;
  }
  const auth = '/api/v1/auth/';
  return {
    setIdentity: identity => { if (identity !== expectedUser) closeRooms(); expectedUser = identity; authEpoch++; },
    me: () => call(auth + 'me'),
    config: () => call(auth + 'config'),
    sessions: () => call(auth + 'sessions'),
    revokeSession: id => call(auth + 'revoke', { method: 'POST', body: { id } }),
    logoutAll: () => call(auth + 'logout-all', { method: 'POST', body: {} }),
    deleteAccount: (password, confirm) => call(auth + 'account', { method: 'DELETE', body: { password, confirm } }),
    register: (username, password) => call(auth + 'register', { method: 'POST', body: { username, password } }),
    login: (username, password) => call(auth + 'login', { method: 'POST', body: { username, password } }),
    inviteLogin: invite => call('/api/flow/login', { method: 'POST', body: { invite } }),
    logout: () => call(auth + 'logout', { method: 'POST', body: {} }),
    changePassword: (password, currentPassword) => call(auth + 'password', { method: 'POST', body: { password, currentPassword } }),
    list: (collection, { cursor = '', limit = 100 } = {}) => call(`/api/v1/data/${encodeURIComponent(collection)}?cursor=${encodeURIComponent(cursor)}&limit=${limit}`),
    get: (collection, id) => call(`/api/v1/data/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`),
    put: (collection, id, data, expectedRevision) => call(`/api/v1/data/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`, { method: 'PUT', body: { data, expectedRevision } }),
    remove: (collection, id, expectedRevision) => call(`/api/v1/data/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`, { method: 'DELETE', body: { expectedRevision } }),
    flow: (route, body, key = crypto.randomUUID()) => call('/api/flow/' + route, body === undefined ? {} : { method: 'POST', body, key }),
    rooms: () => call('/api/v1/rooms'),
    joinRoom(room, onEvent) {
      if (!Events) throw new Error('当前环境不支持实时事件');
      const path = '/api/v1/rooms/' + encodeURIComponent(room), stream = new Events(base + path + '/events' + (expectedUser ? '?user=' + encodeURIComponent(expectedUser) : ''));
      let connectionId = null, closed = false;
      for (const name of ['snapshot', 'presence', 'position', 'message']) stream.addEventListener(name, event => {
        const data = JSON.parse(event.data);
        if (name === 'snapshot') connectionId = data.connectionId;
        onEvent({ type: name, ...data });
      });
      stream.onerror = () => { connectionId = null; onEvent({ type: 'disconnected' }); };
      const post = (route, body) => {
        if (!connectionId || closed) return Promise.reject(new Error('实时连接尚未就绪'));
        return call(path + '/' + route, { method: 'POST', body: { ...body, connectionId } });
      };
      const handle = { get connectionId() { return connectionId; }, position: (x, z, yaw) => post('position', { x, z, yaw }), message: text => post('messages', { text }),
        close() { closed = true; connectionId = null; stream.close(); activeRooms.delete(handle); } };
      activeRooms.add(handle); return handle;
    },
  };
}
