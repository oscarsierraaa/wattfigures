#!/usr/bin/env node
/*
  generate-us-states.mjs — build the "electricity price by US state" reference
  page (EN + /es/) from data/us-states.json. Run from the site root:
    node tools/generate-us-states.mjs
  Sitemap picks the pages up automatically (filesystem walk). Idempotent.

  Why this page exists: Search Console shows Google already matching the site
  to "cost per kilowatt hour by state" and "kwh rate", and the US is the
  biggest source of impressions — but there was no page answering either. It
  sits under electricity-prices/ because it is depth on the asset that already
  ranks, not a new topic.

  Refresh the underlying figures with tools/fetch-us-states.mjs.
*/
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { renderFile } from './template-engine.mjs';
import { uiStrings, localizeSections, ogLocale } from './site-i18n.mjs';
import { buildFlags, buildBase } from './site-context.mjs';
import { typicalYearlyKwh } from './appliance-energy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const templatesDir = path.join(ROOT, 'templates');
const cfg = JSON.parse(readFileSync(path.join(ROOT, 'site.config.json'), 'utf-8'));
const data = JSON.parse(readFileSync(path.join(ROOT, 'data', 'us-states.json'), 'utf-8'));
const appliances = JSON.parse(readFileSync(path.join(ROOT, 'data', 'appliances.json'), 'utf-8')).appliances;

const PARENT = 'electricity-prices';
const SLUG = `${PARENT}/us-states`;
const langs = cfg.languages;
const flags = buildFlags(cfg);
const base = buildBase(cfg);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const states = [...data.states].sort((a, b) => b.cents - a.cents);
const dearest = states[0];
const cheapest = states[states.length - 1];
const avg = data.meta.us_average_cents;
const spread = dearest.cents / cheapest.cents;

// The four the page costs out: one seasonal, one always-on, one per-cycle and
// one big continuous load — enough range that a reader recognises their own bill.
const SHOWCASE = ['air-conditioner', 'refrigerator', 'tumble-dryer', 'electric-water-heater'];

const money = (usd, lang) => (lang === 'es'
  ? new Intl.NumberFormat('es', { maximumFractionDigits: 0 }).format(usd) + ' $'
  : '$' + new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(usd));
const kwh = (v, lang) => new Intl.NumberFormat(lang === 'es' ? 'es' : 'en', { maximumFractionDigits: 0 }).format(v);
const cents = (v, lang) => (lang === 'es' ? String(v).replace('.', ',') : String(v)) + ' ¢';
const pct = (v, lang) => {
  const s = new Intl.NumberFormat(lang === 'es' ? 'es' : 'en', { maximumFractionDigits: 1 }).format(Math.abs(v));
  return (v >= 0 ? '+' : '−') + s + ' %';
};

const STR = {
  en: {
    parent: 'Electricity prices',
    title: `Electricity Cost per kWh by State (${data.meta.period.split(' ')[1]})`,
    desc: `What a kilowatt-hour costs in all 50 states and DC, from ${cents(cheapest.cents, 'en')} in ${cheapest.name} to ${cents(dearest.cents, 'en')} in ${dearest.name} — with what that difference does to a real bill.`,
    datasetName: `Average residential electricity price by US state, ${data.meta.period}`,
    datasetDesc: `Average retail price of residential electricity in US cents per kilowatt-hour for all 50 states and the District of Columbia, ${data.meta.period}, with the year-earlier figure for comparison. Source: U.S. Energy Information Administration, Electric Power Monthly, Table 5.6.A.`,
    tiles: [['US average', cents(avg, 'en')], ['Cheapest', `${cents(cheapest.cents, 'en')} · ${cheapest.name}`], ['Most expensive', `${cents(dearest.cents, 'en')} · ${dearest.name}`], ['Spread', `${spread.toFixed(1)}×`]],
    intro: `<p>A kilowatt-hour is not a national price. The same fridge, the same hours, the same year — and the bill changes by a factor of ${spread.toFixed(1)} depending on which state you plug it in. That gap is bigger than almost any efficiency upgrade you could make, and it is the single number most cost estimates leave out.</p>
      <p>These are the ${data.meta.period} residential figures from the U.S. Energy Information Administration, the same source utilities and regulators cite, with ${data.meta.period_prev} alongside so you can see which way your state is moving.</p>`,
    bill: 'What the gap costs you',
    billNote: `Same appliance, same usage, three different states. Yearly running cost at ${cheapest.name} rates, at the US average, and at ${dearest.name} rates.`,
    thAppliance: 'Appliance', thYear: 'Per year',
    table: 'Price per kWh in every state',
    tableNote: `Residential average, ${data.meta.period}. The last column is the change from ${data.meta.period_prev} — worth a look before you sign a fixed-rate contract.`,
    thState: 'State', thPrice: '¢ /kWh', thChange: 'vs. last year', thVsAvg: 'vs. US average',
    compare: 'The whole country at a glance',
    compareNote: 'Every state, dearest first. The highlighted bar is the national average.',
    why: 'Why the difference is so big',
    whyHtml: `<p>Four things drive most of the spread, and none of them is how much electricity you use:</p>
      <ul>
        <li><strong>What burns in the power plants.</strong> States sitting on cheap hydro or their own gas — the Pacific Northwest, the Gulf Coast — generate for less than states importing fuel. Hawaii is the extreme case: most of its power still comes from oil delivered by ship, which is why it pays ${cents(dearest.cents, 'en')} while ${cheapest.name} pays ${cents(cheapest.cents, 'en')}.</li>
        <li><strong>Distance and terrain.</strong> Wires have to reach everyone. Long rural lines and dense, expensive urban networks both cost more per customer than compact suburban ones, and that goes on the bill as delivery charges rather than energy.</li>
        <li><strong>Whether the market is deregulated.</strong> In about a third of states you buy energy from a competitive retailer and delivery from the utility. That can cut the energy half — or raise it, if a teaser rate rolls over into a variable one.</li>
        <li><strong>What the state decided to fund through the bill.</strong> Efficiency programmes, renewable mandates, wildfire liability and storm hardening are recovered through rates. It is a policy choice, and it shows up as cents per kilowatt-hour.</li>
      </ul>
      <p>None of this is under your control. What is: knowing your own number and using it. The state average is a starting point — your utility's actual rate is on your bill, and every calculator here takes it.</p>`,
    updated: 'Updated', calcCta: 'Work out your own cost per kWh',
    // The country page carries the retailers, the carbon intensity and the
    // international ranking, none of which are on this page.
    countryCta: 'How the US compares with 22 other countries',
    disclaimer: 'State averages are exactly that: averages. Your rate depends on your utility, your tariff, whether you are on time-of-use pricing, and the season. Use the figure on your own bill for anything that matters. WattFigures is not affiliated with the U.S. Energy Information Administration.',
  },
  es: {
    parent: 'Precios de la luz',
    title: `Precio de la luz por estado en EE. UU. (${data.meta.period.split(' ')[1]})`,
    desc: `Lo que cuesta el kilovatio-hora en los 50 estados y Washington D. C., desde ${cents(cheapest.cents, 'es')} en ${cheapest.name_es} hasta ${cents(dearest.cents, 'es')} en ${dearest.name_es} — y lo que eso hace en una factura real.`,
    datasetName: `Precio medio residencial de la electricidad por estado de EE. UU., ${data.meta.period}`,
    datasetDesc: `Precio medio minorista de la electricidad residencial en centavos de dólar por kilovatio-hora para los 50 estados y el Distrito de Columbia, ${data.meta.period}, con la cifra del año anterior para comparar. Fuente: U.S. Energy Information Administration, Electric Power Monthly, tabla 5.6.A.`,
    tiles: [['Media de EE. UU.', cents(avg, 'es')], ['Más barato', `${cents(cheapest.cents, 'es')} · ${cheapest.name_es}`], ['Más caro', `${cents(dearest.cents, 'es')} · ${dearest.name_es}`], ['Diferencia', `${spread.toFixed(1).replace('.', ',')}×`]],
    intro: `<p>El kilovatio-hora no tiene un precio nacional. El mismo frigorífico, las mismas horas, el mismo año — y la factura cambia por un factor de ${spread.toFixed(1).replace('.', ',')} según el estado en el que lo enchufes. Esa diferencia es mayor que casi cualquier mejora de eficiencia que puedas hacer, y es justo el dato que se deja fuera de casi todas las estimaciones de coste.</p>
      <p>Estas son las cifras residenciales de ${data.meta.period} de la Administración de Información Energética de EE. UU., la misma fuente que citan las compañías y los reguladores, con las de ${data.meta.period_prev} al lado para ver hacia dónde se mueve cada estado.</p>`,
    bill: 'Lo que te cuesta esa diferencia',
    billNote: `El mismo aparato, el mismo uso, tres estados distintos. Coste anual con la tarifa de ${cheapest.name_es}, con la media de EE. UU. y con la de ${dearest.name_es}.`,
    thAppliance: 'Aparato', thYear: 'Al año',
    table: 'Precio por kWh en cada estado',
    tableNote: `Media residencial, ${data.meta.period}. La última columna es la variación desde ${data.meta.period_prev} — conviene mirarla antes de firmar una tarifa fija.`,
    thState: 'Estado', thPrice: '¢ /kWh', thChange: 'vs. año anterior', thVsAvg: 'vs. media de EE. UU.',
    compare: 'Todo el país de un vistazo',
    compareNote: 'Todos los estados, del más caro al más barato. La barra destacada es la media nacional.',
    why: 'Por qué la diferencia es tan grande',
    whyHtml: `<p>La mayor parte de la diferencia la explican cuatro cosas, y ninguna es cuánta electricidad gastas:</p>
      <ul>
        <li><strong>Qué se quema en las centrales.</strong> Los estados con hidráulica barata o gas propio —el noroeste del Pacífico, la costa del Golfo— generan más barato que los que importan combustible. Hawái es el caso extremo: la mayor parte de su electricidad sigue saliendo de petróleo que llega en barco, y por eso paga ${cents(dearest.cents, 'es')} mientras ${cheapest.name_es} paga ${cents(cheapest.cents, 'es')}.</li>
        <li><strong>La distancia y el terreno.</strong> Los cables tienen que llegar a todo el mundo. Tanto las líneas rurales largas como las redes urbanas densas salen más caras por cliente que las suburbanas compactas, y eso va a la factura como peajes de distribución, no como energía.</li>
        <li><strong>Si el mercado está liberalizado.</strong> En torno a un tercio de los estados compras la energía a una comercializadora y la distribución a la eléctrica de siempre. Eso puede abaratar la parte de energía — o encarecerla, si una tarifa de captación se convierte en variable.</li>
        <li><strong>Lo que cada estado decidió financiar vía factura.</strong> Programas de eficiencia, objetivos renovables, responsabilidad por incendios forestales o refuerzo frente a temporales se recuperan en las tarifas. Es una decisión política, y aparece como centavos por kilovatio-hora.</li>
      </ul>
      <p>Nada de esto está en tu mano. Lo que sí: saber tu número y usarlo. La media del estado es un punto de partida — la tarifa real de tu compañía está en tu factura, y todas las calculadoras de aquí la aceptan.</p>`,
    updated: 'Actualizado', calcCta: 'Calcula tu propio coste por kWh',
    countryCta: 'Cómo se compara EE. UU. con otros 22 países',
    disclaimer: 'Las medias por estado son eso: medias. Tu tarifa depende de tu compañía, de tu contrato, de si tienes discriminación horaria y de la estación del año. Para cualquier cosa que importe, usa la cifra de tu propia factura. WattFigures no está afiliado a la U.S. Energy Information Administration.',
  },
};

const rel = (d) => (d === 0 ? '' : '../'.repeat(d));

function build(lang) {
  const t = STR[lang];
  const isEs = lang === 'es';
  const pfx = isEs ? 'es/' : '';
  // electricity-prices/us-states/ → two levels from root, three under /es/.
  const depth = isEs ? 3 : 2;
  const stateName = (s) => (isEs ? s.name_es : s.name);

  const tiles = t.tiles
    .map(([label, value]) => `<div class="stat-tile"><div class="stat-value">${esc(value)}</div><span class="stat-label">${esc(label)}</span></div>`)
    .join('\n');

  // Same yearly-kWh formula the appliance pages use (appliance-energy.mjs), so
  // the figures here and there cannot disagree.
  const billRows = SHOWCASE.map((slug) => {
    const a = appliances.find((x) => x.slug === slug);
    if (!a) throw new Error(`appliances.json has no "${slug}" — showcase list is stale`);
    const y = typicalYearlyKwh(a);
    const href = `${rel(depth)}${pfx}appliances/${slug}/`;
    return `<tr><td><a class="ul-link" href="${href}">${esc(isEs ? a.name_es : a.name)}</a><br><small style="color:hsl(var(--muted-foreground))">${kwh(y, lang)} kWh/${isEs ? 'año' : 'yr'}</small></td>` +
      `<td class="tnum">${money(y * cheapest.cents / 100, lang)}</td>` +
      `<td class="tnum">${money(y * avg / 100, lang)}</td>` +
      `<td class="tnum">${money(y * dearest.cents / 100, lang)}</td></tr>`;
  }).join('');
  const billCaption = isEs
    ? `Lo que cuestan aparatos habituales en ${esc(stateName(cheapest))}, la media de EE. UU. y ${esc(stateName(dearest))}`
    : `What common appliances cost in ${esc(stateName(cheapest))}, the US average and ${esc(stateName(dearest))}`;
  const billTable = `<table><caption>${billCaption}</caption><thead><tr><th>${t.thAppliance}</th><th>${esc(stateName(cheapest))}</th><th>${isEs ? 'Media EE. UU.' : 'US average'}</th><th>${esc(stateName(dearest))}</th></tr></thead><tbody>${billRows}</tbody></table>`;

  const rows = states.map((s) => {
    const chg = s.cents_prev ? (s.cents - s.cents_prev) / s.cents_prev * 100 : null;
    const vsAvg = (s.cents - avg) / avg * 100;
    return `<tr><td>${esc(stateName(s))}</td><td class="tnum">${cents(s.cents, lang)}</td>` +
      `<td class="tnum">${chg === null ? '—' : pct(chg, lang)}</td>` +
      `<td class="tnum">${pct(vsAvg, lang)}</td></tr>`;
  }).join('');
  const tableCaption = isEs
    ? `Precio de la electricidad por kWh y por estado, ${esc(data.meta.period)}`
    : `Electricity price per kWh by US state, ${esc(data.meta.period)}`;
  const table = `<table><caption>${tableCaption}</caption><thead><tr><th>${t.thState}</th><th>${t.thPrice}</th><th>${t.thChange}</th><th>${t.thVsAvg}</th></tr></thead><tbody>${rows}</tbody></table>`;

  // One bar per state plus a highlighted row for the national average, so the
  // reader can see at a glance which side of it they are on.
  const max = dearest.cents;
  const bar = (label, value, isNow) =>
    `<div class="cbar-row${isNow ? ' is-now' : ''}"><div class="cbar-label"><span>${esc(label)}</span><b>${esc(cents(value, lang))}</b></div>` +
    `<div class="cbar-track"><div class="cbar-fill" style="--w:${Math.round(value / max * 100)}%"></div></div></div>`;
  const bars = [
    bar(isEs ? 'Media de EE. UU.' : 'US average', avg, true),
    ...states.map((s) => bar(stateName(s), s.cents, false)),
  ].join('\n');

  const canonical = `https://${cfg.domain}/${pfx}${SLUG}/`;
  const ctx = Object.assign({}, base, uiStrings(lang), {
    REL: rel(depth), HOME: rel(depth) + pfx,
    LANG_ATTR: lang, LANG_UPPER: lang.toUpperCase(), LANG_OTHER: isEs ? 'EN' : 'ES', LANG_PREFIX: pfx,
    CANONICAL: canonical,
    HREF_EN: `https://${cfg.domain}/${SLUG}/`, HREF_ES: `https://${cfg.domain}/es/${SLUG}/`,
    OG_LOCALE: ogLocale(lang), OG_TYPE: 'website', OG_IMAGE: 'og-default.png',
    TAGLINE: (isEs && cfg.tagline_es) || cfg.tagline || '',
    PAGE_TITLE: t.title, PAGE_DESC: t.desc,
    PAGE_KEYWORDS: isEs
      ? 'precio de la luz por estado, precio kwh estados unidos, tarifa electrica por estado'
      : 'electricity cost per kwh by state, cost per kilowatt hour by state, kwh rate by state, average electricity price by state',
    PARENT_LABEL: t.parent,
    DATASET_NAME: t.datasetName, DATASET_DESC: t.datasetDesc, DATASET_PERIOD: data.meta.period,
    SECTION_SLUG: '', DATE_PUBLISHED: data.meta.updated, DATE_MODIFIED: data.meta.updated,
    TILES_HTML: tiles, INTRO_HTML: t.intro,
    BILL_NOTE: t.billNote, BILL_HTML: billTable,
    TABLE_NOTE: t.tableNote, TABLE_HTML: table,
    COMPARE_NOTE: t.compareNote, BARS_HTML: bars,
    WHY_HTML: t.whyHtml,
    UPDATED: data.meta.updated, SOURCES: esc(data.meta.source), DISCLAIMER_NOTE: t.disclaimer,
    T_BILL: t.bill, T_TABLE: t.table, T_COMPARE: t.compare, T_WHY: t.why,
    T_UPDATED: t.updated, T_CALC_CTA: t.calcCta, T_COUNTRY_CTA: t.countryCta,
    PAGE_SCRIPTS: '',
    SHARE_URL: encodeURIComponent(canonical), SHARE_TITLE: encodeURIComponent(t.title),
    SHARE_MEDIA: encodeURIComponent(`https://${cfg.domain}/assets/img/og-default.png`),
  });

  const html = renderFile('us-states-page.html', ctx, {
    templatesDir,
    flags: Object.assign({}, flags, { pageEn: !isEs, pageEs: isEs }),
    sections: localizeSections(cfg.sections, lang),
  });
  const dest = path.join(ROOT, pfx, SLUG, 'index.html');
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, html, 'utf-8');
  return dest;
}

for (const lang of langs) console.log('  + ' + path.relative(ROOT, build(lang)));
console.log(`✓ us-states page generated (${states.length} jurisdictions, ${data.meta.period}).`);
