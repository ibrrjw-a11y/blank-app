"""명령어(hd)와 작업 화면(hd ui)이 같이 쓰는 제작 단계."""
from __future__ import annotations

from typing import Callable

from . import config, db, deals, images, job as jobmod, profiles, publish, render, script, themes, voice
from .frames import render_frames

Log = Callable[[str], None]


class PipelineError(RuntimeError):
    pass


def toss_link_for(deal: dict, channel: str | None, log: Log = print) -> str | None:
    """토스 딜의 채널별 수익 링크. 같은 (상품, subTag) 는 캐시라 여러 번 불러도 한도를 안 쓴다."""
    prof = profiles.all_profiles().get(channel or "") or {}
    subtag = prof.get("toss_subtag")
    try:
        url = deals.Toss().link(deal["source_id"], subtag)
    except deals.TossLinkBlocked as e:
        raise PipelineError(f"이 상품은 토스가 링크 발급을 막아 둠 — 다른 딜을 고르세요 ({e})")
    except deals.TossError as e:
        if subtag and "ACCESS_DENIED" in str(e):  # 채널 태그(subTag) 미등록일 수 있음 → 태그 없이라도 받아 둔다
            try:
                url = deals.Toss().link(deal["source_id"], None)
                log(f"! 채널 태그 '{subtag}' 로는 링크를 못 받아서 태그 없이 받았어요 (수익은 똑같이 잡힘, "
                    f"채널별 구분만 안 됨). 쉐어링크 관리 화면에서 '{subtag}' 를 등록하면 다음부터 구분돼요: {url}")
                return url
            except deals.TossError as e2:
                e = e2
        log(f"! 토스 링크 발급 실패, 작업 화면의 '수익 링크' 칸을 직접 채우세요: {e}")
        return None
    log(f"✓ 토스 쉐어링크 발급{f' ({subtag})' if subtag else ''}: {url}")
    return url


def new_job(deal_id: int, hook: str | None = None, extra: str = "", log: Log = print,
            channel: str | None = None) -> jobmod.Job:
    """딜 → 작업 폴더 + 대본 초안. 토스 딜은 이때 채널별 수익 링크를 발급한다.
    중간에 실패하면 반쯤 만든 작업 폴더를 남기지 않는다."""
    import shutil
    channel = channel or profiles.default_id()
    with db.connect() as conn:
        deal = db.get_deal(conn, deal_id)
        if not deal:
            raise PipelineError(f"딜 #{deal_id} 없음")
        dup = conn.execute("SELECT job FROM videos WHERE deal_id=?", (deal_id,)).fetchone()
    if dup:
        log(f"! 같은 딜로 만든 영상이 이미 있음: {dup['job']} (재사용 소재 주의)")
    if deal["source"] == "toss":
        # 링크는 채널마다 달라서 딜(공용)이 아니라 작업(deal.json)에만 넣는다. 사람이 직접 넣은 링크는 존중
        auto = _auto_toss_link(deal)
        if not deal.get("affiliate_url") or auto:
            deal["affiliate_url"] = toss_link_for(deal, channel, log) or (None if auto else deal.get("affiliate_url"))
    s, provider = script.generate(deal, hook, extra)
    if provider.startswith("template ("):
        log(f"! {provider[10:-1]} → 템플릿 대본으로 만들었어요")
    j = jobmod.create(deal)
    try:
        _set(j, "channel", channel)  # 링크는 위에서 이미 이 채널 것으로 받음
        j.p("script.md").write_text(script.to_markdown(s), encoding="utf-8")
        j.mark("script", "draft", provider=provider.split(" ")[0], hook_type=s.hook_type)
        with db.connect() as conn:
            conn.execute("INSERT OR REPLACE INTO videos (job, deal_id, title, hook_type) VALUES (?,?,?,?)",
                         (j.id, deal_id, s.title, s.hook_type))
            conn.execute("UPDATE deals SET status='made' WHERE id=?", (deal_id,))
    except Exception:
        shutil.rmtree(j.path, ignore_errors=True)
        raise
    log(f"✓ 작업 {j.id} (채널: {channel or '기본'}, 대본: {provider.split(' ')[0]}, 훅: {s.hook_type})")
    return j


def regen_script(j: jobmod.Job, hook: str | None = None, extra: str = "", log: Log = print):
    """대본 다시 생성 (기존 파일은 script.prev.md 로 보관). 대본이 없는 작업도 살린다."""
    import shutil
    if j.p("script.md").exists():
        shutil.copy(j.p("script.md"), j.p("script.prev.md"))
    s, provider = script.generate(j.deal, hook, extra)
    if provider.startswith("template ("):
        log(f"! {provider[10:-1]} → 템플릿 대본으로 만들었어요")
    j.p("script.md").write_text(script.to_markdown(s), encoding="utf-8")
    j.mark("script", "draft", provider=provider.split(" ")[0], hook_type=s.hook_type)
    with db.connect() as conn:
        conn.execute("INSERT OR IGNORE INTO videos (job, deal_id) VALUES (?,?)", (j.id, j.deal.get("id")))
        conn.execute("UPDATE videos SET title=?, hook_type=? WHERE job=?", (s.title, s.hook_type, j.id))
    return s


def _auto_toss_link(deal: dict) -> bool:
    """딜에 저장된 링크가 예전에 자동 발급된 것인지 (그럼 채널별로 다시 고른다)."""
    url = deal.get("affiliate_url")
    if not url:
        return False
    try:
        with db.connect() as conn:
            return conn.execute("SELECT 1 FROM toss_links WHERE short_url=? OR origin_url=?",
                                (url, url)).fetchone() is not None
    except Exception:  # noqa: BLE001 - 아직 링크 테이블이 없음
        return False


def make_images(j: jobmod.Job, provider: str | None, force: bool = False, log: Log = print) -> None:
    """줄별 AI 이미지. 키가 없거나 실패해도 영상 제작은 계속 (상품 사진으로 대체)."""
    if (provider or config.get("images.provider", "gemini")) == "none":
        return
    log("… 줄별 AI 이미지")
    try:
        r = images.generate(j, script.read_scenes(j.p("script.md")), provider, force, log=log)
    except images.ImageError as e:
        log(f"  ! 이미지 건너뜀: {e}")
        j.mark("images", "error", error=str(e)[:500])
        return
    status = "error" if r.get("made") == 0 and r.get("failed") else "done"
    j.mark("images", status, **{k: v for k, v in r.items() if k != "failed"})
    if r.get("skipped"):
        log(f"  이미 있음 {r['skipped']}장 (다시 만들려면 hd images {j.id} --force)")
    else:
        log(f"  새로 {r['made']}장 ({r['provider']}, 프롬프트: {r.get('prompt_by', '-')})")
    if r.get("failed"):
        log(f"  ! 못 만든 줄 {[i + 1 for i in r['failed']]} → 앞 사진을 이어서 씀. 이유: {r.get('error', '')[:200]}")


def build(j: jobmod.Job, voice_provider: str | None = None, images_provider: str | None = None,
          log: Log = print) -> dict:
    """승인된 대본 → 목소리 → (이미지) → 화면 → final.mp4 → 업로드 텍스트."""
    s, approved = script.read(j.p("script.md"))
    if not approved:
        raise PipelineError("대본이 아직 승인되지 않았어요")
    errors = [m for lv, m in script.lint(s, j.deal, script.read_scenes(j.p("script.md"))) if lv == "ERROR"]
    if errors:
        raise PipelineError("대본 검사 ERROR: " + " / ".join(errors))
    with db.connect() as conn:  # 사람이 고친 최종 제목·훅을 기록
        conn.execute("UPDATE videos SET title=?, hook_type=? WHERE job=?", (s.title, s.hook_type, j.id))
    theme = j.state.get("theme")
    with profiles.applied(j.state.get("channel")) as prof:
        if prof:
            log(f"채널: {prof.get('name')} ({prof.get('layout', 'card')})")
        return _build(j, s, theme, voice_provider, images_provider, log)


def _build(j, s, theme, voice_provider, images_provider, log) -> dict:
    try:
        log("… 목소리 합성")
        vs = voice.synthesize(j, s.lines, voice_provider)
        j.mark("voice", "done", **vs)
        log(f"  음성 {vs['final_sec']}초 ({vs['provider']})" + (f", 무음 {vs['cuts']}곳 정리" if vs["cuts"] else ""))
        make_images(j, images_provider, log=log)
        log("… 화면 그리기" + (f" (테마: {theme})" if theme else ""))
        with themes.applied(theme):
            fr = render_frames(j, s)
        j.mark("frames", "done", count=len(fr))
        log("… 영상 조립")
        ri = render.render(j)
        j.mark("render", "done", **ri)
        publish.build(j, s, ri)
        j.mark("publish_text", "done")
    except (voice.TTSError, FileNotFoundError, ValueError) as e:
        j.error("build", str(e))
        raise PipelineError(str(e)) from e
    log(f"✓ 완성: {ri['path']} ({ri['duration']}초)")
    return ri


def _set(j: jobmod.Job, key: str, value) -> None:
    import json
    st = j.state
    st[key] = value
    j.p("job.json").write_text(json.dumps(st, ensure_ascii=False, indent=2), encoding="utf-8")


def set_theme(j: jobmod.Job, name: str | None) -> None:
    _set(j, "theme", name)


def set_channel(j: jobmod.Job, channel_id: str | None, log: Log = print) -> None:
    """채널을 바꾸면 토스 링크도 그 채널 subTag 로 바꾼다 (자동 발급한 링크일 때만)."""
    changed = j.state.get("channel") != channel_id
    _set(j, "channel", channel_id)
    deal = j.deal
    if changed and deal.get("source") == "toss" and _auto_toss_link(deal):
        url = toss_link_for(deal, channel_id, log)
        if url:
            import json
            deal["affiliate_url"] = url
            j.p("deal.json").write_text(json.dumps(deal, ensure_ascii=False, indent=2), encoding="utf-8")
