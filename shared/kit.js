// 공통 유틸. 각 사이트는 <script type="module"> 에서 import 해서 쓴다.
// 서버 없이 동작하는 것이 기본 원칙: 상태 공유는 URL, 개인 기록은 localStorage.
import { TOOLS, toolByPath } from "./sites.js";

/* ---------- 페이지 이동 시 항상 맨 위에서 시작 ----------
 * 다른 페이지로 넘어왔을 때 이전 스크롤 위치가 복원되며 아래에서 시작하던 문제를 막는다.
 * 뒤로 가기(back_forward)일 때만 브라우저 복원을 그대로 둔다. */
(function resetScrollOnEnter() {
  try {
    const nav = performance.getEntriesByType?.("navigation")?.[0];
    if (nav && nav.type === "back_forward") return;
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    const top = () => window.scrollTo(0, 0);
    top();
    addEventListener("DOMContentLoaded", top, { once: true });
    addEventListener("load", top, { once: true });
  } catch {
    /* noop */
  }
})();

// 사이트 루트 URL (kit.js 는 /shared/ 에 있으므로 한 단계 위)
export const ROOT_URL = new URL("../", import.meta.url).href;

/* ---------- Guess What 표시 (2026-10-06 통합) ----------
 * 모든 페이지 맨 위에 작은 'Guess What?' 한 줄과 첫 화면 가는 길 하나만 붙인다.
 * 색은 각 사이트 테마의 글자 색을 그대로 따라가서 장르 디자인을 깨지 않게 한다. 경로 표시·카테고리 칩은 넣지 않는다. */
(function guessWhatMark() {
  const put = () => {
    if (document.querySelector(".gw-mark")) return;
    const a = document.createElement("a");
    a.className = "gw-mark";
    a.href = ROOT_URL;
    a.innerHTML = 'Guess What<b>?</b><span>다른 맞히기</span>';
    document.body.prepend(a);
  };
  if (document.body) put();
  else addEventListener("DOMContentLoaded", put, { once: true });
})();

// 현재 페이지의 도구 경로 (예: "ddanjit/zoom"). 루트·카테고리 페이지면 ""
export function currentPath() {
  const rel = decodeURIComponent(location.href.slice(ROOT_URL.length).split(/[?#]/)[0]);
  return rel.replace(/index\.html$/, "").replace(/\/$/, "");
}

// 등록된 도구 중 가장 가까운 상위 경로 (예: "dream-saju/s/snake" → "dream-saju")
export function resolveToolPath(p = currentPath()) {
  const parts = String(p).split("/").filter(Boolean);
  while (parts.length) {
    const candidate = parts.join("/");
    if (toolByPath(candidate)) return candidate;
    parts.pop();
  }
  return "";
}

export const urlOf = (path) => (path ? `${ROOT_URL}${path}/` : ROOT_URL);

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const prefersReducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- 저장소 (비공개 창 등에서 실패해도 동작) ---------- */
export function createStore(namespace) {
  const key = (k) => `${namespace}:${k}`;
  return {
    get(k, fallback = null) {
      try {
        const raw = localStorage.getItem(key(k));
        return raw == null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(k, value) {
      try {
        localStorage.setItem(key(k), JSON.stringify(value));
      } catch {
        /* 저장 불가 환경은 무시 */
      }
    },
    remove(k) {
      try {
        localStorage.removeItem(key(k));
      } catch {
        /* noop */
      }
    },
  };
}

/* ---------- 토스트 ---------- */
let toastEl;
let toastTimer;
export function toast(message, ms = 2200) {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.className = "toast";
    toastEl.setAttribute("role", "status");
    toastEl.setAttribute("aria-live", "polite");
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = message;
  requestAnimationFrame(() => toastEl.classList.add("is-show"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("is-show"), ms);
}

/* ---------- 진동 ---------- */
export function haptic(pattern = 12) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* noop */
  }
}

/* ---------- 공유 ---------- */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

// 모바일은 OS 공유 시트(카카오톡 포함), 데스크톱은 링크 복사
export async function share({ title = document.title, text = "", url = location.href } = {}) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return "shared";
    } catch (e) {
      if (e && e.name === "AbortError") return "cancelled";
    }
  }
  const ok = await copyText(text ? `${text}\n${url}` : url);
  toast(ok ? "링크를 복사했어요. 단톡방에 붙여넣어 주세요" : "복사에 실패했어요");
  return ok ? "copied" : "failed";
}

// 결과 이미지를 공유 시트로 보내고, 안 되면 저장
export async function shareImage(canvas, { filename = "result.png", title = document.title, text = "" } = {}) {
  const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
  if (!blob) return "failed";
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text });
      return "shared";
    } catch (e) {
      if (e && e.name === "AbortError") return "cancelled";
    }
  }
  downloadBlob(blob, filename);
  toast("이미지를 저장했어요");
  return "downloaded";
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ---------- URL 상태 (서버 없이 친구에게 상태 전달) ---------- */
export function encodeState(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeState(str) {
  try {
    const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

export function urlWith(params, base = location.origin + location.pathname) {
  const u = new URL(base);
  Object.entries(params).forEach(([k, v]) => {
    if (v != null) u.searchParams.set(k, v);
  });
  return u.toString();
}

export const getParam = (name) => new URLSearchParams(location.search).get(name);

/* ---------- 결정적 랜덤 (데일리 콘텐츠, 재현 가능한 결과) ---------- */
export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededRandom(seed) {
  let a = typeof seed === "number" ? seed >>> 0 : hashString(String(seed));
  return function mulberry32() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, rand = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 한국 시간 기준 날짜 키 (YYYY-MM-DD)
export function todayKey(date = new Date()) {
  const kst = new Date(date.getTime() + (date.getTimezoneOffset() + 540) * 60000);
  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, "0");
  const d = String(kst.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// 기준일부터 며칠째인지 (데일리 문제 번호)
export function dayNumber(epoch = "2026-01-01", date = new Date()) {
  const [y, m, d] = todayKey(date).split("-").map(Number);
  const [ey, em, ed] = epoch.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ey, em - 1, ed)) / 86400000) + 1;
}

/* ---------- 숫자 포맷 ---------- */
export const fmt = {
  num: (n, digits = 0) =>
    Number(n).toLocaleString("ko-KR", { maximumFractionDigits: digits, minimumFractionDigits: digits }),
  won: (n) => `${Math.round(n).toLocaleString("ko-KR")}원`,
  // 12,345,678 → "1,234만 5,678원" 처럼 읽기 쉬운 한국식
  wonKo(n) {
    n = Math.round(n);
    const eok = Math.floor(n / 1e8);
    const man = Math.floor((n % 1e8) / 1e4);
    const rest = n % 1e4;
    const parts = [];
    if (eok) parts.push(`${eok.toLocaleString("ko-KR")}억`);
    if (man) parts.push(`${man.toLocaleString("ko-KR")}만`);
    if (rest || !parts.length) parts.push(rest.toLocaleString("ko-KR"));
    return parts.join(" ") + "원";
  },
};

/* ---------- 인트로 (첫 화면 모션그래픽) ----------
 * 사이트는 장면(scene)을 배열로 넘긴다. 각 장면은 캡션과 play(stage) 함수를 가진다.
 * runIntro 가 캡션 교체, 단계 표시, 자동 반복, 건너뛰기를 맡는다.
 *
 * runIntro({
 *   root: $("#intro"),             // .intro 요소 (.intro__stage, .intro__caption, .intro__steps 포함)
 *   scenes: [{ title, desc, duration, play(stage, signal) }],
 *   loop: true,
 * })
 */
export function runIntro({ root, scenes, loop = true }) {
  const stage = root.querySelector(".intro__stage");
  const caption = root.querySelector(".intro__caption");
  const steps = root.querySelector(".intro__steps");
  let index = 0;
  let timer;
  let controller;
  let stopped = false;

  if (steps) {
    steps.innerHTML = scenes.map(() => "<span></span>").join("");
  }

  function show(i) {
    if (stopped) return;
    controller?.abort();
    controller = new AbortController();
    const scene = scenes[i];
    if (caption) {
      caption.innerHTML = `<h2 class="t-title-02">${scene.title}</h2><p class="t-body-02">${scene.desc || ""}</p>`;
      caption.classList.remove("fade-swap");
      void caption.offsetWidth;
      caption.classList.add("fade-swap");
    }
    steps?.querySelectorAll("span").forEach((s, j) => s.classList.toggle("is-on", j === i));
    try {
      scene.play?.(stage, controller.signal);
    } catch (e) {
      console.error(e);
    }
    clearTimeout(timer);
    const next = i + 1;
    if (next < scenes.length || loop) {
      timer = setTimeout(() => show(next % scenes.length), scene.duration || 2600);
    }
    index = i;
  }

  show(0);

  return {
    stop() {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
    },
    get index() {
      return index;
    },
  };
}

/* ---------- 화면 전환 (data-view) ---------- */
export function showView(name, root = document) {
  root.querySelectorAll("[data-view]").forEach((el) => {
    el.hidden = el.dataset.view !== name;
  });
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

/* ---------- 바텀시트 ---------- */
export function openSheet(sheet) {
  let scrim = document.querySelector(".sheet-scrim");
  if (!scrim) {
    scrim = document.createElement("div");
    scrim.className = "sheet-scrim";
    document.body.appendChild(scrim);
  }
  let closed = false;
  const close = () => {
    closed = true;
    sheet.classList.remove("is-open");
    scrim.classList.remove("is-open");
  };
  scrim.onclick = close;
  sheet.querySelectorAll("[data-sheet-close]").forEach((b) => (b.onclick = close));
  requestAnimationFrame(() => {
    // 같은 프레임 안에 닫혔다면 다시 열지 않는다
    if (closed) return;
    sheet.classList.add("is-open");
    scrim.classList.add("is-open");
  });
  return close;
}

/* ---------- 상단 경로: 쓰지 않는다 ----------
 * 각 페이지는 독립된 사이트처럼 보여야 하므로 "홈 › 카테고리" 경로를 달지 않는다.
 * 예전 호출이 남아 있어도 자리만 지우고 끝낸다. */
export function renderCrumb(el) {
  el?.remove();
}

/* ---------- 하단 "이것도 해보기" ----------
 * 같은 도메인의 다른 도구 3개만 건넨다. 디자인은 각 사이트가 자기 장르로 입힌다
 * (.more-sites, .more-sites__title, .more-sites__grid, .more-sites__item, __name, __desc). */
export function relatedTools(toolPath = currentPath(), count = 3) {
  const here = resolveToolPath(toolPath) || toolPath;
  const tool = toolByPath(here);
  const others = TOOLS.filter((t) => t.path !== here);
  const same = tool ? others.filter((t) => t.cat === tool.cat) : [];
  const rest = others.filter((t) => !same.includes(t));
  // 같은 계열 2개 + 다른 계열 1개, 날짜마다 조금씩 바뀌게
  const rand = seededRandom(`${here}:${todayKey()}`);
  const pick = [...shuffle(same, rand).slice(0, 2), ...shuffle(rest, rand)].slice(0, count);
  return pick;
}

export function renderMoreSites(el, toolPath = currentPath()) {
  if (!el) return;
  if (typeof toolPath !== "string") toolPath = currentPath();
  const items = relatedTools(toolPath);
  el.classList.add("more-sites");
  el.innerHTML = `
    <h2 class="more-sites__title">이것도 해보기</h2>
    <div class="more-sites__grid">
      ${items
        .map(
          (t) => `<a class="more-sites__item" href="${urlOf(t.path)}">
            <span class="more-sites__name">${t.name}</span>
            <span class="more-sites__desc">${t.desc}</span>
          </a>`
        )
        .join("")}
    </div>`;
}

/* ---------- 캔버스 공유 카드 도우미 ---------- */
// 고해상도 캔버스 생성 (CSS 크기 w×h, 실제 픽셀은 scale배)
export function createCanvas(w, h, scale = 2) {
  const c = document.createElement("canvas");
  c.width = w * scale;
  c.height = h * scale;
  const ctx = c.getContext("2d");
  ctx.scale(scale, scale);
  return { canvas: c, ctx };
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 줄바꿈 텍스트 (반환값: 마지막 줄 y)
export function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const lines = [];
  String(text)
    .split("\n")
    .forEach((para) => {
      let line = "";
      for (const ch of para) {
        const test = line + ch;
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line);
          line = ch;
        } else {
          line = test;
        }
      }
      lines.push(line);
    });
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return y + (lines.length - 1) * lineHeight;
}

export const CANVAS_FONT = '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';

/* ---------- 카운트업 애니메이션 ---------- */
export function countUp(el, to, { from = 0, duration = 1200, format = (n) => fmt.num(n) } = {}) {
  if (prefersReducedMotion()) {
    el.textContent = format(to);
    return;
  }
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = format(from + (to - from) * eased);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
