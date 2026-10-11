/*
  site-i18n.mjs — shared UI strings + section localization for the generators.
  Every visible chrome/UI string that the scaffold bakes into pages lives here,
  so /es/ pages come out fully Spanish (article BODIES are still authored per
  language by hand — this only covers the generated skeleton).
*/

export const UI = {
  en: {
    T_EXPLORE: 'Explore',
    T_LATEST: 'Latest',
    T_HOME: 'Home',
    T_SKIP: 'Skip to content',
    T_RELATED: 'Related reading',
    T_MOREIN: 'More in',
    T_UPDATED: 'Updated',
    T_BY: 'By',
    T_SHARE: 'Share',
    T_PRINT: 'Print this page',
    T_COPYLINK: 'Copy link',
    T_AD: 'Advertisement',
    T_FAQ: 'Frequently asked questions',
    T_LASTUPD: 'Last updated',
    T_BLOG_EMPTY: 'No posts yet. Add entries to data/posts.json.',
    T_METHOD_NOTE: 'Figures on this page are calculated from typical appliance wattages and the price per kWh you enter, not looked up from a bill.',
    T_METHOD_LINK: 'See how we calculate this',
    T_ONESTEP: 'What you’ll need',
    T_VERDICT: 'The short answer',
    T_INGREDIENTS: 'Ingredients',
    T_INSTRUCTIONS: 'Instructions',
    T_ABOUT_BTN: 'About',
    BLOG_LABEL: 'Blog',
    ESTIMATOR_LABEL: 'Estimator',
    // electricity-prices/ isn't a section in site.config.json, so the nav loop
    // never emitted it and the page sat on 3 inbound links while ranking better
    // than anything else on the site. Fixed link, like the estimator's.
    PRICES_LABEL: 'Electricity Prices',
    // The header search covers the whole site, not just appliances. The visible
    // placeholder names what you can find; the aria-label says what the control
    // is, so screen readers don't read back a list of content types.
    SEARCH_LABEL: 'Search appliances, guides…',
    SEARCH_ARIA: 'Search the site',
    ABOUT_LABEL: 'About',
    LEGAL_ARIA: 'Legal',
    F_ABOUT: 'About', F_CONTACT: 'Contact', F_PRIVACY: 'Privacy', F_TERMS: 'Terms',
    F_COOKIES: 'Cookies', F_DISCLOSURES: 'Disclosures', F_METHOD: 'How we work',
    F_DISCLAIMER: 'The figures on this site are estimates for guidance only — not a bill, a quote, or professional advice. Actual costs depend on your tariff, your appliance and your usage. Always check your own meter and bill, and consult a qualified professional before making a purchase or any electrical change.',
  },
  es: {
    T_EXPLORE: 'Explora',
    T_LATEST: 'Lo último',
    T_HOME: 'Inicio',
    T_SKIP: 'Saltar al contenido',
    T_RELATED: 'Lecturas relacionadas',
    T_MOREIN: 'Más en',
    T_UPDATED: 'Actualizado',
    T_BY: 'Por',
    T_SHARE: 'Compartir',
    T_PRINT: 'Imprimir esta página',
    T_COPYLINK: 'Copiar enlace',
    T_AD: 'Publicidad',
    T_FAQ: 'Preguntas frecuentes',
    T_LASTUPD: 'Última actualización',
    T_BLOG_EMPTY: 'Aún no hay entradas. Añádelas en data/posts.json.',
    T_METHOD_NOTE: 'Las cifras de esta página se calculan a partir de potencias típicas y el precio por kWh que introduzcas, no se copian de una factura.',
    T_METHOD_LINK: 'Consulta cómo lo calculamos',
    T_ONESTEP: 'Qué necesitas',
    T_VERDICT: 'La respuesta corta',
    T_INGREDIENTS: 'Ingredientes',
    T_INSTRUCTIONS: 'Instrucciones',
    T_ABOUT_BTN: 'Acerca de',
    BLOG_LABEL: 'Blog',
    ESTIMATOR_LABEL: 'Estimador',
    PRICES_LABEL: 'Precios de la luz',
    SEARCH_LABEL: 'Busca aparatos, guías…',
    SEARCH_ARIA: 'Buscar en el sitio',
    ABOUT_LABEL: 'Acerca de',
    LEGAL_ARIA: 'Legal',
    F_ABOUT: 'Acerca de', F_CONTACT: 'Contacto', F_PRIVACY: 'Privacidad', F_TERMS: 'Términos',
    F_COOKIES: 'Cookies', F_DISCLOSURES: 'Divulgaciones', F_METHOD: 'Cómo trabajamos',
    F_DISCLAIMER: 'Las cifras de esta web son estimaciones orientativas: no son una factura, ni un presupuesto, ni asesoramiento profesional. El coste real depende de tu tarifa, tu aparato y tu uso. Consulta siempre tu contador y tu factura, y acude a un profesional cualificado antes de comprar nada o hacer cualquier cambio eléctrico.',
  },
};

export function uiStrings(lang) {
  return UI[lang] || UI.en;
}

/* Sections localized for a language: label_es / blurb_es win on ES pages, so
   the nav, cards and breadcrumbs of /es/ render in Spanish. */
export function localizeSections(sections, lang) {
  if (lang !== 'es') return sections;
  return sections.map(s => ({
    ...s,
    label: s.label_es || s.label,
    blurb: s.blurb_es || s.blurb,
  }));
}

export function sectionLabel(section, lang) {
  if (!section) return '';
  return (lang === 'es' && section.label_es) || section.label || section.slug;
}

/* A meta description that runs long gets cut at the last full sentence that
   still fits, or the last full word if it's one long sentence — never
   mid-word. ES gets a wider budget than EN because it is systematically
   longer for the same fact (audit 30-07-2026: some country-page descriptions
   ran past 200 characters and Google was truncating them anyway). */
export function capMeta(text, maxLen) {
  if (text.length <= maxLen) return text;
  const window = text.slice(0, maxLen + 1);
  const lastStop = Math.max(window.lastIndexOf('. '), window.lastIndexOf('? '));
  if (lastStop > maxLen * 0.5) return text.slice(0, lastStop + 1);
  const lastSpace = text.slice(0, maxLen).lastIndexOf(' ');
  return text.slice(0, lastSpace > 0 ? lastSpace : maxLen).trim();
}

/* OG locale per language (used by <meta property="og:locale">). */
export function ogLocale(lang) {
  return lang === 'es' ? 'es_ES' : 'en_US';
}

/* Standard per-language flags for the template engine: pageEn/pageEs let a
   template carry visible placeholder copy in both languages. */
export function langFlags(lang) {
  return { pageEn: lang !== 'es', pageEs: lang === 'es' };
}

/* Build the disclaimer callout for a language from config.disclaimer
   ({ en: "...", es: "..." } — HTML allowed) or '' when unset. */
export function disclaimerBlock(disclaimer, lang) {
  if (!disclaimer) return '';
  const text = (lang === 'es' ? disclaimer.es : disclaimer.en) || disclaimer.en || '';
  if (!text) return '';
  return `<div class="callout disclaimer" role="note">${text}</div>`;
}
