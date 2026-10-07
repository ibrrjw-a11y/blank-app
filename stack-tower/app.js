import {
  $,
  createStore,
  toast,
  haptic,
  share,
  shareImage,
  encodeState,
  decodeState,
  urlWith,
  getParam,
  showView,
  renderMoreSites,
  todayKey,
  prefersReducedMotion,
  createCanvas,
} from "../shared/kit.js";
import { Tower, drawSilhouette, palette } from "./tower.js";

const store = createStore("stack-tower");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/* ---------- 소리 ---------- */
let ac;
function audio() {
  try {
    ac ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === "suspended") ac.resume();
    return ac;
  } catch {
    return null;
  }
}
function thud(freq = 90, dur = 0.16, gain = 0.12, type = "triangle") {
  const a = ac;
  if (!a || a.state !== "running") return;
  const t = a.currentTime;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq * 1.8, t);
  o.frequency.exponentialRampToValueAtTime(freq, t + dur * 0.6);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/* ---------- 도전장 ---------- */
function readChallenge() {
  const raw = getParam("c");
  if (!raw) return null;
  const d = decodeState(raw.replace(/\/$/, ""));
  if (!d || typeof d !== "object") return null;
  const f = Math.round(Number(d.f));
  if (!Number.isFinite(f) || f < 1 || f > 999) return null;
  return { name: String(d.n || "").replace(/[<>&"'\n\r]/g, "").trim().slice(0, 10), f };
}
const challenge = readChallenge();
const whoOf = (c) => (c.name ? `${c.name}의` : "친구의");

/* ---------- 기록 ---------- */
const runs = () => store.get("runs", []);
function streak(list = runs()) {
  const days = new Set(list.map((r) => r.d));
  let n = 0;
  const d = new Date();
  if (!days.has(todayKey(d))) d.setDate(d.getDate() - 1);
  while (days.has(todayKey(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/* ---------- 첫 화면 ---------- */
function kineticHero() {
  const rows = { 2: "떨어뜨려서", 1: "쌓아 올려요" };
  let i = 0;
  // 아래 줄이 먼저 떨어져 바닥이 되고, 윗줄이 그 위에 얹힌다
  [1, 2].forEach((r) => {
    const el = document.querySelector(`.hero__row[data-row="${r}"]`);
    el.innerHTML = [...rows[r]].map((ch) => (ch === " " ? `<span class="sp"> </span>` : `<span class="kt" style="--i:${i++}">${ch}</span>`)).join("");
  });
  $("#hero").classList.add("is-in");
}

let demo = null;
function startDemo() {
  stopDemo();
  const cv = $("#demoCv");
  demo = new Tower(cv, {
    demo: true,
    onFloor: (n) => {
      if (n === 13) setTimeout(() => demo && !demo.over && demo.reset(), 900);
    },
    onOver: () => setTimeout(() => demo?.reset(), 900),
  });
  if (prefersReducedMotion()) {
    for (let i = 0; i < 6; i++) {
      demo.cur.x = demo.top.x + (i % 2 ? 8 : 0);
      demo.drop();
      demo.falling.y = demo.topY;
      demo.update(0.016);
    }
    demo.draw();
  } else demo.start();
}
function stopDemo() {
  demo?.stop();
  demo = null;
}

function enterIntro() {
  endGame();
  document.body.classList.remove("is-playing");
  showView("intro");
  const best = store.get("best", 0);
  const st = streak();
  $("#startSub").textContent = best ? `내 최고 ${best}층${st > 1 ? ` · ${st}일 연속 출근` : ""}` : "탭 한 번에 블록 하나";
  startDemo();
}

function renderChallenge() {
  if (!challenge) return;
  const el = $("#challengeIntro");
  el.hidden = false;
  el.innerHTML = `<span class="dare-note__k">도전장</span><p><b>${esc(whoOf(challenge))} 기록 ${challenge.f}층</b>, 깨볼래요?</p>`;
}

/* ---------- 레버: 당겨지고 튕긴 뒤 시작 ---------- */
function pullLever(btn, fn) {
  if (btn.classList.contains("is-pulled")) return;
  audio();
  btn.classList.add("is-pulled");
  haptic(14);
  setTimeout(() => thud(160, 0.12, 0.08, "square"), 120);
  setTimeout(() => {
    btn.classList.remove("is-pulled");
    fn();
  }, prefersReducedMotion() ? 60 : 420);
}

/* ---------- 게임 ---------- */
let game = null;
let lastBlocks = [];
let hidden = false;

function startGame() {
  stopDemo();
  endGame();
  document.body.classList.add("is-playing");
  showView("play");
  $("#pause").hidden = true;
  $("#floorNum").textContent = "0";
  const best = store.get("best", 0);
  $("#hudBest").textContent = challenge ? `목표 ${challenge.f}층` : best ? `최고 ${best}층` : "";
  const hint = $("#hint");
  hint.classList.remove("is-gone");
  game = new Tower($("#cv"), {
    onFloor(n) {
      const el = $("#floorNum");
      el.textContent = String(n);
      el.classList.remove("is-bump");
      void el.offsetWidth;
      el.classList.add("is-bump");
      thud(70 + Math.min(n, 30) * 2);
      haptic(8);
      if (n === 1) hint.classList.add("is-gone");
      if (best && n === best + 1) toast("최고 기록 넘었어요!");
      if (challenge && n === challenge.f + 1) toast(`${whoOf(challenge)} 기록을 넘었어요!`);
    },
    onPerfect(s) {
      thud(520 + s * 60, 0.18, 0.06, "sine");
      haptic([6, 30, 6]);
    },
    onOver(floors) {
      thud(50, 0.4, 0.14);
      finish(floors);
    },
  });
  game.start();
}

function endGame() {
  game?.stop();
  game = null;
}

function drop() {
  if (!game || hidden) return;
  audio();
  game.drop();
}

let lastFog = { ok: 0, try: 0 };
function finish(floors) {
  if (!game) return;
  lastFog = { ok: game.fogOk || 0, try: game.fogTry || 0 };
  lastBlocks = game.blocks.map((b) => ({ x: b.x, w: b.w, y: b.y }));
  const prevBest = store.get("best", 0);
  const list = [...runs(), { f: floors, d: todayKey(), at: Date.now() }].slice(-60);
  store.set("runs", list);
  store.set("tower", lastBlocks);
  const isBest = floors > prevBest;
  if (isBest) store.set("best", floors);
  setTimeout(() => {
    endGame();
    document.body.classList.remove("is-playing");
    showView("result");
    renderResult({ floors, isBest, prevBest });
  }, 400);
}

/* ---------- 결과: 현장 일지 ---------- */
function renderResult({ floors, isBest, prevBest }) {
  const best = Math.max(prevBest, floors);
  const list = runs();
  const today = list.filter((r) => r.d === todayKey()).length;
  const st = streak(list);
  const recent = list.slice(-10);
  const d = new Date();
  let vs = "";
  if (challenge) {
    const diff = floors - challenge.f;
    vs = `<div class="log__vs ${diff > 0 ? "is-win" : ""}">
      <span>도전장</span><p>${esc(whoOf(challenge))} ${challenge.f}층 · 나 ${floors}층</p>
      <b>${diff > 0 ? `${diff}층 더 높이! 깼어요` : diff === 0 ? "같은 높이예요. 한 층만 더!" : `${-diff}층 모자라요. 다시 올려볼까요?`}</b>
    </div>`;
  }
  const maxF = Math.max(1, ...recent.map((r) => r.f));
  $("#resultBody").innerHTML = `
  <article class="log">
    <header class="log__head"><span>작업 일지</span><span>${d.getMonth() + 1}/${d.getDate()} · ${today}번째 작업</span></header>
    <div class="log__main">
      <p class="log__floors"><b id="resNum">${floors}</b><span>층</span></p>
      <p class="log__stamp ${isBest ? "is-best" : ""}">${isBest ? "최고 기록" : floors >= prevBest - 2 ? "아깝다" : "작업 종료"}</p>
    </div>
    <dl class="log__grid">
      <div><dt>내 최고</dt><dd>${best}층</dd></div>
      <div><dt>오늘</dt><dd>${today}판</dd></div>
      <div><dt>연속 출근</dt><dd>${st}일</dd></div>
      <div><dt>안개 층</dt><dd>${lastFog.ok}/${lastFog.try}</dd></div>
    </dl>
    ${vs}
    <div class="log__bars" aria-label="최근 ${recent.length}판 층수">
      ${recent.map((r, i) => `<span class="${i === recent.length - 1 ? "is-last" : ""}" style="--h:${r.f / maxF}"><i>${r.f}</i></span>`).join("")}
    </div>
    <p class="log__cap">최근 ${recent.length}판 · 맨 오른쪽이 이번 판</p>
    <figure class="log__pic"><canvas id="silo"></canvas><figcaption>내 탑 실루엣</figcaption></figure>
  </article>
  <div class="res__actions">
    <button class="lever lever--again" id="again" type="button">
      <span class="lever__slot" aria-hidden="true"><span class="lever__arm"><i class="lever__knob"></i></span></span>
      <span class="lever__txt"><b>다시 쌓기</b><small>바로 크레인 가동</small></span>
    </button>
    <div class="dare">
      <label class="dare__name"><span>도전장에 쓸 이름</span><input class="input" id="myName" maxlength="10" placeholder="예: 민지" autocomplete="nickname" /></label>
      <div class="dare__btns">
        <button class="tagbtn" id="dare" type="button">도전장 보내기</button>
        <button class="tagbtn tagbtn--alt" id="img" type="button">실루엣 저장</button>
      </div>
    </div>
    <button class="linkbtn" id="home" type="button">처음 화면으로</button>
  </div>`;
  $("#myName").value = store.get("name", "");
  drawPreview(floors);
  $("#again").onclick = () => pullLever($("#again"), startGame);
  $("#home").onclick = enterIntro;
  $("#dare").onclick = () => sendDare(floors);
  $("#img").onclick = (e) => saveImage(floors, e.currentTarget);
  if (isBest && list.length > 1) haptic([10, 40, 10]);
}

function cardCanvas(floors, name) {
  const W = 540;
  const H = 760;
  const { canvas, ctx } = createCanvas(W, H, 2);
  const c = palette();
  const d = new Date();
  drawSilhouette(ctx, lastBlocks.length ? lastBlocks : store.get("tower", []), W, H, c, {
    floors,
    title: name ? `${name}의 탑` : "내가 쌓은 탑",
    sub: `탑 쌓기 · ${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} · 깨볼래요?`,
  });
  return canvas;
}

function drawPreview(floors) {
  const el = $("#silo");
  const c = cardCanvas(floors, store.get("name", ""));
  el.width = c.width;
  el.height = c.height;
  el.getContext("2d").drawImage(c, 0, 0);
}

function readName() {
  const name = ($("#myName")?.value || "").replace(/[<>&"'\n\r]/g, "").trim().slice(0, 10);
  store.set("name", name);
  return name;
}

async function sendDare(floors) {
  const name = readName();
  const url = urlWith({ c: encodeState({ n: name, f: floors }) });
  await share({ title: "탑 쌓기 도전장", text: `탑 쌓기 ${floors}층 올렸어요. 깨볼래요?`, url });
}

async function saveImage(floors, btn) {
  btn.classList.add("is-loading");
  try {
    await shareImage(cardCanvas(floors, readName()), { filename: `stack-tower-${floors}.png`, title: "탑 쌓기", text: `탑 쌓기 ${floors}층` });
  } finally {
    btn.classList.remove("is-loading");
  }
}

/* ---------- 탭 숨김 → 일시정지 ---------- */
function onVisibility() {
  if (document.hidden) {
    hidden = true;
    demo?.stop();
    if (game && game.running) {
      game.stop();
      $("#pause").hidden = false;
    }
  } else {
    hidden = false;
    if (demo && !$("#intro").hidden) demo.start();
  }
}

function init() {
  renderMoreSites($("#more"));
  const moreTitle = $("#more .more-sites__title");
  if (moreTitle) moreTitle.textContent = "인근 현장 안내";
  renderChallenge();
  kineticHero();
  $("#start").onclick = () => pullLever($("#start"), startGame);
  $("#quit").onclick = (e) => {
    e.stopPropagation();
    enterIntro();
  };
  $("#pause").addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    e.preventDefault();
    $("#pause").hidden = true;
    game?.start();
  });
  const stage = $("#stage");
  stage.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    e.preventDefault();
    drop();
  });
  document.addEventListener("keydown", (e) => {
    if (!game || (e.key !== " " && e.key !== "Enter" && e.key !== "ArrowDown")) return;
    if (e.target.closest("input")) return;
    e.preventDefault();
    drop();
  });
  document.addEventListener("visibilitychange", onVisibility);
// 롤 큐: 다른 창(게임 클라이언트)으로 넘어가도 멈춤(2026-10-07)
addEventListener("blur", () => { if (game && game.running) { game.stop(); $("#pause").hidden = false; } });
  let rt;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      game?.resize();
      demo?.resize();
    }, 120);
  });
  enterIntro();
}

init();

// 검증용
export const __test = {
  get game() {
    return game;
  },
  get demo() {
    return demo;
  },
  start: startGame,
  // n층까지 자동으로 쌓기 (offset 만큼 어긋나게)
  build(n, offsets = [0]) {
    const g = game;
    for (let i = 0; i < n && !g.over; i++) {
      g.cur.x = g.top.x + offsets[i % offsets.length];
      g.drop();
      g.falling.y = g.topY + 0.1;
      g.falling.vy = -10;
      g.update(0.016);
    }
  },
  miss() {
    const g = game;
    g.cur.x = g.top.x + g.top.w + 20;
    g.drop();
  },
};
