"""캡컷 프로젝트(초안) 내보내기: 자동으로 만든 영상을 캡컷에서 열어 효과음·전환·자막만 손보기 위한 용도.

캡컷 초안 형식은 비공개라 오픈소스 pycapcut(pyJianYingDraft 계열)으로 만든다.
캡컷 버전에 따라 열리지 않을 수 있으니 처음 한 번은 직접 열어서 확인할 것.

트랙 구성 (아래에서 위로):
  목소리(오디오) · 효과음(빈 오디오 트랙) · 화면(줄마다 이미지) · 자막(게시글형 줄, 글자 편집 가능)
"""
from __future__ import annotations

import json
import os
import platform
import shutil
from datetime import datetime
from pathlib import Path

from . import audio, config, render
from .job import Job


class CapCutError(RuntimeError):
    pass


def default_drafts_dir() -> Path | None:
    custom = config.get("capcut.drafts_dir")
    if custom:
        return Path(os.path.expandvars(os.path.expanduser(custom)))
    if platform.system() == "Windows" and os.environ.get("LOCALAPPDATA"):
        p = Path(os.environ["LOCALAPPDATA"]) / "CapCut" / "User Data" / "Projects" / "com.lveditor.draft"
    elif platform.system() == "Darwin":
        p = Path.home() / "Movies" / "CapCut" / "User Data" / "Projects" / "com.lveditor.draft"
    else:
        return None
    return p if p.exists() else None


def draft_name(job: Job) -> str:
    """레퍼런스와 같은 규칙: 상품명_MMDD."""
    from .job import slugify
    return f"{slugify(job.deal['name'])[:10]}_{datetime.now():%m%d}"


def export(job: Job, drafts_dir: Path | None = None, editable_subtitles: bool = True) -> Path:
    try:
        import pycapcut as cc
    except ImportError as e:
        raise CapCutError("pip install pycapcut 가 필요합니다 (또는 pip install -e \".[capcut]\")") from e

    frames_json = job.p("frames", "frames.json")
    if not frames_json.exists() or not job.p("voice.wav").exists():
        raise CapCutError(f"먼저 hd build {job.id} 로 화면과 목소리를 만들어야 합니다")
    frames = json.loads(frames_json.read_text(encoding="utf-8"))
    W, H = config.get("video.width", 1080), config.get("video.height", 1920)

    target = drafts_dir or default_drafts_dir()
    if target is None:
        target = job.p("capcut")  # 캡컷 폴더를 못 찾으면 작업 폴더에 만들고 안내
    target.mkdir(parents=True, exist_ok=True)
    name = draft_name(job)
    folder = cc.DraftFolder(str(target))
    script = folder.create_draft(name, W, H, config.get("video.fps", 30), allow_replace=True)
    draft_dir = target / name

    # 소재를 초안 폴더 안으로 복사 → 작업 폴더를 지워도 캡컷 프로젝트가 깨지지 않음
    media = draft_dir / "materials"
    media.mkdir(exist_ok=True)

    def local(src: str) -> str:
        dst = media / Path(src).name
        shutil.copy(src, dst)
        return str(dst)

    script.add_track(cc.TrackType.audio, "목소리")
    script.add_track(cc.TrackType.audio, "효과음")  # 비워 둠: 캡컷에서 효과음을 여기에
    script.add_track(cc.TrackType.video, "화면")
    if editable_subtitles:
        script.add_track(cc.TrackType.text, "자막")

    total = len(audio.read_wav(job.p("voice.wav"))) / audio.SR
    sched = render.schedule(frames, total, config.get("subtitle.lead_sec", 0.15))
    t = 0
    sub_style = cc.TextStyle(size=9.0, bold=True, color=(0.08, 0.08, 0.09), align=1, auto_wrapping=True,
                             max_line_width=0.86)
    for f, (_, dur) in zip(frames, sched):
        us = int(round(dur * 1_000_000))
        use_clean = editable_subtitles and f.get("clean") and Path(f["clean"]).exists()
        img = cc.VideoMaterial(local(f["clean"] if use_clean else f["path"]))
        script.add_segment(cc.VideoSegment(img, cc.Timerange(t, us)), "화면")
        if use_clean:
            # 세로 위치: 캔버스 중앙 기준, 위쪽이 + (단위 = 캔버스 높이의 절반)
            ty = (H / 2 - f.get("sub_y", 620)) / (H / 2)
            script.add_segment(cc.TextSegment("\n".join(f["sub"]), cc.Timerange(t, us), style=sub_style,
                                              clip_settings=cc.ClipSettings(transform_y=ty)), "자막")
        t += us

    voice = cc.AudioMaterial(local(str(job.p("voice.wav"))))
    script.add_segment(cc.AudioSegment(voice, cc.Timerange(0, min(voice.duration, t))), "목소리")
    script.save()
    return draft_dir
