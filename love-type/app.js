import { $, $$, haptic, toast, renderCrumb, renderMoreSites, CANVAS_FONT, wrapText, prefersReducedMotion } from "../shared/kit.js";
import { createQuiz, tally, createResultKit, swapView, loopScenes, wait, esc, josa, fmtDate, tok, rotated } from "../test-kit/engine.js";
import { QUESTIONS, AXES, TYPES, typeByKey, typeByCode, relation } from "./data.js";
import { animalSVG, animalImage, ensureDefs } from "./art.js";

const kit = createResultKit({ slug: "love-type", questions: QUESTIONS, title: "연애 세포 테스트" });
ensureDefs();

/* ---------- 계산 ---------- */
function compute(answers) {
  const t = tally(QUESTIONS, answers);
  const axes = AXES.map((ax) => {
    const va = t.sum[ax.a] || 0;
    const vb = t.sum[ax.b] || 0;
    return { ...ax, va, vb, letter: va > vb ? ax.a : ax.b, pa: va + vb ? Math.round((va / (va + vb)) * 100) : 50 };
  });
  const code = axes.map((a) => a.letter).join("");
  return { answers, axes, code, type: typeByCode(code) };
}

const fmtNum = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/* ---------- 수집 기록 ---------- */
function collection() {
  const got = {};
  kit.history.list().forEach((h) => {
    const r = compute(h.answers);
    const k = r.type.key;
    got[k] = got[k] || { n: 0, first: h.t, last: h, t: h.t };
    got[k].n++;
    got[k].last = h;
    got[k].t = h.t;
  });
  const seen = kit.store.get("seen", []) || [];
  return { got, seen };
}

function markSeen(key) {
  const seen = kit.store.get("seen", []) || [];
  if (!seen.includes(key)) {
    seen.push(key);
    kit.store.set("seen", seen);
  }
}

function shelfGrid({ mini = false } = {}) {
  const { got, seen } = collection();
  return `<ol class="lt-shelf-grid ${mini ? "is-mini" : ""}">${TYPES.map((t) => {
    const g = got[t.key];
    const s = !g && seen.includes(t.key);
    return `<li class="lt-cell ${g ? "is-got" : s ? "is-seen" : ""}">
      <button type="button" class="lt-cell__btn" data-key="${t.key}" ${g ? "" : "disabled"} aria-label="${g ? `${t.name} 표본 보기` : "미발견"}">
        <span class="lt-cell__no">${t.plate}</span>
        ${animalSVG(t.key, { silhouette: !g && !s, cls: "lt-cell__art" })}
        <span class="lt-cell__name">${g || s ? t.name : "미발견"}</span>
        ${!mini && g ? `<span class="lt-cell__meta">${g.n}회 · ${fmtDate(g.t)}</span>` : ""}
        ${!mini && s ? `<span class="lt-cell__meta">친구에게서 관찰</span>` : ""}
      </button>
    </li>`;
  }).join("")}</ol>`;
}

function bindShelf(root) {
  const { got } = collection();
  $$(".lt-cell__btn", root).forEach((b) => {
    b.onclick = () => {
      const g = got[b.dataset.key];
      if (!g) return;
      history.pushState({ v: "result" }, "", kit.BASE);
      showResult(g.last);
    };
  });
}

/* ---------- 인트로 ---------- */
let intro = null;
const DEMO = [
  { key: "retriever", q: "07", text: "연인이 새 옷을 입고 나왔어요.", a: "\"오 진짜 잘 어울린다!\" 바로 말해요" },
  { key: "fox", q: "02", text: "처음 만난 날, 이 사람이다 싶은 느낌은요?", a: "3초 만에 와요" },
  { key: "penguin", q: "03", text: "연인과 보내는 이상적인 주말은요?", a: "이틀 내내 붙어 있어도 좋아요" },
];

function buildStage() {
  $("#stage").innerHTML = `
    <div class="lt-plate" id="plate">
      <span class="lt-plate__no">PLATE <b id="pNo">I</b></span>
      <div class="lt-plate__leaf" id="pLeaf"><div class="lt-plate__art" id="pArt"></div></div>
      <div class="lt-tag" id="pTag">
        <span class="lt-tag__hole"></span>
        <b id="pName">리트리버</b><i id="pLatin">Canis devotus</i><span id="pCode">D · F · C</span>
      </div>
      <span class="lt-stamp" id="pStamp">분류 완료</span>
    </div>
    <div class="lt-fieldnote" id="note">
      <span class="lt-fieldnote__no">관찰 항목 <b id="nNo">07</b> / 12</span>
      <p class="lt-fieldnote__q" id="nQ"></p>
      <p class="lt-fieldnote__a" id="nA"><span class="lt-fieldnote__box"></span><span id="nAT"></span></p>
    </div>
    <div class="lt-strip">
      <span class="lt-strip__label">나의 도감</span>
      <ol id="strip">${TYPES.map((t) => `<li data-key="${t.key}">${animalSVG(t.key, { silhouette: true })}${animalSVG(t.key, { cls: "is-full" })}</li>`).join("")}</ol>
    </div>`;
}

function setPlate(t) {
  $("#pNo").textContent = t.plate;
  $("#pArt").innerHTML = animalSVG(t.key);
  $("#pName").textContent = t.name;
  $("#pLatin").textContent = t.latin;
  $("#pCode").textContent = [...t.code].join(" · ");
}

function startIntro() {
  buildStage();
  const stage = $("#stage");
  const leaf = $("#pLeaf");
  const tag = $("#pTag");
  const note = $("#note");
  const turn = async (t, signal, first) => {
    if (!first) {
      leaf.classList.remove("is-in");
      leaf.classList.add("is-out");
      tag.classList.remove("is-in");
      await wait(300, signal);
      if (signal.aborted) return;
    }
    setPlate(t);
    leaf.classList.remove("is-out");
    void leaf.offsetWidth;
    leaf.classList.add("is-in");
    await wait(380, signal);
    if (signal.aborted) return;
    tag.classList.add("is-in");
  };
  const noteIn = async (d, signal) => {
    note.classList.remove("is-in", "is-checked");
    $("#nNo").textContent = d.q;
    $("#nQ").textContent = d.text;
    $("#nAT").textContent = d.a;
    void note.offsetWidth;
    note.classList.add("is-in");
    await wait(900, signal);
    if (!signal.aborted) note.classList.add("is-checked");
  };
  const collect = (key) => $(`#strip [data-key="${key}"]`)?.classList.add("is-got");
  const scenes = DEMO.map((d, i) => ({
    duration: i === 2 ? 2700 : 2500,
    play(signal) {
      stage.dataset.scene = String(i + 1);
      if (i === 0) {
        $$("#strip li").forEach((li) => li.classList.remove("is-got"));
        $("#pStamp").classList.remove("is-on");
      }
      turn(typeByKey(d.key), signal, i === 0);
      noteIn(d, signal);
      wait(1500, signal).then(() => !signal.aborted && collect(d.key));
    },
  }));
  scenes.push({
    duration: 2600,
    play() {
      stage.dataset.scene = "4";
      $("#pStamp").classList.add("is-on");
      note.classList.remove("is-in");
      $("#nNo").textContent = "12";
      $("#nQ").textContent = "펭귄 · 공생 관계: 고슴도치";
      $("#nAT").textContent = "천적 관계: 여우";
      void note.offsetWidth;
      note.classList.add("is-in", "is-checked");
    },
  });
  intro?.stop();
  intro = loopScenes(scenes);
}

function stopIntro() {
  intro?.stop();
  intro = null;
}

function goIntro() {
  swapView("intro");
  const { got } = collection();
  const n = Object.keys(got).length;
  const btn = $("#openShelf");
  btn.hidden = !n;
  btn.innerHTML = `내 도감 보기 <b>${n} / 8종</b>`;
  startIntro();
}

/* ---------- 관찰 일지 (문항) ---------- */
const quiz = createQuiz({
  questions: QUESTIONS,
  onShow: renderQ,
  onDone: finish,
  onExit: () => history.back(),
});

function renderQ({ q, idx, total, dir, selected }) {
  $("#quizCount").textContent = `관찰 항목 ${String(idx + 1).padStart(2, "0")} / ${total}`;
  $("#quizRuler").style.width = `${(idx / total) * 100}%`;
  if (!$("#quizTicks").childElementCount) $("#quizTicks").innerHTML = QUESTIONS.map((_, i) => `<i>${i % 3 === 0 ? i : ""}</i>`).join("") + "<i>12</i>";
  const ax = AXES[q.ax];
  const wrap = $("#quizCard");
  wrap.innerHTML = `
    <div class="lt-q ${dir < 0 ? "from-prev" : dir > 0 ? "from-next" : ""}">
      <p class="lt-q__habit">습성 · ${ax.name}</p>
      <h2 class="lt-q__text">${esc(q.q)}</h2>
      <div class="lt-q__opts">
        ${q.options
          .map(
            (o, i) => `<button type="button" class="tk-option lt-opt" data-i="${i}" aria-pressed="${selected === i}">
              <span class="lt-opt__hole" aria-hidden="true"></span>
              <span class="lt-opt__key">${i ? "B" : "A"}</span>
              <span class="lt-opt__t">${esc(o.t)}</span>
            </button>`
          )
          .join("")}
      </div>
      <p class="lt-q__memo">맞는 쪽 꼬리표를 골라 주세요. 딱 맞지 않으면 더 가까운 쪽으로.</p>
    </div>`;
  $$(".lt-opt", wrap).forEach((b) =>
    b.addEventListener("click", async () => {
      if (wrap.dataset.busy) return;
      wrap.dataset.busy = "1";
      haptic(8);
      $$(".lt-opt", wrap).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      $("#quizRuler").style.width = `${((idx + 1) / total) * 100}%`;
      await wait(prefersReducedMotion() ? 0 : 420);
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
  const before = Object.keys(collection().got);
  kit.history.add({ answers });
  history.replaceState({ v: "result" }, "", kit.BASE);
  const r = compute(answers);
  showResult({ answers }, { fresh: true, isNew: !before.includes(r.type.key) });
}

/* ---------- 표본 페이지 ---------- */
function measure(r) {
  return `<div class="lt-measure">
    ${r.axes
      .map(
        (a) => `<div class="lt-measure__row">
          <span class="lt-measure__l ${a.letter === a.a ? "is-on" : ""}">${a.la}<small>${fmtNum(a.va)}</small></span>
          <span class="lt-measure__bar"><i style="--p:${a.pa}"></i></span>
          <span class="lt-measure__r ${a.letter === a.b ? "is-on" : ""}"><small>${fmtNum(a.vb)}</small>${a.lb}</span>
        </div>`
      )
      .join("")}
  </div>`;
}

function plate(r, { collector, date, isNew = false }) {
  const t = r.type;
  const best = typeByKey(t.best);
  const worst = typeByKey(t.worst);
  return `<article class="lt-page lt-plateview">
    <p class="lt-plateview__no">PLATE ${t.plate} <span>연애 동물 도감</span></p>
    <h2 class="lt-plateview__name">${t.name}<small>형</small></h2>
    <p class="lt-plateview__latin"><i>${t.latin}</i></p>
    <figure class="lt-figure">
      ${animalSVG(t.key, { cls: "lt-figure__art" })}
      <figcaption class="lt-tag lt-tag--pinned is-in">
        <span class="lt-tag__hole"></span>
        <b>No. ${t.plate} · ${[...t.code].join("")}</b>
        <span>채집자 ${esc(collector)}</span>
        <span>채집일 ${date}</span>
      </figcaption>
      ${isNew ? `<span class="lt-stamp is-on lt-stamp--new">신종 등록</span>` : ""}
    </figure>
    <p class="lt-plateview__head">“${esc(t.head)}”</p>
    <p class="lt-plateview__desc">${esc(t.desc)}</p>
    <table class="lt-facts">
      <tbody>
        <tr><th>서식지</th><td>${esc(t.habitat)}</td></tr>
        <tr><th>좋아하는 먹이</th><td>${esc(t.food)}</td></tr>
        <tr><th>경계 신호</th><td>${esc(t.alarm)}</td></tr>
        <tr><th>관찰 메모</th><td class="lt-facts__hand">${esc(t.note)}</td></tr>
      </tbody>
    </table>
    <h3 class="lt-h3">계측 기록</h3>
    ${measure(r)}
    <h3 class="lt-h3">관계</h3>
    <div class="lt-rel">
      <div class="lt-rel__card"><span class="lt-rel__k">공생</span>${animalSVG(best.key, { cls: "lt-rel__art" })}<b>${best.name}</b><i>${best.latin}</i></div>
      <div class="lt-rel__card is-worst"><span class="lt-rel__k">천적</span>${animalSVG(worst.key, { cls: "lt-rel__art" })}<b>${worst.name}</b><i>${worst.latin}</i></div>
    </div>
  </article>`;
}

function compareBlock(me, fr) {
  const fname = fr.name || "친구";
  const meName = kit.getNick() || "나";
  const rel = relation(me.type, fr.r.type);
  return `<section class="lt-page lt-pair">
    <p class="lt-pair__k">두 표본 비교</p>
    <div class="lt-pair__row">
      <div class="lt-pair__col">${animalSVG(me.type.key, { cls: "lt-pair__art" })}<b>${me.type.name}</b><span>${esc(meName)}</span></div>
      <span class="lt-pair__rel">${rel.label}</span>
      <div class="lt-pair__col">${animalSVG(fr.r.type.key, { cls: "lt-pair__art" })}<b>${fr.r.type.name}</b><span>${esc(fname)}</span></div>
    </div>
    <p class="lt-pair__note">${esc(rel.note)}</p>
    <table class="lt-table lt-table--pair">
      <thead><tr><th>습성</th><th>${esc(meName)}</th><th>${esc(fname)}</th></tr></thead>
      <tbody>${me.axes
        .map((a, i) => {
          const b = fr.r.axes[i];
          const lab = (x) => (x.letter === x.a ? x.la : x.lb);
          return `<tr><th>${a.name}</th><td>${lab(a)}</td><td class="${a.letter === b.letter ? "" : "is-diff"}">${lab(b)}</td></tr>`;
        })
        .join("")}</tbody>
    </table>
    <button type="button" class="lt-link" id="clearFriend">비교 표본 치우기</button>
  </section>`;
}

function inviteBlock() {
  return `<section class="lt-page lt-invite">
    <p class="lt-pair__k">두 표본 비교</p>
    <p>내 표본 라벨을 받은 친구가 관찰을 마치면, 두 동물을 나란히 놓고 공생인지 천적인지 알려 드려요. 친구 결과 링크를 열어도 돼요.</p>
    <div class="tk-paste"><input class="lt-input" id="pasteFriend" inputmode="url" placeholder="친구 결과 링크 붙여넣기" /><button type="button" class="lt-tagbtn lt-tagbtn--sm" id="pasteGo">비교</button></div>
  </section>`;
}

function showResult(entry, { fresh = false, isNew = false } = {}) {
  stopIntro();
  const r = compute(entry.answers);
  const fr = kit.friend.get();
  const friend = fr ? { ...fr, r: compute(fr.answers) } : null;
  const nick = kit.getNick();
  const { got } = collection();
  const view = $('[data-view="result"]');
  view.innerHTML = `
    <div class="lt-topline">
      <button type="button" class="lt-back" id="resHome">← 처음으로</button>
      <button type="button" class="lt-back" id="resShelf">내 도감 ${Object.keys(got).length} / 8</button>
    </div>
    ${plate(r, { collector: nick || "나", date: fmtDate(entry.t || Date.now(), true), isNew })}
    <section class="lt-sharebox">
      <label class="lt-nick">채집자 이름 <input class="lt-input" id="nick" maxlength="10" value="${esc(nick)}" placeholder="(선택) 라벨에 적을 이름" /></label>
      <div class="lt-sharebox__row">
        <button type="button" class="lt-tagbtn" id="shareLink"><span class="lt-tagbtn__hole"></span>표본 라벨 보내기</button>
        <button type="button" class="lt-tagbtn lt-tagbtn--alt" id="shareImg"><span class="lt-tagbtn__hole"></span>도감 페이지 저장</button>
      </div>
    </section>
    ${friend ? compareBlock(r, friend) : inviteBlock()}
    <section class="lt-page lt-mini-shelf">
      <p class="lt-pair__k">나의 도감 <b>${Object.keys(got).length} / 8종</b></p>
      ${shelfGrid({ mini: true })}
    </section>
    <button type="button" class="lt-cover lt-cover--again" id="again">
      <span class="lt-cover__board"><span class="lt-cover__frame"><span class="lt-cover__title">다시 관찰하기</span><span class="lt-cover__meta">다른 동물이 나올 수도 있어요</span></span></span>
      <span class="lt-cover__pages" aria-hidden="true"></span>
    </button>`;
  swapView("result");
  if (fresh) $(".lt-plateview", view).classList.add("is-fresh");
  bindShelf(view);

  $("#resHome").onclick = () => goIntro();
  $("#resShelf").onclick = () => showShelf();
  $("#again").onclick = (e) => openCover(e.currentTarget, startQuiz);
  const nickEl = $("#nick");
  nickEl.addEventListener("change", () => kit.setNick(nickEl.value));
  $("#shareLink").onclick = () => {
    kit.setNick(nickEl.value);
    haptic();
    kit.shareLink(entry, { text: `연애할 때 나는 ${r.type.name}형 (${r.type.latin})이래. 너는 무슨 동물이야?` });
  };
  $("#shareImg").onclick = async (ev) => {
    const b = ev.currentTarget;
    b.classList.add("is-loading");
    try {
      kit.setNick(nickEl.value);
      const img = await animalImage(r.type.key, { ink: tok("--art-ink"), paper: tok("--art-paper") });
      await kit.shareCard((ctx, W, H) => drawCard(ctx, W, H, r, img, kit.getNick() || "나"), {
        filename: `love-type-${r.type.key}.png`,
        text: `연애 동물 도감: ${r.type.name}형`,
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
      if (f.mine) return toast("내 결과 링크예요. 친구 링크를 붙여 주세요");
      kit.friend.set(f);
      markSeen(compute(f.answers).type.key);
      showResult(entry);
      toast("두 표본을 나란히 놓았어요");
    };
}

/* ---------- 내 도감 ---------- */
function showShelf() {
  stopIntro();
  const { got } = collection();
  const view = $('[data-view="shelf"]');
  view.innerHTML = `
    <div class="lt-topline"><button type="button" class="lt-back" id="shelfBack">← 돌아가기</button></div>
    <section class="lt-page">
      <p class="lt-plateview__no">INDEX <span>연애 동물 도감</span></p>
      <h2 class="lt-plateview__name">나의 도감<small>${Object.keys(got).length} / 8종</small></h2>
      <p class="lt-shelf-note">테스트할 때마다 나온 동물이 채워져요. 친구 링크로 본 동물은 연하게 표시돼요.</p>
      ${shelfGrid()}
    </section>`;
  swapView("shelf");
  bindShelf(view);
  $("#shelfBack").onclick = () => history.back();
  history.pushState({ v: "shelf" }, "", kit.BASE);
}

/* ---------- 친구 표본 ---------- */
function showFriend(f) {
  stopIntro();
  const r = compute(f.answers);
  markSeen(r.type.key);
  const who = f.name || "친구";
  const mine = kit.history.latest();
  const view = $('[data-view="friend"]');
  view.innerHTML = `
    <div class="lt-topline"><span class="lt-topline__from">${esc(who)}${josa(who, "이/가")} 보낸 표본</span></div>
    <section class="lt-page lt-dare">
      <p>${esc(who)}${josa(who, "은/는")} <b>${r.type.name}형</b>이래요. 나도 관찰을 마치면 두 동물이 공생인지 천적인지 알려 드려요.</p>
      <button type="button" class="lt-cover" id="friendGo">
        <span class="lt-cover__board"><span class="lt-cover__frame"><span class="lt-cover__small">FIELD GUIDE</span><span class="lt-cover__title">나도 도감 펼치기</span><span class="lt-cover__meta">관찰 12항목 · 약 2분</span></span></span>
        <span class="lt-cover__pages" aria-hidden="true"></span>
      </button>
      ${mine ? `<button type="button" class="lt-link" id="friendCmp">지난 내 표본과 바로 비교하기 →</button>` : ""}
    </section>
    ${plate(r, { collector: who, date: fmtDate(Date.now(), true) })}`;
  swapView("friend");
  $("#friendGo").onclick = (e) => openCover(e.currentTarget, startQuiz);
  const cmp = $("#friendCmp");
  if (cmp)
    cmp.onclick = () => {
      kit.clearUrl();
      history.pushState({ v: "result" }, "", kit.BASE);
      showResult(mine);
    };
}

/* ---------- 도감 페이지 이미지 (1080×1350) ---------- */
function drawCard(ctx, W, H, r, img, who) {
  const c = { paper: tok("--art-paper"), ink: tok("--art-ink"), soft: tok("--art-ink-soft"), cloth: tok("--brand"), gold: tok("--art-gold"), tag: tok("--art-tag") };
  const serif = `"Song Myung", "Nanum Myeongjo", Georgia, serif`;
  const latin = `"IM Fell English", Georgia, "Times New Roman", serif`;
  const t = r.type;
  ctx.fillStyle = c.cloth;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = c.paper;
  ctx.fillRect(18, 18, W - 36, H - 36);
  ctx.strokeStyle = c.ink;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(34, 34, W - 68, H - 68);
  ctx.lineWidth = 0.6;
  ctx.strokeRect(40, 40, W - 80, H - 80);

  ctx.fillStyle = c.soft;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `400 15px ${latin}`;
  ctx.fillText(`PLATE ${t.plate}  ·  BESTIARIUM AMORIS`, W / 2, 76);
  ctx.fillStyle = c.ink;
  ctx.font = `400 50px ${serif}`;
  ctx.fillText(`${t.name}형`, W / 2, 136);
  ctx.font = `italic 400 22px ${latin}`;
  ctx.fillText(t.latin, W / 2, 168);

  if (img) ctx.drawImage(img, 90, 180, 360, 288);
  // 꼬리표
  rotated(ctx, 372, 420, -6, () => {
    ctx.fillStyle = c.tag;
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-12, -26);
    ctx.lineTo(110, -26);
    ctx.lineTo(110, 26);
    ctx.lineTo(-12, 26);
    ctx.lineTo(-30, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-14, 0, 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = c.ink;
    ctx.textAlign = "left";
    ctx.font = `600 13px ${CANVAS_FONT}`;
    ctx.fillText(`No.${t.plate} · ${t.code}`, 0, -6);
    ctx.font = `400 12px ${CANVAS_FONT}`;
    ctx.fillText(`채집자 ${who}`.slice(0, 12), 0, 14);
  });

  ctx.textAlign = "center";
  ctx.fillStyle = c.ink;
  ctx.font = `400 21px ${serif}`;
  wrapText(ctx, `“${t.head}”`, W / 2, 504, W - 120, 28);

  r.axes.forEach((a, i) => {
    const y = 552 + i * 22;
    ctx.font = `600 13px ${CANVAS_FONT}`;
    ctx.textAlign = "right";
    ctx.fillStyle = a.letter === a.a ? c.ink : c.soft;
    ctx.fillText(a.la, 168, y + 4);
    ctx.textAlign = "left";
    ctx.fillStyle = a.letter === a.b ? c.ink : c.soft;
    ctx.fillText(a.lb, 372, y + 4);
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(180, y);
    ctx.lineTo(360, y);
    ctx.stroke();
    const x = 180 + (180 * (100 - a.pa)) / 100;
    ctx.fillStyle = c.cloth;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.textAlign = "center";
  ctx.fillStyle = c.soft;
  ctx.font = `400 12px ${CANVAS_FONT}`;
  ctx.fillText(`연애 세포 테스트 · ${location.host}${location.pathname}`, W / 2, H - 50);
}

/* ---------- 표지 버튼 ---------- */
function openCover(btn, fn) {
  if (btn.dataset.busy) return;
  btn.dataset.busy = "1";
  haptic([6, 24, 10]);
  btn.classList.add("is-open");
  setTimeout(() => {
    delete btn.dataset.busy;
    btn.classList.remove("is-open");
    fn();
  }, prefersReducedMotion() ? 0 : 560);
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

renderCrumb($("#crumb"));
$("#start").onclick = (e) => openCover(e.currentTarget, startQuiz);
$("#openShelf").onclick = () => showShelf();
$("#quizBack").onclick = () => quiz.back();
window.addEventListener("popstate", (e) => {
  const f = kit.fromUrl();
  if (f && !f.mine) return showFriend(f);
  if (e.state?.v === "result") {
    const last = kit.history.latest();
    if (last) return showResult(last);
  }
  goIntro();
});
route();
renderMoreSites($("#more"));
