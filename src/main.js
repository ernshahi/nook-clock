// Uses the global Tauri API (withGlobalTauri: true), so no bundler is needed.
const tauriWin = window.__TAURI__ ? window.__TAURI__.window.getCurrentWindow() : null;
const $ = (id) => document.getElementById(id);
const p2 = (n) => String(n).padStart(2, '0');

/* ---------- Tabs ---------- */
let activeTab = localStorage.getItem('tab') || 'stopwatch';
function showTab(tab) {
  activeTab = tab;
  localStorage.setItem('tab', tab);
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $('view-stopwatch').classList.toggle('hidden', tab !== 'stopwatch');
  $('view-timers').classList.toggle('hidden', tab !== 'timers');
}
document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

/* ---------- Stopwatch ---------- */
const display = $('display'), startBtn = $('start'), lapBtn = $('lap'), lapList = $('lapList');
let running = false, startAt = 0, elapsed = 0, lastLapTotal = 0, laps = [], raf = 0;

function format(ms) {
  const cs = Math.floor(ms / 10) % 100;
  const totalSec = Math.floor(ms / 1000);
  const sec = totalSec % 60, min = Math.floor(totalSec / 60) % 60, hr = Math.floor(totalSec / 3600);
  return (hr ? `${hr}:${p2(min)}` : p2(min)) + `:${p2(sec)}.${p2(cs)}`;
}
const swNow = () => running ? elapsed + (performance.now() - startAt) : elapsed;
function swRender() { display.textContent = format(swNow()); if (running) raf = requestAnimationFrame(swRender); }
function renderLaps() {
  lapList.innerHTML = '';
  const splits = laps.map(l => l.split);
  const best = splits.length > 1 ? Math.min(...splits) : null;
  const worst = splits.length > 1 ? Math.max(...splits) : null;
  laps.slice().reverse().forEach((l, i) => {
    const li = document.createElement('li');
    if (l.split === best) li.className = 'best'; else if (l.split === worst) li.className = 'worst';
    li.innerHTML = `<span>Lap ${laps.length - i}</span><span>${format(l.split)}</span><span>${format(l.total)}</span>`;
    lapList.appendChild(li);
  });
}
function swButtons() {
  startBtn.textContent = running ? 'Stop' : 'Start';
  startBtn.classList.toggle('running', running);
  if (running) { lapBtn.textContent = 'Lap'; lapBtn.disabled = false; }
  else if (elapsed > 0) { lapBtn.textContent = 'Reset'; lapBtn.disabled = false; }
  else { lapBtn.textContent = 'Lap'; lapBtn.disabled = true; }
}
function swToggle() {
  if (!running) { startAt = performance.now(); running = true; swRender(); }
  else { elapsed += performance.now() - startAt; running = false; cancelAnimationFrame(raf); swRender(); }
  swButtons();
}
function swLapOrReset() {
  if (running) { const total = swNow(); laps.push({ split: total - lastLapTotal, total }); lastLapTotal = total; renderLaps(); }
  else { elapsed = 0; lastLapTotal = 0; laps = []; renderLaps(); swRender(); }
  swButtons();
}
startBtn.addEventListener('click', swToggle);
lapBtn.addEventListener('click', swLapOrReset);

/* ---------- Timer ---------- */
const inH = $('inH'), inM = $('inM'), inS = $('inS');
const tStart = $('tStart'), tCancel = $('tCancel');
const ringFg = $('ringFg'), CIRC = 2 * Math.PI * 90;
ringFg.style.strokeDasharray = CIRC;
// state: 'idle' | 'running' | 'paused'
let tState = 'idle', tTotal = 0, tEndAt = 0, tRemaining = 0, tTick = 0, tLabel = '', lastDuration = 0;

function clampField(el) {
  const max = Number(el.dataset.max); let v = Math.floor(Number(el.value.replace(/\D/g, '')) || 0);
  if (v < 0) v = 0; if (v > max) v = max; el.value = p2(v);
}
function bump(el, d) {
  const max = Number(el.dataset.max) + 1;
  el.value = p2(((Number(el.value) || 0) + d + max) % max);
  updateTimerButtons();
}
[inH, inM, inS].forEach(el => {
  el.addEventListener('change', () => { clampField(el); updateTimerButtons(); });
  el.addEventListener('input', updateTimerButtons);
  el.addEventListener('focus', () => el.select());
  el.addEventListener('blur', () => clampField(el));
  el.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); bump(el, 1); el.select(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); bump(el, -1); el.select(); }
  });
  el.addEventListener('wheel', (e) => { e.preventDefault(); bump(el, e.deltaY < 0 ? 1 : -1); }, { passive: false });
});
document.querySelectorAll('.step').forEach(b => b.addEventListener('click', () => {
  bump({ h: inH, m: inM, s: inS }[b.dataset.f], Number(b.dataset.d));
}));
function setFromSeconds(sec) {
  inH.value = p2(Math.floor(sec / 3600)); inM.value = p2(Math.floor(sec / 60) % 60); inS.value = p2(sec % 60);
  updateTimerButtons();
}
document.querySelectorAll('#presets button').forEach(b => b.addEventListener('click', () => {
  setFromSeconds(Number(b.dataset.sec));
}));
const setupSeconds = () => (Number(inH.value) || 0) * 3600 + (Number(inM.value) || 0) * 60 + (Number(inS.value) || 0);

function fmtRemain(ms) {
  const t = Math.ceil(ms / 1000);
  const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60;
  return h ? `${h}:${p2(m)}:${p2(s)}` : `${p2(m)}:${p2(s)}`;
}
function fmtClock(date) { return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }

function timerRender() {
  const remain = tState === 'running' ? Math.max(0, tEndAt - Date.now()) : tRemaining;
  $('runTime').textContent = fmtRemain(remain);
  ringFg.style.strokeDashoffset = CIRC * (1 - remain / tTotal);
  if (tState === 'running') {
    $('runEnd').textContent = '🔔 ' + fmtClock(new Date(tEndAt));
    document.title = fmtRemain(remain) + ' · Timer';
    if (remain <= 0) timerFinish();
  } else if (tState === 'paused') {
    $('runEnd').textContent = 'Paused';
  }
}
function updateTimerButtons() {
  const idle = tState === 'idle';
  $('timerSetup').classList.toggle('hidden', !idle);
  $('timerRun').classList.toggle('hidden', idle);
  tCancel.disabled = idle;
  tStart.classList.remove('running', 'paused');
  if (idle) { tStart.textContent = 'Start'; tStart.disabled = setupSeconds() <= 0; }
  else if (tState === 'running') { tStart.textContent = 'Pause'; tStart.classList.add('paused'); tStart.disabled = false; }
  else { tStart.textContent = 'Resume'; tStart.disabled = false; }
}
function timerStartFresh(sec) {
  tTotal = sec * 1000; lastDuration = sec;
  tLabel = $('timerLabel').value.trim() || 'Timer';
  $('runLabel').textContent = tLabel;
  tEndAt = Date.now() + tTotal; tState = 'running';
  clearInterval(tTick); tTick = setInterval(timerRender, 100);
  timerRender(); updateTimerButtons();
}
function timerPrimary() {
  if (tState === 'idle') { const s = setupSeconds(); if (s > 0) timerStartFresh(s); }
  else if (tState === 'running') { tRemaining = Math.max(0, tEndAt - Date.now()); tState = 'paused'; clearInterval(tTick); timerRender(); updateTimerButtons(); }
  else { tEndAt = Date.now() + tRemaining; tState = 'running'; tTick = setInterval(timerRender, 100); timerRender(); updateTimerButtons(); }
}
function timerCancel() {
  clearInterval(tTick); tState = 'idle'; document.title = 'Timer'; updateTimerButtons();
}
tStart.addEventListener('click', timerPrimary);
tCancel.addEventListener('click', timerCancel);

/* ---------- Alarm ---------- */
let audioCtx = null, alarmLoop = 0;
function beep() {
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  const t0 = audioCtx.currentTime;
  [0, 0.18, 0.36].forEach((off) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, t0 + off);
    g.gain.exponentialRampToValueAtTime(0.35, t0 + off + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + 0.15);
    o.connect(g).connect(audioCtx.destination);
    o.start(t0 + off); o.stop(t0 + off + 0.16);
  });
}
async function timerFinish() {
  clearInterval(tTick); tState = 'idle'; document.title = 'Timer';
  updateTimerButtons();
  $('doneTitle').textContent = tLabel;
  $('done').classList.remove('hidden');
  beep(); clearInterval(alarmLoop); alarmLoop = setInterval(beep, 1200);
  if (tauriWin) {
    try { await tauriWin.unminimize(); await tauriWin.show(); await tauriWin.setFocus(); } catch (e) { console.warn(e); }
    try { await tauriWin.requestUserAttention(1); } catch (e) {}
  }
}
function stopAlarm() { clearInterval(alarmLoop); $('done').classList.add('hidden'); }
$('doneStop').addEventListener('click', stopAlarm);
$('doneRepeat').addEventListener('click', () => { stopAlarm(); showTab('timers'); timerStartFresh(lastDuration); });

/* ---------- Keyboard ---------- */
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') { if (e.key === 'Enter' && activeTab === 'timers') { e.target.blur(); timerPrimary(); } return; }
  if (!$('done').classList.contains('hidden')) { if (e.key === 'Enter' || e.key === 'Escape' || e.code === 'Space') { e.preventDefault(); stopAlarm(); } return; }
  if (e.metaKey && e.key === '1') { showTab('stopwatch'); return; }
  if (e.metaKey && e.key === '2') { showTab('timers'); return; }
  if (activeTab === 'stopwatch') {
    if (e.code === 'Space') { e.preventDefault(); swToggle(); }
    else if (e.key === 'l' || e.key === 'L') { if (running) swLapOrReset(); }
    else if (e.key === 'r' || e.key === 'R') { if (!running) swLapOrReset(); }
  } else {
    if (e.code === 'Space') { e.preventDefault(); timerPrimary(); }
    else if (e.key === 'Escape') { if (tState !== 'idle') timerCancel(); }
  }
});

/* ---------- Window buttons ---------- */
$('close').addEventListener('click', () => tauriWin && tauriWin.close());
$('minimize').addEventListener('click', () => tauriWin && tauriWin.minimize());
$('maximize').addEventListener('click', () => tauriWin && tauriWin.toggleMaximize());

showTab(activeTab);
swButtons(); swRender(); updateTimerButtons();
