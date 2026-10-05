// 누가 쏠래? — 화면 흐름, 설정, 결과, 공유, 벌칙 장부
import {
  $, $$, createStore, toast, haptic, share, shareImage, encodeState, decodeState, urlWith, getParam,
  showView, renderMoreSites, createCanvas, roundRect, CANVAS_FONT, downloadBlob, todayKey, openSheet,
} from "../shared/kit.js";
import { startIntro } from "./intro.js";
import { startRace } from "./race.js";
import { startBattle } from "./battle.js";
import { startBarrel } from "./barrel.js";
import {
  PALETTE, ITEM_KEYS, randomSeed, josa, headline, penaltyEmoji, debtLabel, escapeHtml, readTokens, alpha,
} from "./common.js";

const store = createStore("who-pays");
const MAX = 12;
const MODE_NAME = { race: "레이스", battle: "배틀로얄", barrel: "통아저씨" };
const RULE_NAME = { last: "꼴찌가 당첨", first: "1등이 당첨" };

const saved = store.get("last", null);
const state = {
  names: Array.isArray(saved?.names) ? saved.names.slice(0, MAX) : [],
  rule: saved?.rule === "first" ? "first" : "last",
  penalty: typeof saved?.penalty === "string" ? saved.penalty : "커피 쏘기",
  mode: ["race", "battle", "barrel"].includes(saved?.mode) ? saved.mode : "race",
};

let introCtl = null;
let game = null;
let lastResult = null;
let ledgerReturn = "setup";

/* ---------- 저장소 도우미 ---------- */
const groupKey = (names) => names.slice().sort((a, b) => a.localeCompare(b, "ko")).join("\u0001");
const getGroups = () => store.get("groups", []);
const setGroups = (g) => store.set("groups", g);
const getLedger = () => store.get("ledger", []);
const setLedger = (l) => store.set("ledger", l);
const findGroup = (names) => getGroups().find((g) => groupKey(g.names) === groupKey(names));
const persist = () => store.set("last", state);

function uid() {
  return randomSeed().toString(36) + Date.now().toString(36);
}

/* ---------- URL 로 받은 멤버 ---------- */
const shared = (() => {
  const g = getParam("g");
  if (!g) return null;
  const d = decodeState(g);
  if (!d || !Array.isArray(d.n)) return null;
  const names = [...new Set(d.n.map((s) => String(s).trim().slice(0, 10)).filter(Boolean))].slice(0, MAX);
  if (names.length < 2) return null;
  return { names, rule: d.r === "first" ? "first" : "last", penalty: typeof d.p === "string" ? d.p.slice(0, 20) : "커피 쏘기", title: typeof d.t === "string" ? d.t.slice(0, 16) : "" };
})();

if (shared) {
  state.names = shared.names;
  state.rule = shared.rule;
  state.penalty = shared.penalty;
  const inv = $("#invite");
  const head = shared.names.slice(0, 2).join(", ");
  inv.textContent = `${shared.title ? shared.title + " · " : ""}${head}${shared.names.length > 2 ? ` 외 ${shared.names.length - 2}명` : ""} 멤버가 준비돼 있어요`;
  inv.hidden = false;
  $("#start span").textContent = "이 멤버로 내기 시작하기";
}

/* ---------- 인트로 ---------- */
function enterIntro() {
  showView("intro");
  introCtl?.stop();
  introCtl = startIntro($("#intro"));
  $("#introLedger").hidden = getLedger().length === 0;
}

function enterSetup() {
  introCtl?.stop();
  introCtl = null;
  showView("setup");
  renderSetup();
}

$("#start").addEventListener("click", () => {
  haptic(10);
  enterSetup();
});
$("#introLedger").addEventListener("click", () => {
  introCtl?.stop();
  introCtl = null;
  openLedger("intro");
});
$("#toIntro").addEventListener("click", enterIntro);

/* ---------- 설정 화면 ---------- */
function parseNames(text) {
  return String(text)
    .split(/[,，、\n\t/·]+|\s+/)
    .map((s) => s.trim().slice(0, 10))
    .filter(Boolean);
}

function addNames(list) {
  let added = 0;
  let dup = 0;
  for (const nm of list) {
    if (state.names.length >= MAX) {
      toast(`최대 ${MAX}명까지 넣을 수 있어요`);
      break;
    }
    if (state.names.includes(nm)) {
      dup++;
      continue;
    }
    state.names.push(nm);
    added++;
  }
  if (dup && !added) toast("이미 있는 이름이에요");
  if (added) {
    haptic(8);
    persist();
  }
  renderSetup();
}

$("#addForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("#nameInput");
  const list = parseNames(input.value);
  if (!list.length) return;
  addNames(list);
  input.value = "";
  input.focus();
});

// 쉼표 포함 붙여넣기는 바로 추가
$("#nameInput").addEventListener("paste", (e) => {
  const text = e.clipboardData?.getData("text") || "";
  const list = parseNames(text);
  if (list.length > 1) {
    e.preventDefault();
    addNames(list);
    toast(`${list.length}명을 한 번에 넣었어요`);
  }
});

$("#samplePaste").addEventListener("click", () => {
  addNames(["철수", "영희", "민수"]);
});

$("#clearNames").addEventListener("click", () => {
  state.names = [];
  persist();
  renderSetup();
});

$("#names").addEventListener("click", (e) => {
  const b = e.target.closest("[data-remove]");
  if (!b) return;
  state.names.splice(Number(b.dataset.remove), 1);
  persist();
  renderSetup();
});

$$(".seg__btn").forEach((b) =>
  b.addEventListener("click", () => {
    state.rule = b.dataset.rule;
    persist();
    renderSetup();
  })
);

$("#penalty").addEventListener("input", (e) => {
  state.penalty = e.target.value.trim();
  persist();
  renderPenaltyChips();
});
$("#penaltyChips").addEventListener("click", (e) => {
  const c = e.target.closest("[data-p]");
  if (!c) return;
  state.penalty = c.dataset.p;
  $("#penalty").value = state.penalty;
  persist();
  renderPenaltyChips();
});

$$(".mode").forEach((b) =>
  b.addEventListener("click", () => {
    state.mode = b.dataset.mode;
    persist();
    haptic(6);
    renderSetup();
  })
);

$("#groupRow").addEventListener("click", (e) => {
  const c = e.target.closest("[data-group]");
  if (!c) return;
  const g = getGroups().find((x) => x.id === c.dataset.group);
  if (!g) return;
  state.names = g.names.slice(0, MAX);
  state.rule = g.rule || state.rule;
  state.penalty = g.penalty || state.penalty;
  $("#penalty").value = state.penalty;
  persist();
  haptic(10);
  toast(`${g.title} 멤버를 불러왔어요`);
  renderSetup();
});

$("#saveGroup").addEventListener("click", () => openSaveSheet());

function renderPenaltyChips() {
  $$("#penaltyChips .chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.p === state.penalty)));
}

function renderSetup() {
  const names = state.names;
  $("#names").innerHTML = names.length
    ? names
        .map(
          (nm, i) => `<span class="plate" style="--pc:${PALETTE[i % PALETTE.length]};--i:${i}"><span class="plate__no">P${i + 1}</span><span class="plate__name">${escapeHtml(nm)}</span><button class="plate__x" data-remove="${i}" aria-label="${escapeHtml(nm)} 빼기">×</button></span>`
        )
        .join("")
    : '<p class="names__empty">출전 선수가 없어요. 이름을 넣어 주세요</p>';
  $("#count").textContent = `${names.length}/${MAX}`;
  $("#clearNames").hidden = names.length === 0;
  const g = findGroup(names);
  $("#saveGroup").hidden = names.length < 2 || !!g;
  $("#samplePaste").hidden = names.length > 0;

  const groups = getGroups();
  $("#groups").hidden = groups.length === 0;
  $("#groupRow").innerHTML = groups
    .map(
      (x) => `<button class="chip group-chip${g && g.id === x.id ? " is-selected" : ""}" data-group="${x.id}">${escapeHtml(x.title)} <small>${x.names.length}명</small></button>`
    )
    .join("");

  $$(".seg__btn").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.rule === state.rule)));
  $$(".mode").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.mode === state.mode)));
  if ($("#penalty").value !== state.penalty && document.activeElement !== $("#penalty")) $("#penalty").value = state.penalty;
  renderPenaltyChips();

  const ok = names.length >= 2;
  $("#go").disabled = !ok;
  $("#goLabel").textContent = `${MODE_NAME[state.mode]} 시작하기`;
  $("#ctaHint").textContent = ok
    ? state.mode === "barrel"
      ? `통아저씨는 해적을 튀어나오게 한 사람이 당첨이에요`
      : `${names.length}명 · ${RULE_NAME[state.rule]} · ${state.penalty || "벌칙 없음"}`
    : "2명 이상 넣어 주세요";
}

/* ---------- 그룹 저장 시트 ---------- */
let sheetEl = null;
function openSaveSheet(after) {
  if (!sheetEl) {
    sheetEl = document.createElement("div");
    sheetEl.className = "sheet";
    sheetEl.setAttribute("role", "dialog");
    sheetEl.setAttribute("aria-label", "그룹 저장");
    sheetEl.innerHTML = `
      <form class="stack gap-16" id="groupForm">
        <div class="stack gap-4">
          <h2 class="t-title-03 m0">그룹으로 저장해요</h2>
          <p class="t-body-03 t-secondary m0">다음엔 한 번 눌러 바로 불러오고, 벌칙 장부도 이 이름으로 쌓여요.</p>
        </div>
        <label class="field">
          <span class="field__label">그룹 이름</span>
          <input class="input" id="groupName" maxlength="16" placeholder="우리 팀" />
        </label>
        <p class="t-caption-01 t-tertiary m0" id="groupMembers"></p>
        <div class="row gap-8">
          <button type="button" class="btn btn--ghost grow" data-sheet-close>취소</button>
          <button type="submit" class="btn btn--primary grow">저장하기</button>
        </div>
      </form>`;
    document.body.appendChild(sheetEl);
  }
  const groups = getGroups();
  let title = "우리 팀";
  for (let k = 2; groups.some((g) => g.title === title); k++) title = `우리 팀 ${k}`;
  $("#groupName", sheetEl).value = title;
  $("#groupMembers", sheetEl).textContent = `멤버: ${state.names.join(", ")}`;
  const close = openSheet(sheetEl);
  $("#groupForm", sheetEl).onsubmit = (e) => {
    e.preventDefault();
    const t = $("#groupName", sheetEl).value.trim() || "우리 팀";
    const list = getGroups().filter((g) => groupKey(g.names) !== groupKey(state.names));
    list.unshift({ id: uid(), title: t, names: state.names.slice(), rule: state.rule, penalty: state.penalty, ts: Date.now() });
    setGroups(list.slice(0, 12));
    close();
    haptic(12);
    toast(`${t} 그룹을 저장했어요`);
    renderSetup();
    after?.();
  };
}

/* ---------- 게임 시작 ---------- */
function makePlayers() {
  const r = new Uint32Array(state.names.length);
  try {
    crypto.getRandomValues(r);
  } catch {
    r.forEach((_, i) => (r[i] = Math.floor(Math.random() * 2 ** 32)));
  }
  return state.names.map((name, i) => ({
    name,
    color: PALETTE[i % PALETTE.length],
    item: ITEM_KEYS[r[i] % ITEM_KEYS.length],
  }));
}

function startGame() {
  if (state.names.length < 2) return;
  game?.stop();
  introCtl?.stop();
  introCtl = null;
  persist();
  const players = makePlayers();
  document.body.classList.add("is-playing");
  showView("play");
  $("#playTitle").textContent = `${MODE_NAME[state.mode]} · ${state.mode === "barrel" ? "튀어나오면 당첨" : RULE_NAME[state.rule]}`;
  $("#tray").innerHTML = "";
  const opts = {
    stage: $("#playStage"),
    tray: $("#tray"),
    recEl: $("#rec"),
    players,
    rule: state.rule,
    penalty: state.penalty,
    onDone: (res) => onGameDone(res, players),
  };
  const starters = { race: startRace, battle: startBattle, barrel: startBarrel };
  game = starters[state.mode](opts);
}

$("#go").addEventListener("click", () => {
  haptic(15);
  startGame();
});

$("#quit").addEventListener("click", () => {
  if (!confirm("이번 판을 그만할까요? 결과는 기록되지 않아요.")) return;
  game?.stop();
  game = null;
  document.body.classList.remove("is-playing");
  $("#playStage").innerHTML = "";
  $("#tray").innerHTML = "";
  enterSetup();
});

/* ---------- 결과 ---------- */
function onGameDone(res, players) {
  game = null;
  document.body.classList.remove("is-playing");
  const entry = {
    id: uid(),
    key: groupKey(state.names),
    names: state.names.slice(),
    loser: res.loser,
    penalty: state.penalty || "벌칙",
    mode: state.mode,
    rule: state.rule,
    ts: Date.now(),
    paid: false,
  };
  const ledger = getLedger();
  ledger.push(entry);
  setLedger(ledger.slice(-300));
  lastResult = { ...res, players, entry, mode: state.mode, rule: state.rule, penalty: state.penalty || "벌칙" };
  renderResult();
  showView("result");
  $("#playStage").innerHTML = "";
  $("#tray").innerHTML = "";
}

function renderResult() {
  const r = lastResult;
  $("#resMode").textContent = `FINAL · ${MODE_NAME[r.mode]} · ${r.mode === "barrel" ? "튀어나오면 당첨" : RULE_NAME[r.rule]}`;
  $("#stampEmoji").textContent = penaltyEmoji(r.penalty);
  $("#stampText").textContent = headline(r.loser, r.penalty);
  const stamp = $("#stamp");
  stamp.style.animation = "none";
  void stamp.offsetWidth;
  stamp.style.animation = "";
  $("#resPenalty").innerHTML = `<span>벌칙</span>${escapeHtml(r.penalty)}`;

  const stats = groupStats(r.entry.key);
  const me = stats.people.find((p) => p.name === r.loser);
  const debt = me ? me.debtText : "";
  const streak = stats.streak && stats.streak.name === r.loser && stats.streak.count >= 2 ? ` · ${stats.streak.count}연속 당첨 🔥` : "";
  $("#resDebt").hidden = !debt;
  $("#resDebt").innerHTML = `<b>장부 기록</b> ${escapeHtml(`${r.loser} ${debt}${streak}`)}`;

  $("#ranks").innerHTML = r.rows
    .map(
      (row, k) => `<li class="rank${row.isLoser ? " is-loser" : ""}" style="--i:${k};--pc:${row.color}">
        <span class="rank__pos">${r.mode === "race" ? k + 1 : escapeHtml(row.label.replace(/[^0-9]/g, "") || (row.isLoser ? "!" : "–"))}</span>
        <span class="rank__name">${escapeHtml(row.name)}<small>${escapeHtml(r.mode === "race" ? "" : row.label)}</small></span>
        <span class="rank__sub">${row.isLoser ? "당첨" : escapeHtml(row.sub || "")}</span>
      </li>`
    )
    .join("");
  $("#saveVideo").hidden = !r.video;
  $("#saveVideo").textContent = r.mode === "battle" ? "배틀 영상 저장" : "레이스 영상 저장";
  $("#resSave").hidden = !!findGroup(state.names);
  haptic([30, 40, 80]);
}

$("#again").addEventListener("click", () => {
  haptic(15);
  startGame();
});
$("#resSetup").addEventListener("click", enterSetup);
$("#resLedger").addEventListener("click", () => openLedger("result"));
$("#resSaveBtn").addEventListener("click", () =>
  openSaveSheet(() => {
    $("#resSave").hidden = true;
  })
);

$("#saveVideo").addEventListener("click", async () => {
  const r = lastResult;
  if (!r?.video) return;
  const filename = `누가쏠래-${MODE_NAME[r.mode]}-${todayKey()}.${r.videoExt || "webm"}`;
  const file = new File([r.video], filename, { type: r.video.type || "video/webm" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "누가 쏠래?", text: `${headline(r.loser, r.penalty)} 레이스 영상` });
      return;
    } catch (e) {
      if (e?.name === "AbortError") return;
    }
  }
  downloadBlob(r.video, filename);
  toast("영상을 저장했어요");
});

function shareUrl() {
  const g = findGroup(state.names);
  return urlWith({ g: encodeState({ n: state.names, r: state.rule, p: state.penalty, t: g?.title || "" }) });
}

$("#shareLink").addEventListener("click", () => {
  const r = lastResult;
  const text = r
    ? `${penaltyEmoji(r.penalty)} 오늘의 ${r.penalty}: ${r.loser}! 억울하면 같은 멤버로 한 판 더 👉`
    : "누가 쏠래? 같은 멤버로 한 판 해요 👉";
  share({ title: "누가 쏠래?", text, url: shareUrl() });
});

$("#shareCard").addEventListener("click", async () => {
  const btn = $("#shareCard");
  btn.classList.add("is-loading");
  try {
    const canvas = drawCard(lastResult);
    await shareImage(canvas, { filename: `who-pays-${todayKey()}.png`, title: "누가 쏠래?", text: `${headline(lastResult.loser, lastResult.penalty)} #누가쏠래` });
  } finally {
    btn.classList.remove("is-loading");
  }
});

function drawCard(r) {
  const tk = readTokens();
  const W = 1080;
  const H = 1350;
  const { canvas, ctx } = createCanvas(W, H, 1);
  ctx.fillStyle = tk.bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 360, 40, W / 2, 360, 700);
  glow.addColorStop(0, alpha(tk.brand, 0.32));
  glow.addColorStop(1, alpha(tk.brand, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = `800 40px ${CANVAS_FONT}`;
  ctx.fillStyle = tk.text;
  ctx.fillText("🎯 누가 쏠래?", 72, 92);
  ctx.textAlign = "right";
  ctx.font = `600 32px ${CANVAS_FONT}`;
  ctx.fillStyle = tk.text2;
  const d = new Date(r.entry.ts);
  ctx.fillText(`${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} · ${MODE_NAME[r.mode]}`, W - 72, 92);

  // 도장
  ctx.textAlign = "center";
  ctx.font = `160px ${CANVAS_FONT}`;
  ctx.fillText(penaltyEmoji(r.penalty), W / 2, 290);
  ctx.save();
  ctx.translate(W / 2, 480);
  ctx.rotate(-0.08);
  let fs = 92;
  const text = headline(r.loser, r.penalty);
  ctx.font = `900 ${fs}px ${CANVAS_FONT}`;
  while (ctx.measureText(text).width > W - 260 && fs > 48) {
    fs -= 4;
    ctx.font = `900 ${fs}px ${CANVAS_FONT}`;
  }
  const tw = ctx.measureText(text).width + 100;
  roundRect(ctx, -tw / 2, -90, tw, 180, 32);
  ctx.fillStyle = alpha(tk.brand, 0.1);
  ctx.fill();
  ctx.lineWidth = 12;
  ctx.strokeStyle = tk.brand;
  ctx.stroke();
  ctx.fillStyle = tk.brand;
  ctx.fillText(text, 0, 6);
  ctx.restore();

  // 벌칙
  ctx.font = `700 40px ${CANVAS_FONT}`;
  const pt = `벌칙 · ${r.penalty}`;
  const pw = ctx.measureText(pt).width + 64;
  roundRect(ctx, W / 2 - pw / 2, 620, pw, 76, 38);
  ctx.fillStyle = tk.raised;
  ctx.fill();
  ctx.fillStyle = tk.text;
  ctx.fillText(pt, W / 2, 660);

  // 순위
  const rows = r.rows;
  const top = 750;
  const avail = 1180 - top;
  const rh = Math.min(84, avail / rows.length);
  const cols = rows.length > 6 ? 2 : 1;
  const perCol = Math.ceil(rows.length / cols);
  const rowH = Math.min(84, avail / perCol);
  const colW = (W - 144 - (cols - 1) * 24) / cols;
  rows.forEach((row, k) => {
    const c = Math.floor(k / perCol);
    const x = 72 + c * (colW + 24);
    const y = top + (k % perCol) * rowH;
    roundRect(ctx, x, y + 4, colW, rowH - 10, 20);
    ctx.fillStyle = row.isLoser ? alpha(tk.brand, 0.18) : tk.surface;
    ctx.fill();
    if (row.isLoser) {
      ctx.lineWidth = 4;
      ctx.strokeStyle = tk.brand;
      ctx.stroke();
    }
    const cy = y + 4 + (rowH - 10) / 2;
    const f = Math.round(Math.min(34, rowH * 0.42));
    ctx.textAlign = "left";
    ctx.font = `700 ${f}px ${CANVAS_FONT}`;
    ctx.fillStyle = row.isLoser ? tk.brand : tk.text2;
    ctx.fillText(row.label, x + 28, cy);
    ctx.beginPath();
    ctx.arc(x + 28 + f * 4.6, cy, f * 0.32, 0, Math.PI * 2);
    ctx.fillStyle = row.color;
    ctx.fill();
    ctx.font = `800 ${f}px ${CANVAS_FONT}`;
    ctx.fillStyle = tk.text;
    ctx.fillText(row.name + (row.isLoser ? ` ${penaltyEmoji(r.penalty)}` : ""), x + 28 + f * 5.4, cy, colW - f * 5.4 - 40);
  });
  void rh;

  ctx.textAlign = "center";
  ctx.font = `600 30px ${CANVAS_FONT}`;
  ctx.fillStyle = tk.text3;
  ctx.fillText("아이템 쓰는 벌칙 추첨 레이스 · 누가 쏠래?", W / 2, H - 80);
  return canvas;
}

/* ---------- 벌칙 장부 ---------- */
function groupStats(key) {
  const entries = getLedger().filter((e) => e.key === key).sort((a, b) => a.ts - b.ts);
  const names = entries.length ? entries[entries.length - 1].names : key.split("\u0001");
  const people = names.map((name) => {
    const mine = entries.filter((e) => e.loser === name);
    const unpaid = mine.filter((e) => !e.paid);
    const byPenalty = {};
    unpaid.forEach((e) => (byPenalty[e.penalty] = (byPenalty[e.penalty] || 0) + 1));
    const debtText = Object.entries(byPenalty)
      .map(([p, n]) => debtLabel(p, n))
      .join(" · ");
    return { name, total: mine.length, unpaid: unpaid.length, debtText, titles: [] };
  });
  // 연속 당첨
  let streak = null;
  if (entries.length) {
    const lastLoser = entries[entries.length - 1].loser;
    let c = 0;
    for (let k = entries.length - 1; k >= 0 && entries[k].loser === lastLoser; k--) c++;
    streak = { name: lastLoser, count: c };
  }
  if (streak && streak.count >= 2) people.find((p) => p.name === streak.name)?.titles.push({ t: `${streak.count}연속 당첨 🔥`, c: "hot" });
  const maxUnpaid = Math.max(0, ...people.map((p) => p.unpaid));
  const tops = people.filter((p) => p.unpaid === maxUnpaid);
  if (maxUnpaid > 0 && tops.length === 1 && entries.length >= 2) tops[0].titles.push({ t: "장부 1위", c: "warn" });
  people.forEach((p) => {
    if (entries.length >= 3 && p.total === 0) p.titles.push({ t: "무패 행진", c: "good" });
    if (p.total > 0 && p.unpaid === 0) p.titles.push({ t: "빚 청산 완료", c: "good" });
  });
  people.sort((a, b) => b.unpaid - a.unpaid || b.total - a.total);
  return { entries, names, people, streak };
}

function openLedger(from) {
  ledgerReturn = from;
  showView("ledger");
  renderLedger();
}

$("#openLedger").addEventListener("click", () => openLedger("setup"));
$("#ledgerBack").addEventListener("click", () => {
  if (ledgerReturn === "result" && lastResult) showView("result");
  else if (ledgerReturn === "intro") enterIntro();
  else enterSetup();
});

const fmtDate = (ts) => {
  const d = new Date(ts);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const expanded = new Set();

function renderLedger() {
  const ledger = getLedger();
  const groups = getGroups();
  const keys = [...new Set([...ledger.map((e) => e.key)])];
  keys.sort((a, b) => {
    const la = Math.max(...ledger.filter((e) => e.key === a).map((e) => e.ts));
    const lb = Math.max(...ledger.filter((e) => e.key === b).map((e) => e.ts));
    return lb - la;
  });
  const body = $("#ledgerBody");
  if (!keys.length) {
    body.innerHTML = `<div class="ledger-empty card card--flat">
      <div class="ledger-empty__num" aria-hidden="true">0</div>
      <p class="t-body-02-strong">아직 적힌 벌칙이 없어요</p>
      <p class="t-body-03">한 판 하고 나면 누가 무엇에 당첨됐는지 여기에 쌓여요.</p>
      <button class="btn btn--primary" id="ledgerGo">내기 하러 가기</button>
    </div>`;
    $("#ledgerGo").onclick = enterSetup;
    return;
  }
  body.innerHTML = keys
    .map((key) => {
      const st = groupStats(key);
      const g = groups.find((x) => groupKey(x.names) === key);
      const title = g ? g.title : st.names.join(", ");
      const list = st.entries.slice().reverse();
      const showAll = expanded.has(key);
      const shown = showAll ? list : list.slice(0, 5);
      const colorOf = (nm) => PALETTE[Math.max(0, st.names.indexOf(nm)) % PALETTE.length];
      return `<section class="card card--flat lg" data-key="${escapeHtml(key)}">
        <div class="lg__head">
          <div class="stack gap-4">
            <h2 class="lg__title">${escapeHtml(title)}</h2>
            <p class="lg__meta">${st.names.length}명 · ${st.entries.length}판 · 마지막 ${fmtDate(st.entries[st.entries.length - 1].ts)}</p>
          </div>
        </div>
        <div class="lg__people">
          ${st.people
            .map(
              (p, k) => `<div class="person" style="--pc:${colorOf(p.name)}">
                <span class="person__pos">${k + 1}</span>
                <div class="person__main">
                  <span class="person__name">${escapeHtml(p.name)} <span class="t-caption-01 t-tertiary">당첨 ${p.total}번</span></span>
                  ${p.titles.length ? `<span class="person__titles">${p.titles.map((t) => `<span class="badge badge--${t.c}">${t.t}</span>`).join("")}</span>` : ""}
                  <span class="person__debt${p.unpaid ? "" : " is-clear"}">${p.unpaid ? escapeHtml(`${p.name} ${p.debtText}`) : "빚 없음"}</span>
                </div>
                <span class="person__big${p.unpaid ? "" : " is-clear"}" aria-label="안 갚은 벌칙 ${p.unpaid}개">${p.unpaid}</span>
              </div>`
            )
            .join("")}
        </div>
        <ul class="lg__entries">
          ${shown
            .map(
              (e) => `<li class="entry${e.paid ? " is-paid" : ""}">
                <span class="dot" style="--pc:${colorOf(e.loser)}"></span>
                <span class="entry__text"><span class="entry__what">${escapeHtml(e.loser)} · ${escapeHtml(e.penalty)}</span>
                <span class="entry__date">${fmtDate(e.ts)} · ${MODE_NAME[e.mode] || ""}</span></span>
                <button class="chip" data-paid="${e.id}" aria-pressed="${e.paid}">${e.paid ? "갚음 ✓" : "갚았어요"}</button>
              </li>`
            )
            .join("")}
        </ul>
        ${list.length > 5 ? `<button class="btn btn--ghost btn--sm lg__more" data-more="${escapeHtml(key)}">${showAll ? "접기" : `${list.length - 5}개 더 보기`}</button>` : ""}
        <div class="lg__actions">
          <button class="btn btn--secondary btn--sm" data-play="${escapeHtml(key)}">이 멤버로 한 판</button>
          ${g ? `<button class="btn btn--ghost btn--sm" data-clear="${escapeHtml(key)}">장부 비우기</button>` : `<button class="btn btn--outline btn--sm" data-save="${escapeHtml(key)}">그룹으로 저장</button>`}
        </div>
      </section>`;
    })
    .join("");
}

$("#ledgerBody").addEventListener("click", (e) => {
  const paid = e.target.closest("[data-paid]");
  if (paid) {
    const ledger = getLedger();
    const en = ledger.find((x) => x.id === paid.dataset.paid);
    if (en) {
      en.paid = !en.paid;
      setLedger(ledger);
      haptic(en.paid ? [10, 30, 10] : 8);
      if (en.paid) toast(`${en.loser}, 갚았어요! 장부에서 지웠어요`);
      renderLedger();
    }
    return;
  }
  const more = e.target.closest("[data-more]");
  if (more) {
    const k = more.dataset.more;
    expanded.has(k) ? expanded.delete(k) : expanded.add(k);
    renderLedger();
    return;
  }
  const play = e.target.closest("[data-play]");
  if (play) {
    const st = groupStats(play.dataset.play);
    state.names = st.names.slice(0, MAX);
    persist();
    enterSetup();
    toast("멤버를 불러왔어요");
    return;
  }
  const save = e.target.closest("[data-save]");
  if (save) {
    const st = groupStats(save.dataset.save);
    state.names = st.names.slice(0, MAX);
    persist();
    openSaveSheet(renderLedger);
    return;
  }
  const clear = e.target.closest("[data-clear]");
  if (clear) {
    if (!confirm("이 그룹의 장부를 모두 지울까요? 되돌릴 수 없어요.")) return;
    setLedger(getLedger().filter((x) => x.key !== clear.dataset.clear));
    renderLedger();
  }
});

/* ---------- 시작 ---------- */
renderMoreSites($("#more"), "who-pays");
renderSetup();
enterIntro();
if (shared) toast("친구가 보낸 멤버를 불러왔어요");
