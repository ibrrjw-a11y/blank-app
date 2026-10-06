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
  hashString,
} from "../shared/kit.js";
import * as E from "./engine.js";
import { flap, odometer, kinetic, tween, springEase, wait } from "./fx.js";
import { createLineChart, createCandleChart, sparkline, palette, alpha } from "./chart.js";
import { SAJU_LIFE, SAJU_TITLE, SAJU_REL, SAJU_H, SAJU_L } from "./saju_life.js";   // 2026-10-06 생활 풀이(짐작과 진짜와 같은 문장)
import { RELS, BANK, FILL, BAND, fill as fillLine } from "./ma_bank.js";
import { readMe, readPair, readingHTML } from "./reading.js";   // 2026-10-06 결과 해석(왜 → 지금 → 그래서)            // 2026-10-06 M&A 궁합 생활 장면

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
// 받침에 따라 조사 고르기 (한자 오행은 한글 독음으로 판단)
const HANJA_KO = { 木: "목", 火: "화", 土: "토", 金: "금", 水: "수" };
function josa(word, withB, withoutB) {
  const base = String(word).replace(/\([^)]*\)$/, "").trim();
  const last = base.slice(-1);
  const c = (HANJA_KO[last] || last).charCodeAt(0);
  const has = c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 > 0 : false;
  return word + (has ? withB : withoutB);
}
const ymdText = (o) => `${o.y}.${String(o.m).padStart(2, "0")}.${String(o.d).padStart(2, "0")}`;

/* =========================================================
 * 1. 인트로 모션그래픽 — 실제 단말기 화면이 움직이며 기능을 보여줘요
 * ========================================================= */
const SAMPLE = { name: "홍길동", cal: "solar", y: 1994, m: 3, d: 15, h: 14, mi: 0, g: "M" };
const clock = () => {
  const d = new Date(Date.now() + (new Date().getTimezoneOffset() + 540) * 60000);
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((v) => String(v).padStart(2, "0")).join(":");
};

function buildDemo(stage) {
  const S = E.analyze(SAMPLE);
  const W = 340;
  // 남는 세로 공간만큼 차트를 키워요 (차트 외 영역 ≈ 215px)
  const sw = stage.clientWidth || 358;
  const sh = stage.clientHeight || 0;
  const H = Math.round(Math.max(172, Math.min(300, ((sh - 245) * W) / sw)));
  const top = 34;
  const bot = 12;
  const step = 6;
  const pts = [];
  for (let i = 0; i <= S.price.length - 1; i += step) pts.push(S.price[i]);
  const min = Math.min(...pts) * 0.92;
  const max = Math.max(...pts) * 1.06;
  const x = (i) => (i / (pts.length - 1)) * W;
  const y = (v) => top + (1 - (v - min) / (max - min)) * (H - top - bot);
  const line = pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${W} ${H} L0 ${H} Z`;
  const toX = (monthIdx) => (monthIdx / (S.price.length - 1)) * W;
  const grid = [0.25, 0.5, 0.75].map((f) => `<line x1="0" x2="${W}" y1="${top + f * (H - top - bot)}" y2="${top + f * (H - top - bot)}"/>`).join("") +
    [1, 2, 3, 4, 5, 6, 7, 8].map((k) => `<line y1="${top}" y2="${H}" x1="${(k * W) / 9}" x2="${(k * W) / 9}"/>`).join("");
  const bands = S.daeun
    .filter((d) => d.startAge < 86 && !d.pre)
    .map((d, k) => {
      const x0 = toX(Math.max(0, d.startAge * 12));
      const x1 = toX(Math.min(1080, (d.endAge + 1) * 12));
      const tone = d.score > 0.25 ? "up" : d.score < -0.25 ? "down" : "flat";
      return `<g class="g-band ${k % 2 ? "is-odd" : ""}" style="animation-delay:${k * 70}ms">
        <rect x="${x0}" y="0" width="${x1 - x0}" height="${H}"/>
        <text x="${(x0 + x1) / 2}" y="13" text-anchor="middle" class="is-${tone}">${E.gzKo(d.gz)}</text>
        <text x="${(x0 + x1) / 2}" y="25" text-anchor="middle" class="age">${d.startAge}</text>
      </g>`;
    })
    .join("");
  const peakI = S.peakIdx / step;
  const px = x(peakI);
  const py = y(pts[Math.round(peakI)]);
  const peakYear = S.months[S.peakIdx].y;
  const bw = 112;
  const bx = px - bw - 10 > 4 ? px - bw - 10 : Math.min(W - bw - 4, px + 10);
  const zx0 = toX(S.drawdown.from);
  const zx1 = toX(S.drawdown.to);
  const nowT = S.tOf(TODAY);
  const nowX = toX(nowT);
  const nowY = y(S.basePrice(nowT));

  // 최근 16일 일봉
  const cs = [];
  for (let k = 15; k >= 0; k--) cs.push(S.candle(E.addDays(TODAY, -k)));
  const cmin = Math.min(...cs.map((c) => c.low));
  const cmax = Math.max(...cs.map((c) => c.high));
  const cy = (v) => top + 6 + (1 - (v - cmin) / (cmax - cmin)) * (H - top - bot - 12);
  const cstep = W / cs.length;
  const candles = cs
    .map((c, i) => {
      const cx = cstep * i + cstep / 2;
      const t = cy(Math.max(c.open, c.close));
      const h = Math.max(2, Math.abs(cy(c.open) - cy(c.close)));
      return `<g class="g-candle is-${c.close >= c.open ? "up" : "down"}" style="animation-delay:${i * 45}ms">
        <line x1="${cx}" x2="${cx}" y1="${cy(c.high)}" y2="${cy(c.low)}"/>
        <rect x="${cx - cstep * 0.3}" y="${t}" width="${cstep * 0.6}" height="${h}"/>
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
    return `<div class="term__day ${son ? "is-son" : ""}" style="animation-delay:${k * 60}ms">${o.m}/${o.d}<small>${son ? "손없음" : "음" + l.day}</small></div>`;
  }).join("");

  const nowP = S.dayPrice(TODAY);
  const listed = pct(nowP, E.START_PRICE);
  const tapeItems = [
    `${SAMPLE.name} ${S.code} <b class="${sign(listed)}">${arrow(listed)}${Math.abs(listed).toFixed(1)}%</b>`,
    `대운 <b>${E.gzKo(S.daeunAt(TODAY.y).gz)}</b>`,
    `세운 <b>${E.gzKo(E.yearGZ(TODAY.y))}</b>`,
    `ATH <b>${peakYear}</b>`,
    `일진 <b>${E.gzKo(E.dayGZ(TODAY.y, TODAY.m, TODAY.d))}</b>`,
    `${S.industry.el} <b>${S.industry.sector.split(" · ")[1]}</b>`,
  ];
  const tape = tapeItems.map((t) => `<span>${t}</span>`).join("");

  stage.innerHTML = `
  <div class="term" data-scene="0">
    <div class="term__status"><span class="term__live"><i></i>KRX 인생시장</span><span id="demoClock">${clock()}</span></div>
    <div class="tape-wrap"><div class="tape">${tape}${tape}</div></div>
    <div class="term__quote">
      <div class="term__name">${SAMPLE.name}<span id="demoCode"></span></div>
      <div class="term__meta">예시 종목</div>
      <div class="term__price"><span id="demoPrice"></span></div>
      <div class="term__chg ${sign(listed)}" id="demoChg">${arrow(listed)} ${pctText(listed, 1)}</div>
    </div>
    <div class="term__chart">
      <svg class="term__svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="예시 인생 주가 차트">
        <defs><linearGradient id="demoGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="g-stop1"/><stop offset="1" class="g-stop2"/></linearGradient></defs>
        <g class="g-chart">
          <g class="g-grid">${grid}</g>
          ${bands}
          <rect class="g-zone" x="${zx0}" y="${top}" width="${zx1 - zx0}" height="${H - top - bot}"/>
          <path class="g-area" d="${area}" fill="url(#demoGrad)"/>
          <path class="g-line" d="${line}" pathLength="1"/>
          <line class="g-now" x1="${nowX}" x2="${nowX}" y1="${top}" y2="${H - bot}"/>
          <circle class="g-nowdot" cx="${nowX}" cy="${nowY}" r="3"/>
          <g class="g-cross" id="demoCross"><line x1="0" x2="0" y1="${top - 4}" y2="${H - bot}"/><circle cx="0" cy="0" r="3.5"/></g>
          <g class="g-peak">
            <rect x="${bx}" y="${py - 9}" width="${bw}" height="18" rx="2"/>
            <text x="${bx + bw / 2}" y="${py + 4}" text-anchor="middle">🚀 사상 최고가 ${peakYear}</text>
          </g>
        </g>
        <g class="g-candles">${candles}</g>
      </svg>
      <div class="term__readout" id="demoReadout"></div>
    </div>
    <div class="term__days">${days}</div>
    <div class="term__flash"><b>속보</b><span class="term__flash-t" id="demoFlash"></span></div>
  </div>`;

  // 크로스헤어 위치 (월 인덱스) → SVG 좌표
  const crossTo = (mi) => {
    const g = stage.querySelector("#demoCross");
    if (!g) return;
    const i = Math.max(0, Math.min(S.price.length - 1, Math.round(mi)));
    const cx = toX(i);
    const cyy = y(S.price[i]);
    g.querySelector("line").setAttribute("x1", cx);
    g.querySelector("line").setAttribute("x2", cx);
    g.querySelector("circle").setAttribute("cx", cx);
    g.querySelector("circle").setAttribute("cy", cyy);
    const mo = S.months[i];
    $("#demoReadout").textContent = `${Math.floor(i / 12)}세 · ${mo.y}.${String(mo.m).padStart(2, "0")} · ${won(S.price[i])}`;
    return S.price[i];
  };
  return { S, nowP, nowT, crossTo };
}

function startIntro() {
  const root = $("#intro");
  const stage = root.querySelector(".intro__stage");
  let demo;
  try {
    demo = buildDemo(stage);
  } catch (e) {
    console.error(e);
    return;
  }
  const term = () => stage.querySelector(".term");
  const set = (n) => term() && (term().dataset.scene = String(n));
  // 캡션 = 단말기 하단 속보 줄 (제목+부제 대신 장면 안의 뉴스 플래시)
  const head = (text, say) => {
    const f = $("#demoFlash");
    const sr = $("#introSay");
    if (sr) sr.textContent = say || text;
    if (!f) return;
    f.textContent = text;
    kinetic(f, { step: 22 });
    const bar = f.parentElement;
    bar.classList.remove("is-in");
    void bar.offsetWidth;
    bar.classList.add("is-in");
  };
  const price = (v) => odometer($("#demoPrice"), `${won(v)}원`);
  const clk = setInterval(() => {
    const c = $("#demoClock");
    if (c) c.textContent = clock();
    else clearInterval(clk);
  }, 1000);
  flap($("#demoCode"), demo.S.code, { delay: 200 });
  price(E.START_PRICE);

  intro?.stop();
  intro = runIntro({
    root,
    loop: true,
    scenes: [
      {
        
        duration: 3600,
        play(_, signal) {
          head("생일 넣으면 인생 상장 · 0세 시가 10,000원", "생년월일시로 뽑은 사주 8글자가 0세 시가 10,000원짜리 평생 주가 차트가 돼요");
          set(0);
          price(E.START_PRICE);
          flap($("#demoCode"), demo.S.code, { delay: 120 });
          wait(700, signal).then(() => !signal.aborted && price(demo.nowP));
        },
      },
      {
        
        duration: 3600,
        play(_, signal) {
          head("대운 10년 = 추세 · 세운 1년 = 등락", "10년마다 바뀌는 대운이 추세를, 해마다 바뀌는 세운이 등락을 만들어요");
          set(1);
          // 크로스헤어가 0세부터 오늘까지 훑으며 시세를 읽어요
          let last = 0;
          wait(500, signal).then(() =>
            tween(
              2400,
              (t) => {
                const v = demo.crossTo(t * demo.nowT);
                const now = performance.now();
                if (v && now - last > 160) {
                  last = now;
                  price(v);
                }
              },
              { signal }
            ).then(() => !signal.aborted && price(demo.nowP))
          );
        },
      },
      {
        
        duration: 3400,
        play(_, signal) {
          head(`사상 최고가 ${demo.S.months[demo.S.peakIdx].y}년 · 조정 구간 표시`, "사상 최고가가 언제 오는지, 가장 크게 쉬어 가는 구간은 어디인지 짚어줘요");
          set(2);
          const from = demo.nowT;
          const to = demo.S.peakIdx;
          tween(
            700,
            (t) => {
              const v = demo.crossTo(from + (to - from) * t);
              if (t === 1 && v) price(v);
            },
            { ease: springEase, signal }
          );
        },
      },
      {
        
        duration: 3600,
        play() {
          head("오늘 일봉 공개 · 손 없는 날 표시", "매일 바뀌는 일진으로 그린 일봉과 손 없는 날, 나한테 맞는 길일을 챙겨줘요");
          set(3);
          price(demo.nowP);
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
    <div class="bell-bar"><span>KRX 인생시장 · 신규 상장 공시</span><span class="bell-bar__dings" aria-label="타종"><span>땡</span><span>땡</span><span>땡</span></span></div>
    <h2 class="ceremony__head" id="ceremonyHead">축 상장</h2>
    <div class="ticker-card">
      <div class="ticker-card__top"><span>종목코드</span><span class="ticker-card__code" id="ipoCode"></span></div>
      <div class="ticker-card__name" id="ipoName"></div>
      <p class="ticker-card__sector">${P.industry.el} · ${P.industry.sector}</p>
      <dl>
        <dt>상장일</dt><dd class="t-num">${ymdText(P.birth)}${P.input.cal === "lunar" ? " (양력)" : ""}</dd>
        <dt>일간 체질</dt><dd>${P.industry.el} · ${P.strengthLabel}</dd>
        <dt>첫 대운</dt><dd>${dy.startAge}세 ${E.gzKo(dy.gz)} (${dy.startYear}년)</dd>
        <dt>시가</dt><dd class="ticker-card__price"><span id="ipoPrice"></span></dd>
      </dl>
    </div>
    <p class="ceremony__msg">${P.industry.note}이에요.${P.timeKnown ? "" : " 태어난 시간을 몰라 시주는 빼고 계산했어요."}</p>
    <div class="tape-wrap"><div class="tape">${tape}${tape}</div></div>
    <button class="btn btn--primary btn--lg btn--block" id="toDash" type="button">첫 거래 시작하기</button>`;
  box.hidden = false;
  document.body.style.overflow = "hidden";
  haptic([30, 60, 30, 60, 80]);
  kinetic($("#ceremonyHead"), { step: 60 });
  flap($("#ipoCode"), P.code, { delay: 400, stagger: 60 });
  flap($("#ipoName"), P.name, { delay: 600, stagger: 70, cycles: 4 });
  odometer($("#ipoPrice"), "00,000원");
  setTimeout(() => odometer($("#ipoPrice"), "10,000원", { stagger: 80 }), 900);
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
  const colors = [C.amber || C.warn, C.text, C.up, C.down, C.text2];
  const w = (canvas.width = innerWidth);
  const h = (canvas.height = innerHeight);
  const ctx = canvas.getContext("2d");
  const parts = Array.from({ length: 140 }, (_, i) => ({
    x: Math.random() < 0.5 ? -10 : w + 10,
    y: h * (0.15 + Math.random() * 0.3),
    vx: 0,
    vy: -6 - Math.random() * 10,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.4,
    s: 5 + Math.random() * 6,
    c: colors[i % colors.length],
  }));
  // 양쪽에서 대포처럼 쏘아 올리는 티커 테이프
  parts.forEach((p) => (p.vx = (p.x < 0 ? 1 : -1) * (5 + Math.random() * 9)));
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
      ctx.fillRect(-p.s, -1.5, p.s * 2, 3);
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
  const yearOpen = P.dayPrice({ y: TODAY.y, m: 1, d: 1 });
  $("#quote").innerHTML = `
    <div class="quote__top">
      <span class="quote__name">${esc(P.name)}</span>
      <span class="quote__code" id="qCode"></span>
    </div>
    <div class="quote__sector">${P.industry.el} · ${P.industry.sector}</div>
    <div class="quote__price"><span id="qPrice"></span><small>원</small></div>
    <div class="quote__chg">${chg(now, prev)} <span class="t-tertiary t-label-03">전일 대비</span></div>
    <div class="quote__grid">
      <div><div class="kv-k">상장 후</div><div class="kv-v ${sign(now - 10000)}">${pctText(pct(now, 10000), 1)}</div></div>
      <div><div class="kv-k">올해</div><div class="kv-v ${sign(now - yearOpen)}">${pctText(pct(now, yearOpen), 1)}</div></div>
      <div><div class="kv-k">연속 확인</div><div class="kv-v amber">${ci.streak}일째</div></div>
    </div>`;
  flap($("#qCode"), P.code, { delay: 100 });
  odometer($("#qPrice"), won(prev));
  setTimeout(() => odometer($("#qPrice"), won(now)), 350);
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
      xTicks: [10, 20, 30, 40, 50, 60, 70, 80].map((a) => ({ i: a * 12, label: `${a}세` })),
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
  // 올해는 주봉(7일 간격 종가)으로 보여줘요. 오늘은 항상 포함.
  const days = [];
  let k = 0;
  for (let o = { y, m: 1, d: 1 }; o.y === y; o = E.addDays(o, 1), k++) {
    const isToday = o.m === TODAY.m && o.d === TODAY.d;
    if (k % 7 === 0 || isToday) days.push(o);
  }
  const vals = days.map((o) => P.dayPrice(o));
  const ti = days.findIndex((o) => o.m === TODAY.m && o.d === TODAY.d);
  let pk = 0;
  vals.forEach((v, i) => v > vals[pk] && (pk = i));
  return {
    height: 240,
    series: [{ values: vals, color: vals[vals.length - 1] >= vals[0] ? C.up : C.down, width: 2, fill: true, splitAt: ti }],
    markers: [
      { i: ti, kind: "today", label: "오늘" },
      { i: pk, kind: "peak", label: `🚀 올해 고점 ${days[pk].m}/${days[pk].d}` },
    ],
    xTicks: [1, 3, 5, 7, 9, 11].map((m) => ({ i: days.findIndex((o) => o.m === m), label: `${m}월` })),
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
    <div class="stat"><div class="stat__k">최대 조정 구간</div><div class="stat__v t-num down">${pctText(dd.depth * 100, 1)}</div><div class="stat__s">${Math.floor(
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
  $("#streakBadge").textContent = `${ci.streak}일 연속 확인`;
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

/* ---------- 생활 속 나 (2026-10-06) ----------
 * 사주 여덟 글자의 오행 개수를 십신 다섯 묶음(비겁·식상·재성·관성·인성) 비율로 바꾸고, 많음(30%↑)/적음(10%↓)/보통으로 나눠
 * 짐작과 진짜와 같은 문장 은행에서 영역마다 관련 깊은 묶음 순서로 한 줄씩 고른다. 같은 사람은 늘 같은 문장 */
const GROUPS = ["비겁", "식상", "재성", "관성", "인성"];
function lifeLines() {
  const g = [0, 0, 0, 0, 0];
  P.counts.forEach((c, el) => (g[P.rel(el)] += c));
  const tot = g.reduce((a, b) => a + b, 0) || 1;
  const lv = {};
  GROUPS.forEach((k, i) => (lv[k] = g[i] / tot >= SAJU_H ? "H" : g[i] / tot < SAJU_L ? "L" : "M"));
  const seed = hashString(`${P.code}:life`);
  return Object.keys(SAJU_TITLE).map((area, ai) => ({
    area,
    lines: SAJU_REL[area]
      .map((grp, gi) => {
        const o = SAJU_LIFE[area]?.[grp]?.[lv[grp]];
        const pool = o ? [].concat(o.soft || [], o.hard || []).filter(Boolean) : [];
        return pool.length ? pool[(seed + ai * 7 + gi * 3) % pool.length] : null;
      })
      .filter(Boolean),
  }));
}
function lifeHTML() {
  const L = lifeLines();
  return `<h3>생활 속 ${esc(P.name)} <span class="t-label-03 t-tertiary">· 이거 완전 나</span></h3>
    <div class="life">${L.map((b) => `<div class="life__b"><b>${SAJU_TITLE[b.area]}</b><ul>${b.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></div>`).join("")}</div>`;
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
      const col = s.series[s.series.length - 1] >= s.series[0] ? C.up : C.down; // 10년 추세 방향
      return `<div class="sector">
        <div class="sector__top"><span class="sector__name">${s.name} <span class="t-tertiary t-label-03">${s.god}</span></span><span class="sector__d t-num ${sign(s.delta)}">${arrow(s.delta)}${Math.abs(
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
    <div class="report__mast"><span class="fn"><b>ANR</b>리서치센터</span><span class="t-num">기업분석 · ${ymdText(TODAY)}</span></div>
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
    <h3>한눈에 해석 <span class="t-label-03 t-tertiary">· 왜 이렇게 나왔고, 그래서 어떻게</span></h3>
    <div class="rd">${readingHTML(readMe(P, R, TODAY), esc)}</div>
    ${lifeHTML()}
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
    <div class="legend"><span><i class="lg-up"></i>유리한 오행</span><span><i class="lg-down"></i>불리한 오행</span><span><i class="lg-neutral"></i>중립</span></div>
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
  const tag = (k) => { const p = E.PURPOSES.find((q) => q.key === k); return `<span class="tag tag--${k}" title="${p.name}">${p.name[0]}</span>`; };
  const monthsAhead = (y - TODAY.y) * 12 + (m - TODAY.m);
  const cells = [];
  for (let i = 0; i < first; i++) cells.push("<span></span>");
  days.forEach((x, i) => {
    const t = E.utc(y, m, x.d).getTime();
    const cls = [x.son && "is-son", t < todayT && "is-past", t === todayT && "is-today"].filter(Boolean).join(" ");
    const lunar = x.son ? "손없음" : `${x.lun.day === 1 ? Math.abs(x.lun.month) + "." : ""}${x.lun.day}`;
    cells.push(`<button type="button" class="cal__day ${cls}" data-i="${i}" aria-label="${m}월 ${x.d}일${x.son ? " 손 없는 날" : ""}">
      <span class="cal__n t-num">${x.d}</span><span class="cal__l t-num">${lunar}</span><span class="cal__marks">${x.good.map(tag).join("")}</span></button>`);
  });
  const sons = days.filter((x) => x.son);
  const picks = prof
    ? `<div class="cal__picks">${E.PURPOSES.map((p) => {
        const ds = days.filter((x) => x.good.includes(p.key)).map((x) => `${x.d}일`);
        return `<div class="pick"><b>${tag(p.key)} ${p.name}</b><span>${ds.length ? ds.join(", ") : "이번 달은 쉬어 가요"}</span></div>`;
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
      prof ? E.PURPOSES.map((p) => `<span>${tag(p.key)} ${p.name}</span>`).join("") : ""
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
    const names = x.good.map((k) => E.PURPOSES.find((p) => p.key === k)).map((p) => p.name);
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
    text: `${P.name} 주식이 상장했어요. 내 인생 사상 최고가는 ${P.months[P.peakIdx].y}년! 우리 합병하면 시너지 몇 %일까요?`,
    url: maLink(),
  });
  if (r === "shared") toast("제안서를 보냈어요");
}

/* M&A 궁합 생활 장면 (2026-10-06): 두 사람 일간 오행 관계(같음 / 살려 줌 / 다잡음)와 부족한 기운 채움을 연인·친구·동료 장면으로 */
function maScenesHTML(B, M) {
  const rel = RELS[store.get("maRel", "love")] ? store.get("maRel", "love") : "love";
  const d = (((B.dmEl - P.dmEl) % 5) + 5) % 5;   // 0 같음, 1 내가 살려 줌, 4 상대가 살려 줌, 2 내가 다잡음, 3 상대가 다잡음
  const [type, X, Y] = d === 0 ? ["same", P.name, B.name] : d === 1 ? ["gen", P.name, B.name] : d === 4 ? ["gen", B.name, P.name] : d === 2 ? ["ctrl", P.name, B.name] : ["ctrl", B.name, P.name];
  const pool = BANK[rel][type];
  const seed = hashString(`${P.code}|${B.name}|${B.y}${B.m}${B.d}`);
  const picks = [0, 1, 2].map((k) => pool[(seed + k) % pool.length]).filter((v, i, a) => a.indexOf(v) === i);
  const fills = M.fills.slice(0, 2).map((f) => {
    const [lack, give] = f.to === "A" ? [P.name, B.name] : [B.name, P.name];
    return FILL[f.el]?.[rel] ? fillLine(FILL[f.el][rel], lack, give) : null;
  }).filter(Boolean);
  const bi = M.synergy >= 25 ? 0 : M.synergy >= 10 ? 1 : M.synergy >= -5 ? 2 : 3;
  const lines = [...picks.map((l) => fillLine(l, X, Y)), ...fills];
  return `<div class="ma__rel" role="group" aria-label="어떤 사이인가요">${Object.entries(RELS)
    .map(([k, v]) => `<button type="button" class="chip" data-marel="${k}" aria-pressed="${k === rel}">${v}</button>`)
    .join("")}</div>
    <p class="ma__band">${esc(BAND[rel][bi])}</p>
    <div class="rd">${readingHTML(readPair(P, B, M, rel, TODAY), esc)}</div>
    <h3 class="ma__h3">${RELS[rel]}로 같이 있으면</h3>
    <ul class="ma__scene">${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`;
}

let maChart;
function renderMA() {
  const el = $("#sec-ma");
  if (!partner) {
    el.innerHTML = `
      <div class="panel__head"><div><span class="fn"><b>M&amp;A</b>Merger</span><h2>M&amp;A 궁합</h2></div></div>
      <div class="ma__empty">
        <p class="t-body-02-strong">친구 종목과 합병해 볼까요?</p>
        <p class="t-body-03 t-secondary">링크를 받은 친구가 자기 생일을 넣으면 두 사람의 평생 차트를 겹쳐 보고 합병 시너지를 계산해요. 링크에는 내 생년월일시가 담겨요.</p>
        <button class="btn btn--primary btn--block" type="button" id="maSend">M&amp;A 제안 링크 보내기</button>
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
  why.push(`${esc(B.name)}의 일간 ${josa(B.industry.el, "은", "는")} ${esc(P.name)}에게 ${fv(P, B)} 기운, ${esc(P.name)}의 ${josa(P.industry.el, "은", "는")} ${esc(B.name)}에게 ${fv(B, P)} 기운이에요.`);
  M.fills.slice(0, 2).forEach((f) => {
    const [x, y] = f.to === "A" ? [P, B] : [B, P];
    why.push(`${esc(x.name)}에게 부족한 ${josa(E.elLabel(f.el), "을", "를")} ${josa(esc(y.name), "이", "가")} 채워줘요.`);
  });
  const tone = M.label.tone;
  el.innerHTML = `
    <div class="panel__head"><div><span class="fn"><b>M&amp;A</b>Merger</span><h2>M&amp;A 궁합</h2></div><span class="t-label-03 t-tertiary">${esc(P.name)} × ${esc(B.name)}</span></div>
    <div class="ma__hero">
      <div><div class="t-label-02 t-secondary">합병 시너지</div>
      <div class="ma__syn t-num ${tone === "flat" ? "flat" : sign(M.synergy)}">${M.synergy > 0 ? "+" : ""}${M.synergy}%</div></div>
      <span class="badge ma__label is-${tone}">${M.label.t}</span>
    </div>
    <div class="chart-wrap"><canvas id="maChart" aria-label="두 종목 겹쳐 보기"></canvas><div class="chart-tip" id="maTip" hidden></div></div>
    <div class="legend"><span><i class="lg-up"></i>${esc(P.name)}</span><span><i class="lg-amber"></i>${esc(
      B.name
    )}</span><span>${from}년=100 기준</span></div>
    ${maScenesHTML(B, M)}
    <h3 class="ma__h3">숫자로 보면</h3>
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
  $$("[data-marel]").forEach((b) => b.addEventListener("click", () => { store.set("maRel", b.dataset.marel); renderMA(); }));
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
  const MONO = C.mono || "monospace";
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  // 카드
  ctx.fillStyle = C.surface;
  roundRect(ctx, 24, 24, W - 48, H - 48, 8);
  ctx.fill();
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  const X = 52;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = C.amber || C.warn;
  ctx.font = `700 15px ${MONO}`;
  ctx.fillText("KRX 인생시장 · 나 상장하기", X, 72);
  ctx.fillStyle = C.text3;
  ctx.textAlign = "right";
  ctx.font = `700 15px ${MONO}`;
  ctx.fillText(`${P.code}`, W - X, 72);
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
  ctx.font = `700 52px ${MONO}`;
  const priceText = `${won(R.nowPrice)}원`;
  ctx.fillText(priceText, X, 226);
  ctx.fillStyle = p >= 0 ? C.up : C.down;
  ctx.font = `700 19px ${MONO}`;
  ctx.fillText(`${arrow(p)} ${pctText(p)} 오늘   ·   상장 후 ${pctText(pct(R.nowPrice, 10000), 1)}`, X, 260);

  // 미니 차트
  const cx0 = X;
  const cy0 = 292;
  const cw = W - 2 * X;
  const ch = 190;
  ctx.fillStyle = C.sunken;
  roundRect(ctx, cx0, cy0, cw, ch, 4);
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
  roundRect(ctx, lx, py(vals[pk]) - 32, lw, 22, 3);
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
  ctx.font = `700 26px ${MONO}`;
  ctx.fillText(`${op.code}`, X, oy + 48);
  ctx.fillStyle = C.text;
  ctx.fillText(`${won(R.target)}`, X + 160, oy + 48);
  ctx.fillText(R.cur.pre ? "대운 전" : `${E.gzKo(R.cur.gz)}`, X + 320, oy + 48);

  ctx.fillStyle = C.text3;
  ctx.font = `500 12px ${F}`;
  ctx.fillText("재미로 보는 콘텐츠예요 · 사주 대운·세운으로 그린 가상의 주가", X, H - 72);
  ctx.fillStyle = C.text2;
  ctx.font = `700 12px ${MONO}`;
  ctx.fillText(`${location.host || "example.com"}/life-stock`, X, H - 52);
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

/* ---------- SEO 투자설명서: 예시 대운표와 이번 달 손 없는 날을 실제 계산으로 ---------- */
function renderSeo() {
  try {
    const S = E.analyze(SAMPLE);
    const at = (age) => S.price[Math.min(S.price.length - 1, age * 12)];
    $("#exPillars").textContent = S.pillars.map(E.gzKo).join(" · ");
    $("#exDm").textContent = `${E.stemKo(S.dm)}${E.EL_KO[S.dmEl]}(${E.STEMS[S.dm]}${E.EL_HANJA[S.dmEl]})`;
    $("#exStrength").textContent = S.strengthLabel;
    $("#daeunEx tbody").innerHTML = S.daeun
      .filter((d) => d.startAge <= 86)
      .map((d) => {
        const a = at(d.startAge);
        const b = at(d.endAge + 1);
        const c = pct(b, a);
        return `<tr><th scope="row">${E.gzKo(d.gz)}${d.pre ? "<small>대운 전</small>" : ""}</th><td>${d.startAge}–${d.endAge}</td><td>${d.startYear}–${d.endYear}</td><td>${won(a)} → ${won(b)}</td><td class="${sign(c)}">${arrow(c)}${Math.abs(c).toFixed(1)}%</td></tr>`;
      })
      .join("");
    const pk = S.months[S.peakIdx];
    $("#daeunNote").textContent = `구간 주가는 대운 첫 달과 다음 대운 첫 달의 종가예요. 사상 최고가 ${pk.y}년 ${pk.m}월(${Math.floor(S.peakIdx / 12)}세) ${won(S.price[S.peakIdx])}원.`;
  } catch (e) {
    console.warn(e);
  }
  try {
    const { y, m } = TODAY;
    const rows = [];
    for (let d = 1; d <= E.daysInMonth(y, m); d++) {
      const l = E.lunarOf(y, m, d);
      if (!E.isSonEomneun(l.day)) continue;
      const wd = DOW[E.utc(y, m, d).getUTCDay()];
      rows.push(`<tr${d === TODAY.d ? ' class="is-today"' : ""}><th scope="row">${m}.${d}</th><td>${wd}</td><td>${l.leap ? "윤" : ""}${Math.abs(l.month)}.${l.day}</td></tr>`);
    }
    $("#sonTitle").textContent = `${y}년 ${m}월 손 없는 날`;
    $("#sonMonth tbody").innerHTML = rows.join("");
    $("#sonNote").textContent = `만세력으로 매일의 음력을 계산했어요. 이번 달은 ${rows.length}일이에요. 음력 작은달(29일)이 끼면 5일, 아니면 보통 6일이에요.`;
    $("#filingDate").textContent = ymdText(TODAY);
  } catch (e) {
    console.warn(e);
  }
}

// 하단 다른 도구 링크 → 단말기 '관련 종목' 관심종목 창
function dressWatchlist(el) {
  if (!el) return;
  el.classList.add("wl");
  el.setAttribute("aria-label", "관련 종목");
  const title = el.querySelector(".more-sites__title");
  if (title) {
    title.innerHTML = `<span class="fn"><b>WL</b>Watchlist</span><span class="wl__t">관련 종목<i class="wl__cur" aria-hidden="true"></i></span>`;
    title.insertAdjacentHTML(
      "afterend",
      `<div class="wl__head" aria-hidden="true"><span>코드</span><span>종목 · 개요</span><span>이동</span></div>`
    );
  }
  $$(".more-sites__item", el).forEach((a, i) => {
    const body = document.createElement("span");
    body.className = "wl__body";
    body.append(...a.querySelectorAll(".more-sites__name, .more-sites__desc"));
    a.prepend(Object.assign(document.createElement("span"), { className: "wl__code", textContent: `R${String(i + 1).padStart(2, "0")}` }));
    a.append(body);
    a.insertAdjacentHTML("beforeend", `<span class="wl__go" aria-hidden="true">GO</span>`);
    a.style.setProperty("--i", i);
  });
  if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
    el.classList.add("is-in");
    return;
  }
  const io = new IntersectionObserver((ents) => {
    if (ents.some((e) => e.isIntersecting)) {
      el.classList.add("is-in");
      io.disconnect();
    }
  }, { threshold: 0.3 });
  io.observe(el);
}

function init() {
  renderMoreSites($("#more"));
  dressWatchlist($("#more"));
  renderSeo();
  initForm();

  // 매수 주문표: 누르면 '체결' 도장이 찍히고 다음 화면으로
  $("#start").addEventListener("click", (e) => {
    const b = e.currentTarget;
    if (b.classList.contains("is-filled")) return;
    haptic(16);
    b.classList.add("is-filled");
    setTimeout(() => {
      b.classList.remove("is-filled");
      if (P) showDash();
      else goForm();
    }, prefersReducedMotion() ? 0 : 360);
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
      toast(`${TODAY.m}월 ${TODAY.d}일 시세가 나왔어요`);
    }
    return;
  }
  if (incoming) {
    const inv = $("#maInvite");
    inv.hidden = false;
    inv.innerHTML = `<b>${esc(incoming.name)}님이 M&amp;A를 제안했어요</b><span>내 주식을 상장하면 두 차트를 겹쳐 합병 시너지를 볼 수 있어요.</span>`;
    $("#startLabel").textContent = "상장하고 합병 보기";
  }
  goIntro();
}

init();
