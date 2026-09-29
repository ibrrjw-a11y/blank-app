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
