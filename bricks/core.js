// 벽돌깨기 — 계산(화면 없음). 원작: 브레이크아웃류. 받침대로 공을 튕겨 벽돌을 깬다
// 어렵게: 공은 하나뿐(놓치면 끝). 벽돌을 칠 때마다 공이 빨라짐(초당 330 → 640px). 단계마다 단단한 벽돌(두 번 쳐야 깨짐)이 늘고 받침대가 짧아짐
import { seededRandom } from "../shared/kit.js";

export const W = 360, H = 560, PY = 516, PH = 10, BR = 6, COLS = 8, ROWS = 7, BW = 40, BH = 16, BX = 8, BY = 72, GAPX = 3, GAPY = 4;
export const paddleW = (stage) => Math.max(48, 76 - stage * 6);
export const speedAt = (hits) => Math.min(640, 330 + hits * 6);

// 단계 s 의 벽돌: hp 0(빈칸)·1·2
export function layout(seed, s) {
  const rnd = seededRandom(`bricks:${seed}:${s}`), out = [];
  const hard = Math.min(0.45, 0.08 + s * 0.09), empty = 0.12;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const x = rnd();
    out.push({ r, c, hp: x < empty ? 0 : x < empty + hard ? 2 : 1 });
  }
  if (out.every((b) => !b.hp)) out[0].hp = 1;
  return out;
}
export const brickRect = (b) => ({ x: BX + b.c * (BW + GAPX), y: BY + b.r * (BH + GAPY), w: BW, h: BH });

export function newState(seed) {
  const st = { seed, stage: 0, bricks: layout(seed, 0), px: W / 2, pTarget: W / 2, left: false, right: false, bx: W / 2, by: PY - BR - 1, vx: 0, vy: 0, stuck: true, hits: 0, score: 0, started: false, dead: false, why: "", t: 0 };
  return st;
}
function launch(st) {
  if (!st.stuck) return;
  st.stuck = false; st.started = true;
  const sp = speedAt(st.hits), a = -Math.PI / 2 + 0.35;   // 늘 같은 각도로 출발(같은 판 공정)
  st.vx = Math.cos(a) * sp; st.vy = Math.sin(a) * sp;
}
export function act(st, a) {
  if (st.dead) return;
  if (a === "left") st.left = true; else if (a === "left:up") st.left = false;
  else if (a === "right") st.right = true; else if (a === "right:up") st.right = false;
  else if (a === "launch") launch(st);
  else if (a?.type === "down") { st.pTarget = a.x; launch(st); }
  else if (a?.type === "move") st.pTarget = a.x;
}
function setSpeed(st) { const sp = speedAt(st.hits), m = Math.hypot(st.vx, st.vy) || 1; st.vx *= sp / m; st.vy *= sp / m; }
export function step(st, dt) {
  st.t += dt;
  if (st.dead) return null;
  const s = dt / 1000, half = paddleW(st.stage) / 2;
  if (st.left || st.right) st.pTarget = st.px + (st.right - st.left) * 520 * s;
  st.px = Math.max(half, Math.min(W - half, st.px + Math.max(-900 * s, Math.min(900 * s, st.pTarget - st.px))));
  if (st.stuck) { st.bx = st.px; st.by = PY - BR - 1; return null; }
  st.bx += st.vx * s; st.by += st.vy * s;
  let ev = null;
  if (st.bx < BR) { st.bx = BR; st.vx = Math.abs(st.vx); }
  if (st.bx > W - BR) { st.bx = W - BR; st.vx = -Math.abs(st.vx); }
  if (st.by < BR) { st.by = BR; st.vy = Math.abs(st.vy); }
  // 받침대: 맞은 자리에 따라 튀는 각도가 달라짐(가운데 = 위로 곧게, 끝 = 60° 옆으로)
  if (st.vy > 0 && st.by + BR >= PY && st.by + BR <= PY + PH + 8 && Math.abs(st.bx - st.px) <= half + BR) {
    const off = Math.max(-1, Math.min(1, (st.bx - st.px) / half)), a = -Math.PI / 2 + off * (Math.PI / 3), sp = speedAt(st.hits);
    st.vx = Math.cos(a) * sp; st.vy = Math.sin(a) * sp; st.by = PY - BR; ev = "paddle";
  }
  // 벽돌: 한 번에 하나만 맞음. 덜 파고든 쪽으로 튕김
  for (const b of st.bricks) {
    if (!b.hp) continue;
    const r = brickRect(b);
    const nx = Math.max(r.x, Math.min(st.bx, r.x + r.w)), ny = Math.max(r.y, Math.min(st.by, r.y + r.h));
    if ((st.bx - nx) ** 2 + (st.by - ny) ** 2 > BR * BR) continue;
    const ox = Math.min(st.bx + BR - r.x, r.x + r.w - (st.bx - BR)), oy = Math.min(st.by + BR - r.y, r.y + r.h - (st.by - BR));
    if (ox < oy) st.vx = -st.vx; else st.vy = -st.vy;
    b.hp--; st.hits++; setSpeed(st);
    if (!b.hp) { st.score++; ev = "brick"; } else ev = "crack";
    break;
  }
  if (st.bricks.every((b) => !b.hp)) {
    st.stage++; st.bricks = layout(st.seed, st.stage); st.stuck = true; ev = "stage";
  }
  if (st.by - BR > H) { st.dead = true; st.why = "miss"; return "dead"; }
  return ev;
}
