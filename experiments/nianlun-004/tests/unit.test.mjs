// NIANLUN 004 · Node unit tests for Living Cambium geometry, fisheye inversion,
// interval free-slot/conflict engine, Zhixuewang-inspired academic analytics,
// CSV score parser, spaced-repetition mistake review generator, absence digest,
// and persistent store + HAIZ Pocket Snapshot v1 compatibility.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  fisheye, fisheyeInv, computeDisplayEdges, cambiumBoost, adaptiveFishD, applyRingDetent
} from '../physics.js';
import {
  freeSlotsForDate, detectConflictsForDate, detectAllConflicts,
  analyzeExam, compareExams, parseScoreImport, buildMistakeReviewPlan,
  buildAbsenceDigest
} from '../analytics.js';
import { NianlunStore, STORAGE_KEY } from '../store.js';
import { TODAY_ISO } from '../content.js';

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k)
  };
}

test('fisheye and fisheyeInv are exact inverses across domain', () => {
  for (const d of [0, 1.5, 4.2, 8.8]) {
    for (const f of [0.1, 0.5, 0.92]) {
      for (const x of [0.05, 0.25, 0.5, 0.78, 0.99]) {
        const y = fisheye(x, f, 0.035, 1.0, d);
        const back = fisheyeInv(y, f, 0.035, 1.0, d);
        assert.ok(Math.abs(back - x) < 1e-9, `mismatch d=${d} f=${f} x=${x} back=${back}`);
      }
    }
  }
});

test('Living Cambium non-uniform edges give current year >= 8x width of historical heartwood ring', () => {
  const nR = 104;
  const base = new Float64Array(nR + 1);
  base[0] = 0.035;
  for (let k = 0; k < nR; k++) base[k + 1] = base[k] + (1 - 0.035) / nR;
  const disp = computeDisplayEdges(base, nR, { scaleMix: 1 });
  const w2026 = disp[nR] - disp[nR - 1];
  const w1950 = disp[28] - disp[27];
  assert.ok(w2026 / w1950 >= 10, `expected >=10x ratio, got ${(w2026 / w1950).toFixed(2)}`);
  assert.ok(Math.abs(disp[0] - 0.035) < 1e-9);
  assert.ok(Math.abs(disp[nR] - 1.0) < 1e-9);
  assert.ok(cambiumBoost(0) > cambiumBoost(3) && cambiumBoost(3) > cambiumBoost(40));
  assert.ok(adaptiveFishD(0.2, 0.035, 1, 1, { coarse: true }) > adaptiveFishD(0.96, 0.035, 1, 1, { coarse: true }));
  // Detent holds previous ring inside hysteresis zone
  assert.equal(applyRingDetent(51, base[51] + (base[52] - base[51]) * 0.05, base, 50, 0.2), 50);
});

test('Demo data has real free slots and detects deliberate 2026-11-26 exam vs personal conflict', () => {
  const store = new NianlunStore(memoryStorage());
  const state = store.getState();
  const freeToday = freeSlotsForDate(state, TODAY_ISO, 25);
  assert.ok(freeToday.length >= 2, `expected >=2 free slots on ${TODAY_ISO}, got ${freeToday.length}`);
  const cfNov26 = detectConflictsForDate(state, '2026-11-26');
  assert.ok(cfNov26.length >= 1, 'expected conflict on 2026-11-26 between physics quiz and club');
  assert.equal(cfNov26[0].severity, 'high');

  // Resolve conflict and verify zero conflicts remain on 2026-11-26
  const personalId = cfNov26[0].a.kind === 'personal' ? cfNov26[0].a.id : cfNov26[0].b.id;
  store.resolveConflict(personalId);
  assert.equal(detectConflictsForDate(store.getState(), '2026-11-26').length, 0);
  assert.equal(detectAllConflicts(store.getState()).length, 0);
});

test('Exam analytics, comparison, CSV score import & mistake-to-review spaced repetition', () => {
  const store = new NianlunStore(memoryStorage());
  const state = store.getState();
  const sep = state.exams.find((e) => e.id === 'ex-2026-09');
  const oct = state.exams.find((e) => e.id === 'ex-2026-10');
  const analysis = analyzeExam(oct, sep);
  assert.equal(analysis.hasScores, true);
  assert.ok(analysis.total > 580 && analysis.deltaTotal > 0);
  assert.ok(analysis.recoverableLost >= 12);
  assert.ok(analysis.lossBreakdown.length >= 3);

  const cmp = compareExams(sep, oct);
  assert.equal(cmp.deltaTotal, analysis.deltaTotal);

  const parsed = parseScoreImport('语文,125,150,111,85\n数学,132,150,108,88\n物理 86/100');
  assert.equal(parsed.ok, true);
  assert.equal(parsed.scores.length, 3);
  assert.equal(parsed.scores[2].score, 86);

  const beforeTasks = store.getState().tasks.length;
  const beforePersonal = store.getState().personal.length;
  const created = store.convertMistakeToReviews('ex-2026-10', 'm-10-1', { baseDateIso: TODAY_ISO, intervals: [1, 3, 7] });
  assert.equal(created.length, 3);
  assert.equal(store.getState().tasks.length, beforeTasks + 3);
  assert.equal(store.getState().personal.length, beforePersonal + 3);
});

test('Absence digest & cross-layer persistence across simulated page reload', () => {
  const mem = memoryStorage();
  const store1 = new NianlunStore(mem);
  const newTask = store1.addTask({ title: '测试持久化物理题', subject: '物理', dueIso: '2026-11-25', estMinutes: 35 });
  const slot = freeSlotsForDate(store1.getState(), '2026-11-25', 30)[0];
  store1.scheduleTaskIntoSlot(newTask.id, { dateIso: '2026-11-25', startMinute: slot.startMinute, endMinute: slot.startMinute + 35 });

  const digest = buildAbsenceDigest(store1.getState(), '2026-11-24', '2026-11-26');
  assert.equal(digest.spanDays, 3);
  assert.ok(digest.missedCourses.length >= 20);
  assert.ok(digest.missedExams.length >= 1);

  // Reload from same storage and verify data persisted
  assert.ok(mem.getItem(STORAGE_KEY));
  const store2 = new NianlunStore(mem);
  const reloadedTask = store2.getState().tasks.find((t) => t.id === newTask.id);
  assert.ok(reloadedTask, 'task must survive reload');
  assert.ok(reloadedTask.scheduledBlockId, 'cross-layer personal schedule link must survive reload');

  // Verify HAIZ Pocket PersonalSnapshot v1 export validity
  const pocket = store2.exportPocketSnapshotV1();
  assert.equal(pocket.version, 1);
  assert.ok(Array.isArray(pocket.tasks) && Array.isArray(pocket.courses));
  assert.ok(pocket.courses.every((c) => c.weekday >= 1 && c.weekday <= 7 && c.endMinute > c.startMinute));
});
