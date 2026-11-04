import { kstDate } from './puzzle.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function millisecondsUntilNextKstDay(now = new Date()) {
  const elapsed = ((now.getTime() + KST_OFFSET_MS) % DAY_MS + DAY_MS) % DAY_MS;
  return DAY_MS - elapsed;
}

// Check again on focus/visibility changes: background timers can be suspended.
export function watchKstDay(onChange, {
  now = () => new Date(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  let day = kstDate(now());
  let timer;
  let stopped = false;

  function check() {
    if (stopped) return;
    clearTimer(timer);
    const current = now();
    const nextDay = kstDate(current);
    if (nextDay !== day) {
      day = nextDay;
      onChange(day);
    }
    timer = setTimer(check, millisecondsUntilNextKstDay(current));
  }

  check();
  return {
    check,
    stop() { stopped = true; clearTimer(timer); },
  };
}
