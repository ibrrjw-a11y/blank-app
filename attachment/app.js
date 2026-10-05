import { $, $$, haptic, toast, renderMoreSites, CANVAS_FONT, wrapText, prefersReducedMotion } from "../shared/kit.js";
import { createQuiz, tally, springValue, createResultKit, swapView, loopScenes, wait, esc, josa, fmtDate, tok } from "../test-kit/engine.js";
import { QUESTIONS, SCALE, AXES, TYPES, typeOf, pairNote } from "./data.js";

const kit = createResultKit({ slug: "attachment", questions: QUESTIONS, title: "애착 유형 테스트" });

/* ---------- 계산 ---------- */
function compute(answers) {
  const t = tally(QUESTIONS, answers);
  const anx = t.pct("anx");
  const avo = t.pct("avo");
  return { answers, anx, avo, sumAnx: t.sum.anx || 0, sumAvo: t.sum.avo || 0, type: typeOf(anx, avo) };
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
};
const sheetNo = (answers) => {
  let h = 7;
  answers.forEach((v, i) => (h = (h * 31 + v * (i + 3)) % 9973));
  return String(h).padStart(4, "0");
};

/* ---------- 손으로 그린 동그라미 ---------- */
const LOOP = "M30 6 C 48 4, 58 14, 56 24 C 54 36, 38 41, 24 39 C 10 37, 3 28, 5 19 C 8 9, 22 4, 36 7";
const loopSVG = (cls = "") => `<svg class="at-loop ${cls}" viewBox="0 0 60 44" aria-hidden="true"><path d="${LOOP}" pathLength="1" /></svg>`;
const checkSVG = () => `<svg class="at-tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13 L10 19 L21 4" pathLength="1" /></svg>`;

/* ---------- 관계 지도 (SVG) ----------
 * x = 회피, y = 불안 (0~100). 핀과 붉은 실로 좌표를 표시한다. */
const PX = (avo) => 44 + avo * 2.36;
const PY = (anx) => 262 - anx * 2.36;

function mapSVG({ pins = [], ghosts = [], link = false, id = "" } = {}) {
  const grid = [];
  for (let i = 0; i <= 10; i++) {
    const x = 44 + i * 23.6;
    const y = 26 + i * 23.6;
    grid.push(`<line x1="${x}" y1="26" x2="${x}" y2="262" /><line x1="44" y1="${y}" x2="280" y2="${y}" />`);
  }
  return `<svg class="at-map" viewBox="0 0 300 300" ${id ? `id="${id}"` : ""} aria-hidden="true">
    <g class="at-map__grid">${grid.join("")}</g>
    <rect class="at-map__frame" x="44" y="26" width="236" height="236" />
    <line class="at-map__mid" x1="162" y1="22" x2="162" y2="266" />
    <line class="at-map__mid" x1="40" y1="144" x2="284" y2="144" />
    <g class="at-map__q">
      <text x="54" y="48" data-q="anxious">불안형</text>
      <text x="270" y="48" text-anchor="end" data-q="fearful">혼란형</text>
      <text x="54" y="252" data-q="secure">안정형</text>
      <text x="270" y="252" text-anchor="end" data-q="avoidant">회피형</text>
    </g>
    <g class="at-map__axis">
      <text x="44" y="282">가까이</text><text x="280" y="282" text-anchor="end">거리 두기</text>
      <text x="162" y="296" text-anchor="middle" class="at-map__axname">회피 →</text>
      <text x="30" y="262" text-anchor="middle" transform="rotate(-90 30 262)" dx="0">편안</text>
      <text x="30" y="26" text-anchor="end" transform="rotate(-90 30 26)">불안</text>
      <text x="14" y="144" text-anchor="middle" transform="rotate(-90 14 144)" class="at-map__axname">불안 →</text>
    </g>
    <g class="at-map__ghosts">${ghosts
      .map((g) => `<g transform="translate(${PX(g.avo)} ${PY(g.anx)})"><circle r="4" /><text y="-8" text-anchor="middle">${esc(g.label)}</text></g>`)
      .join("")}</g>
    ${
      link && pins.length === 2
        ? `<path class="at-map__link" d="M${PX(pins[0].avo)} ${PY(pins[0].anx)} Q ${(PX(pins[0].avo) + PX(pins[1].avo)) / 2} ${
            Math.max(PY(pins[0].anx), PY(pins[1].anx)) + 30
          } ${PX(pins[1].avo)} ${PY(pins[1].anx)}" pathLength="1" />`
        : ""
    }
    ${pins
      .map(
        (p, i) => `<g class="at-pin at-pin--${i}" data-pin="${i}">
          <path class="at-string" data-s="x" d="M${PX(p.avo)} 262 L${PX(p.avo)} ${PY(p.anx)}" pathLength="1" />
          <path class="at-string" data-s="y" d="M44 ${PY(p.anx)} L${PX(p.avo)} ${PY(p.anx)}" pathLength="1" />
          <circle class="at-pin__base" cx="${PX(p.avo)}" cy="262" r="3.5" />
          <circle class="at-pin__base" cx="44" cy="${PY(p.anx)}" r="3.5" />
          <g class="at-pin__head" transform="translate(${PX(p.avo)} ${PY(p.anx)})">
            <ellipse class="at-pin__shadow" cx="3" cy="4" rx="8" ry="4" />
            <circle r="8" /><circle class="at-pin__shine" cx="-2.5" cy="-2.5" r="2.5" />
            ${p.label ? `<text class="at-pin__label" x="${p.avo > 70 ? -12 : 12}" y="${i === 1 ? 24 : -10}" text-anchor="${p.avo > 70 ? "end" : "start"}">${esc(p.label)}</text>` : ""}
          </g>
        </g>`
      )
      .join("")}
  </svg>`;
}

/* ---------- 인트로 ---------- */
let intro = null;

function buildStage() {
  const stage = $("#stage");
  const row = (n) => `<div class="at-row" id="row${n}">
      <p class="at-row__q"><b class="at-row__no"></b><span class="at-row__t"></span><i class="at-caret"></i></p>
      <div class="at-scale at-scale--mini">${[1, 2, 3, 4, 5].map((v) => `<span class="at-scale__n" data-v="${v}">${v}${loopSVG()}</span>`).join("")}</div>
    </div>`;
  stage.innerHTML = `
    <p class="at-sec">Ⅰ. 문항에 표시하기</p>
    ${row(1)}${row(2)}
    <p class="at-sec">Ⅱ. 관계 지도</p>
    <div class="at-mapbox">
      ${mapSVG({ pins: [{ avo: 50, anx: 50, label: "나" }], id: "introMap" })}
      <p class="at-scrawl" id="introNote">불안 63 · 회피 28<br />→ 불안형 쪽!</p>
    </div>
    <svg class="at-pencil" id="pencil" viewBox="0 0 120 24" aria-hidden="true">
      <path class="at-pencil__wood" d="M0 12 L18 4 L18 20 Z" /><path class="at-pencil__lead" d="M0 12 L6 9.4 L6 14.6 Z" />
      <rect class="at-pencil__body" x="18" y="4" width="80" height="16" /><rect class="at-pencil__band" x="98" y="4" width="8" height="16" />
      <rect class="at-pencil__eraser" x="106" y="4" width="12" height="16" rx="3" /><line class="at-pencil__line" x1="18" y1="12" x2="98" y2="12" />
    </svg>`;
  $("#sheetDate").textContent = `작성일 ${today()}`;
}

function typeInto(el, text, signal, speed = 34) {
  return new Promise((res) => {
    if (prefersReducedMotion()) {
      el.textContent = text;
      return res();
    }
    el.textContent = "";
    let i = 0;
    const tick = () => {
      if (signal?.aborted) return res();
      el.textContent = text.slice(0, ++i);
      if (i >= text.length) return res();
      setTimeout(tick, speed);
    };
    tick();
  });
}

function movePencil(target, stage) {
  const p = $("#pencil");
  if (!p || !target) return;
  const sr = stage.getBoundingClientRect();
  const tr = target.getBoundingClientRect();
  p.style.transform = `translate(${tr.left - sr.left + tr.width * 0.55}px, ${tr.top - sr.top + tr.height * 0.6}px) rotate(-38deg)`;
}

function startIntro() {
  buildStage();
  const stage = $("#stage");
  const map = $("#introMap");
  const head = $(".at-pin__head", map);
  const pin = $(".at-pin", map);
  let cur = { avo: 50, anx: 50 };
  const place = () => {
    head.setAttribute("transform", `translate(${PX(cur.avo).toFixed(1)} ${PY(cur.anx).toFixed(1)})`);
    $('[data-s="x"]', map).setAttribute("d", `M${PX(cur.avo)} 262 L${PX(cur.avo)} ${PY(cur.anx)}`);
    $('[data-s="y"]', map).setAttribute("d", `M44 ${PY(cur.anx)} L${PX(cur.avo)} ${PY(cur.anx)}`);
    const bases = $$(".at-pin__base", map);
    bases[0].setAttribute("cx", PX(cur.avo));
    bases[1].setAttribute("cy", PY(cur.anx));
  };
  const sx = springValue(50, { stiffness: 90, damping: 9, onUpdate: (v) => ((cur.avo = v), place()) });
  const sy = springValue(50, { stiffness: 90, damping: 9, onUpdate: (v) => ((cur.anx = v), place()) });

  const rowScene = (n, no, text, pick) => async (signal) => {
    const row = $(`#row${n}`);
    row.classList.add("is-on");
    $$(".at-scale__n", row).forEach((x) => x.classList.remove("is-circled"));
    $(".at-row__no", row).textContent = `${no}. `;
    movePencil($(".at-row__q", row), stage);
    await typeInto($(".at-row__t", row), text, signal, 30);
    if (signal.aborted) return;
    const target = $(`.at-scale__n[data-v="${pick}"]`, row);
    movePencil(target, stage);
    await wait(380, signal);
    if (signal.aborted) return;
    target.classList.add("is-circled");
    $("#pencil").classList.add("is-scribble");
    await wait(500, signal);
    $("#pencil")?.classList.remove("is-scribble");
  };

  const scenes = [
    {
      duration: 2900,
      play(signal) {
        stage.dataset.scene = "1";
        $$(".at-row", stage).forEach((r) => {
          r.classList.remove("is-on");
          $(".at-row__t", r).textContent = "";
          $(".at-row__no", r).textContent = "";
          $$(".at-scale__n", r).forEach((x) => x.classList.remove("is-circled"));
        });
        $$(".at-map__q text", map).forEach((t) => t.classList.remove("is-hit"));
        pin.classList.remove("is-set");
        sx.jump(50);
        sy.jump(50);
        rowScene(1, "01", "연락이 평소보다 늦으면 마음이 조급해져요.", 4)(signal);
      },
    },
    { duration: 2700, play: (signal) => ((stage.dataset.scene = "2"), rowScene(2, "02", "너무 가까워지면 숨이 막히는 느낌이 들어요.", 2)(signal)) },
    {
      duration: 2600,
      play(signal) {
        stage.dataset.scene = "3";
        movePencil($(".at-mapbox", stage), stage);
        pin.classList.add("is-set");
        sx.set(28, -40);
        sy.set(63, 60);
        wait(900, signal).then(() => !signal.aborted && $('[data-q="anxious"]', map).classList.add("is-hit"));
      },
    },
    {
      duration: 2800,
      play() {
        stage.dataset.scene = "4";
        movePencil($("#introNote"), stage);
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
    const r = compute(last.answers);
    lr.hidden = false;
    lr.innerHTML = `지난 결과지 보기 · <b>${r.type.name}</b> (${fmtDate(last.t)})`;
  } else lr.hidden = true;
  startIntro();
}

/* ---------- 문항 ---------- */
const quiz = createQuiz({
  questions: QUESTIONS,
  onShow: renderQ,
  onDone: finish,
  onExit: () => history.back(),
});

const SHORT = ["전혀\n아니에요", "아닌\n편이에요", "보통\n이에요", "그런\n편이에요", "매우\n그래요"];

function renderTicks(idx, answers) {
  $("#quizTicks").innerHTML = QUESTIONS.map(
    (_, i) => `<li class="${i < idx || answers[i] != null ? "is-done" : ""} ${i === idx ? "is-now" : ""}">${answers[i] != null && i !== idx ? checkSVG() : ""}</li>`
  ).join("");
}

function renderQ({ q, idx, total, dir, selected, answers }) {
  $("#quizCount").textContent = `${String(idx + 1).padStart(2, "0")} / ${total}`;
  renderTicks(idx, answers);
  const wrap = $("#quizCard");
  wrap.innerHTML = `
    <div class="at-q ${dir < 0 ? "from-prev" : dir > 0 ? "from-next" : ""}">
      <p class="at-q__no">문항 ${String(idx + 1).padStart(2, "0")}</p>
      <p class="at-q__text"><span id="qText"></span><i class="at-caret"></i></p>
      <div class="at-scale at-scale--big" role="radiogroup" aria-label="${esc(q.q)}">
        ${q.options
          .map(
            (o, i) => `<button type="button" class="tk-option at-scale__btn" role="radio" aria-checked="${selected === i}" data-i="${i}" aria-label="${esc(o.t)}">
              <span class="at-scale__n ${selected === i ? "is-circled is-instant" : ""}">${i + 1}${loopSVG()}</span>
              <span class="at-scale__l">${SHORT[i].replace("\n", "<br />")}</span>
            </button>`
          )
          .join("")}
      </div>
      <p class="at-q__hint">요즘의 나, 혹은 가장 최근 관계를 떠올리며 골라 주세요.</p>
    </div>`;
  const textEl = $("#qText");
  if (dir === 0 || prefersReducedMotion()) textEl.textContent = q.q;
  else typeInto(textEl, q.q, null, 18);
  $$(".at-scale__btn", wrap).forEach((b) =>
    b.addEventListener("click", async () => {
      if (wrap.dataset.busy) return;
      wrap.dataset.busy = "1";
      haptic(8);
      textEl.textContent = q.q;
      $$(".at-scale__btn", wrap).forEach((x) => {
        x.setAttribute("aria-checked", String(x === b));
        $(".at-scale__n", x).classList.toggle("is-circled", x === b);
        $(".at-scale__n", x).classList.remove("is-instant");
      });
      await wait(prefersReducedMotion() ? 0 : 480);
      delete wrap.dataset.busy;
      quiz.pick(Number(b.dataset.i));
    })
  );
}

function startQuiz() {
  stopIntro();
  kit.clearUrl();
  history.pushState({ v: "quiz" }, "", kit.BASE);
  swapView("quiz");
  quiz.start();
}

function finish(answers) {
  kit.history.add({ answers });
  history.replaceState({ v: "result" }, "", kit.BASE);
  showResult({ answers }, { fresh: true });
}

/* ---------- 결과지 ---------- */
function scoreRow(ax, v) {
  return `<div class="at-score">
    <span class="at-score__name">${AXES[ax].name}</span>
    <span class="at-score__bar"><i style="--p:${v}"></i><em>50</em></span>
    <b class="at-score__v t-num">${v}</b>
  </div>`;
}

function sheet(r, { title, who, nameField = false, ghosts = [] }) {
  const ty = r.type;
  return `<div class="at-board">
    <span class="at-clip" aria-hidden="true"><i></i></span>
    <div class="at-paper at-paper--res">
      <header class="at-head">
        <p class="at-head__title at-head__title--sm">${esc(title)}</p>
        <p class="at-head__meta"><span>No. ${sheetNo(r.answers)}</span><span>작성일 ${today()}</span></p>
        ${
          nameField
            ? `<label class="at-namefield">이름 <input id="nick" maxlength="10" value="${esc(kit.getNick())}" placeholder="(선택) 링크에 붙일 이름" /></label>`
            : `<p class="at-namefield">이름 <b>${esc(who)}</b></p>`
        }
      </header>
      <div class="at-verdict">
        <p class="at-verdict__pre">점검 결과,</p>
        <h2 class="at-verdict__type">${ty.name}<span>에 가까워요</span>
          <svg class="at-under" viewBox="0 0 200 14" preserveAspectRatio="none" aria-hidden="true"><path d="M3 9 C 40 3, 80 12, 120 6 S 180 4, 197 8" pathLength="1" /></svg>
        </h2>
        <p class="at-verdict__line">${esc(ty.line)}</p>
      </div>
      <div class="at-mapbox at-mapbox--res">${mapSVG({ pins: [{ avo: r.avo, anx: r.anx, label: who }], ghosts })}</div>
      <div class="at-scores">${scoreRow("anx", r.anx)}${scoreRow("avo", r.avo)}</div>
      <p class="at-typed">${esc(ty.desc)}</p>
      <h3 class="at-h3">이럴 때 마음이 흔들려요</h3>
      <ul class="at-checks">${ty.shaky.map((x) => `<li><span class="at-box">${checkSVG()}</span>${esc(x)}</li>`).join("")}</ul>
      <h3 class="at-h3">이렇게 해 보면 좋아요</h3>
      <ol class="at-tries">${ty.try.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>
      <div class="at-sticky">
        <p class="at-sticky__label">상대에게 이렇게 말해 볼 수 있어요</p>
        <p class="at-sticky__say">“${esc(ty.say)}”</p>
      </div>
      <p class="at-gentle">이 점검지는 연구에서 쓰는 두 축(불안·회피)을 빌려 간단히 만든 자기점검이에요. 임상 검사나 진단이 아니고, 만나는 사람이나 요즘 상황에 따라 결과가 달라질 수 있어요.</p>
    </div>
  </div>`;
}

function historyBlock() {
  const list = kit.history.list().slice(-6).reverse();
  if (list.length < 1) return "";
  return `<section class="at-card at-hist">
    <h3 class="at-card__title">지난 점검 기록 <small>이 기기에만 남아요</small></h3>
    <table class="at-table at-table--hist">
      <thead><tr><th>날짜</th><th>불안</th><th>회피</th><th>결과</th></tr></thead>
      <tbody>${list
        .map((h) => {
          const r = compute(h.answers);
          return `<tr><td>${fmtDate(h.t, true)}</td><td>${r.anx}</td><td>${r.avo}</td><td>${r.type.name}</td></tr>`;
        })
        .join("")}</tbody>
    </table>
  </section>`;
}

function compareBlock(me, fr) {
  const fname = fr.name || "상대";
  const meName = kit.getNick() || "나";
  return `<section class="at-card at-pair">
    <h3 class="at-card__title">함께 보는 관계 지도 <small>${esc(meName)} · ${esc(fname)}</small></h3>
    <div class="at-mapbox">${mapSVG({ pins: [{ avo: me.avo, anx: me.anx, label: meName }, { avo: fr.r.avo, anx: fr.r.anx, label: fname }], link: true })}</div>
    <table class="at-table at-table--pair">
      <thead><tr><th></th><th>${esc(meName)}</th><th>${esc(fname)}</th></tr></thead>
      <tbody>
        <tr><th>유형</th><td>${me.type.name}</td><td>${fr.r.type.name}</td></tr>
        <tr><th>불안</th><td>${me.anx}</td><td>${fr.r.anx}</td></tr>
        <tr><th>회피</th><td>${me.avo}</td><td>${fr.r.avo}</td></tr>
      </tbody>
    </table>
    <p class="at-pair__note">${esc(pairNote(me.type, fr.r.type))}</p>
    <button type="button" class="at-link" id="clearFriend">지도에서 ${esc(fname)} 핀 빼기</button>
  </section>`;
}

function inviteBlock() {
  return `<section class="at-card at-invite">
    <h3 class="at-card__title">함께 보기</h3>
    <p>결과 링크를 받은 사람이 점검을 마치면, 같은 지도에 두 핀을 꽂고 실로 이어 드려요. 상대가 보낸 결과 링크를 열어도 돼요.</p>
    <div class="tk-paste"><input class="at-input" id="pasteFriend" inputmode="url" placeholder="상대 결과 링크 붙여넣기" /><button type="button" class="at-tab at-tab--sm" id="pasteGo">핀 꽂기</button></div>
  </section>`;
}

function animateSheet(view, fresh) {
  const pins = $$(".at-pin", view);
  pins.forEach((p, i) => setTimeout(() => p.classList.add("is-set"), (fresh ? 500 : 150) + i * 350));
  setTimeout(() => $$(".at-under, .at-map__link", view).forEach((u) => u.classList.add("is-drawn")), fresh ? 900 : 300);
  $$(".at-score__bar i", view).forEach((b) => b.classList.add("is-grow"));
}

function showResult(entry, { fresh = false } = {}) {
  stopIntro();
  const r = compute(entry.answers);
  const fr = kit.friend.get();
  const friend = fr ? { ...fr, r: compute(fr.answers) } : null;
  const past = kit.history
    .list()
    .slice(0, -1)
    .slice(-3)
    .map((h) => ({ ...compute(h.answers), label: fmtDate(h.t) }));
  const view = $('[data-view="result"]');
  const nick = kit.getNick();
  view.innerHTML = `
    <div class="at-topbar"><button type="button" class="at-back" id="resHome">← 처음으로</button></div>
    ${sheet(r, { title: "관계 자기점검 결과지", who: nick || "나", nameField: true, ghosts: fresh ? past : [] })}
    <div class="at-tabs">
      <button type="button" class="at-tab" id="shareLink"><span class="at-tab__clip" aria-hidden="true"></span>결과 링크 보내기</button>
      <button type="button" class="at-tab at-tab--alt" id="shareImg"><span class="at-tab__clip" aria-hidden="true"></span>결과지 이미지 저장</button>
    </div>
    ${friend ? compareBlock(r, friend) : inviteBlock()}
    ${historyBlock()}
    <button type="button" class="at-check at-check--again" id="again">
      <span class="at-check__box"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M8 21 L17 30 L34 8" pathLength="1" /></svg></span>
      <span class="at-check__text">새 점검지로 다시 하기</span>
    </button>`;
  swapView("result");
  animateSheet(view, fresh);

  $("#resHome").onclick = () => goIntro();
  $("#again").onclick = (e) => tickThen(e.currentTarget, startQuiz);
  const nickEl = $("#nick");
  nickEl.addEventListener("change", () => kit.setNick(nickEl.value));
  $("#shareLink").onclick = () => {
    kit.setNick(nickEl.value);
    haptic();
    kit.shareLink(entry, { text: `내 애착 유형 점검 결과는 ${r.type.name} 쪽이래. 우리 지도에 같이 놓아 볼래?` });
  };
  $("#shareImg").onclick = async (ev) => {
    const b = ev.currentTarget;
    b.classList.add("is-loading");
    try {
      kit.setNick(nickEl.value);
      await kit.shareCard((ctx, W, H) => drawCard(ctx, W, H, r, kit.getNick() || "나"), {
        filename: `attachment-${r.type.id}.png`,
        text: `애착 유형 자기점검: ${r.type.name}에 가까워요`,
      });
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
      if (f.mine) return toast("내 결과 링크예요. 상대 링크를 붙여 주세요");
      kit.friend.set(f);
      showResult(entry);
      toast("같은 지도에 핀을 꽂았어요");
    };
}

/* ---------- 받은 결과지 ---------- */
function showFriend(f) {
  stopIntro();
  const r = compute(f.answers);
  const who = f.name || "친구";
  const mine = kit.history.latest();
  const view = $('[data-view="friend"]');
  view.innerHTML = `
    <div class="at-topbar"><p class="at-topbar__from">${esc(who)}${josa(who, "이/가")} 보낸 결과지</p></div>
    <div class="at-card at-dare">
      <h3 class="at-card__title">함께 점검하기</h3>
      <p>${esc(who)}${josa(who, "은/는")} <b>${r.type.name}</b> 쪽이에요. 나도 점검하면 같은 지도에 두 핀을 꽂아 볼 수 있어요.</p>
      <button type="button" class="at-check" id="friendGo">
        <span class="at-check__box"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M8 21 L17 30 L34 8" pathLength="1" /></svg></span>
        <span class="at-check__text">나도 점검해 볼게요</span>
        <span class="at-check__meta">16문항 · 약 3분</span>
      </button>
      ${mine ? `<button type="button" class="at-link" id="friendCmp">지난 내 결과와 같은 지도에 놓기 →</button>` : ""}
    </div>
    ${sheet(r, { title: `${who}의 관계 자기점검 결과지`, who })}`;
  swapView("friend");
  animateSheet(view, true);
  $("#friendGo").onclick = (e) => tickThen(e.currentTarget, startQuiz);
  const cmp = $("#friendCmp");
  if (cmp)
    cmp.onclick = () => {
      kit.clearUrl();
      history.pushState({ v: "result" }, "", kit.BASE);
      showResult(mine);
    };
}

/* ---------- 결과지 이미지 (1080×1350) ---------- */
function drawCard(ctx, W, H, r, who) {
  const c = {
    board: tok("--art-board"),
    paper: tok("--art-paper"),
    rule: tok("--art-rule"),
    margin: tok("--art-margin"),
    lead: tok("--art-lead"),
    string: tok("--brand"),
    note: tok("--art-note"),
    metal: tok("--art-metal"),
  };
  const hand = `"Gaegu", ${CANVAS_FONT}`;
  const typed = `"Nanum Gothic Coding", "D2Coding", ui-monospace, monospace`;
  ctx.fillStyle = c.board;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = c.paper;
  ctx.fillRect(28, 44, W - 56, H - 72);
  // 줄
  ctx.strokeStyle = c.rule;
  ctx.lineWidth = 1;
  for (let y = 110; y < H - 40; y += 26) {
    ctx.beginPath();
    ctx.moveTo(28, y);
    ctx.lineTo(W - 28, y);
    ctx.stroke();
  }
  ctx.strokeStyle = c.margin;
  ctx.beginPath();
  ctx.moveTo(66, 44);
  ctx.lineTo(66, H - 28);
  ctx.stroke();
  // 클립
  ctx.fillStyle = c.metal;
  ctx.fillRect(W / 2 - 70, 26, 140, 34);
  ctx.fillStyle = c.board;
  ctx.fillRect(W / 2 - 30, 34, 60, 10);

  ctx.fillStyle = c.lead;
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 18px ${typed}`;
  ctx.fillText("관계 자기점검 결과지", 80, 96);
  ctx.font = `400 13px ${typed}`;
  ctx.fillText(`No. ${sheetNo(r.answers)}   작성일 ${today()}   이름 ${who}`, 80, 120);

  ctx.font = `700 46px ${hand}`;
  ctx.fillText(`${r.type.name}에 가까워요`, 80, 182);
  ctx.strokeStyle = c.string;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(80, 194);
  ctx.bezierCurveTo(160, 186, 260, 200, 380, 190);
  ctx.stroke();
  ctx.font = `400 15px ${typed}`;
  ctx.fillText(r.type.line, 80, 224);

  // 지도
  const ox = 120;
  const oy = 250;
  const S = 300;
  ctx.fillStyle = c.paper;
  ctx.fillRect(ox, oy, S, S);
  ctx.strokeStyle = c.rule;
  for (let i = 0; i <= 10; i++) {
    ctx.beginPath();
    ctx.moveTo(ox + (i * S) / 10, oy);
    ctx.lineTo(ox + (i * S) / 10, oy + S);
    ctx.moveTo(ox, oy + (i * S) / 10);
    ctx.lineTo(ox + S, oy + (i * S) / 10);
    ctx.stroke();
  }
  ctx.strokeStyle = c.lead;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(ox, oy, S, S);
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(ox + S / 2, oy);
  ctx.lineTo(ox + S / 2, oy + S);
  ctx.moveTo(ox, oy + S / 2);
  ctx.lineTo(ox + S, oy + S / 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = `700 20px ${hand}`;
  ctx.fillStyle = c.lead;
  ctx.fillText("불안형", ox + 10, oy + 26);
  ctx.fillText("안정형", ox + 10, oy + S - 12);
  ctx.textAlign = "right";
  ctx.fillText("혼란형", ox + S - 10, oy + 26);
  ctx.fillText("회피형", ox + S - 10, oy + S - 12);
  ctx.font = `400 12px ${typed}`;
  ctx.fillText("회피 →", ox + S, oy + S + 18);
  ctx.textAlign = "left";
  ctx.save();
  ctx.translate(ox - 10, oy + S);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("불안 →", 0, 0);
  ctx.restore();
  const px = ox + (r.avo / 100) * S;
  const py = oy + S - (r.anx / 100) * S;
  ctx.strokeStyle = c.string;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(px, oy + S);
  ctx.lineTo(px, py);
  ctx.lineTo(ox, py);
  ctx.stroke();
  ctx.fillStyle = c.string;
  ctx.beginPath();
  ctx.arc(px, py, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.6)";
  ctx.beginPath();
  ctx.arc(px - 3, py - 3, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // 점수
  ctx.fillStyle = c.lead;
  ctx.font = `700 16px ${typed}`;
  ctx.fillText(`불안 ${r.anx} / 100`, 80, 600);
  ctx.fillText(`회피 ${r.avo} / 100`, 300, 600);
  ctx.font = `400 12px ${typed}`;
  wrapText(ctx, "간단한 자기점검이에요. 임상 검사나 진단이 아니에요.", 80, 622, W - 160, 18);
  ctx.fillText(`${location.host}${location.pathname}`, 80, H - 22);
}

/* ---------- 체크박스 버튼 ---------- */
function tickThen(btn, fn) {
  if (btn.dataset.busy) return;
  btn.dataset.busy = "1";
  haptic([8, 30, 8]);
  btn.classList.add("is-ticked");
  setTimeout(() => {
    delete btn.dataset.busy;
    btn.classList.remove("is-ticked");
    fn();
  }, prefersReducedMotion() ? 0 : 520);
}

/* ---------- 연결 ---------- */
function route() {
  const f = kit.fromUrl();
  if (f && f.mine) {
    kit.clearUrl();
    return showResult({ answers: f.answers });
  }
  if (f) {
    kit.friend.set(f);
    return showFriend(f);
  }
  goIntro();
}

$("#start").onclick = (e) => tickThen(e.currentTarget, startQuiz);
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
dressHandout($("#more"));

// 하단 다른 도구: 상담실에서 나눠 주는 "함께 읽을 자료" 복사본
function dressHandout(nav) {
  if (!nav) return;
  const title = nav.querySelector(".more-sites__title");
  if (title) title.innerHTML = `함께 읽을 자료 <small>복사본 · 가져가셔도 돼요</small>`;
  nav.querySelectorAll(".more-sites__item").forEach((a, i) => {
    const no = document.createElement("span");
    no.className = "at-ref__no";
    no.setAttribute("aria-hidden", "true");
    no.textContent = `자료 ${i + 1}`;
    const go = document.createElement("span");
    go.className = "at-ref__go";
    go.setAttribute("aria-hidden", "true");
    go.textContent = "→";
    a.prepend(no);
    a.append(go);
  });
}
