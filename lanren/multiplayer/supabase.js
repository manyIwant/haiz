import { ALIAS, FRAME_ID, ROOM, sendInterval } from './protocol.js';

const TOPIC = 'haiz-mp:v1:';
const EVENT = 'state';
const denied = (message) => Object.assign(new Error(message), { permanent: true });
const transient = (message) => new Error(message);

function validate(value) {
  const { self, members, capacity, frame } = value ?? {};
  if (frame !== FRAME_ID || typeof self !== 'string' || !ALIAS.test(self) ||
      !Array.isArray(members) || members.length > capacity || !members.includes(self) ||
      new Set(members).size !== members.length ||
      members.some(id => typeof id !== 'string' || !ALIAS.test(id)))
    throw denied('房间目录不兼容，无法加入');
  try { sendInterval(capacity); } catch { throw denied('房间容量配置无效'); }
  return { ownId: self, members, capacity };
}

function authorizationFailure(error) {
  return /unauthorized|forbidden|not authorized|permission denied|does not have permissions|no permissions/i.test(error?.message ?? '');
}

export function createSupabaseTransport(supabase, { timeout = 10_000, presenceGap = 6500 } = {}) {
  return Object.freeze({
    async open(room, { signal, onPacket, onPresence, onLost }) {
      if (typeof room !== 'string' || !ROOM.test(room)) throw denied('无效的房间编号');
      const controller = new AbortController();
      const abort = () => controller.abort(signal?.reason);
      if (signal?.aborted) abort();
      else signal?.addEventListener('abort', abort, { once: true });
      const deadline = setTimeout(() => controller.abort(transient('Realtime 连接超时')), timeout);
      const alive = controller.signal;
      const known = new Map();
      let closed = false, activated = false, negotiated = false, failure, cleanup;
      let rejectAbort;
      const cancelled = new Promise((_, reject) => { rejectAbort = reject; });
      const abortWait = () => rejectAbort(alive.reason);
      alive.addEventListener('abort', abortWait, { once: true });
      if (alive.aborted) abortWait();
      const bounded = value => Promise.race([value, cancelled]);
      const announce = (id, channel) => {
        if (activated && !closed) onPresence(id, Object.values(channel.presenceState()).flat());
      };
      const offline = () => { if (!closed) onLost(transient('网络已断开')); };
      const close = () => {
        if (!cleanup) {
          closed = true;
          controller.abort();
          globalThis.removeEventListener?.('offline', offline);
          signal?.removeEventListener('abort', abort);
          cleanup = Promise.allSettled([...known.values()].map(async channel => {
            if (await supabase.removeChannel(channel) !== 'ok') channel.teardown();
          })).then(() => {});
        }
        return cleanup;
      };
      try {
        const auth = await bounded(supabase.auth.getSession());
        if (!auth.data?.session || auth.data.session.user?.is_anonymous)
          throw denied('请先登录已获邀请的 HAIZ Pocket 账号');
        // Supabase JS owns token refresh. setAuth() reads the current token via
        // its callback; supplying an explicit token would pin the socket token.
        await bounded(supabase.realtime.setAuth());
        const result = await bounded(supabase.rpc('haiz_mp_directory', { room }).abortSignal(alive));
        if (result.error) {
          if (result.error.code === '42501' || result.status === 401 || result.status === 403)
            throw denied('当前账号没有这间共游房间的访问权');
          if (result.error.code === '22023') throw denied('房间人数超过配置上限');
          if (result.error.code === 'PGRST202' || result.status === 404)
            throw denied('共游房间服务尚未部署');
          throw transient('无法读取共游房间目录');
        }
        const directory = validate(result.data);
        // Join own topic first; observer topics cannot be used to publish.
        const aliases = [directory.ownId, ...directory.members.filter(id => id !== directory.ownId)];
        await bounded(Promise.all(aliases.map(id => new Promise((resolve, reject) => {
          const channel = supabase.channel(TOPIC + room + ':' + id, {
            config: { private: true, broadcast: { ack: false, self: false }, presence: { enabled: true } },
          });
          known.set(id, channel);
          channel.on('presence', { event: 'sync' }, () => announce(id, channel));
          channel.on('broadcast', { event: EVENT }, ({ payload }) => {
            if (!closed && activated && id !== directory.ownId) onPacket(id, payload);
          });
          channel.subscribe((status, error) => {
            if (closed) return;
            if (status === 'SUBSCRIBED') { resolve(); return; }
            if (!['TIMED_OUT', 'CHANNEL_ERROR', 'CLOSED'].includes(status)) return;
            const reason = authorizationFailure(error) ? denied('Realtime 拒绝访问房间频道，请检查房间授权') :
              transient('Realtime 频道状态：' + status);
            if (activated) onLost(reason);
            else { failure = reason; if (!negotiated) reject(reason); }
          }, timeout);
        }))));
        negotiated = true;
        if (failure) throw failure;
        alive.throwIfAborted();
        const own = known.get(directory.ownId);
        let lastPresence = -Infinity;
        const presenceCall = async operation => {
          alive.throwIfAborted();
          const remaining = Math.max(0, presenceGap - (performance.now() - lastPresence));
          if (remaining) await new Promise((resolve, reject) => {
            const stop = () => { clearTimeout(timer); reject(alive.reason); };
            const timer = setTimeout(() => { alive.removeEventListener('abort', stop); resolve(); }, remaining);
            alive.addEventListener('abort', stop, { once: true });
          });
          alive.throwIfAborted();
          lastPresence = performance.now();
          return checked(operation(), '无法更新在线状态');
        };
        const checked = async (promise, message) => {
          if (await promise !== 'ok') throw transient(message);
        };
        globalThis.addEventListener?.('offline', offline);
        return {
          ownId: directory.ownId, capacity: directory.capacity,
          activate() {
            if (closed) return;
            if (failure) { onLost(failure); return; }
            activated = true;
            for (const [id, channel] of known) announce(id, channel);
          },
          track: value => presenceCall(() => own.track(value)),
          untrack: () => presenceCall(() => own.untrack()),
          send: data => {
            if (own.state !== 'joined' || !supabase.realtime.isConnected())
              throw transient('Realtime 频道已断开');
            return checked(own.send({ type: 'broadcast', event: EVENT, payload: data }), '无法同步位置');
          },
          close,
        };
      } catch (error) {
        await close();
        throw error;
      } finally {
        clearTimeout(deadline);
        alive.removeEventListener('abort', abortWait);
        if (!negotiated || closed) signal?.removeEventListener('abort', abort);
      }
    },
  });
}
