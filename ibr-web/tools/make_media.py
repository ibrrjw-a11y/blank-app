"""드라이브에서 받은 제품 사진·상세 이미지를 웹용으로 줄이고 assets/js/ibr-media.js 를 만듭니다.

    python3 ibr-web/tools/make_media.py <mapping.json>
    python3 ibr-web/tools/make_media.py <mapping.json> "브랜드id|제품명" ...   # 적은 제품만 다시 만들고 나머지는 그대로 둡니다

mapping.json 형식 (제품 하나당 한 줄):
    [{"key": "arvo|07 플로럴 선샤인 헤어오일", "slug": "arvo-07-oil",
      "main": "/경로/대표.png", "full": false,
      "detail": ["/경로/상세_01.jpg", "/경로/상세_02.jpg"]}, ...]

- 대표 이미지: 긴 쪽 1000px, 배경이 투명하면 그대로(webp 알파), 아니면 webp 품질 84.
  "full": true 면 카드를 꽉 채우는 사진으로 씁니다(배경이 있는 연출컷).
  "crop": [왼, 위, 오른, 아래] (0~1 비율) 로 일부만 잘라 쓸 수 있습니다.
  "knockout": true 면 가장자리와 이어진 흰 배경을 투명하게 지웁니다(흰 배경 jpg 누끼용).
  "main": null 이고 "keep_main": true 면 지금 쓰는 사진을 그대로 둡니다(상세만 추가).
- 상세 이미지: 가로 860px 로 줄이고, 너무 긴 이미지는 세로 6000px 단위로 잘라 여러 장으로 나눕니다.
  움직이는 GIF 는 움직임을 살려 애니메이션 webp 로 바꿉니다.
"""
import json
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(HERE, "assets", "img")
Image.MAX_IMAGE_PIXELS = None


def knockout(im, tol=244):
    """가장자리와 이어진 거의 흰 픽셀을 투명하게."""
    from PIL import ImageDraw, ImageFilter
    rgb = im.convert("RGB")
    white = Image.eval(rgb.convert("L"), lambda v: 0)
    px, wp = rgb.load(), white.load()
    for y in range(rgb.height):
        for x in range(rgb.width):
            r, g, b = px[x, y]
            if r >= tol and g >= tol and b >= tol:
                wp[x, y] = 255
    for pt in ((0, 0), (rgb.width - 1, 0), (0, rgb.height - 1), (rgb.width - 1, rgb.height - 1)):
        if wp[pt] == 255:
            ImageDraw.floodfill(white, pt, 128)
    alpha = white.point(lambda v: 0 if v == 128 else 255).filter(ImageFilter.GaussianBlur(0.6))
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    return out


def save_main(src, slug, crop=None, ko=False):
    im = Image.open(src)
    im.load()
    if crop:
        l, t, r, b = crop
        im = im.crop((round(im.width * l), round(im.height * t), round(im.width * r), round(im.height * b)))
    if ko:
        im.thumbnail((1400, 1400), Image.LANCZOS)
        im = knockout(im)
    has_alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
    im = im.convert("RGBA" if has_alpha else "RGB")
    if has_alpha:
        bbox = im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
        if bbox:
            im = im.crop(bbox)
    im.thumbnail((1000, 1000), Image.LANCZOS)
    out = os.path.join(IMG, "products", slug + ".webp")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    im.save(out, "WEBP", quality=84, method=6)
    return "assets/img/products/" + slug + ".webp"


def save_detail(srcs, slug):
    outs, n = [], 0
    folder = os.path.join(IMG, "detail", slug)
    os.makedirs(folder, exist_ok=True)
    for src in srcs:
        im = Image.open(src)
        im.load()
        if getattr(im, "n_frames", 1) > 1:
            frames, durs = [], []
            for i in range(im.n_frames):
                im.seek(i)
                f = im.convert("RGB")
                if f.width > 860:
                    f = f.resize((860, round(f.height * 860 / f.width)), Image.LANCZOS)
                frames.append(f)
                durs.append(im.info.get("duration", 80))
            n += 1
            name = "%02d.webp" % n
            frames[0].save(os.path.join(folder, name), "WEBP", save_all=True, append_images=frames[1:],
                           duration=durs, loop=0, quality=72, method=4)
            outs.append("assets/img/detail/%s/%s" % (slug, name))
            continue
        im = im.convert("RGB")
        if im.width > 860:
            im = im.resize((860, round(im.height * 860 / im.width)), Image.LANCZOS)
        for top in range(0, im.height, 6000):
            part = im.crop((0, top, im.width, min(im.height, top + 6000)))
            if part.height < 8:
                continue
            n += 1
            name = "%02d.webp" % n
            part.save(os.path.join(folder, name), "WEBP", quality=80, method=6)
            outs.append("assets/img/detail/%s/%s" % (slug, name))
    return outs


def main():
    items = json.load(open(sys.argv[1], encoding="utf-8"))
    only = set(sys.argv[2:])
    out = os.path.join(HERE, "assets", "js", "ibr-media.js")
    media = {}
    if only:
        txt = open(out, encoding="utf-8").read()
        media = json.loads(txt[txt.index("=") + 1:txt.rindex(";")])
        items = [it for it in items if it["key"] in only]
    for it in items:
        entry = {}
        if it.get("keep_main"):
            entry["img"] = it["keep_main"]
        if it.get("main"):
            entry["img"] = save_main(it["main"], it["slug"], it.get("crop"), it.get("knockout"))
            if it.get("full"):
                entry["full"] = True
        if it.get("detail"):
            entry["detail"] = save_detail(it["detail"], it["slug"])
        if entry:
            media[it["key"]] = entry
        print(it["key"], "main" if "img" in entry else "-", len(entry.get("detail", [])))
    with open(out, "w", encoding="utf-8") as f:
        f.write("/* 제품 사진·상세 이미지 목록. tools/make_media.py 가 만듭니다. 키는 '브랜드id|제품명' 입니다. */\n")
        f.write("window.IBR_MEDIA = " + json.dumps(media, ensure_ascii=False, indent=1) + ";\n")
    print("wrote", out, len(media), "products")


if __name__ == "__main__":
    main()
