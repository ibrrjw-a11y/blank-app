// 막대 다리 화면. 규칙은 core.js, 틀은 shared/arcade.js
import { runArcade } from "../shared/arcade.js";
import { W, H, TOP, DOT, newState, step, act } from "./core.js";

function draw(cx, st, now, rm) {
  const sky = cx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#ffb88c"); sky.addColorStop(0.6, "#ffd6a5"); sky.addColorStop(1, "#ffe8cc");
  cx.fillStyle = sky; cx.fillRect(0, 0, W, H);
  cx.fillStyle = "rgba(255,255,255,.55)"; cx.beginPath(); cx.arc(270, 120, 46, 0, Math.PI * 2); cx.fill();
  // 먼 산
  const far = (st.cam * 0.2) % 240;
  cx.fillStyle = "#e9a07a";
  for (let i = -1; i < 3; i++) { const x = i * 240 - far; cx.beginPath(); cx.moveTo(x, TOP); cx.lineTo(x + 120, TOP - 150); cx.lineTo(x + 240, TOP); cx.fill(); }
  const ox = -st.cam;
  // 기둥
  for (let k = Math.max(0, st.cur - 1); k < st.cur + 4; k++) {
    const p = st.pf[k], x = p.x + ox;
    if (x > W || x + p.w < 0) continue;
    cx.fillStyle = "#2b1d14"; cx.fillRect(x, TOP, p.w, H - TOP);
    if (k > st.cur || (k === st.cur && st.mode !== "idle" && false)) { cx.fillStyle = "#e2312b"; cx.fillRect(x + p.w / 2 - DOT, TOP, DOT * 2, 6); }
  }
  // 막대
  const base = st.pf[st.cur].x + st.pf[st.cur].w + ox;
  if (st.mode !== "idle" || st.dead) {
    cx.save(); cx.translate(base, TOP);
    const a = st.mode === "drop" && (st.land === "short") ? 90 + Math.min(90, st.hy) : st.ang;
    cx.rotate(a * Math.PI / 180);
    cx.fillStyle = "#3a2a1e"; cx.fillRect(-2, -st.len, 4, st.len);
    cx.restore();
  }
  // 사람
  const hx = st.hx + ox, hy = TOP + st.hy;
  cx.save(); cx.translate(hx, hy);
  cx.fillStyle = "#1f1f1f"; cx.fillRect(-9, -30, 18, 22);
  const leg = st.mode === "walk" ? Math.sin(st.t / 45) * 3 : 0;
  cx.fillRect(-7, -8, 5, 8 + leg); cx.fillRect(2, -8, 5, 8 - leg);
  cx.fillStyle = "#e2312b"; cx.fillRect(-10, -32, 20, 5); cx.fillRect(-14, -31, 6, 3);
  cx.fillStyle = "#fff"; cx.fillRect(3, -24, 4, 4);
  cx.restore();
  // 정확히 맞으면 +2 글씨
  if (st.lastPerfect && now - st.lastPerfect < 700) { cx.fillStyle = "#e2312b"; cx.font = "900 22px Pretendard, sans-serif"; cx.textAlign = "center"; cx.fillText("정확! +2", W / 2, 150 - (now - st.lastPerfect) / 20); }
  cx.fillStyle = "#2b1d14"; cx.font = "900 46px Pretendard, sans-serif"; cx.textAlign = "center"; cx.fillText(st.score, W / 2, 84);
  if (!st.started) { cx.font = "900 17px Pretendard, sans-serif"; cx.fillText("꾹 눌러 막대를 늘리고, 떼서 넘기기", W / 2, 230); }
}

runArcade({
  slug: "stick", W, H, board: "다리", ro: "로", ie: "예요", unit: "점", emoji: "🌉", title: "막대 다리",
  newState, act, draw,
  step: (st, dt) => { const ev = step(st, dt); if (ev === "perfect") st.lastPerfect = performance.now(); return ev; },
  why: (st) => (st.why === "short" ? "막대가 짧았어요" : "막대가 길었어요"),
  extra: (st) => `기둥 ${st.cur}개 건넘 · 정확히 ${st.perfect}번`,
  keys: { " ": "hold", ArrowUp: "hold" },
  pointer: true,
});
