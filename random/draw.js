// 추첨 계산(화면과 분리). 당첨자 추첨기·번호 추첨기가 같이 쓴다.
// 난수는 브라우저 암호용 난수(crypto.getRandomValues) — 편향 없는 정수 뽑기로 섞는다.

export const MAX_LINES = 50000;

// 0 이상 n 미만 정수 하나. 나머지 편향을 없애려고 경계 밖 값은 버리고 다시 뽑는다
export function randInt(n) {
  if (!(n >= 1)) throw new Error("범위 오류");
  const lim = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < lim) return buf[0] % n;
  }
}

// 피셔-예이츠 섞기(새 배열)
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 명단 글 → 이름 배열. 줄바꿈·쉼표로 나누고 앞뒤 빈칸·빈 줄 제거
export function parseNames(text, dedupe = true) {
  const all = String(text || "")
    .split(/[\n,，]+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, MAX_LINES);
  if (!dedupe) return { names: all, removed: 0 };
  const seen = new Set();
  const names = [];
  for (const n of all) {
    const k = n.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    names.push(n);
  }
  return { names, removed: all.length - names.length };
}

// 당첨 count 명 + 예비 reserve 명
export function drawWinners(names, count, reserve = 0) {
  count = Math.floor(Number(count));
  reserve = Math.floor(Number(reserve) || 0);
  if (!names.length) return { error: "명단이 비어 있어요." };
  if (!(count >= 1)) return { error: "당첨 인원은 1명 이상이어야 해요." };
  if (reserve < 0) return { error: "예비 당첨은 0명 이상이어야 해요." };
  if (count + reserve > names.length) return { error: `당첨 ${count}명 + 예비 ${reserve}명이 명단 ${names.length}명보다 많아요.` };
  const s = shuffle(names);
  return { winners: s.slice(0, count), reserves: s.slice(count, count + reserve) };
}

// 번호 count 개: min~max, 뺄 번호 제외, 중복 허용 여부
export function drawNumbers({ min, max, count, allowDup = false, exclude = [] }) {
  min = Math.floor(Number(min)); max = Math.floor(Number(max)); count = Math.floor(Number(count));
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { error: "시작 번호와 끝 번호를 넣어 주세요." };
  if (min > max) return { error: "시작 번호가 끝 번호보다 커요." };
  if (max - min > 10000000) return { error: "범위는 1,000만 칸까지예요." };
  if (!(count >= 1)) return { error: "뽑을 개수는 1개 이상이어야 해요." };
  if (count > 1000) return { error: "한 번에 1,000개까지 뽑을 수 있어요." };
  const ex = new Set(exclude.filter((n) => n >= min && n <= max));
  const size = max - min + 1 - ex.size;
  if (size < 1) return { error: "뽑을 수 있는 번호가 없어요." };
  if (!allowDup && count > size) return { error: `뽑을 수 있는 번호는 ${size}개인데 ${count}개를 뽑으려 해요.` };
  // 뺄 번호를 건너뛰며 k번째 번호 찾기(뺄 번호는 정렬해 두고 앞에서부터 밀어냄)
  const exs = [...ex].sort((a, b) => a - b);
  const nth = (k) => { let v = min + k; for (const e of exs) { if (e <= v) v++; else break; } return v; };
  const out = [];
  if (allowDup) {
    for (let i = 0; i < count; i++) out.push(nth(randInt(size)));
  } else {
    const taken = new Set();
    while (out.length < count) {
      const v = nth(randInt(size));
      if (!taken.has(v)) { taken.add(v); out.push(v); }
    }
  }
  return { numbers: out, size };
}

export function parseExclude(text) {
  return String(text || "")
    .split(/[^0-9-]+/)
    .filter((s) => /^-?\d+$/.test(s))
    .map(Number);
}

// 명단 지문: 넣은 순서 그대로 줄바꿈으로 이은 글의 SHA-256 앞 12자
export async function fingerprint(names) {
  const data = new TextEncoder().encode(names.join("\n"));
  const h = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 12);
}

export function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
