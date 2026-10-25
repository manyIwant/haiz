const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// The same dependency-free browser script is exercised, without fake DOM APIs or the network.
const context = {};
context.globalThis = context;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../stillroom/quality-governor.js'), 'utf8'), context);
const create = context.HAIZQualityGovernor.createQualityGovernor;

function frames(governor, fps, seconds, initial = 0) {
  const step = 1000 / fps;
  let now = initial;
  for (let i = 0; i < fps * seconds; i++) {
    now += step;
    governor.sample(now);
  }
  return now;
}

test('sustained low FPS degrades quality without disabling the experience', () => {
  const events = [], governor = create({initial:'high',ceiling:'high',windowMs:1000,onChange:(level,why)=>events.push({level,why})});
  frames(governor, 24, 10);
  assert.equal(governor.getLevel(), 'low');
  assert.deepEqual(events.map(x=>x.level), ['medium','low']);
  assert.ok(events.every(x=>x.why.reason === 'sustained-low-fps'));
});

test('a middle FPS band never oscillates the rendering quality', () => {
  const events=[], governor=create({initial:'medium',ceiling:'high',windowMs:1000,onChange:level=>events.push(level)});
  frames(governor,44,20);
  assert.equal(governor.getLevel(),'medium');
  assert.equal(events.length,0);
});

test('recovery is deliberately slower than degradation and never exceeds device ceiling', () => {
  const governor=create({initial:'medium',ceiling:'medium',windowMs:1000});
  frames(governor,24,5);
  assert.equal(governor.getLevel(),'low');
  frames(governor,60,4,6000);
  assert.equal(governor.getLevel(),'low');
  frames(governor,60,12,10000);
  assert.equal(governor.getLevel(),'medium');
});

test('suspending a page does not count hidden throttling as poor performance', () => {
  const governor=create({initial:'high',ceiling:'high',windowMs:1000});
  frames(governor,60,3);
  governor.sample(300000,false);
  frames(governor,60,3,300000);
  assert.equal(governor.getLevel(),'high');
});

test('a stalled frame resets the sample and a reduced-power ceiling is respected', () => {
  const events=[], governor=create({initial:'high',ceiling:'high',windowMs:1000,onChange:(level)=>events.push(level)});
  governor.sample(0); governor.sample(8000);
  assert.equal(governor.getLevel(),'high');
  assert.equal(governor.setCeiling('low'),'low');
  assert.equal(governor.getCeiling(),'low');
  frames(governor,60,20,8000);
  assert.equal(governor.getLevel(),'low');
  assert.deepEqual(events,['low']);
});
