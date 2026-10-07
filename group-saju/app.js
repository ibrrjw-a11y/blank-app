// 우리 모임 사주 화면 v3. 계산은 core.js(analyzeGroup → 코드 → expand), 문장은 texts.js
import { $, share, toast, renderMoreSites, prefersReducedMotion, ROOT_URL, encodeState, decodeState, getParam, countUp, createStore } from "../shared/kit.js";
import { personOf, analyzeGroup, expand, validCode, MAX, STEM_EL } from "./core.js";
import { EL, EL_HANJA, PLANET } from "./texts.js";

const RM = prefersReducedMotion();
const store = createStore("group-saju");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const COL = ["#2f7a5a", "#c8442f", "#b8892a", "#7d828d", "#2b3a5a"]; // 오방색: 청·적·황·백(은회색)·흑(남색)

let S = { g: "", rows: [] }; // 입력 상태
let R = null; // { code, view, guess }
let shared = false;

function show(v) {
  for (const id of ["intro", "input", "guess", "res"]) $("#" + id).hidden = id !== v;
  scrollTo({ top: 0, behavior: RM ? "auto" : "smooth" });
}

/* ---------- 별자리 지도(SVG) ----------
 * 다섯 별을 원 위에 상생 순서(목→화→토→금→수)로 놓고, 바깥 고리는 살리는 흐름, 안쪽 별 모양 점선은 다잡는 흐름.
 * 친구는 작은 별이 되어 가운데에서 자기 일간 오행의 별 곁으로 날아간다. 삼합국을 이루는 세 친구는 금빛 삼각형으로 잇는다 */
const CX = 160, CY = 160, RAD = 108;
const node = (e) => { const a = (-90 + 72 * e) * Math.PI / 180; return [CX + RAD * Math.cos(a), CY + RAD * Math.sin(a)]; };
function chartSVG(members, shareArr, opts = {}) {
  const n5 = [0, 1, 2, 3, 4].map(node);
  const ring = n5.map((p, e) => { const q = n5[(e + 1) % 5]; return `<path class="ch-gen" d="M${p[0]},${p[1]} A${RAD},${RAD} 0 0 1 ${q[0]},${q[1]}" style="--i:${e}"/>`; }).join("");
  const star = n5.map((p, e) => { const q = n5[(e + 2) % 5]; return `<line class="ch-ctrl" x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" style="--i:${e}"/>`; }).join("");
  const planets = n5.map(([x, y], e) => {
    const r = 15 + Math.round(26 * (shareArr ? shareArr[e] : 0.2));
    // 별 이름은 지도 가운데 쪽에(친구 별은 바깥쪽에 서므로 서로 안 부딪힘)
    const ux = (CX - x) / RAD, uy = (CY - y) / RAD, lx = (ux * (r + 13)).toFixed(1), ly = (uy * (r + 13) + 4).toFixed(1);
    return `<g class="ch-node" style="--i:${e};--c:${COL[e]}" transform="translate(${x},${y})"><circle class="ch-halo" r="${r + 7}"/><circle class="ch-planet" r="${r}"/><text class="ch-han" y="6">${EL_HANJA[e]}</text><text class="ch-ko" x="${lx}" y="${ly}">${PLANET[e]}</text></g>`;
  }).join("");
  const byEl = [[], [], [], [], []];
  members.forEach((m) => byEl[STEM_EL[m.dm]].push(m));
  const pos = {};
  const beads = byEl.flatMap((list, e) => list.map((m, k) => {
    const [x, y] = n5[e];
    const ang = (-90 + 72 * e) * Math.PI / 180 + (k - (list.length - 1) / 2) * 0.62;
    const rr = 15 + 26 * (shareArr ? shareArr[e] : 0.2) + 20 + (k % 2) * 16;
    const bx = x + rr * Math.cos(ang), by = y + rr * Math.sin(ang);
    pos[m.i] = [bx, by];
    const c = Math.cos(ang), s = Math.sin(ang);
    const anchor = c > 0.35 ? "start" : c < -0.35 ? "end" : "middle";
    const tx = (c * 11).toFixed(1), ty = (s * 12 + 4).toFixed(1);
    return `<g class="ch-bead" style="--d:${(m.i ?? k) * 0.12}s;--fx:${CX - bx}px;--fy:${CY - by}px;--c:${COL[e]}" transform="translate(${bx.toFixed(1)},${by.toFixed(1)})"><path d="M0,-7 L2,-2 7,0 2,2 0,7 -2,2 -7,0 -2,-2Z"/>${opts.names === false ? "" : `<text x="${tx}" y="${ty}" text-anchor="${anchor}">${esc(m.n)}</text>`}</g>`;
  })).join("");
  const tris = (opts.tri || []).map((t, k) => {
    const pts = t.who.map((i) => pos[i]).filter(Boolean);
    if (pts.length !== 3) return "";
    return `<polygon class="ch-tri" style="--k:${k}" points="${pts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ")}"/>`;
  }).join("");
  return `<svg viewBox="-34 -14 388 368" role="img" aria-label="${esc(opts.label || "모임 별자리")}"><circle class="ch-sky" cx="${CX}" cy="${CY}" r="150"/><circle class="ch-sky2" cx="${CX}" cy="${CY}" r="${RAD}"/>${star}${ring}${planets}${tris}${beads}</svg>`;
}

/* ---------- 첫 화면 견본(움직임) ---------- */
function demo() {
  const fake = [[0, "가람"], [2, "나래"], [5, "다온"], [6, "라희"], [9, "마루"], [3, "바다"]].map(([dm, n], i) => ({ n, dm, i }));
  const shares = [0.18, 0.26, 0.24, 0.2, 0.12];
  const el = $("#demoChart");
  const draw = () => { el.innerHTML = chartSVG(fake, shares, { label: "견본 별자리", tri: [{ who: [0, 2, 4] }] }); el.classList.remove("is-on"); void el.offsetWidth; el.classList.add("is-on"); };
  draw();
  if (!RM) setInterval(draw, 7000);
}

/* ---------- 입력 ---------- */
const blank = () => ({ name: "", date: "", lunar: false });
function renderRows() {
  $("#rows").innerHTML = S.rows.map((r, k) => `<li class="gs-row" data-k="${k}">
      <input class="gs-in gs-in--name" data-f="name" value="${esc(r.name)}" maxlength="10" placeholder="이름" autocomplete="off" aria-label="${k + 1}번째 이름" />
      <input class="gs-in gs-in--date" data-f="date" value="${esc(r.date)}" inputmode="numeric" maxlength="10" placeholder="1995.03.14" autocomplete="off" aria-label="${k + 1}번째 생년월일" />
      <label class="gs-lunar"><input type="checkbox" data-f="lunar" ${r.lunar ? "checked" : ""} aria-label="${k + 1}번째 음력" /><span>음</span></label>
      <button type="button" class="gs-del" data-del="${k}" aria-label="${k + 1}번째 지우기">×</button>
      <p class="gs-rerr" hidden></p>
    </li>`).join("");
  $("#cnt").textContent = `${S.rows.filter((r) => r.name.trim() && r.date.trim()).length} / ${MAX}명`;
  $("#addRow").disabled = S.rows.length >= MAX;
}
function bindInput() {
  $("#rows").addEventListener("input", (e) => {
    const li = e.target.closest(".gs-row"); if (!li) return;
    const r = S.rows[+li.dataset.k], f = e.target.dataset.f;
    r[f] = f === "lunar" ? e.target.checked : e.target.value;
    $("#cnt").textContent = `${S.rows.filter((x) => x.name.trim() && x.date.trim()).length} / ${MAX}명`;
    li.querySelector(".gs-rerr").hidden = true; li.classList.remove("is-bad");
    save();
  });
  $("#rows").addEventListener("click", (e) => {
    const k = e.target.dataset.del; if (k == null) return;
    S.rows.splice(+k, 1); if (S.rows.length < 2) S.rows.push(blank()); renderRows(); save();
  });
  $("#addRow").addEventListener("click", () => { if (S.rows.length >= MAX) return; S.rows.push(blank()); renderRows(); $("#rows li:last-child .gs-in--name").focus(); save(); });
  $("#example").addEventListener("click", () => {
    S.g = "예시 모임";
    S.rows = [["가람", "1995.03.14"], ["나래", "1996.07.02"], ["다온", "1994.11.23"], ["라희", "1995.01.30"], ["마루", "1997.09.09"]].map(([name, date]) => ({ name, date, lunar: false }));
    $("#gname").value = S.g; renderRows(); save();
  });
  $("#gname").addEventListener("input", (e) => { S.g = e.target.value; save(); });
  $("#toGuess").addEventListener("click", collect);
}
const save = () => store.set("last", S);

function collect() {
  const err = $("#err"); err.hidden = true;
  const people = []; let bad = 0; const seen = new Map();
  S.rows.forEach((r, k) => {
    const li = $(`#rows li[data-k="${k}"]`);
    const name = r.name.trim(), date = r.date.trim();
    if (!name && !date) return;
    const fail = (msg) => { bad++; li.classList.add("is-bad"); const p = li.querySelector(".gs-rerr"); p.textContent = msg; p.hidden = false; };
    if (!name) return fail("이름을 넣어 주세요");
    if (!date) return fail("생년월일을 넣어 주세요");
    const p = personOf({ name, date, lunar: r.lunar });
    if (p.err) return fail(p.err);
    const c = (seen.get(name) || 0) + 1; seen.set(name, c);
    p.name = c > 1 ? `${name}${c}` : name; // 같은 이름은 뒤에 숫자
    people.push(p);
  });
  if (bad) { err.textContent = "빨간 칸을 확인해 주세요"; err.hidden = false; return; }
  if (people.length < 2) { err.textContent = "두 명 이상 넣어 주세요"; err.hidden = false; return; }
  const code = analyzeGroup(people, S.g.trim() || "우리 모임");
  R = { code, view: expand(code), guess: null };
  guessView();
}

/* ---------- 먼저 찍기 ---------- */
function guessView() {
  $("#chips").innerHTML = R.view.members.map((m, k) => `<button type="button" class="gs-chip" data-k="${k}" style="--i:${k}">${esc(m.n)}</button>`).join("");
  show("guess");
}
function bindGuess() {
  $("#chips").addEventListener("click", (e) => { const k = e.target.closest(".gs-chip")?.dataset.k; if (k == null) return; R.guess = +k; result(); });
  $("#skip").addEventListener("click", () => { R.guess = null; result(); });
}

/* ---------- 결과 ---------- */
const ptsCls = (p) => (p >= 3 ? "hot" : p >= 1.5 ? "warm" : p < 0 ? "cold" : "plain");
function gridHTML(V) {
  const n = V.members.length;
  const at = {};
  V.grid.forEach((g) => { at[`${g.i}-${g.j}`] = g; at[`${g.j}-${g.i}`] = g; });
  const head = `<tr><th></th>${V.members.map((m) => `<th scope="col"><span>${esc(m.n.slice(0, 3))}</span></th>`).join("")}</tr>`;
  const body = V.members.map((a, i) => `<tr><th scope="row">${esc(a.n.slice(0, 3))}</th>${V.members.map((b, j) => {
    if (i === j) return `<td class="is-self"></td>`;
    const g = at[`${i}-${j}`];
    return `<td><button type="button" class="gs-cell is-${ptsCls(g.pts)}${g.mark.length > 1 ? " is-two" : ""}" data-pair="${Math.min(i, j)}-${Math.max(i, j)}" style="--d:${(i + j) * 0.05}s" aria-label="${esc(a.n)}과 ${esc(b.n)}: ${g.title || "일간 오행"}">${g.mark}</button></td>`;
  }).join("")}</tr>`).join("");
  return `<table class="gs-grid gs-grid--${n > 8 ? "s" : n > 5 ? "m" : "l"}">${head}${body}</table>`;
}
function pairCard(g, V, kind) {
  const a = V.members[g.i].n, b = V.members[g.j].n;
  const head = kind === "rough" ? "맞춰 가는 사이" : g.title || "잘 맞는 사이";
  return `<div class="gs-pair is-${kind || "pick"}"><h3>${esc(head)}</h3><b>${esc(a)} × ${esc(b)}</b><p>${esc(g.line)}</p>${g.why.length ? `<small>근거 · ${esc(g.why.join(" · "))}</small>` : `<small>근거 · 일간 오행 ${g.mark === "生" ? "상생" : g.mark === "剋" ? "상극" : "같음"}</small>`}</div>`;
}
function result() {
  const V = R.view;
  $("#resName").textContent = V.g;
  $("#resCnt").textContent = `${V.members.length}명의 별자리`;
  const ch = $("#chart");
  ch.innerHTML = chartSVG(V.members, V.share, { label: `${V.g} 별자리`, tri: V.tri });
  ch.classList.remove("is-on"); void ch.offsetWidth; ch.classList.add("is-on");
  $("#legend").innerHTML = [0, 1, 2, 3, 4].map((e) => `<li style="--c:${COL[e]}"><i></i>${EL[e]} <b>${Math.round(V.share[e] * 100)}%</b>${V.over.includes(e) ? " <em>넘침</em>" : V.lackEls.includes(e) ? " <em>빔</em>" : ""}</li>`).join("");
  const gl = [...V.lines, V.balance, ...V.tri.map((t) => t.line)];
  if (V.risers.length) gl.push(`올해(${V.ygKo}년) 힘 받는 친구: ${V.risers.join(", ")}`);
  $("#glines").innerHTML = gl.map((t, k) => `<p style="--i:${k}">${esc(t)}</p>`).join("");
  const tops = V.tops;
  const hit = $("#hit");
  if (R.guess != null) {
    const ok = tops.some((m) => m.i === R.guess);
    hit.className = `gs-hit ${ok ? "is-ok" : "is-no"}`;
    hit.innerHTML = `<b>${ok ? "맞혔어요" : "아쉬워요"}</b><span>내가 찍은 사람 ${esc(V.members[R.guess].n)} · 실제 찰떡 ${esc(tops.map((m) => m.n).join(", "))}</span>`;
    hit.hidden = false;
  } else hit.hidden = true;
  // 넣은 순서 그대로(점수 순위로 줄 세우지 않음). 최고점은 '찰떡'(공동이면 여럿)
  $("#cards").innerHTML = V.members.map((m, k) => `<li class="gs-card${tops.includes(m) ? " is-top" : ""}" style="--i:${k};--c:${COL[m.el]}">
      <div class="gs-card__head"><span class="gs-dot"></span><b class="gs-card__name">${esc(m.n)}</b><span class="gs-card__sym">${esc(m.dmInfo.sym)}${shared ? "" : ` · ${esc(m.ilju)} · ${esc(m.tti)}`}</span>${tops.includes(m) ? `<i class="gs-badge">${tops.length > 1 ? "공동 찰떡" : "찰떡"}</i>` : ""}</div>
      <p class="gs-card__role"><b>${esc(m.role.t)}</b> ${esc(m.role.line)}</p>
      <p class="gs-card__line">${esc(m.dmInfo.line)}</p>
      <dl class="gs-deep">
        <div><dt>기질</dt><dd><b>${esc(m.strength.t)}</b> ${esc(m.strength.line)}</dd></div>
        <div><dt>센 기운</dt><dd>${esc(m.godLine)}</dd></div>
        <div><dt>힘이 되는</dt><dd>${esc(m.helpLine)}</dd></div>
        ${m.nobleLine ? `<div><dt>천을귀인</dt><dd>${esc(m.nobleLine)}</dd></div>` : ""}
        <div><dt>올해</dt><dd>${esc(m.yearLine)}</dd></div>
      </dl>
      <div class="gs-fit"><span class="gs-fit__lbl">모임 궁합</span><b class="gs-fit__n" data-n="${m.fit}">${RM ? m.fit : 0}</b><span class="gs-fit__t">${esc(m.relT)}</span><i class="gs-fit__bar"><i style="--w:${m.fit}%"></i></i></div>
      <p class="gs-card__rel">${esc(m.give)}</p>
      <p class="gs-card__tip">${esc(m.tip)}</p>
    </li>`).join("");
  if (!RM) $("#cards").querySelectorAll(".gs-fit__n").forEach((el, k) => setTimeout(() => countUp(el, +el.dataset.n, { duration: 800 }), 600 + k * 120));
  $("#gridWrap").innerHTML = gridHTML(V);
  $("#pairPick").innerHTML = "";
  $("#pairs").innerHTML = V.highlights.map((g) => pairCard(g, V, g.kind)).join("");
  $("#shareText").textContent = shareText();
  $("#from").hidden = !shared;
  if (shared) $("#from").innerHTML = `<b>친구가 보낸 모임 사주</b><span>생일은 담지 않았어요. 다만 사주 글자 일부가 결과 계산에 쓰여서, 마음먹으면 생일을 대강 짐작할 수는 있어요.</span>`;
  $("#edit").hidden = shared;
  $("#mine").hidden = !shared;
  show("res");
}
function shareText() {
  const V = R.view;
  const best = V.highlights.find((h) => h.kind === "best");
  return `Guess What · 우리 모임 사주 「${V.g}」\n${V.tops.length > 1 ? "공동 찰떡" : "찰떡"}: ${V.tops.map((m) => m.n).join(", ")} (${V.tops[0].fit}점)\n` +
    V.members.map((m) => `${m.n} ${m.dmInfo.sym} · ${m.role.t} · ${m.fit}`).join("\n") +
    (best ? `\n${best.title || "잘 맞는 사이"}: ${V.members[best.i].n} × ${V.members[best.j].n}` : "") +
    (V.tri[0] ? `\n${V.tri[0].line}` : `\n${V.lines[0]}`);
}
const shareUrl = () => `${ROOT_URL}group-saju/?s=${encodeState(R.code)}`;

/* ---------- 시작 ---------- */
function init() {
  if (RM) document.documentElement.classList.add("rm");
  demo();
  S = store.get("last", null) || { g: "", rows: [blank(), blank(), blank()] };
  if (S.rows.length < 2) S.rows.push(blank());
  $("#gname").value = S.g || "";
  renderRows(); bindInput(); bindGuess();
  $("#start").addEventListener("click", () => show("input"));
  $("#edit").addEventListener("click", () => show("input"));
  $("#mine").addEventListener("click", () => { shared = false; history.replaceState(null, "", location.pathname); show("input"); });
  $("#gridWrap").addEventListener("click", (e) => {
    const b = e.target.closest(".gs-cell"); if (!b) return;
    const [i, j] = b.dataset.pair.split("-").map(Number);
    const g = R.view.grid.find((x) => x.i === i && x.j === j);
    $("#gridWrap").querySelectorAll(".gs-cell.is-on").forEach((x) => x.classList.remove("is-on"));
    $("#gridWrap").querySelectorAll(`[data-pair="${i}-${j}"]`).forEach((x) => x.classList.add("is-on"));
    $("#pairPick").innerHTML = pairCard(g, R.view);
  });
  $("#shareBtn").addEventListener("click", async () => {
    const r = await share({ title: `우리 모임 사주 「${R.view.g}」`, text: $("#shareText").textContent, url: shareUrl() });
    if (r === "shared") toast("보냈어요");
  });
  renderMoreSites($("#more"), "group-saju");
  // 받은 링크로 열면 바로 결과(계산이 끝난 결과만 담긴 코드를 그대로 펼침)
  const s = getParam("s");
  if (s) {
    const code = decodeState(s);
    if (validCode(code)) {
      code.g = String(code.g || "우리 모임").slice(0, 16);
      shared = true;
      R = { code, view: expand(code), guess: null };
      result();
    } else toast("링크가 깨졌거나 예전 판이라 결과를 열 수 없어요. 새로 만들어 보세요");
  }
}
if (typeof document !== "undefined" && document.getElementById("rows")) init();
