// 타자 속도 측정 화면. 계산은 core.js
// 한글 입력기(IME) 처리: 자음·모음을 조합하는 동안(compositionstart~compositionend)에는 그 글자를 판정하지 않고(흐리게 깜빡임),
// 다음 문장으로 넘기는 것도 조합이 끝날 때까지 미룬다. 조합 중 Enter 는 '조합 끝나면 넘기기'로 기억해 둔다.
// 휴대폰 키보드도 같은 이벤트(input·composition)를 내므로 따로 나누지 않는다. 판정은 늘 입력 칸의 실제 글자(value)로 한다.
import { $, share, toast, renderMoreSites, prefersReducedMotion, ROOT_URL, getParam, haptic } from "../shared/kit.js";
import { PER, DAY, pickSet, dailyK, randomK, parseK, parseCpm, keysOf, keyCap, KEY_ROWS, gradeLine, marks, result, addHistory, history, shareText, store } from "./core.js";

const RM = prefersReducedMotion();
const now = () => Date.now();
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const keyName = (k) => (k === " " || k === "␣" ? "띄어쓰기" : k);
let R = null;          // 지금 판: { k, label, set, i, lines, t0, composing, pendingEnter }
let friend = null;     // 도전장: { k, t, by }
let ticker = 0;

function show(v) { for (const id of ["intro", "play", "end"]) $("#" + id).hidden = id !== v; scrollTo({ top: 0 }); }

/* ---------- 자판 그림 ---------- */
function kbHTML(counts = null) {
  const max = counts ? Math.max(1, ...Object.values(counts)) : 1;
  let n = 0;
  return KEY_ROWS.map((row) => `<div class="kb__row">${row.map((cap) => {
    const c = counts ? counts[cap] || 0 : 0;
    const h = counts ? (c / max).toFixed(3) : 0;
    return `<span class="key${cap === "␣" ? " key--space" : ""}${c ? " on" : ""}" data-cap="${esc(cap)}" data-n="${c}" style="--h:${h};--k:${n++}"><i>${cap === "␣" ? "" : esc(cap)}</i></span>`;
  }).join("")}</div>`).join("");
}
function lightNext(ch) {
  const want = new Set(ch ? keysOf(ch).map(keyCap) : []);
  document.querySelectorAll("#kbLive .key").forEach((k) => k.classList.toggle("is-next", want.has(k.dataset.cap)));
}

/* ---------- 한 판 ---------- */
function start(k, label) {
  R = { k, label, set: pickSet(k), i: 0, lines: [], t0: null, composing: false, pendingEnter: false };
  $("#modeLabel").textContent = label;
  $("#typeIn").value = "";
  $("#doneLines").innerHTML = "";
  $("#liveCpm").textContent = "0";
  renderLine();
  show("play");
  $("#typeIn").focus();
  clearInterval(ticker);
  ticker = setInterval(liveCpm, 500);
}
const target = () => R.set[R.i];

function renderLine() {
  const t = target(), v = $("#typeIn").value;
  const m = marks(t, v, R.composing);
  $("#target").innerHTML = [...t].map((ch, i) => `<span class="c c${m[i]}${i === [...v].length && !R.composing ? " is-cur" : ""}">${ch === " " ? "&nbsp;" : esc(ch)}</span>`).join("");
  $("#lineNo").textContent = String(R.i + 1);
  const at = R.composing ? Math.max(0, [...v].length - 1) : [...v].length;
  lightNext([...t][at]);
}
function liveCpm() {
  if (!R || R.t0 == null || $("#play").hidden) return;
  const v = $("#typeIn").value;
  let s = R.lines.reduce((a, l) => a + gradeLine(l.target, l.typed).strokes, 0);
  // 치는 중인 문장: 조합 중인 마지막 글자는 빼고 맞은 글자만
  const done = R.composing ? [...v].slice(0, -1).join("") : v;
  const T = [...target()];
  [...done].forEach((ch, i) => { if (T[i] === ch) s += keysOf(ch).length; });
  const ms = Math.max(1000, now() - R.t0);
  $("#liveCpm").textContent = String(Math.round((s * 60000) / ms));
}
function onInput(e) {
  if (!R || $("#play").hidden) return;
  const v = $("#typeIn").value;
  if (R.t0 == null && v) R.t0 = now();
  R.composing = !!(e && e.isComposing) || R.composing;
  renderLine();
  liveCpm();
  if (!R.composing && [...v].length >= [...target()].length) submit();
}
function submit() {
  if (!R || R.composing || R.i >= PER) return;
  const inp = $("#typeIn"), v = inp.value;
  if (!v && R.t0 == null) return; // 아무것도 안 쳤는데 넘기지 않음
  R.pendingEnter = false;
  R.lines.push({ target: target(), typed: v });
  // 다 친 문장은 종이 위쪽으로 올라가며 틀린 글자는 빨간 잉크로 남는다
  const g = gradeLine(target(), v);
  const bad = new Set(g.bad);
  const row = document.createElement("p");
  row.className = "done";
  row.innerHTML = [...v].map((ch, i) => `<span class="${bad.has(i) ? "c2" : "c1"}">${ch === " " ? "&nbsp;" : esc(ch)}</span>`).join("") || "&nbsp;";
  $("#doneLines").append(row);
  inp.value = "";
  R.i++;
  haptic?.(8);
  if (R.i >= PER) return finish();
  const p = $("#paper"); p.classList.remove("is-return"); void p.offsetWidth; p.classList.add("is-return");
  renderLine();
}

/* ---------- 결과 ---------- */
function odometer(el, n) {
  const ds = String(n).split("");
  el.dataset.v = String(n);
  $("#cpmText").textContent = `${n}타`;
  const roll = el.querySelector(".odo__roll");
  roll.innerHTML = ds.map((d, i) => `<span class="odo__col" data-d="${d}" style="--k:${i}"><span class="odo__strip">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((x) => `<b>${x}</b>`).join("")}</span></span>`).join("");
  const cols = [...roll.querySelectorAll(".odo__col")];
  const go = () => cols.forEach((c) => (c.querySelector(".odo__strip").style.transform = `translateY(${-Number(c.dataset.d)}em)`));
  if (RM) go(); else requestAnimationFrame(() => requestAnimationFrame(go));
}
function finish() {
  clearInterval(ticker);
  const ms = now() - R.t0;
  const r = result(R.lines, ms);
  const h = addHistory(r, R.k);
  R.r = r;
  $("#endMode").textContent = R.label;
  $("#endTime").textContent = `${(r.ms / 1000).toFixed(1)}초`;
  odometer($("#cpm"), r.cpm);
  const acc = $("#acc"); acc.dataset.v = String(r.acc); acc.textContent = `${r.acc.toFixed(1)}%`;
  const worstText = r.worst ? `${keyName(r.worst.k)} (${r.worst.n}번)` : "없음";
  $("#worst").textContent = worstText;
  $("#worst").dataset.k = r.worst ? r.worst.k : "";
  let cmp = "첫 기록이에요";
  if (h.prev) {
    const d = r.cpm - h.prev.cpm;
    cmp = `직전 ${h.prev.cpm}타보다 ${d === 0 ? "같아요" : d > 0 ? `${d}타 빨라요` : `${-d}타 느려요`}`;
    cmp += r.cpm > h.best ? ` · 최고 기록 새로 씀` : ` · 최고 ${h.best}타`;
  }
  $("#cmp").textContent = cmp;
  const vs = $("#vs");
  if (friend && friend.k === R.k) {
    const d = r.cpm - friend.t, who = friend.by || "친구";
    vs.hidden = false;
    vs.textContent = `${who} ${friend.t}타 · 나 ${r.cpm}타 → ${d === 0 ? "똑같아요" : d > 0 ? `${d}타 앞섰어요` : `${-d}타 뒤졌어요`}`;
  } else vs.hidden = true;
  $("#kbHeat").innerHTML = kbHTML(r.keys);
  $("#shareText").textContent = shareText(R.label, r, worstText);
  $("#byName").value = store.get("name", "");
  const sh = $("#sheet"); sh.classList.remove("is-fresh"); void sh.offsetWidth; if (!RM) sh.classList.add("is-fresh");
  show("end");
}

/* ---------- 첫 화면 견본: 종이에 글자가 한 자씩 찍히고 글쇠가 눌림 ---------- */
function demo() {
  $("#heroKeys").innerHTML = kbHTML();
  const line = $("#heroLine");
  const pool = pickSet(dailyK());
  if (RM) { line.textContent = pool[0]; return; }
  let s = 0, i = 0;
  setInterval(() => {
    const t = [...pool[s % pool.length]];
    if (i < t.length) {
      line.textContent = t.slice(0, i + 1).join("");
      const caps = new Set(keysOf(t[i]).map(keyCap));
      document.querySelectorAll("#heroKeys .key").forEach((k) => k.classList.toggle("is-hit", caps.has(k.dataset.cap)));
      i++;
    } else if (i++ > t.length + 6) { s++; i = 0; line.textContent = ""; }
  }, 140);
}

function init() {
  if (RM) document.documentElement.classList.add("rm");
  demo();
  $("#kbLive").innerHTML = kbHTML();
  $("#dailyNo").textContent = `#${DAY}`;
  const d = store.get(`day:${dailyK()}`, null), n = history().length;
  $("#rec").textContent = `${d ? `오늘의 문장 최고 ${d.cpm}타 · ` : ""}${n ? `지금까지 ${n}판` : "아직 기록 없음"}`;
  const k = parseK(getParam("k"));
  if (getParam("k") != null) {
    const t = parseCpm(getParam("t"));
    const by = String(getParam("by") || "").slice(0, 10);
    if (k != null && t != null) {
      friend = { k, t, by };
      const c = $("#chal"); c.hidden = false;
      c.innerHTML = `<b>${esc(by ? `${by}의 도전장` : "친구의 도전장")}</b><span>같은 문장 다섯 개 · ${t}타를 넘겨 봐요.</span><button class="tw-go" id="playFriend" type="button"><span class="tw-go__k">도전</span><span>같은 문장 치기</span></button>`;
      $("#playFriend").addEventListener("click", () => start(k, by ? `${by}의 도전장` : "친구의 도전장"));
    } else toast("링크가 깨졌어요. 친구에게 다시 받아 보세요");
  }
  $("#playDaily").addEventListener("click", () => start(dailyK(), `오늘의 문장 #${DAY}`));
  $("#playRandom").addEventListener("click", () => start(randomK(), "연습"));
  $("#newSet").addEventListener("click", () => start(randomK(), "연습"));
  $("#again").addEventListener("click", () => start(R.k, R.label));

  const inp = $("#typeIn");
  inp.addEventListener("compositionstart", () => { if (R) R.composing = true; });
  inp.addEventListener("compositionend", () => {
    if (!R) return;
    R.composing = false;
    if (R.pendingEnter) return submit();
    onInput(null);
  });
  inp.addEventListener("input", onInput);
  inp.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.keyCode !== 13) return;
    e.preventDefault();
    if (e.isComposing || R?.composing) { if (R) R.pendingEnter = true; return; }
    submit();
  });
  // 휴대폰: '다음' 단추를 누르면 보통 입력 칸에서 손이 떨어지며 조합이 먼저 끝난다(compositionend → 그 뒤 click).
  // 그래도 조합 중이면 입력 칸을 잠깐 놓아 조합을 끝내게 하고, 끝나는 즉시 낸다. 끝 신호가 안 오는 키보드면 잠시 뒤 직접 낸다
  $("#nextBtn").addEventListener("click", () => {
    if (!R) return;
    if (!R.composing) { submit(); inp.focus(); return; }
    R.pendingEnter = true;
    inp.blur();
    setTimeout(() => { if (R.pendingEnter) { R.composing = false; submit(); } inp.focus(); }, 80);
  });
  $("#paper").addEventListener("click", () => inp.focus());

  $("#dareBtn").addEventListener("click", async () => {
    if (!R?.r) return;
    const by = $("#byName").value.trim().slice(0, 10);
    store.set("name", by);
    const url = `${ROOT_URL}typing/?k=${R.k}&t=${R.r.cpm}${by ? `&by=${encodeURIComponent(by)}` : ""}`;
    const r = await share({ title: "타자 속도 도전장", text: `${by || "친구"}가 ${R.r.cpm}타를 쳤어요. 같은 문장 다섯 개, 넘길 수 있어? ⌨`, url });
    if (r === "shared") toast("보냈어요");
  });
  renderMoreSites($("#more"), "typing");
}
if (typeof document !== "undefined" && document.getElementById("typeIn")) init();

