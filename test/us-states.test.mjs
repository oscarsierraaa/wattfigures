/*
  Dataset invariants for data/us-states.json — the EIA state-level residential
  prices behind /electricity-prices/us-states/. The generator throws rather
  than fall back when a field is missing, so a malformed entry here fails the
  build instead of shipping a wrong price on a page whose whole point is being
  the accurate one. Refreshed by tools/fetch-us-states.mjs. Run: node --test
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(path.join(root, '..', 'data', 'us-states.json'), 'utf-8'));
const states = data.states;

test('all 50 states plus DC are present, once each', () => {
  assert.equal(states.length, 51, 'expected 50 states + District of Columbia');
  const seen = new Set();
  for (const s of states) {
    assert.match(s.code, /^[A-Z]{2}$/, `${s.code}: code is not a two-letter pair`);
    assert.ok(!seen.has(s.code), `duplicate state code ${s.code}`);
    seen.add(s.code);
  }
  for (const code of ['CA', 'TX', 'NY', 'HI', 'DC']) {
    assert.ok(seen.has(code), `missing ${code}`);
  }
});

test('every state carries the fields the renderers read', () => {
  for (const s of states) {
    for (const k of ['code', 'name', 'name_es', 'cents', 'cents_prev']) {
      assert.ok(k in s, `${s.code || '?'} missing ${k}`);
    }
    assert.ok(s.name && s.name_es, `${s.code}: needs a name in both languages`);
  }
});

// A price outside this band means the parse grabbed the wrong column — the
// sheet also carries commercial, industrial and transportation figures, and
// transportation in particular runs far lower.
test('residential prices are positive and inside a plausible band', () => {
  for (const s of states) {
    assert.ok(typeof s.cents === 'number' && s.cents > 0, `${s.code}: cents must be a positive number`);
    assert.ok(s.cents >= 5 && s.cents <= 80, `${s.code}: ${s.cents} c/kWh is outside the plausible band`);
    if (s.cents_prev !== null) {
      assert.ok(typeof s.cents_prev === 'number' && s.cents_prev > 0, `${s.code}: cents_prev must be positive when present`);
    }
  }
});

test('the national average sits between the cheapest and the dearest state', () => {
  const avg = data.meta.us_average_cents;
  assert.ok(typeof avg === 'number' && avg > 0, 'meta.us_average_cents must be a positive number');
  const values = states.map((s) => s.cents);
  assert.ok(avg > Math.min(...values), 'average is not above the cheapest state');
  assert.ok(avg < Math.max(...values), 'average is not below the dearest state');
});

// The page prints the period and credits the EIA; losing either would put an
// undated, unattributed price table online.
test('meta carries the period and the attribution the page prints', () => {
  for (const k of ['period', 'period_prev', 'updated', 'unit', 'sector', 'source', 'source_url']) {
    assert.ok(data.meta[k], `meta.${k} is missing`);
  }
  assert.match(data.meta.updated, /^\d{4}-\d{2}-\d{2}$/, 'meta.updated must be an ISO date');
  assert.match(data.meta.source, /Energy Information Administration/, 'meta.source must credit the EIA');
});

// energy-prices.json is the single source of the kWh price site-wide. Its US
// entry and this file describe the same thing, so they must not drift apart.
test('the US entry in energy-prices.json agrees with the EIA average', () => {
  const prices = JSON.parse(readFileSync(path.join(root, '..', 'data', 'energy-prices.json'), 'utf-8'));
  const us = prices.countries.find((c) => c.code === 'US');
  assert.ok(us, 'US missing from energy-prices.json');
  const drift = Math.abs(us.price * 100 - data.meta.us_average_cents);
  assert.ok(drift <= 1, `US price drifted: energy-prices.json says ${us.price * 100} c/kWh, EIA says ${data.meta.us_average_cents} c/kWh`);
});
