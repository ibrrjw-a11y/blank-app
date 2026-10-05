// 모드들이 같이 쓰는 도우미: 색, 아이템, 조사, 해설, 녹화, 아이템 트레이
import { haptic, CANVAS_FONT, roundRect } from "../shared/kit.js";

// 구슬 색 (캔버스 일러스트 장식색 — 플레이어 식별용)
export const PALETTE = [
  "#ff5a3c", "#3da5ff", "#2ed47a", "#ffc43d", "#b46bff", "#ff4fa3",
  "#21d4c6", "#ff8a3d", "#8f9bff", "#9be15d", "#f2f4f8", "#ff7a8a",
];

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
  };
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
  ctx.globalAlpha = cap.alpha;
  let size = 15;
  ctx.font = `700 ${size}px ${CANVAS_FONT}`;
  const text = `🎙️ ${cap.text}`;
  let tw = ctx.measureText(text).width;
  while (tw > w - 48 && size > 11) {
    size -= 1;
    ctx.font = `700 ${size}px ${CANVAS_FONT}`;
    tw = ctx.measureText(text).width;
  }
  const pw = tw + 28;
  const ph = size + 18;
  const x = (w - pw) / 2;
  const pop = 1 + Math.max(0, 0.12 - cap.age) * 1.2;
  ctx.translate(w / 2, y + ph / 2);
  ctx.scale(pop, pop);
  ctx.translate(-w / 2, -(y + ph / 2));
  roundRect(ctx, x, y, pw, ph, ph / 2);
  ctx.fillStyle = "rgba(8,9,12,0.78)";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = tk.brand;
  ctx.stroke();
  ctx.fillStyle = tk.text;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, y + ph / 2 + 1);
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
export function drawMarble(ctx, x, y, r, color, letter, rot = 0, tk) {
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.15, x, y, r);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.22, color);
  g.addColorStop(1, shade(color, -0.45));
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.stroke();
  if (letter) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.font = `800 ${Math.round(r * 1.05)}px ${CANVAS_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(10,12,16,0.85)";
    ctx.fillText(letter, 0, r * 0.06);
    ctx.restore();
  }
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
