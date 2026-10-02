/* IBR IR · 소식: assets/js/ibr-ir-data.js 의 글을 분류별 목록으로 보여 주고, ir.html#post-아이디 로 글 하나를 엽니다. */
(function () {
  "use strict";
  var IBR = window.IBR || {};
  var TYPES = [["", "전체"], ["news", "언론 보도"], ["press", "보도자료"], ["notice", "공지"], ["ir", "IR 자료"]];
  var LABEL = { news: "언론 보도", press: "보도자료", notice: "공지", ir: "IR 자료" };
  var PAGE = 12;
  /* 날짜 표시: 지금은 끔(정렬에는 계속 씁니다). 보이게 하려면 true 로 바꿉니다. */
  var SHOW_DATE = false;
  var OUT = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 9l6-6M4 3h5v5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
  var DL = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1v7M3 5l3 3 3-3M1.5 10.5h9" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
  var state = { type: "", shown: PAGE };
  function $(s) { return document.querySelector(s); }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmt(d) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || ""); return m ? m[1] + ". " + m[2] + ". " + m[3] : esc(d); }
  var ALL = (window.IBR_IR || []).filter(function (x) { return x && x.title; }).slice().sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")); });
  ALL.forEach(function (x, i) { if (!x.id) x.id = "n" + (i + 1); });

  function href(x) { return x.url ? x.url : x.body ? "#post-" + encodeURIComponent(x.id) : x.file || ""; }
  function action(x) { return x.url ? "기사 보기" + OUT : x.body ? "자세히 " + (IBR.ARROW || "") : x.file ? "자료 받기" + DL : ""; }
  var BR = {}; (window.IBR_BRANDS || []).forEach(function (b) { BR[b.id] = b; });
  function meta(x) { var b = BR[x.brand]; return '<p class="ir-meta"><span class="tp tp-' + esc(x.type) + '">' + (LABEL[x.type] || "소식") + "</span>" + (SHOW_DATE && x.date ? "<time datetime=\"" + esc(x.date) + "\">" + fmt(x.date) + "</time>" : "") + (x.source ? "<span>" + esc(x.source) + "</span>" : "") + (b ? '<span class="br">' + esc(b.ko) + "</span>" : "") + "</p>"; }
  /* 사진이 없는 글은 브랜드 이름(없으면 IBR)을 썸네일로 씁니다 */
  function thumb(x) {
    if (x.img) return '<div class="ir-thumb"><img src="' + esc(x.img) + '" alt="" loading="lazy" decoding="async"></div>';
    var b = BR[x.brand];
    if (b) return '<div class="ir-thumb" style="background:' + b.tint + ";color:" + b.ink + '"><span class="wm ' + (b.mark || "") + '">' + esc(b.en) + "</span></div>";
    return '<div class="ir-thumb ibr"><span>IBR</span><small>' + (LABEL[x.type] || "News") + "</small></div>";
  }

  function card(x) {
    var h = href(x), ext = !!x.url, el = document.createElement(h ? "a" : "article");
    el.className = "ir-card" + (x.img ? " has-img" : "");
    if (h) { el.href = h; if (ext) { el.target = "_blank"; el.rel = "noopener"; } if (!x.url && !x.body && x.file) el.setAttribute("download", ""); }
    el.innerHTML =
      thumb(x) +
      '<div class="ir-body">' + meta(x) + "<h2>" + esc(x.title) + "</h2>" + (x.summary ? "<p class=\"sum\">" + esc(x.summary) + "</p>" : "") +
      (h ? '<span class="go">' + action(x) + "</span>" : "") + "</div>";
    return el;
  }

  function list() {
    var tabs = $("#irTabs"), box = $("#irList"), more = $("#irMore"), empty = $("#irEmpty");
    tabs.innerHTML = "";
    TYPES.forEach(function (t) {
      var n = ALL.filter(function (x) { return !t[0] || x.type === t[0]; }).length;
      if (t[0] && !n) return;
      var b = document.createElement("button");
      b.type = "button"; b.className = "tab"; b.setAttribute("aria-pressed", String(state.type === t[0]));
      b.innerHTML = t[1] + ' <span class="c">' + n + "</span>";
      b.addEventListener("click", function () { state.type = t[0]; state.shown = PAGE; list(); });
      tabs.appendChild(b);
    });
    tabs.hidden = ALL.length === 0;
    var items = ALL.filter(function (x) { return !state.type || x.type === state.type; });
    box.innerHTML = "";
    items.slice(0, state.shown).forEach(function (x) { box.appendChild(card(x)); });
    more.hidden = items.length <= state.shown;
    empty.hidden = items.length > 0;
  }

  function post(id) {
    var x = ALL.filter(function (p) { return p.id === id; })[0], box = $("#irPost");
    if (!x) return false;
    var i = ALL.indexOf(x), prev = ALL[i + 1], next = ALL[i - 1];
    var body = String(x.body || "").split(/\n\s*\n/).map(function (para) {
      para = para.trim(); if (!para) return "";
      if (/^##\s+/.test(para)) return "<h3>" + esc(para.replace(/^##\s+/, "")) + "</h3>";
      return "<p>" + esc(para).replace(/\n/g, "<br>") + "</p>";
    }).join("");
    box.innerHTML =
      '<a class="ir-back" href="#">← 목록으로</a>' + meta(x) + "<h1>" + esc(x.title) + "</h1>" +
      (x.img ? '<figure><img src="' + esc(x.img) + '" alt=""></figure>' : "") +
      '<div class="ir-text">' + body + "</div>" +
      ((x.url || x.file) ? '<div class="ir-acts">' + (x.url ? '<a class="bf-btn" href="' + esc(x.url) + '" target="_blank" rel="noopener">원문 기사 보기' + OUT + "</a>" : "") +
        (x.file ? '<a class="bf-btn catalog" href="' + esc(x.file) + '" download>자료 내려받기' + DL + "</a>" : "") + "</div>" : "") +
      '<nav class="ir-pn" aria-label="다른 글">' + (prev ? '<a href="' + esc(href(prev)) + '"' + (prev.url ? ' target="_blank" rel="noopener"' : "") + "><small>이전 글</small>" + esc(prev.title) + "</a>" : "<span></span>") +
      (next ? '<a class="nx" href="' + esc(href(next)) + '"' + (next.url ? ' target="_blank" rel="noopener"' : "") + "><small>다음 글</small>" + esc(next.title) + "</a>" : "<span></span>") + "</nav>";
    return true;
  }

  function route() {
    var m = /^#post-(.+)$/.exec(location.hash), open = m && post(decodeURIComponent(m[1]));
    $("#irPost").hidden = !open; $("#irListView").hidden = !!open;
    if (open) window.scrollTo(0, Math.max(0, $("#irPost").getBoundingClientRect().top + scrollY - 110));
  }

  document.addEventListener("DOMContentLoaded", function () {
    $("#irMore").addEventListener("click", function () { state.shown += PAGE; list(); });
    list(); route();
    addEventListener("hashchange", route);
  });
})();
