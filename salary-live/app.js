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
  fmt,
  runIntro,
  showView,
  openSheet,
  renderMoreSites,
  createCanvas,
  roundRect,
  CANVAS_FONT,
  prefersReducedMotion,
  seededRandom,
} from "../shared/kit.js";
import {
  calcNet,
  perSecond,
  dailyWorkSeconds,
  workedSecondsAt,
  workPhase,
  nextWorkStart,
  nextPayday,
  daysBetween,
  toMin,
  salaryTable,
} from "./calc.js";

const store = createStore("salary-live");
const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
const LUPANG = [
  { key: "toilet", emoji: "🚽", name: "화장실" },
  { key: "coffee", emoji: "☕", name: "커피·탕비실" },
  { key: "slack", emoji: "📱", name: "딴짓" },
];
const COFFEE = 4500;
const LUNCH = 10000;

const DEFAULTS = {
  mode: "annual",
  pay: null, // 만 원
  nontax: 20,
  dependents: 1,
  children: 0,
  start: "09:00",
  end: "18:00",
  lunchStart: "12:00",
  lunchMin: 60,
  days: [1, 2, 3, 4, 5],
  payday: 25,
};

let settings = { ...DEFAULTS, ...(store.get("settings") || {}) };
let result = null; // calcNet 결과
let ps = 0; // 원/초

const won = (n) => fmt.won(n);
const comma = (n) => Math.round(n).toLocaleString("ko-KR");
const pad2 = (n) => String(Math.floor(n)).padStart(2, "0");
const hms = (sec) => {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
};
const minText = (sec) => {
  const m = Math.floor(sec / 60);
  if (m >= 60) return `${Math.floor(m / 60)}시간 ${m % 60}분`;
  return `${m}분`;
};
const annualOf = (s) => (s.pay ? (s.mode === "monthly" ? s.pay * 12 : s.pay) * 10000 : 0);
const schedule = () => ({
  start: settings.start,
  end: settings.end,
  lunchStart: settings.lunchStart,
  lunchMin: settings.lunchMin,
  days: settings.days,
});
const nowSecOf = (d) => d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000;

function recompute() {
  const annual = annualOf(settings);
  result = annual
    ? calcNet({ annual, nonTaxMonthly: settings.nontax * 10000, dependents: settings.dependents, children: settings.children })
    : null;
  ps = result ? perSecond(result.monthlyNet, schedule()) : 0;
}

/* =========================================================
 * 인트로
 * ========================================================= */
function introScenes() {
  // 예시 값도 실제 계산기로 구한다 (연봉 5,400만 원, 9-18시, 점심 1시간, 주 5일)
  const exSch = { start: "09:00", end: "18:00", lunchStart: "12:00", lunchMin: 60, days: [1, 2, 3, 4, 5] };
  const ex = calcNet({ annual: 54_000_000 });
  const exPs = perSecond(ex.monthlyNet, exSch);
  const exDay = exPs * dailyWorkSeconds(exSch);
  const toilet = Math.round(exPs * 300);
  const coffeeMin = Math.round(COFFEE / exPs / 60);
  const meetHour = Math.round(((6 * 50_000_000) / (12 * 209)) * 1);

  return [
    {
      title: "출근하면 1초마다 월급이 쌓여요",
      desc: `연봉 5,400만 원이면 하루 약 ${comma(Math.round(exDay / 1000) * 1000)}원`,
      duration: 3600,
      play(stage, signal) {
        const digits = 6;
        stage.innerHTML = `<div class="scene">
          <div class="slot" id="iSlot"><span class="slot__cur">₩</span>${Array.from({ length: digits }, (_, i) => {
            const col = `<span class="slot__col"><span class="slot__strip">${"01234567890"
              .split("")
              .map((d) => `<span>${d}</span>`)
              .join("")}</span></span>`;
            return (digits - i) % 3 === 0 && i ? `<span class="slot__sep">,</span>${col}` : col;
          }).join("")}</div>
          <div class="jar">
            <svg viewBox="0 0 168 196">
              <rect class="jar__lid" x="34" y="6" width="100" height="22" rx="8"/>
              <clipPath id="jarClip"><path d="M40 30 h88 v18 q24 14 24 44 v76 q0 22 -22 22 h-92 q-22 0 -22 -22 v-76 q0 -30 24 -44z"/></clipPath>
              <g clip-path="url(#jarClip)"><rect class="jar__fill" id="jarFill" x="0" y="40" width="168" height="160"/></g>
              <path class="jar__glass" d="M40 30 h88 v18 q24 14 24 44 v76 q0 22 -22 22 h-92 q-22 0 -22 -22 v-76 q0 -30 24 -44z"/>
              <path class="jar__shine" d="M34 100 v50"/>
            </svg>
          </div>
        </div>`;
        const strips = $$(".slot__strip", stage);
        const fill = $("#jarFill", stage);
        const jar = $(".jar", stage);
        const target = exDay;
        const dur = 2800;
        const t0 = performance.now();
        let lastCoin = 0;
        const setSlot = (v) => {
          strips.forEach((s, i) => {
            const p = Math.pow(10, digits - 1 - i);
            const lower = v % p;
            let pos = Math.floor(v / p) % 10;
            if (p === 1) pos = v % 10;
            else if (lower > p - 1) pos += lower - (p - 1);
            s.style.transform = `translateY(${-pos * 46}px)`;
          });
        };
        const frame = (now) => {
          if (signal.aborted) return;
          const t = Math.min(1, (now - t0) / dur);
          const eased = 1 - Math.pow(1 - t, 2.2);
          setSlot(target * eased);
          fill.style.transform = `scaleY(${0.08 + eased * 0.62})`;
          if (now - lastCoin > 170 && t < 0.92) {
            lastCoin = now;
            const c = document.createElement("span");
            c.className = "coin coin--drop";
            c.textContent = Math.random() < 0.3 ? "500" : "100";
            c.style.setProperty("--x", `${Math.round((Math.random() - 0.5) * 60)}px`);
            c.style.setProperty("--y", `${150 - eased * 70}px`);
            jar.appendChild(c);
            setTimeout(() => c.remove(), 950);
          }
          if (t < 1) requestAnimationFrame(frame);
        };
        if (prefersReducedMotion()) {
          setSlot(target);
          fill.style.transform = "scaleY(0.7)";
        } else requestAnimationFrame(frame);
      },
    },
    {
      title: "화장실 5분도 돈이에요",
      desc: "커피 한 잔, 점심 한 끼가 내 노동 몇 분인지 바로 보여줘요",
      duration: 3600,
      play(stage, signal) {
        stage.innerHTML = `<div class="scene">
          <div class="ring">
            <svg viewBox="0 0 168 168"><circle class="ring__track" cx="84" cy="84" r="75"/><circle class="ring__bar" cx="84" cy="84" r="75"/></svg>
            <span class="ring__emoji">🚽</span>
            <span class="ring__time" id="iTime">00:00</span>
          </div>
          <div class="scene__chips" id="iChips"></div>
        </div>`;
        const bar = $(".ring__bar", stage);
        const time = $("#iTime", stage);
        const chips = $("#iChips", stage);
        requestAnimationFrame(() => bar.classList.add("is-run"));
        const t0 = performance.now();
        const tick = (now) => {
          if (signal.aborted) return;
          const t = Math.min(1, (now - t0) / 1600);
          time.textContent = hms(300 * t);
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        setTimeout(() => {
          if (signal.aborted) return;
          chips.innerHTML = `<span class="pop-chip">🚽 화장실 5분 = ${comma(toilet)}원</span>`;
        }, 1700);
        setTimeout(() => {
          if (signal.aborted) return;
          chips.insertAdjacentHTML("beforeend", `<span class="pop-chip pop-chip--soft">☕ 커피 한 잔 = ${coffeeMin}분 노동</span>`);
        }, 2300);
      },
    },
    {
      title: "오늘의 월급루팡, 영수증으로",
      desc: "딴짓 타이머를 켜두면 그동안 번 돈이 영수증에 찍혀요",
      duration: 3400,
      play(stage) {
        const row = (a, b) => `<div class="paper__row"><span>${a}</span><span>${b}</span></div>`;
        stage.innerHTML = `<div class="scene">
          <div class="printer"><span class="printer__led"></span></div>
          <div class="paper-wrap"><div class="paper" id="iPaper">
            <div class="paper__title">월급루팡 영수증</div>
            ${row("근무 8시간", comma(exDay) + "원")}
            <div class="paper__hr"></div>
            ${row("🚽 화장실 12분", comma(exPs * 720) + "원")}
            ${row("☕ 커피 15분", comma(exPs * 900) + "원")}
            ${row("📱 딴짓 20분", comma(exPs * 1200) + "원")}
            <div class="paper__hr"></div>
            <div class="paper__row paper__total"><span>루팡 수익</span><span>${comma(exPs * 2820)}원</span></div>
            <div class="paper__bar"></div>
          </div></div>
        </div>`;
        const paper = $("#iPaper", stage);
        requestAnimationFrame(() => paper.classList.add("is-print"));
      },
    },
    {
      title: "이 회의, 지금 얼마 쓰는 중?",
      desc: `6명이 1시간 회의하면 인건비 약 ${comma(Math.round(meetHour / 1000) * 1000)}원 (평균 연봉 5,000만 원)`,
      duration: 3400,
      play(stage, signal) {
        const people = ["🧑‍💼", "👩‍💻", "🧑‍🔧", "👨‍💼", "👩‍🎨", "🧑‍💻"];
        stage.innerHTML = `<div class="scene">
          <div class="table-scene">
            <div class="table-scene__table">회의 중…</div>
            ${people
              .map((p, i) => {
                const a = (i / people.length) * Math.PI * 2 - Math.PI / 2;
                const x = 130 + Math.cos(a) * 112;
                const y = 100 + Math.sin(a) * 78;
                return `<span class="avatar" style="left:${x}px;top:${y}px;animation-delay:${i * 90}ms">${p}</span>`;
              })
              .join("")}
          </div>
          <div class="meet-big" id="iMeet">₩0</div>
        </div>`;
        const el = $("#iMeet", stage);
        const t0 = performance.now();
        const tick = (now) => {
          if (signal.aborted) return;
          const t = Math.min(1, (now - t0) / 2600);
          el.textContent = `₩${comma(meetHour * t)}`;
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
    },
  ];
}

/* =========================================================
 * 설정 화면 (실수령액 계산기)
 * ========================================================= */
const payInput = $("#pay");
const nontaxInput = $("#nontax");

function digitsOnly(v) {
  return Number(String(v).replace(/[^\d]/g, "")) || 0;
}

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
  $("#payQuick").innerHTML = quick
    .map((q) => `<button class="chip" data-q="${q}">${comma(q)}만</button>`)
    .join("");
}

function fillSetup() {
  setMode(settings.mode);
  payInput.value = settings.pay ? comma(settings.pay) : "";
  nontaxInput.value = settings.nontax;
  $("#dependents").textContent = settings.dependents;
  $("#children").textContent = settings.children;
  $("#start-t").value = settings.start;
  $("#end-t").value = settings.end;
  $("#lunch-t").value = settings.lunchStart;
  $("#lunch-m").value = String(settings.lunchMin);
  $("#payday").innerHTML = Array.from({ length: 31 }, (_, i) => i + 1)
    .map((d) => `<option value="${d}">${d === 31 ? "말일" : `매달 ${d}일`}</option>`)
    .join("");
  $("#payday").value = String(settings.payday);
  renderDays();
  updateSetup();
}

function renderDays() {
  $("#days").innerHTML = [1, 2, 3, 4, 5, 6, 0]
    .map(
      (d) =>
        `<button class="chip" data-day="${d}" aria-pressed="${settings.days.includes(d)}">${DAY_NAMES[d]}</button>`
    )
    .join("");
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

function updateSetup() {
  settings.pay = digitsOnly(payInput.value) || null;
  settings.nontax = Math.min(100, digitsOnly(nontaxInput.value));
  settings.start = $("#start-t").value || "09:00";
  settings.end = $("#end-t").value || "18:00";
  settings.lunchStart = $("#lunch-t").value || "12:00";
  settings.lunchMin = Number($("#lunch-m").value) || 0;
  settings.payday = Number($("#payday").value) || 25;
  recompute();

  const payField = payInput.closest(".field");
  const tooBig = settings.pay && annualOf(settings) > 2_000_000_000;
  payField.classList.toggle("is-error", !!tooBig);
  $("#payHelp").textContent = tooBig
    ? "금액을 다시 확인해 주세요 (만 원 단위)"
    : settings.pay
      ? `${settings.mode === "annual" ? "연봉" : "월급"} ${fmt.wonKo(settings.pay * 10000)}`
      : "만 원 단위로 입력해요";

  if (result && !tooBig) {
    $("#netMonthly").textContent = won(result.monthlyNet);
    $("#netAnnual").textContent = `연 실수령액 ${fmt.wonKo(result.annualNet)} · 세전 시급 ${won(result.hourlyGross)} (월 209시간)`;
    $("#breakdown").innerHTML = breakdownRows(result);
  } else {
    $("#netMonthly").textContent = "-";
    $("#netAnnual").textContent = "연봉을 입력해 주세요";
    $("#breakdown").innerHTML = "";
  }

  const err = $("#schedErr");
  let msg = "";
  if (toMin(settings.end) <= toMin(settings.start)) msg = "퇴근 시간은 출근보다 늦어야 해요 (야간 근무는 아직 지원하지 않아요)";
  else if (!settings.days.length) msg = "근무 요일을 하나 이상 골라 주세요";
  err.hidden = !msg;
  err.textContent = msg;
  err.closest(".card").classList.toggle("is-error", !!msg);
  err.style.color = msg ? "var(--color-danger)" : "";

  $("#go").disabled = !(result && !tooBig && !msg && result.monthlyNet > 0);
}

function bindSetup() {
  $$(".seg__btn").forEach((b) =>
    b.addEventListener("click", () => {
      if (b.dataset.mode === settings.mode) return;
      // 모드 전환 시 금액도 환산
      const cur = digitsOnly(payInput.value);
      setMode(b.dataset.mode);
      if (cur) payInput.value = comma(b.dataset.mode === "monthly" ? Math.round(cur / 12) : cur * 12);
      updateSetup();
    })
  );
  $("#payQuick").addEventListener("click", (e) => {
    const q = e.target.closest("[data-q]");
    if (!q) return;
    payInput.value = comma(Number(q.dataset.q));
    haptic(8);
    updateSetup();
  });
  payInput.addEventListener("input", () => {
    const n = digitsOnly(payInput.value);
    payInput.value = n ? comma(n) : "";
    updateSetup();
  });
  nontaxInput.addEventListener("input", updateSetup);
  ["#start-t", "#end-t", "#lunch-t", "#lunch-m", "#payday"].forEach((s) => $(s).addEventListener("change", updateSetup));
  $("#days").addEventListener("click", (e) => {
    const b = e.target.closest("[data-day]");
    if (!b) return;
    const d = Number(b.dataset.day);
    settings.days = settings.days.includes(d) ? settings.days.filter((x) => x !== d) : [...settings.days, d].sort();
    b.setAttribute("aria-pressed", String(settings.days.includes(d)));
    updateSetup();
  });
  $("#go").addEventListener("click", () => {
    store.set("settings", settings);
    if (!meet.avg) meet.avg = Math.round(annualOf(settings) / 10000);
    openApp();
    toast("설정을 저장했어요. 다음엔 바로 카운터가 열려요");
  });
  $("#toCounter").addEventListener("click", () => {
    store.set("settings", settings);
    openApp();
  });
}

// 공용 스테퍼
function bindSteppers() {
  $$("[data-stepper]").forEach((wrap) => {
    const key = wrap.dataset.stepper;
    const min = Number(wrap.dataset.min);
    const max = Number(wrap.dataset.max);
    wrap.addEventListener("click", (e) => {
      const b = e.target.closest("[data-step]");
      if (!b) return;
      const out = wrap.querySelector("output");
      const v = Math.min(max, Math.max(min, Number(out.textContent) + Number(b.dataset.step)));
      out.textContent = v;
      haptic(6);
      if (key === "people") {
        meet.people = v;
        saveMeet();
        renderMeet();
      } else {
        settings[key] = v;
        if (key === "dependents" && settings.children > v - 1) {
          settings.children = Math.max(0, v - 1);
          $("#children").textContent = settings.children;
        }
        if (key === "children" && v > settings.dependents - 1) {
          settings.dependents = v + 1;
          $("#dependents").textContent = settings.dependents;
        }
        updateSetup();
      }
    });
  });
}

/* =========================================================
 * 오늘 기록 (월급루팡 / 회의) + 어제 기록
 * ========================================================= */
function emptyToday() {
  return { date: todayKey(), toilet: 0, coffee: 0, slack: 0, meeting: 0, active: null };
}
let today = store.get("today") || emptyToday();

function rollover() {
  if (today.date === todayKey()) return;
  // 지난 기록은 날짜별 로그로 남긴다 (어제의 나와 비교)
  const log = store.get("log", {});
  if (today.active) {
    today[today.active.cat] += Math.max(0, (Date.now() - today.active.since) / 1000);
  }
  const sec = today.toilet + today.coffee + today.slack;
  log[today.date] = { lupang: Math.round(sec) };
  const keys = Object.keys(log).sort().slice(-14);
  store.set("log", Object.fromEntries(keys.map((k) => [k, log[k]])));
  today = emptyToday();
  store.set("today", today);
}

function lupangSec(cat, now = Date.now()) {
  let s = today[cat] || 0;
  if (today.active?.cat === cat) s += (now - today.active.since) / 1000;
  return s;
}
const lupangTotal = (now = Date.now()) => LUPANG.reduce((a, l) => a + lupangSec(l.key, now), 0);

function toggleLupang(cat) {
  rollover();
  const now = Date.now();
  const prev = today.active?.cat;
  if (today.active) {
    today[prev] += (now - today.active.since) / 1000;
    today.active = null;
  }
  if (prev !== cat) {
    today.active = { cat, since: now };
    const item = LUPANG.find((l) => l.key === cat);
    toast(`${item.emoji} ${item.name} 타이머 시작! 돈은 계속 벌려요`);
  }
  haptic(12);
  store.set("today", today);
  renderLupangButtons();
}

function renderLupangButtons() {
  $("#lupang").innerHTML = LUPANG.map(
    (l) => `<button class="lupang__btn ${today.active?.cat === l.key ? "is-on" : ""}" data-cat="${l.key}" aria-pressed="${today.active?.cat === l.key}">
      <span class="e" aria-hidden="true">${l.emoji}</span><span class="n">${l.name}</span><span class="v" data-v="${l.key}">0분</span>
    </button>`
  ).join("");
  const log = store.get("log", {});
  const yKey = todayKey(new Date(Date.now() - 86400000));
  const y = log[yKey];
  $("#lupangYesterday").textContent = y ? `어제의 나는 ${minText(y.lupang)} 루팡했어요.` : "";
}

/* =========================================================
 * 회의 비용 타이머
 * ========================================================= */
let meet = { people: 5, avg: 0, running: false, startedAt: 0, acc: 0, ...(store.get("meet") || {}) };
const saveMeet = () => store.set("meet", meet);
const meetElapsed = (now = Date.now()) => meet.acc + (meet.running ? (now - meet.startedAt) / 1000 : 0);
const meetPerSec = () => (meet.people * (meet.avg || 0) * 10000) / (12 * 209 * 3600);

function renderMeet() {
  const sec = meetElapsed();
  const cost = sec * meetPerSec();
  $("#meetNum").textContent = won(cost);
  $("#meetSub").textContent = `${hms(sec)} · 1분에 ${won(meetPerSec() * 60)}`;
  $("#meetToggle").textContent = meet.running ? "회의 끝" : sec > 0 ? "이어서 시작" : "회의 시작";
  $("#meetToggle").classList.toggle("btn--danger", meet.running);
  $("#meetToggle").classList.toggle("btn--primary", !meet.running);
  $(".meet__board").classList.toggle("is-on", meet.running);
}

function stopMeet() {
  if (!meet.running) return;
  const add = (Date.now() - meet.startedAt) / 1000;
  meet.acc += add;
  meet.running = false;
  rollover();
  today.meeting += add;
  store.set("today", today);
}

function bindMeet() {
  $("#people").textContent = meet.people;
  const avgInput = $("#meetAvg");
  avgInput.value = meet.avg ? comma(meet.avg) : "";
  avgInput.placeholder = settings.pay ? comma(Math.round(annualOf(settings) / 10000)) : "5,000";
  avgInput.addEventListener("input", () => {
    const n = digitsOnly(avgInput.value);
    avgInput.value = n ? comma(n) : "";
    meet.avg = n;
    saveMeet();
    renderMeet();
  });
  $("#meetToggle").addEventListener("click", () => {
    if (!meet.avg) {
      meet.avg = Math.round(annualOf(settings) / 10000) || 5000;
      avgInput.value = comma(meet.avg);
    }
    if (meet.running) {
      stopMeet();
      toast(`이번 회의 비용은 약 ${won(meetElapsed() * meetPerSec())}이에요`);
    } else {
      meet.running = true;
      meet.startedAt = Date.now();
    }
    haptic(15);
    saveMeet();
    renderMeet();
  });
  $("#meetReset").addEventListener("click", () => {
    stopMeet();
    meet.acc = 0;
    saveMeet();
    renderMeet();
  });
  $("#meetShare").addEventListener("click", () => {
    const sec = Math.round(meetElapsed());
    if (sec < 1) return toast("회의를 시작하면 비용을 공유할 수 있어요");
    const cost = Math.round(sec * meetPerSec());
    share({
      title: "회의 비용 타이머",
      text: `방금 ${meet.people}명이 ${minText(sec) === "0분" ? `${sec}초` : minText(sec)} 회의했어요. 인건비로 약 ${won(cost)} 썼어요 💸`,
      url: urlWith({ m: encodeState({ n: meet.people, s: sec, c: cost }) }),
    });
  });
}

/* =========================================================
 * 실시간 카운터
 * ========================================================= */
const liveNum = $("#liveNum");
let lastHundreds = -1;
let lastSecondTick = -1;
let rafId = 0;

function spawnFall(kind) {
  if (prefersReducedMotion() || document.hidden) return;
  const layer = $("#coins");
  if (layer.childElementCount > 14) return;
  const el = document.createElement("span");
  el.className = `fall fall--${kind}`;
  el.textContent = kind === "bill" ? "1,000" : "100";
  el.style.left = `${10 + Math.random() * 76}%`;
  el.style.setProperty("--rot", `${Math.round((Math.random() - 0.5) * 540)}deg`);
  layer.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

function monthToDate(now, sch, todayEarned) {
  // 이번 달 1일부터 어제까지의 근무일 × 하루 실수령 + 오늘
  const daily = dailyWorkSeconds(sch) * ps;
  let days = 0;
  for (let d = 1; d < now.getDate(); d++) {
    if (sch.days.includes(new Date(now.getFullYear(), now.getMonth(), d).getDay())) days++;
  }
  return days * daily + todayEarned;
}

function setLiveNumber(value, live) {
  const int = Math.floor(value);
  const frac = Math.floor((value - int) * 100);
  const intText = comma(int);
  liveNum.classList.toggle("is-long", intText.length > 8);
  liveNum.classList.toggle("is-work", live);
  liveNum.innerHTML = live
    ? `${intText}<span class="live__frac">.${pad2(frac)}</span><span class="live__won">원</span>`
    : `${intText}<span class="live__won">원</span>`;
}

function tick() {
  rafId = requestAnimationFrame(tick);
  const now = new Date();
  const sch = schedule();
  const phase = workPhase(now, sch);
  const nowSec = nowSecOf(now);
  const worked = phase === "off" ? 0 : workedSecondsAt(nowSec, sch);
  const earned = worked * ps;

  if (phase === "work") {
    setLiveNumber(earned, true);
    const hundreds = Math.floor(earned / 100);
    if (lastHundreds >= 0 && hundreds > lastHundreds) {
      spawnFall(Math.floor(earned / 1000) > Math.floor(lastHundreds / 10) ? "bill" : "coin");
    }
    lastHundreds = hundreds;
  } else {
    lastHundreds = -1;
  }

  // 미루팡 / 회의 등은 1초에 4번이면 충분
  const q = Math.floor(performance.now() / 250);
  if (q === lastSecondTick) return;
  lastSecondTick = q;
  rollover();
  renderSlow(now, phase, worked, earned, sch);
}

function renderSlow(now, phase, worked, earned, sch) {
  const status = $("#status");
  const label = $("#liveLabel");
  const sub = $("#liveSub");
  status.className = `live__status t-label-02 ${phase === "work" ? "is-work" : ""}`;
  $("#clock").textContent = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
  const nextStart = nextWorkStart(now, sch);
  const untilNext = nextStart ? (nextStart - now) / 1000 : 0;
  const nextLabel = nextStart && daysBetween(now, nextStart) === 1 ? "내일 출근까지" : "다음 출근까지";

  if (phase === "work") {
    status.textContent = "근무 중";
    label.textContent = "오늘 번 돈";
    sub.textContent = `1초에 ${ps.toFixed(1)}원 · 퇴근까지 ${hms(toMin(sch.end) * 60 - nowSecOf(now))}`;
  } else if (phase === "lunch") {
    status.textContent = "점심시간 🍚";
    label.textContent = "오늘 번 돈 · 휴게시간엔 잠깐 멈춰요";
    setLiveNumber(earned, false);
    sub.textContent = `오후 근무까지 ${hms((toMin(sch.lunchStart) + Number(sch.lunchMin)) * 60 - nowSecOf(now))}`;
  } else if (phase === "before") {
    status.textContent = "출근 전 ☀️";
    label.textContent = "오늘 번 돈";
    setLiveNumber(0, false);
    sub.textContent = `출근까지 ${hms(toMin(sch.start) * 60 - nowSecOf(now))} · 출근하면 카운터가 움직여요`;
  } else if (phase === "after") {
    status.textContent = "퇴근했어요 🎉";
    label.textContent = "오늘 총 번 돈";
    setLiveNumber(earned, false);
    sub.textContent = `${nextLabel} ${hms(untilNext)}`;
  } else {
    status.textContent = "쉬는 날 🛋️";
    label.textContent = "이번 달 지금까지 번 돈 (근사치)";
    setLiveNumber(monthToDate(now, sch, 0), false);
    sub.textContent = `${nextLabel} ${hms(untilNext)}`;
  }

  // 진행률
  const total = dailyWorkSeconds(sch);
  const pct = phase === "off" ? 0 : Math.min(100, (worked / total) * 100);
  $("#progress").style.width = `${pct}%`;
  $("#pPct").textContent = phase === "off" ? "오늘은 휴무" : `${pct.toFixed(1)}%`;
  $("#pStart").textContent = sch.start;
  $("#pEnd").textContent = sch.end;

  // 변환기
  const pay = nextPayday(now, settings.payday);
  const dday = pay ? daysBetween(now, pay) : 0;
  const coffeeMin = COFFEE / ps / 60;
  const lunchMin = LUNCH / ps / 60;
  const workHourNet = ps * 3600;
  const conv = [
    ["🚽", `${won(ps * 300)}`, "화장실 5분"],
    ["☕", `${coffeeMin < 10 ? coffeeMin.toFixed(1) : Math.round(coffeeMin)}분 노동`, `커피 한 잔 (${comma(COFFEE)}원)`],
    ["🍱", `${lunchMin < 10 ? lunchMin.toFixed(1) : Math.round(lunchMin)}분 노동`, `점심 한 끼 (${comma(LUNCH)}원)`],
    ["📅", dday === 0 ? "오늘 월급날! 🎉" : `D-${dday}`, pay ? `월급날 ${pay.getMonth() + 1}월 ${pay.getDate()}일 (${DAY_NAMES[pay.getDay()]})` : "월급날"],
    ["⏱️", won(workHourNet), "체감 시급 (실수령·실근무)"],
    ["🗓️", fmt.wonKo(Math.round(monthToDate(now, sch, earned) / 100) * 100), "이번 달 누적 (근사치)"],
  ];
  $("#conv").innerHTML = conv
    .map(
      ([e, v, l]) =>
        `<div class="conv__item"><span class="conv__emoji" aria-hidden="true">${e}</span><span class="conv__val">${v}</span><span class="conv__label">${l}</span></div>`
    )
    .join("");

  // 월급루팡
  const nowMs = now.getTime();
  LUPANG.forEach((l) => {
    const el = document.querySelector(`[data-v="${l.key}"]`);
    if (el) el.textContent = `${hms(lupangSec(l.key, nowMs))}`;
  });
  const totalLupang = lupangTotal(nowMs);
  $("#lupangBadge").textContent = `오늘 ${minText(totalLupang)} · ${won(totalLupang * ps)}`;
  const nowBox = $(".lupang__now");
  if (today.active) {
    const item = LUPANG.find((l) => l.key === today.active.cat);
    nowBox.classList.add("is-on");
    $("#lupangNowLabel").textContent = `${item.emoji} ${item.name} 중 · +${won(((nowMs - today.active.since) / 1000) * ps)}`;
    $("#lupangNow").textContent = hms((nowMs - today.active.since) / 1000);
  } else {
    nowBox.classList.remove("is-on");
    $("#lupangNowLabel").textContent = "버튼을 누르면 타이머가 켜져요";
    $("#lupangNow").textContent = "00:00";
  }

  renderMeet();
}

function renderSummary() {
  if (!result) return;
  const items = [
    ["월 실수령액", won(result.monthlyNet)],
    ["연 실수령액", `${comma(Math.round(result.annualNet / 1e4))}만 원`],
    ["월 공제 합계", won(result.deductions)],
    ["세전 시급 (209시간)", won(result.hourlyGross)],
  ];
  $("#sumGrid").innerHTML = items.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join("");
}

function openApp() {
  recompute();
  showView("app");
  renderSummary();
  renderLupangButtons();
  if (!meet.avg) {
    meet.avg = Math.round(annualOf(settings) / 10000);
    saveMeet();
  }
  $("#meetAvg").value = meet.avg ? comma(meet.avg) : "";
  cancelAnimationFrame(rafId);
  lastSecondTick = -1;
  tick();
}

function openSetup() {
  cancelAnimationFrame(rafId);
  fillSetup();
  $("#toCounter").hidden = !store.get("settings");
  showView("setup");
}

/* =========================================================
 * 월급루팡 영수증 (공유 이미지)
 * ========================================================= */
function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function receiptData(now = new Date()) {
  const sch = schedule();
  const phase = workPhase(now, sch);
  const worked = phase === "off" ? 0 : workedSecondsAt(nowSecOf(now), sch);
  const ms = now.getTime();
  const items = LUPANG.map((l) => ({ ...l, sec: lupangSec(l.key, ms) }));
  const meetingSec = today.meeting + (meet.running ? (ms - meet.startedAt) / 1000 : 0);
  return { now, worked, earned: worked * ps, items, meetingSec };
}

function receiptComment(ratio) {
  if (ratio <= 0) return "오늘은 성실 그 자체였어요 👏";
  if (ratio < 0.05) return "적당한 숨 고르기, 아주 좋아요 ☕";
  if (ratio < 0.15) return "프로 월급루팡러의 하루 😎";
  return "전설의 월급루팡 등장 🏆";
}

function drawReceipt(d) {
  const W = 540;
  const H = 675;
  const { canvas, ctx } = createCanvas(W, H, 2);
  const bg = css("--color-bg") || "#0a0c10";
  const brand = css("--brand") || "#2bd47d";
  const paper = css("--gray-50") || "#f7f8fa";
  const ink = css("--gray-900") || "#12151b";
  const sub = css("--gray-500") || "#7b8494";
  const deep = css("--brand-pressed") || "#1fb86a";

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, 120, 10, W / 2, 120, 420);
  g.addColorStop(0, brand + "40");
  g.addColorStop(1, "transparent");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 종이 (위아래 톱니)
  const px = 78;
  const pw = W - px * 2;
  const py = 36;
  const ph = H - 96;
  const tooth = 10;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;
  ctx.beginPath();
  ctx.moveTo(px, py + tooth);
  for (let x = px; x < px + pw; x += tooth * 2) {
    ctx.lineTo(x + tooth, py);
    ctx.lineTo(Math.min(x + tooth * 2, px + pw), py + tooth);
  }
  ctx.lineTo(px + pw, py + ph - tooth);
  for (let x = px + pw; x > px; x -= tooth * 2) {
    ctx.lineTo(x - tooth, py + ph);
    ctx.lineTo(Math.max(x - tooth * 2, px), py + ph - tooth);
  }
  ctx.closePath();
  ctx.fillStyle = paper;
  ctx.fill();
  ctx.restore();

  const L = px + 28;
  const R = px + pw - 28;
  let y = py + 54;
  const text = (t, x, yy, { size = 15, weight = 500, color = ink, align = "left" } = {}) => {
    ctx.font = `${weight} ${size}px ${CANVAS_FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(t, x, yy);
  };
  const dash = (yy) => {
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = sub;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(L, yy);
    ctx.lineTo(R, yy);
    ctx.stroke();
    ctx.restore();
  };

  text("월급루팡 영수증", W / 2, y, { size: 26, weight: 800, align: "center" });
  y += 26;
  text("RECEIPT · 실시간 월급 카운터", W / 2, y, { size: 12, color: sub, align: "center" });
  y += 22;
  const n = d.now;
  text(
    `${n.getFullYear()}.${pad2(n.getMonth() + 1)}.${pad2(n.getDate())} (${DAY_NAMES[n.getDay()]}) ${pad2(n.getHours())}:${pad2(n.getMinutes())}`,
    W / 2,
    y,
    { size: 13, color: sub, align: "center" }
  );
  y += 20;
  dash(y);
  y += 26;
  text("품목", L, y, { size: 12, color: sub });
  text("시간", L + 190, y, { size: 12, color: sub, align: "right" });
  text("금액", R, y, { size: 12, color: sub, align: "right" });
  y += 12;
  const line = (label, sec, amount, opt = {}) => {
    y += 28;
    text(label, L, y, { size: 16, weight: 600, ...opt });
    text(minText(sec), L + 190, y, { size: 14, color: sub, align: "right" });
    text(won(amount), R, y, { size: 16, weight: 600, align: "right", ...opt });
  };
  line("💼 근무", d.worked, d.earned);
  d.items.forEach((it) => line(`${it.emoji} ${it.name}`, it.sec, it.sec * ps));
  line("🗓️ 회의 (내 몫)", d.meetingSec, d.meetingSec * ps);
  y += 22;
  dash(y);

  const lupangSecSum = d.items.reduce((a, it) => a + it.sec, 0);
  const lupangWon = lupangSecSum * ps;
  const ratio = d.worked > 0 ? Math.min(1, lupangSecSum / d.worked) : 0;
  y += 34;
  text("오늘 번 돈", L, y, { size: 15, weight: 600 });
  text(won(d.earned), R, y, { size: 20, weight: 800, align: "right" });
  y += 36;
  text("그중 월급루팡 수익", L, y, { size: 15, weight: 700, color: deep });
  text(won(lupangWon), R, y, { size: 26, weight: 800, color: deep, align: "right" });
  y += 26;
  text(`루팡률 ${(ratio * 100).toFixed(1)}% · ${minText(lupangSecSum)}`, R, y, { size: 13, color: sub, align: "right" });
  y += 20;
  dash(y);
  y += 32;
  text(receiptComment(ratio), W / 2, y, { size: 16, weight: 700, align: "center" });

  // 바코드 (날짜로 고정된 무늬)
  const rand = seededRandom(todayKey(n));
  y += 22;
  let bx = L + 20;
  ctx.fillStyle = ink;
  while (bx < R - 20) {
    const w = 1 + Math.floor(rand() * 3);
    if (rand() > 0.35) ctx.fillRect(bx, y, w, 40);
    bx += w + 1 + Math.floor(rand() * 2);
  }
  y += 58;
  text("감사합니다. 내일도 무사히 출근하세요 :)", W / 2, y, { size: 12, color: sub, align: "center" });

  text("2026 요율 기준 근사치 · 실시간 월급 카운터", W / 2, H - 24, { size: 13, color: css("--color-text-tertiary") || sub, align: "center" });
  return canvas;
}

let receiptCanvas = null;
function openReceipt() {
  rollover();
  const d = receiptData();
  receiptCanvas = drawReceipt(d);
  const img = new Image();
  img.alt = "오늘의 월급루팡 영수증";
  img.src = receiptCanvas.toDataURL("image/png");
  const paper = $("#receiptPaper");
  paper.innerHTML = "";
  paper.appendChild(img);
  paper.classList.remove("is-print");
  void paper.offsetWidth;
  paper.classList.add("is-print");
  haptic([10, 40, 10, 40, 10]);
  openSheet($("#receiptSheet"));
}

function bindReceipt() {
  $("#lupang").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cat]");
    if (b) toggleLupang(b.dataset.cat);
  });
  $("#receiptBtn").addEventListener("click", openReceipt);
  $("#receiptShare").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.classList.add("is-loading");
    try {
      await shareImage(receiptCanvas, {
        filename: `월급루팡-영수증-${todayKey()}.png`,
        text: "오늘의 월급루팡 영수증 🧾 너는 오늘 얼마나 루팡했어?",
      });
    } finally {
      btn.classList.remove("is-loading");
    }
  });
  $("#receiptLink").addEventListener("click", () => {
    const d = receiptData();
    const sec = Math.round(d.items.reduce((a, it) => a + it.sec, 0));
    share({
      title: "월급루팡 영수증",
      text: `오늘 나는 ${minText(sec)} 월급루팡했어요 🧾 너는?`,
      url: urlWith({ r: encodeState({ s: sec, w: Math.round(sec * ps), m: Math.round(d.meetingSec) }) }),
    });
  });
}

/* =========================================================
 * 공유받은 링크
 * ========================================================= */
function sharedBanner() {
  const banner = $("#sharedBanner");
  const r = getParam("r") && decodeState(getParam("r"));
  const m = getParam("m") && decodeState(getParam("m"));
  if (r && Number.isFinite(r.s)) {
    banner.innerHTML = `<span class="shared-banner__emoji">🧾</span><span>친구는 오늘 <b>${minText(r.s)}</b> 월급루팡해서 <b>${won(r.w || 0)}</b> 벌었대요. 내 루팡 수익도 계산해 볼까요?</span>`;
    banner.hidden = false;
    return true;
  }
  if (m && Number.isFinite(m.c)) {
    banner.innerHTML = `<span class="shared-banner__emoji">🗓️</span><span>${m.n}명이 ${minText(m.s)} 회의하는 데 인건비 <b>${won(m.c)}</b>이 들었대요. 우리 회의는 얼마일까요?</span>`;
    banner.hidden = false;
    return true;
  }
  return false;
}

/* =========================================================
 * 홈 화면 추가
 * ========================================================= */
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  $("#installBtn").hidden = false;
  $("#installHow").textContent = "추가 버튼을 누르면 앱처럼 바로 카운터가 열려요.";
});
$("#installBtn").addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice.catch(() => null);
  deferredPrompt = null;
  $("#installBtn").hidden = true;
});
if (matchMedia("(display-mode: standalone)").matches) $("#installTip").hidden = true;

/* =========================================================
 * SEO 표 (calc.js로 다시 계산해 HTML과 같은 값을 보장)
 * ========================================================= */
function renderSeoTable() {
  const label = (a) => (a >= 1e8 ? `${a / 1e8}억 원` : `${comma(a / 1e4)}만 원`);
  $("#salaryTable").innerHTML = salaryTable()
    .map(
      (r) =>
        `<tr><th scope="row">${label(r.annual)}</th><td>${comma(r.monthlyNet)}원</td><td>${comma(r.deductions)}원</td><td>${comma(r.annualNet)}원</td></tr>`
    )
    .join("");
}

/* =========================================================
 * 시작
 * ========================================================= */
function init() {
  renderSeoTable();
  renderMoreSites($("#more"), "salary-live");
  bindSteppers();
  bindSetup();
  bindMeet();
  bindReceipt();
  rollover();

  $("#editBtn").addEventListener("click", openSetup);
  $("#editBtn2").addEventListener("click", openSetup);
  $("#shareBtn").addEventListener("click", () =>
    share({
      title: "실시간 월급 카운터",
      text: "지금 이 순간 버는 돈이 1초마다 올라가요 💸 화장실 5분은 얼마일까?",
      url: urlWith({}),
    })
  );

  const hasShared = sharedBanner();
  const saved = store.get("settings");
  recompute();

  // 저장된 설정이 있으면 위젯처럼 바로 카운터 (공유 링크로 들어온 경우는 인트로부터)
  if (saved && result && !hasShared) {
    openApp();
    return;
  }
  const intro = runIntro({ root: $("#intro"), scenes: introScenes() });
  $("#start").addEventListener("click", () => {
    intro.stop();
    if (saved && result) openApp();
    else openSetup();
  });
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) lastSecondTick = -1;
});

init();
