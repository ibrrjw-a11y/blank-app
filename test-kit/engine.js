// 심리테스트 4종이 같이 쓰는 엔진 (로직만). 화면과 장르 디자인은 각 테스트가 직접 만든다.
// - 문항 진행(뒤로 가기 포함), 점수 합산, 결과 링크 인코딩/해석
// - 친구 비교: 친구 결과 링크를 열면 기억해 두었다가, 내가 테스트를 마치면 나란히 비교
// - 기록: createStore 에 내 결과 히스토리
// - 공유: 링크(share) + 1080×1350 결과 카드(shareImage)
import {
  createStore,
  encodeState,
  decodeState,
  urlWith,
  getParam,
  share,
  shareImage,
  createCanvas,
  copyText,
  toast,
  prefersReducedMotion,
} from "../shared/kit.js";

/* ---------- 문자열 ---------- */
export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const clean = (s, max = 10) =>
  String(s ?? "")
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .trim()
    .slice(0, max);

// 받침에 따라 조사 고르기: josa("민지", "은/는") → "는"
export function josa(word, pair) {
  const [a, b] = pair.split("/");
  const ch = String(word).trim().slice(-1);
  const c = ch.charCodeAt(0);
  if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28 ? a : b;
  if (/[0-9]/.test(ch)) return "013678".includes(ch) ? a : b;
  return `${a}(${b})`;
}

export function fmtDate(t, withYear = false) {
  const d = new Date(t);
  const md = `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, "0")}`;
  return withYear ? `${d.getFullYear()}.${md}` : md;
}

/* ---------- 문항 진행 ----------
 * questions: [{ ..., options: [{ s: { axis: number } }] }]
 * onShow({ q, idx, total, dir, selected }) — 문항을 그린다 (dir: 1 다음, -1 이전, 0 처음)
 * onDone(answers) — 마지막 문항까지 답하면 (answers: 선택한 보기 번호 배열)
 * onExit() — 첫 문항에서 뒤로 가기
 */
export function createQuiz({ questions, onShow, onDone, onExit }) {
  const st = { idx: 0, answers: [] };
  const show = (dir) =>
    onShow({ q: questions[st.idx], idx: st.idx, total: questions.length, dir, selected: st.answers[st.idx], answers: st.answers });
  return {
    start(prev) {
      st.idx = 0;
      st.answers = Array.isArray(prev) ? prev.slice() : [];
      show(0);
    },
    pick(i) {
      st.answers[st.idx] = i;
      if (st.idx >= questions.length - 1) {
        onDone(st.answers.slice(0, questions.length));
        return true;
      }
      st.idx++;
      show(1);
      return false;
    },
    back() {
      if (st.idx > 0) {
        st.idx--;
        show(-1);
      } else onExit?.();
    },
    get idx() {
      return st.idx;
    },
    get answers() {
      return st.answers.slice();
    },
    total: questions.length,
  };
}

/* ---------- 점수 ----------
 * 축마다 합계와, 그 문항들로 나올 수 있는 최소·최대를 같이 돌려준다.
 * pct(axis) 는 최소~최대 사이의 위치를 0~100 으로. */
export function tally(questions, answers, filter = () => true) {
  const sum = {};
  const min = {};
  const max = {};
  questions.forEach((q, i) => {
    if (!filter(q, i)) return;
    const axes = new Set(q.options.flatMap((o) => Object.keys(o.s || {})));
    axes.forEach((ax) => {
      const vals = q.options.map((o) => (o.s && o.s[ax]) || 0);
      min[ax] = (min[ax] || 0) + Math.min(...vals);
      max[ax] = (max[ax] || 0) + Math.max(...vals);
      const pick = q.options[answers[i]];
      sum[ax] = (sum[ax] || 0) + ((pick && pick.s && pick.s[ax]) || 0);
    });
  });
  const pct = (ax) => {
    const lo = min[ax] || 0;
    const hi = max[ax] || 0;
    return hi > lo ? Math.round((((sum[ax] || 0) - lo) / (hi - lo)) * 100) : 0;
  };
  return { sum, min, max, pct };
}

/* ---------- 스프링 (감쇠 진동) ----------
 * 값이 목표를 살짝 지나쳤다 돌아오며 멈춘다. 줄다리기 밧줄, 점 이동 등에 쓴다. */
export function spring({ from, to, stiffness = 170, damping = 12, mass = 1, velocity = 0, onUpdate, signal }) {
  return new Promise((resolve) => {
    if (prefersReducedMotion()) {
      onUpdate(to);
      return resolve(to);
    }
    let x = from;
    let v = velocity;
    let last = performance.now();
    const step = (now) => {
      if (signal?.aborted) return resolve(x);
      let dt = Math.min(0.064, (now - last) / 1000);
      last = now;
      // 작은 단계로 나눠 적분 (프레임이 튀어도 안정적)
      while (dt > 0) {
        const h = Math.min(dt, 1 / 240);
        const a = (-stiffness * (x - to) - damping * v) / mass;
        v += a * h;
        x += v * h;
        dt -= h;
      }
      onUpdate(x);
      if (Math.abs(v) < 0.01 && Math.abs(x - to) < 0.01) {
        onUpdate(to);
        return resolve(to);
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

// 계속 움직이는 스프링 (목표만 바꿔 주면 따라간다)
export function springValue(initial, { stiffness = 170, damping = 12, onUpdate } = {}) {
  let x = initial;
  let v = 0;
  let target = initial;
  let raf = 0;
  let last = 0;
  const loop = (now) => {
    let dt = Math.min(0.064, (now - last) / 1000);
    last = now;
    while (dt > 0) {
      const h = Math.min(dt, 1 / 240);
      v += (-stiffness * (x - target) - damping * v) * h;
      x += v * h;
      dt -= h;
    }
    onUpdate?.(x);
    if (Math.abs(v) < 0.005 && Math.abs(x - target) < 0.005) {
      x = target;
      onUpdate?.(x);
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(loop);
  };
  return {
    set(t, kick = 0) {
      target = t;
      v += kick;
      if (prefersReducedMotion()) {
        x = t;
        onUpdate?.(x);
        return;
      }
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    },
    jump(t) {
      target = x = t;
      v = 0;
      onUpdate?.(x);
    },
    get value() {
      return x;
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}

/* ---------- 결과 저장·링크·공유 ----------
 * 결과는 "답 배열 + 추가 값(x)" 으로만 저장/전달하고, 화면은 테스트가 매번 다시 계산한다.
 * 링크: ?r=<base64url {a:"0120..", x, n:이름, u:기기id}> */
export function createResultKit({ slug, questions, title }) {
  const store = createStore(`tk:${slug}`);
  const BASE = location.origin + location.pathname;
  const HISTORY_MAX = 40;

  let uid = store.get("uid");
  if (!uid) {
    uid = Math.random().toString(36).slice(2, 10);
    store.set("uid", uid);
  }

  const validAnswers = (a) =>
    Array.isArray(a) &&
    a.length === questions.length &&
    a.every((v, i) => Number.isInteger(v) && v >= 0 && v < questions[i].options.length);

  const packA = (answers) => answers.map((v) => v.toString(36)).join("");
  const unpackA = (s) => (typeof s === "string" ? [...s].map((c) => parseInt(c, 36)) : null);

  function linkFor({ answers, extra }, name = getNick()) {
    const payload = { a: packA(answers), u: uid };
    if (extra != null) payload.x = extra;
    if (name) payload.n = clean(name, 10);
    return urlWith({ r: encodeState(payload) }, BASE);
  }

  // 링크 전체 또는 r 값만 받아도 해석
  function parse(input) {
    if (!input) return null;
    let raw = String(input).trim();
    try {
      if (/^https?:/i.test(raw)) raw = new URL(raw).searchParams.get("r") || "";
    } catch {
      return null;
    }
    const m = raw.match(/[A-Za-z0-9_-]{8,}/);
    if (!m) return null;
    const p = decodeState(m[0]);
    if (!p || typeof p !== "object") return null;
    const answers = unpackA(p.a);
    if (!validAnswers(answers)) return null;
    return { answers, extra: p.x ?? null, name: clean(p.n, 10), mine: p.u === uid };
  }

  const getNick = () => clean(store.get("nick", ""), 10);
  const setNick = (n) => store.set("nick", clean(n, 10));

  const history = {
    list() {
      const raw = store.get("history", []) || [];
      return raw
        .map((h) => ({ t: h.t, answers: unpackA(h.a), extra: h.x ?? null }))
        .filter((h) => validAnswers(h.answers));
    },
    add({ answers, extra }) {
      const raw = store.get("history", []) || [];
      raw.push({ t: Date.now(), a: packA(answers), x: extra ?? null });
      store.set("history", raw.slice(-HISTORY_MAX));
    },
    latest() {
      const l = this.list();
      return l[l.length - 1] || null;
    },
    clear() {
      store.remove("history");
    },
  };

  // 친구 결과: 링크로 열었을 때 기억 → 내 결과 화면에서 나란히
  const friend = {
    get() {
      const f = store.get("friend");
      if (!f) return null;
      const answers = unpackA(f.a);
      return validAnswers(answers) ? { answers, extra: f.x ?? null, name: clean(f.n, 10) } : null;
    },
    set(f) {
      store.set("friend", { a: packA(f.answers), x: f.extra ?? null, n: f.name || "" });
    },
    clear() {
      store.remove("friend");
    },
  };

  return {
    store,
    BASE,
    uid,
    linkFor,
    parse,
    fromUrl: () => parse(getParam("r")),
    clearUrl: () => history_replace(BASE),
    getNick,
    setNick,
    history,
    friend,
    async shareLink(result, { text }) {
      return share({ title, text, url: linkFor(result) });
    },
    async copyLink(result) {
      const ok = await copyText(linkFor(result));
      toast(ok ? "결과 링크를 복사했어요" : "복사에 실패했어요");
    },
    // draw(ctx, W, H): 540×675 좌표로 그리면 2배 해상도(1080×1350)로 저장
    async shareCard(draw, { filename, text = "" }) {
      try {
        await document.fonts?.ready;
      } catch {
        /* noop */
      }
      const { canvas, ctx } = createCanvas(540, 675, 2);
      draw(ctx, 540, 675);
      return shareImage(canvas, { filename, title, text: text ? `${text} ${BASE}` : BASE });
    },
  };
}

function history_replace(url) {
  try {
    history.replaceState(null, "", url);
  } catch {
    /* noop */
  }
}

/* ---------- 화면 전환 + 스크롤 맨 위 ---------- */
export function swapView(name, root = document) {
  root.querySelectorAll("[data-view]").forEach((el) => {
    el.hidden = el.dataset.view !== name;
  });
  window.scrollTo(0, 0);
}

/* ---------- 캔버스 도우미 ---------- */
export const tok = (name, el = document.documentElement) => getComputedStyle(el).getPropertyValue(name).trim();

export function rotated(ctx, x, y, deg, fn) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((deg * Math.PI) / 180);
  fn();
  ctx.restore();
}

/* ---------- 인트로 장면 루프 ----------
 * 캡션 없이 무대만 쓰는 장면 반복기. scenes: [{ duration, play(signal) }] */
export function loopScenes(scenes, { loop = true, onScene } = {}) {
  let i = 0;
  let timer = 0;
  let ctrl = null;
  let stopped = false;
  const reduced = prefersReducedMotion();
  const run = () => {
    if (stopped) return;
    ctrl?.abort();
    ctrl = new AbortController();
    const sc = scenes[i];
    onScene?.(i);
    try {
      sc.play(ctrl.signal);
    } catch (e) {
      console.error(e);
    }
    const next = i + 1;
    if (next < scenes.length || loop) {
      timer = setTimeout(() => {
        i = next % scenes.length;
        run();
      }, reduced ? Math.max(sc.duration, 3600) : sc.duration);
    }
  };
  run();
  return {
    stop() {
      stopped = true;
      clearTimeout(timer);
      ctrl?.abort();
    },
  };
}

// 중단 가능한 대기
export const wait = (ms, signal) =>
  new Promise((res) => {
    if (prefersReducedMotion()) ms = Math.min(ms, 60);
    const t = setTimeout(res, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      res();
    });
  });
