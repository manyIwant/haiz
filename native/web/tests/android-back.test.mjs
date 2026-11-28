import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backAction } from '../src/platform/back-policy.ts';
const base = { inside: false, search: false, inspector: false, lens: false, canGoBack: false, route: 'today' };
for (const [patch, expected] of [
 [{inside:true,search:true},'painting'],[{search:true,inspector:true},'search'],
 [{inspector:true},'inspector'],[{lens:true},'lens'],[{canGoBack:true},'history'],
 [{route:'tree'},'home'],[{},'minimize']
]) test(JSON.stringify(patch), () => assert.equal(backAction({...base,...patch}),expected));
