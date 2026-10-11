/*
  inject-ad-slots.mjs — puts the in-article ad container into the pages that no
  generator owns.

  Why this exists: templates/partials/ad-slot.html is included from the
  article*.html templates, and of those only article-appliance.html gets
  re-rendered by a generator. The calculators, guides and estimator were laid
  down by scaffold.mjs once — and scaffold must never run again (see
  LAUNCH-CHECKLIST §5) — so the day adsense.publisherId is filled in, `npm run
  build` would put an ad on the 60 appliance pages and on nothing else. The
  calculators are the pages with the most commercial intent on the site and
  would have received nothing, permanently.

  What it does: rewrites only the block between AD:START / AD:END, immediately
  before the FAQ heading — the same position the templates use — so it is
  idempotent and safe to run on every build.

  The markup is not written here. It is rendered from the same partial the
  templates include, through the same pipeline, so the two can never drift.

  When adsense.publisherId (or adsense.slots.inArticle) is empty the flag is
  off, the partial renders empty, and this tool *removes* the block instead of
  writing one. That is the current state: running it today is a no-op.

  Run:  node tools/inject-ad-slots.mjs
*/
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderString } from './template-engine.mjs';
import { buildFlags, buildBase } from './site-context.mjs';
import { uiStrings } from './site-i18n.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const templatesDir = path.join(ROOT, 'templates');
const cfg = JSON.parse(readFileSync(path.join(ROOT, 'site.config.json'), 'utf-8'));

const START = '<!-- AD:START -->';
const END = '<!-- AD:END -->';

/* The heading every hand-maintained page ends its body with. Checked across all
   38 targets before this tool was written: exactly one occurrence each. If a
   new page ever lacks it, the page is skipped and reported rather than guessed
   at — a misplaced ad unit is worse than a missing one. */
const ANCHOR = /^[ \t]*<h2 id="faq">/m;

/* Must be the exact inverse of the insertion below, trailing blank line
   included. If it swallows one newline too few or too many, strip-then-insert
   stops being a fixpoint and every build grows the file by a blank line.

   \r?\n throughout, and the inserted block reuses whatever the file already
   uses: CI runs on Linux with LF, but core.autocrlf hands a Windows checkout
   CRLF, and an LF-only regex silently fails to match there — which is the same
   growing-file bug wearing a different hat. */
const BLOCK = new RegExp(
  `[ \\t]*${START}[\\s\\S]*?${END}(?:\\r?\\n)?(?:\\r?\\n)?`, 'g');

/* Sections whose pages no generator rewrites. The home is deliberately absent:
   it is a hero plus a calculator with no article body, and an in-article fluid
   unit has nowhere to sit there. Legal pages are absent on purpose too. */
const SECTIONS = ['calculators', 'guides', 'estimator'];

function targets() {
  const out = [];
  for (const lang of cfg.languages || ['en']) {
    const prefix = lang === 'en' ? '' : `${lang}/`;
    for (const sec of SECTIONS) {
      const secDir = path.join(ROOT, prefix, sec);
      if (!existsSync(secDir)) continue;
      // The estimator is a single page; the others are one directory per
      // article. Section indexes (calculators/index.html) sit at the section
      // root and are skipped by only descending into directories.
      if (sec === 'estimator') {
        out.push({ rel: `${prefix}estimator/index.html`, lang });
        continue;
      }
      for (const e of readdirSync(secDir, { withFileTypes: true })) {
        if (!e.isDirectory()) continue;
        out.push({ rel: `${prefix}${sec}/${e.name}/index.html`, lang });
      }
    }
  }
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

/* Render the partial exactly as a template would, per language, and re-indent it
   to sit inside <article>. Relative depth is preserved rather than flattened, so
   an injected block is byte-identical to the one article-appliance.html emits.
   Returns '' when the adslot flag is off, which drives the removal branch. */
function renderSlot(lang) {
  const flags = buildFlags(cfg);
  const ctx = { ...buildBase(cfg), ...uiStrings(lang) };
  const src = readFileSync(path.join(templatesDir, 'partials', 'ad-slot.html'), 'utf-8');
  const out = renderString(src, ctx, { templatesDir, flags, sections: [] });
  const lines = out.split('\n').filter(l => l.trim());
  if (!lines.length) return '';
  const base = Math.min(...lines.map(l => l.match(/^[ \t]*/)[0].length));
  return lines.map(l => '      ' + l.slice(base)).join('\n');
}

function main() {
  const slotByLang = new Map();
  let written = 0, cleared = 0, skipped = 0, unchanged = 0;

  for (const { rel, lang } of targets()) {
    const abs = path.join(ROOT, rel);
    if (!existsSync(abs)) continue;
    const before = readFileSync(abs, 'utf-8');

    if (!slotByLang.has(lang)) slotByLang.set(lang, renderSlot(lang));
    const slot = slotByLang.get(lang);

    // Always strip first: that is what makes a second run a no-op, and what
    // pulls the block back out if the publisher id is ever removed.
    let after = before.replace(BLOCK, '');

    if (slot) {
      if (!ANCHOR.test(after)) {
        console.warn(`  skip (no <h2 id="faq">): ${rel}`);
        skipped++;
        continue;
      }
      const nl = before.includes('\r\n') ? '\r\n' : '\n';
      const body = slot.split('\n').join(nl);
      after = after.replace(ANCHOR, m =>
        `      ${START}${nl}${body}${nl}      ${END}${nl}${nl}${m}`);
    }

    if (after === before) { unchanged++; continue; }
    writeFileSync(abs, after);
    if (slot) written++; else cleared++;
  }

  const state = buildFlags(cfg).adslot ? 'on' : 'off (adsense.publisherId / slots.inArticle empty)';
  console.log(`ad slots ${state} — ${written} written, ${cleared} removed, ${unchanged} already correct, ${skipped} skipped`);
}

main();
