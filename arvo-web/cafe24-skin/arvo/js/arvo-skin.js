/* ==========================================================================
   Árvo — 카페24 스킨 스크립트
   상품 데이터(이름·가격·옵션·장바구니)는 카페24가 채웁니다.
   이 파일은 그 위에 Árvo 다운 표현만 더합니다.

   - 상품명에 "No.07 / No.10 / No.11" 이 있으면 그 향의 색·번호·영문 이름·향 노트를 입힙니다.
   - 머리말 스크롤 상태, 모바일 메뉴, 검색 열기, 지금 보는 분류 표시
   - 메인 히어로 향 전환 (7초마다, 마우스를 올리면 멈춤)
   - 상품 목록의 향 칩 거르기
   - 상품 상세의 향 이야기·사용법·특징 목록

   문구를 바꾸려면 아래 SCENTS, LINES, HOW, CATEGORY_COPY 를 고치면 됩니다.
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- 고칠 수 있는 문구 ---------- */
  var SCENTS = {
    '07': {
      en: 'Floral Sunshine', kr: '플로럴 선샤인',
      line: '햇살 아래 자리 잡은 은방울꽃처럼, 밝고 화사하게 시작하는 하루.',
      lede: '햇살처럼 따뜻한 플로럴 향으로, 생기 있고 부드러운 머릿결을 완성하는 퍼퓸 헤어오일.',
      story: '햇살 아래 자리 잡은 화이트 플라워처럼, 밝게 시작하는 하루.',
      notes: ['Citrus, Fresh, Leaf, Watery', 'Lily of the valley, Rose, White flower', 'Woody, Ambery, Musky'],
      card: 'LILY OF THE VALLEY · ROSE · WOODY MUSK',
      trust: ['스위스 향료사와 협업한 향', '촉촉하게 스며드는 워터리 텍스처', '끈적임 없이 산뜻한 마무리']
    },
    '10': {
      en: 'Bloom of Sharon', kr: '블룸 오브 샤론',
      line: '무궁화의 달콤함으로 시작해 자스민과 베리로 이어지는 하루.',
      lede: '청초하게 피어나는 플로럴 무드로, 머릿결에 은은한 생기와 윤기를 더하는 퍼퓸 헤어오일.',
      story: '히비스커스의 달콤한 향기로 시작해, 상냥한 자스민과 베리로 이어지는 하루.',
      notes: ['Lemon, Lime, Apple', 'Jasmine, Peach, Rose, Raspberry', 'Woody, Ambery, Musky'],
      card: 'HIBISCUS · JASMINE · RASPBERRY',
      trust: ['향수처럼 레이어링하는 퍼퓸 타입', '촉촉하게 스며드는 워터리 텍스처', '끈적임 없이 산뜻한 마무리']
    },
    '11': {
      en: 'Forest Fog', kr: '포레스트 포그',
      line: '고요한 숲을 둘러싼 안개 속, 베르가못과 샌달우드를 머금은 향.',
      lede: '안개 낀 숲의 고요함을 담아, 차분하고 세련된 무드를 완성하는 퍼퓸 헤어오일.',
      story: '고요한 숲을 둘러싼 촉촉한 안개 속, 베르가못과 샌달우드를 머금은 향.',
      notes: ['Bergamot, Ivy, Blackcurrant', 'Rose, Jasmine, Vetiver', 'Patchouli, Moss, Sandalwood, Musky'],
      card: 'BERGAMOT · VETIVER · SANDALWOOD',
      trust: ['스위스 향료사와 협업한 향', '촉촉하게 스며드는 워터리 텍스처', '끈적임 없이 산뜻한 마무리']
    }
  };
  /* 향 번호가 없는 상품: 상품명에 들어 있는 낱말로 영문 이름과 사용법 종류를 정합니다. (위에서부터 먼저 맞는 것) */
  var LINES = [
    { test: /피톤|phyton/i, en: 'Phyton Forêt', how: 'shampoo' },
    { test: /스칼프|scalp/i, en: 'Scalp', how: 'shampoo' },
    { test: /컬|curl/i, en: 'Leave-in Curl', how: 'curl' },
    { test: /마스크|트리트먼트|mask|treatment/i, en: '', how: 'mask' },
    { test: /샴푸|shampoo/i, en: '', how: 'shampoo' },
    { test: /오일|oil/i, en: '', how: 'oil' }
  ];
  var HOW = {
    oil: [['젖은 모발 끝에', '샴푸 후 타월로 물기를 닦은 모발 끝에 적당량을 덜어 가볍게 펴 바릅니다.'], ['드라이·고데기 후 한 번 더', '스타일링을 마친 뒤 손에 남은 양만 겉머리에 쓸어 주면 윤기와 잔향이 정돈됩니다.'], ['외출 전 향수처럼', '20ml는 파우치에 넣어 다니며 머리끝에 한 번. 향이 다시 피어오릅니다.']],
    shampoo: [['충분히 적시기', '온수로 모발과 두피를 충분히 적십니다.'], ['두피에 마사지', '적당량(3~5ml)을 모발과 두피에 고르게 펴 바르고 마사지합니다.'], ['깨끗이 헹구기', '거품이 남지 않도록 미온수로 헹궈 냅니다. 1일 1회.']],
    mask: [['샴푸 후', '물기를 가볍게 짠 모발에 충분히 바릅니다.'], ['1분 마사지', '모발 끝 위주로 가볍게 마사지합니다.'], ['미온수로 헹구기', '잔여감 없이 헹궈 냅니다.']],
    curl: [['타월 드라이 후', '약간 젖은 모발에 적당량을 덜어 얇게 펴 바릅니다.'], ['쥐었다 펴기', '컬을 주고 싶은 부위를 모아 주먹으로 5초간 쥐었다 풀어 줍니다.'], ['그대로 말리기', '씻어내지 않고 자연 건조하거나 디퓨저로 말립니다.']]
  };
  /* 상품 목록 위 한 줄 설명 (분류 이름이 정확히 같을 때) */
  var CATEGORY_COPY = {
    '전체 상품': '무드 오일 세 가지와 같은 향의 케어, 두피를 위한 스칼프, 살롱에서 쓰는 컬 크림까지.',
    '헤어오일': '번호가 곧 향입니다. 오늘의 옷과 날씨에 맞춰 하나를 고르세요.',
    '케어': '오일과 같은 향으로 감고, 같은 향으로 마무리합니다.',
    '스칼프': '두피를 위한 시원한 하루 루틴.',
    '살롱': '살롱에서 직접 쓰는 제품을 집에서.'
  };

  /* ---------- 도구 ---------- */
  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };
  var text = function (el) { return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : ''; };
  var NO_RE = /No\.?\s*(07|10|11)(?!\d)/i;
  var scentOf = function (name) {
    var m = NO_RE.exec(name);
    if (m) return m[1];
    if (/floral\s*sunshine|플로럴\s*선샤인/i.test(name)) return '07';
    if (/bloom\s*of\s*sharon|블룸\s*오브\s*샤론/i.test(name)) return '10';
    if (/forest\s*fog|포레스트\s*포그/i.test(name)) return '11';
    return null;
  };
  var lineOf = function (name) {
    for (var i = 0; i < LINES.length; i++) if (LINES[i].test.test(name)) return LINES[i];
    return null;
  };
  /* 번호는 따로 크게 보여 주므로 이름에서는 "No.10" 만 뺍니다. */
  var cleanName = function (el) {
    if (!el || el.children.length) return;
    var t = text(el).replace(NO_RE, ' ').replace(/\s{2,}/g, ' ').trim();
    if (t) el.textContent = t;
  };
  var set = function (el, value) { if (el && value != null) el.textContent = value; };
  var cateNo = function (href) {
    if (!href) return null;
    var m = /cate_no=(\d+)/.exec(href) || /\/category\/[^/]+\/(\d+)\/?/.exec(href);
    return m ? m[1] : null;
  };
  var ready = function (fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); };

  ready(function () {
    var body = document.body;
    var here = cateNo(location.href);

    /* ---------- 머리말 ---------- */
    var header = $('.site-header');
    if (header) {
      var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 8); };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
    var toggle = $('.menu-toggle');
    var menu = $('#arvoMenu');
    var setMenu = function (open) {
      if (!toggle || !menu) return;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
      menu.classList.toggle('is-open', open);
      body.style.overflow = open ? 'hidden' : '';
    };
    if (toggle && menu) toggle.addEventListener('click', function () { setMenu(toggle.getAttribute('aria-expanded') !== 'true'); });

    var search = $('#arvoSearch');
    var openSearch = function (open) {
      if (!search) return;
      setMenu(false);
      search.classList.toggle('is-open', open);
      if (open) {
        var input = $('input', search);
        if (input) setTimeout(function () { input.focus(); }, 120);
      }
    };
    $$('[data-arvo-search-open]').forEach(function (b) { b.addEventListener('click', function () { openSearch(true); }); });
    $$('[data-arvo-search-close]').forEach(function (b) { b.addEventListener('click', function () { openSearch(false); }); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      openSearch(false);
      setMenu(false);
    });
    if (search) {
      var input = $('input', search);
      if (input) {
        if (!input.getAttribute('placeholder')) input.setAttribute('placeholder', '찾는 상품이나 향 번호를 입력하세요');
        input.addEventListener('keydown', function (e) {
          if (e.key !== 'Enter') return;
          var go = $('.search-go', search);
          if (go) { e.preventDefault(); go.click(); }
        });
      }
    }

    /* 지금 보는 분류에 표시 */
    if (here) {
      $$('.gnb a, .filters .tabs a, .mobile-nav .big a').forEach(function (a) {
        if (cateNo(a.getAttribute('href')) === here) a.setAttribute('aria-current', a.closest('.tabs') ? 'true' : 'page');
      });
    }
    if (/\/brand\/story\.html/.test(location.pathname)) {
      $$('.gnb-brand').forEach(function (a) { a.setAttribute('aria-current', 'page'); });
    }

    /* ---------- 상품 칸에 향 입히기 ---------- */
    var cards = $$('[data-arvo-card]');
    cards.forEach(function (card, i) {
      var nameEl = $('[data-arvo-name]', card);
      var name = text(nameEl);
      var s = scentOf(name);
      var line = lineOf(name);
      card.setAttribute('data-scent', s || 'none');
      var thumb = $('.thumb', card);
      if (thumb && !s) thumb.classList.add('plain');
      $$('[data-arvo-no]', card).forEach(function (el) { set(el, s || ''); });
      $$('[data-arvo-en]', card).forEach(function (el) { set(el, s ? SCENTS[s].en : (line && line.en) || ''); });
      if (s) {
        var lineEl = $('[data-arvo-line]', card);
        if (lineEl && !text(lineEl)) set(lineEl, SCENTS[s].line);
        set($('[data-arvo-notes]', card), SCENTS[s].card);
      }
      cleanName(nameEl);
      /* 목록 안에서 차례로 떠오르게 */
      var host = card.hasAttribute('data-reveal') ? card : card.closest('[data-reveal]');
      if (host === card || (host && host.tagName === 'LI')) host.style.setProperty('--d', i % 3);
    });

    /* 상품이 하나도 없는 진열 칸은 섹션째 숨김 */
    $$('[data-arvo-list]').forEach(function (list) {
      if ($('[data-arvo-card]', list)) return;
      var sec = list.closest('section');
      if (sec) sec.hidden = true;
    });

    /* "No.07 보기" 같은 버튼을 메인진열 1번 상품의 상세 주소로 연결 */
    var scentHref = {};
    $$('[data-arvo-list="scent"] [data-arvo-card]').forEach(function (card) {
      var s = card.getAttribute('data-scent');
      var a = $('a[href]', card);
      if (s && s !== 'none' && a && !scentHref[s]) scentHref[s] = a.getAttribute('href');
    });
    $$('[data-arvo-scent-link]').forEach(function (a) {
      var s = a.getAttribute('data-arvo-scent-link');
      if (scentHref[s]) a.setAttribute('href', scentHref[s]);
    });
    /* '전체 상품 보기'는 머리말 첫 번째 분류로 */
    var firstCate = $('.gnb [module] a, .gnb ul a');
    if (firstCate) $$('[data-arvo-all-link]').forEach(function (a) { a.setAttribute('href', firstCate.getAttribute('href')); });

    /* ---------- 메인 히어로: 향 3종 전환 ---------- */
    var hero = $('.hero');
    if (hero) {
      var tabs = $$('.switch button', hero);
      var slides = $$('.slide', hero);
      var imgs = $$('.media img', hero);
      var order = ['07', '10', '11'];
      var cur = order.indexOf(hero.getAttribute('data-scent'));
      if (cur < 0) cur = 1;
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var timer = null, paused = false, DUR = 7000;
      hero.style.setProperty('--hero-dur', DUR + 'ms');
      var schedule = function () {
        clearTimeout(timer);
        if (reduce || paused) return;
        timer = setTimeout(function () { show(cur + 1); }, DUR);
      };
      var show = function (i) {
        cur = (i + order.length) % order.length;
        var s = order[cur];
        hero.setAttribute('data-scent', s);
        tabs.forEach(function (t) { var on = t.getAttribute('data-s') === s; t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1; });
        slides.forEach(function (el) { var on = el.getAttribute('data-s') === s; el.classList.toggle('is-on', on); el.setAttribute('aria-hidden', on ? 'false' : 'true'); });
        imgs.forEach(function (el) { el.classList.toggle('is-on', el.getAttribute('data-s') === s); });
        schedule();
      };
      tabs.forEach(function (t) {
        t.addEventListener('click', function () { show(order.indexOf(t.getAttribute('data-s'))); });
        t.addEventListener('keydown', function (e) {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          e.preventDefault();
          show(cur + (e.key === 'ArrowRight' ? 1 : -1));
          tabs[cur].focus();
        });
      });
      var pause = function (v) { paused = v; hero.classList.toggle('is-paused', v); if (v) clearTimeout(timer); else show(cur); };
      var copy = $('.copy', hero) || hero;
      copy.addEventListener('mouseenter', function () { pause(true); });
      copy.addEventListener('mouseleave', function () { pause(false); });
      hero.addEventListener('focusin', function () { pause(true); });
      hero.addEventListener('focusout', function (e) { if (!hero.contains(e.relatedTarget)) pause(false); });
      document.addEventListener('visibilitychange', function () { if (document.hidden) clearTimeout(timer); else schedule(); });
      /* 오프닝이 끝난 순간부터 7초를 다시 셉니다. */
      document.addEventListener('arvo:introdone', function () { show(cur); });
      show(cur);
    }

    /* ---------- 상품 목록: 분류 설명 · 향 칩 ---------- */
    var cateTitle = $('[data-arvo-cate-title]');
    var cateDesc = $('[data-arvo-cate-desc]');
    if (cateTitle && cateDesc) {
      var copyText = CATEGORY_COPY[text(cateTitle)];
      if (copyText) cateDesc.textContent = copyText;
    }
    var chips = $$('[data-arvo-chips] [data-scent-filter]');
    if (chips.length) {
      var grid = $('[data-arvo-list="grid"]');
      var gridCards = grid ? $$('[data-arvo-card]', grid) : [];
      var countEl = $('[data-arvo-count]');
      var total = countEl ? text(countEl) : '';
      var emptyEl = $('[data-arvo-empty]');
      var active = '';
      var apply = function (s) {
        active = active === s ? '' : s;
        chips.forEach(function (c) { c.setAttribute('aria-pressed', c.getAttribute('data-scent-filter') === active ? 'true' : 'false'); });
        var n = 0;
        gridCards.forEach(function (card) {
          var hit = !active || card.getAttribute('data-scent') === active;
          card.classList.toggle('is-filtered', !hit);
          if (hit) n++;
        });
        if (countEl) countEl.textContent = active ? String(n) : total;
        if (emptyEl) emptyEl.hidden = n > 0 || !gridCards.length;
      };
      chips.forEach(function (c) { c.addEventListener('click', function () { apply(c.getAttribute('data-scent-filter')); }); });
      $$('[data-arvo-empty] [data-scent-filter]').forEach(function (b) { b.addEventListener('click', function () { active = ''; apply(''); }); });
      /* 이 분류에 향 상품이 없으면 칩을 숨김 */
      var hasScent = gridCards.some(function (c) { return c.getAttribute('data-scent') !== 'none'; });
      if (!hasScent) { var wrap = $('[data-arvo-chips]'); if (wrap) wrap.hidden = true; }
    }

    /* ---------- 상품 상세 ---------- */
    var pdp = $('#arvoPdp');
    if (pdp) {
      var h1 = $('[data-arvo-name]', pdp);
      var pname = text(h1);
      var ps = scentOf(pname);
      var pline = lineOf(pname);
      var data = ps ? SCENTS[ps] : null;
      body.setAttribute('data-scent', ps || 'none');
      set($('[data-arvo-no]', pdp), ps || '');
      set($('[data-arvo-en]', pdp), data ? data.en : (pline && pline.en) || '');
      cleanName(h1);
      var lede = $('[data-arvo-lede]', pdp);
      if (lede && !text(lede) && data) lede.textContent = data.lede;

      var trust = $('[data-arvo-trust]', pdp);
      if (trust && data) {
        trust.innerHTML = '';
        data.trust.forEach(function (t) { var li = document.createElement('li'); li.textContent = t; trust.appendChild(li); });
        trust.hidden = false;
      }
      var fillNotes = function (dl) {
        dl.innerHTML = '';
        ['Top', 'Middle', 'Base'].forEach(function (label, k) {
          var row = document.createElement('div');
          var dt = document.createElement('dt'); dt.textContent = label.toUpperCase();
          var dd = document.createElement('dd'); dd.textContent = data.notes[k];
          row.appendChild(dt); row.appendChild(dd); dl.appendChild(row);
        });
      };
      if (data) {
        $$('[data-arvo-notes]').forEach(fillNotes);
        var wrapN = $('[data-arvo-notes-wrap]', pdp);
        if (wrapN) wrapN.hidden = false;
        var story = $('[data-arvo-story]');
        if (story) {
          story.setAttribute('data-scent', ps);
          set($('[data-arvo-no]', story), ps);
          set($('[data-arvo-story-line]', story), data.story);
          story.hidden = false;
        }
      }
      var howKey = pline ? pline.how : (ps ? 'oil' : null);
      var how = $('[data-arvo-how]');
      if (how && howKey && HOW[howKey]) {
        HOW[howKey].forEach(function (step) {
          var li = document.createElement('li');
          var b = document.createElement('b'); b.textContent = step[0];
          var p = document.createElement('p'); p.textContent = step[1];
          li.appendChild(b); li.appendChild(p); how.appendChild(li);
        });
        var howWrap = $('[data-arvo-how-wrap]');
        if (howWrap) howWrap.hidden = false;
      }
      if (howKey === 'oil') $$('[data-arvo-oil-only]').forEach(function (el) { el.hidden = false; });
      /* 세 가지 향 비교에서 지금 보는 향 표시 */
      if (ps) $$('[data-arvo-compare] [data-arvo-card]').forEach(function (c) { c.classList.toggle('is-current', c.getAttribute('data-scent') === ps); });
    }
  });
})();
