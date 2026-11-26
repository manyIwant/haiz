/**
 * HAIZ · NIANLUN · 一卷 V4 — Optional Real Haikou ERA5 Climate Patina Loader
 *
 * Reuses HAIZ's real ERA5 archive (`lanren/rings/data/climate.bin` + `climate.json`,
 * CC BY 4.0 / Copernicus C3S via Open-Meteo).
 *
 * STRICTLY obeys Master v4 §4.2 & §13 #6:
 *   - Weather data ONLY modulates subtle wood pigment & patina texture.
 *   - Weather NEVER changes annual-ring width, radius, or marker positions!
 *   - Gracefully offline-safe: if absent or offline, falls back seamlessly to neutral timber tones.
 */

const T0 = Date.UTC(1940, 0, 1);
const DAY_MS = 86400000;

const FIELDS = [
  { name: 'tmax', type: 'Int16', scale: 10 },
  { name: 'tmin', type: 'Int16', scale: 10 },
  { name: 'rain', type: 'Uint16', scale: 10 },
  { name: 'wind', type: 'Uint8', scale: 1 },
  { name: 'gust', type: 'Uint8', scale: 1 },
  { name: 'dir', type: 'Uint8', scale: 0.5 },
  { name: 'cloud', type: 'Uint8', scale: 1 },
  { name: 'code', type: 'Uint8', scale: 1 },
];

const ARRAYS = { Int16: Int16Array, Uint16: Uint16Array, Uint8: Uint8Array };
const NONE = { Int16: 32767, Uint16: 65535, Uint8: 255 };
const BYTES_PER_DAY = FIELDS.reduce((s, f) => s + ARRAYS[f.type].BYTES_PER_ELEMENT, 0);

function dayIndexOfIso(iso) {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  return Math.round((Date.UTC(y, m - 1, d) - T0) / DAY_MS);
}

function unpackClimate(bytes, days) {
  const u8 = new Uint8Array(bytes);
  if (u8.byteLength !== days * BYTES_PER_DAY) return null;
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const cols = {};
  let off = 0;
  for (const f of FIELDS) {
    const A = ARRAYS[f.type];
    const arr = new A(days);
    for (let i = 0; i < days; i++) {
      arr[i] = f.type === 'Int16'
        ? view.getInt16(off, true)
        : f.type === 'Uint16'
          ? view.getUint16(off, true)
          : view.getUint8(off);
      off += A.BYTES_PER_ELEMENT;
    }
    cols[f.name] = arr;
  }
  return {
    days,
    get(iso) {
      const idx = dayIndexOfIso(iso);
      if (idx < 0 || idx >= days) return null;
      const read = (name) => {
        const f = FIELDS.find((x) => x.name === name);
        const raw = cols[name][idx];
        return raw === NONE[f.type] ? null : raw / f.scale;
      };
      return {
        tmax: read('tmax'),
        tmin: read('tmin'),
        rain: read('rain') ?? 0,
        gust: read('gust') ?? 0,
      };
    },
  };
}

export async function loadOptionalClimatePatina() {
  const candidates = ['./data/', '../../lanren/rings/data/'];
  for (const base of candidates) {
    try {
      const metaRes = await fetch(`${base}climate.json`, { cache: 'default' });
      if (!metaRes.ok) continue;
      const meta = await metaRes.json();
      const binRes = await fetch(`${base}climate.bin`, { cache: 'default' });
      if (!binRes.ok) continue;
      const unpacked = unpackClimate(await binRes.arrayBuffer(), meta.days);
      if (unpacked) {
        return {
          available: true,
          lastIso: meta.last,
          source: meta.source || 'ERA5 Haikou Reanalysis',
          getDay: unpacked.get,
        };
      }
    } catch {
      // Offline or path absent — try next candidate silently
    }
  }
  return {
    available: false,
    lastIso: null,
    source: '离线默认木色（几何不依赖天气）',
    getDay: () => null,
  };
}
