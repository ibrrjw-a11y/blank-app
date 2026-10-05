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

const store = createStore("life-progress");
const DAY = 86400000;
const YEAR_DAYS = 365.2425;
const WD = ["일", "월", "화", "수", "목", "금", "토"];
const ZODIAC = ["쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지"];
const DEFAULT_LIFE = 83.5; // 통계청 2023년 생명표 기대수명

/* ---------- 날짜 ---------- */
const pad = (n) => String(n).padStart(2, "0");
const key = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const parts = (k) => k.split("-").map(Number);
const toUTC = (k) => {
  const [y, m, d] = parts(k);
  return Date.UTC(y, m - 1, d);
};
const fromUTC = (ms) => new Date(ms).toISOString().slice(0, 10);
const addDays = (k, n) => fromUTC(toUTC(k) + n * DAY);
const diffDays = (a, b) => Math.round((toUTC(b) - toUTC(a)) / DAY);
const weekday = (k) => WD[new Date(toUTC(k)).getUTCDay()];
const dotDate = (k) => k.replaceAll("-", ".");
const longDate = (k) => `${dotDate(k)} (${weekday(k)})`;
const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
function validKey(y, m, d) {
  if (!(y >= 1900 && m >= 1 && m <= 12 && d >= 1)) return null;
  const dim = [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  return d <= dim ? key(y, m, d) : null;
}
// 그 해의 생일. 2월 29일생은 평년에 3월 1일로 봐요 (민법 기간 계산 방식)
function birthdayIn(birth, y) {
  const [, m, d] = parts(birth);
  if (m === 2 && d === 29 && !isLeap(y)) return key(y, 3, 1);
  return key(y, m, d);
}
function manAge(birth, asOf) {
  const [by] = parts(birth);
  const [y] = parts(asOf);
  return y - by - (asOf < birthdayIn(birth, y) ? 1 : 0);
}
function nextBirthday(birth, asOf) {
  const [y] = parts(asOf);
  let b = birthdayIn(birth, y);
  if (b < asOf) b = birthdayIn(birth, y + 1);
  return b;
}
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const token = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function alpha(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// 자리별로 굴러가는 숫자 (스프링은 CSS)
function odometer(el, text) {
  if (el.dataset.odo === text) return;
  el.dataset.odo = text;
  el.classList.add("odo");
  el.classList.remove("is-on");
  el.setAttribute("aria-label", text);
  const strip = "01234567890123456789"
    .split("")
    .map((n) => `<span>${n}</span>`)
    .join("");
  let k = 0;
  el.innerHTML = [...text]
    .map((ch) =>
      /\d/.test(ch)
        ? `<span class="odo__col" aria-hidden="true" style="--d:${ch};--i:${k++}"><span class="odo__strip">${strip}</span></span>`
        : `<span class="odo__ch" aria-hidden="true">${ch}</span>`,
    )
    .join("");
  if (prefersReducedMotion()) return el.classList.add("is-on");
  void el.offsetWidth;
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("is-on")));
}

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

/* ---------- 만나이 계산기 ---------- */
function parseBirth(raw) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  return validKey(Number(digits.slice(0, 4)), Number(digits.slice(4, 6)), Number(digits.slice(6, 8)));
}
function formatBirthInput(raw) {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}.${d.slice(4)}`;
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6)}`;
}
const birthInput = $("#birth");
birthInput.addEventListener("input", () => {
  const before = birthInput.value;
  birthInput.value = formatBirthInput(before);
  const field = $("#birthField");
  const digits = birthInput.value.replace(/\D/g, "");
  field.classList.remove("is-error");
  $("#birthHelp").textContent = "숫자 8자리만 넣으면 돼요";
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
$("#asof").addEventListener("change", () => {
  const v = $("#asof").value;
  state.asOf = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  renderCalc();
});
$("#asofToday").onclick = () => {
  state.asOf = null;
  $("#asof").value = todayKey();
  renderCalc();
};

function setBirth(k, { fresh = false } = {}) {
  const changed = state.birth !== k;
  state.birth = k;
  store.set("birth", k);
  renderAll({ animate: fresh || changed });
  if (fresh) haptic(14);
}

function renderCalc(animate = false) {
  const b = state.birth;
  if (!b) return;
  const today = todayKey();
  const asOf = state.asOf || today;
  $("#asofLabel").textContent = asOf === today ? "(오늘)" : `(${dotDate(asOf)})`;
  const res = $("#calcResult");
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
  $("#nextBday").textContent = gap === 0 ? "오늘 🎂" : `D-${fmt.num(gap)}`;
  const leapNote = bm === 2 && bd === 29 && nb.slice(5) === "03-01" ? " · 평년이라 3월 1일 기준" : "";
  $("#nextBdaySub").textContent = `${longDate(nb)} · 만 ${manAge(b, nb)}세${leapNote}`;
  const zi = (((by - 4) % 12) + 12) % 12;
  $("#zodiac").textContent = `${ZODIAC[zi]}띠`;
  $("#zodiacSub").textContent = bm <= 2 ? "1~2월생은 설·입춘 기준으로 앞 해 띠일 수 있어요" : "양력 출생 연도 기준";
  const lived = diffDays(b, asOf) + 1;
  if (animate) countUp($("#livedDays"), lived, { duration: 900, format: (n) => `${fmt.num(Math.round(n))}일째` });
  else $("#livedDays").textContent = `${fmt.num(lived)}일째`;
  $("#calcNote").textContent =
    bm === 2 && bd === 29
      ? "2월 29일생은 평년에는 3월 1일에 만 나이가 한 살 늘어나는 것으로 계산해요. 2023년 6월 28일부터 법적 나이는 만 나이로 통일됐어요."
      : "2023년 6월 28일부터 법적 나이는 만 나이로 통일됐어요. 연 나이는 일부 법(청소년보호법·병역법 등)에서만 써요.";
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
    $("#calcResult").hidden = true;
    $("#bdayBanner").hidden = true;
    return;
  }
  if (!birthInput.value || parseBirth(birthInput.value) !== state.birth) birthInput.value = dotDate(state.birth);
  ["#lifeSection", "#statsSection", "#milesSection", "#bucketSection", "#shareSection"].forEach((s) => ($(s).hidden = false));
  renderCalc(animate);
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
const OVERLAY_H = 146;
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
  const cols = 52;
  const total = Math.round(EX.life * 52);
  const rows = Math.ceil(total / cols);
  const pitch = Math.min(w / cols, (h - OVERLAY_H - 12) / rows);
  ip.geo = { w, h, dpr, cols, total, rows, pitch, gx: 0, gy: 10, ctx: cv.getContext("2d"), current: Math.round((EX.pct / 100) * total) };
}
const ipXY = (i) => {
  const g = ip.geo;
  return [g.gx + (i % g.cols) * g.pitch + g.pitch / 2, g.gy + Math.floor(i / g.cols) * g.pitch + g.pitch / 2];
};
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 3);
const easeIO = (t) => ((t = clamp01(t)), t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// 감쇠 진동 스프링 (0 → 1, 오버슈트 후 정착)
const spring = (t) => (t <= 0 ? 0 : 1 - Math.exp(-6 * t) * Math.cos(13 * t));
function ipFrame(now) {
  const g = ip.geo;
  if (!g) return;
  const { ctx, w, h, dpr, total, pitch, current } = g;
  const t = prefersReducedMotion() ? 99999 : now - ip.t0;
  const brand = token("--brand");
  const white = token("--art-white");
  const left = token("--art-dot-left");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const r = pitch * 0.36;
  const batch = (from, to, color, a = 1) => {
    if (to <= from) return;
    ctx.globalAlpha = a;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = from; i < to; i++) {
      const [x, y] = ipXY(i);
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.globalAlpha = 1;
  };
  const dot = (x, y, rad, color, a = 1) => {
    ctx.globalAlpha = a;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  };
  // 오른쪽 여백: 나이 눈금 + "지금" 주석 (연차보고서 도표처럼)
  const gridRight = g.gx + g.cols * pitch;
  const ticks = (a = 1) => {
    ctx.globalAlpha = a;
    ctx.fillStyle = token("--color-text-tertiary");
    ctx.font = `600 9px ${token("--art-num") || CANVAS_FONT}`;
    ctx.textAlign = "left";
    for (let yr = 0; yr * 52 < total; yr += 10) ctx.fillText(`${yr}`, gridRight + 10, ipXY(yr * 52)[1] + 3);
    ctx.globalAlpha = 1;
  };
  const annotate = (a = 1) => {
    const [x, y] = ipXY(current);
    ctx.globalAlpha = a;
    ctx.strokeStyle = brand;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + r * 2.5, y);
    ctx.lineTo(gridRight + 34, y);
    ctx.stroke();
    ctx.fillStyle = brand;
    ctx.textAlign = "left";
    ctx.font = `800 12px ${token("--font-display") || CANVAS_FONT}`;
    ctx.fillText("지금", gridRight + 38, y + 4);
    ctx.fillStyle = white;
    ctx.font = `600 10px ${token("--art-num") || CANVAS_FONT}`;
    ctx.fillText("만 31세", gridRight + 38, y + 18);
    ctx.globalAlpha = 1;
  };
  const pulseNow = (k = 1) => {
    const [x, y] = ipXY(current);
    const p = (Math.sin(now / 280) + 1) / 2;
    dot(x, y, r * (2.4 + 2.2 * p), brand, (0.18 + 0.22 * p) * k);
    dot(x, y, r * 1.5, brand, k);
  };

  if (ip.scene === 0) {
    // 점 하나가 스프링으로 튀어나와 첫 칸에 앉고, 줄줄이 4,000칸이 깔린다
    const cx = w / 2;
    const cy = (h - OVERLAY_H) / 2;
    const pop = spring((t - 80) / 700);
    const move = easeIO((t - 800) / 420);
    const fill = easeIO((t - 1200) / 2100);
    const [x0, y0] = ipXY(0);
    if (move < 1) {
      const x = cx + (x0 - cx) * move;
      const y = cy + (y0 - cy) * move;
      const rad = Math.max(0, 16 * pop * (1 - move) + r * move);
      // 출발 직전 살짝 눌렸다(스쿼시) 튀어나가기
      const squash = move > 0 && move < 0.3 ? 1 - 0.35 * Math.sin((move / 0.3) * Math.PI) : 1;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1 / squash, squash);
      dot(0, 0, rad, brand);
      ctx.restore();
    } else {
      const k = Math.floor(total * fill);
      ticks(fill);
      batch(0, k, left);
      const row = Math.max(0, k - 52);
      batch(row, k, white);
      if (k < total) {
        const [hx, hy] = ipXY(Math.max(0, k - 1));
        dot(hx, hy, r * 1.8, brand);
      }
    }
  } else if (ip.scene === 1) {
    const fill = easeIO((t - 150) / 1800);
    const k = Math.floor(current * fill);
    batch(k, total, left);
    batch(0, k, white);
    ticks();
    if (fill < 1) {
      const [hx, hy] = ipXY(k);
      dot(hx, hy, r * 2, brand);
    } else {
      pulseNow();
      annotate(easeOut((t - 1950) / 300));
    }
  } else if (ip.scene === 2) {
    const dim = 1 - 0.55 * easeOut(t / 500);
    batch(current, total, left, dim);
    batch(0, current, white, dim);
    ticks(dim);
    pulseNow(dim);
    annotate(dim);
  } else {
    const focus = easeOut(t / 900);
    batch(current, total, left, 1 - 0.4 * focus);
    batch(0, current, white, 1 - 0.6 * focus);
    const [x, y] = ipXY(current);
    ctx.strokeStyle = brand;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 1 - 0.6 * focus;
    ctx.beginPath();
    ctx.arc(x, y, r * (2 + 14 * spring(t / 900)), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    pulseNow();
    const goals = [
      [0.52, "오로라 보기"],
      [0.66, "마라톤 완주"],
      [0.8, "부모님과 여행"],
    ];
    goals.forEach(([f, label], i) => {
      const a = spring((t - 900 - i * 220) / 600);
      if (a <= 0) return;
      const idx = Math.round(total * f) + 9 * i;
      const [fx, fy] = ipXY(idx);
      ctx.save();
      ctx.translate(fx, fy);
      ctx.scale(a, a);
      ctx.strokeStyle = brand;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, r + 3.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = clamp01(a);
      ctx.strokeStyle = brand;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(fx + r + 4, fy);
      ctx.lineTo(fx + 18, fy);
      ctx.stroke();
      ctx.fillStyle = white;
      ctx.font = `800 11px ${token("--font-display") || CANVAS_FONT}`;
      ctx.textAlign = "left";
      ctx.fillText(label, fx + 22, fy + 4);
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
const SCENES = [
  {
    title: "인생을 4,000칸으로",
    desc: "한 칸은 일주일, 한 줄은 1년이에요",
    duration: 4000,
    play: ipScene(0, `<div class="ip-count"><span class="odo" data-v="4,342"></span><span class="ip-label">칸 — 기대수명 83.5년 × 52주</span></div>`, (ov, later) => {
      const el = $(".odo", ov);
      later(1200, () => odometer(el, el.dataset.v));
    }),
  },
  {
    title: "지금 여기까지 왔어요",
    desc: "예시 · 만 31세, 기대수명 83.5세 기준",
    duration: 3600,
    play: ipScene(1, `<div class="ip-pct"><span class="odo"></span><sup>%</sup></div>`, (ov, later) => later(150, () => odometer($(".odo", ov), EX.pct.toFixed(1)))),
  },
  {
    title: "숫자로 보면 달라져요",
    desc: "남은 크리스마스, 주말, 봄을 세어봐요",
    duration: 3800,
    play: ipScene(
      2,
      `<ol class="ip-rows">
        <li style="--i:0"><span>남은 크리스마스</span><span><b class="odo" data-v="${EX.christmas}"></b><small>번</small></span></li>
        <li style="--i:1"><span>남은 주말</span><span><small>약</small><b class="odo" data-v="${fmt.num(EX.weekends)}"></b><small>번</small></span></li>
        <li style="--i:2"><span>남은 봄</span><span><b class="odo" data-v="${EX.springs}"></b><small>번</small></span></li>
      </ol>`,
      (ov, later) => $$(".odo", ov).forEach((el, i) => later(260 + i * 160, () => odometer(el, el.dataset.v))),
    ),
  },
  {
    title: "이번 주도 딱 한 칸",
    desc: "버킷리스트를 칸 위에 꽂고 하나씩 채워요",
    duration: 3800,
    play: ipScene(3, `<span class="ip-tag">이번 주</span><div class="ip-count"><span class="odo" data-v="1"></span><span class="ip-label">/ 4,342칸 — 이번 주는 한 번뿐이에요</span></div>`, (ov, later) => {
      const el = $(".ip-count .odo", ov);
      later(300, () => odometer(el, el.dataset.v));
      const [x, y] = ipXY(ip.geo.current);
      const tag = $(".ip-tag", ov);
      tag.style.left = `${Math.min(x + 12, ip.geo.w - 64)}px`;
      tag.style.top = `${y - 30}px`;
    }),
  },
];
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
  if (!state.birth) setTimeout(() => birthInput.focus(), 200);
}
$("#start").onclick = openApp;
$("#replayIntro").onclick = startIntro;
window.addEventListener("resize", () => ip.running && ipLayout());

/* ---------- 시작 ---------- */
renderMoreSites($("#more"), "life-progress");
$("#todayMeta").textContent = dotDate(todayKey());
$("#asof").value = todayKey();
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
