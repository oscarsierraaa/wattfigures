/*
  Invariants for the per-country price pages (electricity-prices/<country>/).

  These pages exist because Search Console shows the site at position 7 for
  "belgium residential electricity price per kwh 2026" with no Belgium page at
  all. The opportunity is real, and so is the way it goes wrong: 23 near-
  identical pages with one number swapped is the "low value content" pattern
  that already cost a session on the appliance pages. Most of what is checked
  here is that guard rail.

  The other half is a mistake caught while building them. The country price is
  Eurostat's ALL-TAXES-INCLUDED average; providers[].price is an advertised
  standard tariff, and across countries those are not on the same basis —
  Spain's retailers sit 22-33% BELOW their national average, the Netherlands'
  27-35% above. A table putting the two side by side under a "vs. national
  average" heading reproduces exactly the error meta.definition warns about,
  on a page that quotes that warning two paragraphs higher up. So the retailer
  table must stay three columns wide and must carry the caveat.

  Run: node --test
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { COUNTRY_PAGES, countrySlug, ineligible, hasRetail, hasGas, breakEvenCop, BOILER_EFF } from '../tools/country-pages.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(path.join(ROOT, 'data', 'energy-prices.json'), 'utf-8'));
const country = (code) => data.countries.find((c) => c.code === code);

const pagePath = (code, lang) =>
  path.join(ROOT, lang === 'es' ? 'es' : '', 'electricity-prices', countrySlug(country(code).name), 'index.html');
const read = (code, lang) => readFileSync(pagePath(code, lang), 'utf-8');
const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&[a-z]+;/g, ' ');

// Locale-aware: "1,295" is one thousand two hundred in English and one point
// two nine five in Spanish. The same two characters mean opposite things, so
// the language has to travel with the text.
const num = (s, lang) => Number(lang === 'es' ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''));

/* The symbol and which side of the number it sits on come from the country, the
   same way moneyLabel() in the generator decides it. Hardcoding "€" here meant
   this test only worked for the eurozone — it passed on the first four
   countries by luck, and would have failed on the UK, Canada, Australia and
   the US while pointing the finger at the pages rather than at itself. */
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const money = (c) => (c.pos === 'pre'
  ? `${reEsc(c.symbol)}\\s?([\\d.,]+)`
  : `([\\d.,]+)\\s*${reEsc(c.symbol)}`);

test('every country with a page has something of its own to say', () => {
  for (const code of COUNTRY_PAGES) {
    const why = ineligible(country(code));
    assert.equal(why, null, `${code} would be the aggregate table with one number swapped: ${why}`);
  }
});

test('every country with a page actually has one, in both languages', () => {
  assert.ok(COUNTRY_PAGES.length > 0, 'no country pages configured at all');
  for (const code of COUNTRY_PAGES) {
    for (const lang of ['en', 'es']) {
      assert.ok(existsSync(pagePath(code, lang)),
        `${code} is in COUNTRY_PAGES but ${path.relative(ROOT, pagePath(code, lang))} does not exist — run npm run build:countries`);
    }
  }
});

test('no country page is an orphan', () => {
  // The link lives in generate-prices.mjs, a different tool from the one that
  // writes the page, so nothing but a test keeps the two in step.
  for (const lang of ['en', 'es']) {
    const parent = readFileSync(path.join(ROOT, lang === 'es' ? 'es' : '', 'electricity-prices', 'index.html'), 'utf-8');
    for (const code of COUNTRY_PAGES) {
      const slug = countrySlug(country(code).name);
      assert.match(parent, new RegExp(`href="${slug}/"`),
        `/${lang === 'es' ? 'es/' : ''}electricity-prices/ does not link to ${slug}/ — the page would only be reachable from the sitemap`);
    }
  }
});

test('the two languages point at each other', () => {
  for (const code of COUNTRY_PAGES) {
    const slug = countrySlug(country(code).name);
    for (const lang of ['en', 'es']) {
      const html = read(code, lang);
      assert.match(html, new RegExp(`hreflang="en" href="https://[^"]*/electricity-prices/${slug}/"`), `${code} ${lang}: no reciprocal en hreflang`);
      assert.match(html, new RegExp(`hreflang="es" href="https://[^"]*/es/electricity-prices/${slug}/"`), `${code} ${lang}: no reciprocal es hreflang`);
      const canonical = html.match(/<link rel="canonical" href="([^"]+)"/);
      assert.ok(canonical, `${code} ${lang}: no canonical, so the sitemap will skip the page`);
      assert.equal(canonical[1], `https://wattfigures.com/${lang === 'es' ? 'es/' : ''}electricity-prices/${slug}/`);
    }
  }
});

test('the retailer table never compares a tariff with the national average', () => {
  for (const code of COUNTRY_PAGES) {
    const c = country(code);
    if (!hasRetail(c)) continue;   // Austria and Sweden earn their page on gas
    for (const lang of ['en', 'es']) {
      const html = read(code, lang);
      // The retailer table is the one whose header starts with the supplier
      // column. Two spellings since 2026-07-28: a country with `market:
      // "regional"` says Utility/Distribuidora, because in the United States and
      // Canada the reader is not choosing a retailer — the monopoly serving
      // their address is choosing for them.
      const m = html.match(/<table>(?:<caption>[^<]*<\/caption>)?<thead><tr><th>(?:Retailer|Compañía|Utility|Distribuidora)<\/th>([\s\S]*?)<\/tr>/);
      assert.ok(m, `${code} ${lang}: could not find the retailer table`);
      const cols = (m[0].match(/<th>/g) || []).length;
      assert.equal(cols, 3,
        `${code} ${lang}: the retailer table has ${cols} columns. A fourth one is almost certainly "vs. national average", ` +
        'which sets an advertised unit rate against an all-taxes-included average — the two are not on the same basis.');
      assert.match(strip(html), lang === 'es' ? /Compara estas cifras entre sí, no contra la media/ : /Compare these with each other, not with the/,
        `${code} ${lang}: the retailer caveat is gone; without it the table invites exactly that comparison`);
    }
  }
});

/* The page has to carry the thing that earned it. A country admitted on gas
   whose gas section went missing is back to being the country table with one
   number changed, and nothing else would notice. */
test('every page carries whatever earned it a page', () => {
  for (const code of COUNTRY_PAGES) {
    const c = country(code);
    for (const lang of ['en', 'es']) {
      const text = strip(read(code, lang));
      const retail = lang === 'es'
        ? /Lo que cobran las principales (?:compañías|distribuidoras)/
        : /What the main (?:retailers|utilities) in/;
      const gas = lang === 'es' ? /¿gas o bomba de calor\?/ : /gas or a heat pump\?/;
      const has = { retail: retail.test(text), gas: gas.test(text) };
      assert.equal(has.retail, hasRetail(c), `${code} ${lang}: retailer section present=${has.retail}, data says ${hasRetail(c)}`);
      assert.equal(has.gas, hasGas(c), `${code} ${lang}: gas section present=${has.gas}, data says ${hasGas(c)}`);
      assert.ok(has.retail || has.gas, `${code} ${lang}: neither section — this page has nothing of its own to say`);
    }
  }
});

/* The break-even COP is the one figure on these pages that is not a price or a
   multiplication of one, and it has to agree with calculators/heat-pump-vs-gas
   — the page links straight to it. Recomputed here from the data, then matched
   against what the page printed. */
test('the break-even COP is the one the two prices imply', () => {
  for (const code of COUNTRY_PAGES) {
    const c = country(code);
    if (!hasGas(c)) continue;
    for (const lang of ['en', 'es']) {
      const text = strip(read(code, lang));
      const re = lang === 'es'
        ? /COP estacional de\s+([\d.,]+)/
        : /cost the same to run at a seasonal COP of\s+([\d.,]+)/;
      const m = text.match(re);
      assert.ok(m, `${code} ${lang}: the page does not print a break-even COP`);
      const printed = num(m[1], lang);
      const expected = breakEvenCop(c);
      assert.ok(Math.abs(printed - expected) <= 0.06,
        `${code} ${lang}: page says COP ${printed}, but ${c.price} x ${BOILER_EFF} / ${c.gas} is ${expected.toFixed(2)}`);
    }
  }
});

test('the money on the page is the money the data implies', () => {
  // Re-derived from the published text rather than from the code that wrote
  // it: parse the yearly total the page prints and check it against
  // kWh x price computed here.
  const appliances = JSON.parse(readFileSync(path.join(ROOT, 'data', 'appliances.json'), 'utf-8')).appliances;

  for (const code of COUNTRY_PAGES) {
    const c = country(code);
    for (const lang of ['en', 'es']) {
      const html = read(code, lang);
      const text = strip(html);
      const lead = lang === 'es' ? 'Los cuatro juntos suman' : 'Those four together come to';
      const m = text.match(new RegExp(`${lead}\\s+${money(c)}`));
      assert.ok(m, `${code} ${lang}: could not find the showcase total in the published text`);
      const printed = num(m[1], lang);

      /* Which four appliances is read off the page's own links, not from the
         generator's SHOWCASE constant — otherwise a country given a different
         set (the US, so it does not repeat us-states) would silently be
         checked against the wrong four. */
      const slugs = [...html.matchAll(/href="[^"]*\/appliances\/([a-z0-9-]+)\/"/g)].map((x) => x[1]);
      assert.ok(slugs.length >= 4, `${code} ${lang}: found ${slugs.length} appliance links, expected the showcase table`);
      const kwh = [...new Set(slugs)]
        .map((slug) => appliances.find((a) => a.slug === slug))
        /* Deliberately a second implementation of energyProfile() rather than an
           import: if the shared formula were wrong, importing it would make this
           test agree with the bug. The cost of that choice is that it has to be
           kept in step by hand — when hoursPerDay gained a duty cycle on
           2026-07-28 this line still assumed the nameplate and put the US total
           25% over what the page prints. Any change to appliance-energy.mjs
           needs the mirror here. */
        .reduce((sum, a) => {
          const w = a.watts ? a.watts.typical : 0;
          const duty = a.dutyCycle || 1;
          if (a.usage && a.usage.mode === 'cyclesPerWeek') return sum + (a.usage.cycleKwh || 0) * (a.usage.default || 0) * 52;
          if (a.usage && a.usage.mode === 'alwaysOn') return sum + w / 1000 * 24 * duty * 365;
          return sum + w / 1000 * duty * (a.usage ? a.usage.default : 0) * ((a.usage && a.usage.seasonDays) || 365);
        }, 0);

      const expected = Math.round(kwh * c.price);
      assert.ok(Math.abs(printed - expected) <= 1,
        `${code} ${lang}: the page says ${printed} but ${Math.round(kwh)} kWh at ${c.price} is ${expected}`);
    }
  }
});

/* The same break-even, but on the hand-written guide rather than a generated
   page — and that is the whole point of checking it.

   What went wrong here was not a mistyped number. The guide was written on
   2026-07-19 and said electricity "costs three to four times more per kWh than
   natural gas in many markets". Eight days later gas prices for eleven
   countries landed in energy-prices.json, and the real ratio turned out to run
   from 1.3x in Sweden to 3.9x in Belgium: the sentence was wrong in seven of
   the eleven countries the site publishes. Nothing failed, because no test
   looks at prose, and the page sat there contradicting the fourteen country
   pages that link to it.

   So this checks two things. That every figure in the guide's break-even table
   still equals price x 0.92 / gas — and that the table lists exactly the
   countries that have a gas price, so the next time fetch-prices.mjs adds one,
   the build stops until somebody has revisited the guide. */
const guidePath = (lang) => path.join(
  ROOT, lang === 'es' ? 'es' : '', 'guides', 'heat-pump-vs-gas-boiler-running-cost', 'index.html');

test('the heat pump guide agrees with the data it is written about', () => {
  const expectedSlugs = data.countries.filter(hasGas).map((c) => countrySlug(c.name)).sort();

  for (const lang of ['en', 'es']) {
    const html = readFileSync(guidePath(lang), 'utf-8');
    const rows = [...html.matchAll(/<tr>(?:(?!<\/tr>)[\s\S])*?<\/tr>/g)]
      .map((m) => m[0])
      .filter((r) => /electricity-prices\/[a-z-]+\//.test(r));

    const seen = [];
    for (const row of rows) {
      const slug = row.match(/electricity-prices\/([a-z-]+)\//)[1];
      const c = data.countries.find((x) => countrySlug(x.name) === slug);
      assert.ok(c, `${lang}: the guide links to /${slug}/, which is no country in energy-prices.json`);
      assert.ok(hasGas(c), `${lang}: ${c.code} is in the break-even table but has no gas price`);
      seen.push(slug);

      const cells = [...row.matchAll(/<td>([\s\S]*?)<\/td>/g)].map((m) => strip(m[1]).trim());
      assert.equal(cells.length, 5, `${lang}: ${c.code} row has ${cells.length} cells, expected 5`);

      const ratio = num(cells[3].match(/([\d.,]+)/)[1], lang);
      assert.ok(Math.abs(ratio - c.price / c.gas) <= 0.05,
        `${lang}: ${c.code} guide says the ratio is ${ratio}, but ${c.price} / ${c.gas} is ${(c.price / c.gas).toFixed(2)}`);

      const printed = num(cells[4].match(/([\d.,]+)/)[1], lang);
      const expected = breakEvenCop(c);
      assert.ok(Math.abs(printed - expected) <= 0.005,
        `${lang}: ${c.code} guide says the break-even COP is ${printed}, but ${c.price} x ${BOILER_EFF} / ${c.gas} is ${expected.toFixed(2)}`);
    }

    assert.deepEqual(seen.sort(), expectedSlugs,
      `${lang}: the guide's break-even table and the countries with a gas price have drifted apart. `
      + `Add or remove the row, and re-read the prose around it — the counts ("nine of eleven") are written by hand.`);
  }
});
