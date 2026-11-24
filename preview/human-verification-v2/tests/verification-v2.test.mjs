import test from 'node:test';
import assert from 'node:assert/strict';

import { VerificationState } from '../src/verification/constants.js';
import { VerificationStateMachine } from '../src/verification/stateMachine.js';
import { MockToyboxAdapter, sanitizeChallengeSubmission } from '../src/adapters/verificationAdapter.js';
import { CHARACTER_REGISTRY, registerCharacter, getCharacterMeta } from '../src/toybox/characterRegistry.js';
import { createToyboxCharacter } from '../src/toybox/characters.js';
import { exportNodeToGLB } from '../src/toybox/glbExporter.js';
import { ClawKinematics } from '../src/animations/clawPhysics.js';

test('V2 State Machine enforces valid transitions and rejects skipping verification', () => {
  const fsm = new VerificationStateMachine(VerificationState.CLOSED);
  assert.equal(fsm.transition(VerificationState.SUCCESS), false);
  assert.equal(fsm.transition(VerificationState.WAKING), true);
  assert.equal(fsm.transition(VerificationState.SEEKING), true);
  assert.equal(fsm.transition(VerificationState.DESCENDING), true);
  assert.equal(fsm.transition(VerificationState.GRASPING), true);
  assert.equal(fsm.transition(VerificationState.LIFTING), true);
  assert.equal(fsm.transition(VerificationState.CARRYING), true);
  assert.equal(fsm.transition(VerificationState.DROPPING), true);
  assert.equal(fsm.transition(VerificationState.VERIFYING), true);
  assert.equal(fsm.transition(VerificationState.SUCCESS), true);
});

test('MockToyboxAdapter enforces layout permutation, nonce, Turnstile token hook, and single-use consumption', async () => {
  const adapter = new MockToyboxAdapter({ latencyMs: 1, forcedTargetId: 'lanren-spirit', requireAntiBotToken: true });
  const chl = await adapter.fetchChallenge();
  assert.equal(chl.targetCharacterId, 'lanren-spirit');
  assert.equal(chl.layoutOrder.length, 6);
  assert.equal(chl.isMock, true);

  const noTurnstile = await adapter.verifyChallenge({
    challengeId: chl.challengeId,
    nonce: chl.nonce,
    selectedCharacterId: 'lanren-spirit'
  });
  assert.equal(noTurnstile.verified, false);
  assert.equal(noTurnstile.code, 'MISSING_ANTIBOT_TOKEN');

  const wrongChar = await adapter.verifyChallenge({
    challengeId: chl.challengeId,
    nonce: chl.nonce,
    selectedCharacterId: 'campus-cat',
    antiBotToken: 'cf_turnstile_sample_token'
  });
  assert.equal(wrongChar.verified, false);
  assert.equal(wrongChar.code, 'WRONG_CHARACTER');

  const ok = await adapter.verifyChallenge({
    challengeId: chl.challengeId,
    nonce: chl.nonce,
    selectedCharacterId: 'lanren-spirit',
    antiBotToken: 'cf_turnstile_sample_token',
    inputModality: 'joystick',
    elapsedMs: 3900
  });
  assert.equal(ok.verified, true);
  assert.ok(ok.verificationToken.startsWith('haiz_v2_mock.'));

  const replay = await adapter.verifyChallenge({
    challengeId: chl.challengeId,
    nonce: chl.nonce,
    selectedCharacterId: 'lanren-spirit',
    antiBotToken: 'cf_turnstile_sample_token'
  });
  assert.equal(replay.verified, false);
  assert.equal(replay.code, 'CHALLENGE_CONSUMED');
});

test('AbortController cleanly aborts in-flight challenge requests', async () => {
  const adapter = new MockToyboxAdapter({ latencyMs: 120 });
  const ctrl = new AbortController();
  const promise = adapter.fetchChallenge(ctrl.signal);
  ctrl.abort();
  await assert.rejects(promise, (err) => err && err.name === 'AbortError');
});

test('sanitizeChallengeSubmission strips biometric and personal fields', () => {
  const clean = sanitizeChallengeSubmission({
    challengeId: 'c1',
    nonce: 'n1',
    selectedCharacterId: 'sunshine-duck',
    antiBotToken: 'tok_123',
    inputModality: 'touch',
    elapsedMs: 2800,
    faceImage: 'DROP_ME',
    fingerprint: 'DROP_ME',
    mouseTrajectory: [1, 2, 3]
  });
  assert.equal('faceImage' in clean, false);
  assert.equal('fingerprint' in clean, false);
  assert.equal('mouseTrajectory' in clean, false);
  assert.equal(clean.antiBotToken, 'tok_123');
});

test('All 6 Campus Toybox characters build, animate, and export valid glTF 2.0 (.glb) binaries', () => {
  assert.equal(CHARACTER_REGISTRY.length, 6);
  for (const meta of CHARACTER_REGISTRY) {
    const char = createToyboxCharacter(meta.id);
    assert.equal(char.id, meta.id);
    char.animate(1.2, 0.016, 'idle', false);
    char.animate(1.2, 0.016, 'grabbed', false);
    char.animate(1.2, 0.016, 'celebrate', false);

    const glb = exportNodeToGLB(char.root, char.id);
    assert.ok(glb instanceof Uint8Array);
    assert.ok(glb.byteLength > 2000, `${meta.id} GLB should contain full geometry`);
    const dv = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
    assert.equal(dv.getUint32(0, true), 0x46546c67, 'Valid glTF magic header');
    assert.equal(dv.getUint32(4, true), 2, 'glTF version 2');
    assert.equal(dv.getUint32(8, true), glb.byteLength, 'Exact GLB byteLength');
  }
});

test('ClawKinematics detects prize chute and respects cabinet bounds', () => {
  const k = new ClawKinematics();
  for (let i = 0; i < 120; i++) k.step(0.016, -1, true, false);
  assert.equal(k.isOverPrizeChute(), true);
  assert.ok(k.x >= -1.86);
});

test('registerCharacter allows extensible seasonal Campus Toybox additions', () => {
  registerCharacter({ id: 'winter-lanren-2026', nameZh: '冬日榄仁限定', accentHex: '#A64B3C' }, () => createToyboxCharacter('lanren-spirit'));
  assert.equal(getCharacterMeta('winter-lanren-2026').nameZh, '冬日榄仁限定');
});
