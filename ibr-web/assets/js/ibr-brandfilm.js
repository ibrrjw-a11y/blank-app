/*
  브랜드 필름 — 제품 페이지에서 브랜드를 고르면 필터 바 아래에 나오는 짧은 모션 그래픽.
  영상 파일이 아니라 코드로 그립니다(가볍고 선명합니다). 약 5초 동안 브랜드 이름과 키워드가
  나타나고, 그 뒤에는 배경 모션이 조용히 이어집니다. '다시 보기'로 처음부터 볼 수 있습니다.

  브랜드마다 FILMS 에서 색(bg·ink·acc), 모션 종류(motif), 키워드(words)를 바꿀 수 있습니다.
  motif: rings 나이테 · honey 벌집 · botanical 식물 · citrus 레몬 · pet 펫 스틱 · capsule 캡슐
         water 물결 · zero 카운트다운 · droplet 방울 · toys 장난감 블록 · sculpt 조형 의자
         glass 유리잔 · nuts 견과 · heat 열기 · pulse 측정
*/
(function () {
  "use strict";
  var IBR = window.IBR || (window.IBR = {});

  var FILMS = {
    arvo:      { motif: "rings", bg: "#ECE7DD", ink: "#1B1A19", acc: ["#DDA96D", "#DF93BF", "#8AA0B6"], words: ["Wood", "Rhythm", "No.07 · 10 · 11"] },
    choolip:   { motif: "pet", bg: "#F6DDE3", ink: "#7A1E3A", acc: ["#E6476B", "#F49AB0", "#FFF4E6", "#B8264E"], words: ["Vet-made", "Human grade", "Amazon's Choice"] },
    myvef:     { motif: "pet", bg: "#DCE6F2", ink: "#1E3F6E", acc: ["#3D7DD8", "#9CC3F0", "#FFFFFF", "#1E3F6E"], words: ["수의사가 만든", "영양 간식", "HK · TW · SG · JP"] },
    denoah:    { motif: "droplet", bg: "#EEE6E0", ink: "#4D3B33", acc: ["#D2B5A2", "#B99A86", "#F7EFE9"], words: ["Recover", "Calm", "Rest"] },
    drdaniel:  { motif: "capsule", bg: "#E4E9ED", ink: "#1F2D3A", acc: ["#C9A15A", "#1F2D3A", "#FFFFFF"], words: ["Global ingredients", "Own formula", "Daily health"] },
    chungdam:  { motif: "water", bg: "#E3ECE7", ink: "#20402F", acc: ["#6FAE93", "#A9CDBB"], words: ["淸潭", "Pure water", "Ph.D formula"] },
    zeroguide: { motif: "zero", bg: "#EBEBEB", ink: "#111111", acc: ["#111111", "#FF4B2B"], words: ["Complex", "→ Zero", "Category No.1"] },
    marybee:   { motif: "honey", opt: { flowers: 1 }, bg: "#F3E4C2", ink: "#5B3A0A", acc: ["#C9831A", "#F2C35B"], words: ["Manuka", "Honeycomb", "World first"] },
    kimguksan: { motif: "heat", bg: "#F2E4E0", ink: "#3B2525", acc: ["#E0533A", "#F2A65A", "#FFD7A8"], words: ["100% Korea", "HOT 70", "Warm days"] },
    attiki:    { motif: "honey", opt: { meander: 1 }, bg: "#E3EAF3", ink: "#183766", acc: ["#D9961C", "#F4C85A"], words: ["Greece No.1", "Thyme · Pine", "22 sold-out shows"] },
    botanist:  { motif: "botanical", bg: "#ECF0E5", ink: "#2E3B22", acc: ["#E7A9C8", "#F2B07A", "#E68AA6", "#A6C66B", "#C9D96A", "#A895D1"], words: ["Botanical", "Hair & Body", "Japan"] },
    lamaison:  { motif: "honey", opt: { lavender: 1 }, bg: "#ECE6F2", ink: "#3F2F5E", acc: ["#E0B04A", "#F5D98B", "#8E73C2"], words: ["Paris 1898", "Lavender", "Single flower honey"] },
    bronnley:  { motif: "citrus", bg: "#F6EEC4", ink: "#4D4410", acc: ["#F2D33A", "#FBF0A6", "#FFFFFF"], words: ["England", "Lemon", "Soap & Balm"] },
    airborne:  { motif: "honey", opt: { trees: 1 }, bg: "#E7E0D0", ink: "#3A2F1A", acc: ["#7A3E10", "#B8742A"], words: ["New Zealand", "Beech forest", "Honeydew"] },
    harker:    { motif: "botanical", opt: { manuka: 1 }, bg: "#E1EBE3", ink: "#1E4430", acc: ["#FFFFFF", "#F6F1E2"], words: ["New Zealand", "Herbal", "Manuka lozenge"] },
    magis:     { motif: "toys", bg: "#EAEAE4", ink: "#1A1A1A", acc: ["#E5352B", "#F2C12E", "#2B5CE6", "#2BA36B", "#FFFFFF"], words: ["Italian design", "Puppy", "360° Container"] },
    driade:    { motif: "sculpt", bg: "#EFE8DE", ink: "#3D2C1C", acc: ["#3A3836", "#E2B9A3", "#D19A2B"], words: ["Italian design", "Roly Poly", "Charcoal · Flesh · Ochre"] },
    kvetna:    { motif: "glass", bg: "#E3EAEF", ink: "#20323E", acc: ["#C8323C", "#2D5DB8", "#E8B81C", "#E8742A"], words: ["Czech glass", "Handmade", "Auriga"] },
    sahale:    { motif: "nuts", opt: { kind: "mix" }, bg: "#F1E3D3", ink: "#5A2E10", acc: ["#C98A4B", "#9DB860", "#8A4A22", "#C0392B", "#E8C890"], words: ["Seattle", "Glazed nuts", "Fruit & spice"] },
    freshmac:  { motif: "nuts", opt: { kind: "mac" }, bg: "#ECE2CF", ink: "#4A3618", acc: ["#7B4A22", "#A8703C", "#F3E6C8"], words: ["Australia", "Macadamia", "In-shell"] },
    yuhan:     { motif: "capsule", bg: "#E1E8F0", ink: "#173452", acc: ["#2C6FB7", "#79B4E8", "#FFFFFF"], words: ["당큐락", "400억 원+", "IBR 독점 대행"] },
    claraco:   { motif: "capsule", opt: { glow: 1 }, bg: "#F4E1E5", ink: "#5A2330", acc: ["#E79AAE", "#F7CBD6", "#FFFFFF"], words: ["Collagen", "Glow", "20g × 15"] },
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
  function area(w, h) { return w < 640 ? { x: 0, y: 0, w: w, h: h * .6 } : { x: w * .36, y: 0, w: w * .64, h: h }; }
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
    var A = area(w, h), cx = A.x + A.w * .55, cy = A.y + A.h * .55, R = Math.min(A.w, A.h) * .55, pulse = 1 + .04 * Math.sin(t * 2.2);
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
    var th = FILMS[b.id] || { motif: "capsule", bg: b.tint || "#E8ECE8", ink: b.ink || "#222", acc: [b.ink || "#222", "#FFFFFF", "#CCCCCC"], words: [] };
    var L = (window.IBR_LINKS || {})[b.id] || {};
    var overseas = b.origin && b.origin !== "KR";
    host.hidden = false;
    host.innerHTML =
      '<div class="bfilm" style="--fb:' + th.bg + ";--fi:" + th.ink + '">' +
      '<canvas aria-hidden="true"></canvas>' +
      '<div class="bf-copy"><p class="bf-eyebrow">' + (ORIGIN[b.origin] ? ORIGIN[b.origin] + " · " : "") + (GROUP[b.group] || "") + "</p>" +
      '<h2 class="bf-wm wm ' + (b.mark || "") + '">' + b.en + "</h2>" + (b.ko !== b.en ? '<p class="bf-ko">' + b.ko + "</p>" : "") +
      '<p class="bf-words">' + th.words.map(function (x) { return "<span>" + x + "</span>"; }).join("") + "</p></div>" +
      '<button class="bf-replay" type="button">↻ 다시 보기</button></div>' +
      '<div class="bf-bar"><p>' + b.line + '</p><div class="bf-actions">' +
      button(L.smartstore, "네이버 스마트스토어", "naver", '<i class="n" aria-hidden="true">N</i>') +
      button(L.mall, "자사몰", "mall", "") +
      (overseas ? button(L.global, "해외 공식몰", "global", "") : "") +
      button(L.catalog, "브랜드 카탈로그 다운로드", "catalog", '<svg class="dl" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1v7M3 5l3 3 3-3M1.5 10.5h9" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>') +
      "</div></div>";

    var film = host.querySelector(".bfilm"), cv = film.querySelector("canvas"), ctx = cv.getContext("2d");
    var draw = M[th.motif] || M.capsule, dpr = Math.min(2, window.devicePixelRatio || 1);
    var state = { id: b.id, raf: 0, t0: performance.now(), vis: true, W: 0, H: 0, anims: [] };
    cur = state;
    function size() {
      var r = film.getBoundingClientRect();
      state.W = r.width; state.H = r.height;
      cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    }
    function frame(t) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = th.bg; ctx.fillRect(0, 0, state.W, state.H);
      try { draw(ctx, state.W, state.H, t, th); } catch (e) { if (!state.err) { state.err = 1; if (window.console) console.error(e); } }
    }
    function loop(now) {
      if (cur !== state) return;
      frame((now - state.t0) / 1000);
      state.raf = state.vis ? requestAnimationFrame(loop) : 0;
    }
    function text() {
      state.anims.forEach(function (a) { a.cancel(); });
      state.anims = [];
      if (IBR.reduce || !film.animate) return;
      function A(el, kf, o) { if (el) state.anims.push(el.animate(kf, Object.assign({ fill: "backwards", easing: "cubic-bezier(.22,.8,.24,1)" }, o))); }
      A(film.querySelector(".bf-eyebrow"), [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 600, delay: 200 });
      A(film.querySelector(".bf-wm"), [{ clipPath: "inset(0 100% 0 0)", transform: "translateY(10px)" }, { clipPath: "inset(0 0 0 0)", transform: "none" }], { duration: 1100, delay: 500, easing: "cubic-bezier(.65,0,.35,1)" });
      A(film.querySelector(".bf-ko"), [{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 1200 });
      [].forEach.call(film.querySelectorAll(".bf-words span"), function (s, i) {
        A(s, [{ opacity: 0, transform: "translateY(14px)", filter: "blur(4px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }], { duration: 700, delay: BEATS[i] * 1000 - 150 });
      });
      A(film.querySelector(".bf-replay"), [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 4800 });
    }
    size();
    state.ro = window.ResizeObserver ? new ResizeObserver(function () { size(); if (IBR.reduce || !state.raf) frame(IBR.reduce ? 6.5 : (performance.now() - state.t0) / 1000); }) : null;
    if (state.ro) state.ro.observe(film);
    if ("IntersectionObserver" in window) {
      state.io = new IntersectionObserver(function (es) {
        var v = es[0].isIntersecting;
        if (v && !state.vis && !IBR.reduce) { state.vis = true; state.t0 = performance.now() - (state.pausedAt || 0) * 1000; state.raf = requestAnimationFrame(loop); }
        else if (!v && state.vis) { state.vis = false; state.pausedAt = (performance.now() - state.t0) / 1000; }
      });
      state.io.observe(film);
    }
    film.querySelector(".bf-replay").addEventListener("click", function () {
      state.t0 = performance.now(); text();
      if (!state.raf && !IBR.reduce) state.raf = requestAnimationFrame(loop);
    });
    text();
    if (IBR.reduce) frame(6.5); else state.raf = requestAnimationFrame(loop);
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

  IBR.brandFilm = { show: show, hide: hide };
})();
