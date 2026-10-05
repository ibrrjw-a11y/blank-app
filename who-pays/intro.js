// 첫 화면 모션그래픽: 이름 → 구슬 → 레이스 → 바나나 개입 → 꼴찌 도장
import { runIntro, prefersReducedMotion, CANVAS_FONT, roundRect } from "../shared/kit.js";
import { PALETTE, readTokens, drawMarble, alpha, fitCanvas } from "./common.js";

const NAMES = ["민수", "영희", "철수", "지은"];
const COLORS = [PALETTE[0], PALETTE[1], PALETTE[2], PALETTE[3]];
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function bounce(t) {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
}

export function startIntro(root) {
  const stage = root.querySelector(".intro__stage");
  stage.innerHTML = '<canvas class="intro__canvas"></canvas>';
  const canvas = stage.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  let view = fitCanvas(canvas);
  const ro = new ResizeObserver(() => {
    view = fitCanvas(canvas);
    if (reduced) drawStatic();
  });
  ro.observe(stage);
  const tk = readTokens();
  const reduced = prefersReducedMotion();

  let scene = 0;
  let t0 = performance.now();
  let raf = 0;
  let alive = true;

  /* ---------- 장면 1: 이름 → 구슬 ---------- */
  function scene1(t) {
    const { w, h } = view;
    const floorY = h * 0.8;
    // 바닥
    ctx.strokeStyle = alpha(tk.brand, 0.6);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(w * 0.1, floorY);
    ctx.lineTo(w * 0.9, floorY);
    ctx.stroke();
    NAMES.forEach((nm, i) => {
      const appear = 0.15 + i * 0.3;
      if (t < appear) return;
      const chipY = h * 0.16 + i * 50;
      const typed = Array.from(nm).slice(0, Math.floor((t - appear) / 0.09) + 1).join("");
      const m0 = 1.55 + i * 0.1;
      const morph = clamp01((t - m0) / 0.3);
      const drop = clamp01((t - m0 - 0.3) / 0.75);
      const r = 18;
      const tx = w * (0.2 + i * 0.2);
      const x = w / 2 + (tx - w / 2) * easeOut(clamp01((t - m0) / 0.6));
      const y = chipY + (floorY - r - 2 - chipY) * bounce(drop);
      if (morph < 1) {
        const cw = 104 + (r * 2 - 104) * easeInOut(morph);
        const ch = 40 + (r * 2 - 40) * easeInOut(morph);
        ctx.globalAlpha = 1;
        roundRect(ctx, x - cw / 2, y - ch / 2, cw, ch, ch / 2);
        ctx.fillStyle = morph > 0 ? COLORS[i] : tk.raised;
        ctx.globalAlpha = morph > 0 ? morph : 1;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = COLORS[i];
        ctx.stroke();
        ctx.fillStyle = morph > 0 ? "rgba(10,12,16,0.85)" : tk.text;
        ctx.font = `700 17px ${CANVAS_FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.globalAlpha = 1 - morph;
        ctx.fillText(typed + (t - appear < 0.5 && Math.floor(t * 6) % 2 ? "|" : ""), x, y + 1);
        ctx.globalAlpha = 1;
      } else {
        drawMarble(ctx, x, y, r, COLORS[i], nm[0], 0, tk);
      }
    });
  }

  /* ---------- 장면 2: 지그재그 코스 ---------- */
  function zigPath(w) {
    const pts = [];
    let y = 0;
    for (let k = 0; k < 7; k++) {
      const left = k % 2 === 0;
      const x0 = left ? w * 0.14 : w * 0.86;
      const x1 = left ? w * 0.8 : w * 0.2;
      pts.push([x0, y], [x1, y + 64]);
      y += 64 + 56; // 경사 + 낙하
    }
    return pts;
  }
  function along(pts, s) {
    let acc = 0;
    for (let k = 1; k < pts.length; k++) {
      const [ax, ay] = pts[k - 1];
      const [bx, by] = pts[k];
      const L = Math.hypot(bx - ax, by - ay);
      if (acc + L >= s) {
        const u = (s - acc) / L;
        return [ax + (bx - ax) * u, ay + (by - ay) * u];
      }
      acc += L;
    }
    return pts[pts.length - 1];
  }
  function scene2(t) {
    const { w, h } = view;
    const pts = zigPath(w);
    const r = 13;
    const prog = NAMES.map((_, i) => Math.max(0, 230 * t + 30 * Math.sin(t * 2.4 + i * 1.9) - i * 30 + 60));
    const pos = prog.map((s) => along(pts, s));
    const meanY = pos.reduce((a, p) => a + p[1], 0) / pos.length;
    const camY = meanY - h * 0.45;
    ctx.save();
    ctx.translate(0, -camY);
    // 경사로
    ctx.lineCap = "round";
    for (let k = 0; k < pts.length; k += 2) {
      const [ax, ay] = pts[k];
      const [bx, by] = pts[k + 1];
      const off = r + 5;
      ctx.strokeStyle = alpha(tk.brand, 0.25);
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(ax, ay + off);
      ctx.lineTo(bx, by + off);
      ctx.stroke();
      ctx.strokeStyle = tk.text2;
      ctx.lineWidth = 5;
      ctx.stroke();
    }
    // 꼬리 + 구슬
    NAMES.forEach((nm, i) => {
      for (let k = 6; k >= 1; k--) {
        const [x, y] = along(pts, Math.max(0, prog[i] - k * 9));
        ctx.beginPath();
        ctx.arc(x, y, r * (1 - k / 8), 0, Math.PI * 2);
        ctx.fillStyle = alpha(COLORS[i], 0.25 * (1 - k / 7));
        ctx.fill();
      }
    });
    NAMES.forEach((nm, i) => drawMarble(ctx, pos[i][0], pos[i][1], r, COLORS[i], nm[0], prog[i] / r, tk));
    ctx.restore();
    // 순위 칩
    const order = NAMES.map((_, i) => i).sort((a, b) => prog[b] - prog[a]);
    ctx.font = `700 12px ${CANVAS_FONT}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    order.forEach((i, k) => {
      const y = 16 + k * 26;
      roundRect(ctx, 10, y - 10, 70, 22, 11);
      ctx.fillStyle = k === order.length - 1 ? tk.danger : "rgba(8,9,12,0.7)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(22, y + 1, 5, 0, Math.PI * 2);
      ctx.fillStyle = COLORS[i];
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText(`${k + 1} ${NAMES[i]}`, 32, y + 1.5);
    });
  }

  /* ---------- 장면 3: 바나나로 개입 ---------- */
  function scene3(t) {
    const { w, h } = view;
    const r = 16;
    // 흘러가는 트랙 줄무늬 (아래로 달리는 느낌)
    const laneL = w * 0.2;
    const laneR = w * 0.8;
    ctx.fillStyle = tk.surface;
    ctx.fillRect(laneL, 0, laneR - laneL, h);
    ctx.strokeStyle = alpha(tk.brand, 0.8);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(laneL, 0);
    ctx.lineTo(laneL, h);
    ctx.moveTo(laneR, 0);
    ctx.lineTo(laneR, h);
    ctx.stroke();
    ctx.strokeStyle = tk.border;
    ctx.lineWidth = 1;
    const off = (t * 260) % 50;
    ctx.beginPath();
    for (let y = -off; y < h; y += 50) {
      ctx.moveTo(laneL, y);
      ctx.lineTo(laneR, y);
    }
    ctx.stroke();

    const hitT = 1.25;
    const slip = clamp01((t - hitT) / 1.3);
    // 화면상 y: 클수록 앞(아래)
    const base = [h * 0.6, h * 0.46, h * 0.36, h * 0.27];
    const ys = base.map((y, i) => y + Math.sin(t * 3 + i) * 6);
    ys[1] += easeOut(clamp01((t - hitT - 0.2) / 1.2)) * h * 0.2;
    ys[2] += easeOut(clamp01((t - hitT - 0.35) / 1.2)) * h * 0.2;
    ys[3] += easeOut(clamp01((t - hitT - 0.5) / 1.2)) * h * 0.15;
    ys[0] -= easeOut(slip) * h * 0.38;
    const xs = [w * 0.5, w * 0.36, w * 0.62, w * 0.46];
    xs[0] += Math.sin(slip * 9) * 16 * (1 - slip);
    NAMES.forEach((nm, i) => {
      drawMarble(ctx, xs[i], ys[i], r, COLORS[i], nm[0], i === 0 ? slip * 14 : 0, tk);
      ctx.font = `700 11px ${CANVAS_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = tk.text;
      ctx.fillText(nm, xs[i], ys[i] - r - 9);
    });

    // 아이템 버튼
    const bx = w / 2;
    const by = h - 34;
    const press = t > 0.55 && t < 0.8;
    const used = t >= 0.7;
    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(press ? 0.94 : 1, press ? 0.94 : 1);
    roundRect(ctx, -86, -22, 172, 44, 14);
    ctx.fillStyle = used ? tk.sunken : tk.raised;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = used ? tk.border : COLORS[1];
    ctx.stroke();
    ctx.font = `700 15px ${CANVAS_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = used ? tk.text3 : tk.text;
    ctx.fillText(used ? "🍌 영희 · 사용함" : "🍌 영희 · 바나나", 0, 1);
    ctx.restore();
    // 손가락 탭
    if (t > 0.25 && t < 1.1) {
      const k = clamp01((t - 0.25) / 0.35);
      const fx = bx + 40;
      const fy = by + 30 - easeOut(k) * 18;
      if (t > 0.6) {
        const rk = clamp01((t - 0.6) / 0.4);
        ctx.beginPath();
        ctx.arc(bx + 34, by, 10 + rk * 30, 0, Math.PI * 2);
        ctx.strokeStyle = alpha(tk.brand, 1 - rk);
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.font = `30px ${CANVAS_FONT}`;
      ctx.fillText("👆", fx, fy);
    }
    // 날아가는 바나나
    if (t > 0.7 && t < hitT) {
      const k = (t - 0.7) / (hitT - 0.7);
      const x = bx + (xs[0] - bx) * k;
      const y = by + (ys[0] - by) * k - Math.sin(k * Math.PI) * 80;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(k * 14);
      ctx.font = `28px ${CANVAS_FONT}`;
      ctx.fillText("🍌", 0, 0);
      ctx.restore();
    }
    // 맞음
    if (t >= hitT) {
      const k = clamp01((t - hitT) / 0.5);
      ctx.beginPath();
      ctx.arc(xs[0], ys[0], r + k * 40, 0, Math.PI * 2);
      ctx.strokeStyle = alpha(tk.warning, 1 - k);
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.globalAlpha = clamp01(2 - (t - hitT));
      ctx.font = `800 18px ${CANVAS_FONT}`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(8,9,12,0.85)";
      ctx.strokeText("🍌 미끄덩!", xs[0] + 6, ys[0] - 40 - k * 16);
      ctx.fillStyle = tk.warning;
      ctx.fillText("🍌 미끄덩!", xs[0] + 6, ys[0] - 40 - k * 16);
      ctx.globalAlpha = 1;
    }
    // 말풍선
    if (t > 1.9) {
      const k = easeOut(clamp01((t - 1.9) / 0.3));
      ctx.save();
      ctx.translate(w / 2, h * 0.12);
      ctx.scale(0.7 + k * 0.3, 0.7 + k * 0.3);
      ctx.globalAlpha = k;
      ctx.font = `800 17px ${CANVAS_FONT}`;
      const text = "내가 판을 뒤집을 수 있어요!";
      const tw = ctx.measureText(text).width + 32;
      roundRect(ctx, -tw / 2, -20, tw, 40, 20);
      ctx.fillStyle = tk.brand;
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText(text, 0, 1);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- 장면 4: 결승 + 도장 ---------- */
  function scene4(t) {
    const { w, h } = view;
    const r = 15;
    const fy = h * 0.5;
    const sq = 12;
    for (let x = w * 0.1, k = 0; x < w * 0.9; x += sq, k++) {
      ctx.fillStyle = k % 2 ? tk.text : tk.sunken;
      ctx.fillRect(x, fy - sq, sq, sq);
      ctx.fillStyle = k % 2 ? tk.sunken : tk.text;
      ctx.fillRect(x, fy, sq, sq);
    }
    // 도착 순서: 영희, 철수, 지은, 민수(꼴찌)
    const order = [1, 2, 3, 0];
    order.forEach((i, k) => {
      const arrive = 0.2 + k * 0.42 + (k === 3 ? 0.35 : 0);
      const p = clamp01((t - (arrive - 0.6)) / 0.6);
      const slotX = w * (0.22 + k * 0.19);
      const startY = -30;
      const endY = h * 0.72;
      const y = startY + (endY - startY) * easeOut(p);
      drawMarble(ctx, slotX, y, r, COLORS[i], NAMES[i][0], 0, tk);
      if (p >= 1) {
        ctx.font = `800 12px ${CANVAS_FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = k === 3 ? tk.danger : tk.text2;
        ctx.fillText(k === 3 ? "꼴찌" : `${k + 1}등`, slotX, endY + r + 14);
        ctx.fillStyle = tk.text;
        ctx.fillText(NAMES[i], slotX, endY - r - 12);
      }
    });
    const st = 2.15;
    if (t > st) {
      const k = clamp01((t - st) / 0.25);
      const sc = 1 + (1 - easeOut(k)) * 1.6;
      ctx.save();
      const shake = t - st < 0.45 && k >= 1 ? (Math.random() - 0.5) * 6 : 0;
      ctx.translate(w / 2 + shake, h * 0.28);
      ctx.rotate(-0.13);
      ctx.scale(sc, sc);
      ctx.globalAlpha = k;
      ctx.font = `900 26px ${CANVAS_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const text = "☕ 민수가 쏩니다!";
      const tw = ctx.measureText(text).width + 40;
      roundRect(ctx, -tw / 2, -32, tw, 64, 12);
      ctx.fillStyle = "rgba(8,9,12,0.75)";
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = tk.danger;
      ctx.stroke();
      ctx.fillStyle = tk.danger;
      ctx.fillText(text, 0, 2);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  const fns = [scene1, scene2, scene3, scene4];
  const staticT = [2.6, 1.6, 2.4, 3];

  function paint(t) {
    const { w, h, dpr } = view;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    fns[scene](t);
  }
  function drawStatic() {
    paint(staticT[scene]);
  }
  function loop(now) {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    if (document.hidden) return;
    paint((now - t0) / 1000);
  }

  const scenes = [
    { title: "이름을 적으면 구슬이 돼요", desc: "같이 내기할 친구 이름을 넣어요. 2~12명까지 돼요", duration: 3000 },
    { title: "매번 새 코스를 굴러 내려가요", desc: "핀, 범퍼, 회전 패들… 순위는 끝까지 몰라요", duration: 3000 },
    { title: "구경만 하지 말고 개입해요", desc: "🍌 바나나 한 방에 1등이 미끄러져요. 아이템은 한 명당 1개!", duration: 3400 },
    { title: "꼴찌가 쏩니다 ☕", desc: "결과는 장부에 남고, 레이스 영상도 저장할 수 있어요", duration: 3400 },
  ].map((s, i) => ({
    ...s,
    play() {
      scene = i;
      t0 = performance.now();
      if (reduced) drawStatic();
    },
  }));

  const ctrl = runIntro({ root, scenes, loop: true });
  if (!reduced) raf = requestAnimationFrame(loop);

  return {
    stop() {
      alive = false;
      cancelAnimationFrame(raf);
      ctrl.stop();
      ro.disconnect();
    },
  };
}
