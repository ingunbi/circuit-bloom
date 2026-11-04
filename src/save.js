export function normalizeSave(data) {
  const stored = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  return {
    level: Number.isSafeInteger(stored.level) && stored.level > 0 ? stored.level : 1,
    records: stored.records && typeof stored.records === 'object' && !Array.isArray(stored.records) ? { ...stored.records } : {},
    sound: stored.sound === true,
  };
}

// Update in-memory save data; browser storage stays with the caller.
export function recordWin(save, { seed, moves, usedHint, mode, level }) {
  const previousBest = save.records[seed];
  const isBest = !usedHint && (!Number.isFinite(previousBest) || moves < previousBest);
  if (isBest) save.records[seed] = moves;
  if (mode === 'campaign') {
    // Keep the next level exact even at JavaScript's integer precision limit.
    const nextLevel = level < Number.MAX_SAFE_INTEGER ? level + 1 : Number.MAX_SAFE_INTEGER;
    save.level = Math.max(save.level, nextLevel);
  }
  return isBest;
}
