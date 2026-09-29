import numpy as np

from hotdeal_shorts import audio, deals, render
from hotdeal_shorts.frames import display_text, split_subtitle
from hotdeal_shorts.script import Script, lint, won_korean


def test_won_korean():
    assert won_korean(39900) == "3만 9천9백원"
    assert won_korean(89000) == "8만 9천원"
    assert won_korean(9900) == "9천9백원"
    assert won_korean(1000000) == "100만원"


def test_display_text_roundtrip():
    for n in (39900, 89000, 12000, 9900, 150000):
        assert display_text(f"지금 {won_korean(n)}임") == f"지금 {n:,}원임"
    assert display_text("리뷰가 2천4백 개인데") == "리뷰가 2,400개인데"
    assert display_text("세차장 가면 만 원인데") == "세차장 가면 만 원인데"


def test_split_subtitle():
    assert split_subtitle("짧은 줄.") == ["짧은 줄"]
    top, bottom = split_subtitle("차 안에 과자 부스러기 보면 한숨부터 나오잖음")
    assert top + " " + bottom == "차 안에 과자 부스러기 보면 한숨부터 나오잖음"
    assert max(len(top), len(bottom)) <= 15
    assert split_subtitle("띄어쓰기없는아주긴문장입니다정말로요") == ["띄어쓰기없는아주긴", "문장입니다정말로요"]


def test_tighten_removes_silence():
    sr = audio.SR
    tone = 0.3 * np.sin(np.linspace(0, 440 * 2 * np.pi, sr // 2)).astype(np.float32)
    x = np.concatenate([audio.silence(0.5), tone, audio.silence(0.6), tone, audio.silence(0.5)])
    y, cuts, removed = audio.tighten(x, db=-35, pad=0.03, max_gap=0.10)
    assert cuts == 1
    assert 1.0 <= len(y) / sr <= 1.25
    assert removed > 1.3


def test_schedule_leads_subtitles():
    frames = [{"path": "a", "start": 0.0}, {"path": "b", "start": 2.0}, {"path": "c", "start": 4.0}]
    sched = render.schedule(frames, total=6.0, lead=0.2)
    assert sched == [("a", 1.8), ("b", 2.0), ("c", 2.2)]
    assert abs(sum(d for _, d in sched) - 6.0) < 1e-6


def test_deal_score_and_normalize():
    d = deals.normalize({"source": "manual", "name": "x", "price": "39,900", "original_price": "89000원",
                         "reviews": "2412", "evergreen": "1"})
    assert d["discount_pct"] == 55.2
    s, why = deals.score(d)
    assert s > 60 and not any(r.startswith("탈락") for r in why)
    low = deals.normalize({"source": "manual", "name": "y", "price": 9900, "original_price": 11000, "reviews": 40})
    _, why = deals.score(low)
    assert sum(r.startswith("탈락") for r in why) == 2


def test_coupang_signature_is_hmac_sha256():
    import hashlib
    import hmac
    path = "/v2/providers/affiliate_open_api/apis/openapi/v1/products/goldbox"
    sig = deals.coupang_signature("GET", path, "subId=x", "secret", "260929T010203Z")
    expected = hmac.new(b"secret", f"260929T010203ZGET{path}subId=x".encode(), hashlib.sha256).hexdigest()
    assert sig == expected
    header = deals.coupang_auth_header("GET", path, "subId=x", "ak", "secret", "260929T010203Z")
    assert header == f"CEA algorithm=HmacSHA256, access-key=ak, signed-date=260929T010203Z, signature={expected}"


def test_lint_rules():
    deal = {"name": "무선 핸디 청소기"}
    bad = Script(title="짧음", hook_type="x", lines=["무선 핸디 청소기 소개함", "구독 좋아요 부탁", "(장면 추가)"])
    msgs = [m for _, m in lint(bad, deal)]
    assert any("첫 줄에 상품명" in m for m in msgs)
    assert any("구독" in m for m in msgs)
    assert any(level == "ERROR" for level, _ in lint(bad, deal))


def test_map_words_to_lines():
    from hotdeal_shorts.voice import map_words_to_lines
    lines = ["차 안에 부스러기 보면", "세차장 가면 만 원인데."]
    words = [{"text": t, "start": s, "end": s + 0.3} for t, s in
             [("차", 0.1), ("안에", 0.4), ("부스러기", 0.8), ("보면", 1.2),
              ("세차장", 1.8), ("가면", 2.2), ("만", 2.5), ("원인데", 2.7)]]
    assert map_words_to_lines(lines, words) == [(0.1, 1.5), (1.8, 3.0)]
    # 글자 수가 크게 어긋나면 None (줄 단위 합성으로 전환)
    assert map_words_to_lines(lines, words[:3]) is None


def test_korean_numbers_for_tts():
    from hotdeal_shorts.korean_num import to_speech
    cases = {
        "지금 39,900원임": "지금 삼만 구천구백원임",
        "무게가 600그램이라": "무게가 육백그램이라",
        "리뷰가 2천4백 개인데": "리뷰가 이천사백 개인데",
        "원래 8만 9천원짜리": "원래 팔만 구천원짜리",
        "세제 3개 사면": "세제 세개 사면",
        "24시간 지속": "스물네시간 지속",
        "20개입": "스무개입",
        "2개월 썼는데": "이개월 썼는데",
        "평점 4.7점": "평점 사 점 칠점",
        "1+1 행사": "원 플러스 원 행사",
        "55% 할인": "오십오퍼센트 할인",
        "10000원": "만원",
        "150,000원": "십오만원",
        "500ml 두 병": "오백밀리리터 두 병",
    }
    for src, want in cases.items():
        assert to_speech(src) == want, (src, to_speech(src))


def test_scene_parsing_and_guardrails():
    from hotdeal_shorts import scenes
    body = """
첫 줄 훅
[community: 더쿠]
title: 제목
comment: 댓글 하나
[kakao: 방]
친구: 뭐 써?
나: 이거 씀
"""
    scs = scenes.parse(body)
    assert [s.kind for s in scs] == ["post", "community", "kakao"]
    assert scenes.narration(scs) == ["첫 줄 훅", "댓글 하나", "뭐 써?", "이거 씀"]
    assert scenes.index(scs)[2] == (2, 0)
    errs = [m for lv, m in scenes.lint(scs) if lv == "ERROR"]
    assert any("원글 주소" in m for m in errs) and any("captured" in m for m in errs)
    ok = scenes.parse("[community: 디시]\nsource: https://x.test/1\ncaptured: 2026-09-29\nbody: 본문")
    assert ok[0].style == "dc" and not scenes.lint(ok)
