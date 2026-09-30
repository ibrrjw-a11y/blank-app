"""채널 프로필: 채널마다 이름·레이아웃·색·글꼴·목소리·해시태그를 통째로 바꾼다.

config.yaml 의 channels: 아래에 채널별로 적고, 작업(job.json 의 channel)마다 어느 채널용인지 고른다.
빌드하는 동안만 설정을 덮어쓰고 끝나면 되돌린다 (config.yaml 파일은 그대로).
"""
from __future__ import annotations

from contextlib import contextmanager

from . import config


def all_profiles() -> dict[str, dict]:
    return config.get("channels") or {}


def default_id() -> str | None:
    ids = list(all_profiles())
    d = config.get("default_channel")
    return d if d in ids else (ids[0] if ids else None)


@contextmanager
def applied(channel_id: str | None):
    cfg = config.cfg()
    prof = all_profiles().get(channel_id or default_id() or "")
    saved = {k: (dict(cfg[k]) if isinstance(cfg.get(k), dict) else cfg.get(k))
             for k in ("channel", "video", "voice", "publish")}
    if prof:
        cfg["channel"] = {**(cfg.get("channel") or {}),
                          **{k: v for k, v in prof.items() if k not in ("fonts", "colors", "voice", "hashtags")},
                          **(prof.get("colors") or {})}
        fonts = prof.get("fonts") or {}
        cfg["video"] = {**(cfg.get("video") or {}),
                        "font": fonts.get("bold", ""), "font_regular": fonts.get("regular", "")}
        if prof.get("voice"):
            cfg["voice"] = {**(cfg.get("voice") or {}), **prof["voice"]}
        if prof.get("hashtags"):
            cfg["publish"] = {**(cfg.get("publish") or {}), "hashtags": prof["hashtags"]}
    try:
        yield prof
    finally:
        for k, v in saved.items():
            if v is None:
                cfg.pop(k, None)
            else:
                cfg[k] = v
