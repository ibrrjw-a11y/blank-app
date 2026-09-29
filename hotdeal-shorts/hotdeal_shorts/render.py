"""ffmpeg 조립: 화면 PNG(줄별 시간) + 목소리 → final.mp4, 미리보기 gif."""
from __future__ import annotations

import json
import subprocess

from . import audio, config
from .job import Job


def schedule(frames: list[dict], total: float, lead: float) -> list[tuple[str, float]]:
    """각 화면의 표시 시간. 자막을 목소리보다 lead 초 먼저 띄운다."""
    out = []
    for i, f in enumerate(frames):
        start = 0.0 if i == 0 else max(f["start"] - lead, 0.0)
        end = total if i == len(frames) - 1 else max(frames[i + 1]["start"] - lead, start + 0.05)
        out.append((f["path"], round(end - start, 3)))
    return out


def render(job: Job) -> dict:
    fps = config.get("video.fps", 30)
    lead = config.get("subtitle.lead_sec", 0.15)
    frames = json.loads(job.p("frames", "frames.json").read_text(encoding="utf-8"))
    total = len(audio.read_wav(job.p("voice.wav"))) / audio.SR
    sched = schedule(frames, total, lead)

    lst = job.p("frames", "concat.txt")
    with open(lst, "w", encoding="utf-8") as f:
        for path, dur in sched:
            f.write(f"file '{path}'\nduration {dur}\n")
        f.write(f"file '{sched[-1][0]}'\n")  # concat 데모퍼 규칙: 마지막 파일 한 번 더

    render_dir = job.p("render")
    render_dir.mkdir(exist_ok=True)
    out = render_dir / "final.mp4"
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "concat", "-safe", "0", "-i", str(lst),
        "-i", str(job.p("voice.wav")),
        "-vf", f"fps={fps},format=yuv420p",
        "-c:v", "libx264", "-preset", "medium", "-crf", "20",
        "-c:a", "aac", "-b:a", "192k", "-ar", "44100",
        "-shortest", "-movflags", "+faststart", str(out),
    ], check=True)

    # 무음 첫 3초 확인용 gif (올리기 전 점검)
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", "-t", "3", "-i", str(out),
        "-vf", "fps=6,scale=360:-1:flags=lanczos", str(render_dir / "preview_3s.gif"),
    ], check=True)
    return {"path": str(out), "duration": round(total, 2), "frames": len(sched)}


def probe(path) -> dict:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                        "stream=codec_type,width,height,r_frame_rate:format=duration",
                        "-of", "json", str(path)], capture_output=True, text=True, check=True)
    return json.loads(r.stdout)
