// 오늘의 Guess — 하루 다섯 문제 점수판 (아침 신문 퍼즐 면)
// 문제를 새로 만들지 않는다. 퀴즈 4개는 딴짓 오락실 게임 모듈·기록(store "ddanjit")을 그대로 읽고,
// 오늘의 비율은 짐작과 진짜(/me/)의 기기 저장값(localStorage "jj-proto-v3")을 읽기만 한다.
// 그래서 정답·점수는 원래 페이지와 어긋날 수 없고, 원래 페이지에서 푼 것도 그대로 반영된다.
import { $, share, toast, todayKey, renderMoreSites, prefersReducedMotion, ROOT_URL } from "../shared/kit.js";
import { msToNextPuzzle, fmtCountdown } from "../ddanjit/core.js";
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

function tick() {
  $("#next").textContent = fmtCountdown(msToNextPuzzle());
}

function init() {
  const d = new Date(DATE + "T00:00:00+09:00");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  $("#mastDate").textContent = `${DATE.replace(/-/g, ".")} (${days[d.getUTCDay()]})`;
  render();
  tick();
  setInterval(tick, 1000);
  // 게임을 풀고 뒤로 돌아오면 다시 읽는다
  addEventListener("pageshow", render);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) render(); });
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
