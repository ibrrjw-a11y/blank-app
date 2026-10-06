// 게임 하나 = 페이지 하나. /ddanjit/<게임>/index.html 이 이 모듈로 자기 게임을 띄운다.
// 문제·기록·스트릭은 core.js 의 같은 저장소를 써서 허브(/ddanjit/)의 램프와 이어진다.
import { $, $$, renderMoreSites, share, shareImage, openSheet, haptic, prefersReducedMotion } from "../shared/kit.js";
import { DAY, loadDay, saveDay, getStats, recordResult, msToNextPuzzle, fmtCountdown, drawShareCard, confetti, esc, store, setPlay } from "./core.js";
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

/* ---------- 한 판 더(연습 판) ----------
 * 오늘 문제는 하루 한 번(기록·연속 기록·공유는 오늘 문제만). 더 하고 싶으면 지난 날짜 문제를 다시 꺼내 푼다.
 * 연습 판은 기록에 안 남고, 푼 날짜는 기억해 두었다가 겹치지 않게 고른다. 진행 중인 연습 판은 다시 열어도 이어진다 */
const pKey = (g) => `x:${g.id}`;
function nextPracticeDay(g) {
  const used = new Set(store.get(`xp:${g.id}`, []));
  const pool = [];
  for (let d = 1; d < DAY; d++) if (!used.has(d)) pool.push(d);
  if (!pool.length) { store.set(`xp:${g.id}`, []); for (let d = 1; d < DAY; d++) pool.push(d); }
  return pool[Math.floor(Math.random() * pool.length)] || 1;
}
function practiceRound(g, fresh) {
  let cur = store.get(pKey(g), null);
  if (fresh || !cur || !cur.day || (cur.state && g.summary(cur.state))) {
    cur = { day: nextPracticeDay(g), state: null };
    store.set(pKey(g), cur);
  }
  return cur;
}

export function bootGame(g) {
  let loop = 0;
  let cleanup = null;
  let pendingResult = 0;

  // 키보드가 올라오면 보이는 높이(--vvh)에 맞춰 문제를 줄이고, 문제 맨 위가 화면 맨 위에 오게 한다
  const vv = window.visualViewport;
  const setVvh = () => document.documentElement.style.setProperty("--vvh", `${Math.round(vv ? vv.height : innerHeight)}px`);
  setVvh();
  vv?.addEventListener("resize", setVvh);
  document.addEventListener("focusin", (e) => {
    if (!e.target.matches?.("#gbody input")) return;
    document.documentElement.classList.add("typing");
    setTimeout(() => { setVvh(); const top = $("#gbody")?.firstElementChild; const bar = $(".gbar"); const pin = bar && /sticky|fixed/.test(getComputedStyle(bar).position) ? bar.offsetHeight + 6 : 6; if (top) window.scrollTo({ top: Math.max(0, top.getBoundingClientRect().top + scrollY - pin), behavior: "auto" }); }, 280);
  });
  document.addEventListener("focusout", (e) => {
    if (e.target.matches?.("#gbody input")) setTimeout(() => { if (!document.activeElement?.matches?.("#gbody input")) document.documentElement.classList.remove("typing"); }, 120);
  });

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
    let more = $("#moreRound");
    if (s.kind === "done" && !more) {
      more = document.createElement("a");
      more.id = "moreRound"; more.className = "btn btn--outline btn--block more-round"; more.href = "#again";
      more.textContent = "한 판 더 하기 (지난 문제 · 기록 안 남음)";
      $("#start").insertAdjacentElement("afterend", more);
    }
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
    if (location.hash === "#play" || location.hash === "#again") {
      stopIntro();
      openGame(location.hash === "#again");
    } else {
      setPlay(DAY);
      startIntro();
    }
  }

  /* ---------- 게임 화면 ---------- */
  function openGame(practice = false) {
    setView("game");
    const round = practice ? practiceRound(g, false) : null;
    setPlay(practice ? round.day : DAY);
    const root = $("#game");
    root.innerHTML = `
      <header class="topbar gbar">
        <a class="btn btn--ghost btn--icon gbar__back" href="../#hub" aria-label="오락실로 돌아가기">‹</a>
        <div class="gbar__title"><span class="t-label-01">${g.emoji} ${g.name}</span><span class="t-caption-01 t-tertiary">${practice ? `연습 판 · 지난 문제 #${round.day}` : `#${DAY}`}</span></div>
        <div class="gbar__tries" id="tries" aria-label="시도"></div>
      </header>
      <div class="gbody" id="gbody"></div>`;
    let state = practice ? round.state : loadDay(g.id);
    const keep = (s) => (practice ? store.set(pKey(g), { day: round.day, state: s }) : saveDay(g.id, s));
    const api = {
      day: practice ? round.day : DAY,
      state,
      save(s) {
        state = s;
        keep(s);
      },
      setTries(marks) {
        $("#tries").innerHTML = marks.map((m) => `<i class="${m ? "is-" + m : ""}"></i>`).join("");
      },
      finish(s, { celebrate = true } = {}) {
        state = s;
        keep(s);
        const sum = g.summary(s);
        if (practice) store.set(`xp:${g.id}`, [...store.get(`xp:${g.id}`, []), round.day].slice(-400));
        else recordResult(g.id, { won: sum.won, distKey: sum.distKey });
        if (sum.won && celebrate) {
          confetti();
          haptic([18, 40, 18]);
        } else haptic(30);
        clearTimeout(pendingResult);
        pendingResult = setTimeout(() => {
          if (location.hash === "#play" || location.hash === "#again") openResult(state, practice);
        }, sum.won ? 1100 : 1300);
      },
      openResult() {
        openResult(state, practice);
      },
    };
    cleanup = g.mount($("#gbody"), api) || null;
  }

  /* ---------- 결과 시트 ---------- */
  function newRound() {
    store.set(pKey(g), null);
    if (location.hash === "#again") route();
    else location.hash = "again";
  }

  function openResult(s, practice = false) {
    const sum = g.summary(s);
    if (!sum) return;
    if (practice) {
      const sheet = $("#result");
      sheet.innerHTML = `
      <div class="res">
        <div class="res__head">
          <span class="res__badge pix ${sum.won ? "is-win" : ""}">${sum.won ? "CLEAR!" : "GAME OVER"}</span>
          <h2 class="t-title-02">${esc(sum.headline)}</h2>
          <p class="res__grid">${esc(sum.grid)}</p>
          <p class="t-caption-01 t-tertiary">연습 판이라 기록에는 안 남아요</p>
        </div>
        <div class="res__reveal">${g.reveal(s)}</div>
        <div class="res__actions">
          <button class="btn btn--primary btn--lg btn--block" id="res-more">한 판 더</button>
          <a class="btn btn--outline btn--block" href="#play">오늘의 문제로</a>
          <a class="btn btn--ghost btn--block" href="../#hub">오락실로 돌아가기</a>
        </div>
      </div>`;
      openSheet(sheet);
      $("#res-more").onclick = newRound;
      return;
    }
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
          <button class="btn btn--primary btn--block" id="res-more">한 판 더 하기 (지난 문제 · 기록 안 남음)</button>
          ${next ? `<a class="btn btn--outline btn--block" href="../${next.id}/#play">${next.emoji} 다른 게임 하러 가기: ${next.name}</a>` : ""}
          <a class="btn btn--ghost btn--block" href="../#hub">오락실로 돌아가기</a>
        </div>
      </div>`;
    openSheet(sheet);
    const text = `딴짓 오락실 #${DAY} ${g.emoji} ${g.name}\n${sum.grid} ${sum.scoreText}\n${recommendLine}`;
    const url = pageUrl();
    $("#res-more").onclick = newRound;
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
