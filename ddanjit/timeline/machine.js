// 4번 기계(추억 연대기) 전용: 비디오 데크 카운터, 하단 링크를 비디오테이프 칸으로
import { $, prefersReducedMotion } from "../../shared/kit.js";

function counter() {
  const tc = $("#vcrTc");
  if (!tc) return;
  const t0 = Date.now();
  const pad = (n) => String(n).padStart(2, "0");
  const tick = () => {
    const s = Math.floor((Date.now() - t0) / 1000) + 3;
    tc.textContent = `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  };
  tick();
  if (!prefersReducedMotion()) setInterval(tick, 1000);
}

export function machine() {
  counter();
  const title = $("#more .more-sites__title");
  if (title) title.textContent = "옆 칸에 꽂힌 테이프";
}
