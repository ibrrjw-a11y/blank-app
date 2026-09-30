"""명령어(hd)와 작업 화면(hd ui)이 같이 쓰는 제작 단계."""
from __future__ import annotations

from typing import Callable

from . import config, db, deals, images, job as jobmod, publish, render, script, themes, voice
from .frames import render_frames

Log = Callable[[str], None]


class PipelineError(RuntimeError):
    pass


def new_job(deal_id: int, hook: str | None = None, extra: str = "", log: Log = print) -> jobmod.Job:
    """딜 → 작업 폴더 + 대본 초안. 토스 딜은 이때 수익 링크를 발급한다."""
    with db.connect() as conn:
        deal = db.get_deal(conn, deal_id)
        if not deal:
            raise PipelineError(f"딜 #{deal_id} 없음")
        conn.execute("UPDATE deals SET status='made' WHERE id=?", (deal_id,))
        dup = conn.execute("SELECT job FROM videos WHERE deal_id=?", (deal_id,)).fetchone()
    if dup:
        log(f"! 같은 딜로 만든 영상이 이미 있음: {dup['job']} (재사용 소재 주의)")
    if deal["source"] == "toss" and not deal.get("affiliate_url"):
        try:
            deal["affiliate_url"] = deals.Toss().link(deal["source_id"])
            with db.connect() as conn:
                conn.execute("UPDATE deals SET affiliate_url=? WHERE id=?", (deal["affiliate_url"], deal_id))
            log(f"✓ 토스 쉐어링크 발급: {deal['affiliate_url']}")
        except deals.TossError as e:
            log(f"! 토스 링크 발급 실패, 나중에 deal.json 의 affiliate_url 을 채우세요: {e}")
    j = jobmod.create(deal)
    s, provider = script.generate(deal, hook, extra)
    j.p("script.md").write_text(script.to_markdown(s), encoding="utf-8")
    j.mark("script", "draft", provider=provider, hook_type=s.hook_type)
    with db.connect() as conn:
        conn.execute("INSERT OR REPLACE INTO videos (job, deal_id, title, hook_type) VALUES (?,?,?,?)",
                     (j.id, deal_id, s.title, s.hook_type))
    log(f"✓ 작업 {j.id} (대본: {provider}, 훅: {s.hook_type})")
    return j


def make_images(j: jobmod.Job, provider: str | None, force: bool = False, log: Log = print) -> None:
    """줄별 AI 이미지. 키가 없거나 실패해도 영상 제작은 계속 (상품 사진으로 대체)."""
    if (provider or config.get("images.provider", "gemini")) == "none":
        return
    log("… 줄별 AI 이미지")
    try:
        r = images.generate(j, script.read_scenes(j.p("script.md")), provider, force)
    except images.ImageError as e:
        log(f"  ! 이미지 건너뜀: {e}")
        return
    j.mark("images", "done", **{k: v for k, v in r.items() if k != "failed"})
    if r.get("skipped"):
        log(f"  이미 있음 {r['skipped']}장 (다시 만들려면 hd images {j.id} --force)")
    else:
        log(f"  새로 {r['made']}장 ({r['provider']}, 프롬프트: {r.get('prompt_by', '-')})")
    if r.get("failed"):
        log(f"  ! 실패한 줄 {r['failed']}: 상품 사진으로 대체")


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


def set_theme(j: jobmod.Job, name: str | None) -> None:
    st = j.state
    st["theme"] = name
    import json
    j.p("job.json").write_text(json.dumps(st, ensure_ascii=False, indent=2), encoding="utf-8")
