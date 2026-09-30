"""게시글형 화면 색 테마. 영상마다 골라 쓸 수 있다 (job.json 의 theme)."""
from __future__ import annotations

from contextlib import contextmanager

from . import config

THEMES = {
    "노랑": {"color": "#FFE08A", "label_bg": "#FFF1C2", "price_color": "#FF3B30"},
    "핑크": {"color": "#FFC4D6", "label_bg": "#FFE3EC", "price_color": "#E5245E"},
    "민트": {"color": "#B8EBD5", "label_bg": "#E1F7ED", "price_color": "#0F9D6B"},
    "하늘": {"color": "#BCDCFF", "label_bg": "#E3F0FF", "price_color": "#1B6FE0"},
    "보라": {"color": "#D9CCFF", "label_bg": "#EEE8FF", "price_color": "#7A3FF2"},
    "주황": {"color": "#FFC999", "label_bg": "#FFE6D1", "price_color": "#E8590C"},
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
