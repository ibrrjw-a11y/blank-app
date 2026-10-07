// annual-leave — 생활 계산기(2026-10-08). 틀은 shared/calc.js
import { runCalc, won, num } from "../../shared/calc.js";
// 근로기준법 제60조: 1년 미만 매월 1일(최대 11), 1년 이상 15일 + 3년차부터 2년마다 1일, 최대 25일. 5인 미만 미적용
const today = new Date().toISOString().slice(0, 10);
function monthsBetween(a, b) { let m = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth(); if (b.getDate() < a.getDate()) m--; return m; }
runCalc({ slug: "calc/annual-leave", title: "연차 계산기",
  fields: [
    { id: "join", label: "입사일", type: "date", def: "2024-03-02" },
    { id: "at", label: "기준일(보통 오늘)", type: "date", def: today },
    { id: "five", label: "회사가 5명 이상인가요?", type: "yesno", def: true },
  ],
  validate: (v) => (v.at < v.join ? "기준일이 입사일보다 앞이에요" : null),
  compute(v) {
    const a = new Date(v.join), b = new Date(v.at), m = monthsBetween(a, b), y = Math.floor(m / 12);
    if (!v.five) return { value: 0, unit: "일", fmt: (x) => `${num(x)}일`, headline: "5명 미만 회사 — 법정 연차 없음", rows: [["근속", `${y}년 ${m % 12}개월`]], notes: ["근로기준법 연차 규정은 5명 미만 사업장에 적용되지 않아요. 회사 규정을 확인해 주세요."] };
    let now, label;
    if (y < 1) { now = Math.min(11, Math.max(0, m)); label = "1년 미만 — 매달 1일씩 쌓인 연차"; }
    else { now = Math.min(25, 15 + Math.floor((y - 1) / 2)); label = `${y}년차 — 올해 생긴 연차`; }
    const next = y < 1 ? 15 : Math.min(25, 15 + Math.floor(y / 2));
    return { value: now, unit: "일", fmt: (x) => `${num(x)}일`, headline: label,
      rows: [["근속", `${y}년 ${m % 12}개월`], ["지금 연차", `${now}일`], [y < 1 ? "1년 되는 날 생길 연차" : "다음 해 연차", `${next}일`]],
      notes: ["입사일 기준 계산이에요. 회사가 1월 1일 기준으로 주면 날짜가 다를 수 있어요.", "1년 이상은 출근율 80% 이상이라고 보고 계산했어요."] };
  },
  guess: { label: "내 연차, 며칠일 것 같아?", range: () => [0, 26] },
  base: "2026년 기준",
  basis: [["발생 규칙", "1년 미만 매월 1일, 1년 이상 15일, 2년마다 +1, 최대 25", "근로기준법 제60조", "확정"], ["5인 미만", "연차 규정 미적용", "근로기준법 시행령 별표 1", "확정"]],
});
