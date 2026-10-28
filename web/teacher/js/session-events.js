export const SESSION_EVENT_KEY = 'haiz.teacher.session-change';

/**
 * Announce authentication changes without storing identity or credentials.
 * @param {{onChange:()=>void,events?:EventTarget,storage?:Storage,channelFactory?:Function,idFactory?:()=>string}} options
 * @returns {{publish:()=>void,close:()=>void}}
 */
export function createSessionEvents({ onChange, events = globalThis.window, storage = globalThis.localStorage,
  channelFactory = () => typeof BroadcastChannel === 'function' ? new BroadcastChannel(SESSION_EVENT_KEY) : null,
  idFactory = () => crypto.randomUUID() }) {
  let last;
  let channel;
  try { channel = channelFactory(); } catch { channel = null; }
  const receive = value => {
    if (typeof value !== 'string' || !value || value === last) return;
    last = value; onChange();
  };
  const storageChanged = event => { if (event.key === SESSION_EVENT_KEY) receive(event.newValue); };
  events.addEventListener('storage', storageChanged);
  if (channel) channel.onmessage = event => receive(event.data);
  return {
    publish() {
      const epoch = idFactory(); last = epoch;
      // Either transport can be unavailable; focus/pageshow checks remain the fallback.
      try { storage.setItem(SESSION_EVENT_KEY, epoch); } catch { /* BroadcastChannel still works. */ }
      try { channel?.postMessage(epoch); } catch { /* Storage events still work. */ }
    },
    close() { events.removeEventListener('storage', storageChanged); channel?.close(); },
  };
}
