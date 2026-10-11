/*
  appliance-search.js — the appliance finder that lives on the page (no modal).
  Type and you immediately get matching appliances plus a live PREVIEW of the
  highlighted one: typical power, yearly kWh and what that costs at your
  country's price — the answer without leaving the page.

  Markup contract (the two-pane panel + preview are built here):
    <div data-appliance-search data-src="data/appliance-index.json"
         data-base="appliances/" data-prices="data/energy-prices.json"
         data-empty="No matches — browse all appliances">
      <div class="as-inputwrap"><input class="as-input" type="search"></div>
      <ul class="as-results" id="as-results" role="listbox"></ul>
      <p class="as-status" aria-live="polite"></p>
      <div class="as-popular"> …static links, still work without JS… </div>
    </div>

  Index entries: { slug, name, name_es, category, cat, cat_es, watts,
                   cycleKwh, alwaysOn, kwh }.
  CSP-safe: external file, same-origin fetch. Degrades to the static links.
*/
(function () {
  'use strict';
  if (typeof document === 'undefined') return;

  function boot(root) {
    var input = root.querySelector('.as-input');
    var list = root.querySelector('.as-results');
    var status = root.querySelector('.as-status');
    if (!input || !list) return;

    var src = root.getAttribute('data-src') || 'data/appliance-index.json';
    var base = root.getAttribute('data-base') || 'appliances/';
    var pricesSrc = root.getAttribute('data-prices') || src.replace(/appliance-index\.json$/, 'energy-prices.json');
    var emptyMsg = root.getAttribute('data-empty') || 'No matches.';
    var isEs = (document.documentElement.lang || 'en').toLowerCase().indexOf('es') === 0;
    var LIMIT = 6;

    var T = isEs ? {
      top: 'Los que más gastan', results: 'Resultados', perYear: 'al año', power: 'Potencia',
      use: 'Consumo', cycle: 'por ciclo', always: 'siempre encendido',
      open: 'Ver desglose completo', at: 'a', yr: 'año'
    } : {
      top: 'Biggest energy users', results: 'Results', perYear: 'per year', power: 'Power',
      use: 'Uses', cycle: 'per cycle', always: 'always on',
      open: 'See full breakdown', at: 'at', yr: 'yr'
    };

    var data = null, country = null, view = [], active = 0;

    // Two-pane panel: results list + live preview. The heading and "no
    // matches" message live as list SIBLINGS, not <li>s inside it — a
    // role="listbox" only accepts option-role children, so a plain <li>
    // heading or empty-state row failed the ARIA required-children check
    // (Lighthouse, 01-08-2026). aria-labelledby carries the heading instead.
    var panel = document.createElement('div'); panel.className = 'as-panel';
    var listWrap = document.createElement('div');
    var head = document.createElement('p'); head.className = 'as-head'; head.id = 'as-head-' + Math.random().toString(36).slice(2);
    var none = document.createElement('p'); none.className = 'as-none'; none.hidden = true;
    var preview = document.createElement('div'); preview.className = 'as-preview';
    list.parentNode.insertBefore(panel, list);
    listWrap.appendChild(head); listWrap.appendChild(list); listWrap.appendChild(none);
    panel.appendChild(listWrap); panel.appendChild(preview);
    list.setAttribute('aria-labelledby', head.id);

    function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
    function nf(v) { try { return new Intl.NumberFormat(isEs ? 'es' : 'en', { maximumFractionDigits: 0 }).format(v); } catch (e) { return String(Math.round(v)); } }
    function money(n) {
      if (!country) return null;
      var s = nf(Math.round(n));
      return country.pos === 'pre' ? country.symbol + s : s + ' ' + country.symbol;
    }
    function label(a) { return (isEs && a.name_es) || a.name; }
    function catOf(a) { return (isEs ? a.cat_es : a.cat) || ''; }
    function specOf(a) {
      if (a.cycleKwh) return a.cycleKwh + ' kWh ' + T.cycle;
      if (a.watts) return a.watts + ' W' + (a.alwaysOn ? ' · ' + T.always : '');
      return '';
    }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

    function renderList(items, heading) {
      list.innerHTML = '';
      head.textContent = heading;
      if (!items.length) {
        none.textContent = emptyMsg; none.hidden = false;
        preview.innerHTML = ''; return;
      }
      none.hidden = true;
      items.forEach(function (a, i) {
        var li = document.createElement('li');
        li.className = 'as-item' + (i === active ? ' is-active' : '');
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', i === active ? 'true' : 'false');
        var cost = money(a.kwh * (country ? country.price : 0));
        li.innerHTML = '<a href="' + base + a.slug + '/">'
          + '<span class="as-chip">' + esc(catOf(a)) + '</span>'
          + '<span class="as-name">' + esc(label(a)) + '</span>'
          + '<span class="as-spec">' + esc(specOf(a)) + '</span>'
          + (cost ? '<span class="as-cost">' + esc(cost) + '</span>' : '') + '</a>';
        li.addEventListener('pointerenter', function () { active = i; paint(); });
        list.appendChild(li);
      });
      renderPreview(items[Math.min(active, items.length - 1)]);
    }

    function renderPreview(a) {
      if (!a) { preview.innerHTML = ''; return; }
      var cost = money(a.kwh * (country ? country.price : 0));
      var note = country
        ? T.at + ' ' + (country.pos === 'pre' ? country.symbol + country.price : country.price + ' ' + country.symbol) + '/kWh · ' + esc(isEs ? country.name_es : country.name)
        : '';
      preview.innerHTML =
        '<span class="ap-chip">' + esc(catOf(a)) + '</span>' +
        '<h3 class="ap-name">' + esc(label(a)) + '</h3>' +
        (cost ? '<div class="ap-cost">' + esc(cost) + '<small>/' + T.yr + '</small></div>' : '') +
        (note ? '<p class="ap-note">' + note + '</p>' : '') +
        '<dl class="ap-specs">' +
          '<div><dt>' + T.power + '</dt><dd>' + esc(specOf(a) || '—') + '</dd></div>' +
          '<div><dt>' + T.use + '</dt><dd>' + nf(a.kwh) + ' kWh ' + T.perYear + '</dd></div>' +
        '</dl>' +
        '<a class="btn btn-primary ap-cta" href="' + base + a.slug + '/">' + T.open + ' →</a>';
    }

    function paint() {
      list.querySelectorAll('.as-item').forEach(function (li, i) {
        li.classList.toggle('is-active', i === active);
        li.setAttribute('aria-selected', i === active ? 'true' : 'false');
      });
      renderPreview(view[active]);
    }

    function run() {
      if (!data) return;
      var q = norm(input.value.trim());
      if (!q) {
        view = data.slice().sort(function (x, y) { return y.kwh - x.kwh; }).slice(0, LIMIT);
        active = 0; renderList(view, T.top);
        if (status) status.textContent = '';
        return;
      }
      view = data.filter(function (a) {
        return norm(a.name).indexOf(q) >= 0 || norm(a.name_es).indexOf(q) >= 0
          || norm(a.cat).indexOf(q) >= 0 || norm(a.cat_es).indexOf(q) >= 0;
      }).sort(function (x, y) {
        var px = norm(label(x)).indexOf(q) === 0 ? 0 : 1, py = norm(label(y)).indexOf(q) === 0 ? 0 : 1;
        return px - py || y.kwh - x.kwh;
      }).slice(0, LIMIT);
      active = 0; renderList(view, T.results);
      if (status) status.textContent = view.length + ' ' + T.results;
    }

    input.addEventListener('input', run);
    input.addEventListener('keydown', function (e) {
      if (!view.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % view.length; paint(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + view.length) % view.length; paint(); }
      else if (e.key === 'Enter') { var a = view[active]; if (a) { e.preventDefault(); location.href = base + a.slug + '/'; } }
    });

    // Country price (shared with the calculators) so the preview shows real money.
    function loadPrices() {
      return fetch(pricesSrc, { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (!j || !j.countries) return;
          var stored = null; try { stored = localStorage.getItem('wf-country'); } catch (e) {}
          var code = stored || (isEs ? 'ES' : 'US');
          country = j.countries.filter(function (c) { return c.code === code; })[0] || j.countries[0];
        })
        .catch(function () {});
    }

    Promise.all([
      fetch(src, { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
      loadPrices()
    ]).then(function (res) {
      var json = res[0];
      data = Array.isArray(json) ? json : (json && json.appliances) || null;
      if (!data || !data.length) return;     // keep the static popular links
      root.classList.add('is-live');
      run();
    });

    document.addEventListener('wf:country', function () { loadPrices().then(run); });
  }

  function init() { document.querySelectorAll('[data-appliance-search]').forEach(boot); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
