#!/usr/bin/env node
/*
  generate-pagination.mjs — slices each section's article cards into real
  page-2/ … URLs once it grows past PAGE_SIZE, adds a numbered page nav, and
  regenerates the section's ItemList JSON-LD. Reads sections from
  site.config.json. Run via `npm run build:pagination`.

  Idempotent by design: before cleaning old page-N/ folders it reconstructs the
  FULL card list from the section index PLUS the existing page-N pages (deduped
  by href, index order first). Earlier versions only read the index — which,
  after a first pagination pass, held just page 1, so every later build silently
  dropped articles 10+ from all listings. Never throws (bad section = warning).
*/
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(path.join(ROOT, 'site.config.json'), 'utf-8'));
// 12 divides evenly by the grid's 3 / 2 / 1 columns, so pages never end with
// an awkward half-empty row.
const PAGE_SIZE = 12;
const langs = cfg.languages && cfg.languages.length ? cfg.languages : ['en'];
const bases = langs.map((l, i) => (i === 0 ? '' : l + '/')); // '' canonical, 'es/' mirror
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Deepen every relative href/src by one directory level (page-N is one deeper).
function deepen(html) {
  return html.replace(/\b(href|src)="([^"]+)"/g, (m, attr, url) => {
    if (/^(https?:|mailto:|tel:|data:|#|\/)/.test(url)) return m;
    return `${attr}="../${url}"`;
  });
}
function cardsOf(html) {
  const m = html.match(/<!--\s*CARDS:START\s*-->([\s\S]*?)<!--\s*CARDS:END\s*-->/);
  if (!m) return null;
  // Tolerate extra classes on the card (e.g. "card appl-card is-high") — an
  // exact 'class="card"' match silently dropped every restyled card.
  return m[1].match(/<a class="card[^"]*"[\s\S]*?<\/a>/g) || [];
}
const hrefOf = card => { const m = card.match(/href="([^"]+)"/); return m ? m[1].replace(/^(\.\.\/)+/, '') : ''; };
const titleOf = card => {
  const m = card.match(/<h3[^>]*>([\s\S]*?)<\/h3>/);
  return m ? m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim() : '';
};

function setCards(html, cards) {
  // Function replacement: card blurbs can contain "$" (e.g. "$28/year"), which a
  // string replacement would mis-read as $1/$2 backreferences and corrupt.
  const body = cards.join('\n');
  return html.replace(/(<!--\s*CARDS:START\s*-->)[\s\S]*?(<!--\s*CARDS:END\s*-->)/,
    (_m, p1, p2) => `${p1}\n${body}\n      ${p2}`);
}
function setPagenav(html, items) {
  if (!/<!--\s*PAGENAV:START\s*-->/.test(html)) return html; // older sites without the marker
  return html.replace(/(<!--\s*PAGENAV:START\s*-->)[\s\S]*?(<!--\s*PAGENAV:END\s*-->)/,
    `$1\n${items}\n      $2`);
}
function pagenavHtml(total, current, hrefFor) {
  if (total <= 1) return '';
  const parts = [];
  if (current > 1) parts.push(`      <a href="${hrefFor(current - 1)}" rel="prev" aria-label="Previous page">‹</a>`);
  for (let k = 1; k <= total; k++) {
    parts.push(k === current
      ? `      <span aria-current="page">${k}</span>`
      : `      <a href="${hrefFor(k)}">${k}</a>`);
  }
  if (current < total) parts.push(`      <a href="${hrefFor(current + 1)}" rel="next" aria-label="Next page">›</a>`);
  return parts.join('\n');
}
function setItemList(html, sectionUrl, cards) {
  if (!/data-itemlist/.test(html)) return html; // older sites without the block
  const items = cards.map((c, i) => ({
    '@type': 'ListItem', position: i + 1,
    url: sectionUrl + hrefOf(c), name: titleOf(c) || hrefOf(c),
  }));
  const json = JSON.stringify({ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: items }, null, 2)
    .replace(/<\//g, '<\\/'); // never emit a literal </script> inside the tag
  const block = `\n  ${json.split('\n').join('\n  ')}\n  `;
  // Function replacement so any "$" in a card title cannot become a backreference.
  return html.replace(/(<script type="application\/ld\+json" data-itemlist>)[\s\S]*?(<\/script>)/,
    (_m, p1, p2) => `${p1}${block}${p2}`);
}
// Point a page-N shell's canonical, hreflang alternates and og:url at page-N.
function repointUrls(html, domain, base, secSlug, pageNo) {
  return html
    .replace(new RegExp(`(<link rel="canonical" href="https://${escRe(domain)}/${escRe(base)}${escRe(secSlug)}/)(")`), `$1page-${pageNo}/$2`)
    .replace(new RegExp(`(<link rel="alternate" hreflang="[^"]+" href="https://${escRe(domain)}/(?:es/)?${escRe(secSlug)}/)(")`, 'g'), `$1page-${pageNo}/$2`)
    .replace(new RegExp(`(<meta property="og:url" content="https://${escRe(domain)}/${escRe(base)}${escRe(secSlug)}/)(")`), `$1page-${pageNo}/$2`);
}
// Reverse of deepen(): strip ONE ../ from relative URLs (cards read back from page-N/).
function undeepen(fragment) {
  return fragment.replace(/\b(href|src)="\.\.\//g, '$1="');
}

// Deduplicate page-N metas (breachfolio fix, 2026-07-15): page-2+ would
// otherwise ship the exact title/description of page 1.
const PAGE_WORD = { en: 'Page', es: 'Página' };
function suffixMeta(html, pageNo, lang) {
  const suffix = ` — ${PAGE_WORD[lang] || PAGE_WORD.en} ${pageNo}`;
  return html
    .replace(/(<title>)([^<]*?)( \| [^|<]*)?(<\/title>)/, (m, a, t, brand, b) => a + t + suffix + (brand || '') + b)
    .replace(/(<meta name="description" content=")([^"]*)(")/, `$1$2${suffix}$3`)
    .replace(/(<meta property="og:title" content=")([^"]*?)( \| [^|"]*)?(")/, (m, a, t, brand, b) => a + t + suffix + (brand || '') + b)
    .replace(/(<meta property="og:description" content=")([^"]*)(")/, `$1$2${suffix}$3`)
    .replace(/(<meta name="twitter:title" content=")([^"]*?)( \| [^|"]*)?(")/, (m, a, t, brand, b) => a + t + suffix + (brand || '') + b)
    .replace(/(<meta name="twitter:description" content=")([^"]*)(")/, `$1$2${suffix}$3`);
}

for (let bi = 0; bi < bases.length; bi++) {
  const base = bases[bi];
  const pageLang = langs[bi] || 'en';
  for (const sec of cfg.sections || []) {
    try {
      const secDir = path.join(ROOT, base, sec.slug);
      const idxPath = path.join(secDir, 'index.html');
      if (!existsSync(idxPath)) continue;

      // 1. Reconstruct the full, ordered card list: index first (newest are
      //    prepended there), then existing page-2..N, deduped by href.
      const idxHtml = readFileSync(idxPath, 'utf-8');
      const idxCards = cardsOf(idxHtml);
      if (idxCards === null) continue; // no CARDS markers — not a section index
      const pageDirs = readdirSync(secDir, { withFileTypes: true })
        .filter(e => e.isDirectory() && /^page-\d+$/.test(e.name))
        .sort((a, b) => parseInt(a.name.slice(5), 10) - parseInt(b.name.slice(5), 10));
      const seen = new Set();
      const all = [];
      const take = (cards, fromPageN) => {
        for (let c of cards) {
          if (fromPageN) c = undeepen(c);
          const h = hrefOf(c);
          if (h && !seen.has(h)) { seen.add(h); all.push(c); }
        }
      };
      take(idxCards, false);
      for (const d of pageDirs) {
        const p = path.join(secDir, d.name, 'index.html');
        if (existsSync(p)) take(cardsOf(readFileSync(p, 'utf-8')) || [], true);
      }

      // 2. Clean previous page-N/ (they get rebuilt from `all`).
      for (const d of pageDirs) rmSync(path.join(secDir, d.name), { recursive: true, force: true });

      const pages = [];
      for (let i = 0; i < all.length; i += PAGE_SIZE) pages.push(all.slice(i, i + PAGE_SIZE));
      if (!pages.length) pages.push([]);
      const total = pages.length;
      const sectionUrl = `https://${cfg.domain}/${base}${sec.slug}/`;

      // 3. Page 1 = the section index: its slice, full ItemList, nav.
      let page1 = setCards(idxHtml, pages[0]);
      page1 = setItemList(page1, sectionUrl, all);
      page1 = setPagenav(page1, pagenavHtml(total, 1, k => (k === 1 ? './' : `page-${k}/`)));
      writeFileSync(idxPath, page1, 'utf-8');

      // 4. Pages 2..N as section/page-N/index.html (built from the index shell).
      for (let p = 2; p <= total; p++) {
        const dir = path.join(secDir, 'page-' + p);
        mkdirSync(dir, { recursive: true });
        let shell = deepen(idxHtml);
        shell = repointUrls(shell, cfg.domain, base, sec.slug, p);
        shell = suffixMeta(shell, p, pageLang);
        shell = setCards(shell, pages[p - 1].map(c => deepen(c)));
        shell = setItemList(shell, sectionUrl, pages[p - 1]);
        shell = setPagenav(shell, pagenavHtml(total, p, k => (k === 1 ? '../' : `../page-${k}/`)));
        writeFileSync(path.join(dir, 'index.html'), shell, 'utf-8');
      }
      if (total > 1) console.log(`pagination: ${base}${sec.slug} → ${total} pages (${all.length} articles)`);
    } catch (err) {
      console.warn(`pagination: skipped ${base}${sec.slug} (${err.message})`);
    }
  }
}
