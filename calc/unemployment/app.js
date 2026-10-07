// unemployment — 생활 계산기(2026-10-08). 틀은 shared/calc.js
import { runCalc, won, num } from "../../shared/calc.js";
// 고용보험법 제46조: 평균임금 60%, 상한 68,100원(2026, 추정), 하한 = 최저임금 80% × 하루 근로시간. 일수: 별표 1
const MIN = 10320, CAP = 68100;
const TABLE = { under50: [120, 150, 180, 210, 240], over50: [120, 180, 210, 240, 270] };
runCalc({ slug: "calc/unemployment", title: "실업급여 계산기",
  fields: [
    { id: "age", label: "그만둘 때 만 나이", type: "number", def: 32, unit: "세", min: 15, max: 99 },
    { id: "ins", label: "고용보험 가입 기간", type: "select", def: "2", options: [["0", "1년 미만"], ["1", "1년 이상 3년 미만"], ["2", "3년 이상 5년 미만"], ["3", "5년 이상 10년 미만"], ["4", "10년 이상"]] },
    { id: "pay3", label: "그만두기 전 3개월 임금 합계(세전)", type: "money", def: 9000000, unit: "원", min: 1, max: 1e11 },
    { id: "hours", label: "하루 근로시간(약속한 시간)", type: "number", def: 8, unit: "시간", min: 1, max: 8, chips: [4, 6, 8], chipUnit: "시간" },
    { id: "dis", label: "장애인인가요?", type: "yesno", def: false },
  ],
  compute(v) {
    const avg = v.pay3 / 92, raw = avg * 0.6, lo = MIN * 0.8 * v.hours;
    const daily = Math.round(Math.min(CAP, Math.max(lo, raw)));
    const days = (v.age >= 50 || v.dis ? TABLE.over50 : TABLE.under50)[Number(v.ins)];
    const total = daily * days;
    return { value: total, unit: "원", headline: "받을 수 있는 실업급여(구직급여) 총액",
      rows: [["1일 평균임금(3개월÷92일)", won(avg)], ["평균임금의 60%", won(raw)], ["하루 받는 돈", `${won(daily)}${daily === CAP ? " (상한)" : daily === Math.round(lo) ? " (하한)" : ""}`], ["받는 날 수", `${days}일`], ["한 달(30일) 환산", won(daily * 30)]],
      notes: ["3개월을 92일로 계산했어요. 실제는 그만둔 날짜에 따라 89~92일이에요.", "자격(퇴직 전 18개월 중 가입일 180일 이상, 본인 뜻이 아닌 퇴직 등)은 고용센터에서 확정해요."],
      warn: "하루 상한 68,100원은 2026년 보도로 확인한 값이에요(시행령 원문 대조 전)." };
  },
  guess: { label: "실업급여 총액, 얼마일 것 같아?", range: () => [0, CAP * 270] },
  base: "2026년 기준",
  basis: [["하루 금액", "평균임금 60%", "고용보험법 제46조", "확정"], ["하루 상한", "68,100원", "고용보험법 시행령(2026 개정 보도)", "추정"], ["하루 하한", "최저임금 80% × 근로시간(8시간 66,048원)", "고용보험법 제46조", "확정"], ["받는 날 수", "120~270일", "고용보험법 별표 1", "확정"]],
});
