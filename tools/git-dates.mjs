/*
  git-dates.mjs — an honest "when did this actually change" for generated
  pages, without touching data/*.json to add per-item fields it doesn't have.

  Why not just git-log the generated HTML? Every full rebuild rewrites all
  156 files (asset-version stamping alone touches every <head>), so the
  generated artifact's own git history collapses to "the last rebuild" for
  everything — which is exactly the bug the 30-07 audit found (sitemap
  lastmod identical across all 156 URLs). The fix is to read the commit
  history of the SOURCE data instead, at the line range that actually feeds
  the page, since that file is only touched when someone edits real content.
*/
import { execSync } from 'node:child_process';

const DATE_RE = /^(\d{4}-\d{2}-\d{2})/m;

function run(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  } catch (e) {
    return '';
  }
}

/* Last commit date (YYYY-MM-DD) touching the whole file, honest for sources
   that are only edited as a unit (e.g. one EIA release covering 50 states). */
export function fileDate(rootDir, relPath, fallback) {
  const out = run(`git log -1 --format=%ad --date=short -- "${relPath}"`, rootDir).trim();
  return out || fallback;
}

/* Last commit date (YYYY-MM-DD) touching a specific 1-indexed inclusive line
   range of a tracked file — for JSON sources where several independent
   records (appliances, countries) share one file but change on their own
   schedule. Falls back to the whole-file date if the range lookup fails. */
export function blameRangeDate(rootDir, relPath, startLine, endLine, fallback) {
  const out = run(`git log -1 --format=%ad --date=short -L ${startLine},${endLine}:"${relPath}"`, rootDir);
  const m = out.match(DATE_RE);
  if (m) return m[1];
  return fileDate(rootDir, relPath, fallback);
}

/* Maps each top-level object in a JSON array (pretty-printed, 2-space indent,
   objects opening with a bare "{" line) to its [startLine, endLine] span
   (1-indexed, inclusive), keyed by a field already unique per object (e.g.
   "slug"). Text-based on purpose: it must match the exact lines git blames,
   which JSON.parse throws away. */
export function jsonObjectLineSpans(rawText, keyField) {
  const lines = rawText.split('\n');
  const spans = {};
  // depth 0 = outside everything; the file's own wrapping "{ ... }" holds
  // depth at 1 for the whole file, so the array items we want (appliances,
  // countries — one nesting level in) open and close at depth 1<->2, not 0<->1.
  let depth = 0, itemStart = -1, curKey = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;
    if (opens > 0 && depth === 1 && itemStart < 0) { itemStart = i + 1; curKey = null; }
    depth += opens - closes;
    if (itemStart > 0 && curKey === null) {
      const m = line.match(new RegExp(`"${keyField}"\\s*:\\s*"([^"]+)"`));
      if (m) curKey = m[1];
    }
    if (depth === 1 && itemStart > 0) {
      if (curKey) spans[curKey] = [itemStart, i + 1];
      itemStart = -1;
    }
  }
  return spans;
}
