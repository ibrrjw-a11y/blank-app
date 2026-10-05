// 딴짓 오락실 인트로 장면: 캐비닛 CRT 안에서 게임이 실제로 돌아가는 모습
// 허브(4장면 순환)와 게임별 페이지(자기 장면 1개 반복)가 같이 쓴다.
import { $$ } from "../shared/kit.js";
import { DAY, esc } from "./core.js";
import { TOWNS } from "./data/town.js";

// 게임별 캐비닛 라벨: 번호, 영문 마키, 패널에 붙은 설명 스티커
export const LABELS = {
  zoom: { no: 1, tag: "ZOOM OUT", how: "틀리면 한 칸씩 줌아웃" },
  town: { no: 2, tag: "TOWN", how: "거리·방향이 힌트" },
  price: { no: 3, tag: "PRICE", how: "업·다운으로 좁히기" },
  timeline: { no: 4, tag: "TIMELINE", how: "연도 순서대로 끼우기" },
};

// 캐비닛을 한 번만 그리고, 마키·스티커만 바꾼다. 반환값은 화면(CRT) 안쪽 요소
export function cabinet(stage, id) {
  let cab = stage.querySelector(".cab");
  if (!cab) {
    stage.innerHTML = `<div class="cab">
      <div class="cab__marquee"><span class="cab__tag"></span><span class="cab__day">#${DAY}</span></div>
      <div class="cab__screen"><div class="cab__content"></div><div class="cab__scan"></div></div>
      <div class="cab__panel"><i class="cab__stick"></i><span class="cab__sticker"><b class="pix">HOW TO</b><span class="cab__how"></span></span><i class="cab__btn"></i><i class="cab__btn cab__btn--2"></i></div>
    </div>`;
    cab = stage.querySelector(".cab");
  }
  const L = LABELS[id];
  if (L) {
    cab.querySelector(".cab__tag").textContent = `GAME ${L.no} · ${L.tag}`;
    const how = cab.querySelector(".cab__how");
    how.textContent = L.how;
    const st = cab.querySelector(".cab__sticker");
    st.classList.remove("is-swap");
    void st.offsetWidth;
    st.classList.add("is-swap");
  }
  return cab.querySelector(".cab__content");
}

export function projector(w, h, pad = 8) {
  const lat0 = 33.1;
  const lat1 = 38.65;
  const lng0 = 125.95;
  const lng1 = 131.0;
  const k = Math.cos((36 * Math.PI) / 180);
  const sx = (w - pad * 2) / ((lng1 - lng0) * k);
  const sy = (h - pad * 2) / (lat1 - lat0);
  const s = Math.min(sx, sy);
  const ox = (w - (lng1 - lng0) * k * s) / 2;
  const oy = (h - (lat1 - lat0) * s) / 2;
  return (lat, lng) => [ox + (lng - lng0) * k * s, oy + (lat1 - lat) * s];
}

let dotsCache = "";
function miniMapDots() {
  if (dotsCache) return dotsCache;
  const P = projector(150, 190, 6);
  dotsCache = TOWNS.map((t) => {
    const [x, y] = P(t.lat, t.lng);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.4"/>`;
  }).join("");
  return dotsCache;
}

// 각 장면의 화면 내용 (CSS 애니메이션은 innerHTML 을 다시 넣을 때마다 처음부터 돈다)
const SCREENS = {
  zoom: {
    duration: 3600,
    html: () => `<div class="sc sc-zoom">
      <div class="sc-zoom__lens"><span class="sc-zoom__img">🍜</span></div>
      <div class="sc-zoom__hud"><span class="sc-chip">ZOOM</span><span class="sc-zoom__lv"><i></i><i></i><i></i><i></i></span></div>
      <div class="sc-zoom__guesses">
        <span class="sc-guess sc-guess--1">피자? ✕</span>
        <span class="sc-guess sc-guess--2">카레? ✕</span>
        <span class="sc-guess sc-guess--ok">라면! ✓</span>
      </div>
    </div>`,
  },
  town: {
    duration: 3400,
    html: () => {
      const P = projector(150, 190, 6);
      const [gx, gy] = P(35.15, 126.9);
      return `<div class="sc sc-town">
        <svg class="sc-town__map" viewBox="0 0 150 190" aria-hidden="true">
          <g class="sc-town__dots">${miniMapDots()}</g>
          <circle class="sc-town__ping" cx="${gx}" cy="${gy}" r="5"/>
          <circle class="sc-town__guess" cx="${gx}" cy="${gy}" r="3.2"/>
        </svg>
        <div class="sc-town__panel">
          <div class="sc-town__arrow"><svg viewBox="0 0 48 48"><path d="M24 6 L36 26 H28 V42 H20 V26 H12 Z"/></svg></div>
          <div class="sc-town__km">132km <span>↗</span></div>
          <div class="sc-town__bar"><i></i></div>
          <div class="sc-town__pct">가까움 74%</div>
        </div>
      </div>`;
    },
  },
  price: {
    duration: 3600,
    html: () => `<div class="sc sc-price">
      <div class="sc-price__q"><span>🍜</span> 1980년 짜장면 한 그릇은?</div>
      <svg class="sc-price__gauge" viewBox="0 0 200 116" aria-hidden="true">
        <defs><linearGradient id="gaugeg" x1="0" x2="1"><stop offset="0" class="g0"/><stop offset=".5" class="g1"/><stop offset="1" class="g2"/></linearGradient></defs>
        <path d="M20 104 A80 80 0 0 1 180 104" class="sc-price__arc"/>
        <g class="sc-price__needle"><path d="M100 104 L97 40 L100 30 L103 40 Z"/><circle cx="100" cy="104" r="7"/></g>
      </svg>
      <div class="sc-price__tags">
        <span class="sc-tag sc-tag--1">1,000원 ⬇️ 더 쌌어요</span>
        <span class="sc-tag sc-tag--2">200원 ⬆️ 더 비쌌어요</span>
        <span class="sc-tag sc-tag--ok">350원 ✓ 정답!</span>
      </div>
    </div>`,
  },
  timeline: {
    duration: 3800,
    html: () => `<div class="sc sc-time">
      <div class="sc-time__line"></div>
      <div class="sc-card sc-card--a"><b>🍫</b><span>초코파이</span><em>1974</em></div>
      <div class="sc-card sc-card--b"><b>🌲</b><span>싸이월드</span><em>1999</em></div>
      <div class="sc-card sc-card--c"><b>💬</b><span>카카오톡</span><em>2010</em></div>
      <div class="sc-card sc-card--d"><b>⚽</b><span>월드컵 4강</span><em>2002</em></div>
      <div class="sc-time__ok">✓</div>
    </div>`,
  },
};

export const GAME_IDS = Object.keys(SCREENS);

// runIntro 장면 형식 (캡션 없이, 설명은 캐비닛 스티커에)
export function scene(id) {
  return {
    duration: SCREENS[id].duration,
    play(stage) {
      cabinet(stage, id).innerHTML = SCREENS[id].html();
    },
  };
}

/* ---------- 키네틱 타이포: 글자 단위 분해 ---------- */
export function splitChars(text) {
  return Array.from(text)
    .map((c, i) => (c === " " ? `<span class="sp"> </span>` : `<span class="ch" style="--i:${i}">${esc(c)}</span>`))
    .join("");
}

export function splitHeadline() {
  let i = 0;
  $$("[data-split]").forEach((el) => {
    const text = el.textContent;
    el.innerHTML = Array.from(text)
      .map((c) => (c === " " ? `<span class="sp"> </span>` : `<span class="ch" style="--i:${i++}" aria-hidden="true">${esc(c)}</span>`))
      .join("");
  });
}

/* ---------- 아케이드 시작 버튼: 동전이 들어가고 버튼이 눌린 뒤 이동 ---------- */
export function coinOp(btn, go) {
  btn.addEventListener("click", () => {
    if (btn.classList.contains("is-coin")) return;
    btn.classList.add("is-coin");
    const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(() => {
      btn.classList.remove("is-coin");
      go();
    }, reduce ? 0 : 320);
  });
}
