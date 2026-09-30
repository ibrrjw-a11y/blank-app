"""색 테마: 채널 기본색 대신 영상마다 다른 색을 쓰고 싶을 때 (job.json 의 theme). 비우면 채널 색."""
from __future__ import annotations

from contextlib import contextmanager

from . import config

THEMES = {
    "노랑": {"color": "#F2A541", "sub": "#FFE8C2", "accent": "#D9480F"},
    "핑크": {"color": "#F07AA0", "sub": "#FFE0EA", "accent": "#C2255C"},
    "민트": {"color": "#38B28A", "sub": "#D5F5E8", "accent": "#0B7A55"},
    "하늘": {"color": "#4C8DF6", "sub": "#DCEAFF", "accent": "#1B5FD0"},
    "보라": {"color": "#8A63F2", "sub": "#E9E1FF", "accent": "#6230D8"},
    "라임": {"color": "#111317", "sub": "#2A2E36", "accent": "#B6FF3B"},
}


@contextmanager
def applied(name: str | None):
    """빌드하는 동안만 채널 색을 테마로 바꾼다 (config.yaml 파일은 그대로)."""
    cfg = config.cfg()
    before = dict(cfg.get("channel") or {})
    if name and name in THEMES:
        cfg["channel"] = {**before, **THEMES[name]}
    try:
        yield
    finally:
        cfg["channel"] = before
