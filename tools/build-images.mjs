#!/usr/bin/env node
/*
  build-images.mjs — turn the photo originals into the WebP files the site serves.

  Sources live in _originals/images/<slug>.png (git-tracked, never served: the
  .htaccess blocks the folder). They are 1.2-2.7 MB PNGs straight from the image
  model — shipping those would undo every other performance decision on the site.

  This derives, per destination:
    assets/img/appliances/<slug>.webp   4:3, native size, quality 80
    assets/img/heroes/<slug>.webp       16:9 → 1600×900, quality 80
    assets/img/og-default.png           social-card → 1200×630

  Destination is chosen by matching the file name against the real slugs
  (data/appliances.json, the guides/ and calculators/ folders) rather than by
  aspect ratio, so a mis-shaped or mis-named file fails loudly instead of
  landing quietly in the wrong place.

  Only rebuilds a file when the source is newer, so it is cheap to leave in the
  build. Run:  node tools/build-images.mjs  [--force]
*/
import { readFileSync, readdirSync, existsSync, statSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, '_originals', 'images');
const FORCE = process.argv.includes('--force');

if (!existsSync(SRC)) { console.log('images: no _originals/images — nothing to do'); process.exit(0); }

// ── the slugs each destination accepts ──────────────────────────────────────
const appliances = new Set(
  (JSON.parse(readFileSync(path.join(ROOT, 'data', 'appliances.json'), 'utf-8')).appliances || [])
    .map(a => a.slug));

const heroes = new Set();
for (const section of ['guides', 'calculators']) {
  const dir = path.join(ROOT, section);
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir)) {
    if (existsSync(path.join(dir, name, 'index.html'))) heroes.add(name);
  }
}
// electricity-prices keys off a prefixed slug — see the note in
// generate-heroes.mjs. Both tools must agree on the name or a file lands here
// and never gets wired into a page.
{
  const dir = path.join(ROOT, 'electricity-prices');
  if (existsSync(dir)) {
    heroes.add('electricity-prices');
    for (const name of readdirSync(dir)) {
      if (existsSync(path.join(dir, name, 'index.html'))) heroes.add(`electricity-prices-${name}`);
    }
  }
}

const OUT_APPL = path.join(ROOT, 'assets', 'img', 'appliances');
const OUT_HERO = path.join(ROOT, 'assets', 'img', 'heroes');
mkdirSync(OUT_APPL, { recursive: true });
mkdirSync(OUT_HERO, { recursive: true });

const stale = (src, dest) =>
  FORCE || !existsSync(dest) || statSync(src).mtimeMs > statSync(dest).mtimeMs;

let built = 0, skipped = 0, kb = 0;
const unknown = [];

for (const file of readdirSync(SRC).sort()) {
  if (!/\.(png|jpe?g|webp)$/i.test(file)) continue;
  const slug = file.replace(/\.[^.]+$/, '');
  const src = path.join(SRC, file);

  let dest, pipeline;
  if (appliances.has(slug)) {
    // Native size: the source is ~1448px wide, already above the 1200px that
    // Discover wants, and upscaling an AI render only adds bytes.
    dest = path.join(OUT_APPL, slug + '.webp');
    pipeline = img => img.webp({ quality: 80 });
  } else if (heroes.has(slug)) {
    dest = path.join(OUT_HERO, slug + '.webp');
    pipeline = img => img.resize(1600, 900, { fit: 'cover' }).webp({ quality: 80 });
  } else if (slug === 'social-card') {
    // og:image stays PNG at the exact 1200×630 the meta tags declare — some
    // scrapers still refuse WebP. Palette-indexed because the card is a flat
    // dark ground with one amber glyph: truecolour PNG costs 842 KB here, an
    // indexed one costs a fraction of that with no visible difference.
    dest = path.join(ROOT, 'assets', 'img', 'og-default.png');
    pipeline = img => img.resize(1200, 630, { fit: 'cover' })
      .png({ palette: true, quality: 90, compressionLevel: 9 });
  } else {
    unknown.push(file);
    continue;
  }

  if (!stale(src, dest)) { skipped++; continue; }
  await pipeline(sharp(src)).toFile(dest);
  kb += Math.round(statSync(dest).size / 1024);
  built++;
}

console.log(`images: ${built} built, ${skipped} up to date${built ? ` (${kb} KB total)` : ''}`);
if (unknown.length) {
  console.log(`  ! ${unknown.length} file(s) match no appliance slug and no guide/calculator folder:`);
  for (const f of unknown) console.log(`    ${f}`);
  process.exitCode = 1;
}
