"""장면(scene) 파싱: 대본 본문을 [post] / [community: 스타일] / [kakao] 블록으로 나눈다.

    [post]                         내 채널이 말하는 게시글형 (블록 표시가 없으면 전부 post)
    차 안에 과자 부스러기 보면 한숨부터 나오잖음

    [community: 더쿠]              실제 글 옮기기. source·captured 필수, 닉네임은 자동으로 가림
    source: https://theqoo.net/...
    captured: 2026-09-28
    board: 자유게시판             (선택) 게시판 이름
    tag: 추천                     (선택, 여러 번 가능) 말머리
    title: 차 청소기 이거 괜찮아?
    meta: 조회 1.2만 · 댓글 34     (선택. 원글의 실제 수치만)
    body: 차에 두고 쓰려는데 흡입력 괜찮은지 궁금함
    image: product                (선택) 본문 이미지. product = 상품 사진, 또는 작업 폴더 안 파일 경로
    comment: 나 이거 쓰는데 시트 틈 청소 진짜 편함 || 31     (|| 뒤는 선택: 원글의 실제 좋아요 수)

    스타일: 더쿠, 디시, 네이버카페, 에펨코리아, 인스티즈, 다음카페, 트위터, 유튜브

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
    "에펨": "fmkorea", "에펨코리아": "fmkorea", "펨코": "fmkorea", "fmkorea": "fmkorea",
    "인티": "instiz", "인스티즈": "instiz", "instiz": "instiz",
    "다음카페": "daumcafe", "다음 카페": "daumcafe", "daumcafe": "daumcafe",
    "트위터": "twitter", "x": "twitter", "twitter": "twitter",
    "유튜브": "youtube", "유튜브 댓글": "youtube", "유튜브댓글": "youtube", "youtube": "youtube",
}
SOURCE_NAMES = {"theqoo": "더쿠", "dc": "디시인사이드", "cafe": "네이버 카페", "fmkorea": "에펨코리아",
                "instiz": "인스티즈", "daumcafe": "다음 카페", "twitter": "X(트위터)", "youtube": "유튜브 댓글"}


@dataclass
class Item:
    text: str
    role: str = "line"      # line | body | comment | msg
    speaker: str = ""       # kakao 화자
    likes: str = ""         # 댓글 좋아요 수 (원글의 실제 값일 때만)
    marked: bool = False    # 게시글형 줄 앞 [img]: 이 줄에 AI 이미지 생성 (images.select: marked)


@dataclass
class Scene:
    kind: str               # post | community | kakao
    style: str = ""         # community 프리셋 키 / kakao 방 이름
    meta: dict = field(default_factory=dict)
    items: list[Item] = field(default_factory=list)


HEADER = re.compile(r"^\[(post|community|kakao)(?:\s*:\s*(.+?))?\]$", re.I)
FIELD = re.compile(r"^(source|captured|title|meta|body|comment|image|tag|board)\s*:\s*(.*)$", re.I)


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
                known = arg.lower() in COMMUNITY_STYLES or arg in COMMUNITY_STYLES
                cur.meta["source_name"] = SOURCE_NAMES[style] if known or not arg else arg
            scenes.append(cur)
            continue
        if cur is None:
            cur = Scene(kind="post")
            scenes.append(cur)
        if cur.kind == "post":
            marked = ln.lower().startswith("[img]")
            cur.items.append(Item(ln[5:].strip() if marked else ln, marked=marked))
        elif cur.kind == "community":
            f = FIELD.match(ln)
            if not f:
                text, _, likes = ln.partition("||")
                cur.items.append(Item(text.strip(), "comment", likes=likes.strip()))  # 표시 없는 줄은 댓글로
                continue
            key, val = f.group(1).lower(), f.group(2).strip()
            if key == "comment":
                text, _, likes = val.partition("||")
                cur.items.append(Item(text.strip(), "comment", likes=likes.strip()))
            elif key == "body":
                cur.items.append(Item(val, "body"))
            elif key == "image":  # 본문 몇 번째 문단 뒤에 올지 기억
                cur.meta.setdefault("images", []).append((sum(it.role == "body" for it in cur.items), val))
            elif key == "tag":
                cur.meta.setdefault("tags", []).append(val)
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
