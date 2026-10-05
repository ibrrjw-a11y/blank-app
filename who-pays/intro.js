// 구슬 레이스 첫 화면: 01 엔트리(이름 → 구슬 → 스타팅 그리드) · 02 출발 신호 + 레이스 · 03 바나나 개입 · 04 시상대 + 판정
import { CANVAS_FONT } from "../shared/kit.js";
import { alpha, spring, squashAmt, slant, drawMarble, drawVerdict } from "./common.js";
import { runBroadcast, clamp01, easeOut, easeIn, DEMO_NAMES as NAMES, DEMO_COLORS as COLORS } from "./broadcast.js";

const SCENES = [
  { tag: "01 엔트리", lines: ["이름 넣으면", "구슬로 출전"], desc: "2~12명. 이름 첫 글자가 구슬에 찍혀요.", dur: 3000 },
  { tag: "02 레이스", lines: ["코스는", "판마다 새로"], desc: "핀·범퍼·회전 패들. 결승선 전까지 순위는 몰라요.", dur: 3400 },
  { tag: "03 개입", lines: ["바나나 한 방에", "1등이 꼴찌로"], desc: "자기 이름 버튼을 누르면 아이템 발동. 1인 1회.", dur: 3600 },
  { tag: "04 판정", lines: ["꼴찌가", "쏜다"], desc: "결과는 벌칙 장부에 적히고 영상도 저장돼요.", dur: 4000 },
];

export function startIntro(root) {
  return runBroadcast(root, {
    scenes: SCENES,
    staticT: [2.9, 2.6, 3.0, 3.6],
    draw(env) {
      const { ctx, tk } = env;
      const floorTexture = env.floor;
      const marbleAt = env.marbleAt;
      const tower = env.tower;

    /* ---------- 01 엔트리: 이름표 → 구슬 → 스타팅 그리드 ---------- */
    function scene1(t, dt) {
      const { w, h } = env.view;
      floorTexture();
      const r = Math.min(26, w * 0.07);
      const colX = (i) => w * (0.14 + i * 0.24);
      const boxY = (i) => h * (0.6 + (i % 2) * 0.12);
      // 스타팅 그리드 칸 (F1 처럼 엇갈림)
      ctx.lineWidth = 3;
      NAMES.forEach((_, i) => {
        const x = colX(i);
        const y = boxY(i);
        const bw = w * 0.2;
        const p = spring((t - 0.05 - i * 0.06) / 0.5);
        ctx.strokeStyle = alpha(tk.chalk, 0.75);
        ctx.beginPath();
        ctx.moveTo(x - bw / 2, y + r + 10 + (1 - p) * 30);
        ctx.lineTo(x - bw / 2, y - r - 8);
        ctx.lineTo(x + bw / 2, y - r - 8);
        ctx.lineTo(x + bw / 2, y + r + 10 + (1 - p) * 30);
        ctx.stroke();
        ctx.fillStyle = alpha(tk.chalk, 0.5);
        ctx.font = `400 ${Math.round(r * 0.9)}px ${tk.num}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`P${i + 1}`, x, y + r + 34);
      });
      // 출발선
      const lineY = h * 0.52;
      for (let x = 0, k = 0; x < w; x += 14, k++) {
        ctx.fillStyle = k % 2 ? tk.chalk : tk.bg;
        ctx.fillRect(x, lineY, 14, 7);
      }
  
      // 이름표 (위쪽 절반)
      const plateH = Math.min(46, h * 0.095);
      const plateW = w * 0.62;
      NAMES.forEach((nm, i) => {
        const enter = 0.08 + i * 0.13;
        const tt = t - enter;
        if (tt < 0) return;
        const plateY = h * 0.04 + i * (plateH + 8);
        const targetX = 18 + (i % 2) * 22;
        const px = -plateW + (targetX + plateW) * spring(tt / 0.5);
        const typed = Array.from(nm).slice(0, Math.floor(tt / 0.09) + 1).join("");
        const m0 = 1.15 + i * 0.1;
        const tx = colX(i);
        const ty = boxY(i);
        if (t < m0 + 0.14) {
          const ant = clamp01((t - (m0 - 0.12)) / 0.12);
          const collapse = clamp01((t - m0) / 0.14);
          const pw = plateW * (1 + ant * 0.06) * (1 - collapse) + r * 2 * collapse;
          slant(ctx, px, plateY, pw, plateH, 8 * (1 - collapse));
          ctx.fillStyle = "rgba(6,7,9,0.95)";
          ctx.fill();
          ctx.fillStyle = COLORS[i];
          ctx.fillRect(px - 4, plateY, 7, plateH);
          ctx.globalAlpha = 1 - collapse;
          ctx.fillStyle = tk.chalk;
          ctx.font = `400 ${Math.round(plateH * 0.42)}px ${tk.num}`;
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(`P${i + 1}`, px + 16, plateY + plateH / 2 + 1);
          ctx.font = `700 ${Math.round(plateH * 0.5)}px ${CANVAS_FONT}`;
          ctx.fillText(typed, px + 16 + plateH * 1.1, plateY + plateH / 2 + 1);
          ctx.globalAlpha = 1;
        } else {
          const ft = t - (m0 + 0.14);
          const T = 0.42;
          const fp = clamp01(ft / T);
          const sx0 = px + r;
          const x = sx0 + (tx - sx0) * easeOut(fp);
          const y0 = plateY + plateH / 2;
          const y = y0 + (ty - y0) * fp * fp;
          if (fp < 1) {
            const st = Math.min(0.3, fp * 0.4);
            drawMarble(ctx, x, y, r, COLORS[i], nm[0], 0, tk, 1 - st * 0.6, 1 + st);
          } else marbleAt(tx, ty, r, i, ft - T);
        }
      });
  
      // 그리드 확정 → 위쪽 절반: 타이밍 타워 + 큰 숫자
      if (t > 1.75) {
        tower([0, 1, 2, 3], ["GRID", "GRID", "GRID", "GRID"], dt, { title: "GRID", x: 10, y: 10 });
        const k = spring((t - 1.85) / 0.55);
        const bx = w - 10 - 128 + (1 - k) * 200;
        ctx.save();
        slant(ctx, bx, 12, 128, h * 0.3, 0);
        ctx.fillStyle = tk.brand;
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = `400 ${Math.round(h * 0.2)}px ${tk.num}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("4", bx + 64, 12 + h * 0.13);
        ctx.font = `800 17px ${tk.display}`;
        ctx.fillText("명 출전 확정", bx + 64, 12 + h * 0.255);
        ctx.restore();
      }
    }
  
    /* ---------- 02 출발 신호 + 레이스 (줌 인 카메라) ---------- */
    function course(w) {
      const pts = [];
      let y = 0;
      for (let k = 0; k < 9; k++) {
        const left = k % 2 === 0;
        pts.push([left ? w * 0.1 : w * 0.9, y], [left ? w * 0.86 : w * 0.14, y + 64]);
        y += 64 + 74;
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
    function lights(t, x0, y0, go) {
      ctx.fillStyle = "#000";
      ctx.fillRect(x0, y0, 128, 46);
      for (let k = 0; k < 3; k++) {
        const on = t > 0.2 + k * 0.33 && t < go;
        const cx = x0 + 23 + k * 41;
        ctx.beginPath();
        ctx.arc(cx, y0 + 23, 15, 0, Math.PI * 2);
        ctx.fillStyle = on ? tk.brand : "rgba(255,255,255,0.1)";
        ctx.fill();
      }
    }
    function scene2(t, dt) {
      const { w, h } = env.view;
      floorTexture();
      const pts = course(w);
      const r = Math.max(20, Math.min(24, w * 0.06));
      const go = 1.3;
      const rt = Math.max(0, t - go);
      const prog = NAMES.map((_, i) => 140 - i * (r * 2.1) + 300 * rt + (rt > 0 ? 40 * Math.sin(rt * 2.6 + i * 2.1) * Math.min(1, rt) : 0));
      const pos = prog.map((s) => along(pts, Math.max(0, s)));
      const meanY = pos.reduce((a, p) => a + p[1], 0) / pos.length;
      const camY = Math.max(-h * 0.42, meanY - h * 0.5);
      ctx.save();
      ctx.translate(0, -camY);
      // 벽
      ctx.fillStyle = tk.brand;
      ctx.fillRect(0, camY, 5, h);
      ctx.fillRect(w - 5, camY, 5, h);
      // 경사로 + 사이 공간의 핀·범퍼
      for (let k = 0; k < pts.length; k += 2) {
        const [ax, ay] = pts[k];
        const [bx, by] = pts[k + 1];
        const off = r + 7;
        ctx.lineCap = "round";
        ctx.strokeStyle = tk.line;
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.moveTo(ax, ay + off);
        ctx.lineTo(bx, by + off);
        ctx.stroke();
        ctx.strokeStyle = tk.chalk;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ax, ay + off - 5);
        ctx.lineTo(bx, by + off - 5);
        ctx.stroke();
        // 낙하 구간 아래 범퍼, 반대편에 핀
        const left = (k / 2) % 2 === 0;
        ctx.beginPath();
        ctx.arc(left ? w * 0.3 : w * 0.7, by + 64, 15, 0, Math.PI * 2);
        ctx.fillStyle = tk.bg;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = tk.chalk;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(left ? w * 0.3 : w * 0.7, by + 64, 6, 0, Math.PI * 2);
        ctx.fillStyle = tk.brand;
        ctx.fill();
        ctx.fillStyle = alpha(tk.chalk, 0.7);
        for (let q = 0; q < 3; q++) {
          ctx.beginPath();
          ctx.arc((left ? w * 0.5 : w * 0.5) + (q - 1) * 34, by + 96 + (q % 2) * 10, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        // 거리 표시
        const label = `${Math.max(0, 300 - k * 22)}M`;
        ctx.font = `400 12px ${tk.num}`;
        const lw = ctx.measureText(label).width + 12;
        ctx.fillStyle = tk.chalk;
        ctx.fillRect(left ? w - lw - 10 : 10, ay - 4, lw, 17);
        ctx.fillStyle = tk.bg;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, (left ? w - lw - 10 : 10) + lw / 2, ay + 5);
      }
      // 출발 게이트
      if (t < go + 0.15) {
        ctx.setLineDash([10, 10]);
        ctx.strokeStyle = tk.chalk;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(along(pts, 160)[0], -r * 2.5);
        ctx.lineTo(along(pts, 160)[0], along(pts, 160)[1] + r);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // 스피드 라인 + 구슬
      NAMES.forEach((_, i) => {
        if (rt <= 0) return;
        const [x0, y0] = along(pts, Math.max(0, prog[i] - 70));
        const [x1, y1] = pos[i];
        ctx.strokeStyle = alpha(COLORS[i], 0.4);
        ctx.lineWidth = r * 1.2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      });
      NAMES.forEach((nm, i) => drawMarble(ctx, pos[i][0], pos[i][1], r, COLORS[i], nm[0], prog[i] / r, tk));
      ctx.restore();
  
      const order = NAMES.map((_, i) => i).sort((a, b) => prog[b] - prog[a]);
      const gaps = order.map((i, k) => (k === 0 ? "LEAD" : `+${((prog[order[0]] - prog[i]) / 300).toFixed(2)}`));
      tower(order, gaps, dt, { hot: rt > 0 ? order[3] : -1, x: 10, y: h - 10 - 22 - 4 * 27 });
      if (t < go + 0.5) {
        ctx.globalAlpha = 1 - clamp01((t - go) / 0.4);
        lights(t, w - 138, 10, go);
        ctx.globalAlpha = 1;
      }
      if (t > go && t < go + 0.8) {
        const k = (t - go) / 0.8;
        ctx.save();
        ctx.translate(w / 2, h * 0.42);
        const sc = spring(k * 1.6);
        ctx.scale(sc, sc);
        ctx.globalAlpha = 1 - easeIn(k);
        ctx.font = `400 88px ${tk.num}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 8;
        ctx.strokeStyle = tk.bg;
        ctx.strokeText("GO!", 0, 0);
        ctx.fillStyle = "#fff";
        ctx.fillText("GO!", 0, 0);
        ctx.restore();
      }
    }
  
    /* ---------- 03 바나나 개입 ---------- */
    function scene3(t, dt) {
      const { w, h } = env.view;
      floorTexture();
      const r = Math.min(24, w * 0.065);
      const laneL = 6;
      const laneR = w - 6;
      ctx.fillStyle = tk.brand;
      ctx.fillRect(0, 0, 5, h);
      ctx.fillRect(w - 5, 0, 5, h);
      // 흐르는 노면 표시 (아래로 달리는 느낌)
      const off = (t * 340) % 56;
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      for (let y = -off; y < h; y += 56) ctx.fillRect(laneL, y, laneR - laneL, 2);
      ctx.fillStyle = "rgba(255,255,255,0.09)";
      for (let y = -off * 2; y < h; y += 56) ctx.fillRect(w / 2 - 2, y, 4, 28);
  
      const hitT = 1.35;
      const slip = clamp01((t - hitT) / 1.1);
      const base = [h * 0.6, h * 0.46, h * 0.36, h * 0.27];
      const ys = base.map((y, i) => y + Math.sin(t * 3 + i) * 5);
      ys[1] += easeOut((t - hitT - 0.15) / 0.9) * h * 0.17;
      ys[2] += easeOut((t - hitT - 0.3) / 0.9) * h * 0.17;
      ys[3] += easeOut((t - hitT - 0.45) / 0.9) * h * 0.13;
      ys[0] -= easeOut(slip) * h * 0.37;
      const xs = [w * 0.5, w * 0.74, w * 0.42, w * 0.2];
      xs[0] += Math.sin(slip * 10) * 22 * (1 - slip);
      NAMES.forEach((nm, i) => {
        // 꼬리
        ctx.strokeStyle = alpha(COLORS[i], 0.35);
        ctx.lineWidth = r * 1.2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(xs[i], ys[i] - r * 2.6);
        ctx.lineTo(xs[i], ys[i]);
        ctx.stroke();
        drawMarble(ctx, xs[i], ys[i], r, COLORS[i], nm[0], i === 0 ? slip * 16 : 0, tk);
        ctx.font = `700 13px ${CANVAS_FONT}`;
        const lw = ctx.measureText(nm).width + 12;
        ctx.fillStyle = i === 0 && t > hitT ? tk.brand : "rgba(8,9,12,0.8)";
        ctx.fillRect(xs[i] - lw / 2, ys[i] - r - 24, lw, 18);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#fff";
        ctx.fillText(nm, xs[i], ys[i] - r - 14.5);
      });
  
      // 아이템 버튼 (실제 트레이와 같은 모양)
      const bw = Math.min(220, w * 0.62);
      const bx = w / 2 - bw / 2;
      const bh = 52;
      const by = h - bh - 14;
      const pressK = t > 0.65 && t < 0.85 ? 1 : 0;
      const used = t >= 0.8;
      const relax = used ? squashAmt(t - 0.85, 0.12) : 0;
      ctx.save();
      ctx.translate(bx + bw / 2, by + bh / 2);
      ctx.scale(1 - pressK * 0.06 + relax, 1 - pressK * 0.14 - relax);
      slant(ctx, -bw / 2, -bh / 2, bw, bh, 8);
      ctx.fillStyle = used ? tk.raised : "rgba(6,7,9,0.96)";
      ctx.fill();
      ctx.fillStyle = COLORS[1];
      ctx.fillRect(-bw / 2 - 5, -bh / 2, 8, bh);
      ctx.font = `700 17px ${CANVAS_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = used ? tk.text3 : tk.chalk;
      ctx.fillText(used ? "영희 · 사용함" : "🍌 영희 · 바나나", 4, 1);
      ctx.restore();
      // 손가락 탭
      if (t > 0.2 && t < 1.2) {
        const k = clamp01((t - 0.2) / 0.45);
        const fx = bx + bw * 0.74;
        const fy = by + bh + 26 - spring(k) * 30;
        if (t > 0.7) {
          const rk = clamp01((t - 0.7) / 0.4);
          ctx.beginPath();
          ctx.arc(bx + bw * 0.68, by + bh / 2, 10 + rk * 40, 0, Math.PI * 2);
          ctx.strokeStyle = alpha(tk.brand, 1 - rk);
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        ctx.font = `34px ${CANVAS_FONT}`;
        ctx.fillText("👆", fx, fy);
      }
      // 날아가는 바나나
      if (t > 0.82 && t < hitT) {
        const k = (t - 0.82) / (hitT - 0.82);
        const sx = bx + bw / 2;
        const sy = by;
        const x = sx + (xs[0] - sx) * k;
        const y = sy + (ys[0] - sy) * k - Math.sin(k * Math.PI) * 100;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(k * 14);
        ctx.font = `34px ${CANVAS_FONT}`;
        ctx.fillText("🍌", 0, 0);
        ctx.restore();
      }
      if (t >= hitT) {
        const k = clamp01((t - hitT) / 0.45);
        ctx.beginPath();
        ctx.arc(xs[0], ys[0], r + k * 50, 0, Math.PI * 2);
        ctx.strokeStyle = alpha(tk.warning, 1 - k);
        ctx.lineWidth = 5;
        ctx.stroke();
      }
      const order = [0, 1, 2, 3].sort((a, b) => ys[b] - ys[a]);
      const gaps = order.map((i, k) => (k === 0 ? "LEAD" : `+${((ys[order[0]] - ys[i]) / 300).toFixed(2)}`));
      tower(order, gaps, dt, { hot: t > hitT ? 0 : -1, x: w - 132, y: 10, scale: 1.05, wdt: 122 });
  
      // 로어서드: 개입 성공
      if (t > 2.0) {
        const k = (t - 2.0) / 0.5;
        const x = -w + (w + 14) * spring(k);
        const y = by - 52;
        slant(ctx, x, y, 58, 34, 7);
        ctx.fillStyle = tk.brand;
        ctx.fill();
        slant(ctx, x + 60, y, 196, 34, 7);
        ctx.fillStyle = tk.chalk;
        ctx.fill();
        ctx.font = `800 16px ${tk.display}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#fff";
        ctx.fillText("개입", x + 29, y + 18);
        ctx.fillStyle = tk.bg;
        ctx.font = `800 15px ${CANVAS_FONT}`;
        ctx.textAlign = "left";
        ctx.fillText("민수 P1 → P4 미끄덩!", x + 78, y + 18);
      }
    }
  
    /* ---------- 04 시상대 + 판정 ---------- */
    function scene4(t, dt) {
      const { w, h } = env.view;
      floorTexture();
      const r = Math.min(24, w * 0.065);
      const order = [1, 2, 3, 0]; // 영희, 철수, 지은, 민수(꼴찌)
      const heights = [0.34, 0.27, 0.2, 0.12];
      const colW = (w - 28) / 4;
      const baseY = h - 8;
      // 결승선 띠
      const fy = h * 0.47;
      const sq = 12;
      for (let x = 0, k = 0; x < w; x += sq, k++) {
        ctx.fillStyle = k % 2 ? tk.chalk : tk.bg;
        ctx.fillRect(x, fy - sq, sq, sq);
        ctx.fillStyle = k % 2 ? tk.bg : tk.chalk;
        ctx.fillRect(x, fy, sq, sq);
      }
      // 시상대
      order.forEach((i, k) => {
        const x = 14 + k * colW;
        const rise = spring((t - k * 0.08) / 0.55);
        const bh = h * heights[k] * rise;
        const top = baseY - bh;
        const loser = k === 3;
        ctx.fillStyle = loser ? tk.brand : tk.chalk;
        ctx.fillRect(x + 3, top, colW - 6, bh);
        ctx.fillStyle = COLORS[i];
        ctx.fillRect(x + 3, top, colW - 6, 6);
        ctx.fillStyle = loser ? "#fff" : tk.bg;
        ctx.font = `400 ${Math.round(Math.min(46, h * 0.1))}px ${tk.num}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        if (bh > 40) ctx.fillText(loser ? "4" : String(k + 1), x + colW / 2, top + Math.min(bh * 0.42, 40));
        if (bh > 60) {
          ctx.font = `800 15px ${tk.display}`;
          ctx.fillText(loser ? "꼴찌" : NAMES[i], x + colW / 2, top + Math.min(bh * 0.42, 40) + 32);
        }
        // 구슬 낙하 → 시상대 위 착지
        const arrive = 0.35 + k * 0.2 + (loser ? 0.2 : 0);
        const fall = 0.4;
        const p = clamp01((t - (arrive - fall)) / fall);
        if (p > 0) {
          const endY = baseY - h * heights[k] - r - 2;
          const y = -r + (endY + r) * p * p;
          if (p < 1) drawMarble(ctx, x + colW / 2, y, r, COLORS[i], NAMES[i][0], 0, tk, 0.85, 1.2);
          else marbleAt(x + colW / 2, endY, r, i, t - arrive);
        }
      });
  
      tower(order, ["LEAD", "+0.31", "+0.58", "+1.94"], dt, { hot: t > 1.15 ? 0 : -1, title: "FINAL", x: 10, y: 10 });
      // 오른쪽 위: 규칙 + 벌칙 판
      const k = spring((t - 0.2) / 0.5);
      const px = w - 10 - 150 + (1 - k) * 220;
      slant(ctx, px, 12, 150, 30, 0);
      ctx.fillStyle = tk.chalk;
      ctx.fill();
      slant(ctx, px, 46, 150, 66, 0);
      ctx.fillStyle = "rgba(6,7,9,0.95)";
      ctx.fill();
      ctx.font = `800 15px ${tk.display}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = tk.bg;
      ctx.fillText("RULE · 꼴찌가 당첨", px + 10, 28);
      ctx.fillStyle = "#fff";
      ctx.font = `800 22px ${tk.display}`;
      ctx.fillText("벌칙 ☕", px + 10, 68);
      ctx.font = `700 14px ${CANVAS_FONT}`;
      ctx.fillStyle = tk.text2;
      ctx.fillText("커피 쏘기", px + 10, 96);
  
      // 판정 판: 1.25초에 예비동작 → 쾅 → 끝까지 유지
      drawVerdict(ctx, w, h * 0.4, "민수가 쏩니다 ☕", t - 1.25, tk);
    }
  
      return [scene1, scene2, scene3, scene4];
    },
  });
}
