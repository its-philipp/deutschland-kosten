import type { CostSource, TopicConfig } from './types';

const GOT = 'https://www.gesetze-im-internet.de/got_2022';

/** Day the GOT was read in full. Raw record: `src/data/sources/hund.json`. */
const STAND = '2026-08-16';

const cent = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;

/**
 * A GOT position as the regulation states it: the frame from the single to the
 * threefold Gebührensatz (§ 2 Abs. 1 Satz 1).
 *
 * `typ` carries the single rate purely so the arithmetic has three numbers to
 * add; **it is never printed**, because the topic declares
 * `kennzahl: 'ohne-mitte'`. That is the whole point of this page's construction:
 * the GOZ says in § 5 Abs. 2 that the 2.3-fold rate "bildet die … durchschnitt-
 * liche Leistung ab", which is what licenses the Zahnimplantat page to name a
 * typical value. **The GOT contains no such sentence.** It lists five criteria
 * and leaves the rate to billiges Ermessen, so any figure this site put in the
 * middle would be one it made up.
 */
const got = (einfach: number) => ({ min: einfach, typ: einfach, max: cent(einfach * 3) });

const nr = (nummer: string): CostSource => ({
  label: `GOT-Gebührenverzeichnis Nr. ${nummer}`,
  url: `${GOT}/anlage.html`,
  retrieved: STAND,
});

/**
 * Tierarztkosten für den Hund.
 *
 * The reason this topic exists at all: "was kostet der Tierarzt" reads like a
 * pure market question, and it is not — the vet bills under the GOT, a
 * Rechtsverordnung, so the figures are as citable as a notary's fee. Everyone
 * else on this keyword estimates.
 *
 * The Notdienst is the part worth building carefully, because it is where the
 * bill surprises people and where the arithmetic is easiest to get wrong. § 4
 * Abs. 1 does **not** add a surcharge to the ordinary frame: it moves the frame
 * from one-to-threefold to two-to-fourfold and puts a flat 50 € beside it. Both
 * effects hang on the same choice, which is why the option carries a `summe` and
 * why the factor part uses `bezugsteil: 'min'` — see the doc comments on those
 * in data/topics/types.ts.
 *
 * Deliberately **not** in this estimator: castration and the large operations.
 * Their figures are named in the assumptions, but as options they would stretch
 * the Spannenband's track to roughly 2.200 €, and an ordinary consultation would
 * then be a two-percent sliver at the left-hand end — the band would stop
 * answering the one question it is for. "Was kostet die Kastration beim Hund"
 * is its own search and deserves its own page, with the Narkose choice at the
 * centre instead of at the edge.
 */
export const hundTierarzt: TopicConfig = {
  slug: 'hund-tierarzt',
  vertical: 'medizin',
  question: 'Was kostet der Tierarzt für einen Hund?',
  title: 'Was kostet der Tierarzt für einen Hund? GOT-Gebühren 2026',
  description:
    'Tierarztkosten für den Hund 2026 nach der GOT: Untersuchung, Chippen, Einschläfern und Notdienst – je Leistung mit Nummer der Gebührenordnung.',
  answer:
    'Die allgemeine Untersuchung eines Hundes mit Beratung kostet zwischen 28,11 € und 84,32 € einschließlich Umsatzsteuer. Dahinter steht ein Gebührensatz von 23,62 € nach dem Gebührenverzeichnis der GOT, den die Tierärztin einfach bis dreifach ansetzen darf. Im Notdienst gilt ein anderer Rahmen: das Zwei- bis Vierfache und zusätzlich 50 € Notdienstgebühr, für dieselbe Untersuchung also 115,72 € bis 171,93 €.',
  exact: true,
  verified: true,
  kennzahl: 'ohne-mitte',
  hinweis:
    'Gerechnet sind nur die Gebühren des Gebührenverzeichnisses. Arzneimittel, Verbrauchsmaterial, Entschädigungen und Wegegeld dürfen nach § 7 Abs. 2 GOT daneben berechnet werden und stehen auf der Rechnung gesondert. Wo innerhalb des Rahmens die Rechnung landet, entscheidet die Tierärztin nach billigem Ermessen – ein „üblicher“ Satz ist in der GOT nicht vorgesehen.',

  groups: [
    {
      id: 'untersuchung',
      label: 'Untersuchung',
      kind: 'single',
      help: 'Der Grundposten fast jedes Termins. Genau eine dieser Nummern wird berechnet.',
      defaults: ['allgemein'],
      options: [
        {
          id: 'allgemein',
          label: 'Allgemeine Untersuchung mit Beratung',
          amount: got(23.62),
          note: 'Nr. 16, für Hund, Katze und Frettchen.',
          source: nr('16'),
        },
        {
          id: 'ohne-beratung',
          label: 'Allgemeine Untersuchung ohne Beratung',
          amount: got(21.41),
          note: 'Nr. 21.',
          source: nr('21'),
        },
        {
          id: 'folge',
          label: 'Folgeuntersuchung im selben Behandlungsfall',
          amount: got(19.74),
          note: 'Nr. 34, mit Beratung. Gilt nur innerhalb desselben Behandlungsfalls.',
          source: nr('34'),
        },
        {
          id: 'beratung',
          label: 'Nur Beratung, ohne Untersuchung',
          amount: got(11.26),
          note: 'Nr. 1, auch schriftlich oder fernmündlich.',
          source: nr('1'),
        },
      ],
    },

    {
      id: 'massnahmen',
      label: 'Weitere Leistungen',
      kind: 'multi',
      options: [
        {
          id: 'chip',
          label: 'Chippen',
          amount: got(10.24),
          note: 'Nr. 238, Implantation eines Transponders.',
          source: nr('238'),
        },
        {
          id: 'ablesen',
          label: 'Kennzeichnung ablesen',
          amount: got(4.59),
          note: 'Nr. 240, Tätowierung, Transponder oder Ohrmarke.',
          source: nr('240'),
        },
        {
          id: 'injektion',
          label: 'Injektion',
          amount: got(11.5),
          note: 'Nr. 221, subkutan, intrakutan oder intramuskulär. Das Arzneimittel selbst kommt nach § 7 Abs. 2 GOT hinzu.',
          source: nr('221'),
        },
        {
          id: 'unterbringung',
          label: 'Stationäre Unterbringung, je Tag',
          amount: got(19.08),
          note: 'Nr. 83, ohne Behandlung und ohne Futterkosten.',
          source: nr('83'),
        },
        {
          id: 'euthanasie',
          label: 'Einschläfern',
          amount: got(30.78),
          note: 'Nr. 208, Euthanasie durch Injektion. Sedation und Beseitigung des Tierkörpers sind nicht enthalten.',
          source: nr('208'),
        },
      ],
    },

    {
      id: 'narkose',
      label: 'Narkose oder Sedation',
      kind: 'single',
      help: 'Wird für Eingriffe, Röntgenaufnahmen und Zahnbehandlungen zusätzlich berechnet.',
      defaults: ['keine'],
      options: [
        { id: 'keine', label: 'Keine', amount: { min: 0, typ: 0, max: 0 } },
        {
          id: 'sedation',
          label: 'Sedation per Injektion',
          amount: got(19.78),
          note: 'Nr. 302.',
          source: nr('302'),
        },
        {
          id: 'im',
          label: 'Injektionsnarkose intramuskulär',
          amount: got(23.44),
          note: 'Nr. 310.',
          source: nr('310'),
        },
        {
          id: 'iv',
          label: 'Injektionsnarkose intravenös',
          amount: got(24.19),
          note: 'Nr. 320.',
          source: nr('320'),
        },
        {
          id: 'kombi',
          label: 'Kombinationsnarkose intravenös',
          amount: got(31.47),
          note: 'Nr. 330.',
          source: nr('330'),
        },
        {
          id: 'inhalation',
          label: 'Inhalationsnarkose',
          amount: got(61.57),
          note: 'Nr. 337.',
          source: nr('337'),
        },
      ],
    },

    {
      id: 'zeitpunkt',
      label: 'Zeitpunkt',
      kind: 'single',
      help: 'Nacht ist 18 bis 8 Uhr, Wochenende freitags 18 Uhr bis montags 8 Uhr, Feiertag ganztägig (§ 2 Abs. 2 GOT).',
      defaults: ['sprechstunde'],
      options: [
        {
          id: 'sprechstunde',
          label: 'Reguläre Sprechstunde',
          amount: { min: 0, typ: 0, max: 0 },
        },
        {
          id: 'notdienst',
          label: 'Notdienst',
          amount: {
            kind: 'summe',
            teile: [
              // § 4 Abs. 1 Satz 1: der Rahmen wandert vom Einfachen–Dreifachen
              // auf das Zweifache–Vierfache, also je ein weiterer *einfacher*
              // Satz an beiden Enden.
              { kind: 'faktor', von: 'zwischensumme', faktor: 1, bezugsteil: 'min' },
              // § 4 Abs. 1 Satz 2: daneben und ausdrücklich abweichend vom
              // Gebührenrahmen ein fester Betrag.
              { min: 50, typ: 50, max: 50 },
            ],
          },
          note: 'Alle Gebühren steigen auf das Zwei- bis Vierfache, dazu kommen 50 € Notdienstgebühr (§ 4 Abs. 1 GOT).',
          source: {
            label: 'GOT § 4 – Gebühren für tierärztlichen Notdienst',
            url: `${GOT}/__4.html`,
            retrieved: STAND,
          },
        },
      ],
    },

    {
      id: 'steuer',
      label: 'Umsatzsteuer',
      kind: 'single',
      help: 'Nicht abwählbar: die Sätze des Gebührenverzeichnisses sind Nettobeträge, und die Rechnung muss die Umsatzsteuer ausweisen (§ 7 Abs. 4 Nr. 6 GOT).',
      options: [
        {
          id: 'ust',
          label: '19 %',
          amount: { kind: 'prozent', von: 'zwischensumme', prozent: 19 },
          note: 'Regelsatz nach § 12 Abs. 1 UStG.',
          source: {
            label: 'UStG § 12 – Steuersätze',
            url: 'https://www.gesetze-im-internet.de/ustg_1980/__12.html',
            retrieved: STAND,
          },
        },
      ],
    },
  ],

  assumptions: [
    'Die Höhe jeder einzelnen Gebühr bemisst sich nach dem Einfachen bis Dreifachen des Gebührensatzes, nach billigem Ermessen und unter Berücksichtigung von Schwierigkeit, Zeitaufwand, Zeitpunkt, Wert des Tieres und örtlichen Verhältnissen (§ 2 Abs. 1 GOT).',
    'Anders als die Gebührenordnung für Zahnärzte nennt die GOT keinen Regelsatz in der Mitte des Rahmens. Diese Seite zeigt deshalb nur die Spanne und keinen „üblichen“ Betrag – ein solcher Wert wäre erfunden.',
    'Der Zeitpunkt ist innerhalb des Rahmens besonders zu berücksichtigen, ist aber kein fester Aufschlag. In der regulären Sprechstunde gilt das auch dann nicht, wenn der Termin vereinbart war (§ 2 Abs. 2 GOT).',
    'Im tierärztlichen Notdienst gilt ein eigener Rahmen: die einfachen Gebührensätze erhöhen sich auf das Zweifache und bis auf das Vierfache. Die Notdienstgebühr von 50 € steht daneben, wird in derselben Angelegenheit nur einmal erhoben – auch bei mehreren Tieren eines Halters – und kann im begründeten Einzelfall entfallen (§ 4 GOT).',
    'Über den dreifachen Satz hinaus oder unter den einfachen darf nur im begründeten Einzelfall abgerechnet werden, und die Vereinbarung muss vor der Leistung in Textform geschlossen und dem Tierhalter als Doppel ausgehändigt werden (§ 6 GOT).',
    'Allgemeine Praxiskosten und die Kosten der Instrumente und Apparaturen sind mit den Gebühren abgegolten. Daneben dürfen nur Entschädigungen, Auslagen, Arzneimittel und verbrauchtes Material berechnet werden (§ 7 Abs. 1 und 2 GOT).',
    'Die Rechnung muss Datum, Tierart, Diagnose oder Grund der Konsultation, die laufende Nummer jeder Leistung aus dem Gebührenverzeichnis, den Rechnungsbetrag und die Umsatzsteuer enthalten und ist auf Verlangen aufzugliedern (§ 7 Abs. 4 GOT). Mit der laufenden Nummer lässt sich jede Position hier nachschlagen.',
    'Nicht in diesem Rechner, aber im selben Gebührenverzeichnis: Kastration Rüde 70,60 €, Ovariohysterektomie der Hündin 192,00 €, endoskopisch zusätzlich 98,96 €, Magendrehungs-Operation 256,55 €, Amputation einer Extremität 197,90 € – jeweils der einfache Satz, also bis zum Dreifachen und im Notdienst bis zum Vierfachen.',
    'Nicht gerechnet werden die Sonderfälle des § 3 GOT: bei einer öffentlich-rechtlichen Anordnung oder einem mit öffentlichen Mitteln geförderten Verfahren gilt der einfache Satz, dort dann mit eigenen Zuschlagsregeln.',
    'Das Wegegeld für einen Hausbesuch nach § 10 GOT ist nicht enthalten.',
  ],

  sources: [
    { label: 'GOT § 2 – Gebührenhöhe', url: `${GOT}/__2.html`, retrieved: STAND },
    {
      label: 'GOT § 3 – Gebührenhöhe in besonderen Fällen',
      url: `${GOT}/__3.html`,
      retrieved: STAND,
    },
    {
      label: 'GOT § 4 – Gebühren für tierärztlichen Notdienst',
      url: `${GOT}/__4.html`,
      retrieved: STAND,
    },
    {
      label: 'GOT § 6 – Abweichende Vereinbarung',
      url: `${GOT}/__6.html`,
      retrieved: '2026-08-03',
    },
    {
      label: 'GOT § 7 – Gebühren- und Rechnungsbestandteile, Fälligkeit',
      url: `${GOT}/__7.html`,
      retrieved: STAND,
    },
    {
      label: 'GOT Anlage – Gebührenverzeichnis für tierärztliche Leistungen',
      url: `${GOT}/anlage.html`,
      retrieved: STAND,
    },
  ],

  updated: STAND,
};
