/* ==========================================================================
   Árvo — 메인 모션 (스크롤 반응)
   시안과 카페24 스킨이 같은 파일을 씁니다. 외부 라이브러리 없이 동작합니다.

   - 오프닝      .intro            세션당 한 번, Á 위로 오일 방울이 떨어짐
   - 머리말      .site-header      히어로 위에서는 투명(is-over)
   - 히어로      .hero             스크롤하면 사진은 느리게, 글은 빠르게 (--hp)
   - 등장        [data-reveal]     화면에 들어오면 is-in
   - 선언        [data-words]      고정된 화면에서 단어가 차례로 밝아짐
   - 향의 무대   [data-sx]         07 → 10 → 11 로 색·병·숫자·글이 바뀜
   - 흐르는 띠   [data-marquee]    스크롤 속도만큼 빨라지고 방향도 따라감
   - 시차        [data-parallax] [data-parallax-y]
   - 마무리      .orb              마우스를 살짝 따라옴

   '동작 줄이기' 설정이면 아무 효과 없이 모든 내용이 그대로 보입니다.
   ========================================================================== */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var smooth = function (a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };

  var ready = function (fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); };

  /* ---------- 오프닝 ----------
     메인 본문 맨 앞의 짧은 스크립트가 html 에 has-intro 를 붙였을 때만 재생합니다 (세션당 한 번).
     0.0s 오일 한 방울이 떨어져 퍼짐 → 0.5s 물결이 07 의 색으로 번짐 → 1.35s 10 → 1.95s 11
     → 2.55s 세 색이 로고의 방울 자리로 모임 → 2.9s Árvo 조립, 방울이 Á 위에 떨어짐
     → 3.5s 문구 → 4.3s 로고가 머리말 자리로 날아가며 첫 화면이 열림 */
  var supportsLinear = !!(window.CSS && CSS.supports && CSS.supports('animation-timing-function', 'linear(0, 1)'));
  /* 감쇠 스프링을 linear() 곡선으로 (z: 감쇠, w: 진동) */
  var spring = function (z, w) {
    if (!supportsLinear) return 'cubic-bezier(.34, 1.56, .64, 1)';
    var wd = w * Math.sqrt(1 - z * z), pts = [];
    for (var i = 0; i <= 60; i++) {
      var t = i / 60;
      pts.push((1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t))).toFixed(4));
    }
    pts[60] = '1';
    return 'linear(' + pts.join(', ') + ')';
  };
  var EASE = {
    springHard: spring(0.38, 15), springSoft: spring(0.5, 12), springBottle: spring(0.42, 13),
    inOut: 'cubic-bezier(.86, 0, .07, 1)', out: 'cubic-bezier(.16, 1, .3, 1)', in: 'cubic-bezier(.7, 0, .84, 0)',
    gravity: 'cubic-bezier(.55, 0, 1, .45)'
  };

  function playIntro() {
    var intro = $('.intro');
    if (!intro || !root.classList.contains('has-intro')) return;
    try { sessionStorage.setItem('arvo-intro', '1'); } catch (e) {}
    var done = false, exiting = false, timers = [], anims = [];
    var finish = function () {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      root.classList.remove('has-intro');
      if (intro.parentNode) intro.parentNode.removeChild(intro);
      document.dispatchEvent(new CustomEvent('arvo:introdone'));
    };
    if (reduce || !intro.animate) { finish(); return; }

    var q = function (sel) { return $(sel, intro); };
    var qa = function (sel) { return $$(sel, intro); };
    var A = function (el, kf, dur, delay, easing) {
      if (!el) return null;
      var a = el.animate(kf, { duration: dur, delay: delay || 0, easing: easing || 'linear', fill: 'both' });
      anims.push(a);
      return a;
    };
    var later = function (ms, fn) { timers.push(setTimeout(fn, ms)); };

    var vw = window.innerWidth, vh = window.innerHeight;
    var floods = qa('.i-flood'), bottles = qa('.i-bottles img'), names = qa('.i-name'), krs = qa('.i-kr span');
    var num = q('.i-num'), cols = qa('.i-num .col'), count = q('.i-count .col');
    var logo = q('.i-logo'), letters = qa('.i-logo .l'), drop = q('.i-logo .drop');
    var words = qa('.i-tag > span > span');

    /* 로고 방울이 놓일 자리 (모든 색이 이 점으로 빨려 들어감) */
    var lr = logo.getBoundingClientRect();
    var tx = lr.left + lr.width * 0.121, ty = lr.top + lr.height * 0.126;
    var txp = (tx / vw * 100).toFixed(2) + '%', typ = (ty / vh * 100).toFixed(2) + '%';

    /* 1. 한 방울 (0 – 0.62s) */
    var fall = q('.i-fall');
    A(fall, [
      { transform: 'translate3d(0,' + (-vh * 0.62) + 'px,0) scale(.7, 1.45)', opacity: 1 },
      { transform: 'translate3d(0,0,0) scale(.82, 1.3)', opacity: 1, offset: 0.86 },
      { transform: 'translate3d(0,0,0) scale(1.9, .32)', opacity: 1 }
    ], 520, 60, EASE.gravity);
    anims.push(fall.animate([{ transform: 'translate3d(0,0,0) scale(1.9, .32)', opacity: 1 }, { transform: 'translate3d(0,0,0) scale(0, 0)', opacity: 0 }], { duration: 160, delay: 580, easing: EASE.in, fill: 'forwards' }));
    /* 튀는 물방울: 바닥에 닿는 순간 사방으로 포물선을 그리며 흩어짐 */
    var spl = [[-1, 0.9, 10], [-0.55, 1.25, 7], [-0.2, 1.5, 5], [0.25, 1.4, 8], [0.6, 1.15, 6], [1, 0.85, 9], [0.08, 1.7, 4]];
    qa('.i-splash i').forEach(function (d, i) {
      var v = spl[i % spl.length], dx = v[0] * Math.min(vw, 900) * 0.16, up = v[1] * Math.min(vh, 800) * 0.12;
      d.style.setProperty('--sz', v[2] + 'px');
      anims.push(d.animate([
        { transform: 'translate3d(0,0,0) scale(1)', opacity: 1 },
        { transform: 'translate3d(' + (dx * 0.6) + 'px,' + (-up) + 'px,0) scale(1)', opacity: 1, offset: 0.45 },
        { transform: 'translate3d(' + dx + 'px,' + (up * 0.35) + 'px,0) scale(.3)', opacity: 0 }
      ], { duration: 620, delay: 575, easing: 'cubic-bezier(.2, .6, .4, 1)', fill: 'forwards' }));
    });
    qa('.i-rings i').forEach(function (r, i) {
      A(r, [{ transform: 'scale(0)', opacity: 0.9 }, { transform: 'scale(1)', opacity: 0 }], 1100, 560 + i * 110, EASE.out);
    });

    /* 2. 07 → 10 → 11 : 물결 → 오른쪽에서 쓸기 → 아래에서 쓸기 */
    var T = [600, 1350, 1950];
    var wipes = [
      [{ clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)' }],
      [{ clipPath: 'polygon(118% 0, 118% 0, 100% 100%, 100% 100%)' }, { clipPath: 'polygon(-18% 0, 118% 0, 100% 100%, -36% 100%)' }],
      [{ clipPath: 'polygon(0 118%, 100% 100%, 100% 100%, 0 118%)' }, { clipPath: 'polygon(0 -18%, 100% -36%, 100% 100%, 0 118%)' }]
    ];
    floods.forEach(function (f, i) {
      A(f, wipes[i], i ? 620 : 760, T[i], EASE.inOut);
      $$('.i-lines path', f).forEach(function (p, k) {
        p.setAttribute('pathLength', '1');
        A(p, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], 1100, T[i] + 120 + k * 60, EASE.out);
      });
    });
    /* 숫자: 튀어 들어온 뒤 07 → 10 → 11 로 굴러감 */
    A(num, [{ transform: 'translateY(22%) scale(1.35)', opacity: 0 }, { opacity: 1, offset: 0.25 }, { transform: 'translateY(-4%) scale(1)', opacity: 1 }], 900, T[0] + 300, EASE.springHard);
    cols.forEach(function (c, ci) {
      A(c, [{ transform: 'translateY(0)' }, { transform: 'translateY(-1em)' }], 640, T[1] + ci * 50, EASE.springHard);
    });
    cols.forEach(function (c, ci) {
      anims.push(c.animate([{ transform: 'translateY(-1em)' }, { transform: 'translateY(-2em)' }], { duration: 640, delay: T[2] + ci * 50, easing: EASE.springHard, fill: 'forwards' }));
    });
    A(num, [{ color: '#ffffff' }, { color: '#1B1A19' }], 420, T[2] + 120, EASE.out);
    if (count) {
      A(count, [{ transform: 'translateY(0)' }, { transform: 'translateY(-1.2em)' }], 520, T[1], EASE.springSoft);
      anims.push(count.animate([{ transform: 'translateY(-1.2em)' }, { transform: 'translateY(-2.4em)' }], { duration: 520, delay: T[2], easing: EASE.springSoft, fill: 'forwards' }));
    }
    /* 병: 아래·옆에서 튕기며 들어오고, 다음 병에게 자리를 내줌 */
    var enter = [
      [{ transform: 'translate3d(0, 38%, 0) rotate(-14deg) scale(.82)', opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: 'none', opacity: 1 }],
      [{ transform: 'translate3d(80vw, 4%, 0) rotate(18deg)', opacity: 1 }, { transform: 'none', opacity: 1 }],
      [{ transform: 'translate3d(0, 115vh, 0) rotate(-10deg)', opacity: 1 }, { transform: 'none', opacity: 1 }]
    ];
    var leave = [
      [{ transform: 'none', opacity: 1 }, { transform: 'translate3d(-85vw, -6%, 0) rotate(-22deg)', opacity: 1 }],
      [{ transform: 'none', opacity: 1 }, { transform: 'translate3d(0, -130vh, 0) rotate(12deg)', opacity: 1 }]
    ];
    bottles.forEach(function (b, i) {
      A(b, enter[i], 900, T[i] + (i ? 40 : 380), EASE.springBottle);
      if (leave[i]) anims.push(b.animate(leave[i], { duration: 460, delay: T[i + 1] - 90, easing: 'cubic-bezier(.5, 0, .75, .2)', fill: 'forwards' }));
    });
    /* 글자: 향 이름이 한 글자씩 올라오고, 다음 향이 오면 위로 빠짐 */
    A(q('.i-top'), [{ transform: 'translateY(-14px)', opacity: 0 }, { transform: 'none', opacity: 1 }], 600, T[0] + 200, EASE.out);
    names.forEach(function (n, i) {
      var cs = $$('.c', n);
      cs.forEach(function (c, k) {
        A(c, [{ transform: 'translateY(110%)' }, { transform: 'translateY(0)' }], 620, T[i] + 220 + k * 18, EASE.out);
        if (i < 2) anims.push(c.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-110%)' }], { duration: 300, delay: T[i + 1] - 60 + k * 8, easing: EASE.in, fill: 'forwards' }));
      });
      var nt = $('.notes', n);
      A(nt, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], 500, T[i] + 420, EASE.out);
      if (i < 2) anims.push(nt.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, delay: T[i + 1] - 80, fill: 'forwards' }));
    });
    krs.forEach(function (k, i) {
      A(k, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], 500, T[i] + 300, EASE.out);
      if (i < 2) anims.push(k.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, delay: T[i + 1] - 80, fill: 'forwards' }));
    });

    /* 3. 세 색이 로고 방울 자리로 빨려 들어감 (2.55s) */
    var C = 2550;
    A(q('.i-floods'), [{ clipPath: 'circle(150% at ' + txp + ' ' + typ + ')' }, { clipPath: 'circle(0% at ' + txp + ' ' + typ + ')' }], 520, C, 'cubic-bezier(.6, 0, .3, 1)');
    var stage = q('.i-stage');
    stage.style.transformOrigin = tx + 'px ' + ty + 'px';
    A(stage, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.04)', opacity: 0 }], 480, C, 'cubic-bezier(.6, 0, .3, 1)');
    A(q('.i-meta'), [{ opacity: 1 }, { opacity: 0 }], 220, C, 'linear');

    /* 4. Árvo 조립 + 방울 (2.9s) */
    var L = 2900;
    letters.forEach(function (l, i) {
      A(l, [{ transform: 'translateY(105%)' }, { transform: 'translateY(0)' }], 760, L + i * 70, EASE.springHard);
    });
    A(drop, [
      { transform: 'translate3d(0,' + (-vh * 0.55) + 'px,0) scale(.8, 1.5)', opacity: 1 },
      { transform: 'translate3d(0,0,0) scale(.9, 1.2)', opacity: 1 }
    ], 380, L + 260, EASE.gravity);
    anims.push(drop.animate([
      { transform: 'translate3d(0,0,0) scale(1.35, .62)', opacity: 1 },
      { transform: 'translate3d(0,-14%,0) scale(.9, 1.12)', opacity: 1, offset: 0.45 },
      { transform: 'translate3d(0,0,0) scale(1.06, .95)', opacity: 1, offset: 0.75 },
      { transform: 'none', opacity: 1 }
    ], { duration: 520, delay: L + 640, easing: 'ease-out', fill: 'forwards' }));
    A(q('.i-logo .ping'), [{ transform: 'scale(0)', opacity: 0.8 }, { transform: 'scale(1)', opacity: 0 }], 800, L + 640, EASE.out);
    /* 로고가 다 맞춰질 때 살짝 '쿵' */
    A(logo, [{ transform: 'translate(-50%, -62%) scale(1)' }, { transform: 'translate(-50%, -62%) scale(.975)', offset: 0.3 }, { transform: 'translate(-50%, -62%) scale(1)' }], 520, L + 640, 'ease-out');

    /* 5. 문구 (3.5s) */
    words.forEach(function (w, i) {
      A(w, [{ transform: 'translateY(110%)' }, { transform: 'translateY(0)' }], 700, L + 620 + i * 55, EASE.out);
    });

    /* 6. 로고가 머리말 자리로 날아가며 첫 화면이 열림 */
    var exit = function (fast) {
      if (exiting) return;
      exiting = true;
      var d = fast ? 560 : 860;
      var target = $('.site-header .brand-logo');
      var from = logo.getBoundingClientRect();
      A(q('.i-tag'), [{ opacity: 1 }, { opacity: 0 }], 200, 0, 'linear');
      A(q('.i-skip'), [{ opacity: 0.6 }, { opacity: 0 }], 200, 0, 'linear');
      if (target) {
        var to = target.getBoundingClientRect();
        var s = to.width / from.width;
        var dx = (to.left + to.width / 2) - (from.left + from.width / 2);
        var dy = (to.top + to.height / 2) - (from.top + from.height / 2);
        anims.push(logo.animate([
          { transform: 'translate(-50%, -62%) scale(1)' },
          { transform: 'translate(calc(-50% + ' + dx + 'px), calc(-62% + ' + dy + 'px)) scale(' + s + ')' }
        ], { duration: d, easing: EASE.inOut, fill: 'forwards' }));
      } else {
        A(logo, [{ opacity: 1 }, { opacity: 0 }], d, 0, 'linear');
      }
      A(q('.i-bg'), [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 0 100% 0)' }], d, fast ? 0 : 120, EASE.inOut);
      later((fast ? 0 : 120) + d + 20, finish);
    };
    var skip = function () {
      if (exiting) return;
      timers.forEach(clearTimeout);
      anims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
      anims = [];
      intro.classList.add('is-skipped');
      exit(true);
    };
    later(4300, function () { exit(false); });
    intro.addEventListener('click', skip);
    window.addEventListener('wheel', skip, { passive: true, once: true });
    window.addEventListener('touchmove', skip, { passive: true, once: true });
    document.addEventListener('keydown', function (e) { if (!done && (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ' || e.key.indexOf('Arrow') === 0)) skip(); });
    /* 혹시 멈춰도 6초 뒤에는 반드시 닫힘 */
    setTimeout(finish, 6500);
  }
  ready(playIntro);

  if (reduce) return;
  root.classList.add('has-motion');

  /* 카페24는 스크립트를 <head>에 넣을 수 있어서, 문서가 다 읽힌 뒤 시작합니다. */
  ready(init);

  function init() {
    var vh = window.innerHeight;
    var header = $('.site-header');
    var hero = $('.hero');
    var isHome = document.body.classList.contains('is-home');

    /* ---------- 등장 ---------- */
    var reveals = $$('[data-reveal]');
    if ('IntersectionObserver' in window) {
      /* 잘려 있는(clip) 요소는 브라우저가 '안 보임'으로 계산하므로 부모를 대신 지켜봅니다. */
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          (e.target._arvoReveal || [e.target]).forEach(function (el) { el.classList.add('is-in'); });
          io.unobserve(e.target);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
      reveals.forEach(function (el) {
        if (el.getAttribute('data-reveal') === 'clip' && el.parentElement) {
          var host = el.parentElement;
          (host._arvoReveal = host._arvoReveal || []).push(el);
          io.observe(host);
        } else {
          io.observe(el);
        }
      });
    } else {
      reveals.forEach(function (el) { el.classList.add('is-in'); });
    }

    /* ---------- 선언: 단어 나누기 ---------- */
    var words = [];
    $$('[data-words]').forEach(function (el) {
      var parts = el.textContent.trim().split(/\s+/);
      el.textContent = '';
      parts.forEach(function (w, i) {
        var s = document.createElement('span');
        s.className = 'w';
        s.textContent = w;
        el.appendChild(s);
        if (i < parts.length - 1) el.appendChild(document.createTextNode(' '));
        words.push(s);
      });
    });
    var manifesto = $('[data-manifesto]');

    /* ---------- 향의 무대 ---------- */
    var sx = $('[data-sx]');
    var sxPin, sxBottles, sxTexts, sxBgs, sxMarks, sxPaths;
    if (sx) {
      sxPin = $('.sx-pin', sx);
      sxBottles = $$('.sx-bottles img', sx);
      sxTexts = $$('.sx-texts article', sx);
      sxBgs = $$('.sx-bg i', sx);
      sxMarks = $$('.sx-progress span', sx);
      sxPaths = $$('.sx-lines path', sx);
      sxPaths.forEach(function (p) { p.setAttribute('pathLength', '1'); });
    }
    var lastSx = -1;
    var renderSx = function () {
      var r = sx.getBoundingClientRect();
      if (r.bottom < -vh || r.top > vh * 2) return;
      var p = clamp(-r.top / Math.max(1, r.height - vh), 0, 1);
      /* 세 향이 각각 머무는 구간을 두고, 사이에서만 넘어가게 */
      var x = p * 2.6 - 0.3;
      var n = Math.floor(clamp(x, 0, 1.999));
      var idx = clamp(n + smooth(0.32, 0.72, x - n), 0, 2);
      if (x >= 2) idx = 2;
      sxPin.style.setProperty('--p', p.toFixed(4));
      sxPin.style.setProperty('--i', idx.toFixed(4));
      /* 숫자는 더 짧은 구간에서 굴러가게 */
      var ni = x >= 2 ? 2 : clamp(n + smooth(0.44, 0.62, x - n), 0, 2);
      sxPin.style.setProperty('--ni', ni.toFixed(4));
      sxPin.style.setProperty('--draw', (0.18 + p * 0.82).toFixed(4));
      for (var k = 0; k < 3; k++) {
        var d = k - idx, a = Math.abs(d);
        var op = clamp(1 - a * 2.6, 0, 1);
        if (sxBottles[k]) {
          sxBottles[k].style.opacity = clamp(1 - a * 1.9, 0, 1);
          sxBottles[k].style.transform = 'translate3d(-50%,' + (d * 34).toFixed(2) + '%,0) rotate(' + (d * -7).toFixed(2) + 'deg) scale(' + (1 - a * 0.1).toFixed(3) + ')';
        }
        if (sxTexts[k]) {
          sxTexts[k].style.opacity = op;
          sxTexts[k].style.transform = 'translate3d(0,' + (d * 46).toFixed(1) + 'px,0)';
          sxTexts[k].style.pointerEvents = op > 0.6 ? 'auto' : 'none';
          sxTexts[k].setAttribute('aria-hidden', op > 0.6 ? 'false' : 'true');
        }
        if (sxBgs[k]) sxBgs[k].style.opacity = clamp(1 - a, 0, 1);
      }
      var on = Math.round(idx);
      if (on !== lastSx) {
        lastSx = on;
        sxMarks.forEach(function (m, i) { m.classList.toggle('is-on', i === on); });
      }
    };

    /* ---------- 흐르는 띠 ---------- */
    var marquees = $$('[data-marquee]').map(function (m) {
      var track = $('.track', m);
      var unit = track.innerHTML;
      track.innerHTML = unit + unit + unit;
      return { el: m, track: track, x: 0, w: 0, visible: true };
    });
    var measureMarquees = function () {
      marquees.forEach(function (m) { var gap = parseFloat(getComputedStyle(m.track).columnGap) || 0; m.w = (m.track.scrollWidth + gap) / 3; });
    };

    /* ---------- 시차 ---------- */
    var parallax = $$('[data-parallax]');
    var parallaxY = $$('[data-parallax-y]');
    var wide = window.matchMedia('(min-width: 1024px)');

    /* ---------- 스크롤마다 그리기 ---------- */
    var lastY = window.scrollY, velocity = 0, ticking = false;
    var render = function () {
      ticking = false;
      var y = window.scrollY;
      velocity = velocity * 0.6 + (y - lastY) * 0.4;
      lastY = y;

      if (hero) {
        var hr = hero.getBoundingClientRect();
        var hp = clamp(-hr.top / Math.max(1, hr.height), 0, 1);
        hero.style.setProperty('--hp', hp.toFixed(4));
        if (header && isHome) header.classList.toggle('is-over', hr.top > -40);
      }

      if (manifesto && words.length) {
        var mr = manifesto.getBoundingClientRect();
        var mp = clamp(-mr.top / Math.max(1, mr.height - vh), 0, 1);
        var lit = smooth(0.08, 0.82, mp) * words.length;
        for (var i = 0; i < words.length; i++) {
          words[i].style.opacity = (0.13 + 0.87 * clamp(lit - i, 0, 1)).toFixed(3);
        }
      }

      if (sx) renderSx();

      parallax.forEach(function (el) {
        var box = el.parentElement.getBoundingClientRect();
        if (box.bottom < 0 || box.top > vh) return;
        var pp = (box.top + box.height / 2 - vh / 2) / vh;
        el.style.setProperty('--py', (pp * parseFloat(el.getAttribute('data-parallax')) * -100).toFixed(2) + '%');
      });
      if (wide.matches) {
        parallaxY.forEach(function (el) {
          var box = el.getBoundingClientRect();
          if (box.bottom < -200 || box.top > vh + 200) return;
          var pp = (box.top + box.height / 2 - vh / 2) / vh;
          el.style.setProperty('--py', (pp * parseFloat(el.getAttribute('data-parallax-y')) * vh).toFixed(1) + 'px');
        });
      }
    };
    var onScroll = function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(render); }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { vh = window.innerHeight; measureMarquees(); onScroll(); });
    render();

    /* 띠는 계속 흐르고, 스크롤하면 그만큼 밀려 감 */
    if (marquees.length) {
      measureMarquees();
      if ('IntersectionObserver' in window) {
        var mio = new IntersectionObserver(function (es) {
          es.forEach(function (e) { marquees.forEach(function (m) { if (m.el === e.target) m.visible = e.isIntersecting; }); });
        });
        marquees.forEach(function (m) { mio.observe(m.el); });
      }
      var last = 0, dir = 1;
      var loop = function (t) {
        var dt = last ? Math.min(64, t - last) : 16;
        last = t;
        if (Math.abs(velocity) > 0.5) dir = velocity > 0 ? 1 : -1;
        velocity *= 0.92;
        marquees.forEach(function (m) {
          if (!m.visible || !m.w) return;
          m.x -= (0.045 * dt * dir) + velocity * 0.35;
          if (m.x <= -m.w) m.x += m.w;
          if (m.x > 0) m.x -= m.w;
          m.track.style.transform = 'translate3d(' + m.x.toFixed(2) + 'px,0,0)';
        });
        window.requestAnimationFrame(loop);
      };
      window.requestAnimationFrame(loop);
    }

    /* ---------- 마무리: 마우스를 살짝 따라오는 방울 ---------- */
    var orbs = $$('.orb');
    if (orbs.length && window.matchMedia('(hover: hover)').matches) {
      var finale = orbs[0].closest('section') || document.body;
      finale.addEventListener('pointermove', function (e) {
        orbs.forEach(function (o, i) {
          var b = o.getBoundingClientRect();
          var dx = (e.clientX - (b.left + b.width / 2)) / window.innerWidth;
          var dy = (e.clientY - (b.top + b.height / 2)) / window.innerHeight;
          var k = 26 + i * 8;
          o.style.setProperty('--mx', (dx * k).toFixed(1) + 'px');
          o.style.setProperty('--my', (dy * k).toFixed(1) + 'px');
        });
      });
      finale.addEventListener('pointerleave', function () {
        orbs.forEach(function (o) { o.style.setProperty('--mx', '0px'); o.style.setProperty('--my', '0px'); });
      });
    }
  }
})();
