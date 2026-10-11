/*
  country-pages.mjs — which countries have a page of their own, and where it
  lives.

  Two tools need to agree on this: generate-country-pages.mjs writes the pages,
  and generate-prices.mjs links to them from the aggregate table. Two copies of
  the list would eventually disagree and the table would link to a 404, so the
  list lives here once — the same reason typicalYearlyKwh was pulled out into
  appliance-energy.mjs.

  Started at four on 2026-07-27 and went to fourteen the same day. Nine
  countries are still out, and not for lack of nerve: CH NO PL MX BR NZ JP IN
  ZA have neither retailer tariffs nor a gas price, so their page would be the
  aggregate table with one number changed. Getting them in means sourcing
  tariffs by hand — there is no open API — which is D1's problem, not this
  file's.
*/
export const COUNTRY_PAGES = [
  'BE', 'IE', 'DE', 'ES',              // the first four
  'FR', 'IT', 'NL', 'PT', 'US',        // retailers + gas
  'GB', 'CA', 'AU',                    // retailers, no gas (and a manual price)
  'AT', 'SE',                          // gas, no retailers
];

export const countrySlug = (name) => name.toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/*
  What a country has to have before it gets a page. Returns the reason it fails,
  or null.

  The bar is not a particular field, it is that the page has something of its
  own to say — otherwise it is the aggregate table with one number changed,
  which is the "low value content" failure mode the 30 appliance pages already
  cost a session to fix.

  Two ways to clear it, and either is enough:

    · real retailer tariffs, which no other page on the site carries;
    · a gas price, which yields the break-even COP — the seasonal efficiency
      above which a heat pump beats a boiler in that country. That runs from
      1.2 in Sweden to 3.6 in Belgium, so it is a genuinely different answer per
      country and not a restated price.

  Austria and Sweden get in on the second alone. Nine countries clear neither.
*/
export function ineligible(c) {
  if (!c) return 'no such country in energy-prices.json';
  for (const k of ['price', 'usd', 'co2', 'source', 'verified']) {
    if (c[k] === undefined || c[k] === null) return `missing ${k}`;
  }
  if (!hasRetail(c) && !hasGas(c)) {
    return 'no retailer tariffs and no gas price — the page would be the country table with one number swapped';
  }
  return null;
}

export const hasRetail = (c) => Array.isArray(c.providers) && c.providers.length >= 2;
export const hasGas = (c) => typeof c.gas === 'number' && c.gas > 0;

/* Break-even COP: the seasonal efficiency at which a heat pump and a 92%
   condensing boiler cost the same to run in this country. Same arithmetic and
   the same boiler efficiency as calculators/heat-pump-vs-gas, so the two can
   never disagree. */
export const BOILER_EFF = 0.92;
export const breakEvenCop = (c) => c.price * BOILER_EFF / c.gas;
