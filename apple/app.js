// 사과 게임 v2 화면(떨어지는 사과). 계산은 core.js
import { $, share, toast, renderMoreSites, prefersReducedMotion, ROOT_URL, getParam, countUp, haptic } from "../shared/kit.js";
import { COLS, ROWS, TIME, DAY, newState, dailySeed, randomSeed, validSeed, rectCells, rectSum, tryTake, anyMove, shake, settle, best, record, todayScore, shareText } from "./core.js";

const RM = prefersReducedMotion();
let G = null; // { st, st0, seed, score, left, running, paused, rival }
let raf = 0, lastT = 0;

function show(v) { for (const id of ["intro", "play", "res"]) $("#" + id).hidden = id !== v; scrollTo({ top: 0 }); }

/* ---------- 판 그리기 ---------- */
// from: 칸마다 원래 행(새 사과는 음수). 있으면 그만큼 위에서 떨어지는 움직임
function drawBoard(board, from = null, el = $("#board"), rows = ROWS, cols = COLS) {
  el.style.setProperty("--cols", cols);
  el.style.setProperty("--rows", rows);
  let html = "";
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = r * cols + c, v = board[i];
    const fall = from ? r - from[i] : 0;
    const cls = from ? (fall > 0 ? "ap-a is-fall" : "ap-a") : "ap-a is-in0";
    const sty = from ? (fall > 0 ? `--fall:${fall};--d:${(c * 0.012).toFixed(3)}s` : "") : `--d:${((r + c) * 0.01).toFixed(3)}s`;
    html += `<span class="${cls}" data-i="${i}" style="${sty}"><b>${v}</b></span>`;
  }
  el.innerHTML = html;
}
function cellAt(clientX, clientY) {
  const r = $("#board").getBoundingClientRect();
  const x = Math.floor(((clientX - r.left) / r.width) * COLS), y = Math.floor(((clientY - r.top) / r.height) * ROWS);
  return [Math.max(0, Math.min(ROWS - 1, y)), Math.max(0, Math.min(COLS - 1, x))];
}

/* ---------- 끌어서 묶기 ---------- */
let drag = null; // { r0, c0, r1, c1 }
const selCells = () => rectCells(drag.r0, drag.c0, drag.r1, drag.c1);
function paintSel() {
  const sel = $("#sel");
  document.querySelectorAll("#board .ap-a.is-in").forEach((e) => e.classList.remove("is-in"));
  if (!drag) { sel.hidden = true; return; }
  const ra = Math.min(drag.r0, drag.r1), rb = Math.max(drag.r0, drag.r1), ca = Math.min(drag.c0, drag.c1), cb = Math.max(drag.c0, drag.c1);
  // 판 실제 크기(픽셀) 기준(상자 테두리 여백 때문에 % 로 놓으면 어긋남)
  const br = $("#board").getBoundingClientRect(), wr = $("#board").parentElement.getBoundingClientRect();
  const cw = br.width / COLS, ch = br.height / ROWS;
  sel.style.left = `${br.left - wr.left + ca * cw - 2}px`; sel.style.top = `${br.top - wr.top + ra * ch - 2}px`;
  sel.style.width = `${(cb - ca + 1) * cw + 4}px`; sel.style.height = `${(rb - ra + 1) * ch + 4}px`;
  const cells = selCells(), s = rectSum(G.st.board, cells);
  $("#selSum").textContent = s;
  sel.dataset.state = s === 10 ? "ok" : s > 10 ? "over" : "under";
  sel.hidden = false;
  cells.forEach((i) => document.querySelector(`#board .ap-a[data-i="${i}"]`)?.classList.add("is-in"));
}
function bindBoard() {
  const b = $("#board");
  b.addEventListener("pointerdown", (e) => {
    if (!G?.running || G.paused) return;
    e.preventDefault();
    const [r, c] = cellAt(e.clientX, e.clientY);
    drag = { r0: r, c0: c, r1: r, c1: c };
    b.setPointerCapture?.(e.pointerId);
    paintSel();
  });
  b.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const [r, c] = cellAt(e.clientX, e.clientY);
    if (r !== drag.r1 || c !== drag.c1) { drag.r1 = r; drag.c1 = c; paintSel(); }
  });
  const end = () => {
    if (!drag) return;
    const cells = selCells();
    drag = null;
    const rects = new Map(cells.map((i) => [i, document.querySelector(`#board .ap-a[data-i="${i}"]`)?.getBoundingClientRect()]));
    const r = tryTake(G.st, cells);
    if (!r.ok) {
      const sel = $("#sel"); sel.classList.remove("is-no"); void sel.offsetWidth; sel.classList.add("is-no");
      setTimeout(paintSel, 260);
      return;
    }
    G.score += r.got;
    $("#score").textContent = G.score;
    $("#score").classList.remove("is-pop"); void $("#score").offsetWidth; $("#score").classList.add("is-pop");
    fly(r.cells.map((i) => [rects.get(i), G.st0[i]]));
    drawBoard(G.st.board, RM ? null : r.from);
    G.st0 = G.st.board.slice();
    haptic?.(15);
    if (!anyMove(G.st.board)) { // 드물게 막히면 판을 흔들어 새로 채움(같은 판이면 같은 결과)
      const from = shake(G.st); G.st0 = G.st.board.slice();
      setTimeout(() => { drawBoard(G.st.board, RM ? null : from); toast("판을 흔들었어요"); }, RM ? 0 : 400);
    }
    paintSel();
  };
  b.addEventListener("pointerup", end);
  b.addEventListener("pointercancel", end);
}
// 딴 사과: 그 자리에서 톡 튀어 올랐다가 점수판으로 날아감(판은 그 사이 떨어짐)
function fly(list) {
  if (RM) return;
  const target = $("#score").getBoundingClientRect();
  list.forEach(([r, v], k) => {
    if (!r) return;
    const el = document.createElement("span");
    el.className = "ap-a ap-fly";
    el.innerHTML = `<b>${v}</b>`;
    Object.assign(el.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, animationDelay: `${k * 0.04}s` });
    el.style.setProperty("--tx", `${target.left - r.left}px`); el.style.setProperty("--ty", `${target.top - r.top}px`);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 900 + k * 40);
  });
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
    if (G.left <= 0) { finish(); return; }
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
function resumeGame() { if (!G?.running) return; G.paused = false; $("#pause").hidden = true; lastT = performance.now(); }

/* ---------- 시작 · 끝 ---------- */
function start(seed) {
  const st = newState(seed);
  G = { st, st0: st.board.slice(), seed, score: 0, left: TIME, running: true, paused: false, rival: G?.seed === seed ? G.rival : chal?.seed === seed ? chal.t : null };
  drawBoard(st.board);
  $("#score").textContent = "0"; $("#sec").textContent = TIME; $("#bar").style.transform = "scaleX(1)"; $("#pause").hidden = true;
  show("play");
  cancelAnimationFrame(raf); lastT = performance.now(); raf = requestAnimationFrame(tick);
}
function finish() {
  if (!G?.running) return;
  G.running = false; cancelAnimationFrame(raf); drag = null; paintSel();
  record(G.seed, G.score);
  const daily = G.seed === dailySeed();
  $("#resKind").textContent = daily ? `오늘의 판 #${DAY}` : G.rival != null ? "도전장 판" : "새 판";
  const tot = $("#total");
  if (RM || !countUp) tot.textContent = G.score; else { tot.textContent = "0"; countUp(tot, G.score, { duration: 900 }); }
  const lines = [];
  if (G.rival != null) lines.push(G.score > G.rival ? `도전장 ${G.rival}개를 넘었어요!` : G.score === G.rival ? `도전장 ${G.rival}개와 같아요.` : `도전장 ${G.rival}개에 ${G.rival - G.score}개 모자라요.`);
  lines.push(`내 최고 ${best()}개`);
  $("#resLine").textContent = lines.join(" · ");
  $("#shareText").textContent = shareText(G.seed, G.score, G.rival);
  show("res");
}

/* ---------- 첫 화면 견본(움직임): 맨 아래 줄에서 합 10 묶음을 따면 위 사과가 툭 떨어지고 새 사과가 들어옴 ---------- */
function demo() {
  const R = 4, C = 7, el = $("#demoBoard");
  const st = { seed: "demo", rows: R, cols: C, board: [3, 7, 5, 2, 8, 1, 4, 6, 9, 2, 5, 5, 3, 4, 2, 1, 7, 3, 6, 8, 2, 5, 3, 2, 4, 9, 1, 6], drawn: new Array(C).fill(0) };
  drawBoard(st.board, null, el, R, C);
  if (RM) return;
  setInterval(() => {
    for (let rr = R - 1; rr >= 0; rr--) for (let c0 = 0; c0 < C; c0++) for (let c1 = c0; c1 < C; c1++) {
      const cells = rectCells(rr, c0, rr, c1, C);
      if (rectSum(st.board, cells) === 10) {
        cells.forEach((i) => el.querySelector(`[data-i="${i}"]`)?.classList.add("is-in"));
        setTimeout(() => { cells.forEach((i) => (st.board[i] = 0)); drawBoard(st.board, settle(st), el, R, C); }, 700);
        return;
      }
    }
    st.board.fill(0); drawBoard(st.board, settle(st), el, R, C);
  }, 2400);
}

let chal = null; // 받은 도전장 { seed, t }
function init() {
  if (RM) document.documentElement.classList.add("rm");
  demo();
  $("#todayNo").textContent = `오늘의 판 #${DAY}`;
  const ts = todayScore();
  $("#rec").textContent = `${ts != null ? `오늘의 판 ${ts}개 · ` : ""}내 최고 ${best()}개`;
  const s = getParam("s"), t = Number(getParam("t"));
  if (s && validSeed(s)) {
    chal = { seed: s, t: Number.isInteger(t) && t >= 0 && t <= 999 ? t : null };
    const c = $("#chal"); c.hidden = false;
    c.innerHTML = `<b>도전장이 왔어요</b><span>${chal.t != null ? `친구는 이 판에서 2분에 ${chal.t}개 땄어요.` : "친구가 보낸 판이에요."} 같은 판으로 이겨 봐요.</span><button class="ap-go" id="playChal" type="button"><span class="ap-go__k">도전</span><span>같은 판으로 시작</span></button>`;
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
  renderMoreSites($("#more"), "apple");
}
if (typeof document !== "undefined" && document.getElementById("board")) init();
