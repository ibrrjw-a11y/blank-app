// 딴짓 오락실 공통: 데일리 문제, 하루 상태, 개인 기록, 카운트다운, 연출
import {
  createStore,
  todayKey,
  dayNumber,
  seededRandom,
  shuffle,
  prefersReducedMotion,
  createCanvas,
  roundRect,
  CANVAS_FONT,
} from "../shared/kit.js";

export const EPOCH = "2026-01-01";
export const store = createStore("ddanjit");
export const DATE = todayKey();
export const DAY = dayNumber(EPOCH);

export const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Segoe UI Symbol",sans-serif';

/* ---------- 오늘의 문제 (모두 같은 문제) ---------- */
// 풀을 한 바퀴 돌 때까지 겹치지 않게: 바퀴마다 시드 섞기 → dayNumber 위치
export function pickDaily(pool, gameId, day = DAY) {
  const n = pool.length;
  const i = (((day - 1) % n) + n) % n;
  const cycle = Math.floor((day - 1) / n);
  const order = shuffle(
    pool.map((_, k) => k),
    seededRandom(`ddanjit:${gameId}:cycle${cycle}`)
  );
  return pool[order[i]];
}

export const dailyRand = (gameId, extra = "") => seededRandom(`ddanjit:${gameId}:${DATE}${extra}`);

/* ---------- 하루 상태 (다시 열어도 그대로) ---------- */
export const loadDay = (gameId) => store.get(`d:${gameId}:${DAY}`, null);
export const saveDay = (gameId, s) => store.set(`d:${gameId}:${DAY}`, s);

/* ---------- 개인 기록 (나만 보는 숫자) ---------- */
const emptyStats = () => ({ played: 0, wins: 0, cur: 0, max: 0, lastWin: -1, lastPlay: -1, dist: {} });

export function getStats(gameId) {
  const s = { ...emptyStats(), ...store.get(`s:${gameId}`, {}) };
  // 어제도 오늘도 성공하지 않았다면 연속 기록은 끊긴 것
  s.curLive = s.lastWin >= DAY - 1 ? s.cur : 0;
  return s;
}

export function recordResult(gameId, { won, distKey }) {
  const s = { ...emptyStats(), ...store.get(`s:${gameId}`, {}) };
  if (s.lastPlay === DAY) return getStats(gameId); // 하루 한 번만 기록
  s.played += 1;
  s.lastPlay = DAY;
  if (won) {
    s.wins += 1;
    s.cur = s.lastWin === DAY - 1 ? s.cur + 1 : 1;
    s.max = Math.max(s.max, s.cur);
    s.lastWin = DAY;
  } else {
    s.cur = 0;
  }
  s.dist[distKey] = (s.dist[distKey] || 0) + 1;
  store.set(`s:${gameId}`, s);

  const days = store.get("days", []);
  if (!days.includes(DAY)) {
    days.push(DAY);
    store.set("days", days.slice(-500));
  }
  return getStats(gameId);
}

// 하루에 한 게임이라도 끝낸 날이 이어진 수
export function overallStreak() {
  const days = new Set(store.get("days", []));
  let d = days.has(DAY) ? DAY : DAY - 1;
  let n = 0;
  while (days.has(d)) {
    n += 1;
    d -= 1;
  }
  return { streak: n, today: days.has(DAY), total: days.size, best: bestStreak(days) };
}

function bestStreak(days) {
  const arr = [...days].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  arr.forEach((d, i) => {
    run = i && arr[i - 1] === d - 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

/* ---------- 다음 문제까지 (KST 자정) ---------- */
export function msToNextPuzzle(now = Date.now()) {
  const kst = now + 9 * 3600000;
  return 86400000 - (kst % 86400000);
}

export function fmtCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const p = (n) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

/* ---------- 문자열 정리 ---------- */
export const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[\s.,!?~'"·\-_()]/g, "")
    .trim();

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/* ---------- 토큰 읽기 (캔버스·SVG 장식용) ---------- */
export function token(name, el = document.documentElement) {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

/* ---------- 연출 ---------- */
export function shake(el) {
  if (!el) return;
  el.classList.remove("is-shake");
  void el.offsetWidth;
  el.classList.add("is-shake");
}

export function pop(el) {
  if (!el) return;
  el.classList.remove("is-pop");
  void el.offsetWidth;
  el.classList.add("is-pop");
}

// 가벼운 꽃가루
export function confetti({ count = 70, duration = 1600 } = {}) {
  if (prefersReducedMotion()) return;
  const c = document.createElement("canvas");
  c.className = "confetti";
  c.setAttribute("aria-hidden", "true");
  document.body.appendChild(c);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = innerWidth;
  const H = innerHeight;
  c.width = W * dpr;
  c.height = H * dpr;
  const ctx = c.getContext("2d");
  ctx.scale(dpr, dpr);
  const colors = ["--color-primary", "--color-success", "--color-warning", "--color-danger"].map((t) => token(t));
  const parts = Array.from({ length: count }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.3,
    y: H * 0.42,
    vx: (Math.random() - 0.5) * 9,
    vy: -6 - Math.random() * 8,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    s: 5 + Math.random() * 5,
    c: colors[Math.floor(Math.random() * colors.length)],
  }));
  const start = performance.now();
  const tick = (now) => {
    const t = now - start;
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = Math.max(0, 1 - t / duration);
    parts.forEach((p) => {
      p.vy += 0.32;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      ctx.restore();
    });
    if (t < duration) requestAnimationFrame(tick);
    else c.remove();
  };
  requestAnimationFrame(tick);
}

/* ---------- 공유 이미지 카드 (정답은 넣지 않아요) ---------- */
export function drawShareCard({ gameEmoji, gameName, grid, line, sub }) {
  const W = 360;
  const H = 450;
  const { canvas, ctx } = createCanvas(W, H, 3);
  const bg = token("--color-bg") || "#0a0c10";
  const surface = token("--color-surface-raised") || "#1b1f27";
  const brand = token("--brand") || "#b45cff";
  const text = token("--color-text") || "#f3f5f8";
  const sec = token("--color-text-secondary") || "#a3aab6";
  const pink = token("--color-danger") || "#f0445a";

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, 0, 10, W / 2, 0, W);
  g.addColorStop(0, brand + "55");
  g.addColorStop(1, "transparent");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  roundRect(ctx, 20, 20, W - 40, H - 40, 24);
  ctx.fillStyle = surface;
  ctx.fill();
  ctx.lineWidth = 2;
  const lg = ctx.createLinearGradient(20, 20, W - 20, H - 20);
  lg.addColorStop(0, brand);
  lg.addColorStop(1, pink);
  ctx.strokeStyle = lg;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = sec;
  ctx.font = `600 14px ${CANVAS_FONT}`;
  ctx.fillText(`🕹️ 딴짓 오락실 #${DAY}`, W / 2, 62);

  ctx.font = `64px ${EMOJI_FONT}`;
  ctx.fillText(gameEmoji, W / 2, 140);

  ctx.fillStyle = text;
  ctx.font = `800 26px ${CANVAS_FONT}`;
  ctx.fillText(gameName, W / 2, 186);

  // 이모지 줄 (길면 줄바꿈)
  const cells = Array.from(grid.replace(/\s+/g, ""));
  const per = Math.min(cells.length, 7);
  const size = per > 6 ? 30 : 34;
  ctx.font = `${size}px ${EMOJI_FONT}`;
  const rows = [];
  const segs = [...new Intl.Segmenter("ko", { granularity: "grapheme" }).segment(grid.replace(/\s+/g, ""))].map(
    (s) => s.segment
  );
  for (let i = 0; i < segs.length; i += 7) rows.push(segs.slice(i, i + 7).join(""));
  rows.forEach((r, i) => ctx.fillText(r, W / 2, 248 + i * (size + 10)));

  ctx.fillStyle = text;
  ctx.font = `700 20px ${CANVAS_FONT}`;
  ctx.fillText(line, W / 2, 248 + rows.length * (size + 10) + 22);

  ctx.fillStyle = sec;
  ctx.font = `400 14px ${CANVAS_FONT}`;
  ctx.fillText(sub || "하루 3분, 혼자 하는 데일리 추리 게임", W / 2, H - 58);
  ctx.fillStyle = brand;
  ctx.font = `700 14px ${CANVAS_FONT}`;
  ctx.fillText(location.host ? `${location.host}/ddanjit` : "딴짓 오락실", W / 2, H - 36);
  return canvas;
}
