#!/usr/bin/env node
/*
  stamp-price-defaults.mjs — the price a calculator opens with comes from the
  data file, not from whoever typed the page.

  Why this exists: on 2026-07-26 `data/energy-prices.json` moved the US to
  0.18 and Spain to 0.27. The 30 appliance pages followed, because they are
  generated from it. The 16 calculator pages did not, because they are
  hand-written HTML — so every one of them opened with a price that was
  wrong by 6% (US) or 42% (Spain), and half of them contradicted a caption
  fifteen lines below on the same page that said the new figure.

  The markup already tells us which input holds the price: energy-prices.js
  looks for `data-country-price` to overwrite it when the reader picks a
  country. This walks the same attribute and writes the opening value, so the
  number before the JavaScript runs agrees with the number after it.

  Gas got the same treatment on 2026-07-27, for the same reason and one worse:
  its price was not merely stale, it was wrong. The heat-pump guide stated
  "$0.12 per therm" while its own table implied $0.97, against a real US
  average of $1.44 — and the calculator next to it said $0.09/kWh, which is
  $2.64 a therm. Gas now carries `data-country-gas` and comes from the same
  file. Export tariffs are still left alone: they carry neither attribute,
  because they are not a price the reader pays.

  English pages open on the United States, Spanish pages on Spain — the
  default the reader sees before the picker resolves their own country.

  Idempotent: a page whose value already matches is not rewritten.

  Run:  node tools/stamp-price-defaults.mjs
*/
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '_pagefind', 'graphify-out', '_originals', '.git', 'docs', 'n8n', 'supabase', 'templates']);

const prices = JSON.parse(readFileSync(path.join(ROOT, 'data', 'energy-prices.json'), 'utf-8'));
const fieldOf = (code, field) => {
  const c = prices.countries.find((x) => x.code === code);
  if (!c || typeof c[field] !== 'number') {
    throw new Error(`energy-prices.json has no usable ${field} for ${code} — refusing to stamp a blank default.`);
  }
  return c[field];
};
const DEFAULT = { en: fieldOf('US', 'price'), es: fieldOf('ES', 'price') };
const GAS = { en: fieldOf('US', 'gas'), es: fieldOf('ES', 'gas') };

function htmlFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) htmlFiles(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

const INPUT = /<input\b[^>]*\bdata-country-price\b[^>]*>/g;
const GAS_INPUT = /<input\b[^>]*\bdata-country-gas\b[^>]*>/g;

let files = 0, inputs = 0, changed = 0, gasInputs = 0, gasChanged = 0;
for (const file of htmlFiles(ROOT)) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const lang = rel.startsWith('es/') ? 'es' : 'en';
  const before = readFileSync(file, 'utf-8');
  let html = before.replace(INPUT, (tag) => {
    inputs++;
    const out = tag.replace(/\bvalue="[^"]*"/, `value="${DEFAULT[lang]}"`);
    if (out !== tag) changed++;
    return out;
  });
  html = html.replace(GAS_INPUT, (tag) => {
    gasInputs++;
    const out = tag.replace(/\bvalue="[^"]*"/, `value="${GAS[lang]}"`);
    if (out !== tag) gasChanged++;
    return out;
  });
  if (html !== before) { writeFileSync(file, html, 'utf-8'); files++; }
}

console.log(`price defaults: ${inputs} electricity + ${gasInputs} gas input(s) checked`
  + ` (US ${DEFAULT.en}/${GAS.en}, ES ${DEFAULT.es}/${GAS.es})`
  + (changed + gasChanged ? ` — ${changed + gasChanged} restamped across ${files} page(s)` : ' — all current'));
