/* IBR 메인: 첫 화면 지도, 스크롤 장면(통합 마케팅·글로벌), 브랜드 목록, 대표 제품, 차트 */
(function () {
  "use strict";
  var IBR = window.IBR, clamp = IBR.clamp, ease = IBR.ease;
  var NS = "http://www.w3.org/2000/svg";
  var P = IBR.PLACES;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }
  function svgEl(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function gradDefs(svg, id) {
    var defs = svgEl("defs", {}, svg);
    var g = svgEl("linearGradient", { id: id, x1: "0", y1: "0", x2: "1", y2: "0" }, defs);
    [["0", "#0B8DCF"], [".45", "#10A39E"], ["1", "#9CCB5B"]].forEach(function (s) { svgEl("stop", { offset: s[0], "stop-color": s[1] }, g); });
  }
  /* 지도 하나를 그립니다: 점(도 단위 경로를 transform 으로 확대) + 화면 좌표 레이어 */
  function makeMap(svg, gradId) {
    svg.innerHTML = "";
    gradDefs(svg, gradId);
    var dotsG = svgEl("g", {}, svg);
    svgEl("path", { class: "dots", d: IBR.worldDots(), stroke: "#EAF2EE", "stroke-width": "1.05", "stroke-linecap": "round", fill: "none" }, dotsG);
    var arcs = svgEl("g", {}, svg), nodes = svgEl("g", {}, svg);
    return { svg: svg, dotsG: dotsG, arcs: arcs, nodes: nodes, view: { s: 1, tx: 0, ty: 0 } };
  }
  function setView(m, s, tx, ty) {
    m.view = { s: s, tx: tx, ty: ty };
    m.dotsG.setAttribute("transform", "translate(" + tx.toFixed(1) + " " + ty.toFixed(1) + ") scale(" + s.toFixed(4) + ")");
  }
  function xy(m, code) { var p = P[code]; return IBR.proj(m.view, p.lon, p.lat); }

  /* ── ① 첫 화면 ─────────────────────────────── */
  var hero = $(".hero"), heroSvg = $("#heroMap"), heroMap = null;
  var ROUTES = [["KR", "US"], ["GR", "KR"], ["KR", "JP"], ["AU", "KR"], ["KR", "SG"], ["FR", "KR"], ["KR", "CA"], ["KR", "TW"], ["IT", "KR"], ["KR", "VN"], ["NZ", "KR"], ["KR", "HK"]];
  function layoutHero() {
    if (!heroSvg) return;
    if (!heroMap) heroMap = makeMap(heroSvg, "heroArc");
    var W = hero.clientWidth, H = hero.clientHeight, m = IBR.mapSize();
    var s = Math.max(W, H * 1.25) / m.w;
    var kr = P.KR, focusLon = W < 760 ? 150 : 150;
    var tx = W * (W < 760 ? .5 : .56) - (focusLon - m.lon0) * s;
    var ty = H * .5 - (m.lat0 - 18) * s;
    setView(heroMap, s, tx, ty);
    heroSvg.setAttribute("viewBox", "0 0 " + W + " " + H);
    heroMap.nodes.innerHTML = "";
    var k = xy(heroMap, "KR");
    var g = svgEl("g", { class: "node hq" }, heroMap.nodes);
    svgEl("circle", { cx: k[0], cy: k[1], r: 3.2, fill: "#9CCB5B" }, g);
    heroMap.kr = k;
  }
  var heroTimer = null, routeI = 0;
  function heroArc() {
    if (!heroMap || IBR.reduce || document.hidden) return;
    var r = ROUTES[routeI++ % ROUTES.length];
    var a = xy(heroMap, r[0]), b = xy(heroMap, r[1]);
    var path = svgEl("path", { d: IBR.arcPath(a, b, .26), fill: "none", stroke: "url(#heroArc)", "stroke-width": 1.4, "stroke-linecap": "round", pathLength: 1, "stroke-dasharray": "0.3 2", opacity: .9 }, heroMap.arcs);
    var dot = svgEl("circle", { cx: b[0], cy: b[1], r: 2.6, fill: "#EAF2EE", opacity: 0 }, heroMap.arcs);
    var an = path.animate([{ strokeDashoffset: 0.3 }, { strokeDashoffset: -1 }], { duration: 2600, easing: "cubic-bezier(.45,0,.25,1)" });
    dot.animate([{ opacity: 0 }, { opacity: 0, offset: .55 }, { opacity: 1, offset: .7 }, { opacity: 0 }], { duration: 3000 });
    an.onfinish = function () { path.remove(); setTimeout(function () { dot.remove(); }, 500); };
  }
  function startHeroArcs() { if (!heroTimer && !IBR.reduce) { heroArc(); heroTimer = setInterval(heroArc, 1300); } }
  IBR.startHeroArcs = startHeroArcs;

  /* ── ② 통합 마케팅 장면 ─────────────────────────────── */
  var one = $(".oneteam"), stage = $("#oneStage"), tiles = $$(".tile", stage || document);
  var SCATTER = [[.30, .02, -7], [.82, .17, 6], [.06, .33, 4], [.62, .49, -5], [.18, .68, 7], [.74, .84, -4]];
  var oneP = -1;
  function oneScene() {
    if (!one || !stage) return;
    var r = one.getBoundingClientRect(), vh = innerHeight;
    var p = IBR.reduce ? 1 : clamp((-r.top + vh * .15) / (r.height - vh * 1.1), 0, 1);
    if (Math.abs(p - oneP) < 0.0005) return;
    oneP = p;
    var sw = stage.clientWidth, sh = stage.clientHeight;
    var tw = tiles[0] ? tiles[0].offsetWidth : 300, th = tiles[0] ? tiles[0].offsetHeight : 60;
    var gap = (sh - th * tiles.length) / (tiles.length - 1);
    tiles.forEach(function (t, i) {
      var sc = SCATTER[i];
      var local = ease(clamp((p - .12 - i * .035) / .42, 0, 1));
      var x0 = sc[0] * Math.max(0, sw - tw), y0 = sc[1] * (sh - th);
      var x1 = 0, y1 = i * (th + gap);
      t.style.setProperty("--x", (x0 + (x1 - x0) * local).toFixed(1) + "px");
      t.style.setProperty("--y", (y0 + (y1 - y0) * local).toFixed(1) + "px");
      t.style.setProperty("--r", (sc[2] * (1 - local)).toFixed(2) + "deg");
    });
    one.style.setProperty("--p", p.toFixed(3));
    stage.style.setProperty("--join", ease(clamp((p - .62) / .25, 0, 1)).toFixed(3));
    one.classList.toggle("joined", p > .58);
  }

  /* ── ⑥ 글로벌 장면 ─────────────────────────────── */
  var glob = $(".global"), wsvg = $("#worldMap"), wrapEl = $("#worldWrap"), world = null;
  var STEPS = [
    { arcs: [["KR", "US"], ["KR", "CA"], ["KR", "JP"]], nodes: ["KR", "US", "CA", "JP"], focus: 196 },
    { arcs: [["GR", "KR"], ["AU", "KR"], ["FR", "KR"], ["IT", "KR"], ["UK", "KR"], ["JP", "KR"], ["NZ", "KR"]], nodes: ["KR", "GR", "AU", "FR", "IT", "UK", "JP", "NZ"], focus: 88 },
    { arcs: [["KR", "CN"], ["KR", "HK"], ["KR", "TW"], ["KR", "VN"], ["KR", "TH"], ["KR", "SG"], ["KR", "ID"], ["GR", "JP"], ["GR", "US"]], nodes: ["KR", "CN", "HK", "TW", "VN", "TH", "SG", "ID", "JP", "GR", "US"], focus: 120 }
  ];
  var curStep = -1, focusNow = null, focusAnim = null, narrow = false;
  function layoutWorld(focusLon) {
    if (!wsvg || !wrapEl) return;
    if (!world) world = makeMap(wsvg, "arcGrad");
    var W = wrapEl.clientWidth, H = wrapEl.clientHeight, m = IBR.mapSize();
    if (!W || !H) return;
    wsvg.setAttribute("viewBox", "0 0 " + W + " " + H);
    narrow = W < 700;
    var s, tx, ty;
    if (!narrow) {
      s = Math.min(W / (m.w * .9), H / (m.h * .86));
      tx = (W - m.w * s) / 2 + W * .02; ty = (H - m.h * s) / 2 - H * .02;
    } else {
      s = W / 168;
      if (s * m.h > H * 1.05) s = H * 1.05 / m.h;
      tx = W / 2 - ((focusLon == null ? 196 : focusLon) - m.lon0) * s;
      ty = H / 2 - (m.lat0 - 14) * s;
    }
    setView(world, s, tx, ty);
  }
  function drawStep(i, animate) {
    if (!world) return;
    var st = STEPS[i];
    world.arcs.innerHTML = ""; world.nodes.innerHTML = "";
    st.arcs.forEach(function (r, j) {
      var a = xy(world, r[0]), b = xy(world, r[1]);
      var d = IBR.arcPath(a, b, .28);
      svgEl("path", { class: "arc-glow", d: d }, world.arcs);
      var p = svgEl("path", { class: "arc", d: d, pathLength: 1, "stroke-dasharray": "1 1", "stroke-dashoffset": animate ? 1 : 0 }, world.arcs);
      if (animate && !IBR.reduce) p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 1100, delay: 120 + j * 110, easing: "cubic-bezier(.65,0,.35,1)", fill: "forwards" });
    });
    Object.keys(P).forEach(function (code) {
      var on = st.nodes.indexOf(code) > -1;
      var c = xy(world, code);
      var g = svgEl("g", { class: "node " + (on ? "on" : "off") + (code === "KR" ? " hq" : "") }, world.nodes);
      if (on) svgEl("circle", { class: "h", cx: c[0], cy: c[1], r: 6 }, g);
      svgEl("circle", { class: "c", cx: c[0], cy: c[1], r: code === "KR" ? 4 : 2.6 }, g);
      if (on) {
        var pl = P[code], W0 = wrapEl.clientWidth;
        var right = pl.side !== "l";
        if (right && c[0] > W0 - 90) right = false;
        if (!right && c[0] < 90) right = true;
        var t = svgEl("text", { x: c[0] + (right ? 9 : -9), y: c[1] + 4 + (pl.dy || 0), "text-anchor": right ? "start" : "end" }, g);
        t.textContent = P[code].name;
      }
    });
  }
  function setStep(i, force) {
    if (i === curStep && !force) return;
    curStep = i;
    $$(".step", glob).forEach(function (s, j) { s.classList.toggle("on", j === i); s.setAttribute("aria-selected", String(j === i)); });
    $$(".step-dots i", glob).forEach(function (d, j) { d.classList.toggle("on", j === i); });
    if (narrow && !IBR.reduce) {
      var from = focusNow == null ? STEPS[i].focus : focusNow, to = STEPS[i].focus, t0 = performance.now();
      if (focusAnim) cancelAnimationFrame(focusAnim);
      (function pan(now) {
        var t = clamp((now - t0) / 800, 0, 1);
        focusNow = from + (to - from) * ease(t);
        layoutWorld(focusNow);
        if (t < 1) focusAnim = requestAnimationFrame(pan); else drawStep(i, true);
      })(t0);
      if (world) { world.arcs.innerHTML = ""; world.nodes.innerHTML = ""; }
    } else {
      focusNow = STEPS[i].focus;
      layoutWorld(focusNow);
      drawStep(i, true);
    }
  }
  function globScene() {
    if (!glob) return;
    var r = glob.getBoundingClientRect(), vh = innerHeight;
    var p = clamp(-r.top / (r.height - vh), 0, 1);
    if (r.bottom < 0 || r.top > vh) return;
    setStep(p < .36 ? 0 : p < .7 ? 1 : 2);
  }
  if (glob) {
    $$(".step", glob).forEach(function (s, j) {
      function go() {
        var r = glob.getBoundingClientRect(), top = scrollY + r.top, span = glob.offsetHeight - innerHeight;
        var target = [.15, .53, .86][j];
        scrollTo({ top: top + span * target, behavior: IBR.reduce ? "auto" : "smooth" });
        setStep(j);
      }
      s.addEventListener("click", go);
      s.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    });
  }

  /* ── ⑦ 브랜드 ─────────────────────────────── */
  var GROUPS = [["own", "자사 브랜드"], ["global", "글로벌 소싱"], ["dist", "유통 브랜드"], ["all", "전체"]];
  var ORIGIN = { KR: "KOREA", US: "USA", AU: "AUSTRALIA", GR: "GREECE", JP: "JAPAN", FR: "FRANCE", UK: "UK", NZ: "NEW ZEALAND", IT: "ITALY", CZ: "CZECH", AT: "AUSTRIA" };
  function brandCard(b, count) {
    var el = document.createElement("article");
    el.className = "bcard" + (count ? " link" : "");
    var cats = (b.cat || []).map(function (c) { return "<span>" + (window.IBR_CATS[c] || c) + "</span>"; }).join("");
    el.innerHTML =
      '<div class="top"><div><p class="wm ' + (b.mark || "") + '">' + b.en + "</p>" + (b.ko !== b.en ? '<p class="ko">' + b.ko + "</p>" : "") + "</div>" +
      '<span class="origin">' + (ORIGIN[b.origin] || "") + "</span></div>" +
      '<div class="cats">' + cats + "</div>" +
      "<p>" + b.line + "</p>" +
      '<div class="foot">' + (count ? '<a href="products.html#b-' + b.id + '">제품 ' + count + "종 " + IBR.ARROW + "</a>" : '<span class="none">제품 정보 준비 중</span>') +
      "</div>";
    return el;
  }
  function renderBrands() {
    var tabs = $("#brandTabs"), grid = $("#brandGrid");
    if (!tabs || !grid || !window.IBR_BRANDS) return;
    var counts = {};
    window.IBR_PRODUCTS.forEach(function (p) { counts[p.b] = (counts[p.b] || 0) + 1; });
    var cur = "own";
    try { cur = sessionStorage.getItem("ibr-brand-tab") || "own"; } catch (e) {}
    GROUPS.forEach(function (g) {
      var n = g[0] === "all" ? window.IBR_BRANDS.length : window.IBR_BRANDS.filter(function (b) { return b.group === g[0]; }).length;
      var t = document.createElement("button");
      t.type = "button"; t.className = "tab"; t.setAttribute("role", "tab"); t.dataset.g = g[0];
      t.innerHTML = g[1] + ' <span class="c">' + n + "</span>";
      t.addEventListener("click", function () { cur = g[0]; try { sessionStorage.setItem("ibr-brand-tab", cur); } catch (e) {} draw(); });
      tabs.appendChild(t);
    });
    function draw() {
      $$(".tab", tabs).forEach(function (t) { t.setAttribute("aria-selected", String(t.dataset.g === cur)); });
      grid.innerHTML = "";
      window.IBR_BRANDS.filter(function (b) { return cur === "all" || b.group === cur; }).forEach(function (b) { grid.appendChild(brandCard(b, counts[b.id] || 0)); });
    }
    draw();
  }

  /* ── ⑧ 대표 제품 ─────────────────────────────── */
  function renderRail() {
    var rail = $("#productRail");
    if (!rail || !window.IBR_PRODUCTS) return;
    window.IBR_PRODUCTS.filter(function (p) { return p.top && p.opts[0][1] != null; }).forEach(function (p) { rail.appendChild(IBR.productCard(p)); });
    var all = $("#allProducts");
    if (all) all.firstChild.textContent = "전체 제품 " + window.IBR_PRODUCTS.length + "종 보기 ";
  }

  /* ── ④ 차트 ─────────────────────────────── */
  function renderChart() {
    var body = $("#hsChartBody"), fig = $("#hsChart");
    if (!body) return;
    var data = [[2020, 398], [2021, 1921], [2022, 3655], [2023, 4938], [2024, 5939], [2025, 6208]];
    var x0 = 52, x1 = 552, y0 = 262, y1 = 22, max = 7000;
    var bw = (x1 - x0) / data.length;
    var h = "";
    [0, 2000, 4000, 6000].forEach(function (v) {
      var y = y0 - (v / max) * (y0 - y1);
      h += '<line class="grid-l" x1="' + x0 + '" x2="' + x1 + '" y1="' + y + '" y2="' + y + '"/>';
      h += '<text class="ax" x="' + (x0 - 10) + '" y="' + (y + 4) + '" text-anchor="end">' + IBR.won(v) + "</text>";
    });
    data.forEach(function (d, i) {
      var x = x0 + i * bw + bw * .2, w = bw * .6, hh = (d[1] / max) * (y0 - y1), y = y0 - hh;
      h += '<rect class="bar' + (i === data.length - 1 ? " last" : "") + '" style="--i:' + i + '" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + hh.toFixed(1) + '" rx="2"/>';
      h += '<text class="val" x="' + (x + w / 2).toFixed(1) + '" y="' + (y - 9).toFixed(1) + '">' + IBR.won(d[1]) + "</text>";
      h += '<text class="ax" x="' + (x + w / 2).toFixed(1) + '" y="' + (y0 + 22) + '" text-anchor="middle">' + d[0] + "</text>";
    });
    body.innerHTML = h;
    if (IBR.reduce || !("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { fig.classList.add("anim"); io.disconnect(); }
    }, { threshold: .35 });
    io.observe(fig);
  }

  /* ── scroll loop ─────────────────────────────── */
  var timeline = $("#timeline"), ticking = false;
  function frame() {
    ticking = false;
    var vh = innerHeight;
    if (hero) {
      var hr = hero.getBoundingClientRect();
      hero.style.setProperty("--hp", clamp(-hr.top / hr.height, 0, 1).toFixed(3));
    }
    oneScene();
    globScene();
    if (timeline) {
      var tr = timeline.getBoundingClientRect();
      var tp = clamp((vh * .85 - tr.top) / (tr.height + vh * .3), 0, 1);
      timeline.style.setProperty("--tp", tp.toFixed(3));
      $$(".era", timeline).forEach(function (e, i, arr) { e.classList.toggle("lit", tp >= i / arr.length); });
    }
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  addEventListener("scroll", onScroll, { passive: true });
  var rz;
  addEventListener("resize", function () {
    clearTimeout(rz);
    rz = setTimeout(function () { layoutHero(); oneP = -1; layoutWorld(focusNow); if (curStep > -1) setStep(curStep, true); frame(); }, 120);
  });

  document.addEventListener("DOMContentLoaded", function () {
    layoutHero();
    layoutWorld(null);
    renderBrands();
    renderRail();
    renderChart();
    frame();
    if (!document.documentElement.classList.contains("has-intro")) startHeroArcs();
  });
})();
