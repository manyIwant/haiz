// What the tree remembers about you — only in this browser.
const KEY = 'haiz.lanren.v1';

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function write(d) {
  try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch { return false; }
}

export class Visits {
  constructor() {
    const d = read();
    this.d = { visits: d.visits || [], leaves: d.leaves || [], seen: d.seen || [] };
    this.previous = this.d.visits[this.d.visits.length - 1] || null;
  }
  arrive(parts, season) {
    const v = { t: Date.now(), m: parts.month, d: parts.day, min: Math.round(parts.minutes), label: season.label };
    const last = this.previous;
    // count a new visit at most once an hour
    if (!last || v.t - last.t > 3600000) {
      this.d.visits.push(v);
      this.d.visits = this.d.visits.slice(-40);
      write(this.d);
    }
  }
  greeting(parts, season) {
    const p = this.previous;
    if (!p) return null;
    const when = `${p.m} 月 ${p.d} 日${partWord(p.min)}`;
    const n = this.d.visits.length;
    if (p.m === parts.month && p.d === parts.day) return `你今天来过了。它还是「${season.label}」。`;
    if (p.label === season.label) return `上次来是 ${when}。它还是「${season.label}」。这是你第 ${n} 次来。`;
    return `上次来是 ${when}，那时「${p.label}」。现在，「${season.label}」。`;
  }
  get leaves() { return this.d.leaves; }
  keep(leaf) {
    this.d.leaves.push(leaf);
    this.d.leaves = this.d.leaves.slice(-60);
    return write(this.d);
  }
  remove(id) { this.d.leaves = this.d.leaves.filter((l) => l.id !== id); write(this.d); }
  clearLeaves() { this.d.leaves = []; write(this.d); }
  markSeen(id) { if (!this.d.seen.includes(id)) { this.d.seen.push(id); write(this.d); } }
}

function partWord(min) {
  const h = min / 60;
  if (h < 6) return '凌晨';
  if (h < 11) return '上午';
  if (h < 13.5) return '中午';
  if (h < 18) return '下午';
  return '晚上';
}
