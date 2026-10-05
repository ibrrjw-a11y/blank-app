// 첫 화면: "생중계" 형식으로 실제 기능을 보여 주는 모션그래픽
// 01 엔트리(이름 → 구슬) · 02 출발 신호 + 레이스(타이밍 타워) · 03 바나나 개입(순위 역전) · 04 판정 도장
import { prefersReducedMotion, CANVAS_FONT } from "../shared/kit.js";
import { PALETTE, readTokens, drawMarble, alpha, fitCanvas, spring, squashAmt, slant, escapeHtml } from "./common.js";

const NAMES = ["민수", "영희", "철수", "지은"];
const COLORS = [PALETTE[0], PALETTE[1], PALETTE[2], PALETTE[3]];
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 3);
const easeIn = (t) => Math.pow(clamp01(t), 3);

const SCENES = [
  { tag: "01 엔트리", lines: ["이름 넣으면", "구슬로 출전"], hot: 1, desc: "같이 내기할 사람 2~12명. 이름이 그대로 구슬이 돼요.", dur: 3300 },
  { tag: "02 레이스", lines: ["코스는", "판마다 새로"], hot: 1, desc: "핀·범퍼·회전 패들. 결승선 전까지 순위는 몰라요.", dur: 3900 },
  { tag: "03 개입", lines: ["바나나 한 방에", "1등이 꼴찌로"], hot: 1, desc: "구경만 하지 말고 아이템을 눌러요. 한 사람당 딱 1개.", dur: 3900 },
  { tag: "04 판정", lines: ["꼴찌가", "쏜다"], hot: 1, desc: "결과는 우리 장부에 남고, 레이스 영상도 저장돼요.", dur: 3600 },
];

export function startIntro(root) {
  const stage = root.querySelector(".intro__stage");
  stage.innerHTML = '<canvas class="intro__canvas"></canvas>';
  const canvas = stage.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const headEl = root.querySelector(".kinetic");
  const descEl = root.querySelector(".intro__desc");
  const stepsEl = root.querySelector(".bc-steps");
  const clockEl = root.querySelector(".odo");
  const tk = readTokens();
  const reduced = prefersReducedMotion();
  let view = fitCanvas(canvas);
  const ro = new ResizeObserver(() => {
    view = fitCanvas(canvas);
    if (reduced) paint(staticT[scene]);
  });
  ro.observe(stage);

  let scene = 0;
  let t0 = performance.now();
  let raf = 0;
  let timer = 0;
  let alive = true;
  let tower = null; // 타이밍 타워 행 위치 (스프링)

  /* ---------- 공용 그리기 ---------- */
  function floorTexture() {
    const { w, h } = view;
    ctx.fillStyle = tk.asphalt;
    ctx.fillRect(0, 0, w, h);
    // 스캔라인 질감
    ctx.fillStyle = "rgba(255,255,255,0.025)";
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
  }

  function marbleAt(x, y, r, i, land = -1, rot = 0) {
    const a = land >= 0 ? squashAmt(land) : 0;
    // 그림자
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.95, r * (0.9 + a), r * 0.22, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fill();
    drawMarble(ctx, x, y + r * a * 0.9, r, COLORS[i], NAMES[i][0], rot, tk, 1 + a, 1 - a);
  }

  // F1 타이밍 타워. order: 순위대로 선수 인덱스, gaps: 표시할 간격 문자열
  function drawTower(order, gaps, dt, { x = 10, y = 12, hot = -1, title = "LIVE" } = {}) {
    if (!tower) tower = NAMES.map((_, i) => ({ p: order.indexOf(i), v: 0 }));
    const rowH = 24;
    const wdt = 128;
    // 헤더
    slant(ctx, x, y, wdt, 18, 0);
    ctx.fillStyle = tk.brand;
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `400 11px ${tk.num}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(title, x + 8, y + 9.5);
    ctx.textAlign = "right";
    ctx.fillText("GAP", x + wdt - 8, y + 9.5);
    order.forEach((i, k) => {
      const row = tower[i];
      // 스프링 적분 (빠르게 미끄러져 살짝 넘침)
      const f = (k - row.p) * 260 - row.v * 18;
      row.v += f * dt;
      row.p += row.v * dt;
      const ry = y + 20 + row.p * (rowH + 2);
      ctx.fillStyle = i === hot ? alpha(tk.brand, 0.95) : "rgba(10,12,16,0.86)";
      ctx.fillRect(x, ry, wdt, rowH);
      ctx.fillStyle = tk.chalk;
      ctx.fillRect(x, ry, 20, rowH);
      ctx.fillStyle = tk.bg;
      ctx.font = `400 13px ${tk.num}`;
      ctx.textAlign = "center";
      ctx.fillText(String(k + 1), x + 10, ry + rowH / 2 + 1);
      ctx.fillStyle = COLORS[i];
      ctx.fillRect(x + 22, ry + 4, 3, rowH - 8);
      ctx.fillStyle = "#fff";
      ctx.font = `700 12px ${CANVAS_FONT}`;
      ctx.textAlign = "left";
      ctx.fillText(NAMES[i], x + 31, ry + rowH / 2 + 1);
      ctx.textAlign = "right";
      ctx.font = `400 11px ${tk.num}`;
      ctx.fillStyle = i === hot ? "#fff" : tk.text2;
      ctx.fillText(gaps[k], x + wdt - 6, ry + rowH / 2 + 1);
    });
  }

  // 장면 전환 스팅어: 사선 띠가 화면을 훑고 지나감
  function stinger(t) {
    const { w, h } = view;
    const p = t / 0.5;
    if (p >= 1) return;
    const x = -w * 0.6 + easeIn(p) * w * 2.4;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + w * 0.55, 0);
    ctx.lineTo(x + w * 0.55 - h * 0.35, h);
    ctx.lineTo(x - h * 0.35, h);
    ctx.closePath();
    ctx.fillStyle = tk.brand;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    for (let k = -h; k < w * 2; k += 22) {
      ctx.beginPath();
      ctx.moveTo(x + k, 0);
      ctx.lineTo(x + k + 10, 0);
      ctx.lineTo(x + k + 10 - h * 0.35, h);
      ctx.lineTo(x + k - h * 0.35, h);
      ctx.fill();
    }
    ctx.fillStyle = "#fff";
    ctx.font = `800 34px ${tk.display}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(SCENES[scene].tag, x + 18 - h * 0.17, h / 2);
    ctx.restore();
  }

  /* ---------- 01 엔트리: 이름표 → 구슬 ---------- */
  function scene1(t) {
    const { w, h } = view;
    floorTexture();
    const gateY = h * 0.82;
    // 출발 게이트
    ctx.fillStyle = tk.chalk;
    for (let x = 0, k = 0; x < w; x += 14, k++) {
      ctx.fillStyle = k % 2 ? tk.chalk : tk.bg;
      ctx.fillRect(x, gateY, 14, 8);
    }
    ctx.fillStyle = tk.text3;
    ctx.font = `400 12px ${tk.num}`;
    ctx.textAlign = "left";
    ctx.fillText("START GRID", 14, gateY + 26);

    NAMES.forEach((nm, i) => {
      const enter = 0.45 + i * 0.16;
      const tt = t - enter;
      if (tt < 0) return;
      const plateY = h * 0.14 + i * 46;
      const plateW = 150;
      const targetX = 22 + (i % 2) * 18;
      const px = -plateW + (targetX + plateW) * spring(tt / 0.55);
      const typed = Array.from(nm).slice(0, Math.floor(tt / 0.1) + 1).join("");
      const m0 = 1.75 + i * 0.09; // 구슬로 변신 시작
      const r = 17;
      const tx = w * (0.2 + i * 0.2);
      if (t < m0 + 0.14) {
        // 예비동작: 판이 살짝 늘어났다가
        const ant = clamp01((t - (m0 - 0.12)) / 0.12);
        const sx = 1 + ant * 0.08;
        const collapse = clamp01((t - m0) / 0.14);
        const pw = (plateW * sx) * (1 - collapse) + r * 2 * collapse;
        slant(ctx, px, plateY, pw, 36, 7 * (1 - collapse));
        ctx.fillStyle = "rgba(10,12,16,0.92)";
        ctx.fill();
        ctx.fillStyle = COLORS[i];
        ctx.fillRect(px - 4, plateY, 6, 36);
        ctx.globalAlpha = 1 - collapse;
        ctx.fillStyle = tk.chalk;
        ctx.font = `400 13px ${tk.num}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(`P${i + 1}`, px + 12, plateY + 19);
        ctx.font = `700 17px ${CANVAS_FONT}`;
        ctx.fillText(typed, px + 44, plateY + 19);
        ctx.globalAlpha = 1;
      } else {
        // 떨어져서 게이트 위에 착지 (스트레치 → 스쿼시)
        const ft = t - (m0 + 0.14);
        const T = 0.5;
        const fallP = clamp01(ft / T);
        const sx0 = px + r;
        const x = sx0 + (tx - sx0) * easeOut(fallP);
        const y0 = plateY + 18;
        const y1 = gateY - r;
        const y = y0 + (y1 - y0) * fallP * fallP;
        if (fallP < 1) {
          const stretch = Math.min(0.28, fallP * 0.35);
          drawMarble(ctx, x, y, r, COLORS[i], nm[0], 0, tk, 1 - stretch * 0.6, 1 + stretch);
        } else {
          marbleAt(tx, y1, r, i, ft - T);
        }
      }
    });
    // 출전 확정 판
    if (t > 2.45) {
      const k = spring((t - 2.45) / 0.55);
      const x = -260 + 282 * k;
      const y = h * 0.34;
      slant(ctx, x, y, 92, 64, 10);
      ctx.fillStyle = tk.brand;
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `400 40px ${tk.num}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("4", x + 46, y + 34);
      slant(ctx, x + 96, y + 8, 150, 48, 8);
      ctx.fillStyle = tk.chalk;
      ctx.fill();
      ctx.fillStyle = tk.bg;
      ctx.font = `800 20px ${tk.display}`;
      ctx.textAlign = "left";
      ctx.fillText("명 출전 확정", x + 112, y + 33);
    }
  }

  /* ---------- 02 출발 신호 + 레이스 ---------- */
  function zigPath(w) {
    const pts = [];
    let y = 0;
    for (let k = 0; k < 8; k++) {
      const left = k % 2 === 0;
      pts.push([left ? w * 0.12 : w * 0.88, y], [left ? w * 0.8 : w * 0.2, y + 60]);
      y += 60 + 52;
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
  function lights(t, cx, y) {
    // F1 출발 신호: 3개 켜지고 → 모두 꺼지면 출발
    for (let k = 0; k < 3; k++) {
      const on = t > 0.55 + k * 0.32 && t < 1.6;
      const x = cx + (k - 1) * 34;
      ctx.fillStyle = "#000";
      ctx.fillRect(x - 14, y - 14, 28, 28);
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fillStyle = on ? tk.brand : "rgba(255,255,255,0.08)";
      ctx.fill();
    }
  }
  function scene2(t, dt) {
    const { w, h } = view;
    floorTexture();
    const pts = zigPath(w);
    const r = 12;
    const go = 1.6;
    const rt = Math.max(0, t - go);
    const prog = NAMES.map((_, i) => 40 - i * 22 + 260 * rt + (rt > 0 ? 34 * Math.sin(rt * 2.6 + i * 2.1) * Math.min(1, rt) : 0));
    const pos = prog.map((s) => along(pts, Math.max(0, s)));
    const meanY = pos.reduce((a, p) => a + p[1], 0) / pos.length;
    const camY = Math.max(-h * 0.35, meanY - h * 0.5);
    ctx.save();
    ctx.translate(0, -camY);
    ctx.lineCap = "butt";
    for (let k = 0; k < pts.length; k += 2) {
      const [ax, ay] = pts[k];
      const [bx, by] = pts[k + 1];
      ctx.strokeStyle = tk.line;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(ax, ay + r + 4);
      ctx.lineTo(bx, by + r + 4);
      ctx.stroke();
      // 경사로 모서리 하이라이트 (포인트 색 한 줄)
      ctx.strokeStyle = tk.brand;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ax, ay + r + 1);
      ctx.lineTo(bx, by + r + 1);
      ctx.stroke();
    }
    // 스피드 라인
    NAMES.forEach((_, i) => {
      if (rt <= 0) return;
      const [x0, y0] = along(pts, Math.max(0, prog[i] - 46));
      const [x1, y1] = pos[i];
      ctx.strokeStyle = alpha(COLORS[i], 0.45);
      ctx.lineWidth = r * 1.1;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    });
    NAMES.forEach((nm, i) => drawMarble(ctx, pos[i][0], pos[i][1], r, COLORS[i], nm[0], prog[i] / r, tk));
    ctx.restore();

    const order = NAMES.map((_, i) => i).sort((a, b) => prog[b] - prog[a]);
    const gaps = order.map((i, k) => (k === 0 ? "LEAD" : `+${((prog[order[0]] - prog[i]) / 260).toFixed(2)}`));
    drawTower(order, gaps, dt, { hot: rt > 0 ? order[3] : -1 });
    if (t < go + 0.6) {
      ctx.globalAlpha = 1 - clamp01((t - go) / 0.4);
      lights(t, w - 70, 30);
      ctx.globalAlpha = 1;
    }
    if (t > go && t < go + 0.7) {
      const k = (t - go) / 0.7;
      ctx.save();
      ctx.translate(w / 2, h * 0.52);
      ctx.scale(spring(k * 1.6) * 1, spring(k * 1.6));
      ctx.globalAlpha = 1 - easeIn(k);
      ctx.font = `800 64px ${tk.display}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.fillText("GO", 0, 0);
      ctx.restore();
    }
  }

  /* ---------- 03 바나나 개입 ---------- */
  function scene3(t, dt) {
    const { w, h } = view;
    floorTexture();
    const r = 15;
    const laneL = w * 0.36;
    const laneR = w * 0.94;
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(laneL, 0, laneR - laneL, h);
    ctx.fillStyle = tk.line;
    ctx.fillRect(laneL - 3, 0, 3, h);
    ctx.fillRect(laneR, 0, 3, h);
    // 흐르는 노면 표시 (아래로 달리는 느낌)
    const off = (t * 300) % 60;
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    for (let y = -off; y < h; y += 60) ctx.fillRect(laneL, y, laneR - laneL, 2);

    const hitT = 1.45;
    const slip = clamp01((t - hitT) / 1.2);
    const base = [h * 0.62, h * 0.48, h * 0.38, h * 0.3];
    const ys = base.map((y, i) => y + Math.sin(t * 3 + i) * 5);
    ys[1] += easeOut((t - hitT - 0.15) / 1) * h * 0.19;
    ys[2] += easeOut((t - hitT - 0.3) / 1) * h * 0.19;
    ys[3] += easeOut((t - hitT - 0.45) / 1) * h * 0.14;
    ys[0] -= easeOut(slip) * h * 0.4;
    const mid = (laneL + laneR) / 2;
    const xs = [mid + 20, mid - 34, mid + 70, mid + 30];
    xs[0] += Math.sin(slip * 10) * 18 * (1 - slip);
    NAMES.forEach((nm, i) => {
      drawMarble(ctx, xs[i], ys[i], r, COLORS[i], nm[0], i === 0 ? slip * 16 : 0, tk);
      ctx.font = `700 11px ${CANVAS_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = tk.chalk;
      ctx.fillText(nm, xs[i], ys[i] - r - 9);
    });

    // 아이템 버튼 (실제 트레이와 같은 모양)
    const bw = 150;
    const bx = laneL + (laneR - laneL) / 2 - bw / 2;
    const by = h - 58;
    const pressK = t > 0.75 && t < 0.95 ? 1 : 0;
    const used = t >= 0.9;
    const relax = used ? squashAmt(t - 0.95, 0.12) : 0;
    ctx.save();
    ctx.translate(bx + bw / 2, by + 22);
    ctx.scale(1 - pressK * 0.06 + relax, 1 - pressK * 0.12 - relax);
    slant(ctx, -bw / 2, -22, bw, 44, 6);
    ctx.fillStyle = used ? "rgba(255,255,255,0.06)" : "rgba(10,12,16,0.95)";
    ctx.fill();
    ctx.fillStyle = COLORS[1];
    ctx.fillRect(-bw / 2 - 4, -22, 6, 44);
    ctx.font = `700 15px ${CANVAS_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = used ? tk.text3 : tk.chalk;
    ctx.fillText(used ? "영희 · 사용함" : "🍌 영희 · 바나나", 4, 1);
    ctx.restore();
    // 손가락 탭
    if (t > 0.3 && t < 1.3) {
      const k = clamp01((t - 0.3) / 0.45);
      const fx = bx + bw * 0.72;
      const fy = by + 60 - spring(k) * 30;
      if (t > 0.8) {
        const rk = clamp01((t - 0.8) / 0.4);
        ctx.beginPath();
        ctx.arc(bx + bw * 0.66, by + 20, 8 + rk * 34, 0, Math.PI * 2);
        ctx.strokeStyle = alpha(tk.brand, 1 - rk);
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.font = `30px ${CANVAS_FONT}`;
      ctx.fillText("👆", fx, fy);
    }
    // 날아가는 바나나
    if (t > 0.92 && t < hitT) {
      const k = (t - 0.92) / (hitT - 0.92);
      const sx = bx + bw / 2;
      const sy = by;
      const x = sx + (xs[0] - sx) * k;
      const y = sy + (ys[0] - sy) * k - Math.sin(k * Math.PI) * 90;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(k * 14);
      ctx.font = `28px ${CANVAS_FONT}`;
      ctx.fillText("🍌", 0, 0);
      ctx.restore();
    }
    if (t >= hitT) {
      const k = clamp01((t - hitT) / 0.45);
      ctx.beginPath();
      ctx.arc(xs[0], ys[0], r + k * 44, 0, Math.PI * 2);
      ctx.strokeStyle = alpha(tk.warning, 1 - k);
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    const order = [0, 1, 2, 3].sort((a, b) => ys[b] - ys[a]);
    const gaps = order.map((i, k) => (k === 0 ? "LEAD" : `+${((ys[order[0]] - ys[i]) / 300).toFixed(2)}`));
    drawTower(order, gaps, dt, { hot: t > hitT ? 0 : -1, title: "LIVE" });

    // 하단 자막: 개입 성공
    if (t > 2.15) {
      const k = (t - 2.15) / 0.5;
      const x = -w + (w + 10) * spring(k);
      slant(ctx, x, 142, 52, 30, 6);
      ctx.fillStyle = tk.brand;
      ctx.fill();
      slant(ctx, x + 54, 142, 176, 30, 6);
      ctx.fillStyle = tk.chalk;
      ctx.fill();
      ctx.font = `800 14px ${tk.display}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.fillText("개입", x + 26, 158);
      ctx.fillStyle = tk.bg;
      ctx.font = `800 13px ${CANVAS_FONT}`;
      ctx.textAlign = "left";
      ctx.fillText("민수 P1 → P4 미끄덩!", x + 70, 158);
    }
  }

  /* ---------- 04 판정 ---------- */
  function scene4(t, dt) {
    const { w, h } = view;
    floorTexture();
    const r = 15;
    const fy = h * 0.5;
    const sq = 12;
    for (let x = 0, k = 0; x < w; x += sq, k++) {
      ctx.fillStyle = k % 2 ? tk.chalk : tk.bg;
      ctx.fillRect(x, fy - sq, sq, sq);
      ctx.fillStyle = k % 2 ? tk.bg : tk.chalk;
      ctx.fillRect(x, fy, sq, sq);
    }
    const order = [1, 2, 3, 0];
    const arrived = [];
    order.forEach((i, k) => {
      const arrive = 0.35 + k * 0.32 + (k === 3 ? 0.4 : 0);
      const fallT = 0.42;
      const p = clamp01((t - (arrive - fallT)) / fallT);
      const slotX = w * 0.52 + (k - 1.5) * 50;
      const endY = h * 0.74;
      const y = -30 + (endY + 30) * p * p;
      if (p <= 0) return;
      if (p < 1) drawMarble(ctx, slotX, y, r, COLORS[i], NAMES[i][0], 0, tk, 0.85, 1.2);
      else {
        marbleAt(slotX, endY, r, i, t - arrive);
        arrived.push(i);
        ctx.font = `400 13px ${tk.num}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = k === 3 ? tk.brand : tk.text2;
        ctx.fillText(`P${k + 1}`, slotX, endY + r + 16);
      }
    });
    const gaps = ["LEAD", "+0.31", "+0.58", "+1.94"];
    drawTower(order, gaps, dt, { hot: arrived.length === 4 ? 0 : -1, title: "FINAL" });

    const st = 2.05;
    if (t > st - 0.25) {
      // 예비동작(뒤로 살짝 물러났다가) → 쾅 → 여운
      const a = clamp01((t - (st - 0.25)) / 0.25);
      const k = (t - st) / 0.55;
      let sc;
      let rot;
      if (t < st) {
        sc = 1.6 + a * 0.35;
        rot = -0.02 - a * 0.05;
      } else {
        sc = 1.95 - 0.95 * spring(k);
        rot = -0.07 - 0.03 * spring(k);
      }
      const land = t - st - 0.12;
      const sq2 = land > 0 ? squashAmt(land, 0.12) : 0;
      ctx.save();
      const shake = land > 0 && land < 0.3 ? (Math.random() - 0.5) * 8 * (1 - land / 0.3) : 0;
      ctx.translate(w * 0.5 + shake, Math.max(h * 0.36, 176) + shake);
      ctx.rotate(rot);
      ctx.scale(sc * (1 + sq2), sc * (1 - sq2));
      ctx.globalAlpha = t < st ? a * 0.5 : 1;
      ctx.font = `800 30px ${tk.display}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const text = "민수가 쏩니다 ☕";
      const tw = ctx.measureText(text).width + 44;
      slant(ctx, -tw / 2, -30, tw, 60, 10);
      ctx.fillStyle = tk.brand;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#fff";
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.fillText(text, 0, 2);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  const fns = [scene1, scene2, scene3, scene4];
  const staticT = [3, 3.2, 3.2, 3.2];
  let lastNow = performance.now();

  function paint(t, dt = 1 / 60) {
    const { w, h, dpr } = view;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    fns[scene](t, Math.min(dt, 0.05));
    if (!reduced) stinger(t);
  }

  function loop(now) {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    const dt = (now - lastNow) / 1000;
    lastNow = now;
    if (document.hidden) return;
    const t = (now - t0) / 1000;
    paint(t, dt);
    tickClock(t);
  }

  /* ---------- 오도미터 시계 (자리별 롤링) ---------- */
  let clockBase = 0;
  function tickClock(t) {
    if (!clockEl) return;
    const total = clockBase + Math.max(0, t);
    const s = Math.floor(total);
    const digits = `${String(Math.floor(s / 60) % 60).padStart(2, "0")}${String(s % 60).padStart(2, "0")}${Math.floor((total % 1) * 10)}`;
    clockEl.querySelectorAll(".odo__col").forEach((col, k) => {
      const d = Number(digits[k]);
      if (col.dataset.d !== String(d)) {
        col.dataset.d = d;
        col.style.setProperty("--d", d);
      }
    });
  }

  /* ---------- 키네틱 헤드라인 ---------- */
  function setHeadline(i) {
    const s = SCENES[i];
    if (headEl) {
      let n = 0;
      const html = s.lines
        .map(
          (line, li) =>
            `<span class="kinetic__line${li === s.hot ? " is-hot" : ""}">${Array.from(line)
              .map((ch) => (ch === " " ? '<span class="kinetic__sp"> </span>' : `<span class="kinetic__ch" style="--i:${n++}">${escapeHtml(ch)}</span>`))
              .join("")}</span>`
        )
        .join("");
      headEl.classList.add("is-out");
      setTimeout(
        () => {
          if (!alive) return;
          headEl.innerHTML = html;
          headEl.setAttribute("aria-label", s.lines.join(" "));
          headEl.classList.remove("is-out");
        },
        reduced ? 0 : 180
      );
    }
    if (descEl) descEl.textContent = s.desc;
    stepsEl?.querySelectorAll(".bc-steps__seg").forEach((seg, k) => {
      seg.classList.toggle("is-on", k === i);
      seg.classList.toggle("is-done", k < i);
      seg.style.setProperty("--dur", `${s.dur}ms`);
    });
  }

  function show(i) {
    if (!alive) return;
    if (i === 0) clockBase = 0;
    else clockBase += SCENES[i - 1].dur / 1000;
    scene = i;
    tower = null;
    t0 = performance.now();
    setHeadline(i);
    if (reduced) paint(staticT[i]);
    clearTimeout(timer);
    timer = setTimeout(() => show((i + 1) % SCENES.length), SCENES[i].dur);
  }

  if (stepsEl) {
    stepsEl.innerHTML = SCENES.map((s, k) => `<button class="bc-steps__seg" data-k="${k}" aria-label="${s.tag}"><span>${s.tag.split(" ")[0]}</span><i></i></button>`).join("");
    stepsEl.onclick = (e) => {
      const b = e.target.closest("[data-k]");
      if (b) show(Number(b.dataset.k));
    };
  }
  show(0);
  if (!reduced) raf = requestAnimationFrame(loop);

  return {
    stop() {
      alive = false;
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      ro.disconnect();
    },
  };
}
