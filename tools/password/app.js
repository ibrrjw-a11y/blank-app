// 비밀번호 생성기(2026-10-08). 난수는 crypto.getRandomValues 만 씀(Math.random 금지).
// 만든 비밀번호는 어디에도 보내지 않고 저장하지 않음. 저장하는 것은 설정(길이·종류)뿐.
import { $, $$, toast, copyText, renderMoreSites } from "../../shared/kit.js";
import { WORDS } from "./words.js";

export const SETS = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digit: "0123456789",
  symbol: "!@#$%^&*()-_=+[]{};:,.?/~",
};
export const CONFUSING = "0O1lI";

// 0 ≤ x < n 고르게: 2^32 를 n 으로 나눈 나머지 구간은 버리고 다시 뽑음(치우침 없음)
const buf = new Uint32Array(1);
export function randInt(n) {
  if (!(n > 0 && n <= 2 ** 32)) throw new RangeError("n");
  const limit = Math.floor(2 ** 32 / n) * n;
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % n;
  }
}

// 고른 종류별 글자 묶음(헷갈리는 글자 빼기 반영)
export function classes(opt) {
  return ["lower", "upper", "digit", "symbol"].filter((k) => opt[k]).map((k) => [...SETS[k]].filter((c) => !(opt.noconf && CONFUSING.includes(c))).join(""));
}

// 랜덤 글자: 길이 L 을 전체 묶음에서 고르게 뽑고, 고른 종류가 하나라도 빠지면 통째로 다시 뽑음
// → '종류마다 하나 이상' 인 비밀번호 전체 중에서 고르게 하나를 고르는 것과 같음
export function makeChars(opt) {
  const cls = classes(opt), pool = cls.join("");
  if (!cls.length) throw new Error("종류를 하나 이상 골라 주세요.");
  if (opt.len < cls.length) throw new Error(`길이는 고른 종류 수(${cls.length}) 이상이어야 해요.`);
  for (;;) {
    let s = "";
    for (let i = 0; i < opt.len; i++) s += pool[randInt(pool.length)];
    if (cls.every((c) => [...s].some((ch) => c.includes(ch)))) return s;
  }
}

// 강도(비트) = log2(가능한 비밀번호 수). 종류마다 하나 이상 조건은 포함-배제로:
// 수 = Σ_{빠진 종류 묶음 S} (-1)^|S| (N - n_S)^L  → 비트 = L·log2 N + log2 Σ (-1)^|S| (1 - n_S/N)^L
export function charBits(opt) {
  const cls = classes(opt), N = cls.reduce((a, c) => a + c.length, 0), L = opt.len;
  if (!cls.length || L < cls.length) return 0;
  let sum = 0;
  for (let m = 0; m < 1 << cls.length; m++) {
    let n = 0, k = 0;
    cls.forEach((c, i) => { if (m & (1 << i)) { n += c.length; k++; } });
    sum += (k % 2 ? -1 : 1) * Math.pow(1 - n / N, L);
  }
  return L * Math.log2(N) + Math.log2(sum);
}

// 외우기 쉬운 단어 조합
export function makeWords(opt) {
  const ws = [];
  for (let i = 0; i < opt.count; i++) {
    const w = WORDS[randInt(WORDS.length)];
    ws.push(opt.cap ? w[0].toUpperCase() + w.slice(1) : w);
  }
  return ws.join(opt.sep) + (opt.num ? String(randInt(10)) : "");
}
export const wordBits = (opt) => opt.count * Math.log2(WORDS.length) + (opt.num ? Math.log2(10) : 0);

export function levelOf(bits) {
  if (bits < 40) return [1, "약함"];
  if (bits < 60) return [2, "보통"];
  if (bits < 80) return [3, "강함"];
  return [4, "아주 강함"];
}

// ---------- 화면 ----------
let mode = "chars";
const KEY = "gw-password-opt";
function readOpt() {
  return {
    len: Number($("#len").value), lower: $("#lower").checked, upper: $("#upper").checked, digit: $("#digit").checked, symbol: $("#symbol").checked, noconf: $("#noconf").checked,
    count: Number($("#wc").value), sep: $("#sep").value, cap: $("#cap").checked, num: $("#num").checked,
  };
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ mode, ...readOpt() })); } catch { /* 저장 안 돼도 동작 */ }
}
function load() {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!o) return;
    if (o.len >= 4 && o.len <= 64) $("#len").value = o.len;
    ["lower", "upper", "digit", "symbol", "noconf", "cap", "num"].forEach((k) => { if (typeof o[k] === "boolean") $("#" + k).checked = o[k]; });
    if (o.count >= 3 && o.count <= 8) $("#wc").value = o.count;
    if (["-", ".", "_", " ", ""].includes(o.sep)) $("#sep").value = o.sep;
    if (o.mode === "words") mode = "words";
  } catch { /* 무시 */ }
}
function setMode(m) {
  mode = m;
  $$(".pw-tabs button").forEach((b) => { const on = b.dataset.mode === m; b.classList.toggle("on", on); b.setAttribute("aria-selected", String(on)); });
  $("#optChars").hidden = m !== "chars"; $("#optWords").hidden = m !== "words";
}
function render() {
  const o = readOpt();
  $("#lenV").textContent = o.len; $("#wcV").textContent = o.count;
  const err = $("#perr");
  let pw, bits;
  try {
    if (mode === "chars") { pw = makeChars(o); bits = charBits(o); }
    else { pw = makeWords(o); bits = wordBits(o); }
    err.hidden = true;
  } catch (e) {
    err.textContent = e.message; err.hidden = false;
    $("#pw").textContent = ""; $("#bits").textContent = "0"; $("#level").textContent = "-"; $("#meter").dataset.level = "0";
    return;
  }
  const [lv, name] = levelOf(bits);
  $("#pw").textContent = pw;
  $("#pw").classList.toggle("pw-long", pw.length > 28);
  $("#bits").textContent = bits.toFixed(1);
  $("#level").textContent = name;
  $("#meter").dataset.level = String(lv);
  $("#meter").style.setProperty("--p", Math.min(1, bits / 128).toFixed(3));
  save();
}
function init() {
  load(); setMode(mode);
  $(".pw-tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-mode]"); if (b) { setMode(b.dataset.mode); render(); } });
  ["#optChars", "#optWords"].forEach((s) => $(s).addEventListener("input", render));
  $("#again").addEventListener("click", render);
  $("#copy").addEventListener("click", async () => {
    const t = $("#pw").textContent;
    if (!t) return;
    const ok = await copyText(t);
    toast(ok ? "복사됨" : "복사가 막혀 있어요. 비밀번호를 길게 눌러 복사해 주세요.");
  });
  render();
  renderMoreSites($("#more"), "tools/password");
}
init();
