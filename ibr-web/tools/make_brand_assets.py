"""브랜드 필름에 쓰는 사진·누끼·로고를 웹용(webp)으로 줄여 assets/img/brand/<브랜드>/ 에 넣습니다.

    python3 ibr-web/tools/make_brand_assets.py <assets.json>

assets.json: {"arvo": [{"src": "/경로/원본.png", "out": "forest", "kind": "photo", "max": 1400, "inset": 0.03}, ...], ...}
- kind "photo": 긴 쪽 max(기본 1400)px, webp 품질 74. inset 을 주면 가장자리를 그 비율만큼 잘라냅니다.
- kind "cut": 투명 배경 누끼. 빈 여백을 잘라내고 긴 쪽 max(기본 900)px, webp 품질 82(알파 유지).
- kind "logo": 투명 로고. 여백을 잘라내고 긴 쪽 max(기본 800)px, 무손실 webp.
  "color": "#FFFFFF" 를 주면 로고를 그 단색으로 칠합니다(어두운 사진 위에 쓰는 흰 로고).
"""
import json
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "assets", "img", "brand")
Image.MAX_IMAGE_PIXELS = None


def trim(im):
    bbox = im.getchannel("A").point(lambda a: 255 if a > 10 else 0).getbbox()
    return im.crop(bbox) if bbox else im


def one(brand, it):
    im = Image.open(it["src"])
    im.load()
    kind = it.get("kind", "photo")
    if it.get("crop"):
        l, t, r, b = it["crop"]
        im = im.crop((round(im.width * l), round(im.height * t), round(im.width * r), round(im.height * b)))
    if it.get("inset"):
        d = it["inset"]
        im = im.crop((round(im.width * d), round(im.height * d), round(im.width * (1 - d)), round(im.height * (1 - d))))
    path = os.path.join(OUT, brand, it["out"] + ".webp")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if kind == "photo":
        im = im.convert("RGB")
        im.thumbnail((it.get("max", 1400),) * 2, Image.LANCZOS)
        im.save(path, "WEBP", quality=it.get("q", 74), method=6)
    else:
        im = trim(im.convert("RGBA"))
        if it.get("color"):
            c = Image.new("RGBA", im.size, it["color"])
            c.putalpha(im.getchannel("A"))
            im = c
        im.thumbnail((it.get("max", 900 if kind == "cut" else 800),) * 2, Image.LANCZOS)
        if kind == "logo":
            im.save(path, "WEBP", lossless=True, method=6)
        else:
            im.save(path, "WEBP", quality=it.get("q", 82), method=6)
    return path, im.size


def main():
    spec = json.load(open(sys.argv[1], encoding="utf-8"))
    only = sys.argv[2:]
    total = 0
    for brand, items in spec.items():
        if only and brand not in only:
            continue
        for it in items:
            path, size = one(brand, it)
            kb = os.path.getsize(path) // 1024
            total += kb
            print("%-10s %-16s %4dx%-4d %4d KB" % (brand, it["out"], size[0], size[1], kb))
    print("total", total, "KB")


if __name__ == "__main__":
    main()
