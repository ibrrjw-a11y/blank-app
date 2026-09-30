"""대본: 생성(Claude / 템플릿), 파일 입출력, 린트."""
from __future__ import annotations

import os
import re
from pathlib import Path

from pydantic import BaseModel, Field

from . import config, scenes as scenes_mod

HOOK_TYPES = ["가격역설", "결과먼저", "금지명령", "숫자증거", "상황공감", "궁금증"]

BANNED = [
    (r"안녕|여러분 반갑", "인사말"),
    (r"오늘은.*(소개|알아보)", "예고 문장"),
    (r"구독|좋아요|알림\s*설정", "구독/좋아요 요청"),
    (r"가성비(가)? (좋|최고|甲)", "평가 문장(반응 문장으로 바꾸기)"),
]
POLICY_WORDS = ["자살", "마약", "도박", "19금", "섹스", "정치", "대통령", "완치", "암 예방", "특효"]


class Script(BaseModel):
    title: str = Field(description="화면 고정 제목, 12~18자")
    hook_type: str = Field(description="사용한 훅 유형")
    lines: list[str] = Field(description="나레이션 본문 줄들")


# ------------------------------------------------------------------ 파일 형식

def to_markdown(s: Script, approved: bool = False) -> str:
    return (f"---\napproved: {'true' if approved else 'false'}\n"
            f"title: {s.title}\nhook_type: {s.hook_type}\n---\n"
            + "\n".join(s.lines) + "\n")


def _split(path: Path) -> tuple[dict, str]:
    text = path.read_text(encoding="utf-8")
    m = re.match(r"---\n(.*?)\n---\n(.*)", text, re.S)
    if not m:
        raise ValueError(f"{path}: 맨 위에 --- 로 감싼 머리말(title/approved)이 필요합니다")
    meta = dict(line.split(":", 1) for line in m.group(1).splitlines() if ":" in line)
    return {k.strip(): v.strip() for k, v in meta.items()}, m.group(2)


def read(path: Path) -> tuple[Script, bool]:
    """lines 는 모든 장면의 나레이션을 순서대로 편 것."""
    meta, body = _split(path)
    lines = scenes_mod.narration(scenes_mod.parse(body))
    s = Script(title=meta.get("title", ""), hook_type=meta.get("hook_type", ""), lines=lines)
    return s, meta.get("approved", "false").lower() == "true"


def read_scenes(path: Path) -> list[scenes_mod.Scene]:
    return scenes_mod.parse(_split(path)[1])


def set_approved(path: Path, value: bool = True) -> None:
    text = path.read_text(encoding="utf-8")
    text = re.sub(r"approved:\s*\w+", f"approved: {'true' if value else 'false'}", text, count=1)
    path.write_text(text, encoding="utf-8")


# ------------------------------------------------------------------ 가격 읽기

def won_korean(n: int) -> str:
    """39900 -> '3만 9천9백원'. TTS가 숫자를 어색하게 읽는 것을 막는다."""
    if n is None:
        return ""
    man, rest = divmod(int(n), 10000)
    parts = []
    if man:
        parts.append(f"{man}만")
    if rest:
        cheon, rest2 = divmod(rest, 1000)
        baek, sip = divmod(rest2, 100)
        seg = ""
        if cheon:
            seg += f"{cheon}천"
        if baek:
            seg += f"{baek}백"
        if sip:
            seg += f"{sip}"
        parts.append(seg)
    return " ".join(parts) + "원"


# ------------------------------------------------------------------ 생성

def _deal_brief(deal: dict) -> str:
    keys = [("name", "상품명"), ("price", "할인가(원)"), ("original_price", "정가(원)"),
            ("discount_pct", "할인율(%)"), ("reviews", "리뷰 수"), ("rating", "평점"),
            ("category", "카테고리"), ("ends_at", "딜 종료"), ("note", "메모/특징")]
    out = [f"- {label}: {deal[k]}" for k, label in keys if deal.get(k) not in (None, "")]
    if deal.get("price"):
        out.append(f"- 할인가 읽는 법: {won_korean(deal['price'])}")
    return "\n".join(out)


def generate_claude(deal: dict, hook_type: str, extra: str = "") -> Script:
    import anthropic

    system = (config.home() / "prompts" / "script_system.md").read_text(encoding="utf-8").format(
        lines_min=config.get("script.lines_min", 6), lines_max=config.get("script.lines_max", 12),
        line_max_chars=config.get("script.line_max_chars", 30))
    user = (f"아래 핫딜로 대본을 써줘. 훅 유형: {hook_type}\n\n{_deal_brief(deal)}"
            + (f"\n\n추가 요청: {extra}" if extra else ""))
    client = anthropic.Anthropic()
    resp = client.beta.messages.parse(
        model=config.get("script.model", "claude-opus-5-5"),
        max_tokens=16000,
        system=system,
        output_config={"effort": config.get("script.effort", "medium")},
        # 안전 분류기가 거절하면 서버가 대체 모델로 자동 재시도
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        messages=[{"role": "user", "content": user}],
        output_format=Script,
    )
    if resp.stop_reason == "refusal" or resp.parsed_output is None:
        raise RuntimeError(f"대본 생성 실패 (stop_reason={resp.stop_reason})")
    s = resp.parsed_output
    s.hook_type = s.hook_type or hook_type
    return s


def generate_template(deal: dict, hook_type: str) -> Script:
    """API 키 없이 쓰는 기본 대본. 사람이 반드시 다듬는 것을 전제로 한다."""
    name = deal["name"]
    price = won_korean(deal["price"]) if deal.get("price") else "특가"
    pct = deal.get("discount_pct")
    rev = deal.get("reviews")
    hooks = {
        "가격역설": "이거 정가 보고 그냥 지나치면 손해임",
        "결과먼저": "이거 쓰고 나서 다시는 예전으로 못 돌아감",
        "금지명령": f"{deal.get('category') or '이거'} 사기 전에 이거 먼저 보고 사셈",
        "숫자증거": f"리뷰가 {rev:,}개 넘게 달린 물건이 있음" if rev else "재구매가 유독 많은 물건이 있음",
        "상황공감": "매번 이거 때문에 짜증 났던 사람 많을 거임",
        "궁금증": "요즘 장바구니에 이거 하나씩 꼭 담긴다고 함",
    }
    lines = [hooks.get(hook_type, hooks["궁금증"]),
             f"바로 {name}인데",
             "한 번 써본 사람들이 계속 다시 산다고 함",
             "(여기에 쓰는 장면 한 줄 추가)"]
    if pct:
        lines.append(f"원래 가격에서 {pct:.0f}퍼센트나 빠졌음")
    lines += [f"근데 이게 지금 {price}임", "특가 끝나기 전에 링크는 고정 댓글에 있음"]
    title = "리뷰 폭발한" if rev and rev >= 1000 else "지금 난리 난"
    for w in name.split():  # 18자 안에서 어절 단위로 자르기
        if len(title) + 1 + len(w) > 18:
            break
        title += " " + w
    return Script(title=title, hook_type=hook_type, lines=lines)


def generate(deal: dict, hook_type: str | None = None, extra: str = "") -> tuple[Script, str]:
    if not hook_type:
        from .metrics import pick_hook  # 성과 데이터가 쌓이면 잘 되는 훅을 더 자주 고름
        hook_type = pick_hook()
    use_claude = config.get("script.provider", "claude") == "claude" and (
        os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))
    if use_claude:
        try:
            return generate_claude(deal, hook_type, extra), "claude"
        except Exception as e:  # noqa: BLE001 - 키·잔액·네트워크 문제여도 작업은 템플릿 대본으로 계속
            return generate_template(deal, hook_type), f"template (Claude 실패: {type(e).__name__}: {str(e)[:150]})"
    return generate_template(deal, hook_type), "template"


# ------------------------------------------------------------------ 린트

def lint(s: Script, deal: dict, scenes: list | None = None) -> list[tuple[str, str]]:
    """(수준, 메시지) 목록. 수준: ERROR(진행 불가) / WARN.
    길이·말투 규칙은 내가 쓴 줄(post·kakao)에만, 정책 단어는 전부에 적용."""
    out: list[tuple[str, str]] = []
    own = set(range(len(s.lines)))
    if scenes:
        out += scenes_mod.lint(scenes)
        pos = [sc.kind for sc in scenes for _ in sc.items]
        own = {i for i, k in enumerate(pos) if k != "community"}
    lmin, lmax = config.get("script.lines_min", 6), config.get("script.lines_max", 12)
    max_chars = config.get("script.line_max_chars", 30)
    if not s.lines:
        return [("ERROR", "본문이 비어 있음")]
    if not 12 <= len(s.title) <= 18:
        out.append(("WARN", f"제목 {len(s.title)}자 (권장 12~18자)"))
    if not lmin <= len(s.lines) <= lmax:
        out.append(("WARN", f"본문 {len(s.lines)}줄 (권장 {lmin}~{lmax}줄)"))
    for i, ln in enumerate(s.lines, 1):
        if i - 1 not in own:
            for w in POLICY_WORDS:
                if w in ln:
                    out.append(("ERROR", f"{i}줄(인용) 정책 위험 단어 '{w}'"))
            continue
        if len(ln) > max_chars:
            out.append(("WARN", f"{i}줄 {len(ln)}자 > {max_chars}자: 둘로 나누기 권장"))
        if ln.count(",") >= 2:
            out.append(("WARN", f"{i}줄 쉼표 2개 이상: 숨 막힘, 나누기 권장"))
        if ln.startswith("(") and ln.endswith(")"):
            out.append(("ERROR", f"{i}줄이 아직 자리표시(괄호) 상태: {ln}"))
        for pat, why in BANNED:
            if re.search(pat, ln):
                out.append(("WARN", f"{i}줄 {why}: {ln}"))
        for w in POLICY_WORDS:
            if w in ln:
                out.append(("ERROR", f"{i}줄 정책 위험 단어 '{w}'"))
    name_core = re.sub(r"\s+", "", deal.get("name", ""))[:6]
    if name_core and name_core in re.sub(r"\s+", "", s.lines[0]):
        out.append(("WARN", "첫 줄에 상품명: 훅은 상황/결과/궁금증으로 시작하기"))
    price_idx = [i for i, ln in enumerate(s.lines) if re.search(r"\d|만|천|원", ln) and "원" in ln]
    if not price_idx:
        out.append(("WARN", "가격 언급이 없음"))
    if s.lines[0].replace(" ", "") == s.title.replace(" ", ""):
        out.append(("WARN", "제목과 첫 줄이 같음: 첫 줄 바꾸기"))
    words = sum(len(ln.replace(" ", "")) for ln in s.lines)
    est = words / 7.0  # 한국어 TTS +15% 속도 기준 대략 초당 7자(공백 제외)
    if not 18 <= est <= 45:
        out.append(("WARN", f"예상 길이 {est:.0f}초 (권장 25~35초)"))
    return out
