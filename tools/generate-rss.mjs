#!/usr/bin/env node
/*
  generate-rss.mjs — regenerates feed.xml (and es/feed.xml) from the article
  HTML actually on disk: same philosophy as generate-sitemap.mjs, the built
  site is the source of truth. Newest 20 articles per language feed.
  Run via `npm run build:rss` (part of `npm run build`).
*/
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(path.join(ROOT, 'site.config.json'), 'utf-8'));
const BASE = 'https://' + cfg.domain;
const MAX_ITEMS = 20;
const langs = cfg.languages && cfg.languages.length ? cfg.languages : ['en'];

const grab = (html, re) => { const m = html.match(re); return m ? m[1] : ''; };
const decode = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const escXml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function articlesUnder(dir) {
  const out = [];
  for (const sec of cfg.sections || []) {
    const secDir = path.join(dir, sec.slug);
    if (!existsSync(secDir)) continue;
    for (const e of readdirSync(secDir, { withFileTypes: true })) {
      if (!e.isDirectory() || /^page-\d+$/.test(e.name)) continue;
      const f = path.join(secDir, e.name, 'index.html');
      if (!existsSync(f)) continue;
      const html = readFileSync(f, 'utf-8');
      if (!/<meta property="og:type" content="article"/.test(html)) continue;
      const canonical = grab(html, /<link rel="canonical" href="([^"]+)"/);
      const title = decode(grab(html, /<meta property="og:title" content="([^"]+)"/)).replace(/ \| [^|]*$/, '');
      const desc = decode(grab(html, /<meta name="description" content="([^"]*)"/));
      const date = grab(html, /"datePublished":\s*"([^"]+)"/);
      if (!canonical || !date) continue;
      out.push({ canonical, title, desc, date });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date)).slice(0, MAX_ITEMS);
}

function feedXml(items, lang) {
  const isEs = lang === 'es';
  const link = BASE + '/' + (isEs ? 'es/' : '');
  const desc = (isEs && cfg.description_es) || cfg.description || cfg.tagline || cfg.brand;
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n<channel>\n';
  xml += `  <title>${escXml(cfg.brand)}</title>\n  <link>${link}</link>\n  <description>${escXml(desc)}</description>\n`;
  xml += `  <language>${isEs ? 'es' : 'en'}</language>\n  <atom:link href="${link}feed.xml" rel="self" type="application/rss+xml" />\n`;
  for (const it of items) {
    xml += `  <item>\n    <title>${escXml(it.title)}</title>\n    <link>${it.canonical}</link>\n    <guid>${it.canonical}</guid>\n`;
    xml += `    <description>${escXml(it.desc)}</description>\n    <pubDate>${new Date(it.date + 'T00:00:00Z').toUTCString()}</pubDate>\n  </item>\n`;
  }
  return xml + '</channel>\n</rss>\n';
}

for (let i = 0; i < langs.length; i++) {
  const dir = i === 0 ? ROOT : path.join(ROOT, langs[i]);
  const items = articlesUnder(dir);
  writeFileSync(path.join(dir, 'feed.xml'), feedXml(items, langs[i]), 'utf-8');
  console.log(`feed: ${i === 0 ? '' : langs[i] + '/'}feed.xml — ${items.length} items`);
}
