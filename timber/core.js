// 나무꾼 — 계산(화면 없음). 원작: 팀버맨류. 나무 왼쪽·오른쪽을 번갈아 찍으며 가지를 피한다
// 규칙: 찍으면 나무가 한 칸 내려옴. 내 쪽 맨 아래 칸에 가지가 오면 끝. 시간 막대는 계속 줄고, 찍을 때마다 조금 참. 점수가 오를수록 빨리 줆
// 우리 쪽 더함(2026-10-07): 같은 판 = 같은 나무(가지 순서) → 도전장·오늘의 판 공정 / 다른 창으로 넘어가면 멈춤
import { seededRandom, todayKey, dayNumber, createStore } from "../shared/kit.js";

export const DATE = todayKey();
export const DAY = dayNumber("2026-01-01");
export const store = createStore("timber");
export const SEEN = 7; // 화면에 보이는 나무 칸 수

export const dailySeed = (day = DAY) => `d${day}`;
export const randomSeed = () => `r${Math.floor(Math.random() * 1e9).toString(36)}`;
export const validSeed = (s) => typeof s === "string" && /^[dr][0-9a-z]{1,12}$/.test(s);

/* 가지 순서: k번째 칸의 가지("L"·"R"·"")를 판 번호로 정함. 처음 3칸은 비움, 가지 바로 위 칸은 비움(원작과 같이 늘 빠져나갈 길이 있음) */
export function branches(seed, n) {
  const rnd = seededRandom(`timber:${seed}`), out = [];
  for (let k = 0; k < n; k++) {
    if (k < 3 || out[k - 1]) { out.push(""); continue; }
    const r = rnd();
    out.push(r < 0.36 ? "L" : r < 0.72 ? "R" : "");
  }
  return out;
}
// 시간: 1초에 줄어드는 양은 점수가 오를수록 커짐(0.22 → 0.6), 한 번 찍을 때마다 0.07 참
export const drainAt = (score) => Math.min(0.6, 0.22 + score * 0.0035);
export const GAIN = 0.07;

export function newState(seed) {
  return { seed, tree: branches(seed, 4000), base: 0, side: "L", score: 0, time: 0.6, dead: false, why: "" };
}
export const at = (st, k) => st.tree[st.base + k] || ""; // 지금 아래에서 k번째 칸 가지
// 찍기: side 쪽으로 서서 찍음. 서는 자리에 가지가 있거나, 찍은 뒤 내려온 칸에 가지가 내 쪽이면 끝
export function chop(st, side) {
  if (st.dead) return null;
  st.side = side;
  if (at(st, 0) === side) { st.dead = true; st.why = "branch"; return { ok: false }; }
  st.base++; st.score++;
  st.time = Math.min(1, st.time + GAIN);
  if (at(st, 0) === side) { st.dead = true; st.why = "branch"; return { ok: false, chopped: true }; }
  return { ok: true };
}
export function tick(st, dtMs) {
  if (st.dead) return;
  st.time -= drainAt(st.score) * dtMs / 1000;
  if (st.time <= 0) { st.time = 0; st.dead = true; st.why = "time"; }
}

export const best = () => store.get("best", 0);
export function record(seed, score) {
  if (score > best()) store.set("best", score);
  if (seed === dailySeed()) { const prev = store.get(`d:${DAY}`, null); if (prev == null || score > prev) store.set(`d:${DAY}`, score); }
}
export const todayScore = () => store.get(`d:${DAY}`, null);
export function shareText(seed, score, rival) {
  const kind = seed === dailySeed() ? `오늘의 나무 #${DAY}` : "같은 나무 도전";
  const vs = rival != null ? (score > rival ? ` · 도전장 ${rival}번 넘음` : score === rival ? ` · 도전장 ${rival}번과 동점` : ` · 도전장 ${rival}번에 ${rival - score}번 모자람`) : "";
  return `Guess What · 나무꾼 (${kind})\n🪓 ${score}번 찍음${vs}\n같은 나무로 이겨 봐`;
}
