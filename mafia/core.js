// 마피아 역할 나눠 주기 — 계산(화면 없음). 서버 없이 '판 설정 + 판 번호'만으로 누가 어떤 역할인지 정해진다.
// 같은 링크(같은 설정·같은 판 번호·같은 판 차례)를 연 사람은 모두 같은 결과를 본다. 각자 폰으로 자기 번호만 열면 된다.
// 인원은 사회자(진행자)를 뺀 플레이어 수. 사회자는 역할을 받지 않고 진행 순서 화면을 본다.
import { seededRandom, shuffle, createStore } from "../shared/kit.js";

export const store = createStore("mafia");
export const MIN_N = 4, MAX_N = 16;

export const ROLES = {
  mafia: { name: "마피아", team: "마피아 편", desc: "밤마다 동료와 함께 한 명을 골라 없애요. 낮에는 시민인 척하세요. 마피아 수가 남은 시민 수와 같아지면 이겨요." },
  doctor: { name: "의사", team: "시민 편", desc: "밤마다 한 명을 골라 살려요(자기 자신도 돼요). 마피아가 고른 사람을 맞히면 그 밤엔 아무도 안 죽어요." },
  police: { name: "경찰", team: "시민 편", desc: "밤마다 한 명을 골라 사회자에게 마피아인지 물어봐요. 알아낸 걸 낮에 어떻게 쓸지가 실력이에요." },
  citizen: { name: "시민", team: "시민 편", desc: "특별한 능력은 없어요. 낮 토론과 투표로 마피아를 모두 찾아내면 이겨요." },
};

// 마피아 추천 수: 4~5명 1, 6~8명 2, 9~12명 3, 13~16명 4
export const recommendMafia = (n) => (n <= 5 ? 1 : n <= 8 ? 2 : n <= 12 ? 3 : 4);
// 마피아는 나머지보다 적어야 함(처음부터 같거나 많으면 바로 마피아 승)
export const maxMafia = (n) => Math.floor((n - 1) / 2);

/* 판 번호: 헷갈리는 글자(0·O·1·I·L) 뺀 5글자 */
const ABC = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export function newCode(rand = Math.random) {
  let s = "";
  for (let i = 0; i < 5; i++) s += ABC[Math.floor(rand() * ABC.length)];
  return s;
}
export const validCode = (k) => typeof k === "string" && /^[2-9A-HJKMNP-Z]{5}$/.test(k);

/* 판 설정: { n 인원, m 마피아 수, d 의사(0/1), p 경찰(0/1), k 판 번호, r 몇 번째 판 } */
export function cfgOK(c) {
  return !!c && Number.isInteger(c.n) && c.n >= MIN_N && c.n <= MAX_N
    && Number.isInteger(c.m) && c.m >= 1 && c.m <= maxMafia(c.n)
    && (c.d === 0 || c.d === 1) && (c.p === 0 || c.p === 1)
    && c.m + c.d + c.p <= c.n - 1
    && validCode(c.k)
    && Number.isInteger(c.r) && c.r >= 1 && c.r <= 999;
}
export function cfgFromParams(get) {
  const c = { n: +get("n"), m: +get("m"), d: +get("d") || 0, p: +get("p") || 0, k: String(get("k") || "").toUpperCase(), r: +(get("r") || 1) };
  return cfgOK(c) ? c : null;
}
export const queryOf = (c) => `?n=${c.n}&m=${c.m}&d=${c.d}&p=${c.p}&k=${c.k}${c.r > 1 ? `&r=${c.r}` : ""}`;
export const seedOf = (c) => `mafia:v1:${c.n}:${c.m}:${c.d}:${c.p}:${c.k}:${c.r}`;

/* 한 판 나누기 — 결과는 판 설정만으로 정해진다
 * 돌려주는 것: roles[번호-1] = { no, role('mafia'|'doctor'|'police'|'citizen'), mates(마피아끼리 서로의 번호, 아니면 []) },
 *             mafia(마피아 번호, 작은 순), doctor(번호 또는 null), police(번호 또는 null), count(역할별 수) */
export function deal(c) {
  if (!cfgOK(c)) return null;
  const rand = seededRandom(seedOf(c));
  const nums = Array.from({ length: c.n }, (_, i) => i + 1);
  const p = shuffle(nums, rand);
  const mafia = p.slice(0, c.m).sort((a, b) => a - b);
  let i = c.m;
  const doctor = c.d ? p[i++] : null;
  const police = c.p ? p[i++] : null;
  const roles = nums.map((no) => {
    const role = mafia.includes(no) ? "mafia" : no === doctor ? "doctor" : no === police ? "police" : "citizen";
    return { no, role, mates: role === "mafia" ? mafia.filter((x) => x !== no) : [] };
  });
  const count = { mafia: c.m, doctor: c.d, police: c.p, citizen: c.n - c.m - c.d - c.p };
  return { roles, mafia, doctor, police, count };
}
export const cardFor = (c, no) => deal(c)?.roles[no - 1] || null;

/* 사회자 진행 순서(밤 → 낮 한 바퀴). sec 가 있으면 그 단계에 타이머를 띄운다. need 가 있으면 그 역할이 있을 때만 */
export const STEPS = [
  { phase: "밤", title: "모두 눈 감기", say: "밤이 됐습니다. 모두 고개를 숙이고 눈을 감아 주세요." },
  { phase: "밤", title: "마피아 차례", say: "마피아는 눈을 떠 서로 확인하고, 없앨 사람 한 명을 손으로 가리켜 주세요.", tip: "사회자는 마피아가 고른 번호를 기억해요. 다 정했으면 '마피아는 눈을 감아 주세요'.", sec: 30 },
  { phase: "밤", title: "의사 차례", need: "d", say: "의사는 눈을 떠 살릴 사람 한 명을 가리켜 주세요. 자기 자신도 돼요.", tip: "사회자는 의사가 고른 번호를 기억해요. 그다음 '의사는 눈을 감아 주세요'.", sec: 15 },
  { phase: "밤", title: "경찰 차례", need: "p", say: "경찰은 눈을 떠 조사할 사람 한 명을 가리켜 주세요.", tip: "그 사람이 마피아면 엄지를 위로, 아니면 아래로 보여 줘요(사회자는 아까 눈 뜬 마피아를 봤으니 알아요). 그다음 '경찰은 눈을 감아 주세요'.", sec: 15 },
  { phase: "낮", title: "아침 발표", say: "아침이 됐습니다. 모두 눈을 떠 주세요.", tip: "마피아가 고른 사람을 발표해요. 의사가 같은 사람을 살렸으면 '아무도 죽지 않았습니다'. 죽은 사람은 이제 말할 수 없어요." },
  { phase: "낮", title: "토론", say: "누가 마피아인지 자유롭게 이야기해 주세요.", sec: 180 },
  { phase: "낮", title: "지목 투표", say: "셋을 세면 동시에 마피아라고 생각하는 사람을 가리켜 주세요. 하나, 둘, 셋!", tip: "가장 많이 지목된 사람이 앞으로 나와요. 동점이면 이번 낮은 아무도 안 나가요(집 규칙에 따라 재투표도 돼요)." },
  { phase: "낮", title: "최후 변론", say: "지목된 사람은 30초 동안 변론해 주세요.", sec: 30 },
  { phase: "낮", title: "처형 투표", say: "처형에 찬성하면 손을 들어 주세요.", tip: "절반 넘게 찬성하면 처형해요. 처형된 사람은 역할을 밝히지 않고 빠져요." },
  { phase: "낮", title: "승패 확인", say: "마피아를 모두 찾으면 시민 승, 마피아 수가 남은 시민 수와 같아지면 마피아 승이에요.", tip: "아직 안 끝났으면 다음 밤으로 넘어가요." },
];
export const stepsFor = (c) => STEPS.filter((s) => !s.need || c[s.need]);
export const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
