// 칼 꽂기 — 계산(화면 없음). 원작: 나이프 히트류. 돌아가는 통나무에 칼을 던져 꽂는다. 이미 꽂힌 칼에 맞으면 끝
// 단계마다 칼 수·미리 꽂힌 칼·도는 방식(빨라졌다 멈칫·거꾸로)이 어려워짐. 다섯 번째 단계마다 '단단한 통나무'(작고 빠름)
// 우리 쪽 더함(2026-10-07): 같은 판 = 단계마다 같은 회전·같은 칼 자리 → 도전장·오늘의 판 / 다른 창으로 넘어가면 멈춤
import { seededRandom, todayKey, dayNumber, createStore } from "../shared/kit.js";

export const DATE = todayKey();
export const DAY = dayNumber("2026-01-01");
export const store = createStore("knife");
export const FLY = 90;     // 칼이 날아가 닿는 데 걸리는 시간(ms)
export const GAP = 0.2;    // 칼끼리 이만큼(라디안, 약 11.5°)보다 가까우면 부딪힘
export const WAIT = 650;   // 단계를 깬 뒤 다음 통나무까지 쉬는 시간(ms)
const TAU = Math.PI * 2;
export const norm = (x) => ((x % TAU) + TAU) % TAU;
export const dist = (x, y) => { const d = Math.abs(norm(x) - norm(y)); return Math.min(d, TAU - d); };

export const dailySeed = (day = DAY) => `d${day}`;
export const randomSeed = () => `r${Math.floor(Math.random() * 1e9).toString(36)}`;
export const validSeed = (s) => typeof s === "string" && /^[dr][0-9a-z]{1,12}$/.test(s);
export const isBoss = (s) => s % 5 === 4;

/* 단계 s 의 모양: 던질 칼 수, 미리 꽂힌 칼 자리, 회전(구간마다 [길이 ms, 초당 라디안]) */
export function stageOf(seed, s) {
  const rnd = seededRandom(`knife:${seed}:${s}`);
  const knives = 6 + Math.min(s, 6) + (isBoss(s) ? 2 : 0);
  const pre = [];
  const want = s === 0 ? 0 : Math.min(1 + Math.floor(s / 2), 5);
  for (let tries = 0; pre.length < want && tries < 200; tries++) {
    const a = rnd() * TAU;
    if (pre.every((p) => dist(p, a) > GAP * 2.5)) pre.push(a);
  }
  const segs = [];
  if (s === 0) segs.push([4000, 2.3]);
  else {
    const top = Math.min(5.2, 2.4 + s * 0.28) * (isBoss(s) ? 1.25 : 1);
    for (let k = 0; k < 8; k++) {
      const dir = s >= 2 && rnd() < 0.35 ? -1 : 1;
      const stop = s >= 3 && rnd() < 0.18;
      segs.push([Math.round(500 + rnd() * 1300), stop ? dir * 0.25 : dir * (top * (0.55 + rnd() * 0.45))]);
    }
  }
  return { s, knives, pre, segs, boss: isBoss(s) };
}
// 단계 시작 후 t ms 의 통나무 각도(구간을 한 바퀴 돌면 처음부터 반복)
export function angleAt(stage, t) {
  const total = stage.segs.reduce((x, [d]) => x + d, 0);
  const full = stage.segs.reduce((x, [d, w]) => x + d * w, 0) / 1000;
  let a = Math.floor(t / total) * full, r = t % total;
  for (const [d, w] of stage.segs) { const u = Math.min(r, d); a += u * w / 1000; r -= u; if (r <= 0) break; }
  return a;
}
// 칼은 아래(화면 각도 π/2)에서 올라와 꽂힘 → 통나무 위의 자리 = π/2 − 통나무 각도
export const landSpot = (a) => norm(Math.PI / 2 - a);

export function newState(seed) {
  const st = { seed, stage: null, s: 0, t: 0, left: 0, stuck: [], fly: null, score: 0, dead: false, wait: 0, hitAt: null };
  enter(st, 0); return st;
}
function enter(st, s) {
  st.s = s; st.stage = stageOf(st.seed, s); st.t = 0; st.left = st.stage.knives; st.stuck = st.stage.pre.map((a) => ({ a, pre: true })); st.fly = null;
}
export function throwKnife(st) {
  if (st.dead || st.fly || st.wait > 0 || st.left <= 0) return false;
  st.fly = { t: st.t }; st.left--; return true;
}
// dt 만큼 진행. 반환: 이번에 생긴 일("stick"·"hit"·"clear"·null)
export function step(st, dtMs) {
  if (st.dead) return null;
  if (st.wait > 0) { st.wait -= dtMs; if (st.wait <= 0) { st.wait = 0; enter(st, st.s + 1); return "next"; } return null; }
  st.t += dtMs;
  if (st.fly && st.t - st.fly.t >= FLY) {
    const spot = landSpot(angleAt(st.stage, st.fly.t + FLY));
    st.fly = null;
    if (st.stuck.some((k) => dist(k.a, spot) < GAP)) { st.dead = true; st.hitAt = spot; return "hit"; }
    st.stuck.push({ a: spot }); st.score++;
    if (st.left === 0) { st.wait = WAIT; return "clear"; }
    return "stick";
  }
  return null;
}

export const best = () => store.get("best", { score: 0, stage: 0 });
export function record(seed, score, stage) {
  const b = best(); if (score > b.score) store.set("best", { score, stage });
  if (seed === dailySeed()) { const prev = store.get(`d:${DAY}`, null); if (prev == null || score > prev.score) store.set(`d:${DAY}`, { score, stage }); }
}
export const todayScore = () => store.get(`d:${DAY}`, null);
export function shareText(seed, st, rival) {
  const kind = seed === dailySeed() ? `오늘의 통나무 #${DAY}` : "같은 통나무 도전";
  const vs = rival != null ? (st.score > rival ? ` · 도전장 ${rival}개 넘음` : st.score === rival ? ` · 도전장 ${rival}개와 동점` : ` · 도전장 ${rival}개에 ${rival - st.score}개 모자람`) : "";
  return `Guess What · 칼 꽂기 (${kind})\n🔪 ${st.s + 1}단계 · 칼 ${st.score}개${vs}\n같은 통나무로 이겨 봐`;
}
