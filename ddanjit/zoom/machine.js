// 1번 기계(줌아웃) 전용 연출: 헤드라인 위를 지나가는 돋보기, 하단 "옆 기계" 뷰파인더
import { $, $$, prefersReducedMotion } from "../../shared/kit.js";

// 돋보기가 둘째 줄을 왕복하고, 렌즈 밑 글자만 부풀어 오른다
function lensSweep() {
  const line = $(".ztitle__lens");
  const glass = $(".ztitle__glass");
  if (!line || !glass || prefersReducedMotion()) return;
  const chars = $$(".ch", line);
  const R = 46;
  const PERIOD = 4200;
  const t0 = performance.now();
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function frame(now) {
    if (!line.isConnected) return;
    if (!line.closest("[hidden]")) {
      const w = line.clientWidth;
      const p = ((now - t0) % PERIOD) / PERIOD;
      // 왕복 + 양 끝에서 잠깐 멈춤
      const leg = p < 0.5 ? p * 2 : 2 - p * 2;
      const k = ease(Math.min(1, Math.max(0, (leg - 0.08) / 0.84)));
      const x = 8 + k * (w - 16);
      glass.style.transform = `translate(${x}px, -50%)`;
      chars.forEach((c) => {
        const cx = c.offsetLeft + c.offsetWidth / 2;
        const d = Math.abs(cx - x);
        const s = 1 + 0.55 * Math.max(0, 1 - d / R) ** 2;
        c.style.scale = s.toFixed(3);
      });
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function moreBlock() {
  const more = $("#more");
  if (!more) return;
  const title = $(".more-sites__title", more);
  if (title) title.innerHTML = `<span class="pix" aria-hidden="true">NEXT</span>렌즈를 옆 기계로`;
}

export function machine() {
  lensSweep();
  moreBlock();
}
