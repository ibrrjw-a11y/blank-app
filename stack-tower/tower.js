// 탑 쌓기 엔진 (캔버스). 첫 화면 데모와 실제 게임이 같은 엔진을 쓴다.
// 좌표: 월드 폭 360, y 는 위로 증가 (땅 = 0). 블록 높이 BH.
import { prefersReducedMotion } from "../shared/kit.js";

export const WW = 360;
export const BH = 28;
export const BASE_W = 200;
const G = 2600; // 중력 (월드 단위/s²)
const PERFECT = 5; // 이 이하로 어긋나면 딱 맞음
const HANG = 120; // 매달린 블록이 탑 꼭대기 위로 떠 있는 높이

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hex = (h) => {
  h = h.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a, b, t) => {
  const A = hex(a);
  const B = hex(b);
  return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], t))).join(",")})`;
};
// 여러 색 사이를 0..1 로 보간
const ramp = (stops, t) => {
  t = clamp(t, 0, 1) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(t));
  return mix(stops[i], stops[i + 1], t - i);
};

export function palette() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n, f) => cs.getPropertyValue(n).trim() || f;
  return {
    skyTop: [v("--art-sky-day-top", "#4f9fdc"), v("--art-sky-dusk-top", "#3c5a8c"), v("--art-sky-night-top", "#0a1428")],
    skyBot: [v("--art-sky-day-bot", "#cde9f6"), v("--art-sky-dusk-bot", "#f3a25e"), v("--art-sky-night-bot", "#1f2d52")],
    beam: [v("--art-beam-1", "#c4512f"), v("--art-beam-2", "#a8432a")],
    beamHi: v("--art-beam-hi", "#e7835f"),
    beamLo: v("--art-beam-lo", "#6e2a1a"),
    rivet: v("--art-rivet", "#f2b49a"),
    hazard: v("--art-hazard", "#ffc400"),
    ink: v("--art-ink", "#16130f"),
    tape: v("--art-tape", "#ffd23f"),
    concrete: v("--art-concrete", "#9a958c"),
    dirt: v("--art-dirt", "#4a3b2c"),
    city: v("--art-city", "#2a3550"),
    window: v("--art-window", "#ffe08a"),
    cable: v("--art-cable", "#24211d"),
    flash: v("--art-flash", "#ffffff"),
    font: v("--art-font", "sans-serif"),
    num: v("--art-num", "sans-serif"),
  };
}

export class Tower {
  constructor(canvas, { demo = false, onFloor, onOver, onPerfect } = {}) {
    this.cv = canvas;
    this.ctx = canvas.getContext("2d");
    this.demo = demo;
    this.onFloor = onFloor;
    this.onOver = onOver;
    this.onPerfect = onPerfect;
    this.c = palette();
    this.raf = 0;
    this.running = false;
    this.reduce = prefersReducedMotion();
    // 멀리 보이는 도시 (한 번만 만든다)
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    this.city = [];
    for (let x = -20; x < WW + 20; ) {
      const w = 18 + rnd() * 30;
      const h = 30 + rnd() * 90;
      const wins = [];
      for (let yy = 8; yy < h - 6; yy += 10) for (let xx = 4; xx < w - 4; xx += 8) if (rnd() > 0.45) wins.push([xx, yy, rnd()]);
      this.city.push({ x, w, h, wins });
      x += w + 2 + rnd() * 6;
    }
    this.stars = Array.from({ length: 60 }, () => [rnd() * WW, rnd(), 0.4 + rnd() * 1.2, rnd()]);
    this.blocks = null;
    this.resize();
    this.reset();
    this.draw();
  }

  resize() {
    const r = this.cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cw = Math.max(1, r.width);
    this.ch = Math.max(1, r.height);
    this.cv.width = Math.round(this.cw * dpr);
    this.cv.height = Math.round(this.ch * dpr);
    this.s = this.cw / WW; // 월드 → CSS px
    this.dpr = dpr;
    this.HW = this.ch / this.s; // 화면 높이 (월드 단위)
    if (!this.running && this.blocks) this.draw();
  }

  reset() {
    const x = (WW - BASE_W) / 2;
    this.blocks = [{ x, w: BASE_W, y: 0, tone: 0 }];
    this.debris = [];
    this.dust = [];
    this.flashes = [];
    this.texts = [];
    this.falling = null;
    this.over = false;
    this.overT = 0;
    this.streak = 0;
    this.shake = 0;
    this.cam = -70;
    this.zoom = 1;
    this.zoomTarget = 1;
    this.camTarget = -70;
    this.t = 0;
    this.trolleyX = WW / 2;
    this.spawn();
  }

  get floors() {
    return this.blocks.length - 1;
  }
  get top() {
    return this.blocks[this.blocks.length - 1];
  }
  get topY() {
    return this.top.y + BH;
  }

  spawn() {
    const f = this.floors;
    const w = this.top.w;
    const fromLeft = f % 2 === 0;
    this.speed = Math.min(360, 150 + f * 6.5);
    this.cur = { x: fromLeft ? -w * 0.4 : WW - w * 0.6, w, dir: fromLeft ? 1 : -1, y: this.topY + HANG, drop: 0 };
    // 데모: 일부러 조금씩 어긋나게 놓는다
    if (this.demo) this.aim = [0, 0, 7, -12, 0, 16, -5, 0, 22][f % 9] * (Math.random() > 0.5 ? 1 : -1);
  }

  drop() {
    if (this.over || this.falling || !this.cur) return false;
    const c = this.cur;
    this.falling = { x: c.x, w: c.w, y: c.y, vy: -160 };
    this.cur = null;
    return true;
  }

  land() {
    const f = this.falling;
    const t = this.top;
    this.falling = null;
    const L = Math.max(f.x, t.x);
    const R = Math.min(f.x + f.w, t.x + t.w);
    const ov = R - L;
    const y = this.topY;
    if (ov <= 0) {
      // 완전히 빗나감: 통째로 떨어진다
      this.debris.push({ x: f.x, y, w: f.w, vx: f.x < t.x ? -90 : 90, vy: 0, rot: 0, vr: f.x < t.x ? -2.5 : 2.5, tone: this.floors + 1 });
      this.gameOver();
      return;
    }
    const diff = f.x - t.x;
    let placed;
    if (Math.abs(diff) <= PERFECT) {
      this.streak++;
      let w = t.w;
      let x = t.x;
      if (this.streak >= 2 && w < BASE_W) {
        const g = Math.min(8, BASE_W - w);
        w += g;
        x = clamp(x - g / 2, 0, WW - w);
        this.texts.push({ txt: `+${Math.round(g)}`, x: x + w + 6, y: y + BH / 2, t: 0, side: true });
      }
      placed = { x, w, y, tone: this.floors + 1 };
      this.flashes.push({ x, w, y, t: 0 });
      this.texts.push({ txt: this.streak >= 2 ? `딱! x${this.streak}` : "딱!", x: x + w / 2, y: y + BH + 14, t: 0 });
      this.onPerfect?.(this.streak);
    } else {
      this.streak = 0;
      placed = { x: L, w: ov, y, tone: this.floors + 1 };
      const cutLeft = f.x < t.x;
      const pw = f.w - ov;
      this.debris.push({ x: cutLeft ? f.x : R, y, w: pw, vx: cutLeft ? -40 - pw : 40 + pw, vy: 30, rot: 0, vr: (cutLeft ? -1 : 1) * (2 + Math.random() * 2), tone: placed.tone });
    }
    this.blocks.push(placed);
    this.shake = 1;
    for (let i = 0; i < 10; i++) {
      const side = i % 2 ? placed.x : placed.x + placed.w;
      this.dust.push({ x: side, y, vx: (i % 2 ? -1 : 1) * (20 + Math.random() * 60), vy: 20 + Math.random() * 50, life: 0, r: 2 + Math.random() * 3 });
    }
    this.onFloor?.(this.floors, placed);
    this.spawn();
  }

  gameOver() {
    this.over = true;
    this.overT = 0;
    this.cur = null;
    // 탑 전체가 보이도록 카메라를 뒤로 뺀다
    const h = this.topY + 140;
    this.zoomTarget = clamp((this.HW * 0.82) / h, 0.18, 1);
    setTimeout(() => this.onOver?.(this.floors), this.reduce ? 300 : 1500);
  }

  update(dt) {
    this.t += dt;
    const c = this.cur;
    if (c) {
      c.x += c.dir * this.speed * dt;
      const min = -c.w * 0.45;
      const max = WW - c.w * 0.55;
      if (c.x < min) {
        c.x = min;
        c.dir = 1;
      } else if (c.x > max) {
        c.x = max;
        c.dir = -1;
      }
      c.y = lerp(c.y, this.topY + HANG, 1 - Math.exp(-dt * 8));
      if (this.demo && !this.over) {
        const target = this.top.x + this.aim;
        if (Math.abs(c.x - target) < this.speed * dt * 0.6 + 0.5) {
          c.x = target;
          this.drop();
        }
      }
    }
    // 크레인 트롤리가 블록을 따라 움직인다
    const tx = c ? c.x + c.w / 2 : this.falling ? this.falling.x + this.falling.w / 2 : this.trolleyX;
    this.trolleyX = lerp(this.trolleyX, tx, 1 - Math.exp(-dt * 14));

    const f = this.falling;
    if (f) {
      f.vy -= G * dt;
      f.y += f.vy * dt;
      if (f.y <= this.topY) {
        f.y = this.topY;
        this.land();
      }
    }
    for (const d of this.debris) {
      d.vy -= G * 0.8 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.rot += d.vr * dt;
    }
    this.debris = this.debris.filter((d) => d.y > this.cam - 400);
    for (const p of this.dust) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= 60 * dt;
    }
    this.dust = this.dust.filter((p) => p.life < 0.6);
    this.flashes = this.flashes.filter((fl) => (fl.t += dt) < 0.5);
    this.texts = this.texts.filter((tx2) => (tx2.t += dt) < 0.9);
    this.shake = Math.max(0, this.shake - dt * 5);

    // 카메라: 꼭대기가 화면 45% 높이에 오게 부드럽게 따라간다
    if (this.over) {
      this.overT += dt;
      this.zoom = lerp(this.zoom, this.zoomTarget, 1 - Math.exp(-dt * 3));
      this.camTarget = -40 / this.zoom;
    } else {
      this.camTarget = Math.max(-70, this.topY + HANG + BH - this.HW * 0.62);
    }
    this.cam = lerp(this.cam, this.camTarget, 1 - Math.exp(-dt * 5));
  }

  start() {
    if (this.running) return;
    this.running = true;
    let last = performance.now();
    const frame = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      this.update(dt);
      this.draw(now);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /* ---------- 그리기 ---------- */
  // 월드 → 화면 (CSS px)
  sx(x) {
    return ((x - WW / 2) * this.zoom + WW / 2) * this.s;
  }
  sy(y) {
    return this.ch - (y - this.cam) * this.zoom * this.s;
  }

  draw() {
    const { ctx, c } = this;
    const W = this.cw;
    const H = this.ch;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // 하늘: 높이 올라갈수록 낮 → 노을 → 밤
    const sky = clamp((this.over ? this.floors : (this.cam + this.HW * 0.62 - HANG - BH) / BH) / 36, 0, 1);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, ramp(c.skyTop, sky));
    g.addColorStop(1, ramp(c.skyBot, sky));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // 별
    if (sky > 0.55) {
      const a = (sky - 0.55) / 0.45;
      ctx.fillStyle = c.flash;
      for (const [x, y, r, tw] of this.stars) {
        ctx.globalAlpha = a * (0.5 + 0.5 * Math.sin(this.t * 2 + tw * 9));
        ctx.fillRect(x * this.s, y * H * 0.7, r, r);
      }
      ctx.globalAlpha = 1;
    }
    const shakeY = this.reduce ? 0 : Math.sin(this.t * 60) * this.shake * 2.2;
    ctx.save();
    ctx.translate(0, shakeY);
    this.drawCity(sky);
    this.drawGround();
    this.drawTape();
    // 블록
    this.blocks.forEach((b, i) => (i === 0 ? this.drawFoundation(b) : this.drawBeam(b.x, b.y, b.w, b.tone)));
    for (const fl of this.flashes) {
      const k = fl.t / 0.5;
      ctx.strokeStyle = c.flash;
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = 3;
      const pad = 4 + k * 14;
      ctx.strokeRect(this.sx(fl.x) - pad, this.sy(fl.y + BH) - pad, fl.w * this.s * this.zoom + pad * 2, BH * this.s * this.zoom + pad * 2);
      ctx.fillStyle = c.flash;
      ctx.globalAlpha = (1 - k) * 0.55;
      ctx.fillRect(this.sx(fl.x), this.sy(fl.y + BH), fl.w * this.s * this.zoom, BH * this.s * this.zoom);
      ctx.globalAlpha = 1;
    }
    for (const d of this.debris) {
      ctx.save();
      const cx = this.sx(d.x + d.w / 2);
      const cy = this.sy(d.y + BH / 2);
      ctx.translate(cx, cy);
      ctx.rotate(d.rot);
      ctx.translate(-cx, -cy);
      this.drawBeam(d.x, d.y, d.w, d.tone);
      ctx.restore();
    }
    ctx.fillStyle = c.concrete;
    for (const p of this.dust) {
      ctx.globalAlpha = 1 - p.life / 0.6;
      ctx.beginPath();
      ctx.arc(this.sx(p.x), this.sy(p.y), p.r * (1 + p.life * 2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (this.falling) this.drawBeam(this.falling.x, this.falling.y, this.falling.w, this.floors + 1);
    ctx.restore();
    // 크레인 (화면에 고정)
    this.drawCrane();
    for (const tx of this.texts) {
      const k = tx.t / 0.9;
      ctx.globalAlpha = 1 - k * k;
      ctx.fillStyle = c.flash;
      ctx.strokeStyle = c.ink;
      ctx.lineWidth = 4;
      ctx.font = `${tx.side ? 16 : 24}px ${c.font}`;
      ctx.textAlign = tx.side ? "left" : "center";
      const x = this.sx(tx.x);
      const y = this.sy(tx.y) - k * 30;
      ctx.strokeText(tx.txt, x, y);
      ctx.fillText(tx.txt, x, y);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = "left";
  }

  drawCity(sky) {
    const { ctx, c } = this;
    // 도시는 천천히 내려간다 (시차)
    const base = this.ch - (0 - this.cam * 0.35) * this.s * this.zoom;
    if (base < -10) return;
    for (const b of this.city) {
      const x = b.x * this.s;
      const w = b.w * this.s;
      const h = b.h * this.s * 0.9;
      ctx.fillStyle = c.city;
      ctx.fillRect(x, base - h, w, h);
      if (sky > 0.4) {
        ctx.fillStyle = c.window;
        ctx.globalAlpha = Math.min(1, (sky - 0.4) * 2.5);
        for (const [wx, wy, on] of b.wins) if (on > 1 - sky * 0.8) ctx.fillRect(x + wx * this.s, base - h + wy * this.s * 0.9, 3 * this.s, 4 * this.s);
        ctx.globalAlpha = 1;
      }
    }
  }

  drawGround() {
    const { ctx, c } = this;
    const gy = this.sy(0);
    if (gy > this.ch + 4) return;
    ctx.fillStyle = c.dirt;
    ctx.fillRect(0, gy, this.cw, this.ch - gy + 20);
    // 안전 펜스 (노랑·검정 사선)
    const fh = 10 * this.s * this.zoom;
    this.hazard(0, gy - fh, this.cw, fh, 14 * this.s * this.zoom);
  }

  hazard(x, y, w, h, stripe) {
    const { ctx, c } = this;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = c.hazard;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = c.ink;
    for (let i = -h; i < w + h; i += stripe * 2) {
      ctx.beginPath();
      ctx.moveTo(x + i, y + h);
      ctx.lineTo(x + i + stripe, y + h);
      ctx.lineTo(x + i + stripe + h, y);
      ctx.lineTo(x + i + h, y);
      ctx.fill();
    }
    ctx.restore();
  }

  drawFoundation(b) {
    const { ctx, c } = this;
    const x = this.sx(b.x);
    const y = this.sy(b.y + BH);
    const w = b.w * this.s * this.zoom;
    const h = BH * this.s * this.zoom;
    ctx.fillStyle = c.concrete;
    ctx.fillRect(x - 6 * this.s, y, w + 12 * this.s, this.ch - y + 10);
    this.hazard(x - 6 * this.s, y, w + 12 * this.s, h * 0.45, 9 * this.s * this.zoom);
  }

  drawBeam(wx, wy, ww, tone = 0) {
    const { ctx, c } = this;
    const x = this.sx(wx);
    const y = this.sy(wy + BH);
    const w = ww * this.s * this.zoom;
    const h = BH * this.s * this.zoom;
    if (w <= 0.5) return;
    ctx.fillStyle = c.beam[tone % 2];
    ctx.fillRect(x, y, w, h);
    const fl = Math.max(1, h * 0.16);
    ctx.fillStyle = c.beamHi;
    ctx.fillRect(x, y, w, fl);
    ctx.fillStyle = c.beamLo;
    ctx.fillRect(x, y + h - fl, w, fl);
    ctx.globalAlpha = 0.35;
    ctx.fillRect(x, y + h / 2 - 0.5, w, 1);
    ctx.globalAlpha = 1;
    if (h < 8) return;
    // 리벳
    const step = 16 * this.s * this.zoom;
    const r = Math.max(1, 1.8 * this.s * this.zoom);
    for (let rx = x + step / 2; rx < x + w - 2; rx += step) {
      for (const ry of [y + fl * 2.1, y + h - fl * 2.1]) {
        ctx.fillStyle = c.beamLo;
        ctx.beginPath();
        ctx.arc(rx + 0.6, ry + 0.6, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = c.rivet;
        ctx.beginPath();
        ctx.arc(rx, ry, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawTape() {
    const { ctx, c } = this;
    const tw = 22;
    ctx.fillStyle = c.tape;
    ctx.fillRect(0, 0, tw, this.ch);
    ctx.fillStyle = c.ink;
    ctx.font = `11px ${c.num}`;
    const per = BH * this.s * this.zoom;
    const step = per < 6 ? 10 : per < 12 ? 5 : 1;
    const startF = Math.max(0, Math.floor(this.cam / BH) - 2);
    const endF = startF + Math.ceil(this.HW / this.zoom / BH) + 4;
    for (let f = startF - (startF % step); f <= endF; f += step) {
      const y = this.sy(f * BH + BH);
      if (y < -10 || y > this.ch + 10) continue;
      const major = f % 5 === 0;
      ctx.fillRect(0, y, major ? 12 : 7, 1.5);
      if (major && f > 0) ctx.fillText(String(f), 2, y - 3);
    }
    // 현재 높이 표시 (줄자 위 꼬리표)
    const n = this.floors;
    if (n > 0) {
      const y = this.sy(this.topY);
      const label = `${n}층`;
      ctx.font = `15px ${c.font}`;
      const lw = ctx.measureText(label).width + 14;
      ctx.fillStyle = c.ink;
      ctx.beginPath();
      ctx.moveTo(tw, y);
      ctx.lineTo(tw + 8, y - 11);
      ctx.lineTo(tw + 8 + lw, y - 11);
      ctx.lineTo(tw + 8 + lw, y + 11);
      ctx.lineTo(tw + 8, y + 11);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = c.tape;
      ctx.fillText(label, tw + 14, y + 5);
    }
  }

  drawCrane() {
    const { ctx, c } = this;
    const s = this.s;
    const jibY = 10 * s;
    const jibH = 16 * s;
    // 지브 (격자 트러스)
    ctx.fillStyle = c.hazard;
    ctx.fillRect(0, jibY, this.cw, 3 * s);
    ctx.fillRect(0, jibY + jibH - 3 * s, this.cw, 3 * s);
    ctx.strokeStyle = c.hazard;
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    for (let x = 0; x < this.cw + 20; x += 18 * s) {
      ctx.moveTo(x, jibY + jibH - 2 * s);
      ctx.lineTo(x + 9 * s, jibY + 2 * s);
      ctx.lineTo(x + 18 * s, jibY + jibH - 2 * s);
    }
    ctx.stroke();
    if (this.over) return;
    // 트롤리 + 와이어 + 훅
    const tx = this.sx(this.trolleyX);
    ctx.fillStyle = c.ink;
    ctx.fillRect(tx - 14 * s, jibY + jibH - 2 * s, 28 * s, 8 * s);
    const cur = this.cur;
    const hookY = cur ? this.sy(cur.y + BH) - 22 * s : jibY + jibH + 70 * s;
    ctx.strokeStyle = c.cable;
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.moveTo(tx - 3 * s, jibY + jibH + 6 * s);
    ctx.lineTo(tx - 3 * s, hookY);
    ctx.moveTo(tx + 3 * s, jibY + jibH + 6 * s);
    ctx.lineTo(tx + 3 * s, hookY);
    ctx.stroke();
    // 훅 블록
    ctx.fillStyle = c.hazard;
    ctx.fillRect(tx - 7 * s, hookY - 6 * s, 14 * s, 12 * s);
    ctx.fillStyle = c.ink;
    ctx.fillRect(tx - 7 * s, hookY - 1 * s, 14 * s, 2 * s);
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 2.5 * s;
    ctx.beginPath();
    ctx.arc(tx, hookY + 11 * s, 5 * s, -Math.PI / 2, Math.PI * 0.9);
    ctx.stroke();
    if (cur) {
      const bx = this.sx(cur.x);
      const bw = cur.w * s * this.zoom;
      const by = this.sy(cur.y + BH);
      // 슬링 두 줄
      ctx.strokeStyle = c.cable;
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.moveTo(bx + bw * 0.15, by);
      ctx.lineTo(tx, hookY + 14 * s);
      ctx.lineTo(bx + bw * 0.85, by);
      ctx.stroke();
      this.drawBeam(cur.x, cur.y, cur.w, this.floors + 1);
    }
  }
}

// 공유 이미지: 내 탑 실루엣
export function drawSilhouette(ctx, blocks, W, H, c, { floors, title = "", sub = "" }) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  const t = clamp(floors / 36, 0, 1);
  g.addColorStop(0, ramp(c.skyTop, t));
  g.addColorStop(1, ramp(c.skyBot, t));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const topY = blocks.length ? blocks[blocks.length - 1].y + BH : BH;
  const groundY = H - 120;
  const avail = groundY - 220;
  const sc = Math.min(W / WW, avail / topY) * 0.95;
  const ox = W / 2 - (WW / 2) * sc;
  ctx.fillStyle = c.ink;
  blocks.forEach((b, i) => {
    const x = ox + b.x * sc;
    const y = groundY - (b.y + BH) * sc;
    ctx.fillRect(x, y, b.w * sc, BH * sc + 0.6);
    if (i === 0) ctx.fillRect(x - 6, y, b.w * sc + 12, groundY - y + 2);
  });
  ctx.fillStyle = c.ink;
  ctx.fillRect(0, groundY, W, H - groundY);
  // 땅 펜스
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, groundY, W, 14);
  ctx.clip();
  ctx.fillStyle = c.hazard;
  ctx.fillRect(0, groundY, W, 14);
  ctx.fillStyle = c.ink;
  for (let i = -14; i < W + 14; i += 28) {
    ctx.beginPath();
    ctx.moveTo(i, groundY + 14);
    ctx.lineTo(i + 14, groundY + 14);
    ctx.lineTo(i + 28, groundY);
    ctx.lineTo(i + 14, groundY);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = t > 0.5 ? c.flash : c.ink;
  ctx.font = `110px ${c.num}`;
  ctx.textBaseline = "alphabetic";
  const n = String(floors);
  ctx.fillText(n, 44, 150);
  const nw = ctx.measureText(n).width;
  ctx.font = `44px ${c.font}`;
  ctx.fillText("층", 52 + nw, 150);
  ctx.font = `26px ${c.font}`;
  ctx.fillText(title, 46, 196);
  ctx.fillStyle = c.hazard;
  ctx.font = `22px ${c.font}`;
  ctx.fillText(sub, 46, H - 52);
}
