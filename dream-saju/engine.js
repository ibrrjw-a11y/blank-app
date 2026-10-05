// 꿈 사주 해몽 엔진. 브라우저(app.js)와 Node 생성기(scripts/build-dream-pages.mjs)가 같이 쓴다.
// DOM 을 쓰지 않는 순수 함수만 둔다.
import { seededRandom, hashString } from "../shared/kit.js";

export const KEYS = ["p1", "p2", "p3", "p4"];

/* ---------- 데이터 색인 ---------- */
export function prepare(data) {
  if (data._idx) return data;
  const idx = {};
  data.pillars.forEach((p) => {
    idx[p.key] = new Map(p.options.map((o) => [o.id, o]));
  });
  Object.defineProperty(data, "_idx", { value: idx, enumerable: false });
  Object.defineProperty(data, "_grades", {
    value: [...data.grades].sort((a, b) => b.min - a.min),
    enumerable: false,
  });
  return data;
}

export const pillar = (data, key) => data.pillars.find((p) => p.key === key);
export const opt = (data, key, id) => (id && data._idx[key].get(id)) || null;

// URL 등에서 들어온 값을 검증해서 {p1..p4} 로
export function cleanSel(data, raw = {}) {
  const sel = {};
  KEYS.forEach((k) => {
    sel[k] = opt(data, k, raw[k]) ? raw[k] : null;
  });
  return sel;
}

export const isComplete = (sel) => KEYS.every((k) => sel[k]);

/* ---------- 한국어 조사 ---------- */
export function hasBatchim(word) {
  const s = String(word).trim();
  const c = s.charCodeAt(s.length - 1);
  if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28 !== 0;
  return /[0-9lmnLMN]$/.test(s) && !/[2459]$/.test(s);
}
// josa("뱀꿈", "은/는") → "뱀꿈은"
export function josa(word, pair) {
  const [a, b] = pair.split("/");
  return word + (hasBatchim(word) ? a : b);
}

const firstSentence = (text) => String(text).split(/(?<=[요다]\.)\s+/)[0];
const sentences = (text) => String(text).split(/(?<=[요다]\.)\s+/);

/* ---------- 조합 규칙 ---------- */
export function matchRules(data, sel) {
  return data.rules
    .filter((r) => KEYS.every((k) => !r[k] || (sel[k] && r[k].includes(sel[k]))))
    .map((r) => ({ r, spec: KEYS.filter((k) => r[k]).length }))
    .sort((a, b) => b.spec - a.spec || Math.abs(b.r.pol) - Math.abs(a.r.pol))
    .map((x) => x.r);
}

// 특정 상징이 들어간 규칙 (SEO 페이지의 상황별 해몽)
export function rulesFor(data, key, id) {
  return data.rules.filter((r) => r[key] && r[key].includes(id));
}

/* ---------- 해석 ---------- */
const PILLAR_WEIGHT = { p1: 1, p2: 0.5, p3: 0.7 };

export function interpret(data, sel, { date = "" } = {}) {
  prepare(data);
  const o = {};
  KEYS.forEach((k) => (o[k] = opt(data, k, sel[k])));
  const rules = matchRules(data, sel).slice(0, 2);
  const ruleWeight = (i) => (i === 0 ? 1 : 0.5);

  // 1) 점수: 상징 + 장소 + 사건 + 조합 규칙 + 기분(전통적으로 꿈속 기분을 크게 본다)
  let score = 0;
  ["p1", "p2", "p3"].forEach((k) => (score += (o[k]?.pol || 0) * PILLAR_WEIGHT[k]));
  rules.forEach((r, i) => (score += r.pol * ruleWeight(i)));
  score += o.p4?.mod || 0;
  score = Math.round(score * 10) / 10;
  const grade = data._grades.find((g) => score >= g.min) || data._grades[data._grades.length - 1];

  // 2) 분야별 지수 (50 기준)
  const domains = data.domains.map((d) => {
    let raw = 0;
    ["p1", "p2", "p3"].forEach((k) => (raw += (o[k]?.w?.[d.id] || 0) * PILLAR_WEIGHT[k]));
    rules.forEach((r, i) => (raw += (r.w?.[d.id] || 0) * ruleWeight(i)));
    raw += o.p4?.w?.[d.id] || 0;
    raw += (o.p4?.mod || 0) * 0.3;
    const value = Math.max(6, Math.min(96, Math.round(50 + raw * 9)));
    return { ...d, value };
  });
  const good = grade.min >= 1.5;
  const bad = grade.min < -1;
  const sorted = [...domains].sort((a, b) =>
    good ? b.value - a.value : bad ? a.value - b.value : Math.abs(b.value - 50) - Math.abs(a.value - 50)
  );
  const top = sorted[0];
  const arrow = top.value > 55 ? "▲" : top.value < 45 ? "▼" : "–";
  const headline = `${top.label}운 ${arrow}`;

  // 3) 해몽 문장 (3~4문장)
  const body = [];
  if (rules[0]) body.push(sentences(rules[0].text).slice(0, 2).join(" "));
  if (o.p1) body.push(rules[0] ? firstSentence(o.p1.meaning) : sentences(o.p1.meaning).slice(0, 2).join(" "));
  if (o.p3 && !o.p3.weak && !rules[0]?.p3) body.push(firstSentence(o.p3.meaning));
  if (o.p2?.ctx) body.push(o.p2.ctx);
  const story = body.slice(0, o.p4 ? 3 : 4);
  if (o.p4) story.push(o.p4.read);

  // 4) 오늘의 행동
  const dir = top.value >= 50 ? "up" : "down";
  const pool = data.actions[top.id][dir];
  const seedKey = KEYS.map((k) => sel[k] || "-").join("|") + "|" + date;
  const action = pool[hashString(seedKey) % pool.length];

  // 5) 태몽 (속설)
  const tm = [];
  if (o.p1?.tm) tm.push(o.p1.tm.text);
  rules.forEach((r) => r.tm && tm.push(r.tm));
  if (["coming-in", "receiving", "bitten", "picking-up"].includes(sel.p3))
    tm.push("무언가 품에 안기거나 받는 장면은 태몽에서 특히 의미 있게 본다는 속설이 있어요.");
  if (!tm.length)
    tm.push("이 조합은 전해지는 태몽 속설이 뚜렷하지 않아요. 다만 꿈이 유난히 선명하고 기분이 좋았다면 좋은 태몽으로 보기도 해요.");
  const tmWho = o.p1?.tm?.who || "";

  // 6) 제목
  const title = rules[0]?.title || (o.p1 ? `${o.p1.label} 꿈` : o.p3 && !o.p3.weak ? o.p3.kw : "오늘의 꿈");

  return {
    sel,
    o,
    rules,
    score,
    grade,
    good,
    domains,
    top,
    headline,
    story,
    oneLine: story[0] || "",
    action,
    taemong: { lines: [...new Set(tm)], who: tmWho },
    title,
    numbers: date ? luckyNumbers(sel, date) : [],
  };
}

/* ---------- 꿈 기운 번호 (재미용, 결정적) ---------- */
export function luckyNumbers(sel, date) {
  const rand = seededRandom(`dream|${KEYS.map((k) => sel[k] || "-").join("|")}|${date}`);
  const pool = Array.from({ length: 45 }, (_, i) => i + 1);
  const out = [];
  while (out.length < 6) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out.sort((a, b) => a - b);
}

/* ---------- 말/글 → 아이콘 자동 선택 ---------- */
const BOUNDARY = /[\s.,!?~"'()\[\]…·]/;
const JOSA_NEXT = "이가을를은는도에의와과랑하한만꿈들로처같께";

function nieunFinal(ch) {
  if (!ch) return false;
  const c = ch.charCodeAt(0);
  return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 === 4; // ㄴ 받침 (큰, 하얀 …)
}

export function matchText(data, text) {
  prepare(data);
  const t = String(text || "").replace(/\s+/g, " ").trim();
  const order = { p2: 0, p3: 1, p4: 2, p1: 3 };
  const cands = [];
  if (!t) return { sel: {}, hits: [] };

  data.pillars.forEach((p) => {
    p.options.forEach((o) => {
      const exSpans = [];
      (o.ex || []).forEach((e) => {
        let j = t.indexOf(e);
        while (j !== -1) {
          exSpans.push([j, j + e.length]);
          j = t.indexOf(e, j + 1);
        }
      });
      (o.syn || []).forEach((raw) => {
        const strict = raw.startsWith("^");
        const syn = strict ? raw.slice(1) : raw;
        let i = t.indexOf(syn);
        while (i !== -1) {
          const prev = t[i - 1];
          const next = t[i + syn.length];
          const prevBoundary = i === 0 || BOUNDARY.test(prev);
          let ok = true;
          if (strict && !prevBoundary) ok = false;
          if (syn.length === 1) {
            if (!(prevBoundary || nieunFinal(prev))) ok = false;
            if (!(next === undefined || BOUNDARY.test(next) || JOSA_NEXT.includes(next))) ok = false;
          }
          if (ok && exSpans.some(([s, e]) => s < i + syn.length && i < e)) ok = false;
          if (ok)
            cands.push({ key: p.key, id: o.id, word: syn, s: i, e: i + syn.length, len: o.weak ? 0 : syn.length });
          i = t.indexOf(syn, i + 1);
        }
      });
    });
  });

  cands.sort((a, b) => b.len - a.len || order[a.key] - order[b.key] || a.s - b.s);
  const sel = {};
  const taken = [];
  const hits = [];
  cands.forEach((c) => {
    if (sel[c.key]) return;
    if (taken.some(([s, e]) => s < c.e && c.s < e)) return;
    sel[c.key] = c.id;
    taken.push([c.s, c.e]);
    hits.push({ key: c.key, id: c.id, word: c.word, s: c.s });
  });
  hits.sort((a, b) => a.s - b.s);
  return { sel, hits };
}
