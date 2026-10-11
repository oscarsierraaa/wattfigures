/*
  Tiny template engine shared by scaffold.mjs and new-article.mjs.
  Directives (processed in this order):
    1. <!--INCLUDE:partials/head.html-->   resolved relative to templatesDir (recursive)
    2. <!--IF:flag--> ... <!--END:flag-->  kept if flags[flag] truthy, else removed
    3. <!--EACH:section--> ... <!--END:section-->  repeated per section, exposing
       {{S_SLUG}} {{S_LABEL}} {{S_BLURB}} inside the block
    4. {{VAR}}                             replaced from ctx (unknown vars left as "")
*/
import { readFileSync } from 'fs';
import path from 'path';

export function resolveIncludes(str, templatesDir, seen = 0) {
  if (seen > 10) return str;
  return str.replace(/<!--\s*INCLUDE:([^\s]+?)\s*-->/g, (_, rel) => {
    const file = path.join(templatesDir, rel);
    return resolveIncludes(readFileSync(file, 'utf-8'), templatesDir, seen + 1);
  });
}

export function applyFlags(str, flags) {
  return str.replace(/<!--\s*IF:([a-zA-Z0-9_]+)\s*-->([\s\S]*?)<!--\s*END:\1\s*-->/g,
    (_, name, body) => (flags[name] ? body : ''));
}

export function expandSections(str, sections) {
  return str.replace(/<!--\s*EACH:section\s*-->([\s\S]*?)<!--\s*END:section\s*-->/g, (_, body) =>
    sections.map(s => body
      .replace(/\{\{S_SLUG\}\}/g, s.slug)
      .replace(/\{\{S_LABEL\}\}/g, s.label || s.slug)
      .replace(/\{\{S_BLURB\}\}/g, s.blurb || '')
    ).join(''));
}

export function substitute(str, ctx) {
  return str.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, k) => (k in ctx ? ctx[k] : ''));
}

// Full pipeline for a template file path.
export function renderFile(entryRelPath, ctx, { templatesDir, flags, sections }) {
  let s = resolveIncludes(readFileSync(path.join(templatesDir, entryRelPath), 'utf-8'), templatesDir);
  s = applyFlags(s, flags);
  s = expandSections(s, sections);
  s = substitute(s, ctx);
  return s;
}

// Same pipeline for an already-loaded string (used with a copied templates dir).
export function renderString(str, ctx, { templatesDir, flags, sections }) {
  let s = resolveIncludes(str, templatesDir);
  s = applyFlags(s, flags);
  s = expandSections(s, sections);
  s = substitute(s, ctx);
  return s;
}
