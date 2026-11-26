/**
 * HAIZ · NIANLUN · 一卷 V4 — Synchronized Semantic Accessibility Layer (Master v4 §5.4, §9.6 B4)
 *
 * Canvas alone is invisible to VoiceOver / TalkBack.
 * This live ARIA list mirrors the exact scroll structure (rolls, expanded days, items, fog ranges)
 * with explicit buttons for reading-mode adjustment (字形→概要→清单→时刻) and day-by-day roll wind/unwind,
 * ensuring screen-reader and keyboard users can independently complete ALL 5 core tasks!
 */

import { WEEKDAY_LABELS, isItemPrivateLocked, getTaskStatusMeta } from '../core/model.js';

export class ScrollA11yMirror {
  constructor(containerEl, store, renderer, gestures, callbacks) {
    this.el = containerEl;
    this.store = store;
    this.renderer = renderer;
    this.gestures = gestures;
    this.callbacks = callbacks;
  }

  sync() {
    if (!this.el) return;
    const days = this.store.days;
    const state = this.store.state;
    const segs = this.renderer.segs || [];

    const frag = document.createDocumentFragment();

    // 1. Announced Fog items (§5.4 explicit range + duration spoken description)
    const fogs = state.items.filter((it) => !it.hiddenByStudent && (it.form === 'fog' || it.form === 'day_fog'));
    if (fogs.length > 0) {
      const fogSection = document.createElement('div');
      fogSection.setAttribute('role', 'region');
      fogSection.setAttribute('aria-label', '时间待定的事项（雾）');
      for (const fg of fogs) {
        const btn = document.createElement('button');
        btn.type = 'button';
        const rangeDesc = fg.form === 'day_fog'
          ? `${fg.dateIso}，具体时刻未定`
          : `时间不确定，可能在 ${fg.fogFromIso || '近期'} 到 ${fg.fogToIso || '之后'} 之间`;
        btn.textContent = `${fg.title}，${rangeDesc}，约 ${fg.durationMinutes || 40} 分钟，来源：${fg.sourceSummary || '群消息'}`;
        btn.addEventListener('click', () => this.callbacks.onSelectItem(fg.id));
        fogSection.appendChild(btn);
      }
      frag.appendChild(fogSection);
    }

    // 2. Mirror every segment (Roll or Expanded Day)
    for (const s of segs) {
      const itemEl = document.createElement('div');
      itemEl.setAttribute('role', 'listitem');

      if (s.roll) {
        const dA = days[s.from].date;
        const dB = days[s.to].date;
        const n = s.to - s.from + 1;
        const spanText = n < 7 ? `${n} 天` : `${Math.ceil(n / 7)} 周`;
        const label = `${s.position === 'past' ? '过去卷' : s.position === 'middle' ? '中间并置卷' : '未来卷'}，${dA.getMonth() + 1}月${dA.getDate()}日到${dB.getMonth() + 1}月${dB.getDate()}日，共${spanText}`;

        const summary = document.createElement('span');
        summary.textContent = label;
        itemEl.appendChild(summary);

        const btnDay = document.createElement('button');
        btnDay.type = 'button';
        btnDay.textContent = `${label} · 卷出一天`;
        btnDay.addEventListener('click', () => this.gestures.windOneDay(s.position, 1, s));
        itemEl.appendChild(btnDay);

        const btnWeek = document.createElement('button');
        btnWeek.type = 'button';
        btnWeek.textContent = `${label} · 展开一周`;
        btnWeek.addEventListener('click', () => this.gestures.unrollSegment(s, 7));
        itemEl.appendChild(btnWeek);
      } else {
        const d = days[s.i];
        const items = (this.renderer._itemsByDay[d.i] || []).filter((it) => !it.isReturnWall);
        const isToday = d.i === this.store.nowIdx;
        const dayHeader = `${d.date.getMonth() + 1}月${d.date.getDate()}日 周${WEEKDAY_LABELS[d.wd]}，${d.isHoliday ? '假期在家' : d.school ? '在校' : '在家'}，${items.length} 件事${isToday ? '，今天' : ''}，当前读法：${s.modeName}`;

        const btnExpand = document.createElement('button');
        btnExpand.type = 'button';
        btnExpand.textContent = `${dayHeader} · 切换读法`;
        btnExpand.addEventListener('click', () => {
          if (s.mode < 2) this.gestures.expandDayToMode(d.i, 'list');
          else if (s.mode === 2) this.gestures.expandDayToMode(d.i, 'hour');
          else {
            d.tw = 1;
            this.gestures.kickAnimation();
          }
        });
        itemEl.appendChild(btnExpand);

        for (const it of items) {
          const locked = isItemPrivateLocked(it, state.privacyLocked);
          const itemBtn = document.createElement('button');
          itemBtn.type = 'button';
          const statusLabel = it.kind === 'task' ? getTaskStatusMeta(it.status).label : it.status;
          itemBtn.textContent = locked
            ? '私密记录（已锁定）'
            : `${it.title}，状态：${statusLabel}${it.dueLabel ? `，截止：${it.dueLabel}` : ''}`;
          itemBtn.addEventListener('click', () => this.callbacks.onSelectItem(it.id));
          itemEl.appendChild(itemBtn);
        }
      }

      frag.appendChild(itemEl);
    }

    this.el.innerHTML = '';
    this.el.appendChild(frag);
  }
}
