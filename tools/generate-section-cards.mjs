/*
  generate-section-cards.mjs — restyles the calculator and guide index cards.

  The stock cards were identical grey boxes, each stamped with a "Calculators"
  chip that only repeated the page you were already on. This gives every entry
  its own line icon and drops the redundant chip, so the index can be scanned by
  shape instead of read line by line.

  Rewrites only the block between CARDS:START / CARDS:END, preserving each
  card's href, title and description — so it stays idempotent and the paginator
  can keep slicing the same list.

  Run:  node tools/generate-section-cards.mjs
*/
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// One drawing per page, keyed by slug (24×24, stroked).
const ICONS = {
  // calculators
  'electricity-cost': '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  'standby-power':    '<path d="M9 2v4M15 2v4"/><path d="M7 6h10v3a5 5 0 0 1-10 0z"/><path d="M12 14v6"/>',
  'ev-charging':      '<rect x="2" y="7" width="15" height="10" rx="2"/><path d="M21 10v4"/><path d="M10.5 9.5l-2 3h3l-2 3"/>',
  'air-conditioning': '<rect x="2.5" y="4" width="19" height="8" rx="2"/><path d="M5.5 9h13"/><path d="M7 15.5c1.5 1.6 1.5 3.2 0 4.8M12 15.5c1.5 1.6 1.5 3.2 0 4.8M17 15.5c1.5 1.6 1.5 3.2 0 4.8"/>',
  'heat-pump-vs-gas': '<path d="M8 15c2.2-2 2.2-4 0-6M12 15c2.2-2 2.2-4 0-6M16 15c2.2-2 2.2-4 0-6"/><path d="M3 20h18"/>',
  'led-vs-halogen':   '<path d="M9.5 18.5h5M10.5 21.5h3M12 2.5a7 7 0 0 0-4 12.7c.7.5 1.2 1.3 1.2 2.2h5.6c0-.9.5-1.7 1.2-2.2A7 7 0 0 0 12 2.5z"/>',
  'laundry-cost':     '<rect x="4.5" y="2.5" width="15" height="19" rx="2.2"/><circle cx="12" cy="14" r="4.4"/><path d="M7.6 6h.01M10.4 6h.01"/>',
  'solar-payback':    '<rect x="3" y="4" width="18" height="12" rx="1"/><path d="M3 8h18M3 12h18M9 4v12M15 4v12M12 16v6M8 22h8"/>',
  // guides
  'understanding-your-electricity-bill': '<path d="M6 2.5h12v19l-3-2-3 2-3-2-3 2z"/><path d="M9 7.5h6M9 11.5h6M9 15.5h3"/>',
  'how-to-cut-standby-power':            '<path d="M9 2v4M15 2v4"/><path d="M7 6h10v3a5 5 0 0 1-10 0z"/><path d="M12 14v6"/><path d="M3 3l18 18"/>',
  'time-of-use-tariffs-explained':       '<circle cx="12" cy="12" r="9"/><path d="M12 6.5V12l3.5 2.2"/>',
  'vampire-device-audit-checklist':      '<rect x="4" y="2.5" width="16" height="19" rx="2"/><path d="M8 8.5l1.6 1.6 3-3M8 15l1.6 1.6 3-3M15 9h2M15 15.5h2"/>',
  'heat-pump-vs-gas-boiler-running-cost':'<path d="M8 15c2.2-2 2.2-4 0-6M12 15c2.2-2 2.2-4 0-6M16 15c2.2-2 2.2-4 0-6"/><path d="M3 20h18"/>',
};
const FALLBACK = '<circle cx="12" cy="12" r="9"/><path d="M12 8v5l3 2"/>';

function icon(slug) {
  return '<span class="sc-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    + 'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[slug] || FALLBACK) + '</svg></span>';
}

/* The same photo the page uses as its hero, reused as the card's media band.
   Root-absolute because the paginator moves cards between pages and rewrites
   href but not src. Returns '' when there is no photo, and the card falls back
   to the icon-only layout. */
const HERO_EXTS = ['.webp', '.jpg', '.jpeg', '.png'];
function media(slug) {
  for (const ext of HERO_EXTS) {
    if (existsSync(path.join(ROOT, 'assets', 'img', 'heroes', slug + ext))) {
      return `<div class="card-media"><img src="/assets/img/heroes/${slug}${ext}" alt="" loading="lazy" width="1600" height="900"></div>`;
    }
  }
  return '';
}

// Pull href/title/description out of an existing card so nothing is invented.
function parseCard(html) {
  const href = (html.match(/href="([^"]+)"/) || [])[1];
  const title = (html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/) || [])[1];
  const desc = (html.match(/<p>([\s\S]*?)<\/p>/) || [])[1] || '';
  if (!href || !title) return null;
  return { href, title, desc };
}

// A closing action card. It lives AFTER the CARDS:END marker so the paginator
// never mistakes it for an article — and it squares off the grid (8 calculators
// + 1 = 9, 5 guides + 1 = 6), turning the ragged last row into a useful link.
const CTA = {
  calculators: {
    en: { href: '/estimator/', t: 'Not sure where to start?', d: 'Add up your whole home in one go and see where the money actually goes.', a: 'Open the estimator' },
    es: { href: '/es/estimator/', t: '¿No sabes por dónde empezar?', d: 'Suma tu casa entera de una vez y mira a dónde va de verdad el dinero.', a: 'Abrir el estimador' },
  },
  guides: {
    en: { href: '/calculators/', t: 'Put a number on it', d: 'Reading is one thing — run your own figures and see the cost for your home.', a: 'Browse the calculators' },
    es: { href: '/es/calculators/', t: 'Ponle un número', d: 'Leer está bien, pero echa tus propias cuentas y mira el coste en tu casa.', a: 'Ver las calculadoras' },
  },
};
function ctaCard(section, lang) {
  const c = CTA[section] && CTA[section][lang];
  if (!c) return '';
  return `\n      <!-- CTA:START -->\n`
    + `      <a class="card sec-card is-cta" href="${c.href}">`
    + `<div class="card-body"><div class="sc-top">`
    + `<span class="sc-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>`
    + `<h3 class="font-display">${c.t}</h3></div><p>${c.d}</p>`
    + `<span class="sc-cta">${c.a} →</span></div></a>\n      <!-- CTA:END -->`;
}

let pages = 0, cards = 0;
for (const section of ['calculators', 'guides']) {
  for (const lang of ['en', 'es']) {
    const dir = path.join(ROOT, lang === 'es' ? 'es' : '', section);
    if (!existsSync(dir)) continue;
    for (const sub of ['', 'page-2', 'page-3', 'page-4']) {
      const file = path.join(dir, sub, 'index.html');
      if (!existsSync(file)) continue;
      let html = readFileSync(file, 'utf-8');
      const m = html.match(/(<!--\s*CARDS:START\s*-->)([\s\S]*?)(<!--\s*CARDS:END\s*-->)/);
      if (!m) continue;
      const list = m[2].match(/<a class="card[^"]*"[\s\S]*?<\/a>/g) || [];
      if (!list.length) continue;
      const rebuilt = list.map(c => {
        const p = parseCard(c);
        if (!p) return c;
        const slug = p.href.replace(/^(\.\.\/)+/, '').replace(/\/$/, '').split('/').pop();
        const med = media(slug);
        // Icon paired with the title inside .sc-top so it centres against the
        // title instead of the whole text block — a two-line title used to
        // leave the icon stranded at the top with a hole under it.
        return `        <a class="card sec-card${med ? ' has-media' : ''}" href="${p.href}">${med}`
          + `<div class="card-body"><div class="sc-top">${icon(slug)}<h3 class="font-display">${p.title}</h3></div>`
          + `<p>${p.desc}</p></div></a>`;
      });
      cards += rebuilt.length;
      html = html.replace(m[0], () => `${m[1]}\n${rebuilt.join('\n')}\n      ${m[3]}`);
      // Drop any previous CTA, then re-add it on page 1 only.
      html = html.replace(/\s*<!--\s*CTA:START\s*-->[\s\S]*?<!--\s*CTA:END\s*-->/g, '');
      if (!sub) {
        html = html.replace(/(<!--\s*CARDS:END\s*-->)/, (_x, end) => end + ctaCard(section, lang));
      }
      writeFileSync(file, html, 'utf-8');
      pages++;
    }
  }
}
console.log(`section cards restyled: ${cards} cards across ${pages} index pages`);
