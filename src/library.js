import { decodeChallenge, encodeChallenge } from './challenge.js';

export const MAX_RECENT_ENTRIES = 40;
export const MAX_FAVORITE_ENTRIES = 20;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isTimestamp = (value) => Number.isSafeInteger(value) && value >= 0;

function canonicalCode(challenge) {
  const descriptor = typeof challenge === 'string' ? decodeChallenge(challenge) : challenge;
  return descriptor ? encodeChallenge(descriptor) : null;
}

function compareEntries(first, second) {
  if (first.favorite !== second.favorite) return first.favorite ? -1 : 1;
  if (first.visitedAt !== second.visitedAt) return second.visitedAt - first.visitedAt;
  return first.code < second.code ? -1 : first.code > second.code ? 1 : 0;
}

export function normalizeLibrary(data) {
  const entries = isObject(data) && Array.isArray(data.entries) ? data.entries : [];
  const unique = new Map();
  for (const entry of entries) {
    if (!isObject(entry) || typeof entry.code !== 'string' || !isTimestamp(entry.visitedAt)) continue;
    const code = canonicalCode(entry.code);
    if (!code) continue;
    const previous = unique.get(code);
    unique.set(code, {
      code,
      favorite: entry.favorite === true || previous?.favorite === true,
      visitedAt: Math.max(entry.visitedAt, previous?.visitedAt ?? 0),
    });
  }
  const ordered = [...unique.values()].sort(compareEntries);
  // 최근 방문이 많아져도 즐겨찾기는 별도 한도 안에서 우선 보존합니다.
  return { entries: [
    ...ordered.filter((entry) => entry.favorite).slice(0, MAX_FAVORITE_ENTRIES),
    ...ordered.filter((entry) => !entry.favorite).slice(0, MAX_RECENT_ENTRIES),
  ] };
}

export function recordVisit(library, challenge, now = Date.now()) {
  const code = canonicalCode(challenge);
  if (!isObject(library) || !code || !isTimestamp(now)) return false;
  const normalized = normalizeLibrary(library);
  const existing = normalized.entries.find((entry) => entry.code === code);
  if (existing) existing.visitedAt = Math.max(existing.visitedAt, now);
  else normalized.entries.push({ code, favorite: false, visitedAt: now });
  library.entries = normalizeLibrary(normalized).entries;
  return true;
}

export function toggleFavorite(library, challenge, now = Date.now()) {
  const code = canonicalCode(challenge);
  if (!isObject(library) || !code || !isTimestamp(now)) return false;
  const normalized = normalizeLibrary(library);
  const existing = normalized.entries.find((entry) => entry.code === code);
  if (!existing?.favorite && normalized.entries.filter((entry) => entry.favorite).length >= MAX_FAVORITE_ENTRIES) return false;
  if (existing) existing.favorite = !existing.favorite;
  else normalized.entries.push({ code, favorite: true, visitedAt: now });
  library.entries = normalizeLibrary(normalized).entries;
  return true;
}

export function removeEntry(library, code) {
  const canonical = typeof code === 'string' ? canonicalCode(code) : null;
  if (!isObject(library) || !canonical) return false;
  const normalized = normalizeLibrary(library);
  const remaining = normalized.entries.filter((entry) => entry.code !== canonical);
  if (remaining.length === normalized.entries.length) return false;
  library.entries = remaining;
  return true;
}

function challengeLabel(challenge) {
  if (challenge.mode === 'campaign') return `정원 ${challenge.level}`;
  if (challenge.mode === 'daily') return `오늘의 정원 ${challenge.date}`;
  return challenge.seed;
}

export function listLibrary(library, { filter = 'all', query = '', size = null } = {}) {
  if (size !== null && ![4, 5, 6].includes(size)) return [];
  const needle = typeof query === 'string' ? query.trim().normalize('NFC').toLowerCase() : '';
  return normalizeLibrary(library).entries
    .filter((entry) => filter === 'favorites' ? entry.favorite : filter === 'recent' ? !entry.favorite : true)
    .map((entry) => {
      const challenge = decodeChallenge(entry.code);
      return { ...entry, challenge, label: challengeLabel(challenge) };
    })
    .filter((entry) => (size === null || entry.challenge.size === size)
      && entry.label.normalize('NFC').toLowerCase().includes(needle));
}
