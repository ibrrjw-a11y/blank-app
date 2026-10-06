// 뇌 나이 측정소의 테스트 하나만 따로 하는 페이지(/brain-age/<테스트>/)가 같이 쓰는 흐름.
// 첫 화면(이 테스트의 파형이 움직이는 계기판) → 설명 → 3·2·1 → 게임(games.js 의 PLAY 그대로) → 결과·개인 최고·공유.
// 기록은 이 기기에만. 순위표 없음. 나이 환산은 종합 측정과 같은 재미용 곡선(동체시력은 곡선이 없어 나이 표시 안 함).
import { $, createStore, share, toast, renderMoreSites, ROOT_URL, haptic } from "../shared/kit.js";
import { META, ageFor, ageBand } from "./scoring.js";
import { howTo, countdown, PLAY } from "./games.js";
import { Scope, WAVES } from "./instrument.js";

const store = createStore("brain-age-solo");
export const SOLO = {
  rt: { slug: "reaction", title: "반응속도 테스트" },
  mem: { slug: "memory", title: "순간기억력 테스트" },
  color: { slug: "color", title: "색감 테스트" },
  hear: { slug: "hearing", title: "고주파 청력 테스트" },
  math: { slug: "mental-math", title: "암산 테스트" },
  dyn: { slug: "dynamic-vision", title: "동체시력 테스트" },
};

const better = (key, a, b) => (b == null ? true : META[key].better === "low" ? a < b : a > b);

export function bestOf(key) {
  return store.get(`best:${key}`, null);
}

export function bootSolo(key) {
  const m = META[key];
  const views = ["intro", "game", "result"];
  const show = (v) => {
    views.forEach((n) => ($(`[data-view="${n}"]`).hidden = n !== v));
    window.scrollTo(0, 0);
  };
  let life = null;

  // 첫 화면: 이 테스트의 파형이 실제로 흐른다
  const introScope = new Scope($("#scope"), { period: 1600, gain: 0.5 });
  introScope.setWave(WAVES[key]);
  const introLife = new AbortController();
  introScope.start(introLife.signal);
  const paintBest = () => {
    const b = bestOf(key);
    $("#best").textContent = b ? `내 최고 ${m.fmt(b.raw)}` : "아직 기록 없음";
  };
  paintBest();

  async function run() {
    life?.abort();
    life = new AbortController();
    const signal = life.signal;
    show("game");
    const area = $("#area");
    try {
      const act = await howTo(area, key, signal);
      if (act === "skip") return show("intro");
      await countdown(area, signal);
      const res = await PLAY[key](area, signal);
      result(res);
    } catch (e) {
      if (e?.name !== "AbortError") throw e;
    }
  }

  function result(res) {
    const prev = bestOf(key);
    const skipped = res.raw == null;
    const isBest = !skipped && better(key, res.raw, prev?.raw);
    if (isBest) store.set(`best:${key}`, { raw: res.raw, at: Date.now() });
    const tries = store.get(`n:${key}`, 0) + 1;
    store.set(`n:${key}`, tries);
    const age = skipped ? null : ageFor(key, res.raw);
    let note = "";
    if (key === "rt" && res.falseStarts) note = `너무 빨리 누른 ${res.falseStarts}번은 30ms씩 더했어요.`;
    if (key === "hear" && res.unsure) note = "소리가 없는 문제에서 '들려요'를 눌러서, 정확하지 않을 수 있어요.";
    if (key === "math") note = `${res.tried}문제 중 ${res.raw}문제 맞혔어요.`;
    if (key === "dyn" && res.fastest) note = `가장 빠르게 맞힌 판: ${Math.round(res.fastest)}ms에 화면을 지나간 숫자`;
    $("#resultBody").innerHTML = `
      <div class="done solo-done">
        <div class="readout">
          <p class="readout__k mono"><span>${m.code} ${m.name}</span><span>${skipped ? "SKIP" : isBest ? "NEW BEST" : "OK"}</span></p>
          <p class="readout__v mono t-num">${skipped ? "건너뜀" : m.fmt(res.raw)}</p>
        </div>
        ${isBest && prev ? `<span class="badge">개인 최고 갱신 · 전 기록 ${m.fmt(prev.raw)}</span>` : ""}
        ${!isBest && prev ? `<p class="t-body-03 t-secondary">내 최고 ${m.fmt(prev.raw)} · ${tries}번째 측정</p>` : ""}
        ${age != null ? `<p class="t-body-01">재미로 보면 <b class="t-primary">${ageBand(Math.round(age))}</b> 수준이에요</p>` : ""}
        ${note ? `<p class="t-body-03 t-secondary">${note}</p>` : ""}
        <div class="solo-done__btns">
          <button class="btn btn--primary btn--lg btn--block" id="again" type="button">한 번 더</button>
          <button class="btn btn--outline btn--lg btn--block" id="shareRes" type="button">친구에게 도전장</button>
          <a class="btn btn--ghost btn--block" href="${ROOT_URL}brain-age/">5개 다 하고 뇌 나이 보기</a>
        </div>
      </div>`;
    show("result");
    haptic(isBest ? [10, 40, 10] : 8);
    $("#again").addEventListener("click", run);
    $("#shareRes").addEventListener("click", async () => {
      const text = skipped ? `${SOLO[key].title} 해 봐` : `${SOLO[key].title} 내 기록 ${m.fmt(res.raw)}. 너는?`;
      const r = await share({ title: SOLO[key].title, text, url: `${ROOT_URL}brain-age/${SOLO[key].slug}/` });
      if (r === "shared") toast("보냈어요");
    });
    paintBest();
  }

  $("#start").addEventListener("click", run);
  $("#quit").addEventListener("click", () => {
    life?.abort();
    show("intro");
  });
  $("#back").addEventListener("click", () => show("intro"));
  renderMoreSites($("#more"), `brain-age/${SOLO[key].slug}`);
  const t = $("#more .more-sites__title");
  if (t) t.textContent = "다른 측정 채널";
  show("intro");
}
