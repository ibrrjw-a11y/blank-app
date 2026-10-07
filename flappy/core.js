// 날개 퍼덕 — 계산(화면 없음). 원작: 플래피 버드류. 누르면 위로 퍼덕, 놓으면 떨어짐. 기둥 틈을 지나간다
// 갈수록 틈이 좁아지고(168 → 118px) 빨라짐(초당 150 → 230px). 땅이나 기둥에 닿으면 끝(천장은 막힘)
import { seededRandom } from "../shared/kit.js";

export const W = 360, H = 560, GROUND = 500, X = 96, R = 12, PW = 62, SPACE = 210;
export const GRAV = 1500, FLAP = -420;
export const gapAt = (k) => Math.max(118, 168 - k * 1.6);
export const speedAt = (score) => Math.min(230, 150 + score * 2.5);

export function pipes(seed, n) {
  const rnd = seededRandom(`flappy:${seed}`), out = [];
  let c = H / 2 - 40;
  for (let k = 0; k < n; k++) {
    const g = gapAt(k), lo = 70 + g / 2, hi = GROUND - 50 - g / 2;
    c = Math.max(lo, Math.min(hi, c + (rnd() * 2 - 1) * 170));
    out.push({ x: 440 + k * SPACE, c: Math.round(c), g });
  }
  return out;
}
export function newState(seed) { return { seed, pipes: pipes(seed, 3000), dist: 0, y: H / 2 - 40, vy: 0, score: 0, started: false, dead: false, why: "", t: 0 }; }
// 원과 네모가 겹치는지
function hitRect(cx, cy, r, x0, y0, x1, y1) {
  const nx = Math.max(x0, Math.min(cx, x1)), ny = Math.max(y0, Math.min(cy, y1));
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
}
export function collides(st) {
  if (st.y + R >= GROUND) return "ground";
  for (let k = Math.max(0, st.score - 1); k < st.score + 3; k++) {
    const p = st.pipes[k], px = p.x - st.dist;
    if (px > X + R || px + PW < X - R) continue;
    if (hitRect(X, st.y, R, px, -999, px + PW, p.c - p.g / 2) || hitRect(X, st.y, R, px, p.c + p.g / 2, px + PW, GROUND)) return "pipe";
  }
  return null;
}
export function step(st, dt) {
  st.t += dt;
  if (!st.started || st.dead) return null;
  const s = dt / 1000;
  st.vy += GRAV * s; st.y += st.vy * s;
  if (st.y < R) { st.y = R; st.vy = 0; }
  st.dist += speedAt(st.score) * s;
  let ev = null;
  while (st.pipes[st.score].x - st.dist + PW < X - R) { st.score++; ev = "pass"; }
  const c = collides(st);
  if (c) { st.dead = true; st.why = c; if (c === "ground") st.y = GROUND - R; return "dead"; }
  return ev;
}
export function act(st, a) {
  if (st.dead || a !== "tap") return;
  st.started = true; st.vy = FLAP;
}
