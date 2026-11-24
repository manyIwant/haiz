/**
 * HAIZ Toybox V2 — Deterministic Verification State Machine
 */

import { VerificationState } from './constants.js';

const TRANSITIONS = Object.freeze({
  [VerificationState.CLOSED]: [VerificationState.WAKING],
  [VerificationState.WAKING]: [VerificationState.SEEKING, VerificationState.ERROR, VerificationState.CLOSED],
  [VerificationState.SEEKING]: [
    VerificationState.DESCENDING,
    VerificationState.VERIFYING,
    VerificationState.ERROR,
    VerificationState.CLOSED
  ],
  [VerificationState.DESCENDING]: [VerificationState.GRASPING, VerificationState.CLOSED],
  [VerificationState.GRASPING]: [VerificationState.LIFTING, VerificationState.CLOSED],
  [VerificationState.LIFTING]: [VerificationState.CARRYING, VerificationState.RETRY_HINT, VerificationState.CLOSED],
  [VerificationState.CARRYING]: [VerificationState.DROPPING, VerificationState.CLOSED],
  [VerificationState.DROPPING]: [
    VerificationState.CELEBRATING,
    VerificationState.VERIFYING,
    VerificationState.RETRY_HINT,
    VerificationState.CLOSED
  ],
  [VerificationState.CELEBRATING]: [VerificationState.VERIFYING, VerificationState.SUCCESS, VerificationState.CLOSED],
  [VerificationState.RETRY_HINT]: [VerificationState.SEEKING, VerificationState.WAKING, VerificationState.CLOSED],
  [VerificationState.VERIFYING]: [
    VerificationState.SUCCESS,
    VerificationState.RETRY_HINT,
    VerificationState.ERROR,
    VerificationState.CLOSED
  ],
  [VerificationState.SUCCESS]: [VerificationState.WAKING, VerificationState.CLOSED],
  [VerificationState.ERROR]: [VerificationState.WAKING, VerificationState.SEEKING, VerificationState.CLOSED]
});

export class VerificationStateMachine {
  constructor(initial = VerificationState.CLOSED) {
    this._state = initial;
  }

  get state() {
    return this._state;
  }

  getStepIndex() {
    switch (this._state) {
      case VerificationState.WAKING:
      case VerificationState.SEEKING:
      case VerificationState.RETRY_HINT:
        return 1;
      case VerificationState.DESCENDING:
      case VerificationState.GRASPING:
      case VerificationState.LIFTING:
        return 2;
      case VerificationState.CARRYING:
      case VerificationState.DROPPING:
      case VerificationState.CELEBRATING:
      case VerificationState.VERIFYING:
      case VerificationState.SUCCESS:
        return 3;
      default:
        return 1;
    }
  }

  canTransition(next) {
    return (TRANSITIONS[this._state] || []).includes(next);
  }

  transition(next) {
    if (next === this._state) return true;
    if (!this.canTransition(next)) return false;
    this._state = next;
    return true;
  }

  forceReset(state = VerificationState.CLOSED) {
    this._state = state;
  }
}
