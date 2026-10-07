// 칼 꽂기 화면. 계산은 core.js · 그림은 캔버스 하나
import { $, share, toast, renderMoreSites, prefersReducedMotion, ROOT_URL, getParam, haptic, countUp } from "../shared/kit.js";
import { DAY, FLY, dailySeed, randomSeed, validSeed, newState, throwKnife, step, angleAt, record, best, todayScore, shareText } from "./core.js";

const RM = prefersReducedMotion();
const W = 360, H = 560, LX = 180, LY = 210, KY = 492;
let G = null, raf = 0, lastT = 0, chal = null, cv, cx;

function show(v) { for (const id of ["intro", "play", "res"]) $("#" + id).hidden = id !== v; scrollTo({ top: 0 }); }
function setupCanvas() {
  cv = $("#cv"); const dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = W * dpr; cv.height = H * dpr; cx = cv.getContext("2d"); cx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
const R = () => (G.st.stage.boss ? 58 : 72);
// 칼 한 자루: (0,0)이 칼끝, 손잡이는 +y 쪽
function knife(c, len = 92) {
  c.fillStyle = "#e6ebf0"; c.beginPath(); c.moveTo(0, 0); c.lineTo(7, 10); c.lineTo(7, 52); c.lineTo(-7, 52); c.lineTo(-7, 10); c.closePath(); c.fill();
  c.fillStyle = "#b8c2cc"; c.fillRect(-1, 10, 2, 40);
  c.fillStyle = "#2b2b33"; c.fillRect(-10, 52, 20, 6);
  c.fillStyle = "#7a3b1e"; c.fillRect(-6, 58, 12, len - 58);
  c.fillStyle = "#5a2a14"; for (let y = 64; y < len - 4; y += 8) c.fillRect(-6, y, 12, 2);
}
function logDisk(a, r) {
  cx.save(); cx.translate(LX, LY); cx.rotate(a);
  cx.fillStyle = G.st.stage.boss ? "#7d8792" : "#b07a45"; cx.beginPath(); cx.arc(0, 0, r, 0, Math.PI * 2); cx.fill();
  cx.strokeStyle = G.st.stage.boss ? "#5d6670" : "#8a5a2b"; cx.lineWidth = 3;
  for (const f of [0.78, 0.55, 0.3]) { cx.beginPath(); cx.arc(0, 0, r * f, 0, Math.PI * 2); cx.stroke(); }
  cx.lineWidth = 6; cx.strokeStyle = G.st.stage.boss ? "#4b535c" : "#6e4420"; cx.beginPath(); cx.arc(0, 0, r - 3, 0, Math.PI * 2); cx.stroke();
  cx.fillStyle = "rgba(0,0,0,.25)"; cx.fillRect(-2, -r * 0.7, 4, r * 0.4);
  cx.restore();
}
function draw(now) {
  const st = G.st, r = R();
  const bg = cx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#2a1d3a"); bg.addColorStop(1, "#120c1c");
  cx.fillStyle = bg; cx.fillRect(0, 0, W, H);
  // 단계 표시
  cx.fillStyle = st.stage.boss ? "#ff8a80" : "#f4d58d"; cx.font = "900 15px Pretendard, sans-serif"; cx.textAlign = "center";
  cx.fillText(st.stage.boss ? `${st.s + 1}단계 · 단단한 통나무` : `${st.s + 1}단계`, LX, 36);
  for (let k = 0; k < 5; k++) { cx.fillStyle = k <= st.s % 5 ? (k === 4 ? "#ff8a80" : "#f4d58d") : "rgba(255,255,255,.18)"; cx.beginPath(); cx.arc(LX - 40 + k * 20, 54, 5, 0, Math.PI * 2); cx.fill(); }
  const a = angleAt(st.stage, st.t);
  const shake = !RM && now - G.stickAt < 90 ? 3 : 0;
  if (st.wait > 0 && !RM) {
    // 깼으면 통나무가 두 쪽으로 갈라져 떨어짐
    const t = 1 - st.wait / 650;
    for (const s of [-1, 1]) { cx.save(); cx.translate(s * t * 90, t * t * 360); cx.rotate(s * t * 1.2); cx.beginPath(); cx.rect(s < 0 ? 0 : LX, 0, LX, H); cx.clip(); logDisk(a, r); cx.restore(); }
  } else {
    cx.save(); cx.translate(0, -shake);
    // 꽂힌 칼(통나무와 같이 돎)
    for (const k of st.stuck) {
      cx.save(); cx.translate(LX, LY); cx.rotate(a + k.a - Math.PI / 2); cx.translate(0, r - 18); knife(cx); cx.restore();
    }
    logDisk(a, r);
    cx.restore();
  }
  // 날아가는 칼 / 튕긴 칼
  if (st.fly) { const p = Math.min(1, (st.t - st.fly.t) / FLY); cx.save(); cx.translate(LX, KY - (KY - (LY + r - 18)) * p); knife(cx); cx.restore(); }
  else if (!st.dead && st.left > 0 && st.wait <= 0) { cx.save(); cx.translate(LX, KY); knife(cx); cx.restore(); }
  if (st.dead) {
    const t = Math.min(1, (now - G.deadAt) / 700);
    cx.save(); cx.translate(LX + t * 120, LY + r - 10 + t * 300); cx.rotate(t * 9); knife(cx); cx.restore();
    if (!RM) { cx.fillStyle = `rgba(226,49,43,${0.35 * (1 - t)})`; cx.fillRect(0, 0, W, H); }
  }
  // 남은 칼
  for (let k = 0; k < st.left - (st.fly || st.dead || st.wait > 0 ? 0 : 1); k++) {
    cx.save(); cx.translate(26, H - 24 - k * 26); cx.rotate(Math.PI / 2 * 0); cx.scale(0.28, 0.28); knife(cx); cx.restore();
  }
}

/* ---------- 시간 · 멈춤 ---------- */
function loop(t) {
  if (!G) return;
  const dt = Math.min(50, t - lastT); lastT = t;
  if (G.running && !G.paused) {
    // 칼 판정이 건너뛰지 않게 잘게 나눠 진행
    for (let left = dt; left > 0; left -= 10) {
      const ev = step(G.st, Math.min(10, left));
      if (ev === "stick" || ev === "clear") { G.stickAt = t; $("#score").textContent = G.st.score; haptic?.(ev === "clear" ? [15, 30, 15] : 6); }
      if (ev === "hit") return die(t);
    }
  }
  draw(t);
  raf = requestAnimationFrame(loop);
}
function pauseGame(why) {
  if (!G?.running || G.paused) return;
  G.paused = true; $("#pause").hidden = false;
  $("#pause span").textContent = why === "hidden" ? "큐 잡혔어요? 돌아오면 이어서 해요." : "멈춰 있어요.";
}
function resumeGame() { if (!G?.running) return; G.paused = false; $("#pause").hidden = true; lastT = performance.now(); }
function fire() { if (!G?.running || G.paused) return; throwKnife(G.st); }
function die(now) {
  if (!G.running) return;
  G.running = false; G.deadAt = now; cancelAnimationFrame(raf);
  haptic?.([40, 30, 40]);
  if (RM) { draw(now); return finish(); }
  const t0 = performance.now(); const f = (t) => { draw(t); if (t - t0 < 800) requestAnimationFrame(f); else finish(); }; requestAnimationFrame(f);
}

function start(seed) {
  G = { st: newState(seed), seed, running: true, paused: false, stickAt: -1e9, rival: G?.seed === seed ? G.rival : chal?.seed === seed ? chal.t : null };
  $("#score").textContent = "0"; $("#pause").hidden = true;
  show("play");
  cancelAnimationFrame(raf); lastT = performance.now(); raf = requestAnimationFrame(loop);
}
function finish() {
  const st = G.st;
  record(G.seed, st.score, st.s + 1);
  $("#resKind").textContent = G.seed === dailySeed() ? `오늘의 통나무 #${DAY}` : G.rival != null ? "도전장 통나무" : "새 통나무";
  const tot = $("#total");
  if (RM || !countUp) tot.textContent = st.score; else { tot.textContent = "0"; countUp(tot, st.score, { duration: 700 }); }
  $("#resStage").textContent = `${st.s + 1}단계에서 칼끼리 부딪혔어요`;
  const b = best(), lines = [];
  if (G.rival != null) lines.push(st.score > G.rival ? `도전장 ${G.rival}개를 넘었어요!` : st.score === G.rival ? `도전장 ${G.rival}개와 같아요.` : `도전장 ${G.rival}개에 ${G.rival - st.score}개 모자라요.`);
  lines.push(`내 최고 ${b.score}개(${b.stage}단계)`);
  $("#resLine").textContent = lines.join(" · ");
  $("#shareText").textContent = shareText(G.seed, st, G.rival);
  show("res");
}

function init() {
  window.__knife = () => G && { s: G.st.s, t: G.st.t, left: G.st.left, score: G.st.score, dead: G.st.dead, wait: G.st.wait, fly: G.st.fly, stuck: G.st.stuck.map((k) => k.a), running: G.running, paused: G.paused };
  if (RM) document.documentElement.classList.add("rm");
  setupCanvas();
  $("#todayNo").textContent = `#${DAY}`;
  const ts = todayScore(), b = best();
  $("#rec").textContent = `${ts != null ? `오늘의 통나무 ${ts.score}개 · ` : ""}내 최고 ${b.score}개`;
  const s = getParam("s"), t = Number(getParam("t"));
  if (s && validSeed(s)) {
    chal = { seed: s, t: getParam("t") != null && Number.isInteger(t) && t >= 0 && t <= 9999 ? t : null };
    const c = $("#chal"); c.hidden = false;
    c.innerHTML = `<b>도전장이 왔어요</b><span>${chal.t != null ? `친구는 이 통나무에 칼 ${chal.t}개를 꽂았어요.` : "친구가 보낸 통나무예요."} 회전이 똑같아요.</span><button class="kn-go" id="playChal" type="button"><span class="kn-go__k">도전</span><span>같은 통나무로 시작</span></button>`;
    $("#playChal").addEventListener("click", () => start(chal.seed));
  }
  $("#cv").addEventListener("pointerdown", (e) => { e.preventDefault(); fire(); });
  addEventListener("keydown", (e) => {
    if ($("#play").hidden || e.repeat) return;
    if (e.key === " " || e.key === "Enter" || e.key === "ArrowUp") { e.preventDefault(); fire(); }
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
    const url = `${ROOT_URL}knife/?s=${encodeURIComponent(G.seed)}&t=${G.st.score}`;
    const r = await share({ title: "칼 꽂기 도전장", text: $("#shareText").textContent, url });
    if (r === "shared") toast("보냈어요");
  });
  renderMoreSites($("#more"), "knife");
}
if (typeof document !== "undefined" && document.getElementById("cv")) init();
