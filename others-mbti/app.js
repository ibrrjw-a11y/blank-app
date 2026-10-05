import {
  $,
  $$,
  createStore,
  toast,
  haptic,
  share,
  shareImage,
  copyText,
  encodeState,
  decodeState,
  urlWith,
  getParam,
  hashString,
  runIntro,
  showView,
  renderMoreSites,
  renderCrumb,
  createCanvas,

  wrapText,
  CANVAS_FONT,
  countUp,
  prefersReducedMotion,
  sleep,
} from "../shared/kit.js";
import { AXES, TYPE_ORDER, FRIEND_QS, SELF_QS, TYPES, SURPRISE, COMPAT, GAP_TIERS } from "./data.js";

const SLUG = "others-mbti";
const UNLOCK = 3;
const store = createStore(SLUG);
const BASE = location.origin + location.pathname;
const TYPE_RE = /^[EI][SN][TF][JP]$/;

/* ---------- 작은 도우미 ---------- */
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const clean = (s, max) =>
  String(s ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
const nowSec = () => Math.floor(Date.now() / 1000);

// 받침 유무 (한글이 아니면 null → "은(는)" 형태로)
function batchim(word) {
  const ch = String(word).trim().slice(-1);
  const c = ch.charCodeAt(0);
  if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28 !== 0;
  if (/[0-9]/.test(ch)) return "013678".includes(ch);
  return null;
}
function josa(word, pair) {
  const [a, b] = pair.split("/");
  const has = batchim(word);
  if (has == null) return `${a}(${b})`;
  return has ? a : b;
}
const PARTICLE = { 은: "은/는", 이: "이/가", 을: "을/를", 과: "과/와" };
function fill(tpl, name) {
  return tpl.replace(/\{N(은|이|을|과|의|에게)?\}/g, (_, p) => {
    if (!p) return name;
    if (p === "의" || p === "에게") return name + p;
    return name + josa(name, PARTICLE[p]);
  });
}
const N = (name, p) => fill(`{N${p || ""}}`, name);

function newId() {
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => (b % 36).toString(36)).join("") + Date.now().toString(36).slice(-3);
}

const respHash = (from, answers) => hashString(`${from}|${answers}`).toString(36);

function validAnswers(a) {
  return (
    typeof a === "string" &&
    a.length === FRIEND_QS.length &&
    [...a].every((ch, i) => {
      const ax = AXES[FRIEND_QS[i].axis];
      return ch === ax.a || ch === ax.b;
    })
  );
}

// 답 12개 → 유형 (축마다 3문항 중 다수)
function typeFromAnswers(a, qs = FRIEND_QS) {
  return AXES.map((ax, k) => {
    let ca = 0;
    let cb = 0;
    [...a].forEach((ch, i) => {
      if (qs[i].axis !== k) return;
      if (ch === ax.a) ca++;
      else if (ch === ax.b) cb++;
    });
    return ca >= cb ? ax.a : ax.b;
  }).join("");
}

function fmtDate(sec) {
  const d = new Date(sec * 1000);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/* ---------- 저장소 ---------- */
const getOwners = () => store.get("owners", {}) || {};
function saveOwner(o) {
  const all = getOwners();
  all[o.id] = o;
  store.set("owners", all);
}
function getMe() {
  const id = store.get("me");
  const all = getOwners();
  return id && all[id] ? all[id] : null;
}
const getSent = () => store.get("sent", []) || [];

function mergeInto(owner, list) {
  let added = 0;
  const seen = new Set(owner.responses.map((r) => r.h));
  list.forEach((r) => {
    const h = respHash(r.f, r.a);
    if (seen.has(h)) return;
    seen.add(h);
    owner.responses.push({ f: r.f, a: r.a, m: r.m || "", t: r.t || nowSec(), h });
    added++;
  });
  owner.responses.sort((x, y) => x.t - y.t);
  return added;
}

/* ---------- 링크 ---------- */
const ownerLink = (o) => urlWith({ q: encodeState({ i: o.id, n: o.name, s: o.self }) }, BASE);
const keepLink = (o) =>
  urlWith(
    {
      k: encodeState({
        i: o.id,
        n: o.name,
        s: o.self,
        c: o.created,
        r: o.responses.map((r) => [r.f, r.a, r.m, r.t]),
      }),
    },
    BASE
  );

function shareOwnerLink(o) {
  haptic();
  return share({
    title: "남이 정해주는 MBTI",
    text: `내가 어떤 사람인지 12문항만 답해줘 🙏 친구들 눈에 비친 내 MBTI가 궁금해!`,
    url: ownerLink(o),
  });
}

/* ---------- 분석 ---------- */
function analyze(o) {
  const n = o.responses.length;
  const count = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };
  o.responses.forEach((r) => [...r.a].forEach((ch) => count[ch]++));
  const axes = AXES.map((ax, k) => {
    const ca = count[ax.a];
    const cb = count[ax.b];
    const tot = ca + cb;
    const pa = tot ? Math.round((ca / tot) * 100) : 50;
    const pb = 100 - pa;
    const selfL = o.self ? o.self[k] : null;
    const tie = ca === cb;
    const letter = tie ? selfL || ax.a : ca > cb ? ax.a : ax.b;
    const opp = selfL ? (selfL === ax.a ? pb : pa) : 0;
    return { ...ax, k, ca, cb, pa, pb, letter, tie, selfL, opp };
  });
  const type = axes.map((x) => x.letter).join("");
  const gap = o.self ? Math.round(axes.reduce((s, x) => s + x.opp, 0) / axes.length) : 0;
  const guesses = o.responses.map((r) => typeFromAnswers(r.a));
  const freq = {};
  guesses.forEach((g) => (freq[g] = (freq[g] || 0) + 1));
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0] || null;
  const notes = o.responses.filter((r) => r.m);
  const best = notes.sort((a, b) => b.m.length - a.m.length)[0] || null;
  return { n, axes, type, gap, guesses, top, best };
}
const gapTier = (g) => GAP_TIERS.find((t) => g >= t.min);

/* ---------- 공통 UI 조각 ---------- */
const tiles = (type, cls = "") =>
  `<div class="flaps ${cls}">${[...type].map((l) => `<span class="flap">${esc(l)}</span>`).join("")}</div>`;

async function flipTile(el, to, { spins = 2, signal, onSwap } = {}) {
  if (prefersReducedMotion()) {
    onSwap?.();
    el.textContent = to;
    return;
  }
  const pool = "EISNTFJP";
  for (let s = 0; s <= spins; s++) {
    if (signal?.aborted) return;
    const letter = s === spins ? to : pool[Math.floor(Math.random() * pool.length)];
    el.classList.remove("is-flip");
    void el.offsetWidth;
    el.classList.add("is-flip");
    await sleep(140);
    if (signal?.aborted) return;
    if (s === 0) onSwap?.();
    el.textContent = letter;
    await sleep(150);
  }
}

function flipAll(root, type, { from, stagger = 220, signal } = {}) {
  const els = $$(".flap", root);
  return Promise.all(
    els.map(async (el, i) => {
      await sleep(i * stagger);
      if (signal?.aborted) return;
      await flipTile(el, type[i], { spins: 2, signal });
      if (from && from[i] !== type[i]) el.classList.add("is-changed");
    })
  );
}

function renderTypeGrid(el, selected, onPick, { label } = {}) {
  el.innerHTML = TYPE_ORDER.map(
    (t) => `<button type="button" class="type-cell" data-type="${t}" aria-pressed="${t === selected}">
      <span class="type-cell__code">${t}</span><span class="type-cell__name">${TYPES[t].short}</span>
    </button>`
  ).join("");
  if (label) el.setAttribute("aria-label", label);
  $$(".type-cell", el).forEach((b) =>
    b.addEventListener("click", () => {
      haptic(8);
      $$(".type-cell", el).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      onPick(b.dataset.type);
    })
  );
}

/* ---------- 인트로 (진·콜라주 보드) ---------- */
let intro = null;
const BOARD_W = 360;
const BOARD_H = 470;
const FRIENDS = [
  { n: "지수", x: 272, y: 14, r: -8, c: "kraft" },
  { n: "현우", x: 288, y: 148, r: 7, c: "white" },
  { n: "수아", x: 252, y: 268, r: -5, c: "accent" },
];
// 친구 → 사진으로 날아가는 손글씨 화살표 (끝점, 끝 방향)
const ARROWS = [
  { d: "M284 66 C 270 94, 244 78, 214 104", ex: 214, ey: 104, dx: -30, dy: 26 },
  { d: "M288 184 C 266 204, 246 158, 220 176", ex: 220, ey: 176, dx: -26, dy: 18 },
  { d: "M256 300 C 234 306, 222 284, 206 252", ex: 206, ey: 252, dx: -16, dy: -32 },
];
const NOTES = [
  { t: "분위기 메이커!", x: 112, y: 4, r: -5 },
  { t: "계획 0개 ㅋㅋ", x: 196, y: 220, r: 6 },
  { t: "완전 T임", x: 258, y: 336, r: -7 },
];

function arrowHead({ ex, ey, dx, dy }) {
  const a = Math.atan2(dy, dx);
  const len = 13;
  const p = (s) => `${(ex - len * Math.cos(a + s)).toFixed(1)} ${(ey - len * Math.sin(a + s)).toFixed(1)}`;
  return `M${p(0.5)} L${ex} ${ey} L${p(-0.5)}`;
}

function buildIntroStage(stage) {
  stage.innerHTML = `
    <div class="board" data-scene="0">
      <span class="board__ex">예시</span>
      <div class="photo">
        <span class="tape tape--l"></span><span class="tape tape--r"></span>
        <div class="photo__img">
          <svg class="photo__sil" viewBox="0 0 120 150" aria-hidden="true">
            <circle cx="60" cy="50" r="26" />
            <path d="M12 150c0-36 21-62 48-62s48 26 48 62z" />
          </svg>
        </div>
        <span class="photo__cap">나</span>
      </div>
      <div class="selftag">
        나: INFP
        <svg class="selftag__x" viewBox="0 0 120 40" preserveAspectRatio="none" aria-hidden="true">
          <path d="M4 26 C 30 10, 50 34, 72 16 S 104 28, 116 12" pathLength="1" />
        </svg>
      </div>
      <svg class="arrows" viewBox="0 0 ${BOARD_W} ${BOARD_H}" aria-hidden="true">
        ${ARROWS.map(
          (a, i) => `<g style="--i:${i}"><path d="${a.d}" pathLength="1" /><path class="head" d="${arrowHead(a)}" pathLength="1" /></g>`
        ).join("")}
      </svg>
      ${FRIENDS.map(
        (f, i) =>
          `<span class="pal pal--${f.c}" style="left:${f.x}px;top:${f.y}px;--r:${f.r}deg;--i:${i}">${f.n}</span>`
      ).join("")}
      ${NOTES.map(
        (nt, i) => `<span class="scrawl" style="left:${nt.x}px;top:${nt.y}px;--r:${nt.r}deg;--i:${i}">${nt.t}</span>`
      ).join("")}
      <div class="board__letters">${tiles("INFP", "flaps--board")}</div>
      <div class="ticket">
        <span class="ticket__label">반전 지수</span>
        <span class="odo t-num" aria-hidden="true">
          <span class="odo__col"><span class="odo__strip">${"0123456789"
            .split("")
            .map((d) => `<i>${d}</i>`)
            .join("")}</span></span><span class="odo__col"><span class="odo__strip">${"0123456789"
            .split("")
            .map((d) => `<i>${d}</i>`)
            .join("")}</span></span><span class="odo__pct">%</span>
        </span>
        <span class="stamp">대반전</span>
      </div>
    </div>`;
}

function fitBoard(stage) {
  const board = $(".board", stage);
  if (!board) return;
  const s = Math.min(1.12, stage.clientWidth / BOARD_W, stage.clientHeight / BOARD_H);
  board.style.setProperty("--fit", s.toFixed(3));
}

// 제목만 글자 단위로 튀어 오르게 (본문은 고정)
function kinetic(root) {
  const h = $(".intro__caption h2", root);
  if (!h) return;
  let i = 0;
  h.innerHTML = h.textContent
    .split(" ")
    .map(
      (w) =>
        `<span class="kw">${[...w].map((c) => `<span class="kc" style="--i:${i++}">${esc(c)}</span>`).join("")}</span>`
    )
    .join(" ");
}

function setOdo(board, value) {
  const digits = String(value).padStart(2, "0").slice(-2);
  $$(".odo__strip", board).forEach((s, i) => s.style.setProperty("--d", digits[i]));
}

function startIntro() {
  const root = $("#intro");
  const stage = $(".intro__stage", root);
  buildIntroStage(stage);
  fitBoard(stage);
  const board = $(".board", stage);
  const letters = $(".board__letters", board);
  const enter = (scene) => {
    board.dataset.scene = scene;
  };
  const scenes = [
    {
      title: "나는 내가 INFP인 줄 알았어요",
      desc: "먼저 내가 생각하는 내 MBTI를 골라요.",
      duration: 2900,
      play() {
        board.dataset.scene = "0";
        void board.offsetWidth; // 애니메이션 처음부터 다시
        $$(".flap", letters).forEach((f, i) => {
          f.textContent = "INFP"[i];
          f.classList.add("is-plain");
          f.classList.remove("is-flip");
        });
        setOdo(board, 0);
        enter("1");
        kinetic(root);
      },
    },
    {
      title: "친구들이 나에 대해 답해요",
      desc: "단톡방에 링크를 보내면 친구들이 12문항으로 나를 골라줘요.",
      duration: 3600,
      play() {
        enter("2");
        kinetic(root);
      },
    },
    {
      title: "친구들 눈엔 ESTP",
      desc: "3명이 답하면 남이 보는 내 MBTI가 열려요.",
      duration: 4000,
      play(_, signal) {
        enter("3");
        kinetic(root);
        sleep(prefersReducedMotion() ? 0 : 760).then(async () => {
          const els = $$(".flap", letters);
          await Promise.all(
            els.map(async (el, i) => {
              await sleep(i * 300);
              if (signal.aborted) return;
              await flipTile(el, "ESTP"[i], { spins: 2, signal, onSwap: () => el.classList.remove("is-plain") });
            })
          );
        });
      },
    },
    {
      title: "반전 지수 75%",
      desc: "내가 보는 나와 남이 보는 나, 얼마나 다를까요?",
      duration: 3800,
      play(_, signal) {
        $$(".flap", letters).forEach((f, i) => {
          f.textContent = "ESTP"[i];
          f.classList.remove("is-plain");
        });
        enter("4");
        kinetic(root);
        sleep(prefersReducedMotion() ? 0 : 420).then(() => !signal.aborted && setOdo(board, 75));
      },
    },
  ];
  intro?.stop();
  intro = runIntro({ root, scenes, loop: true });
}

window.addEventListener("resize", () => {
  const stage = $("#intro .intro__stage");
  if (stage && intro) fitBoard(stage);
});

function stopIntro() {
  intro?.stop();
  intro = null;
}

function goIntro({ push = false } = {}) {
  if (push) history.pushState(null, "", BASE);
  const me = getMe();
  const mine = $("#introMine");
  const badge = $("#introBadge");
  if (me) {
    const n = me.responses.length;
    const fresh = n - (me.seen || 0);
    mine.hidden = false;
    mine.textContent = n ? `내 결과 보기 · 응답 ${n}개` : "내 결과 보기";
    badge.hidden = fresh <= 0;
    badge.textContent = `새 응답 ${fresh}개 도착`;
    $("#startLabel").textContent = "내 링크 다시 보내기";
  } else {
    mine.hidden = true;
    badge.hidden = true;
    $("#startLabel").textContent = "내 링크 만들기";
  }
  showView("intro");
  startIntro();
}

/* ---------- 주인: 설정 ---------- */
const setup = { self: null };

function goSetup({ push = true } = {}) {
  stopIntro();
  if (push) history.pushState({ v: "setup" }, "", BASE);
  showView("setup");
  renderTypeGrid($("#selfGrid"), setup.self, (t) => {
    setup.self = t;
    $("#selfHelp").textContent = `${t} · ${TYPES[t].nick}. 친구들 결과와 비교할 기준이에요.`;
    validateSetup();
  });
  validateSetup();
}

function validateSetup() {
  const name = clean($("#ownerName").value, 10);
  $("#createBtn").disabled = !(name && setup.self);
}

function createOwner() {
  const name = clean($("#ownerName").value, 10);
  if (!name) {
    $("#nameField").classList.add("is-error");
    $("#ownerName").focus();
    return;
  }
  if (!setup.self) {
    toast("내가 생각하는 내 MBTI를 골라 주세요");
    return;
  }
  const o = { id: newId(), name, self: setup.self, created: nowSec(), responses: [], seen: 0 };
  saveOwner(o);
  store.set("me", o.id);
  haptic([10, 40, 10]);
  history.replaceState({ v: "me" }, "", BASE);
  openDashboard(o, { created: true });
}

/* ---------- 퀴즈 (셀프 / 친구 공용) ---------- */
const quiz = { qs: [], idx: 0, answers: [], name: null, onDone: null, onExit: null };

function startQuiz({ qs, name, head, onDone, onExit }) {
  stopIntro();
  Object.assign(quiz, { qs, idx: 0, answers: [], name, onDone, onExit });
  $("#quizHead").innerHTML = head;
  showView("quiz");
  renderQuestion();
}

function renderQuestion(dir = 1) {
  const q = quiz.qs[quiz.idx];
  const total = quiz.qs.length;
  const text = quiz.name ? fill(q.q, quiz.name) : q.q;
  $("#quizCount").textContent = `${quiz.idx + 1}/${total}`;
  $("#quizBar").style.width = `${((quiz.idx + 1) / total) * 100}%`;
  const card = $("#quizCard");
  card.innerHTML = `
    <div class="quiz-q ${dir > 0 ? "in-next" : "in-prev"}">
      <span class="badge">${AXES[q.axis].name}</span>
      <h2 class="t-title-03">${esc(text)}</h2>
      <div class="stack gap-12">
        ${q.opts
          .map(
            (o, i) => `<button type="button" class="option" data-v="${o.v}" aria-pressed="${quiz.answers[quiz.idx] === o.v}">
              <span class="option__key">${i === 0 ? "A" : "B"}</span><span class="option__text">${esc(o.t)}</span></button>`
          )
          .join("")}
      </div>
    </div>`;
  $$(".option", card).forEach((b) =>
    b.addEventListener("click", async () => {
      if (card.dataset.busy) return;
      card.dataset.busy = "1";
      haptic(8);
      $$(".option", card).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      quiz.answers[quiz.idx] = b.dataset.v;
      await sleep(prefersReducedMotion() ? 0 : 220);
      delete card.dataset.busy;
      if (quiz.idx < total - 1) {
        quiz.idx++;
        renderQuestion(1);
      } else {
        quiz.onDone(quiz.answers.join(""));
      }
    })
  );
}

function quizBack() {
  if (quiz.idx > 0) {
    quiz.idx--;
    renderQuestion(-1);
  } else {
    quiz.onExit?.();
  }
}

function startSelfTest() {
  startQuiz({
    qs: SELF_QS,
    name: null,
    head: `<p class="t-label-02 t-primary">셀프 테스트</p><h1 class="t-title-02">나는 어떤 사람일까요?</h1>
      <p class="t-body-03 t-secondary">평소의 나와 더 가까운 쪽을 골라 주세요.</p>`,
    onDone(a) {
      const t = typeFromAnswers(a, SELF_QS);
      setup.self = t;
      showView("setup");
      renderTypeGrid($("#selfGrid"), t, (x) => {
        setup.self = x;
        $("#selfHelp").textContent = `${x} · ${TYPES[x].nick}. 친구들 결과와 비교할 기준이에요.`;
        validateSetup();
      });
      $("#selfHelp").textContent = `셀프 테스트 결과 ${t} · ${TYPES[t].nick}. 다르다고 느끼면 직접 바꿔도 돼요.`;
      validateSetup();
      toast(`셀프 테스트 결과는 ${t}예요`);
    },
    onExit() {
      showView("setup");
    },
  });
}

/* ---------- 친구: 답하기 ---------- */
let asking = null; // { i, n, s }

function startAsk(raw) {
  const p = decodeState(raw);
  if (!p || typeof p.i !== "string" || !p.i) {
    toast("링크가 잘못됐어요. 새 링크를 받아 주세요");
    history.replaceState(null, "", BASE);
    return goIntro();
  }
  const owner = { i: clean(p.i, 16), n: clean(p.n, 10) || "친구", s: TYPE_RE.test(p.s) ? p.s : "" };
  const all = getOwners();
  if (all[owner.i]) {
    store.set("me", owner.i);
    openDashboard(all[owner.i]);
    toast("내 링크예요! 친구들에게 보내 주세요");
    return;
  }
  asking = owner;
  const prev = getSent()
    .filter((s) => s.i === owner.i)
    .pop();
  if (prev) {
    renderGuess({ owner, answers: prev.a, from: prev.f, note: prev.m, url: prev.url, again: true });
    return;
  }
  askQuiz();
}

function askQuiz() {
  const name = asking.n;
  startQuiz({
    qs: FRIEND_QS,
    name,
    head: `<div class="row gap-12 ask-head">
        <span class="ask-head__q" aria-hidden="true">?</span>
        <div class="grow">
          <h1 class="t-title-03">${esc(N(name, "은"))} 어떤 사람일까요?</h1>
          <p class="t-body-03 t-secondary">정답은 없어요. 평소의 ${esc(N(name, "을"))} 떠올리며 골라 주세요.</p>
        </div>
      </div>`,
    onDone(a) {
      quiz.done = a;
      $("#noteLabel").textContent = `${N(name, "에게")} 한마디 (선택)`;
      showView("note");
      $("#fromName").value = store.get("myNick", "") || "";
      updateNoteCount();
    },
    onExit() {
      if (confirm("답하기를 그만둘까요?")) {
        history.replaceState(null, "", BASE);
        goIntro();
      }
    },
  });
}

function updateNoteCount() {
  $("#noteCount").textContent = `${$("#noteText").value.length}/40`;
}

function submitNote() {
  const answers = quiz.done;
  if (!validAnswers(answers) || !asking) return;
  const fromRaw = clean($("#fromName").value, 10);
  if (fromRaw) store.set("myNick", fromRaw);
  const from = fromRaw || "익명 친구";
  const note = clean($("#noteText").value, 40);
  const payload = { i: asking.i, n: asking.n, s: asking.s, f: from, a: answers, m: note, t: nowSec() };
  const url = urlWith({ r: encodeState(payload) }, BASE);
  const sent = getSent().filter((s) => s.i !== asking.i);
  sent.push({ i: asking.i, n: asking.n, h: respHash(from, answers), url, a: answers, f: from, m: note, t: payload.t });
  store.set("sent", sent.slice(-30));
  haptic([10, 40, 10]);
  renderGuess({ owner: asking, answers, from, note, url, fresh: true });
}

function renderGuess({ owner, answers, from, note, url, again = false, fresh = false }) {
  stopIntro();
  const name = owner.n;
  const t = typeFromAnswers(answers);
  const info = TYPES[t];
  const view = $('[data-view="guess"]');
  const lean = AXES.map((ax, k) => {
    let ca = 0;
    [...answers].forEach((ch, i) => FRIEND_QS[i].axis === k && ch === ax.a && ca++);
    return { ax, ca, cb: 3 - ca };
  });
  view.innerHTML = `
    <div class="viewbar row gap-8">
      <span class="t-label-02 t-secondary grow">${esc(from)}님이 본 ${esc(name)}</span>
      ${again ? `<span class="badge">이미 답했어요</span>` : ""}
    </div>
    <div class="stack gap-16">
      <div class="card card--raised guess-hero">
        <p class="t-label-02 t-primary">내 눈에 비친 ${esc(N(name, "은"))}</p>
        ${tiles(fresh ? "????" : t, "flaps--lg")}
        <p class="nick">${esc(info.nick)}</p>
        <ul class="trait-list">${info.traits.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        <div class="lean">
          ${lean
            .map(
              ({ ax, ca, cb }) => `<div class="lean__row">
                <span class="${ca >= cb ? "is-win" : ""}">${ax.a}</span>
                <span class="lean__dots">${`<i class="${ca >= cb ? "on" : ""}"></i>`.repeat(ca)}${`<i class="${cb > ca ? "on" : ""}"></i>`.repeat(cb)}</span>
                <span class="${cb > ca ? "is-win" : ""}">${ax.b}</span></div>`
            )
            .join("")}
        </div>
        ${note ? `<p class="quote">“${esc(note)}”</p>` : ""}
      </div>

      <div class="card send-card">
        <h2 class="t-title-04">${esc(N(name, "에게"))} 결과 보내기</h2>
        <p class="t-body-03 t-secondary">이 답장 링크를 ${esc(N(name, "이"))} 열어야 결과에 들어가요. 친구 ${UNLOCK}명이 모이면 ${esc(N(name, "의"))} '남이 보는 MBTI'가 열려요.</p>
        <button class="btn btn--primary btn--lg btn--block" id="sendReply">${esc(N(name, "에게"))} 결과 보내기</button>
        <button class="btn btn--outline btn--block" id="copyReply">답장 링크 복사</button>
      </div>

      <div class="card cta-card">
        <p class="t-label-02 t-primary">이번엔 내 차례</p>
        <h2 class="t-title-03">나는 친구들 눈에 어떤 사람일까?</h2>
        <p class="t-body-03 t-secondary">나도 링크를 만들어 단톡방에 보내 보세요. 1분이면 만들어요.</p>
        <button class="btn btn--primary btn--lg btn--block" id="meToo">나도 친구들한테 받아보기</button>
      </div>
      ${again ? `<button class="btn btn--ghost btn--block" id="reAnswer">다시 답하기</button>` : ""}
    </div>`;
  showView("guess");
  if (fresh) flipAll($(".guess-hero", view), t, { stagger: 180 });
  $("#sendReply").onclick = () => {
    haptic();
    share({ title: "남이 정해주는 MBTI", text: `${name}! 내가 보는 너는 ${t}야 👀 링크 눌러서 결과에 넣어줘`, url });
  };
  $("#copyReply").onclick = async () => toast((await copyText(url)) ? "답장 링크를 복사했어요" : "복사에 실패했어요");
  $("#meToo").onclick = () => {
    history.replaceState(null, "", BASE);
    goSetup({ push: false });
  };
  const re = $("#reAnswer");
  if (re) re.onclick = () => askQuiz();
}

/* ---------- 주인: 답장/보관 링크 열기 ---------- */
function handleReply(raw) {
  const p = decodeState(raw);
  if (!p || typeof p.i !== "string" || !validAnswers(p.a)) {
    toast("답장 링크가 잘못됐어요");
    history.replaceState(null, "", BASE);
    return goIntro();
  }
  const from = clean(p.f, 10) || "익명 친구";
  const note = clean(p.m, 40);
  const ownerName = clean(p.n, 10) || "친구";
  const h = respHash(from, p.a);
  const mine = getSent().find((s) => s.h === h);
  if (mine) {
    // 친구가 자기 답장 링크를 눌렀을 때: 합치지 않고 안내
    asking = { i: clean(p.i, 16), n: ownerName, s: TYPE_RE.test(p.s) ? p.s : "" };
    renderGuess({ owner: asking, answers: p.a, from, note, url: mine.url, again: true });
    toast(`이 링크는 ${N(ownerName, "에게")} 보내야 반영돼요`);
    return;
  }
  const all = getOwners();
  const id = clean(p.i, 16);
  let o = all[id];
  let fresh = false;
  if (!o) {
    o = { id, name: ownerName, self: TYPE_RE.test(p.s) ? p.s : null, created: nowSec(), responses: [], seen: 0 };
    fresh = true;
  }
  const t = Number(p.t);
  const added = mergeInto(o, [{ f: from, a: p.a, m: note, t: Number.isFinite(t) && t > 0 ? t : nowSec() }]);
  saveOwner(o);
  store.set("me", o.id);
  history.replaceState({ v: "me" }, "", BASE);
  openDashboard(o, { fresh, added, dup: !added, via: "reply", from });
}

function handleKeep(raw) {
  const p = decodeState(raw);
  if (!p || typeof p.i !== "string" || !Array.isArray(p.r)) {
    toast("보관 링크가 잘못됐어요");
    history.replaceState(null, "", BASE);
    return goIntro();
  }
  const list = p.r
    .filter((x) => Array.isArray(x) && validAnswers(x[1]))
    .slice(0, 200)
    .map((x) => ({ f: clean(x[0], 10) || "익명 친구", a: x[1], m: clean(x[2], 40), t: Number(x[3]) || nowSec() }));
  const all = getOwners();
  const id = clean(p.i, 16);
  let o = all[id];
  let fresh = false;
  if (!o) {
    o = {
      id,
      name: clean(p.n, 10) || "나",
      self: TYPE_RE.test(p.s) ? p.s : null,
      created: Number(p.c) || nowSec(),
      responses: [],
      seen: 0,
    };
    fresh = true;
  } else if (!o.self && TYPE_RE.test(p.s)) {
    o.self = p.s;
  }
  const added = mergeInto(o, list);
  if (fresh) o.seen = o.responses.length;
  saveOwner(o);
  store.set("me", o.id);
  history.replaceState({ v: "me" }, "", BASE);
  openDashboard(o, { via: "keep", added, fresh, quiet: fresh });
}

/* ---------- 주인: 대시보드 ---------- */
let dash = null; // { id, baseline, compat, flags }

function openDashboard(o, flags = {}) {
  stopIntro();
  const baseline = flags.quiet ? o.responses.length : flags.added ? o.responses.length - flags.added : o.seen || 0;
  dash = { id: o.id, baseline: Math.min(baseline, o.responses.length), compat: dash?.id === o.id ? dash.compat : null, flags };
  showView("me");
  renderMe(true);
  // 지금 본 것까지는 읽음 처리 (이 탭의 배지는 baseline 기준으로 유지)
  o.seen = o.responses.length;
  saveOwner(o);
  if (flags.via === "reply") {
    if (flags.dup) toast(`${flags.from}님의 응답은 이미 들어와 있어요`);
    else toast(`${flags.from}님의 응답이 도착했어요`);
  } else if (flags.created) {
    toast("내 링크를 만들었어요! 단톡방에 보내 주세요");
  } else if (flags.via === "keep") {
    toast(flags.added ? `응답 ${flags.added}개를 합쳤어요` : "이미 모두 들어와 있는 응답이에요");
  }
}

function renderMe(first = false) {
  const o = getOwners()[dash.id];
  if (!o) return goIntro();
  const an = analyze(o);
  const n = an.n;
  const unlocked = n >= UNLOCK;
  const newCount = Math.max(0, n - dash.baseline);
  const view = $('[data-view="me"]');
  const name = o.name;
  const othersInfo = TYPES[an.type];
  const selfInfo = o.self ? TYPES[o.self] : null;
  const tier = gapTier(an.gap);

  const progress = `
    <div class="card progress-card">
      <div class="row between gap-8">
        <span class="t-label-02 t-secondary">응답 현황</span>
        ${newCount > 0 ? `<span class="badge badge--pulse">새 응답 ${newCount}개 도착</span>` : ""}
      </div>
      <p class="t-title-02 t-num">${unlocked ? `친구 ${n}명이 답했어요` : `${UNLOCK}명 중 ${n}명 응답`}</p>
      <div class="seg" aria-hidden="true">${Array.from({ length: UNLOCK }, (_, i) => `<i class="${i < n ? "on" : ""}"></i>`).join("")}</div>
      <p class="t-body-03 t-secondary">${
        unlocked
          ? "응답이 들어올 때마다 결과가 바로 바뀌어요. 많이 받을수록 더 정확해져요."
          : `${UNLOCK - n}명 더 답하면 '남이 보는 ${esc(name)}'가 열려요.`
      }</p>
    </div>`;

  const linkCard = `
    <div class="card link-card">
      <h2 class="t-title-04">${unlocked ? "더 많은 친구에게 받기" : "내 링크를 단톡방에 보내 주세요"}</h2>
      <p class="t-body-03 t-secondary">친구가 12문항에 답하고 답장 링크를 보내 주면, 그 링크를 열 때 여기에 쌓여요.</p>
      <div class="link-box t-caption-01">${esc(ownerLink(o))}</div>
      <button class="btn btn--primary btn--lg btn--block" id="shareLink">단톡방에 내 링크 보내기</button>
      <button class="btn btn--outline btn--block" id="copyLink">링크 복사</button>
    </div>`;

  const locked = `
    <div class="card card--raised locked">
      <p class="t-label-02 t-secondary">친구들 눈에 비친 ${esc(name)}</p>
      ${tiles(n ? an.type : "MBTI", "flaps--lg is-blur")}
      <div class="locked__veil">
        <span class="locked__tape" aria-hidden="true">공개 전</span>
        <p class="t-body-02-strong">${UNLOCK - n}명 더 답하면 열려요</p>
        <p class="t-caption-01 t-secondary">${n ? `지금은 ${n}명뿐이라 한두 명 생각에 크게 흔들려요` : "친구가 답하면 여기에 하나씩 쌓여요"}</p>
      </div>
    </div>`;

  const surprise = (() => {
    if (!o.self) return "";
    const ax = [...an.axes].sort((a, b) => b.opp - a.opp)[0];
    let body;
    if (ax.opp > 50) {
      const other = ax.selfL === ax.a ? ax.b : ax.a;
      body = `<p class="t-body-02">${esc(SURPRISE[other])}</p>
        <p class="t-caption-01 t-secondary">${ax.name} · 친구들 답의 ${ax.opp}%가 ${other}(${other === ax.a ? ax.la : ax.lb}) 쪽이었어요</p>`;
    } else if (ax.opp === 50) {
      body = `<p class="t-body-02">'${ax.name}'에서 친구들 의견이 정확히 반반으로 갈렸어요. 보는 사람마다 다르게 느끼는 부분이에요.</p>`;
    } else if (ax.opp === 0) {
      body = `<p class="t-body-02">모든 문항에서 친구들이 내 생각과 같은 쪽을 골랐어요. 나를 정말 잘 아는 친구들이네요.</p>`;
    } else {
      body = `<p class="t-body-02">친구들도 대체로 내 생각에 동의해요. 그중 의견이 가장 갈린 건 '${ax.name}'이에요.</p>
        <p class="t-caption-01 t-secondary">반대쪽(${ax.selfL === ax.a ? ax.b : ax.a})을 고른 답이 ${ax.opp}%였어요</p>`;
    }
    return `<div class="card surprise"><p class="t-label-02 t-primary">가장 의외인 부분</p>${body}</div>`;
  })();

  const result = `
    <div class="card card--raised gap-card">
      <p class="t-body-02 t-secondary">${
        o.self
          ? `나는 <b class="t-text">${o.self}</b>라고 생각${o.self === an.type ? "하고, 친구들 눈에도" : "하지만, 친구들 눈엔"}`
          : "친구들 눈에 비친 나는"
      }</p>
      ${tiles(an.type, "flaps--lg")}
      <p class="nick">${esc(othersInfo.nick)}</p>
      ${an.top ? `<p class="t-caption-01 t-secondary">친구 ${n}명 중 ${an.top[1]}명이 각자 ${an.top[0]}로 봤어요</p>` : ""}
      ${
        o.self
          ? `<div class="gap-meter">
              <div class="row between"><span class="t-label-02">반전 지수</span><span class="t-title-02 t-primary t-num" id="gapNum">${an.gap}%</span></div>
              <div class="gap-meter__track"><i style="width:${an.gap}%"></i></div>
              <p class="t-body-03"><b>${tier.label}</b> · ${tier.desc}</p>
              <p class="t-caption-01 t-tertiary">친구 답 가운데 내 생각과 반대쪽을 고른 비율의 평균이에요.</p>
            </div>`
          : ""
      }
    </div>

    <div class="card vs-card">
      <div class="vs">
        <div class="vs__col">
          <span class="t-label-03 t-secondary">내가 보는 나</span>
          <b class="vs__type">${o.self || "?"}</b>
          <span class="t-caption-01 t-secondary">${selfInfo ? esc(selfInfo.nick) : "아직 안 골랐어요"}</span>
        </div>
        <span class="vs__arrow" aria-hidden="true">→</span>
        <div class="vs__col vs__col--others">
          <span class="t-label-03">남이 보는 나</span>
          <b class="vs__type">${an.type}</b>
          <span class="t-caption-01">${esc(othersInfo.nick)}</span>
        </div>
      </div>
      <div class="stack gap-16 axis-list">
        ${an.axes
          .map(
            (x) => `<div class="axis">
              <div class="row between"><span class="t-label-03 t-secondary">${x.name}</span>
                <span class="t-caption-01 t-tertiary">${x.selfL ? `내 생각 ${x.selfL}` : ""}${x.tie ? " · 반반" : ""}</span></div>
              <div class="axis__bar">
                <span class="axis__end ${x.letter === x.a ? "is-win" : ""}">${x.a} <span class="t-num">${x.pa}%</span></span>
                <div class="axis__track"><i class="axis__fill" style="width:${x.pa}%"></i></div>
                <span class="axis__end axis__end--r ${x.letter === x.b ? "is-win" : ""}"><span class="t-num">${x.pb}%</span> ${x.b}</span>
              </div>
            </div>`
          )
          .join("")}
      </div>
    </div>

    ${surprise}

    <div class="card type-card">
      <p class="t-label-02 t-primary">남이 보는 ${esc(name)} · ${an.type}</p>
      <h2 class="t-title-01">${esc(othersInfo.nick)}</h2>
      <ul class="trait-list trait-list--left">${othersInfo.traits.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      <p class="t-label-02">친구들이 이렇게 느껴요</p>
      <div class="stack gap-8">${othersInfo.feels.map((x) => `<p class="bubble">“${esc(x)}”</p>`).join("")}</div>
    </div>

    <button class="btn btn--primary btn--lg btn--block" id="shareCard">결과 카드 공유하기</button>`;

  const friends = n
    ? `<div class="stack gap-12">
        <h2 class="t-title-04">친구별 카드 <span class="t-secondary t-num">${n}</span></h2>
        <div class="friend-list">
          ${o.responses
            .slice()
            .reverse()
            .map((r) => {
              const g = typeFromAnswers(r.a);
              const match = o.self ? [...g].filter((c, i) => c === o.self[i]).length : null;
              return `<div class="card card--flat friend">
                <div class="row gap-12">
                  <span class="friend__avatar" aria-hidden="true">${esc([...r.f][0] || "?")}</span>
                  <div class="grow">
                    <p class="t-label-01">${esc(r.f)}</p>
                    <p class="t-caption-01 t-tertiary">${fmtDate(r.t)}</p>
                  </div>
                  <div class="friend__type ${unlocked ? "" : "is-blur"}">${unlocked ? g : "????"}</div>
                </div>
                ${unlocked && match != null ? `<p class="t-caption-01 t-secondary">내 생각과 ${match}/4 글자 일치</p>` : ""}
                ${r.m ? `<p class="bubble">“${esc(r.m)}”</p>` : ""}
              </div>`;
            })
            .join("")}
        </div>
      </div>`
    : "";

  const baseType = unlocked ? an.type : o.self;
  const compat = baseType
    ? `<div class="card compat">
        <p class="t-label-02 t-primary">궁합 미니</p>
        <h2 class="t-title-04">${unlocked ? "남이 보는 나" : "내가 보는 나"}(${baseType}) × 친구 MBTI</h2>
        <p class="t-body-03 t-secondary">친구의 MBTI를 고르면 둘의 케미를 가볍게 알려줘요.${unlocked ? "" : " 결과가 열리면 남이 보는 나 기준으로 바뀌어요."}</p>
        <div class="type-grid type-grid--sm" id="compatGrid"></div>
        <div id="compatOut"></div>
      </div>`
    : "";

  const pickSelf = !o.self
    ? `<div class="card">
        <h2 class="t-title-04">내가 생각하는 내 MBTI를 골라 주세요</h2>
        <p class="t-body-03 t-secondary">이 브라우저에는 처음이라 기준 유형이 비어 있어요.</p>
        <div class="type-grid type-grid--sm" id="fixSelf"></div>
      </div>`
    : "";

  const keep = `
    <div class="card card--flat keep">
      <h2 class="t-title-04">결과 보관 링크</h2>
      <p class="t-body-03 t-secondary">앱마다 저장소가 달라서, 카카오톡에서 연 답장은 크롬·사파리에서 안 보일 수 있어요. 이 링크를 북마크하거나 '나와의 채팅'에 보내 두면, 어디서 열어도 지금까지의 응답 ${n}개가 그대로 합쳐져요.</p>
      <p class="t-caption-01 t-tertiary">응답이 늘어나면 새 보관 링크로 다시 보관해 주세요.</p>
      <div class="row gap-8">
        <button class="btn btn--secondary grow" id="sendKeep">나에게 보내기</button>
        <button class="btn btn--outline grow" id="copyKeep">링크 복사</button>
      </div>
    </div>`;

  const notice =
    dash.flags.fresh && dash.flags.via === "reply"
      ? `<div class="card card--flat notice"><p class="t-body-03">이 브라우저에선 처음 열린 기록이에요. 다른 앱에서 만든 기록이 있다면 거기서 '결과 보관 링크'를 열어 주세요. 응답이 하나로 합쳐져요.</p></div>`
      : "";

  view.innerHTML = `
    <div class="viewbar row gap-8">
      <button class="btn btn--ghost btn--icon" id="meHome" aria-label="처음 화면">←</button>
      <h1 class="t-title-04 grow">남이 보는 ${esc(name)}</h1>
    </div>
    <div class="stack gap-16">
      ${notice}
      ${pickSelf}
      ${progress}
      ${unlocked ? result : n === 0 ? linkCard + locked : locked + linkCard}
      ${friends}
      ${unlocked ? linkCard : ""}
      ${compat}
      ${keep}
      <button class="btn btn--ghost btn--block btn--sm" id="resetMe">처음부터 새로 만들기</button>
    </div>`;

  // 이벤트
  $("#meHome").onclick = () => goIntro({ push: true });
  $("#shareLink").onclick = () => shareOwnerLink(o);
  $("#copyLink").onclick = async () => toast((await copyText(ownerLink(o))) ? "내 링크를 복사했어요" : "복사에 실패했어요");
  $("#sendKeep").onclick = () =>
    share({ title: "남이 정해주는 MBTI 결과 보관", text: `${name}의 남이 보는 MBTI 보관 링크 (응답 ${n}개)`, url: keepLink(o) });
  $("#copyKeep").onclick = async () =>
    toast((await copyText(keepLink(o))) ? "보관 링크를 복사했어요. 북마크해 두세요" : "복사에 실패했어요");
  $("#resetMe").onclick = () => {
    if (!confirm("새 링크를 만들까요? 지금 링크로 오는 답장도 계속 받을 수 있어요.")) return;
    store.remove("me");
    setup.self = null;
    $("#ownerName").value = "";
    goSetup();
  };
  const sc = $("#shareCard");
  if (sc)
    sc.onclick = async () => {
      sc.classList.add("is-loading");
      try {
        await document.fonts?.ready;
        const canvas = drawCard(o, an);
        await shareImage(canvas, {
          filename: `others-mbti-${an.type}.png`,
          title: "남이 정해주는 MBTI",
          text: `친구들 눈에 나는 ${an.type}래요. 나도 받아보기 → ${BASE}`,
        });
      } finally {
        sc.classList.remove("is-loading");
      }
    };
  const fix = $("#fixSelf");
  if (fix)
    renderTypeGrid(fix, null, (t) => {
      o.self = t;
      saveOwner(o);
      renderMe();
    });
  const cg = $("#compatGrid");
  if (cg) {
    renderTypeGrid(cg, dash.compat, (t) => {
      dash.compat = t;
      renderCompat(baseType, t);
    });
    if (dash.compat) renderCompat(baseType, dash.compat);
  }
  if (first && unlocked) {
    const hero = $(".gap-card", view);
    flipAll(hero, an.type, { from: o.self || undefined, stagger: 200 });
    const gn = $("#gapNum");
    if (gn) countUp(gn, an.gap, { duration: 1100, format: (v) => `${Math.round(v)}%` });
  } else if (unlocked && o.self) {
    $$(".gap-card .flap", view).forEach((f, i) => o.self[i] !== an.type[i] && f.classList.add("is-changed"));
  }
}

function renderCompat(a, b) {
  const same = [...a].filter((c, i) => c === b[i]).length;
  const h = COMPAT.headline[same];
  $("#compatOut").innerHTML = `
    <div class="compat__out fade-swap">
      <div class="row gap-8 compat__pair"><b>${a}</b><span aria-hidden="true">×</span><b>${b}</b><span class="badge">${same}/4 글자 같음</span></div>
      <p class="t-title-04">${h.title}</p>
      <p class="t-body-03 t-secondary">${h.desc}</p>
      <ul class="compat__list">${COMPAT.axis
        .map((x, i) => `<li><b>${a[i]}·${b[i]}</b> ${a[i] === b[i] ? x.same : x.diff}</li>`)
        .join("")}</ul>
      <p class="t-caption-01 t-tertiary">글자 조합으로 풀어 본 재미용 궁합이에요.</p>
    </div>`;
}

/* ---------- 결과 카드 이미지 (1080×1350) ---------- */
function tok(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function drawCard(o, an) {
  const W = 540;
  const H = 675;
  const { canvas, ctx } = createCanvas(W, H, 2);
  const c = {
    brand: tok("--brand"),
    paper: tok("--art-paper"),
    white: tok("--art-white"),
    kraft: tok("--art-kraft"),
    ink: tok("--art-ink"),
    inkSoft: tok("--art-ink-soft"),
    note: tok("--art-note"),
    tape: tok("--art-tape"),
  };
  // 캔버스는 CSS var()를 못 읽으므로 글꼴 목록을 직접 적는다
  const display = `"Black Han Sans", ${CANVAS_FONT}`;
  const latin = `"Archivo Black", "Arial Black", Impact, ${CANVAS_FONT}`;
  const hand = `"Nanum Pen Script", ${CANVAS_FONT}`;
  const serif = `Georgia, "Times New Roman", ${CANVAS_FONT}`;
  const F = (w, s, fam = CANVAS_FONT) => `${w} ${s}px ${fam}`;
  const rot = (x, y, deg, fn) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((deg * Math.PI) / 180);
    fn();
    ctx.restore();
  };

  // 종이 + 복사기 점
  ctx.fillStyle = c.paper;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = c.ink;
  ctx.globalAlpha = 0.05;
  for (let y = 0; y < H; y += 9) for (let x = (y / 9) % 2 ? 4 : 0; x < W; x += 9) ctx.fillRect(x, y, 1.6, 1.6);
  ctx.globalAlpha = 1;

  // 제목
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = c.ink;
  ctx.font = F(800, 22, display);
  ctx.fillText("남이 정해주는", 40, 62);
  rot(184, 54, -4, () => {
    ctx.fillStyle = c.brand;
    ctx.fillRect(-4, -22, 74, 30);
    ctx.fillStyle = c.ink;
    ctx.font = F(800, 22, latin);
    ctx.fillText("MBTI", 2, 2);
  });
  ctx.font = F(800, 34, display);
  ctx.fillText(`${o.name}, 친구들 눈엔`.slice(0, 16), 40, 118);

  // 내가 보는 나 (지워진 메모)
  rot(52, 150, -3, () => {
    ctx.fillStyle = c.note;
    ctx.fillRect(0, 0, 200, 64);
    ctx.fillStyle = c.ink;
    ctx.font = F(400, 36, hand);
    ctx.fillText(`나: ${o.self || "?"}`, 18, 44);
    ctx.strokeStyle = c.brand;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(10, 40);
    ctx.bezierCurveTo(60, 18, 110, 52, 190, 24);
    ctx.stroke();
  });

  // 남이 보는 나 (오려 붙인 글자)
  const styles = [
    { bg: c.ink, fg: c.paper, font: latin, r: -5, w: 800 },
    { bg: c.brand, fg: c.ink, font: display, r: 4, w: 800 },
    { bg: c.kraft, fg: c.ink, font: serif, r: -2, w: 700 },
    { bg: c.white, fg: c.ink, font: latin, r: 6, line: true, w: 800 },
  ];
  [...an.type].forEach((ch, i) => {
    const st = styles[i];
    rot(40 + 58 + i * 116, 316, st.r, () => {
      ctx.fillStyle = st.bg;
      ctx.fillRect(-50, -62, 100, 124);
      if (st.line) {
        ctx.strokeStyle = c.ink;
        ctx.lineWidth = 3;
        ctx.strokeRect(-44, -56, 88, 112);
      }
      ctx.fillStyle = st.fg;
      ctx.textAlign = "center";
      ctx.font = F(st.w || 400, 78, st.font);
      ctx.fillText(ch, 0, 28);
    });
  });
  ctx.textAlign = "left";
  ctx.fillStyle = c.ink;
  ctx.font = F(800, 26, display);
  ctx.fillText(TYPES[an.type].nick, 40, 430);

  // 반전 지수 티켓
  rot(40, 456, 1.5, () => {
    ctx.fillStyle = c.white;
    ctx.fillRect(0, 0, 220, 96);
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 220, 96);
    ctx.fillStyle = c.ink;
    ctx.font = F(800, 18, display);
    ctx.fillText("반전 지수", 16, 30);
    ctx.font = F(800, 48, latin);
    ctx.fillText(o.self ? `${an.gap}%` : "-", 16, 82);
    ctx.fillStyle = c.inkSoft;
    ctx.font = F(600, 13);
    ctx.textAlign = "right";
    ctx.fillText(gapTier(an.gap).label, 206, 30);
  });
  ctx.textAlign = "left";
  ctx.fillStyle = c.inkSoft;
  ctx.font = F(600, 15);
  ctx.fillText(`친구 ${an.n}명이 답했어요`, 40, 584);

  // 한마디 메모 + 테이프
  rot(292, 452, -3, () => {
    ctx.fillStyle = c.note;
    ctx.fillRect(0, 0, 210, 140);
    ctx.fillStyle = c.tape;
    ctx.fillRect(66, -12, 80, 24);
    ctx.fillStyle = c.ink;
    ctx.font = F(400, 26, hand);
    const text = an.best ? an.best.m : TYPES[an.type].feels[0];
    wrapText(ctx, `“${text}”`, 14, 42, 184, 28);
    ctx.font = F(400, 20, hand);
    ctx.fillText(`- ${an.best ? an.best.f : "친구들"}`, 14, 126);
  });

  ctx.fillStyle = c.inkSoft;
  ctx.font = F(500, 13);
  ctx.textAlign = "left";
  ctx.fillText(`나도 받아보기 · ${location.host}${location.pathname}`, 40, H - 36);
  return canvas;
}

/* ---------- 연결 ---------- */
function bind() {
  $("#start").onclick = async (e) => {
    const t = e.currentTarget;
    t.classList.remove("is-punch");
    void t.offsetWidth;
    t.classList.add("is-punch");
    haptic(10);
    await sleep(prefersReducedMotion() ? 0 : 260);
    t.classList.remove("is-punch");
    const me = getMe();
    if (me) {
      openDashboard(me);
      history.pushState({ v: "me" }, "", BASE);
      shareOwnerLink(me);
    } else goSetup();
  };
  $("#introMine").onclick = () => {
    const me = getMe();
    if (!me) return;
    history.pushState({ v: "me" }, "", BASE);
    openDashboard(me);
  };
  $$("[data-back]").forEach((b) => (b.onclick = () => history.back()));
  $("#ownerName").addEventListener("input", () => {
    $("#nameField").classList.remove("is-error");
    validateSetup();
  });
  $("#setupForm").addEventListener("submit", (e) => {
    e.preventDefault();
    createOwner();
  });
  $("#dontKnow").onclick = () => startSelfTest();
  $("#quizBack").onclick = quizBack;
  $("#noteBack").onclick = () => {
    showView("quiz");
    renderQuestion(-1);
  };
  $("#noteText").addEventListener("input", updateNoteCount);
  $("#noteForm").addEventListener("submit", (e) => {
    e.preventDefault();
    submitNote();
  });

  window.addEventListener("popstate", (e) => {
    const v = e.state?.v;
    if (getParam("q")) return; // 친구 화면은 그대로
    if (v === "setup") goSetup({ push: false });
    else if (v === "me" && getMe()) openDashboard(getMe());
    else goIntro();
  });

  // 다른 탭에서 답장이 합쳐지면 바로 반영
  window.addEventListener("storage", (e) => {
    if (!e.key || !e.key.startsWith(`${SLUG}:owners`)) return;
    if (dash && !$('[data-view="me"]').hidden) renderMe();
  });
}

function route() {
  const k = getParam("k");
  const r = getParam("r");
  const q = getParam("q");
  if (k) return handleKeep(k);
  if (r) return handleReply(r);
  if (q) return startAsk(q);
  goIntro();
}

renderCrumb($("#crumb"));
bind();
route();
renderMoreSites($("#more"));
