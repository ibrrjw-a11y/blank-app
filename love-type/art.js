// 도감 판화풍 동물 그림 (SVG). 외곽선 + 빗금 음영 + 털 결 선.
// 모든 그림은 200×160 좌표. 색은 CSS(.lt-art)에서 토큰으로 칠한다.

function spines(cx, cy, rx, ry, from, to, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = ((from + ((to - from) * i) / n) * Math.PI) / 180;
    const k = i % 2 ? 1.18 : 0.98;
    pts.push(`${(cx + Math.cos(a) * rx * k).toFixed(1)} ${(cy - Math.sin(a) * ry * k).toFixed(1)}`);
  }
  return pts;
}

const hedgeOuter = spines(112, 124, 60, 50, 168, 4, 34);

export const ART = {
  retriever: {
    body: [
      "M36 60 C36 56 40 55 52 53 C56 48 58 44 62 41 C70 36 84 36 92 44 C98 52 102 62 112 72 C130 84 148 96 156 112 C162 124 158 136 148 140 L112 140 C108 128 100 121 92 119 L88 140 L72 140 L70 104 C64 96 58 88 56 78 C50 74 42 70 38 66 C36 64 36 62 36 60 Z",
      "M150 122 C166 120 176 110 182 96 C188 106 184 118 174 126 C166 131 156 131 149 128 Z",
      "M72 44 C84 44 90 56 88 72 C86 84 80 88 75 84 C70 76 68 62 70 50 Z",
    ],
    shade: [
      "M75 52 C82 54 86 64 84 76 C82 82 78 82 76 78 C73 70 72 60 75 52 Z",
      "M112 72 C130 84 148 96 156 112 C162 124 158 136 148 140 L132 140 C142 128 140 112 128 100 C120 92 112 84 106 74 Z",
      "M150 122 C166 120 176 110 182 96 C186 108 178 120 166 126 Z",
    ],
    lines: [
      "M38 66 C44 70 50 70 54 66",
      "M118 140 C116 126 124 112 140 108",
      "M80 104 L82 140",
      "M60 88 c3 4 3 8 0 12",
      "M65 94 c3 4 3 8 0 12",
      "M158 128 l3 5 M166 126 l4 5 M173 121 l5 4",
      "M96 56 c4 3 6 7 6 11",
      "M52 53 C54 56 56 58 58 58",
    ],
    dots: [[61, 49, 2.4], [37, 59.5, 2.8]],
    ground: true,
  },
  cheetah: {
    body: [
      "M28 60 C30 52 40 46 50 46 L52 40 L57 46 C64 48 70 52 80 52 C104 50 128 50 146 56 C152 58 156 64 156 70 C156 80 150 88 148 96 L154 136 L146 136 L140 104 C136 98 134 92 130 88 C112 86 92 88 78 86 L74 136 L66 136 L64 92 L58 136 L50 136 L52 88 C46 80 40 74 36 70 C32 68 28 64 28 60 Z",
    ],
    shade: [
      "M80 52 C104 50 128 50 146 56 C152 58 156 64 156 70 C140 64 110 62 84 62 Z",
      "M148 96 L154 136 L148 136 L142 100 Z",
      "M64 92 L66 136 L70 136 L70 92 Z",
    ],
    lines: [
      "M155 66 C172 72 178 96 172 116 C170 126 178 130 186 122",
      "M40 56 C38 62 36 66 33 70",
      "M29 63 L35 63",
      "M140 104 C138 112 140 120 146 128",
    ],
    thick: ["M155 66 C172 72 178 96 172 116 C170 126 178 130 186 122"],
    rings: [[176, 98], [173, 110], [176, 121]],
    dots: [[42, 53, 2.1], [29, 59, 2], [74, 60, 2.2], [88, 58, 2], [102, 56, 2.3], [118, 57, 2], [132, 58, 2.2], [92, 70, 2.2], [108, 68, 2], [124, 70, 2.3], [140, 72, 2], [80, 76, 2], [98, 80, 2], [116, 78, 2.2], [134, 80, 2], [148, 82, 2], [62, 78, 2], [146, 64, 1.8], [60, 104, 1.6], [56, 118, 1.6], [150, 112, 1.6]],
    ground: true,
  },
  penguin: {
    body: [
      "M96 24 C110 22 118 32 118 44 C124 60 132 86 130 112 C128 132 118 144 100 146 C82 146 72 136 70 118 C68 96 74 72 80 56 C78 50 76 44 78 38 C80 28 88 24 96 24 Z",
      "M80 40 L58 46 L80 47 Z",
    ],
    shade: [
      "M96 24 C110 22 118 32 118 44 C124 60 132 86 130 112 C128 132 118 144 100 146 C112 130 116 100 108 70 C104 56 96 48 86 46 C82 38 86 28 96 24 Z",
      "M114 70 C126 86 130 104 124 122 C118 110 112 94 110 76 Z",
      "M96 24 C88 24 80 28 78 38 C78 44 80 47 82 50 C86 44 90 36 96 24 Z",
    ],
    lines: [
      "M88 146 l-9 7 h20 Z",
      "M104 146 l-5 7 h17 Z",
      "M84 64 c-2 10 -3 20 -2 30",
      "M80 104 c0 10 2 18 6 26",
    ],
    rings: [],
    dots: [[90, 36, 2.2]],
    pebble: [52, 146, 7, 4.5],
    ground: true,
  },
  wolf: {
    body: [
      "M24 50 L40 44 C46 40 50 34 54 30 L58 20 L64 33 C72 38 80 44 88 48 C108 50 132 50 150 56 C158 60 160 70 156 80 L160 132 L152 132 L146 96 C140 92 132 90 124 90 C108 90 92 90 80 88 L78 132 L70 132 L68 94 L62 132 L54 132 L56 88 C48 80 44 70 42 62 C36 60 28 58 26 56 Z",
      "M156 66 C172 76 182 100 174 120 C166 110 160 96 154 82 Z",
    ],
    shade: [
      "M88 48 C108 50 132 50 150 56 C158 60 160 70 156 80 C140 70 116 64 92 62 Z",
      "M156 66 C172 76 182 100 174 120 C170 108 164 94 158 82 Z",
      "M54 30 L58 20 L64 33 C60 34 57 34 54 30 Z",
    ],
    lines: [
      "M26 55 L40 57",
      "M64 40 c3 3 4 6 3 9 M70 44 c3 3 4 6 3 9 M76 48 c3 3 4 6 3 9 M62 52 c3 3 4 6 3 9 M68 56 c3 3 4 6 3 9",
      "M146 96 C144 108 146 120 152 128",
      "M60 72 c4 4 6 8 6 14",
    ],
    rings: [],
    dots: [[44, 44, 2.1], [24.5, 50.5, 2.4]],
    ground: true,
  },
  otter: {
    body: [
      "M40 86 C38 74 48 66 60 68 C68 69 74 74 78 80 C96 78 120 78 140 82 C150 76 156 70 162 72 C166 76 162 82 156 86 C168 88 180 92 190 98 C182 102 170 102 156 100 C130 104 96 104 70 102 C54 100 42 96 40 86 Z",
      "M90 76 C90 64 110 64 110 76 Z",
      "M84 78 a5 4 0 1 0 10 0 a5 4 0 1 0 -10 0 Z",
      "M106 78 a5 4 0 1 0 10 0 a5 4 0 1 0 -10 0 Z",
    ],
    shade: [
      "M70 102 C96 104 130 104 156 100 C170 102 182 102 190 98 C178 96 166 95 154 94 C126 97 96 97 64 95 C56 95 48 92 44 88 C46 96 56 100 70 102 Z",
    ],
    lines: [
      "M58 68 c1 -4 5 -6 8 -3",
      "M40 84 l-12 -4 M40 87 l-12 1 M41 90 l-11 5",
      "M100 76 L100 66 M100 76 L94 68 M100 76 L106 68",
      "M120 92 c10 2 20 2 30 0",
    ],
    rings: [],
    dots: [[52, 78, 2.2], [41, 83, 2.6]],
    water: true,
  },
  fox: {
    body: [
      "M40 58 C48 52 54 48 58 44 L58 26 L68 39 L74 28 L77 46 C82 54 86 60 92 70 C104 84 112 104 114 124 C116 134 110 140 100 140 L70 140 L70 108 C64 96 60 84 60 74 C54 68 46 64 40 62 C38 61 38 59 40 58 Z",
      "M108 134 C138 138 156 122 150 102 C148 94 156 90 162 98 C170 118 158 148 120 150 C96 152 74 148 62 140 Z",
    ],
    shade: [
      "M92 70 C104 84 112 104 114 124 C116 134 110 140 100 140 L92 140 C102 126 100 104 88 84 Z",
      "M108 134 C138 138 156 122 150 102 C148 94 156 90 162 98 C166 112 160 128 146 138 C132 144 118 142 108 138 Z",
      "M58 26 L68 39 L62 40 Z",
    ],
    lines: [
      "M42 62 C52 68 62 70 70 66",
      "M70 108 L72 140",
      "M78 112 L80 140",
      "M64 82 c3 4 3 8 0 12",
      "M68 90 c3 4 3 8 0 12",
      "M74 130 c-2 4 -4 8 -8 10",
    ],
    rings: [],
    dots: [[40.5, 59.5, 2.4]],
    eyes: ["M58 51 c3 -2 6 -2 8 0"],
    ground: true,
  },
  hedgehog: {
    body: [`M${hedgeOuter.join(" L")} L172 124 L58 124 Z`, "M30 114 C40 104 52 98 66 100 L70 124 L38 124 C34 122 30 118 30 114 Z"],
    shade: [`M${hedgeOuter.slice(8).join(" L")} L172 124 L110 124 Z`],
    lines: [
      ...Array.from({ length: 9 }, (_, i) => {
        const a = ((150 - i * 15) * Math.PI) / 180;
        return `M${(112 + Math.cos(a) * 28).toFixed(1)} ${(124 - Math.sin(a) * 22).toFixed(1)} L${(112 + Math.cos(a) * 54).toFixed(1)} ${(124 - Math.sin(a) * 44).toFixed(1)}`;
      }),
      "M60 104 c4 -6 10 -8 14 -6",
      "M48 124 l-2 6 M62 124 l1 6 M150 124 l-1 6 M164 124 l2 6",
    ],
    rings: [],
    dots: [[50, 108, 2.2], [30.5, 114, 2.6]],
    ground: true,
  },
  cat: {
    body: [
      "M46 58 C46 48 52 42 58 40 L58 24 L69 35 C73 33 77 33 81 35 L90 24 L89 42 C93 48 93 56 89 62 C98 72 112 88 116 108 C120 128 112 140 98 140 L66 140 L66 104 C60 96 56 86 56 76 C50 72 46 66 46 58 Z",
    ],
    shade: [
      "M89 62 C98 72 112 88 116 108 C120 128 112 140 98 140 L90 140 C104 128 104 104 92 86 C88 78 86 70 86 64 Z",
      "M58 24 L69 35 L62 37 Z",
      "M90 24 L89 42 L84 36 Z",
    ],
    lines: [
      "M108 138 C134 140 152 132 150 116 C149 106 154 102 159 108",
      "M66 104 L68 140",
      "M76 106 L77 140",
      "M48 62 l-14 -3 M48 65 l-14 3 M66 62 l14 -3 M66 65 l14 3",
      "M94 84 l8 -3 M98 94 l9 -2 M102 104 l9 -1 M104 114 l9 0",
      "M55 66 c2 2 4 2 6 0",
    ],
    thick: ["M108 138 C134 140 152 132 150 116 C149 106 154 102 159 108"],
    rings: [],
    dots: [[58, 63, 1.8]],
    eyes: ["M51 52 c3 -3 7 -3 9 0 c-2 3 -7 3 -9 0 Z", "M64 52 c3 -3 7 -3 9 0 c-2 3 -7 3 -9 0 Z"],
    ground: true,
  },
};

// 빗금 패턴 (문서에 한 번만 넣는다)
export function ensureDefs() {
  if (document.getElementById("lt-defs")) return;
  const holder = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  holder.setAttribute("id", "lt-defs");
  holder.setAttribute("width", "0");
  holder.setAttribute("height", "0");
  holder.setAttribute("aria-hidden", "true");
  holder.style.position = "absolute";
  holder.innerHTML = defsMarkup();
  document.body.prepend(holder);
}

function defsMarkup(prefix = "lt") {
  return `<defs>
    <pattern id="${prefix}-hatch" width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)">
      <line x1="0" y1="0" x2="0" y2="3.2" class="lt-hatch-line" stroke-width="0.9" />
    </pattern>
    <pattern id="${prefix}-cross" width="3.4" height="3.4" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
      <line x1="0" y1="0" x2="0" y2="3.4" class="lt-hatch-line" stroke-width="0.8" />
      <line x1="0" y1="0" x2="3.4" y2="0" class="lt-hatch-line" stroke-width="0.5" />
    </pattern>
  </defs>`;
}

// 동물 SVG 마크업. silhouette: 미발견 실루엣
export function animalSVG(key, { silhouette = false, cls = "", standalone = null } = {}) {
  const a = ART[key];
  if (!a) return "";
  const p = standalone ? "sa" : "lt";
  const ink = standalone?.ink;
  const paper = standalone?.paper;
  const st = (role) => {
    if (!standalone) return "";
    if (role === "body") return ` fill="${silhouette ? ink : paper}" stroke="${ink}" stroke-width="1.6" stroke-linejoin="round"`;
    if (role === "shade") return ` fill="url(#${p}-hatch)" stroke="none"`;
    if (role === "line") return ` fill="none" stroke="${ink}" stroke-width="1.2" stroke-linecap="round"`;
    if (role === "thick") return ` fill="none" stroke="${ink}" stroke-width="5" stroke-linecap="round"`;
    if (role === "dot") return ` fill="${ink}"`;
    if (role === "ground") return ` fill="none" stroke="${ink}" stroke-width="1" stroke-dasharray="1 3"`;
    return "";
  };
  const ground = a.ground ? `<path class="lt-ground" d="M14 ${a === ART.hedgehog ? 124 : a === ART.penguin ? 153 : a === ART.cheetah || a === ART.wolf ? 136 : 140} H186"${st("ground")} />` : "";
  const water = a.water
    ? `<g class="lt-water"${st("line")}>${[104, 112, 120, 128]
        .map((y, i) => `<path d="M${6 + (i % 2) * 8} ${y} q8 -4 16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0" />`)
        .join("")}</g>`
    : "";
  const body = a.body.map((d) => `<path class="lt-body" d="${d}"${st("body")} />`).join("");
  if (silhouette) {
    return `<svg class="lt-art lt-art--sil ${cls}" viewBox="0 0 200 160" aria-hidden="true"${standalone ? ' xmlns="http://www.w3.org/2000/svg"' : ""}>${body}</svg>`;
  }
  const shade = a.shade.map((d) => `<path class="lt-shade" d="${d}"${st("shade")} />`).join("");
  const lines = a.lines.map((d) => `<path class="lt-line" d="${d}"${st("line")} />`).join("");
  const thick = (a.thick || []).map((d) => `<path class="lt-thick" d="${d}"${st("thick")} />`).join("");
  const rings = (a.rings || []).map(([x, y]) => `<path class="lt-line" d="M${x - 4} ${y - 2} l8 4"${st("line")} />`).join("");
  const dots = a.dots.map(([x, y, r]) => `<circle class="lt-dot" cx="${x}" cy="${y}" r="${r}"${st("dot")} />`).join("");
  const eyes = (a.eyes || []).map((d) => `<path class="lt-dot" d="${d}"${st("dot")} />`).join("");
  const pebble = a.pebble ? `<ellipse class="lt-body" cx="${a.pebble[0]}" cy="${a.pebble[1]}" rx="${a.pebble[2]}" ry="${a.pebble[3]}"${st("body")} /><ellipse class="lt-shade" cx="${a.pebble[0] + 2}" cy="${a.pebble[1] + 1}" rx="${a.pebble[2] - 2}" ry="${a.pebble[3] - 1.5}"${st("shade")} />` : "";
  return `<svg class="lt-art ${cls}" viewBox="0 0 200 160" aria-hidden="true"${standalone ? ' xmlns="http://www.w3.org/2000/svg"' : ""}>
    ${standalone ? defsMarkup(p).replace(/class="lt-hatch-line"/g, `stroke="${ink}"`) : ""}
    ${water}${ground}${thick}${body}${shade}${lines}${rings}${dots}${eyes}${pebble}
  </svg>`;
}

// 캔버스용 이미지 (색을 직접 넣은 독립 SVG)
export function animalImage(key, { ink, paper }) {
  const svg = animalSVG(key, { standalone: { ink, paper } });
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}
