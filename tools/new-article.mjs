#!/usr/bin/env node
/*
  new-article.mjs — create an article page (any archetype) and wire its card
  into the section index. Run from a generated site.

    node tools/new-article.mjs --section guides --slug how-to-x --title "How to X"
        [--type guide|howto|compare|recipe|checklist|calculator]
        [--title-es "Cómo hacer X"] [--desc "…"] [--desc-es "…"]
        [--keywords "a, b"] [--image my-hero.webp] [--date 2026-07-14]
        [--faq "Question? :: Answer."]... [--faq-es "¿Pregunta? :: Respuesta."]...

  Types map to templates/article*.html:
    guide      → article.html            (default; Article/TechArticle + FAQ)
    howto      → article-howto.html      (HowTo schema with steps)
    compare    → article-compare.html    (comparison table + ItemList — the
                                          highest-RPM archetype)
    recipe     → article-recipe.html     (Recipe schema — meal prep sites)
    checklist  → article-checklist.html  (printable list — Pinterest bait)
    calculator → article-calculator.html (live widget via assets/calc.js)
*/
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { renderFile } from './template-engine.mjs';
import { uiStrings, localizeSections, sectionLabel, ogLocale, langFlags, disclaimerBlock } from './site-i18n.mjs';
import { buildFlags, buildBase } from './site-context.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const templatesDir = path.join(ROOT, 'templates');
const cfg = JSON.parse(readFileSync(path.join(ROOT, 'site.config.json'), 'utf-8'));

const args = process.argv.slice(2);
const get = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const getAll = n => { const out = []; for (let i = 0; i < args.length - 1; i++) if (args[i] === n) out.push(args[i + 1]); return out; };

const TYPES = { guide: 'article.html', howto: 'article-howto.html', compare: 'article-compare.html', recipe: 'article-recipe.html', checklist: 'article-checklist.html', calculator: 'article-calculator.html' };

const sectionSlug = get('--section');
const slug = get('--slug');
const title = get('--title');
const type = get('--type', 'guide');
if (!sectionSlug || !slug || !title) { console.error('Required: --section <slug> --slug <slug> --title "Title"'); process.exit(1); }
if (!TYPES[type]) { console.error(`Unknown --type "${type}". Types: ${Object.keys(TYPES).join(', ')}`); process.exit(1); }

const titleEs = get('--title-es', title);
const desc = get('--desc', title + ' — a practical guide.');
const descEs = get('--desc-es', get('--title-es') ? titleEs + ' — guía práctica.' : desc);
const keywords = get('--keywords', '');
const image = get('--image', 'og-default.png');
const date = get('--date', new Date().toISOString().slice(0, 10));

const section = (cfg.sections || []).find(s => s.slug === sectionSlug);
if (!section) { console.error(`Unknown section "${sectionSlug}". Known: ${(cfg.sections || []).map(s => s.slug).join(', ')}`); process.exit(1); }

const langs = cfg.languages; const sections = cfg.sections;
const flags = buildFlags(cfg);
const base = buildBase(cfg);
const articleType = base.ARTICLE_TYPE;

// ── FAQ (variable count; ≥2 recommended for the FAQ rich result) ────────────
const parseFaq = raw => raw.map(s => { const i = s.indexOf('::'); return i < 0 ? [s.trim(), '[EDIT: answer]'] : [s.slice(0, i).trim(), s.slice(i + 2).trim()]; });
const FAQ_DEFAULT = {
  en: [['[EDIT: real question people search?]', '[EDIT: a direct, complete answer — 40–60 words.]'], ['[EDIT: second question?]', '[EDIT: answer.]']],
  es: [['[EDITAR: ¿pregunta real que busca la gente?]', '[EDITAR: respuesta directa y completa — 40–60 palabras.]'], ['[EDITAR: ¿segunda pregunta?]', '[EDITAR: respuesta.]']],
};
const faqByLang = {
  en: getAll('--faq').length ? parseFaq(getAll('--faq')) : FAQ_DEFAULT.en,
  es: getAll('--faq-es').length ? parseFaq(getAll('--faq-es')) : (getAll('--faq').length ? parseFaq(getAll('--faq')) : FAQ_DEFAULT.es),
};
const faqJsonld = faq => faq.map(([q, a]) =>
  `{ "@type": "Question", "name": ${JSON.stringify(q)}, "acceptedAnswer": { "@type": "Answer", "text": ${JSON.stringify(a)} } }`
).join(',\n        ');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const faqHtml = faq => faq.map(([q, a]) =>
  `<details class="faq-item"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`
).join('\n      ');

const rel = d => (d === 0 ? '' : '../'.repeat(d));

for (const lang of langs) {
  const isEs = lang === 'es';
  const pfx = isEs ? 'es/' : '';
  const depth = isEs ? 3 : 2;
  const pageTitle = isEs ? titleEs : title;
  const pageDesc = isEs ? descEs : desc;
  const canonical = `https://${cfg.domain}/${pfx}${sectionSlug}/${slug}/`;
  const faq = faqByLang[isEs ? 'es' : 'en'];
  const pageScripts = type === 'calculator' ? `  <script src="${rel(depth)}assets/calc.js" defer></script>\n` : '';

  const ctx = Object.assign({}, base, uiStrings(lang), {
    REL: rel(depth), HOME: rel(depth) + pfx,
    LANG_ATTR: lang, LANG_UPPER: lang.toUpperCase(), LANG_OTHER: isEs ? 'EN' : 'ES', LANG_PREFIX: pfx,
    CANONICAL: canonical,
    HREF_EN: `https://${cfg.domain}/${sectionSlug}/${slug}/`,
    HREF_ES: `https://${cfg.domain}/es/${sectionSlug}/${slug}/`,
    OG_LOCALE: ogLocale(lang),
    TAGLINE: (isEs && cfg.tagline_es) || cfg.tagline || '',
    PAGE_TITLE: pageTitle, PAGE_DESC: pageDesc, PAGE_KEYWORDS: keywords,
    SECTION_SLUG: sectionSlug, SECTION_LABEL: sectionLabel(section, lang),
    OG_TYPE: 'article', OG_IMAGE: image, PAGE_SCRIPTS: pageScripts,
    DATE_PUBLISHED: date, DATE_MODIFIED: date,
    DISCLAIMER_BLOCK: disclaimerBlock(cfg.disclaimer, lang),
    FAQ_JSONLD: faqJsonld(faq), FAQ_HTML: faqHtml(faq),
    SHARE_URL: encodeURIComponent(canonical),
    SHARE_TITLE: encodeURIComponent(pageTitle),
    SHARE_MEDIA: encodeURIComponent(`https://${cfg.domain}/assets/img/${image}`),
  });

  const html = renderFile(TYPES[type], ctx, {
    templatesDir,
    flags: Object.assign({}, flags, langFlags(lang)),
    sections: localizeSections(sections, lang),
  });
  const dest = path.join(ROOT, pfx, sectionSlug, slug, 'index.html');
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, html, 'utf-8');

  // Prepend the card (newest first) into the section index; pagination and the
  // ItemList JSON-LD are rebuilt from these cards on `npm run build`.
  const idxPath = path.join(ROOT, pfx, sectionSlug, 'index.html');
  if (existsSync(idxPath)) {
    let idx = readFileSync(idxPath, 'utf-8');
    const media = image !== 'og-default.png'
      ? `<div class="card-media"><img src="${rel(depth - 1)}assets/img/${esc(image)}" alt="" loading="lazy"></div>` : '';
    const card = `        <a class="card" href="${slug}/">${media}<div class="card-body"><div class="chip">${esc(sectionLabel(section, lang))}</div><h3 class="font-display">${esc(pageTitle)}</h3><p>${esc(pageDesc)}</p></div></a>\n`;
    if (idx.includes('<!-- CARDS:START -->') && !idx.includes(`href="${slug}/"`)) {
      idx = idx.replace(/<!--\s*CARDS:START\s*-->\n?/, m => m + card);
      writeFileSync(idxPath, idx, 'utf-8');
    }
  }
  console.log(`  + ${path.relative(ROOT, dest)}  (${type}, ${lang})`);
}

console.log(`\nArticle scaffolded. Now:`);
console.log(`  1. Write ≥800 original words in EACH language (the ES page is not a machine copy — retitle with --title-es next time if you skipped it).`);
if (type === 'howto' || type === 'recipe' || type === 'compare') {
  console.log(`  2. Keep the ${type === 'compare' ? 'ItemList' : type === 'recipe' ? 'Recipe' : 'HowTo'} JSON-LD in sync with the visible ${type === 'recipe' ? 'ingredients/steps' : type === 'howto' ? 'steps' : 'options'}.`);
}
console.log(`  ${type === 'guide' || type === 'checklist' || type === 'calculator' ? '2' : '3'}. Replace the FAQ placeholders, add a real ≥1200px hero image, then npm run build.`);
