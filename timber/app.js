// 나무꾼 화면. 계산은 core.js · 그림은 캔버스 하나
import { $, share, toast, renderMoreSites, prefersReducedMotion, ROOT_URL, getParam, haptic, countUp } from "../shared/kit.js";
import { DAY, SEEN, dailySeed, randomSeed, validSeed, newState, at, chop, tick, record, best, todayScore, shareText } from "./core.js";

const RM = prefersReducedMotion();
const W = 360, H = 480, GROUND = 432, SEG = 66, TRUNK = 66, CX = W / 2;
let G = null, raf = 0, lastT = 0, chal = null, cv, cx;

function show(v) { for (const id of ["intro", "play", "res"]) $("#" + id).hidden = id !== v; scrollTo({ top: 0 }); }

/* ---------- 그림 ---------- */
function setupCanvas() {
  cv = $("#cv"); const dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = W * dpr; cv.height = H * dpr; cx = cv.getContext("2d"); cx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function bark(x, y, w, h) {
  cx.fillStyle = "#8a5a2b"; cx.fillRect(x, y, w, h);
  cx.fillStyle = "#6e4420"; for (let i = 0; i < 3; i++) cx.fillRect(x + 10 + i * 20, y + 6, 4, h - 12);
  cx.fillStyle = "rgba(0,0,0,.18)"; cx.fillRect(x, y + h - 3, w, 3);
}
function branch(side, y) {
  const x0 = side === "L" ? CX - TRUNK / 2 - 96 : CX + TRUNK / 2;
  cx.fillStyle = "#6e4420"; cx.fillRect(x0, y, 96, 15);
  cx.fillStyle = "#3f9a3a";
  const lx = side === "L" ? x0 + 8 : x0 + 70;
  cx.beginPath(); cx.ellipse(lx + 9, y + 2, 18, 11, 0, 0, Math.PI * 2); cx.fill();
  cx.fillStyle = "#57b84f"; cx.beginPath(); cx.ellipse(lx + 4, y - 1, 9, 6, 0, 0, Math.PI * 2); cx.fill();
}
function player(side, swing, dead) {
  const x = side === "L" ? CX - TRUNK / 2 - 38 : CX + TRUNK / 2 + 38, y = GROUND;
  const f = side === "L" ? 1 : -1;
  if (dead) {
    cx.fillStyle = "#9aa3ad"; cx.beginPath(); cx.roundRect(x - 18, y - 46, 36, 46, [18, 18, 3, 3]); cx.fill();
    cx.fillStyle = "#4b5560"; cx.font = "900 12px sans-serif"; cx.textAlign = "center"; cx.fillText("끝", x, y - 20);
    return;
  }
  cx.save(); cx.translate(x, y); cx.scale(0.82, 0.82);
  cx.fillStyle = "#24314a"; cx.fillRect(-11, -26, 9, 26); cx.fillRect(2, -26, 9, 26);       // 다리
  cx.fillStyle = "#d8322a"; cx.fillRect(-15, -58, 30, 34);                                   // 체크 셔츠
  cx.fillStyle = "rgba(0,0,0,.18)"; cx.fillRect(-15, -46, 30, 4); cx.fillRect(-4, -58, 4, 34);
  cx.fillStyle = "#f2c39a"; cx.beginPath(); cx.arc(0, -70, 12, 0, Math.PI * 2); cx.fill();   // 얼굴
  cx.fillStyle = "#5a3a1a"; cx.fillRect(-12, -88, 24, 9); cx.fillRect(-14, -81, 28, 4);      // 모자
  cx.fillStyle = "#2b1a0e"; cx.fillRect(f * 4 - 1, -72, 3, 3);
  // 도끼: 휘두르는 중이면 나무 쪽으로 눕힘
  cx.rotate(f * (swing ? 1.25 : -0.35));
  cx.fillStyle = "#7a4a26"; cx.fillRect(f > 0 ? 8 : -12, -64, 4, 40);
  cx.fillStyle = "#c9d2da"; cx.beginPath(); cx.moveTo(f > 0 ? 12 : -12, -64); cx.lineTo(f > 0 ? 28 : -28, -70); cx.lineTo(f > 0 ? 28 : -28, -52); cx.lineTo(f > 0 ? 12 : -12, -56); cx.fill();
  cx.restore();
}
function draw(now) {
  const st = G.st;
  const sky = cx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#8fd3f4"); sky.addColorStop(1, "#d8f0e0");
  cx.fillStyle = sky; cx.fillRect(0, 0, W, H);
  cx.fillStyle = "rgba(255,255,255,.7)"; for (const [x, y, r] of [[60, 70, 22], [84, 64, 26], [290, 110, 20], [310, 104, 24]]) { cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.fill(); }
  cx.fillStyle = "#5aa64a"; cx.fillRect(0, GROUND, W, H - GROUND); cx.fillStyle = "#4a8f3c"; cx.fillRect(0, GROUND, W, 6);
  // 나무가 한 칸 내려오는 움직임
  const drop = RM ? 0 : Math.max(0, G.drop) * SEG;
  for (let k = SEEN; k >= 0; k--) {
    const y = GROUND - (k + 1) * SEG - drop;
    bark(CX - TRUNK / 2, y, TRUNK, SEG);
    const b = at(st, k); if (b) branch(b, y + SEG / 2 - 8);
  }
  cx.fillStyle = "#6e4420"; cx.fillRect(CX - TRUNK / 2 - 6, GROUND - 8, TRUNK + 12, 10);
  // 찍혀 날아가는 토막
  for (const c of G.chips) {
    const t = (now - c.t0) / 450; if (t > 1) continue;
    cx.save(); cx.translate(CX + c.dir * t * 220, GROUND - SEG / 2 - 140 * t + 260 * t * t); cx.rotate(c.dir * t * 4);
    bark(-TRUNK / 2, -SEG / 2, TRUNK, SEG); if (c.b) { cx.translate(0, 0); }
    cx.restore();
  }
  G.chips = G.chips.filter((c) => now - c.t0 < 450);
  player(st.side, now - G.swingAt < 110, st.dead);
  if (st.dead && st.why === "branch" && !RM) { cx.fillStyle = `rgba(216,50,42,${Math.max(0, 0.35 - (now - G.deadAt) / 1200)})`; cx.fillRect(0, 0, W, H); }
}

/* ---------- 시간 · 멈춤 ---------- */
function loop(t) {
  if (!G) return;
  const dt = Math.min(250, t - lastT); lastT = t;
  if (G.running && !G.paused && G.started) {
    tick(G.st, dt);
    if (G.st.dead) return die(t);
  }
  G.drop = Math.max(0, G.drop - dt / 70);
  $("#bar").style.transform = `scaleX(${G.st.time})`;
  $(".tb-time").dataset.low = G.st.time < 0.25 ? "1" : "0";
  draw(t);
  raf = requestAnimationFrame(loop);
}
function pauseGame(why) {
  if (!G?.running || G.paused || !G.started) return;
  G.paused = true; $("#pause").hidden = false;
  $("#pause span").textContent = why === "hidden" ? "큐 잡혔어요? 돌아오면 이어서 해요." : "멈춰 있어요. 시간 그대로예요.";
}
function resumeGame() { if (!G?.running) return; G.paused = false; $("#pause").hidden = true; lastT = performance.now(); }

/* ---------- 찍기 ---------- */
function act(side) {
  if (!G?.running || G.paused) return;
  G.started = true; $("#hint").hidden = true;
  const had = at(G.st, 0);
  const r = chop(G.st, side);
  const now = performance.now();
  G.swingAt = now;
  if (r?.chopped || r?.ok) { G.chips.push({ t0: now, dir: side === "L" ? 1 : -1, b: had }); G.drop = 1; }
  $("#score").textContent = G.st.score;
  if (G.st.dead) { die(now); return; }
  haptic?.(6);
}
function die(now) {
  if (!G.running) return;
  G.running = false; G.deadAt = now;
  haptic?.([40, 30, 40]);
  draw(now);
  cancelAnimationFrame(raf);
  // 쓰러진 모습을 잠깐 보여 주고 결과로
  const end = () => finish();
  if (RM) end(); else { const t0 = performance.now(); const fade = (t) => { draw(t); if (t - t0 < 700) requestAnimationFrame(fade); else end(); }; requestAnimationFrame(fade); }
}

/* ---------- 시작 · 끝 ---------- */
function start(seed) {
  G = { st: newState(seed), seed, running: true, paused: false, started: false, drop: 0, chips: [], swingAt: -1e9, rival: G?.seed === seed ? G.rival : chal?.seed === seed ? chal.t : null };
  $("#score").textContent = "0"; $("#pause").hidden = true; $("#hint").hidden = false;
  show("play");
  cancelAnimationFrame(raf); lastT = performance.now(); raf = requestAnimationFrame(loop);
}
function finish() {
  const st = G.st;
  record(G.seed, st.score);
  $("#resKind").textContent = G.seed === dailySeed() ? `오늘의 나무 #${DAY}` : G.rival != null ? "도전장 나무" : "새 나무";
  $("#resWhy").textContent = st.why === "time" ? "시간이 다 됐어요" : "가지에 맞았어요";
  const tot = $("#total");
  if (RM || !countUp) tot.textContent = st.score; else { tot.textContent = "0"; countUp(tot, st.score, { duration: 700 }); }
  const lines = [];
  if (G.rival != null) lines.push(st.score > G.rival ? `도전장 ${G.rival}번을 넘었어요!` : st.score === G.rival ? `도전장 ${G.rival}번과 같아요.` : `도전장 ${G.rival}번에 ${G.rival - st.score}번 모자라요.`);
  lines.push(`내 최고 ${best()}번`);
  $("#resLine").textContent = lines.join(" · ");
  $("#shareText").textContent = shareText(G.seed, st.score, G.rival);
  show("res");
}

/* ---------- 첫 화면 견본: 작은 나무꾼이 좌우로 찍음 ---------- */
function demo() {
  const el = $("#demo"); if (!el || RM) return;
  let k = 0; setInterval(() => { k++; el.dataset.side = k % 4 < 2 ? "L" : "R"; el.classList.remove("is-chop"); void el.offsetWidth; el.classList.add("is-chop"); }, 520);
}

function init() {
  window.__timber = () => G && { ...G.st, tree: undefined, below: [0, 1, 2, 3].map((k) => at(G.st, k)), running: G.running, paused: G.paused, started: G.started };
  if (RM) document.documentElement.classList.add("rm");
  setupCanvas(); demo();
  $("#todayNo").textContent = `#${DAY}`;
  const ts = todayScore();
  $("#rec").textContent = `${ts != null ? `오늘의 나무 ${ts}번 · ` : ""}내 최고 ${best()}번`;
  const s = getParam("s"), t = Number(getParam("t"));
  if (s && validSeed(s)) {
    chal = { seed: s, t: getParam("t") != null && Number.isInteger(t) && t >= 0 && t <= 9999 ? t : null };
    const c = $("#chal"); c.hidden = false;
    c.innerHTML = `<b>도전장이 왔어요</b><span>${chal.t != null ? `친구는 이 나무를 ${chal.t}번 찍었어요.` : "친구가 보낸 나무예요."} 가지 순서가 똑같아요.</span><button class="tb-go" id="playChal" type="button"><span class="tb-go__k">도전</span><span>같은 나무로 시작</span></button>`;
    $("#playChal").addEventListener("click", () => start(chal.seed));
  }
  $("#cv").addEventListener("pointerdown", (e) => { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); act(e.clientX - r.left < r.width / 2 ? "L" : "R"); });
  $("#padL").addEventListener("pointerdown", (e) => { e.preventDefault(); act("L"); });
  $("#padR").addEventListener("pointerdown", (e) => { e.preventDefault(); act("R"); });
  addEventListener("keydown", (e) => {
    if ($("#play").hidden || e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === "arrowleft" || k === "a") { e.preventDefault(); act("L"); }
    else if (k === "arrowright" || k === "d") { e.preventDefault(); act("R"); }
    else if (k === "escape") G?.paused ? resumeGame() : pauseGame("button");
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
    const url = `${ROOT_URL}timber/?s=${encodeURIComponent(G.seed)}&t=${G.st.score}`;
    const r = await share({ title: "나무꾼 도전장", text: $("#shareText").textContent, url });
    if (r === "shared") toast("보냈어요");
  });
  renderMoreSites($("#more"), "timber");
}
if (typeof document !== "undefined" && document.getElementById("cv")) init();
