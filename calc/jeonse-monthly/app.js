// jeonse-monthly — 생활 계산기(2026-10-08). 틀은 shared/calc.js
import { runCalc, won, num } from "../../shared/calc.js";
// 한 달 비용 비교: 전세 = 대출이자 + 자기자금 기회비용, 월세 = 월세 + 보증금 기회비용
runCalc({ slug: "calc/jeonse-monthly", title: "전세 vs 월세 계산기",
  fields: [
    { id: "j", label: "전세금", type: "money", def: 300000000, unit: "원", min: 1, max: 1e12, chips: [100000000, 200000000, 300000000, 500000000] },
    { id: "ratio", label: "전세금 중 대출 비율", type: "number", def: 70, unit: "%", min: 0, max: 100, chips: [0, 50, 70, 80], chipUnit: "%" },
    { id: "lr", label: "전세대출 금리", type: "number", def: 4.0, unit: "%", min: 0, max: 20, chips: [3, 3.5, 4, 4.5], chipUnit: "%" },
    { id: "dep", label: "월세 보증금", type: "money", def: 30000000, unit: "원", min: 0, max: 1e12, chips: [10000000, 30000000, 50000000, 100000000] },
    { id: "rent", label: "월세", type: "money", def: 1000000, unit: "원", min: 0, max: 1e9, chips: [500000, 800000, 1000000, 1500000] },
    { id: "or", label: "내 돈을 예금했다면 금리", type: "number", def: 3.0, unit: "%", min: 0, max: 20, chips: [2.5, 3, 3.5], chipUnit: "%", hint: "묶인 돈의 기회비용 계산에 써요" },
  ],
  compute(v) {
    const loan = v.j * v.ratio / 100, own = v.j - loan;
    const cj = loan * v.lr / 100 / 12 + own * v.or / 100 / 12;
    const cw = v.rent + v.dep * v.or / 100 / 12;
    const d = Math.round(cw - cj);
    return { value: d, unit: "원", fmt: (x) => (x >= 0 ? `전세가 월 ${won(x)} 쌈` : `월세가 월 ${won(-x)} 쌈`), headline: d > 0 ? "한 달에 전세가 더 싸요" : d < 0 ? "한 달에 월세가 더 싸요" : "한 달 비용이 같아요",
      rows: [["전세 한 달 비용", won(cj)], ["  대출 이자", won(loan * v.lr / 100 / 12)], ["  내 돈 기회비용", won(own * v.or / 100 / 12)], ["월세 한 달 비용", won(cw)], ["  보증금 기회비용", won(v.dep * v.or / 100 / 12)], ["2년 차이", won(Math.abs(d) * 24)]],
      notes: ["관리비·중개수수료·대출 부대비용·세금은 넣지 않았어요.", "기회비용은 실제로 나가는 돈은 아니지만 비교할 때 같이 봐야 해요."] };
  },
  guess: { label: "어느 쪽이 한 달에 얼마나 쌀까? (오른쪽 = 전세가 쌈)", range: (v, r) => { const a = Math.max(300000, Math.abs(r.value) * 2.2); return [-Math.round(a), Math.round(a)]; } },
  base: "계산식 기준",
  basis: [["비교 방식", "한 달 실제 비용 + 기회비용", "단순 비교 계산", "확정"], ["전월세 전환율 상한", "기준금리 + 2%p 와 10% 중 낮은 것", "주택임대차보호법 시행령 제9조", "확정(이 계산에는 안 씀)"]],
});
