// gift-tax — 생활 계산기(2026-10-08). 틀은 shared/calc.js
import { runCalc, won, num } from "../../shared/calc.js";
// 상속세 및 증여세법: 공제 제53조, 혼인출산 제53조의2(+1억), 세율 제26조, 신고세액공제 제69조 3%
const DED = { spouse: 600000000, parentAdult: 50000000, parentMinor: 20000000, child: 50000000, kin: 10000000, other: 0 };
const tax = (b) => (b <= 0 ? 0 : b <= 1e8 ? b * 0.1 : b <= 5e8 ? b * 0.2 - 1e7 : b <= 1e9 ? b * 0.3 - 6e7 : b <= 3e9 ? b * 0.4 - 1.6e8 : b * 0.5 - 4.6e8);
runCalc({ slug: "calc/gift-tax", title: "증여세 계산기",
  fields: [
    { id: "rel", label: "주는 사람은 받는 사람의", type: "select", def: "parentAdult", options: [["parentAdult", "부모·조부모 (받는 사람 성인)"], ["parentMinor", "부모·조부모 (받는 사람 미성년)"], ["spouse", "배우자"], ["child", "자녀·손주 (부모가 받음)"], ["kin", "그 밖의 친척(6촌 혈족·4촌 인척)"], ["other", "남(친구 등)"]] },
    { id: "amt", label: "이번에 받는 돈", type: "money", def: 100000000, unit: "원", min: 1, max: 1e13, chips: [50000000, 100000000, 300000000, 500000000] },
    { id: "prior", label: "최근 10년 안에 같은 쪽에서 받은 돈", type: "money", def: 0, unit: "원", min: 0, max: 1e13, optional: true, hint: "부모는 아빠·엄마를 합쳐 한 사람으로 봐요" },
    { id: "wed", label: "결혼·출산 공제(결혼 전후 2년·출산 2년 안, 부모·조부모에게)", type: "yesno", def: false },
  ],
  compute(v) {
    const parent = v.rel === "parentAdult" || v.rel === "parentMinor";
    const ded = DED[v.rel] + (v.wed && parent ? 1e8 : 0);
    const prior = v.prior || 0;
    const calc = Math.max(0, tax(prior + v.amt - ded) - tax(prior - ded)), final = Math.round(calc * 0.97);
    return { value: final, unit: "원", headline: final ? "신고 기한 안에 내면 증여세" : "증여세 0원 — 공제 안에 들어와요",
      rows: [["공제 한도(10년)", won(ded)], ["10년 합산 받은 돈", won(prior + v.amt)], ["과세 금액", won(Math.max(0, prior + v.amt - ded))], ["산출세액(이번 몫)", won(calc)], ["신고세액공제 3% 뒤", won(final)]],
      notes: ["받은 날이 속한 달 말일부터 3개월 안에 신고하면 3%를 깎아 줘요.", "손주에게 바로 주는 세대생략 할증(30·40%)은 넣지 않았어요."],
      warn: v.wed && !parent ? "결혼·출산 공제는 부모·조부모에게 받을 때만 돼요." : "" };
  },
  guess: { label: "증여세, 얼마일 것 같아?", range: (v) => [0, Math.round(Math.max(5e6, (v.amt + (v.prior || 0)) * 0.3))] },
  base: "2026년 기준",
  basis: [["관계별 공제", "배우자 6억·성인 자녀 5천만·미성년 2천만·부모 5천만·친척 1천만", "상속세 및 증여세법 제53조", "확정"], ["혼인·출산 공제", "추가 1억", "같은 법 제53조의2", "확정"], ["세율", "10~50% 5구간", "같은 법 제26조", "확정"], ["신고세액공제", "3%", "같은 법 제69조", "확정"], ["2026년 개편", "변경 여부", "개편 논의", "근거약함 — 확인 필요"]],
});
