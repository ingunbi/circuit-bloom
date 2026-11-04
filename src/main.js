import './style.css';
import './upgrade.css';
import './readability.css';
import { generatePuzzle, evaluate, rotate, kstDate } from './puzzle.js';
import { shortestRotation, bidirectionalPar } from './rotation.js';
import { watchKstDay } from './daily.js';
import { normalizeSave, recordWin, completionStars, gardenStats } from './save.js';
import { createSession, restoreSession, sessionMasks, applyTurn, undoTurn, redoTurn, toggleLock } from './session.js';
import { normalizeChallenge, puzzleKey, encodeChallenge, decodeChallenge, freeRecordKey, challengeFromPuzzle } from './challenge.js';

const STORAGE_KEY = 'circuit-bloom.v1';
const SESSION_KEY = 'circuit-bloom.sessions.v1';
let storageWorking = true;
function readJSON(key) {
  let raw;
  try { raw = localStorage.getItem(key); }
  catch { storageWorking = false; return null; }
  try { return JSON.parse(raw); } catch { return null; }
}
const save = normalizeSave(readJSON(STORAGE_KEY));
const stored = readJSON(SESSION_KEY);
const sessions = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { storageWorking = false; }
  renderSaveStatus();
}
function persist() { writeJSON(STORAGE_KEY, save); }

const flower = '<svg viewBox="0 0 48 48" aria-hidden="true"><g class="petals"><ellipse cx="24" cy="13" rx="7.5" ry="11"/><ellipse cx="24" cy="13" rx="7.5" ry="11" transform="rotate(72 24 24)"/><ellipse cx="24" cy="13" rx="7.5" ry="11" transform="rotate(144 24 24)"/><ellipse cx="24" cy="13" rx="7.5" ry="11" transform="rotate(216 24 24)"/><ellipse cx="24" cy="13" rx="7.5" ry="11" transform="rotate(288 24 24)"/></g><circle class="flower-heart" cx="24" cy="24" r="6"/></svg>';
const bolt = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2 5 13h6l-1 9 9-12h-6z" fill="currentColor"/></svg>';
const leaf = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M31 8c-15-1-24 8-21 18 11 5 23-3 21-18Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="m8 33 17-18" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
const lockIcon = '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="4.5" y="8.5" width="11" height="8" rx="2"/><path d="M7 8.5V6a3 3 0 0 1 6 0v2.5"/></svg>';
const $ = (selector) => document.querySelector(selector);
const awards = (count) => Array.from({ length: 3 }, (_, i) => '<span class="award-flower' + (i < count ? ' earned' : '') + '">' + flower + '</span>').join('');

$('#app').innerHTML = `
  <main class="shell">
    <header class="topbar"><a class="brand" href="./" aria-label="Circuit Bloom 처음으로">${leaf}<span>CIRCUIT <b>BLOOM</b></span></a><div class="top-actions"><button id="sound" class="icon-button" aria-pressed="false">소리 OFF</button><button id="learn" class="icon-button">연습</button><button id="browse" class="icon-button">정원</button><button id="help" class="icon-button" aria-label="도움말 열기" title="게임 방법">?</button></div></header>
    <section class="heading"><div><h1>빛을 잇고, <em>꽃을 피워요.</em></h1><p class="subtitle">조각을 돌려 모든 회로를 연결하세요.</p></div><div class="hero-flower">${flower}</div></section>
    <section class="game-layout" aria-label="회로 정원 게임">
      <div class="garden-panel">
        <div class="garden-toolbar"><div class="garden-identity"><h2 id="garden-title">정원 01</h2><span id="grid-label">4 × 4</span><span id="garden-category" hidden></span><span id="chapter-label" hidden></span></div><div class="mode-switch" aria-label="게임 모드"><button id="campaign-mode" aria-pressed="true" class="selected">캠페인</button><button id="daily-mode" aria-pressed="false">오늘</button><button id="free-mode" aria-pressed="false">자유</button></div></div>
        <div id="free-banner" class="free-banner hidden"><strong id="free-seed-label"></strong></div>
        <section class="status-card" aria-label="게임 진행"><div class="move-count"><span id="moves">00</span><span>회전</span></div><div class="progress-line"><span>연결</span><b><span id="powered">1</span><small id="total"> / 16</small></b></div><div class="flower-progress"><div class="little-flower">${flower}</div><div><b id="flower-count">0 / 0</b><span>꽃</span></div></div><div class="meter" aria-hidden="true"><div id="meter-fill"></div></div></section>
        <div class="board-wrap"><div id="board" class="board" role="group" aria-label="회로 타일" aria-describedby="control-note"></div><div id="overlay" class="overlay hidden"></div></div>
        <div class="board-controls"><div class="rotation-picker" role="group" aria-label="타일 회전 방향"><button id="rotate-left" aria-label="왼쪽 회전" aria-pressed="false" title="왼쪽으로 · Q">↺</button><button id="rotate-right" aria-label="오른쪽 회전" aria-pressed="true" title="오른쪽으로 · E">↻</button></div><button id="lock-mode" aria-label="조각 고정 모드" aria-pressed="false" title="고정 · F">${lockIcon}<b id="locked-count" hidden>0</b></button><button id="pause" aria-label="게임 일시정지" title="일시정지 · P">Ⅱ</button></div>
        <p id="control-note" hidden>탭하면 오른쪽으로 회전합니다.</p>
        <div class="play-actions"><button id="undo" title="되돌리기 · Z" aria-label="되돌리기">↶ <span>되돌림</span></button><button id="redo" title="다시 하기 · Y" aria-label="다시 하기">↷ <span>다시</span></button><button id="hint">✧ <span>도움</span></button><details id="tools-menu"><summary aria-label="추가 도구" title="추가 도구">•••</summary><div class="secondary-tools"><button id="reset">처음부터</button><button id="share-puzzle">퍼즐 공유</button><button id="create-free">새 정원</button></div></details></div>
        <p id="assisted-note" hidden>도움 사용 · 최고 기록 제외</p>
        <section id="message-card" class="message-card hidden" aria-live="polite"><h3 id="message-title"></h3><p id="message-text"></p><div id="win-actions" class="hidden"><div id="result-award" class="award-flowers"></div><p id="result-note"></p><button id="next" class="primary">다음 정원 <span>↗</span></button></div></section>
        <details class="journal-details"><summary>이 정원 기록</summary><div class="journal-bottom"><span>기준 <b id="par">—</b>회</span><span>최고 <b id="best">—</b></span></div><div class="award-guide"><div id="best-award" class="award-flowers" aria-label="아직 모은 꽃 없음">${awards(0)}</div><span>모은 꽃</span></div></details>
        <p id="save-status" role="status" hidden></p>
      </div>
    </section>
  </main>
  <dialog id="help-dialog"><button data-close="help-dialog" class="close-dialog" aria-label="도움말 닫기">×</button><h2>게임 방법</h2><ol><li>조각을 눌러 90° 돌리세요.</li><li>마주 보는 선이 이어지면 빛이 흘러요.</li><li>모든 조각에 빛을 연결하면 완성!</li></ol><details class="info-details"><summary>키보드와 고정</summary><p>방향키 이동 · Enter / Space 회전<br>Q 왼쪽 · E 오른쪽 · F 고정 / 해제<br>Z 되돌리기 · Y 다시 하기<br>P / Esc 일시정지 · M 소리</p><p>우클릭이나 Shift+클릭은 반대로 돌립니다. 고정한 조각은 회전과 도움으로 바뀌지 않으며, 고정도 되돌릴 수 있어요.</p></details><details class="info-details"><summary>꽃과 최고 기록</summary><p>도움 없이 기준 이내는 꽃 3송이, 1.5배 이내는 2송이, 그 밖의 완성은 1송이입니다. 기준은 준비된 정답까지의 양방향 회전 수이며, 최적해를 뜻하지는 않아요.</p><p>도움을 쓴 시도는 최고 기록에 남지 않습니다. 도움을 되돌려도 이 조건은 유지돼요.</p></details><details class="info-details"><summary>저장과 일일 퍼즐</summary><p>회로와 고정·되돌리기 이력을 이 브라우저에 저장합니다. 일일 퍼즐은 한국 시간 자정에 바뀝니다.</p><p>공유받은 퍼즐은 자유 정원으로 열립니다. 캠페인 진도와 일일 연속 기록에 영향을 주지 않아요.</p></details><button id="help-done" data-close="help-dialog" class="primary">돌아가기</button></dialog>
  <dialog id="practice-dialog"><button data-close="practice-dialog" class="close-dialog" aria-label="연습 닫기">×</button><h2>빛 연결 연습</h2><p class="practice-intro">두 조각을 돌려 꽃에 빛을 연결하세요.</p><div id="practice-board" class="practice-board" role="group" aria-label="세 조각 연결 연습"><button class="tile source" disabled aria-label="연습 전원 시작점"></button><button class="tile" aria-label="연습 가운데 회로 회전"></button><button class="tile" aria-label="연습 꽃 회로 회전"></button></div><div id="practice-progress" class="practice-progress"></div><div class="practice-tip" aria-live="polite"><h3 id="practice-title"></h3><p id="practice-text"></p></div><div class="practice-actions"><button id="practice-reset">다시</button><button id="practice-done" data-close="practice-dialog" class="primary">게임으로</button></div></dialog>
  <dialog id="gardens-dialog"><button data-close="gardens-dialog" class="close-dialog" aria-label="정원 목록 닫기">×</button><h2>나의 정원</h2><section class="collection-strip" aria-label="나의 정원 기록"><div><b id="stat-completed">0</b><span>완성</span></div><div><b id="stat-flowers">0</b><span>모은 꽃</span></div><div><b id="stat-streak">0<small>일</small></b><span>일일 연속</span></div></section><div class="garden-pagination"><button id="previous-page" aria-label="이전 정원 페이지">←</button><span id="garden-page-label"></span><button id="next-page" aria-label="다음 정원 페이지">→</button></div><div id="garden-grid" class="garden-grid"></div><p class="help-small">고른 정원에서 이어하기가 시작됩니다.</p></dialog>
  <dialog id="free-dialog"><button data-close="free-dialog" class="close-dialog" aria-label="자유 정원 만들기 닫기">×</button><h2>새 자유 정원</h2><p>같은 이름과 크기면 같은 퍼즐이 열려요.</p><form id="free-form"><fieldset class="size-options"><legend>크기</legend><label><input type="radio" name="free-size" value="4"><b>4 × 4</b></label><label><input type="radio" name="free-size" value="5" checked><b>5 × 5</b></label><label><input type="radio" name="free-size" value="6"><b>6 × 6</b></label></fieldset><label class="field-label" for="free-seed">씨앗 이름 <small>최대 40자</small></label><div class="seed-entry"><input id="free-seed" maxlength="80" autocomplete="off" placeholder="예: 반딧불 정원" required><button id="random-free" type="button">무작위</button></div><p id="free-error" class="form-status" role="status"></p><button type="submit" class="primary">만들기</button></form><details id="import-options" class="import-section"><summary>코드로 열기</summary><label class="field-label" for="import-code">퍼즐 코드 또는 링크</label><textarea id="import-code" rows="2" maxlength="2048" placeholder="받은 코드를 붙여 넣으세요."></textarea><button id="import-free" class="secondary-action">열기</button></details><p class="help-small">새로 만들면 이전 자유 정원의 이어하기가 바뀝니다.</p></dialog>
  <dialog id="share-dialog"><button data-close="share-dialog" class="close-dialog" aria-label="퍼즐 공유 닫기">×</button><h2>퍼즐 공유</h2><p id="share-name"></p><p>회전 전의 같은 회로를 공유해요.</p><label class="field-label" for="share-code">퍼즐 코드</label><textarea id="share-code" rows="3" readonly></textarea><button id="copy-code" class="primary">코드 복사</button><details id="link-options" class="info-details"><summary>링크로 공유</summary><label class="field-label" for="share-link">공유 링크</label><input id="share-link" readonly><button id="copy-link" class="secondary-action">링크 복사</button><p class="help-small">로컬 주소가 열리지 않으면 퍼즐 코드를 보내 주세요.</p></details><p id="share-status" class="form-status" role="status"></p></dialog>
  <div id="announcer" class="sr-only" aria-live="polite" aria-atomic="true"></div>
`;

let audio;
function tone(frequency = 460, duration = 0.08, delay = 0) {
  if (!save.sound) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume().catch(() => {});
    const oscillator = audio.createOscillator(), gain = audio.createGain(), start = audio.currentTime + delay;
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(0.055, start + 0.012); gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain).connect(audio.destination); oscillator.start(start); oscillator.stop(start + duration + 0.01);
  } catch { /* Audio is optional. */ }
}
function setSound() { $('#sound').textContent = save.sound ? '소리 켬' : '소리 끔'; $('#sound').setAttribute('aria-pressed', String(save.sound)); }
function renderSaveStatus() {
  if (!$('#save-status')) return;
  $('#save-status').hidden = storageWorking;
  $('#save-status').textContent = storageWorking ? '저장됨' : '이 창에서만 진행이 유지됩니다.';
  $('#save-status').title = storageWorking ? '회로와 되돌리기 이력을 이 브라우저에 저장해요.' : '브라우저 저장을 사용할 수 없어 이 창에서만 진행을 유지해요.';
}
function renderStats() {
  const stats = gardenStats(save, kstDate());
  $('#stat-completed').textContent = stats.completed;
  $('#stat-flowers').textContent = stats.totalStars;
  $('#stat-streak').innerHTML = `${stats.dailyStreak}<small>일</small>`;
  $('#stat-completed').title = `캠페인 ${stats.campaignCompleted} · 자유 정원 ${stats.freeCompleted}`;
}
function campaignResumeLevel() {
  const match = /^garden:([1-9]\d*)$/.exec(sessions.campaign?.seed ?? '');
  const candidate = Number(match?.[1]);
  return Number.isSafeInteger(candidate) && candidate <= save.level ? candidate : save.level;
}
let freeChallenge = normalizeChallenge(sessions.freeChallenge);
const launchShare = consumeShareHash();
if (launchShare.challenge) freeChallenge = launchShare.challenge;
let mode = launchShare.challenge ? 'free' : sessions.lastMode === 'free' && freeChallenge ? 'free' : sessions.lastMode === 'daily' ? 'daily' : 'campaign';
let level = campaignResumeLevel(), state = 'title';
let puzzle, session, masks, targetTurns, currentChallenge, tiles = [], focusIndex = 0, previousBloomed = 0;
let rotationDirection = 1, lockMode = false;
let dialogReturnState = 'playing', gardenPage = 0;
const dialogIds = ['#help-dialog', '#gardens-dialog', '#practice-dialog', '#free-dialog', '#share-dialog'];
function dialogOpen() { return dialogIds.some(id => $(id).open); }
function focusBoard() { (tiles[focusIndex] ?? tiles[0])?.focus({ preventScroll: true }); }
function persistSession() {
  if (!session || state === 'won' || (state === 'dialog' && dialogReturnState === 'won')) return;
  sessions[mode] = session;
  sessions.lastMode = mode;
  if (mode === 'free') sessions.freeChallenge = freeChallenge;
  writeJSON(SESSION_KEY, sessions);
}
function clearSession() { delete sessions[mode]; writeJSON(SESSION_KEY, sessions); }
function setMessage(title, text, visible = false) {
  $('#message-title').textContent = title; $('#message-text').textContent = text;
  $('#message-card').classList.toggle('hidden', !visible);
}
function updateControls() {
  const playing = state === 'playing';
  $('#undo').disabled = !playing || !session?.history.length;
  $('#redo').disabled = !playing || !session?.future.length;
  $('#hint').disabled = !playing;
  $('#reset').disabled = state === 'title' || state === 'dialog';
  $('#rotate-left').setAttribute('aria-pressed', String(rotationDirection === -1));
  $('#rotate-right').setAttribute('aria-pressed', String(rotationDirection === 1));
  $('#lock-mode').setAttribute('aria-pressed', String(lockMode));
  $('#board').classList.toggle('lock-mode', lockMode);
  $('#locked-count').textContent = session?.locked.filter(Boolean).length ?? 0;
  $('#locked-count').hidden = !session?.locked.some(Boolean);
  $('#assisted-note').hidden = !session?.usedHint;
  $('#control-note').textContent = lockMode ? '고정할 조각을 탭하세요. 다시 탭하면 풀려요.' : `탭하면 ${rotationDirection === 1 ? '오른쪽' : '왼쪽'}으로 · 우클릭 / Shift+클릭은 반대로 · F 고정`;
  tiles.forEach((tile, i) => tile.setAttribute('aria-disabled', String(i === puzzle.source || (session.locked[i] && !lockMode))));
  const pauseLabel = state === 'paused' ? '계속하기' : state === 'won' ? '정원 완성' : state === 'title' ? '시작하기' : '일시정지';
  $('#pause').setAttribute('aria-label', pauseLabel); $('#pause').title = pauseLabel;
  $('#pause').textContent = state === 'paused' ? '▷' : state === 'won' ? '✓' : 'Ⅱ';
}
function overlay(kind) {
  const paused = kind === 'paused', continuing = session.moves > 0 || session.history.length > 0 || session.future.length > 0 || session.usedHint;
  $('#overlay').innerHTML = `<div class="overlay-card"><span class="overlay-sprout">${leaf}</span><h3>${paused ? '잠시 멈춤' : continuing ? '이어서 플레이' : '빛을 이어볼까요?'}</h3><button id="${paused ? 'resume' : 'start'}" class="primary">${paused ? '계속하기' : continuing ? '이어하기' : '시작하기'}</button>${!paused && !continuing ? '<button id="practice-open" class="practice-open">먼저 연습하기</button>' : ''}</div>`;
  $('#overlay').classList.remove('hidden');
}
function wires(mask) {
  const paths = [];
  if (mask & 1) paths.push('M50 50V0');
  if (mask & 2) paths.push('M50 50H100');
  if (mask & 4) paths.push('M50 50V100');
  if (mask & 8) paths.push('M50 50H0');
  return `<svg class="wires" viewBox="0 0 100 100" aria-hidden="true"><g class="wire-track">${paths.map(d => `<path d="${d}"/>`).join('')}</g><g class="wire-light">${paths.map(d => `<path d="${d}"/>`).join('')}</g><circle class="junction" cx="50" cy="50" r="5"/></svg>`;
}
let practiceMasks = [2, 5, 4];
const practiceTiles = [...$('#practice-board').querySelectorAll('button')];
function renderPractice() {
  const middle = Boolean(practiceMasks[1] & 8);
  const complete = middle && Boolean(practiceMasks[1] & 2) && Boolean(practiceMasks[2] & 8);
  const count = complete ? 3 : middle ? 2 : 1;
  practiceTiles.forEach((tile, i) => {
    tile.innerHTML = wires(practiceMasks[i]) + (i === 0 ? `<span class="power-core">${bolt}</span>` : i === 2 ? `<span class="flower">${flower}</span>` : '<span class="node-pin"></span>');
    tile.classList.toggle('powered', i === 0 || (i === 1 && middle) || (i === 2 && complete));
  });
  $('#practice-board').classList.toggle('complete', complete);
  $('#practice-progress').textContent = `빛이 닿은 조각 ${count} / 3`;
  $('#practice-title').textContent = complete ? '연결 완료!' : middle ? '이제 꽃까지 이어요.' : '가운데 조각을 돌려 보세요.';
  $('#practice-text').textContent = complete ? '실제 정원에서도 모든 조각을 연결하세요.' : middle ? '오른쪽 조각을 돌리면 꽃에 빛이 닿아요.' : '세로 회로를 가로로 바꾸면 빛이 이어져요.';
  $('#practice-done').textContent = '게임으로';
}
function openPractice() {
  if (dialogOpen()) return;
  practiceMasks = [2, 5, 4]; renderPractice(); openDialog('#practice-dialog');
}
practiceTiles.forEach((tile, i) => { if (i > 0) tile.addEventListener('click', () => { practiceMasks[i] = rotate(practiceMasks[i]); renderPractice(); tone(440 + i * 120, 0.08); }); });
$('#practice-reset').addEventListener('click', () => { practiceMasks = [2, 5, 4]; renderPractice(); });
function newPuzzle(showTitle = false, moveFocus = true, restore = true) {
  const today = kstDate();
  currentChallenge = mode === 'free' ? freeChallenge : normalizeChallenge(mode === 'daily' ? { mode, date: today } : { mode, level });
  const size = currentChallenge.size;
  puzzle = generatePuzzle(puzzleKey(currentChallenge), size);
  if (mode === 'free') puzzle.seed = freeRecordKey(currentChallenge);
  targetTurns = bidirectionalPar(puzzle);
  session = (restore && restoreSession(puzzle, sessions[mode])) || createSession(puzzle);
  if (evaluate(puzzle, sessionMasks(puzzle, session)).solved) session = createSession(puzzle);
  state = showTitle ? 'title' : 'playing';
  previousBloomed = 0; focusIndex = 0; lockMode = false;
  $('#board').style.setProperty('--size', size);
  $('#board').innerHTML = puzzle.masks.map((mask, index) => {
    const source = index === puzzle.source, isFlower = puzzle.flowers.includes(index);
    return `<button class="tile${source ? ' source' : ''}${isFlower ? ' flower-tile' : ''}" data-index="${index}" tabindex="${index === 0 ? 0 : -1}" ${source ? 'aria-disabled="true"' : ''}>${wires(mask)}${source ? `<span class="power-core">${bolt}</span>` : isFlower ? `<span class="flower">${flower}</span>` : '<span class="node-pin"></span>'}<span class="lock-mark">${lockIcon}</span></button>`;
  }).join('');
  tiles = [...$('#board').querySelectorAll('.tile')];
  tiles.forEach((tile, i) => {
    tile.addEventListener('click', event => lockMode ? lockTile(i) : turnTile(i, event.shiftKey ? -rotationDirection : rotationDirection));
    tile.addEventListener('contextmenu', event => { event.preventDefault(); if (!lockMode) turnTile(i, -rotationDirection); });
  });
  for (const name of ['campaign', 'daily', 'free']) { $('#' + name + '-mode').classList.toggle('selected', mode === name); $('#' + name + '-mode').setAttribute('aria-pressed', String(mode === name)); }
  $('#garden-category').textContent = mode === 'free' ? 'YOUR OWN LITTLE GARDEN' : mode === 'daily' ? 'THE DAILY GARDEN' : 'YOUR GARDEN';
  $('#garden-title').textContent = mode === 'free' ? '자유 정원' : mode === 'daily' ? today.replaceAll('-', '.') : `정원 ${String(level).padStart(2, '0')}`;
  $('#chapter-label').textContent = mode === 'free' ? `나만의 속도로 · ${size} × ${size}` : mode === 'daily' ? '매일 새로운 빛 · 한국 시간 기준' : `${size === 4 ? '새싹' : size === 5 ? '꽃잎' : '만개'} 정원 · ${size} × ${size}`;
  $('#free-banner').classList.toggle('hidden', mode !== 'free');
  $('#free-seed-label').textContent = mode === 'free' ? challengeLabel(currentChallenge) : '';
  $('#grid-label').textContent = `${size} × ${size}`; $('#total').textContent = ` / ${size * size}`; $('#par').textContent = targetTurns;
  $('#overlay').classList.add('hidden'); $('#win-actions').classList.add('hidden'); $('#message-card').classList.remove('won');
  $('#announcer').textContent = '';
  setMessage('', '');
  $('#pause').textContent = '일시정지 Ⅱ';
  update(); persistSession(); renderStats();
  if (showTitle) overlay('title');
  else if (moveFocus) focusBoard();
}
function refreshDailyPuzzle() {
  if (mode !== 'daily' || puzzle.seed === `daily:${kstDate()}`) return false;
  const open = dialogOpen(), wasPaused = state === 'paused' || (open && dialogReturnState === 'paused');
  const focused = tiles.indexOf(document.activeElement);
  newPuzzle(false, false, false);
  if (wasPaused) { state = 'paused'; overlay('paused'); $('#pause').textContent = '계속하기 ▷'; }
  if (open) { state = 'dialog'; dialogReturnState = wasPaused ? 'paused' : 'playing'; }
  else if (!wasPaused && focused >= 0) { focusIndex = focused; focusBoard(); }
  setMessage('새 일일 퍼즐이 열렸어요.', '', true);
  $('#announcer').textContent = '한국 날짜가 바뀌어 새로운 오늘의 정원을 열었어요.';
  updateControls(); return true;
}
function turnTile(index, count = rotationDirection) {
  if (refreshDailyPuzzle() || state !== 'playing' || !applyTurn(puzzle, session, index, count)) return;
  setMessage('', '');
  tone(280 + index % 6 * 42); update(); persistSession();
}
function lockTile(index) {
  if (refreshDailyPuzzle() || state !== 'playing' || !toggleLock(puzzle, session, index)) return;
  setMessage('', '');
  $('#announcer').textContent = `${Math.floor(index / puzzle.size) + 1}행 ${index % puzzle.size + 1}열 ${session.locked[index] ? '고정했어요' : '고정을 풀었어요'}.`;
  tone(500, 0.06); update(); persistSession();
}
function changeHistory(redo = false) {
  if (refreshDailyPuzzle() || state !== 'playing') return;
  const action = (redo ? session.future : session.history).at(-1);
  if (!(redo ? redoTurn : undoTurn)(puzzle, session)) return;
  focusIndex = action.index;
  setMessage('', '');
  tone(redo ? 440 : 330); update(); persistSession();
}
function update() {
  masks = sessionMasks(puzzle, session);
  const result = evaluate(puzzle, masks);
  $('#board').classList.toggle('complete', result.solved);
  tiles.forEach((tile, i) => {
    const powered = result.powered.has(i);
    tile.style.setProperty('--turn', `${session.turns[i] * 90}deg`);
    tile.classList.toggle('locked', session.locked[i]);
    tile.classList.toggle('powered', powered); tile.setAttribute('data-powered', String(powered));
    tile.setAttribute('aria-label', `${Math.floor(i / puzzle.size) + 1}행 ${i % puzzle.size + 1}열 ${i === puzzle.source ? '전원 시작점 (고정)' : session.locked[i] ? '고정한 회로, F로 해제' : puzzle.flowers.includes(i) ? '꽃 회로, 회전' : '회로, 회전'}, ${powered ? '빛 연결됨' : '빛 연결 안 됨'}`);
  });
  $('#moves').textContent = String(session.moves).padStart(2, '0'); $('#powered').textContent = result.powered.size;
  $('#meter-fill').style.width = `${result.powered.size / masks.length * 100}%`; $('#flower-count').textContent = `${result.bloomed} / ${puzzle.flowers.length}`;
  $('#best').textContent = Number.isFinite(save.records[puzzle.seed]) ? `${save.records[puzzle.seed]}회` : '—';
  const collected = save.completions[puzzle.seed]?.stars ?? 0;
  $('#best-award').innerHTML = awards(collected); $('#best-award').setAttribute('aria-label', `이 정원에서 모은 꽃 ${collected}송이`);
  if (result.bloomed > previousBloomed && state === 'playing' && session.moves) tone(660, 0.22, 0.03);
  previousBloomed = result.bloomed;
  if (result.solved && state === 'playing') win();
  updateControls(); renderSaveStatus();
}
function win() {
  state = 'won';
  const stars = completionStars(session.moves, targetTurns, session.usedHint);
  const isBest = recordWin(save, { seed: puzzle.seed, moves: session.moves, usedHint: session.usedHint, mode, level, par: targetTurns });
  persist(); clearSession(); renderStats();
  $('#best').textContent = Number.isFinite(save.records[puzzle.seed]) ? `${save.records[puzzle.seed]}회` : '—';
  $('#best-award').innerHTML = awards(save.completions[puzzle.seed].stars);
  $('#best-award').setAttribute('aria-label', `이 정원에서 모은 꽃 ${save.completions[puzzle.seed].stars}송이`);
  $('#message-card').classList.add('won');
  setMessage('정원 완성!', `${session.moves}회${isBest ? ' · 새 최고 기록' : ''}`, true);
  $('#result-award').innerHTML = awards(stars); $('#result-award').setAttribute('aria-label', `이번 완성 꽃 ${stars}송이`);
  $('#result-note').textContent = `꽃 ${stars}송이 획득`;
  $('#next').textContent = mode === 'free' ? '새 정원' : mode === 'daily' ? '캠페인으로' : '다음 정원';
  $('#win-actions').classList.remove('hidden'); $('#pause').textContent = '정원 완성 ✓';
  $('#announcer').textContent = `정원을 완성했어요. ${session.moves}회 회전, 꽃 ${stars}송이를 모았어요.`;
  [523, 659, 784, 1046].forEach((frequency, i) => tone(frequency, 0.35, i * 0.1));
}
function start() { if (state !== 'title' && state !== 'paused') return; refreshDailyPuzzle(); state = 'playing'; $('#overlay').classList.add('hidden'); $('#pause').textContent = '일시정지 Ⅱ'; updateControls(); focusBoard(); tone(523, 0.2); }
function pause() { if (state !== 'playing') return; state = 'paused'; persistSession(); overlay('paused'); $('#pause').textContent = '계속하기 ▷'; updateControls(); $('#resume').focus(); }
function switchMode(nextMode) {
  if (dialogOpen()) return;
  if (nextMode === 'free' && !freeChallenge) { openFreeDialog(); return; }
  if (nextMode === mode && state !== 'won') { if (state === 'paused' || state === 'title') start(); else refreshDailyPuzzle(); return; }
  persistSession(); mode = nextMode;
  if (mode === 'campaign') level = campaignResumeLevel();
  newPuzzle();
}
function openDialog(id) {
  if (dialogOpen()) return;
  if ($('#tools-menu').open) $('#tools-menu > summary')?.focus({ preventScroll: true });
  $('#tools-menu').open = false;
  dialogReturnState = state; state = 'dialog'; updateControls(); $(id).showModal();
}
for (const id of dialogIds) {
  $(id).addEventListener('close', () => { if (state === 'dialog') state = dialogReturnState; updateControls(); });
  $(id).addEventListener('click', event => { if (event.target === $(id)) $(id).close(); });
}
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.close).close()));
function challengeLabel(challenge) {
  if (challenge.mode === 'campaign') return `정원 ${String(challenge.level).padStart(2, '0')}의 씨앗`;
  if (challenge.mode === 'daily') return `${challenge.date.replaceAll('-', '.')}의 정원`;
  return challenge.seed;
}
function consumeShareHash() {
  const hash = window.location.hash;
  if (!hash.startsWith('#puzzle=')) return { present: false, challenge: null };
  const code = hash.length <= 2048 ? new URLSearchParams(hash.slice(1)).get('puzzle') : null;
  try { window.history.replaceState(null, '', window.location.pathname + window.location.search); } catch { /* The puzzle still opens if history is restricted. */ }
  return { present: true, challenge: decodeChallenge(code) };
}
function showShareError() {
  setMessage('공유 코드를 확인해 주세요.', '진행하던 퍼즐은 유지됩니다.', true);
  $('#announcer').textContent = '공유 코드를 확인해 주세요. 기존 정원은 그대로 유지됩니다.';
}
function seedName() {
  const random = new Uint32Array(1);
  try { window.crypto.getRandomValues(random); } catch { random[0] = Math.floor(Math.random() * 0x100000000); }
  return `별빛 ${random[0].toString(36).toUpperCase()}`;
}
function openFreeDialog() {
  if (dialogOpen()) return;
  const size = mode === 'free' ? currentChallenge.size : freeChallenge?.size ?? 5;
  document.querySelectorAll('input[name="free-size"]').forEach(input => { input.checked = Number(input.value) === size; });
  $('#free-seed').value = seedName(); $('#free-error').textContent = ''; $('#import-code').value = '';
  $('#import-options').open = false;
  openDialog('#free-dialog');
}
function openFreeChallenge(challenge) {
  const normalized = normalizeChallenge(challenge);
  if (!normalized) return;
  persistSession();
  freeChallenge = normalized; mode = 'free';
  for (const id of dialogIds) if ($(id).open) $(id).close();
  newPuzzle(false, true, false);
}
function parseSharedInput(value) {
  const text = value.trim();
  const direct = decodeChallenge(text);
  if (direct) return direct;
  try {
    const url = new URL(text);
    return ['http:', 'https:'].includes(url.protocol) ? decodeChallenge(new URLSearchParams(url.hash.slice(1)).get('puzzle')) : null;
  } catch { return null; }
}
function openShareDialog() {
  if (dialogOpen()) return;
  const challenge = challengeFromPuzzle(puzzle);
  if (!challenge) { showShareError(); return; }
  const code = encodeChallenge(challenge);
  const url = new URL(/* @vite-ignore */ '../', import.meta.url);
  url.hash = `puzzle=${code}`;
  $('#share-name').textContent = `${challengeLabel(challenge)} · ${challenge.size} × ${challenge.size}`;
  $('#share-code').value = code; $('#share-link').value = url.href; $('#share-status').textContent = '';
  $('#link-options').open = false;
  openDialog('#share-dialog');
}
async function copyShare(field) {
  const input = $(field);
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(input.value);
    $('#share-status').textContent = field === '#share-code' ? '코드를 복사했어요.' : '링크를 복사했어요.';
  } catch {
    input.focus(); input.select();
    $('#share-status').textContent = '선택한 내용을 직접 복사해 주세요.';
  }
}
$('#create-free').addEventListener('click', openFreeDialog);
$('#share-puzzle').addEventListener('click', openShareDialog);
$('#copy-code').addEventListener('click', () => copyShare('#share-code'));
$('#copy-link').addEventListener('click', () => copyShare('#share-link'));
$('#random-free').addEventListener('click', () => { $('#free-seed').value = seedName(); $('#free-error').textContent = ''; });
$('#free-form').addEventListener('submit', event => {
  event.preventDefault();
  const challenge = normalizeChallenge({ mode: 'free', size: Number(document.querySelector('input[name="free-size"]:checked')?.value), seed: $('#free-seed').value });
  if (!challenge) { $('#free-error').textContent = '씨앗 이름을 1~40자로 입력하세요.'; return; }
  openFreeChallenge(challenge);
});
$('#import-free').addEventListener('click', () => {
  const challenge = parseSharedInput($('#import-code').value);
  if (!challenge) { $('#free-error').textContent = '코드나 링크를 다시 확인하세요.'; return; }
  openFreeChallenge(challenge);
});
window.addEventListener('hashchange', () => {
  const shared = consumeShareHash();
  if (!shared.present) return;
  if (shared.challenge) openFreeChallenge(shared.challenge); else showShareError();
});
function renderGardens() {
  const start = gardenPage * 12 + 1;
  $('#garden-page-label').textContent = `${String(start).padStart(2, '0')} — ${String(start + 11).padStart(2, '0')}`;
  $('#previous-page').disabled = gardenPage === 0; $('#next-page').disabled = start + 12 > save.level;
  $('#garden-grid').innerHTML = Array.from({ length: 12 }, (_, i) => {
    const n = start + i, locked = n > save.level, stars = save.completions[`garden:${n}`]?.stars ?? 0;
    return `<button class="garden-choice${mode === 'campaign' && level === n ? ' current' : ''}" data-level="${n}" ${locked ? 'disabled' : ''} aria-label="정원 ${n}${locked ? ', 아직 열리지 않음' : `, 모은 꽃 ${stars}송이`}"><span>${String(n).padStart(2, '0')}</span><div class="award-flowers">${awards(stars)}</div><small>${locked ? '잠김' : n === save.level ? '다음' : '다시'}</small></button>`;
  }).join('');
}
$('#browse').addEventListener('click', () => { gardenPage = Math.floor(((mode === 'campaign' ? level : save.level) - 1) / 12); renderGardens(); openDialog('#gardens-dialog'); });
$('#previous-page').addEventListener('click', () => { gardenPage--; renderGardens(); });
$('#next-page').addEventListener('click', () => { gardenPage++; renderGardens(); });
$('#garden-grid').addEventListener('click', event => {
  const button = event.target.closest('button[data-level]'); if (!button || button.disabled) return;
  persistSession(); mode = 'campaign'; level = Number(button.dataset.level); $('#gardens-dialog').close(); newPuzzle(false, true, false);
});
$('#help').addEventListener('click', () => openDialog('#help-dialog'));
$('#learn').addEventListener('click', openPractice);
$('#rotate-left').addEventListener('click', () => { rotationDirection = -1; lockMode = false; updateControls(); });
$('#rotate-right').addEventListener('click', () => { rotationDirection = 1; lockMode = false; updateControls(); });
$('#lock-mode').addEventListener('click', () => { lockMode = !lockMode; updateControls(); });
$('#sound').addEventListener('click', () => { save.sound = !save.sound; persist(); setSound(); tone(600, 0.15); });
$('#overlay').addEventListener('click', event => { if (event.target.closest('#start, #resume')) start(); else if (event.target.closest('#practice-open')) openPractice(); });
$('#campaign-mode').addEventListener('click', () => switchMode('campaign'));
$('#daily-mode').addEventListener('click', () => switchMode('daily'));
$('#free-mode').addEventListener('click', () => switchMode('free'));
$('#reset').addEventListener('click', () => { if (dialogOpen()) return; $('#tools-menu').open = false; newPuzzle(false, true, false); tone(330); });
$('#undo').addEventListener('click', () => changeHistory());
$('#redo').addEventListener('click', () => changeHistory(true));
$('#next').addEventListener('click', () => {
  if (state !== 'won') return;
  if (mode === 'free') openFreeDialog();
  else if (mode === 'daily') { mode = 'campaign'; level = campaignResumeLevel(); newPuzzle(); }
  else { level = Math.min(level + 1, save.level); newPuzzle(false, true, false); }
});
$('#pause').addEventListener('click', () => state === 'paused' || state === 'title' ? start() : pause());
$('#hint').addEventListener('click', () => {
  if (refreshDailyPuzzle() || state !== 'playing') return;
  const index = masks.findIndex((mask, i) => i !== puzzle.source && !session.locked[i] && mask !== puzzle.solution[i]);
  if (index < 0) { setMessage('고정한 조각을 먼저 풀어 주세요.', '', true); return; }
  const count = shortestRotation(masks[index], puzzle.solution[index]);
  if (!applyTurn(puzzle, session, index, count, true)) return;
  const tile = tiles[index]; tile.classList.add('hinted'); setTimeout(() => tile.classList.remove('hinted'), 900);
  setMessage('한 조각을 맞췄어요.', '', true);
  tone(740, 0.2); update(); persistSession();
});
$('#board').addEventListener('focusin', event => {
  const index = Number(event.target.dataset.index); if (!Number.isInteger(index)) return;
  focusIndex = index; tiles.forEach((tile, i) => { tile.tabIndex = i === index ? 0 : -1; });
});
$('#board').addEventListener('keydown', event => {
  const index = Number(event.target.dataset.index); if (!Number.isInteger(index)) return;
  if (['KeyQ', 'KeyE', 'KeyF'].includes(event.code) && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault(); if (event.repeat) return;
    if (event.code === 'KeyF') lockTile(index); else turnTile(index, event.code === 'KeyQ' ? -1 : 1);
    return;
  }
  const size = puzzle.size, row = Math.floor(index / size), col = index % size;
  const next = { ArrowUp: (row + size - 1) % size * size + col, ArrowDown: (row + 1) % size * size + col, ArrowLeft: row * size + (col + size - 1) % size, ArrowRight: row * size + (col + 1) % size }[event.key];
  if (next === undefined) return; event.preventDefault(); tiles[next].focus();
});
window.addEventListener('keydown', event => {
  if (dialogOpen() || event.altKey) return;
  if (event.code === 'Escape' && $('#tools-menu').open) {
    event.preventDefault(); $('#tools-menu').open = false;
    document.querySelector('#tools-menu > summary').focus({ preventScroll: true }); return;
  }
  const code = event.code;
  if (!['KeyM', 'KeyP', 'Escape', 'KeyZ', 'KeyY'].includes(code)) return;
  event.preventDefault(); if (event.repeat) return;
  if (code === 'KeyM') $('#sound').click();
  else if (code === 'KeyZ' || code === 'KeyY') changeHistory(code === 'KeyY' || event.shiftKey);
  else state === 'paused' || state === 'title' ? start() : pause();
});
document.addEventListener('click', event => {
  const tools = $('#tools-menu');
  if (tools.open && !tools.contains(event.target)) tools.open = false;
});
setSound(); newPuzzle(true);
if (launchShare.present && !launchShare.challenge) showShareError();
const dailyClock = watchKstDay(() => {
  if (sessions.daily?.seed !== `daily:${kstDate()}`) { delete sessions.daily; writeJSON(SESSION_KEY, sessions); }
  refreshDailyPuzzle(); renderStats();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) { persistSession(); pause(); } else dailyClock.check(); });
window.addEventListener('focus', dailyClock.check);
window.addEventListener('pagehide', persistSession);
if (import.meta.env.DEV) window.__game = {
  get puzzle() { return puzzle; }, get masks() { return masks; }, get state() { return state; },
  get moves() { return session.moves; }, start, turnTile, newPuzzle,
};
