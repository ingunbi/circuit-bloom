import { minimumTurns } from './puzzle.js';

// Half-turn ties use clockwise rotation; a three-quarter turn is shorter in
// the opposite direction. minimumTurns also handles rotational symmetry.
export function shortestRotation(from, to) {
  const turns = minimumTurns(from, to);
  return turns === 3 ? -1 : turns;
}

export function bidirectionalPar(puzzle) {
  return puzzle.masks.reduce((total, mask, index) => total + (index === puzzle.source
    ? 0
    : Math.abs(shortestRotation(mask, puzzle.solution[index]))), 0);
}
