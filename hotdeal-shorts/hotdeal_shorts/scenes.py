"""장면(scene) 파싱: 대본 본문을 [post] / [community: 스타일] / [kakao] 블록으로 나눈다.

    [post]                         내 채널이 말하는 게시글형 (블록 표시가 없으면 전부 post)
    차 안에 과자 부스러기 보면 한숨부터 나오잖음

    [community: 더쿠]              실제 글 옮기기. source·captured 필수, 닉네임은 자동으로 가림
    source: https://theqoo.net/...
    captured: 2026-09-28
    title: 차 청소기 이거 괜찮아?
    meta: 조회 1.2만 · 댓글 34     (선택. 원글의 실제 수치만)
    body: 차에 두고 쓰려는데 흡입력 괜찮은지 궁금함
    comment: 나 이거 쓰는데 시트 틈 청소 진짜 편함

    [kakao: 차 청소 얘기]          채널이 만든 상황극. 화면에 "연출된 대화"가 항상 표시됨
    나: 너 차 청소 뭐로 해?
    친구: 세차장 가지 그냥

읽는 줄(나레이션): post 는 각 줄, community 는 body·comment, kakao 는 각 메시지.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

# 스타일 이름(화면 표시용 출처명) → 렌더링 프리셋 키
COMMUNITY_STYLES = {
    "더쿠": "theqoo", "theqoo": "theqoo",
    "디시": "dc", "디시인사이드": "dc", "dc": "dc",
    "네이버카페": "cafe", "네이버 카페": "cafe", "카페": "cafe", "cafe": "cafe",
}
SOURCE_NAMES = {"theqoo": "더쿠", "dc": "디시인사이드", "cafe": "네이버 카페"}


@dataclass
class Item:
    text: str
    role: str = "line"      # line | body | comment | msg
    speaker: str = ""       # kakao 화자


@dataclass
class Scene:
    kind: str               # post | community | kakao
    style: str = ""         # community 프리셋 키 / kakao 방 이름
    meta: dict = field(default_factory=dict)
    items: list[Item] = field(default_factory=list)


HEADER = re.compile(r"^\[(post|community|kakao)(?:\s*:\s*(.+?))?\]$", re.I)
FIELD = re.compile(r"^(source|captured|title|meta|body|comment)\s*:\s*(.*)$", re.I)


def parse(body: str) -> list[Scene]:
    scenes: list[Scene] = []
    cur: Scene | None = None
    for raw in body.splitlines():
        ln = raw.strip()
        if not ln or ln.startswith("#"):
            continue
        h = HEADER.match(ln)
        if h:
            kind, arg = h.group(1).lower(), (h.group(2) or "").strip()
            style = COMMUNITY_STYLES.get(arg.lower(), COMMUNITY_STYLES.get(arg, "theqoo")) if kind == "community" else arg
            cur = Scene(kind=kind, style=style)
            if kind == "community":
                cur.meta["source_name"] = arg or SOURCE_NAMES[style]
            scenes.append(cur)
            continue
        if cur is None:
            cur = Scene(kind="post")
            scenes.append(cur)
        if cur.kind == "post":
            cur.items.append(Item(ln))
        elif cur.kind == "community":
            f = FIELD.match(ln)
            if not f:
                cur.items.append(Item(ln, "comment"))  # 표시 없는 줄은 댓글로
                continue
            key, val = f.group(1).lower(), f.group(2).strip()
            if key in ("body", "comment"):
                cur.items.append(Item(val, key))
            else:
                cur.meta[key] = val
        else:  # kakao
            if ":" in ln:
                who, msg = ln.split(":", 1)
                cur.items.append(Item(msg.strip(), "msg", who.strip()))
            else:
                cur.items.append(Item(ln, "msg", "나"))
    return [s for s in scenes if s.items]


def narration(scenes: list[Scene]) -> list[str]:
    return [it.text for s in scenes for it in s.items]


def index(scenes: list[Scene]) -> list[tuple[int, int]]:
    """나레이션 줄 번호 → (장면 번호, 장면 안 항목 번호)."""
    return [(si, ii) for si, s in enumerate(scenes) for ii in range(len(s.items))]


def lint(scenes: list[Scene]) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for n, s in enumerate(scenes, 1):
        if s.kind != "community":
            continue
        where = f"{n}번째 장면(커뮤니티)"
        if not re.match(r"https?://\S+", s.meta.get("source", "")):
            out.append(("ERROR", f"{where}: source 에 원글 주소가 없음. 실제 글만 옮길 수 있음"))
        if not s.meta.get("captured"):
            out.append(("ERROR", f"{where}: captured(원글 확인 날짜)가 없음"))
        if not any(it.role in ("body", "comment") for it in s.items):
            out.append(("ERROR", f"{where}: body/comment 가 없음"))
    return out
