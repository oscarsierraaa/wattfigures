#!/usr/bin/env node
/*
  generate-sitemap.mjs — regenerates sitemap.xml from the HTML actually on disk.
  Domain comes from site.config.json. Run via `npm run build:sitemap`.
*/
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(path.join(ROOT, 'site.config.json'), 'utf-8'));
const BASE_URL = 'https://' + cfg.domain;

const EXCLUDE_DIRS = new Set(['node_modules', '_pagefind', '.git', 'templates', 'tools']);
const EXCLUDE_FILES = new Set(['404.html']);

function walk(dir, out) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (!EXCLUDE_DIRS.has(e.name)) walk(full, out); }
    else if (e.isFile() && e.name.endsWith('.html') && !EXCLUDE_FILES.has(e.name)) out.push(full);
  }
  return out;
}
const isNoindex = h => { const m = h.match(/<meta\s+name="robots"\s+content="([^"]*)"/i); return !!m && /noindex/i.test(m[1]); };
const getCanonical = h => { const m = h.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i); return m ? m[1] : null; };
function getAlternates(h) {
  const alts = []; const re = /<link\s+rel="alternate"\s+hreflang="([^"]+)"\s+href="([^"]+)"/gi; let m;
  while ((m = re.exec(h))) alts.push({ hreflang: m[1], href: m[2] });
  return alts;
}
function gitLastMod(abs) {
  try {
    const rel = path.relative(ROOT, abs).split(path.sep).join('/');
    const out = execSync(`git log -1 --format=%ad --date=short -- "${rel}"`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    if (out) return out;
  } catch (e) {}
  return statSync(abs).mtime.toISOString().slice(0, 10);
}
// Every full rebuild rewrites all 156 files (asset-version stamping touches
// every <head>), so git-logging the generated HTML always returns "the last
// rebuild", the same date for every URL — the exact bug the 30-07-2026 audit
// found in this file. Pages that carry a real per-page dateModified in their
// own JSON-LD (derived from source data, not from the artifact — see
// generate-appliances.mjs / generate-country-pages.mjs) use that instead;
// only pages without one (legal, home, section indexes) fall back to git.
function lastMod(abs, html) {
  const m = html.match(/"dateModified"\s*:\s*"(\d{4}-\d{2}-\d{2})"/);
  return m ? m[1] : gitLastMod(abs);
}
// <priority> y <changefreq> salieron de aquí el 03-08-2026. Google dice
// abiertamente que los ignora —lleva haciéndolo desde 2023— y Bing igual, así
// que eran dos campos inventados por nosotros que nadie leía: la prioridad la
// asignaba una heurística por profundidad de ruta y el changefreq era fijo por
// tipo de página, o sea que ni siquiera describían el fichero de verdad. Lo
// único que hacían era engordar el sitemap y dar la falsa impresión de que ahí
// había una señal que ajustar. El <lastmod> sí lo lee Google, y ese sí es real:
// sale del dateModified que cada página deriva de su propio dato fuente.

// Y el 04-08-2026 salieron 16 URLs más, estas por presupuesto de rastreo. La
// revisión de indexación de ese día encontró cinco páginas de país inglesas
// —Bélgica, Francia, Italia, Portugal, Suecia— que llevaban doce días en el
// sitemap sin un solo rastreo, dos de ellas literalmente desconocidas para
// Google. No era el contenido ni el enlazado: cada una tiene una gemela
// indexada de la misma longitud exacta y con menos enlaces internos. Era cola.
// Así que el sitemap deja de señalar lo que no va a rankear nunca: las legales
// y las de paginación, que eran el 11,5 % de las 156 entradas.
//
// Esto NO las saca del índice ni les pone noindex — siguen enlazadas desde el
// pie y desde su índice de sección, y Google las conserva si quiere. Un sitemap
// es una sugerencia de prioridad, no un reparto de cuota, así que tampoco
// garantiza que Italia se rastree mañana; lo que hace es dejar de pedir
// rastreos para /legal/cookies/, y es gratis y reversible.
//
// methodology se queda a propósito: es la página de autoría a la que enlazan
// las 60 fichas y un criterio real de AdSense. Sacarla justo antes de
// solicitarlo sería tirarse a los pies.
const LOW_VALUE = /\/(legal\/(?!methodology\/)|appliances\/page-\d+\/)/;

const files = walk(ROOT, []).sort();
const entries = []; const warnings = []; const lowValue = [];
for (const abs of files) {
  const html = readFileSync(abs, 'utf-8');
  if (isNoindex(html)) continue;
  const canonical = getCanonical(html);
  if (!canonical) { warnings.push('SKIPPED (no canonical): ' + path.relative(ROOT, abs)); continue; }
  if (LOW_VALUE.test(canonical)) { lowValue.push(canonical); continue; }
  entries.push({ canonical, alternates: getAlternates(html), lastmod: lastMod(abs, html) });
}
let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n\n';
for (const e of entries) {
  xml += '  <url>\n    <loc>' + e.canonical + '</loc>\n';
  for (const a of e.alternates) xml += `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.href}" />\n`;
  xml += `    <lastmod>${e.lastmod}</lastmod>\n  </url>\n`;
}
xml += '</urlset>\n';
writeFileSync(path.join(ROOT, 'sitemap.xml'), xml, 'utf-8');
console.log(`sitemap.xml regenerated: ${entries.length} URLs`);
// Se dice cuántas se dejan fuera. Un recorte silencioso se lee como "está todo".
if (lowValue.length) console.log(`  ${lowValue.length} fuera por bajo valor de rastreo (legales y paginación); siguen enlazadas e indexables`);
warnings.forEach(w => console.log('  ' + w));
