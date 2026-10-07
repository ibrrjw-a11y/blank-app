// 단어 야구 화면. 계산은 core.js
import { $, share, toast, renderMoreSites, prefersReducedMotion, ROOT_URL, getParam, haptic } from "../shared/kit.js";
import { TRIES, LEN, DAY, split, validWord, clean, judge, dailyWord, randomWord, encodeWord, decodeWord, loadGame, saveGame, throwWord, record, stats, shareText, store, MEMO_CONS, MEMO_VOW } from "./core.js";

const RM = prefersReducedMotion();
let G = null, kind = "";
let memo = store.get("memo", {}); // { [경기 key]: { [자모]: 1 아님 | 2 확실 } }
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
function show(v) { for (const id of ["intro", "play", "end", "make"]) $("#" + id).hidden = id !== v; scrollTo({ top: 0 }); }

/* ---------- 판 ---------- */
function pips(r) {
  return `<span class="pips">${[...Array(r.n).keys()].map((k) => `<i class="${k < r.s ? "s" : ""}"></i>`).join("")}${[...Array(r.b).keys()].map(() => `<i class="b"></i>`).join("")}</span>`;
}
function renderTries(fresh = false) {
  $("#tries").innerHTML = G.guesses.map((w, i) => {
    const rs = judge(G.answer, w), last = fresh && i === G.guesses.length - 1;
    return `<li class="try${last ? " is-new" : ""}"><span class="try__n">${i + 1}</span>${[...w].map((ch, k) => `<span class="try__c" style="--k:${k}"><b class="cell cell--s">${ch}</b>${pips(rs[k])}<em>${rs[k].s || rs[k].b ? `${rs[k].s}S ${rs[k].b}B` : "OUT"}</em></span>`).join("")}</li>`;
  }).join("");
  $("#left").textContent = `${TRIES - G.guesses.length}번 남음`;
  // 정답 칸: 글자마다 자모 수만큼 빈 점(받침 여부 힌트)
  $("#ans").innerHTML = [...G.answer].map((ch) => `<span class="ans__c"><b class="cell">?</b><span class="pips">${split(ch).map(() => "<i></i>").join("")}</span></span>`).join("");
}
function renderMemo() {
  const m = memo[G.key] || {};
  const btn = (j) => `<button type="button" class="memo__d m${m[j] || 0}" data-j="${j}">${j}</button>`;
  $("#memoC").innerHTML = MEMO_CONS.map(btn).join("");
  $("#memoV").innerHTML = MEMO_VOW.map(btn).join("");
}
function err(id, t) { const e = $(id); e.textContent = t; e.hidden = false; clearTimeout(e._t); e._t = setTimeout(() => (e.hidden = true), 1800); }

/* ---------- 경기 ---------- */
function start(key, answer, label) {
  kind = label;
  G = loadGame(key, answer);
  $("#modeLabel").textContent = label;
  $("#guess").value = "";
  renderTries(); renderMemo();
  if (G.done) return finish(false);
  show("play");
}
function throwNow() {
  const w = clean($("#guess").value);
  if (!validWord(w)) return err("#err", "한글 두 글자로 적어요");
  if (G.guesses.includes(w)) return err("#err", "이미 던진 단어예요");
  const r = throwWord(G, w);
  if (!r) return;
  saveGame(G);
  $("#guess").value = "";
  renderTries(true);
  haptic?.(G.won ? [20, 40, 20, 40, 30] : 10);
  if (G.done) setTimeout(() => finish(true), RM ? 0 : 900);
}
function finish(fresh) {
  record(G);
  $("#endMode").textContent = kind;
  $("#endTries").textContent = G.won ? `${G.guesses.length}번` : `${TRIES}번 끝`;
  $("#ansCells").innerHTML = [...G.answer].map((ch, k) => `<span class="cell" style="--k:${k}">${ch}</span>`).join("");
  const s = $("#endStamp");
  s.textContent = G.won ? (G.guesses.length === 1 ? "한 번에!" : "맞힘") : "못 맞힘";
  s.className = `stamp stamp--end ${G.won ? "is-win" : "is-lose"}${fresh && !RM ? " is-fresh" : ""}`;
  const st = stats();
  $("#endLine").textContent = `${G.won ? `${G.guesses.length}번 만에 맞혔어요.` : `정답은 '${G.answer}'였어요.`} · 지금까지 ${st.played}판 ${st.won}번 맞힘`;
  $("#shareText").textContent = shareText(kind, G);
  show("end");
}

/* ---------- 첫 화면 견본: 자모가 날아와 칸에 모였다 흩어지고 도장이 찍힘 ---------- */
function demo() {
  const words = ["고래", "구름", "사과", "바다"], fly = $("#heroJamo");
  let k = 0;
  const step = () => {
    const w = words[k % words.length]; k++;
    fly.innerHTML = [...w].flatMap((ch, i) => split(ch).map((j, r) => `<i style="--i:${i};--r:${r};--d:${(i * 3 + r) * 0.07}s">${j}</i>`)).join("");
    fly.classList.remove("is-go"); void fly.offsetWidth; fly.classList.add("is-go");
    setTimeout(() => { $("#heroA").textContent = w[0]; $("#heroB").textContent = w[1]; const r = judge("고래", w); const s = $("#heroStamp"); s.textContent = r.map((x) => (x.s || x.b ? `${x.s}S ${x.b}B` : "OUT")).join(" · "); s.classList.remove("is-fresh"); void s.offsetWidth; s.classList.add("is-fresh"); }, 700);
    setTimeout(() => { $("#heroA").textContent = "?"; $("#heroB").textContent = "?"; }, 2300);
  };
  if (RM) return;
  step(); setInterval(step, 2800);
}

let friend = null;
function openMake() { $("#mword").value = ""; $("#byName").value = store.get("name", ""); show("make"); }
function init() {
  if (RM) document.documentElement.classList.add("rm");
  demo();
  $("#dailyNo").textContent = `#${DAY}`;
  const st = stats(), dg = store.get(`g:d${DAY}`, null);
  $("#rec").textContent = `${dg?.done ? (dg.won ? `오늘의 단어 ${dg.guesses.length}번 만에 맞힘 · ` : "오늘의 단어 못 맞힘 · ") : ""}${st.played}판 ${st.won}번 맞힘`;
  const n = getParam("w");
  if (n) {
    const w = decodeWord(n), by = String(getParam("by") || "").slice(0, 10);
    if (w && validWord(w)) {
      friend = { n, w, by };
      const c = $("#chal"); c.hidden = false;
      c.innerHTML = `<b>${esc(by ? `${by}의 단어` : "친구가 낸 단어")}</b><span>두 글자, 몇 번 만에 맞히는지 보여 줘요.</span><button class="wb-go" id="playFriend" type="button"><span class="wb-go__k">도전</span><span>친구 단어 맞히기</span></button>`;
      $("#playFriend").addEventListener("click", () => start(`f${n}`, friend.w, by ? `${by}의 단어` : "친구 단어"));
    } else toast("링크가 깨졌어요. 친구에게 다시 받아 보세요");
  }
  $("#playDaily").addEventListener("click", () => start(`d${DAY}`, dailyWord(), `오늘의 단어 #${DAY}`));
  const practice = () => { const w = randomWord(); start(`r${Date.now().toString(36)}`, w, "연습"); };
  $("#playRandom").addEventListener("click", practice);
  $("#again").addEventListener("click", practice);
  $("#makeBtn").addEventListener("click", openMake);
  $("#makeBtn2").addEventListener("click", openMake);
  $("#ask").addEventListener("submit", (e) => { e.preventDefault(); throwNow(); });
  const toggle = (e) => {
    const j = e.target.closest("button")?.dataset.j; if (!j) return;
    const m = (memo[G.key] ||= {}); m[j] = ((m[j] || 0) + 1) % 3;
    store.set("memo", memo); renderMemo();
  };
  $("#memoC").addEventListener("click", toggle);
  $("#memoV").addEventListener("click", toggle);
  $("#mshare").addEventListener("click", async () => {
    const w = clean($("#mword").value);
    if (!validWord(w)) return err("#merr", "한글 두 글자로 적어요");
    const by = $("#byName").value.trim().slice(0, 10);
    store.set("name", by);
    const url = `${ROOT_URL}word-baseball/?w=${encodeWord(w)}${by ? `&by=${encodeURIComponent(by)}` : ""}`;
    const r = await share({ title: "단어 야구 도전", text: `${by || "친구"}가 낸 두 글자 단어, 몇 번 만에 맞힐 수 있어? ✏️`, url });
    if (r === "shared") toast("보냈어요");
  });
  $("#shareBtn").addEventListener("click", async () => {
    const url = G.key.startsWith("f") ? `${ROOT_URL}word-baseball/?w=${G.key.slice(1)}` : `${ROOT_URL}word-baseball/`;
    const r = await share({ title: "단어 야구", text: $("#shareText").textContent, url });
    if (r === "shared") toast("보냈어요");
  });
  renderMoreSites($("#more"), "word-baseball");
}
if (typeof document !== "undefined" && document.getElementById("tries")) init();
