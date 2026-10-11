/*
  Shared theme + i18n runtime for every page.
  Exposes window.Site.* :
    - getTheme() / setTheme('dark'|'light')
    - getLang()  / setLang('EN'|'ES')
    - t(key) / applyI18n(root?)  — swaps every [data-i18n="key"] element's text
    - mountChrome(el)            — injects the theme/language toolbar

  Theme = data-theme on <html> (CSS variables flip). Lang = data-lang on <html>.
  Only generic UI labels live here; page/article content lives in the HTML.
*/
(function () {
  'use strict';
  var LS_THEME = 'site-theme';
  var LS_LANG = 'site-lang';

  // Async Google Fonts: the stylesheet ships media="print" (non-blocking) and
  // is flipped to 'all' here — an external file, because the CSP blocks the
  // classic inline onload= handler.
  document.querySelectorAll('link[data-font-swap]').forEach(function (l) {
    l.media = 'all';
  });

  var T = {
    EN: {
      'ui.theme.dark': 'Dark',
      'ui.theme.light': 'Light',
      'ui.search': 'Search',
      'ui.menu': 'Menu',
      'ui.readMore': 'Read more',
      'ui.relatedReading': 'Related reading',
      'ui.home': 'Home',
      'footer.rights': 'All rights reserved.',
      'footer.about': 'About',
      'footer.contact': 'Contact',
      'footer.privacy': 'Privacy',
      'footer.terms': 'Terms',
      'footer.cookies': 'Cookies',
      'footer.disclosures': 'Disclosures',
      'footer.methodology': 'How we work'
    },
    ES: {
      'ui.theme.dark': 'Oscuro',
      'ui.theme.light': 'Claro',
      'ui.search': 'Buscar',
      'ui.menu': 'Menú',
      'ui.readMore': 'Leer más',
      'ui.relatedReading': 'Lecturas relacionadas',
      'ui.home': 'Inicio',
      'footer.rights': 'Todos los derechos reservados.',
      'footer.about': 'Acerca de',
      'footer.contact': 'Contacto',
      'footer.privacy': 'Privacidad',
      'footer.terms': 'Términos',
      'footer.cookies': 'Cookies',
      'footer.disclosures': 'Divulgaciones',
      'footer.methodology': 'Cómo trabajamos'
    }
  };

  function getTheme() {
    try { return localStorage.getItem(LS_THEME) || 'dark'; } catch (e) { return 'dark'; }
  }
  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(LS_THEME, theme); } catch (e) {}
    updateChrome();
  }
  function getLang() {
    return (document.documentElement.getAttribute('data-lang') || 'EN').toUpperCase();
  }
  function setLang(lang) {
    // Persist for chrome fallback, then navigate to the page's alternate URL
    // (each language is a distinct URL). page.js handles the actual navigation.
    try { localStorage.setItem(LS_LANG, lang); } catch (e) {}
  }
  function t(key) {
    var lang = getLang();
    return (T[lang] && T[lang][key]) || (T.EN && T.EN[key]) || key;
  }
  function applyI18n(root) {
    (root || document).querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
  }

  var chromeEl = null;
  function mountChrome(el) {
    if (!el) return;
    chromeEl = el;
    el.classList.add('site-chrome');
    el.innerHTML =
      '<button class="chrome-btn" data-action="theme" type="button"></button>';
    el.querySelector('[data-action="theme"]').addEventListener('click', function () {
      setTheme(getTheme() === 'dark' ? 'light' : 'dark');
    });
    updateChrome();
  }
  function updateChrome() {
    if (!chromeEl) return;
    var btn = chromeEl.querySelector('[data-action="theme"]');
    if (btn) btn.textContent = getTheme() === 'dark' ? t('ui.theme.light') : t('ui.theme.dark');
  }

  window.Site = {
    getTheme: getTheme, setTheme: setTheme,
    getLang: getLang, setLang: setLang,
    t: t, applyI18n: applyI18n, mountChrome: mountChrome,
    translations: T
  };

  // Mobile navigation: build a hamburger + dropdown from the existing nav links
  // (the desktop .nav-links is hidden at or under 920px). External file → CSP-safe,
  // and it works on every page with no per-page markup.
  function mountMobileNav() {
    var header = document.querySelector('.site-header');
    var links = document.querySelector('.site-header .nav-links');
    var chrome = document.querySelector('.site-header .site-chrome');
    if (!header || !links || !chrome || document.querySelector('.nav-toggle')) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chrome-btn nav-toggle';
    btn.setAttribute('aria-label', t('ui.menu'));
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span class="bars" aria-hidden="true"></span>';
    chrome.insertBefore(btn, chrome.firstChild);

    var menu = document.createElement('nav');
    menu.className = 'mobile-menu';
    menu.setAttribute('aria-label', t('ui.menu'));
    menu.hidden = true;
    var html = '';
    links.querySelectorAll('a').forEach(function (a) {
      html += '<a href="' + a.getAttribute('href') + '">' + a.textContent + '</a>';
    });
    menu.innerHTML = html;
    header.appendChild(menu);

    function onKey(e) { if (e.key === 'Escape') { close(); btn.focus(); } }
    function onDoc(e) { if (!menu.contains(e.target) && e.target !== btn && !btn.contains(e.target)) close(); }
    function open() { menu.hidden = false; btn.setAttribute('aria-expanded', 'true'); document.addEventListener('keydown', onKey); setTimeout(function () { document.addEventListener('click', onDoc); }, 0); }
    function close() { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); document.removeEventListener('keydown', onKey); document.removeEventListener('click', onDoc); }
    btn.addEventListener('click', function () { menu.hidden ? open() : close(); });
    menu.addEventListener('click', function (e) { if (e.target.tagName === 'A') close(); });
    // Close the dropdown if the viewport grows to desktop (avoids a lingering
    // open menu overlapping the desktop nav).
    // Keep this threshold in sync with the CSS breakpoint in shared.css
    // (.nav-links hidden / .nav-toggle shown at <= 920px).
    window.addEventListener('resize', function () { if (window.innerWidth > 920 && !menu.hidden) close(); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    applyI18n();
    var slot = document.getElementById('site-chrome');
    if (slot) mountChrome(slot);
    mountMobileNav();
  });
})();
