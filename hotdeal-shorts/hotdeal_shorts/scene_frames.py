"""커뮤니티 인용 장면·카톡 상황극 장면 그리기.

- 커뮤니티: 실제 글 인용. 출처명·원글 확인 날짜를 항상 표시, 닉네임은 '익명N'으로 가림.
  본문은 처음부터 보이고, 댓글은 읽는 순서대로 하나씩 나타나며 읽는 중인 항목을 강조한다.
- 카톡: 채널이 만든 상황극. '연출된 대화' 표시는 끌 수 없다.
플랫폼 로고·화면을 그대로 복제하지 않고, 색·글자 위계·구조만 참고한 일반형 디자인.
"""
from __future__ import annotations

from PIL import Image, ImageDraw

from . import config
from .frames import display_text, font, hex_rgb, wrap
from .scenes import Scene

# 장면 영역 (배너·고정 제목 아래, 쇼츠 하단 UI 위)
AREA = (40, 330, 1040, 1480)

COMMUNITY_THEMES = {
    # 무채색 게시판형
    "theqoo": {"accent": "#7A6FF0", "page": "#F2F2F5", "card": "#FFFFFF", "title": "#1F1F24", "meta": "#9A9AA2",
               "body": "#2A2A30", "nick": "#8A8A92", "line": "#ECECF0", "avatar": False, "zebra": False,
               "header_fill": False},
    # 파란 헤더 + 줄무늬 댓글
    "dc": {"accent": "#3B4890", "page": "#E9EBF3", "card": "#FFFFFF", "title": "#1B1E2E", "meta": "#8C90A3",
           "body": "#23263A", "nick": "#3B4890", "line": "#DADDEA", "avatar": False, "zebra": True,
           "header_fill": True},
    # 초록 포인트 + 동그란 프로필
    "cafe": {"accent": "#03C75A", "page": "#F1F5F2", "card": "#FFFFFF", "title": "#1A1F1C", "meta": "#8F9892",
             "body": "#242A26", "nick": "#2E3431", "line": "#E6ECE8", "avatar": True, "zebra": False,
             "header_fill": False},
}
HIGHLIGHT = (255, 243, 191)


def chrome(W: int, H: int, title: str) -> Image.Image:
    """모든 인용·카톡 장면 공통: 채널 배너 + 고정 제목 (게시글형과 같은 브랜드 머리)."""
    from .frames import BANNER_H, _draw_chevrons, _draw_tag_icon, fit_text
    ink = hex_rgb(config.get("channel.ink", "#1C1C1E"))
    img = Image.new("RGB", (W, H), (255, 255, 255))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, BANNER_H], fill=hex_rgb(config.get("channel.color", "#FFE08A")))
    _draw_chevrons(d, 55, 58, 74, ink)
    name = config.get("channel.name", "오늘의 핫딜")
    d.text((W / 2 + 10, BANNER_H / 2 + 4), name, font=fit_text(d, name, W - 420, 104, 64), fill=ink, anchor="mm")
    _draw_tag_icon(d, W - 115, BANNER_H // 2, 120, ink)
    d.text((W / 2, 258), title, font=fit_text(d, title, W - 130, 52, 38), fill=ink, anchor="mm")
    d.line([(0, 305), (W, 305)], fill=(222, 222, 226), width=3)
    return img


# ------------------------------------------------------------------ 커뮤니티

def _community_canvas(scene: Scene, upto: int, width: int) -> tuple[Image.Image, int]:
    """카드 전체를 세로로 긴 캔버스에 그리고, 읽는 중인 항목의 아래 끝 y를 돌려준다."""
    t = COMMUNITY_THEMES.get(scene.style, COMMUNITY_THEMES["theqoo"])
    acc, pad = hex_rgb(t["accent"]), 44
    inner = width - pad * 2
    canvas = Image.new("RGB", (width, 6000), hex_rgb(t["card"]))
    d = ImageDraw.Draw(canvas)
    y = 0

    # 출처 줄
    src = f"출처 · {scene.meta.get('source_name', '')}"
    cap = f"{scene.meta.get('captured', '')} 확인"
    if t["header_fill"]:
        d.rectangle([0, 0, width, 92], fill=acc)
        d.text((pad, 46), src, font=font(34), fill=(255, 255, 255), anchor="lm")
        d.text((width - pad, 46), cap, font=font(28, "regular"), fill=(220, 224, 240), anchor="rm")
        y = 120
    else:
        d.rectangle([0, 0, width, 10], fill=acc)
        d.text((pad, 60), src, font=font(34), fill=acc, anchor="lm")
        d.text((width - pad, 60), cap, font=font(28, "regular"), fill=hex_rgb(t["meta"]), anchor="rm")
        y = 110

    # 제목·메타
    tf = font(50)
    for ln in wrap(d, scene.meta.get("title", ""), tf, inner, 2):
        d.text((pad, y), ln, font=tf, fill=hex_rgb(t["title"]))
        y += 66
    if scene.meta.get("meta"):
        d.text((pad, y + 4), scene.meta["meta"], font=font(30, "regular"), fill=hex_rgb(t["meta"]))
        y += 50
    y += 16
    d.line([(pad, y), (width - pad, y)], fill=hex_rgb(t["line"]), width=2)
    y += 30

    bf, cf, nf = font(42, "regular"), font(40, "regular"), font(30)
    current_bottom = y
    n_comment = 0
    comments_started = False
    for i, it in enumerate(scene.items):
        if it.role == "comment" and i > upto:
            break  # 아직 안 읽은 댓글은 숨김
        text = display_text(it.text)
        if it.role == "body":
            lines = wrap(d, text, bf, inner, 12)
            h = len(lines) * 58 + 18
            if i == upto:
                d.rounded_rectangle([pad - 16, y - 8, width - pad + 16, y + h - 4], 16, fill=HIGHLIGHT)
            for k, ln in enumerate(lines):
                d.text((pad, y + k * 58), ln, font=bf, fill=hex_rgb(t["body"]))
            y += h
        else:
            if not comments_started:
                comments_started = True
                y += 14
                d.rectangle([0, y, width, y + 12], fill=hex_rgb(t["page"]))
                y += 34
                d.text((pad, y), "댓글", font=font(34), fill=hex_rgb(t["title"]))
                y += 62
            n_comment += 1
            x_text = pad + (84 if t["avatar"] else 0)
            lines = wrap(d, text, cf, inner - (x_text - pad), 6)
            h = 50 + len(lines) * 54 + 26
            if t["zebra"] and n_comment % 2 == 0:
                d.rectangle([0, y - 10, width, y + h - 10], fill=(247, 248, 252))
            if i == upto:
                d.rounded_rectangle([pad - 16, y - 10, width - pad + 16, y + h - 14], 16, fill=HIGHLIGHT)
            if t["avatar"]:
                d.ellipse([pad, y, pad + 64, y + 64], fill=(214, 222, 217))
            d.text((x_text, y), f"익명{n_comment}", font=nf, fill=hex_rgb(t["nick"]))
            for k, ln in enumerate(lines):
                d.text((x_text, y + 48 + k * 54), ln, font=cf, fill=hex_rgb(t["body"]))
            y += h
            d.line([(pad, y - 12), (width - pad, y - 12)], fill=hex_rgb(t["line"]), width=1)
        if i == upto:
            current_bottom = y
    return canvas.crop((0, 0, width, max(y + 30, 200))), current_bottom


def render_community(base: Image.Image, scene: Scene, upto: int) -> Image.Image:
    t = COMMUNITY_THEMES.get(scene.style, COMMUNITY_THEMES["theqoo"])
    x0, y0, x1, y1 = AREA
    img = base.copy()
    d = ImageDraw.Draw(img)
    d.rectangle([0, 306, img.width, y1 + 20], fill=hex_rgb(t["page"]))
    card, cur_bottom = _community_canvas(scene, upto, x1 - x0)
    area_h = y1 - y0
    # 읽는 중인 항목이 화면 안에 들어오도록 스크롤
    offset = max(0, min(cur_bottom + 60 - area_h, card.height - area_h))
    view = card.crop((0, offset, card.width, min(card.height, offset + area_h)))
    mask = Image.new("L", view.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, view.width - 1, view.height - 1], 26, fill=255)
    img.paste(view, (x0, y0), mask)
    return img


# ------------------------------------------------------------------ 카톡 (상황극)

KAKAO_BG, KAKAO_ME, KAKAO_OTHER = (178, 199, 218), (254, 229, 0), (255, 255, 255)
ME_NAMES = {"나", "me", "본인", "채널"}


def render_kakao(base: Image.Image, scene: Scene, upto: int) -> Image.Image:
    x0, y0, x1, y1 = AREA
    W = base.width
    img = base.copy()
    d = ImageDraw.Draw(img)
    d.rectangle([0, 306, W, y1 + 20], fill=KAKAO_BG)

    # 상단: 방 이름 + 연출 표시 (항상)
    room = scene.style or "대화방"
    d.rectangle([0, 306, W, 400], fill=(165, 187, 208))
    d.text((60, 353), room, font=font(38), fill=(30, 36, 44), anchor="lm")
    badge = "연출된 대화"
    bf = font(30)
    bw = d.textlength(badge, font=bf) + 40
    d.rounded_rectangle([W - 60 - bw, 330, W - 60, 376], 23, fill=(235, 64, 52))
    d.text((W - 60 - bw / 2, 353), badge, font=bf, fill=(255, 255, 255), anchor="mm")

    # 메시지를 긴 캔버스에 쌓고 아래쪽을 보여준다 (채팅처럼 위로 밀림)
    mf, nf = font(42, "regular"), font(28, "regular")
    max_bubble = 660
    canvas = Image.new("RGB", (W, 8000), KAKAO_BG)
    cd = ImageDraw.Draw(canvas)
    y, prev = 20, None
    for i, it in enumerate(scene.items[: upto + 1]):
        me = it.speaker in ME_NAMES
        lines = wrap(cd, display_text(it.text), mf, max_bubble - 60, 6)
        tw = max(cd.textlength(ln, font=mf) for ln in lines)
        bw, bh = int(tw + 60), len(lines) * 58 + 36
        if me:
            bx = W - 60 - bw
        else:
            bx = 60 + 110
            if prev != it.speaker:  # 같은 사람이 연달아 말하면 프로필 생략
                cd.rounded_rectangle([60, y, 60 + 92, y + 92], 34, fill=(154, 176, 200))
                cd.text((60 + 46, y + 46), it.speaker[:1], font=font(40), fill=(255, 255, 255), anchor="mm")
                cd.text((bx, y), it.speaker, font=nf, fill=(60, 70, 82))
                y += 42
        cd.rounded_rectangle([bx, y, bx + bw, y + bh], 26, fill=KAKAO_ME if me else KAKAO_OTHER)
        for k, ln in enumerate(lines):
            cd.text((bx + 30, y + 18 + k * 58), ln, font=mf, fill=(25, 25, 25))
        y += bh + 22
        prev = it.speaker
    top, bottom = 420, y1
    view_h = bottom - top
    offset = max(0, y - view_h)
    view = canvas.crop((0, offset, W, offset + view_h))
    img.paste(view, (0, top))
    return img
