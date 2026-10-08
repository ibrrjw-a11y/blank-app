// 시차 계산기(2026-10-08). 도시마다 IANA 시간대 이름만 정해 두고, 시각·시차·서머타임은 전부 브라우저 Intl.DateTimeFormat 이 계산
// 우리가 직접 정한 시차 숫자는 하나도 없음(서머타임 날짜를 손으로 적으면 틀리기 쉬워서)
import { $, $$, share, toast, renderMoreSites, ROOT_URL, getParam, prefersReducedMotion } from "../../shared/kit.js";

const RM = prefersReducedMotion();
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// [화면 이름, 나라, IANA 시간대, 찾기용 다른 이름]
export const CITIES = [
  ["서울", "대한민국", "Asia/Seoul", "한국 부산"],
  ["도쿄", "일본", "Asia/Tokyo", "오사카 후쿠오카"],
  ["베이징", "중국", "Asia/Shanghai", "상하이 칭다오"],
  ["홍콩", "홍콩", "Asia/Hong_Kong", ""],
  ["타이베이", "대만", "Asia/Taipei", ""],
  ["울란바토르", "몽골", "Asia/Ulaanbaatar", ""],
  ["블라디보스토크", "러시아", "Asia/Vladivostok", ""],
  ["마닐라", "필리핀", "Asia/Manila", "세부 보라카이"],
  ["하노이", "베트남", "Asia/Ho_Chi_Minh", "호찌민 다낭 나트랑"],
  ["방콕", "태국", "Asia/Bangkok", "푸껫 치앙마이"],
  ["싱가포르", "싱가포르", "Asia/Singapore", ""],
  ["쿠알라룸푸르", "말레이시아", "Asia/Kuala_Lumpur", "코타키나발루"],
  ["자카르타", "인도네시아", "Asia/Jakarta", ""],
  ["발리", "인도네시아", "Asia/Makassar", "덴파사르"],
  ["뉴델리", "인도", "Asia/Kolkata", "뭄바이"],
  ["카트만두", "네팔", "Asia/Kathmandu", ""],
  ["두바이", "아랍에미리트", "Asia/Dubai", "아부다비"],
  ["모스크바", "러시아", "Europe/Moscow", ""],
  ["이스탄불", "튀르키예", "Europe/Istanbul", "터키"],
  ["런던", "영국", "Europe/London", ""],
  ["파리", "프랑스", "Europe/Paris", ""],
  ["베를린", "독일", "Europe/Berlin", "프랑크푸르트 뮌헨"],
  ["로마", "이탈리아", "Europe/Rome", "밀라노"],
  ["마드리드", "스페인", "Europe/Madrid", "바르셀로나"],
  ["암스테르담", "네덜란드", "Europe/Amsterdam", ""],
  ["프라하", "체코", "Europe/Prague", ""],
  ["취리히", "스위스", "Europe/Zurich", ""],
  ["카이로", "이집트", "Africa/Cairo", ""],
  ["요하네스버그", "남아프리카공화국", "Africa/Johannesburg", ""],
  ["뉴욕", "미국 동부", "America/New_York", "워싱턴 보스턴"],
  ["토론토", "캐나다", "America/Toronto", ""],
  ["시카고", "미국 중부", "America/Chicago", "댈러스 휴스턴"],
  ["덴버", "미국 산악", "America/Denver", ""],
  ["로스앤젤레스", "미국 서부", "America/Los_Angeles", "LA 샌프란시스코 시애틀"],
  ["밴쿠버", "캐나다", "America/Vancouver", ""],
  ["앵커리지", "미국 알래스카", "America/Anchorage", ""],
  ["호놀룰루", "미국 하와이", "Pacific/Honolulu", "하와이"],
  ["멕시코시티", "멕시코", "America/Mexico_City", ""],
  ["상파울루", "브라질", "America/Sao_Paulo", ""],
  ["부에노스아이레스", "아르헨티나", "America/Argentina/Buenos_Aires", ""],
  ["시드니", "호주", "Australia/Sydney", "멜버른"],
  ["브리즈번", "호주", "Australia/Brisbane", "골드코스트"],
  ["애들레이드", "호주", "Australia/Adelaide", ""],
  ["퍼스", "호주", "Australia/Perth", ""],
  ["오클랜드", "뉴질랜드", "Pacific/Auckland", ""],
  ["괌", "미국령", "Pacific/Guam", "사이판"],
];
const ZONE = Object.fromEntries(CITIES.map((c) => [c[0], c[2]]));
const SEOUL = "Asia/Seoul";

// ---------- 시간대 계산(화면 없음) ----------
const F = {};
const fmtr = (z) => (F[z] ||= new Intl.DateTimeFormat("en-US", { timeZone: z, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }));
// 순간 t(밀리초)에 그 시간대의 벽시계
export function wall(z, t) {
  const p = Object.fromEntries(fmtr(z).formatToParts(new Date(t)).filter((x) => x.type !== "literal").map((x) => [x.type, Number(x.value)]));
  return { y: p.year, m: p.month, d: p.day, h: p.hour % 24, mi: p.minute, s: p.second };
}
// 그 시간대가 세계 표준시보다 몇 분 빠른지
export function offMin(z, t) {
  const w = wall(z, t);
  return Math.round((Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s) - Math.floor(t / 1000) * 1000) / 60000);
}
// 그해 1월 1일·7월 1일 중 작은 쪽 = 표준시. 지금이 그보다 크면 서머타임 중
export function isDst(z, t) {
  const y = wall(z, t).y;
  return offMin(z, t) > Math.min(offMin(z, Date.UTC(y, 0, 1)), offMin(z, Date.UTC(y, 6, 1)));
}
// 그 시간대의 벽시계 → 순간. 두 번 있는 시각은 먼저 오는 쪽, 없는 시각(서머타임 시작)은 바뀌기 전 시차로 계산하고 gap 표시
export function toInstant(z, y, m, d, h, mi) {
  const local = Date.UTC(y, m - 1, d, h, mi);
  const oB = offMin(z, local - 26 * 36e5), oA = offMin(z, local + 26 * 36e5);
  const same = (t) => { const w = wall(z, t), q = new Date(local); return w.y === q.getUTCFullYear() && w.m === q.getUTCMonth() + 1 && w.d === q.getUTCDate() && w.h === q.getUTCHours() && w.mi === q.getUTCMinutes(); };
  const ok = [...new Set([oB, oA])].map((o) => local - o * 60000).filter(same).sort((a, b) => a - b);
  if (ok.length) return { t: ok[0], gap: false, twice: ok.length > 1 };
  return { t: local - oB * 60000, gap: true, twice: false };
}
const pad = (n) => String(n).padStart(2, "0");
const WD = ["일", "월", "화", "수", "목", "금", "토"];
const wdOf = (w) => WD[new Date(Date.UTC(w.y, w.m - 1, w.d)).getUTCDay()];
export const hm = (w) => `${pad(w.h)}:${pad(w.mi)}`;
export const dateText = (w) => `${w.y}년 ${w.m}월 ${w.d}일 (${wdOf(w)})`;
const dayNo = (w) => Date.UTC(w.y, w.m - 1, w.d) / 864e5;
export function diffText(min) {
  if (min === 0) return "서울과 같음";
  const a = Math.abs(min), h = Math.floor(a / 60), m = a % 60;
  return `서울보다 ${h ? `${h}시간` : ""}${h && m ? " " : ""}${m ? `${m}분` : ""} ${min > 0 ? "빠름" : "느림"}`;
}
const relDay = (w, base) => { const k = dayNo(w) - dayNo(base); return k === 0 ? "같은 날" : k === -1 ? "전날" : k === 1 ? "다음 날" : `${k > 0 ? "+" : ""}${k}일`; };

// 두 도시 근무시간 겹침: A 날짜의 [as, ae] 와 B 의 전날·그날·다음 날 [bs, be] 가 겹치는 구간들
export function overlap(za, zb, y, m, d, as, ae, bs, be) {
  const A0 = toInstant(za, y, m, d, as, 0).t, A1 = toInstant(za, y, m, d, ae, 0).t;
  const out = [];
  for (const k of [-1, 0, 1]) {
    const q = new Date(Date.UTC(y, m - 1, d + k));
    const B0 = toInstant(zb, q.getUTCFullYear(), q.getUTCMonth() + 1, q.getUTCDate(), bs, 0).t, B1 = toInstant(zb, q.getUTCFullYear(), q.getUTCMonth() + 1, q.getUTCDate(), be, 0).t;
    const s = Math.max(A0, B0), e = Math.min(A1, B1);
    if (e > s) out.push([s, e]);
  }
  return { A0, A1, spans: out, min: out.reduce((a, [s, e]) => a + (e - s) / 60000, 0) };
}

// ---------- 화면 ----------
let mode = "now", last = null;
const cityOpts = (sel) => CITIES.map(([n, c]) => `<option value="${esc(n)}"${n === sel ? " selected" : ""}>${esc(n)} (${esc(c)})</option>`).join("");
const hourOpts = (sel) => Array.from({ length: 25 }, (_, h) => `<option value="${h}"${h === sel ? " selected" : ""}>${pad(h)}:00</option>`).join("");
const row = (k, v) => `<div class="rr" data-k="${esc(k)}"><span>${k}</span><b>${esc(v)}</b></div>`;
const setMode = (m) => {
  mode = m;
  $$("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.m === m));
  $$(".fm").forEach((f) => (f.hidden = f.dataset.mode !== m));
  for (const s of ["cin", "cres"]) $("#" + s).hidden = s !== "cin";
};

function paintNow() {
  const t = Date.now(), sw = wall(SEOUL, t), so = offMin(SEOUL, t);
  $("#n_seoul").innerHTML = `서울 지금 <b>${hm(sw)}</b>${esc(dateText(sw))}`;
  const q = $("#n_q").value.trim().toLowerCase();
  $("#nowlist").innerHTML = CITIES.filter(([n, c, z, al]) => n !== "서울" && (!q || `${n} ${c} ${al} ${z}`.toLowerCase().includes(q))).map(([n, c, z]) => {
    const w = wall(z, t), o = offMin(z, t) - so;
    return `<div class="tz-c" data-city="${esc(n)}"><span class="nm">${esc(n)} <small>${esc(c)}</small>${isDst(z, t) ? '<span class="dot">서머타임</span>' : ""}</span><span class="tm">${hm(w)}</span><span class="of">${diffText(o)}</span><span class="dy">${relDay(w, sw)}</span></div>`;
  }).join("") || `<p class="cf-h">찾는 도시가 없어요. 나라 이름으로도 찾아보세요.</p>`;
}

function showRes({ head, val, sub, warn, strip = "", rows = [], notes = [] }) {
  $("#rhead").textContent = head; $("#rval").textContent = val; $("#rsub").textContent = sub || "";
  $("#rwarn").hidden = !warn; $("#rwarn").textContent = warn || "";
  $("#rstrip").innerHTML = strip;
  $("#rrows").innerHTML = rows.map(([k, v]) => row(k, v)).join("");
  $("#rnotes").innerHTML = notes.map((t) => `<li>${esc(t)}</li>`).join("");
  for (const s of ["cin", "cres"]) $("#" + s).hidden = s !== "cres";
  $("#cres").scrollIntoView({ block: "start", behavior: RM ? "auto" : "smooth" });
}

function doConv() {
  const from = $("#z_from").value, to = $("#z_to").value, ds = $("#z_date").value, ts = $("#z_time").value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ds) || !/^\d{2}:\d{2}/.test(ts)) { const e = $("#zerr"); e.textContent = "날짜와 시각을 넣어 주세요"; e.hidden = false; return; }
  $("#zerr").hidden = true;
  const [y, m, d] = ds.split("-").map(Number), [h, mi] = ts.split(":").map(Number);
  const r = toInstant(ZONE[from], y, m, d, h, mi), fw = wall(ZONE[from], r.t), tw = wall(ZONE[to], r.t);
  const o = offMin(ZONE[to], r.t) - offMin(ZONE[from], r.t);
  last = { m: "conv", from, to, ds, ts };
  showRes({
    head: `${from} ${dateText({ y, m, d })} ${pad(h)}:${pad(mi)}일 때 ${to}는`,
    val: `${hm(tw)}`,
    sub: `${dateText(tw)} · ${relDay(tw, fw)} · ${o === 0 ? "시차 없음" : `${from}보다 ${Math.floor(Math.abs(o) / 60)}시간${Math.abs(o) % 60 ? ` ${Math.abs(o) % 60}분` : ""} ${o > 0 ? "빠름" : "느림"}`}`,
    warn: r.gap ? `${from}에서는 이날 서머타임이 시작되어 ${pad(h)}:${pad(mi)}이(가) 없는 시각이에요. 바뀌기 전 시차로 계산해서 ${from} 시각으로는 ${hm(fw)}과 같아요.` : r.twice ? `${from}에서는 이날 서머타임이 끝나 ${pad(h)}:${pad(mi)}이(가) 두 번 있어요. 먼저 오는(서머타임) 쪽으로 계산했어요.` : "",
    rows: CITIES.map(([n, , z]) => { const w = wall(z, r.t); return [n, `${hm(w)} · ${w.m}/${w.d}(${wdOf(w)})${isDst(z, r.t) ? " · 서머타임" : ""}`]; }),
    notes: [`${from}·${to}의 그날 시차(서머타임 포함)로 계산했어요.`],
  });
}

function doMeet() {
  const a = $("#m_a").value, b = $("#m_b").value, ds = $("#m_date").value;
  const as = Number($("#m_as").value), ae = Number($("#m_ae").value), bs = Number($("#m_bs").value), be = Number($("#m_be").value);
  const e = $("#merr");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) { e.textContent = "날짜를 넣어 주세요"; e.hidden = false; return; }
  if (ae <= as || be <= bs) { e.textContent = "근무시간은 끝나는 시각이 시작보다 뒤여야 해요"; e.hidden = false; return; }
  e.hidden = true;
  const [y, m, d] = ds.split("-").map(Number);
  const r = overlap(ZONE[a], ZONE[b], y, m, d, as, ae, bs, be);
  last = { m: "meet", a, b, ds, as, ae, bs, be };
  const span = ([s, en]) => { const ws = wall(ZONE[a], s), we = wall(ZONE[a], en), bs2 = wall(ZONE[b], s), be2 = wall(ZONE[b], en); return [`${a} ${hm(ws)}~${hm(we)}`, `${b} ${bs2.m}/${bs2.d} ${hm(bs2)}~${hm(be2)}`]; };
  // 우리 쪽 하루(0~24시)를 30분 칸 48개로: 우리 근무 / 상대 근무 / 둘 다
  const D0 = toInstant(ZONE[a], y, m, d, 0, 0).t;
  const bw = (t) => { const w = wall(ZONE[b], t), x = w.h + w.mi / 60; return x >= bs && x < be; };
  const cells = Array.from({ length: 48 }, (_, k) => { const t = D0 + k * 18e5, w = wall(ZONE[a], t), x = w.h + w.mi / 60, ia = x >= as && x < ae, ib = bw(t); return `<i class="${ia && ib ? "ab" : ia ? "a" : ib ? "b" : ""}"></i>`; }).join("");
  const strip = `<div class="strip"><p>${esc(a)} 시각으로 본 하루</p><div class="bar">${cells}</div><div class="ax"><span>0시</span><span>6시</span><span>12시</span><span>18시</span><span>24시</span></div><div class="lg"><span style="--c:rgba(59,91,219,.35)">우리 근무</span><span style="--c:rgba(245,159,0,.45)">상대 근무</span><span style="--c:var(--ac)">둘 다</span></div></div>`;
  const hh = Math.floor(r.min / 60), mm = r.min % 60;
  showRes({
    head: `${a} ${dateText({ y, m, d })} 기준 · ${a} ${pad(as)}~${pad(ae)}시 / ${b} ${pad(bs)}~${pad(be)}시`,
    val: r.spans.length ? `${hh ? `${hh}시간` : ""}${hh && mm ? " " : ""}${mm ? `${mm}분` : ""} 겹쳐요` : "겹치는 근무시간 없음",
    sub: r.spans.length ? r.spans.map((s) => span(s).join(" = ")).join(" / ") : `${b} 근무시간을 넓히거나, 한쪽이 이른 아침·저녁에 맞춰야 해요.`,
    strip,
    rows: r.spans.length ? r.spans.flatMap((s, k) => { const [x, z] = span(s); return [[`겹침${r.spans.length > 1 ? ` ${k + 1}` : ""} · ${a}`, x.replace(`${a} `, "")], [`겹침${r.spans.length > 1 ? ` ${k + 1}` : ""} · ${b}`, z.replace(`${b} `, "")]]; }) : [],
    notes: ["근무시간 끝 시각은 그 시각 직전까지로 봤어요(예: 18시까지 = 17:59까지).", "서머타임이 있는 도시는 그 날짜의 시차로 계산했어요."],
  });
}

function basis() {
  $("#cbasis").innerHTML = `<summary>계산 근거 · 도시별 시간대 이름</summary><table><thead><tr><th>항목</th><th>값</th><th>근거</th><th>확인</th></tr></thead><tbody>
    <tr><td>시각·시차·서머타임</td><td>도시마다 IANA 시간대 이름</td><td>브라우저 Intl.DateTimeFormat 이 가진 IANA 세계 시간대 자료. 우리가 시차 숫자를 직접 적지 않음</td><td>확정</td></tr>
    <tr><td>서머타임 중 표시</td><td>그해 1월 1일·7월 1일 중 작은 시차보다 지금 시차가 크면</td><td>남반구(시드니 등)도 같은 방식으로 판단</td><td>확정</td></tr>
    <tr><td>없는 시각·두 번 있는 시각</td><td>바뀌기 전 시차 / 먼저 오는 쪽</td><td>파이썬 zoneinfo 의 fold=0 과 같은 규칙</td><td>우리 규칙</td></tr>
    <tr><td>도시 → 시간대</td><td colspan="3">${CITIES.map(([n, , z]) => `${esc(n)} ${esc(z)}`).join(" · ")}</td></tr>
  </tbody></table><p>하노이·호찌민은 같은 시간대(Asia/Ho_Chi_Minh), 발리는 Asia/Makassar 를 써요. 기기 시계가 틀리면 '지금 시각'도 틀려요.</p>`;
}

function init() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: SEOUL, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  $("#z_from").innerHTML = cityOpts("서울"); $("#z_to").innerHTML = cityOpts("뉴욕");
  $("#m_a").innerHTML = cityOpts("서울"); $("#m_b").innerHTML = cityOpts("런던");
  $("#m_as").innerHTML = hourOpts(9); $("#m_ae").innerHTML = hourOpts(18); $("#m_bs").innerHTML = hourOpts(9); $("#m_be").innerHTML = hourOpts(18);
  $("#z_date").value = today; $("#m_date").value = today;
  basis(); paintNow();
  setInterval(() => { if (mode === "now") paintNow(); }, 15000);
  $("#n_q").addEventListener("input", paintNow);
  $("#tabs").addEventListener("click", (e) => { const b = e.target.closest("button[data-m]"); if (b) { setMode(b.dataset.m); if (b.dataset.m === "now") paintNow(); } });
  $("#zgo").addEventListener("click", doConv);
  $("#mgo").addEventListener("click", doMeet);
  $("#back").addEventListener("click", () => setMode(mode));
  $("#cshare").addEventListener("click", async () => {
    const p = new URLSearchParams(Object.entries(last || {}).map(([k, v]) => [k, String(v)]));
    const r = await share({ title: "시차 계산기", text: `${$("#rhead").textContent} ${$("#rval").textContent}`, url: `${ROOT_URL}calc/timezone/?${p}` });
    if (r === "shared") toast("보냈어요");
  });
  // 링크로 들어온 경우
  const g = (k) => getParam(k) || "";
  const isCity = (n) => Object.hasOwn(ZONE, n);
  if (g("m") === "conv" && isCity(g("from")) && isCity(g("to"))) {
    setMode("conv"); $("#z_from").value = g("from"); $("#z_to").value = g("to");
    if (/^\d{4}-\d{2}-\d{2}$/.test(g("ds"))) $("#z_date").value = g("ds"); if (/^\d{2}:\d{2}$/.test(g("ts"))) $("#z_time").value = g("ts");
    doConv();
  } else if (g("m") === "meet" && isCity(g("a")) && isCity(g("b"))) {
    setMode("meet"); $("#m_a").value = g("a"); $("#m_b").value = g("b");
    if (/^\d{4}-\d{2}-\d{2}$/.test(g("ds"))) $("#m_date").value = g("ds");
    for (const k of ["as", "ae", "bs", "be"]) { const v = Number(g(k)); if (Number.isInteger(v) && v >= 0 && v <= 24 && g(k) !== "") $(`#m_${k}`).value = String(v); }
    doMeet();
  }
  renderMoreSites($("#more"), "calc/timezone");
}
if (typeof document !== "undefined" && document.getElementById("nowlist")) init();
