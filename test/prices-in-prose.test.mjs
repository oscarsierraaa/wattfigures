/*
  A price per kWh typed into a sentence must agree with data/energy-prices.json.

  Why this exists: the site has one source for the price of electricity, and
  everything generated from it followed when the figures were corrected on
  2026-07-26 — the 30 appliance pages, the country tables, the chart captions.
  What did not follow was every figure a human had typed into prose, because
  nothing was watching:

    · 22 FAQ answers said $0.17/kWh, and their arithmetic with it
    · 16 calculator worked examples said $0.17 or 0,19 € — each of them
      fifteen lines above a generated caption on the same page that said the
      new figure, so the page contradicted itself
    · both methodology pages, which is where we explain the arithmetic
    · one calculator still said $0.25, a figure no country has had here

  This checks the price, not the arithmetic that follows from it — no test can
  re-derive "roughly $117 over a 90-day season" from a sentence. It is a
  tripwire: a stale price is proof the paragraph was never revisited, and a
  correct one means somebody stood in front of the numbers.

  Two standards, because two kinds of page quote a price for different reasons:

    calculators, appliances, legal   the price is *our default assumption* for
                                     that reader, so it must be that reader's
                                     country — the US in English, Spain in
                                     Spanish. Nothing else is defensible.
    guides, country tables, home     the page compares countries on purpose, so
                                     any price the data file actually holds is
                                     fine — but it must be one of them.

  Prices that are not electricity — gas, a solar export tariff — are listed per
  page with a reason. That list is the whole reason this can be a test instead
  of the warning it replaced: a rule that cannot tell gas from electricity does
  have to cry wolf, and one that can, does not.

  Run: node --test
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '_pagefind', 'graphify-out', '_originals', '.git', 'docs', 'n8n', 'supabase', 'templates', 'test']);

const prices = JSON.parse(readFileSync(path.join(root, 'data', 'energy-prices.json'), 'utf-8'));

/* Gas used to live here as a per-page exemption, because it was a price per kWh
   that no data file held — so the only thing this test could do was agree not
   to look at it. That is exactly where the error hid: the guide said "$0.12 per
   therm" while its own table implied $0.97 and the real US average was $1.44,
   and the calculator beside it said $0.09/kWh, which is $2.64 a therm. Four
   figures, three of them wrong, none checkable.

   Since 2026-07-27 gas is in energy-prices.json with its own source, so it is
   validated like any other price and the exemption list is gone. Export
   tariffs never needed one: they are not written with /kWh, so nothing here
   ever matched them. */

// The reader's own country: the default the page assumes before they pick one.
const OWN = { en: 'US', es: 'ES' };
const country = (code) => {
  const c = prices.countries.find((x) => x.code === code);
  if (!c) throw new Error(`energy-prices.json has no country ${code}`);
  return c;
};

/* The symbols the data file actually uses, longest first so "C$0.11" is read
   as Canadian dollars rather than as "$0.11" with a stray C. */
const SYMBOLS = [...new Set(prices.countries.map((c) => c.symbol))].sort((a, b) => b.length - a.length);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SYM = SYMBOLS.map(esc).join('|');

/* Every price the data file publishes in its own currency: what a country
   costs, and what its retailers charge. */
const known = new Map();
const add = (symbol, value) => {
  if (!known.has(symbol)) known.set(symbol, new Set());
  known.get(symbol).add(Number(value));
};
for (const c of prices.countries) {
  add(c.symbol, c.price);
  if (typeof c.gas === 'number') add(c.symbol, c.gas);
  for (const p of c.providers || []) add(c.symbol, p.price);
}

/* Compared as numbers, not as strings rounded to two places. Gas lands near
   0.05, where two decimals would wave through anything from 0.045 to 0.054 —
   a 20% band on the very figure this file exists to pin down. */
const EPS = 0.0005;
const holds = (set, v) => !!set && [...set].some((k) => Math.abs(k - v) < EPS);

/* The USD column is every country converted to dollars, and it is deliberately
   kept out of `known`: it would accept almost any dollar figure and wave the
   real mistakes through. A guide once said "$0.15 per kWh" and that passes as
   Brazil. So it is accepted only on the page that prints the column. */
const usdColumn = new Set(prices.countries.map((c) => Number(c.usd)));
const COUNTRY_TABLE = /(^|\/)electricity-prices\//;

function htmlFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) htmlFiles(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&[a-z]+;/g, ' ');

/* A price per kWh reads one of two ways — "$0.18/kWh" or "0,27 €/kWh" — and a
   table heading states the same assumption without repeating the unit
   ("Cost/year at $0.18"), so headings are read whole. */
const PER_KWH = new RegExp(`(?:(${SYM})\\s?(\\d+[.,]\\d+)|(\\d+[.,]\\d+)\\s?(${SYM}))\\s*(?:/|per\\s)\\s*kWh`, 'gi');
const IN_HEADING = new RegExp(`(?:(${SYM})\\s?(\\d+[.,]\\d+)|(\\d+[.,]\\d+)\\s?(${SYM}))`, 'g');

const quotes = [];
for (const file of htmlFiles(root)) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const html = readFileSync(file, 'utf-8');
  const lang = rel.startsWith('es/') ? 'es' : 'en';
  // A calculator, an appliance page or the methodology speaks to one reader
  // with one default; everything else is allowed to compare countries.
  const isDefault = /(^|\/)(calculators|appliances|legal)\//.test(rel);

  const seen = [];
  for (const m of strip(html).matchAll(PER_KWH)) {
    seen.push({ symbol: m[1] || m[4], value: m[2] || m[3], where: 'prose' });
  }
  for (const th of html.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)) {
    for (const m of strip(th[1]).matchAll(IN_HEADING)) {
      seen.push({ symbol: m[1] || m[4], value: m[2] || m[3], where: 'a table heading' });
    }
  }
  for (const s of seen) {
    quotes.push({ ...s, rel, lang, isDefault, num: Number(s.value.replace(',', '.')) });
  }
}

const show = (q) => `${q.rel} — ${q.symbol}${q.value} in ${q.where}`;

test('the pages quote prices we can check', () => {
  assert.ok(quotes.length > 40, `only ${quotes.length} per-kWh prices found — the walk is looking in the wrong place`);
});

// The failure of 2026-07-26, in one assertion.
test('a calculator, appliance or legal page quotes its own reader\'s price', () => {
  const wrong = [];
  for (const q of quotes) {
    if (!q.isDefault) continue;
    const c = country(OWN[q.lang]);
    // Either of the reader's own two fuels. Gas is as much "their" default as
    // electricity on a page that compares a boiler with a heat pump.
    const own = [c.price, ...(typeof c.gas === 'number' ? [c.gas] : [])];
    if (q.symbol !== c.symbol || !own.some((v) => Math.abs(v - q.num) < EPS)) {
      wrong.push(`${show(q)} — ${c.name} is ${c.symbol}${c.price} (gas ${c.gas ?? '—'})`);
    }
  }
  assert.deepEqual(wrong.slice(0, 8), [],
    'a price typed into prose has drifted from data/energy-prices.json — recompute the figures around it too');
});

// Elsewhere the page may compare countries, but not invent one.
test('every other quoted price is a figure the data file holds', () => {
  const wrong = [];
  for (const q of quotes) {
    if (q.isDefault) continue;
    if (holds(known.get(q.symbol), q.num)) continue;
    if (q.symbol === '$' && COUNTRY_TABLE.test(q.rel) && holds(usdColumn, q.num)) continue;
    wrong.push(show(q));
  }
  assert.deepEqual(wrong.slice(0, 8), [],
    'no country or retailer in data/energy-prices.json has this price');
});

/* The other price a reader sees before they touch anything: the number already
   in the box. tools/stamp-price-defaults.mjs writes it from the data file, and
   without this nothing would notice if that step were dropped from the build —
   the figure is an attribute, not prose, so the checks above walk past it. */
test('every calculator opens at its reader\'s price', () => {
  const wrong = [];
  for (const file of htmlFiles(root)) {
    const rel = path.relative(root, file).replace(/\\/g, '/');
    const c = country(OWN[rel.startsWith('es/') ? 'es' : 'en']);
    for (const tag of readFileSync(file, 'utf-8').matchAll(/<input\b[^>]*\bdata-country-price\b[^>]*>/g)) {
      const v = (tag[0].match(/\bvalue="([^"]*)"/) || [])[1];
      if (Number(v).toFixed(2) !== c.price.toFixed(2)) {
        wrong.push(`${rel} opens at ${v}, ${c.name} is ${c.price}`);
      }
    }
  }
  assert.deepEqual(wrong.slice(0, 8), [], 'run `npm run build:defaults`');
});

/* Gas gets its own assertion rather than riding on the electricity one. It is
   the figure that was wrong by a factor of twelve, it comes from a different
   dataset on a different basis (heating-season for the US, semester band D2 for
   Europe), and a calculator whose gas box is empty or stale is wrong in a way
   no reader can see. */
test('every gas box opens at its reader\'s gas price', () => {
  const wrong = [];
  let boxes = 0;
  for (const file of htmlFiles(root)) {
    const rel = path.relative(root, file).replace(/\\/g, '/');
    const c = country(OWN[rel.startsWith('es/') ? 'es' : 'en']);
    for (const tag of readFileSync(file, 'utf-8').matchAll(/<input\b[^>]*\bdata-country-gas\b[^>]*>/g)) {
      boxes++;
      const v = Number((tag[0].match(/\bvalue="([^"]*)"/) || [])[1]);
      if (typeof c.gas !== 'number') { wrong.push(`${rel}: ${c.name} has no gas price in the data file`); continue; }
      if (Math.abs(v - c.gas) >= EPS) wrong.push(`${rel} opens at ${v}, ${c.name} gas is ${c.gas}`);
    }
  }
  assert.ok(boxes >= 2, `only ${boxes} gas input(s) found — the heat-pump calculators should have one each`);
  assert.deepEqual(wrong.slice(0, 8), [], 'run `npm run build:defaults`');
});
