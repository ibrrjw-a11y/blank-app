// 어림짐작 — 계산 부분(화면 없음). 오늘 문제 고르기 · 자 눈금 변환 · 점수 · 공유 글
// 차용: 지락실 '오늘의 10문제'(매일 자정 모두 같은 문제·지난 회차). 차별점: 보기 대신 '범위'를 걸고, 좁힐수록 점수가 커진다(확신까지 맞히기)
import { seededRandom, shuffle, todayKey, dayNumber, createStore } from "../shared/kit.js";
import { BANK } from "./bank.js";

export const EPOCH = "2026-01-01"; // 딴짓·오늘의 Guess 와 같은 회차 번호
export const N = 5;
export const DATE = todayKey();
export const DAY = dayNumber(EPOCH);
export const store = createStore("eorim");

/* ---------- 오늘의 문제: 모두 같은 5문제. 은행을 한 바퀴 돌 때까지 겹치지 않음 ---------- */
export function pickSet(day = DAY, bank = BANK) {
  const per = Math.floor(bank.length / N);
  const cycle = Math.floor((day - 1) / per);
  const k = (((day - 1) % per) + per) % per;
  const order = shuffle(bank.map((_, i) => i), seededRandom(`eorim:cycle${cycle}`));
  return order.slice(k * N, k * N + N).map((i) => bank[i]);
}

/* ---------- 자 눈금: 값 ↔ 0~1 위치 ---------- */
export function toT(q, v) {
  if (q.scale === "log") return (Math.log(v) - Math.log(q.lo)) / (Math.log(q.hi) - Math.log(q.lo));
  return (v - q.lo) / (q.hi - q.lo);
}
export function fromT(q, t) {
  t = Math.min(1, Math.max(0, t));
  const v = q.scale === "log" ? Math.exp(Math.log(q.lo) + t * (Math.log(q.hi) - Math.log(q.lo))) : q.lo + t * (q.hi - q.lo);
  return snap(q, v);
}
export function snap(q, v) {
  const s = q.step || 1;
  // 큰 수(로그 자)는 앞 세 자리만 남겨 손으로 맞추기 쉽게
  let out = Math.round(v / s) * s;
  if (q.scale === "log" && out >= 1000) { const p = Math.pow(10, Math.floor(Math.log10(out)) - 2); out = Math.round(out / p) * p; }
  out = Math.min(q.hi, Math.max(q.lo, out));
  const dec = decimals(s);
  return Number(out.toFixed(dec));
}
const decimals = (s) => (String(s).split(".")[1] || "").length;

/* ---------- 점수 ----------
 * 범위 안에 정답이 있으면: 100 × (1 − √폭비율). 폭비율 = 자 전체에서 내가 집은 폭(로그 자는 로그 폭). 딱 한 점으로 맞히면 100, 자 전체를 집으면 최저 10.
 * 빗나가면 0. √ 를 쓰는 건 '반만 좁혀도 점수가 확 오르게' — 좁히는 재미를 위해 */
export const EPS = 1e-9;
export function widthRatio(q, a, b) { return Math.max(0, toT(q, Math.max(a, b)) - toT(q, Math.min(a, b))); }
// 공인된 다른 값(alt: 측량 기준이 다른 높이 등)도 정답으로 받는다 — 점검에서 기준끼리 1~6m 갈리는 문제가 나왔음
export function isHit(q, a, b) {
  const lo = Math.min(a, b) - EPS, hi = Math.max(a, b) + EPS;
  return [q.ans, ...(q.alt || [])].some((v) => v >= lo && v <= hi);
}
export function potential(q, a, b) { return Math.max(10, Math.round(100 * (1 - Math.sqrt(widthRatio(q, a, b))))); }
export function score(q, a, b) { return isHit(q, a, b) ? potential(q, a, b) : 0; }

/* ---------- 결과 읽기: 점수 말고 '내 확신이 믿을 만한가' ----------
 * 좁게 건 판 = 자 전체의 10% 이하로 집은 판. 그중 몇 개를 맞혔는지가 핵심 문장 */
export const NARROW = 0.1;
export function readout(set, bets) {
  const rows = set.map((q, i) => {
    const { a, b } = bets[i];
    const r = widthRatio(q, a, b);
    return { hit: isHit(q, a, b), narrow: r <= NARROW, pts: score(q, a, b), r };
  });
  const total = rows.reduce((s, x) => s + x.pts, 0);
  const hits = rows.filter((x) => x.hit).length;
  const nar = rows.filter((x) => x.narrow);
  const narHit = nar.filter((x) => x.hit).length;
  let line;
  if (!nar.length) line = hits >= 4 ? "넉넉하게 잡고 거의 다 챙겼어요. 다음엔 아는 문제부터 좁혀 보세요." : "전부 넉넉하게 잡았어요. 확실한 것 하나만 좁혀도 점수가 크게 올라요.";
  else if (narHit === nar.length) line = `좁게 건 ${nar.length}문제를 전부 맞혔어요. 자신 있을 때의 감은 믿어도 돼요.`;
  else if (narHit === 0) line = `좁게 건 ${nar.length}문제가 전부 빗나갔어요. 확신이 실력보다 앞선 날이에요.`;
  else line = `좁게 건 ${nar.length}문제 중 ${narHit}개를 맞혔어요.`;
  return { rows, total, hits, narrow: nar.length, narrowHit: narHit, line };
}

export function mark(row) { return row.hit ? (row.narrow ? "🎯" : "⭕") : "❌"; }
export function shareText(day, rd, practice = false) {
  return `Guess What · 어림짐작 제${day}회${practice ? " (연습)" : ""}\n${rd.rows.map(mark).join("")} ${rd.total}점 / ${N * 100}\n🎯 좁게 맞힘 · ⭕ 넉넉히 맞힘 · ❌ 빗나감`;
}

/* ---------- 숫자 표시 ---------- */
export function fmtVal(q, v) {
  if (q.unit === "년") return String(Math.round(v));
  const dec = decimals(q.step || 1);
  return Number(v).toLocaleString("ko-KR", { minimumFractionDigits: 0, maximumFractionDigits: dec });
}

/* ---------- 기록(이 기기에만) ---------- */
export const loadDay = (day = DAY) => store.get(`d:${day}`, null);
export const saveDay = (s, day = DAY) => store.set(`d:${day}`, s);
export function recordDay(total) {
  const days = store.get("days", []);
  if (!days.includes(DAY)) { days.push(DAY); store.set("days", days.slice(-400)); }
  const best = store.get("best", 0);
  if (total > best) store.set("best", total);
}
export function streak() {
  const days = new Set(store.get("days", []));
  let d = days.has(DAY) ? DAY : DAY - 1, n = 0;
  while (days.has(d)) { n++; d--; }
  return { streak: n, total: days.size, best: store.get("best", 0) };
}
