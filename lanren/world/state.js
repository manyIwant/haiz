// One world, shared by chapters 04, 05, 06 and the walk.
//
// Until now chapter 04 kept its campus, its chosen place and the camera in a closure
// (lanren/map/map.js). The film and the walk need the same facts, so they live here:
//
//   campus       whether the visitor left the campus standing in 04 (pinned), and the
//                composition that says how 05/06 meet it (compose.js)
//   destination  a place chosen in 04 or on the pocket map: the walk's goal (optional)
//   player       where the walker last stood (to come back to from the full map)
//   hud          interface shown or hidden (photography), body shown or hidden
//   owner        who has the camera and the input right now. Exactly one at a time:
//
//     scroll   the six-shot film (V4): scroll/swipe moves along it, drag looks round
//     map      chapter 04's map (map.js locks the page and takes the camera)
//     hold     06, the end of the film: still the scroll's, plus one explicit way on
//     play     the walk: keys/joystick move, drag looks, the page never scrolls
//     pocket   the pocket map over the walk: the walker stands still, touches are the map's
//     menu     the pause menu over the walk
//     transit  a camera flight between two of these (nothing answers input)
//
// Each owner says what the wheel, a drag, a touch and the keys mean, whether the page may
// scroll and who writes the camera (see POLICY). Pure apart from the DOM it is handed.

export const POLICY = {
  scroll: { scroll: true, touch: '', v4cam: true, wheel: 'film' },
  hold: { scroll: true, touch: '', v4cam: true, wheel: 'film' },
  map: { scroll: false, touch: 'none', v4cam: false, wheel: 'map' },
  play: { scroll: false, touch: 'none', v4cam: false, wheel: 'none' },
  pocket: { scroll: false, touch: 'none', v4cam: false, wheel: 'pocket' },
  menu: { scroll: false, touch: 'none', v4cam: false, wheel: 'none' },
  transit: { scroll: false, touch: 'none', v4cam: false, wheel: 'none' }
};

export function createWorldState({ compose, canvas = null, cam = null } = {}) {
  const listeners = new Map();
  const emit = (k, v) => { for (const f of listeners.get(k) || []) { try { f(v); } catch (e) { console.warn(e); } } };
  let lockY = 0;
  const W = {
    compose,
    owner: 'scroll',
    campus: { pinned: false },
    destination: null,
    player: null,
    hud: { ui: true, body: true },
    /** listen: 'owner' | 'destination' | 'hud' */
    on(k, f) { if (!listeners.has(k)) listeners.set(k, new Set()); listeners.get(k).add(f); return () => listeners.get(k).delete(f); },
    emit,
    policy() { return POLICY[W.owner] || POLICY.scroll; },
    /** hand the camera and the input to `owner` (the previous owner is told through 'owner') */
    claim(owner) {
      if (!POLICY[owner]) throw new Error('unknown owner ' + owner);
      if (owner === W.owner) return;
      const prev = W.owner;
      W.owner = owner;
      const pol = POLICY[owner];
      if (!pol.scroll && POLICY[prev].scroll) lockY = typeof scrollY === 'number' ? scrollY : 0;
      // map.js manages its own page lock and camera (takeCamera/handBack); the others are set here
      if (owner !== 'map') {
        if (canvas) canvas.style.touchAction = pol.touch;
        if (cam) cam.enabled = pol.v4cam;
      }
      if (typeof document !== 'undefined') {
        document.body.dataset.owner = owner;
        document.documentElement.classList.toggle('world-locked', !pol.scroll);
      }
      emit('owner', { owner, prev });
    },
    /** give the input back to the six-shot film (from whichever owner had it) */
    release(owner) { if (W.owner === owner) W.claim('scroll'); },
    get lockY() { return lockY; },
    set lockY(y) { lockY = y; },
    setDestination(id) { if (W.destination === id) return; W.destination = id || null; emit('destination', W.destination); },
    setHud(patch) { Object.assign(W.hud, patch); emit('hud', { ...W.hud }); }
  };
  // the page cannot move under an owner that locked it (wheel, touch, keys, a stray scrollTo)
  if (typeof addEventListener === 'function' && typeof document !== 'undefined') {
    const locked = () => !W.policy().scroll && W.owner !== 'map';
    const inScrollable = (t) => {
      for (let el = t instanceof Element ? t : null; el && el !== document.body; el = el.parentElement) {
        const oy = getComputedStyle(el).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) return true;
        if (el.matches('dialog[open], [data-own-scroll]')) return true;
      }
      return false;
    };
    addEventListener('wheel', (e) => { if (locked() && !inScrollable(e.target)) e.preventDefault(); }, { passive: false });
    addEventListener('touchmove', (e) => { if (locked() && !inScrollable(e.target)) e.preventDefault(); }, { passive: false });
    addEventListener('scroll', () => { if (locked() && Math.abs(scrollY - lockY) > 1) scrollTo(0, lockY); }, { passive: true });
  }
  return W;
}
