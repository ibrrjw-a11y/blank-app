// 사용성 공용 장치 (2026-10-06) — kit.js 가 불러온다. 디자인은 건드리지 않고 '뭘 해야 할지'만 또렷하게.
//  1) ⓘ 설명 접기: 몰라도 되는 설명 글은 숨기고, 가까운 제목 옆 ⓘ를 누르면 말풍선으로 연다(검색엔진은 숨긴 글도 그대로 읽음).
//     - 요소에 data-info 를 달거나(값 = ⓘ를 붙일 기준 요소 선택자, 비우면 바로 앞 제목), 아래 INFO_MAP 에 페이지별로 적는다.
//  2) 시작 단추 안내: 처음 온 사람이 2.5초 동안 아무것도 안 누르면 시작 단추 둘레가 반짝이고 "여기를 눌러 시작" 말풍선.
//     - 페이지마다 처음 3번만. 단추는 INFO_MAP 의 start 선택자, 없으면 #start.
//  화면이 바뀌어 새 요소가 나타나면(숨김 해제·새로 그림) 다시 적용한다.

// 페이지별 목록: path(끝 / 없이) → { hide: [[숨길 요소, ⓘ 붙일 기준(없으면 바로 앞 제목)]], start: "시작 단추" }
export const INFO_MAP = {
  // 10-06 정정: 추첨기 소개 첫 줄·단톡방 붙여넣기 안내는 "뭘 하면 되는지"라서 다시 보이게 둠(숨김 목록에서 뺌)
  "/random/winner": { start: "#draw", keep: "main.rd > p.rd-lead" },
  "/random/number": { start: "#draw", keep: "main.rd > p.rd-lead" },
  "/random": { keep: "main.rd > p.rd-lead" },
  "/name-match": { keep: "#groupPane p.t-body-03.t-secondary" },
  "/salary-live/net-pay": { hide: [["#resultCard p.receipt__fine"]] },
};
// 정확한 주소가 없으면 'xx/*' 묶음 설정을 씀
function confFor(path) {
  if (INFO_MAP[path]) return INFO_MAP[path];
  const k = Object.keys(INFO_MAP).find((key) => key.endsWith("/*") && (path + "/").startsWith(key.slice(0, -1)));
  return k ? INFO_MAP[k] : null;
}

const CSS = `
.gw-i{display:inline-grid;place-items:center;width:22px;height:22px;margin:0 0 0 6px;padding:0;border:1.5px solid currentColor;border-radius:50%;background:transparent;color:inherit;opacity:.65;
  font:700 12px/1 -apple-system,"Malgun Gothic",sans-serif;cursor:pointer;vertical-align:middle;flex:none;-webkit-tap-highlight-color:transparent}
.gw-i:hover,.gw-i[aria-expanded="true"]{opacity:1}
.gw-info-hidden{display:none!important}
.gw-more{display:flex;align-items:center;justify-content:center;gap:8px;width:calc(100% - 32px);max-width:560px;min-height:46px;margin:20px auto;padding:0 16px;border:1.5px dashed currentColor;border-radius:14px;
  background:transparent;color:inherit;opacity:.78;font:700 14px/1.2 "Pretendard Variable",Pretendard,-apple-system,"Malgun Gothic",sans-serif;cursor:pointer}
.gw-more:hover{opacity:1}
.gw-more--opt{width:100%;margin:4px 0;min-height:44px;font-size:13.5px}
.gw-more b{font-weight:400;transition:transform .2s}
.gw-more[aria-expanded="true"] b{transform:rotate(180deg)}
.gw-pop{position:fixed;z-index:9000;max-width:min(340px,calc(100vw - 24px));max-height:60vh;overflow:auto;padding:14px 16px;border-radius:14px;background:#fff;color:#1b1b1b;
  box-shadow:0 12px 40px rgba(0,0,0,.28),0 0 0 1px rgba(0,0,0,.06);font:400 14px/1.6 "Pretendard Variable",Pretendard,-apple-system,"Malgun Gothic",sans-serif;text-align:left;word-break:keep-all;animation:gwpop .18s ease-out}
.gw-pop *{color:inherit!important;background:transparent!important;font-family:inherit!important;max-width:100%}
.gw-pop .gw-pop__x{position:sticky;float:right;top:0;margin:-6px -8px 0 8px;width:28px;height:28px;border:0;border-radius:50%;background:#f1efe9!important;font:700 14px/1 inherit;cursor:pointer}
@keyframes gwpop{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
.gw-nudge-ring{position:fixed;z-index:8999;pointer-events:none;border-radius:18px;box-shadow:0 0 0 3px #ffd23f,0 0 0 9px rgba(255,210,63,.35);animation:gwring 1.2s ease-in-out infinite}
.gw-nudge-tip{position:fixed;z-index:9000;pointer-events:none;padding:8px 12px;border-radius:12px;background:#141414;color:#fff;font:800 13px/1 "Pretendard Variable",Pretendard,-apple-system,"Malgun Gothic",sans-serif;white-space:nowrap;animation:gwtip .9s ease-in-out infinite alternate}
.gw-nudge-tip::after{content:"";position:absolute;left:50%;top:100%;margin-left:-6px;border:6px solid transparent;border-top-color:#141414}
@keyframes gwring{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:1;transform:scale(1.04)}}
@keyframes gwtip{from{transform:translateY(0)}to{transform:translateY(-4px)}}
@media (prefers-reduced-motion:reduce){.gw-nudge-ring,.gw-nudge-tip,.gw-pop{animation:none}}
`;

const pathKey = () => location.pathname.replace(/index\.html$/, "").replace(/\/$/, "") || "/";

function injectCSS() {
  if (document.getElementById("gw-ux-css")) return;
  const s = document.createElement("style");
  s.id = "gw-ux-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

/* ---------- 1) ⓘ 설명 접기 ---------- */
let pop = null;
function closePop() {
  if (!pop) return;
  pop.btn?.setAttribute("aria-expanded", "false");
  pop.el.remove();
  pop = null;
}
function openPop(btn, src) {
  if (pop && pop.btn === btn) return closePop();
  closePop();
  const el = document.createElement("div");
  el.className = "gw-pop";
  el.setAttribute("role", "dialog");
  el.innerHTML = `<button class="gw-pop__x" type="button" aria-label="닫기">✕</button>`;
  const clone = src.cloneNode(true);
  clone.classList.remove("gw-info-hidden");
  clone.removeAttribute("hidden");
  clone.removeAttribute("data-info");
  clone.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
  clone.removeAttribute("id");
  el.appendChild(clone);
  document.body.appendChild(el);
  const r = btn.getBoundingClientRect();
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  let left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), innerWidth - w - 12);
  let top = r.bottom + 8;
  if (top + h > innerHeight - 12) top = Math.max(12, r.top - h - 8);
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  btn.setAttribute("aria-expanded", "true");
  el.querySelector(".gw-pop__x").addEventListener("click", closePop);
  pop = { btn, el };
}
addEventListener("pointerdown", (e) => {
  if (pop && !pop.el.contains(e.target) && e.target !== pop.btn) closePop();
}, true);
addEventListener("keydown", (e) => e.key === "Escape" && closePop());
addEventListener("scroll", closePop, { passive: true });

function anchorFor(el) {
  const sel = el.getAttribute("data-info");
  if (sel) {
    const a = document.querySelector(sel);
    if (a) return a;
  }
  // 바로 앞 형제 중 제목 같은 것 → 없으면 부모의 첫 제목
  let p = el.previousElementSibling;
  while (p) {
    if (/^H[1-6]$/.test(p.tagName) || p.matches?.("legend,label,.block__title,[class*='title']")) return p;
    p = p.previousElementSibling;
  }
  // 자동으로 찾은 설명 글은 제목·칸 이름이 확실할 때만 숨김. 못 찾으면 ⓘ가 빈 줄에 혼자 떠서 더 헷갈리므로 그대로 둔다
  if (el.hasAttribute("data-info-auto")) return autoAnchor(el);
  return el.parentElement?.querySelector("h1,h2,h3,h4,legend,[class*='title']") || el.parentElement;
}
const HEAD_SEL = "h1,h2,h3,h4,h5,legend,label,[class*='title'],[class*='label'],[class*='head']";
function autoAnchor(el) {
  let node = el;
  for (let depth = 0; depth < 3 && node && node !== document.body; depth++) {
    const parent = node.parentElement;
    if (!parent) break;
    // 이 요소보다 앞에 있는 제목 중 가장 가까운 것
    const heads = [...parent.querySelectorAll(HEAD_SEL)].filter(
      (h) => h !== el && !el.contains(h) && !h.contains(el) &&
        (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) &&
        !h.matches("button,a,input,select,textarea") && !h.closest("button,a") &&
        (h.textContent || "").trim().length >= 2 && h.getClientRects().length
    );
    if (heads.length) return heads[heads.length - 1];
    node = parent;
  }
  return null;
}
function applyInfo() {
  const conf = confFor(pathKey());
  conf?.hide?.forEach(([sel, anchor]) =>
    document.querySelectorAll(sel).forEach((el) => {
      if (!el.hasAttribute("data-info")) el.setAttribute("data-info", anchor || "");
    })
  );
  document.querySelectorAll("[data-info]:not([data-info-done])").forEach((el) => {
    const a = anchorFor(el);
    // ⓘ를 붙일 제목이 화면에 안 보이면(숨은 제목·접힌 칸) 설명을 숨기지 않는다 — 설명이 사라지는 일이 없게
    if (a && el.hasAttribute("data-info-auto") && (!a.getClientRects().length || getComputedStyle(a).visibility === "hidden")) {
      el.setAttribute("data-info-done", "skip");
      return;
    }
    if (!a || a === el) {
      if (el.hasAttribute("data-info-auto")) el.setAttribute("data-info-done", "skip");
      return;
    }
    el.setAttribute("data-info-done", "1");
    el.classList.add("gw-info-hidden");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "gw-i";
    btn.textContent = "i";
    btn.setAttribute("aria-label", "설명 보기");
    btn.setAttribute("aria-expanded", "false");
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openPop(btn, el);
    });
    // 제목 안에 넣되, 버튼·링크 안이면 바로 뒤에
    if (a.matches("button,a,input,select,textarea")) a.insertAdjacentElement("afterend", btn);
    else a.appendChild(btn);
  });
}

/* ---------- 1-1) 설명 글 자동 접기 (2026-10-06) ----------
 * 사용자 의견: "말이 너무 많아서 뭘 해야 할지 모르겠다". 화면 곳곳의 설명 문장(소개·도움말·힌트·주석·부제)을 찾아 ⓘ 안으로.
 * 남기는 것: 제목·입력칸 이름·단추·숫자·상태·오류(즉시 읽혀야 함)·결과·해석 본문. 페이지별로 keep 에 적은 것도 남김 */
const AUTO_SEL = [
  ".field__help", ".block__hint", ".intro__desc", ".rd-lead", ".lead", ".rulebook__lead",
  "[class*='__desc']", "[class*='__note']", "[class*='__hint']", "[class*='__sub']", "[class*='__caption']", "[class*='__help']",
  "p.t-secondary", "p.t-tertiary", "p.t-caption-01", "span.t-caption-01", "p.note", "p.hint", "p.help", "p.desc", "p.sub",
].join(",");
const KEEP = [
  "button", "a", "[aria-live]", "[role=alert]", ".err", ".error", ".msg", "[class*='count']", "[class*='stat']",
  "[data-view='result']", "[data-view='res']", ".res", ".result", "#result", "#res", ".rd", ".life", ".ma__scene", ".ma__band", ".ma__why",
  "article.seo", ".gw-pop", "nav", "footer", "header.topbar .t-caption-01", ".more-sites", ".gw-mark", ".sheet.is-open .res",
].join(",");
function autoInfo() {
  const conf = confFor(pathKey());
  const keep = conf?.keep ? `${KEEP},${conf.keep}` : KEEP;
  document.querySelectorAll(AUTO_SEL).forEach((el) => {
    if (el.hasAttribute("data-info") || el.hasAttribute("data-noinfo") || el.closest("[data-noinfo]")) return;
    if (el.closest(keep) || el.querySelector("input,select,textarea,button,a,canvas,svg,img")) return;
    const t = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (t.length < 14) return;                       // 짧은 말(단위·상태)은 그대로
    if (/\d/.test(t) && t.length < 28) return;      // 짧은 숫자 줄(기록·상태)은 그대로
    // "뭘 하면 되는지" 알려 주는 짧은 안내(넣어 주세요·눌러·골라 등)는 화면에 남김. 길게 늘어놓은 설명만 ⓘ 안으로
    // 사용자 정정(10-06): "설명을 아예 없애라는 게 아니야" → 한 줄 안내(무슨 놀이인지·뭘 하면 되는지)는 보이게 두고,
    // 긴 설명(60자 넘음)과 주의 문구(재미로·진단 아님·차이가 있을 수 있음 등)만 ⓘ 안으로
    const DISCLAIM = /(재미로 보는|진단이 아니|근거가 아니|차이가 있을 수|보장하지|참고용)/;
    if (t.length <= 60 && !DISCLAIM.test(t)) return;
    el.setAttribute("data-info", "");
    el.setAttribute("data-info-auto", "1");
  });
}

/* ---------- 1-2) 설명서 접기 ----------
 * 놀이 화면 바로 아래 펼쳐져 있던 검색용 설명서·자주 묻는 질문(article.seo)을 한 줄 단추로 접는다.
 * 주소에 #guide 가 있거나 단추를 누르면 펼침. 글은 그대로 남아 검색엔진이 읽는다 */
function foldGuides() {
  document.querySelectorAll("article.seo:not([data-fold])").forEach((art) => {
    art.setAttribute("data-fold", "1");
    if (location.hash === "#guide") return;
    art.classList.add("gw-info-hidden");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "gw-more";
    b.setAttribute("aria-expanded", "false");
    b.innerHTML = "설명서 · 자주 묻는 질문 <b>▾</b>";
    b.addEventListener("click", () => {
      const open = art.classList.toggle("gw-info-hidden") === false;
      b.setAttribute("aria-expanded", String(open));
      b.firstChild.textContent = open ? "설명서 접기 " : "설명서 · 자주 묻는 질문 ";
    });
    art.insertAdjacentElement("beforebegin", b);
  });
}

/* ---------- 1-3) 선택 사항 접기 ---------- */
function foldOptional() {
  const conf = confFor(pathKey());
  conf?.fold?.forEach(([sel, label]) =>
    document.querySelectorAll(sel).forEach((el) => {
      if (el.hasAttribute("data-fold")) return;
      el.setAttribute("data-fold", "1");
      el.classList.add("gw-info-hidden");
      const b = document.createElement("button");
      b.type = "button";
      b.className = "gw-more gw-more--opt";
      b.setAttribute("aria-expanded", "false");
      b.innerHTML = `${label} <b>▾</b>`;
      b.addEventListener("click", () => {
        el.classList.remove("gw-info-hidden");
        b.remove();
      });
      el.insertAdjacentElement("beforebegin", b);
    })
  );
}

/* ---------- 2) 시작 단추 안내 ---------- */
let nudgeT = 0;
let nudged = false;
function nudge() {
  const conf = confFor(pathKey());
  const key = `gw:nudge:${pathKey()}`;
  let n = 0;
  try { n = +localStorage.getItem(key) || 0; } catch { /* 저장 불가 */ }
  if (n >= 3 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const stop = () => {
    clearTimeout(nudgeT);
    document.querySelectorAll(".gw-nudge-ring,.gw-nudge-tip").forEach((x) => x.remove());
    removeEventListener("pointerdown", stop, true);
    removeEventListener("keydown", stop, true);
    removeEventListener("scroll", place, true);
  };
  let btn = null;
  const place = () => {
    const ring = document.querySelector(".gw-nudge-ring");
    const tip = document.querySelector(".gw-nudge-tip");
    if (!ring || !btn) return;
    const r = btn.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight || !r.width) return stop();
    Object.assign(ring.style, { left: `${r.left - 4}px`, top: `${r.top - 4}px`, width: `${r.width + 8}px`, height: `${r.height + 8}px` });
    tip.style.left = `${Math.min(Math.max(8, r.left + r.width / 2 - tip.offsetWidth / 2), innerWidth - tip.offsetWidth - 8)}px`;
    tip.style.top = `${r.top - tip.offsetHeight - 12}px`;
  };
  addEventListener("pointerdown", stop, true);
  addEventListener("keydown", stop, true);
  nudgeT = setTimeout(() => {
    btn = document.querySelector(conf?.start || "#start");
    if (!btn || btn.closest("[hidden]")) return stop();
    const r = btn.getBoundingClientRect();
    if (!r.width || r.top > innerHeight - 20 || r.bottom < 0) return stop();
    nudged = true;
    try { localStorage.setItem(key, String(n + 1)); } catch { /* 무시 */ }
    const ring = document.createElement("div");
    ring.className = "gw-nudge-ring";
    const tip = document.createElement("div");
    tip.className = "gw-nudge-tip";
    tip.textContent = "여기를 눌러 시작";
    document.body.append(ring, tip);
    place();
    addEventListener("scroll", place, true);
  }, 2500);
}

export function startUX() {
  injectCSS();
  autoInfo();
  applyInfo();
  foldGuides();
  foldOptional();
  let t = 0;
  new MutationObserver(() => {
    clearTimeout(t);
    t = setTimeout(() => { autoInfo(); applyInfo(); foldGuides(); foldOptional(); }, 60);
  }).observe(document.body, { childList: true, subtree: true });
  if (!nudged) nudge();
}
