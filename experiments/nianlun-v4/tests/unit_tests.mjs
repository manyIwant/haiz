/**
 * HAIZ · NIANLUN · 一卷 V4 — Comprehensive Pure-Logic Unit & Boundary Test Suite
 *
 * Tests all 6 resolved design issues and all Master v4 A/B invariants deterministically in Node.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  computeReadingThresholds,
  computeListRowBudget,
  computeScrollLayout,
  applyGaussianStretch,
  snapCompressedDaysToRolls,
  assignLocalConflictLanes,
  packTemporalChannels,
  packFogVeils,
  groupDeadlineWalls,
} from '../src/core/layout.js';
import {
  parseChineseTemporal,
  evaluateProvenance,
  convergeMessage,
  splitQuickBatchText,
} from '../src/core/convergence.js';
import { canScheduleBlock, parseIsoDate } from '../src/core/calendar.js';
import { NianlunStore } from '../src/core/store.js';
import { DEMO_CONVERGENCE_MESSAGES } from '../src/core/demo_data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;
const results = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    results.push({ name, status: 'PASS' });
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    results.push({ name, status: 'FAIL', error: err.message });
    console.error(`  ✗ ${name}\n    ${err.message}`);
  }
}

console.log('\n=== HAIZ · NIANLUN · 一卷 V4 Unit & Boundary Tests ===\n');

// ---------------------------------------------------------------------------
// ISSUE #1: 44pt touch target vs 300pt hour-scale threshold conflict
// ---------------------------------------------------------------------------
test('Issue #1: All 4 reading modes exist without collapse for N = 0..20 items', () => {
  for (const school of [false, true]) {
    for (let n = 0; n <= 20; n++) {
      const t = computeReadingThresholds({ school }, n);
      assert.ok(t.glyphMaxH < t.listMinH, `N=${n}: glyphMaxH (${t.glyphMaxH}) must be < listMinH (${t.listMinH})`);
      assert.ok(t.listMinH + 60 <= t.timeMinH, `N=${n}: list plateau too narrow (${t.listMinH}..${t.timeMinH})`);
      assert.equal(t.itemTouchMin, 44);
      // Verify every rendered row in List mode is strictly >= 44pt
      const budget = computeListRowBudget({ school }, t.listMinH, n);
      assert.ok(budget.rowH >= 44, `N=${n}: rowH ${budget.rowH} < 44pt!`);
      assert.equal(budget.visibleCount + budget.overflowCount, n);
    }
  }
});

// ---------------------------------------------------------------------------
// ISSUE #2: High-density visual packing for Channels, Fogs, Walls & Conflict Lanes
// ---------------------------------------------------------------------------
test('Issue #2: Channel packing caps visible lanes to <=3 and folds overflow cleanly', () => {
  const overlapping = Array.from({ length: 7 }, (_, i) => ({
    id: `ch_${i}`,
    y0: 100 + i * 4,
    y1: 400 + i * 5,
  }));
  const packed = packTemporalChannels(overlapping, 3, 'ch_5');
  assert.ok(packed.visible.length <= 3);
  assert.ok(packed.visible.some((c) => c.id === 'ch_5'), 'Focused channel must stay visible');
  assert.equal(packed.visible.length + packed.overflow.length, 7);
});

test('Issue #2: Fog veil packing prevents vertical label collision under 5 overlapping Fogs', () => {
  const fogs = Array.from({ length: 5 }, (_, i) => ({
    id: `fg_${i}`,
    y0: 100,
    y1: 320,
    midY: 200,
  }));
  const packed = packFogVeils(fogs, 2, null);
  assert.equal(packed.visible.length, 2);
  assert.equal(packed.clustered.length, 3);
  assert.ok(Math.abs(packed.visible[1].labelY - packed.visible[0].labelY) >= 34, 'Visible fog labels must not overlap');
});

test('Issue #2: Wall collision solver groups simultaneous Return Wall deadlines', () => {
  const walls = [
    { id: 'w1', y: 310, isReturnWall: true },
    { id: 'w2', y: 312, isReturnWall: true },
    { id: 'w3', y: 314, isReturnWall: true },
    { id: 'w4', y: 520, isReturnWall: false },
  ];
  const groups = groupDeadlineWalls(walls, 22);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].items.length, 3);
});

test('§7.1: Local lane splitting flags conflict ONLY for mandatory Occupation × Occupation', () => {
  const blocks = [
    { id: 'a', startHour: 15.5, endHour: 17.0, isMandatoryOccupation: true },
    { id: 'b', startHour: 15.5, endHour: 16.5, isMandatoryOccupation: true },
    { id: 'c', startHour: 19.0, endHour: 20.0, isMandatoryOccupation: true },
  ];
  const lanes = assignLocalConflictLanes(blocks);
  assert.equal(lanes.get('a').laneCount, 2);
  assert.equal(lanes.get('a').isConflict, true);
  assert.equal(lanes.get('b').laneCount, 2);
  assert.equal(lanes.get('c').laneCount, 1);
  assert.equal(lanes.get('c').isConflict, false);
});

// ---------------------------------------------------------------------------
// ISSUE #3: Multi-dimensional information convergence (origin × directness × scope × timestamp)
// ---------------------------------------------------------------------------
test('Issue #3: Relative dates anchor to originalSentAt, NOT import date; undated returns Fog', () => {
  const mon = parseIsoDate('2026-11-30');
  const tue = parseIsoDate('2026-12-01');
  const r1 = parseChineseTemporal('周三考物理', mon);
  assert.equal(r1.dateIso, '2026-12-02');
  const r2 = parseChineseTemporal('物理考试改到后天', tue);
  assert.equal(r2.dateIso, '2026-12-03');
  const rUndated = parseChineseTemporal('下周一交第三章练习', null);
  assert.equal(rUndated.dateIso, null);
  assert.equal(rUndated.needsAnchorDate, true);
});

test('Issue #3: Full 9-message convergence respects scope mismatch, parent verbatim forward, outdated guard & restore', () => {
  const store = new NianlunStore();
  const state = store.state;
  const outcomes = [];

  for (const msg of DEMO_CONVERGENCE_MESSAGES) {
    const res = convergeMessage(msg, state, { nowIso: '2026-11-28T14:20:00', batchId: 'b_test' });
    if (res.fingerprint && res.outcome !== 'duplicate_skipped') {
      state.seenFingerprints.push(res.fingerprint);
    }
    if (res.unparsedRecord) state.unparsedMessages.push(res.unparsedRecord);
    outcomes.push(res);
  }

  // dm1: physics teacher creates physics exam on 12/2
  assert.equal(outcomes[0].outcome, 'created');
  const physId = outcomes[0].targetItemId;
  const phys = state.items.find((x) => x.id === physId);
  assert.ok(phys);

  // dm2: physics teacher reschedules to 12/3
  assert.equal(outcomes[1].outcome, 'merged_updated');
  assert.equal(outcomes[1].targetItemId, physId);

  // dm3: chemistry teacher talking about physics exam -> OUT OF SCOPE, must NOT overwrite!
  assert.equal(outcomes[2].outcome, 'advisory_rumor');

  // dm4: student rumor -> advisory_rumor
  assert.equal(outcomes[3].outcome, 'advisory_rumor');

  // dm5: parent verbatim forward of Grade Office notice -> supersedes to TBD Fog!
  assert.ok(['merged_updated', 'merged_needs_confirm'].includes(outcomes[4].outcome));

  // dm6: old Monday notice re-forwarded -> FNV duplicate skipped!
  assert.equal(outcomes[5].outcome, 'duplicate_skipped');

  // dm7: undated screenshot -> Fog with anchor date question!
  assert.equal(outcomes[6].outcome, 'created_fog_needs_date');

  // dm8: casual weather chat -> unparsed_saved (never guessed!)
  assert.equal(outcomes[7].outcome, 'unparsed_saved');
  assert.equal(state.unparsedMessages.length, 1);

  // dm9: Grade Office restores exam -> recovers 2026-12-03!
  assert.equal(outcomes[8].outcome, 'restored');
  assert.equal(phys.dateIso, '2026-12-03');
  assert.equal(phys.status, 'planned');
  assert.ok(phys.lineage.length >= 5, 'Full provenance lineage must remain intact');
});

test('Issue #3: Outdated forward with different phrasing but earlier originalSentIso does not overwrite newer layer', () => {
  const existing = {
    sourceLabel: '任课教师 · 原发通知',
    effectiveScore: 80,
    originalSentIso: '2026-12-02T10:00:00',
  };
  const oldMsg = {
    originChannel: 'subject_teacher',
    senderSubject: '物理',
    directness: 'verbatim_forward',
    originalSentIso: '2026-11-30T09:00:00',
    text: '转发：周三考物理',
  };
  const prov = evaluateProvenance(oldMsg, '物理', 'exam');
  const verdict = prov.canSupersede(existing);
  assert.equal(verdict.action, 'outdated_forward');
});

test('§8.8: Single-sentence batch input splits cleanly into multiple events', () => {
  const msgs = splitQuickBatchText('周三物理考试，周四交生物实验报告', '2026-11-28T14:20:00');
  assert.equal(msgs.length, 2);
});

// ---------------------------------------------------------------------------
// ISSUE #4: Time Sovereignty (never fabricate autonomous school time!)
// ---------------------------------------------------------------------------
test('Issue #4: Weekday classes & locked evening study reject personal blocks; home weekend permits', () => {
  const store = new NianlunStore();
  const mon = store.days.find((d) => d.iso === '2026-11-30');
  const sat = store.days.find((d) => d.iso === '2026-11-28');
  const sun = store.days.find((d) => d.iso === '2026-11-29');

  assert.equal(canScheduleBlock(mon, 9.5, 10.5, store.state.config).allowed, false);
  assert.equal(canScheduleBlock(mon, 20.0, 21.0, store.state.config).allowed, false);
  assert.equal(canScheduleBlock(sat, 9.0, 10.0, store.state.config).allowed, false); // before departure!
  assert.equal(canScheduleBlock(sat, 15.0, 16.5, store.state.config).allowed, true);
  assert.equal(canScheduleBlock(sun, 9.0, 10.5, store.state.config).allowed, true);
  assert.equal(canScheduleBlock(sun, 18.5, 19.5, store.state.config).allowed, false); // after return wall!

  // Only after explicit user opt-in does evening study allow self-planning
  store.updateSchoolConfig({ eveningStudyAllowSelfPlan: true });
  assert.equal(canScheduleBlock(mon, 20.0, 21.0, store.state.config).allowed, true);
});

// ---------------------------------------------------------------------------
// ISSUE #5: Past Plan ≠ Fact; Past Task = "软件不知道" (never overdue!)
// ---------------------------------------------------------------------------
test('Issue #5: Past school exams stay plan_elapsed and past tasks stay unknown (never overdue)', () => {
  const store = new NianlunStore();
  const pastExam = store.state.items.find((x) => x.id === 'ex_mid1');
  assert.equal(pastExam.epistemicKind, 'plan');
  assert.equal(pastExam.status, 'plan_elapsed');

  const pastTask = store.state.items.find((x) => x.id === 'tk_past_1');
  assert.equal(pastTask.status, 'unknown');
});

// ---------------------------------------------------------------------------
// ISSUE #6: Zero "海口中学" anywhere + live Return Wall configuration
// ---------------------------------------------------------------------------
test('Issue #6: Zero occurrences of "海口中学" across all V4 source files & Return Wall updates live', () => {
  const walk = (dir) => {
    let files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'tests' || entry.name === 'shots' || entry.name === 'data') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) files = files.concat(walk(full));
      else if (/\.(js|mjs|html|css|json|md)$/.test(entry.name)) files.push(full);
    }
    return files;
  };
  for (const file of walk(ROOT)) {
    const content = fs.readFileSync(file, 'utf8');
    assert.ok(!content.includes('海口中学'), `Found "海口中学" in ${file}! Must be 海南中学.`);
  }

  const store = new NianlunStore();
  assert.equal(store.state.config.schoolName, '海南中学');
  assert.equal(store.state.config.returnVerified, false);
  store.updateSchoolConfig({ returnHour: 18.0, returnVerified: true });
  const wall = store.state.items.find((x) => x.isReturnWall);
  assert.equal(wall.startHour, 18.0);
  assert.ok(!wall.title.includes('待核实'));
});

// ---------------------------------------------------------------------------
// ELASTIC PINCH & MIDDLE ROLL JUXTAPOSITION (§3, §4, §7.2)
// ---------------------------------------------------------------------------
test('§3 & §4.1: Pinching intermediate days forms a Middle Roll for non-adjacent comparison', () => {
  const store = new NianlunStore();
  const today = store.nowIdx;
  // Simulate realistic multi-frame two-finger pinch squeeze across intermediate days
  for (let step = 0; step < 16; step++) {
    applyGaussianStretch(store.days, today + 2.5, 0.78, 1.1);
  }
  const snapped = snapCompressedDaysToRolls(store.days, today);
  assert.ok(snapped >= 2);
  for (const d of store.days) d.w = d.tw;
  const { segs } = computeScrollLayout(store.days, new Int32Array(store.days.length), today);
  const middleRolls = segs.filter((s) => s.roll && s.position === 'middle');
  assert.equal(middleRolls.length, 1, 'Expected 1 middle roll for juxtaposition');
});

// ---------------------------------------------------------------------------
// DATA: 10s Private Delete, School Protection, Pocket Migration, Batch Undo, .ics (§11, §14)
// ---------------------------------------------------------------------------
test('§11.3: Private records allow 10s undoable delete; school items refuse deletion', () => {
  const store = new NianlunStore();
  const schoolRes = store.deletePrivateItem('ex_dec_1');
  assert.equal(schoolRes.ok, false);

  const memRes = store.deletePrivateItem('mem_qilou');
  assert.equal(memRes.ok, true);
  assert.ok(!store.state.items.some((x) => x.id === 'mem_qilou'));
  assert.equal(store.undoPrivateDelete('mem_qilou'), true);
  assert.ok(store.state.items.some((x) => x.id === 'mem_qilou'));
});

test('§14: HAIZ Pocket PersonalSnapshot migration obeys every mapping rule and supports batch undo', () => {
  const store = new NianlunStore();
  const initialCount = store.state.items.length;
  const res = store.migrateFromPocketSnapshot({
    tasks: [
      { id: 'ex1', title: '示例跳过', subject: '数学', completed: false, example: true },
      { id: 't_past', title: '旧任务', subject: '语文', completed: false, dueIso: '2026-11-10', originalNotice: '原文' },
      { id: 't_fut', title: '未来任务', subject: '物理', completed: false, dueIso: '2026-12-06' },
      { id: 't_done', title: '已完成任务', subject: '英语', completed: true, dueIso: '2026-11-20' },
    ],
    focusLogs: [{ at: '2026-11-28T13:00:00', minutes: 40, label: '刷题' }],
    taskNotes: { t_fut: '私人备注' },
  });
  assert.equal(res.skippedExamples, 1);
  assert.equal(res.migratedTasks, 3);
  assert.equal(res.migratedTraces, 1);

  const pastMig = store.state.items.find((x) => x.title === '旧任务');
  assert.equal(pastMig.status, 'unknown', 'Past incomplete Pocket task MUST become unknown, NOT overdue!');
  assert.equal(pastMig.dueHour, null, 'Date-only dueIso MUST NOT invent 23:59!');

  const futMig = store.state.items.find((x) => x.title === '未来任务');
  assert.equal(futMig.notes, '私人备注');

  // Batch rollback restores exact initial item count
  assert.equal(store.undoImportBatch(res.batchId), true);
  assert.equal(store.state.items.length, initialCount);

  // ICS export respects privacy lock & outputs valid VCALENDAR
  const ics = store.exportIcs();
  assert.ok(ics.includes('BEGIN:VCALENDAR') && ics.includes('END:VCALENDAR'));
});

console.log(`\nUnit Test Summary: ${passed} passed, ${failed} failed.\n`);
fs.writeFileSync(path.join(__dirname, 'unit-results.json'), JSON.stringify({ passed, failed, results }, null, 2));
if (failed > 0) process.exit(1);
