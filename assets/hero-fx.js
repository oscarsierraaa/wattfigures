/*
  hero-fx.js — interactive "current" field behind the home hero: layered flowing
  sine waves (like an AC signal / oscilloscope trace) in the brand amber + green.
  The waves drift continuously and swell around the cursor. Sits behind the hero
  content (pointer-events none, so it never blocks the calculator). Honours
  prefers-reduced-motion (single static frame) and pauses when the tab is hidden.
  CSP-safe: external file, no inline code.
*/
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  var hero = document.querySelector('.wf-hero');
  if (!hero || !window.requestAnimationFrame) return;

  var canvas = document.createElement('canvas');
  canvas.className = 'hero-fx'; canvas.setAttribute('aria-hidden', 'true');
  hero.insertBefore(canvas, hero.firstChild);
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0, H = 0, t = 0, waves = [];
  var mouse = { x: -999, y: -999, on: false };
  var TINTS = [[247, 168, 27], [57, 208, 137]]; // amber, green

  function build() {
    var r = hero.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var N = Math.max(3, Math.min(5, Math.round(H / 190)));
    waves = [];
    for (var i = 0; i < N; i++) {
      var f = N > 1 ? i / (N - 1) : 0.5;
      waves.push({
        base: H * (0.2 + 0.6 * f),
        amp: 14 + Math.random() * 20,
        len: 380 + Math.random() * 300,     // longer, calmer wavelength
        speed: 0.16 + Math.random() * 0.18, // slower drift
        phase: Math.random() * 6.28,
        breath: 0.25 + Math.random() * 0.3,
        tint: TINTS[i % 2],
        alpha: i % 2 === 0 ? 0.14 : 0.09,
        width: i % 2 === 0 ? 1.4 : 1
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    var step = W > 900 ? 10 : 14, sigma = 150, twoSig2 = 2 * sigma * sigma;
    for (var w = 0; w < waves.length; w++) {
      var wv = waves[w];
      var sway = Math.sin(t * 0.0006 * wv.breath + w) * 14;
      ctx.beginPath();
      for (var x = 0; x <= W + step; x += step) {
        // base wave + a second harmonic for a livelier "signal" shape
        var k = x / wv.len * 6.2832;
        var y = wv.base + sway
          + wv.amp * Math.sin(k + wv.phase)
          + wv.amp * 0.35 * Math.sin(k * 2.3 + wv.phase * 1.7);
        // cursor swell: waves bulge toward/around the pointer
        if (mouse.on) {
          var dx = x - mouse.x;
          var env = Math.exp(-(dx * dx) / twoSig2);
          y += env * (mouse.y - wv.base) * 0.35;
          y += env * wv.amp * 0.9 * Math.sin(k * 1.5 - t * 0.004);
        }
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      // Fade each line in and out horizontally so it never reads as a hard
      // stripe running edge to edge.
      var tnt = wv.tint, rgb = tnt[0] + ',' + tnt[1] + ',' + tnt[2];
      var grad = ctx.createLinearGradient(0, 0, W, 0);
      grad.addColorStop(0, 'rgba(' + rgb + ',0)');
      grad.addColorStop(0.22, 'rgba(' + rgb + ',' + wv.alpha + ')');
      grad.addColorStop(0.6, 'rgba(' + rgb + ',' + (wv.alpha * 0.75) + ')');
      grad.addColorStop(1, 'rgba(' + rgb + ',0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = wv.width; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.shadowBlur = 0;
      ctx.stroke();
    }
    // Soften the top and bottom edges so the field melts into the section.
    ctx.globalCompositeOperation = 'destination-out';
    var fade = ctx.createLinearGradient(0, 0, 0, H);
    fade.addColorStop(0, 'rgba(0,0,0,1)');
    fade.addColorStop(0.22, 'rgba(0,0,0,0)');
    fade.addColorStop(0.8, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = fade; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  }

  function frame() {
    t += 16;
    for (var i = 0; i < waves.length; i++) waves[i].phase += waves[i].speed * 0.02;
    draw();
    raf = requestAnimationFrame(frame);
  }

  var raf = null;
  function start() { if (!reduce && raf == null) raf = requestAnimationFrame(frame); }
  function stop() { if (raf != null) { cancelAnimationFrame(raf); raf = null; } }

  build(); draw();
  if (!reduce) start();

  window.addEventListener('resize', function () { build(); draw(); });
  hero.addEventListener('pointermove', function (e) {
    var r = hero.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.on = true;
  });
  hero.addEventListener('pointerleave', function () { mouse.on = false; });
  document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
})();
