/*
  estimator.js — Home Energy Estimator ("build your household → personalised bill").
  Reads data/estimator-appliances.json + data/energy-prices.json (same-origin),
  builds an interactive appliance builder, and renders live results:
   • headline €/year + €/month, total kWh
   • a donut of cost by category (dataviz-validated fixed palette)
   • a month-by-month chart (base + winter heating + summer cooling → not just "up")
   • biggest energy users, and an optional solar-panel offset (hemisphere-aware)

  CSP-safe: external file, no eval, no inline handlers. All SVG is built by hand.
  State (country, people, hemisphere, solar, quantities) is shareable via the URL.
*/
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  var mount = document.getElementById('estimator');
  if (!mount) return;

  var LANG = (document.documentElement.lang || 'en').toLowerCase().indexOf('es') === 0 ? 'es' : 'en';
  var LOC = LANG === 'es' ? 'es' : 'en';
  var SOUTH = { AU: 1, NZ: 1, ZA: 1, BR: 1 };
  // Rough annual yield (kWh per kWp installed) by country — sunnier = higher.
  var YIELD = { ES: 1500, IT: 1450, PT: 1500, AU: 1550, NZ: 1300, ZA: 1650, MX: 1700, BR: 1450, IN: 1500, US: 1400, FR: 1250, GB: 950, IE: 950, DE: 1000, NL: 1000, BE: 1000, AT: 1100, CH: 1150, SE: 950, NO: 850, PL: 1050, CA: 1150, JP: 1250 };
  var DEF_YIELD = 1250, SELF_USE_CAP = 0.55; // no-battery self-consumption ceiling

  var T = {
    en: {
      country: 'Your country & price', people: 'People in the home', hemisphere: 'Season pattern',
      north: 'Northern', south: 'Southern', solar: 'I have solar panels', kwp: 'System size',
      prefill: 'Pre-filled with a typical home — change any quantity, add or remove anything.',
      expand: 'Expand all', collapse: 'Collapse all', reset: 'Reset to typical home',
      perYear: 'per year', estBill: 'Estimated electricity', perMonth: '/mo', totalUse: 'total use',
      breakdown: 'Where your electricity goes', breakdownHint: 'Share of your yearly cost by category.',
      monthly: 'Month by month', monthlyHint: 'Heating lifts winter, cooling lifts summer — your bill is not a flat line.',
      hogs: 'Your biggest energy users', hogsHint: 'The appliances that cost you the most each year.',
      copy: 'Copy link to my estimate', copied: 'Link copied!', download: 'Download image', downloaded: 'Downloaded!', empty: 'Add at least one appliance to see your estimate.',
      solarCovers: 'Solar could cover ~', ofBill: '% of your bill — you\'d pay about', netYear: '/year.',
      avg: 'avg', kwhUnit: 'kWh', items: 'items', on: 'on', perYr: '/yr',
      base: 'Base load', heat: 'Heating', cool: 'Cooling', solarKey: 'After solar', months: ['J','F','M','A','M','J','J','A','S','O','N','D'],
      monthsFull: ['January','February','March','April','May','June','July','August','September','October','November','December'], withSolar: 'with solar',
      s1: 'Your home', s1d: 'Where you live sets the price per kWh; household size scales cooking, hot water and laundry.',
      s2: 'What you plug in', s2d: 'Set how many of each you own. Leave anything you do not have at zero.',
      s3: 'Your estimate', s3d: 'Updates live as you change anything above.',
      vsTyp: 'vs our typical-home baseline', above: 'above', below: 'below', same: 'right on',
      actTitle: 'Where to act first', actHint: 'Your three biggest costs — the only places a change really moves the bill.',
      ofBillShare: 'of your bill',
      reportBtn: 'Download PDF report', reportTitle: 'Your personalised electricity report',
      reportGenerated: 'Generated', reportPrice: 'Price per kWh', reportPeopleLbl: 'People in home',
      reportSolarLbl: 'Solar system', reportNoSolar: 'Not modelled', reportBreakdown: 'Cost by category',
      reportMonthly: 'Month by month', reportTop: 'Your biggest costs', reportRecs: 'Where to look next',
      reportOfBill: 'of bill', reportSolarCov: 'Solar covers about',
      reportSolarCov2: 'of this home\'s demand, saving', reportPerYear: '/year',
      reportFooter: 'Estimates only, not a bill — figures use typical real-world appliance consumption and your country\'s average price. Full methodology at wattfigures.com/legal/methodology/.',
      reportCompareTitle: 'How this compares', reportYourHome: 'Your home', reportTypHome: 'Typical home',
      reportContinue: 'Reopen this exact estimate online',
      monthlyMostAt: 'is your priciest month, at', monthlyVsCheapest: 'more than', monthlyCheapestIs: ', your cheapest, at',
      co2Title: 'Your carbon footprint', co2Hint: 'From your electricity alone, based on your country\'s typical grid mix — not your full footprint.',
      co2Unit: 'kg CO₂e/yr', co2CarPrefix: '≈ driving', co2CarSuffix: 'km in an average petrol car',
      whatIfTitle: 'What if you cut this?', whatIfHint: 'Drag to see how much trimming your 3 biggest costs would save.',
      whatIfCut: 'Cut your top 3 costs by', whatIfNewTotal: 'New yearly total', whatIfSave: 'you would save'
    },
    es: {
      country: 'Tu país y precio', people: 'Personas en casa', hemisphere: 'Patrón estacional',
      north: 'Norte', south: 'Sur', solar: 'Tengo placas solares', kwp: 'Tamaño',
      prefill: 'Rellenado con una casa típica: cambia cualquier cantidad, añade o quita lo que quieras.',
      expand: 'Expandir todo', collapse: 'Contraer todo', reset: 'Reiniciar a casa típica',
      perYear: 'al año', estBill: 'Electricidad estimada', perMonth: '/mes', totalUse: 'consumo total',
      breakdown: 'A dónde va tu electricidad', breakdownHint: 'Reparto de tu coste anual por categoría.',
      monthly: 'Mes a mes', monthlyHint: 'La calefacción sube el invierno y el aire el verano: tu factura no es una línea plana.',
      hogs: 'Lo que más consume', hogsHint: 'Los aparatos que más te cuestan cada año.',
      copy: 'Copiar enlace de mi estimación', copied: '¡Enlace copiado!', download: 'Descargar imagen', downloaded: '¡Descargada!', empty: 'Añade al menos un aparato para ver tu estimación.',
      solarCovers: 'El sol podría cubrir ~', ofBill: '% de tu factura: pagarías unos', netYear: '/año.',
      avg: 'media', kwhUnit: 'kWh', items: 'aparatos', on: 'activos', perYr: '/año',
      base: 'Consumo base', heat: 'Calefacción', cool: 'Refrigeración', solarKey: 'Con placas', months: ['E','F','M','A','M','J','J','A','S','O','N','D'],
      monthsFull: ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'], withSolar: 'con solar',
      s1: 'Tu casa', s1d: 'Dónde vives fija el precio del kWh; el número de personas escala cocina, agua caliente y lavado.',
      s2: 'Lo que tienes enchufado', s2d: 'Indica cuántos tienes de cada uno. Deja a cero lo que no tengas.',
      s3: 'Tu estimación', s3d: 'Se actualiza en vivo según cambias cualquier cosa de arriba.',
      vsTyp: 'frente a nuestra casa tipo', above: 'por encima', below: 'por debajo', same: 'clavado en',
      actTitle: 'Por dónde empezar', actHint: 'Tus tres mayores gastos: los únicos sitios donde un cambio mueve de verdad la factura.',
      ofBillShare: 'de tu factura',
      reportBtn: 'Descargar informe (PDF)', reportTitle: 'Tu informe personalizado de electricidad',
      reportGenerated: 'Generado', reportPrice: 'Precio por kWh', reportPeopleLbl: 'Personas en casa',
      reportSolarLbl: 'Placas solares', reportNoSolar: 'No simuladas', reportBreakdown: 'Coste por categoría',
      reportMonthly: 'Mes a mes', reportTop: 'Lo que más consume', reportRecs: 'Por dónde seguir',
      reportOfBill: 'de la factura', reportSolarCov: 'El sol cubre alrededor del',
      reportSolarCov2: 'de la demanda de esta casa, ahorrando', reportPerYear: '/año',
      reportFooter: 'Solo estimaciones, no una factura — las cifras usan el consumo real típico de cada aparato y el precio medio de tu país. Metodología completa en wattfigures.com/legal/methodology/.',
      reportCompareTitle: 'Cómo se compara', reportYourHome: 'Tu casa', reportTypHome: 'Casa típica',
      reportContinue: 'Reabre esta estimación exacta online',
      monthlyMostAt: 'es tu mes más caro, con', monthlyVsCheapest: 'más que', monthlyCheapestIs: ', tu mes más barato, con',
      co2Title: 'Tu huella de carbono', co2Hint: 'Solo por tu electricidad, según la mezcla eléctrica típica de tu país — no es tu huella completa.',
      co2Unit: 'kg CO₂e/año', co2CarPrefix: '≈ conducir', co2CarSuffix: 'km en un coche de gasolina medio',
      whatIfTitle: '¿Y si recortas esto?', whatIfHint: 'Mueve la barra para ver cuánto ahorrarías recortando tus 3 mayores gastos.',
      whatIfCut: 'Recorta tus 3 mayores gastos un', whatIfNewTotal: 'Nuevo total anual', whatIfSave: 'ahorrarías'
    }
  }[LANG];
  var CAR_G_PER_KM = 180; // typical average petrol car, for the CO2 driving-equivalent comparison

  // Recommendation copy shown on the PDF report, picked by the biggest cost
  // categories the visitor actually has — never generic filler.
  var RECS = {
    heating: {
      en: { text: 'Heating is your biggest category. A room thermostat or a couple of degrees lower often matters more than any single appliance swap.', label: 'Compare heat pump vs. gas boiler running cost', path: 'calculators/heat-pump-vs-gas/' },
      es: { text: 'La calefacción es tu categoría más cara. Bajar el termostato un par de grados o programarlo por estancia suele pesar más que cambiar un aparato.', label: 'Compara bomba de calor y caldera de gas', path: 'calculators/heat-pump-vs-gas/' }
    },
    cooling: {
      en: { text: 'Cooling leads your bill. A ceiling or standing fan uses a fraction of an air conditioner\'s power and covers many days on its own.', label: 'Air conditioning cost calculator', path: 'calculators/air-conditioning/' },
      es: { text: 'La refrigeración es tu categoría más cara. Un ventilador usa una fracción de la potencia del aire acondicionado y cubre muchos días por sí solo.', label: 'Calculadora de coste del aire acondicionado', path: 'calculators/air-conditioning/' }
    },
    kitchen: {
      en: { text: 'Kitchen & fridge appliances run in the background all day — an old fridge can use double what a modern one does.', label: 'Refrigerator running cost', path: 'appliances/refrigerator/' },
      es: { text: 'Los aparatos de cocina y frío funcionan de fondo todo el día — un frigorífico viejo puede gastar el doble que uno moderno.', label: 'Coste del frigorífico', path: 'appliances/refrigerator/' }
    },
    waterlaundry: {
      en: { text: 'Hot water and laundry add up fast. Washing at a lower temperature and running full loads cuts this without buying anything.', label: 'Laundry cost calculator', path: 'calculators/laundry-cost/' },
      es: { text: 'El agua caliente y el lavado suman rápido. Lavar a menos temperatura y con la carga llena reduce esto sin comprar nada.', label: 'Calculadora de coste de lavado', path: 'calculators/laundry-cost/' }
    },
    tech: {
      en: { text: 'Electronics & lighting is usually more about standby drain than active use — devices left "off" but still plugged in.', label: 'How to cut standby power', path: 'guides/how-to-cut-standby-power/' },
      es: { text: 'La electrónica e iluminación suele deberse más al consumo en espera que al uso activo — aparatos "apagados" pero enchufados.', label: 'Cómo reducir el consumo en espera', path: 'guides/how-to-cut-standby-power/' }
    },
    other: {
      en: { text: 'This category covers big one-off loads like an EV charger or pool pump — worth checking each one on its own.', label: 'EV charging cost calculator', path: 'calculators/ev-charging/' },
      es: { text: 'Esta categoría cubre cargas grandes puntuales, como un cargador de coche eléctrico o una bomba de piscina — merece la pena revisarlas una a una.', label: 'Calculadora de coste de carga de coche eléctrico', path: 'calculators/ev-charging/' }
    }
  };
  var SOLAR_REC = {
    en: { text: 'You have not modelled solar yet. With your country\'s sunshine, even a modest system could offset a real share of this bill.', label: 'Solar payback calculator', path: 'calculators/solar-payback/' },
    es: { text: 'Todavía no has simulado placas solares. Con el sol de tu país, incluso una instalación modesta podría cubrir una parte real de tu factura.', label: 'Calculadora de amortización solar', path: 'calculators/solar-payback/' }
  };

  var SVGNS = 'http://www.w3.org/2000/svg';
  var ICONS = {
    heat: '<path d="M9 2v6M12 2v6M6 2v6M4 10h16v2a8 8 0 0 1-16 0z"/>',
    cool: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
    water: '<path d="M12 2s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    fridge: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M6 10h12M9 5v2M9 13v3"/>',
    kitchen: '<circle cx="12" cy="13" r="7"/><circle cx="12" cy="13" r="3"/><path d="M8 2v3M12 2v3M16 2v3"/>',
    laundry: '<rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="13" r="5"/><path d="M8 6h.01M11 6h.01"/>',
    tv: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    bulb: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1v.2h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/>',
    plug: '<path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0zM12 17v5"/>',
    people: '<circle cx="9" cy="7" r="3"/><path d="M2 21v-1a6 6 0 0 1 12 0v1M17 11a3 3 0 1 0-2-5.2M15.5 13.5A6 6 0 0 1 22 20v1"/>',
    solar: '<rect x="3" y="4" width="18" height="12" rx="1"/><path d="M3 8h18M3 12h18M9 4v12M15 4v12M12 16v6M8 22h8"/>',
    chev: '<path d="m6 9 6 6 6-6"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'
  };
  function svgIco(name, cls) {
    return '<svg class="est-ico ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }
  function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function normWeights(w) { var s = 0, i; for (i = 0; i < w.length; i++) s += w[i]; s = s || 1; return w.map(function (x) { return x * 12 / s; }); }
  function shift6(a) { return a.slice(6).concat(a.slice(0, 6)); }
  function nf(v, d) { try { return new Intl.NumberFormat(LOC, { maximumFractionDigits: d || 0 }).format(v); } catch (e) { return String(Math.round(v)); } }

  var DATA, PRICES, state, els = {}, lastResult;
  var REDUCE_MOTION = false;
  try { REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  function money(n) {
    var c = state.country, s = nf(Math.round(n));
    return c.pos === 'pre' ? c.symbol + s : s + ' ' + c.symbol;
  }
  function moneyHtml(n) { return money(n).replace(/^([^\d]*)/, '<span class="cur">$1</span>'); }
  // Same base + language-folder convention as the "Keep going" links in the
  // page shell (base + 'es/' + path for the Spanish mirror, base + path for EN).
  function sitePath(p) { return base + (LANG === 'es' ? 'es/' : '') + p; }

  // Animated count-up for the headline number — from its previous value (or 0
  // on first paint) to the new one. Skipped under prefers-reduced-motion.
  function animateNumber(el, toVal) {
    var from = el._wfVal != null ? el._wfVal : 0;
    el._wfVal = toVal;
    if (REDUCE_MOTION || Math.abs(toVal - from) < 0.5) { el.innerHTML = moneyHtml(toVal); return; }
    if (el._wfRaf) cancelAnimationFrame(el._wfRaf);
    var start = null, dur = 550;
    function step(ts) {
      if (start == null) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.innerHTML = moneyHtml(from + (toVal - from) * eased);
      if (p < 1) el._wfRaf = requestAnimationFrame(step); else el._wfRaf = null;
    }
    el._wfRaf = requestAnimationFrame(step);
  }

  // Shared hover tooltip for the donut and the monthly chart.
  function showTip(html, rect) {
    if (!els.tip) return;
    els.tip.innerHTML = html;
    els.tip.hidden = false;
    var mr = mount.getBoundingClientRect();
    els.tip.style.top = (rect.top - mr.top - 8) + 'px';
    var left = rect.left - mr.left + rect.width / 2;
    els.tip.style.left = Math.max(8, Math.min(left, mr.width - 8)) + 'px';
    els.tip.style.transform = 'translate(-50%,-100%)';
  }
  function hideTip() { if (els.tip) els.tip.hidden = true; }
  function priceLabel(c) { return (c.pos === 'pre' ? c.symbol + c.price : c.price + ' ' + c.symbol) + '/kWh'; }
  function groupById(id) { for (var i = 0; i < DATA.groups.length; i++) if (DATA.groups[i].id === id) return DATA.groups[i]; return null; }
  function bucketById(id) { for (var i = 0; i < DATA.buckets.length; i++) if (DATA.buckets[i].id === id) return DATA.buckets[i]; return null; }
  function flagSrc(code) { return 'assets/img/flags/' + code.toLowerCase() + '.svg'; }

  // ── State + URL ────────────────────────────────────────────────────────
  function defaultQty() { var q = {}; DATA.appliances.forEach(function (a) { q[a.id] = a.qty; }); return q; }
  function peopleFactor() { return clamp(0.55 + 0.15 * state.people, 0.55, 2.0); }
  function resolvedHemi() { return state.hemi || (SOUTH[state.country.code] ? 's' : 'n'); }

  function readURL() {
    var p; try { p = new URLSearchParams(location.search); } catch (e) { return; }
    if (p.has('c')) { var c = PRICES.filter(function (x) { return x.code === p.get('c'); })[0]; if (c) state.country = c; }
    if (p.has('people')) state.people = clamp(parseInt(p.get('people'), 10) || 3, 1, 12);
    if (p.has('hemi')) state.hemi = (p.get('hemi') === 's' ? 's' : 'n');
    if (p.has('solar')) { var k = parseFloat(p.get('solar')); if (k > 0) { state.solarOn = true; state.kwp = clamp(k, 0.5, 30); } }
    if (p.has('q')) {
      p.get('q').split(',').forEach(function (pair) {
        var kv = pair.split(':'); if (kv.length === 2 && state.qty[kv[0]] != null) state.qty[kv[0]] = clamp(parseInt(kv[1], 10) || 0, 0, 99);
      });
    }
  }
  function shareURL() {
    var p = new URLSearchParams();
    p.set('c', state.country.code); p.set('people', state.people); p.set('hemi', resolvedHemi());
    if (state.solarOn) p.set('solar', state.kwp);
    var q = []; DATA.appliances.forEach(function (a) { if (state.qty[a.id] !== a.qty) q.push(a.id + ':' + state.qty[a.id]); });
    if (q.length) p.set('q', q.join(','));
    return location.origin + location.pathname + '?' + p.toString();
  }

  // ── Compute ────────────────────────────────────────────────────────────
  function compute() {
    var pf = peopleFactor(), price = state.country.price, hemi = resolvedHemi();
    var wB = normWeights(DATA.meta.seasons.base);
    var wH = normWeights(DATA.meta.seasons.heat);
    var wC = normWeights(DATA.meta.seasons.cool);
    if (hemi === 's') { wH = shift6(wH); wC = shift6(wC); }
    var m, monBase = [0,0,0,0,0,0,0,0,0,0,0,0], monHeat = [0,0,0,0,0,0,0,0,0,0,0,0], monCool = [0,0,0,0,0,0,0,0,0,0,0,0];
    var buckets = {}; DATA.buckets.forEach(function (b) { buckets[b.id] = 0; });
    var perApp = [], totalKwh = 0;

    DATA.appliances.forEach(function (a) {
      var qty = state.qty[a.id] || 0; if (qty <= 0) return;
      var k = a.kwh * qty * (a.people ? pf : 1);
      totalKwh += k;
      var g = groupById(a.group), b = g ? g.bucket : 'other';
      buckets[b] += k;
      perApp.push({ id: a.id, name: LANG === 'es' ? a.name_es : a.name, kwh: k, cost: k * price });
      var w = a.season === 'heat' ? wH : a.season === 'cool' ? wC : wB;
      var tgt = a.season === 'heat' ? monHeat : a.season === 'cool' ? monCool : monBase;
      for (m = 0; m < 12; m++) tgt[m] += k * w[m] / 12;
    });

    var grossKwh = totalKwh, grossCost = grossKwh * price;

    // Solar offset (hemisphere-aware, monthly self-consumption cap)
    var solarSaveKwh = 0, monNet = [], monGross = [], monSolar = [];
    var wS = normWeights(DATA.meta.seasons.solar); if (hemi === 's') wS = shift6(wS);
    var gen = state.solarOn ? state.kwp * (YIELD[state.country.code] || DEF_YIELD) : 0;
    for (m = 0; m < 12; m++) {
      var demand = monBase[m] + monHeat[m] + monCool[m];
      monGross[m] = demand;
      var genM = gen * wS[m] / 12;
      // Without a battery you can only use solar while it is being generated, so
      // cap the monthly offset at a realistic share of that month's demand.
      var off = Math.min(demand * SELF_USE_CAP, genM);
      solarSaveKwh += off;
      monSolar[m] = off;
      monNet[m] = demand - off;
    }
    var netKwh = grossKwh - solarSaveKwh, netCost = netKwh * price;

    perApp.sort(function (a, b) { return b.cost - a.cost; });
    var co2Factor = (state.country.co2 || 0) / 1000; // g/kWh -> kg/kWh
    return {
      price: price, grossKwh: grossKwh, grossCost: grossCost, netKwh: netKwh, netCost: netCost,
      solarSaveKwh: solarSaveKwh, solarSaveCost: solarSaveKwh * price,
      solarPct: grossKwh > 0 ? Math.round(solarSaveKwh / grossKwh * 100) : 0,
      grossCo2Kg: grossKwh * co2Factor, netCo2Kg: netKwh * co2Factor,
      buckets: buckets, monBase: monBase, monHeat: monHeat, monCool: monCool,
      monGross: monGross, monNet: monNet, monSolar: monSolar, perApp: perApp
    };
  }

  // Yearly kWh of the pre-filled "typical home" (dataset defaults) — the
  // yardstick the user's own setup is measured against.
  function baselineKwh() {
    var people = DATA.meta.peopleDefault || 3;
    var pf = clamp(0.55 + 0.15 * people, 0.55, 2.0), total = 0;
    DATA.appliances.forEach(function (a) {
      if (!a.qty) return;
      total += a.kwh * a.qty * (a.people ? pf : 1);
    });
    return total;
  }

  // ── Render: results ────────────────────────────────────────────────────
  function render() {
    var r = compute();
    var active = r.perApp.length;
    // Hero
    if (active) animateNumber(els.year, state.solarOn ? r.netCost : r.grossCost);
    else { if (els.year._wfRaf) cancelAnimationFrame(els.year._wfRaf); els.year._wfRaf = null; els.year._wfVal = 0; els.year.innerHTML = '—'; }
    els.sub.innerHTML = active
      ? '<b>' + money((state.solarOn ? r.netCost : r.grossCost) / 12) + '</b>' + T.perMonth + ' · <b>' + nf(state.solarOn ? r.netKwh : r.grossKwh) + '</b> ' + T.kwhUnit + ' ' + T.totalUse
      : T.empty;
    // How this home compares with the pre-filled typical one
    if (els.cmp) {
      var bl = baselineKwh();
      if (active && bl > 0) {
        var diff = Math.round((r.grossKwh / bl - 1) * 100);
        var word = Math.abs(diff) < 3 ? T.same : (diff > 0 ? T.above : T.below);
        var cls = Math.abs(diff) < 3 ? 'is-same' : (diff > 0 ? 'is-over' : 'is-under');
        els.cmp.className = 'eh-cmp ' + cls;
        els.cmp.innerHTML = '<b>' + (Math.abs(diff) < 3 ? '' : Math.abs(diff) + '% ') + word + '</b> ' + T.vsTyp;
      } else { els.cmp.innerHTML = ''; els.cmp.className = 'eh-cmp'; }
    }
    if (state.solarOn && active && r.solarPct > 0) {
      els.solar.hidden = false;
      els.solar.textContent = T.solarCovers + r.solarPct + T.ofBill + ' ' + money(r.netCost) + T.netYear + ' (' + T.avg + ' −' + money(r.solarSaveCost) + '/' + (LANG === 'es' ? 'año' : 'yr') + ')';
    } else els.solar.hidden = true;

    renderDonut(r);
    renderCo2(r);
    renderMonths(r);
    renderHogs(r);
    lastResult = r;
    renderWhatIf(r);
    els.results.classList.toggle('is-empty', !active);
  }

  function renderCo2(r) {
    if (!els.co2) return;
    if (!r.perApp.length) { els.co2.innerHTML = ''; return; }
    var kg = state.solarOn ? r.netCo2Kg : r.grossCo2Kg;
    var km = Math.round(kg * 1000 / CAR_G_PER_KM);
    els.co2.innerHTML = '<div class="co2-val">' + nf(kg) + '<span class="co2-unit">' + T.co2Unit + '</span></div>'
      + '<div class="co2-cmp">' + T.co2CarPrefix + ' <b>' + nf(km) + '</b> ' + T.co2CarSuffix + '</div>';
  }

  // "What if you cut your top 3 costs by X%?" — a live savings simulator on
  // top of numbers already computed, no new calculation path or data source.
  function renderWhatIf(r) {
    if (!els.whatifNew) return;
    if (!r.perApp.length) { els.whatifCard.hidden = true; return; }
    els.whatifCard.hidden = false;
    var top3 = r.perApp.slice(0, 3);
    var top3Cost = top3.reduce(function (s, a) { return s + a.cost; }, 0);
    var base = state.solarOn ? r.netCost : r.grossCost;
    var cut = top3Cost * (state.whatIfPct / 100);
    var newTotal = Math.max(0, base - cut);
    els.whatifPct.textContent = state.whatIfPct + '%';
    els.whatifNew.textContent = money(newTotal);
    els.whatifSave.textContent = '−' + money(cut) + ' ' + T.whatIfSave;
  }

  function renderDonut(r) {
    var order = DATA.buckets; // fixed palette order
    var total = 0; order.forEach(function (b) { total += r.buckets[b.id]; });
    var wrap = els.donut; wrap.innerHTML = '';
    var svgWrap = h('div', 'wf-donut');
    var R = 54, C = 2 * Math.PI * R, off = 0;  // 54 + half of the 30px stroke = 69 < 70, so the ring never clips
    var svg = '<svg viewBox="0 0 140 140" role="img" aria-label="' + T.breakdown + '">';
    if (total > 0) {
      order.forEach(function (b, bi) {
        var val = r.buckets[b.id]; if (val <= 0) return;
        var frac = val / total, len = frac * C, gap = frac > 0.02 ? 1.5 : 0;
        svg += '<circle class="seg" data-i="' + bi + '" cx="70" cy="70" r="' + R + '" stroke="var(--cat-' + b.c + ')" '
          + 'stroke-dasharray="' + Math.max(0, len - gap) + ' ' + (C - Math.max(0, len - gap)) + '" '
          + 'stroke-dashoffset="' + (-off) + '"></circle>';
        off += len;
      });
    } else {
      svg += '<circle cx="70" cy="70" r="' + R + '" fill="none" stroke="hsl(var(--border))" stroke-width="26"></circle>';
    }
    svg += '</svg>';
    svgWrap.innerHTML = svg
      + '<div class="wf-donut-center"><span class="dc-top">' + (total > 0 ? money(r.grossCost) : '—') + '</span><span class="dc-bot">' + T.perYear + '</span></div>';
    wrap.appendChild(svgWrap);

    if (total > 0) {
      svgWrap.querySelectorAll('circle.seg').forEach(function (seg) {
        var b = order[parseInt(seg.getAttribute('data-i'), 10)];
        var val = r.buckets[b.id]; if (!(val > 0)) return;
        var pct = Math.round(val / total * 100);
        seg.addEventListener('pointerenter', function () {
          showTip('<b>' + (LANG === 'es' ? b.name_es : b.name) + '</b><br>' + money(val * r.price) + ' · ' + pct + '%', seg.getBoundingClientRect());
        });
        seg.addEventListener('pointerleave', hideTip);
      });
    }

    var legend = h('div', 'est-legend');
    order.forEach(function (b) {
      var kwh = r.buckets[b.id]; if (kwh <= 0) return;
      var pct = total > 0 ? Math.round(kwh / total * 100) : 0;
      var row = h('div', 'lg');
      row.innerHTML = '<span class="sw" style="background:var(--cat-' + b.c + ')"></span>'
        + '<span class="lg-name">' + (LANG === 'es' ? b.name_es : b.name) + '</span>'
        + '<span class="lg-val">' + money(kwh * r.price) + '</span>'
        + '<span class="lg-pct">' + pct + '%</span>';
      legend.appendChild(row);
    });
    wrap.appendChild(legend);
  }

  // Cheapest/priciest month, in plain language — shared by the on-screen
  // chart and the PDF report so the takeaway sentence never disagrees with
  // the bars next to it. Uses the after-solar series when solar is on, since
  // that is what the visitor would actually pay that month.
  function monthExtremes(r) {
    var arr = state.solarOn ? r.monNet : r.monGross, price = state.country.price;
    var peakM = 0, lowM = 0, m;
    for (m = 1; m < 12; m++) { if (arr[m] > arr[peakM]) peakM = m; if (arr[m] < arr[lowM]) lowM = m; }
    var peakCost = arr[peakM] * price, lowCost = arr[lowM] * price;
    return { peakM: peakM, lowM: lowM, peakCost: peakCost, lowCost: lowCost, pctDiff: lowCost > 0 ? Math.round((peakCost / lowCost - 1) * 100) : 0 };
  }
  function monthTakeaway(r) {
    var e = monthExtremes(r);
    if (e.peakM === e.lowM || e.pctDiff < 3) return '';
    var s = T.monthsFull[e.peakM] + ' ' + T.monthlyMostAt + ' ' + money(e.peakCost) + ' — ' + e.pctDiff + '% ' + T.monthlyVsCheapest + ' ' + T.monthsFull[e.lowM] + T.monthlyCheapestIs + ' ' + money(e.lowCost) + '.';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function renderMonths(r) {
    var W = 340, H = 132, pad = 4, botLbl = 16;
    var n = 12, gap = 5, bw = (W - pad * 2 - gap * (n - 1)) / n;
    var maxV = 0, m; for (m = 0; m < 12; m++) maxV = Math.max(maxV, r.monGross[m]);
    maxV = maxV || 1;
    var plotH = H - botLbl;
    var price = state.country.price;
    var avg = 0; for (m = 0; m < 12; m++) avg += r.monGross[m]; avg /= 12;
    var avgY = plotH - (avg / maxV) * plotH;
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + T.monthly + '">';
    // average line, labelled so the reference is not just a mystery dash
    svg += '<line class="mb-base-line" x1="' + pad + '" y1="' + avgY.toFixed(1) + '" x2="' + (W - pad) + '" y2="' + avgY.toFixed(1) + '"></line>';
    svg += '<text class="mb-avg-lbl" x="' + (W - pad) + '" y="' + Math.max(9, avgY - 3).toFixed(1) + '">' + T.avg + ' ' + money(avg * price) + '</text>';
    var peakM = 0; for (m = 1; m < 12; m++) if (r.monGross[m] > r.monGross[peakM]) peakM = m;
    for (m = 0; m < 12; m++) {
      var x = pad + m * (bw + gap);
      var segs = [ ['mb-base', r.monBase[m]], ['mb-cool', r.monCool[m]], ['mb-heat', r.monHeat[m]] ];
      var yTop = plotH;
      segs.forEach(function (s) {
        var val = s[1]; if (val <= 0) return;
        var hgt = (val / maxV) * plotH; if (hgt < 0.6) return;
        yTop -= hgt;
        svg += '<rect class="mb ' + s[0] + '" x="' + x.toFixed(1) + '" y="' + yTop.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (hgt - 0.8).toFixed(1) + '" rx="2"></rect>';
      });
      // month label
      svg += '<text class="mb-lbl" x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 4) + '">' + T.months[m] + '</text>';
      if (m === peakM && r.monGross[m] > 0) {
        svg += '<text class="mb-peak" x="' + (x + bw / 2).toFixed(1) + '" y="' + Math.max(9, yTop - 3).toFixed(1) + '">' + money(r.monGross[m] * price).replace(/[^\d.,]/g, '') + '</text>';
      }
      svg += '<rect class="mb-hit" data-m="' + m + '" x="' + x.toFixed(1) + '" y="0" width="' + bw.toFixed(1) + '" height="' + plotH + '" fill="transparent"></rect>';
    }
    // solar net line
    if (state.solarOn) {
      var pts = ''; for (m = 0; m < 12; m++) { var xx = pad + m * (bw + gap) + bw / 2; var yy = plotH - (r.monNet[m] / maxV) * plotH; pts += (m ? ' ' : '') + xx.toFixed(1) + ',' + yy.toFixed(1); }
      svg += '<polyline points="' + pts + '" fill="none" stroke="var(--savings, #39d089)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"></polyline>';
    }
    svg += '</svg>';
    var key = '<div class="mb-key">'
      + '<span><i style="background:var(--chart-1)"></i>' + T.base + '</span>'
      + '<span><i style="background:var(--cat-6)"></i>' + T.heat + '</span>'
      + '<span><i style="background:var(--cat-1)"></i>' + T.cool + '</span>'
      + (state.solarOn ? '<span><i style="background:var(--savings,#39d089)"></i>' + T.solarKey + '</span>' : '')
      + '</div>';
    var takeaway = monthTakeaway(r);
    els.months.innerHTML = svg + key + (takeaway ? '<p class="mb-takeaway">' + takeaway + '</p>' : '');

    els.months.querySelectorAll('.mb-hit').forEach(function (hit) {
      var mi = parseInt(hit.getAttribute('data-m'), 10);
      hit.addEventListener('pointerenter', function () {
        var gross = r.monGross[mi], net = state.solarOn ? r.monNet[mi] : gross;
        var html = '<b>' + T.monthsFull[mi] + '</b><br>' + money(gross * price)
          + (state.solarOn ? ' → ' + money(net * price) + ' ' + T.withSolar : '');
        showTip(html, hit.getBoundingClientRect());
      });
      hit.addEventListener('pointerleave', hideTip);
    });
  }

  function renderHogs(r) {
    var top = r.perApp.slice(0, 5), maxc = top.length ? top[0].cost : 1;
    els.hogs.innerHTML = '';
    if (!top.length) { els.hogs.innerHTML = '<p class="card-hint">' + T.empty + '</p>'; return; }
    top.forEach(function (a) {
      var share = r.grossCost > 0 ? Math.round(a.cost / r.grossCost * 100) : 0;
      var row = h('div', 'est-hog');
      row.innerHTML = '<span class="h-name">' + a.name + '</span>'
        + '<span class="h-val">' + money(a.cost) + T.perYr + '</span>'
        + '<span class="h-track"><span class="h-fill" style="width:' + (maxc > 0 ? (a.cost / maxc * 100).toFixed(1) : 0) + '%"></span></span>'
        + '<span class="h-share">' + share + '% ' + T.ofBillShare + '</span>';
      els.hogs.appendChild(row);
    });
  }

  // ── PDF report (print-only view, built on demand) ─────────────────────
  // Reuses compute()'s output — no separate calculation path to drift from
  // the on-screen numbers. Static/fully-labelled (no hover) since print has
  // no interaction; window.print() is the export mechanism, so the report
  // renders into a real DOM node the browser's print-to-PDF can paginate,
  // rather than a rasterised image.
  function reportMonthsSVG(r) {
    var W = 640, H = 210, padL = 34, padR = 6, botLbl = 20;
    var n = 12, gap = 8, bw = (W - padL - padR - gap * (n - 1)) / n;
    var maxV = 0, m; for (m = 0; m < 12; m++) maxV = Math.max(maxV, r.monGross[m]);
    maxV = maxV || 1;
    var plotH = H - botLbl, price = state.country.price, pad = padL;
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="' + T.reportMonthly + '">';
    // Gridlines with a real value scale — the print report has the width to
    // spare that the compact on-screen widget does not.
    var ticks = 4, gi;
    for (gi = 1; gi <= ticks; gi++) {
      var gy = plotH - (gi / ticks) * plotH, gv = Math.round((gi / ticks) * maxV * price);
      svg += '<line x1="' + padL + '" y1="' + gy.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + gy.toFixed(1) + '" stroke="#e4dbc9" stroke-width="1"></line>';
      svg += '<text x="' + (padL - 6) + '" y="' + (gy + 3).toFixed(1) + '" text-anchor="end" font-size="9" fill="#8a7c68" font-family="ui-monospace,monospace">' + gv + '</text>';
    }
    for (m = 0; m < 12; m++) {
      var x = pad + m * (bw + gap);
      var segs = [['var(--chart-1)', r.monBase[m]], ['var(--cat-1)', r.monCool[m]], ['var(--cat-6)', r.monHeat[m]]];
      var yTop = plotH;
      segs.forEach(function (s) {
        var val = s[1]; if (val <= 0) return;
        var hgt = (val / maxV) * plotH; if (hgt < 0.6) return;
        yTop -= hgt;
        svg += '<rect fill="' + s[0] + '" x="' + x.toFixed(1) + '" y="' + yTop.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (hgt - 1).toFixed(1) + '" rx="2"></rect>';
      });
      svg += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 5) + '" text-anchor="middle" font-size="10" fill="#8a7c68" font-family="ui-monospace,monospace">' + T.months[m] + '</text>';
      if (r.monGross[m] > 0) svg += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + Math.max(10, yTop - 4).toFixed(1) + '" text-anchor="middle" font-size="9.5" font-weight="700" fill="#1c1712" font-family="ui-monospace,monospace">' + Math.round(r.monGross[m] * price) + '</text>';
    }
    // Net-after-solar line — parity with the on-screen chart's green line.
    if (state.solarOn) {
      var pts = ''; for (m = 0; m < 12; m++) { var xx = pad + m * (bw + gap) + bw / 2; var yy = plotH - (r.monNet[m] / maxV) * plotH; pts += (m ? ' ' : '') + xx.toFixed(1) + ',' + yy.toFixed(1); }
      svg += '<polyline points="' + pts + '" fill="none" stroke="var(--savings, #2f9e5c)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"></polyline>';
      var lastX = pad + 11 * (bw + gap) + bw / 2, lastY = plotH - (r.monNet[11] / maxV) * plotH;
      svg += '<circle cx="' + lastX.toFixed(1) + '" cy="' + lastY.toFixed(1) + '" r="3" fill="var(--savings, #2f9e5c)"></circle>';
    }
    svg += '</svg>';
    if (state.solarOn) {
      svg += '<div class="pr-months-key"><span><i style="background:var(--chart-1)"></i>' + T.base + '</span>'
        + '<span><i style="background:var(--cat-1)"></i>' + T.cool + '</span>'
        + '<span><i style="background:var(--cat-6)"></i>' + T.heat + '</span>'
        + '<span><i style="background:var(--savings,#2f9e5c)"></i>' + T.solarKey + '</span></div>';
    }
    return svg;
  }

  // Static donut, same category colors/order as the on-screen one, plus a
  // value+percent legend — richer at a glance than a plain list of bars.
  function reportDonutSVG(r) {
    var order = DATA.buckets, total = 0; order.forEach(function (b) { total += r.buckets[b.id]; });
    var R = 58, C = 2 * Math.PI * R, off = 0;
    var svg = '<svg viewBox="0 0 150 150" width="150" height="150" role="img" aria-label="' + T.reportBreakdown + '">';
    if (total > 0) {
      order.forEach(function (b) {
        var val = r.buckets[b.id]; if (!(val > 0)) return;
        var frac = val / total, len = frac * C, gap = frac > 0.02 ? 1.5 : 0;
        svg += '<circle cx="75" cy="75" r="' + R + '" fill="none" stroke="var(--cat-' + b.c + ')" stroke-width="26" '
          + 'stroke-dasharray="' + Math.max(0, len - gap) + ' ' + (C - Math.max(0, len - gap)) + '" '
          + 'stroke-dashoffset="' + (-off) + '" transform="rotate(-90 75 75)"></circle>';
        off += len;
      });
    } else {
      svg += '<circle cx="75" cy="75" r="' + R + '" fill="none" stroke="#ddd3c0" stroke-width="26"></circle>';
    }
    svg += '<text x="75" y="71" text-anchor="middle" font-size="16" font-weight="800" fill="#1c1712" font-family="ui-monospace,monospace">' + money(total * r.price) + '</text>';
    svg += '<text x="75" y="87" text-anchor="middle" font-size="9.5" fill="#8a7c68" font-family="-apple-system,sans-serif">' + T.perYear + '</text>';
    svg += '</svg>';
    return svg;
  }

  function reportDonutLegend(r) {
    var total = 0; DATA.buckets.forEach(function (b) { total += r.buckets[b.id]; });
    var rows = '';
    DATA.buckets.forEach(function (b) {
      var kwh = r.buckets[b.id]; if (!(kwh > 0)) return;
      var pct = total > 0 ? Math.round(kwh / total * 100) : 0;
      rows += '<div class="pr-lg-row">'
        + '<span class="pr-lg-sw" style="background:var(--cat-' + b.c + ')"></span>'
        + '<span class="pr-lg-name">' + (LANG === 'es' ? b.name_es : b.name) + '</span>'
        + '<span class="pr-lg-val">' + money(kwh * r.price) + '</span>'
        + '<span class="pr-lg-pct">' + pct + '%</span></div>';
    });
    return rows;
  }

  // Two-bar magnitude comparison against the pre-filled "typical home"
  // baseline — the single vsTyp % line made visual instead of just stated.
  function reportCompareSVG(yourKwh, typicalKwh) {
    var W = 640, H = 70, labelW = 108, barW = W - labelW - 110;
    var max = Math.max(yourKwh, typicalKwh, 1);
    function row(y, label, val, color) {
      var w = Math.max(2, (val / max) * barW);
      return '<text x="' + labelW + '" y="' + (y + 15) + '" font-size="12" fill="#1c1712" font-family="-apple-system,sans-serif" text-anchor="end">' + label + '</text>'
        + '<rect x="' + (labelW + 12) + '" y="' + y + '" width="' + w.toFixed(1) + '" height="21" rx="4" fill="' + color + '"></rect>'
        + '<text x="' + (labelW + 20 + w) + '" y="' + (y + 15) + '" font-size="11.5" font-weight="700" fill="#1c1712" font-family="ui-monospace,monospace">' + nf(val) + ' ' + T.kwhUnit + '</text>';
    }
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="' + T.reportCompareTitle + '">'
      + row(4, T.reportYourHome, yourKwh, 'var(--chart-1)')
      + row(38, T.reportTypHome, typicalKwh, '#c9beac')
      + '</svg>';
  }

  function reportCo2HTML(r) {
    var kg = state.solarOn ? r.netCo2Kg : r.grossCo2Kg;
    var km = Math.round(kg * 1000 / CAR_G_PER_KM);
    return '<div class="pr-co2"><div class="pr-co2-val">' + nf(kg) + ' <span>' + T.co2Unit + '</span></div>'
      + '<div class="pr-co2-cmp">' + T.co2CarPrefix + ' <b>' + nf(km) + '</b> ' + T.co2CarSuffix + '</div></div>';
  }

  function reportTopRows(r) {
    var rows = '';
    r.perApp.forEach(function (a) {
      var share = r.grossCost > 0 ? Math.round(a.cost / r.grossCost * 100) : 0;
      rows += '<tr><td>' + a.name + '</td><td>' + nf(a.kwh) + ' ' + T.kwhUnit + '</td><td>' + money(a.cost) + '</td><td>' + share + '%</td></tr>';
    });
    return rows;
  }

  function reportRecsHTML(r) {
    var order = DATA.buckets.slice().sort(function (x, y) { return (r.buckets[y.id] || 0) - (r.buckets[x.id] || 0); });
    var picks = [];
    order.forEach(function (b) {
      if (picks.length >= 2 || !(r.buckets[b.id] > 0)) return;
      var rec = RECS[b.id]; if (rec) picks.push(rec[LANG]);
    });
    if (!state.solarOn) picks.push(SOLAR_REC[LANG]);
    var html = '';
    picks.forEach(function (p) {
      html += '<div class="pr-rec"><p>' + p.text + '</p><a class="pr-rec-link" href="' + sitePath(p.path) + '">' + p.label + ' →</a></div>';
    });
    return html;
  }

  function buildReportHTML(r) {
    var now = new Date();
    var dateStr = now.toLocaleDateString(LOC, { year: 'numeric', month: 'long', day: 'numeric' });
    var bl = baselineKwh();
    var diff = bl > 0 ? Math.round((r.grossKwh / bl - 1) * 100) : 0;
    var vsWord = Math.abs(diff) < 3 ? T.same : (diff > 0 ? T.above : T.below);
    var val = state.solarOn ? r.netCost : r.grossCost;
    var kwh = state.solarOn ? r.netKwh : r.grossKwh;
    var appLbl = LANG === 'es' ? 'Aparato' : 'Appliance', costLbl = LANG === 'es' ? 'Coste' : 'Cost';
    var yrLbl = LANG === 'es' ? 'kWh/año' : 'kWh/yr';

    return ''
      + '<div class="pr-head"><div class="pr-brand">WattFigures</div>'
      + '<div class="pr-meta">' + T.reportGenerated + ' ' + dateStr + ' · wattfigures.com/estimator</div></div>'
      + '<h1 class="pr-h1">' + T.reportTitle + '</h1>'
      + '<div class="pr-setup">'
      + '<div><span class="pr-setup-lbl">' + T.country + '</span><span class="pr-setup-val">' + (LANG === 'es' ? state.country.name_es : state.country.name) + '</span></div>'
      + '<div><span class="pr-setup-lbl">' + T.reportPrice + '</span><span class="pr-setup-val">' + priceLabel(state.country) + '</span></div>'
      + '<div><span class="pr-setup-lbl">' + T.reportPeopleLbl + '</span><span class="pr-setup-val">' + state.people + '</span></div>'
      + '<div><span class="pr-setup-lbl">' + T.reportSolarLbl + '</span><span class="pr-setup-val">' + (state.solarOn ? state.kwp + ' kWp' : T.reportNoSolar) + '</span></div>'
      + '</div>'
      + '<div class="pr-hero">'
      + '<div class="pr-hero-val">' + money(val) + '<span class="pr-hero-unit">' + T.perYear + '</span></div>'
      + '<div class="pr-hero-sub">' + money(val / 12) + T.perMonth + ' · ' + nf(kwh) + ' ' + T.kwhUnit + '</div>'
      + (bl > 0 ? '<div class="pr-hero-cmp">' + (Math.abs(diff) < 3 ? '' : Math.abs(diff) + '% ') + vsWord + ' ' + T.vsTyp + '</div>' : '')
      + (state.solarOn && r.solarPct > 0 ? '<div class="pr-hero-solar">' + T.reportSolarCov + ' ' + r.solarPct + '% ' + T.reportSolarCov2 + ' ' + money(r.solarSaveCost) + T.reportPerYear + '</div>' : '')
      + '</div>'
      + (bl > 0 ? '<h2 class="pr-h2">' + T.reportCompareTitle + '</h2><div class="pr-compare">' + reportCompareSVG(r.grossKwh, bl) + '</div>' : '')
      + '<h2 class="pr-h2">' + T.reportBreakdown + '</h2>'
      + '<div class="pr-donut-wrap"><div class="pr-donut">' + reportDonutSVG(r) + '</div><div class="pr-legend">' + reportDonutLegend(r) + '</div></div>'
      + '<h2 class="pr-h2">' + T.co2Title + '</h2><p class="pr-hint">' + T.co2Hint + '</p>'
      + reportCo2HTML(r)
      + '<h2 class="pr-h2">' + T.reportMonthly + '</h2>'
      + '<div class="pr-months">' + reportMonthsSVG(r) + '</div>'
      + (monthTakeaway(r) ? '<p class="pr-hint pr-takeaway">' + monthTakeaway(r) + '</p>' : '')
      + '<h2 class="pr-h2">' + T.reportTop + '</h2>'
      + '<table class="pr-table"><thead><tr><th>' + appLbl + '</th><th>' + yrLbl + '</th><th>' + costLbl + '</th><th>' + T.reportOfBill + '</th></tr></thead><tbody>' + reportTopRows(r) + '</tbody></table>'
      + '<h2 class="pr-h2">' + T.reportRecs + '</h2>'
      + '<div class="pr-recs">' + reportRecsHTML(r) + '</div>'
      + '<div class="pr-foot"><p>' + T.reportFooter + '</p><p class="pr-continue">' + T.reportContinue + ': ' + shareURL().replace(/^https?:\/\//, '') + '</p></div>';
  }

  function downloadReport() {
    var r = compute();
    if (!r.perApp.length || !els.report) return;
    els.report.innerHTML = buildReportHTML(r);
    document.body.classList.add('printing-report');
    var cleanup = function () { document.body.classList.remove('printing-report'); window.removeEventListener('afterprint', cleanup); };
    window.addEventListener('afterprint', cleanup);
    setTimeout(function () { window.print(); }, 30);
  }

  // ── Render: controls + builder ─────────────────────────────────────────
  function buildPicker() {
    var pick = h('div', 'country-picker');
    var btn = h('button', 'cp-btn'); btn.type = 'button'; btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false');
    function btnHtml(c) {
      return '<img class="flag" src="' + flagSrc(c.code) + '" alt="" width="24" height="16">'
        + '<span class="cp-name">' + (LANG === 'es' ? c.name_es : c.name) + '</span>'
        + '<span class="cp-price">' + priceLabel(c) + '</span>' + svgIco('chev', 'cp-chev');
    }
    btn.innerHTML = btnHtml(state.country);
    var panel = h('div', 'cp-panel'); panel.hidden = true;
    var search = h('input', 'cp-search'); search.type = 'search'; search.setAttribute('aria-label', T.country); search.placeholder = LANG === 'es' ? 'Buscar país…' : 'Search country…';
    var list = h('div', 'cp-list'); list.setAttribute('role', 'listbox');
    panel.appendChild(search); panel.appendChild(list);

    function renderList(filter) {
      list.innerHTML = ''; var f = (filter || '').toLowerCase().trim(), any = false;
      PRICES.forEach(function (c) {
        var nm = (LANG === 'es' ? c.name_es : c.name);
        if (f && nm.toLowerCase().indexOf(f) < 0 && c.code.toLowerCase().indexOf(f) < 0) return;
        any = true;
        var o = h('button', 'cp-opt'); o.type = 'button'; o.setAttribute('role', 'option');
        if (c.code === state.country.code) o.setAttribute('aria-selected', 'true');
        o.innerHTML = '<img class="flag" src="' + flagSrc(c.code) + '" alt="" width="24" height="16">'
          + '<span class="cp-name">' + nm + '</span><span class="cp-price">' + priceLabel(c) + '</span>';
        o.addEventListener('click', function () {
          state.country = c; if (!state.hemi) { /* keep auto */ }
          btn.innerHTML = btnHtml(c); closePanel(); syncHemiButtons(); render();
        });
        list.appendChild(o);
      });
      if (!any) list.appendChild(h('div', 'cp-empty', LANG === 'es' ? 'Sin resultados' : 'No matches'));
    }
    function openPanel() { panel.hidden = false; btn.setAttribute('aria-expanded', 'true'); renderList(''); search.value = ''; setTimeout(function () { search.focus(); document.addEventListener('click', onDoc); }, 0); }
    function closePanel() { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); document.removeEventListener('click', onDoc); }
    function onDoc(e) { if (!pick.contains(e.target)) closePanel(); }
    btn.addEventListener('click', function () { panel.hidden ? openPanel() : closePanel(); });
    search.addEventListener('input', function () { renderList(search.value); });
    search.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closePanel(); btn.focus(); } });
    pick.appendChild(btn); pick.appendChild(panel);
    return pick;
  }

  function syncHemiButtons() {
    if (!els.hemiN) return;
    var hemi = resolvedHemi();
    els.hemiN.setAttribute('aria-pressed', hemi === 'n' ? 'true' : 'false');
    els.hemiS.setAttribute('aria-pressed', hemi === 's' ? 'true' : 'false');
  }

  function buildControls() {
    var wrap = h('div', 'est-controls');

    var cCtl = h('div', 'est-ctl est-ctl-wide');
    cCtl.appendChild(h('span', 'lbl', svgIco('bolt') + T.country));
    cCtl.appendChild(buildPicker());
    wrap.appendChild(cCtl);

    // People
    var pCtl = h('div', 'est-ctl');
    pCtl.appendChild(h('span', 'lbl', svgIco('people') + T.people));
    var pStep = h('div', 'step');
    var pMinus = h('button', null, '−'); pMinus.type = 'button'; pMinus.setAttribute('aria-label', '−');
    var pIn = h('input'); pIn.type = 'text'; pIn.inputMode = 'numeric'; pIn.value = state.people; pIn.setAttribute('aria-label', T.people);
    var pPlus = h('button', null, '+'); pPlus.type = 'button'; pPlus.setAttribute('aria-label', '+');
    pMinus.addEventListener('click', function () { state.people = clamp(state.people - 1, 1, 12); pIn.value = state.people; render(); });
    pPlus.addEventListener('click', function () { state.people = clamp(state.people + 1, 1, 12); pIn.value = state.people; render(); });
    pIn.addEventListener('change', function () { state.people = clamp(parseInt(pIn.value, 10) || 1, 1, 12); pIn.value = state.people; render(); });
    pStep.appendChild(pMinus); pStep.appendChild(pIn); pStep.appendChild(pPlus);
    pCtl.appendChild(pStep); wrap.appendChild(pCtl);

    // Hemisphere
    var hCtl = h('div', 'est-ctl');
    hCtl.appendChild(h('span', 'lbl', T.hemisphere));
    var seg = h('div', 'seg');
    els.hemiN = h('button', null, T.north); els.hemiN.type = 'button';
    els.hemiS = h('button', null, T.south); els.hemiS.type = 'button';
    els.hemiN.addEventListener('click', function () { state.hemi = 'n'; syncHemiButtons(); render(); });
    els.hemiS.addEventListener('click', function () { state.hemi = 's'; syncHemiButtons(); render(); });
    seg.appendChild(els.hemiN); seg.appendChild(els.hemiS);
    hCtl.appendChild(seg); wrap.appendChild(hCtl);
    syncHemiButtons();

    // Solar
    var sCtl = h('div', 'est-ctl est-ctl-wide');
    var solar = h('div', 'est-solar');
    var lbl = h('label', 'switch-lbl');
    var sw = h('span', 'switch'); var swIn = h('input'); swIn.type = 'checkbox'; swIn.checked = state.solarOn; swIn.setAttribute('aria-label', T.solar);
    sw.appendChild(swIn); sw.appendChild(h('span', 'track'));
    lbl.appendChild(sw);
    var solarText = h('span', null, svgIco('solar') + ' ' + T.solar); solarText.style.display = 'inline-flex'; solarText.style.alignItems = 'center'; solarText.style.gap = '.4rem';
    lbl.appendChild(solarText);
    var kwpBox = h('span', 'solar-kwp'); kwpBox.hidden = !state.solarOn;
    kwpBox.appendChild(document.createTextNode(T.kwp + ':'));
    var kwpIn = h('input'); kwpIn.type = 'number'; kwpIn.min = '0.5'; kwpIn.max = '30'; kwpIn.step = '0.5'; kwpIn.value = state.kwp; kwpIn.setAttribute('aria-label', T.kwp + ' (kWp)');
    kwpBox.appendChild(kwpIn); kwpBox.appendChild(document.createTextNode('kWp'));
    swIn.addEventListener('change', function () { state.solarOn = swIn.checked; kwpBox.hidden = !state.solarOn; render(); });
    kwpIn.addEventListener('input', function () { state.kwp = clamp(parseFloat(kwpIn.value) || 3, 0.5, 30); render(); });
    solar.appendChild(lbl); solar.appendChild(kwpBox);
    sCtl.appendChild(solar); wrap.appendChild(sCtl);

    return wrap;
  }

  function buildGroups() {
    var wrap = h('div', 'est-groups');
    DATA.groups.forEach(function (g) {
      var apps = DATA.appliances.filter(function (a) { return a.group === g.id; });
      if (!apps.length) return;
      var det = h('details', 'est-group');
      var sum = document.createElement('summary');
      sum.innerHTML = '<span class="g-ico">' + svgIco(g.icon) + '</span>'
        + '<span class="g-name">' + (LANG === 'es' ? g.name_es : g.name) + '</span>'
        + '<span class="g-count" data-gcount="' + g.id + '"></span>' + svgIco('chev', 'g-chev');
      det.appendChild(sum);
      var rows = h('div', 'est-rows');
      apps.forEach(function (a) {
        var row = h('div', 'est-row'); row.dataset.app = a.id;
        var kwhTxt = nf(a.kwh) + ' ' + T.kwhUnit + T.perYr + (a.people ? ' · ' + (LANG === 'es' ? 'por persona' : 'per person') : '');
        row.innerHTML = '<span class="r-name">' + (LANG === 'es' ? a.name_es : a.name) + '<span class="r-kwh">' + kwhTxt + '</span></span>';
        var step = h('div', 'step');
        var minus = h('button', null, '−'); minus.type = 'button'; minus.setAttribute('aria-label', '−');
        var inp = h('input'); inp.type = 'text'; inp.inputMode = 'numeric'; inp.value = state.qty[a.id]; inp.setAttribute('aria-label', (LANG === 'es' ? a.name_es : a.name));
        var plus = h('button', null, '+'); plus.type = 'button'; plus.setAttribute('aria-label', '+');
        function set(v) { state.qty[a.id] = clamp(v, 0, 99); inp.value = state.qty[a.id]; row.classList.toggle('on', state.qty[a.id] > 0); updateCounts(); render(); }
        minus.addEventListener('click', function () { set((state.qty[a.id] || 0) - 1); });
        plus.addEventListener('click', function () { set((state.qty[a.id] || 0) + 1); });
        inp.addEventListener('change', function () { set(parseInt(inp.value, 10) || 0); });
        step.appendChild(minus); step.appendChild(inp); step.appendChild(plus);
        row.appendChild(step);
        row.classList.toggle('on', state.qty[a.id] > 0);
        rows.appendChild(row);
      });
      det.appendChild(rows);
      wrap.appendChild(det);
    });
    return wrap;
  }

  function updateCounts() {
    DATA.groups.forEach(function (g) {
      var el = mount.querySelector('[data-gcount="' + g.id + '"]'); if (!el) return;
      var apps = DATA.appliances.filter(function (a) { return a.group === g.id; });
      var on = 0, kwh = 0; apps.forEach(function (a) { var q = state.qty[a.id] || 0; if (q > 0) { on++; kwh += a.kwh * q * (a.people ? peopleFactor() : 1); } });
      el.textContent = on ? on + ' ' + T.on + ' · ' + nf(kwh) + ' ' + T.kwhUnit : '';
    });
  }

  /* The side column used to carry all six result panels while the accordion on
     the left ran out of content halfway down, leaving a dead half-screen on
     desktop. Only the headline estimate and the donut stay beside the builder —
     short enough that the sticky positioning finally does something — and the
     rest move to a full-width grid underneath, which fills the gap and gives
     the charts more room. Returns both containers; rebuild() places them. */
  function buildSide() {
    var side = h('div', 'est-side');
    side.appendChild(stepHead(3, T.s3, T.s3d));
    var hero = h('div', 'est-hero');
    hero.innerHTML = '<span class="eh-cap">' + T.estBill + '</span>'
      + '<div class="eh-year" aria-live="polite"></div>'
      + '<div class="eh-sub"></div>'
      + '<div class="eh-cmp"></div>'
      + '<div class="eh-solar" hidden></div>';
    els.year = hero.querySelector('.eh-year'); els.sub = hero.querySelector('.eh-sub');
    els.cmp = hero.querySelector('.eh-cmp'); els.solar = hero.querySelector('.eh-solar');
    side.appendChild(hero);

    var dCard = h('div', 'est-card');
    dCard.innerHTML = '<h3>' + T.breakdown + '</h3><p class="card-hint">' + T.breakdownHint + '</p>';
    els.donut = h('div', 'wf-donut-wrap'); dCard.appendChild(els.donut); side.appendChild(dCard);

    var results = h('div', 'est-results');

    var cCard = h('div', 'est-card');
    cCard.innerHTML = '<h3>' + T.co2Title + '</h3><p class="card-hint">' + T.co2Hint + '</p>';
    els.co2 = h('div', 'est-co2'); cCard.appendChild(els.co2); results.appendChild(cCard);

    var mCard = h('div', 'est-card');
    mCard.innerHTML = '<h3>' + T.monthly + '</h3><p class="card-hint">' + T.monthlyHint + '</p>';
    els.months = h('div', 'wf-months'); mCard.appendChild(els.months); results.appendChild(mCard);

    var hCard = h('div', 'est-card');
    hCard.innerHTML = '<h3>' + T.actTitle + '</h3><p class="card-hint">' + T.actHint + '</p>';
    els.hogs = h('div', 'est-hogs'); hCard.appendChild(els.hogs); results.appendChild(hCard);

    var wCard = h('div', 'est-card whatif-card'); els.whatifCard = wCard;
    wCard.innerHTML = '<h3>' + T.whatIfTitle + '</h3><p class="card-hint">' + T.whatIfHint + '</p>'
      + '<div class="whatif">'
      + '<div class="whatif-row"><span>' + T.whatIfCut + '</span><span class="whatif-pct"></span></div>'
      + '<input type="range" class="whatif-slider" min="0" max="50" step="5" value="' + state.whatIfPct + '" aria-label="' + T.whatIfCut + '">'
      + '<div class="whatif-result"><span class="whatif-lbl">' + T.whatIfNewTotal + '</span><span class="whatif-new"></span><span class="whatif-save"></span></div>'
      + '</div>';
    els.whatifPct = wCard.querySelector('.whatif-pct');
    els.whatifNew = wCard.querySelector('.whatif-new');
    els.whatifSave = wCard.querySelector('.whatif-save');
    wCard.querySelector('.whatif-slider').addEventListener('input', function (e) {
      state.whatIfPct = parseInt(e.target.value, 10) || 0;
      if (lastResult) renderWhatIf(lastResult);
    });
    results.appendChild(wCard);

    var actions = h('div', 'est-actions');
    var copy = h('button', 'btn btn-ghost', T.copy); copy.type = 'button';
    copy.addEventListener('click', function () {
      var url = shareURL();
      var done = function () { copy.textContent = T.copied; setTimeout(function () { copy.textContent = T.copy; }, 1600); };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, done); else done();
    });
    actions.appendChild(copy);
    var imgBtn = h('button', 'btn btn-ghost', T.download); imgBtn.type = 'button';
    imgBtn.addEventListener('click', function () { exportImage(imgBtn); });
    actions.appendChild(imgBtn);
    var pdfBtn = h('button', 'btn btn-primary', T.reportBtn); pdfBtn.type = 'button';
    pdfBtn.addEventListener('click', downloadReport);
    actions.appendChild(pdfBtn);
    var reset = h('button', 'btn btn-ghost', T.reset); reset.type = 'button';
    reset.addEventListener('click', function () { state.qty = defaultQty(); state.people = DATA.meta.peopleDefault || 3; state.solarOn = false; state.hemi = null; rebuild(); });
    actions.appendChild(reset);
    results.appendChild(actions);
    return { side: side, results: results };
  }

  // ── Shareable image export (canvas, client-side only) ─────────────────
  function roundRect(ctx, x, y, w, h2, rad) {
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h2, rad);
    ctx.arcTo(x + w, y + h2, x, y + h2, rad);
    ctx.arcTo(x, y + h2, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }
  function exportImage(btn) {
    var r = compute();
    if (!r.perApp.length) return;
    var draw = function () {
      var cs = getComputedStyle(document.documentElement);
      var hslv = function (name) { var v = cs.getPropertyValue(name).trim(); return v ? 'hsl(' + v + ')' : '#888'; };
      var W = 1200, H = 630;
      var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      var ctx = cv.getContext('2d');
      ctx.fillStyle = hslv('--background'); ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = hslv('--surface'); roundRect(ctx, 36, 36, W - 72, H - 72, 22); ctx.fill();
      ctx.strokeStyle = hslv('--border'); ctx.lineWidth = 1.5; roundRect(ctx, 36, 36, W - 72, H - 72, 22); ctx.stroke();

      ctx.fillStyle = hslv('--accent-ink'); ctx.font = '700 24px Inter, sans-serif';
      ctx.fillText('WattFigures', 76, 104);
      ctx.fillStyle = hslv('--muted-foreground'); ctx.font = '600 16px Inter, sans-serif';
      ctx.fillText(LANG === 'es' ? 'Mi estimación de electricidad' : 'My electricity estimate', 76, 130);

      var val = state.solarOn ? r.netCost : r.grossCost;
      ctx.fillStyle = hslv('--foreground'); ctx.font = '800 78px "JetBrains Mono", monospace';
      ctx.fillText(money(val), 76, 232);
      ctx.fillStyle = hslv('--muted-foreground'); ctx.font = '600 20px Inter, sans-serif';
      ctx.fillText((LANG === 'es' ? 'al año' : 'per year') + ' · ' + nf(state.solarOn ? r.netKwh : r.grossKwh) + ' ' + T.kwhUnit, 76, 262);

      var top = r.perApp.slice(0, 4), maxc = top.length ? top[0].cost : 1, by = 330;
      top.forEach(function (a, i) {
        var y = by + i * 62;
        ctx.font = '600 19px Inter, sans-serif'; ctx.textAlign = 'left';
        ctx.fillStyle = hslv('--foreground'); ctx.fillText(a.name, 76, y);
        ctx.fillStyle = hslv('--muted-foreground'); ctx.textAlign = 'right';
        ctx.fillText(money(a.cost) + T.perYr, W - 76, y); ctx.textAlign = 'left';
        var bw = (W - 152) * (a.cost / maxc);
        ctx.fillStyle = hslv('--surface-2'); roundRect(ctx, 76, y + 14, W - 152, 10, 5); ctx.fill();
        ctx.fillStyle = hslv('--accent'); roundRect(ctx, 76, y + 14, Math.max(10, bw), 10, 5); ctx.fill();
      });

      ctx.fillStyle = hslv('--muted-foreground'); ctx.font = '600 15px Inter, sans-serif';
      ctx.fillText('wattfigures.com/estimator', 76, H - 60);

      cv.toBlob(function (blob) {
        if (!blob) return;
        var a = document.createElement('a'); var url = URL.createObjectURL(blob);
        a.href = url; a.download = 'wattfigures-estimate.png';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        if (btn) { var was = btn.textContent; btn.textContent = T.downloaded; setTimeout(function () { btn.textContent = was; }, 1600); }
      });
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw); else draw();
  }

  function stepHead(n, title, desc) {
    var el = h('div', 'est-step');
    el.innerHTML = '<span class="es-n">' + n + '</span>'
      + '<span class="es-txt"><span class="es-t">' + title + '</span>'
      + '<span class="es-d">' + desc + '</span></span>';
    return el;
  }

  function rebuild() {
    mount.innerHTML = '';
    mount.style.position = 'relative';
    var layout = h('div', 'est-layout');
    var build = h('div', 'est-build');
    build.appendChild(stepHead(1, T.s1, T.s1d));
    build.appendChild(buildControls());
    build.appendChild(stepHead(2, T.s2, T.s2d));
    var note = h('p', 'card-hint'); note.style.margin = '0 0 .8rem'; note.textContent = T.prefill;
    build.appendChild(note);
    // expand/collapse
    var bar = h('div', 'est-actions'); bar.style.margin = '0 0 .9rem';
    var exp = h('button', 'btn btn-ghost', T.expand); exp.type = 'button';
    var col = h('button', 'btn btn-ghost', T.collapse); col.type = 'button';
    exp.addEventListener('click', function () { mount.querySelectorAll('.est-group').forEach(function (d) { d.open = true; }); });
    col.addEventListener('click', function () { mount.querySelectorAll('.est-group').forEach(function (d) { d.open = false; }); });
    bar.appendChild(exp); bar.appendChild(col);
    build.appendChild(bar);
    build.appendChild(buildGroups());
    layout.appendChild(build);
    var panels = buildSide();
    layout.appendChild(panels.side);
    mount.appendChild(layout);
    // Full-width row of secondary panels, below the two-column area.
    mount.appendChild(panels.results);
    // Was the side column; now that the panels live in two containers the flag
    // belongs on the mount that holds both.
    els.results = mount;
    els.tip = h('div', 'dash-tip'); els.tip.hidden = true; els.tip.setAttribute('role', 'tooltip');
    mount.appendChild(els.tip);
    // Lives on <body>, not in mount — printing hides every other direct
    // child of body, so this must be a sibling to survive that and to
    // outlast mount.innerHTML resets on "Reset to typical home".
    if (!els.report) { els.report = h('div', 'wf-print-report'); els.report.setAttribute('aria-hidden', 'true'); document.body.appendChild(els.report); }
    updateCounts(); render();
  }

  // ── Boot ───────────────────────────────────────────────────────────────
  function fetchJSON(u) { return fetch(u, { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }); }
  var base = mount.getAttribute('data-base') || '';
  Promise.all([fetchJSON(base + 'data/estimator-appliances.json'), fetchJSON(base + 'data/energy-prices.json')])
    .then(function (res) {
      DATA = res[0]; var pj = res[1];
      if (!DATA || !pj || !pj.countries) { mount.innerHTML = '<p class="est-empty">Estimator data unavailable.</p>'; return; }
      PRICES = pj.countries;
      // patch flag src base if page is nested (es/estimator/)
      flagSrc = function (code) { return base + 'assets/img/flags/' + code.toLowerCase() + '.svg'; };
      state = { country: null, people: DATA.meta.peopleDefault || 3, hemi: null, solarOn: false, kwp: 3, qty: defaultQty(), whatIfPct: 20 };
      state.country = PRICES.filter(function (c) { return c.code === (LANG === 'es' ? 'ES' : 'US'); })[0] || PRICES[0];
      readURL();
      rebuild();
    })
    .catch(function () { mount.innerHTML = '<p class="est-empty">Estimator data unavailable.</p>'; });
})();
