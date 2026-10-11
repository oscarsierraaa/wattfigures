#!/usr/bin/env node
/*
  generate-og.mjs — writes a 1200×630 og-default.png from the site's theme
  colors (diagonal gradient + soft glows), so a freshly scaffolded site never
  ships broken og:image/twitter:image/JSON-LD image URLs. Pure node (zlib),
  no image dependencies. Replace with real photography per article ASAP —
  Discover and Pinterest reward real images; this is only the safe default.

  CLI (from a generated site): node tools/generate-og.mjs
  API: writeOgImage({ accent, accent2, accentDark }, outPath)  // HSL triplets
*/
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { deflateSync } from 'zlib';
import path from 'path';
import { fileURLToPath } from 'url';
import { hslToRgb } from './site-context.mjs';

const W = 1200, H = 630;

// ── PNG plumbing ────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
function encodePng(raw, w, h) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit, truecolor RGB
  return Buffer.concat([PNG_SIG, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

export function writeOgImage(colors, outPath) {
  const cDark = hslToRgb(colors.accentDark || colors.accent);
  const cMain = hslToRgb(colors.accent);
  const cGlow = hslToRgb(colors.accent2 || colors.accent);

  // One filter byte (0 = None) per row + 3 bytes per pixel.
  const raw = Buffer.alloc(H * (1 + W * 3));
  const g1x = W * 0.82, g1y = H * 0.2, g1r = W * 0.5;   // accent2 glow, top right
  const g2x = W * 0.12, g2y = H * 0.9, g2r = W * 0.55;  // accent glow, bottom left
  for (let y = 0; y < H; y++) {
    let o = y * (1 + W * 3);
    raw[o++] = 0;
    for (let x = 0; x < W; x++) {
      const t = (x / W + y / H) / 2; // diagonal gradient accentDark → accent
      let r = cDark[0] + (cMain[0] - cDark[0]) * t;
      let g = cDark[1] + (cMain[1] - cDark[1]) * t;
      let b = cDark[2] + (cMain[2] - cDark[2]) * t;
      const d1 = Math.hypot(x - g1x, y - g1y);
      if (d1 < g1r) {
        const a = 0.55 * (1 - d1 / g1r) ** 2;
        r += (cGlow[0] - r) * a; g += (cGlow[1] - g) * a; b += (cGlow[2] - b) * a;
      }
      const d2 = Math.hypot(x - g2x, y - g2y);
      if (d2 < g2r) {
        const a = 0.35 * (1 - d2 / g2r) ** 2;
        r += (255 - r) * a * 0.25; g += (255 - g) * a * 0.25; b += (255 - b) * a * 0.25;
      }
      raw[o++] = Math.max(0, Math.min(255, r | 0));
      raw[o++] = Math.max(0, Math.min(255, g | 0));
      raw[o++] = Math.max(0, Math.min(255, b | 0));
    }
  }

  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, encodePng(raw, W, H));
  return outPath;
}

/* Square brand icon (192/512/180): same diagonal gradient + one glow.
   Placeholder — replace with a real logo ASAP, like og-default.png. */
export function writeIconImage(colors, size, outPath) {
  const cDark = hslToRgb(colors.accentDark || colors.accent);
  const cMain = hslToRgb(colors.accent);
  const cGlow = hslToRgb(colors.accent2 || colors.accent);
  const raw = Buffer.alloc(size * (1 + size * 3));
  const gx = size * 0.72, gy = size * 0.28, gr = size * 0.75;
  for (let y = 0; y < size; y++) {
    let o = y * (1 + size * 3);
    raw[o++] = 0;
    for (let x = 0; x < size; x++) {
      const t = (x / size + y / size) / 2;
      let r = cDark[0] + (cMain[0] - cDark[0]) * t;
      let g = cDark[1] + (cMain[1] - cDark[1]) * t;
      let b = cDark[2] + (cMain[2] - cDark[2]) * t;
      const d = Math.hypot(x - gx, y - gy);
      if (d < gr) {
        const a = 0.5 * (1 - d / gr) ** 2;
        r += (cGlow[0] - r) * a; g += (cGlow[1] - g) * a; b += (cGlow[2] - b) * a;
      }
      raw[o++] = Math.max(0, Math.min(255, r | 0));
      raw[o++] = Math.max(0, Math.min(255, g | 0));
      raw[o++] = Math.max(0, Math.min(255, b | 0));
    }
  }
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, encodePng(raw, size, size));
  return outPath;
}

// CLI: regenerate og-default.png inside a generated site.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const cfg = JSON.parse(readFileSync(path.join(ROOT, 'site.config.json'), 'utf-8'));
  const theme = cfg.theme || {};
  const out = writeOgImage(
    { accent: theme.accent || '210 90% 52%', accent2: theme.accent2, accentDark: theme.accentDark },
    path.join(ROOT, 'assets', 'img', 'og-default.png')
  );
  console.log('og image written: ' + path.relative(ROOT, out));
  for (const [size, name] of [[192, 'icon-192.png'], [512, 'icon-512.png'], [180, 'apple-touch-icon.png']]) {
    writeIconImage({ accent: theme.accent || '210 90% 52%', accent2: theme.accent2, accentDark: theme.accentDark },
      size, path.join(ROOT, 'assets', 'img', name));
  }
  console.log('icons written: icon-192, icon-512, apple-touch-icon');
}
