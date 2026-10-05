// 배틀로얄 첫 화면: 01 링 입장(위에서 떨어져 착지) · 02 링 축소 + 돌진 · 03 링 밖으로 탈락 + 판정
import { CANVAS_FONT } from "../../shared/kit.js";
import { alpha, spring, squashAmt, slant, drawMarble, drawVerdict } from "../common.js";
import { runBroadcast, clamp01, easeOut, easeIn, DEMO_NAMES as NAMES, DEMO_COLORS as COLORS } from "../broadcast.js";

const SCENES = [
  { tag: "01 입장", lines: ["이름 넣으면", "링 위로 낙하"], desc: "2~12명. 원형 링 위 무작위 자리에 떨어져요.", dur: 3200 },
  { tag: "02 축소", lines: ["링이", "점점 좁아져요"], desc: "22초 동안 반지름 170 → 40. 서로 밀어내요.", dur: 3800 },
  { tag: "03 탈락", lines: ["밀려나면", "바로 탈락"], desc: "먼저 떨어진 사람이 당첨. 반대 규칙도 있어요.", dur: 4200 },
];

// 데모 위치 (링 반지름 1 기준)
const HOME = [
  [-0.42, -0.3],
  [0.45, -0.22],
  [0.32, 0.42],
  [-0.36, 0.4],
];

export function startIntro(root) {
  return runBroadcast(root, {
    scenes: SCENES,
    staticT: [3.0, 3.4, 3.8],
    draw(env) {
      const { ctx, tk } = env;

      const geo = () => {
        const { w, h } = env.view;
        const R = Math.min(w * 0.4, (h - 168) / 2);
        return { w, h, cx: w / 2, cy: h - R - 14, R, r: Math.max(15, R * 0.15) };
      };

      // 링: 연석(빨강·흰색 교차) 테두리 + 바닥 + 줄어든 만큼 위험 구역
      function ring(cx, cy, R, rNow, sweep = 1, pulse = 0) {
        if (rNow < R) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, R, 0, Math.PI * 2);
          ctx.arc(cx, cy, rNow, 0, Math.PI * 2, true);
          ctx.fillStyle = alpha(tk.brand, 0.14 + pulse * 0.1);
          ctx.fill("evenodd");
          ctx.clip("evenodd");
          ctx.strokeStyle = alpha(tk.brand, 0.35);
          ctx.lineWidth = 3;
          for (let k = -R * 2; k < R * 2; k += 14) {
            ctx.beginPath();
            ctx.moveTo(cx + k, cy - R);
            ctx.lineTo(cx + k + R, cy + R);
            ctx.stroke();
          }
          ctx.restore();
        }
        ctx.beginPath();
        ctx.arc(cx, cy, rNow, 0, Math.PI * 2);
        ctx.fillStyle = tk.line;
        ctx.globalAlpha = 0.5;
        ctx.fill();
        ctx.globalAlpha = 1;
        // 바닥 동심원
        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.lineWidth = 1;
        for (let q = 1; q <= 3; q++) {
          ctx.beginPath();
          ctx.arc(cx, cy, (rNow * q) / 4, 0, Math.PI * 2);
          ctx.stroke();
        }
        const seg = 28;
        for (let k = 0; k < seg * sweep; k++) {
          const a0 = -Math.PI / 2 + (k / seg) * Math.PI * 2;
          const a1 = a0 + (Math.PI * 2) / seg;
          ctx.beginPath();
          ctx.arc(cx, cy, rNow, a0, a1);
          ctx.strokeStyle = k % 2 ? tk.chalk : tk.brand;
          ctx.lineWidth = 8;
          ctx.stroke();
        }
      }

      function nameTag(x, y, nm, hot) {
        ctx.font = `700 13px ${CANVAS_FONT}`;
        const lw = ctx.measureText(nm).width + 14;
        slant(ctx, x - lw / 2, y, lw, 19, 4);
        ctx.fillStyle = hot ? tk.brand : "rgba(8,9,12,0.85)";
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(nm, x, y + 10.5);
      }

      function bigPlate(t, label, value) {
        const { w, h } = env.view;
        const k = spring(t / 0.55);
        const bw = 118;
        const bx = w - 10 - bw + (1 - k) * 180;
        slant(ctx, bx, 12, bw, 22, 0);
        ctx.fillStyle = tk.chalk;
        ctx.fill();
        slant(ctx, bx, 36, bw, h * 0.15, 0);
        ctx.fillStyle = tk.brand;
        ctx.fill();
        ctx.fillStyle = tk.bg;
        ctx.font = `400 13px ${tk.num}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, bx + bw / 2, 24);
        ctx.fillStyle = "#fff";
        ctx.font = `400 ${Math.round(h * 0.1)}px ${tk.num}`;
        ctx.fillText(value, bx + bw / 2, 36 + h * 0.078);
      }

      /* 01 입장: 링이 그려지고, 구슬이 위에서(크게 보였다가) 떨어져 착지 */
      function scene1(t, dt) {
        env.floor();
        const { cx, cy, R, r } = geo();
        const sweep = easeOut(t / 0.6);
        const sc = 0.85 + 0.15 * spring(t / 0.6);
        ring(cx, cy, R * sc, R * sc, sweep);
        NAMES.forEach((nm, i) => {
          const land = 0.75 + i * 0.22;
          const fall = 0.42;
          const p = clamp01((t - (land - fall)) / fall);
          if (p <= 0) return;
          const x = cx + HOME[i][0] * R;
          const y = cy + HOME[i][1] * R;
          if (p < 1) {
            // 하늘에서 떨어지는 중: 크고 그림자는 멀리
            const s = 1 + (1 - easeIn(p)) * 1.6;
            ctx.beginPath();
            ctx.ellipse(x, y + r * 0.6, r * (0.4 + p * 0.6), r * 0.3 * p, 0, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0,0,0,${0.35 * p})`;
            ctx.fill();
            ctx.globalAlpha = 0.4 + p * 0.6;
            drawMarble(ctx, x, y - (1 - p) * 40, r * s, COLORS[i], nm[0], 0, tk);
            ctx.globalAlpha = 1;
          } else {
            const tau = t - land;
            if (tau < 0.5) {
              ctx.beginPath();
              ctx.arc(x, y, r + tau * 70, 0, Math.PI * 2);
              ctx.strokeStyle = alpha(COLORS[i], 1 - tau / 0.5);
              ctx.lineWidth = 3;
              ctx.stroke();
            }
            env.marbleAt(x, y, r, i, tau);
            nameTag(x, y + r + 8, nm, false);
          }
        });
        if (t > 1.6) {
          env.tower([0, 1, 2, 3], ["IN", "IN", "IN", "IN"], dt, { title: "RING", x: 10, y: 10 });
          bigPlate(t - 1.7, "RADIUS", "170");
        }
      }

      /* 02 축소: 링이 줄고, 영희가 🚀 돌진해서 민수를 가장자리로 */
      function scene2(t, dt) {
        env.floor();
        const { cx, cy, R, r } = geo();
        const shrink = easeOut(clamp01((t - 0.2) / 3.2));
        const rNow = R * (1 - 0.42 * shrink);
        ring(cx, cy, R, rNow, 1, Math.sin(t * 8) * 0.5 + 0.5);
        const pull = 1 - 0.38 * shrink;
        const pos = HOME.map(([px, py], i) => [cx + px * R * pull + Math.sin(t * 2.4 + i * 1.7) * 6, cy + py * R * pull + Math.cos(t * 2.1 + i) * 6]);
        // 돌진: 영희(1) → 민수(0)
        const dashA = 1.3;
        const hitT = 1.75;
        if (t > dashA) {
          const k = easeIn((t - dashA) / (hitT - dashA));
          const back = t > hitT ? easeOut((t - hitT) / 0.6) : 0;
          const [ax, ay] = pos[1];
          const [bx, by] = pos[0];
          const dx = bx - ax;
          const dy = by - ay;
          const d = Math.hypot(dx, dy) || 1;
          const reach = Math.min(1, k) * (d - r * 2);
          pos[1] = [ax + (dx / d) * (reach - back * 30), ay + (dy / d) * (reach - back * 30)];
          if (t > hitT) {
            const push = easeOut((t - hitT) / 0.7);
            const ex = cx + ((bx - cx) / Math.hypot(bx - cx, by - cy)) * (rNow - r * 0.9);
            const ey = cy + ((by - cy) / Math.hypot(bx - cx, by - cy)) * (rNow - r * 0.9);
            pos[0] = [bx + (ex - bx) * push, by + (ey - by) * push];
          }
          if (t < hitT) {
            ctx.strokeStyle = alpha(COLORS[1], 0.45);
            ctx.lineWidth = r * 1.4;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(pos[1][0], pos[1][1]);
            ctx.stroke();
          }
        }
        if (t > hitT && t < hitT + 0.5) {
          const k = (t - hitT) / 0.5;
          ctx.beginPath();
          ctx.arc(pos[0][0], pos[0][1], r + k * 46, 0, Math.PI * 2);
          ctx.strokeStyle = alpha(tk.warning, 1 - k);
          ctx.lineWidth = 5;
          ctx.stroke();
        }
        NAMES.forEach((nm, i) => {
          const sq = i === 0 && t > hitT ? squashAmt(t - hitT, 0.3) : 0;
          drawMarble(ctx, pos[i][0], pos[i][1], r, COLORS[i], nm[0], 0, tk, 1 + sq, 1 - sq);
          nameTag(pos[i][0], pos[i][1] + r + 8, nm, i === 0 && t > hitT);
        });
        if (t > 1.05 && t < 2.6) {
          const k = clamp01((t - 1.05) / 0.3);
          const [x, y] = pos[1];
          ctx.font = `800 15px ${tk.display}`;
          const lab = "🚀 영희 돌진!";
          const lw = ctx.measureText(lab).width + 18;
          ctx.globalAlpha = k;
          slant(ctx, x - lw / 2, y - r - 34 - (1 - spring(k)) * 10, lw, 24, 5);
          ctx.fillStyle = tk.chalk;
          ctx.fill();
          ctx.fillStyle = tk.bg;
          ctx.textAlign = "center";
          ctx.fillText(lab, x, y - r - 21 - (1 - spring(k)) * 10);
          ctx.globalAlpha = 1;
        }
        const dist = pos.map(([x, y]) => Math.hypot(x - cx, y - cy) / rNow);
        const order = [0, 1, 2, 3].sort((a, b) => dist[a] - dist[b]);
        env.tower(order, order.map((i) => `${Math.round(dist[i] * 100)}%`), dt, { title: "EDGE", x: 10, y: 10, hot: t > hitT ? 0 : -1 });
        bigPlate(t, "RADIUS", String(Math.round(170 - 78 * shrink)));
      }

      /* 03 탈락: 민수가 가장자리에서 밀려 떨어지고 판정 */
      function scene3(t, dt) {
        env.floor();
        const { w, h, cx, cy, R, r } = geo();
        const rNow = R * 0.66;
        ring(cx, cy, R, rNow, 1, 0.4);
        const base = [
          [cx - rNow * 0.72, cy + rNow * 0.38],
          [cx + rNow * 0.02, cy + rNow * 0.42],
          [cx + rNow * 0.48, cy - rNow * 0.12],
          [cx - rNow * 0.18, cy - rNow * 0.5],
        ];
        const pos = base.map(([x, y], i) => [x + Math.sin(t * 2 + i) * 4, y + Math.cos(t * 1.8 + i) * 4]);
        // 철수(2)가 아니라 영희(1)가 다시 밀어냄
        const hit = 0.55;
        const lean = clamp01(t / hit);
        pos[1][0] -= easeIn(lean) * rNow * 0.22;
        const out = clamp01((t - hit) / 0.45);
        const ang = Math.atan2(base[0][1] - cy, base[0][0] - cx);
        const dOut = rNow * 0.82 + easeOut(out) * rNow * 0.65;
        pos[0] = [cx + Math.cos(ang) * dOut, cy + Math.sin(ang) * dOut];
        const fall = clamp01((t - hit - 0.4) / 0.6);
        NAMES.forEach((nm, i) => {
          if (i === 0) {
            const s = 1 - easeIn(fall) * 0.7;
            ctx.save();
            ctx.globalAlpha = 1 - fall * 0.8;
            drawMarble(ctx, pos[0][0], pos[0][1] + fall * 20, r * s, COLORS[0], nm[0], fall * 6, tk);
            ctx.restore();
            return;
          }
          drawMarble(ctx, pos[i][0], pos[i][1], r, COLORS[i], nm[0], 0, tk);
          nameTag(pos[i][0], pos[i][1] + r + 8, nm, false);
        });
        if (t > hit && t < hit + 0.45) {
          const k = (t - hit) / 0.45;
          ctx.beginPath();
          ctx.arc(pos[0][0], pos[0][1], r + k * 40, 0, Math.PI * 2);
          ctx.strokeStyle = alpha(tk.brand, 1 - k);
          ctx.lineWidth = 5;
          ctx.stroke();
        }
        // OUT 도장
        if (t > hit + 0.5) {
          const k = spring((t - hit - 0.5) / 0.45);
          ctx.save();
          ctx.translate(Math.max(48, pos[0][0]), pos[0][1] - r - 10);
          ctx.rotate(-0.12);
          ctx.scale(k, k);
          slant(ctx, -36, -16, 72, 30, 6);
          ctx.fillStyle = tk.brand;
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.font = `400 22px ${tk.num}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("OUT", 0, 0);
          ctx.restore();
        }
        const order = [1, 2, 3, 0];
        env.tower(order, ["IN", "IN", "IN", t > hit + 0.5 ? "OUT" : "IN"], dt, { title: "SURVIVORS", x: 10, y: 10, hot: t > hit + 0.5 ? 0 : -1 });
        // 규칙 판
        const k2 = spring((t - 0.1) / 0.5);
        const px = w - 10 - 150 + (1 - k2) * 220;
        slant(ctx, px, 12, 150, 28, 0);
        ctx.fillStyle = tk.chalk;
        ctx.fill();
        ctx.fillStyle = tk.bg;
        ctx.font = `800 14px ${tk.display}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText("먼저 떨어지면 당첨", px + 10, 27);
        drawVerdict(ctx, w, cy - R * 0.72, "민수가 쏩니다 ☕", t - 1.75, tk);
      }

      return [scene1, scene2, scene3];
    },
  });
}
