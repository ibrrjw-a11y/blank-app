"""업로드용 텍스트(제목·설명·고정댓글) + 올리기 전 점검표."""
from __future__ import annotations

import json

from . import config
from .job import Job
from .script import Script


def build(job: Job, s: Script, render_info: dict | None = None) -> dict:
    deal = job.deal
    link = deal.get("affiliate_url") or deal.get("url") or "(제휴 링크를 여기에)"
    disclosure = config.get("publish.disclosure")
    if not disclosure:
        raise ValueError("config.yaml 의 publish.disclosure(제휴 고지 문구)가 비어 있어 진행할 수 없습니다.")
    notice = config.get("publish.price_notice", "").format(checked_at=deal.get("checked_at", ""))
    tags = " ".join(config.get("publish.hashtags", []))
    price = f"{int(deal['price']):,}원" if deal.get("price") else ""
    orig = f" (정가 {int(deal['original_price']):,}원)" if deal.get("original_price") else ""

    yt_title = f"{s.title} #shorts"
    description = "\n".join(filter(None, [
        f"{deal['name']}  {price}{orig}",
        f"구매 링크: {link}",
        f"딜 종료: {deal['ends_at']}" if deal.get("ends_at") else "",
        "",
        notice,
        disclosure,
        "",
        tags,
    ]))
    pinned = "\n".join([
        f"👉 {deal['name']} 특가 링크: {link}",
        notice,
        disclosure,
    ])
    reels_caption = "\n".join([s.lines[0], "", f"{deal['name']} {price}", "링크는 프로필에 있어요", "", disclosure, tags])

    pack = {"youtube_title": yt_title, "description": description, "pinned_comment": pinned,
            "reels_caption": reels_caption, "link": link}
    job.p("publish.json").write_text(json.dumps(pack, ensure_ascii=False, indent=2), encoding="utf-8")

    first3 = s.lines[0]
    checks = [
        ("제휴 고지 문구가 설명란·고정 댓글에 있음", True),
        ("가격 기준 시각 문구 있음", bool(notice)),
        ("제목과 첫 줄이 다름", s.title.replace(" ", "") != first3.replace(" ", "")),
        ("제휴 링크가 채워짐", "(제휴 링크" not in link),
    ]
    md = [f"# 올리기 전 5분 점검: {job.id}", "",
          "## 자동 확인"]
    md += [f"- [{'x' if ok else ' '}] {label}" for label, ok in checks]
    md += ["", "## 사람이 확인",
           "- [ ] 소리 끄고 첫 3초만 봐도 뭔지 알겠다 (`render/preview_3s.gif`)",
           "- [ ] 가격이 지금 판매 페이지 가격과 같다",
           "- [ ] 대본을 입으로 읽었을 때 걸리는 줄이 없다",
           "- [ ] 가장 센 문장이 끝 쪽에 있다", ""]
    if render_info:
        md += [f"길이 {render_info['duration']}초 · 화면 {render_info['frames']}장", ""]
    md += ["## 업로드 텍스트", "", "### 유튜브 제목", yt_title, "", "### 설명", "```", description, "```",
           "", "### 고정 댓글", "```", pinned, "```", "", "### 릴스/틱톡 캡션", "```", reels_caption, "```", "",
           "## 올린 뒤", f"`hd video add {job.id} --youtube-id <영상ID>` 로 등록하면 성과 수집 대상이 됩니다."]
    job.p("review.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    return pack
