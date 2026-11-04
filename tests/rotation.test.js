import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePuzzle, rotate, evaluate } from '../src/puzzle.js';
import { shortestRotation, bidirectionalPar } from '../src/rotation.js';

test('shortest rotations prefer a reverse quarter-turn and clockwise half-turn ties', () => {
  assert.equal(shortestRotation(1, 8), -1);
  assert.equal(shortestRotation(8, 1), 1);
  assert.equal(shortestRotation(1, 4), 2);
  assert.equal(Math.abs(shortestRotation(1, 8)), 1);
  assert.equal(rotate(1, shortestRotation(1, 8)), 8);
  assert.equal(shortestRotation(1, 3), Infinity);
});

test('straight and cross tile symmetry avoids unnecessary turns', () => {
  assert.equal(shortestRotation(5, 5), 0);
  assert.equal(shortestRotation(10, 10), 0);
  assert.equal(shortestRotation(5, 10), 1);
  assert.equal(shortestRotation(10, 5), 1);
  assert.equal(shortestRotation(15, 15), 0);
});

test('bidirectional plans solve generated boards without changing the original clockwise par', () => {
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

test('daily boards retain identical bidirectional targets across sessions', () => {
  const first = generatePuzzle('daily:2026-11-04', 5);
  const second = generatePuzzle('daily:2026-11-04', 5);
  assert.equal(bidirectionalPar(first), bidirectionalPar(second));
  assert.deepEqual(first.masks.map((mask, index) => shortestRotation(mask, first.solution[index])),
    second.masks.map((mask, index) => shortestRotation(mask, second.solution[index])));
});

test('the fixed source contributes zero to the bidirectional target', () => {
  const puzzle = { source: 0, masks: [1, 1, 5], solution: [4, 8, 10] };
  assert.equal(bidirectionalPar(puzzle), 2);
});
