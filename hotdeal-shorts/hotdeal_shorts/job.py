"""편당 작업 폴더와 상태(job.json)."""
from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path

from . import config

STEPS = ["script", "voice", "frames", "render", "publish_text"]


def slugify(name: str) -> str:
    s = re.sub(r"[^0-9A-Za-z가-힣]+", "", name)[:16]
    return s or "deal"


class Job:
    def __init__(self, path: Path):
        self.path = path

    @property
    def id(self) -> str:
        return self.path.name

    # ---------------------------------------------------------- 파일 경로
    def p(self, *parts: str) -> Path:
        return self.path.joinpath(*parts)

    @property
    def deal(self) -> dict:
        return json.loads(self.p("deal.json").read_text(encoding="utf-8"))

    # ---------------------------------------------------------- 상태
    @property
    def state(self) -> dict:
        f = self.p("job.json")
        return json.loads(f.read_text(encoding="utf-8")) if f.exists() else {"steps": {}, "errors": []}

    def mark(self, step: str, status: str, **info) -> None:
        st = self.state
        st["steps"][step] = {"status": status, "at": datetime.now().isoformat(timespec="seconds"), **info}
        self.p("job.json").write_text(json.dumps(st, ensure_ascii=False, indent=2), encoding="utf-8")

    def error(self, step: str, msg: str) -> None:
        st = self.state
        st["errors"].append({"step": step, "msg": msg, "at": datetime.now().isoformat(timespec="seconds")})
        self.p("job.json").write_text(json.dumps(st, ensure_ascii=False, indent=2), encoding="utf-8")

    def log(self, msg: str) -> None:
        with open(self.p("job.log"), "a", encoding="utf-8") as f:
            f.write(f"[{datetime.now():%H:%M:%S}] {msg}\n")


def create(deal: dict, slug: str | None = None) -> Job:
    base = f"{datetime.now():%Y%m%d}_{slug or slugify(deal['name'])}"
    path = config.jobs_dir() / base
    n = 2
    while path.exists():
        path = config.jobs_dir() / f"{base}_{n}"
        n += 1
    path.mkdir(parents=True)
    deal = {**deal, "checked_at": deal.get("checked_at") or datetime.now().strftime("%m월 %d일 %H시")}
    (path / "deal.json").write_text(json.dumps(deal, ensure_ascii=False, indent=2), encoding="utf-8")
    job = Job(path)
    job.mark("created", "done")
    return job


def load(job_id: str) -> Job:
    p = Path(job_id)
    if not p.exists():
        p = config.jobs_dir() / job_id
    if not (p / "deal.json").exists():
        raise FileNotFoundError(f"작업 폴더를 찾을 수 없음: {job_id}")
    return Job(p)
