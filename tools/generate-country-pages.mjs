#!/usr/bin/env node
/*
  generate-country-pages.mjs — build one "electricity price in <country>" page
  per country (EN + /es/) from data/energy-prices.json. Run from the site root:
    node tools/generate-country-pages.mjs
  Sitemap, Pagefind and the table wrapper pick the pages up automatically.
  Idempotent.

  Why these pages exist: Search Console shows the site ranking at position 7 for
  "belgium residential electricity price per kwh 2026" — with no Belgium page at
  all, purely off the aggregate table. The queries that name a country land on
  the first page; the generic ones sit at 50-99. Same reasoning as
  generate-us-states.mjs: depth on the asset that already ranks.

  The hard constraint is that these must NOT be one page with the number
  swapped — that is the "low value content" failure mode, and the appliance
  pages already cost a session to fix (R1). So a country only gets a page when
  it has something of its own to say, and the generator refuses to build one
  otherwise: real retailer tariffs, a sourced price with a date, and the grid's
  carbon intensity. The co2 field has been in the data since the start and was
  displayed nowhere until this page.

  Adding a country = adding its code to COUNTRIES, provided it passes the check.
*/
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { renderFile } from './template-engine.mjs';
import { uiStrings, localizeSections, ogLocale, capMeta } from './site-i18n.mjs';
import { buildFlags, buildBase } from './site-context.mjs';
import { typicalYearlyKwh } from './appliance-energy.mjs';
import { COUNTRY_PAGES, countrySlug, ineligible, hasRetail, hasGas, breakEvenCop, BOILER_EFF } from './country-pages.mjs';
import { nf, priceLabel, moneyLabel, usdLabel, usdTotal } from './money.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const templatesDir = path.join(ROOT, 'templates');
const cfg = JSON.parse(readFileSync(path.join(ROOT, 'site.config.json'), 'utf-8'));
const data = JSON.parse(readFileSync(path.join(ROOT, 'data', 'energy-prices.json'), 'utf-8'));
const appliances = JSON.parse(readFileSync(path.join(ROOT, 'data', 'appliances.json'), 'utf-8')).appliances;

const PARENT = 'electricity-prices';
const langs = cfg.languages;
const flags = buildFlags(cfg);
const base = buildBase(cfg);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Which countries get a page, and the eligibility rule, live in
// country-pages.mjs — generate-prices.mjs needs the same list to link to them.

// The four the page costs out. One always-on, one per-cycle, one seasonal-ish
// heavy load and one big continuous one — enough range that a reader recognises
// their own bill, and different enough from the us-states set that the two
// pages do not read as the same table twice.
const SHOWCASE = ['refrigerator', 'washing-machine', 'tumble-dryer', 'electric-water-heater'];

/* The US page is the exception. /electricity-prices/us-states/ already costs
   out air-conditioner, refrigerator, tumble-dryer and electric-water-heater, so
   the default set would repeat three of its four rows on a page linked from the
   same hub — two pages of ours competing for the same reader. */
const SHOWCASE_BY_COUNTRY = {
  US: ['electric-oven', 'dishwasher', 'led-tv', 'desktop-pc'],
};

// Resolved once, loudly: a stale slug should stop the build, not quietly drop a
// row and leave the total disagreeing with the table above it.
const resolveShowcase = (slugs) => slugs.map((slug) => {
  const a = appliances.find((x) => x.slug === slug);
  if (!a) throw new Error(`appliances.json has no "${slug}" — a SHOWCASE list is stale`);
  return { a, kwh: typicalYearlyKwh(a) };
});
const showcaseFor = (c) => resolveShowcase(SHOWCASE_BY_COUNTRY[c.code] || SHOWCASE);

// The consumption band the prices are defined for (meta.definition). Using its
// midpoint means the yearly bill and the yearly emissions on this page rest on
// the same household the price itself assumes, instead of a number picked to
// look good.
const BAND = [2500, 4999];
const TYPICAL_KWH = Math.round((BAND[0] + BAND[1]) / 2 / 100) * 100;   // 3,700

/* "manual" is the honest label for a figure with nobody behind it, and until
   2026-07-27 it sat on the three live pages that could least afford it: Great
   Britain, Canada and Australia — one of them the second-largest
   English-speaking market on this site.

   What was wrong was not the age of those numbers but their basis. Every other
   country here is a total bill divided by kWh, all taxes and standing charges
   in, because that is what Eurostat and the EIA publish. The three were unit
   rates with the fixed charges left out, which understates them by a quarter
   to a third: Ofgem's cap for July 2026 is 26.11p per kWh *plus* 57.19p a day,
   and spread over the band midpoint of 3,700 kWh/year that is 31.75p, not the
   24p the file held.

   Ofgem publishes a cap for GB. Neither Canada nor Australia has a national
   regulator that publishes anything comparable — both regulate province by
   province and region by region, and the AER's Default Market Offer covers
   three regions of one country — so they take the only body that states a
   national figure on the all-in basis, and the page says whose it is. */
const SOURCE_META = {
  eurostat: { type: 'Organization', name: 'Eurostat', url: 'https://ec.europa.eu/eurostat/' },
  eia: { type: 'GovernmentOrganization', name: 'U.S. Energy Information Administration', url: 'https://www.eia.gov/' },
  ofgem: { type: 'GovernmentOrganization', name: 'Ofgem', url: 'https://www.ofgem.gov.uk/' },
  gpp: { type: 'Organization', name: 'GlobalPetrolPrices', url: 'https://www.globalpetrolprices.com/' },
  elcom: { type: 'GovernmentOrganization', name: 'ElCom — Swiss Federal Electricity Commission', url: 'https://www.elcom.admin.ch/' },
  mbie: { type: 'GovernmentOrganization', name: 'New Zealand Ministry of Business, Innovation and Employment', url: 'https://www.mbie.govt.nz/' },
  // Kept for the day something genuinely has no attributable body. Nothing uses
  // it since 2026-07-28: "manual" said a human typed the number, which is not
  // the same as saying where it came from, and that is how the US price stayed
  // stale for months without anyone being able to check it.
  manual: { type: 'Organization', name: cfg.brand, url: `https://${cfg.domain}/legal/methodology/` },
};

// ── the whole-file facts each page compares itself against ──────────────────
const all = data.countries;
const byUsd = [...all].sort((a, b) => b.usd - a.usd);
const median = byUsd[Math.floor(byUsd.length / 2)];
const dearest = byUsd[0];
const cheapest = byUsd[byUsd.length - 1];
const byCo2 = [...all].sort((a, b) => a.co2 - b.co2);
const cleanest = byCo2[0];
const dirtiest = byCo2[byCo2.length - 1];

// ── formatters ──────────────────────────────────────────────────────────────
// nf/priceLabel/moneyLabel/usdLabel/usdTotal moved to money.mjs when the
// appliance pages started printing the same fourteen currencies: two copies of
// a formatter drift, and these two files link to each other.
/* Gas is stored to three decimals because two would quantise it by 2%, so it
   has to be printed to three as well. Rounding 0.144 to "0.14" on the page
   leaves a reader who recomputes the ratio from the printed figures with a
   different answer from the one printed next to it. */
const gasLabel = (c, lang) => {
  const d = Math.min(3, Math.max(2, (String(c.gas).split('.')[1] || '').length));
  const s = nf(c.gas, lang, d);
  return c.pos === 'pre' ? c.symbol + s : s + ' ' + c.symbol;
};
const pct = (v, lang) => (v >= 0 ? '+' : '−') + nf(Math.abs(v), lang, 0) + ' %';

const ordinal = (n, lang) => {
  if (lang === 'es') return `${n}.º`;
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return n + (['th', 'st', 'nd', 'rd'][n % 10] || 'th');
};

// "the 1st dearest of 23" is not how anyone says it. The ends of the ranking
// get their own wording; only the middle takes an ordinal.
const rankPhrase = (rank, total, lang) => {
  if (lang === 'es') {
    if (rank === 1) return `el más caro de los ${total} países que seguimos`;
    if (rank === total) return `el más barato de los ${total} países que seguimos`;
    return `el ${ordinal(rank, lang)} más caro de los ${total} países que seguimos`;
  }
  if (rank === 1) return `the dearest of the ${total} countries tracked here`;
  if (rank === total) return `the cheapest of the ${total} countries tracked here`;
  return `the ${ordinal(rank, lang)} dearest of the ${total} countries tracked here`;
};
const rankTile = (rank, total, lang) => {
  if (lang === 'es') return rank === 1 ? 'el más caro' : rank === total ? 'el más barato' : `${ordinal(rank, lang)} más caro`;
  return rank === 1 ? 'dearest' : rank === total ? 'cheapest' : `${ordinal(rank, lang)} dearest`;
};

const rel = (d) => (d === 0 ? '' : '../'.repeat(d));

/* Three of the fourteen take a definite article, and without it the title reads
   "Electricity Price per kWh in United Kingdom". The article is a property of
   the name, so it lives with the name rather than being pasted in at each of
   the dozen places the name appears. */
const ARTICLE = {
  GB: { en: 'the ', es: 'el ' },
  US: { en: 'the ', es: 'los ' },
  NL: { en: 'the ', es: 'los ' },
};
/* The description has to promise only what the page actually carries: Sweden
   has no retailer table, so offering "what the main retailers charge" in its
   meta description is a promise the page breaks in the search result itself. */
const blurb = (c, lang) => {
  const r = hasRetail(c), g = hasGas(c);
  if (lang === 'es') {
    if (r && g) return 'Lo que cobran las principales compañías, si aquí compensa una bomba de calor frente al gas, y cómo de limpia es la red.';
    if (r) return 'Lo que cobran las principales compañías, lo que eso hace en una factura real y cómo de limpia es la red que hay detrás.';
    return 'Lo que eso supone en una factura real, si aquí compensa una bomba de calor frente al gas, y cómo de limpia es la red.';
  }
  if (r && g) return 'What the main retailers charge, whether a heat pump beats gas here, and how clean the grid behind it is.';
  if (r) return 'What the main retailers charge, what that does to a real bill, and how clean the grid behind it is.';
  return 'What that means on a real bill, whether a heat pump beats gas here, and how clean the grid behind it is.';
};

const bare = (c, lang) => (lang === 'es' ? c.name_es : c.name);
const theName = (c, lang) => ((ARTICLE[c.code] || {})[lang] || '') + bare(c, lang);
// Same thing where a sentence starts with it.
const TheName = (c, lang) => {
  const s = theName(c, lang);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/*
  The heating section, and the reason Austria and Sweden get a page at all.

  A country's electricity price alone says nothing about how to heat a house.
  The ratio against its gas price does: it sets the break-even COP, the seasonal
  efficiency at which a heat pump and a condensing boiler cost the same to run.
  That number runs from about 1.2 in Sweden to 3.6 in Belgium — the same machine
  is an easy win in one country and a losing bet in another, which is a genuinely
  different thing to say on each page rather than the same sentence with the
  price swapped.
*/
function gasBlock(c, f, lang) {
  const isEs = lang === 'es';
  const the = theName(c, lang);
  const cop = f.cop;
  const n = (v, d = 0) => nf(v, lang, d);
  // Where a real air-source unit lands: seasonal COP is typically 2.8-3.8, so
  // the verdict is about whether break-even sits below, inside or above that.
  const band = cop < 2.8 ? 0 : cop <= 3.8 ? 1 : 2;

  if (!isEs) {
    const verdict = [
      `That is below what almost any modern air-source heat pump manages over a season, so in ${the} the heat pump is the cheaper machine to run and it is not close.`,
      `That sits inside the range a real air-source unit actually delivers over a season (roughly 2.8 to 3.8), so in ${the} the answer depends on the specific machine, the radiators and the winter — worth doing the arithmetic rather than assuming.`,
      `That is above what most air-source units hold over a whole season, so in ${the} a gas boiler is likely to stay the cheaper one to run unless the installation is unusually good.`,
    ][band];
    return `<p>Gas costs <strong>${gasLabel(c, lang)}</strong> per kWh in ${the}, against ${priceLabel(c, c.price, lang)} for electricity — so electricity is about <strong>${n(f.ratio, 1)} times</strong> the price of gas here. All taxes included on both sides, same period, so they can be compared directly.</p>
      <p>That ratio decides how a house is cheapest to heat. A heat pump delivers several units of heat per unit of electricity; a ${n(BOILER_EFF * 100)}% condensing boiler delivers slightly less heat than the gas it burns. The two cost the same to run at a seasonal COP of <strong>${n(cop, 1)}</strong> — that is the break-even for ${the}. ${verdict}</p>`;
  }

  const verdict = [
    `Está por debajo de lo que consigue casi cualquier bomba de calor moderna a lo largo de una temporada, así que en ${the} la bomba sale más barata de usar, y no por poco.`,
    `Cae dentro de lo que una bomba de aire da realmente en una temporada (más o menos entre 2,8 y 3,8), así que en ${the} la respuesta depende de la máquina concreta, de los radiadores y del invierno — conviene hacer la cuenta en vez de darlo por supuesto.`,
    `Está por encima de lo que la mayoría de bombas de aire sostienen durante toda una temporada, así que en ${the} la caldera de gas seguirá siendo probablemente la más barata de usar salvo instalación muy buena.`,
  ][band];
  return `<p>El gas cuesta <strong>${gasLabel(c, lang)}</strong> el kWh en ${the}, frente a ${priceLabel(c, c.price, lang)} la electricidad — o sea que la luz cuesta aquí unas <strong>${n(f.ratio, 1)} veces</strong> lo que cuesta el gas. Con todos los impuestos en los dos casos y del mismo periodo, así que se pueden comparar directamente.</p>
    <p>Esa relación es la que decide cómo sale más barato calentar una casa. Una bomba de calor entrega varias unidades de calor por cada unidad de electricidad; una caldera de condensación al ${n(BOILER_EFF * 100)}% entrega algo menos de calor que el gas que quema. Las dos cuestan lo mismo con un COP estacional de <strong>${n(cop, 1)}</strong>: ese es el punto de equilibrio de ${the}. ${verdict}</p>`;
}

/*
  The retailer section, which says a different thing depending on whether the
  reader can act on it.

  Until 2026-07-28 every country got the same sentence: "between the cheapest and
  the dearest there is X% — that is Y you can move without using a single
  kilowatt-hour less". In a liberalised market that is true and it is the most
  useful line on the page. In the United States and Canada it is false. Duke,
  FPL, Con Edison and PG&E are regulated monopolies in different states; nobody
  moves from PG&E to Duke without moving house, so the page was promising $740 a
  year that does not exist, and C$333 on the Canadian one.

  The honest version is not weaker. "What you pay depends on which utility serves
  your address, and it varies by 154% across the country" answers a question
  people actually ask — why a bill in California is double one in North Carolina
  — which the switching pitch never did.

  Hence `market`. And hence `retailBasis`: what an advertised rate includes is a
  per-country convention (Germany quotes VAT and grid fees inside, Spain quotes
  the energy term alone), so the caveat can only be specific once somebody has
  checked. "unknown" prints the hedge this page carried before, and is what keeps
  the ratio test in test/energy-prices.test.mjs from blessing a basis nobody has
  looked at.

  ⚠️ The `unit` sentence below was wrong from the day it was written and nobody
  saw it, because until 2026-08-10 no country declared `unit` — the branch never
  rendered. The moment GB, IE, FR and AU got their basis, it printed on eight
  pages that those rates are "before tax". They are not. The definition this
  taxonomy is built on lives in test/energy-prices.test.mjs:129 and says `unit`
  is "the per-kWh rate a bill is actually charged at, missing *only* the standing
  charge" — one omission, not two. And it has to be one, or the arithmetic
  collapses: the 1.05-1.6 band is the size of a standing charge spread over a
  year's kWh. Take VAT out as well and the gap would be half as big again, which
  is `energy` territory.

  The four countries are all quoted tax-inclusive, which is why they were given
  this basis in the first place: Ofgem's cap and every British retail rate are
  quoted with the 5% VAT in, EDF's Tarif Bleu is TTC, Electric Ireland publishes
  38.04 c/kWh with VAT against 34.90 without, and Australian usage rates carry
  GST. Telling that reader the number is pre-tax invites them to add a fifth
  they have already paid.

  The lesson worth keeping: a `retailBasis` value is not just a test band, it is
  a sentence on the page. Deciding a basis publishes prose, so the prose is part
  of the decision — read the branch before setting the field.
*/
function retailCopy(c, f, lang) {
  const isEs = lang === 'es';
  const the = theName(c, lang);
  const n = (v, d = 0) => nf(v, lang, d);
  const p = (v) => priceLabel(c, v, lang);
  const regional = c.market === 'regional';
  const spread = pct(f.retailSpread, lang).replace('+', '');

  if (!isEs) {
    const basis = {
      energy: 'They are the commodity rate and nothing else — the part suppliers actually compete on. Network charges, levies and tax are set by the regulator, are the same whoever you sign with, and roughly double what you end up paying, which is why the national average is about two and a half times these numbers.',
      unit: 'They are the per-kWh rate a bill is actually charged at, tax already inside. The one thing left out is the standing charge — the fixed daily amount you pay before using anything — and that, spread over a year, is most of the gap between these and the national figure.',
      inclusive: 'They are advertised rates with energy tax and VAT already inside, but without the standing charge and before any fixed annual rebate — which is why they can sit above a national average that nets both off.',
      unknown: 'They are advertised rates, and depending on the country they may leave out VAT, network charges or the standing charge — which is why a headline number can sit below a national figure that includes all of it.',
    }[c.retailBasis] || '';
    return {
      retail: regional ? `What the main utilities in ${the} charge` : `What the main retailers in ${the} charge`,
      retailNote: regional
        ? `Indicative standard tariffs from ${f.prov.length} of the largest utilities. <strong>You do not choose your utility in ${the}</strong> — the one serving your address is a regulated monopoly, so this is a map of what the country pays rather than a list to switch between: from ${p(f.cheapestProv.price)} with ${esc(f.cheapestProv.name)} to ${p(f.dearestProv.price)} with ${esc(f.dearestProv.name)}, a spread of ${spread} that depends on where you live, not on who you sign with.`
        : `Indicative standard tariffs from the ${f.prov.length} largest retailers. Between the cheapest and the dearest there is ${spread} — on ${n(TYPICAL_KWH)} kWh a year that is ${moneyLabel(c, f.retailGapMoney, lang)} you can move without using a single kilowatt-hour less.`,
      retailCaveat: `<strong>Compare these with each other, not with the ${p(c.price)} average above.</strong> ${basis} The average is the right number for estimating a bill; ${regional ? 'these show how much the answer depends on which grid you happen to be on.' : 'these are the right numbers for choosing between suppliers.'}`,
      thRetailer: regional ? 'Utility' : 'Retailer',
    };
  }

  const basis = {
    energy: 'Son el término de energía y nada más: la única parte en la que las compañías compiten de verdad. Los peajes, los cargos y los impuestos los fija el regulador, son iguales firmes con quien firmes y casi doblan lo que acabas pagando — por eso la media nacional es unas dos veces y media estas cifras.',
    unit: 'Son el precio por kWh al que se factura de verdad, con los impuestos ya dentro. Lo único que queda fuera es el término fijo —esa cantidad diaria que se paga antes de gastar nada— y eso, repartido en un año, es casi toda la diferencia con la cifra nacional.',
    inclusive: 'Son precios anunciados con el impuesto eléctrico y el IVA ya dentro, pero sin el término fijo y antes de descontar cualquier bonificación anual fija — por eso pueden quedar por encima de una media nacional que sí resta las dos cosas.',
    unknown: 'Son precios de tarifa anunciados, y según el país pueden dejar fuera el IVA, los peajes de red o el término fijo — por eso el número de escaparate de una compañía puede quedar por debajo de una media nacional que sí lo incluye todo.',
  }[c.retailBasis] || '';
  return {
    retail: regional ? `Lo que cobran las principales distribuidoras en ${the}` : `Lo que cobran las principales compañías en ${the}`,
    retailNote: regional
      ? `Tarifas estándar orientativas de ${f.prov.length} de las mayores distribuidoras. <strong>En ${the} no se elige compañía</strong>: la que sirve tu dirección es un monopolio regulado, así que esto es un mapa de lo que se paga en el país y no una lista donde cambiarse — de ${p(f.cheapestProv.price)} con ${esc(f.cheapestProv.name)} a ${p(f.dearestProv.price)} con ${esc(f.dearestProv.name)}, un ${spread} de diferencia que depende de dónde vives, no de con quién firmes.`
      : `Tarifas estándar orientativas de las ${f.prov.length} compañías más grandes. Entre la más barata y la más cara hay un ${spread} — que sobre ${n(TYPICAL_KWH)} kWh al año son ${moneyLabel(c, f.retailGapMoney, lang)} que puedes mover sin gastar un solo kilovatio-hora menos.`,
    retailCaveat: `<strong>Compara estas cifras entre sí, no contra la media de ${p(c.price)} de arriba.</strong> ${basis} La media es el número correcto para estimar una factura; ${regional ? 'estas enseñan hasta qué punto la respuesta depende de en qué red te haya tocado estar.' : 'estos son los correctos para elegir compañía.'}`,
    thRetailer: regional ? 'Distribuidora' : 'Compañía',
  };
}

// ── the copy, with every figure interpolated ────────────────────────────────
function strings(c, lang, f) {
  const isEs = lang === 'es';
  const name = bare(c, lang);
  const the = theName(c, lang);
  const The = TheName(c, lang);
  const usdIsLocal = c.currency === 'USD';
  const p = (v) => priceLabel(c, v, lang);
  const n = (v, d = 0) => nf(v, lang, d);

  if (!isEs) return {
    parent: 'Electricity prices',
    countryName: name,
    title: `Electricity Price per kWh in ${the} (${data.meta.period.replace('-', ' ')})`,
    desc: capMeta(`A kilowatt-hour costs ${p(c.price)} in ${the}${usdIsLocal ? '' : ` — ${usdLabel(c.usd, lang)}`}, ${rankPhrase(f.rank, all.length, lang)}. ${blurb(c, "en")}`, 155),
    datasetName: `Residential electricity price and grid carbon intensity, ${name}, ${data.meta.period}`,
    datasetDesc: `Average residential electricity price per kilowatt-hour in ${name} with all taxes included, for the ${n(BAND[0])}–${n(BAND[1])} kWh/year consumption band, ${data.meta.period}, alongside indicative standard tariffs from the main retailers and the national grid's lifecycle carbon intensity.`,
    tiles: [
      ['Price per kWh', p(c.price)],
      // For a country that already prices in dollars, "in dollars" restates
      // the tile to its left. Show what it is actually worth knowing instead.
      usdIsLocal ? ['vs. the median', pct(f.vsMedian, lang)] : ['In dollars', usdLabel(c.usd, lang)],
      [`Of ${all.length} countries`, rankTile(f.rank, all.length, lang)],
      ['Grid carbon', `${n(c.co2)} g/kWh`],
    ],
    intro: `<p>Electricity in ${the} costs <strong>${p(c.price)}</strong> per kilowatt-hour${usdIsLocal ? '' : ` — ${usdLabel(c.usd, lang)} once converted`} — which puts it ${f.vsMedian === 0 ? 'right on' : (f.vsMedian > 0 ? `${pct(f.vsMedian, lang)} above` : `${pct(Math.abs(f.vsMedian), lang).replace('+', '')} below`)} the median of the ${all.length} countries tracked on this site. That is the price with <strong>all taxes included</strong>, for a household in the ${n(BAND[0])}–${n(BAND[1])} kWh a year band — one definition applied to every country, because mixing tax-inclusive and tax-exclusive figures is what puts most country comparisons out by 15% or more.</p>
      <p>What that means in practice: a household using ${n(TYPICAL_KWH)} kWh a year pays about <strong>${moneyLabel(c, f.yearlyBill, lang)}</strong> for the electricity itself. The number on your own bill will differ — that is what the retailer table below is for.</p>`,
    gas: `Heating in ${the}: gas or a heat pump?`,
    gasHtml: gasBlock(c, f, lang),
    gasCta: 'Run your own numbers',
    gasGuide: 'Where the break-even sits in 11 countries',
    ...retailCopy(c, f, lang),
    thRate: 'Per kWh', thYearly: `At ${n(TYPICAL_KWH)} kWh/yr`,
    bill: `What things actually cost to run in ${the}`,
    billNote: `Yearly running cost at ${the}'s average price of ${p(c.price)}, all taxes included. Consumption figures are the same ones the appliance pages use.`,
    thAppliance: 'Appliance', thPerYear: 'Per year', thPerMonth: 'Per month',
    billTotal: `Those four together come to <strong>${moneyLabel(c, f.showcaseYearly, lang)}</strong> a year in ${the} — ${usdTotal(f.showcaseUsd, lang)}. The same four cost ${f.peers.map((x) => peerPhrase(x, lang)).join(' and ')}. Same appliances, same hours — the difference is entirely where they are plugged in.`,
    compare: 'How that compares',
    compareNote: `${The} against the extremes and the middle of the ${all.length} countries tracked, in dollars per kWh so the comparison is like for like.`,
    carbon: 'How clean the electricity is',
    carbonHtml: `<p>Price is only half of what a kilowatt-hour costs. The grid in ${the} emits <strong>${n(c.co2)} grams of CO₂-equivalent per kWh</strong> on a lifecycle basis, averaged over a year of generation. For the same ${n(TYPICAL_KWH)} kWh household that is about <strong>${n(f.yearlyCo2)} kg of CO₂ a year</strong>.</p>
      <p>For scale: the cleanest grid tracked here is ${cleanest.name} at ${n(cleanest.co2)} g/kWh, the dirtiest is ${dirtiest.name} at ${n(dirtiest.co2)} g/kWh. ${The} sits ${f.co2Third}, ${ordinal(f.co2Rank, lang)} cleanest of ${all.length}.</p>
      <p>This matters for a practical reason as well as an environmental one: on a clean grid, swapping a gas boiler for a heat pump cuts emissions immediately. On a coal-heavy one, the same swap mostly moves the emissions from your street to the power station.</p>`,
    updated: 'Updated', calcCta: 'Work out your own cost per kWh', allCta: 'Compare all countries',
    statesCta: 'There is no single US price — see all 50 states',
    disclaimer: `The national figure is an average with all taxes included: your own tariff depends on your retailer, your contract, whether you are on time-of-use pricing, and the season. Standing charges are not in the per-kWh figure. For anything that matters, use the number on your own bill — every calculator here takes it.`,
  };

  return {
    parent: 'Precios de la luz',
    countryName: name,
    title: `Precio de la luz por kWh en ${the} (${data.meta.period.replace('-', ' ')})`,
    desc: capMeta(`El kilovatio-hora cuesta ${p(c.price)} en ${the}${usdIsLocal ? '' : ` — ${usdLabel(c.usd, lang)}`} — ${rankPhrase(f.rank, all.length, lang)}. ${blurb(c, "es")}`, 165),
    datasetName: `Precio residencial de la electricidad e intensidad de carbono de la red, ${name}, ${data.meta.period}`,
    datasetDesc: `Precio medio residencial de la electricidad por kilovatio-hora en ${name} con todos los impuestos incluidos, para la banda de consumo de ${n(BAND[0])}–${n(BAND[1])} kWh al año, ${data.meta.period}, junto a las tarifas estándar orientativas de las principales comercializadoras y la intensidad de carbono de ciclo de vida de la red nacional.`,
    tiles: [
      ['Precio por kWh', p(c.price)],
      usdIsLocal ? ['vs. la mediana', pct(f.vsMedian, lang)] : ['En dólares', usdLabel(c.usd, lang)],
      [`De ${all.length} países`, rankTile(f.rank, all.length, lang)],
      ['Carbono de la red', `${n(c.co2)} g/kWh`],
    ],
    intro: `<p>La electricidad en ${the} cuesta <strong>${p(c.price)}</strong> el kilovatio-hora${usdIsLocal ? '' : ` — ${usdLabel(c.usd, lang)} convertidos`} — lo que la deja ${f.vsMedian === 0 ? 'justo en' : (f.vsMedian > 0 ? `un ${pct(f.vsMedian, lang).replace('+', '')} por encima de` : `un ${pct(Math.abs(f.vsMedian), lang).replace('+', '')} por debajo de`)} la mediana de los ${all.length} países que seguimos. Es el precio <strong>con todos los impuestos incluidos</strong>, para un hogar de la banda de ${n(BAND[0])}–${n(BAND[1])} kWh al año — la misma definición para todos los países, porque mezclar cifras con y sin impuestos es lo que descuadra un 15% o más casi cualquier comparativa entre países.</p>
      <p>En la práctica: un hogar que gasta ${n(TYPICAL_KWH)} kWh al año paga en torno a <strong>${moneyLabel(c, f.yearlyBill, lang)}</strong> solo de electricidad. La cifra de tu factura será otra — para eso está la tabla de compañías de abajo.</p>`,
    gas: `Calefacción en ${the}: ¿gas o bomba de calor?`,
    gasHtml: gasBlock(c, f, lang),
    gasCta: 'Haz tus propios números',
    gasGuide: 'Dónde está el punto de equilibrio en 11 países',
    ...retailCopy(c, f, lang),
    thRate: 'Por kWh', thYearly: `Con ${n(TYPICAL_KWH)} kWh/año`,
    bill: `Lo que cuesta de verdad tener las cosas enchufadas en ${the}`,
    billNote: `Coste anual con el precio medio de ${the}, ${p(c.price)}, con todos los impuestos incluidos. Los consumos son los mismos que usan las fichas de electrodomésticos.`,
    thAppliance: 'Aparato', thPerYear: 'Al año', thPerMonth: 'Al mes',
    billTotal: `Los cuatro juntos suman <strong>${moneyLabel(c, f.showcaseYearly, lang)}</strong> al año en ${the} — ${usdTotal(f.showcaseUsd, lang)}. Esos mismos cuatro cuestan ${f.peers.map((x) => peerPhrase(x, lang)).join(' y ')}. Los mismos aparatos, las mismas horas — la diferencia es enteramente dónde están enchufados.`,
    compare: 'Cómo se compara',
    compareNote: `${The} frente a los extremos y la mitad de los ${all.length} países que seguimos, en dólares por kWh para que la comparación sea homogénea.`,
    carbon: 'Cómo de limpia es esa electricidad',
    carbonHtml: `<p>El precio es solo la mitad de lo que cuesta un kilovatio-hora. La red de ${the} emite <strong>${n(c.co2)} gramos de CO₂ equivalente por kWh</strong> en ciclo de vida, promediado sobre un año de generación. Para ese mismo hogar de ${n(TYPICAL_KWH)} kWh son unos <strong>${n(f.yearlyCo2)} kg de CO₂ al año</strong>.</p>
      <p>Para hacerse una idea: la red más limpia que seguimos es la de ${cleanest.name_es} con ${n(cleanest.co2)} g/kWh, y la más sucia la de ${dirtiest.name_es} con ${n(dirtiest.co2)} g/kWh. ${The} está ${f.co2ThirdEs}, ${ordinal(f.co2Rank, lang)} más limpia de ${all.length}.</p>
      <p>Esto importa por una razón práctica además de la ambiental: en una red limpia, cambiar una caldera de gas por una bomba de calor recorta emisiones desde el primer día. En una red con mucho carbón, ese mismo cambio sobre todo traslada las emisiones de tu calle a la central.</p>`,
    updated: 'Actualizado', calcCta: 'Calcula tu propio coste por kWh', allCta: 'Compara todos los países',
    statesCta: 'En EE. UU. no hay un precio único — míralo por estado',
    disclaimer: `La cifra nacional es una media con todos los impuestos incluidos: tu tarifa concreta depende de tu compañía, de tu contrato, de si tienes discriminación horaria y de la estación. El término fijo no está dentro del precio por kWh. Para cualquier cosa que importe, usa el número de tu propia factura — todas las calculadoras de aquí lo aceptan.`,
  };
}

// ── build ───────────────────────────────────────────────────────────────────
function facts(c) {
  const showcase = showcaseFor(c);
  const showcaseKwh = showcase.reduce((s, x) => s + x.kwh, 0);
  const prov = hasRetail(c) ? [...c.providers].sort((a, b) => a.price - b.price) : [];
  const cheapestProv = prov[0] || null;
  const dearestProv = prov[prov.length - 1] || null;
  const co2Rank = byCo2.findIndex((x) => x.code === c.code) + 1;
  const third = co2Rank <= Math.ceil(all.length / 3) ? 0 : co2Rank > Math.ceil(all.length * 2 / 3) ? 2 : 1;
  return {
    rank: byUsd.findIndex((x) => x.code === c.code) + 1,
    co2Rank,
    co2Third: ['in the cleaner third', 'in the middle', 'in the dirtier third'][third],
    co2ThirdEs: ['en el tercio más limpio', 'en la mitad', 'en el tercio más sucio'][third],
    vsMedian: Math.round((c.usd - median.usd) / median.usd * 100),
    yearlyBill: c.price * TYPICAL_KWH,
    yearlyCo2: Math.round(c.co2 * TYPICAL_KWH / 1000),
    showcase, showcaseKwh,
    prov, cheapestProv, dearestProv,
    retailSpread: prov.length ? Math.round((dearestProv.price - cheapestProv.price) / cheapestProv.price * 100) : 0,
    retailGapMoney: prov.length ? (dearestProv.price - cheapestProv.price) * TYPICAL_KWH : 0,
    // Gas, for the countries that have it.
    cop: hasGas(c) ? breakEvenCop(c) : null,
    ratio: hasGas(c) ? c.price / c.gas : null,
    // The showcase total, converted to dollars so it can be set against other
    // countries. Only the country figures are comparable that way — they all
    // come from one definition; the retailer tariffs do not (see retailCaveat).
    showcaseYearly: showcaseKwh * c.price,
    showcaseUsd: showcaseKwh * c.usd,
    // Whichever two of median/dearest/cheapest are not this country. Ireland is
    // the dearest, so its page must not end up comparing Ireland with Ireland.
    peers: [
      { c: median, kind: 'median' },
      { c: dearest, kind: 'dearest' },
      { c: cheapest, kind: 'cheapest' },
    ].filter((x) => x.c.code !== c.code).slice(0, 2)
      .map((x) => ({ kind: x.kind, name: x.c.name, name_es: x.c.name_es, usd: showcaseKwh * x.c.usd })),
  };
}

const peerPhrase = (peer, lang) => {
  const money = usdTotal(peer.usd, lang);
  if (lang === 'es') {
    if (peer.kind === 'median') return `${money} al precio mediano de los ${all.length}`;
    return `${money} en ${peer.name_es}, ${peer.kind === 'dearest' ? 'el más caro' : 'el más barato'}`;
  }
  if (peer.kind === 'median') return `${money} at the median of the ${all.length}`;
  return `${money} in ${peer.name}, the ${peer.kind}`;
};

function build(c, lang) {
  const isEs = lang === 'es';
  const f = facts(c);
  const t = strings(c, lang, f);
  // English slug in both languages, same as us-states and the guides: one URL
  // path per page, only the /es/ prefix differs.
  const SLUG = `${PARENT}/${countrySlug(c.name)}`;
  const pfx = isEs ? 'es/' : '';
  // electricity-prices/<country>/ → two levels from root, three under /es/.
  const depth = isEs ? 3 : 2;

  const tiles = t.tiles
    .map(([label, value]) => `<div class="stat-tile"><div class="stat-value">${esc(value)}</div><span class="stat-label">${esc(label)}</span></div>`)
    .join('\n');

  const retailRows = f.prov.map((p) =>
    `<tr><td>${esc(p.name)}</td><td class="tnum">${esc(priceLabel(c, p.price, lang))}</td>` +
    `<td class="tnum">${esc(moneyLabel(c, p.price * TYPICAL_KWH, lang))}</td></tr>`).join('');
  const retailCaption = isEs
    ? `Principales compañías eléctricas en ${theName(c, lang)} — precio por kWh y al año`
    : `Main electricity retailers in ${theName(c, lang)} — price per kWh and per year`;
  const retailTable = `<table><caption>${esc(retailCaption)}</caption><thead><tr><th>${t.thRetailer}</th><th>${t.thRate}</th><th>${t.thYearly}</th></tr></thead><tbody>${retailRows}</tbody></table>`;

  // Same yearly-kWh formula the appliance pages use (appliance-energy.mjs), so
  // the figures here and there cannot disagree. One money basis only — the
  // country's own all-taxes-included average.
  const billRows = f.showcase.map(({ a, kwh }) => {
    const href = `${rel(depth)}${pfx}appliances/${a.slug}/`;
    return `<tr><td><a class="ul-link" href="${href}">${esc(isEs ? a.name_es : a.name)}</a></td>` +
      `<td class="tnum">${nf(kwh, lang)}</td>` +
      `<td class="tnum">${esc(moneyLabel(c, kwh * c.price, lang))}</td>` +
      `<td class="tnum">${esc(priceLabel(c, kwh * c.price / 12, lang))}</td></tr>`;
  }).join('');
  const billCaption = isEs
    ? `Lo que cuestan aparatos habituales en ${theName(c, lang)}, al precio local del kWh`
    : `What common appliances cost to run in ${theName(c, lang)}, at the local price per kWh`;
  const billTable = `<table><caption>${esc(billCaption)}</caption><thead><tr><th>${t.thAppliance}</th><th>kWh/${isEs ? 'año' : 'yr'}</th><th>${t.thPerYear}</th><th>${t.thPerMonth}</th></tr></thead><tbody>${billRows}</tbody></table>`;

  // Four bars, not 23: this page is about one country, and the full ranking is
  // one click away on the parent page.
  const peers = [dearest, median, c, cheapest].filter((x, i, arr) => arr.findIndex((y) => y.code === x.code) === i);
  const maxUsd = Math.max(...peers.map((x) => x.usd));
  /* The three neighbours are the nearest thing this page has to a next click,
     and they were inert divs — the same gap the hub had until its own bars were
     linked. A sibling country page sits beside this one, so the href is just
     the slug. The current country stays a div: a link to the page you are
     already on is noise, and .is-now already says which row it is. */
  let barsLinked = 0;
  const bars = [...peers].sort((a, b) => b.usd - a.usd).map((x) => {
    const label = isEs ? x.name_es : x.name;
    const isNow = x.code === c.code;
    const inner = `<div class="cbar-label"><span>${esc(label)}</span><b>${esc(usdLabel(x.usd, lang))}</b></div>` +
      `<div class="cbar-track"><div class="cbar-fill" style="--w:${Math.round(x.usd / maxUsd * 100)}%"></div></div>`;
    if (!isNow && COUNTRY_PAGES.includes(x.code)) {
      barsLinked++;
      return `<a class="cbar-row is-link" href="../${countrySlug(x.name)}/">${inner}</a>`;
    }
    return `<div class="cbar-row${isNow ? ' is-now' : ''}">${inner}</div>`;
  }).join('\n');

  // No fallback: an unrecognised key used to quietly credit WattFigures itself
  // as the creator of somebody else's dataset, which is the one error on this
  // page that a reader cannot possibly catch.
  const src = SOURCE_META[c.source];
  if (!src) throw new Error(`${c.code}: source "${c.source}" is not in SOURCE_META — add it, or the page will credit the wrong body`);
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
      ? `precio luz ${t.countryName.toLowerCase()}, precio kwh ${t.countryName.toLowerCase()}, tarifa electrica ${t.countryName.toLowerCase()}`
      : `electricity price ${t.countryName.toLowerCase()}, ${t.countryName.toLowerCase()} electricity price per kwh, residential electricity price ${t.countryName.toLowerCase()}, cost of electricity in ${t.countryName.toLowerCase()}`,
    PARENT_LABEL: t.parent, COUNTRY_NAME: esc(t.countryName),
    DATASET_NAME: t.datasetName, DATASET_DESC: t.datasetDesc, DATASET_PERIOD: data.meta.period,
    DATASET_PLACE: c.name, DATASET_UNIT: `${c.currency} per kilowatt-hour`,
    DATASET_CREATOR_TYPE: src.type, DATASET_CREATOR_NAME: src.name, DATASET_CREATOR_URL: src.url,
    CO2_VALUE: String(c.co2),
    // dateModified used to read the dataset-wide meta.updated, so all 23
    // country pages shared one date even though c.verified already tracks
    // each country's own last-checked date (GB/CA/AU were reverified a day
    // later than the rest on 27-07-2026, and it showed nowhere — audit 30-07).
    SECTION_SLUG: '', DATE_PUBLISHED: c.verified, DATE_MODIFIED: c.verified,
    TILES_HTML: tiles, INTRO_HTML: t.intro,
    T_RETAIL: t.retail, RETAIL_NOTE: t.retailNote, RETAIL_HTML: retailTable, RETAIL_CAVEAT: t.retailCaveat,
    T_GAS: t.gas, GAS_HTML: t.gasHtml, T_GAS_CTA: t.gasCta, T_GAS_GUIDE: t.gasGuide,
    T_BILL: t.bill, BILL_NOTE: t.billNote, BILL_HTML: billTable, BILL_TOTAL: t.billTotal,
    // Say the bars are clickable, but only when some of them are: on a page
    // whose neighbours all lack a page of their own the sentence would be a lie.
    T_COMPARE: t.compare,
    COMPARE_NOTE: t.compareNote + (barsLinked
      ? (isEs ? ' Pincha en un país para abrir su página.' : ' Click a country to open its page.')
      : ''),
    BARS_HTML: bars,
    T_CARBON: t.carbon, CARBON_HTML: t.carbonHtml,
    // The attribution is a visible paragraph, not a code comment, so it has to
    // be in the reader's language. It shipped English on all 15 Spanish price
    // pages until 2026-07-28. Kept in the data file next to `sources` rather
    // than in the string table above so that changing a source forces you to
    // look at both — they cannot drift apart without being seen.
    UPDATED: c.verified, SOURCES: esc(isEs ? data.meta.sources_es : data.meta.sources),
    DISCLAIMER_NOTE: t.disclaimer,
    TRADEMARK: isEs
      ? 'Los nombres de comercializadoras y compañías eléctricas mencionados en esta página son marcas registradas de sus respectivos propietarios, usados aquí solo para identificación y comparación de precios. WattFigures no está afiliado, patrocinado ni respaldado por ninguna de ellas.'
      : 'Retailer and utility names on this page are trademarks of their respective owners, used here for identification and price comparison only. WattFigures is not affiliated with, sponsored by or endorsed by any of them.',
    T_UPDATED: t.updated, T_CALC_CTA: t.calcCta, T_ALL_CTA: t.allCta, T_STATES_CTA: t.statesCta,
    PAGE_SCRIPTS: '',
    SHARE_URL: encodeURIComponent(canonical), SHARE_TITLE: encodeURIComponent(t.title),
    SHARE_MEDIA: encodeURIComponent(`https://${cfg.domain}/assets/img/og-default.png`),
  });

  const html = renderFile('country-page.html', ctx, {
    templatesDir,
    flags: Object.assign({}, flags, {
      pageEn: !isEs, pageEs: isEs,
      hasRetail: hasRetail(c), hasGas: hasGas(c), isUs: c.code === 'US',
    }),
    sections: localizeSections(cfg.sections, lang),
  });
  const dest = path.join(ROOT, pfx, SLUG, 'index.html');
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, html, 'utf-8');
  return dest;
}

// Refuse loudly rather than publish a page with holes in it.
for (const code of COUNTRY_PAGES) {
  const why = ineligible(all.find((x) => x.code === code));
  if (why) throw new Error(`${code} cannot have a country page: ${why}`);
}

let n = 0;
for (const code of COUNTRY_PAGES) {
  const c = all.find((x) => x.code === code);
  for (const lang of langs) { console.log('  + ' + path.relative(ROOT, build(c, lang))); n++; }
}
console.log(`✓ country pages generated (${COUNTRY_PAGES.length} countries × ${langs.length} languages = ${n} pages, ${data.meta.period}).`);
