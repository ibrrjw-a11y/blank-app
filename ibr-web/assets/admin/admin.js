/*
  IBR 관리자 화면
  - 제품·브랜드(구매처 링크·카탈로그)·IR 글을 고칩니다.
  - 사진은 브라우저에서 바로 줄여(webp) 올립니다. 움직이는 GIF 는 그대로 올립니다.
  - '저장'을 누르면 바뀐 파일을 GitHub 저장소에 커밋 한 번으로 올립니다.
    (사이트 호스팅이 저장소에 연결되어 있으면 잠시 뒤 홈페이지에 반영됩니다)
  - 연결 정보는 이 브라우저(localStorage)에만 저장합니다.
*/
(function () {
  "use strict";

  /* ── 작은 도구 ─────────────────────────────── */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function rand() { return Math.random().toString(36).slice(2, 7); }
  function won(n) { return n == null || n === "" ? "준비 중" : Number(n).toLocaleString("ko-KR") + "원"; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  var toastT;
  function toast(msg, kind, ms) {
    var t = $("#toast"); t.textContent = msg; t.className = "toast" + (kind ? " " + kind : ""); t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, ms || 3200);
  }

  var CAT_LABEL = { hair: "헤어", body: "바디", skin: "스킨", food: "푸드", health: "헬스", pet: "펫", living: "리빙" };
  var FORMS = [["oil", "오일병"], ["pump", "펌프병"], ["tube", "튜브"], ["jar", "단지"], ["honey", "꿀병"], ["stick", "스틱"], ["box", "상자"], ["bar", "비누"], ["bottle", "병"], ["spray", "스프레이"], ["pouch", "파우치"], ["towel", "타월"], ["pack", "팩"], ["chair", "의자"], ["cabinet", "수납장"], ["glass", "유리잔"], ["scale", "체중계"]];
  var GROUPS = [["own", "자사 브랜드"], ["global", "글로벌 소싱"], ["dist", "유통 브랜드"]];
  var ORIGINS = [["KR", "한국"], ["US", "미국"], ["AU", "호주"], ["NZ", "뉴질랜드"], ["GR", "그리스"], ["JP", "일본"], ["FR", "프랑스"], ["UK", "영국"], ["IT", "이탈리아"], ["CZ", "체코"], ["AT", "오스트리아"], ["DE", "독일"], ["CH", "스위스"], ["CA", "캐나다"], ["CN", "중국"], ["ES", "스페인"], ["", "미정(표시 안 함)"]];
  var MARKS = [["serif", "세리프(우아함)"], ["round", "둥근 고딕"], ["caps", "대문자 자간"], ["heavy", "굵은 고딕"], ["script", "기울임"]];
  var IR_TYPES = [["news", "언론 보도"], ["press", "보도자료"], ["notice", "공지"], ["ir", "IR 자료"]];

  /* ── 연결 설정 ─────────────────────────────── */
  var CFG_KEY = "ibr-admin";
  var cfg = { owner: "ibrrjw-a11y", repo: "blank-app", branch: "main", root: "ibr-web", token: "" };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem(CFG_KEY) || "{}")); } catch (e) {}
  function saveCfg() { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (e) {} }
  function connected() { return !!(cfg.token && cfg.owner && cfg.repo && cfg.branch); }
  function rp(p) { var r = (cfg.root || "").replace(/^\/+|\/+$/g, ""); return (r ? r + "/" : "") + p; }
  function encPath(p) { return p.split("/").map(encodeURIComponent).join("/"); }

  function gh(method, path, body, raw) {
    var headers = { Authorization: "Bearer " + cfg.token, Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    if (body) headers["Content-Type"] = "application/json";
    return fetch("https://api.github.com" + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined, cache: "no-store" }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) {
        var m = t; try { m = JSON.parse(t).message || t; } catch (e) {}
        var err = new Error(r.status + " " + m); err.status = r.status; throw err;
      });
      return raw ? r.text() : r.json();
    });
  }
  function REPO() { return "/repos/" + encodeURIComponent(cfg.owner) + "/" + encodeURIComponent(cfg.repo); }

  /* ── 데이터 ─────────────────────────────── */
  var FILES = { data: "assets/js/ibr-data.js", links: "assets/js/ibr-links.js", ir: "assets/js/ibr-ir-data.js", media: "assets/js/ibr-media.js" };
  var D = null;            // 지금 고치고 있는 내용
  var ORIG = {};           // 불러올 때 파일 내용(바뀐 파일 찾기용)
  var ORIG_ITEMS = {};     // 불러올 때 항목별 내용(새로·수정 표시용)
  var mediaHad = false;    // ibr-media.js 에 내용이 있었는지(있으면 저장 때 제품 데이터로 합칩니다)
  var headSha = null;      // 불러온 시점의 커밋
  var pending = {};        // 새로 올릴 파일: 경로 → { blob, url }
  var removals = {};       // 지울 기존 파일: 경로 → true
  var fresh = {};          // 방금 저장한 파일의 미리보기 주소(사이트 반영 전까지)
  var loadedFrom = "";

  function readFile(p) {
    if (connected()) return gh("GET", REPO() + "/contents/" + encPath(rp(p)) + "?ref=" + encodeURIComponent(cfg.branch), null, true);
    return fetch(p + "?v=" + Date.now(), { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(p + " " + r.status); return r.text(); });
  }
  function run(text) { var w = {}; new Function("window", text)(w); return w; }

  function load() {
    $("#app").innerHTML = '<p class="loading">불러오는 중…</p>';
    var keys = Object.keys(FILES);
    var head = connected() ? gh("GET", REPO() + "/git/ref/heads/" + encPath(cfg.branch)).then(function (r) { return r.object.sha; }) : Promise.resolve(null);
    return Promise.all([head].concat(keys.map(function (k) { return readFile(FILES[k]).catch(function (e) { if (k === "data") throw e; return ""; }); }))).then(function (res) {
      headSha = res[0];
      var t = {}; keys.forEach(function (k, i) { t[k] = res[i + 1]; });
      var d = run(t.data), l = t.links ? run(t.links) : {}, ir = t.ir ? run(t.ir) : {}, m = t.media ? run(t.media) : {};
      var media = m.IBR_MEDIA || {};
      mediaHad = Object.keys(media).length > 0;
      D = { cats: d.IBR_CATS || CAT_LABEL, brands: d.IBR_BRANDS || [], products: d.IBR_PRODUCTS || [], links: l.IBR_LINKS || {}, ir: ir.IBR_IR || [] };
      /* 제품: 아이디를 고정하고, ibr-media.js 의 사진·상세 정보를 제품에 합칩니다 */
      var n = {};
      D.products.forEach(function (p) {
        n[p.b] = (n[p.b] || 0) + 1;
        if (!p.id) p.id = p.b + "-" + n[p.b];
        var mm = media[p.b + "|" + p.n];
        if (mm) { if (mm.img) { p.img = mm.img; if (mm.full) p.full = true; } if (mm.detail && mm.detail.length) p.detail = mm.detail.slice(); }
        if (p.imgFull) { p.full = true; delete p.imgFull; }
      });
      D.ir.forEach(function (x, i) { if (!x.id) x.id = "n" + (i + 1); });
      D.brands.forEach(function (b) { if (!D.links[b.id]) D.links[b.id] = { smartstore: "", mall: "", global: "", catalog: "" }; });
      snapshot();
      pending = {}; removals = {};
      loadedFrom = connected() ? "GitHub " + cfg.owner + "/" + cfg.repo + " · " + cfg.branch : "이 사이트 파일(둘러보기)";
      updateConn(); render(); markChange();
    }).catch(function (e) {
      $("#app").innerHTML = '<div class="settings"><h2>불러오지 못했습니다</h2><p class="status-line err">' + esc(e.message) + '</p><p class="lead">연결 · 설정 탭에서 저장소와 토큰을 확인해 주세요.</p></div>';
      updateConn();
    });
  }
  function snapshot() {
    ORIG = { data: dataText(), links: linksText(), ir: irText() };
    ORIG_ITEMS = { products: {}, brands: {}, ir: {} };
    D.products.forEach(function (p) { ORIG_ITEMS.products[p.id] = JSON.stringify(cleanProduct(p)); });
    D.brands.forEach(function (b) { ORIG_ITEMS.brands[b.id] = JSON.stringify([cleanBrand(b), D.links[b.id]]); });
    D.ir.forEach(function (x) { ORIG_ITEMS.ir[x.id] = JSON.stringify(cleanIr(x)); });
  }
  function itemState(kind, id, cur) {
    var o = ORIG_ITEMS[kind][id];
    if (o == null) return "new";
    return o === JSON.stringify(cur) ? "" : "chg";
  }

  /* ── 파일로 쓰기 ─────────────────────────────── */
  function pick(o, keys) {
    var r = {};
    keys.forEach(function (k) {
      var v = o[k];
      if (v == null || v === "" || v === false || (Array.isArray(v) && !v.length)) return;
      r[k] = v;
    });
    return r;
  }
  function cleanProduct(p) {
    var c = pick(p, ["id", "b", "n", "cat", "form", "img", "full", "opts", "vars", "note", "check", "top", "detail", "url"]);
    c.opts = (p.opts || []).map(function (o) { return [String(o[0] || ""), o[1] === "" || o[1] == null || isNaN(o[1]) ? null : Number(o[1])]; });
    return c;
  }
  function cleanBrand(b) { return pick(b, ["id", "ko", "en", "group", "origin", "cat", "mark", "tint", "ink", "line"]); }
  function cleanIr(x) { return pick(x, ["id", "date", "type", "title", "source", "url", "summary", "brand", "img", "body", "file"]); }

  var DATA_HEAD = "/*\n" +
    "  IBR 브랜드·제품 데이터 — 홈페이지의 브랜드 목록과 제품 페이지가 모두 이 파일 하나를 읽습니다.\n" +
    "  관리자 화면(admin.html)에서 고치면 이 파일을 새로 씁니다. 직접 고쳐도 됩니다.\n\n" +
    "  ■ 제품: { id, b: 브랜드 id, n: 제품명, cat: 분류, form: 그림 모양, img: 대표 사진, full: 배경 있는 사진,\n" +
    "           opts: [[용량, 소비자가], ...], vars: [종류], note: 안내, check: 확인 표시, top: 메인 대표 제품, detail: [상세 이미지] }\n" +
    "    - 가격은 소비자가(숫자, 원). 모르면 null → \"소비자가 준비 중\".\n" +
    "  ■ 분류(cat): hair 헤어 · body 바디 · skin 스킨 · food 푸드 · health 헬스 · pet 펫 · living 리빙\n" +
    "  ■ 그림 모양(form): oil pump tube jar honey stick box bar bottle spray pouch towel pack chair cabinet glass scale\n" +
    "*/\n";
  function dataText() {
    var out = DATA_HEAD + "window.IBR_CATS = " + JSON.stringify(D.cats) + ";\n\nwindow.IBR_BRANDS = [\n";
    var lines = [];
    GROUPS.forEach(function (g) {
      var bs = D.brands.filter(function (b) { return b.group === g[0]; });
      if (!bs.length) return;
      lines.push("  /* ── " + g[1] + " ── */");
      bs.forEach(function (b) { lines.push("  " + JSON.stringify(cleanBrand(b)) + ","); });
    });
    D.brands.filter(function (b) { return !GROUPS.some(function (g) { return g[0] === b.group; }); }).forEach(function (b) { lines.push("  " + JSON.stringify(cleanBrand(b)) + ","); });
    out += lines.join("\n") + "\n];\n\nwindow.IBR_PRODUCTS = [\n";
    /* 제품은 목록 순서 그대로(제품 페이지 '전체'에 보이는 순서) 쓰고, 브랜드가 바뀌는 곳에 이름을 적어 둡니다 */
    lines = [];
    var prev = null;
    D.products.forEach(function (p) {
      if (p.b !== prev) { prev = p.b; lines.push("  /* " + ((brandOf(p.b) || {}).ko || p.b) + " */"); }
      lines.push("  " + JSON.stringify(cleanProduct(p)) + ",");
    });
    return out + lines.join("\n") + "\n];\n";
  }
  function linksText() {
    var head = "/*\n  브랜드별 바로가기 링크 — 브랜드 화면과 제품 화면의 버튼에 쓰입니다. 비어 있으면 '준비 중'으로 흐리게 보입니다.\n" +
      "  smartstore: 네이버 스마트스토어 · mall: 자사몰 · global: 해외 공식몰(해외 브랜드만) · catalog: 브랜드 카탈로그(PDF)\n" +
      "  관리자 화면(admin.html)에서 고치면 이 파일을 새로 씁니다.\n*/\nwindow.IBR_LINKS = {\n";
    var rows = D.brands.map(function (b) {
      var l = D.links[b.id] || {};
      return "  " + JSON.stringify(b.id) + ": " + JSON.stringify({ smartstore: l.smartstore || "", mall: l.mall || "", global: l.global || "", catalog: l.catalog || "" });
    });
    return head + rows.join(",\n") + "\n};\n";
  }
  function irText() {
    var head = "/*\n  IR · 소식 목록 — ir.html 이 읽습니다. 날짜(date)가 최신인 글이 위로 정렬됩니다(날짜는 화면에 보이지 않게 해 두었습니다).\n" +
      "  type: news 언론 보도 · press 보도자료 · notice 공지 · ir IR 자료 / url: 외부 기사 주소 / body: 사이트 안에서 보여 줄 본문 / file: 내려받을 자료\n" +
      "  관리자 화면(admin.html)에서 고치면 이 파일을 새로 씁니다.\n*/\nwindow.IBR_IR = [\n";
    return head + D.ir.map(function (x) { return "  " + JSON.stringify(cleanIr(x)) + ","; }).join("\n") + "\n];\n";
  }
  var MEDIA_EMPTY = "/* 제품 사진·상세 이미지 목록. 관리자 화면에서 저장한 뒤로는 사진 정보가 ibr-data.js 의 각 제품에 들어 있습니다.\n   tools/make_media.py 로 한꺼번에 넣을 때만 이 파일을 씁니다. 키는 '브랜드id|제품명' 입니다. */\nwindow.IBR_MEDIA = {};\n";

  /* 바뀐 파일 목록 */
  function changes() {
    var files = [];
    var dt = dataText(), lt = linksText(), it = irText();
    if (dt !== ORIG.data) { files.push({ path: FILES.data, text: dt }); if (mediaHad) files.push({ path: FILES.media, text: MEDIA_EMPTY }); }
    if (lt !== ORIG.links) files.push({ path: FILES.links, text: lt });
    if (it !== ORIG.ir) files.push({ path: FILES.ir, text: it });
    var ups = Object.keys(pending).filter(used);
    var dels = Object.keys(removals).filter(function (p) { return !used(p) && !pending[p]; });
    return { files: files, uploads: ups, deletes: dels, count: files.length + ups.length + dels.length };
  }
  function summary() {
    var s = [], c = { products: [0, 0, 0], brands: [0, 0, 0], ir: [0, 0, 0] };
    D.products.forEach(function (p) { var st = itemState("products", p.id, cleanProduct(p)); if (st === "new") c.products[0]++; else if (st === "chg") c.products[1]++; });
    D.brands.forEach(function (b) { var st = itemState("brands", b.id, [cleanBrand(b), D.links[b.id]]); if (st === "new") c.brands[0]++; else if (st === "chg") c.brands[1]++; });
    D.ir.forEach(function (x) { var st = itemState("ir", x.id, cleanIr(x)); if (st === "new") c.ir[0]++; else if (st === "chg") c.ir[1]++; });
    c.products[2] = Object.keys(ORIG_ITEMS.products).filter(function (id) { return !D.products.some(function (p) { return p.id === id; }); }).length;
    c.brands[2] = Object.keys(ORIG_ITEMS.brands).filter(function (id) { return !D.brands.some(function (b) { return b.id === id; }); }).length;
    c.ir[2] = Object.keys(ORIG_ITEMS.ir).filter(function (id) { return !D.ir.some(function (x) { return x.id === id; }); }).length;
    [["products", "제품"], ["brands", "브랜드"], ["ir", "IR 글"]].forEach(function (k) {
      var v = c[k[0]], parts = [];
      if (v[0]) parts.push(v[0] + "개 추가"); if (v[1]) parts.push(v[1] + "개 수정"); if (v[2]) parts.push(v[2] + "개 삭제");
      if (parts.length) s.push(k[1] + " " + parts.join(" · "));
    });
    return s;
  }
  function markChange() {
    if (!D) return;
    var ch = changes(), b = $("#saveBtn");
    b.disabled = !ch.count;
    b.textContent = ch.count ? "저장 (" + ch.count + ")" : "저장";
    renderListSoon();
  }

  /* 파일이 아직 어딘가에서 쓰이는지 */
  function used(path) {
    if (!D) return false;
    if (D.products.some(function (p) { return p.img === path || (p.detail || []).indexOf(path) > -1; })) return true;
    if (D.ir.some(function (x) { return x.img === path || x.file === path; })) return true;
    return D.brands.some(function (b) { return (D.links[b.id] || {}).catalog === path; });
  }
  /* 파일을 더 이상 안 쓰게 됐을 때: 새로 올린 것은 취소, 기존 파일은 저장 때 지움 */
  function release(path) {
    if (!path || used(path)) return;
    if (pending[path]) { URL.revokeObjectURL(pending[path].url); delete pending[path]; return; }
    if (/^assets\//.test(path)) removals[path] = true;
  }
  function src(path) { return path ? (pending[path] ? pending[path].url : fresh[path] || path) : ""; }
  function addPending(path, blob) { pending[path] = { blob: blob, url: URL.createObjectURL(blob) }; delete removals[path]; }

  /* ── 사진 처리(브라우저 안에서) ─────────────────────────────── */
  function decode(file) {
    if (window.createImageBitmap) return createImageBitmap(file).catch(function () { return viaImg(file); });
    return viaImg(file);
  }
  function viaImg(file) {
    return new Promise(function (res, rej) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { rej(new Error("이미지를 읽지 못했습니다: " + file.name)); }; im.src = URL.createObjectURL(file); });
  }
  function cv(w, h) { var c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  function encode(c, q, alpha) {
    return new Promise(function (res) {
      c.toBlob(function (b) {
        if (b && b.type === "image/webp") return res({ blob: b, ext: "webp" });
        c.toBlob(function (b2) { res({ blob: b2, ext: alpha ? "png" : "jpg" }); }, alpha ? "image/png" : "image/jpeg", q);
      }, "image/webp", q);
    });
  }
  function anyAlpha(d) { for (var i = 3; i < d.length; i += 4) if (d[i] < 250) return true; return false; }
  /* 가장자리와 이어진 거의 흰 픽셀을 투명하게 */
  function knockout(img, w, h, tol) {
    var d = img.data, seen = new Uint8Array(w * h), q = new Int32Array(w * h), qh = 0, qt = 0;
    function white(i) { var k = i * 4; return d[k] >= tol && d[k + 1] >= tol && d[k + 2] >= tol; }
    function push(i) { if (!seen[i] && white(i)) { seen[i] = 1; q[qt++] = i; } }
    for (var x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (var y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (qh < qt) {
      var i = q[qh++], px = i % w;
      d[i * 4 + 3] = 0;
      if (px > 0) push(i - 1); if (px < w - 1) push(i + 1); if (i >= w) push(i - w); if (i < w * (h - 1)) push(i + w);
    }
  }
  function bbox(d, w, h) {
    var x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return x1 < 0 ? { x: 0, y: 0, w: w, h: h } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  function mainImage(file, knock, max) {
    return decode(file).then(function (im) {
      var s = Math.min(1, 1400 / Math.max(im.width, im.height)), c = cv(im.width * s, im.height * s), x = c.getContext("2d", { willReadFrequently: true });
      x.drawImage(im, 0, 0, c.width, c.height);
      var img = x.getImageData(0, 0, c.width, c.height);
      if (knock) { knockout(img, c.width, c.height, 244); x.putImageData(img, 0, 0); }
      var alpha = anyAlpha(img.data), b = alpha ? bbox(img.data, c.width, c.height) : { x: 0, y: 0, w: c.width, h: c.height };
      var s2 = Math.min(1, (max || 1000) / Math.max(b.w, b.h)), c2 = cv(b.w * s2, b.h * s2);
      c2.getContext("2d").drawImage(c, b.x, b.y, b.w, b.h, 0, 0, c2.width, c2.height);
      return encode(c2, .84, alpha);
    });
  }
  function photoImage(file, max) {
    return decode(file).then(function (im) {
      var s = Math.min(1, (max || 1400) / Math.max(im.width, im.height)), c = cv(im.width * s, im.height * s);
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      return encode(c, .8, false);
    });
  }
  /* 상세 이미지: 가로 860px, 세로 6000px 이하로 고르게 나눔.
     움직이는 GIF 는 움직임을 살린 webp 로 바꿔 크기를 크게 줄입니다(크롬·엣지·파이어폭스). 안 되는 브라우저에서는 GIF 그대로 */
  function detailImages(file, onStep) {
    if (file.type === "image/gif") return gifToWebp(file, onStep).then(function (r) {
      if (r === "still") return stillDetail(file);
      return [r || { blob: file, ext: "gif", raw: true }];
    }, function () { return [{ blob: file, ext: "gif", raw: true }]; });
    return stillDetail(file);
  }

  /* ── 움직이는 GIF → 움직이는 webp ──
     프레임을 하나씩 풀어(ImageDecoder) 가로 860px 로 줄이고 webp 로 저장한 뒤 애니메이션 webp 파일로 묶습니다.
     너무 촘촘한 프레임(60ms 미만)은 이웃 프레임과 합쳐 초당 16장 정도로 맞춥니다. */
  var webpEnc = null;
  function canWebp() { if (webpEnc == null) { try { webpEnc = cv(2, 2).toDataURL("image/webp").indexOf("data:image/webp") === 0; } catch (e) { webpEnc = false; } } return webpEnc; }
  function u24(a, o, v) { a[o] = v & 255; a[o + 1] = (v >> 8) & 255; a[o + 2] = (v >> 16) & 255; }
  function chunk(tag, body) {
    var n = body.length, c = new Uint8Array(8 + n + (n & 1));
    for (var i = 0; i < 4; i++) c[i] = tag.charCodeAt(i);
    new DataView(c.buffer).setUint32(4, n, true); c.set(body, 8);
    return c;
  }
  /* 한 장짜리 webp 에서 그림 부분(ALPH·VP8·VP8L 조각)만 꺼냄 */
  function webpParts(buf) {
    var u = new Uint8Array(buf), dv = new DataView(buf), out = [], alpha = false, p = 12;
    while (p + 8 <= u.length) {
      var tag = String.fromCharCode(u[p], u[p + 1], u[p + 2], u[p + 3]), n = dv.getUint32(p + 4, true), end = p + 8 + n + (n & 1);
      if (tag === "ALPH" || tag === "VP8 " || tag === "VP8L") { var c = u.slice(p, Math.min(end, u.length)); if (c.length & 1) { var c2 = new Uint8Array(c.length + 1); c2.set(c); c = c2; } out.push(c); if (tag !== "VP8 ") alpha = true; }
      p = end;
    }
    return { parts: out, alpha: alpha };
  }
  function gifToWebp(file, onStep) {
    if (!window.ImageDecoder || !canWebp()) return Promise.resolve(null);
    var dec, frames = [], W, H, c, x, alpha = false;
    return file.arrayBuffer().then(function (buf) {
      dec = new ImageDecoder({ data: buf, type: "image/gif" });
      return dec.completed.then(function () { return dec.tracks.ready; });
    }).then(function () {
      var n = dec.tracks.selectedTrack.frameCount;
      if (n <= 1) { dec.close(); return "still"; }
      var chain = Promise.resolve(), last = null;
      for (var i = 0; i < n; i++) (function (i) {
        chain = chain.then(function () { return dec.decode({ frameIndex: i }); }).then(function (r) {
          var vf = r.image, d = vf.duration ? vf.duration / 1000 : 100;
          if (d <= 10) d = 100;                       // 브라우저와 같게: 너무 짧은 값은 0.1초
          if (!c) { W = Math.min(860, vf.displayWidth); H = Math.max(1, Math.round(vf.displayHeight * W / vf.displayWidth)); c = cv(W, H); x = c.getContext("2d"); }
          if (last && last.d < 60) { last.d += d; vf.close(); return; }  // 이웃 프레임과 합치기
          x.fillStyle = "#fff"; x.fillRect(0, 0, W, H); x.drawImage(vf, 0, 0, W, H); vf.close();
          var f = { d: d }; frames.push(f); last = f;
          if (onStep) onStep(i + 1, n);
          return new Promise(function (res) { c.toBlob(res, "image/webp", .72); }).then(function (b) { return b.arrayBuffer(); }).then(function (ab) {
            var w = webpParts(ab); f.parts = w.parts; if (w.alpha) alpha = true;
          });
        });
      })(i);
      return chain.then(function () {
        dec.close();
        var vp8x = new Uint8Array(10); vp8x[0] = 0x02 | (alpha ? 0x10 : 0); u24(vp8x, 4, W - 1); u24(vp8x, 7, H - 1);
        var anim = new Uint8Array([255, 255, 255, 255, 0, 0]);
        var body = [chunk("VP8X", vp8x), chunk("ANIM", anim)];
        frames.forEach(function (f) {
          var len = 16 + f.parts.reduce(function (a, q) { return a + q.length; }, 0), b = new Uint8Array(len), o = 16;
          u24(b, 6, W - 1); u24(b, 9, H - 1); u24(b, 12, Math.min(0xFFFFFF, Math.round(f.d))); b[15] = 0x02;  // 겹치지 않고 통째로 바꿈
          f.parts.forEach(function (q) { b.set(q, o); o += q.length; });
          body.push(chunk("ANMF", b));
        });
        var size = 4 + body.reduce(function (a, q) { return a + q.length; }, 0), head = new Uint8Array(12);
        head.set([82, 73, 70, 70]); new DataView(head.buffer).setUint32(4, size, true); head.set([87, 69, 66, 80], 8);
        return { blob: new Blob([head].concat(body), { type: "image/webp" }), ext: "webp", frames: frames.length };
      });
    });
  }
  function stillDetail(file) {
    return decode(file).then(function (im) {
      var w = Math.min(860, im.width), s = w / im.width, H = Math.round(im.height * s), parts = [], chain = Promise.resolve();
      var step = Math.ceil(H / Math.ceil(H / 6000));
      for (var top = 0; top < H; top += step) (function (top) {
        var hh = Math.min(step, H - top);
        chain = chain.then(function () {
          var c = cv(w, hh);
          c.getContext("2d").drawImage(im, 0, top / s, im.width, hh / s, 0, 0, w, hh);
          return encode(c, .8, false).then(function (r) { parts.push(r); });
        });
      })(top);
      return chain.then(function () { return parts; });
    });
  }
  function pickFiles(accept, multiple) {
    return new Promise(function (res) {
      var i = document.createElement("input"); i.type = "file"; i.accept = accept; i.multiple = !!multiple;
      i.onchange = function () { res([].slice.call(i.files || [])); };
      i.click();
    });
  }
  function safeName(n) { return String(n).toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9가-힣_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "file"; }

  /* ── 화면 ─────────────────────────────── */
  var tab = "products", sel = { products: null, brands: null, ir: null }, filt = { brand: "", q: "" }, editing = false;
  var app = $("#app");

  function updateConn() {
    var c = $("#conn");
    c.textContent = connected() ? cfg.repo + " · " + cfg.branch : "둘러보기 · 저장 안 됨";
    c.className = "conn" + (connected() ? " on" : "");
    c.title = loadedFrom ? "불러온 곳: " + loadedFrom : "";
  }
  function setTab(t) {
    tab = t; editing = false;
    $$(".tabs button").forEach(function (b) { b.setAttribute("aria-selected", String(b.dataset.tab === t)); });
    render();
  }
  function render() {
    if (!D && tab !== "settings") return;
    if (tab === "settings") return renderSettings();
    app.innerHTML = '<div class="split' + (editing ? " editing" : "") + '"><aside class="list-pane"><div class="list-tools"></div><div class="list"></div></aside><section class="edit-pane"></section></div>';
    renderTools(); renderList(); renderEditor();
  }
  var listT;
  function renderListSoon() { clearTimeout(listT); listT = setTimeout(function () { if ($(".list")) renderList(); }, 120); }
  function brandOf(id) { return D.brands.filter(function (b) { return b.id === id; })[0]; }
  function brandOptions(selId, withNone) {
    var o = withNone ? '<option value="">(없음)</option>' : "";
    GROUPS.forEach(function (g) {
      var bs = D.brands.filter(function (b) { return b.group === g[0]; });
      if (!bs.length) return;
      o += '<optgroup label="' + g[1] + '">' + bs.map(function (b) { return '<option value="' + esc(b.id) + '"' + (b.id === selId ? " selected" : "") + ">" + esc(b.ko) + "</option>"; }).join("") + "</optgroup>";
    });
    return o;
  }
  function opts(list, cur) { cur = cur == null ? "" : String(cur); return list.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === cur ? " selected" : "") + ">" + o[1] + "</option>"; }).join(""); }

  function renderTools() {
    var t = $(".list-tools");
    if (tab === "products") {
      t.innerHTML = '<div class="row"><select id="fBrand"><option value="">모든 브랜드</option>' + brandOptions(filt.brand) + '</select><button class="btn primary" type="button" id="addItem">+ 새 제품</button></div>' +
        '<input type="search" id="fQ" placeholder="제품 이름 검색" value="' + esc(filt.q) + '"><p class="list-count" id="lc"></p>';
      $("#fBrand").onchange = function () { filt.brand = this.value; renderList(); };
      $("#fQ").oninput = function () { filt.q = this.value.trim(); renderList(); };
    } else if (tab === "brands") {
      t.innerHTML = '<div class="row"><input type="search" id="fQ" placeholder="브랜드 검색" value="' + esc(filt.q) + '"><button class="btn primary" type="button" id="addItem">+ 새 브랜드</button></div><p class="list-count" id="lc"></p>';
      $("#fQ").oninput = function () { filt.q = this.value.trim(); renderList(); };
    } else {
      t.innerHTML = '<div class="row"><input type="search" id="fQ" placeholder="제목 검색" value="' + esc(filt.q) + '"><button class="btn primary" type="button" id="addItem">+ 새 글</button></div><p class="list-count" id="lc"></p>';
      $("#fQ").oninput = function () { filt.q = this.value.trim(); renderList(); };
    }
    $("#addItem").onclick = addItem;
  }
  function stateTag(st) { return st === "new" ? '<span class="tag new">새로</span>' : st === "chg" ? '<span class="tag chg">수정</span>' : ""; }
  function renderList() {
    var box = $(".list"); if (!box) return;
    var h = "", n = 0, q = (filt.q || "").toLowerCase();
    if (tab === "products") {
      D.brands.concat([{ id: "__none", ko: "브랜드 없음" }]).forEach(function (b) {
        if (filt.brand && b.id !== filt.brand) return;
        var ps = D.products.filter(function (p) { return (b.id === "__none" ? !brandOf(p.b) : p.b === b.id) && (!q || (p.n || "").toLowerCase().indexOf(q) > -1); });
        if (!ps.length) return;
        h += '<div class="group-h">' + esc(b.ko) + " · " + ps.length + "</div>";
        ps.forEach(function (p) {
          n++;
          var price = p.opts && p.opts[0] ? (p.opts[0][0] || "") + " · " + won(p.opts[0][1]) : "";
          h += '<button type="button" class="item" data-id="' + esc(p.id) + '"' + (sel.products === p.id ? ' aria-current="true"' : "") + '>' +
            '<span class="th' + (p.full ? " cover" : "") + '" style="background:' + esc((brandOf(p.b) || {}).tint || "") + '">' + (p.img ? '<img src="' + esc(src(p.img)) + '" alt="" loading="lazy">' : "사진 없음") + "</span>" +
            '<span><span class="nm">' + esc(p.n || "(이름 없음)") + '</span><span class="sub">' + esc(price) + '</span><span class="tags">' + stateTag(itemState("products", p.id, cleanProduct(p))) +
            ((p.detail || []).length ? '<span class="tag blue">상세 ' + p.detail.length + "</span>" : "") + (p.top ? '<span class="tag">메인</span>' : "") + "</span></span></button>";
        });
      });
      $("#lc").textContent = "제품 " + n + "개" + (filt.brand || q ? " (전체 " + D.products.length + "개)" : "");
    } else if (tab === "brands") {
      GROUPS.forEach(function (g) {
        var bs = D.brands.filter(function (b) { return b.group === g[0] && (!q || (b.ko + " " + b.en).toLowerCase().indexOf(q) > -1); });
        if (!bs.length) return;
        h += '<div class="group-h">' + g[1] + " · " + bs.length + "</div>";
        bs.forEach(function (b) {
          n++;
          var cnt = D.products.filter(function (p) { return p.b === b.id; }).length, l = D.links[b.id] || {};
          var nl = ["smartstore", "mall", "global", "catalog"].filter(function (k) { return l[k]; }).length;
          h += '<button type="button" class="item" data-id="' + esc(b.id) + '"' + (sel.brands === b.id ? ' aria-current="true"' : "") + '>' +
            '<span class="th" style="background:' + esc(b.tint || "#E8ECE8") + ";color:" + esc(b.ink || "#333") + '">' + esc((b.en || "").slice(0, 3)) + "</span>" +
            '<span><span class="nm">' + esc(b.ko) + ' <small style="color:var(--text-3);font-weight:500">' + esc(b.en) + '</small></span><span class="sub">제품 ' + cnt + "개 · 링크 " + nl + '/4</span><span class="tags">' + stateTag(itemState("brands", b.id, [cleanBrand(b), D.links[b.id]])) + "</span></span></button>";
        });
      });
      $("#lc").textContent = "브랜드 " + n + "개";
    } else {
      var lab = {}; IR_TYPES.forEach(function (t) { lab[t[0]] = t[1]; });
      D.ir.slice().sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")); }).forEach(function (x) {
        if (q && (x.title || "").toLowerCase().indexOf(q) < 0) return;
        n++;
        var b = brandOf(x.brand);
        h += '<button type="button" class="item" data-id="' + esc(x.id) + '"' + (sel.ir === x.id ? ' aria-current="true"' : "") + '>' +
          '<span class="th cover">' + (x.img ? '<img src="' + esc(src(x.img)) + '" alt="">' : ({ news: "NEWS", press: "PRESS", notice: "공지", ir: "IR" })[x.type] || "IR") + "</span>" +
          '<span><span class="nm">' + esc(x.title || "(제목 없음)") + '</span><span class="sub">' + esc([lab[x.type], x.source, b && b.ko, x.date].filter(Boolean).join(" · ")) + '</span><span class="tags">' + stateTag(itemState("ir", x.id, cleanIr(x))) + "</span></span></button>";
      });
      $("#lc").textContent = "글 " + n + "개";
    }
    box.innerHTML = h || '<p class="loading">없습니다.</p>';
    $$(".item", box).forEach(function (el) { el.onclick = function () { sel[tab] = el.dataset.id; editing = true; $(".split").classList.add("editing"); renderEditor(); $$(".item", box).forEach(function (o) { o.setAttribute("aria-current", String(o === el)); }); }; });
  }

  function addItem() {
    if (tab === "products") {
      var b = filt.brand || (D.brands[0] && D.brands[0].id);
      if (!b) return toast("먼저 브랜드를 만들어 주세요.", "err");
      var nums = D.products.filter(function (p) { return p.b === b; }).map(function (p) { var m = /-(\d+)$/.exec(p.id); return m ? +m[1] : 0; });
      var id = b + "-" + (Math.max.apply(null, nums.concat([0])) + 1);
      while (D.products.some(function (p) { return p.id === id; })) id += "x";
      var p = { id: id, b: b, n: "", cat: ((brandOf(b) || {}).cat || ["food"])[0], form: "box", opts: [["", null]] };
      var last = -1; D.products.forEach(function (x, i) { if (x.b === b) last = i; });
      D.products.splice(last < 0 ? D.products.length : last + 1, 0, p);
      sel.products = id;
    } else if (tab === "brands") {
      var bid = "brand" + rand();
      D.brands.push({ id: bid, ko: "", en: "", group: "own", origin: "KR", cat: ["food"], mark: "round", tint: "#E8ECE8", ink: "#2A3330", line: "", _new: true });
      D.links[bid] = { smartstore: "", mall: "", global: "", catalog: "" };
      sel.brands = bid;
    } else {
      var d = new Date(), ds = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      var xid = "post-" + ds.replace(/-/g, "") + "-" + rand();
      D.ir.push({ id: xid, date: ds, type: "news", title: "" });
      sel.ir = xid;
    }
    editing = true; render(); markChange();
    var f = $(".edit-pane input[type=text]"); if (f) f.focus();
  }

  /* ── 편집 화면 ─────────────────────────────── */
  function renderEditor() {
    var pane = $(".edit-pane"); if (!pane) return;
    var id = sel[tab];
    if (tab === "products") { var p = D.products.filter(function (x) { return x.id === id; })[0]; return p ? editProduct(pane, p) : emptyEdit(pane, "제품을 고르거나 '+ 새 제품'을 눌러 주세요.", "왼쪽 목록에서 제품을 고르면 이름, 용량·소비자가, 사진, 상세 이미지를 고칠 수 있습니다."); }
    if (tab === "brands") { var b = brandOf(id); return b ? editBrand(pane, b) : emptyEdit(pane, "브랜드를 고르거나 '+ 새 브랜드'를 눌러 주세요.", "브랜드 소개, 색, 스마트스토어·자사몰·해외 공식몰 링크, 카탈로그 PDF를 고칠 수 있습니다."); }
    var x = D.ir.filter(function (v) { return v.id === id; })[0];
    return x ? editIr(pane, x) : emptyEdit(pane, "글을 고르거나 '+ 새 글'을 눌러 주세요.", "언론 보도는 기사 주소를, 보도자료·공지는 본문을 넣으면 됩니다.");
  }
  function emptyEdit(pane, t, d) {
    pane.innerHTML = '<div class="empty-edit"><b>' + t + "</b><p>" + d + '</p><p class="help">고친 내용은 위의 <b>저장</b>을 눌러야 홈페이지에 올라갑니다. 저장하기 전에는 이 브라우저에만 있습니다.</p></div>';
  }
  function backBtn() { return '<button type="button" class="btn sm back" id="back">← 목록</button>'; }
  function wireBack(pane) { var b = $("#back", pane); if (b) b.onclick = function () { editing = false; $(".split").classList.remove("editing"); }; }
  /* data-k 입력을 객체 값에 바로 연결 */
  function bind(pane, obj, after) {
    $$("[data-k]", pane).forEach(function (el) {
      var k = el.dataset.k, ev = el.type === "checkbox" || el.tagName === "SELECT" || el.type === "color" ? "change" : "input";
      el.addEventListener(ev, function () {
        var v = el.type === "checkbox" ? el.checked : el.value;
        if (el.dataset.t === "lines") v = el.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
        if (el.dataset.t === "num") v = el.value === "" ? null : Number(el.value);
        obj[k] = v;
        if (after) after(k, el);
        markChange();
      });
    });
  }

  function editProduct(pane, p) {
    var b = brandOf(p.b) || {}, idx = D.products.indexOf(p), same = D.products.filter(function (x) { return x.b === p.b; }), pos = same.indexOf(p);
    var catOpts = Object.keys(D.cats).map(function (k) { return [k, D.cats[k]]; });
    pane.innerHTML = backBtn() +
      '<div class="ed-head"><div><h2>' + esc(p.n || "새 제품") + '</h2><p class="meta">' + esc(b.ko || "") + " · 제품 번호 " + esc(p.id) + '</p></div><div class="btns">' +
      '<button class="icon-btn" type="button" id="up" title="위로"' + (pos <= 0 ? " disabled" : "") + '>↑</button><button class="icon-btn" type="button" id="down" title="아래로"' + (pos >= same.length - 1 ? " disabled" : "") + '>↓</button>' +
      '<a class="btn sm" href="product.html#p-' + encodeURIComponent(p.id) + '" target="_blank" rel="noopener">사이트에서 보기 ↗</a><button class="btn sm danger" type="button" id="del">삭제</button></div></div>' +
      '<div class="card"><h3>기본 정보</h3><div class="grid2">' +
      '<label class="f span2"><span>제품명</span><input type="text" data-k="n" value="' + esc(p.n) + '" placeholder="예: 07 플로럴 선샤인 헤어오일"></label>' +
      '<label class="f"><span>브랜드</span><select data-k="b">' + brandOptions(p.b) + "</select></label>" +
      '<label class="f"><span>분류</span><select data-k="cat">' + opts(catOpts, p.cat) + "</select></label>" +
      '<label class="f"><span>사진이 없을 때 그림 모양</span><select data-k="form">' + opts(FORMS, p.form) + "</select></label>" +
      '<label class="f"><span>가격 옆 표시 <small>(예: 가격 확인 필요)</small></span><input type="text" data-k="check" value="' + esc(p.check || "") + '"></label>' +
      '<label class="f span2"><span>종류 <small>(향·컬러처럼 가격이 같은 종류, 한 줄에 하나)</small></span><textarea data-k="vars" data-t="lines" rows="3">' + esc((p.vars || []).join("\n")) + "</textarea></label>" +
      '<label class="f span2"><span>안내 문구 <small>(카드 아래 작은 글씨)</small></span><input type="text" data-k="note" value="' + esc(p.note || "") + '"></label>' +
      '<label class="chk span2"><input type="checkbox" data-k="top"' + (p.top ? " checked" : "") + "> 메인 화면 '대표 제품'에 보이기 <small class=\"help\">(소비자가가 있어야 보입니다)</small></label>" +
      "</div></div>" +
      '<div class="card"><h3>용량 · 소비자가 <button class="btn sm" type="button" id="addOpt">+ 줄 추가</button></h3><div class="opt-head"><span>용량·구성</span><span>소비자가(원) — 비우면 "준비 중"</span><span></span></div><div class="opts" id="opts"></div></div>' +
      '<div class="card"><h3>대표 사진</h3><div class="photo"><div class="pv' + (p.full ? " full" : "") + '" style="background:' + esc(b.tint || "#E8ECE8") + '">' + (p.img ? '<img src="' + esc(src(p.img)) + '" alt="">' : '<span class="no">사진이 없으면<br>그림 모양으로 보입니다</span>') + "</div>" +
      '<div class="ops"><div class="drop" id="dropMain">여기로 사진을 끌어 놓거나 <button class="btn sm" type="button" id="upMain">사진 고르기</button></div>' +
      '<div class="row"><label class="chk"><input type="checkbox" id="knock"> 흰 배경 지우기</label><label class="chk"><input type="checkbox" data-k="full"' + (p.full ? " checked" : "") + "> 배경 있는 사진(카드를 꽉 채움)</label></div>" +
      (p.img ? '<div class="row"><button class="btn sm danger" type="button" id="rmMain">사진 빼기</button><span class="help">' + esc(p.img) + "</span></div>" : "") +
      '<p class="help">투명 배경 PNG(누끼)가 가장 좋습니다. 긴 쪽 1000px로 줄여 올립니다.</p></div></div></div>' +
      '<div class="card"><h3>상세 이미지 <span><button class="btn sm" type="button" id="upDetail">+ 이미지 추가</button>' + ((p.detail || []).length ? ' <button class="btn sm danger" type="button" id="rmDetailAll">모두 빼기</button>' : "") + "</span></h3>" +
      '<div class="drop" id="dropDetail">상세페이지 이미지(jpg·png·gif)를 순서대로 끌어 놓으세요. 긴 이미지는 자동으로 나눠 올리고, GIF 는 움직임 그대로 올립니다.</div>' +
      '<div class="detail-list" id="dlist"></div></div>';
    wireBack(pane);
    bind(pane, p, function (k, el) {
      if (k === "n") $("h2", pane).textContent = p.n || "새 제품";
      if (k === "full") $(".pv", pane).classList.toggle("full", !!p.full);
      if (k === "b") { renderList(); }
    });
    /* 용량·가격 표 */
    function drawOpts() {
      var box = $("#opts", pane);
      box.innerHTML = (p.opts || []).map(function (o, i) {
        return '<div class="opt-row" data-i="' + i + '"><input type="text" data-f="0" value="' + esc(o[0]) + '" placeholder="예: 100ml"><input type="number" data-f="1" min="0" step="100" value="' + (o[1] == null ? "" : o[1]) + '" placeholder="준비 중">' +
          '<span class="ctl"><button class="icon-btn" type="button" data-a="up"' + (i === 0 ? " disabled" : "") + '>↑</button><button class="icon-btn" type="button" data-a="down"' + (i === p.opts.length - 1 ? " disabled" : "") + '>↓</button><button class="icon-btn" type="button" data-a="rm"' + (p.opts.length <= 1 ? " disabled" : "") + '>✕</button></span></div>';
      }).join("");
      $$(".opt-row", box).forEach(function (row) {
        var i = +row.dataset.i;
        $$("input", row).forEach(function (inp) { inp.oninput = function () { var f = +inp.dataset.f; p.opts[i][f] = f ? (inp.value === "" ? null : Number(inp.value)) : inp.value; markChange(); }; });
        $$("button", row).forEach(function (btn) {
          btn.onclick = function () {
            var a = btn.dataset.a, o = p.opts;
            if (a === "rm") o.splice(i, 1); else { var j = a === "up" ? i - 1 : i + 1; var t = o[i]; o[i] = o[j]; o[j] = t; }
            drawOpts(); markChange();
          };
        });
      });
    }
    if (!p.opts || !p.opts.length) p.opts = [["", null]];
    drawOpts();
    $("#addOpt", pane).onclick = function () { p.opts.push(["", null]); drawOpts(); markChange(); };
    /* 순서·삭제 */
    function move(dir) {
      var j = D.products.indexOf(same[pos + dir]); if (j < 0) return;
      D.products[idx] = D.products[j]; D.products[j] = p; markChange(); render();
    }
    $("#up", pane).onclick = function () { move(-1); };
    $("#down", pane).onclick = function () { move(1); };
    $("#del", pane).onclick = function () {
      if (!confirm("'" + (p.n || "새 제품") + "' 제품을 삭제할까요? (저장해야 홈페이지에 반영됩니다)")) return;
      D.products.splice(D.products.indexOf(p), 1);
      release(p.img); (p.detail || []).forEach(release);
      sel.products = null; editing = false; markChange(); render();
    };
    /* 대표 사진 */
    function setMain(files) {
      var f = files.filter(function (x) { return /^image\//.test(x.type); })[0]; if (!f) return;
      toast("사진을 줄이는 중…", "", 8000);
      mainImage(f, $("#knock", pane).checked).then(function (r) {
        var old = p.img, path = "assets/img/products/" + p.id + "-" + rand() + "." + r.ext;
        addPending(path, r.blob); p.img = path; release(old);
        toast("사진을 넣었습니다(" + Math.round(r.blob.size / 1024) + "KB). 저장해야 올라갑니다.", "ok");
        markChange(); renderEditor();
      }).catch(function (e) { toast(e.message, "err"); });
    }
    $("#upMain", pane).onclick = function () { pickFiles("image/*").then(setMain); };
    dropZone($("#dropMain", pane), setMain);
    if ($("#rmMain", pane)) $("#rmMain", pane).onclick = function () { var old = p.img; delete p.img; delete p.full; release(old); markChange(); renderEditor(); };
    /* 상세 이미지 */
    function drawDetail() {
      var box = $("#dlist", pane), d = p.detail || [];
      box.innerHTML = d.map(function (path, i) {
        return '<div class="dimg"><img src="' + esc(src(path)) + '" alt="" loading="lazy"><div class="bar"><span class="n">' + (i + 1) + '</span><span><button class="icon-btn" type="button" data-a="up" data-i="' + i + '"' + (i === 0 ? " disabled" : "") + '>↑</button><button class="icon-btn" type="button" data-a="down" data-i="' + i + '"' + (i === d.length - 1 ? " disabled" : "") + '>↓</button><button class="icon-btn" type="button" data-a="rm" data-i="' + i + '">✕</button></span></div></div>';
      }).join("") || '<p class="help">아직 상세 이미지가 없습니다. 없으면 제품 화면에 "상세 정보는 준비 중입니다"로 나옵니다.</p>';
      $$("button", box).forEach(function (btn) {
        btn.onclick = function () {
          var i = +btn.dataset.i, a = btn.dataset.a;
          if (a === "rm") { var old = d.splice(i, 1)[0]; release(old); }
          else { var j = a === "up" ? i - 1 : i + 1; var t = d[i]; d[i] = d[j]; d[j] = t; }
          if (!d.length) delete p.detail;
          markChange(); drawDetail();
        };
      });
    }
    drawDetail();
    function addDetail(files) {
      files = files.filter(function (x) { return /^image\//.test(x.type); });
      if (!files.length) return;
      toast("상세 이미지를 처리하는 중… (" + files.length + "개)", "", 60000);
      var chain = Promise.resolve(), added = 0, big = [], raw = 0;
      files.forEach(function (f, k) {
        chain = chain.then(function () {
          return detailImages(f, function (i, n) { toast("움직이는 GIF 줄이는 중… " + (k + 1) + "/" + files.length + "번째 파일, 프레임 " + i + "/" + n, "", 60000); });
        }).then(function (parts) {
          parts.forEach(function (r) {
            var path = "assets/img/detail/" + p.id + "/" + rand() + "." + r.ext;
            addPending(path, r.blob); (p.detail = p.detail || []).push(path); added++;
            if (r.raw) raw++;
            if (r.blob.size > 6 * 1024 * 1024) big.push(f.name + " " + (r.blob.size / 1048576).toFixed(1) + "MB");
          });
        });
      });
      chain.then(function () {
        var msg = "상세 이미지 " + added + "장을 넣었습니다. 저장해야 올라갑니다.";
        if (raw) msg += " (이 브라우저에서는 GIF 를 줄이지 못해 그대로 넣었습니다. 크롬에서 하면 크기가 훨씬 작아집니다.)";
        if (big.length) msg += " 큰 파일이 있어 휴대폰에서 늦게 열릴 수 있습니다: " + big.join(", ");
        toast(msg, big.length || raw ? "" : "ok", big.length || raw ? 12000 : 3200); markChange(); renderEditor();
      }).catch(function (e) { toast(e.message, "err"); });
    }
    $("#upDetail", pane).onclick = function () { pickFiles("image/*", true).then(addDetail); };
    dropZone($("#dropDetail", pane), addDetail);
    if ($("#rmDetailAll", pane)) $("#rmDetailAll", pane).onclick = function () {
      if (!confirm("상세 이미지를 모두 뺄까요?")) return;
      var d = p.detail || []; delete p.detail; d.forEach(release); markChange(); renderEditor();
    };
  }
  function dropZone(el, cb) {
    if (!el) return;
    el.addEventListener("dragover", function (e) { e.preventDefault(); el.classList.add("over"); });
    el.addEventListener("dragleave", function () { el.classList.remove("over"); });
    el.addEventListener("drop", function (e) { e.preventDefault(); el.classList.remove("over"); cb([].slice.call(e.dataTransfer.files || [])); });
  }

  function editBrand(pane, b) {
    var l = D.links[b.id] || (D.links[b.id] = { smartstore: "", mall: "", global: "", catalog: "" });
    var cnt = D.products.filter(function (p) { return p.b === b.id; }).length;
    pane.innerHTML = backBtn() +
      '<div class="ed-head"><div><h2>' + esc(b.ko || "새 브랜드") + '</h2><p class="meta">브랜드 id ' + esc(b.id) + " · 제품 " + cnt + '개</p></div><div class="btns">' +
      (cnt ? '<a class="btn sm" href="products.html#b-' + encodeURIComponent(b.id) + '" target="_blank" rel="noopener">사이트에서 보기 ↗</a>' : "") + '<button class="btn sm danger" type="button" id="del">삭제</button></div></div>' +
      '<div class="card"><h3>기본 정보</h3><div class="grid2">' +
      (b._new ? '<label class="f span2"><span>브랜드 id <small>(영문 소문자·숫자, 주소에 쓰입니다. 저장 후에는 바꾸지 않는 것이 좋습니다)</small></span><input type="text" id="bid" value="' + esc(b.id) + '"></label>' : "") +
      '<label class="f"><span>한글 이름</span><input type="text" data-k="ko" value="' + esc(b.ko) + '"></label>' +
      '<label class="f"><span>영문 이름 <small>(로고 글자로 보입니다)</small></span><input type="text" data-k="en" value="' + esc(b.en) + '"></label>' +
      '<label class="f"><span>구분</span><select data-k="group">' + opts(GROUPS, b.group) + "</select></label>" +
      '<label class="f"><span>원산지</span><select data-k="origin">' + opts(ORIGINS, b.origin) + "</select></label>" +
      '<label class="f span2"><span>한 줄 소개</span><textarea data-k="line" rows="2">' + esc(b.line || "") + "</textarea></label>" +
      '<div class="f span2"><span class="f-label">분류</span><div class="cats">' + Object.keys(D.cats).map(function (k) { return '<label class="chk"><input type="checkbox" data-cat="' + k + '"' + ((b.cat || []).indexOf(k) > -1 ? " checked" : "") + "> " + esc(D.cats[k]) + "</label>"; }).join("") + "</div></div>" +
      "</div></div>" +
      '<div class="card"><h3>로고 글자 · 색</h3><div class="grid2"><label class="f"><span>글꼴</span><select data-k="mark">' + opts(MARKS, b.mark) + '</select></label><div class="colors"><label><input type="color" data-k="tint" value="' + esc(b.tint || "#E8ECE8") + '"> 바탕색</label><label><input type="color" data-k="ink" value="' + esc(b.ink || "#2A3330") + '"> 글자색</label></div></div>' +
      '<div class="bprev" id="bprev"></div></div>' +
      '<div class="card"><h3>구매처 · 카탈로그</h3><div class="grid2">' +
      '<label class="f span2"><span>네이버 스마트스토어</span><input type="url" data-l="smartstore" value="' + esc(l.smartstore) + '" placeholder="https://smartstore.naver.com/..."></label>' +
      '<label class="f span2"><span>자사몰</span><input type="url" data-l="mall" value="' + esc(l.mall) + '" placeholder="https://"></label>' +
      '<label class="f span2"><span>해외 공식몰 <small>(원산지가 한국이 아닌 브랜드만 버튼이 보입니다)</small></span><input type="url" data-l="global" value="' + esc(l.global) + '" placeholder="https://"></label>' +
      '<label class="f span2"><span>브랜드 카탈로그 <small>(PDF를 올리거나 공유 링크를 적어 주세요)</small></span><input type="text" data-l="catalog" value="' + esc(l.catalog) + '" placeholder="assets/catalog/... 또는 https://"></label>' +
      '<div class="span2" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" type="button" id="upPdf">PDF 올리기</button>' + (l.catalog ? '<button class="btn sm danger" type="button" id="rmPdf">카탈로그 빼기</button>' : "") + "</div>" +
      "</div></div>";
    wireBack(pane);
    function prev() {
      $("#bprev", pane).style.cssText = "background:" + (b.tint || "#E8ECE8") + ";color:" + (b.ink || "#2A3330");
      $("#bprev", pane).innerHTML = '<span class="wm ' + esc(b.mark || "") + '">' + esc(b.en || "Brand") + '</span><span style="font-size:13px;opacity:.75">' + esc(b.line || "") + "</span>";
    }
    prev();
    bind(pane, b, function (k) { if (k === "ko") $("h2", pane).textContent = b.ko || "새 브랜드"; prev(); renderList(); });
    $$("[data-cat]", pane).forEach(function (c) { c.onchange = function () { b.cat = $$("[data-cat]", pane).filter(function (x) { return x.checked; }).map(function (x) { return x.dataset.cat; }); markChange(); }; });
    $$("[data-l]", pane).forEach(function (inp) { inp.oninput = function () { var old = l[inp.dataset.l]; l[inp.dataset.l] = inp.value.trim(); if (inp.dataset.l === "catalog") release(old); markChange(); }; });
    if ($("#bid", pane)) $("#bid", pane).onchange = function () {
      var v = this.value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!v) { this.value = b.id; return toast("영문 소문자·숫자로 적어 주세요.", "err"); }
      if (v !== b.id && brandOf(v)) { this.value = b.id; return toast("같은 id 의 브랜드가 이미 있습니다.", "err"); }
      D.links[v] = D.links[b.id]; delete D.links[b.id];
      D.products.forEach(function (p) { if (p.b === b.id) p.b = v; });
      D.ir.forEach(function (x) { if (x.brand === b.id) x.brand = v; });
      b.id = v; sel.brands = v; this.value = v; markChange(); renderList();
    };
    $("#upPdf", pane).onclick = function () {
      pickFiles("application/pdf").then(function (fs) {
        var f = fs[0]; if (!f) return;
        if (f.size > 40 * 1024 * 1024) return toast("40MB보다 큰 PDF는 올릴 수 없습니다. 줄여서 올리거나 공유 링크를 적어 주세요.", "err", 6000);
        var path = "assets/catalog/" + b.id + "-" + rand() + ".pdf", old = l.catalog;
        addPending(path, f); l.catalog = path; release(old); markChange(); renderEditor();
        toast("카탈로그를 넣었습니다. 저장해야 올라갑니다.", "ok");
      });
    };
    if ($("#rmPdf", pane)) $("#rmPdf", pane).onclick = function () { var old = l.catalog; l.catalog = ""; release(old); markChange(); renderEditor(); };
    $("#del", pane).onclick = function () {
      if (cnt) return toast("이 브랜드의 제품 " + cnt + "개를 먼저 지우거나 다른 브랜드로 옮겨 주세요.", "err", 5000);
      if (!confirm("'" + (b.ko || b.id) + "' 브랜드를 삭제할까요?")) return;
      D.brands.splice(D.brands.indexOf(b), 1); var old = (D.links[b.id] || {}).catalog; delete D.links[b.id]; release(old);
      sel.brands = null; editing = false; markChange(); render();
    };
  }

  function editIr(pane, x) {
    pane.innerHTML = backBtn() +
      '<div class="ed-head"><div><h2>' + esc(x.title || "새 글") + '</h2><p class="meta">글 번호 ' + esc(x.id) + '</p></div><div class="btns"><a class="btn sm" href="ir.html' + (x.body && !x.url ? "#post-" + encodeURIComponent(x.id) : "") + '" target="_blank" rel="noopener">사이트에서 보기 ↗</a><button class="btn sm danger" type="button" id="del">삭제</button></div></div>' +
      '<div class="card"><h3>기본 정보</h3><div class="grid2">' +
      '<label class="f"><span>분류</span><select data-k="type">' + opts(IR_TYPES, x.type) + "</select></label>" +
      '<label class="f"><span>날짜 <small>(정렬에만 쓰고 화면에는 안 보입니다)</small></span><input type="date" data-k="date" value="' + esc(x.date || "") + '"></label>' +
      '<label class="f span2"><span>제목</span><input type="text" data-k="title" value="' + esc(x.title || "") + '"></label>' +
      '<label class="f"><span>매체명 <small>(언론 보도일 때)</small></span><input type="text" data-k="source" value="' + esc(x.source || "") + '"></label>' +
      '<label class="f"><span>관련 브랜드 <small>(사진이 없을 때 썸네일)</small></span><select data-k="brand">' + brandOptions(x.brand, true) + "</select></label>" +
      '<label class="f span2"><span>기사 주소 <small>(있으면 누를 때 새 창으로 기사가 열립니다)</small></span><input type="url" data-k="url" value="' + esc(x.url || "") + '" placeholder="https://"></label>' +
      '<label class="f span2"><span>요약 <small>(목록에 보이는 두세 줄)</small></span><textarea data-k="summary" rows="3">' + esc(x.summary || "") + "</textarea></label>" +
      "</div></div>" +
      '<div class="card"><h3>대표 이미지</h3><div class="photo"><div class="pv full" style="background:var(--paper-2)">' + (x.img ? '<img src="' + esc(src(x.img)) + '" alt="">' : '<span class="no">없으면 브랜드 이름이<br>썸네일로 보입니다</span>') + '</div><div class="ops"><div class="drop" id="dropIr">이미지를 끌어 놓거나 <button class="btn sm" type="button" id="upIr">사진 고르기</button></div>' + (x.img ? '<div class="row"><button class="btn sm danger" type="button" id="rmIr">이미지 빼기</button></div>' : "") + "</div></div></div>" +
      '<div class="card"><h3>본문 <small class="help">(보도자료·공지처럼 사이트 안에서 보여 줄 글. 빈 줄로 문단을 나누고, "## "로 시작하면 소제목)</small></h3><textarea class="tall" data-k="body">' + esc(x.body || "") + "</textarea></div>" +
      '<div class="card"><h3>내려받을 자료</h3><div class="row" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button class="btn sm" type="button" id="upFile">파일 올리기</button>' + (x.file ? '<span class="help">' + esc(x.file) + '</span><button class="btn sm danger" type="button" id="rmFile">빼기</button>' : '<span class="help">PDF 등 IR 자료·보도자료 원문</span>') + "</div></div>";
    wireBack(pane);
    bind(pane, x, function (k) { if (k === "title") $("h2", pane).textContent = x.title || "새 글"; if (k === "date" || k === "title" || k === "brand" || k === "type") renderList(); });
    function setImg(files) {
      var f = files.filter(function (v) { return /^image\//.test(v.type); })[0]; if (!f) return;
      photoImage(f, 1400).then(function (r) { var old = x.img, path = "assets/img/ir/" + x.id + "-" + rand() + "." + r.ext; addPending(path, r.blob); x.img = path; release(old); markChange(); renderEditor(); toast("이미지를 넣었습니다. 저장해야 올라갑니다.", "ok"); }).catch(function (e) { toast(e.message, "err"); });
    }
    $("#upIr", pane).onclick = function () { pickFiles("image/*").then(setImg); };
    dropZone($("#dropIr", pane), setImg);
    if ($("#rmIr", pane)) $("#rmIr", pane).onclick = function () { var old = x.img; delete x.img; release(old); markChange(); renderEditor(); };
    $("#upFile", pane).onclick = function () {
      pickFiles("*/*").then(function (fs) {
        var f = fs[0]; if (!f) return;
        if (f.size > 40 * 1024 * 1024) return toast("40MB보다 큰 파일은 올릴 수 없습니다.", "err");
        var ext = (/\.([a-z0-9]+)$/i.exec(f.name) || [, "pdf"])[1].toLowerCase(), path = "assets/ir/" + x.id + "-" + safeName(f.name) + "." + ext, old = x.file;
        addPending(path, f); x.file = path; release(old); markChange(); renderEditor();
      });
    };
    if ($("#rmFile", pane)) $("#rmFile", pane).onclick = function () { var old = x.file; delete x.file; release(old); markChange(); renderEditor(); };
    $("#del", pane).onclick = function () {
      if (!confirm("이 글을 삭제할까요?")) return;
      D.ir.splice(D.ir.indexOf(x), 1); release(x.img); release(x.file);
      sel.ir = null; editing = false; markChange(); render();
    };
  }

  /* ── 연결 · 설정 ─────────────────────────────── */
  function renderSettings() {
    app.innerHTML = '<div class="settings"><h2>연결 · 설정</h2><p class="lead">관리자 화면은 홈페이지 파일이 있는 GitHub 저장소에 바로 저장합니다. 이 컴퓨터(브라우저)에서 한 번만 연결해 두면 됩니다.</p>' +
      '<div class="card"><h3>저장소</h3><div class="grid2">' +
      '<label class="f"><span>계정(owner)</span><input type="text" id="cOwner" value="' + esc(cfg.owner) + '"></label>' +
      '<label class="f"><span>저장소(repo)</span><input type="text" id="cRepo" value="' + esc(cfg.repo) + '"></label>' +
      '<label class="f"><span>브랜치 <small>(홈페이지가 올라가는 브랜치)</small></span><input type="text" id="cBranch" value="' + esc(cfg.branch) + '"></label>' +
      '<label class="f"><span>사이트 폴더</span><input type="text" id="cRoot" value="' + esc(cfg.root) + '"></label>' +
      '<label class="f span2"><span>GitHub 토큰 <small>(이 브라우저에만 저장됩니다)</small></span><input type="password" id="cToken" value="' + esc(cfg.token) + '" autocomplete="off" placeholder="github_pat_..."></label>' +
      '</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" type="button" id="cSave">연결하고 불러오기</button><button class="btn" type="button" id="cTest">연결 확인만</button>' + (cfg.token ? '<button class="btn danger" type="button" id="cForget">이 브라우저에서 토큰 지우기</button>' : "") + '</div><p class="status-line" id="cStatus">' + (connected() ? "연결 정보가 있습니다. 불러온 곳: " + esc(loadedFrom || "-") : "아직 연결하지 않았습니다. 지금은 둘러보기만 할 수 있고 저장되지 않습니다.") + "</p></div>" +
      '<div class="card"><h3>토큰 만드는 법 (처음 한 번)</h3><ol class="steps">' +
      "<li>GitHub에 로그인 → 오른쪽 위 프로필 → <b>Settings</b> → 맨 아래 <b>Developer settings</b> → <b>Personal access tokens</b> → <b>Fine-grained tokens</b> → <b>Generate new token</b></li>" +
      "<li>Repository access: <b>Only select repositories</b> → <b>" + esc(cfg.owner + "/" + cfg.repo) + "</b> 하나만 고르기</li>" +
      "<li>Permissions → Repository permissions → <b>Contents: Read and write</b> (나머지는 그대로)</li>" +
      "<li>만료 기간을 정하고 만들기 → 나온 토큰(github_pat_…)을 위 칸에 붙여 넣고 <b>연결하고 불러오기</b></li></ol>" +
      '<p class="help">토큰은 비밀번호와 같습니다. 다른 사람과 공유하지 말고, 공용 컴퓨터에서는 다 쓴 뒤 \'토큰 지우기\'를 눌러 주세요.</p></div>' +
      '<div class="card"><h3>홈페이지에 반영되는 방식</h3><ol class="steps"><li>여기서 <b>저장</b>을 누르면 바뀐 파일(제품·브랜드·IR 데이터, 올린 사진)이 저장소에 커밋 한 번으로 올라갑니다.</li>' +
      "<li>홈페이지 호스팅(예: Cloudflare Pages)이 이 저장소·브랜치에 연결되어 있으면 1~2분 뒤 자동으로 반영됩니다.</li>" +
      "<li>호스팅 연결 전에는 저장소에만 쌓이고, 연결하는 순간 최신 내용으로 올라갑니다.</li></ol></div></div>";
    function read() { cfg.owner = $("#cOwner").value.trim(); cfg.repo = $("#cRepo").value.trim(); cfg.branch = $("#cBranch").value.trim() || "main"; cfg.root = $("#cRoot").value.trim(); cfg.token = $("#cToken").value.trim(); }
    function test() {
      var st = $("#cStatus"); st.className = "status-line"; st.textContent = "확인 중…";
      return Promise.all([gh("GET", REPO()), gh("GET", REPO() + "/branches/" + encPath(cfg.branch))]).then(function (r) {
        /* 이 브랜치·폴더에 홈페이지 파일이 있는지 */
        return gh("GET", REPO() + "/contents/" + encPath(rp(FILES.data)) + "?ref=" + encodeURIComponent(cfg.branch), null, true).then(function () { return r; }, function (e) {
          if (e.status === 404) { var er = new Error("nosite"); er.nosite = true; throw er; }
          throw e;
        });
      }).then(function (r) {
        var push = r[0].permissions && r[0].permissions.push;
        st.className = "status-line " + (push ? "ok" : "err");
        st.textContent = push ? "연결되었습니다: " + r[0].full_name + " · " + cfg.branch + " (저장 가능)" : "저장소는 보이지만 쓰기 권한이 없습니다. 토큰 권한(Contents: Read and write)을 확인해 주세요.";
        return push;
      }).catch(function (e) {
        st.className = "status-line err";
        st.textContent = e.nosite ? "'" + cfg.branch + "' 브랜치의 '" + (cfg.root || "(맨 위)") + "' 폴더에 홈페이지 파일(" + FILES.data + ")이 없습니다. 홈페이지가 올라가 있는 브랜치 이름과 사이트 폴더를 확인해 주세요."
          : e.status === 401 ? "토큰이 맞지 않거나 만료되었습니다." : e.status === 404 ? "저장소나 브랜치를 찾을 수 없습니다(토큰에 이 저장소 권한이 있는지 확인)." : "연결하지 못했습니다: " + e.message;
        return false;
      });
    }
    $("#cTest").onclick = function () { read(); test(); };
    $("#cSave").onclick = function () {
      read();
      test().then(function (ok) {
        if (!ok) return;
        if (D && changes().count && !confirm("저장하지 않은 고친 내용이 있습니다. 저장소에서 새로 불러오면 사라집니다. 계속할까요?")) return;
        saveCfg(); updateConn(); setTab("products"); load();
      });
    };
    if ($("#cForget")) $("#cForget").onclick = function () { cfg.token = ""; saveCfg(); updateConn(); renderSettings(); toast("이 브라우저에서 토큰을 지웠습니다."); };
  }

  /* ── 저장 ─────────────────────────────── */
  function validate() {
    var errs = [];
    D.products.forEach(function (p) {
      if (!p.n || !p.n.trim()) errs.push("이름이 없는 제품이 있습니다(" + p.id + ").");
      if (!brandOf(p.b)) errs.push("'" + p.n + "' 제품의 브랜드가 없습니다.");
      if (!(p.opts || []).some(function (o) { return String(o[0] || "").trim(); })) errs.push("'" + (p.n || p.id) + "' 제품의 용량·구성을 한 줄 이상 적어 주세요.");
    });
    D.brands.forEach(function (b) { if (!b.ko || !b.en) errs.push("브랜드 '" + (b.ko || b.id) + "'의 한글·영문 이름을 적어 주세요."); });
    D.ir.forEach(function (x) { if (!x.title) errs.push("제목이 없는 IR 글이 있습니다."); });
    return errs;
  }
  function b64(blob) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result).split(",")[1]); }; r.onerror = rej; r.readAsDataURL(blob); });
  }
  function openSave() {
    var ch = changes();
    if (!ch.count) return;
    var errs = validate();
    var sm = summary();
    var bg = document.createElement("div"); bg.className = "modal-bg";
    var msg = "관리자 화면: " + (sm.join(", ") || "파일 변경");
    bg.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-label="저장"><h3>' + (connected() ? "홈페이지에 저장" : "저장하려면 연결이 필요합니다") + "</h3>" +
      '<ul class="changes">' + sm.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") +
      (ch.uploads.length ? "<li>새 파일 " + ch.uploads.length + "개 올림</li>" : "") + (ch.deletes.length ? "<li>안 쓰게 된 파일 " + ch.deletes.length + "개 지움</li>" : "") + "</ul>" +
      (errs.length ? '<p class="status-line err">' + errs.map(esc).join("<br>") + "</p>" : "") +
      (connected() ? '<label class="f"><span>저장 메모</span><input type="text" id="mMsg" value="' + esc(msg) + '"></label><div class="progress" hidden><i></i></div>'
        : '<p class="help">연결 · 설정 탭에서 GitHub 저장소를 연결하면 바로 저장할 수 있습니다. 지금은 바뀐 데이터 파일만 내려받을 수 있습니다(새로 넣은 사진은 포함되지 않습니다).</p>') +
      '<div class="btns"><button class="btn" type="button" id="mCancel">취소</button>' +
      (connected() ? '<button class="btn primary" type="button" id="mGo"' + (errs.length ? " disabled" : "") + ">저장</button>" : '<button class="btn" type="button" id="mDl">데이터 파일 내려받기</button><button class="btn primary" type="button" id="mConn">연결하러 가기</button>') + "</div></div>";
    document.body.appendChild(bg);
    function close() { bg.remove(); }
    $("#mCancel", bg).onclick = close;
    bg.addEventListener("click", function (e) { if (e.target === bg) close(); });
    if ($("#mConn", bg)) $("#mConn", bg).onclick = function () { close(); setTab("settings"); };
    if ($("#mDl", bg)) $("#mDl", bg).onclick = function () {
      ch.files.forEach(function (f) { var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([f.text], { type: "text/javascript" })); a.download = f.path.split("/").pop(); a.click(); });
    };
    if ($("#mGo", bg)) $("#mGo", bg).onclick = function () {
      var btn = this; btn.disabled = true; $("#mCancel", bg).disabled = true;
      var bar = $(".progress", bg); bar.hidden = false;
      commit(ch, $("#mMsg", bg).value.trim() || msg, function (r) { $("i", bar).style.width = Math.round(r * 100) + "%"; }).then(function () {
        close(); toast("저장했습니다. 1~2분 뒤 홈페이지에 반영됩니다. 바로 안 보이면 잠시 뒤 새로고침해 주세요.", "ok", 8000);
      }).catch(function (e) {
        btn.disabled = false; $("#mCancel", bg).disabled = false;
        toast(e.cancel ? e.message : "저장하지 못했습니다: " + e.message, e.cancel ? "" : "err", 8000);
      });
    };
  }
  function commit(ch, message, progress) {
    var base, tree = [], total = ch.files.length + ch.uploads.length + 3, done = 0;
    function step() { done++; progress(done / total); }
    return gh("GET", REPO() + "/git/ref/heads/" + encPath(cfg.branch)).then(function (r) {
      base = r.object.sha;
      if (headSha && base !== headSha && !confirm("이 화면을 연 뒤에 다른 곳에서 먼저 저장된 내용이 있습니다.\n그대로 저장하면 그 사이 바뀐 제품·브랜드·IR 내용을 덮어쓸 수 있습니다.\n\n취소를 누르면 저장하지 않습니다(새로 불러온 뒤 다시 고치는 것을 권합니다). 그대로 저장할까요?")) { var ce = new Error("저장을 취소했습니다."); ce.cancel = true; throw ce; }
      return gh("GET", REPO() + "/git/commits/" + base);
    }).then(function (c) {
      step();
      var chain = Promise.resolve();
      ch.files.forEach(function (f) {
        chain = chain.then(function () { return gh("POST", REPO() + "/git/blobs", { content: f.text, encoding: "utf-8" }); })
          .then(function (b) { tree.push({ path: rp(f.path), mode: "100644", type: "blob", sha: b.sha }); step(); });
      });
      ch.uploads.forEach(function (p) {
        chain = chain.then(function () { return b64(pending[p].blob); }).then(function (data) { return gh("POST", REPO() + "/git/blobs", { content: data, encoding: "base64" }); })
          .then(function (b) { tree.push({ path: rp(p), mode: "100644", type: "blob", sha: b.sha }); step(); });
      });
      ch.deletes.forEach(function (p) { tree.push({ path: rp(p), mode: "100644", type: "blob", sha: null }); });
      return chain.then(function () { return gh("POST", REPO() + "/git/trees", { base_tree: c.tree.sha, tree: tree }); });
    }).then(function (t) {
      step();
      return gh("POST", REPO() + "/git/commits", { message: message, tree: t.sha, parents: [base] });
    }).then(function (c) {
      return gh("PATCH", REPO() + "/git/refs/heads/" + encPath(cfg.branch), { sha: c.sha }).then(function () { return c; });
    }).then(function (c) {
      step();
      headSha = c.sha;
      ch.uploads.forEach(function (p) { fresh[p] = pending[p].url; delete pending[p]; });
      removals = {};
      if (ch.files.some(function (f) { return f.path === FILES.media; })) mediaHad = false;
      D.brands.forEach(function (b) { delete b._new; });
      snapshot(); markChange(); render();
    });
  }

  /* ── 시작 ─────────────────────────────── */
  $$(".tabs button").forEach(function (b) { b.onclick = function () { setTab(b.dataset.tab); }; });
  $("#saveBtn").onclick = openSave;
  addEventListener("beforeunload", function (e) { if (D && changes().count) { e.preventDefault(); e.returnValue = ""; } });
  window.IBRAdmin = { state: function () { return { D: D, cfg: cfg, pending: pending, removals: removals, changes: changes() }; } };
  updateConn();
  load();
})();
