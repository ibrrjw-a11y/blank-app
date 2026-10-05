import {
  $,
  $$,
  createStore,
  toast,
  haptic,
  share,
  shareImage,
  encodeState,
  decodeState,
  urlWith,
  getParam,
  todayKey,
  runIntro,
  showView,
  renderMoreSites,
  createCanvas,
  roundRect,
  CANVAS_FONT,
  countUp,
  fmt,
  prefersReducedMotion,
} from "../shared/kit.js";
import {
  YEAR_DAYS,
  ZODIAC,
  DEFAULT_LIFE,
  parts,
  toUTC,
  fromUTC,
  addDays,
  diffDays,
  dotDate,
  longDate,
  birthdayIn,
  manAge,
  nextBirthday,
  esc,
  token,
  alpha,
  odometer,
  parseBirth,
  formatBirthInput,
} from "./core.js";

const store = createStore("life-progress");
/* ---------- 상태 ---------- */
const state = {
  birth: store.get("birth", null),
  life: Number(store.get("life", DEFAULT_LIFE)) || DEFAULT_LIFE,
  unit: store.get("unit", "week"),
  bucket: store.get("bucket", []) || [],
  parent: store.get("parent", { age: "", per: "" }) || { age: "", per: "" },
  asOf: null,
  friend: null,
  showPastMiles: false,
};

/* ---------- 계산 ---------- */
function lifeModel(birth, life, today = todayKey()) {
  const lived = diffDays(birth, today) + 1; // 태어난 날 = 1일째
  const totalDays = life * YEAR_DAYS;
  const end = addDays(birth, Math.round(totalDays));
  const pct = Math.min(100, Math.max(0, ((lived - 1) / totalDays) * 100));
  const age = manAge(birth, today);
  const lastBday = birthdayIn(birth, parts(birth)[0] + age);
  const weekInYear = Math.min(51, Math.floor(diffDays(lastBday, today) / 7));
  const [, bm, bd] = parts(birth);
  const [ty, tm, tdd] = parts(today);
  let monthInYear = (ty - parts(lastBday)[0]) * 12 + (tm - bm) - (tdd < Math.min(bd, 28) ? 1 : 0);
  monthInYear = Math.max(0, Math.min(11, monthInYear));
  return { lived, totalDays, end, pct, age, weekInYear, monthInYear, today };
}
function countDates(from, to, mmdd) {
  // from..to 사이에 들어 있는 특정 월·일의 개수
  let n = 0;
  for (let y = parts(from)[0]; y <= parts(to)[0]; y++) {
    const k = `${y}-${mmdd}`;
    if (k >= from && k <= to) n++;
  }
  return n;
}
function emotionalStats(birth, life) {
  const m = lifeModel(birth, life);
  const today = m.today;
  const end = m.end;
  const christmas = end > today ? countDates(today, end, "12-25") : 0;
  // 남은 주말 = 남은 토요일 수
  let weekends = 0;
  if (end > today) {
    const dow = new Date(toUTC(today)).getUTCDay();
    const firstSat = addDays(today, (6 - dow + 7) % 7);
    weekends = firstSat <= end ? Math.floor(diffDays(firstSat, end) / 7) + 1 : 0;
  }
  // 남은 봄: 아직 끝나지 않은 봄(3~5월) 중 기대수명 안에 시작하는 것
  let springs = 0;
  for (let y = parts(today)[0]; y <= parts(end)[0]; y++) {
    if (`${y}-05-31` >= today && `${y}-03-01` <= end) springs++;
  }
  const livedMs = Date.now() - (toUTC(birth) - 9 * 3600000);
  const beats = (livedMs / 60000) * 70;
  const orbits = (m.lived - 1) / 365.256;
  const sleepYears = ((m.lived - 1) * 8) / 24 / YEAR_DAYS;
  return { ...m, christmas, weekends, springs, beats, orbits, sleepYears };
}
function milestones(birth, life) {
  const list = [];
  [1000, 5000, 10000, 15000, 20000, 25000, 30000].forEach((n) =>
    list.push({ date: addDays(birth, n - 1), title: `${fmt.num(n)}일째`, sub: n === 10000 ? "만 일, 태어난 날 = 1일째" : "태어난 날 = 1일째", hot: n % 10000 === 0 }),
  );
  [
    [1e8, "1억 초"],
    [1e9, "10억 초"],
    [2e9, "20억 초"],
  ].forEach(([s, t]) => list.push({ date: fromUTC(toUTC(birth) + s * 1000), title: `${t} 살기`, sub: "태어난 시각을 0시로 가정한 대략치", hot: s === 1e9 }));
  [1000, 2000, 3000, 4000].forEach((w) => list.push({ date: addDays(birth, w * 7), title: `${fmt.num(w)}주`, sub: "그리드 한 칸 = 일주일" }));
  [20, 30, 40, 50, 60, 70, 80].forEach((a) =>
    list.push({ date: birthdayIn(birth, parts(birth)[0] + a), title: `만 ${a}세`, sub: a === 60 ? "환갑" : "생일", hot: a % 10 === 0 && a <= 40 }),
  );
  list.push({ date: addDays(birth, Math.round((life * YEAR_DAYS) / 2)), title: "인생의 절반", sub: `기대수명 ${life}세 가정` });
  return list.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/* ---------- 생년월일 (만나이 계산기는 age/ 페이지) ---------- */
const birthInput = $("#birth");
birthInput.addEventListener("input", () => {
  birthInput.value = formatBirthInput(birthInput.value);
  const field = $("#birthField");
  const digits = birthInput.value.replace(/\D/g, "");
  field.classList.remove("is-error");
  $("#birthHelp").textContent = "숫자 8자리만 넣으면 돼요 · 이 기기에만 저장";
  if (digits.length < 8) return;
  const k = parseBirth(digits);
  if (!k || k > todayKey()) {
    field.classList.add("is-error");
    $("#birthHelp").textContent = !k ? "없는 날짜예요. 다시 확인해 주세요" : "미래 날짜는 계산할 수 없어요";
    return;
  }
  setBirth(k, { fresh: true });
  birthInput.blur();
});

function setBirth(k, { fresh = false } = {}) {
  const changed = state.birth !== k;
  state.birth = k;
  store.set("birth", k);
  renderAll({ animate: fresh || changed });
  if (fresh) haptic(14);
}

// 한 줄 요약: 만 나이 · 살아온 날 · 다음 생일 (자세한 계산은 만나이 계산기에서)
function renderBirthSummary() {
  const b = state.birth;
  const today = todayKey();
  const nb = nextBirthday(b, today);
  const gap = diffDays(today, nb);
  const [by] = parts(b);
  $("#birthSum").hidden = false;
  $("#sumAge").textContent = `만 ${manAge(b, today)}세`;
  $("#sumDays").textContent = `${fmt.num(diffDays(b, today) + 1)}일째`;
  $("#sumNext").textContent = gap === 0 ? "오늘" : `D-${fmt.num(gap)}`;
  $("#sumZodiac").textContent = `${ZODIAC[(((by - 4) % 12) + 12) % 12]}띠`;
}

/* ---------- 생일 주간 배너 ---------- */
function renderBanner() {
  const el = $("#bdayBanner");
  const b = state.birth;
  const today = todayKey();
  const [y] = parts(today);
  const thisYear = birthdayIn(b, y);
  const g = diffDays(today, thisYear);
  const prevYear = birthdayIn(b, y - 1);
  const nextYear = birthdayIn(b, y + 1);
  const near = [thisYear, prevYear, nextYear].map((d) => diffDays(today, d)).find((d) => d >= -3 && d <= 6);
  if (near == null) {
    el.hidden = true;
    return;
  }
  const age = manAge(b, today);
  el.hidden = false;
  el.innerHTML =
    near === 0
      ? `<span class="bday-banner__no t-num">${age}</span><div><p class="t-body-02-strong">생일 축하해요. 오늘부터 만 ${age}세예요</p><p class="t-caption-01">그리드에 새 줄이 시작됐어요. 첫 칸을 멋지게 채워봐요.</p></div>`
      : near > 0
        ? `<span class="bday-banner__no t-num">D-${near}</span><div><p class="t-body-02-strong">생일 주간이에요</p><p class="t-caption-01">곧 만 ${age + 1}세가 돼요. 지금 줄의 마지막 칸이에요.</p></div>`
        : `<span class="bday-banner__no t-num">+${-near}</span><div><p class="t-body-02-strong">생일 주간이에요 · 만 ${age}세</p><p class="t-caption-01">새 줄의 첫 칸을 채우는 중이에요.</p></div>`;
  void g;
}

/* ---------- 인생 진행률 + 그리드 ---------- */
const UNITS = {
  week: { perYear: 52, cols: 52, name: "주" },
  month: { perYear: 12, cols: 24, name: "개월" },
  year: { perYear: 1, cols: 10, name: "년" },
};
const grid = {
  canvas: $("#lifeGrid"),
  layer: null,
  geo: null,
  sweep: 1,
  sweepStart: 0,
  raf: 0,
  visible: true,
};
function gridData() {
  const m = lifeModel(state.birth, state.life);
  const u = UNITS[state.unit];
  const total = Math.max(1, Math.round(state.life * u.perYear));
  let current;
  if (state.unit === "week") current = m.age * 52 + m.weekInYear;
  else if (state.unit === "month") current = m.age * 12 + m.monthInYear;
  else current = m.age;
  current = Math.min(total - 1, current);
  const goals = state.bucket
    .filter((b) => b.age !== "" && b.age != null && Number.isFinite(Number(b.age)))
    .map((b) => ({ ...b, idx: Math.min(total - 1, Math.round(Number(b.age) * u.perYear)) }));
  return { m, u, total, current, goals };
}
function layoutGrid() {
  const c = grid.canvas;
  const W = c.parentElement.clientWidth;
  const { u, total } = gridData();
  const labelW = 26;
  const pitch = (W - labelW) / u.cols;
  const rows = Math.ceil(total / u.cols);
  const H = Math.ceil(rows * pitch + 4);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = Math.round(W * dpr);
  c.height = Math.round(H * dpr);
  c.style.height = `${H}px`;
  grid.geo = { W, H, labelW, pitch, rows, dpr };
}
function cellXY(i) {
  const { labelW, pitch } = grid.geo;
  const { cols } = UNITS[state.unit];
  return [labelW + (i % cols) * pitch + pitch / 2, Math.floor(i / cols) * pitch + pitch / 2 + 2];
}
function drawGridFrame(now) {
  const c = grid.canvas;
  if (!grid.geo || !state.birth) return;
  const ctx = c.getContext("2d");
  const { W, H, pitch, dpr } = grid.geo;
  const { u, total, current, goals } = gridData();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const brand = token("--brand");
  const white = token("--art-white");
  const left = token("--art-dot-left");
  const ter = token("--color-text-tertiary");
  const r = Math.max(1.2, pitch * (state.unit === "week" ? 0.34 : 0.36));
  const t = grid.sweep;
  const filled = Math.floor(current * t);

  // 나이 라벨 (10년마다)
  ctx.fillStyle = ter;
  ctx.font = `600 10px ${token("--art-num") || CANVAS_FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (let row = 0; row * u.cols < total; row++) {
    const yearsAtRow = (row * u.cols) / u.perYear;
    if (yearsAtRow % 10 === 0 && Number.isInteger(yearsAtRow)) {
      ctx.fillText(String(yearsAtRow), 0, cellXY(row * u.cols)[1]);
    }
  }
  const dots = (from, to, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = from; i < to; i++) {
      const [x, y] = cellXY(i);
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.fill();
  };
  dots(filled, total, left);
  dots(0, filled, white);
  // 스윕 앞머리 빛
  if (t < 1 && filled > 0) {
    const [x, y] = cellXY(filled);
    ctx.fillStyle = alpha(brand, 0.6);
    ctx.beginPath();
    ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // 버킷리스트 깃발
  goals.forEach((g) => {
    const [x, y] = cellXY(g.idx);
    ctx.strokeStyle = brand;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r + 2.5, 0, Math.PI * 2);
    ctx.stroke();
    if (g.done) {
      ctx.fillStyle = brand;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  // 지금 칸 (맥박)
  if (t >= 1) {
    const [x, y] = cellXY(current);
    const p = prefersReducedMotion() ? 0.5 : (Math.sin(now / 320) + 1) / 2;
    ctx.fillStyle = alpha(brand, 0.2 + 0.25 * p);
    ctx.beginPath();
    ctx.arc(x, y, Math.min(r * (2.2 + 1.6 * p), r + 4 + 6 * p), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = brand;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.15, 0, Math.PI * 2);
    ctx.fill();
  }
}
function gridLoop(now) {
  cancelAnimationFrame(grid.raf);
  if (!state.birth || $("[data-view=app]").hidden) return;
  if (grid.sweep < 1) {
    grid.sweep = Math.min(1, (now - grid.sweepStart) / 1400);
    grid.sweep = 1 - Math.pow(1 - grid.sweep, 3) === 1 ? 1 : grid.sweep;
  }
  const eased = grid.sweep >= 1 ? 1 : 1 - Math.pow(1 - grid.sweep, 3);
  const keep = grid.sweep;
  grid.sweep = eased;
  drawGridFrame(now);
  grid.sweep = keep;
  if (grid.visible && !prefersReducedMotion()) grid.raf = requestAnimationFrame(gridLoop);
  else if (grid.sweep < 1) grid.raf = requestAnimationFrame(gridLoop);
}
function startSweep() {
  grid.sweep = prefersReducedMotion() ? 1 : 0;
  grid.sweepStart = performance.now();
  layoutGrid();
  grid.raf = requestAnimationFrame(gridLoop);
}
if ("IntersectionObserver" in window) {
  new IntersectionObserver((ents) => {
    grid.visible = ents[0].isIntersecting;
    if (grid.visible) grid.raf = requestAnimationFrame(gridLoop);
  }).observe(grid.canvas);
}
grid.canvas.addEventListener("click", (ev) => {
  if (!grid.geo) return;
  const rect = grid.canvas.getBoundingClientRect();
  const x = ev.clientX - rect.left - grid.geo.labelW;
  const y = ev.clientY - rect.top - 2;
  const { u, total, current } = gridData();
  const col = Math.floor(x / grid.geo.pitch);
  const row = Math.floor(y / grid.geo.pitch);
  if (col < 0 || col >= u.cols || row < 0) return;
  const i = row * u.cols + col;
  if (i >= total) return;
  const age = Math.floor(i / u.perYear);
  const within = (i % u.perYear) + 1;
  const date = addDays(birthdayIn(state.birth, parts(state.birth)[0] + age), state.unit === "week" ? (within - 1) * 7 : state.unit === "month" ? Math.round((within - 1) * 30.44) : 0);
  const label = state.unit === "year" ? `만 ${age}세` : `만 ${age}세 · ${within}번째 ${state.unit === "week" ? "주" : "달"}`;
  const tag = i < current ? "지나온 칸" : i === current ? "바로 지금" : "아직 오지 않은 칸";
  toast(`${label} (${dotDate(date)}경) · ${tag}`);
});
let resizeT;
window.addEventListener("resize", () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => {
    if (!state.birth) return;
    layoutGrid();
    drawGridFrame(performance.now());
  }, 120);
});

function renderProgress(animate) {
  const m = lifeModel(state.birth, state.life);
  const pctText = (n) => n.toFixed(1);
  odometer($("#pct"), pctText(m.pct));
  $("#pbar").style.width = `${m.pct}%`;
  const dayShare = 100 / m.totalDays;
  $("#todayShare").textContent = `오늘 하루는 인생의 약 ${dayShare.toFixed(4)}%예요. 기대수명 ${state.life}세 가정.`;
  $("#lifeExp").value = state.life;
  $("#lifeNote").textContent =
    state.life === DEFAULT_LIFE
      ? "평균 기대수명 약 83.5세(통계청 2023년 생명표)로 그렸어요. 숫자를 바꿔도 돼요."
      : `기대수명 ${state.life}세로 그렸어요. 평균은 약 83.5세(통계청 2023년 생명표)예요.`;
  const u = UNITS[state.unit];
  const total = Math.round(state.life * u.perYear);
  $("#gridHint").textContent = `한 줄 = ${state.unit === "year" ? "10년" : state.unit === "month" ? "2년" : "1년"}, 한 칸 = ${state.unit === "week" ? "일주일" : state.unit === "month" ? "한 달" : "1년"} · 모두 ${fmt.num(total)}칸 · 칸을 누르면 언제인지 알려줘요`;
  $$(".seg__btn").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.unit === state.unit)));
  const f = state.friend;
  const cmp = $("#friendCmp");
  if (f != null) {
    cmp.hidden = false;
    cmp.textContent = `친구 ${f.toFixed(1)}% · 나 ${m.pct.toFixed(1)}%`;
  }
}
$$(".seg__btn").forEach((b) => {
  b.onclick = () => {
    state.unit = b.dataset.unit;
    store.set("unit", state.unit);
    renderProgress(false);
    startSweep();
  };
});
function setLife(v) {
  const n = Math.round(Math.min(120, Math.max(40, Number(v) || DEFAULT_LIFE)) * 2) / 2;
  if (n === state.life) {
    $("#lifeExp").value = n;
    return;
  }
  state.life = n;
  store.set("life", n);
  renderAll({ animate: false, sweep: true });
}
$("#lifeMinus").onclick = () => setLife(state.life - 0.5);
$("#lifePlus").onclick = () => setLife(state.life + 0.5);
$("#lifeExp").addEventListener("change", (e) => setLife(e.target.value));

/* ---------- 감성 통계 ---------- */
function renderStats(animate) {
  const s = emotionalStats(state.birth, state.life);
  const items = [
    { k: "남은 크리스마스", v: s.christmas, unit: "번", sub: "기대수명까지, 가정치", accent: true },
    { k: "남은 주말", v: s.weekends, unit: "번", sub: "남은 토요일 수" },
    { k: "남은 봄", v: s.springs, unit: "번", sub: "3~5월, 가정치" },
    { k: "살아온 날", v: s.lived, unit: "일째", sub: "태어난 날 = 1일째" },
    { k: "심장이 뛴 횟수", v: s.beats / 1e8, unit: "억 번", sub: "대략, 분당 70회 가정", digits: 1, approx: true },
    { k: "지구가 태양을 돈 횟수", v: s.orbits, unit: "바퀴", sub: "살아온 날 ÷ 365.26일", digits: 1, approx: true },
    { k: "잠든 시간", v: s.sleepYears, unit: "년", sub: "하루 8시간 가정", digits: 1, approx: true },
    { k: "기대수명까지", v: Math.max(0, diffDays(s.today, s.end)), unit: "일", sub: "평균일 뿐, 예측이 아니에요", approx: true },
  ];
  const letters = "abcdefgh";
  $("#statGrid").innerHTML = items
    .map(
      (it, i) => `<div class="fig ${it.accent ? "fig--accent" : ""}">
        <span class="fig__no">03.${letters[i]}</span>
        <strong class="fig__v t-num">${it.approx ? "<em>약</em>" : ""}<span class="fig__n" data-v="${fmt.num(it.digits ? it.v : Math.round(it.v), it.digits || 0)}"></span><small>${it.unit}</small></strong>
        <span class="fig__k">${it.k}</span>
        <span class="fig__s">${it.sub}</span>
      </div>`,
    )
    .join("");
  $$("#statGrid .fig__n").forEach((n) => odometer(n, n.dataset.v));
  void animate;
  renderParents();
}
function renderParents() {
  const { age, per } = state.parent;
  $("#parentAge").value = age;
  $("#meetPerYear").value = per;
  const a = Number(age);
  const p = Number(per);
  const out = $("#parentOut");
  if (!age || !per || !(a > 0) || !(p > 0)) {
    out.textContent = "두 칸을 채우면 조용히 계산해 드려요.";
    return;
  }
  const remain = Math.max(0, state.life - a);
  const n = Math.round(remain * p);
  out.innerHTML =
    remain <= 0
      ? `평균 기대수명을 이미 넘기셨어요. 평균은 평균일 뿐, 함께하는 하루하루가 선물이에요. 오늘 안부 전화 한 통 어때요?`
      : `지금처럼 1년에 ${p}번 만나면, 앞으로 <strong class="t-primary">약 ${fmt.num(n)}번</strong> 더 만날 수 있어요.<br /><span class="t-caption-01 t-tertiary">평균 기대수명(${state.life}세)으로 낸 아주 거친 숫자예요. 한 번 더 찾아가면 그만큼 늘어나요.</span>`;
}
["#parentAge", "#meetPerYear"].forEach((sel) =>
  $(sel).addEventListener("input", () => {
    $(sel).value = $(sel).value.replace(/\D/g, "").slice(0, 3);
    state.parent = { age: $("#parentAge").value, per: $("#meetPerYear").value };
    store.set("parent", state.parent);
    renderParents();
  }),
);

/* ---------- 이정표 ---------- */
function renderMiles() {
  const today = todayKey();
  const list = milestones(state.birth, state.life);
  const firstUp = list.findIndex((x) => x.date >= today);
  const past = firstUp < 0 ? list.length : firstUp;
  $("#mileList").innerHTML = list
    .map((x, i) => {
      const isPast = x.date < today;
      if (isPast && !state.showPastMiles) return "";
      const g = diffDays(today, x.date);
      return `<li class="mile ${isPast ? "is-past" : ""} ${i === firstUp ? "is-next" : ""}">
        <div class="mile__main">
          <span class="mile__t">${x.title}${x.hot && !isPast ? `<span class="mile__hot">KEY</span>` : ""}</span>
          <span class="mile__s">${longDate(x.date)} · ${x.sub}</span>
        </div>
        <span class="mile__d t-num">${isPast ? "지났어요" : g === 0 ? "오늘!" : `D-${fmt.num(g)}`}</span>
      </li>`;
    })
    .join("");
  const btn = $("#togglePastMiles");
  btn.hidden = past === 0;
  btn.textContent = state.showPastMiles ? "지난 이정표 숨기기" : `지난 이정표 ${past}개 보기`;
}
$("#togglePastMiles").onclick = () => {
  state.showPastMiles = !state.showPastMiles;
  renderMiles();
};

/* ---------- 버킷리스트 ---------- */
const IDEAS = ["오로라 보기", "부모님과 여행", "책 100권 읽기", "마라톤 완주", "혼자 해외여행", "악기 하나 배우기"];
function saveBucket() {
  store.set("bucket", state.bucket);
}
function renderBucket() {
  const age = manAge(state.birth, todayKey());
  $("#bucketAge").placeholder = `${age + 1}세`;
  const done = state.bucket.filter((b) => b.done).length;
  $("#bucketCount").textContent = state.bucket.length ? `${done}/${state.bucket.length} 완료` : "";
  const has = new Set(state.bucket.map((b) => b.t));
  $("#bucketIdeas").innerHTML = IDEAS.filter((t) => !has.has(t))
    .slice(0, 4)
    .map((t) => `<button class="chip" type="button" data-idea="${esc(t)}">+ ${esc(t)}</button>`)
    .join("");
  $$("#bucketIdeas .chip").forEach((c) => (c.onclick = () => addBucket(c.dataset.idea, "")));
  $("#bucketList").innerHTML = state.bucket.length
    ? state.bucket
        .map(
          (b) => `<li class="bk ${b.done ? "is-done" : ""}">
        <button class="bk__check" data-id="${b.id}" aria-pressed="${!!b.done}" aria-label="${b.done ? "완료 취소" : "완료"}">${b.done ? "✓" : ""}</button>
        <span class="bk__t">${esc(b.t)}</span>
        <span class="bk__age t-num">${b.age !== "" && b.age != null ? `만 ${b.age}세` : "언젠가"}</span>
        <button class="btn btn--ghost btn--icon btn--sm bk__del" data-del="${b.id}" aria-label="지우기">×</button>
      </li>`,
        )
        .join("")
    : `<li class="bk-empty t-caption-01 t-tertiary">아직 비어 있어요. 위에서 하나 골라 꽂아볼까요?</li>`;
  $$("#bucketList .bk__check").forEach(
    (b) =>
      (b.onclick = () => {
        const it = state.bucket.find((x) => x.id === b.dataset.id);
        it.done = !it.done;
        if (it.done) {
          haptic([10, 30, 10]);
          toast("한 칸을 제대로 채웠어요");
        }
        saveBucket();
        renderBucket();
      }),
  );
  $$("#bucketList .bk__del").forEach(
    (b) =>
      (b.onclick = () => {
        state.bucket = state.bucket.filter((x) => x.id !== b.dataset.del);
        saveBucket();
        renderBucket();
      }),
  );
  if (grid.geo) drawGridFrame(performance.now());
}
function addBucket(text, ageRaw) {
  const t = String(text).trim().slice(0, 40);
  if (!t) return;
  const nowAge = manAge(state.birth, todayKey());
  let age = ageRaw === "" ? nowAge + 1 : Number(ageRaw);
  if (!Number.isFinite(age)) age = nowAge + 1;
  age = Math.max(nowAge, Math.min(Math.floor(state.life), Math.round(age)));
  state.bucket.push({ id: Math.random().toString(36).slice(2, 9), t, age, done: false });
  saveBucket();
  renderBucket();
  haptic(10);
}
$("#bucketForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const t = $("#bucketText").value;
  if (!t.trim()) {
    $("#bucketText").classList.add("is-error");
    return;
  }
  addBucket(t, $("#bucketAge").value.replace(/\D/g, ""));
  $("#bucketText").value = "";
  $("#bucketAge").value = "";
});
$("#bucketText").addEventListener("input", (e) => e.target.classList.remove("is-error"));

/* ---------- 공유 ---------- */
function emotionalLine(s) {
  const lines = [
    `남은 크리스마스 ${fmt.num(s.christmas)}번, 하나도 허투루 보내지 않기`,
    `남은 봄 ${fmt.num(s.springs)}번, 올해 벚꽃은 꼭 보러 가기`,
    `남은 주말 ${fmt.num(s.weekends)}번, 이번 주말부터 잘 쓰기`,
    `오늘은 내 인생의 ${fmt.num(s.lived)}번째 날`,
  ];
  return lines[s.lived % lines.length];
}
function drawStory() {
  const W = 540;
  const H = 960;
  const { canvas, ctx } = createCanvas(W, H, 2);
  const brand = token("--brand");
  const black = token("--art-black");
  const white = token("--art-white");
  const left = token("--art-dot-left");
  const sub = token("--color-text-secondary");
  const num = token("--art-num") || CANVAS_FONT;
  const disp = token("--font-display") || CANVAS_FONT;
  const s = emotionalStats(state.birth, state.life);
  ctx.fillStyle = black;
  ctx.fillRect(0, 0, W, H);

  // 머리글 + 헤어라인
  ctx.fillStyle = white;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.font = `900 20px ${disp}`;
  ctx.fillText("인생 진행률", 24, 50);
  ctx.textAlign = "right";
  ctx.fillStyle = sub;
  ctx.font = `600 11px ${num}`;
  ctx.fillText(`FIG. 01 — ${dotDate(s.today)}`, W - 24, 50);
  ctx.fillStyle = white;
  ctx.fillRect(24, 64, W - 48, 1.5);

  // 거대한 퍼센트 (오른쪽이 살짝 잘리도록)
  const pctText = s.pct.toFixed(1);
  ctx.textAlign = "left";
  ctx.fillStyle = white;
  ctx.font = `900 196px ${num}`;
  ctx.fillText(pctText, 14, 246);
  const pw = ctx.measureText(pctText).width;
  ctx.fillStyle = brand;
  ctx.font = `900 48px ${num}`;
  ctx.fillText("%", Math.min(14 + pw + 6, W - 44), 120);

  ctx.fillStyle = white;
  ctx.fillRect(24, 272, W - 48, 1);
  ctx.fillStyle = sub;
  ctx.font = `600 11px ${num}`;
  ctx.fillText("LIFE IN WEEKS — 한 칸 = 일주일, 한 줄 = 1년", 24, 292);

  // 점 그리드
  const cols = 52;
  const total = Math.round(state.life * 52);
  const rows = Math.ceil(total / cols);
  const pitch = Math.min(6.6, 540 / rows);
  const gx = 44;
  const gy = 312;
  const current = Math.min(total - 1, s.age * 52 + s.weekInYear);
  const r = pitch * 0.34;
  const xy = (i) => [gx + (i % cols) * pitch + pitch / 2, gy + Math.floor(i / cols) * pitch + pitch / 2];
  const dots = (from, to, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = from; i < to; i++) {
      const [x, y] = xy(i);
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.fill();
  };
  dots(current + 1, total, left);
  dots(0, current, white);
  ctx.fillStyle = sub;
  ctx.font = `600 9px ${num}`;
  ctx.textAlign = "right";
  for (let a = 0; a * 52 < total; a += 10) ctx.fillText(String(a), gx - 6, xy(a * 52)[1] + 3);
  const [cx, cy] = xy(current);
  ctx.fillStyle = brand;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.6, 0, Math.PI * 2);
  ctx.fill();
  // 주석선: 지금 여기
  const lx = gx + cols * pitch + 14;
  ctx.strokeStyle = brand;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx + r * 2, cy);
  ctx.lineTo(lx, cy);
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.fillStyle = brand;
  ctx.font = `800 13px ${disp}`;
  ctx.fillText("지금 여기", lx + 4, cy + 4);
  ctx.fillStyle = sub;
  ctx.font = `600 11px ${num}`;
  ctx.fillText(`만 ${s.age}세`, lx + 4, cy + 20);

  // 감성 한 줄 + 각주
  const by = gy + rows * pitch + 46;
  ctx.fillStyle = white;
  ctx.fillRect(24, by - 26, W - 48, 1);
  ctx.font = `800 21px ${disp}`;
  ctx.fillText(emotionalLine(s), 24, by + 4);
  ctx.fillStyle = sub;
  ctx.font = `500 12px ${CANVAS_FONT}`;
  ctx.fillText(`기대수명 ${state.life}세 가정 · 근사치 · 너의 인생 진행률은 몇 %야?`, 24, by + 32);
  return canvas;
}
$("#saveStory").onclick = async () => {
  if (!state.birth) return;
  const btn = $("#saveStory");
  btn.classList.add("is-loading");
  try {
    const s = lifeModel(state.birth, state.life);
    await shareImage(drawStory(), { filename: `인생진행률-${s.pct.toFixed(1)}.png`, text: `내 인생 진행률 ${s.pct.toFixed(1)}%` });
  } finally {
    btn.classList.remove("is-loading");
  }
};
$("#shareLink").onclick = () => {
  if (!state.birth) return;
  const m = lifeModel(state.birth, state.life);
  share({
    title: "인생 진행률",
    text: `내 인생 진행률은 ${m.pct.toFixed(1)}%래요. 너는 몇 %야? ⏳`,
    url: urlWith({ from: encodeState({ p: Math.round(m.pct * 10) / 10 }) }),
  });
};

/* ---------- 전체 렌더 ---------- */
function renderAll({ animate = false, sweep = true } = {}) {
  if (!state.birth) {
    ["#lifeSection", "#statsSection", "#milesSection", "#bucketSection", "#shareSection"].forEach((s) => ($(s).hidden = true));
    $("#birthSum").hidden = true;
    $("#bdayBanner").hidden = true;
    return;
  }
  if (!birthInput.value || parseBirth(birthInput.value) !== state.birth) birthInput.value = dotDate(state.birth);
  ["#lifeSection", "#statsSection", "#milesSection", "#bucketSection", "#shareSection"].forEach((s) => ($(s).hidden = false));
  renderBirthSummary();
  renderBanner();
  renderProgress(animate);
  renderStats(animate);
  renderMiles();
  renderBucket();
  if (sweep) startSweep();
}

/* ---------- 인트로 모션그래픽 (캔버스 그리드 + 타이포 오버레이) ---------- */
const EX = { pct: 37.4, life: 83.5 };
EX.age = (EX.pct / 100) * EX.life; // 약 31.2세
EX.christmas = Math.floor(EX.life - EX.age);
EX.weekends = Math.round(((EX.life - EX.age) * YEAR_DAYS) / 7 / 100) * 100;
EX.springs = Math.floor(EX.life - EX.age);
const ip = { scene: 0, t0: 0, raf: 0, running: false, geo: null };
// 첫 화면 도표: 세로 한 줄 = 1년(52주), 가로 84줄 = 83.5년. 무대 폭을 꽉 채우고, 아래에 거대한 숫자.
function ipLayout() {
  const stage = $("#intro .intro__stage");
  const cv = $(".ip-canvas");
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  cv.style.width = `${w}px`;
  cv.style.height = `${h}px`;
  const rows = 52;
  const cols = Math.ceil(EX.life);
  const total = Math.round(EX.life * 52);
  const pitch = w / cols;
  const gy = 26;
  // 가로 간격은 폭에 맞추고, 세로 간격은 남는 높이만큼 늘려 무대를 꽉 채운다 (아래 숫자 자리 210px 확보)
  const pitchY = Math.max(pitch, Math.min(pitch * 1.6, (h - gy - 30 - 210) / rows));
  const gridH = rows * pitchY;
  const top = Math.round(gy + gridH + 30);
  stage.style.setProperty("--ip-top", `${top}px`);
  stage.style.setProperty("--ip-room", `${Math.max(120, h - top)}px`);
  ip.geo = { w, h, dpr, cols, rows, total, pitch, pitchY, gx: 0, gy, gridH, ctx: cv.getContext("2d"), current: Math.round((EX.pct / 100) * total) };
}
const ipXY = (i) => {
  const g = ip.geo;
  return [g.gx + Math.floor(i / g.rows) * g.pitch + g.pitch / 2, g.gy + (i % g.rows) * g.pitchY + g.pitchY / 2];
};
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 3);
// 감쇠 진동 스프링 (0 → 1, 오버슈트 후 정착)
const spring = (t) => (t <= 0 ? 0 : 1 - Math.exp(-6 * t) * Math.cos(13 * t));
function ipFrame(now) {
  const g = ip.geo;
  if (!g) return;
  const { ctx, w, h, dpr, total, rows, cols, pitch, gy, gridH, current } = g;
  const t = prefersReducedMotion() ? 99999 : now - ip.t0;
  const brand = token("--brand");
  const white = token("--art-white");
  const idle = token("--art-dot-idle");
  const mid = token("--art-dot-mid");
  const NUM = token("--art-num") || CANVAS_FONT;
  const DISP = token("--font-display") || CANVAS_FONT;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const r = pitch * 0.36;
  // 칸 묶음 그리기 (filter 로 고른 칸만)
  const batch = (from, to, color, a = 1, rad = r, filter = null) => {
    if (to <= from) return;
    ctx.globalAlpha = a;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = from; i < to; i++) {
      if (filter && !filter(i)) continue;
      const [x, y] = ipXY(i);
      ctx.moveTo(x + rad, y);
      ctx.arc(x, y, rad, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.globalAlpha = 1;
  };
  const dot = (x, y, rad, color, a = 1) => {
    ctx.globalAlpha = a;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0, rad), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  };
  // 아래 나이 눈금 (0 · 10 · 20 … 80세)
  const ticks = (a = 1) => {
    ctx.globalAlpha = a;
    ctx.fillStyle = token("--color-text-secondary");
    ctx.font = `700 10px ${NUM}`;
    ctx.textAlign = "left";
    for (let yr = 0; yr < cols; yr += 10) {
      const x = g.gx + yr * pitch;
      ctx.fillRect(x, gy + gridH + 4, 1, 5);
      ctx.fillText(yr === 0 ? "0세" : `${yr}`, x + 3, gy + gridH + 14);
    }
    ctx.globalAlpha = 1;
  };
  // 지금 칸에서 위로 올라가는 주석 선 + 라벨
  const annotate = (a = 1) => {
    if (a <= 0) return;
    const [x, y] = ipXY(current);
    ctx.globalAlpha = a;
    ctx.strokeStyle = brand;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y - r * 2.6);
    ctx.lineTo(x, 6 + (1 - a) * 10);
    ctx.stroke();
    ctx.fillStyle = brand;
    ctx.font = `800 12px ${DISP}`;
    ctx.textAlign = "left";
    ctx.fillText("지금", x + 5, 15);
    const lw = ctx.measureText("지금 ").width;
    ctx.fillStyle = white;
    ctx.font = `700 11px ${NUM}`;
    ctx.fillText("만 31세 · 1,624번째 주", x + 5 + lw, 15);
    ctx.globalAlpha = 1;
  };
  const pulseNow = (k = 1, big = 1) => {
    const [x, y] = ipXY(current);
    const p = (Math.sin(now / 260) + 1) / 2;
    dot(x, y, r * (2.6 + 2.4 * p) * big, brand, (0.22 + 0.25 * p) * k);
    dot(x, y, r * 1.7 * big, brand, k);
  };

  if (ip.scene === 0) {
    // 처음부터 4,342칸이 다 보인다. 왼쪽부터 한 해씩 튀어 오르며 또렷해지고, 파도 앞머리는 흰색
    const stag = 9;
    for (let c = 0; c < cols; c++) {
      const lt = t - 40 - c * stag;
      const k = spring(lt / 420);
      const rad = r * (0.45 + 0.55 * Math.max(0, k));
      const from = c * rows;
      const to = Math.min(total, from + rows);
      const front = lt > 0 && lt < 200;
      batch(from, to, front ? white : idle, 1, rad);
    }
    // 다 깔리면 10년마다 세로 한 줄이 하얗게 켜져 "세로 한 줄 = 1년" 구조가 보인다
    for (let c = 0; c < cols; c += 10) {
      const k = easeOut((t - 950 - c * 12) / 360);
      if (k > 0) batch(c * rows, Math.min(total, c * rows + rows), white, k);
    }
    ticks(easeOut((t - 300) / 500));
    // 첫 칸(태어난 주)은 처음부터 포인트 색
    const [x0, y0] = ipXY(0);
    dot(x0, y0, r * (1 + 0.8 * spring(t / 500)), brand);
  } else if (ip.scene === 1) {
    // 지나온 칸이 한 해씩 하얗게 차오르고, 지금 칸에 주석이 붙는다
    const fill = easeOut((t - 80) / 900);
    const k = Math.floor(current * fill);
    batch(k, total, idle);
    batch(0, k, white);
    ticks();
    if (fill < 1) {
      const [hx, hy] = ipXY(k);
      dot(hx, hy, r * 2.2, brand);
    } else {
      pulseNow();
    }
    annotate(easeOut((t - 900) / 300));
  } else if (ip.scene === 2) {
    // 남은 칸에서 세어 본다: 주말(남은 칸 전부) → 봄(3~5월 띠) → 크리스마스(마지막 주 한 줄)
    const isSpring = (i) => i % rows >= 9 && i % rows <= 21;
    const isXmas = (i) => i % rows === 51;
    batch(0, current, white, 0.4);
    batch(current, total, idle);
    const wk = clamp01((t - 380) / 380);
    if (wk > 0) {
      const edge = current + Math.floor((total - current) * easeOut(wk));
      batch(current, edge, mid);
    }
    const sp = clamp01((t - 540) / 420);
    if (sp > 0) batch(current, total, brand, 0.55 * easeOut(sp), r, isSpring);
    const xm = t - 220;
    if (xm > 0) {
      for (let c = Math.floor(current / rows); c < cols; c++) {
        const i = c * rows + 51;
        if (i >= total || i < current) continue;
        const k = spring((xm - (c - Math.floor(current / rows)) * 14) / 380);
        if (k <= 0) continue;
        const [x, y] = ipXY(i);
        dot(x, y, r * (1 + 0.7 * k), brand);
      }
    }
    ticks();
    pulseNow(0.9);
    annotate(1);
  } else {
    // 다 흐려지고 이번 주 한 칸만 커진다. 버킷리스트가 남은 칸 위에 꽂힌다
    const focus = easeOut(t / 500);
    batch(current, total, idle, 1 - 0.15 * focus);
    batch(0, current, white, 1 - 0.45 * focus);
    ticks();
    const [x, y] = ipXY(current);
    ctx.strokeStyle = brand;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 1 - 0.7 * clamp01(t / 900);
    ctx.beginPath();
    ctx.arc(x, y, r * (2 + 16 * spring(t / 900)), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    pulseNow(1, 1 + 0.5 * spring(t / 600));
    const goals = [
      [0.5, 20, "오로라 보기"],
      [0.64, 36, "마라톤 완주"],
      [0.8, 8, "부모님과 여행"],
    ];
    goals.forEach(([f, row, label], gi) => {
      const a = spring((t - 450 - gi * 180) / 520);
      if (a <= 0) return;
      const idx = Math.floor(total * f / rows) * rows + row;
      const [fx, fy] = ipXY(idx);
      ctx.save();
      ctx.translate(fx, fy);
      ctx.scale(a, a);
      dot(0, 0, r * 1.2, brand);
      ctx.strokeStyle = brand;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = clamp01(a);
      ctx.font = `800 11px ${DISP}`;
      const tw = ctx.measureText(label).width;
      const right = fx + 22 + tw < w;
      const lx = right ? fx + 8 : fx - 8;
      ctx.fillStyle = token("--art-black");
      ctx.fillRect(right ? lx + 6 : lx - tw - 14, fy - 9, tw + 8, 17);
      ctx.strokeStyle = brand;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(fx + (right ? r + 3 : -r - 3), fy);
      ctx.lineTo(right ? lx + 6 : lx - 6, fy);
      ctx.stroke();
      ctx.fillStyle = white;
      ctx.textAlign = right ? "left" : "right";
      ctx.fillText(label, right ? lx + 10 : lx - 10, fy + 4);
      ctx.globalAlpha = 1;
    });
  }
}
function ipLoop(now) {
  if (!ip.running) return;
  ipFrame(now);
  if (!prefersReducedMotion()) ip.raf = requestAnimationFrame(ipLoop);
}
function kinetic() {
  const h = $("#intro .intro__caption h2");
  if (!h || prefersReducedMotion()) return;
  let k = 0;
  h.innerHTML = h.textContent
    .split(" ")
    .map((w) => `<span class="kin">${[...w].map((ch) => `<i style="--k:${k++}">${esc(ch)}</i>`).join("")}</span>`)
    .join(" ");
}
function ipScene(n, html = "", after) {
  return (stage, signal) => {
    ip.scene = n;
    ip.t0 = performance.now();
    kinetic();
    $("#introFig").textContent = `FIG. 0${n + 1} / 04`;
    const ov = $(".ip-overlay", stage);
    ov.innerHTML = html;
    if (prefersReducedMotion()) ipFrame(performance.now());
    const timers = [];
    const later = (ms, fn) => timers.push(setTimeout(() => !signal.aborted && fn(), prefersReducedMotion() ? 0 : ms));
    signal.addEventListener("abort", () => timers.forEach(clearTimeout));
    after?.(ov, later);
  };
}
const EX_NOW = Math.round((EX.pct / 100) * Math.round(EX.life * 52));
const EX_LEFT = Math.round(EX.life * 52) - EX_NOW;
const SCENES = [
  {
    title: "인생을 4,342칸으로",
    desc: "한 칸은 일주일, 세로 한 줄은 1년이에요",
    duration: 3000,
    play: ipScene(
      0,
      `<div class="ip-count"><span class="odo" data-v="4,342"></span><span class="ip-label"><b>칸</b> = 기대수명 83.5년 × 52주</span></div>`,
      (ov, later) => {
        const el = $(".odo", ov);
        later(120, () => odometer(el, el.dataset.v));
      },
    ),
  },
  {
    title: "지금 여기까지 왔어요",
    desc: "예시 · 만 31세, 기대수명 83.5세 기준",
    duration: 3000,
    play: ipScene(
      1,
      `<div class="ip-pct"><span class="odo"></span><sup>%</sup></div><p class="ip-split"><span><b>${fmt.num(EX_NOW)}</b>칸 지나옴</span><span><b>${fmt.num(EX_LEFT)}</b>칸 남음</span></p>`,
      (ov, later) => later(80, () => odometer($(".odo", ov), EX.pct.toFixed(1))),
    ),
  },
  {
    title: "숫자로 보면 달라져요",
    desc: "남은 칸에서 주말, 봄, 크리스마스를 세어봐요",
    duration: 3200,
    play: ipScene(
      2,
      `<ol class="ip-rows">
        <li style="--i:0"><span><i class="ip-key ip-key--mid"></i>남은 주말</span><span><small>약</small><b class="odo" data-v="${fmt.num(EX.weekends)}"></b><small>번</small></span></li>
        <li style="--i:1"><span><i class="ip-key ip-key--band"></i>남은 봄</span><span><b class="odo" data-v="${EX.springs}"></b><small>번</small></span></li>
        <li style="--i:2"><span><i class="ip-key"></i>남은 크리스마스</span><span><b class="odo" data-v="${EX.christmas}"></b><small>번</small></span></li>
      </ol>`,
      (ov, later) => $$(".odo", ov).forEach((el, i) => later(200 + i * 140, () => odometer(el, el.dataset.v))),
    ),
  },
  {
    title: "이번 주도 딱 한 칸",
    desc: "버킷리스트를 칸 위에 꽂고 하나씩 채워요",
    duration: 3200,
    play: ipScene(3, `<span class="ip-tag">이번 주</span><div class="ip-count ip-count--one"><span class="odo" data-v="1"></span><span class="ip-label"><b>/ 4,342칸</b>이번 주는<br />한 번뿐이에요</span></div>`, (ov, later) => {
      const el = $(".ip-count .odo", ov);
      later(120, () => odometer(el, el.dataset.v));
      const [x, y] = ipXY(ip.geo.current);
      const tag = $(".ip-tag", ov);
      tag.style.left = `${Math.min(x + 14, ip.geo.w - 64)}px`;
      tag.style.top = `${y + 10}px`;
    }),
  },
];
// 하단: 연차보고서 끝의 SEE ALSO 색인 (그림 번호를 이어서 매긴다)
function renderSeeAlso(el) {
  renderMoreSites(el);
  if (!el) return;
  const title = el.querySelector(".more-sites__title");
  if (title) title.innerHTML = `<span class="sa__k">SEE ALSO</span>함께 보면 좋은 도표`;
  el.querySelectorAll(".more-sites__item").forEach((a, i) => {
    a.insertAdjacentHTML("afterbegin", `<span class="sa__fig" aria-hidden="true"><small>FIG.</small>${String(i + 5).padStart(2, "0")}</span>`);
  });
}
let intro;
function startIntro() {
  showView("intro");
  ipLayout();
  ip.running = true;
  cancelAnimationFrame(ip.raf);
  ip.raf = requestAnimationFrame(ipLoop);
  intro?.stop();
  intro = runIntro({ root: $("#intro"), scenes: SCENES, loop: true });
}
function stopIntro() {
  intro?.stop();
  intro = null;
  ip.running = false;
  cancelAnimationFrame(ip.raf);
}
function openApp() {
  stopIntro();
  showView("app");
  renderAll({ animate: true });
}
// 시작 키를 눌렀을 때만 입력칸으로 커서를 옮긴다 (로딩 직후 자동 포커스 없음)
$("#start").onclick = () => {
  openApp();
  if (!state.birth) birthInput.focus({ preventScroll: true });
};
$("#replayIntro").onclick = startIntro;
window.addEventListener("resize", () => ip.running && ipLayout());

/* ---------- 시작 ---------- */
renderSeeAlso($("#more"));
$("#todayMeta").textContent = dotDate(todayKey());
const fromParam = getParam("from");
if (fromParam) {
  const f = decodeState(fromParam);
  if (f && Number.isFinite(f.p) && f.p >= 0 && f.p <= 100) {
    state.friend = f.p;
    $("#friendNote").hidden = false;
    $("#friendNote").innerHTML = `친구의 인생 진행률은 <strong class="t-primary">${f.p.toFixed(1)}%</strong>예요. 나는 몇 %일까요?`;
  }
  history.replaceState(null, "", location.pathname);
}
if (state.birth && !state.friend) openApp();
else startIntro();
