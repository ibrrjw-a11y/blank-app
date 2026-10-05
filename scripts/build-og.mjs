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

function html({ emoji, name, desc, keyword, brand }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;box-sizing:border-box}
  body{width:1200px;height:630px;font-family:"Pretendard Variable",Pretendard,"Noto Sans KR",sans-serif;
    background:#0a0c10;color:#fff;display:flex;align-items:center;padding:0 88px;position:relative;overflow:hidden}
  .glow{position:absolute;width:720px;height:720px;right:-160px;top:-120px;border-radius:50%;
    background:radial-gradient(circle,${brand} 0%,transparent 65%);opacity:.55}
  .ring{position:absolute;right:120px;top:155px;width:320px;height:320px;border-radius:50%;
    border:2px solid ${brand}55;display:grid;place-items:center}
  .emoji{font-size:168px;line-height:1}
  .text{position:relative;max-width:640px}
  .kw{display:inline-block;padding:10px 20px;border-radius:999px;background:${brand}33;color:#fff;font-size:26px;font-weight:600;margin-bottom:28px}
  h1{font-size:84px;font-weight:800;letter-spacing:-.03em;line-height:1.1}
  p{font-size:36px;color:#c4cad4;margin-top:20px;line-height:1.4}
  .foot{position:absolute;left:88px;bottom:48px;font-size:24px;color:#7b8494}
  </style></head><body>
  <div class="glow"></div><div class="ring"><div class="emoji">${emoji}</div></div>
  <div class="text"><div class="kw">${esc(keyword)}</div><h1>${esc(name)}</h1><p>${esc(desc)}</p></div>
  <div class="foot">놀이터 · 익숙한 놀이를 조금 다르게</div>
  </body></html>`;
}

const browser = await playwright.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.route(/^https?:/, (r) => r.abort());

const targets = [
  { slug: "", emoji: "🎡", name: "놀이터", desc: "테스트·추첨·계산기를 친구랑 같이 노는 방식으로", keyword: "11가지 놀이", brand: "#8b7bff" },
  ...SITES.map((s) => ({ ...s, brand: brandOf(s.slug) })),
];

for (const t of targets) {
  const dir = path.join(root, t.slug);
  if (t.slug && !fs.existsSync(path.join(dir, "index.html"))) {
    console.log("skip (no site yet)", t.slug);
    continue;
  }
  await page.setContent(html(t));
  await page.screenshot({ path: path.join(dir, "og.png") });
  console.log("og.png", t.slug || "(hub)");
}
await browser.close();
