import type { CostSource, TopicConfig } from './types';

const FAMGKG = 'https://www.gesetze-im-internet.de/famgkg';
const RVG = 'https://www.gesetze-im-internet.de/rvg';

/** Day both statutes were fetched and read. Raw record: `src/data/sources/scheidung.json`. */
const STAND = '2026-08-03';

const famgkgQ = (was: string): CostSource => ({
  label: `${was} FamGKG`,
  url: `${FAMGKG}/anlage_1.html`,
  retrieved: STAND,
});
const rvgQ = (was: string): CostSource => ({
  label: `${was} RVG`,
  url: `${RVG}/anlage_1.html`,
  retrieved: STAND,
});

/**
 * Scheidungskosten.
 *
 * The topic that forced the last piece of the contract. Its fee depends on a
 * **Verfahrenswert**, and that value is not something anyone knows: it is the
 * couple's three-month net income (§ 43 FamGKG, at least 3.000 €) plus 10 % of
 * it per Versorgungsanrecht (§ 50 FamGKG, at least 1.000 € in total). So the
 * page asks for the two things people do know and derives the value in front of
 * them — `inputs` → `verfahrenswert.abgeleitet`.
 *
 * **Why the parts must be added before the table, not after.** Both fee tables
 * are degressive: the fee per euro falls as the value rises. Pushing the
 * Ehesache and the Versorgungsausgleich through the table separately and adding
 * the two fees produces a higher amount than the law allows. Deriving one value
 * first is not a convenience, it is the difference between right and wrong.
 *
 * **RDG:** the page states a fee schedule, never an assessment. § 43 FamGKG
 * puts the Verfahrenswert expressly in the court's discretion, the "three
 * months' net" is only its Absatz 2, and the deductions for children come from
 * OLG guidance rather than the statute. All of that is said in the assumptions
 * rather than implied by a confident-looking number.
 */
export const scheidung: TopicConfig = {
  slug: 'scheidung',
  vertical: 'recht',
  question: 'Was kostet eine Scheidung?',
  title: 'Was kostet eine Scheidung? Gerichts- und Anwaltskosten 2026',
  description:
    'Scheidungskosten 2026 nach FamGKG und RVG: Verfahrenswert aus Einkommen und Anrechten, Gerichts- und Anwaltskosten, je Position mit Rechtsgrundlage.',
  answer:
    'Bei 3.500 € gemeinsamem Monatsnetto und zwei Versorgungsanrechten kostet eine einvernehmliche Scheidung mit einem Anwalt rund 2.754 €. Davon sind 627 € Gerichtskosten und 2.127 € Anwaltskosten inklusive Umsatzsteuer. Streiten beide mit eigenem Anwalt, fallen die Anwaltskosten zweimal an.',
  exact: true,
  verified: true,
  hinweis:
    'Der Verfahrenswert steht nach § 43 FamGKG im Ermessen des Gerichts. Die Rechnung hier bildet die gesetzlichen Regelwerte ab und ist eine Orientierung, keine Vorhersage für den Einzelfall.',

  inputs: [
    {
      id: 'netto3',
      label: 'Nettoeinkommen beider Ehegatten in drei Monaten',
      help: 'Also das gemeinsame Monatsnetto mal drei. § 43 Abs. 2 FamGKG stellt genau darauf ab.',
      min: 3_000,
      max: 150_000,
      step: 500,
      default: 10_500,
      einheit: '€',
    },
    {
      id: 'anrechte',
      label: 'Versorgungsanrechte',
      help: 'Wie viele Rentenanwartschaften auszugleichen sind – gesetzliche Rente, Betriebsrente, private Vorsorge. Meist zwei bis vier.',
      min: 0,
      max: 10,
      step: 1,
      default: 2,
    },
    {
      id: 'verfahrenswert',
      label: 'Daraus folgt der Verfahrenswert',
      help: 'Ehesache nach § 43 FamGKG (mindestens 3.000 €) plus 10 % je Anrecht für den Versorgungsausgleich nach § 50 FamGKG (mindestens 1.000 € insgesamt).',
      min: 3_000,
      max: 1_000_000,
      step: 100,
      default: 12_600,
      einheit: '€',
      abgeleitet: {
        terme: [
          { faktor: 1, inputs: ['netto3'], mindestens: 3_000 },
          { faktor: 0.1, inputs: ['netto3', 'anrechte'], mindestens: 1_000 },
        ],
        mindestens: 3_000,
      },
    },
  ],

  groups: [
    {
      id: 'gericht',
      label: 'Gericht',
      kind: 'multi',
      help: 'Gerichtskosten fallen ohne Umsatzsteuer an.',
      defaults: ['verfahren'],
      options: [
        {
          id: 'verfahren',
          label: 'Scheidungsverfahren, erste Instanz',
          amount: { kind: 'skala', skala: 'famgkg', input: 'verfahrenswert', satz: 2.0 },
          note: '2,0-Gebühr nach Tabelle des FamGKG.',
          source: famgkgQ('KV 1110'),
        },
      ],
    },

    {
      id: 'anwalt',
      label: 'Anwalt',
      kind: 'multi',
      help: 'Für eine einvernehmliche Scheidung genügt ein Anwalt – nur die antragstellende Person braucht anwaltliche Vertretung.',
      defaults: ['verfahrensgebuehr', 'terminsgebuehr'],
      options: [
        {
          id: 'verfahrensgebuehr',
          label: 'Verfahrensgebühr',
          amount: { kind: 'skala', skala: 'rvg', input: 'verfahrenswert', satz: 1.3 },
          note: '1,3-Gebühr nach Tabelle des RVG.',
          source: rvgQ('VV 3100'),
        },
        {
          id: 'terminsgebuehr',
          label: 'Terminsgebühr',
          amount: { kind: 'skala', skala: 'rvg', input: 'verfahrenswert', satz: 1.2 },
          note: '1,2-Gebühr für den Gerichtstermin.',
          source: rvgQ('VV 3104'),
        },
        {
          id: 'zweiter_anwalt',
          label: 'Zweiter Anwalt (streitige Scheidung)',
          amount: {
            kind: 'faktor',
            von: ['verfahrensgebuehr', 'terminsgebuehr'],
            faktor: 1,
          },
          note: 'Vertritt sich der andere Ehegatte ebenfalls anwaltlich, fallen dieselben Gebühren ein zweites Mal an.',
          dependsOn: { group: 'anwalt', options: ['verfahrensgebuehr'] },
          source: rvgQ('VV 3100 und 3104'),
        },
      ],
    },

    {
      id: 'auslagen',
      label: 'Auslagen und Steuer',
      kind: 'multi',
      help: 'Beides bezieht sich nur auf die Anwaltsgebühren, nicht auf die Gerichtskosten.',
      defaults: ['pauschale', 'ust'],
      options: [
        {
          id: 'pauschale',
          label: 'Post- und Telekommunikationspauschale',
          amount: {
            kind: 'prozent',
            von: ['verfahrensgebuehr', 'terminsgebuehr', 'zweiter_anwalt'],
            prozent: 20,
            hoechstens: 20,
          },
          note: '20 % der Gebühren, höchstens 20,00 € – je Anwalt und Angelegenheit.',
          source: rvgQ('VV 7002'),
        },
        {
          id: 'ust',
          label: '19 % Umsatzsteuer auf die Anwaltsvergütung',
          amount: {
            kind: 'faktor',
            von: ['verfahrensgebuehr', 'terminsgebuehr', 'zweiter_anwalt', 'pauschale'],
            faktor: 0.19,
          },
          note: 'Gerichtskosten sind keine umsatzsteuerpflichtige Leistung.',
          source: rvgQ('VV 7008'),
        },
      ],
    },
  ],

  assumptions: [
    'Der Verfahrenswert steht nach § 43 Abs. 1 FamGKG ausdrücklich im Ermessen des Gerichts. Die verbreitete Faustformel „drei Monatsnettos" gibt nur Absatz 2 wieder; Abschläge für unterhaltsberechtigte Kinder folgen den Leitlinien der Oberlandesgerichte und nicht dem Gesetz.',
    'Ehesache und Versorgungsausgleich werden zu einem Verfahrenswert addiert und erst dann durch die Gebührentabelle geschickt. Beide Tabellen sind degressiv – wer die Teile einzeln umrechnet und die Gebühren addiert, kommt auf einen zu hohen Betrag.',
    'Für eine einvernehmliche Scheidung genügt ein Anwalt. Der zweite Ehegatte kann dem Antrag ohne eigene Vertretung zustimmen; ein eigener Anwalt ist nur nötig, wenn er eigene Anträge stellen will.',
    'Die Post- und Telekommunikationspauschale nach VV 7002 RVG beträgt 20 % der Gebühren, höchstens aber 20,00 € – bei den hier üblichen Werten also praktisch immer 20,00 €.',
    'Nicht enthalten: Folgesachen wie Unterhalt, Sorgerecht oder Zugewinnausgleich. Jede erhöht den Verfahrenswert nach eigenen Regeln (§§ 44, 51 FamGKG) und damit beide Gebühren.',
    'Wer die Kosten nicht tragen kann, kann Verfahrenskostenhilfe beantragen. Ob sie bewilligt wird, entscheidet das Gericht nach Einkommen und Vermögen.',
  ],

  sources: [
    { label: 'FamGKG § 28 – Wertgebühren', url: `${FAMGKG}/__28.html`, retrieved: STAND },
    { label: 'FamGKG § 43 – Ehesachen', url: `${FAMGKG}/__43.html`, retrieved: STAND },
    {
      label: 'FamGKG § 50 – Versorgungsausgleichssachen',
      url: `${FAMGKG}/__50.html`,
      retrieved: STAND,
    },
    { label: 'FamGKG Anlage 2 – Gebührentabelle', url: `${FAMGKG}/anlage_2.html`, retrieved: STAND },
    { label: 'RVG § 13 – Wertgebühren', url: `${RVG}/__13.html`, retrieved: STAND },
    { label: 'RVG Anlage 2 – Gebührentabelle', url: `${RVG}/anlage_2.html`, retrieved: STAND },
  ],

  updated: STAND,
};
