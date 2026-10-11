<!doctype html>
<html lang="es" data-theme="dark" data-lang="ES" data-section="guides">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />

  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  <title>{{TITLE}}</title>
  <meta name="description" content="{{DESCRIPTION}}" />
  <meta name="keywords" content="{{KEYWORDS}}" />
  <link rel="canonical" href="{{CANONICAL_URL}}" />

  <link rel="alternate" hreflang="en" href="{{HREFLANG_EN_URL}}" />
  <link rel="alternate" hreflang="es" href="{{CANONICAL_URL}}" />
  <link rel="alternate" hreflang="x-default" href="{{HREFLANG_EN_URL}}" />

  <link rel="icon" href="../../../assets/favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="../../../assets/img/apple-touch-icon.png" />
  <link rel="manifest" href="../../../site.webmanifest" />
  <meta name="theme-color" content="#a55709" />
  <link rel="alternate" type="application/rss+xml" title="WattFigures" href="https://wattfigures.com/es/feed.xml" />

  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="WattFigures" />
  <meta property="og:locale" content="es_ES" />
  <meta property="og:title" content="{{TITLE}}" />
  <meta property="og:description" content="{{DESCRIPTION}}" />
  <meta property="og:url" content="{{CANONICAL_URL}}" />
  <meta property="og:image" content="{{OG_IMAGE}}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{{TITLE}}" />
  <meta name="twitter:description" content="{{DESCRIPTION}}" />
  <meta name="twitter:image" content="{{OG_IMAGE}}" />

  <script src="../../../assets/theme-init.js"></script>

  <link rel="stylesheet" href="../../../assets/shared.css" />
  <link rel="stylesheet" href="../../../assets/tw.css" />

  <link rel="stylesheet" href="../../../assets/fonts.css" />

</head>
<body>

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "headline": "{{HEADLINE}}",
        "description": "{{DESCRIPTION}}",
        "image": "{{OG_IMAGE}}",
        "datePublished": "{{DATE_PUBLISHED}}",
        "dateModified": "{{DATE_PUBLISHED}}",
        "inLanguage": "es",
        "mainEntityOfPage": { "@type": "WebPage", "@id": "{{CANONICAL_URL}}" },
        "author": { "@type": "Person", "name": "Oscar S.", "url": "https://wattfigures.com/es/legal/about/" },
        "publisher": { "@type": "Organization", "name": "WattFigures", "url": "https://wattfigures.com/" }
      },
      { "@type": "BreadcrumbList", "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Inicio", "item": "https://wattfigures.com/es/" },
        { "@type": "ListItem", "position": 2, "name": "Guías de ahorro", "item": "https://wattfigures.com/es/guides/" },
        { "@type": "ListItem", "position": 3, "name": "{{BREADCRUMB_NAME}}", "item": "{{CANONICAL_URL}}" }
      ] },
      { "@type": "FAQPage", "mainEntity": {{FAQ_JSONLD}} }
    ]
  }
  </script>
  <header class="site-header">
    <div class="container">
      <a class="brand font-display" href="../../../es/">WattFigures</a>
      <nav class="nav-links" aria-label="Primary">
        <a href="../../../es/estimator/">Estimador</a>

        <a href="../../../es/calculators/">Calculadoras</a>

        <a href="../../../es/appliances/">Electrodomésticos</a>

        <a href="../../../es/guides/">Guías de ahorro</a>


        <a href="../../../es/legal/about/">Acerca de</a>
      </nav>
      <div class="site-chrome">

        <button class="chrome-btn" id="search-trigger" type="button" aria-label="Search">🔍</button>


        <button class="chrome-btn" id="lang-toggle" type="button" aria-label="Language">EN</button>

        <span id="site-chrome"></span>
      </div>
    </div>
  </header>

  <div id="search-modal" hidden style="position:fixed;inset:0;z-index:60;background:hsl(var(--background)/.9);backdrop-filter:blur(6px);padding:5rem 1.25rem;overflow:auto">
    <div class="container" style="max-width:720px"><div id="search-ui"></div></div>
  </div>

  <main id="main" class="container" style="padding-top:2.5rem">
    <nav aria-label="Breadcrumb" class="print-hide" style="font-size:.85rem;color:hsl(var(--muted-foreground))">
      <a class="ul-link" href="../../../es/">Inicio</a> /
      <a class="ul-link" href="../../../es/guides/">Guías de ahorro</a> / {{BREADCRUMB_NAME}}
    </nav>

    <article class="prose-sec" style="margin-top:1.5rem">
      <h1 class="font-display" style="font-size:clamp(1.8rem,4vw,2.6rem);line-height:1.15">{{HEADLINE}}</h1>
  <div class="article-meta">
    <span>Por <a class="ul-link" href="../../../es/legal/about/">Oscar S.</a></span>
    <span aria-hidden="true">·</span>
    <span>Actualizado: <time datetime="{{DATE_PUBLISHED}}">{{DATE_PUBLISHED}}</time></span>
  </div>

      <p class="lead" style="color:hsl(var(--muted-foreground))">{{LEAD}}</p>
      <div class="callout disclaimer" role="note"><strong>Estimaciones, no facturas:</strong> estas cifras usan potencias típicas y el precio por kWh que introduzcas. Tu coste real depende de tu tarifa, tu uso y tus aparatos concretos. Consulta tu factura o tu contador para cifras exactas.</div>

{{BODY_HTML}}

      <h2 id="faq">Preguntas frecuentes</h2>
{{FAQ_VISIBLE}}
    </article>

    <div class="share-row print-hide">
      <span class="share-label">Compartir:</span>
      <a class="share-btn" href="https://pinterest.com/pin/create/button/?url={{CANONICAL_URL_ENC}}&amp;media={{OG_IMAGE_ENC}}&amp;description={{HEADLINE_ENC}}" target="_blank" rel="noopener nofollow">Pinterest</a>
      <a class="share-btn" href="https://www.facebook.com/sharer/sharer.php?u={{CANONICAL_URL_ENC}}" target="_blank" rel="noopener nofollow">Facebook</a>
      <a class="share-btn" href="https://twitter.com/intent/tweet?url={{CANONICAL_URL_ENC}}&amp;text={{HEADLINE_ENC}}" target="_blank" rel="noopener nofollow">X</a>
      <a class="share-btn" href="https://wa.me/?text={{HEADLINE_ENC}}%20{{CANONICAL_URL_ENC}}" target="_blank" rel="noopener nofollow">WhatsApp</a>
      <button class="share-btn" type="button" data-copy-link data-copied-label="✓">Copiar enlace</button>
    </div>

    <aside class="prose-sec print-hide" style="margin-top:2rem">
      <h2>Lecturas relacionadas</h2>
      <ul>
{{RELATED_ITEMS}}
        <li><a class="ul-link" href="../../../es/guides/">Más en Guías de ahorro</a></li>
      </ul>
    </aside>
  </main>

  <footer class="site-footer print-hide">
    <div class="container">
      <div style="display:flex;flex-wrap:wrap;gap:1.5rem;justify-content:space-between;align-items:center">
        <div>
          <div class="brand font-display" style="font-size:1rem">WattFigures</div>
          <p style="margin:.35rem 0 0;max-width:32rem">Descubre lo que te cuesta cada vatio.</p>
        </div>
        <nav class="footer-links" aria-label="Legal">
          <a href="../../../es/legal/about/" data-i18n="footer.about">Acerca de</a>
          <a href="../../../es/legal/methodology/" data-i18n="footer.methodology">Cómo trabajamos</a>
          <a href="../../../es/legal/contact/" data-i18n="footer.contact">Contacto</a>
          <a href="../../../es/legal/privacy/" data-i18n="footer.privacy">Privacidad</a>
          <a href="../../../es/legal/terms/" data-i18n="footer.terms">Términos</a>
          <a href="../../../es/legal/cookies/" data-i18n="footer.cookies">Cookies</a>
          <a href="../../../es/legal/disclosures/" data-i18n="footer.disclosures">Divulgaciones</a>
        </nav>
      </div>
      <p style="margin:1.5rem 0 0;font-size:.85rem">© 2026 WattFigures. <span data-i18n="footer.rights">All rights reserved.</span></p>
    </div>
  </footer>

  <script src="../../../assets/shared.js"></script>
  <script src="../../../assets/page.js" defer></script>

</body>
</html>
