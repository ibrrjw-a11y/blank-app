// 손맛 게임 공용 틀(2026-10-07). 첫 화면 · 놀이(캔버스) · 결과 · 도전장 · 오늘의 판 · 창 넘기면 멈춤 · 기록을 맡고,
// 게임마다 규칙(newState·step·act)과 그림(draw)만 넘긴다. 시간은 잘게(STEP ms) 나눠 진행해 빠른 물체도 판정을 건너뛰지 않음
import { $, share, toast, renderMoreSites, prefersReducedMotion, ROOT_URL, getParam, haptic, countUp, todayKey, dayNumber, createStore } from "./kit.js";

export const DAY = dayNumber("2026-01-01");
export const dailySeed = (day = DAY) => `d${day}`;
export const randomSeed = () => `r${Math.floor(Math.random() * 1e9).toString(36)}`;
export const validSeed = (s) => typeof s === "string" && /^[dr][0-9a-z]{1,12}$/.test(s);
const STEP = 8;

/* cfg: { slug, W, H, board("판"·"나무"…), unit("개"·"점"…), emoji, title,
 *        newState(seed), step(st, dt) → 사건 문자열|null (st.dead 면 끝), act(st, a) 입력 처리,
 *        draw(cx, st, now, rm), why(st) 끝난 이유, extra(st) 결과 한 줄(선택),
 *        keys: { 키: 동작 } (동작 = "tap" 같은 이름. keyup 은 동작+":up"), pointer: true 면 down/move/up 을 {type,x,y} 로 act 에 넘김,
 *        countdown: 이어 할 때 3초 셀지, ro: board 뒤 조사("으로"·"로"), ie: board 뒤 "이에요"·"예요" } */
export function runArcade(cfg) {
  const RM = prefersReducedMotion();
  const store = createStore(cfg.slug);
  let G = null, raf = 0, lastT = 0, chal = null, cv, cx;
  const best = () => store.get("best", 0);
  const todayScore = () => store.get(`d:${DAY}`, null);
  function record(seed, score) {
    if (score > best()) store.set("best", score);
    if (seed === dailySeed()) { const p = todayScore(); if (p == null || score > p) store.set(`d:${DAY}`, score); }
  }
  const kindOf = (seed, rival) => (seed === dailySeed() ? `오늘의 ${cfg.board} #${DAY}` : rival != null ? `도전장 ${cfg.board}` : `새 ${cfg.board}`);
  function shareText(seed, score, rival) {
    const vs = rival != null ? (score > rival ? ` · 도전장 ${rival}${cfg.unit} 넘음` : score === rival ? ` · 도전장 ${rival}${cfg.unit} 동점` : ` · 도전장보다 ${rival - score}${cfg.unit} 모자람`) : "";
    return `Guess What · ${cfg.title} (${seed === dailySeed() ? `오늘의 ${cfg.board} #${DAY}` : `같은 ${cfg.board} 도전`})\n${cfg.emoji} ${score}${cfg.unit}${vs}\n같은 ${cfg.board}${cfg.ro} 이겨 봐`;
  }
  const show = (v) => { for (const id of ["intro", "play", "res"]) $("#" + id).hidden = id !== v; scrollTo({ top: 0 }); };

  function setupCanvas() {
    cv = $("#cv"); const dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = cfg.W * dpr; cv.height = cfg.H * dpr; cx = cv.getContext("2d"); cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function loop(t) {
    if (!G) return;
    const dt = Math.min(100, t - lastT); lastT = t;
    if (G.running && !G.paused) {
      for (let left = dt; left > 0; left -= STEP) {
        const ev = cfg.step(G.st, Math.min(STEP, left));
        if (ev) { G.ev = { ev, t }; $("#score").textContent = G.st.score; if (ev !== "dead") haptic?.(6); }
        if (G.st.dead) return die(t);
      }
    }
    cfg.draw(cx, G.st, t, RM);
    raf = requestAnimationFrame(loop);
  }
  function pauseGame(why) {
    if (!G?.running || G.paused || !G.st.started) return;
    G.paused = true; $("#pause").hidden = false;
    $("#pause span").textContent = why === "hidden" ? "큐 잡혔어요? 돌아오면 이어서 해요." : "멈춰 있어요.";
  }
  function resumeGame() {
    if (!G?.running || !G.paused) return;
    $("#pause").hidden = true;
    const go = () => { G.paused = false; lastT = performance.now(); };
    if (!cfg.countdown) return go();
    const cd = $("#count"); let n = 3;
    const tick = () => { if (n <= 0) { cd.hidden = true; return go(); } cd.hidden = false; cd.textContent = n--; setTimeout(tick, 600); };
    tick();
  }
  function act(a) {
    if (!G?.running || G.paused) return;
    cfg.act(G.st, a);
    $("#score").textContent = G.st.score;
    if (G.st.dead) die(performance.now());
  }
  function die(now) {
    if (!G.running) return;
    G.running = false; G.deadAt = now; G.st.deadAt = now; cancelAnimationFrame(raf);
    haptic?.([40, 30, 40]);
    if (RM) { cfg.draw(cx, G.st, now, RM); return finish(); }
    const t0 = performance.now(); const f = (t) => { cfg.draw(cx, G.st, t, RM); if (t - t0 < 800) requestAnimationFrame(f); else finish(); }; requestAnimationFrame(f);
  }
  function start(seed) {
    G = { st: cfg.newState(seed), seed, running: true, paused: false, rival: G?.seed === seed ? G.rival : chal?.seed === seed ? chal.t : null };
    $("#score").textContent = "0"; $("#pause").hidden = true; $("#count").hidden = true;
    show("play");
    cancelAnimationFrame(raf); lastT = performance.now(); raf = requestAnimationFrame(loop);
  }
  function finish() {
    const st = G.st;
    record(G.seed, st.score);
    $("#resKind").textContent = kindOf(G.seed, G.rival);
    $("#resWhy").textContent = cfg.why(st);
    $("#resExtra").textContent = cfg.extra ? cfg.extra(st) : "";
    const tot = $("#total");
    if (RM || !countUp) tot.textContent = st.score; else { tot.textContent = "0"; countUp(tot, st.score, { duration: 700 }); }
    const lines = [];
    if (G.rival != null) lines.push(st.score > G.rival ? `도전장 기록 ${G.rival}${cfg.unit}, 넘었어요!` : st.score === G.rival ? `도전장 기록 ${G.rival}${cfg.unit}, 같아요.` : `도전장 기록 ${G.rival}${cfg.unit}, ${G.rival - st.score}${cfg.unit} 모자라요.`);
    lines.push(`내 최고 ${best()}${cfg.unit}`);
    $("#resLine").textContent = lines.join(" · ");
    $("#shareText").textContent = shareText(G.seed, st.score, G.rival);
    show("res");
  }

  window.__arcade = () => G && { st: G.st, running: G.running, paused: G.paused, seed: G.seed };
  if (RM) document.documentElement.classList.add("rm");
  setupCanvas();
  $("#todayNo").textContent = `#${DAY}`;
  const ts = todayScore();
  $("#rec").textContent = `${ts != null ? `오늘의 ${cfg.board} ${ts}${cfg.unit} · ` : ""}내 최고 ${best()}${cfg.unit}`;
  const s = getParam("s"), t = Number(getParam("t"));
  if (s && validSeed(s)) {
    chal = { seed: s, t: getParam("t") != null && Number.isInteger(t) && t >= 0 && t <= 9999 ? t : null };
    const c = $("#chal"); c.hidden = false;
    c.innerHTML = `<b>도전장이 왔어요</b><span>${chal.t != null ? `친구 기록 ${chal.t}${cfg.unit}.` : `친구가 보낸 ${cfg.board}${cfg.ie}.`} 똑같은 ${cfg.board}${cfg.ie}.</span><button class="ar-go" id="playChal" type="button"><span class="ar-go__k">도전</span><span>같은 ${cfg.board}${cfg.ro} 시작</span></button>`;
    $("#playChal").addEventListener("click", () => start(chal.seed));
  }
  // 입력
  const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * cfg.W, y: (e.clientY - r.top) / r.height * cfg.H }; };
  cv.addEventListener("pointerdown", (e) => { e.preventDefault(); cv.setPointerCapture?.(e.pointerId); act(cfg.pointer ? { type: "down", ...pos(e) } : "tap"); });
  if (cfg.pointer) {
    cv.addEventListener("pointermove", (e) => { if (G?.running && !G.paused) cfg.act(G.st, { type: "move", ...pos(e) }); });
    const up = (e) => act({ type: "up", ...pos(e) });
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  }
  addEventListener("keydown", (e) => {
    if ($("#play").hidden) return;
    const a = cfg.keys?.[e.key] ?? cfg.keys?.[e.key.toLowerCase()];
    if (a) { e.preventDefault(); if (!e.repeat) act(a); }
    else if (e.key === "Escape") G?.paused ? resumeGame() : pauseGame("button");
  });
  addEventListener("keyup", (e) => {
    if ($("#play").hidden) return;
    const a = cfg.keys?.[e.key] ?? cfg.keys?.[e.key.toLowerCase()];
    if (a) { e.preventDefault(); act(a + ":up"); }
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
    const url = `${ROOT_URL}${cfg.slug}/?s=${encodeURIComponent(G.seed)}&t=${G.st.score}`;
    const r = await share({ title: `${cfg.title} 도전장`, text: $("#shareText").textContent, url });
    if (r === "shared") toast("보냈어요");
  });
  renderMoreSites($("#more"), cfg.slug);
}
