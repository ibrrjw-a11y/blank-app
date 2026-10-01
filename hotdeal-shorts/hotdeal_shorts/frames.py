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


def font(size: int, weight: str = "bold") -> ImageFont.FreeTypeFont:
    """채널마다 폰트가 달라서 경로까지 캐시 키로 쓴다."""
    return _font(find_font(weight), int(size))


@lru_cache(maxsize=256)
def _font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


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
    if len(t.replace("*", "")) <= max_chars:
        return [t]
    words = t.split(" ")
    if len(words) == 1:
        mid = (len(t) + 1) // 2
        return [t[:mid], t[mid:]]
    best, best_cost = None, None
    for i in range(1, len(words)):
        top, bottom = " ".join(words[:i]), " ".join(words[i:])
        # 두 줄 중 긴 쪽을 최소화, 같으면 윗줄이 짧은 쪽 선호
        lt, lb = len(top.replace("*", "")), len(bottom.replace("*", ""))
        cost = (max(lt, lb), lt > lb)
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
    if url and Path(url).exists():  # 작업 화면에서 올린 파일
        img = Image.open(url).convert("RGBA")
        img.convert("RGB").save(job.p("product.jpg"), quality=92)
        return img
    if url:
        try:
            r = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
            r.raise_for_status()
            img = Image.open(io.BytesIO(r.content)).convert("RGBA")
            img.convert("RGB").save(job.p("product.jpg"), quality=92)
            return img
        except Exception as e:  # noqa: BLE001
            job.log(f"상품 이미지 다운로드 실패: {e}")
    return _image_from_link(job)


def _image_from_link(job: Job) -> Image.Image | None:
    """상품 사진이 없으면 상품 링크 페이지의 대표 사진(og:image)을 가져온다 (한 번 받으면 product.jpg 로 저장)."""
    from . import config
    from .deals import fetch_url_meta
    deal = job.deal
    if deal.get("source") == "toss" and not config.get("deals.toss_use_thumbnails", True):
        return None
    marker = job.p(".no_product_image")
    if marker.exists():  # 한 번 실패했으면 매 프레임마다 다시 시도하지 않음
        return None
    for link in (deal.get("url"), deal.get("affiliate_url")):
        if not link or not str(link).startswith("http"):
            continue
        img_url = fetch_url_meta(link).get("image_url")
        if not img_url:
            continue
        try:
            r = requests.get(img_url, timeout=15, headers={"User-Agent": "Mozilla/5.0", "Referer": link})
            r.raise_for_status()
            img = Image.open(io.BytesIO(r.content)).convert("RGBA")
            img.convert("RGB").save(job.p("product.jpg"), quality=92)
            job.log(f"상품 사진: 링크 페이지 대표 사진 사용 ({img_url})")
            return img
        except Exception as e:  # noqa: BLE001
            job.log(f"링크 대표 사진 다운로드 실패: {e}")
    marker.write_text("", encoding="utf-8")
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


def contain_on_white(img: Image.Image, size: tuple[int, int], margin: int = 40,
                     bg_color=(255, 255, 255, 255)) -> Image.Image:
    """상품 누끼 사진용: 단색 바탕 가운데 배치."""
    bg = Image.new("RGBA", size, bg_color)
    im = img.copy()
    im.thumbnail((size[0] - margin * 2, size[1] - margin * 2), Image.LANCZOS)
    bg.paste(im, ((size[0] - im.width) // 2, (size[1] - im.height) // 2), im)
    return bg


def line_images(job: Job, texts: list[str], size: tuple[int, int],
                bg_color=(255, 255, 255, 255)) -> list[Image.Image]:
    """줄별 사진: images/line_000.jpg ... 가 있으면 그 줄부터 사용, 없으면 앞 줄 사진 유지.
    첫 사진이 나오기 전, 그리고 가격을 말하는 줄은 실제 상품 사진.
    상품 사진이 없으면 (토스 썸네일 미사용 등) 빈 회색 화면 대신 가까운 AI 이미지를 쓴다."""
    from .images import is_price_line

    def ai(i: int) -> Image.Image | None:
        for ext in ("jpg", "jpeg", "png", "webp"):
            p = job.p("images", f"line_{i:03d}.{ext}")
            if p.exists():
                return cover(Image.open(p).convert("RGBA"), size)
        return None

    prod = product_image(job)
    margin = 40 if size[0] < 1080 else 140
    per_line = [ai(i) for i in range(len(texts))]
    first_ai = next((im for im in per_line if im is not None), None)
    if prod:
        base = contain_on_white(prod, size, margin, bg_color)
    else:
        base = first_ai or placeholder(size, job.deal["name"])
    tail = int(config_get("video.product_tail_lines", 2))
    out, cur = [], base
    for i, text in enumerate(texts):
        must_product = prod is not None and (is_price_line(text) or i >= len(texts) - tail)
        if must_product:  # 가격 줄·마지막 부분은 반드시 실제 상품 사진
            out.append(base)
            continue
        if per_line[i] is not None:
            cur = per_line[i]
        out.append(cur)
    return out


def config_get(key: str, default=None):
    from . import config
    return config.get(key, default)


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
    from .layouts import current
    return current().base(job, s, W, H)


def rounded_mask(size: tuple[int, int], radius: int = 22) -> Image.Image:
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius, fill=255)
    return m


def _photo_bg() -> tuple[int, int, int, int]:
    from .layouts import current
    return (21, 23, 27, 255) if current().name == "fullbleed" else (255, 255, 255, 255)


def render_frames(job: Job, s: Script) -> list[dict]:
    from . import scene_frames
    from .layouts import current
    from .scenes import index as scene_index
    from .script import read_scenes

    L = current()
    W, H = config.get("video.width", 1080), config.get("video.height", 1920)
    max_chars = config.get("subtitle.max_chars", 15)
    strip = config.get("subtitle.strip_period", True)
    out_dir = job.p("frames")
    out_dir.mkdir(exist_ok=True)
    for old in out_dir.glob("*.png"):
        old.unlink()

    base = L.base(job, s, W, H)
    align = json.loads(job.p("align.json").read_text(encoding="utf-8"))["lines"]
    x0, y0, x1, y1 = L.photo_box
    photos = line_images(job, [a["text"] for a in align], (x1 - x0, y1 - y0), _photo_bg())
    chip = L.price_chip(job.deal)
    # 가격표는 가격을 말하는 줄부터 표시 (핫딜 반전 효과). 가격 언급이 없으면 처음부터.
    price_from = next((a["idx"] for a in align if "원" in display_text(a["text"])
                       and re.search(r"\d", display_text(a["text"]))), 0)
    if not config.get("video.price_reveal", True):
        price_from = 0

    scs = read_scenes(job.p("script.md"))
    where = scene_index(scs)
    if len(where) != len(align):
        raise ValueError("대본과 음성 줄 수가 다름. 대본을 고쳤다면 hd build 를 다시 실행하세요")
    chrome = L.chrome(W, H, s.title) if any(sc.kind != "post" for sc in scs) else None

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
        img = L.compose(base, photo, chip if a["idx"] >= price_from else None)
        img.save(out_dir / f"body_{a['idx']:03d}_clean.png")  # 자막 없는 판 (캡컷에서 자막을 따로 편집할 때)
        parts = split_subtitle(display_text(a["text"]), max_chars, strip)[: config.get("subtitle.max_lines", 2)]
        L.subtitle(img, parts)
        img.save(path)
        frames.append({"path": str(path), "start": a["start"], "end": a["end"],
                       "sub": [p.replace("*", "") for p in parts],
                       "clean": str(out_dir / f"body_{a['idx']:03d}_clean.png"), "sub_y": L.sub_y})
    (out_dir / "frames.json").write_text(json.dumps(frames, ensure_ascii=False, indent=2), encoding="utf-8")
    return frames


def preview(job: Job, s: Script, W: int = 1080, H: int = 1920) -> Image.Image:
    """테마·채널 고르기용 미리보기: 첫 줄 장면 (사진 + 자막 + 가격)."""
    from .layouts import current
    L = current()
    x0, y0, x1, y1 = L.photo_box
    photo = line_images(job, s.lines[:1] or [""], (x1 - x0, y1 - y0), _photo_bg())[0]
    img = L.compose(L.base(job, s, W, H), photo, L.price_chip(job.deal))
    text = s.lines[0] if s.lines else s.title
    L.subtitle(img, split_subtitle(display_text(text), config.get("subtitle.max_chars", 15))[:2])
    return img
