// 캔버스 차트 (선/영역 + 크로스헤어, 캔들, 스파크라인)
// 색은 전부 CSS 토큰에서 읽어요.

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function palette() {
  return {
    up: css("--ls-up"),
    down: css("--ls-down"),
    brand: css("--color-primary"),
    warn: css("--color-warning"),
    ok: css("--color-success"),
    text: css("--color-text"),
    text2: css("--color-text-secondary"),
    text3: css("--color-text-tertiary"),
    border: css("--color-border"),
    borderStrong: css("--color-border-strong"),
    surface: css("--color-surface"),
    raised: css("--color-surface-raised"),
    sunken: css("--color-surface-sunken"),
    bg: css("--color-bg"),
    font: css("--font-sans"),
  };
}

// "#rrggbb" | "rgb(...)" → rgba 문자열
export function alpha(color, a) {
  if (!color) return `rgba(0,0,0,${a})`;
  if (color.startsWith("#")) {
    let h = color.slice(1);
    if (h.length === 3) h = h.replace(/./g, (c) => c + c);
    const n = parseInt(h.slice(0, 6), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const [r, g, b] = m[1].split(/[ ,/]+/).map(Number);
    return `rgba(${r},${g},${b},${a})`;
  }
  return color;
}

function setup(canvas, height) {
  const w = canvas.parentElement.clientWidth;
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  canvas.style.width = w + "px";
  canvas.style.height = height + "px";
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h: height };
}

export function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const fmtShort = (v) => {
  if (v >= 1e8) return (v / 1e8).toFixed(1) + "억";
  if (v >= 1e4) return (v / 1e4).toFixed(v >= 1e5 ? 0 : 1) + "만";
  return Math.round(v).toLocaleString("ko-KR");
};

/*
 * 선 차트
 * spec = {
 *   series: [{ values, color, width, fill, splitAt }],   splitAt 이후는 흐리게(예상 구간)
 *   bands: [{ from, to, top, bottom }],                 대운 구간 (index 단위)
 *   zones: [{ from, to, label, color }],                 최대 조정 등
 *   markers: [{ i, kind: "today"|"peak", label }],
 *   xTicks: [{ i, label }],
 *   tip: (i) => html,
 *   height,
 * }
 */
export function createLineChart(canvas, tipEl) {
  let spec = null;
  let cross = null;
  let geom = null;

  function draw() {
    if (!spec) return;
    const P = palette();
    const { ctx, w, h } = setup(canvas, spec.height || 240);
    const padT = spec.bands?.length ? 34 : 14;
    const padB = 22;
    const padR = 46;
    const padL = 2;
    const n = spec.series[0].values.length;
    let min = Infinity;
    let max = -Infinity;
    spec.series.forEach((s) => s.values.forEach((v) => ((min = Math.min(min, v)), (max = Math.max(max, v)))));
    const span = max - min || 1;
    min -= span * 0.08;
    max += span * 0.16;
    const x = (i) => padL + (i / Math.max(1, n - 1)) * (w - padL - padR);
    const y = (v) => padT + (1 - (v - min) / (max - min)) * (h - padT - padB);
    geom = { x, y, n, padL, padR, w };
    ctx.font = `600 10px ${P.font}`;

    // 대운 밴드
    (spec.bands || []).forEach((b, k) => {
      const x0 = Math.max(padL, x(b.from));
      const x1 = Math.min(w - padR, x(b.to));
      if (x1 <= x0) return;
      ctx.fillStyle = k % 2 ? alpha(P.text, 0.035) : "transparent";
      ctx.fillRect(x0, padT - 30, x1 - x0, h - padB - padT + 30);
      ctx.strokeStyle = alpha(P.text, 0.08);
      ctx.beginPath();
      ctx.moveTo(x0 + 0.5, padT - 30);
      ctx.lineTo(x0 + 0.5, h - padB);
      ctx.stroke();
      const bw = x1 - x0;
      ctx.textAlign = "center";
      ctx.fillStyle = b.tone === "up" ? P.up : b.tone === "down" ? P.down : P.text2;
      if (bw > 20) {
        ctx.font = `700 ${bw > 90 ? 11 : 10}px ${P.font}`;
        ctx.fillText(bw > 90 ? b.long || b.top : b.top, (x0 + x1) / 2, padT - 18);
        ctx.font = `500 9px ${P.font}`;
        ctx.fillStyle = P.text3;
        if (b.bottom && bw <= 90) ctx.fillText(b.bottom, (x0 + x1) / 2, padT - 6);
        if (b.sub && bw > 90) ctx.fillText(b.sub, (x0 + x1) / 2, padT - 6);
      }
    });

    // 조정 구간
    (spec.zones || []).forEach((z) => {
      const x0 = x(z.from);
      const x1 = x(z.to);
      ctx.fillStyle = alpha(P.down, 0.12);
      ctx.fillRect(x0, padT, x1 - x0, h - padT - padB);
    });

    // 가로 그리드 + 오른쪽 축
    ctx.textAlign = "left";
    ctx.font = `500 10px ${P.font}`;
    for (let k = 0; k <= 3; k++) {
      const v = min + ((max - min) * (k + 0.5)) / 4;
      const yy = Math.round(y(v)) + 0.5;
      ctx.strokeStyle = alpha(P.text, 0.06);
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(padL, yy);
      ctx.lineTo(w - padR, yy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = P.text3;
      ctx.fillText(fmtShort(v), w - padR + 6, yy + 3);
    }

    // 시리즈
    spec.series.forEach((s) => {
      const vals = s.values;
      const split = s.splitAt == null ? n : Math.max(0, Math.min(n, Math.round(s.splitAt)));
      if (s.fill) {
        const g = ctx.createLinearGradient(0, padT, 0, h - padB);
        g.addColorStop(0, alpha(s.color, 0.32));
        g.addColorStop(1, alpha(s.color, 0));
        ctx.beginPath();
        vals.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
        ctx.lineTo(x(n - 1), h - padB);
        ctx.lineTo(x(0), h - padB);
        ctx.closePath();
        ctx.fillStyle = g;
        ctx.fill();
      }
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.lineWidth = s.width || 2;
      const seg = (a, b, style, dash) => {
        if (b - a < 1) return;
        ctx.beginPath();
        for (let i = a; i <= b && i < n; i++) (i === a ? ctx.moveTo : ctx.lineTo).call(ctx, x(i), y(vals[i]));
        ctx.strokeStyle = style;
        ctx.setLineDash(dash || []);
        ctx.stroke();
        ctx.setLineDash([]);
      };
      seg(0, split, s.color, s.dash);
      seg(split, n - 1, alpha(s.color, 0.55), s.dash);
    });

    // 마커
    (spec.markers || []).forEach((m) => {
      const v = spec.series[0].values[Math.round(m.i)];
      const xx = x(m.i);
      const yy = y(v);
      if (m.kind === "today") {
        ctx.strokeStyle = alpha(P.text, 0.5);
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(xx, padT);
        ctx.lineTo(xx, h - padB);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = alpha(spec.series[0].color, 0.25);
        ctx.beginPath();
        ctx.arc(xx, yy, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = spec.series[0].color;
        ctx.strokeStyle = P.surface;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(xx, yy, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        pill(ctx, P, m.label || "오늘", xx, h - padB - 12, P.text, P.surface, w, padR);
      }
      if (m.kind === "peak") {
        ctx.fillStyle = P.warn;
        ctx.beginPath();
        ctx.arc(xx, yy, 4, 0, Math.PI * 2);
        ctx.fill();
        pill(ctx, P, m.label, xx, yy - 16, P.warn, P.bg, w, padR, true);
      }
      if (m.kind === "zone") {
        pill(ctx, P, m.label, xx, h - padB - 12, P.down, "#fff", w, padR);
      }
    });

    // x축 눈금
    ctx.font = `500 10px ${P.font}`;
    ctx.fillStyle = P.text3;
    ctx.textAlign = "center";
    (spec.xTicks || []).forEach((t) => {
      const xx = Math.min(w - padR - 12, Math.max(padL + 12, x(t.i)));
      ctx.fillText(t.label, xx, h - 6);
    });

    // 크로스헤어
    if (cross != null) {
      const i = Math.round(cross);
      const xx = x(i);
      ctx.strokeStyle = alpha(P.text, 0.7);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xx + 0.5, padT - 4);
      ctx.lineTo(xx + 0.5, h - padB);
      ctx.stroke();
      spec.series.forEach((s) => {
        const yy = y(s.values[i]);
        ctx.fillStyle = s.color;
        ctx.strokeStyle = P.surface;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(xx, yy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
      const yy0 = y(spec.series[0].values[i]);
      ctx.setLineDash([2, 2]);
      ctx.strokeStyle = alpha(P.text, 0.4);
      ctx.beginPath();
      ctx.moveTo(padL, yy0);
      ctx.lineTo(w - padR, yy0);
      ctx.stroke();
      ctx.setLineDash([]);
      // 축 위 현재 값
      ctx.fillStyle = P.text;
      roundRectPath(ctx, w - padR + 2, yy0 - 9, padR - 3, 18, 4);
      ctx.fill();
      ctx.fillStyle = P.bg;
      ctx.textAlign = "left";
      ctx.font = `700 10px ${P.font}`;
      ctx.fillText(fmtShort(spec.series[0].values[i]), w - padR + 5, yy0 + 3.5);
      if (tipEl && spec.tip) {
        tipEl.innerHTML = spec.tip(i);
        tipEl.hidden = false;
        const tw = tipEl.offsetWidth;
        const left = Math.max(0, Math.min(w - tw, xx - tw / 2));
        tipEl.style.transform = `translateX(${left}px)`;
      }
    } else if (tipEl) {
      tipEl.hidden = true;
    }
  }

  function pick(e) {
    if (!geom) return;
    const r = canvas.getBoundingClientRect();
    const px = e.clientX - r.left;
    const t = (px - geom.padL) / (geom.w - geom.padL - geom.padR);
    cross = Math.max(0, Math.min(geom.n - 1, t * (geom.n - 1)));
    draw();
    spec?.onPick?.(Math.round(cross));
  }
  let active = false;
  canvas.addEventListener("pointerdown", (e) => {
    active = true;
    pick(e);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (active || e.pointerType === "mouse") pick(e);
  });
  const end = () => {
    active = false;
    setTimeout(() => {
      if (!active) {
        cross = null;
        draw();
      }
    }, 1400);
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("pointerleave", (e) => e.pointerType === "mouse" && end());

  let rt;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(draw, 120);
  });

  return {
    set(s) {
      spec = s;
      cross = null;
      draw();
    },
    draw,
    showAt(i) {
      cross = i;
      draw();
    },
    clear() {
      cross = null;
      draw();
    },
  };
}

function pill(ctx, P, text, cx, cy, bg, fg, w, padR, bold) {
  ctx.font = `${bold ? 800 : 700} 10px ${P.font}`;
  const tw = ctx.measureText(text).width + 12;
  const x0 = Math.max(2, Math.min(w - padR - tw - 2, cx - tw / 2));
  ctx.fillStyle = bg;
  roundRectPath(ctx, x0, cy - 9, tw, 18, 9);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = "left";
  ctx.fillText(text, x0 + 6, cy + 3.5);
}

/*
 * 캔들 차트 (일봉)
 * candles: [{open, high, low, close, d, future}], highlight: index
 */
export function createCandleChart(canvas, { onPick } = {}) {
  let data = null;
  let geom = null;
  function draw() {
    if (!data) return;
    const P = palette();
    const { ctx, w, h } = setup(canvas, data.height || 200);
    const { candles, highlight, selected } = data;
    const padT = 14;
    const padB = 20;
    const padR = 46;
    let min = Infinity;
    let max = -Infinity;
    candles.forEach((c) => ((min = Math.min(min, c.low)), (max = Math.max(max, c.high))));
    const span = max - min || 1;
    min -= span * 0.06;
    max += span * 0.06;
    const n = candles.length;
    const step = (w - padR) / n;
    const bw = Math.max(3, step * 0.62);
    const y = (v) => padT + (1 - (v - min) / (max - min)) * (h - padT - padB);
    geom = { step, n };
    ctx.font = `500 10px ${P.font}`;
    for (let k = 0; k <= 3; k++) {
      const v = min + ((max - min) * (k + 0.5)) / 4;
      const yy = Math.round(y(v)) + 0.5;
      ctx.strokeStyle = alpha(P.text, 0.06);
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(w - padR, yy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = P.text3;
      ctx.textAlign = "left";
      ctx.fillText(fmtShort(v), w - padR + 6, yy + 3);
    }
    candles.forEach((c, i) => {
      const cx = step * i + step / 2;
      const up = c.close >= c.open;
      const col = up ? P.up : P.down;
      const a = c.future ? 0.35 : 1;
      if (i === highlight || i === selected) {
        ctx.fillStyle = alpha(i === highlight ? P.text : P.text2, i === highlight ? 0.1 : 0.08);
        roundRectPath(ctx, cx - step / 2, padT - 8, step, h - padT - padB + 12, 4);
        ctx.fill();
      }
      ctx.strokeStyle = alpha(col, a);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + 0.5, y(c.high));
      ctx.lineTo(cx + 0.5, y(c.low));
      ctx.stroke();
      const top = y(Math.max(c.open, c.close));
      const bh = Math.max(1.5, Math.abs(y(c.open) - y(c.close)));
      ctx.fillStyle = alpha(col, a);
      ctx.fillRect(cx - bw / 2, top, bw, bh);
      if (c.d === 1 || c.d % 5 === 0 || i === highlight) {
        ctx.fillStyle = i === highlight ? P.text : P.text3;
        ctx.font = `${i === highlight ? 700 : 500} 10px ${P.font}`;
        ctx.textAlign = "center";
        ctx.fillText(i === highlight ? "오늘" : String(c.d), cx, h - 5);
      }
    });
  }
  canvas.addEventListener("pointerdown", (e) => {
    if (!geom) return;
    const r = canvas.getBoundingClientRect();
    const i = Math.floor((e.clientX - r.left) / geom.step);
    if (i >= 0 && i < geom.n) {
      data.selected = i;
      draw();
      onPick?.(i);
    }
  });
  let rt;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(draw, 120);
  });
  return {
    set(d) {
      data = d;
      draw();
    },
    draw,
  };
}

// SVG 스파크라인 (0~100 값)
export function sparkline(values, { w = 120, h = 32, color = "currentColor" } = {}) {
  const n = values.length;
  const min = Math.min(...values) - 4;
  const max = Math.max(...values) + 4;
  const pts = values.map((v, i) => [(i / (n - 1)) * (w - 4) + 2, h - 2 - ((v - min) / (max - min)) * (h - 4)]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const last = pts[0];
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" aria-hidden="true">
    <path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    <circle cx="${last[0]}" cy="${last[1]}" r="3" fill="${color}"/>
  </svg>`;
}
