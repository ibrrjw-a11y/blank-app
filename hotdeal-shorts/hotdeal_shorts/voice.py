"""TTS: 줄 단위로 합성해서 정확한 자막 타이밍을 얻는다."""
from __future__ import annotations

import asyncio
import hashlib
import json
import os
import re
import shutil
import ssl
import subprocess
from pathlib import Path

import numpy as np
import requests

from . import audio, config
from . import tts_providers
from .korean_num import to_speech
from .job import Job


class TTSError(RuntimeError):
    pass


# ------------------------------------------------------------------ 프로바이더

def _edge_setup():
    import edge_tts
    import edge_tts.communicate as ec

    # 회사/학교 프록시처럼 사설 인증서가 필요한 환경 대응
    ca = os.environ.get("SSL_CERT_FILE") or os.environ.get("REQUESTS_CA_BUNDLE")
    if ca and Path(ca).exists():
        ctx = ssl.create_default_context()
        ctx.load_verify_locations(ca)
        ec._SSL_CTX = ctx
    return edge_tts


def _edge_stream(text: str, out: Path) -> list[dict]:
    """전체 대본을 한 번에 합성하고 단어별 시각(WordBoundary)을 받는다."""
    edge_tts = _edge_setup()

    async def run():
        c = edge_tts.Communicate(text, config.get("voice.edge_voice", "ko-KR-SunHiNeural"),
                                 rate=config.get("voice.rate", "+15%"), boundary="WordBoundary",
                                 proxy=os.environ.get("HTTPS_PROXY") or None)
        words = []
        with open(out, "wb") as f:
            async for chunk in c.stream():
                if chunk["type"] == "audio":
                    f.write(chunk["data"])
                elif chunk["type"] == "WordBoundary":
                    # offset·duration 단위는 100ns
                    words.append({"text": chunk["text"], "start": chunk["offset"] / 1e7,
                                  "end": (chunk["offset"] + chunk["duration"]) / 1e7})
        return words

    try:
        words = asyncio.run(run())
    except Exception as e:  # noqa: BLE001 - 네트워크/인증서 등 원인이 다양함
        raise TTSError(f"edge-tts 실패: {e}. 인터넷 연결을 확인하거나 config.yaml 에서 "
                       "voice.provider 를 sherpa/espeak 또는 manual 로 바꾸세요.") from e
    if not out.exists() or out.stat().st_size == 0:
        raise TTSError("edge-tts 가 빈 파일을 반환함")
    return words


def _edge(text: str, out: Path) -> None:
    _edge_stream(text, out)


def _norm(t: str) -> str:
    return re.sub(r"[^0-9A-Za-z가-힣]", "", t)


def map_words_to_lines(lines: list[str], words: list[dict]) -> list[tuple[float, float]] | None:
    """단어 시각을 글자 수 누적으로 대본 줄에 배정. 크게 어긋나면 None."""
    targets, acc = [], 0
    for ln in lines:
        acc += len(_norm(ln))
        targets.append(acc)
    spans: list[list[float]] = [[] for _ in lines]
    acc, li = 0, 0
    for w in words:
        n = len(_norm(w["text"]))
        if n == 0:
            continue
        # 단어 중간 지점이 속한 줄에 배정
        mid = acc + n / 2
        while li < len(lines) - 1 and mid > targets[li]:
            li += 1
        spans[li] += [w["start"], w["end"]]
        acc += n
    if not targets or abs(acc - targets[-1]) > max(3, 0.1 * targets[-1]) or any(not sp for sp in spans):
        return None
    return [(min(sp), max(sp)) for sp in spans]


def _speakable(line: str) -> str:
    """줄 끝에 문장부호가 없으면 마침표를 붙여 문장 억양이 자연스럽게 끝나게 한다."""
    return line if re.search(r"[.!?~…]$", line) else line + "."


def _espeak(text: str, out: Path) -> None:
    exe = shutil.which("espeak-ng") or shutil.which("espeak")
    if not exe:
        raise TTSError("espeak-ng 가 설치되어 있지 않음")
    subprocess.run([exe, "-v", "ko", "-s", "190", "-w", str(out), text], check=True)


SHERPA_URL = ("https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/"
              "vits-mimic3-ko_KO-kss_low.tar.bz2")
_sherpa_tts = None


def sherpa_model_dir() -> Path:
    return config.home() / "models" / "vits-mimic3-ko_KO-kss_low"


def download_sherpa_model() -> Path:
    """오프라인 한국어 AI 음성 모델(약 60MB) 내려받기."""
    import tarfile

    import requests
    d = sherpa_model_dir()
    if (d / "ko_KO-kss_low.onnx").exists():
        return d
    d.parent.mkdir(parents=True, exist_ok=True)
    tar = d.parent / "model.tar.bz2"
    with requests.get(SHERPA_URL, stream=True, timeout=60) as r:
        r.raise_for_status()
        with open(tar, "wb") as f:
            for chunk in r.iter_content(1 << 20):
                f.write(chunk)
    with tarfile.open(tar) as t:
        t.extractall(d.parent)
    tar.unlink()
    return d


def _sherpa(text: str, out: Path) -> None:
    global _sherpa_tts
    try:
        import sherpa_onnx
    except ImportError as e:
        raise TTSError("pip install sherpa-onnx 후 `hd voice setup-offline` 을 실행하세요") from e
    d = sherpa_model_dir()
    if not (d / "ko_KO-kss_low.onnx").exists():
        raise TTSError("오프라인 음성 모델이 없음. `hd voice setup-offline` 을 먼저 실행하세요")
    if _sherpa_tts is None:
        _sherpa_tts = sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(
            model=sherpa_onnx.OfflineTtsModelConfig(
                vits=sherpa_onnx.OfflineTtsVitsModelConfig(
                    model=str(d / "ko_KO-kss_low.onnx"), tokens=str(d / "tokens.txt"),
                    data_dir=str(d / "espeak-ng-data")),
                num_threads=4)))
    a = _sherpa_tts.generate(text, sid=0, speed=config.get("voice.offline_speed", 1.1))
    y = (np.clip(np.array(a.samples), -1, 1) * 32767).astype(np.int16)
    import wave
    with wave.open(str(out), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(a.sample_rate)
        w.writeframes(y.tobytes())


def _cloud(fn):
    """클라우드 TTS 오류를 TTSError 로 바꿔 build 가 깔끔하게 멈추게 한다."""
    def run(text: str, out: Path):
        try:
            return fn(text, out)
        except (tts_providers.CloudTTSError, requests.RequestException) as e:
            raise TTSError(str(e)) from e
    return run


PROVIDERS = {"edge": _edge, "sherpa": _sherpa, "espeak": _espeak,
             **{k: _cloud(f) for k, f in tts_providers.LINE.items()}}
# 대본 전체를 한 번에 합성 + 단어 시각을 주는 프로바이더 (억양이 자연스럽게 이어짐)
WHOLE = {"edge": _edge_stream, **{k: _cloud(f) for k, f in tts_providers.WHOLE.items()}}


def voice_key(provider: str) -> str:
    """캐시 키: 프로바이더와 그 목소리 설정이 바뀌면 다시 합성."""
    c = config.get("voice") or {}
    detail = c.get(provider) if isinstance(c.get(provider), dict) else {}
    return json.dumps([provider, c.get("edge_voice"), c.get("rate"), detail], sort_keys=True, ensure_ascii=False)


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

    if provider in WHOLE and config.get("voice.whole_script", True):
        res = _whole(job, lines, tail, provider)
        if res:
            return res
        job.log("단어 시각이 대본과 맞지 않아 줄 단위 합성으로 전환")

    fn = PROVIDERS.get(provider)
    if fn is None:
        raise TTSError(f"알 수 없는 voice.provider: {provider}")

    chunks, align, t = [], [], 0.0
    raw_total, cuts_total = 0.0, 0
    for i, line in enumerate(lines):
        # 대본·목소리 설정이 바뀌면 다시 합성, 같으면 재사용
        key = f"v3|{voice_key(provider)}|{line}"
        h = hashlib.sha1(key.encode()).hexdigest()[:8]
        src = tmp / f"line_{i:03d}_{h}.{'wav' if provider in ('sherpa', 'espeak') else 'mp3'}"
        if not src.exists():
            fn(to_speech(_speakable(line)), src)
        wav = tmp / f"line_{i:03d}_{h}_n.wav"
        audio.to_wav(src, wav)
        x = audio.read_wav(wav)
        raw_total += len(x) / audio.SR
        y = audio.trim_edges(x)
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
    y, cuts, removed = audio.tighten(x, db=db, pad=pad, max_gap=0.25)
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


def _whole(job: Job, lines: list[str], tail: float, provider: str) -> dict | None:
    key = voice_key(provider) + "|" + "\n".join(lines)
    h = hashlib.sha1(key.encode()).hexdigest()[:8]
    src = job.p("voice_parts", f"whole_{h}.mp3")
    meta = job.p("voice_parts", f"whole_{h}.json")
    if src.exists() and meta.exists():
        words = json.loads(meta.read_text(encoding="utf-8"))
    else:
        words = WHOLE[provider](" ".join(to_speech(_speakable(ln)) for ln in lines), src)
        meta.write_text(json.dumps(words, ensure_ascii=False), encoding="utf-8")
    spans = map_words_to_lines([to_speech(ln) for ln in lines], words)
    if spans is None:
        return None
    wav = job.p("voice_parts", f"whole_{h}_n.wav")
    audio.to_wav(src, wav)
    x = audio.read_wav(wav)
    # 앞 무음만 잘라내고 시각을 그만큼 당긴다 (문장 사이 자연스러운 쉼은 유지)
    lead = max(spans[0][0] - 0.05, 0.0)
    x = x[int(lead * audio.SR):]
    end = spans[-1][1] - lead
    x = x[: int((end + 0.1) * audio.SR)]
    out = np.concatenate([x, audio.silence(tail)])
    audio.write_wav(job.p("voice.wav"), out)
    align = [{"idx": i, "text": ln, "start": round(a - lead, 3), "end": round(b - lead, 3)}
             for i, (ln, (a, b)) in enumerate(zip(lines, spans))]
    stats = {"provider": f"{provider}(whole)", "raw_sec": round(len(x) / audio.SR + lead, 2),
             "final_sec": round(len(out) / audio.SR, 2), "cuts": 0, "lines": len(lines)}
    job.p("align.json").write_text(json.dumps({"lines": align, "stats": stats}, ensure_ascii=False, indent=2),
                                   encoding="utf-8")
    return stats
