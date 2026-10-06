// 오늘의 Guess — 하루 다섯 문제 점수판 (아침 신문 퍼즐 면)
// 문제를 새로 만들지 않는다. 퀴즈 4개는 딴짓 오락실 게임 모듈·기록(store "ddanjit")을 그대로 읽고,
// 오늘의 비율은 짐작과 진짜(/me/)의 기기 저장값(localStorage "jj-proto-v3")을 읽기만 한다.
// 그래서 정답·점수는 원래 페이지와 어긋날 수 없고, 원래 페이지에서 푼 것도 그대로 반영된다.
import { $, share, toast, todayKey, renderMoreSites, prefersReducedMotion, ROOT_URL } from "../shared/kit.js";
import { msToNextPuzzle, fmtCountdown, DAY, store, overallStreak } from "../ddanjit/core.js";
import { GAMES, statusOf } from "../ddanjit/play.js";

const DATE = todayKey();
const LABEL = { zoom: "그림", town: "동네", price: "가격", timeline: "연도" };
const ME_KEY = "jj-proto-v3";
const ERR_MUL = 3; // 짐작과 진짜 daily.js PROV.ERR_MUL 과 같은 값 (점수 = 100 - 3 × 오차, 0 미만은 0)

export function ratioScore(guess, answer) {
  return Math.max(0, Math.round(100 - ERR_MUL * Math.abs(Number(guess) - Number(answer))));
}

// 오늘의 비율 상태: 짐작과 진짜 저장값에서 오늘 날짜 것만
export function ratioStatus(raw = readMe(), date = DATE) {
  const r = raw && raw.ratio;
  if (!r || r.d !== date || !Array.isArray(r.set) || !r.set.length) return { kind: "new" };
  if (!r.done) return { kind: r.g && r.g.length ? "doing" : "new" };
  const scores = r.set.map((x, i) => (typeof r.g[i] === "number" ? ratioScore(r.g[i], x.item.answer) : 0));
  const total = scores.reduce((a, b) => a + b, 0);
  const boxes = scores.map((s) => { const n = Math.round(s / 20); return "■".repeat(n) + "□".repeat(5 - n); }).join(" ");
  return { kind: "done", sum: { grid: boxes, scoreText: `${total}점 / ${r.set.length * 100}` } };
}

function readMe() {
  try { return JSON.parse(localStorage.getItem(ME_KEY) || "null"); } catch { return null; }
}

export function rows() {
  const games = GAMES.map((g) => ({ id: g.id, name: g.name, label: LABEL[g.id] || g.name, href: `${ROOT_URL}ddanjit/${g.id}/`, st: statusOf(g) }));
  games.push({ id: "ratio", name: "오늘의 비율", label: "비율", href: `${ROOT_URL}me/?p=ratio`, st: ratioStatus() });
  return games;
}

export function shareText(list = rows(), date = DATE) {
  const done = list.filter((r) => r.st.kind === "done");
  const md = date.slice(5).replace("-", "/");
  const lines = done.map((r) => `${r.label} ${r.st.sum.grid}${r.id === "ratio" ? " " + r.st.sum.scoreText : ""}`);
  return `Guess What · 오늘의 Guess ${md}\n${done.length}/${list.length}칸 풀었음\n${lines.join("\n")}`;
}

// 요일: 날짜 글자(YYYY-MM-DD)를 그대로 달력 날로 본다.
// 고친 버그(10-06): 예전엔 한국 0시(+09:00)를 만들고 UTC 요일을 읽어 하루 앞 요일이 나왔음(10/6 화 → '월')
export function weekdayOf(key) {
  const [y, m, d] = key.split("-").map(Number);
  return ["일", "월", "화", "수", "목", "금", "토"][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function statusHTML(st) {
  if (st.kind === "done") return `<span class="pz__state is-done">${esc(st.sum.scoreText)}</span><span class="pz__grid">${esc(st.sum.grid)}</span>`;
  if (st.kind === "doing") return `<span class="pz__state is-doing">푸는 중</span>`;
  return `<span class="pz__state">아직</span>`;
}

function render() {
  const list = rows();
  const n = list.filter((r) => r.st.kind === "done").length;
  $("#board").innerHTML = list
    .map((r, i) => `<a class="pz${r.st.kind === "done" ? " pz--done" : ""}" href="${r.href}" style="--i:${i}">
        <span class="pz__no">${i + 1}</span>
        <span class="pz__body"><span class="pz__name">${esc(r.name)}</span>${statusHTML(r.st)}</span>
        <span class="pz__mark" aria-hidden="true">${r.st.kind === "done" ? "✓" : "?"}</span>
      </a>`)
    .join("");
  $("#tally").textContent = `${n} / ${list.length}`;
  $("#tally").dataset.full = n === list.length ? "1" : "0";
  const coupon = $("#coupon");
  coupon.hidden = n === 0;
  if (n) $("#couponText").textContent = shareText(list);
}

/* ---------- 지난 면 보관함 · 연속 기록 (10-06, 지락실 '지난 회차 보관함' 참고) ----------
 * 서버 없이 이 기기에 남은 기록(store "ddanjit" 의 d:<게임>:<회차>)만 읽는다. 다른 사람 순위·정답률은 없음(서버가 있어야 함).
 * 오늘의 비율은 짐작과 진짜가 오늘 것만 남기므로 지난 면에서는 빠진다 */
export function dateOfDay(d, today = DATE, todayNo = DAY) {
  const [y, m, dd] = today.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, dd) - (todayNo - d) * 86400000);
  return t.toISOString().slice(0, 10);
}
export function pastRows(n = 7) {
  const out = [];
  for (let d = DAY - 1; d >= Math.max(1, DAY - n); d--) {
    const cells = GAMES.map((g) => {
      const st = store.get(`d:${g.id}:${d}`, null);
      const sum = st ? g.summary(st) : null;
      return { id: g.id, label: LABEL[g.id] || g.name, done: !!sum };
    });
    out.push({ day: d, date: dateOfDay(d), cells, n: cells.filter((c) => c.done).length });
  }
  return out;
}
function renderPast() {
  const s = overallStreak();
  const el = $("#streak");
  el.hidden = !s.total;
  if (s.total) el.innerHTML = `연속 <b>${s.streak}일</b> · 최고 ${s.best}일 · 지금까지 ${s.total}일 풀었음${s.today ? "" : s.streak ? " · 오늘 풀면 이어져요" : ""}`;
  const past = pastRows();
  // 지난 기록이 하나도 없으면 '안 풂' 일곱 줄 대신 한 줄만(처음 온 사람에게 빈 표는 어수선함)
  if (!past.some((r) => r.n)) {
    $("#arch").innerHTML = `<li class="arch__none">지난 7일 동안 푼 기록이 없어요. 오늘 문제부터 풀면 여기 쌓여요.</li>`;
  } else $("#arch").innerHTML = past
    .map((r) => `<li class="arch__row${r.n ? "" : " is-empty"}"><span class="arch__date">${r.date.slice(5).replace("-", ".")} (${weekdayOf(r.date)})<small>제 ${r.day} 면</small></span>
      <span class="arch__cells">${r.cells.map((c) => `<span class="arch__cell${c.done ? " is-done" : ""}">${esc(c.label)}</span>`).join("")}</span>
      <b class="arch__n">${r.n ? `${r.n}/${r.cells.length}` : "안 풂"}</b></li>`)
    .join("");
  $("#again").innerHTML = `지난 문제 한 판 더 <small>(기록 안 남음)</small> ` + GAMES.map((g) => `<a href="${ROOT_URL}ddanjit/${g.id}/#again">${esc(LABEL[g.id] || g.name)}</a>`).join(" · ");
}

function tick() {
  $("#next").textContent = fmtCountdown(msToNextPuzzle());
}

function init() {
  $("#mastDate").textContent = `${DATE.replace(/-/g, ".")} (${weekdayOf(DATE)})`;
  $("#mastNo").textContent = `제 ${DAY} 면`; // 딴짓 문제 번호(#회차)와 같은 번호
  render();
  renderPast();
  tick();
  setInterval(tick, 1000);
  // 게임을 풀고 뒤로 돌아오면 다시 읽는다
  addEventListener("pageshow", () => { render(); renderPast(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { render(); renderPast(); } });
  $("#shareBtn").addEventListener("click", async () => {
    const r = await share({ title: "오늘의 Guess", text: shareText(), url: `${ROOT_URL}daily/` });
    if (r === "shared") toast("보냈어요");
  });
  if (prefersReducedMotion()) document.documentElement.classList.add("rm");
  renderMoreSites($("#more"), "daily");
  const t = $("#more .more-sites__title");
  if (t) t.textContent = "다른 면";
}

if (typeof document !== "undefined" && document.getElementById("board")) init();
