import type { CostSource, TopicConfig } from './types';

const GNOTKG = 'https://www.gesetze-im-internet.de/gnotkg';

/** Day the GNotKG was fetched and read. Raw record: `src/data/sources/notar-grundbuch.json`. */
const STAND = '2026-08-03';

const kv = (nummer: string, was: string): CostSource => ({
  label: `KV ${nummer} GNotKG – ${was}`,
  url: `${GNOTKG}/anlage_1.html`,
  retrieved: STAND,
});

/**
 * Notar- und Grundbuchkosten beim Immobilienkauf.
 *
 * The first topic built on the extended contract (queue task 1.5). It exists
 * because it could not exist before: every fee here is `Gebührensatz ×
 * Tabelle B(Geschäftswert)`, so the amounts are functions of a number the
 * reader supplies, not constants. The scale itself lives in
 * `lib/gebuehrentabellen.ts` and is checked against all 92 values GNotKG
 * Anlage 2 publishes — `npm run check:tabellen`.
 *
 * Two modelling decisions worth keeping:
 *
 * 1. **Two inputs, not one.** The Grundschuld is almost never the purchase
 *    price — it is the loan. Feeding the Kaufpreis into the Grundbuch fee for
 *    the Grundschuld would overstate it for everyone who brings equity.
 * 2. **VAT is charged on the notary's fees only.** The Grundbuchamt is a court,
 *    not a taxable supply. That is why the VAT option names the three notary
 *    options explicitly instead of taking the subtotal — getting this wrong
 *    would add 19 % to the court fees as well.
 */
export const notarGrundbuch: TopicConfig = {
  slug: 'notar-grundbuch',
  vertical: 'recht',
  question: 'Was kosten Notar und Grundbuch beim Hauskauf?',
  title: 'Was kosten Notar und Grundbuch beim Hauskauf? Gebühren 2026',
  description:
    'Notar- und Grundbuchkosten beim Immobilienkauf 2026, nach GNotKG aus Kaufpreis und Darlehen berechnet – mit Rechtsgrundlage je Position.',
  answer:
    'Bei 400.000 € Kaufpreis und 320.000 € Darlehen kosten Notar und Grundbuch zusammen 4.639,95 € – das sind 1,16 % des Kaufpreises. Der Anteil sinkt mit steigendem Kaufpreis: bei 150.000 € sind es 1,41 %, bei 900.000 € nur noch 1,04 %, weil die Gebührentabelle des GNotKG degressiv gestaffelt ist.',
  exact: true,
  verified: true,

  inputs: [
    {
      id: 'kaufpreis',
      label: 'Kaufpreis',
      help: 'Der beurkundete Kaufpreis. Er ist der Geschäftswert für den Kaufvertrag und die Eigentumsumschreibung.',
      min: 10_000,
      max: 3_000_000,
      step: 5_000,
      default: 400_000,
      einheit: '€',
    },
    {
      id: 'darlehen',
      label: 'Darlehen (Grundschuld)',
      help: 'Nur für die Grundschuld. Wer ohne Kredit kauft, stellt den Wert auf das Minimum und lässt die Grundschuld weg.',
      min: 10_000,
      max: 3_000_000,
      step: 5_000,
      default: 320_000,
      einheit: '€',
    },
  ],

  groups: [
    {
      id: 'notar',
      label: 'Notar',
      kind: 'multi',
      help: 'Der Kaufvertrag ist Pflicht (§ 311b BGB). Vollzug und Betreuung fallen beim Immobilienkauf im Regelfall an.',
      defaults: ['beurkundung', 'vollzug', 'betreuung'],
      options: [
        {
          id: 'beurkundung',
          label: 'Beurkundung des Kaufvertrags',
          amount: { kind: 'skala', skala: 'gnotkg-b', input: 'kaufpreis', satz: 2.0, mindestens: 120 },
          note: '2,0-Gebühr, mindestens 120,00 €.',
          source: kv('21100', 'Beurkundungsverfahren'),
        },
        {
          id: 'vollzug',
          label: 'Vollzugsgebühr',
          amount: { kind: 'skala', skala: 'gnotkg-b', input: 'kaufpreis', satz: 0.5 },
          note: 'Für die Abwicklung: Genehmigungen einholen, Vorkaufsrechtsverzicht, Unbedenklichkeitsbescheinigung.',
          source: kv('22110', 'Vollzugsgebühr'),
        },
        {
          id: 'betreuung',
          label: 'Betreuungsgebühr',
          amount: { kind: 'skala', skala: 'gnotkg-b', input: 'kaufpreis', satz: 0.5 },
          note: 'Für die Prüfung und Mitteilung der Fälligkeitsvoraussetzungen – beim Immobilienkauf der Regelfall.',
          source: kv('22200', 'Betreuungsgebühr'),
        },
      ],
    },

    {
      id: 'umsatzsteuer',
      label: 'Umsatzsteuer',
      kind: 'multi',
      help: 'Der Notar rechnet mit Umsatzsteuer ab, das Grundbuchamt als Gericht nicht.',
      defaults: ['ust'],
      options: [
        {
          id: 'ust',
          label: '19 % Umsatzsteuer auf die Notarkosten',
          amount: {
            kind: 'faktor',
            von: ['beurkundung', 'vollzug', 'betreuung'],
            faktor: 0.19,
          },
          note: 'Nur auf die Notargebühren. Gerichtsgebühren sind keine umsatzsteuerpflichtige Leistung.',
          source: kv('32014', 'Umsatzsteuer auf die Kosten'),
        },
      ],
    },

    {
      id: 'grundbuch',
      label: 'Grundbuchamt',
      kind: 'multi',
      help: 'Gerichtsgebühren, ohne Umsatzsteuer.',
      defaults: ['eigentum', 'vormerkung', 'loeschung_vormerkung'],
      options: [
        {
          id: 'eigentum',
          label: 'Eintragung als Eigentümer',
          amount: { kind: 'skala', skala: 'gnotkg-b', input: 'kaufpreis', satz: 1.0 },
          source: kv('14110', 'Eintragung eines Eigentümers oder von Miteigentümern'),
        },
        {
          id: 'vormerkung',
          label: 'Auflassungsvormerkung',
          amount: { kind: 'skala', skala: 'gnotkg-b', input: 'kaufpreis', satz: 0.5 },
          note: 'Sichert den Anspruch auf Übereignung zwischen Vertrag und Eintragung.',
          source: kv('14150', 'Eintragung einer Vormerkung'),
        },
        {
          id: 'loeschung_vormerkung',
          label: 'Löschung der Auflassungsvormerkung',
          amount: { min: 25, typ: 25, max: 25 },
          note: 'Festgebühr, unabhängig vom Kaufpreis.',
          dependsOn: { group: 'grundbuch', options: ['vormerkung'] },
          source: kv('14152', 'Löschung einer Vormerkung'),
        },
      ],
    },

    {
      id: 'finanzierung',
      label: 'Finanzierung',
      kind: 'multi',
      help: 'Nur bei Kreditfinanzierung. Rechnet mit dem Darlehensbetrag, nicht mit dem Kaufpreis.',
      defaults: ['grundschuld'],
      options: [
        {
          id: 'grundschuld',
          label: 'Eintragung der Grundschuld',
          amount: { kind: 'skala', skala: 'gnotkg-b', input: 'darlehen', satz: 1.0 },
          note: 'Buchgrundschuld. Eine Briefgrundschuld kostet nach KV 14120 eine 1,3-Gebühr.',
          source: kv('14121', 'Eintragung eines sonstigen Rechts'),
        },
      ],
    },
  ],

  assumptions: [
    'Die Gebühren sind bundesweit im GNotKG festgelegt. Ein Notar darf sie weder unterschreiten noch überschreiten – Preisvergleiche zwischen Notaren gehen deshalb ins Leere.',
    'Gerechnet wird mit Tabelle B des GNotKG. Die hier verwendete Formel aus § 34 Abs. 2 wurde gegen alle 92 in Anlage 2 veröffentlichten Werte geprüft.',
    'Nicht enthalten: die Grunderwerbsteuer. Sie ist Ländersache, liegt je nach Bundesland zwischen 3,5 und 6,5 Prozent und ist der mit Abstand größte Nebenkostenposten.',
    'Nicht enthalten: Maklerprovision, Auslagen des Notars (Porto, Grundbuchauszüge) und die Kosten einer Löschung von Altlasten des Verkäufers.',
    'Die Grundschuld wird mit dem Darlehensbetrag berechnet, nicht mit dem Kaufpreis. Wer Eigenkapital einbringt, zahlt hier entsprechend weniger.',
  ],

  sources: [
    { label: 'GNotKG § 34 – Wertgebühren', url: `${GNOTKG}/__34.html`, retrieved: STAND },
    {
      label: 'GNotKG Anlage 2 – Tabelle A und B',
      url: `${GNOTKG}/anlage_2.html`,
      retrieved: STAND,
    },
    {
      label: 'GNotKG Anlage 1 – Kostenverzeichnis',
      url: `${GNOTKG}/anlage_1.html`,
      retrieved: STAND,
    },
  ],

  updated: STAND,
};
