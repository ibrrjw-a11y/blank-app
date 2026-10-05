// 📼 추억 연대기 — 카드를 시간 순서대로 끼워 넣기 (Wikitrivia 방식)
import { $, shuffle, haptic } from "../../shared/kit.js";
import { dailyRand, esc, shake, DATE } from "../core.js";
import { CARDS } from "../data/timeline.js";

const PLACE = 6; // 놓을 카드 수 (기준 카드 1장 + 6장)
const NOW_YEAR = Number(DATE.slice(0, 4));

let cached;
function todayCards() {
  if (cached) return cached;
  const rand = dailyRand("timeline");
  const pool = shuffle(CARDS, rand);
  const picked = [];
  const years = new Set();
  for (const c of pool) {
    if (years.has(c.year)) continue;
    // 같은 분류는 2장까지만 → 골고루 섞이게
    if (picked.filter((p) => p.cat === c.cat).length >= 2) continue;
    picked.push(c);
    years.add(c.year);
    if (picked.length === PLACE + 1) break;
  }
  cached = picked;
  return picked;
}

const decade = (y) => Math.floor(y / 10) * 10;
const decadeLabel = (d) => (d >= 2000 ? `${d}년대` : `${String(d).slice(2)}년대`);

function era(s) {
  const cards = todayCards();
  const okCards = s.results.filter((r) => r.ok).map((r) => CARDS[r.id]);
  const base = okCards.length ? okCards : cards;
  const count = {};
  okCards.forEach((c) => (count[decade(c.year)] = (count[decade(c.year)] || 0) + 1));
  const top = Object.entries(count).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  const avg = base.reduce((a, c) => a + c.year, 0) / base.length;
  const age = Math.max(10, Math.round(NOW_YEAR - avg + 15));
  return { top: top ? Number(top[0]) : null, age };
}

export default {
  id: "timeline",
  name: "추억 연대기",
  emoji: "📼",
  tagline: "추억 카드를 시간 순서대로 끼우기",
  max: PLACE,
  distKeys: ["6", "5", "4", "3", "2", "1", "0"],
  distLabel: (k) => `${k}개`,
  distTitle: "몇 개 맞혔나",
  successLabel: "4개 이상",
  started: (s) => s.results.length > 0,

  summary(s) {
    if (!s?.done) return null;
    const n = s.results.filter((r) => r.ok).length;
    return {
      won: n >= 4,
      distKey: String(n),
      grid: s.results.map((r) => (r.ok ? "🟩" : "🟥")).join(""),
      scoreText: `${n}/${PLACE} 맞힘`,
      headline: n === PLACE ? "전부 맞혔어요! 추억 박사네요" : n >= 4 ? `${n}개 맞혔어요!` : `${n}개 맞혔어요. 은근 헷갈리죠?`,
    };
  },

  reveal(s) {
    const e = era(s);
    const okIds = new Set(s.results.filter((r) => r.ok).map((r) => r.id));
    const first = todayCards()[0];
    const all = [...todayCards()].sort((a, b) => a.year - b.year);
    return `
      <div class="era">
        <span class="t-caption-01 t-tertiary">재미로 보는 추억 나이 ${e.age}살</span>
        <b>${e.top ? `당신은 ${decadeLabel(e.top)} 감성` : "아직 추억 수집 중이에요"}</b>
        <span class="t-body-03 t-secondary">${e.top ? `${decadeLabel(e.top)} 카드를 가장 잘 맞혔어요.` : "내일 카드로 다시 도전해봐요."}</span>
      </div>
      <ul class="era-list">
        ${all
          .map(
            (c) =>
              `<li><em>${c.year}</em><span>${c.emoji} ${esc(c.title)}</span><span class="grow"></span><span>${c.id === first.id ? "기준" : okIds.has(c.id) ? "✅" : "❌"}</span></li>`
          )
          .join("")}
      </ul>`;
  },

  mount(root, api) {
    const cards = todayCards();
    const s = api.state || { results: [], done: false };
    root.innerHTML = `
      <div class="crt tl__deck" id="ldeck"></div>
      <p class="msg" id="lmsg" aria-live="polite"></p>
      <div class="tl__line" id="lline"></div>
      <div class="done-bar" id="ldone" hidden><button class="btn btn--primary btn--lg" id="lres">결과 보기</button></div>`;

    const line = () => [cards[0], ...s.results.map((r) => CARDS[r.id])].sort((a, b) => a.year - b.year);
    const current = () => (s.done ? null : cards[s.results.length + 1]);

    function cardHtml(c, cls = "", showYear = true) {
      return `<div class="tcard ${cls}" data-id="${c.id}">
        <span class="tcard__e" aria-hidden="true">${c.emoji}</span>
        <span><span class="tcard__t">${esc(c.title)}</span><span class="tcard__c">${esc(c.cat)}</span></span>
        <span class="tcard__y">${showYear ? c.year : "????"}</span>
      </div>`;
    }

    function paint(justPlaced = null) {
      const cur = current();
      const deck = $("#ldeck", root);
      deck.innerHTML = cur
        ? `<div class="tl__ask"><span class="pix">CARD ${s.results.length + 1}/${PLACE}</span><span class="t-body-03">언제일까요? 아래 줄에 끼워 넣어요</span></div>${cardHtml(cur, "tcard--current", false)}<div class="crt__scan"></div>`
        : `<div class="tl__ask"><span class="pix">COMPLETE</span><span class="t-title-04">${s.results.filter((r) => r.ok).length}/${PLACE} 맞혔어요</span></div><div class="crt__scan"></div>`;
      const ln = line();
      const okMap = new Map(s.results.map((r) => [r.id, r.ok]));
      const parts = [`<span class="tl__edge">↑ 옛날</span>`];
      ln.forEach((c, i) => {
        if (cur) parts.push(`<button class="slot" data-at="${i}" aria-label="${i === 0 ? "맨 앞" : esc(ln[i - 1].title) + " 다음"}에 넣기">여기에 넣기</button>`);
        const cls = c.id === justPlaced ? (okMap.get(c.id) ? "is-ok" : "is-bad") : "";
        parts.push(cardHtml(c, cls));
      });
      if (cur) parts.push(`<button class="slot" data-at="${ln.length}" aria-label="맨 뒤에 넣기">여기에 넣기</button>`);
      parts.push(`<span class="tl__edge">↓ 최근</span>`);
      $("#lline", root).innerHTML = parts.join("");
      $("#lline", root)
        .querySelectorAll(".slot")
        .forEach((b) => b.addEventListener("click", () => place(Number(b.dataset.at))));
      api.setTries(
        Array.from({ length: PLACE }, (_, i) => {
          const r = s.results[i];
          if (r) return r.ok ? "hit" : "miss";
          return !s.done && i === s.results.length ? "now" : "";
        })
      );
      if (s.done) {
        $("#ldone", root).hidden = false;
      }
    }

    function place(at) {
      const cur = current();
      if (!cur) return;
      const ln = line();
      const prev = ln[at - 1];
      const next = ln[at];
      const ok = (!prev || prev.year < cur.year) && (!next || cur.year < next.year);
      s.results.push({ id: cur.id, ok });
      if (s.results.length >= PLACE) s.done = true;
      const m = $("#lmsg", root);
      if (ok) {
        m.className = "msg is-good";
        m.textContent = `딩동댕! ${cur.year}년이에요`;
        haptic(10);
      } else {
        m.className = "msg is-bad";
        m.textContent = `땡! ${cur.year}년이라 제자리로 옮겼어요`;
        haptic(25);
      }
      paint(cur.id);
      const placed = $(`#lline .tcard[data-id="${cur.id}"]`, root);
      if (!ok) shake($("#ldeck", root));
      placed?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      if (s.done) api.finish(s, { celebrate: s.results.filter((r) => r.ok).length >= 4 });
      else api.save(s);
    }

    $("#lres", root).addEventListener("click", () => api.openResult());
    paint();
  },
};
