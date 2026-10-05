// 첫 화면 모션그래픽: 회로 뇌 + 4장면
// 1) 미니게임 5개 아이콘이 궤도를 돌다 뇌 영역에 꽂힘  2) 반응속도 탭 + ms 카운터
// 3) 숫자가 슬롯처럼 굴러 "뇌 나이 27세"  4) 부모님께 도전장 채팅
import { runIntro, prefersReducedMotion } from "../shared/kit.js";
import { brainMarkup, initPulses, REGIONS, VB } from "./brain.js";
import { KEYS, META } from "./scoring.js";
import { rollMarkup, rollTo } from "./ui.js";

function later(signal, ms, fn) {
  const t = setTimeout(fn, ms);
  signal.addEventListener("abort", () => clearTimeout(t), { once: true });
}

function loop(signal, fn) {
  const start = performance.now();
  let raf;
  const tick = (now) => {
    if (signal.aborted) return;
    if (fn(now - start) !== false) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  signal.addEventListener("abort", () => cancelAnimationFrame(raf), { once: true });
}

const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

function prepare(stage, n) {
  stage.dataset.scene = n;
  const brain = stage.querySelector(".ib");
  brain.classList.remove("is-burst", "is-glow");
  brain.querySelectorAll(".ba-region").forEach((r) => r.classList.remove("is-on"));
  const chips = brain.querySelector(".ib-chips");
  chips.innerHTML = "";
  const layer = stage.querySelector(".ib-layer");
  layer.innerHTML = "";
  return { brain, chips, layer };
}

// 장면 1: 궤도 → 뇌 영역에 꽂힘
function sceneOrbit(stage, signal) {
  const { brain, chips } = prepare(stage, 1);
  chips.innerHTML = KEYS.map((k) => `<span class="ib-chip" data-k="${k}"><b>${META[k].icon}</b><em>${META[k].short}</em></span>`).join("");
  const els = [...chips.children];
  const W = brain.clientWidth;
  const H = brain.clientHeight;
  const sx = W / VB.w;
  const sy = H / VB.h;
  const cx = VB.w / 2;
  const cy = VB.h / 2;
  const rx = 134;
  const ry = 112;
  const reduce = prefersReducedMotion();
  const arrived = new Set();
  loop(signal, (t) => {
    if (reduce) t = 99999;
    els.forEach((el, i) => {
      const k = KEYS[i];
      const startFly = 1300 + i * 160;
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5 + Math.min(t, startFly) * 0.0019;
      const ox = cx + Math.cos(a) * rx;
      const oy = cy + Math.sin(a) * ry;
      const p = ease((t - startFly) / 620);
      const x = ox + (REGIONS[k].x - ox) * p;
      const y = oy + (REGIONS[k].y - oy) * p;
      el.style.transform = `translate(${x * sx}px, ${y * sy}px) translate(-50%, -50%) scale(${1 - 0.22 * p})`;
      if (p >= 1 && !arrived.has(k)) {
        arrived.add(k);
        el.classList.add("is-in");
        brain.querySelector(`.ba-region[data-k="${k}"]`)?.classList.add("is-on");
      }
    });
    if (arrived.size === KEYS.length) brain.classList.add("is-burst");
    return !reduce && t < 3200;
  });
}

// 장면 2: 반응속도 탭
function sceneTap(stage, signal) {
  const { brain, layer } = prepare(stage, 2);
  layer.innerHTML = `
    <div class="ib-tap" data-state="wait">
      <span class="ib-tap__t">기다리세요…</span>
      <span class="ib-tap__ms t-num"></span>
      <i class="ib-tap__ripple"></i>
      <span class="ib-tap__finger" aria-hidden="true">👆</span>
    </div>`;
  const tap = layer.querySelector(".ib-tap");
  const txt = tap.querySelector(".ib-tap__t");
  const ms = tap.querySelector(".ib-tap__ms");
  const target = 243;
  later(signal, 1000, () => {
    tap.dataset.state = "go";
    txt.textContent = "지금 탭!";
  });
  later(signal, 1350, () => {
    tap.dataset.state = "hit";
    txt.textContent = "반응 시간";
    brain.classList.add("is-burst");
    loop(signal, (t) => {
      const p = prefersReducedMotion() ? 1 : ease(t / 650);
      ms.textContent = `${Math.round(target * p)}ms`;
      return p < 1;
    });
  });
}

// 장면 3: 슬롯 → 뇌 나이 27세
function sceneSlot(stage, signal) {
  const { brain, layer } = prepare(stage, 3);
  const bars = [0.82, 0.7, 0.9, 0.62, 0.76];
  layer.innerHTML = `
    <div class="ib-slot">
      <p class="t-label-02 ib-slot__k">나의 뇌 나이</p>
      <div class="ib-slot__num">${rollMarkup(27, "27세")}<span class="ib-slot__unit">세</span></div>
      <div class="ib-bars">${KEYS.map(
        (k, i) => `<span class="ib-bar"><b>${META[k].icon}</b><i style="--v:${bars[i]};--d:${i * 90}ms"></i></span>`
      ).join("")}</div>
    </div>`;
  const slot = layer.querySelector(".ib-slot");
  rollTo(slot.querySelector(".roll"), 27, { delay: 150, duration: 1400 });
  requestAnimationFrame(() => slot.classList.add("is-on"));
  later(signal, 1700, () => brain.classList.add("is-glow"));
}

// 장면 4: 부모님께 도전장
function sceneChat(stage, signal) {
  prepare(stage, 4);
  const layer = stage.querySelector(".ib-layer");
  layer.innerHTML = `
    <div class="ib-chat">
      <p class="ib-chat__head t-label-03">💬 엄마</p>
      <div class="ib-msg ib-msg--me" style="--d:200ms">엄마, 내 뇌 나이 27세래.<br />엄마도 해봐! 🧠</div>
      <div class="ib-link" style="--d:700ms">
        <span class="ib-link__img" aria-hidden="true">🧠</span>
        <span><b class="t-label-02">도전장이 도착했어요</b><br /><span class="t-caption-01 t-secondary">뇌 나이 측정소 · 나도 재보기</span></span>
      </div>
      <div class="ib-msg ib-msg--you" style="--d:1500ms">어머, 엄마도 해볼래 😆</div>
    </div>`;
  later(signal, 1600, () => stage.querySelector(".ib").classList.add("is-glow"));
}

export function startIntro(root) {
  const stage = root.querySelector(".intro__stage");
  stage.innerHTML = `<div class="ib-hud"><i></i><i></i><i></i><i></i><span>BRAIN SCAN</span></div>
    <div class="ib">${brainMarkup()}<div class="ib-scan"></div><div class="ib-chips"></div></div><div class="ib-layer"></div>`;
  initPulses(stage);
  return runIntro({
    root,
    scenes: [
      { title: "미니게임 5개, 약 2분", desc: "반응속도·기억력·색 구분·청력·계산을 차례로 재요", duration: 4200, play: sceneOrbit },
      { title: "초록색이 되는 순간 탭!", desc: "반응속도는 밀리초 단위로 재요", duration: 3400, play: sceneTap },
      { title: "점수를 모아 뇌 나이로", desc: "다섯 가지 능력을 합쳐 재미로 보는 뇌 나이를 알려줘요", duration: 3600, play: sceneSlot },
      { title: "부모님께 도전장 보내기", desc: "링크 하나로 가족과 나란히 비교해봐요", duration: 3800, play: sceneChat },
    ],
  });
}
