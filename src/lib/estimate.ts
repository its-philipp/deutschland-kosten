import type {
  Amount,
  AmountSpec,
  BreakdownRow,
  EstimateResult,
  EstimatorGroup,
  EstimatorOption,
  Money,
  Selection,
  TopicConfig,
} from '../data/topics/types';
import { SKALEN } from './gebuehrentabellen';

/** Values the user typed, by input id. */
export type Inputs = Record<string, number>;

function isSpec(amount: Amount): amount is AmountSpec {
  return 'kind' in amount;
}

function flat(x: number): Money {
  return { min: x, typ: x, max: x };
}

function scaleMoney(m: Money, f: number): Money {
  return { min: m.min * f, typ: m.typ * f, max: m.max * f };
}

function capMoney(m: Money, cap: number): Money {
  return { min: Math.min(m.min, cap), typ: Math.min(m.typ, cap), max: Math.min(m.max, cap) };
}

/**
 * Turns an amount rule into euros.
 *
 * `basis` carries what the rule may refer to: the running subtotal (in group
 * order) and every amount already counted, by option id. Order is therefore
 * part of the contract — a VAT line has to sit after what it taxes. That is
 * not a quirk of this code, it is how the statutes read: § 27 Abs. 2 PassV
 * doubles *the fee*, VV 7008 RVG taxes *the remuneration*.
 */
export function resolveAmount(
  amount: Amount,
  inputs: Inputs,
  basis: { zwischensumme: Money; byOption: Record<string, Money> },
): Money {
  if (!isSpec(amount)) return amount;

  if (amount.kind === 'skala') {
    const wert = inputs[amount.input] ?? 0;
    const tabelle = SKALEN[amount.skala](wert);
    const gebuehr = tabelle * amount.satz;
    return flat(amount.mindestens ? Math.max(gebuehr, amount.mindestens) : gebuehr);
  }

  if (amount.kind === 'proEinheit') {
    const menge = inputs[amount.input] ?? 0;
    // The band the *household* falls into, priced across the whole quantity —
    // see the note on `proEinheit` in data/topics/types.ts for why this must not
    // be sliced like a progressive tariff.
    const stufe =
      amount.stufen.find((s) => s.bis === undefined || menge < s.bis) ??
      amount.stufen[amount.stufen.length - 1]!;
    return scaleMoney(stufe.preis, menge);
  }

  if (amount.kind === 'summe') {
    // Every part sees the same basis: a sum adds its parts, it does not chain
    // them. Chaining would make the order inside one option significant, which
    // nothing in the contract says and nobody reading a config would expect.
    return amount.teile.reduce<Money>(
      (sum, teil) => addMoney(sum, resolveAmount(teil, inputs, basis)),
      ZERO,
    );
  }

  const ganz =
    amount.von === 'zwischensumme'
      ? basis.zwischensumme
      : Array.isArray(amount.von)
        ? amount.von.reduce<Money>(
            (sum, id) => addMoney(sum, basis.byOption[id] ?? ZERO),
            ZERO,
          )
        : (basis.byOption[amount.von] ?? ZERO);

  // `bezugsteil` picks one end of the reference and treats it as a flat amount
  // (§ 4 Abs. 1 GOT — see the type's doc comment).
  const bezug =
    amount.bezugsteil === 'min'
      ? flat(ganz.min)
      : amount.bezugsteil === 'max'
        ? flat(ganz.max)
        : ganz;

  if (amount.kind === 'faktor') return scaleMoney(bezug, amount.faktor);

  const roh = scaleMoney(bezug, amount.prozent / 100);
  return amount.hoechstens === undefined ? roh : capMoney(roh, amount.hoechstens);
}

/**
 * Fills in every derived input from the typed ones.
 *
 * Called after each change rather than at render time, so anything downstream —
 * a fee scale, the Spannenband, the breakdown — sees one consistent set of
 * numbers instead of recomputing the same rule in three places.
 */
export function withDerived(config: TopicConfig, inputs: Inputs): Inputs {
  const out: Inputs = { ...inputs };
  for (const input of config.inputs ?? []) {
    const rule = input.abgeleitet;
    if (!rule) continue;
    let wert = 0;
    for (const term of rule.terme) {
      const roh = term.inputs.reduce((p, id) => p * (out[id] ?? 0), term.faktor);
      // A floor on a term that is zero would invent a claim nobody made.
      wert += roh > 0 && term.mindestens !== undefined ? Math.max(roh, term.mindestens) : roh;
    }
    out[input.id] = rule.mindestens !== undefined ? Math.max(wert, rule.mindestens) : wert;
  }
  return out;
}

/** Every input at its default — what a page renders before anyone touches it. */
export function defaultInputs(config: TopicConfig): Inputs {
  const inputs: Inputs = {};
  for (const input of config.inputs ?? []) inputs[input.id] = input.default;
  return withDerived(config, inputs);
}

/**
 * The one place a cost total is computed. Pure functions, no Preact — the
 * island uses them, and a static page can call them at build time to print the
 * default range into the instant-answer sentence.
 */

const ZERO: Money = { min: 0, typ: 0, max: 0 };

export function addMoney(a: Money, b: Money): Money {
  return { min: a.min + b.min, typ: a.typ + b.typ, max: a.max + b.max };
}

/**
 * Is this option offered at all, given what is selected elsewhere?
 *
 * An option without a condition is always available. With one, the named group
 * must currently hold one of the listed options — that is what stops a
 * Reisepass surcharge from being added to a Personalausweis.
 */
export function isAvailable(option: EstimatorOption, selection: Selection): boolean {
  if (!option.dependsOn) return true;
  const active = selection[option.dependsOn.group] ?? [];
  return option.dependsOn.options.some((id) => active.includes(id));
}

/**
 * Drops selected options that the current selection no longer allows.
 *
 * Called after every change rather than filtering at display time, so the
 * selection object is at all times a description of a case that can really
 * happen. Switching Reisepass → Personalausweis therefore *forgets* the
 * Express surcharge instead of keeping it invisibly checked.
 */
export function pruneSelection(config: TopicConfig, selection: Selection): Selection {
  const pruned: Selection = {};
  for (const group of config.groups) {
    const active = selection[group.id] ?? [];
    pruned[group.id] = group.options
      .filter((option) => active.includes(option.id) && isAvailable(option, selection))
      .map((option) => option.id);
  }

  // A `single` group is never empty: if its choice fell away, take the first
  // option that is still available.
  for (const group of config.groups) {
    if (group.kind !== 'single' || pruned[group.id]!.length > 0) continue;
    const fallback = group.options.find((option) => isAvailable(option, pruned));
    if (fallback) pruned[group.id] = [fallback.id];
  }

  return pruned;
}

/** A `single` group always has exactly one active option; `multi` may have none. */
export function defaultSelection(config: TopicConfig): Selection {
  const selection: Selection = {};
  for (const group of config.groups) {
    if (group.defaults?.length) {
      selection[group.id] = [...group.defaults];
    } else {
      selection[group.id] = group.kind === 'single' ? [group.options[0]!.id] : [];
    }
  }
  return pruneSelection(config, selection);
}

/**
 * Applies a click. Kept here rather than in the component so the rule "a
 * `single` group can never end up empty" holds everywhere, including for a
 * future URL-state or server-rendered default.
 */
export function toggle(group: EstimatorGroup, current: string[], optionId: string): string[] {
  if (group.kind === 'single') return [optionId];
  return current.includes(optionId)
    ? current.filter((id) => id !== optionId)
    : [...current, optionId];
}

export function estimate(
  config: TopicConfig,
  selection: Selection,
  inputs: Inputs = defaultInputs(config),
): EstimateResult {
  let total = ZERO;
  const rows: BreakdownRow[] = [];
  const byOption: Record<string, Money> = {};

  for (const group of config.groups) {
    const active = selection[group.id] ?? [];
    for (const option of group.options) {
      if (!active.includes(option.id)) continue;
      // Belt and braces: `pruneSelection` should already have removed these,
      // but the total is the number people act on — it never counts an option
      // the selection does not permit.
      if (!isAvailable(option, selection)) continue;

      // Resolved against what is counted *so far*, which is why group order is
      // part of the contract: a factor or a VAT line must follow its basis.
      const amount = resolveAmount(option.amount, inputs, { zwischensumme: total, byOption });
      byOption[option.id] = amount;
      total = addMoney(total, amount);

      rows.push({
        groupLabel: group.label,
        optionLabel: option.label,
        amount,
        note: option.note,
        source: option.source,
      });
    }
  }

  return { total, rows };
}

/**
 * The widest and narrowest total the topic can produce over every possible
 * selection — the Spannenband's track.
 *
 * Computed per group instead of by enumerating combinations: the groups are
 * independent, so the cheapest total is the sum of each group's cheapest
 * contribution (zero for a `multi` group, whose options are all optional) and
 * likewise for the dearest. Linear, and it cannot blow up on a topic with a
 * dozen option groups.
 *
 * Why a fixed track matters: the band has to mean the same thing before and
 * after the user picks something. If the scale followed the current selection,
 * the bar would sit in the same place no matter what was chosen, and the one
 * thing the page is for — seeing that your case is a cheap or an expensive one
 * — would be invisible.
 */
export function topicSpan(
  config: TopicConfig,
  inputs: Inputs = defaultInputs(config),
): { min: number; max: number } {
  const singles = config.groups.filter((g) => g.kind === 'single' && g.options.length);
  const multis = config.groups.filter((g) => g.kind !== 'single' && g.options.length);

  /**
   * The track has to be reachable, not merely arithmetic. Once options can
   * depend on each other, groups are no longer independent, and summing each
   * group's extremes separately would advertise a "bis …" that no real case can
   * produce — a Personalausweis plus every Reisepass surcharge. So the single
   * groups (the ones that decide which world you are in — document type, class,
   * Bundesland) are enumerated, and each multi group is measured *within* that
   * world.
   *
   * Cost is the product of the single groups' option counts, which is small by
   * construction; the guard below keeps a pathological config from hanging the
   * build.
   */
  const combinations = singles.reduce((n, g) => n * g.options.length, 1);
  const worlds: Selection[] =
    combinations <= 4096
      ? singles.reduce<Selection[]>(
          (acc, group) =>
            acc.flatMap((partial) =>
              group.options.map((option) => ({ ...partial, [group.id]: [option.id] })),
            ),
          [{}],
        )
      : // Fallback: treat the single groups as unconstrained. Wider than the
        // truth, never narrower, so the bar still cannot leave its track.
        [Object.fromEntries(singles.map((g) => [g.id, g.options.map((o) => o.id)]))];

  let min = Infinity;
  let max = -Infinity;

  /**
   * Both ends are obtained by actually running `estimate` rather than by adding
   * up each option's extremes.
   *
   * That changed with queue task 1.5: once an amount can be a factor of the
   * subtotal or a fee table applied to a typed value, "the sum of the parts" is
   * not a number the estimator would ever produce. Running the real calculation
   * keeps the track and the bar on the same footing — a bar can no longer land
   * outside its own track because the two were computed by different rules.
   *
   * **The floor is the cheapest *case*, not the empty form.** Deselecting every
   * checkbox reaches 0 €, but nobody buys a house for the notary fee of nothing;
   * a track starting at zero pins the bar to the right-hand end and says
   * nothing. So the floor uses each `multi` group at its declared `defaults` —
   * that is what a config author means by "the normal case" — while the ceiling
   * switches everything on. Topics whose multi groups have no defaults (a pure
   * list of optional surcharges, like Ausweis/Pass) are unaffected: their
   * defaults are empty, so the floor is still the cheapest document.
   *
   * The typed inputs are a second dimension, and both ends are evaluated at the
   * extremes of every input as well as at the current value. Without that the
   * band would rescale on every keystroke and stop being comparable.
   */
  const inputVarianten: Inputs[] = [inputs];
  if ((config.inputs ?? []).length) {
    inputVarianten.push(
      Object.fromEntries((config.inputs ?? []).map((i) => [i.id, i.min])),
      Object.fromEntries((config.inputs ?? []).map((i) => [i.id, i.max])),
    );
  }

  for (const world of worlds) {
    const sparsam: Selection = pruneSelection(config, {
      ...world,
      ...Object.fromEntries(multis.map((g) => [g.id, [...(g.defaults ?? [])]])),
    });
    const voll: Selection = pruneSelection(config, {
      ...world,
      ...Object.fromEntries(multis.map((g) => [g.id, g.options.map((o) => o.id)])),
    });

    for (const werte of inputVarianten) {
      const lo = estimate(config, sparsam, werte).total;
      const hi = estimate(config, voll, werte).total;
      min = Math.min(min, lo.min, hi.min);
      max = Math.max(max, lo.max, hi.max);
    }
  }

  return Number.isFinite(min) ? { min, max } : { min: 0, max: 0 };
}

/** True when a total carries no spread — a statutory fee rather than an estimate. */
export function isExact(total: Money): boolean {
  return Math.abs(total.max - total.min) < 0.005;
}
