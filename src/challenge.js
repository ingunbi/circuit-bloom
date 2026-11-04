const MAX_CODE_LENGTH = 1024;
const CODE_PREFIX = 'CB1.';

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

export function normalizeChallenge(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  if (input.mode === 'campaign') {
    if (!Number.isSafeInteger(input.level) || input.level < 1) return null;
    return { mode: 'campaign', level: input.level, size: input.level < 4 ? 4 : input.level < 12 ? 5 : 6 };
  }
  if (input.mode === 'daily') {
    return validDate(input.date) ? { mode: 'daily', date: input.date, size: 5 } : null;
  }
  if (input.mode !== 'free' || ![4, 5, 6].includes(input.size) || typeof input.seed !== 'string') return null;
  // Reject controls before trimming, so an invisible prefix cannot conceal one.
  if (/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(input.seed)) return null;
  const seed = input.seed.trim().normalize('NFC');
  const points = [...seed];
  if (points.length < 1 || points.length > 40) return null;
  // TextEncoder replaces lone surrogates, which would change a shared seed.
  if (points.some((point) => point.codePointAt(0) >= 0xd800 && point.codePointAt(0) <= 0xdfff)) return null;
  return { mode: 'free', size: input.size, seed };
}

export function puzzleKey(input) {
  const challenge = normalizeChallenge(input);
  if (!challenge) return null;
  if (challenge.mode === 'campaign') return `garden:${challenge.level}`;
  if (challenge.mode === 'daily') return `daily:${challenge.date}`;
  return `free:${challenge.size}:${encodeURIComponent(challenge.seed)}`;
}

function base64url(binary) {
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function encodeChallenge(input) {
  const challenge = normalizeChallenge(input);
  if (!challenge) return null;
  const bytes = new TextEncoder().encode(JSON.stringify(challenge));
  const code = CODE_PREFIX + base64url(String.fromCharCode(...bytes));
  return code.length <= MAX_CODE_LENGTH ? code : null;
}

export function decodeChallenge(code) {
  if (typeof code !== 'string' || code.length > MAX_CODE_LENGTH || !code.startsWith(CODE_PREFIX)) return null;
  const payload = code.slice(CODE_PREFIX.length);
  if (!/^[A-Za-z0-9_-]+$/.test(payload) || payload.length % 4 === 1) return null;
  try {
    const binary = atob(payload.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - payload.length % 4) % 4));
    if (base64url(binary) !== payload) return null;
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const json = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return normalizeChallenge(JSON.parse(json));
  } catch { return null; }
}

// Shared copies keep their source descriptor while storing records separately.
export function freeRecordKey(input) {
  const code = encodeChallenge(input);
  return code ? `free:${code}` : null;
}

export function challengeFromPuzzle(puzzle) {
  if (!puzzle || typeof puzzle !== 'object' || typeof puzzle.seed !== 'string') return null;
  const { seed, size } = puzzle;
  let challenge;
  if (seed.startsWith('free:CB1.')) {
    challenge = decodeChallenge(seed.slice(5));
  } else if (/^garden:[1-9]\d*$/.test(seed)) {
    challenge = normalizeChallenge({ mode: 'campaign', level: Number(seed.slice(7)) });
  } else if (seed.startsWith('daily:')) {
    challenge = normalizeChallenge({ mode: 'daily', date: seed.slice(6) });
  } else {
    const match = /^free:([456]):(.+)$/.exec(seed);
    if (!match) return null;
    try {
      challenge = normalizeChallenge({ mode: 'free', size: Number(match[1]), seed: decodeURIComponent(match[2]) });
    } catch { return null; }
    // Noncanonical escaping or normalization would generate a different board.
    if (!challenge || puzzleKey(challenge) !== seed) return null;
  }
  return challenge && challenge.size === size ? challenge : null;
}
