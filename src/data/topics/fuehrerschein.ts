import type { CostSource, TopicConfig } from './types';

const GEBOST = 'https://www.gesetze-im-internet.de/stgebo_2011';

/** Day the GebOSt was fetched and read. Raw record: `src/data/sources/fuehrerschein.json`. */
const STAND = '2026-08-03';

const nr = (nummer: string): CostSource => ({
  label: `GebOSt Nr. ${nummer}`,
  url: `${GEBOST}/anlage.html`,
  retrieved: STAND,
});

const fest = (betrag: number) => ({ min: betrag, typ: betrag, max: betrag });

/**
 * Der amtliche Teil eines Führerscheins.
 *
 * **This topic is deliberately narrower than its keyword.** "Was kostet ein
 * Führerschein" is answered everywhere with a four-digit number, and the bulk
 * of that number is the driving school — freely priced, regionally varied and
 * without any official source. This site's rule is that a figure comes from its
 * source, so the estimator covers exactly the part that has one: the fees laid
 * down in the GebOSt. The page says so in the answer sentence rather than
 * burying it, because a reader who expects 3.000 € and reads 170,90 € must not
 * think the site is wrong.
 *
 * It also settles a premise of the original task. Queue 1.4 asked for
 * "Führerschein by Bundesland" — but the GebOSt is federal, so the official
 * part is identical everywhere. The regional variation people notice is
 * entirely driving-school pricing.
 */
export const fuehrerschein: TopicConfig = {
  slug: 'fuehrerschein-gebuehren',
  vertical: 'verkehr',
  question: 'Was kostet der Führerschein an Gebühren?',
  title: 'Führerschein Kosten 2026: alle Gebühren von Antrag bis Prüfung',
  description:
    'Führerschein-Gebühren 2026 nach GebOSt: Antrag, Erteilung, Theorie- und Praxisprüfung – bundesweit einheitlich, mit Rechtsgrundlage je Position.',
  answer:
    'Der amtliche Teil eines Pkw-Führerscheins kostet 170,90 €: 5,10 € für die Antragsprüfung, 35,70 € für die Erteilung, 11,10 € plus 9,90 € für die theoretische Prüfung am PC und 109,10 € für die praktische Prüfung. Diese Beträge stehen in einer Bundesverordnung und sind überall gleich. Nicht enthalten ist die Fahrschule – sie ist der weitaus größte Posten und frei kalkuliert.',
  exact: true,
  verified: true,
  hinweis:
    'Diese Beträge decken nur die Gebühren von Behörde und Prüforganisation. Fahrschule, Sehtest, Erste-Hilfe-Kurs und Passbild kommen hinzu und haben keinen amtlich festgelegten Preis.',

  groups: [
    {
      id: 'klasse',
      label: 'Praktische Prüfung',
      kind: 'single',
      help: 'Die Gebühr für die praktische Prüfung hängt an der Führerscheinklasse.',
      defaults: ['b'],
      options: [
        { id: 'b', label: 'Klasse B oder BE (Pkw)', amount: fest(109.1), source: nr('402.3') },
        { id: 'am', label: 'Klasse AM (Moped)', amount: fest(109.1), source: nr('402.8') },
        {
          id: 'a',
          label: 'Klasse A, A2 oder A1 (Motorrad)',
          amount: fest(136.7),
          source: nr('402.1'),
        },
        {
          id: 'a_stufen',
          label: 'Klasse A oder A2 über die Stufenregelung',
          amount: fest(118.6),
          note: 'Aufstieg nach § 15 Abs. 3 und 4 FeV.',
          source: nr('402.1a'),
        },
        { id: 't', label: 'Klasse T (Zugmaschine)', amount: fest(136.7), source: nr('402.9') },
        { id: 'c', label: 'Klasse C oder CE (Lkw)', amount: fest(164.5), source: nr('402.4') },
        { id: 'd', label: 'Klasse D oder D1 (Bus)', amount: fest(164.5), source: nr('402.6') },
        { id: 'de', label: 'Klasse DE oder D1E', amount: fest(156.7), source: nr('402.7') },
      ],
    },

    {
      id: 'behoerde',
      label: 'Fahrerlaubnisbehörde',
      kind: 'multi',
      help: 'Fällt bei jeder Ersterteilung an.',
      defaults: ['antrag', 'erteilung'],
      options: [
        {
          id: 'antrag',
          label: 'Prüfung des Antrags',
          amount: fest(5.1),
          source: nr('201'),
        },
        {
          id: 'erteilung',
          label: 'Ersterteilung der Fahrerlaubnis',
          amount: fest(35.7),
          note: 'Gilt ebenso für Erweiterung und Verlängerung.',
          source: nr('202.1'),
        },
      ],
    },

    {
      id: 'theorie',
      label: 'Theoretische Prüfung',
      kind: 'multi',
      defaults: ['theorie', 'pc'],
      options: [
        {
          id: 'theorie',
          label: 'Theoretische Prüfung',
          amount: fest(11.1),
          note: 'Je Prüfung, für alle Klassen gleich. Bei einer Wiederholung fällt sie erneut an.',
          source: nr('401.1'),
        },
        {
          id: 'pc',
          label: 'Zuschlag: Prüfung am PC',
          amount: fest(9.9),
          note: 'Heute der Regelfall, also praktisch immer fällig.',
          dependsOn: { group: 'theorie', options: ['theorie'] },
          source: nr('401.3'),
        },
      ],
    },

    {
      id: 'extras',
      label: 'Weitere amtliche Gebühren',
      kind: 'multi',
      options: [
        {
          id: 'bf17',
          label: 'Begleitetes Fahren ab 17: Prüfungsbescheinigung',
          amount: fest(7.7),
          note: 'Nach § 48a FeV. Die Überprüfung jeder Begleitperson kostet zusätzlich 1,50 € bis 10,00 €.',
          source: nr('202.8'),
        },
        {
          id: 'schluessel',
          label: 'Schlüsselzahl 96, 196 oder 197 eintragen',
          amount: fest(28.6),
          source: nr('216'),
        },
        {
          id: 'international',
          label: 'Internationaler Führerschein',
          amount: { min: 11.2, typ: 13.25, max: 15.3 },
          note: 'Rahmengebühr – die Behörde setzt innerhalb der Spanne fest.',
          source: nr('207'),
        },
        {
          id: 'ersatz',
          label: 'Ersatzführerschein bei Verlust oder Diebstahl',
          amount: { min: 20.4, typ: 29.35, max: 38.3 },
          note: 'Rahmengebühr. Ohne Ersterteilung: dann entfallen Antrag, Erteilung und Prüfungen.',
          source: nr('202.4'),
        },
      ],
    },
  ],

  assumptions: [
    'Die GebOSt ist eine Bundesverordnung. Der amtliche Teil ist deshalb in jedem Bundesland gleich – wer regionale Unterschiede beim Führerschein bemerkt, sieht Fahrschulpreise, nicht Gebühren.',
    'Nicht enthalten und ohne amtlichen Preis: Fahrschule (Grundbetrag, Fahrstunden, Sonderfahrten, Vorstellungsentgelt), Sehtest, Erste-Hilfe-Kurs und das Passbild. Zusammen sind sie ein Vielfaches der Gebühren.',
    'Fällt eine Prüfung durch, wird die Prüfungsgebühr erneut fällig; Antrag und Erteilung nicht. Das folgt aus der Systematik des Tarifs – die Nummern 401 und 402 sind Gebühren je Prüfung, 201 und 202 je Antrag beziehungsweise Erteilung.',
    'Bei den Rahmengebühren (Internationaler Führerschein, Ersatzführerschein) setzt die Behörde einen Betrag innerhalb der Spanne fest.',
  ],

  sources: [
    {
      label: 'GebOSt – Gebührentarif für Maßnahmen im Straßenverkehr',
      url: `${GEBOST}/anlage.html`,
      retrieved: STAND,
    },
    { label: 'GebOSt – Gesamtausgabe', url: `${GEBOST}/`, retrieved: STAND },
  ],

  updated: STAND,
};
