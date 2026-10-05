// 화면 조각: 숫자 슬롯 롤, 5각형 레이더, 기록 꺾은선 (모두 SVG/DOM, 색은 CSS 토큰)
import { prefersReducedMotion } from "../shared/kit.js";
import { KEYS, META } from "./scoring.js";

/* ---------- 슬롯처럼 굴러가는 숫자 ---------- */
const REPEAT = 3;
export function rollMarkup(n, label = `${n}`) {
  const digits = String(n).split("");
  return `<span class="roll t-num" aria-label="${label}">${digits
    .map(
      () =>
        `<span class="roll__col" aria-hidden="true"><span class="roll__strip">${Array.from({ length: 10 * REPEAT }, (_, i) => `<span>${i % 10}</span>`).join("")}</span></span>`
    )
    .join("")}</span>`;
}

export function rollTo(el, n, { delay = 0, duration = 1600 } = {}) {
  const digits = String(n).split("").map(Number);
  const strips = [...el.querySelectorAll(".roll__strip")];
  const reduce = prefersReducedMotion();
  strips.forEach((s, i) => {
    s.style.transition = "none";
    s.style.transform = "translateY(0)";
    void s.offsetWidth;
    const target = (REPEAT - 1) * 10 + digits[i];
    const apply = () => {
      s.style.transition = reduce ? "none" : `transform ${duration + i * 280}ms cubic-bezier(.12,.75,.18,1)`;
      s.style.transform = `translateY(${-target}em)`;
    };
    if (reduce) apply();
    else setTimeout(apply, delay + 30);
  });
}

/* ---------- 5각형 레이더 ---------- */
// skills: {rt..math: 0~100|null}, compare: 같은 형태(선택)
export function radarSVG(skills, { compare = null, size = 300 } = {}) {
  const cx = 150;
  const cy = 138;
  const R = 92;
  const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / 5;
  const pt = (i, v) => [cx + Math.cos(ang(i)) * R * v, cy + Math.sin(ang(i)) * R * v];
  const poly = (vals) =>
    KEYS.map((k, i) => pt(i, Math.max(0.04, (vals[k] ?? 0) / 100)).map((n) => n.toFixed(1)).join(",")).join(" ");
  const rings = [0.25, 0.5, 0.75, 1]
    .map((s) => `<polygon class="rd-ring" points="${KEYS.map((_, i) => pt(i, s).join(",")).join(" ")}" />`)
    .join("");
  const axes = KEYS.map((_, i) => {
    const [x, y] = pt(i, 1);
    return `<line class="rd-axis" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" />`;
  }).join("");
  const labels = KEYS.map((k, i) => {
    const [x, y] = pt(i, 1.24);
    const v = skills[k];
    const anchor = Math.abs(x - cx) < 4 ? "middle" : x > cx ? "start" : "end";
    const dx = anchor === "start" ? -10 : anchor === "end" ? 10 : 0;
    return `<text class="rd-label" x="${x + dx}" y="${y - 2}" text-anchor="${anchor}">${META[k].icon} ${META[k].short}</text>
      <text class="rd-val${v == null ? " is-skip" : ""}" x="${x + dx}" y="${y + 15}" text-anchor="${anchor}">${v == null ? "건너뜀" : v}</text>`;
  }).join("");
  const dots = KEYS.map((k, i) => {
    if (skills[k] == null) return "";
    const [x, y] = pt(i, Math.max(0.04, skills[k] / 100));
    return `<circle class="rd-dot" cx="${x}" cy="${y}" r="3.5" />`;
  }).join("");
  return `<svg class="radar" viewBox="0 0 300 285" width="${size}" role="img" aria-label="다섯 가지 능력치 그래프: ${KEYS.map((k) => `${META[k].short} ${skills[k] ?? "건너뜀"}`).join(", ")}">
    ${rings}${axes}
    ${compare ? `<polygon class="rd-cmp" points="${poly(compare)}" />` : ""}
    <g class="rd-me"><polygon class="rd-poly" points="${poly(skills)}" />${dots}</g>
    ${labels}
  </svg>`;
}

/* ---------- 뇌 나이 기록 꺾은선 ---------- */
// rows: [{t, age}], real: 실제 나이(선택)
export function lineSVG(rows, real = null) {
  const W = 340;
  const H = 180;
  const pad = { l: 28, r: 16, t: 24, b: 28 };
  const ages = rows.map((r) => r.age);
  if (real) ages.push(real);
  let lo = Math.min(...ages) - 4;
  let hi = Math.max(...ages) + 4;
  if (hi - lo < 12) {
    const mid = (hi + lo) / 2;
    lo = mid - 6;
    hi = mid + 6;
  }
  const x = (i) => pad.l + (rows.length === 1 ? (W - pad.l - pad.r) / 2 : (i / (rows.length - 1)) * (W - pad.l - pad.r));
  const y = (v) => pad.t + ((hi - v) / (hi - lo)) * (H - pad.t - pad.b);
  const d = rows.map((r, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(r.age).toFixed(1)}`).join("");
  const area = `${d}L${x(rows.length - 1).toFixed(1)} ${H - pad.b}L${x(0).toFixed(1)} ${H - pad.b}Z`;
  const ticks = [lo, (lo + hi) / 2, hi].map((v) => Math.round(v));
  const date = (t) => {
    const dt = new Date(t);
    return `${dt.getMonth() + 1}/${dt.getDate()}`;
  };
  const showLabel = (i) => rows.length <= 6 || i === 0 || i === rows.length - 1 || i % Math.ceil(rows.length / 5) === 0;
  return `<svg class="line" viewBox="0 0 ${W} ${H}" role="img" aria-label="뇌 나이 기록: ${rows.map((r) => `${date(r.t)} ${r.age}세`).join(", ")}">
    ${ticks.map((v) => `<line class="ln-grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" /><text class="ln-tick" x="${pad.l - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join("")}
    ${real ? `<line class="ln-real" x1="${pad.l}" x2="${W - pad.r}" y1="${y(real)}" y2="${y(real)}" /><text class="ln-real-t" x="${W - pad.r}" y="${y(real) - 6}" text-anchor="end">실제 ${real}세</text>` : ""}
    <path class="ln-area" d="${area}" />
    <path class="ln-path" d="${d}" pathLength="1" />
    ${rows
      .map(
        (r, i) => `<circle class="ln-dot${i === rows.length - 1 ? " is-last" : ""}" cx="${x(i)}" cy="${y(r.age)}" r="${i === rows.length - 1 ? 5 : 3.5}" />
      ${showLabel(i) ? `<text class="ln-val" x="${x(i)}" y="${y(r.age) - 10}" text-anchor="middle">${r.age}</text><text class="ln-date" x="${x(i)}" y="${H - 8}" text-anchor="middle">${date(r.t)}</text>` : ""}`
      )
      .join("")}
  </svg>`;
}
