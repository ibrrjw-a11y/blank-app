// 글자수 세기(2026-10-08). 치는 대로 바로 셈. 글은 어디에도 보내지 않음(임시 저장은 켰을 때만 이 브라우저에)
import { $, toast, copyText, renderMoreSites, createStore } from "../../shared/kit.js";

const store = createStore("gw:char-count");
const seg = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter("ko", { granularity: "grapheme" }) : null;
const n0 = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// 보이는 글자 하나 = 1자 (👨‍👩‍👧 같은 붙은 이모지도 1자). Segmenter 없는 옛 브라우저는 코드 포인트 단위
const graphemes = (s) => { if (!s) return 0; if (!seg) return Array.from(s).length; let k = 0; for (const _ of seg.segment(s)) k++; return k; };

// 계산(화면 없음)
export function count(text) {
  const t = String(text).replace(/\r\n?/g, "\n");
  const withSp = graphemes(t);
  const without = graphemes(t.replace(/\s/g, ""));
  const utf8 = new TextEncoder().encode(t).length;
  let b2 = 0; for (const ch of t) b2 += ch.codePointAt(0) <= 0x7f ? 1 : 2;
  const lines = t === "" ? 0 : t.split("\n").length;
  const paras = t.split(/\n\s*\n/).filter((p) => p.trim()).length;
  const mss = Math.ceil(withSp / 200);
  return { withSp, without, utf8, b2, lines, paras, mss };
}

let base = "with";
function paint() {
  const t = $("#txt").value, r = count(t);
  $("#o-with").textContent = n0(r.withSp);
  $("#o-without").textContent = n0(r.without);
  $("#o-utf8").textContent = `${n0(r.utf8)}바이트`;
  $("#o-b2").textContent = `${n0(r.b2)}바이트`;
  $("#o-lines").textContent = `${n0(r.lines)}줄`;
  $("#o-paras").textContent = `${n0(r.paras)}문단`;
  $("#o-mss").textContent = `${n0(r.mss)}매`;
  const goal = Number($("#goal").value.replace(/[^0-9]/g, "")) || 0;
  const cur = base === "with" ? r.withSp : r.without;
  const bar = $("#gbar"), gt = $("#gtext");
  if (goal > 0) {
    const p = cur / goal;
    bar.style.width = `${Math.min(1, p) * 100}%`;
    bar.classList.toggle("over", cur > goal);
    gt.textContent = `${n0(cur)} / ${n0(goal)}자 · ${Math.floor((cur * 100) / goal)}% · ` + (cur > goal ? `${n0(cur - goal)}자 넘음` : cur === goal ? "딱 맞음" : `${n0(goal - cur)}자 남음`);
  } else { bar.style.width = "0%"; bar.classList.remove("over"); gt.textContent = "목표 글자 수를 넣으면 남은 글자 수가 보여요"; }
  for (const b of $("#gchips").querySelectorAll("button")) b.classList.toggle("on", Number(b.dataset.v) === goal);
  for (const b of $("#gbase").querySelectorAll("button")) b.classList.toggle("on", b.dataset.v === base);
  if ($("#keep").checked) store.set("draft", { t, goal, base });
  return r;
}

function init() {
  const saved = store.get("draft");
  if (saved && typeof saved.t === "string") {
    $("#txt").value = saved.t; $("#keep").checked = true;
    if (saved.goal) $("#goal").value = String(saved.goal);
    if (saved.base === "without") base = "without";
  }
  $("#txt").addEventListener("input", paint);
  $("#goal").addEventListener("input", (e) => { const d = e.target.value.replace(/[^0-9]/g, "").slice(0, 7); e.target.value = d; paint(); });
  $("#gchips").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; $("#goal").value = b.dataset.v; paint(); });
  $("#gbase").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; base = b.dataset.v; paint(); });
  $("#keep").addEventListener("change", (e) => { if (e.target.checked) { paint(); toast("이 기기에만 임시 저장해요"); } else { store.remove("draft"); toast("임시 저장을 지웠어요"); } });
  $("#clear").addEventListener("click", () => { $("#txt").value = ""; paint(); $("#txt").focus(); });
  $("#copy").addEventListener("click", async () => {
    const r = count($("#txt").value);
    const s = `공백 포함 ${n0(r.withSp)}자 · 공백 제외 ${n0(r.without)}자 · UTF-8 ${n0(r.utf8)}바이트 · 한글 2바이트 방식 ${n0(r.b2)}바이트 · ${n0(r.lines)}줄 · ${n0(r.paras)}문단 · 원고지 ${n0(r.mss)}매`;
    toast((await copyText(s)) ? "결과를 복사했어요" : "길게 눌러 복사해 주세요");
  });
  $("#copytxt").addEventListener("click", async () => { toast((await copyText($("#txt").value)) ? "글을 복사했어요" : "길게 눌러 복사해 주세요"); });
  paint();
  renderMoreSites($("#more"), "calc/char-count");
}
if (typeof document !== "undefined" && document.getElementById("txt")) init();
