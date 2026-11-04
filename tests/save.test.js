import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSave, recordWin, completionStars, gardenStats } from '../src/save.js';
import { encodeChallenge } from '../src/challenge.js';

const campaignWin = (overrides = {}) => ({
  seed: 'garden:999', moves: 42, par: 42, usedHint: false, mode: 'campaign', level: 999, ...overrides,
});

test('save normalization preserves valid progress beyond level 999', () => {
  const stored = { level: 1000, records: { 'garden:999': 42 }, sound: true };
  const save = normalizeSave(stored);
  assert.deepEqual(save, { ...stored, completions: { 'garden:999': { stars: 1, assisted: false } } });
  save.records['garden:999'] = 40;
  assert.equal(stored.records['garden:999'], 42);
  assert.equal(normalizeSave({ level: Number.MAX_SAFE_INTEGER }).level, Number.MAX_SAFE_INTEGER);
});

test('save normalization rejects invalid levels, records, and truthy sound values', () => {
  for (const level of [undefined, null, 0, -1, 1.5, '7', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(normalizeSave({ level }).level, 1);
  }
  for (const data of [undefined, null, false, 7, 'save', []]) {
    assert.deepEqual(normalizeSave(data), { level: 1, records: {}, sound: false, completions: {} });
  }
  for (const records of [undefined, null, [], 'records', 7, false]) {
    assert.deepEqual(normalizeSave({ records, sound: 'true' }), { level: 1, records: {}, sound: false, completions: {} });
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

test('normalization keeps only exact nonnegative move records and valid completion entries', () => {
  const save = normalizeSave({
    records: { 'garden:1': 0, 'garden:2': 12, 'garden:3': -1, 'garden:4': 1.5, 'garden:5': '7', 'garden:6': Infinity },
    completions: {
      'garden:1': { stars: 3, assisted: false },
      'daily:2026-11-04': { stars: 1, assisted: true },
      'garden:3': { stars: 4, assisted: false },
      'garden:4': { stars: 1.5, assisted: false },
      'garden:0': { stars: 1, assisted: false },
      'daily:2026-02-31': { stars: 2, assisted: false },
      unknown: { stars: 3, assisted: false },
    },
  });
  assert.deepEqual(save.records, { 'garden:1': 0, 'garden:2': 12 });
  assert.deepEqual(save.completions, {
    'garden:1': { stars: 3, assisted: false },
    'garden:2': { stars: 1, assisted: false },
    'daily:2026-11-04': { stars: 1, assisted: true },
  });
});

test('completion stars use the design par and assistance, including threshold boundaries', () => {
  assert.equal(completionStars(9, 10, false), 3);
  assert.equal(completionStars(10, 10, false), 3);
  assert.equal(completionStars(11, 10, false), 2);
  assert.equal(completionStars(15, 10, false), 2);
  assert.equal(completionStars(16, 10, false), 1);
  assert.equal(completionStars(4, 3, false), 2);
  assert.equal(completionStars(5, 3, false), 1);
  assert.equal(completionStars(37, 25, false), 2);
  assert.equal(completionStars(38, 25, false), 1);
  assert.equal(completionStars(1, 10, true), 1);
  assert.equal(completionStars(10, undefined, false), 1);
});

test('replays retain the best stars and prefer an unassisted run for tied stars', () => {
  const save = normalizeSave({ level: 999 });
  recordWin(save, campaignWin({ moves: 50, usedHint: true }));
  assert.deepEqual(save.completions['garden:999'], { stars: 1, assisted: true });
  recordWin(save, campaignWin({ moves: 100 }));
  assert.deepEqual(save.completions['garden:999'], { stars: 1, assisted: false });
  recordWin(save, campaignWin({ moves: 50, usedHint: true }));
  assert.deepEqual(save.completions['garden:999'], { stars: 1, assisted: false });
  recordWin(save, campaignWin({ moves: 50 }));
  assert.deepEqual(save.completions['garden:999'], { stars: 2, assisted: false });
  recordWin(save, campaignWin());
  recordWin(save, campaignWin({ moves: 100 }));
  assert.deepEqual(save.completions['garden:999'], { stars: 3, assisted: false });
  assert.equal(save.records['garden:999'], 42);
});

test('statistics count unique gardens, total stars and assisted daily completions', () => {
  const save = normalizeSave({ completions: {
    'garden:1': { stars: 3, assisted: false },
    'garden:2': { stars: 2, assisted: false },
    'daily:2026-11-02': { stars: 1, assisted: true },
    'daily:2026-11-03': { stars: 2, assisted: false },
    'daily:2026-11-04': { stars: 3, assisted: false },
  } });
  assert.deepEqual(gardenStats(save, '2026-11-04'), { completed: 5, totalStars: 11, dailyStreak: 3, campaignCompleted: 2, freeCompleted: 0 });
  recordWin(save, campaignWin({ seed: 'garden:1', level: 1, moves: 40 }));
  assert.equal(gardenStats(save, '2026-11-04').completed, 5);
});

test('daily streak stays live until the next Korean day ends, then resets after a gap', () => {
  const save = normalizeSave({ completions: {
    'daily:2026-10-30': { stars: 1, assisted: false },
    'daily:2026-10-31': { stars: 2, assisted: false },
    'daily:2026-11-01': { stars: 3, assisted: false },
  } });
  assert.equal(gardenStats(save, '2026-11-02').dailyStreak, 3);
  assert.equal(gardenStats(save, '2026-11-03').dailyStreak, 0);
  assert.equal(gardenStats(save, 'invalid').dailyStreak, 0);
  assert.deepEqual(gardenStats(normalizeSave(null), '2026-11-04'), { completed: 0, totalStars: 0, dailyStreak: 0, campaignCompleted: 0, freeCompleted: 0 });
});

test('completion entries survive JSON storage without sharing the original nested objects', () => {
  const stored = { level: 4, completions: { 'garden:3': { stars: 2, assisted: true } } };
  const save = normalizeSave(JSON.parse(JSON.stringify(stored)));
  save.completions['garden:3'].stars = 3;
  assert.equal(stored.completions['garden:3'].stars, 2);
  const restored = normalizeSave(JSON.parse(JSON.stringify(save)));
  assert.deepEqual(restored, save);
});

test('shared campaign copies keep free records and stars without unlocking campaign levels', () => {
  const seed = `free:${encodeChallenge({ mode: 'campaign', level: 999 })}`;
  const save = normalizeSave({ level: 4, records: { 'garden:3': 24 } });
  assert.equal(recordWin(save, campaignWin({ seed, mode: 'free' })), true);
  assert.equal(save.level, 4);
  assert.equal(save.records[seed], 42);
  assert.deepEqual(save.completions[seed], { stars: 3, assisted: false });
  assert.equal(Object.hasOwn(save.records, 'garden:999'), false);
  assert.equal(Object.hasOwn(save.completions, 'garden:999'), false);
  assert.deepEqual(gardenStats(save, '2026-11-04'), {
    completed: 2, totalStars: 4, dailyStreak: 0, campaignCompleted: 1, freeCompleted: 1,
  });
});

test('shared daily copies do not extend or replace the live daily streak', () => {
  const save = normalizeSave({ level: 12, completions: {
    'daily:2026-11-02': { stars: 3, assisted: false },
    'daily:2026-11-03': { stars: 2, assisted: false },
  } });
  const seed = `free:${encodeChallenge({ mode: 'daily', date: '2026-11-04' })}`;
  assert.equal(recordWin(save, campaignWin({ seed, mode: 'free', moves: 40 })), true);
  assert.equal(save.level, 12);
  assert.equal(Object.hasOwn(save.completions, 'daily:2026-11-04'), false);
  assert.equal(gardenStats(save, '2026-11-04').dailyStreak, 2);
  assert.equal(gardenStats(save, '2026-11-05').dailyStreak, 0);
  assert.equal(gardenStats(save, '2026-11-04').freeCompleted, 1);
});

test('valid free challenge records and completion medals survive normalization and JSON storage', () => {
  const seed = `free:${encodeChallenge({ mode: 'free', size: 5, seed: '꽃 정원' })}`;
  const copySeed = `free:${encodeChallenge({ mode: 'daily', date: '2026-11-03' })}`;
  const save = normalizeSave({ level: 7, records: { [seed]: 26, [copySeed]: 30 }, completions: {
    [seed]: { stars: 3, assisted: false },
  } });
  assert.deepEqual(save.records, { [seed]: 26, [copySeed]: 30 });
  assert.deepEqual(save.completions, {
    [seed]: { stars: 3, assisted: false },
    [copySeed]: { stars: 1, assisted: false },
  });
  assert.deepEqual(normalizeSave(JSON.parse(JSON.stringify(save))), save);
  assert.deepEqual(gardenStats(save, '2026-11-04'), {
    completed: 2, totalStars: 4, dailyStreak: 0, campaignCompleted: 0, freeCompleted: 2,
  });
});

test('invalid free codes cannot become stored records or completion medals', () => {
  const invalidSeeds = ['free:', 'free:CB1.', 'free:CB1.not-valid-code', 'free:CB2.invalid', 'free:4:unencoded'];
  const save = normalizeSave({
    records: Object.fromEntries(invalidSeeds.map((seed) => [seed, 10])),
    completions: Object.fromEntries(invalidSeeds.map((seed) => [seed, { stars: 3, assisted: false }])),
  });
  assert.deepEqual(save.records, {});
  assert.deepEqual(save.completions, {});
  assert.deepEqual(gardenStats(save, '2026-11-04'), {
    completed: 0, totalStars: 0, dailyStreak: 0, campaignCompleted: 0, freeCompleted: 0,
  });
});

test('replaying a free challenge improves its medal without duplicating garden or star totals', () => {
  const seed = `free:${encodeChallenge({ mode: 'free', size: 4, seed: '반짝이는 오후' })}`;
  const save = normalizeSave({ level: 5 });
  recordWin(save, campaignWin({ seed, mode: 'free', usedHint: true }));
  assert.equal(Object.hasOwn(save.records, seed), false);
  assert.deepEqual(gardenStats(save, '2026-11-04'), {
    completed: 1, totalStars: 1, dailyStreak: 0, campaignCompleted: 0, freeCompleted: 1,
  });
  recordWin(save, campaignWin({ seed, mode: 'free' }));
  recordWin(save, campaignWin({ seed, mode: 'free', moves: 50 }));
  assert.equal(save.level, 5);
  assert.equal(save.records[seed], 42);
  assert.deepEqual(gardenStats(save, '2026-11-04'), {
    completed: 1, totalStars: 3, dailyStreak: 0, campaignCompleted: 0, freeCompleted: 1,
  });
});
