/*
  calc.js — declarative, CSP-safe calculators for "worked numbers" pages
  (energy cost, EV charging, solar payback, heat-pump vs boiler…). No
  eval/Function: formulas are parsed with a tiny shunting-yard evaluator, so
  the strict CSP stays intact.

  Markup contract (see templates/article-calculator.html):
    <div data-calc>
      <label>… <input data-calc-var="watts" type="number" value="1000"></label>
      …
      <output data-calc-out="watts/1000*price" data-calc-round="2"
              data-calc-prefix="$" data-calc-suffix="" data-calc-format="locale"></output>
    </div>

  Operators: + - * / % ^ and parentheses; unary minus.
  Functions:  min(a,b) max(a,b) abs(x) floor(x) ceil(x) round(x,d)  (fixed arity).
  Inputs:     <input data-calc-var>  and  <select data-calc-var> (option value read).
  Presets:    <select data-calc-set="watts"> writes the chosen value into the
              input whose data-calc-var="watts" and re-runs (editable presets).
  Formatting: data-calc-round (decimals), data-calc-prefix, data-calc-suffix,
              data-calc-format="locale" (Intl thousands separators per <html lang>).

  Loaded only by pages that use it (defer, via PAGE_SCRIPTS).
*/
(function () {
  'use strict';

  var OPS = { '+': [1, 'L'], '-': [1, 'L'], '*': [2, 'L'], '/': [2, 'L'], '%': [2, 'L'], '^': [3, 'R'], 'u-': [4, 'R'] };

  // Whitelisted functions with fixed arity (kept CSP-safe: no eval, plain Math).
  var FUNCS = {
    min: { n: 2, f: function (a, b) { return Math.min(a, b); } },
    max: { n: 2, f: function (a, b) { return Math.max(a, b); } },
    abs: { n: 1, f: function (a) { return Math.abs(a); } },
    floor: { n: 1, f: function (a) { return Math.floor(a); } },
    ceil: { n: 1, f: function (a) { return Math.ceil(a); } },
    round: { n: 2, f: function (a, d) { var p = Math.pow(10, d || 0); return Math.round(a * p) / p; } },
    sqrt: { n: 1, f: function (a) { return Math.sqrt(a); } },
  };

  function tokenize(src) {
    var out = [], i = 0, prev = null;
    while (i < src.length) {
      var c = src[i];
      if (c === ' ' || c === '\t') { i++; continue; }
      if (/[0-9.]/.test(c)) {
        var num = '';
        while (i < src.length && /[0-9.]/.test(src[i])) num += src[i++];
        out.push({ t: 'num', v: parseFloat(num) }); prev = 'val'; continue;
      }
      if (/[a-zA-Z_]/.test(c)) {
        var id = '';
        while (i < src.length && /[a-zA-Z0-9_]/.test(src[i])) id += src[i++];
        // Peek past spaces: identifier followed by "(" is a function call.
        var j = i; while (j < src.length && (src[j] === ' ' || src[j] === '\t')) j++;
        if (src[j] === '(') {
          if (!FUNCS[id]) return null;            // unknown function → invalid
          out.push({ t: 'func', v: id }); prev = null; continue;
        }
        out.push({ t: 'var', v: id }); prev = 'val'; continue;
      }
      if (c === '(') { out.push({ t: '(' }); prev = null; i++; continue; }
      if (c === ')') { out.push({ t: ')' }); prev = 'val'; i++; continue; }
      if (c === ',') { out.push({ t: ',' }); prev = null; i++; continue; }
      if (OPS[c]) {
        var op = (c === '-' && prev !== 'val') ? 'u-' : c;
        out.push({ t: 'op', v: op }); prev = null; i++; continue;
      }
      return null; // unknown character → invalid formula
    }
    return out;
  }

  function toRpn(tokens) {
    if (!tokens) return null;
    var out = [], stack = [];
    for (var k = 0; k < tokens.length; k++) {
      var tk = tokens[k];
      if (tk.t === 'num' || tk.t === 'var') out.push(tk);
      else if (tk.t === 'func') stack.push(tk);
      else if (tk.t === ',') {
        while (stack.length && stack[stack.length - 1].t !== '(') out.push(stack.pop());
        if (!stack.length) return null; // comma outside parentheses
      } else if (tk.t === 'op') {
        while (stack.length) {
          var top = stack[stack.length - 1];
          if (top.t !== 'op') break;
          var po = OPS[top.v], pc = OPS[tk.v];
          if (po[0] > pc[0] || (po[0] === pc[0] && pc[1] === 'L')) out.push(stack.pop());
          else break;
        }
        stack.push(tk);
      } else if (tk.t === '(') stack.push(tk);
      else if (tk.t === ')') {
        while (stack.length && stack[stack.length - 1].t !== '(') out.push(stack.pop());
        if (!stack.length) return null; // unbalanced
        stack.pop();
        if (stack.length && stack[stack.length - 1].t === 'func') out.push(stack.pop());
      }
    }
    while (stack.length) {
      var s = stack.pop();
      if (s.t === '(') return null;
      out.push(s);
    }
    return out;
  }

  function evalRpn(rpn, vars) {
    if (!rpn) return NaN;
    var st = [];
    for (var k = 0; k < rpn.length; k++) {
      var tk = rpn[k];
      if (tk.t === 'num') st.push(tk.v);
      else if (tk.t === 'var') {
        if (!(tk.v in vars)) return NaN;
        st.push(vars[tk.v]);
      } else if (tk.t === 'func') {
        var spec = FUNCS[tk.v];
        if (!spec || st.length < spec.n) return NaN;
        var args = [];
        for (var a = 0; a < spec.n; a++) args.unshift(st.pop());
        st.push(spec.f.apply(null, args));
      } else if (tk.v === 'u-') { if (!st.length) return NaN; st.push(-st.pop()); }
      else {
        var b = st.pop(), a2 = st.pop();
        if (a2 === undefined || b === undefined) return NaN;
        switch (tk.v) {
          case '+': st.push(a2 + b); break;
          case '-': st.push(a2 - b); break;
          case '*': st.push(a2 * b); break;
          case '/': st.push(b === 0 ? NaN : a2 / b); break;
          case '%': st.push(b === 0 ? NaN : a2 % b); break;
          case '^': st.push(Math.pow(a2, b)); break;
        }
      }
    }
    return st.length === 1 ? st[0] : NaN;
  }

  function format(el, val) {
    if (!isFinite(val)) return '–';
    var roundAttr = el.getAttribute('data-calc-round');
    var decimals = roundAttr === null ? null : (parseInt(roundAttr, 10) || 0);
    var lang = (typeof document !== 'undefined' && document.documentElement.lang) || 'en';
    // Compact very large results ("1.9M") so they never overflow the result
    // card, even with absurd inputs. Prefix/suffix (e.g. currency) are applied
    // by the caller around this.
    if (Math.abs(val) >= 1e6) {
      try { return new Intl.NumberFormat(lang, { notation: 'compact', maximumFractionDigits: 1 }).format(val); } catch (e) { /* fall through */ }
    }
    if (el.getAttribute('data-calc-format') === 'locale') {
      try {
        return new Intl.NumberFormat(lang, {
          minimumFractionDigits: decimals === null ? 0 : decimals,
          maximumFractionDigits: decimals === null ? 3 : decimals,
        }).format(val);
      } catch (e) { /* fall through to plain */ }
    }
    return decimals === null ? String(val) : val.toFixed(decimals);
  }

  function initCalc(root) {
    var fields = root.querySelectorAll('[data-calc-var]');
    var outputs = root.querySelectorAll('[data-calc-out]');
    var presets = root.querySelectorAll('[data-calc-set]');
    var compiled = [];
    outputs.forEach(function (o) {
      compiled.push({ el: o, rpn: toRpn(tokenize(o.getAttribute('data-calc-out') || '')) });
    });

    function recompute() {
      var vars = {};
      fields.forEach(function (inp) {
        var v = parseFloat(String(inp.value).replace(',', '.'));
        vars[inp.getAttribute('data-calc-var')] = isFinite(v) ? v : NaN;
      });
      compiled.forEach(function (c) {
        var val = evalRpn(c.rpn, vars);
        // Expose the raw number so charts/animations can read it without parsing
        // the formatted, possibly-compacted text.
        if (isFinite(val)) c.el.dataset.value = val; else delete c.el.dataset.value;
        c.el.textContent = (c.el.getAttribute('data-calc-prefix') || '') + format(c.el, val) + (c.el.getAttribute('data-calc-suffix') || '');
      });
      // Let charts and other widgets react to a fresh computation.
      try { root.dispatchEvent(new CustomEvent('calc:updated', { bubbles: true })); } catch (e) {}
    }

    fields.forEach(function (inp) {
      inp.addEventListener('input', recompute);
      inp.addEventListener('change', recompute); // <select> and spinner arrows
    });
    // Preset dropdowns: write the chosen value into a named input, then recompute.
    presets.forEach(function (sel) {
      sel.addEventListener('change', function () {
        var target = root.querySelector('[data-calc-var="' + sel.getAttribute('data-calc-set') + '"]');
        if (target) { target.value = sel.value; }
        recompute();
      });
    });

    // Share by URL: restore any input values from the query string on load…
    try {
      var params = new URLSearchParams(location.search);
      fields.forEach(function (inp) { var k = inp.getAttribute('data-calc-var'); if (k && params.has(k)) inp.value = params.get(k); });
    } catch (e) {}
    // …and inject a "copy link" button that encodes the current inputs.
    var esRoot = (document.documentElement.lang || 'en').toLowerCase().indexOf('es') === 0;
    var card = root.querySelector('.result-card');
    if (card && !card.querySelector('.wf-copylink')) {
      var btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'share-btn wf-copylink';
      var label = esRoot ? 'Copiar enlace de este cálculo' : 'Copy link to this result';
      btn.textContent = label;
      btn.addEventListener('click', function () {
        var p = new URLSearchParams();
        fields.forEach(function (inp) { var k = inp.getAttribute('data-calc-var'); if (k) p.set(k, inp.value); });
        var url = location.origin + location.pathname + '?' + p.toString();
        var done = function () { btn.textContent = esRoot ? '¡Enlace copiado!' : 'Link copied!'; setTimeout(function () { btn.textContent = label; }, 1600); };
        if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, done); else done();
      });
      card.appendChild(btn);
    }
    // PDF report — entirely generic, since every calculator here is already
    // declarative (data-calc-var / data-calc-out). Reuses the estimator's
    // print CSS (.wf-print-report / .pr-*) so both look like one product.
    if (card && !card.querySelector('.wf-pdfbtn')) {
      var pdfBtn = document.createElement('button');
      pdfBtn.type = 'button'; pdfBtn.className = 'share-btn wf-pdfbtn';
      pdfBtn.textContent = esRoot ? 'Descargar informe (PDF)' : 'Download PDF report';
      pdfBtn.addEventListener('click', function () { downloadCalcReport(root, card, esRoot); });
      card.appendChild(pdfBtn);
    }

    recompute();
  }

  function buildCalcReportHTML(root, card, esRoot) {
    var h1 = document.querySelector('h1');
    var title = h1 ? h1.textContent : document.title;
    var now = new Date();
    var dateStr = now.toLocaleDateString(esRoot ? 'es' : 'en', { year: 'numeric', month: 'long', day: 'numeric' });
    var T = esRoot
      ? { inputs: 'Tus datos', result: 'Tu resultado', generated: 'Generado',
          cont: 'Reabre este cálculo exacto online',
          foot: 'Solo una estimación, no una factura — usa tu tarifa y consumo reales para una cifra exacta. Metodología completa en wattfigures.com/legal/methodology/.' }
      : { inputs: 'Your inputs', result: 'Your result', generated: 'Generated',
          cont: 'Reopen this exact calculation online',
          foot: 'An estimate only, not a bill — use your own real tariff and usage for an exact figure. Full methodology at wattfigures.com/legal/methodology/.' };

    var inputRows = '';
    root.querySelectorAll('.calc-field').forEach(function (field) {
      if (field.hidden) return;
      var labelEl = field.querySelector('span'), label = labelEl ? labelEl.textContent : '';
      var sel = field.querySelector('select'), inp = field.querySelector('input');
      var val = '';
      if (sel) val = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : sel.value;
      else if (inp && inp.type !== 'hidden') {
        var unit = field.querySelector('.unit');
        val = inp.value + (unit ? ' ' + unit.textContent : '');
      }
      if (!label || !val) return;
      inputRows += '<div class="pr-lg-row"><span class="pr-lg-name">' + label + '</span><span class="pr-lg-val">' + val + '</span></div>';
    });

    var leadEl = card.querySelector('.result-lead');
    var primaryOut = card.querySelector('.result-primary output');
    var periodLbl = card.querySelector('[data-period-unit-label]');
    var hero = '<div class="pr-hero"><div class="pr-hero-val">' + (primaryOut ? primaryOut.textContent : '')
      + (periodLbl ? '<span class="pr-hero-unit">' + periodLbl.textContent + '</span>' : '') + '</div>'
      + (leadEl ? '<div class="pr-hero-sub">' + leadEl.textContent + '</div>' : '') + '</div>';

    var resultRows = '';
    card.querySelectorAll('.result-rows li').forEach(function (li) {
      var lbl = li.querySelector('span'), out = li.querySelector('output');
      if (!lbl || !out) return;
      resultRows += '<div class="pr-lg-row"><span class="pr-lg-name">' + lbl.textContent + '</span><span class="pr-lg-val">' + out.textContent + '</span></div>';
    });

    var p = new URLSearchParams();
    root.querySelectorAll('[data-calc-var]').forEach(function (inp) { var k = inp.getAttribute('data-calc-var'); if (k) p.set(k, inp.value); });
    var url = (location.origin + location.pathname + '?' + p.toString()).replace(/^https?:\/\//, '');

    return ''
      + '<div class="pr-head"><div class="pr-brand">WattFigures</div><div class="pr-meta">' + T.generated + ' ' + dateStr + '</div></div>'
      + '<h1 class="pr-h1">' + title + '</h1>'
      + hero
      + '<h2 class="pr-h2">' + T.result + '</h2><div class="pr-legend">' + resultRows + '</div>'
      + '<h2 class="pr-h2">' + T.inputs + '</h2><div class="pr-legend">' + inputRows + '</div>'
      + '<div class="pr-foot"><p>' + T.foot + '</p><p class="pr-continue">' + T.cont + ': ' + url + '</p></div>';
  }

  function downloadCalcReport(root, card, esRoot) {
    var reportEl = document.querySelector('.wf-print-report');
    if (!reportEl) {
      reportEl = document.createElement('div');
      reportEl.className = 'wf-print-report';
      reportEl.setAttribute('aria-hidden', 'true');
      document.body.appendChild(reportEl);
    }
    reportEl.innerHTML = buildCalcReportHTML(root, card, esRoot);
    document.body.classList.add('printing-report');
    var cleanup = function () { document.body.classList.remove('printing-report'); window.removeEventListener('afterprint', cleanup); };
    window.addEventListener('afterprint', cleanup);
    setTimeout(function () { window.print(); }, 30);
  }

  // ── Browser boot (skipped under Node so the parser can be unit-tested) ──────
  if (typeof document !== 'undefined') {
    var boot = function () { document.querySelectorAll('[data-calc]').forEach(initCalc); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  } else if (typeof globalThis !== 'undefined') {
    globalThis.__calc = { tokenize: tokenize, toRpn: toRpn, evalRpn: evalRpn, FUNCS: FUNCS };
  }
})();
