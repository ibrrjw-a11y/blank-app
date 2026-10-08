// QR코드 만들기(2026-10-08). 부호화는 같은 폴더의 qrcode.js(qrcode-generator 1.4.4, MIT, © Kazuhiko Arase)
// 외부 CDN 없음. 입력은 어디에도 보내지 않음. 한글은 UTF-8 바이트로 담음.
import { $, $$, toast, copyText, downloadBlob, renderMoreSites } from "../../shared/kit.js";

const QR = window.qrcode;
QR.stringToBytes = QR.stringToBytesFuncs["UTF-8"];

// 와이파이: WIFI:T:<WPA|WEP|nopass>;S:<이름>;P:<비번>;H:true;;  — 특수문자 \ ; , : " 앞에 \ 를 붙임(휴대폰 카메라가 쓰는 ZXing 형식)
const wEsc = (s) => String(s).replace(/([\\;,:"])/g, "\\$1");
export function wifiPayload({ ssid, sec, pass, hidden }) {
  let s = `WIFI:T:${sec};S:${wEsc(ssid)};`;
  if (sec !== "nopass") s += `P:${wEsc(pass)};`;
  if (hidden) s += "H:true;";
  return s + ";";
}
// 연락처: vCard 3.0. 값 안의 \ , ; 줄바꿈은 \ 로 감쌈(RFC 2426)
const vEsc = (s) => String(s).replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\r?\n/g, "\\n");
export function vcardPayload({ last, first, tel, mail, org, url }) {
  const L = ["BEGIN:VCARD", "VERSION:3.0", `N:${vEsc(last)};${vEsc(first)};;;`, `FN:${vEsc(`${last}${first}`)}`];
  if (tel) L.push(`TEL;TYPE=CELL:${vEsc(tel)}`);
  if (mail) L.push(`EMAIL:${vEsc(mail)}`);
  if (org) L.push(`ORG:${vEsc(org)}`);
  if (url) L.push(`URL:${vEsc(url)}`);
  L.push("END:VCARD");
  return L.join("\r\n");
}

let kind = "text";
const v = (id) => $("#" + id).value;
function payload() {
  if (kind === "wifi") {
    if (!v("ssid").trim()) throw new Error("와이파이 이름을 넣어 주세요.");
    if (v("wsec") !== "nopass" && !v("wpass")) throw new Error("비밀번호를 넣거나 '비밀번호 없음'을 골라 주세요.");
    return wifiPayload({ ssid: v("ssid"), sec: v("wsec"), pass: v("wpass"), hidden: $("#whid").checked });
  }
  if (kind === "contact") {
    if (!(v("cLast") + v("cFirst")).trim()) throw new Error("이름을 넣어 주세요.");
    return vcardPayload({ last: v("cLast").trim(), first: v("cFirst").trim(), tel: v("cTel").trim(), mail: v("cMail").trim(), org: v("cOrg").trim(), url: v("cUrl").trim() });
  }
  if (!v("text")) throw new Error("담을 글이나 주소를 넣어 주세요.");
  return v("text");
}

// 색 밝기(WCAG 상대 휘도) — 대비 경고용
function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function draw(canvas, text, { ecl = "M", margin = 4, size = 512, fg = "#141414", bg = "#ffffff" } = {}) {
  const q = QR(0, ecl);
  q.addData(text, "Byte");
  q.make();
  const n = q.getModuleCount(), total = n + margin * 2;
  const cell = Math.max(1, Math.floor(size / total));
  const px = cell * total;
  canvas.width = px; canvas.height = px;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, px, px);
  ctx.fillStyle = fg;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) ctx.fillRect((c + margin) * cell, (r + margin) * cell, cell, cell);
  return { modules: n, version: (n - 17) / 4, px };
}

let last = "";
function render() {
  $("#marginV").textContent = v("margin");
  $("#wpassBox").hidden = v("wsec") === "nopass";
  const err = $("#qerr"), warn = [];
  let text;
  try { text = payload(); } catch (e) { err.textContent = e.message; err.hidden = false; $("#qrc").classList.add("qr-dim"); return; }
  const fg = v("fg"), bg = v("bg"), margin = Number(v("margin"));
  try {
    const info = draw($("#qrc"), text, { ecl: v("ecl"), margin, size: Number(v("size")), fg, bg });
    err.hidden = true; $("#qrc").classList.remove("qr-dim");
    $("#qmeta").textContent = `${new TextEncoder().encode(text).length}바이트 · ${info.version}버전(${info.modules}×${info.modules}칸) · 저장 ${info.px}×${info.px}px`;
  } catch (e) {
    err.textContent = "담을 내용이 너무 길어요. 줄이거나 오류 복원을 낮춰 주세요."; err.hidden = false; $("#qrc").classList.add("qr-dim"); return;
  }
  const lf = lum(fg), lb = lum(bg), ratio = (Math.max(lf, lb) + 0.05) / (Math.min(lf, lb) + 0.05);
  if (lf >= lb) warn.push("무늬가 바탕보다 밝아요. 못 읽는 카메라 앱이 많아요.");
  else if (ratio < 3) warn.push(`색 대비가 낮아요(${ratio.toFixed(1)}:1). 더 진한 무늬나 더 밝은 바탕을 고르세요.`);
  if (margin < 4) warn.push("여백이 4칸보다 좁아요. 못 읽는 앱이 있어요.");
  $("#qwarn").innerHTML = warn.map((w) => `<li>${w.replace(/[&<>]/g, "")}</li>`).join("");
  $("#payload").textContent = text;
  last = text;
}

function init() {
  $(".qr-tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-kind]"); if (!b) return;
    kind = b.dataset.kind;
    $$(".qr-tabs button").forEach((x) => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-selected", String(on)); });
    $$(".qr-pane").forEach((p) => (p.hidden = p.dataset.pane !== kind));
    render();
  });
  $("#qform").addEventListener("input", render);
  $("#qform").addEventListener("change", render);
  $("#qform").addEventListener("submit", (e) => e.preventDefault());
  $("#save").addEventListener("click", () => {
    if (!$("#qerr").hidden) return toast("먼저 내용을 고쳐 주세요.");
    $("#qrc").toBlob((b) => { downloadBlob(b, `qr-${kind}.png`); toast("PNG로 저장했어요"); }, "image/png");
  });
  $("#copyImg").addEventListener("click", () => {
    if (!$("#qerr").hidden) return;
    $("#qrc").toBlob(async (b) => {
      try { await navigator.clipboard.write([new ClipboardItem({ "image/png": b })]); toast("이미지 복사됨"); }
      catch { toast("이 브라우저는 이미지 복사가 막혀 있어요. PNG로 저장해 주세요."); }
    }, "image/png");
  });
  $("#copyTxt").addEventListener("click", async () => { if (last) toast((await copyText(last)) ? "담긴 글 복사됨" : "복사가 막혀 있어요."); });
  render();
  renderMoreSites($("#more"), "tools/qr");
}
init();
