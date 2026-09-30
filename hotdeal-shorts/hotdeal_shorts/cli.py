"""hd: 핫딜 쇼츠 CLI."""
from __future__ import annotations

import os
import shutil
from pathlib import Path
from typing import Optional

import requests
import typer

from . import config, db, deals, job as jobmod, metrics, pipeline, script, voice
from .frames import find_font

app = typer.Typer(help="핫딜 쇼핑 쇼츠 제작·운영 자동화", no_args_is_help=True)
deals_app = typer.Typer(help="딜 후보 수집·관리", no_args_is_help=True)
script_app = typer.Typer(help="대본 검사·승인·재생성", no_args_is_help=True)
video_app = typer.Typer(help="업로드한 영상 등록", no_args_is_help=True)
metrics_app = typer.Typer(help="성과 수집·분석", no_args_is_help=True)
voice_app = typer.Typer(help="목소리 설정", no_args_is_help=True)
app.add_typer(deals_app, name="deals")
app.add_typer(script_app, name="script")
app.add_typer(video_app, name="video")
app.add_typer(metrics_app, name="metrics")
app.add_typer(voice_app, name="voice")


@voice_app.command("list")
def voice_list(provider: str = typer.Argument(..., help="typecast | elevenlabs"), search: str = ""):
    """쓸 수 있는 목소리 목록 → 고른 id 를 config.yaml 의 voice.<provider>.voice_id 에."""
    from . import tts_providers
    fn = tts_providers.VOICES.get(provider)
    if fn is None:
        fail("목록 조회는 typecast, elevenlabs 만 지원 (openai 는 alloy·nova 등 고정 이름, google 은 ko-KR-Neural2-A 등)")
    try:
        voices = fn()
    except (tts_providers.CloudTTSError, requests.RequestException) as e:
        fail(str(e))
    for v in voices:
        line = f"  {v['id']:<32} {v['name'] or '':<16} {v.get('gender') or '':<7} {v.get('age') or '':<12} {v.get('use_cases') or ''}"
        if search in line:
            echo(line)


FREE_VOICES = [("edge", "edge_voice", v) for v in
               ("ko-KR-SunHiNeural", "ko-KR-InJoonNeural", "ko-KR-HyunsuMultilingualNeural")] + \
              [("supertonic", "supertonic.voice", v) for v in
               ("F1", "F2", "F3", "F4", "F5", "M1", "M2", "M3", "M4", "M5")]


@voice_app.command("sample")
def voice_sample(text: str = typer.Option("근데 이게 지금 삼만 구천구백원임. 특가 끝나기 전에 링크는 고정 댓글에 둠.",
                                          help="들어볼 문장"),
                 only: Optional[str] = typer.Option(None, help="edge 또는 supertonic 만")):
    """무료 목소리를 전부 같은 문장으로 만들어 voice_samples/ 에 저장 → 들어보고 config.yaml 에 고르기."""
    out_dir = config.home() / "voice_samples"
    out_dir.mkdir(exist_ok=True)
    cfg = config.cfg()
    saved = {k: (dict(v) if isinstance(v, dict) else v) for k, v in (cfg.get("voice") or {}).items()}
    for provider, key, name in FREE_VOICES:
        if only and provider != only:
            continue
        v = cfg.setdefault("voice", {})
        if "." in key:
            v.setdefault("supertonic", {})["voice"] = name
        else:
            v[key] = name
        path = out_dir / f"{provider}_{name}.{'mp3' if provider == 'edge' else 'wav'}"
        try:
            voice.PROVIDERS[provider](text, path)
            echo(f"  ✓ {path.name}")
        except voice.TTSError as e:
            typer.secho(f"  ✗ {provider} {name}: {e}", fg="yellow")
    cfg["voice"] = saved
    echo(f"\n{out_dir} 에서 들어보고 config.yaml 의 voice.provider 와 목소리 이름을 바꾸세요.")


@voice_app.command("setup-offline")
def voice_setup_offline():
    """인터넷 없이 쓰는 한국어 AI 음성 모델 내려받기 (config: voice.provider: sherpa)."""
    echo(f"✓ {voice.download_sherpa_model()}")


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
    config.cfg()  # .env 읽기
    env = config.home() / ".env"
    echo(f"작업 폴더      {config.home()}")
    echo(f".env 파일      {ok(env.exists())} {env}")
    echo(f"ffmpeg         {ok(shutil.which('ffmpeg'))}")
    try:
        echo(f"한글 폰트      {typer.style('OK', fg='green')} {find_font()}")
    except FileNotFoundError as e:
        echo(f"한글 폰트      {typer.style('없음', fg='red')} {e}")
    vp = config.get("voice.provider")
    vkey = {"typecast": "TYPECAST_API_KEY", "elevenlabs": "ELEVENLABS_API_KEY", "openai": "OPENAI_API_KEY",
            "google": "GOOGLE_TTS_API_KEY"}.get(vp)
    echo(f"목소리         {vp}" + (f" 키 {ok(os.environ.get(vkey))}" if vkey else "  (무료)"))
    echo(f"Claude 대본    {ok(os.environ.get('ANTHROPIC_API_KEY'))}  (없으면 템플릿 대본)")
    echo(f"쿠팡파트너스   {ok(os.environ.get('COUPANG_ACCESS_KEY') and os.environ.get('COUPANG_SECRET_KEY'))}"
         "  (없으면 CSV 수동 입력)")
    toss_ok = all(os.environ.get(k) for k in ("TOSS_ACCESS_KEY", "TOSS_SECRET_KEY", "TOSS_PUBLISHER_ID"))
    toss_missing = [k for k in ("TOSS_ACCESS_KEY", "TOSS_SECRET_KEY", "TOSS_PUBLISHER_ID") if not os.environ.get(k)]
    echo(f"토스 쉐어링크  {ok(toss_ok)}" + (f"  빠진 칸: {', '.join(toss_missing)}" if toss_missing and
                                           len(toss_missing) < 3 else "  (없으면 CSV 수동 입력)"))
    echo(f"YouTube API    {ok(os.environ.get('YOUTUBE_API_KEY'))}  (없으면 CSV 수동 입력)")
    img = config.get("images.provider", "gemini")
    key = {"gemini": "GEMINI_API_KEY", "openai": "OPENAI_API_KEY"}.get(img)
    echo(f"AI 이미지      {img} {ok(os.environ.get(key)) if key else ''}  (없으면 상품 사진)")


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


@deals_app.command("toss")
def deals_toss(best: bool = typer.Option(False, "--best", help="토스 베스트 (1시간마다 갱신, 상시형)"),
               today: bool = typer.Option(False, "--today", help="토스 하루특가 (그날만)"),
               category: str = typer.Option("", "--category", help="카테고리 베스트 (카테고리 ID)"),
               pages: int = typer.Option(1, "--pages", help="하루특가 몇 페이지까지 (페이지당 최대 30개)"),
               size: int = 30):
    """토스쇼핑 쉐어링크 API로 딜 가져오기 (수익 링크는 hd new 할 때 채널별 subTag 로 발급)."""
    if not (best or today or category):
        fail("--best, --today, --category 중 하나를 지정하세요")
    try:
        t = deals.Toss()
        items = ((t.best(size) if best else []) + (t.today_deals(size, pages) if today else [])
                 + (t.category_best(category, size) if category else []))
    except (deals.TossError, requests.RequestException) as e:
        fail(str(e))
    _save_deals(items)
    echo(f"✓ {len(items)}건 저장" + ("" if items else "  (품절·곧 끝나는 특가·24시간 안에 이미 가져온 상품은 뺌)"))


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

def _new_job(deal_id: int, hook: Optional[str], extra: str, channel: Optional[str] = None) -> jobmod.Job:
    try:
        j = pipeline.new_job(deal_id, hook, extra, log=echo, channel=channel)
    except pipeline.PipelineError as e:
        fail(str(e))
    echo(f"  대본 파일: {j.p('script.md')}")
    return j


def _print_lint(j: jobmod.Job) -> bool:
    s, approved = script.read(j.p("script.md"))
    scs = script.read_scenes(j.p("script.md"))
    issues = script.lint(s, j.deal, scs)
    echo("")
    echo(f"  제목: {s.title}")
    n = 0
    for sc in scs:
        tag = {"post": "게시글", "community": f"커뮤니티·{sc.meta.get('source_name', '')}", "kakao": "카톡(연출)"}[sc.kind]
        echo(f"  [{tag}]")
        for it in sc.items:
            n += 1
            who = f"{it.speaker}: " if it.speaker else ("댓글: " if it.role == "comment" else "")
            echo(f"  {n:>2}. {who}{it.text}")
    echo("")
    for level, msg in issues:
        typer.secho(f"  {level:<5} {msg}", fg="red" if level == "ERROR" else "yellow")
    if not issues:
        typer.secho("  문제 없음", fg="green")
    return not any(level == "ERROR" for level, _ in issues)


@app.command()
def new(deal_id: int, hook: Optional[str] = typer.Option(None, help=f"훅 유형: {', '.join(script.HOOK_TYPES)}"),
        extra: str = typer.Option("", help="대본에 추가로 요청할 것"),
        channel: Optional[str] = typer.Option(None, help="채널 id (config.yaml 의 channels, 예: salim·tech·beauty)")):
    """딜로 작업을 만들고 대본 초안 생성 → 사람이 script.md 수정 후 `hd script approve`."""
    j = _new_job(deal_id, hook, extra, channel)
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
def build(job_id: str, voice_provider: Optional[str] = typer.Option(None, "--voice", help="edge | typecast | elevenlabs | openai | google | sherpa | espeak | manual"),
          images_provider: Optional[str] = typer.Option(None, "--images", help="gemini | openai | none"),
          channel: Optional[str] = typer.Option(None, help="이 작업의 채널을 바꿔서 만들기 (salim·tech·beauty)")):
    """승인된 대본 → 목소리 → 화면 → final.mp4 → 업로드 텍스트."""
    j = jobmod.load(job_id)
    if channel:
        pipeline.set_channel(j, channel)
    _, approved = script.read(j.p("script.md"))
    if not approved:
        fail(f"대본 미승인. script.md 확인 후 `hd script approve {j.id}`")
    if not _print_lint(j):  # 승인 뒤에 고친 경우 대비
        fail("대본 검사 ERROR. 고친 뒤 다시 build")
    try:
        pipeline.build(j, voice_provider, images_provider, log=echo)
    except pipeline.PipelineError as e:
        fail(str(e))
    echo(f"  점검표·업로드 문구: {j.p('review.md')}")


def _make_images(j: jobmod.Job, provider: Optional[str], force: bool = False) -> None:
    pipeline.make_images(j, provider, force, log=echo)


@app.command("images")
def images_cmd(job_id: str, provider: Optional[str] = typer.Option(None, help="gemini | openai"),
               force: bool = typer.Option(False, "--force", help="이미 있는 이미지도 다시 생성"),
               select: Optional[str] = typer.Option(None, help="every | marked | first")):
    """줄마다 AI 이미지만 따로 생성 (결과: images/line_NNN.png). 마음에 안 드는 파일은 지우고 다시 실행."""
    j = jobmod.load(job_id)
    if select:
        config.cfg()["images"] = {**(config.get("images") or {}), "select": select}
    _make_images(j, provider, force)


@app.command()
def capcut(job_id: str,
           drafts_dir: Optional[Path] = typer.Option(None, "--dir", help="캡컷 초안 폴더 (기본: 자동 탐색)"),
           baked: bool = typer.Option(False, "--baked", help="자막을 화면에 구워 넣은 판으로 (자막 편집 불가)")):
    """캡컷 프로젝트로 내보내기 → 캡컷을 다시 켜면 목록에 '상품명_MMDD' 로 보임."""
    from . import capcut as cc_mod
    j = jobmod.load(job_id)
    try:
        path = cc_mod.export(j, drafts_dir, editable_subtitles=not baked)
    except cc_mod.CapCutError as e:
        fail(str(e))
    j.mark("capcut", "done", path=str(path))
    echo(f"✓ 캡컷 초안: {path}")
    if j.path in path.parents:
        echo("  캡컷 초안 폴더를 못 찾아 작업 폴더에 만들었어요. 이 폴더를 캡컷의 초안 폴더로 복사하거나,")
        echo("  config.yaml 의 capcut.drafts_dir 에 캡컷 초안 폴더 경로를 적고 다시 실행하세요.")
    else:
        echo("  캡컷을 완전히 껐다 켜면 프로젝트 목록 맨 앞에 보입니다.")


@app.command()
def ui(port: int = 8501):
    """작업 화면 열기 (브라우저에서 딜 고르기·대본·테마·사진·영상 만들기·캡컷 보내기)."""
    import subprocess
    import sys
    app_path = Path(__file__).resolve().parent.parent / "app.py"
    env = {**os.environ, "HD_HOME": str(config.home())}
    subprocess.run([sys.executable, "-m", "streamlit", "run", str(app_path), "--server.port", str(port),
                    "--browser.gatherUsageStats", "false"], env=env, cwd=str(app_path.parent))


@app.command()
def demo(voice_provider: Optional[str] = typer.Option(None, "--voice", help="edge | sherpa | espeak"),
         no_capcut: bool = typer.Option(False, "--no-capcut", help="캡컷 내보내기 생략")):
    """설치 확인용: 샘플 딜 → 샘플 대본 → 영상 → 캡컷 초안까지 한 번에."""
    root = Path(__file__).resolve().parent.parent / "samples"
    items = deals.import_csv(root / "deals.csv")[:1]
    _save_deals(items)
    deal_id = items[0]["id"]
    with db.connect() as conn:
        deal = db.get_deal(conn, deal_id)
    j = jobmod.create(deal, slug="demo")
    shutil.copy(root / "demo_script.md", j.p("script.md"))
    with db.connect() as conn:
        conn.execute("INSERT OR REPLACE INTO videos (job, deal_id, title, hook_type) VALUES (?,?,?,?)",
                     (j.id, deal_id, "세차장 사장님이 몰래 쓴다는 청소기", "상황공감"))
    build(j.id, voice_provider, "none", None)
    if not no_capcut:
        capcut(j.id, None, False)


@app.command()
def make(deal_id: int, hook: Optional[str] = None, extra: str = "",
         yes: bool = typer.Option(False, "--yes", help="대본 검사에 ERROR가 없으면 사람 승인 없이 바로 제작"),
         voice_provider: Optional[str] = typer.Option(None, "--voice", help="edge | typecast | elevenlabs | openai | google | sherpa | espeak | manual"),
         channel: Optional[str] = typer.Option(None, help="채널 id (salim·tech·beauty)")):
    """딜 번호 하나로 대본부터 영상까지 한 번에."""
    j = _new_job(deal_id, hook, extra, channel)
    ok = _print_lint(j)
    if not yes:
        echo(f"\n대본을 확인하세요: {j.p('script.md')}\n승인 후 `hd script approve {j.id}` → `hd build {j.id}`")
        return
    if not ok:
        fail("대본에 ERROR가 있어 자동 제작을 멈춤. script.md 수정 후 approve → build")
    script.set_approved(j.p("script.md"), True)
    j.mark("script", "approved", auto=True)
    build(j.id, voice_provider, None, None)


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
