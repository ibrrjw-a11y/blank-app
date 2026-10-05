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
  renderCrumb,
  renderMoreSites,
  createCanvas,
  CANVAS_FONT,
  prefersReducedMotion,
  sleep,
} from "../shared/kit.js";
import { WheelView, layout, makeParams, planSpin, analyze, sample, omegaAt, confetti, mod, colorFor, TAU } from "./wheel.js";
import { startIntro } from "./intro.js";

const MAX_ITEMS = 24;
const MAX_NAME = 12;
const store = createStore("roulette");
const DISPLAY_FONT = `"Black Han Sans", ${CANVAS_FONT}`;

const PRESETS = [
  { title: "점심 메뉴", items: ["김치찌개", "돈가스", "쌀국수", "제육볶음", "샐러드", "짜장면", "순대국", "초밥"] },
  { title: "벌칙", items: ["커피 쏘기", "통과", "꿀밤", "통과", "애교 한 번", "통과", "노래 한 소절", "설거지"] },
  { title: "숫자 1~10", items: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"] },
  { title: "할까 말까", items: ["한다", "안 한다"] },
];

// 공정한 난수 (가능하면 암호 난수)
const rnd = () => {
  try {
    return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
  } catch {
    return Math.random();
  }
};

/* ---------- 상태 ---------- */
const fromPreset = (p) => ({ title: p.title, items: p.items.map((name) => ({ name, weight: 1, out: false })) });

function sanitize(st) {
  if (!st || !Array.isArray(st.items)) return null;
  const items = st.items
    .map((it) => ({
      name: String(it.name ?? "").slice(0, MAX_NAME),
      weight: Math.min(5, Math.max(1, Math.round(Number(it.weight) || 1))),
      out: !!it.out,
    }))
    .filter((it) => it.name.trim())
    .slice(0, MAX_ITEMS);
  if (items.length < 2) return null;
  return { title: String(st.title || "내 룰렛").slice(0, 14), items };
}

let state = sanitize(store.get("current")) || fromPreset(PRESETS[0]);
let theta = 0.18;
let spinning = false;
let lastRun = null; // { sim, an, lay, winnerName, nearName }
let pendingOut = null;

const active = () => state.items.filter((it) => !it.out);
const save = () => store.set("current", state);

/* ---------- 화면 ---------- */
renderCrumb($("#crumb"));
renderCrumb($("#crumb2"));
renderMoreSites($("#more"));

const wheelCanvas = $("#wheel");
let view = null;
let lay = null;

function ensureView() {
  if (view) return;
  view = new WheelView(wheelCanvas, { font: CANVAS_FONT });
  rebuild();
  document.fonts?.ready?.then(() => {
    view.buildFace();
    redraw();
  });
}

function rebuild() {
  if (!view) return;
  lay = layout(active());
  view.setLayout(lay);
  redraw();
}

function redraw() {
  view?.draw(theta, 0);
}

addEventListener("resize", () => {
  if (!view) return;
  view.resize();
  if (!spinning) redraw();
});

/* ---------- 인트로 ---------- */
let intro = null;
const shared = getParam("w");
if (shared) {
  const st = sanitize(decodeState(shared)?.i ? { title: decodeState(shared).t, items: decodeState(shared).i.map(([name, weight]) => ({ name, weight })) } : null);
  if (st) {
    state = st;
    save();
    enterApp();
    toast("받은 룰렛을 세트에 올렸어요");
  } else {
    runIntro();
  }
} else {
  runIntro();
}

function runIntro() {
  intro = startIntro({
    canvas: $("#introWheel"),
    jamakLayer: $("#introJamak"),
    sub: $("#introSub"),
    confettiCanvas: $("#introConfetti"),
  });
}

$("#start").addEventListener("click", async () => {
  const b = $("#start");
  b.classList.add("is-pressed");
  haptic(14);
  await sleep(140);
  b.classList.remove("is-pressed");
  enterApp();
});

function enterApp() {
  intro?.stop();
  intro = null;
  showView("app");
  ensureView();
  renderAll();
}

/* ---------- 큐카드 편집 ---------- */
const itemsEl = $("#items");

function pct(w, total) {
  const v = (w / total) * 100;
  return Number.isInteger(Math.round(v * 10) / 10) ? `${Math.round(v)}%` : `${v.toFixed(1)}%`;
}

function renderItems() {
  const act = active();
  const total = act.reduce((s, it) => s + it.weight, 0);
  let ai = 0;
  itemsEl.innerHTML = "";
  state.items.forEach((it, i) => {
    const li = document.createElement("li");
    li.className = `item${it.out ? " is-out" : ""}`;
    const color = it.out ? "#8a8a8a" : colorFor(ai, act.length).bg;
    if (!it.out) ai++;
    li.innerHTML = `
      <span class="item__sw" style="background:${color}"></span>
      <input class="item__name" maxlength="${MAX_NAME}" aria-label="${i + 1}번 칸 이름" />
      <span class="item__pct">${it.out ? "빠짐" : pct(it.weight, total)}</span>
      <button class="item__w" type="button" data-w="${it.weight}" aria-label="가중치 ×${it.weight}, 눌러서 바꾸기">×${it.weight}</button>
      <button class="item__del" type="button" aria-label="${it.name} 칸 지우기">×</button>`;
    const input = li.querySelector(".item__name");
    input.value = it.name;
    input.addEventListener("input", () => {
      it.name = input.value.slice(0, MAX_NAME);
      save();
      scheduleRebuild();
    });
    input.addEventListener("blur", () => {
      if (!it.name.trim()) {
        it.name = `${i + 1}번`;
        input.value = it.name;
        save();
        scheduleRebuild();
      }
    });
    li.querySelector(".item__w").addEventListener("click", (e) => {
      if (spinning) return;
      it.weight = (it.weight % 5) + 1;
      haptic(6);
      save();
      clearVerdict();
      renderItems();
      rebuild();
      const btn = itemsEl.children[i]?.querySelector(".item__w");
      btn?.classList.add("is-bump");
    });
    li.querySelector(".item__del").addEventListener("click", () => {
      if (spinning) return;
      if (state.items.length <= 2) {
        toast("룰렛은 2칸은 있어야 해요");
        return;
      }
      state.items.splice(i, 1);
      if (active().length < 2) state.items.forEach((x) => (x.out = false));
      save();
      clearVerdict();
      renderAll();
      rebuild();
    });
    itemsEl.appendChild(li);
  });
  $("#count").textContent = `${state.items.length}/${MAX_ITEMS}`;
  $("#restoreAll").hidden = !state.items.some((x) => x.out);
  const n = act.length;
  $("#meta").innerHTML = state.items.some((x) => x.out) ? `남은 ${n}칸<br />빠진 ${state.items.length - n}칸` : `${n}칸<br />가중치 합 ${total}`;
}

let rebuildRaf = 0;
function scheduleRebuild() {
  cancelAnimationFrame(rebuildRaf);
  rebuildRaf = requestAnimationFrame(() => {
    rebuild();
    $("#boardTitle b").textContent = state.title || "내 룰렛";
  });
}

function renderTitle() {
  $("#titleInput").value = state.title;
  $("#boardTitle b").textContent = state.title || "내 룰렛";
}

$("#titleInput").addEventListener("input", (e) => {
  state.title = e.target.value.slice(0, 14);
  $("#boardTitle b").textContent = state.title || "내 룰렛";
  save();
});

$("#addForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (spinning) return;
  const input = $("#addInput");
  const names = input.value
    .split(/[,\n、，]/)
    .map((s) => s.trim().slice(0, MAX_NAME))
    .filter(Boolean);
  if (!names.length) return;
  const room = MAX_ITEMS - state.items.length;
  if (room <= 0) {
    toast("24칸까지만 넣을 수 있어요");
    return;
  }
  names.slice(0, room).forEach((name) => state.items.push({ name, weight: 1, out: false }));
  if (names.length > room) toast(`24칸까지라 ${names.length - room}개는 빠졌어요`);
  input.value = "";
  haptic(8);
  save();
  clearVerdict();
  renderAll();
  rebuild();
});

function renderPresets() {
  const box = $("#presets");
  box.innerHTML = "";
  PRESETS.forEach((p) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pchip";
    b.innerHTML = `${p.title} <small>${p.items.length}칸</small>`;
    b.addEventListener("click", () => loadWheel(fromPreset(p)));
    box.appendChild(b);
  });
}

function renderSaved() {
  const list = store.get("saved", []);
  const box = $("#saved");
  box.innerHTML = "";
  if (!list.length) {
    box.innerHTML = `<p class="presets__empty">자주 쓰는 룰렛을 저장하면 여기서 한 번에 불러와요.</p>`;
    return;
  }
  list.forEach((w, idx) => {
    const b = document.createElement("span");
    b.className = "pchip";
    b.innerHTML = `<button type="button" class="pchip__load"></button><button type="button" class="pchip__x" aria-label="삭제">×</button>`;
    const load = b.querySelector(".pchip__load");
    load.style.cssText = "border:0;background:none;padding:0;font:inherit;color:inherit;cursor:pointer;min-height:40px";
    load.innerHTML = `${escapeHtml(w.title)} <small>${w.items.length}칸</small>`;
    load.addEventListener("click", () => loadWheel(sanitize(w)));
    b.querySelector(".pchip__x").addEventListener("click", () => {
      const l = store.get("saved", []);
      l.splice(idx, 1);
      store.set("saved", l);
      renderSaved();
    });
    box.appendChild(b);
  });
}

function loadWheel(st) {
  if (!st || spinning) return;
  state = { title: st.title, items: st.items.map((x) => ({ ...x, out: false })) };
  pendingOut = null;
  save();
  clearVerdict();
  renderAll();
  rebuild();
  haptic(10);
  toast(`'${state.title}' 룰렛을 올렸어요`);
  document.querySelector(".studio--app")?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
}

$("#saveWheel").addEventListener("click", () => {
  const list = store.get("saved", []).filter((w) => w.title !== state.title);
  list.unshift({ title: state.title || "내 룰렛", items: state.items.map(({ name, weight }) => ({ name, weight })) });
  store.set("saved", list.slice(0, 12));
  renderSaved();
  toast("저장했어요. 다음에 한 번에 불러와요");
});

$("#restoreAll").addEventListener("click", () => {
  if (spinning) return;
  state.items.forEach((x) => (x.out = false));
  pendingOut = null;
  save();
  clearVerdict();
  renderAll();
  rebuild();
});

const elim = $("#elim");
elim.checked = !!store.get("elim", false);
elim.addEventListener("change", () => {
  store.set("elim", elim.checked);
  if (!elim.checked) pendingOut = null;
  haptic(6);
  toast(elim.checked ? "당첨된 칸은 다음 판에서 빠져요" : "당첨 빼기를 껐어요");
});

function renderAll() {
  renderTitle();
  renderItems();
  renderPresets();
  renderSaved();
  renderLog();
}

/* ---------- 자막 ---------- */
const jamakLayer = $("#jamak");
function jamak(text, cls = "", small) {
  jamakLayer.querySelectorAll(".jamak:not(.is-out)").forEach((el) => {
    el.classList.add("is-out");
    setTimeout(() => el.remove(), 280);
  });
  if (!text) return;
  const el = document.createElement("p");
  el.className = `jamak ${cls}`;
  el.dataset.t = text;
  el.textContent = text;
  jamakLayer.appendChild(el);
  if (small) {
    const s = document.createElement("p");
    s.className = "jamak jamak--name";
    s.dataset.t = small;
    s.textContent = small;
    if (small.length > 8) s.style.fontSize = "30px";
    jamakLayer.appendChild(s);
  }
}

/* ---------- 돌리기 ---------- */
const spinBtn = $("#spin");

function pickWeighted(list) {
  const total = list.reduce((s, it) => s + it.weight, 0);
  let r = rnd() * total;
  for (let i = 0; i < list.length; i++) {
    r -= list[i].weight;
    if (r < 0) return i;
  }
  return list.length - 1;
}

function lockUI(on) {
  spinning = on;
  spinBtn.disabled = on;
  document.querySelector(".cue").style.pointerEvents = on ? "none" : "";
  document.querySelector(".cue").style.opacity = on ? "0.6" : "";
  $("#replay").disabled = on;
}

function clearVerdict() {
  $("#verdict").hidden = true;
  jamak(null);
}

async function spin(power = 0.5) {
  if (spinning) return;
  ensureView();
  // 당첨 빼기: 지난 판 당첨 칸을 이제 뺀다
  if (pendingOut) {
    pendingOut.out = true;
    pendingOut = null;
    save();
    renderItems();
    rebuild();
  }
  const act = active();
  if (act.length < 2) {
    jamak("마지막 남은 칸!", "jamak--miss", act[0]?.name);
    toast("다 빠졌어요. '빠진 칸 되살리기'로 다시 시작해요");
    return;
  }
  clearVerdict();
  lockUI(true);
  haptic(18);

  const winner = pickWeighted(act);
  const r = rnd();
  const style = r < 0.42 ? "creep" : r < 0.8 ? "fall" : "mid";
  const P = makeParams(lay, { turns: 3 + Math.min(1.5, power * 1.5) });
  const sim = planSpin(lay, mod(theta), winner, P, style, rnd);
  const an = analyze(sim, lay);
  const winnerName = lay.slices[sim.winner].name;
  const nearName = an.neighbor != null ? lay.slices[an.neighbor].name : null;
  lastRun = { sim, an, lay, winnerName, nearName, winnerItem: act[sim.winner], title: state.title };

  await playback(sim, an, { live: true, nearName, winnerName });
  theta = sim.theta;
  finish();
}

function playback(sim, an, { live = true, nearName, winnerName }) {
  return new Promise((resolve) => {
    const reduce = prefersReducedMotion();
    const hangStart = an.hangStart ?? an.T;
    const hangEnd = an.hangEnd ?? an.T;
    let simT = live ? 0 : Math.max(0, Math.min(an.T - 1.5, hangStart - 0.8));
    const endT = live ? an.T + 0.15 : an.T + 0.35;
    const zoomStart = live ? an.zoomStart : simT;
    let zoom = live ? 1 : 2.1;
    let last = performance.now();
    let evIdx = an.ticks.findIndex((t) => t > simT);
    if (evIdx < 0) evIdx = an.ticks.length;
    let lastHaptic = 0;
    let shownQ = false;
    let shownHang = false;
    let shownMid = false;

    const rate = (t) => {
      if (!live) return 0.3;
      if (reduce) return 4;
      if (t < zoomStart) return 1;
      if (t < hangStart) return 1 - 0.5 * Math.min(1, (t - zoomStart) / Math.max(0.2, hangStart - zoomStart));
      if (t < hangEnd) return 0.45;
      return 0.85;
    };

    const frame = (now) => {
      const dtReal = Math.min(0.05, (now - last) / 1000);
      last = now;
      simT = Math.min(endT, simT + dtReal * rate(simT));
      const s = sample(sim, simT);

      while (evIdx < an.ticks.length && an.ticks[evIdx] <= simT) {
        const w = Math.abs(omegaAt(sim, an.ticks[evIdx]));
        if (w < 9) view.burst();
        if (now - lastHaptic > 45) {
          haptic(w < 3 ? 14 : 6);
          lastHaptic = now;
        }
        evIdx++;
      }

      if (live && !shownQ && simT >= zoomStart && an.T > 2) {
        shownQ = true;
        jamak("과연?!", "jamak--q");
      }
      if (an.kind === "creep") {
        if (!shownMid && simT >= hangStart + 0.05) {
          shownMid = true;
          jamak("넘어가나…?!", "jamak--q");
        }
        if (!shownHang && simT >= hangEnd) {
          shownHang = true;
          jamak("넘어갔다!!", "jamak--over", nearName ? `'${nearName}' 한 칸 차이` : null);
          haptic(24);
        }
      } else if (an.kind === "fall") {
        if (!shownMid && simT >= hangStart + 0.05) {
          shownMid = true;
          jamak("걸렸다…!", "jamak--q");
        }
        if (!shownHang && simT >= hangEnd) {
          shownHang = true;
          jamak("아~ 한 칸 차이!", "jamak--miss", nearName ? `'${nearName}' 될 뻔!` : null);
          haptic(24);
        }
      }

      const target = live ? (simT >= zoomStart && an.T > 2 ? 2.1 : 1) : 2.1;
      zoom += (target - zoom) * Math.min(1, dtReal * 5);
      view.draw(s.th, s.f, { zoom });

      if (simT >= endT) {
        resolve();
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

// 줌 아웃하면서 결과를 보여준다
function zoomOut(sim, from = 2.1) {
  return new Promise((resolve) => {
    let z = from;
    const s = sample(sim, sim.t + 0.6);
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      z += (1 - z) * Math.min(1, dt * 6);
      if (Math.abs(z - 1) < 0.004) z = 1;
      view.draw(s.th, s.f, { zoom: z });
      if (z === 1) return resolve();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

async function finish() {
  const { sim, an, winnerName, nearName } = lastRun;
  await sleep(220);
  jamak("당첨!!", "jamak--win", winnerName);
  haptic([30, 50, 70]);
  confetti($("#confetti"), { count: 110 });
  await zoomOut(sim, an.T > 2 ? 2.1 : 1);

  // 기록
  const log = store.get("log", []);
  log.unshift({ t: Date.now(), title: state.title, name: winnerName, kind: an.kind, near: nearName });
  store.set("log", log.slice(0, 30));
  renderLog();

  // 결과 카드
  $("#vTag").textContent = an.kind === "plain" ? "당첨" : an.kind === "fall" ? "당첨 · 한 칸 차이로 멈춤" : "당첨 · 핀 넘어서 멈춤";
  $("#vName").textContent = winnerName;
  let near = "";
  if (an.kind === "fall" && nearName) near = `바로 옆 '${nearName}'에서 한 칸 차이로 떨어졌어요`;
  if (an.kind === "creep" && nearName) near = `'${nearName}'에 걸렸다가 핀을 기어 넘었어요`;
  if (elim.checked) {
    pendingOut = lastRun.winnerItem;
    near += `${near ? " · " : ""}다음 판에서 이 칸은 빠져요`;
  }
  $("#vNear").textContent = near;
  $("#verdict").hidden = false;
  lockUI(false);
  spinBtn.classList.add("is-release");
  setTimeout(() => spinBtn.classList.remove("is-release"), 600);
}

spinBtn.addEventListener("pointerdown", () => !spinning && spinBtn.classList.add("is-pressed"));
["pointerup", "pointerleave", "pointercancel"].forEach((ev) => spinBtn.addEventListener(ev, () => spinBtn.classList.remove("is-pressed")));
spinBtn.addEventListener("click", () => spin(0.3 + rnd() * 0.5));

// 판을 손가락으로 튕겨서 돌리기
(() => {
  let start = null;
  wheelCanvas.addEventListener("pointerdown", (e) => {
    if (spinning) return;
    start = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  wheelCanvas.addEventListener("pointerup", (e) => {
    if (!start || spinning) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const dt = Math.max(16, performance.now() - start.t);
    start = null;
    const dist = Math.hypot(dx, dy);
    if (dist < 40) return;
    const speed = dist / dt; // px/ms
    spin(Math.min(1, speed / 2.5));
  });
  wheelCanvas.addEventListener("pointercancel", () => (start = null));
})();

$("#replay").addEventListener("click", async () => {
  if (!lastRun || spinning) return;
  lockUI(true);
  $("#replayBug").hidden = false;
  jamak(null);
  document.querySelector(".studio--app").scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  await playback(lastRun.sim, lastRun.an, { live: false, nearName: lastRun.nearName, winnerName: lastRun.winnerName });
  await sleep(500);
  await zoomOut(lastRun.sim);
  $("#replayBug").hidden = true;
  jamak("당첨!!", "jamak--win", lastRun.winnerName);
  lockUI(false);
});

/* ---------- 기록 ---------- */
function renderLog() {
  const log = store.get("log", []);
  const el = $("#log");
  $("#clearLog").hidden = !log.length;
  if (!log.length) {
    el.innerHTML = `<li class="log__empty">아직 녹화한 판이 없어요. 돌리면 여기에 쌓여요.</li>`;
    return;
  }
  el.innerHTML = log
    .map((l) => {
      const d = new Date(l.t);
      const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      const kind = l.kind === "fall" ? "한 칸 차이" : l.kind === "creep" ? "핀 넘김" : "";
      return `<li><span class="log__time">${time}</span><span class="log__what">${escapeHtml(l.title)} → <b>${escapeHtml(l.name)}</b></span><span class="log__kind">${kind}</span></li>`;
    })
    .join("");
}
$("#clearLog").addEventListener("click", () => {
  store.set("log", []);
  renderLog();
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/* ---------- 공유 ---------- */
function shareUrl() {
  return urlWith({ w: encodeState({ t: state.title, i: state.items.map((it) => [it.name, it.weight]) }) });
}

$("#shareLink").addEventListener("click", () => {
  share({ title: `${state.title} 룰렛`, text: `'${state.title}' 룰렛 같이 돌려요`, url: shareUrl() });
});

$("#saveCard").addEventListener("click", async () => {
  if (!lastRun) return;
  const btn = $("#saveCard");
  btn.disabled = true;
  try {
    const canvas = drawCard(lastRun);
    await shareImage(canvas, { filename: "roulette-result.png", title: "룰렛 결과", text: `${lastRun.title}: ${lastRun.winnerName} 당첨!` });
  } finally {
    btn.disabled = false;
  }
});

function outlined(ctx, text, x, y, { size, fill, stroke = "#161616", lw = 12, rot = 0, shadow = 6 }) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.font = `400 ${size}px ${DISPLAY_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = lw;
  ctx.strokeStyle = stroke;
  if (shadow) {
    ctx.fillStyle = stroke;
    ctx.strokeText(text, shadow, shadow);
    ctx.fillText(text, shadow, shadow);
  }
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = fill;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function fitSize(ctx, text, max, size) {
  ctx.font = `400 ${size}px ${DISPLAY_FONT}`;
  while (ctx.measureText(text).width > max && size > 24) {
    size -= 2;
    ctx.font = `400 ${size}px ${DISPLAY_FONT}`;
  }
  return size;
}

function drawCard(run) {
  const W = 540;
  const H = 675;
  const { canvas, ctx } = createCanvas(W, H, 2);
  ctx.fillStyle = "#1c1c1e";
  ctx.fillRect(0, 0, W, H);
  // 조명 원뿔
  ctx.fillStyle = "rgba(255,244,205,0.08)";
  [
    [60, -0.25],
    [270, 0],
    [480, 0.25],
  ].forEach(([x, a]) => {
    ctx.save();
    ctx.translate(x, -20);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(14, 0);
    ctx.lineTo(130, 700);
    ctx.lineTo(-130, 700);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
  // 바닥
  ctx.fillStyle = "#141414";
  ctx.fillRect(0, H - 150, W, 150);
  ctx.fillStyle = "#161616";
  ctx.fillRect(0, H - 153, W, 4);

  // 돌림판 (최종 각도)
  const s = sample(run.sim, run.sim.t + 0.6);
  view.draw(s.th, s.f, { zoom: 1 });
  const vw = 400;
  const vh = vw * (view.H / view.W);
  ctx.drawImage(view.canvas, (W - vw) / 2, 74, vw, vh);

  // 코너 타이틀
  ctx.save();
  ctx.translate(24, 24);
  ctx.rotate(-0.07);
  ctx.fillStyle = "#ff3b2f";
  ctx.fillRect(0, 0, 76, 26);
  ctx.fillStyle = "#fff";
  ctx.font = `400 16px ${DISPLAY_FONT}`;
  ctx.textBaseline = "middle";
  ctx.fillText("복불복", 10, 14);
  ctx.font = `400 28px ${DISPLAY_FONT}`;
  const tw = Math.min(300, ctx.measureText(run.title).width + 28);
  ctx.fillStyle = "#161616";
  ctx.fillRect(6, 32, tw, 44);
  ctx.fillStyle = "#ffd400";
  ctx.fillRect(0, 26, tw, 44);
  ctx.strokeStyle = "#161616";
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 26, tw, 44);
  ctx.fillStyle = "#161616";
  ctx.fillText(run.title, 14, 49, tw - 24);
  ctx.restore();

  outlined(ctx, "당첨!!", W - 128, 120, { size: 64, fill: "#ff3b2f", rot: -0.1 });
  const ns = fitSize(ctx, run.winnerName, W - 70, 72);
  outlined(ctx, run.winnerName, W / 2, H - 112, { size: ns, fill: "#ffd400", rot: 0.03, lw: 14 });
  ctx.font = `700 18px ${CANVAS_FONT}`;
  ctx.textAlign = "center";
  ctx.fillStyle = "#f3ead6";
  let sub = "";
  if (run.an.kind === "fall" && run.nearName) sub = `'${run.nearName}'에서 한 칸 차이로 멈춤`;
  else if (run.an.kind === "creep" && run.nearName) sub = `'${run.nearName}'에서 핀을 기어 넘어 당첨`;
  if (sub) ctx.fillText(sub, W / 2, H - 52);
  ctx.font = `600 14px ${CANVAS_FONT}`;
  ctx.fillStyle = "#8a8a8e";
  const d = new Date();
  ctx.fillText(`룰렛 돌리기 · ${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`, W / 2, H - 22);

  redrawFinal(run);
  return canvas;
}

function redrawFinal(run) {
  const s = sample(run.sim, run.sim.t + 0.6);
  view.draw(s.th, s.f, { zoom: 1 });
}

// 개발 확인용 훅 (스크린샷 검증)
window.__roulette = { spin, enterApp, get last() { return lastRun; } };
