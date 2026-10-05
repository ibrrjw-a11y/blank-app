import {
  $,
  createStore,
  toast,
  haptic,
  share,
  shareImage,
  encodeState,
  decodeState,
  urlWith,
  getParam,
  showView,
  openSheet,
  renderMoreSites,
  renderCrumb,
  prefersReducedMotion,
  downloadBlob,
} from "../shared/kit.js";
import { KEYS, META, TIPS, computeAll, ageBand } from "./scoring.js";
import { startIntro } from "./intro.js";
import { howTo, countdown, doneScreen, PLAY, HOWTO } from "./games.js";
import { rollMarkup, rollTo, radarSVG, lineSVG } from "./ui.js";
import { gaugeSVG, setGauge } from "./instrument.js";
import { drawShareCard, compareText } from "./card.js";

const store = createStore("brain-age");
const DAY = 86400000;
const state = { intro: null, ctrl: null, challenge: readChallenge(), current: null };

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/* ---------- 도전장 링크 읽기 ---------- */
function readChallenge() {
  const raw = getParam("c");
  if (!raw) return null;
  const d = decodeState(raw.replace(/\/$/, ""));
  if (!d || typeof d !== "object") return null;
  const a = Math.round(Number(d.a));
  if (!Number.isFinite(a) || a < 15 || a > 80) return null;
  const s = Array.isArray(d.s) ? d.s : [];
  const num = (v, lo, hi) => {
    const n = Number(v);
    return v == null || !Number.isFinite(n) ? null : Math.min(hi, Math.max(lo, Math.round(n)));
  };
  return {
    name: String(d.n || "").replace(/[<>&"'\n\r]/g, "").trim().slice(0, 10),
    age: a,
    raw: { rt: num(s[0], 100, 2000), mem: num(s[1], 0, 20), color: num(s[2], 0, 100), hear: num(s[3], 1, 20000), math: num(s[4], 0, 100) },
  };
}

// 가족 호칭은 '님'을 붙이지 않는다
const FAMILY = ["엄마", "아빠", "어머니", "아버지", "할머니", "할아버지", "언니", "오빠", "누나", "형", "동생"];
const who = (c) => (!c.name ? "보낸 사람" : FAMILY.includes(c.name) ? c.name : `${c.name}님`);
// 받침 유무에 따라 조사 선택 (예: josa("엄마", "이랑", "랑") → "엄마랑")
const josa = (w, withB, noB) => {
  const code = w.charCodeAt(w.length - 1) - 0xac00;
  const has = code >= 0 && code <= 11171 && code % 28 !== 0;
  return w + (has ? withB : noB);
};

function renderChallengeBanner(el) {
  const c = state.challenge;
  if (!c || !el) return;
  el.hidden = false;
  el.innerHTML = `
    <span class="challenge__icon mono" aria-hidden="true">IN</span>
    <div class="grow">
      <p class="t-body-02-strong">${c.name ? `${esc(who(c))}의 뇌 나이는 ${c.age}세!` : `도전장 도착! 상대의 뇌 나이는 ${c.age}세`}</p>
      <p class="t-caption-01 t-secondary">나도 재보고 나란히 비교해봐요</p>
    </div>
    <button class="btn btn--secondary btn--sm" type="button" data-go="setup">나도 재보기</button>`;
}

/* ---------- 기록 ---------- */
const history = () => store.get("history", []);
const lastRecord = () => history().slice(-1)[0] || null;
const daysSince = (t) => Math.floor((Date.now() - t) / DAY);

function isBetter(k, v, prev) {
  if (prev == null || v == null) return false;
  return META[k].better === "low" ? v < prev : v > prev;
}

/* ---------- 첫 화면 ---------- */
function enterIntro() {
  showView("intro");
  state.intro?.stop();
  state.intro = startIntro($("#intro"));
  const last = lastRecord();
  $("#openHistory").hidden = !last;
  const nudge = $("#nudge");
  if (last && daysSince(last.t) >= 7) {
    nudge.hidden = false;
    nudge.textContent = `마지막 측정 후 ${daysSince(last.t)}일 지났어요. 다시 재볼 때예요!`;
  } else if (last) {
    nudge.hidden = false;
    nudge.textContent = `지난 기록: 뇌 나이 ${last.age}세`;
  } else {
    nudge.hidden = true;
  }
}

/* ---------- 준비 화면 ---------- */
function enterSetup() {
  state.intro?.stop();
  showView("setup");
  const real = store.get("real");
  if (real) $("#realAge").value = real;
  $("#gameList").innerHTML = KEYS.map(
    (k, i) => `<li class="setup__item">
      <span class="setup__icon mono" aria-hidden="true">${META[k].code}</span>
      <span class="grow"><span class="t-body-02-strong">${i + 1}. ${META[k].name}</span><br /><span class="t-caption-01 t-secondary">${HOWTO[k].lead}</span></span>
      <span class="t-caption-01 t-tertiary">${HOWTO[k].lines[HOWTO[k].lines.length - 1]}</span>
    </li>`
  ).join("");
}

function readRealAge() {
  const field = $("#ageField");
  const v = $("#realAge").value.trim();
  field.classList.remove("is-error");
  if (!v) {
    store.remove("real");
    return { ok: true, real: null };
  }
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 5 || n > 110) {
    field.classList.add("is-error");
    field.querySelector(".field__help").textContent = "5~110 사이 숫자로 넣어주세요. 비워둬도 돼요.";
    return { ok: false };
  }
  store.set("real", n);
  return { ok: true, real: n };
}

/* ---------- 게임 진행 ---------- */
function renderSteps() {
  $("#steps").innerHTML = KEYS.map(
    (k, i) => `<li class="game-step" data-k="${k}"><span class="mono" aria-hidden="true">${i + 1}</span><span class="sr-only">${META[k].name}</span></li>`
  ).join("");
}

function setProgress(i, done) {
  document.querySelectorAll(".game-step").forEach((el, j) => {
    el.classList.toggle("is-done", j < i || (j === i && done));
    el.classList.toggle("is-now", j === i && !done);
  });
  $("#stepCount").textContent = `${i + 1}/${KEYS.length}`;
  $("#progressFill").style.transform = `scaleX(${(i + (done ? 1 : 0.15)) / KEYS.length})`;
}

async function runGames(real) {
  state.intro?.stop();
  state.ctrl?.abort();
  const ctrl = new AbortController();
  state.ctrl = ctrl;
  const results = {};
  const best = store.get("best", {});
  renderSteps();
  document.body.classList.add("is-playing");
  showView("game");
  const area = $("#area");
  try {
    for (let i = 0; i < KEYS.length; i++) {
      const k = KEYS[i];
      setProgress(i, false);
      const act = await howTo(area, k, ctrl.signal);
      let res;
      if (act === "skip") {
        res = { raw: null };
      } else {
        await countdown(area, ctrl.signal);
        res = await PLAY[k](area, ctrl.signal);
      }
      results[k] = res;
      setProgress(i, true);
      const next = KEYS[i + 1];
      await doneScreen(area, k, res, { nextName: next ? META[next].name : null, isBest: isBetter(k, res.raw, best[k]) }, ctrl.signal);
    }
    document.body.classList.remove("is-playing");
    finish(results, real);
  } catch (e) {
    document.body.classList.remove("is-playing");
    if (e?.name !== "AbortError") throw e;
  }
}

let quitArmed = 0;
function quit() {
  if (Date.now() - quitArmed > 2500) {
    quitArmed = Date.now();
    toast("한 번 더 누르면 측정을 그만둬요");
    return;
  }
  quitArmed = 0;
  state.ctrl?.abort();
  document.body.classList.remove("is-playing");
  enterSetup();
}

/* ---------- 결과 ---------- */
function finish(results, real) {
  const raw = {};
  KEYS.forEach((k) => (raw[k] = results[k]?.raw ?? null));
  const unsure = !!results.hear?.unsure;
  const comp = computeAll(raw, { hearUnsure: unsure });
  const prevList = history();
  const best = store.get("best", {});
  const newBest = new Set();
  KEYS.forEach((k) => {
    if (raw[k] == null) return;
    if (isBetter(k, raw[k], best[k])) newBest.add(k);
    if (best[k] == null || isBetter(k, raw[k], best[k])) best[k] = raw[k];
  });
  const rec = { t: Date.now(), age: comp.brain, real: real ?? null, raw, unsure };
  store.set("best", best);
  store.set("history", [...prevList, rec].slice(-60));
  renderResult(rec, { fresh: true, newBest, timesBefore: prevList.length });
}

function deltaText(rec) {
  const list = history();
  const idx = list.findIndex((r) => r.t === rec.t);
  const prev = idx > 0 ? list[idx - 1] : null;
  if (!prev) return "";
  const days = Math.floor((rec.t - prev.t) / DAY);
  const when = days >= 6 && days <= 8 ? "지난주보다" : days >= 1 ? `${days}일 전보다` : "지난번보다";
  const d = prev.age - rec.age;
  if (d > 0) return `${when} <b>${d}살 젊어졌어요</b> ↓${d}`;
  if (d < 0) return `${when} ${-d}살 많게 나왔어요. 컨디션 탓일 수 있어요`;
  return `${when} 그대로예요. 꾸준하네요`;
}

function cmpHTML(rec) {
  if (!rec.real) {
    return `<form class="res-real" id="realForm">
      <input class="input" id="realInline" type="number" inputmode="numeric" min="5" max="110" placeholder="실제 나이" aria-label="실제 나이" />
      <button class="btn btn--secondary" type="submit">비교하기</button>
    </form>`;
  }
  const d = rec.real - rec.age;
  if (d > 0) return `<p class="res-cmp">실제 나이 ${rec.real}세보다 <mark>${d}살 젊어요</mark></p>`;
  if (d < 0) return `<p class="res-cmp">실제 나이 ${rec.real}세보다 ${-d}살 많게 나왔어요</p><p class="report__small">피곤하면 이렇게 나오기도 해요. 푹 쉬고 다시 재봐요.</p>`;
  return `<p class="res-cmp">실제 나이 ${rec.real}세와 <mark>똑같아요</mark></p>`;
}

function vsHTML(me, comp) {
  const c = state.challenge;
  if (!c) return "";
  const them = computeAll(c.raw);
  const rows = KEYS.map((k) => {
    const a = me.raw[k];
    const b = c.raw[k];
    const win = a != null && b != null && a !== b ? (META[k].better === "low" ? (a < b ? "me" : "them") : a > b ? "me" : "them") : "";
    const cell = (v, on) => `<span class="vs__cell t-num${on ? " is-win" : ""}">${v == null ? "–" : META[k].fmt(v)}</span>`;
    return `<li class="vs__row"><span class="vs__k"><b class="mono">${META[k].code}</b> ${META[k].short}</span>${cell(a, win === "me")}${cell(b, win === "them")}</li>`;
  }).join("");
  const gap = Math.abs(me.age - c.age);
  const msg =
    gap <= 2
      ? "거의 똑같아요! 역시 통하는 사이네요"
      : me.age < c.age
        ? `이번엔 제가 더 젊게 나왔어요. 다음엔 ${esc(josa(who(c), "이랑", "랑"))} 같이 재봐요!`
        : `이번엔 ${esc(josa(who(c), "이", "가"))} 한 수 위! 일주일 뒤에 다시 도전해봐요`;
  const myWins = KEYS.filter((k) => me.raw[k] != null && c.raw[k] != null && isBetter(k, me.raw[k], c.raw[k])).map((k) => META[k].short);
  return `<div class="paper vs">
    <p class="paper__title mono"><span>나란히 보기</span><span>나 & ${esc(c.name || "상대")}</span></p>
    <div class="vs__ages">
      <div><span class="mono">나</span><b class="t-num">${me.age}<small>세</small></b></div>
      <span class="vs__and" aria-hidden="true">&amp;</span>
      <div><span class="mono">${esc(c.name || "상대")}</span><b class="t-num">${c.age}<small>세</small></b></div>
    </div>
    <ul class="vs__list">
      <li class="vs__row vs__row--head"><span></span><span>나</span><span>${esc(c.name || "상대")}</span></li>
      ${rows}
    </ul>
    <p class="paper__text">${msg}${myWins.length === KEYS.length ? " 이번엔 다섯 채널 모두 제가 앞섰네요." : myWins.length ? ` 저는 ${myWins.join("·")} 쪽이 강했어요.` : ""}</p>
    <p class="report__small">능력치 그래프의 점선이 ${esc(who(c))} 결과예요. 순위가 아니라 같이 노는 비교예요.</p>
  </div>`;
}

function renderResult(rec, { fresh = false, newBest = new Set(), timesBefore = 0 } = {}) {
  state.current = rec;
  const comp = computeAll(rec.raw, { hearUnsure: rec.unsure });
  const best = store.get("best", {});
  const list = history();
  const delta = deltaText(rec);
  const them = state.challenge ? computeAll(state.challenge.raw).skills : null;
  const next = new Date(rec.t + 7 * DAY);
  const nextLabel = `${next.getMonth() + 1}월 ${next.getDate()}일(${"일월화수목금토"[next.getDay()]})`;
  const overdue = Date.now() >= next.getTime();

  const dt = new Date(rec.t);
  const pad2 = (n) => String(n).padStart(2, "0");
  const stamp = `${dt.getFullYear()}.${pad2(dt.getMonth() + 1)}.${pad2(dt.getDate())} ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
  const no = String(Math.max(1, list.findIndex((r) => r.t === rec.t) + 1)).padStart(4, "0");

  $("#resultBody").innerHTML = `
  <div class="res stack gap-16">
    <article class="paper report">
      <header class="paper__title mono"><span>뇌 나이 검사 성적서</span><span>No.${no}</span></header>
      <p class="report__meta mono">${stamp} · 5CH · 재미용</p>
      <div class="report__main">
        <div class="report__gauge">${gaugeSVG()}</div>
        <div class="report__age">
          <span class="report__k">뇌 나이</span>
          <span class="report__num">${rollMarkup(rec.age, `${rec.age}세`)}<small>세</small></span>
          <span class="report__band">${ageBand(rec.age)} 수준</span>
        </div>
      </div>
      ${cmpHTML(rec)}
      ${delta ? `<p class="res-delta">${delta}</p>` : ""}
      <span class="stamp report__stamp">${state.challenge ? "도전 완료" : "측정 완료"}</span>
    </article>

    ${vsHTML(rec, comp)}

    <div class="res-actions stack gap-8">
      <button class="btn btn--primary btn--lg btn--block btn--spring" id="toParents">${state.challenge ? `${esc(who(state.challenge))}께 답장 보내기` : "부모님께 도전장 보내기"}</button>
      <div class="res-actions__row">
        <button class="btn btn--secondary btn--block btn--spring" id="saveImage">성적서 이미지</button>
        <button class="btn btn--outline btn--block btn--spring" id="again">다시 측정</button>
      </div>
    </div>

    <section class="paper">
      <p class="paper__title mono"><span>채널별 측정값</span><span>RAW → 환산</span></p>
      <table class="report__table">
        <thead><tr><th scope="col">채널</th><th scope="col">측정값</th><th scope="col">환산</th><th scope="col">개인 최고</th></tr></thead>
        <tbody>
        ${KEYS.map((k) => {
          const v = rec.raw[k];
          const a = comp.ages[k];
          return `<tr>
            <th scope="row"><b class="mono">${META[k].code}</b> ${META[k].name}</th>
            <td class="mono">${v == null ? "건너뜀" : META[k].fmt(v)}${newBest.has(k) ? ` <em class="new">NEW</em>` : ""}</td>
            <td class="mono">${a == null ? "–" : `${a}세`}</td>
            <td class="mono">${v == null && best[k] == null ? "–" : META[k].fmt(best[k] ?? v)}</td>
          </tr>`;
        }).join("")}
        </tbody>
      </table>
      ${rec.unsure ? `<p class="report__small">CH4: 소리 없는 문제에서 '들려요'를 눌러서 절반만 반영했어요.</p>` : ""}
    </section>

    <section class="paper">
      <p class="paper__title mono"><span>능력치</span><span>0–100</span></p>
      <div class="res-radar">${radarSVG(comp.skills, { compare: them })}</div>
      <p class="report__small">클수록 젊은 쪽이에요.${them ? ` 점선은 ${esc(who(state.challenge))} 결과예요.` : ""}</p>
      ${
        comp.best && comp.weak && comp.best !== comp.weak
          ? `<div class="notes">
        <div class="note"><p class="note__k mono">강점 · ${META[comp.best].code}</p><p class="note__t">${META[comp.best].name}</p><p class="note__d">${TIPS[comp.best].best}</p></div>
        <div class="note"><p class="note__k mono">더 키워볼 것 · ${META[comp.weak].code}</p><p class="note__t">${META[comp.weak].name}</p><p class="note__d">${TIPS[comp.weak].weak}</p></div>
      </div>`
          : ""
      }
    </section>

    <section class="paper paper--chart">
      <p class="paper__title mono"><span>뇌 나이 기록지</span><span>${list.length}회 측정</span></p>
      ${
        list.length >= 2
          ? `${lineSVG(list.slice(-10).map((r) => ({ t: r.t, age: r.age })), rec.real)}<p class="report__small">아래로 갈수록 젊어요. 최근 10회까지 보여줘요.</p>`
          : `<p class="paper__text">다음 측정부터 기록지에 선이 그려져요. 일주일 뒤 같은 시간대에 재면 변화가 잘 보여요.</p>`
      }
    </section>

    <div class="remind">
      <div class="remind__date mono"><span>NEXT</span><b>${next.getMonth() + 1}/${next.getDate()}</b></div>
      <div class="grow">
        <p class="t-body-02-strong">${overdue ? "일주일이 지났어요. 다시 재볼 때예요" : "7일 후 다시 재보세요"}</p>
        <p class="t-caption-01 t-secondary">${overdue ? "같은 시간대에 재면 변화가 더 잘 보여요." : `${nextLabel}, 같은 시간대에 재면 변화가 잘 보여요.`}</p>
      </div>
      <button class="btn btn--outline btn--sm btn--spring" id="${overdue ? "againRemind" : "calendar"}">${overdue ? "지금 재기" : "캘린더 추가"}</button>
    </div>

    <p class="res-note t-caption-01 t-tertiary">
      재미로 보는 측정이에요. 의학적 진단이 아니고 치매·난청 같은 질환을 판단하지 않아요. 점수는 기기, 컨디션, 화면 밝기, 스피커에 따라 달라져요.
    </p>
  </div>`;

  showView("result");
  const report = $("#resultBody .report");
  const gauge = report.querySelector(".gauge-svg");
  rollTo(report.querySelector(".roll"), rec.age, { delay: fresh ? 300 : 0, duration: fresh ? 1500 : 500 });
  setGauge(gauge, 80, { anticipate: false, stiffness: 500, damping: 40 }).then(() =>
    setTimeout(() => setGauge(gauge, rec.age).then(() => report.classList.add("is-done")), fresh ? 250 : 0)
  );
  if (fresh) {
    haptic([10, 30, 10]);
    if (timesBefore === 0) setTimeout(() => toast("첫 기록이 저장됐어요. 일주일 뒤에 비교해봐요"), 2400);
  }

  $("#toParents").onclick = () => openShare(rec);
  $("#saveImage").onclick = (e) => saveImage(rec, comp, e.currentTarget);
  $("#again").onclick = () => enterSetup();
  $("#againRemind") && ($("#againRemind").onclick = () => enterSetup());
  $("#calendar") && ($("#calendar").onclick = () => addCalendar(next));
  const form = $("#realForm");
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const n = Math.round(Number($("#realInline").value));
      if (!Number.isFinite(n) || n < 5 || n > 110) {
        $("#realInline").classList.add("is-error");
        toast("5~110 사이 숫자로 넣어주세요");
        return;
      }
      store.set("real", n);
      rec.real = n;
      store.set("history", history().map((r) => (r.t === rec.t ? { ...r, real: n } : r)));
      renderResult(rec);
    };
  }
}

/* ---------- 결과 이미지 ---------- */
async function saveImage(rec, comp, btn) {
  btn.classList.add("is-loading");
  try {
    const no = Math.max(1, history().findIndex((r) => r.t === rec.t) + 1);
    const canvas = drawShareCard({ comp, raw: rec.raw, real: rec.real, no, t: rec.t });
    await shareImage(canvas, {
      filename: `brain-age-${rec.age}.png`,
      title: "뇌 나이 측정소",
      text: `내 뇌 나이는 ${rec.age}세! ${compareText(rec.age, rec.real)}`.trim(),
    });
  } finally {
    btn.classList.remove("is-loading");
  }
}

/* ---------- 캘린더 알림 (.ics) ---------- */
function addCalendar(date) {
  const ymd = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const end = new Date(date.getTime() + DAY);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const url = location.origin + location.pathname;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//brain-age//KO",
    "BEGIN:VEVENT",
    `UID:${date.getTime()}@brain-age`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymd(date)}`,
    `DTEND;VALUE=DATE:${ymd(end)}`,
    "SUMMARY:뇌 나이 다시 재기",
    `DESCRIPTION:일주일 전보다 젊어졌을까요? ${url}`,
    "BEGIN:VALARM",
    "TRIGGER:PT20H",
    "ACTION:DISPLAY",
    "DESCRIPTION:뇌 나이 다시 재기",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  downloadBlob(new Blob([ics], { type: "text/calendar" }), "brain-age-reminder.ics");
  toast("캘린더 파일을 저장했어요. 열면 일정에 추가돼요");
}

/* ---------- 도전장 보내기 ---------- */
const TO = {
  mom: { label: "엄마", text: (a) => `엄마, 내 뇌 나이 ${a}세래. 엄마도 해봐!` },
  dad: { label: "아빠", text: (a) => `아빠, 내 뇌 나이 ${a}세래. 아빠도 해봐!` },
  parents: { label: "부모님", text: (a) => `엄마 아빠, 내 뇌 나이 ${a}세래. 두 분도 해보세요!` },
  friend: { label: "친구", text: (a) => `나 뇌 나이 ${a}세 나왔어. 너도 해봐!` },
};

function openShare(rec) {
  const sheet = $("#shareSheet");
  const c = state.challenge;
  const options = { ...TO };
  if (c) {
    options.reply = {
      label: `답장: ${c.name || "보낸 사람"}`,
      text: (a) => `${c.name ? `${c.name}, ` : ""}나도 해봤어! 내 뇌 나이는 ${a}세. 우리 나란히 비교해봐`,
    };
  }
  let to = c ? "reply" : store.get("to", "mom");
  if (!options[to]) to = "mom";
  const nameEl = $("#myName");
  nameEl.value = store.get("name", "");
  const chips = $("#toChips");
  chips.innerHTML = Object.entries(options)
    .map(([k, o]) => `<button class="chip" type="button" data-to="${k}" aria-pressed="${k === to}">${esc(o.label)}</button>`)
    .join("");
  const preview = () => {
    $("#sharePreview").innerHTML = `<span class="t-caption-01 t-tertiary">보낼 메시지</span><p class="t-body-03">${esc(options[to].text(rec.age))}</p>`;
  };
  chips.onclick = (e) => {
    const b = e.target.closest("[data-to]");
    if (!b) return;
    to = b.dataset.to;
    chips.querySelectorAll("[data-to]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    preview();
  };
  preview();
  const close = openSheet(sheet);
  $("#sendChallenge").onclick = async () => {
    const name = nameEl.value.replace(/[<>&"'\n\r]/g, "").trim().slice(0, 10);
    store.set("name", name);
    if (to !== "reply") store.set("to", to);
    const s = KEYS.map((k) => rec.raw[k]);
    const url = urlWith({ c: encodeState({ v: 1, n: name, a: rec.age, s }) });
    close();
    await share({ title: "뇌 나이 측정소 도전장", text: options[to].text(rec.age), url });
  };
}

/* ---------- 이벤트 ---------- */
function init() {
  renderCrumb($("#crumb"));
  renderMoreSites($("#more"));
  renderChallengeBanner($("#challengeIntro"));
  renderChallengeBanner($("#challengeSetup"));
  enterIntro();

  // 측정 개시: 덮개가 열리고 버튼이 눌린 뒤 램프가 켜지면 준비 화면으로
  $("#start").onclick = () => {
    const b = $("#start");
    if (b.classList.contains("is-armed")) return;
    b.classList.add("is-armed");
    haptic([8, 60, 14]);
    setTimeout(() => {
      b.classList.remove("is-armed");
      enterSetup();
    }, prefersReducedMotion() ? 60 : 640);
  };
  $("#openHistory").onclick = () => {
    const last = lastRecord();
    if (last) renderResult(last);
  };
  $("#go").onclick = () => {
    const r = readRealAge();
    if (!r.ok) {
      $("#realAge").focus();
      return;
    }
    runGames(r.real);
  };
  $("#realAge").addEventListener("input", () => $("#ageField").classList.remove("is-error"));
  $("#quit").onclick = quit;
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-go]");
    if (!b) return;
    if (b.dataset.go === "intro") enterIntro();
    if (b.dataset.go === "setup") enterSetup();
  });
}

init();

// 검증용 (스크린샷 스크립트에서 결과 화면을 바로 열 때 사용)
export const __test = {
  finish: (raw, real = 34, unsure = false) => {
    const results = {};
    Object.entries(raw).forEach(([k, v]) => (results[k] = { raw: v, unsure: k === "hear" ? unsure : undefined }));
    finish(results, real);
  },
  renderResult,
  runGames,
  reloadChallenge() {
    state.challenge = readChallenge();
    renderChallengeBanner($("#challengeIntro"));
    renderChallengeBanner($("#challengeSetup"));
  },
};
