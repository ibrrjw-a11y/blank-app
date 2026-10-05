// 딴짓 오락실 허브: 오늘의 게임 4개 묶음. 각 게임은 자기 페이지(/ddanjit/<게임>/)에서 돈다.
import { $, $$, runIntro, renderMoreSites, share, prefersReducedMotion } from "../shared/kit.js";
import { DAY, DATE, overallStreak, msToNextPuzzle, fmtCountdown, esc } from "./core.js";
import { scene, splitChars, splitHeadline, coinOp, GAME_IDS } from "./scenes.js";
import { GAMES, statusOf } from "./play.js";

const RECOMMEND = ["이거 해봐 ㅋㅋ", "3분이면 끝나요, 한 판 해봐요", "오늘 거 은근 재밌어요", "심심하면 이거 ㄱㄱ"];
const recommendLine = RECOMMEND[DAY % RECOMMEND.length];
const hubUrl = () => location.origin + location.pathname;

let intro;

// 예전 주소(#zoom 등)는 새 페이지로 보낸다
function redirectOldHash() {
  const id = location.hash.slice(1);
  if (GAME_IDS.includes(id)) {
    location.replace(`${id}/`);
    return true;
  }
  return false;
}

function setView(name) {
  $$("[data-view]").forEach((el) => (el.hidden = el.dataset.view !== name));
  window.scrollTo(0, 0);
}

function route() {
  if (redirectOldHash()) return;
  intro?.stop();
  intro = null;
  showHub();
}

/* ---------- 인트로: 4게임 장면 순환 ---------- */
function startIntro() {
  setView("intro");
  splitHeadline();
  if (overallStreak().total > 0) $("#startLabel").textContent = "오늘의 딴짓 이어서 하기";
  coinOp($("#start"), () => {
    intro?.stop();
    try {
      sessionStorage.setItem("ddanjit:intro", "1");
    } catch {
      /* noop */
    }
    if (location.hash === "#hub") route();
    else location.hash = "hub";
  });
  intro = runIntro({ root: $("#intro"), scenes: GAME_IDS.map(scene), loop: true });
}

/* ---------- 허브 ---------- */
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
        <a class="tile tile--${g.id}" href="${g.id}/#play" style="--i:${i}">
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
      url: hubUrl(),
    });
  });
}

/* ---------- 카운트다운 ---------- */
setInterval(() => {
  const ms = msToNextPuzzle();
  $$("[data-countdown]").forEach((el) => (el.textContent = fmtCountdown(ms)));
  if (ms < 1000) setTimeout(() => location.reload(), 1500);
}, 1000);

/* ---------- 시작 ---------- */
if (!redirectOldHash()) {
  renderMoreSites($("#more"));
  window.addEventListener("hashchange", route);

  let seen = false;
  try {
    seen = sessionStorage.getItem("ddanjit:intro") === "1";
  } catch {
    /* noop */
  }
  // 게임 페이지에서 "오락실로 돌아가기"(#hub)로 오면 인트로 없이 바로 허브
  if (seen || location.hash === "#hub") route();
  else startIntro();

  if (prefersReducedMotion()) document.documentElement.classList.add("reduced");
}
