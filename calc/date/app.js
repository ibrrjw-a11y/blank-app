// 날짜 계산기(2026-10-08). 모든 날짜는 '한국 날짜' — 서울 시간대로 오늘을 정하고, 날짜끼리는 시각 없이 '1970-01-01부터 며칠째'인 정수로만 셈
// (브라우저 시간대가 한국이 아니어도, 서머타임이 있는 나라여도 하루가 23·25시간이 되는 문제가 없음)
import { $, $$, share, toast, renderMoreSites, ROOT_URL, getParam, prefersReducedMotion } from "../../shared/kit.js";

const RM = prefersReducedMotion();
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const n0 = (x) => Number(x).toLocaleString("ko-KR");

// ---------- 날짜 도우미(화면 없음) ----------
export const kstToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export const dn = (iso) => { const [y, m, d] = iso.split("-").map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };
export const isoOf = (n) => new Date(n * 864e5).toISOString().slice(0, 10);
const ymd = (n) => { const d = new Date(n * 864e5); return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]; };
const dim = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const WD = ["일", "월", "화", "수", "목", "금", "토"];
export const wday = (n) => (((n + 4) % 7) + 7) % 7; // 1970-01-01 = 목요일
export const fmtD = (n) => { const [y, m, d] = ymd(n); return `${y}년 ${m}월 ${d}일 (${WD[wday(n)]})`; };
// k개월 뒤(그 달에 같은 날이 없으면 그 달 말일)
export function addMonths(n, k) {
  const [y, m, d] = ymd(n); const t = y * 12 + (m - 1) + k; const Y = Math.floor(t / 12), M = (((t % 12) + 12) % 12) + 1;
  return Math.round(Date.UTC(Y, M - 1, Math.min(d, dim(Y, M))) / 864e5);
}
// a ≤ b 일 때 달력 기준 '몇 개월 며칠'
export function monthsDays(a, b) {
  const [ya, ma] = ymd(a), [yb, mb] = ymd(b);
  let m = (yb - ya) * 12 + (mb - ma);
  while (m > 0 && addMonths(a, m) > b) m--;
  while (addMonths(a, m + 1) <= b) m++;
  return [m, b - addMonths(a, m)];
}
const ymdText = (a, b) => { const [m, d] = monthsDays(a, b); const y = Math.floor(m / 12); return `${y ? `${y}년 ` : ""}${m % 12 ? `${m % 12}개월 ` : ""}${d}일`.replace(/^0일$/, "0일"); };
const wkText = (n) => `${n0(Math.floor(n / 7))}주 ${n % 7}일`;

// 2026년 공휴일(관공서의 공휴일에 관한 규정 + 한국천문연구원 2026년 월력요항으로 확인된 날만). 확인 안 된 날은 넣지 않음
// 원문: 공휴일에 관한 법률(법률 제21338호, 2026-05-11 시행 — 제헌절 포함 국경일 전체) · 관공서의 공휴일에 관한 규정 제2조·제3조(대통령령 제36290호)
// 노동절(5/1)은 2026-05-01 시행. 설·추석·부처님오신날 날짜는 한국천문연구원 음양력 변환. 6/3 지방선거일은 공휴일인 것은 조문, 날짜는 천문연 2026 달력자료(공식 발표 아님 표시)
export const HOLI2026 = [["2026-01-01", "1월 1일"], ["2026-02-16", "설 연휴"], ["2026-02-17", "설날"], ["2026-02-18", "설 연휴"], ["2026-03-01", "3·1절"], ["2026-03-02", "대체공휴일(3·1절)"],
  ["2026-05-01", "노동절"], ["2026-05-05", "어린이날"], ["2026-05-24", "부처님오신날"], ["2026-05-25", "대체공휴일(부처님오신날)"], ["2026-06-03", "전국동시지방선거일"], ["2026-06-06", "현충일"],
  ["2026-07-17", "제헌절"], ["2026-08-15", "광복절"], ["2026-08-17", "대체공휴일(광복절)"], ["2026-09-24", "추석 연휴"], ["2026-09-25", "추석"], ["2026-09-26", "추석 연휴"],
  ["2026-10-03", "개천절"], ["2026-10-05", "대체공휴일(개천절)"], ["2026-10-09", "한글날"], ["2026-12-25", "기독탄신일"]];
const HOLI = new Set(HOLI2026.map(([d]) => dn(d)));
// 날짜 집합 [s, e] 안의 평일(월~금) 수, holi=true 면 2026 공휴일 중 평일인 날도 뺌
export function weekdays(s, e, holi) {
  let c = 0;
  for (let n = s; n <= e; n++) { const w = wday(n); if (w !== 0 && w !== 6 && !(holi && HOLI.has(n))) c++; }
  return c;
}

// ---------- 모드별 계산 ----------
export function between(fromIso, toIso, inc, holi) {
  let a = dn(fromIso), b = dn(toIso), swapped = false;
  if (b < a) { [a, b] = [b, a]; swapped = true; }
  const days = b - a + (inc ? 1 : 0);
  const s = inc ? a : a + 1; // 센 날들의 첫날
  const wk = weekdays(s, b, holi);
  const holiOut = holi ? [...HOLI].filter((n) => n >= s && n <= b && wday(n) !== 0 && wday(n) !== 6).length : 0;
  return { days, wk, holiOut, swapped, a, b, md: ymdText(a, b + (inc ? 1 : 0)), weeks: wkText(days), outside: holi && (ymd(s)[0] < 2026 || ymd(b)[0] > 2026) };
}
export function dday(toIso, todayIso = kstToday()) {
  const t = dn(todayIso), d = dn(toIso), diff = d - t;
  return { diff, label: diff > 0 ? `D-${n0(diff)}` : diff === 0 ? "D-day" : `D+${n0(-diff)}`, t, d };
}
export function addDays(baseIso, n, dir, first) {
  const b = dn(baseIso), k = first ? n - 1 : n;
  return b + dir * k;
}
export const ANNIV = [100, 200, 300, 365, 400, 500, 600, 700, 800, 900, 1000, 1500, 2000, 3000, 5000, 10000];
export function conv(x, u) {
  const days = u === "d" ? x : u === "w" ? x * 7 : u === "m" ? x * 365.2425 / 12 : x * 365.2425;
  return { days, weeks: days / 7, months: days / (365.2425 / 12), years: days / 365.2425 };
}

// ---------- 화면 ----------
let mode = "between";
const setMode = (m) => {
  mode = m;
  $$("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.m === m));
  $$(".fm").forEach((f) => (f.hidden = f.dataset.mode !== m));
  $("#cerr").hidden = true;
};
const err = (t) => { const e = $("#cerr"); e.textContent = t; e.hidden = false; };
const row = (k, v) => `<div class="rr" data-k="${esc(k)}"><span>${esc(k)}</span><b>${esc(v)}</b></div>`;
const okDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "") && Number(s.slice(0, 4)) >= 1;

function compute() {
  const today = kstToday();
  let head = "", val = "", sub = "", rows = [], table = "", notes = [];
  if (mode === "between") {
    const f = $("#b_from").value, t = $("#b_to").value;
    if (!okDate(f) || !okDate(t)) return err("시작일과 끝날을 넣어 주세요");
    const inc = $("#b_inc").checked, holi = HOLI2026.length > 0 && $("#b_holi").checked;
    const r = between(f, t, inc, holi);
    head = `${fmtD(r.a)} → ${fmtD(r.b)}`;
    val = `${n0(r.days)}일`;
    sub = inc ? "시작일과 끝날을 둘 다 센 날 수" : "끝날 − 시작일 (시작일은 세지 않음)";
    rows = [["몇 주", r.weeks], ["달력으로", r.md], [holi ? "평일(토·일·공휴일 뺌)" : "평일(토·일 뺌)", `${n0(r.wk)}일`], ["주말", `${n0(r.days - r.wk - r.holiOut)}일`]];
    if (holi) rows.push(["뺀 2026년 공휴일", `${r.holiOut}일`]);
    if (r.swapped) notes.push("끝날이 시작일보다 앞이라 둘을 바꿔서 셌어요.");
    if (r.outside) notes.push("공휴일은 2026년 것만 뺐어요. 다른 해의 공휴일은 평일로 셌어요.");
    notes.push(inc ? "평일·주말도 시작일과 끝날을 둘 다 넣어 셌어요." : "평일·주말은 시작일 다음 날부터 끝날까지 센 날 중에서 나눴어요.");
  } else if (mode === "dday") {
    const t = $("#d_to").value;
    if (!okDate(t)) return err("날짜를 넣어 주세요");
    const r = dday(t, today), name = $("#d_name").value.trim();
    head = `${name ? `${name} · ` : ""}${fmtD(r.d)}`;
    val = r.label;
    sub = r.diff > 0 ? `오늘부터 ${n0(r.diff)}일 남았어요` : r.diff === 0 ? "바로 오늘이에요" : `그날부터 ${n0(-r.diff)}일 지났어요`;
    const lo = Math.min(r.t, r.d), hi = Math.max(r.t, r.d);
    rows = [["오늘(한국 날짜)", fmtD(r.t)], ["몇 주", wkText(hi - lo)], ["달력으로", ymdText(lo, hi)]];
    if (r.diff > 0) rows.push(["그날까지 평일(토·일 뺌, 오늘 빼고 그날 포함)", `${n0(weekdays(r.t + 1, r.d, false))}일`]);
    if (r.diff < 0) rows.push(["그날을 1일째로 세면 오늘은", `${n0(-r.diff + 1)}일째`]);
  } else if (mode === "add") {
    const b = $("#a_base").value, n = Number(String($("#a_n").value).replace(/[^0-9]/g, "")), dir = Number($("#a_dir").value), first = $("#a_first").checked;
    if (!okDate(b)) return err("기준일을 넣어 주세요");
    if (!Number.isFinite(n) || n < 1 || n > 100000) return err("며칠을 1~100,000 사이로 넣어 주세요");
    const r = addDays(b, n, dir, first);
    if (ymd(r)[0] < 1 || ymd(r)[0] > 9999) return err("결과가 계산할 수 있는 범위(1~9999년)를 넘어요");
    head = `${fmtD(dn(b))}${dir > 0 ? "부터" : "에서"} ${n0(n)}일 ${dir > 0 ? "뒤" : "앞"}${first ? " (기준일=1일째)" : ""}`;
    val = fmtD(r).replace(/^(\d+)년 /, "$1년 ");
    const dd = dday(isoOf(r), today);
    sub = `오늘 기준 ${dd.label}`;
    rows = [["더한 날 수", `${dir > 0 ? "+" : "−"}${n0(first ? n - 1 : n)}일`]];
    if (dir > 0) {
      const t = dn(today);
      let nextMarked = false;
      table = `<p class="an-h">기념일 표 ${first ? "(기준일을 1일째로)" : "(기준일 + N일)"}</p><table class="an" id="anniv"><thead><tr><th>기념일</th><th>날짜</th><th>오늘 기준</th></tr></thead><tbody>${ANNIV.map((k) => {
        const d = addDays(b, k, 1, first), x = dday(isoOf(d), today);
        let cls = d < t ? "past" : "";
        if (d >= t && !nextMarked) { cls = "next"; nextMarked = true; }
        return `<tr class="${cls}" data-k="${k}"><td>${n0(k)}일</td><td>${fmtD(d)}</td><td>${x.label}</td></tr>`;
      }).join("")}</tbody></table>`;
    }
  } else {
    const x = Number(String($("#c_n").value).replace(/[^0-9.]/g, "")), u = $("#c_u").value;
    if (!Number.isFinite(x) || x <= 0 || x > 1e6) return err("숫자를 0보다 크게 넣어 주세요");
    const r = conv(x, u), U = { d: "일", w: "주", m: "개월", y: "년" }[u];
    head = `${n0(x)}${U}는`;
    const dr = Math.round(r.days);
    val = u === "d" || u === "w" ? wkText(dr) : `약 ${n0(dr)}일`;
    rows = [["일", `${u === "d" || u === "w" ? "" : "약 "}${n0(Math.round(r.days * 100) / 100)}일`], ["주", `${n0(Math.round(r.weeks * 100) / 100)}주`], ["개월(평균 30.44일)", `약 ${n0(Math.round(r.months * 100) / 100)}개월`], ["년(평균 365.2425일)", `약 ${n0(Math.round(r.years * 100) / 100)}년`]];
    notes.push("개월·년은 달마다 날 수가 달라 평균 길이로 어림했어요. 정확한 날짜가 필요하면 'N일 후·기념일'이나 '며칠 사이'를 써 주세요.");
  }
  $("#cerr").hidden = true;
  $("#rhead").textContent = head;
  $("#rval").textContent = val;
  $("#rsub").textContent = sub;
  $("#rrows").innerHTML = rows.map(([k, v]) => row(k, v)).join("");
  $("#rtable").innerHTML = table;
  $("#rnotes").innerHTML = notes.map((t) => `<li>${esc(t)}</li>`).join("");
  for (const s of ["cin", "cres"]) $("#" + s).hidden = s !== "cres";
  $("#cres").scrollIntoView({ block: "start", behavior: RM ? "auto" : "smooth" });
}

function basis() {
  const B = [
    ["오늘 날짜", "서울 시간대(Asia/Seoul)의 오늘", "브라우저 시계를 서울 시간대로 바꿔 날짜만 씀", "확정"],
    ["며칠 사이", "끝날 − 시작일, 선택 시 +1", "민법 제157조(기간의 첫날은 세지 않음)와 같은 방식이 기본. '둘 다 포함'은 생활 관습", "확정"],
    ["기념일 1일째 방식", "100일째 = 기준일 + 99일", "공식 기준 없음. 연애·아기 100일을 세는 생활 관습", "관습"],
    ["개월 수", "달력 기준, 같은 날이 없으면 그 달 말일", "엑셀 EDATE 와 같은 처리(예: 1월 31일의 1개월 뒤 = 2월 28일 또는 29일). 법정 기간 계산과는 하루 다를 수 있음", "우리 규칙"],
    ["주·개월 환산", "1개월 = 365.2425 ÷ 12 ≈ 30.44일", "그레고리력 1년 평균 길이로 어림", "어림"],
    ["평일", "월~금", "토·일만 뺌", "확정"],
  ];
  if (HOLI2026.length) {
    B.push(["2026년 공휴일", `${HOLI2026.length}일(${HOLI2026.map(([d, n]) => `${Number(d.slice(5, 7))}/${Number(d.slice(8))} ${n}`).join(", ")})`, "공휴일에 관한 법률 · 관공서의 공휴일에 관한 규정 제2조(공휴일)·제3조(대체공휴일). 제헌절은 2026-05-11, 노동절은 2026-05-01부터 공휴일. 설·추석·부처님오신날 날짜는 한국천문연구원 음양력 변환", "확정"]);
    B.push(["6/3 지방선거일", "공휴일로 뺌", "선거일이 공휴일인 것은 규정 제2조 제10호의2로 확정. 날짜 6월 3일은 한국천문연구원 2026 달력자료('공식 발표 자료 아님' 표시)로 확인", "날짜 확인 필요"]);
    B.push(["회사 휴일", "반영 안 함", "위 공휴일은 관공서 기준이에요. 회사 휴일은 회사 규정·근로기준법에 따라 다를 수 있어요", "참고"]);
  }
  $("#cbasis").innerHTML = `<summary>계산 근거</summary><table><thead><tr><th>항목</th><th>값</th><th>근거</th><th>확인</th></tr></thead><tbody>${B.map((b) => `<tr>${b.map((x) => `<td>${esc(x)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function shareUrl() {
  const p = new URLSearchParams({ m: mode });
  if (mode === "between") { p.set("f", $("#b_from").value); p.set("t", $("#b_to").value); if ($("#b_inc").checked) p.set("i", "1"); }
  if (mode === "dday") { p.set("t", $("#d_to").value); if ($("#d_name").value.trim()) p.set("n", $("#d_name").value.trim()); }
  if (mode === "add") { p.set("b", $("#a_base").value); p.set("k", $("#a_n").value); p.set("dir", $("#a_dir").value); if ($("#a_first").checked) p.set("one", "1"); }
  if (mode === "conv") { p.set("x", $("#c_n").value); p.set("u", $("#c_u").value); }
  return `${ROOT_URL}calc/date/?${p}`;
}

function init() {
  const today = kstToday(), t = dn(today);
  $("#b_from").value = today; $("#b_to").value = isoOf(t + 100);
  $("#d_to").value = `${today.slice(0, 4)}-12-25` < today ? `${Number(today.slice(0, 4)) + 1}-12-25` : `${today.slice(0, 4)}-12-25`;
  $("#a_base").value = today;
  $("#b_holi_w").hidden = HOLI2026.length === 0;
  basis();
  // 링크로 들어온 경우 같은 값 채우고 바로 결과
  const m = getParam("m");
  if (["between", "dday", "add", "conv"].includes(m)) {
    const g = (k) => getParam(k) || "";
    if (m === "between") { if (okDate(g("f"))) $("#b_from").value = g("f"); if (okDate(g("t"))) $("#b_to").value = g("t"); $("#b_inc").checked = g("i") === "1"; }
    if (m === "dday") { if (okDate(g("t"))) $("#d_to").value = g("t"); $("#d_name").value = g("n").slice(0, 20); }
    if (m === "add") { if (okDate(g("b"))) $("#a_base").value = g("b"); if (g("k")) $("#a_n").value = g("k").replace(/[^0-9]/g, ""); $("#a_dir").value = g("dir") === "-1" ? "-1" : "1"; $("#a_first").checked = g("one") === "1"; }
    if (m === "conv") { if (g("x")) $("#c_n").value = g("x").replace(/[^0-9.]/g, ""); if (["d", "w", "m", "y"].includes(g("u"))) $("#c_u").value = g("u"); }
    setMode(m); compute();
  }
  $("#tabs").addEventListener("click", (e) => { const b = e.target.closest("button[data-m]"); if (b) setMode(b.dataset.m); });
  $("#go").addEventListener("click", compute);
  $("#back").addEventListener("click", () => { for (const s of ["cin", "cres"]) $("#" + s).hidden = s !== "cin"; });
  $("#cshare").addEventListener("click", async () => {
    const r = await share({ title: "날짜 계산기", text: `${$("#rhead").textContent} — ${$("#rval").textContent}`, url: shareUrl() });
    if (r === "shared") toast("보냈어요");
  });
  renderMoreSites($("#more"), "calc/date");
}
if (typeof document !== "undefined" && document.getElementById("tabs")) init();
