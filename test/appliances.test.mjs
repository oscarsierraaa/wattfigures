/*
  Dataset invariants for data/appliances.json — the programmatic appliance
  pages are only as good as this file. Validates structure, bilingual coverage,
  usage modes and cross-references. Run: node --test
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { energyProfile } from '../tools/appliance-energy.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(path.join(root, '..', 'data', 'appliances.json'), 'utf-8'));
const catIds = new Set((data.categories || []).map(c => c.id));
const slugs = new Set(data.appliances.map(a => a.slug));
const wc = s => String(s).trim().split(/\s+/).filter(Boolean).length;

// Price defaults used to live here as meta.priceDefaults. They moved to
// data/energy-prices.json when that became the only source of a kWh price;
// what this file still owns is the currency symbol each language renders with.
// See test/energy-prices.test.mjs for the price invariants themselves.
test('meta has a bilingual currency symbol', () => {
  assert.ok(data.meta.currency.en, 'meta.currency.en missing');
  assert.ok(data.meta.currency.es, 'meta.currency.es missing');
});

test('every appliance has required bilingual fields', () => {
  for (const a of data.appliances) {
    for (const k of ['slug', 'name', 'name_es', 'category', 'watts', 'usage', 'intro', 'tips', 'faq', 'related']) {
      assert.ok(k in a, `${a.slug || '?'} missing ${k}`);
    }
    assert.ok(catIds.has(a.category), `${a.slug}: unknown category ${a.category}`);
    assert.ok(a.watts.min <= a.watts.typical && a.watts.typical <= a.watts.max, `${a.slug}: watts min/typical/max out of order`);
  }
});

test('slugs are unique and kebab-case', () => {
  const seen = new Set();
  for (const a of data.appliances) {
    assert.ok(!seen.has(a.slug), `duplicate slug ${a.slug}`);
    seen.add(a.slug);
    assert.match(a.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${a.slug}: not kebab-case`);
  }
});

test('usage modes are valid and carry the fields they need', () => {
  for (const a of data.appliances) {
    const m = a.usage.mode;
    assert.ok(['hoursPerDay', 'alwaysOn', 'cyclesPerWeek'].includes(m), `${a.slug}: bad mode ${m}`);
    if (m === 'alwaysOn') assert.ok(a.dutyCycle > 0 && a.dutyCycle <= 1, `${a.slug}: alwaysOn needs a dutyCycle 0–1`);
    if (m === 'cyclesPerWeek') assert.ok(a.usage.cycleKwh > 0, `${a.slug}: cyclesPerWeek needs cycleKwh`);
    // Since 2026-07-28 hoursPerDay may carry one too — an oven does not draw its
    // nameplate for a whole hour. cyclesPerWeek measures energy directly, so a
    // duty cycle there would be silently ignored rather than wrong on the page.
    if ('dutyCycle' in a) {
      assert.ok(typeof a.dutyCycle === 'number' && a.dutyCycle > 0 && a.dutyCycle <= 1,
        `${a.slug}: dutyCycle must be a number in (0, 1], got ${JSON.stringify(a.dutyCycle)}`);
      assert.notEqual(m, 'cyclesPerWeek', `${a.slug}: cyclesPerWeek ignores dutyCycle — put the figure in cycleKwh`);
    }
  }
});

/*
  The estimator and the appliance pages must give the same appliance the same
  yearly figure, because it is the same quantity.

  tools/appliance-energy.mjs exists because two copies of that formula would
  eventually disagree — "the whole promise of the site is that the figure on the
  appliance page and the figure on the price page are the same figure". The
  estimator was a third copy nobody had connected: data/estimator-appliances.json
  is fetched straight by the browser (assets/estimator.js), so it cannot import
  from tools/ and its numbers were typed by hand.

  They had drifted badly by 2026-07-28 — the hair dryer by 81%, the laptop by
  59%, the desktop PC by 57%, the oven by 36% — and nothing anywhere said so.
  Which of the two was right is settled elsewhere; what this test does is make it
  impossible for them to disagree again in silence.

  The tolerance exists so a tidy round number is allowed, not so a second opinion
  is. Anything that fails here is a real divergence, and the fix is to re-derive
  the estimator figure, never to widen the band.
*/
test('the estimator and the appliance pages agree on yearly consumption', () => {
  const est = JSON.parse(readFileSync(path.join(root, '..', 'data', 'estimator-appliances.json'), 'utf-8'));
  const bySlug = new Map(data.appliances.map((a) => [a.slug, a]));
  const shared = est.appliances.filter((e) => bySlug.has(e.id));
  assert.ok(shared.length >= 15,
    `only ${shared.length} estimator entries match an appliance slug — has an id been renamed?`);

  const wrong = [];
  for (const e of shared) {
    const derived = energyProfile(bySlug.get(e.id)).perYearKwh;
    const slack = Math.max(1, derived * 0.02);
    if (Math.abs(e.kwh - derived) > slack) {
      const pct = ((e.kwh - derived) / derived * 100).toFixed(0);
      wrong.push(`${e.id}: estimator says ${e.kwh} kWh, the appliance page derives ${Math.round(derived)} (${pct > 0 ? '+' : ''}${pct}%)`);
    }
  }
  assert.deepEqual(wrong, [],
    'the estimator has drifted from data/appliances.json — re-derive it with energyProfile(), do not retype it');
});

test('intros are substantial in both languages (≥190 words)', () => {
  for (const a of data.appliances) {
    for (const lang of ['en', 'es']) {
      const words = wc((a.intro[lang] || []).join(' '));
      assert.ok(words >= 190, `${a.slug} [${lang}]: intro only ${words} words`);
    }
  }
});

/*
  Counting words per language is not enough: a paragraph present in one language
  and absent in the other leaves both pages looking complete on their own, still
  well over 190 words, and only a side-by-side count finds it.

  Five of the thirty appliances had drifted this way by 2026-08-03 — game-console,
  electric-blanket, electric-shower and sound-system were each missing their last
  English paragraph in Spanish, and led-bulb was missing its *fourth*, with the
  translation of the fifth sitting silently in its place. That last one is why
  this counts positions rather than trusting that a gap is always at the end: a
  mirror one paragraph short in the middle is misaligned for everything after it,
  and appending the missing text would have made it worse, not better.

  It matters beyond tidiness. The Spanish pages are the ones currently holding
  the site's best positions, and hreflang tells Google the two are the same page
  in two languages — which is a claim this test is what keeps true.
*/
test('intros and tips have the same number of entries in both languages', () => {
  const off = [];
  for (const a of data.appliances) {
    for (const field of ['intro', 'tips']) {
      const en = (a[field].en || []).length;
      const es = (a[field].es || []).length;
      if (en !== es) off.push(`${a.slug}: ${field} has ${en} in en, ${es} in es`);
    }
  }
  assert.deepEqual(off, [], 'the bilingual mirror is short a paragraph on one side');
});

test('every FAQ entry is bilingual', () => {
  for (const a of data.appliances) {
    for (const f of a.faq) {
      for (const k of ['q', 'a', 'q_es', 'a_es']) assert.ok(f[k] && f[k].length > 0, `${a.slug}: FAQ missing ${k}`);
    }
  }
});

test('related slugs resolve within the dataset', () => {
  for (const a of data.appliances) {
    for (const r of a.related) assert.ok(slugs.has(r), `${a.slug}: related "${r}" does not exist`);
  }
});
