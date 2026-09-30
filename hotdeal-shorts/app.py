"""핫딜 쇼츠 작업 화면 (내 PC 전용). 실행: hd ui   또는   streamlit run app.py"""
from __future__ import annotations

import hashlib
import json
import os
from datetime import date
from pathlib import Path

import streamlit as st
from PIL import Image

os.environ.setdefault("HD_HOME", str(Path(__file__).resolve().parent))

from hotdeal_shorts import (config, db, deals, images, job as jobmod, pipeline, profiles, scene_frames,  # noqa: E402
                            scenes, script, themes)
from hotdeal_shorts.frames import preview  # noqa: E402

config.load_env(config.home() / ".env")  # 키를 찾기 전에 .env 먼저

st.set_page_config(page_title="핫딜 쇼츠", page_icon="🔥", layout="wide")

FREE_VOICES = {"edge": "MS 음성 (무료·인터넷)", "supertonic": "슈퍼톤 AI 음성 (무료·오프라인)",
               "sherpa": "오프라인 테스트용", "espeak": "기계음 테스트용"}
PAID_VOICES = {"typecast": "TYPECAST_API_KEY", "elevenlabs": "ELEVENLABS_API_KEY",
               "openai": "OPENAI_API_KEY", "google": "GOOGLE_TTS_API_KEY"}
STYLE_NAMES = ["더쿠", "디시", "네이버카페", "에펨코리아", "인스티즈", "다음카페", "트위터", "유튜브"]


def has(*keys: str) -> bool:
    config.load_env(config.home() / ".env")  # 화면을 켜 둔 채 .env 를 저장해도 바로 반영
    return all(os.environ.get(k) for k in keys)


def scene_template(kind: str) -> str:
    today = date.today().isoformat()
    if kind == "게시글 (내 채널이 말하기)":
        return "[post]\n여기에 한 줄씩 쓰기\n"
    if kind == "카톡 상황극":
        return "[kakao: 대화방 이름]\n친구: 상대 말\n나: 내 말\n"
    style = kind.replace("커뮤니티 · ", "")
    return (f"[community: {style}]\nsource: https://원글주소\ncaptured: {today}\ntitle: 원글 제목\n"
            "body: 원글 본문 그대로\ncomment: 원글 댓글 그대로\n")


SCENE_KINDS = ["게시글 (내 채널이 말하기)", "카톡 상황극"] + [f"커뮤니티 · {s}" for s in STYLE_NAMES]


# ------------------------------------------------------------------ 미리보기 이미지 (한 번 만들어 재사용)

@st.cache_data(show_spinner=False)
def style_preview(kind: str, channel: str | None = None) -> Image.Image:
    with profiles.applied(channel):
        return _style_preview(kind)


def _style_preview(kind: str) -> Image.Image:
    base = scene_frames.chrome(1080, 1920, "제목이 들어가는 자리")
    if kind == "카톡 상황극":
        sc = scenes.parse("[kakao: 대화방]\n친구: 상대가 한 말\n나: 내가 한 말\n친구: 또 다른 말")[0]
        img = scene_frames.render_kakao(base, sc, 2)
    else:
        sc = scenes.parse(scene_template(kind).replace("원글주소", "x") +
                          "comment: 두 번째 댓글\ntag: 말머리\nmeta: 조회 1.2만")[0]
        img = scene_frames.render_community(base, sc, len(sc.items) - 1)
    return img.crop((0, 300, 1080, 1500)).resize((270, 300))


def theme_preview(j: jobmod.Job, name: str | None, channel: str | None = None) -> Image.Image:
    s, _ = script.read(j.p("script.md"))
    with profiles.applied(channel or j.state.get("channel")), themes.applied(name):
        img = preview(j, s)
    return img.crop((0, 0, 1080, 1500)).resize((216, 300))


# ------------------------------------------------------------------ ① 딜 고르기

def page_deals() -> None:
    st.header("① 딜 고르기")
    c1, c2, c3 = st.columns(3)
    coupang_ok = has("COUPANG_ACCESS_KEY", "COUPANG_SECRET_KEY")
    toss_ok = has("TOSS_ACCESS_KEY", "TOSS_SECRET_KEY", "TOSS_PUBLISHER_ID")
    no_toss = None if toss_ok else "토스 쉐어링크 API 키가 .env 에 없어요"
    if c1.button("쿠팡 골드박스 가져오기", disabled=not coupang_ok,
                 help=None if coupang_ok else "쿠팡파트너스 API 키가 .env 에 없어요"):
        fetch(lambda: deals.Coupang().goldbox())
    if c2.button("토스 베스트 가져오기", disabled=not toss_ok, help=no_toss):
        fetch(lambda: deals.Toss().best(30))
    if c3.button("토스 하루특가 가져오기", disabled=not toss_ok, help=no_toss):
        fetch(lambda: deals.Toss().today_deals(30))
    toss_missing = [k for k in ("TOSS_ACCESS_KEY", "TOSS_SECRET_KEY", "TOSS_PUBLISHER_ID") if not os.environ.get(k)]
    if 0 < len(toss_missing) < 3:
        st.warning(f".env 에 토스 키가 덜 들어갔어요: {', '.join(toss_missing)}")

    with st.expander("➕ 딜 직접 추가 — 상품 URL 붙여넣기", expanded=True):
        url = st.text_input("상품 페이지 URL", placeholder="https://www.coupang.com/vp/products/...")
        if st.button("URL에서 정보 불러오기", disabled=not url):
            meta = deals.fetch_url_meta(url)
            st.session_state["deal_form"] = meta
            if meta.get("error"):
                st.warning(meta["error"])
            else:
                st.success("불러왔어요. 아래에서 확인·수정 후 저장하세요.")
        f = st.session_state.get("deal_form", {})
        with st.form("add_deal", clear_on_submit=False):
            a, b = st.columns([2, 1])
            name = a.text_input("상품명 *", value=f.get("name") or "")
            category = b.text_input("카테고리", value=f.get("category") or "")
            a, b, c = st.columns(3)
            price = a.number_input("할인가(원) *", min_value=0, step=100, value=int(f.get("price") or 0))
            original = b.number_input("정가(원)", min_value=0, step=100, value=int(f.get("original_price") or 0))
            reviews = c.number_input("리뷰 수", min_value=0, step=10, value=int(f.get("reviews") or 0))
            aff = st.text_input("수익 링크 (쿠팡파트너스·토스 쉐어링크 등)", value=f.get("affiliate_url") or "",
                                help="비워두면 상품 URL 이 들어가요. 수익이 나려면 제휴 링크를 넣으세요.")
            a, b = st.columns([2, 1])
            image_url = a.text_input("상품 이미지 URL", value=f.get("image_url") or "")
            upload = b.file_uploader("또는 이미지 파일", type=["jpg", "jpeg", "png", "webp"])
            a, b = st.columns([2, 1])
            ends_at = a.text_input("딜 종료 (선택)", placeholder="10월 3일 23시")
            evergreen = b.checkbox("상시형 상품", help="딜이 끝나도 계속 팔리는 상품이면 체크")
            note = st.text_input("메모·특징 (대본에 참고)")
            if st.form_submit_button("딜 저장", type="primary"):
                if not name or not price:
                    st.error("상품명과 할인가는 꼭 넣어 주세요")
                else:
                    save_manual_deal(url or name, name, price, original, reviews, category, aff, image_url,
                                     upload, ends_at, evergreen, note)

    with db.connect() as conn:
        rows = [dict(r) for r in conn.execute("SELECT * FROM deals ORDER BY score DESC, id DESC").fetchall()]
    if not rows:
        st.info("아직 딜이 없어요. 위에서 URL 을 붙여넣어 추가하세요.")
        return
    show_all = st.toggle("탈락한 딜도 보기")
    table = []
    for d in rows:
        _, why = deals.score(d)
        dropped = any(r.startswith("탈락") for r in why)
        if dropped and not show_all:
            continue
        table.append({"번호": d["id"], "점수": d["score"], "상품명": d["name"], "할인가": d["price"],
                      "정가": d["original_price"], "할인율": d["discount_pct"], "리뷰": d["reviews"],
                      "출처": d["source"], "상태": d["status"], "메모": "; ".join(why)})
    st.dataframe(table, hide_index=True, width="stretch")
    options = {f"#{t['번호']} {t['상품명']} ({(t['할인가'] or 0):,}원)": t["번호"] for t in table}
    if not options:
        return
    a, ch, b, c = st.columns([3, 1.3, 1, 1])
    pick = a.selectbox("영상으로 만들 딜", list(options))
    chans = profiles.all_profiles()
    channel = ch.selectbox("어느 채널용?", list(chans) or [None], format_func=lambda k: chans.get(k, {}).get("name", "기본"),
                           index=list(chans).index(profiles.default_id()) if chans else 0)
    hook = b.selectbox("첫 문장(훅) 유형", ["자동"] + script.HOOK_TYPES)
    c.write("")
    if c.button("이 딜로 영상 만들기 →", type="primary"):
        logs = []
        try:
            j = pipeline.new_job(options[pick], None if hook == "자동" else hook, log=logs.append, channel=channel)
        except Exception as e:  # noqa: BLE001 - 무엇이 실패했는지 화면에 그대로
            st.error(f"작업을 못 만들었어요: {e}")
            for m in logs:
                st.caption(m)
            return
        st.session_state["new_job_log"] = logs
        st.session_state["job"] = j.id
        st.session_state["goto"] = "② 영상 만들기"  # 사이드바 위젯 값은 다음 실행 때 바꾼다
        st.rerun()


def fetch(fn) -> None:
    try:
        items = fn()
    except Exception as e:  # noqa: BLE001 - API 오류를 화면에 그대로
        st.error(str(e))
        return
    with db.connect() as conn:
        for d in items:
            d["score"], _ = deals.score(d)
            db.upsert_deal(conn, d)
    if items:
        st.success(f"{len(items)}건 가져왔어요")
    else:
        st.info("0건이에요 — 품절·곧 끝나는 특가·24시간 안에 이미 가져온 상품은 빼요.")


def save_manual_deal(key, name, price, original, reviews, category, aff, image_url, upload, ends_at, evergreen,
                     note) -> None:
    d = deals.normalize({
        "source": "manual", "source_id": hashlib.sha1(key.encode()).hexdigest()[:12], "name": name,
        "price": price, "original_price": original or None, "reviews": reviews or None, "category": category,
        "url": key if key.startswith("http") else None, "affiliate_url": aff or (key if key.startswith("http") else None),
        "image_url": image_url or None, "ends_at": ends_at, "evergreen": "1" if evergreen else "0", "note": note})
    if upload is not None:
        folder = config.data_dir() / "deal_images"
        folder.mkdir(exist_ok=True)
        path = folder / f"{d['source_id']}.jpg"
        Image.open(upload).convert("RGB").save(path, quality=92)
        d["image_url"] = str(path)
    d["score"], why = deals.score(d)
    with db.connect() as conn:
        deal_id = db.upsert_deal(conn, d)
    st.session_state.pop("deal_form", None)
    msg = f"딜 #{deal_id} 저장 (점수 {d['score']})"
    if any(r.startswith("탈락") for r in why):
        st.warning(msg + " — " + "; ".join(why))
    else:
        st.success(msg)


# ------------------------------------------------------------------ ② 영상 만들기

def page_make() -> None:
    st.header("② 영상 만들기")
    jobs = sorted([p for p in config.jobs_dir().iterdir() if (p / "deal.json").exists()],
                  key=lambda p: p.stat().st_mtime, reverse=True)
    if not jobs:
        st.info("먼저 ① 에서 딜을 골라 주세요.")
        return
    ids = [p.name for p in jobs]
    cur = st.session_state.get("job")
    job_id = st.selectbox("작업", ids, index=ids.index(cur) if cur in ids else 0)
    st.session_state["job"] = job_id
    j = jobmod.load(job_id)
    for m in st.session_state.pop("new_job_log", []):
        (st.warning if m.startswith("!") else st.caption)(m)
    if not j.p("script.md").exists():
        st.error("이 작업은 만들다가 멈춰서 대본이 없어요.")
        a, b = st.columns(2)
        if a.button("대본 다시 만들기", type="primary"):
            logs = []
            try:
                pipeline.regen_script(j, log=logs.append)
            except Exception as e:  # noqa: BLE001
                st.error(str(e))
                return
            st.session_state["new_job_log"] = logs
            st.rerun()
        if b.button("이 작업 지우기"):
            import shutil
            shutil.rmtree(j.path, ignore_errors=True)
            with db.connect() as conn:
                conn.execute("DELETE FROM videos WHERE job=?", (j.id,))
            st.session_state.pop("job", None)
            st.rerun()
        return
    left, right = st.columns([3, 2], gap="large")
    with left:
        section_deal(j)
        section_theme(j)
        section_script(j)
        section_images(j)
    with right:
        section_build(j)


def section_deal(j: jobmod.Job) -> None:
    deal = j.deal
    with st.expander(f"상품 정보 · {deal['name']}", expanded=False):
        with st.form(f"deal_{j.id}"):
            name = st.text_input("상품명", deal["name"])
            a, b = st.columns(2)
            price = a.number_input("할인가(원)", min_value=0, step=100, value=int(deal.get("price") or 0))
            original = b.number_input("정가(원)", min_value=0, step=100, value=int(deal.get("original_price") or 0))
            aff = st.text_input("수익 링크", deal.get("affiliate_url") or "")
            checked = st.text_input("가격 확인 시각 (설명란에 표시)", deal.get("checked_at") or "")
            if st.form_submit_button("저장"):
                deal.update(name=name, price=price, original_price=original or None, affiliate_url=aff,
                            checked_at=checked)
                deal["discount_pct"] = deals.normalize({**deal, "discount_pct": None})["discount_pct"]
                j.p("deal.json").write_text(json.dumps(deal, ensure_ascii=False, indent=2), encoding="utf-8")
                st.success("저장했어요. 영상을 다시 만들면 반영돼요.")
        a, b = st.columns([1, 2])
        cur = next((j.p(f"product.{e}") for e in ("jpg", "png", "jpeg", "webp") if j.p(f"product.{e}").exists()), None)
        if cur:
            a.image(str(cur), caption="상품 사진", width=140)
        up = b.file_uploader("상품 사진 바꾸기", type=["jpg", "jpeg", "png", "webp"], key=f"prod_{j.id}")
        if up is not None:
            Image.open(up).convert("RGB").save(j.p("product.jpg"), quality=92)
            st.success("상품 사진을 바꿨어요")


def section_theme(j: jobmod.Job) -> None:
    chans = profiles.all_profiles()
    if chans:
        st.subheader("채널")
        ids = list(chans)
        cur = j.state.get("channel") or profiles.default_id()
        cols = st.columns(len(ids))
        for c, cid in zip(cols, ids):
            c.image(theme_preview(j, None, cid), caption=chans[cid].get("name"), width="stretch")
        pick = st.radio("채널", ids, index=ids.index(cur) if cur in ids else 0, horizontal=True,
                        format_func=lambda k: chans[k].get("name", k), label_visibility="collapsed")
        if pick != j.state.get("channel"):
            msgs = []
            pipeline.set_channel(j, pick, log=msgs.append)
            for m in msgs:
                st.toast(m)
    with st.expander("색 바꾸기 (선택 · 기본은 채널 색)"):
        names = ["채널 기본"] + list(themes.THEMES)
        cur_t = j.state.get("theme") or "채널 기본"
        pick_t = st.radio("색", names, index=names.index(cur_t) if cur_t in names else 0, horizontal=True,
                          label_visibility="collapsed")
        chosen = None if pick_t == "채널 기본" else pick_t
        if chosen != j.state.get("theme"):
            pipeline.set_theme(j, chosen)
        if chosen:
            st.image(theme_preview(j, chosen), width=220)


def section_script(j: jobmod.Job) -> None:
    st.subheader("대본")
    text = j.p("script.md").read_text(encoding="utf-8")
    meta, body = script._split(j.p("script.md"))
    title = st.text_input("제목 (화면 위에 고정, 12~18자)", meta.get("title", ""), key=f"title_{j.id}")
    body_key = f"body_{j.id}"
    if body_key not in st.session_state:
        st.session_state[body_key] = body.strip() + "\n"
    with st.expander("장면 추가 · 레이아웃 고르기"):
        kind = st.selectbox("장면 종류", SCENE_KINDS, key=f"kind_{j.id}")
        a, b = st.columns([1, 2])
        a.image(style_preview(kind, j.state.get("channel")) if kind != SCENE_KINDS[0]
                else theme_preview(j, j.state.get("theme")),
                width="stretch")
        b.caption("커뮤니티 장면에는 실제 원글만 옮길 수 있어요 (원글 주소·확인 날짜 필수, 닉네임은 자동으로 가림). "
                  "카톡 장면은 '연출된 대화' 표시가 붙는 상황극이에요.")
        if b.button("대본 끝에 이 장면 추가"):
            st.session_state[body_key] = st.session_state[body_key].rstrip() + "\n\n" + scene_template(kind)
            st.rerun()
    st.text_area("본문 (한 줄 = 자막 한 장)", key=body_key, height=380)
    s_title = title.strip()
    new_text = (f"---\napproved: false\ntitle: {s_title}\nhook_type: {meta.get('hook_type', '')}\n---\n"
                + st.session_state[body_key].strip() + "\n")
    if new_text != text.replace("approved: true", "approved: false"):
        j.p("script.md").write_text(new_text, encoding="utf-8")  # 고치면 다시 승인 필요
    s, _ = script.read(j.p("script.md"))
    issues = script.lint(s, j.deal, script.read_scenes(j.p("script.md")))
    for lv, msg in issues:
        (st.error if lv == "ERROR" else st.warning)(msg, icon="⛔" if lv == "ERROR" else "⚠️")
    if not issues:
        st.success("대본 검사 통과", icon="✅")


def section_images(j: jobmod.Job) -> None:
    scs = script.read_scenes(j.p("script.md"))
    flat = [(sc.kind, it.text) for sc in scs for it in sc.items]
    post_lines = [(i, text) for i, (kind, text) in enumerate(flat) if kind == "post"]
    st.subheader("사진")
    st.caption("사진을 여러 장 한꺼번에 올리면 대본을 읽고 줄마다 어울리는 사진을 알아서 넣어요. "
               "상품이 잘 보이는 사진은 가격 줄에 쓰고, 남는 줄은 AI 이미지(선택 시)나 앞 사진으로 채워요.")
    ups = st.file_uploader("사진 여러 장", type=["jpg", "jpeg", "png", "webp"], accept_multiple_files=True,
                           key=f"batch_{j.id}", label_visibility="collapsed")
    if ups and st.button(f"사진 {len(ups)}장 대본에 맞게 배치", type="primary", key=f"place_{j.id}"):
        folder = j.p("uploads")
        folder.mkdir(exist_ok=True)
        paths = []
        for k, up in enumerate(ups, 1):
            path = folder / f"{k:02d}.jpg"
            Image.open(up).convert("RGB").save(path, quality=92)
            paths.append(path)
        with st.spinner("사진을 보고 줄마다 고르는 중…"):
            r = images.apply_photos(j, scs, paths)
        how = "사진 내용을 보고" if r["by"] == "claude" else "올린 순서대로 (Claude 키가 없거나 실패)"
        st.success(f"{len(r['placed'])}줄에 배치했어요 — {how}"
                   + (" · 상품 사진도 정했어요" if r["product_set"] else ""))
        if r["unused"]:
            st.info(f"안 쓴 사진: {', '.join(map(str, r['unused']))}번")
    has_any = any(j.path.glob("images/line_*.*"))
    with st.expander(f"줄별 사진 확인·바꾸기 ({len(post_lines)}줄) — 사진이 없는 줄은 앞 사진·상품 사진을 이어서 써요",
                     expanded=has_any):
        for i, text in post_lines:
            a, b, c = st.columns([3, 1, 2])
            a.write(f"**{i + 1}.** {text}")
            existing = next(iter(sorted(j.path.glob(f"images/line_{i:03d}.*"))), None)
            if existing:
                b.image(str(existing), width=90)
                if b.button("지우기", key=f"del_{j.id}_{i}"):
                    existing.unlink()
                    st.rerun()
            up = c.file_uploader("사진", type=["jpg", "jpeg", "png", "webp"], key=f"img_{j.id}_{i}",
                                 label_visibility="collapsed")
            if up is not None:
                j.p("images").mkdir(exist_ok=True)
                Image.open(up).convert("RGB").save(j.p("images", f"line_{i:03d}.png"))
                st.rerun()


def has_product_photo(j: jobmod.Job) -> bool:
    url = j.deal.get("image_url")
    return any(j.p(f"product.{e}").exists() for e in ("png", "jpg", "jpeg", "webp")) or bool(url)


def section_build(j: jobmod.Job) -> None:
    st.subheader("만들기")
    voices = dict(FREE_VOICES)
    voices.update({k: f"{k} (유료)" for k, env in PAID_VOICES.items() if has(env)})
    default_v = config.get("voice.provider", "edge")
    vkeys = list(voices)
    v = st.selectbox("목소리", vkeys, index=vkeys.index(default_v) if default_v in vkeys else 0,
                     format_func=lambda k: voices[k])
    img_opts = ["none"] + [p for p, env in (("gemini", "GEMINI_API_KEY"), ("openai", "OPENAI_API_KEY")) if has(env)]
    default_im = config.get("images.provider", "gemini")
    im = st.selectbox("AI 이미지", img_opts, index=img_opts.index(default_im) if default_im in img_opts else 0,
                      format_func=lambda k: {"none": "안 씀 (올린 사진·상품 사진)"}.get(k, k))
    if not has_product_photo(j):
        st.warning("상품 사진이 없어요. 가격·링크를 말하는 줄은 원래 상품 사진이 나오는 자리라, "
                   "지금은 앞뒤 AI 이미지로 채워요. 위 '상품 정보'에서 사진을 올리면 더 좋아요.")
    if st.button("승인하고 영상 만들기", type="primary", width="stretch"):
        script.set_approved(j.p("script.md"), True)
        with st.status("만드는 중…", expanded=True) as status:
            try:
                pipeline.build(j, v, im, log=st.write)
                status.update(label="완성!", state="complete")
            except pipeline.PipelineError as e:
                script.set_approved(j.p("script.md"), False)
                status.update(label="실패", state="error")
                st.error(str(e))
    final = j.p("render", "final.mp4")
    if final.exists():
        from datetime import datetime
        built = datetime.fromtimestamp(final.stat().st_mtime).strftime("%m/%d %H:%M")
        n_ai = len(list(j.path.glob("images/line_*.*")))
        chan = (profiles.all_profiles().get(j.state.get("channel") or "") or {}).get("name", "기본")
        st.caption(f"아래 영상: {built}에 만든 것 · 채널 {chan} · 줄별 사진 {n_ai}장 — "
                   "설정을 바꿨으면 위 버튼으로 다시 만들어야 반영돼요")
        st.video(str(final))
        a, b = st.columns(2)
        a.download_button("영상 파일 받기", final.read_bytes(), file_name=f"{j.id}.mp4", width="stretch")
        if b.button("캡컷으로 보내기", width="stretch"):
            try:
                from hotdeal_shorts import capcut
                path = capcut.export(j)
                st.success(f"캡컷을 껐다 켜면 목록 맨 앞에 있어요: {path.name}")
            except Exception as e:  # noqa: BLE001
                st.error(str(e))
        pub = j.p("publish.json")
        if pub.exists():
            p = json.loads(pub.read_text(encoding="utf-8"))
            st.markdown("**유튜브 제목**")
            st.code(p["youtube_title"], language=None)
            st.markdown("**설명란**")
            st.code(p["description"], language=None)
            st.markdown("**고정 댓글**")
            st.code(p["pinned_comment"], language=None)
            with st.expander("올리기 전 점검표"):
                st.markdown(j.p("review.md").read_text(encoding="utf-8").split("## 업로드 텍스트")[0])


# ------------------------------------------------------------------ 화면 전환

PAGES = {"① 딜 고르기": page_deals, "② 영상 만들기": page_make}
if "goto" in st.session_state:
    st.session_state["page"] = st.session_state.pop("goto")
with st.sidebar:
    st.title("🔥 핫딜 쇼츠")
    page = st.radio("화면", list(PAGES), key="page", label_visibility="collapsed")
    st.caption("채널: " + " · ".join(p.get("name", k) for k, p in profiles.all_profiles().items()))
    st.caption("목소리 기본값·채널명 등은 config.yaml 에서 바꿔요.")
PAGES[page]()
