import type { CostSource, TopicConfig } from './types';
import { QUELLE_URL, STAND, STAND_PERIODE, STROM, anteil, cent, stufen } from '../../lib/energiepreise';

/**
 * Stromkosten.
 *
 * The first topic on this site whose figures come from official statistics
 * instead of a Rechtsverordnung, and it is built to keep that difference
 * visible: `kennzahl: 'durchschnitt'` stops the estimator from calling a
 * Destatis mean a fixed price, and the closing `hinweis` says in as many words
 * that a household's own tariff decides.
 *
 * What makes the page worth having is the split. Destatis publishes each
 * consumption class three times — with everything, without VAT, without any
 * taxes, levies and charges — so "wie viel vom Strompreis ist Staat?" can be
 * answered by subtraction rather than by estimate. The three components are
 * therefore the option group, and switching one off is a legitimate question
 * ("was zahle ich ohne Steuern?"), not a way to build a cheaper case.
 *
 * The per-kWh price falls as consumption rises because a class average carries
 * that class's Grundpreis: someone using 800 kWh pays the same standing charge
 * over a quarter of the kilowatt-hours. That is why the estimator picks the
 * band from the entered consumption and prices the whole year at it, instead of
 * slicing the consumption across bands like a tax table.
 */

const quelle = (tabelle: string): CostSource => ({
  label: `Destatis 61243 – ${tabelle}, ${STAND_PERIODE}`,
  url: QUELLE_URL,
  retrieved: STAND,
});

const TABELLE = quelle('Strompreise für Haushalte (61243-0001)');

/** Class-by-class figures, generated so the prose cannot drift from the data. */
const klassenzeilen = STROM.map(
  (k) =>
    `${k.label}: ${cent(k.brutto)} Cent je Kilowattstunde, davon ${cent(
      anteil(k, 'abgaben') + anteil(k, 'ust'),
    )} Cent Steuern, Abgaben und Umlagen.`,
);

export const stromkosten: TopicConfig = {
  slug: 'stromkosten',
  vertical: 'wohnen',
  question: 'Was kostet Strom im Jahr?',
  title: 'Was kostet Strom 2026? Stromkosten pro Jahr berechnen',
  description:
    'Stromkosten 2026 nach Jahresverbrauch berechnen – amtliche Durchschnittspreise, aufgeteilt in Energie, Abgaben und Umsatzsteuer.',
  answer:
    'Ein Haushalt mit 3.000 Kilowattstunden Jahresverbrauch zahlt rund 1.161 € im Jahr. Dahinter steht ein Durchschnittspreis von 38,69 Cent je Kilowattstunde, den das Statistische Bundesamt für das 2. Halbjahr 2025 ausweist – davon sind 12,44 Cent Steuern, Abgaben und Umlagen, also knapp ein Drittel.',
  exact: false,
  verified: true,
  kennzahl: 'durchschnitt',
  hinweis:
    'Das sind die amtlichen Durchschnittspreise aller Haushalte in Deutschland, kein Angebot und kein Preis für Ihren Vertrag. Was Sie zahlen, hängt von Tarif, Netzgebiet und Zeitpunkt des Vertragsabschlusses ab; die Rechnung Ihres Versorgers trennt zudem in Grund- und Arbeitspreis, während der Durchschnittspreis beides zusammenfasst.',

  inputs: [
    {
      id: 'verbrauch',
      label: 'Stromverbrauch im Jahr',
      help: 'Steht auf der Jahresabrechnung. Ein Einpersonenhaushalt liegt meist bei 1.300 bis 2.000 kWh, vier Personen im Haus bei 4.000 bis 5.000 kWh. Bei 1.000, 2.500, 5.000 und 15.000 kWh springt der Betrag nach unten – dort beginnt die nächste Verbrauchsklasse mit ihrem eigenen, niedrigeren Durchschnittspreis.',
      min: 500,
      max: 10000,
      step: 100,
      default: 3000,
      einheit: 'kWh',
    },
  ],

  groups: [
    {
      id: 'bestandteile',
      label: 'Bestandteile des Strompreises',
      kind: 'multi',
      help: 'Alle drei zusammen ergeben den Preis, den ein Haushalt zahlt. Einzeln abwählbar, um zu sehen, welcher Teil woher kommt.',
      defaults: ['energie', 'abgaben', 'ust'],
      options: [
        {
          id: 'energie',
          label: 'Energie, Netz und Vertrieb',
          amount: { kind: 'proEinheit', input: 'verbrauch', stufen: stufen(STROM, 'energie') },
          note: 'Die Reihe „Durchschnittspreise ohne Steuern, Abgaben, Umlagen“. Sie enthält Beschaffung, Netzentgelt, Messung und Vertrieb – ein Netzentgelt ist keine Abgabe.',
          source: TABELLE,
        },
        {
          id: 'abgaben',
          label: 'Steuern, Abgaben und Umlagen ohne Umsatzsteuer',
          amount: { kind: 'proEinheit', input: 'verbrauch', stufen: stufen(STROM, 'abgaben') },
          note: 'Der Abstand zwischen den Reihen „ohne Steuern, Abgaben, Umlagen“ und „ohne Umsatzsteuer“. Destatis weist nicht aus, wie er sich auf Stromsteuer, Konzessionsabgabe und Umlagen verteilt – diese Seite tut es deshalb auch nicht.',
          source: TABELLE,
        },
        {
          id: 'ust',
          label: 'Umsatzsteuer',
          amount: { kind: 'proEinheit', input: 'verbrauch', stufen: stufen(STROM, 'ust') },
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
    'Daraus folgt etwas, das zunächst nach einem Rechenfehler aussieht: knapp oberhalb einer Klassengrenze kommt weniger heraus als knapp darunter – 2.400 kWh ergeben rund 1.052 €, 2.600 kWh nur rund 1.006 €. Das ist eine Eigenschaft der Statistik, keine Regel des Strommarkts. Sie vergleicht zwei verschiedene Gruppen von Haushalten, nicht denselben Haushalt vor und nach einer Mehrentnahme; für den einzelnen Vertrag kostet jede zusätzliche Kilowattstunde selbstverständlich Geld.',
    ...klassenzeilen,
    'Die drei Bestandteile sind kein Modell, sondern die Differenz dreier veröffentlichter Preisreihen derselben Tabelle; ihre Summe ist exakt der veröffentlichte Bruttopreis. Geprüft wird das bei jedem Build (npm run check:energie).',
    'Nicht enthalten: einmalige Kosten wie Anschluss oder Zählerwechsel sowie Boni und Preisgarantien einzelner Tarife.',
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
