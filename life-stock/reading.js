// 나 상장하기 — 결과 해석 (2026-10-06 v2)
// 차트·숫자를 나열하지 않고 "어떤 사람인가 → 앞으로 그래프는 어디서 오르고 쉬나 → 지금은 어떤 때인가 → 그래서 어떻게" 순서로 이어서 풀어 준다.
// 근거는 전부 엔진이 계산한 값이고, 그 값을 전통 명리의 기본 뜻(십신·오행)으로 생활 말로 옮긴다. 재미용 해석이며 예언이 아님.
// v1 → v2: 독립 점검에서 나온 15가지 반영(같은 대운을 '무난/안 맞음'으로 엇갈려 부르던 것, 불리한 기운을 권하던 것,
//          궁합 '좋은 해'가 본인 바닥과 겹치던 것, 지난 꼭대기를 말하던 것, 점수 뜻 설명 없음, 용어 풀이 없음 등).
//          이전 판: guesswhat-web\_옛브랜드_스냅샷_2026-10-06\reading_v1.js
import { GODS, EL_KO, daeunLabel, gzKo, yearGZ, stemEl, stemKo, yearlyReturns, todayYmd } from "./engine.js";

const mod = (a, n) => ((a % n) + n) % n;
const hasB = (w) => {
  const c = String(w).charCodeAt(String(w).length - 1);
  return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
};
const josa = (w, a, b) => w + (hasB(w) ? a : b);

// 십신이 생활에서 뜻하는 것 / 맞게 들어올 때 / 안 맞게 들어올 때
const GOD_LIFE = {
  비겁: { what: "나 자신·친구·동료", up: "내 힘으로 밀어붙이는 힘이 생기고 사람 덕을 보는", down: "경쟁이 붙고 사람 때문에 돈과 시간이 새기 쉬운" },
  식상: { what: "말·재능·표현", up: "하고 싶은 말과 재주가 밖으로 터져 나오는", down: "말이 앞서고 벌여 놓은 일이 많아지는" },
  재성: { what: "돈·현실·성과", up: "돈과 성과가 손에 잡히는", down: "돈 욕심에 무리하기 쉬운" },
  관성: { what: "직장·책임·평판", up: "자리와 인정이 따라오는", down: "책임과 눈치가 무거워지는" },
  인성: { what: "배움·문서·도와주는 사람", up: "배우고 자격을 얻고 도와주는 사람이 생기는", down: "생각만 많아지고 움직이기 귀찮아지는" },
};
// 오행을 생활에서 늘리는 법 [짧게, 길게]
const EL_DO = [
  ["새로 시작하는 일", "미뤄 둔 일의 첫발, 아침 산책, 계획표 쓰기"],
  ["나를 드러내는 일", "사람 만나기, 발표·SNS처럼 나를 보여 주는 일"],
  ["꾸준히 쌓는 일", "매일 같은 루틴, 적금처럼 꾸준히 쌓는 일"],
  ["정리하고 끊어 내는 일", "안 쓰는 것 버리기, 마감 정하기, 거절 연습"],
  ["배우고 생각하는 일", "공부·독서, 혼자 쉬는 시간, 여행으로 흐름 바꾸기"],
];
const EL_LESS = ["일을 새로 자꾸 벌이는 것", "말과 감정을 다 쏟아내는 것", "한자리에서 변화 없이 버티기만 하는 것", "사람을 너무 칼같이 자르는 것", "생각만 하고 미루는 것"];
const SECTOR_LIFE = {
  money: { up: "돈 모으기·연봉 협상", down: "큰 지출·투자" },
  love: { up: "새 만남·관계 진전", down: "감정적인 결정" },
  health: { up: "운동 시작", down: "무리한 일정" },
  work: { up: "이직·승진 도전", down: "회사와의 정면충돌" },
};
const godOfEl = (P, el) => GODS[P.rel(el)];
const yAge = (P, y) => y - P.birth.y; // 대운 나이와 같은 방식(그해 나이)
const DISCLAIMER = "전통 오행 규칙을 단순하게 옮긴 재미용 풀이예요. 중요한 결정은 이 풀이만 보고 하지 마세요.";

// 같은 사람 해석 안에서 십신 풀이는 처음 한 번만 괄호로
function namer() {
  const seen = new Set();
  return (g) => {
    if (seen.has(g)) return g;
    seen.add(g);
    return `${g}(${GOD_LIFE[g].what})`;
  };
}
const level = (score) => (score > 0.1 ? "good" : score < -0.1 ? "bad" : "flat");

// 20~65세 범위에서 '지금 이후'의 꼭대기와 가장 큰 하락(바닥 시점 포함)
function futureShape(P, today) {
  const N = P.price.length - 1;
  const nowI = Math.max(0, Math.min(N, Math.round(P.tOf(today))));
  const start = Math.max(nowI, 20 * 12);
  const end = Math.min(N, Math.max(65 * 12, nowI + 15 * 12));
  let pk = start;
  for (let i = start; i <= end; i++) if (P.price[i] > P.price[pk]) pk = i;
  let dd = { depth: 0, from: start, to: start };
  for (let i = start + 1, top = start; i <= end; i++) {
    if (P.price[i] > P.price[top]) top = i;
    const dep = P.price[i] / P.price[top] - 1;
    if (dep < dd.depth) dd = { depth: dep, from: top, to: i };
  }
  return { nowI, start, end, pk, dd };
}
// 앞으로의 바닥 구간(연도) — 궁합에서 '좋은 해'를 고를 때 빼려고
export function troughYears(P, today = todayYmd()) {
  const f = futureShape(P, today);
  if (f.dd.depth > -0.08) return null;
  return [P.months[f.dd.from].y, P.months[f.dd.to].y];
}

/* ---------- 나 ---------- */
export function readMe(P, R, today = todayYmd()) {
  const paras = [];
  const N = namer();
  const fav = P.favorable.slice(0, 2);
  // 1) 어떤 종목인가 — 용어는 처음 나올 때 풀기
  const favTxt = fav.map((e) => `${EL_KO[e]}(${GOD_LIFE[godOfEl(P, e)].what})`).join("·");
  const dmKo = stemKo(P.dm) + EL_KO[P.dmEl];
  paras.push({
    h: "어떤 종목인가",
    body:
      `태어난 날의 기운(일간)은 ${dmKo}(${P.industry.el}) — ${P.industry.note}이에요. ` +
      (P.strong
        ? "타고난 기운이 넉넉한 쪽이라, 힘을 쌓아 두기보다 밖으로 쓰고 나눌 때(일·돈·사람) 오히려 잘 풀려요."
        : "타고난 기운이 여린 쪽이라, 기운을 채워 줄 때(배움·쉼·내 편) 잘 풀려요.") +
      (fav.length ? ` 그래서 ${favTxt} 기운이 들어오는 시기에 그래프가 올라가요.` : ""),
  });

  // 2) 앞으로의 그래프 — 지금 이후 꼭대기와 바닥
  const f = futureShape(P, today);
  const pkM = P.months[f.pk];
  const pkDy = P.daeun[pkM.daeun];
  const pkLv = level(pkDy.score);
  const pkSg = godOfEl(P, stemEl(pkDy.gz.s));
  const around = [-2, -1, 0, 1, 2].filter((k) => P.gzScore(yearGZ(pkM.y + k)) > 0).length;
  const syG = godOfEl(P, stemEl(yearGZ(pkM.y).s));
  const inDy = pkM.y - pkDy.startYear;
  const where = inDy <= 2 ? "이 막 시작되는" : inDy >= 7 ? "의 끝자락인" : "의 한가운데인";
  let pkTxt = `앞으로 가장 높은 곳은 ${pkM.y}년(${yAge(P, pkM.y)}세) 무렵이에요. 10년마다 바뀌는 큰 흐름(대운)으로 보면 ${daeunLabel(P, pkDy)}${where} 때예요. `;
  if (pkLv === "good") pkTxt += `${N(pkSg)} 기운이 맞게 들어와 ${GOD_LIFE[pkSg].up} 시기라 자연스럽게 올라가요.`;
  else
    pkTxt += `${pkLv === "bad" ? "큰 흐름 자체는 힘든 편인데도" : "큰 흐름은 무난한 편인데"}, ${
      around >= 3 ? "그 앞뒤로 해마다 들어오는 기운이 잘 맞는 해가 몰려 있어서" : `그해(${pkM.y}년) 들어오는 ${N(syG)} 기운이 잘 맞아서`
    } 반짝 올라가는 꼭대기예요.`;
  let ddTxt = " 앞으로 크게 무너지는 구간 없이 완만하게 가는 차트예요.";
  const trough = f.dd.depth < -0.08 ? [P.months[f.dd.from], P.months[f.dd.to]] : null;
  const fav0 = fav[0] != null ? EL_DO[fav[0]][0] : "하던 일";
  if (trough) {
    const [a, b] = trough;
    const long = b.y - a.y > 8;
    ddTxt =
      ` 반대로 ${a.y}년부터 ${b.y}년까지가 가장 크게 쉬어 가는 구간이고, 바닥은 ${b.y}년 무렵이에요.` +
      (long ? " 한두 해가 아니라 길게 이어지는 조정이라" : " 이 몇 해는") +
      ` 판을 벌이기보다 ${fav0}에 힘을 두면 덜 흔들려요.`;
  }
  paras.push({ h: "앞으로 그래프는 어디서 오르고 쉬나", body: pkTxt + ddTxt });

  // 3) 지금은 어떤 때인가 — 큰 흐름과 앞으로 3년 영역 지표를 하나의 결론으로
  const cur = R.cur;
  const cLv = level(cur.score);
  const cSg = godOfEl(P, stemEl(cur.gz.s));
  const yrIn = today.y - cur.startYear + 1;
  const ds = R.sectors.map((x) => ({ ...x, d3: x.series[2] - x.series[0] })).sort((a, b) => b.d3 - a.d3);
  const up = ds.filter((x) => x.d3 >= 8).slice(0, 2);
  const dn = ds.filter((x) => x.d3 <= -8).slice(-1);
  const nm = (arr) => arr.map((x) => x.name).join("·");
  const inTrough = trough && today.y >= trough[0].y && today.y <= trough[1].y;
  const slow = cLv === "bad" || inTrough;
  let now = cur.pre ? "아직 첫 대운이 오기 전이라 태어난 달의 기운이 흐름을 맡고 있어요. " : `지금(${today.y}년)은 ${daeunLabel(P, cur)} ${yrIn}년째예요. `;
  if (inTrough) {
    now += `바로 위에서 말한 쉬어 가는 구간 안이에요. 바닥은 ${trough[1].y}년 무렵이고, 그 뒤로 다시 올라가요.`;
    if (R.best && R.best.y > trough[1].y) now += ` 맞는 기운이 크게 다시 들어오는 건 ${R.best.y}년(${gzKo(R.best.g)})이에요.`;
  } else if (!cur.pre) {
    if (cLv === "good") now += `${N(cSg)} 기운이 맞게 들어와 ${GOD_LIFE[cSg].up} 흐름이라 밀어붙여도 되는 때예요.`;
    else if (cLv === "bad") now += `${N(cSg)} 기운이 맞지 않게 들어와 ${GOD_LIFE[cSg].down} 흐름이라, 판을 키우기보다 속도를 조절할 때예요.`;
    else now += "큰 흐름은 좋지도 나쁘지도 않은 평평한 구간이에요. 해마다 들어오는 기운에 따라 오르내려요.";
  }
  if (up.length || dn.length) {
    const lead = slow ? "그 안에서도 앞으로 3년" : "앞으로 3년";
    now += up.length && dn.length ? ` ${lead} ${nm(up)} 쪽은 오르고, ${nm(dn)} 쪽은 내려가요.` : up.length ? ` ${lead} ${nm(up)} 쪽은 올라요.` : ` ${lead} ${nm(dn)} 쪽은 내려가요.`;
    if (up.length) now += ` ${up.map((x) => SECTOR_LIFE[x.key].up).join(", ")}${slow ? "은 크게 말고 작게 챙겨 보세요." : "은 지금 힘을 실어 볼 만해요."}`;
    if (dn.length) now += ` ${dn.map((x) => SECTOR_LIFE[x.key].down).join(", ")}은 잠시 미루는 게 좋아요.`;
  }
  paras.push({ h: "지금은 어떤 때인가", body: now });

  // 4) 그래서 이렇게
  const tips = [];
  fav.forEach((e) => tips.push(`${EL_KO[e]} 기운 채우기: ${EL_DO[e][1]}`));
  if (P.unfavorable[0] != null) tips.push(`덜 하면 좋은 것: ${EL_LESS[P.unfavorable[0]]}`);
  if (R.best) tips.push(`${R.best.y}년(${gzKo(R.best.g)})은 앞으로 5년 중 맞는 기운이 가장 많이 들어오는 해예요. 새로 시작하는 일에 마음을 싣기 좋은 해로 참고해 보세요.`);
  paras.push({ h: "그래서 이렇게", list: tips, note: DISCLAIMER });
  return paras;
}

/* ---------- 두 사람 ---------- */
const REL = {
  love: { as: "연인으로서", both: "여행·이사·기념일처럼 둘이 같이 크게 벌이는 일", lean: (g, b) => `${josa(g, "이", "가")} 먼저 ${b}의 얘기를 들어 주기` },
  friend: { as: "친구로서", both: "같이 여행 가거나 같이 뭔가 배우기 시작하기", lean: (g, b) => `${josa(g, "이", "가")} 먼저 ${b}에게 연락하기` },
  work: { as: "동료로서", both: "같이 새 프로젝트나 사업 시작하기", lean: (g, b) => `${josa(g, "이", "가")} ${b} 몫의 일을 나눠 맡기` },
};
// 관계 구조(같은 기운 / X가 Y를 살림 / X가 Y를 다잡음) × 관계 종류별 설명과 양쪽 할 일
function structure(type, X, Y, rel, ex, ey) {
  const x = josa(X, "이", "가");
  const y = josa(Y, "이", "가");
  const yo = josa(Y, "을", "를");
  if (type === "same") {
    return {
      txt: {
        love: `둘 다 ${EL_KO[ex]} 기운이라 감정 쓰는 방식이 닮았어요. 말 안 해도 통하는 대신, 한 번 토라지면 둘 다 먼저 안 숙여요.`,
        friend: `둘 다 ${EL_KO[ex]} 기운이라 노는 취향과 생각이 닮았어요. 편한 대신 고집이 부딪히면 오래 가요.`,
        work: `둘 다 ${EL_KO[ex]} 기운이라 일하는 방식이 닮았어요. 손발이 맞는 대신 둘 다 같은 데서 놓쳐요.`,
      }[rel],
      todo: [`${X}: 다툼이 길어지면 먼저 숙이는 순번 정해 두기`, `${Y}: 의견이 갈리면 기준(마감·예산·시간)부터 같이 정하기`],
    };
  }
  if (type === "gen") {
    const arrow = `(${EL_KO[ex]} → ${EL_KO[ey]})`;
    return {
      txt: {
        love: `${x} ${yo} 살려 주는 관계예요${arrow}. ${x} 챙기고 ${y} 힘을 얻는 연애라, 주는 쪽이 지치기 쉬워요.`,
        friend: `${x} ${yo} 살려 주는 관계예요${arrow}. ${x} 먼저 부르고 들어 주는 쪽, ${y} 기대는 쪽이에요.`,
        work: `${x} ${yo} 살려 주는 관계예요${arrow}. ${x} 끌고 가르쳐 주고, ${y} 받아서 키우는 조합이에요.`,
      }[rel],
      todo: [`${X}: 다 해 주지 말고 힘들 땐 힘들다고 말하기`, `${Y}: 받은 만큼 고마움을 말로 표현하기`],
    };
  }
  const press = `(${josa(EL_KO[ex], "이", "가")} ${josa(EL_KO[ey], "을", "를")} 누르는 쪽)`;
  return {
    txt: {
      love: `${x} ${yo} 다잡는 관계예요${press}. ${x} 기준을 세우고 ${y} 맞춰 가는 연애라, 걱정이 잔소리로 들리기 쉬워요.`,
      friend: `${x} ${yo} 다잡는 관계예요${press}. ${x} 팩트를 말하고 ${y} 찔리는 사이라, 말 한마디가 세게 들릴 수 있어요.`,
      work: `${x} ${yo} 다잡는 관계예요${press}. 결정권은 ${X} 쪽에 쏠리기 쉽고, ${y} 실행을 맡는 조합이에요.`,
    }[rel],
    todo: [`${X}: 말투를 한 번 더 부드럽게`, `${Y}: 답답한 건 쌓아 두지 말고 미리 말하기`],
  };
}

export function readPair(P, B, M, rel = "love", today = todayYmd()) {
  const R0 = REL[rel] || REL.love;
  const A = P.name;
  const Bn = B.name;
  const paras = [];
  // 1) 점수가 뜻하는 것 — 무엇이 올리고 깎았나
  const parts = [
    { k: "같은 시기에 같이 움직이는 정도", v: 18 * M.corr },
    { k: "타고난 기운끼리 돕는 정도", v: 24 * M.mutual },
    { k: "한쪽에 없는 기운을 채워 주는 정도", v: 16 * M.comp },
  ].sort((a, b) => b.v - a.v);
  const rank = M.synergy >= 25 ? 1 : M.synergy >= 10 ? 2 : M.synergy >= -5 ? 3 : 4;
  const d = mod(B.dmEl - P.dmEl, 5);
  const [type, X, Y, ex, ey] =
    d === 0 ? ["same", A, Bn, P.dmEl, B.dmEl] : d === 1 ? ["gen", A, Bn, P.dmEl, B.dmEl] : d === 4 ? ["gen", Bn, A, B.dmEl, P.dmEl] : d === 2 ? ["ctrl", A, Bn, P.dmEl, B.dmEl] : ["ctrl", Bn, A, B.dmEl, P.dmEl];
  const st = structure(type, X, Y, rel, ex, ey);
  paras.push({
    h: `시너지 ${M.synergy > 0 ? "+" : ""}${M.synergy}%가 뜻하는 것`,
    body:
      `${R0.as} '${M.label.t}' 등급이에요(네 단계 중 ${rank}번째). 점수를 가장 끌어올린 건 '${parts[0].k}'이고` +
      (parts[2].v < 0 ? `, 깎아 먹은 건 '${parts[2].k}'예요.` : ", 세 가지 모두 점수를 올리는 쪽이에요.") +
      ` ${st.txt}`,
  });
  // 2) 앞으로 10년, 언제 같이 좋고 언제 엇갈리나
  const ra = yearlyReturns(P, today.y, today.y + 9);
  const rb = yearlyReturns(B, today.y, today.y + 9);
  const yrs = ra.map((v, i) => ({ y: today.y + i, a: v, b: rb[i] }));
  const tA = troughYears(P, today);
  const tB = troughYears(B, today);
  const inT = (y, t) => t && y >= t[0] && y <= t[1];
  const both = yrs.filter((o) => o.a > 0.02 && o.b > 0.02 && !inT(o.y, tA) && !inT(o.y, tB)).sort((p, q) => Math.min(q.a, q.b) - Math.min(p.a, p.b));
  const split = yrs.filter((o) => (o.a > 0.02 && o.b < -0.02) || (o.a < -0.02 && o.b > 0.02));
  const mean = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const ma = mean(ra);
  const mb = mean(rb);
  let num = 0;
  let da = 0;
  let db = 0;
  ra.forEach((v, i) => {
    num += (v - ma) * (rb[i] - mb);
    da += (v - ma) ** 2;
    db += (rb[i] - mb) ** 2;
  });
  const c10 = da && db ? num / Math.sqrt(da * db) : 0;
  let flow =
    c10 > 0.3
      ? "앞으로 10년은 둘의 그래프가 같이 오르고 같이 쉬는 편이에요. 좋을 때 같이 크게 벌이기 좋은 대신, 쉬어 가는 해도 겹쳐요."
      : c10 < -0.2
        ? "앞으로 10년은 둘의 그래프가 엇갈리는 편이에요. 한 명이 쉬어 갈 때 다른 한 명이 올라가서, 번갈아 받쳐 주는 사이가 돼요."
        : "앞으로 10년은 둘의 그래프가 각자 페이스대로 움직여요. 같이 뭔가 할 시기는 일부러 맞춰야 해요.";
  if (both.length) flow += ` 둘 다 무리 없이 오르는 해는 ${both.slice(0, 3).map((o) => o.y).sort().join("·")}년이에요.`;
  else flow += " 둘이 함께 크게 오르는 해는 이 10년 안에선 뚜렷하지 않아요.";
  if (split.length) flow += ` ${split.slice(0, 2).map((o) => `${o.y}년은 ${o.a > o.b ? Bn : A} 쪽이 쉬어 가고 ${o.a > o.b ? A : Bn} 쪽이 받쳐 줄 해`).join(", ")}예요.`;
  paras.push({ h: "앞으로 10년, 언제 같이 좋고 언제 엇갈리나", body: flow });
  // 3) 그래서
  const tips = [...st.todo];
  if (both.length) tips.push(`${both[0].y}년: ${R0.both}에 가장 좋은 해`);
  split.slice(0, 2).forEach((o) => tips.push(`${o.y}년: ${o.a > o.b ? R0.lean(A, Bn) : R0.lean(Bn, A)}`));
  M.fills.slice(0, 2).forEach((f) => {
    const [lackP, giveP] = f.to === "A" ? [P, B] : [B, P];
    const role = ["시작하는 힘", "표현하는 힘", "버티는 힘", "정리하는 힘", "생각하는 힘"][f.el];
    if (lackP.favorable.includes(f.el)) tips.push(`${lackP.name}에게 부족하고 꼭 필요한 ${EL_KO[f.el]} 기운(${role})을 ${josa(giveP.name, "이", "가")} 갖고 있어요. 이 부분은 ${giveP.name} 쪽에 맡기면 편해요.`);
    else tips.push(`${lackP.name}에게 없는 ${EL_KO[f.el]} 기운(${role})을 ${josa(giveP.name, "이", "가")} 갖고 있어요. 도움이 될지는 때에 따라 달라서, 너무 기대기보다 참고만 하세요.`);
  });
  paras.push({ h: "그래서 이렇게", list: tips, note: DISCLAIMER });
  return paras;
}

export function readingHTML(paras, esc) {
  return paras
    .map(
      (p) =>
        `<div class="rd__p"><h4>${esc(p.h)}</h4>${p.body ? `<p>${esc(p.body)}</p>` : ""}${p.list ? `<ul>${p.list.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : ""}${
          p.note ? `<p class="rd__note">${esc(p.note)}</p>` : ""
        }</div>`
    )
    .join("");
}
