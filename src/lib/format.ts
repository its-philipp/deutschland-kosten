/**
 * One formatter for every amount on the site. Amounts are the product here, so
 * they must not drift between a static breakdown table and the live estimator —
 * both go through these.
 */

const EUR = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const EUR_CENTS = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Whole euros. The default everywhere: these are ranges, and cents on an
 * estimate are fake precision (was-kostet/CLAUDE.md → "Ranges, not fake
 * precision").
 */
export function euro(value: number): string {
  return EUR.format(Math.round(value));
}

/**
 * Cents, for regulated fees that are exact by law (GNotKG, RVG, GebOSt) and
 * where rounding would misstate the source.
 */
export function euroExact(value: number): string {
  return EUR_CENTS.format(value);
}

/**
 * The value a formatter will actually show, as a number.
 *
 * Needed to answer one question honestly: do the rounded lines of a breakdown
 * still add up to the rounded total? Often they do not — three energy
 * components of 1.255,50 €, 286,50 € and 292,50 € display as 1.256, 287 and
 * 293, which sums to 1.836 while the total displays as 1.835. Nothing is
 * miscalculated; whole euros simply cannot show halves. But a reader adding the
 * column finds a euro missing, and on a site about costs that reads as an error.
 * So the page detects the case and says so, instead of hiding it or faking
 * precision it does not have.
 */
export function angezeigterWert(value: number, exact: boolean): number {
  return exact ? Math.round(value * 100) / 100 : Math.round(value);
}

/**
 * ISO date → `TT.MM.JJJJ`. Dates are stored ISO (sortable, unambiguous) and
 * read German: "abgerufen am 2026-08-02" inside a German sentence reads like a
 * database field that escaped into the copy.
 *
 * Deliberately string surgery rather than `new Date()`: an ISO date parsed as
 * UTC and formatted in a westward timezone comes out one day early, and a Stand
 * date that drifts by a day is exactly the kind of small lie this site cannot
 * afford. Anything that is not a plain ISO date is passed through untouched.
 */
export function isoToGerman(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : iso;
}
