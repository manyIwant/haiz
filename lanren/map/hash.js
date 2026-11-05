// Chapter 04's history entries (pure, testable):
//   #map                    the 04 shot (V4's own hash)
//   #map/oblique | #map/top the plan, seen as chapter 04 frames it or from straight above
//   #map/<view>/<place id>  a place open on the plan
export function parseHash(hash) {
  const parts = String(hash || '').replace(/^#/, '').split('/');
  if (parts[0] !== 'map' || parts.length < 2 || !parts[1]) return null;
  return { view: parts[1] === 'top' ? 'top' : 'oblique', id: parts[2] ? decodeURIComponent(parts[2]) : null };
}
export const hashFor = (view, id) => '#map/' + view + (id ? '/' + encodeURIComponent(id) : '');
