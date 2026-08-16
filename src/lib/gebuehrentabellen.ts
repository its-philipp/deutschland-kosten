/**
 * Statutory fee scales: a fee that is a *function* of a value, not a constant.
 *
 * Every scale here was derived from the statute's own step rule and then
 * checked against every value the statute publishes in its annex — GNotKG
 * Anlage 2 (92 values, Tabelle A and B), FamGKG Anlage 2 (42) and RVG Anlage 2
 * (42), all with **zero deviations**. The check is what makes it safe to
 * compute rather than look up, and computing is necessary because the published
 * tables stop earlier than the cases do: GNotKG at 3 million euro, FamGKG and
 * RVG at 500,000, while § 43 FamGKG allows a Verfahrenswert up to a million.
 *
 * Raw records and the validation runs:
 * `src/data/sources/notar-grundbuch.json`, `src/data/sources/scheidung.json`.
 */

/** One step of a "…and for every started further N euro, add X" rule. */
interface Stufe {
  /** Upper bound of this step. */
  bisWert: number;
  /** The step width — every *started* multiple of it costs one increment. */
  jeAngefangene: number;
  /** The increment. */
  betrag: number;
}

/**
 * The shared shape of §§ 34 GNotKG, 28 FamGKG and 13 RVG: a base fee up to 500
 * euro, then stepwise increments that get coarser as the value grows.
 */
function staffel(grundbetrag: number, stufen: Stufe[]) {
  return (wert: number): number => {
    if (!Number.isFinite(wert) || wert <= 0) return 0;
    if (wert <= 500) return grundbetrag;

    let gebuehr = grundbetrag;
    let vorige = 500;

    for (const stufe of stufen) {
      if (wert > stufe.bisWert) {
        // Whole step consumed — no rounding here, the statute rounds only the
        // final figure and computes further steps from the unrounded value.
        gebuehr += ((stufe.bisWert - vorige) / stufe.jeAngefangene) * stufe.betrag;
        vorige = stufe.bisWert;
        continue;
      }
      const angefangene = Math.ceil((wert - vorige) / stufe.jeAngefangene);
      return round2(gebuehr + angefangene * stufe.betrag);
    }

    // Above the last named step the final step width simply continues.
    const letzte = stufen[stufen.length - 1]!;
    const angefangene = Math.ceil((wert - vorige) / letzte.jeAngefangene);
    return round2(gebuehr + angefangene * letzte.betrag);
  };
}

function round2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

/**
 * GNotKG Tabelle B (§ 34 Abs. 2) — notary fees and Grundbuch fees.
 * Checked against all 92 published values.
 */
export const gnotkgB = staffel(15, [
  { bisWert: 2_000, jeAngefangene: 500, betrag: 4 },
  { bisWert: 10_000, jeAngefangene: 1_000, betrag: 6 },
  { bisWert: 25_000, jeAngefangene: 3_000, betrag: 8 },
  { bisWert: 50_000, jeAngefangene: 5_000, betrag: 10 },
  { bisWert: 200_000, jeAngefangene: 15_000, betrag: 27 },
  { bisWert: 500_000, jeAngefangene: 30_000, betrag: 50 },
  { bisWert: 5_000_000, jeAngefangene: 50_000, betrag: 80 },
  { bisWert: 10_000_000, jeAngefangene: 200_000, betrag: 130 },
  { bisWert: 20_000_000, jeAngefangene: 250_000, betrag: 150 },
  { bisWert: 30_000_000, jeAngefangene: 500_000, betrag: 280 },
]);

/** GNotKG Tabelle A (§ 34 Abs. 2) — court proceedings. */
export const gnotkgA = staffel(40, [
  { bisWert: 2_000, jeAngefangene: 500, betrag: 21 },
  { bisWert: 10_000, jeAngefangene: 1_000, betrag: 22.5 },
  { bisWert: 25_000, jeAngefangene: 3_000, betrag: 30.5 },
  { bisWert: 50_000, jeAngefangene: 5_000, betrag: 40.5 },
  { bisWert: 200_000, jeAngefangene: 15_000, betrag: 140 },
  { bisWert: 500_000, jeAngefangene: 30_000, betrag: 210 },
  { bisWert: Number.MAX_SAFE_INTEGER, jeAngefangene: 50_000, betrag: 210 },
]);

/**
 * FamGKG (§ 28 Abs. 1) — court fees in family matters.
 *
 * Note for anyone extending this file: family matters do **not** use the GKG.
 * Since 1 September 2009 they use the FamGKG, and the two are different
 * statutes with different tables. Checked against all 42 published values.
 */
export const famgkg = staffel(40, [
  { bisWert: 2_000, jeAngefangene: 500, betrag: 21 },
  { bisWert: 10_000, jeAngefangene: 1_000, betrag: 22.5 },
  { bisWert: 25_000, jeAngefangene: 3_000, betrag: 30.5 },
  { bisWert: 50_000, jeAngefangene: 5_000, betrag: 40.5 },
  { bisWert: 200_000, jeAngefangene: 15_000, betrag: 140 },
  { bisWert: 500_000, jeAngefangene: 30_000, betrag: 210 },
  { bisWert: Number.MAX_SAFE_INTEGER, jeAngefangene: 50_000, betrag: 210 },
]);

/** RVG (§ 13 Abs. 1) — lawyers' fees. Checked against all 42 published values. */
export const rvg = staffel(51.5, [
  { bisWert: 2_000, jeAngefangene: 500, betrag: 41.5 },
  { bisWert: 10_000, jeAngefangene: 1_000, betrag: 59.5 },
  { bisWert: 25_000, jeAngefangene: 3_000, betrag: 55 },
  { bisWert: 50_000, jeAngefangene: 5_000, betrag: 86 },
  { bisWert: 200_000, jeAngefangene: 15_000, betrag: 99.5 },
  { bisWert: 500_000, jeAngefangene: 30_000, betrag: 140 },
  { bisWert: Number.MAX_SAFE_INTEGER, jeAngefangene: 50_000, betrag: 175 },
]);

/**
 * Scales a topic config may reference by id.
 *
 * A config names a scale as a string so it stays plain data and can be
 * serialized into the island's props — the maths lives here, in one place that
 * is tested, not in eighty topic files.
 */
export const SKALEN = {
  'gnotkg-a': gnotkgA,
  'gnotkg-b': gnotkgB,
  famgkg,
  rvg,
} as const;

export type SkalenId = keyof typeof SKALEN;

/** Human-readable provenance, printed next to a computed fee. */
export const SKALEN_QUELLE: Record<SkalenId, { label: string; url: string }> = {
  'gnotkg-a': {
    label: '§ 34 GNotKG, Tabelle A',
    url: 'https://www.gesetze-im-internet.de/gnotkg/anlage_2.html',
  },
  'gnotkg-b': {
    label: '§ 34 GNotKG, Tabelle B',
    url: 'https://www.gesetze-im-internet.de/gnotkg/anlage_2.html',
  },
  famgkg: {
    label: '§ 28 FamGKG, Anlage 2',
    url: 'https://www.gesetze-im-internet.de/famgkg/anlage_2.html',
  },
  rvg: {
    label: '§ 13 RVG, Anlage 2',
    url: 'https://www.gesetze-im-internet.de/rvg/anlage_2.html',
  },
};
