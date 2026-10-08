// 강아지·고양이 나이 계산기(2026-10-08). 원문 확인한 출처만 씀. 출처마다 숫자가 다르면 한 줄씩 나란히, 정답 하나로 합치지 않음
//  강아지: Wang 외 2020 Cell Systems 11(2):176 공식 16·ln(개 나이)+31 (1살 이상만) · 미국수의사회(AVMA) 크기별 노령 시작 나이 · AVMA 2019 그림 표(7·10·15·20살만) · 미국동물병원협회(AAHA) 2019 생애단계
//  고양이: 국제고양이보호단체(iCatCare) 나이 표(0개월~25살) · AVMA 2019 그림 표 · AAHA/AAFP 2021 생애단계 · iCatCare 6단계
import { $, share, toast, renderMoreSites, ROOT_URL, getParam, createCanvas, roundRect, shareImage, CANVAS_FONT, prefersReducedMotion } from "../../shared/kit.js";

const RM = prefersReducedMotion();
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const r1 = (x) => Math.round(x * 10) / 10;

// iCatCare 표: [고양이 개월 수, 사람 나이] — 원문 값 그대로(0~1개월 = 0~1살)
export const ICC = [[1, 1], [2, 2], [3, 4], [4, 6], [5, 8], [6, 10], [7, 12], [12, 15], [18, 21], [24, 24],
  ...Array.from({ length: 23 }, (_, k) => [(k + 3) * 12, 28 + k * 4])]; // 3살=28 … 25살=116
// AVMA 2019 그림 표(Estimated Human Equivalents for Older Pets): 개는 작은 개~아주 큰 개 범위, 고양이는 한 값
export const AVMA19 = { dog: { 7: [44, 56], 10: [56, 78], 15: [76, 115], 20: [96, 120] }, cat: { 7: 54, 10: 63, 15: 78, 20: 97 } };
// AVMA 현재 페이지: 크기별로 노령으로 보는 나이
export const AVMA_SENIOR = { s: [8, 11, "소형"], m: [8, 10, "중형"], l: [8, 9, "대형"], g: [6, 7, "초대형"] };

export const wang = (years) => (years >= 1 ? 16 * Math.log(years) + 31 : null);
// 고양이: 표에 있는 값이면 그대로, 표 사이는 직선 어림, 25살 넘으면 '1년마다 4살' 규칙을 이어 씀
export function catHuman(months) {
  if (months <= 1) return { v: months === 0 ? 0 : 1, range: "0~1살", exact: true };
  const hit = ICC.find(([m]) => m === months);
  if (hit) return { v: hit[1], exact: true };
  if (months > 300) return { v: 116 + (months - 300) / 12 * 4, exact: false, beyond: true };
  const k = ICC.findIndex(([m]) => m > months), [m0, h0] = ICC[k - 1], [m1, h1] = ICC[k];
  return { v: h0 + (h1 - h0) * (months - m0) / (m1 - m0), exact: false };
}
export function dogStage(months) {
  if (months < 6) return "강아지(퍼피)";
  if (months <= 9) return "강아지 끝 무렵(급성장이 끝나는 6~9개월, 견종마다 다름)";
  if (months < 36) return "청년";
  if (months < 48) return "청년 끝 무렵(대부분 3~4살에 다 자람)";
  return "성견 이상(노령은 기대수명의 마지막 25% — 나이로 정하지 않음)";
}
export function catStageAAHA(y) { return y < 1 ? "새끼(1살 미만)" : y <= 6 ? "청년(1~6살)" : y <= 10 ? "성묘(7~10살)" : "노령(10살 넘음)"; }
export function catStageICC(months) {
  const y = Math.floor(months / 12);
  return months <= 6 ? "새끼(0~6개월)" : y <= 2 ? "주니어(7개월~2살)" : y <= 6 ? "어른(3~6살)" : y <= 10 ? "성숙(7~10살)" : y <= 14 ? "노령(11~14살)" : "초고령(15살 이상)";
}
export function seniorStatus(y, size) {
  const [lo, hi, nm] = AVMA_SENIOR[size];
  return `${y < lo ? "아직 노령기 전" : y <= hi ? "노령기에 들어서는 나이" : "노령기"} (${nm}은 ${lo}~${hi}살부터 노령)`;
}

// 결과 한 벌(화면 없음)
export function compute(kind, y, m, size) {
  const months = y * 12 + m, years = months / 12, rows = [], notes = [];
  let main = null, mainText = "", label = "", warn = "";
  if (kind === "dog") {
    const w = wang(years);
    if (w == null) { mainText = "1살 미만"; label = "Wang 공식은 1살부터 써요"; warn = "Wang 외(2020) 공식은 1살 미만 강아지에게는 쓰지 않았어요(어릴수록 값이 급히 작아지고 생후 약 7주 아래는 0보다 작아져요). 원문 예시로는 생후 약 8주 강아지가 사람 약 9개월 아기와 비슷해요."; }
    else { main = Math.round(w); mainText = `약 ${main}살`; label = "Wang 외(2020) 개 노화 연구 공식 기준"; }
    rows.push(["Wang 외(2020) 공식 16·ln(나이)+31", w == null ? "1살 미만은 쓰지 않음" : `${r1(w)}살`]);
    if (m === 0 && AVMA19.dog[y]) rows.push(["미국수의사회 2019 그림 표(작은 개~아주 큰 개)", `${AVMA19.dog[y][0]}~${AVMA19.dog[y][1]}살`]);
    rows.push(["미국수의사회 크기별 노령 시작", seniorStatus(y, size)]);
    rows.push(["미국동물병원협회 2019 생애단계", dogStage(months)]);
    rows.push(["흔한 '1년 = 7살' 계산(근거 약함)", `${r1(years * 7)}살`]);
    notes.push("Wang 공식은 래브라도 리트리버 위주 연구에서 나왔어요. 크기·견종이 다르면 덜 맞을 수 있어요.");
    if (!(m === 0 && AVMA19.dog[y])) notes.push("미국수의사회 2019 그림 표는 7·10·15·20살 칸만 있어서, 그 나이일 때만 보여 줘요.");
  } else {
    const c = catHuman(months);
    main = Math.round(c.v); mainText = c.range || `${c.exact ? "" : "약 "}${main}살`; label = "국제고양이보호단체(iCatCare) 표 기준";
    rows.push(["국제고양이보호단체 표", `${c.range || `${c.exact ? c.v : r1(c.v)}살`}${c.exact ? "" : c.beyond ? " (25살 넘음 — 규칙을 이어 어림)" : " (표 사이 어림)"}`]);
    if (m === 0 && AVMA19.cat[y] != null) rows.push(["미국수의사회 2019 그림 표", `${AVMA19.cat[y]}살`]);
    rows.push(["미국동물병원협회·미국고양이수의사회 2021 생애단계", catStageAAHA(y)]);
    rows.push(["국제고양이보호단체 6단계", catStageICC(months)]);
    if (!c.exact) notes.push(c.beyond ? "표는 25살(사람 116살)까지예요. 그 뒤는 '1년마다 사람 4살' 규칙을 이어서 어림했어요." : "표에 없는 개월 수라 앞뒤 칸 사이를 직선으로 어림했어요.");
    if (m === 0 && AVMA19.cat[y] != null && AVMA19.cat[y] !== c.v) warn = `같은 ${y}살인데 국제고양이보호단체 표는 ${c.v}살, 미국수의사회 2019 그림 표는 ${AVMA19.cat[y]}살이에요. 방식에 따라 달라요.`;
  }
  if (kind === "dog" && main != null && m === 0 && AVMA19.dog[y]) warn = `같은 ${y}살인데 Wang 공식은 ${r1(wang(years))}살, 미국수의사회 2019 그림 표는 ${AVMA19.dog[y][0]}~${AVMA19.dog[y][1]}살이에요. 방식에 따라 달라요.`;
  return { main, mainText, label, rows, notes, warn };
}

// ---------- 화면 ----------
let kind = "dog", R = null;
const josa = (w, a, b) => { const c = w.charCodeAt(w.length - 1); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? a : b; };
const who = () => { const n = $("#pname").value.trim(); return n || `우리 집 ${kind === "dog" ? "강아지" : "고양이"}`; };
const paintKind = () => { $("#kind").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.v === kind)); $("#sizeBox").hidden = kind !== "dog"; };
const err = (t) => { const e = $("#cerr"); e.textContent = t; e.hidden = false; };

function run() {
  const y = Number(String($("#py").value).trim() || "0"), m = Number(String($("#pm").value).trim() || "0");
  if (!Number.isInteger(y) || y < 0 || y > 30) return err("나이는 0~30살 사이 정수로 넣어 주세요");
  if (!Number.isInteger(m) || m < 0 || m > 11) return err("개월은 0~11 사이로 넣어 주세요");
  if (y === 0 && m === 0) return err("나이나 개월을 넣어 주세요");
  $("#cerr").hidden = true;
  R = compute(kind, y, m, $("#psize").value);
  const w = who();
  $("#c1").textContent = `${w}${josa(w, "은", "는")} 사람으로 치면`;
  $("#rval").textContent = R.mainText;
  $("#c3").textContent = `${R.label} · 출처마다 달라요`;
  $("#rrows").innerHTML = R.rows.map(([k, v]) => `<div class="rr" data-k="${esc(k)}"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("");
  $("#rwarn").hidden = !R.warn; $("#rwarn").textContent = R.warn;
  $("#rnotes").innerHTML = R.notes.map((t) => `<li>${esc(t)}</li>`).join("");
  for (const s of ["cin", "cres"]) $("#" + s).hidden = s !== "cres";
  $("#cres").scrollIntoView({ block: "start", behavior: RM ? "auto" : "smooth" });
}

function card() {
  const W = 1080 / 2, H = 1080 / 2, { canvas, ctx } = createCanvas(W, H, 2);
  ctx.fillStyle = "#f2efe8"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#fffdf8"; ctx.strokeStyle = "#141414"; ctx.lineWidth = 4; roundRect(ctx, 30, 30, W - 60, H - 60, 28); ctx.fill(); ctx.stroke();
  ctx.fillStyle = kind === "dog" ? "#c2410c" : "#7c3aed"; ctx.font = `900 22px ${CANVAS_FONT}`; ctx.textAlign = "center";
  ctx.fillText(kind === "dog" ? "강아지 나이 계산기" : "고양이 나이 계산기", W / 2, 96);
  ctx.fillStyle = "#141414"; ctx.font = `800 28px ${CANVAS_FONT}`; ctx.fillText($("#c1").textContent, W / 2, 190);
  ctx.font = `900 92px ${CANVAS_FONT}`; ctx.fillText(R.mainText, W / 2, 300);
  ctx.fillStyle = "#5d5850"; ctx.font = `700 18px ${CANVAS_FONT}`; ctx.fillText(R.label, W / 2, 370); ctx.fillText("출처마다 달라요 · guesswhat.co.kr/calc/pet-age", W / 2, 400);
  return canvas;
}

function init() {
  const g = (k) => getParam(k);
  if (g("k") === "cat" || g("k") === "dog") {
    kind = g("k");
    if (/^\d{1,2}$/.test(g("y") || "")) $("#py").value = g("y");
    if (/^\d{1,2}$/.test(g("m") || "")) $("#pm").value = g("m");
    if (["s", "m", "l", "g"].includes(g("s"))) $("#psize").value = g("s");
    $("#pname").value = (g("n") || "").slice(0, 12);
  }
  paintKind();
  $("#kind").addEventListener("click", (e) => { const b = e.target.closest("button[data-v]"); if (b) { kind = b.dataset.v; paintKind(); } });
  $("#go").addEventListener("click", run);
  $("#back").addEventListener("click", () => { for (const s of ["cin", "cres"]) $("#" + s).hidden = s !== "cin"; });
  $("#cimg").addEventListener("click", () => shareImage(card(), { filename: "pet-age.png", title: "사람 나이로 치면", text: `${$("#c1").textContent} ${R.mainText}` }));
  $("#cshare").addEventListener("click", async () => {
    const p = new URLSearchParams({ k: kind, y: $("#py").value, m: $("#pm").value, s: $("#psize").value });
    if ($("#pname").value.trim()) p.set("n", $("#pname").value.trim());
    const r = await share({ title: "강아지·고양이 나이 계산기", text: `${$("#c1").textContent} ${R.mainText}! 너희 집 아이는?`, url: `${ROOT_URL}calc/pet-age/?${p}` });
    if (r === "shared") toast("보냈어요");
  });
  $("#cbasis").innerHTML = `<summary>계산 근거</summary><table><thead><tr><th>무엇을</th><th>어떤 원문</th><th>확인</th></tr></thead><tbody>
    <tr><td>강아지 사람 나이</td><td>Wang T 외, "Quantitative Translation of Dog-to-Human Aging by Conserved Remodeling of the DNA Methylome", Cell Systems 2020;11(2):176–185, doi 10.1016/j.cels.2020.06.006 — 사람 나이 = 16 ln(개 나이) + 31. 래브라도 리트리버 위주 104마리(분석 95마리), 개 0.1~16살 자료</td><td>확정</td></tr>
    <tr><td>1살 미만 강아지</td><td>공식이 생후 약 7주 아래에서 0보다 작아져서 1살 미만엔 쓰지 않기로 우리가 정함(원문 규칙 아님)</td><td>우리 규칙</td></tr>
    <tr><td>크기별 노령 시작</td><td>미국수의사회(AVMA) Senior pets 페이지 — 소형(20파운드 미만) 8~11살, 중형(20~50) 8~10살, 대형(50~90) 8~9살, 초대형(90 초과) 6~7살, 고양이 10살 이후</td><td>확정</td></tr>
    <tr><td>AVMA 2019 그림 표</td><td>"Estimated Human Equivalents for Older Pets" — 개 7살 44~56, 10살 56~78, 15살 76~115, 20살 96~120 / 고양이 7살 54, 10살 63, 15살 78, 20살 97. 2019년 보관본에서 확인, 지금 AVMA 사이트에는 없음</td><td>확정(옛 자료)</td></tr>
    <tr><td>강아지 생애단계</td><td>미국동물병원협회(AAHA) 2019 Canine Life Stage Guidelines(Creevy 외, JAAHA 55(6)) 표 1 — 강아지: 급성장 끝(약 6~9개월)까지, 청년: 다 자랄 때(대부분 3~4살)까지, 노령: 기대수명의 마지막 25%</td><td>확정</td></tr>
    <tr><td>고양이 사람 나이</td><td>International Cat Care "How to tell your cat's age in human years" — 처음 2년 = 사람 24년, 그 뒤 1년마다 4년. 0개월~25살 표</td><td>확정</td></tr>
    <tr><td>표 사이 개월</td><td>앞뒤 칸을 직선으로 이은 어림</td><td>추정</td></tr>
    <tr><td>고양이 생애단계</td><td>2021 AAHA/AAFP Feline Life Stage Guidelines(Quimby 외, JFMS 23(3)) 표 1 — 새끼 ~1살, 청년 1~6살, 성묘 7~10살, 노령 10살 넘음</td><td>확정</td></tr>
    <tr><td>'1년 = 7살'</td><td>미국수의사회: 개는 1년에 사람 7년씩 나이 들지 않음 — 비교용으로만 보여 줌</td><td>근거 약함</td></tr>
  </tbody></table><p>건강 상태·노령 관리 시기는 동물병원에서 확인해 주세요.</p>`;
  renderMoreSites($("#more"), "calc/pet-age");
  if (g("k")) run();
}
if (typeof document !== "undefined" && document.getElementById("kind")) init();
