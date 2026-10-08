// 퍼센트 계산기(2026-10-08). 모드 6개를 탭으로. 치는 대로 바로 계산, 링크로 같은 계산을 친구에게
import { $, toast, copyText, share, renderMoreSites, ROOT_URL, getParam } from "../../shared/kit.js";

const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
// 숫자 보이기: 소수 d자리 반올림 후 끝의 0 지움, 세 자리 쉼표. 1,000조 이상은 a.bcd×10ⁿ
export function fmt(n, d = 2) {
  if (!Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e15) { const [m, e] = a.toExponential(3).split("e"); return (n < 0 ? "-" : "") + m.replace(/\.?0+$/, "") + "×10" + String(Number(e)).replace(/./g, (c) => SUP[c]); }
  let s = a.toFixed(d); if (s.includes(".")) s = s.replace(/\.?0+$/, "");
  const [i, f] = s.split(".");
  const out = i.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (f ? "." + f : "");
  return (n < 0 && out !== "0" ? "-" : "") + out;
}

// 모드 정의: 칸 이름·단위·음수 허용·기본값, 계산(화면 없음)
export const MODES = {
  of: { tab: "A의 B%", la: "A (기준 값)", lb: "B (몇 %)", ua: "", ub: "%", neg: true, def: [50000, 15] },
  ratio: { tab: "A는 B의 몇 %", la: "A (부분)", lb: "B (전체)", ua: "", ub: "", neg: true, def: [30, 120] },
  change: { tab: "증감률", la: "처음 값", lb: "나중 값", ua: "", ub: "", neg: true, def: [1200, 1500] },
  disc: { tab: "할인가", la: "정가", lb: "할인율", ua: "원", ub: "%", neg: false, def: [39000, 20] },
  rate: { tab: "할인율", la: "정가", lb: "판매가", ua: "원", ub: "원", neg: false, def: [59000, 41300] },
  pp: { tab: "%p 차이", la: "처음 비율", lb: "나중 비율", ua: "%", ub: "%", neg: true, def: [3.5, 4.2] },
};
export function calc(m, a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { err: "숫자 두 개를 넣어 주세요" };
  if (Math.abs(a) >= 1e15 || Math.abs(b) >= 1e15) return { err: "1,000조보다 작은 수로 넣어 주세요" };
  if (m === "of") { const v = (a * b) / 100; return { v, u: "", head: `${fmt(a)}의 ${fmt(b)}%`, sent: `${fmt(a)} × ${fmt(b)} ÷ 100 = ${fmt(v)}`, f: `${fmt(a)} × ${fmt(b)} ÷ 100`, rows: [["남는 몫 (100% − B%)", fmt(a - v)]] }; }
  if (m === "ratio") {
    if (b === 0) return { err: "B(전체)가 0이면 몇 %인지 계산할 수 없어요" };
    const v = (a / b) * 100; return { v, u: "%", head: `${fmt(b)} 가운데 ${fmt(a)}`, sent: `${fmt(b)} 가운데 ${fmt(a)} = ${fmt(v)}%`, f: `${fmt(a)} ÷ ${fmt(b)} × 100`, rows: [] };
  }
  if (m === "change") {
    if (a === 0) return { err: "처음 값이 0이면 증감률을 계산할 수 없어요" };
    const v = ((b - a) / Math.abs(a)) * 100, d = b - a;
    const word = v > 0 ? "증가" : v < 0 ? "감소" : "변화 없음";
    return { v, u: "%", head: `${fmt(a)} → ${fmt(b)}`, sent: v === 0 ? "변화가 없어요." : `${fmt(Math.abs(v))}% ${word}했어요.`, f: `(${fmt(b)} − ${fmt(a)}) ÷ |${fmt(a)}| × 100`, rows: [["차이 (나중 − 처음)", fmt(d)], ["방향", word]], plus: true };
  }
  if (m === "disc") {
    if (a < 0) return { err: "정가는 0 이상으로 넣어 주세요" };
    if (b < 0 || b > 100) return { err: "할인율은 0~100% 사이로 넣어 주세요" };
    const v = (a * (100 - b)) / 100; return { v, u: "원", head: `정가 ${fmt(a)}원에서 ${fmt(b)}% 할인`, sent: `${fmt(a - v)}원 할인 → ${fmt(v)}원`, f: `${fmt(a)} × (100 − ${fmt(b)}) ÷ 100`, rows: [["할인 금액", `${fmt(a - v)}원`], ["정가", `${fmt(a)}원`]] };
  }
  if (m === "rate") {
    if (a <= 0) return { err: "정가는 0보다 크게 넣어 주세요" };
    if (b < 0) return { err: "판매가는 0 이상으로 넣어 주세요" };
    const v = ((a - b) / a) * 100;
    return { v, u: "%", head: v >= 0 ? "할인율" : "정가보다 비싸요", sent: v >= 0 ? `정가보다 ${fmt(a - b)}원 싸요 · ${fmt(v)}% 할인` : `할인이 아니라 정가보다 ${fmt(b - a)}원, ${fmt(-v)}% 비싸요`, f: `(${fmt(a)} − ${fmt(b)}) ÷ ${fmt(a)} × 100`, rows: [["할인 금액", `${fmt(a - b)}원`]] };
  }
  if (m === "pp") {
    const v = b - a, rel = a === 0 ? null : ((b - a) / Math.abs(a)) * 100;
    return { v, u: "%p", head: `${fmt(a)}% → ${fmt(b)}%`, sent: `${fmt(Math.abs(v))}%p ${v > 0 ? "올랐어요" : v < 0 ? "내렸어요" : "그대로예요"}.` + (rel != null && v !== 0 ? ` 처음 비율에 견주면 ${fmt(Math.abs(rel))}% ${v > 0 ? "증가" : "감소"}예요.` : ""), f: `${fmt(b)} − ${fmt(a)}`, rows: [["%로 본 변화 (처음 대비)", rel == null ? "처음이 0이라 계산 못 함" : `${fmt(rel)}%`]], plus: true };
  }
  return { err: "모드를 골라 주세요" };
}

let mode = "of";
const parse = (s) => { const t = String(s).replace(/[,\s원%p]/g, "").replace(/[−–]/g, "-"); return t === "" || t === "-" ? NaN : Number(t); };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function setMode(m, keep) {
  mode = MODES[m] ? m : "of";
  const M = MODES[mode];
  for (const b of $("#tabs").querySelectorAll("button")) { const on = b.dataset.m === mode; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); }
  $("#la").textContent = M.la; $("#lb").textContent = M.lb; $("#ua").textContent = M.ua; $("#ub").textContent = M.ub;
  for (const s of document.querySelectorAll(".pc-sign")) s.hidden = !M.neg;
  if (!keep) { $("#a").value = String(M.def[0]); $("#b").value = String(M.def[1]); }
  paint();
}
function paint() {
  const r = calc(mode, parse($("#a").value), parse($("#b").value));
  const e = $("#cerr");
  if (r.err) {
    e.textContent = r.err; e.hidden = false;
    $("#out").textContent = "—"; $("#outu").textContent = ""; $("#sent").textContent = ""; $("#rhead").textContent = MODES[mode].tab; $("#rrows").innerHTML = ""; $("#formula").textContent = "";
    return r;
  }
  e.hidden = true;
  $("#rhead").textContent = r.head;
  $("#out").textContent = (r.plus && r.v > 0 ? "+" : "") + fmt(r.v);
  $("#outu").textContent = r.u;
  $("#sent").textContent = r.sent;
  $("#rrows").innerHTML = r.rows.map(([k, x]) => `<div class="rr"><span>${esc(k)}</span><b>${esc(x)}</b></div>`).join("");
  $("#formula").textContent = `${r.f} = ${fmt(r.v)}${r.u}`;
  return r;
}

function init() {
  $("#tabs").addEventListener("click", (e) => { const b = e.target.closest("button[data-m]"); if (b) setMode(b.dataset.m); });
  for (const id of ["a", "b"]) $("#" + id).addEventListener("input", paint);
  document.addEventListener("click", (e) => {
    const s = e.target.closest(".pc-sign"); if (!s) return;
    e.preventDefault(); const el = $("#" + s.dataset.for), v = el.value.trim();
    el.value = v.startsWith("-") ? v.slice(1) : "-" + v; paint();
  });
  $("#copy").addEventListener("click", async () => {
    const r = paint(); if (r.err) return toast(r.err);
    toast((await copyText(`${r.head} → ${(r.plus && r.v > 0 ? "+" : "") + fmt(r.v)}${r.u}. ${r.sent}`)) ? "복사했어요" : "길게 눌러 복사해 주세요");
  });
  $("#shareBtn").addEventListener("click", async () => {
    const r = paint(); if (r.err) return toast(r.err);
    const url = `${ROOT_URL}calc/percent/?m=${mode}&a=${encodeURIComponent($("#a").value.trim())}&b=${encodeURIComponent($("#b").value.trim())}`;
    const x = await share({ title: "퍼센트 계산기", text: `${r.head} → ${(r.plus && r.v > 0 ? "+" : "") + fmt(r.v)}${r.u}`, url });
    if (x === "shared") toast("보냈어요");
  });
  const m = getParam("m"), a = getParam("a"), b = getParam("b");
  if (m && MODES[m] && a != null && b != null) {
    $("#a").value = a.slice(0, 24); $("#b").value = b.slice(0, 24); setMode(m, true);
    const c = $("#cchal"); c.hidden = false; c.innerHTML = "<b>친구가 보낸 계산</b><span>같은 숫자가 채워져 있어요. 숫자를 바꿔 보며 비교해 봐요.</span>";
  } else setMode(m && MODES[m] ? m : "of");
  renderMoreSites($("#more"), "calc/percent");
}
if (typeof document !== "undefined" && document.getElementById("tabs")) init();
