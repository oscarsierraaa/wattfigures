/*
  Dataset invariants for data/energy-prices.json — since a941c44 this is the
  only source of a kWh price on the site. The calculators, the two home price
  boards, the appliance pages and the generators all read it, and the
  generators throw rather than fall back when a country or price is missing,
  so a malformed entry here fails the build instead of silently shipping a
  wrong number. Run: node --test
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(path.join(root, '..', 'data', 'energy-prices.json'), 'utf-8'));
const countries = data.countries;

test('every country carries the fields the renderers read', () => {
  for (const c of countries) {
    for (const k of ['code', 'name', 'name_es', 'symbol', 'pos', 'price', 'usd', 'currency', 'source', 'verified']) {
      assert.ok(k in c, `${c.code || '?'} missing ${k}`);
    }
    assert.match(c.code, /^[A-Z]{2}$/, `${c.code}: code is not an ISO-2 pair`);
    assert.ok(['pre', 'suf'].includes(c.pos), `${c.code}: pos must be pre or suf`);
    // symbol is ambiguous — "$" is both US and Mexico, "kr" both Sweden and
    // Norway — so the exchange-rate lookup keys off currency, not symbol.
    assert.match(c.currency, /^[A-Z]{3}$/, `${c.code}: currency is not an ISO-4217 code`);
  }
});

// Provenance is what makes the difference between "this number is old" and
// "nobody noticed this number was old". The US price sat at a stale 0.17 for
// months because nothing recorded where it came from or when.
test('every country declares a known source and an ISO verified date', () => {
  for (const c of countries) {
    // Must match SOURCE_META in tools/generate-country-pages.mjs, which turns
    // the key into the Dataset creator the page publishes. That file throws on
    // a key it does not know rather than falling back, so the two cannot drift
    // silently — but only for the countries that have a page, which is why the
    // list is restated here for all of them.
    assert.ok(['eurostat', 'eia', 'ofgem', 'gpp', 'elcom', 'mbie', 'manual'].includes(c.source), `${c.code}: unknown source "${c.source}"`);
    assert.match(c.verified, /^\d{4}-\d{2}-\d{2}$/, `${c.code}: verified must be an ISO date`);
    assert.ok(!Number.isNaN(Date.parse(c.verified)), `${c.code}: verified is not a real date`);
    assert.ok(Date.parse(c.verified) <= Date.now(), `${c.code}: verified is in the future`);
  }
});

/*
  The countries with an open data source refresh via `npm run data:prices`. The
  other ten are read by hand, so the only thing standing between them and silent
  rot is this test. A year is generous; electricity prices move faster.

  This used to filter on `source === 'manual'`, which stopped meaning anything on
  2026-07-28 when the last hand-checked country got a named body (ElCom, MBIE,
  GlobalPetrolPrices) instead of the word "manual". The list that matters is the
  one tools/fetch-prices.mjs can actually refresh, so it is stated the same way
  here — anything not on it has to be looked at by a person.
*/
const AUTO = ['eurostat', 'eia'];
const YEAR = 365 * 86400000;

test('no hand-checked country has gone a year without verification', () => {
  const stale = countries
    .filter((c) => !AUTO.includes(c.source) && Date.now() - Date.parse(c.verified) > YEAR)
    .map((c) => `${c.code} (${c.source}, ${c.verified})`);
  assert.equal(stale.length, 0,
    `hand-checked prices over a year old: ${stale.join(', ')}. Verify them against the source named in "source" and bump "verified", or wire one up in tools/fetch-prices.mjs.`);
});

/*
  The retailers get their own date, and that is the whole point of the field.

  Until 2026-07-28 they inherited `verified` from their country — which
  fetch-prices.mjs sets to today for every Eurostat country every time it runs.
  So the 42 tariffs re-dated themselves without anyone looking at them and could
  never expire. The Dutch three were still carrying 2023 crisis prices, 25% above
  what those suppliers advertise now, and nothing anywhere said so.
*/
test('the retailer tariffs carry their own date and it has not expired', () => {
  const withProviders = countries.filter((c) => c.providers && c.providers.length);
  assert.ok(withProviders.length > 0, 'no country carries providers any more — is that intended?');
  for (const c of withProviders) {
    assert.match(String(c.retailVerified), /^\d{4}-\d{2}-\d{2}$/, `${c.code}: retailVerified must be an ISO date`);
    assert.ok(Date.parse(c.retailVerified) <= Date.now(), `${c.code}: retailVerified is in the future`);
  }
  const stale = withProviders
    .filter((c) => Date.now() - Date.parse(c.retailVerified) > YEAR)
    .map((c) => `${c.code} (${c.providers.length} retailers, ${c.retailVerified})`);
  assert.equal(stale.length, 0,
    `retailer tariffs over a year old: ${stale.join(', ')}. Check them against the suppliers and bump "retailVerified" — not "verified", which the refresh tool owns.`);
});

/*
  Whether the reader can act on the retailer table at all.

  `regional` exists because the United States and Canada do not have a retail
  market to switch in: Duke, FPL, Con Edison and PG&E are regulated monopolies in
  different states. The page used to tell American readers they could move $740 a
  year "without using a single kilowatt-hour less", which is not a stale figure —
  it is an offer that cannot be taken.
*/
test('every country with tariffs says whether its reader can switch supplier', () => {
  for (const c of countries) {
    if (!c.providers || !c.providers.length) continue;
    assert.ok(['competitive', 'regional'].includes(c.market),
      `${c.code}: market must be "competitive" or "regional", got ${JSON.stringify(c.market)}`);
    assert.ok(['energy', 'unit', 'inclusive', 'unknown'].includes(c.retailBasis),
      `${c.code}: retailBasis must be "energy", "unit", "inclusive" or "unknown", got ${JSON.stringify(c.retailBasis)}`);
  }
});

/*
  The tell that caught GB, CA and AU in e5f4849, finally as a test instead of a
  sentence in a commit message: the three were ~1.0x the mean of their own
  retailers when every country with a real source sits at 1.1-1.4x, because the
  standing charge was missing from the country figure.

  It needs the basis to mean anything, which is why it only runs where somebody
  has recorded one, and why there are three bases rather than two. What a
  supplier advertises is a national convention, and the gap between it and the
  all-in average is a different size in each:

    energy     only the commodity, and the regulator sets everything else, so
               the advertised figure is a third of the bill. Spain (término de
               energía, before the power term, network charges, the 5.11% duty
               and VAT) and Italy (materia prima, before trasporto and oneri di
               sistema) both land at 2.3-2.4x.
    unit       the per-kWh rate a bill is actually charged at, missing only the
               standing charge. 1.1-1.5x.
    inclusive  energy tax and VAT already inside, so it sits alongside the
               national average and can even exceed it where a fixed annual
               rebate pulls the average down, as the Dutch heffingskorting does.

  `regional` is skipped: in the United States the spread comes from Con Edison
  and PG&E being genuinely expensive states, not from a mismatched base, so
  forcing it into a band would be fitting the test to the wrong thing.

  If this ever fails and the only way to make it pass is to widen a band, the
  band is not the problem — and a test that accepts anything is worse than no
  test, because it certifies.
*/
const BAND = { energy: [1.8, 3.2], unit: [1.05, 1.6], inclusive: [0.85, 1.15] };

test('country prices and their retailers agree with the basis they declare', () => {
  const wrong = [];
  for (const c of countries) {
    if (!c.providers || !c.providers.length) continue;
    if (c.market === 'regional' || c.retailBasis === 'unknown') continue;
    const mean = c.providers.reduce((s, p) => s + p.price, 0) / c.providers.length;
    const ratio = c.price / mean;
    const [lo, hi] = BAND[c.retailBasis];
    if (ratio < lo || ratio > hi) {
      wrong.push(`${c.code}: ${c.price} is ${ratio.toFixed(2)}x its retailers' mean of ${mean.toFixed(3)}, outside ${lo}-${hi} for basis "${c.retailBasis}"`);
    }
  }
  assert.deepEqual(wrong, [],
    'a country price and its retailer tariffs are on different bases — check which one moved before touching the band');
});

// A retailer an order of magnitude away from its own country's average means a
// typo or a unit mix-up, not a competitive tariff.
test('retailer prices sit in a plausible range around their country', () => {
  for (const c of countries) {
    if (!c.providers) continue;
    for (const p of c.providers) {
      const ratio = p.price / c.price;
      assert.ok(ratio >= 0.3 && ratio <= 3,
        `${c.code}/${p.name}: ${p.price} is ${ratio.toFixed(1)}x the country price ${c.price} — check the units`);
    }
  }
});

// The definition is the whole fix: six countries were out by 15%+ because some
// carried tax-inclusive prices and others tax-exclusive. Losing this text
// loses the only record of which one this file means.
test('meta states the single definition and where the figures come from', () => {
  for (const k of ['updated', 'definition', 'sources', 'sources_es', 'period', 'fxDate']) {
    assert.ok(data.meta[k], `meta.${k} is missing`);
  }
  assert.match(data.meta.definition, /TAXES INCLUDED/, 'meta.definition must state the tax treatment');
  assert.match(data.meta.definition, /2500-4999/, 'meta.definition must state the consumption band');
});

/*
  meta.sources is not a comment: the generators print it as a visible paragraph
  under every price table, so it has one copy per language. It shipped English
  on all 15 Spanish pages until 2026-07-28 — the structure was right (79 pages
  mirrored, hreflang reciprocal, titles translated) and the leak was a single
  string read straight from the data file with no language branch.

  Both halves are checked. The data-level one catches a Spanish copy that is
  really the English text pasted twice; the page-level one catches a generator
  that stops branching. Neither alone would have caught the original bug.
*/
test('the attribution paragraph is translated, in the file and on the page', () => {
  assert.notEqual(data.meta.sources_es, data.meta.sources,
    'meta.sources_es is the English text — it has to be translated, not copied');
  assert.match(data.meta.sources_es, /^Fuentes:/,
    'meta.sources_es must open the way the page reads it: "Fuentes:"');

  // A fingerprint of the English string, short enough to survive an edit to the
  // rest of the sentence and specific enough that nothing else would match it.
  const english = 'for the EU and Norway';
  const pages = [];
  for (const c of data.countries) {
    const slug = c.name.toLowerCase().normalize('NFD')
      .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    pages.push(path.join(root, '..', 'es', 'electricity-prices', slug, 'index.html'));
  }
  pages.push(path.join(root, '..', 'es', 'electricity-prices', 'index.html'));

  for (const file of pages) {
    let html;
    try { html = readFileSync(file, 'utf-8'); } catch { continue; }  // country without a page
    assert.ok(!html.includes(english),
      `${path.relative(path.join(root, '..'), file)} prints the English attribution`);
  }
});

test('prices are positive numbers in both columns', () => {
  for (const c of countries) {
    assert.ok(typeof c.price === 'number' && c.price > 0, `${c.code}: price must be a positive number`);
    assert.ok(typeof c.usd === 'number' && c.usd > 0, `${c.code}: usd must be a positive number`);
  }
});

test('country codes are unique', () => {
  const seen = new Set();
  for (const c of countries) {
    assert.ok(!seen.has(c.code), `duplicate country code ${c.code}`);
    seen.add(c.code);
  }
});

// The generators pick these two as the per-language default, and throw when
// absent. Losing either one breaks the build rather than degrading quietly.
test('the two default countries are present', () => {
  for (const code of ['US', 'ES']) {
    assert.ok(countries.some(c => c.code === code), `default country ${code} missing`);
  }
});

test('provider prices, where given, are positive and named', () => {
  for (const c of countries) {
    if (!c.providers) continue;
    assert.ok(c.providers.length > 0, `${c.code}: providers present but empty`);
    for (const p of c.providers) {
      assert.ok(p.name, `${c.code}: a provider has no name`);
      assert.ok(typeof p.price === 'number' && p.price > 0, `${c.code}/${p.name}: price must be a positive number`);
    }
  }
});
