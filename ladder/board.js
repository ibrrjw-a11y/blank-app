// 사다리 모델 + 분필 그리기. 인트로와 본 화면이 같이 쓴다.
// 좌표: 세로줄(rail) i = 0..n-1, 높이 y = 0(위)..1(아래). 가로 다리(rung) { a, y, dy } 는 a번과 a+1번 줄을 잇는다.
// 왼쪽 끝 높이 y, 오른쪽 끝 높이 y + dy (손으로 그은 듯 살짝 기울어짐).

export const CHALK = {
  white: "#f3f0e6",
  yellow: "#ffe27a",
  pink: "#ffa3bb",
  blue: "#9dd6ff",
  green: "#bdf0a3",
  orange: "#ffbb7c",
};
export const PATH_COLORS = [CHALK.yellow, CHALK.pink, CHALK.blue, CHALK.green, CHALK.orange, CHALK.white];

export const Y_MIN = 0.06;
export const Y_MAX = 0.94;
export const GAP = 0.055; // 같은 줄에 닿는 다리끼리 최소 간격

export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const endsOn = (r, rail) => {
  // 이 다리가 rail 위에 닿는 높이 (없으면 null)
  if (r.a === rail) return r.y;
  if (r.a + 1 === rail) return r.y + r.dy;
  return null;
};

export function conflicts(rungs, a, y, dy = 0, gap = GAP) {
  for (const r of rungs) {
    for (const rail of [a, a + 1]) {
      const mine = rail === a ? y : y + dy;
      const other = endsOn(r, rail);
      if (other != null && Math.abs(other - mine) < gap) return true;
    }
  }
  return false;
}

// 탭한 높이 근처에서 빈자리를 찾는다
export function findSlot(rungs, a, y, dy = 0) {
  for (let k = 0; k <= 160; k++) {
    for (const sg of k ? [1, -1] : [1]) {
      const yy = y + sg * k * 0.006;
      if (yy < Y_MIN + 0.02 || yy + dy > Y_MAX - 0.02 || yy + dy < Y_MIN + 0.02) continue;
      if (!conflicts(rungs, a, yy, dy)) return yy;
    }
  }
  return null;
}

export function genRungs(n, rand = Math.random, perGap = 3) {
  const rungs = [];
  if (n < 2) return rungs;
  const want = Math.max(n - 1, Math.round((n - 1) * perGap));
  const tilt = () => (rand() - 0.5) * 0.022;
  // 모든 칸 사이에 최소 1개
  for (let a = 0; a < n - 1; a++) {
    for (let t = 0; t < 40; t++) {
      const y = Y_MIN + 0.04 + rand() * (Y_MAX - Y_MIN - 0.1);
      const dy = tilt();
      if (!conflicts(rungs, a, y, dy)) {
        rungs.push({ a, y, dy });
        break;
      }
    }
  }
  let tries = 0;
  while (rungs.length < want && tries++ < 600) {
    const a = Math.floor(rand() * (n - 1));
    const y = Y_MIN + 0.04 + rand() * (Y_MAX - Y_MIN - 0.1);
    const dy = tilt();
    if (!conflicts(rungs, a, y, dy)) rungs.push({ a, y, dy });
  }
  return rungs;
}

// start 줄에서 내려가는 경로. pts: [[rail, y], ...] (줄 번호는 실수 아님)
export function tracePath(n, rungs, start) {
  let rail = start;
  let y = 0;
  const pts = [[rail, 0]];
  for (let guard = 0; guard < 400; guard++) {
    let best = null;
    let bestY = Infinity;
    for (const r of rungs) {
      const e = endsOn(r, rail);
      if (e != null && e > y + 1e-9 && e < bestY) {
        bestY = e;
        best = r;
      }
    }
    if (!best) break;
    pts.push([rail, bestY]);
    const other = best.a === rail ? best.a + 1 : best.a;
    const oy = endsOn(best, other);
    pts.push([other, oy]);
    rail = other;
    y = oy;
  }
  pts.push([rail, 1]);
  return { start, end: rail, pts };
}

export function mapping(n, rungs) {
  return Array.from({ length: n }, (_, i) => tracePath(n, rungs, i).end);
}

/* ---------- 기하 ---------- */
export function geom(W, H, n, { top = 6, bottom = 6, side } = {}) {
  const pad = side ?? Math.min(W / (n * 2), 44);
  const span = W - pad * 2;
  const step = n > 1 ? span / (n - 1) : 0;
  return {
    W,
    H,
    n,
    step,
    x: (i) => pad + i * step,
    y: (v) => top + v * (H - top - bottom),
    railAt: (px) => (px - pad) / (step || 1),
    vAt: (py) => (py - top) / (H - top - bottom),
  };
}

/* ---------- 분필 ---------- */
// 폴리라인을 일정 간격으로 다시 찍고, 손떨림·분필 결을 입혀 progress 만큼 그린다.
export function chalkStroke(ctx, pts, { color = CHALK.white, width = 3, seed = 1, wobble = 1.1, progress = 1, grain = true, alpha = 0.92 } = {}) {
  if (pts.length < 2 || progress <= 0) return null;
  const rand = seeded(seed * 7919 + 13);
  const p1 = rand() * 6.28;
  const p2 = rand() * 6.28;
  // 리샘플
  const samples = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const len = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(len / 3));
    const nx = len ? -(y2 - y1) / len : 0;
    const ny = len ? (x2 - x1) / len : 0;
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      samples.push({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t, nx, ny, s: total + len * t });
    }
    total += len;
  }
  const last = pts[pts.length - 1];
  samples.push({ x: last[0], y: last[1], nx: 0, ny: 0, s: total });
  const upto = total * Math.min(1, progress);
  const out = [];
  for (const p of samples) {
    if (p.s > upto) break;
    const w = wobble * (Math.sin(p.s * 0.045 + p1) * 0.65 + Math.sin(p.s * 0.17 + p2) * 0.25 + (rand() - 0.5) * 0.35);
    out.push([p.x + p.nx * w, p.y + p.ny * w]);
  }
  if (out.length < 2) return out[0] || null;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.beginPath();
  out.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  // 겹 획 (분필 가루가 옆으로 묻은 느낌)
  ctx.globalAlpha = alpha * 0.35;
  ctx.lineWidth = width * 0.5;
  ctx.beginPath();
  out.forEach(([x, y], i) => (i ? ctx.lineTo(x + 1.1, y + 0.8) : ctx.moveTo(x + 1.1, y + 0.8)));
  ctx.stroke();
  if (grain) {
    // 분필 결: 획 위에 작은 구멍을 낸다
    ctx.globalCompositeOperation = "destination-out";
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < out.length; i++) {
      if (rand() < 0.26) {
        const [x, y] = out[i];
        ctx.beginPath();
        ctx.arc(x + (rand() - 0.5) * width, y + (rand() - 0.5) * width, 0.3 + rand() * width * 0.13, 0, 6.283);
        ctx.fill();
      }
    }
  }
  ctx.restore();
  return out[out.length - 1];
}

// 분필 글씨 (가루 구멍 포함)
export function chalkText(ctx, text, x, y, { font, color = CHALK.white, align = "center", seed = 3, progress = 1, alpha = 0.95 } = {}) {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  const w = ctx.measureText(text).width;
  const left = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
  if (progress < 1) {
    ctx.beginPath();
    ctx.rect(left - 4, y - 60, (w + 8) * Math.max(0, progress), 120);
    ctx.clip();
  }
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  const rand = seeded(seed);
  ctx.globalCompositeOperation = "destination-out";
  const h = parseFloat(/(\d+)px/.exec(font)?.[1] || 16);
  const count = Math.round(w * h * 0.03);
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = 0.5 + rand() * 0.5;
    ctx.fillRect(left + rand() * w, y - h / 2 + rand() * h, 0.8 + rand(), 0.8 + rand());
  }
  ctx.restore();
}

// 줄 경로를 픽셀 좌표로
export function pathPixels(g, path) {
  return path.pts.map(([rail, v]) => [g.x(rail), g.y(v)]);
}

export function railPixels(g, i) {
  return [
    [g.x(i), g.y(0)],
    [g.x(i), g.y(1)],
  ];
}

export function rungPixels(g, r) {
  return [
    [g.x(r.a), g.y(r.y)],
    [g.x(r.a + 1), g.y(r.y + r.dy)],
  ];
}

/* ---------- 분필 가루 ---------- */
export class Dust {
  constructor() {
    this.p = [];
  }
  emit(x, y, color, count = 3) {
    for (let i = 0; i < count; i++) {
      this.p.push({
        x: x + (Math.random() - 0.5) * 4,
        y: y + (Math.random() - 0.5) * 4,
        vx: (Math.random() - 0.5) * 50,
        vy: -10 - Math.random() * 30,
        life: 0.5 + Math.random() * 0.6,
        age: 0,
        s: 1 + Math.random() * 1.8,
        c: color,
      });
    }
    if (this.p.length > 400) this.p.splice(0, this.p.length - 400);
  }
  step(dt) {
    for (const d of this.p) {
      d.age += dt;
      d.vy += 140 * dt;
      d.vx *= 0.96;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
    }
    this.p = this.p.filter((d) => d.age < d.life);
  }
  draw(ctx) {
    for (const d of this.p) {
      ctx.globalAlpha = Math.max(0, 1 - d.age / d.life) * 0.8;
      ctx.fillStyle = d.c;
      ctx.fillRect(d.x, d.y, d.s, d.s);
    }
    ctx.globalAlpha = 1;
  }
  get alive() {
    return this.p.length > 0;
  }
}
