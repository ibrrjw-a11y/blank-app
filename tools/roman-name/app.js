// 영문 이름 변환기(2026-10-08). 한글 성·이름 → 로마자
// 기준: 문화체육관광부 고시 「국어의 로마자 표기법」(제2000-8호 제정, 제2014-42호 일부개정)
//  - 제2장 제1항: 모음 대응표. [붙임 1] 'ㅢ'는 'ㅣ'로 소리 나더라도 ui
//  - 제2장 제2항: 자음 대응표. [붙임 1] ㄱ·ㄷ·ㅂ은 모음 앞 g·d·b, 자음 앞·어말 k·t·p
//                              [붙임 2] ㄹ은 모음 앞 r, 자음 앞·어말 l, 단 'ㄹㄹ'은 ll
//  - 제3장 제3항: 고유 명사는 첫 글자를 대문자로
//  - 제3장 제4항: 인명은 성과 이름의 순서로 띄어 씀. 이름은 붙여 쓰는 것이 원칙, 음절 사이 붙임표(-) 허용
//                 (1) 이름에서 일어나는 음운 변화는 표기에 반영하지 않음 (한복남 Han Boknam, 홍빛나 Hong Bitna)
//                 (2) 성의 표기는 따로 정한다 → 공식으로 정해진 성씨 표기가 없으므로 성도 대응표대로만 적음
//  - 제3장 제7항: 인명 등은 그동안 써 온 표기를 쓸 수 있음(화면 안내로만)
// 음운 변화를 반영하지 않으므로 이름은 음절마다 따로 바꿔 이어 붙인다(받침은 늘 받침 소리 k·t·p·l…).
// 같은 방식의 공공기관 지침: 국립중앙도서관 「서지데이터 로마자 표기 지침」(2021) 4.2.1 인명 — "음운 변동을 적용하지 않고 음절별로 변환"(정약용 Jeong Yakyong, 필운 Pilun)
// 'ㄹㄹ → ll'(제2장 제2항 붙임 2)은 소리 변화가 아니라 글자 대응 규칙이라 이름에도 적용한다(사람 확인 필요 항목).
import { $, share, toast, copyText, renderMoreSites } from "../../shared/kit.js";

// 제2장 제2항 — 첫소리(초성 19자 순서: ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ)
const INI = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
// 제2장 제1항 — 모음(중성 21자 순서: ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ)
const VOW = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
// 받침(종성 28자 순서: 없음 ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ)
// 받침은 대표음으로: 제2장 제2항 [붙임 1] 어말·자음 앞 k·t·p, [붙임 2] 어말·자음 앞 l. 겹받침은 대표음(ㄼ은 l로 둠 — 사람 확인 항목)
const FIN = ["", "k", "k", "k", "n", "n", "n", "t", "l", "k", "m", "l", "l", "l", "p", "l", "m", "p", "p", "t", "t", "ng", "t", "t", "k", "t", "p", "t"];
const FIN_RIEUL = new Set([8, 9, 10, 11, 12, 13, 14, 15]); // 받침 끝 소리가 ㄹ로 끝나는 글자(ㄹ, ㄹ계열 겹받침 중 l로 적는 것만 아래에서 다시 확인)
const INI_NAME = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const VOW_NAME = ["ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ", "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ", "ㅣ"];
const FIN_NAME = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

export const isHangulSyllable = (ch) => /^[가-힣]$/.test(ch);
function split(ch) {
  const c = ch.charCodeAt(0) - 0xac00;
  return { i: Math.floor(c / 588), v: Math.floor((c % 588) / 28), f: c % 28 };
}

// 음절마다 로마자 조각을 만든다(음운 변화 미반영). prevEndsL: 앞 글자 받침이 l 로 적혔는지 → ㄹㄹ 은 ll
export function syllables(word) {
  const out = [];
  let prevL = false;
  for (const ch of word) {
    const { i, v, f } = split(ch);
    let ini = INI[i];
    if (i === 5 && prevL) ini = "l"; // 제2장 제2항 [붙임 2] 단서: 'ㄹㄹ'은 'll'
    const fin = FIN[f];
    out.push({ ch, ini, vow: VOW[v], fin, rom: ini + VOW[v] + fin, jamo: [INI_NAME[i], VOW_NAME[v], FIN_NAME[f]].filter(Boolean).join(" ") });
    prevL = FIN_RIEUL.has(f) && fin === "l";
  }
  return out;
}
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
// 한 단어(이름·성)를 로마자로. hyphen: 음절 사이 붙임표(제3장 제4항 허용 표기)
export function romanizeWord(word, { hyphen = false } = {}) {
  const parts = syllables(word).map((s) => s.rom);
  return cap(parts.join(hyphen ? "-" : ""));
}
// 인명 전체: 성 + 띄어쓰기 + 이름(제3장 제4항)
export function romanizeName(sur, given, { hyphen = false } = {}) {
  return `${romanizeWord(sur)} ${romanizeWord(given, { hyphen })}`;
}
export function candidates(sur, given) {
  const s = romanizeWord(sur), g = romanizeWord(given), gh = romanizeWord(given, { hyphen: true });
  const list = [{ k: "표기법 원칙 (이름 붙여 쓰기)", v: `${s} ${g}`, ref: "제3장 제4항" }];
  if (given.length > 1) list.push({ k: "음절 사이 붙임표 (허용 표기)", v: `${s} ${gh}`, ref: "제3장 제4항 ( ) 안 허용" });
  list.push({ k: "모두 대문자로 쓰면", v: `${s} ${g}`.toUpperCase(), ref: "글자는 같고 대소문자만 다름" });
  list.push({ k: "이름을 앞에 쓰는 양식일 때", v: `${g} ${s}`, ref: "표기법 순서는 성 먼저" });
  return list;
}

// ---------- 화면 ----------
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
function check(v, what, max) {
  const t = v.replace(/\s+/g, "");
  if (!t) return `${what}을 넣어 주세요.`;
  if (![...t].every(isHangulSyllable)) return `${what}은 완성된 한글 글자로만 넣어 주세요. (예: 민, 용하)`;
  if (t.length > max) return `${what}은 ${max}글자까지 넣을 수 있어요.`;
  return "";
}
function show() {
  const sur = $("#sur").value.replace(/\s+/g, ""), given = $("#given").value.replace(/\s+/g, "");
  const e = check(sur, "성", 2) || check(given, "이름", 4);
  const er = $("#rerr");
  if (e) { er.textContent = e; er.hidden = false; return; }
  er.hidden = true;
  const list = candidates(sur, given);
  $("#rhead").textContent = `${sur}${given}`;
  $("#rmain").textContent = list[0].v;
  $("#rlist").innerHTML = list.slice(1).map((c, n) => `<li><span class="rn-k">${esc(c.k)}</span><b class="rn-v" data-n="${n + 1}">${esc(c.v)}</b><button class="rn-copy" type="button" data-copy="${n + 1}">복사</button><small>${esc(c.ref)}</small></li>`).join("");
  const rows = [...syllables(sur).map((s) => ({ ...s, who: "성" })), ...syllables(given).map((s) => ({ ...s, who: "이름" }))];
  $("#rsyl").innerHTML = `<tr><th>글자</th><th>자모</th><th>로마자</th></tr>` + rows.map((s) => `<tr><td>${esc(s.ch)} <small>${s.who}</small></td><td>${esc(s.jamo)}</td><td><b>${esc(s.rom)}</b></td></tr>`).join("");
  $("#rsur").textContent = `성 '${sur}'은 표기법 글자 대응대로 ${romanizeWord(sur)}로 적었어요. 표기법은 성의 표기를 따로 정한다고만 했고(제3장 제4항 (2)) 공식으로 정해진 성씨 표기는 아직 없어요. 이미 쓰던 성 표기가 있다면 그 표기를 쓸 수 있어요(제3장 제7항).`;
  $("#rin").hidden = true; $("#rres").hidden = false;
  window.scrollTo(0, 0);
  show.list = list;
}

function init() {
  $("#rform").addEventListener("submit", (e) => { e.preventDefault(); show(); });
  $("#rres").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-copy],[data-copy-main]");
    if (!b || !show.list) return;
    const n = b.hasAttribute("data-copy-main") ? 0 : Number(b.dataset.copy);
    const ok = await copyText(show.list[n].v);
    toast(ok ? `복사됨: ${show.list[n].v}` : "복사가 막혀 있어요. 글자를 길게 눌러 복사해 주세요.");
  });
  $("#back").addEventListener("click", () => { $("#rres").hidden = true; $("#rin").hidden = false; $("#given").focus(); });
  $("#shareBtn").addEventListener("click", () => share({ title: "영문 이름 변환기", text: "내 이름 로마자로 어떻게 쓰는지 바로 나와", url: location.origin + location.pathname }));
  renderMoreSites($("#more"), "tools/roman-name");
}
init();
