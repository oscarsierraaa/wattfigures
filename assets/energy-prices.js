/*
  energy-prices.js — country + provider price context for the calculators.
  Replaces the plain country <select> with a searchable flag picker (same one used
  on the estimator), fills a provider/tariff <select> + brand chips when the
  country has known retailers, and on any change sets the electricity-price
  input(s), switches the currency on money outputs, recomputes, and remembers the
  country (localStorage) so it carries across pages. Emits a `wf:country` event so
  the home price board can stay in sync.

  Markup contract:
    <span class="calc-inputwrap" data-country data-prices-src="…/energy-prices.json">
      <select class="country-select"></select>   (kept as the hidden value holder)
    </span>
    <label data-provider-field hidden>… <select class="provider-select"></select></label>
    <input data-calc-var="price" data-country-price>
    <span class="unit" data-cur-unit>$/kWh</span>
    <output data-calc-out="…" data-money>

  CSP-safe: external file, same-origin fetch. Degrades to the native select if JS
  or the data file is unavailable.
*/
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  var LS = 'wf-country';
  var root = document.querySelector('[data-country]');
  if (!root) return;
  var sel = root.querySelector('.country-select');
  if (!sel) return;
  var src = root.getAttribute('data-prices-src') || 'data/energy-prices.json';
  var flagBase = src.replace(/data\/energy-prices\.json.*$/, 'assets/img/flags/');
  var isEs = (document.documentElement.lang || 'en').toLowerCase().indexOf('es') === 0;
  var provField = document.querySelector('[data-provider-field]');
  var provSel = provField ? provField.querySelector('.provider-select') : null;
  var current = null, DATA = null;

  function flagSrc(code) { return flagBase + code.toLowerCase() + '.svg'; }
  // Same formatting as tools/generate-prices.mjs, which labels these same
  // prices on /electricity-prices/: fixed decimals so a list of them lines up
  // (the raw JSON gives 0.4 next to 0.39), a comma in Spanish, and the yen
  // whole because it has no sub-unit.
  function priceLabel(c, price) {
    var s = Number(price).toFixed(c.currency === 'JPY' ? 0 : 2);
    if (isEs) s = s.replace('.', ',');
    return c.pos === 'pre' ? c.symbol + s : s + ' ' + c.symbol;
  }
  function cName(c) { return isEs ? c.name_es : c.name; }

  // ── Brand-tinted monogram badges (our own colour+initials marks) ──────────
  var BRAND = {
    'Iberdrola': '#7ab648', 'Endesa': '#003b7a', 'Naturgy': '#ff5a1f', 'Repsol': '#f56a00',
    'TotalEnergies': '#ed1c24', 'Octopus Energy': '#e6007e', 'British Gas': '#0396d6',
    'EDF Energy': '#ff7a00', 'EDF': '#ff7a00', 'E.ON Next': '#e2001a', 'E.ON': '#e2001a',
    'OVO Energy': '#0a9e4a', 'Electric Ireland': '#e4002b', 'Bord Gáis Energy': '#00a4b4',
    'SSE Airtricity': '#00b5e2', 'Vattenfall': '#2071b5', 'EnBW': '#ec6608', 'Yello': '#ffcc00',
    'Engie': '#0aa2e0', 'Engie Electrabel': '#0aa2e0', 'Enel Energia': '#00a1e0',
    'Eni Plenitude': '#f9c000', 'A2A': '#009640', 'EDP': '#57b947', 'Galp': '#ef7d00',
    'Eneco': '#e6320f', 'Essent': '#e30613', 'Luminus': '#e2001a', 'Duke Energy': '#00789e',
    'Florida Power & Light': '#0072ce', 'Con Edison': '#f47216', 'PG&E': '#0055a5',
    'Hydro-Québec': '#009ee0', 'BC Hydro': '#005a9c', 'Toronto Hydro': '#0083c1',
    'AGL': '#005baa', 'Origin Energy': '#ed1c24', 'EnergyAustralia': '#e6a800'
  };
  function brandColor(name) {
    if (BRAND[name]) return BRAND[name];
    var h = 0; for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    return 'hsl(' + h + ' 55% 45%)';
  }
  function monogram(name) { return name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase(); }
  // WCAG relative luminance + contrast ratio, not a rough luma cutoff: the old
  // 0.299R+0.587G+0.114B > 150 heuristic put white text on Con Edison's
  // #f47216 at a 2.9:1 contrast ratio — well under the 4.5:1 small-text
  // minimum (Lighthouse, 01-08-2026). This picks whichever of black/white
  // actually contrasts more against the real background.
  function relLuminance(r, g, b) {
    function ch(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
  }
  function contrastRatio(l1, l2) {
    var a = Math.max(l1, l2), b = Math.min(l1, l2);
    return (a + 0.05) / (b + 0.05);
  }
  function textOn(hex) {
    if (hex.charAt(0) !== '#') return '#fff';
    var r = parseInt(hex.substr(1, 2), 16), g = parseInt(hex.substr(3, 2), 16), b = parseInt(hex.substr(5, 2), 16);
    var bgL = relLuminance(r, g, b);
    return contrastRatio(bgL, 1) >= contrastRatio(bgL, 0) ? '#fff' : '#111';
  }
  function badge(name) {
    var col = brandColor(name);
    return '<span class="brand-badge" style="background:' + col + ';color:' + textOn(col) + '">' + monogram(name) + '</span>';
  }

  // ── Currency + price wiring ───────────────────────────────────────────────
  function setCurrency(c) {
    document.querySelectorAll('[data-cur-unit]').forEach(function (u) { u.textContent = c.symbol + '/kWh'; });
    document.querySelectorAll('[data-money]').forEach(function (o) {
      if (c.pos === 'pre') { o.setAttribute('data-calc-prefix', c.symbol); o.setAttribute('data-calc-suffix', ''); }
      else { o.setAttribute('data-calc-prefix', ''); o.setAttribute('data-calc-suffix', ' ' + c.symbol); }
      o.setAttribute('data-calc-format', 'locale');
    });
  }
  function setPrice(price) {
    document.querySelectorAll('[data-country-price]').forEach(function (inp) { inp.value = price; });
    var any = document.querySelector('[data-calc-var]');
    if (any) any.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // ── Provider chips + select ───────────────────────────────────────────────
  var provChips = null;
  function ensureChips() {
    if (provChips || !provField) return provChips;
    provChips = document.createElement('div');
    provChips.className = 'prov-chips'; provChips.hidden = true;
    provChips.setAttribute('aria-label', isEs ? 'Compañías eléctricas' : 'Energy retailers');
    if (provField.parentNode) provField.parentNode.insertBefore(provChips, provField.nextSibling);
    return provChips;
  }
  function highlightChips(v) {
    if (!provChips) return;
    provChips.querySelectorAll('.prov-chip').forEach(function (ch) {
      ch.classList.toggle('is-active', ch.getAttribute('data-v') === String(v));
    });
  }
  function applyProvider(v) {
    if (!current) return;
    if (v === '__avg') setPrice(current.price);
    else { var p = current.providers[parseInt(v, 10)]; if (p) setPrice(p.price); }
    if (provSel) provSel.value = v;
    highlightChips(v);
  }
  function fillProviders(c) {
    if (!provField || !provSel) return;
    var chips = ensureChips();
    provSel.innerHTML = '';
    if (chips) chips.innerHTML = '';
    if (!c.providers || !c.providers.length) { provField.hidden = true; if (chips) chips.hidden = true; return; }
    provField.hidden = false; if (chips) chips.hidden = false;
    var avg = document.createElement('option');
    avg.value = '__avg'; avg.textContent = (isEs ? 'Media del país' : 'Country average') + ' — ' + priceLabel(c, c.price);
    provSel.appendChild(avg);
    c.providers.forEach(function (p, i) {
      var o = document.createElement('option'); o.value = String(i);
      o.textContent = p.name + ' — ' + priceLabel(c, p.price); provSel.appendChild(o);
    });
    if (chips) {
      var avgChip = document.createElement('button');
      avgChip.type = 'button'; avgChip.className = 'prov-chip is-active'; avgChip.setAttribute('data-v', '__avg');
      avgChip.innerHTML = '<span class="brand-badge" style="background:hsl(var(--muted));color:#fff">Ø</span><span>'
        + (isEs ? 'Media' : 'Average') + '</span> <span class="pc-price">' + priceLabel(c, c.price) + '</span>';
      avgChip.addEventListener('click', function () { applyProvider('__avg'); });
      chips.appendChild(avgChip);
      c.providers.forEach(function (p, i) {
        var ch = document.createElement('button');
        ch.type = 'button'; ch.className = 'prov-chip'; ch.setAttribute('data-v', String(i));
        ch.innerHTML = badge(p.name) + '<span>' + p.name + '</span> <span class="pc-price">' + priceLabel(c, p.price) + '</span>';
        ch.addEventListener('click', (function (idx) { return function () { applyProvider(String(idx)); }; })(i));
        chips.appendChild(ch);
      });
    }
  }

  // The event only reaches whoever is already listening, and the home page has
  // three widgets that each fetch this same file before they attach a listener.
  // Whichever resolved last used to miss the event and fall back to its own
  // guess, so the board, the dashboard and the calculator could open on
  // different countries. Writing it on <html> as well leaves a copy for the
  // latecomers: the event is the change, the attribute is the state.
  function publishCountry(c) { try { document.documentElement.setAttribute('data-wf-country', c.code); } catch (e) {} }

  /* The home's stat strip used to carry a price typed into the HTML: "0,25 €
     — precio típico del kWh en España", sitting two blocks under a country
     selector that could say United States. Wrong on both counts, since Spain
     had moved to 0,27. It reads the same data as everything else now. */
  // "in United States" and "en Países Bajos" are the two ways this sentence
  // goes wrong once the country stops being fixed. Short list, correct copy.
  //
  // Second copy of the ARTICLE table in tools/generate-country-pages.mjs — the
  // browser cannot import from tools/, so they are kept in step by hand. They
  // were not: this one had no Spanish article for the US or the UK, so the home
  // strip read "en Estados Unidos" while the country page read "en los Estados
  // Unidos" for the same country. If you edit one table, edit the other.
  var ARTICLE = { en: { US: 'the ', GB: 'the ', NL: 'the ' }, es: { US: 'los ', GB: 'el ', NL: 'los ' } };
  function inCountry(c) { return ((ARTICLE[isEs ? 'es' : 'en'][c.code]) || '') + cName(c); }

  function fillPriceTile(c) {
    var v = document.querySelector('[data-price-tile]');
    var l = document.querySelector('[data-price-tile-label]');
    if (v) v.textContent = priceLabel(c, c.price);
    if (l) l.textContent = isEs
      ? 'precio típico del kWh en ' + inCountry(c) + ' — cámbialo por tu tarifa'
      : 'typical price per kWh in ' + inCountry(c) + ' — change it to your own tariff';
  }

  function emitCountry(c) {
    publishCountry(c);
    fillPriceTile(c);
    try { document.dispatchEvent(new CustomEvent('wf:country', { detail: { code: c.code } })); } catch (e) {}
  }
  function selectCountry(c) {
    current = c;
    setCurrency(c); fillProviders(c); setPrice(c.price);
    if (sel) sel.value = c.code;
    updateBtn(c);
    try { localStorage.setItem(LS, c.code); } catch (e) {}
    emitCountry(c);
  }

  // ── Searchable flag picker (replaces the visible native <select>) ──────────
  var btn = null, panel = null;
  function updateBtn(c) {
    if (!btn) return;
    btn.innerHTML = '<img class="flag" src="' + flagSrc(c.code) + '" alt="" width="24" height="16">'
      + '<span class="cp-name">' + cName(c) + '</span>'
      + '<span class="cp-price">' + priceLabel(c, c.price) + '/kWh</span>'
      + '<svg class="cp-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  }
  function buildPicker() {
    sel.hidden = true; sel.setAttribute('tabindex', '-1'); sel.setAttribute('aria-hidden', 'true');
    var pick = document.createElement('div'); pick.className = 'country-picker';
    btn = document.createElement('button'); btn.type = 'button'; btn.className = 'cp-btn';
    btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', isEs ? 'País' : 'Country');
    panel = document.createElement('div'); panel.className = 'cp-panel'; panel.hidden = true;
    var search = document.createElement('input'); search.type = 'search'; search.className = 'cp-search';
    search.placeholder = isEs ? 'Buscar país…' : 'Search country…'; search.setAttribute('aria-label', isEs ? 'Buscar país' : 'Search country');
    var list = document.createElement('div'); list.className = 'cp-list'; list.setAttribute('role', 'listbox');
    panel.appendChild(search); panel.appendChild(list);
    pick.appendChild(btn); pick.appendChild(panel);
    root.appendChild(pick);

    function renderList(f) {
      list.innerHTML = ''; f = (f || '').toLowerCase().trim(); var any = false;
      DATA.forEach(function (c) {
        var nm = cName(c);
        if (f && nm.toLowerCase().indexOf(f) < 0 && c.code.toLowerCase().indexOf(f) < 0) return;
        any = true;
        var o = document.createElement('button'); o.type = 'button'; o.className = 'cp-opt'; o.setAttribute('role', 'option');
        if (current && c.code === current.code) o.setAttribute('aria-selected', 'true');
        o.innerHTML = '<img class="flag" src="' + flagSrc(c.code) + '" alt="" width="24" height="16">'
          + '<span class="cp-name">' + nm + '</span><span class="cp-price">' + priceLabel(c, c.price) + '/kWh</span>';
        o.addEventListener('click', function () { close(); selectCountry(c); });
        list.appendChild(o);
      });
      if (!any) list.appendChild(Object.assign(document.createElement('div'), { className: 'cp-empty', textContent: isEs ? 'Sin resultados' : 'No matches' }));
    }
    function onDoc(e) { if (!pick.contains(e.target)) close(); }
    function open() { panel.hidden = false; btn.setAttribute('aria-expanded', 'true'); renderList(''); search.value = ''; setTimeout(function () { search.focus(); document.addEventListener('click', onDoc); }, 0); }
    function close() { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); document.removeEventListener('click', onDoc); }
    btn.addEventListener('click', function () { panel.hidden ? open() : close(); });
    search.addEventListener('input', function () { renderList(search.value); });
    search.addEventListener('keydown', function (e) { if (e.key === 'Escape') { close(); btn.focus(); } });
  }

  // ── Boot ─────────────────────────────────────────────────────────────────
  fetch(src, { credentials: 'same-origin' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      if (!j || !j.countries) return;
      DATA = j.countries;
      // keep the native select populated as a hidden value holder / fallback
      DATA.forEach(function (c) {
        var o = document.createElement('option'); o.value = c.code;
        o.textContent = cName(c) + ' — ' + priceLabel(c, c.price) + '/kWh';
        sel.appendChild(o);
      });
      buildPicker();
      var stored = null; try { stored = localStorage.getItem(LS); } catch (e) {}
      var def = stored || (isEs ? 'ES' : 'US');
      var start = DATA.filter(function (c) { return c.code === def; })[0] || DATA[0];
      var shared = location.search.length > 1;
      if (start) {
        if (shared) { current = start; setCurrency(start); fillProviders(start); updateBtn(start); if (sel) sel.value = start.code; emitCountry(start); }
        else selectCountry(start);
      }
      if (provSel) provSel.addEventListener('change', function () { applyProvider(provSel.value); });
      // The home price board and dashboard load a country by setting this hidden
      // select's value and firing 'change'. Listen for it so those clicks drive
      // the calculator (currency, price, picker label) and re-emit wf:country to
      // keep every visual in sync. Guard on code so it's a no-op when unchanged
      // (and no loop: selectCountry sets sel.value without dispatching 'change').
      sel.addEventListener('change', function () {
        var code = sel.value;
        if (current && current.code === code) return;
        var c = DATA.filter(function (x) { return x.code === code; })[0];
        if (c) selectCountry(c);
      });
    })
    .catch(function () { /* no prices file → native select stays usable */ });
})();
