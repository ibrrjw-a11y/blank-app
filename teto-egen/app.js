import { $, $$, haptic, toast, renderMoreSites, CANVAS_FONT, prefersReducedMotion } from "../shared/kit.js";
import {
  createQuiz,
  tally,
  springValue,
  createResultKit,
  swapView,
  loopScenes,
  wait,
  esc,
  josa,
  fmtDate,
  tok,
  rotated,
} from "../test-kit/engine.js";
import { QUESTIONS, DOMAINS, GENDERS, TYPES, typeOf, typeById, typeName, pairNote } from "./data.js";

const kit = createResultKit({ slug: "teto-egen", questions: QUESTIONS, title: "테토·에겐 테스트" });
const store = kit.store;

/* ---------- 계산 ---------- */
function compute(answers, g = "x") {
  const all = tally(QUESTIONS, answers);
  const teto = all.pct("t");
  const domains = Object.keys(DOMAINS).map((d) => {
    const r = tally(QUESTIONS, answers, (q) => q.d === d);
    return { d, name: DOMAINS[d], teto: r.pct("t"), t: r.sum.t || 0, e: r.sum.e || 0, n: r.max.t };
  });
  const type = typeOf(teto);
  const gg = GENDERS[g] ? g : "x";
  return { answers, g: gg, teto, egen: 100 - teto, t: all.sum.t || 0, e: all.sum.e || 0, domains, type, name: typeName(type, gg) };
}

const getG = () => (GENDERS[store.get("g")] ? store.get("g") : "x");

/* ---------- 줄다리기 밧줄 (SVG) ----------
 * p = 테토 % (0~100). 테토가 이기면 왼쪽으로 끌려간다. */
const FIG = {
  // 발(0,0) 기준, 오른쪽(가운데)을 보고 뒤로 기대어 당기는 자세
  limbs: "M-13 0 L-4 -32 L13 0 M-4 -32 L-17 -62 M-16 -58 L14 -50",
  head: { cx: -22, cy: -75 },
};

function figure(x, mirror, kind, i) {
  const body =
    kind === "teto"
      ? `<path d="${FIG.limbs}" /><circle cx="${FIG.head.cx}" cy="${FIG.head.cy}" r="9" />`
      : `<path d="${FIG.limbs}" /><circle cx="${FIG.head.cx}" cy="${FIG.head.cy}" r="8" /><path class="te-fig__bloom" d="M-27 -86 q-4 -6 2 -7 q4 -5 7 1 q6 1 2 6 q2 6 -5 4 q-6 3 -6 -4z" />`;
  return `<g transform="translate(${x} 132)${mirror ? " scale(-1 1)" : ""}"><g class="te-fig te-fig--${kind}" style="--i:${i}">${body}</g></g>`;
}

function fieldSVG({ flags = [] } = {}) {
  return `<svg class="te-field" viewBox="0 0 390 150" aria-hidden="true">
    <line class="te-field__ground" x1="0" y1="133" x2="390" y2="133" />
    <line class="te-field__mark" x1="135" y1="120" x2="135" y2="146" />
    <line class="te-field__mark" x1="255" y1="120" x2="255" y2="146" />
    <line class="te-field__center" x1="195" y1="6" x2="195" y2="146" />
    <g class="te-pull">
      <path class="te-rope" d="M14 82 Q195 88 376 82" />
      <path class="te-rope te-rope--braid" d="M14 82 Q195 88 376 82" />
      ${figure(72, false, "teto", 0)}${figure(126, false, "teto", 1)}
      ${figure(318, true, "egen", 0)}${figure(264, true, "egen", 1)}
      <g class="te-knot" transform="translate(195 84)"><path d="M0 0 L-8 30 L0 24 L8 30Z" /><circle r="4.5" /></g>
      ${flags
        .map(
          (f, i) =>
            `<g class="te-flag te-flag--${i}" transform="translate(195 82)"><line x1="0" y1="0" x2="0" y2="${-40 - i * 0}" /><path d="M0 ${-40} h${i ? -34 : 34} l${i ? 6 : -6} 8 l${i ? -6 : 6} 8 h${i ? 34 : -34}z" /><text x="${i ? -17 : 17}" y="${-28}">${esc(f)}</text></g>`
        )
        .join("")}
    </g>
  </svg>`;
}

const MAX_SHIFT = 46;
function mountField(host, opts = {}) {
  host.innerHTML = fieldSVG(opts);
  const svg = host.querySelector("svg");
  const pull = svg.querySelector(".te-pull");
  const ropes = $$(".te-rope", svg);
  let prev = 0;
  const sv = springValue(0, {
    stiffness: opts.stiffness || 120,
    damping: opts.damping || 9,
    onUpdate(x) {
      const vel = x - prev;
      prev = x;
      const sag = 6 + Math.min(16, Math.abs(vel) * 3.2);
      pull.setAttribute("transform", `translate(${x.toFixed(2)} 0)`);
      ropes.forEach((r) => r.setAttribute("d", `M14 82 Q195 ${(82 + sag).toFixed(1)} 376 82`));
    },
  });
  const toX = (p) => ((50 - p) / 50) * MAX_SHIFT;
  return {
    svg,
    set(p, kick = 0) {
      const x = toX(p);
      const dir = Math.sign(x - sv.value);
      sv.set(x, kick * dir);
      if (dir) {
        const team = dir < 0 ? "teto" : "egen";
        $$(`.te-fig--${team}`, svg).forEach((f) => {
          f.classList.remove("is-heave");
          void f.getBBox?.();
          f.getBoundingClientRect();
          f.classList.add("is-heave");
        });
      }
    },
    jump(p) {
      prev = toX(p);
      sv.jump(toX(p));
    },
    stop: () => sv.stop(),
  };
}

/* ---------- 장식 ---------- */
const flower = (cls, rot = 0) => `<svg class="te-flower ${cls}" viewBox="0 0 60 90" style="--r:${rot}deg" aria-hidden="true">
  <path class="te-flower__stem" d="M30 44 C 28 60, 33 72, 29 88" />
  <path class="te-flower__leaf" d="M30 66 C 18 60, 12 64, 8 70 C 16 74, 24 72, 30 66z" />
  <path class="te-flower__leaf" d="M30 58 C 42 52, 48 56, 52 62 C 44 66, 36 64, 30 58z" />
  ${[0, 72, 144, 216, 288]
    .map((a) => `<ellipse class="te-flower__petal" cx="30" cy="22" rx="8" ry="13" transform="rotate(${a} 30 34)" />`)
    .join("")}
  <circle class="te-flower__eye" cx="30" cy="34" r="5" />
</svg>`;

function bunting() {
  const tri = [];
  for (let i = 0; i < 8; i++) {
    const x = 6 + i * 23;
    const y = 6 + Math.sin((i / 8) * Math.PI) * 8;
    tri.push(`<path class="te-bunt te-bunt--${i % 3}" d="M${x} ${y} l18 1 l-10 18z" />`);
  }
  const buds = [];
  for (let i = 0; i < 7; i++) {
    const x = 214 + i * 25;
    const y = 10 + Math.sin(((i + 1) / 8) * Math.PI) * 8;
    buds.push(`<circle class="te-bud te-bud--${i % 2}" cx="${x}" cy="${y + 4}" r="${i % 2 ? 4 : 5.5}" /><path class="te-bud__leaf" d="M${x + 4} ${y + 6} q6 -2 8 4 q-6 2 -8 -4z" />`);
  }
  return `<svg class="te-bunting" viewBox="0 0 390 34" preserveAspectRatio="none" aria-hidden="true">
    <path class="te-bunting__line" d="M0 6 Q97 18 195 6" /><path class="te-bunting__thread" d="M195 8 Q292 20 390 8" />
    ${tri.join("")}${buds.join("")}
  </svg>`;
}

/* ---------- 인트로 ---------- */
const DEMO = [
  { no: 1, d: "일상", q: "주말 약속이 갑자기 취소됐어요.", o: ["러닝 한 바퀴 뛰고 와요", "드라마 정주행해요"], pick: 0, side: "t" },
  { no: 2, d: "친구", q: "친구가 밤 11시에 고민 상담 전화를 했어요.", o: ["해결책부터 정리해요", "끝까지 들어줘요"], pick: 1, side: "e" },
  { no: 6, d: "연애", q: "마음에 드는 사람이 생겼어요.", o: ["먼저 밥 먹자고 해요", "신호를 모아요"], pick: 0, side: "t" },
];

let intro = null;
let introField = null;

function odo(id) {
  const strip = "0123456789".split("").map((d) => `<i>${d}</i>`).join("");
  return `<span class="te-odo" id="${id}"><span class="te-odo__col"><span class="te-odo__strip">${strip}</span></span><span class="te-odo__col"><span class="te-odo__strip">${strip}</span></span></span>`;
}
function setOdo(el, n) {
  const s = String(Math.max(0, Math.min(99, Math.round(n)))).padStart(2, "0");
  $$(".te-odo__strip", el).forEach((st, i) => st.style.setProperty("--d", s[i]));
}

function buildStage() {
  const stage = $("#stage");
  stage.innerHTML = `
    ${bunting()}
    <span class="te-side te-side--teto">힘이 먼저<br />나가는 쪽</span>
    <span class="te-side te-side--egen">마음이 먼저<br />움직이는 쪽</span>
    ${flower("te-flower--a", -18)}${flower("te-flower--b", 24)}
    <div class="te-stage__field" id="introField"></div>
    <div class="te-card" id="introCard">
      <div class="te-card__inner">
        <p class="te-card__no"><b>제<span id="dNo">1</span>경기</b><span id="dDom">일상</span></p>
        <p class="te-card__q" id="dQ"></p>
        <div class="te-card__opts"><span class="te-chip" id="dA"></span><span class="te-chip" id="dB"></span></div>
      </div>
      <span class="te-tap" id="dTap"></span>
    </div>
    <div class="te-board">
      <span class="te-board__side">테토</span>${odo("oT")}<span class="te-board__colon">:</span>${odo("oE")}<span class="te-board__side">에겐</span>
      <span class="te-board__tag" id="dTag">14경기 중 3경기 진행</span>
    </div>
    <div class="te-pennant" id="dBanner"><b>말랑 테토</b><span>테토 64 : 36 에겐</span></div>`;
  introField = mountField($("#introField"), { stiffness: 110, damping: 8 });
  introField.jump(50);
}

function startIntro() {
  buildStage();
  const card = $("#introCard");
  const stage = $("#stage");
  let t = 0;
  let e = 0;
  const showQ = async (d, signal) => {
    stage.dataset.scene = "q";
    card.classList.remove("is-in");
    card.classList.add("is-out");
    await wait(220, signal);
    if (signal.aborted) return;
    $("#dNo").textContent = d.no;
    $("#dDom").textContent = d.d;
    $("#dQ").textContent = d.q;
    $("#dA").textContent = d.o[0];
    $("#dB").textContent = d.o[1];
    $$(".te-chip", card).forEach((c) => c.classList.remove("is-picked"));
    card.classList.remove("is-out");
    void card.offsetWidth;
    card.classList.add("is-in");
    await wait(900, signal);
    if (signal.aborted) return;
    const chip = d.pick ? $("#dB") : $("#dA");
    const tap = $("#dTap");
    tap.style.left = `${d.pick ? 72 : 26}%`;
    tap.classList.remove("is-tap");
    void tap.offsetWidth;
    tap.classList.add("is-tap");
    chip.classList.add("is-picked");
    if (d.side === "t") t++;
    else e++;
    setOdo($("#oT"), t);
    setOdo($("#oE"), e);
    $("#dTag").textContent = `14경기 중 ${t + e}경기 진행`;
    introField.set(Math.round((t / (t + e)) * 100) * 0.6 + 20, 220);
  };
  const scenes = [
    ...DEMO.map((d, i) => ({
      duration: 2300,
      play(signal) {
        if (i === 0) {
          t = 0;
          e = 0;
          setOdo($("#oT"), 0);
          setOdo($("#oE"), 0);
          stage.dataset.scene = "q";
          introField.set(50, 0);
        }
        showQ(d, signal);
      },
    })),
    {
      duration: 3200,
      play(signal) {
        stage.dataset.scene = "result";
        setOdo($("#oT"), 64);
        setOdo($("#oE"), 36);
        $("#dTag").textContent = "14경기 종료 · 판정";
        introField.set(64, 260);
        wait(1500, signal).then(() => !signal.aborted && introField.set(64, 0));
      },
    },
  ];
  intro?.stop();
  intro = loopScenes(scenes);
}

function stopIntro() {
  intro?.stop();
  intro = null;
}

function goIntro() {
  swapView("intro");
  const last = kit.history.latest();
  const lr = $("#lastResult");
  if (last) {
    const r = compute(last.answers, last.extra?.g);
    lr.hidden = false;
    lr.innerHTML = `지난 기록 <b>${esc(r.name)}</b> · 테토 ${r.teto}% 보기 →`;
  } else lr.hidden = true;
  startIntro();
}

/* ---------- 출전 부문 ---------- */
function bindBibs() {
  const g = getG();
  $$(".te-bib").forEach((b) => {
    b.setAttribute("aria-checked", String(b.dataset.g === g));
    b.onclick = () => {
      haptic(8);
      store.set("g", b.dataset.g);
      $$(".te-bib").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    };
  });
}

/* ---------- 경기 (문항) ---------- */
let quizField = null;
const quiz = createQuiz({
  questions: QUESTIONS,
  onShow: renderQ,
  onDone: finish,
  onExit: () => {
    history.back();
  },
});

function runningScore(answers, upto) {
  let t = 0;
  let e = 0;
  for (let i = 0; i < upto; i++) {
    const o = QUESTIONS[i].options[answers[i]];
    if (!o) continue;
    t += o.s.t || 0;
    e += o.s.e || 0;
  }
  return { t, e };
}

function renderQ({ q, idx, total, dir, selected, answers }) {
  const { t, e } = runningScore(answers, idx);
  $("#qT").textContent = t;
  $("#qE").textContent = e;
  $("#qNo").textContent = `${idx + 1}/${total}`;
  quizField.set(t + e ? (t / (t + e)) * 100 : 50, dir ? 60 : 0);
  const card = $("#quizCard");
  card.innerHTML = `
    <div class="te-q__card ${dir < 0 ? "from-prev" : "from-next"}">
      <p class="te-q__no"><b>제${idx + 1}경기</b><span>${DOMAINS[q.d]}</span></p>
      <h2 class="te-q__text">${esc(q.q)}</h2>
      <div class="te-q__opts">
        ${q.options
          .map(
            (o, i) => `<button type="button" class="tk-option te-lane" data-i="${i}" aria-pressed="${selected === i}">
              <span class="te-lane__no">${i + 1}레인</span><span class="te-lane__t">${esc(o.t)}</span></button>`
          )
          .join("")}
      </div>
    </div>
    <div class="te-innings" aria-label="경기 진행표">
      <p class="te-innings__title">경기 진행표</p>
      <ol>${QUESTIONS.map((qq, i) => {
        const o = i < idx ? qq.options[answers[i]] : null;
        const k = o ? (o.s.t ? "t" : "e") : i === idx ? "now" : "";
        return `<li class="is-${k}"><span>${i + 1}</span><b>${o ? (o.s.t ? "테" : "에") : ""}</b></li>`;
      }).join("")}</ol>
    </div>`;
  $$(".te-lane", card).forEach((b) =>
    b.addEventListener("click", async () => {
      if (card.dataset.busy) return;
      card.dataset.busy = "1";
      haptic(10);
      const i = Number(b.dataset.i);
      $$(".te-lane", card).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      const s = q.options[i].s;
      const nt = t + (s.t || 0);
      const ne = e + (s.e || 0);
      $("#qT").textContent = nt;
      $("#qE").textContent = ne;
      quizField.set((nt / (nt + ne)) * 100, 200);
      await wait(prefersReducedMotion() ? 0 : 420);
      delete card.dataset.busy;
      quiz.pick(i);
    })
  );
}

function startQuiz() {
  stopIntro();
  kit.clearUrl();
  history.pushState({ v: "quiz" }, "", kit.BASE);
  swapView("quiz");
  if (!quizField) quizField = mountField($("#quizRope"), { stiffness: 140, damping: 10 });
  quizField.jump(50);
  quiz.start();
}

function finish(answers) {
  const g = getG();
  kit.history.add({ answers, extra: { g } });
  history.replaceState({ v: "result" }, "", kit.BASE);
  showResult({ answers, extra: { g } }, { fresh: true });
}

/* ---------- 결과 화면 ---------- */
function domainRows(r, other) {
  return r.domains
    .map((d, i) => {
      const o = other?.domains[i];
      return `<li class="te-dom">
        <span class="te-dom__name">${d.name}</span>
        <span class="te-dom__bar" style="--p:${d.teto}"><i></i>${o ? `<em style="--p:${o.teto}"></em>` : ""}</span>
        <span class="te-dom__num">${d.t}<small>:</small>${d.e}</span>
      </li>`;
    })
    .join("");
}

function poster(r, { label }) {
  const side = r.type.side;
  return `<div class="te-poster te-poster--${side}">
    <div class="te-poster__nums">
      <div class="te-poster__half te-poster__half--teto"><small>TETO</small><b class="t-num" data-count="${r.teto}">${r.teto}</b><span>%</span></div>
      <div class="te-poster__half te-poster__half--egen"><small>에겐</small><b class="t-num" data-count="${r.egen}">${r.egen}</b><span>%</span></div>
    </div>
    <div class="te-poster__field" data-field></div>
    <div class="te-poster__name">
      <span class="te-poster__label">${esc(label)}</span>
      <h2 class="te-poster__type">${esc(r.name)}</h2>
      <p class="te-poster__head">${esc(r.type.head)}</p>
    </div>
  </div>`;
}

function historyBlock() {
  const list = kit.history.list().slice(-6).reverse();
  if (!list.length) return "";
  return `<section class="te-box te-hist">
    <h3 class="te-box__title">역대 전적 <small>이 기기에만 저장</small></h3>
    <ol>${list
      .map((h, i) => {
        const r = compute(h.answers, h.extra?.g);
        const prev = list[i + 1] ? compute(list[i + 1].answers, list[i + 1].extra?.g) : null;
        const diff = prev ? r.teto - prev.teto : null;
        return `<li><span class="te-hist__date">${fmtDate(h.t)}</span><b>${esc(r.name)}</b><span class="te-hist__p t-num">테토 ${r.teto}%${
          diff ? `<em class="${diff > 0 ? "up" : "down"}">${diff > 0 ? "+" : ""}${diff}</em>` : ""
        }</span></li>`;
      })
      .join("")}</ol>
  </section>`;
}

function compareBlock(me, fr) {
  const fname = fr.name || "친구";
  const meName = kit.getNick() || "나";
  return `<section class="te-box te-vs">
    <h3 class="te-box__title">친선 경기 <small>${esc(meName)} vs ${esc(fname)}</small></h3>
    <div class="te-vs__lane"><span class="te-vs__who">${esc(meName)}</span><div data-vs="0"></div><b class="t-num">${me.teto} : ${me.egen}</b></div>
    <div class="te-vs__lane"><span class="te-vs__who">${esc(fname)}</span><div data-vs="1"></div><b class="t-num">${fr.r.teto} : ${fr.r.egen}</b></div>
    <table class="te-vs__table">
      <thead><tr><th>${esc(meName)}</th><th>부문</th><th>${esc(fname)}</th></tr></thead>
      <tbody>
        <tr><td>${esc(me.name)}</td><th>결과</th><td>${esc(fr.r.name)}</td></tr>
        ${me.domains
          .map((d, i) => {
            const o = fr.r.domains[i];
            const lean = (p) => (p > 50 ? "테토" : p < 50 ? "에겐" : "반반");
            return `<tr><td>${lean(d.teto)} ${d.t}:${d.e}</td><th>${d.name}</th><td>${lean(o.teto)} ${o.t}:${o.e}</td></tr>`;
          })
          .join("")}
      </tbody>
    </table>
    <p class="te-vs__note">${esc(pairNote(me.type, fr.r.type))}</p>
    <button type="button" class="te-textbtn" id="clearFriend">친선 경기 기록 지우기</button>
  </section>`;
}

function inviteBlock(me) {
  const meName = kit.getNick() || "나";
  return `<section class="te-bracket">
    <h3 class="te-bracket__title">친선 경기 대진표</h3>
    <div class="te-bracket__draw">
      <div class="te-bracket__lane is-me"><i>A</i><b>${esc(meName)}</b><span class="t-num">테토 ${me.teto}</span></div>
      <div class="te-bracket__lane is-open"><i>B</i><b>출전 대기</b><span>?</span></div>
      <span class="te-bracket__vs" aria-hidden="true">VS</span>
    </div>
    <p class="te-bracket__rule">B 자리는 친구 몫. 내 결과 링크로 친구가 출전하면 줄 두 개가 나란히 걸려요.</p>
    <div class="tk-paste"><input class="te-input" id="pasteFriend" inputmode="url" placeholder="친구 결과 링크로 B 채우기" /><button type="button" class="te-flagbtn te-flagbtn--sm" id="pasteGo">대진</button></div>
  </section>`;
}

function showResult(entry, { fresh = false } = {}) {
  stopIntro();
  const r = compute(entry.answers, entry.extra?.g);
  const fr = kit.friend.get();
  const friend = fr ? { ...fr, r: compute(fr.answers, fr.extra?.g) } : null;
  const view = $('[data-view="result"]');
  const nick = kit.getNick();
  view.innerHTML = `
    <div class="te-topline"><button type="button" class="te-back" id="resHome">← 처음으로</button><span>판정 결과</span></div>
    ${poster(r, { label: nick ? `${nick}의 판정` : "나의 판정" })}
    <p class="te-desc">${esc(r.type.desc)}</p>
    ${r.teto === 50 ? `<p class="te-tie">정확히 7 : 7, 줄이 한가운데에 멈췄어요. 규칙상 테토 쪽 판정이에요.</p>` : ""}
    <section class="te-box">
      <h3 class="te-box__title">부문별 기록 <small>테토 : 에겐</small></h3>
      <ul class="te-doms">${domainRows(r)}</ul>
    </section>
    <section class="te-box te-traits">
      <h3 class="te-box__title">종목 기록</h3>
      <ul>${r.type.traits.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      <h3 class="te-box__title">연애할 때</h3>
      <p>${esc(r.type.love)}</p>
      <p class="te-tipline">감독 한마디 · ${esc(r.type.tip)}</p>
      <p class="te-match">잘 맞는 상대 <b>${esc(typeById(r.type.match).base)}</b> <small>(성별 무관)</small></p>
    </section>
    <section class="te-box te-share">
      <label class="te-nick"><span>이름표 (선택)</span><input class="te-input" id="nick" maxlength="10" placeholder="링크에 붙일 이름" value="${esc(nick)}" /></label>
      <div class="te-share__row">
        <button type="button" class="te-flagbtn" id="shareLink">결과 링크 보내기</button>
        <button type="button" class="te-flagbtn te-flagbtn--egen" id="shareImg">포스터 저장</button>
      </div>
    </section>
    ${friend ? compareBlock(r, friend) : inviteBlock(r)}
    ${historyBlock()}
    <button type="button" class="te-pistol te-pistol--again" id="again"><span class="te-pistol__label"><b>재경기</b> 다시 출전하기</span></button>`;
  swapView("result");

  const field = mountField($("[data-field]", view), { stiffness: 90, damping: 6 });
  field.jump(50);
  setTimeout(() => field.set(r.teto, fresh ? 340 : 120), fresh ? 380 : 120);
  if (friend) {
    const a = mountField($('[data-vs="0"]', view), { flags: ["나"] });
    const b = mountField($('[data-vs="1"]', view), { flags: [friend.name ? friend.name.slice(0, 3) : "친구"] });
    a.jump(50);
    b.jump(50);
    setTimeout(() => {
      a.set(r.teto, 200);
      b.set(friend.r.teto, 200);
    }, 500);
  }

  $("#resHome").onclick = () => goIntro();
  $("#again").onclick = () => startQuiz();
  $("#nick").addEventListener("change", (e) => kit.setNick(e.target.value));
  $("#shareLink").onclick = () => {
    kit.setNick($("#nick").value);
    haptic();
    kit.shareLink(entry, { text: `나는 테토 ${r.teto} : 에겐 ${r.egen}, ${r.name}! 너는 어느 쪽이야?` });
  };
  $("#shareImg").onclick = async (ev) => {
    const b = ev.currentTarget;
    b.classList.add("is-loading");
    try {
      kit.setNick($("#nick").value);
      await kit.shareCard((ctx, W, H) => drawCard(ctx, W, H, r), { filename: `teto-egen-${r.teto}.png`, text: `테토 ${r.teto} : 에겐 ${r.egen}` });
    } finally {
      b.classList.remove("is-loading");
    }
  };
  const cf = $("#clearFriend");
  if (cf)
    cf.onclick = () => {
      kit.friend.clear();
      showResult(entry);
    };
  const pg = $("#pasteGo");
  if (pg)
    pg.onclick = () => {
      const f = kit.parse($("#pasteFriend").value);
      if (!f) return toast("결과 링크를 다시 확인해 주세요");
      if (f.mine) return toast("내 결과 링크예요. 친구 링크를 붙여 주세요");
      kit.friend.set(f);
      showResult(entry);
      toast("친선 경기를 열었어요");
    };
  if (fresh) haptic([10, 40, 10]);
}

/* ---------- 친구 결과 화면 (링크로 열었을 때) ---------- */
function showFriend(f) {
  stopIntro();
  const r = compute(f.answers, f.extra?.g);
  const who = f.name || "친구";
  const mine = kit.history.latest();
  const view = $('[data-view="friend"]');
  view.innerHTML = `
    <div class="te-topline"><span>${esc(who)}${josa(who, "이/가")} 보낸 경기 결과</span></div>
    ${poster(r, { label: `${who}의 판정` })}
    <section class="te-box te-dare">
      <p><b>${esc(who)}</b>${josa(who, "은/는")} 테토 ${r.teto}%. 나는 어느 쪽으로 끌려갈까요? 끝나면 두 줄을 나란히 보여드려요.</p>
      <button type="button" class="te-pistol" id="friendGo"><span class="te-pistol__label"><b>탕!</b> 나도 출전하기</span><span class="te-pistol__meta">14경기 · 약 2분</span></button>
      ${mine ? `<button type="button" class="te-textbtn" id="friendCmp">지난 내 기록으로 바로 비교하기 →</button>` : ""}
    </section>
    <p class="te-desc">${esc(r.type.desc)}</p>
    <section class="te-box">
      <h3 class="te-box__title">부문별 기록 <small>테토 : 에겐</small></h3>
      <ul class="te-doms">${domainRows(r)}</ul>
    </section>`;
  swapView("friend");
  const field = mountField($("[data-field]", view), { stiffness: 90, damping: 6 });
  field.jump(50);
  setTimeout(() => field.set(r.teto, 300), 400);
  $("#friendGo").onclick = () => startQuiz();
  const cmp = $("#friendCmp");
  if (cmp)
    cmp.onclick = () => {
      kit.clearUrl();
      history.pushState({ v: "result" }, "", kit.BASE);
      showResult(mine);
    };
}

/* ---------- 결과 포스터 (1080×1350) ---------- */
function drawCard(ctx, W, H, r) {
  const c = {
    red: tok("--brand"),
    cream: tok("--art-cream"),
    chalk: tok("--art-chalk"),
    ink: tok("--art-ink"),
    sepia: tok("--art-sepia"),
    rope: tok("--art-rope"),
    rose: tok("--art-rose"),
    sage: tok("--art-sage"),
  };
  const block = `"Anton", "Do Hyeon", Impact, ${CANVAS_FONT}`;
  const kblock = `"Do Hyeon", ${CANVAS_FONT}`;
  const serif = `"Gowun Batang", "Nanum Myeongjo", Georgia, serif`;
  const half = W / 2;
  ctx.fillStyle = c.red;
  ctx.fillRect(0, 0, half, H);
  ctx.fillStyle = c.cream;
  ctx.fillRect(half, 0, half, H);
  // 사선 줄무늬
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, half, H);
  ctx.clip();
  ctx.strokeStyle = "rgba(255,255,255,.08)";
  ctx.lineWidth = 14;
  for (let i = -H; i < half; i += 40) {
    ctx.beginPath();
    ctx.moveTo(i, H);
    ctx.lineTo(i + H, 0);
    ctx.stroke();
  }
  ctx.restore();

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = c.chalk;
  ctx.font = `400 26px ${block}`;
  ctx.fillText("TETO", 32, 58);
  ctx.fillStyle = c.sepia;
  ctx.font = `700 24px ${serif}`;
  ctx.textAlign = "right";
  ctx.fillText("에겐", W - 32, 58);

  ctx.textAlign = "left";
  ctx.fillStyle = c.chalk;
  ctx.font = `400 150px ${block}`;
  ctx.fillText(String(r.teto), 28, 228);
  ctx.textAlign = "right";
  ctx.fillStyle = c.sepia;
  ctx.font = `400 126px ${serif}`;
  ctx.fillText(String(r.egen), W - 28, 222);
  ctx.font = `400 28px ${serif}`;
  ctx.fillText("%", W - 28, 258);
  ctx.textAlign = "left";
  ctx.fillStyle = c.chalk;
  ctx.font = `400 28px ${block}`;
  ctx.fillText("%", 32, 262);

  // 밧줄
  const shift = ((50 - r.teto) / 50) * 120;
  const ry = 330;
  ctx.strokeStyle = c.ink;
  ctx.setLineDash([3, 6]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(half, 280);
  ctx.lineTo(half, 380);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = c.rope;
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-20, ry);
  ctx.quadraticCurveTo(half + shift, ry + 10, W + 20, ry);
  ctx.stroke();
  ctx.fillStyle = c.ink;
  ctx.beginPath();
  ctx.moveTo(half + shift, ry + 4);
  ctx.lineTo(half + shift - 12, ry + 46);
  ctx.lineTo(half + shift, ry + 36);
  ctx.lineTo(half + shift + 12, ry + 46);
  ctx.closePath();
  ctx.fill();

  // 이름 띠
  rotated(ctx, W / 2, 430, -3, () => {
    ctx.fillStyle = c.ink;
    ctx.fillRect(-W / 2 + 24, -44, W - 48, 76);
    ctx.fillStyle = r.type.side === "teto" ? c.chalk : c.cream;
    ctx.textAlign = "center";
    ctx.font = r.type.side === "teto" ? `400 50px ${kblock}` : `700 44px ${serif}`;
    ctx.fillText(r.name, 0, 12);
  });
  ctx.textAlign = "center";
  ctx.fillStyle = c.ink;
  ctx.font = `600 19px ${CANVAS_FONT}`;
  ctx.fillText(r.type.head, W / 2, 500);

  // 부문별
  r.domains.forEach((d, i) => {
    const y = 548 + i * 22;
    ctx.textAlign = "right";
    ctx.fillStyle = c.ink;
    ctx.font = `600 13px ${CANVAS_FONT}`;
    ctx.fillText(d.name, 120, y + 4);
    ctx.fillStyle = "rgba(0,0,0,.12)";
    ctx.fillRect(132, y - 6, 276, 10);
    const tw = (276 * d.teto) / 100;
    ctx.fillStyle = c.red;
    ctx.fillRect(132, y - 6, tw, 10);
    ctx.fillStyle = c.sepia;
    ctx.fillRect(132 + tw, y - 6, 276 - tw, 10);
    ctx.textAlign = "left";
    ctx.fillStyle = c.ink;
    ctx.fillText(`${d.t} : ${d.e}`, 418, y + 4);
  });
  ctx.textAlign = "center";
  ctx.fillStyle = c.ink;
  ctx.font = `500 13px ${CANVAS_FONT}`;
  ctx.fillText(`테토·에겐 테스트 · ${location.host}${location.pathname}`, W / 2, H - 24);
}

/* ---------- 연결 ---------- */
function startFromIntro(btn) {
  if (btn.dataset.busy) return;
  btn.dataset.busy = "1";
  haptic([6, 30, 20]);
  btn.classList.remove("is-fire");
  void btn.offsetWidth;
  btn.classList.add("is-fire");
  setTimeout(() => {
    delete btn.dataset.busy;
    btn.classList.remove("is-fire");
    startQuiz();
  }, prefersReducedMotion() ? 0 : 420);
}

function route() {
  const f = kit.fromUrl();
  if (f && f.mine) {
    kit.clearUrl();
    return showResult({ answers: f.answers, extra: f.extra });
  }
  if (f) {
    kit.friend.set(f);
    return showFriend(f);
  }
  goIntro();
}

bindBibs();
$("#start").onclick = (e) => startFromIntro(e.currentTarget);
$("#quizBack").onclick = () => quiz.back();
$("#lastResult").onclick = () => {
  const last = kit.history.latest();
  if (!last) return;
  history.pushState({ v: "result" }, "", kit.BASE);
  showResult(last);
};
window.addEventListener("popstate", () => {
  const f = kit.fromUrl();
  if (f && !f.mine) return showFriend(f);
  goIntro();
});
route();
renderMoreSites($("#more"));
dressSchedule($("#more"));

// 하단 다른 도구: 운동장 "다음 경기 일정" 게시판
function dressSchedule(nav) {
  if (!nav) return;
  const title = nav.querySelector(".more-sites__title");
  if (title) title.innerHTML = `<span>다음 경기 일정</span><small>NEXT EVENTS</small>`;
  nav.querySelectorAll(".more-sites__item").forEach((a, i) => {
    const no = document.createElement("span");
    no.className = "te-next__no";
    no.setAttribute("aria-hidden", "true");
    no.innerHTML = `<small>제</small>${15 + i}<small>경기</small>`;
    const go = document.createElement("span");
    go.className = "te-next__go";
    go.setAttribute("aria-hidden", "true");
    go.textContent = "입장";
    a.prepend(no);
    a.append(go);
  });
}
