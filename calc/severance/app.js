// severance — 생활 계산기(2026-10-08). 틀은 shared/calc.js
import { runCalc, won, num } from "../../shared/calc.js";
// 근로자퇴직급여 보장법 제8조: 1일 평균임금 × 30 × 근속일수/365. 평균임금 = 직전 3개월 임금 총액 ÷ 그 기간 총일수(근로기준법 제2조)
const day = 864e5;
runCalc({ slug: "calc/severance", title: "퇴직금 계산기",
  fields: [
    { id: "join", label: "입사일", type: "date", def: "2022-03-02" },
    { id: "last", label: "마지막 근무일", type: "date", def: "2026-09-30" },
    { id: "pay3", label: "그만두기 전 3개월 임금 합계(세전)", type: "money", def: 10500000, unit: "원", min: 1, max: 1e11, hint: "기본급·수당 등 3개월 동안 받은 임금을 모두 더해요" },
    { id: "bonus", label: "1년 동안 받은 상여금(없으면 0)", type: "money", def: 0, unit: "원", min: 0, max: 1e11, optional: true },
    { id: "leave", label: "1년 동안 받은 연차수당(없으면 0)", type: "money", def: 0, unit: "원", min: 0, max: 1e10, optional: true },
  ],
  validate: (v) => (v.last < v.join ? "마지막 근무일이 입사일보다 앞이에요" : null),
  compute(v) {
    const join = new Date(v.join), end = new Date(new Date(v.last).getTime() + day);
    const work = Math.round((end - join) / day);
    const from = new Date(end); from.setMonth(from.getMonth() - 3);
    const d3 = Math.round((end - from) / day);
    const avg = (v.pay3 + (v.bonus || 0) * 3 / 12 + (v.leave || 0) * 3 / 12) / d3;
    if (work < 365) return { value: 0, unit: "원", headline: "근속 1년 미만 — 퇴직금 없음", rows: [["근속일수", `${num(work)}일`]], notes: ["퇴직금은 1년 이상(주 15시간 이상) 일했을 때 생겨요."] };
    const sev = Math.round(avg * 30 * work / 365);
    return { value: sev, unit: "원", headline: "세전 퇴직금",
      rows: [["근속일수", `${num(work)}일 (${num(work / 365, 2)}년)`], ["평균임금 계산 기간", `${d3}일`], ["1일 평균임금", won(avg)], ["30일분 평균임금", won(avg * 30)], ["퇴직금(세전)", won(sev)]],
      notes: ["퇴직소득세를 떼기 전 금액이에요.", "평균임금이 통상임금보다 적으면 통상임금으로 계산해요(이 계산기는 반영 안 함)."] };
  },
  guess: { label: "내 퇴직금, 얼마일 것 같아?", range: (v) => { const y = Math.max(1, (new Date(v.last) - new Date(v.join)) / day / 365); return [0, Math.round(v.pay3 / 3 * y * 1.6)]; } },
  base: "2026년 기준",
  basis: [["퇴직금", "평균임금 30일분 × 근속연수", "근로자퇴직급여 보장법 제8조", "확정"], ["평균임금", "직전 3개월 임금 ÷ 총일수", "근로기준법 제2조", "확정"], ["상여·연차수당", "1년치의 3/12 반영", "고용노동부 행정해석", "확정"], ["대상", "1년 이상, 주 15시간 이상(5인 미만 포함)", "같은 법 제4조", "확정"]],
});
