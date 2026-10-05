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
  renderCrumb,
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

/* ---------- 질문 카드: 편지지 + 봉투 ---------- */
function noteHTML(r, e, who, cls = "") {
  const mine = who === r.me;
  return `<div class="note ${mine ? "note--me" : "note--you"} ${cls}">
    <span class="note__who">${esc(r.n[who])}${mine ? " (나)" : ""}</span>
    <p>${esc(e.a[who])}</p>
  </div>`;
}
function qHead(e, extra = "") {
  const Q = QUESTIONS[e.q];
  return `<div class="letter__meta">
      <span class="letter__date">${dotDate(e.d)} · 오늘의 질문</span>${extra || `<span class="letter__lv">${LEVELS[Q.level]}</span>`}
    </div>
    <p class="letter__q">${esc(Q.text)}</p>`;
}
function envHTML(r) {
  return `<div class="env" aria-hidden="true">
      <div class="env__back"></div>
      <div class="env__letter env__letter--a"><small>${esc(myName(r))}</small><p>…</p></div>
      <div class="env__letter env__letter--b"><small>${esc(yourName(r))}</small><p>…</p></div>
      <div class="env__front"></div>
      <div class="env__flap"></div>
      <div class="env__seal">봉인</div>
      <span class="env__hint">둘 다 답했어요</span>
    </div>`;
}
// 상태: ask(답 쓰기) / wait(내 답만) / sealed(둘 다, 아직 안 엶) / open(둘 다, 열림)
function renderQCard(el, r, e, { onSubmit, onReveal, arrive = false } = {}) {
  const mine = e.a[r.me];
  const theirs = e.a[1 - r.me];
  let html = "";
  if (!mine) {
    html = `<div class="letter">
      ${qHead(e, theirs ? `<span class="lock-pill">${esc(yourName(r))}님 답 도착, 봉인 중</span>` : "")}
      <label class="field">
        <span class="sr-only">내 답</span>
        <textarea class="input letter__input" maxlength="200" placeholder="${theirs ? "내 답을 적으면 봉투가 열려요" : "여기에 적어요. 상대도 답해야 열려요"}"></textarea>
      </label>
      <div class="letter__foot"><span>${theirs ? "둘 다 답해야 열려요" : "답하면 상대에게 보낼 링크가 생겨요"}</span><span class="t-num qcard__count">0/200</span></div>
      <button class="btn btn--primary btn--block qcard__submit" disabled>${theirs ? "답하고 봉투 열기" : "답하고 링크 만들기"}</button>
    </div>`;
  } else if (!theirs) {
    html = `<div class="letter">
      ${qHead(e)}
      <div class="pair">
        ${noteHTML(r, e, r.me)}
        <div class="mini-env"><span class="mini-env__seal"></span><span class="mini-env__who">${esc(yourName(r))}님 답 기다리는 중</span></div>
      </div>
    </div>`;
  } else if (!e.revealed) {
    html = `<div class="letter">
      ${qHead(e)}
      <div class="big-env-wrap">${envHTML(r)}
        <button class="btn btn--primary btn--block qcard__reveal">봉투 열어보기</button>
      </div>
    </div>`;
  } else {
    html = `<div class="letter">
      ${qHead(e, `<span class="lock-pill">열렸어요</span>`)}
      <div class="pair ${arrive ? "is-arriving" : ""}">${noteHTML(r, e, r.me)}${noteHTML(r, e, 1 - r.me)}</div>
    </div>`;
  }
  el.innerHTML = html;

  const ta = $(".letter__input", el);
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
  $(".qcard__reveal", el)?.addEventListener("click", () => openEnvelope(el, r, e, onReveal));
}
// 봉인이 터지고 → 뚜껑이 열리고 → 두 편지가 튀어나와 자리를 잡는다
function openEnvelope(el, r, e, after) {
  const env = $(".env", el);
  const btn = $(".qcard__reveal", el);
  e.revealed = true;
  saveRooms();
  haptic([10, 40, 20]);
  const done = () => {
    renderQCard(el, r, e, { arrive: true });
    after?.();
  };
  if (!env || prefersReducedMotion()) return done();
  if (btn) btn.disabled = true;
  env.querySelectorAll(".env__letter p").forEach((p, i) => (p.textContent = e.a[i === 0 ? r.me : 1 - r.me]));
  env.classList.add("is-broken");
  setTimeout(() => env.classList.add("is-open"), 220);
  setTimeout(() => env.classList.add("is-out"), 640);
  setTimeout(done, 1500);
}

/* ---------- 방 화면 ---------- */
let tickTimer;
let showPast = false;
function odometer(el, text, { on = true } = {}) {
  el.classList.add("odo");
  el.setAttribute("aria-label", text);
  const strip = "01234567890123456789"
    .split("")
    .map((n) => `<span>${n}</span>`)
    .join("");
  let k = 0;
  el.innerHTML = [...text]
    .map((ch) =>
      /\d/.test(ch)
        ? `<span class="odo__col" aria-hidden="true" style="--d:${ch};--i:${k++}"><span class="odo__strip">${strip}</span></span>`
        : `<span class="odo__ch" aria-hidden="true">${ch}</span>`,
    )
    .join("");
  if (!on) return;
  if (prefersReducedMotion()) return el.classList.add("is-on");
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("is-on")));
}
function renderRoom({ animate = true } = {}) {
  const r = room();
  if (!r) return showIntro();
  const today = todayKey();
  $("#roomTitle").textContent = `${r.n[0]} & ${r.n[1]}`;
  $("#heroNames").innerHTML = `${esc(myName(r))} <em>♥</em> ${esc(yourName(r))}`;
  const d = dPlus(r.s, today);
  const heroD = $("#heroD");
  if (animate) {
    odometer(heroD, `D+${fmt.num(d)}`);
    const hero = $("#hero");
    hero.style.animation = "none";
    void hero.offsetWidth;
    hero.style.animation = "";
  } else if (heroD.getAttribute("aria-label") !== `D+${fmt.num(d)}`) {
    odometer(heroD, `D+${fmt.num(d)}`);
  }
  const [y, m, dd] = r.s.split("-");
  $("#heroImprint").textContent = `'${y.slice(2)} ${Number(m)} ${Number(dd)}`;
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
  const mins = fmt.num(Math.floor(ms / 60000));
  const el = $("#tMins");
  if (el.textContent !== mins) {
    const had = el.textContent !== "0";
    el.textContent = mins;
    if (had) {
      el.classList.remove("tick-bump");
      void el.offsetWidth;
      el.classList.add("tick-bump");
    }
  }
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
  const [ny, nm, nd] = next.date.split("-");
  $("#nextCard").innerHTML = `
    <div class="stamp"><small>${gap === 0 ? "오늘" : "다음 기념일"}</small><b>${next.label}</b><small>${Number(nm)}월 ${Number(nd)}일</small></div>
    <div class="next__body">
      <p class="t-label-03 t-tertiary">${gap === 0 ? "오늘이 기념일이에요" : `${next.label}까지`}</p>
      <p class="next__d t-num"><span class="odo" id="nextOdo"></span></p>
      <p class="t-caption-01 t-secondary">${longDate(next.date)}</p>
      <div class="next__bar" role="progressbar" aria-label="${prev ? prev.label : "사귄 날"}에서 진행" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>
      <button class="btn btn--outline btn--sm" id="nextCal">캘린더에 넣기</button>
    </div>
    <div class="postmark" aria-hidden="true"><span>${ny}<b>${Number(nm)}.${Number(nd)}</b>${weekday(next.date)}요일</span></div>`;
  odometer($("#nextOdo"), gap === 0 ? "D-day" : `D-${fmt.num(gap)}`);
  $("#nextCal").onclick = () => openCalendar(next);
}
function renderToday(r) {
  const { q, d } = todayQuestion(r);
  const e = entryOf(r, d, q);
  const el = $("#todayCard");
  const actions = $("#todayActions");
  const paint = () => {
    renderQCard(el, r, e, {
      onSubmit: () => {
        paint();
        if (!e.a[1 - r.me]) sendAnswer(r, e);
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
      actions.innerHTML = `<p class="t-caption-01 t-tertiary">매일 자정(한국 시간)에 새 질문이 열려요</p>`;
    } else if (!theirs) {
      actions.innerHTML = `
        <button class="btn btn--primary btn--block" id="sendAns">${esc(yourName(r))}님에게 보내기</button>
        <div class="row gap-8">
          <button class="btn btn--outline grow" id="copyAns">링크 복사</button>
          <button class="btn btn--ghost grow" id="editAns">내 답 고치기</button>
        </div>
        <p class="t-caption-01 t-tertiary">${esc(yourName(r))}님이 답하고 답장 링크를 보내주면 여기서 봉투가 열려요</p>`;
      $("#sendAns").onclick = () => sendAnswer(r, e);
      $("#copyAns").onclick = async () => toast((await copyText(answerLink(r, e))) ? "링크를 복사했어요" : "복사에 실패했어요");
      $("#editAns").onclick = () => {
        delete e.a[r.me];
        saveRooms();
        paint();
      };
    } else if (!e.revealed) {
      actions.innerHTML = "";
    } else {
      actions.innerHTML = `
        ${e.replied ? "" : `<button class="btn btn--primary btn--block" id="replyAns">${esc(yourName(r))}님에게도 열어주기</button>`}
        <p class="t-caption-01 t-tertiary" id="nextQ"></p>`;
      $("#replyAns")?.addEventListener("click", async () => {
        await sendAnswer(r, e, 1);
        e.replied = true;
        saveRooms();
      });
      const left = nextMidnightMs() - Date.now();
      $("#nextQ").textContent = `다음 질문까지 ${Math.floor(left / 3600000)}시간 ${Math.floor((left % 3600000) / 60000)}분`;
    }
  };
  paint();
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
      const [y, m, d] = x.date.split("-");
      return `<li>
        <button class="ann ${past ? "is-past" : ""} ${isNext ? "is-next" : ""} ${x.kind === "year" ? "is-year" : ""}" data-i="${i}">
          <span class="ann__date"><b>${Number(m)}.${Number(d)}</b>${y} ${weekday(x.date)}</span>
          <span class="ann__label">${x.label}${x.kind === "year" ? `<small>D+${fmt.num(x.n)}</small>` : ""}</span>
          <span class="ann__d t-num">${past ? "지났어요" : gap === 0 ? "오늘" : `D-${fmt.num(gap)}`}</span>
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
    <div class="postmark" aria-hidden="true"><span>연속<b class="t-num">${s.streak}</b>일</span></div>
    <div class="grow stack gap-4">
      <p class="t-title-04">${s.streak ? `${s.streak}일 연속, 둘 다 답했어요 🔥` : "오늘부터 연속 기록을 시작해요"}</p>
      <p class="t-caption-01 t-tertiary">둘 다 답한 질문 ${s.both}개 · 내가 답한 질문 ${s.mine}개 · 최고 ${s.best}일 연속</p>
      <p class="t-caption-01 t-tertiary">이 기기에서 확인된 둘의 답을 기준으로 세요.</p>
    </div>`;
  const list = Object.values(r.qa || {})
    .filter((e) => e.a[0] || e.a[1])
    .sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : (b.at || 0) - (a.at || 0)));
  if (!list.length) {
    $("#album").innerHTML = `<li class="album__empty"><p class="hand">아직 첫 장이 비어 있어요</p><p class="t-caption-01 t-tertiary">오늘의 질문에 답하면 여기에 한 장씩 쌓여요</p></li>`;
    return;
  }
  $("#album").innerHTML = list
    .map((e) => {
      const mine = e.a[r.me];
      const theirs = e.a[1 - r.me];
      const you = !theirs
        ? `<div class="mini-env"><span class="mini-env__seal"></span><span class="mini-env__who">아직 몰라요</span></div>`
        : mine
          ? noteHTML(r, e, 1 - r.me)
          : `<div class="mini-env"><span class="mini-env__seal"></span><span class="mini-env__who">내가 답하면 열려요</span></div>`;
      const me = mine ? noteHTML(r, e, r.me) : `<div class="note"><span class="note__who">${esc(myName(r))} (나)</span><p class="t-tertiary">아직 안 했어요</p></div>`;
      return `<li class="album__item">
        <p class="letter__date">${longDate(e.d)} · ${LEVELS[QUESTIONS[e.q].level]}</p>
        <p class="album__q">${esc(QUESTIONS[e.q].text)}</p>
        <div class="pair">${me}${you}</div>
        ${theirs && !mine ? `<button class="btn btn--primary btn--sm album__open" data-k="${qaKey(e.d, e.q)}">답하고 열기</button>` : ""}
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
  $("#ansDate").textContent = `${dotDate(e.d)} · 오늘의 질문`;
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
      $("#ansTitle").textContent = "둘의 답이 열렸어요";
      $("#ansDesc").textContent = "같은 질문, 다른 답. 오늘 대화거리가 생겼어요.";
      actions.innerHTML = re
        ? `<p class="t-body-03 t-secondary">둘 다 서로의 답을 확인했어요.</p>
           <button class="btn btn--primary btn--block" data-go="room">우리 방으로 가기</button>`
        : `<button class="btn btn--primary btn--block" id="ansReply">${esc(sender)}님에게 답장 보내기</button>
           <p class="t-caption-01 t-tertiary">답장 링크를 보내야 ${esc(sender)}님도 내 답을 볼 수 있어요</p>
           <button class="btn btn--ghost btn--block" data-go="room">우리 방으로 가기</button>`;
      $("#ansReply")?.addEventListener("click", async () => {
        await sendAnswer(r, e, 1);
        e.replied = true;
        saveRooms();
      });
    } else {
      actions.innerHTML = created ? `<p class="t-caption-01 t-tertiary">${esc(r.n[0])} & ${esc(r.n[1])} 방이 이 기기에도 만들어졌어요</p>` : "";
    }
    bindGo(actions);
  };

  if (ownLink) {
    $("#ansTitle").textContent = "내가 보낸 답이에요";
    $("#ansDesc").textContent = `${yourName(r)}님이 이 링크를 열고 답하면 둘의 답이 열려요.`;
  } else if (e.a[r.me]) {
    $("#ansTitle").textContent = re ? `${sender}님의 답장이 왔어요` : `${sender}님의 답이 도착했어요`;
    $("#ansDesc").textContent = "둘 다 답했으니 이제 같이 열어봐요.";
  } else {
    $("#ansTitle").textContent = `${sender}님의 답이 도착했어요`;
    $("#ansDesc").textContent = "같은 질문에 내 답을 먼저 적어야 봉투가 열려요.";
  }
  const paint = () =>
    renderQCard(el, r, e, {
      onSubmit: () => {
        $("#ansTitle").textContent = "둘 다 답했어요";
        $("#ansDesc").textContent = "봉투를 열어볼까요?";
        paint();
        renderRoom({ animate: false });
      },
      onReveal: () => paintActions(),
    });
  paint();
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
  $("#joinFrom").textContent = `from. ${p.n[f]}`;
  $("#joinTitle").textContent = `${p.n[f]}님이 우리 방에 초대했어요`;
  $("#joinDesc").textContent = "들어가면 같은 날짜, 같은 질문을 같이 써요.";
  $("#joinCard").innerHTML = polaroidHTML(p.n, p.s);
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
    toast("우리 방에 들어왔어요");
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
function polaroidHTML(n, s) {
  const [y, m, d] = s.split("-");
  return `<figure class="pola" style="--r:-3deg">
      <span class="tape" aria-hidden="true"></span>
      <div class="pola__photo"><p class="big-d t-num">D+${fmt.num(dPlus(s))}</p><span class="pola__date">'${y.slice(2)} ${Number(m)} ${Number(d)}</span></div>
      <figcaption class="pola__cap">${esc(n[0])} & ${esc(n[1])}<span class="t-caption-01 t-tertiary">${longDate(s)}부터</span></figcaption>
    </figure>`;
}
function updatePreview() {
  const v = $("#startDate").value;
  const pv = $("#setupPreview");
  const fieldEl = $("#startField");
  fieldEl.classList.remove("is-error");
  $("#startHelp").textContent = "사귄 날을 1일로 세요 (D+1)";
  if (!isDateKey(v)) {
    pv.innerHTML = "";
    return;
  }
  if (v > todayKey()) {
    fieldEl.classList.add("is-error");
    $("#startHelp").textContent = "오늘 이후 날짜는 고를 수 없어요";
    pv.innerHTML = "";
    return;
  }
  const { next } = nextAnniversary(v);
  const n = [$("#nameMe").value.trim() || "나", $("#nameYou").value.trim() || "너"];
  const had = !!pv.innerHTML;
  pv.innerHTML = polaroidHTML(n, v);
  if (!had) $(".pola", pv).classList.add("drop");
  $("#startHelp").textContent = `오늘은 D+${fmt.num(dPlus(v))} · 다음 기념일 ${next.label} (${dLabel(next.date)})`;
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
["#nameMe", "#nameYou"].forEach((s) =>
  $(s).addEventListener("input", (e) => {
    e.target.classList.remove("is-error");
    if ($("#setupPreview").innerHTML) updatePreview();
  }),
);

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
// "#rrggbb" 토큰에 투명도만 입혀요 (캔버스용)
function alpha(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
// 우표 테두리(톱니) 그리기
function stampPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  for (let i = 0; i <= w; i += r * 2.6) {
    ctx.moveTo(x + i + r, y);
    ctx.arc(x + i, y, r, 0, Math.PI * 2);
    ctx.moveTo(x + i + r, y + h);
    ctx.arc(x + i, y + h, r, 0, Math.PI * 2);
  }
  for (let j = 0; j <= h; j += r * 2.6) {
    ctx.moveTo(x + r, y + j);
    ctx.arc(x, y + j, r, 0, Math.PI * 2);
    ctx.moveTo(x + w + r, y + j);
    ctx.arc(x + w, y + j, r, 0, Math.PI * 2);
  }
}
function drawCard(r) {
  const W = 540;
  const H = 675;
  const { canvas, ctx } = createCanvas(W, H, 2);
  const paper = token("--art-paper");
  const letter = token("--art-letter");
  const ink = token("--art-ink");
  const inkSoft = token("--art-ink-soft");
  const brand = token("--brand");
  const film = token("--art-film");
  const hi = token("--art-photo-hi");
  const mid = token("--art-photo-mid");
  const lo = token("--art-photo-lo");
  const display = token("--font-display") || CANVAS_FONT;
  const hand = token("--art-hand") || CANVAS_FONT;
  const today = todayKey();
  const d = dPlus(r.s, today);
  const { next } = nextAnniversary(r.s, today);
  const gap = diffDays(today, next.date);
  const gapText = gap === 0 ? "D-day" : `D-${fmt.num(gap)}`;

  // 종이 + 그레인
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, W, H);
  const rand = seededRandom(`grain:${r.id}`);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = alpha(ink, 0.03 + rand() * 0.05);
    ctx.fillRect(rand() * W, rand() * H, 1, 1);
  }

  // 폴라로이드
  ctx.save();
  ctx.translate(250, 270);
  ctx.rotate((-3 * Math.PI) / 180);
  ctx.shadowColor = alpha(ink, 0.28);
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = letter;
  ctx.fillRect(-195, -215, 390, 450);
  ctx.shadowColor = "transparent";
  const px = -177;
  const py = -197;
  const pw = 354;
  const ph = 330;
  const g = ctx.createLinearGradient(px, py, px + pw * 0.6, py + ph);
  g.addColorStop(0, mid);
  g.addColorStop(1, lo);
  ctx.fillStyle = g;
  ctx.fillRect(px, py, pw, ph);
  const leak = ctx.createRadialGradient(px + pw * 0.85, py + ph * 0.1, 10, px + pw * 0.85, py + ph * 0.1, pw * 0.8);
  leak.addColorStop(0, alpha(hi, 0.95));
  leak.addColorStop(1, alpha(hi, 0));
  ctx.fillStyle = leak;
  ctx.fillRect(px, py, pw, ph);
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = alpha(rand() > 0.5 ? letter : ink, 0.08);
    ctx.fillRect(px + rand() * pw, py + rand() * ph, 1.2, 1.2);
  }
  ctx.fillStyle = letter;
  ctx.textAlign = "left";
  ctx.font = `400 34px ${hand}`;
  ctx.fillText("우리", px + 24, py + 104);
  let size = 104;
  const big = `D+${fmt.num(d)}`;
  ctx.font = `700 ${size}px ${display}`;
  while (ctx.measureText(big).width > pw - 48 && size > 56) {
    size -= 4;
    ctx.font = `700 ${size}px ${display}`;
  }
  ctx.fillText(big, px + 22, py + 104 + size * 0.95);
  const [y, m, dd] = r.s.split("-");
  ctx.fillStyle = film;
  ctx.font = `700 18px "Courier New", monospace`;
  ctx.textAlign = "right";
  ctx.fillText(`'${y.slice(2)} ${Number(m)} ${Number(dd)}`, px + pw - 16, py + ph - 16);
  ctx.textAlign = "left";
  ctx.fillStyle = ink;
  ctx.font = `400 40px ${hand}`;
  ctx.fillText(`${r.n[0]} ♥ ${r.n[1]}`, px + 6, py + ph + 52);
  ctx.fillStyle = inkSoft;
  ctx.font = `500 14px ${CANVAS_FONT}`;
  ctx.fillText(`${dotDate(r.s)}부터 · 사귄 날 = 1일`, px + 8, py + ph + 80);
  ctx.restore();

  // 다음 기념일 우표
  ctx.save();
  ctx.translate(430, 548);
  ctx.rotate((6 * Math.PI) / 180);
  ctx.fillStyle = brand;
  stampPath(ctx, -62, -74, 124, 148, 4);
  ctx.fill("evenodd");
  ctx.strokeStyle = alpha(letter, 0.6);
  ctx.lineWidth = 1;
  ctx.strokeRect(-52, -64, 104, 128);
  ctx.fillStyle = letter;
  ctx.textAlign = "center";
  ctx.font = `600 13px ${CANVAS_FONT}`;
  ctx.fillText("다음 기념일", 0, -32);
  ctx.font = `700 30px ${display}`;
  ctx.fillText(next.label, 0, 6);
  ctx.font = `700 18px ${display}`;
  ctx.fillText(gapText, 0, 40);
  ctx.restore();

  // 소인
  ctx.save();
  ctx.translate(360, 500);
  ctx.rotate((-14 * Math.PI) / 180);
  ctx.strokeStyle = alpha(brand, 0.75);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 46, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, 40, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = alpha(brand, 0.8);
  ctx.textAlign = "center";
  ctx.font = `700 12px ${display}`;
  const [ny, nm, nd] = next.date.split("-");
  ctx.fillText(ny, 0, -10);
  ctx.font = `700 17px ${display}`;
  ctx.fillText(`${Number(nm)}.${Number(nd)}`, 0, 10);
  ctx.font = `600 11px ${CANVAS_FONT}`;
  ctx.fillText(`${weekday(next.date)}요일`, 0, 26);
  ctx.restore();

  // 손글씨 메모
  ctx.fillStyle = ink;
  ctx.textAlign = "left";
  ctx.font = `400 30px ${hand}`;
  ctx.fillText(`다음: ${next.label} (${gapText})`, 44, 590);
  ctx.fillStyle = inkSoft;
  ctx.font = `600 13px ${CANVAS_FONT}`;
  ctx.fillText("커플 D-day 룸 · 둘 다 답해야 열리는 오늘의 질문", 44, 636);
  return canvas;
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
const later = (signal, ms, fn) => {
  const id = setTimeout(() => !signal.aborted && fn(), prefersReducedMotion() ? 0 : ms);
  signal.addEventListener("abort", () => clearTimeout(id));
};
// 장면 캡션: 제목+부제 대신 장면 위에 손글씨로 한 글자씩 써 내려간다
function scrawl(sc, text, cls = "", delay = 0) {
  const p = document.createElement("p");
  p.className = `scrawl ${cls}`;
  let k = 0;
  p.innerHTML = text
    .split("\n")
    .map((line) => [...line].map((ch) => (ch === " " ? " " : `<i style="--k:${k++}">${esc(ch)}</i>`)).join(""))
    .join("<br />");
  p.style.setProperty("--d", `${delay}ms`);
  sc.appendChild(p);
  return p;
}
const relRect = (el, stage) => {
  const a = el.getBoundingClientRect();
  const b = stage.getBoundingClientRect();
  return { x: a.left - b.left + a.width / 2, y: a.top - b.top + a.height / 2 };
};

function sceneMeet(stage, signal) {
  stage.innerHTML = `<div class="sc sc-meet">
    <figure class="pola pola--a drop"><span class="pola__pin"></span><div class="pola__photo"><span class="pola__date">'25 5 12</span></div><figcaption>민수</figcaption></figure>
    <figure class="pola pola--b drop" style="--delay:200ms"><span class="pola__pin"></span><div class="pola__photo"><span class="pola__date">'25 5 12</span></div><figcaption>지은</figcaption></figure>
    <svg class="sc-meet__string" aria-hidden="true"><path /></svg>
    <div class="peek-letter rise-in" style="--delay:500ms"><small>2025.5.12 · 첫 편지</small><p>오늘부터 1일,<br />우리 잘 지내보자</p></div>
    <div class="cal-strip rise-in" style="--delay:750ms"><span>10</span><span>11</span><span class="is-on">12<i>1일</i></span><span>13</span><span>14</span></div>
  </div>`;
  const sc = $(".sc-meet", stage);
  scrawl(sc, "이어진 그날이\n1일이야", "scrawl--meet", 1500);
  const path = $("path", sc);
  later(signal, 1100, () => {
    const a = relRect($(".pola--a .pola__pin", sc), sc);
    const b = relRect($(".pola--b .pola__pin", sc), sc);
    const curve = (sag) => {
      const cx = (a.x + b.x) / 2;
      const cy = Math.max(a.y, b.y) + sag;
      return { d: `M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`, mx: (a.x + 2 * cx + b.x) / 4, my: (a.y + 2 * cy + b.y) / 4 };
    };
    path.setAttribute("d", curve(70).d);
    const len = path.getTotalLength();
    path.style.strokeDasharray = `${len}`;
    path.style.strokeDashoffset = `${len}`;
    path.getBoundingClientRect();
    path.style.transition = "stroke-dashoffset 520ms cubic-bezier(.2,.8,.2,1)";
    path.style.strokeDashoffset = "0";
    // 실이 팽팽해지며 출렁: 감쇠 진동 스프링
    later(signal, 560, () => {
      path.style.strokeDasharray = "none";
      const tag = document.createElement("div");
      tag.className = "hang-tag t-num";
      tag.textContent = "D+1";
      sc.appendChild(tag);
      const t0 = performance.now();
      const step = (now) => {
        if (signal.aborted) return;
        const t = (now - t0) / 1000;
        const sag = 40 + 30 * Math.exp(-4.2 * t) * Math.cos(16 * t);
        const c = curve(sag);
        path.setAttribute("d", c.d);
        tag.style.left = `${c.mx}px`;
        tag.style.top = `${c.my}px`;
        if (t < 1.6) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  });
}

function sceneCount(stage, signal) {
  stage.innerHTML = `<div class="sc sc-count">
    <figure class="pola drop"><div class="pola__photo"><p class="big-d t-num"><span class="odo"></span></p><span class="pola__date">'25 8 19</span></div>
      <figcaption><span class="ink-in" style="--delay:1100ms">함께한 2,376시간</span><small>민수 & 지은 · 사귄 날 = 1일</small></figcaption></figure>
    <div class="postmark slam" style="--delay:1500ms"><span>2025<b>5.12</b>사귄 날</span></div>
    <div class="ticket rise-in" style="--delay:700ms"><small>ADMIT TWO · 함께한</small><b class="t-num">14주 · 2,376시간</b></div>
    <div class="stamp stamp--tilt rise-in" style="--delay:950ms"><small>다음 기념일</small><b>200일</b><small>D-100</small></div>
  </div>`;
  scrawl($(".sc-count .pola__photo", stage), "오늘 우리, D+며칠?", "scrawl--photo", 600);
  const odo = $(".odo", stage);
  odometer(odo, "D+100", { on: false });
  later(signal, 420, () => odo.classList.add("is-on"));
  later(signal, 1640, () => $(".pola", stage).classList.add("shake"));
}

function sceneQuestion(stage, signal) {
  stage.innerHTML = `<div class="sc sc-env">
    <p class="sc-env__q"><small>오늘의 질문</small>우리 여행 1순위 장소는 어디예요?</p>
    <div class="env">
      <div class="env__back"></div>
      <div class="env__letter env__letter--a"><small>나</small><p>제주도 바다</p></div>
      <div class="env__letter env__letter--b"><small>너</small><p>무조건 제주!</p></div>
      <div class="env__front"></div>
      <div class="env__flap"></div>
      <div class="env__seal">봉인</div>
      <div class="env__checks"><span>나 답함</span><span>너 답함</span></div>
    </div>
    <div class="link-slip rise-in" style="--delay:250ms"><code>…/couple-dday/?a=Xk9…</code><span>지은에게 링크로 보냄 →</span></div>
  </div>`;
  scrawl($(".sc-env", stage), "둘 다 답해야\n열려 ↓", "scrawl--env", 300);
  const env = $(".env", stage);
  const [c1, c2] = $$(".env__checks span", stage);
  later(signal, 650, () => c1.classList.add("is-on"));
  later(signal, 1000, () => c2.classList.add("is-on"));
  later(signal, 1450, () => env.classList.add("is-broken"));
  later(signal, 1650, () => env.classList.add("is-open"));
  later(signal, 2050, () => env.classList.add("is-out"));
}

function sceneCalendar(stage, signal) {
  const cells = WD.map((w) => `<span class="is-wd">${w}</span>`);
  for (let i = 0; i < 5; i++) cells.push("<span></span>"); // 2025년 8월 1일은 금요일
  for (let d = 1; d <= 31; d++) {
    cells.push(
      d === 19
        ? `<span class="is-target">${d}<svg class="cal__circle" viewBox="0 0 60 40" preserveAspectRatio="none" aria-hidden="true"><path d="M44 6 C30 0 6 4 5 18 C4 32 30 38 46 32 C58 27 58 10 40 5" /></svg></span>`
        : `<span>${d}</span>`,
    );
  }
  stage.innerHTML = `<div class="sc sc-cal">
    <div class="cal"><div class="cal__head"><b>8월</b><span>2025 · 우리 달력</span></div><div class="cal__grid">${cells.join("")}</div></div>
    <span class="cal__note"></span>
    <div class="link-slip link-slip--ics rise-in" style="--delay:300ms"><code>100일.ics · 저장됨</code><span>하루 전 아침 9시 알림</span></div>
    <div class="stamp"><small>기념일</small><b>100일</b><small>D-day</small></div>
  </div>`;
  const sc = $(".sc-cal", stage);
  later(signal, 520, () => {
    const cal = $(".cal", sc);
    const note = $(".cal__note", sc);
    scrawl(note, "100일은 8.19 (화)\n미리 동그라미!", "scrawl--cal");
    note.style.left = `${cal.offsetLeft + 12}px`;
    note.style.top = `${cal.offsetTop + cal.offsetHeight + 28}px`;
    $(".cal__circle", sc).classList.add("is-on");
  });
  later(signal, 900, () => $(".cal__note", sc).classList.add("is-on"));
  later(signal, 250, () => $(".stamp", sc).classList.add("is-on"));
}

// say 는 화면 읽기 프로그램용 (화면에는 장면 속 손글씨로만 보인다)
const SCENES = [
  { say: "사귄 날을 1일로 세요", duration: 4200, run: sceneMeet },
  { say: "오늘이 D+며칠인지 날짜·주·시간까지 세어줘요", duration: 3600, run: sceneCount },
  { say: "같은 질문에 둘 다 답해야 봉투가 열려요", duration: 4400, run: sceneQuestion },
  { say: "다가오는 100일을 캘린더에 미리 넣어둬요", duration: 3800, run: sceneCalendar },
].map((s) => ({
  duration: s.duration,
  play(stage, signal) {
    const say = $("#introSay");
    if (say) say.textContent = s.say;
    s.run(stage, signal);
  },
}));

/* ---------- 시작 ---------- */
// 봉투 버튼: 누르면 소인이 쾅 찍히고 봉투가 눌렸다 튄 뒤 방 만들기로
$("#start").onclick = () => {
  const b = $("#start");
  if (b.classList.contains("is-sent")) return;
  haptic(18);
  b.classList.add("is-sent");
  setTimeout(() => {
    b.classList.remove("is-sent");
    openSetup();
  }, prefersReducedMotion() ? 0 : 380);
};
$("#introRoom").onclick = openRoom;
bindGo();
renderCrumb($("#crumb"));
renderMoreSites($("#more"));

// SEO 계산표: 예시 커플(2025.5.12)의 오늘 D+ 를 실제 날짜로
{
  const t = todayKey();
  const el = $("#lpToday");
  if (el && t >= "2025-05-12") el.innerHTML = `${dotDate(t).replace(/\.0/g, ".")} 기준으로 이 커플은 <b>D+${fmt.num(dPlus("2025-05-12", t))}</b>예요.`;
}

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
