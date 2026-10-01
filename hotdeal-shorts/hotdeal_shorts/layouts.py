"""게시글형 장면 레이아웃 3종. 채널마다 다른 것을 써서 서로 관련 없어 보이게 한다.

  card      : 따뜻한 배경 + 게시글 머리(프로필) + 둥근 사진 + 형광펜 강조      (생활 채널용)
  fullbleed : 사진이 화면 전체 + 어두운 그라데이션 + 흰 글씨·네온 강조         (가전 채널용)
  magazine  : 여백 많은 잡지형 + 가는 선 + 왼쪽 정렬 + 밑줄 강조             (뷰티 채널용)

대본에서 *단어* 로 감싼 부분은 채널 강조색으로 표시된다 (목소리에는 영향 없음).
색은 config 의 channel.color / sub / accent / bg / ink, 글꼴은 video.font / video.font_regular.
"""
from __future__ import annotations

import re
from datetime import datetime

from PIL import Image, ImageDraw, ImageFilter

from . import config
from .frames import fit_text, fmt_won, font, hex_rgb, wrap


def C(key: str, default: str) -> tuple[int, int, int]:
    return hex_rgb(config.get(f"channel.{key}") or default)


# ------------------------------------------------------------------ 강조 표시 (*단어*)

def balance_markers(parts: list[str]) -> list[str]:
    """두 줄로 나뉘며 *...* 가 잘리면 줄 끝에서 닫고 다음 줄에서 다시 연다."""
    out, open_ = [], False
    for p in parts:
        q = ("*" if open_ else "") + p
        if q.count("*") % 2:
            q += "*"
            open_ = True
        else:
            open_ = False
        out.append(q)
    return out


def segments(text: str) -> list[tuple[str, bool]]:
    segs, on = [], False
    for chunk in re.split(r"(\*)", text):
        if chunk == "*":
            on = not on
        elif chunk:
            segs.append((chunk, on))
    return segs


def plain(text: str) -> str:
    return text.replace("*", "")


def draw_rich(d: ImageDraw.ImageDraw, x: float, y: float, text: str, f, fill, accent, *, anchor: str = "mm",
              mode: str = "color", stroke: int = 0, stroke_fill=(0, 0, 0)) -> None:
    """한 줄 그리기. anchor 는 mm(가운데) 또는 lm(왼쪽). mode: color | marker | underline."""
    segs = segments(text)
    total = sum(d.textlength(t, font=f) for t, _ in segs)
    cx = x - total / 2 if anchor == "mm" else x
    asc, desc = f.getmetrics()
    top = y - (asc + desc) / 2
    for t, hi in segs:
        w = d.textlength(t, font=f)
        color = fill
        if hi and mode == "marker":
            d.rounded_rectangle([cx - 6, top + (asc + desc) * 0.42, cx + w + 6, top + (asc + desc) * 0.98], 8,
                                fill=accent)
        elif hi and mode == "underline":
            d.rectangle([cx, top + asc + 4, cx + w, top + asc + 12], fill=accent)
        elif hi:
            color = accent
        d.text((cx, y), t, font=f, fill=color, anchor="lm", stroke_width=stroke, stroke_fill=stroke_fill)
        cx += w


def fit_rich(d, parts: list[str], max_w: int, start: int, weight: str = "bold", min_size: int = 40):
    size = start
    while size > min_size:
        f = font(size, weight)
        if all(d.textlength(plain(p), font=f) <= max_w for p in parts):
            return f
        size -= 3
    return font(min_size, weight)


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius, fill=255)
    return m


def gradient(W: int, H: int, y0: int, y1: int, a0: int, a1: int) -> Image.Image:
    """검은 막: y0 위는 불투명도 a0, y1 아래는 a1, 그 사이는 부드럽게 변한다."""
    col = Image.new("L", (1, H), 0)
    px = col.load()
    for y in range(H):
        t = 0.0 if y <= y0 else 1.0 if y >= y1 else (y - y0) / (y1 - y0)
        px[0, y] = int(a0 + (a1 - a0) * t)
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    layer.putalpha(col.resize((W, H)))
    return layer


# ------------------------------------------------------------------ 공통 가격 문자열

# ------------------------------------------------------------------ 가격 글자 (숫자 크게, '원'은 작게, 자간 좁게)

def _split_won(text: str) -> tuple[str, str]:
    return (text[:-1], "원") if text.endswith("원") else (text, "")


def money_width(d: ImageDraw.ImageDraw, text: str, size: int, weight: str = "bold", track: float = -0.03) -> float:
    num, unit = _split_won(text)
    f = font(size, weight)
    w = sum(d.textlength(ch, font=f) for ch in num) + track * size * max(len(num) - 1, 0)
    if unit:
        w += size * 0.06 + d.textlength(unit, font=font(int(size * 0.56), weight))
    return w


def draw_money(d: ImageDraw.ImageDraw, x: float, baseline: float, text: str, size: int, fill,
               weight: str = "bold", track: float = -0.03) -> float:
    """'9,800원' → 숫자는 크게·촘촘히, '원'은 작게 같은 기준선. 그린 너비를 돌려준다."""
    num, unit = _split_won(text)
    f = font(size, weight)
    x0 = x
    for k, ch in enumerate(num):
        d.text((x, baseline), ch, font=f, fill=fill, anchor="ls")
        x += d.textlength(ch, font=f) + (track * size if k < len(num) - 1 else 0)
    if unit:
        x += size * 0.06
        uf = font(int(size * 0.56), weight)
        d.text((x, baseline), unit, font=uf, fill=fill, anchor="ls")
        x += d.textlength(unit, font=uf)
    return x - x0


def draw_struck(d: ImageDraw.ImageDraw, x: float, baseline: float, text: str, size: int, fill,
                weight: str = "regular") -> float:
    """정가: 가운데를 지나는 얇은 취소선."""
    f = font(size, weight)
    w = d.textlength(text, font=f)
    d.text((x, baseline), text, font=f, fill=fill, anchor="ls")
    y = baseline - size * 0.36
    d.line([(x - 2, y), (x + w + 2, y)], fill=fill, width=max(2, size // 15))
    return w


def soft_shadow(size: tuple[int, int], box, radius: int, color=(60, 40, 20, 70), blur: int = 18) -> Image.Image:
    sh = Image.new("RGBA", size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle(box, radius, fill=color)
    return sh.filter(ImageFilter.GaussianBlur(blur))


def price_bits(deal: dict) -> tuple[str, str, str]:
    sale = fmt_won(deal["price"]) if deal.get("price") else ""
    orig = fmt_won(deal["original_price"]) if deal.get("original_price") else ""
    pct = f"{deal['discount_pct']:.0f}%" if deal.get("discount_pct") else ""
    return sale, orig, pct


# ================================================================== card (생활)

class Card:
    name = "card"
    photo_box = (60, 760, 1020, 1440)
    sub_y = 630

    def base(self, job, s, W: int, H: int) -> Image.Image:
        bg, ink, brand, sub = C("bg", "#FFF8EE"), C("ink", "#1E1B18"), C("color", "#FFB547"), C("sub", "#FFE9C7")
        img = Image.new("RGB", (W, H), bg)
        d = ImageDraw.Draw(img)
        # 게시글 머리: 동그란 로고 + 채널명 + 핸들 · 오른쪽 날짜 칩
        d.ellipse([60, 70, 172, 182], fill=brand)
        d.text((116, 126), (config.get("channel.logo") or config.get("channel.name", "딜"))[:1], font=font(58),
               fill=bg, anchor="mm")
        d.text((196, 88), config.get("channel.name", "오늘의 핫딜"), font=font(46), fill=ink)
        d.text((198, 146), config.get("channel.handle", ""), font=font(30, "regular"), fill=(150, 140, 128))
        chip = datetime.now().strftime("%m.%d 딜")
        cf = font(30)
        cw = d.textlength(chip, font=cf) + 44
        d.rounded_rectangle([W - 60 - cw, 100, W - 60, 152], 26, fill=sub)
        d.text((W - 60 - cw / 2, 126), chip, font=cf, fill=ink, anchor="mm")
        # 고정 제목 (왼쪽 정렬, 최대 2줄)
        tf = font(62)
        lines = wrap(d, s.title, tf, W - 120, 2)
        y = 290 if len(lines) == 1 else 250  # 한 줄이면 가운데로 내려서 빈 공간을 줄임
        for ln in lines:
            d.text((60, y), ln, font=tf, fill=ink)
            y += 80
        d.line([(60, 470), (W - 60, 470)], fill=(234, 224, 210), width=3)
        return img

    def compose(self, base: Image.Image, photo: Image.Image, chip: Image.Image | None) -> Image.Image:
        img = base.copy()
        x0, y0, x1, y1 = self.photo_box
        size = (x1 - x0, y1 - y0)
        shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(shadow).rounded_rectangle([x0 + 6, y0 + 16, x1 + 6, y1 + 16], 36, fill=(90, 60, 20, 60))
        shadow = shadow.filter(ImageFilter.GaussianBlur(20))
        img.paste(shadow, (0, 0), shadow)
        img.paste(photo.convert("RGB").resize(size) if photo.size != size else photo.convert("RGB"), (x0, y0),
                  rounded_mask(size, 36))
        if chip is not None:  # 사진 아래 모서리에 반쯤 걸치게
            m = chip.info.get("margin", 0)
            inner_h = chip.height - 2 * m
            img = img.convert("RGBA")
            img.alpha_composite(chip, (x0 + 36 - m, y1 - int(inner_h * 0.62) - m))
            img = img.convert("RGB")
        return img

    def subtitle(self, img: Image.Image, parts: list[str]) -> None:
        d = ImageDraw.Draw(img)
        W = img.width
        f = fit_rich(d, parts, W - 120, 78)
        line_h = f.size + 26
        y = self.sub_y - (len(parts) - 1) * line_h / 2
        for p in balance_markers(parts):
            draw_rich(d, W / 2, y, p, f, C("ink", "#1E1B18"), C("sub", "#FFE9C7"), mode="marker")
            y += line_h

    def price_chip(self, deal: dict) -> Image.Image | None:
        """흰 가격 카드: 1줄 '62%  25,900원'(취소선), 2줄 큰 판매가. 사진 아래 모서리에 걸쳐 놓는다."""
        sale, orig, pct = price_bits(deal)
        if not sale:
            return None
        accent, ink = C("accent", "#E8590C"), C("ink", "#1E1B18")
        tmp = ImageDraw.Draw(Image.new("RGB", (1, 1)))
        big, small, padx, pady, m = 92, 34, 42, 32, 64  # m: 그림자 여백
        top_w = (tmp.textlength(pct + "  ", font=font(small)) if pct else 0) + \
            (tmp.textlength(orig, font=font(small, "regular")) if orig else 0)
        w = int(max(money_width(tmp, sale, big), top_w)) + padx * 2
        h = pady * 2 + int(big * 0.78) + (int(small * 1.6) if (pct or orig) else 0)
        chip = Image.new("RGBA", (w + m * 2, h + m * 2), (0, 0, 0, 0))
        chip.alpha_composite(soft_shadow(chip.size, [m, m + 10, m + w, m + h + 10], 30))
        d = ImageDraw.Draw(chip)
        d.rounded_rectangle([m, m, m + w, m + h], 30, fill=(255, 255, 255, 255))
        x, y = m + padx, m + pady
        if pct or orig:
            yb = y + small
            if pct:
                d.text((x, yb), pct, font=font(small), fill=accent, anchor="ls")
                x += tmp.textlength(pct + "  ", font=font(small))
            if orig:
                draw_struck(d, x, yb, orig, small, (150, 142, 132))
            y += int(small * 1.6)
        draw_money(d, m + padx, y + int(big * 0.78), sale, big, ink)
        chip.info["margin"] = m
        return chip

    def chrome(self, W: int, H: int, title: str) -> Image.Image:
        bg, ink, brand = C("bg", "#FFF8EE"), C("ink", "#1E1B18"), C("color", "#FFB547")
        img = Image.new("RGB", (W, H), bg)
        d = ImageDraw.Draw(img)
        d.ellipse([60, 60, 150, 150], fill=brand)
        d.text((105, 105), (config.get("channel.logo") or config.get("channel.name", "딜"))[:1], font=font(46),
               fill=bg, anchor="mm")
        d.text((172, 80), config.get("channel.name", ""), font=font(40), fill=ink)
        tf = fit_text(d, title, W - 120, 54, 38)
        d.text((60, 190), title, font=tf, fill=ink)
        d.line([(0, 305), (W, 305)], fill=(234, 224, 210), width=3)
        return img


# ================================================================== fullbleed (가전)

class FullBleed:
    name = "fullbleed"
    photo_box = (0, 0, 1080, 1920)
    sub_y = 1230

    def base(self, job, s, W: int, H: int) -> Image.Image:
        """사진 위에 얹는 투명 막 (RGBA): 위·아래 어둡게 + 채널 태그 + 제목."""
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        layer.alpha_composite(gradient(W, H, 0, 620, 215, 0))
        layer.alpha_composite(gradient(W, H, 900, 1560, 0, 230))
        d = ImageDraw.Draw(layer)
        neon = C("accent", "#B6FF3B")
        tag = (config.get("channel.tag") or config.get("channel.name", "")).upper()
        tf = font(34)
        tw = d.textlength(tag, font=tf) + 40
        d.rounded_rectangle([60, 90, 60 + tw, 146], 10, fill=neon)
        d.text((80, 118), tag, font=tf, fill=(10, 12, 14), anchor="lm")
        y = 180
        for ln in wrap(d, s.title, font(70), W - 120, 2):
            d.text((60, y), ln, font=font(70), fill=(255, 255, 255))
            y += 88
        return layer

    def compose(self, base: Image.Image, photo: Image.Image, chip: Image.Image | None) -> Image.Image:
        img = photo.convert("RGBA").resize(base.size) if photo.size != base.size else photo.convert("RGBA")
        img.alpha_composite(base)
        if chip is not None:
            img.alpha_composite(chip, (60, 1400))
        return img.convert("RGB")

    def subtitle(self, img: Image.Image, parts: list[str]) -> None:
        d = ImageDraw.Draw(img)
        W = img.width
        f = fit_rich(d, parts, W - 100, 86)
        line_h = f.size + 20
        y = self.sub_y - (len(parts) - 1) * line_h / 2
        for p in balance_markers(parts):
            draw_rich(d, W / 2, y, p, f, (255, 255, 255), C("accent", "#B6FF3B"), mode="color", stroke=7,
                      stroke_fill=(0, 0, 0))
            y += line_h

    def price_chip(self, deal: dict) -> Image.Image | None:
        """네온 할인율 태그 + 정가(취소선) 위에, 아래에 큰 판매가. 외곽선 대신 부드러운 그림자."""
        sale, orig, pct = price_bits(deal)
        if not sale:
            return None
        neon = C("accent", "#B6FF3B")
        tmp = ImageDraw.Draw(Image.new("RGB", (1, 1)))
        big, small = 104, 34
        tag_w = tmp.textlength(pct, font=font(small)) + 28 if pct else 0
        top_w = tag_w + (16 if pct and orig else 0) + (tmp.textlength(orig, font=font(small, "regular")) if orig else 0)
        w = int(max(money_width(tmp, sale, big), top_w)) + 40
        h = int(big * 0.8) + (64 if (pct or orig) else 0) + 30
        chip = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(chip)
        x = 0
        if pct:
            d.rounded_rectangle([0, 0, tag_w, 48], 8, fill=neon)
            d.text((tag_w / 2, 24), pct, font=font(small), fill=(10, 12, 14), anchor="mm")
            x = tag_w + 16
        if orig:
            draw_struck(d, x, 38, orig, small, (215, 218, 224))
        base_y = h - 22
        sh = Image.new("RGBA", chip.size, (0, 0, 0, 0))
        draw_money(ImageDraw.Draw(sh), 4, base_y + 6, sale, big, (0, 0, 0, 170))
        chip.alpha_composite(sh.filter(ImageFilter.GaussianBlur(8)))
        draw_money(ImageDraw.Draw(chip), 0, base_y, sale, big, neon)
        return chip

    def chrome(self, W: int, H: int, title: str) -> Image.Image:
        img = Image.new("RGB", (W, H), (14, 15, 18))
        d = ImageDraw.Draw(img)
        neon = C("accent", "#B6FF3B")
        tag = (config.get("channel.tag") or config.get("channel.name", "")).upper()
        tf = font(30)
        tw = d.textlength(tag, font=tf) + 36
        d.rounded_rectangle([60, 70, 60 + tw, 120], 10, fill=neon)
        d.text((78, 95), tag, font=tf, fill=(10, 12, 14), anchor="lm")
        d.text((60, 160), title, font=fit_text(d, title, W - 120, 60, 40), fill=(255, 255, 255))
        return img


# ================================================================== magazine (뷰티)

class Magazine:
    name = "magazine"
    photo_box = (90, 700, 990, 1380)
    sub_y = 560

    def base(self, job, s, W: int, H: int) -> Image.Image:
        bg, ink, accent = C("bg", "#F6F1EC"), C("ink", "#231F1C"), C("accent", "#B5485D")
        img = Image.new("RGB", (W, H), bg)
        d = ImageDraw.Draw(img)
        mast = " ".join((config.get("channel.tag") or config.get("channel.name", "")).upper())
        d.text((90, 96), mast, font=font(30, "regular"), fill=ink)
        issue = f"No.{datetime.now():%m%d}"
        d.text((W - 90, 96), issue, font=font(30, "regular"), fill=accent, anchor="ra")
        d.line([(90, 150), (W - 90, 150)], fill=ink, width=2)
        y = 200
        for ln in wrap(d, s.title, font(64), W - 180, 2):
            d.text((90, y), ln, font=font(64), fill=ink)
            y += 84
        d.line([(90, 400), (220, 400)], fill=accent, width=5)
        return img

    def compose(self, base: Image.Image, photo: Image.Image, chip: Image.Image | None) -> Image.Image:
        img = base.copy()
        x0, y0, x1, y1 = self.photo_box
        size = (x1 - x0, y1 - y0)
        img.paste(photo.convert("RGB").resize(size) if photo.size != size else photo.convert("RGB"), (x0, y0))
        d = ImageDraw.Draw(img)
        d.rectangle([x0 - 1, y0 - 1, x1, y1], outline=C("ink", "#231F1C"), width=2)
        if chip is not None:
            img.paste(chip, (x0, y1 + 24), chip)
        return img

    def subtitle(self, img: Image.Image, parts: list[str]) -> None:
        d = ImageDraw.Draw(img)
        W = img.width
        f = fit_rich(d, parts, W - 180, 66)
        line_h = f.size + 24
        y = self.sub_y - (len(parts) - 1) * line_h / 2
        for p in balance_markers(parts):
            draw_rich(d, 90, y, p, f, C("ink", "#231F1C"), C("accent", "#B5485D"), anchor="lm", mode="underline")
            y += line_h

    def price_chip(self, deal: dict) -> Image.Image | None:
        """잡지 가격표: 큰 판매가 · 오른쪽에 정가(취소선)와 할인율을 두 줄로."""
        sale, orig, pct = price_bits(deal)
        if not sale:
            return None
        ink, accent = C("ink", "#231F1C"), C("accent", "#B5485D")
        tmp = ImageDraw.Draw(Image.new("RGB", (1, 1)))
        big, small = 84, 32
        sw = money_width(tmp, sale, big, track=-0.02)
        side = max(tmp.textlength(orig, font=font(small, "regular")) if orig else 0,
                   tmp.textlength(f"{pct} OFF", font=font(small)) if pct else 0)
        w = int(sw + (32 + side if side else 0)) + 10
        chip = Image.new("RGBA", (w, 104), (0, 0, 0, 0))
        d = ImageDraw.Draw(chip)
        draw_money(d, 0, 88, sale, big, ink, track=-0.02)
        x = sw + 32
        if side:
            d.line([(x - 16, 24), (x - 16, 88)], fill=(200, 190, 180), width=2)
        if orig:
            draw_struck(d, x, 50, orig, small, (150, 140, 132))
        if pct:
            d.text((x, 88), f"{pct} OFF", font=font(small), fill=accent, anchor="ls")
        return chip

    def chrome(self, W: int, H: int, title: str) -> Image.Image:
        bg, ink = C("bg", "#F6F1EC"), C("ink", "#231F1C")
        img = Image.new("RGB", (W, H), bg)
        d = ImageDraw.Draw(img)
        mast = " ".join((config.get("channel.tag") or config.get("channel.name", "")).upper())
        d.text((90, 90), mast, font=font(30, "regular"), fill=ink)
        d.line([(90, 144), (W - 90, 144)], fill=ink, width=2)
        d.text((90, 190), title, font=fit_text(d, title, W - 180, 56, 38), fill=ink)
        return img


LAYOUTS = {"card": Card(), "fullbleed": FullBleed(), "magazine": Magazine()}


def current():
    return LAYOUTS.get(config.get("channel.layout") or "card", LAYOUTS["card"])
