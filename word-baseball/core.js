// 단어 야구 — 계산(화면 없음). 숨은 두 글자 단어를 10번 안에 맞힌다
// 판정은 숫자 야구처럼 '개수만': 글자(음절)마다 첫소리·가운뎃소리·받침을 쪼개
//   S = 같은 글자 같은 자리(첫소리↔첫소리, 가운뎃소리↔가운뎃소리, 받침↔받침)에 같은 자모
//   B = 자리는 다르지만 정답 어딘가에 있는 자모(같은 자모가 여러 번이면 개수만큼만)
// 워들류(꼬들)와 다른 점(2026-10-07): 칸마다 색을 칠해 주지 않고 글자별 S·B 개수만 → 숫자 야구처럼 추리. 자모 메모판, 친구가 낸 단어 링크
// 겹모음(ㅘ)·겹받침(ㄳ)·된소리(ㄲ)는 한 덩어리로 봄(자판 한 번이 아니라 글자 한 자리 기준)
import { seededRandom, shuffle, todayKey, dayNumber, createStore } from "../shared/kit.js";
import { WORDS } from "./words.js";

export const TRIES = 10, LEN = 2;
export const DATE = todayKey();
export const DAY = dayNumber("2026-01-01");
export const store = createStore("wordbb");

const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
const JONG = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
export const MEMO_CONS = [...CHO];
export const MEMO_VOW = [...JUNG];

const isSyl = (ch) => { const c = ch.codePointAt(0); return c >= 0xac00 && c <= 0xd7a3; };
// 한 글자 → [첫소리, 가운뎃소리, 받침(없으면 빠짐)]
export function split(ch) {
  const c = ch.codePointAt(0) - 0xac00;
  const jong = c % 28, jung = Math.floor(c / 28) % 21, cho = Math.floor(c / 588);
  return JONG[jong] ? [CHO[cho], JUNG[jung], JONG[jong]] : [CHO[cho], JUNG[jung]];
}
export function validWord(w) { return typeof w === "string" && [...w].length === LEN && [...w].every(isSyl); }
export const clean = (s) => String(s || "").replace(/\s+/g, "");

// 판정: 글자마다 { s, b, n(그 글자의 정답 자모 수) }
export function judge(answer, guess) {
  const A = [...answer].map(split), G = [...guess].map(split);
  const res = G.map(() => ({ s: 0, b: 0 }));
  const leftA = [], leftG = [];
  for (let i = 0; i < LEN; i++) {
    for (let r = 0; r < 3; r++) {
      const a = A[i][r], g = G[i][r];
      if (a && g && a === g) res[i].s++;
      else { if (a) leftA.push(a); if (g) leftG.push({ i, g }); }
    }
  }
  for (const { i, g } of leftG) { const k = leftA.indexOf(g); if (k >= 0) { leftA.splice(k, 1); res[i].b++; } }
  return res.map((r, i) => ({ ...r, n: A[i].length }));
}

/* 오늘의 단어: 단어 목록을 한 번 섞어 날마다 하나씩(목록을 다 돌면 다시 섞음) */
export function dailyWord(day = DAY) {
  const n = WORDS.length, round = Math.floor(day / n);
  return shuffle(WORDS.slice(), seededRandom(`wordbb:${round}`))[day % n];
}
export const randomWord = () => WORDS[Math.floor(Math.random() * WORDS.length)];

/* 친구 단어 링크: 글자 번호를 섞어 담음(대충 봐서 안 보이게) + 확인 글자 */
const CHK = "abcdefghjkmnpqrstuvwxyz";
export function encodeWord(w) {
  const [a, b] = [...w].map((ch) => ch.codePointAt(0) - 0xac00);
  const body = ((a * 11172 + b) * 7919 + 4243).toString(36);
  return body + CHK[[...body].reduce((s, ch) => s + ch.charCodeAt(0), 0) % CHK.length];
}
export function decodeWord(code) {
  if (typeof code !== "string" || !/^[0-9a-z]{4,14}$/.test(code)) return null;
  const body = code.slice(0, -1);
  if (CHK[[...body].reduce((s, ch) => s + ch.charCodeAt(0), 0) % CHK.length] !== code.slice(-1)) return null;
  const raw = parseInt(body, 36) - 4243;
  if (raw < 0 || raw % 7919) return null;
  const n = raw / 7919, a = Math.floor(n / 11172), b = n % 11172;
  if (a >= 11172) return null;
  return String.fromCodePoint(0xac00 + a, 0xac00 + b);
}

/* 경기 상태 { key, answer, guesses, done, won } — key 별로 이 기기에 저장 */
export function loadGame(key, answer) {
  const g = store.get(`g:${key}`, null);
  if (g && g.answer === answer) return g;
  return { key, answer, guesses: [], done: false, won: false };
}
export const saveGame = (g) => store.set(`g:${g.key}`, g);
export function throwWord(g, w) {
  if (g.done || !validWord(w) || g.guesses.includes(w)) return null;
  const r = judge(g.answer, w);
  g.guesses.push(w);
  if (w === g.answer) { g.done = true; g.won = true; }
  else if (g.guesses.length >= TRIES) { g.done = true; g.won = false; }
  return r;
}
export function record(g) {
  if (!g.done || store.get(`rec:${g.key}`, false)) return;
  store.set(`rec:${g.key}`, true);
  const st = store.get("stats", { played: 0, won: 0, dist: {} });
  st.played++;
  if (g.won) { st.won++; st.dist[g.guesses.length] = (st.dist[g.guesses.length] || 0) + 1; }
  store.set("stats", st);
}
export const stats = () => store.get("stats", { played: 0, won: 0, dist: {} });

const one = (r) => (r.s || r.b ? `${"🟢".repeat(r.s)}${"🟡".repeat(r.b)}` : "⚪");
export function shareText(kind, g) {
  const rows = g.guesses.map((w, i) => `${i + 1}번 ${judge(g.answer, w).map(one).join(" | ")}`).join("\n");
  return `Guess What · 단어 야구 (${kind})\n✏️ ${g.won ? `${g.guesses.length}번 만에 맞힘` : `${TRIES}번까지 못 맞힘`}\n${rows}`;
}
