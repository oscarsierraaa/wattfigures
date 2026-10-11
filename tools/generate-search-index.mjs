/*
  generate-search-index.mjs — builds data/search-index.json for the header
  search: every appliance, calculator and guide, per language, with enough
  metadata to show a useful row (kind, title, a short spec/summary line).

  Appliances come from data/appliances.json (so we get real watts/kWh); the
  other sections are read off the generated pages' <title> + meta description.

  Run:  node tools/generate-search-index.mjs
*/
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COUNTRY_PAGES, countrySlug } from './country-pages.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(path.join(ROOT, 'data', 'appliances.json'), 'utf-8'));
const prices = JSON.parse(readFileSync(path.join(ROOT, 'data', 'energy-prices.json'), 'utf-8'));

function catLabel(id, lang) {
  const c = (data.categories || []).find(x => x.id === id);
  if (!c) return '';
  return lang === 'es' ? (c.label_es || c.label) : c.label;
}
// Same typical-yearly-kWh rule the appliance pages use.
function typicalYearlyKwh(a) {
  const u = a.usage || {};
  if (u.mode === 'cyclesPerWeek') return (u.cycleKwh || 0) * (u.default || 0) * 52;
  if (u.mode === 'alwaysOn') return ((a.watts?.typical || 0) / 1000) * (a.dutyCycle || 1) * 24 * 365;
  return ((a.watts?.typical || 0) / 1000) * (u.default || 0) * 365;
}

function metaOf(file) {
  const html = readFileSync(file, 'utf-8');
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
  return { title: title.replace(/\s*\|\s*WattFigures\s*$/, '').trim(), desc: desc.trim() };
}

function scanSection(rel, kind, lang) {
  const dir = path.join(ROOT, rel);
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith('page-')) continue;             // pagination shells
    const idx = path.join(dir, name, 'index.html');
    if (!statSync(path.join(dir, name), { throwIfNoEntry: false })?.isDirectory?.()) continue;
    if (!existsSync(idx)) continue;
    const { title, desc } = metaOf(idx);
    if (!title) continue;
    out.push({ k: kind, t: title, u: '/' + rel.replace(/\\/g, '/') + '/' + name + '/', s: desc.slice(0, 110), lang });
  }
  return out;
}

function build(lang) {
  const pfx = lang === 'es' ? 'es/' : '';
  const items = [];
  // Appliances (rich: category + specs)
  for (const a of data.appliances) {
    const kwh = Math.round(typicalYearlyKwh(a));
    const isCycle = a.usage && a.usage.mode === 'cyclesPerWeek';
    const spec = isCycle
      ? `${a.usage.cycleKwh} kWh/${lang === 'es' ? 'ciclo' : 'cycle'} · ${kwh} kWh/${lang === 'es' ? 'año' : 'yr'}`
      : `${a.watts?.typical || '?'} W · ${kwh} kWh/${lang === 'es' ? 'año' : 'yr'}`;
    items.push({
      k: 'appliance', t: lang === 'es' ? a.name_es : a.name,
      u: `/${pfx}appliances/${a.slug}/`, s: spec, c: catLabel(a.category, lang), kwh, lang,
    });
  }
  items.push(...scanSection(`${pfx}calculators`, 'calculator', lang));
  items.push(...scanSection(`${pfx}guides`, 'guide', lang));
  // Standalone tools
  for (const [rel, kind] of [[`${pfx}estimator`, 'tool'], [`${pfx}electricity-prices`, 'tool']]) {
    const idx = path.join(ROOT, rel, 'index.html');
    if (!existsSync(idx)) continue;
    const { title, desc } = metaOf(idx);
    items.push({ k: kind, t: title, u: '/' + rel + '/', s: desc.slice(0, 110), lang });
  }

  /* The per-country price pages. Without this the site's own search cannot
     find "Belgium" — a reader who types a country name gets nothing, on a site
     whose best-ranking queries are country names. Listed by country rather
     than by page title so the thing typed is the thing matched. */
  for (const c of prices.countries) {
    if (!COUNTRY_PAGES.includes(c.code)) continue;
    const rel = `${pfx}electricity-prices/${countrySlug(c.name)}`;
    const idx = path.join(ROOT, rel, 'index.html');
    if (!existsSync(idx)) continue;
    const price = c.pos === 'pre' ? c.symbol + c.price : c.price + ' ' + c.symbol;
    items.push({
      k: 'price', t: lang === 'es' ? c.name_es : c.name,
      u: '/' + rel + '/', s: `${price}/kWh`,
      c: lang === 'es' ? 'Precios de la luz' : 'Electricity prices', lang,
    });
  }
  return items;
}

const index = { en: build('en'), es: build('es') };
writeFileSync(path.join(ROOT, 'data', 'search-index.json'), JSON.stringify(index), 'utf-8');
console.log(`search index: ${index.en.length} EN + ${index.es.length} ES entries → data/search-index.json`);
