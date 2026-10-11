/*
  ga4-init.js — loads GA4 (gtag.js), once a measurement ID is configured.
  Loaded after consent-init.js (see partials/head.html), so Consent Mode's
  "denied" default is already in the dataLayer before gtag.js's own script
  even starts downloading — nothing is collected until the visitor accepts.
*/
(function () {
  'use strict';
  var id = document.currentScript && document.currentScript.getAttribute('data-ga4-id');
  if (!id) return;
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  gtag('js', new Date());
  gtag('config', id);
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
  document.head.appendChild(s);
})();
