// 🔍 줌아웃 — 아주 크게 확대한 그림에서 시작해 틀릴 때마다 한 단계씩 멀어진다
import { $, shuffle, prefersReducedMotion, haptic } from "../../shared/kit.js";
import { pickDaily, dailyRand, norm, esc, shake, pop, token, EMOJI_FONT } from "../core.js";
import { ZOOM_POOL } from "../data/zoom.js";
import { PHOTOS, PHOTO_DIR } from "../data/zoom-photos.js";

const MAX = 6;
// 이모지 크기 대비 보이는 창 크기 (단계별)
const STAGES = [0.15, 0.22, 0.31, 0.43, 0.58, 0.78];
const REVEAL = 1.22;
const OFF = 640; // 오프스크린 크기
const FONT_PX = 440;

const puzzle = () => pickDaily(ZOOM_POOL, "zoom");

function isAnswer(guess, p) {
  const g = norm(guess);
  if (!g) return false;
  const variants = [g, g.replace(/(이에요|예요|이요|입니다|인가요|요|임)$/, "")];
  return p.answers.some((a) => variants.includes(norm(a)));
}

// 오늘 문제의 Pixabay 사진(사람이 확인한 것만). 없으면 이모지로 그린다
const photoOf = (p) => PHOTOS[p.name] || null;

function render(off, img) {
  const ctx = off.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, OFF, OFF);
  if (img) {
    // 사진은 가운데를 정사각형으로 꽉 채워 그린다
    const s = Math.min(img.naturalWidth, img.naturalHeight);
    ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, OFF, OFF);
    return ctx.getImageData(0, 0, OFF, OFF).data;
  }
  ctx.font = `${FONT_PX}px ${EMOJI_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(puzzle().emoji, OFF / 2, OFF / 2 + FONT_PX * 0.04);
  return ctx.getImageData(0, 0, OFF, OFF).data;
}

// 비어 있지 않고 디테일이 있는 지점을 골라 시작 화면으로 쓴다
function analyse(data) {
  let x0 = OFF;
  let y0 = OFF;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < OFF; y += 2) {
    for (let x = 0; x < OFF; x += 2) {
      if (data[(y * OFF + x) * 4 + 3] > 40) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 <= x0) return { size: FONT_PX, cx: OFF / 2, cy: OFF / 2, px: OFF / 2, py: OFF / 2 };
  const size = Math.max(x1 - x0, y1 - y0);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const w = STAGES[0] * size;
  const rand = dailyRand("zoom", ":crop");
  const lum = (x, y) => {
    const i = (Math.round(y) * OFF + Math.round(x)) * 4;
    return data[i + 3] < 128 ? -1 : 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
  };
  let best = { score: -Infinity, px: cx, py: cy };
  for (let k = 0; k < 90; k++) {
    const px = x0 + w / 2 + rand() * Math.max(1, x1 - x0 - w);
    const py = y0 + w / 2 + rand() * Math.max(1, y1 - y0 - w);
    const N = 10;
    let opaque = 0;
    let sum = 0;
    let sum2 = 0;
    let edge = 0;
    const vals = [];
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const v = lum(px - w / 2 + (i + 0.5) * (w / N), py - w / 2 + (j + 0.5) * (w / N));
        vals.push(v);
        if (v >= 0) {
          opaque++;
          sum += v;
          sum2 += v * v;
        }
      }
    }
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N - 1; i++) {
        const a = vals[j * N + i];
        const b = vals[j * N + i + 1];
        if (a >= 0 && b >= 0) edge += Math.abs(a - b);
      }
    }
    const f = opaque / (N * N);
    const mean = opaque ? sum / opaque : 0;
    const sd = opaque ? Math.sqrt(Math.max(0, sum2 / opaque - mean * mean)) : 0;
    // 꽉 찬 창을 우선, 그 안에서 디테일(경계·명암 차)이 있는 곳. 너무 요란한 곳은 살짝 감점
    const detail = Math.min(sd, 70) + Math.min(edge / (N * (N - 1)), 40);
    const score = f >= 0.92 ? 100 + detail : f * 100 - 60 + detail * 0.3;
    if (score > best.score) best = { score, px, py };
  }
  return { size, cx, cy, px: best.px, py: best.py };
}

function viewFor(stage, geo) {
  const full = geo.size * REVEAL;
  const w = stage >= MAX ? full : STAGES[stage] * geo.size;
  const t = Math.min(1, Math.max(0, (w - STAGES[0] * geo.size) / (full - STAGES[0] * geo.size)));
  const e = t * t * (3 - 2 * t);
  return { w, x: geo.px + (geo.cx - geo.px) * e, y: geo.py + (geo.cy - geo.py) * e };
}

export default {
  id: "zoom",
  name: "줌아웃",
  emoji: "🔍",
  tagline: "확대된 그림, 점점 보이면 맞혀요",
  max: MAX,
  distKeys: ["1", "2", "3", "4", "5", "6", "X"],
  distLabel: (k) => (k === "X" ? "실패" : `${k}번`),

  started: (s) => s.guesses.length > 0,

  summary(s) {
    if (!s?.done) return null;
    const n = s.guesses.length;
    const grid = s.guesses.map((g) => (g.ok ? "🟩" : "🟥")).join("");
    return {
      won: s.won,
      distKey: s.won ? String(n) : "X",
      grid,
      scoreText: s.won ? `${n}번 만에 맞힘` : "이번엔 못 맞힘",
      headline: s.won ? `${n}번 만에 맞혔어요!` : "아쉬워요, 다음에 맞혀봐요",
    };
  },

  reveal(s) {
    const p = puzzle();
    const others = p.answers.slice(1, 4);
    const ph = photoOf(p);
    return `<div class="zoom-reveal">
      ${ph ? `<img class="zoom-reveal__photo" src="${PHOTO_DIR}${ph.f}" alt="${esc(p.name)}" width="96" height="96">` : `<span class="zoom-reveal__emoji">${p.emoji}</span>`}
      <div class="stack gap-4">
        <span class="t-caption-01 t-tertiary">오늘의 사물</span>
        <b class="t-title-02" >${esc(p.name)}</b>
        ${others.length ? `<span class="t-body-03 t-secondary">${esc(others.join(", "))}도 정답으로 인정해요</span>` : ""}
        ${s.usedChoices ? `<span class="t-caption-01 t-tertiary">보기 힌트를 썼어요</span>` : ""}
        ${ph ? `<a class="t-caption-01 t-tertiary" href="${esc(ph.page)}" target="_blank" rel="noopener">사진: ${esc(ph.by)} · Pixabay</a>` : ""}
      </div>
    </div>`;
  },

  mount(root, api) {
    const p = puzzle();
    const s = api.state || { guesses: [], usedChoices: false, done: false, won: false };
    root.innerHTML = `
      <div class="crt zoom__crt" id="zcrt">
        <canvas class="zoom__canvas" id="zcanvas" aria-label="확대된 그림"></canvas>
        <div class="crt__hud"><span class="pix" id="zlv"></span><span class="pix" id="zx"></span></div>
        <div class="zoom__flash" id="zflash"></div>
        <div class="crt__scan"></div>
      </div>
      <p class="msg" id="zmsg" aria-live="polite"></p>
      <form class="answer" id="zform" autocomplete="off">
        <input class="input" id="zin" placeholder="무엇일까요? 예: 라면" enterkeyhint="done" maxlength="20" />
        <button class="btn btn--primary" type="submit">맞히기</button>
      </form>
      <div class="zoom__hints" id="zhints"></div>
      <div class="zoom__choices" id="zchoices" hidden></div>
      <div class="guesslog" id="zlog"></div>
      
      <div class="done-bar" id="zdone" hidden><button class="btn btn--primary btn--lg" id="zres">결과 보기</button></div>`;

    const canvas = $("#zcanvas", root);
    const ctx = canvas.getContext("2d");
    const off = document.createElement("canvas");
    off.width = off.height = OFF;
    const ph = photoOf(p);
    // 사진이 있으면 다 받기 전까지는 빈 화면(이모지가 잠깐 보여 정답이 새지 않게)
    let geo = ph ? { size: OFF, cx: OFF / 2, cy: OFF / 2, px: OFF / 2, py: OFF / 2 } : analyse(render(off));
    const bg = token("--art-crt") || "#0b100c";
    let view = null;
    let raf = 0;

    function size() {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
    }
    let ready = !ph;
    function draw(v) {
      const W = canvas.width;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, W);
      if (!ready) return;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      const sx = v.x - v.w / 2;
      const sy = v.y - v.w / 2;
      // 원본 밖은 잘라서 그린다
      const cx0 = Math.max(0, sx);
      const cy0 = Math.max(0, sy);
      const cx1 = Math.min(OFF, sx + v.w);
      const cy1 = Math.min(OFF, sy + v.w);
      if (cx1 <= cx0 || cy1 <= cy0) return;
      const k = W / v.w;
      ctx.drawImage(off, cx0, cy0, cx1 - cx0, cy1 - cy0, (cx0 - sx) * k, (cy0 - sy) * k, (cx1 - cx0) * k, (cy1 - cy0) * k);
    }
    // 예비동작(살짝 더 당김) → 쭉 빠짐 → 오버슈트 후 정착
    function animateTo(target, dur = 820) {
      cancelAnimationFrame(raf);
      if (!view || prefersReducedMotion()) {
        view = target;
        draw(view);
        return;
      }
      const from = { ...view };
      const t0 = performance.now();
      const ease = (t) => {
        if (t < 0.18) return -0.06 * Math.sin((t / 0.18) * Math.PI);
        const u = (t - 0.18) / 0.82;
        return 1 + Math.exp(-6 * u) * Math.cos(10 * u) * -1;
      };
      const step = (now) => {
        const t = Math.min(1, (now - t0) / dur);
        const e = ease(t);
        view = {
          w: from.w * Math.pow(target.w / from.w, e),
          x: from.x + (target.x - from.x) * e,
          y: from.y + (target.y - from.y) * e,
        };
        draw(view);
        if (t < 1) raf = requestAnimationFrame(step);
        else draw((view = target));
      };
      raf = requestAnimationFrame(step);
    }

    const wrongs = () => s.guesses.filter((g) => !g.ok).length;
    const stage = () => (s.done ? MAX : Math.min(MAX - 1, wrongs()));

    function hud() {
      const st = stage();
      $("#zlv", root).textContent = s.done ? "REVEAL" : `ZOOM ${st + 1}/${MAX}`;
      const v = viewFor(st, geo);
      $("#zx", root).textContent = s.done ? "" : `x${(geo.size / v.w).toFixed(1)}`;
      $("#zx", root).hidden = s.done;
      const marks = Array.from({ length: MAX }, (_, i) => {
        const g = s.guesses[i];
        if (g) return g.ok ? "hit" : "miss";
        return !s.done && i === s.guesses.length ? "now" : "";
      });
      api.setTries(marks);
    }

    function hints() {
      const w = wrongs();
      const box = $("#zhints", root);
      const items = [];
      if (w >= 2 || s.done) items.push(`<span class="chip">분류: ${esc(p.cat)}</span>`);
      if (w >= 3 && !s.done && !s.usedChoices) items.push(`<button class="btn btn--secondary btn--sm" id="zopen">보기 4개 중에 고르기</button>`);
      if (w < 2 && !s.done) items.push(`<span class="t-caption-01 t-tertiary">2번 틀리면 분류 힌트, 3번 틀리면 보기 힌트가 열려요</span>`);
      box.innerHTML = items.join("");
      $("#zopen", root)?.addEventListener("click", () => {
        s.usedChoices = true;
        api.save(s);
        showChoices();
        hints();
      });
      if (s.usedChoices && !s.done) showChoices();
    }

    function showChoices() {
      const box = $("#zchoices", root);
      const rand = dailyRand("zoom", ":choices");
      const answerSet = new Set(p.answers.map(norm));
      const pool = ZOOM_POOL.filter((x) => x !== p && !x.answers.some((a) => answerSet.has(norm(a))));
      const same = shuffle(pool.filter((x) => x.cat === p.cat), rand);
      const rest = shuffle(pool.filter((x) => x.cat !== p.cat), rand);
      const opts = shuffle([p, ...[...same, ...rest].slice(0, 3)], rand);
      const tried = new Set(s.guesses.map((g) => norm(g.text)));
      box.innerHTML = opts
        .map(
          (o, i) =>
            `<button class="btn btn--outline" style="--i:${i}" data-name="${esc(o.name)}" ${tried.has(norm(o.name)) ? "disabled" : ""}>${esc(o.name)}</button>`
        )
        .join("");
      box.hidden = false;
      box.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => guess(b.dataset.name)));
    }

    function log() {
      $("#zlog", root).innerHTML = s.guesses
        .filter((g) => !g.ok)
        .map((g) => `<span>${esc(g.text)}</span>`)
        .join("");
    }

    function finishUI() {
      $("#zform", root).hidden = true;
      $("#zchoices", root).hidden = true;
      $("#zdone", root).hidden = false;
      const m = $("#zmsg", root);
      m.className = `msg ${s.won ? "is-good" : "is-bad"}`;
      m.textContent = s.won ? `정답! ${p.emoji} ${p.name}` : `정답은 ${p.emoji} ${p.name}였어요`;
    }

    function guess(text) {
      if (s.done) return;
      const t = String(text || "").trim();
      const input = $("#zin", root);
      const m = $("#zmsg", root);
      if (!norm(t)) {
        shake(input);
        m.className = "msg is-bad";
        m.textContent = "답을 적어주세요";
        return;
      }
      if (s.guesses.some((g) => norm(g.text) === norm(t))) {
        shake(input);
        m.className = "msg";
        m.textContent = "이미 말한 답이에요";
        return;
      }
      const ok = isAnswer(t, p);
      s.guesses.push({ text: t, ok });
      input.value = "";
      if (ok) {
        s.done = true;
        s.won = true;
      } else if (s.guesses.length >= MAX) {
        s.done = true;
        s.won = false;
      }
      if (!ok) {
        shake($("#zcrt", root));
        haptic(20);
        if (!s.done) {
          m.className = "msg is-bad";
          m.textContent = ["아니에요! 한 칸 멀어질게요", "땡! 조금 더 보여드릴게요", "아직이에요. 줌아웃!"][wrongs() % 3];
        }
      }
      const fl = $("#zflash", root);
      fl.classList.remove("is-on");
      void fl.offsetWidth;
      fl.classList.add("is-on");
      animateTo(viewFor(stage(), geo), s.done ? 1100 : 820);
      hud();
      hints();
      log();
      if (s.usedChoices && !s.done) showChoices();
      if (s.done) {
        finishUI();
        if (ok) pop($("#zcrt", root));
        api.finish(s);
      } else {
        api.save(s);
      }
    }

    $("#zform", root).addEventListener("submit", (e) => {
      e.preventDefault();
      guess($("#zin", root).value);
    });
    $("#zres", root).addEventListener("click", () => api.openResult());

    size();
    view = viewFor(stage(), geo);
    draw(view);
    hud();
    if (ph) {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        geo = analyse(render(off, img));
        ready = true;
        view = viewFor(stage(), geo);
        draw(view);
        hud();
      };
      img.onerror = () => {
        // 사진을 못 받으면 원래 이모지로
        geo = analyse(render(off));
        ready = true;
        view = viewFor(stage(), geo);
        draw(view);
        hud();
      };
      img.src = PHOTO_DIR + ph.f;
    }
    hints();
    log();
    if (s.done) finishUI();
    const onResize = () => {
      size();
      draw(view);
    };
    addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", onResize);
    };
  },
};
