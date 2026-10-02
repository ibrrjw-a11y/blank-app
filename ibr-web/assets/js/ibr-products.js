/* IBR 제품 페이지: 분류·브랜드·검색·정렬로 걸러 브랜드별로 보여 줍니다. 주소 끝 #b-브랜드id 로 바로 갈 수 있습니다. */
(function () {
  "use strict";
  var IBR = window.IBR, CATS = window.IBR_CATS, BR = window.IBR_BRANDS, PR = window.IBR_PRODUCTS;
  function $(s) { return document.querySelector(s); }
  var GROUP = { own: "자사 브랜드", global: "글로벌 소싱", dist: "유통 브랜드" };
  var state = { cat: "", brand: "", q: "", sort: "" };

  function load() {
    try { var s = JSON.parse(sessionStorage.getItem("ibr-products") || "{}"); state.sort = s.sort || ""; } catch (e) {}
    var h = location.hash.match(/^#b-([\w-]+)$/);
    if (h) state.brand = h[1];
  }
  function save() { try { sessionStorage.setItem("ibr-products", JSON.stringify({ sort: state.sort })); } catch (e) {} }

  var order = BR.map(function (b) { return b.id; });
  var withProducts = BR.filter(function (b) { return PR.some(function (p) { return p.b === b.id; }); });

  function match(p) {
    if (state.cat && p.cat !== state.cat) return false;
    if (state.brand && p.b !== state.brand) return false;
    if (state.q) {
      var b = IBR.brandMap()[p.b];
      var hay = (p.n + " " + b.ko + " " + b.en + " " + (p.vars || []).join(" ") + " " + p.opts.map(function (o) { return o[0]; }).join(" ")).toLowerCase();
      if (hay.indexOf(state.q.toLowerCase()) < 0) return false;
    }
    return true;
  }

  function bars() {
    var cb = $("#catBar"); cb.innerHTML = "";
    [["", "전체"]].concat(Object.keys(CATS).map(function (k) { return [k, CATS[k]]; })).forEach(function (c) {
      var n = PR.filter(function (p) { return !c[0] || p.cat === c[0]; }).length;
      if (!n) return;
      var b = document.createElement("button");
      b.type = "button"; b.className = "tab"; b.setAttribute("aria-pressed", String(state.cat === c[0]));
      b.innerHTML = c[1] + ' <span class="c">' + n + "</span>";
      b.addEventListener("click", function () { state.cat = c[0]; render(); });
      cb.appendChild(b);
    });
    var bb = $("#brandBar"); bb.innerHTML = "";
    [{ id: "", ko: "모든 브랜드" }].concat(withProducts).forEach(function (br) {
      var n = PR.filter(function (p) { return (!br.id || p.b === br.id) && (!state.cat || p.cat === state.cat); }).length;
      var b = document.createElement("button");
      b.type = "button"; b.setAttribute("aria-pressed", String(state.brand === br.id));
      b.innerHTML = br.ko + ' <span class="c">' + n + "</span>";
      b.disabled = br.id && !n;
      if (b.disabled) b.style.opacity = ".35";
      b.addEventListener("click", function () {
        state.brand = br.id;
        if (history.replaceState) history.replaceState(null, "", br.id ? "#b-" + br.id : location.pathname + location.search);
        render();
        toTop();
      });
      bb.appendChild(b);
    });
    var on = bb.querySelector('[aria-pressed="true"]');
    if (on && on !== bb.firstChild && bb.scrollWidth > bb.clientWidth) bb.scrollLeft = on.getBoundingClientRect().left - bb.getBoundingClientRect().left + bb.scrollLeft - 24;
    wireBar(bb);
  }

  /* 좁은 화면에서 브랜드 바가 한 줄로 넘칠 때: 마우스 휠로도 좌우로 넘기고, 끝에 닿으면 오른쪽 흐림을 없앱니다 */
  function wireBar(bb) {
    function edge() { bb.classList.toggle("end", bb.scrollLeft + bb.clientWidth >= bb.scrollWidth - 4); }
    if (!bb.dataset.wired) {
      bb.dataset.wired = "1";
      bb.addEventListener("scroll", edge, { passive: true });
      addEventListener("resize", edge);
      bb.addEventListener("wheel", function (e) {
        if (bb.scrollWidth <= bb.clientWidth || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
        var max = bb.scrollWidth - bb.clientWidth;
        if ((e.deltaY < 0 && bb.scrollLeft <= 0) || (e.deltaY > 0 && bb.scrollLeft >= max - 1)) return;
        bb.scrollLeft += e.deltaY;
        e.preventDefault();
      }, { passive: false });
    }
    edge();
  }

  /* 브랜드를 고르면 필터 바 아래에 브랜드 필름과 바로가기 버튼이 나옵니다 */
  function film() {
    var host = $("#brandFilm"), b = state.brand && IBR.brandMap()[state.brand];
    $(".catalog").classList.toggle("single", !!b);
    if (!IBR.brandFilm || !host) return;
    if (b) IBR.brandFilm.show(host, b); else IBR.brandFilm.hide(host);
  }
  function toTop() {
    var hd = document.querySelector(".site-header"), tb = $(".toolbar");
    var y = $(".catalog").getBoundingClientRect().top + window.scrollY - (hd ? hd.offsetHeight : 0) - (tb ? tb.offsetHeight : 0) + 8;
    window.scrollTo({ top: Math.max(0, y), behavior: IBR.reduce ? "auto" : "smooth" });
  }

  function render() {
    bars();
    film();
    var cat = $("#catalog"); cat.innerHTML = "";
    var list = PR.filter(match);
    $("#empty").hidden = list.length > 0;
    if (state.sort) {
      var sorted = list.slice().sort(function (a, b) {
        var x = IBR.priceOf(a), y = IBR.priceOf(b);
        if (x == null) return 1; if (y == null) return -1;
        return state.sort === "lo" ? x - y : y - x;
      });
      var g = document.createElement("div"); g.className = "pgrid"; g.style.paddingTop = "36px";
      sorted.forEach(function (p) { g.appendChild(IBR.productCard(p)); });
      cat.appendChild(g);
      return;
    }
    order.forEach(function (id) {
      var items = list.filter(function (p) { return p.b === id; });
      if (!items.length) return;
      var b = IBR.brandMap()[id];
      var sec = document.createElement("section");
      sec.className = "bsec"; sec.id = "b-" + id;
      sec.innerHTML = '<div class="bsec-head"><div class="t"><h2 class="wm ' + (b.mark || "") + '">' + b.en + "</h2>" +
        (b.ko !== b.en ? '<span class="ko">' + b.ko + "</span>" : "") + '<span class="grp">' + GROUP[b.group] + "</span></div>" +
        '<span class="cnt">' + items.length + " ITEMS</span><p>" + b.line + "</p></div>";
      var g = document.createElement("div"); g.className = "pgrid";
      items.forEach(function (p) { g.appendChild(IBR.productCard(p)); });
      sec.appendChild(g);
      cat.appendChild(sec);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    load();
    $("#fBrands").textContent = withProducts.length;
    $("#fProducts").textContent = PR.length;
    var q = $("#q"), sort = $("#sort");
    sort.value = state.sort;
    var qt;
    q.addEventListener("input", function () { clearTimeout(qt); qt = setTimeout(function () { state.q = q.value.trim(); render(); }, 120); });
    sort.addEventListener("change", function () { state.sort = sort.value; save(); render(); });
    $("#reset").addEventListener("click", function () { state = { cat: "", brand: "", q: "", sort: "" }; q.value = ""; sort.value = ""; save(); render(); });
    addEventListener("hashchange", function () { var h = location.hash.match(/^#b-([\w-]+)$/); state.brand = h ? h[1] : ""; render(); if (state.brand) toTop(); });
    render();
    if (state.brand) setTimeout(toTop, 80);
  });
})();
