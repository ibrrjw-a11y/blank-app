"""드라이브에서 받은 제품 사진·상세 이미지를 웹용으로 줄이고 assets/js/ibr-media.js 를 만듭니다.

    python3 ibr-web/tools/make_media.py <mapping.json>

mapping.json 형식 (제품 하나당 한 줄):
    [{"key": "arvo|07 플로럴 선샤인 헤어오일", "slug": "arvo-07-oil",
      "main": "/경로/대표.png", "full": false,
      "detail": ["/경로/상세_01.jpg", "/경로/상세_02.jpg"]}, ...]

- 대표 이미지: 긴 쪽 1000px, 배경이 투명하면 그대로(webp 알파), 아니면 webp 품질 84.
  "full": true 면 카드를 꽉 채우는 사진으로 씁니다(배경이 있는 연출컷).
- 상세 이미지: 가로 860px 로 줄이고, 너무 긴 이미지는 세로 2400px 단위로 잘라 여러 장으로 나눕니다.
"""
import json
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(HERE, "assets", "img")
Image.MAX_IMAGE_PIXELS = None


def save_main(src, slug):
    im = Image.open(src)
    im.load()
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
        im = im.convert("RGB")
        if im.width > 860:
            im = im.resize((860, round(im.height * 860 / im.width)), Image.LANCZOS)
        for top in range(0, im.height, 2400):
            part = im.crop((0, top, im.width, min(im.height, top + 2400)))
            if part.height < 8:
                continue
            n += 1
            name = "%02d.webp" % n
            part.save(os.path.join(folder, name), "WEBP", quality=80, method=6)
            outs.append("assets/img/detail/%s/%s" % (slug, name))
    return outs


def main():
    items = json.load(open(sys.argv[1], encoding="utf-8"))
    media = {}
    for it in items:
        entry = {}
        if it.get("main"):
            entry["img"] = save_main(it["main"], it["slug"])
            if it.get("full"):
                entry["full"] = True
        if it.get("detail"):
            entry["detail"] = save_detail(it["detail"], it["slug"])
        if entry:
            media[it["key"]] = entry
        print(it["key"], "main" if "img" in entry else "-", len(entry.get("detail", [])))
    out = os.path.join(HERE, "assets", "js", "ibr-media.js")
    with open(out, "w", encoding="utf-8") as f:
        f.write("/* 제품 사진·상세 이미지 목록. tools/make_media.py 가 만듭니다. 키는 '브랜드id|제품명' 입니다. */\n")
        f.write("window.IBR_MEDIA = " + json.dumps(media, ensure_ascii=False, indent=1) + ";\n")
    print("wrote", out, len(media), "products")


if __name__ == "__main__":
    main()
