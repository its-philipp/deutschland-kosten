import type { Money } from '../data/topics/types';

/**
 * The official average energy prices, and the one place they are decomposed.
 *
 * Raw record: `src/data/sources/energiepreise.json` (Destatis GENESIS 61243,
 * fetched 2026-08-03 with the owner's account). This module holds nothing but
 * the **published** series; everything the pages show beyond them is computed
 * here and checked against the record by `npm run check:energie`.
 *
 * Why the decomposition is worth the trouble: "wie viel vom Strompreis ist
 * Staat?" is the question people actually ask, and it is answerable without a
 * single estimate, because Destatis publishes the same consumption class three
 * times over — with everything, without VAT, and without any taxes, levies and
 * charges at all. Two subtractions turn that into three cost components whose
 * sum is, by construction, exactly the published price. Nothing here is
 * modelled; the arithmetic only rearranges what the statistic already says.
 */

/** Latest period in the record. Destatis publishes half-yearly. */
export const STAND_PERIODE = '2. Halbjahr 2025';

/** Day the GENESIS table was fetched. */
export const STAND = '2026-08-03';

export const QUELLE_URL = 'https://www-genesis.destatis.de/datenbank/online/statistic/61243';

/**
 * One consumption class, as published: the three price series Destatis reports
 * side by side, in € per kWh.
 *
 * `bis` is the class's **exclusive** upper bound in kWh per year; the last class
 * has none. The class describes the household, not a slice of its consumption —
 * see the note on `proEinheit` in data/topics/types.ts.
 */
export interface Verbrauchsklasse {
  label: string;
  bis?: number;
  /** "Durchschnittspreise inkl. Steuern, Abgaben, Umlagen" — what a household pays. */
  brutto: number;
  /** "Durchschnittspreise ohne Umsatzsteuer u. a. abz. St." */
  ohneUst: number;
  /** "Durchschnittspreise ohne Steuern, Abgaben, Umlagen." */
  ohneSteuern: number;
}

/** Strompreise für Haushalte, Tabelle 61243-0001, 2. Halbjahr 2025. */
export const STROM: Verbrauchsklasse[] = [
  { label: 'unter 1.000 kWh', bis: 1000, brutto: 0.5949, ohneUst: 0.4999, ohneSteuern: 0.4345 },
  { label: '1.000 bis unter 2.500 kWh', bis: 2500, brutto: 0.4383, ohneUst: 0.3683, ohneSteuern: 0.3039 },
  { label: '2.500 bis unter 5.000 kWh', bis: 5000, brutto: 0.3869, ohneUst: 0.3252, ohneSteuern: 0.2625 },
  { label: '5.000 bis unter 15.000 kWh', bis: 15000, brutto: 0.3476, ohneUst: 0.2922, ohneSteuern: 0.2325 },
  { label: '15.000 kWh und mehr', brutto: 0.3283, ohneUst: 0.2759, ohneSteuern: 0.2168 },
];

/** Erdgaspreise für Haushalte, Tabelle 61243-0010, 2. Halbjahr 2025. */
export const GAS: Verbrauchsklasse[] = [
  { label: 'unter 5.600 kWh', bis: 5600, brutto: 0.1615, ohneUst: 0.1357, ohneSteuern: 0.1159 },
  { label: '5.600 bis unter 55.600 kWh', bis: 55600, brutto: 0.1223, ohneUst: 0.1028, ohneSteuern: 0.0837 },
  { label: '55.600 kWh und mehr', brutto: 0.1132, ohneUst: 0.0951, ohneSteuern: 0.0761 },
];

/**
 * The three parts a published price is split into. Named after what the series
 * are, not after what the individual taxes are called: Destatis does not break
 * the middle part down, so neither may this site.
 */
export type Preisteil = 'energie' | 'abgaben' | 'ust';

/** Published prices carry four decimals; keep the arithmetic there too. */
const vier = (x: number) => Math.round(x * 1e4) / 1e4;

export function anteil(klasse: Verbrauchsklasse, teil: Preisteil): number {
  if (teil === 'energie') return klasse.ohneSteuern;
  if (teil === 'abgaben') return vier(klasse.ohneUst - klasse.ohneSteuern);
  return vier(klasse.brutto - klasse.ohneUst);
}

const fix = (x: number): Money => ({ min: x, typ: x, max: x });

/**
 * The bands for one cost component, in the shape `proEinheit` expects.
 *
 * A statistical mean has no spread of its own — the spread a household actually
 * faces is tariff competition, which this table does not measure. So min, typ
 * and max are the same number and the topic declares `kennzahl: 'durchschnitt'`
 * rather than dressing an average up as a range.
 */
export function stufen(klassen: Verbrauchsklasse[], teil: Preisteil) {
  return klassen.map((klasse) =>
    klasse.bis === undefined
      ? { preis: fix(anteil(klasse, teil)) }
      : { bis: klasse.bis, preis: fix(anteil(klasse, teil)) },
  );
}

/** The class a given yearly consumption falls into. */
export function klasseFuer(klassen: Verbrauchsklasse[], kwh: number): Verbrauchsklasse {
  return klassen.find((k) => k.bis === undefined || kwh < k.bis) ?? klassen[klassen.length - 1]!;
}

/** Cent per kWh, for prose: 0.3869 → "38,69". */
export function cent(eurProKwh: number): string {
  return (eurProKwh * 100).toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
