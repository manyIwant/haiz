/**
 * HAIZ · NIANLUN · 一卷 V4 — Campus Schedule, Boundaries, Privacy & Accessibility Settings
 *
 * Addresses:
 *  - Issue #6: 海南中学 configurable departure / return / evening study with explicit "待核实" badges
 *  - Issue #4: Explicit sovereignty toggle for evening study (default OFF)
 *  - Issue #1 & #2: Live High-Density Stress Scenario toggle
 *  - Master v4 §12: Semester / Holiday / Graduation / Transfer / Leave boundaries + Shared-phone Privacy Lock
 *  - Master v4 §9.6: Theme, Reduced Motion, Low-Power Texture toggle, Left-handed end-face mirror, Foley toggle
 *  - Honest demo data disclosure + Switch to clean blank mode + JSON backup download
 */

import { formatHour } from '../core/model.js';
import { clearWoodTextureCache } from '../render/wood_textures.js';

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hourToTimeInput(hr) {
  return formatHour(hr);
}

function timeInputToHour(val, fallback) {
  const parts = String(val || '').split(':').map(Number);
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return fallback;
  return parts[0] + parts[1] / 60;
}

export function renderSettingsSheet(container, { store, climateRef, onClose, onRefresh, onToast }) {
  const state = store.state;
  const cfg = state.config;
  const climate = climateRef && climateRef.current;

  function paint() {
    container.innerHTML = `
      <div class="sheet-head">
        <div>
          <span class="eyebrow">作息、边界与隐私</span>
          <h2>${esc(cfg.schoolName)} · 个人配置</h2>
        </div>
        <button class="icon-btn" data-close aria-label="关闭设置">✕</button>
      </div>
      <div class="sheet-body">
        <!-- Issue #6: Hainan Middle School configurable schedule -->
        <section class="sheet-sec">
          <div class="sec-label">海南中学离返校与晚修时刻（未完全核实 · 均可自行修改）</div>
          <p class="muted small">${esc(cfg.scheduleReferenceNote)}</p>
          <div class="form-grid-2" style="margin-top:8px">
            <label>周六离校时刻 ${cfg.departureVerified ? '<span class="ok-badge">已核实</span>' : '<span class="pending-badge">待确认</span>'}
              <input type="time" data-cfg="departureHour" value="${hourToTimeInput(cfg.departureHour)}">
            </label>
            <label>周日返校时刻（返校墙） ${cfg.returnVerified ? '<span class="ok-badge">已核实</span>' : '<span class="pending-badge">待确认</span>'}
              <input type="time" data-cfg="returnHour" value="${hourToTimeInput(cfg.returnHour)}">
            </label>
            <label>晚修开始 ${cfg.eveningStudyVerified ? '' : '<span class="pending-badge">参考夏季</span>'}
              <input type="time" data-cfg="eveningStudyStart" value="${hourToTimeInput(cfg.eveningStudyStart)}">
            </label>
            <label>晚修结束
              <input type="time" data-cfg="eveningStudyEnd" value="${hourToTimeInput(cfg.eveningStudyEnd)}">
            </label>
            <label>入学日期（决定过去卷年轮圈数）
              <input type="date" data-cfg="enrollmentIso" value="${esc(cfg.enrollmentIso)}">
            </label>
            <label>学期结束（决定未来卷圈数）
              <input type="date" data-cfg="semesterEndIso" value="${esc(cfg.semesterEndIso)}">
            </label>
          </div>
          <label class="toggle-row">
            <input type="checkbox" data-cfg-bool="returnVerified" ${cfg.returnVerified ? 'checked' : ''}>
            <span>我已核实本班周六离校与周日返校时刻</span>
          </label>
          <label class="toggle-row">
            <input type="checkbox" data-cfg-bool="eveningStudyAllowSelfPlan" ${cfg.eveningStudyAllowSelfPlan ? 'checked' : ''}>
            <span>允许我在晚修时段安排个人学习块（默认关闭，不虚构在校自由时间）</span>
          </label>
        </section>

        <!-- Master v4 §12: Shared-Phone Privacy Lock -->
        <section class="sheet-sec">
          <div class="sec-label">共用手机隐私锁（§12）</div>
          <p class="muted small">开启后，卷面、搜索结果、年轮端面琥珀记忆点与纸质导出均会隐藏你的私人记录与备注，只保留学校安排与考试点。</p>
          <label class="toggle-row">
            <input type="checkbox" data-pref="privacyLocked" ${state.privacyLocked ? 'checked' : ''}>
            <span>开启隐私锁（当前：${state.privacyLocked ? '已锁定私人记录' : '正常可见'}）</span>
          </label>
        </section>

        <!-- Issue #1 & #2: Live High-Density Stress Validation Toggle -->
        <section class="sheet-sec">
          <div class="sec-label">边界与高密度验证场景（演示检验用）</div>
          <label class="toggle-row">
            <input type="checkbox" data-toggle-stress ${state.highDensityStress ? 'checked' : ''}>
            <span>开启「高密度考前周」压力测试（周六 8 项 + 4 层重叠雾 + 6 条并发槽）</span>
          </label>
          <div class="sec-label" style="margin-top:10px">人生与学期边界模式（§12）</div>
          <div class="chip-grid">
            ${[
              ['normal', '正常学期'],
              ['holiday', '寒暑假（每天在家）'],
              ['on_leave', '休学 / 长期不在校'],
              ['transferred', '转学（保留旧校来源）'],
              ['graduated', '毕业封卷（仍可改可导）'],
            ].map(([id, lab]) => `<button class="chip ${cfg.boundaryMode === id ? 'active' : ''}" data-boundary="${id}">${lab}</button>`).join('')}
          </div>
        </section>

        <!-- Visual, Tactile & Accessibility Controls (§9.6) -->
        <section class="sheet-sec">
          <div class="sec-label">视觉、手感与无障碍</div>
          <div class="chip-grid">
            ${[['auto', '跟随系统'], ['light', '宣纸浅色'], ['dark', '胡桃深色']].map(([id, lab]) =>
              `<button class="chip ${state.theme === id ? 'active' : ''}" data-theme-set="${id}">${lab}</button>`
            ).join('')}
          </div>
          <label class="toggle-row">
            <input type="checkbox" data-pref="leftHandedDial" ${state.leftHandedDial ? 'checked' : ''}>
            <span>左手镜像（将年轮端面移至卷轴左侧，方便左手拇指拨轮）</span>
          </label>
          <label class="toggle-row">
            <input type="checkbox" data-pref="reducedMotionOverride" ${state.reducedMotionOverride ? 'checked' : ''}>
            <span>减少动态效果（形变与卷曲直接到位，保留静态纹理）</span>
          </label>
          <label class="toggle-row">
            <input type="checkbox" data-pref="lowPowerTextureOff" ${state.lowPowerTextureOff ? 'checked' : ''}>
            <span>低端设备轻量模式（关闭木纹颗粒与纸张纤维，保障流畅帧率）</span>
          </label>
          <label class="toggle-row">
            <input type="checkbox" data-pref="soundEnabled" ${state.soundEnabled ? 'checked' : ''}>
            <span>轻微木质拨轮声效（纯 WebAudio 合成，默认静音）</span>
          </label>
        </section>

        <!-- Honest Provenance, Climate Patina & Data Control -->
        <section class="sheet-sec">
          <div class="sec-label">数据诚实度与本地备份</div>
          <p class="muted small">
            天气纹理状态：${climate && climate.available ? `已加载海口 ERA5 真实气象档案（截至 ${esc(climate.lastIso)}），仅调制木色，绝不改变年轮圈宽。` : '离线默认榄仁木色（年轮几何完全由日历决定）。'}
          </p>
          <div class="btn-row" style="margin-top:8px">
            <button class="btn" data-export-json>导出本地 JSON 备份</button>
            <button class="btn" data-switch-blank>${state.isDemoActive ? '清空演示数据 · 进入空白真实模式' : '恢复海南中学演示数据'}</button>
          </div>
        </section>
      </div>
    `;

    container.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', onClose));

    // Time & date config inputs
    container.querySelectorAll('[data-cfg]').forEach((inp) => {
      inp.addEventListener('change', () => {
        const key = inp.dataset.cfg;
        if (key.endsWith('Iso')) {
          store.updateSchoolConfig({ [key]: inp.value });
        } else {
          const val = timeInputToHour(inp.value, cfg[key]);
          store.updateSchoolConfig({ [key]: val });
        }
        clearWoodTextureCache();
        onRefresh();
        onToast('已更新海南中学作息配置，卷面与年轮已同步。');
      });
    });

    container.querySelectorAll('[data-cfg-bool]').forEach((chk) => {
      chk.addEventListener('change', () => {
        const key = chk.dataset.cfgBool;
        if (key === 'returnVerified') {
          store.updateSchoolConfig({ returnVerified: chk.checked, departureVerified: chk.checked });
        } else {
          store.updateSchoolConfig({ [key]: chk.checked });
        }
        onRefresh();
        paint();
      });
    });

    // Preferences
    container.querySelectorAll('[data-pref]').forEach((chk) => {
      chk.addEventListener('change', () => {
        const key = chk.dataset.pref;
        state[key] = chk.checked;
        if (key === 'lowPowerTextureOff') clearWoodTextureCache();
        store.emit('pref_change');
        onRefresh();
        paint();
      });
    });

    // High-density stress toggle
    container.querySelector('[data-toggle-stress]')?.addEventListener('change', (e) => {
      store.toggleHighDensityStress(e.target.checked);
      onRefresh();
      onToast(e.target.checked
        ? '已注入高密度考前周场景（周六 8 项 + 4 雾 + 6 槽），请检验 44pt 触控与叠层清晰度。'
        : '已恢复常规演示密度。');
      paint();
    });

    // Boundary simulation modes
    container.querySelectorAll('[data-boundary]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.boundary;
        const patch = { boundaryMode: mode };
        if (mode === 'transferred') {
          patch.schoolName = '新转入中学（旧记录保留海南中学标注）';
        } else {
          patch.schoolName = '海南中学';
        }
        store.updateSchoolConfig(patch);
        clearWoodTextureCache();
        onRefresh();
        onToast(`已切换边界模式：${btn.textContent}`);
        paint();
      });
    });

    // Theme
    container.querySelectorAll('[data-theme-set]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.theme = btn.dataset.themeSet;
        if (state.theme === 'auto') delete document.documentElement.dataset.theme;
        else document.documentElement.dataset.theme = state.theme;
        clearWoodTextureCache();
        store.emit('theme_change');
        onRefresh();
        paint();
      });
    });

    // Export JSON
    container.querySelector('[data-export-json]')?.addEventListener('click', () => {
      const json = store.exportJsonBackup();
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `haiz-nianlun-v4-backup-${state.nowIso}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      onToast('已导出本地 JSON 备份（私人文件未加密，请勿发公开群）。');
    });

    // Switch blank vs demo
    container.querySelector('[data-switch-blank]')?.addEventListener('click', () => {
      const goBlank = state.isDemoActive;
      store.resetToMode({ blankMode: goBlank });
      clearWoodTextureCache();
      onRefresh();
      onToast(goBlank ? '已进入空白真实模式：年轮按入学日历自然生长，空白周仍是完整的木头。' : '已恢复海南中学（府城校区）演示数据。');
      onClose();
    });
  }

  paint();
}
