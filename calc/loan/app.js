// loan — 생활 계산기(2026-10-08). 틀은 shared/calc.js
import { runCalc, won, num } from "../../shared/calc.js";
// 원리금균등 월상환 = P·i/(1−(1+i)^−n), 원금균등 총이자 = P·i·(n+1)/2, 만기일시 총이자 = P·i·n
runCalc({ slug: "calc/loan", title: "대출 이자 계산기",
  fields: [
    { id: "p", label: "빌린 돈", type: "money", def: 100000000, unit: "원", min: 1, max: 1e13, chips: [10000000, 50000000, 100000000, 300000000] },
    { id: "rate", label: "연 금리", type: "number", def: 4.5, unit: "%", min: 0.01, max: 40, chips: [3.5, 4, 4.5, 5, 6], chipUnit: "%" },
    { id: "months", label: "기간", type: "number", def: 360, unit: "개월", min: 1, max: 600, chips: [12, 60, 120, 360], chipUnit: "개월" },
    { id: "way", label: "갚는 방식", type: "select", def: "eq", options: [["eq", "원리금균등(매달 같은 돈)"], ["prin", "원금균등(점점 줄어듦)"], ["bullet", "만기일시(이자만 내다 끝에 원금)"]] },
  ],
  compute(v) {
    const i = v.rate / 100 / 12, n = v.months, P = v.p;
    const eq = P * i / (1 - Math.pow(1 + i, -n));
    let first, last, total;
    if (v.way === "eq") { first = last = eq; total = eq * n - P; }
    else if (v.way === "prin") { first = P / n + P * i; last = P / n + (P / n) * i; total = P * i * (n + 1) / 2; }
    else { first = P * i; last = P * i + P; total = P * i * n; }
    return { value: Math.round(total), unit: "원", headline: "다 갚을 때까지 내는 이자",
      rows: [["첫 달 갚을 돈", won(first)], ["마지막 달 갚을 돈", won(last)], ["총 갚을 돈", won(P + total)], ["비교: 원리금균등 총이자", won(eq * n - P)], ["비교: 원금균등 총이자", won(P * i * (n + 1) / 2)], ["비교: 만기일시 총이자", won(P * i * n)]],
      notes: ["금리가 기간 내내 같다고 보고 계산했어요. 중도상환수수료·보증료는 빠졌어요."] };
  },
  guess: { label: "총이자, 얼마일 것 같아?", range: (v) => [0, Math.round(v.p * v.rate / 100 / 12 * v.months * 1.2)] },
  base: "계산식 기준",
  basis: [["원리금균등", "P·i/(1−(1+i)^−n)", "금융 표준 공식", "확정"], ["원금균등", "총이자 P·i·(n+1)/2", "금융 표준 공식", "확정"], ["만기일시", "총이자 P·i·n", "금융 표준 공식", "확정"]],
});
