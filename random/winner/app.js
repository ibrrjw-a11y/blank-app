import { $, createStore, copyText, toast, renderMoreSites, prefersReducedMotion, sleep } from "../../shared/kit.js";
import { parseNames, drawWinners, fingerprint, stamp } from "../draw.js";

const store = createStore("random-winner");
const el = {
  names: $("#names"), count: $("#count"), reserve: $("#reserve"), dedupe: $("#dedupe"), err: $("#err"), draw: $("#draw"),
  countLine: $("#countLine"), out: $("#out"), win: $("#window"), result: $("#result"), log: $("#log"), stamp: $("#stamp"),
  copy: $("#copy"), again: $("#again"),
};
let last = null;

try { el.names.value = store.get("names", "") || ""; } catch { /* 저장소 없음 */ }

function counted() {
  const { names, removed } = parseNames(el.names.value, el.dedupe.checked);
  el.countLine.textContent = removed ? `${names.length}명 (같은 이름 ${removed}개 합침)` : `${names.length}명`;
  return { names, removed };
}
el.names.addEventListener("input", counted);
el.dedupe.addEventListener("change", counted);
counted();

function showErr(msg) { el.err.textContent = msg; el.err.hidden = !msg; }

async function spin(pool, final) {
  el.win.classList.remove("is-hit");
  if (prefersReducedMotion() || pool.length < 2) { el.win.textContent = final; el.win.classList.add("is-hit"); return; }
  el.win.classList.add("is-spin");
  // 처음엔 빠르게, 점점 느려지다 멈춘다(화면 연출일 뿐 결과는 이미 정해져 있음)
  for (let i = 0, t = 40; i < 16; i++, t *= 1.16) {
    el.win.textContent = pool[(Math.random() * pool.length) | 0];
    await sleep(t);
  }
  el.win.classList.remove("is-spin");
  el.win.textContent = final;
  void el.win.offsetWidth;
  el.win.classList.add("is-hit");
  await sleep(380);
}

function li(no, name, reserve) {
  const x = document.createElement("li");
  if (reserve) x.className = "is-reserve";
  x.innerHTML = `<span class="no"></span><span class="nm"></span>`;
  x.querySelector(".no").textContent = no;
  x.querySelector(".nm").textContent = name;
  return x;
}

async function run() {
  const { names, removed } = counted();
  const r = drawWinners(names, el.count.value, el.reserve.value);
  if (r.error) { showErr(r.error); return; }
  showErr("");
  try { store.set("names", el.names.value.slice(0, 200000)); } catch { /* 무시 */ }
  el.draw.disabled = true; el.again.disabled = true;
  el.out.hidden = false; el.stamp.hidden = true; el.log.hidden = true;
  el.result.innerHTML = "";
  el.result.dataset.winners = ""; el.result.dataset.reserves = "";
  el.out.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  const when = stamp();
  const fp = await fingerprint(names);
  const fast = r.winners.length + r.reserves.length > 12;   // 많이 뽑을 땐 한 명씩 돌리지 않음
  let i = 0;
  for (const w of r.winners) {
    i++;
    if (!fast) await spin(names, w);
    el.result.append(li(`당첨 ${i}`, w, false));
  }
  if (r.reserves.length) {
    const h = document.createElement("li"); h.className = "sec"; h.textContent = "예비 당첨 (당첨자가 빠지면 순서대로)"; el.result.append(h);
    let j = 0;
    for (const w of r.reserves) { j++; if (!fast) await spin(names, w); el.result.append(li(`예비 ${j}`, w, true)); }
  }
  // 끝나면 창에는 당첨자(예비 말고)를 남긴다
  el.win.textContent = r.winners.length <= 3 ? r.winners.join(" · ") : `${r.winners.length}명 당첨`;
  el.win.classList.add("is-hit");
  el.result.dataset.winners = JSON.stringify(r.winners);
  el.result.dataset.reserves = JSON.stringify(r.reserves);
  el.log.innerHTML = `추첨 시각 <b></b><br>참가 <b></b>명${removed ? ` · 같은 이름 ${removed}개 합침` : ""}<br>당첨 <b></b>명 · 예비 <b></b>명<br>명단 지문 <b></b><br>방식 브라우저 암호 난수로 명단 섞기`;
  const bs = el.log.querySelectorAll("b");
  [when, names.length, r.winners.length, r.reserves.length, fp].forEach((v, k) => (bs[k].textContent = v));
  el.log.hidden = false; el.stamp.hidden = false;
  last = { when, n: names.length, removed, fp, ...r };
  el.draw.disabled = false; el.again.disabled = false;
}

el.draw.addEventListener("click", run);
el.again.addEventListener("click", run);
el.copy.addEventListener("click", async () => {
  if (!last) return;
  const t = [
    "[당첨자 추첨 결과]",
    ...last.winners.map((w, k) => `당첨 ${k + 1}. ${w}`),
    ...(last.reserves.length ? ["", ...last.reserves.map((w, k) => `예비 ${k + 1}. ${w}`)] : []),
    "",
    `추첨 시각 ${last.when} · 참가 ${last.n}명${last.removed ? `(같은 이름 ${last.removed}개 합침)` : ""} · 명단 지문 ${last.fp}`,
    "guesswhat.co.kr/random/winner/",
  ].join("\n");
  toast((await copyText(t)) ? "결과를 복사했어요" : "복사에 실패했어요");
});

renderMoreSites($("#more"));
