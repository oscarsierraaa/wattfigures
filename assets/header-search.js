/*
  header-search.js — site-wide type-ahead in the header. Not a modal: you type
  in the bar and matching appliances, calculators and guides drop down under it
  with their key figures. Arrow keys move, Enter opens, Esc closes.

  Markup contract (injected on every page):
    <div class="hdr-search" data-hdr-search data-src="/data/search-index.json" role="search">
      <input class="hs-input" type="search" role="combobox" aria-controls="hs-panel" …>
      <div class="hs-panel" id="hs-panel" role="listbox" hidden></div>
    </div>

  Index: { en: [...], es: [...] } with { k(kind), t(title), u(url), s(spec), c(category) }.
  CSP-safe: external file, same-origin fetch. Without JS the bar simply does nothing.
*/
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  var root = document.querySelector('[data-hdr-search]');
  if (!root) return;
  var input = root.querySelector('.hs-input');
  var panel = root.querySelector('.hs-panel');
  if (!input || !panel) return;

  var isEs = (document.documentElement.lang || 'en').toLowerCase().indexOf('es') === 0;
  var src = root.getAttribute('data-src') || '/data/search-index.json';
  var LIMIT = 8;
  var KIND = isEs
    ? { appliance: 'Aparato', calculator: 'Calculadora', guide: 'Guía', tool: 'Herramienta' }
    : { appliance: 'Appliance', calculator: 'Calculator', guide: 'Guide', tool: 'Tool' };
  var T = isEs
    ? { none: 'Sin resultados', hint: 'Sugerencias', all: 'Ver todos los aparatos →' }
    : { none: 'No matches', hint: 'Suggestions', all: 'Browse all appliances →' };

  var data = null, view = [], active = -1, open = false;

  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function mark(text, q) {
    if (!q) return esc(text);
    var i = norm(text).indexOf(q);
    if (i < 0) return esc(text);
    return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
  }

  function render(q) {
    panel.innerHTML = '';
    if (!view.length) {
      panel.innerHTML = '<p class="hs-none">' + T.none + '</p>';
      return;
    }
    var frag = document.createDocumentFragment();
    view.forEach(function (it, i) {
      var a = document.createElement('a');
      a.className = 'hs-item' + (i === active ? ' is-active' : '');
      a.href = it.u; a.setAttribute('role', 'option');
      a.setAttribute('aria-selected', i === active ? 'true' : 'false');
      a.innerHTML = '<span class="hs-kind hs-' + it.k + '">' + KIND[it.k] + '</span>'
        + '<span class="hs-t">' + mark(it.t, q) + '</span>'
        + (it.s ? '<span class="hs-s">' + esc(it.s) + '</span>' : '');
      a.addEventListener('pointerenter', function () { active = i; paint(); });
      frag.appendChild(a);
    });
    panel.appendChild(frag);
  }

  function paint() {
    panel.querySelectorAll('.hs-item').forEach(function (el, i) {
      el.classList.toggle('is-active', i === active);
      el.setAttribute('aria-selected', i === active ? 'true' : 'false');
    });
    var cur = panel.querySelector('.hs-item.is-active');
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
  }

  function show() { if (!open) { panel.hidden = false; open = true; input.setAttribute('aria-expanded', 'true'); } }
  function hide() { if (open) { panel.hidden = true; open = false; input.setAttribute('aria-expanded', 'false'); active = -1; } }

  function run() {
    if (!data) return;
    var raw = input.value.trim(), q = norm(raw);
    if (!q) { hide(); return; }
    view = data.filter(function (it) {
      return norm(it.t).indexOf(q) >= 0 || norm(it.s).indexOf(q) >= 0 || norm(it.c || '').indexOf(q) >= 0;
    }).sort(function (x, y) {
      // title-prefix matches first, then appliances (most searched), then rest
      var px = norm(x.t).indexOf(q) === 0 ? 0 : 1, py = norm(y.t).indexOf(q) === 0 ? 0 : 1;
      if (px !== py) return px - py;
      var kx = x.k === 'appliance' ? 0 : 1, ky = y.k === 'appliance' ? 0 : 1;
      if (kx !== ky) return kx - ky;
      return (y.kwh || 0) - (x.kwh || 0);
    }).slice(0, LIMIT);
    active = view.length ? 0 : -1;
    render(q); show();
  }

  input.addEventListener('input', run);
  input.addEventListener('focus', function () { if (input.value.trim()) run(); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { hide(); input.blur(); return; }
    if (!open || !view.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % view.length; paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + view.length) % view.length; paint(); }
    else if (e.key === 'Enter') { var it = view[active]; if (it) { e.preventDefault(); location.href = it.u; } }
  });
  document.addEventListener('click', function (e) { if (!root.contains(e.target)) hide(); });

  fetch(src, { credentials: 'same-origin' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      if (!j) return;
      data = (isEs ? j.es : j.en) || j.en || [];
      root.classList.add('is-ready');
    })
    .catch(function () { /* no index → the bar stays inert */ });
})();
