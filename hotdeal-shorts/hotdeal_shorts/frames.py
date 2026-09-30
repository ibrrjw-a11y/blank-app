"""화면 PNG 생성: 줄마다 1장. 커뮤니티 글 스타일 (배너·프로필·고정 제목·자막·사진)."""
from __future__ import annotations

import io
import json
import re
from functools import lru_cache
from pathlib import Path

import requests
from PIL import Image, ImageDraw, ImageFont

from . import config
from .job import Job
from .script import Script

FONT_CANDIDATES = {
    "bold": [
        "fonts/Pretendard-ExtraBold.otf", "fonts/Pretendard-Bold.otf",  # 직접 넣은 폰트 우선
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
        "/usr/share/fonts/noto-cjk/NotoSansCJK-Bold.ttc",
        "C:/Windows/Fonts/malgunbd.ttf",
        "/System/Library/Fonts/AppleSDGothicNeo.ttc",
        "/Library/Fonts/AppleGothic.ttf",
    ],
    "regular": [
        "fonts/Pretendard-Medium.otf", "fonts/Pretendard-Regular.otf",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Medium.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc",
        "C:/Windows/Fonts/malgun.ttf",
        "/System/Library/Fonts/AppleSDGothicNeo.ttc",
        "/Library/Fonts/AppleGothic.ttf",
    ],
}


def find_font(weight: str = "bold") -> str:
    custom = config.get("video.font") if weight == "bold" else config.get("video.font_regular")
    cands = ([custom] if custom else []) + FONT_CANDIDATES[weight]
    for c in cands:
        p = Path(c) if Path(c).is_absolute() else config.home() / c
        if p.exists():
            return str(p)
    if weight != "bold":
        return find_font("bold")
    raise FileNotFoundError("한글 굵은 폰트를 찾지 못함. fonts/ 폴더에 Pretendard-Bold.otf 를 넣거나 "
                            "config.yaml 의 video.font 에 경로를 적어주세요.")


@lru_cache(maxsize=64)
def font(size: int, weight: str = "bold") -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(find_font(weight), size)


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


def load_ref(job: Job, ref: str) -> Image.Image | None:
    """커뮤니티 본문 이미지: 'product' = 상품 사진, 그 외는 작업 폴더 기준 파일 경로."""
    if ref.strip().lower() == "product":
        return product_image(job) or placeholder((900, 675), job.deal["name"])
    p = job.p(ref.strip())
    if p.exists():
        return Image.open(p).convert("RGBA")
    job.log(f"본문 이미지 없음: {ref}")
    return None


def placeholder(size: tuple[int, int], name: str) -> Image.Image:
    """사진이 없을 때: 부드러운 회색 그라데이션 + 상품명."""
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 255))
    d = ImageDraw.Draw(img)
    for y in range(h):
        v = int(236 - 26 * y / h)
        d.line([(0, y), (w, y)], fill=(v, v, v + 3, 255))
    f = font(58)
    lines = wrap(d, name, f, w - 120, 2)
    y = h // 2 - len(lines) * 40
    for ln in lines:
        centered(d, y, ln, f, (90, 90, 96), w)
        y += 80
    return img


def cover(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    """비율 유지하며 꽉 채우고 가운데를 자른다."""
    w, h = size
    scale = max(w / img.width, h / img.height)
    r = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    x, y = (r.width - w) // 2, (r.height - h) // 2
    return r.crop((x, y, x + w, y + h))


def contain_on_white(img: Image.Image, size: tuple[int, int], margin: int = 40) -> Image.Image:
    """상품 누끼 사진용: 흰 바탕 가운데 배치."""
    bg = Image.new("RGBA", size, (255, 255, 255, 255))
    im = img.copy()
    im.thumbnail((size[0] - margin * 2, size[1] - margin * 2), Image.LANCZOS)
    bg.paste(im, ((size[0] - im.width) // 2, (size[1] - im.height) // 2), im)
    return bg


def line_images(job: Job, texts: list[str], size: tuple[int, int]) -> list[Image.Image]:
    """줄별 사진: images/line_000.jpg ... 가 있으면 그 줄부터 사용, 없으면 앞 줄 사진 유지.
    첫 사진이 나오기 전, 그리고 가격을 말하는 줄은 실제 상품 사진."""
    from .images import is_price_line
    prod = product_image(job)
    base = contain_on_white(prod, size) if prod else placeholder(size, job.deal["name"])
    out, cur = [], base
    for i, text in enumerate(texts):
        if is_price_line(text):
            cur = base
        for ext in ("jpg", "jpeg", "png", "webp"):
            p = job.p("images", f"line_{i:03d}.{ext}")
            if p.exists():
                cur = cover(Image.open(p).convert("RGBA"), size)
                break
        out.append(cur)
    return out


# ------------------------------------------------------------------ 레이아웃 (1080x1920 기준)
# 배너 0-190 | 프로필 225-365 | 고정 제목 390-470 | 구분선 495 | 자막 525-715 | 사진 745-1450 | 아래는 쇼츠 UI 영역

BANNER_H = 190
PHOTO_BOX = (65, 745, 1015, 1450)  # 4:3 에 가까운 950x705


def _draw_chevrons(d, x: int, y: int, size: int, color) -> None:
    for k in range(2):
        ox = x + k * int(size * 0.62)
        d.line([(ox, y), (ox + size // 2, y + size // 2), (ox, y + size)], fill=color, width=max(8, size // 7),
               joint="curve")


def _draw_tag_icon(d, cx: int, cy: int, size: int, color) -> None:
    """가격표 아이콘 (브랜드 고유 아이콘)."""
    s = size
    body = [(cx - s * 0.5, cy - s * 0.3), (cx + s * 0.15, cy - s * 0.3), (cx + s * 0.5, cy),
            (cx + s * 0.15, cy + s * 0.3), (cx - s * 0.5, cy + s * 0.3)]
    d.polygon(body, outline=color, width=max(6, s // 12))
    r = s * 0.07
    d.ellipse([cx + s * 0.08 - r, cy - r, cx + s * 0.08 + r, cy + r], fill=color)
    tf = font(int(s * 0.34))
    d.text((cx - s * 0.36, cy - s * 0.24), "%", font=tf, fill=color)


def base_layer(job: Job, s: Script, W: int, H: int) -> Image.Image:
    deal = job.deal
    banner_bg = hex_rgb(config.get("channel.color", "#FFE08A"))
    ink = hex_rgb(config.get("channel.ink", "#1C1C1E"))
    label_bg = hex_rgb(config.get("channel.label_bg", "#FFF1C2"))

    img = Image.new("RGB", (W, H), (255, 255, 255))
    d = ImageDraw.Draw(img)

    # 1) 상단 배너: 화살표 + 채널명 + 아이콘
    d.rectangle([0, 0, W, BANNER_H], fill=banner_bg)
    _draw_chevrons(d, 55, 58, 74, ink)
    name = config.get("channel.name", "오늘의 핫딜")
    nf = fit_text(d, name, W - 420, 104, min_size=64)
    d.text((W / 2 + 10, BANNER_H / 2 + 4), name, font=nf, fill=ink, anchor="mm")
    _draw_tag_icon(d, W - 115, BANNER_H // 2, 120, ink)

    # 2) 프로필 줄: 카테고리 라벨 + 이름 + 한 줄 소개
    lx, ly, ls = 65, 225, 140
    d.rectangle([lx, ly, lx + ls, ly + ls], fill=label_bg)
    label = config.get("channel.label", "得")
    d.text((lx + ls / 2, ly + ls / 2), label, font=font(92), fill=ink, anchor="mm")
    cat = deal.get("category") or config.get("channel.label_name", "핫딜")
    d.text((lx + ls + 32, ly + 12), " ".join(cat), font=font(50), fill=ink)
    tagline = config.get("channel.tagline", "오늘 올라온 특가만 골라요")
    d.text((lx + ls + 32, ly + 88), tagline, font=font(30, "regular"), fill=(142, 142, 147))

    # 3) 고정 제목 (영상 내내)
    tf = fit_text(d, s.title, W - 130, 56, min_size=40)
    d.text((W / 2, 430), s.title, font=tf, fill=ink, anchor="mm")
    d.line([(0, 495), (W, 495)], fill=(222, 222, 226), width=3)

    return img


def rounded_mask(size: tuple[int, int], radius: int = 22) -> Image.Image:
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius, fill=255)
    return m


def price_chip(deal: dict, max_w: int) -> Image.Image | None:
    """사진 오른쪽 아래에 얹는 가격표: 정가(취소선) + 할인율 + 할인가."""
    if not deal.get("price"):
        return None
    brand = hex_rgb(config.get("channel.price_color", "#FF3B30"))
    tmp = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    pf, of, cf = font(64), font(34, "regular"), font(40)
    sale = fmt_won(deal["price"])
    orig = fmt_won(deal["original_price"]) if deal.get("original_price") else ""
    pct = f"{deal['discount_pct']:.0f}%" if deal.get("discount_pct") else ""
    pw = tmp.textlength(sale, font=pf)
    top_w = tmp.textlength(orig, font=of) + (tmp.textlength(pct, font=cf) + 20 if pct else 0)
    w = int(max(pw, top_w) + 56)
    h = 150 if (orig or pct) else 100
    chip = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    cd = ImageDraw.Draw(chip)
    cd.rounded_rectangle([0, 0, w - 1, h - 1], 22, fill=(255, 255, 255, 245), outline=(225, 225, 230), width=2)
    y = 18
    if orig or pct:
        x = 28
        if pct:
            cd.text((x, y - 4), pct, font=cf, fill=brand)
            x += int(cd.textlength(pct, font=cf)) + 20
        if orig:
            cd.text((x, y + 2), orig, font=of, fill=(150, 150, 156))
            ow = cd.textlength(orig, font=of)
            cd.line([(x, y + 24), (x + ow, y + 24)], fill=(150, 150, 156), width=3)
        y += 52
    cd.text((w - 28, y + 36), sale, font=pf, fill=(20, 20, 22), anchor="rm")
    if w > max_w:
        chip = chip.resize((max_w, int(h * max_w / w)), Image.LANCZOS)
    return chip


def render_frames(job: Job, s: Script) -> list[dict]:
    W, H = config.get("video.width", 1080), config.get("video.height", 1920)
    max_chars = config.get("subtitle.max_chars", 15)
    strip = config.get("subtitle.strip_period", True)
    ink = hex_rgb(config.get("channel.ink", "#1C1C1E"))
    out_dir = job.p("frames")
    out_dir.mkdir(exist_ok=True)
    for old in out_dir.glob("*.png"):
        old.unlink()

    base = base_layer(job, s, W, H)
    base.save(out_dir / "base.png")
    align = json.loads(job.p("align.json").read_text(encoding="utf-8"))["lines"]
    x0, y0, x1, y1 = PHOTO_BOX
    photos = line_images(job, [a["text"] for a in align], (x1 - x0, y1 - y0))
    chip = price_chip(job.deal, 560)
    mask = rounded_mask((x1 - x0, y1 - y0))
    # 가격표는 가격을 말하는 줄부터 표시 (핫딜 반전 효과). 가격 언급이 없으면 처음부터.
    price_from = next((a["idx"] for a in align if "원" in display_text(a["text"])
                       and re.search(r"\d", display_text(a["text"]))), 0)
    if not config.get("video.price_reveal", True):
        price_from = 0

    from . import scene_frames
    from .scenes import index as scene_index
    from .script import read_scenes
    scs = read_scenes(job.p("script.md"))
    where = scene_index(scs)
    if len(where) != len(align):
        raise ValueError("대본과 음성 줄 수가 다름. 대본을 고쳤다면 hd build 를 다시 실행하세요")
    chrome = scene_frames.chrome(W, H, s.title) if any(sc.kind != "post" for sc in scs) else None

    frames = []
    for a, photo in zip(align, photos):
        si, ii = where[a["idx"]]
        sc = scs[si]
        path = out_dir / f"body_{a['idx']:03d}.png"
        if sc.kind == "community":
            scene_frames.render_community(chrome, sc, ii, lambda ref: load_ref(job, ref)).save(path)
            frames.append({"path": str(path), "start": a["start"], "end": a["end"], "sub": [a["text"]]})
            continue
        if sc.kind == "kakao":
            scene_frames.render_kakao(chrome, sc, ii).save(path)
            frames.append({"path": str(path), "start": a["start"], "end": a["end"], "sub": [a["text"]]})
            continue
        img = base.copy()
        img.paste(photo.convert("RGB"), (x0, y0), mask)
        if chip is not None and a["idx"] >= price_from:
            img.paste(chip, (x1 - chip.width - 24, y1 - chip.height - 24), chip)
        img.save(out_dir / f"body_{a['idx']:03d}_clean.png")  # 자막 없는 판 (캡컷에서 자막을 따로 편집할 때)
        d = ImageDraw.Draw(img)
        shown = display_text(a["text"])
        parts = split_subtitle(shown, max_chars, strip)[: config.get("subtitle.max_lines", 2)]
        sf = min((fit_text(d, p, W - 120, 74) for p in parts), key=lambda f: f.size)
        line_h = sf.size + 22
        y = 620 - (len(parts) * line_h) / 2 + line_h / 2
        for p in parts:
            d.text((W / 2, y), p, font=sf, fill=ink, anchor="mm")
            y += line_h
        img.save(path)
        frames.append({"path": str(path), "start": a["start"], "end": a["end"], "sub": parts,
                       "clean": str(out_dir / f"body_{a['idx']:03d}_clean.png"), "sub_y": 620})
    (out_dir / "frames.json").write_text(json.dumps(frames, ensure_ascii=False, indent=2), encoding="utf-8")
    return frames
