// 검은 건반 화면. 계산은 core.js · 그림은 캔버스 하나
import { $, share, toast, renderMoreSites, prefersReducedMotion, ROOT_URL, getParam, haptic, countUp } from "../shared/kit.js";
import { COLS, VIS, DAY, dailySeed, randomSeed, validSeed, newState, step, tap, tapNext, speedAt, record, best, todayScore, shareText } from "./core.js";

const RM = prefersReducedMotion();
const W = 360, H = 560, RH = H / VIS, CW = W / COLS;
const KEYS = ["d", "f", "j", "k"];
let G = null, raf = 0, lastT = 0, chal = null, cv, cx;

function show(v) { for (const id of ["intro", "play", "res"]) $("#" + id).hidden = id !== v; scrollTo({ top: 0 }); }
function setupCanvas() {
  cv = $("#cv"); const dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = W * dpr; cv.height = H * dpr; cx = cv.getContext("2d"); cx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function draw(now) {
  const st = G.st;
  cx.fillStyle = "#fbfaf6"; cx.fillRect(0, 0, W, H);
  cx.strokeStyle = "#d9d4c7"; cx.lineWidth = 1;
  for (let c = 1; c < COLS; c++) { cx.beginPath(); cx.moveTo(c * CW, 0); cx.lineTo(c * CW, H); cx.stroke(); }
  const k0 = Math.max(0, Math.floor(st.p) - 1);
  for (let k = k0; k < k0 + VIS + 2; k++) {
    const y = H - (k - st.p + 1) * RH;
    if (y > H || y + RH < 0) continue;
    const c = st.cols[k], done = k < st.score;
    cx.fillStyle = done ? "rgba(30,30,40,.16)" : k === st.score ? "#14141c" : "#2a2a36";
    cx.fillRect(c * CW + 1, y + 1, CW - 2, RH - 2);
    if (!done && k === st.score) { cx.fillStyle = "#e9c46a"; cx.fillRect(c * CW + 1, y + RH - 7, CW - 2, 6); }
    if (k === 0 && !st.started) { cx.fillStyle = "#fff"; cx.font = "900 20px Pretendard, sans-serif"; cx.textAlign = "center"; cx.fillText("시작", c * CW + CW / 2, y + RH / 2 + 7); }
    if (done && now - (G.pops[k] || -1e9) < 220) { const t = (now - G.pops[k]) / 220; cx.strokeStyle = `rgba(233,196,106,${1 - t})`; cx.lineWidth = 4; cx.strokeRect(c * CW + 4 - t * 8, y + 4 - t * 8, CW - 8 + t * 16, RH - 8 + t * 16); cx.lineWidth = 1; }
  }
  if (st.bad) {
    const y = H - (st.bad.k - st.p + 1) * RH;
    const on = RM || Math.floor((now - G.deadAt) / 120) % 2 === 0;
    if (on) { cx.fillStyle = "#e2312b"; cx.fillRect(st.bad.c * CW + 1, Math.max(-RH, Math.min(H - RH, y)) + 1, CW - 2, RH - 2); }
  }
}

/* ---------- 시간 · 멈춤 ---------- */
function loop(t) {
  if (!G) return;
  const dt = Math.min(100, t - lastT); lastT = t;
  if (G.running && !G.paused) {
    step(G.st, dt);
    if (G.st.dead) return die(t);
  }
  $("#speed").textContent = speedAt(G.st.score).toFixed(1);
  draw(t);
  raf = requestAnimationFrame(loop);
}
function pauseGame(why) {
  if (!G?.running || G.paused || !G.st.started) return;
  G.paused = true; $("#pause").hidden = false;
  $("#pause span").textContent = why === "hidden" ? "큐 잡혔어요? 돌아오면 3초 뒤 이어서 해요." : "멈춰 있어요.";
}
// 이어하기: 바로 내려오면 못 받으니 3초 세고 이어 감
function resumeGame() {
  if (!G?.running || !G.paused) return;
  $("#pause").hidden = true;
  const cd = $("#count"); let n = 3; // 움직임 줄이기 설정이어도 셈(놀이에 필요한 시간이라)
  const tickc = () => { if (n <= 0) { cd.hidden = true; G.paused = false; lastT = performance.now(); return; } cd.hidden = false; cd.textContent = n; n--; setTimeout(tickc, 600); };
  tickc();
}

function hit(col, h) {
  if (!G?.running || G.paused) return;
  const r = h == null ? tapNext(G.st, col) : tap(G.st, col, h);
  if (!r || r.ignored) return;
  if (r.ok) { G.pops[r.k] = performance.now(); $("#score").textContent = G.st.score; haptic?.(5); }
  if (G.st.dead) die(performance.now());
}
function die(now) {
  if (!G.running) return;
  G.running = false; G.deadAt = now; cancelAnimationFrame(raf);
  haptic?.([40, 30, 40]);
  // 놓친 칸이면 그 칸이 보이게 판을 살짝 되돌림
  if (G.st.why === "miss") G.st.p = G.st.score - 0.15;
  if (RM) { draw(now); return finish(); }
  const t0 = performance.now(); const f = (t) => { draw(t); if (t - t0 < 900) requestAnimationFrame(f); else finish(); }; requestAnimationFrame(f);
}

function start(seed) {
  G = { st: newState(seed), seed, running: true, paused: false, pops: {}, rival: G?.seed === seed ? G.rival : chal?.seed === seed ? chal.t : null };
  $("#score").textContent = "0"; $("#pause").hidden = true; $("#count").hidden = true;
  show("play");
  cancelAnimationFrame(raf); lastT = performance.now(); raf = requestAnimationFrame(loop);
}
function finish() {
  const st = G.st;
  record(G.seed, st.score);
  $("#resKind").textContent = G.seed === dailySeed() ? `오늘의 건반 #${DAY}` : G.rival != null ? "도전장 건반" : "새 건반";
  $("#resWhy").textContent = st.why === "miss" ? "검은 칸을 놓쳤어요" : "흰 칸을 눌렀어요";
  const tot = $("#total");
  if (RM || !countUp) tot.textContent = st.score; else { tot.textContent = "0"; countUp(tot, st.score, { duration: 700 }); }
  $("#resSpeed").textContent = `마지막 빠르기 초당 ${speedAt(st.score).toFixed(1)}칸`;
  const lines = [];
  if (G.rival != null) lines.push(st.score > G.rival ? `도전장 ${G.rival}개를 넘었어요!` : st.score === G.rival ? `도전장 ${G.rival}개와 같아요.` : `도전장 ${G.rival}개에 ${G.rival - st.score}개 모자라요.`);
  lines.push(`내 최고 ${best()}개`);
  $("#resLine").textContent = lines.join(" · ");
  $("#shareText").textContent = shareText(G.seed, st.score, G.rival);
  show("res");
}

function init() {
  window.__tiles = () => G && { p: G.st.p, score: G.st.score, started: G.st.started, dead: G.st.dead, why: G.st.why, next: G.st.cols.slice(G.st.score, G.st.score + 6), running: G.running, paused: G.paused };
  if (RM) document.documentElement.classList.add("rm");
  setupCanvas();
  $("#todayNo").textContent = `#${DAY}`;
  const ts = todayScore();
  $("#rec").textContent = `${ts != null ? `오늘의 건반 ${ts}개 · ` : ""}내 최고 ${best()}개`;
  const s = getParam("s"), t = Number(getParam("t"));
  if (s && validSeed(s)) {
    chal = { seed: s, t: getParam("t") != null && Number.isInteger(t) && t >= 0 && t <= 9999 ? t : null };
    const c = $("#chal"); c.hidden = false;
    c.innerHTML = `<b>도전장이 왔어요</b><span>${chal.t != null ? `친구는 이 건반을 ${chal.t}개 눌렀어요.` : "친구가 보낸 건반이에요."} 순서가 똑같아요.</span><button class="tl-go" id="playChal" type="button"><span class="tl-go__k">도전</span><span>같은 건반으로 시작</span></button>`;
    $("#playChal").addEventListener("click", () => start(chal.seed));
  }
  $("#cv").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    const col = Math.min(COLS - 1, Math.floor((e.clientX - r.left) / r.width * COLS));
    hit(col, (r.bottom - e.clientY) / r.height * VIS);
  });
  addEventListener("keydown", (e) => {
    if ($("#play").hidden || e.repeat) return;
    const i = KEYS.indexOf(e.key.toLowerCase());
    if (i >= 0) { e.preventDefault(); hit(i, null); }
    else if (e.key === "Escape") G?.paused ? resumeGame() : pauseGame("button");
  });
  $("#playDaily").addEventListener("click", () => start(dailySeed()));
  $("#playRandom").addEventListener("click", () => start(randomSeed()));
  $("#again").addEventListener("click", () => start(G.seed));
  $("#newOne").addEventListener("click", () => start(randomSeed()));
  $("#pauseBtn").addEventListener("click", () => pauseGame("button"));
  $("#resume").addEventListener("click", resumeGame);
  document.addEventListener("visibilitychange", () => { if (document.hidden) pauseGame("hidden"); });
  addEventListener("blur", () => pauseGame("hidden"));
  $("#shareBtn").addEventListener("click", async () => {
    const url = `${ROOT_URL}tiles/?s=${encodeURIComponent(G.seed)}&t=${G.st.score}`;
    const r = await share({ title: "검은 건반 도전장", text: $("#shareText").textContent, url });
    if (r === "shared") toast("보냈어요");
  });
  renderMoreSites($("#more"), "tiles");
}
if (typeof document !== "undefined" && document.getElementById("cv")) init();
