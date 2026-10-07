// 우리 모임 사주 v4 — 계산(화면 없음). 지난 판: guesswhat-web\_옛브랜드_스냅샷_2026-10-06\group-saju_v3\
// v3 (10-07 "사주를 더 깊게"): 일주·띠·신강신약·십신·용신·세운 / 천간합·육합·충·띠합·삼합 / 삼합국
// v4 (독립 점검 모임사주_문장점검_v3.md 반영):
//   · 용신: 신강/신약 하나로 답이 정해지던 favor 최댓값 → 억부법(무엇이 일간을 누르거나 넘치게 하는지 보고 고름)
//   · '귀인': 명리의 천을귀인 표로 따로 계산(그 이름으로만 씀). 용신 기운을 가진 친구는 '힘이 되는 친구'로 부름
//   · 사이 점수: 힘이 되는 친구와 일간 상생을 겹쳐 세던 것 제거. 띠 반합은 子午卯酉가 낀 짝만
//   · 삼합국: 일지끼리만(여러 사람 일지·띠를 섞으면 큰 모임에서 거의 늘 떠서). 문장은 '기운이 한 방향으로 모여요'로 낮춤
//   · 모임 궁합: 사이 점수 '평균' → '가장 잘 맞는 두 사람' 평균(인원이 늘수록 평균으로 뭉개지던 구조를 바꿈)
//   · 신강/신약 네 칸 · 십신 동점은 월지 묶음 우선 · 올해 간지는 오늘 날짜의 연주(입춘 기준)
//   · 공유 링크 검사 강화, 사이 근거는 링크 값을 믿지 않고 일간·일지·띠로 다시 계산
// 시간 없이 연·월·일 세 기둥만 씀. 辰戌丑未는 지장간을 보지 않고 토로 셈(놀이 수준의 단순화)
import { fill as maFill } from "../life-stock/ma_bank.js"; // 받침에 맞춰 조사 붙이기만 빌려 씀
import { DM, ROLE, REL, OVER, LACK, EVEN, EL, PAIR, GOD, GOD2, STRENGTH, YEAR, CLASH_SOFT, HELP, NOBLE, PTYPE, SAMHAP, BALANCE } from "./texts.js";

const STEMS = "甲乙丙丁戊己庚辛壬癸";
const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
export const STEM_KO = "갑을병정무기경신임계";
export const BRANCH_KO = "자축인묘진사오미신유술해";
export const TTI = ["쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지"];
export const STEM_EL = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];
export const BRANCH_EL = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];
export const MAX = 12;
const sum = (a) => a.reduce((s, v) => s + v, 0);
const mod = (a, n) => ((a % n) + n) % n;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- 날짜 글자 → 연·월·일 ---------- */
export function parseDate(str, lunar = false) {
  const s = String(str || "").trim();
  const cur = new Date().getFullYear() % 100;
  const century = (yy) => (yy > cur ? 1900 : 2000) + yy;
  let y, m, d;
  const parts = s.split(/[^\d]+/).filter(Boolean);
  if (parts.length === 3) [y, m, d] = parts.map(Number);
  else if (/^\d{8}$/.test(s)) [y, m, d] = [s.slice(0, 4), s.slice(4, 6), s.slice(6)].map(Number);
  else if (/^\d{6}$/.test(s)) [y, m, d] = [century(Number(s.slice(0, 2))), Number(s.slice(2, 4)), Number(s.slice(4))];
  else return { err: "예: 1995.03.14" };
  if (y < 100) y = century(y);
  const now = new Date().getFullYear();
  if (y < 1920 || y > now) return { err: "연도를 확인해 주세요" };
  if (lunar) return m >= 1 && m <= 12 && d >= 1 && d <= 30 ? { y, m, d } : { err: "없는 날짜예요" };
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== m || dt.getUTCDate() !== d) return { err: "없는 날짜예요" };
  return { y, m, d };
}
const gzOf = (h) => ({ s: STEMS.indexOf(h[0]), b: BRANCHES.indexOf(h[1]) });

/* ---------- 한 사람 ---------- */
export function personOf({ name, date, lunar = false }) {
  const p = parseDate(date, lunar);
  if (p.err) return { name, err: p.err };
  let { y, m, d } = p;
  if (lunar) {
    try { const s = globalThis.Lunar.fromYmd(y, m, d).getSolar(); y = s.getYear(); m = s.getMonth(); d = s.getDay(); }
    catch { return { name, err: "음력에 없는 날짜예요" }; }
  }
  const ec = globalThis.Solar.fromYmdHms(y, m, d, 12, 0, 0).getLunar().getEightChar();
  return chart(name, [ec.getYear(), ec.getMonth(), ec.getDay()].map(gzOf));
}

/* 억부 용신(v4): 일간을 기준으로
 *  신약 — 나를 누르거나 빼는 묶음(식상·재성·관성) 가운데 가장 센 것을 본다. 관성이 세면 인성(관을 받아 나를 살림), 재성이 세면 비겁(재를 나눠 짐), 식상이 세면 인성(식상을 눌러 줌)
 *  신강 — 넘치는 묶음(비겁·인성) 가운데 가장 센 것을 본다. 인성이 세면 재성(인성을 눌러 줌), 비겁이 세면 관성 또는 식상(원국에 관성이 식상보다 많으면 관성, 아니면 식상)
 *  동점은 관성 > 재성 > 식상 / 인성 > 비겁 순(전통에서 더 무겁게 보는 쪽 먼저) */
export function yongOf(strong, gods) {
  if (!strong) {
    const k = [3, 2, 1].reduce((bi, g) => (gods[g] > gods[bi] ? g : bi), 3);
    return k === 2 ? 0 : 4;
  }
  const k = gods[4] >= gods[0] ? 4 : 0;
  if (k === 4) return 2;
  return gods[3] > gods[1] ? 3 : 1;
}
export const STRENGTH_LV = (r) => (r >= 0.62 ? 3 : r >= 0.5 ? 2 : r >= 0.38 ? 1 : 0); // 신약·약간 신약·약간 신강·신강(engine.js 와 같은 경계)

// 세 기둥 → 오행 개수 · 일간 · 신강/신약 · 십신 · 용신 · (세운용) favor
export function chart(name, pillars) {
  const counts = [0, 0, 0, 0, 0];
  pillars.forEach((g) => { counts[STEM_EL[g.s]]++; counts[BRANCH_EL[g.b]]++; });
  const dm = pillars[2].s, dmEl = STEM_EL[dm];
  const rel = (el) => mod(el - dmEl, 5); // 0 비겁 1 식상 2 재성 3 관성 4 인성
  let support = 0, total = 0;
  pillars.forEach((g, i) => {
    [[STEM_EL[g.s], i === 2 ? 0 : 1], [BRANCH_EL[g.b], i === 1 ? 1.5 : 1]].forEach(([el, w]) => { total += w; if (rel(el) === 0 || rel(el) === 4) support += w; });
  });
  const ratio = support / total, strong = ratio >= 0.5;
  const gods = [0, 0, 0, 0, 0];
  pillars.forEach((g, i) => { if (i !== 2) gods[rel(STEM_EL[g.s])]++; gods[rel(BRANCH_EL[g.b])]++; });
  const yongGod = yongOf(strong, gods);
  const yong = (dmEl + yongGod) % 5;
  // 세운 판단용 favor 는 나 상장하기 engine.js 규칙 그대로(두 기능이 같은 해를 다르게 말하지 않게)
  const BASE_WEAK = [0.8, -0.5, -0.7, -0.9, 1], BASE_STRONG = [-0.8, 0.8, 0.9, 0.6, -0.9];
  const favor = [0, 1, 2, 3, 4].map((el) => clamp((strong ? BASE_STRONG : BASE_WEAK)[rel(el)] + (counts[el] === 0 ? 0.25 : 0) - (counts[el] >= 4 ? 0.2 : 0), -1, 1));
  // 가장 센 십신 묶음: 동점이면 월지가 속한 묶음을 먼저, 그래도 같으면 둘을 함께
  const mx = Math.max(...gods);
  const tied = [0, 1, 2, 3, 4].filter((g) => gods[g] === mx);
  const monthGod = rel(BRANCH_EL[pillars[1].b]);
  const topGods = tied.includes(monthGod) ? [monthGod] : tied.slice(0, 2);
  return { name, pillars, counts, dm, dmEl, ratio, strong, gods, favor, yong, yongGod, topGods };
}

/* ---------- 오행 관계 ---------- */
export const gen = (a, b) => b === (a + 1) % 5;
export const ctrl = (a, b) => b === (a + 2) % 5;
export function relKey(me, them) {
  if (me === them) return "same";
  if (gen(them, me)) return "in";
  if (gen(me, them)) return "out";
  if (ctrl(me, them)) return "ctrlOut";
  return "ctrlIn";
}
export const REL_KEYS = ["in", "same", "out", "ctrlOut", "ctrlIn"];

/* ---------- 지지·천간 관계 표(전통) ---------- */
export const stemHap = (a, b) => Math.abs(a - b) === 5;            // 甲己 乙庚 丙辛 丁壬 戊癸
export const yukHap = (a, b) => a !== b && (a + b) % 12 === 1;      // 子丑 寅亥 卯戌 辰酉 巳申 午未
export const chung = (a, b) => Math.abs(a - b) === 6;               // 子午 丑未 寅申 卯酉 辰戌 巳亥
export const samhapGroup = (b) => b % 4;                            // 申子辰 0 · 巳酉丑 1 · 寅午戌 2 · 亥卯未 3
export const SAMHAP_EL = [4, 3, 1, 0];
export const SAMHAP_HANJA = ["申子辰", "巳酉丑", "寅午戌", "亥卯未"];
const CENTER = [0, 6, 3, 9]; // 子午卯酉 — 삼합의 가운데 글자
// 반합: 같은 삼합 무리의 두 글자이고 가운데 글자(子午卯酉)가 끼어야 인정(v4)
export const samhapPair = (a, b) => a !== b && samhapGroup(a) === samhapGroup(b) && (CENTER.includes(a) || CENTER.includes(b));
// 천을귀인: 일간별 귀인 지지. 甲戊庚→丑未 · 乙己→子申 · 丙丁→亥酉 · 壬癸→巳卯 · 辛→寅午
export const NOBLE_BR = [[1, 7], [0, 8], [11, 9], [11, 9], [1, 7], [0, 8], [1, 7], [2, 6], [5, 3], [5, 3]];
// a 의 천을귀인 자리에 b 의 일지나 띠가 있으면 b 는 a 의 천을귀인
export const isNoble = (aDm, bDb, bYb) => NOBLE_BR[aDm].includes(bDb) || NOBLE_BR[aDm].includes(bYb);

/* ---------- 올해(세운): 오늘 날짜의 연주(입춘 기준) ---------- */
export function thisYearGZ(date = new Date()) {
  return gzOf(globalThis.Solar.fromYmdHms(date.getFullYear(), date.getMonth() + 1, date.getDate(), 12, 0, 0).getLunar().getEightChar().getYear());
}
export function yearLevel(p, ygz) {
  const sc = 0.55 * p.favor[STEM_EL[ygz.s]] + 0.45 * p.favor[BRANCH_EL[ygz.b]];
  return sc > 0.3 ? 2 : sc < -0.3 ? 0 : 1;
}

/* ---------- 두 사람 사이: 근거 비트 ---------- */
// 1 천간합 · 2 일지 육합 · 4 일지 충 · 8 띠 육합 · 16 띠 반합 · 32 띠 충 · 64 b 가 a 의 힘이 되는 친구 · 128 a 가 b 의 힘이 되는 친구 · 256 b 가 a 의 천을귀인 · 512 a 가 b 의 천을귀인
export const PB = { stemHap: 1, dayHap: 2, dayChung: 4, ttiHap: 8, ttiSam: 16, ttiChung: 32, helpAB: 64, helpBA: 128, nobleAB: 256, nobleBA: 512 };
export const STRUCT = PB.stemHap | PB.dayHap | PB.dayChung | PB.ttiHap | PB.ttiSam | PB.ttiChung | PB.nobleAB | PB.nobleBA; // 일간·일지·띠만으로 다시 계산되는 비트
// 힘이 되는 친구: 내 용신 오행이 상대 일간 오행이거나, 상대 원국에 그 기운 3개 이상
export const isHelper = (me, other) => other.dmEl === me.yong || other.counts[me.yong] >= 3;
export function structBits(a, b) { // a,b: {dm, db, yb}
  let x = 0;
  if (stemHap(a.dm, b.dm)) x |= PB.stemHap;
  if (yukHap(a.db, b.db)) x |= PB.dayHap;
  if (chung(a.db, b.db)) x |= PB.dayChung;
  if (yukHap(a.yb, b.yb)) x |= PB.ttiHap;
  if (samhapPair(a.yb, b.yb)) x |= PB.ttiSam;
  if (chung(a.yb, b.yb)) x |= PB.ttiChung;
  if (isNoble(a.dm, b.db, b.yb)) x |= PB.nobleAB;
  if (isNoble(b.dm, a.db, a.yb)) x |= PB.nobleBA;
  return x;
}
const brief = (p) => ({ dm: p.dm, db: p.pillars[2].b, yb: p.pillars[0].b });
export function pairBits(a, b) {
  let x = structBits(brief(a), brief(b));
  if (isHelper(a, b)) x |= PB.helpAB;
  if (isHelper(b, a)) x |= PB.helpBA;
  return x;
}
/* 사이 점수(놀이용 값): 천간합 +3 · 일지 육합 +2 · 띠 육합 +1 · 띠 반합 +1 · 천을귀인 한 방향마다 +1 · 힘이 되는 친구 한 방향마다 +1
 * 일지 충 −1 · 띠 충 −1 · 일간 오행 상생 +1(단, 힘이 되는 친구가 이미 있으면 같은 사실을 두 번 세지 않게 빼고) · 같은 오행 +0.5 */
export function pairPts(bits, ea, eb) {
  let s = 0;
  if (bits & PB.stemHap) s += 3;
  if (bits & PB.dayHap) s += 2;
  if (bits & PB.ttiHap) s += 1;
  if (bits & PB.ttiSam) s += 1;
  if (bits & PB.nobleAB) s += 1;
  if (bits & PB.nobleBA) s += 1;
  if (bits & PB.helpAB) s += 1;
  if (bits & PB.helpBA) s += 1;
  if (bits & PB.dayChung) s -= 1;
  if (bits & PB.ttiChung) s -= 1;
  const helped = bits & (PB.helpAB | PB.helpBA);
  if ((gen(ea, eb) || gen(eb, ea)) && !helped) s += 1; else if (ea === eb) s += 0.5;
  return s;
}
// 사이 칸 기호: 합(천간합·일지합·띠합·띠반합) 수와 충 수를 비교. 같으면 둘 다
export function pairMark(bits, ea, eb) {
  const hap = [PB.stemHap, PB.dayHap, PB.ttiHap, PB.ttiSam].filter((f) => bits & f).length;
  const ch = [PB.dayChung, PB.ttiChung].filter((f) => bits & f).length;
  if (hap && ch) return hap > ch ? "合" : ch > hap ? "沖" : "合沖";
  if (hap) return "合";
  if (ch) return "沖";
  return ea === eb ? "同" : gen(ea, eb) || gen(eb, ea) ? "生" : "剋";
}
export function pairType(bits) {
  if (bits & PB.stemHap) return "stemHap";
  if ((bits & PB.nobleAB) && (bits & PB.nobleBA)) return "mutualNoble";
  if ((bits & PB.helpAB) && (bits & PB.helpBA)) return "mutualHelp";
  if (bits & PB.dayHap) return "dayHap";
  if (bits & (PB.nobleAB | PB.nobleBA)) return "noble";
  if (bits & PB.ttiHap) return "ttiHap";
  if (bits & PB.ttiSam) return "ttiSam";
  if (bits & PB.dayChung) return "dayChung";
  if (bits & PB.ttiChung) return "ttiChung";
  return "el";
}

/* ---------- 모임 궁합 ---------- */
export const OVER_AT = 0.3, LACK_AT = 0.1;
export const REL_W = { in: 0.8, same: 0.6, out: 0.5, ctrlOut: 0.4, ctrlIn: 0.35 };
const REL_PREF = ["in", "same", "out", "ctrlOut", "ctrlIn"];
export function fitOf(me, others) {
  const rest = [0, 1, 2, 3, 4].map((e) => sum(others.map((o) => o.counts[e])));
  const tot = sum(rest) || 1;
  const share = rest.map((v) => v / tot);
  const meEl = STEM_EL[me.dm];
  const x = share.reduce((acc, sh, e) => acc + sh * REL_W[relKey(meEl, e)], 0);
  const mx = Math.max(...rest);
  const doms = [0, 1, 2, 3, 4].filter((e) => rest[e] === mx);
  const rel = REL_PREF.find((k) => doms.some((e) => relKey(meEl, e) === k));
  const dom = doms.find((e) => relKey(meEl, e) === rel);
  const fills = [0, 1, 2, 3, 4].filter((e) => share[e] < LACK_AT && me.counts[e] >= 2);
  const over = share[dom] >= OVER_AT && me.counts[dom] >= 3;
  const raw = 50 + ((x - 0.35) / 0.45) * 40 + 5 * Math.min(2, fills.length) - (over ? 4 : 0);
  return { elemScore: Math.max(45, Math.min(98, Math.round(raw))), rel, fills };
}
/* v4 모임 궁합 = 모임 기운 쪽 50% + 사이 쪽 50%. 사이 쪽은 '나와 가장 잘 맞는 두 사람'과의 사이 점수 평균(2명 모임은 한 사람) → 58 + 8×평균
 * (v3 은 모든 사람과의 평균이라 인원이 늘수록 좋은 사이와 나쁜 사이가 서로 지워져 점수가 평균으로 뭉개졌음 — 점검표) */
export const TOP_K = 2;
export function topAvg(row) {
  const s = [...row].sort((a, b) => b - a).slice(0, TOP_K);
  return s.length ? sum(s) / s.length : 0;
}
export const fitScore = (elemScore, pairPart) => Math.max(45, Math.min(98, Math.round(0.5 * elemScore + 0.5 * (58 + 8 * pairPart))));

/* ---------- 모임 전체 → 코드(공유 가능한 결과) ---------- */
export function analyzeGroup(people, g = "우리 모임", ygz = thisYearGZ()) {
  const n = people.length;
  const all = [0, 1, 2, 3, 4].map((e) => sum(people.map((p) => p.counts[e])));
  const tot = sum(all) || 1;
  const sh = all.map((v) => Math.round((v / tot) * 100));
  const pairs = [];
  const rows = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const bits = pairBits(people[i], people[j]);
    pairs.push([i, j, bits]);
    const pt = pairPts(bits, people[i].dmEl, people[j].dmEl);
    rows[i].push(pt); rows[j].push(pt);
  }
  const lack = [0, 1, 2, 3, 4].filter((e) => all[e] / tot < LACK_AT).sort((x, y) => all[x] - all[y]).slice(0, 2)
    .map((e) => [e, people.map((p, i) => (p.counts[e] >= 2 ? i : -1)).filter((i) => i >= 0).slice(0, 3)]);
  const over = [0, 1, 2, 3, 4].filter((e) => all[e] / tot >= OVER_AT).sort((x, y) => all[y] - all[x]).slice(0, 1);
  const P = people.map((p, i) => {
    const f = fitOf(p, people.filter((_, j) => j !== i));
    const hp = people.map((q, j) => (j !== i && isHelper(p, q) ? j : -1)).filter((j) => j >= 0)
      .sort((a, b) => (people[b].dmEl === p.yong) - (people[a].dmEl === p.yong) || a - b).slice(0, 2);
    const nb = people.map((q, j) => (j !== i && isNoble(p.dm, q.pillars[2].b, q.pillars[0].b) ? j : -1)).filter((j) => j >= 0).slice(0, 3);
    const [y, , d] = p.pillars;
    const cl = chung(d.b, ygz.b) ? 1 : chung(y.b, ygz.b) ? 2 : 0;
    return {
      n: p.name, dm: p.dm, db: d.b, yb: y.b, sl: STRENGTH_LV(p.ratio), god: p.topGods, yong: p.yong,
      yr: yearLevel(p, ygz), cl, fit: fitScore(f.elemScore, topAvg(rows[i])), rel: REL_KEYS.indexOf(f.rel), fills: f.fills, hp, nb,
    };
  });
  // 삼합국: 서로 다른 세 사람의 '일지'가 申子辰처럼 한 판을 이루면(v4: 띠는 섞지 않음)
  const tri = [];
  for (let gI = 0; gI < 4 && tri.length < 2; gI++) {
    const need = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].filter((b) => b % 4 === gI);
    const holders = need.map((b) => people.map((p, i) => (p.pillars[2].b === b ? i : -1)).filter((i) => i >= 0));
    if (holders.every((h) => h.length)) tri.push([gI, holders[0][0], holders[1][0], holders[2][0]]);
  }
  return { v: 4, g, yg: [ygz.s, ygz.b], P, sh, pairs, lack, over, tri };
}

/* ---------- 받은 링크 값 검사(손으로 고친 링크 방어) ---------- */
const isInt = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;
const arrOf = (a, lo, hi, maxLen) => Array.isArray(a) && a.length <= maxLen && a.every((x) => isInt(x, lo, hi));
export function validCode(c) {
  try {
    if (!c || c.v !== 4 || !Array.isArray(c.P) || c.P.length < 2 || c.P.length > MAX) return false;
    const n = c.P.length;
    if (!Array.isArray(c.yg) || !isInt(c.yg[0], 0, 9) || !isInt(c.yg[1], 0, 11) || c.yg[0] % 2 !== c.yg[1] % 2) return false;
    for (let i = 0; i < n; i++) {
      const p = c.P[i];
      if (!p || typeof p.n !== "string" || !p.n.trim() || p.n.length > 12) return false;
      if (!isInt(p.dm, 0, 9) || !isInt(p.db, 0, 11) || p.dm % 2 !== p.db % 2 || !isInt(p.yb, 0, 11)) return false;
      if (!isInt(p.sl, 0, 3) || !isInt(p.cl, 0, 2) || !isInt(p.yr, 0, 2) || !isInt(p.yong, 0, 4) || !isInt(p.rel, 0, 4) || !isInt(p.fit, 45, 98)) return false;
      if (!arrOf(p.god, 0, 4, 2) || !p.god.length || !arrOf(p.fills, 0, 4, 5) || !arrOf(p.hp, 0, n - 1, 2) || !arrOf(p.nb, 0, n - 1, 3)) return false;
      if (p.hp.includes(i) || p.nb.includes(i)) return false;
    }
    if (!arrOf(c.sh, 0, 100, 5) || c.sh.length !== 5) return false;
    if (!Array.isArray(c.pairs) || c.pairs.length !== (n * (n - 1)) / 2) return false;
    let k = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++, k++) {
      const q = c.pairs[k];
      if (!Array.isArray(q) || q[0] !== i || q[1] !== j || !isInt(q[2], 0, 1023)) return false;
    }
    if (!Array.isArray(c.lack) || c.lack.length > 2 || !c.lack.every((l) => Array.isArray(l) && l.length === 2 && isInt(l[0], 0, 4) && arrOf(l[1], 0, n - 1, 3))) return false;
    if (!arrOf(c.over, 0, 4, 1)) return false;
    if (!Array.isArray(c.tri) || c.tri.length > 2 || !c.tri.every((t) => Array.isArray(t) && t.length === 4 && isInt(t[0], 0, 3) && t.slice(1).every((x) => isInt(x, 0, n - 1)) && new Set(t.slice(1)).size === 3
      && t.slice(1).every((x, m) => c.P[x].db === [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].filter((b) => b % 4 === t[0])[m]))) return false;
    return true;
  } catch { return false; }
}

/* ---------- 받침에 맞는 조사 ---------- */
export function josa(word, a, b) {
  const c = String(word).charCodeAt(String(word).length - 1);
  const has = c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 !== 0 : false;
  return word + (has ? a : b);
}
const names = (c, idx, sep = ", ") => idx.map((i) => c.P[i].n).join(sep);

/* ---------- 코드 → 화면용 결과(내 기기·받은 링크 모두 이 함수로 펼침) ---------- */
const pickLine = (arr, seed) => arr[[...seed].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % arr.length];
function elPairLine(a, b) {
  const ea = STEM_EL[a.dm], eb = STEM_EL[b.dm], seed = a.n + b.n;
  if (ea === eb) return maFill(pickLine(PAIR.same, seed), a.n, b.n);
  if (gen(ea, eb)) return maFill(pickLine(PAIR.gen, seed), a.n, b.n);
  if (gen(eb, ea)) return maFill(pickLine(PAIR.gen, seed), b.n, a.n);
  if (ctrl(ea, eb)) return maFill(pickLine(PAIR.ctrl, seed), a.n, b.n);
  return maFill(pickLine(PAIR.ctrl, seed), b.n, a.n);
}
export function whyList(bits, a, b) {
  const w = [];
  if (bits & PB.stemHap) w.push(`일간 천간합 ${STEM_KO[a.dm]}${STEM_KO[b.dm]}`);
  if (bits & PB.dayHap) w.push(`일지 육합 ${BRANCH_KO[a.db]}${BRANCH_KO[b.db]}`);
  if (bits & PB.dayChung) w.push(`일지 충 ${BRANCH_KO[a.db]}${BRANCH_KO[b.db]}`);
  if (bits & PB.ttiHap) w.push(`띠 육합 ${TTI[a.yb]}·${TTI[b.yb]}`);
  if (bits & PB.ttiSam) w.push(`띠 반합 ${TTI[a.yb]}·${TTI[b.yb]}`);
  if (bits & PB.ttiChung) w.push(`띠 충 ${TTI[a.yb]}·${TTI[b.yb]}`);
  if ((bits & PB.nobleAB) && (bits & PB.nobleBA)) w.push("서로의 천을귀인");
  else if (bits & PB.nobleAB) w.push(`${josa(b.n, "은", "는")} ${a.n}의 천을귀인이에요`);
  else if (bits & PB.nobleBA) w.push(`${josa(a.n, "은", "는")} ${b.n}의 천을귀인이에요`);
  if ((bits & PB.helpAB) && (bits & PB.helpBA)) w.push("서로 필요한 기운을 가졌어요");
  else if (bits & PB.helpAB) w.push(`${josa(b.n, "이", "가")} ${a.n}에게 필요한 기운을 가졌어요`);
  else if (bits & PB.helpBA) w.push(`${josa(a.n, "이", "가")} ${b.n}에게 필요한 기운을 가졌어요`);
  return w;
}
export function expand(c) {
  const n = c.P.length;
  const ygKo = STEM_KO[c.yg[0]] + BRANCH_KO[c.yg[1]];
  const members = c.P.map((p, i) => {
    const el = STEM_EL[p.dm];
    const R = REL[REL_KEYS[p.rel]];
    const fillTxt = p.fills.length ? ` 모임에 모자란 ${p.fills.map((e) => EL[e]).join("·")} 기운을 채워 줘요.` : "";
    const helpTxt = p.hp.length ? HELP.has(EL[p.yong], names(c, p.hp, "·"), p.n) : HELP.none(EL[p.yong]);
    const nobleTxt = p.nb.length ? NOBLE(names(c, p.nb, "·"), p.n) : "";
    const yearLine = p.cl && p.yr === 0 ? CLASH_SOFT(ygKo)[p.cl - 1].low : YEAR(ygKo)[p.yr] + (p.cl ? " " + CLASH_SOFT(ygKo)[p.cl - 1].add : "");
    return {
      ...p, i, el, dmInfo: DM[p.dm], role: ROLE[el], ilju: `${STEM_KO[p.dm]}${BRANCH_KO[p.db]}일주`, tti: `${TTI[p.yb]}띠`,
      strength: STRENGTH[p.sl], godLine: p.god.length > 1 ? GOD2(p.god[0], p.god[1]) : GOD[p.god[0]], helpLine: helpTxt, nobleLine: nobleTxt, yearLine,
      relT: R.t, give: R.give + fillTxt, tip: R.tip,
    };
  });
  const lines = [];
  if (c.over.length) lines.push(OVER[c.over[0]]);
  c.lack.forEach(([e, who]) => lines.push(LACK[e] + (who.length ? ` 이 빈자리는 ${josa(names(c, who), "이", "가")} 채워요.` : "")));
  if (!lines.length) lines.push(EVEN);
  const firm = c.P.filter((p) => p.sl >= 2).length;
  const balance = BALANCE(firm, n - firm);
  // 사이 근거: 일간·일지·띠로 다시 계산되는 부분은 링크 값을 믿지 않고 다시 계산(고친 링크가 없는 근거를 띄우지 못하게)
  const grid = c.pairs.map(([i, j, b0]) => {
    const a = c.P[i], b = c.P[j], ea = STEM_EL[a.dm], eb = STEM_EL[b.dm];
    const bits = structBits(a, b) | (b0 & (PB.helpAB | PB.helpBA));
    const t = pairType(bits);
    const line = t === "el" ? elPairLine(a, b) : maFill(PTYPE[t].line, a.n, b.n);
    return { i, j, bits, pts: pairPts(bits, ea, eb), mark: pairMark(bits, ea, eb), type: t, title: t === "el" ? null : PTYPE[t].t, line, why: whyList(bits, a, b) };
  });
  // 눈에 띄는 사이(공개 카드): 점수 높은 순 3쌍만. 부딪히는 사이는 사이 지도 칸을 눌렀을 때만 보임(v4)
  const highlights = [...grid].sort((x, y) => y.pts - x.pts || x.i - y.i || x.j - y.j).slice(0, Math.min(3, grid.length)).map((x) => ({ ...x, kind: "best" }));
  const tri = c.tri.map(([gI, a, b, d]) => ({ gI, el: SAMHAP_EL[gI], hanja: SAMHAP_HANJA[gI], who: [a, b, d], line: SAMHAP[gI](names(c, [a, b, d])) }));
  const best1 = Math.max(...members.map((m) => m.fit));
  const tops = members.filter((m) => m.fit === best1);
  const risers = members.filter((m) => m.yr === 2).map((m) => m.n);
  return { g: c.g, ygKo, share: c.sh.map((x) => x / 100), lines, balance, members, tops, grid, highlights, tri, risers, over: c.over, lackEls: c.lack.map((l) => l[0]) };
}
