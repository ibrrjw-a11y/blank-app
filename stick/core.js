// 막대 다리 — 계산(화면 없음). 원작: 스틱 히어로류. 꾹 누르는 동안 막대가 자라고, 떼면 앞으로 넘어져 다리가 된다
// 막대 끝이 다음 기둥 위에 닿으면 건너감(+1), 기둥 가운데 빨간 점에 닿으면 +1 더. 짧거나 길면 떨어져 끝
// 갈수록 기둥이 좁아지고(70 → 22px) 간격이 넓어짐
import { seededRandom } from "../shared/kit.js";

export const W = 360, H = 560, TOP = 380, HERO_X = 90, GROW = 340, FALL_MS = 260, WALK = 420, DOT = 5;

export function platforms(seed, n) {
  const rnd = seededRandom(`stick:${seed}`), out = [{ x: 0, w: 96 }];
  for (let k = 1; k < n; k++) {
    const prev = out[k - 1];
    const gap = Math.round(36 + rnd() * Math.min(200, 80 + k * 6));
    const w = Math.round(Math.max(18, Math.max(22, 70 - k * 1.6) * (0.6 + rnd() * 0.6)));
    out.push({ x: prev.x + prev.w + gap, w });
  }
  return out;
}
export function newState(seed) {
  const pf = platforms(seed, 2000);
  return { seed, pf, cur: 0, mode: "idle", len: 0, ang: 0, hx: pf[0].w - 8, hy: 0, cam: pf[0].w - HERO_X, score: 0, perfect: 0, started: false, dead: false, why: "", land: null, t: 0 };
}
// 막대 끝이 어디에 닿았나: "perfect"·"ok"·"short"·"long"
export function judgeStick(pf, cur, len) {
  const base = pf[cur].x + pf[cur].w, end = base + len, nx = pf[cur + 1];
  if (end < nx.x) return "short";
  if (end > nx.x + nx.w) return "long";
  return Math.abs(end - (nx.x + nx.w / 2)) <= DOT ? "perfect" : "ok";
}
export function act(st, a) {
  if (st.dead) return;
  const down = a === "hold" || a?.type === "down", up = a === "hold:up" || a?.type === "up";
  if (down && st.mode === "idle") { st.mode = "grow"; st.len = 0; st.started = true; }
  else if (up && st.mode === "grow") { st.mode = "fall"; st.ang = 0; }
}
export function step(st, dt) {
  st.t += dt;
  const pf = st.pf, s = dt / 1000;
  const camGoal = pf[st.cur].x + pf[st.cur].w - HERO_X;
  st.cam += (camGoal - st.cam) * Math.min(1, s * 8);
  if (st.dead) return null;
  if (st.mode === "grow") st.len = Math.min(H, st.len + GROW * s);
  else if (st.mode === "fall") {
    st.ang = Math.min(90, st.ang + 90 * dt / FALL_MS);
    if (st.ang >= 90) {
      st.land = judgeStick(pf, st.cur, st.len);
      const base = pf[st.cur].x + pf[st.cur].w;
      st.goal = st.land === "short" || st.land === "long" ? base + st.len : pf[st.cur + 1].x + pf[st.cur + 1].w - 8;
      st.mode = "walk";
    }
  } else if (st.mode === "walk") {
    st.hx = Math.min(st.goal, st.hx + WALK * s);
    if (st.hx >= st.goal) {
      if (st.land === "short" || st.land === "long") { st.mode = "drop"; st.vy = 0; return null; }
      st.cur++; st.score += st.land === "perfect" ? 2 : 1; if (st.land === "perfect") st.perfect++;
      st.mode = "idle"; st.len = 0; st.ang = 0;
      return st.land;
    }
  } else if (st.mode === "drop") {
    st.vy += 2400 * s; st.hy += st.vy * s;
    if (st.hy > H - TOP + 40) { st.dead = true; st.why = st.land; return "dead"; }
  }
  return null;
}
