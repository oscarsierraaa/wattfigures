/*
  Structural invariants for every data table the site publishes.

  Tables carry the figures this site exists to give, and they were shipping
  misaligned for weeks: overflow-x on the <table> forced display:block, which
  forced display:table on thead and tbody, which gave each its own column
  widths — so the headings sat over the wrong figures and nobody could pair a
  price with its country. The stylesheet now scrolls a wrapper instead, and
  these tests hold that arrangement in place: a hand-written guide that ships
  a bare <table> fails CI rather than reaching a reader sideways.

  Run: node --test
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '_pagefind', 'graphify-out', '_originals', '.git', 'docs', 'n8n', 'supabase']);

function htmlFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) htmlFiles(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

const pages = htmlFiles(root).map((file) => ({
  rel: path.relative(root, file).replace(/\\/g, '/'),
  html: readFileSync(file, 'utf-8'),
}));

const tables = [];
for (const { rel, html } of pages) {
  for (const m of html.matchAll(/<table\b[\s\S]*?<\/table>/g)) {
    tables.push({ rel, table: m[0], before: html.slice(Math.max(0, m.index - 120), m.index) });
  }
}

test('the site still has tables to check', () => {
  assert.ok(tables.length > 50, `found only ${tables.length} tables — the walk is probably looking in the wrong place`);
});

// Without the wrapper there is nothing to scroll, so a wide table either
// overflows the page or the stylesheet has to put overflow back on the table
// itself, which is what broke the alignment in the first place.
test('every table sits inside a .table-wrap', () => {
  const bare = tables
    .filter((t) => !/<div class="table-wrap[^"]*">\s*$/.test(t.before))
    .map((t) => t.rel);
  assert.deepEqual([...new Set(bare)], [], 'run `npm run build:tables`');
});

// The wrapper is what escapes the 720px measure on wide screens; the class has
// to follow the actual column count, not whatever it had when it was written.
test('the wide modifier matches the column count', () => {
  const wrong = [];
  for (const { rel, table, before } of tables) {
    const head = table.match(/<thead[\s\S]*?<\/thead>/);
    const row = (head ? head[0] : table).match(/<tr[^>]*>[\s\S]*?<\/tr>/);
    const cols = row ? (row[0].match(/<t[dh]\b/g) || []).length : 0;
    const isWide = /<div class="[^"]*\btable-wide\b/.test(before);
    if (isWide !== cols >= 4) wrong.push(`${rel}: ${cols} columns, table-wide=${isWide}`);
  }
  assert.deepEqual(wrong, [], 'run `npm run build:tables`');
});

/* num-N puts column N in the monospace figure face and stops it wrapping, and
   with table-right it also goes flush right. Aimed at a column of sentences
   that sets prose as if it were code and strands it against the right edge —
   which is exactly what the positional rule it replaced used to do. Checked
   against the published HTML, not by re-running the tool's own logic. */
const bodyRows = (table) => {
  const head = table.match(/<thead[\s\S]*?<\/thead>/);
  const body = head ? table.slice(table.indexOf('</thead>')) : table;
  return [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((r) =>
    [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)]
      .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/&[a-z]+;|&#\d+;/g, ' ').trim()));
};
const marked = (before) => [...before.matchAll(/\bnum-(\d)\b/g)].map((m) => +m[1]);

test('every num-N column really holds figures', () => {
  const wrong = [];
  for (const { rel, table, before } of tables) {
    const rows = bodyRows(table);
    for (const n of marked(before)) {
      const cells = rows.map((r) => r[n - 1]).filter((c) => c !== undefined && c !== '');
      const prose = cells.filter((c) => !/\d/.test(c) || (c.match(/\p{L}/gu) || []).length > 4);
      if (prose.length > cells.length * 0.3) wrong.push(`${rel} col ${n}: "${prose[0].slice(0, 45)}"`);
    }
  }
  assert.deepEqual(wrong.slice(0, 5), [], 'prose ended up in a figure column');
});

// Column 1 is the row label — the thing the reader scans down. Setting it in
// the figure face or flush right is always wrong, whatever it contains.
test('the label column is never marked', () => {
  const wrong = tables.filter((t) => marked(t.before).includes(1)).map((t) => t.rel);
  assert.deepEqual(wrong, []);
});

// Flush right needs a third column to line up against.
test('table-right only on tables of three columns or more', () => {
  const wrong = [];
  for (const { rel, table, before } of tables) {
    if (!/\btable-right\b/.test(before)) continue;
    const head = table.match(/<thead[\s\S]*?<\/thead>/);
    const row = (head ? head[0] : table).match(/<tr[^>]*>[\s\S]*?<\/tr>/);
    const cols = row ? (row[0].match(/<t[dh]\b/g) || []).length : 0;
    if (cols < 3) wrong.push(`${rel}: ${cols} columns`);
  }
  assert.deepEqual(wrong, []);
});

// A canary: if the classifier ever stops recognising figures, every table
// quietly falls back to prose and nothing else would notice.
test('the figure columns are still being recognised', () => {
  const n = tables.filter((t) => marked(t.before).length).length;
  assert.ok(n > 70, `only ${n} tables carry a num- class — the classifier has probably broken`);
});

// A table inside a table would get wrapped twice and lay out unpredictably.
test('no table is nested inside another', () => {
  const nested = tables.filter((t) => (t.table.match(/<table\b/g) || []).length > 1).map((t) => t.rel);
  assert.deepEqual([...new Set(nested)], []);
});

// One layout context only aligns columns that exist. A row with a cell missing
// still renders shifted, and no stylesheet can rescue it.
test('every body row has as many cells as the header has columns', () => {
  const mismatched = [];
  for (const { rel, table } of tables) {
    const head = table.match(/<thead[\s\S]*?<\/thead>/);
    if (!head) continue;
    const cols = (head[0].match(/<th\b/g) || []).length;
    const body = table.slice(table.indexOf('</thead>'));
    for (const r of body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
      const n = (r[1].match(/<t[dh]\b/g) || []).length;
      if (n !== cols) mismatched.push(`${rel}: header has ${cols} columns, a row has ${n}`);
    }
  }
  assert.deepEqual(mismatched, []);
});

// The regression itself. These two declarations are what pulled the headings
// away from their figures, and the comment that justified them read as a fix.
test('the stylesheet does not put the scroll back on the table', () => {
  const css = readFileSync(path.join(root, 'assets', 'shared.css'), 'utf-8');
  const block = css.slice(css.indexOf('.table-wrap {'), css.indexOf('.callout {'));
  assert.ok(block, 'the table block moved — check this test still points at it');
  assert.doesNotMatch(block, /\.prose-sec table\s*\{[^}]*display:\s*block/,
    'overflow on the table forces display:block and the columns split again');
  assert.doesNotMatch(block, /(thead|tbody)\s*\{[^}]*display:\s*table/,
    'display:table on a row group gives it its own column widths');
});

// The other regression, kept separate so a failure names the right defect:
// picking the figure face by position set whole sentences in monospace.
test('the monospace face follows the content, not the column position', () => {
  const css = readFileSync(path.join(root, 'assets', 'shared.css'), 'utf-8');
  const block = css.slice(css.indexOf('.table-wrap {'), css.indexOf('.callout {'));
  assert.doesNotMatch(block, /td:not\(:first-child\)\s*\{[^}]*font-family/,
    'the monospace face must follow num-N, which is decided from the cells');
});
