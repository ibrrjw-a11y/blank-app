// 배포 도메인 일괄 교체 (canonical, og:url, sitemap 등)
// 사용: node scripts/set-domain.mjs https://내도메인.com
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const next = (process.argv[2] || "").replace(/\/+$/, "");
if (!/^https?:\/\/[^/]+$/.test(next)) {
  console.error("사용법: node scripts/set-domain.mjs https://example.com");
  process.exit(1);
}

const configPath = path.join(root, "site.config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const prev = config.domain;
const SKIP = new Set(["node_modules", ".git", "vendor"]);
let changed = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(html|xml|txt|json|js|mjs|webmanifest)$/.test(entry.name) && full !== configPath) {
      const src = fs.readFileSync(full, "utf8");
      if (src.includes(prev)) {
        fs.writeFileSync(full, src.split(prev).join(next));
        changed++;
      }
    }
  }
}

walk(root);
config.domain = next;
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
console.log(`${prev} → ${next} (${changed}개 파일)`);
