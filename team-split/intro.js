// 첫 화면: 덱 리플 셔플 → 세 더미로 딜 → 더미가 뒤집혀 팀 공개 → "같은 팀 금지" 칩이 두 카드를 떼어 놓음
import { sleep } from "../shared/kit.js";
import { createTable, cardEl, layoutPiles, pileHead, SUITS, teamColor } from "./table.js";

const NAMES = ["민수", "철수", "영희", "지은", "하늘", "수아", "서연", "도윤", "지훈"];
// 딜 결과 (라운드 로빈): 0팀 민수·지은·서연 / 1팀 철수·하늘·도윤 / 2팀 영희·수아·지훈
const STEPS = ["① 섞고", "② 한 장씩 돌리고", "③ 뒤집으면 팀 완성", "④ 같은 팀 금지는 떼어 놓기"];

export function startIntro(root) {
  const box = root.querySelector("#introCards");
  const placard = root.querySelector("#placard");
  const table = createTable(box);
  let alive = true;
  let L = null;

  function setStep(i) {
    if (!placard) return;
    placard.textContent = STEPS[i];
    placard.classList.remove("is-swap");
    void placard.offsetWidth;
    placard.classList.add("is-swap");
  }

  const wait = async (ms) => {
    await sleep(ms);
    if (!alive) throw new Error("stop");
  };

  function measure() {
    L = layoutPiles(box.clientWidth, 3, 3, { step: 26, maxCard: 100 });
    box.style.height = `${L.height}px`;
  }

  async function once() {
    measure();
    table.clear();
    setStep(0);
    const cards = NAMES.map((name, k) => {
      const team = k % 3;
      const slot = Math.floor(k / 3);
      const c = cardEl({ name, team, slot, leader: slot === 0 });
      c.style.width = `${L.cardW}px`;
      c.style.height = `${L.cardH}px`;
      c._team = team;
      c._slot = slot;
      return table.add(c, { x: L.deck.x, y: L.deck.y - k * 0.6, r: 0 }, 10 + k);
    });
    if (table.reduced) {
      cards.forEach((c) => {
        const p = L.piles[c._team];
        table.place(c, { x: p.x, y: p.y + c._slot * L.step, r: 0 });
        table.flip(c, true);
      });
      L.piles.forEach((p, t) => box.appendChild(pileHead(t, 3, p.hx, p.hy, p.w)));
      setStep(2);
      return new Promise(() => {});
    }
    await wait(250);
    const deck = cards.slice();
    await table.riffle(deck, L.deck, { width: L.cardW, times: 2 });
    await wait(150);
    // 딜 순서는 이름 순서 그대로 (0팀, 1팀, 2팀, 0팀 …)
    setStep(1);
    const byName = (nm) => cards.find((c) => c.querySelector(".pcard__name").textContent === nm);
    const order = NAMES.map(byName);
    await Promise.all(
      order.map((c, k) => {
        const p = L.piles[c._team];
        c.style.zIndex = 30 + k;
        return table.move(c, { x: p.x + (Math.random() - 0.5) * 6, y: p.y + c._slot * 2, r: (Math.random() - 0.5) * 8 }, { dur: 420, delay: k * 130, arc: 60, spin: -24, land: true });
      })
    );
    await wait(250);
    setStep(2);
    L.piles.forEach((p, t) => {
      const h = pileHead(t, 3, p.hx, p.hy, p.w);
      box.appendChild(h);
      h.classList.add("is-in");
    });
    await Promise.all(
      order.map((c, k) => {
        setTimeout(() => table.flip(c, true), 80 + k * 60);
        const p = L.piles[c._team];
        return table.move(c, { x: p.x, y: p.y + c._slot * L.step, r: 0 }, { dur: 420, delay: k * 60, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" });
      })
    );
    await wait(900);
    // 민수(0팀 0) · 지은(0팀 1) 사이에 금지 칩 → 지은 ↔ 하늘(1팀 1) 자리 바꿈
    setStep(3);
    const ban = document.createElement("div");
    ban.className = "tchip tchip--ban";
    ban.textContent = "금지";
    const p0 = L.piles[0];
    ban.style.zIndex = 90;
    await table.slap(ban, { x: p0.x + L.cardW - 26, y: p0.y + L.step - 14 });
    const jieun = byName("지은");
    const haneul = byName("하늘");
    jieun.classList.add("is-bad");
    await wait(380);
    const p1 = L.piles[1];
    jieun.style.zIndex = 60;
    haneul.style.zIndex = 61;
    await Promise.all([
      table.move(jieun, { x: p1.x, y: p1.y + L.step, r: 0 }, { dur: 520, arc: 46, spin: 18, land: true }),
      table.move(haneul, { x: p0.x, y: p0.y + L.step, r: 0 }, { dur: 520, delay: 90, arc: 30, spin: -14, land: true }),
    ]);
    jieun.classList.remove("is-bad");
    jieun.classList.add("is-ok");
    [[jieun, 1], [haneul, 0]].forEach(([c, t]) => {
      c.style.setProperty("--team", teamColor(t));
      c.classList.toggle("is-red", t === 1 || t === 2);
      c.querySelectorAll(".pcard__idx i, .pcard__suit").forEach((el) => (el.textContent = SUITS[t]));
    });
    ban.animate([{ transform: ban.style.transform, opacity: 1 }, { transform: `${ban.style.transform} translateY(-20px)`, opacity: 0 }], { duration: 300, delay: 200, fill: "forwards" });
    await wait(1700);
  }

  (async () => {
    try {
      while (alive) await once();
    } catch {
      /* 멈춤 */
    }
  })();

  const ro = new ResizeObserver(() => {
    const w = box.clientWidth;
    if (L && Math.abs(layoutPiles(w, 3, 3, { step: 26, maxCard: 100 }).cardW - L.cardW) > 2) measure();
  });
  ro.observe(box);

  return {
    stop() {
      alive = false;
      ro.disconnect();
      table.clear();
    },
  };
}
