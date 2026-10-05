// 첫 화면: 캡슐이 돔에 쏟아져 쌓이고 → 장갑 손이 손잡이를 딸깍딸깍 → 캡슐이 데구르르 → 비틀어 열면 "민지 당첨"
import { prefersReducedMotion } from "../shared/kit.js";
import { createMachine, drawCapsule, spring, clamp01 } from "./machine.js";

const LOOP = 8.2;
const TAGS = [
  { at: 0, text: "① 이름마다 캡슐 하나" },
  { at: 1.9, text: "② 손잡이 돌리면 딸깍딸깍" },
  { at: 3.35, text: "③ 캡슐이 데구르르" },
  { at: 4.5, text: "④ 비틀어 열면 이름이 쏙" },
];
const CLICKS = [2.15, 2.55, 2.95];

export function placeOverlays(root, m) {
  const g = m.geo;
  const slot = root.querySelector(".coin-slot");
  if (slot) Object.assign(slot.style, { left: `${g.slot.x}px`, top: `${g.slot.y}px`, width: `${g.slot.w}px`, height: `${g.slot.h}px` });
  const sign = root.querySelector(".marquee");
  if (sign) sign.style.top = `${g.top}px`;
  const tag = root.querySelector(".tape");
  if (tag) Object.assign(tag.style, { left: `${Math.max(4, g.cx - g.R - 12)}px`, top: `${g.domeCy - g.R * 0.62}px` });
}

export function startIntro(root) {
  const canvas = root.querySelector("canvas");
  const tagEl = root.querySelector(".tape");
  const boardEl = root.closest(".intro")?.querySelector(".mini-board") || document.querySelector(".mini-board");
  const reduced = prefersReducedMotion();
  const m = createMachine(canvas);
  const art = m.art;
  placeOverlays(root, m);
  const ro = new ResizeObserver(() => {
    m.resize();
    placeOverlays(root, m);
    if (reduced) staticFrame();
  });
  ro.observe(canvas.parentElement);

  const items = () => Array.from({ length: 15 }, (_, k) => ({ id: k === 6 ? "g" : `c${k}`, gold: k === 6, color: k }));
  let t = 0;
  let last = performance.now();
  let raf = 0;
  let alive = true;
  let tagIdx = -1;
  let rot = 0;
  let rotFrom = 0;
  let rotTo = 0;
  let rotAt = -9;
  let landedAt = -1;

  function setTag(i) {
    if (!tagEl || tagIdx === i) return;
    tagIdx = i;
    tagEl.textContent = TAGS[i].text;
    tagEl.classList.remove("is-slap");
    void tagEl.offsetWidth;
    tagEl.classList.add("is-slap");
  }

  function reset() {
    t = 0;
    rot = rotFrom = rotTo = 0;
    rotAt = -9;
    landedAt = -1;
    m.clearOut();
    m.setKnob(0);
    m.progress = 0;
    m.fill(items(), { drop: true, stagger: 0.07 });
  }

  // 큰 캡슐이 앞으로 나와 비틀리고 열리는 장면 (캔버스 위에 덧그림)
  function drawReveal(ctx, tt) {
    if (tt < 0) return;
    const g = m.geo;
    const out = m.out;
    if (!out) return;
    out.hidden = tt > 0.05;
    const cx = g.cx;
    const cy = g.domeCy + g.R * 0.02;
    ctx.save();
    ctx.fillStyle = art.paper;
    ctx.globalAlpha = 0.78 * clamp01(tt / 0.3);
    ctx.beginPath();
    ctx.arc(g.cx, g.domeCy, g.R + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    const rise = spring(tt / 0.55);
    const x = out.x + (cx - out.x) * rise;
    const y = out.y + (cy - out.y) * rise;
    const r = out.r * (1 + rise * 1.9);
    const popAt = 1.05;
    if (tt < popAt) {
      const tw = tt > 0.45 ? Math.sin((tt - 0.45) * 26) * clamp01((tt - 0.45) / 0.3) : 0;
      drawCapsule(ctx, x, y, r, out.color, out.gold, art, { twist: Math.abs(tw) * 1.6, rot: tw * 0.08 });
    } else {
      const k = clamp01((tt - popAt) / 0.5);
      // 반쪽이 날아감
      ctx.globalAlpha = 1 - k;
      ctx.save();
      ctx.translate(x + k * 90, y - k * 120);
      ctx.rotate(k * 3);
      ctx.beginPath();
      ctx.arc(0, 0, r, Math.PI, Math.PI * 2);
      ctx.fillStyle = out.gold ? art.goldLight : out.color;
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.translate(x - k * 70, y + k * 110);
      ctx.rotate(-k * 1.2);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI);
      ctx.fillStyle = out.gold ? art.gold : "rgba(255,255,255,0.9)";
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
      // 쪽지 펼침
      const u = spring((tt - popAt) / 0.6);
      const pw = Math.min(g.W * 0.62, 230);
      const ph = 130 * u;
      ctx.save();
      ctx.translate(cx, y - 62);
      ctx.rotate(-0.04);
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "rgba(0,0,0,0.18)";
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 4;
      ctx.fillRect(-pw / 2, 0, pw, ph);
      ctx.shadowColor = "transparent";
      ctx.strokeStyle = "rgba(120,90,40,0.12)";
      for (let ly = 28; ly < ph; ly += 28) {
        ctx.beginPath();
        ctx.moveTo(-pw / 2 + 10, ly);
        ctx.lineTo(pw / 2 - 10, ly);
        ctx.stroke();
      }
      if (u > 0.6) {
        ctx.globalAlpha = clamp01((u - 0.6) / 0.3);
        ctx.fillStyle = art.ink;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `700 15px ${art.pen}`;
        ctx.fillText("1번째 캡슐", 0, 24);
        ctx.font = `700 54px ${art.pen}`;
        ctx.fillText("민지", 0, 76);
        ctx.globalAlpha = 1;
      }
      // 당첨 도장
      const st = tt - popAt - 0.55;
      if (st > 0) {
        const s = 1 + (1 - spring(st / 0.35)) * 1.6;
        ctx.save();
        ctx.translate(pw / 2 - 18, 6);
        ctx.rotate(0.22);
        ctx.scale(s, s);
        ctx.globalAlpha = clamp01(st / 0.12);
        ctx.strokeStyle = art.brand;
        ctx.lineWidth = 3;
        ctx.strokeRect(-36, -18, 72, 36);
        ctx.fillStyle = art.brand;
        ctx.font = `400 24px ${art.display}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("당첨", 0, 1);
        ctx.restore();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function frame(dt) {
    const prev = t;
    t += dt;
    const crossed = (x) => prev < x && t >= x;
    if (crossed(0.02) || prev === 0) setTag(0);
    TAGS.forEach((tg, i) => crossed(tg.at) && setTag(i));
    // 손 + 손잡이
    const handA = t < 1.8 ? 0 : t < 2.05 ? (t - 1.8) / 0.25 : t < 3.3 ? 1 : Math.max(0, 1 - (t - 3.3) / 0.3);
    m.hand = handA > 0 ? { alpha: handA, dx: (1 - handA) * 40, dy: (1 - handA) * 30 } : null;
    CLICKS.forEach((c) => {
      if (crossed(c)) {
        rotFrom = rot;
        rotTo = rot + (Math.PI * 2) / 3;
        rotAt = t;
        m.click("딸깍");
      }
    });
    if (rotAt > 0) {
      rot = rotFrom + (rotTo - rotFrom) * spring((t - rotAt) / 0.22);
      m.setKnob(rot);
      m.progress = clamp01(rot / (Math.PI * 2));
    }
    if (crossed(3.2)) {
      m.dispense("g", () => (landedAt = t));
      m.progress = 0;
    }
    m.update(dt);
    m.draw();
    const ctx = canvas.getContext("2d");
    if (landedAt > 0) drawReveal(ctx, t - Math.max(4.5, landedAt + 0.3));
    // 쪽지에 당첨 도장이 찍히는 순간, 아래 뽑기판 1칸이 채워진다
    boardEl?.classList.toggle("is-won", landedAt > 0 && t - Math.max(4.5, landedAt + 0.3) > 1.62);
    if (t > LOOP) reset();
  }

  function staticFrame() {
    m.fill(items());
    m.dispense("g", () => {});
    for (let k = 0; k < 160; k++) m.update(1 / 60);
    m.setKnob(Math.PI * 2);
    m.draw();
    landedAt = 0.01;
    drawReveal(canvas.getContext("2d"), 2.4);
    boardEl?.classList.add("is-won");
    setTag(3);
  }

  function loop(now) {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (document.hidden) return;
    frame(dt);
  }

  if (reduced) staticFrame();
  else {
    reset();
    raf = requestAnimationFrame(loop);
  }

  return {
    stop() {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
    },
  };
}
