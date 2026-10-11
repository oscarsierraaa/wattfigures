#!/usr/bin/env node
/*
  version-assets.mjs — stamp a content hash on every CSS and JS link.

  Why this exists: on 2026-07-26 a table fix shipped and could not be seen.
  The deploy was fine — the origin served the new file — but half the CDN edge
  nodes kept handing out a copy from hours earlier, and every browser that had
  already loaded the page held its own copy:

    .htaccess  ExpiresByType text/css  "access plus 1 month"
    _headers   /assets/*  max-age=2592000, immutable

  A month of caching on a filename that never changes means a fix cannot
  arrive. Measured at the time: int-edge3 and int-edge4 were still serving the
  old stylesheet while int-edge5 and int-edge6 had the new one.

  So the URL carries the version instead: assets/shared.css?v=8f3a91. New
  content, new URL, new cache key — every edge misses and refetches, and no
  browser can serve a stale copy. The HTML that points at it is only cached an
  hour, so a deploy reaches everyone within the hour with nothing to purge by
  hand in hPanel.

  Query string rather than renaming the file: nothing to clean up afterwards,
  the .htaccess stays as it is, and `immutable` becomes true instead of a trap.

  Idempotent: the hash is the content, so an unchanged asset keeps its stamp
  and no page is rewritten. Runs last in the build, after every generator.

  Run:  node tools/version-assets.mjs
*/
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '_pagefind', 'graphify-out', '_originals', '.git', 'docs', 'n8n', 'supabase', 'templates']);

function htmlFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) htmlFiles(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

const hashes = new Map();
function hashOf(assetPath) {
  if (hashes.has(assetPath)) return hashes.get(assetPath);
  const file = path.join(ROOT, 'assets', assetPath);
  const h = existsSync(file)
    ? createHash('sha1').update(readFileSync(file)).digest('hex').slice(0, 8)
    : null;
  hashes.set(assetPath, h);
  return h;
}

/* Matches href/src pointing anywhere inside assets/, with or without a stamp
   already on it, and leaves any other query string alone. Fonts are excluded:
   they are cached a year on purpose and their content never changes — a new
   stamp on them would throw away a warm cache for nothing.

   Images were excluded too, until a photo had to be replaced. The hero for
   contracted-power-spain showed an ICP reading Max. 63 A on a page whose own
   tiers stop at 9.2 kW; a corrected photo was dropped in under the same
   filename and could not arrive, for exactly the reason the stylesheet could
   not on 2026-07-26 — .htaccess gives image/webp and image/png "access plus 1
   month" and _headers marks /assets/* immutable. Same trap, same cure.

   The leading slash matters: heroes and appliance artwork are linked
   root-absolute (/assets/img/heroes/…) because the paginator moves cards
   between pages and rewrites href but not src, so a pattern that only accepted
   ../assets/ matched four URLs out of fifty-four.

   Not covered, on purpose: og:image, which is written absolute in a <meta
   content="…"> so scrapers keep one stable URL per page, and the two icons
   referenced from url() inside shared.css, which ride that file's own stamp. */
const LINK = /((?:href|src)=")(\/?(?:\.\.\/)*assets\/([A-Za-z0-9._\-/]+\.(?:css|js|webp|png|jpe?g|svg)))(\?v=[0-9a-f]+)?(")/g;

let files = 0, links = 0, missing = new Set();
for (const file of htmlFiles(ROOT)) {
  const before = readFileSync(file, 'utf-8');
  const html = before.replace(LINK, (m, pre, url, asset, _old, post) => {
    const h = hashOf(asset);
    if (!h) { missing.add(asset); return m; }
    links++;
    return `${pre}${url}?v=${h}${post}`;
  });
  if (html !== before) { writeFileSync(file, html, 'utf-8'); files++; }
}

for (const a of missing) console.log(`  ! assets/${a} is linked but not on disk — left unstamped`);
console.log(`assets: ${links} link(s) stamped across ${hashes.size} file(s)`
  + (files ? ` — ${files} page(s) rewritten` : ' — no changes'));
