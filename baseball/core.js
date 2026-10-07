// 숫자 야구 — 계산(화면 없음). 서로 다른 숫자 3개(1~9)를 9회 안에 맞힌다. 자리·숫자 모두 맞으면 스트라이크, 숫자만 맞으면 볼
// 우리 쪽 차별점(2026-10-07): ① 친구가 직접 낸 숫자를 링크로 받아 맞히기 ② 9회 안에 맞히는 경기 형식 ③ 숫자 메모판(아님·확실 표시)
// 차례대로 두는 게임이라 롤 큐가 잡히면 그냥 나갔다 와도 됨(진행은 이 기기에 저장)
import { seededRandom, shuffle, todayKey, dayNumber, createStore } from "../shared/kit.js";

export const DIG = 3, INNINGS = 9;
export const DATE = todayKey();
export const DAY = dayNumber("2026-01-01");
export const store = createStore("baseball");

export function makeSecret(seed) {
  return shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], seededRandom(`baseball:${seed}`)).slice(0, DIG);
}
export const dailySeed = (day = DAY) => `d${day}`;
export const randomSeed = () => `r${Math.floor(Math.random() * 1e9).toString(36)}`;

// 던진 숫자가 규칙에 맞는지: 1~9, 서로 다름, 3개
export function validGuess(g) {
  return Array.isArray(g) && g.length === DIG && g.every((d) => Number.isInteger(d) && d >= 1 && d <= 9) && new Set(g).size === DIG;
}
export function judge(secret, guess) {
  let s = 0, b = 0;
  guess.forEach((d, i) => { if (secret[i] === d) s++; else if (secret.includes(d)) b++; });
  return { s, b, out: s === 0 && b === 0 };
}

/* 친구 숫자 링크: 숫자를 그대로 보이지 않게 섞어서 담는다(보안이 아니라 '대충 봐서 안 보이게').
 * 세 자리 수 n → (n × 7919 + 4243) 를 36진수로 + 확인 글자 1개. 고친 링크는 확인 글자에서 걸러짐 */
const CHK = "abcdefghjkmnpqrstuvwxyz";
export function encodeSecret(digits) {
  const n = digits[0] * 100 + digits[1] * 10 + digits[2];
  const body = (n * 7919 + 4243).toString(36);
  const sum = [...body].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  return body + CHK[sum % CHK.length];
}
export function decodeSecret(code) {
  if (typeof code !== "string" || !/^[0-9a-z]{3,8}$/.test(code)) return null;
  const body = code.slice(0, -1), chk = code.slice(-1);
  const sum = [...body].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  if (CHK[sum % CHK.length] !== chk) return null;
  const raw = parseInt(body, 36) - 4243;
  if (raw <= 0 || raw % 7919) return null;
  const n = raw / 7919;
  const d = [Math.floor(n / 100), Math.floor(n / 10) % 10, n % 10];
  return validGuess(d) ? d : null;
}

/* 한 경기 상태: { key, secret, guesses: [[d,d,d]...], done, won } — key 로 이 기기에 저장(오늘의 숫자·연습·친구 숫자 따로) */
export function loadGame(key, secret) {
  const g = store.get(`g:${key}`, null);
  if (g && JSON.stringify(g.secret) === JSON.stringify(secret)) return g;
  return { key, secret, guesses: [], done: false, won: false };
}
export const saveGame = (g) => store.set(`g:${g.key}`, g);
export function throwBall(g, guess) {
  if (g.done || !validGuess(guess)) return null;
  const r = judge(g.secret, guess);
  g.guesses.push(guess);
  if (r.s === DIG) { g.done = true; g.won = true; }
  else if (g.guesses.length >= INNINGS) { g.done = true; g.won = false; }
  return r;
}
export function record(g) {
  if (!g.done) return;
  const st = store.get("stats", { played: 0, won: 0, dist: {} });
  if (store.get(`rec:${g.key}`, false)) return; // 같은 경기 두 번 세지 않음
  store.set(`rec:${g.key}`, true);
  st.played++;
  if (g.won) { st.won++; st.dist[g.guesses.length] = (st.dist[g.guesses.length] || 0) + 1; }
  store.set("stats", st);
}
export const stats = () => store.get("stats", { played: 0, won: 0, dist: {} });

// 공유 글: 회마다 ●(스트라이크) ○(볼) · (아웃)
export function lineOf(r) { return r.out ? "아웃" : `${"🟢".repeat(r.s)}${"🟡".repeat(r.b)}`; }
export function shareText(kind, g) {
  const rows = g.guesses.map((x, i) => `${i + 1}회 ${lineOf(judge(g.secret, x))}`).join("\n");
  const head = g.won ? `${g.guesses.length}회 만에 맞힘` : "9회까지 못 맞힘";
  return `Guess What · 숫자 야구 (${kind})\n⚾ ${head}\n${rows}`;
}
