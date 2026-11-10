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

test("일일 타이머는 정확한 날짜 경계까지 한국 시간 자정을 기준으로 작동한다", () => {
  assert.equal(millisecondsUntilNextKstDay(new Date('2026-11-03T14:59:59.999Z')), 1);
  assert.equal(millisecondsUntilNextKstDay(new Date('2026-11-03T15:00:00Z')), 86400000);
  assert.equal(millisecondsUntilNextKstDay(new Date('2026-11-03T00:00:00Z')), 54000000);
});

test("열린 게임은 한국 시간 자정에 한 번 갱신되고 다음 타이머를 예약한다", () => {
  const clock = clockAt('2026-11-03T14:59:59.999Z');
  assert.equal(clock.scheduled.delay, 1);
  clock.set('2026-11-03T15:00:00Z');
  clock.fire();
  assert.deepEqual(clock.changes, ['2026-11-04']);
  assert.equal(clock.scheduled.delay, 86400000);
  clock.watcher.check();
  assert.deepEqual(clock.changes, ['2026-11-04']);
});

test("화면 복귀 검사는 멈춘 타이머를 보완하고 같은 날 퍼즐은 초기화하지 않는다", () => {
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
