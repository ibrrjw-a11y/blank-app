/*
  브랜드 필름 — 제품 페이지에서 브랜드를 고르면 필터 바 아래에 나오는 짧은 모션 그래픽.
  영상 파일이 아니라 브랜드 화보·누끼·로고(assets/img/brand/<브랜드>/)를 코드로 움직입니다.
  처음 약 5초 동안 브랜드마다 다른 오프닝이 나오고, 그 뒤에는 화보가 천천히 바뀌며 이어집니다.

  FILMS 에서 브랜드별 색(bg·ink·acc), 로고(logo), 키워드(words), 배경 모션(motif), 효과(fx)를 고칩니다.
  장면 구성(어떤 사진이 어디서 어떻게 들어오는지)은 아래 SCENES 의 브랜드별 함수에 있습니다.
  화보가 아직 없는 브랜드는 motif(코드로 그린 모션)만 나옵니다.
  motif: rings 나이테 · honey 벌집 · botanical 식물 · citrus 레몬 · pet 펫 스틱 · capsule 캡슐
         water 물결 · zero 카운트다운 · droplet 방울 · toys 장난감 블록 · sculpt 조형 의자
         glass 유리잔 · nuts 견과 · heat 열기 · pulse 측정
  사진·로고 파일은 tools/make_brand_assets.py 로 webp 로 줄여 넣습니다.
*/
(function () {
  "use strict";
  var IBR = window.IBR || (window.IBR = {});

  var FILMS = {
    arvo:      { tone: "dark", bg: "#141A15", ink: "#F2EDE3", acc: ["#E4A85C", "#E890C0", "#93B4D2"], logo: "logo_w", logoH: 58, fx: "fog", words: ["Wood", "Rhythm", "No.07 · 10 · 11"] },
    choolip:   { motif: "pet", bg: "#F6DDE3", ink: "#7A1E3A", acc: ["#E6476B", "#F49AB0", "#FFF4E6", "#B8264E"], words: ["Vet-made", "Human grade", "Amazon's Choice"] },
    myvef:     { bg: "#DCEAF5", ink: "#0D4A6B", acc: ["#F28C28", "#0D4A6B", "#7FB6E0", "#FFFFFF"], logo: "logo", logoH: 40, under: "pops", words: ["수의사가 만든", "영양 간식", "HK · TW · SG · JP"] },
    denoah:    { motif: "droplet", bg: "#EEE6E0", ink: "#4D3B33", acc: ["#D2B5A2", "#B99A86", "#F7EFE9"], logo: "logo", logoH: 46, words: ["Recover", "Calm", "Rest"] },
    drdaniel:  { motif: "capsule", bg: "#EFE9DF", ink: "#2A2117", acc: ["#B08A4E", "#2A2117", "#FFFFFF"], logo: "logo", logoH: 44, words: ["Global ingredients", "Own formula", "Daily health"] },
    chungdam:  { motif: "water", bg: "#E1E8EF", ink: "#14284B", acc: ["#3E6FA8", "#9DB7D6"], logo: "logo", logoH: 46, words: ["淸潭", "Pure water", "Ph.D formula"] },
    zeroguide: { motif: "zero", area: { d: [.36, 0, .27, 1], m: [0, 0, .46, .6] }, bg: "#EEF0EE", ink: "#111111", acc: ["#111111", "#7CC243"], logo: "logo", logoH: 70, words: ["Complex", "→ Zero", "Category No.1"] },
    marybee:   { motif: "honey", opt: { flowers: 1 }, bg: "#F3E6C9", ink: "#4A2D07", acc: ["#C9831A", "#F2C35B"], logo: "logo", logoH: 74, words: ["Manuka", "Honeycomb", "World first"] },
    kimguksan: { motif: "heat", opt: { cx: .62 }, bg: "#F2E4E0", ink: "#3B2525", acc: ["#E0533A", "#F2A65A", "#FFD7A8"], logo: "logo", logoH: 64, words: ["100% Korea", "HOT 70", "Warm days"] },
    attiki:    { bg: "#F5F1E8", ink: "#14306A", acc: ["#C9A24A", "#14306A"], logo: "logo", logoH: 92, words: ["Greece No.1", "Thyme · Pine", "22 sold-out shows"] },
    botanist:  { bg: "#F4F2ED", ink: "#191919", acc: ["#2E3B22"], logo: "logo", logoH: 54, words: ["Botanical", "Hair & Body", "Japan"] },
    lamaison:  { bg: "#ECE6F1", ink: "#3B2A5C", acc: ["#8E73C2", "#E0B04A", "#B9A3DE"], logo: "logo", logoH: 84, fx: "lavender", words: ["Paris 1898", "Lavender", "Single flower honey"] },
    bronnley:  { bg: "#F7EDB6", ink: "#3A3410", acc: ["#F2CF2E", "#FBF3C2", "#FFFFFF"], logo: "logo", logoH: 70, fx: "zest", words: ["England", "Lemon", "Soap & Balm"] },
    airborne:  { tone: "dark", bg: "#0D0906", ink: "#F0E2C4", acc: ["#E0A43A", "#FFD27A"], fx: "honeydew", words: ["New Zealand", "Beech forest", "Honeydew"] },
    harker:    { motif: "botanical", opt: { manuka: 1 }, bg: "#E1EBE3", ink: "#1E4430", acc: ["#FFFFFF", "#F6F1E2"], words: ["New Zealand", "Herbal", "Manuka lozenge"] },
    magis:     { motif: "toys", bg: "#EAEAE4", ink: "#1A1A1A", acc: ["#E5352B", "#F2C12E", "#2B5CE6", "#2BA36B", "#FFFFFF"], words: ["Italian design", "Puppy", "360° Container"] },
    driade:    { motif: "sculpt", bg: "#EFE8DE", ink: "#3D2C1C", acc: ["#3A3836", "#E2B9A3", "#D19A2B"], words: ["Italian design", "Roly Poly", "Charcoal · Flesh · Ochre"] },
    kvetna:    { motif: "glass", bg: "#E3EAEF", ink: "#20323E", acc: ["#C8323C", "#2D5DB8", "#E8B81C", "#E8742A"], words: ["Czech glass", "Handmade", "Auriga"] },
    sahale:    { motif: "nuts", opt: { kind: "mix" }, bg: "#F1E3D3", ink: "#5A2E10", acc: ["#C98A4B", "#9DB860", "#8A4A22", "#C0392B", "#E8C890"], words: ["Seattle", "Glazed nuts", "Fruit & spice"] },
    freshmac:  { motif: "nuts", opt: { kind: "mac" }, bg: "#ECE2CF", ink: "#4A3618", acc: ["#7B4A22", "#A8703C", "#F3E6C8"], words: ["Australia", "Macadamia", "In-shell"] },
    yuhan:     { motif: "capsule", bg: "#E1E8F0", ink: "#173452", acc: ["#2C6FB7", "#79B4E8", "#FFFFFF"], words: ["당큐락", "400억 원+", "IBR 독점 대행"] },
    claraco:   { bg: "#F7D6DC", ink: "#8A1028", acc: ["#E8344E", "#F7A8B8", "#FFFFFF"], logo: "logo", logoH: 34, under: "pearls", words: ["Collagen", "Glow", "20g × 15"] },
    oat:       { motif: "nuts", opt: { kind: "oat" }, bg: "#EFE8D9", ink: "#4A3A1E", acc: ["#E6D3A8", "#C9A86A", "#8A6A3A"], words: ["Oat", "Spread", "Easy morning"] },
    atply:     { motif: "pulse", bg: "#E2E7EA", ink: "#24303A", acc: ["#2FB3C8", "#24303A"], words: ["Smart", "Scale", "T8"] }
  };
  IBR.FILMS = FILMS;

  /* ── 공통 도구 ─────────────────────────────── */
  var TAU = Math.PI * 2, BEATS = [2.0, 2.9, 3.8];
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function prog(t, s, d) { return clamp((t - s) / d, 0, 1); }
  function eo(x) { return 1 - Math.pow(1 - x, 3); }
  function eio(x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function ei(x) { return x * x * x; }
  function back(x) { if (x <= 0) return 0; var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
  function bounce(x) {
    var n = 7.5625, d = 2.75;
    if (x < 1 / d) return n * x * x;
    if (x < 2 / d) return n * (x -= 1.5 / d) * x + .75;
    if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + .9375;
    return n * (x -= 2.625 / d) * x + .984375;
  }
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function rgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + clamp(a, 0, 1).toFixed(3) + ")";
  }
  /* 모션이 놓이는 자리: 넓은 화면은 오른쪽 64%, 좁은 화면은 위쪽 60% */
  var AREA = null; /* 브랜드별로 자리를 바꿀 때: { d: [x, y, w, h], m: [...] } (0~1 비율) */
  function area(w, h) {
    var r = AREA && (w < 640 ? AREA.m : AREA.d);
    if (r) return { x: w * r[0], y: h * r[1], w: w * r[2], h: h * r[3] };
    return w < 640 ? { x: 0, y: 0, w: w, h: h * .6 } : { x: w * .36, y: 0, w: w * .64, h: h };
  }
  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function hexPath(c, s) {
    c.beginPath();
    for (var i = 0; i < 6; i++) { var a = i * Math.PI / 3; i ? c.lineTo(Math.cos(a) * s, Math.sin(a) * s) : c.moveTo(Math.cos(a) * s, Math.sin(a) * s); }
    c.closePath();
  }
  function flower(c, x, y, r, petals, col, center, rot) {
    c.save(); c.translate(x, y); c.rotate(rot || 0);
    c.fillStyle = col;
    for (var i = 0; i < petals; i++) { c.rotate(TAU / petals); c.beginPath(); c.ellipse(0, -r * .55, r * .32, r * .55, 0, 0, TAU); c.fill(); }
    c.fillStyle = center; c.beginPath(); c.arc(0, 0, r * .22, 0, TAU); c.fill();
    c.restore();
  }
  /* 인트로 박자(키워드가 하나씩 나오는 시점)와 그 뒤 반복 박자 */
  function beatsUntil(t, every) {
    var out = BEATS.map(function (b, i) { return [b, i]; });
    if (t > 5) { var k0 = Math.floor((t - 5) / every); for (var k = Math.max(0, k0 - 1); k <= k0; k++) out.push([5 + k * every, k + 3]); }
    return out;
  }

  var M = {};

  /* 나이테 + 향 방울 (에이르보: 나무를 매개로 찾은 리듬, No.07·10·11) */
  M.rings = function (c, w, h, t, th) {
    var A = area(w, h), cx = A.x + A.w * .56, cy = A.y + A.h * .54, R = Math.min(A.w, A.h) * .62, n = 16;
    for (var i = 0; i < n; i++) {
      var p = eo(prog(t, .15 + i * .07, 1.1)); if (!p) continue;
      var r = R * (.1 + .9 * i / (n - 1)), steps = 96, end = Math.ceil(steps * p);
      c.beginPath();
      for (var k = 0; k <= end; k++) {
        var a = k / steps * TAU - Math.PI / 2;
        var q = r * (1 + .03 * Math.sin(3 * a + i * .8 + t * .35) + .018 * Math.sin(7 * a + i * 1.7 - t * .2));
        var x = cx + Math.cos(a) * q, y = cy + Math.sin(a) * q * .92;
        k ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.strokeStyle = rgba(th.ink, i % 4 === 0 ? .32 : .14); c.lineWidth = i % 4 === 0 ? 1.6 : 1; c.stroke();
    }
    c.fillStyle = rgba(th.ink, .6 * prog(t, .2, .5)); c.beginPath(); c.arc(cx, cy, 3, 0, TAU); c.fill();
    beatsUntil(t, 2.6).forEach(function (d) {
      var s = d[0] - .55, col = th.acc[d[1] % th.acc.length];
      if (t < s) return;
      var fall = prog(t, s, .55);
      if (fall < 1) { c.fillStyle = col; c.beginPath(); c.ellipse(cx, A.y - 20 + (cy - A.y + 20) * ei(fall), 5, 8, 0, 0, TAU); c.fill(); return; }
      var q = prog(t, s + .55, 2.6); if (q >= 1) return;
      var rad = R * .95 * eo(q);
      c.strokeStyle = rgba(col, (1 - q) * .95); c.lineWidth = 3 * (1 - q) + .8;
      c.beginPath(); c.ellipse(cx, cy, rad, rad * .92, 0, 0, TAU); c.stroke();
      var g = c.createRadialGradient(cx, cy, 0, cx, cy, rad * .6 + 1);
      g.addColorStop(0, rgba(col, .5 * (1 - q))); g.addColorStop(1, rgba(col, 0));
      c.fillStyle = g; c.beginPath(); c.arc(cx, cy, rad * .6 + 1, 0, TAU); c.fill();
    });
  };

  /* 벌집 + 꿀 방울 (메리비·아티키·라 메종 뒤 미엘·에어본) */
  M.honey = function (c, w, h, t, th) {
    var A = area(w, h), o = th.opt || {};
    var s = Math.min(A.w / 11, A.h / 12.6), cx = A.x + A.w * .56, cy = A.y + A.h * .5;
    if (o.trees) {
      for (var i = 0; i < 9; i++) {
        var tx = A.x + A.w * (i + .3) / 9 + Math.sin(i * 2.3) * 18, tw = 5 + (i % 3) * 5, gp = eo(prog(t, i * .08, 1.4));
        c.fillStyle = rgba(th.ink, .07 + .04 * (i % 2)); c.fillRect(tx, h - h * gp, tw, h * gp);
      }
    }
    var r = rng(11), cells = [];
    for (var q = -3; q <= 3; q++) for (var v = -3; v <= 3; v++) {
      var d = Math.max(Math.abs(q), Math.abs(v), Math.abs(-q - v)); if (d > 3) continue;
      cells.push({ q: q, r: v, d: d, j: r(), f: r() });
    }
    var drip = null, top = s * Math.sqrt(3) / 2;
    cells.forEach(function (cl) {
      var px = cx + s * 1.5 * cl.q, py = cy + s * Math.sqrt(3) * (cl.r + cl.q / 2);
      var ap = back(prog(t, .25 + cl.d * .18 + cl.j * .2, .6)); if (ap <= 0) return;
      var sz = s * .93 * ap;
      c.save(); c.translate(px, py);
      if (cl.f < .62) {
        var fp = eo(prog(t, .9 + cl.d * .25 + cl.j * 1.2, 1.3));
        if (fp > 0) {
          c.save(); hexPath(c, sz); c.clip();
          var lvl = top - 2 * top * fp + Math.sin(t * 2 + cl.j * 6) * 1.5;
          var g = c.createLinearGradient(0, -top, 0, top);
          g.addColorStop(0, rgba(th.acc[1], .9)); g.addColorStop(1, rgba(th.acc[0], .96));
          c.fillStyle = g; c.fillRect(-sz, lvl, sz * 2, top * 2 + 4);
          c.fillStyle = "rgba(255,255,255,.35)"; c.beginPath(); c.ellipse(-sz * .3, lvl + 6, sz * .18, 2.5, 0, 0, TAU); c.fill();
          c.restore();
          if (fp > .98 && (!drip || py + top > drip.y)) drip = { x: px, y: py + top };
        }
      }
      hexPath(c, sz); c.strokeStyle = rgba(th.ink, .38); c.lineWidth = 1.2; c.stroke();
      c.restore();
    });
    if (drip && t > 3) {
      var k = ((t - 3) % 2.8) / 2.8, col = th.acc[0], dx = drip.x - s * .1, dy = drip.y - 1;
      c.fillStyle = col;
      if (k < .7) {
        var L = 6 + 38 * eio(k / .7);
        c.beginPath(); c.moveTo(dx - 6, dy); c.quadraticCurveTo(dx - 2, dy + L * .6, dx - 6, dy + L);
        c.arc(dx, dy + L, 6, Math.PI, 0, true); c.quadraticCurveTo(dx + 2, dy + L * .6, dx + 6, dy); c.fill();
      } else {
        var f = (k - .7) / .3; c.globalAlpha = 1 - f;
        c.beginPath(); c.ellipse(dx, dy + 44 + f * 160, 6, 8, 0, 0, TAU); c.fill(); c.globalAlpha = 1;
      }
    }
    if (o.flowers) {
      var fr = rng(5);
      for (var m = 0; m < 6; m++) {
        var fx = A.x + A.w * (.12 + fr() * .8), fy = A.y + A.h * (.1 + fr() * .8), fs = back(prog(t, 1.4 + m * .35, .8));
        if (fs > 0) flower(c, fx, fy, 11 * fs, 5, "rgba(255,255,255,.92)", th.acc[0], t * .2 + m);
      }
    }
    if (o.meander) {
      var u = Math.max(5, Math.min(8, w / 140)), y0 = 14 + 4 * u, P = [[0, 0], [0, -4], [3, -4], [3, -2], [2, -2], [2, -3], [1, -3], [1, -1], [4, -1], [4, 0], [5, 0]];
      var total = Math.ceil(w / (5 * u)) + 1, pm = eio(prog(t, .4, 2.4)), segs = Math.floor(total * pm * 10);
      c.beginPath(); c.strokeStyle = rgba(th.ink, .55); c.lineWidth = 1.6;
      var cnt = 0;
      for (var pi = 0; pi < total && cnt < segs; pi++) for (var pj = 0; pj < P.length && cnt < segs; pj++, cnt++) {
        var X = pi * 5 * u + P[pj][0] * u, Y = y0 + P[pj][1] * u;
        (pi === 0 && pj === 0) ? c.moveTo(X, Y) : c.lineTo(X, Y);
      }
      c.stroke();
    }
    if (o.lavender) {
      for (var l = 0; l < 11; l++) {
        var bx = A.x + A.w * (.02 + l * .06), base = h, hgt = A.h * (.32 + (l % 3) * .06), gp2 = eo(prog(t, .3 + l * .07, 1.2));
        var sway = Math.sin(t * 1.1 + l) * 6, tipx = bx + sway, tipy = base - hgt * gp2;
        c.strokeStyle = rgba("#5E7A4A", .7); c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(bx, base); c.quadraticCurveTo(bx, base - hgt * .5, tipx, tipy); c.stroke();
        if (gp2 > .7) for (var bu = 0; bu < 7; bu++) {
          var fy2 = tipy + bu * 7, fx2 = tipx - sway * bu / 14;
          c.fillStyle = rgba(th.acc[2], .85 - bu * .05);
          c.beginPath(); c.ellipse(fx2 - 2.5, fy2, 2.4, 4, -.4, 0, TAU); c.ellipse(fx2 + 2.5, fy2 + 2, 2.4, 4, .4, 0, TAU); c.fill();
        }
      }
    }
  };

  /* 줄기와 꽃이 자랍니다 (보타니스트 · 하커허벌) */
  M.botanical = function (c, w, h, t, th) {
    var A = area(w, h), o = th.opt || {}, n = o.manuka ? 9 : 7, r = rng(o.manuka ? 4 : 9);
    var green = o.manuka ? "#2F6B45" : "#5B7A3A";
    for (var i = 0; i < n; i++) {
      var bx = A.x + A.w * (.08 + .86 * i / (n - 1)) + (r() - .5) * 20, by = A.y + A.h + 4;
      var hh = A.h * (.45 + r() * .4), tx = bx + (r() - .5) * 80, ty = by - hh, start = .2 + i * .12;
      var p = eo(prog(t, start, 1.6)); if (!p) continue;
      var sway = Math.sin(t * .9 + i) * 10 * p, cx1 = bx + (r() - .5) * 60, cy1 = by - hh * .55;
      var pt = function (u) {
        var a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, cc = u * u;
        return [a * bx + b * cx1 + cc * (tx + sway), a * by + b * cy1 + cc * ty];
      };
      c.beginPath(); c.strokeStyle = rgba(green, .85); c.lineWidth = 1.6;
      for (var k = 0; k <= 30; k++) { var q = pt(p * k / 30); k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }
      c.stroke();
      [.35, .55, .75].forEach(function (f, j) {
        if (p < f) return;
        var lp = eo(prog(t, start + f * 1.6, .7)), q = pt(f), side = j % 2 ? 1 : -1, ls = (o.manuka ? 12 : 18) * lp;
        c.save(); c.translate(q[0], q[1]); c.rotate(side * .9 + Math.sin(t + i + j) * .08);
        c.fillStyle = rgba(green, o.manuka ? .8 : .55);
        c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(ls * .5, -ls * .45, ls * 1.6, 0); c.quadraticCurveTo(ls * .5, ls * .45, 0, 0); c.fill();
        c.restore();
      });
      if (p > .97) {
        var bp = back(prog(t, start + 1.6, .8)), tip = pt(1), col = th.acc[i % th.acc.length];
        if (o.manuka) { for (var m = 0; m < 3; m++) flower(c, tip[0] + (m - 1) * 10, tip[1] + (m % 2) * 8, 8 * bp, 5, col, "#D6B03C", t * .3 + m); }
        else flower(c, tip[0], tip[1], 16 * bp, 6, rgba(col, .95), rgba(th.ink, .5), t * .25 + i);
      }
    }
  };

  /* 레몬 단면과 비누 거품 (브론리) */
  M.citrus = function (c, w, h, t, th) {
    var A = area(w, h), r = rng(3);
    for (var b = 0; b < 18; b++) {
      var bx = A.x + r() * A.w, sp = 18 + r() * 30, ph = r() * 20, by = A.y + A.h - ((t * sp + ph * 20) % (A.h + 40)), br = 3 + r() * 9;
      c.strokeStyle = "rgba(255,255,255,.75)"; c.lineWidth = 1.2; c.beginPath(); c.arc(bx + Math.sin(t + b) * 6, by, br, 0, TAU); c.stroke();
    }
    var L = [[.3, .4, .2], [.62, .3, .15], [.8, .66, .21], [.48, .74, .12], [.15, .78, .1]];
    L.forEach(function (l, i) {
      var sc = back(prog(t, .3 + i * .3, .8)); if (sc <= 0) return;
      var x = A.x + A.w * l[0], y = A.y + A.h * l[1] + Math.sin(t * .8 + i) * 6, R = Math.min(A.w, A.h) * l[2] * sc;
      c.save(); c.translate(x, y); c.rotate(t * .15 * (i % 2 ? 1 : -1) + i);
      c.fillStyle = th.acc[0]; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
      c.fillStyle = "#FFFBE6"; c.beginPath(); c.arc(0, 0, R * .9, 0, TAU); c.fill();
      for (var s = 0; s < 9; s++) {
        var a0 = s / 9 * TAU + .05, a1 = (s + 1) / 9 * TAU - .05;
        c.fillStyle = rgba(th.acc[0], .75); c.beginPath(); c.moveTo(Math.cos((a0 + a1) / 2) * R * .1, Math.sin((a0 + a1) / 2) * R * .1);
        c.arc(0, 0, R * .82, a0, a1); c.closePath(); c.fill();
      }
      c.fillStyle = "#FFFBE6"; c.beginPath(); c.arc(0, 0, R * .1, 0, TAU); c.fill();
      c.restore();
    });
  };

  /* 짜 먹는 스틱이 떨어지고 발자국이 지나갑니다 (츌립 · 마이베프) */
  M.pet = function (c, w, h, t, th) {
    var A = area(w, h), n = 7, gw = A.w * .7 / n, floor = A.y + A.h * .74;
    for (var i = 0; i < n; i++) {
      var st = .3 + i * .16, p = prog(t, st, .9); if (!p) continue;
      var bx = A.x + A.w * .18 + i * gw, sh = A.h * (.34 + (i % 3) * .06), sw = gw * .62;
      var y = (A.y - sh) + (floor - sh - (A.y - sh)) * bounce(p);
      var wob = Math.sin(t * 2 + i) * (t > 4 ? 2 : 0);
      c.save(); c.translate(bx + sw / 2, y + sh / 2 + wob); c.rotate((i % 2 ? .05 : -.05) * (1 - p) + Math.sin(t * .8 + i) * .02);
      var col = th.acc[i % 2 ? 1 : 0];
      rr(c, -sw / 2, -sh / 2, sw, sh, sw * .3); c.fillStyle = col; c.fill();
      c.fillStyle = rgba(th.acc[2], .95); rr(c, -sw / 2 + 4, -sh * .1, sw - 8, sh * .32, 4); c.fill();
      c.fillStyle = th.acc[3]; c.beginPath(); c.moveTo(-sw * .2, -sh / 2); c.lineTo(sw * .2, -sh / 2); c.lineTo(0, -sh / 2 - 12); c.closePath(); c.fill();
      c.restore();
    }
    var paws = 10, speed = .9;
    for (var k = 0; k < paws; k++) {
      var tt = t - 1.2 - k * .38; if (tt < 0) continue;
      var px = A.x + A.w * (.06 + k * .095), py = floor + 26 + (k % 2 ? 10 : -6);
      var alpha = clamp(tt * 2, 0, 1) * (t > 5 ? .5 + .5 * Math.sin(t * speed - k * .6) : 1);
      c.fillStyle = rgba(th.ink, .22 * alpha);
      c.beginPath(); c.ellipse(px, py, 7, 6, 0, 0, TAU); c.fill();
      [[-7, -8], [-2.5, -11], [2.5, -11], [7, -8]].forEach(function (d) { c.beginPath(); c.ellipse(px + d[0], py + d[1], 2.6, 3.2, 0, 0, TAU); c.fill(); });
    }
  };

  /* 캡슐과 분자 연결선 (닥터다니엘 · 유한양행 · 클라라앤코) */
  M.capsule = function (c, w, h, t, th) {
    var A = area(w, h), o = th.opt || {}, r = rng(21), N = 14, pts = [];
    for (var i = 0; i < N; i++) {
      var ax = A.x + A.w * (.08 + r() * .84), ay = A.y + A.h * (.1 + r() * .8);
      pts.push([ax + Math.sin(t * .4 + i) * 14, ay + Math.cos(t * .35 + i * 1.3) * 10, eo(prog(t, .2 + i * .06, .6))]);
    }
    c.lineWidth = 1;
    for (var a = 0; a < N; a++) for (var b = a + 1; b < N; b++) {
      var dx = pts[a][0] - pts[b][0], dy = pts[a][1] - pts[b][1], d = Math.hypot(dx, dy), lim = Math.min(A.w, A.h) * .38;
      if (d < lim) { c.strokeStyle = rgba(th.ink, (1 - d / lim) * .25 * Math.min(pts[a][2], pts[b][2])); c.beginPath(); c.moveTo(pts[a][0], pts[a][1]); c.lineTo(pts[b][0], pts[b][1]); c.stroke(); }
    }
    pts.forEach(function (p) { c.fillStyle = rgba(th.ink, .45 * p[2]); c.beginPath(); c.arc(p[0], p[1], 2.4, 0, TAU); c.fill(); });
    var caps = 8;
    for (var k = 0; k < caps; k++) {
      var sc = back(prog(t, .5 + k * .22, .7)); if (sc <= 0) continue;
      var cx = A.x + A.w * (.15 + ((k * .37) % 1) * .75), cy = A.y + A.h * (.2 + ((k * .53) % 1) * .62) + Math.sin(t * .9 + k) * 8;
      var L = Math.min(A.w, A.h) * (.09 + (k % 3) * .02) * sc, Wd = L * .42;
      c.save(); c.translate(cx, cy); c.rotate(k * .7 + t * .12 * (k % 2 ? 1 : -1));
      if (o.glow) {
        var g = c.createRadialGradient(0, 0, 0, 0, 0, L * 1.3);
        g.addColorStop(0, rgba(th.acc[2], .9)); g.addColorStop(.4, rgba(th.acc[0], .55)); g.addColorStop(1, rgba(th.acc[0], 0));
        c.fillStyle = g; c.beginPath(); c.arc(0, 0, L * 1.3, 0, TAU); c.fill();
      } else {
        c.shadowColor = "rgba(0,0,0,.12)"; c.shadowBlur = 12; c.shadowOffsetY = 6;
        rr(c, -L, -Wd, L * 2, Wd * 2, Wd); c.fillStyle = th.acc[2]; c.fill();
        c.shadowColor = "transparent";
        c.save(); rr(c, -L, -Wd, L * 2, Wd * 2, Wd); c.clip(); c.fillStyle = th.acc[k % 2 ? 0 : 1]; c.fillRect(-L, -Wd, L, Wd * 2); c.restore();
        c.fillStyle = "rgba(255,255,255,.45)"; rr(c, -L * .8, -Wd * .7, L * 1.5, Wd * .32, Wd * .16); c.fill();
      }
      c.restore();
    }
  };

  /* 맑은 못에 떨어지는 물방울 (청담뉴트리션: 淸潭) */
  M.water = function (c, w, h, t, th) {
    var A = area(w, h), cx = A.x + A.w * .55, cy = A.y + A.h * .62;
    c.save(); c.fillStyle = rgba(th.ink, .07 * eo(prog(t, .2, 1.6)));
    c.font = "500 " + Math.round(Math.min(A.h * .62, A.w * .32)) + "px 'Noto Serif KR', 'Noto Sans KR', serif";
    c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("淸潭", cx, A.y + A.h * .4); c.restore();
    for (var l = 0; l < 14; l++) {
      var ly = cy + 12 + l * 9, lw = A.w * (.2 + .5 * Math.abs(Math.sin(l * 1.7))), off = Math.sin(t * .6 + l) * 20;
      c.strokeStyle = rgba(th.acc[0], .16 * eo(prog(t, .3 + l * .05, 1))); c.lineWidth = 1;
      c.beginPath(); c.moveTo(cx - lw / 2 + off, ly); c.lineTo(cx + lw / 2 + off, ly); c.stroke();
    }
    beatsUntil(t, 2.4).forEach(function (d, i) {
      var s = d[0] - .5, x = cx + [0, -A.w * .18, A.w * .16, A.w * .05][d[1] % 4];
      if (t < s) return;
      var f = prog(t, s, .5);
      if (f < 1) { c.fillStyle = rgba(th.acc[0], .9); c.beginPath(); c.ellipse(x, A.y + (cy - A.y) * ei(f), 3.5, 6, 0, 0, TAU); c.fill(); return; }
      for (var k = 0; k < 3; k++) {
        var q = prog(t, s + .5 + k * .25, 2.6); if (q <= 0 || q >= 1) continue;
        var R = A.w * .32 * eo(q);
        c.strokeStyle = rgba(th.ink, (1 - q) * .5); c.lineWidth = 1.4;
        c.beginPath(); c.ellipse(x, cy, R, R * .26, 0, 0, TAU); c.stroke();
      }
    });
  };

  /* 9에서 0으로, 그리고 고리 (제로가이드: 콤플렉스를 Zero로) */
  M.zero = function (c, w, h, t, th) {
    var A = area(w, h), cx = A.x + A.w * .52, cy = A.y + A.h * .52, R = Math.min(A.w, A.h) * .34;
    var n = Math.max(0, 9 - Math.floor(t / .24));
    var ring = eio(prog(t, 2.25, 1.1));
    for (var k = 0; k < 60; k++) {
      var a = k / 60 * TAU + t * .05, on = k / 60 <= ring;
      c.strokeStyle = rgba(th.ink, on ? (k % 5 ? .25 : .7) : .08); c.lineWidth = k % 5 ? 1 : 2;
      var r1 = R * 1.18, r2 = R * (k % 5 ? 1.26 : 1.32);
      c.beginPath(); c.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); c.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); c.stroke();
    }
    if (ring > 0) { c.strokeStyle = th.ink; c.lineWidth = Math.max(10, R * .16); c.lineCap = "round"; c.beginPath(); c.arc(cx, cy, R * .82, -Math.PI / 2, -Math.PI / 2 + TAU * ring); c.stroke(); c.lineCap = "butt"; }
    if (ring < 1) {
      c.fillStyle = rgba(th.ink, 1 - ring); c.font = "800 " + Math.round(R * 1.6) + "px Poppins, sans-serif";
      c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(String(n), cx, cy + R * .06);
    }
    if (t > 3.6) { var p = (t - 3.6) % 2.4 / 2.4; c.fillStyle = rgba(th.acc[1], 1 - p); c.beginPath(); c.arc(cx + Math.cos(-Math.PI / 2) * R * .82, cy - R * .82, 6 + p * 10, 0, TAU); c.fill(); }
  };

  /* 부드러운 방울이 번집니다 (드노아: 재생·진정·휴식) */
  M.droplet = function (c, w, h, t, th) {
    var A = area(w, h);
    for (var i = 0; i < 6; i++) {
      var p = eo(prog(t, .2 + i * .2, 1.4)); if (!p) continue;
      var x = A.x + A.w * (.5 + .32 * Math.sin(t * .23 + i * 1.9)), y = A.y + A.h * (.5 + .3 * Math.cos(t * .19 + i * 2.4)), R = Math.min(A.w, A.h) * (.22 + (i % 3) * .07) * p;
      var g = c.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, rgba(th.acc[i % 2], .55)); g.addColorStop(1, rgba(th.acc[i % 2], 0));
      c.fillStyle = g; c.beginPath(); c.arc(x, y, R, 0, TAU); c.fill();
    }
    var cx = A.x + A.w * .55, cy = A.y + A.h * .6;
    beatsUntil(t, 3).forEach(function (d) {
      var s = d[0] - .6; if (t < s) return;
      var f = prog(t, s, .6);
      if (f < 1) {
        var y = A.y + (cy - A.y) * ei(f); c.fillStyle = rgba(th.ink, .7);
        c.beginPath(); c.moveTo(cx, y - 14); c.quadraticCurveTo(cx + 8, y, cx, y + 6); c.quadraticCurveTo(cx - 8, y, cx, y - 14); c.fill(); return;
      }
      var q = prog(t, s + .6, 2.6); if (q >= 1) return;
      c.strokeStyle = rgba(th.ink, (1 - q) * .45); c.lineWidth = 1.2;
      c.beginPath(); c.ellipse(cx, cy, A.w * .3 * eo(q), A.w * .3 * eo(q) * .3, 0, 0, TAU); c.stroke();
      var g2 = c.createRadialGradient(cx, cy, 0, cx, cy, A.w * .2 * eo(q) + 1);
      g2.addColorStop(0, rgba(th.acc[2], .7 * (1 - q))); g2.addColorStop(1, rgba(th.acc[2], 0));
      c.fillStyle = g2; c.beginPath(); c.arc(cx, cy, A.w * .2 * eo(q) + 1, 0, TAU); c.fill();
    });
  };

  /* 원색 블록이 쌓이고 마지막에 퍼피가 앉습니다 (마지스) */
  M.toys = function (c, w, h, t, th) {
    var A = area(w, h), u = Math.min(A.w / 8.4, A.h / 4.4), floor = A.y + A.h * .84, x0 = A.x + A.w * .08;
    var S = [
      { k: "rect", x: 0, w: 1.4, h: 1, c: 0, st: .2 }, { k: "half", x: 1.6, w: 1.6, h: .8, c: 2, st: .45 },
      { k: "circ", x: 3.4, w: 1.1, h: 1.1, c: 1, st: .7 }, { k: "rect", x: .2, w: 1, h: 1.1, c: 3, st: 1, on: 1 },
      { k: "tri", x: 1.7, w: 1.4, h: 1.2, c: 0, st: 1.3, on: .8 }, { k: "circ", x: 3.5, w: .9, h: .9, c: 2, st: 1.55, on: 1.1 }
    ];
    S.forEach(function (s, i) {
      var p = prog(t, s.st, .9); if (!p) return;
      var bottom = floor - (s.on || 0) * u, H = s.h * u, W = s.w * u, x = x0 + s.x * u;
      var y = (A.y - H - 20) + (bottom - H - (A.y - H - 20)) * bounce(p);
      var sq = t > 5 ? Math.max(0, Math.sin((t - 5) * 3 - i)) * .06 : 0;
      c.save(); c.translate(x + W / 2, y + H); c.scale(1 + sq, 1 - sq); c.fillStyle = th.acc[s.c];
      c.beginPath();
      if (s.k === "rect") rr(c, -W / 2, -H, W, H, 6);
      else if (s.k === "circ") c.arc(0, -H / 2, W / 2, 0, TAU);
      else if (s.k === "half") { c.moveTo(-W / 2, 0); c.arc(0, 0, W / 2, Math.PI, 0); c.closePath(); }
      else { c.moveTo(-W / 2, 0); c.lineTo(0, -H); c.lineTo(W / 2, 0); c.closePath(); }
      c.fill(); c.restore();
    });
    /* 퍼피 (둥근 몸통, 큰 귀, 원뿔 다리) */
    var pp = prog(t, 2.3, 1.1);
    if (pp > 0) {
      var sc = u * .95, px = Math.min(A.x + A.w - sc * .95 - 18, A.x + Math.max(A.w * .8, (x0 - A.x) + 5.6 * u + u * 1.3)), py = (A.y - sc * 2) + (floor - (A.y - sc * 2)) * bounce(pp);
      var nod = t > 4 ? Math.sin(t * 1.6) * .05 : 0;
      c.save(); c.translate(px, py); c.fillStyle = th.acc[1];
      [[-.55, .9], [-.2, .95], [.25, .95], [.6, .9]].forEach(function (l) { c.beginPath(); c.moveTo(l[0] * sc - .12 * sc, -sc * .9); c.lineTo(l[0] * sc + .12 * sc, -sc * .9); c.lineTo(l[0] * sc + .05 * sc, 0); c.lineTo(l[0] * sc - .05 * sc, 0); c.closePath(); c.fill(); });
      c.beginPath(); c.ellipse(0, -sc * 1.1, sc * .85, sc * .42, 0, 0, TAU); c.fill();
      c.save(); c.translate(-sc * .75, -sc * 1.45); c.rotate(nod);
      c.beginPath(); c.ellipse(0, -sc * .1, sc * .42, sc * .38, 0, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(-sc * .28, -sc * .5, sc * .14, sc * .3, -.35, 0, TAU); c.ellipse(sc * .24, -sc * .52, sc * .14, sc * .3, .35, 0, TAU); c.fill();
      c.restore(); c.restore();
    }
    c.strokeStyle = rgba(th.ink, .25); c.lineWidth = 1; c.beginPath(); c.moveTo(A.x + A.w * .06, floor + .5); c.lineTo(A.x + A.w * .96, floor + .5); c.stroke();
  };

  /* 롤리폴리 암체어의 둥근 형태가 색을 바꿉니다 (드리아데) */
  M.sculpt = function (c, w, h, t, th) {
    var A = area(w, h), cx = A.x + A.w * .56, base = A.y + A.h * .86, U = Math.min(A.w, A.h) * .42;
    var idx = Math.floor(Math.max(0, t - 1.8) / 1.6) % 3, nx = (idx + 1) % 3, f = t > 1.8 ? eio(clamp(((t - 1.8) % 1.6) / .6, 0, 1)) : 0;
    function mix(a, b, k) { var A1 = parseInt(a.slice(1), 16), B1 = parseInt(b.slice(1), 16); var r = (A1 >> 16) + ((B1 >> 16) - (A1 >> 16)) * k, g = (A1 >> 8 & 255) + ((B1 >> 8 & 255) - (A1 >> 8 & 255)) * k, bl = (A1 & 255) + ((B1 & 255) - (A1 & 255)) * k; return "rgb(" + (r | 0) + "," + (g | 0) + "," + (bl | 0) + ")"; }
    var col = t > 1.8 ? mix(th.acc[idx], th.acc[nx], f) : th.acc[0];
    var g = eo(prog(t, .2, 1.4));
    c.fillStyle = rgba(th.ink, .1 * g); c.beginPath(); c.ellipse(cx, base + 4, U * 1.15, U * .12, 0, 0, TAU); c.fill();
    c.save(); c.translate(cx, base); c.scale(1, g);
    c.fillStyle = col;
    [-.7, -.25, .25, .7].forEach(function (l) { rr(c, l * U - U * .17, -U * .62, U * .34, U * .62, U * .17); c.fill(); });
    c.beginPath(); c.moveTo(-U * 1.02, -U * .55); c.bezierCurveTo(-U * 1.08, -U * 1.55, U * 1.08, -U * 1.55, U * 1.02, -U * .55);
    c.bezierCurveTo(U * .9, -U * .35, -U * .9, -U * .35, -U * 1.02, -U * .55); c.fill();
    c.fillStyle = "rgba(255,255,255,.16)"; c.beginPath(); c.ellipse(-U * .35, -U * 1.05, U * .35, U * .12, -.3, 0, TAU); c.fill();
    c.restore();
    for (var i = 0; i < 3; i++) { c.fillStyle = th.acc[i]; c.beginPath(); c.arc(A.x + A.w * .9, A.y + A.h * (.22 + i * .08), i === (t > 1.8 ? (f > .5 ? nx : idx) : 0) ? 7 : 4, 0, TAU); c.fill(); }
  };

  /* 유리잔이 그려지고 색이 차오릅니다 (크베트나) */
  M.glass = function (c, w, h, t, th) {
    var A = area(w, h), n = 4, gap = A.w / (n + .6), base = A.y + A.h * .86, H = A.h * .66;
    for (var i = 0; i < n; i++) {
      var x = A.x + gap * (i + .8), p = eio(prog(t, .2 + i * .25, 1.2)); if (!p) continue;
      var sway = Math.sin(t * .7 + i) * 2, bw = H * .26, bh = H * .42, top = base - H;
      c.save(); c.translate(x + sway, 0);
      var fill = eo(prog(t, 1.4 + i * .3, 1.2));
      if (fill > 0) {
        c.save(); c.beginPath(); c.moveTo(-bw, top); c.bezierCurveTo(-bw, top + bh * 1.1, bw, top + bh * 1.1, bw, top); c.closePath(); c.clip();
        var lv = top + bh * (1 - .7 * fill);
        var g = c.createLinearGradient(0, lv, 0, top + bh); g.addColorStop(0, rgba(th.acc[i], .55)); g.addColorStop(1, rgba(th.acc[i], .9));
        c.fillStyle = g; c.fillRect(-bw, lv + Math.sin(t * 2 + i) * 1.5, bw * 2, bh);
        c.restore();
      }
      c.strokeStyle = rgba(th.ink, .75); c.lineWidth = 1.4;
      c.setLineDash([2000]); c.lineDashOffset = 2000 * (1 - p);
      c.beginPath(); c.moveTo(-bw, top); c.bezierCurveTo(-bw, top + bh * 1.1, bw, top + bh * 1.1, bw, top);
      c.moveTo(0, top + bh * .83); c.lineTo(0, base - 4); c.moveTo(-bw * .7, base); c.quadraticCurveTo(0, base - 8, bw * .7, base); c.stroke();
      c.setLineDash([]);
      c.fillStyle = rgba(th.acc[i], .9); c.fillRect(-1.6, top + bh * .83, 3.2, (base - top - bh * .83) * fill);
      c.strokeStyle = "rgba(255,255,255,.7)"; c.lineWidth = 2; c.beginPath(); c.moveTo(-bw * .6, top + 10); c.quadraticCurveTo(-bw * .75, top + bh * .4, -bw * .45, top + bh * .62); c.stroke();
      c.restore();
    }
  };

  /* 견과가 쏟아져 쌓입니다 (사할리 스낵 · 프레시맥 · 오트) */
  M.nuts = function (c, w, h, t, th) {
    var A = area(w, h), o = th.opt || {}, r = rng(o.kind === "mac" ? 8 : o.kind === "oat" ? 6 : 2), N = o.kind === "oat" ? 46 : 30, floor = A.y + A.h * .9;
    if (o.kind === "oat") {
      var sp = eo(prog(t, 1.6, 2)), cx = A.x + A.w * .66, cy = A.y + A.h * .38;
      c.strokeStyle = rgba(th.acc[2], .55); c.lineWidth = 8; c.lineCap = "round"; c.beginPath();
      for (var k = 0; k <= 80 * sp; k++) { var a = k / 80 * TAU * 2.4 + t * .2, rad = 4 + k * .9; var X = cx + Math.cos(a) * rad, Y = cy + Math.sin(a) * rad * .7; k ? c.lineTo(X, Y) : c.moveTo(X, Y); }
      c.stroke(); c.lineCap = "butt";
    }
    for (var i = 0; i < N; i++) {
      var u = r(), v = r(), kind = Math.floor(r() * 5), st = .2 + i * (o.kind === "oat" ? .05 : .08) + r() * .2;
      var p = prog(t, st, .9); if (!p) continue;
      var x = A.x + A.w * (.1 + u * .8), heap = (1 - Math.pow((u - .5) * 2, 2)) * A.h * .32, y1 = floor - v * heap - 8;
      var y = (A.y - 30) + (y1 - (A.y - 30)) * bounce(p), rot = u * 9 + (1 - p) * 2;
      c.save(); c.translate(x, y); c.rotate(rot);
      if (o.kind === "mac") {
        var R = 11 + v * 5; c.fillStyle = th.acc[0]; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
        c.fillStyle = rgba(th.acc[1], .9); c.beginPath(); c.arc(-R * .3, -R * .3, R * .45, 0, TAU); c.fill();
        if (kind < 2) { c.fillStyle = th.acc[2]; c.beginPath(); c.arc(R * .1, R * .05, R * .55, -.4, 2.2); c.fill(); }
        c.strokeStyle = rgba("#2A1A0A", .5); c.lineWidth = 1.2; c.beginPath(); c.moveTo(-R * .2, -R * .9); c.quadraticCurveTo(R * .3, 0, -R * .1, R * .9); c.stroke();
      } else if (o.kind === "oat") {
        c.fillStyle = th.acc[kind % 2]; c.beginPath(); c.ellipse(0, 0, 9, 4.2, 0, 0, TAU); c.fill();
        c.strokeStyle = rgba(th.acc[2], .4); c.beginPath(); c.moveTo(-7, 0); c.lineTo(7, 0); c.stroke();
      } else {
        var col = th.acc[kind % th.acc.length];
        if (kind === 0) { c.fillStyle = col; c.beginPath(); c.moveTo(-12, 0); c.quadraticCurveTo(0, -9, 13, 0); c.quadraticCurveTo(0, 9, -12, 0); c.fill(); }
        else if (kind === 1) { c.fillStyle = "#D9C9A6"; c.beginPath(); c.ellipse(0, 0, 10, 7, 0, 0, TAU); c.fill(); c.fillStyle = col; c.beginPath(); c.ellipse(1, 0, 6, 5, 0, 0, TAU); c.fill(); }
        else if (kind === 2) { c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, 12, 6.5, 0, 0, TAU); c.fill(); c.strokeStyle = "rgba(0,0,0,.25)"; c.beginPath(); c.moveTo(-10, 0); c.lineTo(10, 0); c.moveTo(-5, -5); c.lineTo(-5, 5); c.moveTo(3, -5); c.lineTo(3, 5); c.stroke(); }
        else if (kind === 3) { c.fillStyle = col; c.beginPath(); c.arc(0, 0, 4.5, 0, TAU); c.arc(7, 3, 4, 0, TAU); c.fill(); }
        else { c.fillStyle = col; c.beginPath(); c.arc(0, 0, 10, Math.PI * .2, Math.PI * 1.25); c.arc(-3, -2, 6, Math.PI * 1.2, Math.PI * .25, true); c.fill(); }
      }
      c.restore();
    }
  };

  /* 따뜻한 열기가 올라옵니다 (김국산 핫팩) */
  M.heat = function (c, w, h, t, th) {
    var A = area(w, h), cx = A.x + A.w * ((th.opt || {}).cx || .55), cy = A.y + A.h * .55, R = Math.min(A.w, A.h) * .55, pulse = 1 + .04 * Math.sin(t * 2.2);
    var gp = eo(prog(t, .2, 1.4));
    var g = c.createRadialGradient(cx, cy, 0, cx, cy, R * pulse * gp + 1);
    g.addColorStop(0, rgba(th.acc[2], .95)); g.addColorStop(.45, rgba(th.acc[1], .55)); g.addColorStop(1, rgba(th.acc[0], 0));
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R * pulse * gp + 1, 0, TAU); c.fill();
    for (var i = 0; i < 7; i++) {
      var x = A.x + A.w * (.2 + i * .1), p = eo(prog(t, .5 + i * .12, 1.2)); if (!p) continue;
      c.strokeStyle = rgba(th.acc[0], .45); c.lineWidth = 2.2; c.lineCap = "round"; c.beginPath();
      for (var k = 0; k <= 40; k++) { var yy = A.y + A.h * .92 - k / 40 * A.h * .75 * p, xx = x + Math.sin(k * .35 - t * 3 + i) * 7; k ? c.lineTo(xx, yy) : c.moveTo(xx, yy); }
      c.stroke(); c.lineCap = "butt";
    }
    var tp = prog(t, 1.5, 1.4), num = Math.round(70 * eo(tp));
    if (tp > 0) {
      c.fillStyle = rgba(th.ink, .85); c.font = "700 " + Math.round(R * .55) + "px Poppins, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(num + "°", cx, cy);
    }
  };

  /* 측정 플랫폼과 맥박 선 (앳플리 T8 스마트 체중계) */
  M.pulse = function (c, w, h, t, th) {
    var A = area(w, h), cx = A.x + A.w * .55, cy = A.y + A.h * .55, S = Math.min(A.w, A.h) * .6, p = eo(prog(t, .2, 1));
    c.save(); c.translate(cx, cy); c.transform(1, 0, -.35, .55, 0, 0);
    rr(c, -S / 2, -S / 2, S, S * p, 18); c.fillStyle = "#F7F9FA"; c.fill(); c.strokeStyle = rgba(th.ink, .25); c.lineWidth = 1.5; c.stroke();
    c.restore();
    var v = 62.4 * eo(prog(t, 1.2, 1.8));
    c.fillStyle = th.ink; c.font = "600 " + Math.round(S * .2) + "px Poppins, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
    if (t > 1.1) c.fillText(v.toFixed(1), cx, cy - 4);
    c.font = "500 " + Math.round(S * .06) + "px Poppins, sans-serif"; c.fillStyle = rgba(th.ink, .6); if (t > 1.1) c.fillText("kg", cx + S * .27, cy - 2);
    var lp = prog(t, 1, 1.5), y0 = A.y + A.h * .18;
    c.strokeStyle = th.acc[0]; c.lineWidth = 2; c.beginPath();
    for (var k = 0; k <= 120 * lp; k++) {
      var x = A.x + A.w * .08 + k / 120 * A.w * .84, ph = (k / 120 * 4 - t * .8) % 1, beat = ph < 0 ? ph + 1 : ph;
      var y = y0 + (beat > .45 && beat < .5 ? -18 : beat > .5 && beat < .55 ? 12 : 0);
      k ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.stroke();
  };


  /* ── 사진 위·아래에 겹치는 캔버스 효과 ─────────────────────────────── */
  var FX = {};

  /* 숲 안개와 떠오르는 향 입자 (에이르보) */
  FX.fog = function (c, w, h, t, th) {
    var veil = 1 - eo(prog(t, 0, 2.6));
    if (veil > 0) { c.fillStyle = "rgba(226,230,224," + (.55 * veil).toFixed(3) + ")"; c.fillRect(0, 0, w, h); }
    var r = rng(5);
    for (var i = 0; i < 7; i++) {
      var R = h * (.5 + r() * .5), sp = 6 + r() * 10, y = h * (.25 + r() * .7);
      var x = ((r() * (w + 2 * R) + t * sp) % (w + 2 * R)) - R;
      var g = c.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, "rgba(235,238,232," + (.13 + .06 * Math.sin(t * .3 + i)).toFixed(3) + ")");
      g.addColorStop(1, "rgba(235,238,232,0)");
      c.fillStyle = g; c.fillRect(x - R, y - R, 2 * R, 2 * R);
    }
    var mp = prog(t, 1.2, 2);
    for (var k = 0; k < 46; k++) {
      var px = r() * w, life = 7 + r() * 6, ph = (t / life + r()) % 1;
      var yy = h * (1.05 - ph * 1.1), xx = px + Math.sin(t * .6 + k) * 14;
      c.fillStyle = rgba(th.acc[k % 3], (.55 * Math.sin(ph * Math.PI)) * mp);
      c.beginPath(); c.arc(xx, yy, 1 + (k % 3) * .6, 0, TAU); c.fill();
    }
  };

  /* 라벤더 꽃잎과 꽃가루 (라 메종 뒤 미엘) */
  FX.lavender = function (c, w, h, t, th) {
    var r = rng(9), on = eo(prog(t, .8, 1.6));
    if (!on) return;
    for (var i = 0; i < 22; i++) {
      var sp = 18 + r() * 26, life = (w + 200) / sp, ph = (t / life + r()) % 1;
      var x = w + 60 - ph * (w + 160), y = h * (.1 + r() * .8) + Math.sin(t * .8 + i) * 18 - ph * 40, rot = t * (.4 + r() * .6) + i;
      c.save(); c.translate(x, y); c.rotate(rot); c.globalAlpha = .75 * on;
      for (var k = 0; k < 5; k++) { c.fillStyle = th.acc[k % 2 ? 2 : 0]; c.beginPath(); c.ellipse(k * 3.4 - 7, (k % 2 ? 1.6 : -1.6), 2.6, 1.6, .3, 0, TAU); c.fill(); }
      c.restore();
    }
    c.globalAlpha = 1;
    for (var j = 0; j < 40; j++) {
      var px = r() * w, life2 = 9 + r() * 8, p2 = (t / life2 + r()) % 1;
      c.fillStyle = rgba(th.acc[1], .7 * Math.sin(p2 * Math.PI) * on);
      c.beginPath(); c.arc(px + Math.sin(t + j) * 10, h * (1 - p2), 1.4, 0, TAU); c.fill();
    }
  };

  /* 레몬 단면 테두리 (브론리): 사진 창(win)의 원 크기를 따라갑니다 */
  FX.zest = function (c, w, h, t, th, S) {
    var win = S && S.ref.win; if (!win) return;
    var cc = S.val(win, "cc"); if (!cc) return;
    var B = { x: win.bx[0] * w / 100, y: win.bx[1] * h / 100, w: win.bx[2] * w / 100, h: win.bx[3] * h / 100 }, ref = Math.sqrt(B.w * B.w + B.h * B.h) / Math.SQRT2;
    var R = cc[0] / 100 * ref, cx = B.x + B.w * cc[1] / 100, cy = B.y + B.h * cc[2] / 100;
    var fade = 1 - prog(cc[0], 30, 18);
    if (R < 2 || fade <= 0) return;
    c.save(); c.globalAlpha = fade;
    c.lineWidth = Math.max(6, R * .075); c.strokeStyle = th.acc[0];
    c.beginPath(); c.arc(cx, cy, R + c.lineWidth / 2, 0, TAU); c.stroke();
    c.lineWidth = Math.max(2, R * .02); c.strokeStyle = th.acc[1];
    c.beginPath(); c.arc(cx, cy, R + 1, 0, TAU); c.stroke();
    var sp = 1 - prog(t, .9, .9);
    if (sp > 0) {
      c.strokeStyle = "rgba(255,252,230," + (.85 * sp).toFixed(3) + ")"; c.lineWidth = 3;
      for (var i = 0; i < 10; i++) { var a = i / 10 * TAU + t * .25; c.beginPath(); c.moveTo(cx + Math.cos(a) * R * .12, cy + Math.sin(a) * R * .12); c.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); c.stroke(); }
    }
    c.restore();
  };

  /* 너도밤나무 꿀 방울이 떨어져 화면이 열리고, 금빛 입자가 떠오릅니다 (에어본) */
  FX.honeydew = function (c, w, h, t, th, S) {
    var P = (S && S.ref.hit) || [.68, .52], hx = w * P[0], hy = h * P[1];
    var f = prog(t, .15, .9);
    if (f > 0 && f < 1) {
      var y = -20 + (hy + 20) * ei(f), s = 1 + f * .4;
      var g = c.createLinearGradient(hx, y - 22 * s, hx, y + 10 * s);
      g.addColorStop(0, th.acc[1]); g.addColorStop(1, th.acc[0]);
      c.fillStyle = g; c.beginPath();
      c.moveTo(hx, y - 22 * s); c.quadraticCurveTo(hx + 9 * s, y - 2 * s, hx, y + 8 * s); c.quadraticCurveTo(hx - 9 * s, y - 2 * s, hx, y - 22 * s); c.fill();
    }
    var q = prog(t, 1.05, 1.6);
    if (q > 0 && q < 1) {
      for (var k = 0; k < 3; k++) {
        var qq = clamp(q * 1.2 - k * .12, 0, 1); if (!qq) continue;
        c.strokeStyle = rgba(th.acc[1], (1 - qq) * .9); c.lineWidth = 2.4 * (1 - qq) + .5;
        c.beginPath(); c.ellipse(hx, hy, 10 + qq * w * .5, 4 + qq * h * .3, 0, 0, TAU); c.stroke();
      }
    }
    var on = eo(prog(t, 1.6, 2));
    if (!on) return;
    var r = rng(3);
    c.globalCompositeOperation = "lighter";
    for (var i = 0; i < 34; i++) {
      var life = 8 + r() * 8, ph = (t / life + r()) % 1, x = r() * w + Math.sin(t * .5 + i) * 20, yy = h * (1.1 - ph * 1.2), R = 1.5 + r() * (i % 5 ? 3 : 9);
      var gg = c.createRadialGradient(x, yy, 0, x, yy, R * 2.2);
      gg.addColorStop(0, rgba(th.acc[1], .55 * Math.sin(ph * Math.PI) * on)); gg.addColorStop(1, rgba(th.acc[0], 0));
      c.fillStyle = gg; c.beginPath(); c.arc(x, yy, R * 2.2, 0, TAU); c.fill();
    }
    c.globalCompositeOperation = "source-over";
  };

  /* 떠다니는 진주 구슬 (클라라앤코, 사진 뒤) */
  FX.pearls = function (c, w, h, t, th) {
    var r = rng(17);
    for (var i = 0; i < 13; i++) {
      var R = (i % 4 ? 10 + r() * 22 : 40 + r() * 30) * Math.min(1, w / 900 + .35), bx = r() * w, by = r() * h;
      var p = back(prog(t, .1 + i * .07, .9)); if (!p) continue;
      var x = bx + Math.sin(t * .35 + i) * 18, y = by + Math.cos(t * .3 + i * 1.7) * 14, rad = R * p;
      var g = c.createRadialGradient(x - rad * .35, y - rad * .4, rad * .05, x, y, rad);
      g.addColorStop(0, "#FFFFFF"); g.addColorStop(.35, "#FCE6EB"); g.addColorStop(.8, "#F2B6C4"); g.addColorStop(1, "#E89AAE");
      c.globalAlpha = i % 4 ? .95 : .55;
      c.fillStyle = g; c.beginPath(); c.arc(x, y, rad, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
  };

  /* 톡톡 터지는 동그라미 (마이베프, 사진 뒤) */
  FX.pops = function (c, w, h, t, th) {
    var r = rng(31);
    for (var i = 0; i < 18; i++) {
      var per = 2.4 + r() * 2.2, off = r() * per, x = w * (.3 + r() * .7), y = h * r(), R = 6 + r() * 18;
      var ph = ((t + off) % per) / per, live = t > .6 + i * .05 ? 1 : 0;
      if (!live) continue;
      var col = th.acc[i % 3 === 0 ? 0 : 2];
      if (ph < .55) { c.fillStyle = rgba(col, .55); c.beginPath(); c.arc(x, y, R * back(ph / .55), 0, TAU); c.fill(); }
      else { var q = (ph - .55) / .45; c.strokeStyle = rgba(col, .6 * (1 - q)); c.lineWidth = 2; c.beginPath(); c.arc(x, y, R * (1 + q * .8), 0, TAU); c.stroke(); }
    }
  };

  /* ── 장면 엔진: 레이어를 시간(t, 초)에 따라 움직입니다 ─────────────────────────────── */
  var IMG = "assets/img/brand/";
  var EASE = {
    lin: function (x) { return x; }, out: eo, io: eio, "in": ei, back: back,
    expo: function (x) { return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); },
    spring: function (x) { return x >= 1 ? 1 : 1 - Math.exp(-6.2 * x) * Math.cos(x * 10.5); }
  };
  var DEF = { x: 0, y: 0, s: 1, r: 0, o: 1, b: 0, kx: 0, bx: 0 };

  function Track(el, S) { this.el = el; this.S = S; this.tw = {}; this.osc = []; this.base = {}; this.cur = {}; }
  Track.prototype.get = function (p, t) {
    var list = this.tw[p], v;
    if (!list) v = p in this.base ? this.base[p] : DEF[p];
    else if (t < list[0].at) v = list[0].f;
    else {
      var k = list[0];
      for (var i = 1; i < list.length; i++) if (list[i].at <= t) k = list[i];
      var x = k.e(clamp((t - k.at) / k.d, 0, 1));
      if (Array.isArray(k.f)) { v = []; for (var j = 0; j < k.f.length; j++) v.push(k.f[j] + (k.t[j] - k.f[j]) * x); }
      else v = k.f + (k.t - k.f) * x;
    }
    for (var q = 0; q < this.osc.length; q++) {
      var o = this.osc[q]; if (o.p !== p || t < o.at) continue;
      var u = t - o.at;
      if (o.type === "saw") v += o.a * ((u / o.per) % 1);
      else if (o.type === "spin") v += o.a * u / o.per;
      else v += o.a * Math.sin(u / o.per * TAU + o.ph) * clamp(u / 1.2, 0, 1);
    }
    return v;
  };
  Track.prototype.apply = function (t) {
    var g = this.get.bind(this), st = this.el.style, x = g("x", t), y = g("y", t), s = g("s", t), r = g("r", t), kx = g("kx", t);
    st.transform = "translate(" + x.toFixed(2) + "%," + y.toFixed(2) + "%) rotate(" + r.toFixed(2) + "deg) scale(" + s.toFixed(4) + ")" + (kx ? " skewX(" + kx.toFixed(2) + "deg)" : "");
    var o = clamp(g("o", t), 0, 1); st.opacity = o.toFixed(3);
    st.visibility = o < .002 ? "hidden" : "";
    var b = g("b", t); st.filter = b > .05 ? "blur(" + b.toFixed(1) + "px)" : "";
    if (this.tw.ci) { var ci = g("ci", t); this.cur.ci = ci; st.clipPath = "inset(" + ci.map(function (n) { return n.toFixed(2) + "%"; }).join(" ") + ")"; }
    if (this.tw.cc) { var cc = g("cc", t); this.cur.cc = cc; st.clipPath = "circle(" + cc[0].toFixed(2) + "% at " + cc[1] + "% " + cc[2] + "%)"; }
    if (this.tw.bx || this.osc.some(function (q) { return q.p === "bx"; })) st.backgroundPosition = g("bx", t).toFixed(2) + "% 50%";
  };

  function makeScene(film, stage, b, th, mobile) {
    var S = { film: film, stage: stage, b: b, th: th, m: mobile, tracks: [], groups: [], ref: {}, imgs: [] };
    var REG0 = { d: [40, 0, 60, 100], m: [0, 0, 100, 60] };
    S.src = function (n) { return n.indexOf("/") >= 0 ? n : IMG + b.id + "/" + n + ".webp"; };
    function mapR(r) { var G = th.region || REG0, R = mobile ? G.m : G.d; return [R[0] + r[0] * R[2] / 100, R[1] + r[1] * R[3] / 100, r[2] * R[2] / 100, r[3] * R[3] / 100]; }
    function img(n, o) {
      var im = document.createElement("img");
      im.src = S.src(n); im.alt = ""; im.decoding = "async"; im.draggable = false;
      if (o.pos) im.style.objectPosition = o.pos;
      S.imgs.push(im);
      return im;
    }
    /* 레이어 하나: box 는 필름 기준 %, rbox 는 '모션 자리' 기준 %(넓은 화면 오른쪽 60%, 좁은 화면 위쪽 60%) */
    S.L = function (o) {
      var bx = mobile && o.mbox !== undefined ? o.mbox : o.rbox ? mapR(o.rbox) : o.box;
      if (!bx) return null;
      var el = document.createElement("div");
      el.className = "bf-l" + (o.cls ? " " + o.cls : "");
      el.style.cssText = "left:" + bx[0] + "%;top:" + bx[1] + "%;width:" + bx[2] + "%;height:" + bx[3] + "%;" + (o.z != null ? "z-index:" + o.z + ";" : "") + (o.org ? "transform-origin:" + o.org + ";" : "") + (o.css || "");
      var h = new Track(el, S);
      h.bx = bx;
      if (o.img) { var im = img(o.img, o); el.appendChild(im); h.i = new Track(im, S); S.tracks.push(h.i); }
      if (o.slides) { h.slides = o.slides.map(function (n) { var im = img(n, o); el.appendChild(im); return im; }); }
      if (o.html) el.insertAdjacentHTML("beforeend", o.html);
      if (o.base) h.base = o.base;
      stage.appendChild(el);
      S.tracks.push(h);
      return h;
    };
    /* 움직임: props 는 { o: [0, 1], y: [30, 0] } 처럼 [시작, 끝] */
    S.go = function (h, at, d, props, ease) {
      if (!h) return;
      var e = EASE[ease || "out"] || ease;
      Object.keys(props).forEach(function (p) {
        (h.tw[p] || (h.tw[p] = [])).push({ at: at, d: d, f: props[p][0], t: props[p][1], e: e });
        h.tw[p].sort(function (a, c) { return a.at - c.at; });
      });
    };
    S.osc = function (h, p, a, per, at, ph, type) { if (h) h.osc.push({ p: p, a: a, per: per, at: at || 0, ph: ph || 0, type: type }); };
    /* 사진 여러 장을 천천히 바꿔 보여 줍니다(켄 번스) */
    S.slides = function (h, o) { if (h && h.slides) S.groups.push({ h: h, at: o.at || 0, every: o.every || 5, fade: o.fade || 1.2, kb: o.kb || [1.12, 1.0] }); };
    S.val = function (h, p) { return h && h.cur[p]; };
    /* 글씨가 잘 읽히도록 바탕색 그라데이션 (넓은 화면 왼쪽) */
    S.shade = function (a) {
      if (mobile) return;
      S.L({ box: [0, 0, 70, 100], z: 5, css: "background:linear-gradient(90deg," + rgba(th.bg, a || .9) + " 0%," + rgba(th.bg, (a || .9) * .62) + " 34%," + rgba(th.bg, 0) + " 70%);" });
    };
    S.render = function (t) {
      S.tracks.forEach(function (h) { h.apply(t); });
      S.groups.forEach(function (g) {
        var n = g.h.slides.length, u = t - g.at, k = Math.max(0, Math.floor(u / g.every)), cur = k % n, prev = (k + n - 1) % n;
        var local = u - k * g.every, fin = k === 0 ? 1 : clamp(local / g.fade, 0, 1);
        g.h.slides.forEach(function (im, i) {
          var vis = i === cur || (i === prev && fin < 1 && k > 0);
          im.style.opacity = i === cur ? eio(fin).toFixed(3) : vis ? "1" : "0";
          im.style.zIndex = i === cur ? 2 : vis ? 1 : 0;
          im.style.visibility = vis || i === cur ? "" : "hidden";
          if (vis) {
            var kk = i === cur ? k : k - 1, p = clamp((u - kk * g.every) / (g.every + g.fade), 0, 1), up = kk % 2 === 0;
            var s = up ? g.kb[0] + (g.kb[1] - g.kb[0]) * p : g.kb[1] + (g.kb[0] - g.kb[1]) * p, dx = (kk % 3 - 1) * 1.6 * p;
            im.style.transform = "translate(" + dx.toFixed(2) + "%,0) scale(" + s.toFixed(4) + ")";
          }
        });
      });
    };
    return S;
  }

  /* 브랜드 제품 사진 목록 (제품 카드와 같은 사진) */
  function productImgs(id) { return (window.IBR_PRODUCTS || []).filter(function (p) { return p.b === id && p.img && !p.imgFull; }).map(function (p) { return p.img; }); }

  /* 제품이 한 줄로 올라옵니다: 모양(fan 부채꼴, row 가지런히), 높이 h(0~100) */
  function lineup(S, imgs, o) {
    o = o || {};
    var n = imgs.length; if (!n) return [];
    var x0 = o.x0 != null ? o.x0 : 4, x1 = o.x1 != null ? o.x1 : 98, w = (x1 - x0) / n, H = o.h || 78, base = o.base || 94;
    return imgs.map(function (src, i) {
      var c = (i - (n - 1) / 2) / Math.max(1, (n - 1) / 2), hh = H * (o.fan ? 1 - Math.abs(c) * .1 : 1);
      var h = S.L({ img: src, cls: "ct drop", rbox: [x0 + w * i - w * .1, base - hh, w * 1.2, hh], org: "50% 100%" });
      var at = (o.at || 1.1) + i * (o.step || .14);
      S.go(h, at, 1.1, { y: [34, 0], o: [0, 1] }, "spring");
      if (o.fan) S.go(h, at, 1.3, { r: [c * 26, c * 9] }, "spring");
      S.osc(h, "y", 1.2, 4.6 + i * .37, at + 1.6, i * 1.3);
      return h;
    });
  }

  var MEANDER = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="22" viewBox="0 0 28 22"><path d="M0 19.5H28M0 2.5H28M22 19.5V6.5H8V15.5H17V10.5" fill="none" stroke="#C9A24A" stroke-width="2.2"/></svg>');

  var SCENES = {};

  /* 에이르보: 안개 낀 숲에서 향 세 가지(07·10·11)가 차례로 떠오릅니다 */
  SCENES.arvo = function (S) {
    var bg = S.L({ slides: ["forest", "branch", "dark", "lake"], box: [0, 0, 100, 100], pos: "50% 45%" });
    S.slides(bg, { every: 5.8, fade: 1.8, kb: [1.16, 1.02] });
    S.go(bg, 0, 2.4, { o: [0, 1], b: [14, 0] }, "out");
    S.shade(.92);
    ["b07", "b10", "b11"].forEach(function (n, i) {
      var x = S.m ? 34 + i * 18 : 60 + i * 11.5, y = S.m ? 6 + (i === 1 ? 0 : 4) : (i === 1 ? 14 : 22), hh = S.m ? 50 - (i === 1 ? 0 : 4) : 92 - y;
      var g = S.L({ box: [x - (S.m ? 9 : 5.5), y + hh * .2, S.m ? 32 : 20, hh * .8], css: "background:radial-gradient(closest-side," + rgba(S.th.acc[i], .62) + "," + rgba(S.th.acc[i], 0) + ");" });
      var b = S.L({ img: n, cls: "ct drop", box: [x, y, S.m ? 14 : 9, hh] });
      var at = 1.5 + i * .34;
      S.go(b, at, 1.4, { y: [30, 0], o: [0, 1], b: [10, 0] }, "spring");
      S.go(g, at + .3, 1.6, { o: [0, 1], s: [.3, 1] }, "out");
      S.osc(b, "y", 1.4, 5.4 + i * .8, at + 1.6, i * 1.9);
      S.osc(g, "s", .1, 3.4 + i * .6, at + 1.8, i);
    });
  };

  /* 아티키: 산토리니가 펼쳐졌다가 세 폭으로 갈라지며 벌집·꿀이 올라오고, 메안더 띠가 흐릅니다 */
  SCENES.attiki = function (S) {
    S.th.region = S.th.region || { d: [44, 0, 56, 100], m: [0, 0, 100, 62] };
    var gap = .9, sw = (100 - 2 * gap) / 3;
    var s1 = S.L({ slides: ["comb", "keeper"], rbox: [0, 0, sw, 100], pos: "50% 40%" });
    var s2 = S.L({ slides: ["dipper", "wood"], rbox: [sw + gap, 0, sw, 100], pos: "50% 40%" });
    var sa = S.L({ img: "santorini", rbox: [0, 0, 100, 100], pos: "70% 50%" });
    S.slides(s1, { at: 1.9, every: 6.4, fade: 1.6, kb: [1.14, 1.0] });
    S.slides(s2, { at: 2.1, every: 6.8, fade: 1.6, kb: [1.0, 1.14] });
    S.go(sa, .15, 1.2, { ci: [[0, 100, 0, 0], [0, 0, 0, 0]] }, "io");
    S.go(sa, 1.8, 1.0, { ci: [[0, 0, 0, 0], [0, 0, 0, 66.8]] }, "io");
    S.go(sa.i, 0, 9, { s: [1.18, 1.02] }, "out");
    S.go(s1, 1.95, 1.0, { ci: [[100, 0, 0, 0], [0, 0, 0, 0]] }, "io");
    S.go(s2, 2.15, 1.0, { ci: [[100, 0, 0, 0], [0, 0, 0, 0]] }, "io");
    var band = S.L({ rbox: [0, 91, 100, 9], z: 3, css: "background:#14306A url('" + MEANDER + "') 0 50%/auto 76% repeat-x;" });
    S.go(band, 2.6, 1.1, { ci: [[0, 100, 0, 0], [0, 0, 0, 0]] }, "io");
    S.osc(band, "bx", -100, 9, 2.6, 0, "saw");
    var g = S.L({ img: "greek", cls: "ct drop", box: [37.5, 24, 12.5, 70], mbox: [4, 10, 28, 48], z: 4 });
    var d = S.L({ img: "dark", cls: "ct drop", box: [47.5, 32, 11, 62], mbox: [27, 18, 22, 40], z: 4 });
    S.go(g, 2.9, 1.2, { y: [40, 0], o: [0, 1] }, "spring");
    S.go(d, 3.1, 1.2, { y: [40, 0], o: [0, 1] }, "spring");
    S.osc(g, "y", 1, 5.2, 4.4); S.osc(d, "y", 1, 6, 4.6, 2);
  };

  /* 브론리: 레몬 단면 같은 동그란 창이 열리고 레몬 비누가 굴러 들어온 뒤, 창이 화면 가득 넓어집니다 */
  SCENES.bronnley = function (S) {
    S.th.region = S.th.region || { d: [42, 0, 58, 100], m: [0, 0, 100, 62] };
    var win = S.L({ slides: ["stack", "tower", "soaps", "window", "shelf", "balm"], rbox: [0, 0, 100, 100], pos: "50% 50%" });
    S.ref.win = win;
    S.slides(win, { every: 6, fade: 1.6, kb: [1.12, 1.0] });
    S.go(win, .3, 1.3, { cc: [[0, 50, 50], [27, 50, 50]] }, "spring");
    S.go(win, 4.2, 1.3, { cc: [[27, 50, 50], [78, 50, 50]] }, "io");
    var crest = S.L({ img: "crest", cls: "ct", box: [3.6, 7, 9, 30], mbox: [4, 4, 20, 20], pos: "0 0" });
    S.go(crest, 1, 1.2, { o: [0, 1], s: [.82, 1], y: [-8, 0] }, "out");
    var soap = S.L({ img: "soap", cls: "ct drop", rbox: S.m ? [8, 66, 36, 30] : [18, 66, 24, 28], z: 3 });
    var balm = S.L({ img: "handbalm", cls: "ct drop", rbox: S.m ? [70, 22, 14, 74] : [62, 24, 9, 70], z: 3 });
    S.go(soap, 1.3, 1.4, { x: [260, 0], r: [240, 0], o: [0, 1] }, "out");
    S.go(balm, 1.8, 1.1, { y: [45, 0], o: [0, 1] }, "spring");
    S.go(soap, 4.1, .6, { o: [1, 0], y: [0, 14] }, "in");
    S.go(balm, 4.2, .6, { o: [1, 0], y: [0, 14] }, "in");
  };

  /* 라 메종 뒤 미엘: 파리 가게 창문 같은 아치 세 개가 올라오고, 라벤더 꿀 병이 가운데 섭니다 */
  SCENES.lamaison = function (S) {
    S.th.region = S.th.region || { d: [42, 0, 58, 100], m: [0, 0, 100, 62] };
    var A = [[2, 14, 29, 86, ["field", "lavender"]], [35.5, 4, 29, 96, ["shop", "printemps"]], [69, 14, 29, 86, ["comb", "keeper"]]];
    A.forEach(function (a, i) {
      var h = S.L({ slides: a[4], rbox: [a[0], a[1], a[2], a[3]], cls: "arch", pos: "50% 50%" });
      S.slides(h, { at: 0, every: 6.6 + i * .5, fade: 1.6, kb: [1.14, 1.0] });
      S.go(h, .2 + i * .25, 1.4, { y: [105, 0] }, "expo");
    });
    var seal = S.L({ img: "seal", cls: "ct", box: [30, 6, 10, 26], mbox: false, pos: "50% 0" });
    S.go(seal, 1.2, 1.4, { o: [0, .85], s: [.6, 1], r: [-120, 0] }, "out");
    S.osc(seal, "r", 360, 60, 2.6, 0, "spin");
    var jar = S.L({ img: "jar", cls: "ct drop", rbox: [37.5, 40, 25, 58], z: 3 });
    S.go(jar, 2, 1.3, { s: [.7, 1], y: [16, 0], o: [0, 1] }, "spring");
    S.osc(jar, "y", 1, 5.6, 3.6);
  };

  /* 에어본: 꿀 방울이 떨어진 자리에서 너도밤나무 숲이 열립니다 */
  SCENES.airborne = function (S) {
    var hit = S.m ? [.58, .3] : [.68, .52];
    S.ref.hit = hit;
    var bg = S.L({ slides: ["bark", "drip", "forest", "comb", "alps", "dipper"], box: [0, 0, 100, 100], pos: "60% 50%" });
    S.slides(bg, { every: 5.8, fade: 1.8, kb: [1.14, 1.02] });
    S.go(bg, 1.05, 2, { cc: [[0, hit[0] * 100, hit[1] * 100], [150, hit[0] * 100, hit[1] * 100]] }, "out");
    S.shade(.9);
    var title = S.L({ img: "title", cls: "ct", box: [52, 7, 42, 15], mbox: [8, 5, 84, 12], css: "mix-blend-mode:screen;", pos: "50% 50%", z: 6 });
    S.go(title, 2.4, 1.5, { o: [0, 1], s: [1.08, 1], b: [8, 0] }, "out");
    S.go(title, 7.6, 1.4, { o: [1, 0] }, "io");
  };

  /* 보타니스트: 창가의 야자 그림자가 흔들리고, 제품이 선반 위로 하나씩 올라옵니다 */
  SCENES.botanist = function (S) {
    var sh = S.L({ img: "shadow", box: [-4, -4, 108, 108], css: "mix-blend-mode:multiply;", org: "50% 0", base: { s: 1.04 } });
    S.go(sh, 0, 2.6, { o: [0, .95] }, "out");
    S.osc(sh, "kx", 1.6, 7.5, 0); S.osc(sh, "x", .8, 9.5, 0, 1);
    var card = S.L({ slides: ["ficus", "drip", "store1", "wash", "palm2", "store3", "plant", "store2"], rbox: S.m ? [66, 6, 32, 88] : [67, 8, 30, 84], cls: "round" });
    S.slides(card, { every: 4.6, fade: 1.2, kb: [1.12, 1.0] });
    S.go(card, .5, 1.3, { ci: [[100, 0, 0, 0], [0, 0, 0, 0]] }, "io");
    var line = S.L({ rbox: S.m ? [2, 94, 62, .4] : [2, 92.5, 62, .35], css: "background:" + rgba(S.th.ink, .28) + ";" });
    S.go(line, 1, .9, { ci: [[0, 100, 0, 0], [0, 0, 0, 0]] }, "io");
    var P = [["shampoo", 1], ["treatment", 1], ["bodysoap", .98], ["mask", .72], ["oil", .7]], x = 3;
    P.forEach(function (p, i) {
      var hh = (S.m ? 84 : 76) * p[1], w = p[1] > .9 ? 12 : 10;
      var h = S.L({ img: p[0], cls: "ct drop", rbox: [x, (S.m ? 94 : 92.5) - hh, w, hh] });
      x += w + .4;
      S.go(h, 1.2 + i * .13, 1.1, { y: [26, 0], o: [0, 1] }, "spring");
    });
  };

  /* 클라라앤코: 콜라겐 스틱이 쏟아져 부채꼴로 서고, 홀로그램 빛이 스칩니다 */
  SCENES.claraco = function (S) {
    var circ = S.L({ slides: ["model", "boxes", "lemon", "boxsticks"], rbox: S.m ? [52, 4, 46, 92] : [58, 6, 40, 88], pos: "50% 35%" });
    S.slides(circ, { at: 1.5, every: 5, fade: 1.3, kb: [1.12, 1.0] });
    S.go(circ, 1.5, 1.3, { cc: [[0, 50, 50], [44, 50, 50]] }, "out");
    var R = [-16, -5, 7, 18], src = S.src("stick");
    R.forEach(function (r0, i) {
      var h = S.L({ img: "stick", cls: "ct drop", rbox: S.m ? [2 + i * 11, 8 + (i % 2) * 6, 10, 86 - (i % 2) * 6] : [6 + i * 11, 6 + (i % 2) * 6, 10, 88 - (i % 2) * 6], org: "50% 90%", z: 2,
        html: '<i class="holo" style="-webkit-mask-image:url(' + src + ');mask-image:url(' + src + ')"></i>' });
      var at = .15 + i * .12;
      S.go(h, at, 1.3, { y: [-150, 0], r: [r0 + 50, r0], o: [0, 1] }, "spring");
      S.osc(h, "y", 1.4, 4.4 + i * .5, at + 1.8, i);
      S.osc(h, "r", 1.4, 6 + i, at + 1.8, i * 2);
      var holo = new Track(h.el.querySelector(".holo"), S);
      holo.base = { bx: 130 };
      S.osc(holo, "bx", -170, 3.4, at + 1.2 + i * .25, 0, "saw");
      S.tracks.push(holo);
    });
  };

  /* 메리비: 날것 그대로의 벌집이 떨어지고, 나무 숟가락이 꿀을 뜨듯 흔들립니다 */
  SCENES.marybee = function (S) {
    var comb = S.L({ img: "comb", cls: "ct drop", rbox: S.m ? [30, 4, 30, 94] : [20, 6, 26, 90] });
    S.go(comb, .5, 1.4, { y: [-120, 0], r: [-8, 0], o: [0, 1] }, "spring");
    var sp = S.L({ img: "spoon", cls: "ct drop", rbox: S.m ? [56, -6, 22, 64] : [44, -8, 16, 62], org: "70% 4%", pos: "50% 0" });
    S.go(sp, 1.3, 1.7, { r: [-70, 14], o: [0, 1] }, "spring");
    S.osc(sp, "r", 3, 4.2, 3.1);
    var mgo = S.L({ img: "mgo", cls: "card", rbox: S.m ? [2, 52, 26, 44] : [2, 56, 17, 38] });
    var items = [mgo,
      S.L({ img: "sleeve", cls: "ct drop", rbox: S.m ? [62, 40, 18, 56] : [62, 40, 15, 56] }),
      S.L({ img: "acv", cls: "ct drop", rbox: S.m ? [80, 22, 12, 74] : [77.5, 18, 10, 78] }),
      S.L({ img: "candy", cls: "ct drop", rbox: S.m ? [86, 66, 14, 30] : [87, 62, 13, 34] })];
    items.forEach(function (h, i) { S.go(h, 2.2 + i * .15, 1.1, { y: [30, 0], o: [0, 1] }, "spring"); });
  };

  /* 마이베프: 동그란 m. 마크가 튀어 오르고, 상자에서 퓨레 스틱이 솟아납니다 */
  SCENES.myvef = function (S) {
    var mark = S.L({ img: "mark", cls: "ct", rbox: S.m ? [50, 4, 48, 92] : [50, 6, 44, 88], pos: "50% 50%" });
    S.go(mark, .25, 1.2, { s: [0, 1], r: [-25, 0] }, "spring");
    S.osc(mark, "s", .025, 3, 1.6);
    [-14, -2, 11].forEach(function (r0, i) {
      var h = S.L({ img: "stick", cls: "ct drop", rbox: S.m ? [8 + i * 9, 2, 10, 66] : [10 + i * 8, 2, 9, 66], org: "50% 100%" });
      S.go(h, 1.25 + i * .12, 1.2, { y: [70, 0], r: [0, r0], o: [0, 1] }, "spring");
      S.osc(h, "r", 2, 3.4 + i * .5, 2.8, i);
    });
    var box = S.L({ img: "box", cls: "ct drop", rbox: S.m ? [4, 40, 36, 58] : [4, 38, 32, 60] });
    S.go(box, .95, 1.1, { s: [0, 1], r: [-12, 0], o: [0, 1] }, "spring");
  };

  /* 제품 사진만 있는 브랜드: 코드 모션 위에 제품이 올라옵니다 */
  SCENES.denoah = function (S) { lineup(S, productImgs("denoah"), { x0: 6, x1: 98, h: 82, step: .12 }); };
  SCENES.drdaniel = function (S) { lineup(S, productImgs("drdaniel"), { x0: 4, x1: 98, h: 70, fan: 1 }); };
  SCENES.sahale = function (S) { lineup(S, productImgs("sahale"), { x0: S.m ? 2 : 12, x1: 97, h: 76, fan: 1, at: 1.4 }); };
  SCENES.zeroguide = function (S) {
    S.th.region = { d: [58, 4, 40, 96], m: [44, 0, 56, 60] };
    lineup(S, productImgs("zeroguide"), { x0: 3, x1: 92, h: 80, at: 2.4, step: .2 });
  };
  SCENES.kimguksan = function (S) {
    var src = productImgs("kimguksan")[0]; if (!src) return;
    var h = S.L({ img: src, cls: "ct drop", rbox: S.m ? [28, 6, 46, 90] : [37, 6, 42, 90], org: "50% 100%" });
    S.go(h, 1.1, 1.3, { y: [30, 0], o: [0, 1], s: [.9, 1] }, "spring");
    S.osc(h, "r", 2.4, 4.8, 2.4);
  };
  /* 프레시맥: 마카다미아 사진이 견과가 떨어지는 배경 위로 떠오릅니다 */
  SCENES.freshmac = function (S) {
    var p = (window.IBR_PRODUCTS || []).filter(function (x) { return x.b === "freshmac" && x.img; })[0]; if (!p) return;
    var h = S.L({ img: p.img, cls: "card", rbox: S.m ? [8, 8, 84, 84] : [30, 12, 56, 76] });
    S.go(h, 1, 1.3, { y: [20, 0], o: [0, 1], s: [.94, 1] }, "spring");
    S.go(h.i, 1, 9, { s: [1.12, 1] }, "out");
  };
  /* 청담뉴트리션: 14가지 제품이 물결 위로 천천히 흘러갑니다 */
  SCENES.chungdam = function (S) {
    var imgs = productImgs("chungdam"), n = imgs.length; if (!n) return;
    var slot = S.m ? 30 : 15, W = slot * n * 2;
    var clip = S.L({ rbox: [0, 0, 100, 100], cls: "clip" });
    var track = S.L({ box: [0, 12, W, 82] });
    clip.el.appendChild(track.el);
    S.go(track, .4, 1.2, { o: [0, 1] }, "out");
    S.osc(track, "x", -50, n * 2.6, 0, 0, "saw");
    imgs.concat(imgs).forEach(function (src, i) {
      var it = document.createElement("div");
      it.className = "bf-l ct drop";
      it.style.cssText = "left:" + (i * 50 / n) + "%;width:" + (50 / n * .86) + "%;top:0;height:100%;";
      var im = document.createElement("img"); im.src = src; im.alt = ""; im.decoding = "async"; it.appendChild(im); S.imgs.push(im);
      track.el.appendChild(it);
      var h = new Track(it, S); S.tracks.push(h);
      S.go(h, .5 + (i % n) * .08, 1, { y: [22, 0], o: [0, 1] }, "spring");
    });
  };

  /* ── 재생기 ─────────────────────────────── */
  var ORIGIN = { KR: "KOREA", US: "USA", AU: "AUSTRALIA", GR: "GREECE", JP: "JAPAN", FR: "FRANCE", UK: "UNITED KINGDOM", NZ: "NEW ZEALAND", IT: "ITALY", CZ: "CZECH", AT: "AUSTRIA" };
  var GROUP = { own: "자사 브랜드", global: "글로벌 소싱", dist: "유통 브랜드" };
  var OUT = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 9l6-6M4 3h5v5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
  var cur = null;

  function button(href, label, cls, icon) {
    if (!href) return '<span class="bf-btn ' + cls + '" aria-disabled="true">' + icon + label + "<em>준비 중</em></span>";
    return '<a class="bf-btn ' + cls + '" href="' + href + '" target="_blank" rel="noopener">' + icon + label + OUT + "</a>";
  }

  function show(host, b) {
    if (cur && cur.id === b.id && !host.hidden) return;
    hide(host);
    var th = Object.assign({}, FILMS[b.id] || { motif: "capsule", bg: b.tint || "#E8ECE8", ink: b.ink || "#222", acc: [b.ink || "#222", "#FFFFFF", "#CCCCCC"], words: [] });
    var scene = SCENES[b.id];
    var L = (window.IBR_LINKS || {})[b.id] || {};
    var overseas = b.origin && b.origin !== "KR";
    var wm = th.logo
      ? '<h2 class="bf-wm bf-logo" style="--lh:' + (th.logoH || 56) + 'px"><img src="' + IMG + b.id + "/" + th.logo + '.webp" alt="' + b.en + '"></h2>'
      : '<h2 class="bf-wm wm ' + (b.mark || "") + '">' + b.en + "</h2>";
    host.hidden = false;
    host.innerHTML =
      '<div class="bfilm' + (th.tone === "dark" ? " dark" : "") + (scene ? " scene" : "") + '" data-brand="' + b.id + '" style="--fb:' + th.bg + ";--fi:" + th.ink + '">' +
      '<canvas class="bf-bg" aria-hidden="true"></canvas><div class="bf-stage" aria-hidden="true"></div><canvas class="bf-fx" aria-hidden="true"></canvas>' +
      '<div class="bf-copy"><p class="bf-eyebrow">' + (ORIGIN[b.origin] ? ORIGIN[b.origin] + " · " : "") + (GROUP[b.group] || "") + "</p>" +
      wm + (b.ko !== b.en ? '<p class="bf-ko">' + b.ko + "</p>" : "") +
      '<p class="bf-words">' + th.words.map(function (x) { return "<span>" + x + "</span>"; }).join("") + "</p></div>" +
      '<button class="bf-replay" type="button">↻ 다시 보기</button></div>' +
      '<div class="bf-bar"><p>' + b.line + '</p><div class="bf-actions">' +
      button(L.smartstore, "네이버 스마트스토어", "naver", '<i class="n" aria-hidden="true">N</i>') +
      button(L.mall, "자사몰", "mall", "") +
      (overseas ? button(L.global, "해외 공식몰", "global", "") : "") +
      button(L.catalog, "브랜드 카탈로그 다운로드", "catalog", '<svg class="dl" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1v7M3 5l3 3 3-3M1.5 10.5h9" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>') +
      "</div></div>";

    var film = host.querySelector(".bfilm"), stage = film.querySelector(".bf-stage");
    var cvB = film.querySelector(".bf-bg"), cvF = film.querySelector(".bf-fx"), cB = cvB.getContext("2d"), cF = cvF.getContext("2d");
    var motif = th.motif && M[th.motif], under = th.under && FX[th.under], fx = th.fx && FX[th.fx];
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var state = { id: b.id, raf: 0, t0: 0, vis: true, W: 0, H: 0, anims: [], S: null, mobile: null, ready: false };
    cur = state;
    cvB.style.display = motif || under ? "" : "none";
    cvF.style.display = fx ? "" : "none";

    function size() {
      var r = film.getBoundingClientRect();
      state.W = r.width; state.H = r.height;
      [cvB, cvF].forEach(function (cv) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); });
    }
    function frame(t) {
      if (!state.started && !IBR.reduce) t = 0;
      AREA = th.area || null;
      var W = state.W, H = state.H;
      try {
        if (motif || under) {
          cB.setTransform(dpr, 0, 0, dpr, 0, 0); cB.fillStyle = th.bg; cB.fillRect(0, 0, W, H);
          if (motif) motif(cB, W, H, t, th);
          if (under) under(cB, W, H, t, th, state.S);
        }
        if (state.S) state.S.render(t);
        if (fx) { cF.setTransform(dpr, 0, 0, dpr, 0, 0); cF.clearRect(0, 0, W, H); fx(cF, W, H, t, th, state.S); }
      } catch (e) { if (!state.err) { state.err = 1; if (window.console) console.error(e); } }
    }
    function now() { return (performance.now() - state.t0) / 1000; }
    function loop() {
      if (cur !== state || state.seek != null) { state.raf = 0; return; }
      frame(now());
      state.raf = state.vis ? requestAnimationFrame(loop) : 0;
    }
    function text() {
      state.anims.forEach(function (a) { a.cancel(); });
      state.anims = [];
      if (IBR.reduce || !film.animate) return;
      function A(el, kf, o) { if (el) state.anims.push(el.animate(kf, Object.assign({ fill: "backwards", easing: "cubic-bezier(.22,.8,.24,1)" }, o))); }
      A(film.querySelector(".bf-eyebrow"), [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 600, delay: 300 });
      A(film.querySelector(".bf-wm"), [{ clipPath: "inset(0 100% 0 0)", transform: "translateY(10px)" }, { clipPath: "inset(0 0 0 0)", transform: "none" }], { duration: 1100, delay: 600, easing: "cubic-bezier(.65,0,.35,1)" });
      A(film.querySelector(".bf-ko"), [{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 1300 });
      [].forEach.call(film.querySelectorAll(".bf-words span"), function (s, i) {
        A(s, [{ opacity: 0, transform: "translateY(14px)", filter: "blur(4px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }], { duration: 700, delay: BEATS[i] * 1000 - 100 });
      });
      A(film.querySelector(".bf-replay"), [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 4800 });
    }
    /* 장면을 새로 짭니다(처음, 다시 보기, 넓은/좁은 화면 전환 때) */
    function build() {
      stage.innerHTML = "";
      state.mobile = state.W < 640;
      state.S = scene ? makeScene(film, stage, b, th, state.mobile) : null;
      if (state.S) scene(state.S);
      frame(IBR.reduce ? 6.5 : 0);
    }
    function start() {
      state.t0 = performance.now(); state.pausedAt = 0; state.started = true;
      text();
      state.seek = null;
      if (IBR.reduce) { frame(6.5); return; }
      if (!state.vis) state.anims.forEach(function (a) { a.pause(); });
      if (!state.raf && state.vis) state.raf = requestAnimationFrame(loop);
    }
    /* 사진이 다 준비된 뒤에 시작합니다(최대 2.5초 기다림) */
    function whenReady(cb) {
      var imgs = state.S ? state.S.imgs : [], done = false;
      function go() { if (!done && cur === state) { done = true; film.classList.add("on"); cb(); } }
      if (!imgs.length) return go();
      Promise.all(imgs.map(function (im) { return im.decode ? im.decode().catch(function () {}) : Promise.resolve(); })).then(go);
      setTimeout(go, 2500);
    }

    size();
    th.region = null;
    build();
    whenReady(start);
    state.ro = window.ResizeObserver ? new ResizeObserver(function () {
      var was = state.mobile;
      size();
      if ((state.W < 640) !== was && scene) { th.region = null; build(); start(); return; }
      if (IBR.reduce || !state.raf) frame(IBR.reduce ? 6.5 : state.pausedAt || now());
    }) : null;
    if (state.ro) state.ro.observe(film);
    if ("IntersectionObserver" in window) {
      state.io = new IntersectionObserver(function (es) {
        var v = es[0].isIntersecting;
        if (!state.started || state.seek != null) { state.vis = v; if (v && state.started && !state.raf && state.seek == null) state.raf = requestAnimationFrame(loop); return; }
        if (v && !state.vis && !IBR.reduce) {
          state.vis = true; state.t0 = performance.now() - (state.pausedAt || 0) * 1000; state.pausedAt = 0;
          state.anims.forEach(function (a) { a.play(); });
          if (!state.raf) state.raf = requestAnimationFrame(loop);
        } else if (!v && state.vis) {
          state.vis = false; state.pausedAt = now();
          state.anims.forEach(function (a) { if (a.playState === "running") a.pause(); });
        }
      });
      state.io.observe(film);
    }
    /* 확인용: 특정 시점(초)의 장면으로 멈춰 보기. IBR.brandFilm.seek(3) */
    state.seekTo = function (t) {
      state.seek = t; cancelAnimationFrame(state.raf); state.raf = 0;
      state.anims.forEach(function (a) { a.pause(); a.currentTime = Math.min(t * 1000, (a.effect.getComputedTiming().endTime || 0)); });
      frame(t);
    };
    film.querySelector(".bf-replay").addEventListener("click", function () {
      th.region = null; build(); start();
    });
  }

  function hide(host) {
    if (cur) {
      cancelAnimationFrame(cur.raf);
      if (cur.ro) cur.ro.disconnect();
      if (cur.io) cur.io.disconnect();
      cur = null;
    }
    if (host) { host.hidden = true; host.innerHTML = ""; }
  }

  IBR.brandFilm = {
    show: show, hide: hide,
    seek: function (t) { if (cur && cur.seekTo) cur.seekTo(t); },
    ready: function () { return !!(cur && cur.started); }
  };
})();
