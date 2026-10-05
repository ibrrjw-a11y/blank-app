// 거리·중간지점 계산과 SVG 미니맵 (타일 서버 없이 그리는 양식화된 지도)
import { STATIONS } from "./data.js";

const R = 6371; // km

export function distanceKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function fmtDist(km) {
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)}m`;
  if (km < 10) return `${km.toFixed(1)}km`;
  return `${Math.round(km)}km`;
}

// 도보 시간 대략치 (분당 약 70m, 직선거리 기준)
export const walkMin = (km) => Math.max(1, Math.round((km * 1000) / 70));

// 무게중심: 3차원 단위벡터 평균 (먼 도시 사이에서도 안전)
export function centroid(points) {
  let x = 0, y = 0, z = 0;
  points.forEach((p) => {
    const la = (p.lat * Math.PI) / 180;
    const lo = (p.lon * Math.PI) / 180;
    x += Math.cos(la) * Math.cos(lo);
    y += Math.cos(la) * Math.sin(lo);
    z += Math.sin(la);
  });
  const n = points.length;
  x /= n; y /= n; z /= n;
  const lon = Math.atan2(y, x);
  const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
  return { lat: (lat * 180) / Math.PI, lon: (lon * 180) / Math.PI };
}

export function nearestStation(pt, list = STATIONS) {
  let best = null;
  let bestD = Infinity;
  list.forEach((s) => {
    const d = distanceKm(pt, s);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  });
  return best ? { ...best, dist: bestD } : null;
}

// 중간지점: 무게중심 → 가장 가까운 역
export function computeMidpoint(people) {
  const located = people.filter((p) => p.loc);
  if (located.length < 2) return null;
  const c = centroid(located.map((p) => p.loc));
  const station = nearestStation(c);
  const legs = located.map((p) => ({ person: p, km: distanceKm(p.loc, station) }));
  return { center: c, station, legs, maxKm: Math.max(...legs.map((l) => l.km)) };
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// 미니맵 SVG 문자열. 색은 CSS 클래스(토큰)로 칠한다.
export function miniMapSVG(mid, { w = 340, h = 230 } = {}) {
  const pts = [...mid.legs.map((l) => l.person.loc), mid.station, mid.center];
  const lat0 = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const proj = (p) => ({ x: p.lon * k, y: -p.lat });
  const P = pts.map(proj);
  let minX = Math.min(...P.map((p) => p.x)), maxX = Math.max(...P.map((p) => p.x));
  let minY = Math.min(...P.map((p) => p.y)), maxY = Math.max(...P.map((p) => p.y));
  const span = Math.max(maxX - minX, maxY - minY, 0.004);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const padX = 46, padY = 40;
  const scale = Math.min((w - padX * 2) / Math.max(maxX - minX, span * 0.35), (h - padY * 2) / Math.max(maxY - minY, span * 0.35));
  const toXY = (p) => {
    const q = proj(p);
    return { x: w / 2 + (q.x - cx) * scale, y: h / 2 + (q.y - cy) * scale };
  };
  const S = toXY(mid.station);
  const C = toXY(mid.center);

  // 축척 막대: 1km 단위로 적당히
  const kmPerPx = 111.32 / scale; // 위도 1도 ≈ 111.32km
  const niceKm = [0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200].find((v) => v / kmPerPx >= 40) || 200;
  const barPx = niceKm / kmPerPx;

  const grid = [];
  for (let x = 20; x < w; x += 40) grid.push(`<line x1="${x}" y1="0" x2="${x}" y2="${h}"/>`);
  for (let y = 15; y < h; y += 40) grid.push(`<line x1="0" y1="${y}" x2="${w}" y2="${y}"/>`);

  const legs = mid.legs
    .map((l, i) => {
      const A = toXY(l.person.loc);
      const mx = (A.x + S.x) / 2, my = (A.y + S.y) / 2;
      const label = fmtDist(l.km);
      const lw = label.length * 6.4 + 12;
      return `
      <line class="mm-leg" x1="${A.x.toFixed(1)}" y1="${A.y.toFixed(1)}" x2="${S.x.toFixed(1)}" y2="${S.y.toFixed(1)}" style="--c: var(--pc-${i % 6})"/>
      <g class="mm-dist" transform="translate(${mx.toFixed(1)} ${my.toFixed(1)})">
        <rect x="${-lw / 2}" y="-9" width="${lw}" height="18" rx="9"/>
        <text y="4" text-anchor="middle">${label}</text>
      </g>`;
    })
    .join("");

  const pins = mid.legs
    .map((l, i) => {
      const A = toXY(l.person.loc);
      const initial = esc((l.person.name || "?").slice(0, 1));
      return `
      <g transform="translate(${A.x.toFixed(1)} ${A.y.toFixed(1)})"><g class="mm-pin" style="--c: var(--pc-${i % 6}); --d: ${i * 90}ms">
        <circle r="13"/>
        <text y="4.5" text-anchor="middle">${initial}</text>
      </g></g>`;
    })
    .join("");

  return `<svg class="minimap" viewBox="0 0 ${w} ${h}" role="img" aria-label="참가자 위치와 중간지점 ${esc(mid.station.name)}을 그린 약도">
    <rect class="mm-bg" x="0" y="0" width="${w}" height="${h}" rx="16"/>
    <g class="mm-grid">${grid.join("")}</g>
    ${legs}
    <circle class="mm-center" cx="${C.x.toFixed(1)}" cy="${C.y.toFixed(1)}" r="4"/>
    <g transform="translate(${S.x.toFixed(1)} ${S.y.toFixed(1)})">
      <circle class="mm-glow" r="22"/>
      <circle class="mm-mid" r="10"/>
      <text class="mm-mid-ic" y="4" text-anchor="middle">★</text>
    </g>
    ${pins}
    <g class="mm-scale" transform="translate(14 ${h - 16})">
      <line x1="0" y1="0" x2="${barPx.toFixed(1)}" y2="0"/>
      <text x="${(barPx + 6).toFixed(1)}" y="4">${niceKm < 1 ? niceKm * 1000 + "m" : niceKm + "km"}</text>
    </g>
    <text class="mm-n" x="${w - 18}" y="24" text-anchor="middle">N↑</text>
  </svg>`;
}
