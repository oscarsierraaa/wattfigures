#!/usr/bin/env node
/*
  inject-lang-switch.mjs — the header's EN<->ES control was a <button> that
  only worked after JavaScript ran (it read the page's own hreflang <link>
  and did location.href on click). That means 0 crawlable <a> links between
  the English and Spanish halves of the site: 78 /es/ pages hung off
  hreflang and the sitemap only, with no navigational path a crawler (or a
  JS-disabled reader) could follow. Fixed in the audit of 30-07-2026.

  This walks every already-rendered HTML file (generated and hand-authored
  alike — guides/, legal/ and calculators/ are hand-frozen and never pass
  through a template generator, so the fix has to live here, not in
  templates/partials/nav.html) and turns the button into a real <a href>,
  using the href from the page's own reciprocal hreflang <link> — the exact
  same pair Google already trusts. No dictionary, no guessing.

  Idempotent: a page whose control is already an <a> is left alone.

  Run:  node tools/inject-lang-switch.mjs (wired into `npm run build`)
*/
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '_pagefind', 'graphify-out', '_originals', '.git', 'docs', 'n8n', 'supabase', 'templates', 'tools']);

function htmlFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) htmlFiles(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

const BUTTON = /<button class="chrome-btn" id="lang-toggle" type="button" aria-label="Language">(EN|ES)<\/button>/;
const ALREADY_LINK = /<a class="chrome-btn" id="lang-toggle"/;

let files = 0, converted = 0, skippedNoCounterpart = 0;
for (const file of htmlFiles(ROOT)) {
  const html = readFileSync(file, 'utf-8');
  const m = html.match(BUTTON);
  if (!m || ALREADY_LINK.test(html)) continue;
  const wantHreflang = m[1].toLowerCase(); // button says "ES" on an EN page and vice versa
  const hrefMatch = html.match(new RegExp(`<link rel="alternate" hreflang="${wantHreflang}" href="([^"]+)"`));
  if (!hrefMatch) { skippedNoCounterpart++; continue; }
  const out = html.replace(BUTTON,
    `<a class="chrome-btn" id="lang-toggle" href="${hrefMatch[1]}" aria-label="Language">${m[1]}</a>`);
  if (out !== html) { writeFileSync(file, out, 'utf-8'); converted++; }
  files++;
}
console.log(`lang-switch: ${converted} page(s) converted button→<a>`
  + (skippedNoCounterpart ? `, ${skippedNoCounterpart} skipped (no hreflang counterpart found)` : '')
  + (converted === 0 && !skippedNoCounterpart && files === 0 ? ' — nothing to do, already converted' : ''));
