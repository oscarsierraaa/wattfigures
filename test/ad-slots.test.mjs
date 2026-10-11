/*
  The ad container has to reach the pages worth monetising.

  Before this suite existed, templates/partials/ad-slot.html was included from
  the article*.html templates only, and of those only article-appliance.html is
  re-rendered by a generator. The day adsense.publisherId gets filled in, that
  arrangement would have put an ad on the 60 appliance pages and on nothing
  else — the calculators, the pages with the most commercial intent on the
  site, would have received none, permanently and silently.

  Two failure modes are guarded here, both silent by nature:

    1. A template that renders a full article stops including the partial.
    2. A hand-written page loses the <h2 id="faq"> anchor that
       tools/inject-ad-slots.mjs keys on, so the tool skips it and the page
       quietly ships without a slot.

  Neither shows up in a build log or in a diff, which is why they are tests.

  Run: node --test
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(path.join(root, 'site.config.json'), 'utf-8'));
const langs = cfg.languages || ['en'];

/* Templates that render a full article and therefore owe the reader a slot.
   The exclusions are deliberate, not oversights: the home is a hero plus a
   calculator with no article body, section indexes are link lists, and putting
   ads on legal pages is a policy risk for no traffic. */
const MUST_INCLUDE = [
  'article.html', 'article-appliance.html', 'article-calculator.html',
  'article-checklist.html', 'article-compare.html', 'article-howto.html',
  'article-recipe.html', 'country-page.html', 'prices-page.html',
  'us-states-page.html',
];
const MUST_NOT_INCLUDE = ['home.html', 'legal-page.html', 'section-index.html', 'blog-index.html'];

// Kept in step with SECTIONS in tools/inject-ad-slots.mjs.
const HAND_MAINTAINED = ['calculators', 'guides', 'estimator'];

function handMaintainedPages() {
  const out = [];
  for (const lang of langs) {
    const prefix = lang === 'en' ? '' : `${lang}/`;
    for (const sec of HAND_MAINTAINED) {
      const dir = path.join(root, prefix, sec);
      if (!existsSync(dir)) continue;
      if (sec === 'estimator') { out.push(`${prefix}estimator/index.html`); continue; }
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) out.push(`${prefix}${sec}/${e.name}/index.html`);
      }
    }
  }
  return out;
}

test('every template that renders an article includes the ad slot partial', () => {
  for (const name of MUST_INCLUDE) {
    const file = path.join(root, 'templates', name);
    assert.ok(existsSync(file), `${name} is missing from templates/`);
    assert.match(
      readFileSync(file, 'utf-8'),
      /<!--\s*INCLUDE:partials\/ad-slot\.html\s*-->/,
      `templates/${name} renders a full article but never includes partials/ad-slot.html — ` +
      'pages built from it would ship with no ad container'
    );
  }
});

test('templates that deliberately carry no ads still carry none', () => {
  for (const name of MUST_NOT_INCLUDE) {
    const file = path.join(root, 'templates', name);
    if (!existsSync(file)) continue;
    assert.doesNotMatch(
      readFileSync(file, 'utf-8'),
      /ad-slot\.html|adsbygoogle/,
      `templates/${name} is on the no-ads list but references an ad slot`
    );
  }
});

test('every hand-maintained article keeps the anchor inject-ad-slots keys on', () => {
  const pages = handMaintainedPages();
  assert.ok(pages.length >= 38, `expected at least 38 hand-maintained pages, found ${pages.length}`);
  for (const rel of pages) {
    const html = readFileSync(path.join(root, rel), 'utf-8');
    const hits = html.match(/^[ \t]*<h2 id="faq">/gm) || [];
    assert.equal(
      hits.length, 1,
      `${rel} has ${hits.length} <h2 id="faq"> headings, expected exactly 1 — ` +
      'tools/inject-ad-slots.mjs inserts the ad container immediately before it, ' +
      'so zero means the page silently ships without one'
    );
  }
});

/* The publisher id is the single switch. While it is empty nothing may carry ad
   markup — a hand-pasted <ins class="adsbygoogle"> would load ads without the
   CSP allowing it and without the EEA consent message, which is the one way
   this site could serve an ad it is not allowed to serve. */
test('with no publisher id configured, no published page carries ad markup', () => {
  const publisherId = ((cfg.adsense || {}).publisherId || '').trim();
  if (publisherId) return; // AdSense is live; this invariant no longer applies.

  const offenders = [];
  const SKIP = new Set(['node_modules', '_pagefind', 'graphify-out', '_originals', '.git', 'docs', 'n8n', 'supabase', 'templates', 'test', 'tools']);
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.html') && /adsbygoogle/.test(readFileSync(p, 'utf-8'))) {
        offenders.push(path.relative(root, p).replace(/\\/g, '/'));
      }
    }
  };
  walk(root);
  assert.deepEqual(offenders, [], `ad markup published while adsense.publisherId is empty: ${offenders.join(', ')}`);
});
