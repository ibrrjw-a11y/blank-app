"""TTS: 줄 단위로 합성해서 정확한 자막 타이밍을 얻는다."""
from __future__ import annotations

import asyncio
import hashlib
import json
import os
import shutil
import ssl
import subprocess
from pathlib import Path

import numpy as np

from . import audio, config
from .job import Job


class TTSError(RuntimeError):
    pass


# ------------------------------------------------------------------ 프로바이더

def _edge(text: str, out: Path) -> None:
    import edge_tts
    import edge_tts.communicate as ec

    # 회사/학교 프록시처럼 사설 인증서가 필요한 환경 대응
    ca = os.environ.get("SSL_CERT_FILE") or os.environ.get("REQUESTS_CA_BUNDLE")
    if ca and Path(ca).exists():
        ctx = ssl.create_default_context()
        ctx.load_verify_locations(ca)
        ec._SSL_CTX = ctx

    async def run():
        c = edge_tts.Communicate(text, config.get("voice.edge_voice", "ko-KR-SunHiNeural"),
                                 rate=config.get("voice.rate", "+15%"),
                                 proxy=os.environ.get("HTTPS_PROXY") or None)
        await c.save(str(out))

    try:
        asyncio.run(run())
    except Exception as e:  # noqa: BLE001 - 네트워크/인증서 등 원인이 다양함
        raise TTSError(f"edge-tts 실패: {e}. 인터넷 연결을 확인하거나 config.yaml 에서 "
                       "voice.provider 를 espeak(테스트용) 또는 manual 로 바꾸세요.") from e
    if not out.exists() or out.stat().st_size == 0:
        raise TTSError("edge-tts 가 빈 파일을 반환함")


def _espeak(text: str, out: Path) -> None:
    exe = shutil.which("espeak-ng") or shutil.which("espeak")
    if not exe:
        raise TTSError("espeak-ng 가 설치되어 있지 않음")
    subprocess.run([exe, "-v", "ko", "-s", "190", "-w", str(out), text], check=True)


PROVIDERS = {"edge": _edge, "espeak": _espeak}


# ------------------------------------------------------------------ 합성

def synthesize(job: Job, lines: list[str], provider: str | None = None) -> dict:
    provider = provider or config.get("voice.provider", "edge")
    db = config.get("voice.silence_db", -35)
    pad = config.get("voice.pad_sec", 0.03)
    gap = config.get("video.line_gap_sec", 0.08)
    tail = config.get("video.tail_sec", 0.6)
    tmp = job.p("voice_parts")
    tmp.mkdir(exist_ok=True)

    manual = sorted(job.path.glob("voice_raw.*"))
    if provider == "manual" or manual:
        if not manual:
            raise TTSError(f"manual 모드: {job.path}/voice_raw.mp3 (또는 .wav) 파일을 넣고 다시 실행하세요.")
        return _from_single_file(job, lines, manual[0], db, pad, tail)

    fn = PROVIDERS.get(provider)
    if fn is None:
        raise TTSError(f"알 수 없는 voice.provider: {provider}")

    chunks, align, t = [], [], 0.0
    raw_total, cuts_total = 0.0, 0
    for i, line in enumerate(lines):
        # 대본·목소리 설정이 바뀌면 다시 합성, 같으면 재사용
        key = f"{provider}|{config.get('voice.edge_voice')}|{config.get('voice.rate')}|{line}"
        h = hashlib.sha1(key.encode()).hexdigest()[:8]
        src = tmp / f"line_{i:03d}_{h}.{'mp3' if provider == 'edge' else 'wav'}"
        if not src.exists():
            fn(line, src)
        wav = tmp / f"line_{i:03d}_{h}_n.wav"
        audio.to_wav(src, wav)
        x = audio.read_wav(wav)
        raw_total += len(x) / audio.SR
        y, cuts, _ = audio.tighten(x, db=db, pad=pad, max_gap=0.18)
        cuts_total += cuts
        dur = len(y) / audio.SR
        align.append({"idx": i, "text": line, "start": round(t, 3), "end": round(t + dur, 3)})
        chunks += [y, audio.silence(gap)]
        t += dur + gap
    chunks.append(audio.silence(tail))
    out = np.concatenate(chunks)
    audio.write_wav(job.p("voice.wav"), out)
    total = len(out) / audio.SR
    stats = {"provider": provider, "raw_sec": round(raw_total, 2), "final_sec": round(total, 2),
             "cuts": cuts_total, "lines": len(lines)}
    job.p("align.json").write_text(json.dumps({"lines": align, "stats": stats}, ensure_ascii=False, indent=2),
                                   encoding="utf-8")
    return stats


def _from_single_file(job: Job, lines: list[str], src: Path, db: float, pad: float, tail: float) -> dict:
    """사람이 넣은 녹음/외부 TTS 파일 1개: 무음 정리 후 글자 수 비례로 줄 시간을 나눈다.
    (정확도가 필요하면 줄마다 파일을 나눠 voice_parts/line_000.wav ... 로 넣어도 됨)"""
    wav = job.p("voice_parts", "manual_n.wav")
    audio.to_wav(src, wav)
    x = audio.read_wav(wav)
    y, cuts, removed = audio.tighten(x, db=db, pad=pad, max_gap=0.10)
    dur = len(y) / audio.SR
    weights = [max(len(ln.replace(" ", "")), 1) for ln in lines]
    total_w = sum(weights)
    align, t = [], 0.0
    for i, (ln, w) in enumerate(zip(lines, weights)):
        d = dur * w / total_w
        align.append({"idx": i, "text": ln, "start": round(t, 3), "end": round(t + d, 3)})
        t += d
    out = np.concatenate([y, audio.silence(tail)])
    audio.write_wav(job.p("voice.wav"), out)
    stats = {"provider": "manual", "raw_sec": round(len(x) / audio.SR, 2), "final_sec": round(len(out) / audio.SR, 2),
             "cuts": cuts, "lines": len(lines), "note": "글자 수 비례 타이밍(근사치)"}
    job.p("align.json").write_text(json.dumps({"lines": align, "stats": stats}, ensure_ascii=False, indent=2),
                                   encoding="utf-8")
    return stats
