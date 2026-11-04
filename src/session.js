import { rotate } from './puzzle.js';

export const MAX_SESSION_ACTIONS = 100000;

export function createSession(puzzle) {
  return {
    seed: puzzle.seed,
    size: puzzle.size,
    turns: new Array(puzzle.masks.length).fill(0),
    locked: new Array(puzzle.masks.length).fill(false),
    moves: 0,
    usedHint: false,
    history: [],
    future: [],
  };
}

export function sessionMasks(puzzle, session) {
  return puzzle.masks.map((mask, index) => rotate(mask, session.turns[index]));
}

function matchesPuzzle(puzzle, session) {
  return session !== null && typeof session === 'object' && !Array.isArray(session)
    && session.seed === puzzle.seed && session.size === puzzle.size
    && Array.isArray(session.turns) && session.turns.length === puzzle.masks.length
    && Array.isArray(session.locked) && session.locked.length === puzzle.masks.length
    && [...session.locked].every((locked) => typeof locked === 'boolean')
    && Number.isSafeInteger(session.moves) && session.moves >= 0
    && typeof session.usedHint === 'boolean'
    && Array.isArray(session.history) && Array.isArray(session.future);
}

function validIndex(puzzle, index) {
  return Number.isInteger(index) && index >= 0 && index < puzzle.masks.length
    && index !== puzzle.source;
}

function validAction(puzzle, action) {
  if (action === null || typeof action !== 'object' || Array.isArray(action)
    || !validIndex(puzzle, action.index)) return false;
  if (action.kind === 'lock') return typeof action.locked === 'boolean';
  return action.kind === undefined
    && Number.isInteger(action.count) && Math.abs(action.count) >= 1 && Math.abs(action.count) <= 3
    && typeof action.assisted === 'boolean';
}

function copyAction(action) {
  return action.kind === 'lock'
    ? { kind: 'lock', index: action.index, locked: action.locked }
    : { index: action.index, count: action.count, assisted: action.assisted };
}

function performAction(session, action) {
  const { index } = action;
  if (action.kind === 'lock') {
    if (session.locked[index] === action.locked) return false;
    session.locked[index] = action.locked;
    return true;
  }
  const nextTurns = session.turns[index] + action.count;
  const nextMoves = session.moves + Math.abs(action.count);
  if (session.locked[index] || !Number.isSafeInteger(session.turns[index])
    || !Number.isSafeInteger(nextTurns) || !Number.isSafeInteger(nextMoves)) return false;
  session.turns[index] = nextTurns;
  session.moves = nextMoves;
  session.usedHint ||= action.assisted;
  return true;
}

export function applyTurn(puzzle, session, index, count = 1, assisted = false) {
  const action = { index, count, assisted };
  if (!matchesPuzzle(puzzle, session) || !validAction(puzzle, action)
    || session.history.length >= MAX_SESSION_ACTIONS
    || !performAction(session, action)) return false;
  session.history.push(action);
  session.future = [];
  return true;
}

export function toggleLock(puzzle, session, index) {
  if (!matchesPuzzle(puzzle, session) || !validIndex(puzzle, index)
    || session.history.length >= MAX_SESSION_ACTIONS) return false;
  const action = { kind: 'lock', index, locked: !session.locked[index] };
  session.locked[index] = action.locked;
  session.history.push(action);
  session.future = [];
  return true;
}

export function undoTurn(puzzle, session) {
  if (!matchesPuzzle(puzzle, session)) return false;
  const action = session.history.at(-1);
  if (!validAction(puzzle, action) || session.future.length >= MAX_SESSION_ACTIONS) return false;
  if (action.kind === 'lock') {
    if (session.locked[action.index] !== action.locked) return false;
    session.locked[action.index] = !action.locked;
  } else {
    const previousTurns = session.turns[action.index] - action.count;
    if (session.locked[action.index] || session.moves < Math.abs(action.count)
      || !Number.isSafeInteger(session.turns[action.index])
      || !Number.isSafeInteger(previousTurns)) return false;
    session.turns[action.index] = previousTurns;
    session.moves -= Math.abs(action.count);
    // A hint remains an assisted attempt even after its rotation is undone.
    session.usedHint ||= action.assisted;
  }
  session.history.pop();
  session.future.push(action);
  return true;
}

export function redoTurn(puzzle, session) {
  if (!matchesPuzzle(puzzle, session)) return false;
  const action = session.future.at(-1);
  if (!validAction(puzzle, action) || session.history.length >= MAX_SESSION_ACTIONS
    || !performAction(session, action)) return false;
  session.future.pop();
  session.history.push(action);
  return true;
}

// Rebuild from the original seeded board. Saved masks are never trusted.
export function restoreSession(puzzle, data) {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return null;
  const locked = data.locked === undefined ? new Array(puzzle.masks.length).fill(false) : data.locked;
  const stored = { ...data, locked };
  if (!matchesPuzzle(puzzle, stored)
    || data.history.length + data.future.length > MAX_SESSION_ACTIONS
    || data.moves > MAX_SESSION_ACTIONS * 3) return null;
  for (const action of [...data.history, ...data.future]) {
    if (!validAction(puzzle, action)) return null;
  }

  const session = createSession(puzzle);
  for (const action of data.history) {
    if (!performAction(session, action)) return null;
  }
  if (session.moves !== data.moves
    || !session.turns.every((count, index) => count === data.turns[index])
    || !data.turns.every((count) => Number.isSafeInteger(count))
    || !session.locked.every((value, index) => value === locked[index])) return null;

  // Redo pops from the end, so validate the future in its actual execution order.
  const probe = { ...session, turns: [...session.turns], locked: [...session.locked] };
  for (let index = data.future.length - 1; index >= 0; index--) {
    if (!performAction(probe, data.future[index])) return null;
  }
  if (!data.usedHint && probe.usedHint) return null;

  session.usedHint = data.usedHint;
  session.history = data.history.map(copyAction);
  session.future = data.future.map(copyAction);
  return session;
}
