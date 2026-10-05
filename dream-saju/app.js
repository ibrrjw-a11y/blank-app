import {
  $,
  $$,
  createStore,
  toast,
  haptic,
  share,
  shareImage,
  urlWith,
  todayKey,
  showView,
  renderMoreSites,
  createCanvas,
  roundRect,
  wrapText,
  CANVAS_FONT,
  prefersReducedMotion,
} from "../shared/kit.js";
import { prepare, interpret, matchText, cleanSel, isComplete, KEYS, opt, pillar } from "./engine.js";
import { startIntro } from "./intro.js";
import { dressTalismans } from "./more.js";

const store = createStore("dream-saju");
const SEALS = { daegil: "大吉", gil: "吉", pyeong: "平", juui: "愼", gyeong: "安" };
const GOOD = ["daegil", "gil"];
const HELP = {
  p1: "가장 또렷한 하나만 골라요",
  p2: "기억 안 나도 괜찮아요",
  p3: "특별한 일 없으면 ‘보기만 함’",
  p4: "꿈에서 느낀 그대로",
};

const state = {
  data: null,
  sel: { p1: null, p2: null, p3: null, p4: null },
  active: "p1",
  result: null,
  ctx: null,
  intro: null,
  view: "intro",
};

/* ---------- 저장소 ---------- */
const getEntries = () => store.get("entries", []);
const setEntries = (v) => store.set("entries", v);
const getChecks = () => store.get("checkins", []);

function daySet() {
  return new Set([...getEntries().map((e) => e.d), ...getChecks()]);
}

function streak() {
  const set = daySet();
  let t = Date.now();
  if (!set.has(todayKey(new Date(t)))) {
    t -= 864e5;
    if (!set.has(todayKey(new Date(t)))) return 0;
  }
  let n = 0;
  while (set.has(todayKey(new Date(t)))) {
    n++;
    t -= 864e5;
  }
  return n;
}

function fmtDate(key, short = false) {
  const [y, m, d] = String(key).split("-").map(Number);
  if (!y) return "";
  return short ? `${m}.${d}` : `${y}년 ${m}월 ${d}일`;
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/* ---------- 화면 전환 ---------- */
function go(view, { push = true } = {}) {
  if (view !== "intro" && state.intro) {
    state.intro.stop();
    state.intro = null;
  }
  if (view === "intro" && !state.intro) state.intro = startIntro($("#intro"));
  state.view = view;
  showView(view);
  if (push) history.pushState({ view }, "", location.pathname + location.search);
  updateBadge();
}

window.addEventListener("popstate", (e) => {
  const view = e.state?.view || (getParamsSel() ? "app" : "intro");
  if (view === "result" && !state.result) return go("app", { push: false });
  if (view === "diary") renderDiary();
  if (view === "app") renderPicker();
  go(view, { push: false });
});

function updateBadge() {
  const n = streak();
  const b = $("#streakBadge");
  b.hidden = !n;
  b.textContent = `${n}일`;
  $("#introDiary").hidden = !getEntries().length;
}

/* ---------- 4기둥 입력 ---------- */
function renderPillars() {
  const { data, sel, active } = state;
  $("#pillars").innerHTML = KEYS.map((k) => {
    const p = pillar(data, k);
    const o = opt(data, k, sel[k]);
    return `<button class="wg-col${k === active ? " is-active" : ""}" type="button" role="tab" aria-selected="${k === active}" data-key="${k}">
      <span class="wg-col__head">${p.name}</span>
      ${o ? `<span class="inkdot"><span>${o.emoji}</span></span>` : `<span class="inkdot inkdot--empty">＋</span>`}
      <span class="wg-col__name">${o ? esc(o.label) : "고르기"}</span>
    </button>`;
  }).join("");
}

function renderTiles() {
  const { data, sel, active } = state;
  const p = pillar(data, active);
  $("#askTitle").textContent = p.q;
  $("#askSub").textContent = HELP[active];
  const el = $("#tiles");
  el.className = `tiles tiles--${active}`;
  el.innerHTML = p.options
    .map(
      (o) => `<button class="tile" type="button" data-id="${o.id}" aria-pressed="${sel[active] === o.id}">
        <span class="inkdot inkdot--sm"><span>${o.emoji}</span></span>${esc(o.label)}</button>`
    )
    .join("");
}

function renderDock() {
  const left = KEYS.filter((k) => !state.sel[k]).length;
  const b = $("#goResult");
  b.disabled = left > 0;
  b.textContent = left ? `${left}칸 남았어요` : "해몽 보기";
}

function renderCheckin() {
  const today = todayKey();
  const set = daySet();
  const n = streak();
  const el = $("#checkin");
  const hour = new Date().getHours();
  const hello = hour < 11 ? "좋은 아침이에요" : hour < 18 ? "오늘 꾼 꿈, 기억나요?" : "오늘 밤엔 어떤 꿈을 꿀까요";
  if (set.has(today)) {
    el.innerHTML = `<span class="inkdot inkdot--sm"><span>🌕</span></span>
      <div class="checkin__text"><b>오늘 아침 기록 완료</b><span>${n}일째 이어서 기록하고 있어요</span></div>`;
  } else {
    el.innerHTML = `<span class="inkdot inkdot--sm"><span>${n ? "🔥" : "🌙"}</span></span>
      <div class="checkin__text"><b>${hello}</b><span>${n ? `오늘 기록하면 ${n + 1}일째 연속` : "기록하면 연속 기록이 시작돼요"}</span></div>
      <button class="btn btn--ghost btn--sm" type="button" data-act="nodream">기억 안 나요</button>`;
  }
}

function renderPicker() {
  renderCheckin();
  renderPillars();
  renderTiles();
  renderDock();
}

function setActive(k) {
  state.active = k;
  renderPillars();
  renderTiles();
}

function nextEmpty(from) {
  const i = KEYS.indexOf(from);
  for (let j = 1; j <= 4; j++) {
    const k = KEYS[(i + j) % 4];
    if (!state.sel[k]) return k;
  }
  return null;
}

function pick(id) {
  const k = state.active;
  state.sel[k] = id;
  haptic(10);
  renderTiles();
  renderPillars();
  const col = $(`.wg-col[data-key="${k}"]`);
  col?.classList.add("is-pop");
  renderDock();
  const next = nextEmpty(k);
  setTimeout(() => {
    if (next) {
      setActive(next);
      const top = $("#pillars").getBoundingClientRect().top + scrollY - 64;
      if (scrollY > top) scrollTo({ top, behavior: "smooth" });
    } else {
      $("#goResult").scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, 280);
}

/* ---------- 말/글로 입력 ---------- */
let sayTimer;
function applyText(text, { final = false } = {}) {
  const { data } = state;
  const m = matchText(data, text);
  const hitsEl = $("#sayHits");
  if (!text.trim()) {
    hitsEl.innerHTML = "";
    return;
  }
  if (!m.hits.length) {
    hitsEl.innerHTML = final || text.length > 3 ? `<span class="say__none">알아들은 낱말이 없어요. 아이콘으로 골라 주세요</span>` : "";
    return;
  }
  KEYS.forEach((k) => m.sel[k] && (state.sel[k] = m.sel[k]));
  hitsEl.innerHTML = m.hits
    .map((h) => {
      const o = opt(data, h.key, h.id);
      return `<span class="hit">‘${esc(h.word)}’ → ${o.emoji} <b>${esc(o.label)}</b></span>`;
    })
    .join("");
  state.active = nextEmpty("p4") || state.active;
  renderPillars();
  renderTiles();
  renderDock();
}

function setupSpeech() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btn = $("#micBtn");
  if (!SR) return;
  btn.hidden = false;
  let rec = null;
  btn.addEventListener("click", () => {
    if (rec) {
      rec.stop();
      return;
    }
    try {
      rec = new SR();
    } catch {
      toast("음성 인식을 쓸 수 없어요. 글로 적어 주세요");
      return;
    }
    rec.lang = "ko-KR";
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const text = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(" ");
      $("#sayInput").value = text;
      applyText(text, { final: e.results[e.results.length - 1].isFinal });
    };
    rec.onerror = (e) => {
      if (e.error !== "aborted" && e.error !== "no-speech") toast("잘 못 들었어요. 글로 적어도 돼요");
    };
    rec.onend = () => {
      btn.classList.remove("is-listening");
      btn.setAttribute("aria-label", "목소리로 꿈 말하기");
      rec = null;
    };
    btn.classList.add("is-listening");
    btn.setAttribute("aria-label", "듣는 중, 누르면 멈춰요");
    toast("듣고 있어요. 꿈 이야기를 해 주세요");
    rec.start();
  });
}

/* ---------- 결과 ---------- */
function showResult(sel, ctx) {
  state.result = interpret(state.data, sel, { date: ctx.date });
  state.ctx = ctx;
  renderResult();
  go("result");
}

function renderResult() {
  const r = state.result;
  const ctx = state.ctx;
  const { data } = state;
  const cols = KEYS.map((k) => ({ name: pillar(data, k).name, o: r.o[k] }));
  const arrowHtml = r.headline.replace(/([▲▼–])$/, "<em>$1</em>");
  const saved = ctx.mode === "saved";
  const already = ctx.mode === "new" && ctx.savedId;
  const tags = r.rules.map((x) => `<span class="badge">${esc(x.title)}</span>`).join("");

  $("#result").innerHTML = `
    ${
      ctx.mode === "shared"
        ? `<div class="res-banner"><div><p class="t-body-03-strong">친구가 보낸 꿈 해몽이에요</p>
            <p class="t-caption-01 t-secondary">같은 4칸이면 누구나 같은 풀이가 나와요</p></div>
            <button class="btn btn--primary btn--sm" type="button" data-act="mine">나도 해몽하기</button></div>`
        : ""
    }
    <p class="res-date">${fmtDate(ctx.date)} · ${saved ? "기록해 둔 꿈" : ctx.mode === "shared" ? "친구의 꿈" : "오늘의 꿈"}</p>
    <div class="wonguk wonguk--result" aria-label="꿈 4칸">
      ${cols
        .map(
          (c) => `<div class="wg-col"><span class="wg-col__head">${c.name}</span>
          <span class="inkdot"><span>${c.o.emoji}</span></span><span class="wg-col__name">${esc(c.o.label)}</span></div>`
        )
        .join("")}
    </div>

    <div class="bujeok grade--${r.grade.id}">
      <h2 class="bujeok__v">${r.grade.name}</h2>
      <div class="bujeok__body">
        <p class="bujeok__kicker">꿈 등급</p>
        <p class="bujeok__title">${esc(r.title)}</p>
        <p class="bujeok__head">${arrowHtml}</p>
        <p class="bujeok__sub">${esc(r.grade.sub)}</p>
      </div>
      <span class="seal${SEALS[r.grade.id].length > 1 ? " seal--2" : ""}" aria-hidden="true">${[...SEALS[r.grade.id]].map((c) => `<span>${c}</span>`).join("")}</span>
    </div>

    <section class="blk"><h3 class="vlabel">지수</h3><div>
      ${r.domains
        .map(
          (d, i) => `<div class="meter${d.value < 45 ? " is-low" : ""}" style="--i:${i}">
            <span class="meter__label">${d.emoji} ${d.label}</span>
            <span class="meter__track"><span class="meter__fill" style="--v:${d.value}%"></span><span class="meter__mid"></span></span>
            <span class="meter__val t-num">${d.value}</span></div>`
        )
        .join("")}
      <p class="blk__note">가운데 선이 보통(50)이에요. 재미로 보는 지수예요.</p>
    </div></section>

    <section class="blk"><h3 class="vlabel">풀이</h3><div class="story">
      ${tags ? `<div class="story__tags">${tags}</div>` : ""}
      ${r.story.map((s) => `<p>${esc(s)}</p>`).join("")}
    </div></section>

    <section class="blk"><h3 class="vlabel">오늘</h3><div>
      <p class="today">${esc(r.action)}</p>
    </div></section>

    <section class="blk"><h3 class="vlabel">번호</h3><div>
      <div class="balls">${r.numbers.map((n, i) => `<span class="ball" style="--i:${i}">${n}</span>`).join("")}</div>
      <p class="blk__note">꿈 4칸과 날짜로 재미로 뽑은 번호예요. 같은 꿈·같은 날이면 같은 번호가 나와요. 어떤 번호든 당첨 확률은 같아요.</p>
    </div></section>

    <section class="blk"><h3 class="vlabel">태몽</h3><div>
      <button class="switch" type="button" aria-pressed="false" data-act="tm"><span>태몽으로도 보기</span><span class="switch__knob"></span></button>
      <div class="tm" id="tmBox" hidden>
        <span class="badge">속설</span>${r.taemong.who ? ` <span class="badge">${esc(r.taemong.who)} 속설</span>` : ""}
        ${r.taemong.lines.map((s) => `<p>${esc(s)}</p>`).join("")}
        <p class="t-caption-01">태몽 속설은 아이의 성별이나 앞날을 맞히는 근거가 없어요. 재미로만 봐 주세요.</p>
      </div>
    </div></section>

    ${
      r.good
        ? `<p class="tip"><span aria-hidden="true">🤫</span><span>좋은 꿈은 남에게 말하면 복이 달아난다는 속설이 있어요. 친구에겐 등급만 살짝 자랑해 볼까요?</span></p>`
        : ""
    }

    <div class="res-actions">
      ${
        ctx.mode === "new"
          ? `<button class="btn btn--primary btn--lg btn--block" type="button" data-act="save" ${already ? "disabled" : ""}>${already ? "꿈 일기에 기록했어요" : "꿈 일기에 기록하기"}</button>`
          : ctx.mode === "shared"
            ? `<button class="btn btn--primary btn--lg btn--block" type="button" data-act="mine">나도 해몽하기</button>`
            : ""
      }
      <div class="row gap-8">
        <button class="btn btn--secondary grow" type="button" data-act="img">이미지로 저장</button>
        <button class="btn btn--secondary grow" type="button" data-act="link">친구에게 보내기</button>
      </div>
      <button class="btn btn--ghost btn--block" type="button" data-act="again">다른 꿈 풀기</button>
      ${saved ? `<button class="btn btn--ghost btn--sm" type="button" data-act="del">이 기록 지우기</button>` : ""}
    </div>
    <p class="t-caption-01 t-tertiary disclaimer">재미로 보는 해몽이에요. 전통 해몽 속설을 바탕으로 풀었고, 실제 일을 예언하지 않아요.</p>`;
}

function saveEntry() {
  const r = state.result;
  const entries = getEntries();
  const id = Date.now().toString(36);
  entries.push({ id, d: state.ctx.date, t: Date.now(), p: KEYS.map((k) => r.sel[k]), g: r.grade.id });
  setEntries(entries.slice(-400));
  state.ctx.savedId = id;
  haptic([10, 40, 16]);
  const n = streak();
  const seen = seenCounts();
  const dexN = Object.keys(seen).length;
  toast(`기록했어요 · 연속 ${n}일 · 도감 ${dexN}/${dexTotal()}`);
  const btn = $('#result [data-act="save"]');
  if (btn) {
    btn.disabled = true;
    btn.textContent = "꿈 일기에 기록했어요";
  }
  updateBadge();
}

/* ---------- 공유 ---------- */
function shareUrl() {
  const r = state.result;
  return urlWith({ ...r.sel, d: state.ctx.date, r: 1 }, location.origin + location.pathname);
}

async function shareLink() {
  const r = state.result;
  await share({
    title: "꿈 사주",
    text: `내 꿈은 ${r.grade.name}! ${r.headline} (${r.title}) 너도 4칸으로 꿈 풀어 봐`,
    url: shareUrl(),
  });
}

function drawCard() {
  const r = state.result;
  const W = 540;
  const H = 675;
  const { canvas, ctx } = createCanvas(W, H, 2);
  const css = getComputedStyle(document.documentElement);
  const v = (n, f) => css.getPropertyValue(n).trim() || f;
  const ink = v("--color-bg", "#0a0c10");
  const text = v("--color-text", "#f3f5f8");
  const sub = v("--color-text-secondary", "#a3aab6");
  const gold = v("--brand", "#e6c068");
  const paper = v("--art-paper", "#ebe0c8");
  const paperInk = v("--art-ink", "#17140f");
  const wash = v("--art-ink-wash", "#4a4337");
  const seal = v("--art-seal", "#c23b2c");
  const inkSoft = v("--art-ink-soft", "#2a261f");
  const display = `"Song Myung", "Gowun Batang", "Nanum Myeongjo", serif`;

  ctx.fillStyle = ink;
  ctx.fillRect(0, 0, W, H);
  // 별 (날짜·꿈으로 고정된 위치)
  let s = r.numbers.reduce((a, b) => a * 31 + b, 7) % 2147483647 || 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 46; i++) {
    ctx.globalAlpha = 0.25 + rnd() * 0.5;
    ctx.fillStyle = rnd() < 0.15 ? gold : text;
    ctx.beginPath();
    ctx.arc(rnd() * W, rnd() * 300, 0.5 + rnd() * 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // 초승달
  ctx.fillStyle = gold;
  ctx.beginPath();
  ctx.arc(W - 64, 62, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.arc(W - 53, 55, 20, 0, Math.PI * 2);
  ctx.fill();

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = gold;
  ctx.font = `28px ${display}`;
  ctx.fillText("꿈 사주", 36, 62);
  ctx.fillStyle = sub;
  ctx.font = `500 14px ${CANVAS_FONT}`;
  ctx.fillText(`${fmtDate(state.ctx.date)}의 꿈 원국`, 36, 88);

  // 원국 4기둥 표
  const tx = 36;
  const ty = 112;
  const tw = W - 72;
  const th = 196;
  const cw = tw / 4;
  ctx.strokeStyle = gold;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 1;
  ctx.strokeRect(tx, ty, tw, th);
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(tx + cw * i, ty);
    ctx.lineTo(tx + cw * i, ty + th);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(tx, ty + 40);
  ctx.lineTo(tx + tw, ty + 40);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.textAlign = "center";
  KEYS.forEach((k, i) => {
    const cx = tx + cw * i + cw / 2;
    const o = r.o[k];
    ctx.fillStyle = sub;
    ctx.font = `18px ${display}`;
    ctx.fillText(pillar(state.data, k).name, cx, ty + 27);
    ctx.fillStyle = inkSoft;
    ctx.beginPath();
    ctx.arc(cx, ty + 98, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = gold;
    ctx.globalAlpha = 0.6;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.font = `36px ${CANVAS_FONT}`;
    ctx.fillStyle = text;
    ctx.fillText(o.emoji, cx, ty + 111);
    ctx.font = `600 16px ${CANVAS_FONT}`;
    ctx.fillText(o.label, cx, ty + 168);
  });

  // 부적 카드
  const px = 36;
  const py = 334;
  const pw = W - 72;
  const ph = 262;
  ctx.fillStyle = paper;
  roundRect(ctx, px, py, pw, ph, 6);
  ctx.fill();
  ctx.strokeStyle = seal;
  ctx.globalAlpha = 0.5;
  ctx.strokeRect(px + 10, py + 10, pw - 20, ph - 20);
  ctx.globalAlpha = 1;
  // 세로 등급
  ctx.fillStyle = paperInk;
  ctx.font = `64px ${display}`;
  [...r.grade.name].forEach((ch, i) => ctx.fillText(ch, px + 62, py + 82 + i * 70));
  ctx.textAlign = "left";
  const bx = px + 118;
  ctx.fillStyle = wash;
  ctx.font = `600 13px ${CANVAS_FONT}`;
  ctx.fillText("꿈 등급", bx, py + 44);
  ctx.fillStyle = paperInk;
  ctx.font = `22px ${display}`;
  ctx.fillText(r.title, bx, py + 76);
  ctx.font = `800 34px ${CANVAS_FONT}`;
  ctx.fillText(r.headline, bx, py + 122);
  ctx.fillStyle = wash;
  ctx.font = `400 15px ${CANVAS_FONT}`;
  const line = String(r.oneLine).split(/(?<=[요다]\.)\s+/)[0];
  wrapText(ctx, line, bx, py + 156, pw - 118 - 92, 23);
  // 도장
  ctx.save();
  ctx.translate(px + pw - 62, py + ph - 62);
  ctx.rotate(-0.17);
  ctx.strokeStyle = seal;
  ctx.lineWidth = 4;
  roundRect(ctx, -34, -34, 68, 68, 6);
  ctx.stroke();
  ctx.fillStyle = seal;
  ctx.textAlign = "center";
  const sealText = SEALS[r.grade.id];
  if (sealText.length === 2) {
    ctx.font = `26px ${display}`;
    ctx.fillText(sealText[0], 0, -4);
    ctx.fillText(sealText[1], 0, 24);
  } else {
    ctx.font = `40px ${display}`;
    ctx.fillText(sealText, 0, 14);
  }
  ctx.restore();

  ctx.textAlign = "left";
  ctx.fillStyle = text;
  ctx.font = `700 17px ${CANVAS_FONT}`;
  ctx.fillText("4칸으로 끝내는 꿈해몽", 36, H - 44);
  ctx.fillStyle = sub;
  ctx.font = `400 13px ${CANVAS_FONT}`;
  ctx.fillText(`${location.host}${location.pathname} · 재미로 보는 해몽`, 36, H - 22);
  return canvas;
}

async function shareCard() {
  try {
    await document.fonts?.ready;
  } catch {
    /* noop */
  }
  const canvas = drawCard();
  const r = state.result;
  await shareImage(canvas, { filename: `dream-saju-${state.ctx.date}.png`, title: "꿈 사주", text: `내 꿈은 ${r.grade.name}! ${shareUrl()}` });
}

/* ---------- 꿈 일기 · 도감 · 리포트 ---------- */
function dexItems() {
  const { data } = state;
  return [
    ...pillar(data, "p1").options.map((o) => ({ key: "p1", ...o })),
    ...pillar(data, "p3").options.filter((o) => !o.noPage).map((o) => ({ key: "p3", ...o })),
  ];
}
const dexTotal = () => dexItems().length;

function seenCounts() {
  const c = {};
  getEntries().forEach((e) => {
    [`p1:${e.p[0]}`, `p3:${e.p[2]}`].forEach((k) => (c[k] = (c[k] || 0) + 1));
  });
  delete c["p3:seeing"];
  return c;
}

function renderDiary() {
  const { data } = state;
  const entries = getEntries();
  const checks = new Set(getChecks());
  const n = streak();
  const today = todayKey();
  const [y, m] = today.split("-").map(Number);
  const month = today.slice(0, 7);
  const monthEntries = entries.filter((e) => e.d.startsWith(month));

  // 달력
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const offset = (first + 6) % 7;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const byDay = {};
  monthEntries.forEach((e) => (byDay[e.d] = byDay[e.d] || e));
  let cal = ["월", "화", "수", "목", "금", "토", "일"].map((w) => `<span class="mcal__wd">${w}</span>`).join("");
  cal += Array.from({ length: offset }, () => "<span></span>").join("");
  for (let d = 1; d <= days; d++) {
    const key = `${month}-${String(d).padStart(2, "0")}`;
    const e = byDay[key];
    const cls = ["mcal__d", key === today ? "is-today" : "", e ? "has" : checks.has(key) ? "is-check" : ""].join(" ");
    const label = e ? `${d}일 ${opt(data, "p1", e.p[0])?.label} 꿈` : `${d}일`;
    cal += `<span class="${cls}" aria-label="${label}">${e ? opt(data, "p1", e.p[0])?.emoji || "🌙" : checks.has(key) ? "" : d}</span>`;
  }

  // 리포트
  let report;
  if (monthEntries.length >= 3) {
    const cnt = {};
    monthEntries.forEach((e) => {
      cnt[`p1:${e.p[0]}`] = (cnt[`p1:${e.p[0]}`] || 0) + 1;
      if (e.p[2] !== "seeing") cnt[`p3:${e.p[2]}`] = (cnt[`p3:${e.p[2]}`] || 0) + 1;
    });
    const top = Object.entries(cnt)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, c]) => {
        const [key, id] = k.split(":");
        const o = opt(data, key, id);
        return `<span>${o.emoji} ${esc(o.label)} <b class="t-primary">${c}번</b></span>`;
      })
      .join("");
    const feel = pillar(data, "p4").options.map((o) => ({ o, c: monthEntries.filter((e) => e.p[3] === o.id).length }));
    const maxF = Math.max(1, ...feel.map((f) => f.c));
    const good = monthEntries.filter((e) => GOOD.includes(e.g)).length;
    report = `
      <div class="report__row"><h4>자주 나온 상징</h4><div class="report__top">${top}</div></div>
      <div class="report__row"><h4>꿈속 기분</h4>
        ${feel
          .map(
            (f, i) => `<div class="meter" style="--i:${i}"><span class="meter__label">${f.o.emoji} ${f.o.label}</span>
            <span class="meter__track"><span class="meter__fill" style="--v:${Math.round((f.c / maxF) * 100)}%"></span></span>
            <span class="meter__val t-num">${f.c}</span></div>`
          )
          .join("")}</div>
      <div class="report__row"><h4>길몽 비율</h4>
        <p class="report__big">${monthEntries.length}번 중 ${good}번 · ${Math.round((good / monthEntries.length) * 100)}%</p>
        <p class="blk__note">대길몽·길몽으로 풀린 꿈의 비율이에요. 내 기록만으로 계산해요.</p></div>`;
  } else {
    report = `<p class="locked">이번 달 꿈을 3번 기록하면 리포트가 열려요 · 지금 ${monthEntries.length}/3</p>`;
  }

  // 도감
  const seen = seenCounts();
  const items = dexItems();
  const seenN = items.filter((it) => seen[`${it.key}:${it.id}`]).length;
  const cell = (it) => {
    const c = seen[`${it.key}:${it.id}`] || 0;
    return `<span class="dex__c${c ? " is-seen" : ""}" title="${esc(it.label)}"><span class="e">${it.emoji}</span>${c ? esc(it.label) : "?"}${c > 1 ? `<span class="n">${c}</span>` : ""}</span>`;
  };

  const list = entries
    .slice()
    .reverse()
    .slice(0, 30)
    .map((e) => {
      const g = state.data.grades.find((x) => x.id === e.g);
      const icons = KEYS.map((k, i) => opt(data, k, e.p[i])?.emoji || "").join("");
      return `<li><button class="entry" type="button" data-entry="${e.id}"><span class="entry__date">${fmtDate(e.d, true)}</span>
        <span class="entry__icons">${icons}</span><span class="entry__grade">${g ? g.name : ""}</span></button></li>`;
    })
    .join("");

  $("#diary").innerHTML = `
    <div class="diary__head"><h2>꿈 일기</h2>
      <button class="btn btn--secondary btn--sm" type="button" data-act="again">꿈 풀기</button></div>
    <div class="streak"><span class="streak__num t-num">${n}</span><span class="t-body-02">일째 아침 기록 중</span></div>
    <section class="blk"><h3 class="vlabel"><span class="tcy">${m}</span>월</h3><div><div class="mcal">${cal}</div>
      <p class="blk__note">이모지는 꿈을 기록한 날, 점은 ‘꿈 기억 안 나요’로 체크인한 날이에요.</p></div></section>
    <section class="blk"><h3 class="vlabel">리포트</h3><div>${report}</div></section>
    <section class="blk"><h3 class="vlabel">도감</h3><div>
      <div class="dex-head"><span class="t-body-03 t-secondary">기록한 꿈의 상징이 불을 밝혀요</span><b class="t-num">${seenN}/${items.length} · ${Math.round((seenN / items.length) * 100)}%</b></div>
      <p class="dex-sub">등장</p><div class="dex">${items.filter((i) => i.key === "p1").map(cell).join("")}</div>
      <p class="dex-sub">사건</p><div class="dex">${items.filter((i) => i.key === "p3").map(cell).join("")}</div>
    </div></section>
    <section class="blk"><h3 class="vlabel">기록</h3><div>
      ${list ? `<ul class="entries">${list}</ul>` : `<p class="locked">아직 기록한 꿈이 없어요. 오늘 아침 꿈부터 4칸에 넣어 볼까요?</p>`}
    </div></section>`;
}

/* ---------- 이벤트 ---------- */
function startPicker({ reset = false } = {}) {
  if (reset) {
    state.sel = { p1: null, p2: null, p3: null, p4: null };
    $("#sayInput").value = "";
    $("#sayHits").innerHTML = "";
  }
  state.active = nextEmpty("p4") || "p1";
  renderPicker();
  go("app");
}

function bind() {
  // 부적 버튼: 도장이 쾅 찍힌 뒤 4칸 입력으로
  $("#start").addEventListener("click", (e) => {
    const b = e.currentTarget;
    if (b.classList.contains("is-sealed")) return;
    haptic(16);
    b.classList.add("is-sealed");
    setTimeout(() => {
      b.classList.remove("is-sealed");
      startPicker();
    }, prefersReducedMotion() ? 0 : 380);
  });
  $("#introDiary").addEventListener("click", () => {
    renderDiary();
    go("diary");
  });
  $("#diaryBtn").addEventListener("click", () => {
    renderDiary();
    go("diary");
  });
  $("#home").addEventListener("click", (e) => {
    e.preventDefault();
    history.replaceState(null, "", location.pathname);
    go("intro");
  });
  $("#pillars").addEventListener("click", (e) => {
    const b = e.target.closest(".wg-col");
    if (b) setActive(b.dataset.key);
  });
  $("#tiles").addEventListener("click", (e) => {
    const b = e.target.closest(".tile");
    if (b) pick(b.dataset.id);
  });
  $("#goResult").addEventListener("click", () => {
    if (!isComplete(state.sel)) return;
    showResult({ ...state.sel }, { mode: "new", date: todayKey() });
  });
  $("#sayInput").addEventListener("input", (e) => {
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => applyText(e.target.value), 260);
  });
  $("#sayInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      applyText(e.target.value, { final: true });
      e.target.blur();
    }
  });
  $("#checkin").addEventListener("click", (e) => {
    if (!e.target.closest('[data-act="nodream"]')) return;
    const c = getChecks();
    const t = todayKey();
    if (!c.includes(t)) store.set("checkins", [...c, t].slice(-400));
    haptic(12);
    toast(`체크인했어요 · ${streak()}일째 연속이에요`);
    renderCheckin();
    updateBadge();
  });

  $("#result").addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const act = b.dataset.act;
    if (act === "save") saveEntry();
    else if (act === "img") shareCard();
    else if (act === "link") shareLink();
    else if (act === "again") startPicker({ reset: true });
    else if (act === "mine") {
      history.replaceState(null, "", location.pathname);
      startPicker({ reset: true });
    } else if (act === "tm") {
      const on = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", String(on));
      $("#tmBox").hidden = !on;
      haptic(8);
    } else if (act === "del") {
      setEntries(getEntries().filter((x) => x.id !== state.ctx.entryId));
      toast("기록을 지웠어요");
      renderDiary();
      go("diary");
    }
  });

  $("#diary").addEventListener("click", (e) => {
    const en = e.target.closest("[data-entry]");
    if (en) {
      const item = getEntries().find((x) => x.id === en.dataset.entry);
      if (!item) return;
      const sel = cleanSel(state.data, Object.fromEntries(KEYS.map((k, i) => [k, item.p[i]])));
      if (isComplete(sel)) showResult(sel, { mode: "saved", date: item.d, entryId: item.id });
      return;
    }
    if (e.target.closest('[data-act="again"]')) startPicker({ reset: true });
  });
}

function getParamsSel() {
  const q = new URLSearchParams(location.search);
  const raw = Object.fromEntries(KEYS.map((k) => [k, q.get(k)]));
  if (!KEYS.some((k) => raw[k])) return null;
  return { sel: cleanSel(state.data, raw), r: q.get("r") === "1", d: q.get("d") };
}

/* ---------- 시작 ---------- */
async function init() {
  renderMoreSites($("#more"));
  dressTalismans($("#more"));
  const q = new URLSearchParams(location.search);
  const deep = KEYS.some((k) => q.get(k));
  if (!deep) state.intro = startIntro($("#intro"));
  updateBadge();
  try {
    const res = await fetch("dreams.json");
    state.data = prepare(await res.json());
  } catch {
    toast("해몽 사전을 불러오지 못했어요. 새로고침해 주세요", 4000);
    return;
  }
  bind();
  setupSpeech();
  history.replaceState({ view: "intro" }, "", location.href);

  const p = getParamsSel();
  if (p) {
    state.sel = { ...p.sel };
    if (p.r && isComplete(p.sel)) {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(p.d || "") ? p.d : todayKey();
      showResult({ ...p.sel }, { mode: "shared", date });
      history.replaceState({ view: "result" }, "", location.href);
    } else {
      startPicker();
      history.replaceState({ view: "app" }, "", location.href);
    }
  }
}

init();
