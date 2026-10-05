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
  renderCrumb,
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

/* ---------- 계산식 도표 ---------- */
const EXAMPLE = { birth: "2000-10-06", asOf: "2026-10-05" };
function setEquation(birth, asOf, { mine = false } = {}) {
  const [by] = parts(birth);
  const [ay] = parts(asOf);
  const before = asOf < birthdayIn(birth, ay) ? 1 : 0;
  const els = ["#eqY", "#eqB", "#eqM", "#eqA"].map((s) => $(s));
  const vals = [ay, by, before, ay - by - before].map(String);
  els.forEach((el, i) => {
    const run = () => odometer(el, vals[i]);
    prefersReducedMotion() ? run() : setTimeout(run, i * 140);
  });
  const bd = birthdayIn(birth, ay);
  const why =
    before === 1
      ? `${ay}년 생일(${dotDate(bd).slice(5)}) 전이라 1을 빼요`
      : asOf === bd
        ? "오늘이 생일이라 빼지 않아요"
        : `${ay}년 생일(${dotDate(bd).slice(5)})이 지나서 0`;
  $("#eqMk").textContent = before ? "생일 전 → 1" : "생일 지남 → 0";
  $("#eqCap").innerHTML = `<b>FIG. 0</b> ${dotDate(birth)}생 · ${dotDate(asOf)} 기준 · ${why}`;
  $("#eq").classList.toggle("is-mine", mine);
}

/* ---------- 결과 ---------- */
function render({ animate = false } = {}) {
  const b = state.birth;
  if (!b) {
    $("#result").hidden = true;
    return;
  }
  const asOf = state.asOf || today;
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
    else setEquation(EXAMPLE.birth, state.asOf || today);
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

/* ---------- 시작 ---------- */
function init() {
  renderCrumb($("#crumb"));
  renderMoreSites($("#more"));
  $("#figDate").textContent = `FIG. 00 — ${dotDate(today)}`;
  $("#asof").value = today;
  bind();
  if (state.birth) {
    birthInput.value = dotDate(state.birth);
    render();
  } else {
    // 짧은 인트로: 예시 계산식이 숫자로 맞춰진다 (2000.10.06생, 2026.10.05 기준)
    setEquation(EXAMPLE.birth, EXAMPLE.asOf);
  }
}

init();
