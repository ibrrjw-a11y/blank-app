// 회로 뇌 일러스트. 인트로(SVG)와 공유 카드(Canvas)가 같은 도형을 쓴다.
// 좌표계는 320 x 240 (옆에서 본 뇌, 왼쪽이 이마).
import { seededRandom } from "../shared/kit.js";

export const VB = { w: 320, h: 240 };

// 대뇌 외곽선 (울퉁불퉁한 이랑 느낌)
export const CEREBRUM =
  "M64 156C42 150 34 124 44 104C38 82 54 62 76 58C84 38 108 30 128 36C142 20 170 18 186 30" +
  "C204 20 232 24 242 40C264 40 282 58 280 80C298 92 300 120 286 136C290 154 274 168 254 166" +
  "C244 178 224 182 210 174C196 186 172 186 160 176C144 186 118 184 108 172C90 178 70 172 64 156Z";
// 소뇌
export const CEREBELLUM = "M220 170C236 164 266 164 277 177C286 192 270 207 248 207C228 207 212 196 214 184C215 177 216 173 220 170Z";
// 뇌줄기
export const STEM = "M198 176C201 194 200 212 193 229C199 233 207 233 212 229C212 212 214 194 219 178Z";
// 소뇌 주름
export const FOLIA = ["M224 181C240 176 262 177 274 186", "M220 192C236 189 256 191 270 197", "M226 201C238 201 252 202 262 204"];
// 고랑(장식선)
export const SULCI = [
  "M104 150C130 134 160 128 196 138C210 142 222 136 234 126",
  "M178 30C170 56 182 78 168 104C162 116 166 126 160 134",
  "M240 42C230 64 246 84 236 106",
];

// 미니게임이 꽂히는 뇌 영역 (재미용 배치, 해부학적 정확성은 없음)
export const REGIONS = {
  rt: { x: 206, y: 62 },
  mem: { x: 178, y: 114 },
  color: { x: 262, y: 104 },
  hear: { x: 150, y: 158 },
  math: { x: 90, y: 104 },
};

let cache;
// 뇌 안쪽에 PCB 회로처럼 직각/45도로 꺾이는 선을 만든다 (시드 고정이라 항상 같은 모양)
export function buildTraces(count = 30) {
  if (cache) return cache;
  const ctx = document.createElement("canvas").getContext("2d");
  const shape = new Path2D(CEREBRUM);
  const inside = (x, y) =>
    ctx.isPointInPath(shape, x, y) &&
    ctx.isPointInPath(shape, x + 7, y) &&
    ctx.isPointInPath(shape, x - 7, y) &&
    ctx.isPointInPath(shape, x, y + 7) &&
    ctx.isPointInPath(shape, x, y - 7);
  const rand = seededRandom("brain-age-circuit");
  const STEP = 10;
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const used = new Set();
  const key = (x, y) => `${x},${y}`;
  const traces = [];
  let tries = 0;
  while (traces.length < count && tries < 4000) {
    tries++;
    let x = Math.round((40 + rand() * 250) / STEP) * STEP;
    let y = Math.round((30 + rand() * 160) / STEP) * STEP;
    if (!inside(x, y) || used.has(key(x, y))) continue;
    const pts = [[x, y]];
    const cells = [key(x, y)];
    let d = Math.floor(rand() * 8);
    const segs = 2 + Math.floor(rand() * 4);
    for (let s = 0; s < segs; s++) {
      if (s > 0) d = (d + [7, 0, 1][Math.floor(rand() * 3)]) % 8;
      const len = 1 + Math.floor(rand() * 3);
      let ok = true;
      let nx = x;
      let ny = y;
      const seg = [];
      for (let k = 0; k < len; k++) {
        nx += dirs[d][0] * STEP;
        ny += dirs[d][1] * STEP;
        if (!inside(nx, ny) || used.has(key(nx, ny)) || cells.includes(key(nx, ny))) {
          ok = false;
          break;
        }
        seg.push(key(nx, ny));
      }
      if (!ok) break;
      x = nx;
      y = ny;
      cells.push(...seg);
      pts.push([x, y]);
    }
    if (pts.length < 3) continue;
    cells.forEach((c) => used.add(c));
    traces.push(pts);
  }
  cache = traces;
  return traces;
}

export const tracePath = (pts) => "M" + pts.map((p) => p.join(" ")).join("L");

// 인트로용 SVG 마크업 (색은 CSS 클래스에서 토큰으로 입힘)
export function brainMarkup() {
  const traces = buildTraces();
  const pulses = traces.filter((_, i) => i % 2 === 0);
  return `
  <svg class="ba-svg" viewBox="0 0 ${VB.w} ${VB.h}" role="img" aria-label="회로로 그린 뇌 그림">
    <defs>
      <filter id="ba-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2.4" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <radialGradient id="ba-hot"><stop offset="0" class="ba-hot-0" /><stop offset="1" class="ba-hot-1" /></radialGradient>
    </defs>
    <g class="ba-back" filter="url(#ba-glow)">
      <path d="${STEM}" /><path d="${CEREBELLUM}" />
    </g>
    <g class="ba-folia">${FOLIA.map((d) => `<path d="${d}" />`).join("")}</g>
    <path class="ba-shell" d="${CEREBRUM}" />
    ${Object.entries(REGIONS)
      .map(([k, r]) => `<circle class="ba-region" data-k="${k}" cx="${r.x}" cy="${r.y}" r="34" fill="url(#ba-hot)" />`)
      .join("")}
    <g class="ba-sulci">${SULCI.map((d) => `<path d="${d}" />`).join("")}</g>
    <g class="ba-traces">${traces.map((t) => `<path d="${tracePath(t)}" />`).join("")}</g>
    <g class="ba-nodes">${traces
      .map((t) => {
        const [ex, ey] = t[t.length - 1];
        const [sx, sy] = t[0];
        return `<circle cx="${ex}" cy="${ey}" r="2.6" /><circle class="ba-node-s" cx="${sx}" cy="${sy}" r="1.6" />`;
      })
      .join("")}</g>
    <g class="ba-pulses" filter="url(#ba-glow)">${pulses
      .map((t) => `<path class="ba-pulse" d="${tracePath(t)}" />`)
      .join("")}</g>
    <g class="ba-outline" filter="url(#ba-glow)"><path d="${CEREBRUM}" /></g>
  </svg>`;
}

// 펄스 길이·속도 설정 (마운트 후 1회)
export function initPulses(root) {
  root.querySelectorAll(".ba-pulse").forEach((p, i) => {
    const len = p.getTotalLength();
    p.style.setProperty("--len", len.toFixed(1));
    p.style.animationDuration = `${(0.9 + len / 70).toFixed(2)}s`;
    p.style.animationDelay = `${(-((i * 0.37) % 2)).toFixed(2)}s`;
  });
}

// 공유 카드/OG용 캔버스 그리기. colors: { line, glow, dim, fill, base(불투명 배경) }
export function drawBrain(ctx, x, y, scale, colors) {
  const traces = buildTraces();
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const back = [STEM, CEREBELLUM].map((d) => new Path2D(d));
  const main = new Path2D(CEREBRUM);
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 2.4;
  back.forEach((s) => {
    ctx.fillStyle = colors.base;
    ctx.fill(s);
    ctx.fillStyle = colors.fill;
    ctx.fill(s);
    ctx.stroke(s);
  });
  ctx.shadowBlur = 0;
  ctx.strokeStyle = colors.dim;
  ctx.lineWidth = 1.4;
  FOLIA.forEach((d) => ctx.stroke(new Path2D(d)));
  ctx.fillStyle = colors.base;
  ctx.fill(main);
  ctx.fillStyle = colors.fill;
  ctx.fill(main);
  // 회로
  ctx.strokeStyle = colors.dim;
  ctx.lineWidth = 1.4;
  traces.forEach((t) => ctx.stroke(new Path2D(tracePath(t))));
  ctx.fillStyle = colors.line;
  traces.forEach((t) => {
    const [ex, ey] = t[t.length - 1];
    ctx.beginPath();
    ctx.arc(ex, ey, 2.4, 0, Math.PI * 2);
    ctx.fill();
  });
  // 빛나는 일부 회로
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 1.8;
  traces.forEach((t, i) => {
    if (i % 3 === 0) ctx.stroke(new Path2D(tracePath(t)));
  });
  // 외곽선
  ctx.lineWidth = 2.6;
  ctx.stroke(main);
  ctx.restore();
}
