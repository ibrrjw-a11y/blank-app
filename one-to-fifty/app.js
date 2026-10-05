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
  shuffle,
  todayKey,
  prefersReducedMotion,
  createCanvas,
  roundRect,
  CANVAS_FONT,
} from "../shared/kit.js";
import { createSeg, drawSeg } from "./seg.js";

const store = createStore("one-to-fifty");
const N = 25;
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const sec = (ms) => (ms / 1000).toFixed(2);
const fmtTime = (ms) => {
  const s = ms / 1000;
  return s >= 1000 ? "999.9" : s >= 100 ? s.toFixed(1) : s.toFixed(2);
};

/* ---------- 소리 (WebAudio, 사용자가 누른 뒤에만) ---------- */
let ac;
function audio() {
  if (!store.get("sound", true)) return null;
  try {
    ac ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === "suspended") ac.resume();
    return ac;
  } catch {
    return null;
  }
}
function tone(freq, dur, { type = "sine", gain = 0.06, when = 0 } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + when;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}
const sfx = {
  click: () => tone(1900, 0.035, { type: "square", gain: 0.025 }),
  miss: () => tone(130, 0.14, { type: "sawtooth", gain: 0.04 }),
  beep: () => tone(880, 0.09, { type: "square", gain: 0.03 }),
  go: () => tone(1320, 0.16, { type: "square", gain: 0.035 }),
  ding() {
    tone(1318.5, 1.3, { gain: 0.11 });
    tone(2637, 0.5, { gain: 0.02 });
    tone(1046.5, 1.6, { gain: 0.09, when: 0.32 });
  },
};

/* ---------- 버튼 만들기 ---------- */
function buildKeys(board, mini = false) {
  board.innerHTML = range(0, N - 1)
    .map((i) => `<button class="key${mini ? " key--mini" : ""}" type="button" data-i="${i}" ${mini ? 'tabindex="-1"' : ""}><span class="key__n"></span></button>`)
    .join("");
  return [...board.querySelectorAll(".key")].map((el) => ({ el, n: el.firstElementChild }));
}

function setKey(k, v, layer) {
  k.n.textContent = v ? String(v) : "";
  k.el.dataset.layer = layer;
  k.el.setAttribute("aria-label", v ? `${v}` : "꺼진 버튼");
}

function pulse(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

/* ---------- 도전장 ---------- */
function readChallenge() {
  const raw = getParam("c");
  if (!raw) return null;
  const d = decodeState(raw.replace(/\/$/, ""));
  if (!d || typeof d !== "object") return null;
  const ms = Math.round(Number(d.t) * 10);
  if (!Number.isFinite(ms) || ms < 3000 || ms > 999000) return null;
  return { name: String(d.n || "").replace(/[<>&"'\n\r]/g, "").trim().slice(0, 10), ms };
}
const challenge = readChallenge();
const whoOf = (c) => (c.name ? `${c.name}의` : "친구의");

function renderChallenge() {
  const el = $("#challengeIntro");
  if (!challenge) return;
  el.hidden = false;
  el.innerHTML = `<span class="notice-tag__k">알림</span><p><b>${esc(whoOf(challenge))} 기록 ${sec(challenge.ms)}초</b>, 깨볼래요?</p>`;
}

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

/* ---------- 첫 화면: 키네틱 제목 + 자동 데모 ---------- */
function kineticHero() {
  const l2 = $(".hero__line--2");
  const text = "순서대로 꾹";
  let i = 0;
  l2.innerHTML = [...text].map((ch) => (ch === " " ? " " : `<span class="kt" style="--i:${i++}">${ch}</span>`)).join("");
  $("#hero").classList.add("is-in");
}

let demo = null;
function startDemo() {
  stopDemo();
  const board = $("#demoBoard");
  const finger = $("#finger");
  const cab = board.closest(".cab");
  const keys = buildKeys(board, true);
  const seg = createSeg($("#demoSeg"), 4);
  const reduce = prefersReducedMotion();
  const ctl = { stop: false, timers: new Set(), raf: 0 };
  const later = (ms, fn) => {
    const t = setTimeout(() => {
      ctl.timers.delete(t);
      if (!ctl.stop) fn();
    }, ms);
    ctl.timers.add(t);
  };
  const heroBtns = document.querySelectorAll(".hero__btn");
  let vals, second, next, t0, running;

  const tick = () => {
    if (ctl.stop) return;
    if (running) seg.set(fmtTime(performance.now() - t0));
    ctl.raf = requestAnimationFrame(tick);
  };

  const round = () => {
    const first = shuffle(range(1, 25));
    second = shuffle(range(26, 50));
    vals = first.slice();
    keys.forEach((k, i) => setKey(k, vals[i], 1));
    next = 1;
    t0 = performance.now();
    running = true;
    cab.classList.remove("is-arrived");
    fumbled.clear();
    finger.classList.add("is-on");
    later(400, step);
  };

  const moveTo = (k) => {
    const b = k.el.getBoundingClientRect();
    const c = cab.getBoundingClientRect();
    finger.style.transform = `translate(${b.left - c.left + b.width / 2}px, ${b.top - c.top + b.height / 2}px)`;
  };
  const tapFx = () => {
    finger.classList.remove("is-tap");
    void finger.offsetWidth;
    finger.classList.add("is-tap");
  };
  const fumbled = new Set();
  const step = () => {
    const i = vals.indexOf(next);
    const k = keys[i];
    // 한 번씩 헛누르는 장면도 보여준다 (버튼이 흔들리고 다시 찾는다)
    if ((next === 9 || next === 33) && !fumbled.has(next)) {
      fumbled.add(next);
      const j = vals.findIndex((v, idx) => v && v !== next && Math.abs(idx - i) > 3);
      if (j >= 0) {
        moveTo(keys[j]);
        later(140, () => {
          tapFx();
          pulse(keys[j].el, "is-miss");
          later(260, step);
        });
        return;
      }
    }
    moveTo(k);
    later(120, () => {
      tapFx();
      if (next <= 25) {
        vals[i] = second[i];
        setKey(k, vals[i], 2);
      } else {
        vals[i] = 0;
        setKey(k, 0, 0);
      }
      pulse(k.el, "is-hit");
      if (next === 1) pulse(heroBtns[0], "is-hit");
      next++;
      if (next > 50) {
        running = false;
        heroBtns[1] && pulse(heroBtns[1], "is-hit");
        finger.classList.remove("is-on");
        cab.classList.add("is-arrived");
        later(2200, round);
        return;
      }
      // 뒤로 갈수록 손이 빨라진다
      later(Math.max(70, 190 - next * 2.4) + Math.random() * 40, step);
    });
  };

  if (reduce) {
    const first = shuffle(range(1, 25));
    keys.forEach((k, i) => setKey(k, first[i], 1));
    seg.set("0.00");
  } else {
    seg.set("0.00");
    later(500, round);
    tick();
  }
  demo = ctl;
}

function stopDemo() {
  if (!demo) return;
  demo.stop = true;
  demo.timers.forEach(clearTimeout);
  cancelAnimationFrame(demo.raf);
  demo = null;
}

function enterIntro() {
  endGame();
  document.body.classList.remove("is-playing");
  showView("intro");
  const best = store.get("best");
  const st = streak();
  $("#startSub").textContent = best ? `내 최고 ${sec(best)}초${st > 1 ? ` · ${st}일 연속` : ""}` : "누르면 3초 뒤 출발해요";
  startDemo();
}

/* ---------- 게임 ---------- */
const G = {
  keys: null,
  seg: null,
  nextSeg: null,
  vals: [],
  second: [],
  next: 1,
  t0: 0,
  split: 0,
  phase: "idle", // idle | count | run | done
  paused: false,
  pausedAt: 0,
  raf: 0,
  gen: 0,
  misses: 0,
};

function setupPlay() {
  G.keys = buildKeys($("#board"));
  G.seg = createSeg($("#timeSeg"), 4);
  G.nextSeg = createSeg($("#nextSeg"), 2);
  $("#board").addEventListener("pointerdown", onTap);
  // 키보드 사용자는 Enter/Space 로 누를 수 있게
  $("#board").addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const k = e.target.closest(".key");
    if (k) {
      e.preventDefault();
      press(+k.dataset.i);
    }
  });
}

function startGame() {
  stopDemo();
  document.body.classList.add("is-playing");
  showView("play");
  const gen = ++G.gen;
  G.phase = "count";
  G.paused = false;
  G.misses = 0;
  $("#pause").hidden = true;
  $("#board").classList.remove("is-live");
  G.keys.forEach((k) => setKey(k, 0, "wait"));
  G.nextSeg.set("1");
  $("#hint").textContent = "준비하세요";
  $("#arrow").classList.remove("is-on");
  const steps = ["3", "2", "1"];
  const run = (i) => {
    if (gen !== G.gen) return;
    if (i < steps.length) {
      G.seg.set(` ${steps[i]}  `.slice(0, 4));
      pulse($("#timeSeg"), "is-blink");
      sfx.beep();
      setTimeout(() => run(i + 1), 650);
      return;
    }
    begin(gen);
  };
  setTimeout(() => run(0), 250);
}

function begin(gen) {
  if (gen !== G.gen) return;
  G.vals = shuffle(range(1, 25));
  G.second = shuffle(range(26, 50));
  G.keys.forEach((k, i) => setKey(k, G.vals[i], 1));
  G.next = 1;
  G.split = 0;
  G.phase = "run";
  G.t0 = performance.now();
  $("#board").classList.add("is-live");
  $("#arrow").classList.add("is-on");
  $("#hint").textContent = "1부터 차례로 누르세요";
  sfx.go();
  cancelAnimationFrame(G.raf);
  const loop = (now) => {
    if (G.phase !== "run") return;
    if (!G.paused) G.seg.set(fmtTime(now - G.t0));
    G.raf = requestAnimationFrame(loop);
  };
  G.raf = requestAnimationFrame(loop);
}

function onTap(e) {
  const k = e.target.closest(".key");
  if (!k) return;
  e.preventDefault();
  press(+k.dataset.i);
}

function press(i) {
  if (G.phase !== "run" || G.paused) return;
  const now = performance.now();
  const k = G.keys[i];
  const v = G.vals[i];
  if (!v) return;
  if (v !== G.next) {
    G.misses++;
    pulse(k.el, "is-miss");
    sfx.miss();
    haptic(30);
    return;
  }
  if (G.next <= 25) {
    G.vals[i] = G.second[i];
    setKey(k, G.vals[i], 2);
  } else {
    G.vals[i] = 0;
    setKey(k, 0, 0);
  }
  pulse(k.el, "is-hit");
  sfx.click();
  haptic(8);
  if (G.next === 25) G.split = now - G.t0;
  G.next++;
  if (G.next > 50) return finish(now);
  G.nextSeg.set(String(G.next));
  if (G.next === 26) {
    $("#hint").textContent = "이제 26부터 50까지";
    pulse($("#hint"), "is-pop");
  }
}

function endGame() {
  G.gen++;
  G.phase = "idle";
  cancelAnimationFrame(G.raf);
}

async function finish(now) {
  const ms = Math.round(now - G.t0);
  G.phase = "done";
  cancelAnimationFrame(G.raf);
  G.seg.set(fmtTime(ms));
  G.nextSeg.set("--");
  $("#arrow").classList.remove("is-on");
  $("#board").classList.remove("is-live");
  // 기록
  const prevBest = store.get("best");
  const list = [...runs(), { ms, split: Math.round(G.split), d: todayKey(), at: Date.now(), miss: G.misses }].slice(-60);
  store.set("runs", list);
  const isBest = !prevBest || ms < prevBest;
  if (isBest) store.set("best", ms);
  await arrive();
  renderResult({ ms, split: Math.round(G.split), misses: G.misses, isBest, prevBest });
}

/* ---------- 도착: 문이 닫혔다가 "딩" 하고 열린다 ---------- */
function arrive() {
  const doors = $("#doors");
  const lamp = $("#doorLamp");
  const reduce = prefersReducedMotion();
  return new Promise((resolve) => {
    doors.className = "doors is-closing";
    lamp.textContent = "";
    setTimeout(
      () => {
        sfx.ding();
        haptic([12, 60, 12]);
        lamp.textContent = "딩";
        doors.classList.add("is-ding");
        document.body.classList.remove("is-playing");
        showView("result");
        resolve();
        setTimeout(() => {
          doors.className = "doors is-opening";
          setTimeout(() => (doors.className = "doors"), 900);
        }, reduce ? 200 : 650);
      },
      reduce ? 50 : 420
    );
  });
}

/* ---------- 결과 ---------- */
function spark(list, best) {
  const W = 300;
  const Hh = 92;
  const pad = 14;
  const pts = list.slice(-10);
  if (pts.length < 2) return `<p class="spark__empty">두 판부터 선이 그려져요. 한 판 더?</p>`;
  const vals = pts.map((r) => r.ms / 1000);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = Math.max(0.5, hi - lo);
  const x = (i) => pad + (i * (W - pad * 2)) / (pts.length - 1);
  const y = (v) => pad + ((v - lo) / span) * (Hh - pad * 2); // 빠를수록 위
  const d = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");
  const bi = vals.indexOf(Math.min(...vals));
  const by = y(best / 1000);
  return `<svg class="spark" viewBox="0 0 ${W} ${Hh + 18}" role="img" aria-label="최근 ${pts.length}판 기록 그래프">
    <line class="spark__best" x1="${pad}" x2="${W - pad}" y1="${by}" y2="${by}" />
    <path class="spark__line" d="${d}" pathLength="1" />
    ${vals.map((v, i) => `<circle class="spark__dot${i === vals.length - 1 ? " is-last" : ""}${i === bi ? " is-best" : ""}" cx="${x(i)}" cy="${y(v)}" r="${i === vals.length - 1 ? 5 : 3.5}" />`).join("")}
    <text class="spark__t" x="${x(0)}" y="${Hh + 14}" text-anchor="start">${vals[0].toFixed(2)}</text>
    <text class="spark__t is-last" x="${x(vals.length - 1)}" y="${Hh + 14}" text-anchor="end">${vals[vals.length - 1].toFixed(2)}</text>
  </svg>`;
}

function renderResult({ ms, split, misses, isBest, prevBest }) {
  const best = store.get("best", ms);
  const list = runs();
  const today = list.filter((r) => r.d === todayKey()).length;
  const st = streak(list);
  let vs = "";
  if (challenge) {
    const diff = (challenge.ms - ms) / 1000;
    vs = `<div class="vsplate ${diff > 0 ? "is-win" : ""}">
      <span class="vsplate__k">도전장</span>
      <p>${esc(whoOf(challenge))} 기록 <b>${sec(challenge.ms)}초</b></p>
      <p class="vsplate__v">${diff > 0 ? `${diff.toFixed(2)}초 빨랐어요. 깼어요!` : diff === 0 ? "소수점까지 똑같아요!" : `${(-diff).toFixed(2)}초 차이. 한 번 더?`}</p>
    </div>`;
  }
  const delta = !isBest && prevBest ? `최고보다 +${((ms - prevBest) / 1000).toFixed(2)}초` : prevBest ? `이전 최고 ${sec(prevBest)}초` : "첫 기록이에요";
  $("#resultBody").innerHTML = `
  <div class="cab cab--result">
    <span class="screw"></span><span class="screw"></span><span class="screw"></span><span class="screw"></span>
    <p class="res__floor"><span>도착</span><span>50층</span></p>
    <div class="indicator indicator--res">
      <span class="indicator__arrow is-on"></span>
      <div class="indicator__seg" id="resSeg"></div>
      <span class="indicator__unit">SEC</span>
    </div>
    <p class="res__badge ${isBest ? "is-best" : ""}">${isBest ? "최고 기록 갱신" : delta}</p>
    <dl class="res__grid">
      <div><dt>1~25</dt><dd>${sec(split)}<small>초</small></dd></div>
      <div><dt>26~50</dt><dd>${sec(ms - split)}<small>초</small></dd></div>
      <div><dt>헛누름</dt><dd>${misses}<small>번</small></dd></div>
      <div><dt>내 최고</dt><dd>${sec(best)}<small>초</small></dd></div>
      <div><dt>오늘</dt><dd>${today}<small>판</small></dd></div>
      <div><dt>연속</dt><dd>${st}<small>일</small></dd></div>
    </dl>
    ${vs}
    <div class="res__chart">
      <p class="res__k"><span>최근 ${Math.min(10, list.length)}판</span><span>위로 갈수록 빨라요 · 점선 = 내 최고</span></p>
      ${spark(list, best)}
    </div>
  </div>

  <div class="res__actions">
    <button class="callbtn callbtn--again" id="again" type="button">
      <span class="callbtn__ring"><span class="callbtn__face"><i class="callbtn__tri"></i></span></span>
      <span class="callbtn__txt"><b>한 판 더</b><small>바로 3초 카운트</small></span>
    </button>
    <div class="dare">
      <label class="dare__name"><span>도전장에 쓸 이름</span><input class="input" id="myName" maxlength="10" placeholder="예: 민지" autocomplete="nickname" /></label>
      <div class="dare__btns">
        <button class="panelbtn panelbtn--wide" id="dare" type="button"><span>친구에게 도전장</span></button>
        <button class="panelbtn panelbtn--wide" id="img" type="button"><span>운행 기록증 저장</span></button>
      </div>
    </div>
    <button class="linkbtn" id="home" type="button">처음 화면으로</button>
  </div>`;
  const seg = createSeg($("#resSeg"), 4);
  seg.set(fmtTime(ms));
  $("#myName").value = store.get("name", "");
  $("#again").onclick = () => pressCall($("#again"), startGame);
  $("#home").onclick = enterIntro;
  $("#dare").onclick = () => sendDare(ms);
  $("#img").onclick = (e) => saveImage(ms, best, e.currentTarget);
  if (isBest && list.length > 1) setTimeout(() => toast("최고 기록이에요. 친구한테 자랑할 타이밍"), 1300);
}

function readName() {
  const name = ($("#myName")?.value || "").replace(/[<>&"'\n\r]/g, "").trim().slice(0, 10);
  store.set("name", name);
  return name;
}

async function sendDare(ms) {
  const name = readName();
  const url = urlWith({ c: encodeState({ n: name, t: Math.round(ms / 10) }) });
  const s = sec(ms);
  await share({ title: "1 to 50 도전장", text: `1 to 50 내 기록 ${s}초. 깨볼래요?`, url });
}

async function saveImage(ms, best, btn) {
  btn.classList.add("is-loading");
  try {
    const canvas = drawCard(ms, best, readName());
    await shareImage(canvas, { filename: `1to50-${sec(ms)}.png`, title: "1 to 50", text: `1 to 50 내 기록 ${sec(ms)}초` });
  } finally {
    btn.classList.remove("is-loading");
  }
}

// 운행 기록증: 브러시드 스틸 판 + 붉은 7세그먼트
function drawCard(ms, best, name) {
  const W = 600;
  const Hh = 760;
  const { canvas, ctx } = createCanvas(W, Hh, 2);
  const css = getComputedStyle(document.documentElement);
  const c = (n) => css.getPropertyValue(n).trim();
  // 스틸 판
  const g = ctx.createLinearGradient(0, 0, 0, Hh);
  g.addColorStop(0, c("--art-steel-1"));
  g.addColorStop(0.5, c("--art-steel-2"));
  g.addColorStop(1, c("--art-steel-1"));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, Hh);
  for (let yy = 0; yy < Hh; yy += 2) {
    ctx.fillStyle = `rgba(255,255,255,${(Math.sin(yy * 12.9898) * 43758.5453) % 1 > 0.5 ? 0.05 : 0.0})`;
    ctx.fillRect(0, yy, W, 1);
  }
  // 나사
  [[24, 24], [W - 24, 24], [24, Hh - 24], [W - 24, Hh - 24]].forEach(([x, y]) => {
    ctx.fillStyle = c("--art-steel-3");
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = c("--art-engrave");
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 5, y + 5);
    ctx.lineTo(x + 5, y - 5);
    ctx.stroke();
  });
  ctx.fillStyle = c("--art-engrave");
  ctx.font = `800 26px ${CANVAS_FONT}`;
  ctx.fillText("1 TO 50 운행 기록", 56, 92);
  ctx.font = `500 18px ${CANVAS_FONT}`;
  const d = new Date();
  ctx.fillText(`${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}${name ? ` · ${name}` : ""}`, 56, 124);
  // 표시창
  ctx.fillStyle = c("--art-lcd");
  roundRect(ctx, 48, 170, W - 96, 220, 18);
  ctx.fill();
  const t = fmtTime(ms);
  const h = 150;
  const width = (t.replace(".", "").length * 64 * h) / 92;
  drawSeg(ctx, t, (W - width) / 2 - 10, 205, h, c("--art-led"), c("--art-led-off"));
  ctx.fillStyle = c("--art-led");
  ctx.font = `700 20px ${CANVAS_FONT}`;
  ctx.fillText("SEC", W - 110, 376);
  // 표
  ctx.fillStyle = c("--art-engrave");
  ctx.font = `700 22px ${CANVAS_FONT}`;
  ctx.fillText("1부터 50까지 순서대로", 56, 460);
  ctx.font = `500 20px ${CANVAS_FONT}`;
  ctx.fillText(`내 최고 ${sec(best)}초`, 56, 500);
  ctx.fillText("이 기록, 깨볼래요?", 56, 540);
  // 호출 버튼
  ctx.fillStyle = c("--art-steel-3");
  ctx.beginPath();
  ctx.arc(W - 120, 620, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c("--art-lit");
  ctx.beginPath();
  ctx.arc(W - 120, 620, 48, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c("--art-engrave");
  ctx.beginPath();
  ctx.moveTo(W - 120, 596);
  ctx.lineTo(W - 96, 636);
  ctx.lineTo(W - 144, 636);
  ctx.closePath();
  ctx.fill();
  return canvas;
}

/* ---------- 호출 버튼: 눌리고 불이 켜진 뒤 출발 ---------- */
function pressCall(btn, fn) {
  if (btn.classList.contains("is-lit")) return;
  btn.classList.add("is-lit");
  audio();
  sfx.click();
  haptic(10);
  setTimeout(() => {
    btn.classList.remove("is-lit");
    fn();
  }, prefersReducedMotion() ? 60 : 380);
}

/* ---------- 탭 숨김 → 일시정지 ---------- */
function onVisibility() {
  if (!document.hidden) {
    if (!$("#intro").hidden && !demo) startDemo();
    return;
  }
  stopDemo();
  if (G.phase === "run" && !G.paused) {
    G.paused = true;
    G.pausedAt = performance.now();
    $("#pause").hidden = false;
    $("#board").classList.add("is-covered");
  } else if (G.phase === "count") {
    G.gen++;
    G.phase = "idle";
    G.needCount = true;
    $("#pause").hidden = false;
  }
}

function resume() {
  $("#pause").hidden = true;
  $("#board").classList.remove("is-covered");
  if (G.needCount) {
    G.needCount = false;
    startGame();
    return;
  }
  if (G.paused) {
    G.t0 += performance.now() - G.pausedAt;
    G.paused = false;
  }
}

/* ---------- 시작 ---------- */
function init() {
  renderMoreSites($("#more"));
  const moreTitle = $("#more .more-sites__title");
  if (moreTitle) moreTitle.textContent = "층별 안내";
  renderChallenge();
  kineticHero();
  setupPlay();
  const soundBtn = $("#sound");
  const syncSound = () => soundBtn.setAttribute("aria-pressed", String(store.get("sound", true)));
  syncSound();
  soundBtn.onclick = () => {
    store.set("sound", !store.get("sound", true));
    syncSound();
  };
  $("#start").onclick = () => pressCall($("#start"), startGame);
  $("#retry").onclick = () => startGame();
  $("#quit").onclick = enterIntro;
  $("#pause").onclick = resume;
  document.addEventListener("visibilitychange", onVisibility);
  enterIntro();
}

init();

// 검증용
export const __test = {
  G,
  press,
  start: startGame,
  solve() {
    // 정답 순서대로 모두 누르기
    for (let n = G.next; n <= 50; n++) press(G.vals.indexOf(n));
  },
  playTo(n) {
    while (G.next < n) press(G.vals.indexOf(G.next));
  },
  seed(list) {
    store.set("runs", list);
    store.set("best", Math.min(...list.map((r) => r.ms)));
  },
};
