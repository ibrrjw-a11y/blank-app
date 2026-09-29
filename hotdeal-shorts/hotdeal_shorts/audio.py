"""wav 입출력과 무음 처리 (numpy 만 사용)."""
from __future__ import annotations

import subprocess
import wave
from pathlib import Path

import numpy as np

SR = 44100


def to_wav(src: Path, dst: Path) -> None:
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-ac", "1", "-ar", str(SR),
                    "-sample_fmt", "s16", str(dst)], check=True)


def read_wav(path: Path) -> np.ndarray:
    with wave.open(str(path)) as w:
        assert w.getframerate() == SR and w.getnchannels() == 1, "to_wav 로 먼저 변환해야 함"
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768


def write_wav(path: Path, x: np.ndarray) -> None:
    y = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(y.tobytes())


def _loud_mask(x: np.ndarray, db: float, win: int = 441) -> np.ndarray:
    """10ms 창 단위 RMS가 임계(dBFS)보다 큰 창 = True."""
    n = len(x) // win
    if n == 0:
        return np.zeros(0, dtype=bool)
    frames = x[: n * win].reshape(n, win)
    rms = np.sqrt(np.mean(frames ** 2, axis=1) + 1e-12)
    return 20 * np.log10(rms) > db


def tighten(x: np.ndarray, db: float = -35, pad: float = 0.03, max_gap: float = 0.10) -> tuple[np.ndarray, int, float]:
    """앞뒤 무음 제거 + 내부 무음을 max_gap 초로 줄임.
    반환: (결과, 줄인 구간 수, 줄인 초)."""
    win = 441
    mask = _loud_mask(x, db, win)
    if not mask.any():
        return x[:0], 0, len(x) / SR
    idx = np.flatnonzero(mask)
    pad_w = int(pad * SR / win)
    first, last = max(idx[0] - pad_w, 0), min(idx[-1] + pad_w + 1, len(mask))
    keep = []
    cut_count, gap_w = 0, int(max_gap * SR / win)
    run_start = None
    for i in range(first, last):
        if not mask[i]:
            if run_start is None:
                run_start = i
            continue
        if run_start is not None:
            run = i - run_start
            if run > gap_w:
                keep.extend(range(run_start, run_start + gap_w // 2))
                keep.extend(range(i - gap_w // 2, i))
                cut_count += 1
            else:
                keep.extend(range(run_start, i))
            run_start = None
        keep.append(i)
    if run_start is not None:
        keep.extend(range(run_start, last))
    out = np.concatenate([x[k * win:(k + 1) * win] for k in keep]) if keep else x[:0]
    removed = (len(x) - len(out)) / SR
    return out, cut_count, removed


def silence(sec: float) -> np.ndarray:
    return np.zeros(int(sec * SR), dtype=np.float32)
