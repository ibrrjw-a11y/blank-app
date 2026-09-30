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
# Open API (공식 문서 https://sharelink-docs.toss.im). 결제 금액의 10% 수익, 링크 클릭 후 24시간 안 결제분 집계.
# 사람이 먼저 할 것: API 사용 승인 신청 · 키 발급 · publisherId 확인 · **호출하는 PC의 공인 IP 등록** ·
# 활동 채널(유튜브 채널) 등록. 공인 IP 가 등록 안 돼 있으면 모든 호출이 ACCESS_DENIED.
# 하루 한도: 응답으로 받은 상품 수 10,000개 + 새로 발급한 링크 10,000개 (호출 횟수 아님).

TOSS_API = "https://sharelink.toss.im/openapi/"
TOSS_TOKEN_URL = "https://oauth2.cert.toss.im/token"
TOSS_ENDING_MARGIN_MIN = 10          # 종료 10분 이내 특가는 버림 (눌렀을 때 정상가)
TOSS_SAME_ITEM_HOURS = 24            # 같은 상품이 24시간 안에 이미 들어왔으면 버림


class TossError(RuntimeError):
    pass


class TossQuotaExceeded(TossError):
    pass


class TossLinkBlocked(TossError):
    """링크 발급이 막힌 상품 (200 + FAIL + errorCode 없이 reason 만 옴)."""


def _kst_today() -> str:
    from datetime import datetime, timedelta, timezone
    return datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d")


def _parse_end(value: str | None):
    """endAt(ISO 8601, 시간대 없으면 한국 시간) → aware datetime."""
    from datetime import datetime, timedelta, timezone
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone(timedelta(hours=9)))


class Toss:
    def __init__(self):
        self.access = os.environ.get("TOSS_ACCESS_KEY")
        self.secret = os.environ.get("TOSS_SECRET_KEY")
        self.publisher = os.environ.get("TOSS_PUBLISHER_ID")
        if not (self.access and self.secret and self.publisher):
            raise TossError("TOSS_ACCESS_KEY / TOSS_SECRET_KEY / TOSS_PUBLISHER_ID 가 .env 에 없습니다. "
                            "키가 없으면 쉐어링크 사이트에서 링크를 복사해 딜의 수익 링크 칸에 넣으세요.")
        self.token_file = config.data_dir() / "toss_token.json"
        self.sleep = time.sleep  # 테스트에서 바꿔 끼움

    # ---------------------------------------------------------- 토큰: 약 1년 유효, 파일에 저장해 재사용
    def _token(self, refresh: bool = False) -> str:
        import json
        if not refresh and self.token_file.exists():
            saved = json.loads(self.token_file.read_text(encoding="utf-8"))
            if saved.get("access_key") == self.access and saved.get("expires_at", 0) - 86400 > time.time():
                return saved["access_token"]
        r = requests.post(TOSS_TOKEN_URL, timeout=20, data={
            "grant_type": "client_credentials", "client_id": self.access, "client_secret": self.secret,
            "scope": "sharelink:read sharelink:write"})
        if r.status_code != 200 or not r.json().get("access_token"):
            raise TossError(f"토스 토큰 발급 실패 (HTTP {r.status_code}): {r.text[:200]}")
        data = r.json()
        self.token_file.write_text(json.dumps({
            "access_key": self.access, "access_token": data["access_token"],
            "expires_at": time.time() + int(data.get("expires_in", 0))}), encoding="utf-8")
        return data["access_token"]

    # ---------------------------------------------------------- 하루 사용량 (한국 날짜별)
    def _usage(self, **inc) -> dict:
        from . import db
        with db.connect() as conn:
            conn.execute("CREATE TABLE IF NOT EXISTS toss_usage (day TEXT PRIMARY KEY, items_fetched INTEGER "
                         "DEFAULT 0, links_issued INTEGER DEFAULT 0, items_quota_hit INTEGER DEFAULT 0, "
                         "links_quota_hit INTEGER DEFAULT 0, last_error TEXT)")
            day = _kst_today()
            conn.execute("INSERT OR IGNORE INTO toss_usage (day) VALUES (?)", (day,))
            for k, v in inc.items():
                if k == "last_error":
                    conn.execute("UPDATE toss_usage SET last_error=? WHERE day=?", (v, day))
                elif k.endswith("_hit"):
                    conn.execute(f"UPDATE toss_usage SET {k}=1 WHERE day=?", (day,))
                else:
                    conn.execute(f"UPDATE toss_usage SET {k}={k}+? WHERE day=?", (v, day))
            return dict(conn.execute("SELECT * FROM toss_usage WHERE day=?", (day,)).fetchone())

    # ---------------------------------------------------------- 공통 호출 (공통 응답 규약·재시도)
    def _call(self, method: str, path: str, params: dict | None = None, body: dict | None = None):
        refreshed = False
        last = "NETWORK"
        for attempt in range(4):
            try:
                r = requests.request(method, TOSS_API + path, params=params, json=body, timeout=20,
                                     headers={"Authorization": f"Bearer {self._token()}"})
            except requests.RequestException as e:
                last = f"NETWORK {type(e).__name__}"
                self.sleep(2 ** attempt)
                continue
            if r.status_code == 401 and not refreshed:  # 토큰 만료 → 한 번만 재발급
                refreshed = True
                self._token(refresh=True)
                continue
            if r.status_code == 429:
                self.sleep(float(r.headers.get("Retry-After", 2 ** attempt)))
                continue
            if r.status_code >= 500:
                last = f"HTTP {r.status_code}"
                self.sleep(2 ** attempt)
                continue
            try:
                env = r.json()
            except ValueError:
                raise TossError(f"토스 API 응답 형식 아님 (HTTP {r.status_code}): {r.text[:200]}")
            if env.get("resultType") == "SUCCESS":  # HTTP 200 이어도 FAIL 이면 실패
                return env.get("success") or {}
            err = env.get("error") or {}
            code, reason = str(err.get("errorCode") or ""), err.get("reason") or ""
            if code == "500":
                last = "토스 서버 오류"
                self.sleep(2 ** attempt)
                continue
            if code == "SHARELINK_OPENAPI_QUOTA_EXCEEDED":
                self._usage(**{("links_quota_hit" if path == "links" else "items_quota_hit"): 1,
                               "last_error": code})
                raise TossQuotaExceeded("토스 하루 한도 초과 — 한국 시간 자정까지 멈춥니다")
            if not code and path == "links":
                raise TossLinkBlocked(reason or "링크 발급이 제한된 상품")
            hint = " (공인 IP 등록·키·publisherId 확인)" if code == "SHARELINK_OPENAPI_ACCESS_DENIED" else ""
            self._usage(last_error=f"{code} {reason}"[:200])
            raise TossError(f"토스 API 실패 {code}{hint}: {reason}")
        raise TossError(f"토스 API 재시도 실패: {last}")

    # ---------------------------------------------------------- 상품 목록
    def _to_deal(self, p: dict, category: str, source_kind: str) -> dict:
        pct = p.get("discountRate")
        use_thumb = config.get("deals.toss_use_thumbnails", False)
        d = normalize({
            "source": "toss",
            "source_id": str(p.get("tacaItemId")),
            "name": (p.get("displayName") or "").strip(),
            "price": p.get("displayPrice"),            # 배송비 포함 가격
            "original_price": p.get("originalPrice"),
            "discount_pct": pct if isinstance(pct, (int, float)) and not isinstance(pct, bool) else None,
            "url": p.get("productUrl"),                # 추적 없는 일반 링크 (수익 안 잡힘). 수익 링크는 따로 발급
            # 토스 썸네일을 외부(영상)에 쓰는 건 사전 확인 대상 → 기본은 저장 안 함
            "image_url": p.get("thumbnailUrl") if use_thumb else None,
            "reviews": p.get("reviewCount") if isinstance(p.get("reviewCount"), int) else None,
            "rating": p.get("reviewScore") if isinstance(p.get("reviewScore"), (int, float)) else None,
            "category": category,
            "ends_at": p.get("endAt"),
            "evergreen": 1 if source_kind == "best" else 0,
            "note": "토스 가격은 배송비 포함",
        })
        return d

    def _keep(self, p: dict) -> bool:
        from datetime import datetime, timedelta, timezone
        tid = p.get("tacaItemId")
        if not isinstance(tid, int) and not str(tid or "").isdigit():
            return False
        if p.get("isSoldOut") or not (p.get("displayName") or "").strip():
            return False
        end = _parse_end(p.get("endAt"))
        if end and end <= datetime.now(timezone.utc) + timedelta(minutes=TOSS_ENDING_MARGIN_MIN):
            return False
        return True

    def _recent_ids(self) -> set[str]:
        from datetime import datetime, timedelta
        from . import db
        since = (datetime.now() - timedelta(hours=TOSS_SAME_ITEM_HOURS)).isoformat(timespec="seconds")
        with db.connect() as conn:
            rows = conn.execute("SELECT source_id FROM deals WHERE source='toss' AND fetched_at>=?", (since,))
            return {r["source_id"] for r in rows}

    def _list(self, path: str, size: int, category: str, kind: str, max_pages: int = 1) -> list[dict]:
        if self._usage().get("items_quota_hit"):
            raise TossQuotaExceeded("오늘 토스 상품 조회 한도를 이미 다 썼어요 (한국 시간 자정에 풀림)")
        items, cursor = [], None
        for _ in range(max_pages):
            params = {"size": size, **({"cursor": cursor} if cursor else {})}
            page = self._call("GET", path, params)
            got = page.get("items", [])
            self._usage(items_fetched=len(got))
            items += got
            if not page.get("hasNext") or not page.get("nextCursor"):
                break
            cursor = page["nextCursor"]
        recent = self._recent_ids()
        return [self._to_deal(p, category, kind) for p in items
                if self._keep(p) and str(p.get("tacaItemId")) not in recent]

    def best(self, size: int = 30) -> list[dict]:
        return self._list("products/best-selling", min(size, 100), "토스 베스트", "best")

    def today_deals(self, size: int = 30, pages: int = 1) -> list[dict]:
        return self._list("products/today-deals", min(size, 30), "토스 하루특가", "today", pages)

    def category_best(self, category_id: str, size: int = 10) -> list[dict]:
        return self._list(f"products/best-categories/{category_id}", size, f"토스 카테고리 {category_id}", "best")

    # ---------------------------------------------------------- 쉐어링크 발급 (채널별 subTag, 캐시)
    def link(self, taca_item_id: str, subtag: str | None = None) -> str:
        """같은 (상품, publisherId, subTag) 는 기존 링크 재사용 → 한도 안 씀. subTag 로 채널별 실적 구분."""
        from . import db
        with db.connect() as conn:
            conn.execute("CREATE TABLE IF NOT EXISTS toss_links (taca_item_id TEXT, subtag TEXT, short_url TEXT, "
                         "origin_url TEXT, PRIMARY KEY (taca_item_id, subtag))")
            row = conn.execute("SELECT short_url, origin_url FROM toss_links WHERE taca_item_id=? AND subtag=?",
                               (str(taca_item_id), subtag or "")).fetchone()
        if row:
            return row["short_url"] or row["origin_url"]
        if self._usage().get("links_quota_hit"):
            raise TossQuotaExceeded("오늘 토스 링크 발급 한도를 이미 다 썼어요 (한국 시간 자정에 풀림)")
        body = {"tacaItemId": int(taca_item_id), "publisherId": self.publisher,
                **({"subTagId": subtag} if subtag else {})}
        try:
            out = self._call("POST", "links", body=body)
        except TossLinkBlocked:
            with db.connect() as conn:
                conn.execute("UPDATE deals SET status='link_blocked' WHERE source='toss' AND source_id=?",
                             (str(taca_item_id),))
            raise
        except TossError as e:
            if not subtag or "ACCESS_DENIED" not in str(e):
                raise
            self._call("POST", "sub-tags/create", body={"subTagId": subtag, "label": subtag,
                                                         "publisherId": self.publisher})
            out = self._call("POST", "links", body=body)
        url = out.get("shortUrl") or out.get("originUrl")
        if not url:
            raise TossError("토스가 링크를 돌려주지 않음")
        with db.connect() as conn:
            conn.execute("INSERT OR REPLACE INTO toss_links VALUES (?,?,?,?)",
                         (str(taca_item_id), subtag or "", out.get("shortUrl"), out.get("originUrl")))
        self._usage(links_issued=1)
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
