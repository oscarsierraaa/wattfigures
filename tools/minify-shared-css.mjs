#!/usr/bin/env node
/*
  minify-shared-css.mjs — assets/src/shared.css (comments, indentation, one
  rule per block) is the human-edited source; assets/shared.css is what every
  page actually links to. PageSpeed Insights (01-08-2026) flagged it as
  87.6 KB blocking render on all 156 pages with an estimated 4-5 KiB of pure
  minification waste — comments and repeated indentation, not logic.

  Deliberately conservative: this strips comments and collapses RUNS of
  whitespace (2+ chars) to a single space. It never removes an already-single
  space, because this file leans on single spaces as real selector combinators
  — `.table-right.num-2 :is(th, td)` means "descendant matching :is(...)";
  stripping that one space would silently rewrite it to "the same element
  matches .table-right.num-2 AND :is(...)". A tokenizer, not a blind regex: it
  tracks whether it is inside a quoted string (the data-URI SVG masks in this
  file nest single quotes inside a double-quoted url()) so nothing inside a
  string is ever touched.

  Run:  node tools/minify-shared-css.mjs (wired into `npm run build`)
*/
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'assets', 'src', 'shared.css');
const OUT = path.join(ROOT, 'assets', 'shared.css');

function minify(css) {
  let out = '';
  let inString = null; // '"' or "'" while inside a string, else null
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (inString) {
      out += c;
      if (c === '\\') { i++; out += css[i] || ''; continue; }
      if (c === inString) inString = null;
      continue;
    }
    if (c === '"' || c === "'") { inString = c; out += c; continue; }
    if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end === -1 ? css.length : end + 1;
      continue;
    }
    if (/\s/.test(c)) {
      let j = i;
      while (j < css.length && /\s/.test(css[j])) j++;
      out += j - i > 1 ? ' ' : c; // only collapse RUNS; a lone space stays exactly as it was
      i = j - 1;
      continue;
    }
    out += c;
  }
  return out.trim() + '\n';
}

const src = readFileSync(SRC, 'utf-8');
const min = minify(src);
writeFileSync(OUT, min, 'utf-8');
console.log(`shared.css: ${src.length} → ${min.length} bytes (${Math.round((1 - min.length / src.length) * 100)}% smaller)`);
