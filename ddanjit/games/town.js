// 🧭 오늘의 동네 — 시·군·구 맞히기. 틀리면 거리·방향·가까움(%)이 힌트
import { $, haptic } from "../../shared/kit.js";
import { pickDaily, norm, esc, shake } from "../core.js";
import { TOWNS, SIDO_FULL } from "../data/town.js";

const MAX = 6;
const FAR = 500; // 이 거리(km) 이상이면 가까움 0%
const DIRS = ["⬆️", "↗️", "➡️", "↘️", "⬇️", "↙️", "⬅️", "↖️"];
const DIR_KO = ["북쪽", "북동쪽", "동쪽", "남동쪽", "남쪽", "남서쪽", "서쪽", "북서쪽"];

const answer = () => pickDaily(TOWNS, "town");

const rad = (d) => (d * Math.PI) / 180;
export function haversine(a, b) {
  const R = 6371;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export function bearing(a, b) {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function evaluate(id) {
  const g = TOWNS[id];
  const a = answer();
  if (g.id === a.id) return { id, km: 0, dir: -1, pct: 100, ok: true };
  const km = haversine(g, a);
  const dir = Math.round(bearing(g, a) / 45) % 8;
  const pct = Math.max(0, Math.min(99, Math.round((1 - km / FAR) * 100)));
  return { id, km: Math.max(1, Math.round(km)), dir, pct, ok: false };
}

const heat = (r) => (r.ok ? "heat-win" : r.pct >= 90 ? "heat-hot" : r.pct >= 75 ? "heat-warm" : r.pct >= 50 ? "heat-mild" : "heat-cold");
const square = (r) => (r.ok ? "🟩" : r.pct >= 90 ? "🟧" : r.pct >= 75 ? "🟨" : "⬜");

function projector(w, h, pad) {
  const lat0 = 33.1;
  const lat1 = 38.65;
  const lng0 = 125.95;
  const lng1 = 131.0;
  const k = Math.cos(rad(36));
  const s = Math.min((w - pad * 2) / ((lng1 - lng0) * k), (h - pad * 2) / (lat1 - lat0));
  const ox = (w - (lng1 - lng0) * k * s) / 2;
  const oy = (h - (lat1 - lat0) * s) / 2;
  return (lat, lng) => [ox + (lng - lng0) * k * s, oy + (lat1 - lat) * s];
}

function mapSvg(results, { showAnswer = false, w = 150, h = 190 } = {}) {
  const P = projector(w, h, 6);
  const dots = TOWNS.map((t) => {
    const [x, y] = P(t.lat, t.lng);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.3"/>`;
  }).join("");
  const guesses = results
    .map((r, i) => {
      const t = TOWNS[r.id];
      const [x, y] = P(t.lat, t.lng);
      return `<g class="map-guess ${heat(r)}" style="animation-delay:${i * 40}ms"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.6" style="fill:var(--_h)"/><text x="${x.toFixed(1)}" y="${(y + 2.4).toFixed(1)}" text-anchor="middle">${i + 1}</text></g>`;
    })
    .join("");
  let ans = "";
  if (showAnswer) {
    const a = answer();
    const [x, y] = P(a.lat, a.lng);
    ans = `<circle class="map-answer-ring" cx="${x}" cy="${y}" r="6"/><circle class="map-answer" cx="${x}" cy="${y}" r="4"/>`;
  }
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="추측한 동네 위치 지도"><g class="map-dots">${dots}</g>${guesses}${ans}</svg>`;
}

// 숫자 오도미터 (자리별로 굴러가는 숫자)
function odometer(el, value) {
  const str = String(value);
  if (el.dataset.len !== String(str.length)) {
    el.innerHTML = Array.from(str)
      .map((_, i) => `<span class="odo__d" style="--i:${i}"><span>${"0123456789".split("").map((d) => `<b>${d}</b>`).join("")}</span></span>`)
      .join("");
    el.dataset.len = String(str.length);
    void el.offsetWidth;
  }
  Array.from(str).forEach((d, i) => {
    const col = el.children[i]?.firstElementChild;
    if (col) col.style.transform = `translateY(${-Number(d) * 1.2}em)`;
  });
}

const search = (q) => {
  const n = norm(q);
  if (!n) return [];
  const starts = [];
  const contains = [];
  TOWNS.forEach((t) => {
    const name = norm(t.name);
    const label = norm(t.label);
    const full = norm(SIDO_FULL[t.sido] + t.name);
    if (name.startsWith(n) || label.startsWith(n)) starts.push(t);
    else if (label.includes(n) || full.includes(n)) contains.push(t);
  });
  return [...starts, ...contains].slice(0, 8);
};

export default {
  id: "town",
  name: "오늘의 동네",
  emoji: "🧭",
  tagline: "거리와 방향을 보고 시·군·구 맞히기",
  max: MAX,
  distKeys: ["1", "2", "3", "4", "5", "6", "X"],
  distLabel: (k) => (k === "X" ? "실패" : `${k}번`),
  started: (s) => s.guesses.length > 0,

  summary(s) {
    if (!s?.done) return null;
    const rs = s.guesses.map(evaluate);
    const n = rs.length;
    return {
      won: s.won,
      distKey: s.won ? String(n) : "X",
      grid: rs.map(square).join("") + (s.won ? "" : ` ${DIRS[rs[rs.length - 1].dir] || ""}`),
      scoreText: s.won ? `${n}번 만에 찾음` : "이번엔 못 찾음",
      headline: s.won ? `${n}번 만에 찾았어요!` : "아쉬워요, 다음에 찾아봐요",
    };
  },

  reveal(s) {
    const a = answer();
    const rs = s.guesses.map(evaluate);
    const best = rs.filter((r) => !r.ok).sort((x, y) => x.km - y.km)[0];
    return `
      <div class="stack gap-4">
        <span class="t-caption-01 t-tertiary">오늘의 동네</span>
        <b class="t-title-02" >${esc(SIDO_FULL[a.sido])} ${a.sido === "세종" ? "" : esc(a.name)}</b>
        ${!s.won && best ? `<span class="t-body-03 t-secondary">가장 가까웠던 건 ${esc(TOWNS[best.id].label)} (${best.km}km)</span>` : ""}
      </div>
      <div class="crt" style="padding:var(--sp-12)"><div class="town-reveal__map">${mapSvg(rs, { showAnswer: true, w: 220, h: 270 })}</div><div class="crt__scan"></div></div>
      ${a.fact ? `<p class="fact">💡 ${esc(a.fact)}</p>` : ""}
      <p class="t-caption-01 t-tertiary" style="margin:0">거리는 시·군·구의 대략적인 중심 좌표로 계산해요.</p>`;
  },

  mount(root, api) {
    const a = answer();
    const s = api.state || { guesses: [], done: false, won: false };
    root.innerHTML = `
      <div class="town__top">
        <div class="crt town__map" id="tmap"></div>
        <div class="town__read" id="tread">
          <div class="compass" id="tcomp"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4 L37 26 H28.5 V44 H19.5 V26 H11 Z"/></svg></div>
          <div class="big-num"><span class="odo" id="tkm">0</span><span class="t-body-03 t-secondary"> km</span></div>
          <div class="t-label-02 t-secondary" id="tdir">아무 동네나 먼저 적어보세요</div>
          <div class="heatbar"><i id="tbar" style="width:0%"></i></div>
          <div class="t-caption-01 t-tertiary" id="tpct">가까움 0%</div>
        </div>
      </div>
      <p class="msg" id="tmsg" aria-live="polite"></p>
      <form class="answer ac" id="tform" autocomplete="off">
        <ul class="ac__list" id="tlist" role="listbox" hidden></ul>
        <input class="input" id="tin" placeholder="시·군·구 이름 (예: 해운대, 춘천)" enterkeyhint="done" role="combobox" aria-controls="tlist" aria-expanded="false" />
        <button class="btn btn--primary" type="submit">확인</button>
      </form>
      <div class="town__hint" id="thint" hidden></div>
      <ol class="rows" id="trows"></ol>
      
      <div class="done-bar" id="tdone" hidden><button class="btn btn--primary btn--lg" id="tres">결과 보기</button></div>`;

    let sel = 0;
    let options = [];

    function paint(animateLast = false) {
      const rs = s.guesses.map(evaluate);
      $("#tmap", root).innerHTML = mapSvg(rs, { showAnswer: s.done }) + `<div class="crt__scan"></div>`;
      $("#trows", root).innerHTML = Array.from({ length: MAX }, (_, i) => {
        const r = rs[i];
        if (!r) return `<li class="is-empty"></li>`;
        const t = TOWNS[r.id];
        return `<li class="trow ${heat(r)} ${animateLast && i === rs.length - 1 ? "is-new" : ""}" style="--_p:${r.pct}%">
          <span>${esc(t.label)}</span>
          <span class="trow__km">${r.ok ? "정답!" : `${r.km.toLocaleString("ko-KR")}km`}</span>
          <span class="trow__dir" aria-label="${r.ok ? "" : DIR_KO[r.dir]}">${r.ok ? "🎯" : DIRS[r.dir]}</span>
          <span class="trow__pct">${r.pct}%</span>
        </li>`;
      }).join("");
      const last = rs[rs.length - 1];
      const read = $("#tread", root);
      if (last) {
        read.className = `town__read ${heat(last)}`;
        odometer($("#tkm", root), last.km);
        const svg = $("#tcomp svg", root);
        svg.style.transform = last.ok ? "rotate(0deg) scale(0)" : `rotate(${last.dir * 45}deg)`;
        $("#tdir", root).textContent = last.ok ? "바로 여기예요!" : `${TOWNS[last.id].label}에서 ${DIR_KO[last.dir]}`;
        $("#tbar", root).style.width = `${last.pct}%`;
        $("#tpct", root).textContent = `가까움 ${last.pct}%`;
      }
      const wrong = rs.filter((r) => !r.ok).length;
      const hint = $("#thint", root);
      if (wrong >= 4 && !s.done) {
        hint.hidden = false;
        hint.textContent = `힌트: ${SIDO_FULL[a.sido]}에 있어요`;
      } else hint.hidden = true;
      api.setTries(
        Array.from({ length: MAX }, (_, i) => {
          const r = rs[i];
          if (r) return r.ok ? "hit" : r.pct >= 75 ? "near" : "miss";
          return !s.done && i === rs.length ? "now" : "";
        })
      );
      if (s.done) {
        $("#tform", root).hidden = true;
        $("#tdone", root).hidden = false;
        const m = $("#tmsg", root);
        m.className = `msg ${s.won ? "is-good" : "is-bad"}`;
        m.textContent = s.won ? `정답! ${a.label}` : `정답은 ${a.label}였어요`;
      }
    }

    function showList(q) {
      options = search(q);
      sel = 0;
      const list = $("#tlist", root);
      const tried = new Set(s.guesses);
      if (!options.length) {
        list.hidden = true;
        $("#tin", root).setAttribute("aria-expanded", "false");
        return;
      }
      list.innerHTML = options
        .map(
          (t, i) =>
            `<li role="option"><button type="button" data-id="${t.id}" class="${i === sel ? "is-active" : ""}" ${tried.has(t.id) ? "disabled" : ""}><span>${esc(t.label)}</span><small>${tried.has(t.id) ? "이미 고름" : esc(SIDO_FULL[t.sido])}</small></button></li>`
        )
        .join("");
      list.hidden = false;
      $("#tin", root).setAttribute("aria-expanded", "true");
      list.querySelectorAll("button").forEach((b) =>
        b.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          submit(Number(b.dataset.id));
        })
      );
    }

    function submit(id) {
      if (s.done) return;
      const input = $("#tin", root);
      const m = $("#tmsg", root);
      if (id == null || Number.isNaN(id)) {
        const exact = TOWNS.filter((t) => norm(t.label) === norm(input.value) || norm(t.name) === norm(input.value));
        if (exact.length === 1) id = exact[0].id;
        else if (options.length) id = options[sel].id;
      }
      if (id == null || Number.isNaN(id)) {
        shake(input);
        m.className = "msg is-bad";
        m.textContent = "목록에 있는 시·군·구를 골라주세요";
        return;
      }
      if (s.guesses.includes(id)) {
        shake(input);
        m.className = "msg";
        m.textContent = "이미 골랐던 동네예요";
        return;
      }
      s.guesses.push(id);
      input.value = "";
      $("#tlist", root).hidden = true;
      const r = evaluate(id);
      if (r.ok) {
        s.done = true;
        s.won = true;
      } else if (s.guesses.length >= MAX) {
        s.done = true;
        s.won = false;
      }
      if (!r.ok) {
        haptic(15);
        shake($("#tread", root));
        const prev = s.guesses.length > 1 ? evaluate(s.guesses[s.guesses.length - 2]) : null;
        m.className = "msg";
        m.textContent = !prev ? `${r.km}km 떨어져 있어요` : r.km < prev.km ? "따뜻해졌어요! 더 가까워졌어요" : "앗, 조금 멀어졌어요";
      }
      paint(true);
      if (s.done) api.finish(s);
      else api.save(s);
    }

    const input = $("#tin", root);
    input.addEventListener("input", () => showList(input.value));
    input.addEventListener("focus", () => input.value && showList(input.value));
    input.addEventListener("blur", () => setTimeout(() => ($("#tlist", root).hidden = true), 150));
    input.addEventListener("keydown", (e) => {
      const list = $("#tlist", root);
      if (list.hidden || !options.length) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
        list.querySelectorAll("button").forEach((b, i) => b.classList.toggle("is-active", i === sel));
      }
    });
    $("#tform", root).addEventListener("submit", (e) => {
      e.preventDefault();
      submit(null);
    });
    $("#tres", root).addEventListener("click", () => api.openResult());
    paint(false);
  },
};
