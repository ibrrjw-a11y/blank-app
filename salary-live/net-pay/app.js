// 연봉 실수령액 계산기 (/salary-live/net-pay/)
// 계산은 ../calc.js, 입력값은 실시간 월급 카운터와 같은 저장소("salary-live" settings)를 쓴다.
import {
  $,
  $$,
  createStore,
  haptic,
  fmt,
  share,
  shareImage,
  encodeState,
  decodeState,
  urlWith,
  getParam,
  renderMoreSites,
  createCanvas,
  CANVAS_FONT,
  prefersReducedMotion,
  seededRandom,
  todayKey,
} from "../../shared/kit.js";
import { calcNet, perSecond, salaryTable } from "../calc.js";

const store = createStore("salary-live");
const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
const DEFAULTS = { mode: "annual", pay: null, nontax: 20, dependents: 1, children: 0 };
const SCHEDULE = { start: "09:00", end: "18:00", lunchStart: "12:00", lunchMin: 60, days: [1, 2, 3, 4, 5] };

let settings = { ...DEFAULTS, ...(store.get("settings") || {}) };
let result = null;
let demo = true; // 아직 직접 입력하지 않았으면 예시 값을 보여준다
let fromLink = false; // 친구가 보낸 링크로 들어와 아직 손대지 않은 상태

const comma = (n) => Math.round(n).toLocaleString("ko-KR");
const won = (n) => fmt.won(n);
const pad2 = (n) => String(n).padStart(2, "0");
const digitsOnly = (v) => Number(String(v).replace(/[^\d]/g, "")) || 0;
const annualOf = (s) => (s.pay ? (s.mode === "monthly" ? s.pay * 12 : s.pay) * 10000 : 0);
const manLabel = (man) => (man >= 10000 && man % 10000 === 0 ? `${man / 10000}억` : `${comma(man)}만`);

const payInput = $("#pay");
const nontaxInput = $("#nontax");

/* ---------- 입력 ---------- */
function setMode(mode) {
  settings.mode = mode;
  $$(".seg__btn").forEach((b) => {
    const on = b.dataset.mode === mode;
    b.classList.toggle("is-on", on);
    b.setAttribute("aria-checked", String(on));
  });
  $("#payLabel").textContent = mode === "annual" ? "세전 연봉 (비과세 포함)" : "세전 월급 (비과세 포함)";
  payInput.placeholder = mode === "annual" ? "예: 4,000" : "예: 300";
  const quick = mode === "annual" ? [3000, 4000, 5000, 6000, 8000] : [250, 300, 350, 400, 500];
  $("#payQuick").innerHTML = quick.map((q) => `<button class="chip" data-q="${q}" aria-label="${comma(q)}만 원">${comma(q)}</button>`).join("");
}

/* ---------- 첫 화면 명세서: 지급액에서 공제가 한 줄씩 찍히고 실수령이 남는다 ---------- */
let lastShown = null;
let countRaf = 0;
function ledgerRows(r) {
  return [
    ["국민연금", r.pension],
    ["건강보험", r.health],
    ["장기요양", r.care],
    ["고용보험", r.employ],
    ["근로소득세", r.incomeTax],
    ["지방소득세", r.localTax],
  ];
}
function countTo(el, from, to, ms) {
  cancelAnimationFrame(countRaf);
  if (prefersReducedMotion() || ms <= 0) {
    el.textContent = comma(to);
    return;
  }
  const t0 = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - t0) / ms);
    const e = 1 - Math.pow(1 - t, 4);
    el.textContent = comma(from + (to - from) * e);
    if (t < 1) countRaf = requestAnimationFrame(tick);
    else {
      el.classList.remove("is-pop");
      void el.offsetWidth;
      el.classList.add("is-pop");
    }
  };
  countRaf = requestAnimationFrame(tick);
}
function setLedger(r, { label, tag, mine, print = true }) {
  const key = `${r.monthlyGross}|${r.monthlyNet}|${label}|${tag}`;
  $("#dispSub").textContent = label;
  const t = $("#dispTag");
  t.textContent = tag;
  t.classList.toggle("is-mine", !!mine);
  if (key === lastShown) return;
  lastShown = key;
  const ledger = $("#ledger");
  $("#lgGross").textContent = comma(r.monthlyGross);
  $("#lgRows").innerHTML = ledgerRows(r)
    .map(([k, v], i) => `<li style="--i:${i}"><span>${k}</span><i></i><b>−${comma(v)}</b></li>`)
    .join("");
  const netPct = Math.max(0, Math.min(100, (r.monthlyNet / r.monthlyGross) * 100));
  const net = $("#lgNetBar");
  const cut = $("#lgCutBar");
  if (print && !prefersReducedMotion()) {
    ledger.classList.remove("is-print");
    net.style.width = "100%";
    cut.style.width = "0%";
    void ledger.offsetWidth;
    ledger.classList.add("is-print");
    setTimeout(() => {
      net.style.width = `${netPct}%`;
      cut.style.width = `${100 - netPct}%`;
    }, 180);
    countTo($("#lgNet"), r.monthlyGross, r.monthlyNet, 620);
  } else {
    net.style.width = `${netPct}%`;
    cut.style.width = `${100 - netPct}%`;
    countTo($("#lgNet"), r.monthlyNet, r.monthlyNet, 0);
  }
}

function breakdownRows(r) {
  const row = (label, val, cls = "", note = "") =>
    `<tr class="${cls}"><th scope="row">${label}${note ? ` <small>${note}</small>` : ""}</th><td>${val}</td></tr>`;
  return [
    row("월 급여 (세전)", won(r.monthlyGross)),
    row("비과세", won(r.nonTax), "is-sub"),
    row("국민연금", "−" + won(r.pension), "", "4.75%"),
    row("건강보험", "−" + won(r.health), "", "3.595%"),
    row("장기요양보험", "−" + won(r.care), "", "근사"),
    row("고용보험", "−" + won(r.employ), "", "0.9%"),
    row("근로소득세", "−" + won(r.incomeTax)),
    row("지방소득세", "−" + won(r.localTax), "", "10%"),
    row("공제 합계", "−" + won(r.deductions), "is-sub"),
    row("월 실수령액", won(r.monthlyNet), "is-total"),
  ].join("");
}

function update({ save = true } = {}) {
  settings.pay = digitsOnly(payInput.value) || null;
  settings.nontax = Math.min(100, digitsOnly(nontaxInput.value));
  const annual = annualOf(settings);
  const tooBig = annual > 2_000_000_000;
  payInput.closest(".field").classList.toggle("is-error", !!tooBig);
  $("#payHelp").textContent = tooBig
    ? "금액을 다시 확인해 주세요 (만 원 단위)"
    : settings.pay
      ? `${settings.mode === "annual" ? "연봉" : "월급"} ${fmt.wonKo(settings.pay * 10000)}`
      : "만 원 단위로 입력해요";
  $("#optsSum").textContent = `비과세 ${settings.nontax}만 · 가족 ${settings.dependents} · 자녀 ${settings.children}`;

  // 입력이 없으면 연봉 4,000만 원 예시로 영수증을 채운다
  const shown = annual && !tooBig ? annual : 40_000_000;
  const isExample = !(annual && !tooBig);
  result = calcNet({
    annual: shown,
    nonTaxMonthly: settings.nontax * 10000,
    dependents: settings.dependents,
    children: settings.children,
  });
  const basis = `비과세 ${settings.nontax}만 · 부양가족 ${settings.dependents}명${settings.children ? ` · 자녀 ${settings.children}명` : ""}`;
  const payLabel = `${settings.mode === "monthly" && !isExample ? `월급 ${manLabel(settings.pay)}` : `연봉 ${manLabel(shown / 10000)}`} 원`;

  if (!demo || !isExample) {
    demo = false;
    setLedger(result, { label: `${payLabel} · ${basis}`, tag: fromLink ? "받은 링크" : isExample ? "예시" : "내 금액", mine: !isExample });
  }

  const big = $("#netMonthly");
  if (big.textContent !== won(result.monthlyNet)) {
    big.textContent = won(result.monthlyNet);
    big.classList.remove("is-pop");
    void big.offsetWidth;
    big.classList.add("is-pop");
  }
  $("#netAnnual").textContent = `연 실수령 ${fmt.wonKo(result.annualNet)} · 세전 시급 ${won(result.hourlyGross)} (월 209시간)`;
  $("#breakdown").innerHTML = breakdownRows(result);
  $("#receiptMeta").textContent = `${isExample ? "예시 · " : ""}${payLabel} · ${basis}`;
  $("#printSub").textContent = isExample ? "예시: 연봉 4,000만 원 · 공제 9줄" : `월 ${won(result.monthlyNet)} · 공제 9줄`;

  // 카운터 쿠폰: 저장된 근무 시간이 있으면 그걸로
  const sch = { ...SCHEDULE, ...pickSchedule(store.get("settings")) };
  const ps = perSecond(result.monthlyNet, sch);
  $("#liveSub").textContent = `${sch.start}~${sch.end} 근무면 1초에 ${ps.toFixed(1)}원씩 올라가요`;

  if (save && !isExample && !fromLink) {
    store.set("settings", { ...(store.get("settings") || {}), ...pickPay(settings) });
  }
}

const pickPay = (s) => ({ mode: s.mode, pay: s.pay, nontax: s.nontax, dependents: s.dependents, children: s.children });
function pickSchedule(s) {
  if (!s) return {};
  const out = {};
  ["start", "end", "lunchStart", "lunchMin", "days"].forEach((k) => s[k] != null && (out[k] = s[k]));
  return out;
}

function bind() {
  $$(".seg__btn").forEach((b) =>
    b.addEventListener("click", () => {
      if (b.dataset.mode === settings.mode) return;
      const cur = digitsOnly(payInput.value);
      setMode(b.dataset.mode);
      if (cur) payInput.value = comma(b.dataset.mode === "monthly" ? Math.round(cur / 12) : cur * 12);
      update();
    })
  );
  $("#payQuick").addEventListener("click", (e) => {
    const q = e.target.closest("[data-q]");
    if (!q) return;
    payInput.value = comma(Number(q.dataset.q));
    haptic(8);
    demo = false;
    fromLink = false;
    update();
  });
  payInput.addEventListener("input", () => {
    const n = digitsOnly(payInput.value);
    payInput.value = n ? comma(n) : "";
    demo = false;
    fromLink = false;
    update();
  });
  nontaxInput.addEventListener("input", () => ((fromLink = false), update()));
  $$("[data-stepper]").forEach((wrap) => {
    const key = wrap.dataset.stepper;
    const min = Number(wrap.dataset.min);
    const max = Number(wrap.dataset.max);
    wrap.addEventListener("click", (e) => {
      const b = e.target.closest("[data-step]");
      if (!b) return;
      const v = Math.min(max, Math.max(min, settings[key] + Number(b.dataset.step)));
      settings[key] = v;
      if (key === "dependents" && settings.children > v - 1) settings.children = Math.max(0, v - 1);
      if (key === "children" && v > settings.dependents - 1) settings.dependents = v + 1;
      $("#dependents").textContent = settings.dependents;
      $("#children").textContent = settings.children;
      haptic(6);
      fromLink = false;
      update();
    });
  });

  // 발행 키: 급여 영수증이 프린터에서 나오듯 다시 찍힌다
  $("#printBtn").addEventListener("click", () => {
    const card = $("#resultCard");
    card.classList.remove("is-print");
    void card.offsetWidth;
    card.classList.add("is-print");
    haptic([10, 40, 10, 40, 10]);
    $("#receiptWrap").scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  });

  $("#shareLink").addEventListener("click", () => {
    const a = annualOf(settings) || 40_000_000;
    share({
      title: "연봉 실수령액 계산기",
      text: `연봉 ${manLabel(a / 10000)} 원이면 2026년 월 실수령액 ${won(result.monthlyNet)}이래요`,
      url: urlWith({ p: encodeState({ a, n: settings.nontax, d: settings.dependents, c: settings.children }) }),
    });
  });
  $("#saveImg").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.classList.add("is-loading");
    try {
      await shareImage(drawReceipt(), { filename: `실수령액-영수증-${todayKey()}.png`, text: "2026 급여 영수증 (예상)" });
    } finally {
      btn.classList.remove("is-loading");
    }
  });
}

/* ---------- 결과 이미지 ---------- */
function css(name, fb) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb;
}
function drawReceipt() {
  const W = 540;
  const H = 760;
  const { canvas, ctx } = createCanvas(W, H, 2);
  const bg = css("--art-paper", "#d7dbd5");
  const paper = css("--art-slip", "#fdfcf7");
  const ink = css("--art-ink", "#161615");
  const sub = css("--art-ink-2", "#6a675f");
  const brand = css("--brand", "#0f9d58");
  const MONO = `"IBM Plex Mono", ui-monospace, Menlo, monospace, ${CANVAS_FONT}`;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const px = 70;
  const pw = W - px * 2;
  const py = 36;
  const ph = H - 92;
  const tooth = pw / (2 * Math.round(pw / 20));
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + pw, py);
  ctx.lineTo(px + pw, py + ph - tooth);
  for (let x = px + pw; x > px; x -= tooth * 2) {
    ctx.lineTo(x - tooth, py + ph);
    ctx.lineTo(Math.max(x - tooth * 2, px), py + ph - tooth);
  }
  ctx.closePath();
  ctx.fillStyle = paper;
  ctx.fill();
  const L = px + 26;
  const R = px + pw - 26;
  const text = (t, x, y, { size = 15, weight = 500, color = ink, align = "left", mono = false } = {}) => {
    ctx.font = `${weight} ${size}px ${mono ? MONO : CANVAS_FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(t, x, y);
  };
  const dash = (y) => {
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = sub;
    ctx.beginPath();
    ctx.moveTo(L, y);
    ctx.lineTo(R, y);
    ctx.stroke();
    ctx.restore();
  };
  const r = result;
  let y = py + 50;
  text("급여명세서 (예상)", W / 2, y, { size: 24, weight: 800, align: "center" });
  y += 24;
  text($("#receiptMeta").textContent, W / 2, y, { size: 12, color: sub, align: "center" });
  y += 18;
  const n = new Date();
  text(`${n.getFullYear()}.${pad2(n.getMonth() + 1)}.${pad2(n.getDate())} (${DAY_NAMES[n.getDay()]}) · 2026 요율`, W / 2, y, { size: 12, color: sub, align: "center", mono: true });
  y += 18;
  dash(y);
  const rows = [
    ["월 급여 (세전)", won(r.monthlyGross)],
    ["비과세", won(r.nonTax)],
    ["국민연금", "−" + won(r.pension)],
    ["건강보험", "−" + won(r.health)],
    ["장기요양보험", "−" + won(r.care)],
    ["고용보험", "−" + won(r.employ)],
    ["근로소득세", "−" + won(r.incomeTax)],
    ["지방소득세", "−" + won(r.localTax)],
    ["공제 합계", "−" + won(r.deductions)],
  ];
  y += 8;
  rows.forEach(([k, v]) => {
    y += 30;
    text(k, L, y, { size: 16 });
    text(v, R, y, { size: 16, weight: 700, align: "right", mono: true, color: v.startsWith("−") ? brand : ink });
  });
  y += 20;
  dash(y);
  y += 40;
  text("월 실수령액", L, y, { size: 17, weight: 700 });
  text(won(r.monthlyNet), R, y, { size: 28, weight: 700, color: ink, align: "right", mono: true });
  y += 28;
  text(`연 ${fmt.wonKo(r.annualNet)}`, R, y, { size: 13, color: sub, align: "right" });
  y += 22;
  const rand = seededRandom(String(r.monthlyNet));
  let bx = L + 10;
  ctx.fillStyle = ink;
  while (bx < R - 10) {
    const w = 1 + Math.floor(rand() * 3);
    if (rand() > 0.35) ctx.fillRect(bx, y, w, 40);
    bx += w + 1 + Math.floor(rand() * 2);
  }
  text("2026 요율 근사치 · 연봉 실수령액 계산기", W / 2, H - 22, { size: 13, color: ink, align: "center" });
  return canvas;
}

/* ---------- 짧은 인트로: 예시 연봉 3개가 명세서로 찍히고 4,000만 원에서 멈춘다 ---------- */
function introRoll() {
  if (!demo) {
    update({ save: false });
    return;
  }
  const show = (man, last) => {
    const r = calcNet({ annual: man * 10000 });
    setLedger(r, { label: `연봉 ${manLabel(man)} 원 · 비과세 20만 · 부양가족 1명`, tag: last ? "예시" : "계산 중" });
  };
  if (prefersReducedMotion()) return show(4000, true);
  const list = [[3000], [6000], [4000, true]];
  const run = (i = 0) => {
    if (!demo || i >= list.length) return;
    show(...list[i]);
    setTimeout(() => run(i + 1), 1500);
  };
  run();
}

function posClock() {
  const n = new Date();
  $("#posTime").textContent = `${n.getFullYear()}.${pad2(n.getMonth() + 1)}.${pad2(n.getDate())}`;
}

function renderSeoTable() {
  $("#salaryTable").innerHTML = salaryTable()
    .map(
      (r) =>
        `<tr><th scope="row">${manLabel(r.annual / 10000)}</th><td>${comma(r.monthlyNet)}</td><td>${comma(r.deductions)}</td><td>${comma(r.annualNet)}</td></tr>`
    )
    .join("");
}

/* ---------- 하단: 명세서 봉투에 같이 든 "동봉 서류" ---------- */
function renderEnclosures(el) {
  renderMoreSites(el);
  if (!el) return;
  const title = el.querySelector(".more-sites__title");
  if (title) title.innerHTML = `동봉 서류 <small>3부 · 필요한 것만 꺼내 보세요</small>`;
  el.querySelectorAll(".more-sites__item").forEach((a, i) => {
    a.insertAdjacentHTML("afterbegin", `<span class="encl__box" aria-hidden="true"></span><span class="encl__no" aria-hidden="true">별지 제${i + 1}호</span>`);
  });
}

function init() {
  renderEnclosures($("#more"));
  renderSeoTable();
  posClock();

  // 친구가 보낸 링크면 그 값으로 (저장은 하지 않는다)
  const shared = getParam("p") && decodeState(getParam("p"));
  if (shared && Number.isFinite(shared.a) && shared.a > 0) {
    settings = { ...settings, mode: "annual", pay: Math.round(shared.a / 10000), nontax: shared.n ?? 20, dependents: shared.d || 1, children: shared.c || 0 };
    fromLink = true;
  }
  setMode(settings.mode);
  payInput.value = settings.pay ? comma(settings.pay) : "";
  nontaxInput.value = settings.nontax;
  $("#dependents").textContent = settings.dependents;
  $("#children").textContent = settings.children;
  demo = !settings.pay;
  bind();
  update({ save: false });
  introRoll();
}

init();
