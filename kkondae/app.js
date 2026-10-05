import { $, $$, haptic, toast, renderMoreSites, CANVAS_FONT, wrapText, prefersReducedMotion } from "../shared/kit.js";
import { createQuiz, tally, createResultKit, swapView, loopScenes, wait, esc, josa, fmtDate, tok, rotated } from "../test-kit/engine.js";
import { QUESTIONS, AREAS, TIERS, tierOf } from "./data.js";

const kit = createResultKit({ slug: "kkondae", questions: QUESTIONS, title: "꼰대력 테스트" });
const SIGNS = ["확인", "검토", "승인"];
const CIRCLED = ["①", "②", "③"];

/* ---------- 계산 ---------- */
function compute(answers) {
  const all = tally(QUESTIONS, answers);
  const score = all.pct("k");
  const areas = Object.keys(AREAS).map((a) => {
    const t = tally(QUESTIONS, answers, (q) => q.a === a);
    return { a, name: AREAS[a], score: t.pct("k"), sum: t.sum.k || 0 };
  });
  const top = [...areas].sort((x, y) => y.score - x.score)[0];
  // 판정 근거: 가장 높은 점수의 응답 (가장 꼰대력 높은 부문 우선)
  let evidence = null;
  QUESTIONS.forEach((q, i) => {
    const opt = q.options[answers[i]];
    const k = opt.s.k;
    const pri = k * 10 + (q.a === top.a ? 1 : 0);
    if (k > 0 && (!evidence || pri > evidence.pri)) evidence = { q, opt, k, pri };
  });
  const tier = tierOf(score);
  return { answers, score, sum: all.sum.k || 0, areas, top, evidence, tier };
}

const docNo = (r, t = Date.now()) => {
  const d = new Date(t);
  return `꼰대-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(r.score).padStart(3, "0")}`;
};
const dotDate = (t = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
};

/* ---------- 도장 ---------- */
function seal(text, { square = false, cls = "" } = {}) {
  const r = (Math.random() * 16 - 8).toFixed(1);
  return `<span class="kd-seal ${square ? "kd-seal--square" : ""} ${cls}" style="--r:${r}deg"><i>${text}</i></span>`;
}

function stampSign(table, idx, animate = true, buzz = false) {
  const cell = $(`[data-s="${idx}"]`, table);
  if (!cell || cell.firstChild) return;
  cell.innerHTML = seal(SIGNS[idx], { cls: animate ? "is-slam" : "" });
  if (buzz) haptic(14);
}

function clearSign(table) {
  $$("td", table).forEach((td) => (td.innerHTML = ""));
}

/* ---------- 인트로 ---------- */
let intro = null;
const DEMO = [
  { qi: 0, pick: 0, score: 13 },
  { qi: 1, pick: 2, score: 40 },
  { qi: 2, pick: 0, score: 63 },
];

function odo(id, digits = 3) {
  const strip = "0123456789".split("").map((d) => `<i>${d}</i>`).join("");
  return `<span class="kd-odo" id="${id}">${Array.from({ length: digits }, () => `<span class="kd-odo__col"><span class="kd-odo__strip">${strip}</span></span>`).join("")}</span>`;
}
function setOdo(el, n, { trim = false } = {}) {
  const v = Math.max(0, Math.min(100, Math.round(n)));
  const s = String(v).padStart(3, "0");
  $$(".kd-odo__strip", el).forEach((st, i) => {
    st.style.setProperty("--d", s[i]);
    if (trim) st.parentElement.hidden = (i === 0 && v < 100) || (i === 1 && v < 10);
  });
}

function tierBar(score, id = "") {
  return `<div class="kd-tierbar" ${id ? `id="${id}"` : ""} style="--p:${score}">
    ${[...TIERS].reverse().map((t) => `<span>${t.step}단계</span>`).join("")}
    <i class="kd-tierbar__mark"></i>
  </div>`;
}

function buildStage() {
  $("#stage").innerHTML = `
    <table class="kd-form">
      <tr><th>문서번호</th><td>꼰대-2026-0001</td><th>보존</th><td>영구</td></tr>
      <tr><th>기안자</th><td>본인</td><th>시행</th><td>즉시</td></tr>
    </table>
    <div class="kd-row" id="iRow">
      <p class="kd-row__q"><b id="iNo">01</b><span class="kd-row__area" id="iArea">[회사]</span><span id="iQ"></span></p>
      <ol class="kd-row__opts" id="iOpts"></ol>
    </div>
    <div class="kd-log">
      <p class="kd-log__title">처리 내역</p>
      <table><thead><tr><th>번호</th><th>구분</th><th>선택</th><th>점수</th></tr></thead><tbody id="iLog"></tbody></table>
    </div>
    <div class="kd-meter">
      <span class="kd-meter__label">꼰대 지수</span>
      ${odo("iOdo")}
      <span class="kd-meter__of">/ 100</span>
      ${tierBar(0, "iBar")}
    </div>
    <div class="kd-verdict" id="iVerdict">
      <p class="kd-verdict__kind">꼰대력 판정서</p>
      <p class="kd-verdict__line">지수 <b>63</b>점 · 4단계</p>
      <p class="kd-verdict__tier">「잔소리 정규직」</p>
      <p class="kd-verdict__rank">부여 직함: 잔소리 부장</p>
      ${seal("꼰대력<br />심사위원회<br />직인", { square: true, cls: "kd-verdict__seal" })}
    </div>`;
}

function startIntro() {
  buildStage();
  const stage = $("#stage");
  const row = $("#iRow");
  const sign = $("#introSign");
  const bar = $("#iBar");
  const showRow = async (d, i, signal) => {
    const q = QUESTIONS[d.qi];
    row.classList.remove("is-in");
    row.classList.add("is-out");
    await wait(200, signal);
    if (signal.aborted) return;
    $("#iNo").textContent = String(d.qi + 1).padStart(2, "0");
    $("#iArea").textContent = `[${AREAS[q.a]}]`;
    $("#iQ").textContent = q.q;
    $("#iOpts").innerHTML = q.options.map((o, k) => `<li data-k="${k}"><span class="kd-box"></span>${CIRCLED[k]} ${esc(o.t)}</li>`).join("");
    row.classList.remove("is-out");
    void row.offsetWidth;
    row.classList.add("is-in");
    await wait(900, signal);
    if (signal.aborted) return;
    $(`#iOpts [data-k="${d.pick}"]`).classList.add("is-checked");
    const opt = q.options[d.pick];
    const filled = `<tr class="is-new"><td>${String(d.qi + 1).padStart(2, "0")}</td><td>${AREAS[q.a]}</td><td>${CIRCLED[d.pick]} ${esc(opt.t)}</td><td>${opt.s.k}점</td></tr>`;
    const blank = $("#iLog tr.is-blank");
    if (blank) blank.outerHTML = filled;
    else $("#iLog").insertAdjacentHTML("beforeend", filled);
    setOdo($("#iOdo"), d.score);
    bar.style.setProperty("--p", d.score);
    await wait(450, signal);
    if (signal.aborted) return;
    stampSign(sign, i);
  };
  const scenes = DEMO.map((d, i) => ({
    duration: 2400,
    play(signal) {
      stage.dataset.scene = String(i + 1);
      if (i === 0) {
        clearSign(sign);
        // 빈 처리 칸을 미리 그어 두고 하나씩 채운다 (빈 표가 휑하지 않게)
        $("#iLog").innerHTML = Array.from(
          { length: 6 },
          (_, k) => `<tr class="is-blank"><td>${String(k + 1).padStart(2, "0")}</td><td></td><td>미처리</td><td>-</td></tr>`
        ).join("");
        setOdo($("#iOdo"), 0);
        bar.style.setProperty("--p", 0);
      }
      showRow(d, i, signal);
    },
  }));
  scenes.push({
    duration: 3000,
    play() {
      stage.dataset.scene = "4";
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
  const last = kit.history.latest();
  const lr = $("#lastResult");
  if (last) {
    const r = compute(last.answers);
    lr.hidden = false;
    lr.innerHTML = `문서 대장 · 최근 판정 <b>${r.score}점 「${r.tier.name}」</b> 열람 →`;
  } else lr.hidden = true;
  startIntro();
}

/* ---------- 상황 조사서 (문항) ---------- */
const quiz = createQuiz({
  questions: QUESTIONS,
  onShow: renderQ,
  onDone: finish,
  onExit: () => history.back(),
});

function renderQ({ q, idx, total, dir, selected, answers }) {
  $("#quizCount").textContent = `문항 ${String(idx + 1).padStart(2, "0")} / ${total}`;
  $("#quizPage").textContent = `- ${idx + 1} -`;
  const sign = $("#quizSign");
  const done = answers.filter((v, i) => v != null && i < idx).length;
  [0, 1, 2].forEach((s) => {
    const cell = $(`[data-s="${s}"]`, sign);
    const need = (s + 1) * 5;
    if (done >= need) stampSign(sign, s, false);
    else cell.innerHTML = "";
  });
  const wrap = $("#quizCard");
  wrap.innerHTML = `
    <div class="kd-q ${dir < 0 ? "from-prev" : dir > 0 ? "from-next" : ""}">
      <table class="kd-qtable">
        <tr><th>구분</th><td>${AREAS[q.a]}</td><th>번호</th><td class="t-num">${String(idx + 1).padStart(2, "0")}</td></tr>
        <tr><th>상황</th><td colspan="3" class="kd-qtable__q">${esc(q.q)}</td></tr>
      </table>
      <p class="kd-q__inst">※ 평소의 나와 가장 가까운 항목에 ✔ 표시하시오.</p>
      <ol class="kd-opts">
        ${q.options
          .map(
            (o, i) => `<li><button type="button" class="tk-option kd-opt" data-i="${i}" aria-pressed="${selected === i}">
              <span class="kd-box" aria-hidden="true"></span><span class="kd-opt__no">${CIRCLED[i]}</span><span class="kd-opt__t">${esc(o.t)}</span>
            </button></li>`
          )
          .join("")}
      </ol>
    </div>`;
  $$(".kd-opt", wrap).forEach((b) =>
    b.addEventListener("click", async () => {
      if (wrap.dataset.busy) return;
      wrap.dataset.busy = "1";
      haptic(8);
      $$(".kd-opt", wrap).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      const n = idx + 1;
      let delay = 380;
      if (n % 5 === 0) {
        await wait(prefersReducedMotion() ? 0 : 200);
        stampSign(sign, n / 5 - 1, true, true);
        delay = 620;
      }
      await wait(prefersReducedMotion() ? 0 : delay);
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
  clearSign($("#quizSign"));
  quiz.start();
}

function finish(answers) {
  kit.history.add({ answers });
  history.replaceState({ v: "result" }, "", kit.BASE);
  showResult({ answers, t: Date.now() }, { fresh: true });
}

/* ---------- 판정서 ---------- */
function verdictDoc(r, { to, t, nameField = false }) {
  const tr = r.tier;
  const ev = r.evidence;
  return `<article class="kd-sheet kd-official ${nameField ? "" : "is-received"}">
    <p class="kd-official__org">꼰 대 력 심 사 위 원 회</p>
    <h2 class="kd-official__title">꼰대력 판정서</h2>
    <table class="kd-official__meta">
      <tr><th>수신</th><td>${
        nameField
          ? `<input class="kd-inline" id="nick" maxlength="10" value="${esc(kit.getNick())}" placeholder="(성명 선택 입력)" /> 귀하`
          : `${esc(to)} 귀하`
      }</td></tr>
      <tr><th>제목</th><td>꼰대력 판정 결과 통보</td></tr>
    </table>
    <div class="kd-official__body">
      <p>1. 귀하의 무궁한 발전을 기원합니다.</p>
      <p>2. 귀하가 제출한 상황조사서 15개 문항을 심사한 결과를 아래와 같이 알려드립니다.</p>
      <dl class="kd-items">
        <div><dt>가. 꼰대 지수</dt><dd><span class="kd-big">${odo("rOdo")}</span><span class="kd-big__of">점 / 100</span></dd></div>
        <div><dt>나. 판정 단계</dt><dd>${tr.step}단계 <b class="kd-tiername">「${tr.name}」</b></dd></div>
        <div><dt>다. 부여 직함</dt><dd><b class="kd-rank">${tr.rank}</b></dd></div>
      </dl>
      ${tierBar(r.score)}
      <p class="kd-quote">“${esc(tr.line)}”</p>
      <p>3. 부문별 지수</p>
      <table class="kd-table kd-table--areas">
        <thead><tr><th>부문</th>${r.areas.map((a) => `<th>${a.name}</th>`).join("")}</tr></thead>
        <tbody>
          <tr><th>지수</th>${r.areas.map((a) => `<td class="${a.a === r.top.a && a.score > 0 ? "is-top" : ""}">${a.score}</td>`).join("")}</tr>
          <tr><th>합계</th>${r.areas.map((a) => `<td>${a.sum} / 10</td>`).join("")}</tr>
        </tbody>
      </table>
      ${r.top.score > 0 ? `<p class="kd-note">※ ${r.top.name}에서 특히 꼰대력이 높게 나타남.</p>` : ""}
      <p>4. 심사 의견</p>
      <p class="kd-indent">${esc(tr.desc)}</p>
      ${
        ev
          ? `<p>5. 판정 근거</p>
            <div class="kd-evidence"><span>[${AREAS[ev.q.a]}] ${esc(ev.q.q)}</span><b>→ ${esc(ev.opt.t)}</b><em>${ev.k}점</em></div>`
          : ""
      }
      <p>${ev ? 6 : 5}. 개선 권고</p>
      <ol class="kd-advice">${tr.advice.map((x, i) => `<li><span>${"가나다"[i]}.</span> ${esc(x)}</li>`).join("")}</ol>
      <p class="kd-end">붙임 &nbsp;판정 근거 1부. &nbsp;끝.</p>
    </div>
    <div class="kd-official__sign">
      <p class="kd-official__chair">꼰대력심사위원회 위원장</p>
      ${seal("꼰대력<br />심사위원회<br />직인", { square: true, cls: "kd-official__seal" })}
    </div>
    <table class="kd-official__foot">
      <tr><th>시행</th><td>${docNo(r, t)} (${dotDate(t)})</td></tr>
      <tr><th>담당</th><td>본인 &nbsp;·&nbsp; 검토 팀장 &nbsp;·&nbsp; 승인 부장</td></tr>
    </table>
  </article>`;
}

function ledger() {
  const list = kit.history.list().slice(-8).reverse();
  if (!list.length) return "";
  return `<section class="kd-sheet kd-panel">
    <h3 class="kd-box__title">문서 대장 <small>이 기기에만 보관</small></h3>
    <table class="kd-table kd-table--ledger">
      <thead><tr><th>시행일</th><th>지수</th><th>단계</th></tr></thead>
      <tbody>${list
        .map((h, i) => {
          const r = compute(h.answers);
          const prev = list[i + 1] ? compute(list[i + 1].answers) : null;
          const d = prev ? r.score - prev.score : 0;
          return `<tr><td>${fmtDate(h.t, true)}</td><td>${r.score}${d ? ` <em class="${d > 0 ? "up" : "down"}">${d > 0 ? "▲" : "▼"}${Math.abs(d)}</em>` : ""}</td><td>${r.tier.name}</td></tr>`;
        })
        .join("")}</tbody>
    </table>
  </section>`;
}

function compareBlock(me, fr) {
  const fname = fr.name || "친구";
  const meName = kit.getNick() || "본인";
  const diff = me.score - fr.r.score;
  const verdict =
    diff === 0
      ? "두 사람의 꼰대 지수가 같아요. 같은 회의실에 두면 \"나 때는\"이 동시에 나올 수 있어요."
      : `${diff > 0 ? meName : fname}${josa(diff > 0 ? meName : fname, "이/가")} ${Math.abs(diff)}점 더 꼰대예요.`;
  return `<section class="kd-sheet kd-panel kd-joint">
    <h3 class="kd-box__title">합동 결재표 <small>${esc(meName)} · ${esc(fname)}</small></h3>
    <table class="kd-table kd-table--joint">
      <thead><tr><th>구분</th><th>${esc(meName)}</th><th>${esc(fname)}</th></tr></thead>
      <tbody>
        <tr><th>꼰대 지수</th><td class="kd-joint__big">${me.score}</td><td class="kd-joint__big">${fr.r.score}</td></tr>
        <tr><th>단계</th><td>${me.tier.name}</td><td>${fr.r.tier.name}</td></tr>
        <tr><th>직함</th><td>${me.tier.rank}</td><td>${fr.r.tier.rank}</td></tr>
        ${me.areas.map((a, i) => `<tr><th>${a.name}</th><td>${a.score}</td><td>${fr.r.areas[i].score}</td></tr>`).join("")}
        <tr class="kd-joint__sign"><th>결재</th><td>${seal(diff >= 0 ? "꼰대" : "확인")}</td><td>${seal(diff <= 0 ? "꼰대" : "확인")}</td></tr>
      </tbody>
    </table>
    <p class="kd-joint__verdict">${esc(verdict)}</p>
    <button type="button" class="kd-btn-line" id="clearFriend">합동 결재 반려 (비교 지우기)</button>
  </section>`;
}

function inviteBlock() {
  return `<section class="kd-sheet kd-panel">
    <h3 class="kd-box__title">합동 결재 요청</h3>
    <p class="kd-box__p">판정서를 받은 친구가 결재를 올리면 두 판정서를 나란히 놓은 합동 결재표가 나와요. 친구가 보낸 판정서 링크를 붙여 넣어도 돼요.</p>
    <div class="tk-paste"><input class="kd-input" id="pasteFriend" inputmode="url" placeholder="친구 판정서 링크 붙여넣기" /><button type="button" class="kd-btn-stamp kd-btn-stamp--sm" id="pasteGo">대조</button></div>
  </section>`;
}

function runOdo(view, score, fresh) {
  const el = $("#rOdo", view);
  if (!el) return;
  setOdo(el, 0, { trim: true });
  setOdo(el, 0);
  $$(".kd-odo__strip", el).forEach((st, i) => {
    const v = score;
    st.parentElement.hidden = (i === 0 && v < 100) || (i === 1 && v < 10);
  });
  setTimeout(() => setOdo(el, score, { trim: true }), fresh ? 500 : 50);
}

function showResult(entry, { fresh = false } = {}) {
  stopIntro();
  const r = compute(entry.answers);
  const fr = kit.friend.get();
  const friend = fr ? { ...fr, r: compute(fr.answers) } : null;
  const view = $('[data-view="result"]');
  view.innerHTML = `
    <div class="kd-topline"><button type="button" class="kd-btn-line" id="resHome">◀ 처음으로</button><span>판정서 발급 완료</span></div>
    ${verdictDoc(r, { to: kit.getNick() || "본인", t: entry.t || Date.now(), nameField: true })}
    <div class="kd-actions">
      <button type="button" class="kd-btn-stamp" id="shareLink"><span class="kd-btn-stamp__seal">발송</span>판정서 친구에게 발송</button>
      <button type="button" class="kd-btn-stamp kd-btn-stamp--paper" id="shareImg"><span class="kd-btn-stamp__seal">출력</span>판정서 이미지 저장</button>
    </div>
    ${friend ? compareBlock(r, friend) : inviteBlock()}
    ${ledger()}
    <button type="button" class="kd-stamp kd-stamp--again" id="again">
      <span class="kd-stamp__tool" aria-hidden="true"><i class="kd-stamp__knob"></i><i class="kd-stamp__neck"></i><i class="kd-stamp__base"></i></span>
      <span class="kd-stamp__text"><b>재기안</b><small>다시 결재 올리기</small></span>
      <span class="kd-stamp__ink" aria-hidden="true">재상신</span>
    </button>`;
  swapView("result");
  if (fresh) $(".kd-official", view).classList.add("is-fresh");
  runOdo(view, r.score, fresh);

  $("#resHome").onclick = () => goIntro();
  $("#again").onclick = (e) => pressStamp(e.currentTarget, startQuiz);
  const nickEl = $("#nick");
  nickEl.addEventListener("change", () => kit.setNick(nickEl.value));
  $("#shareLink").onclick = () => {
    kit.setNick(nickEl.value);
    haptic();
    kit.shareLink(entry, { text: `내 꼰대 지수 ${r.score}점, 직함은 「${r.tier.rank}」래. 너도 결재 올려 봐` });
  };
  $("#shareImg").onclick = async (ev) => {
    const b = ev.currentTarget;
    b.classList.add("is-loading");
    try {
      kit.setNick(nickEl.value);
      await kit.shareCard((ctx, W, H) => drawCard(ctx, W, H, r, kit.getNick() || "본인", entry.t || Date.now()), {
        filename: `kkondae-${r.score}.png`,
        text: `꼰대 지수 ${r.score}점 「${r.tier.name}」`,
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
      if (!f) return toast("판정서 링크를 다시 확인해 주세요");
      if (f.mine) return toast("내 판정서 링크예요. 친구 링크를 붙여 주세요");
      kit.friend.set(f);
      showResult(entry);
      toast("합동 결재표를 만들었어요");
    };
}

/* ---------- 받은 판정서 ---------- */
function showFriend(f) {
  stopIntro();
  const r = compute(f.answers);
  const who = f.name || "친구";
  const mine = kit.history.latest();
  const view = $('[data-view="friend"]');
  view.innerHTML = `
    <div class="kd-topline"><span>${esc(who)}${josa(who, "이/가")} 보낸 판정서</span></div>
    <section class="kd-sheet kd-panel kd-dare">
      <p class="kd-box__p"><b>${esc(who)}</b>의 꼰대 지수는 <b>${r.score}점</b>, 직함은 「${r.tier.rank}」예요. 나도 결재를 올리면 합동 결재표로 비교해 드려요.</p>
      <button type="button" class="kd-stamp" id="friendGo">
        <span class="kd-stamp__tool" aria-hidden="true"><i class="kd-stamp__knob"></i><i class="kd-stamp__neck"></i><i class="kd-stamp__base"></i></span>
        <span class="kd-stamp__text"><b>나도 결재 올리기</b><small>15문항 · 약 2분</small></span>
        <span class="kd-stamp__ink" aria-hidden="true">상신</span>
      </button>
      ${mine ? `<button type="button" class="kd-btn-line" id="friendCmp">지난 내 판정서와 대조하기 ▶</button>` : ""}
    </section>
    ${verdictDoc(r, { to: who, t: Date.now() })}`;
  swapView("friend");
  runOdo(view, r.score, true);
  $("#friendGo").onclick = (e) => pressStamp(e.currentTarget, startQuiz);
  const cmp = $("#friendCmp");
  if (cmp)
    cmp.onclick = () => {
      kit.clearUrl();
      history.pushState({ v: "result" }, "", kit.BASE);
      showResult(mine);
    };
}

/* ---------- 판정서 이미지 (1080×1350) ---------- */
function drawCard(ctx, W, H, r, to, t) {
  const c = { paper: tok("--art-paper"), ink: tok("--art-ink"), soft: tok("--art-ink-soft"), red: tok("--brand"), line: tok("--art-rule"), folder: tok("--art-folder") };
  const myeong = `"Nanum Myeongjo", "Noto Serif KR", Georgia, serif`;
  const gothic = `"Gothic A1", ${CANVAS_FONT}`;
  const mono = `"IBM Plex Mono", ui-monospace, monospace`;
  ctx.fillStyle = c.folder;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = c.paper;
  ctx.fillRect(24, 24, W - 48, H - 48);
  ctx.fillStyle = c.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 14px ${myeong}`;
  ctx.fillText("꼰 대 력 심 사 위 원 회", W / 2, 70);
  ctx.font = `800 40px ${myeong}`;
  ctx.fillText("꼰대력 판정서", W / 2, 120);
  ctx.strokeStyle = c.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(56, 140);
  ctx.lineTo(W - 56, 140);
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.font = `700 15px ${gothic}`;
  ctx.fillText("수신", 60, 172);
  ctx.fillText("제목", 60, 200);
  ctx.font = `400 15px ${gothic}`;
  ctx.fillText(`${to} 귀하`, 120, 172);
  ctx.fillText("꼰대력 판정 결과 통보", 120, 200);
  ctx.beginPath();
  ctx.lineWidth = 1;
  ctx.moveTo(56, 216);
  ctx.lineTo(W - 56, 216);
  ctx.stroke();

  ctx.font = `700 16px ${gothic}`;
  ctx.fillText("가. 꼰대 지수", 60, 262);
  ctx.font = `700 120px ${mono}`;
  ctx.fillText(String(r.score), 60, 382);
  const nw = ctx.measureText(String(r.score)).width;
  ctx.font = `400 20px ${gothic}`;
  ctx.fillText("점 / 100", 70 + nw, 380);

  // 단계 막대
  const bx = 60;
  const bw = W - 120;
  for (let i = 0; i < 5; i++) {
    ctx.strokeStyle = c.ink;
    ctx.strokeRect(bx + (bw / 5) * i, 410, bw / 5, 22);
    ctx.fillStyle = c.soft;
    ctx.font = `400 11px ${gothic}`;
    ctx.textAlign = "center";
    ctx.fillText(`${i + 1}단계`, bx + (bw / 5) * (i + 0.5), 426);
  }
  ctx.fillStyle = c.red;
  const mx = bx + (bw * r.score) / 100;
  ctx.beginPath();
  ctx.moveTo(mx, 404);
  ctx.lineTo(mx - 8, 392);
  ctx.lineTo(mx + 8, 392);
  ctx.closePath();
  ctx.fill();

  ctx.textAlign = "left";
  ctx.fillStyle = c.ink;
  ctx.font = `700 16px ${gothic}`;
  ctx.fillText("나. 판정 단계", 60, 472);
  ctx.fillText("다. 부여 직함", 60, 504);
  ctx.font = `800 22px ${myeong}`;
  ctx.fillText(`${r.tier.step}단계 「${r.tier.name}」`, 180, 474);
  ctx.fillText(r.tier.rank, 180, 506);
  ctx.font = `400 15px ${myeong}`;
  wrapText(ctx, `“${r.tier.line}”`, 60, 546, W - 120, 22);

  ctx.font = `400 14px ${gothic}`;
  ctx.fillText(r.areas.map((a) => `${a.name} ${a.score}`).join("   ·   "), 60, 590);

  // 직인
  rotated(ctx, W - 130, 560, -6, () => {
    ctx.strokeStyle = c.red;
    ctx.lineWidth = 4;
    ctx.strokeRect(-46, -46, 92, 92);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-40, -40, 80, 80);
    ctx.fillStyle = c.red;
    ctx.textAlign = "center";
    ctx.font = `800 16px ${myeong}`;
    ctx.fillText("꼰대력", 0, -14);
    ctx.fillText("심사위원회", 0, 6);
    ctx.fillText("직인", 0, 26);
  });
  ctx.textAlign = "left";
  ctx.fillStyle = c.soft;
  ctx.font = `500 12px ${mono}`;
  ctx.fillText(`시행 ${docNo(r, t)}`, 60, H - 56);
  ctx.font = `400 12px ${gothic}`;
  ctx.fillText(`${location.host}${location.pathname}`, 60, H - 38);
}

/* ---------- 도장 버튼 ---------- */
function pressStamp(btn, fn) {
  if (btn.dataset.busy) return;
  btn.dataset.busy = "1";
  haptic([4, 40, 18]);
  btn.classList.remove("is-press");
  void btn.offsetWidth;
  btn.classList.add("is-press");
  setTimeout(() => {
    delete btn.dataset.busy;
    btn.classList.remove("is-press");
    fn();
  }, prefersReducedMotion() ? 0 : 640);
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

$("#start").onclick = (e) => pressStamp(e.currentTarget, startQuiz);
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
dressRelatedDocs($("#more"));

// 하단 다른 도구: 공문 끝에 붙는 "관련 문서" 칸
function dressRelatedDocs(nav) {
  if (!nav) return;
  const title = nav.querySelector(".more-sites__title");
  if (title) title.innerHTML = `<span>관련 문서</span><small>참조 3건 · 열람 가능</small>`;
  nav.querySelectorAll(".more-sites__item").forEach((a, i) => {
    const no = document.createElement("span");
    no.className = "kd-ref__no";
    no.setAttribute("aria-hidden", "true");
    no.textContent = `참조 ${i + 1}`;
    const go = document.createElement("span");
    go.className = "kd-ref__go";
    go.setAttribute("aria-hidden", "true");
    go.textContent = "열람";
    a.prepend(no);
    a.append(go);
  });
}
