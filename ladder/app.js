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
  createCanvas,
  CANVAS_FONT,
  prefersReducedMotion,
  shuffle,
  sleep,
} from "../shared/kit.js";
import { CHALK, PATH_COLORS, genRungs, findSlot, tracePath, geom, chalkStroke, chalkText, Dust, seeded } from "./board.js";
import { startIntro } from "./intro.js";

const MIN = 2;
const MAX = 12;
const NAME_MAX = 8;
const RES_MAX = 10;
const store = createStore("ladder");
const PEN = '"Gaegu", "Nanum Pen Script", ' + CANVAS_FONT;

const rnd = () => {
  try {
    return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
  } catch {
    return Math.random();
  }
};

/* ---------- 날짜 (칠판 오른쪽 위) ---------- */
(() => {
  const d = new Date();
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  document.querySelectorAll(".duty__date").forEach((el) => (el.textContent = `${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}요일`));
})();

renderMoreSites($("#more"));
// 하단 다른 놀이: 칠판 오른쪽 아래 구석에 분필로 적어 둔 메모
(() => {
  const title = $("#more .more-sites__title");
  if (title) title.textContent = "쉬는 시간에 할 것";
})();

/* ---------- 설정 ---------- */
function sanitize(s) {
  if (!s || !Array.isArray(s.names) || !Array.isArray(s.results)) return null;
  const n = Math.min(MAX, Math.max(MIN, s.names.length));
  const names = Array.from({ length: n }, (_, i) => String(s.names[i] ?? "").slice(0, NAME_MAX));
  const results = Array.from({ length: n }, (_, i) => String(s.results[i] ?? "꽝").slice(0, RES_MAX));
  return { names, results };
}

let setup = sanitize(store.get("current")) || { names: ["", "", "", ""], results: ["당첨", "꽝", "꽝", "꽝"] };
const saveSetup = () => store.set("current", setup);
const nameOf = (i) => setup.names[i].trim() || `${i + 1}번`;
const resOf = (i) => setup.results[i].trim() || "꽝";

const QUICK = [
  { label: "당첨 1개", fill: (n) => Array.from({ length: n }, (_, i) => (i === 0 ? "당첨" : "꽝")) },
  { label: "커피 쏘기", fill: (n) => Array.from({ length: n }, (_, i) => (i === 0 ? "커피 쏘기" : "통과")) },
  { label: "순서 정하기", fill: (n) => Array.from({ length: n }, (_, i) => `${i + 1}번`) },
  { label: "청소 당번 2명", fill: (n) => Array.from({ length: n }, (_, i) => (i < Math.min(2, n - 1) ? "청소" : "통과")) },
  { label: "두 팀", fill: (n) => Array.from({ length: n }, (_, i) => (i % 2 ? "B팀" : "A팀")) },
];

function renderSetup(focusLast = false) {
  const n = setup.names.length;
  $("#nOut").textContent = n;
  $("#minus").disabled = n <= MIN;
  $("#plus").disabled = n >= MAX;
  const names = $("#names");
  const results = $("#results");
  names.innerHTML = "";
  results.innerHTML = "";
  setup.names.forEach((v, i) => {
    const d = document.createElement("div");
    d.className = "mag";
    d.style.setProperty("--_mc", PATH_COLORS[i % PATH_COLORS.length]);
    d.style.animationDelay = `${Math.min(i, 8) * 30}ms`;
    d.innerHTML = `<input maxlength="${NAME_MAX}" aria-label="${i + 1}번 이름" placeholder="${i + 1}번" enterkeyhint="next" />`;
    const inp = d.querySelector("input");
    inp.value = v;
    inp.addEventListener("input", () => {
      setup.names[i] = inp.value.slice(0, NAME_MAX);
      saveSetup();
    });
    names.appendChild(d);
  });
  setup.results.forEach((v, i) => {
    const d = document.createElement("div");
    d.className = "slip";
    d.style.animationDelay = `${Math.min(i, 8) * 30}ms`;
    d.innerHTML = `<input maxlength="${RES_MAX}" aria-label="결과 쪽지 ${i + 1}" placeholder="꽝" enterkeyhint="next" />`;
    const inp = d.querySelector("input");
    inp.value = v;
    inp.addEventListener("input", () => {
      setup.results[i] = inp.value.slice(0, RES_MAX);
      saveSetup();
    });
    results.appendChild(d);
  });
  if (focusLast) names.lastElementChild?.querySelector("input")?.focus({ preventScroll: true });
}

function resize(n) {
  n = Math.min(MAX, Math.max(MIN, n));
  while (setup.names.length < n) {
    setup.names.push("");
    setup.results.push("꽝");
  }
  setup.names.length = n;
  setup.results.length = n;
  saveSetup();
  renderSetup();
  const o = $("#nOut");
  o.classList.remove("is-bump");
  void o.offsetWidth;
  o.classList.add("is-bump");
  haptic(6);
}
$("#minus").addEventListener("click", () => resize(setup.names.length - 1));
$("#plus").addEventListener("click", () => resize(setup.names.length + 1));

QUICK.forEach((q) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "qchip";
  b.textContent = q.label;
  b.addEventListener("click", () => {
    setup.results = q.fill(setup.names.length);
    saveSetup();
    renderSetup();
    haptic(8);
  });
  $("#quick").appendChild(b);
});

function renderSaved() {
  const list = store.get("saved", []);
  const box = $("#saved");
  box.innerHTML = "";
  if (!list.length) {
    box.innerHTML = `<p class="pinned__empty">자주 하는 멤버를 저장하면 다음엔 한 번에 불러와요.</p>`;
    return;
  }
  list.forEach((s, idx) => {
    const row = document.createElement("div");
    row.className = "pinned__row";
    const shown = s.names.map((x, i) => x.trim() || `${i + 1}번`);
    row.innerHTML = `<button class="pinned__load"></button><button class="pinned__x" aria-label="삭제">×</button>`;
    row.querySelector(".pinned__load").innerHTML = `${esc(shown.slice(0, 3).join(", "))}${shown.length > 3 ? ` 외 ${shown.length - 3}명` : ""} <small>· ${esc(s.results.filter((r) => r && r !== "꽝")[0] || "꽝")}</small>`;
    row.querySelector(".pinned__load").addEventListener("click", () => {
      setup = sanitize(s);
      saveSetup();
      renderSetup();
      toast("저장한 설정을 붙였어요");
    });
    row.querySelector(".pinned__x").addEventListener("click", () => {
      const l = store.get("saved", []);
      l.splice(idx, 1);
      store.set("saved", l);
      renderSaved();
    });
    box.appendChild(row);
  });
}

$("#saveSetup").addEventListener("click", () => {
  const key = JSON.stringify(setup);
  const list = store.get("saved", []).filter((s) => JSON.stringify({ names: s.names, results: s.results }) !== key);
  list.unshift({ names: [...setup.names], results: [...setup.results] });
  store.set("saved", list.slice(0, 8));
  renderSaved();
  toast("게시판에 붙여 뒀어요");
});

function renderLog() {
  const log = store.get("log", []);
  const el = $("#log");
  if (!log.length) {
    el.innerHTML = `<li class="pinned__empty">아직 탄 사다리가 없어요.</li>`;
    return;
  }
  el.innerHTML = log
    .map((l) => {
      const d = new Date(l.t);
      const time = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      const hits = l.pairs.filter(([, r]) => r !== "꽝" && r !== "통과");
      const show = (hits.length ? hits : l.pairs).slice(0, 3).map(([n, r]) => `${esc(n)} → ${esc(r)}`);
      return `<li><time>${time}</time>${show.join(", ")}${(hits.length || l.pairs.length) > 3 ? " …" : ""}</li>`;
    })
    .join("");
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/* ---------- 화면 전환 ---------- */
let intro = null;

function toSetup() {
  intro?.stop();
  intro = null;
  stopLoop();
  showView("setup");
  renderSetup();
  renderSaved();
  renderLog();
}

$("#start").addEventListener("click", async () => {
  haptic(12);
  await sleep(120);
  toSetup();
});
$("#back").addEventListener("click", () => toSetup());

/* ---------- 게임 ---------- */
const ladderEl = $("#ladder");
const baseCv = $("#baseCv");
const fxCv = $("#fxCv");
const baseCtx = baseCv.getContext("2d");
const fxCtx = fxCv.getContext("2d");
let G = null; // 기하
let game = null;
const dust = new Dust();
let loopRaf = 0;
let lastW = 0;
let lastT = 0;

function sizeCanvases() {
  const r = ladderEl.getBoundingClientRect();
  lastW = r.width;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  for (const c of [baseCv, fxCv]) {
    c.width = Math.round(r.width * dpr);
    c.height = Math.round(r.height * dpr);
  }
  baseCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (game) {
    // 두 줄로 엇갈린 이름표가 칠판 밖으로 나가지 않을 만큼 옆 여백을 둔다
    const n = game.n;
    let side = Math.max(28, Math.min(48, r.width / (n * 2)));
    const step = (r.width - side * 2) / (n - 1);
    if (step < 64) side = Math.max(side, Math.min(2 * step - 8, 84) / 2 + 8);
    G = geom(r.width, r.height, n, { top: 4, bottom: 4, side });
  }
}

$("#go").addEventListener("click", () => startGame());

function startGame() {
  const n = setup.names.length;
  const names = setup.names.map((_, i) => nameOf(i));
  const results = shuffle(
    setup.results.map((_, i) => resOf(i)),
    rnd
  );
  const seed = Math.floor(rnd() * 1e9);
  game = {
    n,
    names,
    results,
    base: genRungs(n, seeded(seed), n <= 3 ? 3 : 2.6),
    secret: [], // { a, y, dy, by }
    pending: null,
    pendingAt: 0,
    phase: "pass",
    turn: 0,
    traces: [], // { i, path, start, dur, done }
    revealed: new Set(),
    openEnds: new Set(),
    secretShowAt: 0,
  };
  intro?.stop();
  showView("game");
  $("#summary").hidden = true;
  sizeCanvases();
  buildCards();
  drawBase();
  clearFx();
  haptic(14);
  showCover();
  startLoop();
}

function allRungs() {
  return [...game.base, ...game.secret, ...(game.pending ? [game.pending] : [])];
}

function twoTier() {
  return G.step < 64;
}

function buildCards() {
  const names = $("#gNames");
  const flaps = $("#gFlaps");
  names.innerHTML = "";
  flaps.innerHTML = "";
  const two = twoTier();
  names.classList.toggle("is-two", two);
  flaps.classList.toggle("is-two", two);
  const w = two ? Math.min(2 * G.step - 8, 84) : Math.min(G.step - 6, 84);
  for (let i = 0; i < game.n; i++) {
    const b = document.createElement("button");
    b.className = `gmag${two && i % 2 ? " is-low" : ""}`;
    b.style.left = `${G.x(i)}px`;
    b.style.width = `${w}px`;
    b.style.setProperty("--_mc", PATH_COLORS[i % PATH_COLORS.length]);
    b.style.setProperty("--rot", `${(i % 3) - 1}deg`);
    b.innerHTML = `<span></span>`;
    b.querySelector("span").textContent = game.names[i];
    b.setAttribute("aria-label", `${game.names[i]} 사다리 타기`);
    b.addEventListener("click", () => runTrace(i));
    names.appendChild(b);

    const f = document.createElement("div");
    f.className = `gflap${two && i % 2 ? " is-low" : ""}`;
    f.style.left = `${G.x(i)}px`;
    f.style.width = `${w}px`;
    const res = game.results[i];
    f.innerHTML = `<span class="gflap__res${res !== "꽝" && res !== "통과" ? " is-hit" : ""}"></span><span class="gflap__paper">?</span>`;
    f.querySelector(".gflap__res").textContent = res;
    if (game.openEnds?.has(i)) f.classList.add("is-open");
    flaps.appendChild(f);
  }
  updateCardState();
}

function updateCardState() {
  const canRun = game.phase === "reveal";
  document.querySelectorAll(".gmag").forEach((b, i) => {
    b.disabled = !canRun || game.revealed.has(i) || game.traces.some((t) => t.i === i);
    b.classList.toggle("is-done", game.revealed.has(i));
  });
}

/* 그리기 */
function drawBase(secretProgress = null) {
  const r = ladderEl.getBoundingClientRect();
  baseCtx.clearRect(0, 0, r.width, r.height);
  for (let i = 0; i < game.n; i++) {
    chalkStroke(baseCtx, [[G.x(i), G.y(0)], [G.x(i), G.y(1)]], { seed: i + 1, width: 3, wobble: 0.9 });
  }
  game.base.forEach((rg, k) => {
    chalkStroke(baseCtx, [[G.x(rg.a), G.y(rg.y)], [G.x(rg.a + 1), G.y(rg.y + rg.dy)]], { seed: 40 + k, width: 3, wobble: 0.8 });
  });
  // 몰래 그은 다리: 공개 전엔 안 보인다
  if (game.phase === "reveal" || game.phase === "done" || game.phase === "unveil") {
    game.secret.forEach((rg, k) => {
      const p = secretProgress ? secretProgress[k] : 1;
      if (p > 0) chalkStroke(baseCtx, [[G.x(rg.a), G.y(rg.y)], [G.x(rg.a + 1), G.y(rg.y + rg.dy)]], { seed: 90 + k, width: 3.6, color: CHALK.yellow, progress: p, wobble: 1 });
    });
  }
}

function clearFx() {
  const r = ladderEl.getBoundingClientRect();
  fxCtx.clearRect(0, 0, r.width, r.height);
}

function startLoop() {
  stopLoop();
  lastT = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    tick(now, dt);
    loopRaf = requestAnimationFrame(frame);
  };
  loopRaf = requestAnimationFrame(frame);
}
function stopLoop() {
  cancelAnimationFrame(loopRaf);
  loopRaf = 0;
}

function tick(now, dt) {
  if (!game) return;
  const r = ladderEl.getBoundingClientRect();
  fxCtx.clearRect(0, 0, r.width, r.height);

  // 내가 지금 긋는 다리
  if (game.phase === "draw" && game.pending) {
    const p = Math.min(1, (now - game.pendingAt) / 280);
    const rg = game.pending;
    const tip = chalkStroke(fxCtx, [[G.x(rg.a), G.y(rg.y)], [G.x(rg.a + 1), G.y(rg.y + rg.dy)]], { seed: 300 + game.turn, width: 3.8, color: CHALK.yellow, progress: p, wobble: 1 });
    if (tip && p < 1) dust.emit(tip[0], tip[1], CHALK.yellow, 2);
  }

  // 공개: 몰래 그은 다리가 하나씩 나타난다
  if (game.phase === "unveil") {
    const el = now - game.secretShowAt;
    const prog = game.secret.map((_, k) => Math.min(1, Math.max(0, (el - 400 - k * 380) / 320)));
    drawBase(prog);
    game.secret.forEach((rg, k) => {
      const p = prog[k];
      if (p > 0 && p < 1) dust.emit(G.x(rg.a) + (G.x(rg.a + 1) - G.x(rg.a)) * p, G.y(rg.y + rg.dy * p), CHALK.yellow, 2);
    });
    if (el > 400 + game.secret.length * 380 + 500) {
      game.phase = "reveal";
      drawBase();
      setBar();
      updateCardState();
    }
  }

  // 분필 길
  for (const tr of game.traces) {
    const p = tr.done ? 1 : Math.min(1, (now - tr.start) / tr.dur);
    const pts = tr.path.pts.map(([rail, v]) => [G.x(rail), G.y(v)]);
    const color = PATH_COLORS[tr.i % PATH_COLORS.length];
    const tip = chalkStroke(fxCtx, pts, { seed: 500 + tr.i, width: 4.6, color, progress: p, wobble: 1.4 });
    if (!tr.done && tip) {
      dust.emit(tip[0], tip[1], color, 2);
      if (p >= 1) {
        tr.done = true;
        openFlap(tr);
      }
    }
  }

  dust.step(dt);
  dust.draw(fxCtx);
}

/* ---------- 몰래 긋기 ---------- */
function showCover() {
  const cover = $("#cover");
  const all = game.turn >= game.n;
  $("#coverName").textContent = all ? "다 그었어요!" : game.names[game.turn];
  $("#coverName").parentElement.lastChild.textContent = all ? "" : " 차례";
  $("#coverDesc").textContent = all
    ? `몰래 그은 다리 ${game.secret.length}개. 이제 폰을 가운데 두고 같이 봐요`
    : game.turn === 0
      ? `${game.names[0]}부터 시작해요. 다른 사람은 고개 돌려요`
      : `폰을 ${game.names[game.turn]}에게 넘겨요. 다른 사람은 고개 돌려요`;
  $("#coverGo span").textContent = all ? "공개하러 가기" : "내가 몰래 그을게요";
  $("#coverSkip").hidden = all;
  $("#coverAll").hidden = all;
  cover.hidden = false;
  cover.classList.remove("is-swap");
  void cover.offsetWidth;
  cover.classList.add("is-swap");
  game.phase = "pass";
  $("#status").textContent = all ? "공개 준비" : `몰래 긋기 ${game.turn + 1}/${game.n}`;
  setBar();
  updateCardState();
}

$("#coverGo").addEventListener("click", () => {
  if (!game) return;
  haptic(10);
  if (game.turn >= game.n) return unveil();
  $("#cover").hidden = true;
  game.phase = "draw";
  game.pending = null;
  setBar();
});
$("#coverSkip").addEventListener("click", () => {
  if (!game) return;
  game.turn++;
  showCover();
});
$("#coverAll").addEventListener("click", () => {
  if (!game) return;
  game.turn = game.n;
  unveil();
});

fxCv.addEventListener("pointerup", (e) => {
  if (!game || game.phase !== "draw") return;
  const r = fxCv.getBoundingClientRect();
  const x = e.clientX - r.left;
  const y = e.clientY - r.top;
  let a = Math.floor(G.railAt(x));
  a = Math.min(game.n - 2, Math.max(0, a));
  const v = G.vAt(y);
  const dy = (rnd() - 0.5) * 0.02;
  const others = [...game.base, ...game.secret];
  const slot = findSlot(others, a, Math.min(0.9, Math.max(0.1, v)), dy);
  if (slot == null) {
    toast("여긴 자리가 없어요. 조금 위나 아래를 눌러요");
    haptic([8, 40, 8]);
    return;
  }
  game.pending = { a, y: slot, dy, by: game.turn };
  game.pendingAt = performance.now();
  haptic(10);
  const tip = $("#tapTip");
  tip.hidden = false;
  tip.textContent = ["쓱-", "몰래 한 줄", "여기다!", "슥슥"][game.turn % 4];
  tip.style.left = `${(G.x(a) + G.x(a + 1)) / 2}px`;
  tip.style.top = `${G.y(slot)}px`;
  tip.style.animation = "none";
  void tip.offsetWidth;
  tip.style.animation = "";
  setBar();
});

function confirmRung() {
  if (!game.pending) return;
  game.secret.push(game.pending);
  game.pending = null;
  $("#tapTip").hidden = true;
  game.turn++;
  haptic(12);
  showCover();
}

async function unveil() {
  $("#cover").hidden = true;
  $("#tapTip").hidden = true;
  game.phase = game.secret.length ? "unveil" : "reveal";
  game.secretShowAt = performance.now();
  $("#status").textContent = game.secret.length ? `몰래 그은 다리 ${game.secret.length}개!` : "누구부터 볼까요?";
  if (!game.secret.length) drawBase();
  setBar();
  updateCardState();
}

/* ---------- 공개 ---------- */
function runTrace(i, fast = false) {
  if (!game || game.phase !== "reveal") return;
  if (game.revealed.has(i) || game.traces.some((t) => t.i === i)) return;
  const path = tracePath(game.n, allRungs(), i);
  const pts = path.pts.map(([rail, v]) => [G.x(rail), G.y(v)]);
  let len = 0;
  for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
  const speed = prefersReducedMotion() ? 6000 : fast ? 1100 : 560;
  game.traces.push({ i, path, start: performance.now(), dur: Math.max(500, (len / speed) * 1000), done: false });
  const mag = document.querySelectorAll(".gmag")[i];
  mag?.classList.add("is-running");
  haptic(8);
  updateCardState();
  $("#status").textContent = `${game.names[i]} 내려가는 중…`;
}

function openFlap(tr) {
  const end = tr.path.end;
  const flap = document.querySelectorAll(".gflap")[end];
  flap?.classList.add("is-open");
  game.openEnds.add(end);
  document.querySelectorAll(".gmag")[tr.i]?.classList.remove("is-running");
  game.revealed.add(tr.i);
  const res = game.results[end];
  const hit = res !== "꽝" && res !== "통과";
  haptic(hit ? [20, 40, 30] : 10);
  $("#status").textContent = `${game.names[tr.i]} → ${res}${hit ? "!" : ""}`;
  updateCardState();
  if (game.revealed.size === game.n) finish();
  else setBar();
}

function revealAll() {
  if (!game || game.phase !== "reveal") return;
  const left = [...Array(game.n).keys()].filter((i) => !game.revealed.has(i) && !game.traces.some((t) => t.i === i));
  left.forEach((i, k) => setTimeout(() => runTrace(i, true), k * 260));
}

function setBar() {
  const bar = $("#gameBar");
  bar.innerHTML = "";
  if (!game) return;
  if (game.phase === "draw") {
    bar.innerHTML = game.pending
      ? `<p class="game-bar__hint">여기 맞아요? <b>가리면</b> 다른 사람은 못 봐요</p>
         <button class="chalk-btn" id="redo">다시 긋기</button>
         <button class="chalk-btn chalk-btn--yellow" id="done">됐어요, 가리기</button>`
      : `<p class="game-bar__hint"><b>두 줄 사이를 톡</b> 치면 다리가 하나 생겨요</p>
         <button class="chalk-btn" id="skipDraw">안 그을래요</button>`;
    bar.querySelector("#redo")?.addEventListener("click", () => {
      game.pending = null;
      $("#tapTip").hidden = true;
      setBar();
    });
    bar.querySelector("#done")?.addEventListener("click", confirmRung);
    bar.querySelector("#skipDraw")?.addEventListener("click", () => {
      game.turn++;
      showCover();
    });
    ladderEl.classList.add("is-drawing");
    return;
  }
  ladderEl.classList.remove("is-drawing");
  if (game.phase === "reveal") {
    bar.innerHTML = `<p class="game-bar__hint"><b>이름 자석</b>을 누르면 한 명씩 내려가요</p>
      <button class="chalk-btn chalk-btn--yellow" id="all">전체 공개</button>`;
    bar.querySelector("#all").addEventListener("click", revealAll);
  }
  if (game.phase === "unveil") {
    bar.innerHTML = `<p class="game-bar__hint">노란 분필이 <b>몰래 그은 다리</b>예요</p>`;
  }
}

async function finish() {
  game.phase = "done";
  setBar();
  const pairs = game.names.map((nm, i) => [nm, game.results[tracePath(game.n, allRungs(), i).end]]);
  game.pairs = pairs;
  const log = store.get("log", []);
  log.unshift({ t: Date.now(), pairs });
  store.set("log", log.slice(0, 12));
  await sleep(700);
  $("#status").textContent = "결과 나왔어요";
  $("#sumList").innerHTML = pairs
    .map(([nm, r]) => {
      const hit = r !== "꽝" && r !== "통과";
      return `<li>${esc(nm)} <i>→</i> ${hit ? `<b>${esc(r)}</b>` : esc(r)}</li>`;
    })
    .join("");
  $("#sumNote").textContent = `기본 다리 ${game.base.length}개 + 몰래 그은 다리 ${game.secret.length}개`;
  $("#summary").hidden = false;
}

$("#again").addEventListener("click", () => startGame());

$("#shareLink").addEventListener("click", () => {
  const url = urlWith({ s: encodeState({ n: setup.names.map((_, i) => nameOf(i)), r: setup.results.map((_, i) => resOf(i)) }) });
  share({ title: "사다리타기", text: `${setup.names.length}명 사다리, 다리 하나씩 몰래 그어요`, url });
});

$("#saveCard").addEventListener("click", async () => {
  if (!game?.pairs) return;
  const btn = $("#saveCard");
  btn.disabled = true;
  try {
    await shareImage(drawCard(), { filename: "ladder-result.png", title: "사다리타기 결과", text: game.pairs.map(([n, r]) => `${n} → ${r}`).join("\n") });
  } finally {
    btn.disabled = false;
  }
});

function drawCard() {
  const W = 540;
  const H = 675;
  const { canvas, ctx } = createCanvas(W, H, 2);
  // 나무 틀 + 칠판
  ctx.fillStyle = "#6b4423";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#22332b";
  ctx.fillRect(16, 16, W - 32, H - 32);
  const rand = seeded(11);
  for (let i = 0; i < 1600; i++) {
    ctx.fillStyle = `rgba(243,240,230,${0.02 + rand() * 0.05})`;
    ctx.fillRect(16 + rand() * (W - 32), 16 + rand() * (H - 32), 1.4, 1.4);
  }
  ctx.fillStyle = "rgba(243,240,230,0.05)";
  ctx.fillRect(40, 60, 300, 26);
  ctx.fillRect(220, 430, 260, 22);

  const d = new Date();
  chalkText(ctx, "사다리타기 결과", 40, 56, { font: `700 34px ${PEN}`, align: "left", seed: 4 });
  chalkText(ctx, `${d.getMonth() + 1}월 ${d.getDate()}일`, W - 40, 56, { font: `400 22px ${PEN}`, align: "right", seed: 6, color: "rgba(243,240,230,0.7)" });

  // 미니 사다리
  const n = game.n;
  const lx = 40;
  const ly = 120;
  const lw = W - 80;
  const lh = 260;
  const g = geom(lw, lh, n, { top: 0, bottom: 0, side: Math.max(18, Math.min(40, lw / (n * 2))) });
  ctx.save();
  ctx.translate(lx, ly);
  const fs = n > 8 ? 13 : n > 5 ? 15 : 18;
  for (let i = 0; i < n; i++) {
    chalkStroke(ctx, [[g.x(i), g.y(0)], [g.x(i), g.y(1)]], { seed: i + 1, width: 2.6 });
    chalkText(ctx, game.names[i].slice(0, n > 8 ? 3 : 5), g.x(i), -16 - (n > 8 && i % 2 ? 16 : 0), { font: `700 ${fs}px ${PEN}`, seed: 30 + i });
    const res = game.results[i];
    const hit = res !== "꽝" && res !== "통과";
    chalkText(ctx, res.slice(0, n > 8 ? 3 : 5), g.x(i), lh + 16 + (n > 8 && i % 2 ? 16 : 0), { font: `700 ${fs}px ${PEN}`, seed: 50 + i, color: hit ? CHALK.yellow : CHALK.white });
  }
  game.base.forEach((r, k) => chalkStroke(ctx, [[g.x(r.a), g.y(r.y)], [g.x(r.a + 1), g.y(r.y + r.dy)]], { seed: 40 + k, width: 2.4 }));
  game.secret.forEach((r, k) => chalkStroke(ctx, [[g.x(r.a), g.y(r.y)], [g.x(r.a + 1), g.y(r.y + r.dy)]], { seed: 90 + k, width: 3, color: CHALK.yellow }));
  for (let i = 0; i < n; i++) {
    const p = tracePath(n, allRungs(), i);
    chalkStroke(ctx, p.pts.map(([rail, v]) => [g.x(rail), g.y(v)]), { seed: 500 + i, width: 3.4, color: PATH_COLORS[i % PATH_COLORS.length], alpha: 0.75 });
  }
  ctx.restore();

  // 결과 목록
  const listTop = 450;
  const cols = n > 6 ? 2 : 1;
  const rows = Math.ceil(n / cols);
  const rowH = Math.min(30, 170 / rows);
  game.pairs.forEach(([nm, r], i) => {
    const c = Math.floor(i / rows);
    const row = i % rows;
    const x = 44 + c * ((W - 80) / 2);
    const y = listTop + row * rowH;
    const hit = r !== "꽝" && r !== "통과";
    chalkText(ctx, `${nm} → ${r}`, x, y, { font: `700 ${cols > 1 ? 18 : 22}px ${PEN}`, align: "left", seed: 70 + i, color: hit ? CHALK.yellow : CHALK.white });
  });
  // 분필받이
  ctx.fillStyle = "#9c6a3c";
  ctx.fillRect(16, H - 40, W - 32, 24);
  ctx.fillStyle = CHALK.white;
  ctx.fillRect(60, H - 46, 40, 8);
  ctx.font = `600 13px ${CANVAS_FONT}`;
  ctx.fillStyle = "rgba(43,38,32,0.8)";
  ctx.textAlign = "right";
  ctx.fillText(`사다리타기 · 몰래 그은 다리 ${game.secret.length}개`, W - 32, H - 23);
  return canvas;
}

addEventListener("resize", () => {
  if (!game || $("[data-view=game]").hidden) return;
  const w = ladderEl.getBoundingClientRect().width;
  if (Math.abs(w - lastW) < 1) return;
  lastW = w;
  sizeCanvases();
  buildCards();
  drawBase();
});

/* ---------- 시작 ---------- */
function boot() {
  const s = getParam("s");
  const raw = s ? decodeState(s) : null;
  const shared = raw && Array.isArray(raw.n) && Array.isArray(raw.r) ? sanitize({ names: raw.n, results: raw.r }) : null;
  if (shared) {
    setup = shared;
    saveSetup();
    toSetup();
    toast("받은 사다리 설정을 칠판에 옮겼어요");
    return;
  }
  intro = startIntro({ canvas: $("#introCv"), note: $("#introNote") });
}
boot();

// 확인용 훅 (스크린샷 검증)
window.__ladder = {
  start: startGame,
  get game() {
    return game;
  },
  drawCard,
  tapAt(fx, fy) {
    const r = fxCv.getBoundingClientRect();
    fxCv.dispatchEvent(new PointerEvent("pointerup", { clientX: r.left + r.width * fx, clientY: r.top + r.height * fy, bubbles: true }));
  },
};
