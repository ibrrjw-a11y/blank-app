// 결과 공유 카드 (1080 x 1350). 색은 토큰에서 읽는다.
import { createCanvas, roundRect, CANVAS_FONT } from "../shared/kit.js";
import { drawBrain } from "./brain.js";
import { KEYS, META } from "./scoring.js";

export function tokens() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n) => cs.getPropertyValue(n).trim();
  return {
    brand: v("--brand"),
    bg: v("--color-bg"),
    surface: v("--color-surface"),
    raised: v("--color-surface-raised"),
    text: v("--color-text"),
    sub: v("--color-text-secondary"),
    ter: v("--color-text-tertiary"),
    border: v("--color-border"),
    borderStrong: v("--color-border-strong"),
  };
}

// 16진 색 + 알파
export function alpha(hex, a) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export function drawBackdrop(ctx, W, H, c) {
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, H * 0.22, 10, W / 2, H * 0.22, W * 0.75);
  g.addColorStop(0, alpha(c.brand, 0.22));
  g.addColorStop(1, alpha(c.brand, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = alpha(c.brand, 0.06);
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(W, y + 0.5);
    ctx.stroke();
  }
}

function radar(ctx, cx, cy, R, skills, c) {
  const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / 5;
  const pt = (i, v) => [cx + Math.cos(ang(i)) * R * v, cy + Math.sin(ang(i)) * R * v];
  ctx.strokeStyle = c.borderStrong;
  ctx.lineWidth = 1;
  [0.5, 1].forEach((s) => {
    ctx.beginPath();
    KEYS.forEach((_, i) => ctx[i ? "lineTo" : "moveTo"](...pt(i, s)));
    ctx.closePath();
    ctx.stroke();
  });
  KEYS.forEach((_, i) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(...pt(i, 1));
    ctx.stroke();
  });
  ctx.beginPath();
  KEYS.forEach((k, i) => ctx[i ? "lineTo" : "moveTo"](...pt(i, Math.max(0.05, (skills[k] ?? 0) / 100))));
  ctx.closePath();
  ctx.fillStyle = alpha(c.brand, 0.28);
  ctx.fill();
  ctx.shadowColor = c.brand;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = c.brand;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.font = `600 13px ${CANVAS_FONT}`;
  ctx.fillStyle = c.sub;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  KEYS.forEach((k, i) => {
    const [x, y] = pt(i, 1.32);
    ctx.fillText(`${META[k].icon}`, x, y);
  });
}

// rec: { age, real }, comp: computeAll 결과, raw: 원점수
export function drawShareCard({ comp, raw, real }) {
  const W = 540;
  const H = 675;
  const { canvas, ctx } = createCanvas(W, H, 2);
  const c = tokens();
  drawBackdrop(ctx, W, H, c);

  // 머리
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = c.text;
  ctx.font = `700 20px ${CANVAS_FONT}`;
  ctx.fillText("🧠 뇌 나이 측정소", 32, 52);
  ctx.font = `600 13px ${CANVAS_FONT}`;
  const tag = "재미용 측정";
  const tw = ctx.measureText(tag).width + 24;
  roundRect(ctx, W - 32 - tw, 33, tw, 26, 13);
  ctx.fillStyle = alpha(c.brand, 0.16);
  ctx.fill();
  ctx.fillStyle = c.brand;
  ctx.textAlign = "center";
  ctx.fillText(tag, W - 32 - tw / 2, 51);

  // 뇌
  drawBrain(ctx, (W - 320 * 1.05) / 2, 78, 1.05, {
    line: c.brand,
    glow: c.brand,
    dim: alpha(c.brand, 0.32),
    fill: alpha(c.brand, 0.05),
  });

  // 나이
  ctx.textAlign = "center";
  ctx.fillStyle = c.sub;
  ctx.font = `600 18px ${CANVAS_FONT}`;
  ctx.fillText("나의 뇌 나이", W / 2, 364);
  ctx.font = `800 96px ${CANVAS_FONT}`;
  ctx.shadowColor = c.brand;
  ctx.shadowBlur = 24;
  ctx.fillStyle = c.brand;
  const ageText = `${comp.brain}`;
  const aw = ctx.measureText(ageText).width;
  ctx.font = `800 36px ${CANVAS_FONT}`;
  const uw = ctx.measureText("세").width;
  const startX = W / 2 - (aw + 6 + uw) / 2;
  ctx.textAlign = "left";
  ctx.font = `800 96px ${CANVAS_FONT}`;
  ctx.fillText(ageText, startX, 450);
  ctx.shadowBlur = 0;
  ctx.font = `800 36px ${CANVAS_FONT}`;
  ctx.fillStyle = c.text;
  ctx.fillText("세", startX + aw + 6, 450);

  ctx.textAlign = "center";
  ctx.font = `600 18px ${CANVAS_FONT}`;
  ctx.fillStyle = c.text;
  ctx.fillText(compareText(comp.brain, real) || "미니게임 5개로 잰 재미용 뇌 나이", W / 2, 488);

  // 하단 패널: 왼쪽 능력치 목록, 오른쪽 레이더
  roundRect(ctx, 24, 512, W - 48, 132, 20);
  ctx.fillStyle = alpha(c.raised || c.surface, 0.9);
  ctx.fill();
  ctx.strokeStyle = c.border;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.textAlign = "left";
  KEYS.forEach((k, i) => {
    const y = 538 + i * 23;
    ctx.font = `600 14px ${CANVAS_FONT}`;
    ctx.fillStyle = c.sub;
    ctx.fillText(`${META[k].icon} ${META[k].name}`, 44, y);
    ctx.fillStyle = c.text;
    ctx.textAlign = "right";
    ctx.fillText(raw[k] == null ? "건너뜀" : META[k].fmt(raw[k]), 300, y);
    ctx.textAlign = "left";
  });
  radar(ctx, 412, 578, 46, comp.skills, c);

  ctx.textAlign = "center";
  ctx.font = `400 12px ${CANVAS_FONT}`;
  ctx.fillStyle = c.ter;
  ctx.fillText("재미로 보는 측정이에요 · 의학적 진단이 아니에요", W / 2, 664);
  return canvas;
}

export function compareText(brain, real) {
  if (!real) return "";
  const d = real - brain;
  if (d > 0) return `실제 나이보다 ${d}살 젊어요`;
  if (d < 0) return `실제 나이보다 ${-d}살 많게 나왔어요`;
  return "실제 나이와 똑같아요";
}
