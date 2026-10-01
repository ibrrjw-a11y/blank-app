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
    assert scs[1].meta.get("skit") and not scenes.lint(scs)  # 원글 주소 없으면 표시 붙은 상황극
    skit = scenes.parse("[community: 더쿠]\nmeta: 조회 3만\nbody: 티슈 떨어져서 짜증남\n"
                        "comment: 나 이거 써봤는데 좋음 || 120")
    lint = scenes.lint(skit)
    assert not [m for lv, m in lint if lv == "ERROR"] and any("후기" in m for lv, m in lint if lv == "WARN")
    quote = scenes.parse("[community: 더쿠]\nsource: https://x.test/9\nbody: 본문")
    assert any("captured" in m for lv, m in scenes.lint(quote) if lv == "ERROR")
    ok = scenes.parse("[community: 디시]\nsource: https://x.test/1\ncaptured: 2026-09-29\nbody: 본문 써봤는데 좋음")
    assert ok[0].style == "dc" and not scenes.lint(ok) and not ok[0].meta.get("skit")


def test_community_fields_and_style_names():
    from hotdeal_shorts import scenes
    sc = scenes.parse("""[community: 펨코]
source: https://x.test/1
captured: 2026-09-29
tag: 포텐
tag: 자동차
body: 첫 문단
image: product
body: 둘째 문단
comment: 댓글 || 31
그냥 줄도 댓글""")[0]
    assert sc.style == "fmkorea" and sc.meta["source_name"] == "에펨코리아"
    assert sc.meta["tags"] == ["포텐", "자동차"] and sc.meta["images"] == [(1, "product")]
    assert [(i.role, i.likes) for i in sc.items] == [("body", ""), ("body", ""), ("comment", "31"), ("comment", "")]
    for name, key in [("인스티즈", "instiz"), ("다음카페", "daumcafe"), ("트위터", "twitter"), ("유튜브", "youtube")]:
        assert scenes.parse(f"[community: {name}]\nbody: x")[0].style == key


def test_every_community_style_renders(tmp_path):
    from hotdeal_shorts import scene_frames, scenes
    base = scene_frames.chrome(1080, 1920, "제목")
    for key in scene_frames.COMMUNITY_THEMES:
        sc = scenes.parse(f"[community: {key}]\nsource: https://x.test\ncaptured: 2026-09-29\ntitle: 제목\n"
                          "body: 본문\ncomment: 댓글1\ncomment: 댓글2")[0]
        for upto in range(len(sc.items)):
            img = scene_frames.render_community(base, sc, upto)
            assert img.size == (1080, 1920)


def _png_bytes(color=(90, 140, 200)):
    import io
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (1024, 768), color).save(buf, "PNG")
    return buf.getvalue()


def test_image_line_selection(monkeypatch):
    from hotdeal_shorts import config, images, scenes
    monkeypatch.setitem(config.cfg()["video"], "product_tail_lines", 0)
    scs = scenes.parse("훅 줄\n[img]장면 줄\n지금 39,900원임\n[community: 더쿠]\nbody: 인용\n[post]\n마지막 장면")
    assert images.select_lines(scs, "every") == [(0, "훅 줄"), (1, "장면 줄"), (4, "마지막 장면")]
    assert images.select_lines(scs, "marked") == [(1, "장면 줄")]
    assert images.select_lines(scs, "first") == [(0, "훅 줄"), (4, "마지막 장면")]
    assert scenes.narration(scs)[1] == "장면 줄"  # [img] 표시는 읽지 않음
    monkeypatch.setitem(config.cfg()["video"], "product_tail_lines", 2)
    assert images.select_lines(scs, "every") == [(0, "훅 줄"), (1, "장면 줄")]  # 마지막 2줄은 상품 사진 자리


def test_image_providers_parse_responses(monkeypatch):
    import base64
    from hotdeal_shorts import images

    class Resp:
        def __init__(self, body): self.status_code, self._b, self.text = 200, body, ""
        def json(self): return self._b

    png = _png_bytes()
    b64 = base64.b64encode(png).decode()
    calls = []

    def fake_post(url, headers=None, json=None, timeout=None):
        calls.append((url, headers, json))
        if "googleapis" in url:
            return Resp({"candidates": [{"content": {"parts": [{"text": "ok"}, {"inlineData": {"data": b64}}]}}]})
        return Resp({"data": [{"b64_json": b64}]})

    monkeypatch.setattr(images.requests, "post", fake_post)
    monkeypatch.setenv("GEMINI_API_KEY", "g")
    monkeypatch.setenv("OPENAI_API_KEY", "o")
    assert images._gemini("p") == png and images._openai("p") == png
    assert calls[0][1]["x-goog-api-key"] == "g"
    assert calls[0][2]["generationConfig"]["responseModalities"] == ["IMAGE"]
    assert calls[1][1]["Authorization"] == "Bearer o"


def test_generate_writes_files_and_skips_existing(monkeypatch, tmp_path):
    from hotdeal_shorts import config as _cfg
    monkeypatch.setitem(_cfg.cfg()["video"], "product_tail_lines", 0)
    from hotdeal_shorts import images, scenes
    from hotdeal_shorts.job import Job
    (tmp_path / "deal.json").write_text('{"name": "청소기", "category": "가전"}', encoding="utf-8")
    job = Job(tmp_path)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setitem(images.PROVIDERS, "gemini", lambda prompt: _png_bytes())
    scs = scenes.parse("훅 줄\n장면 줄\n지금 39,900원임")
    r = images.generate(job, scs, "gemini")
    assert r["made"] == 2 and r["prompt_by"] == "template"
    assert (tmp_path / "images" / "line_000.png").exists() and not (tmp_path / "images" / "line_002.png").exists()
    assert images.generate(job, scs, "gemini")["made"] == 0  # 이미 있으면 건너뜀
    assert images.generate(job, scs, "gemini", force=True)["made"] == 2


def test_toss_sharelink_client(monkeypatch, tmp_path):
    from datetime import datetime, timedelta, timezone
    from hotdeal_shorts import deals
    monkeypatch.setenv("HD_HOME", str(tmp_path))
    for k, v in {"TOSS_ACCESS_KEY": "ak", "TOSS_SECRET_KEY": "sk", "TOSS_PUBLISHER_ID": "pub"}.items():
        monkeypatch.setenv(k, v)

    class Resp:
        def __init__(self, status, body, headers=None):
            self.status_code, self._b, self.text, self.headers = status, body, str(body), headers or {}
        def json(self): return self._b

    calls = {"token": 0, "api": [], "links": 0, "rate_limited": False}
    soon = (datetime.now(timezone.utc) + timedelta(minutes=3)).isoformat()
    later = (datetime.now(timezone.utc) + timedelta(hours=5)).isoformat()

    def ok(success): return Resp(200, {"resultType": "SUCCESS", "success": success})

    def fake_post(url, data=None, timeout=None):
        calls["token"] += 1
        assert data["grant_type"] == "client_credentials" and data["scope"] == "sharelink:read sharelink:write"
        return Resp(200, {"access_token": f"tok{calls['token']}", "expires_in": 31_000_000})

    def fake_request(method, url, params=None, json=None, timeout=None, headers=None):
        calls["api"].append((method, url, params, json, headers["Authorization"]))
        if url.endswith("best-selling"):
            return ok({"items": [
                {"tacaItemId": 11, "displayName": "세제", "displayPrice": 18900, "originalPrice": 32000,
                 "discountRate": 41, "reviewCount": 1520, "reviewScore": 4.8, "productUrl": "https://toss.im/p/11",
                 "thumbnailUrl": "https://img/11.jpg"},
                {"tacaItemId": 12, "displayName": "품절템", "isSoldOut": True}], "hasNext": False})
        if url.endswith("today-deals"):
            if not calls["rate_limited"]:  # 429 는 Retry-After 만큼 쉬고 다시
                calls["rate_limited"] = True
                return Resp(429, {}, {"Retry-After": "1"})
            if not (params or {}).get("cursor"):
                return ok({"items": [{"tacaItemId": 21, "displayName": "곧끝남", "endAt": soon},
                                     {"tacaItemId": 22, "displayName": "특가A", "endAt": later}],
                           "hasNext": True, "nextCursor": "c2"})
            return ok({"items": [{"tacaItemId": 23, "displayName": "특가B"}], "hasNext": False})
        if url.endswith("best-categories/7"):
            return Resp(200, {"resultType": "FAIL", "error": {"errorCode": "SHARELINK_OPENAPI_QUOTA_EXCEEDED",
                                                             "reason": "한도 초과"}})
        if url.endswith("links"):
            if json["tacaItemId"] == 99:  # errorCode 없는 FAIL = 링크 막힌 상품
                return Resp(200, {"resultType": "FAIL", "error": {"reason": "링크 생성 불가 상품"}})
            calls["links"] += 1
            return ok({"shortUrl": f"https://toss.im/_s/{json['tacaItemId']}{json.get('subTagId', '')}"})
        raise AssertionError(url)

    monkeypatch.setattr(deals.requests, "post", fake_post)
    monkeypatch.setattr(deals.requests, "request", fake_request)
    slept = []
    t = deals.Toss()
    t.sleep = slept.append

    best = t.best(10)
    assert [d["name"] for d in best] == ["세제"] and best[0]["source"] == "toss"  # 품절 제외
    assert best[0]["discount_pct"] == 41 and best[0]["reviews"] == 1520 and best[0]["evergreen"] == 1
    assert best[0]["price"] == 18900 and best[0]["image_url"] == "https://img/11.jpg"  # 썸네일 → 상품 사진
    assert calls["token"] == 1 and calls["api"][-1][4] == "Bearer tok1"

    today = t.today_deals(pages=3)  # 커서 페이지 넘김 + 종료 10분 이내 제외
    assert [d["name"] for d in today] == ["특가A", "특가B"]
    assert slept == [1.0] and calls["api"][-1][2] == {"size": 30, "cursor": "c2"}

    assert t.link("11", "yt-salim") == "https://toss.im/_s/11yt-salim"
    assert calls["api"][-1][3] == {"tacaItemId": 11, "publisherId": "pub", "subTagId": "yt-salim"}
    assert t.link("11", "yt-salim") == "https://toss.im/_s/11yt-salim" and calls["links"] == 1  # 캐시
    assert t.link("11") == "https://toss.im/_s/11" and calls["links"] == 2  # subTag 다르면 새 링크
    assert t._usage()["links_issued"] == 2
    try:
        t.link("99")
        raise AssertionError("막힌 상품은 예외여야 함")
    except deals.TossLinkBlocked as e:
        assert "링크 생성 불가" in str(e)

    assert deals.Toss().best(1) and calls["token"] == 1  # 토큰은 파일에 저장해 재사용
    try:
        t.category_best("7")
        raise AssertionError("한도 초과는 예외여야 함")
    except deals.TossQuotaExceeded:
        pass
    assert t._usage()["items_quota_hit"] == 1
    n = len(calls["api"])
    try:
        t.best(5)  # 한도 걸린 날은 호출도 안 함
        raise AssertionError
    except deals.TossQuotaExceeded:
        assert len(calls["api"]) == n


def test_affiliate_source_picks_disclosure():
    from hotdeal_shorts.deals import affiliate_source
    assert affiliate_source({"source": "toss"}) == "toss"
    assert affiliate_source({"source": "manual", "affiliate_url": "https://link.coupang.com/a/x"}) == "coupang"
    assert affiliate_source({"source": "manual", "url": "https://toss.im/_s/abc"}) == "toss"
    assert affiliate_source({"source": "manual", "url": "https://smartstore.naver.com/x"}) == "default"


def test_capcut_export_structure(monkeypatch, tmp_path):
    import json
    import numpy as np
    import pytest
    pytest.importorskip("pycapcut")
    from PIL import Image
    from hotdeal_shorts import audio, capcut
    from hotdeal_shorts.job import Job
    monkeypatch.setenv("HD_HOME", str(tmp_path))
    job = Job(tmp_path / "job")
    (job.path / "frames").mkdir(parents=True)
    (job.path / "deal.json").write_text('{"name": "무선 청소기"}', encoding="utf-8")
    audio.write_wav(job.p("voice.wav"), np.zeros(audio.SR * 4, dtype=np.float32))
    frames = []
    for i, (start, clean) in enumerate([(0.0, True), (2.0, False)]):  # 게시글형 / 커뮤니티형
        path = job.p("frames", f"body_{i:03d}.png")
        Image.new("RGB", (1080, 1920)).save(path)
        f = {"path": str(path), "start": start, "end": start + 1.8, "sub": [f"자막{i}"]}
        if clean:
            Image.new("RGB", (1080, 1920)).save(job.p("frames", f"body_{i:03d}_clean.png"))
            f.update(clean=str(job.p("frames", f"body_{i:03d}_clean.png")), sub_y=620)
        frames.append(f)
    job.p("frames", "frames.json").write_text(json.dumps(frames), encoding="utf-8")
    out = capcut.export(job, tmp_path / "drafts")
    d = json.loads((out / "draft_content.json").read_text(encoding="utf-8"))
    tracks = {t["name"]: t["segments"] for t in d["tracks"]}
    assert len(tracks["화면"]) == 2 and len(tracks["자막"]) == 1 and len(tracks["목소리"]) == 1
    assert tracks["효과음"] == []
    assert abs(d["duration"] / 1e6 - 4.0) < 0.01
    assert all((out / "materials").joinpath(p.split("/")[-1]).exists() for p in
               [m["path"].replace("\\", "/") for m in d["materials"]["videos"]])


def _mp3_bytes(sec=3.0):
    import subprocess
    return subprocess.run(["ffmpeg", "-loglevel", "error", "-f", "lavfi", "-i", f"sine=frequency=300:duration={sec}",
                           "-f", "mp3", "-"], capture_output=True, check=True).stdout


def test_cloud_tts_request_shapes(monkeypatch, tmp_path):
    import base64
    from hotdeal_shorts import config, tts_providers as tp

    class Resp:
        def __init__(self, body=None, content=b""): self.status_code, self._b, self.content, self.text = 200, body, content, ""
        def json(self): return self._b

    mp3 = _mp3_bytes(1)
    calls = []

    def fake_post(url, json=None, params=None, timeout=None, headers=None):
        calls.append((url, json, params, headers))
        if "with-timestamps" in url and "typecast" in url:
            return Resp({"audio": base64.b64encode(mp3).decode(), "audio_format": "mp3", "audio_duration": 1,
                         "words": [{"text": "안녕", "start": 0.1, "end": 0.4}]})
        if "with-timestamps" in url:
            return Resp({"audio_base64": base64.b64encode(mp3).decode(), "alignment": {
                "characters": list("안녕 하세요"), "character_start_times_seconds": [0, .1, .2, .3, .4, .5],
                "character_end_times_seconds": [.1, .2, .3, .4, .5, .6]}})
        if "googleapis" in url:
            return Resp({"audioContent": base64.b64encode(mp3).decode()})
        return Resp(content=mp3)

    monkeypatch.setattr(tp.requests, "post", fake_post)
    for k in ("TYPECAST_API_KEY", "ELEVENLABS_API_KEY", "OPENAI_API_KEY", "GOOGLE_TTS_API_KEY"):
        monkeypatch.setenv(k, "k")
    monkeypatch.setitem(config.cfg(), "voice", {"typecast": {"voice_id": "tc_1"}, "elevenlabs": {"voice_id": "el_1"}})

    assert tp.typecast_whole("안녕", tmp_path / "a.mp3") == [{"text": "안녕", "start": 0.1, "end": 0.4}]
    url, body, params, headers = calls[-1]
    assert url.endswith("/v1/text-to-speech/with-timestamps") and params == {"granularity": "word"}
    assert headers["X-API-KEY"] == "k" and body["voice_id"] == "tc_1" and body["language"] == "kor"
    assert body["output"]["audio_format"] == "mp3"

    assert tp.eleven_whole("안녕 하세요", tmp_path / "b.mp3") == [
        {"text": "안녕", "start": 0, "end": .2}, {"text": "하세요", "start": .3, "end": .6}]
    assert calls[-1][0].endswith("/text-to-speech/el_1/with-timestamps") and calls[-1][3]["xi-api-key"] == "k"

    tp.openai_line("안녕", tmp_path / "c.mp3")
    assert calls[-1][1]["model"] == "gpt-4o-mini-tts" and calls[-1][3]["Authorization"] == "Bearer k"
    tp.google_line("안녕", tmp_path / "d.mp3")
    assert calls[-1][1]["voice"]["languageCode"] == "ko-KR" and (tmp_path / "d.mp3").read_bytes() == mp3
    monkeypatch.setitem(config.cfg(), "voice", {"typecast": {}})
    try:
        tp.typecast_line("x", tmp_path / "e.mp3")
        raise AssertionError("voice_id 없으면 오류여야 함")
    except tp.CloudTTSError as e:
        assert "voice_id" in str(e)


def test_whole_script_provider_gives_line_timings(monkeypatch, tmp_path):
    import json
    from hotdeal_shorts import config, voice
    from hotdeal_shorts.job import Job
    job = Job(tmp_path)
    (tmp_path / "voice_parts").mkdir()
    lines = ["차 안에 부스러기 보면", "세차장 가면 만 원인데"]

    def fake_whole(text, out):
        out.write_bytes(_mp3_bytes(3.5))
        return [{"text": t, "start": s, "end": s + 0.3} for t, s in
                [("차", 0.2), ("안에", 0.5), ("부스러기", 0.9), ("보면", 1.3),
                 ("세차장", 1.9), ("가면", 2.3), ("만", 2.6), ("원인데", 2.8)]]

    monkeypatch.setitem(voice.WHOLE, "typecast", fake_whole)
    monkeypatch.setitem(config.cfg(), "voice", {"whole_script": True, "typecast": {"voice_id": "tc_1"}})
    stats = voice.synthesize(job, lines, "typecast")
    assert stats["provider"] == "typecast(whole)"
    al = json.loads((tmp_path / "align.json").read_text(encoding="utf-8"))["lines"]
    assert [round(a["start"], 2) for a in al] == [0.05, 1.75] and round(al[1]["end"], 2) == 2.95


def test_fetch_url_meta_reads_og_and_jsonld(monkeypatch):
    from hotdeal_shorts import deals

    class Resp:
        status_code = 200
        text = ('<meta property="og:title" content="무선 청소기 &amp; 거치대">'
                '<meta content="https://img/x.jpg" property="og:image">'
                '<script type="application/ld+json">{"@graph":[{"@type":"Product","name":"무선 핸디 청소기",'
                '"offers":{"@type":"Offer","price":"39900"}}]}</script>')

    monkeypatch.setattr(deals.requests, "get", lambda *a, **k: Resp())
    m = deals.fetch_url_meta("https://shop.test/p/1")
    assert m["name"] == "무선 핸디 청소기" and m["price"] == 39900 and m["image_url"] == "https://img/x.jpg"
    assert "error" not in m

    class Blocked:
        status_code = 403
        text = ""

    monkeypatch.setattr(deals.requests, "get", lambda *a, **k: Blocked())
    assert "직접 입력" in deals.fetch_url_meta("https://shop.test/p/2")["error"]


def test_ui_pages_render(tmp_path, monkeypatch):
    import shutil
    from pathlib import Path
    import pytest
    pytest.importorskip("streamlit")
    from streamlit.testing.v1 import AppTest
    root = Path(__file__).resolve().parent.parent
    for name in ("config.yaml", "app.py"):
        shutil.copy(root / name, tmp_path / name)
    shutil.copytree(root / "prompts", tmp_path / "prompts")
    monkeypatch.setenv("HD_HOME", str(tmp_path))
    at = AppTest.from_file(str(tmp_path / "app.py"), default_timeout=120).run()
    assert not at.exception and at.header[0].value == "① 딜 고르기"
    at.sidebar.radio[0].set_value("② 영상 만들기").run()
    assert not at.exception and "먼저" in at.info[0].value
    broken = tmp_path / "jobs" / "20260930_broken"
    broken.mkdir(parents=True)
    (broken / "deal.json").write_text('{"name": "세제", "price": 1000, "source": "manual"}', encoding="utf-8")
    at.run()
    assert not at.exception and "대본이 없어요" in at.error[0].value
    next(b for b in at.button if b.label == "대본 다시 만들기").click().run()
    assert not at.exception and (broken / "script.md").exists()


def test_env_file_any_encoding(monkeypatch, tmp_path):
    from hotdeal_shorts import config
    body = "# 토스 키\nTOSS_ACCESS_KEY = ak1\nexport TOSS_SECRET_KEY=\"sk1\"\n"
    for i, enc in enumerate(["utf-8-sig", "utf-16", "cp949"]):
        key = f"HD_TEST_KEY_{i}"
        monkeypatch.delenv(key, raising=False)
        f = tmp_path / f"{i}.env"
        f.write_bytes((body + f"{key}=v{i}\n").encode(enc))
        config.load_env(f)
        assert config.os.environ[key] == f"v{i}"


def test_new_job_toss_link_per_channel_and_cleanup(monkeypatch, tmp_path):
    from hotdeal_shorts import db, deals, pipeline, script
    monkeypatch.setenv("HD_HOME", str(tmp_path))
    issued = []

    class FakeToss:
        def link(self, item, subtag=None):
            issued.append((item, subtag))
            url = f"https://toss.shopping/_m/{item}-{subtag}"
            with db.connect() as conn:
                conn.execute("CREATE TABLE IF NOT EXISTS toss_links (taca_item_id TEXT, subtag TEXT, short_url TEXT, "
                             "origin_url TEXT, PRIMARY KEY (taca_item_id, subtag))")
                conn.execute("INSERT OR REPLACE INTO toss_links VALUES (?,?,?,?)", (item, subtag or "", url, None))
            return url

    monkeypatch.setattr(deals, "Toss", FakeToss)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "x")
    monkeypatch.setattr(script, "generate_claude", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("잔액 부족")))
    with db.connect() as conn:
        did = db.upsert_deal(conn, deals.normalize({"source": "toss", "source_id": "77", "name": "장조림",
                                                    "price": 8900, "original_price": 20000}))
    logs = []
    j = pipeline.new_job(did, log=logs.append, channel="salim")
    assert j.p("script.md").exists() and j.state["channel"] == "salim"
    assert j.deal["affiliate_url"].endswith("77-yt-salim") and issued == [("77", "yt-salim")]
    assert any("잔액 부족" in m for m in logs)  # Claude 가 실패해도 템플릿 대본으로 계속
    pipeline.set_channel(j, "tech", log=logs.append)  # 채널 바꾸면 링크도 그 채널 것으로
    assert j.deal["affiliate_url"].endswith("77-yt-gearlog")

    monkeypatch.setattr(script, "to_markdown", lambda s: (_ for _ in ()).throw(OSError("디스크")))
    before = {p.name for p in (tmp_path / "jobs").iterdir()}
    try:
        pipeline.new_job(did, log=logs.append, channel="beauty")
        raise AssertionError
    except OSError:
        pass
    assert {p.name for p in (tmp_path / "jobs").iterdir()} == before  # 반쯤 만든 폴더 안 남김


def test_line_images_without_product_photo_use_ai(tmp_path, monkeypatch):
    import json
    from PIL import Image
    from hotdeal_shorts import frames, job as jobmod
    (tmp_path / "images").mkdir()
    (tmp_path / "deal.json").write_text(json.dumps({"name": "세제", "source": "toss"}), encoding="utf-8")
    Image.new("RGB", (40, 30), (255, 0, 0)).save(tmp_path / "images" / "line_001.png")
    Image.new("RGB", (40, 30), (0, 0, 255)).save(tmp_path / "images" / "line_003.png")
    j = jobmod.Job(tmp_path)
    ims = frames.line_images(j, ["훅", "상황", "리뷰", "장면", "지금 5,740원 링크는 고정 댓글"], (40, 30))
    px = [im.convert("RGB").getpixel((20, 15)) for im in ims]
    assert px == [(255, 0, 0)] * 3 + [(0, 0, 255)] * 2  # 회색 빈 화면 없음


def test_apply_photos_places_user_photos_per_line(tmp_path, monkeypatch):
    import json
    from PIL import Image
    from hotdeal_shorts import images, job as jobmod, scenes
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    (tmp_path / "deal.json").write_text(json.dumps({"name": "세제", "source": "toss"}), encoding="utf-8")
    j = jobmod.Job(tmp_path)
    scs = scenes.parse("훅 한 줄\n빨래가 쌓인 상황\n향이 오래 감\n지금 5,740원\n링크는 고정 댓글")
    photos = []
    for k, c in enumerate([(255, 0, 0), (0, 255, 0), (0, 0, 255)], 1):
        p = tmp_path / f"p{k}.png"
        Image.new("RGB", (40, 30), c).save(p)
        photos.append(p)
    r = images.apply_photos(j, scs, photos)  # 키 없음 → 가격 줄 빼고 순서대로 고르게
    assert r["by"] == "order" and r["placed"] == {0: 1, 1: 2, 2: 3}

    # Claude 가 고른 배치 (사진 내용 기준) + 상품 컷 지정
    monkeypatch.setattr(images, "place_photos",
                        lambda lines, ph, deal: (images.Placement(product_image=3, lines=[2, 1, 1, 3, 0]), "claude"))
    r = images.apply_photos(j, scs, photos)
    assert r["placed"] == {0: 2, 1: 1, 2: 1, 3: 3} and r["product_set"] and r["unused"] == []
    assert (tmp_path / "product.jpg").exists()
    px = Image.open(tmp_path / "images" / "line_000.jpg").getpixel((20, 15))
    assert px[1] > 200 and px[0] < 50  # 2번(초록) 사진


def test_image_rate_limit_waits_and_continues(tmp_path, monkeypatch):
    from hotdeal_shorts import config as _cfg
    monkeypatch.setitem(_cfg.cfg()["video"], "product_tail_lines", 0)
    import json
    from hotdeal_shorts import images, job as jobmod, scenes
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    (tmp_path / "deal.json").write_text(json.dumps({"name": "티슈"}), encoding="utf-8")
    j = jobmod.Job(tmp_path)
    scs = scenes.parse("코 풀려는데 티슈 없음\n감기 걸린 날\n휴지 대신 두루마리\n마지막 줄")
    calls, slept = {"n": 0}, []

    def flaky(prompt):
        calls["n"] += 1
        if calls["n"] in (2, 3):  # 두 번째 장에서 분당 한도 두 번
            raise images.ImageError("Gemini 429", retry_after=31)
        return b"\x89PNG fake"

    monkeypatch.setitem(images.PROVIDERS, "gemini", flaky)
    monkeypatch.setattr(images, "_sleep", slept.append)
    r = images.generate(j, scs, "gemini")
    assert r["made"] == 4 and not r["failed"] and slept == [31, 31]  # 포기하지 않고 기다렸다 계속

    def no_quota(prompt):
        raise images.ImageError("limit 0", fatal=True)
    monkeypatch.setitem(images.PROVIDERS, "gemini", no_quota)
    try:
        images.generate(j, scs, "gemini", force=True)
        raise AssertionError
    except images.ImageError as e:
        assert e.fatal


def test_stock_photos_per_line_without_repeats(tmp_path, monkeypatch):
    from hotdeal_shorts import config as _cfg
    monkeypatch.setitem(_cfg.cfg()["video"], "product_tail_lines", 0)
    import json
    from hotdeal_shorts import images, job as jobmod, publish, scenes, script
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setenv("PEXELS_API_KEY", "k")
    (tmp_path / "deal.json").write_text(json.dumps({"name": "티슈", "category": "생활용품"}), encoding="utf-8")
    j = jobmod.Job(tmp_path)
    scs = scenes.parse("코 풀려는데 티슈 없음\n감기 걸린 날\n아무것도 안 나오는 검색어\n지금 5,740원")

    class R:
        def __init__(self, status, body=None, content=b"", ctype="application/json"):
            self.status_code, self._b, self.content, self.text = status, body, content, str(body)
            self.headers = {"content-type": ctype}
        def json(self): return self._b

    def fake_get(url, headers=None, params=None, timeout=None):
        if "api.pexels.com" in url:
            assert headers["Authorization"] == "k" and params["orientation"] == "landscape"
            if "아무것도" in params["query"]:
                return R(200, {"photos": []})
            return R(200, {"photos": [{"id": 1, "src": {"large": "https://img/1"}, "photographer": "A"},
                                      {"id": 2, "src": {"large": "https://img/2"}, "photographer": "B"}]})
        return R(200, content=url.encode(), ctype="image/jpeg")

    monkeypatch.setattr(images.requests, "get", fake_get)
    monkeypatch.setattr(images, "_sleep", lambda s: None)
    r = images.generate(j, scs, "pexels")
    assert r["made"] == 3 and r["failed"] == []  # 결과 없는 줄은 분야(생활용품)로 다시 찾음, 가격 줄은 제외
    got = [(tmp_path / "images" / f"line_{i:03d}.png").read_bytes() for i in range(3)]
    assert got[0] != got[1]  # 같은 사진 반복 안 함
    log = json.loads((tmp_path / "images" / "prompts.json").read_text(encoding="utf-8"))
    assert log["000"]["credit"] == "Photo by A on Pexels"
    s = script.Script(title="티슈 한 통 천 원도 안 하는 딜", lines=["코 풀려는데 티슈 없음"], hook_type="상황공감")
    (tmp_path / "script.md").write_text(script.to_markdown(s), encoding="utf-8")
    publish.build(j, s)
    assert "합성된 콘텐츠" not in (tmp_path / "review.md").read_text(encoding="utf-8")  # 실사 사진은 AI 표시 대상 아님


def test_ending_and_price_lines_always_show_product(tmp_path, monkeypatch):
    import json
    from PIL import Image
    from hotdeal_shorts import deals, frames, job as jobmod
    (tmp_path / "images").mkdir()
    (tmp_path / "deal.json").write_text(json.dumps({"name": "세제", "source": "toss",
                                                    "url": "https://toss.im/p/1"}), encoding="utf-8")
    for i in range(6):
        Image.new("RGB", (40, 30), (0, 0, 255)).save(tmp_path / "images" / f"line_{i:03d}.png")
    # 상품 사진은 링크 페이지 대표 사진에서
    monkeypatch.setattr(deals, "fetch_url_meta", lambda url: {"image_url": "https://img/p.jpg"})

    class R:
        status_code = 200
        content = b""
        def raise_for_status(self): pass
    import io
    buf = io.BytesIO()
    Image.new("RGB", (40, 30), (255, 0, 0)).save(buf, "PNG")
    R.content = buf.getvalue()
    monkeypatch.setattr(frames.requests, "get", lambda *a, **k: R())
    j = jobmod.Job(tmp_path)
    texts = ["훅", "지금 5,740원", "상황", "장면", "끝 직전", "링크는 고정 댓글"]
    ims = frames.line_images(j, texts, (400, 300), bg_color=(255, 255, 255, 255))
    red = [im.convert("RGB").getpixel((200, 150)) == (255, 0, 0) for im in ims]
    assert red == [False, True, False, False, True, True]  # 가격 줄 + 마지막 2줄 = 상품 사진
    assert (tmp_path / "product.jpg").exists()
