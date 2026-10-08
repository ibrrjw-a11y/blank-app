// 만 나이 계산기(2026-10-08). 날짜는 전부 '한국 날짜' — 서울 시간대로 오늘을 정하고, 날짜끼리는 시각 없이 정수 날짜로만 셈
import { $, share, toast, renderMoreSites, ROOT_URL, prefersReducedMotion } from "../../shared/kit.js";

const RM = prefersReducedMotion();
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const n0 = (x) => Number(x).toLocaleString("ko-KR");

// ---------- 날짜 도우미 ----------
export const kstToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const D = (y, m, d) => Math.round(Date.UTC(y, m - 1, d) / 864e5);
const parse = (iso) => iso.split("-").map(Number);
const ymd = (n) => { const x = new Date(n * 864e5); return [x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()]; };
const leap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const dim = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const WD = ["일", "월", "화", "수", "목", "금", "토"];
const fmtD = (n) => { const [y, m, d] = ymd(n); return `${y}년 ${m}월 ${d}일 (${WD[new Date(n * 864e5).getUTCDay()]})`; };
// Y년에 '한 살 늘어나는 날'. 2월 29일생은 평년이면 3월 1일(민법 제160조 제3항 단서 해석)
export const anniv = (bm, bd, Y) => (bm === 2 && bd === 29 && !leap(Y) ? D(Y, 3, 1) : D(Y, bm, bd));
// k개월이 '다 찬' 날: 같은 날짜, 그 달에 같은 날이 없으면 다음 달 1일(2월 29일생 규칙과 같은 해석 — 민법 제160조 제3항 단서로 말일에 기간이 끝나므로 그다음 날)
const addMonths = (n, k) => { const [y, m, d] = ymd(n); const t = y * 12 + (m - 1) + k, Y = Math.floor(t / 12), M = (t % 12) + 1; return d <= dim(Y, M) ? D(Y, M, d) : D(Y, M, dim(Y, M)) + 1; };

export const ANIMALS = ["쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지"];
export const zodiacAnimal = (y) => ANIMALS[(((y - 4) % 12) + 12) % 12];
// 음력 설(음력 1월 1일)의 양력 날짜 1900~2050. 한국천문연구원 천문우주지식정보 음양력 변환(astro.kasi.re.kr/life/lunc/between)에서
// 2026-10-08 받은 값을 그대로 담음(한 해당 3글자 = 월 1자리 + 일 2자리). 계산·기억으로 채운 칸 없음
export const SEOL0 = 1900, SEOL = "131219208129216204125213202122210130218206126214204123211201220208128216205124213202123210130217206126214204124211131219208127215205126213202122210129217206127214204124212131219208128215205125213202122209130217206127215203123211131218207128216205125213202220209129218206127215204123210131219208128216205124212201122209129218207126214203123210131219208128216205125212201122210129217207127213203123211131219208128215204124212201122210130217206126214202123";
export const seolOf = (y) => (y >= SEOL0 && y < SEOL0 + SEOL.length / 3 ? [Number(SEOL[(y - SEOL0) * 3]), Number(SEOL.substr((y - SEOL0) * 3 + 1, 2))] : null);
// 별자리(서양 점성술 관습 표 — 경계일은 해·출처마다 하루쯤 다름)
export const SIGNS = [[1, 20, "물병자리"], [2, 19, "물고기자리"], [3, 21, "양자리"], [4, 20, "황소자리"], [5, 21, "쌍둥이자리"], [6, 22, "게자리"], [7, 23, "사자자리"], [8, 23, "처녀자리"], [9, 23, "천칭자리"], [10, 23, "전갈자리"], [11, 22, "사수자리"], [12, 22, "염소자리"]];
export function sign(m, d) {
  let s = "염소자리";
  for (const [sm, sd, nm] of SIGNS) if (m > sm || (m === sm && d >= sd)) s = nm;
  const edge = SIGNS.find(([sm, sd]) => (m === sm && (d === sd || d === sd - 1)));
  return { s, edge: !!edge };
}

// 보험나이 사용 여부(원문 확인되면 true)
export const INS = true;

// ---------- 계산(화면 없음) ----------
export function ageAll(birthIso, refIso) {
  const [by, bm, bd] = parse(birthIso), [ry, rm, rd] = parse(refIso);
  const b = D(by, bm, bd), r = D(ry, rm, rd);
  if (r < b) return null;
  const man = ry - by - (r < anniv(bm, bd, ry) ? 1 : 0);
  let next = anniv(bm, bd, ry); if (next < r) next = anniv(bm, bd, ry + 1);
  // 만 0세면 개월 수(태어난 날 기준 달력 개월)
  let months = 0; while (addMonths(b, months + 1) <= r) months++;
  // 보험나이: 만 나이에서 6개월 이상 끝수는 1년으로(상령일 = 최근 생일 + 6개월)
  const half = addMonths(b, 12 * man + 6); // 태어난 날부터 '만 나이 + 6개월'이 다 찬 날
  const ins = man + (r >= half ? 1 : 0);
  const nextHalf = r >= half ? addMonths(b, 12 * (man + 1) + 6) : half;
  return {
    lunar: (() => { const s = seolOf(by); return s ? zodiacAnimal(b < D(by, s[0], s[1]) ? by - 1 : by) : null; })(), seol: seolOf(by),
    man, months, yeon: ry - by, seneun: ry - by + 1, animal: zodiacAnimal(by), prevAnimal: zodiacAnimal(by - 1), sign: sign(bm, bd),
    nextBirthday: next, dTo: next - r, livedDays: r - b + 1, ins, nextHalf, feb29: bm === 2 && bd === 29, early: bm <= 2,
  };
}

// ---------- 화면 ----------
const row = (k, v) => `<div class="rr" data-k="${esc(k)}"><span>${esc(k)}</span><b>${esc(v)}</b></div>`;
function run() {
  const bi = $("#birth").value, re = $("#ref").value, e = $("#cerr");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bi) || !/^\d{4}-\d{2}-\d{2}$/.test(re)) { e.textContent = "생년월일과 기준일을 넣어 주세요"; e.hidden = false; return; }
  if (Number(bi.slice(0, 4)) < 1900) { e.textContent = "1900년 이후 생년월일을 넣어 주세요"; e.hidden = false; return; }
  const a = ageAll(bi, re);
  if (!a) { e.textContent = "기준일이 생년월일보다 앞이에요"; e.hidden = false; return; }
  e.hidden = true;
  const today = re === kstToday();
  $("#rhead").textContent = `${fmtD(D(...parse(bi)))}생 · ${today ? "오늘" : fmtD(D(...parse(re)))} 기준`;
  $("#rval").textContent = `만 ${a.man}세`;
  $("#rsub").textContent = a.man === 0 ? `태어난 지 ${a.months}개월` : a.dTo === 0 ? "오늘이 생일이에요" : `다음 생일까지 ${n0(a.dTo)}일`;
  const rows = [
    ["만 나이", `${a.man}세${a.man === 0 ? ` (${a.months}개월)` : ""}`],
    ["연 나이(올해 − 태어난 해)", `${a.yeon}세`],
    ["세는 나이", `${a.seneun}세`],
    ["띠(양력 1월 1일 기준)", `${a.animal}띠`],
    ["띠(음력 설 기준)", a.lunar ? `${a.lunar}띠` : "1900~2050년생만 계산"],
    ["별자리", a.sign.s],
    ["다음 생일", `${fmtD(a.nextBirthday)} · ${a.dTo === 0 ? "D-day" : `D-${n0(a.dTo)}`}`],
    ["태어난 날을 1일째로 세면", `${n0(a.livedDays)}일째`],
  ];
  if (INS) rows.push(["보험나이(6개월 기준)", `${a.ins}세 · 다음에 바뀌는 날(상령일) ${fmtD(a.nextHalf)}`]);
  $("#rrows").innerHTML = rows.map(([k, v]) => row(k, v)).join("");
  const warn = [], notes0 = [];
  if (a.lunar && a.lunar !== a.animal) warn.push(`띠가 기준마다 달라요. 양력 1월 1일 기준으로는 ${a.animal}띠, 음력 설 기준으로는 ${a.lunar}띠예요(태어난 해 설날 ${a.seol[0]}월 ${a.seol[1]}일보다 먼저 태어남). 어느 쪽을 쓸지는 쓰는 곳마다 달라요.`);
  else if (a.early) notes0.push(`1~2월생은 기준에 따라 띠가 갈릴 수 있는데, 태어난 해 설날(${a.seol ? `${a.seol[0]}월 ${a.seol[1]}일` : "표 범위 밖"})${a.seol ? " 뒤에 태어나서 양력·음력 기준 띠가 같아요" : ""}. 사주에서 쓰는 입춘 기준은 넣지 않았어요.`);
  if (a.feb29) warn.push("2월 29일생은 평년에 3월 1일에 한 살이 늘어나는 것으로 계산했어요(민법 기간 계산 규칙 해석). 기관에 따라 2월 28일로 보기도 해요.");
  $("#rwarn").hidden = !warn.length; $("#rwarn").textContent = warn.join(" ");
  const notes = [...notes0];
  if (a.sign.edge) notes.push("별자리 경계일 근처예요. 해마다 태양이 별자리에 들어가는 날이 하루쯤 달라서, 출처에 따라 옆 별자리로 보기도 해요.");
  notes.push("연 나이는 청소년 보호법·병역법처럼 '그해 1월 1일' 기준을 쓰는 법에서 나이를 따질 때 써요.");
  $("#rnotes").innerHTML = notes.map((t) => `<li>${esc(t)}</li>`).join("");
  for (const s of ["cin", "cres"]) $("#" + s).hidden = s !== "cres";
  $("#cres").scrollIntoView({ block: "start", behavior: RM ? "auto" : "smooth" });
}

export const BASIS = [
  ["만 나이", "태어난 날부터 0세, 생일마다 +1. 1세 미만은 개월로도 표시", "행정기본법 제7조의2 · 민법 제158조 (2023-06-28 시행) — '출생일을 산입하여 만 나이로 계산', 1세 미만은 월수 표시 가능", "확정"],
  ["연 나이", "기준 연도 − 태어난 연도", "청소년 보호법 제2조 제1호 · 병역법 제2조 제2항", "확정"],
  ["세는 나이", "연 나이 + 1", "법적 근거 없는 생활 관습(옛 한국식 나이)", "관습"],
  ["2월 29일생", "평년에는 3월 1일에 +1", "민법 제160조 제3항 단서(해당일이 없으면 그 달 말일에 기간 만료) 해석", "해석"],
  ["띠(양력)", "양력 1월 1일 기준, (태어난 해 − 4) ÷ 12 의 나머지", "2020년 = 쥐띠. 한국천문연구원 간지 표와 1900~2050년 모두 일치 확인", "확정"],
  ["띠(음력 설)", "태어난 날이 그해 설날보다 앞이면 전 해 띠", "1900~2050년 설날의 양력 날짜: 한국천문연구원 천문우주지식정보 음양력 변환(2026-10-08 받음)", "확정"],
  ["띠(입춘)", "넣지 않음", "사주·명리에서 쓰는 기준. 해마다 입춘 시각 자료가 필요해 이번에는 뺌", "안 넣음"],
  ["별자리", "물병 1/20 · 물고기 2/19 · 양 3/21 · 황소 4/20 · 쌍둥이 5/21 · 게 6/22 · 사자 7/23 · 처녀 8/23 · 천칭 9/23 · 전갈 10/23 · 사수 11/22 · 염소 12/22 부터", "서양 점성술 관습 표. 공식 기준 없음, 출처마다 경계일이 하루쯤 다름", "관습"],
  ["보험나이", "계약일 현재 만 나이, 6개월 미만 끝수는 버리고 6개월 이상은 1년으로", "보험업감독업무시행세칙 별표15 표준약관 — 생명보험 제21조 제2항, 질병·상해보험 제23조 제2항. 원문 예시: 1988-10-02생, 계약일 2014-04-13 → 25년 6월 11일 → 26세", "확정"],
  ["상령일", "태어난 날부터 (만 나이 × 12 + 6)개월이 다 찬 날(그 달에 같은 날이 없으면 다음 달 1일)", "보험업계에서 보험나이가 바뀌는 날을 부르는 말. 약관 문장은 '6개월 이상 끝수는 1년'", "해석"],
];
function basis() {
  $("#cbasis").innerHTML = `<summary>계산 근거</summary><table><thead><tr><th>항목</th><th>계산</th><th>근거</th><th>확인</th></tr></thead><tbody>${BASIS.filter((b) => INS || b[0] !== "보험나이").map((b) => `<tr>${b.map((x) => `<td>${esc(x)}</td>`).join("")}</tr>`).join("")}</tbody></table><p>날짜는 한국 날짜(서울 시간대) 기준이에요.</p>`;
}

function init() {
  $("#ref").value = kstToday();
  basis();
  $("#today").addEventListener("click", () => { $("#ref").value = kstToday(); });
  $("#go").addEventListener("click", run);
  $("#back").addEventListener("click", () => { for (const s of ["cin", "cres"]) $("#" + s).hidden = s !== "cin"; });
  // 생년월일은 링크에 담지 않음(개인정보)
  $("#cshare").addEventListener("click", async () => { const r = await share({ title: "만 나이 계산기", text: "만 나이·연 나이·띠·별자리, 생일까지 며칠?", url: `${ROOT_URL}calc/age/` }); if (r === "shared") toast("보냈어요"); });
  renderMoreSites($("#more"), "calc/age");
}
if (typeof document !== "undefined" && document.getElementById("birth")) init();
