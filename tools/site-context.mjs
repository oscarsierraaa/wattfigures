/*
  site-context.mjs — single source of truth for the config-derived feature
  flags and base template context. scaffold.mjs and new-article.mjs used to
  duplicate this logic and drift apart (a breachfolio lesson); both import
  from here now.
*/
export const ARTICLE_SCHEMAS = ['Article', 'TechArticle', 'BlogPosting', 'NewsArticle'];
export const DEFAULT_ROBOTS = '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />';

export function hslToRgb(triplet) {
  const m = String(triplet).trim().match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  const [h, s, l] = m ? [parseFloat(m[1]), parseFloat(m[2]) / 100, parseFloat(m[3]) / 100] : [210, 0.9, 0.5];
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const mm = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + mm) * 255, (g + mm) * 255, (b + mm) * 255];
}

export function hslToHex(triplet) {
  return '#' + hslToRgb(triplet).map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}

export function buildFlags(cfg) {
  const feat = cfg.features || {};
  const nl = feat.newsletter || {};
  const analytics = cfg.analytics || {};
  const verification = cfg.verification || {};
  const publisherId = ((cfg.adsense || {}).publisherId || '').replace(/^ca-/, '');
  const adSlotInArticle = (((cfg.adsense || {}).slots) || {}).inArticle || '';
  const langs = cfg.languages || ['en'];
  const flags = {
    search: !!feat.search,
    heroFx: !!feat.heroFx,
    blog: !!feat.blog,
    newsletter: !!(nl.enabled && nl.backend),
    gtm: !!analytics.gtmId,
    ga4: !!analytics.ga4Id,
    adsense: !!publisherId,
    verifyGoogle: !!verification.google,
    verifyBing: !!verification.bing,
    selfFonts: !!(cfg.theme || {}).selfHostFonts,
    es: langs.includes('es') && langs.length > 1,
  };
  flags.consent = flags.gtm || flags.ga4 || flags.adsense;
  flags.cdnFonts = !flags.selfFonts;
  flags.adslot = !!(flags.adsense && adSlotInArticle);
  return flags;
}

export function buildBase(cfg) {
  const theme = cfg.theme || {};
  const fontSans = theme.fontSans || 'Inter';
  const fontMono = theme.fontMono || 'JetBrains Mono';
  const urlFont = s => s.trim().replace(/\s+/g, '+');
  const publisherId = ((cfg.adsense || {}).publisherId || '').replace(/^ca-/, '');
  return {
    BRAND: cfg.brand, BRAND_HTML: cfg.brand, DOMAIN: cfg.domain,
    FOUNDER: cfg.founder || cfg.brand,
    YEAR: String(new Date().getFullYear()),
    FONT_SANS: fontSans, FONT_MONO: fontMono,
    FONT_SANS_URL: urlFont(fontSans), FONT_MONO_URL: urlFont(fontMono),
    ACCENT: theme.accent || '210 90% 52%',
    ACCENT_2: theme.accent2 || '190 85% 46%',
    ACCENT_DARK: theme.accentDark || '210 90% 34%',
    THEME_COLOR: hslToHex(theme.accentDark || theme.accent || '210 90% 34%'),
    GTM_ID: (cfg.analytics || {}).gtmId || '',
    GA4_ID: (cfg.analytics || {}).ga4Id || '',
    VERIFY_GOOGLE: (cfg.verification || {}).google || '',
    VERIFY_BING: (cfg.verification || {}).bing || '',
    PUBLISHER_ID: publisherId,
    AD_SLOT_IN_ARTICLE: (((cfg.adsense || {}).slots) || {}).inArticle || '',
    ARTICLE_TYPE: ARTICLE_SCHEMAS.includes(cfg.articleSchema) ? cfg.articleSchema : 'Article',
    ROBOTS_META: DEFAULT_ROBOTS,
  };
}
