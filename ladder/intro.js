// 첫 화면: 분필로 이름 → 세로줄 → 다리 → 손이 몰래 한 줄 → 분필 길이 내려가 쪽지가 "당첨!"으로 넘어간다 → 지우개로 쓱.
import { CHALK, chalkStroke, chalkText, tracePath, geom, Dust } from "./board.js";
import { prefersReducedMotion } from "../shared/kit.js";

const NAMES = ["민지", "준호", "서연", "도윤"];
const RESULTS = ["꽝", "커피", "당첨!", "꽝"];
const MAG = ["#ff8a7a", "#7cc4ff", "#ffd34d", "#9be38a"];
const BASE = [
  { a: 2, y: 0.12, dy: 0.01 },
  { a: 0, y: 0.2, dy: -0.008 },
  { a: 2, y: 0.3, dy: 0.006 },
  { a: 1, y: 0.4, dy: -0.01 },
  { a: 0, y: 0.52, dy: 0.012 },
  { a: 2, y: 0.72, dy: -0.006 },
  { a: 1, y: 0.86, dy: 0.008 },
  { a: 0, y: 0.92, dy: -0.01 },
];
const SECRET = { a: 1, y: 0.6, dy: 0.004 };
const NOTES = ["이름 자석 붙이고", "다리는 무작위로", "한 줄은 몰래!", "분필 따라 쭉", "쪽지 넘기면…"];

const FONT_NAME = '700 19px "Gaegu", "Nanum Pen Script", sans-serif';
const FONT_RES = '700 20px "Gaegu", "Nanum Pen Script", sans-serif';

const T = {
  cards: 0,
  rails: 700,
  rungs: 1350,
  handIn: 2350,
  secret: 2850,
  handOut: 3350,
  trace: 3900,
  traceDur: 1900,
  flip: 5900,
  hold: 7600,
  erase: 7700,
  end: 8400,
};

const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const spring = (t) => {
  t = Math.min(1, Math.max(0, t));
  return 1 - Math.exp(-6 * t) * Math.cos(t * 9);
};

export function startIntro({ canvas, note }) {
  const ctx = canvas.getContext("2d");
  let W = 0;
  let H = 0;
  let dpr = 1;
  let g;
  let top = 0;
  let bottom = 0;
  const dust = new Dust();
  const path = tracePath(4, [...BASE, SECRET], 0);
  let raf = 0;
  let stopped = false;
  let t0 = performance.now();
  let last = t0;
  let noteIdx = -1;

  function resize() {
    const r = canvas.getBoundingClientRect();
    W = r.width;
    H = r.height;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    top = Math.min(200, Math.max(150, H * 0.27));
    bottom = H - 64;
    g = geom(W, bottom - top, 4, { top: 0, bottom: 0, side: Math.max(46, W * 0.13) });
  }
  resize();
  addEventListener("resize", resize);

  const setNote = (i) => {
    if (i === noteIdx) return;
    noteIdx = i;
    note.textContent = NOTES[i];
    note.classList.remove("is-swap");
    void note.offsetWidth;
    note.classList.add("is-swap");
  };

  const X = (i) => g.x(i);
  const Y = (v) => top + g.y(v);

  function drawHand(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.35);
    // 소매
    ctx.fillStyle = "#4b6d8f";
    ctx.fillRect(34, 12, 90, 40);
    ctx.fillStyle = "#3b5874";
    ctx.fillRect(34, 12, 10, 40);
    // 손
    ctx.fillStyle = "#f2c29b";
    ctx.beginPath();
    ctx.ellipse(24, 26, 20, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(8, 14, 14, 6, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e3ad85";
    ctx.beginPath();
    ctx.ellipse(16, 30, 9, 5, 0.3, 0, Math.PI * 2);
    ctx.fill();
    // 분필
    ctx.fillStyle = CHALK.yellow;
    ctx.save();
    ctx.rotate(-0.5);
    ctx.fillRect(-4, -3, 20, 7);
    ctx.restore();
    ctx.restore();
  }

  function drawCard(i, t) {
    const k = spring((t - T.cards - i * 110) / 600);
    if (k <= 0) return;
    const x = X(i);
    const w = Math.min(70, g.step - 10);
    const y = top - 54 - (1 - k) * 40;
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 2);
    ctx.translate(x, y + 17);
    ctx.rotate((i % 2 ? 1 : -1) * 0.03);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(-w / 2, -14, w, 34);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-w / 2, -17, w, 34);
    ctx.fillStyle = MAG[i];
    ctx.beginPath();
    ctx.arc(0, -17, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const wp = (t - T.cards - 260 - i * 110) / 380;
    if (wp > 0) {
      ctx.save();
      ctx.font = FONT_NAME;
      ctx.fillStyle = "#2b2620";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const tw = ctx.measureText(NAMES[i]).width;
      ctx.beginPath();
      ctx.rect(x - tw / 2 - 2, y, (tw + 4) * Math.min(1, wp), 34);
      ctx.clip();
      ctx.fillText(NAMES[i], x, y + 19);
      ctx.restore();
    }
  }

  function drawFlap(i, t) {
    const x = X(i);
    const w = Math.min(70, g.step - 10);
    const y = bottom + 10;
    const isWin = i === path.end;
    // 쪽지 아래 결과
    if (isWin && t > T.flip + 120) {
      const k = spring((t - T.flip - 120) / 500);
      ctx.save();
      ctx.translate(x, y + 18);
      ctx.scale(k, k);
      chalkText(ctx, RESULTS[i], 0, 0, { font: '700 26px "Gaegu", sans-serif', color: CHALK.yellow, seed: 9 });
      ctx.restore();
    }
    const appear = ease((t - T.rails - 300 - i * 80) / 400);
    if (appear <= 0) return;
    let ang = 0;
    if (isWin && t > T.flip) ang = Math.min(Math.PI * 0.94, spring((t - T.flip) / 650) * Math.PI * 0.94);
    const c = Math.cos(ang);
    ctx.save();
    ctx.globalAlpha = appear;
    ctx.translate(x, y);
    ctx.scale(1, c);
    ctx.fillStyle = c >= 0 ? "#f6efdc" : "#d8cba9";
    ctx.fillRect(-w / 2, 0, w, 36);
    if (c > 0.2) {
      ctx.fillStyle = "rgba(43,38,32,0.45)";
      ctx.font = '700 20px "Gaegu", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", 0, 19);
    }
    ctx.restore();
    // 테이프
    ctx.save();
    ctx.globalAlpha = appear * 0.8;
    ctx.fillStyle = "rgba(255,246,200,0.75)";
    ctx.translate(x, y);
    ctx.rotate(-0.06);
    ctx.fillRect(-16, -5, 32, 10);
    ctx.restore();
  }

  function scene(t, dt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    let eraseX = -1;
    if (t > T.erase) eraseX = ((t - T.erase) / (T.end - T.erase)) * (W + 160) - 80;
    if (eraseX > -1) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(eraseX + 30, 0, W, H);
      ctx.clip();
    }

    for (let i = 0; i < 4; i++) drawCard(i, t);
    // 세로줄
    for (let i = 0; i < 4; i++) {
      const p = ease((t - T.rails - i * 90) / 550);
      if (p > 0) chalkStroke(ctx, [[X(i), Y(0)], [X(i), Y(1)]], { seed: i + 1, progress: p, width: 3.2, wobble: 0.9 });
    }
    // 기본 다리
    BASE.forEach((r, k) => {
      const p = ease((t - T.rungs - k * 95) / 170);
      if (p > 0) chalkStroke(ctx, [[X(r.a), Y(r.y)], [X(r.a + 1), Y(r.y + r.dy)]], { seed: 20 + k, progress: p, width: 3, wobble: 0.8 });
    });
    // 몰래 한 줄
    const sp = ease((t - T.secret) / 420);
    let handX = null;
    let handY = null;
    const sx1 = X(SECRET.a);
    const sx2 = X(SECRET.a + 1);
    const sy1 = Y(SECRET.y);
    const sy2 = Y(SECRET.y + SECRET.dy);
    if (sp > 0) {
      const tip = chalkStroke(ctx, [[sx1, sy1], [sx2, sy2]], { color: CHALK.yellow, seed: 77, progress: sp, width: 3.6, wobble: 1 });
      if (tip && sp < 1) dust.emit(tip[0], tip[1], CHALK.yellow, 2);
    }
    if (t > T.handIn && t < T.handOut + 500) {
      if (t < T.secret) {
        const k = ease((t - T.handIn) / (T.secret - T.handIn));
        handX = W + 40 - (W + 40 - sx1) * k;
        handY = sy1 + (1 - k) * 60;
      } else if (t < T.handOut) {
        handX = sx1 + (sx2 - sx1) * sp;
        handY = sy1 + (sy2 - sy1) * sp;
      } else {
        const k = ease((t - T.handOut) / 500);
        handX = sx2 + (W + 80 - sx2) * k;
        handY = sy2 + k * 50;
      }
    }

    // 분필 길
    const tp = (t - T.trace) / T.traceDur;
    if (tp > 0) {
      const pts = path.pts.map(([rail, v]) => [X(rail), Y(v)]);
      const tip = chalkStroke(ctx, pts, { color: CHALK.pink, seed: 5, progress: Math.min(1, tp), width: 5, wobble: 1.4 });
      if (tip && tp < 1) dust.emit(tip[0], tip[1], CHALK.pink, 3);
    }

    for (let i = 0; i < 4; i++) drawFlap(i, t);

    dust.step(dt);
    dust.draw(ctx);
    if (handX != null) drawHand(handX, handY);

    if (eraseX > -1) {
      ctx.restore();
      // 지우개 자국 + 지우개
      ctx.fillStyle = "rgba(243,240,230,0.05)";
      for (let k = 0; k < 6; k++) ctx.fillRect(Math.max(0, eraseX - 300), 40 + k * (H / 6), Math.min(300, eraseX + 30), H / 9);
      ctx.save();
      ctx.translate(eraseX, H * 0.5);
      ctx.rotate(0.1);
      ctx.fillStyle = "#2b2620";
      ctx.fillRect(-26, -H * 0.5 - 20, 60, H + 40);
      ctx.fillStyle = "#4b6d8f";
      ctx.fillRect(18, -H * 0.5 - 20, 16, H + 40);
      ctx.restore();
    }

    if (t > T.flip + 350) {
      /* 아래에서 처리 */
    } else if (t < T.rungs) setNote(0);
    else if (t < T.handIn) setNote(1);
    else if (t < T.trace) setNote(2);
    else if (t < T.flip) setNote(3);
    else setNote(4);
    if (t > T.flip + 350 && noteIdx !== 5) {
      noteIdx = 5;
      note.textContent = "민지 당첨!";
      note.classList.remove("is-swap");
      void note.offsetWidth;
      note.classList.add("is-swap");
    }
  }

  if (prefersReducedMotion()) {
    scene(T.hold, 0.016);
    note.textContent = "민지 당첨!";
    return { stop() { stopped = true; removeEventListener("resize", resize); } };
  }

  const frame = (now) => {
    if (stopped) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    let t = now - t0;
    if (t > T.end) {
      t0 = now;
      t = 0;
      noteIdx = -1;
    }
    scene(t, dt);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  document.fonts?.ready?.then(resize);

  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      removeEventListener("resize", resize);
    },
  };
}
