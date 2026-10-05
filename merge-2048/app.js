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
  roundRect,
  fmt,
} from "../shared/kit.js";
import { Game, BoardView, autoMove, grainURL, SIZE } from "./board.js";

const store = createStore("merge-2048");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const num = (n) => fmt.num(n);

/* ---------- 나뭇결 텍스처 ---------- */
const grainTile = grainURL({ size: 300, lines: 46, seed: 11, knots: 1 });
const grainBoard = grainURL({ size: 360, lines: 90, seed: 5, knots: 3 });
document.documentElement.style.setProperty("--art-grain", grainTile ? `url(${grainTile})` : "none");
document.documentElement.style.setProperty("--art-grain-board", grainBoard ? `url(${grainBoard})` : "none");
const grainImg = new Image();
if (grainBoard) grainImg.src = grainBoard;

/* ---------- 소리: 나무끼리 부딪치는 '탁' ---------- */
let ac;
function knock(v = 4) {
  try {
    ac ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === "suspended") ac.resume();
    const t = ac.currentTime;
    const o = ac.createOscillator();
    const g = ac.createGain();
    const f = ac.createBiquadFilter();
    o.type = "triangle";
    const base = 900 - Math.min(11, Math.log2(v)) * 55; // 클수록 낮고 묵직하게
    o.frequency.setValueAtTime(base, t);
    o.frequency.exponentialRampToValueAtTime(base * 0.55, t + 0.06);
    f.type = "bandpass";
    f.frequency.value = base;
    f.Q.value = 3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(f).connect(g).connect(ac.destination);
    o.start(t);
    o.stop(t + 0.1);
  } catch {
    /* 소리 없이 진행 */
  }
}

/* ---------- 도전장 ---------- */
function readChallenge() {
  const raw = getParam("c");
  if (!raw) return null;
  const d = decodeState(raw.replace(/\/$/, ""));
  if (!d || typeof d !== "object") return null;
  const s = Math.round(Number(d.s));
  const m = Math.round(Number(d.m));
  if (!Number.isFinite(s) || s < 0 || s > 10000000) return null;
  return { name: String(d.n || "").replace(/[<>&"'\n\r]/g, "").trim().slice(0, 10), s, m: Number.isFinite(m) ? m : 0 };
}
const challenge = readChallenge();
const whoOf = (c) => (c.name ? `${c.name}의` : "친구의");
function renderChallenge() {
  if (!challenge) return;
  for (const id of ["#challengeIntro", "#challengePlay"]) {
    const el = $(id);
    el.hidden = false;
    el.innerHTML = `<span class="dare-slip__k">도전장</span><p><b>${esc(whoOf(challenge))} 기록 ${num(challenge.s)}점</b>, 깨볼래요?</p>`;
  }
}

/* ---------- 기록 ---------- */
const games = () => store.get("games", []);
function record(g) {
  if (!g.score) return;
  store.set("games", [...games(), { s: g.score, m: g.max, d: todayKey() }].slice(-40));
}

/* ---------- 첫 화면 ---------- */
function kineticHero() {
  const rows = { 1: "같은 숫자끼리", 2: "탁! 합쳐요" };
  let i = 0;
  for (const r of [1, 2]) {
    const el = document.querySelector(`.hero__row[data-row="${r}"]`);
    el.innerHTML = [...rows[r]]
      .map((ch) => (ch === " " ? `<span class="sp"> </span>` : `<span class="kt${r === 2 && i < 99 && "탁!".includes(ch) ? " kt--knock" : ""}" style="--i:${i++}">${ch}</span>`))
      .join("");
  }
  $("#hero").classList.add("is-in");
}

let demo = null;
function startDemo() {
  stopDemo();
  const view = new BoardView($("#demoBoard"));
  view.el.classList.add("tray--demo");
  const g = new Game();
  // 빈 판으로 시작하면 첫 화면이 텅 비어 보인다: 몇 수 미리 둔 판에서 시연을 시작
  const warm = (n) => {
    for (let k = 0; k < n; k++) {
      const d = autoMove(g);
      if (!d) break;
      g.move(d);
    }
  };
  warm(16);
  view.bind(g);
  view.sync(g);
  if (prefersReducedMotion()) {
    for (let k = 0; k < 40; k++) {
      const d = autoMove(g);
      if (!d) break;
      g.move(d);
    }
    view.sync(g, { pop: false });
    demo = { stop() {} };
    return;
  }
  const knockEls = document.querySelectorAll(".kt--knock");
  let timer;
  let stopped = false;
  const step = () => {
    if (stopped) return;
    if (document.hidden) {
      timer = setTimeout(step, 600);
      return;
    }
    const d = autoMove(g);
    if (!d || g.max >= 256) {
      timer = setTimeout(() => {
        g.reset();
        warm(16);
        view.sync(g);
        timer = setTimeout(step, 700);
      }, 1400);
      return;
    }
    const res = g.move(d);
    view.apply(res);
    if (res.merges?.length) knockEls.forEach((el) => pulse(el, "is-knock"));
    timer = setTimeout(step, 360);
  };
  timer = setTimeout(step, 900);
  demo = {
    stop() {
      stopped = true;
      clearTimeout(timer);
    },
  };
}
function stopDemo() {
  demo?.stop();
  demo = null;
}

function pulse(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

function enterIntro() {
  showView("intro");
  document.body.classList.remove("is-playing");
  const save = store.get("save");
  const live = save && !save.over && save.score >= 0 && Array.isArray(save.grid);
  $("#startWord").textContent = live ? "이어" : "시작";
  $("#startLabel").textContent = live ? "하던 판 이어하기" : "새 판 깔기";
  const best = store.get("best", 0);
  $("#startSub").textContent = live ? `${num(save.score)}점에서 멈춰 있어요` : best ? `내 최고 ${num(best)}점` : "스와이프나 방향키로 밀어요";
  $("#fresh").hidden = !live;
  startDemo();
}

/* ---------- 게임 ---------- */
const S = { game: null, view: null, prev: null, undoUsed: false, keepGoing: false, wonShown: false };

function setupPlay() {
  S.view = new BoardView($("#board"));
  const board = $("#board");
  let sx = 0;
  let sy = 0;
  let id = null;
  board.addEventListener("pointerdown", (e) => {
    id = e.pointerId;
    sx = e.clientX;
    sy = e.clientY;
    board.setPointerCapture?.(id);
    e.preventDefault();
  });
  const end = (e) => {
    if (id !== e.pointerId) return;
    id = null;
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  };
  board.addEventListener("pointerup", end);
  board.addEventListener("pointercancel", () => (id = null));
  const keys = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", a: "left", d: "right", w: "up", s: "down" };
  document.addEventListener("keydown", (e) => {
    if ($(".play").hidden || e.target.closest("input") || e.metaKey || e.ctrlKey) return;
    const d = keys[e.key];
    if (!d) return;
    e.preventDefault();
    move(d);
  });
}

function enterPlay(fresh = false) {
  stopDemo();
  showView("play");
  document.body.classList.add("is-playing");
  const save = store.get("save");
  S.game = new Game();
  if (!fresh && save && !save.over && Array.isArray(save.grid) && save.grid.length === SIZE) {
    S.game.load(save.grid, save.score || 0);
    S.prev = save.prev || null;
    S.undoUsed = !!save.undoUsed;
    S.keepGoing = !!save.keepGoing;
    S.wonShown = !!save.keepGoing || S.game.max >= 2048;
  } else {
    if (save && !save.over && save.score) record({ score: save.score, max: Math.max(...save.grid.flat()) });
    S.prev = null;
    S.undoUsed = false;
    S.keepGoing = false;
    S.wonShown = false;
    persist();
  }
  S.view.bind(S.game);
  S.view.sync(S.game);
  $("#endcard").hidden = true;
  updateHud();
  renderLedger();
  if (S.game.over) showEnd("over");
}

function persist() {
  const g = S.game;
  store.set("save", { grid: g.toGrid(), score: g.score, prev: S.prev, undoUsed: S.undoUsed, keepGoing: S.keepGoing, over: g.over });
}

function updateHud(gained = 0) {
  const g = S.game;
  $("#score").textContent = num(g.score);
  const best = Math.max(store.get("best", 0), g.score);
  if (best > store.get("best", 0)) store.set("best", best);
  $("#best").textContent = num(best);
  if (gained) {
    const p = $("#plus");
    p.textContent = `+${gained}`;
    pulse(p, "is-on");
  }
  const u = $("#undo");
  u.disabled = S.undoUsed || !S.prev || g.over;
  $("#undoLeft").textContent = S.undoUsed ? "다 씀" : "1번";
}

function move(dir) {
  const g = S.game;
  if (!g || g.over || !$("#endcard").hidden) return;
  const before = { grid: g.toGrid(), score: g.score };
  const res = g.move(dir);
  S.view.apply(res);
  if (!res.moved) {
    haptic(4);
    return;
  }
  S.prev = S.undoUsed ? null : before;
  if (res.merges.length) {
    const big = res.merges.reduce((m, t) => Math.max(m, t.v), 0);
    setTimeout(() => knock(big), 80);
    haptic(big >= 128 ? [10, 20, 14] : 8);
  }
  updateHud(res.gained);
  persist();
  if (g.max >= 2048 && !S.wonShown) {
    S.wonShown = true;
    setTimeout(() => showEnd("won"), 420);
  } else if (g.over) {
    record(g);
    persist();
    setTimeout(() => showEnd("over"), 520);
  }
}

function undo() {
  if (S.undoUsed || !S.prev) return;
  S.game.load(S.prev.grid, S.prev.score);
  S.undoUsed = true;
  S.prev = null;
  S.view.sync(S.game, { pop: false });
  pulse($("#board"), "is-undo");
  updateHud();
  persist();
  toast("한 수 물렀어요. 이번 판엔 이제 못 물러요");
}

let newArmed = 0;
function newGame() {
  if (S.game && S.game.score > 0 && !S.game.over && Date.now() - newArmed > 2500) {
    newArmed = Date.now();
    toast("한 번 더 누르면 지금 판을 접고 새로 깔아요");
    return;
  }
  newArmed = 0;
  enterPlay(true);
}

/* ---------- 끝 / 2048 완성 ---------- */
function showEnd(kind) {
  const g = S.game;
  const best = store.get("best", 0);
  const card = $("#endcard");
  let vs = "";
  if (challenge) {
    const diff = g.score - challenge.s;
    vs = `<p class="endcard__vs">${esc(whoOf(challenge))} ${num(challenge.s)}점 · ${diff > 0 ? `<b>${num(diff)}점 앞섰어요</b>` : diff === 0 ? "<b>똑같아요</b>" : `${num(-diff)}점 모자라요`}</p>`;
  }
  card.innerHTML = `
    <div class="endcard__box">
      <p class="endcard__k">${kind === "won" ? "완성" : "더 밀 곳이 없어요"}</p>
      <p class="endcard__big">${kind === "won" ? "2048" : num(g.score)}<small>${kind === "won" ? "" : "점"}</small></p>
      <p class="endcard__sub">${kind === "won" ? `지금 ${num(g.score)}점 · 계속 밀어서 4096도 가능해요` : `가장 큰 나무 ${g.max} · 내 최고 ${num(best)}점${g.score >= best ? " (갱신)" : ""}`}</p>
      ${vs}
      <label class="endcard__name"><span>도전장에 쓸 이름</span><input class="input" id="myName" maxlength="10" placeholder="예: 민지" autocomplete="nickname" /></label>
      <div class="endcard__btns">
        <button class="peg peg--hot" id="dare" type="button"><span>도전장 보내기</span></button>
        <button class="peg" id="endPhoto" type="button"><span>판 사진</span></button>
      </div>
      <button class="woodbtn woodbtn--sm" id="endNext" type="button">
        <span class="woodbtn__tile"><b>${kind === "won" ? "계속" : "새 판"}</b></span>
        <span class="woodbtn__txt"><b>${kind === "won" ? "계속 밀기" : "새 판 깔기"}</b></span>
      </button>
    </div>`;
  card.hidden = false;
  $("#myName").value = store.get("name", "");
  $("#dare").onclick = () => sendDare();
  $("#endPhoto").onclick = (e) => savePhoto(e.currentTarget);
  $("#endNext").onclick = () =>
    pressTile($("#endNext"), () => {
      if (kind === "won") {
        S.keepGoing = true;
        persist();
        card.hidden = true;
      } else enterPlay(true);
    });
  renderLedger();
  if (kind === "won") haptic([20, 40, 20, 40, 30]);
}

function renderLedger() {
  const list = games().slice(-6).reverse();
  const el = $("#ledger");
  if (!list.length) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const best = store.get("best", 0);
  el.innerHTML = `<p class="ledger__k"><span>지난 판 장부</span><span>최고 ${num(best)}점</span></p>
    <table><tbody>${list
      .map((r) => `<tr><td>${r.d.slice(5).replace("-", ".")}</td><td><span class="w w${Math.min(2048, r.m)}">${r.m}</span></td><td>${num(r.s)}점</td></tr>`)
      .join("")}</tbody></table>`;
}

function readName() {
  const name = ($("#myName")?.value || store.get("name", "")).replace(/[<>&"'\n\r]/g, "").trim().slice(0, 10);
  store.set("name", name);
  return name;
}

async function sendDare() {
  const g = S.game;
  const name = readName();
  const url = urlWith({ c: encodeState({ n: name, s: g.score, m: g.max }) });
  await share({ title: "2048 도전장", text: `2048 나무 타일 ${num(g.score)}점 (최대 ${g.max}). 깨볼래요?`, url });
}

/* ---------- 판 사진 (공유 이미지) ---------- */
function drawPhoto() {
  const g = S.game;
  const W = 600;
  const H = 760;
  const { canvas, ctx } = createCanvas(W, H, 2);
  const cs = getComputedStyle(document.documentElement);
  const v = (n) => cs.getPropertyValue(n).trim();
  // 바탕: 밝은 판재
  ctx.fillStyle = v("--art-pine");
  ctx.fillRect(0, 0, W, H);
  if (grainImg.complete && grainImg.naturalWidth) {
    ctx.globalAlpha = 0.8;
    for (let x = 0; x < W; x += 360) for (let y = 0; y < H; y += 360) ctx.drawImage(grainImg, x, y);
    ctx.globalAlpha = 1;
  }
  const font = v("--art-font") || "serif";
  ctx.fillStyle = v("--art-burn");
  ctx.font = `900 34px ${font}`;
  ctx.fillText("2048 나무 타일", 48, 78);
  ctx.font = `800 26px ${font}`;
  ctx.fillText(`${num(g.score)}점 · 최대 ${g.max}`, 48, 120);
  // 판 (호두나무 틀)
  const bx = 40;
  const by = 160;
  const bw = W - 80;
  ctx.fillStyle = v("--art-walnut");
  roundRect(ctx, bx, by, bw, bw, 24);
  ctx.fill();
  const gap = 14;
  const cell = (bw - gap * 5) / SIZE;
  const grid = g.toGrid();
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      const x = bx + gap + c * (cell + gap);
      const y = by + gap + r * (cell + gap);
      const val = grid[r][c];
      if (!val) {
        ctx.fillStyle = v("--art-slot");
        roundRect(ctx, x, y, cell, cell, 12);
        ctx.fill();
        continue;
      }
      const key = val > 2048 ? "big" : val;
      const depth = Math.min(10, 3 + Math.log2(val) * 0.6);
      ctx.fillStyle = v(`--art-w${key}-edge`) || "#000";
      roundRect(ctx, x, y + depth, cell, cell - depth, 12);
      ctx.fill();
      ctx.fillStyle = v(`--art-w${key}`);
      roundRect(ctx, x, y, cell, cell - depth, 12);
      ctx.fill();
      if (grainImg.complete && grainImg.naturalWidth) {
        ctx.save();
        roundRect(ctx, x, y, cell, cell - depth, 12);
        ctx.clip();
        ctx.globalAlpha = 0.7;
        ctx.drawImage(grainImg, (r * 70 + c * 40) % 200, (c * 90) % 200, cell, cell, x, y, cell, cell);
        ctx.restore();
      }
      const digits = String(val).length;
      ctx.fillStyle = val >= 128 ? (val >= 2048 ? v("--art-gold") : v("--art-inlay")) : v("--art-burn");
      ctx.font = `900 ${digits >= 4 ? 34 : digits === 3 ? 42 : 54}px ${font}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(val), x + cell / 2, y + (cell - depth) / 2 + 2);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
  ctx.fillStyle = v("--art-burn");
  ctx.font = `700 22px ${font}`;
  const d = new Date();
  const name = store.get("name", "");
  ctx.fillText(`${name ? `${name} · ` : ""}${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} · 깨볼래요?`, 48, H - 44);
  return canvas;
}

async function savePhoto(btn) {
  btn.classList.add("is-loading");
  try {
    readName();
    await shareImage(drawPhoto(), { filename: `2048-${S.game.score}.png`, title: "2048 나무 타일", text: `2048 ${num(S.game.score)}점` });
  } finally {
    btn.classList.remove("is-loading");
  }
}

/* ---------- 나무 타일 버튼: 눌렸다 탁 튄다 ---------- */
function pressTile(btn, fn) {
  if (btn.classList.contains("is-press")) return;
  btn.classList.add("is-press");
  knock(8);
  haptic(10);
  setTimeout(() => {
    btn.classList.remove("is-press");
    fn();
  }, prefersReducedMotion() ? 50 : 300);
}

function init() {
  renderMoreSites($("#more"));
  const moreTitle = $("#more .more-sites__title");
  if (moreTitle) moreTitle.textContent = "옆에 쌓인 상자";
  renderChallenge();
  kineticHero();
  setupPlay();
  $("#start").onclick = () => pressTile($("#start"), () => enterPlay(false));
  $("#fresh").onclick = () => {
    const save = store.get("save");
    if (save && !save.over && save.score) record({ score: save.score, max: Math.max(...save.grid.flat()) });
    store.remove("save");
    enterPlay(true);
  };
  $("#undo").onclick = undo;
  $("#newGame").onclick = newGame;
  $("#photo").onclick = (e) => savePhoto(e.currentTarget);
  $("#home").onclick = enterIntro;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && S.game) persist();
  });
  enterIntro();
}

init();

// 검증용
export const __test = {
  S,
  move,
  load(grid, score) {
    S.game.load(grid, score);
    S.view.sync(S.game, { pop: false });
    updateHud();
    persist();
  },
};
