/**
 * HAIZ Human Verification — Deterministic Verification State Machine
 */

import { VerificationState } from './constants.js';

const ALLOWED_TRANSITIONS = Object.freeze({
  [VerificationState.IDLE]: [VerificationState.WAKING, VerificationState.CLOSED],
  [VerificationState.WAKING]: [VerificationState.SEEKING, VerificationState.ERROR, VerificationState.CLOSED],
  [VerificationState.SEEKING]: [
    VerificationState.DESCENDING,
    VerificationState.VERIFYING, // accessibility direct submit
    VerificationState.ERROR,
    VerificationState.CLOSED
  ],
  [VerificationState.DESCENDING]: [VerificationState.GRASPING, VerificationState.CLOSED],
  [VerificationState.GRASPING]: [VerificationState.LIFTING, VerificationState.CLOSED],
  [VerificationState.LIFTING]: [
    VerificationState.CARRYING,
    VerificationState.RETRY_HINT,
    VerificationState.CLOSED
  ],
  [VerificationState.CARRYING]: [VerificationState.DROPPING, VerificationState.CLOSED],
  [VerificationState.DROPPING]: [
    VerificationState.VERIFYING,
    VerificationState.RETRY_HINT,
    VerificationState.CLOSED
  ],
  [VerificationState.RETRY_HINT]: [VerificationState.SEEKING, VerificationState.WAKING, VerificationState.CLOSED],
  [VerificationState.VERIFYING]: [
    VerificationState.SUCCESS,
    VerificationState.RETRY_HINT,
    VerificationState.ERROR,
    VerificationState.CLOSED
  ],
  [VerificationState.SUCCESS]: [VerificationState.WAKING, VerificationState.CLOSED],
  [VerificationState.ERROR]: [VerificationState.WAKING, VerificationState.SEEKING, VerificationState.CLOSED],
  [VerificationState.CLOSED]: [VerificationState.WAKING, VerificationState.IDLE]
});

export class VerificationStateMachine {
  constructor(initialState = VerificationState.IDLE) {
    this._state = initialState;
    this._listeners = new Set();
  }

  get state() {
    return this._state;
  }

  getStepIndex() {
    switch (this._state) {
      case VerificationState.WAKING:
      case VerificationState.SEEKING:
      case VerificationState.RETRY_HINT:
        return 1; // 01 移动
      case VerificationState.DESCENDING:
      case VerificationState.GRASPING:
      case VerificationState.LIFTING:
        return 2; // 02 抓取
      case VerificationState.CARRYING:
      case VerificationState.DROPPING:
      case VerificationState.VERIFYING:
      case VerificationState.SUCCESS:
        return 3; // 03 投放
      default:
        return 1;
    }
  }

  canTransition(nextState) {
    const allowed = ALLOWED_TRANSITIONS[this._state] || [];
    return allowed.includes(nextState);
  }

  transition(nextState, meta = {}) {
    if (nextState === this._state) return true;
    if (!this.canTransition(nextState)) {
      return false;
    }
    const prev = this._state;
    this._state = nextState;
    this._listeners.forEach((fn) => {
      try {
        fn({ prev, next: nextState, meta });
      } catch (_err) {
        // Isolate subscriber errors from state integrity
      }
    });
    return true;
  }

  forceReset(state = VerificationState.IDLE) {
    const prev = this._state;
    this._state = state;
    this._listeners.forEach((fn) => {
      try {
        fn({ prev, next: state, meta: { forced: true } });
      } catch (_err) {}
    });
  }

  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }
}
