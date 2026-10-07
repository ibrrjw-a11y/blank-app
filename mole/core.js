// 규칙 두더지 — 계산(화면 없음). 숫자 두더지가 튀어나오면 '지금 규칙'에 맞는 것만 친다
// 우리 쪽 차별점(2026-10-07): 10초마다 규칙이 바뀜(짝수만 → 3의 배수만 → …). 손이 먼저 나가면 틀림
//  ① 같은 판 = 누구에게나 같은 두더지(언제·어느 구멍·무슨 숫자)와 같은 규칙 순서 → 도전장·오늘의 판 공정
//  ② 판정은 '친 순간'의 규칙으로. 바뀌기 직전에 나온 두더지를 바뀐 뒤에 치면 새 규칙으로 따짐
import { seededRandom, shuffle, todayKey, dayNumber, createStore } from "../shared/kit.js";

export const DUR = 60000, SEG = 10000, HOLES = 9;
export const DATE = todayKey();
export const DAY = dayNumber("2026-01-01");
export const store = createStore("mole");

export const RULES = [
  { id: "even", name: "짝수만", ok: (v) => v % 2 === 0 },
  { id: "odd", name: "홀수만", ok: (v) => v % 2 === 1 },
  { id: "m3", name: "3의 배수만", ok: (v) => v % 3 === 0 },
  { id: "gt5", name: "5보다 큰 수만", ok: (v) => v > 5 },
  { id: "lt5", name: "5보다 작은 수만", ok: (v) => v < 5 },
  { id: "mid", name: "3부터 6까지만", ok: (v) => v >= 3 && v <= 6 },
  { id: "no7", name: "7만 빼고 다", ok: (v) => v !== 7 },
];
export const ruleById = (id) => RULES.find((r) => r.id === id);
const VALS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export const dailySeed = (day = DAY) => `d${day}`;
export const randomSeed = () => `r${Math.floor(Math.random() * 1e9).toString(36)}`;
export const validSeed = (s) => typeof s === "string" && /^[dr][0-9a-z]{1,12}$/.test(s);

/* 판 만들기: 규칙 순서 6개 + 두더지 목록 [{ i, at, end, h, v }]. 판 번호만으로 정해짐(누가 치든 안 바뀜) */
export function makeBoard(seed) {
  const rnd = seededRandom(`mole:${seed}`);
  const rules = shuffle(RULES.map((r) => r.id), rnd).slice(0, DUR / SEG);
  const pops = [], free = new Array(HOLES).fill(0);
  let t = 700;
  while (t < DUR - 400) {
    const k = t / DUR;
    const life = Math.round(1250 - 450 * k);              // 처음 1.25초 → 끝 0.8초 동안 나와 있음
    const gap = Math.round(720 - 320 * k + (rnd() - 0.5) * 160); // 나오는 간격도 점점 짧아짐
    const open = [...Array(HOLES).keys()].filter((h) => free[h] <= t);
    if (open.length) {
      const h = open[Math.floor(rnd() * open.length)];
      const rule = ruleById(rules[Math.floor(t / SEG)]);
      const match = rnd() < 0.55;
      const pool = VALS.filter((v) => rule.ok(v) === match);
      const v = pool[Math.floor(rnd() * pool.length)];
      pops.push({ i: pops.length, at: t, end: t + life, h, v });
      free[h] = t + life + 150;
    }
    t += Math.max(260, gap);
  }
  return { seed, rules, pops };
}
export const ruleAt = (board, t) => ruleById(board.rules[Math.min(board.rules.length - 1, Math.floor(Math.max(0, t) / SEG))]);

export function newState(seed) {
  return { board: makeBoard(seed), t: 0, score: 0, good: 0, bad: 0, combo: 0, maxCombo: 0, hit: {} };
}
// t 시각에 구멍 h 에 나와 있는(아직 안 맞은) 두더지
export function moleAt(st, h, t = st.t) {
  return st.board.pops.find((p) => p.h === h && p.at <= t && t < p.end && !st.hit[p.i]) || null;
}
// 구멍 h 를 침. 맞는 두더지면 +1(연속 맞힘 쌓임), 규칙에 안 맞으면 −1(0 아래로는 안 감)·연속 끊김. 빈 구멍은 아무 일 없음
export function whack(st, h) {
  const p = moleAt(st, h);
  if (!p) return null;
  st.hit[p.i] = true;
  const ok = ruleAt(st.board, st.t).ok(p.v);
  if (ok) { st.score++; st.good++; st.combo++; st.maxCombo = Math.max(st.maxCombo, st.combo); }
  else { st.score = Math.max(0, st.score - 1); st.bad++; st.combo = 0; }
  return { pop: p, ok };
}

/* 기록(이 기기에만): 최고 점수, 오늘의 판 점수 */
export const best = () => store.get("best", 0);
export function record(seed, score) {
  if (score > best()) store.set("best", score);
  if (seed === dailySeed()) { const prev = store.get(`d:${DAY}`, null); if (prev == null || score > prev) store.set(`d:${DAY}`, score); }
}
export const todayScore = () => store.get(`d:${DAY}`, null);

export function shareText(seed, st, rival) {
  const kind = seed === dailySeed() ? `오늘의 판 #${DAY}` : "같은 판 도전";
  const vs = rival != null ? (st.score > rival ? ` · 도전장 ${rival}점 넘음` : st.score === rival ? ` · 도전장 ${rival}점과 동점` : ` · 도전장 ${rival}점에 ${rival - st.score}점 모자람`) : "";
  return `Guess What · 규칙 두더지 (${kind})\n🔨 1분에 ${st.score}점 · 헛손질 ${st.bad}번${vs}\n규칙: ${st.board.rules.map((id) => ruleById(id).name).join(" → ")}`;
}
