// Pure touch-intent and snap helpers. Browser-free so mobile input can be
// checked without a GPU or a device emulator.
// Vertical pans advance the film; deliberate horizontal gestures look around.
export function touchIntent(dx, dy, threshold = 11) {
  if (Math.hypot(dx, dy) < threshold) return null;
  return Math.abs(dx) > Math.abs(dy) * 1.35 ? 'look' : 'scroll';
}

// Directional snap on desktop is unchanged. Phones choose the closest
// station, not the *next* one, avoiding surprising one-swipe chapter skips.
export function nearestSnap(progress, points) {
  if (!points?.length) return progress;
  let closest = points[0], best = Math.abs(progress - closest);
  for (let i = 1; i < points.length; i++) {
    const d = Math.abs(progress - points[i]);
    if (d < best) { best = d; closest = points[i]; }
  }
  return closest;
}
