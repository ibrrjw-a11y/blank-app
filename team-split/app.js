// 팀 나누기 — 카드 딜러 테이블
import {
  $, $$, createStore, toast, haptic, share, shareImage, encodeState, decodeState, urlWith, getParam, copyText,
  showView, renderMoreSites, renderCrumb, createCanvas, CANVAS_FONT, todayKey, openSheet, prefersReducedMotion, sleep,
} from "../shared/kit.js";
import { makeTeams, dealOrder, teamSizes, teamsFromPer, shuffleArr } from "./deal.js";
import { createTable, cardEl, layoutPiles, pileHead, SUITS, teamName } from "./table.js";
import { startIntro } from "./intro.js";

const MAX = 60;
const store = createStore("team-split");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
const keyOf = (names) => names.slice().sort((a, b) => a.localeCompare(b, "ko")).join("\u0001");

/* ---------- 상태 ---------- */
const saved = store.get("last", null);
const state = {
  names: Array.isArray(saved?.names) ? saved.names.slice(0, MAX) : [],
  by: saved?.by === "per" ? "per" : "teams",
  num: Number.isInteger(saved?.num) ? saved.num : 3,
  leaders: Array.isArray(saved?.leaders) ? saved.leaders : [],
  avoid: Array.isArray(saved?.avoid) ? saved.avoid : [],
  together: Array.isArray(saved?.together) ? saved.together : [],
  diff: !!saved?.diff,
};
const persist = () => store.set("last", state);
const getGroups = () => store.get("groups", []);
const setGroups = (g) => store.set("groups", g.slice(0, 12));
const getPrev = (names) => store.get("prev", {})[keyOf(names)] || null;
function setPrev(names, teams) {
  const all = store.get("prev", {});
  all[keyOf(names)] = teams;
  const keys = Object.keys(all);
  if (keys.length > 10) delete all[keys[0]];
  store.set("prev", all);
}

// 결과 링크로 받은 조 편성
const sharedIn = (() => {
  const d = decodeState(getParam("d") || "");
  if (!d || !Array.isArray(d.n) || !Array.isArray(d.a) || d.n.length !== d.a.length || d.n.length < 2) return null;
  const names = d.n.map((x) => String(x).slice(0, 12));
  const k = Math.max(...d.a) + 1;
  if (k < 1 || k > 30) return null;
  const leaders = Array.isArray(d.l) ? d.l.filter((x) => names.includes(x)) : [];
  const teams = Array.from({ length: k }, () => []);
  names.forEach((nm, i) => teams[d.a[i]]?.push(nm));
  teams.forEach((t) => t.sort((a, b) => (leaders.includes(b) ? 1 : 0) - (leaders.includes(a) ? 1 : 0)));
  return { names, teams, leaders, issues: null };
})();
if (sharedIn) {
  $("#invite").hidden = false;
  $("#invite").textContent = `받은 조 편성이 있어요 · ${sharedIn.names.length}명 → ${sharedIn.teams.length}팀`;
  $("#startLabel").textContent = "받은 결과 펼치기";
}

/* ---------- 첫 화면 ---------- */
let introCtl = null;
function enterIntro() {
  showView("intro");
  introCtl?.stop();
  introCtl = startIntro($("#intro"));
}
function enterSetup() {
  introCtl?.stop();
  introCtl = null;
  dealToken++;
  showView("setup");
  renderSetup();
}

async function shoeFire(btn) {
  btn.classList.add("is-dealing");
  haptic([8, 30, 8]);
  await sleep(prefersReducedMotion() ? 0 : 380);
  btn.classList.remove("is-dealing");
}

$("#start").addEventListener("click", async (e) => {
  await shoeFire(e.currentTarget);
  if (sharedIn) {
    introCtl?.stop();
    introCtl = null;
    state.names = sharedIn.names.slice();
    persist();
    runDeal(sharedIn, { fromLink: true });
  } else enterSetup();
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
  cleanRules();
  persist();
  renderSetup();
}

// 명단에서 빠진 사람은 규칙에서도 뺀다
function cleanRules() {
  const has = (n) => state.names.includes(n);
  state.leaders = state.leaders.filter(has);
  state.avoid = state.avoid.filter(([a, b]) => has(a) && has(b));
  state.together = state.together.filter(([a, b]) => has(a) && has(b));
  const k = teamCount();
  if (k >= 1 && state.leaders.length > k) state.leaders = state.leaders.slice(0, k);
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
$("#sample").addEventListener("click", () => addNames("민수 영희 철수 지은 수아 지훈 하늘 도윤 서연 예준 유나 시우".split(" ")));
$("#clearNames").addEventListener("click", () => {
  if (!confirm("명단과 규칙을 모두 지울까요?")) return;
  Object.assign(state, { names: [], leaders: [], avoid: [], together: [] });
  persist();
  renderSetup();
});
$("#names").addEventListener("click", (e) => {
  const b = e.target.closest("[data-rm]");
  if (!b) return;
  state.names.splice(Number(b.dataset.rm), 1);
  cleanRules();
  persist();
  renderSetup();
});

/* 나누는 방법 */
function teamCount() {
  const n = state.names.length;
  if (n < 2) return 0;
  return state.by === "teams" ? Math.min(state.num, n) : teamsFromPer(n, state.num);
}
function numRange() {
  const n = Math.max(2, state.names.length);
  return state.by === "teams" ? [2, Math.min(20, n)] : [1, Math.max(1, Math.floor(n / 2))];
}
$$(".seg__btn").forEach((b) =>
  b.addEventListener("click", () => {
    if (state.by === b.dataset.by) return;
    const n = state.names.length;
    const k = teamCount();
    state.by = b.dataset.by;
    // 같은 결과가 되도록 숫자를 바꿔 준다
    if (n >= 2 && k >= 2) state.num = state.by === "teams" ? k : Math.max(1, Math.floor(n / k));
    haptic(6);
    persist();
    renderSetup();
  })
);
$("#numMinus").addEventListener("click", () => {
  state.num = Math.max(numRange()[0], state.num - 1);
  cleanRules();
  persist();
  renderSetup();
});
$("#numPlus").addEventListener("click", () => {
  state.num = Math.min(numRange()[1], state.num + 1);
  cleanRules();
  persist();
  renderSetup();
});

/* 규칙: 팀장, 금지, 필수 */
const firstPick = { avoid: null, together: null };
$("#leadPicks").addEventListener("click", (e) => {
  const b = e.target.closest("[data-name]");
  if (!b) return;
  const nm = b.dataset.name;
  const k = teamCount();
  if (state.leaders.includes(nm)) state.leaders = state.leaders.filter((x) => x !== nm);
  else if (state.leaders.length >= k) return toast(`팀장은 팀 수만큼, ${k}명까지예요`);
  else state.leaders.push(nm);
  haptic(6);
  persist();
  renderRules();
});
["avoid", "together"].forEach((kind) => {
  $(`#${kind}Picks`).addEventListener("click", (e) => {
    const b = e.target.closest("[data-name]");
    if (!b) return;
    const nm = b.dataset.name;
    const first = firstPick[kind];
    if (!first) firstPick[kind] = nm;
    else if (first === nm) firstPick[kind] = null;
    else {
      const other = kind === "avoid" ? "together" : "avoid";
      const same = (p) => (p[0] === first && p[1] === nm) || (p[0] === nm && p[1] === first);
      if (state[kind].some(same)) toast("이미 있는 쌍이에요");
      else {
        state[other] = state[other].filter((p) => !same(p));
        state[kind].push([first, nm]);
        haptic([8, 30, 8]);
      }
      firstPick[kind] = null;
      persist();
    }
    renderRules();
  });
  $(`#${kind}Pairs`).addEventListener("click", (e) => {
    const b = e.target.closest("[data-rmpair]");
    if (!b) return;
    state[kind].splice(Number(b.dataset.rmpair), 1);
    persist();
    renderRules();
  });
});
$("#diffToggle").addEventListener("change", (e) => {
  state.diff = e.target.checked;
  persist();
});

/* 그룹 */
$("#groupRow").addEventListener("click", (e) => {
  const b = e.target.closest("[data-group]");
  if (!b) return;
  const g = getGroups().find((x) => x.id === b.dataset.group);
  if (!g) return;
  state.names = g.names.slice(0, MAX);
  cleanRules();
  persist();
  haptic(8);
  toast(`${g.title} 명단을 불러왔어요`);
  renderSetup();
});
$("#saveGroup").addEventListener("click", () => openSaveSheet());

let sheetEl = null;
function openSaveSheet() {
  if (!sheetEl) {
    sheetEl = document.createElement("div");
    sheetEl.className = "sheet";
    sheetEl.setAttribute("role", "dialog");
    sheetEl.setAttribute("aria-label", "그룹 저장");
    sheetEl.innerHTML = `
      <form class="stack gap-16" id="groupForm">
        <p class="t-title-04 m0">그룹 이름</p>
        <input class="input" id="groupName" maxlength="16" placeholder="3반" />
        <p class="t-caption-01 t-tertiary m0" id="groupMembers"></p>
        <div class="row gap-8">
          <button type="button" class="btn btn--ghost grow" data-sheet-close>취소</button>
          <button type="submit" class="btn btn--primary grow">저장하기</button>
        </div>
      </form>`;
    document.body.appendChild(sheetEl);
  }
  let title = "우리 반";
  const gs = getGroups();
  for (let k = 2; gs.some((g) => g.title === title); k++) title = `우리 반 ${k}`;
  $("#groupName", sheetEl).value = title;
  $("#groupMembers", sheetEl).textContent = `${state.names.length}명: ${state.names.slice(0, 14).join(", ")}${state.names.length > 14 ? " …" : ""}`;
  const close = openSheet(sheetEl);
  $("#groupForm", sheetEl).onsubmit = (e) => {
    e.preventDefault();
    const t = $("#groupName", sheetEl).value.trim() || "우리 반";
    const next = getGroups().filter((g) => keyOf(g.names) !== keyOf(state.names));
    next.unshift({ id: uid(), title: t, names: state.names.slice() });
    setGroups(next);
    close();
    haptic(10);
    toast(`${t} 그룹을 저장했어요`);
    renderSetup();
  };
}

/* ---------- 그리기 ---------- */
function renderSetup() {
  const n = state.names.length;
  const [lo, hi] = numRange();
  if (n >= 2) state.num = Math.min(hi, Math.max(lo, state.num));
  $("#count").textContent = `${n}명`;
  $("#names").innerHTML = n
    ? state.names.map((nm, i) => `<span class="mini"><i>${SUITS[i % 4]}</i>${esc(nm)}<button class="mini__x" data-rm="${i}" aria-label="${esc(nm)} 빼기">×</button></span>`).join("")
    : '<p class="minis__empty">아직 카드가 없어요. 이름을 넣어 주세요</p>';
  $("#sample").hidden = n > 0;
  $("#clearNames").hidden = n === 0;
  const g = getGroups().find((x) => keyOf(x.names) === keyOf(state.names));
  $("#saveGroup").hidden = n < 2 || !!g;
  const groups = getGroups();
  $("#groups").hidden = groups.length === 0;
  $("#groupRow").innerHTML = groups
    .map((x) => `<button class="chip group-chip${g && g.id === x.id ? " is-selected" : ""}" data-group="${x.id}">${esc(x.title)} <small>${x.names.length}명</small></button>`)
    .join("");

  $$(".seg__btn").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.by === state.by)));
  $("#numVal").textContent = state.num;
  $("#numUnit").textContent = state.by === "teams" ? "팀" : "명씩";
  $("#numMinus").disabled = state.num <= lo;
  $("#numPlus").disabled = state.num >= hi;
  const k = teamCount();
  const sizes = k >= 2 ? teamSizes(n, k) : [];
  $("#splitSum").innerHTML =
    n < 2 ? "이름을 2명 이상 넣으면 몇 명씩 나뉘는지 보여 줘요" : k < 2 ? "이대로면 한 팀뿐이에요. 숫자를 줄여 주세요" : `<b>${n}명 → ${k}팀</b> · ${sizes.join(" · ")}명`;
  renderRules();
  const ok = n >= 2 && k >= 2;
  $("#go").disabled = !ok;
  $("#goLabel").textContent = ok ? `${k}팀으로 딜하기` : "딜하기";
  const ruleBits = [state.leaders.length && `팀장 ${state.leaders.length}`, state.avoid.length && `금지 ${state.avoid.length}쌍`, state.together.length && `필수 ${state.together.length}쌍`, state.diff && getPrev(state.names) && "지난번과 다르게"].filter(Boolean);
  $("#ctaHint").textContent = ok ? `${n}명 · ${ruleBits.length ? ruleBits.join(" · ") : "규칙 없이 완전 랜덤"}` : "2명 이상 넣어 주세요";
}

function renderRules() {
  const k = teamCount();
  const names = state.names;
  $("#leadCount").textContent = state.leaders.length ? `${state.leaders.length}/${k}` : "";
  $("#leadPicks").innerHTML = names
    .map((nm) => `<button class="pick" type="button" data-name="${esc(nm)}" aria-pressed="${state.leaders.includes(nm)}">${state.leaders.includes(nm) ? "♛ " : ""}${esc(nm)}</button>`)
    .join("");
  ["avoid", "together"].forEach((kind) => {
    const list = state[kind];
    $(`#${kind}Count`).textContent = list.length ? `${list.length}쌍` : "";
    $(`#${kind}Picks`).innerHTML = names
      .map((nm) => `<button class="pick${firstPick[kind] === nm ? " is-first" : ""}" type="button" data-name="${esc(nm)}">${esc(nm)}</button>`)
      .join("");
    $(`#${kind}Pairs`).innerHTML = list
      .map(
        ([a, b], i) => `<span class="pair pair--${kind}">${esc(a)} <em>${kind === "avoid" ? "✕" : "＋"}</em> ${esc(b)}<button type="button" data-rmpair="${i}" aria-label="${esc(a)}, ${esc(b)} 쌍 지우기">×</button></span>`
      )
      .join("");
  });
  const prev = names.length >= 2 ? getPrev(names) : null;
  const tg = $("#diffToggle");
  tg.disabled = !prev;
  tg.checked = !!prev && state.diff;
  $("#diffNote").textContent = prev ? `지난번 ${prev.length}팀 결과를 기억하고 있어요` : "같은 명단으로 한 번 나누면 켤 수 있어요";
}

/* ---------- 딜 ---------- */
let dealToken = 0;
let current = null; // { names, teams, leaders, issues }

$("#go").addEventListener("click", async (e) => {
  const b = e.currentTarget;
  if (b.disabled) return;
  await shoeFire(b);
  dealNew();
});

function dealNew() {
  const k = teamCount();
  if (k < 2) return;
  const prev = state.diff ? getPrev(state.names) : null;
  const res = makeTeams({ names: state.names, k, avoid: state.avoid, together: state.together, leaders: state.leaders, prev });
  setPrev(state.names, res.teams);
  runDeal({ names: state.names.slice(), ...res, usedPrev: !!prev });
}

async function runDeal(res, { fromLink = false } = {}) {
  const token = ++dealToken;
  current = res;
  introCtl?.stop();
  introCtl = null;
  showView("play");
  $("#after").hidden = true;
  const k = res.teams.length;
  const n = res.names.length;
  $("#playTitle").textContent = `${n}명 → ${k}팀`;
  const tableEl = $("#table");
  const table = createTable(tableEl);
  table.clear();
  tableEl.style.transition = "";
  const maxCount = Math.max(...res.teams.map((t) => t.length));
  const L = layoutPiles(tableEl.clientWidth, k, maxCount, { step: 30, maxCard: 120 });
  tableEl.style.height = `${L.height}px`;
  const order = dealOrder(res.teams);
  const cards = shuffleArr(order).map((o, i) => {
    const c = cardEl({ name: o.name, team: o.team, slot: o.slot, leader: o.slot === 0 && res.leaders.includes(o.name) });
    c.style.width = `${L.cardW}px`;
    c.style.height = `${L.cardH}px`;
    c._o = o;
    return table.add(c, { x: L.deck.x, y: L.deck.y - i * 0.5, r: 0 }, 10 + i);
  });
  const alive = () => token === dealToken;
  const quick = table.reduced;
  if (!quick) {
    await sleep(200);
    if (!alive()) return;
    const deck = cards.slice();
    await table.riffle(deck, L.deck, { width: L.cardW, times: n <= 24 ? 2 : 1 });
    if (!alive()) return;
  }
  // 딜: 팀장 먼저, 그다음 돌아가며 한 장씩
  const byName = new Map(cards.map((c) => [c._o.name, c]));
  const stagger = Math.max(40, Math.min(140, 2600 / n));
  await Promise.all(
    order.map((o, i) => {
      const c = byName.get(o.name);
      const p = L.piles[o.team];
      c.style.zIndex = 100 + i;
      if (!quick) setTimeout(() => alive() && haptic(4), i * stagger + 300);
      return table.move(c, { x: p.x + (Math.random() - 0.5) * 6, y: p.y + o.slot * 1.5, r: (Math.random() - 0.5) * 8 }, { dur: 380, delay: i * stagger, arc: 50, spin: -20, land: true });
    })
  );
  if (!alive()) return;
  await sleep(quick ? 0 : 250);
  // 뒤집기: 더미별로 펼치며 이름 공개
  L.piles.forEach((p, t) => {
    const h = pileHead(t, res.teams[t].length, p.hx, p.hy, p.w);
    h.classList.add("is-in");
    h.style.animationDelay = `${t * 90}ms`;
    tableEl.appendChild(h);
  });
  haptic([10, 40, 10, 40, 20]);
  await Promise.all(
    order.map((o, i) => {
      const c = byName.get(o.name);
      const p = L.piles[o.team];
      const d = quick ? 0 : o.team * 90 + o.slot * 45;
      setTimeout(() => table.flip(c, true), d + 60);
      return table.move(c, { x: p.x, y: p.y + o.slot * L.step, r: 0 }, { dur: 420, delay: d, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" });
    })
  );
  if (!alive()) return;
  // 빈 덱 자리를 접고 더미를 위로 올린다
  const dy = L.piles[0].hy - 2;
  tableEl.style.transition = quick ? "" : "height 420ms cubic-bezier(0.2, 0.7, 0.2, 1)";
  tableEl.style.height = `${L.height - dy}px`;
  tableEl.querySelectorAll(".pile-head").forEach((h, t) => {
    const p = L.piles[t];
    h.style.transition = quick ? "" : "transform 420ms cubic-bezier(0.2, 0.7, 0.2, 1)";
    h.style.transform = `translate(${p.hx}px, ${p.hy - dy}px)`;
  });
  await Promise.all(order.map((o) => table.move(byName.get(o.name), { x: L.piles[o.team].x, y: L.piles[o.team].y + o.slot * L.step - dy, r: 0 }, { dur: 420 })));
  if (!alive()) return;
  showAfter(res, fromLink);
}

function showAfter(res, fromLink) {
  $("#copyPreview").textContent = resultText(res);
  $("#copyText").classList.remove("is-copied");
  const notes = [];
  if (res.issues?.avoid?.length) notes.push(`같은 팀 금지 ${res.issues.avoid.map((p) => p.join("✕")).join(", ")}는 지킬 수 없었어요`);
  if (res.issues?.together?.length) notes.push(`같은 팀 필수 ${res.issues.together.map((p) => p.join("＋")).join(", ")}는 지킬 수 없었어요`);
  if (res.usedPrev && res.issues) notes.push(`지난번 같은 팀 ${res.issues.prevTotal}쌍 중 ${res.issues.repeat}쌍만 다시 만났어요`);
  if (fromLink) notes.push("받은 링크의 결과 그대로예요. 다시 섞으면 새로 나눠요");
  $("#note").hidden = !notes.length;
  $("#note").textContent = notes.join(" · ");
  $("#after").hidden = false;
}

function resultText(res) {
  const lines = res.teams.map((t, i) => `${teamName(i)} ${SUITS[i % 4]} ${t.map((nm) => (res.leaders.includes(nm) ? `${nm}(팀장)` : nm)).join(", ")}`);
  return `🃏 팀 나누기 · ${res.names.length}명 → ${res.teams.length}팀\n${lines.join("\n")}`;
}

$("#copyText").addEventListener("click", async () => {
  if (!current) return;
  const ok = await copyText(resultText(current));
  haptic(10);
  $("#copyText").classList.toggle("is-copied", ok);
  toast(ok ? "복사했어요. 단톡방에 붙여넣어요" : "복사에 실패했어요");
});
$("#again").addEventListener("click", () => {
  if (!current) return;
  if (current.names.join() !== state.names.join()) state.names = current.names.slice();
  cleanRules();
  if (teamCount() !== current.teams.length) {
    state.by = "teams";
    state.num = current.teams.length;
  }
  dealNew();
});
$("#edit").addEventListener("click", enterSetup);
$("#toSetup").addEventListener("click", enterSetup);

$("#shareLink").addEventListener("click", () => {
  if (!current) return;
  const idx = new Map();
  current.teams.forEach((t, ti) => t.forEach((nm) => idx.set(nm, ti)));
  const url = urlWith({ d: encodeState({ n: current.names, a: current.names.map((nm) => idx.get(nm)), l: current.leaders }) });
  share({ title: "팀 나누기 결과", text: resultText(current), url });
});

$("#shareImg").addEventListener("click", async () => {
  if (!current) return;
  const b = $("#shareImg");
  b.classList.add("is-loading");
  try {
    await shareImage(drawCard(current), { filename: `team-split-${todayKey()}.png`, title: "팀 나누기 결과", text: resultText(current) });
  } finally {
    b.classList.remove("is-loading");
  }
});

function drawCard(res) {
  const cs = getComputedStyle(document.documentElement);
  const v = (n, f) => cs.getPropertyValue(n).trim() || f;
  const felt = v("--art-felt", "#0f5c3d");
  const feltDeep = v("--art-felt-deep", "#0a422b");
  const gold = v("--art-gold", "#e3b341");
  const card = v("--art-card", "#fbf8f0");
  const ink = v("--art-ink", "#17140f");
  const red = v("--art-red", "#c8283c");
  const rail = v("--art-rail", "#4a2412");
  const display = v("--font-display", CANVAS_FONT);
  const chips = Array.from({ length: 10 }, (_, i) => v(`--chip-${i + 1}`, "#d23a3a"));
  const W = 1080;
  const H = 1350;
  const { canvas, ctx } = createCanvas(W, H, 1);
  const g = ctx.createRadialGradient(W / 2, H * 0.35, 100, W / 2, H / 2, W);
  g.addColorStop(0, felt);
  g.addColorStop(1, feltDeep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = rail;
  ctx.lineWidth = 28;
  ctx.strokeRect(14, 14, W - 28, H - 28);
  ctx.fillStyle = gold;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `800 64px ${display}`;
  ctx.fillText("팀 나누기", 80, 120);
  ctx.font = `600 34px ${CANVAS_FONT}`;
  ctx.fillText(`${res.names.length}명 → ${res.teams.length}팀`, 80, 186);
  ctx.textAlign = "right";
  const d = new Date();
  ctx.fillText(`${d.getMonth() + 1}월 ${d.getDate()}일`, W - 80, 120);
  const k = res.teams.length;
  const cols = k <= 2 ? 2 : k <= 6 ? 3 : 4;
  const rows = Math.ceil(k / cols);
  const top = 250;
  const gap = 24;
  const bw = (W - 160 - gap * (cols - 1)) / cols;
  const bh = (H - top - 120 - gap * (rows - 1)) / rows;
  res.teams.forEach((t, i) => {
    const x = 80 + (i % cols) * (bw + gap);
    const y = top + Math.floor(i / cols) * (bh + gap);
    ctx.fillStyle = card;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, bw, bh, 18) : ctx.rect(x, y, bw, bh);
    ctx.fill();
    ctx.fillStyle = chips[i % 10];
    ctx.fillRect(x, y, 14, bh);
    const suit = SUITS[i % 4];
    ctx.fillStyle = suit === "♥" || suit === "♦" ? red : ink;
    ctx.textAlign = "left";
    ctx.font = `800 ${Math.min(44, bh * 0.14)}px ${display}`;
    ctx.fillText(`${suit} ${teamName(i)}`, x + 34, y + Math.min(44, bh * 0.12));
    const lineH = Math.min(52, (bh - 90) / Math.max(1, t.length));
    let fs = Math.max(18, Math.min(38, lineH * 0.78));
    ctx.fillStyle = ink;
    t.forEach((nm, j) => {
      ctx.font = `700 ${fs}px ${CANVAS_FONT}`;
      const label = res.leaders.includes(nm) ? `${nm} ♛` : nm;
      ctx.fillText(label, x + 34, y + 90 + j * lineH + lineH / 2, bw - 50);
    });
  });
  ctx.textAlign = "left";
  ctx.fillStyle = gold;
  ctx.font = `600 28px ${CANVAS_FONT}`;
  ctx.fillText("카드를 섞어 무작위로 나눴어요", 80, H - 70);
  ctx.textAlign = "right";
  ctx.font = `800 34px ${display}`;
  ctx.fillText("우리도 나누기 →", W - 80, H - 70);
  return canvas;
}

/* ---------- 시작 ---------- */
renderCrumb($("#crumb"));
renderMoreSites($("#more"));
renderSetup();
enterIntro();
