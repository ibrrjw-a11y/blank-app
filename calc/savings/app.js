// savings — 생활 계산기(2026-10-08). 틀은 shared/calc.js
import { runCalc, won, num } from "../../shared/calc.js";
// 단리. 예금: P×r×n/12, 적금: 월납×r/12×n(n+1)/2. 이자소득세 15.4%(소득세 14 + 지방 1.4)
runCalc({ slug: "calc/savings", title: "예금·적금 이자 계산기",
  fields: [
    { id: "kind", label: "종류", type: "select", def: "save", options: [["save", "적금(매달 넣기)"], ["dep", "예금(한 번에 넣기)"]] },
    { id: "amt", label: "금액(적금은 매달)", type: "money", def: 500000, unit: "원", min: 1, max: 1e12, chips: [100000, 300000, 500000, 1000000, 10000000] },
    { id: "rate", label: "연 금리", type: "number", def: 3.5, unit: "%", min: 0.01, max: 30, chips: [2.5, 3, 3.5, 4, 5], chipUnit: "%" },
    { id: "months", label: "기간", type: "number", def: 12, unit: "개월", min: 1, max: 120, chips: [6, 12, 24, 36], chipUnit: "개월" },
    { id: "tax", label: "세금", type: "select", def: "gen", options: [["gen", "일반 과세(15.4%)"], ["free", "비과세"]] },
  ],
  compute(v) {
    const r = v.rate / 100, n = v.months;
    const principal = v.kind === "save" ? v.amt * n : v.amt;
    const interest = v.kind === "save" ? v.amt * r / 12 * n * (n + 1) / 2 : v.amt * r * n / 12;
    const tax = v.tax === "gen" ? Math.floor(interest * 0.14 / 10) * 10 + Math.floor(interest * 0.014 / 10) * 10 : 0;
    const net = Math.round(interest) - tax;
    return { value: net, unit: "원", headline: "세금 떼고 받는 이자",
      rows: [["넣은 원금", won(principal)], ["세전 이자", won(interest)], ["세금", won(tax)], ["만기에 받는 돈", won(principal + net)]],
      notes: ["단리 기준이에요. 세금은 소득세 14%와 지방소득세 1.4%를 각각 10원 아래 버림으로 계산했어요.", v.kind === "save" ? "적금은 첫 달 넣은 돈만 기간 내내 이자가 붙고, 마지막 달 넣은 돈은 한 달치만 붙어서 생각보다 적어요." : ""].filter(Boolean) };
  },
  guess: { label: "세금 떼고 받는 이자, 얼마일 것 같아?", range: (v) => { const p = v.kind === "save" ? v.amt * v.months : v.amt; return [0, Math.round(p * v.rate / 100 * v.months / 12 * 1.4)]; } },
  base: "2026년 기준",
  basis: [["이자소득 원천징수", "14% + 지방소득세 1.4% = 15.4%", "소득세법 제129조, 지방세법", "확정"], ["계산식", "단리", "은행 정기 예·적금 일반", "확정"]],
});
