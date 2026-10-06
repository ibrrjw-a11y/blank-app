// 첫 화면 모션그래픽: 별똥별 아이콘이 4기둥에 꽂힘 → 빛이 모여 부적 카드가 뒤집힘 → 달력·도감이 채워짐
import { runIntro, prefersReducedMotion } from "../shared/kit.js";

const SPRING = "cubic-bezier(.34,1.56,.64,1)";
const OUT = "cubic-bezier(.2,.8,.2,1)";
const FALL = "cubic-bezier(.55,0,.85,.45)";
const SLAM = "cubic-bezier(.7,0,.9,.3)";
const COLS = [
  { emoji: "🐍", head: "등장", name: "뱀", mean: "재물" },
  { emoji: "🏠", head: "장소", name: "집", mean: "가정" },
  { emoji: "🏃", head: "사건", name: "쫓김", mean: "압박" },
  { emoji: "😱", head: "기분", name: "공포", mean: "긴장" },
];
const DEX = ["🐷", "🐉", "💩", "🦷", "🐯", "🌸", "💰", "🔥", "🐟", "👵", "🍑", "🐢"];
const WEEK = ["월", "화", "수", "목", "금", "토", "일"];
const PHASES = ["38%", "55%", "72%", "100%", "100%"];
// 장면별 세로 캡션(cap)과 화면 읽기용 문장(say)
const SCENES_TEXT = [
  { cap: "네 칸에 꿈을 넣고", say: "누가·어디서·무슨 일·기분, 꿈을 아이콘 4칸에 넣어요" },
  { cap: "해몽이 끝나요", say: "꿈속 기분까지 읽어서 길몽인지 풀어 드려요" },
  { cap: "아침마다 적으면", say: "매일 기록하면 꿈 도감이 채워지고 이번 달 꿈 리포트가 열려요" },
];

export function startIntro(root) {
  const stage = root.querySelector(".intro__stage");
  const scene = stage.querySelector(".scene");
  const paper = stage.querySelector(".paper");
  const sky = startSky(stage.querySelector(".sky"));
  const rm = prefersReducedMotion();
  const now = new Date();
  const dateLabel = `${now.getMonth() + 1}월 ${now.getDate()}일 아침`;
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
  const rel = (el, base = scene.getBoundingClientRect()) => {
    const r = el.getBoundingClientRect();
    return { x: r.left - base.left + r.width / 2, y: r.top - base.top + r.height / 2, w: r.width, h: r.height, top: r.top - base.top, left: r.left - base.left };
  };

  // 캡션: 한지 오른쪽 첫 줄에 세로 붓글씨로 한 획씩 내려 쓴다 (제목+부제 두 줄 대신)
  const vcap = stage.querySelector(".vcap");
  const say = root.querySelector("#introSay");
  const NUM = ["一", "二", "三", "四"];
  let capIndex = 0;
  function kinetic() {
    const sc = SCENES_TEXT[capIndex % SCENES_TEXT.length];
    if (say) say.textContent = sc.say;
    if (!vcap) return;
    vcap.innerHTML = `${[...sc.cap].map((ch) => (ch === " " ? '<span class="vcap__sp"></span>' : `<span class="vcap__ch">${ch}</span>`)).join("")}<span class="vcap__no">${NUM[capIndex % 4]}</span>`;
    vcap.querySelectorAll(".vcap__ch").forEach((c, i) =>
      anim(
        c,
        [
          { clipPath: "inset(0 0 100% 0)", transform: "translateY(-6px) scale(1.15)", opacity: 0.4 },
          { clipPath: "inset(0 0 0 0)", transform: "translateY(1px) scale(.97)", opacity: 1, offset: 0.7 },
          { clipPath: "inset(0 0 0 0)", transform: "none", opacity: 1 },
        ],
        { duration: 300, delay: 120 + 70 * i, easing: OUT }
      )
    );
    anim(
      vcap.querySelector(".vcap__no"),
      [
        { transform: "scale(2.4) rotate(12deg)", opacity: 0 },
        { transform: "scale(.9) rotate(-6deg)", opacity: 1, offset: 0.7 },
        { transform: "rotate(-4deg)", opacity: 1 },
      ],
      { duration: 380, delay: 200 + 70 * sc.cap.length, easing: SLAM }
    );
  }

  const tableScene = (filled) => `
    <div class="i1">
      <div class="i1__head"><span class="i1__title" data-nofit>꿈 원국</span><span class="i1__date">${dateLabel}</span></div>
      <div class="i1__mid">
        <div class="itb">
          <svg class="itb__lines" aria-hidden="true"></svg>
          ${COLS.map(
            (c) => `<div class="itb__col${filled ? " is-lit" : ""}">
              <span class="itb__head">${c.head}</span>
              <span class="itb__slot"><span class="itb__bleed"></span><span class="itb__ink"></span>${filled ? `<span class="itb__emoji">${c.emoji}</span>` : ""}</span>
              <span class="itb__name">${c.name}</span>
              <span class="itb__mean">${c.mean}</span>
            </div>`
          ).join("")}
        </div>
      </div>
      <div class="i1__foot"><span>네 칸 채우는 중</span><span class="brushbar"><i style="--p:${filled ? 100 : 0}%"></i></span><b>${filled ? 4 : 0}/4</b></div>
    </div>`;

  // 원국 표의 붓선 (실제 크기로 그려서 붓 질감이 고르게)
  function brushLines(itb, { draw = true, delay = 0 } = {}) {
    const svg = itb.querySelector(".itb__lines");
    const w = itb.clientWidth;
    const h = itb.clientHeight;
    const meanTop = itb.querySelector(".itb__mean").offsetTop;
    const j = (n) => (Math.sin(n * 12.9898) * 43758.5453) % 1 * 2;
    const lines = [
      `M${-2} ${1} L${w + 3} ${j(1)}`,
      `M${-3} ${h - 1} L${w + 2} ${h + j(2)}`,
      `M${0} ${-2} L${j(3)} ${h + 3}`,
      `M${w} ${-3} L${w + j(4)} ${h + 2}`,
      ...[1, 2, 3].map((i) => `M${(w / 4) * i + j(i + 5)} ${4} L${(w / 4) * i - j(i + 8)} ${h - 3}`),
      `M${6} ${meanTop} L${w - 4} ${meanTop + j(9)}`,
    ];
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.innerHTML = lines.map((d) => `<path d="${d}" pathLength="1"/>`).join("");
    if (!draw) return;
    svg.querySelectorAll("path").forEach((p, i) =>
      anim(p, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 420, delay: delay + i * 55, easing: OUT })
    );
  }

  function landCol(col, icon) {
    col.classList.add("is-lit");
    anim(icon, [{ transform: "scale(1.5, .6)" }, { transform: "scale(.85, 1.2)", offset: 0.45 }, { transform: "scale(1)" }], { duration: 460 });
    anim(col.querySelector(".itb__bleed"), [{ transform: "scale(.2)", opacity: 0.45 }, { transform: "scale(1)", opacity: 0.2 }], { duration: 900, easing: OUT });
    anim(col.querySelector(".itb__ink"), [{ transform: "scale(.1)" }, { transform: "scale(1)" }], { duration: 520, easing: SPRING });
    anim(col.querySelector(".itb__name"), [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], { duration: 360, delay: 80 });
    anim(col.querySelector(".itb__mean"), [{ transform: "scale(2)", opacity: 0 }, { transform: "scale(.9)", opacity: 1, offset: 0.65 }, { transform: "none", opacity: 1 }], {
      duration: 380,
      delay: 220,
      easing: SLAM,
    });
    anim(col, [{ transform: "none" }, { transform: "translateY(5px)", offset: 0.3 }, { transform: "none" }], { duration: 420 });
  }

  /* ---------- 장면 1: 별똥별이 한지 위 4기둥에 꽂힌다 ---------- */
  function playPillars(signal) {
    reset(signal);
    scene.innerHTML = tableScene(false);
    kinetic();
    const itb = scene.querySelector(".itb");
    brushLines(itb, { delay: 100 });
    anim(scene.querySelector(".i1__head"), [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], { duration: 520 });
    const cols = [...scene.querySelectorAll(".itb__col")];
    anim(itb, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
    cols.forEach((c, i) =>
      anim(c.querySelector(".itb__head"), [{ transform: "translateY(-14px)", opacity: 0 }, { transform: "none", opacity: 1 }], {
        duration: 460,
        delay: 250 + i * 60,
        easing: SPRING,
      })
    );
    const base = scene.getBoundingClientRect();
    const bar = scene.querySelector(".brushbar i");
    const count = scene.querySelector(".i1__foot b");
    cols.forEach((col, i) => {
      const t = rel(col.querySelector(".itb__slot"), base);
      const sx = t.x + base.width * 0.6 + i * 14;
      const sy = -90 - i * 12;
      const ang = (Math.atan2(t.y - sy, t.x - sx) * 180) / Math.PI;
      const m = document.createElement("div");
      m.className = "meteor";
      m.innerHTML = `<span class="meteor__trail" style="transform:rotate(${ang}deg)"></span><span class="meteor__icon">${COLS[i].emoji}</span>`;
      scene.appendChild(m);
      const delay = 520 + i * 600;
      anim(
        m,
        [
          { transform: `translate(${sx}px, ${sy}px) scale(.7)`, opacity: 0 },
          { opacity: 1, offset: 0.1 },
          { transform: `translate(${t.x}px, ${t.y - 10}px) scale(1.15)`, opacity: 1, offset: 0.88 },
          { transform: `translate(${t.x}px, ${t.y}px) scale(1)`, opacity: 1 },
        ],
        { duration: 720, delay, easing: FALL }
      );
      anim(
        m.querySelector(".meteor__trail"),
        [
          { opacity: 0, width: "0px" },
          { opacity: 1, width: "120px", offset: 0.35 },
          { opacity: 0.9, width: "160px", offset: 0.85 },
          { opacity: 0, width: "0px" },
        ],
        { duration: 760, delay, easing: "ease-in" }
      );
      later(
        () => {
          landCol(col, m.querySelector(".meteor__icon"));
          bar.style.setProperty("--p", `${(i + 1) * 25}%`);
          count.textContent = `${i + 1}/4`;
        },
        delay + 720,
        signal
      );
    });
  }

  /* ---------- 장면 2: 원국에서 먹줄이 올라가 부적이 뒤집히고, 도장이 쾅 ---------- */
  function playCard(signal) {
    reset(signal);
    scene.innerHTML =
      tableScene(true) +
      `<svg class="i2__beams" aria-hidden="true"></svg>
      <div class="icard">
        <div class="icard__face icard__back">
          <svg viewBox="0 0 60 60" class="icard__moon" aria-hidden="true"><path d="M38 8a22 22 0 1 0 14 38A18 18 0 0 1 38 8z"/></svg>
          <span class="icard__brand">꿈 사주</span>
        </div>
        <div class="icard__face icard__front">
          <span class="icard__grade">길몽</span>
          <div class="icard__side">
            <span class="icard__kicker">오늘의 꿈</span>
            <span class="icard__head">재물운 <em>▲</em></span>
            <span class="icard__bar" style="--v:88%"></span>
            <span class="icard__bar" style="--v:64%"></span>
            <span class="icard__bar" style="--v:52%"></span>
          </div>
        </div>
      </div>
      <div class="bigseal">吉</div>`;
    kinetic();
    const i1 = scene.querySelector(".i1");
    const itb = scene.querySelector(".itb");
    brushLines(itb, { draw: false });
    const base = scene.getBoundingClientRect();

    // 1) 머리·꼬리는 걷히고, 원국 표는 아래로 접혀 내려간다 (사라지지 않음)
    anim(scene.querySelector(".i1__head"), [{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(0 0 0 100%)" }], { duration: 360, delay: 100 });
    anim(scene.querySelector(".i1__foot"), [{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: 100 });
    const tb = itb.getBoundingClientRect();
    const S = 0.5;
    const dy = base.bottom - 10 - tb.bottom;
    const ox = tb.left - base.left + tb.width / 2;
    const oy = tb.bottom - base.top;
    itb.style.transformOrigin = "50% 100%";
    anim(itb, [{ transform: "none" }, { transform: `translateY(${dy}px) scale(${S})` }], {
      duration: 640,
      delay: 120,
      easing: SPRING,
    });

    // 2) 각 칸에서 먹줄이 카드로 올라간다 (아이콘 사본이 따라 올라감)
    const card = scene.querySelector(".icard");
    const c = rel(card, base);
    const svg = scene.querySelector(".i2__beams");
    svg.setAttribute("viewBox", `0 0 ${base.width} ${base.height}`);
    [...itb.querySelectorAll(".itb__emoji")].forEach((e, i) => {
      const r = rel(e, base);
      const x = ox + (r.x - ox) * S;
      const y = oy + dy - (oy - r.y) * S;
      const tx = c.x + (i - 1.5) * 26;
      const ty = c.top + c.h - 6;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", `M${x} ${y - 22} C ${x} ${(y + ty) / 2}, ${tx} ${(y + ty) / 2 + 20}, ${tx} ${ty}`);
      path.setAttribute("pathLength", "1");
      svg.appendChild(path);
      anim(path, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 520, delay: 320 + i * 70, easing: OUT });
      const ghost = document.createElement("span");
      ghost.className = "meteor";
      ghost.innerHTML = `<span class="meteor__icon">${COLS[i].emoji}</span>`;
      scene.appendChild(ghost);
      anim(
        ghost,
        [
          { transform: `translate(${x}px, ${y}px) scale(.7)`, opacity: 0 },
          { transform: `translate(${x}px, ${y - 30}px) scale(.8)`, opacity: 1, offset: 0.25 },
          { transform: `translate(${tx}px, ${ty - 40}px) scale(.3)`, opacity: 0 },
        ],
        { duration: 700, delay: 360 + i * 70, easing: FALL }
      );
    });

    // 3) 카드 등장 → 뒤집기
    anim(card, [{ transform: "translateY(30px) scale(.2) rotate(-10deg)", opacity: 0 }, { transform: "none", opacity: 1 }], {
      duration: 620,
      delay: 380,
      easing: SPRING,
    });
    const [back, front] = [card.querySelector(".icard__back"), card.querySelector(".icard__front")];
    anim(back, [{ transform: "rotateY(0deg)" }, { transform: "rotateY(180deg)" }], { duration: 640, delay: 1250, easing: SPRING });
    anim(front, [{ transform: "rotateY(-180deg)" }, { transform: "rotateY(0deg)" }], { duration: 640, delay: 1250, easing: SPRING });
    anim(card.querySelector(".icard__head"), [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], { duration: 420, delay: 1700 });
    card.querySelectorAll(".icard__bar").forEach((b, i) =>
      anim(b, [{ backgroundSize: "0% 100%" }, { backgroundSize: "var(--v) 100%" }], { duration: 600, delay: 1750 + i * 90 })
    );

    // 4) 도장: 들어 올렸다가(예비동작) → 쾅 → 찌그러짐·흔들림·인주 튐
    const seal = scene.querySelector(".bigseal");
    const T = 2150;
    anim(
      seal,
      [
        { transform: "translateY(-40px) scale(2.2) rotate(10deg)", opacity: 0 },
        { transform: "translateY(-70px) scale(2.5) rotate(14deg)", opacity: 0.85, offset: 0.55 },
        { transform: "translateY(0) scale(.86, .9) rotate(-12deg)", opacity: 1, offset: 0.86 },
        { transform: "scale(1.04) rotate(-12deg)", opacity: 1, offset: 0.94 },
        { transform: "scale(1) rotate(-12deg)", opacity: 1 },
      ],
      { duration: 640, delay: T, easing: SLAM }
    );
    const hit = T + 560;
    const s = rel(seal, base);
    const shock = document.createElement("span");
    shock.className = "shock";
    shock.style.left = `${s.x}px`;
    shock.style.top = `${s.y}px`;
    scene.appendChild(shock);
    anim(shock, [{ transform: "scale(.6)", opacity: 0 }, { transform: "scale(.7)", opacity: 0.9, offset: 0.05 }, { transform: "scale(2.1)", opacity: 0 }], { duration: 520, delay: hit, easing: OUT });
    for (let k = 0; k < 9; k++) {
      const d = document.createElement("span");
      d.className = "splat";
      d.style.left = `${s.x}px`;
      d.style.top = `${s.y}px`;
      scene.appendChild(d);
      const a = (k / 9) * Math.PI * 2 + 0.4;
      const dist = 70 + (k % 3) * 18;
      const sc = 0.5 + (k % 4) * 0.35;
      anim(
        d,
        [
          { transform: "translate(0,0) scale(.2)", opacity: 0 },
          { transform: `translate(${Math.cos(a) * dist}px, ${Math.sin(a) * dist}px) scale(${sc})`, opacity: 1, offset: 0.5 },
          { transform: `translate(${Math.cos(a) * (dist + 6)}px, ${Math.sin(a) * (dist + 6)}px) scale(${sc})`, opacity: 0.85 },
        ],
        { duration: 420, delay: hit, easing: OUT }
      );
    }
    anim(card, [{ transform: "none" }, { transform: "scale(.95, 1.04) translateY(4px)", offset: 0.25 }, { transform: "none" }], {
      duration: 380,
      delay: hit,
      composite: "add",
    });
    const shake = [
      { transform: "none" },
      { transform: "translate(-4px, 3px)", offset: 0.2 },
      { transform: "translate(3px, -2px)", offset: 0.45 },
      { transform: "translate(-2px, 1px)", offset: 0.7 },
      { transform: "none" },
    ];
    anim(paper, shake, { duration: 300, delay: hit, fill: "none" });
    anim(i1, shake, { duration: 300, delay: hit, fill: "none" });
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
        <div class="i3__count">꿈 도감 <b class="t-num">0</b> / 48 <span class="brushbar"><i></i></span></div>
        <div class="i3__open"><span class="i3__stamp">月</span>
          <div class="i3__rep"><b>이번 달 꿈 리포트</b>
            <span class="i3__bars"><i style="--v:82%"></i><i style="--v:56%"></i><i style="--v:34%"></i></span></div></div>
      </div>`;
    kinetic();
    const col = scene.querySelector(".odo__col");
    const moons = [...scene.querySelectorAll(".i3__moon")];
    anim(scene.querySelector(".i3__cal"), [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], { duration: 520 });
    moons.forEach((m, i) => {
      if (i >= days) return;
      anim(
        m,
        [
          { transform: "scale(0) rotate(-40deg)", opacity: 0 },
          { transform: "scale(1.4) rotate(6deg)", opacity: 1, offset: 0.6 },
          { transform: "scale(1)", opacity: 1 },
        ],
        { duration: 460, delay: 300 + i * 220 }
      );
      later(() => (col.style.transform = `translateY(${-(i + 1)}em)`), 300 + i * 220, signal);
    });
    const cells = [...scene.querySelectorAll(".i3__cell")];
    const order = [3, 0, 7, 10, 1, 5, 9, 2, 11, 6, 4, 8];
    const count = scene.querySelector(".i3__count b");
    const bar = scene.querySelector(".i3__count .brushbar i");
    order.forEach((idx, n) => {
      const c = cells[idx];
      const delay = 1150 + n * 130;
      later(
        () => {
          c.classList.add("is-on");
          count.textContent = String(n + 1);
          bar.style.setProperty("--p", `${Math.round(((n + 1) / 48) * 100)}%`);
        },
        delay,
        signal
      );
      anim(c.firstElementChild, [{ transform: "scale(1.7)" }, { transform: "scale(.88)", offset: 0.6 }, { transform: "scale(1)" }], {
        duration: 380,
        delay,
      });
    });
    const open = scene.querySelector(".i3__open");
    anim(open, [{ opacity: 0.35 }, { opacity: 1 }], { duration: 200, delay: 3050 });
    open.querySelectorAll(".i3__bars i").forEach((b, i) =>
      anim(b, [{ backgroundSize: "0% 100%" }, { backgroundSize: "var(--v) 100%" }], { duration: 600, delay: 3250 + i * 100, easing: SPRING })
    );
    anim(
      open.querySelector(".i3__stamp"),
      [
        { transform: "scale(2.6) rotate(10deg)", opacity: 0 },
        { transform: "scale(.88) rotate(-10deg)", opacity: 1, offset: 0.7 },
        { transform: "scale(1) rotate(-8deg)", opacity: 1 },
      ],
      { duration: 420, delay: 3050, easing: SLAM }
    );

  }

  const ctl = runIntro({
    root,
    loop: true,
    scenes: [
      { duration: 4300, play: (_, s) => ((capIndex = 0), playPillars(s)) },
      { duration: 4400, play: (_, s) => ((capIndex = 1), playCard(s)) },
      { duration: 4400, play: (_, s) => ((capIndex = 2), playDex(s)) },
    ],
  });

  return {
    stop() {
      ctl.stop();
      sky.stop();
      running.forEach((a) => a.cancel());
      scene.innerHTML = "";
      if (vcap) vcap.innerHTML = "";
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
    stars = Array.from({ length: Math.round((w * h) / 6500) }, () => ({
      x: rnd() * w,
      y: rnd() * h * 0.92,
      r: 0.35 + rnd() * 1.1,
      p: rnd() * Math.PI * 2,
      v: 0.6 + rnd() * 1.8,
      gold: rnd() < 0.12,
    }));
  }

  function moon() {
    const mx = w - 30;
    const my = 20;
    ctx.globalAlpha = 1;
    ctx.fillStyle = gold;
    ctx.beginPath();
    ctx.arc(mx, my, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(mx + 6, my - 4, 11, 0, Math.PI * 2);
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
