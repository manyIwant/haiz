import assert from 'node:assert/strict';
import {
  isLeapYear,
  daysInYear,
  daysInMonth,
  makeUtcFromObserverLocal,
  getObserverLocalParts,
  addMonthsObserver,
  addYearsObserver,
  getSunTimesAndPosition,
  getLunarPhase,
  getSolarTermInfo,
} from '../js/astro.js';
import {
  polarToXY,
  xyToPolar,
  computeScaleLayout,
  getScaleProgressAngle,
} from '../js/polar.js';
import { occursOnDate } from '../js/events.js';

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`✓ ${name}`);
}

test('Leap year & month day counts', () => {
  assert.equal(isLeapYear(2000), true);
  assert.equal(isLeapYear(1900), false);
  assert.equal(isLeapYear(2024), true);
  assert.equal(isLeapYear(2026), false);
  assert.equal(daysInYear(2024), 366);
  assert.equal(daysInYear(2026), 365);
  assert.equal(daysInMonth(2024, 2), 29);
  assert.equal(daysInMonth(2026, 2), 28);
  assert.equal(daysInMonth(2026, 11), 30);
});

test('Cross-year & leap-day clamping in addMonthsObserver / addYearsObserver', () => {
  const feb29 = makeUtcFromObserverLocal(2024, 2, 29, 12, 0, 0, 8);
  const nextYear = addYearsObserver(feb29, 1, 8);
  const p = getObserverLocalParts(nextYear, 8);
  assert.equal(p.year, 2025);
  assert.equal(p.month, 2);
  assert.equal(p.day, 28);

  const dec31 = makeUtcFromObserverLocal(2026, 12, 31, 23, 30, 0, 8);
  const jan = addMonthsObserver(dec31, 1, 8);
  const pj = getObserverLocalParts(jan, 8);
  assert.equal(pj.year, 2027);
  assert.equal(pj.month, 1);
  assert.equal(pj.day, 31);
});

test('Lunar phase calibration: 2024-04-08 New Moon & 2000-01-21 Full Moon', () => {
  const newMoon = getLunarPhase(Date.UTC(2024, 3, 8, 18, 20, 0));
  assert.ok(newMoon.illumination < 0.02, `Expected < 2% illumination, got ${newMoon.illumination}`);
  assert.equal(newMoon.name, '新月');

  const fullMoon = getLunarPhase(Date.UTC(2000, 0, 21, 4, 40, 0));
  assert.ok(fullMoon.illumination > 0.98, `Expected > 98% illumination, got ${fullMoon.illumination}`);
  assert.equal(fullMoon.name, '满月');
});

test('Solar ephemeris: Haikou summer solstice vs winter solstice day length', () => {
  const summer = makeUtcFromObserverLocal(2026, 6, 21, 12, 0, 0, 8);
  const winter = makeUtcFromObserverLocal(2026, 12, 21, 12, 0, 0, 8);
  const sunS = getSunTimesAndPosition(summer, 20.044, 110.199, 8);
  const sunW = getSunTimesAndPosition(winter, 20.044, 110.199, 8);
  assert.ok(sunS.dayLengthMin > 780, 'Summer day in Haikou > 13h');
  assert.ok(sunW.dayLengthMin < 680, 'Winter day in Haikou < 11h20m');
  assert.ok(sunS.sunriseMin < sunW.sunriseMin, 'Summer sunrise earlier than winter');
});

test('Solar terms: Xiaoxue around Nov 22 & Dongzhi around Dec 21', () => {
  const nov25 = makeUtcFromObserverLocal(2026, 11, 25, 12, 0, 0, 8);
  const st = getSolarTermInfo(nov25);
  assert.equal(st.current.name, '小雪');

  const dec22 = makeUtcFromObserverLocal(2026, 12, 22, 12, 0, 0, 8);
  const st2 = getSolarTermInfo(dec22);
  assert.equal(st2.current.name, '冬至');
});

test('Polar round-trip & continuous scale layout non-overlapping', () => {
  for (const ang of [0, 45, 90, 180, 270, 359.5]) {
    const { x, y } = polarToXY(250, ang);
    const back = xyToPolar(x, y);
    assert.ok(Math.abs(back.r - 250) < 1e-6);
    assert.ok(Math.abs(back.angle - ang) < 1e-6);
  }

  for (let sigma = 0; sigma <= 5; sigma += 0.25) {
    const layout = computeScaleLayout(sigma);
    for (const ring of layout) {
      assert.ok(ring.rOuter > ring.rInner, `Ring ${ring.id} at sigma=${sigma} has rOuter <= rInner`);
    }
  }
});

test('Day progress angle: 12:00 at 0° (top), 00:00 at 180° (bottom)', () => {
  const noon = getObserverLocalParts(makeUtcFromObserverLocal(2026, 11, 25, 12, 0, 0, 8), 8);
  const mid = getObserverLocalParts(makeUtcFromObserverLocal(2026, 11, 25, 0, 0, 0, 8), 8);
  assert.equal(getScaleProgressAngle('day', noon), 0);
  assert.equal(getScaleProgressAngle('day', mid), 180);
});

test('Monthly & yearly recurrence handles leap day Feb 29 gracefully', () => {
  const ev = { date: '2024-02-29', recurrence: 'yearly' };
  assert.equal(occursOnDate(ev, 2024, 2, 29, 8), true);
  assert.equal(occursOnDate(ev, 2025, 2, 28, 8), true);
  assert.equal(occursOnDate(ev, 2026, 2, 28, 8), true);
  assert.equal(occursOnDate(ev, 2023, 2, 28, 8), false); // before start date
});

console.log(`\nAll ${passed} astronomical, polar & calendar tests passed.`);
