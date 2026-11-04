import { kstDate } from './puzzle.js';
import { decodeChallenge } from './challenge.js';

const isMoveCount = (value) => Number.isSafeInteger(value) && value >= 0;
const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

function dayTimestamp(day) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return NaN;
  const timestamp = Date.parse(`${day}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === day ? timestamp : NaN;
}

function isGardenSeed(seed) {
  return /^garden:[1-9]\d*$/.test(seed) && Number.isSafeInteger(Number(seed.slice(7)));
}

function isGameSeed(seed) {
  return isGardenSeed(seed)
    || (seed.startsWith('daily:') && Number.isFinite(dayTimestamp(seed.slice(6))))
    || (seed.startsWith('free:') && decodeChallenge(seed.slice(5)) !== null);
}

export function normalizeSave(data) {
  const stored = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  const records = Object.fromEntries(Object.entries(isObject(stored.records) ? stored.records : {})
    .filter(([seed, moves]) => isMoveCount(moves) && (!seed.startsWith('free:') || isGameSeed(seed))));
  const completions = Object.fromEntries(Object.entries(isObject(stored.completions) ? stored.completions : {})
    .filter(([seed, value]) => isGameSeed(seed) && isObject(value) && Number.isInteger(value.stars) && value.stars >= 1 && value.stars <= 3)
    .map(([seed, value]) => [seed, { stars: value.stars, assisted: value.assisted === true }]));
  // Older saves knew move records but not medal ratings. Preserve those clears
  // without guessing how many stars an earlier run would have earned.
  for (const seed of Object.keys(records)) {
    if (isGameSeed(seed) && !Object.hasOwn(completions, seed)) completions[seed] = { stars: 1, assisted: false };
  }
  return {
    level: Number.isSafeInteger(stored.level) && stored.level > 0 ? stored.level : 1,
    records,
    sound: stored.sound === true,
    completions,
  };
}

export function completionStars(moves, par, usedHint) {
  if (usedHint || !isMoveCount(moves) || !isMoveCount(par)) return 1;
  if (moves <= par) return 3;
  return moves <= par * 1.5 ? 2 : 1;
}

// Update in-memory save data; browser storage stays with the caller.
export function recordWin(save, { seed, moves, usedHint, mode, level, par }) {
  const previousBest = save.records[seed];
  const isBest = !usedHint && isMoveCount(moves) && (!isMoveCount(previousBest) || moves < previousBest);
  if (isBest) save.records[seed] = moves;
  const stars = completionStars(moves, par, usedHint);
  save.completions ??= {};
  const previousCompletion = save.completions[seed];
  if (!previousCompletion || stars > previousCompletion.stars || (stars === previousCompletion.stars && !usedHint)) {
    save.completions[seed] = { stars, assisted: Boolean(usedHint) };
  }
  if (mode === 'campaign') {
    // Keep the next level exact even at JavaScript's integer precision limit.
    const nextLevel = level < Number.MAX_SAFE_INTEGER ? level + 1 : Number.MAX_SAFE_INTEGER;
    save.level = Math.max(save.level, nextLevel);
  }
  return isBest;
}

export function gardenStats(save, today = kstDate()) {
  const { completions } = normalizeSave(save);
  const entries = Object.entries(completions);
  const dailyDays = new Set(entries.filter(([seed]) => seed.startsWith('daily:')).map(([seed]) => seed.slice(6)));
  const todayTime = dayTimestamp(today);
  let dailyStreak = 0;
  if (Number.isFinite(todayTime)) {
    let day = dailyDays.has(today) ? todayTime : todayTime - 86400000;
    while (dailyDays.has(new Date(day).toISOString().slice(0, 10))) {
      dailyStreak += 1;
      day -= 86400000;
    }
  }
  return {
    completed: entries.length,
    totalStars: entries.reduce((sum, [, completion]) => sum + completion.stars, 0),
    dailyStreak,
    campaignCompleted: entries.filter(([seed]) => isGardenSeed(seed)).length,
    freeCompleted: entries.filter(([seed]) => seed.startsWith('free:')).length,
  };
}
