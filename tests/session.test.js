import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePuzzle, rotate } from '../src/puzzle.js';
import {
  MAX_SESSION_ACTIONS, createSession, sessionMasks, applyTurn, toggleLock, undoTurn, redoTurn, restoreSession,
} from '../src/session.js';

const puzzle = generatePuzzle('garden:session-test', 4);
const copy = (data) => JSON.parse(JSON.stringify(data));

test('new sessions derive their board from the original puzzle without mutating it', () => {
  const session = createSession(puzzle);
  const original = [...puzzle.masks];
  assert.equal(session.seed, puzzle.seed);
  assert.equal(session.size, 4);
  assert.equal(session.moves, 0);
  assert.equal(session.usedHint, false);
  assert.deepEqual(sessionMasks(puzzle, session), original);
  assert.equal(applyTurn(puzzle, session, 0, 3), true);
  assert.equal(sessionMasks(puzzle, session)[0], rotate(original[0], 3));
  assert.equal(session.moves, 3);
  assert.deepEqual(puzzle.masks, original);
});

test('source and invalid rotations leave the session unchanged', () => {
  const session = createSession(puzzle);
  const original = copy(session);
  for (const index of [puzzle.source, -1, 16, 0.5, NaN, '0']) {
    assert.equal(applyTurn(puzzle, session, index), false);
  }
  for (const count of [0, -4, 4, 1.5, Infinity, '1']) {
    assert.equal(applyTurn(puzzle, session, 0, count), false);
  }
  assert.equal(applyTurn(puzzle, session, 0, 1, 'true'), false);
  assert.deepEqual(session, original);
});

test('undo and redo restore board orientation and move totals in stack order', () => {
  const session = createSession(puzzle);
  assert.equal(undoTurn(puzzle, session), false);
  assert.equal(redoTurn(puzzle, session), false);
  applyTurn(puzzle, session, 0, 1);
  applyTurn(puzzle, session, 1, 3);
  const completed = copy(session);
  const completedMasks = sessionMasks(puzzle, session);
  assert.equal(undoTurn(puzzle, session), true);
  assert.equal(session.moves, 1);
  assert.equal(session.turns[1], 0);
  assert.equal(undoTurn(puzzle, session), true);
  assert.equal(session.moves, 0);
  assert.deepEqual(sessionMasks(puzzle, session), puzzle.masks);
  assert.equal(redoTurn(puzzle, session), true);
  assert.equal(session.moves, 1);
  assert.equal(session.turns[0], 1);
  assert.equal(redoTurn(puzzle, session), true);
  assert.deepEqual(session, completed);
  assert.deepEqual(sessionMasks(puzzle, session), completedMasks);
});

test('new rotations replace the redo branch while hint use remains sticky', () => {
  const session = createSession(puzzle);
  applyTurn(puzzle, session, 0, 2, true);
  assert.equal(undoTurn(puzzle, session), true);
  assert.equal(session.moves, 0);
  assert.equal(session.usedHint, true);
  applyTurn(puzzle, session, 1);
  assert.equal(session.future.length, 0);
  assert.equal(session.usedHint, true);
  assert.equal(redoTurn(puzzle, session), false);
  assert.equal(restoreSession(puzzle, copy(session)).usedHint, true);
});

test('sessions and redo history survive a JSON round trip with independent objects', () => {
  const session = createSession(puzzle);
  applyTurn(puzzle, session, 0, 3);
  applyTurn(puzzle, session, 1, 2, true);
  undoTurn(puzzle, session);
  const stored = copy(session);
  const restored = restoreSession(puzzle, stored);
  assert.deepEqual(restored, session);
  assert.equal(redoTurn(puzzle, restored), true);
  assert.equal(restored.moves, 5);
  assert.equal(restored.usedHint, true);
  assert.equal(stored.moves, 3);
  assert.equal(stored.future.length, 1);
  restored.history[0].count = 1;
  assert.equal(stored.history[0].count, 3);
});

test('saved sessions cannot be restored into another level, day, or grid size', () => {
  const daily = generatePuzzle('daily:2026-11-04', 5);
  const stored = createSession(daily);
  assert.equal(restoreSession(generatePuzzle('daily:2026-11-05', 5), stored), null);
  assert.equal(restoreSession(generatePuzzle('daily:2026-11-04', 6), stored), null);
  assert.equal(restoreSession(puzzle, stored), null);
});

test('restoration rejects corrupt shape, counters, and rotation histories', () => {
  const session = createSession(puzzle);
  applyTurn(puzzle, session, 0, 2);
  for (const invalid of [null, undefined, false, [], 'session', 4]) {
    assert.equal(restoreSession(puzzle, invalid), null);
  }
  for (const patch of [
    { moves: 1 }, { moves: Number.MAX_SAFE_INTEGER + 1 }, { moves: -1 },
    { moves: NaN }, { turns: [] }, { turns: null }, { locked: [] }, { locked: null },
    { history: null }, { future: null }, { usedHint: 1 },
    { turns: session.turns.map((count, index) => index === 0 ? count + 4 : count) },
    { turns: session.turns.map((count, index) => index === puzzle.source ? 4 : count) },
    { turns: session.turns.map((count, index) => index === 0 ? '2' : count) },
    { turns: session.turns.map((count, index) => index === 0 ? Infinity : count) },
    { locked: session.locked.map((value, index) => index === 0 ? 1 : value) },
    { locked: session.locked.map((value, index) => index === puzzle.source ? true : value) },
  ]) {
    assert.equal(restoreSession(puzzle, { ...copy(session), ...patch }), null);
  }
});

test('counterclockwise rotations cost one move per quarter turn and can be undone', () => {
  const session = createSession(puzzle);
  assert.equal(applyTurn(puzzle, session, 0, -1), true);
  assert.equal(session.moves, 1);
  assert.equal(session.turns[0], -1);
  assert.equal(sessionMasks(puzzle, session)[0], rotate(puzzle.masks[0], -1));
  applyTurn(puzzle, session, 0, 1);
  assert.equal(session.moves, 2);
  assert.equal(session.turns[0], 0);
  undoTurn(puzzle, session);
  assert.equal(session.moves, 1);
  assert.equal(session.turns[0], -1);
  undoTurn(puzzle, session);
  assert.equal(session.moves, 0);
  assert.equal(session.turns[0], 0);
  redoTurn(puzzle, session);
  assert.equal(session.moves, 1);
  assert.equal(session.turns[0], -1);
});

test('pinned tiles reject manual and assisted rotations without spending moves', () => {
  const session = createSession(puzzle);
  assert.equal(toggleLock(puzzle, session, puzzle.source), false);
  assert.equal(toggleLock(puzzle, session, -1), false);
  assert.equal(toggleLock(puzzle, session, 16), false);
  assert.equal(toggleLock(puzzle, session, 0), true);
  assert.equal(session.locked[0], true);
  const pinned = copy(session);
  assert.equal(applyTurn(puzzle, session, 0), false);
  assert.equal(applyTurn(puzzle, session, 0, -1), false);
  assert.equal(applyTurn(puzzle, session, 0, 3, true), false);
  assert.deepEqual(session, pinned);
  assert.equal(session.moves, 0);
  assert.equal(session.usedHint, false);
  assert.equal(toggleLock(puzzle, session, 0), true);
  assert.equal(applyTurn(puzzle, session, 0, -2), true);
  assert.equal(session.moves, 2);
});

test('pin changes share undo and redo history while leaving move totals unchanged', () => {
  const session = createSession(puzzle);
  applyTurn(puzzle, session, 0, -3);
  toggleLock(puzzle, session, 0);
  assert.equal(session.moves, 3);
  assert.equal(undoTurn(puzzle, session), true);
  assert.equal(session.locked[0], false);
  assert.equal(session.moves, 3);
  assert.equal(undoTurn(puzzle, session), true);
  assert.equal(session.turns[0], 0);
  assert.equal(session.moves, 0);
  assert.equal(redoTurn(puzzle, session), true);
  assert.equal(redoTurn(puzzle, session), true);
  assert.equal(session.locked[0], true);
  assert.equal(session.moves, 3);
  undoTurn(puzzle, session);
  toggleLock(puzzle, session, 1);
  assert.equal(session.future.length, 0);
  assert.equal(redoTurn(puzzle, session), false);
});

test('signed rotations and pin histories survive JSON with independently cloned state', () => {
  const session = createSession(puzzle);
  applyTurn(puzzle, session, 0, -2, true);
  toggleLock(puzzle, session, 0);
  toggleLock(puzzle, session, 1);
  undoTurn(puzzle, session);
  const stored = copy(session);
  const restored = restoreSession(puzzle, stored);
  assert.deepEqual(restored, session);
  assert.equal(redoTurn(puzzle, restored), true);
  assert.equal(restored.locked[1], true);
  assert.equal(restored.moves, 2);
  assert.equal(restored.turns[0], -2);
  assert.equal(restored.usedHint, true);
  assert.equal(stored.locked[1], false);
  restored.history[1].locked = false;
  assert.equal(stored.history[1].locked, true);
});

test('legacy sessions without pins restore with every tile unlocked', () => {
  const legacy = createSession(puzzle);
  applyTurn(puzzle, legacy, 0, 3);
  applyTurn(puzzle, legacy, 1, 1);
  undoTurn(puzzle, legacy);
  delete legacy.locked;
  const restored = restoreSession(puzzle, copy(legacy));
  assert.deepEqual(restored.locked, new Array(16).fill(false));
  assert.equal(restored.moves, 3);
  assert.equal(redoTurn(puzzle, restored), true);
  assert.equal(restored.moves, 4);
});

test('restoration rejects impossible lock transitions and future rotations on pinned tiles', () => {
  const session = createSession(puzzle);
  toggleLock(puzzle, session, 0);
  assert.equal(restoreSession(puzzle, { ...copy(session), locked: new Array(16).fill(false) }), null);
  for (const future of [
    [{ index: 0, count: -1, assisted: false }],
    [{ kind: 'lock', index: 0, locked: true }],
    [{ kind: 'lock', index: puzzle.source, locked: true }],
    [{ kind: 'lock', index: 1, locked: 1 }],
    [{ kind: 'unexpected', index: 1, count: 1, assisted: false }],
  ]) {
    assert.equal(restoreSession(puzzle, { ...copy(session), future }), null);
  }
  const invalidHistory = createSession(puzzle);
  invalidHistory.history = [{ kind: 'lock', index: 0, locked: false }];
  assert.equal(restoreSession(puzzle, invalidHistory), null);

  // Pop the unlock first, then the rotation. The reverse order is invalid.
  const future = [
    { index: 0, count: -1, assisted: false },
    { kind: 'lock', index: 0, locked: false },
  ];
  assert.ok(restoreSession(puzzle, { ...copy(session), future }));
  assert.equal(restoreSession(puzzle, { ...copy(session), future: [...future].reverse() }), null);
});

test('both history stacks reject invalid actions and disguised hint usage', () => {
  const session = createSession(puzzle);
  for (const action of [
    null, [], { index: puzzle.source, count: 1, assisted: false },
    { index: -1, count: 1, assisted: false }, { index: 16, count: 1, assisted: false },
    { index: 0, count: 0, assisted: false }, { index: 0, count: 4, assisted: false },
    { index: 0.5, count: 1, assisted: false }, { index: 0, count: 1, assisted: 1 },
  ]) {
    for (const stack of ['history', 'future']) {
      const invalid = copy(session);
      invalid[stack] = [action];
      assert.equal(restoreSession(puzzle, invalid), null);
    }
  }
  applyTurn(puzzle, session, 0, 2, true);
  assert.equal(restoreSession(puzzle, { ...copy(session), usedHint: false }), null);
  undoTurn(puzzle, session);
  assert.equal(restoreSession(puzzle, { ...copy(session), usedHint: false }), null);
  assert.equal(restoreSession(puzzle, { ...copy(session), future: new Array(1) }), null);
});

test('saved masks are ignored so restored circuits always match their valid rotations', () => {
  const session = createSession(puzzle);
  applyTurn(puzzle, session, 0, 2);
  const stored = { ...copy(session), masks: new Array(16).fill(15) };
  const restored = restoreSession(puzzle, stored);
  assert.deepEqual(sessionMasks(puzzle, restored), sessionMasks(puzzle, session));
  assert.equal(Object.hasOwn(restored, 'masks'), false);
});

test('history size and unsafe arithmetic are bounded', () => {
  const session = createSession(puzzle);
  for (let i = 0; i < MAX_SESSION_ACTIONS; i++) assert.equal(applyTurn(puzzle, session, 0), true);
  assert.equal(applyTurn(puzzle, session, 0), false);
  assert.equal(restoreSession(puzzle, copy(session)).moves, MAX_SESSION_ACTIONS);
  const oversized = copy(session);
  oversized.future.push({ index: 1, count: 1, assisted: false });
  assert.equal(restoreSession(puzzle, oversized), null);

  const unsafe = createSession(puzzle);
  unsafe.moves = Number.MAX_SAFE_INTEGER;
  assert.equal(applyTurn(puzzle, unsafe, 0), false);
  unsafe.moves = 0;
  unsafe.turns[0] = Number.MAX_SAFE_INTEGER;
  assert.equal(applyTurn(puzzle, unsafe, 0), false);
});
