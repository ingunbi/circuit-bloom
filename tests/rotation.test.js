import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePuzzle, rotate, evaluate } from '../src/puzzle.js';
import { shortestRotation, bidirectionalPar } from '../src/rotation.js';

test("최소 회전은 반대 방향 사분의 일 바퀴를 선택하고 반 바퀴 동률이면 시계 방향을 택한다", () => {
  assert.equal(shortestRotation(1, 8), -1);
  assert.equal(shortestRotation(8, 1), 1);
  assert.equal(shortestRotation(1, 4), 2);
  assert.equal(Math.abs(shortestRotation(1, 8)), 1);
  assert.equal(rotate(1, shortestRotation(1, 8)), 8);
  assert.equal(shortestRotation(1, 3), Infinity);
});

test("직선과 십자 타일의 대칭은 불필요한 회전을 막는다", () => {
  assert.equal(shortestRotation(5, 5), 0);
  assert.equal(shortestRotation(10, 10), 0);
  assert.equal(shortestRotation(5, 10), 1);
  assert.equal(shortestRotation(10, 5), 1);
  assert.equal(shortestRotation(15, 15), 0);
});

test("양방향 회전 계획은 기존 시계 방향 설계 기준을 바꾸지 않고 생성한 회로를 완성한다", () => {
  for (const size of [4, 5, 6]) {
    for (let seed = 0; seed < 100; seed++) {
      const puzzle = generatePuzzle(`garden:${seed}`, size);
      const original = structuredClone(puzzle);
      const turns = puzzle.masks.map((mask, index) => shortestRotation(mask, puzzle.solution[index]));
      const solved = puzzle.masks.map((mask, index) => rotate(mask, turns[index]));
      assert.deepEqual(solved, puzzle.solution);
      assert.equal(evaluate(puzzle, solved).solved, true);
      assert.equal(turns[puzzle.source], 0);
      assert.ok(bidirectionalPar(puzzle) <= puzzle.par);
      assert.equal(bidirectionalPar(puzzle), turns.reduce((total, count) => total + Math.abs(count), 0));
      assert.deepEqual(puzzle, original);
    }
  }
});

test("일일 회로의 양방향 회전 기준은 새로 접속해도 동일하다", () => {
  const first = generatePuzzle('daily:2026-11-04', 5);
  const second = generatePuzzle('daily:2026-11-04', 5);
  assert.equal(bidirectionalPar(first), bidirectionalPar(second));
  assert.deepEqual(first.masks.map((mask, index) => shortestRotation(mask, first.solution[index])),
    second.masks.map((mask, index) => shortestRotation(mask, second.solution[index])));
});

test("고정된 전원 타일은 양방향 회전 기준에 회전 수를 더하지 않는다", () => {
  const puzzle = { source: 0, masks: [1, 1, 5], solution: [4, 8, 10] };
  assert.equal(bidirectionalPar(puzzle), 2);
});
