// 레이스 모드: 엔진 + 카메라 + 렌더 + 해설 + 아이템 + 슬로모션 + 녹화
import { haptic, CANVAS_FONT, roundRect, seededRandom, shuffle } from "../shared/kit.js";
import { createRaceEngine, STEP, W } from "./race-engine.js";
import {
  ITEMS, josa, readTokens, createCaster, drawCaption, createRecorder, renderTray,
  drawMarble, alpha, firstChar, fitCanvas, damp, randomSeed, penaltyEmoji, headline,
} from "./common.js";

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const SECTION_LINES = {
  pegs: ["핀볼 구간 진입! 어디로 튈지 몰라요", "핀 숲으로 들어갑니다!"],
  zigzag: ["지그재그 내리막! 속도가 붙습니다", "구불구불 내리막 구간이에요!"],
  funnel: ["깔때기 구간, 병목이 생깁니다!", "좁은 문! 누가 먼저 빠져나갈까요"],
  paddles: ["회전 패들 구간! 타이밍 싸움입니다", "돌아가는 패들, 잘못 맞으면 역주행!"],
  bumpers: ["범퍼 구간! 통통 튀어 오릅니다", "범퍼 지대 진입, 변수가 많아요!"],
  slalom: ["슬라롬 구간, 좌우로 흔들립니다!", "좌우 슬라롬! 라인 싸움이에요"],
  split: ["갈림길! 왼쪽이냐 오른쪽이냐!", "갈림길에서 운명이 갈립니다!"],
  final: ["마지막 코너! 결승선이 보입니다", "이제 마지막 구간이에요!"],
};

export function startRace({ stage, tray: trayEl, recEl, players, rule, penalty, onDone }) {
  const tk = readTokens();
  const n = players.length;
  const seed = randomSeed();
  const rand = seededRandom(seed);
  // 출발 자리는 이름 순서와 무관하게 무작위
  const slots = shuffle([...Array(n).keys()], seededRandom(randomSeed()));
  const engine = createRaceEngine({ count: n, rand, startSlots: slots });
  const { course, marbles } = engine;
  const name = (i) => players[i].name;

  stage.innerHTML = '<canvas class="play__canvas" aria-label="레이스 화면"></canvas>';
  const canvas = stage.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  let view = fitCanvas(canvas);
  const ro = new ResizeObserver(() => (view = fitCanvas(canvas)));
  ro.observe(stage);

  const caster = createCaster();
  const recorder = createRecorder(canvas);
  if (recEl) recEl.hidden = !recorder;

  const trails = marbles.map(() => []);
  const fx = []; // 떠오르는 라벨, 링, 투사체
  let flash = null;
  let shakeT = 0;

  const tray = renderTray(trayEl, players, useItem);

  // 카메라
  const cam = { x: W / 2, y: -40, zoom: 1 };
  let timeScale = 1;
  let targetScale = 1;
  let slowmo = false;
  let decided = false;
  let decidedAt = 0;
  let loserIdx = -1;
  let finalRank = null;
  let realT = 0;
  let last = performance.now();
  let acc = 0;
  let raf = 0;
  let stopped = false;
  let paused = false;
  let phase = "countdown";
  let countdownSaid = -1;

  // 해설용 상태
  let leaderStable = { i: -1, since: 0, said: -1 };
  let lastStable = { i: -1, since: 0, said: -1 };
  const sectionSaid = new Set();
  let prevRank = engine.ranking();
  let lastCollideSay = -9;
  let lastBumperSay = -9;
  let lastFinalFlipSay = -9;
  const finalMark = course.marks.find((m) => m.type === "final");

  function say(text, prio = 1) {
    caster.say(text, prio, realT);
  }

  function addFloat(i, text, color = tk.text) {
    const m = marbles[i];
    fx.push({ kind: "float", x: m.x, y: m.y - 16, text, color, t0: realT, dur: 1.3, follow: i });
  }
  function addRing(i, color) {
    const m = marbles[i];
    fx.push({ kind: "ring", i, color, t0: realT, dur: 0.6 });
    fx.push({ kind: "ring", i, color, t0: realT + 0.12, dur: 0.6 });
  }

  function useItem(i) {
    if (phase !== "race" || decided) return false;
    const kind = players[i].item;
    const res = engine.useItem(i, kind);
    if (!res.ok) return false;
    const a = name(i);
    if (kind === "boost") {
      addRing(i, tk.brand);
      addFloat(i, "🚀 부스트!", tk.brand);
      flash = { color: tk.brand, t0: realT, a: 0.18 };
      say(pick([`${a}, 부스트 점화! 쭉쭉 치고 나갑니다!`, `${a}의 로켓 부스트! 순식간에 내려갑니다!`]), 3);
    } else if (kind === "banana") {
      if (res.target < 0) {
        addFloat(i, "던질 상대가 없어요", tk.text2);
      } else {
        const t = name(res.target);
        fx.push({ kind: "proj", from: i, to: res.target, t0: realT, dur: 0.4, text: "🍌" });
        if (res.blocked) {
          addFloat(res.target, "🛡️ 막았다!", tk.success);
          addRing(res.target, tk.success);
          say(`${a}의 바나나! 하지만 ${josa(t, "이/가")} 방어막으로 튕겨냅니다!`, 3);
        } else {
          setTimeout(() => {
            if (stopped) return;
            addFloat(res.target, "🍌 미끄덩!", tk.warning);
            addRing(res.target, tk.warning);
          }, 300);
          shakeT = 0.25;
          say(pick([`아~ ${josa(t, "이/가")} 바나나 밟고 미끄러집니다!`, `${a}의 바나나 투척! ${josa(t, "이/가")} 휘청합니다!`, `${t}, 바나나에 제대로 걸렸어요!`]), 3);
        }
      }
    } else if (kind === "shield") {
      addRing(i, tk.success);
      addFloat(i, "🛡️ 방어막!", tk.success);
      say(pick([`${a}, 방어막 장착! 바나나 따윈 안 무서워요`, `${a}, 단단하게 방어막을 둘렀습니다!`]), 3);
    } else if (kind === "magnet") {
      addRing(i, tk.text);
      addFloat(i, "🧲 자석!", tk.text);
      say(pick([`${a}, 자석으로 중앙 라인을 붙잡습니다!`, `${a}의 자석! 가운데로 쭉 끌려갑니다`]), 3);
    }
    return true;
  }

  /* ---------- 진행 로직 ---------- */
  function logic(dt) {
    // 엔진 이벤트
    while (engine.events.length) {
      const e = engine.events.shift();
      if (e.type === "finish") {
        tray.out(e.i, `${e.place}등 도착`);
        if (e.place === 1) say(pick([`${name(e.i)}, 1등으로 골인!`, `1등은 ${name(e.i)}! 가장 먼저 들어옵니다`]), rule === "first" ? 4 : 2);
        else if (!decided && rule === "last" && marbles.filter((m) => !m.finished).length <= 2) {
          say(`${name(e.i)} 골인! 이제 남은 건 단 둘!`, 2);
        }
        if (!decided) haptic(10);
      } else if (e.type === "collide" && phase === "race" && realT - lastCollideSay > 4) {
        lastCollideSay = realT;
        say(pick([`${josa(name(e.a), "과/와")} ${name(e.b)}, 정면충돌!`, `쾅! ${josa(name(e.a), "과/와")} ${name(e.b)} 몸싸움!`]), 1);
      } else if (e.type === "bumper" && phase === "race" && realT - lastBumperSay > 6) {
        lastBumperSay = realT;
        say(`${name(e.i)}, 범퍼에 튕겨 나갑니다!`, 0.5);
      }
    }
    if (phase !== "race") return;

    const rank = engine.ranking();
    const running = rank.filter((i) => !marbles[i].finished);
    const lead = marbles[rank[0]];

    // 구간 진입 해설 (선두 기준)
    for (const mk of course.marks) {
      if (!sectionSaid.has(mk) && lead.y > mk.y && lead.y < mk.y + 200) {
        sectionSaid.add(mk);
        say(pick(SECTION_LINES[mk.type] || ["계속 내려갑니다!"]), mk.type === "final" ? 2 : 0);
      }
    }

    // 선두 교체 (0.5초 이상 유지될 때만)
    if (!lead.finished) {
      if (rank[0] !== leaderStable.i) leaderStable = { i: rank[0], since: realT, said: leaderStable.said };
      else if (realT - leaderStable.since > 0.5 && leaderStable.said !== leaderStable.i && engine.time > 2.5) {
        leaderStable.said = leaderStable.i;
        say(pick([`${name(rank[0])}, 선두로 치고 나갑니다!`, `선두 교체! ${josa(name(rank[0]), "이/가")} 앞장섭니다`]), 1);
      }
    }
    // 꼴찌 변화
    if (running.length >= 2) {
      const li = running[running.length - 1];
      if (li !== lastStable.i) lastStable = { i: li, since: realT, said: lastStable.said };
      else if (realT - lastStable.since > 0.8 && lastStable.said !== li && engine.time > 3) {
        const prev = lastStable.said;
        lastStable.said = li;
        const tag = rule === "last" ? "당첨 위기! " : "";
        if (prev >= 0 && !marbles[prev].finished)
          say(pick([`${tag}${josa(name(li), "이/가")} 꼴찌로 밀려납니다!`, `${name(prev)} 꼴찌 탈출! 이번엔 ${josa(name(li), "이/가")} 맨 뒤예요`]), rule === "last" ? 1.5 : 0.8);
        else say(`${tag}지금 꼴찌는 ${name(li)}!`, 0.8);
      }
    }
    // 마지막 구간 역전
    if (finalMark && realT - lastFinalFlipSay > 2.5) {
      for (const i of rank) {
        const m = marbles[i];
        if (m.finished || m.y < finalMark.y) continue;
        const now = rank.indexOf(i);
        const before = prevRank.indexOf(i);
        if (now < before) {
          lastFinalFlipSay = realT;
          say(pick([`마지막 코너, ${josa(name(i), "이/가")} 뒤집습니다!`, `막판 역전! ${name(i)}, 한 칸 올라갑니다!`]), 2);
          break;
        }
      }
    }
    prevRank = rank;

    // 결정 순간 판단
    const unfinished = marbles.filter((m) => !m.finished);
    if (!decided) {
      if (rule === "last") {
        if (unfinished.length === 1) decide(unfinished[0].i);
        else if (unfinished.length === 2 && Math.max(unfinished[0].y, unfinished[1].y) > course.finishY - 280) startSlowmo(unfinished.map((m) => m.i));
      } else {
        const first = marbles.find((m) => m.place === 1);
        if (first) decide(first.i);
        else if (lead.y > course.finishY - 230) startSlowmo(rank.slice(0, Math.min(2, n)));
      }
      if (!decided && engine.time > 80) decide(rule === "last" ? running[running.length - 1] : rank[0]);
    }
  }

  let focusPair = null;
  function startSlowmo(pair) {
    focusPair = pair;
    if (slowmo) return;
    slowmo = true;
    targetScale = 0.3;
    haptic([40, 60, 40, 60, 80]);
    say(pick(["운명의 순간! 슬로모션으로 봅니다", "숨 막히는 순간… 천천히 보시죠!"]), 4);
  }

  function decide(i) {
    decided = true;
    decidedAt = realT;
    loserIdx = i;
    finalRank = engine.ranking();
    slowmo = false;
    targetScale = 1;
    shakeT = 0.45;
    haptic([120, 60, 220]);
    tray.enable(false);
    say(`결정! ${headline(name(i), penalty)}`, 5);
  }

  /* ---------- 카메라 ---------- */
  function updateCamera(dt) {
    const s0 = view.w / W;
    let tz = 1;
    let ty;
    let tx = W / 2;
    if (phase === "countdown") {
      ty = -30 + (view.h / s0) * 0.22;
    } else {
      const focus = marbles.filter((m) => !m.finished);
      const list = focus.length ? focus : marbles;
      let lo = Infinity;
      let hi = -Infinity;
      for (const m of list) {
        lo = Math.min(lo, m.y);
        hi = Math.max(hi, m.y);
      }
      const vh = view.h / s0;
      if (hi - lo < vh * 0.62) ty = (lo + hi) / 2 + vh * 0.06;
      else ty = rule === "last" ? lo + vh * 0.32 : hi - vh * 0.25;
      if (slowmo && focusPair) {
        tz = 1.45;
        const ms = focusPair.map((i) => marbles[i]);
        ty = ms.reduce((a, m) => a + m.y, 0) / ms.length;
        tx = ms.reduce((a, m) => a + m.x, 0) / ms.length;
      }
      if (decided) {
        const m = marbles[loserIdx];
        tz = 1.3;
        ty = m.y;
        tx = m.x;
      }
    }
    cam.zoom = damp(cam.zoom, tz, 3, dt);
    const s = s0 * cam.zoom;
    const halfW = view.w / s / 2;
    const halfH = view.h / s / 2;
    tx = Math.min(W - halfW, Math.max(halfW, tx));
    ty = Math.min(course.floorY + 30 - halfH, Math.max(-140 + halfH, ty));
    cam.x = damp(cam.x, tx, 4, dt);
    cam.y = damp(cam.y, ty, slowmo || decided ? 5 : 3.2, dt);
  }

  /* ---------- 그리기 ---------- */
  function draw() {
    const { w, h, dpr } = view;
    const s = (w / W) * cam.zoom;
    let sx = 0;
    let sy = 0;
    if (shakeT > 0) {
      sx = (Math.random() - 0.5) * 10 * shakeT;
      sy = (Math.random() - 0.5) * 10 * shakeT;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = tk.bg;
    ctx.fillRect(0, 0, w, h);

    const ox = w / 2 - cam.x * s + sx;
    const oy = h / 2 - cam.y * s + sy;
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
    const top = cam.y - h / 2 / s - 20;
    const bot = cam.y + h / 2 / s + 20;

    // 트랙 바닥
    ctx.fillStyle = tk.surface;
    ctx.fillRect(0, top, W, bot - top);
    ctx.strokeStyle = alpha(tk.border, 0.9);
    ctx.lineWidth = 1;
    ctx.beginPath();
    const g0 = Math.floor(top / 60) * 60;
    for (let y = g0; y < bot; y += 60) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    for (let x = 60; x < W; x += 60) {
      ctx.moveTo(x, top);
      ctx.lineTo(x, bot);
    }
    ctx.stroke();

    // 남은 거리 표시
    ctx.font = `600 10px ${CANVAS_FONT}`;
    ctx.textAlign = "right";
    ctx.fillStyle = alpha(tk.text3, 0.8);
    for (const mk of course.marks) {
      if (mk.y < top || mk.y > bot) continue;
      ctx.fillText(`결승까지 ${Math.max(0, Math.round((course.finishY - mk.y) / 10))}m`, W - 10, mk.y + 14);
    }

    // 결승선
    if (course.finishY > top && course.finishY < bot) {
      const fy = course.finishY;
      const sq = 10;
      for (let x = 0, k = 0; x < W; x += sq, k++) {
        ctx.fillStyle = k % 2 ? tk.text : tk.bg;
        ctx.fillRect(x, fy - sq, sq, sq);
        ctx.fillStyle = k % 2 ? tk.bg : tk.text;
        ctx.fillRect(x, fy, sq, sq);
      }
      ctx.fillStyle = alpha(tk.brand, 0.12);
      ctx.fillRect(0, fy + sq, W, course.floorY - fy - sq);
      ctx.font = `800 13px ${CANVAS_FONT}`;
      ctx.textAlign = "center";
      ctx.fillStyle = tk.brand;
      ctx.fillText("FINISH", W / 2, fy - 18);
    }

    // 세그먼트
    ctx.lineCap = "round";
    for (const sg of course.segs) {
      if (!sg.live || sg.maxY < top || sg.minY > bot) continue;
      if (sg.kind === "gate") {
        ctx.strokeStyle = tk.warning;
        ctx.setLineDash([10, 8]);
        ctx.lineWidth = sg.t;
      } else if (sg.kind === "wall") {
        ctx.strokeStyle = alpha(tk.brand, 0.9);
        ctx.setLineDash([]);
        ctx.lineWidth = sg.t;
      } else {
        ctx.setLineDash([]);
        ctx.strokeStyle = alpha(tk.brand, 0.22);
        ctx.lineWidth = sg.t + 6;
        ctx.beginPath();
        ctx.moveTo(sg.ax, sg.ay);
        ctx.lineTo(sg.bx, sg.by);
        ctx.stroke();
        ctx.strokeStyle = tk.text2;
        ctx.lineWidth = sg.t;
      }
      ctx.beginPath();
      ctx.moveTo(sg.ax, sg.ay);
      ctx.lineTo(sg.bx, sg.by);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 핀·범퍼
    for (const c of course.circles) {
      if (c.y + c.r < top || c.y - c.r > bot) continue;
      if (c.kind === "peg") {
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.fillStyle = tk.text3;
        ctx.fill();
      } else {
        const rr = c.r * (1 + c.flash * 0.18);
        ctx.beginPath();
        ctx.arc(c.x, c.y, rr, 0, Math.PI * 2);
        ctx.fillStyle = c.flash > 0 ? alpha(tk.brand, 0.35 + c.flash * 0.6) : tk.brandSoft;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = tk.brand;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(c.x, c.y, rr * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = tk.brand;
        ctx.fill();
      }
    }

    // 회전 패들
    for (const p of course.paddles) {
      if (p.cy + p.len < top || p.cy - p.len > bot) continue;
      const hx = (Math.cos(p.ang) * p.len) / 2;
      const hy = (Math.sin(p.ang) * p.len) / 2;
      ctx.strokeStyle = alpha(tk.warning, 0.25);
      ctx.lineWidth = p.t + 6;
      ctx.beginPath();
      ctx.moveTo(p.cx - hx, p.cy - hy);
      ctx.lineTo(p.cx + hx, p.cy + hy);
      ctx.stroke();
      ctx.strokeStyle = tk.warning;
      ctx.lineWidth = p.t;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.cx, p.cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = tk.bg;
      ctx.fill();
    }

    // 구슬 꼬리
    marbles.forEach((m, i) => {
      const tr = trails[i];
      if (tr.length < 2) return;
      const col = players[i].color;
      const boosting = m.boostT > 0;
      for (let k = 1; k < tr.length; k++) {
        const a = (k / tr.length) * (boosting ? 0.7 : 0.28);
        ctx.strokeStyle = alpha(boosting ? tk.brand : col, a);
        ctx.lineWidth = m.r * (boosting ? 1.6 : 1.1) * (k / tr.length);
        ctx.beginPath();
        ctx.moveTo(tr[k - 1].x, tr[k - 1].y);
        ctx.lineTo(tr[k].x, tr[k].y);
        ctx.stroke();
      }
    });

    // 구슬
    marbles.forEach((m, i) => {
      if (m.y < top - 20 || m.y > bot + 20) return;
      if (m.magnetT > 0) {
        ctx.setLineDash([4, 5]);
        ctx.strokeStyle = alpha(tk.text, 0.5);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(W / 2, m.y + 30);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      drawMarble(ctx, m.x, m.y, m.r, players[i].color, firstChar(players[i].name), m.rot * 0.15, tk);
      if (m.shieldT > 0) {
        const pulse = 0.6 + Math.sin(realT * 10) * 0.2;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r + 6, 0, Math.PI * 2);
        ctx.fillStyle = alpha(tk.success, 0.12);
        ctx.fill();
        ctx.strokeStyle = alpha(tk.success, pulse);
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    // 링 효과 (월드)
    for (const f of fx) {
      if (f.kind !== "ring") continue;
      const k = (realT - f.t0) / f.dur;
      if (k < 0 || k > 1) continue;
      const m = marbles[f.i];
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r + 4 + k * 34, 0, Math.PI * 2);
      ctx.strokeStyle = alpha(f.color.startsWith("#") ? f.color : tk.brand, 1 - k);
      ctx.lineWidth = 3 * (1 - k) + 0.5;
      ctx.stroke();
    }

    /* ---- 화면 좌표 (선명한 글자) ---- */
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const toScreen = (x, y) => [ox + x * s, oy + y * s];
    const rankNow = decided ? finalRank : engine.ranking();
    const runningNow = rankNow.filter((i) => !marbles[i].finished);
    const danger = decided ? loserIdx : phase === "race" && runningNow.length >= 2 ? (rule === "last" ? runningNow[runningNow.length - 1] : rankNow[0]) : -1;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    marbles.forEach((m, i) => {
      const [x, y] = toScreen(m.x, m.y);
      if (y < -20 || y > h + 20) return;
      const isD = i === danger && (!m.finished || decided);
      const label = isD ? `${penaltyEmoji(penalty)} ${players[i].name}` : players[i].name;
      ctx.font = `700 ${isD ? 12 : 11}px ${CANVAS_FONT}`;
      const tw = ctx.measureText(label).width + 12;
      const ly = y - m.r * s - 12;
      roundRect(ctx, x - tw / 2, ly - 9, tw, 18, 9);
      ctx.fillStyle = isD ? tk.danger : "rgba(8,9,12,0.62)";
      ctx.fill();
      ctx.fillStyle = isD ? "#fff" : tk.text;
      ctx.fillText(label, x, ly + 0.5);
      if (m.slowT > 0) {
        ctx.save();
        ctx.translate(x + m.r * s + 6, y - m.r * s);
        ctx.rotate(realT * 8);
        ctx.font = `16px ${CANVAS_FONT}`;
        ctx.fillText("🍌", 0, 0);
        ctx.restore();
      }
    });

    // 떠오르는 라벨, 투사체
    for (const f of fx) {
      const k = (realT - f.t0) / f.dur;
      if (k < 0 || k > 1) continue;
      if (f.kind === "float") {
        const m = marbles[f.follow];
        const [x, y] = toScreen(m.x, m.y);
        ctx.globalAlpha = Math.min(1, (1 - k) * 2);
        ctx.font = `800 ${16 + (1 - Math.min(1, k * 5)) * 8}px ${CANVAS_FONT}`;
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(8,9,12,0.85)";
        const yy = y - m.r * s - 34 - k * 40;
        ctx.strokeText(f.text, x, yy);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, x, yy);
        ctx.globalAlpha = 1;
      } else if (f.kind === "proj") {
        const a = marbles[f.from];
        const b = marbles[f.to];
        const [x1, y1] = toScreen(a.x, a.y);
        const [x2, y2] = toScreen(b.x, b.y);
        const e = k;
        const x = x1 + (x2 - x1) * e;
        const y = y1 + (y2 - y1) * e - Math.sin(e * Math.PI) * 90;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(e * 12);
        ctx.font = `22px ${CANVAS_FONT}`;
        ctx.fillText(f.text, 0, 0);
        ctx.restore();
      }
    }

    // 미니맵 (진행도)
    const mx = w - 10;
    const my0 = 70;
    const my1 = h - 24;
    ctx.strokeStyle = alpha(tk.text3, 0.5);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(mx, my0);
    ctx.lineTo(mx, my1);
    ctx.stroke();
    ctx.font = `12px ${CANVAS_FONT}`;
    ctx.fillText("🏁", mx - 2, my1 + 12);
    marbles.forEach((m, i) => {
      const p = Math.max(0, Math.min(1, m.y / course.finishY));
      ctx.beginPath();
      ctx.arc(mx, my0 + (my1 - my0) * p, i === danger ? 5 : 4, 0, Math.PI * 2);
      ctx.fillStyle = players[i].color;
      ctx.fill();
      if (i === danger) {
        ctx.strokeStyle = tk.danger;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    // 슬로모션 비네트
    const slowA = Math.max(0, Math.min(1, (1 - timeScale) / 0.7));
    if (slowA > 0.01) {
      const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.7);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, `rgba(0,0,0,${0.72 * slowA})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = slowA;
      ctx.font = `800 12px ${CANVAS_FONT}`;
      ctx.textAlign = "left";
      ctx.fillStyle = tk.danger;
      ctx.beginPath();
      ctx.arc(20, 70, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = tk.text;
      ctx.fillText("슬로모션 0.3x", 30, 70.5);
      ctx.textAlign = "center";
      ctx.globalAlpha = 1;
    }

    // 화면 플래시
    if (flash) {
      const k = (realT - flash.t0) / 0.35;
      if (k >= 1) flash = null;
      else {
        ctx.fillStyle = alpha(flash.color, flash.a * (1 - k));
        ctx.fillRect(0, 0, w, h);
      }
    }

    // 카운트다운
    if (phase === "countdown") {
      const left = 3 - realT;
      const num = Math.ceil(left);
      const k = 1 - (left - Math.floor(left));
      ctx.globalAlpha = 1 - k * 0.6;
      ctx.font = `800 ${96 + k * 30}px ${CANVAS_FONT}`;
      ctx.lineWidth = 8;
      ctx.strokeStyle = "rgba(8,9,12,0.8)";
      ctx.strokeText(String(num), w / 2, h * 0.5);
      ctx.fillStyle = tk.brand;
      ctx.fillText(String(num), w / 2, h * 0.5);
      ctx.globalAlpha = 1;
      ctx.font = `700 15px ${CANVAS_FONT}`;
      ctx.fillStyle = tk.text;
      ctx.fillText(rule === "last" ? `꼴찌가 ${penalty || "벌칙"}!` : `1등이 ${penalty || "벌칙"}!`, w / 2, h * 0.5 + 76);
    } else if (realT < 3.7) {
      const k = (realT - 3) / 0.7;
      ctx.globalAlpha = 1 - k;
      ctx.font = `800 ${64 + k * 40}px ${CANVAS_FONT}`;
      ctx.lineWidth = 8;
      ctx.strokeStyle = "rgba(8,9,12,0.8)";
      ctx.strokeText("출발!", w / 2, h * 0.5);
      ctx.fillStyle = tk.brand;
      ctx.fillText("출발!", w / 2, h * 0.5);
      ctx.globalAlpha = 1;
    }

    // 해설 자막
    drawCaption(ctx, caster.get(realT), w, 12, tk);

    // 결정 도장
    if (decided) {
      const k = Math.min(1, (realT - decidedAt - 0.15) / 0.28);
      if (k > 0) {
        const sc = 1 + (1 - k) * 1.4;
        const text = `${penaltyEmoji(penalty)} ${headline(players[loserIdx].name, penalty)}`;
        ctx.save();
        ctx.translate(w / 2, h * 0.42);
        ctx.rotate(-0.12);
        ctx.scale(sc, sc);
        ctx.globalAlpha = Math.min(1, k * 1.5);
        ctx.font = `900 26px ${CANVAS_FONT}`;
        const tw = Math.min(w - 40, ctx.measureText(text).width + 40);
        roundRect(ctx, -tw / 2, -34, tw, 68, 14);
        ctx.fillStyle = "rgba(8,9,12,0.72)";
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = tk.danger;
        ctx.stroke();
        ctx.fillStyle = tk.danger;
        ctx.fillText(text, 0, 2, tw - 24);
        ctx.restore();
      }
    }

    // 워터마크 (영상용)
    ctx.textAlign = "left";
    ctx.font = `700 11px ${CANVAS_FONT}`;
    ctx.fillStyle = alpha(tk.text3, 0.9);
    ctx.fillText("🎯 누가 쏠래?", 12, h - 14);
    ctx.textAlign = "center";
  }

  /* ---------- 루프 ---------- */
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
        if (num === 3) say(`${n}명 출발선에 섰습니다!`, 1);
      }
      if (realT >= 3) {
        phase = "race";
        engine.open();
        tray.enable(true);
        haptic(40);
        say(pick(["자, 출발합니다!", "게이트 오픈! 레이스 시작이에요!"]), 2);
      }
    }

    timeScale = damp(timeScale, targetScale, slowmo ? 8 : 4, dt);
    acc += dt * timeScale;
    let steps = 0;
    while (acc >= STEP && steps < 10) {
      engine.step();
      acc -= STEP;
      steps++;
    }
    if (steps >= 10) acc = 0;

    marbles.forEach((m, i) => {
      const tr = trails[i];
      tr.push({ x: m.x, y: m.y });
      if (tr.length > 9) tr.shift();
    });
    for (let k = fx.length - 1; k >= 0; k--) if (realT - fx[k].t0 > fx[k].dur + 0.2) fx.splice(k, 1);

    logic(dt);
    updateCamera(dt);
    draw();

    if (decided && realT - decidedAt > 2.6 && phase === "race") {
      phase = "done";
      finish();
    }
  }

  async function finish() {
    const video = recorder ? await recorder.stop() : null;
    if (stopped) return;
    cleanup();
    const rows = finalRank.map((i, k) => ({
      name: players[i].name,
      color: players[i].color,
      label: `${k + 1}등`,
      sub: marbles[i].finished ? `${marbles[i].finishT.toFixed(1)}초` : "결정 시점 위치",
      isLoser: i === loserIdx,
    }));
    onDone({ rows, loser: players[loserIdx].name, video, videoExt: recorder?.ext });
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

export { ITEMS };
