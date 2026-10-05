// 엘리베이터 층 표시기 같은 7세그먼트 숫자 (SVG). 꺼진 세그먼트도 희미하게 보인다.
// createSeg(el, cells) → { set("12.34") }  /  drawSeg(ctx, text, x, y, h, on, off) 캔버스용

const MAP = {
  0: "abcdef", 1: "bc", 2: "abged", 3: "abgcd", 4: "fgbc", 5: "afgcd", 6: "afgedc", 7: "abc", 8: "abcdefg", 9: "abcdfg",
  "-": "g", " ": "", G: "acdef", O: "abcdef", o: "cdeg", d: "bcdeg", I: "bc", i: "c", n: "ceg", N: "abcef", P: "abefg",
  A: "abcefg", U: "bcdef", u: "cde", S: "afgcd", E: "adefg", H: "bcefg", h: "cefg", L: "def", r: "eg", t: "defg",
  b: "cdefg", C: "adef", c: "deg", F: "aefg", y: "bcdfg", _: "d",
};

const H = (y, x1, x2) => `${x1},${y} ${x1 + 4},${y - 4} ${x2 - 4},${y - 4} ${x2},${y} ${x2 - 4},${y + 4} ${x1 + 4},${y + 4}`;
const V = (x, y1, y2) => `${x},${y1} ${x + 4},${y1 + 4} ${x + 4},${y2 - 4} ${x},${y2} ${x - 4},${y2 - 4} ${x - 4},${y1 + 4}`;
// 52x92 칸 안의 세그먼트 7개
const SEGS = {
  a: H(6, 8.5, 43.5),
  b: V(46, 8.5, 43.5),
  c: V(46, 48.5, 83.5),
  d: H(86, 8.5, 43.5),
  e: V(6, 48.5, 83.5),
  f: V(6, 8.5, 43.5),
  g: H(46, 8.5, 43.5),
};

const digitSVG = () =>
  `<svg class="seg__d" viewBox="0 0 64 92" aria-hidden="true"><g transform="translate(8 0) skewX(-6)">${Object.entries(SEGS)
    .map(([k, p]) => `<polygon data-s="${k}" points="${p}" />`)
    .join("")}<circle data-s="p" cx="55" cy="86" r="4.5" /></g></svg>`;

function parse(text, cells) {
  const out = [];
  for (const ch of String(text)) {
    if (ch === "." && out.length) out[out.length - 1].dp = true;
    else out.push({ ch, dp: false });
  }
  while (out.length < cells) out.unshift({ ch: " ", dp: false });
  return out.slice(-cells);
}

export function createSeg(el, cells = 4) {
  el.classList.add("seg");
  el.innerHTML = Array.from({ length: cells }, digitSVG).join("");
  const digits = [...el.querySelectorAll(".seg__d")].map((svg) => {
    const m = {};
    svg.querySelectorAll("[data-s]").forEach((p) => (m[p.dataset.s] = p));
    return m;
  });
  let last = "";
  return {
    set(text) {
      const t = String(text);
      if (t === last) return;
      last = t;
      parse(t, cells).forEach(({ ch, dp }, i) => {
        const on = MAP[ch] ?? "";
        const d = digits[i];
        for (const k of "abcdefg") d[k].classList.toggle("is-on", on.includes(k));
        d.p.classList.toggle("is-on", dp);
      });
      el.setAttribute("aria-label", t.trim());
    },
  };
}

// 캔버스에 7세그먼트 숫자 그리기 (공유 이미지용). h = 글자 높이
export function drawSeg(ctx, text, x, y, h, on, off) {
  const s = h / 92;
  const cells = parse(text, 0);
  const list = cells.length ? cells : [];
  let cx = x;
  const poly = (pts) => {
    const n = pts.split(" ").map((p) => p.split(",").map(Number));
    ctx.beginPath();
    n.forEach(([px, py], i) => {
      const sx = cx + (8 + px - py * 0.105) * s;
      const sy = y + py * s;
      i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy);
    });
    ctx.closePath();
  };
  for (const { ch, dp } of list) {
    const segs = MAP[ch] ?? "";
    for (const [k, p] of Object.entries(SEGS)) {
      poly(p);
      ctx.fillStyle = segs.includes(k) ? on : off;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(cx + (8 + 55 - 86 * 0.105) * s, y + 86 * s, 4.5 * s, 0, Math.PI * 2);
    ctx.fillStyle = dp ? on : off;
    ctx.fill();
    cx += 64 * s;
  }
  return cx;
}
