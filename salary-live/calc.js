// 2026 연봉 실수령액 근사 계산 (DOM 없음, node에서 테스트 가능)
// 기준: 근로자 부담분, 연말정산 방식으로 연간 근로소득세를 구한 뒤 12로 나눈다.
// 실제 매달 떼는 금액은 국세청 간이세액표를 따르므로 차이가 있을 수 있다.

export const RATES_2026 = {
  pension: 0.0475, // 국민연금 9.5%의 절반
  pensionMax: 6370000, // 기준소득월액 상한
  pensionMin: 400000, // 기준소득월액 하한
  health: 0.03595, // 건강보험 7.19%의 절반
  care: 0.1314, // 장기요양 = 건강보험료 × 13.14% (근사)
  employ: 0.009, // 고용보험
  localTax: 0.1, // 지방소득세 = 소득세 × 10%
};

const floor10 = (n) => Math.max(0, Math.floor(n / 10) * 10);

// 근로소득공제 (한도 2,000만 원)
export function earnedIncomeDeduction(total) {
  let d;
  if (total <= 5_000_000) d = total * 0.7;
  else if (total <= 15_000_000) d = 3_500_000 + (total - 5_000_000) * 0.4;
  else if (total <= 45_000_000) d = 7_500_000 + (total - 15_000_000) * 0.15;
  else if (total <= 100_000_000) d = 12_000_000 + (total - 45_000_000) * 0.05;
  else d = 14_750_000 + (total - 100_000_000) * 0.02;
  return Math.min(20_000_000, Math.floor(d));
}

// 종합소득세 기본세율 (누진공제 방식)
const BRACKETS = [
  [14_000_000, 0.06, 0],
  [50_000_000, 0.15, 1_260_000],
  [88_000_000, 0.24, 5_760_000],
  [150_000_000, 0.35, 15_440_000],
  [300_000_000, 0.38, 19_940_000],
  [500_000_000, 0.4, 25_940_000],
  [1_000_000_000, 0.42, 35_940_000],
  [Infinity, 0.45, 65_940_000],
];

export function baseTax(taxBase) {
  if (taxBase <= 0) return 0;
  const [, rate, minus] = BRACKETS.find(([limit]) => taxBase <= limit);
  return Math.max(0, Math.floor(taxBase * rate - minus));
}

// 근로소득세액공제 (총급여에 따른 한도 적용)
export function earnedTaxCredit(calculated, total) {
  const raw = calculated <= 1_300_000 ? calculated * 0.55 : 715_000 + (calculated - 1_300_000) * 0.3;
  let limit;
  if (total <= 33_000_000) limit = 740_000;
  else if (total <= 70_000_000) limit = Math.max(660_000, 740_000 - (total - 33_000_000) * 0.008);
  else if (total <= 120_000_000) limit = Math.max(500_000, 660_000 - (total - 70_000_000) * 0.5);
  else limit = Math.max(200_000, 500_000 - (total - 120_000_000) * 0.5);
  return Math.floor(Math.min(raw, limit));
}

// 자녀세액공제 (8세 이상 20세 이하 자녀 기준)
export function childTaxCredit(n) {
  n = Math.max(0, Math.floor(n || 0));
  if (n === 0) return 0;
  if (n === 1) return 250_000;
  if (n === 2) return 550_000;
  return 550_000 + 400_000 * (n - 2);
}

/**
 * @param {object} p
 * @param {number} p.annual      세전 연봉 (비과세 포함)
 * @param {number} [p.nonTaxMonthly=200000] 월 비과세액 (식대 등)
 * @param {number} [p.dependents=1] 부양가족 수 (본인 포함)
 * @param {number} [p.children=0] 20세 이하 자녀 수
 */
export function calcNet({ annual, nonTaxMonthly = 200_000, dependents = 1, children = 0 } = {}) {
  const R = RATES_2026;
  annual = Math.max(0, Number(annual) || 0);
  const monthlyGross = annual / 12;
  const nonTax = Math.min(Math.max(0, Number(nonTaxMonthly) || 0), monthlyGross);
  const monthlyTaxable = Math.max(0, monthlyGross - nonTax);
  dependents = Math.max(1, Math.floor(Number(dependents) || 1));
  children = Math.max(0, Math.min(Math.floor(Number(children) || 0), dependents - 1));

  // 4대보험 (월)
  const pensionBase =
    monthlyTaxable <= 0 ? 0 : Math.min(R.pensionMax, Math.max(R.pensionMin, Math.floor(monthlyTaxable / 1000) * 1000));
  const pension = floor10(pensionBase * R.pension);
  const health = floor10(monthlyTaxable * R.health);
  const care = floor10(health * R.care);
  const employ = floor10(monthlyTaxable * R.employ);

  // 근로소득세 (연)
  const totalPay = Math.max(0, annual - nonTax * 12); // 총급여
  const earnedDed = earnedIncomeDeduction(totalPay);
  const earnedIncome = Math.max(0, totalPay - earnedDed); // 근로소득금액
  const personalDed = 1_500_000 * dependents;
  const pensionDed = pension * 12;
  const insuranceDed = (health + care + employ) * 12;
  const taxBase = Math.max(0, earnedIncome - personalDed - pensionDed - insuranceDed);
  const calculated = baseTax(taxBase);
  const credit = earnedTaxCredit(calculated, totalPay);
  const childCredit = childTaxCredit(children);
  const standardCredit = 130_000;
  const annualIncomeTax = Math.max(0, calculated - credit - childCredit - standardCredit);

  const incomeTax = floor10(annualIncomeTax / 12);
  const localTax = floor10(incomeTax * R.localTax);

  const deductions = pension + health + care + employ + incomeTax + localTax;
  const monthlyNet = Math.max(0, Math.round(monthlyGross - deductions));

  return {
    annual,
    monthlyGross: Math.round(monthlyGross),
    nonTax: Math.round(nonTax),
    monthlyTaxable: Math.round(monthlyTaxable),
    pension,
    health,
    care,
    employ,
    incomeTax,
    localTax,
    deductions,
    monthlyNet,
    annualNet: monthlyNet * 12,
    // 세전 시급 (주 40시간 + 주휴 = 월 209시간)
    hourlyGross: Math.round(monthlyGross / 209),
    tax: {
      totalPay,
      earnedDed,
      earnedIncome,
      personalDed,
      pensionDed,
      insuranceDed,
      taxBase,
      calculated,
      credit,
      childCredit,
      standardCredit,
      annualIncomeTax,
    },
  };
}

/* ---------- 근무 시간 / 초당 수입 ---------- */

// "09:30" → 570 (분)
export function toMin(hhmm) {
  const [h, m] = String(hhmm || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// 하루 근무 초 (점심시간 제외)
export function dailyWorkSeconds({ start, end, lunchStart, lunchMin }) {
  const s = toMin(start);
  let e = toMin(end);
  if (e <= s) e += 24 * 60; // 자정을 넘기는 근무
  const total = (e - s) * 60;
  const lunch = overlapMin(s, e, toMin(lunchStart), toMin(lunchStart) + (Number(lunchMin) || 0)) * 60;
  return Math.max(0, total - lunch);
}

function overlapMin(a1, a2, b1, b2) {
  return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
}

// 한 달 평균 근무일 = 주당 근무일 × 365 / 7 / 12
export function avgWorkDaysPerMonth(daysPerWeek) {
  return (daysPerWeek * 365) / 7 / 12;
}

// 초당 실수령 (원/초)
export function perSecond(monthlyNet, schedule) {
  const days = avgWorkDaysPerMonth(schedule.days.length || 5);
  const sec = dailyWorkSeconds(schedule) * days;
  return sec > 0 ? monthlyNet / sec : 0;
}

/**
 * 하루 중 특정 시각까지 일한 초 (점심시간 제외)
 * @param {number} nowSec 자정 이후 초
 */
export function workedSecondsAt(nowSec, schedule) {
  const s = toMin(schedule.start) * 60;
  let e = toMin(schedule.end) * 60;
  if (e <= s) e += 86400;
  const ls = toMin(schedule.lunchStart) * 60;
  const le = ls + (Number(schedule.lunchMin) || 0) * 60;
  const t = Math.min(Math.max(nowSec, s), e);
  const worked = t - s;
  const lunch = Math.max(0, Math.min(t, le) - Math.max(s, ls));
  return Math.max(0, worked - lunch);
}

// 현재 상태: before | work | lunch | after | off
export function workPhase(date, schedule) {
  const day = date.getDay();
  if (!schedule.days.includes(day)) return "off";
  const nowSec = date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds() + date.getMilliseconds() / 1000;
  const s = toMin(schedule.start) * 60;
  const e = toMin(schedule.end) * 60;
  const ls = toMin(schedule.lunchStart) * 60;
  const le = ls + (Number(schedule.lunchMin) || 0) * 60;
  if (nowSec < s) return "before";
  if (nowSec >= e) return "after";
  if (nowSec >= ls && nowSec < le) return "lunch";
  return "work";
}

// 다음 출근 시각
export function nextWorkStart(date, schedule) {
  const s = toMin(schedule.start);
  for (let i = 0; i < 8; i++) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + i, Math.floor(s / 60), s % 60, 0);
    if (schedule.days.includes(d.getDay()) && d > date) return d;
  }
  return null;
}

// 다음 월급날 (주말이면 직전 금요일로 당김). day가 그 달 마지막 날보다 크면 말일.
export function nextPayday(date, payday) {
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  for (let k = 0; k < 3; k++) {
    const y = today.getFullYear();
    const m = today.getMonth() + k;
    const last = new Date(y, m + 1, 0).getDate();
    const d = new Date(y, m, Math.min(payday, last));
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
    if (d >= today) return d;
  }
  return null;
}

export function daysBetween(a, b) {
  const A = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const B = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((B - A) / 86400000);
}

// 연봉별 실수령액 표 (SEO용)
export const TABLE_SALARIES = [
  24, 26, 28, 30, 32, 34, 36, 38, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100,
].map((m) => m * 1_000_000);

export function salaryTable(opts = {}) {
  return TABLE_SALARIES.map((annual) => {
    const r = calcNet({ annual, ...opts });
    return { annual, monthlyNet: r.monthlyNet, deductions: r.deductions, annualNet: r.annualNet };
  });
}
