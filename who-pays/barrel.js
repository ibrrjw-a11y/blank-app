// 통아저씨 모드: 차례대로 구멍을 고르고, 해적이 튀어나오면 당첨
import { haptic, seededRandom, shuffle, sleep, prefersReducedMotion } from "../shared/kit.js";
import { randomSeed, escapeHtml, headline, penaltyEmoji } from "./common.js";

// 통 일러스트 (SVG 내부 장식색)
const BARREL_SVG = `
<svg class="barrel__svg" viewBox="0 0 300 320" preserveAspectRatio="none" aria-hidden="true">
  <defs>
    <linearGradient id="wood" x1="0" x2="1">
      <stop offset="0" style="stop-color:var(--art-wood-1)"/><stop offset=".22" style="stop-color:var(--art-wood-2)"/>
      <stop offset=".5" style="stop-color:var(--art-wood-3)"/><stop offset=".78" style="stop-color:var(--art-wood-2)"/>
      <stop offset="1" style="stop-color:var(--art-wood-1)"/>
    </linearGradient>
    <linearGradient id="hoop" x1="0" x2="1">
      <stop offset="0" style="stop-color:var(--art-hoop-1)"/><stop offset=".5" style="stop-color:var(--art-hoop-2)"/><stop offset="1" style="stop-color:var(--art-hoop-1)"/>
    </linearGradient>
  </defs>
  <path d="M40 20 Q6 162 40 306 L260 306 Q294 162 260 20 Z" fill="url(#wood)"/>
  <g style="stroke:var(--art-wood-line)" stroke-width="2" opacity=".55" fill="none">
    <path d="M84 20 Q70 162 84 306"/><path d="M126 20 Q121 162 126 306"/>
    <path d="M174 20 Q179 162 174 306"/><path d="M216 20 Q230 162 216 306"/>
  </g>
  <path d="M30 50 Q150 62 270 50 L273 66 Q150 78 27 66 Z" fill="url(#hoop)"/>
  <path d="M26 262 Q150 274 274 262 L271 278 Q150 290 29 278 Z" fill="url(#hoop)"/>
  <ellipse cx="150" cy="20" rx="110" ry="14" style="fill:var(--art-rim)"/>
  <ellipse cx="150" cy="18" rx="98" ry="9" style="fill:var(--art-hole)"/>
</svg>`;

const PIRATE_SVG = `
<svg class="barrel__pirate-svg" viewBox="0 0 120 120" aria-hidden="true">
  <circle cx="60" cy="68" r="40" style="fill:var(--art-skin)"/>
  <path d="M18 58 Q60 6 102 58 Q60 44 18 58 Z" style="fill:var(--brand)"/>
  <circle cx="98" cy="60" r="7" style="fill:var(--brand)"/>
  <path d="M104 62 l12 10 M104 62 l14 -2" style="stroke:var(--brand)" stroke-width="5" stroke-linecap="round"/>
  <circle cx="44" cy="66" r="11" style="fill:var(--art-ink)"/>
  <path d="M22 54 L86 80" style="stroke:var(--art-ink)" stroke-width="3"/>
  <circle cx="76" cy="66" r="6" style="fill:var(--art-chalk)"/><circle cx="77" cy="67" r="3.4" style="fill:var(--art-ink)"/>
  <path d="M40 88 Q60 100 82 86" style="stroke:var(--art-wood-1)" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M44 84 Q60 78 78 84" style="stroke:var(--art-rim)" stroke-width="5" fill="none" stroke-linecap="round"/>
</svg>`;

export function startBarrel({ stage, tray: trayEl, players, penalty, onDone }) {
  const n = players.length;
  const total = n * 2;
  const rand = seededRandom(randomSeed());
  const turnOrder = shuffle([...Array(n).keys()], rand);
  const popSlot = Math.floor(rand() * total); // 모든 구멍이 같은 확률
  const stabs = Array(n).fill(0);
  let turn = 0;
  let busy = false;
  let stopped = false;
  const cols = total <= 8 ? 4 : total <= 16 ? 4 : 5;

  trayEl.innerHTML = `<div class="barrel-order" aria-label="차례">
    ${turnOrder.map((pi, k) => `<span class="barrel-order__chip" data-k="${k}" style="--pc:${players[pi].color}">${escapeHtml(players[pi].name)}</span>`).join("")}
  </div>`;

  stage.innerHTML = `
    <div class="barrel">
      <div class="barrel__turn" aria-live="polite"></div>
      <div class="barrel__scene">
        <div class="barrel__pirate">${PIRATE_SVG}</div>
        ${BARREL_SVG}
        <div class="barrel__holes" style="--cols:${cols}">
          ${Array.from({ length: total }, (_, k) => `<button class="hole" data-k="${k}" aria-label="${k + 1}번 구멍"><span class="hole__in"></span></button>`).join("")}
        </div>
        <div class="barrel__burst" aria-hidden="true"></div>
      </div>
      <p class="barrel__note t-caption-01 t-tertiary">해적을 튀어나오게 한 사람이 당첨이에요 · 구멍 ${total}개 중 하나</p>
    </div>`;

  const turnEl = stage.querySelector(".barrel__turn");
  const scene = stage.querySelector(".barrel__scene");
  const chips = [...trayEl.querySelectorAll(".barrel-order__chip")];

  function showTurn() {
    const p = players[turnOrder[turn % n]];
    turnEl.innerHTML = `
      <span class="barrel__dot" style="--pc:${p.color}"></span>
      <span class="t-title-03"><b>${escapeHtml(p.name)}</b> 차례예요</span>
      <span class="t-body-03 t-secondary">폰을 넘겨받고 칼 꽂을 구멍을 골라요</span>`;
    turnEl.classList.remove("fade-swap");
    void turnEl.offsetWidth;
    turnEl.classList.add("fade-swap");
    chips.forEach((c, k) => c.classList.toggle("is-on", k === turn % n));
    chips[turn % n]?.scrollIntoView?.({ inline: "center", block: "nearest", behavior: "smooth" });
  }

  scene.querySelectorAll(".hole").forEach((b) =>
    b.addEventListener("click", async () => {
      if (busy || stopped || b.classList.contains("is-used")) return;
      busy = true;
      const k = Number(b.dataset.k);
      const pi = turnOrder[turn % n];
      stabs[pi]++;
      b.classList.add("is-used");
      b.disabled = true;
      haptic(15);
      scene.classList.remove("is-wobble");
      void scene.offsetWidth;
      scene.classList.add("is-wobble");
      await sleep(prefersReducedMotion() ? 50 : 480);
      if (stopped) return;
      if (k === popSlot) {
        pop(pi);
      } else {
        const float = document.createElement("span");
        float.className = "barrel__float";
        float.textContent = ["휴~ 살았다!", "통과!", "세이프!", "두근두근…"][Math.floor(Math.random() * 4)];
        scene.appendChild(float);
        setTimeout(() => float.remove(), 1000);
        turn++;
        showTurn();
        busy = false;
      }
    })
  );

  async function pop(pi) {
    scene.classList.add("is-popped");
    haptic([60, 40, 220]);
    const burst = scene.querySelector(".barrel__burst");
    burst.innerHTML = Array.from({ length: 14 }, (_, k) => `<i style="--a:${(k / 14) * 360}deg;--d:${60 + (k % 3) * 30}px"></i>`).join("");
    turnEl.innerHTML = `<span class="t-title-02 barrel__win">${penaltyEmoji(penalty)} ${escapeHtml(headline(players[pi].name, penalty))}</span>
      <span class="t-body-03 t-secondary">${turn + 1}번째 칼에서 해적이 튀어나왔어요</span>`;
    await sleep(2200);
    if (stopped) return;
    stopped = true;
    const rows = [
      { name: players[pi].name, color: players[pi].color, label: "당첨", sub: `${turn + 1}번째 칼`, isLoser: true },
      ...turnOrder
        .filter((i) => i !== pi)
        .map((i) => ({ name: players[i].name, color: players[i].color, label: "통과", sub: `칼 ${stabs[i]}번`, isLoser: false })),
    ];
    onDone({ rows, loser: players[pi].name, video: null });
  }

  showTurn();
  return {
    stop() {
      stopped = true;
    },
  };
}
