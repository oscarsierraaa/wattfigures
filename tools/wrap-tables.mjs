#!/usr/bin/env node
/*
  wrap-tables.mjs — put every data table inside a scroll container.

  Why this exists: the stylesheet used to carry overflow-x on the <table>
  itself. Overflow forces display:block, block makes the table shrink-wrap, and
  the cure for that was display:table on thead and tbody — which is two
  independent layout contexts. Each computed its own column widths, so the
  figures never lined up under their headings. The screenshot that started
  this had "ESPAÑA" over empty space and its prices three columns to the right.

  A wrapper fixes it properly: the table goes back to being one table (one set
  of column widths, headers over their own figures) and the wrapper does the
  scrolling. That needs an element for the CSS to reach, and the 108 tables
  live in committed HTML — so a build step puts it there, rather than 94 hand
  edits that the next guide would immediately fall out of.

  The wrapper also carries the decisions the stylesheet cannot make for itself,
  because CSS can count neither columns nor digits:

    table-wide   four columns or more — lets the table spill past the 720px
                 reading column on large screens. Below four, widening a table
                 just spreads two columns across the page.
    num-N        column N holds figures — it gets the numeric face and its
                 values never break across lines.
    table-right  the figure columns are also flush right.

  Per column, not per table. The first pass at this decided both by table and
  got it wrong twice: sentences like "Fridge + oven + microwave overlapping"
  came out in the monospace figure face because the rule was positional ("every
  column but the first"), and a table with one text column among figures lost
  the alignment on the figures too.

  Idempotent and self-correcting: it strips whatever wrapper it finds and
  writes a fresh one, so a table that gains or loses a column ends up with the
  right class instead of a stale one. Unwrapping by regex is safe because no
  table on this site contains a <div> — only a, br, code, small, strong.

  Runs in the build after every generator that emits a table.

  Run:  node tools/wrap-tables.mjs
*/
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Everything that is not the site: dependencies, search index, local analysis
// artefacts and the image masters.
const SKIP = new Set(['node_modules', '_pagefind', 'graphify-out', '_originals', '.git', 'docs', 'n8n', 'supabase']);
const WIDE_FROM = 4;

const TABLE = /<table\b[\s\S]*?<\/table>/g;
const WRAPPED = /<div class="table-wrap[^"]*">([\s\S]*?)<\/div>/g;

function htmlFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) htmlFiles(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

/* The header row is the honest column count when there is one. The appliance
   pages use headerless key/value tables, so fall back to the first row. */
function columns(table) {
  const head = table.match(/<thead[\s\S]*?<\/thead>/);
  const row = (head ? head[0] : table).match(/<tr[^>]*>[\s\S]*?<\/tr>/);
  return row ? (row[0].match(/<t[dh]\b/g) || []).length : 0;
}

const text = (cell) => cell.replace(/<[^>]+>/g, '').replace(/&[a-z]+;|&#\d+;/g, ' ').trim();
const BLANK = /^(—|–|-|n\/a)?$/i;
/* A figure, not a sentence: it has a digit and at most a unit stuck to it —
   "0,20 €", "1.00 kWh", "+26.7 %", "52 ¢". Four letters is enough for kWh and
   short enough to reject "6 h/day, ~90 days/year". */
const isFigure = (s) => BLANK.test(s) || (/\d/.test(s) && (s.match(/\p{L}/gu) || []).length <= 4);

/* Which columns hold figures. Decided from the cells, not the column count:
   "Scenario | Appliances running together | Approx. power" has three columns
   and only the last one is a number. Column 1 is never a figure column — it is
   the row label, and it is what the reader scans down. */
function figureColumns(table) {
  const head = table.match(/<thead[\s\S]*?<\/thead>/);
  const body = head ? table.slice(table.indexOf('</thead>')) : table;
  const rows = [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
    .map((r) => [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) => text(m[1])));
  if (!rows.length) return [];

  const out = [];
  const width = Math.max(...rows.map((r) => r.length));
  for (let i = 1; i < width; i++) {
    const cells = rows.map((r) => r[i]).filter((c) => c !== undefined);
    if (!cells.length) continue;
    const figures = cells.filter(isFigure).length;
    // A tenth of a column may be an em dash or a "varies" without making the
    // column prose; two thirds prose means it is prose.
    if (figures / cells.length >= 0.7 && cells.some((c) => /\d/.test(c))) out.push(i + 1);
  }
  return out;
}

const HEADING = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/g;
const stripTags = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&[a-z]+;|&#\d+;/g, ' ').trim();
const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* A table an AI or a screen reader lifts out of the page carries none of its
   surrounding context with it (audit 30-07-2026, GEO section: 224 tables, 0
   captions). The generators that have real data in scope (appliances,
   countries, US states) write a proper one-sentence caption themselves; the
   hand-authored calculator/guide/legal pages don't have a generator to hook
   into, so this falls back to the nearest heading above the table — still
   drawn from the page's own real content, never invented. */
function headingPositions(html) {
  const out = [];
  for (const m of html.matchAll(HEADING)) out.push({ at: m.index, text: stripTags(m[1]) });
  return out;
}
function nearestHeading(headings, offset) {
  let best = null;
  for (const h of headings) { if (h.at < offset) best = h; else break; }
  return best ? best.text : null;
}

// `tables`/`wide`/`right` are the state after the run; `files` is what this run
// actually rewrote. A rebuild that changes nothing should still report the 108
// tables it checked, not "0" — the same reason generate-heroes.mjs splits them.
let files = 0, tables = 0, wide = 0, right = 0, captioned = 0, captionless = 0;
for (const file of htmlFiles(ROOT)) {
  const before = readFileSync(file, 'utf-8');
  let html = before.replace(WRAPPED, (_m, inner) => inner);
  const headings = headingPositions(html);
  html = html.replace(TABLE, (t, offset) => {
    tables++;
    const cols = columns(t);
    const figures = figureColumns(t);
    const cls = ['table-wrap'];
    if (cols >= WIDE_FROM) { cls.push('table-wide'); wide++; }
    // Flush right needs a third column to line up against. With one value per
    // row, a right edge half a table away from its label is harder to pair
    // than a left edge sitting right after it.
    if (cols >= 3 && figures.length) { cls.push('table-right'); right++; }
    for (const n of figures) cls.push(`num-${n}`);
    let tableHtml = t;
    if (!/<caption>/.test(t)) {
      const heading = nearestHeading(headings, offset);
      if (heading) {
        tableHtml = t.replace(/^<table([^>]*)>/, `<table$1><caption>${escAttr(heading)}</caption>`);
        captioned++;
      } else captionless++;
    }
    return `<div class="${cls.join(' ')}">${tableHtml}</div>`;
  });
  if (html !== before) { writeFileSync(file, html, 'utf-8'); files++; }
}

console.log(`tables: ${tables} wrapped, ${wide} wide, ${right} right-aligned`
  + (captioned ? `, ${captioned} caption(s) added from the nearest heading` : '')
  + (captionless ? `, ${captionless} still without a caption (no heading found above)` : '')
  + (files ? ` — ${files} file(s) rewritten` : ' — no changes'));
