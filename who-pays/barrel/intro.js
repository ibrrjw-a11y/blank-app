// 통아저씨 첫 화면: 01 구멍 뚫기(사람 수 × 2) · 02 차례대로 칼 꽂기(세이프!) · 03 해적 튀어나옴 + 판정
import { alpha, spring, squashAmt, slant, drawVerdict } from "../common.js";
import { runBroadcast, clamp01, easeOut, easeIn } from "../broadcast.js";

const SCENES = [
  { tag: "01 구멍", lines: ["사람 수 × 2", "구멍이 뚫려요"], desc: "4명이면 구멍 8개. 해적 스위치는 그중 딱 하나.", dur: 3000 },
  { tag: "02 차례", lines: ["폰을 돌려", "한 칸씩 찌르기"], desc: "차례는 무작위로 섞여요. 한 번에 칼 하나.", dur: 3600 },
  { tag: "03 판정", lines: ["해적이 튀면", "당첨"], desc: "칼마다 확률이 같아서 4명이면 한 사람당 25%.", dur: 4200 },
];

const ORDER = [2, 0, 3, 1]; // 철수 → 민수 → 지은 → 영희
const COLS = 4;

export function startIntro(root) {
  return runBroadcast(root, {
    scenes: SCENES,
    staticT: [2.8, 3.2, 3.8],
    draw(env) {
      const { ctx, tk } = env;
      const cs = getComputedStyle(document.documentElement);
      const art = (n, f) => cs.getPropertyValue(n).trim() || f;
      const wood = [art("--art-wood-1", "#5a2c12"), art("--art-wood-2", "#9a5527"), art("--art-wood-3", "#c4773b")];
      const woodLine = art("--art-wood-line", "#4a230d");
      const hoop = [art("--art-hoop-1", "#2a2e36"), art("--art-hoop-2", "#7b8494")];
      const holeC = art("--art-hole", "#120803");
      const rim = art("--art-rim", "#2b1407");
      const skin = art("--art-skin", "#ffd2a8");
      const ink = art("--art-ink", "#0a0b0d");

      const geo = () => {
        const { w, h } = env.view;
        const bh = Math.min(h - 170, w * 0.82);
        const bw = bh * 0.92;
        return { w, h, bw, bh, x: (w - bw) / 2, y: h - bh - 10 };
      };
      const holeAt = (k, g) => {
        const c = k % COLS;
        const r = Math.floor(k / COLS);
        return [g.x + g.bw * (0.22 + c * 0.187), g.y + g.bh * (0.42 + r * 0.26)];
      };

      function pirate(cx, cy, s, rot = 0) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot);
        ctx.scale(s, s);
        ctx.beginPath();
        ctx.arc(0, 8, 40, 0, Math.PI * 2);
        ctx.fillStyle = skin;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-42, -2);
        ctx.quadraticCurveTo(0, -54, 42, -2);
        ctx.quadraticCurveTo(0, -16, -42, -2);
        ctx.fillStyle = tk.brand;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-16, 6, 11, 0, Math.PI * 2);
        ctx.fillStyle = ink;
        ctx.fill();
        ctx.strokeStyle = ink;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-38, -6);
        ctx.lineTo(26, 20);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(16, 6, 6, 0, Math.PI * 2);
        ctx.fillStyle = tk.chalk;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(17, 7, 3.4, 0, Math.PI * 2);
        ctx.fillStyle = ink;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-20, 28);
        ctx.quadraticCurveTo(0, 40, 22, 26);
        ctx.strokeStyle = wood[0];
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.restore();
      }

      function barrel(g, sx = 1, sy = 1, holes = 8, used = []) {
        const { x, y, bw, bh } = g;
        ctx.save();
        ctx.translate(x + bw / 2, y + bh);
        ctx.scale(sx, sy);
        ctx.translate(-(x + bw / 2), -(y + bh));
        const grad = ctx.createLinearGradient(x, 0, x + bw, 0);
        grad.addColorStop(0, wood[0]);
        grad.addColorStop(0.22, wood[1]);
        grad.addColorStop(0.5, wood[2]);
        grad.addColorStop(0.78, wood[1]);
        grad.addColorStop(1, wood[0]);
        ctx.beginPath();
        ctx.moveTo(x + bw * 0.13, y + bh * 0.06);
        ctx.quadraticCurveTo(x - bw * 0.02, y + bh * 0.5, x + bw * 0.13, y + bh);
        ctx.lineTo(x + bw * 0.87, y + bh);
        ctx.quadraticCurveTo(x + bw * 1.02, y + bh * 0.5, x + bw * 0.87, y + bh * 0.06);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = alpha(woodLine, 0.55);
        ctx.lineWidth = 2;
        [0.28, 0.42, 0.58, 0.72].forEach((f) => {
          const bulge = (f - 0.5) * 0.12;
          ctx.beginPath();
          ctx.moveTo(x + bw * f, y + bh * 0.06);
          ctx.quadraticCurveTo(x + bw * (f + bulge), y + bh * 0.5, x + bw * f, y + bh);
          ctx.stroke();
        });
        const hoopG = ctx.createLinearGradient(x, 0, x + bw, 0);
        hoopG.addColorStop(0, hoop[0]);
        hoopG.addColorStop(0.5, hoop[1]);
        hoopG.addColorStop(1, hoop[0]);
        [0.17, 0.86].forEach((f) => {
          ctx.beginPath();
          ctx.moveTo(x + bw * 0.06, y + bh * f);
          ctx.quadraticCurveTo(x + bw / 2, y + bh * (f + 0.035), x + bw * 0.94, y + bh * f);
          ctx.lineTo(x + bw * 0.94, y + bh * (f + 0.05));
          ctx.quadraticCurveTo(x + bw / 2, y + bh * (f + 0.085), x + bw * 0.06, y + bh * (f + 0.05));
          ctx.closePath();
          ctx.fillStyle = hoopG;
          ctx.fill();
        });
        ctx.beginPath();
        ctx.ellipse(x + bw / 2, y + bh * 0.06, bw * 0.37, bh * 0.045, 0, 0, Math.PI * 2);
        ctx.fillStyle = rim;
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + bw / 2, y + bh * 0.055, bw * 0.32, bh * 0.028, 0, 0, Math.PI * 2);
        ctx.fillStyle = holeC;
        ctx.fill();
        for (let k = 0; k < holes; k++) {
          const [hx, hy] = holeAt(k, g);
          const pop = Math.min(1, holes - k);
          ctx.beginPath();
          ctx.arc(hx, hy, bw * 0.055 * pop, 0, Math.PI * 2);
          ctx.fillStyle = holeC;
          ctx.fill();
          ctx.strokeStyle = wood[2];
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(hx, hy + 1, bw * 0.055 * pop, 0.2, Math.PI - 0.2);
          ctx.stroke();
          if (used.includes(k)) knife(hx, hy, bw * 0.055, 1);
        }
        ctx.restore();
      }

      // 꽂힌 칼: 손잡이만 밖으로 (in: 0 날아오는 중 → 1 꽂힘)
      function knife(hx, hy, hr, inK) {
        const fly = 1 - easeOut(inK);
        ctx.save();
        ctx.translate(hx + fly * 60, hy - fly * 80);
        ctx.rotate(-0.5);
        ctx.fillStyle = tk.chalk;
        ctx.beginPath();
        ctx.moveTo(-hr * 0.35, 0);
        ctx.lineTo(hr * 0.35, 0);
        ctx.lineTo(0, hr * 2.4 * fly);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = hoop[1];
        ctx.fillRect(-hr * 1.1, -hr * 0.35, hr * 2.2, hr * 0.5);
        ctx.fillStyle = tk.brand;
        ctx.fillRect(-hr * 0.35, -hr * 2.1, hr * 0.7, hr * 1.8);
        ctx.restore();
      }

      function plate(label, value, t, sub) {
        const { w, h } = env.view;
        const k = spring(t / 0.55);
        const bw = 112;
        const bx = w - 10 - bw + (1 - k) * 180;
        slant(ctx, bx, 12, bw, 22, 0);
        ctx.fillStyle = tk.chalk;
        ctx.fill();
        slant(ctx, bx, 36, bw, Math.min(84, h * 0.2), 0);
        ctx.fillStyle = tk.brand;
        ctx.fill();
        ctx.fillStyle = tk.bg;
        ctx.font = `400 13px ${tk.num}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, bx + bw / 2, 24);
        ctx.fillStyle = "#fff";
        ctx.font = `400 ${Math.round(Math.min(56, h * 0.13))}px ${tk.num}`;
        ctx.fillText(value, bx + bw / 2, 36 + Math.min(84, h * 0.2) * 0.42);
        if (sub) {
          ctx.font = `800 13px ${tk.display}`;
          ctx.fillText(sub, bx + bw / 2, 36 + Math.min(84, h * 0.2) * 0.82);
        }
      }

      // 차례판 (타이밍 타워 자리)
      function turns(active, dt, status) {
        env.tower(
          ORDER,
          ORDER.map((i, k) => status[k] || (k === active ? "NOW" : "")),
          dt,
          { title: "TURN", x: 10, y: 10, hot: active >= 0 ? ORDER[active] : -1 }
        );
      }

      function floatText(x, y, text, age) {
        if (age < 0 || age > 1) return;
        const k = spring(age / 0.35);
        ctx.save();
        ctx.globalAlpha = 1 - easeIn((age - 0.6) / 0.4);
        ctx.font = `800 18px ${tk.display}`;
        const lw = ctx.measureText(text).width + 20;
        ctx.translate(x, y - age * 40);
        ctx.scale(k, k);
        slant(ctx, -lw / 2, -15, lw, 30, 6);
        ctx.fillStyle = tk.chalk;
        ctx.fill();
        ctx.fillStyle = tk.bg;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, 0, 1);
        ctx.restore();
      }

      /* 01 구멍: 통이 튀어 올라 착지, 구멍이 하나씩 뚫리고 숫자판 */
      function scene1(t, dt) {
        env.floor();
        const g = geo();
        const land = 0.45;
        const drop = clamp01(t / land);
        const sq = t > land ? squashAmt(t - land, 0.18) : 0;
        ctx.save();
        ctx.translate(0, -(1 - drop * drop) * g.h);
        pirate(g.x + g.bw / 2, g.y + g.bh * 0.02, g.bw / 260, 0);
        const holes = Math.max(0, (t - 0.7) / 0.12);
        barrel(g, 1 + sq, 1 - sq, Math.min(8, holes));
        ctx.restore();
        // 구멍 번호
        for (let k = 0; k < Math.min(8, Math.floor(holes)); k++) {
          const [hx, hy] = holeAt(k, g);
          ctx.font = `400 12px ${tk.num}`;
          ctx.fillStyle = alpha(tk.chalk, 0.8);
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(k + 1), hx, hy + g.bw * 0.1);
        }
        if (t > 1.0) {
          turns(-1, dt, ["", "", "", ""]);
          plate("HOLES", String(Math.min(8, Math.max(1, Math.floor(holes)))), t - 1.0, "4명 × 2");
        }
      }

      /* 02 차례: 철수·민수·지은이 차례로 꽂고 모두 세이프 */
      const STABS = [
        { at: 0.5, hole: 5, k: 0 },
        { at: 1.5, hole: 2, k: 1 },
        { at: 2.5, hole: 7, k: 2 },
      ];
      function scene2(t, dt) {
        env.floor();
        const g = geo();
        let wob = 0;
        const used = [];
        STABS.forEach((s) => {
          if (t > s.at + 0.25) used.push(s.hole);
          if (t > s.at + 0.25) wob += squashAmt(t - s.at - 0.25, 0.06);
        });
        pirate(g.x + g.bw / 2, g.y + g.bh * 0.02, g.bw / 260, 0);
        ctx.save();
        const pivotX = g.x + g.bw / 2;
        const pivotY = g.y + g.bh;
        ctx.translate(pivotX, pivotY);
        ctx.rotate(wob * 0.5);
        ctx.translate(-pivotX, -pivotY);
        barrel(g, 1 + wob, 1 - wob, 8, used);
        STABS.forEach((s) => {
          const k = clamp01((t - s.at) / 0.25);
          if (k > 0 && k < 1) {
            const [hx, hy] = holeAt(s.hole, g);
            knife(hx, hy, g.bw * 0.055, k);
          }
        });
        ctx.restore();
        STABS.forEach((s) => {
          const [hx, hy] = holeAt(s.hole, g);
          floatText(hx, hy - 30, ["세이프!", "휴~ 통과", "세이프!"][s.k], t - s.at - 0.3);
        });
        const active = Math.min(3, STABS.filter((s) => t > s.at + 0.35).length);
        const status = ORDER.map((_, k) => (k < active ? "SAFE" : ""));
        turns(active, dt, status);
        plate("LEFT", String(8 - used.length), 0.6, "남은 구멍");
      }

      /* 03 판정: 지은 차례에 해적이 튐 */
      function scene3(t, dt) {
        env.floor();
        const g = geo();
        const used = [5, 2, 7];
        const stabAt = 0.55;
        const popAt = stabAt + 0.45;
        if (t > stabAt + 0.25) used.push(0);
        // 예비동작: 통이 눌렸다가 → 해적 발사
        const pre = t > stabAt + 0.25 && t < popAt ? (t - stabAt - 0.25) / (popAt - stabAt - 0.25) : 0;
        const after = t > popAt ? squashAmt(t - popAt, 0.22) : 0;
        const pY = g.y + g.bh * 0.02;
        if (t < popAt) {
          pirate(g.x + g.bw / 2, pY + pre * 10, g.bw / 260, 0);
        }
        ctx.save();
        const shake = t > popAt && t < popAt + 0.3 ? Math.sin(t * 90) * 4 * (1 - (t - popAt) / 0.3) : 0;
        ctx.translate(shake, 0);
        barrel(g, 1 + pre * 0.06 - after, 1 - pre * 0.1 + after, 8, used);
        const k = clamp01((t - stabAt) / 0.25);
        if (k > 0 && k < 1) {
          const [hx, hy] = holeAt(0, g);
          knife(hx, hy, g.bw * 0.055, k);
        }
        ctx.restore();
        if (t >= popAt) {
          const a = t - popAt;
          const up = a < 0.5 ? easeOut(a / 0.5) : 1 - Math.sin(Math.min(1, (a - 0.5) / 0.6) * Math.PI) * 0.12;
          const px = g.x + g.bw / 2;
          const py = pY - up * g.bh * 0.55;
          // 폭죽 조각
          for (let q = 0; q < 14; q++) {
            const ang = (q / 14) * Math.PI * 2;
            const d = easeOut(a / 0.8) * (60 + (q % 3) * 26);
            ctx.globalAlpha = clamp01(1 - a / 0.9);
            ctx.fillStyle = q % 3 ? tk.brand : tk.chalk;
            ctx.save();
            ctx.translate(px + Math.cos(ang) * d, pY + Math.sin(ang) * d);
            ctx.rotate(ang);
            ctx.fillRect(-5, -2, 10, 4);
            ctx.restore();
          }
          ctx.globalAlpha = 1;
          pirate(px, py, (g.bw / 260) * (1.1 + squashAmt(a, 0.2)), -Math.min(1, a / 0.55) * Math.PI * 4);
        }
        const status = ["SAFE", "SAFE", t > popAt ? "POP!" : "NOW", ""];
        turns(2, dt, status);
        if (t < popAt) plate("ODDS", "25%", 0.6, "1인당 확률");
        drawVerdict(ctx, env.view.w, g.y + g.bh * 0.55, "지은이 쏩니다 ☕", t - popAt - 0.6, tk);
      }

      return [scene1, scene2, scene3];
    },
  });
}
