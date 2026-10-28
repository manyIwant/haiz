import { ApiError, ROUTES } from './api.js';

/**
 * Bind an open workspace to its original Academic identity and permissions.
 * @param {{client:{send:Function},identity:{userId:string,instanceId:string,role:string,authorizedClassIds:string[]},onInvalid:Function}} options
 * @returns {{send:Function,validate:Function}}
 */
export function createSessionClient({ client, identity, onInvalid }) {
  const fingerprint = value => JSON.stringify([value?.instanceId, value?.userId, value?.role,
    Array.isArray(value?.authorizedClassIds) ? [...value.authorizedClassIds].sort() : null]);
  const expected = fingerprint(identity);
  let suspended = false;
  const invalid = () => new ApiError({ status: 401, code: 'IDENTITY_CHANGED', message: '登录身份或权限已变化。草稿和原请求已保留，请重新登录原账号。' });
  function suspend() {
    if (!suspended) { suspended = true; onInvalid(); }
  }
  async function validate() {
    if (suspended) throw invalid();
    try {
      const response = await client.send(ROUTES.identity());
      if (fingerprint(response.data) !== expected) { suspend(); throw invalid(); }
      if (suspended) throw invalid();
      return response;
    } catch (error) {
      if ([401, 403].includes(error.status)) suspend();
      throw error;
    }
  }
  async function send(path, options) {
    await validate();
    try {
      const response = await client.send(path, { ...options, headers: { ...options?.headers,
        'X-HAIZ-Expected-Actor': encodeURIComponent(JSON.stringify([identity.instanceId, identity.userId])) } });
      await validate();
      return response;
    } catch (error) {
      if ([401, 403].includes(error.status)) suspend();
      throw error;
    }
  }
  return { send, validate };
}
