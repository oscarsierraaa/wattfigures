/*
  generate-appliance-art.mjs — placeholder artwork for every appliance.

  Writes assets/img/appliances/<slug>.svg: a 4:3 branded panel (dark gradient +
  the site's wave motif) with the appliance's category icon in line art. These
  are stand-ins so the pages are not walls of text; when real photography
  arrives, drop <slug>.webp in the same folder and switch the <img> extension —
  the markup and sizing already match (4:3).

  Run:  node tools/generate-appliance-art.mjs
*/
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(path.join(ROOT, 'data', 'appliances.json'), 'utf-8'));
const OUT = path.join(ROOT, 'assets', 'img', 'appliances');
mkdirSync(OUT, { recursive: true });

// One distinct line drawing per appliance, in a 24×24 box (stroked, no fill).
// Per-appliance on purpose: sharing a category icon makes every card look the
// same, which is exactly what reads as "auto-generated".
const ICONS = {
  // Cold
  'refrigerator':          '<rect x="5.5" y="2" width="13" height="20" rx="2.2"/><path d="M5.5 9.5h13M8.2 5.2v2.2M8.2 12v3"/>',
  'freezer':               '<rect x="2.5" y="7" width="19" height="10.5" rx="2"/><path d="M2.5 10.5h19M17 13.6h2.2"/><path d="M8 3.4v2.2M6.6 4.1l1.4.8 1.4-.8"/>',
  // Laundry
  'washing-machine':       '<rect x="4.5" y="2.5" width="15" height="19" rx="2.2"/><circle cx="12" cy="14" r="4.4"/><path d="M7.6 6h.01M10.4 6h.01M16.4 6h.01"/>',
  'tumble-dryer':          '<rect x="4.5" y="2.5" width="15" height="19" rx="2.2"/><circle cx="12" cy="14" r="4.4"/><path d="M9.8 14a2.2 2.2 0 0 1 4.4 0 2.2 2.2 0 0 0 4.4 0" transform="scale(.55) translate(9.8 11.4)"/><path d="M7.6 6h4"/>',
  'dishwasher':            '<rect x="4.5" y="2.5" width="15" height="19" rx="2.2"/><path d="M4.5 7.5h15M7.5 11h9M7.5 14.5h9M7.5 18h5"/>',
  'clothes-iron':          '<path d="M3 16.5h13.5a4.5 4.5 0 0 0 4.5-4.5V9.5H8.5A5.5 5.5 0 0 0 3 15z"/><path d="M3 19.5h15M7.5 5.5V3.5M11 5.5V3.5"/>',
  // Cooking
  'electric-oven':         '<rect x="3.5" y="3" width="17" height="18" rx="2.2"/><path d="M3.5 8.5h17"/><rect x="6.5" y="11.5" width="11" height="6.5" rx="1.2"/><path d="M6.5 5.8h.01M9.5 5.8h.01"/>',
  'induction-hob':         '<rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="8.5" cy="8.5" r="2.6"/><circle cx="15.5" cy="8.5" r="2.6"/><circle cx="8.5" cy="15.5" r="2.6"/><circle cx="15.5" cy="15.5" r="2.6"/>',
  'microwave':             '<rect x="2" y="5" width="20" height="14" rx="2.2"/><rect x="4.5" y="7.5" width="11" height="9" rx="1.2"/><path d="M18.5 8.5v3M18.5 14.5h.01"/>',
  'electric-kettle':       '<path d="M6.5 9h9l1.2 10.2a1.6 1.6 0 0 1-1.6 1.8H6.9a1.6 1.6 0 0 1-1.6-1.8z"/><path d="M15.5 10.5l3.5-3.5M8 9V7.2h6V9"/>',
  'coffee-machine':        '<path d="M4.5 3h15v6.5h-15z"/><path d="M12 9.5V13"/><path d="M8.5 16h7a3.5 3.5 0 0 1-3.5 3.5A3.5 3.5 0 0 1 8.5 16z"/><path d="M5 21h14"/>',
  'toaster':               '<path d="M3.5 10.5a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3V18a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2z"/><path d="M8 7.5V5M13 7.5V5M20.5 13.5h1.5"/>',
  'slow-cooker':           '<path d="M4.5 9.5h15v6a5 5 0 0 1-5 5h-5a5 5 0 0 1-5-5z"/><path d="M3 9.5h18M9 6.5h6M12 3.5v3"/>',
  // Climate
  'air-conditioner':       '<rect x="2.5" y="4" width="19" height="8" rx="2"/><path d="M5.5 9h13"/><path d="M7 15.5c1.5 1.6 1.5 3.2 0 4.8M12 15.5c1.5 1.6 1.5 3.2 0 4.8M17 15.5c1.5 1.6 1.5 3.2 0 4.8"/>',
  'space-heater':          '<rect x="4.5" y="6.5" width="15" height="14" rx="2.2"/><path d="M8 10.5v6M12 10.5v6M16 10.5v6"/><path d="M9 4c1 -1.2 1 -2 0 -3M15 4c1 -1.2 1 -2 0 -3"/>',
  'ceiling-fan':           '<path d="M12 2.5v3"/><circle cx="12" cy="12" r="2.2"/><path d="M10 10.6C7.5 8.6 4 9 3 11c2 1.6 5.5 1.4 7 -.4M14 10.6c2.5-2 6-1.6 7 .4-2 1.6-5.5 1.4-7-.4M12 14.2c0 3 1.6 5.6 3.6 6.3.6-2.4-.6-5.4-2.6-6.3"/>',
  'dehumidifier':          '<rect x="5" y="2.5" width="14" height="19" rx="2.2"/><path d="M12 7.5c1.8 2.2 2.8 3.8 2.8 5a2.8 2.8 0 0 1-5.6 0c0-1.2 1-2.8 2.8-5z"/><path d="M8.5 18.5h7"/>',
  'electric-blanket':      '<path d="M3 7.5c3-1.6 6-1.6 9 0s6 1.6 9 0v10c-3 1.6-6 1.6-9 0s-6-1.6-9 0z"/><path d="M8 11.5c.8-1 .8-1.8 0-2.8M12 12c.8-1 .8-1.8 0-2.8M16 11.5c.8-1 .8-1.8 0-2.8"/>',
  // Water
  'electric-water-heater': '<rect x="6" y="3" width="12" height="18" rx="4"/><path d="M9 21v1.5M15 21v1.5M6 9h12"/><path d="M12 12.5c1.2 1.5 1.8 2.5 1.8 3.2a1.8 1.8 0 0 1-3.6 0c0-.7.6-1.7 1.8-3.2z"/>',
  'electric-shower':       '<path d="M4 3v6a8 8 0 0 0 8 8"/><path d="M14.5 14.5h7l-1.2-3.5h-4.6z"/><path d="M15.5 19v2M18 18.5v2.5M20.5 19v2"/>',
  // Entertainment / office
  'led-tv':                '<rect x="2" y="3.5" width="20" height="13" rx="1.8"/><path d="M8 20.5h8M12 16.5v4"/>',
  'game-console':          '<path d="M7.5 8h9a5.5 5.5 0 0 1 5.5 5.5 3.5 3.5 0 0 1-6.3 2.1l-.9-1.2H9.2l-.9 1.2A3.5 3.5 0 0 1 2 13.5 5.5 5.5 0 0 1 7.5 8z"/><path d="M6.5 11.5v3M5 13h3M16.5 12h.01M18.5 14h.01"/>',
  'sound-system':          '<rect x="6" y="2.5" width="12" height="19" rx="2"/><circle cx="12" cy="8" r="2.2"/><circle cx="12" cy="16" r="3.2"/>',
  'wifi-router':           '<rect x="3" y="13.5" width="18" height="6.5" rx="2"/><path d="M6.5 16.8h.01M9.5 16.8h.01M17.5 16.8h1.5"/><path d="M8 10.5a5.5 5.5 0 0 1 8 0M10.3 13a2.4 2.4 0 0 1 3.4 0M12 4.5a10 10 0 0 1 6.5 2.4"/>',
  'desktop-pc':            '<rect x="6" y="2.5" width="12" height="19" rx="2"/><path d="M9.5 6h5M9.5 9h5"/><circle cx="12" cy="17" r="1.6"/>',
  'laptop':                '<path d="M5 5.5h14v10H5z"/><path d="M2.5 18.5h19l-1.5-3H4z"/>',
  'monitor':               '<rect x="2.5" y="3.5" width="19" height="12" rx="1.8"/><path d="M12 15.5v3.5M8 21h8"/><path d="M2.5 11.5h19"/>',
  // Lighting / personal
  'led-bulb':              '<path d="M9.5 18.5h5M10.5 21.5h3M12 2.5a7 7 0 0 0-4 12.7c.7.5 1.2 1.3 1.2 2.2h5.6c0-.9.5-1.7 1.2-2.2A7 7 0 0 0 12 2.5z"/><path d="M9.8 8.5L12 11l2.2-2.5"/>',
  'vacuum-cleaner':        '<circle cx="7.5" cy="16.5" r="4.5"/><path d="M7.5 16.5h6.5l3-11h3"/><path d="M11.5 12.5l6 3.5"/><circle cx="7.5" cy="16.5" r="1.3"/>',
  'hair-dryer':            '<path d="M3 6.5h9a5 5 0 0 1 0 10H3z"/><path d="M3 6.5v10M9.5 16.5l1.5 5"/><path d="M18.5 8v2M18.5 13v2M21 10.5h1M21 12.5h1"/>',
};
const FALLBACK = '<path d="M9 2.5v6M15 2.5v6M6 8.5h12v3a6 6 0 0 1-12 0zM12 17.5v4"/>';

function art(iconPaths) {
  // 800×600 panel: gradient ground, soft glow, wave motif, centred icon.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600" role="img">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#191a1f"/><stop offset="1" stop-color="#101116"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.78" cy="0.12" r="0.75">
      <stop offset="0" stop-color="#f7a81b" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#f7a81b" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg)"/>
  <rect width="800" height="600" fill="url(#glow)"/>
  <g fill="none" stroke="#f7a81b" stroke-opacity="0.16" stroke-width="2">
    <path d="M-20 430 C 140 380, 240 480, 400 430 S 660 360, 820 410"/>
    <path d="M-20 480 C 150 440, 250 530, 400 486 S 660 420, 820 465"/>
  </g>
  <g transform="translate(400 300) scale(11) translate(-12 -12)"
     fill="none" stroke="#f7a81b" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.92">
    ${iconPaths}
  </g>
</svg>
`;
}

let n = 0;
const missing = [];
for (const a of data.appliances) {
  if (!ICONS[a.slug]) missing.push(a.slug);
  const svg = art(ICONS[a.slug] || FALLBACK);
  writeFileSync(path.join(OUT, a.slug + '.svg'), svg, 'utf-8');
  n++;
}
console.log(`appliance art: ${n} SVG panels → assets/img/appliances/`);
if (missing.length) console.log(`  ! no dedicated icon (using fallback): ${missing.join(', ')}`);
