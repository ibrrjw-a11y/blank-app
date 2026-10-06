/*
  IBR 인트로 (약 8.5초, 아무 곳이나 누르거나 스크롤하면 건너뜁니다)
  1) 기획·브랜딩·퍼포먼스·홈쇼핑·이커머스… 흩어진 채널 선이 사방에서 날아와 한 점으로 모입니다.
  2) 모인 자리에서 IBR 로고가 선으로 그려지고, 빛이 한 번 지나갑니다.
  3) Imagination becomes reality · 하나의 팀으로.
  4) 뒤로 세계 지도가 밝아지며 서울에서 미국·일본·호주·유럽으로 선이 뻗습니다.
  5) 로고가 첫 화면 자리로 내려앉고 본문이 나타납니다.
*/
(function () {
  "use strict";
  var doc = document.documentElement;
  if (!doc.classList.contains("has-intro")) return;
  var IBR = window.IBR, NS = "http://www.w3.org/2000/svg";
  var intro = document.getElementById("intro");
  if (!intro || !intro.animate) { doc.classList.remove("has-intro"); return; }
  try { sessionStorage.setItem("ibr-intro", "1"); } catch (e) {}
  if (location.hash === "#intro" && history.replaceState) history.replaceState(null, "", location.pathname + location.search);

  var hero = document.querySelector(".hero");
  if (hero) hero.classList.add("pre", "pre-mark");
  var LEN = 8700;
  intro.style.setProperty("--intro-len", LEN / 1000 + "s");

  /* 스프링 easing (지원하지 않는 브라우저는 cubic-bezier 로 대체) */
  function spring(k, c, n) {
    var w = Math.sqrt(k), z = c / (2 * Math.sqrt(k)), wd = w * Math.sqrt(1 - z * z), pts = [];
    for (var i = 0; i <= n; i++) {
      var t = (i / n) * 1.6;
      pts.push((1 - Math.exp(-z * w * t * 6) * (Math.cos(wd * t * 6) + (z * w / wd) * Math.sin(wd * t * 6))).toFixed(4));
    }
    pts[n] = "1";
    return "linear(" + pts.join(",") + ")";
  }
  var SPRING = (window.CSS && CSS.supports && CSS.supports("animation-timing-function", "linear(0, 1)")) ? spring(1.6, 1.15, 48) : "cubic-bezier(.34,1.56,.64,1)";
  var INOUT = "cubic-bezier(.65,0,.35,1)", OUT = "cubic-bezier(.22,.8,.24,1)", IN = "cubic-bezier(.55,0,.85,.3)";

  var anims = [];
  function A(el, kf, o) {
    if (!el) return null;
    o.fill = o.fill || "both";
    var a = el.animate(kf, o);
    anims.push(a);
    return a;
  }
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  var stage = document.getElementById("introStage");
  var logoWrap = intro.querySelector(".logo-wrap");
  var W = innerWidth, H = innerHeight, narrow = W < 700;
  stage.setAttribute("viewBox", "0 0 " + W + " " + H);
  var lr = logoWrap.getBoundingClientRect();
  var C = [lr.left + lr.width / 2, lr.top + lr.height / 2];
  /* 로고가 내려앉을 첫 화면 자리 */
  var markEl = document.querySelector("#heroMark .ibr-logo"), LAND = null;
  if (markEl) {
    var mr = markEl.getBoundingClientRect();
    LAND = "translate(-50%,-62%) translate(" + ((mr.left + mr.width / 2) - C[0]).toFixed(1) + "px," + ((mr.top + mr.height / 2) - C[1]).toFixed(1) + "px) scale(" + (mr.width / lr.width).toFixed(4) + ")";
  }

  var defs = el("defs", {}, stage);
  var lg = el("linearGradient", { id: "introGrad", gradientUnits: "userSpaceOnUse", x1: 0, y1: 0, x2: W, y2: H }, defs);
  [["0", "#0B8DCF"], [".45", "#10A39E"], ["1", "#9CCB5B"]].forEach(function (s) { el("stop", { offset: s[0], "stop-color": s[1] }, lg); });

  /* 지도: 첫 화면과 같은 배치로 그려서 끝날 때 자연스럽게 이어지게 합니다 */
  var m = IBR.mapSize();
  var hW = hero ? hero.clientWidth : W, hH = hero ? hero.clientHeight : H;
  var s = Math.max(hW, hH * 1.25) / m.w;
  var view = { s: s, tx: hW * (hW < 760 ? .5 : .56) - (150 - m.lon0) * s, ty: hH * .5 - (m.lat0 - 18) * s };
  /* 지도 점은 SVG 가 아니라 canvas 에 한 번만 그립니다(선이 움직일 때마다 점 수천 개를 다시 그리지 않도록) */
  var mapG = document.createElement("canvas");
  mapG.className = "intro-dots"; mapG.setAttribute("aria-hidden", "true");
  stage.parentNode.insertBefore(mapG, stage);
  (function () {
    var dpr = Math.min(IBR.lowPower ? 1 : 2, window.devicePixelRatio || 1), R = Math.min(4096 / m.w, Math.max(2, s * dpr)), css = R / dpr;
    var c = mapG.getContext("2d"), pts = IBR.dotPoints(), r = .525 * R;
    mapG.width = Math.ceil(m.w * R); mapG.height = Math.ceil(m.h * R);
    mapG.style.width = (m.w * css).toFixed(1) + "px"; mapG.style.height = (m.h * css).toFixed(1) + "px";
    mapG.style.transform = "translate(" + view.tx.toFixed(1) + "px," + view.ty.toFixed(1) + "px) scale(" + (s / css).toFixed(4) + ")";
    c.fillStyle = "rgba(234,242,238,.22)"; c.beginPath();
    for (var i = 0; i < pts.length; i++) { var x = pts[i][0] * R, y = pts[i][1] * R; c.moveTo(x + r, y); c.arc(x, y, r, 0, 6.2832); }
    c.fill();
  })();

  /* 1) 채널 선 */
  var CH = [
    ["상품 기획", "PLANNING"], ["브랜딩", "BRANDING"], ["퍼포먼스 마케팅", "PERFORMANCE"], ["콘텐츠 · 바이럴", "CONTENT"],
    ["홈쇼핑", "HOME SHOPPING"], ["이커머스", "E-COMMERCE"], ["오프라인 유통", "RETAIL"], ["해외 수출", "GLOBAL"]
  ];
  var R = Math.hypot(W, H) / 2 + 60, RL = narrow ? Math.min(W, H) * .43 : Math.min(W * .42, H * .44 + 120);
  var ARRIVE = 2350;
  var lines = el("g", {}, stage), labels = el("g", {}, stage);
  CH.forEach(function (c, i) {
    var th = (-150 + i * 45 + (i % 2 ? 9 : -6)) * Math.PI / 180;
    var sx = C[0] + Math.cos(th) * R, sy = C[1] + Math.sin(th) * R;
    var bend = (i % 2 ? 1 : -1) * R * .16;
    var qx = (sx + C[0]) / 2 - Math.sin(th) * bend, qy = (sy + C[1]) / 2 + Math.cos(th) * bend;
    var d = "M" + sx.toFixed(1) + " " + sy.toFixed(1) + "Q" + qx.toFixed(1) + " " + qy.toFixed(1) + " " + C[0].toFixed(1) + " " + C[1].toFixed(1);
    var track = el("path", { class: "ch-line", d: d, stroke: "#EAF2EE", opacity: 0, "stroke-width": 1 }, lines);
    var glow = el("path", { class: "ch-line", d: d, stroke: "url(#introGrad)", "stroke-width": 10, opacity: .16, pathLength: 1, "stroke-dasharray": "0.24 3", "stroke-dashoffset": .24 }, lines);
    var comet = el("path", { class: "ch-line", d: d, stroke: "url(#introGrad)", "stroke-width": 2.6, pathLength: 1, "stroke-dasharray": "0.24 3", "stroke-dashoffset": .24 }, lines);
    var start = 380 + i * 95;
    A(track, [{ opacity: 0 }, { opacity: .12, offset: .25 }, { opacity: .12, offset: .8 }, { opacity: 0 }], { duration: ARRIVE + 200 - start + 300, delay: start - 250 });
    A(comet, [{ strokeDashoffset: .24 }, { strokeDashoffset: -1 }], { duration: ARRIVE - start, delay: start, easing: IN, fill: "forwards" });
    A(glow, [{ strokeDashoffset: .24 }, { strokeDashoffset: -1 }], { duration: ARRIVE - start, delay: start, easing: IN, fill: "forwards" });

    /* 이름표: 선이 지나가는 자리 */
    var right = Math.cos(th) >= 0, lx, ly, anchor;
    if (narrow) {
      /* 좁은 화면: 이름표를 좌우 가장자리에 세로로 나눠 겹치지 않게 */
      lx = right ? W - 18 : 18; anchor = right ? "end" : "start";
      ly = C[1] + Math.sin(th) * H * .38;
    } else {
      lx = C[0] + Math.cos(th) * RL; ly = C[1] + Math.sin(th) * RL; anchor = right ? "start" : "end";
    }
    lx = Math.max(16, Math.min(W - 16, lx));
    ly = Math.max(70, Math.min(H - 70, ly));
    var t = el("text", { class: "ch-label", x: lx, y: ly, "text-anchor": anchor }, labels);
    var t1 = el("tspan", { x: lx, dy: 0 }, t); t1.textContent = c[0];
    var t2 = el("tspan", { class: "en", x: lx, dy: 18 }, t); t2.textContent = c[1];
    A(t, [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 520, delay: start - 120, easing: OUT });
    A(t, [{ opacity: 1 }, { opacity: 0 }], { duration: 420, delay: ARRIVE - 520 + i * 25, fill: "forwards", composite: "replace" });
  });

  /* 모이는 순간: 고리 */
  var pulse = el("circle", { class: "pulse", cx: C[0], cy: C[1], r: 10, stroke: "url(#introGrad)", opacity: 0 }, stage);
  var pulse2 = el("circle", { class: "pulse", cx: C[0], cy: C[1], r: 10, stroke: "#EAF2EE", opacity: 0 }, stage);
  var big = Math.min(W, H) * .55;
  A(pulse, [{ r: 4, opacity: .9, strokeWidth: 3 }, { r: big, opacity: 0, strokeWidth: .5 }], { duration: 1300, delay: ARRIVE - 40, easing: "cubic-bezier(.2,.7,.2,1)", fill: "forwards" });
  A(pulse2, [{ r: 2, opacity: .5 }, { r: big * .6, opacity: 0 }], { duration: 1000, delay: ARRIVE + 120, easing: "cubic-bezier(.2,.7,.2,1)", fill: "forwards" });
  var flash = el("circle", { cx: C[0], cy: C[1], r: 7, fill: "#EAF2EE", opacity: 0 }, stage);
  A(flash, [{ opacity: 0, transform: "scale(.2)" }, { opacity: 1, transform: "scale(1)", offset: .3 }, { opacity: 0, transform: "scale(.4)" }], { duration: 520, delay: ARRIVE - 80 });
  flash.style.transformBox = "fill-box"; flash.style.transformOrigin = "center";

  /* 2) 로고 그리기 */
  var parts = logoWrap.querySelectorAll("path");
  var LT = [[ARRIVE - 20, 620], [ARRIVE + 80, 1000], [ARRIVE + 260, 900], [ARRIVE + 640, 520]];
  parts.forEach(function (p, i) {
    p.style.strokeDasharray = "1 1.1";
    A(p, [{ strokeDashoffset: 1.05 }, { strokeDashoffset: 0 }], { duration: LT[i][1], delay: LT[i][0], easing: INOUT });
  });
  A(logoWrap, [{ transform: "translate(-50%,-62%) scale(.9)" }, { transform: "translate(-50%,-62%) scale(1)" }], { duration: 1400, delay: ARRIVE, easing: SPRING });

  /* 빛 한 줄기: 로고 모양으로 가린 띠가 지나갑니다 */
  var sheen = document.createElement("div");
  var maskSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 212 100"><g fill="none" stroke="#fff" stroke-width="13">' +
    [].map.call(parts, function (p) { return '<path d="' + p.getAttribute("d") + '"/>'; }).join("") + "</g></svg>";
  var url = 'url("data:image/svg+xml;utf8,' + encodeURIComponent(maskSvg) + '")';
  sheen.style.cssText = "position:absolute;inset:0;pointer-events:none;-webkit-mask:" + url + " center/100% 100% no-repeat;mask:" + url + " center/100% 100% no-repeat;" +
    "background:linear-gradient(100deg,transparent 35%,rgba(255,255,255,.9) 50%,transparent 65%) no-repeat;background-size:240% 100%;background-position:120% 0;clip-path:inset(0 0 0 0)";
  logoWrap.appendChild(sheen);
  A(sheen, [{ backgroundPosition: "130% 0" }, { backgroundPosition: "-30% 0" }], { duration: 1100, delay: ARRIVE + 1350, easing: "cubic-bezier(.4,0,.2,1)" });

  /* 3) 문장 */
  var en = intro.querySelector(".en-line"), ko = intro.querySelector(".ko-line");
  en.innerHTML = en.textContent.split("").map(function (ch) { return "<span>" + (ch === " " ? "&nbsp;" : ch) + "</span>"; }).join("");
  [].forEach.call(en.children, function (sp, i) {
    A(sp, [{ opacity: 0, transform: "translateY(.5em)" }, { opacity: 1, transform: "none" }], { duration: 640, delay: ARRIVE + 1300 + i * 26, easing: OUT });
  });
  A(ko, [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 760, delay: ARRIVE + 2350, easing: OUT });

  /* 4) 로고가 첫 화면 자리로 내려앉고, 서울에서 세계로 선이 뻗습니다 */
  var WORLD = ARRIVE + 3050, GLIDE = WORLD + 150, ARCS = WORLD + 800;
  A(intro.querySelector(".tagline"), [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-10px)" }], { duration: 520, delay: WORLD, fill: "forwards", easing: OUT });
  if (LAND) A(logoWrap, [{ transform: "translate(-50%,-62%) scale(1)" }, { transform: LAND }], { duration: 1100, delay: GLIDE, easing: INOUT, fill: "forwards" });
  else A(logoWrap, [{ opacity: 1 }, { opacity: 0 }], { duration: 600, delay: GLIDE, fill: "forwards" });
  A(mapG, [{ opacity: 0 }, { opacity: .3, offset: .18 }, { opacity: .3, offset: .8 }, { opacity: 1 }], { duration: ARCS + 500, easing: "linear" });
  var arcG = el("g", {}, stage);
  var KR = IBR.proj(view, 127, 37.5);
  [["US", 265.8, 36.4], ["JP", 139.7, 35.7], ["AU", 153, -27.5], ["GR", 23.7, 38], ["SG", 103.8, 1.35], ["CA", 280.6, 43.7], ["FR", 2.35, 48.85]].forEach(function (d, i) {
    var b = IBR.proj(view, d[1], d[2]);
    var p = el("path", { d: IBR.arcPath(KR, b, .3), fill: "none", stroke: "url(#introGrad)", "stroke-width": 1.8, "stroke-linecap": "round", pathLength: 1, "stroke-dasharray": "1 1.1", "stroke-dashoffset": 1.05 }, arcG);
    A(p, [{ strokeDashoffset: 1.05 }, { strokeDashoffset: 0 }], { duration: 1100, delay: ARCS + i * 110, easing: INOUT, fill: "forwards" });
    var dot = el("circle", { cx: b[0], cy: b[1], r: 3, fill: "#EAF2EE", opacity: 0 }, arcG);
    A(dot, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: ARCS + i * 110 + 950, fill: "forwards" });
  });
  var kr = el("circle", { cx: KR[0], cy: KR[1], r: 4.5, fill: "#9CCB5B", opacity: 0 }, arcG);
  A(kr, [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: ARCS - 150, fill: "forwards" });
  var krRing = el("circle", { cx: KR[0], cy: KR[1], r: 4, fill: "none", stroke: "#9CCB5B", "stroke-width": 1.2, opacity: 0 }, arcG);
  A(krRing, [{ r: 4, opacity: .9 }, { r: 26, opacity: 0 }], { duration: 1200, delay: ARCS - 100, easing: OUT, fill: "forwards" });

  /* 5) 첫 화면으로 */
  var EXIT = ARCS + 1350, done = false;
  var exitTimer = setTimeout(exit, EXIT);
  function exit(fast) {
    if (done) return;
    done = true;
    clearTimeout(exitTimer);
    var dur = fast ? 480 : 900;
    if (fast) anims.forEach(function (a) { try { a.finish(); } catch (e) {} });
    stage.animate([{ opacity: 1 }, { opacity: 0 }], { duration: dur, fill: "forwards" });
    intro.animate([{ backgroundColor: "rgba(7,17,15,1)" }, { backgroundColor: "rgba(7,17,15,0)" }], { duration: dur, fill: "forwards", easing: "linear" });
    intro.querySelector(".skip-intro").animate([{ opacity: 0 }], { duration: 200, fill: "forwards" });
    if (IBR.startHeroArcs) setTimeout(IBR.startHeroArcs, dur * .6);
    if (hero) {
      hero.classList.remove("pre");
      [].forEach.call(hero.querySelectorAll(".copy > *, .pillars a"), function (k, i) {
        k.animate([{ opacity: 0, transform: "translateY(26px)" }, { opacity: 1, transform: "none" }], { duration: 900, delay: dur * .25 + i * 80, easing: OUT, fill: "backwards" });
      });
    }
    setTimeout(function () {
      if (hero) hero.classList.remove("pre", "pre-mark");
      intro.remove();
      doc.classList.remove("has-intro");
      removeListeners();
    }, dur + 40);
  }

  /* 건너뛰기 */
  var t0 = performance.now();
  function skip(e) {
    if (performance.now() - t0 < 250) return;
    if (e && e.type === "keydown" && ["Tab", "Shift"].indexOf(e.key) > -1) return;
    exit(true);
  }
  var EV = ["click", "wheel", "touchstart", "keydown"];
  EV.forEach(function (ev) { addEventListener(ev, skip, { passive: true }); });
  function removeListeners() { EV.forEach(function (ev) { removeEventListener(ev, skip, { passive: true }); }); }
})();
