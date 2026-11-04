import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSave, recordWin } from '../src/save.js';

const campaignWin = (overrides = {}) => ({
  seed: 'garden:999', moves: 42, usedHint: false, mode: 'campaign', level: 999, ...overrides,
});

test('save normalization preserves valid progress beyond level 999', () => {
  const stored = { level: 1000, records: { 'garden:999': 42 }, sound: true };
  const save = normalizeSave(stored);
  assert.deepEqual(save, stored);
  save.records['garden:999'] = 40;
  assert.equal(stored.records['garden:999'], 42);
  assert.equal(normalizeSave({ level: Number.MAX_SAFE_INTEGER }).level, Number.MAX_SAFE_INTEGER);
});

test('save normalization rejects invalid levels, records, and truthy sound values', () => {
  for (const level of [undefined, null, 0, -1, 1.5, '7', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(normalizeSave({ level }).level, 1);
  }
  for (const data of [undefined, null, false, 7, 'save', []]) {
    assert.deepEqual(normalizeSave(data), { level: 1, records: {}, sound: false });
  }
  for (const records of [undefined, null, [], 'records', 7, false]) {
    assert.deepEqual(normalizeSave({ records, sound: 'true' }), { level: 1, records: {}, sound: false });
  }
});

test('campaign wins advance level 999 to 1000 and preserve farther progress', () => {
  const save = normalizeSave({ level: 999 });
  assert.equal(recordWin(save, campaignWin()), true);
  assert.equal(save.level, 1000);
  assert.equal(save.records['garden:999'], 42);

  save.level = 1005;
  recordWin(save, campaignWin({ moves: 43 }));
  assert.equal(save.level, 1005);
});

test('campaign progress remains a safe integer at the numeric limit', () => {
  const limit = Number.MAX_SAFE_INTEGER;
  const save = normalizeSave({ level: limit - 1 });
  recordWin(save, campaignWin({ level: limit - 1, seed: `garden:${limit - 1}` }));
  assert.equal(save.level, limit);
  recordWin(save, campaignWin({ level: limit, seed: `garden:${limit}` }));
  assert.equal(save.level, limit);
  assert.equal(Number.isSafeInteger(save.level), true);
});

test('only strictly better unassisted wins update the best move record', () => {
  const save = normalizeSave({ level: 999, records: { 'garden:999': 42 } });
  assert.equal(recordWin(save, campaignWin({ moves: 43 })), false);
  assert.equal(recordWin(save, campaignWin({ moves: 42 })), false);
  assert.equal(save.records['garden:999'], 42);
  assert.equal(recordWin(save, campaignWin({ moves: 40 })), true);
  assert.equal(save.records['garden:999'], 40);

  save.records['garden:999'] = 'invalid';
  assert.equal(recordWin(save, campaignWin()), true);
  assert.equal(save.records['garden:999'], 42);
});

test('assisted wins advance campaign progress without creating or improving records', () => {
  const save = normalizeSave({ level: 999 });
  assert.equal(recordWin(save, campaignWin({ usedHint: true })), false);
  assert.equal(save.level, 1000);
  assert.equal(Object.hasOwn(save.records, 'garden:999'), false);

  save.records['garden:999'] = 42;
  assert.equal(recordWin(save, campaignWin({ moves: 1, usedHint: true })), false);
  assert.equal(save.records['garden:999'], 42);
});

test('daily wins store their own records without advancing campaign progress', () => {
  const save = normalizeSave({ level: 12, records: { 'garden:11': 23 } });
  assert.equal(recordWin(save, campaignWin({ mode: 'daily', seed: 'daily:2026-11-04' })), true);
  assert.equal(save.level, 12);
  assert.deepEqual(save.records, { 'garden:11': 23, 'daily:2026-11-04': 42 });
  assert.equal(recordWin(save, campaignWin({ mode: 'daily', seed: 'daily:2026-11-05', usedHint: true })), false);
  assert.equal(save.level, 12);
  assert.equal(Object.hasOwn(save.records, 'daily:2026-11-05'), false);
});
