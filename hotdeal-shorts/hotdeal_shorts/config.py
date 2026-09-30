"""config.yaml + .env 로딩."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

import yaml


def home() -> Path:
    """작업 루트: HD_HOME 환경변수 > config.yaml 이 있는 현재/상위 폴더."""
    if os.environ.get("HD_HOME"):
        return Path(os.environ["HD_HOME"]).resolve()
    cur = Path.cwd().resolve()
    for p in (cur, *cur.parents):
        if (p / "config.yaml").exists():
            return p
    return cur


def read_text_any(path: Path) -> str:
    """메모장이 어떤 인코딩(UTF-8/BOM, 유니코드=UTF-16, ANSI=CP949)으로 저장해도 읽는다."""
    raw = path.read_bytes()
    if raw.startswith((b"\xff\xfe", b"\xfe\xff")):
        return raw.decode("utf-16")
    for enc in ("utf-8-sig", "cp949"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def load_env(path: Path) -> None:
    """최소 .env 파서. 이미 설정된 환경변수는 덮어쓰지 않는다."""
    if not path.exists():
        return
    for raw in read_text_any(path).splitlines():
        line = raw.strip()
        if line.lower().startswith("export "):
            line = line[7:].strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        val = val.strip().strip('"').strip("'").strip()
        if val:
            os.environ.setdefault(key.strip(), val)


@lru_cache(maxsize=1)
def cfg() -> dict:
    root = home()
    load_env(root / ".env")
    path = root / "config.yaml"
    data = yaml.safe_load(path.read_text(encoding="utf-8")) if path.exists() else {}
    return data or {}


def get(dotted: str, default=None):
    cur = cfg()
    for part in dotted.split("."):
        if not isinstance(cur, dict) or part not in cur:
            return default
        cur = cur[part]
    return cur


def jobs_dir() -> Path:
    d = home() / "jobs"
    d.mkdir(exist_ok=True)
    return d


def data_dir() -> Path:
    d = home() / "data"
    d.mkdir(exist_ok=True)
    return d
