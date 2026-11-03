export const DIRECTIONS = [
  { bit: 1, opposite: 4, dx: 0, dy: -1 },
  { bit: 2, opposite: 8, dx: 1, dy: 0 },
  { bit: 4, opposite: 1, dx: 0, dy: 1 },
  { bit: 8, opposite: 2, dx: -1, dy: 0 },
];

export function seedNumber(input) {
  let hash = 2166136261;
  for (const c of String(input)) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return hash >>> 0;
}

export function randomFor(seed) {
  let state = typeof seed === 'number' ? seed >>> 0 : seedNumber(seed);
  return () => {
    state += 0x6D2B79F5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function rotate(mask, count = 1) {
  const turns = ((count % 4) + 4) % 4;
  return ((mask << turns) | (mask >> (4 - turns))) & 15;
}

export function minimumTurns(from, to) {
  for (let count = 0; count < 4; count++) if (rotate(from, count) === to) return count;
  return Infinity;
}

export function connectedCells(masks, size, source) {
  const connected = new Set([source]);
  const pending = [source];
  while (pending.length) {
    const current = pending.pop();
    const x = current % size;
    const y = Math.floor(current / size);
    for (const direction of DIRECTIONS) {
      if (!(masks[current] & direction.bit)) continue;
      const nx = x + direction.dx;
      const ny = y + direction.dy;
      if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
      const next = ny * size + nx;
      if (!(masks[next] & direction.opposite) || connected.has(next)) continue;
      connected.add(next);
      pending.push(next);
    }
  }
  return connected;
}

export function kstDate(now = new Date()) {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// A spanning tree is built in its solved orientation before the tiles are
// scrambled. Consequently every generated board has a concrete solution.
export function generatePuzzle(seed, size = 4) {
  if (!Number.isInteger(size) || size < 3 || size > 8) throw new RangeError('Grid size must be 3–8.');
  const random = randomFor(seed);
  const source = Math.floor(size / 2) * size;
  const solution = new Array(size * size).fill(0);
  const visited = new Set([source]);
  const stack = [source];
  while (stack.length) {
    const current = stack.at(-1);
    const x = current % size;
    const y = Math.floor(current / size);
    const options = DIRECTIONS.filter(({ dx, dy }) => {
      const nx = x + dx;
      const ny = y + dy;
      return nx >= 0 && nx < size && ny >= 0 && ny < size && !visited.has(ny * size + nx);
    });
    if (!options.length) { stack.pop(); continue; }
    const direction = options[Math.floor(random() * options.length)];
    const next = (y + direction.dy) * size + x + direction.dx;
    solution[current] |= direction.bit;
    solution[next] |= direction.opposite;
    visited.add(next);
    stack.push(next);
  }
  const flowers = solution.flatMap((mask, index) => index !== source && (mask & (mask - 1)) === 0 ? [index] : []);
  const masks = solution.map((mask, index) => index === source ? mask : rotate(mask, Math.floor(random() * 4)));
  // Extremely unlikely for small boards, but a freshly generated puzzle must
  // never already be complete.
  if (connectedCells(masks, size, source).size === size * size) {
    const leaf = flowers[0];
    masks[leaf] = rotate(masks[leaf]);
  }
  const par = masks.reduce((sum, mask, index) => sum + minimumTurns(mask, solution[index]), 0);
  return { seed: String(seed), size, source, solution, flowers, masks, par };
}

export function evaluate(puzzle, masks = puzzle.masks) {
  const powered = connectedCells(masks, puzzle.size, puzzle.source);
  const bloomed = puzzle.flowers.filter((index) => powered.has(index)).length;
  return { powered, bloomed, solved: powered.size === puzzle.size * puzzle.size };
}
