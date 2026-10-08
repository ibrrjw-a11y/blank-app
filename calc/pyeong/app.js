// 평수 계산기(2026-10-08). 평 ↔ ㎡ 양방향. 1평 = 400/121㎡ (한 변 6자, 1자 = 10/33m)
// 400/121 이 적힌 법령 원문은 찾지 못함 — 화면 근거 표에 '확인 못 함'으로 표시
import { $, toast, copyText, share, renderMoreSites, ROOT_URL, getParam } from "../../shared/kit.js";

const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
export function fmt(n, d = 2) {
  if (!Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e15) { const [m, e] = a.toExponential(3).split("e"); return (n < 0 ? "-" : "") + m.replace(/\.?0+$/, "") + "×10" + String(Number(e)).replace(/./g, (c) => SUP[c]); }
  let s = a.toFixed(d); if (s.includes(".")) s = s.replace(/\.?0+$/, "");
  const [i, f] = s.split(".");
  const out = i.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (f ? "." + f : "");
  return (n < 0 && out !== "0" ? "-" : "") + out;
}
export const toM2 = (p) => (p * 400) / 121;
export const toPy = (m) => (m * 121) / 400;

const parse = (s) => { const t = String(s).replace(/[,\s평㎡]/g, ""); return t === "" ? NaN : Number(t); };
let from = "py";

function paint() {
  const src = from === "py" ? $("#py") : $("#m2"), dst = from === "py" ? $("#m2") : $("#py");
  const v = parse(src.value), e = $("#cerr");
  const bad = !Number.isFinite(v) ? (src.value.trim() ? "숫자로 넣어 주세요" : "") : v < 0 ? "0 이상으로 넣어 주세요" : v >= 1e15 ? "1,000조보다 작은 수로 넣어 주세요" : "";
  if (bad || !Number.isFinite(v)) {
    e.textContent = bad; e.hidden = !bad; dst.value = "";
    $("#out").textContent = "—"; $("#outu").textContent = ""; $("#sent").textContent = ""; $("#rhead").textContent = "숫자를 넣어 주세요";
    return null;
  }
  e.hidden = true;
  const r = from === "py" ? toM2(v) : toPy(v);
  const shown = fmt(r);
  dst.value = r >= 1e15 ? String(r) : shown.replace(/,/g, "");
  $("#rhead").textContent = from === "py" ? `${fmt(v)}평은` : `${fmt(v)}㎡는`;
  $("#out").textContent = shown;
  $("#outu").textContent = from === "py" ? "㎡" : "평";
  $("#sent").textContent = from === "py" ? `${fmt(v)} × 400 ÷ 121 = ${shown}㎡` : `${fmt(v)} × 121 ÷ 400 = ${shown}평`;
  const pi = from === "py" ? v : r;
  for (const row of document.querySelectorAll("#ptable [data-p]")) row.classList.toggle("on", Number(row.dataset.p) === Math.round(pi * 100) / 100);
  return { v, r, shown };
}

function init() {
  $("#ptable").innerHTML = `<div class="py-th"><span>평</span><span>㎡</span></div>` + Array.from({ length: 51 }, (_, k) => k + 10).map((p) => `<button type="button" class="py-tr" data-p="${p}"><span>${p}평</span><b>${fmt(toM2(p))}㎡</b></button>`).join("");
  $("#py").addEventListener("input", () => { from = "py"; paint(); });
  $("#m2").addEventListener("input", () => { from = "m2"; paint(); });
  const pick = (e) => {
    const b = e.target.closest("[data-p],[data-m]"); if (!b) return;
    if (b.dataset.p) { from = "py"; $("#py").value = b.dataset.p; } else { from = "m2"; $("#m2").value = b.dataset.m; }
    paint();
    if (b.closest("#ptable")) $("#py").scrollIntoView({ block: "center", behavior: "smooth" });
  };
  $("#chips").addEventListener("click", pick);
  $("#ptable").addEventListener("click", pick);
  $("#copy").addEventListener("click", async () => {
    const r = paint(); if (!r) return toast("숫자를 넣어 주세요");
    const s = from === "py" ? `${fmt(r.v)}평 = ${r.shown}㎡` : `${fmt(r.v)}㎡ = ${r.shown}평`;
    toast((await copyText(s)) ? "복사했어요" : "길게 눌러 복사해 주세요");
  });
  $("#shareBtn").addEventListener("click", async () => {
    const r = paint(); if (!r) return toast("숫자를 넣어 주세요");
    const url = `${ROOT_URL}calc/pyeong/?${from === "py" ? "p" : "m"}=${encodeURIComponent(String(r.v))}`;
    const x = await share({ title: "평수 계산기", text: from === "py" ? `${fmt(r.v)}평 = ${r.shown}㎡` : `${fmt(r.v)}㎡ = ${r.shown}평`, url });
    if (x === "shared") toast("보냈어요");
  });
  const p = getParam("p"), m = getParam("m");
  if (p != null || m != null) {
    if (p != null) { from = "py"; $("#py").value = p.slice(0, 20); } else { from = "m2"; $("#m2").value = m.slice(0, 20); }
    const c = $("#cchal"); c.hidden = false; c.innerHTML = "<b>친구가 보낸 평수</b><span>같은 숫자가 채워져 있어요. 우리 집이랑 비교해 봐요.</span>";
  }
  paint();
  renderMoreSites($("#more"), "calc/pyeong");
}
if (typeof document !== "undefined" && document.getElementById("py")) init();
