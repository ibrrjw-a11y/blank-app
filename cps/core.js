// 클릭 속도(CPS) — 계산(화면 없음). 첫 클릭부터 10초 동안 몇 번 누르나. 1초 구간별 횟수도 기록
export const W = 360, H = 560, DUR = 10000;
export function newState(seed) { return { seed, t: 0, score: 0, per: new Array(10).fill(0), started: false, dead: false, why: "", taps: [] }; }
export function step(st, dt) {
  if (!st.started || st.dead) return null;
  st.t += dt;
  if (st.t >= DUR) { st.t = DUR; st.dead = true; st.why = "time"; return "dead"; }
  return null;
}
export function act(st, a) {
  if (st.dead || (a !== "tap" && a?.type !== "down")) return;
  st.started = true;
  st.score++; st.per[Math.min(9, Math.floor(st.t / 1000))]++;
  st.taps.push({ t: st.t, x: a?.x ?? W / 2, y: a?.y ?? H / 2 });
}
export const cps = (st) => Math.round(st.score / (DUR / 1000) * 10) / 10;
export const bestSec = (st) => Math.max(...st.per);
