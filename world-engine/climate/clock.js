// HAIZ World Engine — Unified World Clock, Live Weather & 86-Year ERA5 Climate Archive
//
// Solves HAIZ's 3-way time/weather split:
//   - Live Haikou weather (Open-Meteo + 12h paving water budget via lanren/ruhua/weather)
//   - Free creative weather & 24h time scrubbing
//   - Historical Time Travel directly reading HAIZ's 31,732-day ERA5 archive (1940–2026)
//     from lanren/rings/data/climate.bin + lanren/js/season.js phenology!
//
// ONE authoritative clock & atmosphere snapshot drives sky, sun/moon, rain, wetness,
// Terminalia phenology, campus flora, night-study lamps, NPCs, cat, butterflies, and Science Stations.

import { createSource } from '../../lanren/ruhua/weather/source.js';
import { createWeather } from '../../lanren/ruhua/weather/weather.js';
import {
  haikouClock,
  atHaikouHour,
  sunAt,
  moonAt,
  toWorld,
  palette,
  targets,
  ease,
  rainPulse,
  weatherName,
} from '../../lanren/ruhua/weather/model.js';
import { loadClimate, indexOfDate, dateLabel } from '../../lanren/rings/climate.js';
import { seasonAt, describe as describeSeason } from '../../lanren/js/season.js';
import { CANONICAL_DATUM } from '../spatial/coord.js';

export const ERA_BOOKMARKS = Object.freeze([
  {
    id: 'live',
    label: '海口此刻',
    year: null,
    iso: null,
    hour: null,
    note: '实时海口气象与当前时辰（离线时回退海口月均气候常态）',
  },
  {
    id: '1952-09-01',
    label: '1952 · 府城初秋',
    year: 1952,
    iso: '1952-09-01',
    hour: 8.2,
    note: 'ERA5 历史气象档案 · 五十年代初秋的府城清晨',
  },
  {
    id: '1985-11-18',
    label: '1985 · 榄仁红叶午后',
    year: 1985,
    iso: '1985-11-18',
    hour: 16.4,
    note: 'ERA5 历史气象档案 · 十一月秋色与斜阳穿过老榄仁树',
  },
  {
    id: '2014-07-18',
    label: '2014 · 威马逊台风日',
    year: 2014,
    iso: '2014-07-18',
    hour: 15.0,
    note: 'ERA5 历史气象档案 · 2014 年 7 月 18 日超强台风威马逊登陆海南当日实录数据',
  },
  {
    id: '2023-06-07',
    label: '2023 · 百年校庆仲夏',
    year: 2023,
    iso: '2023-06-07',
    hour: 17.7,
    note: 'ERA5 历史气象档案 · 盛夏傍晚与海口晚霞',
  },
]);

export const WEATHER_PRESETS = Object.freeze([
  { id: 'clear', label: '晴' },
  { id: 'cloudy', label: '多云' },
  { id: 'overcast', label: '阴' },
  { id: 'drizzle', label: '小雨' },
  { id: 'storm', label: '雷阵雨' },
  { id: 'windy', label: '大风' },
  { id: 'after', label: '雨后' },
]);

function dayOfYearFromClock(c) {
  return Math.round((Date.UTC(c.y, c.m - 1, c.d) - Date.UTC(c.y, 0, 1)) / 86400000) + 1;
}

function eraRowToRaw(row, hour) {
  const rainMmDay = Math.max(0, row.rain ?? 0);
  const rainMmHr = rainMmDay > 0.2 ? Math.min(35, rainMmDay / 8) : 0;
  // ERA5 climate.bin stores gust/wind in km/h (e.g. gale >= 62 km/h); convert to m/s
  const windMs = Math.max(0.6, (row.wind ?? (row.gust ? row.gust * 0.62 : 10)) / 3.6);
  const cover = Math.min(100, Math.max(8, row.cloud ?? (rainMmDay > 5 ? 88 : 30)));
  const tMin = row.tmin ?? row.tMin ?? 22;
  const tMax = row.tmax ?? row.tMax ?? 29;
  const diurnal = 0.5 - 0.5 * Math.cos(((hour - 4) / 24) * Math.PI * 2);
  const temp = tMin + (tMax - tMin) * Math.max(0, Math.min(1, diurnal));
  const code = rainMmDay > 45 ? 95 : rainMmDay > 12 ? 63 : rainMmDay > 1.5 ? 61 : cover > 82 ? 3 : cover > 45 ? 2 : 0;
  return {
    temp,
    rh: Math.min(98, Math.max(48, rainMmDay > 3 ? 88 : 70)),
    rain: rainMmHr,
    cover,
    low: cover * (rainMmDay > 2 ? 0.85 : 0.45),
    mid: cover * 0.55,
    high: Math.min(100, cover * 0.45 + 15),
    vis: rainMmDay > 40 ? 2200 : rainMmDay > 5 ? 6500 : 18000,
    wind: windMs,
    gust: windMs * (rainMmDay > 35 ? 1.85 : 1.35),
    windDir: 135,
    rad: Math.max(0, Math.sin(Math.max(0, (hour - 6) / 12) * Math.PI) * 850 * (1 - cover / 140)),
    code,
    eraRainMmDay: rainMmDay,
  };
}

export function createWorldClock({ bus, climateBaseUrl, liveFetch = true } = {}) {
  const source = createSource({
    onUpdate: () => {
      baseWeather.onForecast();
      bus?.emit('weather:change', { mode: modeState.mode, origin: baseWeather.state.origin });
    },
  });
  const baseWeather = createWeather({ source });
  if (liveFetch) source.start();

  let climateArchive = null;
  let climateReady = false;
  let climatePromise = null;

  const modeState = {
    mode: 'live',          // 'live' | 'free' | 'era'
    eraId: 'live',
    eraIso: null,
    eraHour: 15.5,
    eraRow: null,
    eraDateLabel: '海口此刻',
    eraNote: '实时海口气象与当前时辰',
    northBearingDeg: CANONICAL_DATUM.campusNorthBearingDeg, // 319.0° canonical
    timeScale: 1,          // 1 = realtime, >1 = accelerated timelapse
    simClockMs: Date.now(),
    eraCur: null,
    eraSurf: { wet: 0, puddle: 0 },
    sec: 0,
  };

  function ensureArchive() {
    if (!climatePromise) {
      const base = climateBaseUrl || new URL('../../lanren/rings/data/', import.meta.url);
      climatePromise = loadClimate(base)
        .then((archive) => {
          climateArchive = archive;
          climateReady = true;
          bus?.emit('climate:archive-ready', { days: archive.days, lastYear: archive.lastYear });
          if (modeState.mode === 'era' && modeState.eraIso) {
            applyEraDate(modeState.eraIso, modeState.eraHour);
          }
          return archive;
        })
        .catch((err) => {
          console.warn('[WorldClock] ERA5 climate archive unavailable:', err);
          return null;
        });
    }
    return climatePromise;
  }

  function applyEraDate(iso, hour = modeState.eraHour) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return false;
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    modeState.mode = 'era';
    modeState.eraIso = iso;
    modeState.eraHour = ((hour % 24) + 24) % 24;
    const bookmark = ERA_BOOKMARKS.find((b) => b.iso === iso);
    modeState.eraId = bookmark ? bookmark.id : iso;
    modeState.eraNote = bookmark ? bookmark.note : `ERA5 历史气象档案 · ${y}年${mo}月${d}日（模式再分析，非校内观测）`;
    const utcDay = Date.UTC(y, mo - 1, d);
    modeState.simClockMs = atHaikouHour(utcDay + 8 * 3600000, modeState.eraHour);

    if (climateArchive) {
      const idx = climateArchive.clampIndex(indexOfDate(y, mo, d));
      const row = climateArchive.row(idx);
      modeState.eraRow = row;
      modeState.eraDateLabel = dateLabel(idx);
      const rain = row.rain ?? 0;
      modeState.eraSurf = {
        wet: Math.min(1, rain > 0.5 ? 0.45 + rain / 28 : 0.04),
        puddle: Math.min(1, rain > 4 ? (rain - 4) / 36 : 0),
      };
    } else {
      modeState.eraRow = { tmin: 21, tmax: 28, rain: iso === '2014-07-18' ? 140 : 0, gust: iso === '2014-07-18' ? 115 : 12, cloud: iso === '2014-07-18' ? 98 : 30 };
      modeState.eraDateLabel = `${y} 年 ${mo} 月 ${d} 日`;
      modeState.eraSurf = {
        wet: modeState.eraRow.rain > 1 ? 0.92 : 0.05,
        puddle: modeState.eraRow.rain > 10 ? 0.85 : 0,
      };
      ensureArchive();
    }
    // Snap visual easing so ERA jumps feel crisp on frame 1
    modeState.eraCur = null;
    bus?.emit('weather:change', { mode: 'era', iso, hour: modeState.eraHour });
    return true;
  }

  function setLive() {
    modeState.mode = 'live';
    modeState.eraId = 'live';
    modeState.eraIso = null;
    modeState.eraDateLabel = '海口此刻';
    modeState.eraNote = '实时海口气象与当前时辰';
    baseWeather.setLive();
    bus?.emit('weather:change', { mode: 'live' });
  }

  function setFreeWeather(presetId, hour = null) {
    modeState.mode = 'free';
    modeState.eraId = `free:${presetId}`;
    modeState.eraDateLabel = '自由天气';
    modeState.eraNote = '手动调度的校园天气与时刻（所有系统同步响应）';
    const nextHour = hour ?? modeState.eraHour;
    modeState.eraHour = ((nextHour % 24) + 24) % 24;
    baseWeather.setFree(presetId, modeState.eraHour);
    // Advance easing smoothly so initial load starts fully settled in the requested sky
    for (let i = 0; i < 8; i++) baseWeather.update(0.5);
    bus?.emit('weather:change', { mode: 'free', preset: presetId, hour: modeState.eraHour });
  }

  function setHour(hour) {
    const h = ((Number(hour) % 24) + 24) % 24;
    modeState.eraHour = h;
    if (modeState.mode === 'era' && modeState.eraIso) {
      applyEraDate(modeState.eraIso, h);
    } else {
      modeState.mode = 'free';
      baseWeather.setFree(null, h);
      bus?.emit('weather:change', { mode: 'free', hour: h });
    }
  }

  function setTimeScale(scale) {
    modeState.timeScale = Math.max(0, Math.min(720, Number(scale) || 0));
  }

  function update(dt) {
    modeState.sec += dt;

    // Advance time smoothly if timelapse is active
    if (modeState.timeScale > 1 && modeState.mode !== 'live') {
      modeState.eraHour = (modeState.eraHour + (dt * modeState.timeScale) / 3600) % 24;
      if (modeState.mode === 'free') {
        baseWeather.setFree(null, modeState.eraHour);
      } else if (modeState.mode === 'era' && modeState.eraIso) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(modeState.eraIso);
        if (m) {
          const utcDay = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
          modeState.simClockMs = atHaikouHour(utcDay + 8 * 3600000, modeState.eraHour);
        }
      }
    }

    // Step base live/free weather always so its state stays warm
    const baseSnap = baseWeather.update(dt);

    let clockMs, raw, cur, surf, rainNow, origin;
    if (modeState.mode === 'era' && modeState.eraRow) {
      clockMs = modeState.simClockMs;
      raw = eraRowToRaw(modeState.eraRow, modeState.eraHour);
      surf = modeState.eraSurf;
      const tgt = targets(raw, surf);
      if (!modeState.eraCur) {
        modeState.eraCur = { ...tgt, windDir: [...tgt.windDir] };
      } else {
        ease(modeState.eraCur, tgt, dt, 4.0);
      }
      cur = modeState.eraCur;
      rainNow = cur.rain * rainPulse(modeState.sec, raw.code);
      origin = climateReady ? 'era5-archive' : 'era5-fallback';
    } else {
      clockMs = baseSnap.clock;
      raw = baseSnap.raw;
      cur = baseSnap.cur;
      surf = baseSnap.surf;
      rainNow = baseSnap.rainNow;
      origin = modeState.mode === 'free' ? 'free' : baseSnap.origin;
      modeState.eraHour = haikouClock(clockMs).hours;
    }

    // Unified canonical WGS84 + 319.0° campus-north solar & lunar ephemeris
    const DEG = Math.PI / 180;
    const sun = sunAt(clockMs, CANONICAL_DATUM.wgs84.lat, CANONICAL_DATUM.wgs84.lon);
    const moon = moonAt(clockMs, CANONICAL_DATUM.wgs84.lat, CANONICAL_DATUM.wgs84.lon);
    sun.dir = toWorld(sun.alt * DEG, sun.bearing, modeState.northBearingDeg);
    moon.dir = toWorld(moon.alt * DEG, moon.bearing, modeState.northBearingDeg);

    const pal = palette(sun, moon, cur);
    const clk = haikouClock(clockMs);
    const doy = dayOfYearFromClock(clk);
    const phen = seasonAt(doy);
    const phenText = describeSeason(phen);
    const wxWord = weatherName(raw);

    const nightLamps =
      pal.night *
      (clk.hours >= 18.2 && clk.hours < 22.6
        ? 1
        : clk.hours >= 22.6 && clk.hours < 23.6
          ? 1 - (clk.hours - 22.6) * 0.8
          : clk.hours >= 5.5 && clk.hours < 7.2
            ? 0.45
            : 0.14);

    return {
      mode: modeState.mode,
      eraId: modeState.eraId,
      eraIso: modeState.eraIso,
      eraDateLabel: modeState.eraDateLabel,
      eraNote: modeState.eraNote,
      origin,
      clock: clockMs,
      clk,
      dayOfYear: doy,
      time: modeState.sec,
      raw,
      cur,
      surf,
      rainNow,
      sun,
      moon,
      pal,
      nightLamps,
      weatherWord: wxWord,
      phenology: { ...phen, label: phenText },
      caption:
        modeState.mode === 'era'
          ? `${modeState.eraDateLabel} · ${wxWord} · ${Math.round(raw.temp)}°C`
          : `${modeState.mode === 'free' ? '自由天气' : '海口'} · ${wxWord} · ${Math.round(raw.temp)}°C`,
      // Compatibility interface for lanren/ruhua/eco & fx modules
      state: baseWeather.state,
    };
  }

  return {
    ensureArchive,
    applyEraDate,
    setLive,
    setFreeWeather,
    setHour,
    setTimeScale,
    update,
    get archiveReady() { return climateReady; },
    get archive() { return climateArchive; },
    get mode() { return modeState.mode; },
    get baseWeather() { return baseWeather; },
    get northBearingDeg() { return modeState.northBearingDeg; },
    setNorthBearingDeg(deg) { modeState.northBearingDeg = Number(deg) || CANONICAL_DATUM.campusNorthBearingDeg; },
  };
}
