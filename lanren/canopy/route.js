// Chapter 03 addresses (no three.js here: the static page uses it too).
import { byId } from './directions.js';

/** #leaves… → { dir } | { work } | { shot: true } | null */
export function parseHash(h) {
  const m = /^#(leaves|archive)(?:\/(.*))?$/.exec(h || '');
  if (!m) return null;
  const rest = m[2] || '';
  if (!rest) return { shot: true };
  const w = /^w\/([\w-]{1,100})$/.exec(rest);
  if (w) return { work: w[1] };
  if (rest === 'all') return { dir: null, inside: true };
  if (byId(rest)) return { dir: rest, inside: true };
  return { shot: true };
}
