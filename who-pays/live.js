// 실시간 추첨 4종: 풍선 터뜨리기 · 오리 레이스 · 똥 피하기 · 폭탄 돌리기
// 구슬 레이스가 잘된 이유를 따른다: (1) 모두의 이름이 동시에 화면에서 움직인다 (2) 순위가 끝까지 뒤집힌다
// (3) 물리·우연이라 공정해 보인다 (4) 10~30초짜리 구경거리. 결과는 시작 전에 정해 두지 않고 진행 중에 갈린다.
// 각 게임은 start({ stage, tray, players, rule, penalty, onDone, demo }) → { stop } (shell.js 의 다른 모드와 같은 약속)
import { seededRandom, sleep, haptic, prefersReducedMotion } from "../shared/kit.js";
import { randomSeed, readTokens, fitCanvas, escapeHtml, headline, penaltyEmoji, alpha, shade } from "./common.js";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------- 공통: 캔버스 + 루프 + 해설 자막 + 실시간 순위표 ---------- */
function makeStage(stage, label) {
  stage.innerHTML = `<div class="lv"><canvas class="play__canvas lv__canvas" aria-label="${label}"></canvas><p class="lv__cap" aria-live="polite"></p></div>`;
  const canvas = stage.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  let view = fitCanvas(canvas);
  const ro = new ResizeObserver(() => (view = fitCanvas(canvas)));
  ro.observe(stage.querySelector(".lv"));
  const cap = stage.querySelector(".lv__cap");
  let capT = 0;
  return {
    ctx,
    get view() {
      return view;
    },
    say(text, now) {
      if (now - capT < 1.1 && !text.startsWith("!")) return;
      capT = now;
      cap.textContent = text.replace(/^!/, "");
      cap.classList.remove("is-pop");
      void cap.offsetWidth;
      cap.classList.add("is-pop");
    },
    clear() {
      ro.disconnect();
    },
  };
}

function loop(tick) {
  let raf = 0;
  let last = performance.now();
  let stopped = false;
  const f = (now) => {
    if (stopped) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (tick(dt) === false) return;
    raf = requestAnimationFrame(f);
  };
  raf = requestAnimationFrame(f);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
}

// 실시간 순위 칩 (화면 아래). order = 플레이어 번호 배열(앞이 위험/선두), tagOf(i) = 칩 옆 글자
function renderBoard(tray, players, order, tagOf, outSet) {
  if (!tray) return;
  tray.innerHTML = `<ol class="lv-board">${order
    .map((i, k) => `<li class="${outSet?.has(i) ? "is-out" : ""}" style="--pc:${players[i].color}"><b>${k + 1}</b><span>${escapeHtml(players[i].name)}</span><small>${tagOf(i)}</small></li>`)
    .join("")}</ol>`;
}

function finishRows(players, orderSafeToLoser, loserIdx, labelOf) {
  // 결과표: 당첨 먼저, 나머지는 순서대로
  const rows = [{ name: players[loserIdx].name, color: players[loserIdx].color, label: "당첨", sub: labelOf(loserIdx), isLoser: true }];
  orderSafeToLoser.filter((i) => i !== loserIdx).forEach((i) => rows.push({ name: players[i].name, color: players[i].color, label: "통과", sub: labelOf(i), isLoser: false }));
  return rows;
}

function nameFont(tk, px, w = 700) {
  return `${w} ${px}px ${tk.display}`;
}

/* ========== 1. 풍선 터뜨리기 ========== */
// 풍선마다 '터지는 크기'를 몰래 정해 두지 않는다. 매 순간 바람 세기가 무작위로 바뀌고, 커질수록 터질 확률이 올라간다.
export function startBalloon({ stage, tray, players, rule = "last", penalty, onDone, demo = false }) {
  const tk = readTokens();
  const n = players.length;
  const rand = seededRandom(randomSeed());
  const S = makeStage(stage, "풍선 터뜨리기 화면");
  const b = players.map((p, i) => ({ i, size: 0.18 + rand() * 0.04, pump: 0.5 + rand(), gust: 0, popped: false, popAt: 0, wob: rand() * 6 }));
  const popped = [];
  let t = 0;
  let ended = false;
  let endAt = 0;
  const need = rule === "first" ? n - 1 : 1; // 몇 개가 터지면 끝나는지
  const stop = loop((dt) => {
    t += dt;
    const live = b.filter((x) => !x.popped);
    for (const x of live) {
      // 바람 세기는 사람마다 1~1.5초마다 무작위로 바뀐다 → 선두(가장 큰 풍선)가 계속 뒤집힌다
      x.gust -= dt;
      if (x.gust <= 0) {
        x.pump = 0.25 + rand() * 1.5;
        x.gust = 0.7 + rand() * 0.9;
      }
      if (t > 1.2 && !ended) x.size += dt * 0.045 * x.pump;
      // 터질 위험: 0.55 아래는 안 터지고, 그 위로 커질수록 가파르게
      const risk = x.size < 0.55 ? 0 : Math.pow((x.size - 0.55) / 0.45, 3) * 1.4;
      if (!ended && rand() < risk * dt) {
        x.popped = true;
        x.popAt = t;
        popped.push(x.i);
        haptic(demo ? 0 : 40);
        S.say(`!펑! ${players[x.i].name}`, t);
        if (popped.length >= need) {
          ended = true;
          endAt = t;
        }
      }
    }
    if (!ended && t > 1.2) {
      const big = live.slice().sort((a, c) => c.size - a.size)[0];
      if (big && big.size > 0.62) S.say(`${players[big.i].name} 풍선 위험`, t);
    }
    draw();
    const order = b.slice().sort((a, c) => (a.popped === c.popped ? c.size - a.size : a.popped ? -1 : 1)).map((x) => x.i);
    if (!demo) renderBoard(tray, players, order, (i) => (b[i].popped ? "펑" : `${Math.round(b[i].size * 100)}`), new Set(popped));
    if (ended && t - endAt > 1.6) {
      stop();
      S.clear();
      const loser = rule === "first" ? b.find((x) => !x.popped).i : popped[0];
      if (!demo) onDone({ rows: finishRows(players, order.slice().reverse(), loser, (i) => (b[i].popped ? `${(b[i].popAt).toFixed(1)}초에 펑` : "끝까지 버팀")), loser: players[loser].name, video: null });
      else onDone?.();
      return false;
    }
  });

  function draw() {
    const { ctx } = S;
    const { w, h, dpr } = S.view;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = tk.asphalt || "#1b1d22";
    ctx.fillRect(0, 0, w, h);
    const cols = n <= 4 ? n : Math.ceil(n / 2);
    const rows = Math.ceil(n / cols);
    const cw = w / cols;
    const rh = (h - 10) / rows;
    b.forEach((x, k) => {
      const cx = (k % cols) * cw + cw / 2;
      const base = Math.floor(k / cols) * rh + rh - 18;
      const R = Math.min(cw * 0.46, rh * 0.42) * x.size;
      const col = players[x.i].color;
      // 끈
      ctx.strokeStyle = alpha(tk.text, 0.35);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, base);
      ctx.quadraticCurveTo(cx + Math.sin(t * 3 + x.wob) * 6, base - 14, cx, base - 26);
      ctx.stroke();
      ctx.fillStyle = tk.text;
      ctx.font = nameFont(tk, 13);
      ctx.textAlign = "center";
      ctx.fillText(players[x.i].name, cx, base + 14);
      if (x.popped) {
        const a = t - x.popAt;
        if (a < 0.8) {
          for (let s = 0; s < 10; s++) {
            const ang = (s / 10) * Math.PI * 2;
            const d = 10 + a * 120;
            ctx.fillStyle = alpha(col, 1 - a / 0.8);
            ctx.fillRect(cx + Math.cos(ang) * d, base - 26 - R + Math.sin(ang) * d, 6, 3);
          }
        }
        ctx.fillStyle = alpha(col, 0.5);
        ctx.font = nameFont(tk, 18, 800);
        ctx.fillText("펑!", cx, base - 40);
        return;
      }
      const shake = x.size > 0.6 ? Math.sin(t * 40 + x.wob) * (x.size - 0.6) * 10 : 0;
      const by = base - 26 - R;
      ctx.save();
      ctx.translate(cx + shake, by);
      const sq = 1 + Math.sin(t * 5 + x.wob) * 0.03;
      ctx.scale(sq, 1 / sq);
      const g = ctx.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R);
      g.addColorStop(0, shade(col, 0.45));
      g.addColorStop(1, col);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, R * 0.92, R, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-4, R - 1);
      ctx.lineTo(4, R - 1);
      ctx.lineTo(0, R + 6);
      ctx.fill();
      ctx.restore();
      if (x.size > 0.62) {
        ctx.fillStyle = tk.warning || "#ffcc00";
        ctx.font = nameFont(tk, 12, 800);
        ctx.fillText("!!", cx + R * 0.9, by - R * 0.8);
      }
    });
  }
  return { stop: () => (stop(), S.clear()) };
}

/* ========== 2. 오리 레이스 ========== */
// 물살(흐름장)이 자리·시간에 따라 바뀌고 바위·소용돌이가 있어 순위가 계속 바뀐다. 결승선을 마지막(또는 처음)으로 지나는 오리가 당첨
export function startDuck({ stage, tray, players, rule = "last", penalty, onDone, demo = false }) {
  const tk = readTokens();
  const n = players.length;
  const rand = seededRandom(randomSeed());
  const S = makeStage(stage, "오리 레이스 화면");
  const LEN = demo ? 1400 : 2000; // 강 길이(아래로)
  const RW = 300; // 강 폭(가상 좌표)
  const rocks = Array.from({ length: Math.round(LEN / 170) }, (_, k) => ({ x: 40 + rand() * (RW - 80), y: 260 + k * 170 + rand() * 80, r: 14 + rand() * 12 }));
  const whirls = Array.from({ length: Math.round(LEN / 520) }, (_, k) => ({ x: 60 + rand() * (RW - 120), y: 500 + k * 520 + rand() * 100, r: 46, dir: rand() < 0.5 ? -1 : 1 }));
  const ph = [rand() * 9, rand() * 9, rand() * 9];
  // 출발 자리는 매번 섞는다(이름 넣은 순서가 자리를 정하지 않게)
  const lane = [...Array(n).keys()].sort(() => rand() - 0.5);
  const ducks = players.map((p, i) => ({ i, x: 30 + ((lane[i] + 0.5) / n) * (RW - 60), y: 60, vx: 0, vy: 0, done: false, doneAt: 0, rank: 0, spin: 0 }));
  const finished = [];
  let t = 0;
  let camY = 0;
  let ended = false;
  let endAt = 0;
  const flowY = (x, y, tt) => 70 + 38 * Math.sin(x * 0.03 + y * 0.004 + ph[0] + tt * 0.6) + 26 * Math.sin(y * 0.011 + ph[1] - tt * 0.9);
  const flowX = (x, y, tt) => 30 * Math.sin(y * 0.008 + ph[2] + tt * 0.7) + (RW / 2 - x) * 0.05;
  const stop = loop((dt) => {
    t += dt;
    const go = t > 1.0 && !ended;
    for (const d of ducks) {
      if (d.done || !go) continue;
      const tx = flowX(d.x, d.y, t) + (rand() - 0.5) * 60;
      const ty = flowY(d.x, d.y, t) + (rand() - 0.5) * 30;
      d.vx = lerp(d.vx, tx, 1 - Math.exp(-2.2 * dt));
      d.vy = lerp(d.vy, ty, 1 - Math.exp(-1.6 * dt));
      for (const w of whirls) {
        const dx = d.x - w.x;
        const dy = d.y - w.y;
        const dd = Math.hypot(dx, dy);
        if (dd < w.r * 1.6) {
          // 소용돌이: 빙글 돌며 잠깐 붙잡힌다
          const k = 1 - dd / (w.r * 1.6);
          d.vx += (-dy / (dd || 1)) * 160 * k * w.dir * dt * 4;
          d.vy += (dx / (dd || 1)) * 160 * k * w.dir * dt * 4 - d.vy * k * dt * 3;
          d.spin += w.dir * dt * 8 * k;
          if (k > 0.5 && rand() < dt * 0.4) S.say(`${players[d.i].name} 소용돌이에 빠짐`, t);
        }
      }
      d.x += d.vx * dt;
      d.y += Math.max(8, d.vy) * dt;
      for (const r of rocks) {
        const dx = d.x - r.x;
        const dy = d.y - r.y;
        const dd = Math.hypot(dx, dy);
        const m = r.r + 11;
        if (dd < m) {
          d.x = r.x + (dx / (dd || 1)) * m;
          d.y = r.y + (dy / (dd || 1)) * m;
          d.vy *= 0.3;
          d.vx += (dx / (dd || 1)) * 60;
          d.spin += 3;
        }
      }
      for (const o of ducks) {
        if (o === d || o.done) continue;
        const dx = d.x - o.x;
        const dy = d.y - o.y;
        const dd = Math.hypot(dx, dy);
        if (dd > 0 && dd < 22) {
          d.x += (dx / dd) * (22 - dd) * 0.5;
          d.y += (dy / dd) * (22 - dd) * 0.5;
        }
      }
      d.x = clamp(d.x, 14, RW - 14);
      if (d.y >= LEN) {
        d.done = true;
        d.doneAt = t;
        finished.push(d.i);
        if (finished.length === 1) S.say(`!1등 ${players[d.i].name}`, t);
        if (!ended && ((rule === "first" && finished.length === 1) || finished.length === n)) {
          ended = true;
          endAt = t;
          if (rule !== "first") S.say(`!꼴찌 ${players[d.i].name}`, t);
        }
      }
    }
    const live = ducks.filter((d) => !d.done);
    const order = [...finished, ...live.sort((a, c) => c.y - a.y).map((d) => d.i)];
    if (go && live.length) {
      const lastD = live[live.length - 1];
      if (rand() < dt * 0.25) S.say(`꼴찌 ${players[lastD.i].name} · 1등 ${players[order[0]].name}`, t);
    }
    // 카메라: 아직 안 들어온 오리들의 가운데를 따라간다
    const focus = live.length ? live.reduce((s, d) => s + d.y, 0) / live.length : LEN;
    camY = lerp(camY, focus, 1 - Math.exp(-3 * dt));
    draw(order);
    if (!demo) renderBoard(tray, players, order, (i) => (ducks[i].done ? "도착" : `${Math.max(0, Math.round(LEN - ducks[i].y))}`));
    if (ended && t - endAt > 1.8) {
      stop();
      S.clear();
      const loser = rule === "first" ? finished[0] : finished[finished.length - 1];
      if (!demo) onDone({ rows: finishRows(players, order, loser, (i) => `${ducks[i].doneAt.toFixed(1)}초`), loser: players[loser].name, video: null });
      else onDone?.();
      return false;
    }
  });

  function draw(order) {
    const { ctx } = S;
    const { w, h, dpr } = S.view;
    const k = w / RW;
    const top = camY - h / k / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#1d6fa3";
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.scale(k, k);
    ctx.translate(0, -top);
    // 물결 줄무늬
    ctx.strokeStyle = "rgba(255,255,255,.12)";
    ctx.lineWidth = 2;
    for (let y = Math.floor(top / 40) * 40; y < top + h / k; y += 40) {
      ctx.beginPath();
      for (let x = 0; x <= RW; x += 20) ctx.lineTo(x, y + Math.sin(x * 0.05 + t * 2 + y) * 4 + ((t * 60) % 40));
      ctx.stroke();
    }
    // 결승선
    ctx.fillStyle = "#fff";
    for (let x = 0; x < RW; x += 20) {
      ctx.fillRect(x, LEN, 10, 10);
      ctx.fillRect(x + 10, LEN + 10, 10, 10);
    }
    for (const wv of whirls) {
      ctx.strokeStyle = "rgba(255,255,255,.35)";
      for (let r = 10; r < wv.r; r += 10) {
        ctx.beginPath();
        ctx.arc(wv.x, wv.y, r, t * 3 * wv.dir + r, t * 3 * wv.dir + r + 4);
        ctx.stroke();
      }
    }
    for (const r of rocks) {
      ctx.fillStyle = "#56514a";
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.18)";
      ctx.beginPath();
      ctx.arc(r.x - r.r * 0.3, r.y - r.r * 0.3, r.r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const d of ducks) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(Math.sin(t * 4 + d.i) * 0.15 + d.spin);
      ctx.fillStyle = "#ffd23f";
      ctx.beginPath();
      ctx.ellipse(0, 4, 13, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(4, -6, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff8a3d";
      ctx.fillRect(10, -7, 7, 4);
      ctx.fillStyle = "#141414";
      ctx.fillRect(5, -9, 2, 2);
      ctx.fillStyle = players[d.i].color;
      ctx.fillRect(-12, 6, 24, 4);
      ctx.restore();
      ctx.fillStyle = "#fff";
      ctx.font = nameFont(tk, 11, 800);
      ctx.textAlign = "center";
      ctx.fillText(players[d.i].name, d.x, d.y - 18);
    }
    ctx.restore();
    // 남은 거리
    const lead = ducks[order[0]];
    ctx.fillStyle = "rgba(0,0,0,.45)";
    ctx.fillRect(8, 8, 120, 26);
    ctx.fillStyle = "#fff";
    ctx.font = nameFont(tk, 12, 800);
    ctx.textAlign = "left";
    ctx.fillText(`결승까지 ${Math.max(0, Math.round(LEN - lead.y))}m`, 16, 26);
  }
  return { stop: () => (stop(), S.clear()) };
}

/* ========== 3. 똥 피하기 ========== */
// 모두 같은 '피하는 실력'(무작위 반응 지연)으로 자동으로 피한다. 떨어지는 양은 점점 늘어난다. 맞으면 탈락.
export function startDodge({ stage, tray, players, rule = "last", penalty, onDone, demo = false }) {
  const tk = readTokens();
  const n = players.length;
  const rand = seededRandom(randomSeed());
  const S = makeStage(stage, "똥 피하기 화면");
  const AW = 360;
  const spot = [...Array(n).keys()].sort(() => rand() - 0.5);
  const guys = players.map((p, i) => ({ i, x: 20 + ((spot[i] + 0.5) / n) * (AW - 40), vx: 0, tx: 0, think: 0, out: false, outAt: 0 }));
  const drops = [];
  const outs = [];
  let t = 0;
  let spawn = 0;
  let ended = false;
  let endAt = 0;
  const need = rule === "first" ? n - 1 : 1;
  const stop = loop((dt) => {
    t += dt;
    const go = t > 1.2 && !ended;
    if (go) {
      const rate = 0.5 + t * 0.12; // 1초에 떨어지는 개수, 점점 늘어남
      spawn += dt * rate;
      while (spawn >= 1) {
        spawn -= 1;
        drops.push({ x: 10 + rand() * (AW - 20), y: -20, vy: 120 + rand() * 60 + t * 4, r: 9 + rand() * 4 });
      }
    }
    for (const d of drops) d.y += d.vy * dt;
    for (let k = drops.length - 1; k >= 0; k--) if (drops[k].y > 700) drops.splice(k, 1);
    const groundY = 600;
    for (const g of guys) {
      if (g.out) continue;
      g.think -= dt;
      if (g.think <= 0) {
        // 위험한 똥을 보고 피할 곳을 고른다(반응 지연·실수 확률은 모두 같음)
        g.think = 0.1 + rand() * 0.18;
        const threats = drops.filter((d) => d.y > groundY - 330 && d.y < groundY && Math.abs(d.x - g.x) < 46);
        if (threats.length) {
          const left = threats.filter((d) => d.x < g.x).length;
          const right = threats.length - left;
          let dir = left > right ? 1 : right > left ? -1 : rand() < 0.5 ? -1 : 1;
          if (rand() < 0.05) dir = -dir; // 가끔 반대로 피함
          g.tx = clamp(g.x + dir * (40 + rand() * 50), 14, AW - 14);
        } else if (rand() < 0.3) g.tx = clamp(g.x + (rand() - 0.5) * 60, 14, AW - 14);
      }
      g.vx = lerp(g.vx, (g.tx - g.x) * 6, 1 - Math.exp(-10 * dt));
      g.vx = clamp(g.vx, -230, 230);
      g.x = clamp(g.x + g.vx * dt, 14, AW - 14);
      if (!go) continue;
      for (const d of drops) {
        if (d.y > groundY - 30 && d.y < groundY && Math.abs(d.x - g.x) < d.r + 6) {
          g.out = true;
          g.outAt = t;
          outs.push(g.i);
          haptic(demo ? 0 : 30);
          S.say(`!${players[g.i].name} 맞음`, t);
          if (outs.length >= need) {
            ended = true;
            endAt = t;
          }
          break;
        }
      }
    }
    if (go && rand() < dt * 0.3) S.say(`${guys.filter((g) => !g.out).length}명 생존 · ${t.toFixed(0)}초`, t);
    draw(groundY);
    const order = [...guys.filter((g) => !g.out).map((g) => g.i), ...outs.slice().reverse()];
    if (!demo) renderBoard(tray, players, order, (i) => (guys[i].out ? `${guys[i].outAt.toFixed(1)}초` : "생존"), new Set(outs));
    if (ended && t - endAt > 1.6) {
      stop();
      S.clear();
      const loser = rule === "first" ? guys.find((g) => !g.out).i : outs[0];
      if (!demo) onDone({ rows: finishRows(players, order, loser, (i) => (guys[i].out ? `${guys[i].outAt.toFixed(1)}초에 맞음` : "끝까지 생존")), loser: players[loser].name, video: null });
      else onDone?.();
      return false;
    }
  });

  function draw(groundY) {
    const { ctx } = S;
    const { w, h, dpr } = S.view;
    const k = Math.min(w / AW, h / 640);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#cfe9ff";
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate((w - AW * k) / 2, h - 640 * k);
    ctx.scale(k, k);
    ctx.fillStyle = "#7cc36b";
    ctx.fillRect(-200, groundY, AW + 400, 60);
    for (const d of drops) {
      ctx.font = `${d.r * 2.2}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("💩", d.x, d.y);
    }
    for (const g of guys) {
      const col = players[g.i].color;
      const y = groundY - 16;
      ctx.save();
      ctx.translate(g.x, y);
      if (g.out) {
        ctx.rotate(Math.PI / 2);
        ctx.globalAlpha = 0.55;
      }
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(0, -10, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-7, -2, 14, 18);
      ctx.restore();
      ctx.fillStyle = g.out ? "rgba(20,20,20,.45)" : "#141414";
      ctx.font = nameFont(tk, 11, 800);
      ctx.textAlign = "center";
      ctx.fillText(players[g.i].name, g.x, groundY + 22);
    }
    ctx.restore();
  }
  return { stop: () => (stop(), S.clear()) };
}

/* ========== 4. 폭탄 돌리기 ========== */
// 폭탄이 무작위로 옆 사람에게 넘어간다. 터지는 시각은 시작할 때 정하지 않고, 매 순간 같은 확률로 터질 수 있게(점점 높아짐) 했다.
export function startBomb({ stage, tray, players, penalty, onDone, demo = false }) {
  const tk = readTokens();
  const n = players.length;
  const rand = seededRandom(randomSeed());
  const S = makeStage(stage, "폭탄 돌리기 화면");
  let holder = Math.floor(rand() * n);
  let from = holder;
  let pass = 1;
  let passDur = 0.8;
  let wait = 0.6;
  let t = 0;
  let boomAt = 0;
  let boom = false;
  const held = Array(n).fill(0);
  const stop = loop((dt) => {
    t += dt;
    if (!boom && t > 1.0) {
      held[holder] += dt;
      if (pass < 1) pass = Math.min(1, pass + dt / passDur);
      else {
        wait -= dt;
        if (wait <= 0) {
          // 다음 사람: 옆(시계·반시계) 또는 가끔 건너뛰기
          const step = rand() < 0.15 ? 2 + Math.floor(rand() * Math.max(1, n - 3)) : 1;
          from = holder;
          holder = (holder + (rand() < 0.5 ? step : n - step)) % n;
          pass = 0;
          const heat = Math.min(1, (t - 1) / 14);
          passDur = lerp(0.55, 0.22, heat) * (0.7 + rand() * 0.6);
          wait = lerp(0.5, 0.08, heat) * (0.5 + rand());
          if (rand() < 0.12) wait += 0.6; // 잠깐 멈칫
          haptic(demo ? 0 : 6);
        }
        // 터질 확률: 시작 4초 뒤부터 점점 높아짐. 넘기는 중이 아닐 때만 터짐
        const hz = t < 5 ? 0 : 0.05 + (t - 5) * 0.03;
        if (rand() < hz * dt) {
          boom = true;
          boomAt = t;
          haptic(demo ? 0 : [80, 40, 200]);
          S.say(`!${players[holder].name} 손에서 펑!`, t);
        } else if (rand() < dt * 0.4) S.say(`${players[holder].name}${t > 10 ? " 빨리 넘겨!" : " 차례"}`, t);
      }
    }
    draw();
    const order = [...Array(n).keys()].sort((a, c) => held[c] - held[a]);
    if (!demo) renderBoard(tray, players, order, (i) => `${held[i].toFixed(1)}초`);
    if (boom && t - boomAt > 2) {
      stop();
      S.clear();
      if (!demo) onDone({ rows: finishRows(players, order, holder, (i) => `${held[i].toFixed(1)}초 들고 있었음`), loser: players[holder].name, video: null });
      else onDone?.();
      return false;
    }
  });

  function seat(k, w, h) {
    const R = Math.min(w, h) * 0.36;
    const a = -Math.PI / 2 + (k / n) * Math.PI * 2;
    return [w / 2 + Math.cos(a) * R, h / 2 + Math.sin(a) * R];
  }
  function draw() {
    const { ctx } = S;
    const { w, h, dpr } = S.view;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#2a1d14";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#4a3324";
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.3, 0, Math.PI * 2);
    ctx.fill();
    for (let k = 0; k < n; k++) {
      const [x, y] = seat(k, w, h);
      const on = k === holder && !boom;
      ctx.fillStyle = players[k].color;
      ctx.beginPath();
      ctx.arc(x, y, on ? 22 : 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = nameFont(tk, 12, 800);
      ctx.textAlign = "center";
      ctx.fillText(players[k].name, x, y + 38);
    }
    const [x0, y0] = seat(from, w, h);
    const [x1, y1] = seat(holder, w, h);
    const e = pass < 1 ? pass * pass * (3 - 2 * pass) : 1;
    const bx = lerp(x0, x1, e);
    const by = lerp(y0, y1, e) - Math.sin(e * Math.PI) * 60;
    if (!boom) {
      const pulse = 1 + Math.sin(t * (6 + t * 0.8)) * 0.08;
      ctx.fillStyle = "#141414";
      ctx.beginPath();
      ctx.arc(bx, by, 15 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#c9a66b";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bx + 8, by - 10);
      ctx.quadraticCurveTo(bx + 16, by - 22, bx + 10, by - 28);
      ctx.stroke();
      ctx.fillStyle = Math.sin(t * 30) > 0 ? "#ffd23f" : "#ff4b2b";
      ctx.beginPath();
      ctx.arc(bx + 10, by - 29, 4 + Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const a = t - boomAt;
      ctx.fillStyle = alpha("#ff8a3d", Math.max(0, 1 - a / 1.2));
      ctx.beginPath();
      ctx.arc(x1, y1, 20 + a * 160, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = nameFont(tk, 34, 900);
      ctx.textAlign = "center";
      ctx.fillText("BOOM", w / 2, h / 2 + 12);
    }
  }
  return { stop: () => (stop(), S.clear()) };
}

/* ---------- 첫 화면: 실제 게임을 견본 이름으로 계속 돌린다 ---------- */
const SAMPLE = ["민수", "지은", "철수", "영희", "하준"];
const SAMPLE_COLORS = ["#ff4b2b", "#2f6bed", "#1f9d6b", "#c67a12", "#7b5cf0"];
export function demoIntro(root, startFn, opts = {}) {
  const stageEl = root.querySelector(".intro__stage");
  let cur = null;
  let alive = true;
  const players = SAMPLE.map((name, i) => ({ name, color: SAMPLE_COLORS[i] }));
  const run = () => {
    if (!alive) return;
    cur = startFn({ stage: stageEl, tray: null, players, rule: opts.rule || "last", penalty: "", demo: true, onDone: () => setTimeout(run, 600) });
  };
  if (prefersReducedMotion()) stageEl.innerHTML = `<p class="t-body-02 t-secondary" style="padding:24px">${escapeHtml(opts.still || "")}</p>`;
  else run();
  return {
    stop() {
      alive = false;
      cur?.stop();
    },
  };
}
