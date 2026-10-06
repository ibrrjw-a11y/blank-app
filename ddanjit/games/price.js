// 💸 그때 그 가격 — 업·다운 힌트로 그 시절 가격 맞히기 (±10% 정답)
import { $, fmt, haptic } from "../../shared/kit.js";
import { pickDaily, esc, shake } from "../core.js";
import { PRICES } from "../data/price.js";

const MAX = 5;
const TOL = 0.1;
// 고정 로그 눈금 (1원 ~ 10만원) — 정답 위치를 드러내지 않게 항상 같은 눈금
const LMIN = 0;
const LMAX = 5;
const TICKS = [1, 10, 100, 1000, 10000, 100000];
const tickLabel = (v) => (v >= 10000 ? `${v / 10000}만` : v >= 1000 ? `${v / 1000}천` : `${v}`);

const puzzle = () => pickDaily(PRICES, "price");

function evaluate(guess, p) {
  const diff = (guess - p.then) / p.then;
  const ok = Math.abs(diff) <= TOL;
  const ratio = Math.max(guess / p.then, p.then / guess);
  const level = ok ? "win" : ratio <= 1.35 ? "hot" : ratio <= 2 ? "warm" : "cold";
  return { guess, ok, up: guess < p.then, level };
}

const LABEL = { hot: "🔥 아주 가까워요", warm: "♨️ 가까워요", cold: "🧊 멀어요", win: "✅ 정답!" };
const pos = (v) => ((Math.log10(Math.max(1, v)) - LMIN) / (LMAX - LMIN)) * 100;

export default {
  id: "price",
  name: "그때 그 가격",
  emoji: "💸",
  tagline: "업·다운 힌트로 옛날 물가 맞히기",
  max: MAX,
  distKeys: ["1", "2", "3", "4", "5", "X"],
  distLabel: (k) => (k === "X" ? "실패" : `${k}번`),
  started: (s) => s.guesses.length > 0,

  summary(s) {
    if (!s?.done) return null;
    const p = puzzle();
    const rs = s.guesses.map((g) => evaluate(g, p));
    const n = rs.length;
    return {
      won: s.won,
      distKey: s.won ? String(n) : "X",
      grid: rs.map((r) => (r.ok ? "✅" : r.up ? "⬆️" : "⬇️")).join(""),
      scoreText: s.won ? `${n}번 만에 맞힘` : "이번엔 못 맞힘",
      headline: s.won ? `${n}번 만에 맞혔어요!` : "아쉬워요, 생각보다 어려웠죠?",
    };
  },

  reveal(s) {
    const p = puzzle();
    const times = p.then ? p.now / p.then : 0;
    const timesText = times >= 1.05 ? `약 ${times >= 10 ? Math.round(times) : times.toFixed(1)}배` : "거의 그대로";
    return `
      <div class="stack gap-4">
        <span class="t-caption-01 t-tertiary">${p.year}년 · ${esc(p.item)}${p.item.includes(p.unit) ? "" : ` (${esc(p.unit)})`}</span>
        <b class="t-title-02" >${p.exact ? "" : "대략 "}${fmt.won(p.then)}</b>
      </div>
      <div class="then-now">
        <div><small>${p.year}년 ${p.exact ? "" : "대략"}</small><b>${fmt.won(p.then)}</b></div>
        <span class="t-label-01 t-tertiary">→</span>
        <div><small>${p.nowLabel || "요즘 대략"}</small><b>${fmt.won(p.now)}</b></div>
      </div>
      <p class="fact">${esc(p.note)} 그때보다 ${timesText}예요.</p>
      <p class="t-caption-01 t-tertiary" style="margin:0">${p.exact ? "공식 고시 값이에요." : "지역·가게마다 차이가 있는 대략적인 당시 평균가예요."}</p>`;
  },

  mount(root, api) {
    const p = puzzle();
    const s = api.state || { guesses: [], done: false, won: false };
    root.innerHTML = `
      <div class="crt price__q">
        <span class="price__emoji" aria-hidden="true">${p.emoji}</span>
        <span class="price__year">${p.year}</span>
        <span class="price__item">${esc(p.item)}</span>
        <p class="price__text">${esc(p.q)}</p>
        <span class="badge price__badge">${p.exact ? "공식 고시 값 · ±10% 안이면 정답" : "대략적인 당시 평균가 · ±10% 안이면 정답"}</span>
        <div class="crt__scan"></div>
      </div>
      <p class="msg" id="pmsg" aria-live="polite"></p>
      <form class="answer" id="pform" autocomplete="off">
        <label class="won-field"><span>원</span><input class="input" id="pin" inputmode="numeric" placeholder="얼마였을까요?" enterkeyhint="done" aria-label="가격(원)" /></label>
        <button class="btn btn--primary" type="submit">확인</button>
      </form>
      <div class="range" id="prange">
        <div class="range__label"><span>힌트 범위</span><b id="pknown">아직 몰라요</b></div>
        <div class="range__track" id="ptrack"><div class="range__known" id="pband" style="left:0;width:100%"></div></div>
        <div class="range__ticks">${TICKS.map((t) => `<span style="left:${pos(t)}%">${tickLabel(t)}</span>`).join("")}</div>
      </div>
      <ol class="rows" id="prows"></ol>
      <div class="done-bar" id="pdone" hidden><button class="btn btn--primary btn--lg" id="pres">결과 보기</button></div>`;

    function bounds(rs) {
      let lo = 0;
      let hi = Infinity;
      rs.forEach((r) => {
        if (r.ok) return;
        if (r.up) lo = Math.max(lo, r.guess);
        else hi = Math.min(hi, r.guess);
      });
      return { lo, hi };
    }

    function paint(animateLast = false) {
      const rs = s.guesses.map((g) => evaluate(g, p));
      $("#prows", root).innerHTML = Array.from({ length: MAX }, (_, i) => {
        const r = rs[i];
        if (!r) return `<li class="is-empty"></li>`;
        const pct = r.ok ? 100 : Math.max(8, Math.round((1 / Math.max(r.guess / p.then, p.then / r.guess)) * 100));
        return `<li class="prow heat-${r.level} ${animateLast && i === rs.length - 1 ? "is-new" : ""}" style="--_p:${pct}%">
          <span><b class="t-num">${fmt.won(r.guess)}</b> <span class="t-secondary">${r.ok ? "" : r.up ? "⬆️ 더 비쌌어요" : "⬇️ 더 쌌어요"}</span></span>
          <span class="prow__hint">${LABEL[r.level]}</span>
        </li>`;
      }).join("");
      const { lo, hi } = bounds(rs);
      const band = $("#pband", root);
      const l = lo ? pos(lo) : 0;
      const r = hi === Infinity ? 100 : pos(hi);
      band.style.left = `${l}%`;
      band.style.width = `${Math.max(1, r - l)}%`;
      $("#pknown", root).textContent =
        !lo && hi === Infinity ? "아직 몰라요" : `${lo ? fmt.won(lo) + " 초과" : "0원"} ~ ${hi === Infinity ? "?" : fmt.won(hi) + " 미만"}`;
      $("#ptrack", root).querySelectorAll(".range__mark").forEach((m) => m.remove());
      rs.forEach((x) => {
        const m = document.createElement("i");
        m.className = `range__mark heat-${x.level}`;
        m.style.left = `${Math.min(100, pos(x.guess))}%`;
        $("#ptrack", root).appendChild(m);
      });
      api.setTries(
        Array.from({ length: MAX }, (_, i) => {
          const x = rs[i];
          if (x) return x.ok ? "hit" : x.level === "hot" || x.level === "warm" ? "near" : "miss";
          return !s.done && i === rs.length ? "now" : "";
        })
      );
      if (s.done) {
        $("#pform", root).hidden = true;
        $("#pdone", root).hidden = false;
        const m = $("#pmsg", root);
        m.className = `msg ${s.won ? "is-good" : "is-bad"}`;
        m.textContent = s.won ? `정답! ${p.exact ? "" : "대략 "}${fmt.won(p.then)}` : `정답은 ${p.exact ? "" : "대략 "}${fmt.won(p.then)}이었어요`;
      }
    }

    const input = $("#pin", root);
    input.addEventListener("input", () => {
      const digits = input.value.replace(/[^\d]/g, "").slice(0, 8);
      input.value = digits ? Number(digits).toLocaleString("ko-KR") : "";
    });

    $("#pform", root).addEventListener("submit", (e) => {
      e.preventDefault();
      if (s.done) return;
      const v = Number(input.value.replace(/[^\d]/g, ""));
      const m = $("#pmsg", root);
      if (!v) {
        shake(input);
        m.className = "msg is-bad";
        m.textContent = "금액을 숫자로 적어주세요";
        return;
      }
      if (s.guesses.includes(v)) {
        shake(input);
        m.className = "msg";
        m.textContent = "이미 적었던 금액이에요";
        return;
      }
      s.guesses.push(v);
      input.value = "";
      const r = evaluate(v, p);
      if (r.ok) {
        s.done = true;
        s.won = true;
      } else if (s.guesses.length >= MAX) {
        s.done = true;
        s.won = false;
      }
      if (!r.ok) {
        haptic(15);
        shake($("#prange", root));
        m.className = "msg";
        m.textContent = r.up ? "그때는 그것보다 비쌌어요 ⬆️" : "그때는 그것보다 쌌어요 ⬇️";
      }
      paint(true);
      if (s.done) api.finish(s);
      else api.save(s);
    });
    $("#pres", root).addEventListener("click", () => api.openResult());
    paint(false);
  },
};
