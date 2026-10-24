// Position and velocity are retained when the target changes. Values use CSS px / s.
export function springState(x = 0) { return { x, velocity: 0, target: x }; }
export function advanceSpring(state, elapsed, reduced = false) {
  if (reduced) { state.x = state.target; state.velocity = 0; return false; }
  // Substeps keep damping stable under a slow frame; tab suspension never fast-forwards.
  let remaining = Math.min(Math.max(elapsed, 0), 0.064);
  while (remaining > 0) {
    const dt = Math.min(remaining, 1 / 240);
    state.velocity += ((state.target - state.x) * 390 - state.velocity * 35) * dt;
    state.x += state.velocity * dt;
    remaining -= dt;
  }
  if (Math.abs(state.x - state.target) < 0.08 && Math.abs(state.velocity) < 0.4) {
    state.x = state.target; state.velocity = 0; return false;
  }
  return true;
}
