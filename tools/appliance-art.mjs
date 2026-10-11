/*
  appliance-art.mjs — one place that decides which image an appliance shows.

  generate-appliance-art.mjs draws a branded SVG panel for every appliance so
  the site is never missing an image. When a real photograph is dropped into
  assets/img/appliances/<slug>.webp (or .jpg/.png), that photo wins on the next
  build — no template edits, no data changes.

  Photo naming contract (see IMAGENES.md):
    assets/img/appliances/<slug>.webp   4:3, 1600×1200, ≤180 KB

  Used by generate-appliances.mjs (hero + cards) and generate-calc-related.mjs,
  so all three surfaces stay in sync.
*/
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'assets', 'img', 'appliances');

// Preference order: a real photo in any web format, then the generated panel.
const EXTS = ['.webp', '.jpg', '.jpeg', '.png', '.svg'];

/* Root-absolute URL of the best available image for a slug. Root-absolute
   because appliance cards are moved between paginated pages, and the paginator
   rewrites href but not src. */
export function artUrl(slug) {
  for (const ext of EXTS) {
    if (existsSync(path.join(DIR, slug + ext))) return `/assets/img/appliances/${slug}${ext}`;
  }
  return `/assets/img/appliances/${slug}.svg`;
}

/* True when a real photograph (not the generated panel) is in place — lets a
   caller report how much of the photo set has landed. */
export function hasPhoto(slug) {
  return EXTS.slice(0, -1).some(ext => existsSync(path.join(DIR, slug + ext)));
}
