// 어림짐작 화면. 계산은 core.js, 문제는 bank.js
import { $, share, toast, renderMoreSites, prefersReducedMotion, ROOT_URL, countUp, haptic } from "../shared/kit.js";
import { msToNextPuzzle, fmtCountdown } from "../ddanjit/core.js";
import { BANK } from "./bank.js";
import { N, DATE, DAY, store, pickSet, toT, fromT, snap, potential, score, isHit, readout, shareText, fmtVal, loadDay, saveDay, recordDay, streak } from "./core.js";

const RM = prefersReducedMotion();
const WD = ["일", "월", "화", "수", "목", "금", "토"];
const md = (key) => { const [y, m, d] = key.split("-").map(Number); return `${String(m).padStart(2, "0")}.${String(d).padStart(2, "0")} (${WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`; };
const dateOfDay = (d) => { const [y, m, dd] = DATE.split("-").map(Number); return new Date(Date.UTC(y, m - 1, dd) - (DAY - d) * 86400000).toISOString().slice(0, 10); };

/* ---------- 판(오늘 / 연습) ---------- */
let G = null; // { day, practice, set, st }
function startRound(practice) {
  let day = DAY, st;
  if (practice) {
    const cur = store.get("x:cur", null);
    if (cur && !cur.st.done) { day = cur.day; st = cur.st; }
    else {
      const used = new Set(store.get("x:used", []));
      const pool = []; for (let d = 1; d < DAY; d++) if (!used.has(d)) pool.push(d);
      if (!pool.length) { store.set("x:used", []); for (let d = 1; d < DAY; d++) pool.push(d); }
      day = pool[Math.floor(Math.random() * pool.length)] || 1;
      used.add(day); store.set("x:used", [...used]);
      st = { i: 0, bets: [], done: false };
    }
  } else st = loadDay() || { i: 0, bets: [], done: false };
  G = { day, practice, set: pickSet(day), st };
}
const save = () => (G.practice ? store.set("x:cur", { day: G.day, st: G.st }) : saveDay(G.st));

function show(view) {
  for (const id of ["intro", "play", "res"]) $("#" + id).hidden = id !== view;
  scrollTo({ top: 0, behavior: RM ? "auto" : "smooth" });
}

/* ---------- 자(캘리퍼스) ---------- */
let Q = null, A = 0, B = 1, locked = false;
const PAD = 18; // 자 양끝 여백(px). 날의 가운데가 눈금 위치

function niceTicks(q) {
  const out = [];
  if (q.scale === "log") {
    for (let e = Math.floor(Math.log10(q.lo)); e <= Math.ceil(Math.log10(q.hi)); e++)
      for (const m of [1, 2, 5]) { const v = m * 10 ** e; if (v >= q.lo && v <= q.hi) out.push({ v, major: m === 1 }); }
    return out;
  }
  const span = q.hi - q.lo, raw = span / 6, p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw);
  for (let v = Math.ceil(q.lo / step) * step; v <= q.hi + 1e-9; v += step) out.push({ v: Number(v.toFixed(6)), major: true });
  const minor = step / 5;
  for (let v = Math.ceil(q.lo / minor) * minor; v <= q.hi + 1e-9; v += minor) if (!out.some((t) => Math.abs(t.v - v) < 1e-9)) out.push({ v, major: false });
  return out;
}
const short = (q, v) => (q.unit === "년" ? String(v) : v >= 10000 ? (v >= 1e8 ? `${v / 1e8}억` : `${(v / 1e4).toLocaleString("ko-KR")}만`) : v.toLocaleString("ko-KR"));

function drawTicks() {
  $("#ticks").innerHTML = niceTicks(Q)
    .map((t) => `<i class="${t.major ? "mj" : ""}" style="--t:${toT(Q, t.v)}">${t.major ? `<b>${short(Q, t.v)}</b>` : ""}</i>`)
    .join("");
}
function place() {
  const ta = toT(Q, A), tb = toT(Q, B);
  const cal = $("#cal");
  cal.style.setProperty("--a", ta);
  cal.style.setProperty("--b", tb);
  for (const [el, v, lbl] of [[$("#jawA"), A, "범위 시작"], [$("#jawB"), B, "범위 끝"]]) {
    el.setAttribute("aria-valuenow", v);
    el.setAttribute("aria-valuetext", `${lbl} ${fmtVal(Q, v)}${Q.unit}`);
  }
  if (document.activeElement !== $("#inA")) $("#inA").value = fmtVal(Q, A);
  if (document.activeElement !== $("#inB")) $("#inB").value = fmtVal(Q, B);
  const p = potential(Q, A, B);
  const pv = $("#potVal");
  if (pv.textContent !== `+${p}`) { pv.textContent = `+${p}`; pv.classList.remove("is-tick"); void pv.offsetWidth; pv.classList.add("is-tick"); }
  $("#potBar").style.width = `${p}%`;
  $("#pot").dataset.hot = p >= 70 ? "2" : p >= 40 ? "1" : "0";
}
function setAB(a, b) { A = Math.min(a, b); B = Math.max(a, b); place(); }

function tAt(clientX) {
  const r = $("#beam").getBoundingClientRect();
  return (clientX - r.left - PAD) / (r.width - PAD * 2);
}
function bindCaliper() {
  const cal = $("#cal");
  let drag = null; // { kind:'a'|'b'|'span', t0, a0, b0 }
  const down = (kind) => (e) => {
    if (locked) return;
    e.preventDefault();
    drag = { kind, t0: tAt(e.clientX), a0: toT(Q, A), b0: toT(Q, B) };
    cal.classList.add("is-drag");
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    if (!drag) return;
    const t = tAt(e.clientX);
    if (drag.kind === "a") setAB(fromT(Q, Math.min(t, toT(Q, B))), B);
    else if (drag.kind === "b") setAB(A, fromT(Q, Math.max(t, toT(Q, A))));
    else {
      const w = drag.b0 - drag.a0, d = Math.min(1 - drag.b0, Math.max(-drag.a0, t - drag.t0));
      setAB(fromT(Q, drag.a0 + d), fromT(Q, drag.a0 + d + w));
    }
  };
  const up = () => { if (drag) { drag = null; cal.classList.remove("is-drag"); haptic?.(8); } };
  $("#jawA").addEventListener("pointerdown", down("a"));
  $("#jawB").addEventListener("pointerdown", down("b"));
  $("#span").addEventListener("pointerdown", down("span"));
  // 자 아무 데나 누르면 가까운 날이 그리로
  $("#beam").addEventListener("pointerdown", (e) => {
    if (locked) return;
    const t = tAt(e.clientX), ta = toT(Q, A), tb = toT(Q, B);
    const kind = Math.abs(t - ta) <= Math.abs(t - tb) ? "a" : "b";
    if (kind === "a") setAB(fromT(Q, Math.min(t, tb)), B); else setAB(A, fromT(Q, Math.max(t, ta)));
    down(kind)(e);
  });
  addEventListener("pointermove", move);
  addEventListener("pointerup", up);
  addEventListener("pointercancel", up);
  // 방향키: 한 칸(눈금 1%), Shift 는 10칸
  for (const [id, which] of [["#jawA", "a"], ["#jawB", "b"]]) {
    $(id).addEventListener("keydown", (e) => {
      if (locked) return;
      const dir = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
      if (!dir) return;
      e.preventDefault();
      const dt = dir * (e.shiftKey ? 0.1 : 0.01);
      if (which === "a") setAB(fromT(Q, Math.min(toT(Q, A) + dt, toT(Q, B))), B);
      else setAB(A, fromT(Q, Math.max(toT(Q, B) + dt, toT(Q, A))));
    });
  }
  const typed = (which) => (e) => {
    const v = Number(String(e.target.value).replace(/[^\d.\-]/g, ""));
    if (!Number.isFinite(v) || e.target.value.trim() === "") return;
    const c = Math.min(Q.hi, Math.max(Q.lo, v));
    const s = Q.step || 1, val = Number((Math.round(c / s) * s).toFixed(6)); // 손으로 친 값은 세 자리로 줄이지 않음
    if (which === "a") setAB(Math.min(val, B), B); else setAB(A, Math.max(val, A));
  };
  $("#inA").addEventListener("input", typed("a"));
  $("#inB").addEventListener("input", typed("b"));
  for (const id of ["#inA", "#inB"]) $(id).addEventListener("blur", place);
}

/* ---------- 한 문제 ---------- */
function renderQ() {
  const { set, st } = G;
  Q = set[st.i];
  locked = false;
  $("#qNo").textContent = `${st.i + 1} / ${N}`;
  $("#qCat").textContent = G.practice ? `연습 · 제 ${G.day}회` : Q.cat;
  $("#dots").innerHTML = set.map((_, k) => `<i class="${k < st.i ? (st.bets[k] && isHit(set[k], st.bets[k].a, st.bets[k].b) ? "ok" : "no") : k === st.i ? "now" : ""}"></i>`).join("");
  $("#q").textContent = Q.q;
  $("#unit").textContent = Q.unit;
  $("#needle").hidden = true;
  $("#stamp").hidden = true;
  $("#fact").hidden = true;
  $("#bet").hidden = false;
  $("#nextQ").hidden = true;
  $("#cal").classList.remove("is-hit", "is-miss", "is-locked");
  $("#play").classList.remove("is-revealed");
  drawTicks();
  // 처음엔 자 전체를 집은 상태(가장 안전, 10점)에서 시작
  setAB(Q.lo, Q.hi);
  $("#q").classList.remove("is-in"); void $("#q").offsetWidth; $("#q").classList.add("is-in");
}

function bet() {
  if (locked) return;
  locked = true;
  const { st } = G;
  st.bets[st.i] = { a: A, b: B };
  save();
  reveal(st.bets[st.i]);
}
function reveal({ a, b }) {
  const hit = isHit(Q, a, b), pts = score(Q, a, b);
  const cal = $("#cal");
  cal.classList.add("is-locked");
  const nd = $("#needle");
  const tAns = toT(Q, Q.ans);
  cal.style.setProperty("--n", Math.min(1, Math.max(0, tAns)));
  $("#needleVal").textContent = `${fmtVal(Q, Q.ans)}${Q.unit}`;
  nd.hidden = false;
  nd.classList.remove("is-drop"); void nd.offsetWidth; nd.classList.add("is-drop");
  $("#bet").hidden = true;
  const after = () => {
    cal.classList.add(hit ? "is-hit" : "is-miss");
    $("#play").classList.add("is-revealed");
    const s = $("#stamp");
    s.className = `ec-stamp ${hit ? "is-hit" : "is-miss"}`;
    s.innerHTML = hit ? `<span>적중</span><b>+<em id="ptsNum">0</em></b>` : `<span>빗나감</span><b>0</b>`;
    s.hidden = false;
    if (hit) { const el = $("#ptsNum"); if (RM || !countUp) el.textContent = pts; else countUp(el, pts, { duration: 600 }); haptic?.([10, 40, 20]); }
    else haptic?.(30);
    const off = hit ? "" : ` · 정답은 ${fmtVal(Q, Q.ans)}${Q.unit}`;
    $("#fact").textContent = `내 범위 ${fmtVal(Q, a)}~${fmtVal(Q, b)}${Q.unit}${off}${Q.note ? ` · 기준: ${Q.note}` : ""}`;
    $("#fact").hidden = false;
    $("#nextLabel").textContent = G.st.i + 1 >= N ? "결과 보기" : "다음 문제";
    $("#nextQ").hidden = false;
    $("#nextQ").focus({ preventScroll: true });
  };
  if (RM) after(); else setTimeout(after, 720);
}
function nextQ() {
  const { st } = G;
  st.i += 1;
  if (st.i >= N) { st.done = true; save(); if (!G.practice) recordDay(readout(G.set, st.bets).total); if (G.practice) store.set("x:cur", null); renderRes(); return; }
  save();
  renderQ();
}

/* ---------- 결과 ---------- */
function renderRes() {
  const rd = readout(G.set, G.st.bets);
  $("#resNo").textContent = G.practice ? `연습 판 · 제 ${G.day}회` : `제 ${G.day}회`;
  $("#resDate").textContent = md(G.practice ? dateOfDay(G.day) : DATE);
  $("#line").textContent = rd.line;
  $("#rows").innerHTML = G.set.map((q, k) => {
    const { a, b } = G.st.bets[k], r = rd.rows[k];
    const ta = toT(q, a), tb = toT(q, b), tn = Math.min(1, Math.max(0, toT(q, q.ans)));
    return `<li class="ecr ${r.hit ? "is-hit" : "is-miss"}" style="--i:${k};--a:${ta};--b:${tb};--n:${tn}">
      <div class="ecr__top"><span class="ecr__q">${q.q}</span><b class="ecr__pts">${r.pts ? "+" + r.pts : "0"}</b></div>
      <div class="ecr__rule" aria-hidden="true"><i class="ecr__span"></i><i class="ecr__ans"></i></div>
      <div class="ecr__val"><span>내 범위 ${fmtVal(q, a)}~${fmtVal(q, b)}${q.unit}</span><span>정답 ${fmtVal(q, q.ans)}${q.unit}</span></div>
    </li>`;
  }).join("");
  $("#shareText").textContent = shareText(G.day, rd, G.practice);
  const tot = $("#total");
  if (RM || !countUp) tot.textContent = rd.total; else { tot.textContent = "0"; countUp(tot, rd.total, { duration: 900 }); }
  streakLines();
  show("res");
}
function streakLines() {
  const s = streak();
  const t = s.total ? ` · 연속 ${s.streak}일 · 최고 ${s.best}점` : "";
  $("#streakLine").textContent = t;
  $("#streakLine2").textContent = t;
}

/* ---------- 시작 ---------- */
function intro() {
  $("#introNo").textContent = `제 ${DAY}회`;
  $("#introDate").textContent = md(DATE);
  const st = loadDay();
  $("#startLabel").textContent = st?.done ? "오늘 결과 보기" : st?.bets?.length ? `이어서 재기 (${st.bets.length}/${N})` : "오늘의 5문제 재기";
  streakLines();
}
function tick() { const t = fmtCountdown(msToNextPuzzle()); $("#next").textContent = t; $("#next2").textContent = t; }

function init() {
  if (RM) document.documentElement.classList.add("rm");
  intro();
  tick(); setInterval(tick, 1000);
  bindCaliper();
  $("#start").addEventListener("click", () => {
    startRound(false);
    if (G.st.done) { renderRes(); return; }
    show("play"); renderQ();
  });
  $("#bet").addEventListener("click", bet);
  $("#nextQ").addEventListener("click", nextQ);
  $("#practice").addEventListener("click", () => {
    if (DAY <= 1) { toast("아직 지난 문제가 없어요"); return; }
    startRound(true); show("play"); renderQ();
  });
  $("#shareBtn").addEventListener("click", async () => {
    const r = await share({ title: "어림짐작", text: $("#shareText").textContent, url: `${ROOT_URL}eorim/` });
    if (r === "shared") toast("보냈어요");
  });
  renderMoreSites($("#more"), "eorim");
}

if (typeof document !== "undefined" && document.getElementById("cal")) init();
export { BANK };
