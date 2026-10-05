// 제비뽑기 — 캡슐 뽑기 기계
// 방식: 한 명씩 뽑기(이름 캡슐, 비복원) / 당첨·꽝(금색 캡슐 N개, 폰 돌려 각자 뽑기)
import {
  $, $$, createStore, toast, haptic, share, shareImage, encodeState, decodeState, urlWith, getParam, copyText,
  showView, renderMoreSites, renderCrumb, createCanvas, CANVAS_FONT, todayKey, openSheet, prefersReducedMotion, sleep,
} from "../shared/kit.js";
import { createMachine, readArt } from "./machine.js";
import { startIntro } from "./intro.js";

const MAX = 60;
const TAU = Math.PI * 2;
const store = createStore("gacha");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36);

// 공정한 난수: crypto 우선
function randInt(n) {
  try {
    const a = new Uint32Array(1);
    const lim = Math.floor(2 ** 32 / n) * n;
    do crypto.getRandomValues(a);
    while (a[0] >= lim);
    return a[0] % n;
  } catch {
    return Math.floor(Math.random() * n);
  }
}

/* ---------- 상태 ---------- */
const last = store.get("last", null);
const state = {
  mode: last?.mode === "win" ? "win" : "one",
  names: Array.isArray(last?.names) ? last.names.slice(0, MAX) : [],
  wins: Number.isInteger(last?.wins) ? last.wins : 1,
};
const persist = () => store.set("last", state);
const getLists = () => store.get("lists", []);
const setLists = (l) => store.set("lists", l);
const getHistory = () => store.get("history", []);
const setHistory = (h) => store.set("history", h.slice(0, 30));
const listKey = (names) => names.join("\u0001");

// 공유 링크로 받은 명단
const sharedIn = (() => {
  const s = getParam("s");
  if (!s) return null;
  const d = decodeState(s);
  if (!d || !Array.isArray(d.n)) return null;
  const names = [...new Set(d.n.map((x) => String(x).trim().slice(0, 12)).filter(Boolean))].slice(0, MAX);
  if (names.length < 2) return null;
  return { names, mode: d.m === "win" ? "win" : "one", wins: Math.max(1, Math.min(names.length - 1, Number(d.w) || 1)), title: typeof d.t === "string" ? d.t.slice(0, 16) : "" };
})();
if (sharedIn) {
  Object.assign(state, { names: sharedIn.names, mode: sharedIn.mode, wins: sharedIn.wins });
  const inv = $("#invite");
  inv.hidden = false;
  inv.textContent = `${sharedIn.title ? sharedIn.title + " · " : ""}받은 명단 ${sharedIn.names.length}명 (${sharedIn.names.slice(0, 3).join(", ")}${sharedIn.names.length > 3 ? " …" : ""})이 들어 있어요`;
}

/* ---------- 첫 화면 ---------- */
let introCtl = null;
function enterIntro() {
  stopPlay();
  showView("intro");
  introCtl?.stop();
  introCtl = startIntro($("#introMachine"));
  renderIntroLists();
}
function enterSetup() {
  introCtl?.stop();
  introCtl = null;
  stopPlay();
  showView("setup");
  renderSetup();
}

function renderIntroLists() {
  const lists = getLists().slice(0, 4);
  $("#introLists").innerHTML = lists
    .map((l) => `<button class="list-chip" data-ilist="${l.id}">${esc(l.title)} <small>${l.names.length}명 바로 뽑기</small></button>`)
    .join("");
}
$("#introLists").addEventListener("click", (e) => {
  const b = e.target.closest("[data-ilist]");
  if (!b) return;
  const l = getLists().find((x) => x.id === b.dataset.ilist);
  if (!l) return;
  state.names = l.names.slice(0, MAX);
  persist();
  enterSetup();
});

$("#start").addEventListener("click", async (e) => {
  const b = e.currentTarget;
  if (b.classList.contains("is-in")) return;
  b.classList.add("is-in");
  haptic([6, 40, 14]);
  await sleep(prefersReducedMotion() ? 0 : 480);
  b.classList.remove("is-in");
  enterSetup();
});
$("#toIntro").addEventListener("click", enterIntro);

/* ---------- 명단 ---------- */
const parseNames = (t) =>
  String(t)
    .split(/[,，、\n\t/·]+/)
    .flatMap((s) => (s.trim().includes(" ") && !/[a-zA-Z]/.test(s) ? s.trim().split(/\s+/) : [s]))
    .map((s) => s.trim().slice(0, 12))
    .filter(Boolean);

function addNames(list) {
  let added = 0;
  for (const nm of list) {
    if (state.names.length >= MAX) {
      toast(`최대 ${MAX}명까지 넣을 수 있어요`);
      break;
    }
    if (state.names.includes(nm)) continue;
    state.names.push(nm);
    added++;
  }
  if (!added && list.length) toast("이미 있는 이름이에요");
  if (added) haptic(6);
  persist();
  renderSetup();
}

$("#addForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const inp = $("#nameInput");
  const list = parseNames(inp.value);
  if (!list.length) return;
  addNames(list);
  inp.value = "";
  inp.focus({ preventScroll: true });
});
$("#nameInput").addEventListener("paste", (e) => {
  const list = parseNames(e.clipboardData?.getData("text") || "");
  if (list.length > 1) {
    e.preventDefault();
    addNames(list);
    toast(`${list.length}명을 한 번에 넣었어요`);
  }
});
$("#sample").addEventListener("click", () => addNames(["민지", "철수", "영희", "지훈", "수아"]));
$("#clearNames").addEventListener("click", () => {
  state.names = [];
  persist();
  renderSetup();
});
$("#slips").addEventListener("click", (e) => {
  const b = e.target.closest("[data-rm]");
  if (!b) return;
  state.names.splice(Number(b.dataset.rm), 1);
  persist();
  renderSetup();
});
$$(".mode-cap").forEach((b) =>
  b.addEventListener("click", () => {
    state.mode = b.dataset.mode;
    haptic(6);
    persist();
    renderSetup();
  })
);
$("#winMinus").addEventListener("click", () => {
  state.wins = Math.max(1, state.wins - 1);
  persist();
  renderSetup();
});
$("#winPlus").addEventListener("click", () => {
  state.wins = Math.min(Math.max(1, state.names.length - 1), state.wins + 1);
  persist();
  renderSetup();
});

$("#listRow").addEventListener("click", (e) => {
  const del = e.target.closest("[data-del]");
  if (del) {
    e.stopPropagation();
    const l = getLists().find((x) => x.id === del.dataset.del);
    if (l && confirm(`"${l.title}" 명단을 지울까요?`)) {
      setLists(getLists().filter((x) => x.id !== l.id));
      renderSetup();
    }
    return;
  }
  const b = e.target.closest("[data-list]");
  if (!b) return;
  const l = getLists().find((x) => x.id === b.dataset.list);
  if (!l) return;
  state.names = l.names.slice(0, MAX);
  persist();
  haptic(8);
  toast(`${l.title} 명단을 불러왔어요`);
  renderSetup();
});
$("#saveList").addEventListener("click", () => openSaveSheet());
$("#historyList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-hist]");
  if (!b) return;
  const h = getHistory().find((x) => x.id === b.dataset.hist);
  if (!h) return;
  state.names = h.names.slice(0, MAX);
  state.mode = h.mode;
  if (h.mode === "win") state.wins = h.wins;
  persist();
  toast("그때 명단을 다시 불러왔어요");
  renderSetup();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

const fmtDate = (ts) => {
  const d = new Date(ts);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

function renderSetup() {
  const n = state.names.length;
  if (state.wins > Math.max(1, n - 1)) state.wins = Math.max(1, n - 1);
  $("#count").textContent = `${n}명`;
  $("#slips").innerHTML = n
    ? state.names
        .map((nm, i) => `<span class="slip" style="--tilt:${((i * 37) % 7) - 3}deg"><span class="slip__no">${i + 1}</span>${esc(nm)}<button class="slip__x" data-rm="${i}" aria-label="${esc(nm)} 빼기">×</button></span>`)
        .join("")
    : '<p class="slips__empty">아직 쪽지가 없어요. 이름을 넣어 주세요</p>';
  $("#sample").hidden = n > 0;
  $("#clearNames").hidden = n === 0;
  const key = listKey(state.names);
  const lists = getLists();
  const cur = lists.find((l) => listKey(l.names) === key);
  $("#saveList").hidden = n < 2 || !!cur;
  $("#lists").hidden = lists.length === 0;
  $("#listRow").innerHTML = lists
    .map(
      (l) => `<button class="list-chip${cur && cur.id === l.id ? " is-selected" : ""}" data-list="${l.id}">${esc(l.title)} <small>${l.names.length}명</small><span class="list-chip__x" data-del="${l.id}" role="button" aria-label="${esc(l.title)} 지우기">×</span></button>`
    )
    .join("");
  $$(".mode-cap").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.mode === state.mode)));
  $("#winBox").hidden = state.mode !== "win";
  $("#winVal").textContent = state.wins;
  $("#winMinus").disabled = state.wins <= 1;
  $("#winPlus").disabled = state.wins >= n - 1;
  $("#winNote").textContent = n >= 2 ? `${n}명 중 ${state.wins}명 · 1인당 ${Math.round((state.wins / n) * 1000) / 10}%` : "";
  const ok = n >= 2;
  $("#go").disabled = !ok;
  $("#goLabel").textContent = ok ? `캡슐 ${n}개 채우기` : "캡슐 채우기";
  $("#ctaHint").textContent = !ok
    ? "2명 이상 넣어 주세요"
    : state.mode === "one"
      ? `이름 캡슐 ${n}개 · 뽑은 캡슐은 다시 안 넣어요`
      : `금색 ${state.wins}개 + 일반 ${n - state.wins}개 · 적은 순서대로 한 명씩`;
  const hist = getHistory().slice(0, 5);
  $("#history").hidden = hist.length === 0;
  $("#historyList").innerHTML = hist
    .map((h) => {
      const what =
        h.mode === "one"
          ? `${h.picks.map((p) => p.name).join(" → ") || "아직 안 뽑음"}`
          : `당첨 ${h.picks.filter((p) => p.win).map((p) => p.name).join(", ") || "아직 없음"}`;
      return `<li><button class="history__item btn--plain" data-hist="${h.id}"><small>${fmtDate(h.ts)} · ${h.mode === "one" ? "한 명씩" : `당첨 ${h.wins}/${h.names.length}`} · ${h.picks.length}/${h.names.length}칸</small><span>${esc(what)}</span></button></li>`;
    })
    .join("");
}

/* ---------- 명단 저장 시트 ---------- */
let sheetEl = null;
function openSaveSheet() {
  if (!sheetEl) {
    sheetEl = document.createElement("div");
    sheetEl.className = "sheet";
    sheetEl.setAttribute("role", "dialog");
    sheetEl.setAttribute("aria-label", "명단 저장");
    sheetEl.innerHTML = `
      <form class="stack gap-16" id="listForm">
        <p class="pen-label">명단에 이름 붙이기</p>
        <label class="field">
          <span class="field__label">명단 이름</span>
          <input class="input" id="listName" maxlength="16" placeholder="우리 반" />
        </label>
        <p class="t-caption-01 t-tertiary m0" id="listMembers"></p>
        <div class="row gap-8">
          <button type="button" class="btn btn--ghost grow" data-sheet-close>취소</button>
          <button type="submit" class="btn btn--primary grow">저장하기</button>
        </div>
      </form>`;
    document.body.appendChild(sheetEl);
  }
  let title = "우리 반";
  const lists = getLists();
  for (let k = 2; lists.some((l) => l.title === title); k++) title = `우리 반 ${k}`;
  $("#listName", sheetEl).value = title;
  $("#listMembers", sheetEl).textContent = `${state.names.length}명: ${state.names.slice(0, 12).join(", ")}${state.names.length > 12 ? " …" : ""}`;
  const close = openSheet(sheetEl);
  $("#listForm", sheetEl).onsubmit = (e) => {
    e.preventDefault();
    const t = $("#listName", sheetEl).value.trim() || "우리 반";
    const next = getLists().filter((l) => listKey(l.names) !== listKey(state.names));
    next.unshift({ id: uid(), title: t, names: state.names.slice() });
    setLists(next.slice(0, 12));
    close();
    haptic(10);
    toast(`${t} 명단을 저장했어요`);
    renderSetup();
  };
}

/* ================= 뽑기 ================= */
let session = null;
let m = null; // 기계
let raf = 0;
let playing = false;
let lastNow = 0;
const crank = { down: false, moved: false, downAt: 0, lastA: 0, pending: 0, steps: 0, progress: 0, busy: false };

function newSession() {
  const names = state.names.slice();
  const M = names.length;
  // 캡슐 색은 섞어서 (이름 순서를 색으로 알 수 없게)
  const colors = Array.from({ length: M }, () => randInt(7));
  const pool =
    state.mode === "one"
      ? names.map((name, i) => ({ id: `c${i}`, name, gold: false, color: colors[i] }))
      : Array.from({ length: M }, (_, i) => ({ id: `c${i}`, gold: i < state.wins, color: colors[i] }));
  session = { id: uid(), ts: Date.now(), mode: state.mode, names, wins: state.mode === "win" ? state.wins : 0, pool, picks: [], current: null };
}

function saveSession() {
  if (!session) return;
  const h = getHistory().filter((x) => x.id !== session.id);
  h.unshift({ id: session.id, ts: session.ts, mode: session.mode, names: session.names, wins: session.wins, picks: session.picks });
  setHistory(h);
}

async function startDraw() {
  newSession();
  introCtl?.stop();
  introCtl = null;
  showView("draw");
  if (!m) {
    m = createMachine($("#playMachine canvas"));
    new ResizeObserver(() => {
      m.resize();
      placePlay();
    }).observe($("#playMachine"));
    bindCrank();
  } else m.resize();
  placePlay();
  m.clearOut();
  m.setKnob(0);
  crank.progress = 0;
  crank.steps = 0;
  crank.pending = 0;
  crank.busy = false;
  m.progress = 0;
  m.fill(session.pool, { drop: !prefersReducedMotion(), stagger: Math.min(0.06, 1.6 / session.pool.length) });
  $("#reveal").hidden = true;
  $("#crankHint").hidden = !!store.get("hinted", false);
  renderDraw();
  playing = true;
  lastNow = performance.now();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(tick);
}

function stopPlay() {
  playing = false;
  cancelAnimationFrame(raf);
}

function placePlay() {
  const g = m.geo;
  const k = g.knob;
  Object.assign($("#knobBtn").style, { left: `${k.x - k.r * 1.4}px`, top: `${k.y - k.r * 1.4}px`, width: `${k.r * 2.8}px`, height: `${k.r * 2.8}px` });
  const hint = $("#crankHint");
  Object.assign(hint.style, { left: "auto", right: `${Math.max(4, g.W - (g.bx + g.bw) + 2)}px`, top: `${Math.max(48, g.domeCy - g.R * 0.15)}px` });
}

function tick(now) {
  if (!playing) return;
  raf = requestAnimationFrame(tick);
  const dt = Math.min(0.05, (now - lastNow) / 1000);
  lastNow = now;
  if (document.hidden) return;
  // 꾹 누르고 있으면 자동으로 돌아감
  if (crank.down && !crank.moved && now - crank.downAt > 220) crank.pending = Math.max(crank.pending, 0.3);
  if (crank.pending > 0 && !crank.busy) {
    const step = Math.min(crank.pending, 7 * dt);
    crank.pending -= step;
    turn(step);
  }
  m.update(dt);
  m.draw();
}

// 손잡이 회전 (라디안, 시계 방향만)
function turn(d) {
  if (crank.busy || !session || !session.pool.length) return;
  m.setKnob(m.knobAngle + d);
  crank.progress += d / TAU;
  m.progress = Math.min(1, crank.progress);
  const steps = Math.floor(crank.progress * 6 + 1e-6);
  if (steps > crank.steps) {
    crank.steps = steps;
    haptic(9);
    m.click(steps % 2 ? "딸깍" : "끼릭");
  }
  if (crank.progress >= 1) {
    crank.progress = 0;
    crank.steps = 0;
    crank.pending = 0;
    m.progress = 0;
    dispense();
  }
}

function bindCrank() {
  const cv = $("#playMachine canvas");
  const pt = (e) => {
    const r = cv.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  cv.addEventListener("pointerdown", (e) => {
    const [x, y] = pt(e);
    const k = m.geo.knob;
    const dist = Math.hypot(x - k.x, y - k.y);
    if (dist <= k.r * 1.8) {
      if (!session?.pool.length) return toast("캡슐이 다 떨어졌어요. 다시 채워 주세요");
      if (crank.busy) return;
      crank.down = true;
      crank.moved = false;
      crank.downAt = performance.now();
      crank.lastA = Math.atan2(y - k.y, x - k.x);
      cv.setPointerCapture?.(e.pointerId);
      haptic(4);
    } else if (Math.hypot(x - m.geo.cx, y - m.geo.domeCy) < m.geo.R) {
      m.jiggle(0.9);
      haptic(12);
    }
  });
  cv.addEventListener("pointermove", (e) => {
    if (!crank.down) return;
    const [x, y] = pt(e);
    const k = m.geo.knob;
    if (Math.hypot(x - k.x, y - k.y) < k.r * 0.25) return;
    const a = Math.atan2(y - k.y, x - k.x);
    let d = a - crank.lastA;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    crank.lastA = a;
    if (Math.abs(d) > 0.015) crank.moved = true;
    if (d > 0) turn(d);
  });
  const up = () => {
    if (!crank.down) return;
    crank.down = false;
    // 톡 누르거나 꾹 누르다 떼면: 다음 딸깍(60°)까지 마저 돌린다
    if (!crank.moved) crank.pending = Math.max(0, ((crank.steps + 1) / 6 - crank.progress) * TAU) + 0.002;
  };
  cv.addEventListener("pointerup", up);
  cv.addEventListener("pointercancel", up);
  $("#knobBtn").addEventListener("click", () => {
    if (!crank.busy && session?.pool.length) crank.pending = TAU * (1 - crank.progress) + 0.01;
  });
}

function dispense() {
  crank.busy = true;
  const idx = randInt(session.pool.length);
  const cap = session.pool.splice(idx, 1)[0];
  session.current = cap;
  if (!store.get("hinted", false)) {
    store.set("hinted", true);
    $("#crankHint").hidden = true;
  }
  haptic([20, 60, 30]);
  m.dispense(cap.id, () => setTimeout(() => showReveal(cap), 260));
  renderLeft();
}

/* ---------- 캡슐 열기 ---------- */
const tw = { p: 0, dir: 1, open: false, x0: 0, lastX: 0, moved: false, ticks: 0 };
function showReveal(cap) {
  const art = readArt();
  const rev = $("#reveal");
  const capEl = $("#revealCap");
  capEl.className = `reveal__cap${cap.gold ? " is-gold" : ""}`;
  capEl.style.setProperty("--top", art.caps[cap.color % art.caps.length]);
  capEl.style.setProperty("--tw", "0deg");
  capEl.style.setProperty("--gap", "0px");
  $("#paper").className = "paper";
  $("#revealNext").hidden = true;
  $("#revealHint").hidden = false;
  Object.assign(tw, { p: 0, open: false, moved: false, ticks: 0 });
  rev.hidden = false;
  rev.tabIndex = 0;
  rev.focus({ preventScroll: true });
}

function twistBy(dp) {
  if (tw.open) return;
  tw.p = Math.min(1, tw.p + dp);
  const capEl = $("#revealCap");
  capEl.style.setProperty("--tw", `${tw.dir * Math.sin(tw.p * 9) * 18 * Math.min(1, tw.p * 2)}deg`);
  capEl.style.setProperty("--gap", `${tw.p * 10}px`);
  const t = Math.floor(tw.p * 5);
  if (t > tw.ticks) {
    tw.ticks = t;
    haptic(6);
  }
  if (tw.p >= 1) openCapsule();
}

function openCapsule() {
  tw.open = true;
  const cap = session.current;
  const k = session.picks.length;
  const name = session.mode === "one" ? cap.name : session.names[k];
  const win = session.mode === "win" ? cap.gold : null;
  session.picks.push({ name, win });
  saveSession();
  $("#revealCap").classList.add("is-open");
  $("#revealHint").hidden = true;
  $("#paperNo").textContent = session.mode === "one" ? `${k + 1}번째 캡슐` : `${name}의 캡슐`;
  $("#paperName").textContent = session.mode === "one" ? name : win ? "당첨!" : "꽝";
  $("#paperStamp").textContent = session.mode === "one" ? (k === 0 ? "1등" : "") : win ? "당첨" : "꽝";
  const paper = $("#paper");
  paper.classList.toggle("is-lose", win === false);
  setTimeout(() => paper.classList.add("is-open"), 140);
  haptic(win ? [30, 50, 30, 50, 120] : [20, 40, 40]);
  renderDraw(true);
  const next = $("#revealNext");
  next.textContent = session.pool.length ? (session.mode === "win" ? `다음: ${session.names[k + 1]} 차례` : "다음 캡슐") : "뽑기판 보기";
  setTimeout(() => (next.hidden = false), 650);
}

$("#revealNext").addEventListener("click", (e) => {
  e.stopPropagation();
  closeReveal();
  if (!session.pool.length) {
    toast(session.mode === "win" ? "모두 뽑았어요" : "캡슐을 다 뽑았어요");
    $("#board").scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
  }
});

function closeReveal() {
  $("#reveal").hidden = true;
  m.clearOut();
  crank.busy = false;
  session.current = null;
  renderDraw();
}

(function bindReveal() {
  const rev = $("#reveal");
  rev.addEventListener("pointerdown", (e) => {
    if (tw.open || e.target.closest("button")) return;
    tw.x0 = tw.lastX = e.clientX;
    tw.moved = false;
    tw.down = true;
    rev.setPointerCapture?.(e.pointerId);
  });
  rev.addEventListener("pointermove", (e) => {
    if (!tw.down || tw.open) return;
    const dx = e.clientX - tw.lastX;
    tw.lastX = e.clientX;
    if (Math.abs(e.clientX - tw.x0) > 6) tw.moved = true;
    if (dx) tw.dir = Math.sign(dx);
    twistBy(Math.abs(dx) / 220);
  });
  const up = () => {
    if (!tw.down) return;
    tw.down = false;
    if (!tw.moved) twistBy(0.34);
  };
  rev.addEventListener("pointerup", up);
  rev.addEventListener("pointercancel", up);
  rev.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (tw.open) $("#revealNext").hidden || $("#revealNext").click();
      else twistBy(0.34);
    }
  });
})();

/* ---------- 뽑기판·차례 ---------- */
function renderLeft() {
  const golds = session.pool.filter((c) => c.gold).length;
  $("#left").textContent = session.mode === "win" ? `남은 ${session.pool.length} · 금 ${golds}` : `남은 캡슐 ${session.pool.length}`;
}

function renderDraw(fresh = false) {
  if (!session) return;
  const s = session;
  $("#drawTitle").textContent = s.mode === "one" ? "한 명씩 뽑기" : `당첨 ${s.wins} · 꽝 ${s.names.length - s.wins}`;
  renderLeft();
  const turnEl = $("#turn");
  if (s.mode === "win" && s.picks.length < s.names.length) {
    const who = s.names[s.picks.length];
    const golds = s.pool.filter((c) => c.gold).length + (s.current?.gold && !tw.open ? 1 : 0);
    turnEl.innerHTML = `<b>${esc(who)}</b> 차례예요<small>폰을 ${esc(who)}에게 넘기고 손잡이를 돌려요 · 남은 금색 ${golds}개</small>`;
    turnEl.hidden = false;
    turnEl.classList.remove("is-swap");
    void turnEl.offsetWidth;
    turnEl.classList.add("is-swap");
  } else turnEl.hidden = true;

  const cells =
    s.mode === "one"
      ? s.names.map((_, k) => {
          const p = s.picks[k];
          const isNew = fresh && k === s.picks.length - 1;
          return `<li class="cell${p ? "" : " is-empty"}${isNew ? " is-new" : ""}"><span class="cell__no">${k + 1}</span><span class="cell__name">${p ? esc(p.name) : ""}</span></li>`;
        })
      : s.names.map((nm, k) => {
          const p = s.picks[k];
          const isNew = fresh && k === s.picks.length - 1;
          const cls = p ? (p.win ? " is-win" : " is-lose") : " is-empty";
          return `<li class="cell${cls}${isNew ? " is-new" : ""}"><span class="cell__no">${p ? (p.win ? "당첨" : "꽝") : k + 1}</span><span class="cell__name">${esc(nm)}</span></li>`;
        });
  $("#board").innerHTML = cells.join("");
  $("#boardSub").textContent =
    s.mode === "one"
      ? `${s.picks.length}/${s.names.length}칸 · 뽑힌 순서`
      : `${s.picks.length}/${s.names.length}명 뽑음 · 당첨 ${s.picks.filter((p) => p.win).length}/${s.wins}`;
}

$("#toSetup").addEventListener("click", () => {
  if (session && session.picks.length && session.pool.length && !confirm("뽑기를 멈추고 명단으로 갈까요? 지금까지 결과는 지난 뽑기에 남아요.")) return;
  $("#reveal").hidden = true;
  enterSetup();
});

$("#go").addEventListener("click", async (e) => {
  const b = e.currentTarget;
  if (b.disabled || b.classList.contains("is-in")) return;
  b.classList.add("is-in");
  haptic([6, 40, 14]);
  await sleep(prefersReducedMotion() ? 0 : 420);
  b.classList.remove("is-in");
  persist();
  startDraw();
});

$("#refill").addEventListener("click", () => {
  if (session && session.pool.length && session.picks.length && !confirm("남은 캡슐을 버리고 처음부터 다시 채울까요?")) return;
  startDraw();
});

/* ---------- 공유 ---------- */
function resultText() {
  const s = session;
  if (!s) return "";
  if (s.mode === "one") {
    return `🎰 제비뽑기 결과 (${s.picks.length}/${s.names.length})\n${s.picks.map((p, k) => `${k + 1}. ${p.name}`).join("\n")}`;
  }
  const win = s.picks.filter((p) => p.win).map((p) => p.name);
  const lose = s.picks.filter((p) => !p.win).map((p) => p.name);
  const wait = s.names.slice(s.picks.length);
  return `🎰 제비뽑기 당첨 ${s.wins}명 / ${s.names.length}명\n당첨: ${win.join(", ") || "-"}\n꽝: ${lose.join(", ") || "-"}${wait.length ? `\n아직: ${wait.join(", ")}` : ""}`;
}

$("#copyText").addEventListener("click", async () => {
  if (!session?.picks.length) return toast("아직 뽑은 캡슐이 없어요");
  const ok = await copyText(resultText());
  toast(ok ? "결과를 복사했어요. 단톡방에 붙여넣어요" : "복사에 실패했어요");
});

$("#shareLink").addEventListener("click", () => {
  const s = session || { names: state.names, mode: state.mode, wins: state.wins };
  const l = getLists().find((x) => listKey(x.names) === listKey(s.names));
  const url = urlWith({ s: encodeState({ n: s.names, m: s.mode, w: s.wins || state.wins, t: l?.title || "" }) });
  share({ title: "제비뽑기", text: `🎰 ${s.names.length}명 명단 넣어 뒀어요. 같이 뽑아요 👉`, url });
});

$("#shareImg").addEventListener("click", async () => {
  if (!session?.picks.length) return toast("한 개 이상 뽑으면 이미지가 만들어져요");
  const b = $("#shareImg");
  b.classList.add("is-loading");
  try {
    await shareImage(drawCard(), { filename: `gacha-${todayKey()}.png`, title: "제비뽑기 결과", text: resultText() });
  } finally {
    b.classList.remove("is-loading");
  }
});

function drawCard() {
  const art = readArt();
  const s = session;
  const W = 1080;
  const H = 1350;
  const { canvas, ctx } = createCanvas(W, H, 1);
  ctx.fillStyle = art.paper;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(120,90,40,0.08)";
  ctx.lineWidth = 2;
  for (let x = 0; x < W; x += 54) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 54) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  // 간판
  ctx.fillStyle = art.brand;
  ctx.beginPath();
  ctx.roundRect?.(72, 64, W - 144, 150, 28);
  if (!ctx.roundRect) ctx.rect(72, 64, W - 144, 150);
  ctx.fill();
  ctx.fillStyle = art.goldLight;
  for (let x = 96; x < W - 96; x += 40) {
    ctx.beginPath();
    ctx.arc(x, 82, 6, 0, TAU);
    ctx.arc(x, 196, 6, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = "#fff";
  ctx.font = `400 72px ${art.display}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("제비뽑기 결과", 112, 142);
  ctx.textAlign = "right";
  ctx.font = `700 40px ${art.pen}`;
  const d = new Date(s.ts);
  ctx.fillText(`${d.getMonth() + 1}월 ${d.getDate()}일`, W - 112, 142);
  ctx.textAlign = "left";
  ctx.fillStyle = art.ink;
  ctx.font = `700 46px ${art.pen}`;
  ctx.fillText(s.mode === "one" ? `${s.names.length}명 중 ${s.picks.length}명 뽑음 · 뽑힌 순서` : `${s.names.length}명 중 당첨 ${s.wins}명`, 80, 280);
  // 뽑기판
  const n = s.names.length;
  const cols = n <= 6 ? 2 : n <= 15 ? 3 : n <= 28 ? 4 : 5;
  const rows = Math.ceil(n / cols);
  const top = 330;
  const boardH = Math.min(860, rows * 150);
  const cellH = (boardH - 24) / rows - 10;
  const cellW = (W - 160 - 24 - (cols - 1) * 10) / cols;
  ctx.fillStyle = art.brand;
  ctx.fillRect(80, top, W - 160, boardH + 10);
  for (let k = 0; k < n; k++) {
    const x = 92 + (k % cols) * (cellW + 10);
    const y = top + 12 + Math.floor(k / cols) * (cellH + 10);
    let label;
    let sub;
    let bg = art.cream;
    if (s.mode === "one") {
      const p = s.picks[k];
      label = p ? p.name : "";
      sub = String(k + 1);
      if (!p) bg = "rgba(255,247,214,0.35)";
    } else {
      const p = s.picks[k];
      label = s.names[k];
      sub = p ? (p.win ? "당첨" : "꽝") : "?";
      if (p?.win) bg = art.goldLight;
    }
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, cellW, cellH);
    ctx.fillStyle = s.mode === "win" && s.picks[k]?.win ? art.brand : "rgba(0,0,0,0.4)";
    ctx.font = `600 ${Math.round(Math.min(30, cellH * 0.24))}px ${CANVAS_FONT}`;
    ctx.textAlign = "left";
    ctx.fillText(sub, x + 14, y + Math.min(30, cellH * 0.26));
    ctx.fillStyle = s.mode === "win" && s.picks[k] && !s.picks[k].win ? "rgba(0,0,0,0.4)" : art.ink;
    let fs = Math.round(Math.min(64, cellH * 0.48));
    ctx.font = `700 ${fs}px ${art.pen}`;
    while (ctx.measureText(label).width > cellW - 24 && fs > 20) {
      fs -= 2;
      ctx.font = `700 ${fs}px ${art.pen}`;
    }
    ctx.fillText(label, x + 14, y + cellH * 0.64);
  }
  ctx.fillStyle = art.ink;
  ctx.font = `600 30px ${CANVAS_FONT}`;
  ctx.textAlign = "left";
  ctx.fillText("뽑은 캡슐은 다시 넣지 않았어요", 80, H - 80);
  ctx.textAlign = "right";
  ctx.fillStyle = art.brand;
  ctx.font = `400 40px ${art.display}`;
  ctx.fillText("우리도 뽑기 →", W - 80, H - 80);
  return canvas;
}

/* ---------- 시작 ---------- */
renderCrumb($("#crumb"));
renderMoreSites($("#more"));
renderSetup();
enterIntro();
