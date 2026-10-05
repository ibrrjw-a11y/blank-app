// 전광판 모션 유틸: 스플릿 플랩, 오도미터, 키네틱 헤드라인, 스프링 트윈
import { prefersReducedMotion } from "../shared/kit.js";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const DIGITS = "0123456789";
const LATIN = "ABCDEFGHJKLMNPRSTUVWXYZ";
const HANGUL = "가나다라마바사아자차카타파하경갑병정무기신임계";
const poolFor = (c) => (/\d/.test(c) ? DIGITS : /[A-Za-z]/.test(c) ? LATIN : /[가-힣]/.test(c) ? HANGUL : null);

/* ---------- 스플릿 플랩 (출발 안내판처럼 글자가 촤라락 넘어가며 멈춤) ---------- */
export function flap(el, text, { delay = 0, stagger = 45, cycles = 5, size = "" } = {}) {
  const chars = [...String(text)];
  el.classList.add("flap");
  if (size) el.dataset.size = size;
  el.setAttribute("aria-label", text);
  el.innerHTML = chars
    .map((c) => `<span class="flap__t${c === " " ? " is-sp" : ""}${/[,.:\-]/.test(c) ? " is-p" : ""}" aria-hidden="true"><span>${c === " " ? "&nbsp;" : esc(c)}</span></span>`)
    .join("");
  if (prefersReducedMotion()) return Promise.resolve();
  const tiles = Array.from(el.children);
  const timers = [];
  const done = tiles.map(
    (t, i) =>
      new Promise((res) => {
        const final = chars[i];
        const pool = poolFor(final);
        const inner = t.firstChild;
        if (!pool) return res();
        let n = cycles + (i % 3);
        inner.textContent = pool[(i * 7) % pool.length];
        const step = () => {
          t.classList.remove("is-flip", "is-land");
          void t.offsetWidth;
          if (n-- > 0) {
            inner.textContent = pool[Math.floor(Math.random() * pool.length)];
            t.classList.add("is-flip");
            timers.push(setTimeout(step, 62));
          } else {
            inner.textContent = final;
            t.classList.add("is-land");
            res();
          }
        };
        timers.push(setTimeout(step, delay + i * stagger));
      })
  );
  el._flapCancel = () => timers.forEach(clearTimeout);
  return Promise.all(done);
}

/* ---------- 오도미터 (자리별로 숫자 띠가 굴러가며 스프링으로 멈춤) ---------- */
export function odometer(el, text, { stagger = 35 } = {}) {
  const chars = [...String(text)];
  const sig = chars.map((c) => (/\d/.test(c) ? "d" : c)).join("");
  if (el.dataset.sig !== sig) {
    el.classList.add("odo");
    el.dataset.sig = sig;
    el.innerHTML = chars
      .map((c) =>
        /\d/.test(c)
          ? `<span class="odo__d" aria-hidden="true"><span class="odo__s">${DIGITS.split("").map((d) => `<span>${d}</span>`).join("")}</span></span>`
          : `<span class="odo__c" aria-hidden="true">${esc(c)}</span>`
      )
      .join("");
  }
  el.setAttribute("aria-label", text);
  const cols = Array.from(el.querySelectorAll(".odo__d .odo__s"));
  const digits = chars.filter((c) => /\d/.test(c));
  const n = cols.length;
  requestAnimationFrame(() =>
    cols.forEach((s, i) => {
      s.style.transitionDelay = prefersReducedMotion() ? "0ms" : `${(n - 1 - i) * stagger}ms`;
      s.style.transform = `translateY(${-Number(digits[i]) * 10}%)`;
    })
  );
}

/* ---------- 키네틱 헤드라인 (글자 단위로 눌렸다 튀어 오름) ---------- */
export function kinetic(el, { step = 26 } = {}) {
  const text = el.textContent;
  let i = 0;
  el.classList.add("kin");
  el.setAttribute("aria-label", text);
  el.innerHTML = text
    .split(" ")
    .map(
      (w) =>
        `<span class="kin__w" aria-hidden="true">${[...w].map((c) => `<span class="kin__c" style="animation-delay:${i++ * step}ms">${esc(c)}</span>`).join("")}</span>`
    )
    .join(" ");
}

/* ---------- 감쇠 스프링 트윈 (JS) ---------- */
// t(0~1) → 오버슈트 후 정착
export const springEase = (t) => 1 - Math.exp(-6.5 * t) * Math.cos(9.5 * t);
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function tween(ms, onFrame, { ease = easeInOut, signal } = {}) {
  return new Promise((res) => {
    if (prefersReducedMotion()) {
      onFrame(1);
      return res();
    }
    const t0 = performance.now();
    const tick = (now) => {
      if (signal?.aborted) return res();
      const t = Math.min(1, (now - t0) / ms);
      onFrame(ease(t));
      if (t < 1) requestAnimationFrame(tick);
      else res();
    };
    requestAnimationFrame(tick);
  });
}

export const wait = (ms, signal) =>
  new Promise((res) => {
    const id = setTimeout(res, ms);
    signal?.addEventListener("abort", () => (clearTimeout(id), res()));
  });
