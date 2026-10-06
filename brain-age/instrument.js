// 계측기 부품: 오실로스코프(캔버스), 아날로그 바늘 게이지(SVG), 스프링, 키네틱 글자
import { prefersReducedMotion } from "../shared/kit.js";

export const art = () => {
  const cs = getComputedStyle(document.documentElement);
  const v = (n) => cs.getPropertyValue(n).trim();
  return {
    phosphor: v("--art-phosphor") || v("--brand"),
    screen: v("--art-screen"),
    paper: v("--art-paper"),
    ink: v("--art-ink"),
    ink2: v("--art-ink-2"),
    rule: v("--art-rule"),
    grid: v("--art-grid"),
    red: v("--art-red"),
  };
};

/* ---------- 감쇠 스프링 (오버슈트 후 정착) ---------- */
// from → to 로 가는 값을 매 프레임 onUpdate 로 넘긴다. 반환 Promise 는 정착 시 resolve.
export function spring({ from, to, stiffness = 180, damping = 13, onUpdate, signal, velocity = 0 }) {
  return new Promise((resolve) => {
    if (prefersReducedMotion()) {
      onUpdate(to);
      return resolve();
    }
    let x = from;
    let v = velocity;
    let last = performance.now();
    let raf;
    const step = (now) => {
      if (signal?.aborted) return resolve();
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      // 반암시적 오일러: 프레임이 튀어도 안정적
      const a = -stiffness * (x - to) - damping * v;
      v += a * dt;
      x += v * dt;
      onUpdate(x);
      if (Math.abs(v) < 0.02 && Math.abs(x - to) < 0.02) {
        onUpdate(to);
        return resolve();
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    signal?.addEventListener("abort", () => cancelAnimationFrame(raf), { once: true });
  });
}

/* ---------- 키네틱 글자 (글자 단위 스프링 리빌) ---------- */
export function kinetic(el, text, { delay = 0, step = 24 } = {}) {
  let i = 0;
  el.innerHTML = String(text)
    .split("\n")
    .map(
      (line) =>
        `<span class="kt-line">${[...line]
          .map((ch) => (ch === " " ? " " : `<span class="kt-ch" style="--i:${i++}">${ch}</span>`))
          .join("")}</span>`
    )
    .join("");
  el.style.setProperty("--kt-delay", `${delay}ms`);
  el.style.setProperty("--kt-step", `${step}ms`);
  el.classList.remove("is-kt");
  void el.offsetWidth;
  el.classList.add("is-kt");
}

/* ---------- 아날로그 게이지 ---------- */
// 반원 계기판. min~max 눈금, 바늘은 setGauge 로 스프링 이동.
export function gaugeSVG({ min = 10, max = 80, major = 10, label = "뇌 나이", unit = "세" } = {}) {
  const cx = 100;
  const cy = 96;
  const R = 78;
  const toAng = (v) => Math.PI + ((v - min) / (max - min)) * Math.PI;
  const ticks = [];
  for (let v = min; v <= max; v += major / 2) {
    const a = toAng(v);
    const isMajor = (v - min) % major === 0;
    const r1 = R;
    const r2 = R - (isMajor ? 12 : 6);
    ticks.push(
      `<line class="${isMajor ? "g-major" : "g-minor"}" x1="${(cx + Math.cos(a) * r1).toFixed(1)}" y1="${(cy + Math.sin(a) * r1).toFixed(1)}" x2="${(cx + Math.cos(a) * r2).toFixed(1)}" y2="${(cy + Math.sin(a) * r2).toFixed(1)}" />`
    );
    if (isMajor) {
      const r3 = R - 22;
      ticks.push(`<text class="g-num" x="${(cx + Math.cos(a) * r3).toFixed(1)}" y="${(cy + Math.sin(a) * r3 + 4).toFixed(1)}" text-anchor="middle">${v}</text>`);
    }
  }
  // 젊은 구간(낮은 나이) 띠
  const arc = (v0, v1, r) => {
    const a0 = toAng(v0);
    const a1 = toAng(v1);
    return `M${(cx + Math.cos(a0) * r).toFixed(1)} ${(cy + Math.sin(a0) * r).toFixed(1)}A${r} ${r} 0 0 1 ${(cx + Math.cos(a1) * r).toFixed(1)} ${(cy + Math.sin(a1) * r).toFixed(1)}`;
  };
  return `<svg class="gauge-svg" viewBox="0 0 200 120" data-min="${min}" data-max="${max}" aria-hidden="true">
    <path class="g-band" d="${arc(min, max, R + 4)}" />
    <path class="g-band g-band--hot" d="${arc(max - (max - min) * 0.18, max, R + 4)}" />
    ${ticks.join("")}
    <text class="g-label" x="${cx}" y="${cy + 18}" text-anchor="middle">${label} (${unit})</text>
    <g class="g-needle" style="transform: rotate(-90deg)">
      <line x1="${cx}" y1="${cy + 8}" x2="${cx}" y2="${cy - R + 6}" />
    </g>
    <circle class="g-hub" cx="${cx}" cy="${cy}" r="6" />
  </svg>`;
}

// 값 → 바늘 각도(도). 바늘 기본자세는 위(0도), -90(왼쪽 끝) ~ +90(오른쪽 끝)
const gaugeDeg = (svg, v) => {
  const min = Number(svg.dataset.min);
  const max = Number(svg.dataset.max);
  const t = Math.max(-0.04, Math.min(1.04, (v - min) / (max - min)));
  return -90 + t * 180;
};

export function setGauge(svg, value, { from = null, anticipate = true, signal, stiffness = 140, damping = 9 } = {}) {
  const needle = svg.querySelector(".g-needle");
  const set = (deg) => (needle.style.transform = `rotate(${deg}deg)`);
  const current = from != null ? gaugeDeg(svg, from) : svg._deg ?? -90;
  const target = gaugeDeg(svg, value);
  const apply = (d) => {
    svg._deg = d;
    set(d);
  };
  if (prefersReducedMotion()) {
    apply(target);
    return Promise.resolve();
  }
  // 예비동작: 반대 방향으로 살짝 당겼다가 튕겨 나간다
  const back = anticipate ? current - Math.sign(target - current) * 8 : current;
  return spring({ from: current, to: back, stiffness: 600, damping: 30, onUpdate: apply, signal }).then(() =>
    spring({ from: back, to: target, stiffness, damping, onUpdate: apply, signal })
  );
}

/* ---------- 오실로스코프 ---------- */
// 빔이 왼쪽→오른쪽으로 쓸고 지나가며, 형광 잔상이 서서히 사라진다.
// wave(x, t, ctx) → -1..1 (위가 +). mark() 를 부르면 그 순간에 스파이크가 튄다.
export const WAVES = {
  idle: (x, t) => Math.sin(t * 0.011 + x * 40) * 0.03 + (Math.random() - 0.5) * 0.05,
  rt: (x, t) => {
    const s = Math.exp(-(((x - 0.62) / 0.012) ** 2));
    const ring = x > 0.62 ? Math.sin((x - 0.62) * 140) * Math.exp(-(x - 0.62) * 30) * 0.25 : 0;
    return s * 0.9 + ring + (Math.random() - 0.5) * 0.04;
  },
  mem: (x) => [0.1, 0.6, -0.4, 0.6, 0.2, -0.6, 0.6, -0.2][Math.min(7, Math.floor(x * 8))] * 0.9,
  color: (x, t) => Math.sin(x * Math.PI * 4 + t * 0.004) * 0.6,
  hear: (x, t) => Math.sin(x * Math.PI * 46 + t * 0.03) * 0.55 * Math.sin(x * Math.PI),
  math: (x, t) => (((x * 5 + t * 0.0006) % 1) - 0.5) * 1.3,
  dyn: (x, t) => { const p = ((t * 0.0012) % 1.4) - 0.2; return Math.exp(-(((x - p) / 0.03) ** 2)) * 0.9 + (Math.random() - 0.5) * 0.04; },
};

export class Scope {
  constructor(canvas, { period = 1300, gain = 0.42 } = {}) {
    this.cv = canvas;
    this.ctx = canvas.getContext("2d");
    this.period = period;
    this.gain = gain;
    this.wave = WAVES.idle;
    this.marks = [];
    this.prevX = 0;
    this.prevY = null;
    this.raf = 0;
    this.c = art();
    this.resize();
  }
  resize() {
    const r = this.cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    this.cv.width = Math.round(this.w * dpr);
    this.cv.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  setWave(fn) {
    this.wave = fn;
  }
  // 지금 이 순간 스파이크 (반응 탭)
  mark(strength = 0.95) {
    this.marks.push({ t: performance.now(), s: strength });
    if (this.marks.length > 6) this.marks.shift();
  }
  sample(x, t) {
    let y = this.wave(x, t);
    for (const m of this.marks) {
      const d = t - m.t;
      if (d > -6 && d < 140) y += m.s * Math.exp(-((d / 10) ** 2)) + (d > 0 ? Math.sin(d * 0.25) * Math.exp(-d / 40) * 0.3 : 0);
    }
    return Math.max(-1.05, Math.min(1.05, y));
  }
  start(signal) {
    const ctx = this.ctx;
    const t0 = performance.now();
    const still = prefersReducedMotion();
    const pts = []; // {x, y, t} 빔이 지나간 자리. 시간이 지날수록 흐려진다 (형광 잔상)
    const persist = this.period * 0.9;
    const frame = (now) => {
      if (signal?.aborted) return;
      const { w, h } = this;
      const mid = h / 2;
      const amp = mid * this.gain * 2;
      ctx.clearRect(0, 0, w, h);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      if (still) {
        ctx.strokeStyle = this.c.phosphor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let px = 0; px <= w; px += 2) {
          const y = mid - this.sample(px / w, now) * amp;
          px ? ctx.lineTo(px, y) : ctx.moveTo(px, y);
        }
        ctx.stroke();
        return;
      }
      const x = ((now - t0) % this.period) / this.period;
      let from = this.prevX;
      if (x < from) {
        from = 0;
        pts.push(null); // 줄 바꿈
      }
      const steps = Math.max(1, Math.ceil(((x - from) * w) / 3));
      for (let i = 1; i <= steps; i++) {
        const xx = from + ((x - from) * i) / steps;
        const tt = now - (x - xx) * this.period;
        pts.push({ x: xx * w, y: mid - this.sample(xx, tt) * amp, t: tt });
      }
      this.prevX = x;
      while (pts.length && (pts[0] === null || now - pts[0].t > persist)) pts.shift();
      // 번짐(두꺼운 저알파) + 심선(얇은 고알파) 두 번 그린다
      for (const pass of [
        { lw: 6, a: 0.16 },
        { lw: 2, a: 1 },
      ]) {
        ctx.lineWidth = pass.lw;
        ctx.strokeStyle = this.c.phosphor;
        for (let i = 1; i < pts.length; i++) {
          const p0 = pts[i - 1];
          const p1 = pts[i];
          if (!p0 || !p1) continue;
          const age = (now - p1.t) / persist;
          ctx.globalAlpha = Math.max(0, (1 - age) ** 1.6) * pass.a;
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      const last = pts[pts.length - 1];
      if (last) {
        ctx.fillStyle = this.c.phosphor;
        ctx.beginPath();
        ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
    signal?.addEventListener("abort", () => cancelAnimationFrame(this.raf), { once: true });
  }
}
