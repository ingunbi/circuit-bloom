import test from 'node:test';
import assert from 'node:assert/strict';
import { millisecondsUntilNextKstDay, watchKstDay } from '../src/daily.js';

function clockAt(iso) {
  let current = new Date(iso);
  let scheduled;
  const changes = [];
  const watcher = watchKstDay((day) => changes.push(day), {
    now: () => current,
    setTimer(callback, delay) { scheduled = { callback, delay }; return scheduled; },
    clearTimer() { scheduled = undefined; },
  });
  return {
    watcher, changes,
    set(iso) { current = new Date(iso); },
    fire() { scheduled.callback(); },
    get scheduled() { return scheduled; },
  };
}

test('daily timer targets Korean midnight, including the exact boundary', () => {
  assert.equal(millisecondsUntilNextKstDay(new Date('2026-11-03T14:59:59.999Z')), 1);
  assert.equal(millisecondsUntilNextKstDay(new Date('2026-11-03T15:00:00Z')), 86400000);
  assert.equal(millisecondsUntilNextKstDay(new Date('2026-11-03T00:00:00Z')), 54000000);
});

test('an open game receives one change at Korean midnight and rearms its timer', () => {
  const clock = clockAt('2026-11-03T14:59:59.999Z');
  assert.equal(clock.scheduled.delay, 1);
  clock.set('2026-11-03T15:00:00Z');
  clock.fire();
  assert.deepEqual(clock.changes, ['2026-11-04']);
  assert.equal(clock.scheduled.delay, 86400000);
  clock.watcher.check();
  assert.deepEqual(clock.changes, ['2026-11-04']);
});

test('focus checks catch suspended timers without resetting a same-day puzzle', () => {
  const clock = clockAt('2026-11-03T14:59:59Z');
  clock.watcher.check();
  assert.deepEqual(clock.changes, []);
  clock.set('2026-11-06T16:00:00Z');
  clock.watcher.check();
  assert.deepEqual(clock.changes, ['2026-11-07']);
  assert.equal(clock.scheduled.delay, 82800000);
  clock.watcher.stop();
  assert.equal(clock.scheduled, undefined);
  clock.set('2026-11-07T16:00:00Z');
  clock.watcher.check();
  assert.deepEqual(clock.changes, ['2026-11-07']);
});
