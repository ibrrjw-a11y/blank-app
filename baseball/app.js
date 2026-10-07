// 숫자 야구 화면. 계산은 core.js
import { $, share, toast, renderMoreSites, prefersReducedMotion, ROOT_URL, getParam, haptic } from "../shared/kit.js";
import { DIG, INNINGS, DAY, makeSecret, dailySeed, randomSeed, validGuess, judge, encodeSecret, decodeSecret, loadGame, saveGame, throwBall, record, stats, shareText, store } from "./core.js";

const RM = prefersReducedMotion();
let G = null, kind = "", cur = [], mk = [];
let memo = store.get("memo", {}); // 경기마다 숫자 메모: { [key]: { d: 0|1|2 } } 1 아님 · 2 확실

function show(v) { for (const id of ["intro", "play", "end", "make"]) $("#" + id).hidden = id !== v; scrollTo({ top: 0 }); }
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/* ---------- 전광판 ---------- */
function lampsHTML(r) {
  return `<span class="lamp lamp--s"><em>S</em>${[0, 1, 2].map((k) => `<i class="${k < r.s ? "on" : ""}" style="--k:${k}"></i>`).join("")}</span>`
    + `<span class="lamp lamp--b"><em>B</em>${[0, 1, 2].map((k) => `<i class="${k < r.b ? "on" : ""}" style="--k:${k + r.s}"></i>`).join("")}</span>`
    + `<span class="lamp lamp--o"><em>O</em><i class="${r.out ? "on" : ""}" style="--k:0"></i></span>`;
}
function renderRows(fresh = false) {
  $("#rows").innerHTML = G.guesses.map((g, i) => {
    const r = judge(G.secret, g);
    const last = fresh && i === G.guesses.length - 1;
    return `<li class="inn${last ? " is-new" : ""}"><span class="inn__n">${i + 1}회</span><span class="inn__g">${g.join(" ")}</span><span class="inn__r">${lampsHTML(r)}</span><b class="inn__t">${r.out ? "OUT" : `${r.s}S ${r.b}B`}</b></li>`;
  }).join("");
  $("#inning").textContent = `${Math.min(INNINGS, G.guesses.length + 1)}회 / ${INNINGS}회`;
}
function renderNow() {
  for (let k = 0; k < DIG; k++) { const s = $(`#s${k}`); s.textContent = cur[k] ?? ""; s.classList.toggle("is-on", cur[k] != null); }
  $("#throw").disabled = cur.length !== DIG;
  document.querySelectorAll("#pad button").forEach((b) => (b.disabled = cur.includes(+b.dataset.d) || cur.length >= DIG));
}
function renderMemo() {
  const m = memo[G.key] || {};
  $("#memo").innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<button type="button" class="memo__d m${m[d] || 0}" data-d="${d}" aria-label="${d} 메모">${d}</button>`).join("");
}
function padHTML(id) { $(id).innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<button type="button" data-d="${d}">${d}</button>`).join(""); }

/* ---------- 경기 ---------- */
function start(key, secret, label) {
  kind = label;
  G = loadGame(key, secret);
  cur = [];
  $("#modeLabel").textContent = label;
  renderRows(); renderNow(); renderMemo();
  if (G.done) return finish(false);
  show("play");
}
function throwNow() {
  if (cur.length !== DIG) return;
  if (G.guesses.some((g) => g.join() === cur.join())) { err("이미 던진 숫자예요"); return; }
  const r = throwBall(G, cur.slice());
  if (!r) return;
  saveGame(G);
  cur = [];
  pitch(() => {
    renderRows(true); renderNow();
    haptic?.(r.s === DIG ? [20, 40, 20, 40, 30] : r.out ? 30 : 10);
    if (G.done) setTimeout(() => finish(true), RM ? 0 : 900);
  });
}
function pitch(then) {
  if (RM) return then();
  const ball = $("#ball"); ball.classList.remove("is-go"); void ball.offsetWidth; ball.classList.add("is-go");
  setTimeout(then, 420);
}
function err(t) { const e = $("#err"); e.textContent = t; e.hidden = false; setTimeout(() => (e.hidden = true), 1600); }

function finish(fresh) {
  record(G);
  $("#endMode").textContent = kind;
  $("#endInning").textContent = G.won ? `${G.guesses.length}회` : "9회 종료";
  const hr = $("#hr");
  hr.textContent = G.won ? (G.guesses.length === 1 ? "PERFECT GAME" : "HOME RUN") : "GAME OVER";
  hr.className = `hr ${G.won ? "is-win" : "is-lose"}${fresh && !RM ? " is-fresh" : ""}`;
  $("#ansDigits").innerHTML = G.secret.map((d, k) => `<b style="--k:${k}">${d}</b>`).join("");
  const st = stats();
  $("#endLine").textContent = `${G.won ? `${G.guesses.length}회 만에 맞혔어요.` : `정답은 ${G.secret.join(" ")}였어요.`} · 지금까지 ${st.played}경기 ${st.won}승`;
  $("#shareText").textContent = shareText(kind, G);
  show("end");
}

/* ---------- 출제(내 숫자 내기) ---------- */
function renderMake() {
  for (let k = 0; k < DIG; k++) { const s = $(`#m${k}`); s.textContent = mk[k] ?? ""; s.classList.toggle("is-on", mk[k] != null); }
  $("#mshare").disabled = mk.length !== DIG;
  document.querySelectorAll("#mpad button").forEach((b) => (b.disabled = mk.includes(+b.dataset.d) || mk.length >= DIG));
}
function openMake() { mk = []; $("#byName").value = store.get("name", ""); renderMake(); show("make"); }

/* ---------- 첫 화면 견본: 전광판 숫자가 돌다가 공이 날아오고 램프가 켜짐 ---------- */
function demo() {
  if (RM) return;
  const ds = [...$("#heroDigits").children];
  setInterval(() => ds.forEach((b, k) => setTimeout(() => { b.textContent = String(1 + Math.floor(Math.random() * 9)); b.classList.remove("is-flip"); void b.offsetWidth; b.classList.add("is-flip"); setTimeout(() => (b.textContent = "?"), 500); }, k * 120)), 2600);
}

let friend = null;
function init() {
  if (RM) document.documentElement.classList.add("rm");
  demo();
  padHTML("#pad"); padHTML("#mpad");
  $("#dailyNo").textContent = `#${DAY}`;
  const st = stats(), dg = store.get(`g:${dailySeed()}`, null);
  $("#rec").textContent = `${dg?.done ? (dg.won ? `오늘의 숫자 ${dg.guesses.length}회 만에 맞힘 · ` : "오늘의 숫자 못 맞힘 · ") : ""}${st.played}경기 ${st.won}승`;
  const n = getParam("n");
  if (n) {
    const sec = decodeSecret(n);
    const by = String(getParam("by") || "").slice(0, 10);
    if (sec) {
      friend = { code: n, sec, by };
      const c = $("#chal"); c.hidden = false;
      c.innerHTML = `<b>${esc(by ? `${by}의 숫자` : "친구가 낸 숫자")}</b><span>몇 회 만에 맞히는지 보여 줘요.</span><button class="bb-go" id="playFriend" type="button"><span class="bb-go__k">도전</span><span>친구 숫자 맞히기</span></button>`;
      $("#playFriend").addEventListener("click", () => start(`f${n}`, friend.sec, by ? `${by}의 숫자` : "친구 숫자"));
    } else toast("링크가 깨졌어요. 친구에게 다시 받아 보세요");
  }
  $("#playDaily").addEventListener("click", () => start(dailySeed(), makeSecret(dailySeed()), `오늘의 숫자 #${DAY}`));
  $("#playRandom").addEventListener("click", () => { const s = randomSeed(); start(s, makeSecret(s), "연습 경기"); });
  $("#again").addEventListener("click", () => { const s = randomSeed(); start(s, makeSecret(s), "연습 경기"); });
  $("#makeBtn").addEventListener("click", openMake);
  $("#makeBtn2").addEventListener("click", openMake);
  $("#pad").addEventListener("click", (e) => { const d = +e.target.closest("button")?.dataset.d; if (!d || cur.length >= DIG || cur.includes(d)) return; cur.push(d); renderNow(); });
  $("#del").addEventListener("click", () => { cur.pop(); renderNow(); });
  $("#throw").addEventListener("click", throwNow);
  $("#memo").addEventListener("click", (e) => {
    const d = +e.target.closest("button")?.dataset.d; if (!d) return;
    const m = (memo[G.key] ||= {}); m[d] = ((m[d] || 0) + 1) % 3;
    store.set("memo", memo); renderMemo();
  });
  // 키보드: 숫자·Backspace·Enter
  addEventListener("keydown", (e) => {
    if ($("#play").hidden) return;
    if (/^[1-9]$/.test(e.key)) { const d = +e.key; if (cur.length < DIG && !cur.includes(d)) { cur.push(d); renderNow(); } }
    else if (e.key === "Backspace") { cur.pop(); renderNow(); }
    else if (e.key === "Enter") throwNow();
  });
  $("#mpad").addEventListener("click", (e) => { const d = +e.target.closest("button")?.dataset.d; if (!d || mk.length >= DIG || mk.includes(d)) return; mk.push(d); renderMake(); });
  $("#mdel").addEventListener("click", () => { mk.pop(); renderMake(); });
  $("#mshare").addEventListener("click", async () => {
    if (!validGuess(mk)) return;
    const by = $("#byName").value.trim().slice(0, 10);
    store.set("name", by);
    const url = `${ROOT_URL}baseball/?n=${encodeSecret(mk)}${by ? `&by=${encodeURIComponent(by)}` : ""}`;
    const r = await share({ title: "숫자 야구 도전", text: `${by || "친구"}가 낸 숫자 세 개, 몇 회 만에 맞힐 수 있어? ⚾`, url });
    if (r === "shared") toast("보냈어요");
  });
  $("#shareBtn").addEventListener("click", async () => {
    const url = G.key.startsWith("f") ? `${ROOT_URL}baseball/?n=${G.key.slice(1)}` : `${ROOT_URL}baseball/`;
    const r = await share({ title: "숫자 야구", text: $("#shareText").textContent, url });
    if (r === "shared") toast("보냈어요");
  });
  renderMoreSites($("#more"), "baseball");
}
if (typeof document !== "undefined" && document.getElementById("pad")) init();
