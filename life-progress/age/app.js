// 만나이 계산기 (/life-progress/age/)
// 날짜 계산은 ../core.js, 생년월일은 인생 진행률과 같은 저장소("life-progress")에 둔다.
import {
  $,
  createStore,
  haptic,
  fmt,
  countUp,
  share,
  shareImage,
  urlWith,
  todayKey,
  renderMoreSites,
  createCanvas,
  CANVAS_FONT,
  prefersReducedMotion,
} from "../../shared/kit.js";
import {
  YEAR_DAYS,
  DEFAULT_LIFE,
  parts,
  dotDate,
  longDate,
  birthdayIn,
  manAge,
  nextBirthday,
  diffDays,
  token,
  odometer,
  parseBirth,
  formatBirthInput,
  zodiacOf,
} from "../core.js";

const store = createStore("life-progress");
const state = { birth: store.get("birth", null), asOf: null };
const today = todayKey();
const birthInput = $("#birth");

/* ---------- 생일 눈금자: 지나간 생일 칸 수 = 만 나이 ---------- */
const EXAMPLE = { birth: "2000-10-06", asOf: "2026-10-05" };
let sweepRaf = 0;
const easeOutBack = (t) => {
  const c = 1.4;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};
function pop(el) {
  el.classList.remove("is-pop");
  void el.offsetWidth;
  el.classList.add("is-pop");
}
function buildRuler(span) {
  const ticks = [];
  for (let k = 0; k <= span; k++) {
    const left = (k / span) * 100;
    const cls = k === 0 ? "tk is-birth" : k === span ? "tk is-next" : k % 10 === 0 ? "tk is-ten" : "tk";
    ticks.push(`<i class="${cls}" style="left:${left}%"></i>`);
    if (k % 10 === 0 && k < span && (span - k) / span > 0.06) ticks.push(`<em style="left:${left}%">${k}</em>`);
  }
  ticks.push(`<em class="is-next" style="left:100%">${span}</em>`);
  $("#rulerTicks").innerHTML = ticks.join("");
  return [...$("#rulerTicks").querySelectorAll(".tk")];
}
// 눈금자 + 식을 그린다. sweep 이면 0세부터 오늘까지 쓸고 지나가며 생일 칸이 하나씩 찬다
function setEquation(birth, asOf, { mine = false, sweep = true, keepSpan = 0 } = {}) {
  cancelAnimationFrame(sweepRaf);
  const [by] = parts(birth);
  const [ay] = parts(asOf);
  const bd = birthdayIn(birth, ay);
  const before = asOf < bd ? 1 : 0;
  const age = Math.max(0, ay - by - before);
  const span = keepSpan || age + 1; // 다음 생일 칸까지 (예시의 '하루 넘기기'는 눈금을 그대로 두고 마지막 칸을 채운다)
  const lived = Math.max(0, diffDays(birth, asOf)) / YEAR_DAYS;
  const nowFrac = Math.min(1, lived / span);
  const nextBd = nextBirthday(birth, asOf);
  const dday = diffDays(asOf, nextBd);
  const ticks = buildRuler(span);
  const now = $("#rulerNow");
  const ageEl = $("#eqA");
  now.classList.toggle("is-right", nowFrac > 0.55);
  $("#rulerNowLabel").textContent = `${dotDate(asOf)} 기준`;
  $("#eqY").textContent = ay;
  $("#eqB").textContent = by;
  $("#eqM").textContent = before;
  $("#eqS").textContent = age;
  $("#eqMk").textContent = before ? "생일 전" : asOf === bd ? "오늘 생일" : "생일 지남";
  $("#eq").classList.toggle("is-before", !!before);
  $("#eq").classList.toggle("is-mine", mine);
  const badge = $("#eqBadge");
  badge.textContent = asOf === bd ? "오늘 생일" : dday === 0 ? "오늘 생일" : `다음 생일 D-${fmt.num(dday)}`;
  badge.classList.toggle("is-today", asOf === bd);
  const why =
    before === 1
      ? `${ay}년 생일(${dotDate(bd).slice(5)}) 전이라 1을 빼요`
      : asOf === bd
        ? "오늘이 생일이라 빼지 않아요"
        : `${ay}년 생일(${dotDate(bd).slice(5)})이 지나서 0`;
  $("#eqCap").textContent = `${dotDate(birth)}생 · ${dotDate(asOf)} 기준 · ${why}`;
  const paint = (frac) => {
    now.style.left = `${frac * 100}%`;
    const passed = Math.min(age, Math.floor(frac * span + 1e-6));
    ticks.forEach((t, k) => t.classList.toggle("is-past", k > 0 && k <= passed));
    if (ageEl.textContent !== String(passed)) ageEl.textContent = passed;
    return passed;
  };
  if (!sweep || prefersReducedMotion()) {
    paint(nowFrac);
    ticks.forEach((t, k) => t.classList.toggle("is-past", k > 0 && k <= age));
    ageEl.textContent = age;
    return;
  }
  const t0 = performance.now();
  const dur = 900;
  const tick = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    paint(Math.max(0, Math.min(1, nowFrac * easeOutBack(p))));
    if (p < 1) sweepRaf = requestAnimationFrame(tick);
    else {
      paint(nowFrac);
      ageEl.textContent = age;
      pop(ageEl);
    }
  };
  paint(0);
  sweepRaf = requestAnimationFrame(tick);
}

// 예시 반복: 생일 하루 전(만 25세) → 하루 지나 생일 당일(만 26세)
let demoTimer = 0;
function stopDemo() {
  clearTimeout(demoTimer);
  demoTimer = 0;
}
function playDemo() {
  stopDemo();
  setEquation(EXAMPLE.birth, EXAMPLE.asOf);
  if (prefersReducedMotion()) return;
  demoTimer = setTimeout(() => {
    // 하루 넘기기: 눈금이 다음 생일 칸에 닿고 숫자가 한 칸 올라간다
    setEquation(EXAMPLE.birth, "2026-10-06", { sweep: false, keepSpan: 26 });
    const next = $("#rulerTicks .tk.is-next");
    next?.classList.add("is-past", "is-hit");
    pop($("#eqA"));
    pop($("#eqBadge"));
    demoTimer = setTimeout(playDemo, 2400);
  }, 2600);
}

/* ---------- 결과 ---------- */
function render({ animate = false } = {}) {
  const b = state.birth;
  if (!b) {
    $("#result").hidden = true;
    return;
  }
  const asOf = state.asOf || today;
  stopDemo();
  setEquation(b, asOf, { mine: true });
  const res = $("#result");
  res.hidden = false;
  if (asOf < b) {
    $("#ageAsOf").textContent = "기준일이 생일보다 앞이에요";
    $("#ageMan").dataset.odo = "";
    $("#ageMan").textContent = "–";
    return;
  }
  const [by, bm, bd] = parts(b);
  const [ay] = parts(asOf);
  const age = manAge(b, asOf);
  $("#ageAsOf").textContent = `${asOf === today ? "오늘" : longDate(asOf)} 기준 · ${dotDate(b)}생`;
  odometer($("#ageMan"), String(age));
  $("#ageYear").textContent = `${ay - by}세`;
  $("#ageKor").textContent = `${ay - by + 1}살`;
  const nb = nextBirthday(b, asOf);
  const gap = diffDays(asOf, nb);
  $("#nextBday").textContent = gap === 0 ? "오늘" : `D-${fmt.num(gap)}`;
  const leapNote = bm === 2 && bd === 29 && nb.slice(5) === "03-01" ? " · 평년이라 3월 1일" : "";
  $("#nextBdaySub").textContent = `${longDate(nb)} · 만 ${manAge(b, nb)}세${leapNote}`;
  const lived = diffDays(b, asOf) + 1;
  if (animate) countUp($("#livedDays"), lived, { duration: 900, format: (n) => `${fmt.num(Math.round(n))}일째` });
  else $("#livedDays").textContent = `${fmt.num(lived)}일째`;
  $("#zodiac").textContent = `${zodiacOf(by)}띠`;
  $("#zodiacSub").textContent = bm <= 2 ? "1~2월생은 설·입춘 기준 앞 해 띠일 수 있어요" : "양력 출생 연도 기준";
  const adult = `${by + 19}.01.01`;
  $("#adultDay").textContent = asOf >= `${by + 19}-01-01` ? "가능" : `${adult}부터`;
  $("#schoolDay").textContent = `${by + 7}년 3월`;
  $("#calcNote").textContent =
    bm === 2 && bd === 29
      ? "2월 29일생은 평년에 3월 1일에 한 살 늘어나는 것으로 계산해요."
      : "2023년 6월 28일부터 법적 나이는 만 나이가 기본이에요.";
  // 인생 진행률 미리보기
  const life = Number(store.get("life", DEFAULT_LIFE)) || DEFAULT_LIFE;
  const pct = Math.min(100, ((diffDays(b, today)) / (life * YEAR_DAYS)) * 100);
  $("#lifeSub").textContent = `지금 ${pct.toFixed(1)}% · 4,342칸 중 ${fmt.num(manAge(b, today) * 52 + Math.min(51, Math.floor(diffDays(birthdayIn(b, by + manAge(b, today)), today) / 7)) + 1)}번째 칸`;
}

function setBirth(k) {
  state.birth = k;
  store.set("birth", k);
  render({ animate: true });
  haptic(14);
}

function validate() {
  const field = $("#birthField");
  const digits = birthInput.value.replace(/\D/g, "");
  field.classList.remove("is-error");
  $("#birthHelp").textContent = "숫자 8자리만 넣으면 돼요";
  if (digits.length < 8) return null;
  const k = parseBirth(digits);
  if (!k || k > today) {
    field.classList.add("is-error");
    $("#birthHelp").textContent = !k ? "없는 날짜예요. 다시 확인해 주세요" : "미래 날짜는 계산할 수 없어요";
    return null;
  }
  return k;
}

function bind() {
  birthInput.addEventListener("input", () => {
    birthInput.value = formatBirthInput(birthInput.value);
    const k = validate();
    if (k) {
      setBirth(k);
      birthInput.blur();
    }
  });
  $("#asof").addEventListener("change", () => {
    const v = $("#asof").value;
    state.asOf = /^\d{4}-\d{2}-\d{2}$/.test(v) && v !== today ? v : null;
    if (state.birth) render();
    else {
      stopDemo();
      setEquation(EXAMPLE.birth, state.asOf || today);
    }
  });
  $("#asofToday").addEventListener("click", () => {
    state.asOf = null;
    $("#asof").value = today;
    if (state.birth) render();
  });
  // 계산 키: 입력이 비었으면 그때만 입력칸으로 (사용자 동작일 때만 포커스)
  $("#calcBtn").addEventListener("click", () => {
    const k = validate() || (birthInput.value ? null : state.birth);
    if (!k) {
      $("#birthField").classList.add("is-error");
      if (!birthInput.value) $("#birthHelp").textContent = "생년월일 8자리를 먼저 넣어 주세요";
      birthInput.focus({ preventScroll: true });
      return;
    }
    if (k !== state.birth) setBirth(k);
    else render({ animate: true });
    haptic(10);
    $("#result").scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  });
  $("#shareLink").addEventListener("click", () => {
    const age = manAge(state.birth, state.asOf || today);
    share({
      title: "만나이 계산기",
      text: `2023년부터 법적 나이는 만 나이! 나는 만 ${age}세래요. 너는 몇 살이야?`,
      url: urlWith({}),
    });
  });
  $("#saveCard").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.classList.add("is-loading");
    try {
      await shareImage(drawCard(), { filename: `만나이-${dotDate(state.asOf || today)}.png`, text: "만 나이 계산 결과" });
    } finally {
      btn.classList.remove("is-loading");
    }
  });
}

/* ---------- 결과 카드 (생년월일은 넣지 않는다) ---------- */
function drawCard() {
  const W = 540;
  const H = 675;
  const { canvas, ctx } = createCanvas(W, H, 2);
  const brand = token("--brand");
  const black = token("--art-black");
  const white = token("--art-white");
  const sub = token("--color-text-secondary");
  const num = token("--art-num") || CANVAS_FONT;
  const disp = token("--font-display") || CANVAS_FONT;
  const asOf = state.asOf || today;
  const age = manAge(state.birth, asOf);
  const [by] = parts(state.birth);
  const [ay] = parts(asOf);
  ctx.fillStyle = black;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = white;
  ctx.textAlign = "left";
  ctx.font = `900 20px ${disp}`;
  ctx.fillText("만나이 계산기", 28, 52);
  ctx.textAlign = "right";
  ctx.fillStyle = sub;
  ctx.font = `600 12px ${num}`;
  ctx.fillText(`FIG. 0 — ${dotDate(asOf)} 기준`, W - 28, 52);
  ctx.fillStyle = white;
  ctx.fillRect(28, 66, W - 56, 1.5);
  ctx.textAlign = "left";
  ctx.fillStyle = brand;
  ctx.font = `900 34px ${disp}`;
  ctx.fillText("만", 28, 124);
  ctx.fillStyle = white;
  ctx.font = `900 300px ${num}`;
  ctx.fillText(String(age), 14, 380);
  const w = ctx.measureText(String(age)).width;
  ctx.font = `900 40px ${disp}`;
  ctx.fillText("세", Math.min(14 + w + 8, W - 60), 380);
  const rows = [
    ["연 나이", `${ay - by}세`],
    ["세는 나이", `${ay - by + 1}살`],
    ["다음 생일까지", `D-${fmt.num(diffDays(asOf, nextBirthday(state.birth, asOf)))}`],
  ];
  let y = 430;
  rows.forEach(([k, v]) => {
    ctx.fillStyle = white;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(28, y, W - 56, 1);
    ctx.globalAlpha = 1;
    ctx.fillStyle = sub;
    ctx.font = `600 16px ${disp}`;
    ctx.textAlign = "left";
    ctx.fillText(k, 28, y + 40);
    ctx.fillStyle = white;
    ctx.font = `900 30px ${num}`;
    ctx.textAlign = "right";
    ctx.fillText(v, W - 28, y + 42);
    y += 62;
  });
  ctx.textAlign = "left";
  ctx.fillStyle = sub;
  ctx.font = `500 12px ${CANVAS_FONT}`;
  ctx.fillText("2023.6.28 만 나이 통일법 기준 · 너는 만 몇 살이야?", 28, H - 28);
  return canvas;
}

/* ---------- 하단: 법령집 뒤 부록 (색인 탭) ---------- */
function renderAppendix(el) {
  renderMoreSites(el);
  if (!el) return;
  const title = el.querySelector(".more-sites__title");
  if (title) title.innerHTML = `<span class="ap__k t-num">APPENDIX</span>부록 · 같이 쓰는 계산기`;
  el.querySelectorAll(".more-sites__item").forEach((a, i) => {
    a.insertAdjacentHTML("beforeend", `<span class="ap__tab t-num" aria-hidden="true">${"ABC"[i] || i + 1}</span>`);
  });
}

/* ---------- 시작 ---------- */
function init() {
  renderAppendix($("#more"));
  $("#asof").value = today;
  bind();
  if (state.birth) {
    birthInput.value = dotDate(state.birth);
    render();
  } else {
    // 첫 화면: 예시(2000.10.06생)로 생일 하루 전 → 생일 당일을 반복해서 보여준다
    playDemo();
  }
}

init();
