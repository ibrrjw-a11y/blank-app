// 게임 하나 = 페이지 하나. /ddanjit/<게임>/index.html 이 이 모듈로 자기 게임을 띄운다.
// 문제·기록·스트릭은 core.js 의 같은 저장소를 써서 허브(/ddanjit/)의 램프와 이어진다.
import { $, $$, renderCrumb, renderMoreSites, share, shareImage, openSheet, haptic, prefersReducedMotion } from "../shared/kit.js";
import { DAY, loadDay, saveDay, getStats, recordResult, msToNextPuzzle, fmtCountdown, drawShareCard, confetti, esc } from "./core.js";
import { scene, splitHeadline, coinOp } from "./scenes.js";
import zoom from "./games/zoom.js";
import town from "./games/town.js";
import price from "./games/price.js";
import timeline from "./games/timeline.js";

export const GAMES = [zoom, town, price, timeline];
const RECOMMEND = ["이거 해봐 ㅋㅋ", "3분이면 끝나요, 한 판 해봐요", "오늘 거 은근 재밌어요", "심심하면 이거 ㄱㄱ"];
const recommendLine = RECOMMEND[DAY % RECOMMEND.length];

export function statusOf(g) {
  const st = loadDay(g.id);
  const sum = st ? g.summary(st) : null;
  if (sum) return { kind: "done", sum };
  if (st && g.started(st)) return { kind: "doing" };
  return { kind: "new" };
}

const pageUrl = () => location.origin + location.pathname;

export function bootGame(g) {
  let loop = 0;
  let cleanup = null;
  let pendingResult = 0;

  function setView(name) {
    $$("[data-view]").forEach((el) => (el.hidden = el.dataset.view !== name));
    window.scrollTo(0, 0);
  }

  /* ---------- 인트로: 이 게임 장면 하나만 짧게 반복 ---------- */
  function startIntro() {
    setView("intro");
    const sc = scene(g.id);
    const stage = $("#intro .intro__stage");
    const tick = () => {
      sc.play(stage);
      loop = setTimeout(tick, sc.duration + 500);
    };
    clearTimeout(loop);
    tick();
    const s = statusOf(g);
    const label = $("#startLabel");
    if (s.kind === "done") label.textContent = "오늘 결과 보기";
    else if (s.kind === "doing") label.textContent = "이어서 하기";
  }

  function stopIntro() {
    clearTimeout(loop);
    loop = 0;
  }

  function route() {
    clearTimeout(pendingResult);
    $$(".sheet.is-open, .sheet-scrim.is-open").forEach((el) => el.classList.remove("is-open"));
    cleanup?.();
    cleanup = null;
    if (location.hash === "#play") {
      stopIntro();
      openGame();
    } else startIntro();
  }

  /* ---------- 게임 화면 ---------- */
  function openGame() {
    setView("game");
    const root = $("#game");
    root.innerHTML = `
      <header class="topbar gbar">
        <a class="btn btn--ghost btn--icon gbar__back" href="../#hub" aria-label="오락실로 돌아가기">‹</a>
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
          if (location.hash === "#play") openResult(state);
        }, sum.won ? 1100 : 1300);
      },
      openResult() {
        openResult(state);
      },
    };
    cleanup = g.mount($("#gbody"), api) || null;
  }

  /* ---------- 결과 시트 ---------- */
  function openResult(s) {
    const sum = g.summary(s);
    if (!sum) return;
    const st = getStats(g.id);
    const rate = st.played ? Math.round((st.wins / st.played) * 100) : 0;
    const distMax = Math.max(1, ...g.distKeys.map((k) => st.dist[k] || 0));
    const next = GAMES.find((x) => x.id !== g.id && statusOf(x).kind !== "done");
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
          ${next ? `<a class="btn btn--outline btn--block" href="../${next.id}/#play">${next.emoji} 다른 게임 하러 가기: ${next.name}</a>` : ""}
          <a class="btn btn--ghost btn--block" href="../#hub">오락실로 돌아가기</a>
        </div>
      </div>`;
    openSheet(sheet);
    const text = `딴짓 오락실 #${DAY} ${g.emoji} ${g.name}\n${sum.grid} ${sum.scoreText}\n${recommendLine}`;
    const url = pageUrl();
    $("#res-share").onclick = () => share({ title: `딴짓 오락실 - ${g.name}`, text, url });
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

  /* ---------- 시작 ---------- */
  renderCrumb($("#crumb"));
  renderMoreSites($("#more"));
  splitHeadline();
  coinOp($("#start"), () => {
    if (location.hash === "#play") route();
    else location.hash = "play";
  });
  window.addEventListener("hashchange", route);
  setInterval(() => {
    const ms = msToNextPuzzle();
    $$("[data-countdown]").forEach((el) => (el.textContent = fmtCountdown(ms)));
    if (ms < 1000) setTimeout(() => location.reload(), 1500);
  }, 1000);
  if (prefersReducedMotion()) document.documentElement.classList.add("reduced");
  route();
}
