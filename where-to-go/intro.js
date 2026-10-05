// 첫 화면 모션그래픽 — 지하철 노선도·역명판·발차 안내판 장르
// 1) 노선이 그려지고 세 역(신촌·왕십리·사당)에 핀이 눌렸다 튀며 떨어짐
// 2) 각자의 경로가 그려지며 중간역(이태원)에서 만남 + 역명판 리빌
// 3) 발차 안내판에 후보가 플랩처럼 뜨고, 노선도식 대진선이 그려짐
// 4) 대진 진행 노선 + 두 역명판에 표가 쌓이고(3표 vs 1표) → 예비동작 → 충돌 → 패자 탈선 → 왕관
// 설계 좌표는 340×500 (지도 456 + 안내 띠 44). 무대 크기에 맞춰 통째로 확대·축소한다.
import { runIntro, prefersReducedMotion } from "../shared/kit.js";

export const SPRING =
  "linear(0, 0.161, 0.362, 0.577, 0.781, 0.959, 1.1, 1.199, 1.258, 1.279, 1.269, 1.237, 1.19, 1.136, 1.082, 1.033, 0.992, 0.961, 0.941, 0.931, 0.929, 0.935, 0.945, 0.958, 0.972, 0.985, 0.997, 1.006, 1.013, 1.017, 1.018, 1.018, 1.015, 1.012, 1.009, 1.006, 1.002, 1, 0.998, 0.996, 1)";
export const SPRING_SOFT =
  "linear(0, 0.185, 0.368, 0.538, 0.688, 0.813, 0.912, 0.988, 1.041, 1.075, 1.094, 1.101, 1.099, 1.091, 1.08, 1.066, 1.052, 1.039, 1.027, 1.017, 1.009, 1.003, 0.998, 0.995, 0.993, 0.993, 0.993, 0.993, 0.994, 0.995, 0.996, 0.997, 0.998, 0.998, 0.999, 1, 1)";
const IN_OUT = "cubic-bezier(0.65, 0, 0.35, 1)";
const FALL = "cubic-bezier(0.55, 0, 1, 0.45)";
const OUT = "cubic-bezier(0.16, 1, 0.3, 1)";

const W = 340;
const MAPH = 456;
const HT = 500;
// 실제 위치 관계를 단순화한 좌표 (신촌·왕십리·사당은 2호선, 이태원은 6호선)
const PINS = [
  { x: 56, y: 170, name: "지민", st: "신촌", line: "sb", tag: "left" },
  { x: 290, y: 140, name: "도윤", st: "왕십리", line: "l4", tag: "right" },
  { x: 150, y: 364, name: "나", st: "사당", line: "l2", tag: "below" },
];
const MID = { x: 184, y: 220 };
// 직선거리 근사치 (geo.js 계산과 같은 방식)
const KM = [
  { t: "5.6km", x: 132, y: 238 },
  { t: "4.8km", x: 250, y: 160 },
  { t: "6.5km", x: 216, y: 300 },
];
// 지도에 찍힌 다른 역 (분위기용 실제 2호선·4호선·6호선 역)
const STOPS = [
  { x: 150, y: 96, t: "시청", dx: 0, dy: -12, a: "middle" },
  { x: 230, y: 96, t: "동대문역사문화공원", dx: 0, dy: -12, a: "middle", hide: true },
  { x: 290, y: 300, t: "잠실", dx: 12, dy: 4, a: "start" },
  { x: 246, y: 364, t: "강남", dx: 0, dy: 20, a: "middle" },
  { x: 56, y: 290, t: "합정", dx: -10, dy: 4, a: "end" },
  { x: 176, y: 48, t: "혜화", dx: 12, dy: 4, a: "start" },
  { x: 140, y: 300, t: "동작", dx: -10, dy: 4, a: "end" },
  { x: 290, y: 220, t: "약수", dx: 12, dy: 4, a: "start", onLine: "l6" },
];
const CANDS = [
  ["한", "l2", "김치찌개", "국물"],
  ["아", "l7", "쌀국수", "국물"],
  ["일", "l4", "돈까스", "든든"],
  ["중", "sb", "마라탕", "매운"],
  ["양", "l3", "파스타", "가벼운"],
  ["한", "l2", "제육볶음", "매운"],
  ["일", "l4", "초밥", "₩₩₩"],
  ["양", "l3", "수제버거", "든든"],
];
const ROW0 = 104;
const ROWH = 40;
const STRIP = [
  { x: 52, t: "8강", s: "done" },
  { x: 130, t: "4강", s: "done" },
  { x: 208, t: "결승", s: "now" },
  { x: 286, t: "1위", s: "goal" },
];

// 대각선(45°) 먼저, 그다음 직선으로 가는 경로
function routePath(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.min(Math.abs(dx), Math.abs(dy));
  const cx = a.x + Math.sign(dx) * d;
  const cy = a.y + Math.sign(dy) * d;
  return `M${a.x} ${a.y} L${cx} ${cy} L${b.x} ${b.y}`;
}

function bracketPaths() {
  const out = [];
  const ys = CANDS.map((_, i) => ROW0 + i * ROWH);
  const x0 = 256, x1 = 274, x2 = 292, x3 = 310;
  const mids1 = [];
  for (let i = 0; i < 8; i += 2) {
    const m = (ys[i] + ys[i + 1]) / 2;
    mids1.push(m);
    out.push({ d: `M${x0} ${ys[i]} H${x1 - 6} Q${x1} ${ys[i]} ${x1} ${ys[i] + 6} V${m}`, c: CANDS[i][1] });
    out.push({ d: `M${x0} ${ys[i + 1]} H${x1 - 6} Q${x1} ${ys[i + 1]} ${x1} ${ys[i + 1] - 6} V${m}`, c: CANDS[i + 1][1] });
  }
  const mids2 = [];
  for (let k = 0; k < 4; k += 2) {
    const m = (mids1[k] + mids1[k + 1]) / 2;
    mids2.push(m);
    out.push({ d: `M${x1} ${mids1[k]} H${x2} V${m}`, c: "l2" });
    out.push({ d: `M${x1} ${mids1[k + 1]} H${x2} V${m}`, c: "l2" });
  }
  const fin = (mids2[0] + mids2[1]) / 2;
  out.push({ d: `M${x2} ${mids2[0]} H${x3} V${fin}`, c: "l2" });
  out.push({ d: `M${x2} ${mids2[1]} H${x3} V${fin}`, c: "l2" });
  return { paths: out, dots: [...mids1.map((y) => [x1, y]), ...mids2.map((y) => [x2, y])], fin: [x3, fin] };
}

// 노선 끝(종점) 표시: 선 끝에 짧은 가로막대
const term = (x, y, vertical) =>
  vertical ? `<path class="wi-term" d="M${x - 9} ${y} H${x + 9}"/>` : `<path class="wi-term" d="M${x} ${y - 9} V${y + 9}"/>`;

function build(stage) {
  const br = bracketPaths();
  stage.innerHTML = `
  <div class="wi">
    <svg class="wi-svg" viewBox="0 0 ${W} ${MAPH}" aria-hidden="true">
      <defs><clipPath id="wiClip"><rect width="${W}" height="${MAPH}"/></clipPath></defs>
      <g clip-path="url(#wiClip)">
      <rect class="wi-bg" width="${W}" height="${MAPH}"/>
      <g class="wi-map">
        <path class="wi-river" d="M-10 246 C 60 232, 130 272, 210 258 S 310 236, 350 244 L 350 282 C 300 272, 250 300, 190 296 S 60 272, -10 290 Z"/>
        <text class="wi-river__t" x="262" y="282" text-anchor="middle">한강</text>
        <path class="wi-ln" style="--l: var(--art-l4)" pathLength="1" d="M176 30 V150 L140 186 V300 L176 336 V430"/>
        <path class="wi-ln" style="--l: var(--art-l6)" pathLength="1" d="M26 196 H112 L136 220 H314"/>
        <path class="wi-ln wi-ln--main" style="--l: var(--art-l2)" pathLength="1" d="M100 96 H246 Q290 96 290 140 V320 Q290 364 246 364 H100 Q56 364 56 320 V140 Q56 96 100 96 Z"/>
        <g class="wi-terms">${term(176, 30, true)}${term(176, 430, true)}${term(26, 196, false)}${term(314, 220, false)}</g>
        <g class="wi-stations">
          ${STOPS.filter((s) => !s.hide).map((s) => `<circle class="wi-stop" cx="${s.x}" cy="${s.y}" r="4.5"/>`).join("")}
          ${PINS.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="6.5"/>`).join("")}
          <circle cx="${MID.x}" cy="${MID.y}" r="5.5"/>
        </g>
        <g class="wi-stl">
          ${STOPS.filter((s) => !s.hide).map((s) => `<text x="${s.x + s.dx}" y="${s.y + s.dy}" text-anchor="${s.a}">${s.t}</text>`).join("")}
        </g>
        <g transform="translate(78 96)"><circle class="wi-linebadge" style="--l: var(--art-l2)" r="10"/><text class="wi-linelabel" y="4" text-anchor="middle">2</text></g>
        <g transform="translate(176 66)"><circle class="wi-linebadge" style="--l: var(--art-l4)" r="10"/><text class="wi-linelabel" y="4" text-anchor="middle">4</text></g>
        <g transform="translate(60 196)"><circle class="wi-linebadge" style="--l: var(--art-l6)" r="10"/><text class="wi-linelabel" y="4" text-anchor="middle">6</text></g>
      </g>
      <g class="wi-legs">
        ${PINS.map((p) => `<path class="wi-leg-case" pathLength="1" d="${routePath(p, MID)}"/>`).join("")}
        ${PINS.map((p) => `<path class="wi-leg" pathLength="1" style="--l: var(--art-${p.line})" d="${routePath(p, MID)}"/>`).join("")}
      </g>
      <g class="wi-kms">
        ${KM.map((k) => `<g transform="translate(${k.x} ${k.y})"><g class="wi-km"><rect x="-25" y="-11" width="50" height="22" rx="4"/><text y="4.5" text-anchor="middle">${k.t}</text></g></g>`).join("")}
      </g>
      <g transform="translate(${MID.x} ${MID.y})"><g class="wi-xfer"><circle r="12"/><circle class="wi-xfer__in" r="4"/></g></g>

      <g class="wi-board">
        <rect class="wi-board__bg" x="12" y="24" width="${W - 24}" height="${MAPH - 40}" rx="12"/>
        <text class="wi-board__h" x="28" y="56">이태원 근처 · 후보 8</text>
        <text class="wi-board__h wi-board__h--r" x="${W - 28}" y="56" text-anchor="end">대진</text>
        <path class="wi-board__rule" d="M12 72 H${W - 12}"/>
        ${CANDS.map(([g, l, n, t], i) => `
          <g transform="translate(28 ${ROW0 + i * ROWH})"><g class="wi-row">
            <circle r="11" cx="11" style="fill: var(--art-${l})"/><text class="wi-row__g" x="11" y="4" text-anchor="middle">${g}</text>
            <text class="wi-row__n" x="32" y="6">${n}</text>
            <text class="wi-row__t" x="220" y="5" text-anchor="end">${t}</text>
          </g></g>`).join("")}
        <g class="wi-br">
          ${br.paths.map((p) => `<path pathLength="1" style="--l: var(--art-${p.c})" d="${p.d}"/>`).join("")}
          ${br.dots.map(([x, y]) => `<g transform="translate(${x} ${y})"><circle class="wi-br__dot" r="4.5"/></g>`).join("")}
          <g transform="translate(${br.fin[0]} ${br.fin[1]})"><circle class="wi-br__fin" r="8"/></g>
        </g>
      </g>

      <g class="wi-strip">
        <path class="wi-strip__track" d="M${STRIP[0].x} 52 H${STRIP[3].x}"/>
        <path class="wi-strip__done" pathLength="1" d="M${STRIP[0].x} 52 H${STRIP[2].x}"/>
        <path class="wi-strip__win" pathLength="1" d="M${STRIP[2].x} 52 H${STRIP[3].x}"/>
        ${STRIP.map((s) => `<g transform="translate(${s.x} 52)"><circle class="wi-strip__st wi-strip__st--${s.s}" r="${s.s === "goal" ? 11 : 9}"/></g>`).join("")}
        ${STRIP.map((s) => `<text class="wi-strip__t" x="${s.x}" y="82" text-anchor="middle">${s.t}</text>`).join("")}
      </g>
      </g>
    </svg>

    ${PINS.map((p, i) => `
      <div class="wi-pin" data-i="${i}" style="left:${p.x}px; top:${p.y}px; --l: var(--art-${p.line})">
        <span class="wi-pin__shadow"></span>
        <span class="wi-pin__body"><span class="wi-pin__head">${p.name.slice(0, 1)}</span></span>
        <span class="wi-tag wi-tag--${p.tag}"><b>${p.name}</b>${p.st}</span>
      </div>`).join("")}

    <div class="wi-sign" style="left:${MID.x}px; top:${MID.y + 20}px">
      <span class="wi-sign__lb">6</span><b>이태원</b><span class="wi-sign__sub">중간역</span>
    </div>

    <div class="wi-duel wi-duel--a" style="--l: var(--art-l2)">
      <span class="wi-duel__top"><span class="wi-duel__lb">한</span>한식 · ₩</span>
      <b>김치찌개</b>
      <span class="wi-duel__bar"><span>국물 · 매운</span><span class="wi-tally" data-side="0">0표</span></span>
      <span class="wi-vote" style="left: 62%">+1</span><span class="wi-vote" style="left: 74%">+1</span><span class="wi-vote" style="left: 86%">+1</span>
    </div>
    <div class="wi-duel wi-duel--b" style="--l: var(--art-l7)">
      <span class="wi-duel__top"><span class="wi-duel__lb">아</span>아시안 · ₩</span>
      <b>쌀국수</b>
      <span class="wi-duel__bar"><span>국물 · 가벼운</span><span class="wi-tally" data-side="1">0표</span></span>
      <span class="wi-vote" style="left: 80%">+1</span>
    </div>
    <div class="wi-vs">VS</div>
    <div class="wi-crown">👑</div>
    <div class="wi-spark">${Array.from({ length: 8 }, () => "<i></i>").join("")}</div>
    <div class="wi-go">카카오맵에서 열기 →</div>
    <div class="wi-led" aria-hidden="true"><span class="wi-led__dot"></span><span class="wi-led__txt"></span></div>
  </div>`;
  return stage.querySelector(".wi");
}

// 헤드라인만 글자 단위로 튀어 오름 (본문은 고정). 단어 단위로 줄바꿈되고, 세로 방향만 가린다.
function kinetic(root, reduce) {
  const h = root.querySelector(".intro__caption h2");
  if (!h || reduce) return;
  const text = h.textContent;
  h.innerHTML = text
    .split(" ")
    .map((w) => `<span class="kw">${[...w].map((c) => `<span class="kc">${c}</span>`).join("")}</span>`)
    .join(" ");
  h.querySelectorAll(".kc").forEach((c, i) => {
    c.animate(
      [
        { transform: "translateY(100%) scaleY(1.35)" },
        { transform: "translateY(0) scaleY(1)" },
      ],
      { duration: 720, delay: i * 28, easing: SPRING, fill: "backwards" }
    );
  });
}

export function startIntro(root) {
  const stage = root.querySelector(".intro__stage");
  const wi = build(stage);
  const q = (s) => wi.querySelector(s);
  const qa = (s) => Array.from(wi.querySelectorAll(s));
  const reduce = prefersReducedMotion();
  let live = [];
  let timers = [];

  // 무대(남는 세로 공간)에 맞춰 카드 전체를 확대·축소
  const fit = () => {
    const s = Math.min(stage.clientWidth / W, stage.clientHeight / HT);
    if (s > 0) wi.style.transform = `scale(${s})`;
  };
  fit();
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(fit) : null;
  ro?.observe(stage);

  const A = (el, frames, opts) => {
    if (!el) return null;
    const a = el.animate(frames, { fill: "both", easing: OUT, ...opts, duration: reduce ? 1 : opts.duration, delay: reduce ? 0 : opts.delay || 0 });
    live.push(a);
    return a;
  };
  const later = (fn, ms) => timers.push(setTimeout(fn, reduce ? 0 : ms));
  const clear = (scene) => {
    live.forEach((a) => a.cancel());
    live = [];
    timers.forEach(clearTimeout);
    timers = [];
    wi.dataset.scene = scene;
  };
  const draw = (el, delay, duration = 700, easing = IN_OUT) =>
    A(el, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration, delay, easing });
  const pop = (el, delay, duration = 600) => A(el, [{ transform: "scale(0)" }, { transform: "scale(1)" }], { duration, delay, easing: SPRING });

  const led = (text) => {
    const t = q(".wi-led__txt");
    t.textContent = text;
    A(t, [{ transform: "translateX(110%)" }, { transform: "translateX(0)" }], { duration: 900, delay: 150, easing: SPRING_SOFT });
    A(q(".wi-led__dot"), [{ opacity: 1 }, { opacity: 0.2 }, { opacity: 1 }], { duration: 700, iterations: reduce ? 1 : 5, easing: "steps(2, jump-none)" });
  };
  const dropPin = (pin, delay) => {
    const body = pin.querySelector(".wi-pin__body");
    A(body, [
      { transform: "translateY(-200px) scale(0.92, 1.12)", opacity: 0, offset: 0 },
      { transform: "translateY(-180px) scale(0.92, 1.12)", opacity: 1, offset: 0.08, easing: FALL },
      { transform: "translateY(0) scale(0.86, 1.22)", offset: 0.42 },
      { transform: "translateY(0) scale(1.38, 0.62)", offset: 0.5, easing: OUT },
      { transform: "translateY(-26px) scale(0.9, 1.12)", offset: 0.66, easing: "cubic-bezier(0.5, 0, 0.75, 0)" },
      { transform: "translateY(0) scale(1.14, 0.86)", offset: 0.8, easing: OUT },
      { transform: "translateY(-4px) scale(0.98, 1.02)", offset: 0.9 },
      { transform: "translateY(0) scale(1, 1)", opacity: 1, offset: 1 },
    ], { duration: 1000, delay, easing: "ease" });
    A(pin.querySelector(".wi-pin__shadow"), [
      { transform: "translateX(-50%) scale(0.2)", opacity: 0 },
      { transform: "translateX(-50%) scale(1.5)", opacity: 0.35, offset: 0.5 },
      { transform: "translateX(-50%) scale(1)", opacity: 0.25 },
    ], { duration: 900, delay: delay + 120 });
    A(pin.querySelector(".wi-tag"), [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], { duration: 420, delay: delay + 560 });
  };

  const scenes = [
    {
      title: "출발역만 찍으면",
      desc: "친구마다 있는 역이나 내 위치를 넣어요",
      duration: 3100,
      play() {
        clear("1");
        kinetic(root, reduce);
        led("출발 · 신촌 · 왕십리 · 사당");
        qa(".wi-ln").forEach((p, i) => draw(p, i * 140, 1000));
        A(q(".wi-terms"), [{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 900 });
        qa(".wi-stations circle").forEach((c, i) => A(c, [{ opacity: 0 }, { opacity: 1 }], { duration: 160, delay: 600 + i * 40 }));
        A(q(".wi-stl"), [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 900 });
        qa(".wi-pin").forEach((pin, i) => dropPin(pin, 900 + i * 230));
      },
    },
    {
      title: "딱 중간역이 나와요",
      desc: "신촌·왕십리·사당이면 이태원이에요",
      duration: 3300,
      play() {
        clear("2");
        kinetic(root, reduce);
        led("이번 역은 이태원, 중간역입니다");
        qa(".wi-leg-case").forEach((p, i) => draw(p, 150 + i * 160, 800));
        qa(".wi-leg").forEach((p, i) => draw(p, 150 + i * 160, 800));
        pop(q(".wi-xfer"), 1050, 800);
        A(q(".wi-sign"), [
          { clipPath: "inset(0 50% 0 50% round 6px)", transform: "translate(-50%, 6px)" },
          { clipPath: "inset(0 0% 0 0% round 6px)", transform: "translate(-50%, 0)" },
        ], { duration: 650, delay: 1350 });
        A(q(".wi-sign b"), [{ letterSpacing: "0.5em", opacity: 0 }, { letterSpacing: "-0.02em", opacity: 1 }], { duration: 700, delay: 1450, easing: SPRING_SOFT });
        qa(".wi-km").forEach((k, i) =>
          A(k, [{ transform: "scale(0) rotate(-14deg)" }, { transform: "scale(1) rotate(0)" }], { duration: 650, delay: 1750 + i * 110, easing: SPRING })
        );
      },
    },
    {
      title: "근처 후보로 대진표 완성",
      desc: "메뉴나 근처 실제 가게가 8강·16강으로 줄 서요",
      duration: 3500,
      play() {
        clear("3");
        kinetic(root, reduce);
        led("후보 8곳 · 대진 출발 대기");
        A(q(".wi-board"), [
          { clipPath: `circle(0px at ${MID.x}px ${MID.y}px)` },
          { clipPath: `circle(${MAPH}px at ${MID.x}px ${MID.y}px)` },
        ], { duration: 700, easing: IN_OUT });
        qa(".wi-row").forEach((r, i) =>
          A(r, [
            { transform: "scaleY(0)", opacity: 0 },
            { transform: "scaleY(1.3)", opacity: 1, offset: 0.35 },
            { transform: "scaleY(0.92)", opacity: 1, offset: 0.6 },
            { transform: "scaleY(1)", opacity: 1 },
          ], { duration: 520, delay: 450 + i * 90 })
        );
        qa(".wi-br path").forEach((p, i) => draw(p, 1450 + (i < 8 ? 0 : i < 12 ? 380 : 700), 420));
        qa(".wi-br__dot").forEach((d, i) => pop(d, 1750 + (i < 4 ? 0 : 380), 500));
        pop(q(".wi-br__fin"), 2450, 700);
      },
    },
    {
      title: "다같이 찍으면 1등 확정",
      desc: "과반 투표로 1등에 왕관, 바로 지도로 연결",
      duration: 4800,
      play() {
        clear("4");
        kinetic(root, reduce);
        led("결승 투표 중 · 4명");
        const a = q(".wi-duel--a");
        const b = q(".wi-duel--b");
        const tally = qa(".wi-tally");
        tally[0].textContent = "0표";
        tally[1].textContent = "0표";
        // 대진 진행 노선
        draw(q(".wi-strip__done"), 0, 600);
        qa(".wi-strip__st").forEach((s, i) => pop(s, 150 + i * 90, 500));
        // 두 역명판 등장
        A(a, [{ transform: "translate(-120%, 0) rotate(-6deg)" }, { transform: "translate(0, 0) rotate(0)" }], { duration: 700, delay: 150, easing: SPRING_SOFT, fill: "backwards" });
        A(b, [{ transform: "translate(120%, 0) rotate(6deg)" }, { transform: "translate(0, 0) rotate(0)" }], { duration: 700, delay: 230, easing: SPRING_SOFT, fill: "backwards" });
        A(q(".wi-vs"), [{ transform: "translate(-50%, -50%) scale(0) rotate(-90deg)" }, { transform: "translate(-50%, -50%) scale(1) rotate(0)" }], { duration: 640, delay: 500, easing: SPRING, fill: "backwards" });
        // 표가 하나씩 쌓임: 김치찌개 3, 쌀국수 1
        const votes = [...a.querySelectorAll(".wi-vote"), ...b.querySelectorAll(".wi-vote")];
        const order = [0, 3, 1, 2];
        const count = [0, 0];
        order.forEach((vi, k) => {
          const t = 850 + k * 260;
          const side = vi < 3 ? 0 : 1;
          A(votes[vi], [
            { transform: "translate(-50%, 12px) scale(0)", opacity: 0 },
            { transform: "translate(-50%, -6px) scale(1.25)", opacity: 1, offset: 0.35 },
            { transform: "translate(-50%, -28px) scale(1)", opacity: 0 },
          ], { duration: 800, delay: t });
          later(() => {
            count[side]++;
            tally[side].textContent = `${count[side]}표`;
          }, t + 200);
          A(tally[side], [{ transform: "scale(1)" }, { transform: "scale(1.35)", offset: 0.3 }, { transform: "scale(1)" }], { duration: 420, delay: t + 200, easing: OUT, fill: "none" });
        });
        later(() => led("3표 vs 1표 · 김치찌개 과반"), 1950);
        // 예비동작(서로 멀어짐) → 충돌(스쿼시) → 여운
        const smash = (dir) => [
          { transform: "translateY(0) scale(1, 1)" },
          { transform: `translateY(${-20 * dir}px) scale(0.97, 1.04)`, offset: 0.4, easing: FALL },
          { transform: `translateY(${16 * dir}px) scale(1.05, 0.86)`, offset: 0.6, easing: OUT },
          { transform: `translateY(${3 * dir}px) scale(0.98, 1.03)`, offset: 0.8 },
          { transform: "translateY(0) scale(1, 1)" },
        ];
        A(a, smash(1), { duration: 720, delay: 2100, easing: "ease", fill: "forwards" });
        A(b, smash(-1), { duration: 720, delay: 2100, easing: "ease", fill: "forwards" });
        A(q(".wi-vs"), [
          { transform: "translate(-50%, -50%) scale(1)" },
          { transform: "translate(-50%, -50%) scale(1.9)", offset: 0.35 },
          { transform: "translate(-50%, -50%) scale(0)" },
        ], { duration: 500, delay: 2460, fill: "forwards" });
        // 패자 탈선, 승자 가운데로
        A(b, [
          { transform: "translate(0, 0) rotate(0)" },
          { transform: "translate(18px, -24px) rotate(5deg)", offset: 0.3, easing: FALL },
          { transform: "translate(70px, 300px) rotate(26deg)" },
        ], { duration: 820, delay: 2820, fill: "forwards", easing: "ease" });
        A(a, [{ transform: "translate(0, 0) scale(1)" }, { transform: "translate(0, 82px) scale(1.06)" }], { duration: 820, delay: 2920, easing: SPRING, fill: "forwards" });
        // 결승 → 1위 구간이 채워지고 왕관 착지
        draw(q(".wi-strip__win"), 3150, 500);
        A(q(".wi-strip__st--goal"), [{ transform: "scale(1)" }, { transform: "scale(1.5)", offset: 0.4 }, { transform: "scale(1)" }], { duration: 600, delay: 3550, easing: OUT, fill: "none" });
        later(() => wi.classList.add("is-won"), 3550);
        A(q(".wi-crown"), [
          { transform: "translate(-50%, -200px) scale(0.9, 1.15) rotate(-20deg)", opacity: 0, offset: 0 },
          { transform: "translate(-50%, -180px) scale(0.9, 1.15) rotate(-14deg)", opacity: 1, offset: 0.1, easing: FALL },
          { transform: "translate(-50%, 0) scale(0.9, 1.15) rotate(4deg)", offset: 0.5 },
          { transform: "translate(-50%, 6px) scale(1.35, 0.7) rotate(0)", offset: 0.6, easing: OUT },
          { transform: "translate(-50%, -12px) scale(0.95, 1.08)", offset: 0.78 },
          { transform: "translate(-50%, 0) scale(1, 1)", opacity: 1, offset: 1 },
        ], { duration: 900, delay: 3350, easing: "ease" });
        qa(".wi-spark i").forEach((s, i) =>
          A(s, [
            { transform: `rotate(${i * 45}deg) translateY(-14px) scaleY(0.2)`, opacity: 1 },
            { transform: `rotate(${i * 45}deg) translateY(-46px) scaleY(1)`, opacity: 1, offset: 0.5 },
            { transform: `rotate(${i * 45}deg) translateY(-60px) scaleY(0.2)`, opacity: 0 },
          ], { duration: 600, delay: 3820 })
        );
        later(() => led("1위 김치찌개 · 지도로 바로 연결"), 3800);
        A(q(".wi-go"), [
          { transform: "translate(-50%, 24px) scale(0.6)", opacity: 0 },
          { transform: "translate(-50%, 0) scale(1)", opacity: 1 },
        ], { duration: 700, delay: 3950, easing: SPRING });
      },
    },
  ];

  const ctl = runIntro({ root, scenes, loop: true });
  return {
    stop() {
      ctl.stop();
      live.forEach((a) => a.cancel());
      live = [];
      timers.forEach(clearTimeout);
      ro?.disconnect();
    },
  };
}
