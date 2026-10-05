// 홈(층별 안내도)과 카테고리(층) 페이지를 shared/sites.js 에서 정적 HTML로 생성한다.
// 검색엔진이 링크를 바로 읽을 수 있도록 목록을 HTML에 직접 쓴다.
// 사용: node scripts/build-hubs.mjs
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const { CATEGORIES, TOOLS } = await import(path.join(root, "shared/sites.js"));
const { domain } = JSON.parse(fs.readFileSync(path.join(root, "site.config.json"), "utf8"));

const BRAND = "심심상가";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// 층마다 안내판 색 (실제 상가 안내도처럼 층별 색 띠)
const FLOOR_COLOR = {
  pick: "#e8452c",
  test: "#2f6fdb",
  fortune: "#7a4bc2",
  game: "#f2b705",
  calc: "#1f9d57",
  together: "#e0457b",
};

function brandOf(toolPath) {
  for (const f of ["style.css", "index.html"]) {
    const p = path.join(root, toolPath, f);
    if (!fs.existsSync(p)) continue;
    const m = fs.readFileSync(p, "utf8").match(/--brand:\s*(#[0-9a-fA-F]{3,8})/);
    if (m) return m[1];
  }
  // 하위 페이지는 부모 폴더 색을 쓴다
  const parent = toolPath.split("/").slice(0, -1).join("/");
  return parent ? brandOf(parent) : "#333333";
}

const exists = (p) => fs.existsSync(path.join(root, p, "index.html"));
const floorNo = (c) => CATEGORIES.indexOf(c) + 1;

const CATEGORY_SEO = {
  pick: {
    title: "룰렛 돌리기·사다리타기·제비뽑기 모음",
    desc: "룰렛 돌림판, 사다리타기, 캡슐 제비뽑기, 팀 나누기, 구슬 레이스까지. 내기와 벌칙을 공정하게 정하는 무료 추첨 도구 모음이에요.",
    keywords: "룰렛 돌리기, 돌림판, 사다리타기, 제비뽑기, 팀 나누기, 랜덤 추첨, 복불복",
    guide: [
      ["사람끼리 순서·당첨자 정하기", "사다리타기, 제비뽑기"],
      ["메뉴·벌칙처럼 항목 중 하나 고르기", "룰렛 돌리기"],
      ["여러 명을 조로 나누기", "팀 나누기"],
      ["커피 내기를 구경거리로 만들기", "구슬 레이스, 배틀로얄, 통아저씨"],
    ],
  },
  test: {
    title: "무료 심리테스트 모음",
    desc: "친구가 정해주는 MBTI, 테토·에겐, 애착 유형, 연애 동물, 꼰대력까지. 결과를 친구와 비교할 수 있는 심리테스트 모음이에요.",
    keywords: "심리테스트, MBTI 검사, 테토 에겐 테스트, 애착 유형 테스트, 연애 유형 테스트, 꼰대 테스트",
    guide: [
      ["친구 눈에 비친 나", "남이 정해주는 MBTI"],
      ["요즘 유행하는 성향 테스트", "테토·에겐 테스트"],
      ["연애할 때의 나", "애착 유형 테스트, 연애 세포 테스트"],
      ["회사·단톡방에서 웃자고", "꼰대력 테스트"],
    ],
  },
  fortune: {
    title: "사주 대운·꿈해몽 무료 풀이",
    desc: "생년월일시로 보는 대운 그래프와 손 없는 날, 꿈을 4칸에 넣어 푸는 꿈해몽까지. 재미로 보는 운세 모음이에요.",
    keywords: "대운, 사주, 무료 사주, 꿈해몽, 태몽, 손 없는 날, 길일",
    guide: [
      ["인생 흐름과 좋은 날짜", "나 상장하기 (대운 차트·택일 달력)"],
      ["간밤에 꾼 꿈", "꿈 사주"],
    ],
  },
  game: {
    title: "심심할 때 하는 무료 웹게임 모음",
    desc: "매일 바뀌는 데일리 퀴즈 4종, 1 to 50, 탑 쌓기, 2048, 뇌 나이 측정까지. 설치 없이 바로 하는 미니게임 모음이에요.",
    keywords: "웹게임, 미니게임, 데일리 퀴즈, 1 to 50, 탑 쌓기, 2048, 반응속도 테스트",
    guide: [
      ["하루 3분, 매일 새 문제", "줌아웃 퀴즈, 오늘의 동네, 그때 그 가격, 추억 연대기"],
      ["순발력 기록 깨기", "1 to 50, 탑 쌓기"],
      ["느긋한 퍼즐", "2048"],
      ["부모님과 같이", "뇌 나이 측정소"],
    ],
  },
  calc: {
    title: "연봉 실수령액·만나이 생활 계산기",
    desc: "2026년 요율로 계산하는 연봉 실수령액, 만나이 계산기, 실시간 월급 카운터, 인생 진행률까지. 자주 찾는 생활 계산기 모음이에요.",
    keywords: "연봉 실수령액 계산기, 만나이 계산기, 월급 계산기, 시급 계산기, 살아온 날 계산",
    guide: [
      ["월급에서 실제로 받는 돈", "연봉 실수령액 계산기"],
      ["나이 정확히 세기", "만나이 계산기"],
      ["재미로 보는 숫자", "실시간 월급 카운터, 인생 진행률"],
    ],
  },
  together: {
    title: "커플 디데이·이름궁합·약속 장소 정하기",
    desc: "커플 100일 계산과 오늘의 질문, 단톡방 전원 이름궁합, 다같이 고르는 메뉴·중간지점까지. 둘 이상이 같이 쓰는 도구 모음이에요.",
    keywords: "커플 디데이, 100일 계산기, 이름궁합, 중간지점 찾기, 점심메뉴 추천",
    guide: [
      ["연인과 기념일 챙기기", "커플 디데이"],
      ["단톡방에서 웃자고", "단톡방 궁합표"],
      ["약속 장소·메뉴 정하기", "어디가?"],
    ],
  },
};

const HEAD = (title, desc, keywords, canonical, depth, ogImage) => `<!doctype html>
<html lang="ko" data-theme="light">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(desc)}" />
    <meta name="keywords" content="${esc(keywords)}" />
    <link rel="canonical" href="${canonical}" />
    <meta name="theme-color" content="#e6e3dc" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="ko_KR" />
    <meta property="og:site_name" content="${BRAND}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(desc)}" />
    <meta property="og:image" content="${ogImage}" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='14' fill='%23f7f6f2'/><rect x='10' y='14' width='80' height='14' fill='%23e8452c'/><rect x='10' y='34' width='80' height='14' fill='%232f6fdb'/><rect x='10' y='54' width='80' height='14' fill='%23f2b705'/><rect x='10' y='74' width='80' height='14' fill='%231f9d57'/></svg>" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gothic+A1:wght@500;700;900&family=Archivo:wght@600;800&display=swap" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
    <link rel="stylesheet" href="${depth}shared/components.css" />
    <link rel="stylesheet" href="${depth}shared/hub.css" />`;

function toolRow(t, i) {
  const ready = exists(t.path);
  const color = brandOf(t.path);
  return `<li class="store${ready ? "" : " is-soon"}" style="--i:${i};--sign:${color}">
          ${
            ready
              ? `<a class="store__sign" href="../${t.path}/">`
              : `<span class="store__sign" aria-disabled="true">`
          }
            <span class="store__name">${esc(t.name)}</span>
            <span class="store__desc">${esc(t.desc)}</span>
            <span class="store__go" aria-hidden="true">${ready ? "→" : "준비 중"}</span>
          ${ready ? "</a>" : "</span>"}
        </li>`;
}

// ---------- 카테고리(층) 페이지 ----------
for (const c of CATEGORIES) {
  const seo = CATEGORY_SEO[c.id];
  const tools = TOOLS.filter((t) => t.cat === c.id);
  const n = floorNo(c);
  const up = CATEGORIES[n]; // 위층
  const down = CATEGORIES[n - 2]; // 아래층
  const title = `${seo.title} | ${BRAND} ${n}층 ${c.name}`;
  const html = `${HEAD(title, seo.desc, seo.keywords, `${domain}/${c.path}/`, "../", "og.png")}
    <script type="application/ld+json">
      ${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `${c.name} - ${BRAND}`,
        description: seo.desc,
        inLanguage: "ko",
        hasPart: tools.filter((t) => exists(t.path)).map((t) => ({ "@type": "WebApplication", name: t.name, url: `${domain}/${t.path}/` })),
      })}
    </script>
  </head>
  <body class="floor" style="--floor:${FLOOR_COLOR[c.id]}">
    <div class="doors" aria-hidden="true"><i></i><i></i></div>
    <main class="app">
      <nav class="hub-top" aria-label="위치">
        <a class="hub-top__home" href="../">${BRAND}</a>
        <span class="hub-top__lift">
          ${down ? `<a href="../${down.path}/" aria-label="${floorNo(down)}층 ${down.name}">▼ ${floorNo(down)}F</a>` : "<span>▼</span>"}
          ${up ? `<a href="../${up.path}/" aria-label="${floorNo(up)}층 ${up.name}">▲ ${floorNo(up)}F</a>` : "<span>▲</span>"}
        </span>
      </nav>

      <header class="floor-head">
        <span class="floor-head__no">${n}<small>F</small></span>
        <div class="floor-head__text">
          <h1>${esc(c.name)}</h1>
          <p>${esc(c.desc)}</p>
        </div>
      </header>

      <ol class="stores">
        ${tools.map(toolRow).join("\n        ")}
      </ol>

      <section class="pick-guide" aria-labelledby="guide-h">
        <h2 id="guide-h">이럴 땐 이 가게</h2>
        <table>
          <tbody>
            ${seo.guide.map(([when, what]) => `<tr><th scope="row">${esc(when)}</th><td>${esc(what)}</td></tr>`).join("\n            ")}
          </tbody>
        </table>
      </section>

      <nav class="floors-mini" aria-label="다른 층">
        ${CATEGORIES.map((o) => `<a href="../${o.path}/" style="--fc:${FLOOR_COLOR[o.id]}"${o.id === c.id ? ' aria-current="page"' : ""}><b>${floorNo(o)}F</b>${esc(o.name)}</a>`).join("\n        ")}
      </nav>
      <footer class="hub-foot">${BRAND} · 기록은 쓰는 사람의 브라우저에만 저장돼요</footer>
    </main>
    <script type="module" src="../shared/hub.js"></script>
  </body>
</html>
`;
  fs.mkdirSync(path.join(root, c.path), { recursive: true });
  fs.writeFileSync(path.join(root, c.path, "index.html"), html);
  console.log("floor", c.path, tools.length);
}

// ---------- 홈: 층별 안내도 ----------
const homeTitle = `심심할 때 하는 것 모음 | ${BRAND} - 룰렛·심리테스트·미니게임·계산기`;
const homeDesc = "룰렛 돌리기, 사다리타기, 심리테스트, 꿈해몽, 미니게임, 연봉 실수령액 계산기까지. 심심할 때 들르는 무료 도구 상가예요.";
const floorsDesc = [...CATEGORIES].reverse();
const home = `${HEAD(homeTitle, homeDesc, "심심할때 하는것, 심심풀이, 룰렛, 사다리타기, 심리테스트, 미니게임, 웹게임, 계산기", `${domain}/`, "", "og.png")}
    <script type="application/ld+json">
      ${JSON.stringify({ "@context": "https://schema.org", "@type": "WebSite", name: BRAND, url: `${domain}/`, inLanguage: "ko", description: homeDesc })}
    </script>
  </head>
  <body class="lobby">
    <main class="app">
      <header class="lobby-head">
        <p class="lobby-head__eyebrow">심심할 때 들르는 곳</p>
        <h1 class="lobby-head__name" aria-label="${BRAND}">${[...BRAND].map((ch, i) => `<span style="--i:${i}">${ch}</span>`).join("")}</h1>
      </header>

      <section class="directory" aria-labelledby="dir-h">
        <div class="directory__bar"><h2 id="dir-h">층별 안내</h2><span>FLOOR GUIDE</span></div>
        <ol class="directory__floors">
          ${floorsDesc
            .map((c, i) => {
              const tools = TOOLS.filter((t) => t.cat === c.id && !t.path.includes("/"));
              return `<li style="--i:${i};--fc:${FLOOR_COLOR[c.id]}">
            <a href="${c.path}/">
              <span class="dir-no">${floorNo(c)}F</span>
              <span class="dir-body">
                <span class="dir-name">${esc(c.name)}</span>
                <span class="dir-stores">${tools.map((t) => esc(t.name)).join(" · ")}</span>
              </span>
            </a>
          </li>`;
            })
            .join("\n          ")}
        </ol>
        <div class="directory__here"><i aria-hidden="true"></i>현재 위치 · 1층 로비</div>
      </section>

      <section class="lobby-list" aria-labelledby="all-h">
        <h2 id="all-h">전체 매장 ${TOOLS.filter((t) => exists(t.path)).length}곳</h2>
        ${CATEGORIES.map(
          (c) => `<div class="lobby-cat" style="--fc:${FLOOR_COLOR[c.id]}">
          <h3><a href="${c.path}/">${floorNo(c)}F ${esc(c.name)}</a></h3>
          <ul>${TOOLS.filter((t) => t.cat === c.id && exists(t.path))
            .map((t) => `<li><a href="${t.path}/">${esc(t.name)}</a></li>`)
            .join("")}</ul>
        </div>`
        ).join("\n        ")}
      </section>
      <footer class="hub-foot">${BRAND} · 재미로 즐기는 도구 모음 · 기록은 쓰는 사람의 브라우저에만 저장돼요</footer>
    </main>
    <script type="module" src="shared/hub.js"></script>
  </body>
</html>
`;
fs.writeFileSync(path.join(root, "index.html"), home);
console.log("home");
