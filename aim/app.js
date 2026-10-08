// 에임 연습 화면. 규칙은 core.js, 틀은 shared/arcade.js
import { runArcade } from "../shared/arcade.js";
import { W, H, DUR, TOP, newState, step, act, target, accuracy, avgRt } from "./core.js";

function draw(cx, st, now, rm) {
  cx.fillStyle = "#0d1117"; cx.fillRect(0, 0, W, H);
  cx.strokeStyle = "rgba(80,250,180,.07)"; cx.lineWidth = 1;
  for (let x = 0; x <= W; x += 30) { cx.beginPath(); cx.moveTo(x, TOP); cx.lineTo(x, H); cx.stroke(); }
  for (let y = TOP; y <= H; y += 30) { cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke(); }
  // 위 띠: 남은 시간 · 정확도
  const left = Math.max(0, (DUR - st.t) / 1000);
  cx.fillStyle = "#161b22"; cx.fillRect(0, 0, W, TOP);
  cx.fillStyle = "#50fab4"; cx.fillRect(0, TOP - 4, W * (1 - st.t / DUR), 4);
  cx.font = "800 15px Pretendard, sans-serif"; cx.textAlign = "left"; cx.fillStyle = "#c9d1d9";
  cx.fillText(`${left.toFixed(1)}초`, 14, 36); cx.textAlign = "right"; cx.fillText(`정확도 ${accuracy(st)}%`, W - 14, 36);
  cx.textAlign = "center"; cx.fillStyle = "#50fab4"; cx.font = "900 26px Pretendard, sans-serif"; cx.fillText(st.score, W / 2, 39);
  // 맞힌 자리 파편
  for (const p of st.pops) {
    const a = (st.t - p.t) / 350; if (a > 1) continue;
    cx.strokeStyle = `rgba(80,250,180,${1 - a})`; cx.lineWidth = 3;
    cx.beginPath(); cx.arc(p.x, p.y, 14 + a * 30, 0, Math.PI * 2); cx.stroke();
  }
  st.pops = st.pops.filter((p) => st.t - p.t < 350);
  if (st.dead) return;
  const tg = target(st);
  const life = st.started ? Math.min(1, (st.t - st.born) / (1300 - 600 * Math.min(1, st.born / DUR))) : 0;
  const grow = rm ? 1 : Math.min(1, (st.t - st.born) / 90 + (st.started ? 0 : 1));
  const r = tg.r * (0.5 + 0.5 * grow);
  for (const [f, c] of [[1, "#ff4b5c"], [0.68, "#fff"], [0.36, "#ff4b5c"]]) { cx.fillStyle = c; cx.beginPath(); cx.arc(tg.x, tg.y, r * f, 0, Math.PI * 2); cx.fill(); }
  if (st.started) { cx.strokeStyle = "#50fab4"; cx.lineWidth = 3; cx.beginPath(); cx.arc(tg.x, tg.y, r + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - life)); cx.stroke(); }
  else { cx.fillStyle = "#c9d1d9"; cx.font = "900 17px Pretendard, sans-serif"; cx.fillText("과녁을 눌러 시작", W / 2, tg.y + 62); }
}

runArcade({
  slug: "aim", W, H, board: "과녁판", ro: "으로", ie: "이에요", unit: "개", emoji: "🎯", title: "에임 연습",
  newState: (seed) => { const s = newState(seed); s.spots[0] = { x: W / 2, y: H / 2 }; return s; },
  step, act, draw, pointer: true,
  why: () => "30초 끝",
  extra: (st) => `정확도 ${accuracy(st)}% · 평균 반응 ${avgRt(st)}ms · 놓친 과녁 ${st.escaped}개`,
});
