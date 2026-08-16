import type { VerticalSlug } from '../verticals';

/**
 * The Estimator contract (queue task 1.3).
 *
 * One shared island, `src/components/Estimator.tsx`, renders every cost topic.
 * A topic is data: `src/data/topics/<slug>.ts` exports a `TopicConfig` and
 * never its own logic or its own markup. If a topic needs behaviour this file
 * cannot express, extend the contract — do not fork the component
 * (was-kostet/CLAUDE.md: "never copy-pasted logic").
 */

/**
 * A cost as this site always states it: a range with a typical value.
 *
 * For fees that are exact by law (GNotKG, RVG, PAuswGebV) `min === typ === max`
 * and the UI drops the range language. For market prices the three differ and
 * the assumptions behind them must be visible on the page — that is the whole
 * bargain of `was-kostet/CLAUDE.md` → "Ranges, not fake precision".
 */
export interface Money {
  min: number;
  typ: number;
  max: number;
}

/** Where a figure comes from. Every amount on the site carries one. */
export interface CostSource {
  /** Human-readable, e.g. "§ 1 Abs. 1 PAuswGebV". */
  label: string;
  url: string;
  /**
   * ISO date the source document was actually **fetched and read**.
   *
   * Omit it when the document has not been read. A citation is a pointer; a
   * retrieval date is a claim that someone opened the text on that day, and the
   * page prints it as one ("abgerufen am …"). Writing a date here for a source
   * that could not be retrieved would publish a false provenance claim, which
   * is the same failure mode as an invented price (was-kostet/CLAUDE.md).
   */
  retrieved?: string;
}

/**
 * Restricts an option to the cases it actually applies to.
 *
 * Without this the estimator happily adds a Reisepass-only surcharge to a
 * Personalausweis and prints the sum as a statutory fee — an amount no fee
 * table produces. Options are deltas on a total, so the contract has to be able
 * to say which world a delta belongs to.
 */
export interface OptionCondition {
  /** Id of the group whose current selection decides availability. */
  group: string;
  /** Available only while the named group has one of these options selected. */
  options: string[];
}

/**
 * A number the user types instead of picking — a Kaufpreis, a Nettoeinkommen.
 *
 * Added in queue task 1.5, because three of the five regulated topics turned
 * out to be uncomputable without one: a GNotKG or RVG fee is a *function* of a
 * value the user has to supply, not one of a handful of choices.
 */
export interface EstimatorInput {
  id: string;
  label: string;
  /** One short sentence under the label. */
  help?: string;
  min: number;
  max: number;
  /** Slider granularity. Typing is not restricted to it. */
  step: number;
  default: number;
  /** Rendered after the number in the input row. */
  einheit?: string;
  /**
   * Not a control but a value computed from other inputs — and rendered as a
   * read-out so the reader sees how it came about.
   *
   * Needed because a Verfahrenswert is not something anyone knows off-hand: it
   * is the three-month net income plus a share of it per Versorgungsanrecht,
   * each part with its own statutory floor (§ 43 and § 50 FamGKG). And it has
   * to be assembled *before* the fee table sees it — the tables are degressive,
   * so pushing the parts through separately and adding the results yields a
   * higher fee than the law allows.
   */
  abgeleitet?: {
    /**
     * Summed. Each term multiplies its inputs together and scales by `faktor`.
     * A term's `mindestens` applies only when the term is greater than zero, so
     * "at least 1.000 € in total" does not conjure a Versorgungsausgleich for
     * someone who has no Anrechte.
     */
    terme: { faktor: number; inputs: string[]; mindestens?: number }[];
    /** Floor for the assembled value. */
    mindestens?: number;
  };
}

/**
 * How an option's amount is worked out.
 *
 * A plain `Money` is the common case and stays exactly as it was. The tagged
 * variants exist because regulated fees do things a constant cannot express,
 * and all three turned up while reading the actual statutes:
 *
 * - `skala` — a fee table applied to an input: § 34 GNotKG, § 28 FamGKG,
 *   § 13 RVG. The fee is `satz × Tabellenwert(Eingabe)`.
 * - `faktor` — a multiple of what came before, not a fixed surcharge:
 *   § 27 Abs. 2 PassV *doubles* a fee, the GebOSt raises an overdue
 *   Hauptuntersuchung by 0.2× and prices the Abgasuntersuchung at 0.85× when it
 *   runs as part of the HU, and VAT is 0.19× the subtotal.
 * - `prozent` — a percentage with a ceiling: VV 7002 RVG is 20 % of the fees
 *   but never more than 20 €.
 *
 * Every variant is **plain data**, deliberately: the config is serialized into
 * the island's props, so it cannot carry functions. The arithmetic lives in
 * `lib/estimate.ts` and the scales in `lib/gebuehrentabellen.ts`, where they are
 * checked against the published tables.
 */
export type AmountSpec =
  | {
      kind: 'skala';
      /** Id from `lib/gebuehrentabellen.ts` → `SKALEN`. */
      skala: 'gnotkg-a' | 'gnotkg-b' | 'famgkg' | 'rvg';
      /** Which `EstimatorInput` feeds the scale. */
      input: string;
      /** The Gebührensatz, e.g. 2.0 for KV 21100 GNotKG. */
      satz: number;
      /** Statutory minimum for this fee, if the provision names one. */
      mindestens?: number;
    }
  | {
      kind: 'faktor';
      /**
       * What is multiplied. `'zwischensumme'` = everything counted so far, in
       * group order. A single option id, or a list of them, refers to options
       * that must already have been counted — that is how VAT can be put on the
       * notary's fees without touching the Grundbuch fees beside them, which
       * are not a taxable supply.
       */
      von: 'zwischensumme' | string | string[];
      faktor: number;
      bezugsteil?: Bezugsteil;
    }
  | {
      kind: 'prozent';
      von: 'zwischensumme' | string | string[];
      prozent: number;
      /** Ceiling in euro. VV 7002 RVG needs it. */
      hoechstens?: number;
      bezugsteil?: Bezugsteil;
    }
  | {
      kind: 'proEinheit';
      /** Which `EstimatorInput` supplies the quantity. */
      input: string;
      /**
       * Unit price by band, ascending. `bis` is the band's exclusive upper
       * bound; the last entry omits it and covers everything above.
       *
       * **The whole quantity is priced at the matching band's rate — this is not
       * a progressive tariff.** That is how the official energy statistic is
       * built: the Verbrauchsklasse describes the *household*, not a slice of
       * its kilowatt-hours, and the published average for a class already
       * contains that household's Grundpreis (which is why the per-kWh average
       * falls as consumption rises). Spreading the consumption across bands the
       * way an income tax is computed would produce a number no statistic
       * contains.
       */
      stufen: { bis?: number; preis: Money }[];
    }
  | {
      kind: 'summe';
      /**
       * Parts, all resolved against the *same* basis — the subtotal as it stood
       * before this option. They are added, not chained, so no part may build on
       * another one inside the same sum.
       *
       * Exists because § 4 Abs. 1 GOT does two things at once for one choice by
       * the reader: in an out-of-hours emergency the fee frame moves up by one
       * einfacher Gebührensatz at both ends *and* a flat Notdienstgebühr of
       * 50 € falls due. Splitting that across two options would let someone tick
       * the flat fee without the frame, or lose the flat fee when switching back
       * and forth — a selection that describes a case the regulation does not
       * know.
       */
      teile: Amount[];
    };

/**
 * Which end of a range a rule attaches to.
 *
 * Default `spanne`: the whole range scales, which is what a factor normally
 * means (VAT on a range is a range).
 *
 * `min` takes the reference's lower end as a flat amount, and it exists because
 * § 4 Abs. 1 Satz 1 GOT does exactly that: in the Notdienst the frame runs from
 * the twofold to the fourfold Gebührensatz instead of the single to the
 * threefold — one further *einfacher* Satz on top of each end. Scaling the whole
 * range instead would add the treble rate at the top and overstate an emergency
 * bill by a third.
 */
export type Bezugsteil = 'spanne' | 'min' | 'max';

/** Either a constant or a rule for working one out. */
export type Amount = Money | AmountSpec;

/** One choice the user can make. Its `amount` is a delta on the total. */
export interface EstimatorOption {
  id: string;
  label: string;
  amount: Amount;
  /** Shown with the breakdown row when this option is active. */
  note?: string;
  source?: CostSource;
  /**
   * Only offered — and only ever counted — while this condition holds. An
   * unavailable option is rendered disabled rather than hidden, so the page
   * still tells the reader the surcharge exists and which case it belongs to.
   */
  dependsOn?: OptionCondition;
}

export interface EstimatorGroup {
  id: string;
  label: string;
  /**
   * `single` — exactly one option is always active (radio). Contributes to the
   * total unconditionally.
   * `multi` — zero or more (checkbox). Every option is optional, so the group
   * can contribute nothing.
   */
  kind: 'single' | 'multi';
  options: EstimatorOption[];
  /**
   * Preselected option ids. A `single` group without a default starts on its
   * first option — a `single` group is never empty.
   */
  defaults?: string[];
  /** One short sentence under the group label. Optional. */
  help?: string;
}

export interface TopicConfig {
  slug: string;
  vertical: VerticalSlug;
  /** The H1, phrased as the question people actually type. */
  question: string;
  /** <title>, carries the year (root CLAUDE.md → SEO). */
  title: string;
  /** Meta description, ~150 chars. */
  description: string;
  /**
   * The instant-answer sentence directly under the H1 — the featured-snippet
   * target (docs/CONCEPT.md → Page anatomy). Plain prose, states the range.
   */
  answer: string;
  /**
   * True when every figure is a statutory fee and therefore exact. Drives cent
   * formatting and removes hedging words like "ca." from the UI.
   */
  exact: boolean;
  /**
   * True only once every figure has been read off a primary source that was
   * actually retrieved. Search-engine summaries, recollection and arithmetic
   * cross-checks do not count — was-kostet/CLAUDE.md: "No invented numbers — a
   * made-up price is worse than no page."
   *
   * An unverified topic still builds and still renders, so the estimator can be
   * worked on, but the route emits `noindex`, keeps it out of the sitemap and
   * says on the page that the figures are unconfirmed. It is the same rule the
   * owner set for kommunal-datenbank (QUEUE 3.4: "Missing data ⇒ noindex, never
   * placeholders") applied to figures that exist but are unproven.
   */
  verified: boolean;
  /** Why it is not verified yet. Rendered on the page while `verified` is false. */
  verificationNote?: string;
  /**
   * How the headline number is to be read. Omitted, the UI derives it from the
   * arithmetic: a total with no spread is a fixed statutory fee, a total with a
   * spread has a typical value inside it. Two kinds of source fit neither.
   *
   * - `ohne-mitte` — there is a range but nothing in the middle of it. The GOT
   *   sets a frame from the single to the threefold Gebührensatz and, unlike
   *   § 5 Abs. 2 GOZ, names **no** rate as the average case. So the band may
   *   show the span but must not point at a value inside it, and no single
   *   figure may be printed as "the" price.
   * - `durchschnitt` — a single figure with no spread that is nevertheless not
   *   fixed by law: an official statistical average. Without this the page would
   *   call a Destatis mean "gesetzlich festgelegt".
   */
  kennzahl?: 'ohne-mitte' | 'durchschnitt';
  /**
   * Numbers the user supplies. Rendered above the option groups, because a
   * fee that depends on a value is meaningless until the value is there.
   */
  inputs?: EstimatorInput[];
  groups: EstimatorGroup[];
  /**
   * What the numbers assume — visible on the page, not in a tooltip. Required:
   * a range without its assumptions is a guess with a decimal point.
   */
  assumptions: string[];
  /**
   * The closing sentence under the estimator, when the two defaults do not fit.
   *
   * `exact` decides cent formatting, but it cannot decide wording: a GebOSt fee
   * is cent-exact *and* a range, because the regulation sets a frame and the
   * testing organisation picks a point inside it. Saying "die Gebühren sind
   * gesetzlich festgelegt" there would overclaim.
   */
  hinweis?: string;
  /** Topic-level sources, beyond the per-option ones. */
  sources: CostSource[];
  /** ISO date of the last content review ("Stand"). */
  updated: string;
}

/** One line of the cost breakdown, derived from the active selection. */
export interface BreakdownRow {
  groupLabel: string;
  optionLabel: string;
  amount: Money;
  note?: string;
  source?: CostSource;
}

export interface EstimateResult {
  total: Money;
  rows: BreakdownRow[];
}

/** Selected option ids per group id. */
export type Selection = Record<string, string[]>;
