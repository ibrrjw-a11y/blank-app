// 사이트별 공유 미리보기 이미지(og.png, 1200x630) 생성
// 사용: node scripts/build-og.mjs
// 각 사이트 style.css 의 --brand 색과 sites.js 의 이름/설명/이모지를 사용한다.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require("playwright");
} catch {
  playwright = require("/opt/node22/lib/node_modules/playwright");
}

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const { SITES } = await import(path.join(root, "shared/sites.js"));

function brandOf(slug) {
  for (const file of ["style.css", "index.html"]) {
    const p = path.join(root, slug, file);
    if (!fs.existsSync(p)) continue;
    const m = fs.readFileSync(p, "utf8").match(/--brand:\s*(#[0-9a-fA-F]{3,8})/);
    if (m) return m[1];
  }
  return "#8b7bff";
}

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function html({ name, desc, keyword, brand, index }) {
  // 단색 종이 + 사이트 포인트 색 하나. 그라디언트·빛 효과 없음
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;box-sizing:border-box}
  body{width:1200px;height:630px;font-family:"Black Han Sans","Pretendard Variable",Pretendard,"Noto Sans KR",sans-serif;
    background:#f2efe6;color:#111;position:relative;overflow:hidden;padding:72px 88px}
  .bar{position:absolute;right:0;top:0;bottom:0;width:300px;background:${brand}}
  .no{position:absolute;right:56px;bottom:40px;font:800 180px/1 "Archivo",sans-serif;color:#111;letter-spacing:-.04em}
  .kw{font:600 28px/1 "Pretendard Variable",sans-serif;letter-spacing:.02em;border-bottom:3px solid #111;display:inline-block;padding-bottom:12px}
  h1{margin-top:64px;font-size:112px;font-weight:900;letter-spacing:-.04em;line-height:1.02;max-width:760px}
  p{margin-top:28px;font:500 38px/1.35 "Pretendard Variable",sans-serif;color:#3d4451;max-width:720px}
  .foot{position:absolute;left:88px;bottom:48px;font:600 24px/1 "Pretendard Variable",sans-serif;color:#5a6372}
  </style></head><body>
  <div class="bar"></div><div class="no">${index}</div>
  <div class="kw">${esc(keyword)}</div><h1>${esc(name)}</h1><p>${esc(desc)}</p>
  <div class="foot">심심상가 · 심심할 때 들르는 곳</div>
  </body></html>`;
}

const browser = await playwright.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.route(/^https?:/, (r) => r.abort());

const targets = [
  { slug: "", name: "심심상가", desc: "룰렛·심리테스트·미니게임·계산기", keyword: "심심할 때 들르는 곳", brand: "#ff4b1f", index: "11" },
  ...SITES.map((s, i) => ({ ...s, brand: brandOf(s.slug), index: String(i + 1).padStart(2, "0") })),
];

for (const t of targets) {
  const dir = path.join(root, t.slug);
  if (t.slug && !fs.existsSync(path.join(dir, "index.html"))) {
    console.log("skip (no site yet)", t.slug);
    continue;
  }
  // 사이트가 직접 만든 og.png 는 덮어쓰지 않는다 (--force 로 강제)
  if (fs.existsSync(path.join(dir, "og.png")) && !process.argv.includes("--force")) {
    console.log("keep existing og.png", t.slug || "(hub)");
    continue;
  }
  await page.setContent(html(t));
  await page.screenshot({ path: path.join(dir, "og.png") });
  console.log("og.png", t.slug || "(hub)");
}
await browser.close();
