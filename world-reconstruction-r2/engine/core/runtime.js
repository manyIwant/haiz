/**
 * HAIZ · World Reconstruction — Unified Headless-Testable World Runtime Kernel.
 *
 * Single authoritative simulation clock (Haikou UTC+8), campus bell schedule,
 * typed EventBus, and single-loop lifecycle manager. Zero DOM dependency so
 * Node unit tests run the exact same kernel as the browser.
 */

export const HAIKOU_TZ = 8;

export const CAMPUS_SCHEDULE = Object.freeze([
  { from: 0.0, to: 6.5, id: 'night', label: '夜静 · 宿舍熄灯', activeRatio: 0.05 },
  { from: 6.5, to: 7.3, id: 'dawn_walk', label: '晨起 · 早餐与早读途中', activeRatio: 0.85 },
  { from: 7.3, to: 7.9, id: 'morning_read', label: '早读 · 朗朗书声', activeRatio: 0.25 },
  { from: 7.9, to: 9.55, id: 'class_am1', label: '上午正课 · 教学楼', activeRatio: 0.20 },
  { from: 9.55, to: 10.0, id: 'recess', label: '大课间 · 运动场与榄仁树下', activeRatio: 0.95 },
  { from: 10.0, to: 12.15, id: 'class_am2', label: '上午正课 · 实验室与教室', activeRatio: 0.20 },
  { from: 12.15, to: 13.2, id: 'lunch', label: '午餐 · 食堂与林荫道', activeRatio: 0.90 },
  { from: 13.2, to: 14.3, id: 'siesta', label: '午休 · 热带晴午', activeRatio: 0.15 },
  { from: 14.3, to: 16.85, id: 'class_pm', label: '下午课程 · 树影斜长', activeRatio: 0.30 },
  { from: 16.85, to: 18.85, id: 'after_school', label: '放学黄金时刻 · 球场、砚池与骑行', activeRatio: 1.0 },
  { from: 18.85, to: 22.15, id: 'evening_study', label: '晚自习 · 教学楼灯火通明', activeRatio: 0.45 },
  { from: 22.15, to: 24.0, id: 'dismissal', label: '晚自习放学 · 归寝夜风', activeRatio: 0.65 },
]);

export function scheduleAtHour(hour) {
  const h = ((hour % 24) + 24) % 24;
  return CAMPUS_SCHEDULE.find((s) => h >= s.from && h < s.to) || CAMPUS_SCHEDULE[0];
}

export function formatHour(hour) {
  const h = ((hour % 24) + 24) % 24;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export class EventBus {
  constructor() {
    this._map = new Map();
  }
  on(event, fn) {
    if (!this._map.has(event)) this._map.set(event, new Set());
    this._map.get(event).add(fn);
    return () => this.off(event, fn);
  }
  off(event, fn) {
    this._map.get(event)?.delete(fn);
  }
  emit(event, payload) {
    const set = this._map.get(event);
    if (!set) return;
    for (const fn of set) fn(payload);
  }
  clear() {
    this._map.clear();
  }
}

export class WorldRuntime {
  constructor({ initialHour = 16.65, initialWeather = 'clear', initialLens = 0, timeScale = 0.0 } = {}) {
    this.bus = new EventBus();
    this.simTime = 0; // seconds since world start
    this.hour = initialHour;
    this.timeScale = timeScale; // sim hours per real second (0 = paused at selected hour, e.g. 1/60 = 1 min/s)
    this.weather = initialWeather; // 'clear' | 'cloudy' | 'rain' | 'after_rain'
    this.lens = initialLens; // 0 = Sunlit PBR, 1 = Painted Gouache, 2 = Architectural Plan
    this.mode = 'walk'; // 'walk' | 'bike' | 'glide' | 'orbit'
    this.liveClock = false;
    this._lastScheduleId = scheduleAtHour(this.hour).id;
    this._subsystems = [];
    this._loopActive = false;
    this._disposed = false;
  }

  register(name, subsystem) {
    this._subsystems.push({ name, subsystem });
    return subsystem;
  }

  setHour(hour, { silent = false } = {}) {
    this.hour = ((Number(hour) % 24) + 24) % 24;
    this.liveClock = false;
    const sched = scheduleAtHour(this.hour);
    if (sched.id !== this._lastScheduleId) {
      this._lastScheduleId = sched.id;
      if (!silent) this.bus.emit('bell:change', sched);
    }
    if (!silent) this.bus.emit('clock:change', { hour: this.hour, formatted: formatHour(this.hour), schedule: sched });
  }

  setWeather(weather) {
    if (!['clear', 'cloudy', 'rain', 'after_rain'].includes(weather)) return;
    this.weather = weather;
    this.bus.emit('weather:change', { weather });
  }

  setLens(lensIndex) {
    const idx = Math.max(0, Math.min(2, Number(lensIndex) | 0));
    this.lens = idx;
    this.bus.emit('lens:change', { lens: idx });
  }

  setMode(mode) {
    if (!['walk', 'bike', 'glide', 'orbit'].includes(mode)) return;
    const prev = this.mode;
    this.mode = mode;
    this.bus.emit('mode:change', { mode, prev });
  }

  claimRenderLoop() {
    if (this._loopActive) throw new Error('WorldRuntime: duplicate render loop rejected');
    this._loopActive = true;
  }

  step(dtRaw) {
    if (this._disposed) return;
    const dt = Math.min(0.05, Math.max(0.0001, dtRaw));
    this.simTime += dt;

    if (this.liveClock) {
      const now = new Date(Date.now() + HAIKOU_TZ * 3600000);
      this.hour = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
    } else if (this.timeScale !== 0) {
      this.hour = (this.hour + this.timeScale * dt) % 24;
    }

    const sched = scheduleAtHour(this.hour);
    if (sched.id !== this._lastScheduleId) {
      this._lastScheduleId = sched.id;
      this.bus.emit('bell:change', sched);
    }

    for (const { subsystem } of this._subsystems) {
      if (typeof subsystem.update === 'function') {
        subsystem.update(dt, this);
      }
    }
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this._loopActive = false;
    for (const { subsystem } of this._subsystems) {
      if (typeof subsystem.dispose === 'function') subsystem.dispose();
    }
    this._subsystems.length = 0;
    this.bus.clear();
  }
}
