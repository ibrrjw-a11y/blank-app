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

  /* 오프닝: 메인 본문 맨 앞의 짧은 스크립트가 has-intro 를 붙였을 때만 보입니다. */
  ready(function () {
    if (!root.classList.contains('has-intro')) return;
    try { sessionStorage.setItem('arvo-intro', '1'); } catch (e) {}
    setTimeout(function () { root.classList.remove('has-intro'); }, 2900);
  });

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
