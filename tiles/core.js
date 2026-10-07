// 검은 건반 — 계산(화면 없음). 원작: 피아노 타일류. 네 줄 중 한 칸씩 내려오는 검은 칸만 아래부터 차례로 누른다
// 끝나는 경우: 흰 칸을 누름 / 검은 칸을 못 누르고 화면 밑으로 놓침. 누를수록 빨라짐
// 우리 쪽 더함(2026-10-07): 같은 판 = 같은 건반 순서 → 도전장·오늘의 판 / 다른 창으로 넘어가면 멈춤
import { seededRandom, todayKey, dayNumber, createStore } from "../shared/kit.js";

export const COLS = 4, VIS = 4; // 네 줄 · 화면에 네 칸 높이
export const DATE = todayKey();
export const DAY = dayNumber("2026-01-01");
export const store = createStore("tiles");
export const dailySeed = (day = DAY) => `d${day}`;
export const randomSeed = () => `r${Math.floor(Math.random() * 1e9).toString(36)}`;
export const validSeed = (s) => typeof s === "string" && /^[dr][0-9a-z]{1,12}$/.test(s);

// k번째 건반이 몇째 줄인지. 같은 줄이 세 번 연속은 안 나옴
export function columns(seed, n) {
  const rnd = seededRandom(`tiles:${seed}`), out = [];
  for (let k = 0; k < n; k++) {
    let c;
    do c = Math.floor(rnd() * COLS); while (k >= 2 && c === out[k - 1] && c === out[k - 2]);
    out.push(c);
  }
  return out;
}
// 빠르기(초당 칸 수): 처음 3.2칸 → 건반 하나마다 +0.045, 최대 10칸
export const speedAt = (score) => Math.min(10, 3.2 + score * 0.045);

// p = 지금까지 내려온 칸 수. k번째 줄의 화면 높이(아래에서 몇 칸) = k − p
export function newState(seed) { return { seed, cols: columns(seed, 6000), p: 0, score: 0, started: false, dead: false, why: "", bad: null }; }
export function step(st, dtMs) {
  if (st.dead || !st.started) return;
  st.p += speedAt(st.score) * dtMs / 1000;
  if (st.p >= st.score + 1) { st.dead = true; st.why = "miss"; st.bad = { k: st.score, c: st.cols[st.score] }; }
}
// 누르기: col 줄의 화면 높이 h(아래에서 칸 단위, 0~VIS) 자리. 차례 건반이면 +1, 흰 칸이면 끝, 지나간 줄·앞줄 검은 칸은 무시
export function tap(st, col, h) {
  if (st.dead) return null;
  const k = Math.floor(st.p + h);
  if (k < st.score) return { ignored: true };
  if (st.cols[k] === col) {
    if (k !== st.score) return { ignored: true };
    st.score++; st.started = true; return { ok: true, k };
  }
  st.dead = true; st.why = "white"; st.bad = { k, c: col };
  return { ok: false, k };
}
// 키보드: 지금 차례 줄에서 col 을 누른 것으로 봄. 아직 화면 위에 안 보이는 줄이면 무시(외워서 미리 누르기 막음)
export const tapNext = (st, col) => (st.score - st.p >= VIS - 0.25 ? { ignored: true } : tap(st, col, st.score - st.p + 0.5));

export const best = () => store.get("best", 0);
export function record(seed, score) {
  if (score > best()) store.set("best", score);
  if (seed === dailySeed()) { const prev = store.get(`d:${DAY}`, null); if (prev == null || score > prev) store.set(`d:${DAY}`, score); }
}
export const todayScore = () => store.get(`d:${DAY}`, null);
export function shareText(seed, score, rival) {
  const kind = seed === dailySeed() ? `오늘의 건반 #${DAY}` : "같은 건반 도전";
  const vs = rival != null ? (score > rival ? ` · 도전장 ${rival}개 넘음` : score === rival ? ` · 도전장 ${rival}개와 동점` : ` · 도전장 ${rival}개에 ${rival - score}개 모자람`) : "";
  return `Guess What · 검은 건반 (${kind})\n🎹 ${score}개 눌렀어요${vs}\n같은 건반으로 이겨 봐`;
}
