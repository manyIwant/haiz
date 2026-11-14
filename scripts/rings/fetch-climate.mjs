#!/usr/bin/env node
// 年轮 · the tree's daily memory.
//
// Fetches one row per day, 1940-01-01 → the latest day the reanalysis has, for the
// campus anchor, and packs it into lanren/rings/data/climate.bin (+ climate.json).
//
//   node scripts/rings/fetch-climate.mjs            full rebuild (≈ 9 requests)
//   node scripts/rings/fetch-climate.mjs --update   re-read the last 120 days and append
//
// Source: ERA5 reanalysis (Copernicus Climate Change Service / ECMWF), served by the
// Open-Meteo Historical Weather API (CC BY 4.0). ERA5 is a model reconstruction on a
// ~25 km grid — not a weather station in the school. One model for the whole span, so
// 1940 and 2026 are comparable. The request carries coordinates and dates only.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { FIELDS, START, pack, unpack, dayIndex, isoOfIndex } from '../../lanren/rings/codec.js';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../lanren/rings/data');
const SITE = { lat: 19.996067, lon: 110.347227 };   // lanren/js/sun.js SITE (assets/walk/campus.json anchor)
const API = 'https://archive-api.open-meteo.com/v1/archive';
const MODEL = 'era5';
const DAILY = ['weather_code', 'temperature_2m_max', 'temperature_2m_min', 'precipitation_sum',
  'wind_speed_10m_max', 'wind_gusts_10m_max', 'wind_direction_10m_dominant', 'cloud_cover_mean'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const iso = (d) => d.toISOString().slice(0, 10);

async function fetchRange(start, end) {
  const q = new URLSearchParams({
    latitude: String(SITE.lat), longitude: String(SITE.lon), start_date: start, end_date: end,
    daily: DAILY.join(','), timezone: 'Asia/Shanghai', models: MODEL
  });
  for (let attempt = 0; ; attempt++) {
    let res;
    try { res = await fetch(`${API}?${q}`, { headers: { 'user-agent': 'tree-rings-build' } }); }
    catch (err) {   // a dropped connection: wait and ask again
      if (attempt >= 5) throw err;
      await sleep(8000 * (attempt + 1));
      continue;
    }
    if (res.ok) return res.json();
    const body = await res.text();
    if ((res.status === 429 || res.status >= 500) && attempt < 5) { await sleep(20000 * (attempt + 1)); continue; }
    throw new Error(`${res.status} ${start}…${end}: ${body.slice(0, 300)}`);
  }
}

/** API response → rows keyed by codec field name (null where the archive has nothing) */
function rowsOf(json) {
  const d = json.daily, n = d.time.length;
  const col = (k) => d[k] || new Array(n).fill(null);
  const rows = [];
  for (let i = 0; i < n; i++) {
    rows.push({ date: d.time[i], tmax: col('temperature_2m_max')[i], tmin: col('temperature_2m_min')[i],
      rain: col('precipitation_sum')[i], wind: col('wind_speed_10m_max')[i], gust: col('wind_gusts_10m_max')[i],
      dir: col('wind_direction_10m_dominant')[i], cloud: col('cloud_cover_mean')[i], code: col('weather_code')[i] });
  }
  return rows;
}

async function main() {
  const update = process.argv.includes('--update');
  const today = new Date(Date.now() + 8 * 3600000);   // Haikou calendar date
  const end = iso(today);
  let rows = [];
  let grid = null;
  if (update) {
    const meta = JSON.parse(await readFile(path.join(OUT, 'climate.json'), 'utf8'));
    const old = unpack(await readFile(path.join(OUT, 'climate.bin')), meta.days);
    for (let i = 0; i < meta.days; i++) rows.push({ date: isoOfIndex(i), ...old.row(i) });
    grid = meta.grid;
    const from = isoOfIndex(Math.max(0, meta.days - 120));
    const fresh = rowsOf(await fetchRange(from, end));
    rows.length = dayIndex(from);
    rows.push(...fresh);
  } else {
    const y1 = today.getUTCFullYear();
    for (let y = +START.slice(0, 4); y <= y1; y += 10) {
      const a = `${y}-01-01`, b = y + 9 >= y1 ? end : `${y + 9}-12-31`;
      process.stdout.write(`fetch ${a} … ${b}\n`);
      const json = await fetchRange(a, b);
      grid ||= { latitude: json.latitude, longitude: json.longitude, elevation: json.elevation };
      rows.push(...rowsOf(json));
      if (b !== end) await sleep(25000);   // stay well inside the free tier's per-minute weight
    }
  }
  // the reanalysis trails the calendar by about five days: drop the empty tail
  while (rows.length && (rows[rows.length - 1].tmax == null || rows[rows.length - 1].rain == null)) rows.pop();
  if (rows.length < 30000) throw new Error(`only ${rows.length} days: refusing to write a truncated archive`);
  for (let i = 0; i < rows.length; i++) if (rows[i].date !== isoOfIndex(i)) throw new Error(`calendar gap at ${rows[i].date}`);
  const bin = pack(rows);
  const sha256 = createHash('sha256').update(bin).digest('hex');
  if (update) {   // nothing new and nothing revised: leave the files (and their date) alone
    const old = await readFile(path.join(OUT, 'climate.bin'));
    if (old.length === bin.length && Buffer.compare(old, Buffer.from(bin)) === 0) { process.stdout.write(`no change (${rows.length} days)\n`); return; }
  }
  const meta = {
    start: START, days: rows.length, last: rows[rows.length - 1].date, sha256,
    fields: FIELDS.map(({ name, type, scale, unit }) => ({ name, type, scale, unit })),
    site: SITE, grid, model: MODEL,
    source: 'ERA5 reanalysis (Copernicus Climate Change Service / ECMWF) via Open-Meteo Historical Weather API',
    licence: 'Open-Meteo data CC BY 4.0; contains modified Copernicus Climate Change Service information',
    caveat: '模式再分析，网格约 25 km；不是校内气象站观测。台风等极端值通常被低估。',
    built: new Date().toISOString().slice(0, 10)
  };
  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, 'climate.bin'), bin);
  await writeFile(path.join(OUT, 'climate.json'), JSON.stringify(meta, null, 2) + '\n');
  process.stdout.write(`wrote ${rows.length} days (${START} … ${meta.last}), ${bin.length} bytes\n`);
}

main().catch((err) => { console.error(err); process.exit(1); });
