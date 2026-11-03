import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePuzzle, evaluate, rotate, minimumTurns, kstDate } from '../src/puzzle.js';

test('every generated board has a connected solution and starts incomplete', () => {
  for (const size of [3, 4, 5, 6, 8]) {
    for (let seed = 0; seed < 100; seed++) {
      const puzzle = generatePuzzle(`garden:${seed}`, size);
      assert.equal(evaluate(puzzle, puzzle.solution).solved, true);
      assert.equal(evaluate(puzzle).solved, false);
      assert.ok(puzzle.flowers.length > 0);
      assert.equal(puzzle.masks[puzzle.source], puzzle.solution[puzzle.source]);
      const turns = puzzle.masks.map((mask, index) => minimumTurns(mask, puzzle.solution[index]));
      assert.equal(turns.reduce((sum, turn) => sum + turn, 0), puzzle.par);
      assert.deepEqual(puzzle.masks.map((mask, index) => rotate(mask, turns[index])), puzzle.solution);
    }
  }
});

test('daily seeds produce identical boards across sessions', () => {
  assert.deepEqual(generatePuzzle('daily:2026-11-03', 5), generatePuzzle('daily:2026-11-03', 5));
  assert.notDeepEqual(generatePuzzle('daily:2026-11-03', 5).masks, generatePuzzle('daily:2026-11-04', 5).masks);
});

test('KST day switches at 15:00 UTC independently of host time zone', () => {
  assert.equal(kstDate(new Date('2026-11-02T14:59:59Z')), '2026-11-02');
  assert.equal(kstDate(new Date('2026-11-02T15:00:00Z')), '2026-11-03');
});

test('power only passes through reciprocal connections', () => {
  const puzzle = { size: 3, source: 0, flowers: [2], masks: [2, 2, 8, 0, 0, 0, 0, 0, 0] };
  assert.deepEqual([...evaluate(puzzle).powered], [0]);
  puzzle.masks[1] = 10;
  assert.deepEqual([...evaluate(puzzle).powered], [0, 1, 2]);
});
