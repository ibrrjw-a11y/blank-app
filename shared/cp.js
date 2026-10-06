// 쿠팡 파트너스 배너 (2026-10-06) — kit.js 가 불러온다. 모든 도구 페이지 아래쪽("이것도 해보기" 바로 위)에 같은 배너 하나.
// 값은 사용자가 준 배너 코드 그대로(짐작과 진짜 config.js 의 coupang 과 같은 값). 바꿀 땐 두 곳 다 바꿀 것.
// 쿠팡이 준 <script>는 문서를 다시 쓰는 방식이라 화면을 다시 그리는 이 사이트에선 깨진다 → 그 스크립트가 띄우는 배너 창(iframe)을 직접 넣는다.
// '수수료를 제공받습니다' 문구는 법으로 정해진 표시라 ⓘ 안에 숨기지 않고 늘 보이게 둔다.
export const COUPANG = { id: 1036313, trackingCode: "AF3940964", template: "carousel", height: 140 };
const NOTE = "이 게시물은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.";

const CSS = `
.gw-cp{box-sizing:border-box;width:100%;max-width:720px;margin:28px auto 4px;padding:0 16px}
.gw-cp__frame{display:block;width:100%;height:${COUPANG.height}px;border:0;border-radius:10px;background:#fff}
.gw-cp__note{margin:6px 0 0;font:400 12px/18px -apple-system,"Malgun Gothic",sans-serif;color:inherit;opacity:.72;word-break:keep-all}
`;

function frameSrc(w) {
  const q = new URLSearchParams({ id: COUPANG.id, template: COUPANG.template, trackingCode: COUPANG.trackingCode, subId: "", width: w, height: COUPANG.height, tsource: "" });
  return `https://ads-partners.coupang.com/widgets.html?${q}`;
}

export function mountCoupang() {
  if (document.querySelector(".gw-cp") || /^\/me(\/|$)/.test(location.pathname)) return; // 짐작과 진짜는 자체 배너가 있음
  if (!document.getElementById("gw-cp-css")) {
    const s = document.createElement("style");
    s.id = "gw-cp-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  const box = document.createElement("aside");
  box.className = "gw-cp";
  box.setAttribute("data-noinfo", "");
  box.setAttribute("aria-label", "쿠팡 상품 추천");
  // 접히는 설명서(article.seo) 안의 '이것도 해보기'는 피함(설명서를 접으면 배너도 같이 숨음)
  const outside = (sel) => [...document.querySelectorAll(sel)].find((e) => !e.closest("article.seo, .gw-info-hidden"));
  const anchor = outside(".more-sites") || outside("footer, .site-footer");
  if (anchor) anchor.parentElement.insertBefore(box, anchor);
  else document.body.appendChild(box);
  const w = Math.round(Math.max(280, Math.min(680, box.clientWidth - 32 || innerWidth - 32)));
  box.innerHTML = `<iframe class="gw-cp__frame" src="${frameSrc(w)}" width="${w}" height="${COUPANG.height}" frameborder="0" scrolling="no" referrerpolicy="origin" loading="lazy" title="쿠팡 상품 추천"></iframe><p class="gw-cp__note">${NOTE}</p>`;
}
