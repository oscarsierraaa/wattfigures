/*
  appliance-energy.mjs — how much energy an appliance uses, over any window.

  Lived inside generate-appliances.mjs until the US state price page needed the
  same number: two copies of this formula would eventually disagree, and the
  whole promise of the site is that the figure on the appliance page and the
  figure on the price page are the same figure. One definition, imported twice.

  energyProfile() came later, from Search Console. The appliance pages were
  ranking best on questions they answered worst — "dishwasher power consumption
  per hour" at position 15, "how many kw does a dishwasher use" at 20, "light
  bulb cost per hour", "how much electricity does a dishwasher use per month" —
  while the page opened by explaining that the cost is measured per cycle, not
  in watts and hours. Readers ask in whatever unit is in their head, so the page
  now answers in all of them, and the arithmetic lives here rather than in prose
  where it would rot the way the hand-typed figures did in July.
*/

const DAYS_PER_MONTH = 30.44; // 365/12, the same constant the calculators use.

/*
  Every window a reader might ask for, in kWh, derived from the appliance's own
  usage mode. `basis` tells the renderer which windows are meaningful:

    cycle   measured per cycle, not per hour — a dishwasher's "watts" is a peak
            while the heater is on, so an hourly figure would be a fiction
    always  runs continuously, so the honest hourly figure is the average draw
            over its duty cycle, not the nameplate
    season  only runs part of the year (AC, space heater, blanket, dehumidifier)
    daily   the ordinary case: so many hours a day, every day

  perMonthKwh for a seasonal appliance is a month *inside* the season, which is
  the only reading that isn't misleading — an average across twelve months would
  describe a heater nobody owns.
*/
export function energyProfile(a) {
  const w = a.watts ? a.watts.typical : 0;
  const u = a.usage || {};

  if (u.mode === 'cyclesPerWeek') {
    const perCycle = u.cycleKwh || 0;
    const perWeek = perCycle * (u.default || 0);
    return {
      basis: 'cycle',
      perCycleKwh: perCycle,
      perWeekKwh: perWeek,
      perMonthKwh: perWeek * 52 / 12,
      perYearKwh: perWeek * 52,
      days: 365,
    };
  }

  if (u.mode === 'alwaysOn') {
    const perHour = w / 1000 * (a.dutyCycle || 1);
    const perDay = perHour * 24;
    return {
      basis: 'always',
      perHourKwh: perHour,
      perDayKwh: perDay,
      perWeekKwh: perDay * 7,
      perMonthKwh: perDay * DAYS_PER_MONTH,
      perYearKwh: perDay * 365,
      days: 365,
    };
  }

  // hoursPerDay: appliances that only run part of the year carry a seasonDays
  // figure instead of the full 365 — otherwise "6 h/day" silently means "6 h/day
  // every day of the year including winter", which overstates the cost severalfold.
  //
  // dutyCycle is the same field alwaysOn has used all along, and it means the
  // same thing: the element is not drawing its nameplate for the whole hour. An
  // oven holds temperature by switching the elements off and on, so "an hour of
  // baking" costs well under 2.4 kWh — which is the figure readers arrive
  // searching for ("cost to run oven for 1 hour"). Appliances that really do
  // draw their rating while running carry no dutyCycle and are unaffected.
  const perHour = w / 1000 * (a.dutyCycle || 1);
  const perDay = perHour * (u.default || 0);
  const days = u.seasonDays || 365;
  return {
    basis: u.seasonDays ? 'season' : 'daily',
    perHourKwh: perHour,
    perDayKwh: perDay,
    perWeekKwh: perDay * 7,
    perMonthKwh: perDay * DAYS_PER_MONTH,
    perYearKwh: perDay * days,
    days,
  };
}

// Typical yearly consumption in kWh. Derived from energyProfile rather than
// restated, so the two can never disagree — which is the reason this file exists.
export function typicalYearlyKwh(a) {
  return energyProfile(a).perYearKwh;
}
