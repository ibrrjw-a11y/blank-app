// 타자 속도 측정 — 계산(화면 없음). 짧은 한글 문장 5개를 따라 치고 타수·정확도를 잰다
// 우리 쪽 차별점(2026-10-08): ① 오늘의 문장(모두 같은 5문장, 날짜로 정함) ② 친구 도전장(같은 문장 묶음 번호 + 내 타수 링크)
//   ③ 가장 많이 틀린 자모 + 많이 친 키가 빛나는 자판 그림
import { seededRandom, shuffle, todayKey, dayNumber, createStore } from "../shared/kit.js";

export const PER = 5; // 한 판 = 문장 5개
export const DATE = todayKey();
export const DAY = dayNumber("2026-01-01");
export const store = createStore("typing");

/* ---------- 문장 ----------
 * 전부 이 파일에서 새로 쓴 문장이다. 노래 가사·책·기사 문장은 넣지 않는다.
 * 앞쪽 '일상' 문장은 직접 쓴 것, 뒤쪽 '속담'은 지은이가 없는 전래 속담만(저작권 없음).
 * 순서를 바꾸거나 중간에 끼워 넣으면 이미 보낸 도전장 링크의 문장이 달라진다 → 새 문장은 맨 뒤에만 붙인다. */
export const SENTENCES = [
  // 일상(직접 씀)
  "아침에 따뜻한 물 한 잔을 마셨다.",
  "창밖으로 비가 조용히 내린다.",
  "오늘은 일찍 자고 일찍 일어나야지.",
  "버스가 생각보다 빨리 왔다.",
  "점심은 김치찌개로 정했다.",
  "고양이가 햇볕 아래에서 낮잠을 잔다.",
  "주말에는 공원을 천천히 걸었다.",
  "냉장고에 우유가 다 떨어졌다.",
  "우산을 챙기길 정말 잘했다.",
  "편의점에서 삼각김밥을 샀다.",
  "친구에게 오랜만에 전화를 걸었다.",
  "책상 위를 깨끗하게 정리했다.",
  "저녁 하늘이 붉게 물들었다.",
  "겨울에는 귤이 제일 맛있다.",
  "엘리베이터가 고장 나서 계단으로 갔다.",
  "새로 산 운동화가 발에 꼭 맞는다.",
  "화분에 물 주는 걸 깜빡했다.",
  "라면 물이 끓기 시작했다.",
  "퇴근길 지하철이 꽉 찼다.",
  "동생이 내 과자를 몰래 먹었다.",
  "따뜻한 이불 속에서 나오기 싫다.",
  "바람이 불어서 머리가 엉망이 됐다.",
  "오늘 할 일을 종이에 적어 두었다.",
  "커피를 쏟아서 바지가 젖었다.",
  "옆집 강아지가 꼬리를 흔든다.",
  "시장에서 떡볶이를 사 먹었다.",
  "알람을 끄고 다시 잠들었다.",
  "가방 안에서 열쇠를 겨우 찾았다.",
  "빨래가 바람에 잘 마르고 있다.",
  "도서관은 언제 가도 조용하다.",
  "감기 기운이 있어서 생강차를 끓였다.",
  "눈이 소복소복 쌓였다.",
  "놀이터에서 아이들이 웃고 있다.",
  "밤하늘에 별이 몇 개 보인다.",
  "휴대폰 배터리가 거의 다 닳았다.",
  "택배 상자를 뜯는 순간이 즐겁다.",
  "엄마가 끓인 미역국이 생각난다.",
  "봄이 오니 꽃이 활짝 피었다.",
  "여름밤에는 수박이 최고다.",
  "가을 낙엽을 밟으며 걸었다.",
  "기차 창밖 풍경이 빠르게 지나간다.",
  "자전거를 타고 강가를 달렸다.",
  "오래된 사진첩을 꺼내 보았다.",
  "손을 씻고 밥상 앞에 앉았다.",
  "주머니에서 동전이 굴러 나왔다.",
  "첫눈이 오면 사진을 찍어 두자.",
  "오늘따라 시간이 느리게 간다.",
  "할머니 댁 마당에 감나무가 있다.",
  "신호등이 초록불로 바뀌었다.",
  "비 온 뒤 무지개가 떴다.",
  "늦잠을 자서 아침을 걸렀다.",
  "맑은 날에는 빨래를 넌다.",
  "노트에 낙서를 잔뜩 했다.",
  "방 청소를 끝내니 기분이 좋다.",
  "뜨거운 국물에 밥을 말아 먹었다.",
  "버스 정류장에서 친구를 만났다.",
  "고장 난 시계를 고치러 갔다.",
  "산책길에 참새 떼를 보았다.",
  "모기 때문에 밤새 잠을 설쳤다.",
  "손톱을 깎다가 너무 짧게 잘랐다.",
  "새 공책 첫 장에 이름을 썼다.",
  "창문을 열자 시원한 바람이 들어왔다.",
  "내일은 꼭 운동을 해야겠다.",
  "빵 굽는 냄새가 골목에 퍼졌다.",
  "닭볶음탕이 생각보다 맵게 됐다.",
  "흙 묻은 신발을 털고 들어왔다.",
  "밝은 달이 지붕 위에 떴다.",
  "넓은 운동장을 한 바퀴 돌았다.",
  "읽던 책을 끝까지 다 읽었다.",
  "값이 싸서 두 개를 샀다.",
  "않던 일을 하니 어색하다.",
  "삶은 달걀에 소금을 찍었다.",
  "옳은 말이라도 부드럽게 하자.",
  "짧은 편지를 써서 건넸다.",
  "여덟 시까지 꼭 도착할게.",
  "의자에 앉아 잠깐 쉬었다.",
  "왜 그런지 오늘은 웃음이 난다.",
  "귀여운 병아리가 삐약거린다.",
  "꽃집 앞에서 한참 서 있었다.",
  "뛰어가다가 신발 끈이 풀렸다.",
  "쓰레기는 나눠서 버리자.",
  "찐 감자에 설탕을 뿌렸다.",
  "따끈한 붕어빵을 봉지째 샀다.",
  "끝까지 해 보면 길이 보인다.",
  "뭐든 처음에는 서툴기 마련이다.",
  "괜찮다고 말해 주는 사람이 있다.",
  "훨씬 나아진 기분이 든다.",
  "외투를 입고 밖으로 나섰다.",
  "의외로 쉬운 문제였다.",
  "언덕 위 궤도 열차가 천천히 올랐다.",
  "젖은 머리를 수건으로 말렸다.",
  "꿀떡을 한입에 쏙 넣었다.",
  "얇은 이불로 바꿀 때가 됐다.",
  "뒷마당에 앉아 귤을 깠다.",
  // 속담(전래, 지은이 없음)
  "가는 말이 고와야 오는 말이 곱다.",
  "낮말은 새가 듣고 밤말은 쥐가 듣는다.",
  "세 살 버릇 여든까지 간다.",
  "소 잃고 외양간 고친다.",
  "원숭이도 나무에서 떨어진다.",
  "백지장도 맞들면 낫다.",
  "티끌 모아 태산.",
  "천 리 길도 한 걸음부터.",
  "등잔 밑이 어둡다.",
  "발 없는 말이 천 리 간다.",
  "고래 싸움에 새우 등 터진다.",
  "우물 안 개구리.",
  "꿩 먹고 알 먹는다.",
  "누워서 떡 먹기.",
  "돌다리도 두들겨 보고 건너라.",
  "하룻강아지 범 무서운 줄 모른다.",
  "콩 심은 데 콩 나고 팥 심은 데 팥 난다.",
  "빈 수레가 요란하다.",
  "공든 탑이 무너지랴.",
  "아니 땐 굴뚝에 연기 날까.",
  "사공이 많으면 배가 산으로 간다.",
  "벼는 익을수록 고개를 숙인다.",
  "열 번 찍어 안 넘어가는 나무 없다.",
  "가랑비에 옷 젖는 줄 모른다.",
  "구슬이 서 말이라도 꿰어야 보배.",
  "호랑이도 제 말 하면 온다.",
  "지렁이도 밟으면 꿈틀한다.",
  "말 한마디로 천 냥 빚을 갚는다.",
  "낫 놓고 기역 자도 모른다.",
  "바늘 도둑이 소도둑 된다.",
  "까마귀 날자 배 떨어진다.",
  "믿는 도끼에 발등 찍힌다.",
  "갈수록 태산이다.",
  "쇠뿔도 단김에 빼라.",
  "작은 고추가 더 맵다.",
  "개구리 올챙이 적 생각 못 한다.",
  "닭 쫓던 개 지붕 쳐다본다.",
  "남의 떡이 더 커 보인다.",
  "시작이 반이다.",
  "김칫국부터 마신다.",
];

/* ---------- 타수 셈법(자모 = 실제로 누르는 글쇠 수) ----------
 * 기준: 우리나라 표준 두벌식 자판(KS X 5002). 글쇠 하나에 자음·모음 하나가 붙어 있고, 윗글쇠(Shift)를 같이 누르면 다른 글자가 나온다.
 * 한 글자의 타수 = 그 글자를 치려고 누르는 '글자 글쇠' 수. 윗글쇠(Shift)는 따로 세지 않는다.
 *  - 기본 자음·모음: 1타.  예) '한' = ㅎ ㅏ ㄴ = 3타
 *  - 쌍자음 ㄲ ㄸ ㅃ ㅆ ㅉ: 1타. 근거: 두벌식 자판에 따로 있는 글자(윗글쇠 + ㄱ·ㄷ·ㅂ·ㅅ·ㅈ 글쇠 한 번)라서.  예) '까' = 2타, '있' = ㅇ ㅣ ㅆ = 3타
 *  - ㅒ ㅖ: 1타. 근거: 쌍자음과 같이 윗글쇠 + ㅐ·ㅔ 글쇠 한 번
 *  - 겹모음 ㅘ ㅙ ㅚ ㅝ ㅞ ㅟ ㅢ: 2타. 근거: 자판에 없어서 ㅗ+ㅏ, ㅗ+ㅐ, ㅗ+ㅣ, ㅜ+ㅓ, ㅜ+ㅔ, ㅜ+ㅣ, ㅡ+ㅣ 를 차례로 눌러 만든다.  예) '왜' = ㅇ ㅗ ㅐ = 3타
 *  - 겹받침 ㄳ ㄵ ㄶ ㄺ ㄻ ㄼ ㄽ ㄾ ㄿ ㅀ ㅄ: 2타. 근거: 자판에 없어서 두 자음을 차례로 눌러 만든다.  예) '닭' = ㄷ ㅏ ㄹ ㄱ = 4타, '없' = ㅇ ㅓ ㅂ ㅅ = 4타
 *  - 받침 ㄲ ㅆ: 1타(쌍자음과 같은 이유)
 *  - 띄어쓰기·마침표·쉼표·물음표 등 그 밖의 글자: 1타
 * 주의: 다른 타자 연습 프로그램이 같은 방식으로 세는지는 확인하지 않았다. 숫자가 그쪽과 다를 수 있다. */
const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
const JONG = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
// 자판에 없는 자모 → 차례로 누르는 글쇠
const SPLIT = {
  ㅘ: "ㅗㅏ", ㅙ: "ㅗㅐ", ㅚ: "ㅗㅣ", ㅝ: "ㅜㅓ", ㅞ: "ㅜㅔ", ㅟ: "ㅜㅣ", ㅢ: "ㅡㅣ",
  ㄳ: "ㄱㅅ", ㄵ: "ㄴㅈ", ㄶ: "ㄴㅎ", ㄺ: "ㄹㄱ", ㄻ: "ㄹㅁ", ㄼ: "ㄹㅂ", ㄽ: "ㄹㅅ", ㄾ: "ㄹㅌ", ㄿ: "ㄹㅍ", ㅀ: "ㄹㅎ", ㅄ: "ㅂㅅ",
};
const unit = (j) => (SPLIT[j] ? [...SPLIT[j]] : [j]);

// 한 글자를 치려고 누르는 자모 목록(쌍자음·ㅒ·ㅖ는 한 덩어리 그대로)
export function keysOf(ch) {
  const c = ch.charCodeAt(0);
  if (c >= 0xac00 && c <= 0xd7a3) {
    const n = c - 0xac00, cho = Math.floor(n / 588), jung = Math.floor((n % 588) / 28), jong = n % 28;
    return [CHO[cho], ...unit(JUNG[jung]), ...(jong ? unit(JONG[jong]) : [])];
  }
  if (c >= 0x3131 && c <= 0x3163) return unit(ch); // 낱자(ㄱ, ㅘ 등)
  return [ch];
}
export const strokesOf = (text) => [...String(text)].reduce((s, ch) => s + keysOf(ch).length, 0);

// 자판 그림에서 어느 글쇠인지: 쌍자음·ㅒ·ㅖ는 윗글쇠를 같이 누르는 아래 글쇠로
const BASE = { ㄲ: "ㄱ", ㄸ: "ㄷ", ㅃ: "ㅂ", ㅆ: "ㅅ", ㅉ: "ㅈ", ㅒ: "ㅐ", ㅖ: "ㅔ", " ": "␣" };
export const keyCap = (k) => BASE[k] || k;
export const KEY_ROWS = [
  [..."ㅂㅈㄷㄱㅅㅛㅕㅑㅐㅔ"],
  [..."ㅁㄴㅇㄹㅎㅗㅓㅏㅣ"],
  [..."ㅋㅌㅊㅍㅠㅜㅡ", ",", "."],
  ["␣"],
];

/* ---------- 문장 묶음 ----------
 * 묶음 번호 k 하나로 문장 5개가 정해진다(같은 번호 = 누구에게나 같은 문장).
 * 오늘의 문장 = 묶음 번호가 '2026-01-01부터 며칠째'(한국 시각)라서 하루 동안 모두 같고 자정에 바뀐다.
 * 연습 = 100000~999999 사이 아무 번호. 도전장 링크에는 이 번호를 그대로 담는다. */
export function pickSet(k) {
  const idx = shuffle([...SENTENCES.keys()], seededRandom(`typing:${k}`)).slice(0, PER);
  return idx.map((i) => SENTENCES[i]);
}
export const dailyK = (day = DAY) => day;
export const randomK = () => 100000 + Math.floor(Math.random() * 900000);
export const isDaily = (k) => k < 100000;
export function parseK(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 999999 && String(n) === String(v) ? n : null;
}
export function parseCpm(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 3000 && String(n) === String(v) ? n : null;
}

/* ---------- 한 문장 채점 ----------
 * 친 글을 문장과 같은 자리끼리 한 글자씩 맞대 본다.
 *  - 맞은 글자 = 같은 자리에 같은 글자
 *  - 그 문장의 글자 수(정확도 분모) = 문장 길이와 친 길이 중 긴 쪽. 덜 치면 못 친 글자가, 더 치면 넘친 글자가 틀린 셈
 *  - 맞은 타 = 맞은 글자들의 타수 합(틀린 글자의 타는 빼고 셈)
 *  - 틀린 자모 = 틀린 자리마다 문장 쪽 글자를 치는 자모를 앞에서부터 맞대 보고 다른(또는 못 친) 자모 */
export function gradeLine(target, typed) {
  const T = [...target], U = [...typed];
  const n = Math.max(T.length, U.length);
  let right = 0, strokes = 0;
  const bad = [], miss = [];
  for (let i = 0; i < n; i++) {
    if (i < T.length && T[i] === U[i]) { right++; strokes += keysOf(T[i]).length; continue; }
    bad.push(i);
    if (i < T.length) {
      const tk = keysOf(T[i]), uk = i < U.length ? keysOf(U[i]) : [];
      tk.forEach((k, j) => { if (uk[j] !== k) miss.push(k); });
    }
  }
  return { right, total: n, strokes, bad, miss };
}

/* 화면 표시용: 치는 중인 글을 문장 글자마다 상태로. 0 아직 / 1 맞음 / 2 틀림 / 3 조합 중(판정 보류) */
export function marks(target, typed, composing) {
  const T = [...target], U = [...typed];
  return T.map((ch, i) => {
    if (i >= U.length) return 0;
    if (composing && i === U.length - 1) return 3;
    return U[i] === ch ? 1 : 2;
  });
}

/* ---------- 한 판 결과 ----------
 * lines: [{ target, typed }] 5개, ms: 첫 입력부터 마지막 문장을 낸 때까지 걸린 시간
 * 타수(분당) = 맞은 타 합 ÷ 걸린 분, 반올림 정수.  정확도 = 맞은 글자 ÷ 글자 수 × 100, 소수 첫째 자리 반올림 */
export function result(lines, ms) {
  let right = 0, total = 0, strokes = 0;
  const missCount = new Map(), keyCount = new Map();
  for (const { target, typed } of lines) {
    const g = gradeLine(target, typed);
    right += g.right; total += g.total; strokes += g.strokes;
    g.miss.forEach((k) => missCount.set(k, (missCount.get(k) || 0) + 1));
    for (const ch of typed) for (const k of keysOf(ch)) { const cap = keyCap(k); keyCount.set(cap, (keyCount.get(cap) || 0) + 1); }
  }
  const t = Math.max(ms, 1000); // 1초보다 짧으면 1초로(숫자가 터무니없이 커지지 않게)
  const cpm = Math.round((strokes * 60000) / t);
  const acc = total ? Math.round((right / total) * 1000) / 10 : 0;
  // 가장 많이 틀린 자모: 횟수가 같으면 먼저 틀린 것
  let worst = null;
  for (const [k, c] of missCount) if (!worst || c > worst.n) worst = { k, n: c };
  return { cpm, acc, right, total, strokes, ms: t, worst, keys: Object.fromEntries(keyCount) };
}

/* ---------- 기록(이 기기) ---------- */
export const history = () => store.get("hist", []);
export function addHistory(r, k) {
  const h = history();
  const prev = h.length ? h[h.length - 1] : null;
  const best = h.reduce((m, x) => Math.max(m, x.cpm), 0);
  h.push({ cpm: r.cpm, acc: r.acc, k, at: DATE });
  store.set("hist", h.slice(-50));
  if (isDaily(k)) { const d = store.get(`day:${k}`, null); if (!d || r.cpm > d.cpm) store.set(`day:${k}`, { cpm: r.cpm, acc: r.acc }); }
  return { prev, best: h.length > 1 ? best : null, n: h.length };
}

export function shareText(label, r, worstText) {
  return `Guess What · 타자 속도 (${label})\n⌨ ${r.cpm}타 · 정확도 ${r.acc.toFixed(1)}%\n가장 많이 틀린 자모: ${worstText}`;
}
