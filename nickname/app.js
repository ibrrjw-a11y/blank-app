// 랜덤 닉네임 생성기 화면. 계산은 core.js, 단어장은 words.js
import { $, share, toast, renderMoreSites, prefersReducedMotion, ROOT_URL, getParam, haptic } from "../shared/kit.js";
import { MOODS, COMBOS, moodOf, generate, lenCounts, hearts, toggleHeart, isHearted, makeChallenge, decodeChallenge, cleanName, guessKey, store } from "./core.js";

const RM = prefersReducedMotion();
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const S = { mood: "cute", len: 0, combo: "an", items: [], picked: null };
let mk = { sel: [], real: null };
let G = null; // 친구 링크: { code, cands, ans, by }

// 받침 있으면 '이', 없으면 '가'(한글이 아니면 '가')
const iga = (n) => { const c = n.charCodeAt(n.length - 1); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? "이" : "가"; };
function show(v) { for (const id of ["maker", "make", "guess"]) $("#" + id).hidden = id !== v; scrollTo({ top: 0 }); }

/* ---------- 슬롯 이름표: 이름들이 위로 굴러가다 target 에서 멈춤 ---------- */
const spins = new WeakMap();
// 이름 길이에 맞춰 글자 크기를 줄여 이름표 밖으로 안 나가게(한글은 글자 하나 ≈ 1칸, 알파벳은 ≈ 0.62칸)
function itemHTML(t) {
  const w = /^[A-Za-z]+$/.test(t) ? t.length * 0.62 : [...t].length;
  return `<span class="reel__item" style="font-size:min(40px,calc((min(100vw,480px) - 96px) / ${Math.max(w, 1).toFixed(2)}))">${esc(t)}</span>`;
}
function spinTo(reel, target, from = [], done) {
  const tag = reel.closest(".tag");
  clearTimeout(spins.get(reel));
  const fin = () => {
    reel.innerHTML = itemHTML(target);
    tag.dataset.state = "done";
    if (!RM) { tag.classList.remove("is-stamp"); void tag.offsetWidth; tag.classList.add("is-stamp"); }
    done?.();
  };
  if (RM) { fin(); return; }
  const others = from.filter((t) => t !== target);
  const strip = [];
  for (let k = 0; k < 14; k++) strip.push(others.length ? others[(Math.random() * others.length) | 0] : "???");
  strip.push(target);
  tag.dataset.state = "spin";
  reel.innerHTML = `<div class="reel__strip">${strip.map(itemHTML).join("")}</div>`;
  const st = reel.firstElementChild;
  requestAnimationFrame(() => requestAnimationFrame(() => { st.style.transform = `translateY(calc(-${strip.length - 1} * var(--reel-h)))`; }));

  spins.set(reel, setTimeout(fin, 1500));
}

// 작은 이름표(두 줄 판)의 글자 크기: 칸 폭 ≈ (화면 - 42px) / 2 에서 하트 칸·여백 60px 를 뺀 만큼에 이름이 한 줄로 들어가게
function smallFs(t) {
  const w = /^[A-Za-z]+$/.test(t) ? t.length * 0.62 : [...t].length;
  return `min(18px, calc(((min(100vw, 480px) - 42px) / 2 - 60px) / ${Math.max(w, 1).toFixed(2)}))`;
}

/* ---------- 고르는 칸 ---------- */
function chip(group, val, label, on, dis = false, extra = "") {
  return `<button type="button" class="opt${on ? " is-on" : ""}" role="radio" aria-checked="${on}" data-${group}="${val}"${dis ? " disabled" : ""}${extra}>${label}</button>`;
}
function renderPick() {
  $(".nk").dataset.mood = S.mood;
  $("#moods").innerHTML = MOODS.map((m) => chip("mood", m.id, m.name, m.id === S.mood)).join("");
  const counts = lenCounts(S.mood, S.combo);
  if (S.len && !counts.find((c) => c.len === S.len && c.n > 0)) S.len = 0;
  const unit = moodOf(S.mood).lang === "en" ? "" : "자";
  $("#lens").innerHTML = chip("len", 0, "상관없음", S.len === 0) + counts.map((c) => chip("len", c.len, `${c.len}${unit}`, c.len === S.len, c.n === 0, c.n === 0 ? ' title="이 조합으로는 못 만들어요"' : "")).join("");
  $("#combos").innerHTML = COMBOS.map((c) => chip("combo", c.id, c.name, c.id === S.combo)).join("");
}

/* ---------- 뽑기 ---------- */
function gen() {
  const r = generate({ mood: S.mood, combo: S.combo, len: S.len });
  S.items = r.items.map((x) => ({ ...x, mood: S.mood }));
  S.picked = null;
  const n = S.items.length;
  $("#note").textContent = n === 0 ? "이 조건으로는 만들 수 없어요. 글자 수나 붙이는 방식을 바꿔 보세요" : n < 10 ? `이 조건으로는 ${n}개만 나와요` : "";
  renderList(true);
  if (n) spinTo($("#reel"), S.items[0].text, S.items.map((x) => x.text));
}
function heartBtn(t, mood) {
  const on = isHearted(t);
  return `<button type="button" class="heart${on ? " is-on" : ""}" data-heart="${esc(t)}" data-m="${mood}" aria-pressed="${on}" aria-label="${esc(t)} 하트">♥</button>`;
}
function renderList(fresh = false) {
  $("#list").innerHTML = S.items.map((x, i) => `<li class="stk${fresh && !RM ? " is-slap" : ""}${S.picked === x.text ? " is-picked" : ""}" style="--i:${i};--r:${((i * 37) % 7) - 3}deg">
      <button type="button" class="stk__name" data-pick="${esc(x.text)}" style="font-size:${smallFs(x.text)}">${esc(x.text)}</button>${heartBtn(x.text, x.mood)}</li>`).join("");
}
function renderHearts() {
  const hs = hearts();
  $("#heartN").textContent = hs.length;
  $("#hearts").innerHTML = hs.length ? hs.map((h) => `<li class="mini__i" data-m="${h.m}"><button type="button" class="mini__t" data-pick="${esc(h.t)}">${esc(h.t)}</button>${heartBtn(h.t, h.m)}</li>`).join("")
    : `<li class="mini__empty">아직 없어요. 이름표 옆 ♥를 눌러 보관해요.</li>`;
  $("#makeBtn").disabled = hs.length < 3;
}

/* ---------- 맞혀 봐 만들기 ---------- */
function openMake() {
  const hs = hearts();
  if (hs.length < 3) return;
  mk = { sel: mk.sel.filter((t) => hs.some((h) => h.t === t)), real: null };
  $("#byName").value = store.get("name", "");
  renderMake();
  show("make");
}
function renderMake() {
  const hs = hearts();
  if (!mk.sel.includes(mk.real)) mk.real = null;
  $("#mkN").textContent = `${mk.sel.length} / 3`;
  $("#mkList").innerHTML = hs.map((h) => {
    const on = mk.sel.includes(h.t), full = mk.sel.length >= 3 && !on;
    return `<li class="mini__i" data-m="${h.m}"><button type="button" class="mini__t mini__sel${on ? " is-on" : ""}" data-sel="${esc(h.t)}" aria-pressed="${on}"${full ? " disabled" : ""}>${esc(h.t)}</button></li>`;
  }).join("");
  $("#mkReal").innerHTML = mk.sel.length ? mk.sel.map((t) => chip("real", esc(t), esc(t), t === mk.real)).join("") : `<span class="mini__empty">후보를 먼저 골라요</span>`;
  $("#mshare").disabled = !(mk.sel.length === 3 && mk.real);
}

/* ---------- 친구 화면(맞혀 봐) ---------- */
function openGuess() {
  $("#gTitle").textContent = `${G.by ? `${G.by}${iga(G.by)}` : "친구가"} 고른 닉네임 3개, 진짜 쓸 건?`;
  const done = store.get(guessKey(G.code), null);
  $("#gCands").innerHTML = G.cands.map((t, i) => `<button type="button" class="stk stk--big" data-g="${i}" style="--i:${i};--r:${[-3, 2, -1][i]}deg"><span class="stk__name">${esc(t)}</span></button>`).join("");
  show("guess");
  if (done != null) reveal(done, false);
}
function reveal(pick, fresh) {
  const right = pick === G.ans;
  document.querySelectorAll("#gCands [data-g]").forEach((b) => { b.disabled = true; b.classList.toggle("is-mine", +b.dataset.g === pick); });
  const after = () => {
    document.querySelectorAll("#gCands [data-g]").forEach((b) => b.classList.toggle("is-real", +b.dataset.g === G.ans));
    const r = $("#gResult");
    r.hidden = false;
    r.className = `nk-result ${right ? "is-right" : "is-wrong"}`;
    r.textContent = right ? `맞혔어요. ${G.by || "친구"}의 진짜 닉네임은 ${G.cands[G.ans]}` : `아깝다. 진짜는 ${G.cands[G.ans]}`;
    if (fresh) haptic(right ? [20, 40, 20] : 30);
  };
  if (fresh) spinTo($("#greel"), G.cands[G.ans], G.cands, after);
  else { $("#greel").innerHTML = itemHTML(G.cands[G.ans]); $("#gtag").dataset.state = "done"; after(); }
}

/* ---------- 첫 화면 ---------- */
function init() {
  if (RM) document.documentElement.classList.add("rm");
  renderPick(); renderHearts();
  $("#moods").addEventListener("click", (e) => { const b = e.target.closest("[data-mood]"); if (!b) return; S.mood = b.dataset.mood; renderPick(); gen(); });
  $("#lens").addEventListener("click", (e) => { const b = e.target.closest("[data-len]"); if (!b || b.disabled) return; S.len = +b.dataset.len; renderPick(); gen(); });
  $("#combos").addEventListener("click", (e) => { const b = e.target.closest("[data-combo]"); if (!b) return; S.combo = b.dataset.combo; renderPick(); gen(); });
  $("#gen").addEventListener("click", gen);
  // 이름표 누르면 슬롯, 하트 누르면 보관
  const onSheet = (e) => {
    const h = e.target.closest("[data-heart]");
    if (h) {
      const added = toggleHeart(h.dataset.heart, h.dataset.m);
      document.querySelectorAll(`[data-heart="${CSS.escape(h.dataset.heart)}"]`).forEach((x) => { x.classList.toggle("is-on", added); x.setAttribute("aria-pressed", added); if (added && !RM) { x.classList.remove("is-pop"); void x.offsetWidth; x.classList.add("is-pop"); } });
      renderHearts();
      haptic(added ? 12 : 6);
      return;
    }
    const p = e.target.closest("[data-pick]");
    if (!p) return;
    S.picked = p.dataset.pick;
    document.querySelectorAll("#list .stk").forEach((li) => li.classList.toggle("is-picked", li.querySelector("[data-pick]").dataset.pick === S.picked));
    const pool = [...S.items.map((x) => x.text), ...hearts().map((h) => h.t)];
    spinTo($("#reel"), S.picked, pool);
    haptic(8);
    $("#tag").scrollIntoView?.({ block: "nearest", behavior: RM ? "auto" : "smooth" });
  };
  $("#list").addEventListener("click", onSheet);
  $("#hearts").addEventListener("click", onSheet);
  $("#makeBtn").addEventListener("click", openMake);
  $("#mkBack").addEventListener("click", () => { renderHearts(); renderList(); show("maker"); });
  $("#mkList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-sel]"); if (!b) return;
    const t = b.dataset.sel, i = mk.sel.indexOf(t);
    if (i >= 0) mk.sel.splice(i, 1); else if (mk.sel.length < 3) mk.sel.push(t);
    renderMake();
  });
  $("#mkReal").addEventListener("click", (e) => { const b = e.target.closest("[data-real]"); if (!b) return; mk.real = b.dataset.real; renderMake(); });
  $("#mshare").addEventListener("click", async () => {
    const by = cleanName($("#byName").value);
    store.set("name", by);
    const code = makeChallenge(mk.sel, mk.real, by);
    if (!code) { toast("이름에 쓸 수 없는 말이 있어요"); return; }
    const url = `${ROOT_URL}nickname/?q=${code}`;
    const r = await share({ title: "닉네임 맞혀 봐", text: `${by ? by + iga(by) : "내가"} 고른 닉네임 3개 중 진짜 쓸 거 맞혀 봐`, url });
    if (r === "shared") toast("보냈어요");
  });
  $("#gCands").addEventListener("click", (e) => {
    const b = e.target.closest("[data-g]"); if (!b || b.disabled) return;
    const pick = +b.dataset.g;
    store.set(guessKey(G.code), pick);
    reveal(pick, true);
  });
  $("#gAgain").addEventListener("click", () => { history.replaceState(null, "", location.pathname); show("maker"); gen(); });

  const q = getParam("q");
  if (q) {
    const c = decodeChallenge(q);
    if (c) { G = { code: q, ...c }; openGuess(); }
    else toast("링크가 깨졌어요. 친구에게 다시 받아 보세요");
  }
  gen();
  renderMoreSites($("#more"), "nickname");
}
if (typeof document !== "undefined" && document.getElementById("reel")) init();
