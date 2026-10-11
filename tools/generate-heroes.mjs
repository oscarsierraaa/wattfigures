#!/usr/bin/env node
/*
  generate-heroes.mjs — adopt hero images for guides and calculators.

  Guides and calculators ship without a hero image: the alternative was a stock
  photo or a generated gradient, and both read as filler. So the slot stays
  empty until a real image exists, and this tool wires it in.

  Drop a file at  assets/img/heroes/<slug>.webp  (or .jpg/.png), run the build,
  and for every language of that page it:
    · inserts a <figure class="article-hero"> right after the lead paragraph,
      which is where Discover and Pinterest want a large image;
    · repoints og:image / twitter:image at it, so the page stops sharing the
      generic og-default.png.

  Slug = the page folder name (guides/how-to-cut-standby-power → how-to-cut-standby-power).
  Idempotent: the figure lives between HERO:START / HERO:END and is rewritten,
  never stacked. Removing the file removes the figure on the next run.

  Run:  node tools/generate-heroes.mjs
*/
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COUNTRY_PAGES, countrySlug } from './country-pages.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HERO_DIR = path.join(ROOT, 'assets', 'img', 'heroes');
const EXTS = ['.webp', '.jpg', '.jpeg', '.png'];
// Sections whose pages can carry a hero. Guides and calculators key off the
// bare folder name — that convention predates this and the 13 delivered images
// depend on it. electricity-prices arrived later, has a page at its own root
// *and* one below it (us-states), and a bare "us-states.png" would say nothing
// about where it belongs — so its slugs are prefixed. That also keeps
// _originals/images/ flat, with no subfolders to mirror.
const SECTIONS = ['guides', 'calculators', 'electricity-prices'];
const PREFIXED = new Set(['electricity-prices']);

const cfg = JSON.parse(readFileSync(path.join(ROOT, 'site.config.json'), 'utf-8'));

/* The 14 country heroes carry a flag graphic pasted in the bottom-right corner,
   and that corner is exactly what the desktop crop eats: .article-hero img goes
   to 21:9 above 700px, which over a 16:9 source removes 12% off the top and 12%
   off the bottom. Measured on the delivered set, every flag ends between 91%
   and 99% of the image height, so all fourteen lost something and four lost
   enough to matter — Spain became a red/yellow bicolour, Germany black/red,
   the Netherlands red/white, and the United Kingdom lost 53% of the Union Jack.

   Asking the image model for more clearance did not work: the brief for the
   United Kingdom said so in as many words on 2026-07-28 and the flag still
   came back 12px from the edge. So the crop moves instead of the photo — these
   pages anchor it to the bottom, which is the only value that saves all
   fourteen (France ends at 98.9%, so anything short of the bottom clips it).

   Marked here rather than in the CSS because this file is the only place that
   knows which heroes are country heroes. Guides and calculators must not get
   it: they have no flag, and shifting them down would only crop their subject. */
const FLAGGED = new Set(
  JSON.parse(readFileSync(path.join(ROOT, 'data', 'energy-prices.json'), 'utf-8'))
    .countries.filter(c => COUNTRY_PAGES.includes(c.code))
    .map(c => `electricity-prices-${countrySlug(c.name)}`)
);

/* Alt text has to describe the image, and the only per-page string we can trust
   is the <h1> — the file name is a slug and the title is SEO-shaped. */
const h1Of = html => {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  return m ? m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '';
};

function heroFile(slug) {
  for (const ext of EXTS) if (existsSync(path.join(HERO_DIR, slug + ext))) return slug + ext;
  return null;
}

function pagesFor(section) {
  const out = [];
  for (const pfx of ['', 'es']) {
    const dir = path.join(ROOT, pfx, section);
    if (!existsSync(dir)) continue;
    // A prefixed section's own index is an article, so it can carry a hero.
    // The guides/ and calculators/ indexes are listings and stay out.
    if (PREFIXED.has(section) && existsSync(path.join(dir, 'index.html'))) {
      out.push({ slug: section, file: path.join(dir, 'index.html') });
    }
    for (const name of readdirSync(dir)) {
      const file = path.join(dir, name, 'index.html');
      if (name !== 'index.html' && statSync(path.join(dir, name)).isDirectory() && existsSync(file)) {
        out.push({ slug: PREFIXED.has(section) ? `${section}-${name}` : name, file });
      }
    }
  }
  return out;
}

const MARKED = /(\s*<!--\s*HERO:START\s*-->)[\s\S]*?(<!--\s*HERO:END\s*-->)/;

// `wired` is the state (pages that end the run with a hero), `changed` is what
// this run actually rewrote. Reporting only the latter made a no-op rebuild
// print "0 wired" while 26 pages had heroes — a log that lies about state.
let wired = 0, changed = 0, removed = 0;
for (const section of SECTIONS) {
  for (const { slug, file } of pagesFor(section)) {
    const img = heroFile(slug);
    let html = readFileSync(file, 'utf-8');
    const before = html;

    if (img) {
      const src = `/assets/img/heroes/${img}`;
      const alt = h1Of(html);
      const fig = `      <figure class="article-hero${FLAGGED.has(slug) ? ' has-flag' : ''}">\n`
        + `        <img src="${src}" alt="${alt.replace(/"/g, '&quot;')}" width="1600" height="900" loading="eager" fetchpriority="high">\n`
        + `      </figure>`;
      const block = `\n      <!-- HERO:START -->\n${fig}\n      <!-- HERO:END -->`;

      if (MARKED.test(html)) {
        html = html.replace(MARKED, () => block);
      } else {
        // After the lead paragraph — above the disclaimer callout when there is
        // one, so the image is the first thing under the title and byline.
        const lead = /<p class="lead"[^>]*>[\s\S]*?<\/p>/;
        if (!lead.test(html)) { console.log(`  ! no lead paragraph in ${section}/${slug}`); continue; }
        html = html.replace(lead, m => `${m}\n${block}`);
      }

      // Social cards: point at the real image instead of og-default.png.
      const abs = `https://${cfg.domain}${src}`;
      html = html.replace(/(<meta property="og:image" content=")[^"]*(")/, (_m, a, b) => a + abs + b);
      html = html.replace(/(<meta name="twitter:image" content=")[^"]*(")/, (_m, a, b) => a + abs + b);
      wired++;
      if (before !== html) changed++;
    } else {
      // No image any more: drop the figure AND put the social cards back on the
      // default, or the page keeps advertising a file that no longer exists.
      if (MARKED.test(html)) { html = html.replace(MARKED, ''); removed++; }
      const dflt = `https://${cfg.domain}/assets/img/og-default.png`;
      const stale = new RegExp(`(<meta (?:property="og:image"|name="twitter:image") content=")https://${cfg.domain}/assets/img/heroes/[^"]*(")`, 'g');
      html = html.replace(stale, (_m, a, b) => a + dflt + b);
    }

    if (html !== before) writeFileSync(file, html, 'utf-8');
  }
}
console.log(`heroes: ${wired} page(s) have a hero`
  + (changed ? ` (${changed} rewritten)` : '')
  + (removed ? `, ${removed} cleared` : '')
  + (wired ? '' : ' — drop files in assets/img/heroes/<slug>.webp (see IMAGENES.md)'));
