/* IBR 공통 스크립트: 머리말, 모바일 메뉴, 나타나기, 숫자 세기, 흐르는 띠, 지도, 제품 카드 */
(function () {
  "use strict";
  var doc = document.documentElement;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var IBR = (window.IBR = window.IBR || {});
  IBR.reduce = reduce;
  doc.classList.add("js");

  /* 제품 id 부여 + 사진·상세 이미지(ibr-media.js, 자동 생성) 합치기 */
  (function () {
    var MEDIA = window.IBR_MEDIA || {}, n = {};
    (window.IBR_PRODUCTS || []).forEach(function (p) {
      n[p.b] = (n[p.b] || 0) + 1;
      if (!p.id) p.id = p.b + "-" + n[p.b];
      if (p.full) p.imgFull = true; /* 관리자 화면에서 '배경 있는 사진'으로 넣은 사진 */
      var m = MEDIA[p.b + "|" + p.n];
      if (m) {
        if (m.img) { p.img = m.img; p.imgFull = !!m.full; }
        if (m.detail && m.detail.length) p.detail = m.detail;
      }
      /* 모든 제품 카드는 제품 화면(사진·용량별 소비자가·구매처·상세)으로 이어집니다 */
      if (!p.url) p.url = "product.html#p-" + p.id;
    });
  })();
  if (reduce) doc.classList.add("no-motion");

  IBR.ARROW = '<svg viewBox="0 0 16 12" aria-hidden="true"><path d="M0 6h14M9 1l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
  IBR.clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  IBR.ease = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  IBR.won = function (n) { return n.toLocaleString("ko-KR"); };
  /* 휴대폰·터치 기기: 그림 해상도와 움직임을 조금 줄여 가볍게 */
  IBR.lowPower = !!(window.matchMedia && matchMedia("(hover: none), (max-width: 760px)").matches);

  /* ── header ─────────────────────────────── */
  var header = document.querySelector(".site-header");
  function onScrollHeader() {
    if (!header) return;
    header.classList.toggle("scrolled", window.scrollY > 8);
  }
  addEventListener("scroll", onScrollHeader, { passive: true });
  onScrollHeader();

  var toggle = document.querySelector(".menu-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var open = !doc.classList.contains("menu-open");
      doc.classList.toggle("menu-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
    });
    document.querySelectorAll(".mobile-nav a").forEach(function (a) {
      a.addEventListener("click", function () {
        doc.classList.remove("menu-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* 현재 보고 있는 구역을 메뉴에 표시 */
  var navLinks = [].slice.call(document.querySelectorAll('.gnb a[href^="#"]'));
  if (navLinks.length && "IntersectionObserver" in window) {
    var secIo = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        navLinks.forEach(function (a) { a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id); });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    navLinks.forEach(function (a) {
      var t = document.querySelector(a.getAttribute("href"));
      if (t) secIo.observe(t);
    });
  }

  /* ── reveal ─────────────────────────────── */
  IBR.reveal = function (root) {
    var els = [].slice.call((root || document).querySelectorAll(".rv:not(.in)"));
    if (reduce || !("IntersectionObserver" in window)) { els.forEach(function (el) { el.classList.add("in"); }); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.01 });
    els.forEach(function (el) { io.observe(el); });
  };

  /* ── counters ─────────────────────────────── */
  IBR.counters = function (root) {
    var els = [].slice.call((root || document).querySelectorAll("[data-count]"));
    function run(el) {
      var to = parseFloat(el.getAttribute("data-count"));
      var out = el.querySelector(".v") || el;
      if (reduce) { out.textContent = IBR.won(to); return; }
      var t0 = performance.now(), dur = 1600;
      (function tick(now) {
        var t = IBR.clamp((now - t0) / dur, 0, 1);
        out.textContent = IBR.won(Math.round(to * (1 - Math.pow(1 - t, 4))));
        if (t < 1) requestAnimationFrame(tick);
      })(t0);
    }
    if (!("IntersectionObserver" in window)) { els.forEach(run); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.4 });
    els.forEach(function (el) { io.observe(el); });
  };

  /* ── marquee belts (스크롤 속도에 따라 빨라집니다) ─────────────────────────────── */
  IBR.marquees = function () {
    var belts = [].slice.call(document.querySelectorAll(".marquee .belt"));
    if (!belts.length) return;
    var items = belts.map(function (belt) {
      var base = belt.innerHTML;
      belt.innerHTML = base + base;
      return { el: belt, x: 0, dir: belt.getAttribute("data-dir") === "r" ? 1 : -1, speed: parseFloat(belt.getAttribute("data-speed") || "40"), vis: true, half: 0 };
    });
    function measure() {
      items.forEach(function (it) {
        it.el.style.transform = "";
        it.half = it.el.scrollWidth / 2;
        var vw = it.el.parentNode.clientWidth;
        while (it.half > 0 && it.half < vw && it.el.children.length < 80) {
          it.el.innerHTML += it.el.innerHTML;
          it.half = it.el.scrollWidth / 2;
        }
      });
    }
    measure();
    addEventListener("resize", measure);
    if (reduce) return;
    var running = false;
    function kick() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); } }
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { items.forEach(function (it) { if (it.el === e.target) it.vis = e.isIntersecting; }); });
        if (items.some(function (it) { return it.vis; })) kick();
      });
      items.forEach(function (it) { io.observe(it.el); });
    }
    var lastY = scrollY, boost = 0, last = performance.now();
    /* 띠가 화면에 보일 때만 돕니다 */
    function loop(now) {
      if (!items.some(function (it) { return it.vis; })) { running = false; return; }
      var dt = Math.min(64, now - last) / 1000; last = now;
      var dy = Math.abs(scrollY - lastY); lastY = scrollY;
      boost += (Math.min(dy * 1.4, 260) - boost) * 0.08;
      items.forEach(function (it) {
        if (!it.vis || !it.half) return;
        it.x += it.dir * (it.speed + boost) * dt;
        if (it.x <= -it.half) it.x += it.half;
        if (it.x > 0) it.x -= it.half;
        it.el.style.transform = "translate3d(" + it.x.toFixed(2) + "px,0,0)";
      });
      requestAnimationFrame(loop);
    }
    kick();
  };

  /* ── 화면 밖 구역의 반복 애니메이션(CSS)은 멈춰 둡니다 ─────────────────────────────── */
  if ("IntersectionObserver" in window) {
    var offIo = new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.target.classList.toggle("off", !e.isIntersecting); });
    }, { rootMargin: "120px 0px" });
    document.addEventListener("DOMContentLoaded", function () { [].forEach.call(document.querySelectorAll("main > section"), function (sec) { offIo.observe(sec); }); });
  }

  /* ── copy buttons ─────────────────────────────── */
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-copy]");
    if (!b) return;
    var text = b.getAttribute("data-copy");
    function done(ok) {
      var label = b.textContent;
      b.textContent = ok ? "복사했습니다" : "직접 선택해 복사하세요";
      setTimeout(function () { b.textContent = label; }, 1800);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { selectNear(); done(false); });
    } else { selectNear(); done(false); }
    function selectNear() {
      var t = b.parentNode.querySelector(".mail");
      if (!t) return;
      var r = document.createRange(); r.selectNodeContents(t);
      var s = getSelection(); s.removeAllRanges(); s.addRange(r);
    }
  });

  /* ── world map helpers ─────────────────────────────── */
  var W = window.IBR_WORLD;
  /* 지도 위 지점: 경도·위도, 이름, 이름표 방향(l/r)과 위아래 보정 */
  IBR.PLACES = {
    KR: { lon: 127, lat: 37.5, name: "SEOUL", side: "l", dy: -6 }, JP: { lon: 139.7, lat: 35.7, name: "JAPAN", side: "r", dy: 2 },
    CN: { lon: 121.5, lat: 31.2, name: "CHINA", side: "l", dy: 2 }, HK: { lon: 114.2, lat: 22.3, name: "HONG KONG", side: "l", dy: 4 },
    TW: { lon: 121.5, lat: 25.0, name: "TAIWAN", side: "r", dy: 2 }, VN: { lon: 106.7, lat: 10.8, name: "VIETNAM", side: "r", dy: 2 },
    TH: { lon: 100.5, lat: 13.75, name: "THAILAND", side: "l", dy: 0 }, SG: { lon: 103.8, lat: 1.35, name: "SINGAPORE", side: "l", dy: 4 },
    ID: { lon: 106.8, lat: -6.2, name: "INDONESIA", side: "r", dy: 6 }, AU: { lon: 153.0, lat: -27.5, name: "AUSTRALIA", side: "r", dy: 2 },
    NZ: { lon: 174.8, lat: -36.8, name: "NEW ZEALAND", side: "r", dy: 4 }, GR: { lon: 23.7, lat: 38.0, name: "GREECE", side: "r", dy: 6 },
    IT: { lon: 9.2, lat: 45.5, name: "ITALY", side: "r", dy: 4 }, FR: { lon: 2.35, lat: 48.85, name: "FRANCE", side: "l", dy: 6 },
    UK: { lon: -0.12, lat: 51.5, name: "UK", side: "l", dy: -4 }, US: { lon: 265.8, lat: 36.4, name: "USA", side: "l", dy: 4 },
    CA: { lon: 280.6, lat: 43.7, name: "CANADA", side: "r", dy: -4 }
  };
  /* 육지 점들을 '도(degree)' 좌표의 경로 하나로 만듭니다. 점 하나 = 길이 0인 선 + 둥근 끝. */
  IBR.worldDots = function () {
    if (IBR._dots) return IBR._dots;
    if (!W) return "";
    var raw = atob(W.bits), d = [], i = 0;
    for (var r = 0; r < W.rows; r++) {
      for (var c = 0; c < W.cols; c++, i++) {
        if ((raw.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1) d.push("M" + ((c + .5) * W.step).toFixed(2) + " " + ((r + .5) * W.step).toFixed(2) + "h0");
      }
    }
    return (IBR._dots = d.join(""));
  };
  /* 같은 점들을 좌표 목록으로 (지도 점을 canvas 에 한 번만 그릴 때 씁니다) */
  IBR.dotPoints = function () {
    if (IBR._pts) return IBR._pts;
    var pts = [];
    if (!W) return pts;
    var raw = atob(W.bits), i = 0;
    for (var r = 0; r < W.rows; r++) for (var c = 0; c < W.cols; c++, i++) if ((raw.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1) pts.push([(c + .5) * W.step, (r + .5) * W.step]);
    return (IBR._pts = pts);
  };
  IBR.mapSize = function () { return W ? { w: W.cols * W.step, h: W.rows * W.step, lon0: W.lon0, lat0: W.lat0, step: W.step } : { w: 360, h: 135, lon0: -25, lat0: 80, step: 2.25 }; };
  /* 화면 좌표 변환: s = 1도당 px, (tx, ty) = 이동 */
  IBR.proj = function (view, lon, lat) {
    var m = IBR.mapSize();
    return [view.tx + (lon - m.lon0) * view.s, view.ty + (m.lat0 - lat) * view.s];
  };
  IBR.arcPath = function (a, b, lift) {
    var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    var k = (lift == null ? .3 : lift) * Math.hypot(b[0] - a[0], b[1] - a[1]);
    return "M" + a[0].toFixed(1) + " " + a[1].toFixed(1) + "Q" + mx.toFixed(1) + " " + (my - k).toFixed(1) + " " + b[0].toFixed(1) + " " + b[1].toFixed(1);
  };

  /* ── product cards ─────────────────────────────── */
  var SIL = {
    oil: '<rect x="50" y="6" width="20" height="30" rx="4"/><rect x="46" y="34" width="28" height="8" rx="2"/><path d="M40 46h40v8a14 14 0 0 1 8 13v74a9 9 0 0 1-9 9H41a9 9 0 0 1-9-9V67a14 14 0 0 1 8-13z"/><rect class="lb" x="40" y="88" width="40" height="40" rx="2"/>',
    pump: '<path d="M44 6h30v8H62v10h-6V14H44z"/><rect x="52" y="22" width="16" height="16" rx="2"/><path d="M40 38h40a8 8 0 0 1 8 8v96a10 10 0 0 1-10 10H42a10 10 0 0 1-10-10V46a8 8 0 0 1 8-8z"/><rect class="lb" x="40" y="74" width="40" height="52" rx="2"/>',
    tube: '<path d="M32 10h56v8l-4 2H36l-4-2z"/><path d="M36 20h48l-8 104H44z"/><rect x="42" y="124" width="36" height="22" rx="4"/><rect class="lb" x="44" y="46" width="32" height="44" rx="2"/>',
    jar: '<rect x="22" y="52" width="76" height="18" rx="4"/><path d="M26 70h68v58a14 14 0 0 1-14 14H40a14 14 0 0 1-14-14z"/><rect class="lb" x="34" y="86" width="52" height="34" rx="2"/>',
    honey: '<rect x="30" y="30" width="60" height="16" rx="3"/><path d="M28 50h64l6 12v70a12 12 0 0 1-12 12H34a12 12 0 0 1-12-12V62z"/><rect class="lb" x="34" y="76" width="52" height="44" rx="2"/>',
    stick: '<rect x="40" y="10" width="9" height="44" rx="2"/><rect x="52" y="4" width="9" height="50" rx="2"/><rect x="64" y="12" width="9" height="42" rx="2"/><rect x="76" y="8" width="9" height="46" rx="2"/><rect x="26" y="44" width="68" height="100" rx="3"/><rect class="lb" x="34" y="66" width="52" height="46" rx="2"/>',
    box: '<path d="M30 30l14-12h50l-14 12z" opacity=".75"/><path d="M80 30l14-12v110l-14 12z" opacity=".6"/><rect x="26" y="30" width="54" height="110" rx="2"/><rect class="lb" x="32" y="62" width="42" height="46" rx="2"/>',
    bar: '<rect x="14" y="70" width="92" height="50" rx="16"/><rect class="lb" x="30" y="84" width="60" height="22" rx="11"/>',
    bottle: '<rect x="50" y="6" width="20" height="18" rx="3"/><path d="M52 24h16v18c0 6 14 10 14 24v74a8 8 0 0 1-8 8H46a8 8 0 0 1-8-8V66c0-14 14-18 14-24z"/><rect class="lb" x="42" y="84" width="36" height="44" rx="2"/>',
    spray: '<path d="M48 8h26v10l12 6-2 4-12-4H48z"/><rect x="52" y="22" width="18" height="18" rx="2"/><rect x="38" y="40" width="46" height="106" rx="12"/><rect class="lb" x="44" y="72" width="34" height="48" rx="2"/>',
    pouch: '<path d="M30 20h60l-2 16 6 100a8 8 0 0 1-8 8H34a8 8 0 0 1-8-8l6-100z"/><rect class="lb" x="38" y="70" width="44" height="44" rx="2"/><rect x="32" y="28" width="56" height="3" opacity=".35"/>',
    towel: '<rect x="18" y="98" width="84" height="22" rx="6"/><rect x="22" y="74" width="76" height="22" rx="6" opacity=".85"/><rect x="26" y="50" width="68" height="22" rx="6" opacity=".7"/><rect class="lb" x="40" y="104" width="40" height="10" rx="2"/>',
    pack: '<path d="M24 34h72v104H24z"/><path d="M24 34l8-8 8 8 8-8 8 8 8-8 8 8 8-8 8 8 8-8 4 4v4H24z" opacity=".7"/><rect class="lb" x="34" y="62" width="52" height="52" rx="2"/>',
    chair: '<path d="M26 44a34 30 0 0 1 68 0v34H26z"/><path d="M14 70a10 10 0 0 1 20 0v40h52V70a10 10 0 0 1 20 0v50a10 10 0 0 1-10 10H24a10 10 0 0 1-10-10z"/><rect x="28" y="130" width="8" height="14"/><rect x="84" y="130" width="8" height="14"/>',
    cabinet: '<rect x="28" y="20" width="64" height="20" rx="10"/><rect x="28" y="42" width="64" height="20" rx="10" opacity=".85"/><rect x="28" y="64" width="64" height="20" rx="10"/><rect x="28" y="86" width="64" height="20" rx="10" opacity=".85"/><rect x="28" y="108" width="64" height="20" rx="10"/><rect x="34" y="132" width="6" height="12"/><rect x="80" y="132" width="6" height="12"/>',
    glass: '<path d="M34 12h52c2 30-6 52-22 56v58h20v8H36v-8h20V68C40 64 32 42 34 12z"/>',
    scale: '<path d="M16 96l40-22 48 18-40 24z"/><path d="M16 96v8l48 20v-8z" opacity=".7"/><path d="M64 116v8l40-24v-8z" opacity=".55"/><rect class="lb" x="52" y="88" width="16" height="8" rx="2" transform="skewX(-20)"/>'
  };
  IBR.brandMap = function () {
    if (IBR._bm) return IBR._bm;
    var m = {};
    (window.IBR_BRANDS || []).forEach(function (b) { m[b.id] = b; });
    return (IBR._bm = m);
  };
  IBR.productCard = function (p) {
    var b = IBR.brandMap()[p.b] || { en: p.b, ko: p.b };
    var el = document.createElement("article");
    el.className = "pcard";
    el.style.setProperty("--tint", b.tint || "#E8ECE8");
    el.style.setProperty("--bink", b.ink || "#2A3330");
    var art = '<div class="art">' + '<span class="bn">' + b.en + "</span>";
    if (p.check) art += '<span class="flag">' + p.check + "</span>";
    if (p.img) art += '<img' + (p.imgFull ? ' class="full"' : "") + ' src="' + p.img + '" alt="' + b.ko + " " + p.n + '" loading="lazy" decoding="async">';
    else art += '<svg class="sil" viewBox="0 0 120 150" aria-hidden="true"><g fill="currentColor" opacity=".86">' + (SIL[p.form] || SIL.box) + '</g></svg>';
    art += "</div>";
    var meta = '<div class="meta"><p class="brand"><b>' + b.ko + "</b>" + (b.en !== b.ko ? b.en : "") + "</p><h3>" + p.n + "</h3>";
    if (p.vars && p.vars.length) {
      if (p.vars.length === 1) meta += '<p class="vars">' + p.vars[0] + "</p>";
      else meta += '<details class="vars"><summary>' + p.vars.length + "가지 타입</summary><ul>" + p.vars.map(function (v) { return "<li>" + v + "</li>"; }).join("") + "</ul></details>";
    }
    if (p.opts.length > 1) {
      meta += '<div class="opts" role="group" aria-label="용량">' + p.opts.map(function (o, i) {
        return '<button type="button" aria-pressed="' + (i === 0) + '" data-i="' + i + '">' + o[0] + "</button>";
      }).join("") + "</div>";
    } else {
      meta += '<div class="opts"><span class="one">' + p.opts[0][0] + "</span></div>";
    }
    meta += '<div class="price"><span class="lbl">소비자가</span><span class="pv"></span></div>';
    if (p.note) meta += '<p class="note">' + p.note + "</p>";
    meta += "</div>";
    el.innerHTML = art + meta + (p.url ? '<a class="cover" href="' + p.url + '" aria-label="' + p.n + ' 자세히 보기"></a>' : "");
    var pv = el.querySelector(".pv");
    function show(i) {
      var v = p.opts[i][1];
      pv.innerHTML = v == null ? '<span class="tbd">준비 중</span>' : '<b>' + IBR.won(v) + "<small>원</small></b>";
    }
    show(0);
    el.querySelectorAll(".opts button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        el.querySelectorAll(".opts button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === btn)); });
        show(+btn.getAttribute("data-i"));
      });
    });
    return el;
  };
  IBR.priceOf = function (p) { return p.opts[0][1]; };

  document.addEventListener("DOMContentLoaded", function () {
    IBR.reveal();
    IBR.counters();
    IBR.marquees();
  });
})();
