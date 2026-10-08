// 마피아 역할 나눠 주기 화면. 계산은 core.js
// 화면 4개: setup(판 만들기) → lobby(번호 고르기) → card(역할 카드, 링크·한 폰 같이 씀) → host(사회자: 진행 순서·타이머·역할 공개)
import { $, share, toast, renderMoreSites, prefersReducedMotion, ROOT_URL, getParam, haptic } from "../shared/kit.js";
import { ROLES, MIN_N, MAX_N, recommendMafia, maxMafia, newCode, cfgFromParams, queryOf, deal, store, stepsFor, mmss } from "./core.js";

const RM = prefersReducedMotion();
const VIEWS = ["setup", "lobby", "card", "host"];
let S = Object.assign({ n: 8, m: 2, d: 1, p: 1 }, store.get("setup", {}));
let C = null, mode = "link", cardNo = 0, opened = false;
let step = 0, day = 1;

function show(v) { for (const id of VIEWS) $("#" + id).hidden = id !== v; scrollTo({ top: 0 }); }
const mineKey = () => `mine:${C.k}:${C.r}`;

/* 역할 그림(외부 이미지 없이 SVG) */
const ICON = {
  mafia: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M10 40c6-3 14-4 22-4s16 1 22 4c-2 3-10 5-22 5s-20-2-22-5z" fill="currentColor"/><path d="M18 37l4-17c1-4 5-6 10-3 5-3 9-1 10 3l4 17c-4 1-9 2-14 2s-10-1-14-2z" fill="currentColor"/><path d="M19 33c4 1.5 8.5 2 13 2s9-.5 13-2" stroke="#c43d36" stroke-width="3" fill="none"/></svg>`,
  doctor: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="8" y="8" width="48" height="48" rx="12" fill="none" stroke="currentColor" stroke-width="4"/><path d="M27 18h10v9h9v10h-9v9H27v-9h-9V27h9z" fill="currentColor"/></svg>`,
  police: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 6l20 7v16c0 14-9 24-20 29C21 53 12 43 12 29V13z" fill="none" stroke="currentColor" stroke-width="4"/><path d="M32 20l3.5 7.2 7.9 1.1-5.7 5.6 1.4 7.9L32 38l-7.1 3.8 1.4-7.9-5.7-5.6 7.9-1.1z" fill="currentColor"/></svg>`,
  citizen: `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="22" r="10" fill="currentColor"/><path d="M12 56c2-12 10-18 20-18s18 6 20 18z" fill="currentColor"/></svg>`,
};

/* ---------- 판 만들기 ---------- */
function fixSetup() {
  S.n = Math.min(MAX_N, Math.max(MIN_N, +S.n || 8));
  S.d = S.d ? 1 : 0; S.p = S.p ? 1 : 0;
  S.m = Math.min(maxMafia(S.n), Math.max(1, +S.m || recommendMafia(S.n)));
  while (S.m + S.d + S.p > S.n - 1 && S.m > 1) S.m--;
}
function mixHTML(c) {
  const cit = c.n - c.m - c.d - c.p;
  return [["mafia", c.m], ["doctor", c.d], ["police", c.p], ["citizen", cit]].filter(([, v]) => v > 0)
    .map(([r, v]) => `<span class="mix__i mix__i--${r}">${ICON[r]}<b>${ROLES[r].name}</b><em>${v}</em></span>`).join("");
}
function renderSetup() {
  fixSetup();
  $("#nVal").textContent = `${S.n}명`;
  $("#nMinus").disabled = S.n <= MIN_N; $("#nPlus").disabled = S.n >= MAX_N;
  $("#mVal").textContent = `${S.m}명`;
  $("#mMinus").disabled = S.m <= 1; $("#mPlus").disabled = S.m >= maxMafia(S.n) || S.m + 1 + S.d + S.p > S.n - 1;
  const rec = recommendMafia(S.n);
  $("#mRec").textContent = S.m === rec ? `${S.n}명이면 추천 ${rec}명` : `${S.n}명이면 추천 ${rec}명 · 지금 ${S.m}명`;
  $("#mRec").classList.toggle("is-off", S.m !== rec);
  $("#doc").checked = !!S.d; $("#pol").checked = !!S.p;
  $("#mix").innerHTML = mixHTML(S);
  store.set("setup", S);
}
function newGame() { fixSetup(); return { n: S.n, m: S.m, d: S.d, p: S.p, k: newCode(), r: 1 }; }
function setURL() { history.replaceState(null, "", location.pathname + (C ? queryOf(C) : "")); }

/* ---------- 번호 고르기 ---------- */
function renderLobby() {
  $("#caseNo").textContent = C.k;
  $("#lobbyMix").innerHTML = mixHTML(C);
  $("#roundVal").textContent = `${C.r}판`;
  $("#rPrev").disabled = C.r <= 1;
  const mine = store.get(mineKey(), 0);
  $("#nums").innerHTML = Array.from({ length: C.n }, (_, i) => i + 1)
    .map((no) => `<button type="button" class="num${no === mine ? " is-mine" : ""}" data-no="${no}" style="--k:${no - 1}"><b>${no}</b>${no === mine ? "<i>내 번호</i>" : ""}</button>`).join("");
}
function toLobby() { mode = "link"; renderLobby(); show("lobby"); }

/* ---------- 카드 ---------- */
function resetCard() {
  opened = false;
  $("#flip").className = "flip";
  $("#hideBtn").disabled = true;
  for (const id of ["cardTeam", "cardRole", "cardMates", "cardDesc"]) $("#" + id).textContent = "";
  $("#cardIcon").innerHTML = "";
}
function openCard(no) {
  cardNo = no;
  resetCard();
  $("#backNo").textContent = no;
  $("#cardWho").textContent = `${no}번`;
  $("#flip").hidden = false;
  $("#peekWarn").hidden = true;
  if (mode === "pass") {
    $("#passStep").hidden = false;
    $("#passStep").innerHTML = `<b>${no}번</b> 차례 · 폰을 ${no}번에게 주세요 <span>${no} / ${C.n}</span>`;
    $("#flipHint").textContent = `${no}번만 눌러서 뒤집기`;
    $("#hideTxt").textContent = no < C.n ? `가리고 ${no + 1}번에게 넘기기` : "가리고 사회자에게";
  } else {
    $("#passStep").hidden = true;
    $("#flipHint").textContent = "눌러서 뒤집기";
    $("#hideTxt").textContent = "봤어요, 가리기";
    const mine = store.get(mineKey(), 0);
    if (mine && mine !== no) {
      $("#peekText").textContent = `이 폰에서 이미 ${mine}번을 열었어요. ${no}번은 다른 사람 번호일 수 있어요. 남의 역할을 보면 게임이 깨져요.`;
      $("#peekWarn").hidden = false;
      $("#flip").hidden = true;
    }
  }
  show("card");
}
function flipOpen() {
  if (opened || $("#flip").hidden) return;
  const me = deal(C).roles[cardNo - 1], R = ROLES[me.role];
  opened = true;
  $("#cardTeam").textContent = R.team;
  $("#cardIcon").innerHTML = ICON[me.role];
  $("#cardRole").textContent = R.name;
  $("#cardMates").textContent = me.role === "mafia" ? (me.mates.length ? `동료 마피아 · ${me.mates.map((x) => `${x}번`).join(", ")}` : "마피아는 당신 혼자예요") : "";
  $("#cardDesc").textContent = R.desc;
  $("#flip").classList.add("is-open", `is-${me.role}`);
  $("#hideBtn").disabled = false;
  if (mode === "link") store.set(mineKey(), cardNo);
  haptic?.(me.role === "mafia" ? [20, 30, 20] : 12);
}
function hideCard() {
  if (!opened) return;
  $("#flip").classList.remove("is-open");
  $("#hideBtn").disabled = true;
  setTimeout(() => {
    resetCard();
    if (mode === "pass") { if (cardNo < C.n) openCard(cardNo + 1); else toHost(); }
    else toLobby();
  }, RM ? 0 : 450);
}
function startPass() { mode = "pass"; openCard(1); }

/* ---------- 사회자: 진행 순서 + 타이머 ---------- */
let T = { left: 0, total: 0, run: false, end: 0, iv: 0 };
function stopTimer() { clearInterval(T.iv); T.iv = 0; if (T.run) T.left = Math.max(0, (T.end - Date.now()) / 1000); T.run = false; }
function setTimer(sec) { stopTimer(); T = { left: sec, total: sec, run: false, end: 0, iv: 0 }; renderTimer(); }
function renderTimer() {
  if (!T.total) return;
  const left = Math.max(0, Math.ceil(T.run ? (T.end - Date.now()) / 1000 : T.left));
  $("#tVal").textContent = mmss(left);
  $("#tBar").style.transform = `scaleX(${left / T.total})`;
  $("#tGoTxt").textContent = T.run ? "멈춤" : left === 0 ? "끝" : left === T.total ? "시작" : "이어서";
  $("#tGo").disabled = left === 0;
  $("#gtimer").classList.toggle("is-low", left > 0 && left <= 10);
  if (T.run && left === 0) { stopTimer(); T.left = 0; haptic?.([40, 60, 40]); toast("시간 끝"); renderTimer(); }
}
function renderStep() {
  const steps = stepsFor(C), s = steps[step];
  $("#dayLabel").textContent = `${day}일째 ${s.phase}`;
  $("#stepNo").textContent = `${step + 1} / ${steps.length}`;
  $("#host").querySelector(".guide").classList.toggle("is-day", s.phase === "낮");
  $("#dots").innerHTML = steps.map((x, i) => `<i class="${i === step ? "on" : i < step ? "done" : ""} ${x.phase === "낮" ? "d" : "n"}"></i>`).join("");
  $("#stepTitle").textContent = s.title;
  $("#stepSay").textContent = `“${s.say}”`;
  $("#stepTip").textContent = s.tip || "";
  $("#stepTip").hidden = !s.tip;
  $("#gtimer").hidden = !s.sec;
  if (s.sec) setTimer(s.sec); else { stopTimer(); T.total = 0; }
  $("#stepPrev").disabled = step === 0 && day === 1;
  $("#stepNextTxt").textContent = step === steps.length - 1 ? `${day + 1}일째 밤으로 ›` : "다음 ›";
  const g = $("#host").querySelector(".guide__t");
  g.classList.remove("is-in"); void g.offsetWidth; g.classList.add("is-in");
}
function moveStep(dir) {
  const n = stepsFor(C).length;
  step += dir;
  if (step >= n) { step = 0; day++; }
  if (step < 0) { if (day > 1) { day--; step = n - 1; } else step = 0; }
  renderStep();
}
function toHost() {
  step = 0; day = 1;
  $("#reveal").hidden = true; $("#reveal").innerHTML = "";
  $("#revealConfirm").hidden = true; $("#revealBtns").hidden = false;
  $("#nextTxt").textContent = `${C.r + 1}판으로`;
  renderStep();
  show("host");
}
function reveal() {
  const d = deal(C);
  $("#revealConfirm").hidden = true; $("#revealBtns").hidden = true;
  $("#reveal").innerHTML = `<p class="reveal__t">마피아 · <b id="rvMafia">${d.mafia.map((x) => `${x}번`).join(", ")}</b></p>
    <ul class="rv-grid" id="rvList">${d.roles.map((x, i) => `<li class="rv rv--${x.role}" data-no="${x.no}" data-role="${x.role}" style="--k:${i}"><span class="rv__in"><span class="rv__f rv__back"></span><span class="rv__f rv__face"><em>${x.no}번</em>${ICON[x.role]}<b>${ROLES[x.role].name}</b></span></span></li>`).join("")}</ul>`;
  $("#reveal").hidden = false;
  haptic?.([20, 40, 60]);
}
function nextRound() { C = { ...C, r: C.r + 1 }; setURL(); stopTimer(); if (mode === "pass") startPass(); else toLobby(); }

/* ---------- 시작 ---------- */
function init() {
  if (RM) document.documentElement.classList.add("rm");
  renderSetup();
  $("#nMinus").addEventListener("click", () => { S.n--; S.m = recommendMafia(S.n); renderSetup(); });
  $("#nPlus").addEventListener("click", () => { S.n++; S.m = recommendMafia(S.n); renderSetup(); });
  $("#mMinus").addEventListener("click", () => { S.m--; renderSetup(); });
  $("#mPlus").addEventListener("click", () => { S.m++; renderSetup(); });
  $("#doc").addEventListener("change", (e) => { S.d = e.target.checked ? 1 : 0; renderSetup(); });
  $("#pol").addEventListener("change", (e) => { S.p = e.target.checked ? 1 : 0; renderSetup(); });
  $("#start").addEventListener("click", () => { C = newGame(); setURL(); toLobby(); });
  $("#passBtn").addEventListener("click", () => { C = newGame(); setURL(); startPass(); });

  $("#nums").addEventListener("click", (e) => { const no = +e.target.closest("button")?.dataset.no; if (no) { mode = "link"; openCard(no); } });
  $("#rPrev").addEventListener("click", () => { if (C.r > 1) { C = { ...C, r: C.r - 1 }; setURL(); renderLobby(); } });
  $("#rNext").addEventListener("click", () => { C = { ...C, r: C.r + 1 }; setURL(); renderLobby(); });
  $("#shareBtn").addEventListener("click", async () => {
    const res = await share({ title: "마피아 게임", text: `마피아 게임 판 번호 ${C.k} · ${C.r}판. 링크 열고 자기 번호만 누르세요.`, url: `${ROOT_URL}mafia/${queryOf(C)}` });
    if (res === "shared") toast("보냈어요");
  });
  $("#hostBtn").addEventListener("click", toHost);
  $("#lobbyPass").addEventListener("click", startPass);
  $("#resetBtn").addEventListener("click", () => { C = null; setURL(); renderSetup(); show("setup"); });

  $("#flip").addEventListener("click", flipOpen);
  $("#hideBtn").addEventListener("click", hideCard);
  $("#peekBack").addEventListener("click", toLobby);
  $("#peekGo").addEventListener("click", () => { $("#peekWarn").hidden = true; $("#flip").hidden = false; });

  $("#stepPrev").addEventListener("click", () => moveStep(-1));
  $("#stepNext").addEventListener("click", () => moveStep(1));
  $("#tGo").addEventListener("click", () => {
    if (T.run) { stopTimer(); renderTimer(); return; }
    if (T.left <= 0) return;
    T.run = true; T.end = Date.now() + T.left * 1000; T.iv = setInterval(renderTimer, 250); renderTimer();
  });
  $("#tAdd").addEventListener("click", () => {
    if (T.run) T.end += 30000; else T.left += 30;
    T.total = Math.max(T.total, T.run ? Math.ceil((T.end - Date.now()) / 1000) : T.left);
    renderTimer();
  });
  $("#tReset").addEventListener("click", () => setTimer(stepsFor(C)[step].sec));
  $("#revealAsk").addEventListener("click", () => { $("#revealBtns").hidden = true; $("#revealConfirm").hidden = false; });
  $("#revealNo").addEventListener("click", () => { $("#revealBtns").hidden = false; $("#revealConfirm").hidden = true; });
  $("#revealYes").addEventListener("click", reveal);
  $("#nextRound").addEventListener("click", nextRound);
  $("#hostBack").addEventListener("click", () => { stopTimer(); toLobby(); });

  if (location.search) {
    C = cfgFromParams(getParam);
    if (C) toLobby();
    else { toast("링크가 깨졌어요. 사회자에게 다시 받아 보세요"); history.replaceState(null, "", location.pathname); }
  }
  renderMoreSites($("#more"), "mafia");
}
if (typeof document !== "undefined" && document.getElementById("flip")) init();
