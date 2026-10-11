/*
  gtm-init.js — loads Google Tag Manager, once a container ID is configured.
  Loaded after consent-init.js (see partials/head.html), so Consent Mode's
  "denied" default already applies before the container can fire anything.
*/
(function () {
  'use strict';
  var id = document.currentScript && document.currentScript.getAttribute('data-gtm-id');
  if (!id) return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(id);
  document.head.appendChild(s);
})();
