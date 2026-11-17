// HAIZ · 入画 — reading Haikou's sky.
//
// Open-Meteo's forecast API: free for non-commercial use, no key (so there is no secret to keep in
// a static site), CORS-enabled. The request carries the campus coordinates and nothing about the
// visitor. Whoever opens the page, wherever they are, sees the campus's weather.
//
//   cache      localStorage, 12 minutes fresh (the model updates hourly; its 15-minute block every
//              quarter): a reload or a second tab does not ask again
//   refresh    every 15 minutes while the page is open and visible
//   failure    retries back off 1 → 2 → 4 → … 30 minutes; meanwhile a cached forecast up to 18 h old
//              is still used (the interface says how old), and with nothing at all, Haikou's
//              monthly normals (labelled 离线)
import { SITE, HOURLY, CURRENT, parseForecast } from './model.js';

export const API = 'https://api.open-meteo.com/v1/forecast';
const STORE = 'haiz.weather.v1';
const FRESH = 12 * 60000, STALE = 18 * 3600000, EVERY = 15 * 60000;

export function forecastUrl() {
  const q = new URLSearchParams({
    latitude: SITE.lat.toFixed(4), longitude: SITE.lon.toFixed(4),
    current: CURRENT.join(','), hourly: HOURLY.join(','),
    past_hours: '12', forecast_hours: '14', timezone: 'Asia/Shanghai', wind_speed_unit: 'ms',
  });
  return `${API}?${q}`;
}

function readCache(storage) {
  try { const s = JSON.parse(storage?.getItem(STORE) || 'null'); return s && s.t && s.json ? s : null; } catch { return null; }
}
function writeCache(storage, json, t) {
  try { storage?.setItem(STORE, JSON.stringify({ t, json })); } catch { /* storage full or blocked */ }
}

/**
 * createSource({ fetchImpl, storage, now, onUpdate }) → { start(), stop(), refresh(), status }
 * status: { state: 'live' | 'cached' | 'offline' | 'loading', fetchedAt, error, forecast }
 */
export function createSource({ fetchImpl = globalThis.fetch?.bind(globalThis), storage = globalThis.localStorage, now = () => Date.now(), onUpdate = () => {}, url = forecastUrl() } = {}) {
  const status = { state: 'loading', fetchedAt: 0, error: null, forecast: null };
  let timer = 0, fails = 0, stopped = false;
  const cached = readCache(storage);
  if (cached && now() - cached.t < STALE) {
    try { status.forecast = parseForecast(cached.json); status.fetchedAt = cached.t; status.state = now() - cached.t < FRESH ? 'live' : 'cached'; } catch { /* a bad cache is ignored */ }
  }
  const schedule = (ms) => { clearTimeout(timer); if (!stopped) timer = setTimeout(refresh, ms); };
  async function refresh() {
    if (!fetchImpl) { status.state = status.forecast ? 'cached' : 'offline'; onUpdate(status); return status; }
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const deadline = setTimeout(() => ctl?.abort(), 12000);
    try {
      const res = await fetchImpl(url, { signal: ctl?.signal, cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const fc = parseForecast(json);
      const t = now();
      writeCache(storage, json, t);
      Object.assign(status, { state: 'live', fetchedAt: t, error: null, forecast: fc });
      fails = 0;
      schedule(EVERY);
    } catch (e) {
      fails++;
      status.error = String(e && e.message || e);
      if (status.forecast && now() - status.fetchedAt < STALE) status.state = 'cached';
      else { status.state = 'offline'; status.forecast = null; }
      schedule(Math.min(30, 2 ** (fails - 1)) * 60000);
    } finally { clearTimeout(deadline); }
    onUpdate(status);
    return status;
  }
  const onVisible = () => { if (typeof document !== 'undefined' && !document.hidden && now() - status.fetchedAt > EVERY) refresh(); };
  return {
    status,
    start() {
      stopped = false;
      if (status.forecast && status.state === 'live') { onUpdate(status); schedule(FRESH - (now() - status.fetchedAt)); }
      else refresh();
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
      return this;
    },
    stop() { stopped = true; clearTimeout(timer); if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible); },
    refresh,
  };
}
