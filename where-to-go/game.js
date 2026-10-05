// 후보 풀 만들기 + 토너먼트(대진) + 보르다 집계
import { seededRandom, shuffle } from "../shared/kit.js";

/* ---------- 후보 풀 ----------
 * base     : 후보 원본 (카탈로그 또는 실제 가게)
 * size     : 8 | 16
 * filters  : { prices:Set, tags:Set, excludeKeys:Set }
 * boosts   : [{ tag, x }]  날씨·모드 가중치
 * reserve  : 거부권으로 빠질 때 채울 예비 후보 수
 */
export function buildPool({ base, size, filters, boosts = [], seed, reserve = 6, softTags = false }) {
  const rand = seededRandom(seed);
  const notes = [];
  const { prices = new Set(), tags = new Set(), excludeKeys = new Set() } = filters;

  let list = base.slice();
  const excluded = list.filter((x) => excludeKeys.has(x.key));
  if (excluded.length && list.length - excluded.length >= size) {
    list = list.filter((x) => !excludeKeys.has(x.key));
  }

  const priceOk = (x) => !prices.size || x.p == null || prices.has(x.p);
  const allTags = (x) => [...tags].every((t) => x.t?.includes(t));
  const anyTag = (x) => !tags.size || [...tags].some((t) => x.t?.includes(t));

  const weight = (x) => {
    let w = 1;
    boosts.forEach((b) => {
      if (x.t?.includes(b.tag)) w *= b.x;
    });
    if (softTags && tags.size && anyTag(x)) w *= 2.5;
    if (x.dist != null) w *= 1 / (1 + x.dist); // 실제 가게는 가까울수록 조금 더
    return w;
  };
  // Efraimidis–Spirakis 가중 무작위 정렬
  const order = (arr) =>
    arr
      .map((x) => ({ x, k: Math.pow(rand(), 1 / weight(x)) }))
      .sort((a, b) => b.k - a.k)
      .map((o) => o.x);

  let tiers;
  if (softTags) {
    tiers = [order(list)];
  } else {
    const strict = list.filter((x) => priceOk(x) && allTags(x));
    const loose = list.filter((x) => !strict.includes(x) && priceOk(x) && anyTag(x));
    const rest = list.filter((x) => !strict.includes(x) && !loose.includes(x));
    tiers = [order(strict), order(loose), order(rest)];
    if (strict.length < size && (tags.size || prices.size)) {
      notes.push(`조건에 딱 맞는 후보가 ${strict.length}개라 비슷한 후보로 채웠어요`);
    }
  }
  const ordered = tiers.flat();
  let n = size;
  if (ordered.length < n) n = ordered.length >= 8 ? 8 : ordered.length >= 4 ? 4 : ordered.length;
  const items = shuffle(ordered.slice(0, n), rand);
  const reserves = ordered.slice(n, n + reserve);
  return { items, reserves, notes, excludedCount: list.length < base.length ? excluded.length : 0 };
}

/* ---------- 토너먼트 ---------- */
export class Bracket {
  constructor(items) {
    this.items = items.slice();
    this.round = items.slice();
    this.next = [];
    this.i = 0;
    this.out = {}; // key → 탈락한 라운드 크기 (16, 8, 4, 2)
    this.champion = null;
  }
  get size() {
    return this.round.length;
  }
  get label() {
    return roundLabel(this.round.length);
  }
  get matches() {
    return this.round.length / 2;
  }
  get pair() {
    return [this.round[this.i * 2], this.round[this.i * 2 + 1]];
  }
  get done() {
    return !!this.champion;
  }
  pick(side) {
    const [a, b] = this.pair;
    const w = side ? b : a;
    const l = side ? a : b;
    this.out[l.key] = this.round.length;
    this.next.push(w);
    this.i++;
    let roundDone = false;
    if (this.i >= this.matches) {
      roundDone = true;
      if (this.next.length === 1) this.champion = this.next[0];
      else {
        this.round = this.next;
        this.next = [];
        this.i = 0;
      }
    }
    return { winner: w, loser: l, roundDone };
  }
  // [{ item, tier }] tier: 1=우승, 2=준우승, 4=4강 ...
  ranking() {
    const rest = this.items
      .filter((x) => x !== this.champion)
      .sort((a, b) => (this.out[a.key] || 99) - (this.out[b.key] || 99));
    return [{ item: this.champion, tier: 1 }, ...rest.map((item) => ({ item, tier: this.out[item.key] }))];
  }
}

export const roundLabel = (n) => (n === 2 ? "결승" : n === 4 ? "4강" : `${n}강`);

/* ---------- 보르다 집계 ----------
 * 토너먼트는 같은 라운드 탈락자끼리 순위가 같아서, 그 구간 순위의 평균을 쓴다.
 * 예) 8강: 우승 7점, 준우승 6점, 4강 탈락 4.5점, 8강 탈락 1.5점
 */
export function bordaPoints(tier, n) {
  if (tier === 1) return n - 1;
  const lo = tier / 2; // 0-based 시작 순위
  const hi = Math.min(tier, n) - 1;
  return n - 1 - (lo + hi) / 2;
}

// replies: [{ name, w:[후보 이름 순서], s:[tier] }]
export function aggregate(replies, names) {
  const n = names.length;
  const score = Object.fromEntries(names.map((x) => [x, 0]));
  const firsts = Object.fromEntries(names.map((x) => [x, []]));
  replies.forEach((r) => {
    r.w.forEach((name, i) => {
      if (!(name in score)) return;
      score[name] += bordaPoints(r.s[i], n);
    });
    if (r.w[0] in firsts) firsts[r.w[0]].push(r.name);
  });
  const max = (n - 1) * Math.max(1, replies.length);
  return names
    .map((name) => ({ name, score: score[name], max, firsts: firsts[name] }))
    .sort((a, b) => b.score - a.score || b.firsts.length - a.firsts.length);
}
