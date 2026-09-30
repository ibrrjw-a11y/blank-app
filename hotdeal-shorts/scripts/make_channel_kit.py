"""채널 3개 세팅 키트: 배너(2560x1440)·프로필(800x800) 이미지 + 설명란 문서.
이름·색·문구를 CHANNELS 에서 바꾸고 다시 실행하면 된다:  python scripts/make_channel_kit.py"""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.environ.setdefault("HD_HOME", str(ROOT))

from PIL import Image, ImageDraw  # noqa: E402

from hotdeal_shorts.frames import _draw_chevrons, _draw_tag_icon, font, hex_rgb  # noqa: E402

CHANNELS = [
    {"id": "salim", "name": "살림특가", "handle": "@salimdeal", "label": "家", "theme": "노랑",
     "color": "#FFE08A", "sub": "#FFF1C2", "accent": "#FF3B30",
     "tagline": "사두면 무조건 쓰는 살림템, 오늘 제일 싼 것만",
     "category": "생활·주방·식품·청소",
     "chips": ["주방템", "청소템", "생필품", "간식"],
     "alts": ["집꿀템", "오늘살림", "살림최저가"]},
    {"id": "tech", "name": "득템전자", "handle": "@deuktemtech", "label": "電", "theme": "하늘",
     "color": "#BCDCFF", "sub": "#E3F0FF", "accent": "#1B6FE0",
     "tagline": "가전·디지털, 역대가 떴을 때만 알려줌",
     "category": "소형가전·디지털·자동차용품",
     "chips": ["소형가전", "디지털", "차량용품", "역대가"],
     "alts": ["가전털이", "전자최저가", "테크특가"]},
    {"id": "beauty", "name": "파우치특가", "handle": "@pouchdeal", "label": "美", "theme": "핑크",
     "color": "#FFC4D6", "sub": "#FFE3EC", "accent": "#E5245E",
     "tagline": "올영 가기 전에 여기부터 확인",
     "category": "뷰티·헤어·바디·패션잡화",
     "chips": ["스킨케어", "헤어", "메이크업", "1+1"],
     "alts": ["화장대털이", "뷰티최저가", "파우치털이"]},
]
INK = (28, 28, 30)


def banner(c: dict) -> Image.Image:
    W, H = 2560, 1440
    img = Image.new("RGB", (W, H), hex_rgb(c["color"]))
    d = ImageDraw.Draw(img)
    # 배경 무늬: 가격표 아이콘을 옅게 반복 (TV·PC 넓은 화면에서만 보이는 영역)
    for gx in range(-40, W, 300):
        for gy in range(40, H, 260):
            _draw_tag_icon(d, gx + (gy // 260 % 2) * 150, gy, 110, hex_rgb(c["sub"]))
    # 모든 기기에서 보이는 안전 영역 1546x423 (가운데)
    sx0, sy0, sx1, sy1 = (W - 1546) // 2, (H - 423) // 2, (W + 1546) // 2, (H + 423) // 2
    d.rounded_rectangle([sx0 - 20, sy0 - 10, sx1 + 20, sy1 + 10], 48, fill=hex_rgb(c["color"]))
    _draw_chevrons(d, sx0 + 30, sy0 + 50, 110, INK)
    d.text((sx0 + 230, sy0 + 20), c["name"], font=font(170), fill=INK)
    d.text((sx0 + 36, sy0 + 250), c["tagline"], font=font(64), fill=INK)
    x, y, cf = sx0 + 36, sy0 + 345, font(46)
    for chip in c["chips"]:
        w = d.textlength(chip, font=cf) + 56
        d.rounded_rectangle([x, y, x + w, y + 70], 35, fill=(255, 255, 255))
        d.text((x + w / 2, y + 35), chip, font=cf, fill=hex_rgb(c["accent"]), anchor="mm")
        x += w + 20
    d.text((sx1 - 10, sy0 + 60), "매일 업데이트", font=font(44), fill=hex_rgb(c["accent"]), anchor="ra")
    d.text((sx1 - 10, sy0 + 120), "링크는 고정 댓글", font=font(44), fill=INK, anchor="ra")
    return img


def profile(c: dict) -> Image.Image:
    S = 800
    img = Image.new("RGB", (S, S), hex_rgb(c["color"]))
    d = ImageDraw.Draw(img)
    # 원형으로 잘려도 보이도록 가운데 정렬
    d.ellipse([90, 90, S - 90, S - 90], fill=hex_rgb(c["sub"]))
    d.text((S / 2, S / 2 - 40), c["label"], font=font(330), fill=INK, anchor="mm")
    d.text((S / 2, S / 2 + 200), c["name"], font=font(78), fill=hex_rgb(c["accent"]), anchor="mm")
    return img


def description(c: dict) -> str:
    return f"""{c['tagline']}

{c['name']}은 {c['category']} 분야에서 지금 가장 싸게 풀린 딜만 골라 30초 쇼츠로 알려드려요.
✔ 할인율·리뷰·가격 흐름을 보고 '진짜 싸게 살 타이밍'인 것만
✔ 매일 저녁 업데이트
✔ 구매 링크는 각 영상의 고정 댓글에

※ 가격은 영상에 적힌 시각 기준이며, 판매처 사정에 따라 바뀌거나 품절될 수 있어요.
※ 이 채널은 쿠팡 파트너스·토스쇼핑 쉐어링크 등 제휴 활동을 하며, 링크로 구매하시면 일정액의 수수료를 받을 수 있어요. 구매하시는 가격에는 영향이 없어요.

📮 제보·문의: (이메일 입력)"""


def main() -> None:
    out = ROOT / "channels"
    out.mkdir(exist_ok=True)
    doc = ["# 유튜브 채널 3개 세팅 키트", "",
           "각 채널 폴더의 `banner.png`(배너)와 `profile.png`(프로필 사진)를 올리고, 아래 문구를 붙여넣으면 된다.",
           "이름·핸들은 **유튜브에서 사용 가능한지 먼저 확인**할 것 (이미 쓰는 사람이 있을 수 있음).", ""]
    for c in CHANNELS:
        folder = out / c["id"]
        folder.mkdir(exist_ok=True)
        banner(c).save(folder / "banner.png", optimize=True)
        profile(c).save(folder / "profile.png", optimize=True)
        doc += [f"## {c['name']}  ({c['category']})", "",
                f"| 항목 | 값 |", "|---|---|",
                f"| 채널 이름 | **{c['name']}** (대안: {', '.join(c['alts'])}) |",
                f"| 핸들 | `{c['handle']}` (없으면 뒤에 숫자·_kr) |",
                f"| 작업 화면 테마 | {c['theme']} · 라벨 `{c['label']}` |",
                f"| 배너 / 프로필 | `channels/{c['id']}/banner.png` · `channels/{c['id']}/profile.png` |", "",
                "**채널 설명 (정보 탭)**", "", "```", description(c), "```", "",
                "**채널 키워드**", "", "```",
                " ".join(["핫딜", "특가", "최저가", "쇼핑", "꿀템"] + [f'"{k}"' if " " in k else k for k in c["chips"]]),
                "```", ""]
    doc += ["## 공통 설정 (세 채널 모두)", "",
            "- **유튜브 스튜디오 > 설정 > 채널 > 기본 정보**: 국가 대한민국, 키워드 입력",
            "- **설정 > 업로드 기본 설정**: 설명란 기본값에 제휴 고지 문구 넣기 (영상마다 자동으로도 들어가지만 이중 안전장치)",
            "- **설정 > 채널 > 고급 설정**: '아동용 아님' 선택",
            "- **맞춤설정 > 기본 정보 > 링크**: 링크 모음 페이지(예: 링크트리) 1개 — 구독자 적을 때 프로필 링크가 주요 판매 경로",
            "- **워터마크**: 프로필 이미지를 '동영상 끝' 표시",
            "- 채널 3개는 **같은 구글 계정 아래 브랜드 계정 3개**로 만들면 한 번 로그인으로 전환 가능",
            "- 영상 업로드 시 실사풍 AI 이미지를 쓴 경우 '변경되거나 합성된 콘텐츠: 예'", ""]
    (out / "README.md").write_text("\n".join(doc), encoding="utf-8")
    print("\n".join(str(p) for p in sorted(out.rglob("*.png"))))


if __name__ == "__main__":
    main()
