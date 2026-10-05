// 첫 화면 모션그래픽: 지도 → 핀 3개 → 중간지점 → 대진표 → 충돌 → 왕관
import { runIntro, prefersReducedMotion } from "../shared/kit.js";

const W = 340;
const H = 340;
const PINS = [
  { x: 64, y: 92, name: "지민", c: 1 },
  { x: 278, y: 118, name: "도윤", c: 2 },
  { x: 150, y: 276, name: "나", c: 0 },
];
const MID = { x: 164, y: 162 };
const CARDS = [
  ["🍜", "쌀국수"], ["🍲", "김치찌개"], ["🍣", "초밥"], ["🍝", "파스타"],
  ["🍔", "수제버거"], ["🥘", "부대찌개"], ["🍛", "카레"], ["🥗", "샐러드"],
];
// 대진표 칸 (좌 4, 우 4)
const SLOTS = CARDS.map((_, i) => ({
  x: i < 4 ? 8 : W - 8 - 104,
  y: 44 + (i % 4) * 64,
}));

function mapSVG() {
  return `<svg class="wi-map" viewBox="0 0 ${W} ${H}" aria-hidden="true">
    <rect class="wi-map__bg" width="${W}" height="${H}" rx="28"/>
    <path class="wi-map__river" d="M-10 214 C 60 190, 110 236, 180 222 S 300 186, 350 206 L 350 246 C 290 226, 240 262, 180 258 S 60 230, -10 252 Z"/>
    <ellipse class="wi-map__park" cx="262" cy="292" rx="54" ry="30"/>
    <ellipse class="wi-map__park" cx="58" cy="40" rx="44" ry="24"/>
    <g class="wi-map__blocks">
      <rect x="22" y="112" width="70" height="44" rx="8"/><rect x="108" y="40" width="64" height="56" rx="8"/>
      <rect x="196" y="36" width="56" height="42" rx="8"/><rect x="196" y="140" width="62" height="46" rx="8"/>
      <rect x="22" y="266" width="58" height="48" rx="8"/><rect x="96" y="120" width="40" height="40" rx="8"/>
      <rect x="276" y="148" width="50" height="40" rx="8"/><rect x="186" y="280" width="34" height="38" rx="8"/>
    </g>
    <g class="wi-map__roads">
      <path d="M0 100 H 340"/><path d="M0 196 H 340"/><path d="M182 0 V 340"/><path d="M90 0 L 150 340"/>
      <path class="wi-map__road--s" d="M0 60 C 120 80, 220 30, 340 54"/><path class="wi-map__road--s" d="M260 0 L 300 340"/>
    </g>
  </svg>`;
}

function build(stage) {
  stage.innerHTML = `
    <div class="wi">
      ${mapSVG()}
      <svg class="wi-lines" viewBox="0 0 ${W} ${H}" aria-hidden="true">
        ${PINS.map((p) => `<line x1="${p.x}" y1="${p.y}" x2="${p.x}" y2="${p.y}" style="--c: var(--pc-${p.c})"/>`).join("")}
      </svg>
      <svg class="wi-bracket" viewBox="0 0 ${W} ${H}" aria-hidden="true">
        ${[0, 1].map((side) => {
          const x0 = side ? W - 112 : 112;
          const dx = side ? -18 : 18;
          return [0, 1].map((k) => {
            const y1 = 44 + k * 128 + 17, y2 = y1 + 64;
            return `<path pathLength="1" d="M${x0} ${y1} H${x0 + dx} V${y2} H${x0}"/><path pathLength="1" d="M${x0 + dx} ${(y1 + y2) / 2} H${x0 + dx * 2}"/>`;
          }).join("") + `<path pathLength="1" d="M${x0 + dx * 2} ${44 + 49} V${44 + 128 + 49} M${x0 + dx * 2} ${44 + 113} H${x0 + dx * 3}"/>`;
        }).join("")}
      </svg>
      <div class="wi-mid" style="left:${MID.x}px; top:${MID.y}px">
        <span class="wi-mid__ring"></span><span class="wi-mid__ring wi-mid__ring--2"></span>
        <span class="wi-mid__dot"></span>
        <span class="wi-mid__label">중간 지점</span>
      </div>
      ${PINS.map((p, i) => `
        <div class="wi-pin" data-i="${i}" style="left:${p.x}px; top:${p.y}px; --c: var(--pc-${p.c})">
          <span class="wi-pin__shadow"></span>
          <span class="wi-pin__body"><span class="wi-pin__head">${p.name.slice(0, 1)}</span></span>
          <span class="wi-pin__name">${p.name}</span>
        </div>`).join("")}
      ${CARDS.map(([e, n], i) => `<div class="wi-card" data-i="${i}"><span>${e}</span>${n}</div>`).join("")}
      <div class="wi-duel wi-duel--a"><span class="wi-duel__e">🍲</span><b>김치찌개</b></div>
      <div class="wi-duel wi-duel--b"><span class="wi-duel__e">🍜</span><b>쌀국수</b></div>
      <div class="wi-vs">VS</div>
      <div class="wi-crown">👑</div>
      <div class="wi-spark">${Array.from({ length: 10 }, (_, i) => `<i></i>`).join("")}</div>
    </div>`;
  return stage.querySelector(".wi");
}

export function startIntro(root) {
  const stage = root.querySelector(".intro__stage");
  const wi = build(stage);
  const q = (s) => wi.querySelector(s);
  const qa = (s) => Array.from(wi.querySelectorAll(s));
  const reduce = prefersReducedMotion();
  let live = [];
  let rafs = [];

  const A = (el, frames, opts) => {
    const a = el.animate(frames, { fill: "both", easing: "cubic-bezier(0.2, 0, 0, 1)", ...opts, duration: reduce ? 1 : opts.duration });
    live.push(a);
    return a;
  };
  const clear = () => {
    live.forEach((a) => a.cancel());
    live = [];
    rafs.forEach(cancelAnimationFrame);
    rafs = [];
    wi.className = "wi";
  };
  const setLines = (t) => {
    qa(".wi-lines line").forEach((l, i) => {
      const p = PINS[i];
      const k = Math.max(0, Math.min(1, t[i] ?? t));
      l.setAttribute("x2", p.x + (MID.x - p.x) * k);
      l.setAttribute("y2", p.y + (MID.y - p.y) * k);
    });
  };
  const growLines = (signal) => {
    const t0 = performance.now();
    const step = (now) => {
      if (signal.aborted) return;
      const ts = PINS.map((_, i) => {
        const t = Math.max(0, Math.min(1, (now - t0 - i * 160) / 700));
        return reduce ? 1 : 1 - Math.pow(1 - t, 3);
      });
      setLines(ts);
      if (ts.some((t) => t < 1)) rafs.push(requestAnimationFrame(step));
    };
    rafs.push(requestAnimationFrame(step));
  };

  const scenes = [
    {
      title: "친구들 위치를 찍으면",
      desc: "각자 있는 역이나 내 위치만 넣으면 돼요",
      duration: 3000,
      play(_, signal) {
        clear();
        wi.classList.add("is-s1");
        setLines(0);
        A(q(".wi-map"), [{ transform: "scale(1.08)", opacity: 0.4 }, { transform: "scale(1)", opacity: 1 }], { duration: 900 });
        qa(".wi-pin").forEach((pin, i) => {
          const body = pin.querySelector(".wi-pin__body");
          const sh = pin.querySelector(".wi-pin__shadow");
          const nm = pin.querySelector(".wi-pin__name");
          const delay = 300 + i * 260;
          A(body, [
            { transform: "translateY(-150px)", opacity: 0, offset: 0 },
            { transform: "translateY(0)", opacity: 1, offset: 0.55, easing: "cubic-bezier(0.3,0,0.6,1)" },
            { transform: "translateY(-18px)", offset: 0.72, easing: "cubic-bezier(0.2,0,0,1)" },
            { transform: "translateY(0)", offset: 0.86 },
            { transform: "translateY(-4px)", offset: 0.93 },
            { transform: "translateY(0)", opacity: 1, offset: 1 },
          ], { duration: 900, delay, easing: "linear" });
          A(sh, [{ transform: "translateX(-50%) scale(0.2)", opacity: 0 }, { transform: "translateX(-50%) scale(1)", opacity: 1 }], { duration: 500, delay: delay + 300 });
          A(nm, [{ opacity: 0, transform: "translate(-50%, 4px)" }, { opacity: 1, transform: "translate(-50%, 0)" }], { duration: 300, delay: delay + 600 });
        });
        void signal;
      },
    },
    {
      title: "딱 중간 지점을 찾아줘요",
      desc: "모두의 무게중심에서 가장 가까운 역을 골라요",
      duration: 3200,
      play(_, signal) {
        clear();
        wi.classList.add("is-s2");
        setLines(0);
        growLines(signal);
        const mid = q(".wi-mid");
        A(mid.querySelector(".wi-mid__dot"), [{ transform: "translate(-50%,-50%) scale(0)" }, { transform: "translate(-50%,-50%) scale(1.4)", offset: 0.6 }, { transform: "translate(-50%,-50%) scale(1)" }], { duration: 600, delay: 900, easing: "cubic-bezier(0.3,0,0,1.2)" });
        A(mid.querySelector(".wi-mid__label"), [{ opacity: 0, transform: "translate(-50%, 6px) scale(.9)" }, { opacity: 1, transform: "translate(-50%, 0) scale(1)" }], { duration: 400, delay: 1300 });
        qa(".wi-mid__ring").forEach((r, i) =>
          A(r, [{ transform: "translate(-50%,-50%) scale(0.3)", opacity: 0.9 }, { transform: "translate(-50%,-50%) scale(2.6)", opacity: 0 }], { duration: 1400, delay: 1000 + i * 700, iterations: reduce ? 1 : Infinity, easing: "cubic-bezier(0,0,0.2,1)" })
        );
      },
    },
    {
      title: "근처 후보가 대진표로",
      desc: "메뉴나 근처 실제 가게가 8강·16강으로 모여요",
      duration: 3400,
      play() {
        clear();
        wi.classList.add("is-s3");
        setLines(1);
        A(q(".wi-map"), [{ opacity: 1 }, { opacity: 0.28 }], { duration: 500 });
        A(q(".wi-lines"), [{ opacity: 1 }, { opacity: 0 }], { duration: 400 });
        qa(".wi-pin").forEach((p) => A(p, [{ opacity: 1 }, { opacity: 0 }], { duration: 400 }));
        A(q(".wi-mid"), [{ opacity: 1, transform: "scale(1)" }, { opacity: 1, transform: "scale(1.3)", offset: 0.3 }, { opacity: 0, transform: "scale(0.2)" }], { duration: 900, delay: 200 });
        qa(".wi-card").forEach((card, i) => {
          const s = SLOTS[i];
          const ang = (i / CARDS.length) * Math.PI * 2 - Math.PI / 2;
          const bx = MID.x - 52 + Math.cos(ang) * 92;
          const by = MID.y - 17 + Math.sin(ang) * 92;
          const from = `translate(${MID.x - 52}px, ${MID.y - 17}px) scale(0.2)`;
          A(card, [
            { transform: from, opacity: 0 },
            { transform: `translate(${bx}px, ${by}px) scale(1.05)`, opacity: 1, offset: 0.45, easing: "cubic-bezier(0.3,0,0,1.2)" },
            { transform: `translate(${bx}px, ${by}px) scale(1)`, opacity: 1, offset: 0.6 },
            { transform: `translate(${s.x}px, ${s.y}px) scale(1)`, opacity: 1, offset: 1 },
          ], { duration: 1500, delay: 500 + i * 60, easing: "cubic-bezier(0.2,0,0,1)" });
        });
        qa(".wi-bracket path").forEach((p, i) =>
          A(p, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 500, delay: 2100 + (i % 3) * 120 })
        );
      },
    },
    {
      title: "둘 중 하나, 다같이 골라요",
      desc: "투표로 올라간 1등에 왕관! 바로 지도로 연결돼요",
      duration: 3800,
      play() {
        clear();
        wi.classList.add("is-s4");
        A(q(".wi-map"), [{ opacity: 0.28 }, { opacity: 0.28 }], { duration: 10 });
        const a = q(".wi-duel--a");
        const b = q(".wi-duel--b");
        A(a, [
          { transform: "translate(-240px, 0) rotate(-10deg)" },
          { transform: "translate(6px, 0) rotate(2deg)", offset: 0.55, easing: "cubic-bezier(0.5,0,1,1)" },
          { transform: "translate(-14px, 0) rotate(-3deg)", offset: 0.7 },
          { transform: "translate(0, 0) rotate(0)", offset: 1 },
        ], { duration: 900, easing: "linear" });
        A(b, [
          { transform: "translate(240px, 0) rotate(10deg)" },
          { transform: "translate(-6px, 0) rotate(-2deg)", offset: 0.55, easing: "cubic-bezier(0.5,0,1,1)" },
          { transform: "translate(14px, 0) rotate(3deg)", offset: 0.7 },
          { transform: "translate(0, 0) rotate(0)", offset: 1 },
        ], { duration: 900, easing: "linear" });
        A(q(".wi-vs"), [{ transform: "translate(-50%,-50%) scale(0)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1.6)", opacity: 1, offset: 0.4 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 1, offset: 0.7 }, { transform: "translate(-50%,-50%) scale(0.6)", opacity: 0 }], { duration: 1300, delay: 450 });
        // 패자 퇴장, 승자 올라가기
        A(b, [{ transform: "translate(0,0) rotate(0)", opacity: 1 }, { transform: "translate(120px, 90px) rotate(24deg)", opacity: 0 }], { duration: 600, delay: 1500, easing: "cubic-bezier(0.4,0,1,1)", fill: "forwards" });
        A(a, [{ transform: "translate(0,0) scale(1)" }, { transform: "translate(64px, -24px) scale(1.18)" }], { duration: 700, delay: 1600, easing: "cubic-bezier(0.3,0,0,1.2)", fill: "forwards" });
        A(q(".wi-crown"), [
          { transform: "translate(-50%, -180px) rotate(-30deg)", opacity: 0 },
          { transform: "translate(-50%, 0) rotate(8deg)", opacity: 1, offset: 0.6, easing: "cubic-bezier(0.5,0,1,1)" },
          { transform: "translate(-50%, -14px) rotate(-4deg)", offset: 0.8 },
          { transform: "translate(-50%, 0) rotate(0)", opacity: 1 },
        ], { duration: 800, delay: 2300, easing: "linear" });
        qa(".wi-spark i").forEach((s, i) =>
          A(s, [{ transform: `rotate(${i * 36}deg) translateY(0) scale(0)`, opacity: 1 }, { transform: `rotate(${i * 36}deg) translateY(-64px) scale(1)`, opacity: 0 }], { duration: 700, delay: 2800, easing: "cubic-bezier(0,0,0.2,1)" })
        );
      },
    },
  ];

  const ctl = runIntro({ root, scenes, loop: true });
  return {
    stop() {
      ctl.stop();
      clear();
    },
  };
}
