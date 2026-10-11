/*
  generate-calc-scenarios.mjs — adds a "what it costs in practice" table to each
  calculator: a small matrix of realistic scenarios with the numbers worked out.

  Why a table and not more prose: these pages were the thinnest on the site
  (~450 words) and padding them with paragraphs is exactly what reads as filler.
  A scenario matrix is genuinely useful (it answers "is mine expensive?" without
  typing anything), it is unique to this site, and every figure is computed from
  the same formula the calculator uses — nothing invented.

  Every table states its assumptions and the price it used, and points back at
  the calculator for the reader's own numbers.

  Idempotent: rewrites between SCENARIOS:START / SCENARIOS:END.
  Run:  node tools/generate-calc-scenarios.mjs
*/
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prices = JSON.parse(readFileSync(path.join(ROOT, 'data', 'energy-prices.json'), 'utf-8'));
const rate = (lang) => {
  const code = lang === 'es' ? 'ES' : 'US';
  const c = prices.countries.find(c => c.code === code);
  if (!c || typeof c.price !== 'number') {
    throw new Error(`energy-prices.json has no usable price for ${code} — cannot generate ${lang} calculator scenarios.`);
  }
  return c.price;
};
const money = (v, lang) => {
  const n = Math.round(v).toLocaleString(lang === 'es' ? 'es-ES' : 'en-US');
  return lang === 'es' ? `${n} €` : `$${n}`;
};
const rateLabel = lang => (lang === 'es' ? `${String(rate('es')).replace('.', ',')} €/kWh` : `$${rate('en')}/kWh`);

const L = {
  en: { h: 'What it costs in practice', at: 'Figures at', note: 'Your own price and habits change these — the calculator above uses your numbers.',
        perYear: 'a year', perSeason: 'a season', save: 'You save', yr: 'a year' },
  es: { h: 'Lo que cuesta en la práctica', at: 'Cifras a', note: 'Tu precio y tus hábitos cambian esto — la calculadora de arriba usa tus datos.',
        perYear: 'al año', perSeason: 'por temporada', save: 'Ahorras', yr: 'al año' },
};

// Each builder returns { intro, head:[], rows:[[]] } with figures already formatted.
const TABLES = {
  'electricity-cost': (lang) => {
    const p = rate(lang), t = L[lang];
    const hours = [1, 3, 8], watts = [50, 100, 500, 1000, 2000];
    return {
      intro: lang === 'es'
        ? `Coste anual de un aparato según su potencia y las horas que lo tengas encendido al día, a ${rateLabel(lang)}.`
        : `What an appliance costs per year by its power and how many hours a day it runs, at ${rateLabel(lang)}.`,
      head: [lang === 'es' ? 'Potencia' : 'Power', ...hours.map(h => `${h} h/${lang === 'es' ? 'día' : 'day'}`)],
      rows: watts.map(w => [`${w.toLocaleString(lang === 'es' ? 'es-ES' : 'en-US')} W`,
        ...hours.map(h => money(w / 1000 * h * 365 * p, lang))]),
    };
  },
  'standby-power': (lang) => {
    const p = rate(lang);
    const each = [1, 3, 5], counts = [5, 10, 20];
    return {
      intro: lang === 'es'
        ? `Lo que cuesta al año el consumo en standby, según cuántos aparatos dejas enchufados y lo que gasta cada uno estando "apagado", a ${rateLabel(lang)}.`
        : `The yearly cost of standby draw, by how many devices you leave plugged in and what each one pulls while "off", at ${rateLabel(lang)}.`,
      head: [lang === 'es' ? 'Aparatos' : 'Devices', ...each.map(w => `${w} W ${lang === 'es' ? 'cada uno' : 'each'}`)],
      rows: counts.map(n => [`${n}`, ...each.map(w => money(n * w / 1000 * 24 * 365 * p, lang))]),
    };
  },
  'air-conditioning': (lang) => {
    const p = rate(lang), days = 120;
    const hours = [4, 8, 12], units = [900, 1500, 2500];
    return {
      intro: lang === 'es'
        ? `Coste de una temporada de ${days} días de aire acondicionado, según la potencia del equipo y las horas diarias, a ${rateLabel(lang)}.`
        : `Cost of a ${days}-day cooling season by unit power and hours per day, at ${rateLabel(lang)}.`,
      head: [lang === 'es' ? 'Equipo' : 'Unit', ...hours.map(h => `${h} h/${lang === 'es' ? 'día' : 'day'}`)],
      rows: units.map(w => [`${w.toLocaleString(lang === 'es' ? 'es-ES' : 'en-US')} W`,
        ...hours.map(h => money(w / 1000 * h * days * p, lang))]),
    };
  },
  'laundry-cost': (lang) => {
    const p = rate(lang);
    const loads = [2, 4, 7];
    const wash = 0.7, dry = 2.5;
    return {
      intro: lang === 'es'
        ? `Coste anual del lavado según cuántas coladas hagas por semana, con y sin secadora (0,7 kWh por lavado y 2,5 kWh por secado), a ${rateLabel(lang)}.`
        : `Yearly laundry cost by loads per week, with and without a tumble dryer (0.7 kWh per wash, 2.5 kWh per dry), at ${rateLabel(lang)}.`,
      head: [lang === 'es' ? 'Coladas/semana' : 'Loads/week',
             lang === 'es' ? 'Solo lavar' : 'Wash only',
             lang === 'es' ? 'Lavar + secar' : 'Wash + dry'],
      rows: loads.map(n => [`${n}`,
        money(n * 52 * wash * p, lang),
        money(n * 52 * (wash + dry) * p, lang)]),
    };
  },
  'led-vs-halogen': (lang) => {
    const p = rate(lang), h = 4;
    const bulbs = [5, 10, 20];
    const old = 50, led = 6;
    return {
      intro: lang === 'es'
        ? `Ahorro anual al cambiar halógenos de ${old} W por LED de ${led} W, con ${h} horas de uso al día, a ${rateLabel(lang)}.`
        : `Yearly saving from swapping ${old} W halogens for ${led} W LEDs, at ${h} hours a day, at ${rateLabel(lang)}.`,
      head: [lang === 'es' ? 'Bombillas' : 'Bulbs',
             lang === 'es' ? 'Halógeno' : 'Halogen',
             'LED', L[lang].save],
      rows: bulbs.map(n => {
        const o = n * old / 1000 * h * 365 * p, l = n * led / 1000 * h * 365 * p;
        return [`${n}`, money(o, lang), money(l, lang), money(o - l, lang)];
      }),
    };
  },
  'ev-charging': (lang) => {
    const p = rate(lang);
    const km = [5000, 10000, 20000], eff = [15, 18, 22];
    const unit = lang === 'es' ? 'km' : 'km';
    return {
      intro: lang === 'es'
        ? `Coste anual de cargar en casa según los kilómetros que hagas y lo que gaste el coche por cada 100 km, a ${rateLabel(lang)}.`
        : `Yearly home-charging cost by distance driven and how much the car uses per 100 km, at ${rateLabel(lang)}.`,
      head: [lang === 'es' ? 'Km al año' : 'Km per year', ...eff.map(e => `${e} kWh/100 ${unit}`)],
      rows: km.map(k => [k.toLocaleString(lang === 'es' ? 'es-ES' : 'en-US'),
        ...eff.map(e => money(k / 100 * e * p, lang))]),
    };
  },
  'heat-pump-vs-gas': (lang) => {
    const p = rate(lang);
    const demand = [6000, 10000, 15000], cop = [2.5, 3.5, 4.5];
    return {
      intro: lang === 'es'
        ? `Coste eléctrico anual de una bomba de calor según la demanda de calor de la casa y su rendimiento (COP), a ${rateLabel(lang)}. Un COP de 3,5 significa 3,5 kWh de calor por cada kWh eléctrico.`
        : `Yearly electricity cost of a heat pump by the home's heat demand and its efficiency (COP), at ${rateLabel(lang)}. A COP of 3.5 means 3.5 kWh of heat per kWh of electricity.`,
      head: [lang === 'es' ? 'Demanda de calor' : 'Heat demand', ...cop.map(c => `COP ${String(c).replace('.', lang === 'es' ? ',' : '.')}`)],
      rows: demand.map(d => [`${d.toLocaleString(lang === 'es' ? 'es-ES' : 'en-US')} kWh`,
        ...cop.map(c => money(d / c * p, lang))]),
    };
  },
  'solar-payback': (lang) => {
    const p = rate(lang);
    const kwp = [3, 5, 8], yields = [1000, 1300, 1600];
    return {
      intro: lang === 'es'
        ? `Valor anual de lo que genera una instalación solar, según su tamaño y el sol de tu zona, contando un 55% de autoconsumo (sin batería) a ${rateLabel(lang)}.`
        : `Yearly value of what a solar system generates, by size and how sunny your area is, counting 55% self-consumption (no battery) at ${rateLabel(lang)}.`,
      head: [lang === 'es' ? 'Instalación' : 'System', ...yields.map(y => `${y.toLocaleString(lang === 'es' ? 'es-ES' : 'en-US')} kWh/kWp`)],
      rows: kwp.map(k => [`${String(k).replace('.', ',')} kWp`,
        ...yields.map(y => money(k * y * 0.55 * p, lang))]),
    };
  },
};

function render(slug, lang) {
  const build = TABLES[slug]; if (!build) return null;
  const t = L[lang], d = build(lang);
  const head = d.head.map(h => `<th>${h}</th>`).join('');
  const body = d.rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('\n          ');
  return `      <h2>${t.h}</h2>
      <p>${d.intro}</p>
      <table>
        <thead><tr>${head}</tr></thead>
        <tbody>
          ${body}
        </tbody>
      </table>
      <p class="wf-chart-cap">${t.note}</p>`;
}

let n = 0;
for (const slug of Object.keys(TABLES)) {
  for (const lang of ['en', 'es']) {
    const file = path.join(ROOT, lang === 'es' ? 'es' : '', 'calculators', slug, 'index.html');
    if (!existsSync(file)) continue;
    let html = readFileSync(file, 'utf-8');
    const body = render(slug, lang);
    if (!body) continue;
    const marked = /(<!--\s*SCENARIOS:START\s*-->)([\s\S]*?)(<!--\s*SCENARIOS:END\s*-->)/;
    if (marked.test(html)) {
      html = html.replace(marked, (_m, a, _b, c) => `${a}\n${body}\n      ${c}`);
    } else {
      // Insert before the FAQ heading so it reads: how it works -> real numbers -> FAQ.
      // Function replacement, NOT a string: the table is full of "$186"-style
      // figures and "$1" in a replacement string is read as a backreference.
      const faq = /(\s*<h2 id="faq">)/;
      if (!faq.test(html)) { console.log(`  ! no FAQ anchor in ${slug} [${lang}]`); continue; }
      html = html.replace(faq, (_m, anchor) => `\n      <!-- SCENARIOS:START -->\n${body}\n      <!-- SCENARIOS:END -->\n${anchor}`);
    }
    writeFileSync(file, html, 'utf-8');
    n++;
  }
}
console.log(`scenario tables written: ${n} calculator pages`);
