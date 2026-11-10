import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePuzzle } from '../src/puzzle.js';
import { normalizeChallenge, puzzleKey, encodeChallenge, decodeChallenge, freeRecordKey, challengeFromPuzzle } from '../src/challenge.js';

const rawCode = (value) => 'CB1.' + btoa(value).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');

test("캠페인 퍼즐 크기는 기존 단계 구성을 따르며 안전 범위를 벗어난 단계는 거부한다", () => {
  for (const [level, size] of [[1, 4], [3, 4], [4, 5], [11, 5], [12, 6], [1000, 6], [Number.MAX_SAFE_INTEGER, 6]]) {
    assert.deepEqual(normalizeChallenge({ mode: 'campaign', level }), { mode: 'campaign', level, size });
  }
  for (const level of [0, -1, 1.5, '1', Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(normalizeChallenge({ mode: 'campaign', level }), null);
  }
});

test("일일 퍼즐은 윤년까지 날짜를 검증하며 지난 날짜도 허용한다", () => {
  for (const date of ['2024-02-29', '2020-01-01', '2026-11-04']) {
    assert.deepEqual(normalizeChallenge({ mode: 'daily', date }), { mode: 'daily', date, size: 5 });
  }
  for (const date of ['2026-02-29', '2026-02-31', '2026-13-01', '2026-00-01', '2026-11-00', '2026-1-1', '2026-11-04T00:00:00Z', null]) {
    assert.equal(normalizeChallenge({ mode: 'daily', date }), null);
  }
});

test("자유 씨앗은 앞뒤 공백을 제거하고 유니코드 정준 결합형으로 맞춘 뒤 글자 수를 센다", () => {
  assert.deepEqual(normalizeChallenge({ mode: 'free', size: 5, seed: '  e\u0301 🌱  ' }), { mode: 'free', size: 5, seed: 'é 🌱' });
  assert.equal(normalizeChallenge({ mode: 'free', size: 4, seed: '🌱'.repeat(40) }).seed, '🌱'.repeat(40));
  assert.equal(normalizeChallenge({ mode: 'free', size: 4, seed: '🌱'.repeat(41) }), null);
  for (const size of [3, 7, 8, '5', null]) assert.equal(normalizeChallenge({ mode: 'free', size, seed: 'garden' }), null);
  for (const seed of ['', '   ', null, 7, '\ud800', '\udfff', 'garden\ud800']) {
    assert.equal(normalizeChallenge({ mode: 'free', size: 4, seed }), null);
  }
});

test("자유 씨앗은 공백 제거로 숨겨질 수 있는 제어 문자도 거부한다", () => {
  for (const seed of ['\0garden', '\tgarden', '\ngarden', 'gar\rden', 'garden\u007f', '\u0085garden', '\u2028garden', 'garden\u2029']) {
    assert.equal(normalizeChallenge({ mode: 'free', size: 4, seed }), null);
  }
});

test("모든 모드의 퍼즐 코드를 저장하고 복원해도 같은 회로가 생성된다", () => {
  const inputs = [
    { mode: 'campaign', level: 2 },
    { mode: 'campaign', level: 5 },
    { mode: 'campaign', level: 12 },
    { mode: 'daily', date: '2020-01-01' },
    ...[4, 5, 6].map((size) => ({ mode: 'free', size, seed: '빛 🌱 / # % 정원' })),
  ];
  for (const input of inputs) {
    const challenge = normalizeChallenge(input);
    const code = encodeChallenge(input);
    assert.match(code, /^CB1\.[A-Za-z0-9_-]+$/);
    assert.deepEqual(decodeChallenge(code), challenge);
    const original = generatePuzzle(puzzleKey(challenge), challenge.size);
    const decoded = decodeChallenge(code);
    const restored = generatePuzzle(puzzleKey(decoded), decoded.size);
    assert.deepEqual(restored, original);
    assert.deepEqual(challengeFromPuzzle(original), challenge);
  }
});

test("유니코드 표현과 앞뒤 공백 또는 불필요한 정보가 달라도 같은 코드로 변환한다", () => {
  const input = { mode: 'free', size: 5, seed: 'é 정원' };
  const variant = { ignored: '<script>', seed: '  e\u0301 정원  ', size: 5, mode: 'free' };
  assert.equal(encodeChallenge(input), encodeChallenge(variant));
  assert.equal(puzzleKey(input), puzzleKey(variant));
  assert.equal(encodeChallenge(decodeChallenge(encodeChallenge(input))), encodeChallenge(input));
  assert.equal(encodeChallenge({ mode: 'campaign', level: 1, size: 6 }), encodeChallenge({ mode: 'campaign', level: 1 }));
});

test("자유 퍼즐 식별값은 크기를 포함하고 씨앗의 예약 문자를 안전하게 변환한다", () => {
  const small = { mode: 'free', size: 4, seed: 'a/b %' };
  const large = { ...small, size: 6 };
  assert.equal(puzzleKey(small), 'free:4:a%2Fb%20%25');
  assert.notEqual(puzzleKey(small), puzzleKey(large));
  assert.notEqual(encodeChallenge(small), encodeChallenge(large));
  assert.equal(challengeFromPuzzle({ seed: puzzleKey(small), size: 6 }), null);
});

test("버전이나 베이스64 또는 제이슨과 유티에프8 형식이 잘못된 코드는 복원하지 않는다", () => {
  const valid = encodeChallenge({ mode: 'campaign', level: 1 });
  for (const value of [null, 7, '', valid.replace('CB1.', 'CB2.'), 'CB1.', 'CB1.a', 'CB1.%%%', `${valid}=`, rawCode('{'), rawCode('null'), rawCode('[]'), rawCode('{}'), rawCode(String.fromCharCode(255))]) {
    assert.equal(decodeChallenge(value), null);
  }
  for (const input of [null, [], 1, 'campaign', { mode: 'unknown' }]) {
    assert.equal(normalizeChallenge(input), null);
    assert.equal(encodeChallenge(input), null);
    assert.equal(puzzleKey(input), null);
    assert.equal(freeRecordKey(input), null);
  }
});

test("코드 복원은 1024자 제한과 베이스64의 올바른 채움 비트를 검증한다", () => {
  const json = JSON.stringify({ mode: 'campaign', level: 1 });
  const boundary = rawCode(json.padEnd(765, ' '));
  assert.equal(boundary.length, 1024);
  assert.deepEqual(decodeChallenge(boundary), { mode: 'campaign', level: 1, size: 4 });
  assert.equal(decodeChallenge(`${boundary}A`), null);
  const withPadBits = rawCode(json.padEnd(json.length + (1 - json.length % 3 + 3) % 3, ' '));
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const alias = withPadBits.slice(0, -1) + alphabet[alphabet.indexOf(withPadBits.at(-1)) + 1];
  assert.notEqual(alias, withPadBits);
  assert.equal(decodeChallenge(alias), null);
});

test("퍼즐 정보는 잘못된 식별값과 일치하지 않는 격자 크기를 거부한다", () => {
  for (const puzzle of [null, {}, { seed: 1, size: 4 }, { seed: 'garden:01', size: 4 },
    { seed: 'garden:9007199254740992', size: 6 }, { seed: 'garden:1', size: 5 },
    { seed: 'daily:2026-11-04', size: 4 }, { seed: 'daily:2026-02-31', size: 5 },
    { seed: 'free:4:%FF', size: 4 }, { seed: 'free:4:%', size: 4 },
    { seed: 'free:4:e%CC%81', size: 4 }, { seed: 'free:4:%61', size: 4 },
    { seed: 'free:CB1.invalid', size: 4 }]) {
    assert.equal(challengeFromPuzzle(puzzle), null);
  }
});

test("공유 복사본은 원본 회로와 정보를 유지하며 기록은 별도로 구분한다", () => {
  for (const input of [{ mode: 'campaign', level: 1 }, { mode: 'daily', date: '2020-01-01' }, { mode: 'free', size: 6, seed: '친구의 정원 🌱' }]) {
    const challenge = normalizeChallenge(input);
    const source = generatePuzzle(puzzleKey(challenge), challenge.size);
    const copy = { ...generatePuzzle(puzzleKey(challenge), challenge.size), seed: freeRecordKey(challenge) };
    assert.deepEqual(copy.masks, source.masks);
    assert.deepEqual(copy.solution, source.solution);
    assert.notEqual(copy.seed, source.seed);
    assert.match(copy.seed, /^free:CB1\./);
    assert.deepEqual(challengeFromPuzzle(copy), challenge);
    assert.equal(challengeFromPuzzle({ ...copy, size: copy.size === 4 ? 5 : 4 }), null);
  }
});
