"""채널 3개 세팅 키트: 배너(2560x1440)·프로필(800x800) + 설명란 문서.

세 채널이 서로 관련 없어 보이도록 이름 규칙·글꼴·색·배너 구성·프로필 모양·설명 말투를 전부 다르게 만든다
(공통 아이콘·공통 문구·같은 배치 없음). 이름·색·글꼴은 config.yaml 의 channels 를 따른다.
실행: python scripts/make_channel_kit.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.environ.setdefault("HD_HOME", str(ROOT))

from PIL import Image, ImageDraw  # noqa: E402

from hotdeal_shorts import config, profiles  # noqa: E402
from hotdeal_shorts.frames import font, hex_rgb  # noqa: E402

W, H = 2560, 1440
SAFE = ((W - 1546) // 2, (H - 423) // 2, (W + 1546) // 2, (H + 423) // 2)  # 모든 기기에서 보이는 영역


def col(key: str) -> tuple[int, int, int]:
    return hex_rgb(config.get(f"channel.{key}"))


# ------------------------------------------------------------------ 오늘도살림: 따뜻한 크림 + 동글동글

def salim_banner() -> Image.Image:
    img = Image.new("RGB", (W, H), col("bg"))
    d = ImageDraw.Draw(img)
    bg = col("bg")
    for (x, y, r, c, a) in [(260, 260, 420, "sub", 0.7), (2330, 1180, 520, "sub", 0.7),
                            (2250, 190, 180, "color", 0.35), (330, 1230, 150, "color", 0.35)]:
        mix = tuple(int(bg[i] + (col(c)[i] - bg[i]) * a) for i in range(3))  # 배경과 섞은 단색 (번짐 없음)
        d.ellipse([x - r, y - r, x + r, y + r], fill=mix)
    x0, y0, x1, y1 = SAFE
    name = config.get("channel.name")
    d.text((W / 2, y0 + 140), name, font=font(190), fill=col("ink"), anchor="mm")
    d.text((W / 2, y0 + 300), config.get("channel.tagline"), font=font(60, "regular"), fill=(120, 96, 70),
           anchor="mm")
    d.rounded_rectangle([W / 2 - 60, y0 + 380, W / 2 + 60, y0 + 392], 6, fill=col("color"))
    return img


def salim_profile() -> Image.Image:
    img = Image.new("RGB", (800, 800), col("bg"))
    d = ImageDraw.Draw(img)
    d.ellipse([70, 70, 730, 730], fill=col("color"))
    d.text((400, 390), config.get("channel.logo", "살"), font=font(360), fill=col("bg"), anchor="mm")
    return img


def salim_desc() -> str:
    return f"""{config.get('channel.tagline')} 🧺

주방·청소·생필품처럼 매일 쓰는 살림템이
평소보다 확 싸게 풀리는 날만 골라서 30초로 알려드려요.
장바구니 담기 전에 한 번만 보고 가세요!

· 저녁 7시 반쯤 올라와요
· 구매 링크는 영상 고정 댓글에 있어요

[광고] 이 채널은 쿠팡 파트너스·토스쇼핑 쉐어링크 활동을 하며, 링크로 구매하시면 수수료를 받을 수 있어요. 구매 가격에는 영향이 없어요.
가격은 영상에 적힌 시각 기준이라 바뀌거나 품절될 수 있어요.

제보·문의: (이메일)"""


# ------------------------------------------------------------------ GEARLOG: 검정 + 격자 + 네온

def tech_banner() -> Image.Image:
    img = Image.new("RGB", (W, H), col("bg"))
    d = ImageDraw.Draw(img)
    for x in range(0, W, 80):
        d.line([(x, 0), (x, H)], fill=(24, 26, 31), width=2)
    for y in range(0, H, 80):
        d.line([(0, y), (W, y)], fill=(24, 26, 31), width=2)
    x0, y0, x1, y1 = SAFE
    neon = col("accent")
    d.rectangle([x0, y0 + 40, x0 + 16, y0 + 300], fill=neon)
    d.text((x0 + 60, y0 + 20), config.get("channel.tag", "GEARLOG"), font=font(220), fill=(255, 255, 255))
    d.text((x0 + 66, y0 + 290), config.get("channel.tagline"), font=font(54, "regular"), fill=(170, 176, 186))
    d.text((x1, y1 - 20), "LOG / 가전 · 디지털 · 차량", font=font(40, "regular"), fill=neon, anchor="rs")
    return img


def tech_profile() -> Image.Image:
    img = Image.new("RGB", (800, 800), col("bg"))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([150, 150, 650, 650], 60, outline=col("accent"), width=26)
    d.text((400, 392), "G", font=font(380), fill=(255, 255, 255), anchor="mm")
    return img


def tech_desc() -> str:
    return f"""{config.get('channel.tagline')}.

소형가전 / 디지털 / 차량용품.
역대 최저가에 가까울 때만 올립니다. 스펙 나열 없이, 살 이유 하나만.

UPLOAD  평일 점심
LINK    고정 댓글

#광고 쿠팡 파트너스 및 토스쇼핑 쉐어링크 활동의 일환으로 수수료를 받을 수 있습니다(구매가 동일).
가격은 게시 시점 기준이며 변동될 수 있습니다.

contact: (이메일)"""


# ------------------------------------------------------------------ 파우치노트: 잡지 표지형 여백

def beauty_banner() -> Image.Image:
    img = Image.new("RGB", (W, H), col("bg"))
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = SAFE
    ink, accent = col("ink"), col("accent")
    mast = " ".join(config.get("channel.tag", "POUCH NOTE"))
    d.text((W / 2, y0 + 30), mast, font=font(58, "regular"), fill=ink, anchor="mt")
    d.line([(x0 + 200, y0 + 120), (x1 - 200, y0 + 120)], fill=ink, width=3)
    d.text((W / 2, y0 + 230), config.get("channel.name"), font=font(150), fill=ink, anchor="mm")
    d.text((W / 2, y0 + 360), config.get("channel.tagline"), font=font(48, "regular"), fill=accent, anchor="mm")
    return img


def beauty_profile() -> Image.Image:
    img = Image.new("RGB", (800, 800), col("color"))
    d = ImageDraw.Draw(img)
    d.ellipse([110, 110, 690, 690], outline=col("ink"), width=6)
    d.text((400, 380), "p.n", font=font(210), fill=col("ink"), anchor="mm")
    return img


def beauty_desc() -> str:
    return f"""{config.get('channel.tagline')}.

스킨케어, 헤어, 바디.
오래 쓰게 되는 것들이 좋은 가격에 나왔을 때 짧게 적어둡니다.
매일 밤, 한 권씩.

*광고 표기 — 쿠팡 파트너스·토스쇼핑 쉐어링크 링크로 구매 시 소정의 수수료를 받습니다. 구매 금액은 달라지지 않아요.
*가격은 기록 시점 기준입니다.

letters: (이메일)"""


KIT = {"salim": (salim_banner, salim_profile, salim_desc),
       "tech": (tech_banner, tech_profile, tech_desc),
       "beauty": (beauty_banner, beauty_profile, beauty_desc)}


def main() -> None:
    out = ROOT / "channels"
    out.mkdir(exist_ok=True)
    doc = ["# 유튜브 채널 3개 세팅 키트", "",
           "세 채널이 **서로 관련 없어 보이도록** 이름 규칙·글꼴·색·배너 구성·프로필·설명 말투·올리는 시간을 전부 다르게 했다.",
           "이름·핸들은 유튜브에서 사용 가능한지 먼저 확인할 것. 바꾸려면 `config.yaml` 의 `channels` 를 고치고 "
           "`python scripts/make_channel_kit.py` 를 다시 실행.", ""]
    for cid, (banner, profile, desc) in KIT.items():
        prof = profiles.all_profiles().get(cid)
        if not prof:
            continue
        with profiles.applied(cid):
            folder = out / cid
            folder.mkdir(exist_ok=True)
            banner().save(folder / "banner.png", optimize=True)
            profile().save(folder / "profile.png", optimize=True)
            doc += [f"## {prof['name']}", "",
                    "| 항목 | 값 |", "|---|---|",
                    f"| 핸들 | `{prof.get('handle')}` |",
                    f"| 영상 레이아웃 | {prof.get('layout')} |",
                    f"| 글꼴 | {Path(prof['fonts']['bold']).stem} |",
                    f"| 목소리 | {prof.get('voice', {}).get('provider')} |",
                    f"| 올리는 시간 | {prof.get('upload_time')} |",
                    f"| 파일 | `channels/{cid}/banner.png` · `channels/{cid}/profile.png` |", "",
                    "**채널 설명**", "", "```", desc(), "```", "",
                    "**키워드**", "", "```", " ".join(h.lstrip("#") for h in prof.get("hashtags", [])), "```", ""]
    doc += ["## 서로 관련 없어 보이게 운영하는 법", "",
            "- **브랜드 계정은 따로**: 같은 구글 계정 아래 브랜드 계정 3개로 만들어도 시청자에게는 연결이 보이지 않는다. "
            "다만 채널 설명·링크 모음 페이지·문의 이메일은 채널마다 다르게 쓴다 (같은 링크트리·같은 이메일이면 바로 티가 남)",
            "- **링크 모음 페이지도 채널별로 따로** 만들고, 제휴 링크는 채널별 추적 태그로 구분 (쿠팡 subId · 토스 subTag)",
            "- **같은 상품을 여러 채널에 동시에 올리지 않기**: 카테고리를 나눴으니 겹칠 일이 적지만, 겹치면 최소 며칠 간격",
            "- **올리는 시간·요일을 다르게** (위 표)",
            "- **목소리·자막 스타일·레이아웃을 섞지 않기**: 채널마다 고정 (작업 화면에서 채널을 고르면 자동 적용)",
            "- 다른 채널을 서로 추천·언급하지 않기", ""]
    (out / "README.md").write_text("\n".join(doc), encoding="utf-8")
    print("\n".join(str(p) for p in sorted(out.rglob("*.png"))))


if __name__ == "__main__":
    main()
