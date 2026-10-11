/* Theme + language bootstrap (anti-FOUC). Load WITHOUT defer in <head>. */
(function () {
  try {
    var t = localStorage.getItem('site-theme') || 'dark';
    // The page's own declared data-lang is authoritative: each URL is a single
    // language (canonical at /x, mirror at /es/x), so a page renders its own
    // chrome regardless of a stored preference. Fall back to the stored
    // preference only when a page declares no language.
    var declared = document.documentElement.getAttribute('data-lang');
    var l = declared || localStorage.getItem('site-lang') || 'EN';
    document.documentElement.dataset.theme = t;
    document.documentElement.dataset.lang = l;
  } catch (e) {}
})();
