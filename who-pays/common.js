// 모드들이 같이 쓰는 도우미: 색, 아이템, 조사, 해설, 녹화, 아이템 트레이
import { haptic, CANVAS_FONT, roundRect } from "../shared/kit.js";

// 구슬 색 (캔버스 일러스트 장식색 — 플레이어 식별용)
// 실제 값은 style.css 의 --art-p1 ~ --art-p12 (아래는 CSS 를 못 읽을 때 대비)
const FALLBACK = [
  "#ff5a3c", "#29b6f6", "#3ddc84", "#ffd23f", "#ff4fb4", "#f4f6f9",
  "#19d3c5", "#ff9a2e", "#9fb4c8", "#a6e22e", "#ff7a8a", "#2f7bff",
];
export const PALETTE = (() => {
  try {
    const cs = getComputedStyle(document.documentElement);
    return FALLBACK.map((f, i) => cs.getPropertyValue(`--art-p${i + 1}`).trim() || f);
  } catch {
    return FALLBACK;
  }
})();

export const ITEMS = {
  boost: { emoji: "🚀", label: "부스트", desc: "내 구슬을 앞으로 쭉" },
  banana: { emoji: "🍌", label: "바나나", desc: "무작위 상대 미끄러뜨리기" },
  shield: { emoji: "🛡️", label: "방어막", desc: "3초 동안 바나나 무시" },
  magnet: { emoji: "🧲", label: "자석", desc: "잠깐 가운데로 끌어당기기" },
};
export const ITEM_KEYS = Object.keys(ITEMS);

/* ---------- 공정한 난수 (가능하면 crypto) ---------- */
export function randomSeed() {
  try {
    return crypto.getRandomValues(new Uint32Array(1))[0];
  } catch {
    return Math.floor(Math.random() * 2 ** 32);
  }
}

/* ---------- 한국어 조사 ---------- */
function hasBatchim(word) {
  const c = String(word).trim().slice(-1).charCodeAt(0);
  if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28 !== 0;
  if (c >= 48 && c <= 57) return "013678".includes(String.fromCharCode(c));
  return false;
}
// pair: "이/가" 처럼 [받침 있을 때/없을 때]
export const josa = (word, pair) => {
  const [a, b] = pair.split("/");
  return word + (hasBatchim(word) ? a : b);
};

/* ---------- 벌칙 표현 ---------- */
export function penaltyEmoji(p = "") {
  if (/커피|카페|라떼|아메리카노/.test(p)) return "☕";
  if (/점심|밥|저녁|식사/.test(p)) return "🍱";
  if (/아이스크림|아이스/.test(p)) return "🍦";
  if (/설거지|청소/.test(p)) return "🧽";
  if (/치킨/.test(p)) return "🍗";
  if (/술|맥주|소주/.test(p)) return "🍺";
  return "🎯";
}
// 사는 벌칙이면 "쏩니다", 아니면 "당첨"
export const isTreat = (p = "") => /커피|카페|점심|밥|저녁|아이스크림|치킨|술|맥주|간식|쏘기|사기|피자|디저트/.test(p);

export function headline(name, penalty) {
  return isTreat(penalty) ? `${josa(name, "이/가")} 쏩니다!` : `${name} 당첨!`;
}

export function debtLabel(penalty = "", n) {
  if (/커피|카페/.test(penalty)) return `커피 빚 ${n}잔`;
  if (/아이스크림/.test(penalty)) return `아이스크림 빚 ${n}개`;
  if (/점심|밥|저녁/.test(penalty)) return `밥 빚 ${n}번`;
  if (/설거지/.test(penalty)) return `설거지 ${n}번 밀림`;
  return `${penalty || "벌칙"} 빚 ${n}번`;
}

/* ---------- 토큰 읽기 (캔버스 색) ---------- */
export function readTokens() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n) => cs.getPropertyValue(n).trim();
  return {
    brand: v("--brand"),
    brandSoft: v("--brand-soft"),
    bg: v("--color-bg"),
    surface: v("--color-surface"),
    raised: v("--color-surface-raised"),
    sunken: v("--color-surface-sunken"),
    text: v("--color-text"),
    text2: v("--color-text-secondary"),
    text3: v("--color-text-tertiary"),
    border: v("--color-border"),
    borderStrong: v("--color-border-strong"),
    danger: v("--color-danger"),
    success: v("--color-success"),
    warning: v("--color-warning"),
    asphalt: v("--art-asphalt") || v("--color-surface"),
    line: v("--art-line") || v("--color-border"),
    chalk: v("--art-chalk") || v("--color-text"),
    display: `${v("--font-display") || CANVAS_FONT}`,
    num: `${v("--art-font-num") || CANVAS_FONT}`,
  };
}

/* ---------- 모션 도우미 ---------- */
// 오버슈트 스프링 (0→1, 약 12% 튀었다 자리 잡음)
export const spring = (t) => (t <= 0 ? 0 : t >= 1.6 ? 1 : 1 - Math.exp(-7 * t) * Math.cos(10.5 * t));
// 착지 스쿼시 양 (τ초 경과) — 양수면 납작, 음수면 길쭉
export const squashAmt = (tau, amp = 0.35) => (tau < 0 ? 0 : amp * Math.exp(-7 * tau) * Math.cos(16 * tau));

// 기울어진 방송 그래픽 판 (평행사변형)
export function slant(ctx, x, y, w, h, k = 8) {
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.lineTo(x + w + k, y);
  ctx.lineTo(x + w - k, y + h);
  ctx.lineTo(x - k, y + h);
  ctx.closePath();
}

/* ---------- 해설 (읽을 수 있게 간격 조절) ---------- */
export function createCaster() {
  let cur = null;
  let shownAt = -99;
  let pending = null;
  const MIN = 1.5; // 최소 노출 시간(초)
  const HOLD = 2.6;
  return {
    say(text, prio = 1, now) {
      if (!text) return;
      const busy = cur && now - shownAt < MIN;
      if (!busy || prio > cur.prio + 1) {
        cur = { text, prio };
        shownAt = now;
        pending = null;
      } else if (!pending || prio >= pending.prio) {
        pending = { text, prio, at: now };
      }
    },
    get(now) {
      if (pending && now - shownAt >= MIN) {
        if (now - pending.at < 2.2) {
          cur = { text: pending.text, prio: pending.prio };
          shownAt = now;
        }
        pending = null;
      }
      if (!cur) return null;
      const age = now - shownAt;
      if (age > HOLD) return null;
      const a = Math.min(1, age / 0.18) * Math.min(1, (HOLD - age) / 0.3);
      return { text: cur.text, alpha: a, age };
    },
  };
}

export function drawCaption(ctx, cap, w, y, tk) {
  if (!cap) return;
  ctx.save();
  const intro = Math.min(1, cap.age / 0.32);
  const sp = spring(cap.age / 0.5);
  ctx.globalAlpha = Math.min(1, (2.6 - cap.age) / 0.3);
  let size = 15;
  ctx.font = `700 ${size}px ${CANVAS_FONT}`;
  let tw = ctx.measureText(cap.text).width;
  const tagW = 50;
  while (tw > w - tagW - 48 && size > 11) {
    size -= 1;
    ctx.font = `700 ${size}px ${CANVAS_FONT}`;
    tw = ctx.measureText(cap.text).width;
  }
  const h = size + 20;
  const x0 = 14;
  const pw = tw + 28;
  // 태그 (먼저 들어오고) → 본문 판이 사선으로 닦이며 열림
  ctx.translate((1 - sp) * -80, 0);
  slant(ctx, x0, y, tagW, h, 6);
  ctx.fillStyle = tk.brand;
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `800 ${size}px ${tk.display}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("중계", x0 + tagW / 2, y + h / 2 + 1);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0 + tagW, y - 2, (pw + 20) * intro, h + 4);
  ctx.clip();
  slant(ctx, x0 + tagW + 2, y, pw, h, 6);
  ctx.fillStyle = tk.chalk;
  ctx.fill();
  ctx.fillStyle = tk.bg;
  ctx.font = `700 ${size}px ${CANVAS_FONT}`;
  ctx.textAlign = "left";
  ctx.fillText(cap.text, x0 + tagW + 16, y + h / 2 + 1);
  ctx.restore();
  ctx.restore();
}

/* ---------- 캔버스 녹화 ---------- */
export function createRecorder(canvas) {
  if (typeof MediaRecorder === "undefined" || !canvas.captureStream) return null;
  const types = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  const mime = types.find((t) => {
    try {
      return MediaRecorder.isTypeSupported(t);
    } catch {
      return false;
    }
  });
  if (!mime) return null;
  let rec;
  const chunks = [];
  try {
    const stream = canvas.captureStream(30);
    rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
  } catch {
    return null;
  }
  rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
  return {
    mime,
    ext: mime.includes("mp4") ? "mp4" : "webm",
    start() {
      try {
        rec.start(500);
      } catch {
        /* noop */
      }
    },
    pause() {
      if (rec.state === "recording") rec.pause();
    },
    resume() {
      if (rec.state === "paused") rec.resume();
    },
    stop() {
      return new Promise((resolve) => {
        if (rec.state === "inactive") return resolve(chunks.length ? new Blob(chunks, { type: mime }) : null);
        rec.onstop = () => resolve(chunks.length ? new Blob(chunks, { type: mime.split(";")[0] }) : null);
        try {
          rec.stop();
        } catch {
          resolve(null);
        }
      });
    },
  };
}

/* ---------- 아이템 트레이 (DOM) ---------- */
export function renderTray(el, players, onUse) {
  const cols = players.length <= 3 ? players.length : 4;
  el.innerHTML = `
    <p class="tray__hint">내 이름을 눌러 아이템을 써요 · 한 사람당 한 번!</p>
    <div class="tray__grid" style="--cols:${cols}">
      ${players
        .map(
          (p, i) => `<button class="item-btn" data-i="${i}" style="--pc:${p.color}" disabled>
            <span class="item-btn__emoji" aria-hidden="true">${ITEMS[p.item].emoji}</span>
            <span class="item-btn__text"><span class="item-btn__name">${escapeHtml(p.name)}</span>
            <span class="item-btn__kind">${ITEMS[p.item].label}</span></span>
          </button>`
        )
        .join("")}
    </div>`;
  const btns = [...el.querySelectorAll(".item-btn")];
  btns.forEach((b) =>
    b.addEventListener("click", () => {
      const i = Number(b.dataset.i);
      if (b.disabled) return;
      const ok = onUse(i);
      if (ok) {
        haptic([18, 30, 18]);
        b.classList.add("is-fired");
        b.disabled = true;
        b.querySelector(".item-btn__kind").textContent = "사용함";
      }
    })
  );
  return {
    enable(on = true) {
      btns.forEach((b) => {
        if (!b.classList.contains("is-fired") && !b.classList.contains("is-out")) b.disabled = !on;
      });
    },
    out(i, label = "도착") {
      const b = btns[i];
      if (!b || b.classList.contains("is-fired")) return;
      b.classList.add("is-out");
      b.disabled = true;
      b.querySelector(".item-btn__kind").textContent = label;
    },
  };
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/* ---------- 구슬 그리기 (레이스·배틀·인트로 공용) ---------- */
export function drawMarble(ctx, x, y, r, color, letter, rot = 0, tk, sx = 1, sy = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, sy);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  // 평면 음영: 아래쪽 반달 + 위쪽 하이라이트
  ctx.save();
  ctx.clip();
  ctx.beginPath();
  ctx.arc(r * 0.35, r * 0.45, r * 1.05, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.ellipse(-r * 0.38, -r * 0.42, r * 0.28, r * 0.16, -0.6, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fill();
  ctx.lineWidth = Math.max(1.2, r * 0.12);
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  if (letter) {
    ctx.rotate(rot);
    ctx.font = `800 ${Math.round(r * 1.05)}px ${CANVAS_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(10,12,16,0.88)";
    ctx.fillText(letter, 0, r * 0.06);
  }
  ctx.restore();
}

// #rrggbb 밝기 조정 (일러스트 내부 음영용)
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  r = Math.round((t - r) * p + r);
  g = Math.round((t - g) * p + g);
  b = Math.round((t - b) * p + b);
  return `rgb(${r},${g},${b})`;
}

export function alpha(hex, a) {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function firstChar(name) {
  return Array.from(String(name).trim())[0] || "?";
}

/* ---------- 캔버스 크기 맞춤 (DPR) ---------- */
export function fitCanvas(canvas, maxDpr = 2) {
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  return { w, h, dpr };
}

// 부드러운 감쇠 보간 (프레임 독립)
export const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));

/* ---------- 중계 그래픽 오버레이 (레이스·배틀 공용) ---------- */
// F1 출발 신호: 1초마다 불이 하나씩 켜지고, 모두 꺼지면 출발
export function drawStartLights(ctx, w, h, t, tk, sub) {
  const n = 3;
  const size = 40;
  const gap = 10;
  const total = n * size + (n - 1) * gap + 24;
  const x0 = (w - total) / 2;
  const y0 = h * 0.34;
  if (t < 3) {
    const enter = spring(t / 0.5);
    ctx.save();
    ctx.translate(0, (1 - enter) * -60);
    ctx.fillStyle = "#000";
    ctx.fillRect(x0, y0, total, size + 24);
    for (let k = 0; k < n; k++) {
      const on = t >= k;
      const cx = x0 + 12 + size / 2 + k * (size + gap);
      ctx.beginPath();
      ctx.arc(cx, y0 + 12 + size / 2, size / 2 - 2, 0, Math.PI * 2);
      ctx.fillStyle = on ? tk.brand : "rgba(255,255,255,0.08)";
      ctx.fill();
      if (on) {
        const pop = squashAmt(t - k, 0.25);
        ctx.beginPath();
        ctx.arc(cx, y0 + 12 + size / 2, (size / 2 - 2) * (1 + Math.abs(pop)) + 4, 0, Math.PI * 2);
        ctx.strokeStyle = alpha(tk.brand, 0.35);
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }
    ctx.restore();
    if (sub) {
      ctx.font = `800 16px ${tk.display}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = tk.chalk;
      ctx.fillText(sub, w / 2, y0 + size + 56);
    }
  } else if (t < 3.8) {
    const k = (t - 3) / 0.8;
    ctx.save();
    ctx.translate(w / 2, h * 0.42);
    const s = spring(k * 1.4);
    ctx.scale(s * (1 + squashAmt(k - 0.2, 0.15)), s * (1 - squashAmt(k - 0.2, 0.15)));
    ctx.globalAlpha = 1 - Math.max(0, (k - 0.6) / 0.4);
    ctx.font = `800 84px ${tk.num}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(8,9,12,0.9)";
    ctx.strokeText("GO!", 0, 0);
    ctx.fillStyle = tk.brand;
    ctx.fillText("GO!", 0, 0);
    ctx.restore();
  }
}

// 판정 판: 예비동작(커졌다) → 쾅 찍힘 → 여운
export function drawVerdict(ctx, w, y, text, age, tk) {
  if (age < 0) return;
  let sc;
  if (age < 0.18) sc = 1.7 + (age / 0.18) * 0.3;
  else sc = 2 - spring((age - 0.18) / 0.6);
  const land = age - 0.26;
  const sq = land > 0 ? squashAmt(land, 0.14) : 0;
  ctx.save();
  const shake = land > 0 && land < 0.3 ? (Math.random() - 0.5) * 10 * (1 - land / 0.3) : 0;
  ctx.translate(w / 2 + shake, y + shake);
  ctx.rotate(-0.08);
  ctx.scale(sc * (1 + sq), sc * (1 - sq));
  ctx.globalAlpha = age < 0.18 ? 0.5 : 1;
  let fs = 30;
  ctx.font = `800 ${fs}px ${tk.display}`;
  while (ctx.measureText(text).width > w - 90 && fs > 18) {
    fs -= 2;
    ctx.font = `800 ${fs}px ${tk.display}`;
  }
  const tw = ctx.measureText(text).width + 44;
  slant(ctx, -tw / 2, -32, tw, 64, 10);
  ctx.fillStyle = tk.brand;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#fff";
  ctx.stroke();
  slant(ctx, -tw / 2 - 6, 30, 70, 18, 4);
  ctx.fillStyle = tk.chalk;
  ctx.fill();
  ctx.fillStyle = tk.bg;
  ctx.font = `400 12px ${tk.num}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("FINAL", -tw / 2 + 29, 39.5);
  ctx.fillStyle = "#fff";
  ctx.font = `800 ${fs}px ${tk.display}`;
  ctx.fillText(text, 0, 2);
  ctx.restore();
}

// 슬로모션 버그 + 비네트 + 진입 순간 사선 와이프
export function drawSlowmo(ctx, w, h, slowA, sinceStart, tk) {
  if (slowA <= 0.01) return;
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.28, w / 2, h / 2, Math.max(w, h) * 0.7);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, `rgba(0,0,0,${0.7 * slowA})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  // 진입 스팅어
  if (sinceStart >= 0 && sinceStart < 0.45) {
    const p = sinceStart / 0.45;
    const x = -w * 0.7 + p * p * w * 2.6;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + w * 0.5, 0);
    ctx.lineTo(x + w * 0.5 - h * 0.3, h);
    ctx.lineTo(x - h * 0.3, h);
    ctx.closePath();
    ctx.fillStyle = alpha(tk.brand, 0.9);
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha = slowA;
  const bw = 112;
  const x = w - bw - 26;
  slant(ctx, x, 12, bw, 24, 5);
  ctx.fillStyle = tk.brand;
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `400 14px ${tk.num}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("SLOW-MO  0.3×", x + bw / 2, 24.5);
  ctx.restore();
}

// 라이브 타이밍 타워. rows: [{i, name, color, gap, hot}] 순위순. pos: 행별 스프링 상태 저장소
export function drawTower(ctx, rows, pos, dt, tk, { x = 10, y = 10, title = "LIVE", total = rows.length } = {}) {
  const rowH = 19;
  const wdt = 118;
  slant(ctx, x, y, wdt, 16, 0);
  ctx.fillStyle = tk.brand;
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `400 11px ${tk.num}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(title, x + 6, y + 8.5);
  ctx.textAlign = "right";
  ctx.fillText(`${total} 명`, x + wdt - 6, y + 8.5);
  rows.forEach((r, k) => {
    const slot = r.slot ?? k;
    const st = pos[r.i] || (pos[r.i] = { p: slot, v: 0 });
    if (Math.abs(st.p - slot) > 4) st.p = slot;
    const f = (slot - st.p) * 280 - st.v * 20;
    st.v += f * dt;
    st.p += st.v * dt;
    const ry = y + 18 + st.p * (rowH + 1);
    ctx.fillStyle = r.hot ? tk.brand : "rgba(10,11,13,0.84)";
    ctx.fillRect(x, ry, wdt, rowH);
    ctx.fillStyle = tk.chalk;
    ctx.fillRect(x, ry, 18, rowH);
    ctx.fillStyle = tk.bg;
    ctx.font = `400 12px ${tk.num}`;
    ctx.textAlign = "center";
    ctx.fillText(String(r.rank), x + 9, ry + rowH / 2 + 1);
    ctx.fillStyle = r.color;
    ctx.fillRect(x + 20, ry + 3, 3, rowH - 6);
    ctx.fillStyle = "#fff";
    ctx.font = `700 11px ${CANVAS_FONT}`;
    ctx.textAlign = "left";
    ctx.fillText(r.name, x + 28, ry + rowH / 2 + 1, 54);
    ctx.textAlign = "right";
    ctx.font = `400 10px ${tk.num}`;
    ctx.fillStyle = r.hot ? "#fff" : tk.text2;
    ctx.fillText(r.gap, x + wdt - 5, ry + rowH / 2 + 1);
  });
}
