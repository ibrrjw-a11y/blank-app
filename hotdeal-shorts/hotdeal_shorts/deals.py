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


# ---------------------------------------------------------------- 토스쇼핑 쉐어링크
# Open API: 결제 금액의 10% 수익. 링크 클릭 후 24시간 안 결제분이 집계된다.
# 구조 출처: 쉐어링크 Open API 를 사용하는 공개 구현 (공식 문서 https://sharelink-docs.toss.im 로 최종 확인 권장)

TOSS_API = "https://sharelink.toss.im/openapi/"
TOSS_TOKEN_URL = "https://oauth2.cert.toss.im/token"


class TossError(RuntimeError):
    pass


class Toss:
    def __init__(self):
        self.access = os.environ.get("TOSS_ACCESS_KEY")
        self.secret = os.environ.get("TOSS_SECRET_KEY")
        self.publisher = os.environ.get("TOSS_PUBLISHER_ID")
        if not (self.access and self.secret and self.publisher):
            raise TossError("TOSS_ACCESS_KEY / TOSS_SECRET_KEY / TOSS_PUBLISHER_ID 가 .env 에 없습니다. "
                            "키가 없으면 쉐어링크 사이트에서 링크를 복사해 CSV 의 affiliate_url 에 넣으세요.")
        self.token_file = config.data_dir() / "toss_token.json"

    # 토큰은 약 1년 유효. 매번 재발급하면 제한되므로 파일에 저장해 재사용한다.
    def _token(self, refresh: bool = False) -> str:
        import json
        if not refresh and self.token_file.exists():
            saved = json.loads(self.token_file.read_text(encoding="utf-8"))
            if saved.get("expires_at", 0) - 7 * 86400 > time.time():
                return saved["access_token"]
        r = requests.post(TOSS_TOKEN_URL, timeout=20, data={
            "grant_type": "client_credentials", "client_id": self.access, "client_secret": self.secret,
            "scope": "sharelink:read sharelink:write"})
        if r.status_code != 200 or not r.json().get("access_token"):
            raise TossError(f"토스 토큰 발급 실패 (HTTP {r.status_code}): {r.text[:200]}")
        data = r.json()
        self.token_file.write_text(json.dumps({
            "access_token": data["access_token"],
            "expires_at": time.time() + int(data.get("expires_in", 0))}), encoding="utf-8")
        return data["access_token"]

    def _call(self, method: str, path: str, params: dict | None = None, body: dict | None = None, _retry=True):
        r = requests.request(method, TOSS_API + path, params=params, json=body, timeout=20,
                             headers={"Authorization": f"Bearer {self._token()}"})
        if r.status_code == 401 and _retry:  # 토큰 만료 → 한 번만 재발급
            self._token(refresh=True)
            return self._call(method, path, params, body, _retry=False)
        try:
            env = r.json()
        except ValueError:
            raise TossError(f"토스 API 응답 형식 아님 (HTTP {r.status_code}): {r.text[:200]}")
        # HTTP 200 이어도 resultType 이 SUCCESS 가 아니면 실패
        if env.get("resultType") != "SUCCESS":
            err = env.get("error") or {}
            raise TossError(f"토스 API 실패 (HTTP {r.status_code}, {err.get('errorCode')}): {err.get('reason')}")
        return env.get("success") or {}

    @staticmethod
    def _to_deal(p: dict, category: str) -> dict:
        pct = p.get("discountRate")
        if pct is not None and 0 < float(pct) <= 1:  # 0.35 형태로 올 경우 대비
            pct = float(pct) * 100
        return normalize({
            "source": "toss",
            "source_id": str(p.get("tacaItemId")),
            "name": p.get("displayName", ""),
            "price": p.get("displayPrice"),
            "original_price": p.get("originalPrice"),
            "discount_pct": pct,
            "url": p.get("productUrl"),        # 추적 없는 일반 링크. 수익 링크는 작업 만들 때 발급
            "image_url": p.get("imageUrl") or p.get("thumbnailUrl"),
            "reviews": p.get("reviewCount"),
            "rating": p.get("reviewScore"),
            "category": category,
            "ends_at": p.get("endAt"),
            "evergreen": 1 if category == "토스 베스트" else 0,
        })

    def _list(self, path: str, size: int, category: str) -> list[dict]:
        items = self._call("GET", path, {"size": size}).get("items", [])
        return [self._to_deal(p, category) for p in items if not p.get("isSoldOut")]

    def best(self, size: int = 50) -> list[dict]:
        return self._list("products/best-selling", size, "토스 베스트")

    def today_deals(self, size: int = 30) -> list[dict]:
        return self._list("products/today-deals", size, "토스 하루특가")

    def link(self, taca_item_id: str) -> str:
        """쉐어링크 발급. 같은 상품을 다시 요청하면 기존 링크가 오고 한도를 쓰지 않는다."""
        out = self._call("POST", "links", body={"tacaItemId": int(taca_item_id), "publisherId": self.publisher})
        url = out.get("shortUrl") or out.get("originUrl")
        if not url:
            raise TossError("토스가 링크를 돌려주지 않음")
        return url


def affiliate_source(deal: dict) -> str:
    """제휴 고지 문구를 고르기 위한 판매처 판별."""
    if deal.get("source") in ("coupang", "toss"):
        return deal["source"]
    link = f"{deal.get('affiliate_url') or ''} {deal.get('url') or ''}"
    if "coupang" in link:
        return "coupang"
    if "toss" in link:
        return "toss"
    return "default"


# ---------------------------------------------------------------- 상품 URL 에서 정보 읽기 (최선 노력)

def _meta(html: str, *names: str) -> str | None:
    import re
    for n in names:
        for pat in (rf'<meta[^>]+(?:property|name|itemprop)=["\']{re.escape(n)}["\'][^>]*content=["\']([^"\']+)',
                    rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]*(?:property|name|itemprop)=["\']{re.escape(n)}["\']'):
            m = re.search(pat, html, re.I)
            if m:
                return m.group(1).strip()
    return None


def _jsonld_product(html: str) -> dict:
    import json
    import re
    for block in re.findall(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>', html, re.S | re.I):
        try:
            data = json.loads(block.strip())
        except ValueError:
            continue
        stack = data if isinstance(data, list) else [data]
        while stack:
            d = stack.pop()
            if isinstance(d, dict):
                if "@graph" in d:
                    stack += d["@graph"]
                if str(d.get("@type", "")).lower() == "product":
                    return d
    return {}


def fetch_url_meta(url: str) -> dict:
    """상품 페이지의 og 태그·구조화 데이터로 이름·이미지·가격을 읽는다.
    쇼핑몰이 막으면 빈 값 → 사람이 직접 입력. 반환: {name, image_url, price, original_price, error}"""
    import html as html_mod
    out: dict = {"url": url}
    try:
        r = requests.get(url, timeout=15, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
                          "Chrome/126.0 Safari/537.36", "Accept-Language": "ko-KR,ko;q=0.9"})
        if r.status_code != 200:
            out["error"] = f"페이지를 못 읽었어요 (HTTP {r.status_code}). 직접 입력해 주세요."
            return out
        page = r.text
    except requests.RequestException as e:
        out["error"] = f"페이지를 못 읽었어요 ({type(e).__name__}). 직접 입력해 주세요."
        return out
    prod = _jsonld_product(page)
    offers = prod.get("offers") or {}
    if isinstance(offers, list):
        offers = offers[0] if offers else {}
    name = prod.get("name") or _meta(page, "og:title", "twitter:title")
    image = prod.get("image") or _meta(page, "og:image", "twitter:image")
    if isinstance(image, list):
        image = image[0] if image else None
    price = offers.get("price") or offers.get("lowPrice") or _meta(page, "product:price:amount", "og:price:amount", "price")
    orig = _meta(page, "product:original_price:amount", "product:sale_price:amount") if price else None
    out.update({"name": html_mod.unescape(name) if name else None, "image_url": image,
                "price": _int(price) if price else None, "original_price": _int(orig) if orig else None})
    if not (out["name"] or out["price"]):
        out["error"] = "상품 정보를 찾지 못했어요. 직접 입력해 주세요."
    return out
