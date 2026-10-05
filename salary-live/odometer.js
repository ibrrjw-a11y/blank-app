// 기계식 오도미터: 자리마다 휠이 굴러가고, 스프링으로 살짝 넘쳤다가 멈춘다.
// 실시간 카운터(/salary-live/)와 실수령액 계산기(/salary-live/net-pay/)가 같이 쓴다.
import { prefersReducedMotion } from "../shared/kit.js";

export class Odometer {
  constructor(el, { minDigits = 1, dur = 420 } = {}) {
    this.el = el;
    this.minDigits = minDigits;
    this.dur = dur;
    this.wheels = [];
    this.count = 0;
  }
  build(count) {
    this.count = count;
    this.el.innerHTML = "";
    this.wheels = [];
    for (let i = 0; i < count; i++) {
      const place = count - 1 - i; // 10의 몇 제곱 자리
      const w = document.createElement("span");
      w.className = "odo__wheel";
      const strip = document.createElement("span");
      strip.className = "odo__strip";
      strip.innerHTML = Array.from({ length: 20 }, (_, d) => `<span>${d % 10}</span>`).join("");
      w.appendChild(strip);
      this.el.appendChild(w);
      this.wheels.push({ w, strip, pos: 0, place });
      if (place > 0 && place % 3 === 0) {
        const sep = document.createElement("span");
        sep.className = "odo__sep";
        sep.textContent = ",";
        this.el.appendChild(sep);
      }
    }
  }
  h() {
    return this.wheels[0]?.w.offsetHeight || 64;
  }
  set(value, { instant = false } = {}) {
    const v = Math.max(0, Math.floor(value));
    const len = Math.max(this.minDigits, String(v).length);
    if (len !== this.count) {
      this.build(len);
      instant = true;
    }
    const H = this.h();
    const s = String(v).padStart(len, "0");
    const lead = len - String(v).length;
    this.wheels.forEach((wh, i) => {
      const d = Number(s[i]);
      wh.w.classList.toggle("is-lead", i < lead);
      const cur = wh.pos % 10;
      if (d === cur && wh.pos < 10) return;
      // 굴러가던 중 한 바퀴를 넘긴 상태면 먼저 0~9 구간으로 되돌려 놓는다
      if (wh.pos >= 10) {
        wh.strip.style.transition = "none";
        wh.strip.style.transform = `translateY(${-(wh.pos - 10) * H}px)`;
        void wh.strip.offsetHeight;
        wh.pos -= 10;
      }
      const target = d >= wh.pos % 10 ? d : d + 10; // 9→0 은 앞으로 굴러서 넘어간다
      wh.strip.style.transition =
        instant || prefersReducedMotion() ? "none" : `transform ${this.dur}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
      wh.strip.style.transform = `translateY(${-target * H}px)`;
      wh.pos = target;
    });
  }
}
