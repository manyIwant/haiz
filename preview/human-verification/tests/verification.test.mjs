import test from 'node:test';
import assert from 'node:assert/strict';

import { VerificationState } from '../src/verification/constants.js';
import { VerificationStateMachine } from '../src/verification/stateMachine.js';
import { MockChallengeAdapter, sanitizeSubmission } from '../src/adapters/challengeAdapter.js';
import { PLUSH_CATALOG, registerPlush, getPlushById } from '../src/models/plushCatalog.js';
import { ClawKinematics } from '../src/animations/clawPhysics.js';

test('VerificationStateMachine enforces valid transitions and rejects skips', () => {
  const fsm = new VerificationStateMachine(VerificationState.CLOSED);
  assert.equal(fsm.transition(VerificationState.SUCCESS), false, 'Cannot jump directly from CLOSED to SUCCESS');
  assert.equal(fsm.transition(VerificationState.WAKING), true);
  assert.equal(fsm.transition(VerificationState.SEEKING), true);
  assert.equal(fsm.getStepIndex(), 1);
  assert.equal(fsm.transition(VerificationState.DESCENDING), true);
  assert.equal(fsm.getStepIndex(), 2);
  assert.equal(fsm.transition(VerificationState.GRASPING), true);
  assert.equal(fsm.transition(VerificationState.LIFTING), true);
  assert.equal(fsm.transition(VerificationState.CARRYING), true);
  assert.equal(fsm.getStepIndex(), 3);
  assert.equal(fsm.transition(VerificationState.DROPPING), true);
  assert.equal(fsm.transition(VerificationState.VERIFYING), true);
  assert.equal(fsm.transition(VerificationState.SUCCESS), true);
});

test('MockChallengeAdapter enforces nonce, target match, and single-use replay protection', async () => {
  const adapter = new MockChallengeAdapter({ latencyMs: 1, forcedTargetId: 'lanren-spirit' });
  const chl = await adapter.fetchChallenge();
  assert.equal(chl.targetPlushId, 'lanren-spirit');
  assert.equal(chl.isMock, true);

  // Wrong target is rejected
  const wrongRes = await adapter.verifyAttempt({
    challengeId: chl.challengeId,
    nonce: chl.nonce,
    selectedPlushId: 'campus-cat',
    inputModality: 'joystick',
    elapsedMs: 3200
  });
  assert.equal(wrongRes.verified, false);
  assert.equal(wrongRes.code, 'WRONG_TARGET');

  // Forged nonce is rejected
  const badNonce = await adapter.verifyAttempt({
    challengeId: chl.challengeId,
    nonce: 'forged_nonce',
    selectedPlushId: 'lanren-spirit'
  });
  assert.equal(badNonce.verified, false);
  assert.equal(badNonce.code, 'INVALID_NONCE');

  // Valid submission succeeds once
  const okRes = await adapter.verifyAttempt({
    challengeId: chl.challengeId,
    nonce: chl.nonce,
    selectedPlushId: 'lanren-spirit',
    inputModality: 'keyboard',
    elapsedMs: 4100
  });
  assert.equal(okRes.verified, true);
  assert.ok(okRes.verificationToken.startsWith('haiz_mock_v1.'));

  // Replay of same challengeId is rejected
  const replayRes = await adapter.verifyAttempt({
    challengeId: chl.challengeId,
    nonce: chl.nonce,
    selectedPlushId: 'lanren-spirit'
  });
  assert.equal(replayRes.verified, false);
  assert.equal(replayRes.code, 'CHALLENGE_REPLAYED');
});

test('sanitizeSubmission strips arbitrary/sensitive fields and preserves only minimal challenge telemetry', () => {
  const clean = sanitizeSubmission({
    challengeId: 'chl_1',
    nonce: 'n_1',
    selectedPlushId: 'sunshine-duck',
    inputModality: 'touch',
    elapsedMs: 2500,
    moveSamplesCount: 42,
    attemptIndex: 1,
    cameraFrame: 'SHOULD_BE_DROPPED',
    studentId: 'SHOULD_BE_DROPPED'
  });
  assert.equal('cameraFrame' in clean, false);
  assert.equal('studentId' in clean, false);
  assert.equal(clean.selectedPlushId, 'sunshine-duck');
  assert.equal(clean.inputModality, 'touch');
});

test('ClawKinematics clamps gantry bounds, produces pendulum swing, and detects prize chute', () => {
  const k = new ClawKinematics();
  for (let i = 0; i < 120; i++) {
    k.step(0.016, -1, true, false);
  }
  assert.ok(k.x <= -1.5, 'Claw should move left toward chute');
  assert.equal(k.isOverPrizeChute(), true, 'Claw should be detected over left prize chute');
  assert.ok(Math.abs(k.swingAngle) <= 0.32, 'Swing angle stays physically bounded');
});

test('Modular plush catalog supports runtime registration of seasonal editions', () => {
  assert.equal(PLUSH_CATALOG.length, 6);
  registerPlush(
    { id: 'autumn-lanren-2026', nameZh: '秋红榄仁限定', accentHex: '#B84A39' },
    () => ({})
  );
  const found = getPlushById('autumn-lanren-2026');
  assert.equal(found.nameZh, '秋红榄仁限定');
});
