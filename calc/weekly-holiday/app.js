// weekly-holiday — 생활 계산기(2026-10-08). 틀은 shared/calc.js
import { runCalc, won, num } from "../../shared/calc.js";
// 주휴수당 = (1주 소정근로시간 ÷ 40) × 8 × 시급, 15시간 이상·개근일 때만, 40시간 넘어도 8시간분까지
const MIN = 10320;
runCalc({ slug: "calc/weekly-holiday", title: "주휴수당 계산기",
  fields: [
    { id: "wage", label: "시급", type: "money", def: MIN, unit: "원", min: 1, max: 1000000, chips: [10320, 11000, 12000, 15000] },
    { id: "hours", label: "1주 근무시간(약속한 시간)", type: "number", def: 20, unit: "시간", min: 0, max: 68, chips: [15, 20, 25, 30, 40], chipUnit: "시간" },
    { id: "full", label: "이번 주 약속한 날 다 나갔나요?(개근)", type: "yesno", def: true },
  ],
  compute(v) {
    const ok = v.hours >= 15 && v.full;
    const h = ok ? Math.min(v.hours, 40) / 40 * 8 : 0;
    const pay = Math.round(h * v.wage);
    return { value: pay, unit: "원", headline: ok ? "이번 주 주휴수당" : "이번 주 주휴수당 — 조건이 안 돼요",
      rows: [["주휴 시간", `${num(h, 2)}시간`], ["주휴수당(1주)", won(pay)], ["한 달 환산(×4.345주)", won(pay * 4.345)], ["주휴 포함 1주 급여", won(v.wage * v.hours + pay)]],
      notes: [v.hours < 15 ? "1주 소정근로시간이 15시간 미만이라 주휴수당이 생기지 않아요." : !v.full ? "약속한 날을 다 나오지 않은 주에는 주휴수당이 없어요(지각·조퇴는 결근 아님)." : "5명 미만 사업장에도 똑같이 적용돼요."],
      warn: v.wage < MIN ? `시급이 2026년 최저임금(${won(MIN)})보다 낮아요.` : "" };
  },
  guess: { label: "이번 주 주휴수당, 얼마일 것 같아?", range: (v) => [0, Math.round(v.wage * 8 * 1.5)] },
  base: "2026년 기준",
  basis: [["주휴 발생 조건", "주 15시간 이상·개근", "근로기준법 제55조, 시행령 제30조", "확정"], ["계산식", "주 시간÷40×8×시급(최대 8시간)", "고용노동부 행정해석", "확정"], ["2026 최저임금", "시급 10,320원", "고용노동부 고시", "확정"], ["5인 미만", "적용", "근로기준법 시행령 별표 1", "확정"]],
});
