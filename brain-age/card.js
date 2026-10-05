// 결과 공유 카드 (1080 x 1350): 인쇄된 검사 성적서 + 기록지 모눈 + 바늘 게이지
import { createCanvas, roundRect, CANVAS_FONT } from "../shared/kit.js";
import { KEYS, META } from "./scoring.js";
import { art } from "./instrument.js";

export const MONO = '"IBM Plex Mono", "SF Mono", "Roboto Mono", ui-monospace, monospace';
export const DISPLAY = `"IBM Plex Sans KR", ${CANVAS_FONT}`;

export function drawPaper(ctx, W, H, c, step = 12) {
  ctx.fillStyle = c.paper;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0, x = 0; x <= W; x += step, i++) {
    ctx.strokeStyle = c.grid;
    ctx.globalAlpha = i % 5 === 0 ? 1 : 0.45;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, H);
    ctx.stroke();
  }
  for (let i = 0, y = 0; y <= H; y += step, i++) {
    ctx.strokeStyle = c.grid;
    ctx.globalAlpha = i % 5 === 0 ? 1 : 0.45;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(W, y + 0.5);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function drawGauge(ctx, cx, cy, R, value, c, { min = 10, max = 80 } = {}) {
  const toAng = (v) => Math.PI + ((v - min) / (max - min)) * Math.PI;
  ctx.save();
  ctx.lineCap = "round";
  // 눈금판
  ctx.strokeStyle = c.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, R + 6, Math.PI, 0);
  ctx.stroke();
  ctx.strokeStyle = c.red;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, R + 6, toAng(max - (max - min) * 0.18), 0);
  ctx.stroke();
  ctx.fillStyle = c.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${Math.round(R * 0.13)}px ${MONO}`;
  for (let v = min; v <= max; v += 5) {
    const a = toAng(v);
    const major = (v - min) % 10 === 0;
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = major ? 2.4 : 1.4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    ctx.lineTo(cx + Math.cos(a) * (R - (major ? R * 0.14 : R * 0.07)), cy + Math.sin(a) * (R - (major ? R * 0.14 : R * 0.07)));
    ctx.stroke();
    if (major) ctx.fillText(String(v), cx + Math.cos(a) * R * 0.7, cy + Math.sin(a) * R * 0.7);
  }
  // 바늘
  const a = toAng(Math.max(min, Math.min(max, value)));
  ctx.strokeStyle = c.red;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(a) * R * 0.1, cy - Math.sin(a) * R * 0.1);
  ctx.lineTo(cx + Math.cos(a) * R * 0.92, cy + Math.sin(a) * R * 0.92);
  ctx.stroke();
  ctx.fillStyle = c.ink;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawStamp(ctx, x, y, r, text, c, rot = -0.2) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.strokeStyle = c.red;
  ctx.fillStyle = c.red;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, r - 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${Math.round(r * 0.36)}px ${DISPLAY}`;
  ctx.fillText(text, 0, 0);
  ctx.font = `600 ${Math.round(r * 0.17)}px ${MONO}`;
  ctx.fillText("BRAIN AGE", 0, -r * 0.48);
  ctx.fillText("FOR FUN", 0, r * 0.5);
  ctx.restore();
}

function radar(ctx, cx, cy, R, skills, c) {
  const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / 5;
  const pt = (i, v) => [cx + Math.cos(ang(i)) * R * v, cy + Math.sin(ang(i)) * R * v];
  ctx.strokeStyle = c.ink2;
  ctx.lineWidth = 1;
  [0.5, 1].forEach((s) => {
    ctx.beginPath();
    KEYS.forEach((_, i) => ctx[i ? "lineTo" : "moveTo"](...pt(i, s)));
    ctx.closePath();
    ctx.stroke();
  });
  ctx.beginPath();
  KEYS.forEach((k, i) => ctx[i ? "lineTo" : "moveTo"](...pt(i, Math.max(0.05, (skills[k] ?? 0) / 100))));
  ctx.closePath();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = c.red;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = c.red;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.font = `600 12px ${CANVAS_FONT}`;
  ctx.fillStyle = c.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  KEYS.forEach((k, i) => {
    const [x, y] = pt(i, 1.3);
    ctx.fillText(META[k].short, x, y);
  });
}

// comp: computeAll 결과, raw: 원점수, real: 실제 나이, no: 성적서 번호
export function drawShareCard({ comp, raw, real, no = 1, t = Date.now() }) {
  const W = 540;
  const H = 675;
  const { canvas, ctx } = createCanvas(W, H, 2);
  const c = art();
  drawPaper(ctx, W, H, c);

  // 머리
  ctx.fillStyle = c.ink;
  ctx.fillRect(28, 28, W - 56, 4);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.font = `700 24px ${DISPLAY}`;
  ctx.fillText("뇌 나이 검사 성적서", 28, 66);
  ctx.textAlign = "right";
  ctx.font = `600 14px ${MONO}`;
  ctx.fillText(`No.${String(no).padStart(4, "0")}`, W - 28, 64);
  const d = new Date(t);
  ctx.textAlign = "left";
  ctx.fillStyle = c.ink2;
  ctx.font = `500 12px ${MONO}`;
  ctx.fillText(`${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}  ·  5 CHANNEL  ·  재미용 측정`, 28, 88);
  ctx.fillStyle = c.ink;
  ctx.fillRect(28, 100, W - 56, 1.5);

  // 게이지 + 숫자
  drawGauge(ctx, 160, 250, 118, comp.brain, c);
  ctx.textAlign = "left";
  ctx.fillStyle = c.ink2;
  ctx.font = `600 15px ${CANVAS_FONT}`;
  ctx.fillText("나의 뇌 나이", 312, 150);
  ctx.fillStyle = c.ink;
  ctx.font = `700 112px ${DISPLAY}`;
  const num = String(comp.brain);
  ctx.fillText(num, 306, 254);
  const nw = ctx.measureText(num).width;
  ctx.font = `700 30px ${DISPLAY}`;
  ctx.fillText("세", 312 + nw, 252);

  ctx.font = `700 18px ${CANVAS_FONT}`;
  const cmp = compareText(comp.brain, real) || "미니게임 5개로 잰 재미용 뇌 나이";
  const cw = ctx.measureText(cmp).width;
  ctx.fillStyle = c.red;
  ctx.globalAlpha = 0.16;
  ctx.fillRect(28, 284, cw + 20, 32);
  ctx.globalAlpha = 1;
  ctx.fillStyle = c.ink;
  ctx.fillText(cmp, 38, 307);

  // 표
  const top = 348;
  ctx.fillStyle = c.ink;
  ctx.fillRect(28, top, 300, 1.5);
  ctx.font = `600 11px ${MONO}`;
  ctx.fillStyle = c.ink2;
  ctx.fillText("CH", 28, top + 20);
  ctx.fillText("항목", 70, top + 20);
  ctx.textAlign = "right";
  ctx.fillText("측정값", 258, top + 20);
  ctx.fillText("환산", 328, top + 20);
  KEYS.forEach((k, i) => {
    const y = top + 52 + i * 34;
    ctx.fillStyle = c.rule;
    ctx.fillRect(28, y - 22, 300, 1);
    ctx.textAlign = "left";
    ctx.fillStyle = c.ink;
    ctx.font = `600 12px ${MONO}`;
    ctx.fillText(META[k].code, 28, y);
    ctx.font = `600 15px ${CANVAS_FONT}`;
    ctx.fillText(META[k].name, 70, y);
    ctx.textAlign = "right";
    ctx.font = `600 14px ${MONO}`;
    ctx.fillText(raw[k] == null ? "SKIP" : META[k].fmt(raw[k]), 258, y);
    ctx.fillStyle = c.ink2;
    ctx.fillText(comp.ages[k] == null ? "–" : `${comp.ages[k]}세`, 328, y);
  });
  ctx.fillStyle = c.ink;
  ctx.fillRect(28, top + 196, 300, 1.5);

  radar(ctx, 438, 444, 62, comp.skills, c);
  drawStamp(ctx, 446, 590, 50, "측정완료", c);

  ctx.textAlign = "left";
  ctx.fillStyle = c.ink2;
  ctx.font = `500 11px ${CANVAS_FONT}`;
  ctx.fillText("재미로 보는 측정이에요 · 의학적 진단이 아니에요", 28, 620);
  ctx.font = `600 13px ${DISPLAY}`;
  ctx.fillStyle = c.ink;
  ctx.fillText("뇌 나이 측정소 · 너도 재봐!", 28, 645);
  return canvas;
}

export function compareText(brain, real) {
  if (!real) return "";
  const d = real - brain;
  if (d > 0) return `실제 나이보다 ${d}살 젊어요`;
  if (d < 0) return `실제 나이보다 ${-d}살 많게 나왔어요`;
  return "실제 나이와 똑같아요";
}

export { roundRect };
