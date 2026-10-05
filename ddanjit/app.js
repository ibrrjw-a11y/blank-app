import { $, $$, runIntro, renderMoreSites, share, shareImage, openSheet, haptic, toast, prefersReducedMotion } from "../shared/kit.js";
import { DAY, DATE, loadDay, saveDay, getStats, recordResult, overallStreak, msToNextPuzzle, fmtCountdown, drawShareCard, confetti, esc } from "./core.js";
import { TOWNS } from "./data/town.js";
import zoom from "./games/zoom.js";
import town from "./games/town.js";
import price from "./games/price.js";
import timeline from "./games/timeline.js";

const GAMES = [zoom, town, price, timeline];
const byId = Object.fromEntries(GAMES.map((g) => [g.id, g]));
const RECOMMEND = ["이거 해봐 ㅋㅋ", "3분이면 끝나요, 한 판 해봐요", "오늘 거 은근 재밌어요", "심심하면 이거 ㄱㄱ"];
const recommendLine = RECOMMEND[DAY % RECOMMEND.length];

let intro;
let cleanup = null;
let pendingResult = 0;

/* ---------- 라우팅 ---------- */
function closeSheets() {
  $$(".sheet.is-open, .sheet-scrim.is-open").forEach((el) => el.classList.remove("is-open"));
}

function route() {
  clearTimeout(pendingResult);
  closeSheets();
  const id = location.hash.replace("#", "");
  cleanup?.();
  cleanup = null;
  if (byId[id]) openGame(byId[id]);
  else showHub();
}

function setView(name) {
  $$("[data-view]").forEach((el) => (el.hidden = el.dataset.view !== name));
  window.scrollTo(0, 0);
}

function leaveIntro(target) {
  intro?.stop();
  try {
    sessionStorage.setItem("ddanjit:intro", "1");
  } catch {
    /* noop */
  }
  if (location.hash.replace("#", "") === target) route();
  else location.hash = target;
}

/* ---------- 인트로 ---------- */
function startIntro() {
  setView("intro");
  splitHeadline();
  const target = location.hash.replace("#", "");
  const btn = $("#start");
  if (byId[target]) btn.textContent = `추천받은 ${byId[target].emoji} ${byId[target].name} 하러 가기`;
  else if (overallStreak().total > 0) btn.textContent = "오늘의 딴짓 이어서 하기";
  btn.onclick = () => leaveIntro(byId[target] ? target : "hub");
  intro = runIntro({ root: $("#intro"), scenes: introScenes(), loop: true });
}

function cabinet(stage) {
  let cab = stage.querySelector(".cab");
  if (!cab) {
    stage.innerHTML = `<div class="cab">
      <div class="cab__marquee"><span>DDANJIT ARCADE</span><span class="cab__day">#${DAY}</span></div>
      <div class="cab__screen"><div class="cab__content"></div><div class="cab__scan"></div></div>
      <div class="cab__panel"><i class="cab__stick"></i><i class="cab__btn"></i><i class="cab__btn cab__btn--2"></i></div>
    </div>`;
    cab = stage.querySelector(".cab");
  }
  return cab.querySelector(".cab__content");
}

function miniMapDots() {
  const P = projector(150, 190, 6);
  return TOWNS.map((t) => {
    const [x, y] = P(t.lat, t.lng);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.4"/>`;
  }).join("");
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

function introScenes() {
  const dots = miniMapDots();
  const P = projector(150, 190, 6);
  const [gx, gy] = P(35.15, 126.9);
  return [
    {
      title: `<span class="pix">GAME 1</span>줌아웃`,
      desc: "틀릴 때마다 한 칸씩 멀어지는 그림, 점점 보이면 맞혀요",
      duration: 3600,
      play(stage) {
        cabinet(stage).innerHTML = `<div class="sc sc-zoom">
          <div class="sc-zoom__lens"><span class="sc-zoom__img">🍜</span></div>
          <div class="sc-zoom__hud"><span class="sc-chip">ZOOM</span><span class="sc-zoom__lv"><i></i><i></i><i></i><i></i></span></div>
          <div class="sc-zoom__guesses">
            <span class="sc-guess sc-guess--1">피자? ✕</span>
            <span class="sc-guess sc-guess--2">카레? ✕</span>
            <span class="sc-guess sc-guess--ok">라면! ✓</span>
          </div>
        </div>`;
      },
    },
    {
      title: `<span class="pix">GAME 2</span>오늘의 동네`,
      desc: "틀려도 거리와 방향이 힌트. 점점 가까워지는 감각",
      duration: 3400,
      play(stage) {
        cabinet(stage).innerHTML = `<div class="sc sc-town">
          <svg class="sc-town__map" viewBox="0 0 150 190" aria-hidden="true">
            <g class="sc-town__dots">${dots}</g>
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
    {
      title: `<span class="pix">GAME 3</span>그때 그 가격`,
      desc: "업·다운 힌트로 그 시절 물가를 좁혀가요",
      duration: 3600,
      play(stage) {
        cabinet(stage).innerHTML = `<div class="sc sc-price">
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
        </div>`;
      },
    },
    {
      title: `<span class="pix">GAME 4</span>추억 연대기`,
      desc: "추억 카드를 시간 순서대로 끼워 넣어요",
      duration: 3800,
      play(stage) {
        cabinet(stage).innerHTML = `<div class="sc sc-time">
          <div class="sc-time__line"></div>
          <div class="sc-card sc-card--a"><b>🍫</b><span>초코파이</span><em>1974</em></div>
          <div class="sc-card sc-card--b"><b>🌲</b><span>싸이월드</span><em>1999</em></div>
          <div class="sc-card sc-card--c"><b>💬</b><span>카카오톡</span><em>2010</em></div>
          <div class="sc-card sc-card--d"><b>⚽</b><span>월드컵 4강</span><em>2002</em></div>
          <div class="sc-time__ok">✓</div>
        </div>`;
      },
    },
  ];
}

/* ---------- 키네틱 타이포: 글자 단위 분해 ---------- */
export function splitChars(text) {
  return Array.from(text)
    .map((c, i) => (c === " " ? `<span class="sp"> </span>` : `<span class="ch" style="--i:${i}">${esc(c)}</span>`))
    .join("");
}

function splitHeadline() {
  let i = 0;
  $$("[data-split]").forEach((el) => {
    const text = el.textContent;
    el.innerHTML = Array.from(text)
      .map((c) => (c === " " ? `<span class="sp"> </span>` : `<span class="ch" style="--i:${i++}" aria-hidden="true">${esc(c)}</span>`))
      .join("");
  });
}

/* ---------- 허브 ---------- */
function statusOf(g) {
  const st = loadDay(g.id);
  const sum = st ? g.summary(st) : null;
  if (sum) return { kind: "done", sum };
  if (st && g.started(st)) return { kind: "doing" };
  return { kind: "new" };
}

function showHub() {
  setView("hub");
  const os = overallStreak();
  const statuses = GAMES.map((g) => ({ g, s: statusOf(g) }));
  const doneCount = statuses.filter((x) => x.s.kind === "done").length;
  const d = new Date(DATE + "T00:00:00");
  const dateLabel = `${d.getMonth() + 1}월 ${d.getDate()}일`;
  const weekday = `${"일월화수목금토"[d.getDay()]}요일`;

  $("#hub").innerHTML = `
    <header class="topbar">
      <span class="topbar__brand"><span class="hub-logo" aria-hidden="true">🕹️</span>딴짓 오락실</span>
      <span class="streak-chip ${os.streak ? "is-on" : ""}" title="하루에 한 게임 이상 끝낸 날이 이어진 수">연속 ${os.streak}일</span>
    </header>
    <section class="hub-hero">
      <p class="hub-hero__no">STAGE ${DAY} · 오늘의 딴짓</p>
      <h2 class="hub-hero__title">${splitChars(dateLabel)}<span class="hub-hero__wd">${weekday}</span></h2>
      <div class="hub-hero__meta">
        <span class="lamps" role="img" aria-label="오늘 ${doneCount}/4 완료">
          ${statuses.map((x) => `<i class="${x.s.kind === "done" ? (x.s.sum.won ? "is-win" : "is-done") : x.s.kind === "doing" ? "is-doing" : ""}"></i>`).join("")}
        </span>
        <span class="t-body-03 t-secondary">오늘 <b class="t-num">${doneCount}/4</b></span>
        <span class="seg" title="다음 문제까지"><small>다음 문제</small><span data-countdown>${fmtCountdown(msToNextPuzzle())}</span></span>
      </div>
    </section>
    <section class="tiles">
      ${statuses
        .map(
          ({ g, s }, i) => `
        <a class="tile tile--${g.id}" href="#${g.id}" style="--i:${i}">
          <span class="tile__icon" aria-hidden="true">${g.emoji}</span>
          <span class="tile__body">
            <span class="tile__name">${g.name}</span>
            <span class="tile__desc">${g.tagline}</span>
            ${s.kind === "done" ? `<span class="tile__grid">${esc(s.sum.grid)}</span>` : ""}
          </span>
          <span class="tile__status tile__status--${s.kind}">${s.kind === "done" ? (s.sum.won ? "✅ 완료" : "완료") : s.kind === "doing" ? "진행중" : "새 문제"}</span>
        </a>`
        )
        .join("")}
    </section>
    ${
      doneCount === GAMES.length
        ? `<section class="card card--flat all-done">
            <p class="t-title-04">오늘 딴짓 끝!</p>
            <p class="t-body-03 t-secondary">내일 자정(한국 시간)에 새 문제가 나와요.</p>
            <button class="btn btn--primary btn--block" id="share-all">오늘 결과 한 번에 공유하기</button>
          </section>`
        : ""
    }
    <section class="card card--flat my-rec">
      <div class="row between"><p class="t-title-04">내 기록</p><span class="t-caption-01 t-tertiary">이 기기에만 저장돼요</span></div>
      <div class="rec-grid">
        <div><b class="t-num">${os.streak}</b><span>연속 출석</span></div>
        <div><b class="t-num">${os.best}</b><span>최고 연속</span></div>
        <div><b class="t-num">${os.total}</b><span>딴짓한 날</span></div>
      </div>
      <p class="t-caption-01 t-tertiary">순위표는 없어요. 비교 대상은 어제의 나뿐이에요.</p>
    </section>`;

  $("#share-all")?.addEventListener("click", () => {
    const lines = statuses.map(({ g, s }) => `${g.emoji} ${s.sum.grid} ${s.sum.scoreText}`);
    share({
      title: "딴짓 오락실",
      text: `딴짓 오락실 #${DAY} 오늘의 딴짓 완료\n${lines.join("\n")}\n${recommendLine}`,
      url: location.origin + location.pathname,
    });
  });
}

/* ---------- 게임 화면 ---------- */
function openGame(g) {
  setView("game");
  const root = $("#game");
  root.innerHTML = `
    <header class="topbar gbar">
      <a class="btn btn--ghost btn--icon gbar__back" href="#hub" aria-label="오락실로 돌아가기">‹</a>
      <div class="gbar__title"><span class="t-label-01">${g.emoji} ${g.name}</span><span class="t-caption-01 t-tertiary">#${DAY}</span></div>
      <div class="gbar__tries" id="tries" aria-label="시도"></div>
    </header>
    <div class="gbody" id="gbody"></div>`;
  let state = loadDay(g.id);
  const api = {
    day: DAY,
    state,
    save(s) {
      state = s;
      saveDay(g.id, s);
    },
    setTries(marks) {
      $("#tries").innerHTML = marks.map((m) => `<i class="${m ? "is-" + m : ""}"></i>`).join("");
    },
    finish(s, { celebrate = true } = {}) {
      state = s;
      saveDay(g.id, s);
      const sum = g.summary(s);
      recordResult(g.id, { won: sum.won, distKey: sum.distKey });
      if (sum.won && celebrate) {
        confetti();
        haptic([18, 40, 18]);
      } else haptic(30);
      clearTimeout(pendingResult);
      pendingResult = setTimeout(() => {
        if (location.hash.replace("#", "") === g.id) openResult(g, s);
      }, sum.won ? 1100 : 1300);
    },
    openResult() {
      openResult(g, state);
    },
  };
  cleanup = g.mount($("#gbody"), api) || null;
}

/* ---------- 결과 시트 ---------- */
function openResult(g, s) {
  const sum = g.summary(s);
  if (!sum) return;
  const st = getStats(g.id);
  const rate = st.played ? Math.round((st.wins / st.played) * 100) : 0;
  const distMax = Math.max(1, ...g.distKeys.map((k) => st.dist[k] || 0));
  const next = GAMES.find((x) => x.id !== g.id && !statusOf(x).sum && statusOf(x).kind !== "done");
  const sheet = $("#result");
  sheet.innerHTML = `
    <div class="res">
      <div class="res__head">
        <span class="res__badge pix ${sum.won ? "is-win" : ""}">${sum.won ? "CLEAR!" : "GAME OVER"}</span>
        <h2 class="t-title-02">${esc(sum.headline)}</h2>
        <p class="res__grid">${esc(sum.grid)}</p>
      </div>
      <div class="res__reveal">${g.reveal(s)}</div>
      <div class="res__share">
        <button class="btn btn--primary btn--lg btn--block" id="res-share">친구에게 추천하기</button>
        <button class="btn btn--secondary btn--block" id="res-img">결과 이미지 저장</button>
      </div>
      <section class="res__stats">
        <h3 class="t-label-01">내 기록 <span class="t-caption-01 t-tertiary">· ${g.name}</span></h3>
        <div class="stat-row">
          <div><b class="t-num">${st.played}</b><span>플레이</span></div>
          <div><b class="t-num">${rate}%</b><span>${g.successLabel || "성공률"}</span></div>
          <div><b class="t-num">${st.curLive}</b><span>연속 성공</span></div>
          <div><b class="t-num">${st.max}</b><span>최고 연속</span></div>
        </div>
        <h3 class="t-label-02 t-secondary">${g.distTitle || "몇 번 만에 맞혔나"}</h3>
        <div class="dist">
          ${g.distKeys
            .map((k) => {
              const n = st.dist[k] || 0;
              return `<div class="dist__row ${k === sum.distKey ? "is-today" : ""}"><span class="dist__k">${g.distLabel(k)}</span><span class="dist__bar"><i style="width:${Math.max(8, (n / distMax) * 100)}%">${n}</i></span></div>`;
            })
            .join("")}
        </div>
      </section>
      <p class="res__next t-body-03 t-secondary">다음 문제까지 <b class="t-num" data-countdown>${fmtCountdown(msToNextPuzzle())}</b></p>
      <div class="res__actions">
        ${next ? `<a class="btn btn--outline btn--block" href="#${next.id}" data-sheet-close>${next.emoji} 다른 게임 하러 가기: ${next.name}</a>` : ""}
        <a class="btn btn--ghost btn--block" href="#hub" data-sheet-close>오락실로 돌아가기</a>
      </div>
    </div>`;
  const close = openSheet(sheet);
  $$("[data-sheet-close]", sheet).forEach((a) => a.addEventListener("click", close));
  const text = `딴짓 오락실 #${DAY} ${g.emoji} ${g.name}\n${sum.grid} ${sum.scoreText}\n${recommendLine}`;
  const url = `${location.origin}${location.pathname}#${g.id}`;
  $("#res-share").onclick = () => share({ title: "딴짓 오락실", text, url });
  $("#res-img").onclick = async (e) => {
    const b = e.currentTarget;
    b.classList.add("is-loading");
    try {
      const canvas = drawShareCard({ gameEmoji: g.emoji, gameName: g.name, grid: sum.grid, line: sum.scoreText });
      await shareImage(canvas, { filename: `ddanjit-${g.id}-${DAY}.png`, text: `${text}\n${url}` });
    } finally {
      b.classList.remove("is-loading");
    }
  };
}

/* ---------- 카운트다운 ---------- */
setInterval(() => {
  const ms = msToNextPuzzle();
  $$("[data-countdown]").forEach((el) => (el.textContent = fmtCountdown(ms)));
  if (ms < 1000) setTimeout(() => location.reload(), 1500);
}, 1000);

/* ---------- 시작 ---------- */
renderMoreSites($("#more"), "ddanjit");
window.addEventListener("hashchange", () => {
  intro?.stop();
  route();
});

let seen = false;
try {
  seen = sessionStorage.getItem("ddanjit:intro") === "1";
} catch {
  /* noop */
}
if (seen) route();
else startIntro();

if (prefersReducedMotion()) document.documentElement.classList.add("reduced");
