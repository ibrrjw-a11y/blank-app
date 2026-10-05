// 첫 화면: 계측기 패널이 실제로 측정하는 장면을 보여준다 (4장면 반복)
// 1) 채널 5개 점등 + 채널별 파형  2) 반응 탭 → 파형 스파이크 + ms 오도미터
// 3) 바늘 게이지가 예비동작 후 튕겨 27세에 정착  4) 성적서가 인쇄되어 나오고 도전장 도장
import { prefersReducedMotion } from "../shared/kit.js";
import { Scope, WAVES, gaugeSVG, setGauge, kinetic } from "./instrument.js";
import { KEYS, META } from "./scoring.js";
import { rollMarkup, rollTo } from "./ui.js";

function later(signal, ms, fn) {
  const t = setTimeout(fn, ms);
  signal.addEventListener("abort", () => clearTimeout(t), { once: true });
}

const SCENES = [
  { title: "미니게임 5개를\n차례로 재요", desc: "반응속도 · 순간기억 · 색 구분 · 고주파 청력 · 순간계산", duration: 4000, play: sceneChannels },
  { title: "초록불에 탭,\n밀리초까지", desc: "손끝 반응이 파형으로 튀어요", duration: 3800, play: sceneTap },
  { title: "점수를 모아\n뇌 나이로", desc: "다섯 채널을 합쳐 재미로 보는 나이를 계산해요", duration: 3800, play: sceneGauge },
  { title: "성적서 뽑아\n부모님께 도전장", desc: "링크 하나로 가족과 나란히 비교해요", duration: 4200, play: sceneSlip },
];

export function panelMarkup() {
  return `
  <div class="panel" aria-hidden="true">
    <span class="panel__screw"></span><span class="panel__screw"></span><span class="panel__screw"></span><span class="panel__screw"></span>
    <div class="scope">
      <canvas class="scope__cv"></canvas>
      <span class="scope__ch mono">CH1 반응속도</span>
      <span class="scope__lamp" data-state="off"></span>
      <span class="scope__read mono"><span class="scope__val"></span><small class="scope__unit"></small></span>
      <div class="slip">
        <div class="slip__paper">
          <p class="slip__head mono"><span>뇌 나이 검사 성적서</span><span>No.0027</span></p>
          <p class="slip__age"><b>27</b>세</p>
          <p class="slip__line">실제 나이보다 7살 젊어요</p>
          <ul class="slip__rows">${KEYS.map((k, i) => `<li style="--i:${i}"><span>${META[k].code} ${META[k].name}</span><b>${["243ms", "7칸", "21단계", "17kHz", "16문제"][i]}</b></li>`).join("")}</ul>
          <p class="slip__to mono">TO. 엄마 — 엄마도 해봐!</p>
          <span class="stamp">도전장</span>
        </div>
      </div>
    </div>
    <div class="panel__row">
      <div class="panel__gauge">${gaugeSVG()}</div>
      <ul class="chs">
        ${KEYS.map((k) => `<li class="ch" data-k="${k}"><i class="led"></i><b class="mono">${META[k].code}</b><span>${META[k].name}</span></li>`).join("")}
      </ul>
    </div>
  </div>`;
}

function setChannel(panel, k, { val = "", unit = "" } = {}) {
  panel.querySelector(".scope__ch").textContent = k ? `${META[k].code} ${META[k].name}` : "SUM 종합";
  panel.querySelector(".scope__val").textContent = val;
  panel.querySelector(".scope__unit").textContent = unit;
  panel.querySelectorAll(".ch").forEach((li) => li.classList.toggle("is-sel", li.dataset.k === k));
}

function reset(panel, n) {
  panel.dataset.scene = n;
  panel.querySelectorAll(".ch").forEach((li) => li.classList.remove("is-on", "is-sel"));
  panel.querySelector(".scope__lamp").dataset.state = "off";
  panel.querySelector(".scope__read").classList.remove("is-pop");
}

function sceneChannels(ctx, signal) {
  const { panel, scope, gauge } = ctx;
  reset(panel, 1);
  setGauge(gauge, 10, { anticipate: false, signal });
  KEYS.forEach((k, i) => {
    later(signal, 120 + i * 640, () => {
      panel.querySelector(`.ch[data-k="${k}"]`).classList.add("is-on");
      setChannel(panel, k);
      scope.setWave(WAVES[k]);
    });
  });
}

function sceneTap(ctx, signal) {
  const { panel, scope, gauge } = ctx;
  reset(panel, 2);
  const lamp = panel.querySelector(".scope__lamp");
  const val = panel.querySelector(".scope__val");
  const read = panel.querySelector(".scope__read");
  panel.querySelector('.ch[data-k="rt"]').classList.add("is-on");
  setChannel(panel, "rt", { val: "---", unit: "ms" });
  scope.setWave(WAVES.idle);
  lamp.dataset.state = "wait";
  lamp.textContent = "대기";
  later(signal, 1100, () => {
    lamp.dataset.state = "go";
    lamp.textContent = "탭!";
  });
  later(signal, 1340, () => {
    scope.mark();
    panel.classList.remove("is-hit");
    void panel.offsetWidth;
    panel.classList.add("is-hit");
    val.innerHTML = rollMarkup(243, "243");
    rollTo(val.querySelector(".roll"), 243, { duration: 700 });
    read.classList.add("is-pop");
    setGauge(gauge, 24, { signal, stiffness: 260, damping: 11 });
  });
}

function sceneGauge(ctx, signal) {
  const { panel, scope, gauge } = ctx;
  reset(panel, 3);
  KEYS.forEach((k) => panel.querySelector(`.ch[data-k="${k}"]`).classList.add("is-on"));
  setChannel(panel, null, { val: "", unit: "세" });
  const lv = [0.7, 0.45, 0.8, 0.35, 0.6];
  scope.setWave((x) => lv[Math.min(4, Math.floor(x * 5))] * 1.1 - 0.3 + (Math.random() - 0.5) * 0.03);
  setGauge(gauge, 78, { anticipate: false, signal, stiffness: 400, damping: 30 });
  later(signal, 500, () => {
    setGauge(gauge, 27, { signal });
    const val = panel.querySelector(".scope__val");
    val.innerHTML = rollMarkup(27, "27");
    rollTo(val.querySelector(".roll"), 27, { duration: 1100 });
    panel.querySelector(".scope__read").classList.add("is-pop");
  });
}

function sceneSlip(ctx, signal) {
  const { panel, scope } = ctx;
  reset(panel, 4);
  scope.setWave(WAVES.idle);
  setChannel(panel, null, { val: "27", unit: "세" });
  KEYS.forEach((k) => panel.querySelector(`.ch[data-k="${k}"]`).classList.add("is-on"));
}

export function startIntro(root) {
  const host = root.querySelector(".intro__panel");
  host.innerHTML = panelMarkup();
  const panel = host.querySelector(".panel");
  const scope = new Scope(panel.querySelector(".scope__cv"));
  const gauge = panel.querySelector(".gauge-svg");
  const title = root.querySelector(".intro__title");
  const desc = root.querySelector(".intro__desc");
  const steps = root.querySelector(".intro__ticks");
  steps.innerHTML = SCENES.map((_, i) => `<span class="mono">0${i + 1}</span>`).join("");
  const life = new AbortController();
  scope.start(life.signal);
  const onResize = () => scope.resize();
  window.addEventListener("resize", onResize);
  const ctx = { panel, scope, gauge };
  let sceneCtl;
  let timer;
  const show = (i) => {
    if (life.signal.aborted) return;
    sceneCtl?.abort();
    sceneCtl = new AbortController();
    life.signal.addEventListener("abort", () => sceneCtl.abort(), { once: true });
    const s = SCENES[i];
    kinetic(title, s.title);
    desc.textContent = s.desc;
    [...steps.children].forEach((el, j) => el.classList.toggle("is-on", j === i));
    try {
      s.play(ctx, sceneCtl.signal);
    } catch (e) {
      console.error(e);
    }
    timer = setTimeout(() => show((i + 1) % SCENES.length), prefersReducedMotion() ? s.duration + 1500 : s.duration);
  };
  show(0);
  return {
    stop() {
      clearTimeout(timer);
      life.abort();
      window.removeEventListener("resize", onResize);
    },
  };
}
