import {
  $,
  $$,
  createStore,
  toast,
  haptic,
  share,
  shareImage,
  encodeState,
  decodeState,
  urlWith,
  getParam,
  todayKey,
  fmt,
  runIntro,
  showView,
  openSheet,
  renderMoreSites,
  createCanvas,
  roundRect,
  wrapText,
  CANVAS_FONT,
  countUp,
  prefersReducedMotion,
} from "../shared/kit.js";
import * as E from "./engine.js";
import { createLineChart, createCandleChart, sparkline, palette, alpha } from "./chart.js";

const store = createStore("life-stock");
const TODAY = E.todayYmd();
const DOW = ["일", "월", "화", "수", "목", "금", "토"];

let P = null; // 내 분석
let R = null; // 내 리포트
let partner = null; // M&A 상대 분석
let intro = null;

/* ---------- 포맷 ---------- */
const won = (v) => fmt.num(Math.round(v));
const pct = (a, b) => (a / b - 1) * 100;
const sign = (v) => (v > 0.0001 ? "up" : v < -0.0001 ? "down" : "flat");
const arrow = (v) => (v > 0.0001 ? "▲" : v < -0.0001 ? "▼" : "-");
const pctText = (v, d = 2) => `${v > 0 ? "+" : ""}${v.toFixed(d)}%`;
function chg(cur, base, { abs = true } = {}) {
  const p = pct(cur, base);
  const diff = Math.round(cur) - Math.round(base);
  return `<span class="${sign(p)}">${arrow(p)} ${abs ? won(Math.abs(diff)) + " " : ""}(${pctText(p)})</span>`;
}
const score100 = (s) => Math.round(50 + 50 * s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const ymdText = (o) => `${o.y}.${String(o.m).padStart(2, "0")}.${String(o.d).padStart(2, "0")}`;

/* =========================================================
 * 1. 인트로 모션그래픽
 * ========================================================= */
const SAMPLE = { name: "홍길동", cal: "solar", y: 1994, m: 3, d: 15, h: 14, mi: 0, g: "M" };

function buildDemo(stage) {
  const S = E.analyze(SAMPLE);
  const W = 320;
  const H = 168;
  const top = 34;
  const bot = 14;
  const step = 6;
  const pts = [];
  for (let i = 0; i <= S.price.length - 1; i += step) pts.push(S.price[i]);
  const min = Math.min(...pts) * 0.92;
  const max = Math.max(...pts) * 1.12;
  const x = (i) => (i / (pts.length - 1)) * W;
  const y = (v) => top + (1 - (v - min) / (max - min)) * (H - top - bot);
  const line = pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${W} ${H} L0 ${H} Z`;
  const toX = (monthIdx) => (monthIdx / (S.price.length - 1)) * W;
  const bands = S.daeun
    .filter((d) => d.startAge < 90 && !d.pre)
    .map((d, k) => {
      const x0 = toX(Math.max(0, d.startAge * 12));
      const x1 = toX(Math.min(1080, (d.endAge + 1) * 12));
      const tone = d.score > 0.25 ? "up" : d.score < -0.25 ? "down" : "flat";
      return `<g class="demo__band" style="animation-delay:${0.15 + k * 0.12}s">
        <rect x="${x0}" y="0" width="${x1 - x0}" height="${H}" class="demo__bandbg ${k % 2 ? "is-odd" : ""}"/>
        <text x="${(x0 + x1) / 2}" y="14" text-anchor="middle" class="demo__bandtxt is-${tone}">${E.gzKo(d.gz)}</text>
        <text x="${(x0 + x1) / 2}" y="26" text-anchor="middle" class="demo__bandage">${d.startAge}세</text>
      </g>`;
    })
    .join("");
  const peakI = S.peakIdx / step;
  const px = x(peakI);
  const py = y(pts[Math.round(peakI)]);
  const peakYear = S.months[S.peakIdx].y;
  const bw = 132;
  const bx = px - bw - 10 > 4 ? px - bw - 10 : Math.min(W - bw - 4, px + 10);
  const zx0 = toX(S.drawdown.from);
  const zx1 = toX(S.drawdown.to);
  const nowT = S.tOf(TODAY);
  const nowX = toX(nowT);
  const nowY = y(S.basePrice(nowT));

  // 최근 14일 일봉
  const cs = [];
  for (let k = 13; k >= 0; k--) cs.push(S.candle(E.addDays(TODAY, -k)));
  const cmin = Math.min(...cs.map((c) => c.low));
  const cmax = Math.max(...cs.map((c) => c.high));
  const cy = (v) => 44 + (1 - (v - cmin) / (cmax - cmin)) * (H - 70);
  const cstep = W / cs.length;
  const candles = cs
    .map((c, i) => {
      const cx = cstep * i + cstep / 2;
      const upc = c.close >= c.open ? "up" : "down";
      const t = cy(Math.max(c.open, c.close));
      const h = Math.max(2, Math.abs(cy(c.open) - cy(c.close)));
      return `<g class="demo__candle is-${upc}" style="animation-delay:${i * 0.06}s">
        <line x1="${cx}" x2="${cx}" y1="${cy(c.high)}" y2="${cy(c.low)}"/>
        <rect x="${cx - cstep * 0.3}" y="${t}" width="${cstep * 0.6}" height="${h}" rx="1"/>
      </g>`;
    })
    .join("");

  // 다음 손 없는 날 주변 7일
  let start = TODAY;
  for (let k = 0; k < 15; k++) {
    const o = E.addDays(TODAY, k);
    if (E.isSonEomneun(E.lunarOf(o.y, o.m, o.d).day)) {
      start = E.addDays(o, -2);
      break;
    }
  }
  const days = Array.from({ length: 7 }, (_, k) => {
    const o = E.addDays(start, k);
    const l = E.lunarOf(o.y, o.m, o.d);
    const son = E.isSonEomneun(l.day);
    return `<div class="demo__day ${son ? "is-son" : ""}" style="animation-delay:${0.5 + k * 0.07}s">${o.d}<small>${son ? "손없음" : "음" + l.day}</small></div>`;
  }).join("");

  const nowP = S.dayPrice(TODAY);
  const yChg = pct(nowP, E.START_PRICE);
  const tapeItems = [
    `${SAMPLE.name} (KRX:${S.code}) <b class="${sign(yChg)}">${arrow(yChg)} ${Math.abs(yChg).toFixed(1)}%</b>`,
    `현재 대운 <b>${E.gzKo(S.daeunAt(TODAY.y).gz)}</b>`,
    `올해 세운 <b>${E.gzKo(E.yearGZ(TODAY.y))}</b>`,
    `🚀 사상 최고가 <b>${peakYear}년</b>`,
    `업종 <b>${S.industry.sector}</b>`,
  ];
  const tape = tapeItems.map((t) => `<span>${t}</span>`).join("");

  stage.innerHTML = `
  <div class="demo" data-scene="0">
    <div class="demo__tape-wrap"><div class="demo__tape">${tape}${tape}</div></div>
    <div class="demo__head">
      <div>
        <div class="demo__name"><b>${SAMPLE.name}</b>KRX:${S.code}</div>
        <div class="demo__price t-num"><span id="demoPrice">${won(nowP)}</span>원</div>
        <div class="demo__chg ${sign(yChg)}">${arrow(yChg)} ${Math.abs(yChg).toFixed(1)}% <span class="t-tertiary">상장 후</span></div>
      </div>
      <span class="badge">예시</span>
    </div>
    <svg class="demo__svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="예시 인생 주가 차트">
      <defs>
        <linearGradient id="demoGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" class="demo__stop1"/><stop offset="1" class="demo__stop2"/>
        </linearGradient>
      </defs>
      <g class="demo__chartlayer">
        ${bands}
        <rect class="demo__zone" x="${zx0}" y="${top}" width="${zx1 - zx0}" height="${H - top - bot}"/>
        <path class="demo__area" d="${area}" fill="url(#demoGrad)"/>
        <path class="demo__line" d="${line}" pathLength="1"/>
        <line class="demo__now" x1="${nowX}" x2="${nowX}" y1="${top}" y2="${H - bot}"/>
        <circle class="demo__nowdot" cx="${nowX}" cy="${nowY}" r="3.5"/>
        <g class="demo__cross"><line x1="${px}" x2="${px}" y1="${top - 4}" y2="${H - bot}"/></g>
        <g class="demo__peak">
          <rect x="${bx}" y="${py - 4}" width="${bw}" height="20" rx="10"/>
          <text x="${bx + bw / 2}" y="${py + 10}" text-anchor="middle">🚀 사상 최고가 ${peakYear}년</text>
          <circle cx="${px}" cy="${py}" r="4"/>
        </g>
      </g>
      <g class="demo__candles">${candles}</g>
    </svg>
    <div class="demo__days">${days}</div>
  </div>`;
  return { S, nowP };
}

function startIntro() {
  const root = $("#intro");
  const stage = root.querySelector(".intro__stage");
  let demo;
  try {
    demo = buildDemo(stage);
  } catch (e) {
    console.error(e);
  }
  const el = () => stage.querySelector(".demo");
  const set = (n) => el() && (el().dataset.scene = String(n));
  intro?.stop();
  intro = runIntro({
    root,
    loop: true,
    scenes: [
      {
        title: "내 인생이 주식이라면?",
        desc: "생년월일시를 넣으면 대운·세운이 주가 차트가 돼요",
        duration: 3400,
        play() {
          set(0);
          const pe = $("#demoPrice");
          if (pe && demo) countUp(pe, demo.nowP, { from: 10000, duration: 2200, format: (n) => won(n) });
        },
      },
      {
        title: "대운은 추세, 세운은 등락",
        desc: "10년 대운이 큰 흐름을, 해마다 세운이 출렁임을 만들어요",
        duration: 3000,
        play() {
          set(1);
        },
      },
      {
        title: "🚀 내 인생 최고가는 언제?",
        desc: "사상 최고가와 최대 조정 구간을 미리 짚어줘요",
        duration: 3200,
        play() {
          set(2);
        },
      },
      {
        title: "오늘의 시세와 길일까지",
        desc: "매일 일진 일봉, 손 없는 날·이사 날짜를 챙겨줘요",
        duration: 3400,
        play() {
          set(3);
        },
      },
    ],
  });
}

/* =========================================================
 * 2. 입력 폼
 * ========================================================= */
const form = {
  cal: "solar",
  g: null,
  timeUnknown: false,
};

function fillSelect(sel, from, to, suffix, placeholder) {
  const cur = sel.value;
  const opts = [`<option value="">${placeholder}</option>`];
  if (from > to) for (let v = from; v >= to; v--) opts.push(`<option value="${v}">${v}${suffix}</option>`);
  else for (let v = from; v <= to; v++) opts.push(`<option value="${v}">${v}${suffix}</option>`);
  sel.innerHTML = opts.join("");
  if (cur && [...sel.options].some((o) => o.value === cur)) sel.value = cur;
}

function refreshDays() {
  const f = $("#form");
  const y = Number(f.y.value) || 2000;
  const m = Number(f.m.value) || 1;
  const max = form.cal === "lunar" ? 30 : E.daysInMonth(y, m);
  fillSelect(f.d, 1, max, "일", "일");
}

function initForm() {
  const f = $("#form");
  fillSelect(f.y, TODAY.y, 1930, "년", "년도");
  fillSelect(f.m, 1, 12, "월", "월");
  refreshDays();
  f.y.addEventListener("change", refreshDays);
  f.m.addEventListener("change", refreshDays);

  $$("[data-cal]").forEach((b) =>
    b.addEventListener("click", () => {
      form.cal = b.dataset.cal;
      $$("[data-cal]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      $("#leapWrap").hidden = form.cal !== "lunar";
      $("#dateHelp").textContent = form.cal === "lunar" ? "음력 생일을 골라 주세요. 양력으로 바꿔서 계산해요." : "양력 생일을 골라 주세요.";
      refreshDays();
    })
  );
  $$("[data-g]").forEach((b) =>
    b.addEventListener("click", () => {
      form.g = b.dataset.g;
      $$("[data-g]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      $("#gHelp").textContent = "";
    })
  );
  $("#timeUnknown").addEventListener("click", (e) => {
    form.timeUnknown = !form.timeUnknown;
    e.currentTarget.setAttribute("aria-pressed", String(form.timeUnknown));
    f.time.disabled = form.timeUnknown;
    $("#timeHelp").textContent = form.timeUnknown
      ? "시주를 빼고 6글자로 계산해요. 정확도가 조금 낮아질 수 있어요."
      : "한국 표준시 보정(−30분)을 적용해 시주를 계산해요.";
  });

  f.addEventListener("submit", (e) => {
    e.preventDefault();
    const errs = [];
    const name = f.name.value.trim();
    $("#f-name").classList.toggle("is-error", !name);
    if (!name) errs.push("#f-name");
    const y = Number(f.y.value);
    const m = Number(f.m.value);
    const d = Number(f.d.value);
    const dateOk = y && m && d;
    $("#f-date").classList.toggle("is-error", !dateOk);
    if (!dateOk) {
      $("#dateHelp").textContent = "생년월일을 모두 골라 주세요.";
      errs.push("#f-date");
    }
    if (!form.g) {
      $("#gHelp").textContent = "대운 방향 계산에 필요해요. 골라 주세요.";
      errs.push("#gHelp");
    }
    if (errs.length) {
      haptic([20, 40, 20]);
      $(errs[0]).scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    let h = -1;
    let mi = 0;
    if (!form.timeUnknown && f.time.value) {
      [h, mi] = f.time.value.split(":").map(Number);
    }
    const input = { name, cal: form.cal, y, m, d, leap: form.cal === "lunar" && f.leap.checked, h, mi, g: form.g };
    try {
      const A = E.analyze(input);
      if (A.birth.y > TODAY.y || E.utc(A.birth.y, A.birth.m, A.birth.d) > E.utc(TODAY.y, TODAY.m, TODAY.d)) throw new Error("아직 오지 않은 날짜예요");
      store.set("profile", input);
      setProfile(A);
      intro?.stop();
      ceremony();
    } catch (err) {
      $("#f-date").classList.add("is-error");
      $("#dateHelp").textContent = err.message || "날짜를 확인해 주세요.";
      $("#f-date").scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
}

function setProfile(A) {
  P = A;
  R = E.report(P, TODAY);
}

/* =========================================================
 * 3. 상장 세리머니
 * ========================================================= */
function ceremony() {
  const box = $("#ceremony");
  const inner = $("#ceremonyInner");
  const dy = P.daeun.find((d) => !d.pre) || P.daeun[0];
  const tape = [
    `${esc(P.name)} (KRX:${P.code}) 신규 상장`,
    `시가 <b>10,000원</b>`,
    `일간 <b>${P.industry.el}</b>`,
    `첫 대운 <b>${dy.startAge}세 ${E.gzKo(dy.gz)}</b>`,
    `업종 <b>${P.industry.sector}</b>`,
  ]
    .map((t) => `<span>${t}</span>`)
    .join("");
  inner.innerHTML = `
    <div class="ceremony__bell" aria-hidden="true">🔔</div>
    <p class="ceremony__kicker">KRX 인생시장 · 신규 상장 기념 타종</p>
    <div class="card ticker-card">
      <div class="ticker-card__top"><span class="badge">신규상장</span><span class="ticker-card__code t-num">KRX:${P.code}</span></div>
      <div class="ticker-card__name">${esc(P.name)}</div>
      <p class="ticker-card__sector">${P.industry.sector}</p>
      <dl>
        <dt>상장일</dt><dd class="t-num">${ymdText(P.birth)}${P.input.cal === "lunar" ? " (양력)" : ""}</dd>
        <dt>일간</dt><dd>${P.industry.el} · ${P.strengthLabel}</dd>
        <dt>대운 시작</dt><dd>${dy.startAge}세 (${dy.startYear}년)</dd>
        <dt>시가</dt><dd class="ticker-card__price t-num"><span id="ipoPrice">0</span>원</dd>
      </dl>
    </div>
    <p class="ceremony__msg">${P.industry.note}이에요.<br/>${P.timeKnown ? "" : "태어난 시간을 몰라 시주는 빼고 계산했어요."}</p>
    <div class="ceremony__tape"><div class="demo__tape">${tape}${tape}</div></div>
    <button class="btn btn--primary btn--lg btn--block" id="toDash" type="button">첫 거래 시작하기</button>`;
  box.hidden = false;
  document.body.style.overflow = "hidden";
  haptic([30, 60, 30, 60, 80]);
  countUp($("#ipoPrice"), 10000, { duration: 1400, format: (n) => won(n) });
  confetti($("#confetti"));
  $("#toDash").addEventListener("click", () => {
    box.hidden = true;
    document.body.style.overflow = "";
    showDash();
  });
}

function confetti(canvas) {
  if (prefersReducedMotion()) return;
  const C = palette();
  const colors = [C.up, C.warn, C.ok, C.down, C.text];
  const w = (canvas.width = innerWidth);
  const h = (canvas.height = innerHeight);
  const ctx = canvas.getContext("2d");
  const parts = Array.from({ length: 140 }, (_, i) => ({
    x: w / 2 + (Math.random() - 0.5) * 60,
    y: h * 0.32,
    vx: (Math.random() - 0.5) * 14,
    vy: -6 - Math.random() * 10,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.4,
    s: 5 + Math.random() * 6,
    c: colors[i % colors.length],
  }));
  const t0 = performance.now();
  const tick = (now) => {
    const t = now - t0;
    ctx.clearRect(0, 0, w, h);
    parts.forEach((p) => {
      p.vy += 0.32;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.globalAlpha = Math.max(0, 1 - t / 3200);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      ctx.restore();
    });
    if (t < 3200) requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, w, h);
  };
  setTimeout(() => requestAnimationFrame(tick), 250);
}

/* =========================================================
 * 4. 대시보드
 * ========================================================= */
let lifeChart;
let candleChart;
let range = "all";

function checkIn() {
  const k = todayKey();
  let list = store.get("checkins", []);
  if (!Array.isArray(list)) list = [];
  const first = !list.includes(k);
  if (first) {
    list.push(k);
    list = list.slice(-400);
    store.set("checkins", list);
  }
  const set = new Set(list);
  let streak = 0;
  let o = TODAY;
  while (set.has(`${o.y}-${String(o.m).padStart(2, "0")}-${String(o.d).padStart(2, "0")}`)) {
    streak++;
    o = E.addDays(o, -1);
  }
  return { streak, first, total: list.length };
}

function showDash() {
  intro?.stop();
  showView("dash");
  renderDash();
}

function renderDash() {
  const ci = checkIn();
  renderQuote(ci);
  renderLife();
  renderCandles(ci);
  renderReport();
  renderCalendar($("#calMain"), P);
  renderMA();
  initSubnav();
}

function renderQuote(ci) {
  const prev = P.dayPrice(E.addDays(TODAY, -1));
  const now = R.nowPrice;
  $("#quote").innerHTML = `
    <div class="quote__top">
      <span class="quote__name">${esc(P.name)}</span>
      <span class="quote__code t-num">KRX:${P.code}</span>
    </div>
    <span class="badge quote__sector">${P.industry.el} · ${P.industry.sector}</span>
    <div class="quote__price t-num">${won(now)}<span class="t-title-03">원</span></div>
    <div class="quote__chg t-num">${chg(now, prev)} <span class="t-tertiary t-label-03">전일 대비</span></div>
    <div class="quote__meta t-num">상장 ${ymdText(P.birth)} · 시가 10,000원 · 상장 후 ${pctText(pct(now, 10000), 1)} · 🔥 ${ci.streak}일 연속 확인</div>`;
}

/* ---------- 평생 차트 ---------- */
function lifeSpec(kind) {
  const C = palette();
  const N = P.price.length - 1;
  const nowT = Math.max(0, Math.min(N, R.nowT));
  const dyTone = (d) => (d.score > 0.25 ? "up" : d.score < -0.25 ? "down" : "flat");
  const monthIdxOfYear = (y) => (y - P.birth.y) * 12 - (P.birth.m - 1);
  const bandsFor = (a, b) =>
    P.daeun
      .map((d) => ({
        from: Math.max(a, d.pre ? 0 : monthIdxOfYear(d.startYear)) - a,
        to: Math.min(b, monthIdxOfYear(d.endYear + 1)) - a,
        top: E.gzKo(d.gz),
        bottom: d.pre ? "대운 전" : `${d.startAge}세`,
        long: d.pre ? `대운 전 · 월주 ${E.gzKo(d.gz)}` : `${d.startAge}~${d.endAge}세 ${E.gzKo(d.gz)} 대운`,
        tone: dyTone(d),
      }))
      .filter((b) => b.to > b.from);
  const tipMonth = (idx, base, label) => {
    const mo = P.months[idx];
    const v = P.price[idx];
    const dy = P.daeun[mo.daeun];
    return `<b class="t-num">${won(v)}원</b> ${chg(v, base, { abs: false })}<br/><span>${Math.floor(idx / 12)}세 · ${mo.y}년 ${mo.m}월 · ${
      dy.pre ? "대운 전" : E.gzKo(dy.gz) + " 대운"
    }</span>${label ? `<br/><span>${label}</span>` : ""}`;
  };

  if (kind === "all") {
    const peak = P.months[P.peakIdx];
    const dd = P.drawdown;
    const vals = P.price;
    return {
      height: 260,
      series: [{ values: vals, color: vals[N] >= vals[0] ? C.up : C.down, width: 2, fill: true, splitAt: nowT }],
      bands: bandsFor(0, N),
      zones: [{ from: dd.from, to: dd.to }],
      markers: [
        { i: nowT, kind: "today", label: "오늘" },
        { i: P.peakIdx, kind: "peak", label: `🚀 최고가 ${peak.y}년` },
      ],
      xTicks: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90].map((a) => ({ i: a * 12, label: `${a}세` })),
      tip: (i) => tipMonth(i, R.nowPrice),
    };
  }
  if (kind === "10y") {
    const a = Math.max(0, Math.round(nowT) - 60);
    const b = Math.min(N, a + 120);
    const vals = P.price.slice(a, b + 1);
    let pk = 0;
    vals.forEach((v, i) => v > vals[pk] && (pk = i));
    const ticks = [];
    for (let i = 0; i < vals.length; i++) {
      const mo = P.months[a + i];
      if (mo.m === 1 && mo.y % 2 === 0) ticks.push({ i, label: `${mo.y}` });
    }
    return {
      height: 260,
      series: [{ values: vals, color: vals[vals.length - 1] >= vals[0] ? C.up : C.down, width: 2, fill: true, splitAt: nowT - a }],
      bands: bandsFor(a, b),
      markers: [
        { i: nowT - a, kind: "today", label: "오늘" },
        { i: pk, kind: "peak", label: `🚀 10년 고점 ${P.months[a + pk].y}년` },
      ],
      xTicks: ticks,
      tip: (i) => tipMonth(a + i, R.nowPrice),
    };
  }
  // 올해: 일 단위
  const y = TODAY.y;
  const days = [];
  for (let o = { y, m: 1, d: 1 }; o.y === y; o = E.addDays(o, 1)) days.push(o);
  const vals = days.map((o) => P.dayPrice(o));
  const ti = days.findIndex((o) => o.m === TODAY.m && o.d === TODAY.d);
  let pk = 0;
  vals.forEach((v, i) => v > vals[pk] && (pk = i));
  return {
    height: 240,
    series: [{ values: vals, color: vals[vals.length - 1] >= vals[0] ? C.up : C.down, width: 1.6, fill: true, splitAt: ti }],
    markers: [
      { i: ti, kind: "today", label: "오늘" },
      { i: pk, kind: "peak", label: `🚀 올해 고점 ${days[pk].m}/${days[pk].d}` },
    ],
    xTicks: [1, 3, 5, 7, 9, 11].map((m) => ({ i: days.findIndex((o) => o.m === m && o.d === 1), label: `${m}월` })),
    tip: (i) => {
      const o = days[i];
      const g = E.dayGZ(o.y, o.m, o.d);
      return `<b class="t-num">${won(vals[i])}원</b> ${chg(vals[i], R.nowPrice, { abs: false })}<br/><span>${o.m}월 ${o.d}일(${
        DOW[E.utc(o.y, o.m, o.d).getUTCDay()]
      }) · ${E.gzKo(g)}일</span>`;
    },
  };
}

function renderLife() {
  if (!lifeChart) {
    lifeChart = createLineChart($("#lifeChart"), $("#lifeTip"));
    $$("#rangeTabs [data-range]").forEach((b) =>
      b.addEventListener("click", () => {
        range = b.dataset.range;
        $$("#rangeTabs [data-range]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        lifeChart.set(lifeSpec(range));
        haptic(8);
      })
    );
  }
  lifeChart.set(lifeSpec(range));

  const peak = P.months[P.peakIdx];
  const dd = P.drawdown;
  const ys = E.yearGZ(TODAY.y);
  const yScore = P.gzScore(ys);
  $("#lifeStats").innerHTML = `
    <div class="stat"><div class="stat__k">🚀 사상 최고가 예상</div><div class="stat__v t-num">${won(P.price[P.peakIdx])}원</div><div class="stat__s">${peak.y}년 · ${Math.floor(
      P.peakIdx / 12
    )}세</div></div>
    <div class="stat"><div class="stat__k">📉 최대 조정 구간</div><div class="stat__v t-num down">${pctText(dd.depth * 100, 1)}</div><div class="stat__s">${Math.floor(
      dd.from / 12
    )}~${Math.floor(dd.to / 12)}세 (${P.months[dd.from].y}~${P.months[dd.to].y}년)</div></div>
    <div class="stat"><div class="stat__k">상장 후 수익률</div><div class="stat__v t-num ${sign(R.nowPrice - 10000)}">${pctText(
      pct(R.nowPrice, 10000),
      1
    )}</div><div class="stat__s">시가 10,000원 → 현재가</div></div>
    <div class="stat"><div class="stat__k">${TODAY.y} 올해 세운</div><div class="stat__v ${sign(yScore)}">${E.gzKo(ys)}년 ${
      yScore > 0.2 ? "호재" : yScore < -0.2 ? "악재" : "중립"
    }</div><div class="stat__s">${E.elLabel(E.stemEl(ys.s))}·${E.elLabel(E.branchEl(ys.b))} 기운</div></div>`;

  const cur = P.daeunAt(TODAY.y);
  $("#daeunList").innerHTML = P.daeun
    .filter((d) => d.startAge <= 90 && !(d.pre && d.endAge < 0))
    .map((d) => {
      const s = Math.round(d.score * 100);
      return `<li class="${d === cur ? "is-now" : ""}">
        <span class="age t-num">${d.pre ? `0~${Math.max(0, d.endAge)}세` : `${d.startAge}~${d.endAge}세`}</span>
        <span class="gz"><b>${d.pre ? "대운 전" : E.gzKo(d.gz) + " 대운"}</b><small>${E.gzHanja(d.gz)} · ${E.EL_KO[E.stemEl(d.gz.s)]}/${E.EL_KO[E.branchEl(d.gz.b)]}</small>${
        d === cur ? '<span class="now-tag">지금</span>' : ""
      }</span>
        <span class="sc t-num ${sign(s)}">${arrow(s)} ${Math.abs(s)}</span>
      </li>`;
    })
    .join("");
}

/* ---------- 일봉 ---------- */
function renderCandles(ci) {
  const { y, m } = TODAY;
  const n = E.daysInMonth(y, m);
  const cs = [];
  for (let d = 1; d <= n; d++) cs.push({ ...P.candle({ y, m, d }), future: d > TODAY.d });
  const ti = TODAY.d - 1;
  const tc = cs[ti];
  const com = E.dayComment(P, tc);
  $("#candleTitle").textContent = `${m}월 일봉`;
  $("#streakBadge").textContent = `🔥 ${ci.streak}일 연속`;
  $("#todayBox").innerHTML = `
    <div class="today__row"><span class="today__k">오늘의 시세 · ${m}월 ${TODAY.d}일 ${E.gzKo(tc.gz)}일</span><span class="today__k">${com.god} 일진</span></div>
    <div class="today__row"><span class="today__price t-num">${won(tc.close)}원</span><span class="today__chg t-num">${chg(tc.close, tc.open)}</span></div>
    <div class="today__c">${com.text}</div>`;
  const pick = (i) => {
    const c = cs[i];
    const cm = E.dayComment(P, c);
    $("#candlePick").innerHTML = `<b>${m}월 ${c.d}일 ${E.gzKo(c.gz)}일</b>${c.future ? " (예상)" : ""} · 종가 <span class="t-num">${won(c.close)}원</span> ${chg(
      c.close,
      c.open,
      { abs: false }
    )}<br/>${cm.god} 일진 · ${cm.text}`;
  };
  if (!candleChart) candleChart = createCandleChart($("#candleChart"), { onPick: (i) => pick(i) });
  candleChart.set({ candles: cs, highlight: ti, height: 190 });
}

/* ---------- 애널리스트 리포트 ---------- */
function renderReport() {
  const C = palette();
  const op = R.opinion;
  const headline = { BUY: "대운 순풍, 상승 여력 충분", HOLD: "박스권 속 체력 다지기", WATCH: "조정 구간, 현금 비중 확대" }[op.code];
  const upside = pct(R.target, R.nowPrice);
  const pillarNames = ["시주", "일주", "월주", "연주"];
  const order = [3, 2, 1, 0];
  const pillars = order
    .map((k, j) => {
      const p = P.pillars[k];
      const unknown = k === 3 && !P.timeKnown;
      return `<div class="pillar ${k === 2 ? "is-day" : ""}">
        <div class="pillar__k">${pillarNames[j]}</div>
        <div class="pillar__h">${unknown ? "?" : E.gzHanja(p)}</div>
        <div class="pillar__ko">${unknown ? "모름" : E.gzKo(p)}</div>
      </div>`;
    })
    .join("");
  const maxC = Math.max(...P.counts, 1);
  const els = P.counts
    .map((c, e) => {
      const cls = P.favor[e] > 0.3 ? "is-fav" : P.favor[e] < -0.3 ? "is-unfav" : "";
      return `<div class="el ${cls}">
        <div class="el__bar"><div class="el__fill" style="height:${Math.max(4, (c / maxC) * 100)}%"></div></div>
        <div class="el__k">${E.EL_KO[e]} ${E.EL_HANJA[e]}</div>
        <div class="el__n t-num">${c}개 · ${E.GODS[P.rel(e)]}</div>
      </div>`;
    })
    .join("");
  const sectors = R.sectors
    .map((s) => {
      const col = s.delta >= 0 ? C.up : C.down;
      return `<div class="sector">
        <div class="sector__top"><span class="sector__name">${s.emoji} ${s.name}</span><span class="sector__d t-num ${sign(s.delta)}">${arrow(s.delta)}${Math.abs(
        s.delta
      )}</span></div>
        <div class="sector__v t-num">${s.value}</div>
        ${sparkline(s.series, { color: col })}
        <div class="sector__cap t-num">${TODAY.y} → ${TODAY.y + 9}</div>
      </div>`;
    })
    .join("");
  const favTxt = P.favorable.map((e) => `${E.elLabel(e)}(${E.GODS[P.rel(e)]})`).join(", ") || "뚜렷하지 않음";
  $("#sec-report").innerHTML = `
    <div class="report__mast"><span>나 상장하기 리서치센터</span><span class="t-num">기업분석 · ${ymdText(TODAY)}</span></div>
    <h2 class="t-title-03 report__title">${esc(P.name)}(${P.code}) · ${headline}</h2>
    <p class="t-body-03 t-secondary report__sub">${P.industry.sector} — ${P.industry.note}.</p>
    <div class="opinion">
      <div><div class="opinion__k">투자의견</div><div class="opinion__v op-${op.code}">${op.code}</div><div class="opinion__s">${op.ko}</div></div>
      <div><div class="opinion__k">목표주가(12M)</div><div class="opinion__v t-num">${won(R.target)}</div><div class="opinion__s t-num ${sign(upside)}">상승여력 ${pctText(
    upside,
    1
  )}</div></div>
      <div><div class="opinion__k">현재주가</div><div class="opinion__v t-num">${won(R.nowPrice)}</div><div class="opinion__s t-num">${TODAY.m}/${TODAY.d} 종가</div></div>
    </div>
    <h3>투자포인트</h3>
    <ol class="points">${R.points.map((p) => `<li><b>${p.title}</b><p>${p.body}</p></li>`).join("")}</ol>
    <h3>리스크 요인</h3>
    <ol class="points points--risk">${R.risks.map((p) => `<li><b>${p.title}</b><p>${p.body}</p></li>`).join("")}</ol>
    <h3>섹터별 지표 · 향후 10년</h3>
    <div class="sectors">${sectors}</div>
    <p class="note">재물=재성, 직장=관성, 연애=${P.input.g === "M" ? "재성" : "관성"}+식상, 건강=오행 균형으로 계산한 0~100 지수예요. 화살표는 작년 대비.</p>
    <h3>기업 개요 · 사주 원국</h3>
    <div class="pillars">${pillars}</div>
    <div class="els">${els}</div>
    <div class="legend"><span><i style="background:var(--ls-up)"></i>유리한 오행</span><span><i style="background:var(--ls-down)"></i>불리한 오행</span><span><i style="background:var(--color-text-tertiary)"></i>중립</span></div>
    <p class="note">일간 ${P.industry.el}, 나를 돕는 기운 비중 ${Math.round(P.ratio * 100)}%로 <b>${P.strengthLabel}</b>이에요. 유리한 오행: ${favTxt}.${
    P.timeKnown ? "" : " 태어난 시간을 몰라 시주는 빼고 계산했어요."
  } 재미로 보는 콘텐츠예요. 투자·인생 결정의 근거가 아니에요.</p>`;
}

/* ---------- 택일 캘린더 ---------- */
const calState = new WeakMap();
function renderCalendar(el, prof, ym) {
  const st = calState.get(el) || { y: TODAY.y, m: TODAY.m };
  if (ym) Object.assign(st, ym);
  calState.set(el, st);
  const { y, m } = st;
  const days = E.monthCalendar(prof, y, m);
  const first = E.utc(y, m, 1).getUTCDay();
  const todayT = E.utc(TODAY.y, TODAY.m, TODAY.d).getTime();
  const emo = Object.fromEntries(E.PURPOSES.map((p) => [p.key, p.emoji]));
  const monthsAhead = (y - TODAY.y) * 12 + (m - TODAY.m);
  const cells = [];
  for (let i = 0; i < first; i++) cells.push("<span></span>");
  days.forEach((x, i) => {
    const t = E.utc(y, m, x.d).getTime();
    const cls = [x.son && "is-son", t < todayT && "is-past", t === todayT && "is-today"].filter(Boolean).join(" ");
    const lunar = x.son ? "손없음" : `${x.lun.day === 1 ? Math.abs(x.lun.month) + "." : ""}${x.lun.day}`;
    cells.push(`<button type="button" class="cal__day ${cls}" data-i="${i}" aria-label="${m}월 ${x.d}일${x.son ? " 손 없는 날" : ""}">
      <span class="cal__n t-num">${x.d}</span><span class="cal__l t-num">${lunar}</span><span class="cal__marks">${x.good.map((k) => emo[k]).join("")}</span></button>`);
  });
  const sons = days.filter((x) => x.son);
  const picks = prof
    ? `<div class="cal__picks">${E.PURPOSES.map((p) => {
        const ds = days.filter((x) => x.good.includes(p.key)).map((x) => `${x.d}일`);
        return `<div class="pick"><b>${p.emoji} ${p.name}</b><span>${ds.length ? ds.join(", ") : "이번 달은 쉬어 가요"}</span></div>`;
      }).join("")}</div>`
    : "";
  el.innerHTML = `
    <div class="cal__head">
      <button type="button" class="btn btn--ghost btn--icon" data-nav="-1" aria-label="이전 달" ${monthsAhead <= -1 ? "disabled" : ""}>‹</button>
      <span class="cal__title t-num">${y}년 ${m}월</span>
      <button type="button" class="btn btn--ghost btn--icon" data-nav="1" aria-label="다음 달" ${monthsAhead >= 12 ? "disabled" : ""}>›</button>
    </div>
    <div class="cal__grid">${DOW.map((d) => `<span class="cal__dow">${d}</span>`).join("")}${cells.join("")}</div>
    <div class="cal__legend"><span><span class="sw"></span>손 없는 날 (음력 9·10·19·20·29·30일)</span>${
      prof ? E.PURPOSES.map((p) => `<span>${p.emoji} ${p.name}</span>`).join("") : ""
    }</div>
    ${picks}
    <p class="note">이번 달 손 없는 날: ${sons.map((x) => `${x.d}일(음 ${Math.abs(x.lun.month)}.${x.lun.day})`).join(", ")}.${
    prof ? " 이사 추천은 손 없는 날 중 내 일진 점수가 높은 날이에요." : ""
  }</p>`;
  el.querySelectorAll("[data-nav]").forEach((b) =>
    b.addEventListener("click", () => {
      let nm = m + Number(b.dataset.nav);
      let ny = y;
      if (nm < 1) ((nm = 12), ny--);
      if (nm > 12) ((nm = 1), ny++);
      renderCalendar(el, prof, { y: ny, m: nm });
    })
  );
  el.querySelectorAll("[data-i]").forEach((b) => b.addEventListener("click", () => openDay(days[Number(b.dataset.i)], prof)));
}

function openDay(x, prof) {
  const sheet = $("#daySheet");
  const dow = DOW[E.utc(x.y, x.m, x.d).getUTCDay()];
  const lun = `${x.lun.leap ? "윤" : ""}${Math.abs(x.lun.month)}월 ${x.lun.day}일`;
  let mine = "";
  if (prof) {
    const c = prof.candle({ y: x.y, m: x.m, d: x.d });
    const cm = E.dayComment(prof, c);
    const names = x.good.map((k) => E.PURPOSES.find((p) => p.key === k)).map((p) => `${p.emoji} ${p.name}`);
    mine = `<dt>내 일진 점수</dt><dd class="t-num ${sign(x.score)}">${score100(x.score)} / 100</dd>
      <dt>${prof === P ? "내" : ""} 주가</dt><dd class="t-num">${won(c.close)}원 ${chg(c.close, c.open, { abs: false })}</dd>
      <dt>추천</dt><dd>${names.length ? names.join(" · ") : "특별한 일정 없이 무난해요"}</dd>
      <dt>한 줄</dt><dd>${cm.god} 일진 · ${cm.text}</dd>`;
  }
  sheet.innerHTML = `<div class="day-detail">
    <div class="row between"><h2 class="t-title-03">${x.m}월 ${x.d}일 (${dow})</h2>${x.son ? '<span class="badge">손 없는 날</span>' : ""}</div>
    <dl class="kv">
      <dt>음력</dt><dd class="t-num">${lun}</dd>
      <dt>일진</dt><dd>${E.gzKo(x.gz)}(${E.gzHanja(x.gz)})일 · ${E.EL_KO[E.stemEl(x.gz.s)]}/${E.EL_KO[E.branchEl(x.gz.b)]}</dd>
      <dt>손</dt><dd>${x.son ? "없음 · 이사·개업하기 좋은 날로 꼽아요" : sonDir(x.lun.day)}</dd>
      ${mine}
    </dl>
    ${prof ? "" : '<p class="t-body-03 t-secondary">상장하면 이날 나에게 맞는 일(면접·고백·이사·계약)도 알려 드려요.</p>'}
    <button type="button" class="btn btn--outline btn--block" data-sheet-close>닫기</button>
  </div>`;
  openSheet(sheet);
}
function sonDir(day) {
  const r = day % 10;
  const dir = r === 1 || r === 2 ? "동쪽" : r === 3 || r === 4 ? "남쪽" : r === 5 || r === 6 ? "서쪽" : "북쪽";
  return `${dir}에 있어요 (그 방향 이사는 피한다고 해요)`;
}

/* ---------- M&A ---------- */
function maLink() {
  const i = P.input;
  return urlWith({ ma: encodeState({ v: 1, n: i.name, c: i.cal, y: i.y, m: i.m, d: i.d, l: i.leap ? 1 : 0, h: i.h, mi: i.mi, g: i.g }) });
}
function decodePartner(str) {
  const o = decodeState(str);
  if (!o || !o.y || !o.m || !o.d) return null;
  return { name: String(o.n || "친구").slice(0, 10), cal: o.c === "lunar" ? "lunar" : "solar", y: +o.y, m: +o.m, d: +o.d, leap: !!o.l, h: o.h == null ? -1 : +o.h, mi: +o.mi || 0, g: o.g === "F" ? "F" : "M" };
}
async function sendMA() {
  const r = await share({
    title: "나 상장하기 · M&A 제안",
    text: `${P.name} 주식이 상장했어요 📈 내 인생 사상 최고가는 ${P.months[P.peakIdx].y}년! 우리 합병하면 시너지 몇 %일까요?`,
    url: maLink(),
  });
  if (r === "shared") toast("제안서를 보냈어요");
}

let maChart;
function renderMA() {
  const el = $("#sec-ma");
  if (!partner) {
    el.innerHTML = `
      <div class="panel__head"><h2 class="t-title-04">M&amp;A 궁합</h2></div>
      <div class="ma__empty">
        <div class="emoji" aria-hidden="true">🤝</div>
        <p class="t-body-02-strong">친구 종목과 합병해 볼까요?</p>
        <p class="t-body-03 t-secondary">링크를 받은 친구가 자기 생일을 넣으면 두 사람의 평생 차트를 겹쳐 보고 합병 시너지를 계산해요. 링크에는 내 생년월일시가 담겨요.</p>
        <button class="btn btn--primary btn--block" type="button" id="maSend">🔗 M&amp;A 제안 링크 보내기</button>
      </div>`;
    $("#maSend").addEventListener("click", sendMA);
    return;
  }
  const B = partner;
  const M = E.merger(P, B, TODAY);
  const C = palette();
  const from = TODAY.y - 5;
  const to = TODAY.y + 25;
  const pts = [];
  for (let y = from; y <= to; y++) for (let m = 1; m <= 12; m++) pts.push({ y, m, d: 15 });
  const a = pts.map((o) => P.basePrice(P.tOf(o)));
  const b = pts.map((o) => B.basePrice(B.tOf(o)));
  const na = a.map((v) => (v / a[0]) * 100);
  const nb = b.map((v) => (v / b[0]) * 100);
  const nowI = (TODAY.y - from) * 12 + TODAY.m - 1;
  const why = [];
  why.push(`앞으로 30년 중 두 종목이 함께 오르는 해가 ${M.bothUp}년이에요.`);
  why.push(
    M.corr > 0.3
      ? "상승·조정 사이클이 비슷해서 같은 방향으로 움직여요."
      : M.corr < -0.2
        ? "한쪽이 쉬어 갈 때 다른 쪽이 오르는 헤지 관계예요."
        : "사이클이 서로 독립적이라 각자 페이스대로 가요."
  );
  const fv = (X, Y) => (X.favor[Y.dmEl] > 0.3 ? "힘이 되는" : X.favor[Y.dmEl] < -0.3 ? "부담이 되는" : "무난한");
  why.push(`${esc(B.name)}의 일간 ${B.industry.el}은 ${esc(P.name)}에게 ${fv(P, B)} 기운, ${esc(P.name)}의 ${P.industry.el}은 ${esc(B.name)}에게 ${fv(B, P)} 기운이에요.`);
  M.fills.slice(0, 2).forEach((f) => {
    const [x, y] = f.to === "A" ? [P, B] : [B, P];
    why.push(`${esc(x.name)}에게 부족한 ${E.elLabel(f.el)}을 ${esc(y.name)}이(가) 채워줘요.`);
  });
  const tone = M.label.tone;
  el.innerHTML = `
    <div class="panel__head"><h2 class="t-title-04">M&amp;A 궁합</h2><span class="t-label-03 t-tertiary">${esc(P.name)} × ${esc(B.name)}</span></div>
    <div class="ma__hero">
      <div class="t-label-02 t-secondary">합병 시너지</div>
      <div class="ma__syn t-num ${tone === "flat" ? "flat" : sign(M.synergy)}">${M.synergy > 0 ? "+" : ""}${M.synergy}%</div>
      <span class="badge ma__label is-${tone}">${M.label.t}</span>
    </div>
    <div class="chart-wrap"><canvas id="maChart" aria-label="두 종목 겹쳐 보기"></canvas><div class="chart-tip" id="maTip" hidden></div></div>
    <div class="legend"><span><i style="background:var(--ls-up)"></i>${esc(P.name)}</span><span><i style="background:var(--color-warning)"></i>${esc(
      B.name
    )}</span><span>${from}년=100 기준</span></div>
    <ul class="ma__why">${why.map((w) => `<li>${w}</li>`).join("")}</ul>
    <p class="note">시너지 = 사이클 상관(${M.corr.toFixed(2)}) + 일간 상생(${M.mutual.toFixed(2)}) + 오행 보완(${Math.round(
      M.comp * 100
    )}%)으로 계산한 재미용 지수예요.</p>
    <div class="stack gap-8">
      <button class="btn btn--outline btn--block" type="button" id="maSend">다른 친구에게 제안하기</button>
      <button class="btn btn--ghost btn--block" type="button" id="maClear">합병 해제</button>
    </div>`;
  maChart = createLineChart($("#maChart"), $("#maTip"));
  maChart.set({
    height: 220,
    series: [
      { values: na, color: C.up, width: 2, fill: false, splitAt: nowI },
      { values: nb, color: C.warn, width: 2, fill: false, splitAt: nowI },
    ],
    markers: [{ i: nowI, kind: "today", label: "오늘" }],
    xTicks: pts.map((o, i) => (o.m === 1 && o.y % 5 === 0 ? { i, label: `${o.y}` } : null)).filter(Boolean),
    tip: (i) =>
      `<b>${pts[i].y}년 ${pts[i].m}월</b><br/><span class="up">${esc(P.name)} ${na[i].toFixed(0)}</span> · <span style="color:var(--color-warning)">${esc(
        B.name
      )} ${nb[i].toFixed(0)}</span>`,
  });
  $("#maSend").addEventListener("click", sendMA);
  $("#maClear").addEventListener("click", () => {
    partner = null;
    store.remove("partner");
    renderMA();
  });
}

/* ---------- 서브 내비 ---------- */
let navObs;
function initSubnav() {
  const links = $$(".subnav__a");
  links.forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      $(a.getAttribute("href"))?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
    })
  );
  navObs?.disconnect();
  if (!("IntersectionObserver" in window)) return;
  navObs = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) links.forEach((a) => a.classList.toggle("is-on", a.getAttribute("href") === "#" + en.target.id));
      });
    },
    { rootMargin: "-120px 0px -60% 0px" }
  );
  ["#sec-chart", "#sec-candle", "#sec-report", "#sec-cal", "#sec-ma"].forEach((s) => navObs.observe($(s)));
}

/* =========================================================
 * 5. 공유 카드 (1080×1350)
 * ========================================================= */
function drawCard() {
  const C = palette();
  const W = 540;
  const H = 675;
  const { canvas, ctx } = createCanvas(W, H, 2);
  const F = CANVAS_FONT;
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  // 카드
  ctx.fillStyle = C.surface;
  roundRect(ctx, 24, 24, W - 48, H - 48, 28);
  ctx.fill();
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  const X = 52;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = C.brand;
  ctx.font = `700 16px ${F}`;
  ctx.fillText("📈 나 상장하기", X, 72);
  ctx.fillStyle = C.text3;
  ctx.textAlign = "right";
  ctx.font = `600 15px ${F}`;
  ctx.fillText(`KRX:${P.code}`, W - X, 72);
  ctx.textAlign = "left";

  ctx.fillStyle = C.text;
  ctx.font = `800 44px ${F}`;
  wrapText(ctx, P.name, X, 128, W - 2 * X, 50);
  ctx.fillStyle = C.text2;
  ctx.font = `500 16px ${F}`;
  ctx.fillText(`${P.industry.el} · ${P.industry.sector}`, X, 158);

  const prev = P.dayPrice(E.addDays(TODAY, -1));
  const p = pct(R.nowPrice, prev);
  ctx.fillStyle = C.text;
  ctx.font = `800 52px ${F}`;
  const priceText = `${won(R.nowPrice)}원`;
  ctx.fillText(priceText, X, 226);
  ctx.fillStyle = p >= 0 ? C.up : C.down;
  ctx.font = `700 20px ${F}`;
  ctx.fillText(`${arrow(p)} ${pctText(p)} 오늘   ·   상장 후 ${pctText(pct(R.nowPrice, 10000), 1)}`, X, 260);

  // 미니 차트
  const cx0 = X;
  const cy0 = 292;
  const cw = W - 2 * X;
  const ch = 190;
  ctx.fillStyle = C.sunken;
  roundRect(ctx, cx0, cy0, cw, ch, 16);
  ctx.fill();
  const vals = P.price;
  const n = vals.length;
  const mn = Math.min(...vals) * 0.9;
  const mx = Math.max(...vals) * 1.12;
  const px = (i) => cx0 + 12 + (i / (n - 1)) * (cw - 24);
  const py = (v) => cy0 + 30 + (1 - (v - mn) / (mx - mn)) * (ch - 50);
  const g = ctx.createLinearGradient(0, cy0, 0, cy0 + ch);
  g.addColorStop(0, alpha(C.up, 0.35));
  g.addColorStop(1, alpha(C.up, 0));
  ctx.beginPath();
  vals.forEach((v, i) => (i ? ctx.lineTo(px(i), py(v)) : ctx.moveTo(px(i), py(v))));
  ctx.lineTo(px(n - 1), cy0 + ch - 20);
  ctx.lineTo(px(0), cy0 + ch - 20);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.beginPath();
  vals.forEach((v, i) => (i ? ctx.lineTo(px(i), py(v)) : ctx.moveTo(px(i), py(v))));
  ctx.strokeStyle = C.up;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.stroke();
  const ni = Math.max(0, Math.min(n - 1, R.nowT));
  ctx.fillStyle = C.text;
  ctx.beginPath();
  ctx.arc(px(ni), py(P.basePrice(ni)), 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `700 12px ${F}`;
  ctx.textAlign = "center";
  ctx.fillText("오늘", px(ni), py(P.basePrice(ni)) + 22);
  // 최고가
  const pk = P.peakIdx;
  ctx.fillStyle = C.warn;
  ctx.beginPath();
  ctx.arc(px(pk), py(vals[pk]), 5, 0, Math.PI * 2);
  ctx.fill();
  const label = `🚀 최고가 ${P.months[pk].y}년`;
  ctx.font = `800 13px ${F}`;
  const lw = ctx.measureText(label).width + 16;
  const lx = Math.max(cx0 + 6, Math.min(cx0 + cw - lw - 6, px(pk) - lw / 2));
  roundRect(ctx, lx, py(vals[pk]) - 32, lw, 22, 11);
  ctx.fill();
  ctx.fillStyle = C.bg;
  ctx.textAlign = "left";
  ctx.fillText(label, lx + 8, py(vals[pk]) - 16);
  ctx.fillStyle = C.text3;
  ctx.font = `500 11px ${F}`;
  ctx.fillText("0세", cx0 + 12, cy0 + ch - 6);
  ctx.textAlign = "right";
  ctx.fillText("90세", cx0 + cw - 12, cy0 + ch - 6);
  ctx.textAlign = "left";

  // 투자의견
  const oy = 508;
  const op = R.opinion;
  const opColor = op.code === "BUY" ? C.up : op.code === "HOLD" ? C.warn : C.down;
  ctx.fillStyle = C.text3;
  ctx.font = `600 13px ${F}`;
  ctx.fillText("투자의견", X, oy + 16);
  ctx.fillText("목표주가(12M)", X + 160, oy + 16);
  ctx.fillText("현재 대운", X + 320, oy + 16);
  ctx.fillStyle = opColor;
  ctx.font = `800 26px ${F}`;
  ctx.fillText(`${op.code}`, X, oy + 48);
  ctx.fillStyle = C.text;
  ctx.fillText(`${won(R.target)}`, X + 160, oy + 48);
  ctx.fillText(R.cur.pre ? "대운 전" : `${E.gzKo(R.cur.gz)}`, X + 320, oy + 48);

  ctx.fillStyle = C.text3;
  ctx.font = `500 12px ${F}`;
  ctx.fillText("재미로 보는 콘텐츠예요 · 사주 대운·세운으로 그린 가상의 주가", X, H - 52);
  ctx.textAlign = "right";
  ctx.fillStyle = C.text2;
  ctx.font = `700 12px ${F}`;
  ctx.fillText(location.host ? `${location.host}/life-stock` : "나 상장하기", W - X, H - 52);
  ctx.textAlign = "left";
  return canvas;
}

/* =========================================================
 * 6. 손 없는 날 단독 달력 / 라우팅
 * ========================================================= */
function goIntro() {
  showView("intro");
  startIntro();
}
function goForm() {
  intro?.stop();
  showView("form");
}

function init() {
  renderMoreSites($("#more"), "life-stock");
  initForm();

  $("#start").addEventListener("click", () => {
    if (P) showDash();
    else goForm();
  });
  $("#openCal").addEventListener("click", () => {
    intro?.stop();
    showView("cal");
    renderCalendar($("#calOnly"), null);
  });
  $("#calToStart").addEventListener("click", goForm);
  $$("[data-back]").forEach((b) => b.addEventListener("click", goIntro));
  $("#shareImg").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.classList.add("is-loading");
    try {
      await shareImage(drawCard(), { filename: `life-stock-${P.code}.png`, title: "나 상장하기", text: `${P.name} 주식 상장! 사상 최고가는 ${P.months[P.peakIdx].y}년` });
    } finally {
      btn.classList.remove("is-loading");
    }
  });
  $("#shareLink").addEventListener("click", sendMA);
  $("#shareTop").addEventListener("click", sendMA);
  $("#reset").addEventListener("click", () => {
    if (!confirm("저장된 내 종목을 지우고 새로 상장할까요?")) return;
    store.remove("profile");
    P = null;
    R = null;
    $("#form").reset();
    refreshDays();
    goForm();
  });

  // M&A 링크로 들어왔는지
  const maParam = getParam("ma");
  let incoming = null;
  if (maParam) {
    const inp = decodePartner(maParam);
    if (inp) {
      try {
        incoming = E.analyze(inp);
      } catch {
        incoming = null;
      }
    }
    try {
      history.replaceState(null, "", location.pathname);
    } catch {
      /* noop */
    }
  }

  const saved = store.get("profile");
  if (saved) {
    try {
      setProfile(E.analyze(saved));
    } catch {
      store.remove("profile");
    }
  }
  if (!incoming) {
    const sp = store.get("partner");
    if (sp) {
      try {
        partner = E.analyze(sp);
      } catch {
        partner = null;
      }
    }
  }
  if (incoming) {
    const same = P && P.birth.y === incoming.birth.y && P.birth.m === incoming.birth.m && P.birth.d === incoming.birth.d && P.name === incoming.name;
    if (!same) {
      partner = incoming;
      store.set("partner", incoming.input);
    }
  }

  if (P) {
    showDash();
    if (incoming && partner === incoming) {
      setTimeout(() => $("#sec-ma").scrollIntoView({ behavior: "smooth" }), 400);
      toast(`${incoming.name}님과의 합병 결과가 나왔어요`);
    } else {
      toast("오늘의 시세가 나왔어요 📈");
    }
    return;
  }
  if (incoming) {
    const inv = $("#maInvite");
    inv.hidden = false;
    inv.innerHTML = `<span class="ma-invite__emoji" aria-hidden="true">🤝</span><div><p class="t-body-03-strong" style="margin:0">${esc(
      incoming.name
    )}님이 M&amp;A를 제안했어요</p><p class="t-caption-01 t-secondary" style="margin:0">내 주식을 상장하면 두 차트를 겹쳐 합병 시너지를 볼 수 있어요.</p></div>`;
    $("#start").textContent = "내 주식 상장하고 합병 보기";
  }
  goIntro();
}

init();
