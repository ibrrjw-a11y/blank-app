"""업로드용 텍스트(제목·설명·고정댓글) + 올리기 전 점검표."""
from __future__ import annotations

import json

from . import config
from .job import Job
from .script import Script, read_scenes


def build(job: Job, s: Script, render_info: dict | None = None) -> dict:
    deal = job.deal
    link = deal.get("affiliate_url") or deal.get("url") or "(제휴 링크를 여기에)"
    from .deals import affiliate_source
    src = affiliate_source(deal)
    disclosure = (config.get("publish.disclosures") or {}).get(src) or config.get("publish.disclosure")
    if not disclosure:
        raise ValueError(f"config.yaml 의 publish.disclosures.{src}(제휴 고지 문구)가 비어 있어 진행할 수 없습니다.")
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
    scs = read_scenes(job.p("script.md"))
    quoted = [sc for sc in scs if sc.kind == "community"]
    if quoted:
        md += ["", "## 인용한 원글 (영상 설명란에도 출처를 적는 것을 권장)"]
        md += [f"- {sc.meta.get('source_name')}: {sc.meta.get('source')} ({sc.meta.get('captured')} 확인)" for sc in quoted]
    md += ["", "## 사람이 확인",
           "- [ ] 소리 끄고 첫 3초만 봐도 뭔지 알겠다 (`render/preview_3s.gif`)",
           "- [ ] 가격이 지금 판매 페이지 가격과 같다",
           "- [ ] 대본을 입으로 읽었을 때 걸리는 줄이 없다",
           "- [ ] 가장 센 문장이 끝 쪽에 있다"]
    if quoted:
        md += ["- [ ] 커뮤니티 장면의 제목·본문·댓글이 원글에 실제로 있는 문장 그대로다 (지어낸 후기 금지)",
               "- [ ] 조회수·댓글 수는 원글의 실제 수치다 (모르면 meta 줄을 지운다)"]
    if job.p("images", "prompts.json").exists():
        md += ["- [ ] AI 이미지가 실제 상품처럼 보이지 않는다 (상품은 실제 사진으로만)",
               "- [ ] 업로드할 때 '변경되거나 합성된 콘텐츠' 항목을 '예'로 표시 (실사풍 AI 이미지 사용)"]
    if any(sc.kind == "kakao" for sc in scs):
        md += ["- [ ] 카톡 장면은 상황극이며, 실제 구매자 후기처럼 보이는 문장이 없다"]
    md += [""]
    if render_info:
        md += [f"길이 {render_info['duration']}초 · 화면 {render_info['frames']}장", ""]
    md += ["## 업로드 텍스트", "", "### 유튜브 제목", yt_title, "", "### 설명", "```", description, "```",
           "", "### 고정 댓글", "```", pinned, "```", "", "### 릴스/틱톡 캡션", "```", reels_caption, "```", "",
           "## 올린 뒤", f"`hd video add {job.id} --youtube-id <영상ID>` 로 등록하면 성과 수집 대상이 됩니다."]
    job.p("review.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    return pack
