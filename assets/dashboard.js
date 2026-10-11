/*
  dashboard.js — a "global electricity prices" dashboard for the home.
  From data/energy-prices.json it renders summary stat tiles (cheapest, priciest,
  world average, your country) and a big sorted horizontal bar chart of all
  countries (US$/kWh for a fair comparison). Bars are interactive: hover shows a
  tooltip (local price + retailer count), click loads that country into the hero
  calculator. Cheapest/priciest and your own country are highlighted.

  CSP-safe: external file, same-origin fetch. Home only (needs #dashboard).
*/
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  var mount = document.getElementById('dashboard');
  if (!mount) return;
  var isEs = (document.documentElement.lang || 'en').toLowerCase().indexOf('es') === 0;
  var base = mount.getAttribute('data-base') || '';
  var sel = document.querySelector('[data-country] .country-select');

  var T = isEs ? {
    cheapest: 'Más barato', priciest: 'Más caro', avg: 'Media mundial', mine: 'Tu país',
    unit: 'US$/kWh', retailers: 'compañías', sub: 'Precio residencial típico, en US$/kWh para comparar. Toca un país para cargarlo en la calculadora.',
    perkwh: 'por kWh', avgLine: 'la línea marca la media mundial'
  } : {
    cheapest: 'Cheapest', priciest: 'Most expensive', avg: 'World average', mine: 'Your country',
    unit: 'US$/kWh', retailers: 'retailers', sub: 'Typical residential price, in US$/kWh for comparison. Tap a country to load it into the calculator.',
    perkwh: 'per kWh', avgLine: 'the line marks the world average'
  };

  function flagSrc(code) { return base + 'assets/img/flags/' + code.toLowerCase() + '.svg'; }
  function cName(c) { return isEs ? c.name_es : c.name; }
  // Fixed decimals, comma in Spanish, yen whole — same as energy-prices.js and
  // tools/generate-prices.mjs, so the tooltip agrees with the prices page.
  function localLabel(c) {
    var s = Number(c.price).toFixed(c.currency === 'JPY' ? 0 : 2);
    if (isEs) s = s.replace('.', ',');
    return c.pos === 'pre' ? c.symbol + s : s + ' ' + c.symbol;
  }
  function usd(v) { return isEs ? v.toFixed(2).replace('.', ',') + ' $' : '$' + v.toFixed(2); }
  function el(t, cls, html) { var e = document.createElement(t); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  fetch(base + 'data/energy-prices.json', { credentials: 'same-origin' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      if (!j || !j.countries) { mount.hidden = true; return; }
      var data = j.countries.slice().sort(function (a, b) { return a.usd - b.usd; });
      var maxUsd = data[data.length - 1].usd, minUsd = data[0].usd;
      var avg = data.reduce(function (s, c) { return s + c.usd; }, 0) / data.length;
      var cheapest = data[0], priciest = data[data.length - 1];
      // energy-prices.js owns the current country and publishes it on <html>.
      // Reading localStorage here instead was a second opinion on the same
      // question: whichever of the two fetches resolved first won, and the
      // dashboard could open showing a different country from the calculator.
      var stored = document.documentElement.getAttribute('data-wf-country');
      if (!stored) { try { stored = localStorage.getItem('wf-country'); } catch (e) {} }
      var mineCode = stored || (isEs ? 'ES' : 'US');
      var mine = data.filter(function (c) { return c.code === mineCode; })[0] || data[0];

      // ── stat tiles ──
      var stats = el('div', 'dash-stats');
      function tileHtml(label, c, val) {
        return '<span class="ds-label">' + label + '</span>'
          + '<span class="ds-main"><img class="flag" src="' + flagSrc(c.code) + '" alt="" width="24" height="16"><b>' + cName(c) + '</b></span>'
          + '<span class="ds-val">' + val + ' <small>' + T.unit + '</small></span>';
      }
      function statTile(label, c, val, kind) {
        var t = el('button', 'dash-stat' + (kind ? ' is-' + kind : ''));
        t.type = 'button'; t.setAttribute('data-code', c.code);
        t.innerHTML = tileHtml(label, c, val);
        // Read the code off the element, not off the closure: the "your
        // country" tile is rewritten whenever the country changes.
        t.addEventListener('click', function () { load(t.getAttribute('data-code')); });
        return t;
      }
      stats.appendChild(statTile(T.cheapest, cheapest, usd(cheapest.usd), 'good'));
      stats.appendChild(statTile(T.priciest, priciest, usd(priciest.usd), 'bad'));
      var avgTile = el('div', 'dash-stat');
      avgTile.innerHTML = '<span class="ds-label">' + T.avg + '</span><span class="ds-main"><b>' + data.length + ' ' + (isEs ? 'países' : 'countries') + '</b></span><span class="ds-val">' + usd(avg) + ' <small>' + T.unit + '</small></span>';
      stats.appendChild(avgTile);
      var mineTile = statTile(T.mine, mine, usd(mine.usd), 'mine');
      stats.appendChild(mineTile);

      // ── bar chart ──
      var chart = el('div', 'dash-chart');
      // Position the reference line at the world average (bars are scaled to
      // the most expensive country, so the same % works for every row).
      chart.style.setProperty('--avg', (avg / maxUsd * 100).toFixed(1) + '%');
      var tip = el('div', 'dash-tip'); tip.hidden = true;
      data.forEach(function (c) {
        var row = el('button', 'dash-row'); row.type = 'button'; row.setAttribute('data-code', c.code);
        if (c.code === cheapest.code) row.classList.add('is-good');
        if (c.code === priciest.code) row.classList.add('is-bad');
        // No is-mine here. It used to be stamped on at render and never taken
        // off, so changing country left two rows marked at once: the old one
        // still is-mine, the new one is-active. showCountry() is the only thing
        // that marks a row now.
        var w = Math.max(3, c.usd / maxUsd * 100);
        row.innerHTML =
          '<img class="flag" src="' + flagSrc(c.code) + '" alt="" width="24" height="16">' +
          '<span class="dr-name">' + cName(c) + '</span>' +
          '<span class="dr-track"><span class="dr-fill" style="width:' + w.toFixed(1) + '%"></span></span>' +
          '<span class="dr-val">' + usd(c.usd) + '</span>';
        row.addEventListener('click', function () { load(c.code); });
        row.addEventListener('pointerenter', function () { showTip(c, row); });
        row.addEventListener('pointerleave', function () { tip.hidden = true; });
        chart.appendChild(row);
      });
      chart.appendChild(tip);

      function showTip(c, row) {
        var prov = c.providers ? (' · ' + c.providers.length + ' ' + T.retailers) : '';
        tip.innerHTML = '<b>' + cName(c) + '</b><br>' + localLabel(c) + '/kWh · ' + usd(c.usd) + ' ' + T.unit + prov;
        tip.hidden = false;
        var cr = chart.getBoundingClientRect(), rr = row.getBoundingClientRect();
        tip.style.top = (rr.top - cr.top - 6) + 'px';
        tip.style.left = Math.min(rr.width - 220, rr.left - cr.left + 60) + 'px';
      }

      function load(code) {
        if (sel) { sel.value = code; sel.dispatchEvent(new Event('change', { bubbles: true })); }
        try { document.dispatchEvent(new CustomEvent('wf:country', { detail: { code: code } })); } catch (e) {}
        showCountry(code);
        var hero = document.querySelector('.wf-hero');
        if (hero && hero.scrollIntoView) hero.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      // One country is current, so one row is marked and the "your country"
      // tile shows that country. The tile used to be built once and never
      // touched, which is how it ended up naming a different country from the
      // one selected in the calculator right above it.
      function showCountry(code) {
        var c = data.filter(function (x) { return x.code === code; })[0];
        if (!c) return;
        chart.querySelectorAll('.dash-row').forEach(function (r) { r.classList.toggle('is-active', r.getAttribute('data-code') === code); });
        mineTile.setAttribute('data-code', c.code);
        mineTile.innerHTML = tileHtml(T.mine, c, usd(c.usd));
      }

      mount.innerHTML = '';
      var sub = el('p', 'dash-sub', T.sub + ' — ' + T.avgLine + ' (' + usd(avg) + ').');
      mount.appendChild(stats); mount.appendChild(sub); mount.appendChild(chart);
      document.addEventListener('wf:country', function (e) { if (e.detail && e.detail.code) showCountry(e.detail.code); });
      // Whoever finished loading first has already written the answer on <html>;
      // read it rather than repeat the guess made before the fetch.
      showCountry(document.documentElement.getAttribute('data-wf-country') || mine.code);
    })
    .catch(function () { mount.hidden = true; });
})();
