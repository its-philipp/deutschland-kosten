import { euro } from '../lib/format';

/**
 * The Spannenband — this site's signature element (STATE.md → Design-Richtung).
 * min–typ–max as one bar above every topic page.
 *
 * Deliberately presentational and stateless: the Estimator island (task 1.3)
 * re-renders it with live values as the user picks options, and a static page
 * can render the same component server-side without shipping any JS. One
 * component, so the band cannot look like two different things.
 *
 * The scale is wider than the span on purpose — a bar that always fills its
 * track carries no information. `scaleMin`/`scaleMax` default to a padded
 * version of the topic's own range; a topic config can pass a fixed scale so
 * the band stays comparable while the user changes options.
 */
export interface SpannenbandProps {
  min: number;
  typ: number;
  max: number;
  /** Left end of the track. Defaults to 15 % below `min`, floored at 0. */
  scaleMin?: number;
  /** Right end of the track. Defaults to 15 % above `max`. */
  scaleMax?: number;
  /** Vertical accent (data/verticals.ts → accentFor). */
  accent?: string;
  /** Screen-reader caption, e.g. "Kosten für einen Führerschein Klasse B". */
  label?: string;
  /**
   * Amount formatter — `euro` (whole euros) by default, `euroExact` for topics
   * whose figures are statutory and therefore exact to the cent.
   */
  format?: (value: number) => string;
  /**
   * Overrides how the headline value is read — see `TopicConfig.kennzahl`.
   * `ohne-mitte` drops the marker and the word "typisch" (the GOT names no
   * average rate), `durchschnitt` keeps the marker but stops calling a
   * spreadless figure a statutory fee (a Destatis mean is neither).
   */
  kennzahl?: 'ohne-mitte' | 'durchschnitt';
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export default function Spannenband({
  min,
  typ,
  max,
  scaleMin,
  scaleMax,
  accent = '#101112',
  label = 'Kostenspanne',
  format = euro,
  kennzahl,
}: SpannenbandProps) {
  /**
   * A statutory fee has no spread. Showing a 0.5 %-wide "range" bar next to the
   * marker would be a lie about the data, so the span bar drops out and the
   * caption stops saying "typisch" — the marker alone shows where the fixed fee
   * sits on the topic's scale, which is still worth seeing.
   */
  const exact = Math.abs(max - min) < 0.005;

  /**
   * A range whose source names nothing in the middle. The marker would have to
   * point somewhere, and wherever it pointed would be read as "this is what it
   * costs" — so it goes, and the caption states both ends instead. A single
   * value is unambiguous even here, so the marker comes back once the spread is
   * gone.
   */
  const ohneMitte = kennzahl === 'ohne-mitte' && !exact;

  const lo = scaleMin ?? Math.max(0, min - (max - min || min) * 0.15);
  const hi = scaleMax ?? max + (max - min || max) * 0.15;
  const span = hi - lo || 1;

  const pos = (v: number) => clamp01((v - lo) / span) * 100;
  const left = pos(min);
  const width = Math.max(pos(max) - left, 0.5);
  const typPos = pos(typ);

  const kopf = ohneMitte
    ? 'Spanne:'
    : kennzahl === 'durchschnitt'
      ? 'Durchschnitt:'
      : exact
        ? 'Ihre Gebühr:'
        : 'Typisch:';

  return (
    <figure
      class="spannenband"
      style={`--accent: ${accent}`}
      aria-label={
        ohneMitte
          ? `${label}: ${format(min)} bis ${format(max)}; einen mittleren Wert nennt die Gebührenordnung nicht`
          : kennzahl === 'durchschnitt'
            ? `${label}: ${format(typ)} im Durchschnitt`
            : exact
              ? `${label}: ${format(typ)}, gesetzlich festgelegt`
              : `${label}: ${format(min)} bis ${format(max)}, typisch ${format(typ)}`
      }
    >
      {/* The track. `aria-hidden` — the figure's label already states the
          numbers, and a bar read out tick by tick tells a screen reader user
          nothing. */}
      <div class="relative h-9" aria-hidden="true">
        <div class="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded-full bg-rule"></div>

        {!exact && (
          <div
            class="absolute top-1/2 h-3 -translate-y-1/2 rounded-full bg-(--accent) transition-all duration-200 ease-out"
            style={`left: ${left}%; width: ${width}%`}
          ></div>
        )}

        {/* Typischer Wert: Signalgelb on an ink ring. The yellow is a ground,
            never a line colour — at 1.69:1 on white a bare yellow tick would
            be invisible. */}
        {!ohneMitte && (
          <div
            class="absolute top-1/2 h-6 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border-[1.5px] border-ink bg-signal transition-all duration-200 ease-out"
            style={`left: ${typPos}%`}
          ></div>
        )}
      </div>

      <div class="mt-2 flex items-baseline justify-between gap-3 font-mono text-sm">
        <span class="text-ink-soft">ab {format(lo)}</span>
        <span class="text-ink-soft">bis {format(hi)}</span>
      </div>

      <figcaption class="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-ink-soft">
        <span>{kopf}</span>
        <span class="preis text-base">
          {ohneMitte ? `${format(min)} – ${format(max)}` : format(typ)}
        </span>
        {!exact && !ohneMitte && (
          <span class="text-ink-mute">
            ({format(min)} – {format(max)})
          </span>
        )}
      </figcaption>
    </figure>
  );
}
