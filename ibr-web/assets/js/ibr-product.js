/* IBR 제품 상세: 주소 끝 #p-제품id 의 제품을 보여 줍니다. 상세 이미지는 위에서부터 차례로 붙습니다. */
(function () {
  "use strict";
  var IBR = window.IBR, PR = window.IBR_PRODUCTS;
  function $(s) { return document.querySelector(s); }
  var OUT = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 9l6-6M4 3h5v5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';

  function link(href, label, cls, icon) {
    if (!href) return "";
    return '<a class="bf-btn ' + cls + '" href="' + href + '" target="_blank" rel="noopener">' + (icon || "") + label + OUT + "</a>";
  }

  function render() {
    var m = location.hash.match(/^#p-([\w-]+)$/), p = m && PR.filter(function (x) { return x.id === m[1]; })[0];
    var top = $("#pdTop"), det = $("#pdDetail"), nav = $("#pdNav");
    if (!p) {
      top.innerHTML = '<div class="empty"><p>' + IBR.t("제품을 찾을 수 없습니다.", "Product not found.") + '</p><a class="link-arrow" href="' + IBR.page("products.html") + '">' + IBR.t("전체 제품 보기 ", "View all products ") + IBR.ARROW + "</a></div>";
      det.innerHTML = ""; nav.innerHTML = ""; return;
    }
    var b = IBR.brandMap()[p.b], L = (window.IBR_LINKS || {})[p.b] || {};
    document.title = b.ko + " " + p.n + " · IBR";
    $("#pdBrandLink").textContent = b.ko; $("#pdBrandLink").href = IBR.page("products.html") + "#b-" + b.id;
    $("#pdCrumb").textContent = p.n;

    var card = IBR.productCard(Object.assign({}, p, { url: "" }));
    var art = card.querySelector(".art");
    var info = document.createElement("div");
    info.className = "pd-info";
    info.innerHTML =
      '<p class="pd-brand"><a href="' + IBR.page("products.html") + '#b-' + b.id + '"><span class="wm ' + (b.mark || "") + '">' + b.en + "</span></a>" + (b.ko !== b.en ? " <span>" + b.ko + "</span>" : "") + "</p>" +
      "<h1>" + p.n + "</h1>" +
      (p.vars && p.vars.length ? '<ul class="pd-vars">' + p.vars.map(function (v) { return "<li>" + v + "</li>"; }).join("") + "</ul>" : "") +
      '<div class="pd-opts"></div>' +
      (p.note ? '<p class="pd-note">' + p.note + "</p>" : "") +
      '<p class="pd-buy">' + IBR.t("구매는 공식 판매처에서 하실 수 있습니다.", "Available at our official stores.") + '</p>' +
      '<div class="bf-actions">' + link(L.smartstore, IBR.t("네이버 스마트스토어", "Naver Smart Store"), "naver", '<i class="n" aria-hidden="true">N</i>') + link(L.mall, IBR.t("자사몰", "Official store"), "mall") +
      (b.origin && b.origin !== "KR" ? link(L.global, IBR.t("해외 공식몰", "Global official store"), "global") : "") + "</div>";
    var opts = info.querySelector(".pd-opts");
    opts.innerHTML = '<table><tbody>' + p.opts.map(function (o) {
      return "<tr><th>" + o[0] + "</th><td>" + (o[1] == null ? '<span class="tbd">' + IBR.t("소비자가 준비 중", "Price coming soon") + "</span>" : IBR.lang === "en" ? "<b>" + IBR.won(o[1]) + "</b> KRW" : "<b>" + IBR.won(o[1]) + "</b>원") + "</td></tr>";
    }).join("") + "</tbody></table>";
    top.innerHTML = "";
    top.style.setProperty("--tint", b.tint || "#E8ECE8");
    top.style.setProperty("--bink", b.ink || "#2A3330");
    var media = document.createElement("div"); media.className = "pd-media"; media.appendChild(art);
    top.appendChild(media); top.appendChild(info);

    det.innerHTML = (p.detail && p.detail.length)
      ? p.detail.map(function (src, i) { return '<img src="' + src + '" alt="' + p.n + IBR.t(" 상세 ", " detail ") + (i + 1) + '" loading="' + (i < 2 ? "eager" : "lazy") + '" decoding="async">'; }).join("")
      : '<p class="pd-wait">' + IBR.t("상세 정보는 준비 중입니다.", "Details coming soon.") + '</p>';

    var same = PR.filter(function (x) { return x.b === p.b; }), i = same.indexOf(p);
    var prev = same[(i - 1 + same.length) % same.length], next = same[(i + 1) % same.length];
    nav.innerHTML = same.length > 1
      ? '<a href="#p-' + prev.id + '"><small>' + IBR.t("이전 제품", "Previous") + '</small>' + prev.n + '</a><a href="' + IBR.page("products.html") + '#b-' + b.id + '" class="all">' + IBR.t(b.ko + " 전체", "All " + b.ko) + "</a>" + '<a href="#p-' + next.id + '" class="nx"><small>' + IBR.t("다음 제품", "Next") + '</small>' + next.n + "</a>"
      : '<a href="' + IBR.page("products.html") + '#b-' + b.id + '" class="all">' + IBR.t(b.ko + " 전체 보기", "View all " + b.ko) + "</a>";
    window.scrollTo(0, 0);
  }
  addEventListener("hashchange", render);
  document.addEventListener("DOMContentLoaded", render);
})();
