/*
  money.mjs — how a figure in a country's own currency gets written down.

  A third copy averted. generate-country-pages.mjs already carried a comment
  reading "same shape as generate-prices.mjs", which is the polite way of saying
  there were two, and the appliance pages needed a third the moment they started
  costing the same machine out in fourteen currencies. Two copies of a formatter
  drift the way two copies of a formula do: the country page would print
  "1.234 €" and the appliance page "1234 €" for the same number, on two pages
  that link to each other. So it lives here once — the same reason
  appliance-energy.mjs exists.

  generate-prices.mjs keeps its own on purpose. It formats rates below ten and
  never a total, so it never needs a thousands separator, and its helpers close
  over `isEs` rather than taking a lang — swapping them would be a rewrite of
  that file rather than an import into it, for no output change.
*/

export const nf = (v, lang, d = 0) => new Intl.NumberFormat(
  lang === 'es' ? 'es' : 'en',
  { minimumFractionDigits: d, maximumFractionDigits: d },
).format(v);

/* A column of prices only reads as a column when every figure carries the same
   number of decimals. The yen has no sub-unit, so ¥31 stays whole where €0.31
   needs its cents. */
export const dec = (c) => (c.currency === 'JPY' ? 0 : 2);

// A rate: the cents are the point. The symbol goes where that country puts it.
export const priceLabel = (c, v, lang) => {
  const s = nf(v, lang, dec(c));
  return c.pos === 'pre' ? c.symbol + s : s + ' ' + c.symbol;
};

// A total, not a rate: cents on a yearly bill claim a precision the average
// underneath it does not have.
export const moneyLabel = (c, v, lang) => {
  const s = nf(v, lang, 0);
  return c.pos === 'pre' ? c.symbol + s : s + ' ' + c.symbol;
};

/* Dollars are the common basis, so they follow the reader's own convention
   rather than the country's: the stat tiles above one of these tables once
   wrote "0,46 $" in Spanish while the table wrote "$0.46" on the same page. */
export const usdLabel = (v, lang) => (lang === 'es' ? nf(v, lang, 2) + ' $' : '$' + nf(v, lang, 2));
export const usdTotal = (v, lang) => (lang === 'es' ? nf(v, lang, 0) + ' $' : '$' + nf(v, lang, 0));
