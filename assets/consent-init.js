/*
  consent-init.js — cookie/consent banner + Google Consent Mode v2 defaults.
  Loaded first (before gtm-init.js / ga4-init.js — see partials/head.html) so
  the "denied" default is already in the dataLayer before any tag can fire.

  Why a banner at all: GA4 (and later AdSense) set identifiers that legally
  require opt-in consent for EEA/UK/Swiss visitors before they're set, not
  after. Consent Mode v2 is Google's own mechanism for this — every gtag call
  reads the current consent state, so denying by default and updating on
  accept is enough to keep GA4 from collecting anything until the visitor
  says yes. No cookie of our own is set for tracking; the only thing stored
  is the visitor's yes/no choice, in localStorage, so we don't ask twice.

  CSP-safe: external file, no inline handlers, no third party until consent.
*/
(function () {
  'use strict';
  if (typeof document === 'undefined') return;

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  // Deny ad-related storage everywhere (no ad system is live yet). Analytics
  // is denied by default only where opt-in is legally required before
  // measurement (EEA + UK + Switzerland); gtag.js resolves which default
  // applies to each visitor from its own region signal, so no geo-IP lookup
  // is needed here. wait_for_update gives the banner a moment to read a
  // stored choice before the first tag would fire.
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'granted',
    wait_for_update: 500,
  });
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500,
    region: [
      'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
      'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK',
      'SI', 'ES', 'SE', // EU-27
      'IS', 'LI', 'NO', // EEA (non-EU)
      'GB', 'CH', // UK, Switzerland
    ],
  });

  var LS_KEY = 'wf-consent';
  var isEs = (document.documentElement.lang || 'en').toLowerCase().indexOf('es') === 0;
  var T = isEs
    ? {
        text: 'Usamos cookies esenciales para que el sitio funcione. Con tu permiso, también nos gustaría usar analítica para entender qué páginas ayudan de verdad — nunca para venderte nada ni para anuncios personalizados sin que lo aceptes por separado.',
        accept: 'Aceptar analítica', reject: 'Solo lo esencial', link: 'Más detalle en la política de cookies', manage: 'Cookies',
      }
    : {
        text: 'We use essential cookies to run the site. With your permission we would also like to use analytics to see which pages actually help — never to sell anything or for personalised ads without separate consent for that.',
        accept: 'Accept analytics', reject: 'Essential only', link: 'More detail in the cookie policy', manage: 'Cookies',
      };

  function getStored() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)); } catch (e) { return null; }
  }
  function applyConsent(granted) {
    var state = granted ? 'granted' : 'denied';
    gtag('consent', 'update', {
      analytics_storage: state,
      ad_storage: state, ad_user_data: state, ad_personalization: state,
    });
  }
  function store(granted) {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ granted: granted, ts: Date.now() })); } catch (e) {}
  }

  var bar = null;
  function buildBar() {
    var el = document.createElement('div');
    el.className = 'consent-bar';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', isEs ? 'Aviso de cookies' : 'Cookie notice');
    var cookiesHref = (isEs ? '/es' : '') + '/legal/cookies/';
    el.innerHTML =
      '<div class="consent-bar-in">' +
      '<p>' + T.text + ' <a class="ul-link" href="' + cookiesHref + '">' + T.link + '</a>.</p>' +
      '<div class="consent-actions">' +
      '<button type="button" class="btn btn-ghost" data-consent="reject">' + T.reject + '</button>' +
      '<button type="button" class="btn btn-primary" data-consent="accept">' + T.accept + '</button>' +
      '</div></div>';
    el.querySelector('[data-consent="accept"]').addEventListener('click', function () { choose(true); });
    el.querySelector('[data-consent="reject"]').addEventListener('click', function () { choose(false); });
    return el;
  }
  function choose(granted) {
    applyConsent(granted);
    store(granted);
    hide();
  }
  function show() {
    if (!bar) { bar = buildBar(); document.body.appendChild(bar); }
    requestAnimationFrame(function () { bar.classList.add('is-open'); });
  }
  function hide() {
    if (!bar) return;
    bar.classList.remove('is-open');
  }

  var existing = getStored();
  if (existing && typeof existing.granted === 'boolean') {
    applyConsent(existing.granted);
  } else {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show);
    else show();
  }

  // Small "manage cookies" trigger, added to the footer once it exists, so a
  // visitor who already chose can change their mind later (linked from the
  // cookie policy page's "reopen" mention).
  function injectFooterLink() {
    var nav = document.querySelector('.footer-links');
    if (!nav || nav.querySelector('[data-consent-reopen]')) return;
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'footer-consent-btn'; btn.setAttribute('data-consent-reopen', '');
    btn.textContent = T.manage;
    btn.addEventListener('click', show);
    nav.appendChild(btn);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectFooterLink);
  else injectFooterLink();

  window.Site = window.Site || {};
  window.Site.openConsent = show;
})();
