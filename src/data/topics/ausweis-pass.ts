import type { CostSource, TopicConfig } from './types';

const GESETZE = 'https://www.gesetze-im-internet.de';

/**
 * The day the regulations were fetched and read in full — and therefore both
 * the topic's "Stand" and the `retrieved` date on every source below.
 *
 * Unlike the 2026-08-02 pass, this one is a retrieval claim the site can make:
 * PAuswGebV § 1 and PassV § 27/§ 28 were pulled from gesetze-im-internet.de and
 * read line by line. Raw record with quotes: `src/data/sources/ausweis-pass.json`.
 */
const STAND = '2026-08-03';

const pauswgebv = (abs: string): CostSource => ({
  label: `§ 1 ${abs} PAuswGebV`,
  url: `${GESETZE}/pauswgebv/__1.html`,
  retrieved: STAND,
});

const passv = (abs: string): CostSource => ({
  label: `§ 27 ${abs} PassV`,
  url: `${GESETZE}/passv_2007/__27.html`,
  retrieved: STAND,
});

/**
 * Reference topic for the Estimator contract (queue task 1.3), verified against
 * the primary sources in queue task 1.4.
 *
 * Chosen because statutory fees exercise the parts of the contract that are
 * easiest to get wrong: `exact: true` (cent formatting, no hedging language), a
 * `single` group that must always hold exactly one choice, `multi` groups of
 * optional surcharges, and a Spannenband whose span comes from the topic's whole
 * fee table rather than from the current pick.
 *
 * What the verification pass changed, beyond flipping `verified`:
 *
 * - **Every Reisepass figure cited § 15 PassV, which is the wrong provision.**
 *   § 15 PassV prescribes the *templates* of the Dienst- and Diplomatenpass and
 *   contains no fee at all; the fees are in § 27 PassV. The amounts happened to
 *   be right, the citations pointed at nothing.
 * - The Auslandsvertretung surcharge is **not one number**. § 27 Abs. 3 PassV
 *   raises Buchst. a/b by 36 € but Buchst. e (vorläufiger Pass) by 49 €, and
 *   § 1 Abs. 4 PAuswGebV raises only the Absatz-1 fee, never the vorläufiger
 *   Ausweis. Both were previously offered as a flat surcharge on every document,
 *   which produced totals no fee table yields — exactly the failure `dependsOn`
 *   exists to prevent.
 * - Four fee triggers were missing entirely: the authority-taken photo (+6 €,
 *   both documents), delivery/handover (+15 €, both documents) and the 30 €
 *   surcharge for an applicant resident abroad using a non-competent authority.
 * - The disputed Auslandszuschlag is settled: § 27 Abs. 3 PassV says 36 €. The
 *   31 € figure that a second source carried is wrong.
 *
 * **Not expressible in this contract:** § 27 Abs. 2 PassV *doubles* the fee for
 * certain acts instead of adding a fixed amount. `EstimatorOption.amount` is an
 * additive `Money` delta, so a doubling cannot be an option without one checkbox
 * per base document. Those cases are stated in `assumptions` instead. If the
 * contract ever grows a multiplicative option type, they belong in "Besondere
 * Umstände".
 */
export const ausweisPass: TopicConfig = {
  slug: 'ausweis-pass',
  vertical: 'recht',
  question: 'Was kostet ein Personalausweis oder Reisepass?',
  title: 'Was kostet ein Personalausweis oder Reisepass? Gebühren 2026',
  description:
    'Gebühren für Personalausweis und Reisepass 2026: Grundgebühr, ermäßigter Satz unter 24, Express und 48 Seiten – mit Rechner und Rechtsgrundlage.',
  answer:
    'Ein Personalausweis kostet ab 24 Jahren 46,00 €, unter 24 Jahren 27,60 €. Ein Reisepass mit 32 Seiten kostet ab 24 Jahren 70,00 €, unter 24 Jahren 37,50 €. Express, 48 Seiten und ein Antrag bei einer Auslandsvertretung kosten jeweils extra.',
  exact: true,
  verified: true,

  groups: [
    {
      id: 'dokument',
      label: 'Dokument',
      kind: 'single',
      help: 'Maßgeblich ist das Alter im Zeitpunkt der Antragstellung.',
      defaults: ['pa_ab24'],
      options: [
        {
          id: 'pa_ab24',
          label: 'Personalausweis, ab 24 Jahren',
          amount: { min: 46, typ: 46, max: 46 },
          note: 'Gültig 10 Jahre (§ 6 Abs. 1 PAuswG).',
          source: pauswgebv('Abs. 1 Nr. 2'),
        },
        {
          id: 'pa_unter24',
          label: 'Personalausweis, unter 24 Jahren',
          amount: { min: 27.6, typ: 27.6, max: 27.6 },
          note: 'Gültig 6 Jahre (§ 6 Abs. 3 PAuswG).',
          source: pauswgebv('Abs. 1 Nr. 1'),
        },
        {
          id: 'pa_vorlaeufig',
          label: 'Vorläufiger Personalausweis',
          amount: { min: 10, typ: 10, max: 10 },
          note: 'Höchstens 3 Monate gültig (§ 6 Abs. 4 PAuswG). Wird er neben dem regulären Ausweis beantragt, fällt er zusätzlich an.',
          source: pauswgebv('Abs. 2 Satz 1'),
        },
        {
          id: 'pass_ab24',
          label: 'Reisepass (32 Seiten), ab 24 Jahren',
          amount: { min: 70, typ: 70, max: 70 },
          note: 'Gültig 10 Jahre (§ 5 Abs. 1 PassG).',
          source: passv('Abs. 1 Nr. 1 Buchst. a'),
        },
        {
          id: 'pass_unter24',
          label: 'Reisepass (32 Seiten), unter 24 Jahren',
          amount: { min: 37.5, typ: 37.5, max: 37.5 },
          note: 'Gültig 6 Jahre (§ 5 Abs. 1 Satz 2 PassG).',
          source: passv('Abs. 1 Nr. 1 Buchst. b'),
        },
        {
          id: 'pass_vorlaeufig',
          label: 'Vorläufiger Reisepass',
          amount: { min: 26, typ: 26, max: 26 },
          note: 'Höchstens 1 Jahr gültig (§ 5 Abs. 3 PassG). Altersunabhängig.',
          source: passv('Abs. 1 Nr. 1 Buchst. e'),
        },
      ],
    },

    {
      id: 'zuschlaege',
      label: 'Ausstattung und Verfahren',
      kind: 'multi',
      help: 'Was nicht zum jeweiligen Dokument gehört, bleibt ausgegraut.',
      options: [
        {
          id: 'seiten48',
          label: '48 Seiten statt 32 (Vielreisepass)',
          amount: { min: 22, typ: 22, max: 22 },
          dependsOn: { group: 'dokument', options: ['pass_ab24', 'pass_unter24'] },
          source: passv('Abs. 1 Nr. 1 Buchst. c'),
        },
        {
          id: 'express',
          label: 'Expressverfahren',
          amount: { min: 32, typ: 32, max: 32 },
          note: 'Verkürzt die Herstellung, nicht die Bearbeitung in der Behörde. Für den vorläufigen Pass gibt es kein Expressverfahren.',
          dependsOn: { group: 'dokument', options: ['pass_ab24', 'pass_unter24'] },
          source: passv('Abs. 1 Nr. 1 Buchst. d'),
        },
        {
          id: 'lichtbild_pa',
          label: 'Lichtbild wird im Amt gemacht (Personalausweis)',
          amount: { min: 6, typ: 6, max: 6 },
          note: 'Nur für den regulären Ausweis; beim vorläufigen sieht die Verordnung diesen Zuschlag nicht vor.',
          dependsOn: { group: 'dokument', options: ['pa_ab24', 'pa_unter24'] },
          source: pauswgebv('Abs. 4 Nr. 4'),
        },
        {
          id: 'lichtbild_pass',
          label: 'Lichtbild wird im Amt gemacht (Reisepass)',
          amount: { min: 6, typ: 6, max: 6 },
          dependsOn: { group: 'dokument', options: ['pass_ab24', 'pass_unter24', 'pass_vorlaeufig'] },
          source: passv('Abs. 1 Nr. 4'),
        },
        {
          id: 'uebergabe_pa',
          label: 'Übergabe außerhalb des Amtes (Personalausweis)',
          amount: { min: 15, typ: 15, max: 15 },
          note: 'Übergabe nach § 18 Abs. 2 PAuswV.',
          dependsOn: { group: 'dokument', options: ['pa_ab24', 'pa_unter24'] },
          source: pauswgebv('Abs. 4 Nr. 3'),
        },
        {
          id: 'zustellung_pass',
          label: 'Zustellung nach Hause (Reisepass)',
          amount: { min: 15, typ: 15, max: 15 },
          note: 'Zustellung nach § 17 Abs. 2 PassV.',
          dependsOn: { group: 'dokument', options: ['pass_ab24', 'pass_unter24', 'pass_vorlaeufig'] },
          source: passv('Abs. 1 Nr. 3'),
        },
      ],
    },

    {
      id: 'umstaende',
      label: 'Besondere Umstände',
      kind: 'multi',
      options: [
        {
          id: 'ausserhalb_pa',
          label: 'Außerhalb der Dienstzeit oder bei einer unzuständigen Behörde',
          amount: { min: 13, typ: 13, max: 13 },
          note: 'Gilt auch für den vorläufigen Personalausweis. Für den regulären Reisepass sieht die Passverordnung keinen solchen Zuschlag vor.',
          dependsOn: { group: 'dokument', options: ['pa_ab24', 'pa_unter24', 'pa_vorlaeufig'] },
          source: pauswgebv('Abs. 3'),
        },
        {
          id: 'unzustaendig_ausland_pa',
          label: 'Unzuständige Behörde bei Wohnsitz im Ausland (Personalausweis)',
          amount: { min: 30, typ: 30, max: 30 },
          note: 'Für Antragstellende mit gewöhnlichem Aufenthalt im Ausland. Nicht zusätzlich zum Zuschlag nach Absatz 3 ankreuzen – die Verordnung führt beide Fälle getrennt.',
          dependsOn: { group: 'dokument', options: ['pa_ab24', 'pa_unter24'] },
          source: pauswgebv('Abs. 4 Nr. 1'),
        },
        {
          id: 'ausland_pa',
          label: 'Antrag bei einer deutschen Auslandsvertretung (Personalausweis)',
          amount: { min: 43, typ: 43, max: 43 },
          dependsOn: { group: 'dokument', options: ['pa_ab24', 'pa_unter24'] },
          source: pauswgebv('Abs. 4 Nr. 2'),
        },
        {
          id: 'ausland_pass',
          label: 'Antrag bei einer deutschen Auslandsvertretung (Reisepass)',
          amount: { min: 36, typ: 36, max: 36 },
          dependsOn: { group: 'dokument', options: ['pass_ab24', 'pass_unter24'] },
          source: passv('Abs. 3'),
        },
        {
          id: 'ausland_pass_vorlaeufig',
          label: 'Antrag bei einer deutschen Auslandsvertretung (vorläufiger Reisepass)',
          amount: { min: 49, typ: 49, max: 49 },
          note: 'Beim vorläufigen Pass ist der Auslandszuschlag höher als beim regulären.',
          dependsOn: { group: 'dokument', options: ['pass_vorlaeufig'] },
          source: passv('Abs. 3'),
        },
      ],
    },
  ],

  assumptions: [
    'Die Gebühren sind bundesweit einheitlich in Rechtsverordnungen festgelegt; die Gemeinde erhebt keinen eigenen Aufschlag.',
    'Maßgeblich ist das Alter im Zeitpunkt der Antragstellung, nicht am Tag der Abholung.',
    'Biometrische Passfotos vom Fotografen sind nicht enthalten. Lässt man das Bild im Amt machen, sind es 6,00 € extra – die stehen im Rechner.',
    'Eine Verlängerung gibt es nicht: Nach § 6 Abs. 5 PAuswG und § 5 Abs. 4 PassG wird immer ein neues Dokument ausgestellt, also fällt die volle Gebühr an.',
    'Nicht im Rechner, weil die Passverordnung dort verdoppelt statt aufschlägt: Nach § 27 Abs. 2 PassV verdoppelt sich die Gebühr, wenn ein vorläufiger Reisepass außerhalb der Dienstzeit ausgestellt wird, und ebenso, wenn ein Reisepass oder vorläufiger Reisepass auf eigenen Wunsch von einer unzuständigen Behörde ausgestellt wird.',
    'Die Änderung eines Reisepasses kostet 6,00 € (§ 27 Abs. 1 Nr. 2 PassV), an einer Auslandsvertretung 26,00 €. Die Änderung der Anschrift auf dem Personalausweis ist dagegen gebührenfrei (§ 1 Abs. 5 PAuswGebV).',
    'Bei Bedürftigkeit kann die Gebühr ermäßigt oder erlassen werden (§ 1 Abs. 6 PAuswGebV, § 28 PassV). Der Bezug von Bürgergeld oder Sozialhilfe allein genügt dafür ausdrücklich nicht – das entscheidet die Behörde im Einzelfall.',
  ],

  sources: [
    {
      label: 'PAuswGebV § 1 – Gebühren für Ausweise',
      url: `${GESETZE}/pauswgebv/__1.html`,
      retrieved: STAND,
    },
    {
      label: 'PassV § 27 – Gebühren',
      url: `${GESETZE}/passv_2007/__27.html`,
      retrieved: STAND,
    },
    {
      label: 'PassV § 28 – Ermäßigung und Befreiung von Gebühren',
      url: `${GESETZE}/passv_2007/__28.html`,
      retrieved: STAND,
    },
    {
      label: 'PAuswG § 6 – Gültigkeitsdauer des Ausweises',
      url: `${GESETZE}/pauswg/__6.html`,
      retrieved: STAND,
    },
    {
      label: 'PassG § 5 – Gültigkeitsdauer',
      url: `${GESETZE}/pa_g_1986/__5.html`,
      retrieved: STAND,
    },
  ],

  updated: STAND,
};
