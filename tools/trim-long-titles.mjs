#!/usr/bin/env node
/*
  trim-long-titles.mjs — the " | WattFigures" suffix costs 14 characters on
  every page. Fine on a 45-character title, but on the 20 pages whose own
  title already runs long it pushes the full <title> past the ~60 characters
  Google renders before truncating in the SERP — right as those pages start
  getting impressions (audit 30-07-2026). Rather than reword 20 titles that
  were each deliberately phrased to match a real query, this drops the brand
  suffix exactly where keeping it would truncate something else instead: the
  reader's own words.

  Runs after every generator (mix of regenerated and hand-frozen pages, same
  reason inject-lang-switch.mjs is a whole-site pass and not a template edit).
  Idempotent: a title with no suffix is left alone.

  Run:  node tools/trim-long-titles.mjs
*/
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '_pagefind', 'graphify-out', '_originals', '.git', 'docs', 'n8n', 'supabase', 'templates', 'tools']);
const cfg = JSON.parse(readFileSync(path.join(ROOT, 'site.config.json'), 'utf-8'));
const BRAND = cfg.brand;
const SUFFIX = ` | ${BRAND}`;
const MAX_TITLE = 60;

function htmlFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) htmlFiles(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const suffixRe = new RegExp(esc(SUFFIX) + '(?=<|")', 'g');

let files = 0, trimmed = 0;
for (const file of htmlFiles(ROOT)) {
  const html = readFileSync(file, 'utf-8');
  const titleMatch = html.match(/<title>([^<]*)<\/title>/);
  if (!titleMatch || titleMatch[1].length <= MAX_TITLE || !titleMatch[1].endsWith(SUFFIX)) continue;
  // Drop the suffix from <title>, og:title and twitter:title alike — all three
  // carry the exact same "{title} | {brand}" string from the same template var.
  const out = html.replace(suffixRe, '');
  if (out !== html) { writeFileSync(file, out, 'utf-8'); trimmed++; }
  files++;
}
console.log(`title trim: ${trimmed} page(s) had "${SUFFIX}" dropped (title would exceed ${MAX_TITLE} chars with it)`);
