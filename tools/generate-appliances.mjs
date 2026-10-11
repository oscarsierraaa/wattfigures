#!/usr/bin/env node
/*
  generate-appliances.mjs — build the programmatic appliance running-cost pages
  from data/appliances.json. Run from the site root:  node tools/generate-appliances.mjs

  For every appliance × language it renders templates/article-appliance.html to
  appliances/<slug>/index.html (+ es/appliances/<slug>/). It then rebuilds the
  card block between <!-- CARDS:START --> / <!-- CARDS:END --> in both appliance
  section indexes (deterministic → idempotent: a second run makes no diff) and
  writes data/appliance-index.json for the home appliance finder.

  Pages are og:type=website on purpose so they stay out of the RSS feed
  (generate-rss.mjs only picks up og:type=article). Sitemap picks them up
  automatically (filesystem walk). Idempotent; safe to re-run any time.
*/
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { renderFile } from './template-engine.mjs';
import { uiStrings, sectionLabel, ogLocale } from './site-i18n.mjs';
import { buildFlags, buildBase } from './site-context.mjs';
import { artUrl, hasPhoto } from './appliance-art.mjs';
import { typicalYearlyKwh, energyProfile } from './appliance-energy.mjs';
import { COUNTRY_PAGES, countrySlug } from './country-pages.mjs';
import { nf, moneyLabel, usdTotal } from './money.mjs';
import { jsonObjectLineSpans, blameRangeDate } from './git-dates.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const templatesDir = path.join(ROOT, 'templates');
const cfg = JSON.parse(readFileSync(path.join(ROOT, 'site.config.json'), 'utf-8'));
const appliancesRaw = readFileSync(path.join(ROOT, 'data', 'appliances.json'), 'utf-8');
const data = JSON.parse(appliancesRaw);
// dateModified per appliance, honestly: not one uniform meta.date for all 30
// (audit 30-07-2026 — the oven's duty-cycle recalibration on 28-07 never
// moved its dateModified because every appliance shared data.meta.date).
// Each appliance's own object in the JSON has its own commit history even
// though they all live in one file, so blame the exact lines that feed this
// page rather than the file as a whole.
const applianceSpans = jsonObjectLineSpans(appliancesRaw, 'slug');
const appliancesRelPath = 'data/appliances.json';
const modifiedDate = (slug, fallback) => {
  const span = applianceSpans[slug];
  if (!span) return fallback;
  return blameRangeDate(ROOT, appliancesRelPath, span[0], span[1], fallback);
};

const SECTION = 'appliances';
const section = (cfg.sections || []).find(s => s.slug === SECTION);
if (!section) { console.error(`Config has no "${SECTION}" section.`); process.exit(1); }
const langs = cfg.languages;
const flags = buildFlags(cfg);
const base = buildBase(cfg);
const meta = data.meta || {};
/* One price per country, from the dataset that also drives the country picker,
   the dashboard and the other generators. It used to read meta.priceDefaults,
   which still said 0.25 €/kWh for Spain while energy-prices.json says 0.19 —
   so every Spanish card figure and meta description disagreed with the widget
   sitting right below it on the same page. */
const prices = JSON.parse(readFileSync(path.join(ROOT, 'data', 'energy-prices.json'), 'utf-8'));
const price0 = (lang) => {
  const code = lang === 'es' ? 'ES' : 'US';
  const c = prices.countries.find(c => c.code === code);
  // No fallback on purpose. A hardcoded default here is how 0.25 EUR/kWh
  // survived after the dataset moved to 0.19: it never failed, it just printed
  // a stale price on 60 pages. Missing data should stop the build instead.
  if (!c || typeof c.price !== 'number') {
    throw new Error(`energy-prices.json has no usable price for ${code} — cannot generate ${lang} appliance pages.`);
  }
  return c.price;
};

// ── grammar helpers for names used mid-sentence ─────────────────────────────
// Names in appliances.json are stored capitalised for headings ("Air
// conditioner"). Dropped into a sentence they need lowercasing and a correct
// article — but acronyms must survive ("LED bulb", "Wi-Fi router").

// True for a first word that must keep its capitals: LED, TV, PC, Wi-Fi…
// \p{Ll} (not [a-z]) so accented Spanish names like "Frigorífico" or
// "Portátil" are read as ordinary words, not acronyms.
const isAcronym = (word) => !/^.[\p{Ll}'’-]*$/u.test(word);

// "Air conditioner" → "air conditioner"; "LED bulb" → "LED bulb".
const lower = (name) => {
  const first = String(name).split(' ')[0];
  return isAcronym(first) ? name : name.charAt(0).toLowerCase() + name.slice(1);
};

// "an" before a vowel sound. Acronyms go by letter name, so LED → "an LED"
// (el-ee-dee) while Wi-Fi → "a Wi-Fi".
const AN_LETTERS = 'AEFHILMNORSX';
const artEn = (name) => {
  const first = String(name).split(' ')[0];
  const c = first.charAt(0).toUpperCase();
  const vowel = isAcronym(first) ? AN_LETTERS.includes(c) : 'AEIOU'.includes(c);
  return vowel ? 'an' : 'a';
};

// Spanish gender. Heuristic on the head noun (correct for all 30 current
// appliances); override per appliance with "gender_es": "f" in appliances.json
// when the heuristic guesses wrong.
const artEs = (a, name) => {
  if (a && a.gender_es) return a.gender_es === 'f' ? 'una' : 'un';
  const head = String(name).split(' ')[0].toLowerCase();
  return /a$/.test(head) ? 'una' : 'un';
};

// Extra UI strings this template needs (kept local; not chrome-wide).
const T = {
  en: { WATTAGE: 'Wattage and running cost', TIPS: (n) => `How to cut ${lower(n)} running costs`, CALCLINK: 'Customize this in the full electricity cost calculator', TYP: 'Typical', MIN: 'Low', MAX: 'High', PERCYCLE: 'Energy per cycle', USE: 'Typical use', ALWAYS: 'Runs continuously',
    PERHOUR: 'Per hour of use', PERDAY: 'Per day', PERWEEK: 'Per week', PERMONTH: 'Per month', PERYEAR: 'Per year', PERSEASON: 'Per season',
    COUNTRIES: (n) => `What ${artEn(n)} ${lower(n)} costs in other countries`, THCOUNTRY: 'Country', THUSD: 'Per year (US$)' },
  es: { WATTAGE: 'Potencia y coste de funcionamiento', TIPS: (n, a) => `Cómo reducir el coste de tener ${artEs(a, n)} ${lower(n)}`, CALCLINK: 'Ajústalo en la calculadora completa de coste eléctrico', TYP: 'Típica', MIN: 'Baja', MAX: 'Alta', PERCYCLE: 'Energía por ciclo', USE: 'Uso típico', ALWAYS: 'Funciona de continuo',
    PERHOUR: 'Por hora de uso', PERDAY: 'Al día', PERWEEK: 'A la semana', PERMONTH: 'Al mes', PERYEAR: 'Al año', PERSEASON: 'Por temporada',
    COUNTRIES: (n, a) => `Cuánto cuesta ${artEs(a, n)} ${lower(n)} en otros países`, THCOUNTRY: 'País', THUSD: 'Al año (US$)' },
};

// The SXO analysis in the audit of 30-07-2026 found the format Google
// rewards for these queries is a dedicated calculator, and that
// /calculators/ was buried — every appliance page linked the same generic
// electricity-cost calculator regardless of fit. Where a purpose-built one
// already exists, send the reader there instead; only appliances with no
// real match fall back to the general one.
const CALC_MATCH = {
  'air-conditioner': ['air-conditioning', { en: 'Compare it in the air conditioning cost calculator', es: 'Compáralo en la calculadora de coste del aire acondicionado' }],
  'washing-machine': ['laundry-cost', { en: 'Compare it in the washer and dryer cost calculator', es: 'Compáralo en la calculadora de coste de lavadora y secadora' }],
  'tumble-dryer': ['laundry-cost', { en: 'Compare it in the washer and dryer cost calculator', es: 'Compáralo en la calculadora de coste de lavadora y secadora' }],
  'led-bulb': ['led-vs-halogen', { en: 'See the savings in the LED vs halogen calculator', es: 'Mira el ahorro en la calculadora de LED frente a halógeno' }],
  'space-heater': ['heat-pump-vs-gas', { en: 'Compare it against a heat pump or gas boiler', es: 'Compáralo con una bomba de calor o una caldera de gas' }],
  'electric-water-heater': ['heat-pump-vs-gas', { en: 'Compare it against a heat pump or gas boiler', es: 'Compáralo con una bomba de calor o una caldera de gas' }],
  'game-console': ['standby-power', { en: 'Check what its standby mode really costs', es: 'Comprueba lo que cuesta de verdad su modo reposo' }],
  'wifi-router': ['standby-power', { en: 'Check what it costs left on standby', es: 'Comprueba lo que cuesta dejarlo en reposo' }],
  'desktop-pc': ['standby-power', { en: 'Check what its standby mode really costs', es: 'Comprueba lo que cuesta de verdad su modo reposo' }],
  'laptop': ['standby-power', { en: 'Check what it costs left charging on standby', es: 'Comprueba lo que cuesta dejarlo cargando en reposo' }],
  'led-tv': ['standby-power', { en: 'Check what its standby mode really costs', es: 'Comprueba lo que cuesta de verdad su modo reposo' }],
  'sound-system': ['standby-power', { en: 'Check what it costs left on standby', es: 'Comprueba lo que cuesta dejarlo en reposo' }],
};

const catLabel = (id, lang) => {
  const c = (data.categories || []).find(x => x.id === id);
  if (!c) return id;
  return (lang === 'es' && c.label_es) || c.label || id;
};

// ── output/field helpers (mirror the calculator pages) ──────────────────────
const money = (f, r, lang) => lang === 'es'
  ? `<output data-calc-out="${f}" data-calc-round="${r}" data-calc-suffix=" €" data-calc-format="locale" data-money></output>`
  : `<output data-calc-out="${f}" data-calc-round="${r}" data-calc-prefix="$" data-money></output>`;
const numOut = (f, r, suf) => `<output data-calc-out="${f}" data-calc-round="${r}" data-calc-suffix="${suf}"></output>`;
const moneyId = (id, f, r, lang) => money(f, r, lang).replace('<output ', `<output id="${id}" `);
const field = (label, v, def, unit, step = 'any') =>
  `          <label class="calc-field"><span>${label}</span>
            <span class="calc-inputwrap"><input class="has-unit" type="number" inputmode="decimal" min="0" step="${step}" value="${def}" data-calc-var="${v}"><span class="unit">${unit}</span></span>
          </label>`;
// Electricity-price field wired to the country selector + a country/provider
// picker prepended to every appliance mini-calc.
const priceField = (label, def, unit) =>
  `          <label class="calc-field"><span>${label}</span>
            <span class="calc-inputwrap"><input class="has-unit" type="number" inputmode="decimal" min="0" step="0.01" value="${def}" data-calc-var="price" data-country-price><span class="unit" data-cur-unit>${unit}</span></span>
          </label>`;
const countryFields = (lang, rel) => lang === 'es'
  ? `          <label class="calc-field"><span>País (fija un precio típico)</span>
            <span class="calc-inputwrap" data-country data-prices-src="${rel}data/energy-prices.json"><select class="country-select" aria-label="País"></select></span>
          </label>
          <label class="calc-field" data-provider-field hidden><span>Compañía / tarifa (opcional)</span>
            <span class="calc-inputwrap"><select class="provider-select" aria-label="Compañía"></select></span>
          </label>`
  : `          <label class="calc-field"><span>Country (sets a typical price)</span>
            <span class="calc-inputwrap" data-country data-prices-src="${rel}data/energy-prices.json"><select class="country-select" aria-label="Country"></select></span>
          </label>
          <label class="calc-field" data-provider-field hidden><span>Provider / tariff (optional)</span>
            <span class="calc-inputwrap"><select class="provider-select" aria-label="Provider"></select></span>
          </label>`;
const presetField = (label, v, opts) =>
  `          <label class="calc-field"><span>${label}</span>
            <span class="calc-inputwrap"><select data-calc-set="${v}">${opts.map(o => `<option value="${o[0]}"${o[2] ? ' selected' : ''}>${o[1]}</option>`).join('')}</select></span>
          </label>`;
const panel = (title, fields, resultHtml) =>
  `      <div class="calc-panel calc-2col" data-calc aria-label="${title}">
        <div>
          <p class="calc-title">${title}</p>
          <div class="calc-fields">
${fields}
          </div>
        </div>
        <div class="result-card" role="status" aria-live="polite">
${resultHtml}
        </div>
      </div>`;
const resultCard = (lead, primary, unit, rows, note) =>
  `          <p class="result-lead">${lead}</p>
          <p class="result-primary">${primary}<span style="font-size:1rem;color:hsl(var(--muted-foreground));font-weight:600"> ${unit}</span></p>
          <ul class="result-rows">
${rows.map(r => `            <li><span>${r[0]}</span> ${r[1]}</li>`).join('\n')}
          </ul>
          <p class="result-note">${note}</p>`;

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const wc = s => String(s).trim().split(/\s+/).filter(Boolean).length;

// ── per-appliance builders ──────────────────────────────────────────────────
// typicalYearlyKwh moved to appliance-energy.mjs — generate-us-states.mjs needs
// the identical formula and two copies would drift.
function fmtMoney(v, lang) {
  return lang === 'es'
    ? new Intl.NumberFormat('es', { maximumFractionDigits: 0 }).format(v) + ' €'
    : '$' + new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(v);
}

function buildCalc(a, lang) {
  const t = T[lang];
  const p = price0(lang);
  const priceLabel = lang === 'es' ? 'Precio de la luz' : 'Price of electricity';
  const priceUnit = lang === 'es' ? '€/kWh' : '$/kWh';
  const title = lang === 'es' ? `Coste de tu ${a.name_es}` : `Your ${a.name} running cost`;
  const mode = a.usage ? a.usage.mode : 'hoursPerDay';
  const rel = lang === 'es' ? '../../../' : '../../';
  const cf = countryFields(lang, rel);

  if (mode === 'cyclesPerWeek') {
    const perWeekLabel = lang === 'es' ? 'Ciclos por semana' : 'Cycles per week';
    const cycLabel = lang === 'es' ? 'Energía por ciclo' : 'Energy per cycle';
    const fields = [
      cf,
      field(cycLabel, 'cyclekwh', a.usage.cycleKwh, 'kWh', '0.1'),
      field(perWeekLabel, 'cycles', a.usage.default, '', '1'),
      priceField(priceLabel, p, priceUnit),
    ].join('\n');
    const rows = [
      [lang === 'es' ? 'Por ciclo' : 'Per cycle', money('cyclekwh*price', 2, lang)],
      [lang === 'es' ? 'Por semana' : 'Per week', money('cyclekwh*cycles*price', 2, lang)],
      [lang === 'es' ? 'Energía al año' : 'Energy per year', numOut('cyclekwh*cycles*52', 0, ' kWh')],
    ];
    const res = resultCard(lang === 'es' ? 'Cuesta unos' : 'Costs about', moneyId('wf-year', 'cyclekwh*cycles*52*price', 0, lang), lang === 'es' ? '/ año' : '/ year', rows,
      lang === 'es' ? 'Ajusta la energía por ciclo a tu programa habitual.' : 'Set energy per cycle to match your usual programme.');
    return panel(title, fields, res);
  }

  // watts-based (hoursPerDay or alwaysOn) with a min/typical/max preset
  const w = a.watts;
  const presetLabel = lang === 'es' ? 'Ajuste rápido de potencia' : 'Quick power preset';
  const opts = [
    [w.typical, `${t.TYP} · ${w.typical} W`, true],
    [w.min, `${t.MIN} · ${w.min} W`, false],
    [w.max, `${t.MAX} · ${w.max} W`, false],
  ];
  const powerLabel = lang === 'es' ? 'Potencia' : 'Power';

  if (mode === 'alwaysOn') {
    const duty = a.dutyCycle || 1;
    const dutyPct = Math.round(duty * 100);
    const fields = [
      cf,
      presetField(presetLabel, 'watts', opts),
      field(powerLabel, 'watts', w.typical, 'W', '10'),
      priceField(priceLabel, p, priceUnit),
    ].join('\n');
    const day = `watts/1000*24*${duty}*price`;
    const rows = [
      [lang === 'es' ? 'Al día' : 'Per day', money(day, 2, lang)],
      // `${day}*365`, not `*365`: a formula starting with an operator has no
      // left operand, so calc.js returned NaN and the yearly cost — the whole
      // point of these pages — rendered as an em dash on every always-on appliance.
      [lang === 'es' ? 'Al año' : 'Per year', moneyId('wf-year', `${day}*365`, 0, lang)],
      [lang === 'es' ? 'Energía al año' : 'Energy per year', numOut(`watts/1000*24*${duty}*365`, 0, ' kWh')],
    ];
    const res = resultCard(lang === 'es' ? 'Cuesta unos' : 'Costs about', money(`${day}*30.44`, 2, lang), lang === 'es' ? '/ mes' : '/ month', rows,
      lang === 'es' ? `Siempre encendido, con un ciclo de trabajo de ~${dutyPct}%.` : `Always on, based on a ~${dutyPct}% duty cycle.`);
    return panel(title, fields, res);
  }

  // hoursPerDay
  const hoursLabel = lang === 'es' ? 'Horas al día' : 'Hours per day';
  const seasonDays = a.usage.seasonDays;

  /* The panel has to apply the same duty cycle the table above it does, or the
     page contradicts itself in the one place a reader is most likely to check.
     Baked into the formula the way alwaysOn does it, and stated in the hint so
     the arithmetic is reproducible rather than mysteriously short. Empty string
     when there is no duty cycle, which keeps every other appliance's formula
     byte-identical to what it was. */
  const duty = a.dutyCycle || 1;
  const dutyPct = Math.round(duty * 100);
  const D = duty === 1 ? '' : `*${duty}`;
  const dutyHint = duty === 1 ? '' : (lang === 'es'
    ? ` La resistencia cicla con el termostato: se aplica un ~${dutyPct}% de la potencia indicada.`
    : ` The element cycles with the thermostat, so this applies ~${dutyPct}% of the power shown.`);

  if (seasonDays) {
    // Seasonal appliance (AC, space heater, electric blanket, dehumidifier):
    // "hours/day" only applies for part of the year, so season length is its
    // own editable input instead of a silent, baked-in 365 — the same pattern
    // the dedicated calculators/air-conditioning page already uses.
    const seasonLabel = lang === 'es' ? 'Duración de la temporada' : 'Season length';
    const seasonUnit = lang === 'es' ? 'días' : 'days';
    const fields = [
      cf,
      presetField(presetLabel, 'watts', opts),
      field(powerLabel, 'watts', w.typical, 'W', '10'),
      field(hoursLabel, 'hours', a.usage.default, 'h', '0.5'),
      field(seasonLabel, 'days', seasonDays, seasonUnit, '1'),
      priceField(priceLabel, p, priceUnit),
    ].join('\n');
    const rows = [
      [lang === 'es' ? 'Al día' : 'Per day', money(`watts/1000*hours${D}*price`, 2, lang)],
      [lang === 'es' ? 'Energía en la temporada' : 'Energy this season', numOut(`watts/1000*hours${D}*days`, 0, ' kWh')],
    ];
    const res = resultCard(lang === 'es' ? 'Cuesta unos' : 'Costs about', moneyId('wf-year', `watts/1000*hours${D}*price*days`, 0, lang), lang === 'es' ? '/ año' : '/ year', rows,
      (lang === 'es' ? `Asume ~${seasonDays} días de uso al año — ajústalo a tu clima y tus hábitos.` : `Assumes ~${seasonDays} days of use a year — adjust it for your climate and habits.`) + dutyHint);
    return panel(title, fields, res);
  }

  const fields = [
    cf,
    presetField(presetLabel, 'watts', opts),
    field(powerLabel, 'watts', w.typical, 'W', '10'),
    field(hoursLabel, 'hours', a.usage.default, 'h', '0.5'),
    priceField(priceLabel, p, priceUnit),
  ].join('\n');
  const rows = [
    [lang === 'es' ? 'Al día' : 'Per day', money(`watts/1000*hours${D}*price`, 2, lang)],
    [lang === 'es' ? 'Al año' : 'Per year', moneyId('wf-year', `watts/1000*hours${D}*price*365`, 0, lang)],
    [lang === 'es' ? 'Energía al día' : 'Energy per day', numOut(`watts/1000*hours${D}`, 2, ' kWh')],
  ];
  const res = resultCard(lang === 'es' ? 'Cuesta unos' : 'Costs about', money(`watts/1000*hours${D}*price*30.44`, 2, lang), lang === 'es' ? '/ mes' : '/ month', rows,
    (lang === 'es' ? 'Cambia las horas y el precio para ajustarlo a tu caso.' : 'Change the hours and price to match your case.') + dutyHint);
  return panel(title, fields, res);
}

/* Decimals scale with size on purpose. The same column holds $0.002 for an hour
   of an LED bulb and $83 for a year of a fridge, and a fixed two decimals would
   print "$0.00" for exactly the figure a reader searching "light bulb cost per
   hour" came to find. */
const dec = (v) => (v < 0.1 ? 3 : v < 10 ? 2 : 0);
const nfmt = (v, lang, d) => new Intl.NumberFormat(lang === 'es' ? 'es' : 'en',
  { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
const fmtCost = (v, lang) => (lang === 'es'
  ? `${nfmt(v, lang, dec(v))} €`
  : `$${nfmt(v, lang, dec(v))}`);
/* Money keeps its trailing zeros ($0.20, not $0.2) and energy drops them
   (1.1 kWh, not 1.10) — a price with one decimal looks like a typo, and a
   quantity with a padded one looks like false precision. */
const fmtKwh = (v, lang) => new Intl.NumberFormat(lang === 'es' ? 'es' : 'en',
  { maximumFractionDigits: dec(v) }).format(v) + ' kWh';
// Energy and money in one cell: the reader asked for one of the two and the
// other is what lets them redo the sum at their own price.
const cell = (kwh, lang, p) => `${fmtKwh(kwh, lang)} · ${fmtCost(kwh * p, lang)}`;
const priceTxt = (p, lang) => (lang === 'es' ? `${String(p).replace('.', ',')} €/kWh` : `$${p}/kWh`);

/*
  Wattage plus every time window a reader might ask for.

  It used to stop at the watts (or, for cycle appliances, at the kWh per cycle),
  which left the page ranking on questions it declined to answer: Search Console
  had "dishwasher power consumption per hour" at position 15 and "how many kw
  does a dishwasher use" at 20 against a page whose opening line said the cost is
  measured per cycle, not in watts and hours. Both are now on the page, with the
  caveat that makes the watts figure honest rather than just present.

  The numbers come from energyProfile(), the same definition the yearly figure
  and the US state pages use — not restated here, where they would drift.
*/
function wattageTable(a, lang) {
  const t = T[lang];
  const p = price0(lang);
  const e = energyProfile(a);
  const w = a.watts;
  const watts = [[t.MIN, `${w.min} W`], [t.TYP, `${w.typical} W`], [t.MAX, `${w.max} W`]];
  let rows, note;

  if (e.basis === 'cycle') {
    rows = [
      ...watts,
      [t.PERCYCLE, cell(e.perCycleKwh, lang, p)],
      [t.USE, lang === 'es' ? `${a.usage.default} ciclos/semana` : `${a.usage.default} cycles/week`],
      [t.PERWEEK, cell(e.perWeekKwh, lang, p)],
      [t.PERMONTH, cell(e.perMonthKwh, lang, p)],
      [t.PERYEAR, cell(e.perYearKwh, lang, p)],
    ];
    // The watts are a peak while the heating element runs, not a steady draw.
    // Printing them without saying so would answer the query and mislead.
    note = lang === 'es'
      ? `Los vatios son el pico mientras calienta el agua, no un consumo constante: por eso una lavadora o un lavavajillas se miden por ciclo. Energía y coste a ${priceTxt(p, lang)}, la media de España.`
      : `The wattage is a peak while the heating element runs, not a steady draw — which is why washers and dishwashers are measured per cycle. Energy and cost at ${priceTxt(p, lang)}, the US average.`;
  } else if (e.basis === 'always') {
    const dutyPct = Math.round((a.dutyCycle || 1) * 100);
    rows = [
      ...watts,
      [t.USE, t.ALWAYS],
      [t.PERHOUR, cell(e.perHourKwh, lang, p)],
      [t.PERDAY, cell(e.perDayKwh, lang, p)],
      [t.PERMONTH, cell(e.perMonthKwh, lang, p)],
      [t.PERYEAR, cell(e.perYearKwh, lang, p)],
    ];
    note = dutyPct < 100
      ? (lang === 'es'
        ? `Está enchufado siempre, pero el compresor solo arranca parte del tiempo: las cifras por hora y superiores usan un ciclo de trabajo del ~${dutyPct}%, no los ${w.typical} W de continuo. Coste a ${priceTxt(p, lang)}, la media de España.`
        : `It is plugged in all the time, but the motor only runs part of it: the hourly figure and everything above it use a ~${dutyPct}% duty cycle, not ${w.typical} W around the clock. Cost at ${priceTxt(p, lang)}, the US average.`)
      : (lang === 'es'
        ? `Funciona de continuo, 24 h al día. Energía y coste a ${priceTxt(p, lang)}, la media de España.`
        : `It runs continuously, 24 hours a day. Energy and cost at ${priceTxt(p, lang)}, the US average.`);
  } else {
    const seasonal = e.basis === 'season';
    /* usage.hourlyUnsourced: el aparato cicla por termostato y no existe una
       medición publicada de cuánto de la hora consume de verdad, así que la
       cifra por hora sería la potencia de placa disfrazada de consumo.

       Encontrado en producción el 10-08-2026 en clothes-iron: la tabla imprimía
       «Per hour of use — 2 kWh» mientras la propia página decía tres veces que
       esa cifra «no se publica a propósito» y que «está por debajo de un
       kilovatio-hora, no los dos que sugiere la etiqueta» — y esa frase va en el
       FAQPage del JSON-LD, o sea que era la versión que Google podía enseñar en
       la SERP. Se retira la fila en vez de inventar un dutyCycle: el §6 ya
       buscó la medición del ciclo de la plancha en los dos informes del HES y
       no existe, y un supuesto nuestro dentro de una tabla de datos se lee como
       un dato.

       Ojo: esto arregla la contradicción, no la exactitud. Las filas por día,
       mes y año siguen suponiendo la placa durante las 0,2 h. */
    const sinHora = !!a.usage.hourlyUnsourced;
    rows = [
      ...watts,
      [t.USE, seasonal
        ? (lang === 'es' ? `${a.usage.default} h/día, ~${a.usage.seasonDays} días/año` : `${a.usage.default} h/day, ~${a.usage.seasonDays} days/year`)
        : (lang === 'es' ? `${a.usage.default} h/día` : `${a.usage.default} h/day`)],
      ...(sinHora ? [] : [[t.PERHOUR, cell(e.perHourKwh, lang, p)]]),
      [t.PERDAY, cell(e.perDayKwh, lang, p)],
      [t.PERMONTH, cell(e.perMonthKwh, lang, p)],
      [seasonal ? t.PERSEASON : t.PERYEAR, cell(e.perYearKwh, lang, p)],
    ];
    /* Same caveat the alwaysOn branch has always carried, for the same reason:
       a thermostatic appliance does not draw its rating for the whole hour, so
       printing the nameplate beside an hourly cost without saying so answers
       the query and misleads. Only appliances with a sourced duty cycle get
       this — one that really does draw its rating while running says nothing. */
    const dutyPct = Math.round((a.dutyCycle || 1) * 100);
    const duty = sinHora
      // Falta una fila que el lector espera, así que la nota tiene que decir por
      // qué falta. Callarlo se lee como un descuido, y la razón es el argumento.
      ? (lang === 'es'
        ? `No hay fila por hora, y es a propósito: los ${w.typical} W son lo que consume mientras la resistencia está encendida, el termostato la cicla en cuanto alcanza la temperatura, y no existe una medición publicada de qué parte de la hora consume de verdad. Publicar la potencia de placa como si fuera el consumo de una hora sería contestar la pregunta con un número falso. `
        : `There is no hourly row, and that is deliberate: the ${w.typical} W is what it draws while the element is on, a thermostat cycles it once it is up to temperature, and no published measurement says what share of the hour it actually draws. Printing the nameplate as if it were an hour's consumption would answer the question with a wrong number. `)
      : dutyPct < 100
      ? (lang === 'es'
        ? `Los ${w.typical} W son lo que consume mientras la resistencia está encendida: el termostato la cicla en cuanto alcanza la temperatura, así que la cifra por hora y las de debajo usan un ciclo de trabajo del ~${dutyPct}% y no la potencia de placa. `
        : `The ${w.typical} W is what it draws while the element is actually on — a thermostat cycles it once the appliance is up to temperature, so the hourly figure and everything below it use a ~${dutyPct}% duty cycle rather than the full rating. `)
      : '';
    note = duty + (seasonal
      ? (lang === 'es'
        ? `Solo se usa parte del año, así que la última fila es la temporada entera (~${e.days} días) y no doce meses. «Al mes» es un mes de temporada. Coste a ${priceTxt(p, lang)}, la media de España.`
        : `It only runs part of the year, so the last row is the whole season (~${e.days} days) rather than twelve months, and "per month" means a month in season. Cost at ${priceTxt(p, lang)}, the US average.`)
      : (lang === 'es'
        ? `Calculado sobre ${a.usage.default} h al día a ${priceTxt(p, lang)}, la media de España. Cambia las horas y el precio en la calculadora de arriba.`
        : `Based on ${a.usage.default} h a day at ${priceTxt(p, lang)}, the US average. Change the hours and the price in the calculator above.`));
  }

  // A table an AI (or a screen reader) lifts out of the page carries no
  // context of its own — the audit's own example: without a caption, a
  // model that grabs this table doesn't know which appliance it is, in what
  // unit, or at what price per kWh (audit 30-07-2026, GEO section).
  const name = lang === 'es' ? a.name_es : a.name;
  const caption = lang === 'es'
    ? `Potencia y coste de ${artEs(a, name)} ${lower(name)} a ${priceTxt(p, lang)}`
    : `Wattage and running cost of ${artEn(name)} ${lower(name)} at ${priceTxt(p, lang)}`;
  const table = `<table><caption>${esc(caption)}</caption><tbody>${rows.map(r => `<tr><th>${r[0]}</th><td>${r[1]}</td></tr>`).join('')}</tbody></table>`;
  return `${table}\n      <p>${note}</p>`;
}

/*
  What the same machine costs in the countries that have a page of their own.

  This is the other half of a link that already existed. Every country page
  costs out four appliances and links to them; nothing linked back, so the
  fourteen country pages were being crawled off a hub and two guides, and
  Search Console still shows Google walking the pre-301 internal link graph —
  which is exactly when internal links carry more weight than usual.

  It is also the question this page kept declining to answer. The figures above
  assume one country's price because they have to assume something, and "and if
  I'm in Germany" is the next thought a reader has. Every row here is a
  different number for a different reason, not the same page with a flag on it.

  No price per kWh appears in this block, deliberately. An appliance page is
  allowed to quote exactly one price — its own reader's — and
  test/prices-in-prose.test.mjs enforces that. What varies down these columns is
  the cost of *this* machine, which is what the reader came for; the rate behind
  each row is one click away on the country's own page, which is the point.
*/
function countryCosts(a, lang, depth, pfx) {
  const isEs = lang === 'es';
  const t = T[lang];
  const kwh = typicalYearlyKwh(a);
  const seasonal = energyProfile(a).basis === 'season';
  const name = isEs ? a.name_es : a.name;
  const p = price0(lang);

  // Resolved loudly: a country with a page but no price would otherwise print
  // an empty row on 60 pages.
  const rows = COUNTRY_PAGES.map(code => {
    const c = prices.countries.find(x => x.code === code);
    if (!c) throw new Error(`country-pages.mjs publishes ${code} but energy-prices.json has no such country`);
    return c;
  }).sort((x, y) => y.usd - x.usd);

  const dearest = rows[0];
  const cheapest = rows[rows.length - 1];
  const per = seasonal ? t.PERSEASON : t.PERYEAR;

  const body = rows.map(c => {
    const href = `${rel(depth)}${pfx}electricity-prices/${countrySlug(c.name)}/`;
    return `<tr><td><a class="ul-link" href="${href}">${esc(isEs ? c.name_es : c.name)}</a></td>`
      + `<td class="tnum">${esc(moneyLabel(c, kwh * c.price, lang))}</td>`
      + `<td class="tnum">${esc(usdTotal(kwh * c.usd, lang))}</td></tr>`;
  }).join('');
  const window_ = seasonal
    ? (isEs ? 'por temporada' : 'a season')
    : (isEs ? 'al año' : 'a year');
  const caption = isEs
    ? `Lo que cuestan ${nf(kwh, lang, 0)} kWh ${window_} en ${rows.length} países`
    : `What ${nf(kwh, lang, 0)} kWh ${window_} costs in ${rows.length} countries`;
  const table = `<table><caption>${esc(caption)}</caption><thead><tr><th>${t.THCOUNTRY}</th><th>${per}</th><th>${t.THUSD}</th></tr></thead><tbody>${body}</tbody></table>`;
  // Definite article, not the indefinite one artEs/artEn hand out: the sentence
  // is about this appliance, the one the reader has just been reading about.
  const theEs = artEs(a, name) === 'una' ? 'La' : 'El';
  const theEn = artEn(name) === 'an' ? 'An' : 'A';
  const lead = isEs
    ? `Las cifras de arriba dan por hecho ${priceTxt(p, lang)}, la media de España. ${theEs} ${lower(name)} no cambia al cruzar una frontera; lo que cambia es lo que cuesta la electricidad que se bebe. Esto es lo que cuestan sus ${nf(kwh, lang, 0)} kWh ${window_} en los ${rows.length} países que tienen página aquí, de más caro a más barato.`
    : `The figures above assume ${priceTxt(p, lang)}, the US average. ${theEn} ${lower(name)} does not change when it crosses a border — the price of the electricity it drinks does. Here is what its ${nf(kwh, lang, 0)} kWh ${window_} cost in the ${rows.length} countries with a page here, dearest first.`;
  const pricesHref = `${rel(depth)}${pfx}electricity-prices/`;
  const note = isEs
    ? `Cada cifra va en la moneda de su país, a su precio medio con todos los impuestos; la columna en dólares está para poder compararlas entre sí. De ${esc(dearest.name_es)} a ${esc(cheapest.name_es)} hay un factor de ${nf(dearest.usd / cheapest.usd, lang, 1)}: el mismo aparato, las mismas horas, ${nf(dearest.usd / cheapest.usd, lang, 1)} veces la factura. Entra en un país para ver sus tarifas reales y de qué se compone ese precio, o mira <a class="ul-link" href="${pricesHref}">la comparativa completa de precios de la luz por país</a>.`
    : `Each figure is in that country's own currency at its average all-taxes-included price; the dollar column is there so they can be set against each other. ${esc(dearest.name)} to ${esc(cheapest.name)} is a factor of ${nf(dearest.usd / cheapest.usd, lang, 1)} — same appliance, same hours, ${nf(dearest.usd / cheapest.usd, lang, 1)} times the bill. Follow a country for its real retailer tariffs and what makes up that price, or see <a class="ul-link" href="${pricesHref}">the full electricity price comparison by country</a>.`;

  return `<p>${lead}</p>\n      ${table}\n      <p>${note}</p>`;
}

const introHtml = (a, lang) => (a.intro[lang] || []).map(p => `<p>${p}</p>`).join('\n      ');

// SERP analysis (audit 30-07-2026): the top 8 results for "cost to run oven
// for 1 hour" all multiply nameplate wattage × hours; only one mentions that
// the appliance cycles, and none quantify it. The 4 appliances that actually
// have a dutyCycle < 1 already apply the real figure inside the calculator
// above (see `D`/`dutyHint` in buildCalc) — this callout is the only place
// that states the advantage plainly, above the fold, for a reader (or an AI
// summarizing the page) who never opens the calculator. wifi-router carries
// dutyCycle: 1 (it doesn't cycle) and is correctly excluded by the `>= 1` guard.
const dutyCalloutHtml = (a, lang) => {
  const duty = a.dutyCycle;
  if (duty == null || duty >= 1) return '';
  const pct = Math.round(duty * 100);
  const name = lang === 'es' ? a.name_es : a.name;
  return lang === 'es'
    ? `<div class="callout verdict" role="note"><strong>La mayoría de calculadoras de coste se equivocan aquí:</strong> multiplican la potencia nominal por las horas de uso, sin más. En la práctica, ${artEs(a, name)} ${lower(name)} cicla para mantener la temperatura, así que solo consume a plena potencia un ~${pct}% del tiempo. Las cifras de esta página ya aplican ese ciclo de trabajo real; una calculadora que no lo haga te está inflando el coste.</div>`
    : `<div class="callout verdict" role="note"><strong>Most running-cost calculators get this wrong:</strong> they multiply nameplate wattage by hours used, full stop. In practice, ${artEn(name)} ${lower(name)} cycles to hold its temperature, so it only draws full power around ${pct}% of the time. The figures on this page already apply that real duty cycle — a calculator that doesn't is overstating your cost.</div>`;
};
const tipsHtml = (a, lang) => `<ul>\n        ${(a.tips[lang] || []).map(x => `<li>${x}</li>`).join('\n        ')}\n      </ul>`;
const faqHtml = (a, lang) => (a.faq || []).map(f => {
  const q = lang === 'es' ? f.q_es : f.q; const ans = lang === 'es' ? f.a_es : f.a;
  return `<details class="faq-item"><summary>${esc(q)}</summary><p>${esc(ans)}</p></details>`;
}).join('\n      ');
const faqJsonld = (a, lang) => (a.faq || []).map(f => {
  const q = lang === 'es' ? f.q_es : f.q; const ans = lang === 'es' ? f.a_es : f.a;
  return `{ "@type": "Question", "name": ${JSON.stringify(q)}, "acceptedAnswer": { "@type": "Answer", "text": ${JSON.stringify(ans)} } }`;
}).join(',\n        ');
function relatedHtml(a, lang) {
  const byslug = Object.fromEntries(data.appliances.map(x => [x.slug, x]));
  return (a.related || []).filter(s => byslug[s]).map(s => {
    const r = byslug[s]; const name = lang === 'es' ? r.name_es : r.name;
    return `<a href="../${s}/">${esc(name)}</a>`;
  }).join('\n        ');
}

// ── validate ────────────────────────────────────────────────────────────────
const seen = new Set(); let errors = 0; let warns = 0;
for (const a of data.appliances) {
  const need = ['slug', 'name', 'name_es', 'category', 'watts', 'usage', 'intro', 'tips', 'faq'];
  for (const k of need) if (!(k in a)) { console.error(`✗ ${a.slug || '?'}: missing "${k}"`); errors++; }
  if (seen.has(a.slug)) { console.error(`✗ duplicate slug "${a.slug}"`); errors++; } seen.add(a.slug);
  for (const lang of langs) {
    const words = wc((a.intro && a.intro[lang] || []).join(' '));
    if (words < 190) { console.error(`✗ ${a.slug} [${lang}]: intro only ${words} words (need ≥190)`); errors++; }
    else if (words < 250) { console.warn(`! ${a.slug} [${lang}]: intro ${words} words (aim ≥250)`); warns++; }
    if (!a.name_es && lang === 'es') { console.error(`✗ ${a.slug}: missing name_es`); errors++; }
  }
}
if (errors) { console.error(`\n${errors} error(s) — nothing written.`); process.exit(1); }

// ── render pages ────────────────────────────────────────────────────────────
const rel = d => (d === 0 ? '' : '../'.repeat(d));
let count = 0;
for (const a of data.appliances) {
  const yearlyKwh = typicalYearlyKwh(a);
  for (const lang of langs) {
    const isEs = lang === 'es';
    const pfx = isEs ? 'es/' : '';
    const depth = isEs ? 3 : 2;
    const name = isEs ? a.name_es : a.name;
    const yearly = fmtMoney(yearlyKwh * price0(lang), lang);
    // The old pattern ("Refrigerator Electricity Cost & Wattage") missed the
    // phrase people actually type: GSC shows Google matching these pages to
    // "cost to run refrigerator" and "how much does a space heater cost to run"
    // at positions 66-94. On a domain with no authority the exact head phrase in
    // title and H1 is one of the few levers left. lower() keeps acronyms intact,
    // so "an LED bulb" survives and "Space heater" stops being mid-sentence caps.
    const pageTitle = isEs
      ? `¿Cuánto consume ${artEs(a, name)} ${lower(name)}?`
      : `How much does ${artEn(name)} ${lower(name)} cost to run?`;
    const isCycle = a.usage && a.usage.mode === 'cyclesPerWeek';
    const typStr = isCycle ? `${a.usage.cycleKwh} kWh/${isEs ? 'ciclo' : 'cycle'}` : `${a.watts.typical} W`;
    const pageDesc = isEs
      ? `Cuánto cuesta tener ${artEs(a, name)} ${lower(name)} en marcha: potencia típica ${typStr}, unos ${yearly} al año. Ajusta los datos a tu uso y tu tarifa.`
      : `What ${artEn(name)} ${lower(name)} costs to run: typical ${typStr}, about ${yearly} a year. Adjust the figures to your own usage and electricity price.`;
    const canonical = `https://${cfg.domain}/${pfx}${SECTION}/${a.slug}/`;
    const ctx = Object.assign({}, base, uiStrings(lang), {
      REL: rel(depth), HOME: rel(depth) + pfx,
      LANG_ATTR: lang, LANG_UPPER: lang.toUpperCase(), LANG_OTHER: isEs ? 'EN' : 'ES', LANG_PREFIX: pfx,
      CANONICAL: canonical,
      HREF_EN: `https://${cfg.domain}/${SECTION}/${a.slug}/`,
      HREF_ES: `https://${cfg.domain}/es/${SECTION}/${a.slug}/`,
      OG_LOCALE: ogLocale(lang), OG_TYPE: 'website',
      // Real photo wins for social shares too (Pinterest et al already build a
      // share link per page) — only the SVG-panel fallback keeps the generic image.
      OG_IMAGE: hasPhoto(a.slug) ? artUrl(a.slug).replace(/^\/assets\/img\//, '') : 'og-default.png',
      TAGLINE: (isEs && cfg.tagline_es) || cfg.tagline || '',
      PAGE_TITLE: pageTitle, PAGE_DESC: pageDesc, PAGE_KEYWORDS: (isEs ? a.keywords_es : a.keywords) || '',
      SLUG: a.slug, APPLIANCE_IMG: artUrl(a.slug),
      SECTION_SLUG: SECTION, SECTION_LABEL: sectionLabel(section, lang),
      APPLIANCE_NAME: name, CATEGORY_LABEL: catLabel(a.category, lang),
      DATE_PUBLISHED: a.date || meta.date || new Date().toISOString().slice(0, 10),
      DATE_MODIFIED: modifiedDate(a.slug, a.date || meta.date || new Date().toISOString().slice(0, 10)),
      DISCLAIMER_BLOCK: '', // energy disclaimer is niche-wide; keep appliance pages lean
      DUTY_CALLOUT: dutyCalloutHtml(a, lang),
      CALC_HTML: buildCalc(a, lang),
      CHART_HTML: `<figure class="wf-chart" data-chart="projection" data-src="#wf-year" data-years="10" data-caption="${isEs ? 'Coste acumulado en 10 años' : 'Cumulative cost over 10 years'}"></figure>\n      <p class="equiv" data-equiv data-src="#wf-year"></p>`,
      WATTAGE_TABLE: wattageTable(a, lang),
      INTRO_HTML: introHtml(a, lang),
      T_COUNTRIES: T[lang].COUNTRIES(name, a),
      COUNTRIES_HTML: countryCosts(a, lang, depth, pfx),
      TIPS_TITLE: T[lang].TIPS(name, a),
      TIPS_HTML: tipsHtml(a, lang),
      FAQ_HTML: faqHtml(a, lang), FAQ_JSONLD: faqJsonld(a, lang),
      RELATED_HTML: relatedHtml(a, lang),
      CALC_MATCH_HREF: `${rel(depth)}${pfx}calculators/${(CALC_MATCH[a.slug] || ['electricity-cost'])[0]}/`,
      CALC_LINK_TEXT: (CALC_MATCH[a.slug] ? CALC_MATCH[a.slug][1][lang] : null) || T[lang].CALCLINK,
      T_WATTAGE: T[lang].WATTAGE,
      PAGE_SCRIPTS: `  <script src="${rel(depth)}assets/calc.js" defer></script>\n  <script src="${rel(depth)}assets/energy-prices.js" defer></script>\n  <script src="${rel(depth)}assets/charts.js" defer></script>\n`,
      SHARE_URL: encodeURIComponent(canonical),
      SHARE_TITLE: encodeURIComponent(pageTitle),
      SHARE_MEDIA: encodeURIComponent(`https://${cfg.domain}/assets/img/og-default.png`),
    });
    const html = renderFile('article-appliance.html', ctx, {
      templatesDir,
      flags: Object.assign({}, flags, { pageEn: !isEs, pageEs: isEs }),
      sections: (cfg.sections || []).map(s => isEs ? { ...s, label: s.label_es || s.label, blurb: s.blurb_es || s.blurb } : s),
    });
    const dest = path.join(ROOT, pfx, SECTION, a.slug, 'index.html');
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, html, 'utf-8');
    count++;
  }
}

// ── rebuild section-index cards (deterministic → idempotent) ─────────────────
function rebuildIndex(lang) {
  const isEs = lang === 'es';
  const pfx = isEs ? 'es/' : '';
  const idxPath = path.join(ROOT, pfx, SECTION, 'index.html');
  if (!existsSync(idxPath)) return;
  const sorted = [...data.appliances].sort((a, b) =>
    (a.category + a.slug).localeCompare(b.category + b.slug));
  // Scale bars/tiers against the heaviest appliance so the listing can be read
  // at a glance: the running cost is the headline, colour encodes how thirsty.
  const maxKwh = Math.max(...data.appliances.map(x => typicalYearlyKwh(x)));
  const cards = sorted.map(a => {
    const name = isEs ? a.name_es : a.name;
    const isCycle = a.usage && a.usage.mode === 'cyclesPerWeek';
    const typStr = isCycle ? `${a.usage.cycleKwh} kWh/${isEs ? 'ciclo' : 'cycle'}` : `${a.watts.typical} W`;
    const kwh = typicalYearlyKwh(a);
    const yearly = fmtMoney(kwh * price0(lang), lang);
    const pct = Math.max(4, Math.round(kwh / maxKwh * 100));
    const tier = kwh > 900 ? 'high' : kwh > 250 ? 'mid' : 'low';
    const tierLabel = isEs
      ? { high: 'Gasta mucho', mid: 'Gasto medio', low: 'Gasta poco' }[tier]
      : { high: 'Heavy use', mid: 'Moderate', low: 'Light use' }[tier];
    const perYear = isEs ? '/año' : '/yr';
    const kwhStr = `${Math.round(kwh).toLocaleString(isEs ? 'es-ES' : 'en-US')} kWh${perYear}`;
    // Root-absolute image src: cards get moved between paginated pages, and the
    // paginator only rewrites hrefs, so a relative src would break on page-2+.
    return `        <a class="card appl-card is-${tier}" href="${a.slug}/"><div class="card-media"><img src="${artUrl(a.slug)}" alt="" loading="lazy" width="800" height="600"></div><div class="card-body"><div class="chip">${esc(catLabel(a.category, lang))}</div><h3 class="font-display">${esc(name)}</h3><p class="ac-figure"><span class="ac-cost">${esc(yearly)}</span><span class="ac-per">${esc(perYear)}</span></p><p class="ac-meta">${esc(typStr)} · ${esc(kwhStr)}</p><span class="ac-bar" aria-hidden="true"><i style="width:${pct}%"></i></span><span class="ac-tier">${esc(tierLabel)}</span></div></a>`;
  }).join('\n');
  let idx = readFileSync(idxPath, 'utf-8');
  const re = /(<!--\s*CARDS:START\s*-->)([\s\S]*?)(<!--\s*CARDS:END\s*-->)/;
  if (!re.test(idx)) { console.error(`No CARDS markers in ${idxPath}`); return; }
  // Function replacement so any "$" in the cards (e.g. "$78/year") is literal,
  // not treated as a String.replace backreference.
  idx = idx.replace(re, (_m, p1, _p2, p3) => `${p1}\n${cards}\n      ${p3}`);
  writeFileSync(idxPath, idx, 'utf-8');
}
for (const lang of langs) rebuildIndex(lang);

// ── emit the search index for the home appliance finder ─────────────────────
// Rich enough for the finder to show a live preview (specs + cost estimate).
const index = data.appliances.map(a => ({
  slug: a.slug, name: a.name, name_es: a.name_es, category: a.category,
  cat: catLabel(a.category, 'en'), cat_es: catLabel(a.category, 'es'),
  watts: a.watts ? a.watts.typical : null,
  cycleKwh: (a.usage && a.usage.mode === 'cyclesPerWeek') ? a.usage.cycleKwh : null,
  alwaysOn: !!(a.usage && a.usage.mode === 'alwaysOn'),
  kwh: Math.round(typicalYearlyKwh(a)),
}));
mkdirSync(path.join(ROOT, 'data'), { recursive: true });
writeFileSync(path.join(ROOT, 'data', 'appliance-index.json'), JSON.stringify(index), 'utf-8');

console.log(`✓ ${count} appliance pages (${data.appliances.length} appliances × ${langs.length} langs)`);
if (warns) console.log(`  ${warns} short-intro warning(s) — consider expanding to ≥300 words.`);
console.log(`  rebuilt section indexes + data/appliance-index.json`);
