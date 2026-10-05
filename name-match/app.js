import {
  $,
  $$,
  createStore,
  toast,
  haptic,
  share,
  shareImage,
  encodeState,
  decodeState,
  urlWith,
  getParam,
  runIntro,
  showView,
  openSheet,
  renderMoreSites,
  createCanvas,
  roundRect,
  CANVAS_FONT,
  prefersReducedMotion,
} from "../shared/kit.js";
import { match, matrix, highlights, parseNames, hangulOnly, nameStrokes, interleave } from "./calc.js";

const store = createStore("name-match");
const MAX = 12;
const SAMPLE = ["민수", "지영", "서준", "유나", "하늘", "도윤"];
const ROOM_TYPES = [
  { key: "class", emoji: "🏫", name: "반" },
  { key: "club", emoji: "🎸", name: "동아리" },
  { key: "work", emoji: "💼", name: "회사" },
  { key: "friends", emoji: "👯", name: "친구" },
  { key: "family", emoji: "🏠", name: "가족" },
];

let names = [];
let title = "";
let roomId = null;
let mode = "group";
let current = null; // { names, m, hl }

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// 받침 유무에 따른 조사
function josa(word, pair) {
  const h = hangulOnly(word);
  const last = h.charCodeAt(h.length - 1) - 0xac00;
  const has = last >= 0 && last % 28 !== 0;
  const [withB, withoutB] = pair.split("/");
  return word + (has ? withB : withoutB);
}

function shortName(n) {
  const h = hangulOnly(n);
  if (h.length === 3 && h === n) return h.slice(1); // 김민수 → 민수
  return Array.from(n).slice(0, 2).join("");
}

function comment(score) {
  if (score >= 90) return "이미 마음이 가득해요";
  if (score >= 70) return "꽤 진심이에요";
  if (score >= 50) return "호감이 있는 사이예요";
  if (score >= 30) return "아직은 그냥 친구예요";
  if (score >= 10) return "관심이 조금 필요해요";
  return "철벽 그 자체예요";
}

/* =========================================================
 * 인트로
 * ========================================================= */
function pixelHeart(size = 28) {
  // 7×6 픽셀 하트
  const map = ["0110110", "1111111", "1111111", "0111110", "0011100", "0001000"];
  const rects = [];
  map.forEach((row, y) =>
    row.split("").forEach((v, x) => {
      if (v === "1") rects.push(`<rect x="${x}" y="${y}" width="1.02" height="1.02"/>`);
    })
  );
  return `<svg class="pixel-heart" viewBox="0 0 7 6" width="${size}" height="${(size * 6) / 7}" aria-hidden="true">${rects.join("")}</svg>`;
}

// 캡션 제목을 글자 단위로 쪼개 스프링으로 떨어뜨린다 (키네틱 타이포)
function kinetic() {
  const h = document.querySelector("#intro .intro__caption h2");
  if (!h || prefersReducedMotion()) return;
  h.innerHTML = Array.from(h.textContent)
    .map((c, i) => `<span class="kchar" style="animation-delay:${i * 28}ms">${c === " " ? " " : esc(c)}</span>`)
    .join("");
}

function circleSVG() {
  return `<svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path class="circle-draw" d="M58 3 C 88 2, 99 12, 97 22 C 94 36, 30 40, 8 31 C -4 25, 4 6, 30 4 C 44 3, 60 4, 66 7"/></svg>`;
}

function introScenes() {
  const A = "지유";
  const B = "하은";
  const r = match(A, B);
  const letters = r.letters;
  const net = ["지유", "하은", "민수", "지영", "서준"];
  const m = matrix(net);
  const hl = highlights(net, m);
  const W = 340;
  const H = 340;
  const pos = net.map((_, i) => {
    const a = (i / net.length) * Math.PI * 2 - Math.PI / 2;
    return { x: W / 2 + Math.cos(a) * 118, y: H / 2 + Math.sin(a) * 118 };
  });
  const rowHTML = (row, cls = "") =>
    `<div class="i-row ${cls}">${row.map((d) => `<span class="i-digit">${d}</span>`).join("")}</div>`;

  const nodesSVG = (delayBase = 0) =>
    net
      .map(
        (n, i) =>
          `<g class="net-node" style="animation-delay:${delayBase + i * 90}ms"><circle cx="${pos[i].x}" cy="${pos[i].y}" r="30"/><text x="${pos[i].x}" y="${pos[i].y}">${n}</text></g>`
      )
      .join("");
  const edge = (i, j, shrink = 34) => {
    const a = pos[i];
    const b = pos[j];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    return { x1: a.x + ux * shrink, y1: a.y + uy * shrink, x2: b.x - ux * shrink, y2: b.y - uy * shrink, ux, uy };
  };
  const linesSVG = (cls, delayStep) => {
    const out = [];
    let k = 0;
    for (let i = 0; i < net.length; i++)
      for (let j = i + 1; j < net.length; j++) {
        const e = edge(i, j);
        const avg = (m[i][j] + m[j][i]) / 2;
        out.push(
          `<line class="net-line ${cls}" x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}" style="animation-delay:${k++ * delayStep}ms;stroke-width:${1 + avg / 30}"/>`
        );
      }
    return out.join("");
  };

  return [
    {
      title: "이름 획수를 세어요",
      desc: `${A}와 ${B}, 글자를 번갈아 세우고 획수를 적어요`,
      duration: 3000,
      play(stage) {
        stage.innerHTML = `<div class="scene scene--col">
          <div class="i-names"><span class="mark">${A}</span>${pixelHeart(30)}<span class="t-b">${B}</span></div>
          <div class="i-row i-letters">${letters
            .map((l, i) => `<span class="i-letter is-${l.from}" style="animation-delay:${250 + i * 110}ms">${l.ch}</span>`)
            .join("")}</div>
          <div class="i-row i-digits">${r.rows[0]
            .map((d, i) => `<span class="i-digit is-rain" style="animation-delay:${900 + i * 180}ms">${d}</span>`)
            .join("")}</div>
        </div>`;
      },
    },
    {
      title: "옆끼리 더해서 두 자리까지",
      desc: "더한 값의 일의 자리만 남기며 한 줄씩 내려가요",
      duration: 3200,
      play(stage, signal) {
        stage.innerHTML = `<div class="scene scene--col"><div class="i-pyr" id="iPyr">${rowHTML(r.rows[0])}</div></div>`;
        const pyr = $("#iPyr", stage);
        r.rows.slice(1).forEach((row, k) => {
          setTimeout(() => {
            if (signal.aborted) return;
            const last = k === r.rows.length - 2;
            pyr.insertAdjacentHTML("beforeend", last ? `<div class="i-final">${rowHTML(row, "is-write")}${circleSVG()}</div>` : rowHTML(row, "is-write"));
            if (last) {
              setTimeout(() => {
                if (signal.aborted) return;
                pyr.insertAdjacentHTML(
                  "beforeend",
                  `<div class="i-score">${r.score}%</div><p class="t-secondary m0 i-score-cap">${josa(A, "이/가")} ${josa(B, "을/를")} 생각하는 마음</p>`
                );
              }, 520);
            }
          }, 300 + k * 380);
        });
      },
    },
    {
      title: "단톡방 전원을 한 번에",
      desc: "최대 12명, 모든 조합의 궁합을 표 한 장으로 그려요",
      duration: 3000,
      play(stage) {
        stage.innerHTML = `<div class="scene"><svg viewBox="0 0 ${W} ${H}">
          ${linesSVG("is-draw", 70)}
          ${nodesSVG(250)}
          <g class="i-core-g"><text class="i-core" x="${W / 2}" y="${H / 2}">${r.score}%</text></g>
        </svg></div>`;
      },
    },
    {
      title: "방향마다 마음이 달라요",
      desc: `${net[hl.crush.from]}→${net[hl.crush.to]} ${hl.crush.high}%, ${net[hl.crush.to]}→${net[hl.crush.from]} ${hl.crush.low}%. 이게 짝사랑이에요`,
      duration: 3600,
      play(stage) {
        const e = edge(hl.crush.from, hl.crush.to, 36);
        const back = edge(hl.crush.to, hl.crush.from, 36);
        // 두 화살표를 살짝 벌려서 그린다
        const off = 9;
        const nx = -e.uy * off;
        const ny = e.ux * off;
        const mx = (e.x1 + e.x2) / 2;
        const my = (e.y1 + e.y2) / 2;
        const head = (x, y, ux, uy) =>
          `M${x - ux * 12 - uy * 8} ${y - uy * 12 + ux * 8} L${x} ${y} L${x - ux * 12 + uy * 8} ${y - uy * 12 - ux * 8}`;
        stage.innerHTML = `<div class="scene"><svg viewBox="0 0 ${W} ${H}">
          ${linesSVG("is-dim", 0)}
          <path class="net-arrow-back" d="M${back.x1 - nx} ${back.y1 - ny} L${back.x2 - nx} ${back.y2 - ny}"/>
          <path class="net-arrow is-draw" d="M${e.x1 + nx} ${e.y1 + ny} L${e.x2 + nx} ${e.y2 + ny} ${head(e.x2 + nx, e.y2 + ny, e.ux, e.uy).replace("M", "M")}"/>
          ${nodesSVG(0)}
          <text class="net-label net-label--hot" x="${mx + nx * 2.6}" y="${my + ny * 2.6}">${hl.crush.high}%</text>
          <text class="net-label net-label--cold" x="${mx - nx * 2.6}" y="${my - ny * 2.6}">${hl.crush.low}%</text>
          <g class="net-tag" style="animation-delay:700ms"><rect x="${W / 2 - 70}" y="${H - 14}" width="140" height="40" rx="4" transform="rotate(-3 ${W / 2} ${H + 6})"/><rect class="tape" x="${W / 2 - 22}" y="${H - 24}" width="44" height="16" transform="rotate(7 ${W / 2} ${H - 16})"/><text x="${W / 2}" y="${H + 6}" transform="rotate(-3 ${W / 2} ${H + 6})">💔 짝사랑 발견!</text></g>
        </svg></div>`;
      },
    },
  ].map((sc) => ({
    ...sc,
    play(stage, signal) {
      kinetic();
      sc.play(stage, signal);
    },
  }));
}

/* =========================================================
 * 이름 입력
 * ========================================================= */
const nameInput = $("#nameInput");

function addNames(text) {
  const parsed = parseNames(text);
  const warns = [];
  let added = 0;
  for (let raw of parsed) {
    raw = Array.from(raw).slice(0, 10).join("");
    const h = hangulOnly(raw);
    if (!h) {
      warns.push(`${raw}: 한글이 없어서 뺐어요`);
      continue;
    }
    if (names.includes(raw)) {
      warns.push(`${raw}: 이미 있어요`);
      continue;
    }
    if (names.length >= MAX) {
      warns.push(`최대 ${MAX}명까지예요`);
      break;
    }
    if (h !== raw) warns.push(`${raw}: 한글(${h})만 계산해요`);
    names.push(raw);
    added++;
  }
  renderChips();
  const help = $("#nameHelp");
  const field = $("#nameField");
  if (warns.length) {
    help.textContent = warns.slice(0, 3).join(" · ");
    field.classList.toggle("is-error", !added);
  } else {
    help.textContent = "이름을 누르면 고칠 수 있어요";
    field.classList.remove("is-error");
  }
  if (added) haptic(8);
  return added;
}

function renderChips() {
  $("#chips").innerHTML = names
    .map(
      (n, i) => `<span class="name-chip ${hangulOnly(n) !== n ? "is-warn" : ""}" style="--r:${((i * 37) % 7) - 3}deg">
        <button class="name-chip__name" data-edit="${i}" aria-label="${esc(n)} 고치기">${esc(n)}</button>
        <button class="name-chip__x" data-del="${i}" aria-label="${esc(n)} 빼기">×</button>
      </span>`
    )
    .join("");
  $("#count").textContent = `${names.length} / ${MAX}명`;
  $("#makeBtn").disabled = names.length < 2;
  $("#makeBtn").textContent = names.length < 2 ? "두 명 이상 넣어 주세요" : `${names.length}명 궁합표 만들기`;
}

function bindInput() {
  $$(".seg__btn").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
  const commit = () => {
    if (!nameInput.value.trim()) return;
    if (addNames(nameInput.value)) nameInput.value = "";
    nameInput.focus();
  };
  $("#addBtn").addEventListener("click", commit);
  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.isComposing) {
      e.preventDefault();
      commit();
    }
  });
  nameInput.addEventListener("paste", (e) => {
    const text = e.clipboardData?.getData("text");
    if (text && /[,\n·\s]/.test(text.trim())) {
      e.preventDefault();
      addNames(text);
    }
  });
  // 쉼표/스페이스를 치면 바로 칩으로
  nameInput.addEventListener("input", () => {
    if (/[,\n·]$/.test(nameInput.value)) commit();
  });
  $("#chips").addEventListener("click", (e) => {
    const del = e.target.closest("[data-del]");
    const edit = e.target.closest("[data-edit]");
    if (del) {
      names.splice(Number(del.dataset.del), 1);
      renderChips();
    } else if (edit) {
      const i = Number(edit.dataset.edit);
      nameInput.value = names[i];
      names.splice(i, 1);
      renderChips();
      nameInput.focus();
      nameInput.select();
    }
  });
  $("#sampleBtn").addEventListener("click", () => {
    names = [];
    addNames(SAMPLE.join(","));
    title = "";
    roomId = null;
  });
  $("#clearBtn").addEventListener("click", () => {
    names = [];
    title = "";
    roomId = null;
    renderChips();
  });
  $("#makeBtn").addEventListener("click", () => {
    if (nameInput.value.trim()) addNames(nameInput.value), (nameInput.value = "");
    if (names.length >= 2) openResult(names.slice());
  });

  // 1:1
  const oneCheck = () => {
    const a = $("#oneA").value.trim();
    const b = $("#oneB").value.trim();
    const ok = hangulOnly(a) && hangulOnly(b) && a !== b;
    $("#oneBtn").disabled = !ok;
    const help = $("#oneHelp");
    if ((a && !hangulOnly(a)) || (b && !hangulOnly(b))) help.textContent = "한글이 들어간 이름만 계산할 수 있어요";
    else if (a && b && a === b) help.textContent = "서로 다른 두 이름을 넣어 주세요";
    else if ((a && hangulOnly(a) !== a) || (b && hangulOnly(b) !== b)) help.textContent = "한글이 아닌 글자는 빼고 계산해요";
    else help.textContent = "한글 이름만 계산해요";
  };
  $("#oneA").addEventListener("input", oneCheck);
  $("#oneB").addEventListener("input", oneCheck);
  $("#oneBtn").addEventListener("click", () => {
    title = "";
    roomId = null;
    openResult([$("#oneA").value.trim(), $("#oneB").value.trim()]);
  });
}

function setMode(m) {
  mode = m;
  $$(".seg__btn").forEach((b) => {
    const on = b.dataset.mode === m;
    b.classList.toggle("is-on", on);
    b.setAttribute("aria-selected", String(on));
  });
  $("#groupPane").hidden = m !== "group";
  $("#onePane").hidden = m !== "one";
}

function openInput(m = mode) {
  setMode(m);
  renderChips();
  renderRooms();
  showView("input");
}

/* =========================================================
 * 저장한 방
 * ========================================================= */
const getRooms = () => store.get("rooms", []);
function renderRooms() {
  const rooms = getRooms();
  $("#roomsWrap").hidden = !rooms.length;
  $("#rooms").innerHTML = rooms
    .map((r) => {
      const t = ROOM_TYPES.find((x) => x.key === r.type) || ROOM_TYPES[3];
      return `<div class="room">
        <button class="room__open" data-room="${r.id}">
          <span class="room__emoji" aria-hidden="true">${t.emoji}</span>
          <span class="grow"><span class="room__name">${esc(r.title)}</span><span class="room__meta">${t.name} · ${r.names.length}명 · ${esc(r.names.join(", "))}</span></span>
        </button>
        <button class="btn btn--ghost btn--icon" data-room-del="${r.id}" aria-label="${esc(r.title)} 지우기">×</button>
      </div>`;
    })
    .join("");
}

function bindRooms() {
  $("#rooms").addEventListener("click", (e) => {
    const open = e.target.closest("[data-room]");
    const del = e.target.closest("[data-room-del]");
    if (open) {
      const r = getRooms().find((x) => x.id === open.dataset.room);
      if (!r) return;
      title = r.title;
      roomId = r.id;
      names = r.names.slice();
      openResult(r.names.slice());
    } else if (del) {
      store.set(
        "rooms",
        getRooms().filter((x) => x.id !== del.dataset.roomDel)
      );
      renderRooms();
      toast("방을 지웠어요");
    }
  });

  let type = "friends";
  const renderTypes = () => {
    $("#roomTypes").innerHTML = ROOM_TYPES.map(
      (t) => `<button class="chip" data-type="${t.key}" aria-pressed="${t.key === type}">${t.emoji} ${t.name}</button>`
    ).join("");
  };
  $("#roomTypes").addEventListener("click", (e) => {
    const b = e.target.closest("[data-type]");
    if (!b) return;
    type = b.dataset.type;
    renderTypes();
  });
  let closeSheet = null;
  $("#saveRoomBtn").addEventListener("click", () => {
    const existing = getRooms().find((r) => r.id === roomId);
    type = existing?.type || "friends";
    $("#roomName").value = existing?.title || title || "";
    renderTypes();
    closeSheet = openSheet($("#roomSheet"));
    setTimeout(() => $("#roomName").focus(), 350);
  });
  $("#roomSave").addEventListener("click", () => {
    const t = $("#roomName").value.trim() || `${current.names.length}명의 방`;
    const rooms = getRooms().filter((r) => r.id !== roomId);
    roomId = roomId || `r${Date.now().toString(36)}`;
    rooms.unshift({ id: roomId, title: t, type, names: current.names, at: Date.now() });
    store.set("rooms", rooms.slice(0, 20));
    title = t;
    $("#resultTitle").textContent = t;
    closeSheet?.();
    toast("방을 저장했어요");
    haptic(12);
  });
}

/* =========================================================
 * 결과
 * ========================================================= */
function openResult(list, { shared = false } = {}) {
  const m = matrix(list);
  const hl = highlights(list, m);
  current = { names: list, m, hl };
  $("#sharedNote").hidden = !shared;
  const isPair = list.length === 2;
  $("#resultKicker").textContent = isPair ? "1:1 이름궁합" : `${list.length}명 단톡방 궁합표`;
  $("#resultTitle").innerHTML = isPair
    ? `${esc(list[0])} ${pixelHeart(22)} ${esc(list[1])}`
    : `<span class="mark">${esc(title || "우리 방 궁합표")}</span>`;
  $("#matrixCard").hidden = isPair;
  $("#pairView").hidden = !isPair;
  $("#saveRoomBtn").hidden = isPair;
  showView("result");
  if (isPair) renderPair(list);
  else {
    renderMatrix(list, m);
    renderHighlights(list, hl);
  }
  history.replaceState(null, "", urlWith({ n: encodeState(title ? { n: list, t: title } : { n: list }) }));
}

function renderMatrix(list, m) {
  const el = $("#matrix");
  const n = list.length;
  el.style.setProperty("--n", n);
  el.classList.toggle("is-dense", n >= 9);
  el.style.setProperty("--head", n >= 9 ? "44px" : "56px");
  let html = `<div class="mx-corner">→</div>`;
  html += list.map((nm) => `<div class="mx-col" title="${esc(nm)}">${esc(shortName(nm))}</div>`).join("");
  list.forEach((rowName, i) => {
    html += `<div class="mx-row" title="${esc(rowName)}">${esc(shortName(rowName))}</div>`;
    list.forEach((colName, j) => {
      if (i === j) {
        html += `<div class="mx-cell is-self" aria-hidden="true">${pixelHeart(12)}</div>`;
      } else {
        const v = m[i][j];
        html += `<button class="mx-cell ${v >= 60 ? "is-hot" : ""}" style="--p:${v};transition-delay:${(i + j) * 28}ms" data-i="${i}" data-j="${j}" aria-label="${esc(rowName)}→${esc(colName)} ${v}%">${v}</button>`;
      }
    });
  });
  el.innerHTML = html;
  requestAnimationFrame(() => requestAnimationFrame(() => $$(".mx-cell", el).forEach((c) => c.classList.add("is-in"))));
}

function hlCard({ emoji, kicker, main, sub, i, j, cls = "", delay = 0 }) {
  return `<button class="hl ${cls}" data-i="${i}" data-j="${j}" style="animation-delay:${delay}ms">
    <span class="hl__emoji" aria-hidden="true">${emoji}</span>
    <span class="hl__body"><span class="hl__kicker">${kicker}</span><span class="hl__main">${main}</span><span class="hl__sub">${sub}</span></span>
  </button>`;
}

function renderHighlights(list, hl) {
  const N = (i) => esc(list[i]);
  const m = current.m;
  const cards = [
    hlCard({
      emoji: "🏆",
      kicker: "이 방 최고의 커플",
      main: `${N(hl.best.i)} & ${N(hl.best.j)}`,
      sub: `서로 평균 <b>${Math.round(hl.best.avg)}%</b> · ${N(hl.best.i)}→${N(hl.best.j)} ${hl.best.ab}% / 반대로 ${hl.best.ba}%`,
      i: hl.best.i,
      j: hl.best.j,
      cls: "hl--best",
    }),
    hlCard({
      emoji: "😢",
      kicker: "짝사랑 주의",
      main: `${N(hl.crush.from)} → ${N(hl.crush.to)}`,
      sub: `${N(hl.crush.from)}→${N(hl.crush.to)} <b>${hl.crush.high}%</b> · ${N(hl.crush.to)}→${N(hl.crush.from)} <b class="is-low">${hl.crush.low}%</b>`,
      i: hl.crush.from,
      j: hl.crush.to,
      cls: "hl--crush",
      delay: 80,
    }),
    hlCard({
      emoji: "⭐",
      kicker: "인기왕 · 받은 마음이 제일 커요",
      main: N(hl.popular),
      sub: `다들 평균 <b>${Math.round(hl.received[hl.popular])}%</b>로 생각해요`,
      i: bestFrom(m, hl.popular),
      j: hl.popular,
      delay: 160,
    }),
    hlCard({
      emoji: "🧊",
      kicker: "철벽 · 준 마음이 제일 작아요",
      main: N(hl.wall),
      sub: `평균 <b>${Math.round(hl.given[hl.wall])}%</b>만 내줘요. 마음의 문이 단단해요`,
      i: hl.wall,
      j: worstTo(m, hl.wall),
      delay: 240,
    }),
    hlCard({
      emoji: "💔",
      kicker: "최악의 조합",
      main: `${N(hl.worst.i)} & ${N(hl.worst.j)}`,
      sub: `서로 평균 <b>${Math.round(hl.worst.avg)}%</b> · 그래도 친구는 할 수 있어요`,
      i: hl.worst.i,
      j: hl.worst.j,
      delay: 320,
    }),
  ];
  $("#highlights").innerHTML = cards.join("");
}

// j를 가장 높게 생각하는 사람
function bestFrom(m, j) {
  let best = j === 0 ? 1 : 0;
  m.forEach((row, i) => {
    if (i !== j && row[j] > m[best][j]) best = i;
  });
  return best;
}
// i가 가장 낮게 생각하는 사람
function worstTo(m, i) {
  let w = i === 0 ? 1 : 0;
  m[i].forEach((v, j) => {
    if (j !== i && v < m[i][w]) w = j;
  });
  return w;
}

function renderPair([a, b]) {
  const ab = match(a, b).score;
  const ba = match(b, a).score;
  const gap = Math.abs(ab - ba);
  const avg = Math.round((ab + ba) / 2);
  let verdict;
  if (gap >= 40) verdict = `😢 짝사랑 주의! ${josa(ab > ba ? a : b, "이/가")} 훨씬 더 생각하고 있어요`;
  else if (avg >= 80) verdict = "💞 서로 마음이 통하는 사이예요";
  else if (avg >= 50) verdict = "🙂 무난하게 잘 맞는 사이예요";
  else verdict = "🤝 우정부터 차근차근 쌓아봐요";
  const dir = (x, y, s, cls) => `<button class="dir ${cls}" data-a="${esc(x)}" data-b="${esc(y)}">
      <span class="dir__who"><b>${esc(x)}</b> → <b>${esc(y)}</b></span>
      <span class="dir__score t-num" data-to="${s}">0<small>%</small></span>
      <span class="dir__bar"><span style="--w:${s}%"></span></span>
      <span class="dir__msg">${comment(s)} · 눌러서 계산 과정 보기</span>
    </button>`;
  $("#pairView").innerHTML = `${dir(a, b, ab, "dir--a")}${dir(b, a, ba, "dir--b")}
    <div class="verdict"><p class="t-body-01-strong">${verdict}</p><p class="t-caption-01 t-secondary">두 방향 평균 ${avg}% · 차이 ${gap}%p</p></div>`;
  $("#highlights").innerHTML = "";
  requestAnimationFrame(() => {
    $$(".dir__bar span").forEach((s) => (s.style.width = s.style.getPropertyValue("--w")));
    $$(".dir__score").forEach((el) => countTo(el, Number(el.dataset.to)));
  });
}

function countTo(el, to) {
  if (prefersReducedMotion()) {
    el.innerHTML = `${to}<small>%</small>`;
    return;
  }
  const t0 = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - t0) / 900);
    const e = 1 - Math.pow(1 - t, 3);
    el.innerHTML = `${Math.round(to * e)}<small>%</small>`;
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* =========================================================
 * 피라미드 시트
 * ========================================================= */
let pyrPair = null;
let pyrTimers = [];

function openPyramid(a, b) {
  pyrPair = [a, b];
  renderPyramid(a, b);
  openSheet($("#pyrSheet"));
}

function renderPyramid(a, b) {
  pyrTimers.forEach(clearTimeout);
  pyrTimers = [];
  const r = match(a, b);
  $("#pyrKicker").textContent = `${josa(a, "이/가")} ${josa(b, "을/를")} 생각하는 마음`;
  $("#pyrTitle").textContent = `${a} → ${b}`;
  const L = r.letters.length;
  const avail = Math.min(window.innerWidth, 480) - 32 - 24;
  const cell = Math.max(18, Math.min(36, Math.floor((avail - (L - 1) * 4) / L)));
  const pyr = $("#pyr");
  pyr.style.setProperty("--cell", `${cell}px`);
  pyr.innerHTML = `
    <div class="pyr__row is-letters">${r.letters.map((l) => `<span class="pyr__c is-${l.from}">${l.ch}</span>`).join("")}</div>
    <div class="pyr__strokes">${r.letters.map((l) => `<span>${l.strokes}획</span>`).join("")}</div>`;
  $("#pyrResult").innerHTML = "";
  const reduce = prefersReducedMotion();
  r.rows.forEach((row, k) => {
    const add = () => {
      const isFinal = k === r.rows.length - 1;
      pyr.insertAdjacentHTML(
        "beforeend",
        `<div class="pyr__row is-write ${isFinal ? "is-final" : ""}">${row.map((d) => `<span class="pyr__c">${d}</span>`).join("")}${isFinal ? circleSVG() : ""}</div>`
      );
      if (isFinal) {
        const done = () => {
          $("#pyrResult").innerHTML = `<div class="pyr-result__score">${r.score}%</div><p>${comment(r.score)}</p>`;
          haptic(20);
        };
        reduce ? done() : pyrTimers.push(setTimeout(done, 380));
      }
    };
    reduce ? add() : pyrTimers.push(setTimeout(add, 350 + k * 380));
  });
}

/* =========================================================
 * 공유
 * ========================================================= */
function shareLink() {
  const list = current.names;
  const isPair = list.length === 2;
  const text = isPair
    ? `${list[0]}→${list[1]} ${current.m[0][1]}%, ${list[1]}→${list[0]} ${current.m[1][0]}% 💞 이름궁합 결과 봐봐`
    : `우리 단톡방 ${list.length}명 이름궁합표 나왔어요 💞 최고의 커플은 ${list[current.hl.best.i]} & ${list[current.hl.best.j]}!`;
  share({
    title: "단톡방 궁합표",
    text,
    url: urlWith({ n: encodeState(title && !isPair ? { n: list, t: title } : { n: list }) }),
  });
}

function css(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function mixHex(a, b, t) {
  const p = (h) => {
    h = h.replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  const A = p(a);
  const B = p(b);
  return `rgb(${A.map((v, i) => Math.round(v * (1 - t) + B[i] * t)).join(",")})`;
}

function drawShare() {
  const W = 540;
  const H = 675;
  const { canvas, ctx } = createCanvas(W, H, 2);
  const brand = css("--brand", "#ff5c8a");
  const soft = css("--brand-soft", "#ffe9ef");
  const paper = css("--gray-0", "#ffffff");
  const line = css("--gray-200", "#e3e6eb");
  const ink = css("--gray-900", "#12151b");
  const sub = css("--gray-500", "#7b8494");
  const sunken = css("--gray-100", "#f0f2f5");
  const display = css("--font-display", "") || CANVAS_FONT;
  const list = current.names;
  const n = list.length;

  // 모눈 노트 배경
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = soft;
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += 18) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(W, y + 0.5);
    ctx.stroke();
  }
  // 왼쪽 여백선
  ctx.strokeStyle = brand;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(30.5, 0);
  ctx.lineTo(30.5, H);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const text = (t, x, y, { size = 16, weight = 600, color = ink, align = "left", font = CANVAS_FONT } = {}) => {
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(t, x, y);
    return ctx.measureText(t).width;
  };
  const highlight = (x, y, w) => {
    ctx.fillStyle = brand;
    ctx.globalAlpha = 0.28;
    ctx.fillRect(x - 4, y - 12, w + 8, 14);
    ctx.globalAlpha = 1;
  };

  const heading = n === 2 ? "1:1 이름궁합" : title || "우리 방 궁합표";
  ctx.font = `700 34px ${display}, ${CANVAS_FONT}`;
  const hw = ctx.measureText(heading).width;
  highlight(48, 70, Math.min(hw, W - 100));
  text(heading, 48, 70, { size: 34, weight: 700, font: `${display}, ${CANVAS_FONT}` });
  text(n === 2 ? "이름 획수로 보는 두 사람의 마음" : `${n}명 단톡방 궁합표 · 가로 → 세로로 생각하는 마음`, 48, 98, { size: 14, weight: 500, color: sub });

  if (n === 2) {
    const [a, b] = list;
    const rows = [
      [a, b, current.m[0][1]],
      [b, a, current.m[1][0]],
    ];
    rows.forEach(([x, y, s], k) => {
      const top = 140 + k * 200;
      ctx.fillStyle = k ? sunken : soft;
      roundRect(ctx, 48, top, W - 96, 170, 20);
      ctx.fill();
      text(`${x} → ${y}`, 72, top + 44, { size: 22, weight: 700 });
      text(`${s}%`, 72, top + 120, { size: 72, weight: 800, color: brand, font: `${display}, ${CANVAS_FONT}` });
      text(comment(s), W - 72, top + 120, { size: 16, weight: 600, color: sub, align: "right" });
    });
    const gap = Math.abs(current.m[0][1] - current.m[1][0]);
    text(gap >= 40 ? "😢 짝사랑 주의!" : "💞 두 방향 평균 " + Math.round((current.m[0][1] + current.m[1][0]) / 2) + "%", W / 2, 590, {
      size: 22,
      weight: 700,
      align: "center",
    });
  } else {
    // 매트릭스
    const area = 360;
    const head = 54;
    const cell = Math.min(44, Math.floor((area - head) / n));
    const gridW = head + cell * n;
    const ox = Math.round((W - gridW) / 2);
    const oy = 124;
    const fs = n >= 9 ? 11 : 13;
    list.forEach((nm, j) => {
      text(shortName(nm), ox + head + j * cell + cell / 2, oy + 16, { size: fs, weight: 700, color: sub, align: "center" });
    });
    list.forEach((nm, i) => {
      const y = oy + 24 + i * cell;
      text(shortName(nm), ox + head - 6, y + cell / 2 + 5, { size: fs, weight: 700, color: sub, align: "right" });
      list.forEach((_, j) => {
        const x = ox + head + j * cell;
        if (i === j) return;
        const v = current.m[i][j];
        ctx.fillStyle = mixHex(sunken, brand, (v / 100) * 0.9);
        roundRect(ctx, x + 1, y + 1, cell - 2, cell - 2, 5);
        ctx.fill();
        text(String(v), x + cell / 2, y + cell / 2 + 5, { size: fs + 1, weight: 700, color: v >= 60 ? "#fff" : ink, align: "center" });
      });
    });
    // 하이라이트 (스티커)
    const hl = current.hl;
    const N = (i) => list[i];
    const items = [
      ["🏆 최고의 커플", `${N(hl.best.i)} & ${N(hl.best.j)} ${Math.round(hl.best.avg)}%`],
      ["😢 짝사랑", `${N(hl.crush.from)}→${N(hl.crush.to)} ${hl.crush.high}% / ${hl.crush.low}%`],
      ["⭐ 인기왕", `${N(hl.popular)} 평균 ${Math.round(hl.received[hl.popular])}%`],
      ["🧊 철벽", `${N(hl.wall)} 평균 ${Math.round(hl.given[hl.wall])}%`],
    ];
    let y = oy + 24 + n * cell + 24;
    const bw = (W - 96 - 12) / 2;
    const bh = 62;
    items.forEach(([k, v], idx) => {
      const x = 48 + (idx % 2) * (bw + 12);
      const yy = y + Math.floor(idx / 2) * (bh + 12);
      ctx.save();
      ctx.translate(x + bw / 2, yy + bh / 2);
      ctx.rotate(((idx % 2 ? 1 : -1) * 1.2 * Math.PI) / 180);
      ctx.fillStyle = idx % 2 ? sunken : soft;
      roundRect(ctx, -bw / 2, -bh / 2, bw, bh, 10);
      ctx.fill();
      ctx.restore();
      text(k, x + 14, yy + 25, { size: 13, weight: 600, color: sub });
      ctx.font = `700 15px ${CANVAS_FONT}`;
      let vv = v;
      while (ctx.measureText(vv).width > bw - 28 && vv.length > 4) vv = vv.slice(0, -2) + "…";
      text(vv, x + 14, yy + 47, { size: 15, weight: 700 });
    });
  }
  ctx.strokeStyle = line;
  text("단톡방 궁합표 · 이름 획수로 보는 재미용 테스트", W / 2, H - 22, { size: 12, weight: 500, color: sub, align: "center" });
  return canvas;
}

/* =========================================================
 * 시작
 * ========================================================= */
function bindResult() {
  $("#matrix").addEventListener("click", (e) => {
    const c = e.target.closest(".mx-cell[data-i]");
    if (!c) return;
    haptic(8);
    openPyramid(current.names[c.dataset.i], current.names[c.dataset.j]);
  });
  $("#highlights").addEventListener("click", (e) => {
    const c = e.target.closest(".hl");
    if (!c) return;
    openPyramid(current.names[c.dataset.i], current.names[c.dataset.j]);
  });
  $("#pairView").addEventListener("click", (e) => {
    const c = e.target.closest(".dir");
    if (c) openPyramid(c.dataset.a, c.dataset.b);
  });
  $("#pyrFlip").addEventListener("click", () => {
    if (!pyrPair) return;
    pyrPair = [pyrPair[1], pyrPair[0]];
    renderPyramid(...pyrPair);
  });
  $("#backBtn").addEventListener("click", () => {
    if (current.names.length === 2 && !roomId) {
      $("#oneA").value = current.names[0];
      $("#oneB").value = current.names[1];
      $("#oneBtn").disabled = false;
      openInput("one");
    } else {
      names = current.names.slice();
      openInput("group");
    }
  });
  $("#againBtn").addEventListener("click", () => {
    names = [];
    title = "";
    roomId = null;
    history.replaceState(null, "", location.pathname);
    openInput("group");
  });
  $("#shareLink").addEventListener("click", shareLink);
  $("#shareImg").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.classList.add("is-loading");
    try {
      await shareImage(drawShare(), { filename: "단톡방-궁합표.png", text: "우리 단톡방 이름궁합표 💞" });
    } finally {
      btn.classList.remove("is-loading");
    }
  });
}

function init() {
  renderMoreSites($("#more"), "name-match");
  bindInput();
  bindRooms();
  bindResult();

  // 공유 링크로 들어오면 바로 같은 표를 보여준다
  const st = getParam("n") && decodeState(getParam("n"));
  const list = Array.isArray(st?.n) ? st.n.map(String).filter((x) => hangulOnly(x)).slice(0, MAX) : null;
  if (list && list.length >= 2) {
    title = typeof st.t === "string" ? st.t.slice(0, 20) : "";
    names = list.slice();
    openResult(list, { shared: true });
    return;
  }

  const intro = runIntro({ root: $("#intro"), scenes: introScenes() });
  $("#start").addEventListener("click", () => {
    intro.stop();
    openInput("group");
  });
  $("#startOne").addEventListener("click", () => {
    intro.stop();
    openInput("one");
  });
}

init();
