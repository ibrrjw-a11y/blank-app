// 인생 진행률 · 만나이 계산기 공용 (날짜 계산, 오도미터, 생년월일 입력)
// /life-progress/ 와 /life-progress/age/ 가 같이 쓴다. 생년월일은 같은 저장소("life-progress")에 둔다.
import { prefersReducedMotion } from "../shared/kit.js";

export const DAY = 86400000;
export const YEAR_DAYS = 365.2425;
export const WD = ["일", "월", "화", "수", "목", "금", "토"];
export const ZODIAC = ["쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지"];
export const DEFAULT_LIFE = 83.5; // 통계청 2023년 생명표 기대수명

/* ---------- 날짜 ---------- */
export const pad = (n) => String(n).padStart(2, "0");
export const key = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
export const parts = (k) => k.split("-").map(Number);
export const toUTC = (k) => {
  const [y, m, d] = parts(k);
  return Date.UTC(y, m - 1, d);
};
export const fromUTC = (ms) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (k, n) => fromUTC(toUTC(k) + n * DAY);
export const diffDays = (a, b) => Math.round((toUTC(b) - toUTC(a)) / DAY);
export const weekday = (k) => WD[new Date(toUTC(k)).getUTCDay()];
export const dotDate = (k) => k.replaceAll("-", ".");
export const longDate = (k) => `${dotDate(k)} (${weekday(k)})`;
export const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
export function validKey(y, m, d) {
  if (!(y >= 1900 && m >= 1 && m <= 12 && d >= 1)) return null;
  const dim = [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  return d <= dim ? key(y, m, d) : null;
}
// 그 해의 생일. 2월 29일생은 평년에 3월 1일로 봐요 (민법 기간 계산 방식)
export function birthdayIn(birth, y) {
  const [, m, d] = parts(birth);
  if (m === 2 && d === 29 && !isLeap(y)) return key(y, 3, 1);
  return key(y, m, d);
}
export function manAge(birth, asOf) {
  const [by] = parts(birth);
  const [y] = parts(asOf);
  return y - by - (asOf < birthdayIn(birth, y) ? 1 : 0);
}
export function nextBirthday(birth, asOf) {
  const [y] = parts(asOf);
  let b = birthdayIn(birth, y);
  if (b < asOf) b = birthdayIn(birth, y + 1);
  return b;
}
export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const token = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
export function alpha(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// 자리별로 굴러가는 숫자 (스프링은 CSS)
export function odometer(el, text) {
  if (el.dataset.odo === text) return;
  el.dataset.odo = text;
  el.classList.add("odo");
  el.classList.remove("is-on");
  el.setAttribute("aria-label", text);
  const strip = "01234567890123456789"
    .split("")
    .map((n) => `<span>${n}</span>`)
    .join("");
  let k = 0;
  el.innerHTML = [...text]
    .map((ch) =>
      /\d/.test(ch)
        ? `<span class="odo__col" aria-hidden="true" style="--d:${ch};--i:${k++}"><span class="odo__strip">${strip}</span></span>`
        : `<span class="odo__ch" aria-hidden="true">${ch}</span>`,
    )
    .join("");
  if (prefersReducedMotion()) return el.classList.add("is-on");
  void el.offsetWidth;
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("is-on")));
}


/* ---------- 생년월일 입력 ---------- */
export function parseBirth(raw) {
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length !== 8) return null;
  return validKey(Number(digits.slice(0, 4)), Number(digits.slice(4, 6)), Number(digits.slice(6, 8)));
}
export function formatBirthInput(raw) {
  const d = String(raw).replace(/\D/g, "").slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}.${d.slice(4)}`;
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6)}`;
}
export const zodiacOf = (y) => ZODIAC[(((y - 4) % 12) + 12) % 12];
