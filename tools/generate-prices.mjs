#!/usr/bin/env node
/*
  generate-prices.mjs — build the "electricity prices by country" reference page
  (EN + /es/) from data/energy-prices.json: a USD comparison bar chart where the
  countries that have their own page link to it, and the main retailers per
  country. Run from the site root:
    node tools/generate-prices.mjs
  Sitemap picks the pages up automatically (filesystem walk). Idempotent.
*/
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { renderFile } from './template-engine.mjs';
import { uiStrings, localizeSections, ogLocale } from './site-i18n.mjs';
import { buildFlags, buildBase } from './site-context.mjs';
import { COUNTRY_PAGES, countrySlug } from './country-pages.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const templatesDir = path.join(ROOT, 'templates');
const cfg = JSON.parse(readFileSync(path.join(ROOT, 'site.config.json'), 'utf-8'));
const data = JSON.parse(readFileSync(path.join(ROOT, 'data', 'energy-prices.json'), 'utf-8'));
const SLUG = 'electricity-prices';
const langs = cfg.languages;
const flags = buildFlags(cfg);
const base = buildBase(cfg);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Cheapest and dearest drive the headline tiles and the opening line: the
// spread is the point of the page, and it reads better as a fact than as a
// generic "prices vary".
const byUsd = [...data.countries].sort((a, b) => b.usd - a.usd);
const dearest = byUsd[0];
const cheapest = byUsd[byUsd.length - 1];
const spread = (dearest.usd / cheapest.usd).toFixed(1);
const median = (() => {
  const v = data.countries.map((c) => c.usd).sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
})();

const STR = {
  en: {
    title: 'Electricity Prices by Country (2026)',
    desc: 'Compare typical residential electricity prices per kWh across ' + data.countries.length + ' countries, plus the main retailers in each — then try the cost calculators.',
    tiles: [
      ['Countries compared', String(data.countries.length)],
      ['Cheapest', `$${cheapest.usd.toFixed(2)} · ${cheapest.name}`],
      ['Most expensive', `$${dearest.usd.toFixed(2)} · ${dearest.name}`],
      ['Spread', `${spread}×`],
    ],
    intro: `<p>Electricity costs ${spread} times more per kilowatt-hour in ${dearest.name} than in ${cheapest.name}. That single fact does more to your yearly bill than any appliance you could buy, and it is why a running-cost figure copied from a foreign site is usually wrong for you.</p>
      <p>This page collects typical residential prices per kilowatt-hour across ${data.countries.length} countries, with the main retailers in each, so you can find your own number and use it in every calculator on the site. The median across these countries is about $${median.toFixed(2)}/kWh.</p>`,
    definition: `Every country figure is the average residential price per kWh with all taxes included, for the 2500–4999 kWh/year band — a typical medium household. That is the number that lands on a bill. EU figures and Norway are Eurostat ${data.meta.period}; the United States is the EIA monthly average; the rest are checked by hand and carry the date they were last verified.`,
    compare: 'Price comparison (USD per kWh)', compareNote: 'Local prices converted to US dollars for a like-for-like comparison. Bars are relative to the most expensive country. Pick any country with its own page to see what a kilowatt-hour costs there in detail.',
    usCallout: 'In the United States there is no single national price: it ranges from around 12 cents to over 50 cents per kWh depending on the state.',
    usCta: 'See the price per kWh in all 50 states',
    breakdown: 'What you are actually paying for',
    breakdownHtml: `<p>The number on this page is the all-in price: what you pay divided by what you used. It bundles three very different things, and knowing the split explains most of the gap between countries.</p>
      <ul>
        <li><strong>Energy</strong> — generating the electricity. Typically a third to a half of a residential bill. This is the part that moves with gas prices, droughts and carbon costs, and the only part a competitive retailer can really compete on.</li>
        <li><strong>Networks</strong> — the wires that bring it to your meter, plus metering and system operation. Usually a quarter to a third. It is regulated, roughly fixed, and barely responds to how much you use, which is why cutting consumption never cuts a bill proportionally.</li>
        <li><strong>Taxes and levies</strong> — VAT or sales tax, plus whatever the country funds through the bill: renewable support, social tariffs, nuclear decommissioning, efficiency schemes. This is where countries diverge most. Some add over 40% on top; others almost nothing.</li>
      </ul>
      <p>Two countries can generate at the same cost and still land 15 cents apart once networks and levies are added. That is why comparing "the price of electricity" between countries is really comparing three policies at once.</p>`,
    why: 'Why the differences are so large',
    whyHtml: `<ul>
        <li><strong>What the grid runs on.</strong> Hydro and domestic gas are cheap and stable; imported LNG and oil are neither. Countries that must ship their fuel in pay for the shipping in every kilowatt-hour.</li>
        <li><strong>How exposed the market is to gas.</strong> In most European markets the last plant needed to meet demand sets the price for everyone, and that plant is usually gas-fired. A gas shock therefore raises the price of hydro and nuclear power too.</li>
        <li><strong>Taxes and what they fund.</strong> Germany's price is high partly by design: decades of renewable build-out were financed through the bill rather than the budget.</li>
        <li><strong>Density and distance.</strong> Small dense countries recover network costs across many customers per kilometre of cable. Large sparse ones do not.</li>
        <li><strong>Whether prices are capped.</strong> Some markets regulate the default tariff, which smooths spikes but also delays the falls.</li>
      </ul>`,
    providers: 'Main retailers by country', providersNote: 'Indicative standard-tariff prices for the largest providers — switch between them inside any calculator using the country and provider selectors.',
    using: 'Using the right number',
    usingHtml: `<p>An average is a starting point, not your tariff. The figure on your own bill beats everything here, and every calculator on this site lets you type it in. Three things worth checking before you trust an average:</p>
      <ul>
        <li><strong>Standing charges.</strong> Many countries bill a fixed daily amount on top of the per-kWh rate. A low unit price with a high standing charge can cost more overall than the reverse.</li>
        <li><strong>Time of use.</strong> If your tariff has cheap and expensive hours, a single average hides the fact that moving the dishwasher and the dryer is worth real money.</li>
        <li><strong>Season.</strong> Prices published mid-year rarely match a January bill.</li>
      </ul>`,
    updated: 'Updated', calcCta: 'Try the electricity cost calculator',
    trademark: 'Company, retailer and utility names mentioned on this page are trademarks of their respective owners, used here for identification and price comparison only. WattFigures is not affiliated with, sponsored by, or endorsed by any of them.',
  },
  es: {
    title: 'Precio de la luz por país (2026)',
    desc: 'Compara el precio típico de la luz por kWh en ' + data.countries.length + ' países, más las principales compañías de cada uno y las calculadoras de coste.',
    tiles: [
      ['Países comparados', String(data.countries.length)],
      ['Más barato', `${cheapest.usd.toFixed(2).replace('.', ',')} $ · ${cheapest.name_es}`],
      ['Más caro', `${dearest.usd.toFixed(2).replace('.', ',')} $ · ${dearest.name_es}`],
      ['Diferencia', `${spread.replace('.', ',')}×`],
    ],
    intro: `<p>La electricidad cuesta ${spread.replace('.', ',')} veces más por kilovatio-hora en ${dearest.name_es} que en ${cheapest.name_es}. Ese solo dato pesa más en tu factura anual que cualquier aparato que puedas comprar, y es la razón de que un coste de funcionamiento copiado de una web extranjera casi nunca te sirva.</p>
      <p>Esta página reúne los precios residenciales típicos por kilovatio-hora de ${data.countries.length} países, con las principales compañías de cada uno, para que encuentres tu cifra y la uses en todas las calculadoras del sitio. La mediana de estos países ronda los ${median.toFixed(2).replace('.', ',')} $/kWh.</p>`,
    definition: `Cada cifra de país es el precio medio residencial por kWh con todos los impuestos incluidos, en la banda de 2500–4999 kWh/año — un hogar medio típico. Es el número que acaba en la factura. Los países de la UE y Noruega salen de Eurostat ${data.meta.period}; Estados Unidos, de la media mensual de la EIA; el resto se comprueban a mano y llevan la fecha de su última verificación.`,
    compare: 'Comparativa de precios (USD por kWh)', compareNote: 'Precios locales convertidos a dólares para comparar de forma homogénea. Las barras son relativas al país más caro. Pincha en cualquier país con página propia para ver al detalle lo que cuesta allí el kilovatio-hora.',
    usCallout: 'En Estados Unidos no hay un precio nacional único: va de unos 12 centavos a más de 50 por kWh según el estado.',
    usCta: 'Mira el precio por kWh en los 50 estados',
    breakdown: 'Qué estás pagando en realidad',
    breakdownHtml: `<p>La cifra de esta página es el precio final: lo que pagas dividido por lo que gastaste. Mete dentro tres cosas muy distintas, y saber el reparto explica casi toda la diferencia entre países.</p>
      <ul>
        <li><strong>Energía</strong> — generar la electricidad. Suele ser entre un tercio y la mitad de una factura doméstica. Es la parte que se mueve con el gas, las sequías y el precio del CO₂, y la única en la que una comercializadora puede competir de verdad.</li>
        <li><strong>Redes</strong> — los cables que la traen hasta tu contador, más la medida y la operación del sistema. Normalmente entre un cuarto y un tercio. Está regulada, es casi fija y apenas depende de cuánto gastes: por eso recortar consumo nunca recorta la factura en la misma proporción.</li>
        <li><strong>Impuestos y cargos</strong> — el IVA y lo que cada país decide financiar por factura: apoyo a renovables, bono social, desmantelamiento nuclear, planes de eficiencia. Aquí es donde más se separan unos países de otros. Algunos añaden más de un 40% encima; otros casi nada.</li>
      </ul>
      <p>Dos países pueden generar al mismo coste y acabar separados por 15 centavos una vez sumadas redes y cargos. Por eso comparar «el precio de la luz» entre países es en realidad comparar tres políticas a la vez.</p>`,
    why: 'Por qué las diferencias son tan grandes',
    whyHtml: `<ul>
        <li><strong>Con qué funciona la red.</strong> La hidráulica y el gas propio son baratos y estables; el GNL y el petróleo importados no son ni lo uno ni lo otro. Los países que traen el combustible en barco pagan ese barco en cada kilovatio-hora.</li>
        <li><strong>Cuánto depende el mercado del gas.</strong> En la mayoría de mercados europeos la última central necesaria para cubrir la demanda fija el precio para todas, y suele ser de gas. Una subida del gas encarece también la hidráulica y la nuclear.</li>
        <li><strong>Los impuestos y lo que financian.</strong> El precio alemán es alto en parte por decisión propia: décadas de despliegue renovable se pagaron por factura y no por presupuesto.</li>
        <li><strong>Densidad y distancia.</strong> Un país pequeño y denso reparte el coste de red entre muchos clientes por kilómetro de cable. Uno grande y disperso, no.</li>
        <li><strong>Si hay precios regulados.</strong> Algunos mercados fijan la tarifa por defecto, lo que suaviza los picos pero también retrasa las bajadas.</li>
      </ul>`,
    providers: 'Principales compañías por país', providersNote: 'Precios orientativos de tarifa estándar de las grandes compañías — cámbialas dentro de cualquier calculadora con los selectores de país y compañía.',
    using: 'Usar la cifra correcta',
    usingHtml: `<p>Una media es un punto de partida, no tu tarifa. La cifra de tu propia factura gana a todo lo de aquí, y todas las calculadoras del sitio te dejan escribirla. Tres cosas que conviene mirar antes de fiarte de una media:</p>
      <ul>
        <li><strong>El término fijo.</strong> Muchos países cobran una cantidad fija al día además del precio por kWh. Un precio por unidad bajo con un fijo alto puede salir más caro que al revés.</li>
        <li><strong>La discriminación horaria.</strong> Si tu tarifa tiene horas caras y baratas, una media única esconde que mover el lavavajillas y la secadora vale dinero de verdad.</li>
        <li><strong>La estación.</strong> Un precio publicado a mitad de año rara vez cuadra con una factura de enero.</li>
      </ul>`,
    updated: 'Actualizado', calcCta: 'Prueba la calculadora de coste eléctrico',
    trademark: 'Los nombres de comercializadoras y compañías eléctricas mencionados en esta página son marcas registradas de sus respectivos propietarios, usados aquí solo para identificación y comparación de precios. WattFigures no está afiliado, patrocinado ni respaldado por ninguna de ellas.',
  },
};

const rel = d => (d === 0 ? '' : '../'.repeat(d));

function build(lang) {
  const t = STR[lang];
  const isEs = lang === 'es';
  const pfx = isEs ? 'es/' : '';
  const depth = isEs ? 2 : 1;
  const name = c => (isEs ? c.name_es : c.name);
  // A column of prices only reads as a column when every figure has the same
  // number of decimals: the raw JSON gives 0.4 sitting above 0.39, and $2 and
  // ₹8 further down, which reads as three different precisions. The yen has no
  // sub-unit, so ¥31 stays whole. Mirrored in assets/energy-prices.js, which
  // labels the same prices in the calculator's country picker.
  const dec = c => (c.currency === 'JPY' ? 0 : 2);
  const num = (v, d) => { const s = v.toFixed(d); return isEs ? s.replace('.', ',') : s; };
  const priceLabel = (c, price = c.price) =>
    (c.pos === 'pre' ? c.symbol + num(price, dec(c)) : num(price, dec(c)) + ' ' + c.symbol);
  // The stat tiles above this table already wrote "0,46 $" in Spanish while the
  // table wrote "$0.46" on the same page.
  const usdLabel = v => (isEs ? num(v, 2) + ' $' : '$' + num(v, 2));
  const sorted = [...data.countries].sort((a, b) => b.usd - a.usd);
  const maxUsd = Math.max(...data.countries.map(c => c.usd));

  // Countries with a page of their own get linked from their own row. The page
  // sits directly below this one, so the href is just the slug. Without this
  // the country pages are orphans — and Search Console shows Google's internal
  // link graph for this site is still the pre-301 www one, so internal links
  // are carrying more weight than usual right now.
  const hasPage = c => COUNTRY_PAGES.includes(c.code);
  const countryCell = c => (hasPage(c)
    ? `<a class="ul-link" href="${countrySlug(c.name)}/">${esc(name(c))}</a>`
    : esc(name(c)));

  // These bars used to be followed by a table repeating the same three columns
  // for the same countries. The table is gone; the bars carry the links it had,
  // so the 14 country pages keep exactly the internal links they were getting.
  // The 9 countries without a page stay plain divs — a link to nowhere is worse
  // than no link.
  const bars = sorted.map(c => {
    const pct = Math.round(c.usd / maxUsd * 100);
    const inner = `<div class="cbar-label"><span>${esc(name(c))}</span><b>${esc(priceLabel(c))} · ${esc(usdLabel(c.usd))}</b></div>` +
      `<div class="cbar-track"><div class="cbar-fill" style="--w:${pct}%"></div></div>`;
    return hasPage(c)
      ? `<a class="cbar-row is-link" href="${countrySlug(c.name)}/">${inner}</a>`
      : `<div class="cbar-row">${inner}</div>`;
  }).join('\n');

  const withProv = data.countries.filter(c => c.providers && c.providers.length);
  const providers = withProv.map(c =>
    `<p><strong>${countryCell(c)}:</strong> ` + c.providers.map(p => `${esc(p.name)} ${esc(priceLabel(c, p.price))}`).join(' · ') + '</p>'
  ).join('\n');

  const canonical = `https://${cfg.domain}/${pfx}${SLUG}/`;
  const ctx = Object.assign({}, base, uiStrings(lang), {
    REL: rel(depth), HOME: rel(depth) + pfx,
    LANG_ATTR: lang, LANG_UPPER: lang.toUpperCase(), LANG_OTHER: isEs ? 'EN' : 'ES', LANG_PREFIX: pfx,
    CANONICAL: canonical,
    HREF_EN: `https://${cfg.domain}/${SLUG}/`, HREF_ES: `https://${cfg.domain}/es/${SLUG}/`,
    OG_LOCALE: ogLocale(lang), OG_TYPE: 'website', OG_IMAGE: 'og-default.png',
    TAGLINE: (isEs && cfg.tagline_es) || cfg.tagline || '',
    PAGE_TITLE: t.title, PAGE_DESC: t.desc, PAGE_KEYWORDS: isEs ? 'precio de la luz por país, precio kwh por país, compañías eléctricas' : 'electricity prices by country, kwh price by country, electricity providers',
    SECTION_SLUG: '', DATE_PUBLISHED: data.meta.updated, DATE_MODIFIED: data.meta.updated,
    TILES_HTML: t.tiles.map(([label, value]) =>
      `<div class="stat-tile"><div class="stat-value">${esc(value)}</div><span class="stat-label">${esc(label)}</span></div>`).join('\n'),
    INTRO_HTML: t.intro, BARS_HTML: bars, PROVIDERS_HTML: providers,
    // The US page is the deepest thing on the site; the country table is where
    // an American reader lands and finds a single averaged figure that hides a
    // 4× internal spread, so the pointer belongs right under it.
    US_CALLOUT: `${t.usCallout} <a class="ul-link" href="${rel(depth) + pfx}electricity-prices/us-states/">${t.usCta} →</a>`,
    BREAKDOWN_HTML: t.breakdownHtml, WHY_HTML: t.whyHtml, USING_HTML: t.usingHtml,
    COMPARE_NOTE: t.compareNote, PROVIDERS_NOTE: t.providersNote, UPDATED: data.meta.updated,
    // Spelling out the definition is the fix for what went wrong: until
    // 2026-07-26 some countries carried tax-inclusive prices and others
    // tax-exclusive, and nothing on the page said which — so nobody could tell.
    // t.definition is translated; meta.sources was not, and shipped English on
    // the Spanish page until 2026-07-28. Both halves of the sentence now follow
    // the reader.
    SOURCES: esc(t.definition + ' ' + (isEs ? data.meta.sources_es : data.meta.sources)),
    TRADEMARK_NOTE: t.trademark,
    T_COMPARE: t.compare, T_PROVIDERS: t.providers, T_UPDATED: t.updated, T_CALC_CTA: t.calcCta,
    T_BREAKDOWN: t.breakdown, T_WHY: t.why, T_USING: t.using,
    PAGE_SCRIPTS: '',
    SHARE_URL: encodeURIComponent(canonical), SHARE_TITLE: encodeURIComponent(t.title), SHARE_MEDIA: encodeURIComponent(`https://${cfg.domain}/assets/img/og-default.png`),
  });
  const html = renderFile('prices-page.html', ctx, {
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
console.log('✓ electricity-prices page generated (' + data.countries.length + ' countries).');
