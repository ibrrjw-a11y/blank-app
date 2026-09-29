"""화면 PNG 생성: 줄마다 1장 (제목·상품·가격 고정 + 현재 자막)."""
from __future__ import annotations

import io
import json
import re
from functools import lru_cache
from pathlib import Path

import requests
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from . import config
from .job import Job
from .script import Script

FONT_CANDIDATES = [
    # 직접 넣은 폰트가 최우선
    "fonts/Pretendard-ExtraBold.otf", "fonts/Pretendard-Bold.otf",
    # Linux
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/noto-cjk/NotoSansCJK-Bold.ttc",
    # Windows
    "C:/Windows/Fonts/malgunbd.ttf",
    # macOS
    "/System/Library/Fonts/AppleSDGothicNeo.ttc",
    "/Library/Fonts/AppleGothic.ttf",
]


def find_font() -> str:
    custom = config.get("video.font")
    cands = ([custom] if custom else []) + FONT_CANDIDATES
    for c in cands:
        p = Path(c) if Path(c).is_absolute() else config.home() / c
        if p.exists():
            return str(p)
    raise FileNotFoundError("한글 굵은 폰트를 찾지 못함. fonts/ 폴더에 Pretendard-Bold.otf 를 넣거나 "
                            "config.yaml 의 video.font 에 경로를 적어주세요.")


@lru_cache(maxsize=64)
def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(find_font(), size)


SUB_TOP, SUB_H = 400, 250
CARD_TOP, CARD_BOTTOM = 690, 1230


def hex_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


# ------------------------------------------------------------------ 자막 분할

_KNUM = re.compile(r"(?:(\d+)만\s*)?(?:(\d)천)?(?:(\d)백)?(\d{1,2})?(?=\s*(원|개|명|장|병|롤|봉|팩))")


def display_text(text: str) -> str:
    """TTS용 한글 숫자를 자막용 숫자로: '3만 9천9백원' -> '39,900원', '2천4백 개' -> '2,400개'."""
    def rep(m: re.Match) -> str:
        man, cheon, baek, rest = m.group(1), m.group(2), m.group(3), m.group(4)
        if not (man or cheon or baek):  # '600개'처럼 이미 숫자면 그대로
            return m.group(0)
        n = int(man or 0) * 10000 + int(cheon or 0) * 1000 + int(baek or 0) * 100 + int(rest or 0)
        return f"{n:,}"
    out = _KNUM.sub(rep, text)
    return re.sub(r"(\d)\s+(원|개|명|장|병|롤|봉|팩)", r"\1\2", out)


def split_subtitle(text: str, max_chars: int = 15, strip_period: bool = True) -> list[str]:
    t = text.strip()
    if strip_period:
        t = t.rstrip(".。")
    if len(t) <= max_chars:
        return [t]
    words = t.split(" ")
    if len(words) == 1:
        mid = (len(t) + 1) // 2
        return [t[:mid], t[mid:]]
    best, best_cost = None, None
    for i in range(1, len(words)):
        top, bottom = " ".join(words[:i]), " ".join(words[i:])
        # 두 줄 중 긴 쪽을 최소화, 같으면 윗줄이 짧은 쪽 선호
        cost = (max(len(top), len(bottom)), len(top) > len(bottom))
        if best_cost is None or cost < best_cost:
            best, best_cost = [top, bottom], cost
    return best  # type: ignore[return-value]


# ------------------------------------------------------------------ 그리기 도우미

def fit_text(draw: ImageDraw.ImageDraw, text: str, max_w: int, start: int, min_size: int = 36) -> ImageFont.FreeTypeFont:
    size = start
    while size > min_size:
        f = font(size)
        if draw.textlength(text, font=f) <= max_w:
            return f
        size -= 4
    return font(min_size)


def wrap(draw, text: str, f, max_w: int, max_lines: int = 2) -> list[str]:
    words, lines, cur = text.split(" "), [], ""
    for w in words:
        nxt = (cur + " " + w).strip()
        if draw.textlength(nxt, font=f) <= max_w or not cur:
            cur = nxt
        else:
            lines.append(cur)
            cur = w
    lines.append(cur)
    return lines[:max_lines]


def centered(draw, y: int, text: str, f, fill, W: int, stroke: int = 0, stroke_fill=(0, 0, 0)) -> int:
    w = draw.textlength(text, font=f)
    draw.text(((W - w) / 2, y), text, font=f, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)
    bbox = f.getbbox("가")
    return y + (bbox[3] - bbox[1])


def fmt_won(n) -> str:
    return f"{int(n):,}원" if n is not None else ""


# ------------------------------------------------------------------ 상품 이미지

def product_image(job: Job) -> Image.Image | None:
    for ext in ("png", "jpg", "jpeg", "webp"):
        p = job.p(f"product.{ext}")
        if p.exists():
            return Image.open(p).convert("RGBA")
    url = job.deal.get("image_url")
    if url:
        try:
            r = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
            r.raise_for_status()
            img = Image.open(io.BytesIO(r.content)).convert("RGBA")
            img.convert("RGB").save(job.p("product.jpg"), quality=92)
            return img
        except Exception as e:  # noqa: BLE001
            job.log(f"상품 이미지 다운로드 실패: {e}")
    return None


def placeholder(size: tuple[int, int], name: str) -> Image.Image:
    img = Image.new("RGBA", size, (245, 245, 247, 255))
    d = ImageDraw.Draw(img)
    f = font(56)
    lines = wrap(d, name, f, size[0] - 120, 3)
    y = size[1] // 2 - len(lines) * 40
    for ln in lines:
        centered(d, y, ln, f, (60, 60, 67), size[0])
        y += 80
    return img


# ------------------------------------------------------------------ 본체

def base_layer(job: Job, s: Script, W: int, H: int) -> Image.Image:
    deal = job.deal
    brand = hex_rgb(config.get("channel.color", "#FF3B30"))
    accent = hex_rgb(config.get("channel.accent", "#FFD60A"))

    img = Image.new("RGB", (W, H), (14, 14, 18))
    d = ImageDraw.Draw(img)
    # 은은한 세로 그라데이션
    for y in range(H):
        v = int(14 + 16 * (y / H))
        d.line([(0, y), (W, y)], fill=(v, v, v + 6))

    # 레이아웃 (쇼츠 하단 약 400px은 제목·버튼 UI에 가려지므로 비워둔다)
    # 배너 0-130 | 제목 150-370 | 자막 400-650 | 상품 690-1230 | 가격 1250-1470
    d.rectangle([0, 0, W, 130], fill=brand)
    name = config.get("channel.name", "오늘의 핫딜")
    centered(d, 30, f"{name}  »", font(60), (255, 255, 255), W)

    # 제목(영상 내내 고정)
    tf = fit_text(d, s.title, W - 100, 80, min_size=64)
    lines = [s.title] if d.textlength(s.title, font=tf) <= W - 100 else wrap(d, s.title, tf, W - 100, 2)
    y = 175 if len(lines) == 1 else 155
    for ln in lines:
        y = centered(d, y, ln, tf, (255, 255, 255), W, stroke=3) + 26

    # 상품 카드
    card = (90, CARD_TOP, W - 90, CARD_BOTTOM)
    cw, ch = card[2] - card[0], card[3] - card[1]
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([card[0] + 8, card[1] + 14, card[2] + 8, card[3] + 14], 40,
                                             fill=(0, 0, 0, 160))
    blurred = shadow.filter(ImageFilter.GaussianBlur(18))
    img.paste(blurred, (0, 0), blurred)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(card, 40, fill=(255, 255, 255))
    prod = product_image(job) or placeholder((cw - 60, ch - 60), deal["name"])
    prod.thumbnail((cw - 60, ch - 60))
    img.paste(prod, (card[0] + (cw - prod.width) // 2, card[1] + (ch - prod.height) // 2), prod)

    # 할인율 스탬프
    pct = deal.get("discount_pct")
    if pct:
        st = Image.new("RGBA", (260, 260), (0, 0, 0, 0))
        sd = ImageDraw.Draw(st)
        sd.ellipse([8, 8, 252, 252], fill=brand + (255,), outline=(255, 255, 255), width=8)
        centered(sd, 58, f"{pct:.0f}%", font(88), (255, 255, 255), 260)
        centered(sd, 162, "할인", font(44), (255, 255, 255), 260)
        st = st.rotate(12, resample=Image.BICUBIC)
        img.paste(st, (W - 300, CARD_BOTTOM - 230), st)

    # 가격
    d = ImageDraw.Draw(img)
    py = CARD_BOTTOM + 25
    if deal.get("original_price"):
        of = font(50)
        txt = fmt_won(deal["original_price"])
        w = d.textlength(txt, font=of)
        x0 = (W - w) / 2
        d.text((x0, py), txt, font=of, fill=(150, 150, 158))
        mid = py + 34
        d.line([(x0 - 6, mid), (x0 + w + 6, mid)], fill=(150, 150, 158), width=5)
        py += 72
    if deal.get("price"):
        centered(d, py, fmt_won(deal["price"]), font(116), accent, W, stroke=4)
    return img


def render_frames(job: Job, s: Script) -> list[dict]:
    W, H = config.get("video.width", 1080), config.get("video.height", 1920)
    max_chars = config.get("subtitle.max_chars", 15)
    strip = config.get("subtitle.strip_period", True)
    out_dir = job.p("frames")
    out_dir.mkdir(exist_ok=True)
    for old in out_dir.glob("*.png"):
        old.unlink()

    base = base_layer(job, s, W, H)
    base.save(out_dir / "base.png")
    align = json.loads(job.p("align.json").read_text(encoding="utf-8"))["lines"]
    frames = []
    for a in align:
        img = base.copy()
        d = ImageDraw.Draw(img)
        shown = display_text(a["text"])
        parts = split_subtitle(shown, max_chars, strip)[: config.get("subtitle.max_lines", 2)]
        sf = min((fit_text(d, p, W - 140, 84) for p in parts), key=lambda f: f.size)
        # 흰 상자 + 검은 굵은 글씨: 어떤 배경에서도 읽힘
        line_h = sf.size + 24
        box_h = len(parts) * line_h + 36
        top = SUB_TOP + (SUB_H - box_h) // 2
        d.rounded_rectangle([50, top, W - 50, top + box_h], 26, fill=(255, 255, 255))
        y = top + 16
        for p in parts:
            centered(d, y, p, sf, (10, 10, 12), W)
            y += line_h
        path = out_dir / f"body_{a['idx']:03d}.png"
        img.save(path)
        frames.append({"path": str(path), "start": a["start"], "end": a["end"], "sub": parts})
    (out_dir / "frames.json").write_text(json.dumps(frames, ensure_ascii=False, indent=2), encoding="utf-8")
    return frames
