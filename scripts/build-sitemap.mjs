// sitemap.xml + robots.txt 생성
import { fileURLToPath } from "node:url";
// 사용: node scripts/build-sitemap.mjs
// 도메인은 site.config.json 의 domain 값을 쓴다.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { domain } = JSON.parse(fs.readFileSync(path.join(root, "site.config.json"), "utf8"));
const SKIP = new Set(["shared", "scripts", "docs", "_template", "node_modules", ".git"]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name === "index.html") out.push(full);
  }
  return out;
}

const today = new Date().toISOString().slice(0, 10);
const urls = walk(root)
  .map((f) => "/" + path.relative(root, path.dirname(f)).split(path.sep).join("/"))
  .map((p) => (p === "/" ? "/" : p + "/"))
  .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((u) => {
    const depth = u.split("/").filter(Boolean).length;
    const priority = depth === 0 ? "1.0" : depth === 1 ? "0.9" : "0.6";
    return `  <url><loc>${domain}${encodeURI(u)}</loc><lastmod>${today}</lastmod><priority>${priority}</priority></url>`;
  })
  .join("\n")}
</urlset>
`;

fs.writeFileSync(path.join(root, "sitemap.xml"), xml);
fs.writeFileSync(path.join(root, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /_template/\n\nSitemap: ${domain}/sitemap.xml\n`);
console.log(`sitemap.xml: ${urls.length} urls`);
