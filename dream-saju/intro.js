// 첫 화면 모션그래픽: 별똥별 아이콘이 4기둥에 꽂힘 → 빛이 모여 부적 카드가 뒤집힘 → 달력·도감이 채워짐
import { runIntro, prefersReducedMotion } from "../shared/kit.js";

const SPRING = "cubic-bezier(.34,1.56,.64,1)";
const OUT = "cubic-bezier(.2,.8,.2,1)";
const FALL = "cubic-bezier(.55,0,.85,.45)";
const COLS = [
  { emoji: "🐍", head: "등장", name: "뱀" },
  { emoji: "🏠", head: "장소", name: "집" },
  { emoji: "🏃", head: "사건", name: "쫓김" },
  { emoji: "😱", head: "기분", name: "공포" },
];
const DEX = ["🐷", "🐉", "💩", "🦷", "🐯", "🌸", "💰", "🔥", "🐟", "👵", "🍑", "🐢"];
const WEEK = ["월", "화", "수", "목", "금", "토", "일"];
const PHASES = ["38%", "55%", "72%", "100%", "100%"];

export function startIntro(root) {
  const stage = root.querySelector(".intro__stage");
  const scene = stage.querySelector(".scene");
  const sky = startSky(stage.querySelector(".sky"));
  const rm = prefersReducedMotion();
  let running = [];

  const anim = (el, frames, opts = {}) => {
    if (!el) return null;
    const a = el.animate(frames, {
      fill: "both",
      easing: OUT,
      ...opts,
      duration: rm ? 1 : opts.duration || 400,
      delay: rm ? 0 : opts.delay || 0,
    });
    running.push(a);
    return a;
  };
  const later = (fn, ms, signal) => {
    const id = setTimeout(() => !signal.aborted && fn(), rm ? 0 : ms);
    signal.addEventListener("abort", () => clearTimeout(id), { once: true });
  };
  const reset = (signal) => {
    running.forEach((a) => a.cancel());
    running = [];
    signal.addEventListener("abort", () => {
      running.forEach((a) => a.cancel());
      running = [];
    });
  };

  // 제목은 글자 단위로 튀어 오르게 (키네틱 타이포)
  function kinetic() {
    const h = root.querySelector(".intro__caption h2");
    if (!h || rm) return;
    const text = h.textContent;
    h.innerHTML = [...text]
      .map((ch) => `<span class="kchar">${ch === " " ? "&nbsp;" : ch}</span>`)
      .join("");
    h.querySelectorAll(".kchar").forEach((c, i) =>
      anim(
        c,
        [
          { transform: "translateY(70%) scaleY(1.3)", opacity: 0 },
          { transform: "translateY(-8%) scaleY(.92)", opacity: 1, offset: 0.6 },
          { transform: "none", opacity: 1 },
        ],
        { duration: 520, delay: 40 * i, easing: OUT }
      )
    );
  }

  const table = (filled) => `
    <div class="itb">
      ${COLS.map(
        (c) => `<div class="itb__col${filled ? " is-lit" : ""}">
          <span class="itb__head">${c.head}</span>
          <span class="itb__slot"><span class="itb__ink"></span>${filled ? `<span class="itb__emoji">${c.emoji}</span>` : ""}</span>
          <span class="itb__name">${c.name}</span>
        </div>`
      ).join("")}
    </div>`;

  /* ---------- 장면 1: 별똥별이 4기둥에 꽂힌다 ---------- */
  function playPillars(signal) {
    reset(signal);
    scene.innerHTML = `<div class="i1">${table(false)}</div>`;
    kinetic();
    const sr = scene.getBoundingClientRect();
    const cols = [...scene.querySelectorAll(".itb__col")];
    anim(scene.querySelector(".itb"), [{ clipPath: "inset(100% 0 0 0)" }, { clipPath: "inset(0 0 0 0)" }], {
      duration: 520,
    });
    cols.forEach((col, i) => {
      const slot = col.querySelector(".itb__slot");
      const r = slot.getBoundingClientRect();
      const tx = r.left - sr.left + r.width / 2;
      const ty = r.top - sr.top + r.height / 2;
      const sx = tx + sr.width * 0.55 + i * 18;
      const sy = -60 - i * 16;
      const ang = (Math.atan2(ty - sy, tx - sx) * 180) / Math.PI;
      const m = document.createElement("div");
      m.className = "meteor";
      m.innerHTML = `<span class="meteor__trail" style="transform:rotate(${ang}deg)"></span><span class="meteor__icon">${COLS[i].emoji}</span>`;
      scene.appendChild(m);
      const delay = 380 + i * 620;
      anim(
        m,
        [
          { transform: `translate(${sx}px, ${sy}px)`, opacity: 0 },
          { opacity: 1, offset: 0.12 },
          { transform: `translate(${tx}px, ${ty}px)`, opacity: 1 },
        ],
        { duration: 720, delay, easing: FALL }
      );
      anim(
        m.querySelector(".meteor__trail"),
        [
          { opacity: 0, width: "0px" },
          { opacity: 1, width: "110px", offset: 0.35 },
          { opacity: 0.8, width: "150px", offset: 0.92 },
          { opacity: 0, width: "0px" },
        ],
        { duration: 780, delay, easing: "ease-in" }
      );
      later(
        () => {
          col.classList.add("is-lit");
          anim(
            m.querySelector(".meteor__icon"),
            [
              { transform: "scale(1.45, .62)" },
              { transform: "scale(.86, 1.18)", offset: 0.45 },
              { transform: "scale(1)" },
            ],
            { duration: 460, easing: OUT }
          );
          anim(col.querySelector(".itb__ink"), [{ transform: "scale(.1)", opacity: 0.9 }, { transform: "scale(1)", opacity: 1 }], {
            duration: 520,
            easing: SPRING,
          });
          anim(col.querySelector(".itb__name"), [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], {
            duration: 360,
            delay: 80,
          });
          anim(col, [{ transform: "translateY(0)" }, { transform: "translateY(6px)", offset: 0.3 }, { transform: "none" }], {
            duration: 420,
            easing: OUT,
          });
        },
        delay + 720,
        signal
      );
    });
  }

  /* ---------- 장면 2: 빛이 위로 모여 부적 카드가 뒤집힌다 ---------- */
  function playCard(signal) {
    reset(signal);
    scene.innerHTML = `
      <div class="i2">
        ${table(true)}
        <svg class="i2__beams" aria-hidden="true"></svg>
        <div class="icard">
          <div class="icard__face icard__back">
            <svg viewBox="0 0 60 60" class="icard__moon" aria-hidden="true"><path d="M38 8a22 22 0 1 0 14 38A18 18 0 0 1 38 8z"/></svg>
            <span class="icard__brand">꿈 사주</span>
          </div>
          <div class="icard__face icard__front">
            <span class="icard__grade">길몽</span>
            <div class="icard__side">
              <span class="icard__kicker">오늘의 꿈</span>
              <span class="icard__head">재물운 ▲</span>
              <span class="icard__bar" style="--v:88%"></span>
              <span class="icard__bar" style="--v:64%"></span>
              <span class="icard__bar" style="--v:52%"></span>
            </div>
            <span class="icard__seal">吉</span>
          </div>
        </div>
      </div>`;
    kinetic();
    const sr = scene.getBoundingClientRect();
    const card = scene.querySelector(".icard");
    const cr = card.getBoundingClientRect();
    const px = cr.left - sr.left + cr.width / 2;
    const py = cr.top - sr.top + cr.height / 2;
    const svg = scene.querySelector(".i2__beams");
    svg.setAttribute("viewBox", `0 0 ${sr.width} ${sr.height}`);
    const emojis = [...scene.querySelectorAll(".itb__emoji")];
    emojis.forEach((e, i) => {
      const r = e.getBoundingClientRect();
      const x = r.left - sr.left + r.width / 2;
      const y = r.top - sr.top + r.height / 2;
      const len = Math.hypot(px - x, py - y);
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const cx = (x + px) / 2 + (i - 1.5) * 14;
      path.setAttribute("d", `M${x} ${y - 20} Q ${cx} ${(y + py) / 2} ${px} ${py}`);
      path.setAttribute("pathLength", "1");
      svg.appendChild(path);
      anim(path, [{ strokeDashoffset: 1, opacity: 1 }, { strokeDashoffset: 0, opacity: 1, offset: 0.7 }, { strokeDashoffset: 0, opacity: 0 }], {
        duration: 900,
        delay: 120 + i * 90,
        easing: OUT,
      });
      anim(
        e,
        [
          { transform: "none", opacity: 1 },
          { transform: "translateY(6px) scale(1.1)", opacity: 1, offset: 0.25 },
          { transform: `translate(${px - x}px, ${py - y}px) scale(.3)`, opacity: 0 },
        ],
        { duration: 760, delay: 380 + i * 70, easing: FALL }
      );
      void len;
    });
    anim(scene.querySelector(".itb"), [{ opacity: 1, transform: "none" }, { opacity: 0.18, transform: "translateY(16px)" }], {
      duration: 600,
      delay: 760,
    });
    anim(card, [{ transform: "scale(0) rotate(-8deg)", opacity: 0 }, { transform: "scale(1) rotate(0)", opacity: 1 }], {
      duration: 620,
      delay: 1000,
      easing: SPRING,
    });
    const inner = [card.querySelector(".icard__back"), card.querySelector(".icard__front")];
    anim(inner[0], [{ transform: "rotateY(0deg)" }, { transform: "rotateY(180deg)" }], { duration: 700, delay: 1750, easing: SPRING });
    anim(inner[1], [{ transform: "rotateY(-180deg)" }, { transform: "rotateY(0deg)" }], { duration: 700, delay: 1750, easing: SPRING });
    anim(
      card.querySelector(".icard__seal"),
      [
        { transform: "scale(2.6) rotate(8deg)", opacity: 0 },
        { transform: "scale(.9) rotate(-14deg)", opacity: 1, offset: 0.7 },
        { transform: "scale(1) rotate(-12deg)", opacity: 1 },
      ],
      { duration: 380, delay: 2500, easing: "cubic-bezier(.5,0,.75,0)" }
    );
    anim(card, [{ transform: "scale(1)" }, { transform: "scale(.96, 1.03)", offset: 0.3 }, { transform: "scale(1)" }], {
      duration: 360,
      delay: 2760,
      easing: OUT,
      composite: "replace",
    });
    anim(card.querySelector(".icard__head"), [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], {
      duration: 420,
      delay: 2350,
    });
    card.querySelectorAll(".icard__bar").forEach((b, i) =>
      anim(b, [{ backgroundSize: "0% 100%" }, { backgroundSize: "var(--v) 100%" }], { duration: 600, delay: 2450 + i * 90 })
    );
  }

  /* ---------- 장면 3: 달력과 도감이 채워진다 ---------- */
  function playDex(signal) {
    reset(signal);
    const days = 5;
    scene.innerHTML = `
      <div class="i3">
        <div class="i3__streak"><span aria-hidden="true">🔥</span>
          <span class="odo"><span class="odo__col">${Array.from({ length: 10 }, (_, i) => `<span>${i}</span>`).join("")}</span></span>
          <span>일째 아침 기록</span></div>
        <div class="i3__cal">${WEEK.map(
          (w, i) => `<span class="i3__day"><i>${w}</i><b class="i3__moon">${i < days ? `<span class="ph" style="--o:${PHASES[i]}"></span>` : "·"}</b></span>`
        ).join("")}</div>
        <div class="i3__dex">${DEX.map((e) => `<span class="i3__cell"><span>${e}</span></span>`).join("")}</div>
        <div class="i3__count">꿈 도감 <b class="t-num">0</b> / 48</div>
      </div>`;
    kinetic();
    const col = scene.querySelector(".odo__col");
    const moons = [...scene.querySelectorAll(".i3__moon")];
    moons.forEach((m, i) => {
      if (i >= days) return;
      anim(
        m,
        [
          { transform: "scale(0) rotate(-40deg)", opacity: 0 },
          { transform: "scale(1.35) rotate(6deg)", opacity: 1, offset: 0.6 },
          { transform: "scale(1)", opacity: 1 },
        ],
        { duration: 460, delay: 300 + i * 240, easing: OUT }
      );
      later(() => (col.style.transform = `translateY(${-(i + 1)}em)`), 300 + i * 240, signal);
    });
    const cells = [...scene.querySelectorAll(".i3__cell")];
    const order = [3, 0, 7, 10, 1, 5, 9, 2, 11, 6, 4, 8];
    const count = scene.querySelector(".i3__count b");
    order.forEach((idx, n) => {
      const c = cells[idx];
      const delay = 1500 + n * 150;
      later(
        () => {
          c.classList.add("is-on");
          count.textContent = String(n + 1);
        },
        delay,
        signal
      );
      anim(
        c.firstElementChild,
        [{ transform: "scale(1.6)", opacity: 0.2 }, { transform: "scale(.9)", opacity: 1, offset: 0.6 }, { transform: "scale(1)", opacity: 1 }],
        { duration: 380, delay, easing: OUT }
      );
    });
  }

  const ctl = runIntro({
    root,
    loop: true,
    scenes: [
      { title: "꿈을 4칸에 넣으면", desc: "누가·어디서·무슨 일·기분, 아이콘만 톡톡 눌러요", duration: 4300, play: (_, s) => playPillars(s) },
      { title: "해몽이 끝나요", desc: "꿈속 기분까지 읽어서 길몽인지 풀어 드려요", duration: 4200, play: (_, s) => playCard(s) },
      { title: "매일 아침 기록하면", desc: "꿈 도감이 채워지고 이번 달 꿈 리포트가 열려요", duration: 4300, play: (_, s) => playDex(s) },
    ],
  });

  return {
    stop() {
      ctl.stop();
      sky.stop();
      running.forEach((a) => a.cancel());
      scene.innerHTML = "";
    },
  };
}

/* ---------- 밤하늘 (캔버스): 반짝이는 별 + 초승달 + 가끔 별똥별 ---------- */
function startSky(canvas) {
  const ctx = canvas.getContext("2d");
  const css = getComputedStyle(document.documentElement);
  const starColor = css.getPropertyValue("--color-text").trim() || "#fff";
  const gold = css.getPropertyValue("--brand").trim() || "#e8c879";
  const bg = css.getPropertyValue("--color-bg").trim() || "#0a0c10";
  const rm = prefersReducedMotion();
  let w = 0;
  let h = 0;
  let raf = 0;
  let stars = [];
  let shoot = null;
  let lastShoot = 0;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    stars = Array.from({ length: Math.round((w * h) / 4200) }, () => ({
      x: rnd() * w,
      y: rnd() * h * 0.92,
      r: 0.35 + rnd() * 1.1,
      p: rnd() * Math.PI * 2,
      v: 0.6 + rnd() * 1.8,
      gold: rnd() < 0.12,
    }));
  }

  function moon() {
    const mx = w - 46;
    const my = 40;
    ctx.globalAlpha = 1;
    ctx.fillStyle = gold;
    ctx.beginPath();
    ctx.arc(mx, my, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(mx + 8, my - 5, 15, 0, Math.PI * 2);
    ctx.fill();
  }

  function frame(t) {
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      const a = rm ? 0.7 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t / 1000 * s.v + s.p));
      ctx.globalAlpha = a * (s.gold ? 0.95 : 0.7);
      ctx.fillStyle = s.gold ? gold : starColor;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    moon();
    if (!rm) {
      if (!shoot && t - lastShoot > 5200) {
        shoot = { x: w * (0.3 + Math.random() * 0.6), y: h * 0.05, t0: t };
        lastShoot = t;
      }
      if (shoot) {
        const k = (t - shoot.t0) / 900;
        if (k >= 1) shoot = null;
        else {
          const e = 1 - Math.pow(1 - k, 3);
          const x = shoot.x - e * 160;
          const y = shoot.y + e * 90;
          const g = ctx.createLinearGradient(x, y, x + 60, y - 34);
          g.addColorStop(0, gold);
          g.addColorStop(1, "transparent");
          ctx.globalAlpha = 1 - k;
          ctx.strokeStyle = g;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 60, y - 34);
          ctx.stroke();
        }
      }
      raf = requestAnimationFrame(frame);
    }
    ctx.globalAlpha = 1;
  }

  resize();
  const onResize = () => resize();
  window.addEventListener("resize", onResize);
  raf = requestAnimationFrame(frame);
  return {
    stop() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    },
  };
}
