/*
  generate-calc-related.mjs — replaces the near-empty "Related reading" list at
  the bottom of every calculator with a real block: cards for the appliances that
  calculator actually applies to (with artwork + running cost) plus links to the
  sibling calculators and guides that follow on.

  Why: the stock block was a single "More in Calculators" link — a dead end for
  the reader and a wasted internal link for search engines.

  Idempotent: rewrites the block between the markers each run.
  Run:  node tools/generate-calc-related.mjs
*/
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { artUrl } from './appliance-art.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(path.join(ROOT, 'data', 'appliances.json'), 'utf-8'));
const prices = JSON.parse(readFileSync(path.join(ROOT, 'data', 'energy-prices.json'), 'utf-8'));

const price0 = (lang) => {
  const code = lang === 'es' ? 'ES' : 'US';
  const c = prices.countries.find(c => c.code === code);
  if (!c || typeof c.price !== 'number') {
    throw new Error(`energy-prices.json has no usable price for ${code} — cannot generate ${lang} calculator related links.`);
  }
  return c.price;
};
const sym = lang => (lang === 'es' ? { s: '€', pre: false } : { s: '$', pre: true });
function money(v, lang) {
  const { s, pre } = sym(lang);
  const n = Math.round(v).toLocaleString(lang === 'es' ? 'es-ES' : 'en-US');
  return pre ? s + n : n + ' ' + s;
}
function typicalYearlyKwh(a) {
  const u = a.usage || {};
  if (u.mode === 'cyclesPerWeek') return (u.cycleKwh || 0) * (u.default || 0) * 52;
  if (u.mode === 'alwaysOn') return ((a.watts?.typical || 0) / 1000) * (a.dutyCycle || 1) * 24 * 365;
  return ((a.watts?.typical || 0) / 1000) * (u.default || 0) * 365;
}
const byslug = Object.fromEntries(data.appliances.map(a => [a.slug, a]));
const maxKwh = Math.max(...data.appliances.map(typicalYearlyKwh));

// Which appliances each calculator actually helps with, plus follow-on reading.
const MAP = {
  'electricity-cost':  { app: ['refrigerator', 'led-tv', 'desktop-pc', 'electric-kettle', 'microwave', 'washing-machine'], calc: ['standby-power', 'laundry-cost'], guide: ['understanding-your-electricity-bill'] },
  'standby-power':     { app: ['wifi-router', 'game-console', 'sound-system', 'led-tv', 'microwave', 'coffee-machine'], calc: ['electricity-cost'], guide: ['how-to-cut-standby-power', 'vampire-device-audit-checklist'] },
  'air-conditioning':  { app: ['air-conditioner', 'ceiling-fan', 'dehumidifier', 'electric-blanket', 'space-heater'], calc: ['heat-pump-vs-gas', 'electricity-cost'], guide: ['time-of-use-tariffs-explained'] },
  'heat-pump-vs-gas':  { app: ['space-heater', 'electric-water-heater', 'electric-blanket', 'air-conditioner'], calc: ['air-conditioning', 'solar-payback'], guide: ['heat-pump-vs-gas-boiler-running-cost'] },
  'led-vs-halogen':    { app: ['led-bulb', 'led-tv', 'monitor'], calc: ['electricity-cost', 'standby-power'], guide: ['understanding-your-electricity-bill'] },
  'laundry-cost':      { app: ['washing-machine', 'tumble-dryer', 'dishwasher', 'clothes-iron', 'electric-water-heater'], calc: ['electricity-cost', 'heat-pump-vs-gas'], guide: ['time-of-use-tariffs-explained'] },
  'solar-payback':     { app: ['electric-water-heater', 'air-conditioner', 'refrigerator'], calc: ['heat-pump-vs-gas', 'electricity-cost'], guide: ['understanding-your-electricity-bill'] },
  'ev-charging':       { app: ['desktop-pc', 'electric-water-heater', 'air-conditioner'], calc: ['electricity-cost', 'solar-payback'], guide: ['time-of-use-tariffs-explained'] },
};

const T = {
  en: { h: 'Where this applies', sub: 'Typical running costs for the appliances this calculator covers.',
        more: 'Keep going', allApp: 'All appliance running costs', calcs: 'Calculators', guides: 'Guides', yr: '/yr' },
  es: { h: 'Dónde se aplica', sub: 'Coste típico de los aparatos que cubre esta calculadora.',
        more: 'Sigue explorando', allApp: 'Todos los consumos de aparatos', calcs: 'Calculadoras', guides: 'Guías', yr: '/año' },
};
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function titleOf(rel, lang) {
  const f = path.join(ROOT, lang === 'es' ? 'es' : '', rel, 'index.html');
  if (!existsSync(f)) return null;
  const m = readFileSync(f, 'utf-8').match(/<title>([^<]*)<\/title>/);
  return m ? m[1].replace(/\s*\|\s*WattFigures\s*$/, '').trim() : null;
}

function block(slug, lang) {
  const cfg = MAP[slug]; if (!cfg) return null;
  const t = T[lang], p = price0(lang);
  const cards = cfg.app.map(s => byslug[s]).filter(Boolean).map(a => {
    const kwh = typicalYearlyKwh(a);
    const tier = kwh > 900 ? 'high' : kwh > 250 ? 'mid' : 'low';
    const name = lang === 'es' ? a.name_es : a.name;
    const pct = Math.max(4, Math.round(kwh / maxKwh * 100));
    return `        <a class="card appl-card is-${tier}" href="/${lang === 'es' ? 'es/' : ''}appliances/${a.slug}/">`
      + `<div class="card-media"><img src="${artUrl(a.slug)}" alt="" loading="lazy" width="800" height="600"></div>`
      + `<div class="card-body"><h3 class="font-display">${esc(name)}</h3>`
      + `<p class="ac-figure"><span class="ac-cost">${esc(money(kwh * p, lang))}</span><span class="ac-per">${t.yr}</span></p>`
      + `<span class="ac-bar" aria-hidden="true"><i style="width:${pct}%"></i></span></div></a>`;
  }).join('\n');

  const links = [];
  for (const c of cfg.calc) { const ti = titleOf(`calculators/${c}`, lang); if (ti) links.push(`<li><a class="ul-link" href="/${lang === 'es' ? 'es/' : ''}calculators/${c}/">${esc(ti)}</a></li>`); }
  for (const g of cfg.guide) { const ti = titleOf(`guides/${g}`, lang); if (ti) links.push(`<li><a class="ul-link" href="/${lang === 'es' ? 'es/' : ''}guides/${g}/">${esc(ti)}</a></li>`); }
  links.push(`<li><a class="ul-link" href="/${lang === 'es' ? 'es/' : ''}appliances/">${t.allApp}</a></li>`);

  return `      <h2>${t.h}</h2>
      <p>${t.sub}</p>
      <div class="card-grid calc-related">
${cards}
      </div>
      <h2>${t.more}</h2>
      <ul>
        ${links.join('\n        ')}
      </ul>`;
}

let n = 0;
for (const slug of Object.keys(MAP)) {
  for (const lang of ['en', 'es']) {
    const file = path.join(ROOT, lang === 'es' ? 'es' : '', 'calculators', slug, 'index.html');
    if (!existsSync(file)) continue;
    let html = readFileSync(file, 'utf-8');
    const body = block(slug, lang);
    if (!body) continue;
    const marked = /(<!--\s*RELATED:START\s*-->)([\s\S]*?)(<!--\s*RELATED:END\s*-->)/;
    if (marked.test(html)) {
      html = html.replace(marked, (_m, a, _b, c) => `${a}\n${body}\n      ${c}`);
    } else {
      // First run: swap the stock "Related reading" aside for a marked block.
      const aside = /<aside class="prose-sec print-hide"[^>]*>[\s\S]*?<\/aside>/;
      if (!aside.test(html)) { console.log(`  ! no related block in ${slug} [${lang}]`); continue; }
      html = html.replace(aside, () =>
        `<aside class="prose-sec print-hide" style="margin-top:2.5rem">\n      <!-- RELATED:START -->\n${body}\n      <!-- RELATED:END -->\n    </aside>`);
    }
    writeFileSync(file, html, 'utf-8');
    n++;
  }
}
console.log(`calculator related blocks rebuilt: ${n} pages`);
