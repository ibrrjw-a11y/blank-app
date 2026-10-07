// 사과 게임 화면. 계산은 core.js
import { $, share, toast, renderMoreSites, prefersReducedMotion, ROOT_URL, getParam, countUp, haptic } from "../shared/kit.js";
import { COLS, ROWS, N, TIME, DAY, BONUS, makeBoard, makeHidden, tierOf, dailySeed, randomSeed, validSeed, rectCells, rectSum, visibleSum, tryTake, anyMove, best, record, todayScore, shareText } from "./core.js";

const RM = prefersReducedMotion();
let G = null; // { seed, board, hidden, score(점수), apples, hiddenHit, left, running, paused, rival }
let tall = false; // 세로 화면이면 판을 돌려서 보여 줌(같은 판)
let raf = 0, lastT = 0;

function show(v) { for (const id of ["intro", "play", "res"]) $("#" + id).hidden = id !== v; scrollTo({ top: 0 }); }

/* ---------- 판 그리기 ---------- */
// 화면 칸(y,x) ↔ 판 칸 번호. 세로 화면이면 행과 열을 바꿔 보여 줌
const dims = () => (tall ? [COLS, ROWS] : [ROWS, COLS]); // [화면 행 수, 화면 열 수]
const idxOf = (y, x) => (tall ? x * COLS + y : y * COLS + x);
const logical = (y, x) => (tall ? [x, y] : [y, x]); // 화면 → [판 행, 판 열]
function drawBoard() {
  const [H, W] = dims();
  const el = $("#board");
  el.style.setProperty("--cols", W);
  el.style.setProperty("--rows", H);
  let html = "";
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    html += appleHTML(idxOf(y, x), ((y + x) * 0.012).toFixed(3));
  }
  el.innerHTML = html;
}
// 사과 한 알: 딴 자리는 빈칸, 숨은 사과는 '?' + 색 힌트(t0 초록 1~3 · t1 노랑 4~6 · t2 주황 7~9)
function appleHTML(i, d = 0, extra = "") {
  const v = G.board[i];
  if (!v) return `<span class="ap-a is-gone" data-i="${i}"></span>`;
  if (G.hidden[i]) return `<span class="ap-a is-h t${tierOf(v)}" data-i="${i}" style="--d:${d}s"><b>?</b></span>`;
  return `<span class="ap-a${extra}" data-i="${i}" style="--d:${d}s"><b>${v}</b></span>`;
}
function cellAt(clientX, clientY) {
  const r = $("#board").getBoundingClientRect();
  const [H, W] = dims();
  const x = Math.floor(((clientX - r.left) / r.width) * W), y = Math.floor(((clientY - r.top) / r.height) * H);
  return [Math.max(0, Math.min(H - 1, y)), Math.max(0, Math.min(W - 1, x))];
}

/* ---------- 끌어서 묶기 ---------- */
let drag = null; // { y0, x0, y1, x1 }
function selCells() {
  const [r0, c0] = logical(drag.y0, drag.x0), [r1, c1] = logical(drag.y1, drag.x1);
  return rectCells(r0, c0, r1, c1);
}
function paintSel() {
  const sel = $("#sel");
  if (!drag) { sel.hidden = true; document.querySelectorAll(".ap-a.is-in").forEach((e) => e.classList.remove("is-in")); return; }
  const [H, W] = dims();
  const ya = Math.min(drag.y0, drag.y1), yb = Math.max(drag.y0, drag.y1), xa = Math.min(drag.x0, drag.x1), xb = Math.max(drag.x0, drag.x1);
  // 판 실제 크기(픽셀) 기준으로 네모를 놓는다(상자 테두리 여백 때문에 % 로 놓으면 어긋남)
  const br = $("#board").getBoundingClientRect(), wr = $("#board").parentElement.getBoundingClientRect();
  const cw = br.width / W, ch = br.height / H;
  sel.style.left = `${br.left - wr.left + xa * cw - 2}px`; sel.style.top = `${br.top - wr.top + ya * ch - 2}px`;
  sel.style.width = `${(xb - xa + 1) * cw + 4}px`; sel.style.height = `${(yb - ya + 1) * ch + 4}px`;
  const cells = selCells(), { known, q } = visibleSum(G.board, cells, G.hidden);
  // 숨은 사과가 들면 실제 합은 숨기고 '보이는 합 + ?'만 보여 줌 — 맞혀서 거는 순간
  $("#selSum").textContent = q ? `${known}+${"?".repeat(Math.min(q, 3))}` : known;
  sel.dataset.state = q ? (known >= 10 ? "over" : "guess") : known === 10 ? "ok" : known > 10 ? "over" : "under";
  sel.hidden = false;
  const set = new Set(cells);
  document.querySelectorAll(".ap-a").forEach((e) => e.classList.toggle("is-in", set.has(+e.dataset.i)));
}
function bindBoard() {
  const b = $("#board");
  b.addEventListener("pointerdown", (e) => {
    if (!G?.running || G.paused) return;
    e.preventDefault();
    const [y, x] = cellAt(e.clientX, e.clientY);
    drag = { y0: y, x0: x, y1: y, x1: x };
    b.setPointerCapture?.(e.pointerId);
    paintSel();
  });
  b.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const [y, x] = cellAt(e.clientX, e.clientY);
    if (y !== drag.y1 || x !== drag.x1) { drag.y1 = y; drag.x1 = x; paintSel(); }
  });
  const end = () => {
    if (!drag) return;
    const cells = selCells();
    drag = null;
    const r = tryTake(G.board, cells, G.hidden);
    if (r.ok) {
      G.score += r.points; G.apples += r.got; G.hiddenHit += r.hiddenHit;
      if (r.hiddenHit) float(`숨은 사과 +${BONUS * r.hiddenHit}`, "good");
      $("#score").textContent = G.score;
      $("#score").classList.remove("is-pop"); void $("#score").offsetWidth; $("#score").classList.add("is-pop");
      pop(r.cells);
      haptic?.(15);
      if (!anyMove(G.board)) setTimeout(() => finish("blocked"), RM ? 0 : 500);
    } else if (r.revealed) {
      // 숨은 사과를 넣고 틀림: 숫자가 뒤집혀 드러나고 3초를 잃음
      G.left = Math.max(0, G.left - r.penalty);
      r.revealed.forEach((i) => { const el = document.querySelector(`.ap-a[data-i="${i}"]`); if (el) el.outerHTML = appleHTML(i, 0, " is-flip"); });
      float(`−${r.penalty}초`, "bad");
      const sel = $("#sel"); sel.classList.remove("is-no"); void sel.offsetWidth; sel.classList.add("is-no");
      haptic?.([20, 40, 20]);
      setTimeout(paintSel, 260);
      return;
    } else if (cells.some((i) => G.board[i])) {
      const sel = $("#sel"); sel.classList.remove("is-no"); void sel.offsetWidth; sel.classList.add("is-no");
      setTimeout(paintSel, 260);
      return;
    }
    paintSel();
  };
  b.addEventListener("pointerup", end);
  b.addEventListener("pointercancel", end);
}
// 딴 사과: 톡 튀어 올랐다가 점수판 쪽으로 날아감
function pop(cells) {
  const target = $("#score").getBoundingClientRect();
  cells.forEach((i, k) => {
    const el = document.querySelector(`.ap-a[data-i="${i}"]`);
    if (!el) return;
    if (RM) { el.className = "ap-a is-gone"; el.innerHTML = ""; return; }
    const r = el.getBoundingClientRect();
    const fly = el.cloneNode(true);
    fly.className = "ap-a ap-fly";
    Object.assign(fly.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, "--tx": `${target.left - r.left}px`, "--ty": `${target.top - r.top}px`, animationDelay: `${k * 0.04}s` });
    document.body.appendChild(fly);
    setTimeout(() => fly.remove(), 900 + k * 40);
    el.className = "ap-a is-gone"; el.innerHTML = "";
  });
}

// 점수판 옆에 잠깐 떠오르는 글씨(+2 / −3초)
function float(text, kind) {
  if (RM) return;
  const el = document.createElement("b");
  el.className = `ap-float is-${kind}`; el.textContent = text;
  $(".ap-hud").appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

/* ---------- 시간 · 멈춤 ---------- */
function tick(t) {
  if (!G?.running) return;
  if (!G.paused) {
    const dt = Math.min(0.25, (t - lastT) / 1000);
    G.left = Math.max(0, G.left - dt);
    $("#sec").textContent = Math.ceil(G.left);
    $("#bar").style.transform = `scaleX(${G.left / TIME})`;
    $(".ap-hud__time").dataset.low = G.left <= 15 ? "1" : "0";
    if (G.left <= 0) { finish("time"); return; }
  }
  lastT = t;
  raf = requestAnimationFrame(tick);
}
function pauseGame(why) {
  if (!G?.running || G.paused) return;
  G.paused = true; drag = null; paintSel();
  $("#pause").hidden = false;
  $("#pause span").textContent = why === "hidden" ? "큐 잡혔어요? 돌아오면 이어서 해요." : "멈춰 있어요. 남은 시간 그대로예요.";
}
function resumeGame() {
  if (!G?.running) return;
  G.paused = false; $("#pause").hidden = true; lastT = performance.now();
}

/* ---------- 시작 · 끝 ---------- */
function start(seed) {
  G = { seed, board: makeBoard(seed), hidden: makeHidden(seed), score: 0, apples: 0, hiddenHit: 0, left: TIME, running: true, paused: false, rival: G?.seed === seed ? G.rival : chal?.seed === seed ? chal.t : null };
  tall = innerWidth < innerHeight;
  drawBoard();
  $("#score").textContent = "0"; $("#sec").textContent = TIME; $("#bar").style.transform = "scaleX(1)"; $("#pause").hidden = true;
  show("play");
  cancelAnimationFrame(raf); lastT = performance.now(); raf = requestAnimationFrame(tick);
}
function finish(why) {
  if (!G?.running) return;
  G.running = false; cancelAnimationFrame(raf); drag = null; paintSel();
  record(G.seed, G.score);
  const daily = G.seed === dailySeed();
  $("#resKind").textContent = daily ? `오늘의 판 #${DAY}` : G.rival != null ? "도전장 판" : "새 판";
  const tot = $("#total");
  if (RM || !countUp) tot.textContent = G.score; else { tot.textContent = "0"; countUp(tot, G.score, { duration: 900 }); }
  const lines = [];
  if (why === "blocked") lines.push("더 묶을 수 있는 네모가 없어서 일찍 끝났어요.");
  lines.push(`사과 ${G.apples}개 · 숨은 사과 ${G.hiddenHit}개 맞힘`);
  if (G.rival != null) lines.push(G.score > G.rival ? `도전장 ${G.rival}점을 넘었어요!` : G.score === G.rival ? `도전장 ${G.rival}점과 같아요.` : `도전장 ${G.rival}점에 ${G.rival - G.score}점 모자라요.`);
  lines.push(`내 최고 ${best()}점`);
  $("#resLine").textContent = lines.join(" · ");
  $("#shareText").textContent = shareText(G.seed, G.score, G.apples, G.hiddenHit, G.rival);
  show("res");
}

/* ---------- 첫 화면 견본(움직임): 사과가 상자에 떨어지고, 네모가 쓸고 지나가며 =10 이 터짐 ---------- */
function demo() {
  const nums = [3, 7, 5, 2, 8, 1, 4, 6, 9, 2, 5, 5, 3, 4, 1, 6, 8, 2, 7, 3, 2, 6, 4, 9];
  const hid = { 10: 1, 13: 1, 20: 0 }; // 견본 숨은 사과(칸 번호 → 색 단계)
  $("#demo").innerHTML = `<div class="demo__crate">${nums.map((n, k) => (k in hid ? `<span class="ap-a is-h t${hid[k]}" style="--d:${(k * 0.05).toFixed(2)}s"><b>?</b></span>` : `<span class="ap-a" style="--d:${(k * 0.05).toFixed(2)}s"><b>${n}</b></span>`)).join("")}<i class="demo__sel"><b>10</b></i></div>
    <ul class="demo__key"><li><i class="t0"></i>? 초록 1~3</li><li><i class="t1"></i>? 노랑 4~6</li><li><i class="t2"></i>? 주황 7~9</li><li>맞히면 +2점 · 틀리면 −3초</li></ul>`;
}

let chal = null; // 받은 도전장 { seed, t }
function init() {
  if (RM) document.documentElement.classList.add("rm");
  demo();
  $("#todayNo").textContent = `오늘의 판 #${DAY}`;
  const ts = todayScore();
  $("#rec").textContent = `${ts != null ? `오늘의 판 ${ts}점 · ` : ""}내 최고 ${best()}점`;
  const s = getParam("s"), t = Number(getParam("t"));
  if (s && validSeed(s)) {
    chal = { seed: s, t: Number.isInteger(t) && t >= 0 && t <= 999 ? t : null };
    const c = $("#chal"); c.hidden = false;
    c.innerHTML = `<b>도전장이 왔어요</b><span>${chal.t != null ? `친구는 이 판에서 ${chal.t}점 냈어요.` : "친구가 보낸 판이에요."} 같은 판으로 이겨 봐요.</span><button class="ap-go" id="playChal" type="button"><span class="ap-go__k">도전</span><span>같은 판으로 시작</span></button>`;
    $("#playChal").addEventListener("click", () => start(chal.seed));
  }
  bindBoard();
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
    const url = `${ROOT_URL}apple/?s=${encodeURIComponent(G.seed)}&t=${G.score}`;
    const r = await share({ title: "사과 게임 도전장", text: $("#shareText").textContent, url });
    if (r === "shared") toast("보냈어요");
  });
  addEventListener("resize", () => { if (G?.running) { const nt = innerWidth < innerHeight; if (nt !== tall) { tall = nt; drawBoard(); } } });
  renderMoreSites($("#more"), "apple");
}
if (typeof document !== "undefined" && document.getElementById("board")) init();
