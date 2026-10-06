// 데이터 레이어 어댑터
//  A) catalog  : 내장 메뉴/카페/놀거리 (항상 동작)
//  B) overpass : OpenStreetMap 근처 실제 가게 (6초 타임아웃, 실패 시 A로)
//  C) kakao    : config.js 에 kakaoJsKey 가 있을 때만 카카오 장소 검색
//  D) weather  : Open-Meteo 현재 날씨 (실패 시 조용히 무시)
import { MENUS, CAFES, PLAYS, CUISINE_MAP, AMENITY_FALLBACK, KAKAO_GROUP } from "./data.js";
import { distanceKm } from "./geo.js";

/* ---------- 공통 ---------- */
async function fetchWithTimeout(url, opts = {}, ms = 6000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

let configPromise;
export function loadConfig() {
  configPromise ??= import("./config.js").then(
    (m) => ({ kakaoJsKey: String(m.kakaoJsKey || "").trim() }),
    () => ({ kakaoJsKey: "" })
  );
  return configPromise;
}

/* ---------- A) 내장 카탈로그 ---------- */
export const catalogAdapter = {
  name: "catalog",
  list(stage) {
    if (stage === "cafe") return CAFES.map((x) => ({ ...x, kind: "cafe", key: x.id, c: "카페", g: "카페", src: "catalog" }));
    if (stage === "play") return PLAYS.map((x) => ({ ...x, kind: "play", key: x.id, c: "놀거리", g: "놀거리", src: "catalog" }));
    const list = stage === "meal" ? MENUS.filter((m) => m.d) : MENUS;
    return list.map((x) => ({ ...x, kind: "menu", key: x.id, c: x.g, src: "catalog", q: x.n }));
  },
  byId(id) {
    const m = MENUS.find((x) => x.id === id);
    if (m) return { ...m, kind: "menu", key: m.id, c: m.g, src: "catalog", q: m.n };
    const c = CAFES.find((x) => x.id === id);
    if (c) return { ...c, kind: "cafe", key: c.id, c: "카페", g: "카페", src: "catalog" };
    const p = PLAYS.find((x) => x.id === id);
    if (p) return { ...p, kind: "play", key: p.id, c: "놀거리", g: "놀거리", src: "catalog" };
    return null;
  },
};

/* ---------- B) OpenStreetMap Overpass ---------- */
const AMENITIES = {
  food: ["restaurant", "fast_food"],
  group: ["restaurant", "fast_food", "pub", "bar"],
  cafe: ["cafe"],
};

function osmToItem(el, origin) {
  const tg = el.tags || {};
  const name = tg["name:ko"] || tg.name;
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (!name || lat == null || lon == null) return null;
  const cuisines = String(tg.cuisine || "")
    .toLowerCase()
    .split(/[;,]/)
    .map((s) => s.trim());
  const hit = cuisines.map((c) => CUISINE_MAP[c]).find(Boolean) || AMENITY_FALLBACK[tg.amenity] || AMENITY_FALLBACK.restaurant;
  return {
    key: `osm-${el.type}-${el.id}`,
    kind: "place",
    src: "osm",
    n: name,
    e: hit.e,
    c: hit.c,
    g: hit.g,
    t: hit.t.slice(),
    p: null,
    q: name,
    lat,
    lon,
    dist: distanceKm(origin, { lat, lon }),
  };
}

export const overpassAdapter = {
  name: "osm",
  async nearby({ lat, lon, radius = 800, kind = "food" }) {
    const am = (AMENITIES[kind] || AMENITIES.food).join("|");
    const q = `[out:json][timeout:6];nwr["amenity"~"^(${am})$"]["name"](around:${Math.round(radius)},${lat.toFixed(5)},${lon.toFixed(5)});out center 150;`;
    // 무료 서버는 바쁘면 거절하므로 다른 서버로 한 번 더(2026-10-06). 각 5초
    let json = null;
    for (const host of ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"]) {
      try {
        json = await fetchWithTimeout(host, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "data=" + encodeURIComponent(q) }, 5000);
        if (json && Array.isArray(json.elements)) break;
      } catch { json = null; }
    }
    if (!json) throw new Error("overpass unavailable");
    const seen = new Set();
    return (json.elements || [])
      .map((el) => osmToItem(el, { lat, lon }))
      .filter((x) => x && !seen.has(x.n) && seen.add(x.n))
      .sort((a, b) => a.dist - b.dist);
  },
};

/* ---------- C) 카카오 장소 검색 (선택) ---------- */
let kakaoPromise;
function loadKakaoSDK(key) {
  kakaoPromise ??= new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 6000);
    const s = document.createElement("script");
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services&autoload=false`;
    s.async = true;
    s.onload = () => {
      try {
        window.kakao.maps.load(() => {
          clearTimeout(timer);
          resolve(window.kakao?.maps?.services ? window.kakao : null);
        });
      } catch {
        clearTimeout(timer);
        resolve(null);
      }
    };
    s.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    document.head.appendChild(s);
  });
  return kakaoPromise;
}

function kakaoCall(kakao, method, arg, opts, pages = 2) {
  const svc = kakao.maps.services;
  const ps = new svc.Places();
  return new Promise((resolve) => {
    const out = [];
    let n = 0;
    const timer = setTimeout(() => resolve(out), 6000);
    const cb = (data, status, pagination) => {
      n++;
      if (status === svc.Status.OK) out.push(...data);
      if (status === svc.Status.OK && pagination?.hasNextPage && n < pages) pagination.nextPage();
      else {
        clearTimeout(timer);
        resolve(out);
      }
    };
    ps[method](arg, cb, opts);
  });
}

function kakaoToItem(d) {
  const parts = String(d.category_name || "").split(">").map((s) => s.trim());
  const g = parts[1] || parts[0] || "음식점";
  const c = parts[parts.length - 1] || g;
  return {
    key: `kakao-${d.id}`,
    kind: "place",
    src: "kakao",
    n: d.place_name,
    e: KAKAO_GROUP[g] || KAKAO_GROUP[c] || "🍽️",
    c,
    g,
    t: [],
    p: null,
    q: d.place_name,
    lat: Number(d.y),
    lon: Number(d.x),
    dist: d.distance ? Number(d.distance) / 1000 : null,
    url: d.place_url,
  };
}

export const kakaoAdapter = {
  name: "kakao",
  async ready() {
    const { kakaoJsKey } = await loadConfig();
    if (!kakaoJsKey) return null;
    return loadKakaoSDK(kakaoJsKey);
  },
  async nearby({ lat, lon, radius = 800, kind = "food" }) {
    const kakao = await this.ready();
    if (!kakao) throw new Error("kakao unavailable");
    const opts = {
      location: new kakao.maps.LatLng(lat, lon),
      radius: Math.min(20000, Math.round(radius)),
      sort: kakao.maps.services.SortBy.DISTANCE,
    };
    const code = kind === "cafe" ? "CE7" : "FD6";
    const docs = await kakaoCall(kakao, "categorySearch", code, opts, 3);
    const seen = new Set();
    return docs.map(kakaoToItem).filter((x) => !seen.has(x.n) && seen.add(x.n));
  },
  async keyword({ query, lat, lon, radius = 1500 }) {
    const kakao = await this.ready();
    if (!kakao) throw new Error("kakao unavailable");
    const opts = lat != null ? { location: new kakao.maps.LatLng(lat, lon), radius, sort: kakao.maps.services.SortBy.DISTANCE } : {};
    const docs = await kakaoCall(kakao, "keywordSearch", query, opts, 1);
    return docs.map(kakaoToItem);
  },
};

/* ---------- 근처 가게: 카카오 → OSM → (호출부에서 카탈로그) ---------- */
const nearbyCache = new Map();
export async function getNearbyPlaces({ lat, lon, radius, kind }) {
  const ck = `${kind}:${radius}:${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (nearbyCache.has(ck)) return nearbyCache.get(ck);
  let result = { items: [], source: "none" };
  try {
    const items = await kakaoAdapter.nearby({ lat, lon, radius, kind });
    if (items.length) result = { items, source: "kakao" };
  } catch {
    /* 키 없음 또는 실패 → OSM */
  }
  if (!result.items.length) {
    try {
      const items = await overpassAdapter.nearby({ lat, lon, radius, kind });
      result = { items, source: items.length ? "osm" : "empty" };
    } catch {
      result = { items: [], source: "failed" };
    }
  }
  if (result.items.length) nearbyCache.set(ck, result);
  return result;
}

// 메뉴 우승 후 "근처에서 이 메뉴 파는 곳": 카카오 키워드 → 이미 불러온 OSM 같은 분류
export async function findMenuNearby(item, { lat, lon }) {
  try {
    const items = await kakaoAdapter.keyword({ query: item.q || item.n, lat, lon });
    if (items.length) return { items: items.slice(0, 5), source: "kakao", exact: true };
  } catch {
    /* noop */
  }
  for (const [, r] of nearbyCache) {
    const same = r.items.filter((p) => p.g === item.g || p.n.includes(item.n));
    if (same.length) return { items: same.slice(0, 5), source: r.source, exact: false };
  }
  return { items: [], source: "none" };
}

/* ---------- D) 날씨 (Open-Meteo) ---------- */
const weatherCache = new Map();
export async function getWeather({ lat, lon }) {
  const ck = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  if (weatherCache.has(ck)) return weatherCache.get(ck);
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&current=temperature_2m,precipitation&timezone=Asia%2FSeoul`;
    const j = await fetchWithTimeout(url, {}, 5000);
    const temp = Number(j?.current?.temperature_2m);
    const precip = Number(j?.current?.precipitation);
    if (!Number.isFinite(temp)) return null;
    const w = {
      temp,
      precip: Number.isFinite(precip) ? precip : 0,
      rainy: precip > 0,
      cold: temp <= 5,
      hot: temp >= 28,
    };
    weatherCache.set(ck, w);
    return w;
  } catch {
    return null;
  }
}

/* ---------- 지도 링크 ---------- */
export function mapLinks(item, near) {
  const q = item.kind === "place" ? item.n : `${near ? near.replace(/\s*\(.*\)$/, "") + " " : ""}${item.q || item.n}`;
  const links = {
    kakao: `https://map.kakao.com/link/search/${encodeURIComponent(q)}`,
    naver: `https://map.naver.com/p/search/${encodeURIComponent(q)}`,
  };
  if (item.lat != null && item.lon != null) {
    links.route = `https://map.kakao.com/link/to/${encodeURIComponent(item.n)},${item.lat},${item.lon}`;
  }
  if (item.url) links.detail = item.url;
  return links;
}
