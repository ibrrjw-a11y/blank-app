// 사과 게임 — 계산(화면 없음). 숫자 사과를 네모로 묶어 합이 10이면 딴다. 2분.
// 우리 쪽 차별점(사용자 10-07 "그대로 구현하지 말고 차별성"):
//   ★ 숨은 사과: 열에 하나쯤 숫자가 '?'로 가려지고 색으로만 힌트(초록 1~3 · 노랑 4~6 · 주황 7~9). 넣어서 맞히면 하나에 +2점, 틀리면 숫자가 드러나고 3초 잃음 — 'Guess What' 순간
//   ① 창을 내리면(롤 큐 잡힘) 시간이 멈춤 ② 같은 판 도전장(판 번호를 링크로) ③ 매일 모두 같은 '오늘의 판'
import { seededRandom, todayKey, dayNumber, createStore } from "../shared/kit.js";

export const COLS = 17, ROWS = 10; // 가로 화면 기준. 세로 화면은 가로세로만 바꿔 같은 판(사과 170개)
export const N = COLS * ROWS;
export const TIME = 120; // 초
export const HIDDEN_RATE = 0.12; // 숨은 사과 비율
export const BONUS = 2; // 숨은 사과 맞히면 하나에 더 주는 점수
export const PENALTY = 3; // 숨은 사과 넣고 틀리면 잃는 초
export const tierOf = (v) => (v <= 3 ? 0 : v <= 6 ? 1 : 2); // 색 힌트
export const DATE = todayKey();
export const DAY = dayNumber("2026-01-01");
export const store = createStore("apple");

/* 판 만들기: 판 번호(시드)로 1~9 를 채우고, 전체 합이 10의 배수가 되게 마지막 칸을 맞춘다(원래 게임과 같은 성질) */
export function makeBoard(seed) {
  const r = seededRandom(`apple:${seed}`);
  const b = Array.from({ length: N }, () => 1 + Math.floor(r() * 9));
  const rest = b.reduce((s, v) => s + v, 0) % 10;
  if (rest) {
    // 합을 10의 배수로: 뒤에서부터 빼도 1 이상 남는 칸을 고쳐 나머지를 없앤다
    let need = rest;
    for (let i = N - 1; i >= 0 && need; i--) { const d = Math.min(need, b[i] - 1); b[i] -= d; need -= d; }
  }
  return b;
}
// 숨은 사과 자리: 판 번호로 정해짐(같은 판이면 같은 자리)
export function makeHidden(seed) {
  const r = seededRandom(`apple-h:${seed}`);
  return Array.from({ length: N }, () => r() < HIDDEN_RATE);
}
export const dailySeed = (day = DAY) => `d${day}`;
export const randomSeed = () => `r${Math.floor(Math.random() * 1e9).toString(36)}`;
export const validSeed = (s) => typeof s === "string" && /^[dr][0-9a-z]{1,12}$/.test(s);

/* 네모 안 합 · 딸 수 있는지. 칸 번호는 '가로 화면' 기준(행 r, 열 c → r*COLS+c) */
export function rectCells(r0, c0, r1, c1) {
  const out = [];
  const [ra, rb] = [Math.min(r0, r1), Math.max(r0, r1)], [ca, cb] = [Math.min(c0, c1), Math.max(c0, c1)];
  for (let r = ra; r <= rb; r++) for (let c = ca; c <= cb; c++) out.push(r * COLS + c);
  return out;
}
export function rectSum(board, cells) { return cells.reduce((s, i) => s + (board[i] || 0), 0); }
// 딴 칸은 0. 합이 정확히 10이면 그 안의 남은 사과 수만큼 점수 + 숨은 사과 하나에 BONUS
// 숨은 사과가 든 네모가 틀리면: 숨은 사과 숫자가 드러나고(hidden=false) PENALTY 초를 잃음
export function tryTake(board, cells, hidden = null) {
  const live = cells.filter((i) => board[i] > 0);
  const hid = hidden ? live.filter((i) => hidden[i]) : [];
  if (!live.length) return { ok: false, got: 0, points: 0 };
  if (rectSum(board, cells) !== 10) {
    if (hid.length) { hid.forEach((i) => (hidden[i] = false)); return { ok: false, got: 0, points: 0, revealed: hid, penalty: PENALTY }; }
    return { ok: false, got: 0, points: 0 };
  }
  live.forEach((i) => { board[i] = 0; if (hidden) hidden[i] = false; });
  return { ok: true, got: live.length, hiddenHit: hid.length, points: live.length + BONUS * hid.length, cells: live, hid };
}
// 화면에 보여 줄 합계: 보이는 숫자 합 + 숨은 사과 수(예: '6+?')
export function visibleSum(board, cells, hidden) {
  let known = 0, q = 0;
  cells.forEach((i) => { if (!board[i]) return; if (hidden && hidden[i]) q++; else known += board[i]; });
  return { known, q };
}
// 아직 딸 수 있는 네모가 하나라도 있는지(판이 막혔는지 알림용). 넓이 순으로 훑음
export function anyMove(board) {
  const at = (r, c) => board[r * COLS + c];
  // 2차원 누적합으로 빠르게
  const S = Array.from({ length: ROWS + 1 }, () => new Array(COLS + 1).fill(0));
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) S[r + 1][c + 1] = at(r, c) + S[r][c + 1] + S[r + 1][c] - S[r][c];
  for (let r0 = 0; r0 < ROWS; r0++) for (let r1 = r0; r1 < ROWS; r1++) for (let c0 = 0; c0 < COLS; c0++) for (let c1 = c0; c1 < COLS; c1++) {
    const s = S[r1 + 1][c1 + 1] - S[r0][c1 + 1] - S[r1 + 1][c0] + S[r0][c0];
    if (s === 10) return true;
    if (s > 10) break;
  }
  return false;
}

/* 기록(이 기기에만): 최고 점수, 오늘의 판 점수 */
export const best = () => store.get("best", 0);
export function record(seed, score) {
  if (score > best()) store.set("best", score);
  if (seed === dailySeed()) { const prev = store.get(`d:${DAY}`, null); if (prev == null || score > prev) store.set(`d:${DAY}`, score); }
}
export const todayScore = () => store.get(`d:${DAY}`, null);

export function shareText(seed, score, apples, hiddenHit, rival) {
  const kind = seed === dailySeed() ? `오늘의 판 #${DAY}` : "같은 판 도전";
  const vs = rival != null ? (score > rival ? ` · 도전장 ${rival}점 넘음` : score === rival ? ` · 도전장 ${rival}점과 동점` : ` · 도전장 ${rival}점에 ${rival - score}점 모자람`) : "";
  return `Guess What · 사과 게임 (${kind})\n${score}점 · 🍎 ${apples}개 · 숨은 사과 ${hiddenHit}개 맞힘${vs}\n같은 판으로 이겨 봐`;
}
