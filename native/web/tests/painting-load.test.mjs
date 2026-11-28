import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paintingLoadState } from '../src/platform/painting-load.ts';
for (const [stage,ms,want] of [['ready',100,'ready'],['failed',100,'failed'],['loading',100,'waiting'],['loading',90000,'timeout'],['ready',90001,'ready']]) {
 test(`${stage} at ${ms}ms`,()=>assert.equal(paintingLoadState(stage,ms),want));
}
