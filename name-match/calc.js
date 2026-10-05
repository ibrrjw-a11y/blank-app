// 이름궁합 계산 (DOM 없음, node에서 테스트 가능)
// 클래식 '이름 획수 궁합' 밈:
//  1) 이름의 각 글자를 초성·중성·종성으로 나눠 획수를 더한다.
//  2) A1 B1 A2 B2 … 순서로 번갈아 세우고, 남는 글자는 뒤에 붙인다.
//  3) 이웃한 두 수를 더해 일의 자리만 남기는 과정을 두 자리가 남을 때까지 반복한다.
//  4) 남은 두 자리가 궁합 %. "00"은 0%로 본다. (100%는 나오지 않는다)
// 순서가 바뀌면 줄 세우는 순서가 달라져 결과도 달라진다 → A→B 와 B→A 를 '마음의 방향'으로 쓴다.

export const CHO = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
export const JUNG = ["ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ", "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ", "ㅣ"];
export const JONG = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

export const CONSONANT_STROKES = {
  ㄱ: 2, ㄲ: 4, ㄴ: 2, ㄷ: 3, ㄸ: 6, ㄹ: 5, ㅁ: 4, ㅂ: 4, ㅃ: 8, ㅅ: 2,
  ㅆ: 4, ㅇ: 1, ㅈ: 3, ㅉ: 6, ㅊ: 4, ㅋ: 3, ㅌ: 4, ㅍ: 4, ㅎ: 3,
};

// 겹받침 = 구성 자음 획수의 합
export const DOUBLE_FINALS = {
  ㄳ: ["ㄱ", "ㅅ"], ㄵ: ["ㄴ", "ㅈ"], ㄶ: ["ㄴ", "ㅎ"], ㄺ: ["ㄹ", "ㄱ"], ㄻ: ["ㄹ", "ㅁ"], ㄼ: ["ㄹ", "ㅂ"],
  ㄽ: ["ㄹ", "ㅅ"], ㄾ: ["ㄹ", "ㅌ"], ㄿ: ["ㄹ", "ㅍ"], ㅀ: ["ㄹ", "ㅎ"], ㅄ: ["ㅂ", "ㅅ"],
};

export const VOWEL_STROKES = {
  ㅏ: 2, ㅐ: 3, ㅑ: 3, ㅒ: 4, ㅓ: 2, ㅔ: 3, ㅕ: 3, ㅖ: 4, ㅗ: 2, ㅘ: 4, ㅙ: 5,
  ㅚ: 3, ㅛ: 3, ㅜ: 2, ㅝ: 4, ㅞ: 5, ㅟ: 3, ㅠ: 3, ㅡ: 1, ㅢ: 2, ㅣ: 1,
};

export function consonantStrokes(c) {
  if (!c) return 0;
  if (DOUBLE_FINALS[c]) return DOUBLE_FINALS[c].reduce((a, p) => a + CONSONANT_STROKES[p], 0);
  return CONSONANT_STROKES[c] || 0;
}

export const isSyllable = (ch) => {
  const c = ch.charCodeAt(0);
  return c >= 0xac00 && c <= 0xd7a3;
};

export function decompose(ch) {
  const code = ch.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return null;
  return {
    cho: CHO[Math.floor(code / 588)],
    jung: JUNG[Math.floor((code % 588) / 28)],
    jong: JONG[code % 28],
  };
}

// 글자 하나의 획수 (원래 합계)
export function syllableStrokes(ch) {
  const d = decompose(ch);
  if (!d) return 0;
  return consonantStrokes(d.cho) + VOWEL_STROKES[d.jung] + consonantStrokes(d.jong);
}

// 이름에서 완성형 한글만 남긴다
export function hangulOnly(name) {
  return Array.from(String(name || "")).filter(isSyllable).join("");
}

export function nameStrokes(name) {
  return Array.from(hangulOnly(name)).map((ch) => ({ ch, strokes: syllableStrokes(ch) }));
}

// A1 B1 A2 B2 … (남는 글자는 뒤에)
export function interleave(a, b) {
  const out = [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (i < a.length) out.push({ ...a[i], from: "a" });
    if (i < b.length) out.push({ ...b[i], from: "b" });
  }
  return out;
}

/**
 * A가 B를 생각하는 마음 (A→B)
 * @returns {{ letters, rows: number[][], score: number } | null}
 *   rows[0] = 각 글자 획수의 일의 자리, 마지막 행 = 두 자리
 */
export function match(nameA, nameB) {
  const a = nameStrokes(nameA);
  const b = nameStrokes(nameB);
  if (!a.length || !b.length) return null;
  const letters = interleave(a, b);
  let row = letters.map((l) => l.strokes % 10);
  const rows = [row];
  while (row.length > 2) {
    const next = [];
    for (let i = 0; i < row.length - 1; i++) next.push((row[i] + row[i + 1]) % 10);
    rows.push(next);
    row = next;
  }
  const score = row.length === 2 ? row[0] * 10 + row[1] : row[0]; // "00" → 0
  return { letters, rows, score };
}

/* ---------- 이름 목록 ---------- */

// 단톡방에서 복사한 텍스트를 이름 목록으로
export function parseNames(text) {
  return String(text || "")
    .split(/[,\n\r\t ·•・、，/|;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// 여러 명 매트릭스: m[i][j] = i가 j를 생각하는 마음
export function matrix(names) {
  return names.map((a, i) => names.map((b, j) => (i === j ? null : match(a, b)?.score ?? null)));
}

export function highlights(names, m = matrix(names)) {
  const n = names.length;
  if (n < 2) return null;
  const pairs = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const ab = m[i][j];
      const ba = m[j][i];
      pairs.push({ i, j, ab, ba, avg: (ab + ba) / 2, gap: Math.abs(ab - ba) });
    }
  }
  const by = (arr, f) => arr.reduce((best, x) => (f(x) > f(best) ? x : best));
  // 동점이면 두 방향 차이가 작은(서로 비슷한) 쪽
  const best = by(pairs, (p) => p.avg - p.gap * 0.001);
  const worst = by(pairs, (p) => -p.avg - p.gap * 0.001);
  const crushRaw = by(pairs, (p) => p.gap);
  // 짝사랑은 '높은 쪽 → 낮은 쪽'으로 표현
  const crush =
    crushRaw.ab >= crushRaw.ba
      ? { from: crushRaw.i, to: crushRaw.j, high: crushRaw.ab, low: crushRaw.ba, gap: crushRaw.gap }
      : { from: crushRaw.j, to: crushRaw.i, high: crushRaw.ba, low: crushRaw.ab, gap: crushRaw.gap };

  const received = names.map((_, j) => avg(m.map((row, i) => (i === j ? null : row[j]))));
  const given = names.map((_, i) => avg(m[i].filter((v, j) => j !== i)));
  const popular = received.indexOf(Math.max(...received));
  const wall = given.indexOf(Math.min(...given));

  return { best, worst, crush, popular, wall, received, given, pairs };
}

function avg(arr) {
  const v = arr.filter((x) => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}
