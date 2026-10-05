// 문방구 캡슐 뽑기 기계 (캔버스): 유리 돔 + 캡슐 물리 + 손잡이(래칫) + 배출구 + 굴러나오는 캡슐
// 인트로 데모와 실제 뽑기 화면이 같은 기계를 쓴다.
import { CANVAS_FONT } from "../shared/kit.js";

const TAU = Math.PI * 2;
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const spring = (t) => (t <= 0 ? 0 : t >= 1.6 ? 1 : 1 - Math.exp(-7 * t) * Math.cos(10.5 * t));
export const squash = (tau, amp = 0.3) => (tau < 0 ? 0 : amp * Math.exp(-8 * tau) * Math.cos(18 * tau));

// 캔버스 장식 색 (style.css 의 --art-* 를 읽고, 못 읽으면 기본값)
export function readArt() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n, f) => cs.getPropertyValue(n).trim() || f;
  return {
    brand: v("--brand", "#e8392f"),
    brandDeep: v("--brand-pressed", "#c22a21"),
    blue: v("--art-blue", "#2f6fe0"),
    blueDeep: v("--art-blue-deep", "#1f4fae"),
    chrome: v("--art-chrome", "#d9dde3"),
    chromeDeep: v("--art-chrome-deep", "#8b939f"),
    ink: v("--art-ink", "#1d1a17"),
    paper: v("--art-paper", "#fbf3e4"),
    cream: v("--art-cream", "#fff7d6"),
    gold: v("--art-gold", "#f2b705"),
    goldLight: v("--art-gold-light", "#ffe27a"),
    glass: v("--art-glass", "#dff1fb"),
    caps: [1, 2, 3, 4, 5, 6, 7].map((k) => v(`--art-cap${k}`, ["#ff5a5f", "#3b82f6", "#ffd23f", "#3ddc84", "#ff8fc7", "#ff9a2e", "#19c3d3"][k - 1])),
    hand: v("--art-glove", "#ffffff"),
    display: `${v("--font-display", CANVAS_FONT)}`,
    pen: `${v("--art-font-pen", CANVAS_FONT)}`,
  };
}

// 캡슐 하나 그리기. 위 반쪽은 색, 아래 반쪽은 반투명 (안에 접힌 종이)
export function drawCapsule(ctx, x, y, r, color, gold, art, { rot = 0, sx = 1, sy = 1, alpha = 1, twist = 0 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(sx, sy);
  // 아래 반쪽
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI);
  ctx.closePath();
  ctx.fillStyle = gold ? art.gold : "rgba(255,255,255,0.86)";
  ctx.fill();
  if (!gold) {
    ctx.fillStyle = "rgba(0,0,0,0.06)";
    ctx.fillRect(-r * 0.5, r * 0.12, r, r * 0.16);
    ctx.fillRect(-r * 0.4, r * 0.38, r * 0.8, r * 0.12);
  }
  // 위 반쪽 (비틀면 살짝 돌아감)
  ctx.save();
  ctx.translate(0, -twist * r * 0.12);
  ctx.rotate(twist * 0.22);
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI, TAU);
  ctx.closePath();
  ctx.fillStyle = gold ? art.goldLight : color;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-r * 0.38, -r * 0.5, r * 0.26, r * 0.13, -0.6, 0, TAU);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fill();
  ctx.restore();
  // 이음매 + 외곽선
  ctx.lineWidth = Math.max(1.2, r * 0.08);
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.lineTo(r, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.stroke();
  if (gold) {
    ctx.beginPath();
    ctx.moveTo(r * 0.2, r * 0.25);
    ctx.lineTo(r * 0.55, r * 0.6);
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = r * 0.12;
    ctx.lineCap = "round";
    ctx.stroke();
  }
  ctx.restore();
}

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createMachine(canvas) {
  const ctx = canvas.getContext("2d");
  const art = readArt();
  let w = 1;
  let h = 1;
  let dpr = 1;
  let g = null; // 기하
  const caps = [];
  let knobAngle = 0;
  let progress = 0; // 한 바퀴 진행 (0~1)
  let out = null; // 배출된 캡슐
  let flapK = 0;
  let shakeT = 0;
  let clickFx = [];
  let hand = null; // { a, alpha }
  let sinkSet = new Map();

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, Math.round(rect.width));
    h = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    const old = g;
    g = geometry(w, h);
    // 크기가 바뀌면 캡슐을 비율대로 옮긴다
    if (old && old.R) {
      const k = g.R / old.R;
      caps.forEach((c) => {
        c.x = g.cx + (c.x - old.cx) * k;
        c.y = g.domeCy + (c.y - old.domeCy) * k;
        c.r *= k;
      });
    }
  }

  function geometry(W, H) {
    const signH = 44;
    const baseH = 16;
    const R = Math.max(60, Math.min(W * 0.4, (H - signH - baseH) * 0.33));
    const bw = Math.min(W - 12, R * 2.3);
    const domeH = R * 1.74 + 2;
    const bh = Math.max(120, Math.min(H - signH - baseH - domeH, R * 2.05));
    const top = Math.max(0, Math.round((H - (signH + domeH + bh + baseH)) / 2));
    const cx = W / 2;
    const domeCy = top + signH + R + 2;
    const bodyTop = domeCy + R * 0.74;
    const bx = cx - bw / 2;
    const bodyBot = bodyTop + bh;
    const knob = { x: bx + bw * 0.71, y: bodyTop + bh * 0.36, r: Math.min(bw * 0.16, bh * 0.19) };
    const slot = { x: bx + bw * 0.08, y: bodyTop + bh * 0.13, w: bw * 0.36, h: Math.max(52, bh * 0.2) };
    const chute = { x: bx + bw * 0.08, y: bodyTop + bh * 0.5, w: bw * 0.4, h: bh * 0.36 };
    const decal = { x: bx + bw * 0.54, y: knob.y + knob.r * 1.65, w: bw * 0.38, h: bodyTop + bh * 0.86 - (knob.y + knob.r * 1.65) };
    return { W, H, R, top, cx, domeCy, bodyTop, floorY: bodyTop - 8, bx, bw, bh, bodyBot, knob, slot, chute, decal, holeX: cx, signH };
  }

  /* ---------- 캡슐 채우기 ---------- */
  function capRadius(n) {
    const area = Math.PI * g.R * g.R * 0.82;
    return Math.max(8, Math.min(g.R * 0.17, Math.sqrt((0.5 * area) / (Math.max(1, n) * Math.PI))));
  }

  // items: [{ id, gold }], drop: true 면 위에서 쏟아지듯
  function fill(items, { drop = false, stagger = 0.06 } = {}) {
    caps.length = 0;
    sinkSet.clear();
    const r = capRadius(items.length);
    items.forEach((it, k) => {
      const color = art.caps[(it.color ?? k) % art.caps.length];
      if (drop) {
        caps.push({ id: it.id, gold: !!it.gold, color, r, x: g.cx + (Math.random() - 0.5) * g.R * 0.5, y: g.domeCy - g.R - r * 2 - k * r * 0.9, vx: (Math.random() - 0.5) * 60, vy: 0, rot: Math.random() * TAU, vr: 0, inside: false, delay: k * stagger });
      } else {
        // 바닥부터 층층이 쌓아 둔다
        const perRow = Math.max(1, Math.floor((g.R * 1.6) / (r * 2.05)));
        const row = Math.floor(k / perRow);
        const col = k % perRow;
        const y = g.floorY - r - row * r * 1.8;
        const half = Math.sqrt(Math.max(0, g.R * g.R - (y - g.domeCy) ** 2)) - r - 4;
        const span = Math.min(half * 2, perRow * r * 2.05);
        const x = g.cx - span / 2 + (col + 0.5) * (span / perRow) + (row % 2 ? r * 0.5 : 0);
        caps.push({ id: it.id, gold: !!it.gold, color, r, x, y, vx: 0, vy: 0, rot: Math.random() * TAU, vr: 0, inside: true, delay: 0 });
      }
    });
    if (!drop) for (let k = 0; k < 120; k++) physics(1 / 120);
  }

  function physics(dt) {
    const G = 1500;
    const cx = g.cx;
    const cy = g.domeCy;
    for (const c of caps) {
      if (c.delay > 0) {
        c.delay -= dt;
        continue;
      }
      const sink = sinkSet.get(c.id);
      if (sink) continue;
      c.vy += G * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rot += c.vr * dt;
      c.vr *= 0.98;
      const dx = c.x - cx;
      const dy = c.y - cy;
      const d = Math.hypot(dx, dy) || 1;
      const lim = g.R - c.r - 5;
      if (!c.inside && d < lim && c.y > cy - g.R * 0.6) c.inside = true;
      if (c.inside && d > lim) {
        const nx = dx / d;
        const ny = dy / d;
        c.x = cx + nx * lim;
        c.y = cy + ny * lim;
        const vn = c.vx * nx + c.vy * ny;
        if (vn > 0) {
          c.vx -= 1.3 * vn * nx;
          c.vy -= 1.3 * vn * ny;
        }
        c.vx *= 0.985;
        c.vr += (c.vx * ny - c.vy * nx) * 0.002;
      }
      if (c.y > g.floorY - c.r) {
        c.y = g.floorY - c.r;
        if (c.vy > 0) c.vy *= -0.25;
        c.vx *= 0.9;
        c.vr = c.vx / c.r;
      }
    }
    for (let it = 0; it < 2; it++) {
      for (let i = 0; i < caps.length; i++) {
        const a = caps[i];
        if (a.delay > 0 || sinkSet.has(a.id)) continue;
        for (let j = i + 1; j < caps.length; j++) {
          const b = caps[j];
          if (b.delay > 0 || sinkSet.has(b.id)) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const min = a.r + b.r;
          const d2 = dx * dx + dy * dy;
          if (d2 >= min * min || d2 === 0) continue;
          const d = Math.sqrt(d2);
          const nx = dx / d;
          const ny = dy / d;
          const push = (min - d) / 2;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
          const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rv < 0) {
            const imp = -rv * 0.6;
            a.vx -= imp * nx;
            a.vy -= imp * ny;
            b.vx += imp * nx;
            b.vy += imp * ny;
          }
        }
      }
    }
  }

  // 덜컹: 캡슐들을 살짝 튀운다
  function jiggle(power = 1) {
    shakeT = Math.max(shakeT, 0.18 * power);
    caps.forEach((c) => {
      c.vx += (Math.random() - 0.5) * 260 * power;
      c.vy -= (120 + Math.random() * 260) * power;
      c.vr += (Math.random() - 0.5) * 8 * power;
    });
  }

  /* ---------- 손잡이 ---------- */
  function setKnob(angle) {
    knobAngle = angle;
  }
  function click(label = "딸깍") {
    clickFx.push({ t: 0, label, a: knobAngle });
    jiggle(0.55);
  }

  /* ---------- 배출: 고른 캡슐이 구멍으로 빠져 배출구로 굴러나옴 ---------- */
  function dispense(id, onLanded) {
    const c = caps.find((x) => x.id === id) || caps[0];
    if (!c) return;
    sinkSet.set(c.id, { t: 0, x0: c.x, y0: c.y });
    const outR = Math.min(g.chute.h * 0.3, 30);
    out = {
      id: c.id, gold: c.gold, color: c.color, r: outR, phase: "wait", t: 0,
      x: g.chute.x + g.chute.w * 0.72, y: g.chute.y - outR, vx: -70, vy: 0, rot: 0, land: -9, onLanded, landed: false,
    };
  }

  function clearOut() {
    out = null;
  }

  /* ---------- 매 프레임 ---------- */
  function update(dt) {
    dt = Math.min(dt, 1 / 30);
    const sub = 3;
    for (let k = 0; k < sub; k++) physics(dt / sub);
    for (const [id, s] of sinkSet) {
      s.t += dt;
      if (s.t > 0.4) {
        const i = caps.findIndex((c) => c.id === id);
        if (i >= 0) caps.splice(i, 1);
        sinkSet.delete(id);
        if (out && out.id === id && out.phase === "wait") out.phase = "fall";
      }
    }
    if (out) {
      out.t += dt;
      if (out.phase === "fall") {
        flapK = Math.min(1, flapK + dt * 8);
        out.vy += 1700 * dt;
        out.x += out.vx * dt;
        out.y += out.vy * dt;
        out.rot += (out.vx / out.r) * dt;
        const floor = g.chute.y + g.chute.h - 8 - out.r;
        const left = g.chute.x + 8 + out.r;
        if (out.x < left) {
          out.x = left;
          out.vx = Math.abs(out.vx) * 0.5;
        }
        if (out.y > floor) {
          out.y = floor;
          if (out.vy > 120) {
            out.land = out.t;
            out.amp = Math.min(0.38, out.vy / 2600);
            out.vy *= -0.42;
            out.vx *= 0.8;
          } else {
            out.vy = 0;
            out.vx *= 0.9;
            if (!out.landed && Math.abs(out.vx) < 12) {
              out.landed = true;
              out.onLanded?.(out);
            }
          }
        }
      }
    }
    if (!out || out.phase !== "fall") flapK = Math.max(0, flapK - dt * 3);
    if (shakeT > 0) shakeT -= dt;
    clickFx = clickFx.filter((f) => (f.t += dt) < 0.7);
  }

  /* ---------- 그리기 ---------- */
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const { R, cx, domeCy, bodyTop, bx, bw, bh, bodyBot, knob, slot, chute } = g;
    const shake = shakeT > 0 ? Math.sin(performance.now() / 18) * shakeT * 10 : 0;

    // 바닥 그림자
    ctx.beginPath();
    ctx.ellipse(cx, bodyBot + 10, bw * 0.55, 9, 0, 0, TAU);
    ctx.fillStyle = "rgba(0,0,0,0.14)";
    ctx.fill();

    ctx.save();
    ctx.translate(shake * 0.4, 0);
    // 받침
    rrect(ctx, bx + bw * 0.06, bodyBot - 4, bw * 0.88, 16, 6);
    ctx.fillStyle = art.brandDeep;
    ctx.fill();

    // 몸통
    rrect(ctx, bx, bodyTop, bw, bh, 22);
    ctx.fillStyle = art.brand;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fillRect(bx + bw * 0.06, bodyTop, bw * 0.05, bh);
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(bx + bw * 0.9, bodyTop, bw * 0.1, bh);
    ctx.restore();
    // 파란 패널
    rrect(ctx, bx + bw * 0.05, bodyTop + bh * 0.08, bw * 0.9, bh * 0.84, 16);
    ctx.fillStyle = art.blue;
    ctx.fill();
    // 패널 볼트
    ctx.fillStyle = art.chrome;
    [[0.1, 0.13], [0.9, 0.13], [0.1, 0.87], [0.9, 0.87]].forEach(([fx, fy]) => {
      ctx.beginPath();
      ctx.arc(bx + bw * fx, bodyTop + bh * fy, 3.5, 0, TAU);
      ctx.fill();
    });

    // 동전 투입구 판
    rrect(ctx, slot.x, slot.y, slot.w, slot.h, 10);
    ctx.fillStyle = art.chrome;
    ctx.fill();
    ctx.strokeStyle = art.chromeDeep;
    ctx.lineWidth = 2;
    ctx.stroke();
    rrect(ctx, slot.x + slot.w * 0.72, slot.y + slot.h * 0.18, slot.w * 0.1, slot.h * 0.64, 3);
    ctx.fillStyle = art.ink;
    ctx.fill();
    ctx.fillStyle = art.ink;
    ctx.font = `700 ${Math.round(Math.min(15, slot.h * 0.28))}px ${art.display}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("100원", slot.x + 10, slot.y + slot.h * 0.36);
    ctx.font = `600 ${Math.round(Math.min(11, slot.h * 0.2))}px ${CANVAS_FONT}`;
    ctx.fillStyle = art.chromeDeep;
    ctx.fillText("COIN", slot.x + 10, slot.y + slot.h * 0.68);

    // 배출구
    rrect(ctx, chute.x, chute.y, chute.w, chute.h, 12);
    ctx.fillStyle = art.brandDeep;
    ctx.fill();
    rrect(ctx, chute.x + 6, chute.y + 6, chute.w - 12, chute.h - 12, 9);
    ctx.fillStyle = art.ink;
    ctx.fill();
    ctx.save();
    rrect(ctx, chute.x + 6, chute.y + 6, chute.w - 12, chute.h - 12, 9);
    ctx.clip();
    if (out && out.phase !== "wait" && !out.hidden) {
      const sq = squash(out.t - out.land, out.amp || 0.3);
      drawCapsule(ctx, out.x, out.y + out.r * sq * 0.8, out.r, out.color, out.gold, art, { rot: out.rot, sx: 1 + sq, sy: 1 - sq });
    }
    // 덮개 (캡슐 지나갈 때 젖혀짐)
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    const fh = (chute.h - 12) * 0.5 * (1 - flapK * 0.85);
    ctx.fillRect(chute.x + 6, chute.y + 6, chute.w - 12, fh);
    ctx.restore();
    ctx.font = `700 ${Math.round(Math.min(12, chute.h * 0.14))}px ${CANVAS_FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.textAlign = "center";
    ctx.fillText("꺼내는 곳", chute.x + chute.w / 2, chute.y + chute.h + 12);

    // 사용법 스티커
    const dc = g.decal;
    if (dc.h > 54) {
      ctx.save();
      ctx.translate(dc.x + dc.w / 2, dc.y + dc.h / 2);
      ctx.rotate(-0.03);
      rrect(ctx, -dc.w / 2, -dc.h / 2, dc.w, dc.h, 8);
      ctx.fillStyle = art.cream;
      ctx.fill();
      ctx.strokeStyle = art.ink;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      const lines = ["사용법", "① 동전 넣기", "② 손잡이 한 바퀴", "③ 캡슐 꺼내기"];
      const fs = Math.max(11, Math.min(16, dc.h / 6.2, dc.w / 8.5));
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      lines.forEach((ln, k) => {
        ctx.font = k ? `700 ${fs}px ${art.pen}` : `400 ${fs + 1}px ${art.display}`;
        ctx.fillStyle = k ? art.ink : art.brand;
        ctx.fillText(ln, -dc.w / 2 + 10, -dc.h / 2 + 14 + k * (dc.h - 24) / 3.3, dc.w - 16);
      });
      ctx.restore();
    }

    // 손잡이
    const kr = knob.r;
    ctx.beginPath();
    ctx.arc(knob.x, knob.y, kr * 1.32, 0, TAU);
    ctx.fillStyle = art.blueDeep;
    ctx.fill();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(knob.x + Math.cos(a) * kr * 1.12, knob.y + Math.sin(a) * kr * 1.12);
      ctx.lineTo(knob.x + Math.cos(a) * kr * 1.28, knob.y + Math.sin(a) * kr * 1.28);
      ctx.strokeStyle = art.chrome;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    if (progress > 0.001) {
      ctx.beginPath();
      ctx.arc(knob.x, knob.y, kr * 1.45, -Math.PI / 2, -Math.PI / 2 + progress * TAU);
      ctx.strokeStyle = art.goldLight;
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(knob.x, knob.y, kr, 0, TAU);
    ctx.fillStyle = art.chrome;
    ctx.fill();
    ctx.strokeStyle = art.chromeDeep;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.save();
    ctx.translate(knob.x, knob.y);
    ctx.rotate(knobAngle);
    rrect(ctx, -kr * 1.06, -kr * 0.24, kr * 2.12, kr * 0.48, kr * 0.24);
    ctx.fillStyle = art.brand;
    ctx.fill();
    ctx.strokeStyle = art.brandDeep;
    ctx.stroke();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(knob.x, knob.y, kr * 0.2, 0, TAU);
    ctx.fillStyle = art.chromeDeep;
    ctx.fill();

    // 장갑 손 (인트로 데모)
    if (hand && hand.alpha > 0) {
      ctx.save();
      ctx.globalAlpha = hand.alpha;
      const a = knobAngle;
      const hx = knob.x + Math.cos(a) * kr * 0.8;
      const hy = knob.y + Math.sin(a) * kr * 0.8;
      ctx.translate(hx + (hand.dx || 0), hy + (hand.dy || 0));
      ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = art.hand;
      ctx.strokeStyle = art.ink;
      ctx.lineWidth = 2.5;
      rrect(ctx, -kr * 0.55, -kr * 0.45, kr * 1.1, kr * 1.15, kr * 0.4);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      for (let f = 0; f < 3; f++) {
        const fx = -kr * 0.28 + f * kr * 0.28;
        ctx.moveTo(fx, -kr * 0.45);
        ctx.lineTo(fx, -kr * 0.05);
      }
      ctx.stroke();
      rrect(ctx, -kr * 0.45, kr * 0.62, kr * 0.9, kr * 0.42, kr * 0.12);
      ctx.fillStyle = art.brand;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 딸깍 글씨
    clickFx.forEach((f) => {
      const k = f.t / 0.7;
      ctx.save();
      ctx.globalAlpha = 1 - k * k;
      ctx.translate(knob.x + kr * 1.3, knob.y - kr * 1.2 - k * 26);
      ctx.rotate(-0.15);
      const s = spring(f.t / 0.3);
      ctx.scale(s, s);
      ctx.font = `700 20px ${art.pen}`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = art.paper;
      ctx.textAlign = "center";
      ctx.strokeText(f.label, 0, 0);
      ctx.fillStyle = art.ink;
      ctx.fillText(f.label, 0, 0);
      ctx.restore();
    });
    ctx.restore();

    // 돔 테두리 받침 (크롬 링)
    ctx.save();
    ctx.translate(shake, 0);
    rrect(ctx, cx - R * 0.86, bodyTop - 12, R * 1.72, 20, 8);
    ctx.fillStyle = art.chrome;
    ctx.fill();
    ctx.strokeStyle = art.chromeDeep;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 유리 돔
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, domeCy, R, 0, TAU);
    ctx.rect(0, bodyTop - 6, w, h);
    ctx.clip("evenodd");
    ctx.beginPath();
    ctx.arc(cx, domeCy, R, 0, TAU);
    ctx.fillStyle = art.glass;
    ctx.globalAlpha = 0.55;
    ctx.fill();
    ctx.globalAlpha = 1;
    // 캡슐
    const sorted = caps.slice().sort((a, b) => a.y - b.y);
    for (const c of sorted) {
      if (c.delay > 0) continue;
      const s = sinkSet.get(c.id);
      if (s) {
        const k = clamp01(s.t / 0.4);
        const x = s.x0 + (cx - s.x0) * k;
        const y = s.y0 + (g.floorY + c.r - s.y0) * k * k;
        drawCapsule(ctx, x, y, c.r * (1 - k * 0.4), c.color, c.gold, art, { rot: c.rot + k * 3, alpha: 1 - k * 0.6 });
      } else drawCapsule(ctx, c.x, c.y, c.r, c.color, c.gold, art, { rot: c.rot });
    }
    // 유리 반사
    ctx.beginPath();
    ctx.arc(cx, domeCy, R * 0.86, Math.PI * 1.05, Math.PI * 1.4);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = R * 0.07;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, domeCy, R * 0.86, Math.PI * 1.48, Math.PI * 1.54);
    ctx.stroke();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, domeCy, R, Math.PI * 0.2, Math.PI * 0.8, true);
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 3;
    ctx.stroke();
    // 뚜껑
    rrect(ctx, cx - R * 0.26, domeCy - R - 10, R * 0.52, 16, 6);
    ctx.fillStyle = art.brand;
    ctx.fill();
    ctx.restore();
  }

  resize();
  return {
    resize,
    fill,
    jiggle,
    setKnob,
    click,
    dispense,
    clearOut,
    update,
    draw,
    art,
    get geo() {
      return g;
    },
    get caps() {
      return caps;
    },
    get out() {
      return out;
    },
    get knobAngle() {
      return knobAngle;
    },
    set progress(v) {
      progress = v;
    },
    set hand(v) {
      hand = v;
    },
  };
}
