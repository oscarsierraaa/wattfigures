/*
  Every stylesheet and script link must carry the hash of the file it points at.

  Without it a fix cannot reach anyone. On 2026-07-26 a table fix shipped and
  stayed invisible: .htaccess caches CSS for a month on a filename that never
  changes, so half the CDN edge nodes kept serving the previous stylesheet for
  hours and browsers held their own copy for up to thirty days. The failure is
  silent — the build is green, the deploy is green, and the site is stale.

  tools/version-assets.mjs stamps the hash; this holds it in place.

  Run: node --test
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '_pagefind', 'graphify-out', '_originals', '.git', 'docs', 'n8n', 'supabase', 'templates', 'test']);

function htmlFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) htmlFiles(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

const LINK = /(?:href|src)="((?:\.\.\/)*assets\/([A-Za-z0-9._\-/]+\.(?:css|js)))(\?v=([0-9a-f]+))?"/g;

const links = [];
for (const file of htmlFiles(root)) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  for (const m of readFileSync(file, 'utf-8').matchAll(LINK)) {
    links.push({ rel, asset: m[2], stamp: m[4] });
  }
}

const hashes = new Map();
const hashOf = (asset) => {
  if (!hashes.has(asset)) {
    const f = path.join(root, 'assets', asset);
    hashes.set(asset, existsSync(f) ? createHash('sha1').update(readFileSync(f)).digest('hex').slice(0, 8) : null);
  }
  return hashes.get(asset);
};

test('the pages link the assets we think they do', () => {
  assert.ok(links.length > 500, `only ${links.length} asset links found — the walk is looking in the wrong place`);
});

test('every CSS and JS link carries a version', () => {
  const bare = [...new Set(links.filter((l) => !l.stamp).map((l) => `${l.rel} → ${l.asset}`))];
  assert.deepEqual(bare.slice(0, 5), [], 'run `npm run build:version`');
});

// A stamp that no longer matches the file is worse than none: it looks
// versioned, so nobody checks, and the stale copy stays cached for a month.
test('every version matches the file on disk', () => {
  const stale = [];
  for (const l of links) {
    const h = hashOf(l.asset);
    if (h === null) { stale.push(`${l.rel}: assets/${l.asset} does not exist`); continue; }
    if (l.stamp && l.stamp !== h) stale.push(`${l.rel}: ${l.asset} stamped ${l.stamp}, file is ${h}`);
  }
  assert.deepEqual([...new Set(stale)].slice(0, 5), [], 'run `npm run build:version`');
});

// The stylesheet is the one that has actually bitten us.
test('shared.css is versioned everywhere it is linked', () => {
  const css = links.filter((l) => l.asset === 'shared.css');
  assert.ok(css.length > 100, `shared.css linked from only ${css.length} pages`);
  assert.equal(css.filter((l) => l.stamp === hashOf('shared.css')).length, css.length);
});

/*
  A correct stamp on a path that resolves nowhere.

  Everything above resolves an asset by the part *after* `assets/`, which is
  also what tools/version-assets.mjs does — hashOf() joins ROOT/assets/<name>
  and never looks at the prefix. So `assets/x.js`, `../assets/x.js` and
  `/assets/x.js` all hash to the same file and all get a correct stamp. The
  browser does not agree: it resolves the URL against the page it is on.

  Found in production on 2026-08-04. Six pages asked for `assets/consent-init.js`
  with no `../`, so /calculators/ requested /calculators/assets/consent-init.js
  and got a 404 — the consent banner and GA4 silently absent on /es/,
  /calculators/, /guides/, /estimator/ and both 404 pages, the last of which
  breaks at every depth because a 404 is served wherever it is asked for. Every
  other asset on those same pages was correct; only the two <script> tags that
  were propagated by hand were not, which is what the scaffold warning in
  PLAN-MONETIZACION §6 predicts for the pages no generator rebuilds.

  This is the one check the stamping pipeline structurally cannot make.

  Note the pattern below does not require `assets/` anywhere in the path, and
  that is deliberate: the first attempt at this test did, and it sat green while
  a repair script rewrote 49 pages to ../../consent-init.js — right number of
  levels, `assets/` dropped. A check that only looks at paths containing the
  word it expects cannot see a path that lost it.
*/
test('every asset link resolves to a file from the page that links it', () => {
  const RESOLVABLE = /(?:href|src)="((?!https?:|\/\/|data:|mailto:|#)[A-Za-z0-9._\-/]+\.(?:css|js|webp|png|jpe?g|svg))(?:\?v=[0-9a-f]+)?"/g;
  const broken = [];
  let checked = 0;
  for (const file of htmlFiles(root)) {
    const rel = path.relative(root, file).replace(/\\/g, '/');
    for (const m of readFileSync(file, 'utf-8').matchAll(RESOLVABLE)) {
      const url = m[1];
      // Root-absolute hangs off the site root; anything else off the page.
      const target = url.startsWith('/')
        ? path.join(root, url.slice(1))
        : path.resolve(path.dirname(file), url);
      checked++;
      if (!existsSync(target)) broken.push(`${rel} → ${url} (resolves to ${path.relative(root, target).replace(/\\/g, '/')})`);
    }
  }
  assert.ok(checked > 500, `only ${checked} links resolved — the walk is looking in the wrong place`);
  assert.deepEqual([...new Set(broken)].slice(0, 8), [], 'a link points somewhere the browser will get a 404');
});
