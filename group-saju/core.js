// 우리 모임 사주 — 계산(화면 없음)
// 사람마다: 연·월·일 세 기둥(태어난 시간은 받지 않음, 정오 기준) → 일간(태어난 날의 천간) + 다섯 기운 개수(6글자)
// 모임: 다섯 기운을 모두 더해 넘침·빔을 보고, 사람마다 '나를 뺀 나머지 모임'과의 관계로 모임 궁합 점수를 낸다
// 만세력은 나 상장하기와 같은 lunar.js(전역 Solar·Lunar)를 쓴다
import { fill as maFill } from "../life-stock/ma_bank.js"; // 받침에 맞춰 조사 붙이기만 빌려 씀
import { DM, ROLE, REL, OVER, LACK, EVEN, FIT, EL, PAIR } from "./texts.js";

const STEMS = "甲乙丙丁戊己庚辛壬癸";
const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
export const STEM_EL = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];
export const BRANCH_EL = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];
export const MAX = 12;

/* ---------- 날짜 글자 → 연·월·일 ---------- */
// 19950314 · 1995.3.14 · 1995-03-14 · 1995 3 14 · 950314(앞 두 자리가 올해 뒤 두 자리보다 크면 19xx, 아니면 20xx)
// 음력이면 양력 달력 검사를 건너뛴다(음력 2월 30일처럼 양력엔 없는 날이 있음). 없는 음력 날짜는 만세력 변환에서 막힌다 — v2 점검 반영
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
  const gz = [ec.getYear(), ec.getMonth(), ec.getDay()].map((h) => ({ s: STEMS.indexOf(h[0]), b: BRANCHES.indexOf(h[1]) }));
  const counts = [0, 0, 0, 0, 0];
  gz.forEach((g) => { counts[STEM_EL[g.s]]++; counts[BRANCH_EL[g.b]]++; });
  return { name, dm: gz[2].s, counts };
}
// 공유 링크에는 생일 대신 계산 결과만 담는다: [이름, 일간, 목, 화, 토, 금, 수]
export const pack = (p) => [p.name, p.dm, ...p.counts];
// 받은 링크 값 검사(손으로 고친 링크 방어): 일간 0~9 정수, 기운 개수 0~6 정수이고 합이 6. 아니면 null
export function unpack(a) {
  if (!Array.isArray(a) || a.length !== 7) return null;
  const [name, dm, ...counts] = a;
  const okInt = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;
  if (!okInt(dm, 0, 9) || !counts.every((n) => okInt(n, 0, 6)) || counts.reduce((x, y) => x + y, 0) !== 6) return null;
  const nm = String(name ?? "").trim().slice(0, 12);
  return nm ? { name: nm, dm, counts } : null;
}

/* ---------- 오행 관계 ---------- */
export const gen = (a, b) => b === (a + 1) % 5; // a 가 b 를 살림(목→화→토→금→수→목)
export const ctrl = (a, b) => b === (a + 2) % 5; // a 가 b 를 다잡음(목→토, 화→금, 토→수, 금→목, 수→화)
export function relKey(me, them) {
  if (me === them) return "same";
  if (gen(them, me)) return "in";
  if (gen(me, them)) return "out";
  if (ctrl(me, them)) return "ctrlOut";
  return "ctrlIn";
}
const argmax = (a) => a.reduce((bi, v, i) => (v > a[bi] ? i : bi), 0);
const sum = (a) => a.reduce((s, v) => s + v, 0);
export const OVER_AT = 0.3, LACK_AT = 0.1; // 넘침·빔 기준(놀이용으로 정한 값)

/* ---------- 모임 궁합 점수 (v2) ----------
 * v1 은 '나머지 모임의 대표 기운 하나'와의 관계로만 점수를 매겨 점수가 다섯 칸에 90% 넘게 몰리고 1등 동점이 잦았다(점검표).
 * v2: 나머지 모임 기운 비율 전체에 관계 무게를 곱해 더한다 → v1보다 덜 몰림(검사에서 같은 모임 300개로 v1과 비교).
 *   무게: 나를 살림 0.8 · 같음 0.6 · 내가 살림 0.5 · 내가 다잡음 0.4 · 나를 다잡음 0.35
 *   (나를 다잡는 기운은 전통에서 규율·단련으로 읽어 크게 깎지 않음 — 점검자가 올린 결정 사항을 Claude 가 이렇게 정함, 놀이용 값)
 * 나머지 모임에 비어 있는(10% 미만) 기운을 내가 2개 이상 가지면 하나에 +5(최대 2개), 이미 넘치는 대표 기운을 내가 3개 이상 더 가지면 −4. 45~98로 자름 */
export const REL_W = { in: 0.8, same: 0.6, out: 0.5, ctrlOut: 0.4, ctrlIn: 0.35 };
const REL_PREF = ["in", "same", "out", "ctrlOut", "ctrlIn"]; // 대표 기운이 동률일 때 문장 고르는 순서(입력 순서·오행 순서에 좌우되지 않게)
export function fitOf(me, others) {
  const rest = [0, 1, 2, 3, 4].map((e) => sum(others.map((o) => o.counts[e])));
  const tot = sum(rest) || 1;
  const share = rest.map((v) => v / tot);
  const meEl = STEM_EL[me.dm];
  // (여섯 글자 전체를 섞어 보는 안도 시험했으나 평균을 내며 점수 폭이 좁아져 오히려 더 몰림 → 일간만 씀. 동점은 '공동 찰떡'으로 보여 줌)
  const x = share.reduce((acc, sh, e) => acc + sh * REL_W[relKey(meEl, e)], 0);
  const mx = Math.max(...rest);
  const doms = [0, 1, 2, 3, 4].filter((e) => rest[e] === mx);
  const rel = REL_PREF.find((k) => doms.some((e) => relKey(meEl, e) === k));
  const dom = doms.find((e) => relKey(meEl, e) === rel);
  const fills = [0, 1, 2, 3, 4].filter((e) => share[e] < LACK_AT && me.counts[e] >= 2);
  const over = share[dom] >= OVER_AT && me.counts[dom] >= 3;
  const raw = 50 + ((x - 0.35) / 0.45) * 40 + 5 * Math.min(2, fills.length) - (over ? 4 : 0);
  const score = Math.max(45, Math.min(98, Math.round(raw)));
  return { score, rel, dom, fills, over, label: FIT.find((f) => score >= f.min).t };
}

/* ---------- 짝 ---------- */
export function pairScore(a, b) {
  const ea = STEM_EL[a.dm], eb = STEM_EL[b.dm];
  let s = gen(ea, eb) || gen(eb, ea) ? 2 : ea === eb ? 1 : -1;
  for (let e = 0; e < 5; e++) { if (a.counts[e] <= 1 && b.counts[e] >= 2) s++; if (b.counts[e] <= 1 && a.counts[e] >= 2) s++; }
  return s;
}
const pickLine = (arr, seed) => arr[[...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % arr.length];
export function pairLine(a, b) {
  const ea = STEM_EL[a.dm], eb = STEM_EL[b.dm], seed = a.name + b.name;
  if (ea === eb) return maFill(pickLine(PAIR.same, seed), a.name, b.name);
  if (gen(ea, eb)) return maFill(pickLine(PAIR.gen, seed), a.name, b.name);
  if (gen(eb, ea)) return maFill(pickLine(PAIR.gen, seed), b.name, a.name);
  if (ctrl(ea, eb)) return maFill(pickLine(PAIR.ctrl, seed), a.name, b.name);
  return maFill(pickLine(PAIR.ctrl, seed), b.name, a.name);
}

/* ---------- 받침에 맞는 조사 ---------- */
export function josa(word, a, b) {
  const c = String(word).charCodeAt(String(word).length - 1);
  const has = c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 !== 0 : false;
  return word + (has ? a : b);
}

/* ---------- 모임 전체 읽기 ---------- */
export function readGroup(people) {
  const all = [0, 1, 2, 3, 4].map((e) => sum(people.map((p) => p.counts[e])));
  const tot = sum(all) || 1;
  const share = all.map((v) => v / tot);
  const over = [0, 1, 2, 3, 4].filter((e) => share[e] >= OVER_AT).sort((x, y) => share[y] - share[x]);
  const lack = [0, 1, 2, 3, 4].filter((e) => share[e] < LACK_AT).sort((x, y) => share[x] - share[y]);
  const lines = [];
  if (over.length) lines.push(OVER[over[0]]);
  lack.slice(0, 2).forEach((e) => {
    const fillers = people.filter((p) => p.counts[e] >= 2).map((p) => p.name);
    let t = LACK[e];
    if (fillers.length) { const list = fillers.slice(0, 3).join(", "); t += ` 이 빈자리는 ${josa(list, "이", "가")} 채워요.`; }
    lines.push(t);
  });
  if (!lines.length) lines.push(EVEN);
  const members = people.map((p, i) => {
    const fit = fitOf(p, people.filter((_, j) => j !== i));
    const el = STEM_EL[p.dm];
    const R = REL[fit.rel];
    const fillTxt = fit.fills.length ? ` 모임에 모자란 ${fit.fills.map((e) => EL[e]).join("·")} 기운을 채워 줘요.` : "";
    return { ...p, i, el, dmInfo: DM[p.dm], role: ROLE[el], fit, relT: R.t, give: R.give + fillTxt, tip: R.tip };
  });
  let best = null, spark = null;
  for (let i = 0; i < people.length; i++) for (let j = i + 1; j < people.length; j++) {
    const s = pairScore(people[i], people[j]);
    if (!best || s > best.s) best = { i, j, s };
    if (!spark || s < spark.s) spark = { i, j, s };
  }
  const pairs = {};
  if (best) pairs.best = { a: people[best.i].name, b: people[best.j].name, line: pairLine(people[best.i], people[best.j]) };
  if (spark && people.length >= 3 && (spark.i !== best.i || spark.j !== best.j)) pairs.spark = { a: people[spark.i].name, b: people[spark.j].name, line: pairLine(people[spark.i], people[spark.j]) };
  // 카드는 넣은 순서 그대로(점수 순위로 줄 세우지 않음 — 공유 화면에서 꼴찌가 드러나지 않게). 최고점이 여럿이면 공동 찰떡
  const best1 = Math.max(...members.map((m) => m.fit.score));
  const tops = members.filter((m) => m.fit.score === best1);
  return { share, over, lack, lines, members, tops, pairs };
}
