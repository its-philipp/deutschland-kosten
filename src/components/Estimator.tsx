import { useMemo, useState } from 'preact/hooks';
import Spannenband from './Spannenband';
import {
  defaultInputs,
  defaultSelection,
  estimate,
  isAvailable,
  pruneSelection,
  resolveAmount,
  toggle,
  topicSpan,
  withDerived,
} from '../lib/estimate';
import { angezeigterWert, euro, euroExact, isoToGerman } from '../lib/format';
import { accentFor } from '../data/verticals';
import type { EstimatorGroup, Money, TopicConfig } from '../data/topics/types';

/**
 * The one estimator for every cost topic (queue task 1.3). It knows nothing
 * about any particular topic — everything comes from the `TopicConfig` it is
 * handed. A topic that needs different behaviour extends
 * `data/topics/types.ts`; it does not get its own component.
 *
 * Layout order is deliberate and matches docs/CONCEPT.md → Page anatomy:
 * the Spannenband sits ABOVE the controls, so the answer is on screen before
 * the user touches anything and then moves while they answer. No ad may be
 * placed inside this component — form and result are one surface
 * (root CLAUDE.md → Advertising slots).
 */
interface Props {
  config: TopicConfig;
}

export default function Estimator({ config }: Props) {
  const [selection, setSelection] = useState(() => defaultSelection(config));
  const [inputs, setInputs] = useState(() => defaultInputs(config));

  const accent = accentFor(config.vertical);
  const format = config.exact ? euroExact : euro;

  /**
   * Where a source names no middle value, no single figure may be printed as
   * "the" amount — not in the sum, not on a chip. Both fall back to the same
   * rule the breakdown rows have always used: state both ends, and only collapse
   * to one figure when the two ends agree.
   */
  const betrag = (m: Money) =>
    config.kennzahl !== 'ohne-mitte' || Math.abs(m.max - m.min) < 0.005
      ? format(m.typ)
      : `${format(m.min)} – ${format(m.max)}`;

  // The track moves with the typed values, because for a fee that scales with a
  // Kaufpreis a fixed track would be meaningless — every case would sit at the
  // same spot. What stays fixed is the track *for a given input*, which is what
  // makes "is my case a cheap or an expensive one" answerable.
  const span = useMemo(() => topicSpan(config, inputs), [config, inputs]);
  const { total, rows } = useMemo(
    () => estimate(config, selection, inputs),
    [config, selection, inputs],
  );

  /**
   * Rows that contribute nothing are left out of the table. They exist as
   * options so a `single` group can offer "keine" as a real choice — the chip
   * row already shows that it is selected, and a line reading "Keine · 0,00 €"
   * in a cost breakdown is noise, not information.
   */
  const sichtbareZeilen = rows.filter((row) => row.amount.min !== 0 || row.amount.max !== 0);

  /**
   * `estimate` builds the total by adding exactly these rows, so before
   * rounding the column always agrees with the sum. After rounding it may not —
   * see `angezeigterWert`. Said out loud only when it actually happens.
   */
  const runde = (value: number) => angezeigterWert(value, config.exact);
  const rundungsdifferenz = (['min', 'max'] as const).some((ende) => {
    const zeilen = rows.reduce((sum, row) => sum + runde(row.amount[ende]), 0);
    return Math.abs(zeilen - runde(total[ende])) >= 0.005;
  });

  // Every write goes through here, so a derived value can never lag behind the
  // number it is derived from.
  function setInput(id: string, wert: number) {
    setInputs((prev) => withDerived(config, { ...prev, [id]: wert }));
  }

  function choose(group: EstimatorGroup, optionId: string) {
    setSelection((prev) =>
      // Pruned on every change: switching the document type has to drop the
      // surcharges that belong to the other one, or the total states a fee
      // combination that does not exist.
      pruneSelection(config, {
        ...prev,
        [group.id]: toggle(group, prev[group.id] ?? [], optionId),
      }),
    );
  }

  return (
    <div class="sheet p-5 sm:p-7" style={`--accent: ${accent}`}>
      <div aria-live="polite">
        <Spannenband
          min={total.min}
          typ={total.typ}
          max={total.max}
          scaleMin={span.min}
          scaleMax={span.max}
          accent={accent}
          format={format}
          label={config.question}
          kennzahl={config.kennzahl}
        />
      </div>

      {(config.inputs ?? []).length > 0 && (
        <div class="mt-7 flex flex-col gap-5 border-b border-rule pb-6">
          {config.inputs!.map((input) =>
            input.abgeleitet ? (
              <div key={input.id} class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span class="font-display text-sm font-bold tracking-wide uppercase">
                  {input.label}
                </span>
                <span class="font-mono text-sm tabular-nums">
                  {inputs[input.id]?.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                  {input.einheit ? ` ${input.einheit}` : ''}
                </span>
                {input.help && (
                  <span class="w-full text-sm text-ink-mute">{input.help}</span>
                )}
              </div>
            ) : (
            <div key={input.id}>
              <label
                class="font-display text-sm font-bold tracking-wide uppercase"
                for={`input-${input.id}`}
              >
                {input.label}
              </label>
              {input.help && <p class="mt-1 text-sm text-ink-mute">{input.help}</p>}
              <div class="mt-2 flex items-center gap-3">
                <input
                  id={`input-${input.id}`}
                  type="number"
                  inputMode="numeric"
                  min={input.min}
                  max={input.max}
                  step={input.step}
                  value={inputs[input.id]}
                  onInput={(e) => {
                    const raw = Number((e.target as HTMLInputElement).value);
                    // Clamped on the way in: a fee scale must never be asked
                    // for a value the statute does not cover.
                    const next = Number.isFinite(raw)
                      ? Math.min(Math.max(raw, input.min), input.max)
                      : input.default;
                    setInput(input.id, next);
                  }}
                  class="w-40 rounded-[3px] border border-ink px-3 py-2 font-mono text-sm tabular-nums"
                />
                {input.einheit && (
                  <span class="font-mono text-sm text-ink-soft">{input.einheit}</span>
                )}
                <input
                  type="range"
                  aria-label={`${input.label} – Schieberegler`}
                  min={input.min}
                  max={input.max}
                  step={input.step}
                  value={inputs[input.id]}
                  onInput={(e) =>
                    setInput(input.id, Number((e.target as HTMLInputElement).value))
                  }
                  class="min-w-0 flex-1 accent-ink"
                />
              </div>
            </div>
            ),
          )}
        </div>
      )}

      {/* Die Bedienelemente sind Chips, keine Formularzeilen.

          Der Entwurf „Preisschild" zeigte sie als kompakte Reihe (Bayern ·
          Klasse B · 25 Fahrstunden) — und das ist kein Geschmacksdetail: eine
          Preisauszeichnung trägt kurze Merkmale nebeneinander, ein Formular
          stapelt Zeilen. Als Kästchenliste sah die Seite aus wie ein Antrag,
          also wie das Gegenteil dessen, was sie sein soll.

          Semantisch bleibt alles, was war: `fieldset`/`legend` je Gruppe,
          echte Radios und Checkboxen (visuell versteckt, nicht entfernt), und
          ein nicht wählbarer Zuschlag wird deaktiviert statt ausgeblendet. */}
      <div class="mt-7 flex flex-col gap-6">
        {config.groups.map((group) => (
          <fieldset key={group.id} class="min-w-0">
            <legend class="font-display text-sm font-bold tracking-wide uppercase">
              {group.label}
            </legend>
            {group.help && <p class="mt-1 text-sm text-ink-mute">{group.help}</p>}

            <div class="mt-2.5 flex flex-wrap gap-2">
              {group.options.map((option) => {
                const active = (selection[group.id] ?? []).includes(option.id);
                const available = isAvailable(option, selection);
                const vorschau = resolveAmount(option.amount, inputs, {
                  zwischensumme: total,
                  byOption: {},
                });
                const leer = vorschau.max === 0 && vorschau.min === 0;
                return (
                  <label
                    key={option.id}
                    title={!available ? 'Gilt für diese Auswahl nicht.' : undefined}
                    class={`inline-flex items-baseline gap-2 rounded-[3px] border px-3 py-1.5 text-sm transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${
                      !available
                        ? 'cursor-not-allowed border-rule text-ink-mute line-through decoration-rule'
                        : active
                          ? 'cursor-pointer border-ink bg-ink text-paper'
                          : 'cursor-pointer border-rule hover:border-ink'
                    }`}
                  >
                    <input
                      type={group.kind === 'single' ? 'radio' : 'checkbox'}
                      name={group.id}
                      checked={active}
                      disabled={!available}
                      onChange={() => choose(group, option.id)}
                      class="sr-only"
                    />
                    <span>{option.label}</span>
                    {!leer && (
                      <span
                        class={`font-mono text-xs tabular-nums ${
                          active ? 'text-paper/70' : 'text-ink-mute'
                        }`}
                      >
                        {betrag(vorschau)}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      {/* Breakdown — the output half of the same surface as the controls. */}
      <div class="mt-8">
        <h2 class="font-display text-sm font-bold tracking-wide uppercase">
          Das steckt drin
        </h2>
        <table class="mt-2 w-full text-sm">
          <caption class="sr-only">
            Kostenaufstellung für die gewählten Optionen
          </caption>
          <tbody>
            {sichtbareZeilen.map((row, i) => (
              <tr key={`${row.groupLabel}-${i}`} class="border-b border-rule align-baseline">
                <th scope="row" class="py-2 pr-3 text-left font-normal">
                  <span class="block">{row.optionLabel}</span>
                  {row.note && <span class="block text-xs text-ink-mute">{row.note}</span>}
                  {row.source && (
                    <a
                      href={row.source.url}
                      class="text-xs text-ink-mute underline"
                      rel="nofollow noopener"
                      target="_blank"
                    >
                      {row.source.label}
                    </a>
                  )}
                </th>
                <td class="py-2 text-right font-mono whitespace-nowrap">
                  {row.amount.min === row.amount.max
                    ? format(row.amount.typ)
                    : `${format(row.amount.min)} – ${format(row.amount.max)}`}
                </td>
              </tr>
            ))}
            <tr class="align-baseline">
              <th scope="row" class="py-2 pr-3 text-left font-bold">
                Summe
              </th>
              <td class="py-2 text-right">
                <span class="preis">{betrag(total)}</span>
              </td>
            </tr>
          </tbody>
        </table>
        {rundungsdifferenz && (
          <p class="mt-2 text-xs text-ink-mute">
            Die einzelnen Zeilen sind gerundet dargestellt. Ihre Summe kann deshalb um bis zu
            einen Euro von der Gesamtsumme abweichen, die aus den ungerundeten Beträgen
            gebildet wird.
          </p>
        )}
      </div>

      {config.assumptions.length > 0 && (
        <div class="mt-7 border-t border-rule pt-4">
          <h2 class="font-display text-sm font-bold tracking-wide uppercase">
            Annahmen
          </h2>
          <ul class="mt-2 flex flex-col gap-1 text-sm text-ink-soft">
            {config.assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </div>
      )}

      <p class="mt-5 text-xs text-ink-mute">
        Stand: {isoToGerman(config.updated)}.{' '}
        {config.hinweis ??
          (config.exact
            ? 'Die Gebühren sind gesetzlich festgelegt; einzelne Behörden können zusätzliche Auslagen erheben.'
            : 'Alle Beträge sind Schätzwerte auf Basis der genannten Quellen und keine Angebote.')}
      </p>
    </div>
  );
}
