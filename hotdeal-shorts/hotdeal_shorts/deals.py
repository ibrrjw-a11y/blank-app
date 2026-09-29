"""딜 수집·점수화: CSV 수동 입력 + 쿠팡파트너스 Open API."""
from __future__ import annotations

import csv
import hashlib
import hmac
import math
import os
import time
from pathlib import Path
from urllib.parse import urlencode

import requests

from . import config

COUPANG_HOST = "https://api-gateway.coupang.com"
COUPANG_BASE = "/v2/providers/affiliate_open_api/apis/openapi/v1"

CSV_FIELDS = ["name", "price", "original_price", "url", "affiliate_url", "image_url",
              "reviews", "rating", "category", "ends_at", "evergreen", "note"]


def _int(v):
    if v in (None, ""):
        return None
    return int(float(str(v).replace(",", "").replace("원", "").strip()))


def _float(v):
    if v in (None, ""):
        return None
    return float(str(v).replace("%", "").strip())


def normalize(d: dict) -> dict:
    """가격·할인율 정리. 정가만 있고 할인율이 없으면 계산한다."""
    d = dict(d)
    d["price"] = _int(d.get("price"))
    d["original_price"] = _int(d.get("original_price"))
    d["reviews"] = _int(d.get("reviews"))
    d["rating"] = _float(d.get("rating"))
    d["evergreen"] = 1 if str(d.get("evergreen", "")).strip().lower() in ("1", "true", "y", "yes", "o") else 0
    pct = _float(d.get("discount_pct"))
    if pct is None and d["price"] and d["original_price"] and d["original_price"] > d["price"]:
        pct = round((1 - d["price"] / d["original_price"]) * 100, 1)
    d["discount_pct"] = pct
    if not d.get("source_id"):
        d["source_id"] = hashlib.sha1((d.get("url") or d["name"]).encode()).hexdigest()[:12]
    return d


def score(d: dict) -> tuple[float, list[str]]:
    """0~100 점수와 탈락/감점 사유. 사유에 '탈락'이 있으면 후보 제외."""
    reasons: list[str] = []
    lo, hi = config.get("deals.price_range_krw", [5000, 150000])
    min_pct = config.get("deals.min_discount_pct", 30)
    min_rev = config.get("deals.min_reviews", 100)
    s = 0.0

    pct = d.get("discount_pct")
    if pct is None:
        reasons.append("할인율 모름(정가 입력 권장)")
        s += 15
    elif pct < min_pct:
        reasons.append(f"탈락: 할인율 {pct:.0f}% < {min_pct}%")
    else:
        s += min(45, pct * 0.75)

    price = d.get("price")
    if price is None:
        reasons.append("탈락: 가격 없음")
    elif not lo <= price <= hi:
        reasons.append(f"탈락: 가격 {price:,}원이 {lo:,}~{hi:,}원 범위 밖")
    else:
        # 1~5만원이 충동구매 최적 구간
        s += 25 if 10000 <= price <= 50000 else 15

    rev = d.get("reviews")
    if rev is not None:
        if rev < min_rev:
            reasons.append(f"탈락: 리뷰 {rev}개 < {min_rev}개")
        else:
            s += min(20, 5 * math.log10(max(rev, 1)))
    if d.get("rating") is not None and d["rating"] < 4.0:
        reasons.append(f"감점: 평점 {d['rating']}")
        s -= 10
    if d.get("evergreen"):
        s += 10
        reasons.append("상시형(딜 끝나도 팔리는 상품)")
    return round(max(0.0, s), 1), reasons


def import_csv(path: Path) -> list[dict]:
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = [r for r in csv.DictReader(f) if (r.get("name") or "").strip()]
    out = []
    for r in rows:
        d = normalize({**r, "source": "manual"})
        d["score"], why = score(d)
        d["_reasons"] = why
        out.append(d)
    return out


def write_csv_template(path: Path) -> None:
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(CSV_FIELDS)
        w.writerow(["예시) 무선 핸디 청소기", "39900", "89000", "https://www.coupang.com/vp/products/...",
                    "https://link.coupang.com/a/...", "", "2400", "4.7", "가전", "2026-10-01 23:59", "0",
                    "뽐뿌 핫딜 게시판에서 발견"])


# ---------------------------------------------------------------- 쿠팡파트너스

class CoupangError(RuntimeError):
    pass


def coupang_signature(method: str, path: str, query: str, secret: str, signed_date: str) -> str:
    message = signed_date + method + path + query
    return hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()


def coupang_auth_header(method: str, path: str, query: str, access: str, secret: str,
                        signed_date: str | None = None) -> str:
    signed_date = signed_date or time.strftime("%y%m%dT%H%M%SZ", time.gmtime())
    sig = coupang_signature(method, path, query, secret, signed_date)
    return (f"CEA algorithm=HmacSHA256, access-key={access}, "
            f"signed-date={signed_date}, signature={sig}")


class Coupang:
    def __init__(self):
        self.access = os.environ.get("COUPANG_ACCESS_KEY")
        self.secret = os.environ.get("COUPANG_SECRET_KEY")
        if not (self.access and self.secret):
            raise CoupangError("COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY 가 .env 에 없습니다. "
                               "키가 없으면 `hd deals import 파일.csv` 로 수동 입력하세요.")
        self.sub_id = config.get("deals.coupang_sub_id", "hotdealshorts")

    def _call(self, method: str, path: str, params: dict | None = None, body: dict | None = None):
        full = COUPANG_BASE + path
        query = urlencode(params or {})
        headers = {"Authorization": coupang_auth_header(method, full, query, self.access, self.secret),
                   "Content-Type": "application/json;charset=UTF-8"}
        url = COUPANG_HOST + full + (f"?{query}" if query else "")
        r = requests.request(method, url, headers=headers, json=body, timeout=20)
        if r.status_code != 200:
            raise CoupangError(f"쿠팡 API {r.status_code}: {r.text[:300]}")
        data = r.json()
        if str(data.get("rCode", "0")) != "0":
            raise CoupangError(f"쿠팡 API 오류: {data.get('rMessage')}")
        return data.get("data")

    @staticmethod
    def _to_deal(p: dict, category: str = "") -> dict:
        return normalize({
            "source": "coupang",
            "source_id": str(p.get("productId")),
            "name": p.get("productName", ""),
            "price": p.get("productPrice"),
            "original_price": p.get("originalPrice") or p.get("basePrice"),
            "discount_pct": p.get("discountRate"),
            "url": p.get("productUrl"),
            "affiliate_url": p.get("productUrl"),  # 파트너스 API가 주는 URL은 이미 수익 링크
            "image_url": p.get("productImage"),
            "category": p.get("categoryName") or category,
            "evergreen": 0,
        })

    def goldbox(self) -> list[dict]:
        data = self._call("GET", "/products/goldbox", {"subId": self.sub_id}) or []
        return [self._to_deal(p, "골드박스") for p in data]

    def search(self, keyword: str, limit: int = 10) -> list[dict]:
        data = self._call("GET", "/products/search",
                          {"keyword": keyword, "limit": limit, "subId": self.sub_id}) or {}
        items = data.get("productData", []) if isinstance(data, dict) else data
        return [self._to_deal(p, keyword) for p in items]

    def deeplink(self, urls: list[str]) -> dict[str, str]:
        data = self._call("POST", "/deeplink", body={"coupangUrls": urls, "subId": self.sub_id}) or []
        return {d["originalUrl"]: d["shortenUrl"] for d in data}
