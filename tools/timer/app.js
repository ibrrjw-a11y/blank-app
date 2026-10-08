// 타이머·뽀모도로·스톱워치(2026-10-08)
// 정확도 원칙: 남은/지난 시간은 언제나 '시작 시각(또는 끝 시각)과 지금 시각(Date.now())의 차이'로 계산한다.
// setTimeout·setInterval·requestAnimationFrame 은 화면을 다시 그리는 신호일 뿐, 횟수를 더해 시간을 세지 않는다(백그라운드에서 늦어져도 안 밀림).
import { $, $$, renderMoreSites } from "../../shared/kit.js";

const now = () => Date.now();
const pad = (n) => String(n).padStart(2, "0");
// 남은 시간 표시: 초 올림(시작 직후 5:00, 끝나는 순간 0:00)
export function fmtDown(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}
// 지난 시간 표시: 1/100초 내림
export function fmtUp(ms) {
  const cs = Math.floor(Math.max(0, ms) / 10), s = Math.floor(cs / 100), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return `${h ? `${h}:${pad(m)}` : pad(m)}:${pad(s % 60)}.${pad(cs % 100)}`;
}
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 저장 안 돼도 동작 */ } },
};
const todayStr = () => { const d = new Date(now()); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

// ---------- 상태 ----------
let mode = "timer";
const T = { dur: 5 * 60000, remain: 5 * 60000, endAt: 0, running: false };
const P = { phase: "work", remain: 25 * 60000, endAt: 0, running: false, done: 0 };
const S = { acc: 0, startAt: 0, running: false, laps: [] };
const PLEN = () => ({ work: clampMin("#pWork", 25, 180), short: clampMin("#pShort", 5, 60), long: clampMin("#pLong", 15, 120) });
function clampMin(sel, d, max) { const v = Math.round(Number($(sel).value)); return (v >= 1 && v <= max ? v : d) * 60000; }
const PNAME = { work: "집중", short: "짧은 휴식", long: "긴 휴식" };

// ---------- 알림(소리·진동·번쩍) ----------
let actx = null, beepTimer = 0, beepStop = 0;
function audio() {
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); } catch { actx = null; }
  return actx;
}
function beepOnce() {
  const a = audio(); if (!a) return;
  [0, 0.18, 0.36].forEach((t) => {
    const o = a.createOscillator(), g = a.createGain();
    o.type = "sine"; o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, a.currentTime + t);
    g.gain.exponentialRampToValueAtTime(0.35, a.currentTime + t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + t + 0.14);
    o.connect(g).connect(a.destination); o.start(a.currentTime + t); o.stop(a.currentTime + t + 0.16);
  });
}
function alarm(msg) {
  $("#alarmMsg").textContent = msg;
  $("#alarm").hidden = false;
  $("#stage").dataset.alarm = "on";
  document.body.classList.add("tm-flash");
  try { navigator.vibrate?.([300, 150, 300, 150, 600]); } catch { /* 진동 없는 기기 */ }
  clearInterval(beepTimer);
  if (!$("#mute").checked) {
    beepOnce();
    beepStop = now() + 30000; // 30초 동안 1.2초마다, 알림 끄기를 누르면 멈춤
    beepTimer = setInterval(() => { if (now() > beepStop || $("#mute").checked) clearInterval(beepTimer); else beepOnce(); }, 1200);
  }
}
function alarmOff() {
  clearInterval(beepTimer);
  $("#alarm").hidden = true; delete $("#stage").dataset.alarm;
  document.body.classList.remove("tm-flash");
  try { navigator.vibrate?.(0); } catch { /* 무시 */ }
}

// ---------- 화면 꺼짐 방지 ----------
let lock = null;
const anyRunning = () => T.running || P.running || S.running;
async function wake() {
  const el = $("#wake");
  if (!("wakeLock" in navigator)) { el.textContent = "화면 꺼짐 방지: 이 브라우저는 지원하지 않아요"; el.dataset.state = "no"; return; }
  if (anyRunning() && !lock && document.visibilityState === "visible") {
    try { lock = await navigator.wakeLock.request("screen"); lock.addEventListener("release", () => { lock = null; syncWake(); }); } catch { lock = null; }
  } else if (!anyRunning() && lock) { try { await lock.release(); } catch { /* 무시 */ } lock = null; }
  syncWake();
}
function syncWake() {
  const el = $("#wake");
  if (!("wakeLock" in navigator)) return;
  el.textContent = lock ? "화면 꺼짐 방지: 켜짐" : anyRunning() ? "화면 꺼짐 방지: 켜지 못했어요(배터리 절약 모드 등)" : "화면 꺼짐 방지: 시작하면 켜져요";
  el.dataset.state = lock ? "on" : "off";
}

// ---------- 시간 진행(모두 시각 차이로) ----------
let endTimer = 0, rafId = 0;
// 다음에 다시 그릴 때를 정함: 남은 시간 숫자가 바뀌는 다음 1초 경계(또는 끝 시각)에 맞춰 한 번. 스톱워치를 보고 있을 땐 매 프레임
function scheduleEnd() {
  clearTimeout(endTimer);
  const t = now(), waits = [];
  // 남은 시간 R 의 표시(초 올림)는 R 이 1000 의 배수가 되는 순간 바뀜 → 그때까지 ((R-1) % 1000) + 1 ms
  const until = (end) => { const r = end - t; return r <= 0 ? 0 : ((r - 1) % 1000) + 1; };
  if (T.running) waits.push(until(T.endAt));
  if (P.running) waits.push(until(P.endAt));
  if (waits.length) endTimer = setTimeout(tick, Math.min(...waits));
  if (S.running && mode === "watch" && document.visibilityState !== "hidden" && !rafId) rafId = requestAnimationFrame(frame);
}
function frame() { rafId = 0; tick(); }
function tick() {
  const t = now();
  let fired = "";
  if (T.running && t >= T.endAt) { T.running = false; T.remain = 0; fired = "타이머 끝"; }
  if (P.running && t >= P.endAt) fired = pomoAdvance(t) || fired;
  if (fired) { alarm(fired); wake(); }
  render(t);
  scheduleEnd();
}
// 집중 한 번 마침: 이번 묶음 횟수 + 오늘 횟수(이 기기에만, 날짜 바뀌면 0부터)
let dayRec = null; // 매 프레임 저장소를 읽지 않게 한 번 읽어 둠
const todayCount = () => { dayRec = dayRec || store.get("gw-timer-pomo-day", {}); return dayRec.d === todayStr() ? dayRec.n : 0; };
function countWork() {
  P.done++;
  dayRec = { d: todayStr(), n: todayCount() + 1 };
  store.set("gw-timer-pomo-day", dayRec);
}
// 끝 시각을 지나 있으면 단계를 차례로 넘김(백그라운드에 오래 있었으면 여러 단계를 한 번에). 다음 단계는 '앞 단계 끝 시각'부터 셈
function pomoAdvance(t) {
  let msg = "";
  while (P.running && t >= P.endAt) {
    const endedAt = P.endAt, was = P.phase;
    if (was === "work") countWork();
    P.phase = was === "work" ? (P.done % 4 === 0 ? "long" : "short") : "work";
    const len = PLEN()[P.phase];
    msg = was === "work" ? `집중 끝 · ${PNAME[P.phase]} 시작` : "휴식 끝 · 다시 집중";
    if ($("#pAuto").checked) P.endAt = endedAt + len;
    else { P.running = false; P.remain = len; msg = was === "work" ? `집중 끝 · 이제 ${PNAME[P.phase]}` : "휴식 끝 · 이제 집중"; }
  }
  return msg;
}

// ---------- 그리기 ----------
const BASE_TITLE = document.title;
// 바뀐 것만 고쳐 씀(매 프레임 화면을 통째로 다시 쓰지 않게)
// 글자 마디(text node)만 고쳐서, 사이트 공용 스크립트(ux.js)의 '새 요소 나타남' 감시가 매초 깨어나지 않게 함
const put = (sel, v) => {
  const e = $(sel), n = e.firstChild; v = String(v);
  if (n && n.nodeType === 3 && !n.nextSibling) { if (n.data !== v) n.data = v; }
  else if (e.textContent !== v) e.textContent = v;
};
const bar = (sel, r) => { const e = $(sel), v = `scaleX(${Math.max(0, Math.min(1, r)).toFixed(3)})`; if (e.style.transform !== v) e.style.transform = v; };
function render(t = now()) {
  // 타이머
  const tr = T.running ? T.endAt - t : T.remain;
  put("#tDisp", fmtDown(tr));
  bar("#tBar", T.dur ? tr / T.dur : 0);
  put("#tStart", T.running ? "멈춤" : T.remain < T.dur && T.remain > 0 ? "계속" : "시작");
  if ($("#tSet").classList.contains("tm-locked") !== T.running) $("#tSet").classList.toggle("tm-locked", T.running);
  put("#tLabel", T.running ? "남은 시간" : T.remain === 0 ? "끝" : T.remain < T.dur ? "멈춤" : "남은 시간");
  // 뽀모도로
  const pr = P.running ? P.endAt - t : P.remain, plen = PLEN()[P.phase];
  put("#pDisp", fmtDown(pr));
  bar("#pBar", pr / plen);
  put("#pPhase", PNAME[P.phase]); if ($("#pPhase").dataset.phase !== P.phase) $("#pPhase").dataset.phase = P.phase;
  const pos = P.done % 4, filled = P.phase === "long" ? 4 : pos;
  put("#pRound", P.phase === "work" ? `${pos + 1}번째` : P.phase === "long" ? "4번 마침" : `${pos}번 마침`);
  $$("#pDots li").forEach((li, i) => { if (li.classList.contains("on") !== i < filled) li.classList.toggle("on", i < filled); });
  put("#pToday", todayCount());
  put("#pDone", P.done);
  put("#pStart", P.running ? "멈춤" : pr < plen ? "계속" : "시작");
  // 스톱워치
  const el = S.acc + (S.running ? t - S.startAt : 0);
  put("#sDisp", fmtUp(el));
  put("#sStart", S.running ? "멈춤" : el ? "계속" : "시작");
  put("#sLap", S.running ? "랩" : "처음으로");
  // 탭 제목
  const cur = mode === "timer" && T.running ? fmtDown(tr) : mode === "pomo" && P.running ? `${fmtDown(pr)} ${PNAME[P.phase]}` : mode === "watch" && S.running ? fmtUp(el).slice(0, -3) : "";
  const title = cur ? `${cur} · 타이머` : BASE_TITLE;
  if (document.title !== title) document.title = title;
}
function renderLaps() {
  $("#sLaps").innerHTML = S.laps.map((l, i) => `<li><span>랩 ${i + 1}</span><b>${fmtUp(l.split)}</b><small>${fmtUp(l.total)}</small></li>`).reverse().join("");
}

// ---------- 조작 ----------
function readTimerInput() {
  const m = Math.max(0, Math.min(999, Math.floor(Number($("#tMin").value) || 0))), s = Math.max(0, Math.min(59, Math.floor(Number($("#tSec").value) || 0)));
  return (m * 60 + s) * 1000;
}
function setTimer(ms) { T.dur = ms; T.remain = ms; T.running = false; }
function bind() {
  $(".tm-tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-mode]"); if (!b) return;
    mode = b.dataset.mode; $("#stage").dataset.mode = mode;
    $$(".tm-tabs button").forEach((x) => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-selected", String(on)); });
    $$(".tm-panel").forEach((p) => (p.hidden = p.dataset.panel !== mode));
    render(); scheduleEnd();
  });
  // 타이머
  ["#tMin", "#tSec"].forEach((s) => $(s).addEventListener("input", () => { if (!T.running) { setTimer(readTimerInput()); render(); } }));
  $("#tChips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-min]"); if (!b || T.running) return;
    $("#tMin").value = b.dataset.min; $("#tSec").value = 0; setTimer(Number(b.dataset.min) * 60000); render();
  });
  $("#tStart").addEventListener("click", () => {
    audio(); alarmOff();
    if (T.running) { T.remain = Math.max(0, T.endAt - now()); T.running = false; }
    else {
      if (T.remain <= 0) setTimer(readTimerInput());
      if (T.remain <= 0) { $("#tMin").focus(); return; }
      T.endAt = now() + T.remain; T.running = true;
    }
    scheduleEnd(); wake(); render();
  });
  $("#tReset").addEventListener("click", () => { alarmOff(); setTimer(readTimerInput()); scheduleEnd(); wake(); render(); });
  // 뽀모도로
  $("#pStart").addEventListener("click", () => {
    audio(); alarmOff();
    if (P.running) { P.remain = Math.max(0, P.endAt - now()); P.running = false; }
    else { P.endAt = now() + P.remain; P.running = true; }
    scheduleEnd(); wake(); render();
  });
  $("#pSkip").addEventListener("click", () => {
    alarmOff();
    const was = P.phase;
    if (was === "work") countWork();
    P.phase = was === "work" ? (P.done % 4 === 0 ? "long" : "short") : "work";
    const len = PLEN()[P.phase];
    if (P.running) P.endAt = now() + len; else P.remain = len;
    scheduleEnd(); render();
  });
  $("#pReset").addEventListener("click", () => { alarmOff(); Object.assign(P, { phase: "work", remain: PLEN().work, running: false, done: 0 }); scheduleEnd(); wake(); render(); });
  ["#pWork", "#pShort", "#pLong"].forEach((s) => $(s).addEventListener("change", () => {
    store.set("gw-timer-pomo-len", { w: $("#pWork").value, s: $("#pShort").value, l: $("#pLong").value });
    if (!P.running) { P.remain = PLEN()[P.phase]; render(); }
  }));
  // 스톱워치
  $("#sStart").addEventListener("click", () => {
    if (S.running) { S.acc += now() - S.startAt; S.running = false; } else { S.startAt = now(); S.running = true; }
    wake(); render(); scheduleEnd();
  });
  $("#sLap").addEventListener("click", () => {
    if (S.running) {
      const total = S.acc + now() - S.startAt, prev = S.laps.length ? S.laps[S.laps.length - 1].total : 0;
      S.laps.push({ total, split: total - prev });
    } else { S.acc = 0; S.laps = []; }
    renderLaps(); render();
  });
  // 공통
  $("#alarmOff").addEventListener("click", alarmOff);
  $("#mute").addEventListener("change", () => { store.set("gw-timer-mute", $("#mute").checked); if ($("#mute").checked) clearInterval(beepTimer); });
  $("#full").addEventListener("click", toggleFull);
  document.addEventListener("fullscreenchange", () => { $("#stage").classList.toggle("tm-full", !!document.fullscreenElement); $("#full").textContent = document.fullscreenElement ? "전체 화면 끝내기" : "전체 화면"; });
  document.addEventListener("visibilitychange", () => { tick(); wake(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#stage").classList.contains("tm-full") && !document.fullscreenElement) toggleFull(); });
}
function toggleFull() {
  const st = $("#stage");
  if (document.fullscreenElement) { document.exitFullscreen?.(); return; }
  if (st.requestFullscreen) { st.requestFullscreen().catch(() => fakeFull(st)); }
  else fakeFull(st);
}
// 전체 화면 기능이 없는 브라우저(아이폰 사파리 등)는 화면을 꽉 채우는 모양으로 대신
function fakeFull(st) { const on = !st.classList.contains("tm-full"); st.classList.toggle("tm-full", on); $("#full").textContent = on ? "전체 화면 끝내기" : "전체 화면"; }

function init() {
  const len = store.get("gw-timer-pomo-len", null);
  if (len) { $("#pWork").value = len.w; $("#pShort").value = len.s; $("#pLong").value = len.l; }
  $("#mute").checked = !!store.get("gw-timer-mute", false);
  P.remain = PLEN().work;
  setTimer(readTimerInput());
  bind(); renderLaps(); render(); syncWake();
  if (!("wakeLock" in navigator)) wake();
  setInterval(tick, 1000); // 안전망: 다시 그리는 신호일 뿐(시간 계산은 Date.now 차이)
  renderMoreSites($("#more"), "tools/timer");
}
init();
