import type { CostSource, TopicConfig } from './types';

const GEBOST = 'https://www.gesetze-im-internet.de/stgebo_2011';

/** Day the GebOSt was fetched and read. Raw record: `src/data/sources/tuev-hu.json`. */
const STAND = '2026-08-03';

const nr = (nummer: string): CostSource => ({
  label: `GebOSt Nr. ${nummer}`,
  url: `${GEBOST}/anlage.html`,
  retrieved: STAND,
});

/** All HU amounts come from column 5 of the fee table — see the note in the topic doc. */
const FAHRZEUGE = [
  { id: 'pkw', label: 'Pkw oder Anhänger bis 3,5 t', gnr: '413.4.1', min: 32.9, max: 51.6 },
  { id: 'krad', label: 'Kraftrad', gnr: '413.3', min: 25.4, max: 38.3 },
  { id: 'anhaenger', label: 'Anhänger ohne Bremsanlage', gnr: '413.2', min: 14.1, max: 26.1 },
  { id: 't75', label: 'Fahrzeug bis 7,5 t', gnr: '413.4.2', min: 56, max: 71 },
  { id: 't12', label: 'Fahrzeug bis 12 t', gnr: '413.4.3', min: 70.6, max: 89.2 },
  { id: 't18', label: 'Fahrzeug bis 18 t', gnr: '413.4.4', min: 76.6, max: 98.2 },
  { id: 't32', label: 'Fahrzeug bis 32 t', gnr: '413.4.5', min: 85.7, max: 107.3 },
  { id: 'ueber32', label: 'Fahrzeug über 32 t', gnr: '413.4.6', min: 100.9, max: 125.4 },
] as const;

/** The AU is 0.85 × its own frame when it runs as part of the HU (Nr. 413.5). */
const TEIL = 0.85;
const au = (min: number, max: number) => ({
  min: Math.round(min * TEIL * 100) / 100,
  typ: Math.round(((min + max) / 2) * TEIL * 100) / 100,
  max: Math.round(max * TEIL * 100) / 100,
});

/**
 * Hauptuntersuchung ("TÜV").
 *
 * The topic that shows why this site exists: there is no "TÜV price". The
 * GebOSt sets a **Gebührenrahmen**, and each testing organisation places itself
 * inside it — which is exactly what the Spannenband is for.
 *
 * Two things that are easy to get wrong and are got right here:
 *
 * - **Column 5, not column 4.** The fee table under Nr. 413 puts four header
 *   groups over six columns; read by eye, the Hauptuntersuchung (column 5) is
 *   easily mistaken for the Änderungsabnahme (column 4). The figures below come
 *   from the `colspec`/`namest` attributes of the XML, not from the layout.
 * - **The late surcharge multiplies, it does not add.** More than two months
 *   past the due date, the fee is "die Gebühr zuzüglich dem 0,2-Fachen dieser
 *   Gebühr" — so it scales with the vehicle class. That is a `faktor` amount
 *   naming every vehicle option; only the selected one carries a value, so the
 *   surcharge follows the choice automatically.
 */
export const tuevHu: TopicConfig = {
  slug: 'tuev-hauptuntersuchung',
  vertical: 'verkehr',
  question: 'Was kostet der TÜV?',
  title: 'Was kostet der TÜV? Hauptuntersuchung – Gebühren 2026',
  description:
    'HU und AU 2026: die Gebührenrahmen der GebOSt für Pkw, Kraftrad und Lkw, mit Verspätungszuschlag – und warum es keinen festen TÜV-Preis gibt.',
  answer:
    'Für einen Pkw kostet die Hauptuntersuchung mit Abgasuntersuchung zwischen 54,61 € und 125,82 € brutto. Ein fester Preis existiert nicht: die GebOSt setzt nur einen Rahmen, innerhalb dessen jede Prüforganisation selbst kalkuliert. Wer den Vorführtermin um mehr als zwei Monate überzieht, zahlt das 1,2-Fache der HU-Gebühr.',
  // Cent-exact: every figure is a line of the GebOSt fee table, not an
  // estimate. It is still a range, because the regulation sets a frame.
  exact: true,
  verified: true,
  hinweis:
    'Die GebOSt legt einen Gebührenrahmen fest, keinen Preis. Innerhalb dieses Rahmens kalkuliert jede Prüfstelle selbst – die Spanne oben ist deshalb keine Schätzung, sondern der gesetzlich zulässige Korridor.',

  groups: [
    {
      id: 'fahrzeug',
      label: 'Fahrzeug',
      kind: 'single',
      help: 'Maßgeblich ist die zulässige Gesamtmasse.',
      defaults: ['pkw'],
      options: FAHRZEUGE.map((f) => ({
        id: f.id,
        label: f.label,
        amount: { min: f.min, typ: (f.min + f.max) / 2, max: f.max },
        note: `Hauptuntersuchung nach § 29 StVZO, Gebührenrahmen ${f.min.toFixed(2)} – ${f.max.toFixed(2)} €.`,
        source: nr(f.gnr),
      })),
    },

    {
      id: 'abgas',
      label: 'Abgasuntersuchung',
      kind: 'multi',
      help: 'Die AU ist seit 2010 Teil der HU. Als Teiluntersuchung gilt der Rahmen mal 0,85.',
      defaults: ['au_obd'],
      options: [
        {
          id: 'au_obd',
          label: 'AU ohne Abgasmessung am Auspuffendrohr (OBD)',
          amount: au(13.4, 61.8),
          note: 'Der Regelfall bei moderneren Fahrzeugen. Rahmen 13,40 – 61,80 €, als Teiluntersuchung × 0,85.',
          dependsOn: {
            group: 'fahrzeug',
            options: ['pkw', 't75', 't12', 't18', 't32', 'ueber32'],
          },
          source: nr('413.5.1.2'),
        },
        {
          id: 'au_endrohr',
          label: 'AU mit Abgasmessung am Auspuffendrohr',
          amount: au(23.7, 109.8),
          note: 'Rahmen 23,70 – 109,80 €, als Teiluntersuchung × 0,85.',
          dependsOn: {
            group: 'fahrzeug',
            options: ['pkw', 't75', 't12', 't18', 't32', 'ueber32'],
          },
          source: nr('413.5.1.1'),
        },
        {
          id: 'au_krad',
          label: 'AU für Krafträder',
          amount: au(9.2, 27.4),
          note: 'Rahmen 9,20 – 27,40 €, als Teiluntersuchung × 0,85.',
          dependsOn: { group: 'fahrzeug', options: ['krad'] },
          source: nr('413.5.2'),
        },
      ],
    },

    {
      id: 'pflicht',
      label: 'Feste Nebengebühren',
      kind: 'multi',
      help: 'Fallen bei jeder Hauptuntersuchung an.',
      defaults: ['vorgaben', 'plakette'],
      options: [
        {
          id: 'vorgaben',
          label: 'Bereitstellung der Vorgaben',
          amount: { min: 1, typ: 1, max: 1 },
          note: 'Zusätzlich zu jeder HU nach Anlage VIIIa StVZO.',
          source: nr('413, Fußnote zu Spalte 5'),
        },
        {
          id: 'plakette',
          label: 'Prüfplakette',
          amount: { min: 0.6, typ: 0.6, max: 0.6 },
          source: nr('416'),
        },
      ],
    },

    {
      id: 'umstaende',
      label: 'Besondere Umstände',
      kind: 'multi',
      options: [
        {
          id: 'verspaetung',
          label: 'Vorführtermin um mehr als zwei Monate überzogen',
          amount: { kind: 'faktor', von: FAHRZEUGE.map((f) => f.id), faktor: 0.2 },
          note: 'Die HU-Gebühr erhöht sich um das 0,2-Fache – der Zuschlag wächst also mit der Fahrzeugklasse. Er trifft nur die HU, nicht die AU und nicht die Nebengebühren.',
          source: nr('413, Fußnote zu Spalte 5'),
        },
      ],
    },

    {
      id: 'steuer',
      label: 'Umsatzsteuer',
      kind: 'multi',
      help: 'Prüforganisationen sind umsatzsteuerpflichtig; die Beträge des Tarifs sind netto.',
      defaults: ['ust'],
      options: [
        {
          id: 'ust',
          label: '19 % Umsatzsteuer',
          amount: { kind: 'faktor', von: 'zwischensumme', faktor: 0.19 },
          source: {
            label: '§ 2 Abs. 3 GebOSt',
            url: `${GEBOST}/__2.html`,
            retrieved: STAND,
          },
        },
      ],
    },
  ],

  assumptions: [
    'Die GebOSt setzt einen Gebührenrahmen, keinen Festpreis. Wo eine Prüfstelle innerhalb des Rahmens liegt, entscheidet sie selbst – deshalb unterscheiden sich TÜV, DEKRA, GTÜ und KÜS, und deshalb schwanken die Preise regional, ohne dass eine Landesregelung dahinterstünde.',
    'Der Rahmen ist bundesweit derselbe. Ein Preisunterschied zwischen zwei Bundesländern ist kein Rechtsunterschied, sondern eine Kalkulationsentscheidung.',
    'Nicht enthalten: die Nachuntersuchung bei Mängeln. Sie kostet nach Nr. 414 zwischen 1,70 € und zwei Dritteln der ursprünglichen Gebühr.',
    'Nicht enthalten: die Sicherheitsprüfung, die für schwere Fahrzeuge zusätzlich fällig wird. Wird sie zusammen mit der HU durchgeführt, kommt nach der Fußnote zu Spalte 5 das 0,6-Fache der SP-Gebühr hinzu.',
    'Die Beträge des Gebührentarifs sind Nettobeträge; nach § 2 Abs. 3 GebOSt kann die Umsatzsteuer hinzugerechnet werden.',
  ],

  sources: [
    {
      label: 'GebOSt – Gebührentarif, Nummer 413 (Prüfung einzelner Fahrzeuge)',
      url: `${GEBOST}/anlage.html`,
      retrieved: STAND,
    },
    {
      label: 'GebOSt § 2 – Gebührenerhebung, Umsatzsteuer',
      url: `${GEBOST}/__2.html`,
      retrieved: STAND,
    },
  ],

  updated: STAND,
};
