#!/usr/bin/env node
/*
  fetch-us-states.mjs — refresh data/us-states.json from the EIA.

    node tools/fetch-us-states.mjs

  Source: U.S. Energy Information Administration, Electric Power Monthly,
  Table 5.6.A "Average Price of Electricity to Ultimate Customers by End-Use
  Sector, by State" (Form EIA-861M). Work of the U.S. federal government, so
  public domain — but the page still credits it, same as Ember and Our World
  in Data on legal/methodology/.

  NOT part of `npm run build`: the EIA replaces this workbook monthly, so this
  runs when someone decides to update the figures, and the result is committed.
  Re-running it on every build would make the site's prices change under CI
  with nobody reading them first.

  The workbook is an xlsx, i.e. a zip of XML. Rather than add a spreadsheet
  dependency for one file a month, tools/xlsx-read.mjs reads the zip directly
  with zlib. fetch-prices.mjs reads the same workbook, hence the shared module.
*/
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchSheet } from './xlsx-read.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const XLSX_URL = 'https://www.eia.gov/electricity/monthly/xls/table_5_06_a.xlsx';
const TABLE_URL = 'https://www.eia.gov/electricity/monthly/epm_table_grapher.php?t=epmt_5_6_a';

// code, English, Spanish. Only the names that actually differ are translated:
// "Texas" and "Florida" are written the same, "Nueva York" and "Luisiana" are not.
const STATES = [
  ['AL', 'Alabama', 'Alabama'], ['AK', 'Alaska', 'Alaska'], ['AZ', 'Arizona', 'Arizona'],
  ['AR', 'Arkansas', 'Arkansas'], ['CA', 'California', 'California'], ['CO', 'Colorado', 'Colorado'],
  ['CT', 'Connecticut', 'Connecticut'], ['DE', 'Delaware', 'Delaware'],
  ['DC', 'District of Columbia', 'Distrito de Columbia'], ['FL', 'Florida', 'Florida'],
  ['GA', 'Georgia', 'Georgia'], ['HI', 'Hawaii', 'Hawái'], ['ID', 'Idaho', 'Idaho'],
  ['IL', 'Illinois', 'Illinois'], ['IN', 'Indiana', 'Indiana'], ['IA', 'Iowa', 'Iowa'],
  ['KS', 'Kansas', 'Kansas'], ['KY', 'Kentucky', 'Kentucky'], ['LA', 'Louisiana', 'Luisiana'],
  ['ME', 'Maine', 'Maine'], ['MD', 'Maryland', 'Maryland'], ['MA', 'Massachusetts', 'Massachusetts'],
  ['MI', 'Michigan', 'Míchigan'], ['MN', 'Minnesota', 'Minnesota'], ['MS', 'Mississippi', 'Misisipi'],
  ['MO', 'Missouri', 'Misuri'], ['MT', 'Montana', 'Montana'], ['NE', 'Nebraska', 'Nebraska'],
  ['NV', 'Nevada', 'Nevada'], ['NH', 'New Hampshire', 'Nuevo Hampshire'],
  ['NJ', 'New Jersey', 'Nueva Jersey'], ['NM', 'New Mexico', 'Nuevo México'],
  ['NY', 'New York', 'Nueva York'], ['NC', 'North Carolina', 'Carolina del Norte'],
  ['ND', 'North Dakota', 'Dakota del Norte'], ['OH', 'Ohio', 'Ohio'], ['OK', 'Oklahoma', 'Oklahoma'],
  ['OR', 'Oregon', 'Oregón'], ['PA', 'Pennsylvania', 'Pensilvania'],
  ['RI', 'Rhode Island', 'Rhode Island'], ['SC', 'South Carolina', 'Carolina del Sur'],
  ['SD', 'South Dakota', 'Dakota del Sur'], ['TN', 'Tennessee', 'Tennessee'], ['TX', 'Texas', 'Texas'],
  ['UT', 'Utah', 'Utah'], ['VT', 'Vermont', 'Vermont'], ['VA', 'Virginia', 'Virginia'],
  ['WA', 'Washington', 'Washington'], ['WV', 'West Virginia', 'Virginia Occidental'],
  ['WI', 'Wisconsin', 'Wisconsin'], ['WY', 'Wyoming', 'Wyoming'],
];

// Column layout of table 5.6.A: A is the row label, then each sector takes two
// columns, current period then year-ago.
const COL = { residential: 'B', residential_prev: 'C', commercial: 'D', all_sectors: 'J' };
const num = (x) => (x === undefined || x === '--') ? null : Math.round(parseFloat(x) * 100) / 100;

const rows = await fetchSheet(XLSX_URL);
const byName = new Map(rows.map((r) => [r.A.trim(), r]));

// Row 2 carries the period, e.g. "by State, May 2026 and 2025 (Cents per Kilowatthour)".
const heading = (rows[1] && rows[1].A) || '';
const m = heading.match(/([A-Z][a-z]+)\s+(\d{4})\s+and\s+(\d{4})/);
if (!m) throw new Error(`could not read the period from the sheet heading: "${heading}"`);
const [, month, year, yearPrev] = m;

const states = STATES.map(([code, name, name_es]) => {
  const r = byName.get(name);
  if (!r) throw new Error(`EIA table has no row for ${name} — did the sheet layout change?`);
  const cents = num(r[COL.residential]);
  if (cents === null) throw new Error(`${name} has no residential price`);
  return {
    code, name, name_es, cents,
    cents_prev: num(r[COL.residential_prev]),
    commercial_cents: num(r[COL.commercial]),
    all_sectors_cents: num(r[COL.all_sectors]),
  };
});

const usTotal = byName.get('U.S. Total');
if (!usTotal) throw new Error('EIA table has no "U.S. Total" row');

const out = {
  meta: {
    period: `${month} ${year}`,
    period_prev: `${month} ${yearPrev}`,
    updated: new Date().toISOString().slice(0, 10),
    unit: 'cents per kWh',
    us_average_cents: num(usTotal[COL.residential]),
    us_average_cents_prev: num(usTotal[COL.residential_prev]),
    sector: 'residential',
    source: 'U.S. Energy Information Administration, Electric Power Monthly, Table 5.6.A — Average Price of Electricity to Ultimate Customers by End-Use Sector, by State. Form EIA-861M. Public domain (work of the U.S. federal government).',
    source_url: TABLE_URL,
    note: 'Residential average retail price. EIA figures are preliminary estimates and cover the whole state: your own rate depends on your utility, tariff and time of use.',
  },
  states,
};

writeFileSync(path.join(ROOT, 'data', 'us-states.json'), JSON.stringify(out, null, 1) + '\n', 'utf-8');
console.log(`✓ data/us-states.json — ${states.length} jurisdictions, ${out.meta.period}, US average ${out.meta.us_average_cents} c/kWh`);
console.log('  run `npm test` then `node tools/generate-us-states.mjs` to rebuild the page.');
