// 랜덤 닉네임 생성기 — 계산(화면 없음). 단어장은 words.js
// 분위기 × 글자 수 × 조합 방식으로 한 번에 10개. 규칙: 글자 수 정확히 / 금지어(붙였을 때 생기는 것까지) 0 / 한 묶음 안에서 같은 닉네임·같은 단어 다시 안 씀
// 우리 쪽 차별점(2026-10-08): ① 하나 고르면 이름표가 슬롯처럼 굴러가다 멈춤 ② 하트로 이 기기에 보관 ③ '내가 고른 3개 중 진짜 쓸 것 맞혀 봐' 친구 링크
import { seededRandom, shuffle, hashString, createStore } from "../shared/kit.js";
import { WORDS, BANNED } from "./words.js";

export { WORDS, BANNED };
export const store = createStore("nickname");
export const COUNT = 10;

// 분위기: lens = 고를 수 있는 글자 수(영어풍은 알파벳 수), max = '상관없음'일 때 최대 길이
export const MOODS = [
  { id: "cute", name: "귀여운", lang: "ko", lens: [2, 3, 4, 5, 6, 7, 8], max: 8 },
  { id: "funny", name: "웃긴", lang: "ko", lens: [2, 3, 4, 5, 6, 7, 8], max: 8 },
  { id: "cool", name: "멋있는", lang: "ko", lens: [2, 3, 4, 5, 6, 7, 8], max: 8 },
  { id: "emo", name: "감성", lang: "ko", lens: [2, 3, 4, 5, 6, 7, 8], max: 8 },
  { id: "game", name: "게임용 짧은", lang: "ko", lens: [2, 3, 4, 5], max: 5 },
  { id: "eng", name: "영어풍", lang: "en", lens: [4, 5, 6, 7, 8, 9, 10, 11, 12], max: 14 },
];
// 조합 방식: a = 앞 단어 칸, b = 뒤 단어 칸들
export const COMBOS = [
  { id: "an", name: "형용사+명사", a: ["adj"], b: ["noun", "animal"] },
  { id: "nn", name: "명사+명사", a: ["noun"], b: ["noun", "animal"] },
  { id: "oa", name: "의성어+동물", a: ["ono"], b: ["animal"] },
];
export const moodOf = (id) => MOODS.find((m) => m.id === id) || null;
export const comboOf = (id) => COMBOS.find((c) => c.id === id) || null;

// 글자 수: 한글은 음절 수, 영어는 알파벳 수
export const nickLen = (s) => [...String(s)].length;
const KO = /^[가-힣]+$/, EN = /^[A-Za-z]+$/;

// 금지어 검사: 소문자로 바꾸고 띄어쓰기·기호를 지운 뒤 금지 글자열이 들어 있으면 true
export function isBanned(text, banned = BANNED) {
  const t = String(text).toLowerCase().replace(/[^가-힣a-z0-9]/g, "");
  return banned.some((b) => t.includes(b));
}

function uniq(arr) { return [...new Set(arr)]; }
// 분위기·조합에 맞는 앞/뒤 단어 목록
export function listsFor(moodId, comboId, words = WORDS) {
  const m = words[moodId], c = comboOf(comboId);
  if (!m || !c) return null;
  return { A: uniq(c.a.flatMap((k) => m[k] || [])), B: uniq(c.b.flatMap((k) => m[k] || [])) };
}

// 두 단어를 붙여도 되는지: 같은 단어·한쪽이 다른 쪽을 품는 경우(곰+아기곰) 금지, 길이 조건, 금지어
export function okPair(a, b, len, max, banned = BANNED) {
  if (a === b || a.includes(b) || b.includes(a)) return false;
  const t = a + b, n = nickLen(t);
  if (len ? n !== len : n < 2 || n > max) return false;
  return !isBanned(t, banned);
}

// 조건에 맞는 모든 조합(앞, 뒤)
export function pool(moodId, comboId, len = 0, { words = WORDS, banned = BANNED } = {}) {
  const L = listsFor(moodId, comboId, words), m = moodOf(moodId);
  if (!L || !m) return [];
  if (len && !m.lens.includes(len)) return [];
  const out = [];
  for (const a of L.A) for (const b of L.B) if (okPair(a, b, len, m.max, banned)) out.push([a, b]);
  return out;
}

// 글자 수 단추마다 만들 수 있는 조합 수(0이면 단추 잠금)
export function lenCounts(moodId, comboId) {
  const m = moodOf(moodId);
  return m ? m.lens.map((n) => ({ len: n, n: pool(moodId, comboId, n).length })) : [];
}

/* 한 묶음 뽑기 → { items: [{ text, parts:[앞,뒤] }], total: 가능한 조합 수 }
 * 같은 묶음 안에서는 같은 닉네임도, 이미 쓴 단어도 다시 안 쓴다. 조합이 모자라면 10개보다 적게 나옴 */
export function generate({ mood, combo, len = 0, count = COUNT, rand = Math.random, words, banned } = {}) {
  const all = pool(mood, combo, len, { words, banned });
  const used = new Set(), seen = new Set(), items = [];
  for (const [a, b] of shuffle(all, rand)) {
    if (items.length >= count) break;
    const t = a + b;
    if (seen.has(t) || used.has(a) || used.has(b)) continue;
    seen.add(t); used.add(a); used.add(b);
    items.push({ text: t, parts: [a, b] });
  }
  return { items, total: all.length };
}

// 닉네임이 우리 단어장 두 단어로 만들 수 있는 것인지(친구 링크 검증용 — 주소를 고쳐 아무 글자나 넣은 링크는 거름)
let SPLIT = null;
function splitIndex() {
  if (SPLIT) return SPLIT;
  SPLIT = new Map();
  for (const m of MOODS) for (const c of COMBOS) {
    const L = listsFor(m.id, c.id);
    for (const a of L.A) for (const b of L.B) if (okPair(a, b, 0, m.max)) { const t = a + b; if (!SPLIT.has(t)) SPLIT.set(t, m.id); }
  }
  return SPLIT;
}
export const isKnownNick = (t) => typeof t === "string" && (KO.test(t) || EN.test(t)) && !isBanned(t) && splitIndex().has(t);
export const moodOfNick = (t) => splitIndex().get(t) || null;

/* ---------- 하트 보관(이 기기) ---------- */
export const HEART_MAX = 60;
export const hearts = () => store.get("hearts", []).filter((h) => h && isKnownNick(h.t));
export function toggleHeart(t, mood) {
  const hs = hearts();
  const i = hs.findIndex((h) => h.t === t);
  if (i >= 0) hs.splice(i, 1);
  else { hs.unshift({ t, m: mood }); hs.length = Math.min(hs.length, HEART_MAX); }
  store.set("hearts", hs);
  return i < 0;
}
export const isHearted = (t) => hearts().some((h) => h.t === t);

/* ---------- '맞혀 봐' 링크 ----------
 * 후보 3개 + 정답 번호 + 보낸 사람 이름을 글자로 묶고, 링크마다 다른 열쇠(2바이트)로 뒤섞은 뒤 확인값 3바이트를 붙여 주소용 글자로 바꾼다.
 * 보안이 아니라 '주소만 봐서는 후보도 정답도 안 보이게'. 고친 링크는 확인값·단어장 검사에서 걸러짐 */
const enc = (s) => new TextEncoder().encode(s);
const dec = (b) => new TextDecoder("utf-8", { fatal: true }).decode(b);
function b64u(bytes) { let s = ""; bytes.forEach((x) => (s += String.fromCharCode(x))); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function unb64u(str) {
  if (typeof str !== "string" || !/^[A-Za-z0-9_-]{8,400}$/.test(str)) return null;
  try { const b = str.replace(/-/g, "+").replace(/_/g, "/"); const bin = atob(b + "===".slice((b.length + 3) % 4)); return Uint8Array.from(bin, (c) => c.charCodeAt(0)); } catch { return null; }
}
function xor(bytes, salt) {
  const r = seededRandom(`nickname:${salt}`);
  return bytes.map((x) => x ^ Math.floor(r() * 256));
}
export const cleanName = (s) => String(s ?? "").replace(/[\u0000-\u001f|]/g, "").trim().slice(0, 10);

export function encodeChallenge({ cands, ans, by = "" }, salt = Math.floor(Math.random() * 65536)) {
  const body = enc(`${cands.join("|")}|${ans}|${cleanName(by)}`);
  const h = hashString(dec(body));
  const out = new Uint8Array(2 + body.length + 3);
  out[0] = salt >> 8; out[1] = salt & 255;
  out.set(xor(body, salt), 2);
  out[out.length - 3] = (h >>> 16) & 255; out[out.length - 2] = (h >>> 8) & 255; out[out.length - 1] = h & 255;
  return b64u(out);
}
export function decodeChallenge(code) {
  const raw = unb64u(code);
  if (!raw || raw.length < 2 + 9 + 3) return null;
  const salt = (raw[0] << 8) | raw[1];
  let text;
  try { text = dec(xor(raw.slice(2, -3), salt)); } catch { return null; }
  const h = hashString(text);
  if (raw[raw.length - 3] !== ((h >>> 16) & 255) || raw[raw.length - 2] !== ((h >>> 8) & 255) || raw[raw.length - 1] !== (h & 255)) return null;
  const p = text.split("|");
  if (p.length !== 5) return null;
  const cands = p.slice(0, 3), ans = p[3], by = p[4];
  if (!/^[0-2]$/.test(ans)) return null;
  if (!cands.every(isKnownNick) || new Set(cands).size !== 3) return null;
  if (by !== cleanName(by) || (by && isBanned(by))) return null;
  return { cands, ans: +ans, by };
}

// 링크 만들 때 후보 순서를 섞어 '고른 순서 = 정답 자리'가 되지 않게
export function makeChallenge(cands, realText, by, rand = Math.random) {
  if (cands.length !== 3 || new Set(cands).size !== 3 || !cands.includes(realText) || !cands.every(isKnownNick)) return null;
  const order = shuffle(cands, rand);
  return encodeChallenge({ cands: order, ans: order.indexOf(realText), by });
}

// 친구가 고른 결과는 링크마다 이 기기에 남김(새로 열어도 다시 안 고름)
export const guessKey = (code) => `guess:${hashString(code).toString(36)}`;
