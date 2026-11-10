import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeChallenge } from '../src/challenge.js';
import {
  MAX_RECENT_ENTRIES, MAX_FAVORITE_ENTRIES, normalizeLibrary, recordVisit, toggleFavorite, removeEntry, listLibrary,
} from '../src/library.js';

const free = (seed, size = 4) => ({ mode: 'free', size, seed });
const codeFor = (seed, size = 4) => encodeChallenge(free(seed, size));
const entryFor = (seed, visitedAt = 0, favorite = false, size = 4) => ({ code: codeFor(seed, size), visitedAt, favorite });
const rawCode = (descriptor) => 'CB1.' + btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(descriptor))))
  .replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const copy = (data) => JSON.parse(JSON.stringify(data));

test('잘못된 저장 구조와 씨앗 코드 및 방문 시간은 보관함에서 제외한다', () => {
  for (const invalid of [undefined, null, [], false, 7, '보관함', {}, { entries: null }, { entries: {} }]) {
    assert.deepEqual(normalizeLibrary(invalid), { entries: [] });
  }
  const valid = entryFor('남겨 둘 정원', 4);
  const invalidEntries = [undefined, null, [], false, '옛 씨앗', {},
    { ...valid, code: null }, { ...valid, code: 'CB1.잘못된코드' },
    ...[-1, 1.5, NaN, Infinity, '4', Number.MAX_SAFE_INTEGER + 1, undefined].map((visitedAt) => ({ ...valid, visitedAt })),
  ];
  const library = normalizeLibrary({ entries: [valid, ...invalidEntries] });
  assert.deepEqual(library.entries, [valid]);
  assert.equal(normalizeLibrary({ entries: [{ ...valid, favorite: '참' }] }).entries[0].favorite, false);
});

test('같은 씨앗의 다른 코드 표현을 합쳐 최신 방문 시간과 즐겨찾기를 보존한다', () => {
  const canonical = codeFor('é 정원', 5);
  const variant = rawCode({ ignored: '추가 정보', seed: '  e\u0301 정원  ', size: 5, mode: 'free' });
  assert.notEqual(canonical, variant);
  const library = normalizeLibrary({ entries: [
    { code: canonical, favorite: false, visitedAt: 30 },
    { code: variant, favorite: true, visitedAt: 10 },
    { code: canonical, favorite: false, visitedAt: 20 },
  ] });
  assert.deepEqual(library.entries, [{ code: canonical, favorite: true, visitedAt: 30 }]);
});

test('즐겨찾기 20개와 최근 씨앗 40개를 각각 최신순으로 보존한다', () => {
  const favorites = Array.from({ length: 25 }, (_, index) => entryFor(`즐겨찾기 ${index}`, index, true));
  const recent = Array.from({ length: 50 }, (_, index) => entryFor(`최근 ${index}`, 1000 + index));
  const library = normalizeLibrary({ entries: [...recent, ...favorites] });
  assert.equal(library.entries.length, MAX_FAVORITE_ENTRIES + MAX_RECENT_ENTRIES);
  assert.equal(library.entries.filter((entry) => entry.favorite).length, 20);
  assert.equal(library.entries.filter((entry) => !entry.favorite).length, 40);
  assert.equal(library.entries[0].code, codeFor('즐겨찾기 24'));
  assert.equal(library.entries[19].code, codeFor('즐겨찾기 5'));
  assert.equal(library.entries[20].code, codeFor('최근 49'));
  assert.equal(library.entries.at(-1).code, codeFor('최근 10'));
});

test('방문을 갱신해도 씨앗과 즐겨찾기를 중복 생성하거나 시간을 되돌리지 않는다', () => {
  const library = normalizeLibrary({ entries: [entryFor('다시 찾은 정원', 100, true)] });
  assert.equal(recordVisit(library, free('다시 찾은 정원'), 200), true);
  assert.deepEqual(library.entries, [entryFor('다시 찾은 정원', 200, true)]);
  assert.equal(recordVisit(library, codeFor('다시 찾은 정원'), 150), true);
  assert.deepEqual(library.entries, [entryFor('다시 찾은 정원', 200, true)]);
  assert.equal(recordVisit(library, free('새 정원', 6), 300), true);
  assert.equal(library.entries.length, 2);
  assert.deepEqual(library.entries[1], entryFor('새 정원', 300, false, 6));
});

test('새 방문은 오래된 최근 씨앗을 밀어내며 즐겨찾기와 다른 저장 정보는 유지한다', () => {
  const library = normalizeLibrary({ entries: [
    entryFor('오래된 즐겨찾기', 0, true),
    ...Array.from({ length: 40 }, (_, index) => entryFor(`최근 ${index}`, index + 1)),
  ] });
  library.other = { level: 7, record: 12 };
  assert.equal(recordVisit(library, free('방금 연 정원'), 100), true);
  assert.equal(library.entries.length, 41);
  assert.ok(library.entries.some((entry) => entry.code === codeFor('오래된 즐겨찾기')));
  assert.ok(!library.entries.some((entry) => entry.code === codeFor('최근 0')));
  assert.deepEqual(library.other, { level: 7, record: 12 });
});

test('즐겨찾기 추가와 해제는 기존 방문 시간을 바꾸지 않고 새 씨앗도 등록한다', () => {
  const library = normalizeLibrary({ entries: [entryFor('기존 정원', 10)] });
  assert.equal(toggleFavorite(library, free('기존 정원'), 50), true);
  assert.deepEqual(library.entries, [entryFor('기존 정원', 10, true)]);
  assert.equal(toggleFavorite(library, codeFor('기존 정원'), 60), true);
  assert.deepEqual(library.entries, [entryFor('기존 정원', 10, false)]);
  assert.equal(toggleFavorite(library, free('새 즐겨찾기', 5), 70), true);
  assert.deepEqual(library.entries[0], entryFor('새 즐겨찾기', 70, true, 5));
});

test('즐겨찾기가 가득 차면 새 등록을 거절하고 기존 즐겨찾기는 해제할 수 있다', () => {
  const library = normalizeLibrary({ entries: Array.from({ length: 20 }, (_, index) => entryFor(`즐겨찾기 ${index}`, index, true)) });
  const before = copy(library);
  assert.equal(toggleFavorite(library, free('스물한 번째'), 100), false);
  assert.deepEqual(library, before);
  assert.equal(toggleFavorite(library, free('즐겨찾기 0'), 100), true);
  assert.equal(library.entries.filter((entry) => entry.favorite).length, 19);
  assert.equal(toggleFavorite(library, free('스물한 번째'), 101), true);
  assert.equal(library.entries.filter((entry) => entry.favorite).length, 20);
  assert.equal(library.entries.length, 21);
});

test('삭제는 정규화한 코드로 비교하며 진행 중인 판이나 최고 기록은 건드리지 않는다', () => {
  const library = normalizeLibrary({ entries: [entryFor('é 정원', 20, true), entryFor('남는 정원', 10)] });
  library.liveBoard = { turns: [1, -1], moves: 2 };
  library.records = { campaign: 3 };
  const alias = rawCode({ mode: 'free', seed: ' e\u0301 정원 ', size: 4 });
  assert.equal(removeEntry(library, alias), true);
  assert.deepEqual(library.entries, [entryFor('남는 정원', 10)]);
  assert.deepEqual(library.liveBoard, { turns: [1, -1], moves: 2 });
  assert.deepEqual(library.records, { campaign: 3 });
  assert.equal(removeEntry(library, alias), false);
  assert.equal(removeEntry(library, '잘못된 코드'), false);
});

test('검색은 한글 정규화와 영문 대소문자를 처리하며 크기와 탭 필터를 함께 적용한다', () => {
  const campaign = { mode: 'campaign', level: 12 };
  const daily = { mode: 'daily', date: '2026-11-04' };
  const library = normalizeLibrary({ entries: [
    entryFor('é Bloom 정원', 40, true, 4),
    entryFor('달빛 정원', 30, false, 5),
    { code: encodeChallenge(campaign), visitedAt: 20, favorite: false },
    { code: encodeChallenge(daily), visitedAt: 10, favorite: true },
  ] });
  assert.equal(listLibrary(library, { query: '  E\u0301 bLOOM  ' })[0].label, 'é Bloom 정원');
  assert.equal(listLibrary(library, { query: '정원 12', size: 6 })[0].challenge.mode, 'campaign');
  assert.equal(listLibrary(library, { query: '2026-11-04', filter: 'favorites', size: 5 })[0].label, '오늘의 정원 2026-11-04');
  assert.equal(listLibrary(library, { filter: 'favorites' }).length, 2);
  assert.equal(listLibrary(library, { filter: 'recent' }).length, 2);
  assert.equal(listLibrary(library, { query: '달빛', size: 4 }).length, 0);
  assert.equal(listLibrary(library, { size: '5' }).length, 0);
});

test('목록은 즐겨찾기를 먼저 두고 같은 시간은 코드 순서로 안정적으로 정렬한다', () => {
  const library = { entries: [entryFor('나', 10), entryFor('가', 10), entryFor('오래된 즐겨찾기', 0, true)] };
  const listed = listLibrary(library);
  assert.equal(listed[0].favorite, true);
  const expectedCodes = [codeFor('가'), codeFor('나')].sort();
  assert.deepEqual(listed.slice(1).map((entry) => entry.code), expectedCodes);
});

test('정규화와 목록 반환값은 원본 배열이나 중첩 도전 정보를 공유하지 않는다', () => {
  const stored = { entries: [entryFor('원본 정원', 10)] };
  const library = normalizeLibrary(stored);
  library.entries[0].favorite = true;
  assert.equal(stored.entries[0].favorite, false);
  library.entries.push(entryFor('추가 정원', 20));
  assert.equal(stored.entries.length, 1);
  const listed = listLibrary(library);
  listed[0].challenge.seed = '바뀐 표시';
  listed[0].favorite = false;
  listed.pop();
  assert.equal(library.entries.length, 2);
  assert.equal(library.entries[0].favorite, true);
  assert.equal(listLibrary(library)[0].challenge.seed, '원본 정원');
  assert.deepEqual(normalizeLibrary(copy(library)), normalizeLibrary(library));
});

test('잘못된 변경 요청은 보관함을 수정하지 않고 기본 방문 시간은 안전한 정수로 기록한다', () => {
  const library = normalizeLibrary({ entries: [entryFor('그대로 둘 정원', 10)] });
  const before = copy(library);
  for (const now of [-1, 1.5, NaN, Infinity, '10', Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(recordVisit(library, free('잘못된 시간'), now), false);
    assert.equal(toggleFavorite(library, free('잘못된 시간'), now), false);
  }
  for (const invalid of [null, [], {}, '잘못된 코드', free('', 4)]) {
    assert.equal(recordVisit(library, invalid, 20), false);
    assert.equal(toggleFavorite(library, invalid, 20), false);
  }
  assert.deepEqual(library, before);
  assert.equal(recordVisit(null, free('새 씨앗'), 20), false);
  assert.equal(toggleFavorite([], free('새 씨앗'), 20), false);
  assert.equal(removeEntry(null, codeFor('새 씨앗')), false);
  const started = Date.now();
  assert.equal(recordVisit(library, free('지금 방문')), true);
  const visitedAt = library.entries.find((entry) => entry.code === codeFor('지금 방문')).visitedAt;
  assert.ok(Number.isSafeInteger(visitedAt) && visitedAt >= started && visitedAt <= Date.now());
});
