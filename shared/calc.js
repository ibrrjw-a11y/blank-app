// 생활 계산기 공용 틀(2026-10-07). 우리 방식 = '먼저 짐작 → 진짜 결과'
//  ① 숫자를 넣고 ② 결과를 보기 전에 "얼마일 것 같아?"를 막대로 찍고 ③ 결과가 숫자 굴림으로 뜨며 짐작과 몇 % 차이인지 보여 줌
//  ④ 친구에게 '같은 조건 + 내 짐작' 링크 → 친구도 짐작해 보고 누가 더 가까웠는지
//  계산 근거(법 조항·2026년 값·확정/추정)는 결과 아래 ⓘ 안에. 계산은 게임마다 compute(v) 하나만 넘김
import { $, share, toast, renderMoreSites, prefersReducedMotion, ROOT_URL, getParam, countUp, haptic } from "./kit.js";

export const won = (n) => `${Math.round(n).toLocaleString("ko-KR")}원`;
export const num = (n, d = 0) => Number(n).toLocaleString("ko-KR", { maximumFractionDigits: d });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/* cfg: { slug, title, fields:[{id,label,type:'money'|'number'|'select'|'date'|'yesno', def, unit, min, max, step, options:[[값,글]] , hint}],
 *        compute(v) → { value(짐작 대상 숫자), unit, fmt(값→글), headline, rows:[[이름, 값]], notes:[글], warn?:글 }
 *        guess: { label, range(v, r) → [최소, 최대] }  — 없으면 짐작 건너뜀
 *        basis: [[항목, 값, 근거, 판정]] — 이 계산기가 기대는 숫자와 출처, base: '2026-10 기준' 같은 기준일 } */
export function runCalc(cfg) {
  const RM = prefersReducedMotion();
  const form = $("#cform"), F = cfg.fields;
  const fmt = (r, x) => (r.fmt ? r.fmt(x) : r.unit === "원" ? won(x) : `${num(x, 1)}${r.unit || ""}`);

  // ---------- 입력 칸 ----------
  form.innerHTML = F.map((f) => {
    const id = `f_${f.id}`;
    let input;
    if (f.type === "select") input = `<select id="${id}">${f.options.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(f.def) ? " selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
    else if (f.type === "yesno") input = `<div class="cf-yn" id="${id}" data-v="${f.def ? 1 : 0}"><button type="button" data-v="1">예</button><button type="button" data-v="0">아니요</button></div>`;
    else if (f.type === "date") input = `<input id="${id}" type="date" value="${f.def || ""}">`;
    else input = `<div class="cf-num"><input id="${id}" inputmode="${f.type === "money" ? "numeric" : "decimal"}" value="${f.def != null ? (f.type === "money" ? num(f.def) : f.def) : ""}" placeholder="${esc(f.ph || "")}" autocomplete="off"><span>${esc(f.unit || "")}</span></div>`;
    const chips = f.chips ? `<div class="cf-chips">${f.chips.map((c) => `<button type="button" data-for="${id}" data-v="${c}">${f.type === "money" ? num(c) : c}${esc(f.chipUnit || "")}</button>`).join("")}</div>` : "";
    return `<label class="cf" for="${id}"><span class="cf-l">${esc(f.label)}</span>${input}${chips}${f.hint ? `<span class="cf-h">${esc(f.hint)}</span>` : ""}</label>`;
  }).join("");
  form.querySelectorAll(".cf-num input").forEach((el) => {
    const f = F.find((x) => `f_${x.id}` === el.id);
    if (f?.type === "money") el.addEventListener("input", () => { const d = el.value.replace(/[^0-9]/g, ""); el.value = d ? num(Number(d)) : ""; });
  });
  form.addEventListener("click", (e) => {
    const yn = e.target.closest(".cf-yn button");
    if (yn) { yn.parentElement.dataset.v = yn.dataset.v; paintYN(); }
    const ch = e.target.closest(".cf-chips button");
    if (ch) { const el = $("#" + ch.dataset.for); const f = F.find((x) => `f_${x.id}` === el.id); el.value = f.type === "money" ? num(Number(ch.dataset.v)) : ch.dataset.v; }
  });
  const paintYN = () => form.querySelectorAll(".cf-yn").forEach((g) => g.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.v === g.dataset.v)));
  paintYN();
  const read = () => {
    const v = {};
    for (const f of F) {
      const el = $(`#f_${f.id}`);
      if (f.type === "select") v[f.id] = el.value;
      else if (f.type === "yesno") v[f.id] = el.dataset.v === "1";
      else if (f.type === "date") v[f.id] = el.value;
      else v[f.id] = Number(String(el.value).replace(/[^0-9.\-]/g, ""));
    }
    return v;
  };
  const write = (v) => {
    for (const f of F) {
      if (v[f.id] == null) continue;
      const el = $(`#f_${f.id}`);
      if (f.type === "yesno") el.dataset.v = v[f.id] ? "1" : "0";
      else if (f.type === "money") el.value = num(v[f.id]);
      else el.value = v[f.id];
    }
    paintYN();
  };
  const check = (v) => {
    for (const f of F) {
      if (f.type === "select" || f.type === "yesno" || f.optional) continue;
      if (f.type === "date" ? !v[f.id] : !Number.isFinite(v[f.id]) || v[f.id] < (f.min ?? 0) || (f.max != null && v[f.id] > f.max)) return `${f.label}을(를) 확인해 주세요${f.max != null ? ` (${num(f.min ?? 0)}~${num(f.max)})` : ""}`;
    }
    return cfg.validate ? cfg.validate(v) : null;
  };

  // ---------- 짐작 → 결과 ----------
  let V = null, R = null, G = null, friend = null;
  function toGuess() {
    const v = read(), bad = check(v);
    if (bad) { const e = $("#cerr"); e.textContent = bad; e.hidden = false; return; }
    $("#cerr").hidden = true;
    V = v; R = cfg.compute(v);
    if (!cfg.guess || !Number.isFinite(R.value)) return reveal(null);
    const [lo, hi] = cfg.guess.range(v, R);
    const g = $("#guess");
    g.min = lo; g.max = hi; g.step = Math.max(1, Math.round((hi - lo) / 200));
    g.value = Math.round((lo + hi) / 2 + (hi - lo) * 0.13);  // 가운데보다 살짝 위(가운데=정답 힌트가 되지 않게)
    $("#gq").textContent = cfg.guess.label;
    paintGuess();
    show("cguess");
  }
  function paintGuess() { $("#gv").textContent = fmt(R, Number($("#guess").value)); }
  function reveal(guess) {
    G = guess;
    const r = R;
    $("#rhead").textContent = r.headline || cfg.title;
    const big = $("#rval");
    if (RM || !countUp || !Number.isFinite(r.value)) big.textContent = Number.isFinite(r.value) ? fmt(r, r.value) : r.text || "";
    else { big.textContent = fmt(r, 0); const t0 = performance.now(), D = 900; const tick = (t) => { const p = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - p, 3); big.textContent = fmt(r, r.value * e); if (p < 1) requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
    // 짐작 비교
    const gb = $("#rguess");
    if (guess != null && Number.isFinite(r.value)) {
      const off = r.value === 0 ? 0 : Math.abs(guess - r.value) / Math.abs(r.value) * 100;
      const word = off <= 3 ? "거의 정확!" : off <= 10 ? "꽤 가까워요" : off <= 30 ? "조금 빗나갔어요" : "많이 빗나갔어요";
      const lo = Math.min(guess, r.value) * 0.8, hi = Math.max(guess, r.value) * 1.2 || 1, pos = (x) => `${((x - lo) / (hi - lo)) * 100}%`;
      gb.innerHTML = `<div class="rg-t"><b>${word}</b><span>내 짐작 ${esc(fmt(r, guess))} · ${guess > r.value ? "더 크게" : guess < r.value ? "더 작게" : "딱 맞게"} 짐작 · ${num(off, 1)}% 차이</span></div>
        <div class="rg-bar"><i class="rg-me" style="left:${pos(guess)}"><em>짐작</em></i><i class="rg-real" style="left:${pos(r.value)}"><em>진짜</em></i></div>`
        + (friend ? `<p class="rg-f">${esc(friend.by || "친구")}의 짐작 ${esc(fmt(r, friend.g))} · ${Math.abs(friend.g - r.value) < Math.abs(guess - r.value) ? "친구가 더 가까웠어요" : Math.abs(friend.g - r.value) > Math.abs(guess - r.value) ? "내가 더 가까웠어요!" : "똑같이 가까웠어요"}</p>` : "");
      gb.hidden = false;
      haptic?.(off <= 3 ? [20, 40, 20] : 10);
    } else gb.hidden = true;
    $("#rrows").innerHTML = (r.rows || []).map(([k, x]) => `<div class="rr"><span>${esc(k)}</span><b>${esc(x)}</b></div>`).join("");
    $("#rnotes").innerHTML = (r.notes || []).map((n) => `<li>${esc(n)}</li>`).join("");
    $("#rwarn").hidden = !r.warn; $("#rwarn").textContent = r.warn || "";
    show("cres");
  }
  function show(id) { for (const s of ["cin", "cguess", "cres"]) $("#" + s).hidden = s !== id; $("#" + id).scrollIntoView({ block: "start", behavior: RM ? "auto" : "smooth" }); }

  // 근거 표(ⓘ 펼침)
  $("#cbasis").innerHTML = `<summary>계산 근거 · ${esc(cfg.base || "2026년 기준")}</summary><table><thead><tr><th>항목</th><th>값</th><th>근거</th><th>확인</th></tr></thead><tbody>${(cfg.basis || []).map((b) => `<tr>${b.map((x) => `<td>${esc(x)}</td>`).join("")}</tr>`).join("")}</tbody></table><p>참고용 계산이에요. 실제 금액은 회사·기관의 계산과 다를 수 있어요.</p>`;

  // ---------- 공유: 같은 조건 + 내 짐작 ----------
  const pack = (v, g) => btoa(unescape(encodeURIComponent(JSON.stringify({ v, g })))).replace(/=+$/, "");
  const unpack = (s) => { try { return JSON.parse(decodeURIComponent(escape(atob(s)))); } catch { return null; } };
  $("#cshare").addEventListener("click", async () => {
    const url = `${ROOT_URL}${cfg.slug}/?q=${encodeURIComponent(pack(V, G))}`;
    const text = G != null ? `${cfg.title} — 나는 ${fmt(R, G)}로 짐작했는데, 너는 얼마 같아?` : `${cfg.title} 결과 ${fmt(R, R.value)}`;
    const r = await share({ title: cfg.title, text, url });
    if (r === "shared") toast("보냈어요");
  });
  const q = getParam("q");
  if (q) {
    const d = unpack(q);
    if (d && d.v && typeof d.v === "object") {
      write(d.v);
      if (Number.isFinite(d.g)) { friend = { g: d.g }; const c = $("#cchal"); c.hidden = false; c.innerHTML = `<b>친구가 보낸 문제</b><span>같은 조건으로 먼저 짐작해 보고 누가 더 가까운지 봐요.</span>`; }
    }
  }

  $("#cgo").addEventListener("click", toGuess);
  $("#guess").addEventListener("input", paintGuess);
  $("#gok").addEventListener("click", () => reveal(Number($("#guess").value)));
  $("#gskip").addEventListener("click", () => reveal(null));
  $("#cagain").addEventListener("click", () => show("cin"));
  window.__calc = { read, compute: cfg.compute, fields: F };
  renderMoreSites($("#more"), cfg.slug);
}
