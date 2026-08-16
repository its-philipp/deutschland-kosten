import type { CostSource, TopicConfig } from './types';

const GOZ = 'https://www.gesetze-im-internet.de/goz_1987';

/** Day the GOZ was fetched and read. Raw record: `src/data/sources/zahnimplantat.json`. */
const STAND = '2026-08-03';

/** § 5 Abs. 1 Satz 3 GOZ. */
const PUNKTWERT = 0.0562421;
const MIN_FAKTOR = 1.0;
const REGEL_FAKTOR = 2.3;
const MAX_FAKTOR = 3.5;

const cent = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;

/**
 * A GOZ position as a range: the statutory frame from the single to the 3.5-fold
 * rate, with the 2.3-fold rate as the typical value.
 *
 * The 2.3 is not a guess — § 5 Abs. 2 GOZ says in as many words that it "bildet
 * die nach Schwierigkeit und Zeitaufwand durchschnittliche Leistung ab", and
 * that going above it is only allowed where the case is special. That is what
 * makes the middle of this band defensible, and it is the reason the GOT topic
 * (which has no such sentence) must not claim one.
 *
 * Rounding follows § 5 Abs. 1 Satz 4: to the cent, and only *after* multiplying
 * by the rate.
 */
const goz = (punkte: number) => ({
  min: cent(punkte * PUNKTWERT * MIN_FAKTOR),
  typ: cent(punkte * PUNKTWERT * REGEL_FAKTOR),
  max: cent(punkte * PUNKTWERT * MAX_FAKTOR),
});

const nr = (nummer: string): CostSource => ({
  label: `GOZ-Nr. ${nummer}`,
  url: `${GOZ}/anlage_1.html`,
  retrieved: STAND,
});

/**
 * Zahnimplantat.
 *
 * A medical topic with a real statutory core, which is unusual: the dentist's
 * fee comes from the GOZ and is computable to the cent. What the GOZ does *not*
 * cover is the larger half of the bill — the implant body, the abutment and the
 * laboratory crown are Auslagen under § 9 GOZ and have no regulated price.
 *
 * The page therefore does what the site's rule demands: it states the part it
 * can source, names the part it cannot, and does not invent a total. The
 * `hinweis` says so directly under the estimator, so the number is never
 * mistaken for the final bill.
 */
export const zahnimplantat: TopicConfig = {
  slug: 'zahnimplantat',
  vertical: 'medizin',
  question: 'Was kostet ein Zahnimplantat?',
  title: 'Was kostet ein Zahnimplantat? Zahnarzthonorar nach GOZ 2026',
  description:
    'Zahnimplantat 2026: das zahnärztliche Honorar nach GOZ berechnet – Einzelimplantat mit Krone, Knochenaufbau und Sinuslift, je Position mit GOZ-Nummer.',
  answer:
    'Das zahnärztliche Honorar für ein Einzelimplantat mit Krone liegt zwischen 257,42 € und 900,97 €, beim üblichen 2,3-fachen Satz bei 592,07 €. Das ist nicht der Rechnungsbetrag: Implantat, Aufbauteil und Laborkrone sind Auslagen nach § 9 GOZ, haben keinen festgelegten Preis und machen den größeren Teil der Kosten aus.',
  exact: true,
  verified: true,
  hinweis:
    'Gerechnet ist nur das zahnärztliche Honorar nach GOZ. Implantatkörper, Aufbauteil, Laborkrone, Knochenersatzmaterial und das Röntgenbild kommen hinzu – sie sind Auslagen nach § 9 GOZ beziehungsweise Leistungen nach GOÄ und haben keinen amtlichen Preis. Überschreitet das Labor voraussichtlich 1.000 €, muss der Zahnarzt vorher einen Kostenvoranschlag anbieten.',

  groups: [
    {
      id: 'grundleistung',
      label: 'Implantation',
      kind: 'multi',
      help: 'Die Positionen, die bei einem Einzelimplantat regelmäßig anfallen.',
      defaults: ['hkp', 'analyse', 'insertion', 'freilegen', 'krone'],
      options: [
        {
          id: 'hkp',
          label: 'Heil- und Kostenplan',
          amount: goz(200),
          note: '200 Punkte. Der schriftliche Plan nach Befundaufnahme.',
          source: nr('0030'),
        },
        {
          id: 'analyse',
          label: 'Implantatbezogene Analyse und Vermessung',
          amount: goz(884),
          note: '884 Punkte.',
          source: nr('9000'),
        },
        {
          id: 'insertion',
          label: 'Implantatinsertion, je Implantat',
          amount: goz(1545),
          note: '1.545 Punkte. Das Einbringen des Implantats selbst.',
          source: nr('9010'),
        },
        {
          id: 'freilegen',
          label: 'Freilegen und Aufbauelement einsetzen',
          amount: goz(626),
          note: '626 Punkte. Zweite Phase bei einem zweiphasigen System.',
          source: nr('9040'),
        },
        {
          id: 'krone',
          label: 'Vollkrone auf dem Implantat',
          amount: goz(1322),
          note: '1.322 Punkte. Die Position gilt ausdrücklich für einen Zahn oder ein Implantat.',
          source: nr('2200'),
        },
      ],
    },

    {
      id: 'knochen',
      label: 'Knochenaufbau',
      kind: 'multi',
      help: 'Nur wenn der Kieferknochen nicht ausreicht. Das ist der Posten, der die Rechnung am stärksten bewegt.',
      options: [
        {
          id: 'augmentation',
          label: 'Augmentation des Alveolarfortsatzes',
          amount: goz(2694),
          note: '2.694 Punkte, je Kieferhälfte oder Frontzahnbereich.',
          source: nr('9100'),
        },
        {
          id: 'sinus_intern',
          label: 'Interner Sinuslift',
          amount: goz(1500),
          note: '1.500 Punkte. Geschlossene Sinusbodenelevation vom Kieferkamm aus.',
          source: nr('9110'),
        },
        {
          id: 'sinus_extern',
          label: 'Externer Sinuslift',
          amount: goz(3000),
          note: '3.000 Punkte, je Kieferhälfte. Durch externe Knochenfensterung.',
          source: nr('9120'),
        },
        {
          id: 'knochengewinnung',
          label: 'Knochengewinnung und -aufbereitung',
          amount: goz(400),
          note: '400 Punkte.',
          source: nr('9090'),
        },
        {
          id: 'fixation',
          label: 'Augmentat durch Osteosynthese fixieren',
          amount: goz(675),
          note: '675 Punkte, zusätzlich zur Augmentation.',
          dependsOn: { group: 'knochen', options: ['augmentation'] },
          source: nr('9150'),
        },
      ],
    },

    {
      id: 'zusatz',
      label: 'Zusätzliche Leistungen',
      kind: 'multi',
      options: [
        {
          id: 'schablone',
          label: 'Navigationsschablone auf 3D-Daten',
          amount: goz(300),
          note: '300 Punkte, je Kiefer.',
          source: nr('9005'),
        },
        {
          id: 'aufbauwechsel',
          label: 'Aufbauelemente wechseln',
          amount: goz(313),
          note: '313 Punkte.',
          source: nr('9050'),
        },
      ],
    },
  ],

  assumptions: [
    'Gerechnet wird nach § 5 GOZ: Punktzahl × Punktwert 5,62421 Cent × Steigerungsfaktor. Gerundet wird auf den Cent, und zwar erst nach der Multiplikation mit dem Faktor.',
    'Die Spanne reicht vom einfachen bis zum 3,5-fachen Satz. Der 2,3-fache Satz bildet nach § 5 Abs. 2 GOZ die durchschnittliche Leistung ab; darüber darf nur abgerechnet werden, wenn Besonderheiten des Einzelfalls es rechtfertigen.',
    'Nicht enthalten: Implantatkörper, Aufbauteil, zahntechnische Krone, Knochenersatzmaterial und Membranen. Das sind Auslagen nach § 9 GOZ ohne festgelegten Preis – beim Implantat zusammen meist mehr als das Honorar.',
    'Nicht enthalten: Röntgenaufnahme und DVT. Sie werden nicht nach GOZ, sondern nach GOÄ abgerechnet.',
    'Übersteigen die zahntechnischen Kosten voraussichtlich 1.000 €, muss der Zahnarzt vor der Behandlung einen Kostenvoranschlag des Labors anbieten und auf Verlangen in Textform vorlegen (§ 9 Abs. 2 GOZ).',
    'Eine von der GOZ abweichende Gebührenhöhe ist nur durch schriftliche Vereinbarung vor der Behandlung möglich; eine abweichende Punktzahl oder ein abweichender Punktwert dürfen nicht vereinbart werden (§ 2 GOZ).',
  ],

  sources: [
    { label: 'GOZ § 5 – Bemessung der Gebühren', url: `${GOZ}/__5.html`, retrieved: STAND },
    {
      label: 'GOZ § 9 – Ersatz von Auslagen für zahntechnische Leistungen',
      url: `${GOZ}/__9.html`,
      retrieved: STAND,
    },
    { label: 'GOZ § 2 – Abweichende Vereinbarung', url: `${GOZ}/__2.html`, retrieved: STAND },
    { label: 'GOZ Anlage 1 – Gebührenverzeichnis', url: `${GOZ}/anlage_1.html`, retrieved: STAND },
  ],

  updated: STAND,
};
