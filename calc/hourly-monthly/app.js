// hourly-monthly — 생활 계산기(2026-10-08). 틀은 shared/calc.js
import { runCalc, won, num } from "../../shared/calc.js";
// 월 환산시간 = (주 시간 + 주휴시간) × 365/7/12 를 반올림(주 40시간 → 209시간, 최저임금 고시와 같음)
const MIN = 10320;
runCalc({ slug: "calc/hourly-monthly", title: "시급 → 월급 계산기",
  fields: [
    { id: "wage", label: "시급", type: "money", def: MIN, unit: "원", min: 1, max: 1000000, chips: [10320, 11000, 12000, 15000] },
    { id: "days", label: "1주 근무일", type: "number", def: 5, unit: "일", min: 1, max: 7, chips: [3, 4, 5, 6], chipUnit: "일" },
    { id: "hpd", label: "하루 근무시간", type: "number", def: 8, unit: "시간", min: 0.5, max: 24, chips: [4, 5, 6, 8], chipUnit: "시간" },
  ],
  compute(v) {
    const wk = v.days * v.hpd, hol = wk >= 15 ? Math.min(wk, 40) / 40 * 8 : 0;
    const mh = Math.round((wk + hol) * 365 / 7 / 12);
    const pay = v.wage * mh, minPay = MIN * mh;
    return { value: pay, unit: "원", headline: "주휴수당 포함 한 달 월급(세전)",
      rows: [["1주 근무시간", `${num(wk, 1)}시간`], ["1주 주휴시간", `${num(hol, 2)}시간`], ["한 달 환산 시간", `${mh}시간`], ["같은 시간 최저임금 월급", won(minPay)], ["연봉 환산(×12)", won(pay * 12)]],
      notes: ["세금·4대보험을 떼기 전 금액이에요.", wk < 15 ? "1주 15시간 미만이라 주휴수당이 빠졌어요." : "주휴수당이 들어간 금액이에요."],
      warn: v.wage < MIN ? `시급이 2026년 최저임금(${won(MIN)})보다 낮아요. 같은 시간이면 최소 ${won(minPay)}이에요.` : "" };
  },
  guess: { label: "한 달 월급, 얼마일 것 같아?", range: (v) => [0, Math.round(v.wage * v.days * v.hpd * 6.5)] },
  base: "2026년 기준",
  basis: [["2026 최저임금", "시급 10,320원 / 월 2,156,880원(209시간)", "고용노동부 고시", "확정"], ["월 환산 시간", "(주 시간+주휴)×365÷7÷12 반올림", "최저임금 월 환산 방식", "확정"], ["주휴시간", "주 15시간 이상, 최대 8시간", "근로기준법 제55조", "확정"]],
});
