/**
 * Proves that the energy prices the pages show are the ones Destatis published.
 * Run with `npm run check:energie`.
 *
 * Same discipline as `check-gebuehrentabellen.ts`: `src/lib/energiepreise.ts`
 * carries figures typed into a source file, and a typed figure is a claim until
 * it is checked against the record it came from. Three things are checked, and
 * the third is the one that would have caught a real mistake:
 *
 * 1. every constant in the lib appears in `src/data/sources/energiepreise.json`
 *    for the same period and consumption class;
 * 2. the three cost components the site derives add back up to the published
 *    gross price, so the breakdown cannot quietly disagree with the total;
 * 3. the gross price divided by 1.19 lands on the separately published
 *    "ohne Umsatzsteuer" series. That is an *independent* statement about what
 *    the three series mean. If the site had mistaken the net-of-VAT series for
 *    the net-of-all-taxes one — the confusion the record's own `_meta` warns
 *    about, worth about a third of the electricity price — this check fails.
 */
import { readFileSync } from 'node:fs';
import { GAS, STROM, anteil, type Verbrauchsklasse } from '../src/lib/energiepreise.ts';

const daten = JSON.parse(
  readFileSync(new URL('../src/data/sources/energiepreise.json', import.meta.url), 'utf8'),
);

const PERIODE = { jahr: 2025, halbjahr: '2. Halbjahr' };

const PREISART: Record<string, string> = {
  brutto: 'Durchschnittspreise inkl.Steuern, Abgaben, Umlagen',
  ohneUst: 'Durchschnittspreise ohne Umsatzsteuer u.a. abz.St.',
  ohneSteuern: 'Durchschnittspreise ohne Steuern, Abgaben, Umlagen',
};

/** "2.500 bis unter 5.000 kWh" and "2 500 bis unter 5 000 KWh" are one class. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

interface Zeile {
  jahr: number;
  halbjahr: string;
  preisart: string;
  verbrauchsklasse: string;
  wert: number;
}

let geprueft = 0;
const fehler: string[] = [];

function pruefe(name: string, erwartet: number, ist: number, toleranz = 1e-9) {
  geprueft++;
  if (Math.abs(ist - erwartet) > toleranz) {
    fehler.push(`${name}: erwartet ${erwartet}, gefunden ${ist}`);
  }
}

function pruefeReihe(titel: string, klassen: Verbrauchsklasse[], zeilen: Zeile[]) {
  for (const klasse of klassen) {
    for (const [feld, preisart] of Object.entries(PREISART)) {
      const treffer = zeilen.filter(
        (z) =>
          z.jahr === PERIODE.jahr &&
          z.halbjahr === PERIODE.halbjahr &&
          z.preisart === preisart &&
          norm(z.verbrauchsklasse) === norm(klasse.label),
      );
      if (treffer.length !== 1) {
        geprueft++;
        fehler.push(
          `${titel} · ${klasse.label} · ${feld}: ${treffer.length} Zeilen im Datensatz, erwartet genau eine`,
        );
        continue;
      }
      pruefe(
        `${titel} · ${klasse.label} · ${feld}`,
        treffer[0]!.wert,
        klasse[feld as keyof Verbrauchsklasse] as number,
      );
    }

    const summe =
      anteil(klasse, 'energie') + anteil(klasse, 'abgaben') + anteil(klasse, 'ust');
    pruefe(`${titel} · ${klasse.label} · Summe der drei Anteile`, klasse.brutto, summe, 5e-5);

    // 19 % USt (§ 12 Abs. 1 UStG) — an outside fact, not one of the series.
    pruefe(
      `${titel} · ${klasse.label} · brutto ÷ 1,19 gegen die Reihe "ohne Umsatzsteuer"`,
      klasse.ohneUst,
      klasse.brutto / 1.19,
      1e-4,
    );
  }
}

pruefeReihe('Strom', STROM, daten.strompreise);
pruefeReihe('Gas', GAS, daten.erdgaspreise);

console.log(`Energiepreise: ${geprueft} Werte geprüft, ${fehler.length} Abweichungen`);
for (const f of fehler) console.error('  ! ' + f);
if (fehler.length) process.exit(1);
