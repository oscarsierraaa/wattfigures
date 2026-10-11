/*
  legal-content.mjs — bilingual skeletons for the legal/trust pages every
  AdSense site needs. These are structured drafts, not final legal text:
  every [EDIT: …] marker must be replaced with real information before
  submitting the site for AdSense review. {{BRAND}} / {{DOMAIN}} / {{FOUNDER}}
  are substituted by the scaffold.

  The `methodology` page is the E-E-A-T anchor the niche study calls for
  (author + how-we-test pages are the standard fix for "low value content"
  rejections, and mandatory before attempting YMYL-adjacent niches).
*/

export const LEGAL_PAGES = [
  {
    name: 'about',
    en: {
      title: 'About',
      body: `
<h2>What {{BRAND}} is</h2>
<p>[EDIT: two or three honest sentences — what the site covers, who it is for, and the angle that makes it useful. Mirror the homepage description, but in first person.]</p>
<h2>Who runs it</h2>
<p><strong>{{FOUNDER}}</strong> — [EDIT: one short paragraph of real background relevant to the topic: experience, years doing this, why readers should trust the advice]. Editorial decisions are independent and no article is sponsored unless clearly labeled.</p>
<h2>How articles are made</h2>
<p>Every guide is researched and written for this site, tested or verified where possible, and reviewed before publishing. See <a class="ul-link" href="../methodology/">how we work</a> for the full process, and <a class="ul-link" href="../disclosures/">disclosures</a> for how the site makes money.</p>
<h2>Contact</h2>
<p>Questions or corrections: <a class="ul-link" href="../contact/">contact us</a>.</p>`,
    },
    es: {
      title: 'Acerca de',
      body: `
<h2>Qué es {{BRAND}}</h2>
<p>[EDITAR: dos o tres frases honestas — qué cubre el sitio, para quién es y el enfoque que lo hace útil.]</p>
<h2>Quién está detrás</h2>
<p><strong>{{FOUNDER}}</strong> — [EDITAR: un párrafo corto de experiencia real relevante al tema]. Las decisiones editoriales son independientes y ningún artículo está patrocinado salvo que se indique claramente.</p>
<h2>Cómo se hacen los artículos</h2>
<p>Cada guía se investiga y escribe para este sitio, se prueba o verifica cuando es posible y se revisa antes de publicarse. Consulta <a class="ul-link" href="../methodology/">cómo trabajamos</a> y las <a class="ul-link" href="../disclosures/">divulgaciones</a> sobre cómo se financia el sitio.</p>
<h2>Contacto</h2>
<p>Preguntas o correcciones: <a class="ul-link" href="../contact/">contáctanos</a>.</p>`,
    },
  },
  {
    name: 'contact',
    en: {
      title: 'Contact',
      body: `
<p>Email us at <a class="ul-link" href="mailto:hello@{{DOMAIN}}">hello@{{DOMAIN}}</a> — we read everything and usually reply within [EDIT: e.g. 2–3 business days].</p>
<h2>What to include</h2>
<ul>
<li><strong>Corrections:</strong> the article URL and what is wrong — we fix errors fast and note the update.</li>
<li><strong>Suggestions:</strong> topics you want covered.</li>
<li><strong>Business:</strong> advertising or partnership inquiries (see <a class="ul-link" href="../disclosures/">disclosures</a> first).</li>
</ul>
<p>[EDIT: make sure the mailbox above actually exists and is checked — a dead contact address is an easy AdSense-review fail.]</p>`,
    },
    es: {
      title: 'Contacto',
      body: `
<p>Escríbenos a <a class="ul-link" href="mailto:hello@{{DOMAIN}}">hello@{{DOMAIN}}</a> — leemos todo y solemos responder en [EDITAR: p. ej. 2–3 días laborables].</p>
<h2>Qué incluir</h2>
<ul>
<li><strong>Correcciones:</strong> la URL del artículo y qué está mal — corregimos rápido y anotamos la actualización.</li>
<li><strong>Sugerencias:</strong> temas que quieras que cubramos.</li>
<li><strong>Negocios:</strong> publicidad o colaboraciones (lee antes las <a class="ul-link" href="../disclosures/">divulgaciones</a>).</li>
</ul>
<p>[EDITAR: asegúrate de que ese buzón existe de verdad y se revisa — un email de contacto muerto es un suspenso fácil en la revisión de AdSense.]</p>`,
    },
  },
  {
    name: 'privacy',
    en: {
      title: 'Privacy Policy',
      body: `
<p>This policy explains what data {{BRAND}} ({{DOMAIN}}) collects, why, and the choices you have. Responsible party: {{FOUNDER}} — <a class="ul-link" href="mailto:hello@{{DOMAIN}}">hello@{{DOMAIN}}</a>.</p>
<h2>Data we collect</h2>
<ul>
<li><strong>Server logs:</strong> our hosting provider records IP address, user agent and requested URLs for security and error diagnosis. [EDIT: name your host and its retention period.]</li>
<li><strong>Analytics:</strong> [EDIT: if you use Google Analytics/GTM, say so here, state that IPs are truncated/not stored, and link Google's privacy policy. If you use none, say "We run no analytics."]</li>
<li><strong>Contact:</strong> if you email us, we keep the correspondence only to answer you.</li>
<li><strong>Newsletter:</strong> [EDIT: only if enabled — what you store (email), where, and how to unsubscribe.]</li>
</ul>
<h2>Advertising (Google AdSense)</h2>
<p>Once ads serve, this site shows ads through <strong>Google AdSense</strong>. Google and its partners use advertising cookies (including the DoubleClick cookie) to serve ads based on prior visits to this and other websites. You can manage ad personalization at <a class="ul-link" href="https://adssettings.google.com" rel="noopener nofollow">Google Ads Settings</a> and learn how Google uses data at <a class="ul-link" href="https://policies.google.com/technologies/partner-sites" rel="noopener nofollow">policies.google.com</a>. A list of third-party vendors is available at <a class="ul-link" href="https://support.google.com/adsense/answer/9012903" rel="noopener nofollow">Google's ad technology providers page</a>.</p>
<h2>Consent (EEA / UK / Switzerland)</h2>
<p>Visitors from the EEA, UK and Switzerland are shown a consent message from a Google-certified consent management platform (CMP) before any advertising cookies are set. You can change or withdraw your choice at any time from the <a class="ul-link" href="../cookies/">cookie policy</a> page.</p>
<h2>Your rights</h2>
<p>Depending on where you live (GDPR, UK GDPR, CCPA/CPRA), you may have the right to access, correct, delete, or object to the processing of your personal data, and to lodge a complaint with your supervisory authority. To exercise any right, email <a class="ul-link" href="mailto:hello@{{DOMAIN}}">hello@{{DOMAIN}}</a>.</p>
<h2>Changes</h2>
<p>We will update this page when our data practices change and adjust the "last updated" date above.</p>`,
    },
    es: {
      title: 'Política de privacidad',
      body: `
<p>Esta política explica qué datos recoge {{BRAND}} ({{DOMAIN}}), por qué, y qué opciones tienes. Responsable: {{FOUNDER}} — <a class="ul-link" href="mailto:hello@{{DOMAIN}}">hello@{{DOMAIN}}</a>.</p>
<h2>Datos que recogemos</h2>
<ul>
<li><strong>Logs del servidor:</strong> el hosting registra IP, user agent y URLs solicitadas por seguridad y diagnóstico. [EDITAR: nombra tu host y su periodo de retención.]</li>
<li><strong>Analítica:</strong> [EDITAR: si usas Google Analytics/GTM dilo aquí y enlaza la política de Google; si no usas ninguna, di "No usamos analítica".]</li>
<li><strong>Contacto:</strong> si nos escribes, guardamos la correspondencia solo para responderte.</li>
<li><strong>Newsletter:</strong> [EDITAR: solo si está activada — qué guardas (email), dónde, y cómo darse de baja.]</li>
</ul>
<h2>Publicidad (Google AdSense)</h2>
<p>Cuando los anuncios estén activos, este sitio muestra publicidad mediante <strong>Google AdSense</strong>. Google y sus socios usan cookies publicitarias (incluida la cookie de DoubleClick) para mostrar anuncios basados en visitas anteriores a este u otros sitios. Puedes gestionar la personalización en <a class="ul-link" href="https://adssettings.google.com" rel="noopener nofollow">Configuración de anuncios de Google</a> y ver cómo usa Google los datos en <a class="ul-link" href="https://policies.google.com/technologies/partner-sites" rel="noopener nofollow">policies.google.com</a>. La lista de proveedores está en la <a class="ul-link" href="https://support.google.com/adsense/answer/9012903" rel="noopener nofollow">página de proveedores de tecnología publicitaria de Google</a>.</p>
<h2>Consentimiento (EEE / Reino Unido / Suiza)</h2>
<p>A los visitantes del EEE, Reino Unido y Suiza se les muestra un mensaje de consentimiento de una plataforma certificada por Google (CMP) antes de instalar cookies publicitarias. Puedes cambiar o retirar tu elección desde la página de <a class="ul-link" href="../cookies/">política de cookies</a>.</p>
<h2>Tus derechos</h2>
<p>Según tu jurisdicción (RGPD, UK GDPR, CCPA/CPRA) puedes acceder, corregir, borrar u oponerte al tratamiento de tus datos, y reclamar ante tu autoridad de control. Para ejercerlos: <a class="ul-link" href="mailto:hello@{{DOMAIN}}">hello@{{DOMAIN}}</a>.</p>
<h2>Cambios</h2>
<p>Actualizaremos esta página cuando cambien nuestras prácticas y ajustaremos la fecha de "última actualización".</p>`,
    },
  },
  {
    name: 'terms',
    en: {
      title: 'Terms of Use',
      body: `
<p>By using {{DOMAIN}} you accept these terms. If you do not agree, please do not use the site.</p>
<h2>Content is informational</h2>
<p>Everything published here is general information, provided in good faith but without warranties of completeness or fitness for your situation. [EDIT: add the niche-specific line — e.g. "nothing here is veterinary/financial/medical advice" — matching your site's disclaimer.]</p>
<h2>Intellectual property</h2>
<p>Articles, images and original material belong to {{BRAND}} unless stated otherwise. You may link to and quote short excerpts with attribution; republishing whole articles is not allowed.</p>
<h2>External links</h2>
<p>We link to third-party sites we do not control and are not responsible for their content or policies.</p>
<h2>Liability</h2>
<p>To the maximum extent permitted by law, {{BRAND}} is not liable for damages arising from the use of this site or reliance on its content.</p>
<h2>Changes</h2>
<p>We may update these terms; continued use after changes means acceptance. Questions: <a class="ul-link" href="mailto:hello@{{DOMAIN}}">hello@{{DOMAIN}}</a>.</p>`,
    },
    es: {
      title: 'Términos de uso',
      body: `
<p>Al usar {{DOMAIN}} aceptas estos términos. Si no estás de acuerdo, no uses el sitio.</p>
<h2>El contenido es informativo</h2>
<p>Todo lo publicado es información general, ofrecida de buena fe pero sin garantías de exhaustividad ni de idoneidad para tu caso. [EDITAR: añade la línea específica del nicho — p. ej. "nada de esto es consejo veterinario/financiero/médico" — coherente con el disclaimer del sitio.]</p>
<h2>Propiedad intelectual</h2>
<p>Los artículos, imágenes y material original pertenecen a {{BRAND}} salvo indicación contraria. Puedes enlazar y citar extractos breves con atribución; no está permitido republicar artículos completos.</p>
<h2>Enlaces externos</h2>
<p>Enlazamos a sitios de terceros que no controlamos y de cuyos contenidos o políticas no somos responsables.</p>
<h2>Responsabilidad</h2>
<p>En la máxima medida permitida por la ley, {{BRAND}} no responde de daños derivados del uso del sitio o de confiar en su contenido.</p>
<h2>Cambios</h2>
<p>Podemos actualizar estos términos; seguir usando el sitio tras un cambio implica aceptarlo. Dudas: <a class="ul-link" href="mailto:hello@{{DOMAIN}}">hello@{{DOMAIN}}</a>.</p>`,
    },
  },
  {
    name: 'cookies',
    en: {
      title: 'Cookie Policy',
      body: `
<p>Cookies are small files a site stores in your browser. This page lists what {{DOMAIN}} uses and how to control it.</p>
<h2>Categories we use</h2>
<table>
<thead><tr><th>Category</th><th>Purpose</th><th>Examples</th></tr></thead>
<tbody>
<tr><td><strong>Essential</strong></td><td>Remember your theme/language preference. Never used for tracking.</td><td><code>site-theme</code>, <code>site-lang</code> (localStorage)</td></tr>
<tr><td><strong>Analytics</strong></td><td>[EDIT: only if you run analytics — name the tool and cookies, or delete this row.]</td><td>[EDIT]</td></tr>
<tr><td><strong>Advertising</strong></td><td>Once ads serve, Google AdSense and its partners set cookies to measure and personalize ads.</td><td><code>__gads</code>, <code>__gpi</code>, DoubleClick</td></tr>
</tbody>
</table>
<h2>Managing consent</h2>
<p>EEA/UK/Swiss visitors get a consent banner (Google-certified CMP) on first visit; use it to accept, reject, or customize. You can reopen it anytime: [EDIT: add the CMP's "manage consent" link or instructions once ads are live]. You can also clear or block cookies from your browser settings, and opt out of personalized ads at <a class="ul-link" href="https://adssettings.google.com" rel="noopener nofollow">adssettings.google.com</a>.</p>`,
    },
    es: {
      title: 'Política de cookies',
      body: `
<p>Las cookies son pequeños archivos que un sitio guarda en tu navegador. Aquí tienes lo que usa {{DOMAIN}} y cómo controlarlo.</p>
<h2>Categorías que usamos</h2>
<table>
<thead><tr><th>Categoría</th><th>Finalidad</th><th>Ejemplos</th></tr></thead>
<tbody>
<tr><td><strong>Esenciales</strong></td><td>Recordar tu preferencia de tema/idioma. Nunca para rastrear.</td><td><code>site-theme</code>, <code>site-lang</code> (localStorage)</td></tr>
<tr><td><strong>Analítica</strong></td><td>[EDITAR: solo si usas analítica — nombra la herramienta y sus cookies, o borra esta fila.]</td><td>[EDITAR]</td></tr>
<tr><td><strong>Publicidad</strong></td><td>Cuando los anuncios estén activos, Google AdSense y sus socios instalan cookies para medir y personalizar anuncios.</td><td><code>__gads</code>, <code>__gpi</code>, DoubleClick</td></tr>
</tbody>
</table>
<h2>Gestionar el consentimiento</h2>
<p>Los visitantes del EEE/Reino Unido/Suiza ven un banner de consentimiento (CMP certificada por Google) en su primera visita; úsalo para aceptar, rechazar o personalizar. Puedes reabrirlo cuando quieras: [EDITAR: añade el enlace "gestionar consentimiento" de la CMP cuando los anuncios estén activos]. También puedes borrar o bloquear cookies desde tu navegador y desactivar la personalización en <a class="ul-link" href="https://adssettings.google.com" rel="noopener nofollow">adssettings.google.com</a>.</p>`,
    },
  },
  {
    name: 'disclosures',
    en: {
      title: 'Disclosures',
      body: `
<h2>How this site makes money</h2>
<p>{{BRAND}} is funded by display advertising served by Google AdSense. Advertisers never see or influence articles before publication, and ad placements are clearly separated from content.</p>
<h2>Affiliate links</h2>
<p>[EDIT: if you use affiliate links, disclose it plainly here ("if you buy through some links we may earn a commission, at no extra cost to you") and mark those articles. If you don't, say "This site currently uses no affiliate links."]</p>
<h2>Products and reviews</h2>
<p>[EDIT: state how review products are obtained — bought with own money, loaned, or provided by brands — and that opinions remain the site's own.]</p>
<h2>Use of AI tools</h2>
<p>Drafting and research may be assisted by software tools, including AI. Every published article is edited, fact-checked and approved by a human ({{FOUNDER}}), who is responsible for its content.</p>`,
    },
    es: {
      title: 'Divulgaciones',
      body: `
<h2>Cómo se financia este sitio</h2>
<p>{{BRAND}} se financia con publicidad display servida por Google AdSense. Los anunciantes nunca ven ni influyen en los artículos antes de publicarse, y los anuncios están claramente separados del contenido.</p>
<h2>Enlaces de afiliado</h2>
<p>[EDITAR: si usas enlaces de afiliado, decláralo claramente ("si compras a través de algunos enlaces podemos ganar una comisión, sin coste extra para ti") y marca esos artículos. Si no, di "Este sitio no usa enlaces de afiliado actualmente."]</p>
<h2>Productos y análisis</h2>
<p>[EDITAR: indica cómo se consiguen los productos analizados — comprados, prestados o cedidos por marcas — y que las opiniones son propias.]</p>
<h2>Uso de herramientas de IA</h2>
<p>La redacción e investigación pueden apoyarse en herramientas de software, incluida IA. Cada artículo publicado lo edita, verifica y aprueba una persona ({{FOUNDER}}), responsable de su contenido.</p>`,
    },
  },
  {
    name: 'methodology',
    en: {
      title: 'How we work',
      body: `
<h2>Research</h2>
<p>[EDIT: describe honestly how articles are researched for THIS niche — primary sources used, hands-on testing, data collected, people consulted.]</p>
<h2>Testing &amp; verification</h2>
<p>[EDIT: what "tested" means here — e.g. "every product reviewed is used for at least two weeks", "every fix is reproduced on a real device", "every cost table is recalculated from current public prices". Be concrete; this page is what separates the site from generic content.]</p>
<h2>Updates</h2>
<p>Evergreen guides are reviewed [EDIT: e.g. every 6–12 months] and whenever the underlying facts change. Each article shows its last-updated date.</p>
<h2>Corrections</h2>
<p>If we got something wrong, we fix the article and note the correction. Report errors via the <a class="ul-link" href="../contact/">contact page</a> — corrections are prioritized over new content.</p>
<h2>Who writes</h2>
<p>Content is written and reviewed by {{FOUNDER}} — background on the <a class="ul-link" href="../about/">about page</a>.</p>`,
    },
    es: {
      title: 'Cómo trabajamos',
      body: `
<h2>Investigación</h2>
<p>[EDITAR: describe honestamente cómo se investigan los artículos de ESTE nicho — fuentes primarias, pruebas propias, datos recogidos, personas consultadas.]</p>
<h2>Pruebas y verificación</h2>
<p>[EDITAR: qué significa "probado" aquí — p. ej. "cada producto analizado se usa al menos dos semanas", "cada solución se reproduce en un dispositivo real", "cada tabla de costes se recalcula con precios públicos actuales". Sé concreto; esta página es la que separa el sitio del contenido genérico.]</p>
<h2>Actualizaciones</h2>
<p>Las guías evergreen se revisan [EDITAR: p. ej. cada 6–12 meses] y siempre que cambien los datos de fondo. Cada artículo muestra su fecha de actualización.</p>
<h2>Correcciones</h2>
<p>Si nos equivocamos, corregimos el artículo y anotamos la corrección. Avisa desde la <a class="ul-link" href="../contact/">página de contacto</a> — las correcciones tienen prioridad sobre el contenido nuevo.</p>
<h2>Quién escribe</h2>
<p>El contenido lo escribe y revisa {{FOUNDER}} — más detalles en <a class="ul-link" href="../about/">acerca de</a>.</p>`,
    },
  },
];
