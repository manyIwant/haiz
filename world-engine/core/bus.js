// HAIZ World Engine — Typed Pub/Sub Event Bus
// Decouples world subsystems (clock, weather, spatial, art lenses, life, locomotion, science, UI)
// so new capabilities can attach without forking main loops.

export function createEventBus() {
  const listeners = new Map();
  const history = [];
  const MAX_HISTORY = 64;

  function on(type, fn) {
    let set = listeners.get(type);
    if (!set) {
      set = new Set();
      listeners.set(type, set);
    }
    set.add(fn);
    return () => set.delete(fn);
  }

  function once(type, fn) {
    const off = on(type, (payload) => {
      off();
      fn(payload);
    });
    return off;
  }

  function emit(type, payload) {
    history.push({ type, at: performance.now(), payload });
    if (history.length > MAX_HISTORY) history.shift();
    const set = listeners.get(type);
    if (!set || set.size === 0) return;
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[WorldBus] listener error on "${type}":`, err);
      }
    }
  }

  return {
    on,
    once,
    emit,
    recent(n = 16) {
      return history.slice(-n);
    },
    clear() {
      listeners.clear();
      history.length = 0;
    },
  };
}
