// vat — 생활 계산기(2026-10-08). 틀은 shared/calc.js
import { runCalc, won, num } from "../../shared/calc.js";
// 부가가치세법 제30조 세율 10%
runCalc({ slug: "calc/vat", title: "부가세 계산기",
  fields: [
    { id: "amt", label: "금액", type: "money", def: 55000, unit: "원", min: 1, max: 1e13, chips: [11000, 55000, 110000, 1100000] },
    { id: "inc", label: "이 금액은", type: "select", def: "in", options: [["in", "부가세 포함 금액(소비자가)"], ["ex", "부가세 별도 금액(공급가)"]] },
  ],
  compute(v) {
    const supply = v.inc === "in" ? Math.round(v.amt / 1.1) : v.amt, tax = v.inc === "in" ? v.amt - supply : Math.round(v.amt * 0.1);
    return { value: tax, unit: "원", headline: v.inc === "in" ? "이 가격 속에 숨은 부가세" : "더 붙는 부가세",
      rows: [["공급가액", won(supply)], ["부가세(10%)", won(tax)], ["합계", won(supply + tax)]],
      notes: ["원 단위 아래는 반올림했어요."] };
  },
  guess: { label: "부가세, 얼마일 것 같아?", range: (v) => [0, Math.round(v.amt * 0.2)] },
  base: "2026년 기준",
  basis: [["부가세율", "10%", "부가가치세법 제30조", "확정"]],
});
