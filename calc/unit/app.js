// 단위 변환기(2026-10-08). 길이·무게·넓이·온도·부피. 환산값 출처는 NIST SP 811 부록 B.8(굵은 글씨 = 정확한 값)과 표준국어대사전.
// 근거를 못 찾은 값(한국 요리 컵 200mL, 돈 3.75g 의 공식 원문)은 화면 근거 표에 '확인 못 함'으로 표시
import { $, toast, copyText, share, renderMoreSites, ROOT_URL, getParam } from "../../shared/kit.js";

// f = 기준 단위(길이 m, 무게 g, 넓이 ㎡, 부피 mL)로 몇인지. 온도는 따로 계산
export const CATS = {
  len: { name: "길이", def: [1, "in", "cm"], units: {
    mm: { n: "밀리미터", s: "mm", f: 0.001 }, cm: { n: "센티미터", s: "cm", f: 0.01 }, m: { n: "미터", s: "m", f: 1 }, km: { n: "킬로미터", s: "km", f: 1000 },
    in: { n: "인치", s: "in", f: 0.0254 }, ft: { n: "피트", s: "ft", f: 0.3048 }, yd: { n: "야드", s: "yd", f: 0.9144 }, mi: { n: "마일", s: "mi", f: 1609.344 } } },
  wt: { name: "무게", def: [1, "lb", "kg"], units: {
    g: { n: "그램", s: "g", f: 1 }, kg: { n: "킬로그램", s: "kg", f: 1000 }, lb: { n: "파운드", s: "lb", f: 453.59237 }, oz: { n: "온스", s: "oz", f: 28.349523125 },
    geun: { n: "근(고기·한약재)", s: "근", f: 600 }, geunv: { n: "근(과일·채소)", s: "근", f: 375 }, don: { n: "돈", s: "돈", f: 3.75 } } },
  area: { name: "넓이", def: [1, "acre", "py"], units: {
    m2: { n: "제곱미터", s: "㎡", f: 1 }, py: { n: "평", s: "평", f: 400 / 121 }, acre: { n: "에이커", s: "ac", f: 4046.8564224 }, ha: { n: "헥타르", s: "ha", f: 10000 } } },
  temp: { name: "온도", def: [100, "F", "C"], units: { C: { n: "섭씨", s: "℃" }, F: { n: "화씨", s: "℉" }, K: { n: "켈빈", s: "K" } } },
  vol: { name: "부피", def: [1, "gal", "L"], units: {
    mL: { n: "밀리리터", s: "mL", f: 1 }, L: { n: "리터", s: "L", f: 1000 }, gal: { n: "갤런(미국)", s: "gal", f: 3785.411784 }, ukgal: { n: "갤런(영국)", s: "gal", f: 4546.09 },
    cup: { n: "컵(미국)", s: "컵", f: 236.5882365 }, kcup: { n: "컵(한국 요리)", s: "컵", f: 200 } } },
};
export const BASIS = {
  len: [["인치", "2.54cm", "NIST SP 811 부록 B.8 (정확한 값)", "확인함"], ["피트", "0.3048m", "NIST SP 811 부록 B.8 (정확한 값)", "확인함"], ["야드", "0.9144m", "NIST SP 811 부록 B.8 (정확한 값)", "확인함"], ["마일", "1,609.344m", "NIST SP 811 부록 B.8, 국제 마일 (정확한 값)", "확인함"]],
  wt: [["파운드", "453.59237g", "NIST SP 811 부록 B.8 표는 0.4535924kg 까지 적음. 끝자리까지의 값 0.45359237kg 은 1959년 국제 야드·파운드 협정값", "표 값 확인함, 협정 원문은 안 봄"], ["온스", "28.349523125g", "1/16 파운드. NIST SP 811 부록 B.8 표는 28.34952g 까지 적음", "확인함"], ["근(고기·한약재)", "600g", "표준국어대사전 '근': 고기나 한약재는 600그램", "사전 확인, 법령 원문 확인 못 함"], ["근(과일·채소)", "375g", "표준국어대사전 '근': 과일·채소는 한 관의 10분의 1로 375그램", "사전 확인, 법령 원문 확인 못 함"], ["돈", "3.75g", "귀금속·한약재에서 널리 쓰는 값. 사전·법령 원문은 찾지 못함", "확인 못 함"]],
  area: [["평", "400/121㎡ ≈ 3.305785㎡", "한 변 6자, 1자 = 10/33m. 표준국어대사전 '평' 약 3.3058㎡. 400/121 이 적힌 법령 원문은 찾지 못함", "사전 확인, 법령 원문 확인 못 함"], ["에이커", "4,046.8564224㎡", "국제 피트 기준 43,560 제곱피트(0.3048m 로 계산). NIST SP 811 부록 B.8 표는 미국 측량 피트 기준 4,046.873㎡ 만 적음 — 둘은 약 0.016㎡ 차이", "확인함"], ["헥타르", "10,000㎡", "NIST SP 811 부록 B.8 (정확한 값)", "확인함"]],
  temp: [["화씨", "℉ = ℃ × 9/5 + 32", "NIST SP 811 부록 B.8: t/℃ = (t/℉ − 32)/1.8", "확인함"], ["켈빈", "K = ℃ + 273.15", "NIST SP 811 부록 B.8: T/K = t/℃ + 273.15", "확인함"]],
  vol: [["갤런(미국)", "3.785411784L", "231 세제곱인치. NIST SP 811 부록 B.8 표는 3.785412L 까지 적음", "확인함"], ["갤런(영국)", "4.54609L", "NIST SP 811 부록 B.8 (정확한 값)", "확인함"], ["컵(미국)", "236.5882365mL", "미국 갤런의 1/16. NIST SP 811 부록 B.8 표는 236.5882mL 까지 적음", "확인함"], ["컵(한국 요리)", "200mL", "한국 요리책·계량컵에서 흔히 쓰는 값. 공식 근거는 찾지 못함", "확인 못 함"]],
};

const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
// 0.01 이상 1,000조 미만은 소수 넷째 자리까지(끝 0 지움), 그 밖은 a.bcd×10ⁿ
export function fmt(n) {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "0";
  const a = Math.abs(n);
  if (a >= 1e15 || a < 0.01) { const [m, e] = a.toExponential(3).split("e"); return (n < 0 ? "-" : "") + m.replace(/\.?0+$/, "") + "×10" + String(Number(e)).replace(/./g, (c) => SUP[c]); }
  let s = a.toFixed(4); if (s.includes(".")) s = s.replace(/\.?0+$/, "");
  const [i, f] = s.split(".");
  const out = i.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (f ? "." + f : "");
  return (n < 0 && out !== "0" ? "-" : "") + out;
}
export function convert(cat, v, from, to) {
  if (cat === "temp") {
    const c = from === "F" ? ((v - 32) * 5) / 9 : from === "K" ? v - 273.15 : v;
    return to === "F" ? (c * 9) / 5 + 32 : to === "K" ? c + 273.15 : c;
  }
  const U = CATS[cat].units;
  return (v * U[from].f) / U[to].f;
}
export function check(cat, v, from) {
  if (!Number.isFinite(v)) return "숫자를 넣어 주세요";
  if (Math.abs(v) >= 1e15) return "1,000조보다 작은 수로 넣어 주세요";
  if (cat === "temp") return convert("temp", v, from, "K") < 0 ? "절대영도(-273.15℃)보다 낮은 온도는 없어요" : "";
  return v < 0 ? "0 이상으로 넣어 주세요" : "";
}

let cat = "len";
const parse = (s) => { const t = String(s).replace(/[,\s]/g, "").replace(/[−–]/g, "-"); return t === "" || t === "-" ? NaN : Number(t); };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const label = (k) => CATS[cat].units[k].n;

function setCat(c, keep) {
  cat = CATS[c] ? c : "len";
  const C = CATS[cat], opts = Object.keys(C.units).map((k) => `<option value="${k}">${esc(label(k))}</option>`).join("");
  for (const b of $("#cats").querySelectorAll("button")) { const on = b.dataset.c === cat; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); }
  $("#from").innerHTML = opts; $("#to").innerHTML = opts;
  if (!keep) { $("#v").value = String(C.def[0]); $("#from").value = C.def[1]; $("#to").value = C.def[2]; }
  $("#sign").hidden = cat !== "temp";
  $("#basis").innerHTML = `<summary>환산값 근거 · ${C.name}</summary><table><thead><tr><th>단위</th><th>값</th><th>근거</th><th>확인</th></tr></thead><tbody>${BASIS[cat].map((r) => `<tr>${r.map((x) => `<td>${esc(x)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  paint();
}
function paint() {
  const v = parse($("#v").value), f = $("#from").value, t = $("#to").value, bad = check(cat, v, f), e = $("#cerr");
  if (bad) {
    e.textContent = bad; e.hidden = false;
    $("#out").textContent = "—"; $("#outu").textContent = ""; $("#rhead").textContent = ""; $("#all").innerHTML = "";
    return null;
  }
  e.hidden = true;
  const r = convert(cat, v, f, t), U = CATS[cat].units;
  $("#rhead").textContent = `${fmt(v)} ${U[f].n}는`;
  $("#out").textContent = fmt(r);
  $("#outu").textContent = U[t].s === "컵" || U[t].s === "근" ? `${U[t].s} · ${U[t].n}` : U[t].s;
  $("#all").innerHTML = Object.keys(U).filter((k) => k !== f).map((k) => `<button type="button" class="rr un-row${k === t ? " on" : ""}" data-u="${k}"><span>${esc(U[k].n)}</span><b>${esc(fmt(convert(cat, v, f, k)))} ${esc(U[k].s)}</b></button>`).join("");
  return { v, r, f, t };
}

function init() {
  $("#cats").addEventListener("click", (e) => { const b = e.target.closest("button[data-c]"); if (b) setCat(b.dataset.c); });
  $("#v").addEventListener("input", paint);
  $("#from").addEventListener("change", paint);
  $("#to").addEventListener("change", paint);
  $("#swap").addEventListener("click", () => {
    const r = paint(), f = $("#from").value;
    $("#from").value = $("#to").value; $("#to").value = f;
    if (r) $("#v").value = fmt(r.r).includes("×") ? String(r.r) : fmt(r.r).replace(/,/g, "");
    paint();
  });
  $("#sign").addEventListener("click", () => { const v = $("#v").value.trim(); $("#v").value = v.startsWith("-") ? v.slice(1) : "-" + v; paint(); });
  $("#all").addEventListener("click", (e) => { const b = e.target.closest("[data-u]"); if (b) { $("#to").value = b.dataset.u; paint(); } });
  const text = (r) => `${fmt(r.v)} ${CATS[cat].units[r.f].n} = ${fmt(r.r)} ${CATS[cat].units[r.t].n}`;
  $("#copy").addEventListener("click", async () => { const r = paint(); if (!r) return toast("숫자를 확인해 주세요"); toast((await copyText(text(r))) ? "복사했어요" : "길게 눌러 복사해 주세요"); });
  $("#shareBtn").addEventListener("click", async () => {
    const r = paint(); if (!r) return toast("숫자를 확인해 주세요");
    const url = `${ROOT_URL}calc/unit/?c=${cat}&v=${encodeURIComponent(String(r.v))}&f=${r.f}&t=${r.t}`;
    const x = await share({ title: "단위 변환기", text: text(r), url });
    if (x === "shared") toast("보냈어요");
  });
  const c = getParam("c");
  if (c && CATS[c]) {
    setCat(c);
    const v = getParam("v"), f = getParam("f"), t = getParam("t"), U = CATS[c].units;
    if (v != null) $("#v").value = v.slice(0, 24);
    if (f && U[f]) $("#from").value = f;
    if (t && U[t]) $("#to").value = t;
    const ch = $("#cchal"); ch.hidden = false; ch.innerHTML = "<b>친구가 보낸 변환</b><span>같은 값이 채워져 있어요.</span>";
    paint();
  } else setCat("len");
  renderMoreSites($("#more"), "calc/unit");
}
if (typeof document !== "undefined" && document.getElementById("cats")) init();
