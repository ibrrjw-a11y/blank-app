// insta-engagement — 생활 계산기(2026-10-08). 틀은 shared/calc.js
import { runCalc, won, num } from "../../shared/calc.js";
// 참여율 = (평균 좋아요 + 평균 댓글) ÷ 팔로워 × 100 (정의식). 업계 평균은 조사마다 달라 표시하지 않음
runCalc({ slug: "calc/insta-engagement", title: "인스타 참여율 계산기",
  fields: [
    { id: "f", label: "팔로워 수", type: "money", def: 5000, unit: "명", min: 1, max: 1e10 },
    { id: "l", label: "최근 게시물 평균 좋아요", type: "money", def: 180, unit: "개", min: 0, max: 1e9 },
    { id: "c", label: "최근 게시물 평균 댓글", type: "money", def: 12, unit: "개", min: 0, max: 1e9 },
  ],
  compute(v) {
    const e = (v.l + v.c) / v.f * 100;
    return { value: Math.round(e * 100) / 100, unit: "%", fmt: (x) => `${num(x, 2)}%`, headline: "내 계정 참여율",
      rows: [["반응 수(좋아요+댓글)", `${num(v.l + v.c)}개`], ["팔로워", `${num(v.f)}명`], ["팔로워 100명당 반응", `${num(e, 2)}개`]],
      notes: ["업계 평균은 조사마다 달라서 보여 주지 않아요. 친구 계정과 비교해 보세요."] };
  },
  guess: { label: "내 참여율, 몇 % 같아?", range: (v, r) => [0, Math.max(10, Math.ceil(r.value * 2.2))] },
  base: "정의식 기준",
  basis: [["참여율", "(좋아요+댓글) ÷ 팔로워 × 100", "정의식", "확정"]],
});
