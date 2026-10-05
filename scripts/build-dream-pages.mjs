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
const KEYS4 = ["p1", "p2", "p3", "p4"];
const FEEL = { joy: "기뻤다면", calm: "평온했다면", flutter: "설렜다면", anxious: "불안했다면", fear: "무서웠다면", sad: "슬펐다면" };
const domainLabel = Object.fromEntries(data.domains.map((d) => [d.id, d.label]));

function gradeOf(sel) {
  return interpret(data, sel).grade;
}

function selFor(key, id, extra = {}) {
  return { p1: null, p2: "unknown", p3: "seeing", p4: "calm", [key]: id, ...extra };
}

const seal = (g) => `<span class="mini-seal${g.min < -1 ? " mini-seal--soft" : ""}">${esc(g.name)}</span>`;

/* ---------- 네 칸 계산 예시 (엔진과 같은 가중치로 점수를 풀어 보여 준다) ---------- */
const PW = { p1: 1, p2: 0.5, p3: 0.7 };
const PNAME = { p1: "등장", p2: "장소", p3: "사건", p4: "기분" };
const SEALS = { daegil: "大吉", gil: "吉", pyeong: "平", juui: "愼", gyeong: "安" };
const num = (v) => {
  const r = Math.round(v * 100) / 100;
  if (!r) return "0";
  return `${r > 0 ? "+" : "−"}${String(Math.abs(r))}`;
};
function breakdown(sel) {
  const r = interpret(data, sel);
  const rows = [];
  for (const k of ["p1", "p2", "p3"]) {
    const o = r.o[k];
    if (!o) continue;
    rows.push({ label: PNAME[k], pick: `${o.emoji} ${o.label}`, v: (o.pol || 0) * PW[k], how: PW[k] === 1 ? "" : `× ${PW[k]}` });
  }
  r.rules.forEach((x, i) => rows.push({ label: "조합", pick: x.title, v: x.pol * (i ? 0.5 : 1), how: i ? "× 0.5" : "" }));
  if (r.o.p4) rows.push({ label: PNAME.p4, pick: `${r.o.p4.emoji} ${r.o.p4.label}`, v: r.o.p4.mod || 0, how: "" });
  const sum = Math.round(rows.reduce((a, b) => a + b.v, 0) * 10) / 10;
  if (Math.abs(sum - r.score) > 0.051) throw new Error(`점수 풀이가 엔진과 달라요: ${JSON.stringify(sel)} ${sum} ≠ ${r.score}`);
  return { r, rows };
}
function exampleBlock(sel, caption) {
  const { r, rows } = breakdown(sel);
  const soft = r.grade.min < -1;
  return `<table class="ptable ptable--ex"><caption class="sr-only">${esc(caption)}</caption>
          <thead><tr><th scope="col">칸</th><th scope="col">고른 것</th><th scope="col">점수</th></tr></thead>
          <tbody>${rows
            .map((x) => `<tr><th scope="row">${x.label}</th><td>${esc(x.pick)}${x.how ? `<small>${x.how}</small>` : ""}</td><td class="num ${x.v > 0 ? "pos" : x.v < 0 ? "neg" : ""}">${num(x.v)}</td></tr>`)
            .join("")}<tr class="is-sum"><th scope="row">합계</th><td>${r.grade.moon} ${esc(r.grade.name)}</td><td class="num">${num(r.score)}</td></tr></tbody></table>
          <div class="ex-result"><span class="seal-big${soft ? " is-soft" : ""}" aria-hidden="true">${SEALS[r.grade.id] || "夢"}</span><p><b>${esc(r.grade.name)}</b> · ${esc(r.headline)}. ${esc(r.grade.sub)}</p></div>`;
}
function moodTable(base, caption, withRead = null) {
  return `<table class="ptable ptable--mood"><caption class="sr-only">${esc(caption)}</caption>
          <thead><tr><th scope="col">꿈속 기분</th><th scope="col">점수</th><th scope="col">등급</th></tr></thead>
          <tbody>${P4.map((e) => {
            const r = interpret(data, { ...base, p4: e.id });
            const read = withRead ? withRead(e) : "";
            return `<tr><th scope="row">${e.emoji} ${esc(e.label)}${read ? `<small>${esc(read)}</small>` : ""}</th><td class="num">${num(r.score)}</td><td>${r.grade.moon} ${esc(r.grade.name)}</td></tr>`;
          }).join("")}</tbody></table>`;
}
function gradeTable() {
  const g = data._grades;
  const range = (i) => (i === 0 ? `${g[0].min} 이상` : i === g.length - 1 ? `${g[i - 1].min} 미만` : `${g[i].min} ~ ${g[i - 1].min} 미만`).replace(/-/g, "−");
  return `<table class="ptable ptable--grade"><caption class="sr-only">꿈 등급과 점수 범위</caption>
          <thead><tr><th scope="col">등급</th><th scope="col">점수</th><th scope="col">뜻</th></tr></thead>
          <tbody>${g.map((x, i) => `<tr><th scope="row">${x.moon} ${esc(x.name)}</th><td class="num">${range(i)}</td><td>${esc(x.sub)}</td></tr>`).join("")}</tbody></table>`;
}
const ctaTab = (text, href, label) => `<div class="cta-tab"><p>${text}</p>
          <a class="talisman" href="${href}"><span class="talisman__head" aria-hidden="true">勅令</span><span class="talisman__label">${label}</span><span class="talisman__seal" aria-hidden="true"><span>解</span><span>夢</span></span></a></div>`;

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
      <nav id="crumb"></nav>
      <header class="topbar">
        <a class="topbar__brand" href="${up}"><span aria-hidden="true">🌙</span> 꿈 사주</a>
        <a class="btn btn--ghost btn--sm" href="${up}">4칸으로 꿈 풀기</a>
      </header>
${body}
      <nav id="more" aria-label="다른 놀이"></nav>
      <footer class="site-footer">재미로 보는 해몽이에요. 전통 해몽 속설을 바탕으로 풀었고, 실제 일을 예언하지 않아요.</footer>
    </main>
    <script type="module">
      import { renderCrumb, renderMoreSites } from "${up}../shared/kit.js";
      // 사전 페이지는 TOOLS 에 따로 없으니 꿈 사주 도구 경로로 경로·추천을 단다
      renderCrumb(document.getElementById("crumb"), "dream-saju");
      renderMoreSites(document.getElementById("more"), "dream-saju");
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
    return `<div class="variant"><h3>${esc(r.title)} ${seal(g)}</h3><p>${esc(r.text)}</p><a href="${appLink(sel)}">이 장면으로 풀어 보기 →</a></div>`;
  });

  // 장소별(등장 페이지) 또는 무엇이 나왔는지별(사건 페이지) 표
  let tableTitle;
  let tableNote;
  let rows;
  if (isP1) {
    tableTitle = `어디서 꾼 ${kw}`;
    tableNote = "특별한 일 없이 보기만 했고 마음이 평온했을 때를 기준으로 꿈 사주 풀이 규칙을 적용한 결과예요.";
    rows = P2.filter((p) => p.id !== "unknown").map((p) => {
      const r = interpret(data, selFor("p1", o.id, { p2: p.id }));
      return `<tr><td>${p.emoji} ${esc(p.label)}</td><td>${esc(r.headline)}</td><td>${esc(r.grade.name)}</td></tr>`;
    });
  } else {
    tableTitle = `무엇이 나온 ${kw}`;
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

  // 기분별 등급표 (풀이는 첫 문장만)
  const feelRead = (e) => {
    const r = rules.find((x) => x.p4 && x.p4.includes(e.id) && ["p1", "p2", "p3"].every((k) => k === key || !x[k]));
    return sentences(r ? r.text : e.read)[0];
  };
  const feel = moodTable(selFor(key, o.id), `${kw} 꿈속 기분별 등급`, feelRead);

  // 네 칸 계산 예시: 이 상징이 들어간 첫 조합 규칙의 장면으로
  const base = rules[0] || {};
  const exSel = {
    p1: isP1 ? o.id : base.p1?.[0] || [...new Set(rules.flatMap((r) => r.p1 || []))][0] || "snake",
    p2: base.p2?.[0] || "home",
    p3: isP1 ? base.p3?.[0] || "seeing" : o.id,
    p4: base.p4?.[0] || "joy",
  };
  const exName = KEYS4.map((k) => opt(data, k, exSel[k])?.label).join(" · ");

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

  const cta = (text) => ctaTab(text, `../../?${key}=${o.id}`, `${esc(o.label)} 넣고 4칸 풀기`);

  const body = `
      <article class="book">
        <p class="book__vol"><a href="../">꿈해몽 사전</a><span>${esc(kw)}</span></p>
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
        ${cta(`${isP1 ? "장소·사건·기분" : "등장·장소·기분"}까지 넣으면 등급과 재물·연애·건강 지수가 나와요.`)}

        <section class="book__sec">
          <h2><span class="bk">풀이</span>전통 해몽 속 ${esc(kw)}</h2>
          ${sentences(o.meaning).map((t) => `<p>${esc(t)}</p>`).join("")}
        </section>

        <section class="book__sec">
          <h2><span class="bk">예</span>${esc(exName)}</h2>
          <p class="book__note">점수 = 등장 + 장소×0.5 + 사건×0.7 + 맞는 조합(두 번째는 절반) + 기분</p>
          ${exampleBlock(exSel, `${exName} 꿈 점수 풀이`)}
          <p class="book__note"><a href="${appLink(exSel)}">이 네 칸 그대로 풀어 보기 →</a></p>
        </section>

        ${
          variants.length
            ? `<section class="book__sec"><h2><span class="bk">장면</span>상황별 ${esc(kw)}</h2>${variants.join("")}</section>`
            : ""
        }

        <section class="book__sec">
          <h2><span class="bk">${isP1 ? "장소" : "등장"}</span>${esc(tableTitle)}</h2>
          <table class="ptable"><thead><tr><th scope="col">${isP1 ? "장소" : "등장"}</th><th scope="col">두드러진 운</th><th scope="col">등급</th></tr></thead>
          <tbody>${rows.join("")}</tbody></table>
          <p class="book__note">${tableNote}</p>
        </section>

        <section class="book__sec">
          <h2><span class="bk">기분</span>꿈속 기분별 ${esc(kw)}</h2>
          ${feel}
        </section>

        ${
          tmLines.length
            ? `<section class="book__sec"><h2><span class="bk">태몽</span>${esc(kw)} 태몽 속설</h2>${tmLines.map((t) => `<p>${esc(t)}</p>`).join("")}
          <p class="book__note">태몽 속설은 아이의 성별이나 앞날을 맞히는 근거가 없어요. 재미로만 봐 주세요.</p></section>`
            : ""
        }

        <section class="book__sec book__faq">
          <h2><span class="bk">문답</span>${esc(kw)} 문답</h2>
          ${faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}
        </section>

        ${rel ? `<section class="book__sec"><h2><span class="bk">이웃</span>함께 찾는 꿈해몽</h2><ul class="dream-links">${rel}</ul></section>` : ""}

        ${cta("오늘 꾼 꿈, 아이콘 4번이면 끝나요.")}
        <p class="t-center"><a class="brush-link" href="../">꿈해몽 사전 전체 보기</a></p>
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
      <article class="book">
        <p class="book__vol"><a href="../">꿈 사주</a><span>꿈해몽 사전</span></p>
        <div class="sym-hero">
          <p class="sym-kicker">사전</p>
          <div class="sym-hero__main">
            <h1>꿈해몽 사전</h1>
            <p class="sym-lead">많이 꾸는 꿈 ${PAGES.length}가지를 전통 해몽 속설로 풀었어요. 꿈에 나온 것 ${P1.length}가지, 일어난 일 ${PAGES.length - P1.length}가지.</p>
          </div>
        </div>
        <section class="book__sec dict-group"><h2><span class="bk">등장</span>꿈에 나온 것으로 찾기</h2>${list(P1)}</section>
        <section class="book__sec dict-group"><h2><span class="bk">사건</span>꿈에서 일어난 일로 찾기</h2>${list(P3.filter((o) => !o.noPage))}</section>
        ${ctaTab("내 꿈은 네 칸으로 바로 풀어요.", "../", "오늘 꾼 꿈 풀기")}
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
const MAIN_EX = { p1: "snake", p2: "home", p3: "chased", p4: "fear" };
const mainExName = KEYS4.map((k) => opt(data, k, MAIN_EX[k]).label).join(" · ");
const example = `<!-- GEN:example (scripts/build-dream-pages.mjs 가 채워요) -->
        <section class="book__sec">
          <h3><span class="bk">예</span>${esc(mainExName)}</h3>
          <p class="book__note">점수 = 등장 + 장소×0.5 + 사건×0.7 + 맞는 조합(두 번째는 절반) + 기분</p>
          ${exampleBlock(MAIN_EX, `${mainExName} 꿈 점수 풀이`)}
        </section>
        <section class="book__sec">
          <h3><span class="bk">기분</span>같은 꿈, 기분만 바꾸면</h3>
          ${moodTable({ ...MAIN_EX, p4: null }, `${mainExName} 꿈의 기분별 등급`)}
          <p class="book__note">전통 해몽은 꿈속 기분을 크게 봐요. 같은 장면이 기쁨이면 ${esc(interpret(data, { ...MAIN_EX, p4: "joy" }).grade.name)}, 공포면 ${esc(interpret(data, { ...MAIN_EX, p4: "fear" }).grade.name)}이에요.</p>
        </section>
        <section class="book__sec">
          <h3><span class="bk">등급</span>다섯 단계</h3>
          ${gradeTable()}
        </section>
        <!-- /GEN:example -->`;
const next = main
  .replace(/<!-- GEN:popular[\s\S]*?<!-- \/GEN:popular -->/, popular)
  .replace(/<!-- GEN:example[\s\S]*?<!-- \/GEN:example -->/, example);
if (next === main && !main.includes("GEN:popular")) console.warn("index.html 에 GEN:popular 블록이 없어요");
fs.writeFileSync(mainPath, next);

console.log(`생성 완료: 상세 ${PAGES.length}쪽 + 사전 1쪽, sitemap ${urls.length}개 URL`);
