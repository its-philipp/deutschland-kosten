import type { CostSource, TopicConfig } from './types';
import { GAS, QUELLE_URL, STAND, STAND_PERIODE, anteil, cent, stufen } from '../../lib/energiepreise';

/**
 * Gaskosten.
 *
 * Same construction as `stromkosten` and from the same Destatis statistic, but
 * a different question: gas is what a house is heated with, so the input runs
 * over the consumption of a whole building and the interesting comparison is
 * with the cost of the heating itself, not with a household appliance.
 *
 * Kept as its own topic rather than a second tab on the electricity page: the
 * consumption ranges, the classes and the sentences a reader needs share
 * nothing but the arithmetic, and one page per question is what this site's
 * SEO rule asks for.
 */

const TABELLE: CostSource = {
  label: `Destatis 61243 – Erdgaspreise für Haushalte (61243-0010), ${STAND_PERIODE}`,
  url: QUELLE_URL,
  retrieved: STAND,
};

/** Class-by-class figures, generated so the prose cannot drift from the data. */
const klassenzeilen = GAS.map(
  (k) =>
    `${k.label}: ${cent(k.brutto)} Cent je Kilowattstunde, davon ${cent(
      anteil(k, 'abgaben') + anteil(k, 'ust'),
    )} Cent Steuern, Abgaben und Umlagen.`,
);

export const gaskosten: TopicConfig = {
  slug: 'gaskosten',
  vertical: 'wohnen',
  question: 'Was kostet Gas im Jahr?',
  title: 'Was kostet Gas 2026? Gaskosten pro Jahr berechnen',
  description:
    'Gaskosten 2026 nach Jahresverbrauch berechnen – amtliche Durchschnittspreise, aufgeteilt in Energie, Abgaben und Umsatzsteuer.',
  answer:
    'Ein Einfamilienhaus mit 15.000 Kilowattstunden Gasverbrauch zahlt rund 1.835 € im Jahr. Dahinter steht ein Durchschnittspreis von 12,23 Cent je Kilowattstunde, den das Statistische Bundesamt für das 2. Halbjahr 2025 ausweist – davon sind 3,86 Cent Steuern, Abgaben und Umlagen.',
  exact: false,
  verified: true,
  kennzahl: 'durchschnitt',
  hinweis:
    'Das sind die amtlichen Durchschnittspreise aller Haushalte in Deutschland, kein Angebot und kein Preis für Ihren Vertrag. Wer zur Miete wohnt, findet den Verbrauch nicht auf einer eigenen Gasrechnung, sondern in der Heizkostenabrechnung – dort kommen Betriebsstrom, Wartung und Messdienst hinzu, die in diesen Preisen nicht enthalten sind.',

  inputs: [
    {
      id: 'verbrauch',
      label: 'Gasverbrauch im Jahr',
      help: 'Steht auf der Jahresabrechnung, meist in Kilowattstunden. Eine Wohnung liegt oft bei 6.000 bis 12.000 kWh, ein unsaniertes Einfamilienhaus bei 20.000 bis 35.000 kWh. Bei 5.600 und 55.600 kWh springt der Betrag nach unten – dort beginnt die nächste Verbrauchsklasse mit ihrem eigenen, niedrigeren Durchschnittspreis.',
      min: 2000,
      max: 60000,
      step: 500,
      default: 15000,
      einheit: 'kWh',
    },
  ],

  groups: [
    {
      id: 'bestandteile',
      label: 'Bestandteile des Gaspreises',
      kind: 'multi',
      help: 'Alle drei zusammen ergeben den Preis, den ein Haushalt zahlt. Einzeln abwählbar, um zu sehen, welcher Teil woher kommt.',
      defaults: ['energie', 'abgaben', 'ust'],
      options: [
        {
          id: 'energie',
          label: 'Energie, Netz und Vertrieb',
          amount: { kind: 'proEinheit', input: 'verbrauch', stufen: stufen(GAS, 'energie') },
          note: 'Die Reihe „Durchschnittspreise ohne Steuern, Abgaben, Umlagen“. Sie enthält Beschaffung, Netzentgelt, Messung und Vertrieb – ein Netzentgelt ist keine Abgabe.',
          source: TABELLE,
        },
        {
          id: 'abgaben',
          label: 'Steuern, Abgaben und Umlagen ohne Umsatzsteuer',
          amount: { kind: 'proEinheit', input: 'verbrauch', stufen: stufen(GAS, 'abgaben') },
          note: 'Der Abstand zwischen den Reihen „ohne Steuern, Abgaben, Umlagen“ und „ohne Umsatzsteuer“. Destatis weist nicht aus, wie er sich auf Energiesteuer, CO₂-Preis, Konzessionsabgabe und Umlagen verteilt – diese Seite tut es deshalb auch nicht.',
          source: TABELLE,
        },
        {
          id: 'ust',
          label: 'Umsatzsteuer',
          amount: { kind: 'proEinheit', input: 'verbrauch', stufen: stufen(GAS, 'ust') },
          note: 'Der Abstand zwischen der Reihe „ohne Umsatzsteuer“ und dem Bruttopreis. Er entspricht dem Regelsatz von 19 % nach § 12 Abs. 1 UStG.',
          source: TABELLE,
        },
      ],
    },
  ],

  assumptions: [
    `Grundlage sind die Durchschnittspreise des Statistischen Bundesamtes für private Haushalte, ${STAND_PERIODE}. Destatis veröffentlicht halbjährlich; eine neuere Periode ersetzt diese Zahlen.`,
    'Der Preis richtet sich nach der Verbrauchsklasse, in die der eingegebene Jahresverbrauch fällt, und gilt dann für den gesamten Verbrauch. Die Klasse beschreibt den Haushalt, nicht eine Scheibe seines Verbrauchs – anders als bei einem Steuertarif wird hier nichts gestaffelt gerechnet.',
    'Der Durchschnittspreis je Kilowattstunde enthält den Grundpreis. Deshalb fällt er, je mehr ein Haushalt verbraucht: derselbe feste Betrag verteilt sich auf mehr Kilowattstunden.',
    'Daraus folgt etwas, das zunächst nach einem Rechenfehler aussieht: knapp oberhalb einer Klassengrenze kommt weniger heraus als knapp darunter – 5.500 kWh ergeben rund 888 €, 5.700 kWh nur rund 697 €. Das ist eine Eigenschaft der Statistik, keine Regel des Gasmarkts. Sie vergleicht zwei verschiedene Gruppen von Haushalten, nicht denselben Haushalt vor und nach einer Mehrentnahme; für den einzelnen Vertrag kostet jede zusätzliche Kilowattstunde selbstverständlich Geld.',
    ...klassenzeilen,
    'Zählerstände in Kubikmetern sind nicht dasselbe wie Kilowattstunden. Die Abrechnung rechnet mit Zustandszahl und Brennwert um; als grober Anhalt entspricht ein Kubikmeter Erdgas rund zehn Kilowattstunden. Für eine Rechnung gilt der Umrechnungsfaktor auf der eigenen Abrechnung.',
    'Die drei Bestandteile sind kein Modell, sondern die Differenz dreier veröffentlichter Preisreihen derselben Tabelle; ihre Summe ist exakt der veröffentlichte Bruttopreis. Geprüft wird das bei jedem Build (npm run check:energie).',
    'Nicht enthalten: Wartung und Schornsteinfeger, Betriebsstrom der Heizung sowie einmalige Kosten wie Anschluss oder Zählerwechsel.',
  ],

  sources: [
    TABELLE,
    {
      label: 'UStG § 12 – Steuersätze',
      url: 'https://www.gesetze-im-internet.de/ustg_1980/__12.html',
      retrieved: '2026-08-16',
    },
  ],

  updated: STAND,
};
