// 하단 다른 도구 링크(renderMoreSites)를 '함께 보는 풀이' 부적 세 장으로 꾸민다.
// 메인 페이지(app.js)와 해몽 사전 페이지(scripts/build-dream-pages.mjs 가 만든 s/*)가 같이 쓴다.
const NUM = ["壹", "貳", "參", "肆"];

export function dressTalismans(el) {
  if (!el) return;
  el.classList.add("fu");
  const title = el.querySelector(".more-sites__title");
  if (title) title.innerHTML = `<span class="fu__t">함께 보는 풀이</span>`;
  el.querySelectorAll(".more-sites__item").forEach((a, i) => {
    a.style.setProperty("--i", i);
    a.insertAdjacentHTML("afterbegin", `<span class="fu__pin" aria-hidden="true"></span>`);
    a.insertAdjacentHTML("beforeend", `<span class="fu__seal" aria-hidden="true">${NUM[i] || "符"}</span>`);
  });
  const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) {
    el.classList.add("is-in");
    return;
  }
  const io = new IntersectionObserver(
    (ents) => {
      if (ents.some((e) => e.isIntersecting)) {
        el.classList.add("is-in");
        io.disconnect();
      }
    },
    { threshold: 0.25 }
  );
  io.observe(el);
}
