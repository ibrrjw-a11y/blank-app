// 펠트 테이블 위 카드: 만들기, 리플 셔플, 아치 그리며 날아가는 딜, 뒤집기, 칩 내려놓기
import { prefersReducedMotion } from "../shared/kit.js";

export const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q"];
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const OUT = "cubic-bezier(0.2, 0.7, 0.2, 1)";

export const teamColor = (t) => `var(--chip-${(t % 10) + 1})`;
export const teamName = (t) => `${t + 1}팀`;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function cardEl({ name, team = 0, slot = 0, leader = false }) {
  const el = document.createElement("div");
  const suit = SUITS[team % 4];
  const red = suit === "♥" || suit === "♦";
  const rank = leader ? "K" : RANKS[slot % RANKS.length];
  el.className = `pcard${red ? " is-red" : ""}${leader ? " is-leader" : ""}`;
  el.style.setProperty("--team", teamColor(team));
  el.innerHTML = `<div class="pcard__inner">
      <div class="pcard__back"></div>
      <div class="pcard__face">
        <span class="pcard__top"><span class="pcard__idx">${rank}<i>${suit}</i></span><b class="pcard__name">${esc(name)}</b></span>
        <span class="pcard__suit" aria-hidden="true">${suit}</span>
        ${leader ? '<span class="pcard__tag">팀장</span>' : ""}
      </div>
    </div>`;
  return el;
}

export function createTable(root) {
  const pos = new Map();
  const reduced = prefersReducedMotion();
  const T = (p) => `translate(${p.x}px, ${p.y}px) rotate(${p.r || 0}deg) scale(${p.sx ?? 1}, ${p.sy ?? 1})`;

  function place(card, p) {
    pos.set(card, { x: p.x, y: p.y, r: p.r || 0 });
    card.style.transform = T(p);
  }

  function add(card, p, z = 1) {
    root.appendChild(card);
    card.style.zIndex = z;
    place(card, p);
    return card;
  }

  // 아치를 그리며 이동 (arc: 위로 뜨는 높이, land: 착지 스쿼시)
  async function move(card, p, { dur = 420, delay = 0, arc = 0, spin = 0, land = false, easing = OUT } = {}) {
    const from = pos.get(card) || { x: 0, y: 0, r: 0 };
    const to = { x: p.x, y: p.y, r: p.r || 0 };
    if (reduced || dur <= 0) {
      place(card, to);
      return;
    }
    const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - arc, r: from.r + (to.r - from.r) / 2 + spin, sx: 1.06, sy: 1.06 };
    const kf = [{ transform: T(from) }];
    if (arc || spin) kf.push({ transform: T(mid), offset: 0.45 });
    if (land) {
      kf.push({ transform: T({ ...to, sx: 1.08, sy: 0.9 }), offset: 0.82 });
      kf.push({ transform: T({ ...to, sx: 0.98, sy: 1.03 }), offset: 0.92 });
    }
    kf.push({ transform: T(to) });
    pos.set(card, to);
    const a = card.animate(kf, { duration: dur, delay, easing, fill: "both" });
    try {
      await a.finished;
    } catch {
      /* 취소됨 */
    }
    card.style.transform = T(to);
    a.cancel();
  }

  // 리플 셔플: 덱을 반으로 갈라 양쪽으로 → 한 장씩 엇갈려 다시 모음
  async function riffle(cards, deck, { width = 80, times = 1 } = {}) {
    for (let r = 0; r < times; r++) {
      const half = Math.ceil(cards.length / 2);
      const L = cards.slice(0, half);
      const R = cards.slice(half);
      await Promise.all([
        ...L.map((c, k) => move(c, { x: deck.x - width * 0.55, y: deck.y - k * 0.6, r: -8 }, { dur: 260, easing: SPRING })),
        ...R.map((c, k) => move(c, { x: deck.x + width * 0.55, y: deck.y - k * 0.6, r: 8 }, { dur: 260, easing: SPRING })),
      ]);
      const mixed = [];
      for (let k = 0; k < Math.max(L.length, R.length); k++) {
        if (L[k]) mixed.push(L[k]);
        if (R[k]) mixed.push(R[k]);
      }
      const gap = Math.max(6, Math.min(22, 360 / mixed.length));
      await Promise.all(
        mixed.map((c, k) => {
          c.style.zIndex = 10 + k;
          return move(c, { x: deck.x, y: deck.y - k * 0.6, r: 0 }, { dur: 300, delay: k * gap, arc: 10, easing: SPRING });
        })
      );
      cards.splice(0, cards.length, ...mixed);
    }
  }

  function flip(card, up = true) {
    card.classList.toggle("is-up", up);
  }

  // 칩 내려치기 (위에서 커졌다가 탁)
  async function slap(el, p) {
    root.appendChild(el);
    el.style.transform = T(p);
    if (reduced) return;
    const a = el.animate(
      [
        { transform: `${T({ ...p, y: p.y - 70 })} scale(1.9)`, opacity: 0 },
        { transform: `${T(p)} scale(1.15, 0.8)`, opacity: 1, offset: 0.55 },
        { transform: `${T(p)} scale(0.95, 1.05)`, offset: 0.78 },
        { transform: T(p) },
      ],
      { duration: 460, easing: OUT }
    );
    try {
      await a.finished;
    } catch {
      /* noop */
    }
  }

  function clear() {
    root.querySelectorAll(".pcard, .tchip, .pile-head").forEach((el) => el.remove());
    pos.clear();
  }

  return { add, place, move, riffle, flip, slap, clear, root, reduced };
}

// 팀 더미 위치 계산
export function layoutPiles(width, k, maxCount, { step = 28, maxCard = 124, top = 0 } = {}) {
  const cols = k <= 1 ? 1 : k === 2 || k === 4 ? 2 : 3;
  const gap = 10;
  const colW = (width - gap * (cols - 1)) / cols;
  const cardW = Math.round(Math.min(colW - 6, maxCard));
  const cardH = Math.round(cardW * 1.36);
  const headH = 40;
  const deckArea = top + cardH + 30;
  const pileH = headH + cardH + Math.max(0, maxCount - 1) * step + 14;
  const rows = Math.ceil(k / cols);
  const piles = Array.from({ length: k }, (_, t) => {
    const cx = (t % cols) * (colW + gap);
    const cy = deckArea + Math.floor(t / cols) * (pileH + gap);
    return { hx: cx, hy: cy, w: colW, x: cx + (colW - cardW) / 2, y: cy + headH };
  });
  return {
    cols, colW, cardW, cardH, step, piles,
    deck: { x: width / 2 - cardW / 2, y: top + 14 },
    height: deckArea + rows * (pileH + gap),
  };
}

export function pileHead(t, count, x, y, w) {
  const el = document.createElement("div");
  el.className = "pile-head";
  el.style.setProperty("--team", teamColor(t));
  el.style.width = `${w}px`;
  el.style.transform = `translate(${x}px, ${y}px)`;
  el.innerHTML = `<span class="tchip tchip--sm" aria-hidden="true"></span><b>${teamName(t)}</b><span>${count}명</span>`;
  return el;
}
