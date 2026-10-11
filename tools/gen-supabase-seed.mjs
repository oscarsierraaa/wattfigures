#!/usr/bin/env node
/*
  gen-supabase-seed.mjs — regenerates supabase/seed-content.sql from the article
  HTML actually on disk: same philosophy as generate-rss.mjs, the built site is
  the source of truth. One row per article per language.

  The n8n workflow "WattFigures · Guías" reads these rows at generation time to
  pick the "Related reading" links it bakes into each new guide. The published
  site never queries Supabase (it is static, and the CSP blocks it) — this table
  only decides where new guides link to.

  Run via `npm run build:seed`, then apply the SQL to the Supabase project.
  NOT part of `npm run build` — regenerate it when pages are added or retitled.
*/
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(path.join(ROOT, 'site.config.json'), 'utf-8'));
const BASE = 'https://' + cfg.domain;
const OG_IMAGE = BASE + '/assets/img/og-default.png';
// Pre-existing content shares one timestamp; guides published by n8n use $now,
// so they sort above these under `order by published_at desc`.
const PUBLISHED_AT = '2026-07-18T08:00:00Z';

const langs = cfg.languages && cfg.languages.length ? cfg.languages : ['en'];
const bases = langs.map((l, i) => (i === 0 ? '' : l + '/'));

const grab = (html, re) => { const m = html.match(re); return m ? m[1] : ''; };
const decode = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const sql = s => "'" + String(s).replace(/'/g, "''") + "'";

const rows = [];

for (let i = 0; i < langs.length; i++) {
  const langDir = i === 0 ? ROOT : path.join(ROOT, langs[i]);
  for (const sec of cfg.sections || []) {
    const secDir = path.join(langDir, sec.slug);
    if (!existsSync(secDir)) continue;
    for (const e of readdirSync(secDir, { withFileTypes: true })) {
      if (!e.isDirectory() || /^page-\d+$/.test(e.name)) continue;
      const f = path.join(secDir, e.name, 'index.html');
      if (!existsSync(f)) continue;
      const html = readFileSync(f, 'utf-8');
      const canonical = grab(html, /<link rel="canonical" href="([^"]+)"/);
      if (!canonical) { console.warn(`  SKIPPED (no canonical): ${sec.slug}/${e.name} [${langs[i]}]`); continue; }
      const title = decode(grab(html, /<meta property="og:title" content="([^"]+)"/)).replace(/ \| [^|]*$/, '')
        || decode(grab(html, /<h1[^>]*>([\s\S]*?)<\/h1>/).replace(/<[^>]+>/g, '').trim());
      const description = decode(grab(html, /<meta name="description" content="([^"]*)"/));
      rows.push({
        section: sec.slug,
        slug: e.name,
        lang: langs[i],
        title,
        description,
        url: canonical.startsWith(BASE) ? canonical.slice(BASE.length) : canonical,
      });
    }
  }
}

rows.sort((a, b) => a.section.localeCompare(b.section) || a.slug.localeCompare(b.slug) || a.lang.localeCompare(b.lang));

const values = rows
  .map(r => `  (${sql(r.section)}, ${sql(r.slug)}, ${sql(r.lang)}, ${sql(r.title)}, ${sql(r.description)}, ${sql(r.url)})`)
  .join(',\n');

const out = `-- WattFigures · Contenido existente para la tabla \`articles\`
-- GENERADO POR tools/gen-supabase-seed.mjs — NO EDITAR A MANO.
-- Regenerar con: npm run build:seed
--
-- Aplicar DESPUÉS de supabase/schema.sql. Idempotente: se puede re-ejecutar.
-- ${rows.length} filas (${langs.map(l => l + ': ' + rows.filter(r => r.lang === l).length).join(', ')}).
--
-- Upsert: si la fila ya existe se refrescan título/descripción/url/imagen, para
-- que un cambio de copy en el HTML se propague al re-ejecutar. NO se tocan
-- status ni published_at, así las guías que publique n8n conservan su fecha
-- real (de la que depende el orden de "Relacionados").

with s as (select id from public.sites where slug = 'wattfigures')
insert into public.articles (site_id, section, slug, lang, title, description, url, image_url, status, published_at)
select s.id, v.section, v.slug, v.lang, v.title, v.description, v.url, '${OG_IMAGE}', 'published', '${PUBLISHED_AT}'
from s, (values
${values}
) as v(section, slug, lang, title, description, url)
on conflict (site_id, section, lang, slug) do update set
  title = excluded.title,
  description = excluded.description,
  url = excluded.url,
  image_url = excluded.image_url;
`;

writeFileSync(path.join(ROOT, 'supabase', 'seed-content.sql'), out, 'utf-8');

const bySection = {};
for (const r of rows) bySection[r.section] = (bySection[r.section] || 0) + 1;
console.log(`seed: supabase/seed-content.sql — ${rows.length} rows`);
for (const [k, v] of Object.entries(bySection)) console.log(`  ${k}: ${v}`);
