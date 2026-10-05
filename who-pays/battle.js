// 배틀로얄 모드: 줄어드는 원형 링에서 서로 밀어내기
import { haptic, CANVAS_FONT, roundRect, seededRandom, shuffle } from "../shared/kit.js";
import {
  squashAmt, slant, drawStartLights, drawVerdict, drawSlowmo,
  josa, readTokens, createCaster, drawCaption, createRecorder, renderTray,
  drawMarble, alpha, firstChar, fitCanvas, damp, randomSeed, penaltyEmoji, headline,
} from "./common.js";

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const STEP = 1 / 120;
const R0 = 170;
const RMIN = 40;
const CR = 15;

export function startBattle({ stage, tray: trayEl, recEl, players, rule, penalty, onDone }) {
  const tk = readTokens();
  const n = players.length;
  const rand = seededRandom(randomSeed());
  const name = (i) => players[i].name;

  // 시작 위치: 원 위의 무작위 자리
  const order = shuffle([...Array(n).keys()], rand);
  const chars = players.map((p, i) => {
    const slot = order.indexOf(i);
    const a = (slot / n) * Math.PI * 2 + rand() * 0.2;
    const rad = n <= 4 ? 70 : 100;
    return {
      i, x: Math.cos(a) * rad, y: Math.sin(a) * rad, vx: 0, vy: 0, r: CR,
      alive: true, outAt: 0, outPlace: 0, fallDir: 0,
      aiT: 0.3 + rand() * 0.6, slipT: 0, shieldT: 0, magnetT: 0, dashT: 0, look: a + Math.PI,
    };
  });

  stage.innerHTML = '<canvas class="play__canvas" aria-label="배틀로얄 화면"></canvas>';
  const canvas = stage.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  let view = fitCanvas(canvas);
  const ro = new ResizeObserver(() => (view = fitCanvas(canvas)));
  ro.observe(stage);

  const caster = createCaster();
  const recorder = createRecorder(canvas);
  if (recEl) recEl.hidden = !recorder;
  const tray = renderTray(trayEl, players, useItem);

  const fx = [];
  let R = R0;
  let gameT = 0;
  let realT = 0;
  let phase = "countdown";
  let countdownSaid = -1;
  let timeScale = 1;
  let slowT = 0;
  let slowCool = 0;
  let slowStartAt = -9;
  let decided = false;
  let decidedAt = 0;
  let loserIdx = -1;
  let outCount = 0;
  let shakeT = 0;
  let flash = null;
  let last = performance.now();
  let acc = 0;
  let raf = 0;
  let stopped = false;
  let paused = false;
  let shrinkSaid = false;
  let lastBumpSay = -9;
  let final2Said = false;
  let finalRows = null;

  const say = (t, p = 1) => caster.say(t, p, realT);
  const alive = () => chars.filter((c) => c.alive);

  function floatAt(i, text, color) {
    fx.push({ kind: "float", i, text, color, t0: realT, dur: 1.3 });
  }
  function ringAt(i, color) {
    fx.push({ kind: "ring", i, color, t0: realT, dur: 0.6 });
  }

  function useItem(i) {
    if (phase !== "fight" || decided) return false;
    const c = chars[i];
    if (!c.alive) return false;
    const kind = players[i].item;
    const a = name(i);
    if (kind === "boost") {
      const rivals = alive().filter((o) => o !== c);
      if (rivals.length) {
        rivals.sort((p, q) => Math.hypot(p.x - c.x, p.y - c.y) - Math.hypot(q.x - c.x, q.y - c.y));
        const t = rivals[0];
        const d = Math.hypot(t.x - c.x, t.y - c.y) || 1;
        c.vx = ((t.x - c.x) / d) * 520;
        c.vy = ((t.y - c.y) / d) * 520;
        c.dashT = 0.5;
        say(`${a}, 부스트 돌진! ${josa(name(t.i), "을/를")} 노립니다!`, 3);
      }
      ringAt(i, tk.brand);
      floatAt(i, "🚀 돌진!", tk.brand);
      flash = { color: tk.brand, t0: realT };
    } else if (kind === "banana") {
      const rivals = alive().filter((o) => o !== c);
      if (!rivals.length) return false;
      const t = rivals[Math.floor(rand() * rivals.length)];
      fx.push({ kind: "proj", from: i, to: t.i, t0: realT, dur: 0.4 });
      if (t.shieldT > 0) {
        floatAt(t.i, "🛡️ 막았다!", tk.success);
        say(`${a}의 바나나! 하지만 ${josa(name(t.i), "이/가")} 막아냅니다!`, 3);
      } else {
        t.slipT = 1.6;
        const ang = rand() * Math.PI * 2;
        t.vx = Math.cos(ang) * 240;
        t.vy = Math.sin(ang) * 240;
        setTimeout(() => !stopped && floatAt(t.i, "🍌 미끄덩!", tk.warning), 300);
        shakeT = 0.25;
        say(pick([`아~ ${josa(name(t.i), "이/가")} 바나나 밟고 미끄러집니다!`, `${a}의 바나나! ${name(t.i)}, 중심을 잃어요!`]), 3);
      }
    } else if (kind === "shield") {
      c.shieldT = 3;
      ringAt(i, tk.success);
      floatAt(i, "🛡️ 방어막!", tk.success);
      say(`${a}, 방어막! 3초 동안 끄떡없어요`, 3);
    } else if (kind === "magnet") {
      c.magnetT = 1.5;
      ringAt(i, tk.text);
      floatAt(i, "🧲 자석!", tk.text);
      say(`${a}, 자석으로 링 중앙에 붙습니다!`, 3);
    }
    return true;
  }

  function step() {
    const dt = STEP;
    if (phase === "fight") {
      gameT += dt;
      if (gameT > 2) {
        R = Math.max(RMIN, R0 - (gameT - 2) * ((R0 - RMIN) / 22));
        if (!shrinkSaid) {
          shrinkSaid = true;
          say("링이 좁아지기 시작합니다!", 1);
        }
      }
    }
    for (const c of chars) {
      if (!c.alive) continue;
      if (c.shieldT > 0) c.shieldT -= dt;
      if (c.dashT > 0) c.dashT -= dt;
      const dist = Math.hypot(c.x, c.y) || 1;
      if (phase === "fight") {
        if (c.slipT > 0) c.slipT -= dt;
        else {
          c.aiT -= dt;
          if (c.aiT <= 0) {
            c.aiT = 0.45 + rand() * 0.8;
            const rivals = chars.filter((o) => o.alive && o !== c);
            const calm = gameT < 3 ? 0.55 : 1;
            if (rivals.length && rand() < 0.7) {
              const t = rivals[Math.floor(rand() * rivals.length)];
              const d = Math.hypot(t.x - c.x, t.y - c.y) || 1;
              const f = (140 + rand() * 140) * calm;
              c.vx += ((t.x - c.x) / d) * f;
              c.vy += ((t.y - c.y) / d) * f;
            } else {
              const a = rand() * Math.PI * 2;
              c.vx += Math.cos(a) * 90 * calm;
              c.vy += Math.sin(a) * 90 * calm;
            }
            if (dist > R - 40 && rand() < 0.55) {
              c.vx -= (c.x / dist) * 140;
              c.vy -= (c.y / dist) * 140;
            }
          }
        }
        if (c.magnetT > 0) {
          c.magnetT -= dt;
          c.vx -= (c.x / dist) * 900 * dt;
          c.vy -= (c.y / dist) * 900 * dt;
        }
      }
      const fr = c.slipT > 0 ? 0.25 : 1.6;
      c.vx *= 1 - fr * dt;
      c.vy *= 1 - fr * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (Math.hypot(c.vx, c.vy) > 30) c.look = Math.atan2(c.vy, c.vx);
    }
    // 충돌
    for (let a = 0; a < chars.length; a++) {
      const A = chars[a];
      if (!A.alive) continue;
      for (let b = a + 1; b < chars.length; b++) {
        const B = chars[b];
        if (!B.alive) continue;
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const Rr = A.r + B.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= Rr * Rr) continue;
        const d = Math.sqrt(d2) || 1e-6;
        const nx = dx / d;
        const ny = dy / d;
        const ma = A.shieldT > 0 ? 3 : 1;
        const mb = B.shieldT > 0 ? 3 : 1;
        const pen = Rr - d;
        A.x -= nx * pen * (mb / (ma + mb));
        A.y -= ny * pen * (mb / (ma + mb));
        B.x += nx * pen * (ma / (ma + mb));
        B.y += ny * pen * (ma / (ma + mb));
        const rv = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
        if (rv < 0) {
          const j = (-(1 + 0.95) * rv) / (1 / ma + 1 / mb) + 30;
          A.vx -= (j / ma) * nx;
          A.vy -= (j / ma) * ny;
          B.vx += (j / mb) * nx;
          B.vy += (j / mb) * ny;
          if (-rv > 240 && phase === "fight" && realT - lastBumpSay > 3.5) {
            lastBumpSay = realT;
            const hitter = Math.hypot(A.vx, A.vy) < Math.hypot(B.vx, B.vy) ? A : B;
            const other = hitter === A ? B : A;
            say(pick([`${name(hitter.i)}의 몸통 박치기!`, `쾅! ${josa(name(A.i), "과/와")} ${name(B.i)} 충돌!`, `${name(other.i)}, 크게 밀려납니다!`]), 1);
          }
        }
      }
    }
    // 탈락
    if (phase === "fight") {
      for (const c of chars) {
        if (!c.alive) continue;
        if (Math.hypot(c.x, c.y) > R + c.r * 0.25) eliminate(c);
      }
    }
  }

  function eliminate(c) {
    c.alive = false;
    c.outAt = realT;
    c.outPlace = ++outCount;
    c.fallDir = Math.atan2(c.y, c.x);
    tray.out(c.i, "탈락");
    shakeT = 0.3;
    haptic([30, 30, 60]);
    const left = alive().length;
    if (!decided) {
      if (rule === "last" && outCount === 1) return decide(c.i);
      say(pick([`${name(c.i)}, 링 밖으로 떨어집니다!`, `${name(c.i)} 탈락! 남은 인원 ${left}명`]), 2);
      if (left === 1) {
        if (rule === "first") decide(alive()[0].i);
      } else if (left === 2 && !final2Said) {
        final2Said = true;
        const [p, q] = alive();
        setTimeout(() => !stopped && say(`최후의 2인! ${name(p.i)} 대 ${name(q.i)}!`, 2), 900);
      }
    }
  }

  function decide(i) {
    decided = true;
    decidedAt = realT;
    loserIdx = i;
    slowT = 0;
    shakeT = 0.45;
    haptic([120, 60, 220]);
    tray.enable(false);
    say(`결정! ${headline(name(i), penalty)}`, 5);
    // 순위표: 살아남은 사람 → 늦게 떨어진 순
    const survivors = chars.filter((c) => c.alive);
    const outs = chars.filter((c) => !c.alive).sort((a, b) => b.outPlace - a.outPlace);
    finalRows = [
      ...survivors.map((c) => ({
        name: name(c.i), color: players[c.i].color, isLoser: c.i === i,
        label: survivors.length === 1 ? "최후의 1인" : "생존", sub: "",
      })),
      ...outs.map((c) => ({
        name: name(c.i), color: players[c.i].color, isLoser: c.i === i,
        label: c.outPlace === 1 ? "첫 탈락" : `${c.outPlace}번째 탈락`, sub: "",
      })),
    ];
  }

  function checkSlowmo(dt) {
    if (slowT > 0) slowT -= dt;
    if (slowCool > 0) slowCool -= dt;
    if (decided || phase !== "fight" || slowCool > 0 || slowT > 0) return;
    const critical = rule === "last" ? outCount === 0 : alive().length === 2;
    if (!critical) return;
    for (const c of alive()) {
      const d = Math.hypot(c.x, c.y) || 1;
      const vr = (c.vx * c.x + c.vy * c.y) / d;
      if (d > R - 8 && vr > 50) {
        slowT = 0.9;
        slowCool = 3;
        slowStartAt = realT;
        haptic([40, 60, 40]);
        say(pick([`아슬아슬! ${name(c.i)}, 끝에 매달렸어요!`, `${name(c.i)}, 떨어지나요?!`]), 4);
        return;
      }
    }
  }

  function draw() {
    const { w, h, dpr } = view;
    const s = (Math.min(w, h * 0.92) * 0.46) / R0;
    const cx = w / 2 + (shakeT > 0 ? (Math.random() - 0.5) * 10 * shakeT : 0);
    const cy = h * 0.52 + (shakeT > 0 ? (Math.random() - 0.5) * 10 * shakeT : 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = tk.bg;
    ctx.fillRect(0, 0, w, h);

    // 배경: 아스팔트 + 스캔라인
    ctx.fillStyle = tk.asphalt;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.025)";
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
    // 바깥 낭떠러지 (원래 링 자리)
    ctx.beginPath();
    ctx.arc(cx, cy, R0 * s, 0, Math.PI * 2);
    ctx.setLineDash([4, 10]);
    ctx.strokeStyle = alpha(tk.chalk, 0.25);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);

    // 링: 단색 매트 + 위험 구역 띠
    const rr = R * s;
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.fillStyle = tk.raised;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.lineWidth = 12;
    ctx.strokeStyle = tk.brand;
    ctx.setLineDash([10, 10]);
    ctx.lineDashOffset = -realT * 30;
    ctx.beginPath();
    ctx.arc(cx, cy, rr - 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    ctx.strokeStyle = tk.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - rr * 0.6, cy);
    ctx.lineTo(cx + rr * 0.6, cy);
    ctx.moveTo(cx, cy - rr * 0.6);
    ctx.lineTo(cx, cy + rr * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, rr * 0.3, 0, Math.PI * 2);
    ctx.stroke();

    const toS = (c) => [cx + c.x * s, cy + c.y * s];
    const dangerIdx = decided
      ? loserIdx
      : phase === "fight"
        ? (() => {
            const al = alive();
            if (al.length < 2) return -1;
            if (rule === "first") return -1;
            // 링 끝에 가장 가까운 사람
            return al.slice().sort((a, b) => Math.hypot(b.x, b.y) - Math.hypot(a.x, a.y))[0].i;
          })()
        : -1;

    // 떨어지는 캐릭터
    for (const c of chars) {
      if (c.alive) continue;
      const k = Math.min(1, (realT - c.outAt) / 0.7);
      if (k >= 1) continue;
      const [x, y] = toS(c);
      ctx.globalAlpha = 1 - k;
      drawMarble(ctx, x + Math.cos(c.fallDir) * k * 30, y + Math.sin(c.fallDir) * k * 30, c.r * s * (1 - k * 0.7), players[c.i].color, firstChar(name(c.i)), k * 6, tk);
      ctx.globalAlpha = 1;
    }

    // 살아있는 캐릭터
    for (const c of chars) {
      if (!c.alive) continue;
      const [x, y] = toS(c);
      const r = c.r * s;
      ctx.beginPath();
      ctx.ellipse(x, y + r * 0.85, r * 0.9, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fill();
      drawMarble(ctx, x, y, r, players[c.i].color, "", 0, tk);
      // 눈
      const ex = Math.cos(c.look);
      const ey = Math.sin(c.look);
      for (const side of [-1, 1]) {
        const bx = x + ex * r * 0.25 - ey * side * r * 0.32;
        const by = y + ey * r * 0.25 + ex * side * r * 0.32 - r * 0.1;
        ctx.beginPath();
        ctx.arc(bx, by, r * 0.24, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(bx + ex * r * 0.1, by + ey * r * 0.1, r * 0.12, 0, Math.PI * 2);
        ctx.fillStyle = "#111";
        ctx.fill();
      }
      if (c.shieldT > 0) {
        ctx.beginPath();
        ctx.arc(x, y, r + 6, 0, Math.PI * 2);
        ctx.fillStyle = alpha(tk.success, 0.14);
        ctx.fill();
        ctx.strokeStyle = alpha(tk.success, 0.6 + Math.sin(realT * 10) * 0.25);
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if (c.dashT > 0) {
        ctx.strokeStyle = alpha(tk.brand, 0.7);
        ctx.lineWidth = r * 0.8;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - c.vx * 0.06 * s, y - c.vy * 0.06 * s);
        ctx.stroke();
      }
      if (c.slipT > 0) {
        ctx.save();
        ctx.translate(x + r + 4, y - r);
        ctx.rotate(realT * 8);
        ctx.font = `16px ${CANVAS_FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🍌", 0, 0);
        ctx.restore();
      }
      // 이름
      const isD = c.i === dangerIdx;
      const label = isD ? `${penaltyEmoji(penalty)} ${name(c.i)}` : name(c.i);
      ctx.font = `700 11px ${CANVAS_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const tw = ctx.measureText(label).width + 12;
      roundRect(ctx, x - tw / 2, y + r + 4, tw, 18, 9);
      ctx.fillStyle = isD ? tk.brand : "rgba(8,9,12,0.62)";
      ctx.fill();
      ctx.fillStyle = isD ? "#fff" : tk.text;
      ctx.fillText(label, x, y + r + 13.5);
    }

    // 효과
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const f of fx) {
      const k = (realT - f.t0) / f.dur;
      if (k < 0 || k > 1) continue;
      if (f.kind === "ring") {
        const [x, y] = toS(chars[f.i]);
        ctx.beginPath();
        ctx.arc(x, y, chars[f.i].r * s + 4 + k * 34, 0, Math.PI * 2);
        ctx.strokeStyle = alpha(f.color, 1 - k);
        ctx.lineWidth = 3 * (1 - k) + 0.5;
        ctx.stroke();
      } else if (f.kind === "float") {
        const [x, y] = toS(chars[f.i]);
        ctx.globalAlpha = Math.min(1, (1 - k) * 2);
        ctx.font = `800 ${16 + (1 - Math.min(1, k * 5)) * 8}px ${CANVAS_FONT}`;
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(8,9,12,0.85)";
        const yy = y - 30 - k * 40;
        ctx.strokeText(f.text, x, yy);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, x, yy);
        ctx.globalAlpha = 1;
      } else if (f.kind === "proj") {
        const [x1, y1] = toS(chars[f.from]);
        const [x2, y2] = toS(chars[f.to]);
        const x = x1 + (x2 - x1) * k;
        const y = y1 + (y2 - y1) * k - Math.sin(k * Math.PI) * 80;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(k * 12);
        ctx.font = `22px ${CANVAS_FONT}`;
        ctx.fillText("🍌", 0, 0);
        ctx.restore();
      }
    }

    // 남은 인원 스코어 버그
    slant(ctx, 14, 12, 58, 40, 0);
    ctx.fillStyle = tk.chalk;
    ctx.fill();
    ctx.fillStyle = tk.bg;
    ctx.font = `400 30px ${tk.num}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(alive().length), 43, 34);
    slant(ctx, 72, 12, 92, 40, 0);
    ctx.fillStyle = "rgba(10,11,13,0.9)";
    ctx.fill();
    ctx.fillStyle = tk.text2;
    ctx.font = `700 11px ${CANVAS_FONT}`;
    ctx.textAlign = "left";
    ctx.fillText(`/ ${n}명 생존`, 82, 25);
    ctx.fillStyle = tk.brand;
    ctx.fillText(rule === "last" ? "첫 탈락 = 당첨" : "최후 1인 = 당첨", 82, 41);
    ctx.font = `800 13px ${tk.display}`;
    ctx.fillStyle = alpha(tk.chalk, 0.75);
    ctx.fillText("누가 쏠래?", 14, h - 16);

    drawSlowmo(ctx, w, h, Math.max(0, Math.min(1, (1 - timeScale) / 0.7)), realT - slowStartAt, tk);
    if (flash) {
      const k = (realT - flash.t0) / 0.35;
      if (k >= 1) flash = null;
      else {
        ctx.fillStyle = alpha(flash.color, 0.18 * (1 - k));
        ctx.fillRect(0, 0, w, h);
      }
    }

    if (realT < 3.8) drawStartLights(ctx, w, h, realT, tk, rule === "last" ? "먼저 떨어지면 당첨" : "끝까지 남으면 당첨");
    drawCaption(ctx, caster.get(realT), w, h - 74, tk);

    if (decided) drawVerdict(ctx, w, h * 0.2 + 30, `${headline(name(loserIdx), penalty)} ${penaltyEmoji(penalty)}`, realT - decidedAt - 0.1, tk);
  }

  function frame(now) {
    if (stopped) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (paused) return;
    realT += dt;
    if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
    if (phase === "countdown") {
      const num = Math.ceil(3 - realT);
      if (num !== countdownSaid && num > 0) {
        countdownSaid = num;
        haptic(15);
        if (num === 3) say(`링 위에 ${n}명! 밀려나면 끝이에요`, 1);
      }
      if (realT >= 3) {
        phase = "fight";
        tray.enable(true);
        haptic(40);
        say("시작! 서로 밀어냅니다!", 2);
      }
    }
    checkSlowmo(dt);
    timeScale = damp(timeScale, slowT > 0 ? 0.3 : 1, 8, dt);
    acc += dt * timeScale;
    let steps = 0;
    while (acc >= STEP && steps < 10) {
      step();
      acc -= STEP;
      steps++;
    }
    if (steps >= 10) acc = 0;
    for (let k = fx.length - 1; k >= 0; k--) if (realT - fx[k].t0 > fx[k].dur + 0.2) fx.splice(k, 1);
    draw();
    if (decided && realT - decidedAt > 2.6 && phase === "fight") {
      phase = "done";
      finish();
    }
  }

  async function finish() {
    const video = recorder ? await recorder.stop() : null;
    if (stopped) return;
    cleanup();
    onDone({ rows: finalRows, loser: name(loserIdx), video, videoExt: recorder?.ext });
  }

  function onVis() {
    paused = document.hidden;
    if (paused) recorder?.pause();
    else {
      last = performance.now();
      recorder?.resume();
    }
  }
  document.addEventListener("visibilitychange", onVis);

  function cleanup() {
    stopped = true;
    cancelAnimationFrame(raf);
    ro.disconnect();
    document.removeEventListener("visibilitychange", onVis);
    if (recEl) recEl.hidden = true;
  }

  recorder?.start();
  raf = requestAnimationFrame(frame);
  return {
    stop() {
      if (stopped) return;
      cleanup();
      recorder?.stop();
    },
  };
}
