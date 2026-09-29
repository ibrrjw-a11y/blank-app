"""성과 수집(YouTube Data API) + 진단 + 주간 리포트 + 훅 학습."""
from __future__ import annotations

import csv
import json
import os
import random
from datetime import datetime
from pathlib import Path

import requests

from . import config, db

YT = "https://www.googleapis.com/youtube/v3"


class MetricsError(RuntimeError):
    pass


def _key() -> str:
    k = os.environ.get("YOUTUBE_API_KEY")
    if not k:
        raise MetricsError("YOUTUBE_API_KEY 가 .env 에 없습니다. 키 없이 쓰려면 "
                           "`hd metrics import 파일.csv` 로 스튜디오 수치를 넣으세요.")
    return k


def fetch_stats(video_ids: list[str]) -> dict[str, dict]:
    out = {}
    for i in range(0, len(video_ids), 50):
        r = requests.get(f"{YT}/videos", params={"part": "statistics,snippet", "id": ",".join(video_ids[i:i + 50]),
                                                 "key": _key()}, timeout=20)
        if r.status_code != 200:
            raise MetricsError(f"YouTube API {r.status_code}: {r.text[:300]}")
        for it in r.json().get("items", []):
            st = it.get("statistics", {})
            out[it["id"]] = {"views": int(st.get("viewCount", 0)), "likes": int(st.get("likeCount", 0)),
                             "comments": int(st.get("commentCount", 0)),
                             "published_at": it["snippet"].get("publishedAt")}
    return out


def fetch_comments(video_id: str, limit: int = 200) -> list[str]:
    texts, token = [], None
    while len(texts) < limit:
        params = {"part": "snippet", "videoId": video_id, "maxResults": 100, "textFormat": "plainText",
                  "key": _key()}
        if token:
            params["pageToken"] = token
        r = requests.get(f"{YT}/commentThreads", params=params, timeout=20)
        if r.status_code == 403:  # 댓글 사용 중지 영상
            break
        if r.status_code != 200:
            raise MetricsError(f"YouTube API {r.status_code}: {r.text[:300]}")
        data = r.json()
        texts += [it["snippet"]["topLevelComment"]["snippet"]["textDisplay"] for it in data.get("items", [])]
        token = data.get("nextPageToken")
        if not token:
            break
    return texts


def buy_intent(comments: list[str]) -> int:
    kws = config.get("metrics.buy_intent_keywords", [])
    return sum(1 for c in comments if any(k in c for k in kws))


# ------------------------------------------------------------------ 수집

def pull(job: str | None = None) -> list[dict]:
    with db.connect() as conn:
        q = "SELECT job, youtube_id FROM videos WHERE youtube_id IS NOT NULL"
        rows = conn.execute(q + (" AND job=?" if job else ""), (job,) if job else ()).fetchall()
        if not rows:
            raise MetricsError("등록된 영상이 없습니다. 먼저 `hd video add <작업> --youtube-id <ID>`")
        stats = fetch_stats([r["youtube_id"] for r in rows])
        results = []
        for r in rows:
            st = stats.get(r["youtube_id"])
            if not st:
                continue
            comments = fetch_comments(r["youtube_id"]) if st["comments"] else []
            m = {**st, "buy_intent": buy_intent(comments)}
            db.save_metrics(conn, r["job"], m)
            results.append({"job": r["job"], **m})
        return results


def import_csv(path: Path) -> int:
    """스튜디오에서 옮겨 적은 수치: job,views,likes,comments,buy_intent,avg_view_pct"""
    n = 0
    with open(path, encoding="utf-8-sig", newline="") as f, db.connect() as conn:
        for r in csv.DictReader(f):
            m = {k: (float(r[k]) if k == "avg_view_pct" else int(float(r[k])))
                 for k in ("views", "likes", "comments", "buy_intent", "avg_view_pct") if r.get(k)}
            db.save_metrics(conn, r["job"], m)
            n += 1
    return n


# ------------------------------------------------------------------ 분석

def latest(conn) -> list[dict]:
    rows = conn.execute("""
        SELECT v.job, v.title, v.hook_type, v.youtube_id, m.views, m.likes, m.comments, m.buy_intent,
               m.avg_view_pct, m.taken_at
        FROM videos v JOIN metrics m ON m.job = v.job
        WHERE m.taken_at = (SELECT MAX(taken_at) FROM metrics WHERE job = v.job)
        ORDER BY m.taken_at DESC""").fetchall()
    out = [dict(r) for r in rows]
    views = [r["views"] or 0 for r in out]
    avg = sum(views) / len(views) if views else 0
    for r in out:
        r["multiplier"] = round((r["views"] or 0) / avg, 2) if avg else None
        r["diagnosis"] = diagnose(r)
    return out


def diagnose(r: dict) -> str:
    mult, pct, intent = r.get("multiplier"), r.get("avg_view_pct"), r.get("buy_intent") or 0
    if pct is not None and pct < 50:
        return "첫 3초 이탈: 첫 문장(훅) 바꾸기"
    if pct is not None and pct < 75:
        return "중간 이탈: 줄 순서·길이 문제, 반전을 앞으로"
    if mult is not None and mult >= config.get("metrics.winner_multiplier", 3.0):
        return "터짐: 같은 구조로 상품만 바꿔 3편 더"
    if mult is not None and mult >= 1 and intent == 0:
        return "봤는데 안 삼: 상품(가격대·필요성) 문제"
    if mult is not None and mult >= 1:
        return "평균 이상: 구조 유지, 훅 유형만 바꿔 실험"
    if mult is not None and mult < 1:
        return "노출 부족: 훅 유형 바꾸거나 올리는 시간 바꾸기"
    return "데이터 부족"


def hook_weights() -> dict[str, float]:
    """훅 유형별 평균 배수. 데이터가 없는 유형은 1.0 (탐색 기회 보장)."""
    from .script import HOOK_TYPES
    w = {h: [] for h in HOOK_TYPES}
    try:
        with db.connect() as conn:
            for r in latest(conn):
                if r["hook_type"] in w and r["multiplier"] is not None:
                    w[r["hook_type"]].append(r["multiplier"])
    except Exception:  # noqa: BLE001
        pass
    return {h: (sum(v) / len(v) if v else 1.0) for h, v in w.items()}


def pick_hook() -> str:
    """성과 좋은 훅을 더 자주, 하지만 20%는 무작위로 탐색."""
    w = hook_weights()
    if random.random() < 0.2:
        return random.choice(list(w))
    return random.choices(list(w), weights=[max(v, 0.1) for v in w.values()])[0]


def weekly_report() -> Path:
    with db.connect() as conn:
        rows = latest(conn)
    out_dir = config.home() / "reports"
    out_dir.mkdir(exist_ok=True)
    path = out_dir / f"{datetime.now():%Y-W%V}.md"
    md = [f"# 주간 리포트 {datetime.now():%Y-%m-%d}", "", f"영상 {len(rows)}편", ""]
    if rows:
        md += ["| 작업 | 제목 | 훅 | 조회 | 배수 | 구매의도 댓글 | 진단 |", "|---|---|---|---|---|---|---|"]
        for r in rows:
            md.append(f"| {r['job']} | {r['title']} | {r['hook_type']} | {r['views'] or 0:,} | "
                      f"{r['multiplier']} | {r['buy_intent'] or 0} | {r['diagnosis']} |")
        md += ["", "## 훅 유형별 평균 배수 (다음 대본 생성 시 가중치로 사용)", ""]
        md += [f"- {h}: {v:.2f}" for h, v in sorted(hook_weights().items(), key=lambda x: -x[1])]
        winners = [r for r in rows if (r["multiplier"] or 0) >= config.get("metrics.winner_multiplier", 3.0)]
        md += ["", "## 이번 주 고칠 것 1개", ""]
        if winners:
            md.append(f"- 터진 영상 `{winners[0]['job']}` 구조로 상품만 바꿔 3편 더 만들기")
        else:
            worst = min(rows, key=lambda r: r["multiplier"] or 0)
            md.append(f"- `{worst['job']}`: {worst['diagnosis']}")
    md += ["", "※ 30편 전까지는 결론 내리지 말고 쌓기만 하기"]
    path.write_text("\n".join(md) + "\n", encoding="utf-8")
    return path


def dump(rows: list[dict]) -> str:
    return json.dumps(rows, ensure_ascii=False, indent=2)
