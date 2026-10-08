// 클릭 속도 화면. 규칙은 core.js, 틀은 shared/arcade.js
import { runArcade } from "../shared/arcade.js";
import { W, H, DUR, newState, step, act, cps, bestSec } from "./core.js";

function draw(cx, st, now, rm) {
  const g = cx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#2b1055"); g.addColorStop(1, "#7597de");
  cx.fillStyle = g; cx.fillRect(0, 0, W, H);
  // 1초 구간 막대
  const mx = Math.max(10, ...st.per);
  for (let i = 0; i < 10; i++) {
    const h = st.per[i] / mx * 120, x = 22 + i * 32;
    cx.fillStyle = i === Math.floor(st.t / 1000) && !st.dead ? "#ffd23f" : "rgba(255,255,255,.35)";
    cx.fillRect(x, H - 40 - h, 24, h);
  }
  cx.fillStyle = "rgba(255,255,255,.7)"; cx.font = "700 12px Pretendard, sans-serif"; cx.textAlign = "center";
  cx.fillText("1초마다 누른 수", W / 2, H - 16);
  // 가운데 큰 단추 — 누를 때마다 쿵
  const last = st.taps[st.taps.length - 1], k = last && !rm ? Math.max(0, 1 - (st.t - last.t) / 90) : 0;
  const r = 96 - k * 10;
  cx.fillStyle = "rgba(0,0,0,.25)"; cx.beginPath(); cx.arc(W / 2, 258 + 8, r, 0, Math.PI * 2); cx.fill();
  cx.fillStyle = "#ff4b5c"; cx.beginPath(); cx.arc(W / 2, 258 + k * 6, r, 0, Math.PI * 2); cx.fill();
  cx.fillStyle = "#fff"; cx.font = "900 64px Pretendard, sans-serif"; cx.fillText(st.score, W / 2, 280 + k * 6);
  cx.font = "800 18px Pretendard, sans-serif";
  cx.fillText(st.started ? `${((DUR - st.t) / 1000).toFixed(1)}초` : "아무 데나 눌러 시작", W / 2, 120);
  cx.font = "700 15px Pretendard, sans-serif"; cx.fillStyle = "rgba(255,255,255,.85)";
  cx.fillText(st.started ? `초당 ${(st.score / Math.max(0.1, st.t / 1000)).toFixed(1)}번` : "10초 동안 최대한 빨리", W / 2, 146);
  // 누른 자리 물결
  for (const p of st.taps.slice(-12)) { const a = (st.t - p.t) / 300; if (a > 1 || rm) continue; cx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - a)})`; cx.lineWidth = 2; cx.beginPath(); cx.arc(p.x, p.y, 10 + a * 40, 0, Math.PI * 2); cx.stroke(); }
}

runArcade({
  slug: "cps", W, H, board: "판", ro: "으로", ie: "이에요", unit: "번", emoji: "👆", title: "클릭 속도 측정",
  newState, step, act, draw, pointer: true, keys: { " ": "tap" },
  why: () => "10초 끝",
  extra: (st) => `초당 ${cps(st)}번 · 가장 빠른 1초 ${bestSec(st)}번`,
});
