// 라이어 게임 화면. 계산은 core.js
// 화면 4개: setup(판 만들기) → lobby(번호 고르기) → card(제시어 카드, 링크·한 폰 같이 씀) → host(진행자: 차례·타이머·정답 공개)
import { $, share, toast, renderMoreSites, prefersReducedMotion, ROOT_URL, getParam, haptic } from "../shared/kit.js";
import { TOPICS, ANY, MIN_N, MAX_N, maxLiars, newCode, cfgFromParams, queryOf, deal, cardFor, store, TALK_SEC, mmss } from "./core.js";

const RM = prefersReducedMotion();
const VIEWS = ["setup", "lobby", "card", "host"];
let S = Object.assign({ n: 6, t: "food", l: 1, s: 0 }, store.get("setup", {}));   // 판 만들기 값(이 기기에 기억)
let C = null;          // 지금 판 설정 { n, t, l, s, k, r }
let mode = "link";     // link: 각자 폰 / pass: 한 폰 돌려보기
let passNo = 1;        // 한 폰 모드에서 지금 차례 번호
let cardNo = 0;        // 카드에 띄운 번호
let opened = false;

function show(v) { for (const id of VIEWS) $("#" + id).hidden = id !== v; scrollTo({ top: 0 }); }
const topicName = (t) => (t === ANY ? "아무거나" : TOPICS.find((x) => x.key === t)?.name || "");
const mineKey = () => `mine:${C.k}:${C.r}`;

/* ---------- 판 만들기 ---------- */
function fixSetup() {
  S.n = Math.min(MAX_N, Math.max(MIN_N, +S.n || 6));
  if (!(S.t === ANY || TOPICS.some((x) => x.key === S.t))) S.t = "food";
  S.l = Math.min(maxLiars(S.n), Math.max(1, +S.l || 1));
  S.s = S.s ? 1 : 0;
}
function renderSetup() {
  fixSetup();
  $("#nVal").textContent = `${S.n}명`;
  $("#nMinus").disabled = S.n <= MIN_N;
  $("#nPlus").disabled = S.n >= MAX_N;
  $("#topics").innerHTML = [...TOPICS.map((x) => [x.key, x.name]), [ANY, "아무거나"]]
    .map(([k, nm]) => `<button type="button" role="radio" class="lchip${S.t === k ? " is-on" : ""}" aria-checked="${S.t === k}" data-t="${k}">${nm}</button>`).join("");
  document.querySelectorAll("#liarSeg button").forEach((b) => {
    const l = +b.dataset.l;
    b.disabled = l > maxLiars(S.n);
    b.classList.toggle("is-on", l === S.l);
    b.setAttribute("aria-checked", String(l === S.l));
  });
  $("#spy").checked = !!S.s;
  store.set("setup", S);
}
function newGame() { fixSetup(); return { n: S.n, t: S.t, l: S.l, s: S.s, k: newCode(), r: 1 }; }
function setURL() { history.replaceState(null, "", location.pathname + (C ? queryOf(C) : "")); }

/* ---------- 번호 고르기 ---------- */
function renderLobby() {
  $("#caseNo").textContent = C.k;
  $("#meta").innerHTML = [["인원", `${C.n}명`], ["주제", topicName(C.t)], ["라이어", `${C.l}명`], ["스파이", C.s ? "켬" : "끔"]]
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
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
  $("#flip").classList.remove("is-open", "is-liar");
  $("#hideBtn").disabled = true;
  // 뒷면 글자는 열 때만 채운다(닫힌 카드에는 아무 말도 없음)
  for (const id of ["cardWord", "cardSub", "cardTopic", "cardK"]) $("#" + id).textContent = "";
  $("#cardStamp").hidden = true;
}
function openCard(no) {
  cardNo = no;
  resetCard();
  $("#sealNo").textContent = no;
  $("#cardWho").textContent = `${no}번`;
  $("#flip").hidden = false;
  $("#peekWarn").hidden = true;
  if (mode === "pass") {
    $("#passStep").hidden = false;
    $("#passStep").innerHTML = `<b>${no}번</b> 차례 · 폰을 ${no}번에게 주세요 <span>${no} / ${C.n}</span>`;
    $("#flipHint").textContent = `${no}번만 눌러서 열기`;
    $("#hideTxt").textContent = no < C.n ? `가리고 ${no + 1}번에게 넘기기` : "가리고 진행 화면으로";
  } else {
    $("#passStep").hidden = true;
    $("#flipHint").textContent = "눌러서 열기";
    $("#hideTxt").textContent = "봤어요, 가리기";
    const mine = store.get(mineKey(), 0);
    if (mine && mine !== no) {   // 이 폰에서 이미 다른 번호를 열었음 → 한 번 더 묻기
      $("#peekText").textContent = `이 폰에서 이미 ${mine}번을 열었어요. ${no}번은 다른 사람 번호일 수 있어요. 남의 제시어를 보면 게임이 깨져요.`;
      $("#peekWarn").hidden = false;
      $("#flip").hidden = true;
    }
  }
  show("card");
}
function flipOpen() {
  if (opened || $("#flip").hidden) return;
  const d = deal(C), me = d.roles[cardNo - 1];
  opened = true;
  $("#cardTopic").textContent = `주제 · ${d.topic.name}`;
  if (me.word == null) {
    $("#cardK").textContent = "당신은";
    $("#cardWord").textContent = "라이어";
    $("#cardSub").textContent = C.l > 1 ? `라이어는 ${C.l}명이에요. 제시어를 아는 척 설명하고, 남의 설명으로 제시어를 알아내세요.` : "제시어를 아는 척 설명하고, 남의 설명으로 제시어를 알아내세요.";
    $("#cardStamp").hidden = false;
    $("#flip").classList.add("is-liar");
  } else {
    $("#cardK").textContent = "제시어";
    $("#cardWord").textContent = me.word;
    $("#cardSub").textContent = "라이어가 눈치채지 못하게, 그래도 같은 편은 알아듣게 설명하세요.";
  }
  $("#flip").classList.add("is-open");
  $("#hideBtn").disabled = false;
  if (mode === "link") store.set(mineKey(), cardNo);
  haptic?.(12);
}
function hideCard() {
  if (!opened) return;
  $("#flip").classList.remove("is-open");
  $("#hideBtn").disabled = true;
  const next = () => {
    resetCard();
    if (mode === "pass") {
      if (cardNo < C.n) { passNo = cardNo + 1; openCard(passNo); }
      else toHost();
    } else toLobby();
  };
  setTimeout(next, RM ? 0 : 450);
}
function startPass() { mode = "pass"; passNo = 1; openCard(1); }

/* ---------- 진행자 ---------- */
let T = { left: TALK_SEC, total: TALK_SEC, run: false, end: 0, iv: 0 };
function renderTimer() {
  const left = Math.max(0, Math.ceil(T.run ? (T.end - Date.now()) / 1000 : T.left));
  $("#tVal").textContent = mmss(left);
  const c = 2 * Math.PI * 52;
  $("#ring").style.strokeDasharray = c;
  $("#ring").style.strokeDashoffset = c * (1 - left / T.total);
  $("#tGoTxt").textContent = T.run ? "멈춤" : left === 0 ? "끝" : left === T.total ? "토론 시작" : "이어서";
  $("#tGo").disabled = left === 0;
  document.querySelector(".timer").classList.toggle("is-low", left > 0 && left <= 10);
  if (T.run && left === 0) { stopTimer(); T.left = 0; haptic?.([40, 60, 40]); toast("토론 끝. 동시에 라이어를 가리켜요"); renderTimer(); }
}
function stopTimer() { clearInterval(T.iv); T.iv = 0; if (T.run) T.left = Math.max(0, (T.end - Date.now()) / 1000); T.run = false; }
function resetTimer() { stopTimer(); T = { left: TALK_SEC, total: TALK_SEC, run: false, end: 0, iv: 0 }; renderTimer(); }

function toHost() {
  const d = deal(C);
  $("#hostCase").textContent = `${C.k} · ${C.r}판`;
  $("#order").innerHTML = d.order.map((no, i) => `<li style="--k:${i}"><span>${i + 1}</span><b>${no}번</b></li>`).join("");
  $("#reveal").hidden = true; $("#reveal").innerHTML = "";
  $("#revealConfirm").hidden = true; $("#revealBtns").hidden = false;
  $("#nextTxt").textContent = `${C.r + 1}판으로`;
  resetTimer();
  show("host");
}
function reveal() {
  const d = deal(C);
  $("#revealConfirm").hidden = true; $("#revealBtns").hidden = true;
  const r = $("#reveal");
  r.innerHTML = `
    <div class="reveal__top">
      <div class="rv-card" style="--k:0"><span>라이어</span><b id="rvLiars">${d.liars.map((x) => `${x}번`).join(" · ")}</b></div>
      <div class="rv-card" style="--k:1"><span>제시어</span><b id="rvWord">${d.word}</b></div>
      ${d.liarWord ? `<div class="rv-card" style="--k:2"><span>라이어가 받은 말</span><b id="rvLiarWord">${d.liarWord}</b></div>` : ""}
    </div>
    <p class="reveal__t">주제 · ${d.topic.name}</p>
    <ul class="rv-list" id="rvList">${d.roles.map((x, i) => `<li class="${x.liar ? "is-liar" : ""}" data-no="${x.no}" style="--k:${i}"><span>${x.no}번</span><b>${x.word ?? "제시어 모름"}</b>${x.liar ? "<i>라이어</i>" : ""}</li>`).join("")}</ul>`;
  r.hidden = false;
  haptic?.([20, 40, 60]);
}
function nextRound() {
  C = { ...C, r: C.r + 1 };
  setURL();
  if (mode === "pass") startPass(); else toLobby();
}

/* ---------- 시작 ---------- */
function init() {
  if (RM) document.documentElement.classList.add("rm");
  renderSetup();
  $("#nMinus").addEventListener("click", () => { S.n--; renderSetup(); });
  $("#nPlus").addEventListener("click", () => { S.n++; renderSetup(); });
  $("#topics").addEventListener("click", (e) => { const t = e.target.closest("button")?.dataset.t; if (!t) return; S.t = t; renderSetup(); });
  $("#liarSeg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b || b.disabled) return; S.l = +b.dataset.l; renderSetup(); });
  $("#spy").addEventListener("change", (e) => { S.s = e.target.checked ? 1 : 0; renderSetup(); });
  $("#start").addEventListener("click", () => { C = newGame(); setURL(); toLobby(); });
  $("#passBtn").addEventListener("click", () => { C = newGame(); setURL(); startPass(); });

  $("#nums").addEventListener("click", (e) => { const no = +e.target.closest("button")?.dataset.no; if (no) { mode = "link"; openCard(no); } });
  $("#rPrev").addEventListener("click", () => { if (C.r > 1) { C = { ...C, r: C.r - 1 }; setURL(); renderLobby(); } });
  $("#rNext").addEventListener("click", () => { C = { ...C, r: C.r + 1 }; setURL(); renderLobby(); });
  $("#shareBtn").addEventListener("click", async () => {
    const res = await share({ title: "라이어 게임", text: `라이어 게임 CASE ${C.k} · ${C.r}판. 링크 열고 자기 번호만 누르세요.`, url: `${ROOT_URL}liar/${queryOf(C)}` });
    if (res === "shared") toast("보냈어요");
  });
  $("#hostBtn").addEventListener("click", toHost);
  $("#lobbyPass").addEventListener("click", startPass);
  $("#resetBtn").addEventListener("click", () => { C = null; setURL(); renderSetup(); show("setup"); });

  $("#flip").addEventListener("click", flipOpen);
  $("#hideBtn").addEventListener("click", hideCard);
  $("#peekBack").addEventListener("click", toLobby);
  $("#peekGo").addEventListener("click", () => { $("#peekWarn").hidden = true; $("#flip").hidden = false; });

  $("#tGo").addEventListener("click", () => {
    if (T.run) { stopTimer(); renderTimer(); return; }
    if (T.left <= 0) return;
    T.run = true; T.end = Date.now() + T.left * 1000;
    T.iv = setInterval(renderTimer, 250); renderTimer();
  });
  $("#tAdd").addEventListener("click", () => {
    if (T.run) T.end += 30000; else T.left += 30;
    T.total = Math.max(T.total, T.run ? Math.ceil((T.end - Date.now()) / 1000) : T.left);
    renderTimer();
  });
  $("#tReset").addEventListener("click", resetTimer);
  $("#revealAsk").addEventListener("click", () => { $("#revealBtns").hidden = true; $("#revealConfirm").hidden = false; });
  $("#revealNo").addEventListener("click", () => { $("#revealBtns").hidden = false; $("#revealConfirm").hidden = true; });
  $("#revealYes").addEventListener("click", reveal);
  $("#nextRound").addEventListener("click", nextRound);
  $("#hostBack").addEventListener("click", () => { stopTimer(); toLobby(); });

  // 링크로 들어온 경우
  if (location.search) {
    C = cfgFromParams(getParam);
    if (C) toLobby();
    else { toast("링크가 깨졌어요. 진행자에게 다시 받아 보세요"); history.replaceState(null, "", location.pathname); }
  }
  renderMoreSites($("#more"), "liar");
}
if (typeof document !== "undefined" && document.getElementById("flip")) init();
