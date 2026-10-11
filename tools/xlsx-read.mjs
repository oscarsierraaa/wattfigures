/*
  xlsx-read.mjs — read a small xlsx without a spreadsheet dependency.

  An xlsx is a zip of XML. Two data tools need to read one (the EIA workbooks
  behind data/us-states.json and the US figure in data/energy-prices.json), and
  adding a spreadsheet library for two files a month is not a trade worth
  making — so this reads the zip directly with zlib and pulls the two members
  that matter.

  Only handles what those workbooks actually use: stored and deflated entries,
  the shared string table, and the first worksheet. It is not a general xlsx
  reader and should not pretend to be one.
*/
import { inflateRawSync } from 'node:zlib';

// ── minimal zip reader ──────────────────────────────────────────────────────
export function unzip(buf) {
  // The end-of-central-directory record is last, after a comment of unknown
  // length, so scan backwards for its signature.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip: no end-of-central-directory record');

  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('corrupt central directory');
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    // The local header repeats name/extra with its own lengths — the extra
    // field commonly differs from the central one, so read it, don't assume.
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const start = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(start, start + compSize);
    files[name] = method === 0 ? raw : inflateRawSync(raw);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

// ── sheet parsing ───────────────────────────────────────────────────────────
// Returns one object per non-empty row, keyed by column letter: { A: 'Texas',
// B: '15.23', … }. Shared strings are resolved; numbers stay as strings so the
// caller decides on rounding.
export function readSheet(files, sheet = 'xl/worksheets/sheet1.xml') {
  const strings = [...files['xl/sharedStrings.xml'].toString('utf8').matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map((m) => [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('').replace(/\s+/g, ' ').trim());
  const xml = files[sheet].toString('utf8');
  const rows = [];
  for (const r of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {};
    for (const c of r[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g)) {
      const v = (c[3].match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      if (v === undefined) continue;
      cells[c[1]] = /t="s"/.test(c[2]) ? strings[+v] : v;
    }
    if (cells.A) rows.push(cells);
  }
  return rows;
}

// Fetch an xlsx over HTTP and return its rows in one step.
export async function fetchSheet(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
  return readSheet(unzip(Buffer.from(await res.arrayBuffer())));
}
