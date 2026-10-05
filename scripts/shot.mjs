// 모바일 화면 스크린샷 도구 (검증용)
// 사용: node scripts/shot.mjs <slug> [출력경로] [대기ms] [스크립트]
//   예) node scripts/shot.mjs who-pays /tmp/who.png 2500
//   예) node scripts/shot.mjs who-pays /tmp/who-app.png 800 "document.querySelector('#start').click()"
// 루트에서 정적 서버를 띄우고 iPhone 크기(390x844)로 찍는다. 콘솔 에러도 출력한다.
import { createRequire } from "node:module";
import http from "node:http";
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
const [slug = "", out = `/tmp/shot-${slug || "hub"}.png`, wait = "2500", ...rest] = process.argv.slice(2);
const script = rest.join(" ");

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".txt": "text/plain",
  ".xml": "application/xml",
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(root, p);
  if (!file.startsWith(root) || !fs.existsSync(file)) {
    res.writeHead(404);
    return res.end("not found");
  }
  res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const browser = await playwright.chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
page.on("console", (m) => m.type() === "error" && console.log("[console.error]", m.text()));
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
// 외부 CDN은 샌드박스에서 막혀 있으므로 바로 실패시켜 대기 시간을 없앤다
await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r) => r.abort());
await page.goto(`http://127.0.0.1:${port}/${slug ? slug + "/" : ""}`, { waitUntil: "load" });
await page.waitForTimeout(Number(wait));
if (script) {
  await page.evaluate(script);
  await page.waitForTimeout(Number(process.env.AFTER || 1500));
}
await page.screenshot({ path: out, fullPage: process.env.FULL === "1" });
console.log("saved", out);
await browser.close();
server.close();
