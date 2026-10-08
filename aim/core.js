// 에임 연습 — 계산(화면 없음). 30초 동안 하나씩 나타나는 과녁을 눌러 맞힌다
// 갈수록 과녁이 작아지고(반지름 30 → 15px) 빨리 사라짐(1.3 → 0.7초). 빗나간 클릭·놓친 과녁은 정확도에 반영
// 같은 판 = 같은 과녁 자리 순서(판 번호로 결정) → 도전장·오늘의 판 공정
import { seededRandom } from "../shared/kit.js";

export const W = 360, H = 560, DUR = 30000, TOP = 60;
export const radiusAt = (t) => 30 - 15 * Math.min(1, t / DUR);
export const lifeAt = (t) => 1300 - 600 * Math.min(1, t / DUR);

export function spots(seed, n) {
  const rnd = seededRandom(`aim:${seed}`), out = [];
  let px = W / 2, py = H / 2;
  for (let k = 0; k < n; k++) {
    let x, y;
    do { x = 34 + rnd() * (W - 68); y = TOP + 34 + rnd() * (H - TOP - 68); } while (Math.hypot(x - px, y - py) < 90);  // 바로 옆에 다시 안 나옴
    out.push({ x: Math.round(x), y: Math.round(y) }); px = x; py = y;
  }
  return out;
}
export function newState(seed) {
  return { seed, spots: spots(seed, 400), k: 0, t: 0, born: 0, score: 0, miss: 0, escaped: 0, rts: [], started: false, dead: false, why: "", pops: [] };
}
export const target = (st) => ({ ...st.spots[st.k], r: st.started ? radiusAt(st.born) : 34 });
export function step(st, dt) {
  if (!st.started || st.dead) return null;
  st.t += dt;
  if (st.t >= DUR) { st.t = DUR; st.dead = true; st.why = "time"; return "dead"; }
  if (st.t - st.born > lifeAt(st.born)) { st.escaped++; st.k++; st.born = st.t; return "escape"; }
  return null;
}
export function act(st, a) {
  if (st.dead || a?.type !== "down") return;
  const tg = target(st);
  const hit = Math.hypot(a.x - tg.x, a.y - tg.y) <= tg.r;
  if (!st.started) { if (hit) { st.started = true; st.k++; st.born = 0; } return; }   // 첫 과녁(가운데 '시작')을 누르면 시작
  if (hit) { st.score++; st.rts.push(st.t - st.born); st.pops.push({ x: tg.x, y: tg.y, t: st.t }); st.k++; st.born = st.t; }
  else st.miss++;
}
export const accuracy = (st) => { const n = st.score + st.miss + st.escaped; return n ? Math.round(st.score / n * 100) : 0; };
export const avgRt = (st) => (st.rts.length ? Math.round(st.rts.reduce((a, b) => a + b, 0) / st.rts.length) : 0);
