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

_BASE = {"page": "#F2F2F5", "card": "#FFFFFF", "title": "#1F1F24", "meta": "#9A9AA2", "body": "#2A2A30",
         "nick": "#8A8A92", "line": "#ECECF0", "dark": False, "header": "strip", "tag_first": None,
         "tag_other": ("#F0F0F3", "#77777F"), "tag_brackets": False, "board": False, "author": "meta",
         "comment": "list", "zebra": False, "highlight": (255, 243, 191)}


def _theme(**kw) -> dict:
    return {**_BASE, **kw}


COMMUNITY_THEMES = {
    # 무채색 게시판형
    "theqoo": _theme(accent="#7A6FF0"),
    # 파란 헤더 + 줄무늬 댓글
    "dc": _theme(accent="#3B4890", page="#E9EBF3", title="#1B1E2E", meta="#8C90A3", body="#23263A",
                 nick="#3B4890", line="#DADDEA", header="fill", zebra=True),
    # 초록 포인트 + 동그란 프로필 댓글
    "cafe": _theme(accent="#03C75A", page="#F1F5F2", nick="#2E3431", line="#E6ECE8", comment="avatar",
                   tag_first=("#E6F8EE", "#03A04A")),
    # 주황 말머리 칩 + 회색 카테고리 칩, 메타에 조회·추천·댓글
    "fmkorea": _theme(accent="#F26522", tag_first=("#F26522", "#FFFFFF"), nick="#5A5A62"),
    # 연두 [말머리], 익명 · 시간
    "instiz": _theme(accent="#12B886", tag_first=("#E6FAF3", "#0CA678"), tag_brackets=True),
    # 파란 게시판 이름 + 하늘색 칩 + 노란 프로필 작성자 줄
    "daumcafe": _theme(accent="#1B7BF7", tag_first=("#E7F1FF", "#1B7BF7"), board=True, author="avatar",
                       comment="avatar", avatar_color="#FFD84D"),
    # 어두운 트윗 카드 + 답글
    "twitter": _theme(accent="#1D9BF0", dark=True, page="#000000", card="#0F1114", title="#E7E9EA",
                      meta="#71767B", body="#E7E9EA", nick="#E7E9EA", line="#2F3336", author="tweet",
                      comment="reply", highlight=(28, 44, 62)),
    # 유튜브 댓글 목록: 색 동그라미 프로필, @이름, 좋아요 줄
    "youtube": _theme(accent="#065FD4", nick="#0F0F0F", comment="youtube"),
}
AVATAR_PALETTE = ["#7C4DFF", "#EF6C00", "#1565C0", "#4A148C", "#00695C", "#C62828", "#2E7D32", "#AD1457"]


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

def _chip(d, x: int, y: int, text: str, colors: tuple[str, str], f) -> int:
    w = int(d.textlength(text, font=f)) + 32
    d.rounded_rectangle([x, y, x + w, y + 50], 10, fill=hex_rgb(colors[0]))
    d.text((x + w / 2, y + 25), text, font=f, fill=hex_rgb(colors[1]), anchor="mm")
    return x + w + 12


def _avatar(d, x: int, y: int, size: int, color, letter: str = "") -> None:
    d.ellipse([x, y, x + size, y + size], fill=hex_rgb(color) if isinstance(color, str) else color)
    if letter:
        d.text((x + size / 2, y + size / 2), letter, font=font(int(size * 0.42)), fill=(255, 255, 255), anchor="mm")


def _paste_image(canvas: Image.Image, img: Image.Image, x: int, y: int, max_w: int, max_h: int = 560) -> int:
    im = img.convert("RGBA")
    im.thumbnail((max_w, max_h), Image.LANCZOS)
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.width - 1, im.height - 1], 18, fill=255)
    canvas.paste(im.convert("RGB"), (x, y), mask)
    return y + im.height


def _community_canvas(scene: Scene, upto: int, width: int, load_image=None) -> tuple[Image.Image, int, int]:
    """카드 전체를 세로로 긴 캔버스에 그린다.
    반환: (캔버스, 읽는 중인 항목의 아래 끝 y, 고정할 출처 줄 높이, 블록 시작 y 목록)."""
    t = COMMUNITY_THEMES.get(scene.style, COMMUNITY_THEMES["theqoo"])
    C = {k: hex_rgb(v) for k, v in t.items() if isinstance(v, str) and v.startswith("#")}
    acc, pad = C["accent"], 44
    inner = width - pad * 2
    canvas = Image.new("RGB", (width, 9000), C["card"])
    d = ImageDraw.Draw(canvas)
    meta_f = font(30, "regular")

    # 1) 출처 줄 (모든 스타일 공통, 끌 수 없음)
    src = f"출처 · {scene.meta.get('source_name', '')}"
    cap = f"{scene.meta.get('captured', '')} 확인"
    if t["header"] == "fill":
        d.rectangle([0, 0, width, 92], fill=acc)
        d.text((pad, 46), src, font=font(34), fill=(255, 255, 255), anchor="lm")
        d.text((width - pad, 46), cap, font=font(28, "regular"), fill=(220, 224, 240), anchor="rm")
        y = 124
        header_h = 100
    else:
        d.rectangle([0, 0, width, 10], fill=acc)
        d.text((pad, 60), src, font=font(34), fill=acc, anchor="lm")
        d.text((width - pad, 60), cap, font=font(28, "regular"), fill=C["meta"], anchor="rm")
        y = 112
        header_h = 96

    # 2) 게시판 이름 · 말머리
    if t["board"] and scene.meta.get("board"):
        d.text((pad, y), scene.meta["board"], font=font(32), fill=acc)
        y += 54
    tags = scene.meta.get("tags", [])
    title = scene.meta.get("title", "")
    if tags and t["author"] != "tweet":
        x, cf = pad, font(28)
        for k, tg in enumerate(tags):
            label = f"[{tg}]" if t["tag_brackets"] else tg
            colors = t["tag_first"] if (k == 0 and t["tag_first"]) else t["tag_other"]
            x = _chip(d, x, y, label, colors, cf)
        y += 70

    # 3) 제목 + 작성자 줄
    if t["author"] == "tweet":
        _avatar(d, pad, y, 92, (83, 100, 113), "익")
        d.text((pad + 116, y + 8), "익명", font=font(38), fill=C["title"])
        d.text((pad + 116, y + 56), "@익명", font=meta_f, fill=C["meta"])
        y += 118
        if title:
            for ln in wrap(d, title, font(46), inner, 2):
                d.text((pad, y), ln, font=font(46), fill=C["title"])
                y += 62
    else:
        if title:
            tf = font(50) if t["comment"] != "youtube" else font(36)
            label = title if t["comment"] != "youtube" else f"영상: {title}"
            for ln in wrap(d, label, tf, inner, 2):
                d.text((pad, y), ln, font=tf, fill=C["title"] if t["comment"] != "youtube" else C["meta"])
                y += tf.size + 16
        if t["author"] == "avatar":
            _avatar(d, pad, y + 6, 76, t.get("avatar_color", "#C9CED6"))
            d.text((pad + 96, y + 4), "익명", font=font(34), fill=C["title"])
            if scene.meta.get("meta"):
                d.text((pad + 96, y + 48), scene.meta["meta"], font=meta_f, fill=C["meta"])
            y += 104
        else:
            who = "익명" + (f"   {scene.meta['meta']}" if scene.meta.get("meta") else "")
            d.text((pad, y + 4), who, font=meta_f, fill=C["meta"])
            y += 52
    y += 14
    if t["author"] != "tweet":
        d.line([(0, y), (width, y)], fill=C["line"], width=2)
        y += 32

    # 4) 본문 (문단 사이사이 이미지)
    images = list(scene.meta.get("images", []))
    bf = font(44, "regular") if t["author"] == "tweet" else font(42, "regular")
    body_line_h = bf.size + 16
    current_bottom, body_seen = y, 0
    tops = [y]  # 스크롤이 멈출 수 있는 경계 (글줄이 반쯤 잘리지 않게)

    def place_images(after: int, y: int) -> int:
        nonlocal images
        for pos, ref in [im for im in images if im[0] == after]:
            img = load_image(ref) if load_image else None
            if img is not None:
                tops.append(y)
                y = _paste_image(canvas, img, pad, y + 6, int(inner * 0.6), 440) + 26
        images = [im for im in images if im[0] != after]
        return y

    y = place_images(0, y)
    n_comment, comments_started = 0, False
    cf, nf = font(40, "regular"), font(30)
    for i, it in enumerate(scene.items):
        if it.role == "comment" and i > upto:
            break  # 아직 안 읽은 댓글은 숨김
        text = display_text(it.text)
        tops.append(y)
        if it.role == "body":
            lines = wrap(d, text, bf, inner, 14)
            h = len(lines) * body_line_h + 20
            if i == upto:
                d.rounded_rectangle([pad - 16, y - 8, width - pad + 16, y + h - 6], 16, fill=t["highlight"])
            for k, ln in enumerate(lines):
                d.text((pad, y + k * body_line_h), ln, font=bf, fill=C["body"])
            y += h
            body_seen += 1
            y = place_images(body_seen, y)
        else:
            if not comments_started:
                comments_started = True
                if t["author"] == "tweet" and scene.meta.get("meta"):
                    d.text((pad, y + 4), scene.meta["meta"], font=meta_f, fill=C["meta"])
                    y += 56
                if t["comment"] == "reply":
                    d.line([(0, y + 8), (width, y + 8)], fill=C["line"], width=2)
                    y += 36
                elif t["comment"] != "youtube" or body_seen:
                    y += 14
                    d.rectangle([0, y, width, y + 12], fill=C["page"])
                    y += 34
                    d.text((pad, y), "댓글", font=font(34), fill=C["title"])
                    y += 62
            n_comment += 1
            tops.append(y)
            y, bottom = _comment(d, t, C, it, n_comment, text, y, pad, width, inner, i == upto, cf, nf)
            if i == upto:
                current_bottom = bottom
            continue
        if i == upto:
            current_bottom = y
    if t["author"] == "tweet" and not comments_started and scene.meta.get("meta"):
        d.text((pad, y + 4), scene.meta["meta"], font=meta_f, fill=C["meta"])
        y += 56
    return canvas.crop((0, 0, width, max(y + 30, 200))), current_bottom, header_h, tops


def _comment(d, t, C, it, n, text, y, pad, width, inner, current, cf, nf):
    style = t["comment"]
    avatar = style in ("avatar", "youtube", "reply")
    size = 76 if style != "avatar" else 64
    x_text = pad + (size + 22 if avatar else 0)
    lines = wrap(d, text, cf, inner - (x_text - pad), 6)
    like_row = style == "youtube" or bool(it.likes)
    h = 50 + len(lines) * 54 + (46 if like_row else 0) + 26
    if t["zebra"] and n % 2 == 0:
        d.rectangle([0, y - 10, width, y + h - 10], fill=(247, 248, 252))
    if current:
        d.rounded_rectangle([pad - 16, y - 12, width - pad + 16, y + h - 14], 16, fill=t["highlight"])
    if avatar:
        color = AVATAR_PALETTE[(n - 1) % len(AVATAR_PALETTE)] if style in ("youtube", "reply") else "#D6DED9"
        _avatar(d, pad, y, size, color, "익" if style in ("youtube", "reply") else "")
    name = {"youtube": f"@익명{n}", "reply": f"익명{n}"}.get(style, f"익명{n}")
    d.text((x_text, y), name, font=nf, fill=C["nick"])
    if style == "reply":
        d.text((x_text + d.textlength(name, font=nf) + 14, y + 2), f"@익명{n}", font=font(28, "regular"),
               fill=C["meta"])
    for k, ln in enumerate(lines):
        d.text((x_text, y + 48 + k * 54), ln, font=cf, fill=C["body"])
    yy = y + 48 + len(lines) * 54
    if like_row:
        label = f"좋아요 {it.likes}" if it.likes else "좋아요"
        d.text((x_text, yy + 8), label + "     답글", font=font(28, "regular"), fill=C["meta"])
        yy += 46
    y2 = y + h
    d.line([(pad, y2 - 12), (width - pad, y2 - 12)], fill=C["line"], width=1)
    return y2, y2


def render_community(base: Image.Image, scene: Scene, upto: int, load_image=None) -> Image.Image:
    t = COMMUNITY_THEMES.get(scene.style, COMMUNITY_THEMES["theqoo"])
    x0, y0, x1, y1 = AREA
    img = base.copy()
    d = ImageDraw.Draw(img)
    d.rectangle([0, 306, img.width, y1 + 20], fill=hex_rgb(t["page"]))
    card, cur_bottom, header_h, tops = _community_canvas(scene, upto, x1 - x0, load_image)
    area_h = y1 - y0
    # 출처 줄은 고정, 그 아래만 스크롤해서 읽는 중인 항목이 화면 안에 들어오게 한다
    view_h = area_h - header_h
    scroll = max(0, min(cur_bottom + 60 - header_h - view_h, card.height - header_h - view_h))
    if scroll:  # 가장 가까운 블록 경계까지 더 올려서 윗줄이 잘리지 않게
        snaps = [tp - header_h - 18 for tp in tops if tp - header_h - 18 >= scroll]
        scroll = min(snaps) if snaps else scroll
    body = card.crop((0, header_h + scroll, card.width, min(card.height, header_h + scroll + view_h)))
    view = Image.new("RGB", (card.width, header_h + body.height), card.getpixel((5, header_h + 5)))
    view.paste(card.crop((0, 0, card.width, header_h)), (0, 0))
    view.paste(body, (0, header_h))
    if scroll:  # 스크롤됐다는 표시로 고정 줄 아래 옅은 그림자
        ImageDraw.Draw(view).line([(0, header_h), (card.width, header_h)], fill=hex_rgb(t["line"]), width=3)
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
