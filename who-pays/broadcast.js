// 첫 화면 "생중계" 틀: 캔버스 무대, 장면 전환 스팅어, 오도미터 시계, 키네틱 헤드라인, 해설 자막, 장면 바.
// 각 페이지(레이스·배틀로얄·통아저씨)는 장면 정보와 그리기 함수만 넘긴다.
//
// runBroadcast(root, {
//   scenes: [{ tag, lines: [줄1, 줄2], desc, dur }],
//   draw: (env) => [scene1(t, dt), ...],   // env: { ctx, tk, view, floor, tower, marbleAt }
//   staticT: [초...]                         // 모션 줄이기 설정일 때 보여 줄 정지 프레임
// })
import { prefersReducedMotion } from "../shared/kit.js";
import { readTokens, drawMarble, fitCanvas, squashAmt, escapeHtml, drawTower, PALETTE } from "./common.js";

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 3);
export const easeIn = (t) => Math.pow(clamp01(t), 3);

export const DEMO_NAMES = ["민수", "영희", "철수", "지은"];
export const DEMO_COLORS = [PALETTE[0], PALETTE[1], PALETTE[2], PALETTE[3]];

export function runBroadcast(root, { scenes, draw, staticT, ltTag = "해설" }) {
  const stage = root.querySelector(".intro__stage");
  stage.innerHTML = '<canvas class="intro__canvas"></canvas>';
  const canvas = stage.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const headEl = root.querySelector(".kinetic");
  const descEl = root.querySelector(".intro__desc");
  const stepsEl = root.querySelector(".bc-steps");
  const clockEl = root.querySelector(".odo");
  const tk = readTokens();
  const reduced = prefersReducedMotion();

  const env = {
    ctx,
    tk,
    view: fitCanvas(canvas),
    towerPos: {},
    // 아스팔트 바닥 + 가는 스캔라인
    floor() {
      const { w, h } = env.view;
      ctx.fillStyle = tk.asphalt;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.025)";
      for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
    },
    // 착지 스쿼시가 들어간 구슬 + 그림자
    marbleAt(x, y, r, i, land = -1, rot = 0) {
      const a = land >= 0 ? squashAmt(land) : 0;
      ctx.beginPath();
      ctx.ellipse(x, y + r * 0.95, r * (0.9 + a), r * 0.22, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fill();
      drawMarble(ctx, x, y + r * a * 0.9, r, DEMO_COLORS[i], DEMO_NAMES[i][0], rot, tk, 1 + a, 1 - a);
    },
    // 라이브 타이밍 타워 (데모 4명)
    tower(order, gaps, dt, opts = {}) {
      const rows = order.map((i, k) => ({ i, rank: k + 1, name: DEMO_NAMES[i], color: DEMO_COLORS[i], gap: gaps[k], hot: i === opts.hot }));
      drawTower(ctx, rows, env.towerPos, dt, tk, { scale: 1.35, wdt: 150, total: 4, ...opts });
    },
  };
  const fns = draw(env);

  const ro = new ResizeObserver(() => {
    env.view = fitCanvas(canvas);
    if (reduced) paint(staticT[scene]);
  });
  ro.observe(stage);

  let scene = 0;
  let t0 = performance.now();
  let raf = 0;
  let timer = 0;
  let alive = true;

  // 장면 전환 스팅어: 사선 띠가 화면을 훑고 지나감
  function stinger(t) {
    const { w, h } = env.view;
    const p = t / 0.45;
    if (p >= 1) return;
    const x = -w * 0.6 + easeIn(p) * w * 2.4;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + w * 0.55, 0);
    ctx.lineTo(x + w * 0.55 - h * 0.35, h);
    ctx.lineTo(x - h * 0.35, h);
    ctx.closePath();
    ctx.fillStyle = tk.brand;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    for (let k = -h; k < w * 2; k += 22) {
      ctx.beginPath();
      ctx.moveTo(x + k, 0);
      ctx.lineTo(x + k + 10, 0);
      ctx.lineTo(x + k + 10 - h * 0.35, h);
      ctx.lineTo(x + k - h * 0.35, h);
      ctx.fill();
    }
    ctx.fillStyle = "#fff";
    ctx.font = `800 34px ${tk.display}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(scenes[scene].tag, x + 18 - h * 0.17, h / 2);
    ctx.restore();
  }

  let lastNow = performance.now();
  function paint(t, dt = 1 / 60) {
    const { w, h, dpr } = env.view;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    fns[scene](t, Math.min(dt, 0.05));
    ctx.restore();
    if (!reduced) stinger(t);
  }

  function loop(now) {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    const dt = (now - lastNow) / 1000;
    lastNow = now;
    if (document.hidden) return;
    const t = (now - t0) / 1000;
    paint(t, dt);
    tickClock(t);
  }

  /* ---------- 오도미터 시계: 바뀐 자리만 포인트 색으로 깜빡 ---------- */
  const wheels = clockEl ? [...clockEl.querySelectorAll(".odo__col")] : [];
  wheels.forEach((col) => {
    col.innerHTML = `<span class="odo__reel">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => `<i>${d}</i>`).join("")}</span>`;
    col._d = 0;
  });
  function setDigit(col, d, flash) {
    if (col._d === d) return;
    col._d = d;
    col.firstChild.style.transform = `translateY(calc(${-d} * var(--odo-h)))`;
    if (flash && !reduced) {
      col.classList.remove("is-tick");
      void col.offsetWidth;
      col.classList.add("is-tick");
    }
  }
  let clockBase = 0;
  function tickClock(t) {
    if (!wheels.length) return;
    const total = clockBase + Math.max(0, t);
    const s = Math.floor(total);
    const digits = `${String(Math.floor(s / 60) % 60).padStart(2, "0")}${String(s % 60).padStart(2, "0")}${Math.floor((total % 1) * 10)}`;
    wheels.forEach((col, k) => setDigit(col, Number(digits[k]), k < 4));
  }

  /* ---------- 키네틱 헤드라인 + 해설 자막 ---------- */
  function setHeadline(i) {
    const s = scenes[i];
    if (headEl) {
      let n = 0;
      const html = s.lines
        .map(
          (line, li) =>
            `<span class="kinetic__line${li === 1 ? " is-hot" : ""}">${Array.from(line)
              .map((ch) => (ch === " " ? '<span class="kinetic__sp"> </span>' : `<span class="kinetic__ch" style="--i:${n++}">${escapeHtml(ch)}</span>`))
              .join("")}</span>`
        )
        .join("");
      headEl.classList.add("is-out");
      setTimeout(
        () => {
          if (!alive) return;
          headEl.innerHTML = html;
          headEl.setAttribute("aria-label", s.lines.join(" "));
          headEl.classList.remove("is-out");
        },
        reduced ? 0 : 180
      );
    }
    if (descEl) {
      descEl.innerHTML = `<span class="lt__tag">${escapeHtml(ltTag)}</span><span class="lt__text">${escapeHtml(s.desc)}</span>`;
      descEl.classList.remove("is-in");
      void descEl.offsetWidth;
      descEl.classList.add("is-in");
    }
    stepsEl?.querySelectorAll(".bc-steps__seg").forEach((seg, k) => {
      seg.classList.toggle("is-on", k === i);
      seg.classList.toggle("is-done", k < i);
      seg.style.setProperty("--dur", `${s.dur}ms`);
    });
  }

  function show(i) {
    if (!alive) return;
    clockBase = scenes.slice(0, i).reduce((a, s) => a + s.dur / 1000, 0);
    scene = i;
    env.towerPos = {};
    t0 = performance.now();
    setHeadline(i);
    if (reduced) {
      paint(staticT[i]);
      tickClock(0);
    }
    clearTimeout(timer);
    timer = setTimeout(() => show((i + 1) % scenes.length), scenes[i].dur);
  }

  if (stepsEl) {
    stepsEl.style.setProperty("--n", scenes.length);
    stepsEl.innerHTML = scenes
      .map((s, k) => `<button class="bc-steps__seg" data-k="${k}" aria-label="${s.tag}"><span>${s.tag.split(" ")[0]}</span><i></i></button>`)
      .join("");
    stepsEl.onclick = (e) => {
      const b = e.target.closest("[data-k]");
      if (b) show(Number(b.dataset.k));
    };
  }
  show(0);
  if (!reduced) raf = requestAnimationFrame(loop);

  return {
    stop() {
      alive = false;
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      ro.disconnect();
    },
  };
}
