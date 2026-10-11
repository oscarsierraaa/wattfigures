/*
  Page interactions: lazy-loaded Pagefind search.
  Dormant unless the page renders its trigger elements, so this file is safe
  to load on every page regardless of which features are enabled.
*/
(function () {
  'use strict';

  // ─── Copy-link button (share row) ─────────────────────────────────────────
  document.querySelectorAll('[data-copy-link]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var canon = document.querySelector('link[rel="canonical"]');
      var url = canon ? canon.getAttribute('href') : location.href;
      var done = function () {
        var prev = btn.textContent;
        btn.textContent = btn.getAttribute('data-copied-label') || '✓';
        setTimeout(function () { btn.textContent = prev; }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, function () {});
      } else {
        var ta = document.createElement('textarea');
        ta.value = url; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (e) {}
        document.body.removeChild(ta);
      }
    });
  });

  // ─── Print button (checklist/printable pages) ─────────────────────────────
  document.querySelectorAll('[data-print]').forEach(function (btn) {
    btn.addEventListener('click', function () { window.print(); });
  });

  // ─── Search (Pagefind), lazy-loaded on first open ─────────────────────────
  var trigger = document.getElementById('search-trigger');
  var modal = document.getElementById('search-modal');
  if (trigger && modal) {
    var loaded = false;
    function depthToRoot() {
      // Count path depth from the page's own canonical so /_pagefind resolves
      // correctly whether the page is at /, /section/, or /section/slug/.
      var canon = document.querySelector('link[rel="canonical"]');
      var p = canon ? canon.getAttribute('href').replace(/^https?:\/\/[^/]+/, '') : location.pathname;
      var segs = p.split('/').filter(Boolean);
      return segs.length ? '../'.repeat(segs.length) : './';
    }
    function open() {
      modal.hidden = false;
      if (!loaded) {
        loaded = true;
        var base = depthToRoot();
        var css = document.createElement('link');
        css.rel = 'stylesheet'; css.href = base + '_pagefind/pagefind-ui.css';
        document.head.appendChild(css);
        var js = document.createElement('script');
        js.src = base + '_pagefind/pagefind-ui.js';
        js.onload = function () {
          /* global PagefindUI */
          new PagefindUI({ element: '#search-ui', showSubResults: true, showImages: true });
          var input = modal.querySelector('input');
          if (input) input.focus();
        };
        document.head.appendChild(js);
      }
    }
    function close() { modal.hidden = true; }
    trigger.addEventListener('click', open);
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); modal.hidden ? open() : close(); }
    });
  }
})();
