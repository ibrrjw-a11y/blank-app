"""SQLite 저장소: 딜 후보, 영상, 성과 스냅샷."""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime

from . import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS deals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    source_id TEXT,
    name TEXT NOT NULL,
    price INTEGER,
    original_price INTEGER,
    discount_pct REAL,
    url TEXT,
    affiliate_url TEXT,
    image_url TEXT,
    reviews INTEGER,
    rating REAL,
    category TEXT,
    ends_at TEXT,
    evergreen INTEGER DEFAULT 0,
    note TEXT,
    score REAL,
    status TEXT DEFAULT 'new',
    fetched_at TEXT NOT NULL,
    UNIQUE(source, source_id)
);
CREATE TABLE IF NOT EXISTS videos (
    job TEXT PRIMARY KEY,
    deal_id INTEGER,
    title TEXT,
    hook_type TEXT,
    youtube_id TEXT,
    published_at TEXT
);
CREATE TABLE IF NOT EXISTS metrics (
    job TEXT NOT NULL,
    taken_at TEXT NOT NULL,
    views INTEGER,
    likes INTEGER,
    comments INTEGER,
    buy_intent INTEGER,
    avg_view_pct REAL,
    extra TEXT
);
"""


@contextmanager
def connect():
    conn = sqlite3.connect(config.data_dir() / "db.sqlite")
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def upsert_deal(conn, d: dict) -> int:
    cols = ["source", "source_id", "name", "price", "original_price", "discount_pct", "url",
            "affiliate_url", "image_url", "reviews", "rating", "category", "ends_at",
            "evergreen", "note", "score"]
    vals = [d.get(c) for c in cols]
    conn.execute(
        f"INSERT INTO deals ({','.join(cols)}, fetched_at) VALUES ({','.join('?' * len(cols))}, ?) "
        "ON CONFLICT(source, source_id) DO UPDATE SET "
        + ",".join(f"{c}=excluded.{c}" for c in cols if c not in ("source", "source_id"))
        + ", fetched_at=excluded.fetched_at",
        [*vals, now()],
    )
    row = conn.execute("SELECT id FROM deals WHERE source=? AND source_id=?",
                       (d["source"], d.get("source_id"))).fetchone()
    return row["id"]


def get_deal(conn, deal_id: int) -> dict | None:
    row = conn.execute("SELECT * FROM deals WHERE id=?", (deal_id,)).fetchone()
    return dict(row) if row else None


def save_metrics(conn, job: str, m: dict) -> None:
    conn.execute(
        "INSERT INTO metrics (job, taken_at, views, likes, comments, buy_intent, avg_view_pct, extra) "
        "VALUES (?,?,?,?,?,?,?,?)",
        (job, now(), m.get("views"), m.get("likes"), m.get("comments"), m.get("buy_intent"),
         m.get("avg_view_pct"), json.dumps(m.get("extra") or {}, ensure_ascii=False)),
    )
