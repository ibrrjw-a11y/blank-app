/* ==========================================================================
   Árvo — 시안 스크립트
   공통: 헤더 · 모바일 메뉴 · 히어로 전환 · 미니 장바구니(시안 전용)
   페이지: 상품 목록 렌더링/필터 · 상품 상세 렌더링
   카페24 스킨에서는 상품 데이터와 장바구니를 카페24가 채우므로,
   PRODUCTS 와 장바구니 부분은 쓰지 않고 헤더·히어로·갤러리만 가져갑니다.
   ========================================================================== */
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  var IMG = 'assets/img/';
  var won = function (n) { return n.toLocaleString('ko-KR'); };

  /* ---------- 상품 데이터 (시안 전용 · 가격은 예시) ---------- */
  var NOTICE = '1. 화장품 사용 시 또는 사용 후 직사광선에 의하여 사용부위가 붉은 반점, 부어오름 또는 가려움증 등의 이상 증상이나 부작용이 있는 경우 전문의 등과 상담할 것 2. 상처가 있는 부위 등에는 사용을 자제할 것 3. 어린이의 손이 닿지 않는 곳에 보관하고, 직사광선을 피해서 보관할 것 4. 눈에 들어갔을 때에는 즉시 씻어낼 것';
  var OIL_HOW = [
    ['젖은 모발 끝에', '샴푸 후 타월로 물기를 닦은 모발 끝에 적당량을 덜어 가볍게 펴 바릅니다.'],
    ['드라이·고데기 후 한 번 더', '스타일링을 마친 뒤 손에 남은 양만 겉머리에 쓸어 주면 윤기와 잔향이 정돈됩니다.'],
    ['외출 전 향수처럼', '20ml는 파우치에 넣어 다니며 머리끝에 한 번. 향이 다시 피어오릅니다.']
  ];
  var PRODUCTS = [
    { id: 'oil-07', scent: '07', cat: 'oil', line: 'Mood Oil', no: '07', en: 'Floral Sunshine', kr: '플로럴 선샤인 퍼퓸 헤어오일',
      short: '햇살 아래 은방울꽃, 밝고 화사한 하루의 향',
      lede: '햇살처럼 따뜻한 플로럴 향으로, 생기 있고 부드러운 머릿결을 완성하는 퍼퓸 헤어오일.',
      story: '햇살 아래 자리 잡은 화이트 플라워처럼, 밝게 시작하는 하루.',
      notes: ['Citrus, Fresh, Leaf, Watery', 'Lily of the valley, Rose, White flower', 'Woody, Ambery, Musky'],
      sizes: [['20ml', 12000], ['50ml', 29000]], img: 'p-07-oil.webp', mini: 'p-07-mini.webp', photo: 'hero-07.webp', label: 'label-07.webp',
      trust: ['스위스 향료사와 협업한 향', '촉촉하게 스며드는 워터리 텍스처', '끈적임 없이 산뜻한 마무리'],
      ingredients: '사이클로펜타실록세인, 다이메티콘, 다이메티콘올, 피탄트라이올, 부틸렌글라이콜, 올리고펩타이드-2, 글라이코프로테인, 목련꽃수, 동백나무씨오일, 호호바씨오일, 아보카도오일, 1,2-헥산다이올, 향료, 알파-아이소메틸아이오논, 벤질살리실레이트, 시트로넬올, 헥실신남알, 리모넨, 리날룰',
      functional: '해당없음' },
    { id: 'oil-10', scent: '10', cat: 'oil', line: 'Mood Oil', no: '10', en: 'Bloom of Sharon', kr: '블룸 오브 샤론 퍼퓸 헤어오일',
      short: '무궁화로 시작해 자스민과 베리로 이어지는 달콤한 하루',
      lede: '청초하게 피어나는 플로럴 무드로, 머릿결에 은은한 생기와 윤기를 더하는 퍼퓸 헤어오일.',
      story: '히비스커스의 달콤한 향기로 시작해, 상냥한 자스민과 베리로 이어지는 하루.',
      notes: ['Lemon, Lime, Apple', 'Jasmine, Peach, Rose, Raspberry', 'Woody, Ambery, Musky'],
      sizes: [['20ml', 12000], ['50ml', 29000], ['100ml', 46000]], img: 'p-10-oil.webp', mini: 'p-10-mini.webp', photo: 'hero-10.webp', label: 'label-10.webp', best: true,
      trust: ['향수처럼 레이어링하는 퍼퓸 타입', '촉촉하게 스며드는 워터리 텍스처', '끈적임 없이 산뜻한 마무리'],
      ingredients: '', functional: '해당없음' },
    { id: 'oil-11', scent: '11', cat: 'oil', line: 'Mood Oil', no: '11', en: 'Forest Fog', kr: '포레스트 포그 퍼퓸 헤어오일',
      short: '안개 낀 숲의 고요함, 베르가못과 샌달우드',
      lede: '안개 낀 숲의 고요함을 담아, 차분하고 세련된 무드를 완성하는 퍼퓸 헤어오일.',
      story: '고요한 숲을 둘러싼 촉촉한 안개 속, 베르가못과 샌달우드를 머금은 향.',
      notes: ['Bergamot, Ivy, Blackcurrant', 'Rose, Jasmine, Vetiver', 'Patchouli, Moss, Sandalwood, Musky'],
      sizes: [['20ml', 12000], ['50ml', 29000]], img: 'p-11-oil.webp', mini: 'p-11-mini.webp', photo: 'hero-11.webp', label: 'label-11.webp',
      trust: ['스위스 향료사와 협업한 향', '촉촉하게 스며드는 워터리 텍스처', '끈적임 없이 산뜻한 마무리'],
      ingredients: '사이클로펜타실록세인, 다이메티콘, 다이메티콘올, 캠퍼우드수, 피탄트라이올, 부틸렌글라이콜, 올리고펩타이드-2, 글라이코프로테인, 해바라기씨오일, 올리브오일, 달맞이꽃오일, 1,2-헥산다이올, 향료, 알파-아이소메틸아이오논, 시트랄, 시트로넬올, 쿠마린, 헥실신남알, 리모넨, 리날룰',
      functional: '해당없음' },
    { id: 'shampoo-10', scent: '10', cat: 'care', line: 'Mood Care', no: '10', en: 'Bloom of Sharon', kr: '블룸 오브 샤론 리페어 샴푸',
      short: '오일과 같은 무궁화 향으로 감는 데일리 리페어 샴푸',
      lede: '은은한 무궁화향으로, 손상된 모발을 부드럽게 정돈하는 데일리 리페어 샴푸.',
      story: '오일과 같은 향으로 감고, 같은 향으로 마무리합니다.',
      notes: null, sizes: [['500ml', 26000]], img: 'p-10-shampoo.webp', photo: 'hero-10.webp', short_img: true, how: 'shampoo',
      trust: ['탈모 증상 완화 기능성 화장품', '17가지 아미노산 복합체 함유', '피부 저자극 테스트 완료'],
      ingredients: '', functional: '탈모증상완화' },
    { id: 'mask-10', scent: '10', cat: 'care', line: 'Mood Care', no: '10', en: 'Bloom of Sharon', kr: '블룸 오브 샤론 리페어 헤어 마스크',
      short: '고데기한 날엔 1분 마스크',
      lede: '열에 지친 모발을 매끄럽게 정돈하는 약산성(pH 5~6.5) 리페어 헤어 마스크.',
      story: '같은 무궁화 향으로, 집에서 하는 1분 클리닉.',
      notes: null, sizes: [['200g', 24000]], img: 'p-10-mask.webp', photo: 'hero-10.webp', short_img: true, how: 'mask',
      trust: ['약산성 pH 5~6.5 설계', '무궁화꽃수 함유', '잔여감 없는 마무리'],
      ingredients: '', functional: '해당없음' },
    { id: 'phyton', scent: 'none', cat: 'scalp', line: 'Scalp', no: '', en: 'Phyton Forêt', kr: '스칼프 피톤 포레 너리싱 샴푸',
      short: '숲에서 샴푸한 듯 시원하게, 두피를 위한 피톤치드 샴푸',
      lede: '피톤치드와 편백수로 두피 열과 냄새를 정돈하는 탈모 증상 완화 기능성 샴푸.',
      story: '숲의 공기를 닮은 시원함으로 하루의 두피를 정돈합니다.',
      notes: null, sizes: [['500ml', 26000]], img: 'p-phyton.webp', photo: 'texture.webp', short_img: true, how: 'shampoo',
      trust: ['탈모 증상 완화 기능성 화장품', '비건 인증 완료', '99% 이상 자연유래 성분 처방'],
      ingredients: '', functional: '탈모증상완화' },
    { id: 'scalp-1000', scent: 'none', cat: 'scalp', line: 'Scalp', no: '', en: 'Scalp Shampoo', kr: '스칼프 샴푸 1,000ml',
      short: '가족이 함께 쓰는 대용량 스칼프 샴푸',
      lede: '두피 노폐물과 피지를 깔끔하게 정돈하는 대용량 스칼프 샴푸.',
      story: '사과와 복숭아로 시작해 단향목과 머스크로 남는 달콤한 시트러스.',
      notes: ['사과, 복숭아', '목련, 장미, 클린 화이트 피치', '단향목, 머스크, 코코넛워터'],
      sizes: [['1,000ml', 36000]], img: 'p-scalp-1000.webp', photo: 'texture.webp', short_img: true, how: 'shampoo',
      trust: ['탈모 증상 완화 기능성 화장품', '17가지 아미노산 복합체 함유', '피부 저자극 테스트 완료'],
      ingredients: '', functional: '탈모증상완화' },
    { id: 'curl', scent: 'none', cat: 'salon', line: 'Salon', no: '', en: 'Leave-in Curl', kr: '살롱 리브인 컬링 에센스 크림',
      short: '바르고 쥐었다 펴면 끝, 씻어내지 않는 컬 크림',
      lede: '샴푸 후 바르는 것만으로 컬을 살려 주는, 씻어내지 않는 컬링 에센스 크림.',
      story: '살롱에서 직접 쓰는 컬링 에센스를 집에서.',
      notes: ['베르가못', '꿀, 딸기, 자스민', '바닐라, 머스크'],
      sizes: [['200g', 25000]], img: 'p-curl.webp', photo: 'texture.webp', short_img: true, how: 'curl',
      trust: ['살롱에서 직접 사용하는 컬링 에센스', '저분자 케라틴 함유', '특허받은 허브 6종 추출물'],
      ingredients: '', functional: '해당없음' }
  ];
  var HOW = {
    shampoo: [['충분히 적시기', '온수로 모발과 두피를 충분히 적십니다.'], ['두피에 마사지', '적당량(3~5ml)을 모발과 두피에 고르게 펴 바르고 마사지합니다.'], ['깨끗이 헹구기', '거품이 남지 않도록 미온수로 헹궈 냅니다. 1일 1회.']],
    mask: [['샴푸 후', '물기를 가볍게 짠 모발에 충분히 바릅니다.'], ['1분 마사지', '모발 끝 위주로 가볍게 마사지합니다.'], ['미온수로 헹구기', '잔여감 없이 헹궈 냅니다.']],
    curl: [['타월 드라이 후', '약간 젖은 모발에 적당량을 덜어 얇게 펴 바릅니다.'], ['쥐었다 펴기', '컬을 주고 싶은 부위를 모아 주먹으로 5초간 쥐었다 풀어 줍니다.'], ['그대로 말리기', '씻어내지 않고 자연 건조하거나 디퓨저로 말립니다.']]
  };
  var byId = function (id) { for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].id === id) return PRODUCTS[i]; return null; };
  var fromPrice = function (p) { return p.sizes[0][1]; };

  /* ---------- 헤더 ---------- */
  var header = document.querySelector('.site-header');
  if (header) {
    var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 8); };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }
  var toggle = document.querySelector('.menu-toggle');
  var mnav = document.getElementById('mobile-nav');
  if (toggle && mnav) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      mnav.classList.toggle('is-open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });
  }

  /* ---------- 히어로: 향 3종 전환 ---------- */
  var hero = document.querySelector('.hero');
  if (hero) {
    var tabs = hero.querySelectorAll('.switch button');
    var slides = hero.querySelectorAll('.slide');
    var imgs = hero.querySelectorAll('.media img');
    var order = ['07', '10', '11'];
    var cur = order.indexOf(hero.getAttribute('data-scent'));
    if (cur < 0) cur = 1;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var timer = null, paused = false, DUR = 7000;
    hero.style.setProperty('--hero-dur', DUR + 'ms');
    var show = function (i) {
      cur = (i + order.length) % order.length;
      var s = order[cur];
      hero.setAttribute('data-scent', s);
      tabs.forEach(function (t) { t.setAttribute('aria-selected', t.getAttribute('data-s') === s ? 'true' : 'false'); t.tabIndex = t.getAttribute('data-s') === s ? 0 : -1; });
      slides.forEach(function (el) { var on = el.getAttribute('data-s') === s; el.classList.toggle('is-on', on); el.setAttribute('aria-hidden', on ? 'false' : 'true'); });
      imgs.forEach(function (el) { el.classList.toggle('is-on', el.getAttribute('data-s') === s); });
      schedule();
    };
    var schedule = function () {
      clearTimeout(timer);
      if (reduce || paused) return;
      timer = setTimeout(function () { show(cur + 1); }, DUR);
    };
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { show(order.indexOf(t.getAttribute('data-s'))); });
      t.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault(); show(cur + (e.key === 'ArrowRight' ? 1 : -1)); tabs[cur].focus();
        }
      });
    });
    var pause = function (v) { paused = v; hero.classList.toggle('is-paused', v); if (v) clearTimeout(timer); else { show(cur); } };
    var copy = hero.querySelector('.copy') || hero;
    copy.addEventListener('mouseenter', function () { pause(true); });
    copy.addEventListener('mouseleave', function () { pause(false); });
    hero.addEventListener('focusin', function () { pause(true); });
    hero.addEventListener('focusout', function (e) { if (!hero.contains(e.relatedTarget)) pause(false); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) clearTimeout(timer); else schedule(); });
    show(cur);
  }

  /* ---------- 미니 장바구니 (시안 전용) ---------- */
  var store = {
    get: function () { try { return JSON.parse(localStorage.getItem('arvo-cart') || '[]'); } catch (e) { return store._m || []; } },
    set: function (v) { store._m = v; try { localStorage.setItem('arvo-cart', JSON.stringify(v)); } catch (e) {} }
  };
  var drawer = document.getElementById('cart-drawer');
  var scrim = document.querySelector('.drawer-scrim');
  var countEls = document.querySelectorAll('[data-cart-count]');
  var renderCart = function () {
    var items = store.get(), n = 0, sum = 0;
    items.forEach(function (it) { n += it.qty; });
    countEls.forEach(function (el) { el.textContent = n; });
    if (!drawer) return;
    var list = drawer.querySelector('.items');
    if (!items.length) { list.innerHTML = '<p class="empty">장바구니가 비어 있어요.</p>'; }
    else {
      list.innerHTML = items.map(function (it, i) {
        var p = byId(it.id); if (!p) return '';
        var price = 0; p.sizes.forEach(function (s) { if (s[0] === it.size) price = s[1]; });
        sum += price * it.qty;
        return '<div class="item" data-scent="' + p.scent + '"><div class="th"><img src="' + IMG + p.img + '" alt=""></div>' +
          '<div><b>' + (p.no ? 'No.' + p.no + ' ' : '') + p.kr + '</b><span>' + it.size + ' · ' + it.qty + '개</span></div>' +
          '<div style="text-align:right"><div class="price">' + won(price * it.qty) + '<small>원</small></div><button class="rm" type="button" data-rm="' + i + '">삭제</button></div></div>';
      }).join('');
    }
    drawer.querySelector('[data-sum]').innerHTML = won(sum) + '<small>원</small>';
  };
  var openCart = function () { if (!drawer) return; drawer.classList.add('is-open'); if (scrim) scrim.classList.add('is-open'); drawer.setAttribute('aria-hidden', 'false'); var c = drawer.querySelector('.close'); if (c) c.focus(); };
  var closeCart = function () { if (!drawer) return; drawer.classList.remove('is-open'); if (scrim) scrim.classList.remove('is-open'); drawer.setAttribute('aria-hidden', 'true'); };
  var addToCart = function (id, size, qty) {
    var p = byId(id); if (!p) return;
    size = size || p.sizes[p.sizes.length > 1 ? 1 : 0][0]; qty = qty || 1;
    var items = store.get(), hit = false;
    items.forEach(function (it) { if (it.id === id && it.size === size) { it.qty += qty; hit = true; } });
    if (!hit) items.push({ id: id, size: size, qty: qty });
    store.set(items); renderCart(); openCart();
  };
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-add]');
    if (t) { e.preventDefault(); addToCart(t.getAttribute('data-add'), t.getAttribute('data-size')); return; }
    if (e.target.closest('[data-open-cart]')) { e.preventDefault(); openCart(); return; }
    if (e.target.closest('.drawer .close') || e.target === scrim) { closeCart(); return; }
    var rm = e.target.closest('[data-rm]');
    if (rm) { var items = store.get(); items.splice(+rm.getAttribute('data-rm'), 1); store.set(items); renderCart(); return; }
    if (e.target.closest('[data-checkout]')) { var m = drawer.querySelector('[data-msg]'); if (m) m.textContent = '실제 쇼핑몰에서는 이 버튼이 카페24 주문서로 연결됩니다.'; }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeCart(); });
  renderCart();

  /* ---------- 상품 카드 템플릿 ---------- */
  var card = function (p) {
    var thumbCls = p.scent === 'none' ? 'thumb plain' : 'thumb';
    var tag = p.best ? '<span class="tag">BEST</span>' : '';
    var num = p.no ? '<span class="num">' + p.no + '</span>' : '';
    var sizes = p.sizes.map(function (s) { return s[0]; }).join(' · ');
    return '<article class="prd" data-scent="' + p.scent + '">' +
      '<a class="' + thumbCls + '" href="product.html#' + p.id + '" aria-label="' + p.kr + ' 자세히 보기">' + tag +
      (p.cat === 'oil' ? '<img class="alt" src="' + IMG + p.photo + '" alt="" loading="lazy">' : '') +
      '<img class="p' + (p.short_img ? ' short' : '') + '" src="' + IMG + p.img + '" alt="' + p.kr + '"></a>' +
      '<button class="quick" type="button" data-add="' + p.id + '" aria-label="' + p.kr + ' 장바구니 담기"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="1.4"/></svg></button>' +
      '<div class="info"><div class="row1">' + num + '<span class="en-name">' + p.en + '</span></div>' +
      '<a class="kr" href="product.html#' + p.id + '">' + p.kr + '</a>' +
      '<div class="meta"><span class="price">' + won(fromPrice(p)) + '<small>원' + (p.sizes.length > 1 ? '~' : '') + '</small></span><span class="sizes">' + sizes + '</span></div></div></article>';
  };

  /* ---------- 상품 목록 ---------- */
  var grid = document.getElementById('shop-grid');
  if (grid) {
    var state = { cat: 'all', scent: 'all', sort: 'reco' };
    var hashCat = (location.hash || '').replace('#', '');
    if (['oil', 'care', 'scalp', 'salon'].indexOf(hashCat) >= 0) state.cat = hashCat;
    var cats = document.querySelectorAll('[data-cat]');
    var chips = document.querySelectorAll('[data-scent-filter]');
    var sortSel = document.getElementById('sort');
    var countEl = document.querySelector('[data-count]');
    var draw = function () {
      var list = PRODUCTS.filter(function (p) {
        return (state.cat === 'all' || p.cat === state.cat) && (state.scent === 'all' || p.scent === state.scent);
      });
      if (state.sort === 'low') list = list.slice().sort(function (a, b) { return fromPrice(a) - fromPrice(b); });
      if (state.sort === 'high') list = list.slice().sort(function (a, b) { return fromPrice(b) - fromPrice(a); });
      grid.innerHTML = list.length ? list.map(card).join('') : '<p class="empty">조건에 맞는 상품이 없어요.</p>';
      if (countEl) countEl.textContent = list.length;
      cats.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-cat') === state.cat ? 'true' : 'false'); });
      chips.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-scent-filter') === state.scent ? 'true' : 'false'); });
    };
    cats.forEach(function (b) { b.addEventListener('click', function () { state.cat = b.getAttribute('data-cat'); draw(); }); });
    chips.forEach(function (b) { b.addEventListener('click', function () { var v = b.getAttribute('data-scent-filter'); state.scent = state.scent === v ? 'all' : v; draw(); }); });
    if (sortSel) sortSel.addEventListener('change', function () { state.sort = sortSel.value; draw(); });
    window.addEventListener('hashchange', function () { var h = (location.hash || '').replace('#', ''); state.cat = ['oil', 'care', 'scalp', 'salon'].indexOf(h) >= 0 ? h : 'all'; draw(); });
    draw();
  }

  /* 메인의 케어 라인 레일 */
  var rail = document.getElementById('care-rail');
  if (rail) rail.innerHTML = PRODUCTS.filter(function (p) { return p.cat !== 'oil'; }).map(card).join('');

  /* ---------- 상품 상세 ---------- */
  var pdp = document.getElementById('pdp');
  if (pdp) {
    var renderPdp = function () {
      var id = (location.hash || '#oil-10').replace('#', '');
      var p = byId(id) || byId('oil-10');
      document.body.setAttribute('data-scent', p.scent);
      document.title = (p.no ? 'No.' + p.no + ' ' : '') + p.kr + ' · Árvo';
      var set = function (k, v) { document.querySelectorAll('[data-f="' + k + '"]').forEach(function (el) { el.textContent = v; }); };
      set('no', p.no); set('en', p.en); set('kr', p.kr); set('lede', p.lede); set('short', p.short); set('story', p.story); set('line', p.line);
      document.querySelectorAll('[data-show-no]').forEach(function (el) { el.hidden = !p.no; });

      /* 갤러리 */
      var shots = [{ t: 'prod', src: p.img }, { t: 'photo', src: p.photo }];
      if (p.label) shots.push({ t: 'photo', src: p.label, contain: true });
      shots.push({ t: 'photo', src: 'texture.webp' });
      var main = pdp.querySelector('.gallery .main'), thumbs = pdp.querySelector('.gallery .thumbs');
      main.innerHTML = shots.map(function (s, i) {
        return s.t === 'prod'
          ? '<div class="shot-prod' + (i ? '' : ' is-on') + '"><img src="' + IMG + s.src + '" alt="' + p.kr + '"></div>'
          : '<div class="shot-photo' + (i ? '' : ' is-on') + '"' + (s.contain ? ' style="background:var(--white)"' : '') + '><img src="' + IMG + s.src + '" alt=""' + (s.contain ? ' style="object-fit:contain;padding:6%"' : '') + '></div>';
      }).join('');
      thumbs.innerHTML = shots.map(function (s, i) {
        return '<button type="button" role="tab" class="' + (s.t === 'prod' ? 't-prod' : '') + '" aria-selected="' + (i ? 'false' : 'true') + '" aria-label="이미지 ' + (i + 1) + '"><img src="' + IMG + s.src + '" alt=""></button>';
      }).join('');
      thumbs.querySelectorAll('button').forEach(function (b, i) {
        b.addEventListener('click', function () {
          thumbs.querySelectorAll('button').forEach(function (x, j) { x.setAttribute('aria-selected', i === j ? 'true' : 'false'); });
          main.querySelectorAll(':scope > div').forEach(function (x, j) { x.classList.toggle('is-on', i === j); });
        });
      });

      /* 옵션 · 수량 · 합계 */
      var sizeWrap = pdp.querySelector('.sizes'), qtyIn = pdp.querySelector('.qty input');
      var sel = p.sizes[p.sizes.length > 1 ? 1 : 0][0];
      var priceOf = function (sz) { var v = 0; p.sizes.forEach(function (s) { if (s[0] === sz) v = s[1]; }); return v; };
      var update = function () {
        var q = Math.max(1, Math.min(99, parseInt(qtyIn.value, 10) || 1)); qtyIn.value = q;
        sizeWrap.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-size') === sel ? 'true' : 'false'); });
        document.querySelectorAll('[data-f="price"]').forEach(function (el) { el.innerHTML = won(priceOf(sel)) + '<small>원</small>'; });
        document.querySelectorAll('[data-f="total"]').forEach(function (el) { el.innerHTML = won(priceOf(sel) * q) + '<small>원</small>'; });
        document.querySelectorAll('[data-f="sel"]').forEach(function (el) { el.textContent = sel; });
        pdp.querySelectorAll('[data-buy]').forEach(function (b) { b.setAttribute('data-add', p.id); b.setAttribute('data-size', sel); });
        document.querySelectorAll('.buybar [data-buy]').forEach(function (b) { b.setAttribute('data-add', p.id); b.setAttribute('data-size', sel); });
      };
      sizeWrap.innerHTML = p.sizes.map(function (s) { return '<button type="button" data-size="' + s[0] + '" aria-pressed="false">' + s[0] + '<small>' + won(s[1]) + '원</small></button>'; }).join('');
      sizeWrap.querySelectorAll('button').forEach(function (b) { b.addEventListener('click', function () { sel = b.getAttribute('data-size'); update(); }); });
      qtyIn.value = 1; update();

      var howEl = document.getElementById('how');
      if (howEl) howEl.innerHTML = (p.how ? HOW[p.how] : OIL_HOW).map(function (h) { return '<li><b>' + h[0] + '</b><p>' + h[1] + '</p></li>'; }).join('');
      document.querySelectorAll('[data-oil-only]').forEach(function (el) { el.hidden = p.cat !== 'oil'; });
      var trust = pdp.querySelector('.trust');
      trust.innerHTML = p.trust.map(function (t) { return '<li>' + t + '</li>'; }).join('');

      /* 향 노트 · 성분 · 정보고시 */
      var notesBox = document.querySelectorAll('[data-notes]');
      notesBox.forEach(function (box) {
        box.closest('[data-notes-wrap]').hidden = !p.notes;
        if (p.notes) box.innerHTML = ['TOP', 'MIDDLE', 'BASE'].map(function (k, i) { return '<div><dt>' + k + '</dt><dd>' + p.notes[i] + '</dd></div>'; }).join('');
      });
      set('ingredients', p.ingredients || '전성분은 패키지 원본 기준으로 카페24 상품 정보에 등록합니다.');
      set('volume', p.sizes.map(function (s) { return s[0]; }).join(' / '));
      set('functional', p.functional);

      /* 같은 향 비교 · 같은 향 케어 */
      var cmp = document.getElementById('compare');
      if (cmp) {
        cmp.closest('section').hidden = p.cat !== 'oil';
        cmp.innerHTML = ['oil-07', 'oil-10', 'oil-11'].map(function (k) {
          var q = byId(k);
          return '<a href="product.html#' + k + '" data-scent="' + q.scent + '"' + (k === p.id ? ' class="is-current" aria-current="page"' : '') + '><span class="num">' + q.no + '</span><span class="en-name">' + q.en + '</span><p>' + q.short + '</p></a>';
        }).join('');
      }
      var rel = document.getElementById('related');
      if (rel) {
        var r = PRODUCTS.filter(function (q) { return q.id !== p.id && (p.scent !== 'none' ? q.scent === p.scent : q.cat === p.cat || q.cat === 'oil'); }).slice(0, 4);
        if (r.length < 3) r = r.concat(PRODUCTS.filter(function (q) { return q.cat === 'oil' && r.indexOf(q) < 0 && q.id !== p.id; })).slice(0, 4);
        rel.innerHTML = r.map(card).join('');
      }
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', renderPdp);
    renderPdp();

    pdp.querySelectorAll('.qty button').forEach(function (b) {
      b.addEventListener('click', function () {
        var input = pdp.querySelector('.qty input');
        input.value = (parseInt(input.value, 10) || 1) + (b.getAttribute('data-d') === '+' ? 1 : -1);
        input.dispatchEvent(new Event('change'));
      });
    });
    pdp.querySelector('.qty input').addEventListener('change', function () { var ev = pdp.querySelector('.sizes button[aria-pressed="true"]'); if (ev) ev.click(); });
    pdp.querySelectorAll('[data-buy]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        var q = parseInt(pdp.querySelector('.qty input').value, 10) || 1;
        addToCart(b.getAttribute('data-add'), b.getAttribute('data-size'), q);
        if (b.hasAttribute('data-direct')) { var m = drawer && drawer.querySelector('[data-msg]'); if (m) m.textContent = '바로 구매는 실제 쇼핑몰에서 카페24 주문서로 바로 이동합니다.'; }
      }, true);
    });

    /* 모바일 하단 구매 바 */
    var buybar = document.querySelector('.buybar');
    var anchor = pdp.querySelector('.actions');
    if (buybar && anchor && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        var show = !en[0].isIntersecting && en[0].boundingClientRect.top < 0;
        buybar.classList.toggle('is-on', show); document.body.classList.toggle('has-buybar', show);
      }).observe(anchor);
    }
  }
})();
