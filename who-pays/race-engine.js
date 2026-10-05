// 레이스 물리 엔진 (DOM 없음 — Node 에서도 시뮬레이션 가능)
// 좌표계: 가로 W(360) 유닛, 세로는 아래로 갈수록 +y. 결승선은 맨 아래.

export const W = 360;
export const MR = 10; // 구슬 반지름
const G = 900;
const MAX_V = 820;
export const STEP = 1 / 120;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/* ---------------- 코스 생성 ---------------- */
function buildCourse(rand) {
  const segs = [];
  const circles = [];
  const paddles = [];
  const marks = []; // 구간 이름 (해설용)

  const seg = (ax, ay, bx, by, kind = "wall", t = 6) =>
    segs.push({ ax, ay, bx, by, t, kind, minY: Math.min(ay, by) - t - MR, maxY: Math.max(ay, by) + t + MR, live: true });
  const circle = (x, y, r, kind) => circles.push({ x, y, r, kind, flash: 0 });
  const rr = (a, b) => a + rand() * (b - a);

  const builders = {
    pegs(y0) {
      const rows = 5 + Math.floor(rand() * 2);
      const dx = 48;
      const jitter = rr(-10, 10);
      for (let r = 0; r < rows; r++) {
        const off = (r % 2) * (dx / 2) + jitter;
        for (let x = 10 + off; x <= W - 10; x += dx) {
          if (x < 36 || x > W - 36) continue; // 벽과 사이에 끼지 않도록
          circle(x, y0 + 30 + r * 46, 5, "peg");
        }
      }
      return y0 + 30 + rows * 46 + 10;
    },
    zigzag(y0) {
      const n = 3 + Math.floor(rand() * 2);
      const flip = rand() < 0.5 ? 0 : 1;
      for (let i = 0; i < n; i++) {
        const yt = y0 + 20 + i * 100;
        if ((i + flip) % 2 === 0) seg(0, yt, W * 0.72, yt + 54, "ramp");
        else seg(W, yt, W * 0.28, yt + 54, "ramp");
      }
      return y0 + 20 + n * 100 + 20;
    },
    funnel(y0) {
      const gap = 48;
      const cx = W / 2 + rr(-60, 60);
      seg(0, y0 + 10, cx - gap / 2, y0 + 120, "ramp");
      seg(W, y0 + 10, cx + gap / 2, y0 + 120, "ramp");
      if (rand() < 0.6) circle(cx + rr(-14, 14), y0 + 200, 16, "bumper");
      return y0 + 250;
    },
    paddles(y0) {
      const w = rr(2.1, 3.2) * (rand() < 0.5 ? -1 : 1);
      paddles.push({ cx: W * 0.27 + rr(-8, 8), cy: y0 + 80, len: 96, ang: rand() * Math.PI, w, t: 6 });
      paddles.push({ cx: W * 0.73 + rr(-8, 8), cy: y0 + 80, len: 96, ang: rand() * Math.PI, w: -w, t: 6 });
      if (rand() < 0.55) paddles.push({ cx: W / 2 + rr(-20, 20), cy: y0 + 200, len: 110, ang: rand() * Math.PI, w: rr(1.6, 2.6) * (rand() < 0.5 ? -1 : 1), t: 6 });
      return y0 + 290;
    },
    bumpers(y0) {
      const pts = [];
      let tries = 0;
      while (pts.length < 5 && tries++ < 200) {
        const p = { x: rr(46, W - 46), y: rr(y0 + 40, y0 + 230) };
        if (pts.every((q) => Math.hypot(p.x - q.x, p.y - q.y) > 82)) pts.push(p);
      }
      pts.forEach((p) => circle(p.x, p.y, rr(15, 20), "bumper"));
      return y0 + 280;
    },
    slalom(y0) {
      const n = 5;
      const flip = rand() < 0.5 ? 0 : 1;
      for (let i = 0; i < n; i++) {
        const yt = y0 + 20 + i * 76;
        if ((i + flip) % 2 === 0) seg(0, yt, W * 0.4, yt + 40, "ramp");
        else seg(W, yt, W * 0.6, yt + 40, "ramp");
      }
      return y0 + 20 + n * 76 + 20;
    },
    split(y0) {
      // 갈림길: 가운데 칸막이 + 양쪽 다른 장애물
      seg(W / 2 - 26, y0 + 60, W / 2, y0 + 26, "ramp");
      seg(W / 2, y0 + 26, W / 2 + 26, y0 + 60, "ramp");
      seg(W / 2, y0 + 50, W / 2, y0 + 300, "wall", 8);
      const pegSide = rand() < 0.5 ? 0 : 1;
      for (let r = 0; r < 5; r++) {
        const off = (r % 2) * 20;
        for (let k = 0; k < 4; k++) {
          const x = (pegSide ? W / 2 : 0) + 24 + off + k * 40;
          if (x < (pegSide ? W - 36 : W / 2 - 36) && x > (pegSide ? W / 2 + 36 : 36)) circle(x, y0 + 90 + r * 40, 5, "peg");
        }
      }
      const bx = pegSide ? W * 0.25 : W * 0.75;
      circle(bx + rr(-10, 10), y0 + 130, 18, "bumper");
      circle(bx + rr(-30, 30), y0 + 240, 14, "bumper");
      return y0 + 330;
    },
  };

  const names = Object.keys(builders);
  let y = 40;
  let prev = "";
  const count = 7 + Math.floor(rand() * 2);
  for (let i = 0; i < count; i++) {
    let type;
    do type = names[Math.floor(rand() * names.length)];
    while (type === prev);
    prev = type;
    marks.push({ y, type });
    y = builders[type](y);
  }
  // 마지막 코너: 항상 지그재그 후 결승
  marks.push({ y, type: "final" });
  seg(W, y + 20, W * 0.22, y + 74, "ramp");
  seg(0, y + 130, W * 0.62, y + 176, "ramp");
  const finishY = y + 250;
  const floorY = finishY + 150;
  seg(0, floorY, W, floorY, "floor", 10);
  // 양쪽 벽
  seg(0, -400, 0, floorY + 10, "wall", 4);
  seg(W, -400, W, floorY + 10, "wall", 4);
  // 출발 게이트
  seg(0, 0, W, 0, "gate", 6);

  return { segs, circles, paddles, marks, finishY, floorY };
}

/* ---------------- 엔진 ---------------- */
export function createRaceEngine({ count, rand, startSlots }) {
  const course = buildCourse(rand);
  const { segs, circles, paddles, finishY } = course;
  const events = [];
  let time = 0;
  let started = false;
  let finishCount = 0;

  // 출발 위치: startSlots[i] = 그 구슬이 받는 자리 번호 (호출 측에서 무작위로 섞음)
  const cols = Math.min(count, 6);
  const marbles = Array.from({ length: count }, (_, i) => {
    const slot = startSlots ? startSlots[i] : i;
    const row = Math.floor(slot / cols);
    const col = slot % cols;
    const rowCount = Math.min(cols, count - row * cols);
    return {
      i,
      x: W / 2 + (col - (rowCount - 1) / 2) * 50 + (rand() - 0.5) * 4,
      y: -18 - row * 26,
      vx: 0,
      vy: 0,
      r: MR,
      finished: false,
      place: 0,
      finishT: 0,
      slowT: 0,
      shieldT: 0,
      magnetT: 0,
      boostT: 0,
      spin: 0,
      rot: 0,
      stuckT: 0,
      chkX: 0,
      chkY: 0,
    };
  });

  function open() {
    started = true;
    segs.forEach((s) => {
      if (s.kind === "gate") s.live = false;
    });
  }

  function collideSeg(m, ax, ay, bx, by, t, rest, svx = 0, svy = 0, fric = 0.998) {
    const dx = bx - ax;
    const dy = by - ay;
    const L2 = dx * dx + dy * dy || 1e-6;
    const k = clamp(((m.x - ax) * dx + (m.y - ay) * dy) / L2, 0, 1);
    const px = ax + dx * k;
    const py = ay + dy * k;
    let nx = m.x - px;
    let ny = m.y - py;
    const R = m.r + t / 2;
    const d2 = nx * nx + ny * ny;
    if (d2 >= R * R) return false;
    const d = Math.sqrt(d2) || 1e-6;
    nx /= d;
    ny /= d;
    m.x = px + nx * R;
    m.y = py + ny * R;
    const rvx = m.vx - svx;
    const rvy = m.vy - svy;
    const vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      const tx = rvx - vn * nx;
      const ty = rvy - vn * ny;
      m.vx = tx * fric - vn * rest * nx + svx;
      m.vy = ty * fric - vn * rest * ny + svy;
    }
    return -vn;
  }

  function collideCircle(m, c) {
    const dx = m.x - c.x;
    const dy = m.y - c.y;
    const R = m.r + c.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= R * R) return;
    const d = Math.sqrt(d2) || 1e-6;
    const nx = dx / d;
    const ny = dy / d;
    m.x = c.x + nx * R;
    m.y = c.y + ny * R;
    const vn = m.vx * nx + m.vy * ny;
    if (c.kind === "bumper") {
      const out = Math.max(Math.abs(vn) * 0.9, 360);
      m.vx += (out - vn) * nx;
      m.vy += (out - vn) * ny;
      if (c.flash <= 0.05) events.push({ type: "bumper", i: m.i, x: c.x, y: c.y });
      c.flash = 1;
    } else if (vn < 0) {
      m.vx -= 1.5 * vn * nx;
      m.vy -= 1.5 * vn * ny;
    }
  }

  function step() {
    const dt = STEP;
    time += dt;
    // 패들 회전
    for (const p of paddles) p.ang += p.w * dt;
    for (const c of circles) if (c.flash > 0) c.flash = Math.max(0, c.flash - dt * 3);

    for (const m of marbles) {
      let ax = 0;
      let ay = G;
      if (m.slowT > 0) {
        m.slowT -= dt;
        ay *= 0.25;
        m.vx *= 1 - 3.2 * dt;
        m.vy *= 1 - 3.2 * dt;
        m.spin = 14;
      }
      if (m.magnetT > 0) {
        m.magnetT -= dt;
        ax += (W / 2 - m.x) * 9;
        m.vx *= 1 - 3 * dt;
      }
      if (m.shieldT > 0) m.shieldT -= dt;
      if (m.boostT > 0) {
        m.boostT -= dt;
        ay += 500;
      }
      m.vx += ax * dt;
      m.vy += ay * dt;
      m.vx *= 1 - 0.12 * dt;
      m.vy *= 1 - 0.12 * dt;
      const sp = Math.hypot(m.vx, m.vy);
      const cap = m.boostT > 0 ? MAX_V * 1.3 : MAX_V;
      if (sp > cap) {
        m.vx *= cap / sp;
        m.vy *= cap / sp;
      }
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.rot += (m.vx / m.r) * dt + m.spin * dt;
      if (m.spin > 0) m.spin = Math.max(0, m.spin - dt * 6);
    }

    // 구슬끼리 충돌
    for (let a = 0; a < marbles.length; a++) {
      const A = marbles[a];
      for (let b = a + 1; b < marbles.length; b++) {
        const B = marbles[b];
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const R = A.r + B.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= R * R) continue;
        const d = Math.sqrt(d2) || 1e-6;
        const nx = dx / d;
        const ny = dy / d;
        const push = (R - d) / 2;
        A.x -= nx * push;
        A.y -= ny * push;
        B.x += nx * push;
        B.y += ny * push;
        const rv = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
        if (rv < 0) {
          const j = (-(1 + 0.75) * rv) / 2;
          A.vx -= j * nx;
          A.vy -= j * ny;
          B.vx += j * nx;
          B.vy += j * ny;
          if (-rv > 260 && started && !A.finished && !B.finished) events.push({ type: "collide", a: A.i, b: B.i, speed: -rv });
        }
      }
    }

    // 고정 장애물
    for (const m of marbles) {
      for (const s of segs) {
        if (!s.live || m.y < s.minY || m.y > s.maxY) continue;
        const rest = s.kind === "floor" ? 0.2 : 0.35;
        collideSeg(m, s.ax, s.ay, s.bx, s.by, s.t, rest);
      }
      for (const c of circles) {
        if (Math.abs(m.y - c.y) > c.r + m.r) continue;
        collideCircle(m, c);
      }
      for (const p of paddles) {
        if (Math.abs(m.y - p.cy) > p.len / 2 + m.r + 6) continue;
        const hx = (Math.cos(p.ang) * p.len) / 2;
        const hy = (Math.sin(p.ang) * p.len) / 2;
        // 접촉점 속도(회전) 근사: 구슬 위치 기준
        const rx = m.x - p.cx;
        const ry = m.y - p.cy;
        collideSeg(m, p.cx - hx, p.cy - hy, p.cx + hx, p.cy + hy, p.t, 0.4, -p.w * ry, p.w * rx, 1);
      }
      // 화면 밖으로 튀는 것 방지
      if (m.x < m.r) m.x = m.r;
      if (m.x > W - m.r) m.x = W - m.r;

      if (!m.finished && m.y > finishY) {
        m.finished = true;
        m.place = ++finishCount;
        m.finishT = time;
        m.slowT = 0;
        m.magnetT = 0;
        events.push({ type: "finish", i: m.i, place: m.place });
      }

      // 끼임 방지: 오래 멈춰 있으면 살짝 흔들기
      if (started && !m.finished) {
        m.stuckT += dt;
        if (m.stuckT > 1.2) {
          if (Math.hypot(m.x - m.chkX, m.y - m.chkY) < 8 && m.slowT <= 0) {
            m.vx = (m.x < W / 2 ? 1 : -1) * (120 + rand() * 80);
            m.vy = -160;
          }
          m.chkX = m.x;
          m.chkY = m.y;
          m.stuckT = 0;
        }
      }
    }
  }

  // 순위: 도착한 순서 → 아직 달리는 구슬은 더 아래(앞)에 있는 순
  function ranking() {
    return marbles
      .slice()
      .sort((a, b) => {
        if (a.finished && b.finished) return a.place - b.place;
        if (a.finished) return -1;
        if (b.finished) return 1;
        return b.y - a.y;
      })
      .map((m) => m.i);
  }

  function useItem(i, kind) {
    const m = marbles[i];
    if (!m || m.finished || !started) return { ok: false };
    if (kind === "boost") {
      m.vy = Math.max(m.vy, 0) + 480;
      m.vx *= 0.4;
      m.boostT = 0.7;
      m.stuckT = 0;
      return { ok: true };
    }
    if (kind === "shield") {
      m.shieldT = 3;
      return { ok: true };
    }
    if (kind === "magnet") {
      m.magnetT = 1.6;
      return { ok: true };
    }
    if (kind === "banana") {
      const rivals = marbles.filter((o) => o !== m && !o.finished);
      if (!rivals.length) return { ok: true, target: -1 };
      const t = rivals[Math.floor(rand() * rivals.length)];
      if (t.shieldT > 0) return { ok: true, target: t.i, blocked: true };
      t.slowT = 2;
      t.vx *= 0.2;
      t.vy *= 0.2;
      t.spin = 14;
      return { ok: true, target: t.i };
    }
    return { ok: false };
  }

  return {
    course,
    marbles,
    events,
    step,
    open,
    useItem,
    ranking,
    get time() {
      return time;
    },
    get started() {
      return started;
    },
    get finishCount() {
      return finishCount;
    },
  };
}
