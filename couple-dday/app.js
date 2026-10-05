import {
  $,
  $$,
  createStore,
  toast,
  haptic,
  share,
  shareImage,
  copyText,
  downloadBlob,
  encodeState,
  decodeState,
  urlWith,
  getParam,
  seededRandom,
  shuffle,
  todayKey,
  runIntro,
  showView,
  openSheet,
  renderMoreSites,
  createCanvas,
  roundRect,
  wrapText,
  CANVAS_FONT,
  countUp,
  fmt,
  prefersReducedMotion,
} from "../shared/kit.js";
import { QUESTIONS, LEVELS } from "./questions.js";

const store = createStore("couple-dday");
const DAY = 86400000;
const WD = ["일", "월", "화", "수", "목", "금", "토"];

/* ---------- 날짜 (YYYY-MM-DD 키, 한국 시간 기준) ---------- */
const toUTC = (k) => {
  const [y, m, d] = k.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromUTC = (ms) => new Date(ms).toISOString().slice(0, 10);
const addDays = (k, n) => fromUTC(toUTC(k) + n * DAY);
const diffDays = (a, b) => Math.round((toUTC(b) - toUTC(a)) / DAY);
const weekday = (k) => WD[new Date(toUTC(k)).getUTCDay()];
const dotDate = (k) => k.replaceAll("-", ".");
const longDate = (k) => `${dotDate(k)} (${weekday(k)})`;
const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const isDateKey = (k) => typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k) && !Number.isNaN(toUTC(k));
function addYears(k, n) {
  const [y, m, d] = k.split("-").map(Number);
  const ny = y + n;
  const dd = m === 2 && d === 29 && !isLeap(ny) ? 28 : d;
  return `${ny}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}
// 사귄 날 = D+1 (한국 커플 기념일 관례)
const dPlus = (start, today = todayKey()) => diffDays(start, today) + 1;
// 사귄 날 0시(한국 시간)
const startMs = (start) => toUTC(start) - 9 * 3600000;

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/* ---------- 방 상태 ---------- */
let rooms = store.get("rooms", {}) || {};
let currentId = store.get("current", null);
const room = () => rooms[currentId] || null;
function saveRooms() {
  store.set("rooms", rooms);
  store.set("current", currentId);
}
const newId = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const myName = (r) => r.n[r.me];
const yourName = (r) => r.n[1 - r.me];
const roomPayload = (r) => ({ n: r.n, s: r.s, id: r.id, c: r.c, f: r.me });
const roomLink = (r) => urlWith({ room: encodeState(roomPayload(r)) });

/* ---------- 오늘의 질문: 방마다 다른 순서, 가볍게 → 깊게 ---------- */
const orderCache = {};
function questionOrder(id) {
  if (orderCache[id]) return orderCache[id];
  const rand = seededRandom(`q:${id}`);
  const idx = QUESTIONS.map((_, i) => i);
  const order = [1, 2, 3].flatMap((l) => shuffle(idx.filter((i) => QUESTIONS[i].level === l), rand));
  return (orderCache[id] = order);
}
function todayQuestion(r, today = todayKey()) {
  const order = questionOrder(r.id);
  const n = Math.max(0, diffDays(r.c, today));
  return { q: order[n % order.length], d: today };
}
const qaKey = (d, q) => `${d}|${q}`;
function entryOf(r, d, q) {
  const k = qaKey(d, q);
  r.qa ||= {};
  r.qa[k] ||= { q, d, a: {} };
  return r.qa[k];
}

/* ---------- 답 봉인 (링크를 열어봐도 바로 읽히지 않게) ---------- */
function keyStream(seed, len) {
  const r = seededRandom(seed);
  return Array.from({ length: len }, () => Math.floor(r() * 256));
}
function seal(text, seed) {
  const bytes = new TextEncoder().encode(text);
  const ks = keyStream(seed, bytes.length);
  let bin = "";
  bytes.forEach((b, i) => (bin += String.fromCharCode(b ^ ks[i])));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unseal(s, seed) {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
    const ks = keyStream(seed, bin.length);
    const bytes = Uint8Array.from(bin, (c, i) => c.charCodeAt(0) ^ ks[i]);
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}
const sealSeed = (id, q, d, f) => `${id}|${q}|${d}|${f}`;
function answerLink(r, entry, re = 0) {
  const text = entry.a[r.me];
  const payload = {
    r: { n: r.n, s: r.s, id: r.id, c: r.c },
    q: entry.q,
    d: entry.d,
    f: r.me,
    x: seal(text, sealSeed(r.id, entry.q, entry.d, r.me)),
    re,
  };
  return urlWith({ a: encodeState(payload) });
}
async function sendAnswer(r, entry, re = 0) {
  const url = answerLink(r, entry, re);
  const text = re
    ? `${myName(r)}님도 답했어요! 둘의 답이 열렸어요 💞`
    : `${myName(r)}님이 오늘의 질문에 답했어요. 내 답을 적어야 열려요 🔒\nQ. ${QUESTIONS[entry.q].text}`;
  const res = await share({ title: "오늘의 질문 💌", text, url });
  if (res === "shared" || res === "copied") {
    entry.sent = true;
    saveRooms();
  }
}

/* ---------- 기념일 ---------- */
function anniversaries(start) {
  const list = [];
  for (let n = 100; n <= 3000; n += 100) list.push({ label: `${fmt.num(n)}일`, date: addDays(start, n - 1), kind: "day", n });
  for (let y = 1; y <= 10; y++) {
    const date = addYears(start, y);
    list.push({ label: `${y}주년`, date, kind: "year", n: diffDays(start, date) + 1 });
  }
  return list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.kind === "year" ? -1 : 1));
}
function nextAnniversary(start, today = todayKey()) {
  const list = anniversaries(start);
  const i = list.findIndex((x) => x.date >= today);
  if (i >= 0) return { next: list[i], prev: list[i - 1] || null };
  // 10주년 이후: 다음 100일 단위
  const d = dPlus(start, today);
  const n = Math.ceil(d / 100) * 100;
  return { next: { label: `${fmt.num(n)}일`, date: addDays(start, n - 1), kind: "day", n }, prev: list[list.length - 1] };
}
const dLabel = (date, today = todayKey()) => {
  const g = diffDays(today, date);
  return g === 0 ? "D-day" : g > 0 ? `D-${fmt.num(g)}` : `D+${fmt.num(-g)}`;
};

function icsText(r, item) {
  const escIcs = (s) => String(s).replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  const names = `${r.n[0]} ♥ ${r.n[1]}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//couple-dday-room//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${r.id}-${item.kind}-${item.n}@couple-dday`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${item.date.replaceAll("-", "")}`,
    `DTEND;VALUE=DATE:${addDays(item.date, 1).replaceAll("-", "")}`,
    `SUMMARY:${escIcs(`${names} ${item.label} 💌`)}`,
    `DESCRIPTION:${escIcs(`사귄 날(${dotDate(r.s)})을 1일로 센 ${item.label}이에요. D+${fmt.num(item.n)}`)}`,
    "TRANSP:TRANSPARENT",
    "BEGIN:VALARM",
    "TRIGGER:-PT15H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escIcs(`내일은 ${item.label}이에요 💌`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
function openCalendar(item) {
  const r = room();
  if (!r) return;
  const today = todayKey();
  const past = item.date < today;
  $("#calBody").innerHTML = `
    <p class="t-label-02 t-secondary">${esc(r.n[0])} ♥ ${esc(r.n[1])}</p>
    <div class="row between">
      <p class="t-title-02">${item.label}</p>
      <span class="badge">${dLabel(item.date, today)}</span>
    </div>
    <p class="t-body-02">${longDate(item.date)} · D+${fmt.num(item.n)}</p>
    <p class="t-caption-01 t-tertiary">${past ? "이미 지난 기념일이에요. 기록용으로 저장할 수 있어요." : "캘린더 파일(.ics)을 열면 하루 전 오전 9시에 알림이 울려요."}</p>
    <button class="btn btn--primary btn--block" id="dlIcs">캘린더에 넣기 (.ics)</button>
    <button class="btn btn--ghost btn--block" data-sheet-close>닫기</button>`;
  const close = openSheet($("#calSheet"));
  $("#dlIcs").onclick = () => {
    downloadBlob(new Blob([icsText(r, item)], { type: "text/calendar;charset=utf-8" }), `${item.label}.ics`);
    haptic();
    toast(`${item.label} 캘린더 파일을 저장했어요`);
    close();
  };
}

/* ---------- 연속 기록 ---------- */
function stats(r) {
  const entries = Object.values(r.qa || {});
  const both = new Set(entries.filter((e) => e.a[0] && e.a[1]).map((e) => e.d));
  const mine = entries.filter((e) => e.a[r.me]).length;
  let cur = todayKey();
  if (!both.has(cur)) cur = addDays(cur, -1);
  let streak = 0;
  while (both.has(cur)) {
    streak++;
    cur = addDays(cur, -1);
  }
  let best = 0;
  [...both].sort().forEach((d, i, arr) => {
    let run = 1;
    let k = i;
    while (k > 0 && diffDays(arr[k - 1], arr[k]) === 1) {
      run++;
      k--;
    }
    best = Math.max(best, run);
  });
  return { streak, best, both: both.size, mine };
}

/* ---------- 질문 카드 ---------- */
function bubbles(r, e) {
  const me = e.a[r.me];
  const you = e.a[1 - r.me];
  return `<div class="qcard__answers">
    <div class="bubble bubble--me"><span class="bubble__who">${esc(myName(r))}</span><p>${esc(me)}</p></div>
    <div class="bubble bubble--you"><span class="bubble__who">${esc(yourName(r))}</span><p>${esc(you)}</p></div>
  </div>`;
}
function qHead(e, extra = "") {
  const Q = QUESTIONS[e.q];
  return `<div class="row between qcard__meta">
      <span class="badge">${LEVELS[Q.level]} · ${dotDate(e.d)}</span>${extra}
    </div>
    <p class="qcard__q">${esc(Q.text)}</p>`;
}
// state: ask(답 쓰기) / wait(내 답만) / locked(상대 답만 있고 아직 안 엶) / open(둘 다)
function renderQCard(el, r, e, { onSubmit, onReveal, animate = false } = {}) {
  const mine = e.a[r.me];
  const theirs = e.a[1 - r.me];
  let front = "";
  if (!mine) {
    front = `${qHead(e, theirs ? `<span class="lock-pill">🔒 ${esc(yourName(r))}님 답 도착</span>` : "")}
      <label class="field">
        <span class="sr-only">내 답</span>
        <textarea class="input qcard__input" maxlength="200" placeholder="${theirs ? "내 답을 적으면 둘의 답이 같이 열려요" : "솔직하게 적어보세요. 상대도 답해야 열려요"}"></textarea>
        <span class="field__help row between"><span>${theirs ? "둘 다 답해야 열려요" : "답하면 상대에게 보낼 링크가 생겨요"}</span><span class="t-num qcard__count">0/200</span></span>
      </label>
      <button class="btn btn--primary btn--block qcard__submit" disabled>${theirs ? "답하고 열어보기 💌" : "답하고 링크 만들기"}</button>`;
  } else if (!theirs) {
    front = `${qHead(e)}
      <div class="qcard__answers">
        <div class="bubble bubble--me"><span class="bubble__who">${esc(myName(r))} (나)</span><p>${esc(mine)}</p></div>
        <div class="bubble bubble--locked"><span class="bubble__who">${esc(yourName(r))}</span><p><span class="lock-ico" aria-hidden="true">🔒</span>답을 기다리는 중</p></div>
      </div>`;
  } else {
    front = `${qHead(e)}
      <div class="sealed">
        <div class="sealed__env" aria-hidden="true">💌</div>
        <p class="t-body-02-strong">둘 다 답했어요</p>
        <p class="t-caption-01 t-tertiary">눌러서 같이 열어봐요</p>
      </div>
      <button class="btn btn--primary btn--block qcard__reveal">열어보기</button>`;
  }
  const back = theirs && mine ? `${qHead(e, `<span class="lock-pill lock-pill--open">💞 열림</span>`)}${bubbles(r, e)}` : "";
  const flipped = mine && theirs && e.revealed && !animate;
  el.innerHTML = `<div class="qcard__inner ${flipped ? "is-flipped is-settled" : ""}">
      <div class="qcard__face qcard__front">${front}</div>
      <div class="qcard__face qcard__back">${back}</div>
    </div>`;

  const ta = $(".qcard__input", el);
  if (ta) {
    const btn = $(".qcard__submit", el);
    const cnt = $(".qcard__count", el);
    ta.addEventListener("input", () => {
      btn.disabled = !ta.value.trim();
      cnt.textContent = `${ta.value.length}/200`;
    });
    btn.addEventListener("click", () => {
      const v = ta.value.trim();
      if (!v) return;
      e.a[r.me] = v;
      e.at = Date.now();
      saveRooms();
      haptic(18);
      onSubmit?.();
    });
  }
  $(".qcard__reveal", el)?.addEventListener("click", () => flip(el, r, e, onReveal));
}
function flip(el, r, e, after) {
  const inner = $(".qcard__inner", el);
  e.revealed = true;
  saveRooms();
  haptic([10, 40, 20]);
  inner.classList.add("is-flipped");
  setTimeout(() => {
    inner.classList.add("is-settled");
    after?.();
  }, prefersReducedMotion() ? 0 : 700);
}

/* ---------- 방 화면 ---------- */
let tickTimer;
let showPast = false;
function renderRoom({ animate = true } = {}) {
  const r = room();
  if (!r) return showIntro();
  const today = todayKey();
  $("#roomTitle").textContent = `${r.n[0]} ♥ ${r.n[1]}`;
  $("#heroNames").textContent = `${myName(r)} ♥ ${yourName(r)}`;
  const d = dPlus(r.s, today);
  if (animate) countUp($("#heroD"), d, { duration: 1400, format: (n) => fmt.num(Math.round(n)) });
  else $("#heroD").textContent = fmt.num(d);
  $("#heroSince").textContent = `${longDate(r.s)}부터 · 사귄 날을 1일로 세요`;
  tickTogether(r);
  clearInterval(tickTimer);
  tickTimer = setInterval(() => tickTogether(r), 1000);

  renderNext(r, today);
  renderToday(r);
  renderAnniv(r, today);
  renderAlbum(r);
}
function tickTogether(r) {
  if (!r || $("[data-view=room]").hidden) return;
  const ms = Math.max(0, Date.now() - startMs(r.s));
  const days = Math.floor(ms / DAY);
  $("#tWeeks").textContent = fmt.num(Math.floor(days / 7));
  $("#tWeeksSub").textContent = days % 7 ? `주 ${days % 7}일` : "주";
  $("#tHours").textContent = fmt.num(Math.floor(ms / 3600000));
  $("#tMins").textContent = fmt.num(Math.floor(ms / 60000));
  if (todayKey() !== renderRoom.lastDay) {
    renderRoom.lastDay = todayKey();
    if (renderRoom.booted) renderRoom({ animate: false });
  }
}
function renderNext(r, today) {
  const { next, prev } = nextAnniversary(r.s, today);
  const gap = diffDays(today, next.date);
  const from = prev ? prev.date : r.s;
  const total = Math.max(1, diffDays(from, next.date));
  const pct = Math.min(100, Math.max(0, (diffDays(from, today) / total) * 100));
  $("#nextCard").innerHTML = `
    <div class="row between">
      <p class="t-label-02 t-secondary">${gap === 0 ? "오늘은 기념일 🎉" : "다음 기념일"}</p>
      <span class="t-caption-01 t-tertiary">${longDate(next.date)}</span>
    </div>
    <div class="row between next__main">
      <p class="t-title-01">${next.label}</p>
      <p class="next__d t-num">${gap === 0 ? "D-day" : `D-${fmt.num(gap)}`}</p>
    </div>
    <div class="next__bar" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>
    <div class="row between">
      <span class="t-caption-01 t-tertiary">${prev ? prev.label : "사귄 날"}에서 ${Math.round(pct)}%</span>
      <button class="btn btn--secondary btn--sm" id="nextCal">캘린더에 넣기</button>
    </div>`;
  $("#nextCal").onclick = () => openCalendar(next);
}
function renderToday(r) {
  const { q, d } = todayQuestion(r);
  const e = entryOf(r, d, q);
  const el = $("#todayCard");
  const actions = $("#todayActions");
  const paint = (animate) => {
    renderQCard(el, r, e, {
      animate,
      onSubmit: () => {
        if (e.a[1 - r.me]) {
          paint(true);
          setTimeout(() => flip(el, r, e, () => paintActions()), 250);
        } else {
          paint(false);
          sendAnswer(r, e);
        }
        renderAlbum(r);
      },
      onReveal: () => paintActions(),
    });
    paintActions();
  };
  const paintActions = () => {
    const mine = e.a[r.me];
    const theirs = e.a[1 - r.me];
    if (!mine) {
      actions.innerHTML = `<p class="t-caption-01 t-tertiary t-center">매일 자정(한국 시간)에 새 질문이 열려요</p>`;
    } else if (!theirs) {
      actions.innerHTML = `
        <button class="btn btn--primary btn--block" id="sendAns">${esc(yourName(r))}님에게 보내기 💌</button>
        <div class="row gap-8">
          <button class="btn btn--outline grow" id="copyAns">링크 복사</button>
          <button class="btn btn--ghost grow" id="editAns">내 답 고치기</button>
        </div>
        <p class="t-caption-01 t-tertiary t-center">${esc(yourName(r))}님이 답하고 답장 링크를 보내주면 여기서 열려요</p>`;
      $("#sendAns").onclick = () => sendAnswer(r, e);
      $("#copyAns").onclick = async () => toast((await copyText(answerLink(r, e))) ? "링크를 복사했어요" : "복사에 실패했어요");
      $("#editAns").onclick = () => {
        delete e.a[r.me];
        saveRooms();
        paint(false);
      };
    } else if (!e.revealed) {
      actions.innerHTML = "";
    } else {
      actions.innerHTML = `
        ${e.replied ? "" : `<button class="btn btn--secondary btn--block" id="replyAns">${esc(yourName(r))}님에게도 열어주기</button>`}
        <p class="t-caption-01 t-tertiary t-center" id="nextQ"></p>`;
      $("#replyAns")?.addEventListener("click", async () => {
        await sendAnswer(r, e, 1);
        e.replied = true;
        saveRooms();
      });
      const left = nextMidnightMs() - Date.now();
      $("#nextQ").textContent = `다음 질문까지 ${Math.floor(left / 3600000)}시간 ${Math.floor((left % 3600000) / 60000)}분`;
    }
  };
  paint(false);
}
function nextMidnightMs() {
  return toUTC(addDays(todayKey(), 1)) - 9 * 3600000;
}
function renderAnniv(r, today) {
  const list = anniversaries(r.s);
  const firstUp = list.findIndex((x) => x.date >= today);
  const pastCount = firstUp < 0 ? list.length : firstUp;
  $("#annList").innerHTML = list
    .map((x, i) => {
      const past = x.date < today;
      if (past && !showPast) return "";
      const isNext = i === firstUp;
      const gap = diffDays(today, x.date);
      return `<li>
        <button class="ann ${past ? "is-past" : ""} ${isNext ? "is-next" : ""} ${x.kind === "year" ? "is-year" : ""}" data-i="${i}">
          <span class="ann__label">${x.label}${x.kind === "year" ? `<small>D+${fmt.num(x.n)}</small>` : ""}</span>
          <span class="ann__date">${longDate(x.date)}</span>
          <span class="ann__d t-num">${past ? "지났어요" : gap === 0 ? "오늘 🎉" : `D-${fmt.num(gap)}`}</span>
        </button>
      </li>`;
    })
    .join("");
  $$("#annList .ann").forEach((b) => (b.onclick = () => openCalendar(list[Number(b.dataset.i)])));
  const tp = $("#togglePast");
  tp.hidden = pastCount === 0;
  tp.textContent = showPast ? "지난 기념일 숨기기" : `지난 기념일 ${pastCount}개 보기`;
}
function renderAlbum(r) {
  const s = stats(r);
  $("#streak").innerHTML = `
    <div class="row gap-12">
      <span class="streak__fire ${s.streak ? "is-on" : ""}" aria-hidden="true">🔥</span>
      <div class="grow">
        <p class="t-title-03 t-num">${s.streak ? `${s.streak}일 연속 둘 다 답했어요` : "오늘부터 연속 기록을 시작해요"}</p>
        <p class="t-caption-01 t-tertiary">둘 다 답한 질문 ${s.both}개 · 내가 답한 질문 ${s.mine}개 · 최고 ${s.best}일 연속</p>
      </div>
    </div>
    <p class="t-caption-01 t-tertiary streak__note">이 기기에서 확인된 둘의 답을 기준으로 세요.</p>`;
  const list = Object.values(r.qa || {})
    .filter((e) => e.a[0] || e.a[1])
    .sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : (b.at || 0) - (a.at || 0)));
  if (!list.length) {
    $("#album").innerHTML = `<li class="album__empty t-center"><p class="t-body-02-strong">아직 앨범이 비어 있어요</p><p class="t-caption-01 t-tertiary">오늘의 질문에 답하면 여기에 차곡차곡 쌓여요</p></li>`;
    return;
  }
  $("#album").innerHTML = list
    .map((e) => {
      const mine = e.a[r.me];
      const theirs = e.a[1 - r.me];
      const you = !theirs
        ? `<p class="t-tertiary">🔒 아직 몰라요</p>`
        : mine
          ? `<p>${esc(theirs)}</p>`
          : `<p class="t-tertiary">🔒 내가 답하면 열려요</p>`;
      return `<li class="album__item">
        <p class="t-caption-01 t-tertiary">${longDate(e.d)} · ${LEVELS[QUESTIONS[e.q].level]}</p>
        <p class="t-body-02-strong">${esc(QUESTIONS[e.q].text)}</p>
        <div class="album__pair">
          <div><span class="bubble__who">${esc(myName(r))}</span>${mine ? `<p>${esc(mine)}</p>` : `<p class="t-tertiary">아직 안 했어요</p>`}</div>
          <div><span class="bubble__who">${esc(yourName(r))}</span>${you}</div>
        </div>
        ${theirs && !mine ? `<button class="btn btn--secondary btn--sm album__open" data-k="${qaKey(e.d, e.q)}">답하고 열기</button>` : ""}
        ${mine && !theirs ? `<button class="btn btn--ghost btn--sm album__open album__send" data-k="${qaKey(e.d, e.q)}">다시 보내기</button>` : ""}
      </li>`;
    })
    .join("");
  $$("#album .album__open").forEach((b) => {
    b.onclick = () => {
      const e = r.qa[b.dataset.k];
      if (b.classList.contains("album__send")) return sendAnswer(r, e);
      openAnswerView(r, e, { from: 1 - r.me, re: 0 });
    };
  });
}

/* ---------- 받은 답 화면 ---------- */
function openAnswerView(r, e, { from, re, created }) {
  stopIntro();
  showView("answer");
  const sender = r.n[from];
  $("#ansDate").textContent = `${dotDate(e.d)} 오늘의 질문`;
  const el = $("#ansCard");
  const actions = $("#ansActions");
  const ownLink = from === r.me;

  const paintActions = () => {
    const mine = e.a[r.me];
    const theirs = e.a[1 - r.me];
    if (ownLink) {
      actions.innerHTML = `<button class="btn btn--primary btn--block" id="ansResend">${esc(yourName(r))}님에게 다시 보내기</button>
        <button class="btn btn--ghost btn--block" data-go="room">우리 방으로 가기</button>`;
      $("#ansResend").onclick = () => sendAnswer(r, e);
    } else if (mine && theirs && e.revealed) {
      $("#ansTitle").textContent = "둘의 답이 열렸어요 💞";
      $("#ansDesc").textContent = "같은 질문, 다른 답. 오늘 대화거리가 생겼어요.";
      actions.innerHTML = re
        ? `<p class="t-body-03 t-secondary t-center">둘 다 서로의 답을 확인했어요 💞</p>
           <button class="btn btn--primary btn--block" data-go="room">우리 방으로 가기</button>`
        : `<button class="btn btn--primary btn--block" id="ansReply">${esc(sender)}님에게 답장 보내기 💌</button>
           <p class="t-caption-01 t-tertiary t-center">답장 링크를 보내야 ${esc(sender)}님도 내 답을 볼 수 있어요</p>
           <button class="btn btn--ghost btn--block" data-go="room">우리 방으로 가기</button>`;
      $("#ansReply")?.addEventListener("click", async () => {
        await sendAnswer(r, e, 1);
        e.replied = true;
        saveRooms();
      });
    } else {
      actions.innerHTML = created
        ? `<p class="t-caption-01 t-tertiary t-center">${esc(r.n[0])} ♥ ${esc(r.n[1])} 방이 이 기기에도 만들어졌어요</p>`
        : "";
    }
    bindGo(actions);
  };

  if (ownLink) {
    $("#ansTitle").textContent = "내가 보낸 답이에요";
    $("#ansDesc").textContent = `${yourName(r)}님이 이 링크를 열고 답하면 둘의 답이 열려요.`;
  } else if (e.a[r.me]) {
    $("#ansTitle").textContent = re ? `${sender}님의 답장이 왔어요 💞` : `${sender}님의 답이 도착했어요`;
    $("#ansDesc").textContent = "둘 다 답했으니 이제 같이 열어봐요.";
  } else {
    $("#ansTitle").textContent = `${sender}님의 답이 도착했어요`;
    $("#ansDesc").textContent = "같은 질문에 내 답을 먼저 적어야 열려요 🔒";
  }
  renderQCard(el, r, e, {
    onSubmit: () => {
      $("#ansTitle").textContent = "둘 다 답했어요!";
      $("#ansDesc").textContent = "카드를 뒤집어볼게요.";
      renderQCard(el, r, e, { animate: true });
      setTimeout(() => flip(el, r, e, () => (paintActions(), renderRoom({ animate: false }))), 300);
    },
    onReveal: () => paintActions(),
  });
  paintActions();
}
function handleAnswerLink(p) {
  if (!p || !p.r || !isDateKey(p.r.s) || !Array.isArray(p.r.n) || !QUESTIONS[p.q] || !isDateKey(p.d) || ![0, 1].includes(p.f)) {
    toast("링크가 올바르지 않아요");
    return false;
  }
  let r = rooms[p.r.id];
  let created = false;
  if (!r) {
    r = { id: String(p.r.id), n: p.r.n.map((x) => String(x).slice(0, 10)), s: p.r.s, c: isDateKey(p.r.c) ? p.r.c : p.r.s, me: 1 - p.f, qa: {} };
    rooms[r.id] = r;
    created = true;
  }
  currentId = r.id;
  const e = entryOf(r, p.d, p.q);
  if (p.f !== r.me) {
    const text = unseal(p.x || "", sealSeed(r.id, p.q, p.d, p.f));
    if (text) e.a[p.f] = text.slice(0, 200);
    if (p.re) e.replied = true; // 상대는 이미 내 답을 봤어요
  }
  saveRooms();
  renderRoom({ animate: false });
  openAnswerView(r, e, { from: p.f, re: p.re, created });
  return true;
}

/* ---------- 초대 링크로 들어오기 ---------- */
function handleRoomLink(p) {
  if (!p || !Array.isArray(p.n) || p.n.length !== 2 || !isDateKey(p.s) || !p.id) {
    toast("방 링크가 올바르지 않아요");
    return false;
  }
  if (rooms[p.id]) {
    currentId = p.id;
    const r = rooms[p.id];
    r.n = p.n.map((x) => String(x).slice(0, 10));
    r.s = p.s;
    saveRooms();
    openRoom();
    toast("우리 방으로 왔어요");
    return true;
  }
  stopIntro();
  showView("join");
  const f = [0, 1].includes(p.f) ? p.f : 0;
  let me = 1 - f;
  $("#joinTitle").textContent = `${p.n[f]}님이 우리 방에 초대했어요`;
  $("#joinDesc").textContent = "들어가면 같은 날짜, 같은 질문을 같이 써요.";
  $("#joinNames").textContent = `${p.n[0]} ♥ ${p.n[1]}`;
  $("#joinD").textContent = `D+${fmt.num(dPlus(p.s))}`;
  $("#joinSince").textContent = `${longDate(p.s)}부터`;
  const who = $("#joinWho");
  const paintWho = () => {
    who.innerHTML = p.n
      .map((n, i) => `<button class="chip grow" role="radio" aria-pressed="${i === me}" aria-checked="${i === me}" data-i="${i}">${esc(n)}</button>`)
      .join("");
    $$("button", who).forEach((b) => (b.onclick = () => ((me = Number(b.dataset.i)), paintWho())));
  };
  paintWho();
  $("#joinWarn").hidden = !Object.keys(rooms).length;
  $("#joinBtn").onclick = () => {
    rooms[p.id] = { id: String(p.id), n: p.n.map((x) => String(x).slice(0, 10)), s: p.s, c: isDateKey(p.c) ? p.c : p.s, me, qa: {} };
    currentId = p.id;
    saveRooms();
    haptic(20);
    openRoom();
    toast("우리 방에 들어왔어요 💗");
  };
  return true;
}

/* ---------- 화면 전환 ---------- */
let intro;
function stopIntro() {
  intro?.stop();
  intro = null;
}
function showIntro() {
  showView("intro");
  const r = room();
  $("#introRoom").hidden = !r;
  if (r) $("#introRoom").textContent = `${r.n[0]} ♥ ${r.n[1]} 방으로 가기`;
  stopIntro();
  intro = runIntro({ root: $("#intro"), scenes: SCENES, loop: true });
}
function openRoom() {
  stopIntro();
  showView("room");
  renderRoom.booted = true;
  renderRoom.lastDay = todayKey();
  renderRoom({ animate: true });
}
function openSetup() {
  stopIntro();
  showView("setup");
  const inp = $("#startDate");
  inp.max = todayKey();
  updatePreview();
}
function bindGo(root = document) {
  $$("[data-go]", root).forEach((b) => {
    b.onclick = () => {
      const g = b.dataset.go;
      if (g === "intro") showIntro();
      else if (g === "room") room() ? openRoom() : showIntro();
    };
  });
}

/* ---------- 방 만들기 ---------- */
function updatePreview() {
  const v = $("#startDate").value;
  const pv = $("#setupPreview");
  const fieldEl = $("#startField");
  fieldEl.classList.remove("is-error");
  $("#startHelp").textContent = "사귄 날을 1일로 세요 (D+1)";
  if (!isDateKey(v)) {
    pv.hidden = true;
    return;
  }
  if (v > todayKey()) {
    fieldEl.classList.add("is-error");
    $("#startHelp").textContent = "오늘 이후 날짜는 고를 수 없어요";
    pv.hidden = true;
    return;
  }
  const { next } = nextAnniversary(v);
  pv.hidden = false;
  pv.innerHTML = `<div class="row between"><span class="t-body-03 t-secondary">오늘은</span><strong class="t-title-03 t-primary t-num">D+${fmt.num(dPlus(v))}</strong></div>
    <div class="row between"><span class="t-body-03 t-secondary">다음 기념일</span><span class="t-body-03-strong">${next.label} · ${dLabel(next.date)}</span></div>`;
}
$("#startDate").addEventListener("input", updatePreview);
$("#startDate").addEventListener("change", updatePreview);
$("#setupForm").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const a = $("#nameMe").value.trim();
  const b = $("#nameYou").value.trim();
  const s = $("#startDate").value;
  let ok = true;
  [
    ["#nameMe", a],
    ["#nameYou", b],
  ].forEach(([sel, v]) => {
    $(sel).classList.toggle("is-error", !v);
    if (!v) ok = false;
  });
  if (!isDateKey(s) || s > todayKey()) {
    $("#startField").classList.add("is-error");
    $("#startHelp").textContent = isDateKey(s) ? "오늘 이후 날짜는 고를 수 없어요" : "사귄 날을 골라주세요";
    ok = false;
  }
  if (!ok) {
    toast("이름 두 개와 사귄 날을 채워주세요");
    return;
  }
  const id = newId();
  rooms[id] = { id, n: [a, b], s, c: todayKey(), me: 0, qa: {} };
  currentId = id;
  saveRooms();
  haptic(20);
  openRoom();
});
["#nameMe", "#nameYou"].forEach((s) => $(s).addEventListener("input", (e) => e.target.classList.remove("is-error")));

/* ---------- 탭 ---------- */
$$(".tabs__btn").forEach((b) => {
  b.onclick = () => {
    $$(".tabs__btn").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    $$("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== b.dataset.tab));
    store.set("tab", b.dataset.tab);
  };
});
const savedTab = store.get("tab");
if (savedTab) $(`.tabs__btn[data-tab="${savedTab}"]`)?.click();
$("#togglePast").onclick = () => {
  showPast = !showPast;
  renderAnniv(room(), todayKey());
};

/* ---------- 공유 ---------- */
async function shareRoom() {
  const r = room();
  if (!r) return;
  await share({
    title: "커플 D-day 룸 💌",
    text: `${myName(r)}님이 우리 방에 초대했어요. 우리 D+${fmt.num(dPlus(r.s))} 💗`,
    url: roomLink(r),
  });
}
$("#shareRoom").onclick = shareRoom;
$("#shareRoomTop").onclick = shareRoom;
$("#saveCard").onclick = async () => {
  const r = room();
  if (!r) return;
  const btn = $("#saveCard");
  btn.classList.add("is-loading");
  try {
    const canvas = drawCard(r);
    const d = dPlus(r.s);
    await shareImage(canvas, { filename: `우리-D+${d}.png`, text: `우리 D+${fmt.num(d)} 💌` });
  } finally {
    btn.classList.remove("is-loading");
  }
};

function token(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function drawCard(r) {
  const W = 540;
  const H = 675;
  const { canvas, ctx } = createCanvas(W, H, 2);
  const brand = token("--brand");
  const soft = token("--brand-soft");
  const surface = token("--color-surface");
  const text = token("--color-text");
  const sub = token("--color-text-secondary");
  const ter = token("--color-text-tertiary");
  const today = todayKey();
  const d = dPlus(r.s, today);
  const { next } = nextAnniversary(r.s, today);
  const gap = diffDays(today, next.date);

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, soft);
  g.addColorStop(1, surface);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // 장식 하트
  const rand = seededRandom(`card:${r.id}`);
  for (let i = 0; i < 16; i++) {
    ctx.globalAlpha = 0.1 + rand() * 0.18;
    const side = i % 2 ? W - 20 - rand() * 64 : 20 + rand() * 64;
    drawHeart(ctx, side, 30 + rand() * (H - 60), 8 + rand() * 18, brand);
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = "center";
  ctx.fillStyle = sub;
  ctx.font = `600 18px ${CANVAS_FONT}`;
  ctx.fillText("💌 커플 D-day 룸", W / 2, 64);
  ctx.fillStyle = text;
  ctx.font = `700 30px ${CANVAS_FONT}`;
  ctx.fillText(`${r.n[0]} ♥ ${r.n[1]}`, W / 2, 140);
  ctx.fillStyle = sub;
  ctx.font = `600 26px ${CANVAS_FONT}`;
  ctx.fillText("우리", W / 2, 212);
  ctx.fillStyle = brand;
  const big = `D+${fmt.num(d)}`;
  let size = 112;
  ctx.font = `800 ${size}px ${CANVAS_FONT}`;
  while (ctx.measureText(big).width > W - 80 && size > 60) {
    size -= 4;
    ctx.font = `800 ${size}px ${CANVAS_FONT}`;
  }
  ctx.fillText(big, W / 2, 316);
  ctx.fillStyle = sub;
  ctx.font = `500 18px ${CANVAS_FONT}`;
  const ms = Math.max(0, Date.now() - startMs(r.s));
  ctx.fillText(`${dotDate(r.s)}부터 · 함께한 ${fmt.num(Math.floor(ms / 3600000))}시간`, W / 2, 360);

  // 다음 기념일 카드
  const cx = 48;
  const cy = 410;
  const cw = W - 96;
  const ch = 132;
  ctx.save();
  ctx.shadowColor = "rgba(18,21,27,0.12)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = surface;
  roundRect(ctx, cx, cy, cw, ch, 24);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = ter;
  ctx.font = `600 16px ${CANVAS_FONT}`;
  ctx.fillText("다음 기념일", W / 2, cy + 40);
  ctx.fillStyle = text;
  ctx.font = `800 34px ${CANVAS_FONT}`;
  ctx.fillText(`${next.label} (${gap === 0 ? "D-day" : `D-${fmt.num(gap)}`})`, W / 2, cy + 84);
  ctx.fillStyle = sub;
  ctx.font = `500 16px ${CANVAS_FONT}`;
  ctx.fillText(longDate(next.date), W / 2, cy + 112);

  ctx.fillStyle = sub;
  ctx.font = `600 17px ${CANVAS_FONT}`;
  wrapText(ctx, "매일 하나씩, 둘 다 답해야 열리는 질문", W / 2, 600, W - 96, 24);
  ctx.fillStyle = ter;
  ctx.font = `500 14px ${CANVAS_FONT}`;
  ctx.fillText("커플 D-day 룸에서 우리 방 만들기", W / 2, 632);
  return canvas;
}
// "#rrggbb" 토큰에 투명도만 입혀요 (캔버스 그라디언트용)
function alpha(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
function heartPoint(t) {
  const s = Math.sin(t);
  return [16 * s * s * s, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))];
}
function drawHeart(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const [hx, hy] = heartPoint((i / 40) * Math.PI * 2);
    const px = x + (hx / 17) * size;
    const py = y + (hy / 17) * size;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.fill();
}

/* ---------- 설정 ---------- */
$("#openSettings").onclick = () => {
  const r = room();
  if (!r) return;
  $("#editMe").value = myName(r);
  $("#editYou").value = yourName(r);
  $("#editStart").value = r.s;
  $("#editStart").max = todayKey();
  const close = openSheet($("#settingsSheet"));
  $("#saveSettings").onclick = () => {
    const a = $("#editMe").value.trim();
    const b = $("#editYou").value.trim();
    const s = $("#editStart").value;
    if (!a || !b || !isDateKey(s) || s > todayKey()) return toast("이름과 날짜를 확인해주세요");
    r.n[r.me] = a;
    r.n[1 - r.me] = b;
    r.s = s;
    saveRooms();
    close();
    renderRoom({ animate: true });
    toast("저장했어요");
  };
  $("#replayIntro").onclick = () => {
    close();
    showIntro();
  };
  $("#leaveRoom").onclick = () => {
    if (!confirm("이 기기에서 방과 질문 앨범을 지울까요? 상대 기기의 기록은 그대로예요.")) return;
    delete rooms[r.id];
    currentId = Object.keys(rooms)[0] || null;
    saveRooms();
    close();
    currentId ? openRoom() : showIntro();
    toast("방을 지웠어요");
  };
};

/* ---------- 인트로 모션그래픽 ---------- */
function stageCanvas(stage) {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cv = document.createElement("canvas");
  cv.className = "ic-canvas";
  cv.width = w * dpr;
  cv.height = h * dpr;
  cv.style.width = `${w}px`;
  cv.style.height = `${h}px`;
  stage.appendChild(cv);
  const ctx = cv.getContext("2d");
  ctx.scale(dpr, dpr);
  return { cv, ctx, w, h };
}
function animate(signal, duration, frame) {
  const t0 = performance.now();
  if (prefersReducedMotion()) {
    frame(duration);
    return;
  }
  const loop = (now) => {
    if (signal.aborted) return;
    const t = Math.min(duration, now - t0);
    frame(t);
    if (t < duration) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
const later = (signal, ms, fn) => {
  const id = setTimeout(() => !signal.aborted && fn(), prefersReducedMotion() ? 0 : ms);
  signal.addEventListener("abort", () => clearTimeout(id));
};
const ease = (t) => (t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 3));
const easeIO = (t) => (t < 0 ? 0 : t > 1 ? 1 : t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function sceneMeet(stage, signal) {
  stage.innerHTML = "";
  const { ctx, w, h } = stageCanvas(stage);
  const brand = token("--brand");
  const warm = token("--color-warning");
  const soft = token("--brand-soft");
  const s = Math.min(w, h) / 40;
  const cx = w / 2;
  const cy = h / 2 - 2 * s;
  const H = (t) => {
    const [x, y] = heartPoint(t);
    return [cx + x * s, cy + y * s];
  };
  const top = H(0);
  const startL = [-20, cy + 8 * s];
  const startR = [w + 20, cy - 4 * s];
  const ctrlL = [w * 0.15, cy - 16 * s];
  const ctrlR = [w * 0.85, cy + 14 * s];
  const bez = (p0, c, p1, t) => [
    (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0],
    (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1],
  ];
  const glowDot = (x, y, color, r = 6) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
    g.addColorStop(0, alpha(color, 0.9));
    g.addColorStop(1, alpha(color, 0));
    ctx.fillStyle = g;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(x, y, r * 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  const trail = (pts, color, alpha) => {
    if (pts.length < 2) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.restore();
  };
  const D1 = 1300;
  const D2 = 1500;
  const D3 = 900;
  animate(signal, D1 + D2 + D3, (t) => {
    ctx.clearRect(0, 0, w, h);
    const a = easeIO(t / D1);
    const b = easeIO((t - D1) / D2);
    const c = ease((t - D1 - D2) / D3);
    // 접근 곡선 꼬리
    const N = 30;
    const approach = (p0, ctrl) => {
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const u = (i / N) * a;
        if (u < a - 0.35) continue;
        pts.push(bez(p0, ctrl, top, u));
      }
      return pts;
    };
    trail(approach(startL, ctrlL), brand, 0.35 * (1 - b));
    trail(approach(startR, ctrlR), warm, 0.35 * (1 - b));
    // 하트 그리기
    const half = (dir) => {
      const pts = [];
      for (let i = 0; i <= 60; i++) {
        const u = (i / 60) * b * Math.PI;
        pts.push(H(dir * u));
      }
      return pts;
    };
    if (b > 0) {
      if (c > 0) {
        ctx.save();
        ctx.globalAlpha = 0.9 * c;
        const pulse = 1 + 0.04 * Math.sin(c * Math.PI);
        ctx.translate(cx, cy + 4 * s);
        ctx.scale(pulse, pulse);
        ctx.translate(-cx, -(cy + 4 * s));
        ctx.fillStyle = soft;
        ctx.beginPath();
        for (let i = 0; i <= 80; i++) {
          const [x, y] = H((i / 80) * Math.PI * 2);
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.fill();
        ctx.restore();
      }
      trail(half(-1), brand, 1);
      trail(half(1), warm, 1);
    }
    if (b <= 0) {
      const [lx, ly] = bez(startL, ctrlL, top, a);
      const [rx, ry] = bez(startR, ctrlR, top, a);
      glowDot(lx, ly, brand);
      glowDot(rx, ry, warm);
    } else if (c <= 0) {
      const [lx, ly] = H(-b * Math.PI);
      const [rx, ry] = H(b * Math.PI);
      glowDot(lx, ly, brand);
      glowDot(rx, ry, warm);
    } else {
      const [bx, by] = H(Math.PI);
      glowDot(bx, by, brand, 6 + 4 * Math.sin(c * Math.PI));
      // 반짝이
      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * Math.PI * 2;
        const rr = 18 * s * (0.6 + 0.6 * c);
        ctx.globalAlpha = 1 - c;
        ctx.fillStyle = i % 2 ? brand : warm;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(ang) * rr, cy + 4 * s + Math.sin(ang) * rr * 0.9, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = brand;
      ctx.font = `800 ${Math.round(5 * s)}px ${CANVAS_FONT}`;
      ctx.textAlign = "center";
      ctx.globalAlpha = c;
      ctx.fillText("D+1", cx, cy + 5.5 * s);
      ctx.globalAlpha = 1;
    }
  });
}

function sceneCount(stage, signal) {
  stage.innerHTML = `
    <div class="ic-count">
      <p class="t-label-02 t-secondary">민수 ♥ 지은</p>
      <p class="ic-count__d t-num"><span class="ic-count__dp">D+</span><span class="ic-count__n">1</span></p>
      <div class="ic-count__chips">
        <span class="chip"><b class="t-num" data-k="w">0</b>주</span>
        <span class="chip"><b class="t-num" data-k="h">0</b>시간</span>
      </div>
      <span class="ic-count__badge">💗 100일</span>
    </div>`;
  const n = $(".ic-count__n", stage);
  const wEl = $('[data-k="w"]', stage);
  const hEl = $('[data-k="h"]', stage);
  let last = 0;
  animate(signal, 1700, (t) => {
    const v = Math.max(1, Math.round(1 + 99 * easeIO(t / 1700)));
    if (v !== last) {
      n.textContent = v;
      n.classList.remove("is-roll");
      void n.offsetWidth;
      n.classList.add("is-roll");
      last = v;
    }
    wEl.textContent = Math.floor(v / 7);
    hEl.textContent = fmt.num(v * 24);
  });
  later(signal, 1800, () => $(".ic-count__badge", stage).classList.add("is-on"));
}

function sceneQuestion(stage, signal) {
  stage.innerHTML = `
    <div class="ic-q">
      <div class="ic-q__inner">
        <div class="ic-q__face ic-q__front">
          <span class="badge">오늘의 질문</span>
          <p class="ic-q__text">우리 여행 1순위 장소는 어디예요?</p>
          <div class="ic-q__who">
            <span class="ic-q__p" data-p="a"><i>나</i><b>✓</b></span>
            <span class="ic-q__lock" aria-hidden="true">🔒</span>
            <span class="ic-q__p" data-p="b"><i>너</i><b>✓</b></span>
          </div>
          <p class="t-caption-01 t-tertiary">둘 다 답해야 열려요</p>
        </div>
        <div class="ic-q__face ic-q__back">
          <p class="ic-q__text ic-q__text--sm">우리 여행 1순위 장소는 어디예요?</p>
          <div class="ic-q__ans">
            <div class="bubble bubble--me"><span class="bubble__who">나</span><p>제주도 바다 🌊</p></div>
            <div class="bubble bubble--you"><span class="bubble__who">너</span><p>무조건 제주!</p></div>
          </div>
          <p class="ic-q__match">통했다 💞</p>
        </div>
      </div>
    </div>`;
  later(signal, 500, () => $('[data-p="a"]', stage).classList.add("is-done"));
  later(signal, 1100, () => $('[data-p="b"]', stage).classList.add("is-done"));
  later(signal, 1500, () => $(".ic-q__lock", stage).classList.add("is-open"));
  later(signal, 1800, () => $(".ic-q__inner", stage).classList.add("is-flipped"));
}

function sceneCalendar(stage, signal) {
  const cells = [];
  for (let i = 0; i < 3; i++) cells.push(`<span class="is-blank"></span>`);
  for (let d = 1; d <= 30; d++) cells.push(`<span class="${d === 18 ? "is-target" : ""}">${d}</span>`);
  const colors = ["--brand", "--color-warning", "--color-success", "--brand-pressed"];
  const rand = seededRandom("confetti");
  const pieces = Array.from({ length: 30 }, (_, i) => {
    const ang = rand() * Math.PI * 2;
    const dist = 60 + rand() * 90;
    return `<i style="--dx:${Math.cos(ang) * dist}px;--dy:${Math.sin(ang) * dist - 40}px;--rot:${Math.round(rand() * 540)}deg;--c:var(${colors[i % 4]});--delay:${Math.round(rand() * 120)}ms"></i>`;
  }).join("");
  stage.innerHTML = `
    <div class="ic-cal">
      <div class="ic-cal__head"><b>6월</b><span class="ic-cal__dd t-num">D-3</span></div>
      <div class="ic-cal__wd">${WD.map((w) => `<span>${w}</span>`).join("")}</div>
      <div class="ic-cal__grid">${cells.join("")}</div>
      <div class="ic-cal__confetti">${pieces}</div>
      <div class="ic-cal__tag">💗 100일 · 캘린더에 저장됨</div>
    </div>`;
  const dd = $(".ic-cal__dd", stage);
  const target = $(".is-target", stage);
  const conf = $(".ic-cal__confetti", stage);
  conf.style.left = `${target.offsetLeft + target.offsetWidth / 2}px`;
  conf.style.top = `${target.offsetTop + target.offsetHeight / 2}px`;
  later(signal, 400, () => (dd.textContent = "D-2"));
  later(signal, 750, () => (dd.textContent = "D-1"));
  later(signal, 1100, () => {
    dd.textContent = "D-day";
    dd.classList.add("is-on");
    $(".is-target", stage).classList.add("is-on");
    $(".ic-cal__confetti", stage).classList.add("is-on");
  });
  later(signal, 1700, () => $(".ic-cal__tag", stage).classList.add("is-on"));
}

const SCENES = [
  { title: "둘이 만난 그날부터", desc: "사귄 날을 1일로, 우리 시간이 흐르기 시작해요", duration: 4000, play: sceneMeet },
  { title: "오늘은 D+며칠?", desc: "함께한 날·주·시간까지 바로 세어줘요", duration: 3200, play: sceneCount },
  { title: "둘 다 답해야 열려요", desc: "매일 하나씩, 같은 질문에 각자 답하고 링크로 주고받아요", duration: 4000, play: sceneQuestion },
  { title: "100일·1주년 미리 챙기기", desc: "다가오는 기념일을 캘린더에 쏙 넣어둬요", duration: 3400, play: sceneCalendar },
];

/* ---------- 시작 ---------- */
$("#start").onclick = openSetup;
$("#introRoom").onclick = openRoom;
bindGo();
renderMoreSites($("#more"), "couple-dday");

function boot() {
  const a = getParam("a");
  const rm = getParam("room");
  if (a || rm) history.replaceState(null, "", location.pathname);
  if (a && handleAnswerLink(decodeState(a))) return;
  if (rm && handleRoomLink(decodeState(rm))) return;
  if (room()) openRoom();
  else showIntro();
}
boot();
