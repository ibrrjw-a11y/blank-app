// 나 상장하기 — 사주 계산 + 인생 주가 모델
// ------------------------------------------------------------------
// 재미로 보는 콘텐츠예요. 전통 명리 이론을 아주 단순하게 옮긴 "설명 가능한" 규칙만 써요.
// 같은 입력이면 언제나 같은 차트가 나와요(결정적). 외부 통신 없음.
//
// 1) 만세력: shared/vendor/lunar.js (전역 Solar, Lunar) 로 4기둥(연·월·일·시)과 대운을 구해요.
// 2) 오행 분포: 8글자(시간을 모르면 6글자)의 천간·지기 오행을 세요. 지장간은 쓰지 않아요.
// 3) 일간(나) 강약: 나와 같은 오행(비겁) + 나를 생하는 오행(인성)의 비중.
//    월지(계절)는 1.5배로 가중. 비중 ≥ 50% 면 신강, 아니면 신약.
// 4) 유리한 오행(favor, -1~+1):
//    - 신약: 인성 +1, 비겁 +0.8 / 식상 -0.5, 재성 -0.7, 관성 -0.9
//    - 신강: 재성 +0.9, 식상 +0.8, 관성 +0.6 / 비겁 -0.8, 인성 -0.9
//    - 원국에 아예 없는 오행은 +0.25(보충), 4개 이상 많은 오행은 -0.2(과다)
// 5) 간지 점수 = 천간 오행 favor × 0.55 + 지지 오행 favor × 0.45  (대운은 0.5/0.5)
// 6) 월별 수익률 r = 생애 곡선(55세까지 성장, 이후 완만한 하향) + 대운(추세) + 세운(1년 등락) + 월운(잔물결) + 시드 노이즈
//    → 로그 누적 → 이동평균으로 부드럽게 → 0세 시가 10,000원.
// 7) 일봉: 그날의 일진(일주) 점수로 월 추세선 위아래로 출렁이게 해요.
// ------------------------------------------------------------------
import { hashString, seededRandom, todayKey } from "../shared/kit.js";

export const STEMS = "甲乙丙丁戊己庚辛壬癸";
export const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
const STEM_KO = "갑을병정무기경신임계";
const BRANCH_KO = "자축인묘진사오미신유술해";
export const EL_HANJA = ["木", "火", "土", "金", "水"];
export const EL_KO = ["목", "화", "토", "금", "수"];
const STEM_EL = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];
const BRANCH_EL = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4]; // 子水 丑土 寅木 卯木 辰土 巳火 午火 未土 申金 酉金 戌土 亥水

// 일간 기준 관계: (상대 오행 - 내 오행 + 5) % 5
export const GODS = ["비겁", "식상", "재성", "관성", "인성"];
export const GOD_MEANING = ["자립·동료·경쟁", "표현·재능·연애 감각", "재물·성과·현실 감각", "직장·명예·책임", "학습·문서·보호"];

// 일간별 업종 (재미용 비유)
export const INDUSTRY = [
  { el: "甲木", sector: "대형 성장주 · 교육/콘텐츠", note: "곧게 뻗는 큰 나무처럼 꾸준히 우상향하는 체질" },
  { el: "乙木", sector: "중소형 성장주 · 디자인/뷰티", note: "덩굴처럼 유연하게 틈새시장을 파고드는 체질" },
  { el: "丙火", sector: "테마주 · 엔터/마케팅", note: "태양처럼 주목받을 때 거래량이 폭발하는 체질" },
  { el: "丁火", sector: "기술주 · AI/연구개발", note: "촛불처럼 한 점에 집중해 기술력으로 승부하는 체질" },
  { el: "戊土", sector: "대형 가치주 · 건설/부동산", note: "큰 산처럼 변동성이 낮고 묵직한 체질" },
  { el: "己土", sector: "배당주 · 유통/식품", note: "논밭처럼 꾸준히 키워 나눠주는 체질" },
  { el: "庚金", sector: "경기민감주 · 자동차/중공업", note: "강철처럼 결단력 있게 사이클을 타는 체질" },
  { el: "辛金", sector: "우량주 · 금융/주얼리", note: "보석처럼 다듬을수록 프리미엄이 붙는 체질" },
  { el: "壬水", sector: "글로벌주 · 무역/물류", note: "큰 강처럼 넓게 흘러 바깥 세상에 끌리기 쉬운 체질" },
  { el: "癸水", sector: "바이오주 · 헬스케어/심리", note: "단비처럼 조용히 스며들어 오래 가는 체질" },
];

const mod = (a, n) => ((a % n) + n) % n;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- 간지 유틸 ---------- */
// 60갑자 인덱스 ↔ {s, b}
export const gzFromIndex = (i) => ({ s: mod(i, 10), b: mod(i, 12) });
export const gzFromHanja = (str) => (str && str.length === 2 ? { s: STEMS.indexOf(str[0]), b: BRANCHES.indexOf(str[1]) } : null);
export const gzHanja = (g) => STEMS[g.s] + BRANCHES[g.b];
export const gzKo = (g) => STEM_KO[g.s] + BRANCH_KO[g.b];
export const stemKo = (s) => STEM_KO[s];
export const stemEl = (s) => STEM_EL[s];
export const branchEl = (b) => BRANCH_EL[b];
export const elLabel = (e) => `${EL_KO[e]}(${EL_HANJA[e]})`;

// 그 해의 세운(입춘 기준). 2월 20일 이후면 해당 연도, 1월이면 전년.
export function yearGZ(y, m = 6) {
  return gzFromIndex(mod((m >= 2 ? y : y - 1) - 4, 60));
}
// 그 달 20일 기준 월건(월주). 20일은 항상 그 달 절입일(4~8일) 이후라 지지는 달마다 고정.
export function monthGZ(y, m) {
  const ys = yearGZ(y, m).s;
  return { s: mod(ys * 2 + 2 + mod(m - 2, 12), 10), b: mod(m, 12) };
}
// 일진(일주). 율리우스일 기반 산식 (lunar.js 결과와 1990~1998 전 구간 일치 확인).
export function dayGZ(y, m, d) {
  const jd = Math.floor(Date.UTC(y, m - 1, d) / 86400000) + 2440588;
  return gzFromIndex(jd + 49);
}

/* ---------- 날짜 유틸 ---------- */
export const ymd = (date) => ({ y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() });
export const utc = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
export const addDays = (o, n) => ymd(new Date(Date.UTC(o.y, o.m - 1, o.d + n)));
export const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export function todayYmd() {
  const [y, m, d] = todayKey().split("-").map(Number);
  return { y, m, d };
}

/* ---------- 음력 / 손 없는 날 ---------- */
export function lunarOf(y, m, d) {
  const l = globalThis.Solar.fromYmd(y, m, d).getLunar();
  return { month: l.getMonth(), day: l.getDay(), leap: l.getMonth() < 0 };
}
// 손 없는 날: 음력 날짜의 끝자리가 9 또는 0 (9·10·19·20·29·30일)
export const isSonEomneun = (lunarDay) => lunarDay % 10 === 9 || lunarDay % 10 === 0;

/* ---------- 입력 → 양력 ---------- */
export function resolveSolar(input) {
  const { cal, y, m, d, leap } = input;
  if (cal === "lunar") {
    let l;
    try {
      l = globalThis.Lunar.fromYmd(y, leap ? -m : m, d);
    } catch {
      throw new Error(leap ? "그해에는 해당 윤달이 없어요" : "음력에 없는 날짜예요");
    }
    const s = l.getSolar();
    return { y: s.getYear(), m: s.getMonth(), d: s.getDay() };
  }
  const dt = utc(y, m, d);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== m || dt.getUTCDate() !== d) throw new Error("없는 날짜예요");
  return { y, m, d };
}

/* ---------- 분석 ---------- */
export const START_PRICE = 10000;
export const MAX_AGE = 90;

export function analyze(input) {
  const { Solar } = globalThis;
  if (!Solar) throw new Error("만세력 라이브러리를 불러오지 못했어요");
  const birth = resolveSolar(input);
  const timeKnown = input.h != null && input.h >= 0;
  // 한국 표준시(동경 135°)와 서울 실제 태양시(약 127°) 차이 30분 보정. 시간을 모르면 정오로 계산.
  let hh = 12;
  let mi = 0;
  let sajuDate = birth;
  if (timeKnown) {
    const t = new Date(Date.UTC(birth.y, birth.m - 1, birth.d, input.h, input.mi || 0) - 30 * 60000);
    sajuDate = ymd(t);
    hh = t.getUTCHours();
    mi = t.getUTCMinutes();
  }
  const lunar = Solar.fromYmdHms(sajuDate.y, sajuDate.m, sajuDate.d, hh, mi, 0).getLunar();
  const ec = lunar.getEightChar();
  const pillars = [ec.getYear(), ec.getMonth(), ec.getDay(), ec.getTime()].map(gzFromHanja);
  const used = timeKnown ? pillars : pillars.slice(0, 3);

  // 오행 개수 (표시용 정수)
  const counts = [0, 0, 0, 0, 0];
  used.forEach((p) => {
    counts[STEM_EL[p.s]]++;
    counts[BRANCH_EL[p.b]]++;
  });

  const dm = pillars[2].s; // 일간
  const dmEl = STEM_EL[dm];
  const rel = (el) => mod(el - dmEl, 5);

  // 강약: 일간 자신은 제외, 월지 1.5배
  let support = 0;
  let total = 0;
  used.forEach((p, i) => {
    const items = [
      [STEM_EL[p.s], i === 2 ? 0 : 1],
      [BRANCH_EL[p.b], i === 1 ? 1.5 : 1],
    ];
    items.forEach(([el, w]) => {
      total += w;
      const r = rel(el);
      if (r === 0 || r === 4) support += w;
    });
  });
  const ratio = support / total;
  const strong = ratio >= 0.5;
  const strengthLabel = ratio >= 0.62 ? "신강" : ratio >= 0.5 ? "약간 신강" : ratio >= 0.38 ? "약간 신약" : "신약";

  const BASE_WEAK = [0.8, -0.5, -0.7, -0.9, 1];
  const BASE_STRONG = [-0.8, 0.8, 0.9, 0.6, -0.9];
  const favor = [0, 1, 2, 3, 4].map((el) => {
    let f = (strong ? BASE_STRONG : BASE_WEAK)[rel(el)];
    if (counts[el] === 0) f += 0.25;
    if (counts[el] >= 4) f -= 0.2;
    return clamp(f, -1, 1);
  });
  const favorable = [0, 1, 2, 3, 4].filter((e) => favor[e] > 0.3).sort((a, b) => favor[b] - favor[a]);
  const unfavorable = [0, 1, 2, 3, 4].filter((e) => favor[e] < -0.3).sort((a, b) => favor[a] - favor[b]);

  const gzScore = (g, ws = 0.55) => (g ? ws * favor[STEM_EL[g.s]] + (1 - ws) * favor[BRANCH_EL[g.b]] : 0);

  // 대운
  const gender = input.g === "F" ? "F" : "M";
  const yun = ec.getYun(gender === "M" ? 1 : 0);
  const daeun = yun.getDaYun(11).map((dy, i) => {
    const gzStr = dy.getGanZhi();
    const gz = gzStr ? gzFromHanja(gzStr) : pillars[1]; // 대운 전에는 월주가 흐름을 맡아요
    const startYear = dy.getStartYear();
    const endYear = dy.getEndYear();
    return {
      i,
      pre: !gzStr,
      gz,
      startYear,
      endYear,
      startAge: startYear - birth.y,
      endAge: endYear - birth.y,
      score: gzScore(gz, 0.5),
    };
  });
  const daeunAt = (year) => daeun.find((d) => year >= d.startYear && year <= d.endYear) || (year < daeun[0].startYear ? daeun[0] : daeun[daeun.length - 1]);

  // 월별 시계열
  const seed = hashString(`${birth.y}-${birth.m}-${birth.d}-${timeKnown ? input.h + ":" + (input.mi || 0) : "noon"}-${gender}`);
  const rand = seededRandom(seed);
  const gauss = () => {
    const u = Math.max(1e-9, rand());
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const N = MAX_AGE * 12;
  const raw = new Float64Array(N + 1);
  const months = [];
  const comp = [];
  for (let t = 0; t <= N; t++) {
    const y = birth.y + Math.floor((birth.m - 1 + t) / 12);
    const m = mod(birth.m - 1 + t, 12) + 1;
    const dy = daeunAt(y);
    months.push({ y, m, daeun: dy.i });
    comp.push([dy.score, gzScore(yearGZ(y, m)), gzScore(monthGZ(y, m))]);
  }
  // 평생 평균을 60% 빼서(중심화) 특정 오행이 계속 유리/불리해도 차트가 한쪽으로만 치닫지 않게 해요
  const meanOf = (k) => comp.reduce((a, c) => a + c[k], 0) / comp.length;
  const mD = 0.6 * meanOf(0);
  const mS = 0.6 * meanOf(1);
  let acc = 0;
  let noise = 0;
  for (let t = 0; t <= N; t++) {
    const [D, S, W] = comp[t];
    // 기본 생애 곡선: 55세까지는 완만한 성장, 그 뒤로는 완만한 하향 (성장기 → 성숙기)
    const life = 0.0026 * (1 - t / 12 / 55);
    noise = 0.55 * noise + 0.8 * gauss();
    const r = life + 0.004 * (D - mD) + 0.006 * (S - mS) + 0.0022 * W + 0.005 * noise;
    if (t > 0) acc += r;
    raw[t] = acc;
  }
  // 중심 이동평균(±3개월)
  const logP = new Float64Array(N + 1);
  for (let t = 0; t <= N; t++) {
    let s = 0;
    let c = 0;
    for (let k = -3; k <= 3; k++) {
      const j = t + k;
      if (j >= 0 && j <= N) {
        s += raw[j];
        c++;
      }
    }
    logP[t] = s / c;
  }
  const off = logP[0];
  const price = Array.from(logP, (v) => START_PRICE * Math.exp(v - off));

  // 사상 최고가, 최대 조정
  let peakIdx = 0;
  price.forEach((p, i) => p > price[peakIdx] && (peakIdx = i));
  // 최대 조정: 15년 안쪽의 고점 → 저점 하락폭이 가장 큰 구간
  let dd = { depth: 0, from: 0, to: 0 };
  for (let i = 1; i <= N; i++) {
    let hi = Math.max(0, i - 180);
    for (let j = hi; j < i; j++) if (price[j] > price[hi]) hi = j;
    const depth = price[i] / price[hi] - 1;
    if (depth < dd.depth) dd = { depth, from: hi, to: i };
  }
  // 저점 이후에도 계속 내려가는 구간이면 끝을 저점으로 맞춤
  for (let i = dd.to + 1; i <= Math.min(N, dd.from + 180); i++) if (price[i] < price[dd.to]) dd.to = i;
  dd.depth = price[dd.to] / price[dd.from] - 1;

  // 일 단위 가격 (월 추세선 × 일진 출렁임)
  const tOf = (o) => (o.y - birth.y) * 12 + (o.m - birth.m) + (o.d - birth.d) / 30.44;
  const basePrice = (t) => {
    t = clamp(t, 0, N);
    const i = Math.min(N - 1, Math.floor(t));
    const f = t - i;
    return START_PRICE * Math.exp(logP[i] + (logP[i + 1] - logP[i]) * f - off);
  };
  const dayScore = (o) => {
    const r = seededRandom(seed ^ hashString(`${o.y}-${o.m}-${o.d}`))();
    return clamp(0.8 * gzScore(dayGZ(o.y, o.m, o.d)) + 0.45 * (r - 0.5), -1, 1);
  };
  // 그날 일진(짧은 출렁임) + 최근 열흘 일진의 지수평균(며칠씩 이어지는 흐름)
  const dayPrice = (o) => {
    let ema = 0;
    let wsum = 0;
    for (let k = 0, w = 1; k < 14; k++, w *= 0.85) {
      ema += w * dayScore(addDays(o, -k));
      wsum += w;
    }
    return basePrice(tOf(o)) * Math.exp(0.006 * dayScore(o) + 0.016 * (ema / wsum));
  };
  const candle = (o) => {
    const prev = addDays(o, -1);
    const open = dayPrice(prev);
    const close = dayPrice(o);
    const r = seededRandom(seed ^ hashString(`w${o.y}-${o.m}-${o.d}`));
    const high = Math.max(open, close) * (1 + 0.002 + 0.009 * r());
    const low = Math.min(open, close) * (1 - 0.002 - 0.009 * r());
    return { ...o, open, close, high, low, score: dayScore(o), gz: dayGZ(o.y, o.m, o.d) };
  };

  // 종목코드: 0으로 시작하는 6자리
  const code = "0" + String(hashString(`${input.name}|${birth.y}${birth.m}${birth.d}|${gender}`) % 100000).padStart(5, "0");

  return {
    input: { ...input, g: gender },
    name: input.name,
    birth,
    timeKnown,
    pillars,
    counts,
    dm,
    dmEl,
    rel,
    ratio,
    strong,
    strengthLabel,
    favor,
    favorable,
    unfavorable,
    gzScore,
    daeun,
    daeunAt,
    months,
    price,
    peakIdx,
    drawdown: dd,
    tOf,
    basePrice,
    dayScore,
    dayPrice,
    candle,
    code,
    industry: INDUSTRY[dm],
    seed,
    yunStart: { y: yun.getStartYear(), m: yun.getStartMonth(), d: yun.getStartDay() },
  };
}

/* ---------- 파생 지표 ---------- */
export const ageAt = (P, idx) => idx / 12;
export function monthLabel(P, idx) {
  const mo = P.months[Math.round(clamp(idx, 0, P.months.length - 1))];
  return `${mo.y}년 ${mo.m}월`;
}
export function daeunLabel(P, dy) {
  if (dy.pre) return `0~${Math.max(0, dy.endAge)}세 대운 전(월주 ${gzKo(dy.gz)})`;
  return `${dy.startAge}~${dy.endAge}세 ${gzKo(dy.gz)} 대운`;
}

// 섹터 지표 (0~100). 해당 해의 세운·대운에 그 섹터를 뜻하는 십신 오행이 얼마나 들어오는지 + 유리함.
//  - 재물 = 재성, 직장 = 관성
//  - 연애 = 남성은 재성, 여성은 관성 (전통 해석) + 식상(표현력) 절반
//  - 건강 = 세운 오행이 원국 균형을 돕는지(부족한 오행 보충 +, 과다 오행 가중 -)
export const SECTORS = [
  { key: "money", name: "재물", god: "재성" },
  { key: "love", name: "연애", god: "재·관·식상" },
  { key: "health", name: "건강", god: "오행 균형" },
  { key: "work", name: "직장", god: "관성" },
];
export function sectorValue(P, key, year) {
  const sy = yearGZ(year);
  const dy = P.daeunAt(year);
  const els = [
    [STEM_EL[sy.s], 1],
    [BRANCH_EL[sy.b], 0.8],
    [STEM_EL[dy.gz.s], 0.5],
    [BRANCH_EL[dy.gz.b], 0.4],
  ];
  const presence = (relIdx) => els.reduce((a, [el, w]) => a + (P.rel(el) === relIdx ? w : 0), 0);
  const godVal = (relIdx) => {
    const el = mod(P.dmEl + relIdx, 5);
    return presence(relIdx) * (P.favor[el] + 0.35);
  };
  const base = 50 + 16 * P.gzScore(sy) + 8 * dy.score;
  let v = base;
  if (key === "money") v += 14 * godVal(2);
  if (key === "work") v += 14 * godVal(3);
  if (key === "love") v += 11 * godVal(P.input.g === "M" ? 2 : 3) + 6 * godVal(1);
  if (key === "health") {
    const minC = Math.min(...P.counts);
    const maxC = Math.max(...P.counts);
    els.slice(0, 2).forEach(([el, w]) => {
      if (P.counts[el] === minC) v += 10 * w;
      if (P.counts[el] === maxC) v -= 8 * w;
    });
  }
  return Math.round(clamp(v, 4, 96));
}

// 연도별 로그 변화(해당 연도 1월→12월)
export function yearlyReturns(P, fromYear, toYear) {
  const out = [];
  for (let y = fromYear; y <= toYear; y++) {
    const a = P.basePrice(P.tOf({ y, m: 1, d: 1 }));
    const b = P.basePrice(P.tOf({ y, m: 12, d: 31 }));
    out.push(Math.log(b / a));
  }
  return out;
}

export function report(P, today = todayYmd()) {
  const curYear = today.y;
  const nowT = P.tOf(today);
  const nowIdx = clamp(Math.round(nowT), 0, P.price.length - 1);
  const nowPrice = P.dayPrice(today);
  const cur = P.daeunAt(curYear);
  const seunNext = [0, 1, 2].map((k) => P.gzScore(yearGZ(curYear + k)));
  const outlook = 0.5 * cur.score + 0.5 * (seunNext.reduce((a, b) => a + b, 0) / 3);
  const opinion = outlook > 0.15 ? { code: "BUY", ko: "매수" } : outlook > -0.15 ? { code: "HOLD", ko: "보유" } : { code: "WATCH", ko: "관망" };

  // 12개월 목표주가 = 향후 12개월 월봉 최고값
  let target = 0;
  let targetIdx = nowIdx;
  for (let i = nowIdx; i <= Math.min(P.price.length - 1, nowIdx + 12); i++) {
    if (P.price[i] > target) {
      target = P.price[i];
      targetIdx = i;
    }
  }
  target = Math.round(target / 50) * 50;

  const peak = P.months[P.peakIdx];
  const peakAge = Math.floor(P.peakIdx / 12);
  const peakDaeun = P.daeun[peak.daeun];
  const godOf = (el) => GODS[P.rel(el)];
  const curStemGod = godOf(STEM_EL[cur.gz.s]);
  const curBranchGod = godOf(BRANCH_EL[cur.gz.b]);
  const trendWord = cur.score > 0.25 ? "상승 추세" : cur.score > -0.25 ? "박스권 횡보" : "조정 국면";

  // 향후 5년 중 최고/최저 세운
  const years = [0, 1, 2, 3, 4].map((k) => {
    const y = curYear + k;
    const g = yearGZ(y);
    return { y, g, s: P.gzScore(g) };
  });
  const best = years.reduce((a, b) => (b.s > a.s ? b : a));
  const worst = years.reduce((a, b) => (b.s < a.s ? b : a));

  const points = [
    {
      title: `${daeunLabel(P, cur)}: ${trendWord}`,
      body: cur.pre
        ? `아직 대운이 시작되기 전이라 월주의 기운이 흐름을 맡아요.`
        : `천간 ${curStemGod}(${GOD_MEANING[GODS.indexOf(curStemGod)]})과 지지 ${curBranchGod}의 10년 흐름이에요. ${
            cur.score > 0 ? "유리한 오행이 들어와 추세를 받쳐줘요." : "불리한 오행이 섞여 체력 관리가 필요한 구간이에요."
          }`,
    },
    {
      title: `사상 최고가 예상 ${peak.y}년 (${peakAge}세)`,
      body: `${daeunLabel(P, peakDaeun)}에서 유리한 오행이 겹쳐 주가가 정점을 찍는 흐름이에요. 예상 고점 ${Math.round(
        P.price[P.peakIdx]
      ).toLocaleString("ko-KR")}원.`,
    },
    {
      title: `${best.y}년 ${gzKo(best.g)} 세운이 최대 호재`,
      body: `앞으로 5년 중 ${elLabel(STEM_EL[best.g.s])}·${elLabel(BRANCH_EL[best.g.b])} 기운이 ${P.strengthLabel} 체질에 가장 잘 맞아요. ${
        godOf(STEM_EL[best.g.s])
      }(${GOD_MEANING[P.rel(STEM_EL[best.g.s])]}) 관련 일을 이때 키워 보세요.`,
    },
  ];

  // 섹터
  const sectors = SECTORS.map((s) => {
    const series = Array.from({ length: 10 }, (_, k) => sectorValue(P, s.key, curYear + k));
    const prev = sectorValue(P, s.key, curYear - 1);
    return { ...s, series, value: series[0], delta: series[0] - prev };
  });
  const near = sectors.map((s) => ({ ...s, min3: Math.min(...s.series.slice(0, 3)), minYear: curYear + s.series.slice(0, 3).indexOf(Math.min(...s.series.slice(0, 3))) }));
  const weakest = near.reduce((a, b) => (b.min3 < a.min3 ? b : a));
  const missing = P.counts.findIndex((c) => c === 0);
  const risks = [
    {
      title: `${weakest.name} 변동성 확대 (${weakest.minYear}년)`,
      body: `${weakest.minYear}년 ${weakest.name} 지표가 ${weakest.min3}까지 내려가요. 이 시기엔 ${
        { money: "큰 지출·투자 결정을 미루고 현금 비중을 늘려요", love: "감정적인 결정보다 대화를 늘려요", health: "무리한 일정보다 수면과 운동을 챙겨요", work: "이직·충돌보다 실적 다지기에 집중해요" }[weakest.key]
      }.`,
    },
    missing >= 0
      ? {
          title: `${elLabel(missing)} 오행 부재: 관련 섹터 유동성 부족`,
          body: `원국에 ${EL_KO[missing]} 기운이 없어요. ${GODS[P.rel(missing)]}(${GOD_MEANING[P.rel(missing)]}) 쪽 경험이 쌓이기 전까지는 기대치를 낮춰 잡는 게 좋아요.`,
        }
      : {
          title: `${worst.y}년 ${gzKo(worst.g)} 세운: 단기 조정 주의`,
          body: `앞으로 5년 중 가장 맞지 않는 기운이에요. ${godOf(STEM_EL[worst.g.s])} 기운이 과해질 수 있으니 이 해엔 공격적인 확장보다 방어가 유리해요.`,
        },
  ];

  return { opinion, outlook, target, targetIdx, nowIdx, nowT, nowPrice, cur, points, risks, sectors, years, best, worst };
}

// 오늘의 시세 한 줄 코멘트
const DAY_COMMENT = {
  비겁: ["동료 매수세 유입! 같이 하면 오르는 날이에요", "경쟁 매물 출회, 내 몫부터 챙기는 날이에요"],
  식상: ["아이디어 테마 급등, 말하고 표현하면 통하는 날이에요", "말실수 변동성 주의, 한 박자 쉬고 말해요"],
  재성: ["재물 섹터 강세, 작은 이득이 쌓이는 날이에요", "충동 매수 주의, 지갑은 닫아두는 게 좋아요"],
  관성: ["기관 매수! 조직에서 인정받기 좋은 날이에요", "규제 리스크, 원칙대로 처리하면 무난해요"],
  인성: ["든든한 지지선, 배우고 서류 보기 좋은 날이에요", "거래량 부진, 큰 결정은 내일로 미뤄요"],
};
export function dayComment(P, c) {
  const god = GODS[P.rel(STEM_EL[c.gz.s])];
  return { god, text: DAY_COMMENT[god][c.close >= c.open ? 0 : 1] };
}

// 택일: 카테고리별 날짜 점수
export const PURPOSES = [
  { key: "interview", name: "면접", god: 3 },
  { key: "confess", name: "고백", god: null },
  { key: "move", name: "이사", god: null },
  { key: "contract", name: "계약", god: 2 },
];
export function monthCalendar(P, y, m) {
  const n = daysInMonth(y, m);
  const days = [];
  for (let d = 1; d <= n; d++) {
    const lun = lunarOf(y, m, d);
    const gz = dayGZ(y, m, d);
    const son = isSonEomneun(lun.day);
    days.push({ y, m, d, lun, gz, son, score: P ? P.dayScore({ y, m, d }) : 0, good: [] });
  }
  if (!P) return days;
  const loveGod = P.input.g === "M" ? 2 : 3;
  const has = (day, relIdx) => (P.rel(STEM_EL[day.gz.s]) === relIdx ? 1 : 0) + (P.rel(BRANCH_EL[day.gz.b]) === relIdx ? 0.7 : 0);
  const rank = {
    interview: (x) => x.score + 0.35 * has(x, 3) + 0.15 * has(x, 4),
    confess: (x) => x.score + 0.35 * has(x, loveGod) + 0.2 * has(x, 1),
    move: (x) => (x.son ? x.score + 0.5 : -9),
    contract: (x) => x.score + 0.3 * has(x, 2) + 0.25 * has(x, 4),
  };
  PURPOSES.forEach((p) => {
    const top = days
      .map((x) => ({ x, v: rank[p.key](x) }))
      .filter((o) => o.v > 0.1)
      .sort((a, b) => b.v - a.v)
      .slice(0, p.key === "move" ? 2 : 3);
    top.forEach((o) => o.x.good.push(p.key));
  });
  return days;
}

// M&A 궁합 (재미용 지수)
//  corr: 향후 30년 연도별 수익률의 피어슨 상관 (같이 오르고 같이 쉬는 정도)
//  mutual: 서로의 일간 오행이 상대에게 유리한 오행인지 (favor 평균, -1~1)
//  comp: 한쪽에 없는(0~1개) 오행을 다른 쪽이 2개 이상 가진 비율
//  시너지(%) = 18·corr + 24·mutual + 16·comp + 2   → 대략 -40 ~ +60
export function merger(A, B, today = todayYmd()) {
  const from = today.y;
  const to = today.y + 29;
  const ra = yearlyReturns(A, from, to);
  const rb = yearlyReturns(B, from, to);
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const ma = mean(ra);
  const mb = mean(rb);
  let num = 0;
  let da = 0;
  let db = 0;
  ra.forEach((v, i) => {
    num += (v - ma) * (rb[i] - mb);
    da += (v - ma) ** 2;
    db += (rb[i] - mb) ** 2;
  });
  const corr = da && db ? num / Math.sqrt(da * db) : 0;
  const mutual = (A.favor[B.dmEl] + B.favor[A.dmEl]) / 2;
  const fills = [];
  let lacking = 0;
  [0, 1, 2, 3, 4].forEach((el) => {
    if (A.counts[el] <= 1) {
      lacking++;
      if (B.counts[el] >= 2) fills.push({ el, to: "A" });
    }
    if (B.counts[el] <= 1) {
      lacking++;
      if (A.counts[el] >= 2) fills.push({ el, to: "B" });
    }
  });
  const comp = lacking ? fills.length / lacking : 0.5;
  const synergy = Math.round(18 * corr + 24 * mutual + 16 * comp + 2);
  const bothUp = ra.filter((v, i) => v > 0.02 && rb[i] > 0.02).length;
  const label =
    synergy >= 25 ? { t: "우호적 합병", tone: "up" } : synergy >= 10 ? { t: "전략적 제휴", tone: "up" } : synergy >= -5 ? { t: "신중한 합병 검토", tone: "flat" } : { t: "적대적 인수 주의", tone: "down" };
  return { corr, mutual, comp, synergy, label, fills, bothUp, from, to };
}
