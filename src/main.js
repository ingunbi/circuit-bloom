import './style.css';
import { generatePuzzle, evaluate, rotate, kstDate } from './puzzle.js';

const STORAGE_KEY = 'circuit-bloom.v1';
function readSave() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
    return {
      level: Number.isInteger(data.level) && data.level > 0 ? Math.min(data.level, 999) : 1,
      records: data.records && typeof data.records === 'object' && !Array.isArray(data.records) ? data.records : {},
      sound: data.sound === true,
    };
  } catch { return { level: 1, records: {}, sound: false }; }
}
const save = readSave();
function persist() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(save)); } catch { /* Session remains playable. */ } }

const flower = `<svg viewBox="0 0 48 48" aria-hidden="true"><g class="petals"><ellipse cx="24" cy="13" rx="7.5" ry="11"/><ellipse cx="24" cy="13" rx="7.5" ry="11" transform="rotate(72 24 24)"/><ellipse cx="24" cy="13" rx="7.5" ry="11" transform="rotate(144 24 24)"/><ellipse cx="24" cy="13" rx="7.5" ry="11" transform="rotate(216 24 24)"/><ellipse cx="24" cy="13" rx="7.5" ry="11" transform="rotate(288 24 24)"/></g><circle class="flower-heart" cx="24" cy="24" r="6"/></svg>`;
const bolt = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2 5 13h6l-1 9 9-12h-6z" fill="currentColor"/></svg>`;
const leaf = `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M31 8c-15-1-24 8-21 18 11 5 23-3 21-18Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="m8 33 17-18" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;

document.querySelector('#app').innerHTML = `
  <div class="page-orbit orbit-one"></div><div class="page-orbit orbit-two"></div>
  <main class="shell">
    <header class="topbar"><a class="brand" href="./" aria-label="Circuit Bloom 처음으로">${leaf}<span>CIRCUIT <b>BLOOM</b></span></a><div class="top-actions"><span class="tiny-label">A LITTLE LIGHT, A LITTLE LIFE</span><button id="sound" class="icon-button" aria-pressed="false">소리 OFF</button><button id="help" class="icon-button" aria-label="도움말 열기">?</button></div></header>
    <section class="heading"><div><p class="eyebrow"><span></span> THE ELECTRIC GARDEN</p><h1>빛이 닿으면,<br><em>꽃이 피어나.</em></h1><p class="subtitle">조각을 돌려 빛을 잇는, 작은 회로 정원.</p></div><div class="hero-flower">${flower}<span>TAKE YOUR TIME.<br>LET IT BLOOM.</span></div></section>
    <section class="game-layout" aria-label="회로 정원 게임">
      <div class="garden-panel">
        <div class="garden-toolbar"><div><span class="eyebrow" id="garden-category">YOUR GARDEN</span><h2 id="garden-title">정원 01</h2></div><div class="mode-switch" aria-label="게임 모드"><button id="campaign-mode" class="selected" aria-pressed="true">이어 가기</button><button id="daily-mode" aria-pressed="false">오늘의 정원 <span>↗</span></button></div></div>
        <div class="board-wrap"><div id="board" class="board" role="group" aria-label="회로 타일"></div><div id="overlay" class="overlay"><div class="overlay-card"><span class="overlay-sprout">${leaf}</span><p class="eyebrow">READY TO GROW?</p><h3>작은 빛 하나로<br>정원을 깨워 보세요.</h3><p>회로를 톡톡 돌려 모든 조각에<br>빛을 이어 주면 꽃이 피어나요.</p><button id="start" class="primary">첫 정원 열기 <span>↗</span></button><span class="overlay-note">시간 제한 없이, 당신의 속도로.</span></div></div></div>
        <div class="board-footer"><span><i class="source-dot"></i>빛의 시작점</span><span>타일 탭 / 클릭 · Enter 회전</span><button id="pause" aria-label="게임 일시정지">일시정지 Ⅱ</button></div>
      </div>
      <aside class="side-panel"><section class="status-card"><div class="card-top"><span class="eyebrow">GARDEN JOURNAL</span><span id="grid-label">4 × 4</span></div><div class="move-count"><span id="moves">00</span><span>번 돌렸어요</span></div><div class="progress-line"><span>빛이 닿은 조각</span><b><span id="powered">1</span><small id="total"> / 16</small></b></div><div class="meter"><div id="meter-fill"></div></div><div class="flower-progress"><div class="little-flower">${flower}</div><div><b id="flower-count">0 / 0</b><span>피어난 꽃</span></div></div><div class="journal-bottom"><span>설계 기준 <b id="par">—</b>회</span><span>나의 기록 <b id="best">—</b></span></div></section>
        <section id="message-card" class="message-card"><span class="message-index">FIELD NOTE 001</span><h3 id="message-title">먼저, 빛을 따라가요.</h3><p id="message-text">빛나는 시작점에서부터 선을 이어 보세요. 연결된 회로는 연둣빛으로 물들어요.</p><div id="win-actions" class="hidden"><button id="next" class="primary">다음 정원으로 <span>↗</span></button></div></section>
        <div class="utility-actions"><button id="reset">↶ 처음 모양으로</button><button id="hint">✧ 한 조각 도움</button></div>
        <p class="quiet-note">마음을 서두를 필요 없어요.<br>멈춰도 빛은 기다려 줄 테니까.</p>
      </aside>
    </section>
    <footer class="page-footer"><span>CIRCUIT BLOOM <i>·</i> MINI GARDEN NO. 03</span><span>작은 연결이 만드는, 다정한 변화.</span></footer>
  </main>
  <dialog id="help-dialog"><button id="close-help" class="close-dialog" aria-label="도움말 닫기">×</button><p class="eyebrow">HOW TO BLOOM</p><h2>빛을 잇는 법</h2><ol><li>타일을 누르면 시계 방향으로 90° 돌아가요.</li><li>서로 마주 보는 선이 연결되면 전원이 흘러요.</li><li>모든 회로에 빛을 전달해 꽃을 모두 피우세요.</li></ol><p>키보드: 방향키로 이동 · Enter / Space 회전<br>P / Esc 일시정지 · M 소리 전환</p><p>✧ 도움은 한 조각을 정답 방향으로 돌려줘요. 사용하면 정원은 완성할 수 있지만 최고 기록에는 남지 않아요.</p><p class="help-small">오늘의 정원은 한국 시간 자정에 바뀌며, 같은 날에는 누구나 같은 퍼즐을 만나요. 기록은 이 브라우저에 저장돼요.</p><button id="help-done" class="primary">정원으로 돌아가기</button></dialog>
  <div id="announcer" class="sr-only" aria-live="polite" aria-atomic="true"></div>
`;

const $ = (selector) => document.querySelector(selector);
let audio;
function tone(frequency = 460, duration = 0.08, delay = 0) {
  if (!save.sound) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume().catch(() => {});
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const start = audio.currentTime + delay;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.055, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  } catch { /* Audio is optional. */ }
}
function setSound() {
  $('#sound').textContent = `소리 ${save.sound ? 'ON' : 'OFF'}`;
  $('#sound').setAttribute('aria-pressed', String(save.sound));
}

let mode = 'campaign';
let level = save.level;
let state = 'title';
let puzzle;
let masks;
let turns;
let moves = 0;
let usedHint = false;
let tiles = [];
let focusIndex = 0;
let previousBloomed = 0;
let preHelpState;

function focusBoard() {
  (tiles[focusIndex] ?? tiles[0])?.focus({ preventScroll: true });
}

function wires(mask) {
  const paths = [];
  if (mask & 1) paths.push('M50 50V0');
  if (mask & 2) paths.push('M50 50H100');
  if (mask & 4) paths.push('M50 50V100');
  if (mask & 8) paths.push('M50 50H0');
  return `<svg class="wires" viewBox="0 0 100 100" aria-hidden="true"><g class="wire-track">${paths.map((path) => `<path d="${path}"/>`).join('')}</g><g class="wire-light">${paths.map((path) => `<path d="${path}"/>`).join('')}</g><circle class="junction" cx="50" cy="50" r="5"/></svg>`;
}

function newPuzzle(showTitle = false) {
  const size = mode === 'daily' ? 5 : level < 4 ? 4 : level < 12 ? 5 : 6;
  const seed = mode === 'daily' ? `daily:${kstDate()}` : `garden:${level}`;
  puzzle = generatePuzzle(seed, size);
  masks = [...puzzle.masks];
  turns = new Array(masks.length).fill(0);
  moves = 0;
  previousBloomed = 0;
  usedHint = false;
  state = showTitle ? 'title' : 'playing';
  $('#board').style.setProperty('--size', size);
  $('#board').innerHTML = masks.map((mask, index) => {
    const source = index === puzzle.source;
    const isFlower = puzzle.flowers.includes(index);
    return `<button class="tile${source ? ' source' : ''}${isFlower ? ' flower-tile' : ''}" data-index="${index}" aria-label="${Math.floor(index / size) + 1}행 ${index % size + 1}열 ${source ? '전원 시작점 (고정)' : isFlower ? '꽃 회로, 회전' : '회로, 회전'}" ${source ? 'aria-disabled="true"' : ''}>${wires(mask)}${source ? `<span class="power-core">${bolt}</span>` : isFlower ? `<span class="flower">${flower}</span>` : '<span class="node-pin"></span>'}</button>`;
  }).join('');
  tiles = [...$('#board').querySelectorAll('.tile')];
  focusIndex = 0;
  tiles.forEach((tile, index) => tile.addEventListener('click', () => turnTile(index)));
  $('#campaign-mode').classList.toggle('selected', mode === 'campaign');
  $('#daily-mode').classList.toggle('selected', mode === 'daily');
  $('#campaign-mode').setAttribute('aria-pressed', String(mode === 'campaign'));
  $('#daily-mode').setAttribute('aria-pressed', String(mode === 'daily'));
  $('#garden-category').textContent = mode === 'daily' ? 'THE DAILY GARDEN' : 'YOUR GARDEN';
  $('#garden-title').textContent = mode === 'daily' ? kstDate().replaceAll('-', '.') : `정원 ${String(level).padStart(2, '0')}`;
  $('#grid-label').textContent = `${size} × ${size}`;
  $('#total').textContent = ` / ${size * size}`;
  $('#par').textContent = puzzle.par;
  $('#best').textContent = Number.isFinite(save.records[puzzle.seed]) ? `${save.records[puzzle.seed]}회` : '—';
  $('#overlay').classList.toggle('hidden', !showTitle);
  $('#win-actions').classList.add('hidden');
  $('#message-card').classList.remove('won');
  $('#message-title').textContent = mode === 'daily' ? '오늘, 같은 정원을 만나요.' : '먼저, 빛을 따라가요.';
  $('#message-text').textContent = mode === 'daily' ? '오늘의 회로는 모두에게 같아요. 내일은 또 다른 정원이 기다리고 있어요.' : '빛나는 시작점에서부터 선을 이어 보세요. 연결된 회로는 연둣빛으로 물들어요.';
  $('#pause').textContent = '일시정지 Ⅱ';
  update();
  if (!showTitle) focusBoard();
}

function turnTile(index) {
  if (state !== 'playing' || index === puzzle.source) return;
  masks[index] = rotate(masks[index]);
  turns[index] += 1;
  tiles[index].style.setProperty('--turn', `${turns[index] * 90}deg`);
  moves += 1;
  tone(280 + (index % 6) * 42, 0.09);
  update();
}

function update() {
  const result = evaluate(puzzle, masks);
  tiles.forEach((tile, index) => {
    const powered = result.powered.has(index);
    tile.classList.toggle('powered', powered);
    tile.setAttribute('data-powered', String(powered));
  });
  $('#moves').textContent = String(moves).padStart(2, '0');
  $('#powered').textContent = result.powered.size;
  $('#meter-fill').style.width = `${result.powered.size / masks.length * 100}%`;
  $('#flower-count').textContent = `${result.bloomed} / ${puzzle.flowers.length}`;
  if (result.bloomed > previousBloomed && state === 'playing' && moves > 0) tone(660, 0.22, 0.03);
  previousBloomed = result.bloomed;
  if (result.solved && state === 'playing') win();
}

function win() {
  state = 'won';
  const previousBest = save.records[puzzle.seed];
  const isBest = !usedHint && (!Number.isFinite(previousBest) || moves < previousBest);
  if (isBest) save.records[puzzle.seed] = moves;
  if (mode === 'campaign') save.level = Math.max(save.level, Math.min(level + 1, 999));
  persist();
  $('#best').textContent = Number.isFinite(save.records[puzzle.seed]) ? `${save.records[puzzle.seed]}회` : '—';
  $('#message-card').classList.add('won');
  $('#message-title').textContent = '당신 덕분에, 활짝.';
  $('#message-text').textContent = usedHint ? `${moves}번의 연결로 정원이 깨어났어요. 다음엔 도움 없이도 피워 볼까요?` : `${moves}번의 연결로 꽃 ${puzzle.flowers.length}송이가 피었어요.${isBest ? ' 새로운 나의 기록이에요!' : ' 작은 빛이 멋진 정원이 되었네요.'}`;
  $('#next').innerHTML = mode === 'daily' ? '나의 정원 이어 가기 <span>↗</span>' : '다음 정원으로 <span>↗</span>';
  $('#win-actions').classList.remove('hidden');
  $('#pause').textContent = '정원 완성 ✓';
  $('#announcer').textContent = `정원을 완성했어요. ${moves}회 회전, 꽃 ${puzzle.flowers.length}송이가 피었어요.`;
  [523, 659, 784, 1046].forEach((frequency, i) => tone(frequency, 0.35, i * 0.1));
}

function start() {
  if (state === 'title') { state = 'playing'; $('#overlay').classList.add('hidden'); focusBoard(); tone(523, 0.2); }
  else if (state === 'paused') resume();
}
function pause() {
  if (state !== 'playing') return;
  state = 'paused';
  $('#overlay').innerHTML = `<div class="overlay-card pause-card"><span class="overlay-sprout">${leaf}</span><p class="eyebrow">A QUIET MOMENT</p><h3>잠시 쉬어 가요.</h3><p>정원은 그대로 기다리고 있어요.</p><button id="resume" class="primary">다시 빛 잇기 <span>↗</span></button></div>`;
  $('#overlay').classList.remove('hidden');
  $('#resume').addEventListener('click', resume);
  $('#resume').focus();
  $('#pause').textContent = '계속하기 ▷';
}
function resume() { state = 'playing'; $('#overlay').classList.add('hidden'); $('#pause').textContent = '일시정지 Ⅱ'; focusBoard(); }

function help() {
  preHelpState = state;
  if (state === 'playing') state = 'help';
  $('#help-dialog').showModal();
}
function closeHelp() { $('#help-dialog').close(); }
$('#help-dialog').addEventListener('close', () => { if (state === 'help') state = preHelpState === 'playing' ? 'playing' : preHelpState; });
$('#help-dialog').addEventListener('click', (event) => { if (event.target === $('#help-dialog')) closeHelp(); });
$('#help').addEventListener('click', help);
$('#close-help').addEventListener('click', closeHelp);
$('#help-done').addEventListener('click', closeHelp);
$('#sound').addEventListener('click', () => { save.sound = !save.sound; persist(); setSound(); tone(600, 0.15); });
$('#start').addEventListener('click', start);
$('#campaign-mode').addEventListener('click', () => { mode = 'campaign'; level = save.level; newPuzzle(); });
$('#daily-mode').addEventListener('click', () => { mode = 'daily'; newPuzzle(); });
$('#reset').addEventListener('click', () => { if ($('#help-dialog').open) return; newPuzzle(); tone(330, 0.15); });
$('#next').addEventListener('click', () => { mode = 'campaign'; level = save.level; newPuzzle(); });
$('#pause').addEventListener('click', () => state === 'paused' ? resume() : state === 'title' ? start() : pause());
$('#hint').addEventListener('click', () => {
  if (state !== 'playing') return;
  const index = masks.findIndex((mask, i) => i !== puzzle.source && mask !== puzzle.solution[i]);
  if (index < 0) return;
  let count = 0;
  while (masks[index] !== puzzle.solution[index] && count < 4) { masks[index] = rotate(masks[index]); count++; }
  turns[index] += count;
  moves += count;
  usedHint = true;
  tiles[index].style.setProperty('--turn', `${turns[index] * 90}deg`);
  tiles[index].classList.add('hinted');
  setTimeout(() => tiles[index]?.classList.remove('hinted'), 900);
  $('#message-title').textContent = '작은 도움이 도착했어요.';
  $('#message-text').textContent = '반짝이는 조각을 정답 방향으로 맞췄어요. 도움을 쓴 정원은 최고 기록에 남지 않아요.';
  tone(740, 0.2);
  update();
});
$('#board').addEventListener('focusin', (event) => {
  const index = Number(event.target.dataset.index);
  if (Number.isInteger(index)) focusIndex = index;
});
$('#board').addEventListener('keydown', (event) => {
  const index = Number(event.target.dataset.index);
  if (!Number.isInteger(index)) return;
  const offsets = { ArrowUp: -puzzle.size, ArrowDown: puzzle.size, ArrowLeft: -1, ArrowRight: 1 };
  if (!(event.key in offsets)) return;
  event.preventDefault();
  const next = (index + offsets[event.key] + masks.length) % masks.length;
  tiles[next].focus();
});
window.addEventListener('keydown', (event) => {
  if ($('#help-dialog').open) return;
  if (event.repeat && ['KeyM', 'KeyP', 'Escape'].includes(event.code)) { event.preventDefault(); return; }
  if (event.code === 'KeyM') $('#sound').click();
  if (event.code === 'KeyP' || event.code === 'Escape') { event.preventDefault(); state === 'paused' ? resume() : pause(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

setSound();
newPuzzle(true);
if (import.meta.env.DEV) window.__game = {
  get puzzle() { return puzzle; }, get masks() { return masks; }, get state() { return state; },
  get moves() { return moves; }, start, turnTile, newPuzzle,
};
