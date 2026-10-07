// parental-leave — 생활 계산기(2026-10-08). 틀은 shared/calc.js
import { runCalc, won, num } from "../../shared/calc.js";
// 고용보험법 시행령 제95조(2025.1 시행): 1~3개월 100%·상한 250만, 4~6개월 100%·상한 200만, 7개월~ 80%·상한 160만, 하한 70만
function month(k, w) { const [rate, cap] = k <= 3 ? [1, 2500000] : k <= 6 ? [1, 2000000] : [0.8, 1600000]; return Math.max(700000, Math.min(cap, w * rate)); }
runCalc({ slug: "calc/parental-leave", title: "육아휴직 급여 계산기",
  fields: [
    { id: "w", label: "월 통상임금(세전)", type: "money", def: 3500000, unit: "원", min: 1, max: 1e9, chips: [2500000, 3000000, 4000000, 5000000] },
    { id: "m", label: "쉬는 개월 수", type: "number", def: 12, unit: "개월", min: 1, max: 12, chips: [3, 6, 12], chipUnit: "개월" },
  ],
  compute(v) {
    const list = Array.from({ length: v.m }, (_, i) => month(i + 1, v.w));
    const total = list.reduce((a, b) => a + b, 0);
    const rows = [["1~3개월(달마다)", won(list[0])]];
    if (v.m > 3) rows.push(["4~6개월(달마다)", won(list[3])]);
    if (v.m > 6) rows.push(["7개월부터(달마다)", won(list[6])]);
    rows.push(["다 합쳐", won(total)]);
    return { value: total, unit: "원", headline: `${v.m}개월 육아휴직 급여 총액`, rows,
      notes: ["2025년부터 쉬는 동안 전액을 받아요(사후지급 폐지).", "부부가 같이 쓰는 6+6 특례는 첫 6개월 상한이 더 높은데, 이 계산에는 넣지 않았어요."] };
  },
  guess: { label: "육아휴직 급여 총액, 얼마일 것 같아?", range: (v) => [0, Math.round(2500000 * v.m * 1.1)] },
  base: "2026년 기준",
  basis: [["1~3개월", "100%, 상한 250만 원", "고용보험법 시행령 제95조", "확정"], ["4~6개월", "100%, 상한 200만 원", "같은 조", "확정"], ["7개월~", "80%, 상한 160만 원", "같은 조", "확정"], ["하한", "70만 원", "같은 조", "확정"]],
});
