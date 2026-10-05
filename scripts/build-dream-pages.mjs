// 꿈 사주 SEO 롱테일 페이지 생성기
// 사용: node scripts/build-dream-pages.mjs
// dream-saju/dreams.json 을 읽어서
//   - dream-saju/s/<id>/index.html  (등장 상징 + 사건마다 한 장)
//   - dream-saju/s/index.html       (꿈해몽 사전 목록)
//   - dream-saju/sitemap-part.xml
//   - dream-saju/index.html 의 <!-- GEN:popular --> 블록 (자주 찾는 꿈 링크)
// 을 만든다. 해석 로직은 앱과 같은 dream-saju/engine.js 를 쓴다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepare, interpret, rulesFor, josa, opt, pillar } from "../dream-saju/engine.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = path.join(ROOT, "dream-saju");
const ORIGIN = "https://example.com";
const BASE = `${ORIGIN}/dream-saju/`;
const data = prepare(JSON.parse(fs.readFileSync(path.join(SITE, "dreams.json"), "utf8")));
const UPDATED = data.updated;

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const sentences = (t) => String(t).split(/(?<=[요다]\.)\s+/);
const clip = (t, n) => (t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : t);
const jsonld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;

const P1 = pillar(data, "p1").options;
const P2 = pillar(data, "p2").options;
const P3 = pillar(data, "p3").options;
const P4 = pillar(data, "p4").options;
const PAGES = [...P1.map((o) => ({ key: "p1", o })), ...P3.filter((o) => !o.noPage).map((o) => ({ key: "p3", o }))];
const FEEL = { joy: "기뻤다면", calm: "평온했다면", flutter: "설렜다면", anxious: "불안했다면", fear: "무서웠다면", sad: "슬펐다면" };
const domainLabel = Object.fromEntries(data.domains.map((d) => [d.id, d.label]));

function gradeOf(sel) {
  return interpret(data, sel).grade;
}

function selFor(key, id, extra = {}) {
  return { p1: null, p2: "unknown", p3: "seeing", p4: "calm", [key]: id, ...extra };
}

const seal = (g) => `<span class="mini-seal${g.min < -1 ? " mini-seal--soft" : ""}">${esc(g.name)}</span>`;

function appLink(sel) {
  const q = new URLSearchParams();
  ["p1", "p2", "p3", "p4"].forEach((k) => sel[k] && q.set(k, sel[k]));
  return `../../?${q.toString()}`;
}

function topDomains(o) {
  return Object.entries(o.w || {})
    .filter(([, v]) => v >= 1)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => domainLabel[k]);
}

function polLine(o) {
  if (o.pol >= 2) return "전통 해몽에서 대표적인 길몽으로 꼽혀요.";
  if (o.pol >= 1) return "대체로 좋은 꿈으로 풀어요.";
  if (o.pol === 0) return "상황과 꿈속 기분에 따라 풀이가 갈려요.";
  return "흉몽이라기보다 몸과 마음을 살피라는 신호로 풀어요.";
}

function polTag(o) {
  if (o.pol >= 2) return "길몽 성향";
  if (o.pol >= 1) return "좋은 꿈 쪽";
  if (o.pol === 0) return "상황 따라";
  return "쉬어 가라는 신호";
}

const INK_DEFS = `<svg class="ink-defs" aria-hidden="true" focusable="false"><filter id="ink-rough" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="2" seed="7" result="n" /><feDisplacementMap in="SourceGraphic" in2="n" scale="3.5" xChannelSelector="R" yChannelSelector="G" /></filter></svg>`;

function shell({ title, description, keywords, canonical, body, ld, depth }) {
  const up = "../".repeat(depth);
  return `<!doctype html>
<html lang="ko" data-theme="dark">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <meta name="keywords" content="${esc(keywords.join(", "))}" />
    <link rel="canonical" href="${canonical}" />
    <meta name="theme-color" content="#0a0c10" />
    <meta property="og:type" content="article" />
    <meta property="og:locale" content="ko_KR" />
    <meta property="og:site_name" content="꿈 사주" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:image" content="${BASE}og.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌙</text></svg>" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Song+Myung&display=swap" />
    <link rel="stylesheet" href="${up}../shared/components.css" />
    <link rel="stylesheet" href="${up}style.css" />
    ${ld.map(jsonld).join("\n    ")}
  </head>
  <body>
    ${INK_DEFS}
    <main class="app">
      <header class="topbar">
        <a class="topbar__brand" href="${up}"><span aria-hidden="true">🌙</span> 꿈 사주</a>
        <a class="btn btn--ghost btn--sm" href="${up}">4칸으로 꿈 풀기</a>
      </header>
${body}
      <nav id="more" aria-label="다른 놀이"></nav>
      <footer class="site-footer">재미로 보는 해몽이에요. 전통 해몽 속설을 바탕으로 풀었고, 실제 일을 예언하지 않아요.</footer>
    </main>
    <script type="module">
      import { renderMoreSites } from "${up}../shared/kit.js";
      renderMoreSites(document.getElementById("more"), "dream-saju", { base: "${up}../" });
    </script>
  </body>
</html>
`;
}

/* ---------- 상징/사건 페이지 ---------- */
function buildPage({ key, o }) {
  const url = `${BASE}s/${o.id}/`;
  const kw = o.kw;
  const isP1 = key === "p1";
  const rules = rulesFor(data, key, o.id);
  const doms = topDomains(o);
  const title = `${kw} 해몽 | ${o.alt.join("·")} 풀이 - 꿈 사주`;
  const description = clip(
    `${kw} 해몽, ${polLine(o).replace(/\.$/, "")} ${sentences(o.meaning)[0]} 상황별·기분별 풀이${o.tm ? "와 태몽 속설" : ""}까지 정리했어요.`,
    155
  );
  const keywords = [kw, `${kw} 해몽`, ...o.alt, ...(o.tm ? [`${o.label} 태몽`] : []), "꿈해몽", "꿈 풀이", "무료 꿈해몽"];

  // 상황별 해몽 (조합 규칙)
  const variants = rules.map((r) => {
    const sel = {
      p1: r.p1?.[0] || (isP1 ? o.id : null),
      p2: r.p2?.[0] || "unknown",
      p3: r.p3?.[0] || (isP1 ? "seeing" : o.id),
      p4: r.p4?.[0] || "calm",
    };
    if (isP1) sel.p1 = o.id;
    else sel.p3 = o.id;
    const g = gradeOf(sel);
    return `<div class="variant"><h3>${esc(r.title)} ${seal(g)}</h3><p>${esc(r.text)}</p><a href="${appLink(sel)}">이 장면으로 4칸 풀어 보기 →</a></div>`;
  });

  // 장소별(등장 페이지) 또는 무엇이 나왔는지별(사건 페이지) 표
  let tableTitle;
  let tableNote;
  let rows;
  if (isP1) {
    tableTitle = `어디서 꾼 ${kw}인가요?`;
    tableNote = "특별한 일 없이 보기만 했고 마음이 평온했을 때를 기준으로 꿈 사주 풀이 규칙을 적용한 결과예요.";
    rows = P2.filter((p) => p.id !== "unknown").map((p) => {
      const r = interpret(data, selFor("p1", o.id, { p2: p.id }));
      return `<tr><td>${p.emoji} ${esc(p.label)}</td><td>${esc(r.headline)}</td><td>${esc(r.grade.name)}</td></tr>`;
    });
  } else {
    tableTitle = `무엇이 나온 ${kw}인가요?`;
    tableNote = "장소는 빼고 마음이 평온했을 때를 기준으로 꿈 사주 풀이 규칙을 적용한 결과예요.";
    const inRules = [...new Set(rules.flatMap((r) => r.p1 || []))];
    const others = P1.map((x) => x.id).filter((id) => !inRules.includes(id));
    const pickIds = [...inRules, ...others.filter((_, i) => i % 3 === 0)].slice(0, 12);
    rows = pickIds.map((id) => {
      const s = opt(data, "p1", id);
      const r = interpret(data, { p1: id, p2: "unknown", p3: o.id, p4: "calm" });
      return `<tr><td><a href="../${id}/">${s.emoji} ${esc(s.label)}</a></td><td>${esc(r.headline)}</td><td>${esc(r.grade.name)}</td></tr>`;
    });
  }

  // 기분별 해석
  const feel = P4.map((e) => {
    const g = gradeOf(selFor(key, o.id, { p4: e.id }));
    const r = rules.find((x) => x.p4 && x.p4.includes(e.id) && ["p1", "p2", "p3"].every((k) => k === key || !x[k]));
    const text = r ? r.text : e.read;
    return `<div class="variant"><h3>${e.emoji} 꿈속에서 ${FEEL[e.id] || e.label} ${seal(g)}</h3><p>${esc(text)}</p></div>`;
  });

  // 태몽
  const tmLines = [o.tm?.text, ...rules.map((r) => r.tm)].filter(Boolean);

  // FAQ
  const joyG = gradeOf(selFor(key, o.id, { p4: "joy" })).name;
  const fearG = gradeOf(selFor(key, o.id, { p4: "fear" })).name;
  const money = o.w?.money || 0;
  const faq = [
    {
      q: `${josa(kw, "은/는")} 길몽인가요, 흉몽인가요?`,
      a:
        o.pol >= 2
          ? `전통 해몽에서 ${josa(kw, "은/는")} 대표적인 길몽으로 꼽혀요.${doms.length ? ` 특히 ${doms.slice(0, 2).join("·")}운과 관련이 깊다고 풀어요.` : ""} 다만 꿈속에서 무섭거나 불안했다면 좋은 기운이 덜 온전하게 들어온다고 보니 기분까지 함께 넣어 풀어 보세요.`
          : o.pol >= 1
            ? `대체로 좋은 꿈으로 풀어요. ${sentences(o.meaning)[0]} 꿈속 상황과 기분에 따라 풀이가 달라질 수 있어요.`
            : o.pol === 0
              ? `상황에 따라 풀이가 갈리는 꿈이에요. ${sentences(o.meaning)[1] || sentences(o.meaning)[0]}`
              : `흉몽이라기보다 몸과 마음을 살피라는 신호로 풀어요. ${sentences(o.meaning)[1] || sentences(o.meaning)[0]} 걱정하기보다 하루를 조금 여유 있게 보내 보세요.`,
    },
    tmLines.length
      ? {
          q: `${kw}도 태몽인가요?`,
          a: `${tmLines.join(" ")} 어디까지나 전해 오는 속설이라 아이의 성별이나 앞날을 맞히는 근거는 없어요.`,
        }
      : null,
    {
      q: `${josa(kw, "을/를")} 꾸면 로또를 사야 하나요?`,
      a: `${kw}의 재물 기운은 ${money >= 1.5 ? "강한 편" : money >= 0.5 ? "있는 편" : "크지 않은 편"}이라고 풀어요. 꿈 사주에서는 4칸 조합과 날짜로 ‘꿈 기운 번호’ 6개를 재미로 뽑아 드리지만, 어떤 번호든 당첨 확률은 똑같아요.`,
    },
    {
      q: `${kw}에서 꿈속 기분이 왜 중요한가요?`,
      a: `전통 해몽에서는 꿈속 기분을 크게 봐요. 꿈 사주 풀이 기준으로 같은 ${kw}라도 기뻤다면 ${joyG}, 무서웠다면 ${fearG}으로 등급이 달라져요.`,
    },
  ].filter(Boolean);

  // 관련 꿈
  const partnerKey = isP1 ? "p3" : "p1";
  const partners = [...new Set(rules.flatMap((r) => r[partnerKey] || []))].filter((id) => !opt(data, partnerKey, id)?.noPage);
  const sameDomain = PAGES.filter(
    (p) => p.o.id !== o.id && topDomains(p.o)[0] && topDomains(p.o)[0] === doms[0] && p.key === key
  ).map((p) => p.o.id);
  const relIds = [...new Set([...partners, ...sameDomain])].filter((id) => id !== o.id).slice(0, 10);
  const rel = relIds
    .map((id) => opt(data, "p1", id) || opt(data, "p3", id))
    .filter(Boolean)
    .map((x) => `<li><a href="../${x.id}/"><span aria-hidden="true">${x.emoji}</span> ${esc(x.kw)} 해몽</a></li>`)
    .join("");

  const cta = (text) => `<div class="cta-paper"><p>${text}</p>
          <a class="btn btn--primary btn--lg btn--block" href="../../?${key}=${o.id}">${o.emoji} ${esc(o.label)} 넣고 4칸으로 풀기</a></div>`;

  const body = `
      <p class="crumbs"><a href="../../">꿈 사주</a> › <a href="../">꿈해몽 사전</a> › ${esc(kw)}</p>
      <article>
        <div class="sym-hero">
          <p class="sym-kicker">꿈풀이</p>
          <div class="sym-hero__main">
            <span class="inkdot" aria-hidden="true"><span>${o.emoji}</span></span>
            <h1>${esc(kw)} 해몽</h1>
            <p class="sym-lead">${esc(polLine(o))} ${esc(sentences(o.meaning)[0])}</p>
            <div class="sym-tags"><span class="badge">${polTag(o)}</span>${doms
              .slice(0, 3)
              .map((d) => `<span class="badge">${d}운</span>`)
              .join("")}${tmLines.length ? `<span class="badge">태몽 속설</span>` : ""}</div>
          </div>
        </div>
        ${cta(`내 ${esc(kw)}의 ${isP1 ? "장소·사건·기분" : "등장·장소·기분"}까지 넣으면 등급과 재물·연애·건강 지수가 나와요.`)}

        <section class="sym-sec">
          <h2>전통 해몽으로 본 ${esc(kw)}</h2>
          <p>${esc(o.meaning)}</p>
        </section>

        ${
          variants.length
            ? `<section class="sym-sec"><h2>상황별 ${esc(kw)} 해몽</h2>${variants.join("")}</section>`
            : ""
        }

        <section class="sym-sec">
          <h2>${esc(tableTitle)}</h2>
          <table class="ptable"><thead><tr><th>${isP1 ? "장소" : "등장"}</th><th>두드러진 운</th><th>등급</th></tr></thead>
          <tbody>${rows.join("")}</tbody></table>
          <p class="blk__note">${tableNote}</p>
        </section>

        <section class="sym-sec">
          <h2>${esc(kw)}, 기분에 따라 달라져요</h2>
          <p>같은 꿈이라도 꿈속 기분에 따라 풀이가 크게 달라져요.</p>
          ${feel.join("")}
        </section>

        ${
          tmLines.length
            ? `<section class="sym-sec"><h2>${esc(kw)} 태몽 속설</h2>${tmLines.map((t) => `<p>${esc(t)}</p>`).join("")}
          <p class="blk__note">태몽 속설은 아이의 성별이나 앞날을 맞히는 근거가 없어요. 재미로만 봐 주세요.</p></section>`
            : ""
        }

        <section class="sym-sec sym-faq">
          <h2>${esc(kw)} 자주 묻는 질문</h2>
          ${faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}
        </section>

        ${rel ? `<section class="sym-sec"><h2>함께 찾는 꿈해몽</h2><ul class="dream-links">${rel}</ul></section>` : ""}

        ${cta("오늘 꾼 꿈, 아이콘 4번이면 끝나요.")}
        <p class="t-center"><a class="btn btn--ghost" href="../">꿈해몽 사전 전체 보기</a></p>
      </article>`;

  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: `${kw} 해몽 - ${o.alt.join(", ")}`,
      description,
      inLanguage: "ko",
      datePublished: UPDATED,
      dateModified: UPDATED,
      mainEntityOfPage: url,
      url,
      image: `${BASE}og.png`,
      keywords: keywords.join(", "),
      author: { "@type": "Organization", name: "꿈 사주" },
      publisher: { "@type": "Organization", name: "꿈 사주" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "꿈 사주", item: BASE },
        { "@type": "ListItem", position: 2, name: "꿈해몽 사전", item: `${BASE}s/` },
        { "@type": "ListItem", position: 3, name: `${kw} 해몽`, item: url },
      ],
    },
  ];

  return shell({ title, description, keywords, canonical: url, body, ld, depth: 2 });
}

/* ---------- 사전 목록 페이지 ---------- */
function buildIndex() {
  const url = `${BASE}s/`;
  const list = (items) =>
    `<ul class="dream-links">${items
      .map((x) => `<li><a href="${x.id}/"><span aria-hidden="true">${x.emoji}</span> ${esc(x.kw)}</a></li>`)
      .join("")}</ul>`;
  const body = `
      <p class="crumbs"><a href="../">꿈 사주</a> › 꿈해몽 사전</p>
      <article>
        <div class="sym-hero">
          <p class="sym-kicker">사전</p>
          <div class="sym-hero__main">
            <h1>꿈해몽 사전</h1>
            <p class="sym-lead">뱀꿈, 돼지꿈부터 이빨 빠지는 꿈, 죽는 꿈까지. 많이 꾸는 꿈 ${PAGES.length}가지를 전통 해몽 속설로 풀었어요.</p>
          </div>
        </div>
        <section class="sym-sec dict-group"><h2>꿈에 나온 것으로 찾기</h2>${list(P1)}</section>
        <section class="sym-sec dict-group"><h2>꿈에서 일어난 일로 찾기</h2>${list(P3.filter((o) => !o.noPage))}</section>
        <div class="cta-paper"><p>내 꿈은 4칸으로 바로 풀어 보세요.</p>
          <a class="btn btn--primary btn--lg btn--block" href="../">오늘 꾼 꿈 풀기</a></div>
      </article>`;
  const description = `꿈해몽 사전: 뱀꿈, 돼지꿈, 똥꿈, 이빨 빠지는 꿈, 죽는 꿈, 떨어지는 꿈 등 ${PAGES.length}가지 꿈을 전통 해몽 속설로 풀었어요. 상황별·기분별 풀이와 태몽 속설까지.`;
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "꿈해몽 사전",
      description,
      inLanguage: "ko",
      url,
      hasPart: PAGES.map((p) => ({ "@type": "Article", headline: `${p.o.kw} 해몽`, url: `${url}${p.o.id}/` })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "꿈 사주", item: BASE },
        { "@type": "ListItem", position: 2, name: "꿈해몽 사전", item: url },
      ],
    },
  ];
  return shell({
    title: "꿈해몽 사전 | 많이 꾸는 꿈 풀이 모음 - 꿈 사주",
    description,
    keywords: ["꿈해몽 사전", "꿈 풀이 모음", "꿈해몽", "길몽", "흉몽", "태몽"],
    canonical: url,
    body,
    ld,
    depth: 1,
  });
}

/* ---------- 쓰기 ---------- */
const outDir = path.join(SITE, "s");
fs.mkdirSync(outDir, { recursive: true });
// 데이터에서 사라진 상징의 옛 페이지는 지운다
const keep = new Set(PAGES.map((p) => p.o.id));
for (const d of fs.readdirSync(outDir, { withFileTypes: true })) {
  if (d.isDirectory() && !keep.has(d.name)) fs.rmSync(path.join(outDir, d.name), { recursive: true });
}
for (const p of PAGES) {
  const dir = path.join(outDir, p.o.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), buildPage(p));
}
fs.writeFileSync(path.join(outDir, "index.html"), buildIndex());

const urls = [BASE, `${BASE}s/`, ...PAGES.map((p) => `${BASE}s/${p.o.id}/`)];
fs.writeFileSync(
  path.join(SITE, "sitemap-part.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${UPDATED}</lastmod></url>`).join("\n")}
</urlset>
`
);

// 메인 페이지 "자주 찾는 꿈" 블록
const mainPath = path.join(SITE, "index.html");
const main = fs.readFileSync(mainPath, "utf8");
const popular = `<!-- GEN:popular (scripts/build-dream-pages.mjs 가 채워요) -->
        <ul class="dream-links">
${PAGES.map((p) => `          <li><a href="s/${p.o.id}/"><span aria-hidden="true">${p.o.emoji}</span> ${esc(p.o.kw)}</a></li>`).join("\n")}
        </ul>
        <p><a href="s/">꿈해몽 사전 전체 보기 →</a></p>
        <!-- /GEN:popular -->`;
const next = main.replace(/<!-- GEN:popular[\s\S]*?<!-- \/GEN:popular -->/, popular);
if (next === main && !main.includes("GEN:popular")) console.warn("index.html 에 GEN:popular 블록이 없어요");
fs.writeFileSync(mainPath, next);

console.log(`생성 완료: 상세 ${PAGES.length}쪽 + 사전 1쪽, sitemap ${urls.length}개 URL`);
