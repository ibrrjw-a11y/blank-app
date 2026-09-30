"""TTS 전처리: 숫자·단위를 한국어 읽기로 바꾼다 (엔진마다 숫자 발음이 들쭉날쭉한 문제 방지)."""
from __future__ import annotations

import re

DIGITS = "영일이삼사오육칠팔구"
NATIVE_ONES = ["", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉"]
NATIVE_TENS = ["", "열", "스물", "서른", "마흔", "쉰", "예순", "일흔", "여든", "아흔"]

# 숫자 뒤에 오면 고유어(한, 두, 세…)로 읽는 단위. 99 이하일 때만.
NATIVE_COUNTERS = ("시간", "마리", "봉지", "켤레", "가지", "박스", "세트", "번째", "개", "명", "번", "살", "시",
                   "병", "잔", "장", "벌", "권", "대", "달", "알", "팩", "통", "캔", "배", "군데", "줄", "판", "봉")
# '개월'처럼 고유어 단위와 겹치지만 한자어로 읽는 것 (먼저 검사)
SINO_FIRST = ("개월", "개국", "대장", "번지")

UNITS = [(r"(?<=\d)\s*%", "퍼센트"), (r"(?<=\d)\s*kg\b", "킬로그램"), (r"(?<=\d)\s*g\b", "그램"),
         (r"(?<=\d)\s*ml\b", "밀리리터"), (r"(?<=\d)\s*mAh\b", "밀리암페어"), (r"(?<=\d)\s*cm\b", "센티미터"),
         (r"(?<=\d)\s*mm\b", "밀리미터"), (r"(?<=\d)\s*m\b", "미터"), (r"(?<=\d)\s*L\b", "리터"),
         (r"(?<=\d)\s*W\b", "와트"), (r"(?<=\d)\s*V\b", "볼트")]


def _sino_under_10000(n: int) -> str:
    out = ""
    for unit, value in (("천", 1000), ("백", 100), ("십", 10)):
        d, n = divmod(n, value)
        if d:
            out += ("" if d == 1 else DIGITS[d]) + unit
    if n:
        out += DIGITS[n]
    return out


def sino(n: int) -> str:
    """39900 -> 삼만 구천구백, 10000 -> 만, 0 -> 영."""
    if n == 0:
        return "영"
    parts = []
    for unit, value in (("조", 10 ** 12), ("억", 10 ** 8), ("만", 10 ** 4)):
        d, n = divmod(n, value)
        if d:
            parts.append(("" if d == 1 and unit == "만" else _sino_under_10000(d)) + unit)
    if n:
        parts.append(_sino_under_10000(n))
    return " ".join(parts)


def native(n: int) -> str:
    """1~99 고유어 관형 형태: 1 한, 20 스무, 21 스물한."""
    tens, ones = divmod(n, 10)
    if tens == 2 and ones == 0:
        return "스무"
    return NATIVE_TENS[tens] + NATIVE_ONES[ones]


def _read(m: re.Match) -> str:
    raw, rest = m.group(1), m.string[m.end():]
    num = raw.replace(",", "")
    if "." in num:
        whole, frac = num.split(".", 1)
        return sino(int(whole)) + " 점 " + "".join(DIGITS[int(c)] for c in frac)
    n = int(num)
    follow = rest.lstrip()
    if not follow.startswith(SINO_FIRST) and follow.startswith(NATIVE_COUNTERS) and 0 < n < 100:
        return native(n)
    return sino(n)


def to_speech(text: str) -> str:
    text = text.replace("*", "")  # 화면 강조 표시는 읽지 않음
    text = re.sub(r"(?<!\d)1\s*\+\s*1(?!\d)", "원 플러스 원", text)
    text = re.sub(r"(?<!\d)2\s*\+\s*1(?!\d)", "투 플러스 원", text)
    for pat, word in UNITS:
        text = re.sub(pat, word, text)
    # '2천4백', '3만' 처럼 숫자+한글단위 혼합은 숫자 부분만 읽기로 (2천 -> 이천)
    text = re.sub(r"(\d+)(?=[천백십만억])", lambda m: "" if m.group(1) == "1" else sino(int(m.group(1))), text)
    return re.sub(r"(\d[\d,]*(?:\.\d+)?)", _read, text)
