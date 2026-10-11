#!/usr/bin/env node
/*
  fetch-prices.mjs — refresh data/energy-prices.json from official sources.

    npm run data:prices           show what would change, write nothing
    npm run data:prices -- --write  apply it

  Why this exists: the table was compiled by hand from mixed sources, and on
  2026-07-26 an audit against Eurostat found six countries off by 15% or more —
  Spain by 29%, Sweden and Norway by 47%. The cause was not carelessness but
  the lack of a single definition: Spain carried the price *excluding* taxes
  and Germany the price *including* them. So this tool does two jobs at once —
  it refreshes the figures, and it pins them all to one definition.

  The definition, which meta.definition also states on the site:
    average residential price per kWh, ALL TAXES INCLUDED,
    consumption band 2500-4999 kWh/year (the standard medium household).
  That is what lands on a bill, which is the only number this site promises.

  Coverage — 13 of 23 countries refresh themselves here:
    · Eurostat nrg_pc_204  → 12 countries (11 EU + Norway), no API key
    · EIA table 5.6.A      → United States, no API key
    · ECB reference rates  → the usd column for every country, daily
  The other ten are read by hand from a named body — Ofgem, ElCom, MBIE,
  GlobalPetrolPrices — and this tool only recomputes their usd column. Since
  2026-07-28 none of them says source:"manual" any more: "manual" recorded that
  a human typed it, which is not the same as saying where it came from, and the
  US price sat at a stale 0.17 for months behind exactly that word.

  There is no open API for retail tariffs, so the 42 provider prices are also
  read by hand. They are not automated; they are made to expire loudly instead —
  see the staleness test in test/energy-prices.test.mjs and retailVerified.

  NOT part of `npm run build`, deliberately: prices must not move inside CI
  with nobody reading them. That is how the stale US figure survived.
*/
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchSheet } from './xlsx-read.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'data', 'energy-prices.json');
const WRITE = process.argv.includes('--write');
const TODAY = new Date().toISOString().slice(0, 10);

const EUROSTAT = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/nrg_pc_204'
  + '?format=JSON&lang=EN&nrg_cons=KWH2500-4999&currency=NAC&tax=I_TAX&unit=KWH&lastTimePeriod=1';
// Household gas, band D2 (20-199 GJ/year — a house that actually heats with it),
// all taxes included, per kWh. Same shape and same semester as the electricity
// query above, so the two can sit side by side on a page without a caveat.
const EUROSTAT_GAS = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/nrg_pc_202'
  + '?format=JSON&lang=EN&nrg_cons=GJ20-199&currency=NAC&tax=I_TAX&unit=KWH&lastTimePeriod=1';
const ECB = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
const EIA_XLSX = 'https://www.eia.gov/electricity/monthly/xls/table_5_06_a.xlsx';
// Monthly Energy Review table 9.10, column D: natural gas delivered to
// residential consumers, dollars per thousand cubic feet.
const EIA_GAS_XLSX = 'https://www.eia.gov/totalenergy/data/browser/xls.php?tbl=T09.10&freq=M';

// EIA's own conversion: 1 Mcf = 1.037 MMBtu, and 1 kWh = 3,412 Btu.
const MCF_KWH = 1.037e6 / 3412;

const round2 = (v) => Math.round(v * 100) / 100;
// Gas lands near 0.05/kWh, where two decimals is a 2% quantisation — the same
// order as the error this whole file exists to remove. Three, then.
const round3 = (v) => Math.round(v * 1000) / 1000;

// ── sources ─────────────────────────────────────────────────────────────────
async function eurostatPrices() {
  const res = await fetch(EUROSTAT);
  if (!res.ok) throw new Error(`Eurostat returned ${res.status}`);
  const d = await res.json();
  const idx = d.dimension.geo.category.index;
  const period = Object.keys(d.dimension.time.category.index)[0];
  const out = {};
  for (const [code, i] of Object.entries(idx)) {
    if (d.value[i] !== undefined) out[code] = d.value[i];
  }
  return { prices: out, period, updated: (d.updated || '').slice(0, 10) };
}

async function eurostatGas() {
  const res = await fetch(EUROSTAT_GAS);
  if (!res.ok) throw new Error(`Eurostat gas returned ${res.status}`);
  const d = await res.json();
  const idx = d.dimension.geo.category.index;
  const period = Object.keys(d.dimension.time.category.index)[0];
  const out = {};
  for (const [code, i] of Object.entries(idx)) {
    if (d.value[i] !== undefined) out[code] = d.value[i];
  }
  return { prices: out, period };
}

/*
  US residential gas, averaged over the last complete heating season.

  Not the annual mean, and emphatically not the latest month. A residential
  per-unit gas price is mostly standing charge divided by volume, so it more
  than doubles in summer when nobody is heating: $0.041/kWh in January 2025,
  $0.086 in August. The pages that use this number compare heating systems, so
  the heating season is the honest window — and saying which window it is beats
  any single figure without one.
*/
async function eiaGasHeatingSeason() {
  const rows = await fetchSheet(EIA_GAS_XLSX);
  const months = rows
    .filter((r) => /^[0-9.]+$/.test(r.A || '') && r.D && r.D !== 'Not Available')
    .map((r) => {
      const d = new Date(Date.UTC(1899, 11, 30) + Number(r.A) * 86400000);
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, usdMcf: Number(r.D) };
    })
    .filter((x) => Number.isFinite(x.usdMcf));
  if (!months.length) throw new Error('EIA table 9.10 carried no residential gas prices');

  // Nov and Dec belong to the season that starts that year; Jan-Mar to the one
  // that started the year before.
  const seasons = new Map();
  for (const x of months) {
    if (![11, 12, 1, 2, 3].includes(x.m)) continue;
    const start = x.m >= 11 ? x.y : x.y - 1;
    if (!seasons.has(start)) seasons.set(start, []);
    seasons.get(start).push(x.usdMcf);
  }
  const complete = [...seasons.entries()].filter(([, v]) => v.length === 5).sort((a, b) => b[0] - a[0]);
  if (!complete.length) throw new Error('EIA table 9.10 has no complete Nov-Mar heating season yet');
  const [start, vals] = complete[0];
  const usdMcf = vals.reduce((s, v) => s + v, 0) / vals.length;
  return { dollars: usdMcf / MCF_KWH, usdMcf, season: `Nov ${start} – Mar ${start + 1}` };
}

async function ecbRates() {
  const res = await fetch(ECB);
  if (!res.ok) throw new Error(`ECB returned ${res.status}`);
  const xml = await res.text();
  const date = (xml.match(/time=['"]([0-9-]+)['"]/) || [])[1];
  const rates = { EUR: 1 };
  for (const m of xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9.]+)['"]/g)) rates[m[1]] = +m[2];
  if (!rates.USD) throw new Error('ECB feed carried no USD rate');
  return { rates, date };
}

async function eiaUsAverage() {
  const rows = await fetchSheet(EIA_XLSX);
  const total = rows.find((r) => r.A.trim() === 'U.S. Total');
  if (!total) throw new Error('EIA table has no "U.S. Total" row');
  const heading = (rows[1] && rows[1].A) || '';
  const m = heading.match(/([A-Z][a-z]+)\s+(\d{4})/);
  // Table 5.6.A is in cents; the site stores dollars.
  return { dollars: parseFloat(total.B) / 100, period: m ? `${m[1]} ${m[2]}` : 'unknown' };
}

// ── serialiser ──────────────────────────────────────────────────────────────
// JSON.stringify would turn this hand-kept file into 400 lines of one key per
// row. Three lines per country — identity, figures, retailers — keeps it
// scannable and keeps diffs readable, which is the point of committing data.
//
// The key lists below are a whitelist, so anything not named here would be
// dropped the next time somebody ran this with --write — silently, and only
// visible as a field that stopped existing weeks later. Hence KNOWN and the
// throw: adding a field to the data file now fails loudly here until it is
// taught to write it.
const KNOWN = new Set(['code', 'name', 'name_es', 'symbol', 'pos', 'currency',
  'price', 'usd', 'co2', 'source', 'verified', 'gas', 'gas_source',
  'market', 'retailBasis', 'retailVerified', 'providers']);

function serialise(data) {
  const s = (v) => JSON.stringify(v);
  const country = (c) => {
    const unknown = Object.keys(c).filter((k) => !KNOWN.has(k));
    if (unknown.length) {
      throw new Error(`${c.code}: serialise() does not know how to write ${unknown.join(', ')} — `
        + 'add it to KNOWN and to the layout below, or writing this file would drop it');
    }
    const id = ['code', 'name', 'name_es', 'symbol', 'pos', 'currency'].map((k) => `${s(k)}: ${s(c[k])}`).join(', ');
    const fig = ['price', 'usd', 'co2', 'source', 'verified'].map((k) => `${s(k)}: ${s(c[k])}`).join(', ');
    const gas = c.gas === undefined ? ''
      : `,\n      ${s('gas')}: ${s(c.gas)}, ${s('gas_source')}: ${s(c.gas_source)}`;
    const head = `    { ${id},\n      ${fig}${gas}`;
    if (!c.providers || !c.providers.length) return `${head} }`;
    // These three describe the retailer block, so they ride with it: a country
    // without tariffs has nothing for them to qualify. retailVerified is
    // deliberately separate from verified — see the report below.
    const retail = ['market', 'retailBasis', 'retailVerified'].map((k) => `${s(k)}: ${s(c[k])}`).join(', ');
    const prov = c.providers.map((p) => `{ "name": ${s(p.name)}, "price": ${s(p.price)} }`).join(', ');
    return `${head},\n      ${retail},\n      "providers": [ ${prov} ] }`;
  };
  const meta = Object.entries(data.meta).map(([k, v]) => `    ${s(k)}: ${s(v)}`).join(',\n');
  return `{\n  "meta": {\n${meta}\n  },\n  "countries": [\n${data.countries.map(country).join(',\n')}\n  ]\n}\n`;
}

// ── run ─────────────────────────────────────────────────────────────────────
const data = JSON.parse(readFileSync(FILE, 'utf-8'));
const [eu, euGas, fx, eia, eiaGas] = await Promise.all([
  eurostatPrices(), eurostatGas(), ecbRates(), eiaUsAverage(), eiaGasHeatingSeason(),
]);

console.log(`Eurostat  ${eu.period} (publicado ${eu.updated})`);
console.log(`Eurostat gas  ${euGas.period}`);
console.log(`BCE       tipos del ${fx.date}`);
console.log(`EIA       ${eia.period}`);
console.log(`EIA gas   ${eiaGas.season} — ${eiaGas.usdMcf.toFixed(2)} $/Mcf\n`);

const changes = [];
const manual = [];

for (const c of data.countries) {
  if (!c.currency) throw new Error(`${c.code} has no currency field — add it before running this`);
  const rate = fx.rates[c.currency];
  if (!rate) throw new Error(`ECB has no rate for ${c.currency} (${c.code})`);

  const before = { price: c.price, usd: c.usd, gas: c.gas };
  let fresh = null;
  if (c.source === 'eurostat') fresh = eu.prices[c.code];
  else if (c.source === 'eia') fresh = eia.dollars;
  else manual.push(c);

  if (fresh !== undefined && fresh !== null) {
    c.price = round2(fresh);
    c.verified = TODAY;
  }
  // The usd column is derived, so it is recomputed for everyone — including
  // the manual countries, whose local price may be right while the conversion
  // has drifted with the exchange rate.
  c.usd = round2(c.price / rate * fx.rates.USD);

  // Gas, where a source covers it. A country with no gas source keeps no gas
  // field at all rather than a null: the pages check for its presence, and an
  // absent number is easier to reason about than a placeholder one.
  const gas = euGas.prices[c.code] !== undefined ? { v: euGas.prices[c.code], src: 'eurostat' }
    : c.code === 'US' ? { v: eiaGas.dollars, src: 'eia' }
      : null;
  if (gas) { c.gas = round3(gas.v); c.gas_source = gas.src; }

  // Gas counts as a change too, or the dry run reports "sin cambios" while
  // being about to write a new figure — which is the one thing a dry run is for.
  if (c.price !== before.price || c.usd !== before.usd || c.gas !== before.gas) {
    changes.push({ c, before, pct: before.price ? (c.price - before.price) / before.price * 100 : 0 });
  }
}

data.meta.updated = TODAY;
data.meta.period = eu.period;
data.meta.fxDate = fx.date;

// ── report ──────────────────────────────────────────────────────────────────
if (!changes.length) {
  console.log('Sin cambios.');
} else {
  console.log(`CAMBIOS (${changes.length}):\n`);
  console.log('  país  fuente     precio antes → después        usd            gas');
  for (const { c, before, pct } of changes.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))) {
    const arrow = c.price === before.price ? '=' : `${before.price} → ${c.price}`;
    const p = c.price === before.price ? '' : `  (${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%)`;
    const gas = c.gas === before.gas ? ''
      : `  ${before.gas === undefined ? '—' : before.gas} → ${c.gas} (${c.gas_source})`;
    console.log(`  ${c.code.padEnd(5)} ${String(c.source).padEnd(9)} ${arrow.padEnd(22)} ${`${before.usd} → ${c.usd}`.padEnd(14)}${gas}${p}`);
  }
}

if (manual.length) {
  console.log(`\nSIN FUENTE ABIERTA (${manual.length}) — hay que comprobarlos a mano:\n`);
  for (const c of manual.sort((a, b) => String(a.verified).localeCompare(String(b.verified)))) {
    const age = c.verified
      ? Math.round((Date.now() - Date.parse(c.verified)) / 86400000)
      : null;
    const warn = age === null ? '  ← sin fecha' : (age > 365 ? '  ← CADUCADO' : '');
    console.log(`  ${c.code.padEnd(5)} ${c.price} ${c.symbol.padEnd(4)} verificado ${c.verified || '?'}${age !== null ? ` (${age} d)` : ''}${warn}`);
  }
}

/*
  Las tarifas de compañía se listan aparte y por su propia fecha.

  Hasta 2026-07-28 colgaban de `verified`, que esta misma función le pone a hoy
  a todo país de Eurostat cada vez que corre. O sea que las 42 se re-fechaban
  solas sin que nadie las mirara y no podían caducar nunca: por eso las
  holandesas seguían con precios de la crisis de 2023, un 25% por encima de lo
  que se anuncia hoy. `retailVerified` solo lo sube quien las comprueba.

  `retailBasis: "unknown"` no es un hueco que rellenar cuando haya tiempo: es lo
  que impide que el test del ratio dé por buena una base que nadie ha mirado.
*/
const withRetail = data.countries.filter((c) => c.providers && c.providers.length);
if (withRetail.length) {
  console.log(`\nTARIFAS DE COMPAÑÍAS (${withRetail.reduce((n, c) => n + c.providers.length, 0)} en ${withRetail.length} países):\n`);
  for (const c of withRetail.sort((a, b) => String(a.retailVerified).localeCompare(String(b.retailVerified)))) {
    const age = c.retailVerified
      ? Math.round((Date.now() - Date.parse(c.retailVerified)) / 86400000)
      : null;
    const warn = age === null ? '  ← sin fecha' : (age > 365 ? '  ← CADUCADAS' : '');
    const basis = c.retailBasis === 'unknown' ? '  ← base sin comprobar' : '';
    console.log(`  ${c.code.padEnd(5)} ${String(c.providers.length).padEnd(2)} tarifas  ${String(c.market).padEnd(11)} ${String(c.retailBasis).padEnd(9)} ${c.retailVerified || '?'}${age !== null ? ` (${age} d)` : ''}${warn}${basis}`);
  }
}

/* Pages generated from the JSON pick new prices up on the next build. Prose
   does not: a figure typed into a sentence stays wrong until somebody edits it,
   and so does every figure calculated from it — "roughly $110 over a 90-day
   season" is as stale as the price above it.

   This used to look only in guides/, which is why on 2026-07-26 it missed 44
   FAQ answers, 16 worked examples and both methodology pages. It now walks
   every place prose quotes a price, and reports the ones still quoting the
   figure that just moved — which is the list of paragraphs to go and rewrite.

   test/prices-in-prose.test.mjs is the gate that will not let those paragraphs
   ship. This is the to-do list, printed while someone is already looking. */
const PROSE = ['data/appliances.json', 'calculators', 'guides', 'legal',
  'es/calculators', 'es/guides', 'es/legal'];

function proseFiles(rel, out = []) {
  const p = path.join(ROOT, rel);
  if (!existsSync(p)) return out;
  if (!statSync(p).isDirectory()) { out.push(rel); return out; }
  for (const name of readdirSync(p)) proseFiles(path.posix.join(rel, name), out);
  return out;
}

const moved = changes.filter((x) => x.c.price !== x.before.price);
if (moved.length) {
  const files = PROSE.flatMap((rel) => proseFiles(rel))
    .filter((f) => f.endsWith('.html') || f.endsWith('.json'));
  const hits = new Map();
  for (const rel of files) {
    // Entities count as whitespace here: the methodology page writes the price
    // as "0,27&nbsp;€/kWh" to keep the symbol on the same line, and a matcher
    // that only knew about tags walked straight past it.
    const text = readFileSync(path.join(ROOT, rel), 'utf-8')
      .replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ');
    for (const { c, before } of moved) {
      // The old figure as the page would have written it, either way round.
      const n = before.price.toFixed(2);
      const sym = c.symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const old = new RegExp(`(?:${sym}\\s?${n.replace('.', '[.,]')}|${n.replace('.', '[.,]')}\\s?${sym})\\s*(?:/|per\\s)?\\s*kWh`, 'i');
      if (old.test(text)) {
        if (!hits.has(rel)) hits.set(rel, []);
        hits.get(rel).push(`${c.code} ${before.price} → ${c.price}`);
      }
    }
  }
  if (hits.size) {
    console.log('\nPRECIOS ESCRITOS A MANO QUE SE QUEDAN VIEJOS — no se regeneran solos:\n');
    for (const [rel, why] of hits) console.log(`  ${rel}  →  ${[...new Set(why)].join(', ')}`);
    console.log('\n  Rehaz también las cifras que salen de ese precio, no solo el precio.');
    console.log('  `npm test` no te dejará publicarlas mal (test/prices-in-prose.test.mjs).');
  }
}

if (WRITE) {
  writeFileSync(FILE, serialise(data), 'utf-8');
  console.log('\n✓ data/energy-prices.json actualizado.');
  console.log('  ejecuta `npm test` y luego `npm run build`.');
} else {
  console.log('\n(simulación — nada escrito. Añade `-- --write` para aplicarlo.)');
}
