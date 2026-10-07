// 벽돌깨기 화면. 규칙은 core.js, 틀은 shared/arcade.js
import { runArcade } from "../shared/arcade.js";
import { W, H, PY, PH, BR, paddleW, brickRect, newState, step, act } from "./core.js";

const ROW = ["#ff5d73", "#ff9f43", "#feca57", "#1dd1a1", "#48dbfb", "#5f8cff", "#a76cff"];
function draw(cx, st, now, rm) {
  cx.fillStyle = "#0e1230"; cx.fillRect(0, 0, W, H);
  cx.strokeStyle = "rgba(255,255,255,.05)"; cx.lineWidth = 1;
  for (let y = 0; y < H; y += 20) { cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke(); }
  for (const b of st.bricks) {
    if (!b.hp) continue;
    const r = brickRect(b);
    cx.fillStyle = b.hp === 2 ? "#c9d2e3" : ROW[b.r % ROW.length];
    cx.fillRect(r.x, r.y, r.w, r.h);
    cx.fillStyle = "rgba(255,255,255,.35)"; cx.fillRect(r.x, r.y, r.w, 3);
    if (b.hp === 2) { cx.strokeStyle = "#5d6680"; cx.lineWidth = 2; cx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2); }
  }
  const half = paddleW(st.stage) / 2;
  cx.fillStyle = "#f5f6ff"; cx.beginPath(); cx.roundRect(st.px - half, PY, half * 2, PH, 5); cx.fill();
  cx.fillStyle = "#ff5d73"; cx.fillRect(st.px - half + 4, PY + 3, 6, 4); cx.fillRect(st.px + half - 10, PY + 3, 6, 4);
  cx.fillStyle = "#fff"; cx.shadowColor = "#9fe8ff"; cx.shadowBlur = rm ? 0 : 12;
  cx.beginPath(); cx.arc(st.bx, st.by, BR, 0, Math.PI * 2); cx.fill(); cx.shadowBlur = 0;
  cx.fillStyle = "rgba(255,255,255,.75)"; cx.font = "800 13px Pretendard, sans-serif"; cx.textAlign = "left";
  cx.fillText(`${st.stage + 1}단계`, 10, 24); cx.textAlign = "right"; cx.fillText(`${st.score}개`, W - 10, 24);
  if (st.stuck) { cx.textAlign = "center"; cx.font = "900 17px Pretendard, sans-serif"; cx.fillStyle = "#fff"; cx.fillText(st.stage ? `${st.stage + 1}단계 · 눌러서 출발` : "눌러서 출발 · 끌어서 받침대 이동", W / 2, 380); }
  if (st.dead && !rm) { cx.fillStyle = `rgba(255,93,115,${Math.max(0, 0.4 - (now - st.deadAt) / 1500)})`; cx.fillRect(0, 0, W, H); }
}

runArcade({
  slug: "bricks", W, H, board: "판", ro: "으로", ie: "이에요", unit: "개", emoji: "🧱", title: "벽돌깨기",
  newState, step, act, draw,
  why: () => "공을 놓쳤어요",
  extra: (st) => `${st.stage + 1}단계 · 마지막 공 빠르기 초당 ${Math.round(Math.hypot(st.vx, st.vy))}px`,
  keys: { ArrowLeft: "left", a: "left", ArrowRight: "right", d: "right", " ": "launch", ArrowUp: "launch" },
  pointer: true,
  countdown: true,
});
