/**
 * Proves that the computed fee scales still reproduce the tables the statutes
 * publish. Run with `npm run check:tabellen`.
 *
 * This exists because `src/lib/gebuehrentabellen.ts` replaces a lookup with a
 * formula. That is only allowed as long as the formula agrees with every
 * published value — so the agreement is checked, not asserted. The published
 * values live in the source records collected on 2026-08-03; they were parsed
 * from the norms' own XML, not typed by hand.
 */
import { readFileSync } from 'node:fs';
import { famgkg, gnotkgA, gnotkgB, rvg } from '../src/lib/gebuehrentabellen.ts';

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));

let geprueft = 0;
const fehler: string[] = [];

function pruefe(name: string, wert: number, erwartet: number, ist: number) {
  geprueft++;
  if (Math.abs(ist - erwartet) > 0.005) {
    fehler.push(`${name} bei ${wert}: erwartet ${erwartet.toFixed(2)}, berechnet ${ist.toFixed(2)}`);
  }
}

const notar = read('../src/data/sources/notar-grundbuch.json');
for (const r of notar.tabelle_anlage_2) {
  pruefe('GNotKG Tabelle A', r.geschaeftswert_bis, r.tabelle_a, gnotkgA(r.geschaeftswert_bis));
  pruefe('GNotKG Tabelle B', r.geschaeftswert_bis, r.tabelle_b, gnotkgB(r.geschaeftswert_bis));
}

const scheidung = read('../src/data/sources/scheidung.json');
for (const r of scheidung.gerichtskosten.tabellenwerte) {
  pruefe('FamGKG', r.verfahrenswert_bis, r.gebuehr_eur, famgkg(r.verfahrenswert_bis));
}
for (const r of scheidung.anwaltskosten.tabellenwerte) {
  pruefe('RVG', r.gegenstandswert_bis, r.gebuehr_eur, rvg(r.gegenstandswert_bis));
}

console.log(`Gebührentabellen: ${geprueft} Werte geprüft, ${fehler.length} Abweichungen`);
for (const f of fehler) console.error('  ! ' + f);
if (fehler.length) process.exit(1);
