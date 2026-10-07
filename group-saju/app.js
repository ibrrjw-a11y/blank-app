// 우리 모임 사주 화면. 계산은 core.js, 문장은 texts.js
import { $, share, toast, renderMoreSites, prefersReducedMotion, ROOT_URL, encodeState, decodeState, getParam, countUp, createStore } from "../shared/kit.js";
import { personOf, readGroup, pack, unpack, MAX, josa, STEM_EL } from "./core.js";
import { EL, EL_HANJA, PLANET } from "./texts.js";

const RM = prefersReducedMotion();
const store = createStore("group-saju");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const COL = ["#2f7a5a", "#c8442f", "#b8892a", "#7d828d", "#2b3a5a"]; // 오방색: 청·적·황·백(은회색)·흑(남색)

let S = { g: "", rows: [] }; // 입력 상태
let R = null; // 결과
let shared = false;

function show(v) {
  for (const id of ["intro", "input", "guess", "res"]) $("#" + id).hidden = id !== v;
  scrollTo({ top: 0, behavior: RM ? "auto" : "smooth" });
}

/* ---------- 별자리 지도(SVG) ----------
 * 다섯 별을 원 위에 상생 순서(목→화→토→금→수)로 놓고, 바깥 고리는 살리는 흐름, 안쪽 별 모양 점선은 다잡는 흐름.
 * 사람은 작은 별이 되어 가운데에서 자기 일간 오행의 별 곁으로 날아간다 */
const CX = 160, CY = 160, RAD = 108;
const node = (e) => { const a = (-90 + 72 * e) * Math.PI / 180; return [CX + RAD * Math.cos(a), CY + RAD * Math.sin(a)]; };
function chartSVG(members, share, opts = {}) {
  const n5 = [0, 1, 2, 3, 4].map(node);
  const ring = n5.map((p, e) => { const q = n5[(e + 1) % 5]; return `<path class="ch-gen" d="M${p[0]},${p[1]} A${RAD},${RAD} 0 0 1 ${q[0]},${q[1]}" style="--i:${e}"/>`; }).join("");
  const star = n5.map((p, e) => { const q = n5[(e + 2) % 5]; return `<line class="ch-ctrl" x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" style="--i:${e}"/>`; }).join("");
  const planets = n5.map(([x, y], e) => {
    const r = 15 + Math.round(26 * (share ? share[e] : 0.2));
    // 별 이름은 지도 가운데 쪽에(친구 별은 바깥쪽에 서므로 서로 안 부딪힘 — 10-07 캡처에서 '금성'과 이름이 겹쳤음)
    const ux = (CX - x) / RAD, uy = (CY - y) / RAD, lx = (ux * (r + 13)).toFixed(1), ly = (uy * (r + 13) + 4).toFixed(1);
    return `<g class="ch-node" style="--i:${e};--c:${COL[e]}" transform="translate(${x},${y})"><circle class="ch-halo" r="${r + 7}"/><circle class="ch-planet" r="${r}"/><text class="ch-han" y="6">${EL_HANJA[e]}</text><text class="ch-ko" x="${lx}" y="${ly}">${PLANET[e]}</text></g>`;
  }).join("");
  // 같은 별 곁 사람들은 그 별 둘레에 고르게 흩어 놓는다
  const byEl = [[], [], [], [], []];
  members.forEach((m) => byEl[STEM_EL[m.dm]].push(m));
  // 이름이 겹치지 않게(10-07 캡처에서 나래·라희가 겹침): 별 바깥쪽 부채꼴에 0.62rad 간격으로, 홀수 번째는 한 칸 더 바깥.
  // 이름은 별에서 바깥 방향으로 붙이고, 지도 왼쪽은 오른쪽 정렬·오른쪽은 왼쪽 정렬
  const beads = byEl.flatMap((list, e) => list.map((m, k) => {
    const [x, y] = n5[e];
    const ang = (-90 + 72 * e) * Math.PI / 180 + (k - (list.length - 1) / 2) * 0.62;
    const rr = 15 + 26 * (share ? share[e] : 0.2) + 20 + (k % 2) * 16;
    const bx = x + rr * Math.cos(ang), by = y + rr * Math.sin(ang);
    const c = Math.cos(ang), s = Math.sin(ang);
    const anchor = c > 0.35 ? "start" : c < -0.35 ? "end" : "middle";
    const tx = (c * 11).toFixed(1), ty = (s * 12 + 4).toFixed(1);
    return `<g class="ch-bead" style="--d:${(m.i ?? k) * 0.12}s;--fx:${CX - bx}px;--fy:${CY - by}px;--c:${COL[e]}" transform="translate(${bx.toFixed(1)},${by.toFixed(1)})"><path d="M0,-7 L2,-2 7,0 2,2 0,7 -2,2 -7,0 -2,-2Z"/>${opts.names === false ? "" : `<text x="${tx}" y="${ty}" text-anchor="${anchor}">${esc(m.name)}</text>`}</g>`;
  })).join("");
  return `<svg viewBox="-34 -14 388 368" role="img" aria-label="${opts.label || "모임 별자리"}"><circle class="ch-sky" cx="${CX}" cy="${CY}" r="150"/><circle class="ch-sky2" cx="${CX}" cy="${CY}" r="${RAD}"/>${star}${ring}${planets}${beads}</svg>`;
}

/* ---------- 첫 화면 견본(움직임) ---------- */
function demo() {
  const fake = [[0, "가람"], [2, "나래"], [5, "다온"], [6, "라희"], [9, "마루"], [3, "바다"]].map(([dm, name], i) => ({ name, dm, i }));
  const shares = [0.18, 0.26, 0.24, 0.2, 0.12];
  const el = $("#demoChart");
  const draw = () => { el.innerHTML = chartSVG(fake, shares, { label: "견본 별자리" }); el.classList.remove("is-on"); void el.offsetWidth; el.classList.add("is-on"); };
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
    p.i = people.length;
    people.push(p);
  });
  if (bad) { err.textContent = "빨간 칸을 확인해 주세요"; err.hidden = false; return; }
  if (people.length < 2) { err.textContent = "두 명 이상 넣어 주세요"; err.hidden = false; return; }
  R = { g: S.g.trim() || "우리 모임", people, read: readGroup(people) };
  guessView();
}

/* ---------- 먼저 찍기 ---------- */
function guessView() {
  $("#chips").innerHTML = R.people.map((p, k) => `<button type="button" class="gs-chip" data-k="${k}" style="--i:${k}">${esc(p.name)}</button>`).join("");
  show("guess");
}
function bindGuess() {
  $("#chips").addEventListener("click", (e) => { const k = e.target.closest(".gs-chip")?.dataset.k; if (k == null) return; R.guess = +k; result(); });
  $("#skip").addEventListener("click", () => { R.guess = null; result(); });
}

/* ---------- 결과 ---------- */
function result() {
  const { read: rd, people, g } = R;
  $("#resName").textContent = g;
  $("#resCnt").textContent = `${people.length}명의 별자리`;
  const ch = $("#chart");
  ch.innerHTML = chartSVG(rd.members, rd.share, { label: `${g} 별자리` });
  ch.classList.remove("is-on"); void ch.offsetWidth; ch.classList.add("is-on");
  $("#legend").innerHTML = [0, 1, 2, 3, 4].map((e) => `<li style="--c:${COL[e]}"><i></i>${EL[e]} <b>${Math.round(rd.share[e] * 100)}%</b>${rd.over.includes(e) ? " <em>넘침</em>" : rd.lack.includes(e) ? " <em>빔</em>" : ""}</li>`).join("");
  $("#glines").innerHTML = rd.lines.map((t, k) => `<p style="--i:${k}">${esc(t)}</p>`).join("");
  const tops = rd.tops;
  const hit = $("#hit");
  if (R.guess != null) {
    const ok = tops.some((m) => m.i === R.guess);
    hit.className = `gs-hit ${ok ? "is-ok" : "is-no"}`;
    hit.innerHTML = `<b>${ok ? "맞혔어요" : "아쉬워요"}</b><span>내가 찍은 사람 ${esc(people[R.guess].name)} · 실제 찰떡 ${esc(tops.map((m) => m.name).join(", "))}</span>`;
    hit.hidden = false;
  } else hit.hidden = true;
  // 넣은 순서 그대로(점수 순위로 줄 세우지 않음). 최고점은 '찰떡'(공동이면 여럿)
  $("#cards").innerHTML = rd.members.map((m, k) => `<li class="gs-card${tops.includes(m) ? " is-top" : ""}" style="--i:${k};--c:${COL[m.el]}">
      <div class="gs-card__head"><span class="gs-dot"></span><b class="gs-card__name">${esc(m.name)}</b><span class="gs-card__sym">${esc(m.dmInfo.sym)} · ${esc(m.dmInfo.k)}</span>${tops.includes(m) ? `<i class="gs-badge">${tops.length > 1 ? "공동 찰떡" : "찰떡"}</i>` : ""}</div>
      <p class="gs-card__role"><b>${esc(m.role.t)}</b> ${esc(m.role.line)}</p>
      <p class="gs-card__line">${esc(m.dmInfo.line)}</p>
      <div class="gs-fit"><span class="gs-fit__lbl">모임 궁합</span><b class="gs-fit__n" data-n="${m.fit.score}">${RM ? m.fit.score : 0}</b><span class="gs-fit__t">${esc(m.fit.label)}</span><i class="gs-fit__bar"><i style="--w:${m.fit.score}%"></i></i></div>
      <p class="gs-card__rel"><b>${esc(m.relT)}</b> ${esc(m.give)}</p>
      <p class="gs-card__tip">${esc(m.tip)}</p>
    </li>`).join("");
  if (!RM) $("#cards").querySelectorAll(".gs-fit__n").forEach((el, k) => setTimeout(() => countUp(el, +el.dataset.n, { duration: 800 }), 600 + k * 120));
  const P = rd.pairs;
  $("#pairs").innerHTML = (P.best ? `<div class="gs-pair is-best"><h3>찰떡 짝</h3><b>${esc(P.best.a)} × ${esc(P.best.b)}</b><p>${esc(P.best.line)}</p></div>` : "") +
    (P.spark ? `<div class="gs-pair is-spark"><h3>불꽃 튀는 짝</h3><b>${esc(P.spark.a)} × ${esc(P.spark.b)}</b><p>${esc(P.spark.line)}</p></div>` : "");
  $("#shareText").textContent = shareText();
  $("#from").hidden = !shared;
  if (shared) $("#from").innerHTML = `<b>친구가 보낸 모임 사주</b><span>생일 없이 계산된 기운만 담긴 결과예요.</span>`;
  $("#edit").hidden = shared;
  $("#mine").hidden = !shared;
  show("res");
}
function shareText() {
  const { read: rd, g } = R;
  const tops = rd.tops.map((m) => m.name).join(", ");
  return `Guess What · 우리 모임 사주 「${g}」\n${rd.tops.length > 1 ? "공동 찰떡" : "찰떡"}: ${tops} (${rd.tops[0].fit.score}점)\n${rd.members.map((m) => `${m.name} ${m.dmInfo.sym} · ${m.role.t} · ${m.fit.score}`).join("\n")}\n${rd.lines[0]}`;
}
function shareUrl() {
  return `${ROOT_URL}group-saju/?s=${encodeState({ g: R.g, m: R.people.map(pack) })}`;
}

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
  $("#shareBtn").addEventListener("click", async () => {
    const r = await share({ title: `우리 모임 사주 「${R.g}」`, text: $("#shareText").textContent, url: shareUrl() });
    if (r === "shared") toast("보냈어요");
  });
  renderMoreSites($("#more"), "group-saju");
  // 받은 링크로 열면 바로 결과(생일 없이 담긴 기운으로)
  const s = getParam("s");
  if (s) {
    const st = decodeState(s);
    const ok = st && Array.isArray(st.m) ? st.m.slice(0, MAX).map(unpack).filter(Boolean) : [];
    if (ok.length >= 2) {
      const people = ok.map((p, i) => ({ ...p, i }));
      shared = true;
      R = { g: String(st.g || "우리 모임").slice(0, 16), people, read: readGroup(people), guess: null };
      result();
    } else toast("링크가 깨져서 결과를 열 수 없어요");
  }
}
if (typeof document !== "undefined" && document.getElementById("rows")) init();
export { josa };
