// 年轮 · the on-disk form of the tree's daily memory (climate.bin).
// One column per field, little-endian, one entry per day from START. Pure: used by
// the build script (Node) and by the page.

export const START = '1940-01-01';
const DAY = 86400000;
const T0 = Date.UTC(1940, 0, 1);

// scale: stored = round(value * scale); the type's largest value means "no data"
export const FIELDS = [
  { name: 'tmax', type: 'Int16', scale: 10, unit: '°C' },
  { name: 'tmin', type: 'Int16', scale: 10, unit: '°C' },
  { name: 'rain', type: 'Uint16', scale: 10, unit: 'mm' },
  { name: 'wind', type: 'Uint8', scale: 1, unit: 'km/h' },
  { name: 'gust', type: 'Uint8', scale: 1, unit: 'km/h' },
  { name: 'dir', type: 'Uint8', scale: 0.5, unit: '°' },
  { name: 'cloud', type: 'Uint8', scale: 1, unit: '%' },
  { name: 'code', type: 'Uint8', scale: 1, unit: 'WMO' }
];
const ARRAYS = { Int16: Int16Array, Uint16: Uint16Array, Uint8: Uint8Array };
const NONE = { Int16: 32767, Uint16: 65535, Uint8: 255 };
const FLOOR = { Int16: -32768, Uint16: 0, Uint8: 0 };

export const dayIndex = (iso) => Math.round((Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - T0) / DAY);
export const isoOfIndex = (i) => new Date(T0 + i * DAY).toISOString().slice(0, 10);
export const bytesPerDay = FIELDS.reduce((s, f) => s + ARRAYS[f.type].BYTES_PER_ELEMENT, 0);

/** rows: [{ tmax, tmin, rain, wind, gust, dir, cloud, code }] (null = no data) → Uint8Array */
export function pack(rows) {
  const n = rows.length;
  const out = new Uint8Array(n * bytesPerDay);
  const view = new DataView(out.buffer);
  let off = 0;
  for (const f of FIELDS) {
    const size = ARRAYS[f.type].BYTES_PER_ELEMENT, none = NONE[f.type];
    for (let i = 0; i < n; i++) {
      const v = rows[i][f.name];
      const s = v == null || Number.isNaN(v) ? none : Math.max(FLOOR[f.type], Math.min(none - 1, Math.round(v * f.scale)));
      if (f.type === 'Int16') view.setInt16(off, s, true);
      else if (f.type === 'Uint16') view.setUint16(off, s, true);
      else view.setUint8(off, s);
      off += size;
    }
  }
  return out;
}

/** bytes (ArrayBuffer | Uint8Array | Buffer) → { days, cols: {name: TypedArray}, value(name, i), row(i) } */
export function unpack(bytes, days) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u8.byteLength !== days * bytesPerDay) throw new Error(`climate.bin: expected ${days * bytesPerDay} bytes, got ${u8.byteLength}`);
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const cols = {};
  let off = 0;
  for (const f of FIELDS) {
    const A = ARRAYS[f.type], a = new A(days);
    for (let i = 0; i < days; i++) {
      a[i] = f.type === 'Int16' ? view.getInt16(off, true) : f.type === 'Uint16' ? view.getUint16(off, true) : view.getUint8(off);
      off += A.BYTES_PER_ELEMENT;
    }
    cols[f.name] = a;
  }
  const spec = Object.fromEntries(FIELDS.map((f) => [f.name, f]));
  const value = (name, i) => {
    const s = cols[name][i], f = spec[name];
    return s === NONE[f.type] ? null : s / f.scale;
  };
  const row = (i) => Object.fromEntries(FIELDS.map((f) => [f.name, value(f.name, i)]));
  return { days, cols, value, row };
}
