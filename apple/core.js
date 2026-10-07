// 사과 게임 v2 — 계산(화면 없음). 숫자 사과를 네모로 묶어 합이 10이면 딴다. 2분.
// 지난 판(숨은 사과 ?): guesswhat-web\_옛브랜드_스냅샷_2026-10-06\apple_v1_숨은사과\ — 사용자 "물음표는 사과게임이랑 안 맞는 듯" → 바꿈
// 우리 쪽 차별점(사용자 10-07 선택): ★ 떨어지는 사과 — 사과를 따면 위 사과들이 빈자리로 떨어지고 맨 위에서 새 사과가 채워진다.
//   판이 계속 바뀌어 원작(고정된 판)과 다르고, 판이 막히지 않아 170개 한도 없이 계속 딸 수 있다
//   ① 창을 내리면(롤 큐 잡힘) 시간이 멈춤 ② 같은 판 도전장 ③ 매일 모두 같은 '오늘의 판'
// 공정성: 새 사과는 '줄마다 정해진 순서'로 나온다(판 번호·줄·몇 번째로 결정). 같은 판에 같은 수를 두면 누구에게나 똑같이 떨어짐
import { seededRandom, hashString, todayKey, dayNumber, createStore } from "../shared/kit.js";

export const COLS = 10, ROWS = 17; // 모든 기기 같은 모양(세로 상자). 위→아래로 떨어짐
export const N = COLS * ROWS;
export const TIME = 120; // 초
export const DATE = todayKey();
export const DAY = dayNumber("2026-01-01");
export const store = createStore("apple");

/* 처음 판: 판 번호로 1~9 */
export function makeBoard(seed, rows = ROWS, cols = COLS) {
  const r = seededRandom(`apple:${seed}`);
  return Array.from({ length: rows * cols }, () => 1 + Math.floor(r() * 9));
}
/* 새로 떨어질 사과: (판 번호, 줄, 몇 번째) → 1~9. 순서와 상관없이 같은 값 */
export function nextVal(seed, col, k) {
  return 1 + Math.floor(seededRandom(`apple-fall:${seed}:${col}:${k}`)() * 9);
}
export function newState(seed, rows = ROWS, cols = COLS) {
  return { seed, rows, cols, board: makeBoard(seed, rows, cols), drawn: new Array(cols).fill(0) };
}
export const dailySeed = (day = DAY) => `d${day}`;
export const randomSeed = () => `r${Math.floor(Math.random() * 1e9).toString(36)}`;
export const validSeed = (s) => typeof s === "string" && /^[dr][0-9a-z]{1,12}$/.test(s);

/* 네모 안 칸 번호(행 r, 열 c → r*cols+c) */
export function rectCells(r0, c0, r1, c1, cols = COLS) {
  const out = [];
  const [ra, rb] = [Math.min(r0, r1), Math.max(r0, r1)], [ca, cb] = [Math.min(c0, c1), Math.max(c0, c1)];
  for (let r = ra; r <= rb; r++) for (let c = ca; c <= cb; c++) out.push(r * cols + c);
  return out;
}
export const rectSum = (board, cells) => cells.reduce((s, i) => s + (board[i] || 0), 0);

/* 떨어뜨리기: 빈칸(0)을 지우고 각 줄의 남은 사과를 아래로 모은 뒤, 위 빈칸을 새 사과로 채운다.
 * from[i] = 그 칸 사과가 원래 있던 행(새 사과는 음수: −1 이 바로 위에서 들어온 것) — 화면 떨어지는 움직임용 */
export function settle(st) {
  const { rows, cols, board } = st;
  const from = new Array(rows * cols).fill(0);
  for (let c = 0; c < cols; c++) {
    const keep = [];
    for (let r = rows - 1; r >= 0; r--) if (board[r * cols + c]) keep.push([board[r * cols + c], r]);
    let r = rows - 1;
    for (const [v, r0] of keep) { board[r * cols + c] = v; from[r * cols + c] = r0; r--; }
    let k = 1;
    for (; r >= 0; r--, k++) { board[r * cols + c] = nextVal(st.seed, c, st.drawn[c]++); from[r * cols + c] = -k; }
  }
  return from;
}
/* 합이 정확히 10이면 따고 떨어뜨림 */
export function tryTake(st, cells) {
  if (rectSum(st.board, cells) !== 10) return { ok: false, got: 0 };
  const live = cells.filter((i) => st.board[i] > 0);
  live.forEach((i) => (st.board[i] = 0));
  const from = settle(st);
  return { ok: true, got: live.length, cells: live, from };
}
/* 딸 수 있는 네모가 하나라도 있는지(드물게 막히면 판을 흔들어 새로 채움) */
export function anyMove(board, rows = ROWS, cols = COLS) {
  const S = Array.from({ length: rows + 1 }, () => new Array(cols + 1).fill(0));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) S[r + 1][c + 1] = board[r * cols + c] + S[r][c + 1] + S[r + 1][c] - S[r][c];
  for (let r0 = 0; r0 < rows; r0++) for (let r1 = r0; r1 < rows; r1++) for (let c0 = 0; c0 < cols; c0++) for (let c1 = c0; c1 < cols; c1++) {
    const s = S[r1 + 1][c1 + 1] - S[r0][c1 + 1] - S[r1 + 1][c0] + S[r0][c0];
    if (s === 10) return true;
    if (s > 10) break;
  }
  return false;
}
// 막혔을 때: 판 전체를 비우고 각 줄의 다음 순서 사과로 다시 채움(같은 판이면 같은 결과)
export function shake(st) { st.board.fill(0); return settle(st); }

/* 기록(이 기기에만): 최고 점수, 오늘의 판 점수 */
export const best = () => store.get("best", 0);
export function record(seed, score) {
  if (score > best()) store.set("best", score);
  if (seed === dailySeed()) { const prev = store.get(`d:${DAY}`, null); if (prev == null || score > prev) store.set(`d:${DAY}`, score); }
}
export const todayScore = () => store.get(`d:${DAY}`, null);

export function shareText(seed, score, rival) {
  const kind = seed === dailySeed() ? `오늘의 판 #${DAY}` : "같은 판 도전";
  const vs = rival != null ? (score > rival ? ` · 도전장 ${rival}개 넘음` : score === rival ? ` · 도전장 ${rival}개와 동점` : ` · 도전장 ${rival}개에 ${rival - score}개 모자람`) : "";
  return `Guess What · 사과 게임 (${kind})\n🍎 2분에 ${score}개${vs}\n같은 판으로 이겨 봐`;
}
export { hashString };
