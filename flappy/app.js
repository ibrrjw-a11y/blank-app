// 날개 퍼덕 화면. 규칙은 core.js, 틀은 shared/arcade.js
import { runArcade } from "../shared/arcade.js";
import { W, H, GROUND, X, R, PW, newState, step, act } from "./core.js";

function draw(cx, st, now, rm) {
  const sky = cx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#4ec0e9"); sky.addColorStop(1, "#bfeaf5");
  cx.fillStyle = sky; cx.fillRect(0, 0, W, H);
  // 먼 건물(느리게 흐름)
  const far = (st.dist * 0.25) % 120;
  cx.fillStyle = "#9fd8c4";
  for (let i = -1; i < 5; i++) { const x = i * 120 - far; cx.fillRect(x, GROUND - 90, 50, 90); cx.fillRect(x + 56, GROUND - 60, 40, 60); }
  // 기둥
  for (let k = Math.max(0, st.score - 1); k < st.score + 4; k++) {
    const p = st.pipes[k], px = p.x - st.dist;
    if (px > W || px + PW < 0) continue;
    for (const [y0, y1, cap] of [[0, p.c - p.g / 2, p.c - p.g / 2 - 20], [p.c + p.g / 2, GROUND, p.c + p.g / 2]]) {
      const g = cx.createLinearGradient(px, 0, px + PW, 0); g.addColorStop(0, "#5cbf2a"); g.addColorStop(0.35, "#9be15d"); g.addColorStop(1, "#3f8f1c");
      cx.fillStyle = g; cx.fillRect(px, y0, PW, y1 - y0);
      cx.fillRect(px - 4, cap, PW + 8, 20);
      cx.strokeStyle = "#2b5e14"; cx.lineWidth = 2; cx.strokeRect(px, y0, PW, y1 - y0); cx.strokeRect(px - 4, cap, PW + 8, 20);
    }
  }
  // 땅
  cx.fillStyle = "#ded895"; cx.fillRect(0, GROUND, W, H - GROUND);
  cx.fillStyle = "#73bf2e"; cx.fillRect(0, GROUND, W, 12);
  const gr = st.dist % 24; cx.fillStyle = "#5fa524"; for (let x = -gr; x < W; x += 24) cx.fillRect(x, GROUND + 4, 12, 8);
  // 새: 시작 전엔 둥실, 날 때는 고개를 들고 떨어질 땐 숙임
  const y = st.started ? st.y : st.y + Math.sin(st.t / 220) * 6;
  const tilt = st.started ? Math.max(-0.5, Math.min(1.2, st.vy / 600)) : 0;
  cx.save(); cx.translate(X, y); cx.rotate(tilt);
  cx.fillStyle = "#ffd23f"; cx.beginPath(); cx.ellipse(0, 0, R + 4, R, 0, 0, Math.PI * 2); cx.fill();
  cx.strokeStyle = "#3a2a0a"; cx.lineWidth = 2; cx.stroke();
  const flap = st.started && st.vy < 0 ? -1 : Math.sin(st.t / 90) > 0 ? 1 : 0;
  cx.fillStyle = "#fff4c2"; cx.beginPath(); cx.ellipse(-5, 2 + flap * 4, 8, 5, -0.3, 0, Math.PI * 2); cx.fill(); cx.stroke();
  cx.fillStyle = "#fff"; cx.beginPath(); cx.arc(7, -5, 5, 0, Math.PI * 2); cx.fill(); cx.stroke();
  cx.fillStyle = "#1b1b1b"; cx.beginPath(); cx.arc(8.5, -5, 2, 0, Math.PI * 2); cx.fill();
  cx.fillStyle = "#f2704a"; cx.beginPath(); cx.moveTo(11, 0); cx.lineTo(22, 3); cx.lineTo(11, 7); cx.closePath(); cx.fill(); cx.stroke();
  cx.restore();
  // 점수 크게
  cx.fillStyle = "#fff"; cx.strokeStyle = "#2b2b2b"; cx.lineWidth = 5; cx.font = "900 48px Pretendard, sans-serif"; cx.textAlign = "center";
  cx.strokeText(st.score, W / 2, 80); cx.fillText(st.score, W / 2, 80);
  if (!st.started) { cx.font = "900 18px Pretendard, sans-serif"; cx.lineWidth = 4; cx.strokeText("눌러서 퍼덕", W / 2, H / 2 + 40); cx.fillText("눌러서 퍼덕", W / 2, H / 2 + 40); }
  if (st.dead && !rm) { cx.fillStyle = `rgba(255,255,255,${Math.max(0, 0.7 - (now - st.deadAt) / 400)})`; cx.fillRect(0, 0, W, H); }
}

runArcade({
  slug: "flappy", W, H, board: "하늘", ro: "로", ie: "이에요", unit: "개", emoji: "🐤", title: "날개 퍼덕",
  newState, step, act, draw,
  why: (st) => (st.why === "ground" ? "땅에 떨어졌어요" : "기둥에 부딪혔어요"),
  extra: (st) => `마지막 틈 ${Math.round(st.pipes[st.score].g)}px`,
  keys: { " ": "tap", ArrowUp: "tap", w: "tap" },
});
