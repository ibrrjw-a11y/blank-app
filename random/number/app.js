import { $, copyText, toast, renderMoreSites, prefersReducedMotion, sleep } from "../../shared/kit.js";
import { drawNumbers, parseExclude, stamp } from "../draw.js";

const el = {
  min: $("#min"), max: $("#max"), count: $("#count"), exclude: $("#exclude"), dup: $("#dup"), sort: $("#sort"),
  err: $("#err"), draw: $("#draw"), out: $("#out"), balls: $("#balls"), log: $("#log"), stamp: $("#stamp"), copy: $("#copy"), again: $("#again"),
};
const COLORS = ["#f2c230", "#5aa9e6", "#ef6b57", "#9a9a9a", "#62c370"];
let last = null;

async function run() {
  const exclude = parseExclude(el.exclude.value);
  const r = drawNumbers({ min: el.min.value, max: el.max.value, count: el.count.value, allowDup: el.dup.checked, exclude });
  if (r.error) { el.err.textContent = r.error; el.err.hidden = false; return; }
  el.err.hidden = true;
  const nums = el.sort.checked ? r.numbers.slice().sort((a, b) => a - b) : r.numbers;
  el.draw.disabled = true; el.again.disabled = true;
  el.out.hidden = false; el.stamp.hidden = true; el.log.hidden = true;
  el.balls.innerHTML = ""; el.balls.dataset.numbers = "";
  el.out.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  const slow = !prefersReducedMotion() && nums.length <= 20;
  for (const n of nums) {
    const b = document.createElement("span");
    b.className = "ball" + (String(Math.abs(n)).length > 3 ? " w" : "");
    b.style.setProperty("--b", COLORS[Math.abs(n) % COLORS.length]);
    b.textContent = n;
    el.balls.append(b);
    if (slow) await sleep(nums.length > 8 ? 160 : 420);
  }
  el.balls.dataset.numbers = JSON.stringify(nums);
  const when = stamp();
  el.log.innerHTML = `추첨 시각 <b></b><br>범위 <b></b> · 뽑을 수 있던 번호 <b></b>개<br>뺀 번호 <b></b><br>방식 브라우저 암호 난수 · <b></b>`;
  const bs = el.log.querySelectorAll("b");
  const exIn = [...new Set(exclude)].filter((x) => x >= Math.floor(el.min.value) && x <= Math.floor(el.max.value)).sort((a, b) => a - b);
  [when, `${Math.floor(el.min.value)}~${Math.floor(el.max.value)}`, r.size.toLocaleString(), exIn.length ? exIn.join(", ") : "없음", el.dup.checked ? "중복 허용" : "중복 없음"].forEach((v, k) => (bs[k].textContent = v));
  el.log.hidden = false; el.stamp.hidden = false;
  last = { when, nums };
  el.draw.disabled = false; el.again.disabled = false;
}

el.draw.addEventListener("click", run);
el.again.addEventListener("click", run);
el.copy.addEventListener("click", async () => {
  if (!last) return;
  toast((await copyText(`[번호 추첨] ${last.nums.join(", ")}\n추첨 시각 ${last.when}\nguesswhat.co.kr/random/number/`)) ? "번호를 복사했어요" : "복사에 실패했어요");
});

renderMoreSites($("#more"));
