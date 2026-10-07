// 규칙 두더지 화면. 계산은 core.js
import { $, share, toast, renderMoreSites, prefersReducedMotion, ROOT_URL, getParam, haptic, countUp } from "../shared/kit.js";
import { DUR, SEG, HOLES, DAY, RULES, ruleById, ruleAt, dailySeed, randomSeed, validSeed, newState, moleAt, whack, record, best, todayScore, shareText } from "./core.js";

const RM = prefersReducedMotion();
const KEYS = ["q", "w", "e", "a", "s", "d", "z", "x", "c"];
let G = null, raf = 0, lastT = 0, chal = null;

function show(v) { for (const id of ["intro", "play", "res"]) $("#" + id).hidden = id !== v; scrollTo({ top: 0 }); }

/* ---------- 구멍 ---------- */
function fieldHTML(n = HOLES) {
  return [...Array(n).keys()].map((h) => `<button type="button" class="hole" data-h="${h}" aria-label="${h + 1}번 구멍"><span class="mole"><i class="nose"></i><b></b></span><i class="dirt"></i><em class="pop"></em></button>`).join("");
}
// 지금 시각 기준으로 구멍마다 두더지 올림/내림(바뀐 것만 고침)
function paintMoles() {
  document.querySelectorAll("#field .hole").forEach((el) => {
    const h = +el.dataset.h, p = moleAt(G.st, h);
    const id = p ? String(p.i) : "";
    if (el.dataset.p === id) return;
    el.dataset.p = id;
    if (p) { el.querySelector(".mole b").textContent = p.v; el.classList.remove("is-hit", "is-bad"); el.classList.add("is-up"); }
    else el.classList.remove("is-up");
  });
}
function paintRule(force) {
  const seg = Math.min(G.st.board.rules.length - 1, Math.floor(G.st.t / SEG));
  const segLeft = SEG - (G.st.t - seg * SEG);
  $("#segBar").style.transform = `scaleX(${Math.max(0, segLeft / SEG)})`;
  $("#sign").classList.toggle("is-soon", segLeft < 1500 && seg < G.st.board.rules.length - 1);
  if (!force && G.seg === seg) return;
  const changed = G.seg != null && G.seg !== seg;
  G.seg = seg;
  $("#rule").textContent = ruleAt(G.st.board, G.st.t).name;
  $("#segNo").textContent = `규칙 ${seg + 1}/${G.st.board.rules.length}`;
  $("#next").textContent = seg < G.st.board.rules.length - 1 ? "다음 ?" : "마지막";
  if (changed) { const s = $("#sign"); s.classList.remove("is-flip"); void s.offsetWidth; s.classList.add("is-flip"); haptic?.([15, 30, 15]); }
}
function paintScore() {
  $("#score").textContent = G.st.score;
  $("#combo").textContent = G.st.combo >= 3 ? `${G.st.combo}연속` : "";
}

/* ---------- 시간 · 멈춤 ---------- */
function tick(t) {
  if (!G?.running) return;
  if (!G.paused) {
    G.st.t = Math.min(DUR, G.st.t + Math.min(250, t - lastT));
    const left = (DUR - G.st.t) / 1000;
    $("#sec").textContent = Math.ceil(left);
    $("#bar").style.transform = `scaleX(${left / (DUR / 1000)})`;
    paintRule(); paintMoles();
    if (G.st.t >= DUR) { finish(); return; }
  }
  lastT = t;
  raf = requestAnimationFrame(tick);
}
function pauseGame(why) {
  if (!G?.running || G.paused) return;
  G.paused = true;
  $("#pause").hidden = false;
  $("#pause span").textContent = why === "hidden" ? "큐 잡혔어요? 돌아오면 이어서 해요." : "멈춰 있어요. 남은 시간 그대로예요.";
}
function resumeGame() { if (!G?.running) return; G.paused = false; $("#pause").hidden = true; lastT = performance.now(); }

/* ---------- 치기 ---------- */
function hit(h) {
  if (!G?.running || G.paused) return;
  const r = whack(G.st, h);
  const el = $(`#field .hole[data-h="${h}"]`);
  if (!r) { el.classList.remove("is-miss"); void el.offsetWidth; el.classList.add("is-miss"); return; }
  const pop = el.querySelector(".pop");
  pop.textContent = r.ok ? "+1" : "−1";
  el.classList.remove("is-hit", "is-bad"); void el.offsetWidth;
  el.classList.add(r.ok ? "is-hit" : "is-bad");
  if (!r.ok) { const f = $("#field"); f.classList.remove("is-shake"); void f.offsetWidth; f.classList.add("is-shake"); }
  haptic?.(r.ok ? 10 : [30, 20, 30]);
  paintScore();
  // 맞은 두더지는 잠깐 뒤 내려감
  setTimeout(() => { if (el.dataset.p === String(r.pop.i)) { el.classList.remove("is-up"); el.dataset.p = ""; } }, RM ? 0 : 260);
}

/* ---------- 시작 · 끝 ---------- */
function start(seed) {
  G = { st: newState(seed), seed, running: true, paused: false, seg: null, rival: G?.seed === seed ? G.rival : chal?.seed === seed ? chal.t : null };
  $("#field").innerHTML = fieldHTML();
  $("#pause").hidden = true; $("#sec").textContent = DUR / 1000; $("#bar").style.transform = "scaleX(1)";
  paintScore(); paintRule(true); paintMoles();
  show("play");
  cancelAnimationFrame(raf); lastT = performance.now(); raf = requestAnimationFrame(tick);
}
function finish() {
  if (!G?.running) return;
  G.running = false; cancelAnimationFrame(raf);
  const st = G.st;
  record(G.seed, st.score);
  const daily = G.seed === dailySeed();
  $("#resKind").textContent = daily ? `오늘의 판 #${DAY}` : G.rival != null ? "도전장 판" : "새 판";
  const tot = $("#total");
  if (RM || !countUp) tot.textContent = st.score; else { tot.textContent = "0"; countUp(tot, st.score, { duration: 800 }); }
  $("#good").textContent = `${st.good}마리`;
  $("#bad").textContent = `${st.bad}번`;
  $("#maxCombo").textContent = `${st.maxCombo}연속`;
  $("#ruleLog").innerHTML = st.board.rules.map((id, k) => `<li style="--k:${k}"><span>${k * 10}~${k * 10 + 10}초</span><b>${ruleById(id).name}</b></li>`).join("");
  const lines = [];
  if (G.rival != null) lines.push(st.score > G.rival ? `도전장 ${G.rival}점을 넘었어요!` : st.score === G.rival ? `도전장 ${G.rival}점과 같아요.` : `도전장 ${G.rival}점에 ${G.rival - st.score}점 모자라요.`);
  lines.push(`내 최고 ${best()}점`);
  $("#resLine").textContent = lines.join(" · ");
  $("#shareText").textContent = shareText(G.seed, st, G.rival);
  show("res");
}

/* ---------- 첫 화면 견본: 간판 규칙이 바뀌고, 맞는 두더지만 망치에 맞음 ---------- */
function demo() {
  const el = $("#demoField");
  el.innerHTML = fieldHTML(6);
  const order = ["even", "m3", "odd", "gt5"];
  let k = 0, step = 0;
  const holes = [...el.querySelectorAll(".hole")];
  const put = () => holes.forEach((h, i) => { const v = 1 + ((i * 7 + step * 5) % 9); h.querySelector(".mole b").textContent = v; h.classList.toggle("is-up", (i + step) % 3 !== 0); h.classList.remove("is-hit", "is-bad"); });
  put();
  if (RM) return;
  setInterval(() => {
    step++;
    if (step % 4 === 0) { k = (k + 1) % order.length; const s = $("#demoRule"); s.textContent = ruleById(order[k]).name; s.parentElement.classList.remove("is-flip"); void s.offsetWidth; s.parentElement.classList.add("is-flip"); }
    put();
    setTimeout(() => holes.forEach((h) => { if (h.classList.contains("is-up") && ruleById(order[k]).ok(+h.querySelector(".mole b").textContent)) h.classList.add("is-hit"); }), 500);
  }, 1300);
}

function init() {
  window.__moleT = () => G?.st.t ?? null; // 검사용: 지금 게임 시각(ms)
  if (RM) document.documentElement.classList.add("rm");
  demo();
  $("#todayNo").textContent = `#${DAY}`;
  const ts = todayScore();
  $("#rec").textContent = `${ts != null ? `오늘의 판 ${ts}점 · ` : ""}내 최고 ${best()}점`;
  const s = getParam("s"), t = Number(getParam("t"));
  if (s && validSeed(s)) {
    chal = { seed: s, t: getParam("t") != null && Number.isInteger(t) && t >= 0 && t <= 999 ? t : null };
    const c = $("#chal"); c.hidden = false;
    c.innerHTML = `<b>도전장이 왔어요</b><span>${chal.t != null ? `친구는 이 판에서 ${chal.t}점 냈어요.` : "친구가 보낸 판이에요."} 같은 두더지, 같은 규칙 순서예요.</span><button class="ml-go" id="playChal" type="button"><span class="ml-go__k">도전</span><span>같은 판으로 시작</span></button>`;
    $("#playChal").addEventListener("click", () => start(chal.seed));
  }
  $("#field").addEventListener("pointerdown", (e) => { const b = e.target.closest(".hole"); if (b) { e.preventDefault(); hit(+b.dataset.h); } });
  addEventListener("keydown", (e) => {
    if ($("#play").hidden) return;
    const h = KEYS.indexOf(e.key.toLowerCase());
    if (h >= 0) { e.preventDefault(); hit(h); }
    else if (e.key === "Escape") G?.paused ? resumeGame() : pauseGame("button");
  });
  $("#playDaily").addEventListener("click", () => start(dailySeed()));
  $("#playRandom").addEventListener("click", () => start(randomSeed()));
  $("#again").addEventListener("click", () => start(G.seed));
  $("#newOne").addEventListener("click", () => start(randomSeed()));
  $("#pauseBtn").addEventListener("click", () => pauseGame("button"));
  $("#resume").addEventListener("click", resumeGame);
  // 롤 큐: 창을 내리거나 다른 창(게임 클라이언트)으로 넘어가면 바로 멈춤
  document.addEventListener("visibilitychange", () => { if (document.hidden) pauseGame("hidden"); });
  addEventListener("blur", () => pauseGame("hidden"));
  $("#shareBtn").addEventListener("click", async () => {
    const url = `${ROOT_URL}mole/?s=${encodeURIComponent(G.seed)}&t=${G.st.score}`;
    const r = await share({ title: "규칙 두더지 도전장", text: $("#shareText").textContent, url });
    if (r === "shared") toast("보냈어요");
  });
  renderMoreSites($("#more"), "mole");
}
if (typeof document !== "undefined" && document.getElementById("field")) init();
