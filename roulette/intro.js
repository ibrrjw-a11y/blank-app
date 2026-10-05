// 첫 화면: 세트에 돌림판이 쾅 떨어지고, 돌다가 핀에 걸려 한 칸 차이로 넘어가는 장면을 반복한다.
import { WheelView, layout, makeParams, planSpin, analyze, sample, omegaAt, confetti } from "./wheel.js";
import { prefersReducedMotion, CANVAS_FONT } from "../shared/kit.js";

const ITEMS = ["까나리", "통과", "물벼락", "통과", "꿀밤", "통과", "노래 한 곡", "통과"].map((name) => ({ name, weight: 1 }));

const SUBS = [
  "칸에 <b>이름·메뉴·벌칙</b>을 넣고",
  "<b>돌려!</b> 누르면 진짜 마찰로 돌아요",
  "바늘이 <b>핀</b>에 걸리면 줌인",
  "<b>한 칸 차이</b>는 슬로로 다시 보기",
];

export function startIntro({ canvas, jamakLayer, sub, confettiCanvas }) {
  const view = new WheelView(canvas, { font: CANVAS_FONT });
  const lay = layout(ITEMS);
  view.setLayout(lay);
  const P = makeParams(lay, { turns: 1.6, c2: 0.05 });
  let raf = 0;
  let stopped = false;
  let timers = [];
  let stopConfetti = null;

  const setSub = (i) => {
    if (sub.dataset.i === String(i)) return;
    sub.dataset.i = String(i);
    sub.innerHTML = SUBS[i];
    sub.classList.remove("is-swap");
    void sub.offsetWidth;
    sub.classList.add("is-swap");
  };

  const jamak = (text, cls, small) => {
    jamakLayer.querySelectorAll(".jamak:not(.is-out)").forEach((el) => {
      el.classList.add("is-out");
      setTimeout(() => el.remove(), 280);
    });
    if (!text) return;
    const el = document.createElement("p");
    el.className = `jamak ${cls}`;
    el.dataset.t = text;
    el.textContent = text;
    jamakLayer.appendChild(el);
    if (small) {
      const s = document.createElement("p");
      s.className = "jamak jamak--name jamak--small";
      s.dataset.t = small;
      s.textContent = small;
      jamakLayer.appendChild(s);
    }
  };

  let lastW = canvas.getBoundingClientRect().width;
  const onResize = () => {
    const w = canvas.getBoundingClientRect().width;
    if (Math.abs(w - lastW) < 1) return;
    lastW = w;
    view.resize();
  };
  addEventListener("resize", onResize);
  document.fonts?.ready?.then(() => !stopped && view.buildFace());

  if (prefersReducedMotion()) {
    const sim = planSpin(lay, 0, 0, P, "creep");
    const s = sample(sim, sim.t);
    view.draw(s.th, 0);
    setSub(3);
    jamak("아~ 한 칸 차이!", "jamak--miss", "까나리 당첨");
    return { stop() { stopped = true; removeEventListener("resize", onResize); } };
  }

  function cycle() {
    if (stopped) return;
    const theta0 = -0.4 - Math.random() * 1.2;
    const sim = planSpin(lay, theta0, 0, P, "creep");
    const an = analyze(sim, lay);
    jamak(null);
    setSub(0);

    const DROP = 360;
    const SETTLE = 520;
    const SPIN_AT = 980;
    const t0 = performance.now();
    let simT = 0;
    let last = t0;
    let evIdx = 0;
    let landed = false;
    let landedAt = 0;
    let zoom = 1;
    let shownQ = false;
    let shownMiss = false;
    const zoomStart = an.zoomStart;
    const hangStart = an.hangStart ?? sim.t;
    const hangEnd = an.hangEnd ?? sim.t;

    const rate = (t) => {
      if (t < zoomStart) return 1.7;
      if (t < hangStart) return 1.7 - (1.7 - 0.55) * Math.min(1, (t - zoomStart) / Math.max(0.2, hangStart - zoomStart));
      if (t < hangEnd) return 0.42;
      return 0.9;
    };

    const frame = (now) => {
      if (stopped) return;
      const el = now - t0;
      const dtReal = Math.min(0.05, (now - last) / 1000);
      last = now;
      let y = 0;
      let squash = 0;
      if (el < DROP) {
        const k = el / DROP;
        y = -(1 - k * k) * (canvas.clientHeight * 0.9);
      } else if (el < DROP + SETTLE) {
        const k = (el - DROP) / SETTLE;
        squash = 0.16 * Math.exp(-k * 5) * Math.cos(k * Math.PI * 3);
      }
      canvas.style.translate = `0 ${y.toFixed(1)}px`;

      let th = sim.theta0;
      let f = 0;
      if (el >= SPIN_AT) {
        if (sub.dataset.i === "0") setSub(1);
        simT = Math.min(sim.t + 0.7, simT + dtReal * rate(simT));
        const s = sample(sim, simT);
        th = s.th;
        f = s.f;
        while (evIdx < an.ticks.length && an.ticks[evIdx] <= simT) {
          if (Math.abs(omegaAt(sim, an.ticks[evIdx])) < 9) view.burst();
          evIdx++;
        }
        if (simT >= zoomStart && !shownQ) {
          shownQ = true;
          setSub(2);
          jamak("과연?!", "jamak--q");
        }
        if (simT >= hangEnd && !shownMiss) {
          shownMiss = true;
          jamak("아~ 한 칸 차이!", "jamak--miss", "까나리 당첨");
          setSub(3);
          stopConfetti = confetti(confettiCanvas, { count: 70 });
        }
        if (simT >= sim.t && !landed) {
          landed = true;
          landedAt = now;
        }
      }
      // 카메라: 핀에 걸리기 전부터 바늘 쪽으로 들어갔다가, 결과가 나오면 빠진다
      let target = 1;
      if (el >= SPIN_AT && simT >= zoomStart) target = 2.1;
      if (landed && now - landedAt > 1100) target = 1;
      zoom += (target - zoom) * Math.min(1, dtReal * (target > zoom ? 5 : 4));
      view.draw(th, f, { zoom }, { squash });

      if (landed && now - landedAt > 2600) {
        // 판이 위로 빠지고 다음 회차
        const k = Math.min(1, (now - landedAt - 2600) / 300);
        canvas.style.translate = `0 ${(-k * k * canvas.clientHeight).toFixed(1)}px`;
        if (k >= 1) {
          jamak(null);
          raf = requestAnimationFrame(() => cycle());
          return;
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }

  cycle();

  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      stopConfetti?.();
      removeEventListener("resize", onResize);
    },
  };
}
