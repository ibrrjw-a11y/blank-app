// 룰렛 물리 + 그리기. 인트로와 본 화면이 같이 쓴다.
// 좌표: theta 가 커지면 판이 시계 방향으로 돈다. 바늘(고무 플래퍼)은 12시 방향.
// 바늘 아래에 오는 판의 각도 = mod(-theta).

export const TAU = Math.PI * 2;

// 납작한 원색 (그라디언트 없음). 일러스트 내부 장식 색.
export const SLICE_COLORS = [
  { bg: "#ff3b2f", fg: "#ffffff" },
  { bg: "#ffd400", fg: "#161616" },
  { bg: "#1f6bff", fg: "#ffffff" },
  { bg: "#12b06a", fg: "#ffffff" },
  { bg: "#ff7a00", fg: "#161616" },
  { bg: "#f3ead6", fg: "#161616" },
  { bg: "#ff4f9e", fg: "#ffffff" },
  { bg: "#00a3b4", fg: "#ffffff" },
];

export const wrap = (a) => {
  a %= TAU;
  if (a > Math.PI) a -= TAU;
  else if (a <= -Math.PI) a += TAU;
  return a;
};
export const mod = (a) => ((a % TAU) + TAU) % TAU;

export function colorFor(i, n) {
  let c = i % SLICE_COLORS.length;
  // 마지막 칸이 첫 칸과 같은 색이면 피한다
  if (n > 1 && i === n - 1 && c === 0) c = 3;
  return SLICE_COLORS[c];
}

export function layout(items) {
  const total = items.reduce((s, it) => s + it.weight, 0);
  let acc = 0;
  const slices = items.map((it, i) => {
    const start = (acc / total) * TAU;
    acc += it.weight;
    const end = (acc / total) * TAU;
    return { name: it.name, weight: it.weight, index: i, start, end, size: end - start, color: colorFor(i, items.length) };
  });
  return { slices, pegs: slices.map((s) => s.start), minSlice: Math.min(...slices.map((s) => s.size)), total };
}

export function sliceAt(lay, theta) {
  const r = mod(-theta);
  for (const s of lay.slices) if (r >= s.start && r < s.end) return s.index;
  return lay.slices.length - 1;
}

/* ---------- 물리 ----------
 * 판: 쿨롱 마찰 c0 + 점성 c1·ω + 공기 c2·ω²
 * 핀이 고무 바늘을 밀면 바늘이 휘면서 판을 되민다. 휘는 끝(dmax)에 가까울수록
 * 미는 힘이 약해져서(핀 모서리에 걸림) 느리게 기어 넘어가거나 다시 굴러 떨어진다.
 * 접촉 중 최소 힘(Tmin)이 정지 마찰보다 커서 핀 위에 걸친 채로 멈추는 일은 없다. */
export const BASE_PHYS = {
  dt: 1 / 240,
  c0: 0.3,
  c1: 0.2,
  c2: 0.03,
  F0: 1.3,
  Kd: 0.9,
  Tmin: 0.6,
  loss: 0.6, // 되밀 때 남는 힘 비율 (Tmin·loss > c0 이어야 핀 위에 안 멈춘다)
  kf: 6400, // 바늘 자체 진동 (시각용)
  cf: 34,
  turns: 3.5,
};

export function makeParams(lay, over = {}) {
  const P = { ...BASE_PHYS, ...over };
  P.dmax = Math.min(0.075, lay.minSlice * 0.36);
  P.K = P.Kd / P.dmax;
  return P;
}

export function simulate(lay, theta0, omega0, P, record = false) {
  const pegs = lay.pegs;
  const n = pegs.length;
  const sides = new Int8Array(n);
  for (let k = 0; k < n; k++) sides[k] = wrap(pegs[k] + theta0) < 0 ? -1 : 1;
  const dt = P.dt;
  let th = theta0;
  let w = omega0;
  let f = 0;
  let fv = 0;
  let t = 0;
  let stopT = -1;
  let wasContact = false;
  let contactStart = 0;
  let contactPeg = -1;
  const thA = record ? [] : null;
  const fA = record ? [] : null;
  const events = record ? [] : null;
  const far = P.dmax * 2.5;
  const maxSteps = Math.round(45 / dt);

  for (let step = 0; step < maxSteps; step++) {
    let kk = 0;
    let pp = 99;
    for (let k = 0; k < n; k++) {
      const p = wrap(pegs[k] + th);
      if (Math.abs(p) > far) sides[k] = p < 0 ? -1 : 1;
      if (Math.abs(p) < Math.abs(pp)) {
        pp = p;
        kk = k;
      }
    }
    let tq = 0;
    let contact = false;
    let slipped = 0;
    const s = sides[kk];
    if (s < 0 && pp > 0) {
      if (pp > P.dmax) {
        sides[kk] = 1;
        slipped = 1;
      } else {
        const u = pp / P.dmax;
        tq = -(P.Tmin + (P.F0 + P.K * pp - P.Tmin) * (1 - u * u));
        if (w < 0) tq *= P.loss; // 고무는 되밀 때 힘을 잃는다
        contact = true;
      }
    } else if (s > 0 && pp < 0) {
      if (pp < -P.dmax) {
        sides[kk] = -1;
        slipped = -1;
      } else {
        const u = -pp / P.dmax;
        tq = P.Tmin + (P.F0 - P.K * pp - P.Tmin) * (1 - u * u);
        if (w > 0) tq *= P.loss;
        contact = true;
      }
    }

    if (contact && !wasContact) {
      contactStart = t;
      contactPeg = kk;
    }
    if (slipped) {
      fv = w * 0.6;
      if (record) events.push({ type: "slip", t, dir: slipped, w, peg: kk, start: wasContact ? contactStart : t });
    } else if (!contact && wasContact && record) {
      events.push({ type: "bounce", t, peg: contactPeg, start: contactStart });
    }
    wasContact = contact;

    // 바늘 (시각용)
    if (contact) {
      const nf = pp;
      fv = (nf - f) / dt;
      f = nf;
    } else {
      fv += (-P.kf * f - P.cf * fv) * dt;
      f += fv * dt;
    }

    // 판
    if (w !== 0) {
      const aw = Math.abs(w);
      const fr = P.c0 + P.c1 * aw + P.c2 * aw * aw;
      let nw = w + (tq - Math.sign(w) * fr) * dt;
      if (Math.sign(nw) !== Math.sign(w) && Math.abs(tq) <= P.c0) nw = 0;
      w = nw;
    } else if (Math.abs(tq) > P.c0) {
      w += (tq - Math.sign(tq) * P.c0) * dt;
    }
    th += w * dt;
    t += dt;

    if (record) {
      thA.push(th);
      fA.push(f);
    }
    if (w === 0 && Math.abs(tq) <= P.c0) {
      if (stopT < 0) stopT = t;
      if (!record || t - stopT > 0.7) break;
    } else {
      stopT = -1;
    }
  }
  return {
    theta: th,
    t: stopT < 0 ? t : stopT,
    dt,
    th: record ? Float64Array.from(thA) : null,
    f: record ? Float32Array.from(fA) : null,
    events,
    theta0,
    omega0,
  };
}

function searchOmega(lay, theta0, target, P) {
  let lo = 0.3;
  let hi = 30;
  while (simulate(lay, theta0, hi, P).theta < target && hi < 400) hi *= 1.6;
  for (let i = 0; i < 34; i++) {
    const mid = (lo + hi) / 2;
    if (simulate(lay, theta0, mid, P).theta < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/* 당첨 칸(winner)은 이미 공정하게 뽑혀 있다. 여기서는 그 칸 안의 어디에 멈출지(연출)만 정하고,
 * 그 지점에 멈추도록 처음 회전 속도를 찾는다. 판의 움직임은 전부 물리 계산 결과다. */
export function planSpin(lay, theta0, winner, P, style = "mid", rand = Math.random) {
  const s = lay.slices[winner];
  const d = P.dmax;
  const targets = [];
  if (style === "creep") targets.push(s.end - d * 1.15);
  if (style === "fall") targets.push(s.start + d * 0.25);
  targets.push(s.start + s.size * (0.3 + 0.4 * rand()));
  targets.push(s.start + s.size * 0.5);
  let last = null;
  for (const r of targets) {
    const base = theta0 + P.turns * TAU;
    const target = -r + Math.ceil((base + r) / TAU) * TAU;
    const w0 = searchOmega(lay, theta0, target, P);
    // 되튐 때문에 단조롭지 않을 수 있어 주변을 조금 훑는다
    for (let k = 0; k < 41; k++) {
      const off = k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.0015;
      const wk = w0 * (1 + off);
      if (k > 0 && sliceAt(lay, simulate(lay, theta0, wk, P).theta) !== winner) continue;
      const sim = simulate(lay, theta0, wk, P, true);
      last = sim;
      if (sliceAt(lay, sim.theta) === winner) {
        sim.winner = winner;
        return sim;
      }
    }
  }
  last.winner = sliceAt(lay, last.theta);
  last.fallback = true;
  return last;
}

// 연출 분석: 마지막에 핀에 걸려 넘어갔는지(creep), 굴러 떨어졌는지(fall)
export function analyze(sim, lay) {
  const ev = sim.events || [];
  const T = sim.t;
  const n = lay.slices.length;
  let kind = "plain";
  let hangStart = null;
  let hangEnd = null;
  let neighbor = null;
  // 마지막 '앞으로 넘어간' 사건과 그 뒤의 되튐을 찾는다
  let lastSlip = null;
  for (let i = ev.length - 1; i >= 0; i--) {
    if (ev[i].type === "slip" && ev[i].dir > 0) {
      lastSlip = ev[i];
      break;
    }
  }
  const lastEv = ev[ev.length - 1];
  if (lastEv && lastEv.type === "bounce" && (!lastSlip || lastEv.t > lastSlip.t) && T - lastEv.t < 3) {
    // 가장 첫 되튐(처음 핀에 걸린 순간)부터
    let first = lastEv;
    for (let i = ev.length - 1; i >= 0 && ev[i].type === "bounce" && ev[i].peg === lastEv.peg; i--) first = ev[i];
    kind = "fall";
    hangStart = first.start;
    hangEnd = lastEv.t;
    neighbor = (lastEv.peg - 1 + n) % n;
  } else if (lastSlip && Math.abs(lastSlip.w) < 1.4 && T - lastSlip.t < 2.4) {
    kind = "creep";
    hangStart = lastSlip.start;
    hangEnd = lastSlip.t;
    neighbor = lastSlip.peg % n; // 넘어오기 전 칸
  }
  const focus = hangStart ?? T;
  const zoomStart = Math.max(0.6, focus - 1.3);
  const ticks = ev.filter((e) => e.type === "slip").map((e) => e.t);
  return { kind, hangStart, hangEnd, neighbor, zoomStart, T, ticks };
}

// 기록된 궤적에서 시간 t의 각도·바늘 휨
export function sample(sim, t) {
  const n = sim.th.length;
  const x = Math.max(0, Math.min(n - 1.001, t / sim.dt - 1));
  if (x < 0) return { th: sim.theta0, f: 0 };
  const i = Math.floor(x);
  const k = x - i;
  return { th: sim.th[i] + (sim.th[i + 1] - sim.th[i]) * k, f: sim.f[i] + (sim.f[i + 1] - sim.f[i]) * k };
}

export function omegaAt(sim, t) {
  const i = Math.max(0, Math.min(sim.th.length - 2, Math.floor(t / sim.dt)));
  return (sim.th[i + 1] - sim.th[i]) / sim.dt;
}

/* ---------- 그리기 ---------- */
const WOOD = "#a9662c";
const WOOD_DARK = "#6e3d14";
const WOOD_GRAIN = "#8b4f1d";
const INK = "#161616";

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class WheelView {
  constructor(canvas, { font = "sans-serif", hubText = "복불복" } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.font = font;
    this.hubText = hubText;
    this.lay = null;
    this.face = null;
    this.bursts = [];
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(200, rect.width || 340);
    const h = Math.max(200, rect.height || w);
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.W = w;
    this.H = h;
    this.Rout = Math.min(w / 2 - 8, h / 2 - 20);
    this.R = this.Rout - 15;
    this.Rp = this.R + 7.5;
    this.cx = w / 2;
    this.cy = h / 2 + 12;
    if (this.lay) this.buildFace();
  }

  setLayout(lay) {
    this.lay = lay;
    this.buildFace();
  }

  buildFace() {
    const sc = this.dpr * 2; // 줌 2배까지 선명하게
    const size = Math.ceil(this.Rout * 2 * sc) + 4;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const g = c.getContext("2d");
    g.translate(size / 2, size / 2);
    g.scale(sc, sc);
    const { R, Rout, Rp } = this;
    const lay = this.lay;
    const rnd = seeded(7);

    // 나무 테
    g.beginPath();
    g.arc(0, 0, Rout, 0, TAU);
    g.fillStyle = WOOD;
    g.fill();
    g.lineWidth = 1.1;
    g.strokeStyle = WOOD_GRAIN;
    for (let i = 0; i < 26; i++) {
      const r = R + 2 + rnd() * (Rout - R - 4);
      const a = rnd() * TAU;
      g.beginPath();
      g.arc(0, 0, r, a, a + 0.3 + rnd() * 1.4);
      g.stroke();
    }
    g.lineWidth = 2.5;
    g.strokeStyle = WOOD_DARK;
    g.beginPath();
    g.arc(0, 0, Rout - 1.2, 0, TAU);
    g.stroke();

    // 칸
    for (const s of lay.slices) {
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, R, -Math.PI / 2 + s.start, -Math.PI / 2 + s.end);
      g.closePath();
      g.fillStyle = s.color.bg;
      g.fill();
    }
    // 칸 경계선
    g.strokeStyle = INK;
    g.lineWidth = 2;
    for (const s of lay.slices) {
      const a = -Math.PI / 2 + s.start;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * R, Math.sin(a) * R);
      g.stroke();
    }
    g.lineWidth = 3;
    g.beginPath();
    g.arc(0, 0, R, 0, TAU);
    g.stroke();

    // 글자
    for (const s of lay.slices) {
      const mid = -Math.PI / 2 + (s.start + s.end) / 2;
      const arcLen = s.size * R * 0.62;
      let fs = Math.max(10, Math.min(22, arcLen * 0.62, 26 - lay.slices.length * 0.45));
      g.save();
      g.rotate(mid);
      g.fillStyle = s.color.fg;
      g.textAlign = "right";
      g.textBaseline = "middle";
      const maxW = R * 0.66;
      let text = s.name;
      g.font = `700 ${fs}px ${this.font}`;
      while (g.measureText(text).width > maxW && fs > 11) {
        fs -= 1;
        g.font = `700 ${fs}px ${this.font}`;
      }
      if (g.measureText(text).width > maxW) {
        while (text.length > 1 && g.measureText(text + "…").width > maxW) text = text.slice(0, -1);
        text += "…";
      }
      g.fillText(text, R - 14, 0);
      if (s.weight > 1 && s.size > 0.28) {
        g.font = `800 ${Math.max(10, fs * 0.62)}px ${this.font}`;
        g.globalAlpha = 0.75;
        g.fillText(`×${s.weight}`, R - 14, fs * 0.95);
        g.globalAlpha = 1;
      }
      g.restore();
    }

    // 핀 (금속)
    for (const s of lay.slices) {
      const a = -Math.PI / 2 + s.start;
      const x = Math.cos(a) * Rp;
      const y = Math.sin(a) * Rp;
      g.beginPath();
      g.arc(x, y, 4.2, 0, TAU);
      g.fillStyle = "#d9dde3";
      g.fill();
      g.lineWidth = 1.6;
      g.strokeStyle = INK;
      g.stroke();
      g.beginPath();
      g.arc(x - 1.2, y - 1.2, 1.2, 0, TAU);
      g.fillStyle = "#ffffff";
      g.fill();
    }

    // 가운데 허브
    const hr = Math.max(26, R * 0.2);
    g.beginPath();
    g.arc(0, 0, hr, 0, TAU);
    g.fillStyle = INK;
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = "#ffd400";
    g.beginPath();
    g.arc(0, 0, hr - 5, 0, TAU);
    g.stroke();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      g.beginPath();
      g.arc(Math.cos(a) * (hr - 12), Math.sin(a) * (hr - 12), 1.6, 0, TAU);
      g.fillStyle = "#8c8f96";
      g.fill();
    }
    this.face = c;
    this.faceScale = sc;
    this.hubR = hr;
  }

  burst() {
    this.bursts.push({ t: performance.now() });
  }

  // theta: 판 각도, flap: 바늘 휨(판 각도 단위), cam: {zoom, lift}
  draw(theta, flap = 0, cam = { zoom: 1 }, opts = {}) {
    const g = this.ctx;
    const { dpr, W, H, cx, cy, Rout, Rp } = this;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    if (!this.face) return;
    const z = cam.zoom || 1;
    const fx = cx;
    const fy = cy - Rp;
    if (z !== 1) {
      const k = (z - 1) / 1.6;
      const sx = fx;
      const sy = fy + (H * 0.3 - fy) * Math.min(1, k);
      g.translate(sx, sy);
      g.scale(z, z);
      g.translate(-fx, -fy);
    }
    const sq = opts.squash || 0; // 인트로 착지 찌그러짐
    g.save();
    g.translate(cx, cy);
    if (sq) g.scale(1 + sq, 1 - sq);
    // 그림자 (납작)
    g.beginPath();
    g.ellipse(6, 9, Rout, Rout, 0, 0, TAU);
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.fill();
    g.rotate(theta);
    const fsz = this.face.width / this.faceScale;
    g.drawImage(this.face, -fsz / 2, -fsz / 2, fsz, fsz);
    g.restore();

    // 허브 글자 (회전하지 않음)
    g.save();
    g.translate(cx, cy);
    if (sq) g.scale(1 + sq, 1 - sq);
    g.fillStyle = "#ffd400";
    g.font = `400 ${Math.round(this.hubR * 0.4)}px ${this.font}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(this.hubText, 0, 1);
    g.restore();

    this.drawFlapper(flap, sq);

    // 틱 표시
    const now = performance.now();
    this.bursts = this.bursts.filter((b) => now - b.t < 140);
    for (const b of this.bursts) {
      const k = (now - b.t) / 140;
      const tipX = cx + Math.sin(flap) * (Rp - 2);
      const tipY = cy - Math.cos(flap) * (Rp - 2);
      g.strokeStyle = "#fff6c2";
      g.lineWidth = 2.2 * (1 - k);
      for (let i = 0; i < 4; i++) {
        const a = -Math.PI / 2 + (i - 1.5) * 0.55;
        const r0 = 9 + k * 6;
        const r1 = 15 + k * 12;
        g.beginPath();
        g.moveTo(tipX + Math.cos(a) * r0, tipY + Math.sin(a) * r0);
        g.lineTo(tipX + Math.cos(a) * r1, tipY + Math.sin(a) * r1);
        g.stroke();
      }
    }
  }

  drawFlapper(flap, sq = 0) {
    const g = this.ctx;
    const { cx, cy, Rout, Rp } = this;
    const topY = cy - Rout * (1 - sq) - 18;
    const tipR = Rp - 6;
    const tx = cx + Math.sin(flap) * tipR * 1.0;
    const ty = cy - Math.cos(flap) * tipR * (1 - sq);
    // 받침 블록
    g.fillStyle = INK;
    g.fillRect(cx - 17, topY - 12, 34, 16);
    g.fillStyle = "#ffd400";
    g.fillRect(cx - 17, topY - 12, 34, 4);
    // 고무 바늘: 끝이 핀에 밀리면 휘어진다
    const midY = (topY + ty) / 2;
    const bend = (tx - cx) * 0.2;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(cx, topY);
    g.quadraticCurveTo(cx + bend, midY, tx, ty);
    g.strokeStyle = INK;
    g.lineWidth = 13;
    g.stroke();
    g.beginPath();
    g.moveTo(cx, topY);
    g.quadraticCurveTo(cx + bend, midY, tx, ty);
    g.strokeStyle = "#ff3b2f";
    g.lineWidth = 8;
    g.stroke();
    // 볼트
    g.beginPath();
    g.arc(cx, topY - 3, 3, 0, TAU);
    g.fillStyle = "#d9dde3";
    g.fill();
  }
}

/* ---------- 종이 꽃가루 ---------- */
export function confetti(canvas, { count = 90, colors = SLICE_COLORS.map((c) => c.bg), from = "sides" } = {}) {
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const W = rect.width;
  const H = rect.height;
  const parts = [];
  for (let i = 0; i < count; i++) {
    const left = from === "top" ? Math.random() < 0.5 : i % 2 === 0;
    const x = from === "top" ? Math.random() * W : left ? -8 : W + 8;
    const y = from === "top" ? -20 - Math.random() * 60 : H * (0.55 + Math.random() * 0.2);
    const sp = from === "top" ? 0 : 7 + Math.random() * 7;
    const ang = from === "top" ? 0 : left ? -Math.PI / 3 - Math.random() * 0.5 : -Math.PI + Math.PI / 3 + Math.random() * 0.5;
    parts.push({
      x,
      y,
      vx: Math.cos(ang) * sp + (from === "top" ? (Math.random() - 0.5) * 2 : 0),
      vy: Math.sin(ang) * sp + (from === "top" ? Math.random() * 2 : 0),
      w: 5 + Math.random() * 5,
      h: 12 + Math.random() * 12,
      rot: Math.random() * TAU,
      vr: (Math.random() - 0.5) * 0.3,
      ph: Math.random() * TAU,
      vp: 0.12 + Math.random() * 0.15,
      c: colors[i % colors.length],
    });
  }
  let raf;
  const start = performance.now();
  const step = (now) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    let alive = 0;
    for (const p of parts) {
      p.vy += 0.22;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.ph += p.vp;
      if (p.y < H + 30) alive++;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.ph));
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (alive && now - start < 6000) raf = requestAnimationFrame(step);
    else ctx.clearRect(0, 0, W, H);
  };
  raf = requestAnimationFrame(step);
  return () => {
    cancelAnimationFrame(raf);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
}
