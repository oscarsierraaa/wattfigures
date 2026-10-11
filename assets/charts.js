/*
  charts.js — live, CSP-safe SVG charts for the calculators. Reads raw computed
  values that calc.js writes to output elements (data-value) and redraws on the
  'calc:updated' event, so every chart tracks the inputs in real time.

  Widgets (declarative):
    <figure class="wf-chart" data-chart="projection" data-src="#perYearOutputId"
            data-years="10" data-caption="Cumulative cost over 10 years"></figure>
    <div data-chart="compare" data-a="#outA" data-b="#outB"
         data-labels="Heat pump|Gas boiler"></div>
    <p class="equiv" data-equiv data-src="#perYearOutputId"></p>

  Colours come from --chart-1/--chart-2 (theme-aware, validated). Every data mark
  is directly labelled, so identity never rests on colour alone.
*/
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  var reduce = matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lang = document.documentElement.lang || 'en';
  var isEs = lang.toLowerCase().indexOf('es') === 0;

  function raw(el) { var v = el && el.dataset ? parseFloat(el.dataset.value) : NaN; return isFinite(v) ? v : NaN; }
  function root(el) { return el.closest ? el.closest('[data-calc]') : null; }
  function nf(v, d) { try { return new Intl.NumberFormat(lang, { maximumFractionDigits: d, minimumFractionDigits: d }).format(v); } catch (e) { return v.toFixed(d); } }
  function money(srcEl, val, d) {
    if (!isFinite(val)) return '–';
    var pre = (srcEl && srcEl.getAttribute('data-calc-prefix')) || '';
    var suf = (srcEl && srcEl.getAttribute('data-calc-suffix')) || '';
    var s = Math.abs(val) >= 1e6
      ? (function () { try { return new Intl.NumberFormat(lang, { notation: 'compact', maximumFractionDigits: 1 }).format(val); } catch (e) { return String(Math.round(val)); } })()
      : nf(val, d || 0);
    return pre + s + suf;
  }
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  // ── Projection: cumulative cost over N years (area + line + markers) ────────
  function projection(box) {
    var src = document.querySelector(box.getAttribute('data-src'));
    if (!src) return;
    var years = parseInt(box.getAttribute('data-years') || '10', 10);
    var caption = box.getAttribute('data-caption') || (isEs ? 'Coste acumulado en ' + years + ' años' : 'Cumulative cost over ' + years + ' years');
    var W = 600, H = 220, padL = 8, padR = 60, padT = 18, padB = 26;
    var tip = document.createElement('div');
    tip.className = 'wf-tip'; tip.hidden = true;
    tip.style.cssText = 'position:absolute;pointer-events:none;background:hsl(var(--surface));border:1px solid hsl(var(--border-strong));border-radius:8px;padding:.3rem .55rem;font-size:.8rem;box-shadow:var(--shadow);white-space:nowrap;transform:translate(-50%,-120%);z-index:5';
    box.style.position = 'relative';

    function update() {
      var per = raw(src);
      if (!isFinite(per) || per <= 0) { box.innerHTML = ''; box.appendChild(tip); tip.hidden = true; return; }
      var maxY = per * years;
      var x = function (n) { return padL + (n - 1) / (years - 1) * (W - padL - padR); };
      var y = function (v) { return H - padB - (v / maxY) * (H - padT - padB); };
      var d = '', area;
      for (var n = 1; n <= years; n++) d += (n === 1 ? 'M' : 'L') + x(n).toFixed(1) + ' ' + y(per * n).toFixed(1) + ' ';
      area = d + 'L' + x(years).toFixed(1) + ' ' + (H - padB) + ' L' + x(1).toFixed(1) + ' ' + (H - padB) + ' Z';
      // gridlines every quarter — enough to read a value off the chart
      var grid = '';
      [0, 0.25, 0.5, 0.75, 1].forEach(function (f) {
        var v = maxY * f, yy = y(v).toFixed(1);
        grid += '<line class="cx-grid" x1="' + padL + '" y1="' + yy + '" x2="' + (W - padR) + '" y2="' + yy + '"/>';
        if (f === 0 || f === 0.5 || f === 1) grid += '<text class="cx-lbl" x="' + (W - padR + 6) + '" y="' + (parseFloat(yy) + 4) + '">' + money(src, v, 0) + '</text>';
      });
      // markers at first, mid, last year
      var marks = [1, Math.round(years / 2), years].filter(function (v, i, a) { return a.indexOf(v) === i && v >= 1; });
      var dots = '', xlab = '';
      marks.forEach(function (n) {
        dots += '<circle class="cx-dot" cx="' + x(n).toFixed(1) + '" cy="' + y(per * n).toFixed(1) + '" r="4"/>';
        if (n === years) dots += '<text class="cx-val" x="' + (x(n) - 6).toFixed(1) + '" y="' + (y(per * n) - 10).toFixed(1) + '" text-anchor="end">' + money(src, per * n, 0) + '</text>';
      });
      for (var m = 1; m <= years; m++) if (m === 1 || m === years || m === Math.round(years / 2)) xlab += '<text class="cx-lbl" x="' + x(m).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + (isEs ? 'Año ' : 'Yr ') + m + '</text>';
      var gid = 'cxg' + Math.random().toString(36).slice(2, 8);
      box.innerHTML = '<figcaption class="wf-chart-cap">' + esc(caption) + '</figcaption>' +
        '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(caption) + ': ' + esc(money(src, maxY, 0)) + '">' +
        '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="var(--chart-1)" stop-opacity="0.34"/>' +
          '<stop offset="1" stop-color="var(--chart-1)" stop-opacity="0.02"/></linearGradient></defs>' +
        grid + '<path class="cx-area" style="fill:url(#' + gid + ');opacity:1" d="' + area + '"/>' +
        '<path class="cx-line" d="' + d.trim() + '"/>' + dots + xlab +
        '<g class="cx-hover" hidden><line class="cx-cross" y1="' + padT + '" y2="' + (H - padB) + '"/><circle class="cx-hdot" r="5"/></g>' +
        '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="transparent" data-hit></rect></svg>';
      box.appendChild(tip);
      // hover: crosshair + moving dot + tooltip
      var svg = box.querySelector('svg');
      var hit = box.querySelector('[data-hit]');
      var hov = box.querySelector('.cx-hover');
      var cross = box.querySelector('.cx-cross');
      var hdot = box.querySelector('.cx-hdot');
      hit.addEventListener('mousemove', function (e) {
        var rect = svg.getBoundingClientRect();
        var rx = (e.clientX - rect.left) / rect.width * W;
        var n = Math.max(1, Math.min(years, Math.round((rx - padL) / (W - padL - padR) * (years - 1) + 1)));
        var px = x(n), py = y(per * n);
        hov.removeAttribute('hidden');
        cross.setAttribute('x1', px.toFixed(1)); cross.setAttribute('x2', px.toFixed(1));
        hdot.setAttribute('cx', px.toFixed(1)); hdot.setAttribute('cy', py.toFixed(1));
        tip.hidden = false;
        tip.innerHTML = (isEs ? 'Año ' : 'Year ') + n + ': <b>' + money(src, per * n, 0) + '</b>';
        tip.style.left = (px / W * rect.width) + 'px';
        tip.style.top = (py / H * rect.height) + 'px';
      });
      hit.addEventListener('mouseleave', function () { tip.hidden = true; hov.setAttribute('hidden', ''); });
    }
    var r = root(box);
    if (r) r.addEventListener('calc:updated', update);
    update();
  }

  // ── Compare: two live bars, direct-labelled ────────────────────────────────
  function compare(box) {
    var a = document.querySelector(box.getAttribute('data-a'));
    var b = document.querySelector(box.getAttribute('data-b'));
    if (!a || !b) return;
    var labels = (box.getAttribute('data-labels') || 'A|B').split('|');
    box.classList.add('wf-cmp');
    box.innerHTML =
      '<div><div class="wf-cmp-label"><span>' + esc(labels[0]) + '</span><b data-v="0">–</b></div><div class="wf-cmp-track"><div class="wf-cmp-fill" data-f="0" style="background:var(--chart-1)"></div></div></div>' +
      '<div><div class="wf-cmp-label"><span>' + esc(labels[1]) + '</span><b data-v="1">–</b></div><div class="wf-cmp-track"><div class="wf-cmp-fill" data-f="1" style="background:var(--chart-2)"></div></div></div>';
    function update() {
      var va = raw(a), vb = raw(b), max = Math.max(va || 0, vb || 0) || 1;
      [[va, a], [vb, b]].forEach(function (pair, i) {
        var v = pair[0], srcEl = pair[1];
        box.querySelector('[data-v="' + i + '"]').textContent = money(srcEl, v, 0);
        box.querySelector('[data-f="' + i + '"]').style.width = (isFinite(v) ? Math.max(2, v / max * 100) : 0) + '%';
      });
    }
    var r = root(box) || root(a);
    if (r) r.addEventListener('calc:updated', update);
    update();
  }

  // ── Equivalences: relatable comparisons from the yearly cost ────────────────
  function equiv(box) {
    var src = document.querySelector(box.getAttribute('data-src'));
    if (!src) return;
    function update() {
      var per = raw(src);
      if (!isFinite(per) || per <= 0) { box.innerHTML = ''; return; }
      var coffees = Math.round(per / 3.5);
      var streaming = Math.round(per / 10);
      box.innerHTML = (isEs ? 'Ese coste al año equivale a: ' : 'That yearly cost is about: ') +
        '<span>☕ <b>' + nf(coffees, 0) + '</b> ' + (isEs ? 'cafés' : 'coffees') + '</span>' +
        '<span>📺 <b>' + nf(streaming, 0) + '</b> ' + (isEs ? 'meses de streaming' : 'months of streaming') + '</span>';
    }
    var r = root(box);
    if (r) r.addEventListener('calc:updated', update);
    update();
  }

  function initAll() {
    document.querySelectorAll('[data-chart="projection"]').forEach(projection);
    document.querySelectorAll('[data-chart="compare"]').forEach(compare);
    document.querySelectorAll('[data-equiv]').forEach(equiv);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll);
  else initAll();
})();
