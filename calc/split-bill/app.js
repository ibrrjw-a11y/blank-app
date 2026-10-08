// N빵 정산기(2026-10-08). 항목마다 낀 사람만 나눔 → 사람별 합 → 끝자리 올림 → 총무가 받을 돈
import { $, share, toast, renderMoreSites, ROOT_URL, getParam, prefersReducedMotion } from "../../shared/kit.js";
import { won } from "../../shared/calc.js";

const RM = prefersReducedMotion();
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
let items = [{ name: "1차 고기", amt: 180000, out: [] }, { name: "술", amt: 60000, out: ["지영"] }];
const names = () => [...new Set($("#names").value.split(/[,\n、]/).map((s) => s.trim().slice(0, 10)).filter(Boolean))].slice(0, 30);

// 계산(화면 없음): 항목 금액 ÷ 낀 사람 수를 사람마다 더하고, 끝자리 단위로 올림
export function settle(people, list, unit) {
  const raw = Object.fromEntries(people.map((p) => [p, 0]));
  for (const it of list) {
    const inn = people.filter((p) => !it.out.includes(p));
    if (!inn.length || !(it.amt > 0)) continue;
    for (const p of inn) raw[p] += it.amt / inn.length;
  }
  const pay = Object.fromEntries(people.map((p) => [p, unit > 1 ? Math.ceil(raw[p] / unit) * unit : Math.round(raw[p])]));
  const total = list.reduce((a, it) => a + (people.some((p) => !it.out.includes(p)) && it.amt > 0 ? it.amt : 0), 0);
  return { raw, pay, total, extra: Object.values(pay).reduce((a, b) => a + b, 0) - total };
}

function renderItems() {
  const ps = names();
  $("#items").innerHTML = items.map((it, i) => `<div class="cf sb-item" data-i="${i}">
      <div class="sb-row"><input class="sb-iname" data-k="name" value="${esc(it.name)}" maxlength="20" aria-label="항목 이름"><div class="cf-num"><input data-k="amt" inputmode="numeric" value="${it.amt ? it.amt.toLocaleString("ko-KR") : ""}" placeholder="금액" aria-label="금액"><span>원</span></div>${items.length > 1 ? `<button type="button" class="sb-del" data-del="${i}" aria-label="항목 빼기">✕</button>` : ""}</div>
      <div class="sb-who">${ps.map((p) => `<button type="button" class="${it.out.includes(p) ? "" : "on"}" data-who="${esc(p)}">${esc(p)}</button>`).join("")}</div>
    </div>`).join("");
  const pay = $("#payer"), cur = pay.value;
  pay.innerHTML = ps.map((p) => `<option${p === cur ? " selected" : ""}>${esc(p)}</option>`).join("");
}
function compute() {
  const ps = names();
  if (ps.length < 2) return err("두 명 이상 적어 주세요");
  if (!items.some((it) => it.amt > 0)) return err("금액을 하나 이상 넣어 주세요");
  const unit = Number($("#unit").value), payer = $("#payer").value || ps[0];
  const r = settle(ps, items, unit);
  $("#cerr").hidden = true;
  $("#rtot").textContent = `총 ${won(r.total)} · ${ps.length}명`;
  const max = Math.max(...Object.values(r.pay));
  $("#people").innerHTML = ps.map((p, k) => `<div class="sb-p${p === payer ? " is-payer" : ""}" style="--k:${k}"><span>${esc(p)}${p === payer ? " <em>결제</em>" : ""}</span><i style="--w:${max ? r.pay[p] / max : 0}"></i><b data-v="${r.pay[p]}">${won(RM ? r.pay[p] : 0)}</b></div>`).join("");
  const others = ps.filter((p) => p !== payer).reduce((a, p) => a + r.pay[p], 0);
  $("#rpayer").textContent = `${payer}님은 ${ps.length - 1}명에게 ${won(others)}을 받으면 돼요${r.extra ? ` (끝자리 올림으로 ${won(r.extra)} 더 받음)` : ""}.`;
  $("#breakdown").innerHTML = items.filter((it) => it.amt > 0).map((it) => { const inn = ps.filter((p) => !it.out.includes(p)); return `<p>${esc(it.name)} ${won(it.amt)} ÷ ${inn.length}명 = 1인 ${won(it.amt / Math.max(1, inn.length))} <small>(${inn.map(esc).join(", ")})</small></p>`; }).join("");
  window.__split = { r, payer, ps };
  writeCopy(r, ps, payer);
  for (const s of ["cin", "cres"]) $("#" + s).hidden = s !== "cres";
  $("#cres").scrollIntoView({ block: "start", behavior: RM ? "auto" : "smooth" });
  if (!RM) document.querySelectorAll(".sb-p b").forEach((b, k) => { const v = Number(b.dataset.v), t0 = performance.now() + k * 90; const f = (t) => { const p = Math.max(0, Math.min(1, (t - t0) / 700)); b.textContent = won(v * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); });
}
function writeCopy(r, ps, payer) {
  const acc = $("#acc").value.trim();
  $("#copy").textContent = [`[N빵 정산] 총 ${won(r.total)}`, ...items.filter((it) => it.amt > 0).map((it) => `· ${it.name} ${won(it.amt)}${it.out.length ? ` (${it.out.filter((p) => ps.includes(p)).join("·")} 빼고)` : ""}`), "", ...ps.map((p) => `${p} ${won(r.pay[p])}${p === payer ? " (결제)" : ""}`), "", `${payer}에게 보내 주세요${acc ? `: ${acc}` : ""}`].join("\n");
}
function err(t) { const e = $("#cerr"); e.textContent = t; e.hidden = false; }

// 링크: 이름·항목·끝자리·총무만(계좌는 안 담음)
const pack = () => btoa(unescape(encodeURIComponent(JSON.stringify({ n: names(), i: items, u: Number($("#unit").value), p: $("#payer").value })))).replace(/=+$/, "");
function unpack(s) { try { const d = JSON.parse(decodeURIComponent(escape(atob(s)))); if (!Array.isArray(d.n) || !Array.isArray(d.i)) return null; return d; } catch { return null; } }

function init() {
  const q = getParam("q"), d = q && unpack(q);
  if (d) {
    $("#names").value = d.n.map(String).join(", ");
    items = d.i.slice(0, 30).map((it) => ({ name: String(it.name || "항목").slice(0, 20), amt: Math.max(0, Number(it.amt) || 0), out: Array.isArray(it.out) ? it.out.map(String) : [] }));
    renderItems(); $("#unit").value = String([1, 100, 1000].includes(d.u) ? d.u : 100); $("#payer").value = String(d.p || "");
    const c = $("#cchal"); c.hidden = false; c.innerHTML = "<b>친구가 보낸 정산표</b><span>같은 내용이 채워져 있어요. 바로 정산 결과를 볼 수 있어요.</span>";
    compute();
  } else renderItems();
  $("#names").addEventListener("input", renderItems);
  $("#items").addEventListener("input", (e) => {
    const box = e.target.closest(".sb-item"); if (!box) return; const it = items[box.dataset.i];
    if (e.target.dataset.k === "name") it.name = e.target.value;
    if (e.target.dataset.k === "amt") { const n = Number(e.target.value.replace(/[^0-9]/g, "")); it.amt = n; e.target.value = n ? n.toLocaleString("ko-KR") : ""; }
  });
  $("#items").addEventListener("click", (e) => {
    const w = e.target.closest("[data-who]"), del = e.target.closest("[data-del]");
    if (w) { const it = items[w.closest(".sb-item").dataset.i], p = w.dataset.who; it.out = it.out.includes(p) ? it.out.filter((x) => x !== p) : [...it.out, p]; w.classList.toggle("on"); }
    if (del) { items.splice(Number(del.dataset.del), 1); renderItems(); }
  });
  $("#add").addEventListener("click", () => { items.push({ name: `${items.length + 1}차`, amt: 0, out: [] }); renderItems(); });
  $("#go").addEventListener("click", compute);
  $("#back").addEventListener("click", () => { for (const s of ["cin", "cres"]) $("#" + s).hidden = s !== "cin"; });
  $("#acc").addEventListener("input", () => window.__split && writeCopy(window.__split.r, window.__split.ps, window.__split.payer));
  $("#copyBtn").addEventListener("click", async () => { try { await navigator.clipboard.writeText($("#copy").textContent); toast("복사했어요"); } catch { toast("길게 눌러 복사해 주세요"); } });
  $("#shareBtn").addEventListener("click", async () => { const r = await share({ title: "N빵 정산", text: $("#copy").textContent.split("\n\n")[0], url: `${ROOT_URL}calc/split-bill/?q=${encodeURIComponent(pack())}` }); if (r === "shared") toast("보냈어요"); });
  renderMoreSites($("#more"), "calc/split-bill");
}
if (typeof document !== "undefined" && document.getElementById("items")) init();
