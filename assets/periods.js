/*
  periods.js — a Day / Week / Month / Year selector for a calculator's headline.
  Each button writes a multiplier into a hidden <input data-calc-var="period"> and
  updates the unit label, then lets calc.js recompute. Markup:

    <div class="period-seg" data-period role="group" aria-label="Period">
      <button type="button" data-period-val="1"     data-period-unit="day">Day</button>
      <button type="button" data-period-val="7"     data-period-unit="week">Week</button>
      <button type="button" data-period-val="30.44" data-period-unit="month" aria-pressed="true">Month</button>
      <button type="button" data-period-val="365"   data-period-unit="year">Year</button>
    </div>
    …<output data-calc-out="…*period" data-period-out></output><span data-period-unit-label> / month</span>
    <input type="hidden" data-calc-var="period" value="30.44">

  CSP-safe: external file, no inline handlers.
*/
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  var isEs = (document.documentElement.lang || 'en').toLowerCase().indexOf('es') === 0;
  var WORDS = isEs
    ? { day: 'día', week: 'semana', month: 'mes', year: 'año' }
    : { day: 'day', week: 'week', month: 'month', year: 'year' };

  document.querySelectorAll('[data-period]').forEach(function (group) {
    var scope = group.closest('[data-calc]') || document;
    var input = scope.querySelector('input[data-calc-var="period"]');
    var label = scope.querySelector('[data-period-unit-label]');
    var out = scope.querySelector('[data-period-out]');
    var btns = group.querySelectorAll('[data-period-val]');
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        btns.forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        var unit = b.getAttribute('data-period-unit');
        if (out) out.setAttribute('data-calc-round', unit === 'year' ? '0' : '2');
        if (input) { input.value = b.getAttribute('data-period-val'); input.dispatchEvent(new Event('input', { bubbles: true })); }
        if (label) label.textContent = ' / ' + WORDS[unit];
      });
    });
  });
})();
