// 어디가? — 다같이 고르는 메뉴·장소 월드컵
import {
  $, $$, createStore, toast, haptic, share, shareImage, encodeState, decodeState, urlWith, getParam, todayKey,
  showView, openSheet, renderMoreSites, createCanvas, roundRect, wrapText, CANVAS_FONT, prefersReducedMotion, sleep,
} from "../shared/kit.js";
import { STATIONS, REGIONS, MENU_TAGS, DATE_TAGS, PRICE_LABEL } from "./data.js";
import { catalogAdapter, getNearbyPlaces, getWeather, findMenuNearby, mapLinks, loadConfig } from "./adapters.js";
import { computeMidpoint, miniMapSVG, fmtDist, walkMin, nearestStation } from "./geo.js";
import { buildPool, Bracket, aggregate, roundLabel } from "./game.js";
import { startIntro } from "./intro.js";

const store = createStore("where-to-go");
// 받침에 따라 조사 고르기
const batchim = (w) => {
  const c = String(w).charCodeAt(String(w).length - 1);
  return c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 : 0;
};
const iga = (w) => `${w}${batchim(w) ? "이" : "가"}`;
const euro = (w) => `${w}${batchim(w) && batchim(w) !== 8 ? "으로" : "로"}`;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const reduce = prefersReducedMotion();

const MODES = {
  lunch: { e: "🍱", n: "점심", g: "점", l: "l2", title: "점심 월드컵", go: "점심 후보 뽑기" },
  date: { e: "💑", n: "데이트 코스", g: "데", l: "l3", title: "데이트 코스 월드컵", go: "1코스 밥 후보 뽑기" },
  group: { e: "🍻", n: "모임·회식", g: "모", l: "l4", title: "모임 장소 월드컵", go: "모임 후보 뽑기" },
};
const STAGE = {
  main: { n: "메뉴", l: "l2" },
  meal: { n: "밥", l: "l2" },
  cafe: { n: "카페", l: "l9" },
  play: { n: "놀거리", l: "l1" },
};
// 분류 → 노선색·한 글자 배지
const GROUP_LINE = { 한식: "l2", 고기: "l6", 일식: "l4", 중식: "sb", 양식: "l3", 아시안: "l7", 분식: "l8", 해산물: "l1", 카페: "l9", 놀거리: "l1", 술집: "l7" };
const lineOf = (it) => `var(--art-${GROUP_LINE[it?.g] || GROUP_LINE[it?.c] || (it?.kind === "cafe" ? "l9" : it?.kind === "play" ? "l1" : "l2")})`;
const glyphOf = (it) => String(it?.kind === "cafe" ? "카" : it?.kind === "play" ? "놀" : it?.g || it?.c || "식").slice(0, 1);
const lb = (it, cls = "") => `<span class="lb ${cls}" style="--l: ${lineOf(it)}" aria-hidden="true">${esc(glyphOf(it))}</span>`;
const RADII = [
  { v: 400, n: "도보 5분" },
  { v: 800, n: "10분" },
  { v: 1200, n: "15분" },
];

/* ---------- 상태 ---------- */
const prefs = store.get("prefs", {});
const S = {
  mode: MODES[prefs.mode] ? prefs.mode : "lunch",
  loc: null,
  namesBy: { lunch: ["나"], date: ["나", "너"], ...(prefs.namesBy || {}) },
  people: [
    { name: "나", loc: null },
    { name: "친구", loc: null },
  ],
  source: prefs.source === "place" ? "place" : "menu",
  radius: prefs.radius || 800,
  prices: new Set(),
  tags: new Set(),
  excludeRecent: true,
  size: prefs.size === 8 ? 8 : 16,
  vote: prefs.vote || "solo",
  weather: null,
  weatherKey: "",
  salt: 0,
  kakao: false,
};
let G = null; // 진행 중인 게임
let intro = null;

function savePrefs() {
  store.set("prefs", { mode: S.mode, namesBy: S.namesBy, source: S.source, radius: S.radius, size: S.size, vote: S.vote });
}

const voters = () => (S.mode === "group" ? S.people.map((p) => p.name) : S.namesBy[S.mode] || ["나"]);
function searchLoc() {
  if (S.mode === "group") {
    const mid = computeMidpoint(S.people);
    if (mid) return { name: mid.station.name, lat: mid.station.lat, lon: mid.station.lon, kind: "mid" };
    return S.people.find((p) => p.loc)?.loc || null;
  }
  return S.loc;
}
const locLabel = (loc) => (loc ? (loc.kind === "gps" ? (loc.near ? `${loc.near} 근처` : "내 위치") : loc.name) : "");

/* ---------- 기록 ---------- */
const getLogs = () => store.get("logs", []);
function recentKeys() {
  const days = [0, 1, 2].map((k) => todayKey(new Date(Date.now() - k * 86400000)));
  return new Set(getLogs().filter((l) => days.includes(l.d)).map((l) => l.id));
}
function recentNames() {
  const y = todayKey(new Date(Date.now() - 86400000));
  const t = todayKey();
  const logs = getLogs();
  const pick = (d) => logs.filter((l) => l.d === d).map((l) => l.n);
  return { today: pick(t), yesterday: pick(y) };
}
function streakWarning() {
  const logs = getLogs().slice().sort((a, b) => b.t - a.t);
  if (logs.length < 2) return null;
  let n = 1;
  while (n < logs.length && logs[n].n === logs[0].n) n++;
  if (n >= 2) return `최근 ${n}번 연속 ${logs[0].n}이에요. 오늘은 다른 거 어때요?`;
  let g = 1;
  while (g < logs.length && logs[g].g === logs[0].g) g++;
  if (g >= 3) return `최근 ${g}번 연속 ${logs[0].g}만 먹었어요. 새로운 분류도 도전해 봐요!`;
  return null;
}

/* ---------- 위치 ---------- */
function getGPS() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      reject,
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  });
}
async function gpsLoc() {
  try {
    const p = await getGPS();
    const st = nearestStation(p);
    return { name: "내 위치", lat: p.lat, lon: p.lon, kind: "gps", near: st && st.dist < 2.5 ? st.name : null };
  } catch {
    toast("위치를 가져오지 못했어요. 역을 골라 주세요");
    return null;
  }
}

async function refreshWeather() {
  const loc = searchLoc();
  const key = loc ? `${loc.lat.toFixed(2)},${loc.lon.toFixed(2)}` : "";
  if (key === S.weatherKey) return;
  S.weatherKey = key;
  S.weather = null;
  if (!loc) return;
  const w = await getWeather(loc);
  if (S.weatherKey !== key) return;
  S.weather = w;
  if (w && !$("#setup").hidden) renderSetup();
}

function weatherText(w, stage = "main") {
  if (!w) return "";
  const t = `${Math.round(w.temp)}℃`;
  const food = stage === "main" || stage === "meal";
  if (w.rainy) return food ? `비 와서 국물 메뉴 가중치 ↑ (${t})` : `비 와서 실내 코스 가중치 ↑ (${t})`;
  if (w.cold) return food ? `${t}로 쌀쌀해서 국물 메뉴 가중치 ↑` : `${t}로 추워서 실내 코스 가중치 ↑`;
  if (w.hot) return food ? `${t}로 더워서 가벼운 메뉴 가중치 ↑` : "";
  return "";
}

/* ---------- 역 고르기 시트 ---------- */
function openPlaceSheet({ title, withName = false, defaultName = "", onPick }) {
  const sheet = $("#sheet");
  sheet.innerHTML = `
    <h3>${esc(title)}</h3>
    <div class="sheet__search">
      ${withName ? `<input class="input" id="pName" maxlength="8" placeholder="이름 (예: 민지)" value="${esc(defaultName)}" />` : ""}
      <button class="btn btn--secondary btn--block" data-pick="gps">◎ 내 위치 쓰기</button>
      <input class="input" id="stQ" type="search" placeholder="역·동네 검색 (예: 강남, 서면)" autocomplete="off" />
    </div>
    <div id="stList"></div>
    <p class="block__hint">좌표는 역·도심 중심의 근사치예요. 목록에 없으면 가까운 큰 역을 골라 주세요.</p>
    <button class="btn btn--ghost btn--block" data-sheet-close>닫기</button>`;
  const list = $("#stList", sheet);
  const draw = (q = "") => {
    const qq = q.replace(/\s|역$/g, "");
    const hits = STATIONS.filter((s) => !qq || s.name.replace(/\s/g, "").includes(qq));
    if (!hits.length) {
      list.innerHTML = `<p class="st-empty">'${esc(q)}' 근처 역을 못 찾았어요</p>`;
      return;
    }
    list.innerHTML = REGIONS.map((r) => {
      const rs = hits.filter((s) => s.region === r);
      if (!rs.length) return "";
      return `<div class="st-group">${r}</div><div class="st-list">${rs
        .map((s) => `<button class="st-item" data-pick="${STATIONS.indexOf(s)}">${esc(s.name)}</button>`)
        .join("")}</div>`;
    }).join("");
  };
  draw();
  $("#stQ", sheet).addEventListener("input", (e) => draw(e.target.value.trim()));
  const close = openSheet(sheet);
  sheet.onclick = async (e) => {
    const b = e.target.closest("[data-pick]");
    if (!b) return;
    const name = withName ? ($("#pName", sheet).value.trim() || defaultName || "친구") : null;
    if (b.dataset.pick === "gps") {
      b.classList.add("is-loading");
      const loc = await gpsLoc();
      b.classList.remove("is-loading");
      if (!loc) return;
      close();
      onPick(loc, name);
    } else {
      const s = STATIONS[Number(b.dataset.pick)];
      close();
      onPick({ name: s.name, lat: s.lat, lon: s.lon, kind: "station" }, name);
    }
  };
}

/* ---------- 화면 전환 ---------- */
function go(view) {
  if (view !== "intro" && intro) {
    intro.stop();
    intro = null;
  }
  if (view === "intro" && !intro) intro = startIntro($("#intro"));
  showView(view);
  document.body.dataset.screen = view;
}

/* ---------- 인트로 보조 버튼 ---------- */
function renderIntroExtra() {
  const team = store.get("team");
  const room = latestRoom();
  const logs = getLogs();
  $("#introExtra").innerHTML = [
    team
      ? `<button class="btn btn--secondary btn--block" data-act="teamGo">우리 팀(${esc(team.names.join("·"))}) 점심 바로 고르기</button>`
      : "",
    room ? `<button class="btn btn--outline btn--block" data-act="openRoom" data-id="${room.id}">진행 중인 링크 투표 (${room.replies.length}명 답장)</button>` : "",
    logs.length && !team ? `<button class="btn btn--ghost btn--block" data-act="report">이번 달 점심 리포트 보기</button>` : "",
  ].join("");
}

/* ---------- 설정 화면 ---------- */
function renderSetup() {
  const m = S.mode;
  const el = $("#setup");
  el.innerHTML = `
    <div class="mode-tabs" role="group" aria-label="무엇을 고를까요">
      ${Object.entries(MODES)
        .map(([k, v]) => `<button class="mode-tab" style="--l: var(--art-${v.l})" data-act="mode" data-v="${k}" aria-pressed="${k === m}"><span class="lb" aria-hidden="true">${v.g}</span>${v.n}</button>`)
        .join("")}
    </div>
    <div class="blocks" style="--l: var(--art-${MODES[m].l})">
      ${m === "group" ? blockPeople() : blockLoc()}
      ${m !== "group" ? blockNames() : ""}
      ${blockSource()}
      ${blockFilters()}
      ${blockVote()}
    </div>
    <div class="sticky-cta">
      <button class="btn btn--primary btn--lg btn--block" data-act="go" id="go">${MODES[m].go} →</button>
    </div>`;
}

function blockLoc() {
  const loc = S.loc;
  const title = S.mode === "lunch" ? "어디 근처에서 먹어요?" : "어디서 만나요?";
  const wt = weatherText(S.weather);
  return `<div class="card card--flat block">
    <div class="block__title"><h3>${title}</h3></div>
    ${
      loc
        ? `<div class="loc-pill">
            <span class="lb lb--lg lb--ring" style="--l: var(--art-${MODES[S.mode].l})" aria-hidden="true">${loc.kind === "gps" ? "◎" : esc(loc.name.slice(0, 1))}</span>
            <div class="loc-pill__txt"><div class="loc-pill__name">${esc(locLabel(loc))}</div>
            <div class="loc-pill__sub">${loc.kind === "gps" ? "현재 위치 기준" : "역 중심 기준 (근사 좌표)"}</div></div>
            <button class="btn btn--ghost btn--sm" data-act="pickLoc">바꾸기</button>
          </div>`
        : `<div class="btn-row">
            <button class="btn btn--secondary" data-act="gps">◎ 내 위치</button>
            <button class="btn btn--outline" data-act="pickLoc">역 고르기</button>
          </div>`
    }
    ${wt ? `<div class="weather-note">${wt}</div>` : ""}
    <p class="block__hint">${loc ? "위치는 저장하지 않고 이번 추천에만 써요." : "안 골라도 메뉴 월드컵은 할 수 있어요. 고르면 근처 실제 가게와 날씨를 반영해요."}</p>
  </div>`;
}

function blockNames() {
  const names = S.namesBy[S.mode];
  const team = store.get("team");
  return `<div class="card card--flat block">
    <div class="block__title"><h3>누구랑 골라요?</h3><span class="badge">${names.length}명</span></div>
    <div class="chips">
      ${names
        .map((n, i) => `<span class="chip chip--name">${esc(n)}<button class="chip__x" data-act="delName" data-i="${i}" aria-label="${esc(n)} 빼기">✕</button></span>`)
        .join("")}
    </div>
    <div class="add-row">
      <input class="input" id="nameInput" maxlength="8" placeholder="이름 추가 (예: 김대리)" enterkeyhint="done" />
      <button class="btn btn--secondary" data-act="addName">추가</button>
    </div>
    ${
      S.mode === "lunch"
        ? `<div class="btn-row" style="margin-top: var(--sp-8)">
            ${team ? `<button class="btn btn--outline btn--sm" data-act="loadTeam">저장된 팀 불러오기</button>` : "<span></span>"}
            <button class="btn btn--outline btn--sm" data-act="saveTeam">${team ? "이 구성으로 팀 갱신" : "이 구성으로 팀 저장"}</button>
          </div>`
        : ""
    }
    <p class="block__hint">거부권 카드와 다같이 투표에 이 이름들이 쓰여요.</p>
  </div>`;
}

function blockPeople() {
  const mid = computeMidpoint(S.people);
  const located = S.people.filter((p) => p.loc).length;
  const wt = weatherText(S.weather);
  return `<div class="card card--flat block">
    <div class="block__title"><h3>다들 어디서 와요?</h3><span class="badge">${S.people.length}명</span></div>
    <div class="people">
      ${S.people
        .map(
          (p, i) => `<div class="person" style="--c: var(--pc-${i % 6})">
            <span class="person__dot" aria-hidden="true">${esc(p.name.slice(0, 1))}</span>
            <button class="person__main" data-act="personLoc" data-i="${i}">
              <span class="person__name">${esc(p.name)}</span>
              <span class="person__loc ${p.loc ? "" : "person__loc--empty"}">${p.loc ? `${esc(locLabel(p.loc))}에서 출발` : "출발 위치 고르기 ›"}</span>
            </button>
            <button class="btn btn--ghost btn--icon" data-act="delPerson" data-i="${i}" aria-label="${esc(p.name)} 빼기">✕</button>
          </div>`
        )
        .join("")}
    </div>
    <div class="add-row">
      <input class="input" id="personInput" maxlength="8" placeholder="이름 (예: 민지)" enterkeyhint="done" />
      <button class="btn btn--secondary" data-act="addPerson">+ 추가</button>
    </div>
    ${
      mid
        ? `<div class="minimap-wrap">${miniMapSVG(mid)}</div>
          <div class="mid-card">
            <div class="grow"><div class="mid-card__k">중간역 · 무게중심에서 가장 가까운 역</div><div class="mid-card__n">${esc(mid.station.name)}</div></div>
            <a class="btn btn--outline btn--sm" href="${mapLinks({ n: mid.station.name, q: mid.station.name, kind: "place" }).kakao}" target="_blank" rel="noopener">지도</a>
          </div>
          <ul class="legs">
            ${mid.legs
              .map((l) => `<li style="--c: var(--pc-${l.idx % 6})"><i></i>${esc(l.person.name)} → ${esc(mid.station.name)}<b>${fmtDist(l.km)}</b></li>`)
              .join("")}
          </ul>
          ${wt ? `<div class="weather-note">${wt}</div>` : ""}
          <p class="block__hint">거리는 모두 <b>직선거리</b>예요. 노선·환승에 따라 실제 이동 시간은 달라요. 점선 원은 모두의 무게중심, 굵은 원은 거기서 가장 가까운 역이에요.</p>`
        : `<div class="notice" style="margin-top: var(--sp-12)">${located ? "한 명 더" : "2명 이상"} 출발 위치를 넣으면 중간역을 찾아줘요.</div>`
    }
  </div>`;
}

function blockSource() {
  const loc = searchLoc();
  const placeOn = S.source === "place" && loc;
  let hint;
  if (!loc) hint = S.mode === "group" ? "중간지점이 정해지면 근처 실제 가게로도 할 수 있어요." : "위치를 고르면 근처 실제 가게로도 할 수 있어요.";
  else if (placeOn)
    hint = `${S.kakao ? "카카오 장소 검색" : "OpenStreetMap"}에서 ${esc(locLabel(loc))} 반경 안의 실제 ${S.mode === "date" ? "식당·카페" : "가게"}를 불러와요. 못 불러오면 메뉴 종류로 바뀌어요.${S.mode === "date" ? " 놀거리는 내장 목록에서 뽑아요." : ""}`;
  else hint = "김치찌개, 라멘처럼 메뉴 종류로 겨뤄요. 우승하면 지도에서 근처 가게를 찾아줘요.";
  return `<div class="card card--flat block">
    <div class="block__title"><h3>후보는 어디서 뽑아요?</h3></div>
    <div class="seg">
      <button data-act="source" data-v="menu" aria-pressed="${!placeOn}">메뉴 종류로</button>
      <button data-act="source" data-v="place" aria-pressed="${!!placeOn}" ${loc ? "" : "disabled"}>근처 실제 가게</button>
    </div>
    ${
      placeOn
        ? `<div class="block__sub">반경 <small class="t-tertiary">(직선거리 기준 도보 대략치)</small></div>
          <div class="seg">${RADII.map((r) => `<button data-act="radius" data-v="${r.v}" aria-pressed="${S.radius === r.v}">${r.n} · ${fmtDist(r.v / 1000)}</button>`).join("")}</div>`
        : ""
    }
    <p class="block__hint">${hint}</p>
  </div>`;
}

function blockFilters() {
  const m = S.mode;
  const tagList = m === "date" ? DATE_TAGS : MENU_TAGS;
  const rn = recentNames();
  const recent = [...new Set([...rn.yesterday, ...rn.today])];
  const warn = m === "lunch" ? streakWarning() : null;
  const placeOn = S.source === "place" && searchLoc();
  return `<div class="card card--flat block">
    <div class="block__title"><h3>조건</h3>${S.prices.size || S.tags.size ? `<button class="btn btn--ghost btn--sm" data-act="clearFilters">초기화</button>` : ""}</div>
    ${warn ? `<div class="notice notice--warn" style="margin-bottom: var(--sp-12)">${esc(warn)}</div>` : ""}
    <div class="block__sub" style="margin-top: 0">${m === "date" ? "밥 가격대" : "가격대"}</div>
    <div class="chips">
      ${[1, 2, 3].map((p) => `<button class="chip" data-act="price" data-v="${p}" aria-pressed="${S.prices.has(p)}">${PRICE_LABEL[p]} ${["만 원 안팎", "1~2만 원", "2만 원 이상"][p - 1]}</button>`).join("")}
    </div>
    <div class="block__sub">${m === "date" ? "카페·놀거리 분위기" : "이런 게 당겨요"}</div>
    <div class="chips">
      ${tagList.map((t) => `<button class="chip" data-act="tag" data-v="${t}" aria-pressed="${S.tags.has(t)}">${t}</button>`).join("")}
    </div>
    ${
      m === "lunch"
        ? `<div class="block__sub">최근 메뉴</div>
          <button class="chip" data-act="recent" aria-pressed="${S.excludeRecent}">${S.excludeRecent ? "✓ " : ""}최근 2일 먹은 메뉴 빼기</button>
          <p class="block__hint">${recent.length ? `빠지는 메뉴: ${esc(recent.join(", "))}` : "점심을 기록하면 어제 먹은 메뉴를 자동으로 빼줘요."}</p>`
        : ""
    }
    ${
      m !== "date"
        ? `<div class="block__sub">대진 크기</div>
          <div class="seg">${[8, 16].map((n) => `<button data-act="size" data-v="${n}" aria-pressed="${S.size === n}">${n}강 · ${n - 1}판</button>`).join("")}</div>`
        : `<p class="block__hint">데이트 코스는 밥·카페·놀거리 각각 8강으로 겨뤄요.</p>`
    }
    ${placeOn ? `<p class="block__hint">실제 가게는 가격 정보가 없어서 가격대는 메뉴 종류에만 적용돼요. 태그는 비슷한 분류에 가중치로 들어가요.</p>` : ""}
  </div>`;
}

function blockVote() {
  const opts = [
    { v: "solo", e: "1", t: "혼자 빠르게", d: "내가 탭해서 바로 정해요" },
    { v: "phone", e: "2", t: "다같이 한 폰", d: "대결마다 각자 +1, 과반이 올라가요. 동점이면 동전 던지기" },
    { v: "link", e: "3", t: "링크로 각자", d: S.mode === "date" ? "데이트 코스는 한 폰으로 같이 골라요" : "후보 링크를 보내면 각자 폰에서 하고, 답장 링크로 점수를 합쳐요" },
  ];
  return `<div class="card card--flat block">
    <div class="block__title"><h3>어떻게 골라요?</h3></div>
    <div class="opts">
      ${opts
        .map(
          (o) => `<button class="opt" data-act="vote" data-v="${o.v}" aria-pressed="${S.vote === o.v}" ${o.v === "link" && S.mode === "date" ? "disabled" : ""}>
            <span class="lb lb--lg" aria-hidden="true">${o.e}</span><span><span class="opt__t">${o.t}</span><span class="opt__d">${o.d}</span></span>
          </button>`
        )
        .join("")}
    </div>
  </div>`;
}

/* ---------- 게임 준비 ---------- */
const cur = () => G.stages[G.si];

async function startGame() {
  const vs = voters();
  if (S.mode === "date" && S.vote === "link") S.vote = "solo";
  if (S.vote === "phone" && vs.length < 2) {
    toast("다같이 투표하려면 이름을 2명 이상 넣어 주세요");
    return;
  }
  const loc = searchLoc();
  G = {
    mode: S.mode,
    vote: S.vote,
    voters: vs,
    loc,
    mid: S.mode === "group" ? computeMidpoint(S.people) : null,
    weather: S.weather,
    seed: `${todayKey()}|${S.mode}|${loc?.name || ""}|${S.salt++}`,
    stages: (S.mode === "date" ? ["meal", "cafe", "play"] : ["main"]).map((k) => ({ k, shuffles: 0, banned: new Set() })),
    si: 0,
  };
  const btn = $("#go");
  btn?.classList.add("is-loading");
  await prepareStage();
  btn?.classList.remove("is-loading");
  go("veto");
  renderVeto();
}

async function prepareStage() {
  const st = cur();
  const notes = [];
  let base = null;
  const loc = G.loc;
  if (S.source === "place" && loc && st.k !== "play") {
    const kind = st.k === "cafe" ? "cafe" : G.mode === "group" ? "group" : "food";
    const r = await getNearbyPlaces({ lat: loc.lat, lon: loc.lon, radius: S.radius, kind });
    if (r.items.length >= 8) {
      base = r.items;
      st.source = r.source;
      notes.push(`${r.source === "kakao" ? "카카오 장소 검색" : "OpenStreetMap"}에서 ${locLabel(loc)} 반경 ${fmtDist(S.radius / 1000)} 안의 가게 ${r.items.length}곳 중에서 뽑았어요`);
    } else if (r.source === "failed") {
      notes.push("근처 가게 정보를 불러오지 못해서 메뉴 종류로 골라요");
    } else {
      notes.push(`반경 안에서 찾은 가게가 ${r.items.length}곳뿐이라 메뉴 종류로 골라요`);
    }
  }
  if (!base) {
    base = catalogAdapter.list(st.k);
    st.source = "catalog";
  }
  const isPlace = st.source !== "catalog";
  const food = st.k === "main" || st.k === "meal";
  const tags = new Set([...S.tags].filter((t) => (food ? MENU_TAGS : DATE_TAGS).includes(t)));
  const exclude = new Set(st.banned);
  if (G.mode === "lunch" && S.excludeRecent) recentKeys().forEach((k) => exclude.add(k));
  const boosts = [];
  const w = G.weather;
  if (w && (w.rainy || w.cold)) {
    if (food) boosts.push({ tag: "국물", x: 3 }, { tag: "비오는날", x: 2 });
    else boosts.push({ tag: "실내", x: 2.5 });
  } else if (w?.hot && food) boosts.push({ tag: "가벼운", x: 2 });
  const wt = weatherText(w, st.k);
  if (wt) notes.push(wt);
  if (G.mode === "group" && food) boosts.push({ tag: "단체", x: 2 });
  const size = G.mode === "date" ? 8 : S.size;
  const pool = buildPool({
    base,
    size,
    filters: { prices: food && !isPlace ? S.prices : new Set(), tags, excludeKeys: exclude },
    boosts,
    seed: `${G.seed}|${st.k}|${st.shuffles}`,
    reserve: G.voters.length + 6,
    softTags: isPlace,
  });
  if (pool.excludedCount && G.mode === "lunch" && S.excludeRecent) {
    const recentEx = pool.excludedCount - [...st.banned].length;
    if (recentEx > 0) notes.push(`최근에 먹은 메뉴 ${recentEx}개는 뺐어요`);
  }
  st.items = pool.items;
  st.reserves = pool.reserves;
  st.notes = [...notes, ...pool.notes];
  st.vetoes = [];
  st.firstShow = true;
  st.vi = 0;
}

/* ---------- 공통 조각 ---------- */
function subLine(it) {
  if (it.kind === "place") return `${it.c}${it.dist != null ? ` · ${fmtDist(it.dist)}` : ""}`;
  if (it.kind === "menu") return `${PRICE_LABEL[it.p] || ""} · ${(it.t || []).slice(0, 2).join("·")}`;
  return (it.t || []).slice(0, 2).join(" · ");
}

function stageSteps() {
  if (G.mode !== "date") return "";
  return `<div class="stage-steps">${G.stages
    .map((s, i) => `<span class="${i < G.si ? "is-done" : i === G.si ? "is-on" : ""}">${i + 1}코스 ${STAGE[s.k].n}${i < G.si && s.winner ? ` · ${esc(s.winner.n)}` : ""}</span>`)
    .join("")}</div>`;
}

const notesHTML = (notes) => (notes?.length ? `<div class="notices">${notes.map((n) => `<div class="notice">${esc(n)}</div>`).join("")}</div>` : "");

/* ---------- 거부권 (발차 안내판) ---------- */
function renderVeto(flipTurn = false) {
  const st = cur();
  const vs = G.voters;
  const done = st.vi >= vs.length;
  const multi = vs.length > 1;
  const linkHost = G.vote === "link" && !G.guest;
  const n = st.items.length;
  const where = G.loc ? `${locLabel(G.loc)} 근처` : "메뉴 종류";
  $("#veto").innerHTML = `
    ${stageSteps()}
    <div class="view-head">
      <span class="eyebrow">거부권${G.mode === "date" ? ` · ${G.si + 1}코스 ${STAGE[st.k].n}` : ""}</span>
      <h2 class="t-title-02">${done ? `${roundLabel(n)} 대진 완성` : "절대 싫은 거, 하나씩 빼요"}</h2>
      <p class="t-body-03 t-secondary">한 사람당 한 번. 빠진 자리는 다른 후보가 채워요.</p>
    </div>
    ${notesHTML(st.notes)}
    ${
      done
        ? `<div class="veto-turn veto-turn--done"><span class="veto-turn__x" aria-hidden="true">✓</span><div class="veto-turn__t"><b>거부권을 다 썼어요</b><span>${linkHost ? "이 후보로 링크를 만들어요" : "이제 월드컵을 시작해요"}</span></div></div>`
        : `<div class="veto-turn"><span class="veto-turn__x" aria-hidden="true">✕</span>
            <div class="veto-turn__t"><b class="${flipTurn ? "is-swap" : ""}">${multi ? `${esc(vs[st.vi])} 차례예요` : "빼고 싶은 게 있나요?"}</b>
            <span>${multi ? "폰을 넘겨서 싫은 후보 하나만 탭해요" : "하나 탭하면 다른 후보로 바뀌어요"}</span></div>
            <button class="btn btn--outline btn--sm" data-act="vetoPass">${multi ? "패스" : "괜찮아요"}</button></div>`
    }
    ${
      multi
        ? `<div class="veto-people">${vs
            .map((v, i) => `<span class="veto-person ${i < st.vi ? "is-done" : i === st.vi ? "is-now" : ""}">${esc(v)}</span>`)
            .join("")}</div>`
        : ""
    }
    <div class="board">
      <div class="board__head"><span>${esc(where)} · 후보 ${n}</span><span>${done ? "출발 대기" : "거부권 사용 중"}</span></div>
      <div class="cand-list">
      ${st.items
        .map(
          (it, i) => `<button class="cand ${it._new ? "is-new" : ""}" data-act="veto" data-i="${i}" ${done ? "disabled" : ""} aria-label="${esc(it.n)} 빼기" style="animation-delay: ${it._new ? 0 : i * 35}ms">
            <span class="cand__no">${String(i + 1).padStart(2, "0")}</span>
            ${lb(it)}
            <span class="cand__txt"><span class="cand__n">${esc(it.n)}</span></span>
            <span class="cand__s">${esc(subLine(it))}</span>
          </button>`
        )
        .join("")}
      </div>
    </div>
    ${st.vetoes.length ? `<div class="veto-log">${st.vetoes.map((v) => `<span>${esc(v.by)} 거부 · ${esc(v.item.n)}</span>`).join("")}</div>` : ""}
    <div class="sticky-cta">
      <div class="sticky-cta__row">
        <button class="btn btn--outline btn--lg btn--icon" data-act="reshuffle" aria-label="후보 다시 섞기">⟳</button>
        <button class="btn btn--primary btn--lg grow" data-act="startBracket">${linkHost ? "이 후보로 링크 만들기 →" : `${roundLabel(n)} 출발 →`}</button>
      </div>
      <button class="btn btn--ghost btn--block btn--sm" data-act="toSetup">← 조건 바꾸기</button>
    </div>`;
  if (st.firstShow !== false && !reduce) {
    $$("#veto .cand").forEach((c, i) => c.animate(
      [{ transform: "perspective(400px) rotateX(-90deg)", opacity: 0 }, { transform: "perspective(400px) rotateX(12deg)", opacity: 1, offset: 0.6 }, { transform: "none", opacity: 1 }],
      { duration: 480, delay: i * 40, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)", fill: "backwards" }
    ));
    st.firstShow = false;
  }
  st.items.forEach((it) => delete it._new);
}

async function doVeto(i) {
  const st = cur();
  if (st.vi >= G.voters.length || G.busy) return;
  if (!st.reserves.length) {
    toast("더 채울 후보가 없어서 뺄 수 없어요");
    return;
  }
  G.busy = true;
  const btn = $$("#veto .cand")[i];
  btn?.classList.add("is-out");
  haptic([10, 40, 20]);
  await sleep(reduce ? 0 : 560);
  const removed = st.items[i];
  st.banned.add(removed.key);
  st.items[i] = { ...st.reserves.shift(), _new: true };
  st.vetoes.push({ by: G.voters[st.vi], item: removed });
  st.vi++;
  G.busy = false;
  renderVeto(true);
}

/* ---------- 대결 ---------- */
function startBracket() {
  const st = cur();
  if (G.vote === "link" && !G.guest) {
    createRoom();
    return;
  }
  st.bracket = new Bracket(st.items.map(({ _new, ...x }) => x));
  go("match");
  renderMatch(true);
}

const SPRING = "linear(0, 0.161, 0.362, 0.577, 0.781, 0.959, 1.1, 1.199, 1.258, 1.279, 1.269, 1.237, 1.19, 1.136, 1.082, 1.033, 0.992, 0.961, 0.941, 0.931, 0.929, 0.935, 0.945, 0.958, 0.972, 0.985, 0.997, 1.006, 1.013, 1.017, 1.018, 1.018, 1.015, 1.012, 1.009, 1.006, 1.002, 1, 0.998, 0.996, 1)";
const FALL = "cubic-bezier(0.55, 0, 1, 0.45)";

function mcardHTML(it, side) {
  const phone = G.vote === "phone";
  let cat;
  if (it.kind === "place") cat = `${it.c}${it.dist != null ? ` · ${fmtDist(it.dist)}` : ""}`;
  else if (it.kind === "menu") cat = `${it.g} · ${PRICE_LABEL[it.p] || ""}`;
  else cat = it.kind === "cafe" ? "카페" : "놀거리";
  const bar = it.kind === "place" && it.dist != null ? `도보 약 ${walkMin(it.dist)}분 (직선)` : (it.t || []).slice(0, 3).join(" · ") || cat;
  return `<button class="mcard" data-act="pick" data-side="${side}" style="--l: ${lineOf(it)}">
    <span class="mcard__top">${lb(it)}<span class="mcard__cat">${esc(cat)}</span><span class="mcard__e" aria-hidden="true">${it.e}</span></span>
    <span class="mcard__n ${it.n.length > 7 ? "is-long" : ""}">${esc(it.n)}</span>
    <span class="mcard__bar"><span>${esc(bar)}</span>${
      phone
        ? `<span class="tally"><span class="tally__dots">${G.voters.map(() => "<i></i>").join("")}</span><span class="tally__n" data-tally="${side}">0표</span></span>`
        : `<span aria-hidden="true">${side ? "▼" : "▲"}</span>`
    }</span>
  </button>`;
}

function renderMatch(enter) {
  const st = cur();
  const b = st.bracket;
  const [A, B] = b.pair;
  const phone = G.vote === "phone";
  G.tally = [0, 0];
  const slots = Array.from({ length: b.matches }, (_, k) =>
    k < b.next.length
      ? `<span class="strip__slot is-filled" style="--l: ${lineOf(b.next[k])}">${esc(glyphOf(b.next[k]))}</span>`
      : `<span class="strip__slot ${b.matches === 1 ? "is-final" : k === b.i ? "is-now" : ""}">${b.matches === 1 ? "1" : ""}</span>`
  ).join("");
  $("#match").innerHTML = `
    ${stageSteps()}
    <div class="match-head">
      <span class="match-head__t">${G.mode === "date" ? `${STAGE[st.k].n} ` : ""}${b.label}</span>
      <span class="match-head__s">${b.size === 2 ? "마지막 대결" : `${b.i + 1} / ${b.matches}`}</span>
    </div>
    <div class="strip" aria-label="다음 라운드 진출 ${b.next.length}/${b.matches}">${slots}</div>
    <div class="arena">
      ${mcardHTML(A, 0)}
      <div class="vs" aria-hidden="true">VS</div>
      ${mcardHTML(B, 1)}
    </div>
    ${
      phone
        ? `<div class="vote-bar"><span id="voteCount">${G.voters.length}명 중 0명 투표했어요</span>
          <span class="row gap-8"><button class="btn btn--ghost btn--sm" data-act="resetTally">다시 세기</button><button class="btn btn--outline btn--sm" data-act="decide">지금 결정</button></span></div>`
        : ""
    }
    <p class="match-hint">${phone ? "각자 고른 쪽을 한 번씩 눌러요. 다 누르면 과반이 올라가요" : "더 끌리는 쪽을 탭해요"}</p>
    <button class="btn btn--ghost btn--block btn--sm" data-act="quit">그만두기</button>`;
  if (enter && !reduce) {
    const cards = $$("#match .mcard");
    // 위아래에서 밀려 들어와 가운데서 부딪히고(스쿼시) 제자리로 튐
    cards[0].animate(
      [
        { transform: "translate(-110%, 0) rotate(-6deg)", opacity: 0 },
        { transform: "translate(0, 0) rotate(0) scale(1, 1)", opacity: 1, offset: 0.55, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
        { transform: "translate(0, 8px) scale(1.03, 0.94)", offset: 0.7 },
        { transform: "translate(0, -3px) scale(0.99, 1.02)", offset: 0.85 },
        { transform: "none", opacity: 1 },
      ],
      { duration: 620, easing: FALL }
    );
    cards[1].animate(
      [
        { transform: "translate(110%, 0) rotate(6deg)", opacity: 0 },
        { transform: "translate(0, 0) rotate(0) scale(1, 1)", opacity: 1, offset: 0.55, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
        { transform: "translate(0, -8px) scale(1.03, 0.94)", offset: 0.7 },
        { transform: "translate(0, 3px) scale(0.99, 1.02)", offset: 0.85 },
        { transform: "none", opacity: 1 },
      ],
      { duration: 620, easing: FALL, delay: 40 }
    );
    $$("#match .mcard__n").forEach((n, i) =>
      n.animate([{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], { duration: 420, delay: 260 + i * 60, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "backwards" })
    );
    $("#match .vs").animate(
      [{ transform: "translate(0, -50%) scale(0) rotate(-90deg)" }, { transform: "translate(0, -50%) scale(1) rotate(0)" }],
      { duration: 640, delay: 320, easing: SPRING, fill: "backwards" }
    );
  }
}

function flyTo(fromEl, toEl, item) {
  if (!fromEl || !toEl || reduce) return sleep(0);
  const a = fromEl.getBoundingClientRect();
  const b = toEl.getBoundingClientRect();
  const fly = document.createElement("div");
  fly.className = "fly";
  fly.style.setProperty("--l", lineOf(item));
  fly.textContent = glyphOf(item);
  fly.style.left = `${a.left + a.width / 2 - 14}px`;
  fly.style.top = `${a.top + a.height / 2 - 14}px`;
  document.body.appendChild(fly);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const anim = fly.animate(
    [
      { transform: "translate(0, 0) scale(1.6)" },
      { transform: `translate(${dx * 0.3}px, ${dy * 0.3 - 30}px) scale(1.3, 1.9)`, offset: 0.3 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.8, 1.2)`, offset: 0.8 },
      { transform: `translate(${dx}px, ${dy}px) scale(1.3, 0.7)`, offset: 0.9 },
      { transform: `translate(${dx}px, ${dy}px) scale(1)` },
    ],
    { duration: 560, easing: "cubic-bezier(0.65, 0, 0.35, 1)", fill: "forwards" }
  );
  return anim.finished.then(() => fly.remove(), () => fly.remove());
}

async function pick(side) {
  if (G.busy) return;
  G.busy = true;
  const st = cur();
  const b = st.bracket;
  const cards = $$("#match .mcard");
  const win = cards[side];
  const lose = cards[1 - side];
  haptic(15);
  if (!reduce) {
    win.animate(
      [{ transform: "scale(1)" }, { transform: "scale(0.95, 1.05)", offset: 0.3 }, { transform: "scale(1.04, 0.97)", offset: 0.6 }, { transform: "scale(1)" }],
      { duration: 420, easing: "ease" }
    );
    lose.animate(
      [
        { transform: "translate(0, 0) rotate(0)", opacity: 1 },
        { transform: `translate(${side ? -10 : 10}px, ${side ? -14 : 14}px) rotate(${side ? -3 : 3}deg)`, opacity: 1, offset: 0.25 },
        { transform: `translate(${side ? -40 : 40}px, ${side ? -160 : 160}px) rotate(${side ? -16 : 16}deg)`, opacity: 0 },
      ],
      { duration: 460, easing: FALL, fill: "forwards" }
    );
  }
  const slot = $$("#match .strip__slot")[b.i];
  await flyTo(win.querySelector(".lb"), slot, b.pair[side]);
  const res = b.pick(side);
  G.busy = false;
  if (b.done) {
    finishStage();
    return;
  }
  if (res.roundDone) toast(`${b.label} 진출: ${b.round.map((x) => x.n).join(", ")}`, 2000);
  renderMatch(true);
}

function tallyTap(side, cardEl, ev) {
  const N = G.voters.length;
  const total = G.tally[0] + G.tally[1];
  if (total >= N) return;
  G.tally[side]++;
  haptic(8);
  const plus = document.createElement("span");
  plus.className = "plus1";
  plus.textContent = "+1";
  const r = cardEl.getBoundingClientRect();
  plus.style.left = `${(ev?.clientX ?? r.left + r.width / 2) - r.left - 12}px`;
  plus.style.top = `${(ev?.clientY ?? r.top + r.height / 2) - r.top - 24}px`;
  cardEl.appendChild(plus);
  setTimeout(() => plus.remove(), 720);
  updateTally();
  if (G.tally[0] + G.tally[1] >= N) setTimeout(decide, 450);
}

function updateTally() {
  const N = G.voters.length;
  [0, 1].forEach((s) => {
    const n = G.tally[s];
    const tag = $(`#match [data-tally="${s}"]`);
    if (tag) tag.textContent = `${n}표`;
    $$("#match .mcard")[s]?.querySelectorAll(".tally__dots i").forEach((d, i) => d.classList.toggle("is-on", i < n));
    $$("#match .mcard")[s]?.classList.toggle("is-lead", n > G.tally[1 - s]);
  });
  const c = $("#voteCount");
  if (c) c.textContent = `${N}명 중 ${G.tally[0] + G.tally[1]}명 투표했어요`;
}

async function decide() {
  if (G.busy) return;
  const [a, b] = G.tally;
  if (a + b === 0) {
    toast("먼저 투표해 주세요");
    return;
  }
  let side = a > b ? 0 : 1;
  if (a === b) {
    G.busy = true;
    side = await coinFlip(cur().bracket.pair);
    G.busy = false;
  }
  pick(side);
}

async function coinFlip([A, B]) {
  const side = Math.random() < 0.5 ? 0 : 1;
  const layer = document.createElement("div");
  layer.className = "coin-layer";
  layer.innerHTML = `<p>동점이에요! 동전으로 정해요</p><div class="coin"><div class="coin__f">${A.e}</div><div class="coin__f coin__f--b">${B.e}</div></div><p id="coinMsg">&nbsp;</p>`;
  document.body.appendChild(layer);
  const coin = $(".coin", layer);
  const end = 1800 + side * 180;
  coin.animate(
    [
      { transform: "translateY(0) rotateY(0deg)" },
      { transform: `translateY(-80px) rotateY(${end / 2}deg) scale(1.15)`, offset: 0.45 },
      { transform: `translateY(0) rotateY(${end}deg)` },
    ],
    { duration: reduce ? 1 : 1500, easing: "cubic-bezier(0.25, 0.6, 0.3, 1)", fill: "forwards" }
  );
  await sleep(reduce ? 50 : 1550);
  haptic([20, 30, 20]);
  $("#coinMsg", layer).textContent = `${(side ? B : A).n} 당첨!`;
  await sleep(900);
  layer.remove();
  return side;
}

/* ---------- 스테이지 종료 ---------- */
async function finishStage() {
  const st = cur();
  const b = st.bracket;
  st.winner = b.champion;
  st.ranking = b.ranking().map((r) => ({ item: r.item, label: tierLabel(r.tier) }));
  st.tiers = b.ranking();
  if (G.guest) {
    renderResult();
    return;
  }
  if (G.roomPlay) {
    addReplyToRoom(G.room, { name: G.room.host, k: st.tiers.map((r) => [r.item.n, r.item.e, r.tier]) });
    toast("내 결과를 방에 넣었어요");
    openRoom(G.room.id);
    return;
  }
  if (G.si < G.stages.length - 1) {
    G.si++;
    toast(`${st.winner.e} ${st.winner.n} 확정! 다음은 ${STAGE[cur().k].n}`, 2000);
    $("#veto").innerHTML = `${stageSteps()}<div class="empty"><div class="empty__e">${STAGE[cur().k].e}</div><p>${G.si + 1}코스 ${STAGE[cur().k].n} 후보를 고르는 중…</p></div>`;
    go("veto");
    await prepareStage();
    renderVeto();
    return;
  }
  renderResult();
}

const tierLabel = (t) => (t === 1 ? "우승" : t === 2 ? "준우승" : roundLabel(t));

/* ---------- 결과 ---------- */
function resultPayload() {
  const pack = (it) => ({ n: it.n, e: it.e, c: it.c, ...(it.kind === "place" ? { la: +it.lat.toFixed(5), lo: +it.lon.toFixed(5) } : { q: it.q }) });
  return {
    m: G.mode,
    a: G.loc ? locLabel(G.loc) : null,
    w: G.stages.map((s) => pack(s.winner)),
    r: G.mode === "date" ? [] : (G.stages[0].ranking || []).slice(1, 4).map((r) => [r.item.e, r.item.n]),
  };
}

function unpackWinner(x) {
  return { ...x, kind: x.la != null ? "place" : "menu", lat: x.la, lon: x.lo, key: x.n };
}

function actionsHTML(w, near) {
  const L = mapLinks(w, near);
  return `<div class="actions">
    <a class="btn btn--primary btn--lg btn--wide" href="${L.kakao}" target="_blank" rel="noopener">카카오맵에서 찾기 →</a>
    <a class="btn btn--outline ${L.route ? "" : "btn--wide"}" href="${L.naver}" target="_blank" rel="noopener">네이버지도</a>
    ${L.route ? `<a class="btn btn--secondary" href="${L.route}" target="_blank" rel="noopener">길찾기</a>` : ""}
  </div>`;
}

// 역명판 모양 결과 카드: 가운데 큰 이름, 아래 노선색 띠에 이전·다음 순위
function signHTML(w, { kicker, prev, next }) {
  const long = w.n.length > 6;
  return `<div class="sign" style="--l: ${lineOf(w)}">
    <div class="sign__crown" aria-hidden="true">👑</div>
    <div class="sign__top">${lb(w, "lb--lg")}<span class="sign__k">${esc(kicker)}</span></div>
    <div class="sign__body"><span class="sign__e" aria-hidden="true">${w.e || ""}</span><h2 class="sign__n ${long ? "is-long" : ""}">${esc(w.n)}</h2></div>
    <div class="sign__bar"><span>${prev ? `← ${esc(prev)}` : ""}</span><span>${next ? `${esc(next)} →` : ""}</span></div>
  </div>`;
}

function courseHTML(wins, near, kinds) {
  return `<ol class="course card card--flat">
    ${wins
      .map((w, i) => {
        const L = mapLinks(w, near);
        return `<li style="--l: var(--art-${STAGE[kinds[i]].l})"><span class="course__dot" aria-hidden="true"></span><div class="course__body">
          <div class="course__k">${i + 1}코스 · ${STAGE[kinds[i]].n}${w.kind === "place" ? ` · ${esc(w.c)}` : ""}</div>
          <div class="course__n">${esc(w.n)}</div>
          <div class="course__links">
            <a class="btn btn--outline btn--sm" href="${L.kakao}" target="_blank" rel="noopener">카카오맵</a>
            <a class="btn btn--outline btn--sm" href="${L.naver}" target="_blank" rel="noopener">네이버</a>
            ${L.route ? `<a class="btn btn--secondary btn--sm" href="${L.route}" target="_blank" rel="noopener">길찾기</a>` : ""}
          </div></div></li>`;
      })
      .join("")}
  </ol>`;
}

function renderResult() {
  const el = $("#result");
  const near = G.loc ? locLabel(G.loc) : "";
  const guest = G.guest;
  if (G.mode === "date") {
    el.innerHTML = `
      <div class="view-head">
        <span class="eyebrow">오늘의 데이트 코스${near ? ` · ${esc(near)} 근처` : ""}</span>
        <h2 class="t-title-02">${G.stages.map((s) => esc(s.winner.n)).join(" → ")}</h2>
        <p class="t-body-03 t-secondary">세 번의 월드컵으로 완성한 코스예요.</p>
      </div>
      ${courseHTML(G.stages.map((s) => s.winner), near, G.stages.map((s) => s.k))}
      <p class="block__hint">순서는 자유롭게 바꿔도 돼요. 영업시간은 지도 앱에서 꼭 확인해 주세요.</p>
      ${shareActions()}`;
    go("result");
    return;
  }
  const st = G.stages[0];
  const w = st.winner;
  const rk = st.ranking || [];
  const kicker = guest ? `${guest.name}의 1위` : G.mode === "group" ? "오늘 모임 1위" : "오늘 점심 1위";
  const sub = guest
    ? `${esc(iga(guest.host))} 보낸 월드컵 결과예요`
    : G.mode === "group"
      ? `${near ? `${esc(near)} 근처에서 만나요` : "오늘 모임은 여기로!"}`
      : `${near ? `${esc(near)} 근처 · ` : ""}오늘 점심은 이걸로!`;
  const badges = [
    w.kind === "place" ? w.c : w.g,
    w.kind === "place" && w.dist != null ? `${fmtDist(w.dist)} (직선)` : null,
    w.kind === "menu" ? PRICE_LABEL[w.p] : null,
    G.vote === "phone" ? "다같이 투표" : G.vote === "link" && !guest ? "링크 투표 합산" : null,
  ].filter(Boolean);
  el.innerHTML = `
    ${signHTML(w, { kicker, prev: rk[1] ? `${rk[1].label} ${rk[1].item.n}` : "", next: rk[2] ? `${rk[2].label} ${rk[2].item.n}` : "" })}
    <p class="sign-sub">${badges.map((b) => `<span class="badge">${esc(b)}</span>`).join("")} ${sub}</p>
    ${
      guest
        ? `<div class="actions"><button class="btn btn--primary btn--lg btn--wide" data-act="sendReply">${esc(guest.host)}에게 결과 보내기 →</button></div>
          <p class="block__hint">버튼을 누르면 답장 링크가 만들어져요. 단톡방에 붙여넣으면 ${esc(iga(guest.host))} 열어서 다같이 점수를 합쳐요.</p>`
        : ""
    }
    ${actionsHTML(w, near)}
    <div id="nearby"></div>
    ${G.mode === "lunch" && !guest ? logBoxHTML(w) : ""}
    <h3 class="section-t">순위 <small>${G.vote === "link" && !guest ? "보르다 점수 합산" : "대진 결과"}</small></h3>
    <ol class="rank-list">
      ${rk
        .slice(0, 8)
        .map((r, i) => `<li><span class="r">${i === 0 ? "1위" : esc(r.label)}</span>${lb(r.item)}<span class="n">${esc(r.item.n)}</span><span class="x">${i === 0 ? esc(r.label) : ""}</span></li>`)
        .join("")}
    </ol>
    ${guest ? `<div class="actions"><button class="btn btn--ghost btn--wide" data-act="toIntroFresh">우리도 따로 정해보기</button></div>` : shareActions()}`;
  go("result");
  if (w.kind === "menu" && G.loc?.lat != null && !guest) loadNearbyFor(w);
}

function shareActions() {
  return `<h3 class="section-t">친구에게 보내기</h3>
    <div class="actions">
      <button class="btn btn--secondary" data-act="shareLink">결과 링크 보내기</button>
      <button class="btn btn--outline" data-act="shareImg">이미지로 저장</button>
      <button class="btn btn--ghost btn--wide" data-act="again">다시 고르기</button>
    </div>`;
}

async function loadNearbyFor(w) {
  const box = $("#nearby");
  box.innerHTML = `<h3 class="section-t">근처 가게 <small>찾는 중…</small></h3>`;
  let r = await findMenuNearby(w, G.loc);
  if (!r.items.length) {
    await getNearbyPlaces({ lat: G.loc.lat, lon: G.loc.lon, radius: Math.max(S.radius, 800), kind: "food" });
    r = await findMenuNearby(w, G.loc);
  }
  if (!$("#nearby")) return;
  if (!r.items.length) {
    box.innerHTML = `<div class="notice" style="margin-top: var(--sp-16)">지금은 근처 가게 정보를 불러오지 못했어요. 위 지도 버튼으로 '${esc(locLabel(G.loc))} ${esc(w.n)}'을 바로 찾아볼 수 있어요.</div>`;
    return;
  }
  const label = r.source === "kakao" ? "카카오 장소 검색" : `OpenStreetMap · 같은 분류(${w.g})`;
  box.innerHTML = `<h3 class="section-t">근처 가게 <small>${esc(label)}</small></h3>
    <div class="place-list">${r.items
      .map((p) => {
        const L = mapLinks(p);
        return `<a class="place" href="${p.url || L.route || L.kakao}" target="_blank" rel="noopener">
          <span class="place__e">${p.e}</span>
          <span class="place__t"><span class="place__n">${esc(p.n)}</span><span class="place__s">${esc(p.c)}${p.dist != null ? ` · ${fmtDist(p.dist)} (직선)` : ""}</span></span>
          <span class="place__go">${p.url ? "상세" : "길찾기"} ›</span></a>`;
      })
      .join("")}</div>`;
}

function logBoxHTML(w) {
  const already = getLogs().some((l) => l.d === todayKey() && l.id === w.key);
  if (already) return logDoneHTML(w.kind === "place" ? w.n : null);
  return `<div class="card card--flat log-box" id="logBox">
    <div class="block__title"><h3>오늘 점심으로 기록할까요?</h3></div>
    ${w.kind === "menu" ? `<input class="input" id="logPlace" maxlength="30" placeholder="간 가게 이름 (선택 · 단골 도장용)" />` : ""}
    <button class="btn btn--primary btn--block" data-act="logLunch" style="margin-top: var(--sp-8)">점심 기록하기</button>
    <p class="block__hint">기록하면 내일은 이 메뉴를 빼고 추천하고, 이번 달 리포트에 쌓여요. 이 기기에만 저장돼요.</p>
  </div>`;
}

function logDoneHTML(place) {
  const month = todayKey().slice(0, 7);
  const n = getLogs().filter((l) => l.d.startsWith(month)).length;
  const visits = place ? getLogs().filter((l) => l.place === place).length : 0;
  return `<div class="card card--flat log-box is-done" id="logBox">
    <div class="block__title"><h3>기록했어요! 이번 달 ${n}번째 점심</h3></div>
    ${place ? `<p class="t-body-03" style="margin: 0">${esc(place)} 도장 ${visits}개 ${visits >= 3 ? "· 단골 인증!" : `· 단골까지 ${3 - visits}번`}</p>` : ""}
    <button class="btn btn--secondary btn--block btn--sm" data-act="report" style="margin-top: var(--sp-12)">이번 달 점심 리포트 보기</button>
  </div>`;
}

function logLunch() {
  const w = G.stages[0].winner;
  const placeInput = $("#logPlace")?.value.trim();
  const place = w.kind === "place" ? w.n : placeInput || null;
  const logs = getLogs();
  logs.push({
    t: Date.now(),
    d: todayKey(),
    id: w.key,
    n: w.kind === "place" ? w.c : w.n,
    e: w.e,
    g: w.g || "기타",
    place,
  });
  store.set("logs", logs.slice(-400));
  haptic([10, 30, 10]);
  $("#logBox").outerHTML = logDoneHTML(place);
}

/* ---------- 공유 ---------- */
async function shareResult() {
  const p = resultPayload();
  const url = urlWith({ r: encodeState(p) });
  const text =
    G.mode === "date"
      ? `오늘 데이트 코스: ${G.stages.map((s) => `${s.winner.e} ${s.winner.n}`).join(" → ")}`
      : `${MODES[G.mode].title} 1위는 ${p.w[0].e} ${p.w[0].n}!`;
  await share({ title: "어디가? 결과", text, url });
}

function readTokens() {
  const cs = getComputedStyle(document.documentElement);
  const g = (n, fb) => cs.getPropertyValue(n).trim() || fb;
  return {
    brand: g("--brand", "#08876a"),
    soft: g("--brand-soft", "#e1f4ee"),
    text: g("--color-text", "#12151b"),
    sub: g("--color-text-secondary", "#5a6372"),
    ter: g("--color-text-tertiary", "#a3aab6"),
    surface: g("--color-surface", "#ffffff"),
    sunken: g("--color-surface-sunken", "#f0f2f5"),
    gold: g("--color-warning", "#ffb020"),
    border: g("--color-border", "#e3e6eb"),
  };
}

function drawCard() {
  const T = readTokens();
  const cs = getComputedStyle(document.documentElement);
  const colorOf = (it) => {
    const m = /var\((--[\w-]+)\)/.exec(lineOf(it));
    return (m && cs.getPropertyValue(m[1]).trim()) || T.brand;
  };
  const board = cs.getPropertyValue("--art-board").trim() || "#16191e";
  const led = cs.getPropertyValue("--art-led").trim() || "#ffc21a";
  const paper = cs.getPropertyValue("--art-paper").trim() || "#fbfaf6";
  const disp = `"Gothic A1", ${CANVAS_FONT}`;
  const W = 600, H = 760;
  const { canvas, ctx } = createCanvas(W, H, 2);
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, W, H);
  // 브랜드: 역 표시 원 + 이름
  ctx.fillStyle = T.surface; ctx.strokeStyle = T.brand; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.arc(54, 56, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = T.brand; ctx.fillRect(70, 53, 12, 6);
  ctx.fillStyle = T.text; ctx.font = `900 28px ${disp}`; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillText("어디가?", 92, 57);
  ctx.textAlign = "right"; ctx.font = `600 18px ${CANVAS_FONT}`; ctx.fillStyle = T.sub;
  ctx.fillText(MODES[G.mode].title, W - 36, 57);
  ctx.textBaseline = "alphabetic";
  const near = G.loc ? locLabel(G.loc) : "";
  const badge = (it, x, y, r) => {
    ctx.fillStyle = colorOf(it); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = T.surface; ctx.font = `800 ${Math.round(r * 1.05)}px ${disp}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(glyphOf(it), x, y + 1); ctx.textBaseline = "alphabetic";
  };
  if (G.mode === "date") {
    ctx.textAlign = "left"; ctx.fillStyle = T.sub; ctx.font = `600 20px ${CANVAS_FONT}`;
    ctx.fillText(`오늘의 데이트 코스${near ? ` · ${near} 근처` : ""}`, 40, 130);
    G.stages.forEach((s, i) => {
      const y = 210 + i * 170;
      const col = cs.getPropertyValue(`--art-${STAGE[s.k].l}`).trim() || T.brand;
      if (i < 2) { ctx.fillStyle = col; ctx.fillRect(74, y, 14, 170); }
      ctx.fillStyle = T.surface; ctx.strokeStyle = col; ctx.lineWidth = 12;
      ctx.beginPath(); ctx.arc(81, y, 26, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.textAlign = "left"; ctx.fillStyle = T.sub; ctx.font = `700 18px ${CANVAS_FONT}`;
      ctx.fillText(`${i + 1}코스 · ${STAGE[s.k].n}`, 136, y - 18);
      ctx.fillStyle = T.text; ctx.font = `900 44px ${disp}`;
      wrapText(ctx, s.winner.n, 136, y + 30, W - 176, 48);
    });
  } else {
    const st = G.stages[0];
    const w = st.winner;
    const rk = st.ranking || [];
    // 역명판
    ctx.fillStyle = T.surface; roundRect(ctx, 32, 108, W - 64, 320, 22); ctx.fill();
    ctx.save(); roundRect(ctx, 32, 108, W - 64, 320, 22); ctx.clip();
    ctx.fillStyle = colorOf(w); ctx.fillRect(32, 352, W - 64, 76);
    ctx.restore();
    ctx.strokeStyle = T.text; ctx.lineWidth = 6; roundRect(ctx, 35, 111, W - 70, 314, 20); ctx.stroke();
    badge(w, 84, 162, 24);
    ctx.textAlign = "left"; ctx.fillStyle = T.sub; ctx.font = `700 20px ${CANVAS_FONT}`;
    ctx.fillText(G.mode === "group" ? "오늘 모임 1위" : "오늘 점심 1위", 120, 169);
    ctx.font = `64px ${CANVAS_FONT}`; ctx.fillText(w.e || "", 62, 290);
    ctx.fillStyle = T.text;
    let fs = 76;
    ctx.font = `900 ${fs}px ${disp}`;
    while (ctx.measureText(w.n).width > W - 220 && fs > 34) { fs -= 4; ctx.font = `900 ${fs}px ${disp}`; }
    ctx.fillText(w.n, 152, 292);
    ctx.font = `700 22px ${CANVAS_FONT}`; ctx.fillStyle = T.surface;
    if (rk[1]) { ctx.textAlign = "left"; ctx.fillText(`← ${rk[1].label} ${rk[1].item.n}`.slice(0, 18), 60, 398); }
    if (rk[2]) { ctx.textAlign = "right"; ctx.fillText(`${rk[2].label} ${rk[2].item.n} →`.slice(-18), W - 60, 398); }
    // 안내판
    ctx.fillStyle = board; roundRect(ctx, 32, 458, W - 64, 214, 18); ctx.fill();
    ctx.textAlign = "left"; ctx.fillStyle = led; ctx.font = `700 18px ${CANVAS_FONT}`;
    ctx.fillText(near ? `${near} 근처` : "메뉴 월드컵 결과", 56, 496);
    rk.slice(0, 4).forEach((r, i) => {
      const y = 540 + i * 36;
      ctx.textAlign = "left"; ctx.fillStyle = led; ctx.font = `700 18px ${CANVAS_FONT}`;
      ctx.fillText(i === 0 ? "1위" : r.label, 56, y);
      badge(r.item, 150, y - 6, 12);
      ctx.textAlign = "left"; ctx.fillStyle = T.surface; ctx.font = `800 22px ${disp}`;
      ctx.fillText(r.item.n.slice(0, 18), 174, y);
    });
  }
  ctx.textAlign = "center"; ctx.fillStyle = T.sub; ctx.font = `600 18px ${CANVAS_FONT}`;
  const host = (document.querySelector('link[rel="canonical"]')?.href || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  ctx.fillText(`다같이 고르는 메뉴 월드컵 · ${host}`, W / 2, H - 34);
  return canvas;
}

/* ---------- 링크로 각자: 방 ---------- */
const getRooms = () => store.get("rooms", {});
function saveRoom(room) {
  const rooms = getRooms();
  rooms[room.id] = room;
  const cutoff = Date.now() - 14 * 86400000;
  Object.keys(rooms).forEach((k) => rooms[k].created < cutoff && delete rooms[k]);
  store.set("rooms", rooms);
}
function latestRoom() {
  const list = Object.values(getRooms()).filter((r) => r.created > Date.now() - 3 * 86400000);
  return list.sort((a, b) => b.created - a.created)[0] || null;
}
const compact = (it) => (it.src === "catalog" ? it.key : { n: it.n, e: it.e, c: it.c, la: it.lat != null ? +it.lat.toFixed(5) : undefined, lo: it.lon != null ? +it.lon.toFixed(5) : undefined });
function expand(x) {
  if (typeof x === "string") return catalogAdapter.byId(x) || { key: x, n: x, e: "🍽️", kind: "menu", t: [], q: x, src: "catalog" };
  return { key: `p:${x.n}`, kind: x.la != null ? "place" : "menu", src: "link", n: x.n, e: x.e || "🍽️", c: x.c || "", g: x.c || "", t: [], q: x.n, lat: x.la, lon: x.lo };
}

function createRoom() {
  const st = cur();
  const id = Math.random().toString(36).slice(2, 8);
  const room = {
    id,
    mode: G.mode,
    host: G.voters[0] && G.voters[0] !== "나" ? G.voters[0] : store.get("hostName", "나"),
    at: G.loc ? locLabel(G.loc) : null,
    lat: G.loc?.lat ?? null,
    lon: G.loc?.lon ?? null,
    items: st.items.map(compact),
    created: Date.now(),
    replies: [],
  };
  saveRoom(room);
  openRoom(id);
}

function playUrl(room) {
  return urlWith({ play: encodeState({ r: room.id, h: room.host, m: room.mode, a: room.at, c: room.items }) });
}

function addReplyToRoom(room, rep) {
  const fresh = getRooms()[room.id] || room;
  fresh.replies = fresh.replies.filter((r) => r.name !== rep.name);
  fresh.replies.push({ name: rep.name, k: rep.k, at: Date.now() });
  saveRoom(fresh);
  return fresh;
}

function roomAggregate(room) {
  const items = room.items.map(expand);
  const names = items.map((x) => x.n);
  const replies = room.replies.map((r) => ({ name: r.name, w: r.k.map((x) => x[0]), s: r.k.map((x) => x[2]) }));
  return { items, rows: aggregate(replies, names) };
}

function openRoom(id) {
  const room = getRooms()[id];
  if (!room) {
    toast("방 정보를 찾지 못했어요");
    go("intro");
    return;
  }
  const { items, rows } = roomAggregate(room);
  const byName = Object.fromEntries(items.map((x) => [x.n, x]));
  const hostPlayed = room.replies.some((r) => r.name === room.host);
  const shareCard = `    <div class="card card--flat block">
      <ol class="how">
        <li>아래 버튼으로 후보 링크를 단톡방에 보내요.</li>
        <li>친구들이 각자 폰에서 월드컵을 하고 '결과 보내기'로 답장 링크를 보내요.</li>
        <li>답장 링크를 이 폰에서 누르면 여기에 모여서 점수를 합쳐요.</li>
      </ol>
      <div class="field" style="margin-top: var(--sp-16)">
        <label class="field__label" for="hostName">친구들에게 보일 내 이름</label>
        <input class="input" id="hostName" maxlength="8" placeholder="예: 김대리" value="${room.host === "나" ? "" : esc(room.host)}" />
      </div>
      <div class="stack gap-8" style="margin-top: var(--sp-12)">
        <button class="btn btn--primary btn--block" data-act="roomShare" data-id="${room.id}">친구들에게 링크 보내기 →</button>
        <button class="btn btn--secondary btn--block" data-act="roomPlay" data-id="${room.id}">${hostPlayed ? "내 결과 다시 하기" : "나도 월드컵 하기"}</button>
      </div>
    </div>
`;
  const pasteCard = `    <div class="card card--flat block" style="margin-top: var(--sp-12)">
      <div class="block__title"><h3>답장 링크 붙여넣기</h3></div>
      <div class="add-row" style="margin-top: 0">
        <input class="input" id="replyInput" placeholder="https://…?reply=…" autocomplete="off" />
        <button class="btn btn--secondary" data-act="addReply" data-id="${room.id}">추가</button>
      </div>
      <p class="block__hint">답장은 서버 없이 링크에 담겨 와요. 다른 브라우저에서 열렸다면 링크를 복사해서 여기에 붙여넣어 주세요.</p>
    </div>
`;
  const results = `    ${
      room.replies.length
        ? `<h3 class="section-t">각자의 1위</h3>
          <div class="stack gap-8">${room.replies
            .map((r) => `<div class="reply"><b>${esc(r.name)}</b><span>1위 ${esc(r.k[0][0])}</span></div>`)
            .join("")}</div>
          <h3 class="section-t">합산 순위 <small>보르다 점수</small></h3>
          <div class="bars bars--lead">${rows
            .slice(0, 8)
            .map(
              (r) => `<div class="bar" style="--l: ${lineOf(byName[r.name])}">
                <div class="bar__top"><span>${esc(r.name)}</span><small>${fmtScore(r.score)}점 / ${r.max}</small></div>
                <div class="bar__track"><div class="bar__fill" style="width: ${r.max ? Math.max(2, (r.score / r.max) * 100) : 0}%"></div></div>
                ${r.firsts.length ? `<div class="bar__who">${esc(r.firsts.join(", "))}의 1위</div>` : ""}
              </div>`
            )
            .join("")}</div>
          <p class="block__hint">우승 ${items.length - 1}점, 준우승 ${items.length - 2}점을 받고, 같은 라운드에서 떨어진 후보끼리는 점수를 나눠 가져요.</p>
          <div class="actions"><button class="btn btn--primary btn--lg btn--wide" data-act="roomFinal" data-id="${room.id}">${esc(euro(rows[0].name))} 확정하기 →</button></div>`
        : `<div class="empty"><div class="empty__k"></div><p class="t-body-03">아직 답장이 없어요. 링크를 보내고 기다려 주세요.</p></div>`
    }
`;
  $("#room").innerHTML = `
    <div class="view-head">
      <span class="eyebrow">링크로 각자 고르기 · ${MODES[room.mode]?.n || ""}</span>
      <h2 class="t-title-02">${room.replies.length ? `답장 ${room.replies.length}개가 모였어요` : "친구들 답장을 기다려요"}</h2>
      <p class="t-body-03 t-secondary">${room.at ? `${esc(room.at)} 근처 · ` : ""}후보 ${items.length}개</p>
    </div>
    ${room.replies.length ? results + `<h3 class="section-t">친구 더 부르기</h3>` + shareCard : shareCard + results}
    ${pasteCard}
    <h3 class="section-t">후보</h3>
    <div class="mini-cands" style="justify-content: flex-start">${items.map((x) => `<span>${lb(x)}${esc(x.n)}</span>`).join("")}</div>`;
  go("room");
}

const fmtScore = (n) => (Number.isInteger(n) ? n : n.toFixed(1));

function finalizeRoom(id) {
  const room = getRooms()[id];
  const { items, rows } = roomAggregate(room);
  const byName = Object.fromEntries(items.map((x) => [x.n, x]));
  const winner = byName[rows[0].name];
  G = {
    mode: room.mode,
    vote: "link",
    voters: [room.host],
    loc: room.at ? { name: room.at, lat: room.lat, lon: room.lon, kind: "station" } : null,
    stages: [{ k: "main", winner, ranking: rows.map((r) => ({ item: byName[r.name], label: `${fmtScore(r.score)}점` })) }],
    si: 0,
  };
  if (G.loc && G.loc.lat == null) G.loc = { name: room.at };
  renderResult();
}

function handleReplyParam(str) {
  const rep = decodeState(str);
  if (!rep?.r || !Array.isArray(rep.k)) {
    toast("답장 링크를 읽지 못했어요");
    return null;
  }
  let room = getRooms()[rep.r];
  if (!room) {
    room = {
      id: rep.r,
      mode: rep.m || "lunch",
      host: "나",
      at: rep.a || null,
      items: rep.k.map(([n, e]) => ({ n, e })),
      created: Date.now(),
      replies: [],
    };
    saveRoom(room);
  }
  addReplyToRoom(room, { name: rep.n || "친구", k: rep.k });
  toast(`${rep.n || "친구"}의 답장을 추가했어요`);
  return rep.r;
}

/* ---------- 친구가 보낸 월드컵 (게스트) ---------- */
function renderGuest(p) {
  const items = p.c.map(expand);
  const m = MODES[p.m] || MODES.lunch;
  $("#guest").innerHTML = `
    <div class="card card--flat guest-card" style="margin-top: var(--sp-16)">
      <span class="eyebrow">링크로 각자 고르기</span>
      <h2 class="t-title-02" style="margin: var(--sp-8) 0 var(--sp-4)">${esc(iga(p.h))} 보낸 ${m.title}</h2>
      <p class="t-body-03 t-secondary" style="margin: 0">${p.a ? `${esc(p.a)} 근처 · ` : ""}후보 ${items.length}개 중에서 내 1위를 골라 주세요</p>
      <div class="mini-cands">${items.map((x) => `<span>${lb(x)}${esc(x.n)}</span>`).join("")}</div>
      <div class="field" style="text-align: left">
        <label class="field__label" for="guestName">내 이름</label>
        <input class="input" id="guestName" maxlength="8" placeholder="예: 민지" value="${esc(store.get("guestName", ""))}" />
        <span class="field__help">결과를 보낼 때 이 이름으로 표시돼요</span>
      </div>
      <button class="btn btn--primary btn--lg btn--block" data-act="guestStart" style="margin-top: var(--sp-16)">월드컵 시작하기</button>
    </div>
    <div class="card card--flat block" style="margin-top: var(--sp-12)">
      <ol class="how">
        <li>둘 중 더 끌리는 쪽을 계속 골라요 (${roundLabel(items.length)}, 약 1분).</li>
        <li>끝나면 '결과 보내기'로 답장 링크를 ${esc(p.h)}에게 보내요.</li>
        <li>${esc(iga(p.h))} 모두의 답장을 합쳐서 최종 장소를 정해요.</li>
      </ol>
    </div>`;
  go("guest");
  G = { guestPayload: p };
}

function guestStart() {
  const p = G.guestPayload;
  const name = $("#guestName").value.trim();
  if (!name) {
    $("#guestName").classList.add("is-error");
    toast("이름을 넣어 주세요");
    return;
  }
  store.set("guestName", name);
  const items = p.c.map(expand);
  G = {
    mode: p.m || "lunch",
    vote: "solo",
    voters: [name],
    loc: p.a ? { name: p.a } : null,
    stages: [{ k: "main", items, bracket: new Bracket(items.sort(() => Math.random() - 0.5)) }],
    si: 0,
    guest: { room: p.r, host: p.h, name },
  };
  go("match");
  renderMatch(true);
}

async function sendReply() {
  const st = G.stages[0];
  const k = st.tiers.map((r) => [r.item.n, r.item.e, r.tier]);
  const url = urlWith({ reply: encodeState({ r: G.guest.room, n: G.guest.name, m: G.mode, a: G.loc?.name || null, k }) });
  await share({ title: "어디가? 내 결과", text: `${G.guest.name}의 픽: 1위 ${st.winner.e} ${st.winner.n}`, url });
}

/* ---------- 공유받은 결과 ---------- */
function renderShared(p) {
  const wins = p.w.map(unpackWinner);
  const m = MODES[p.m] || MODES.lunch;
  G = null;
  if (p.m === "date") {
    $("#result").innerHTML = `
      <div class="view-head">
        <span class="eyebrow">친구가 보낸 데이트 코스${p.a ? ` · ${esc(p.a)} 근처` : ""}</span>
        <h2 class="t-title-02">${wins.map((w) => esc(w.n)).join(" → ")}</h2>
      </div>
      ${courseHTML(wins, p.a, ["meal", "cafe", "play"])}
      <div class="actions"><button class="btn btn--primary btn--lg btn--wide" data-act="toIntroFresh">우리도 코스 짜보기 →</button></div>`;
  } else {
    const w = wins[0];
    $("#result").innerHTML = `
      ${signHTML(w, { kicker: `친구가 보낸 ${m.title} 1위`, prev: p.r?.[0] ? `2위 ${p.r[0][1]}` : "", next: p.r?.[1] ? `3위 ${p.r[1][1]}` : "" })}
      <p class="sign-sub">${p.a ? `${esc(p.a)} 근처에서 고른 결과예요` : "메뉴 월드컵 결과예요"}</p>
      ${actionsHTML(w, p.a)}
      <div class="actions"><button class="btn btn--primary btn--lg btn--wide" data-act="toIntroFresh">${p.m === "group" ? "우리 모임도 정해보기 →" : "나도 오늘 메뉴 정하기 →"}</button></div>`;
  }
  go("result");
}

/* ---------- 점심 리포트 ---------- */
function pickiness(logs) {
  if (logs.length < 3) return null;
  const cnt = {};
  logs.forEach((l) => (cnt[l.g] = (cnt[l.g] || 0) + 1));
  const n = logs.length;
  const H = -Object.values(cnt).reduce((s, c) => s + (c / n) * Math.log(c / n), 0);
  const K = Math.min(n, 9);
  return Math.round((1 - H / Math.log(K)) * 100);
}

function renderReport() {
  const logs = getLogs().slice().sort((a, b) => b.t - a.t);
  const month = todayKey().slice(0, 7);
  const ml = logs.filter((l) => l.d.startsWith(month));
  const mm = Number(month.slice(5));
  const team = store.get("team");
  const el = $("#report");
  const head = `<div class="view-head">
      <span class="eyebrow">내 점심 기록</span>
      <h2 class="t-title-02">${mm}월 점심 리포트</h2>
      <p class="t-body-03 t-secondary">기록은 이 기기 브라우저에만 저장돼요.</p>
    </div>`;
  const teamHTML = `<h3 class="section-t">우리 팀</h3>${
    team
      ? `<div class="card card--flat block team-card"><div class="team-card__t"><div class="t-label-01">${esc(team.names.join(", "))}</div>
          <div class="t-caption-01 t-secondary">${team.loc ? `${esc(locLabel(team.loc))} 근처` : "회사 위치 없음"}</div></div>
          <button class="btn btn--primary btn--sm" data-act="teamGo">바로 고르기</button>
          <button class="btn btn--ghost btn--sm btn--icon" data-act="delTeam" aria-label="팀 삭제">✕</button></div>`
      : `<div class="notice">점심 설정 화면에서 '이 구성으로 팀 저장'을 누르면 다음부터 한 번에 시작할 수 있어요.</div>`
  }`;
  if (!logs.length) {
    el.innerHTML = `${head}<div class="card card--flat empty"><div class="empty__k"></div><p class="t-body-03">아직 기록이 없어요.<br />점심을 고르고 '점심 기록하기'를 누르면 여기에 모여요.</p>
      <button class="btn btn--primary btn--block" data-act="start">오늘 점심 고르기</button></div>${teamHTML}`;
    go("report");
    return;
  }
  const byMenu = {};
  const byGroup = {};
  ml.forEach((l) => {
    byMenu[l.n] = byMenu[l.n] || { n: l.n, e: l.e, c: 0 };
    byMenu[l.n].c++;
    byGroup[l.g] = (byGroup[l.g] || 0) + 1;
  });
  const top = Object.values(byMenu).sort((a, b) => b.c - a.c)[0];
  const groups = Object.entries(byGroup).sort((a, b) => b[1] - a[1]);
  const pk = pickiness(ml);
  const warn = streakWarning();
  const places = {};
  logs.forEach((l) => {
    if (!l.place) return;
    places[l.place] = places[l.place] || { n: l.place, e: l.e, c: 0 };
    places[l.place].c++;
  });
  const placeList = Object.values(places).sort((a, b) => b.c - a.c).slice(0, 5);
  const pkLabel = pk == null ? "" : pk < 30 ? "골고루 먹는 편이에요" : pk < 60 ? "취향이 꽤 뚜렷해요" : "편식 주의! 새로운 분류 어때요?";
  el.innerHTML = `${head}
    <div class="stats">
      <div class="stat"><div class="stat__k">이번 달 기록</div><div class="stat__v">${ml.length}<small>번</small></div></div>
      <div class="stat"><div class="stat__k">최다 메뉴</div><div class="stat__v">${top ? `${top.c}<small>번 ${esc(top.n)}</small>` : "-"}</div></div>
      <div class="stat"><div class="stat__k">편식 지수</div><div class="stat__v">${pk == null ? "-" : pk}</div></div>
    </div>
    ${warn ? `<div class="notice notice--warn" style="margin-top: var(--sp-12)">${esc(warn)}</div>` : ""}
    <div class="card card--flat block" style="margin-top: var(--sp-12)">
      <div class="block__title"><h3>편식 지수</h3><span class="badge">${pk == null ? "기록 3개부터" : `${pk} / 100`}</span></div>
      ${pk == null ? `<p class="t-body-03 t-secondary" style="margin: 0">이번 달 기록이 3개 이상이면 계산해요.</p>` : `<div class="gauge" style="--v: ${pk}%"><i style="left: ${pk}%"></i></div><div class="gauge-legend"><span>골고루</span><span>편식</span></div><p class="t-body-03" style="margin: var(--sp-8) 0 0">${pkLabel}</p>`}
      <p class="block__hint">먹은 분류(한식·일식·양식…)가 얼마나 고르게 섞였는지로 계산해요. 한 분류만 먹을수록 100에 가까워요.</p>
    </div>
    ${
      groups.length
        ? `<h3 class="section-t">분류별 횟수 <small>이번 달</small></h3>
          <div class="card card--flat block"><div class="bars">${groups
            .map(([g, c]) => `<div class="bar"><div class="bar__top"><span>${esc(g)}</span><small>${c}번</small></div><div class="bar__track"><div class="bar__fill" style="width: ${(c / groups[0][1]) * 100}%"></div></div></div>`)
            .join("")}</div></div>`
        : ""
    }
    <h3 class="section-t">단골 도장 <small>같은 가게 3번이면 단골</small></h3>
    ${
      placeList.length
        ? `<div class="stamps">${placeList
            .map(
              (p) => `<div class="card card--flat stamp-card"><div class="stamp-card__top"><b>${esc(p.n)}</b>${p.c >= 3 ? `<span class="badge">단골 인증</span>` : `<span class="t-caption-01 t-tertiary">단골까지 ${3 - p.c}번</span>`}</div>
              <div class="stamp-grid">${Array.from({ length: 10 }, (_, i) => `<span class="${i < p.c ? "is-on" : ""}">${i < p.c ? i + 1 : ""}</span>`).join("")}</div></div>`
            )
            .join("")}</div>`
        : `<div class="notice">기록할 때 간 가게 이름을 넣거나 실제 가게로 고르면 도장이 찍혀요.</div>`
    }
    <h3 class="section-t">최근 기록</h3>
    <div class="log-list">${logs
      .slice(0, 15)
      .map(
        (l) => `<div class="log-row"><span class="log-row__d">${l.d.slice(5).replace("-", ".")}</span>${lb({ g: l.g })}
          <span class="log-row__n">${esc(l.n)}${l.place && l.place !== l.n ? `<small>${esc(l.place)}</small>` : ""}</span>
          <button class="btn btn--ghost btn--icon btn--sm" data-act="delLog" data-t="${l.t}" aria-label="기록 지우기">✕</button></div>`
      )
      .join("")}</div>
    ${teamHTML}
    <div class="actions"><button class="btn btn--primary btn--lg btn--wide" data-act="start">오늘 점심 고르기</button></div>`;
  go("report");
}

/* ---------- 이벤트 ---------- */
const actions = {
  start() {
    go("setup");
    renderSetup();
    refreshWeather();
  },
  home(_, e) {
    e.preventDefault();
    go("intro");
    renderIntroExtra();
  },
  toSetup() {
    actions.start();
  },
  toIntroFresh() {
    history.replaceState(null, "", location.pathname);
    G = null;
    go("intro");
    renderIntroExtra();
  },
  mode(b) {
    S.mode = b.dataset.v;
    if (S.mode === "date" && S.vote === "link") S.vote = "solo";
    S.tags.clear();
    savePrefs();
    renderSetup();
    S.weatherKey = "";
    refreshWeather();
  },
  async gps(b) {
    b.classList.add("is-loading");
    const loc = await gpsLoc();
    b.classList.remove("is-loading");
    if (!loc) {
      actions.pickLoc();
      return;
    }
    S.loc = loc;
    renderSetup();
    refreshWeather();
  },
  pickLoc() {
    openPlaceSheet({
      title: S.mode === "lunch" ? "회사·약속 장소 근처 역" : "만나는 곳 근처 역",
      onPick(loc) {
        S.loc = loc;
        renderSetup();
        refreshWeather();
      },
    });
  },
  addName() {
    const inp = $("#nameInput");
    const v = inp.value.trim();
    if (!v) return inp.focus({ preventScroll: true });
    const list = S.namesBy[S.mode];
    if (list.includes(v)) return toast("이미 있는 이름이에요");
    if (list.length >= 12) return toast("12명까지 넣을 수 있어요");
    list.push(v);
    savePrefs();
    renderSetup();
    $("#nameInput")?.focus({ preventScroll: true });
  },
  delName(b) {
    const list = S.namesBy[S.mode];
    if (list.length <= 1) return toast("한 명은 있어야 해요");
    list.splice(Number(b.dataset.i), 1);
    savePrefs();
    renderSetup();
  },
  saveTeam() {
    store.set("team", { names: S.namesBy.lunch.slice(), loc: S.loc ? { ...S.loc } : null, at: Date.now() });
    toast(S.loc ? "팀과 회사 위치를 저장했어요" : "팀을 저장했어요. 위치도 고르면 같이 저장돼요");
    renderSetup();
  },
  loadTeam() {
    const t = store.get("team");
    if (!t) return;
    S.namesBy.lunch = t.names.slice();
    if (t.loc) S.loc = t.loc;
    savePrefs();
    renderSetup();
    refreshWeather();
    toast("저장된 팀을 불러왔어요");
  },
  delTeam() {
    store.remove("team");
    renderReport();
  },
  async teamGo() {
    const t = store.get("team");
    if (!t) return;
    S.mode = "lunch";
    S.namesBy.lunch = t.names.slice();
    S.loc = t.loc || null;
    if (S.vote === "link" && t.names.length < 2) S.vote = "solo";
    if (S.vote === "phone" && t.names.length < 2) S.vote = "solo";
    savePrefs();
    if (S.loc) {
      S.weatherKey = `${S.loc.lat.toFixed(2)},${S.loc.lon.toFixed(2)}`;
      S.weather = await Promise.race([getWeather(S.loc), sleep(2500).then(() => null)]);
    }
    await startGame();
  },
  personLoc(b) {
    const i = Number(b.dataset.i);
    const p = S.people[i];
    openPlaceSheet({
      title: `${p.name}의 출발 위치`,
      withName: true,
      defaultName: p.name,
      onPick(loc, name) {
        p.loc = loc;
        if (name) p.name = name;
        renderSetup();
        refreshWeather();
      },
    });
  },
  addPerson() {
    const inp = $("#personInput");
    const v = inp.value.trim() || `친구${S.people.length}`;
    if (S.people.length >= 10) return toast("10명까지 넣을 수 있어요");
    if (S.people.some((p) => p.name === v)) return toast("이미 있는 이름이에요");
    S.people.push({ name: v, loc: null });
    renderSetup();
    actions.personLoc({ dataset: { i: S.people.length - 1 } });
  },
  delPerson(b) {
    if (S.people.length <= 1) return toast("한 명은 있어야 해요");
    S.people.splice(Number(b.dataset.i), 1);
    renderSetup();
    refreshWeather();
  },
  source(b) {
    S.source = b.dataset.v;
    savePrefs();
    renderSetup();
  },
  radius(b) {
    S.radius = Number(b.dataset.v);
    savePrefs();
    renderSetup();
  },
  price(b) {
    const v = Number(b.dataset.v);
    S.prices.has(v) ? S.prices.delete(v) : S.prices.add(v);
    renderSetup();
  },
  tag(b) {
    const v = b.dataset.v;
    S.tags.has(v) ? S.tags.delete(v) : S.tags.add(v);
    renderSetup();
  },
  clearFilters() {
    S.prices.clear();
    S.tags.clear();
    renderSetup();
  },
  recent() {
    S.excludeRecent = !S.excludeRecent;
    renderSetup();
  },
  size(b) {
    S.size = Number(b.dataset.v);
    savePrefs();
    renderSetup();
  },
  vote(b) {
    S.vote = b.dataset.v;
    savePrefs();
    renderSetup();
  },
  go() {
    startGame();
  },
  veto(b) {
    doVeto(Number(b.dataset.i));
  },
  vetoPass() {
    const st = cur();
    st.vi++;
    renderVeto(true);
  },
  async reshuffle(b) {
    const st = cur();
    st.shuffles++;
    b.classList.add("is-loading");
    await prepareStage();
    renderVeto();
    toast("후보를 다시 섞었어요");
  },
  startBracket() {
    startBracket();
  },
  pick(b, e) {
    const side = Number(b.dataset.side);
    if (G.vote === "phone") tallyTap(side, b, e);
    else pick(side);
  },
  resetTally() {
    G.tally = [0, 0];
    updateTally();
  },
  decide() {
    decide();
  },
  quit() {
    G = null;
    actions.start();
  },
  again() {
    actions.start();
  },
  shareLink() {
    shareResult();
  },
  async shareImg(b) {
    b.classList.add("is-loading");
    try {
      await shareImage(drawCard(), { filename: "where-to-go.png", title: "어디가? 결과" });
    } finally {
      b.classList.remove("is-loading");
    }
  },
  logLunch() {
    logLunch();
  },
  report() {
    renderReport();
  },
  delLog(b) {
    const t = Number(b.dataset.t);
    store.set("logs", getLogs().filter((l) => l.t !== t));
    renderReport();
  },
  openRoom(b) {
    openRoom(b.dataset.id);
  },
  roomShare(b) {
    const room = getRooms()[b.dataset.id];
    const inp = $("#hostName");
    const name = inp?.value.trim();
    if (!name) {
      inp?.classList.add("is-error");
      inp?.focus({ preventScroll: true });
      toast("친구들이 알아볼 수 있게 이름을 넣어 주세요");
      return;
    }
    if (name !== room.host) {
      room.replies.forEach((r) => r.name === room.host && (r.name = name));
      room.host = name;
      saveRoom(room);
      store.set("hostName", name);
    }
    share({
      title: `${MODES[room.mode]?.title || "메뉴 월드컵"}`,
      text: `${iga(room.host)} ${MODES[room.mode]?.title || "메뉴 월드컵"}을 만들었어요! 각자 해보고 '결과 보내기'로 답장 주세요`,
      url: playUrl(room),
    });
  },
  roomPlay(b) {
    const room = getRooms()[b.dataset.id];
    const items = room.items.map(expand);
    G = {
      mode: room.mode,
      vote: "solo",
      voters: [room.host],
      loc: room.at ? { name: room.at } : null,
      stages: [{ k: "main", items, bracket: new Bracket(items.sort(() => Math.random() - 0.5)) }],
      si: 0,
      roomPlay: true,
      room,
    };
    go("match");
    renderMatch(true);
  },
  addReply(b) {
    const v = $("#replyInput").value.trim();
    let str = v;
    try {
      str = new URL(v).searchParams.get("reply") || v;
    } catch {
      /* 링크가 아니면 값 그대로 */
    }
    const id = handleReplyParam(str);
    if (id) openRoom(id);
    else openRoom(b.dataset.id);
  },
  roomFinal(b) {
    finalizeRoom(b.dataset.id);
  },
  guestStart() {
    guestStart();
  },
  sendReply() {
    sendReply();
  },
};

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (!b || b.disabled) return;
  const fn = actions[b.dataset.act];
  if (fn) fn(b, e);
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.isComposing) return;
  const id = e.target.id;
  if (id === "nameInput") actions.addName();
  else if (id === "personInput") actions.addPerson();
  else if (id === "replyInput") $('[data-act="addReply"]')?.click();
  else if (id === "guestName") guestStart();
});

/* ---------- 하단 다른 도구 링크 → 역 '갈아타는 곳' 환승 안내판 ---------- */
function dressTransfer(el) {
  if (!el) return;
  el.classList.add("xfer");
  const title = el.querySelector(".more-sites__title");
  if (title) title.innerHTML = `<span class="xfer__icon" aria-hidden="true"></span><span class="xfer__ko">갈아타는 곳</span><span class="xfer__en" aria-hidden="true">Transfer</span>`;
  $$(".more-sites__item", el).forEach((a, i) => {
    const name = a.querySelector(".more-sites__name")?.textContent.trim() || "";
    a.style.setProperty("--i", i);
    a.insertAdjacentHTML("afterbegin", `<span class="xfer__badge" aria-hidden="true">${name.slice(0, 1)}</span>`);
    a.insertAdjacentHTML("beforeend", `<span class="xfer__go" aria-hidden="true"></span>`);
  });
  if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
    el.classList.add("is-in");
    return;
  }
  const io = new IntersectionObserver((ents) => {
    if (ents.some((e) => e.isIntersecting)) {
      el.classList.add("is-in");
      io.disconnect();
    }
  }, { threshold: 0.3 });
  io.observe(el);
}

/* ---------- 시작 ---------- */
renderMoreSites($("#more"));
dressTransfer($("#more"));
loadConfig().then((c) => {
  S.kakao = !!c.kakaoJsKey;
});

const pPlay = getParam("play");
const pReply = getParam("reply");
const pRes = getParam("r");
if (pPlay) {
  const p = decodeState(pPlay);
  if (p?.c?.length) renderGuest(p);
  else {
    toast("링크를 읽지 못했어요");
    go("intro");
  }
} else if (pReply) {
  const id = handleReplyParam(pReply);
  history.replaceState(null, "", location.pathname);
  if (id) openRoom(id);
  else go("intro");
} else if (pRes) {
  const p = decodeState(pRes);
  if (p?.w?.length) renderShared(p);
  else go("intro");
} else {
  go("intro");
}
renderIntroExtra();
