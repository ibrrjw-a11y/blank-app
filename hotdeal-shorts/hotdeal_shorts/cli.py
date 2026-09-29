"""hd: 핫딜 쇼츠 CLI."""
from __future__ import annotations

import os
import shutil
from pathlib import Path
from typing import Optional

import typer

from . import config, db, deals, job as jobmod, metrics, publish, render, script, voice
from .frames import find_font, render_frames

app = typer.Typer(help="핫딜 쇼핑 쇼츠 제작·운영 자동화", no_args_is_help=True)
deals_app = typer.Typer(help="딜 후보 수집·관리", no_args_is_help=True)
script_app = typer.Typer(help="대본 검사·승인·재생성", no_args_is_help=True)
video_app = typer.Typer(help="업로드한 영상 등록", no_args_is_help=True)
metrics_app = typer.Typer(help="성과 수집·분석", no_args_is_help=True)
app.add_typer(deals_app, name="deals")
app.add_typer(script_app, name="script")
app.add_typer(video_app, name="video")
app.add_typer(metrics_app, name="metrics")


def echo(msg: str = "") -> None:
    typer.echo(msg)


def fail(msg: str) -> None:
    typer.secho(f"✗ {msg}", fg="red", err=True)
    raise typer.Exit(1)


# ================================================================== 점검

@app.command()
def doctor():
    """필요한 도구·키가 준비됐는지 점검."""
    ok = lambda b: typer.style("OK", fg="green") if b else typer.style("없음", fg="yellow")  # noqa: E731
    echo(f"작업 폴더      {config.home()}")
    echo(f"ffmpeg         {ok(shutil.which('ffmpeg'))}")
    try:
        echo(f"한글 폰트      {typer.style('OK', fg='green')} {find_font()}")
    except FileNotFoundError as e:
        echo(f"한글 폰트      {typer.style('없음', fg='red')} {e}")
    echo(f"TTS            {config.get('voice.provider')} (espeak 설치: {ok(shutil.which('espeak-ng'))})")
    echo(f"Claude 대본    {ok(os.environ.get('ANTHROPIC_API_KEY'))}  (없으면 템플릿 대본)")
    echo(f"쿠팡파트너스   {ok(os.environ.get('COUPANG_ACCESS_KEY') and os.environ.get('COUPANG_SECRET_KEY'))}"
         "  (없으면 CSV 수동 입력)")
    echo(f"YouTube API    {ok(os.environ.get('YOUTUBE_API_KEY'))}  (없으면 CSV 수동 입력)")


# ================================================================== 딜

def _save_deals(items: list[dict]) -> None:
    with db.connect() as conn:
        for d in items:
            d["score"], why = deals.score(d)
            d["_reasons"] = why
            d["id"] = db.upsert_deal(conn, d)
    for d in sorted(items, key=lambda x: -(x["score"] or 0)):
        dropped = any(r.startswith("탈락") for r in d["_reasons"])
        mark = typer.style("탈락", fg="red") if dropped else typer.style(f"{d['score']:>5}", fg="green")
        echo(f"  #{d['id']:<4} {mark}  {d['name'][:30]:<30}  {d.get('price') or '-':>8}원  "
             f"{(str(int(d['discount_pct'])) + '%') if d.get('discount_pct') else '':>4}  "
             f"{'; '.join(d['_reasons'])}")


@deals_app.command("template")
def deals_template(path: Path = typer.Argument(Path("deals.csv"))):
    """딜 입력용 CSV 양식 만들기."""
    deals.write_csv_template(path)
    echo(f"✓ {path} 생성. 엑셀/구글시트로 열어 한 줄에 딜 하나씩 채운 뒤 `hd deals import {path}`")


@deals_app.command("import")
def deals_import(path: Path):
    """CSV로 딜 후보 넣기 (핫딜 게시판·직접 발견한 딜)."""
    items = deals.import_csv(path)
    _save_deals(items)
    echo(f"✓ {len(items)}건 저장")


@deals_app.command("coupang")
def deals_coupang(goldbox: bool = typer.Option(False, "--goldbox", help="골드박스(오늘의 특가)"),
                  search: Optional[str] = typer.Option(None, "--search", help="검색어"),
                  limit: int = 10):
    """쿠팡파트너스 API로 딜 가져오기 (수익 링크 포함)."""
    if not (goldbox or search):
        fail("--goldbox 또는 --search 검색어 중 하나를 지정하세요")
    try:
        c = deals.Coupang()
        items = c.goldbox() if goldbox else c.search(search, limit)
    except deals.CoupangError as e:
        fail(str(e))
    _save_deals(items)
    echo(f"✓ {len(items)}건 저장")


@deals_app.command("list")
def deals_list(top: int = 20, all_: bool = typer.Option(False, "--all", help="탈락 포함")):
    """점수순 딜 후보."""
    with db.connect() as conn:
        rows = [dict(r) for r in conn.execute("SELECT * FROM deals ORDER BY score DESC, id DESC").fetchall()]
    shown = 0
    for d in rows:
        _, why = deals.score(d)
        if not all_ and any(r.startswith("탈락") for r in why):
            continue
        echo(f"  #{d['id']:<4} {d['score'] or 0:>5}  [{d['status']:<6}] {d['name'][:30]:<30} "
             f"{d['price'] or '-':>8}원  {d['source']}")
        shown += 1
        if shown >= top:
            break
    if not shown:
        echo("후보 없음. `hd deals template` → `hd deals import deals.csv` 또는 `hd deals coupang --goldbox`")


# ================================================================== 제작

def _new_job(deal_id: int, hook: Optional[str], extra: str) -> jobmod.Job:
    with db.connect() as conn:
        deal = db.get_deal(conn, deal_id)
        if not deal:
            fail(f"딜 #{deal_id} 없음 (`hd deals list` 로 번호 확인)")
        conn.execute("UPDATE deals SET status='made' WHERE id=?", (deal_id,))
        dup = conn.execute("SELECT job FROM videos WHERE deal_id=?", (deal_id,)).fetchone()
    if dup:
        typer.secho(f"! 같은 딜로 만든 영상이 이미 있음: {dup['job']} (재사용 소재 주의)", fg="yellow")
    j = jobmod.create(deal)
    s, provider = script.generate(deal, hook, extra)
    j.p("script.md").write_text(script.to_markdown(s), encoding="utf-8")
    j.mark("script", "draft", provider=provider, hook_type=s.hook_type)
    with db.connect() as conn:
        conn.execute("INSERT OR REPLACE INTO videos (job, deal_id, title, hook_type) VALUES (?,?,?,?)",
                     (j.id, deal_id, s.title, s.hook_type))
    echo(f"✓ 작업 {j.id} (대본: {provider}, 훅: {s.hook_type})")
    echo(f"  대본 파일: {j.p('script.md')}")
    return j


def _print_lint(j: jobmod.Job) -> bool:
    s, approved = script.read(j.p("script.md"))
    issues = script.lint(s, j.deal)
    echo("")
    echo(f"  제목: {s.title}")
    for i, ln in enumerate(s.lines, 1):
        echo(f"  {i:>2}. {ln}")
    echo("")
    for level, msg in issues:
        typer.secho(f"  {level:<5} {msg}", fg="red" if level == "ERROR" else "yellow")
    if not issues:
        typer.secho("  문제 없음", fg="green")
    return not any(level == "ERROR" for level, _ in issues)


@app.command()
def new(deal_id: int, hook: Optional[str] = typer.Option(None, help=f"훅 유형: {', '.join(script.HOOK_TYPES)}"),
        extra: str = typer.Option("", help="대본에 추가로 요청할 것")):
    """딜로 작업을 만들고 대본 초안 생성 → 사람이 script.md 수정 후 `hd script approve`."""
    j = _new_job(deal_id, hook, extra)
    _print_lint(j)
    echo(f"\n다음: script.md 를 다듬고 → `hd script approve {j.id}` → `hd build {j.id}`")


@script_app.command("lint")
def script_lint(job_id: str):
    """대본 검사."""
    ok = _print_lint(jobmod.load(job_id))
    raise typer.Exit(0 if ok else 1)


@script_app.command("approve")
def script_approve(job_id: str):
    """대본 승인 (검사에 ERROR가 있으면 거부)."""
    j = jobmod.load(job_id)
    if not _print_lint(j):
        fail("ERROR 항목을 고친 뒤 다시 승인하세요")
    script.set_approved(j.p("script.md"), True)
    j.mark("script", "approved")
    echo(f"✓ 승인됨. 다음: `hd build {j.id}`")


@script_app.command("regen")
def script_regen(job_id: str, hook: Optional[str] = None, extra: str = ""):
    """대본 다시 생성 (기존 파일은 script.prev.md 로 보관)."""
    j = jobmod.load(job_id)
    if j.p("script.md").exists():
        shutil.copy(j.p("script.md"), j.p("script.prev.md"))
    s, provider = script.generate(j.deal, hook, extra)
    j.p("script.md").write_text(script.to_markdown(s), encoding="utf-8")
    j.mark("script", "draft", provider=provider, hook_type=s.hook_type)
    with db.connect() as conn:
        conn.execute("UPDATE videos SET title=?, hook_type=? WHERE job=?", (s.title, s.hook_type, j.id))
    _print_lint(j)


@app.command()
def build(job_id: str, voice_provider: Optional[str] = typer.Option(None, "--voice", help="edge | espeak | manual")):
    """승인된 대본 → 목소리 → 화면 → final.mp4 → 업로드 텍스트."""
    j = jobmod.load(job_id)
    s, approved = script.read(j.p("script.md"))
    if not approved:
        fail(f"대본 미승인. script.md 확인 후 `hd script approve {j.id}`")
    with db.connect() as conn:  # 사람이 고친 최종 제목·훅을 기록
        conn.execute("UPDATE videos SET title=?, hook_type=? WHERE job=?", (s.title, s.hook_type, j.id))
    try:
        echo("… 목소리 합성")
        vs = voice.synthesize(j, s.lines, voice_provider)
        j.mark("voice", "done", **vs)
        echo(f"  원본 {vs['raw_sec']}초 → 최종 {vs['final_sec']}초 (무음 {vs['cuts']}곳 정리)")
        echo("… 화면 그리기")
        fr = render_frames(j, s)
        j.mark("frames", "done", count=len(fr))
        echo("… 영상 조립")
        ri = render.render(j)
        j.mark("render", "done", **ri)
        publish.build(j, s, ri)
        j.mark("publish_text", "done")
    except (voice.TTSError, FileNotFoundError, ValueError) as e:
        j.error("build", str(e))
        fail(str(e))
    echo(f"✓ 완성: {ri['path']} ({ri['duration']}초)")
    echo(f"  점검표·업로드 문구: {j.p('review.md')}")


@app.command()
def make(deal_id: int, hook: Optional[str] = None, extra: str = "",
         yes: bool = typer.Option(False, "--yes", help="대본 검사에 ERROR가 없으면 사람 승인 없이 바로 제작"),
         voice_provider: Optional[str] = typer.Option(None, "--voice")):
    """딜 번호 하나로 대본부터 영상까지 한 번에."""
    j = _new_job(deal_id, hook, extra)
    ok = _print_lint(j)
    if not yes:
        echo(f"\n대본을 확인하세요: {j.p('script.md')}\n승인 후 `hd script approve {j.id}` → `hd build {j.id}`")
        return
    if not ok:
        fail("대본에 ERROR가 있어 자동 제작을 멈춤. script.md 수정 후 approve → build")
    script.set_approved(j.p("script.md"), True)
    j.mark("script", "approved", auto=True)
    build(j.id, voice_provider)


# ================================================================== 영상·성과

@video_app.command("add")
def video_add(job_id: str, youtube_id: str = typer.Option(..., "--youtube-id")):
    """업로드한 유튜브 영상 ID 등록 (shorts/ 뒤의 11자리)."""
    j = jobmod.load(job_id)
    s, _ = script.read(j.p("script.md"))
    with db.connect() as conn:
        conn.execute("INSERT INTO videos (job, title, hook_type, youtube_id, published_at) VALUES (?,?,?,?,?) "
                     "ON CONFLICT(job) DO UPDATE SET youtube_id=excluded.youtube_id, title=excluded.title, "
                     "hook_type=excluded.hook_type, "
                     "published_at=excluded.published_at",
                     (j.id, s.title, s.hook_type, youtube_id, db.now()))
    echo(f"✓ {j.id} ↔ {youtube_id}")


@metrics_app.command("pull")
def metrics_pull(job: Optional[str] = None):
    """YouTube API로 조회수·댓글(구매 의도) 수집."""
    try:
        rows = metrics.pull(job)
    except metrics.MetricsError as e:
        fail(str(e))
    for r in rows:
        echo(f"  {r['job']}: 조회 {r['views']:,} · 좋아요 {r['likes']:,} · 구매의도 댓글 {r['buy_intent']}")


@metrics_app.command("import")
def metrics_import(path: Path):
    """CSV로 성과 넣기 (job,views,likes,comments,buy_intent,avg_view_pct)."""
    echo(f"✓ {metrics.import_csv(path)}건 저장")


@app.command()
def report():
    """주간 리포트 (배수·진단·훅별 성과·다음 주 고칠 것 1개)."""
    path = metrics.weekly_report()
    echo(path.read_text(encoding="utf-8"))
    echo(f"✓ {path}")


if __name__ == "__main__":
    app()
