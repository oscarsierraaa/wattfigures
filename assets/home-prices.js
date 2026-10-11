/*
  home-prices.js — interactive "electricity prices around the world" board for the
  home hero. Renders a ranked list of countries (flag + USD-comparable price + bar)
  from data/energy-prices.json; clicking one loads that country into the quick-cost
  calculator (via the country <select> that energy-prices.js manages). Highlights
  the current country and reacts to the `wf:country` event energy-prices.js emits.

  CSP-safe: external file, same-origin fetch, no inline handlers. Home only.
*/
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  var board = document.getElementById('price-board');
  if (!board) return;
  var isEs = (document.documentElement.lang || 'en').toLowerCase().indexOf('es') === 0;
  var base = board.getAttribute('data-base') || '';
  var moreHref = board.getAttribute('data-prices-href') || (base + 'electricity-prices/');
  var sel = document.querySelector('[data-country] .country-select');

  var T = isEs
    ? { title: 'Precios de la luz por el mundo', sub: 'En US$/kWh para comparar · toca un país para cargarlo', more: 'Comparativa completa de 23 países →' }
    : { title: 'Electricity prices around the world', sub: 'In US$/kWh to compare · tap a country to load it', more: 'Full comparison of 23 countries →' };

  fetch(base + 'data/energy-prices.json', { credentials: 'same-origin' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      if (!j || !j.countries) { board.hidden = true; return; }
      var data = j.countries.slice().sort(function (a, b) { return a.usd - b.usd; });
      var maxUsd = data.reduce(function (m, c) { return Math.max(m, c.usd); }, 0) || 1;

      var head = document.createElement('p'); head.className = 'pb-head';
      head.innerHTML = '<svg class="est-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18"/></svg>' + T.title;
      var sub = document.createElement('p'); sub.className = 'pb-sub'; sub.textContent = T.sub;
      // Plain div, no role="list": its children are <button>s, not listitem-
      // role elements, and role="list" requires them — invalid ARIA parent/
      // child pairing (Lighthouse, 01-08-2026). A button group needs no list
      // role of its own to be announced correctly.
      var list = document.createElement('div'); list.className = 'pb-list';

      data.forEach(function (c) {
        var row = document.createElement('button');
        row.type = 'button'; row.className = 'pb-row'; row.setAttribute('data-code', c.code);
        row.setAttribute('aria-label', (isEs ? c.name_es : c.name) + ' — US$' + c.usd.toFixed(2) + '/kWh');
        row.innerHTML =
          '<img class="flag" src="' + base + 'assets/img/flags/' + c.code.toLowerCase() + '.svg" alt="" width="24" height="16">' +
          '<span class="pb-mid"><span class="pb-name">' + (isEs ? c.name_es : c.name) + '</span>' +
          '<span class="pb-track"><span class="pb-fill" style="width:' + Math.max(6, c.usd / maxUsd * 100).toFixed(1) + '%"></span></span></span>' +
          '<span class="pb-price">$' + c.usd.toFixed(2) + '</span>';
        row.addEventListener('click', function () {
          if (!sel) return;
          sel.value = c.code;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          highlight(c.code);
        });
        list.appendChild(row);
      });

      var foot = document.createElement('p'); foot.className = 'pb-foot';
      foot.innerHTML = '<a class="wf-more" href="' + moreHref + '">' + T.more + '</a>';

      board.innerHTML = '';
      board.appendChild(head); board.appendChild(sub); board.appendChild(list); board.appendChild(foot);

      function highlight(code) {
        list.querySelectorAll('.pb-row').forEach(function (r) {
          r.classList.toggle('is-active', r.getAttribute('data-code') === code);
        });
      }
      document.addEventListener('wf:country', function (e) { if (e.detail && e.detail.code) highlight(e.detail.code); });
      // energy-prices.js may have emitted before this listener existed — the
      // three widgets on the home each fetch this file separately and resolve
      // in whatever order the network decides. It leaves the answer on <html>.
      highlight(document.documentElement.getAttribute('data-wf-country') || (sel && sel.value) || '');
    })
    .catch(function () { board.hidden = true; });
})();
