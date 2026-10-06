// 미니게임 5종 + 공통 화면(설명, 3-2-1 카운트다운, 게임 기록)
// 모든 게임은 play(area, signal) → Promise<result> 형태. signal 이 abort 되면 AbortError 로 끝난다.
import { haptic, fmt } from "../shared/kit.js";
import { META, ageFor, ageBand } from "./scoring.js";
import { Scope, WAVES } from "./instrument.js";

/* ---------- 공통 유틸 ---------- */
export const abortErr = () => new DOMException("aborted", "AbortError");

export function wait(ms, signal) {
  return new Promise((res, rej) => {
    if (signal?.aborted) return rej(abortErr());
    const t = setTimeout(res, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        rej(abortErr());
      },
      { once: true }
    );
  });
}

// 콜백 기반 이벤트를 Promise 로. onAbort 시 정리.
function until(signal, setup) {
  return new Promise((res, rej) => {
    if (signal?.aborted) return rej(abortErr());
    let cleanup = () => {};
    const done = (v) => {
      cleanup();
      res(v);
    };
    cleanup = setup(done) || (() => {});
    signal?.addEventListener(
      "abort",
      () => {
        cleanup();
        rej(abortErr());
      },
      { once: true }
    );
  });
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(r));
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

/* ---------- 오디오 (청력 테스트) ---------- */
let audio = null;
export function ensureAudio() {
  try {
    if (!audio) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audio = new AC();
    }
    if (audio.state === "suspended") audio.resume();
    return audio;
  } catch {
    return null;
  }
}

// 귀 보호를 위해 진폭 상한을 낮게 고정 (-24 dBFS 정도)
const MAX_GAIN = 0.06;

// 클릭 잡음이 없도록 페이드 인/아웃. gain 0 이면 무음(가짜 문제).
function tone(freq, { gain = MAX_GAIN, dur = 1.5 } = {}) {
  const ac = ensureAudio();
  if (!ac) return { stop() {} };
  const g = ac.createGain();
  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.value = freq;
  const v = Math.min(gain, MAX_GAIN);
  const t = ac.currentTime + 0.03;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(v, t + 0.15);
  g.gain.setValueAtTime(v, t + dur - 0.15);
  g.gain.linearRampToValueAtTime(0, t + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
  let stopped = false;
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      try {
        const n = ac.currentTime;
        g.gain.cancelScheduledValues(n);
        g.gain.setValueAtTime(g.gain.value, n);
        g.gain.linearRampToValueAtTime(0, n + 0.06);
        osc.stop(n + 0.08);
      } catch {
        /* 이미 끝남 */
      }
    },
  };
}

export function playReference() {
  ensureAudio();
  tone(1000, { gain: MAX_GAIN, dur: 1.2 });
}

/* ---------- 설명 화면 ---------- */
export const HOWTO = {
  rt: {
    lead: "화면이 초록색으로 바뀌는 순간, 최대한 빨리 탭하세요.",
    lines: ["5번 재고 가장 느린 1번은 빼요", "초록색 전에 누르면 다시 하고 +30ms", "약 20초"],
  },
  mem: {
    lead: "불이 들어오는 칸의 순서를 기억했다가 그대로 눌러요.",
    lines: ["맞힐 때마다 순서가 한 칸씩 길어져요", "기회는 2번이에요", "약 30초"],
  },
  color: {
    lead: "색이 살짝 다른 칸 하나를 찾아 탭하세요.",
    lines: ["단계가 오를수록 칸은 많아지고 차이는 작아져요", "틀리면 2초가 줄어요", "30초"],
  },
  hear: {
    lead: "점점 높아지는 소리가 들리는지 답해요.",
    lines: ["8kHz에서 19kHz까지 올라가요", "중간에 소리가 없는 문제도 섞여 있어요", "약 30초"],
  },
  math: {
    lead: "나오는 계산 문제를 숫자 패드로 빠르게 풀어요.",
    lines: ["정답을 다 누르면 자동으로 넘어가요", "어려우면 패스해도 돼요", "30초"],
  },  dyn: {
    lead: "두 자리 숫자판이 화면을 휙 지나가요. 무슨 숫자였는지 골라요.",
    lines: ["맞힐 때마다 점점 빨라져요", "방향과 높이는 매번 바뀌어요", "두 번 틀리면 끝"],
  },
};

export function howTo(area, key, signal) {
  const m = META[key];
  const h = HOWTO[key];
  const hear = key === "hear";
  area.innerHTML = `
    <div class="howto fade-swap">
      <div class="plate" aria-hidden="true">
        <div class="plate__top"><span class="plate__code mono">${m.code}</span><span class="plate__bar"></span></div>
        <div class="plate__scope rt__scope"><canvas></canvas></div>
      </div>
      <h2 class="t-title-01 howto__title">${m.name}</h2>
      <p class="t-body-01 t-secondary howto__lead">${h.lead}</p>
      <ul class="howto__list">${h.lines.map((l) => `<li class="t-body-03">${l}</li>`).join("")}</ul>
      ${
        hear
          ? `<div class="howto__warn" role="note">
              <p class="t-label-02">먼저 볼륨을 중간 이하로 맞춰주세요</p>
              <p class="t-caption-01">기준음을 듣고 편안한 크기로 조절해요. 이어폰을 쓰면 더 정확하고, 스마트폰 스피커는 높은 소리를 잘 못 내기도 해요.</p>
            </div>`
          : ""
      }
      <div class="howto__cta">
        ${hear ? `<button class="btn btn--outline btn--block" data-act="ref">기준음 들어보기 (1kHz)</button>` : ""}
        <button class="btn btn--primary btn--lg btn--block" data-act="go">시작하기</button>
        ${hear ? `<button class="btn btn--ghost btn--block" data-act="skip">이번엔 건너뛰기</button>` : ""}
      </div>
    </div>`;
  const life = new AbortController();
  signal.addEventListener("abort", () => life.abort(), { once: true });
  const sc = new Scope(area.querySelector(".plate__scope canvas"), { period: 1500, gain: 0.4 });
  sc.setWave(WAVES[key]);
  sc.start(life.signal);
  return until(signal, (done0) => {
    const done = (v) => {
      life.abort();
      done0(v);
    };
    const box = area.querySelector(".howto__cta");
    const onClick = (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      if (b.dataset.act === "ref") {
        playReference();
        return;
      }
      if (b.dataset.act === "go" && hear && !ensureAudio()) {
        done("skip");
        return;
      }
      done(b.dataset.act);
    };
    box.addEventListener("click", onClick);
    return () => box.removeEventListener("click", onClick);
  });
}

/* ---------- 3-2-1 ---------- */
export async function countdown(area, signal) {
  area.innerHTML = `<div class="count"><span class="count__num t-num" aria-live="assertive">3</span><p class="t-body-02 t-secondary">준비하세요</p></div>`;
  const num = area.querySelector(".count__num");
  for (const n of [3, 2, 1]) {
    num.textContent = n;
    num.classList.remove("is-pop");
    void num.offsetWidth;
    num.classList.add("is-pop");
    haptic(8);
    await wait(650, signal);
  }
}

/* ---------- 게임 하나 끝난 뒤 ---------- */
export function doneScreen(area, key, res, { nextName, isBest }, signal) {
  const m = META[key];
  const skipped = res.raw == null;
  const age = skipped ? null : Math.round(ageFor(key, res.raw));
  let note = "";
  if (key === "rt" && res.falseStarts) note = `너무 빨리 누른 ${res.falseStarts}번은 페널티로 반영했어요.`;
  if (key === "hear" && res.unsure) note = "소리가 없는 문제에서 '들려요'를 눌러서, 청력 점수는 절반만 반영해요.";
  if (key === "hear" && skipped) note = "청력은 빼고 나머지 4개로 계산해요.";
  if (key === "math") note = `${res.tried}문제 중 ${res.raw}문제 맞혔어요.`;
  area.innerHTML = `
    <div class="done fade-swap">
      <div class="readout">
        <p class="readout__k mono"><span>${m.code} ${m.name}</span><span>${skipped ? "SKIP" : "OK"}</span></p>
        <p class="readout__v mono t-num">${skipped ? "건너뜀" : m.fmt(res.raw)}</p>
      </div>
      ${isBest ? `<span class="badge">개인 최고 기록 갱신</span>` : ""}
      ${age != null ? `<p class="t-body-01">재미로 보면 <b class="t-primary">${ageBand(age)}</b> 수준이에요</p>` : ""}
      ${note ? `<p class="t-body-03 t-secondary">${note}</p>` : ""}
      <button class="btn btn--primary btn--lg btn--block done__next" data-act="next">${nextName ? `다음: ${nextName}` : "결과 보기"}</button>
    </div>`;
  return until(signal, (done) => {
    const b = area.querySelector(".done__next");
    const onClick = () => done();
    b.addEventListener("click", onClick);
    return () => b.removeEventListener("click", onClick);
  });
}

/* ---------- 타이머 막대 (색 구분 / 계산) ---------- */
function timerBar(el, totalMs, signal) {
  let end = performance.now() + totalMs;
  let raf;
  let finish;
  const promise = new Promise((res) => (finish = res));
  const tick = (now) => {
    const left = Math.max(0, end - now);
    el.style.transform = `scaleX(${left / totalMs})`;
    el.classList.toggle("is-low", left < 5000);
    if (left <= 0 || signal.aborted) return finish();
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  signal.addEventListener("abort", () => cancelAnimationFrame(raf), { once: true });
  return {
    done: promise,
    penalty(ms) {
      end -= ms;
    },
  };
}

/* ========== 1. 반응속도 ========== */
const RT_TRIALS = 5;
const RT_PENALTY = 30;
const RT_MIN = 100; // 100ms 미만은 예측해서 누른 것으로 보고 실수 처리

async function playReaction(area, signal) {
  area.innerHTML = `
    <div class="rt">
      <div class="rt__scope" aria-hidden="true">
        <canvas></canvas>
        <span class="rt__ch mono">CH1 · TRIG</span>
        <span class="rt__dots">${Array.from({ length: RT_TRIALS }, () => `<span></span>`).join("")}</span>
      </div>
      <button class="rt__pad" type="button"><span class="rt__big"></span><span class="rt__small"></span></button>
    </div>`;
  const pad = area.querySelector(".rt__pad");
  const big = area.querySelector(".rt__big");
  const small = area.querySelector(".rt__small");
  const dots = [...area.querySelectorAll(".rt__dots span")];
  const scope = new Scope(area.querySelector(".rt__scope canvas"), { period: 1600, gain: 0.4 });
  scope.start(signal);
  const set = (state, a, b = "") => {
    pad.dataset.state = state;
    big.textContent = a;
    small.textContent = b;
  };
  let onTap = null;
  const tap = (ts) => {
    if (onTap) {
      const f = onTap;
      onTap = null;
      f(ts);
    }
  };
  const down = (e) => {
    e.preventDefault();
    scope.mark(pad.dataset.state === "go" ? 0.95 : 0.45);
    tap(e.timeStamp);
  };
  const key = (e) => {
    if (e.code === "Space" || e.code === "Enter") {
      e.preventDefault();
      tap(e.timeStamp);
    }
  };
  pad.addEventListener("pointerdown", down);
  document.addEventListener("keydown", key);
  signal.addEventListener(
    "abort",
    () => {
      document.removeEventListener("keydown", key);
    },
    { once: true }
  );
  const waitTap = () => until(signal, (done) => ((onTap = done), () => (onTap = null)));

  const times = [];
  let falseStarts = 0;
  try {
    while (times.length < RT_TRIALS) {
      set("wait", "기다리세요…", "초록색이 되면 바로 탭!");
      const delay = 1100 + Math.random() * 2200;
      const r = await Promise.race([wait(delay, signal).then(() => "go"), waitTap().then(() => "early")]);
      onTap = null;
      if (r === "early") {
        falseStarts++;
        haptic([30, 40, 30]);
        set("early", "너무 빨라요!", `+${RT_PENALTY}ms · 다시 해요`);
        await wait(1100, signal);
        continue;
      }
      set("go", "지금 탭!", "");
      const t0 = await nextFrame(); // 초록색이 그려지는 프레임 시각
      const ts = await waitTap();
      const rt = Math.round(ts - t0);
      if (rt < RT_MIN) {
        falseStarts++;
        set("early", "예측 탭이에요", `+${RT_PENALTY}ms · 다시 해요`);
        await wait(1100, signal);
        continue;
      }
      times.push(rt);
      haptic(10);
      dots[times.length - 1].classList.add("is-on");
      dots[times.length - 1].textContent = "";
      set("done", `${rt}ms`, times.length < RT_TRIALS ? `${times.length}/${RT_TRIALS}` : "측정 끝!");
      await wait(850, signal);
    }
  } finally {
    document.removeEventListener("keydown", key);
  }
  const sorted = times.slice().sort((a, b) => a - b);
  const kept = sorted.slice(0, RT_TRIALS - 1); // 가장 느린 1회 제외
  const avg = kept.reduce((s, v) => s + v, 0) / kept.length;
  const raw = Math.round(avg + Math.min(falseStarts, 3) * RT_PENALTY);
  return { raw, times, falseStarts };
}

/* ========== 2. 순간기억 (3x3 사이먼) ========== */
const MEM_START = 3;
const MEM_MAX = 12;

async function playMemory(area, signal) {
  area.innerHTML = `
    <div class="mem">
      <div class="mem__head">
        <span class="t-label-01 t-num" data-len>길이 ${MEM_START}</span>
        <span class="mem__lives" aria-label="남은 기회 2번" data-lives><i class="led is-on"></i><i class="led is-on"></i></span>
      </div>
      <p class="mem__msg t-title-03" aria-live="polite">잘 보세요</p>
      <div class="mem__grid">${Array.from({ length: 9 }, (_, i) => `<button class="mem__tile" type="button" data-i="${i}" aria-label="${i + 1}번 칸"></button>`).join("")}</div>
    </div>`;
  const grid = area.querySelector(".mem__grid");
  const tiles = [...grid.children];
  const msg = area.querySelector(".mem__msg");
  const lenEl = area.querySelector("[data-len]");
  const livesEl = area.querySelector("[data-lives]");
  const nextTile = (prev) => {
    let t;
    do t = ri(0, 8);
    while (t === prev);
    return t;
  };
  const fresh = (n) => {
    const s = [];
    for (let i = 0; i < n; i++) s.push(nextTile(s[i - 1]));
    return s;
  };
  const flash = async (i, ms) => {
    tiles[i].classList.add("is-lit");
    await wait(ms, signal);
    tiles[i].classList.remove("is-lit");
  };

  let seq = fresh(MEM_START);
  let best = 0;
  let lives = 2;
  while (lives > 0 && seq.length <= MEM_MAX) {
    lenEl.textContent = `길이 ${seq.length}`;
    msg.textContent = "잘 보세요";
    grid.classList.add("is-locked");
    await wait(600, signal);
    const on = Math.max(300, 520 - seq.length * 18);
    for (const i of seq) {
      await flash(i, on);
      await wait(140, signal);
    }
    msg.textContent = "순서대로 눌러요";
    grid.classList.remove("is-locked");
    const ok = await until(signal, (done) => {
      let k = 0;
      const onDown = (e) => {
        const t = e.target.closest(".mem__tile");
        if (!t) return;
        e.preventDefault();
        const i = Number(t.dataset.i);
        t.classList.add("is-press");
        setTimeout(() => t.classList.remove("is-press"), 180);
        if (i !== seq[k]) {
          t.classList.add("is-wrong");
          setTimeout(() => t.classList.remove("is-wrong"), 500);
          return done(false);
        }
        haptic(6);
        k++;
        if (k === seq.length) done(true);
      };
      grid.addEventListener("pointerdown", onDown);
      return () => grid.removeEventListener("pointerdown", onDown);
    });
    grid.classList.add("is-locked");
    if (ok) {
      best = seq.length;
      msg.textContent = "정답! 한 칸 더";
      grid.classList.add("is-good");
      await wait(500, signal);
      grid.classList.remove("is-good");
      seq.push(nextTile(seq[seq.length - 1]));
    } else {
      lives--;
      haptic([30, 40, 30]);
      livesEl.querySelectorAll(".led").forEach((l, j) => l.classList.toggle("is-on", j < lives));
      livesEl.setAttribute("aria-label", `남은 기회 ${lives}번`);
      msg.textContent = lives ? "아쉬워요! 같은 길이로 한 번 더" : "여기까지!";
      grid.classList.add("is-shake");
      await wait(900, signal);
      grid.classList.remove("is-shake");
      if (lives) seq = fresh(seq.length);
    }
  }
  return { raw: Math.max(best, MEM_START - 1) };
}

/* ========== 3. 색 구분 ========== */
const COLOR_MS = 30000;
const gridSize = (lv) => (lv < 2 ? 2 : lv < 5 ? 3 : lv < 9 ? 4 : lv < 14 ? 5 : lv < 20 ? 6 : 7);

async function playColor(area, signal) {
  area.innerHTML = `
    <div class="cg">
      <div class="timer" aria-hidden="true"><i></i></div>
      <div class="cg__head"><span class="t-label-01 t-num" data-lv>1단계</span><span class="t-body-03 t-secondary">다른 색 하나를 찾아요</span></div>
      <div class="cg__grid"></div>
    </div>`;
  const grid = area.querySelector(".cg__grid");
  const lvEl = area.querySelector("[data-lv]");
  const timer = timerBar(area.querySelector(".timer i"), COLOR_MS, signal);
  let level = 0;
  let odd = 0;
  const render = () => {
    const n = gridSize(level);
    const h = ri(0, 359);
    const s = ri(55, 75);
    const l = ri(45, 60);
    const dl = Math.max(3, 16 - level * 0.6); // 단계가 오를수록 밝기 차이가 줄어든다
    const l2 = l + (Math.random() < 0.5 ? -dl : dl);
    odd = ri(0, n * n - 1);
    grid.style.setProperty("--n", n);
    // 게임 콘텐츠 색(일러스트 예외): 매 단계 무작위 색을 만든다
    grid.innerHTML = Array.from(
      { length: n * n },
      (_, i) => `<button class="cg__tile" type="button" data-i="${i}" aria-label="${i + 1}번 칸" style="background:hsl(${h} ${s}% ${i === odd ? l2 : l}%)"></button>`
    ).join("");
    lvEl.textContent = `${level + 1}단계`;
  };
  const onDown = (e) => {
    const t = e.target.closest(".cg__tile");
    if (!t) return;
    e.preventDefault();
    if (Number(t.dataset.i) === odd) {
      level++;
      haptic(6);
      render();
    } else {
      timer.penalty(2000);
      haptic([30, 40, 30]);
      grid.classList.remove("is-shake");
      void grid.offsetWidth;
      grid.classList.add("is-shake");
    }
  };
  render();
  grid.addEventListener("pointerdown", onDown);
  await timer.done;
  grid.removeEventListener("pointerdown", onDown);
  if (signal.aborted) throw abortErr();
  grid.classList.add("is-locked");
  grid.children[odd]?.classList.add("is-answer");
  await wait(700, signal);
  return { raw: level };
}

/* ========== 4. 고주파 청력 ========== */
export const FREQS = [8000, 10000, 12000, 14000, 15000, 16000, 17000, 18000, 19000];

async function playHearing(area, signal) {
  if (!ensureAudio()) return { raw: null };
  for (;;) {
    const res = await hearingRound(area, signal);
    if (res.raw) return res;
    // 8kHz도 안 들렸으면 기기/볼륨 문제일 가능성이 커서 다시 할지 묻는다
    area.innerHTML = `
      <div class="done fade-swap">
        <div class="readout"><p class="readout__k mono"><span>CH4 고주파 청력</span><span>NO SIGNAL</span></p><p class="readout__v mono">8kHz ✕</p></div>
        <h2 class="t-title-03">8kHz도 안 들렸어요</h2>
        <p class="t-body-03 t-secondary">볼륨이 너무 작거나 무음 모드일 수 있어요. 스마트폰 스피커는 높은 소리를 잘 못 내기도 해요.</p>
        <div class="howto__cta">
          <button class="btn btn--primary btn--lg btn--block" data-act="retry">볼륨 확인하고 다시</button>
          <button class="btn btn--ghost btn--block" data-act="skip">청력은 건너뛰기</button>
        </div>
      </div>`;
    const act = await until(signal, (done) => {
      const onClick = (e) => {
        const b = e.target.closest("[data-act]");
        if (b) done(b.dataset.act);
      };
      area.addEventListener("click", onClick);
      return () => area.removeEventListener("click", onClick);
    });
    if (act === "skip") return { raw: null };
  }
}

async function hearingRound(area, signal) {
  // 무음(가짜) 문제를 앞쪽(2~3번째)에 하나 섞는다
  const trials = FREQS.map((f) => ({ f }));
  trials.splice(ri(1, 2), 0, { f: 0, catch: true });
  area.innerHTML = `
    <div class="hear">
      <div class="hear__ladder" aria-hidden="true">${FREQS.map((f, i) => `<i style="--h:${(i + 2) / (FREQS.length + 1)}"></i>`).join("")}</div>
      <p class="t-label-02 t-secondary t-num" data-step></p>
      <div class="hear__scope" aria-hidden="true"><canvas></canvas><span class="mono">CH4 · TONE</span></div>
      <p class="t-title-03" aria-live="polite" data-msg>소리가 들리나요?</p>
      <p class="t-body-03 t-tertiary">아주 작게 '삐—' 하는 높은 소리예요</p>
      <div class="hear__ans">
        <button class="btn btn--outline btn--lg" type="button" data-a="no">안 들려요</button>
        <button class="btn btn--primary btn--lg" type="button" data-a="yes">들려요</button>
      </div>
      <button class="btn btn--ghost btn--sm" type="button" data-a="replay">다시 듣기</button>
    </div>`;
  const root = area.querySelector(".hear");
  const bars = [...root.querySelectorAll(".hear__ladder i")];
  const stepEl = root.querySelector("[data-step]");
  const msg = root.querySelector("[data-msg]");
  const btns = [...root.querySelectorAll(".hear__ans .btn")];
  let heard = 0;
  let unsure = false;
  let n = 0;
  let current = null;
  signal.addEventListener("abort", () => current?.stop(), { once: true });
  // 소리가 나는 동안 파형이 진동한다 (무음 문제도 똑같이 보여서 눈치로 맞힐 수 없다)
  let playUntil = 0;
  const scope = new Scope(root.querySelector(".hear__scope canvas"), { period: 1100, gain: 0.45 });
  scope.setWave((x, t) => (t < playUntil ? WAVES.hear(x, t) : WAVES.idle(x, t)));
  scope.start(signal);
  const play = (t) => {
    playUntil = performance.now() + 1500;
    current?.stop();
    root.classList.remove("is-playing");
    void root.offsetWidth;
    root.classList.add("is-playing");
    current = tone(t.f || 1000, { gain: t.catch ? 0 : MAX_GAIN, dur: 1.5 });
  };
  for (const t of trials) {
    n++;
    const ladderIdx = t.catch ? Math.min(FREQS.indexOf(trials[n]?.f ?? FREQS[0]), FREQS.length - 1) : FREQS.indexOf(t.f);
    bars.forEach((b, i) => {
      b.classList.toggle("is-on", i === ladderIdx);
      b.classList.toggle("is-past", i < ladderIdx);
    });
    stepEl.textContent = `${n}번째 소리`;
    msg.textContent = "소리가 들리나요?";
    btns.forEach((b) => (b.disabled = true));
    play(t);
    await wait(450, signal);
    btns.forEach((b) => (b.disabled = false));
    const ans = await until(signal, (done) => {
      const onClick = (e) => {
        const b = e.target.closest("[data-a]");
        if (!b || b.disabled) return;
        if (b.dataset.a === "replay") return play(t);
        done(b.dataset.a);
      };
      root.addEventListener("click", onClick);
      return () => root.removeEventListener("click", onClick);
    });
    current?.stop();
    playUntil = 0;
    root.classList.remove("is-playing");
    haptic(6);
    if (t.catch) {
      if (ans === "yes") unsure = true;
    } else if (ans === "yes") {
      heard = t.f;
    } else {
      break; // 처음 안 들린 곳에서 멈춘다
    }
    btns.forEach((b) => (b.disabled = true));
    await wait(350, signal);
  }
  return { raw: heard || 0, unsure };
}

/* ========== 5. 순간계산 ========== */
const MATH_MS = 30000;

function makeProblem(n) {
  let a;
  let b;
  let op;
  const p = Math.random();
  if (n < 3) {
    op = p < 0.5 ? "+" : "−";
    a = ri(2, 9);
    b = ri(1, 9);
  } else if (n < 7) {
    if (p < 0.4) [op, a, b] = ["+", ri(11, 49), ri(2, 9)];
    else if (p < 0.7) [op, a, b] = ["−", ri(12, 59), ri(2, 9)];
    else [op, a, b] = ["×", ri(2, 5), ri(2, 9)];
  } else {
    if (p < 0.35) [op, a, b] = ["+", ri(12, 59), ri(11, 39)];
    else if (p < 0.65) [op, a, b] = ["−", ri(30, 99), ri(11, 29)];
    else [op, a, b] = ["×", ri(3, 9), ri(3, 9)];
  }
  if (op === "−" && b > a) [a, b] = [b, a];
  const ans = op === "+" ? a + b : op === "−" ? a - b : a * b;
  return { text: `${a} ${op} ${b}`, ans: String(ans) };
}

async function playMath(area, signal) {
  area.innerHTML = `
    <div class="mt">
      <div class="timer" aria-hidden="true"><i></i></div>
      <div class="mt__head"><span class="t-label-01 t-num" data-score>맞힘 0</span><span class="t-body-03 t-secondary">30초</span></div>
      <div class="mt__q">
        <span class="mt__expr t-num" data-q></span>
        <span class="mt__eq">=</span>
        <span class="mt__ans t-num" data-a aria-live="polite"></span>
      </div>
      <div class="mt__pad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<button class="mt__key" type="button" data-k="${d}">${d}</button>`).join("")}
        <button class="mt__key mt__key--fn" type="button" data-k="pass">패스</button>
        <button class="mt__key" type="button" data-k="0">0</button>
        <button class="mt__key mt__key--fn" type="button" data-k="del" aria-label="지우기">⌫</button>
      </div>
    </div>`;
  const qEl = area.querySelector("[data-q]");
  const aEl = area.querySelector("[data-a]");
  const scoreEl = area.querySelector("[data-score]");
  const qBox = area.querySelector(".mt__q");
  const pad = area.querySelector(".mt__pad");
  const timer = timerBar(area.querySelector(".timer i"), MATH_MS, signal);
  let correct = 0;
  let tried = 0;
  let typed = "";
  let prob;
  const next = () => {
    prob = makeProblem(correct);
    typed = "";
    qEl.textContent = prob.text;
    aEl.textContent = "?";
    aEl.classList.add("is-empty");
  };
  const input = (k) => {
    if (k === "del") typed = typed.slice(0, -1);
    else if (k === "pass") {
      tried++;
      return next();
    } else if (typed.length < 4) typed += k;
    aEl.textContent = typed || "?";
    aEl.classList.toggle("is-empty", !typed);
    if (typed === prob.ans) {
      correct++;
      tried++;
      haptic(6);
      scoreEl.textContent = `맞힘 ${correct}`;
      qBox.classList.remove("is-good");
      void qBox.offsetWidth;
      qBox.classList.add("is-good");
      next();
    } else if (typed.length >= prob.ans.length) {
      tried++;
      haptic([30, 40, 30]);
      qBox.classList.remove("is-shake");
      void qBox.offsetWidth;
      qBox.classList.add("is-shake");
      typed = "";
      setTimeout(() => {
        if (!typed) {
          aEl.textContent = "?";
          aEl.classList.add("is-empty");
        }
      }, 260);
    }
  };
  const onDown = (e) => {
    const b = e.target.closest("[data-k]");
    if (!b) return;
    e.preventDefault();
    b.classList.add("is-pressed");
    setTimeout(() => b.classList.remove("is-pressed"), 120);
    input(b.dataset.k);
  };
  const onKey = (e) => {
    if (/^[0-9]$/.test(e.key)) input(e.key);
    else if (e.key === "Backspace") input("del");
  };
  next();
  pad.addEventListener("pointerdown", onDown);
  document.addEventListener("keydown", onKey);
  await timer.done;
  pad.removeEventListener("pointerdown", onDown);
  document.removeEventListener("keydown", onKey);
  if (signal.aborted) throw abortErr();
  pad.classList.add("is-locked");
  qEl.textContent = "끝!";
  aEl.textContent = "";
  await wait(600, signal);
  return { raw: correct, tried };
}

/* ========== 6. 동체시력 (따로 하는 측정 전용, 종합 뇌 나이에는 안 들어감) ========== */
const DYN_START = 1300; // 첫 판 숫자판이 화면을 지나가는 시간(ms)
const DYN_STEP = 0.84; // 맞힐 때마다 이만큼 빨라짐
const DYN_MIN = 140;
const DYN_LIVES = 2;

async function playDynamic(area, signal) {
  area.innerHTML = `
    <div class="dv">
      <div class="dv__head"><span class="t-label-01 t-num" data-lv>1단계</span><span class="t-body-03 t-secondary" data-life>기회 ●●</span></div>
      <div class="dv__track" aria-hidden="true"><span class="dv__plate t-num" data-plate></span><i class="dv__line"></i></div>
      <p class="t-body-03 t-secondary dv__ask" data-ask>숫자판이 지나가요. 잘 보세요</p>
      <div class="dv__opts" data-opts></div>
    </div>`;
  const plate = area.querySelector("[data-plate]");
  const track = area.querySelector(".dv__track");
  const opts = area.querySelector("[data-opts]");
  const ask = area.querySelector("[data-ask]");
  const lvEl = area.querySelector("[data-lv]");
  const lifeEl = area.querySelector("[data-life]");
  let dur = DYN_START;
  let level = 0;
  let lives = DYN_LIVES;
  let fastest = null;
  while (lives > 0 && !signal.aborted) {
    lvEl.textContent = `${level + 1}단계 · ${Math.round(dur)}ms`;
    lifeEl.textContent = `기회 ${"●".repeat(lives)}${"○".repeat(DYN_LIVES - lives)}`;
    const n = ri(10, 99);
    plate.textContent = String(n);
    opts.innerHTML = "";
    ask.textContent = "숫자판이 지나가요. 잘 보세요";
    await wait(500, signal);
    // 위·아래 높이와 방향을 매 판 바꿔 예측을 막는다
    const w = track.clientWidth;
    const fromLeft = Math.random() < 0.5;
    const y = ri(12, Math.max(14, track.clientHeight - 70));
    plate.style.top = `${y}px`;
    const x0 = fromLeft ? -90 : w + 10;
    const x1 = fromLeft ? w + 10 : -90;
    plate.style.transition = "none";
    plate.style.transform = `translateX(${x0}px)`;
    plate.style.visibility = "visible";
    await nextFrame();
    await nextFrame();
    plate.style.transition = `transform ${dur}ms linear`;
    plate.style.transform = `translateX(${x1}px)`;
    await wait(dur + 30, signal);
    plate.style.visibility = "hidden";
    // 보기 4개: 정답 + 비슷한 숫자(자리 바꿈·한 자리 차이)
    const set = new Set([n]);
    const near = [Number(String(n).split("").reverse().join("")), n + 1, n - 1, n + 10, n - 10, n + 11];
    for (const c of near.sort(() => Math.random() - 0.5)) if (set.size < 4 && c >= 10 && c <= 99) set.add(c);
    while (set.size < 4) set.add(ri(10, 99));
    const choices = [...set].sort(() => Math.random() - 0.5);
    ask.textContent = "방금 지나간 숫자는?";
    opts.innerHTML = choices.map((c) => `<button class="btn btn--outline btn--lg dv__opt t-num" type="button" data-v="${c}">${c}</button>`).join("");
    const picked = await until(signal, (done) => {
      const on = (e) => {
        const b = e.target.closest("[data-v]");
        if (b) done(Number(b.dataset.v));
      };
      opts.addEventListener("click", on);
      return () => opts.removeEventListener("click", on);
    });
    const ok = picked === n;
    opts.querySelectorAll("[data-v]").forEach((b) => {
      const v = Number(b.dataset.v);
      if (v === n) b.classList.add("is-right");
      else if (v === picked) b.classList.add("is-wrong");
      b.disabled = true;
    });
    haptic(ok ? 8 : [30, 40, 30]);
    if (ok) {
      level++;
      fastest = dur;
      dur = Math.max(DYN_MIN, dur * DYN_STEP);
    } else lives--;
    await wait(650, signal);
  }
  if (signal.aborted) throw abortErr();
  return { raw: level, fastest };
}

export const PLAY = { rt: playReaction, mem: playMemory, color: playColor, hear: playHearing, math: playMath, dyn: playDynamic };

export const fmtHz = (hz) => `${fmt.num(hz)}Hz`;
