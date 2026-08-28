/**
 * Die ausgerechneten Beispiele der Quell-Datensätze gegen sich selbst prüfen.
 *
 * ABGRENZUNG, damit hier nichts doppelt läuft: **`check:tabellen`
 * (`check-gebuehrentabellen.ts`) ist zuständig für Formel gegen Tabelle** — es
 * prüft die ausgelieferten Funktionen aus `src/lib/gebuehrentabellen.ts` gegen
 * alle veröffentlichten Werte von GNotKG A und B, FamGKG und RVG, 268 an der
 * Zahl. Dieser Prüfer hatte das am 2026-08-28 versehentlich ein zweites Mal
 * getan (184 Werte, engerer Ausschnitt), weil beim Bau niemand in die
 * `package.json` gesehen hatte. Der Teil ist wieder raus.
 *
 * Was bleibt, gab es vorher nicht: die **Rechenbeispiele**. Wo ein Datensatz
 * ein ausgerechnetes Beispiel führt, muss es aufgehen — Posten gegen Summe,
 * Netto mal 1,19 gegen Brutto, Einkommen plus Versorgungsausgleich gegen
 * Verfahrenswert. Diese Beispiele sind der Beleg, mit dem jemand die Seite
 * nachrechnen kann; genau dort lagen drei Werte in `scheidung.json` einen Cent
 * zu niedrig (an der Hälfte abgerundet statt kaufmännisch).
 *
 * **Warum nicht die Summen der gerenderten Seiten:** Ein Versuch, „Summe =
 * Summe der Posten" aus dem flachen Seitentext zu prüfen, meldete am
 * 2026-08-28 fünf Abweichungen — alle falsch. Der Text enthält Beträge, die
 * keine Posten sind („2,0-Gebühr, **mindestens 120,00 €**"). Wer das prüfen
 * will, braucht die DOM-Struktur der Positionszeilen, nicht den Text.
 *
 * Aufruf: npm run check:rechnungen
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'src/data/sources';
const fehler = [];
const melde = (m) => {
  fehler.push(m);
  console.error(`✗ ${m}`);
};
const cent = (x) => Math.round(x * 100) / 100;

// ---- Rechenbeispiele --------------------------------------------------------
let beispiele = 0;
for (const datei of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
  const d = JSON.parse(readFileSync(join(dir, datei), 'utf8'));

  for (const [schluessel, wert] of Object.entries(d)) {
    if (!/rechenbeispiel/i.test(schluessel)) continue;
    for (const b of Array.isArray(wert) ? wert : [wert]) {
      // a) Posten müssen ihre Summe ergeben
      if (Array.isArray(b.posten) && typeof b.summe_eur === 'number') {
        beispiele++;
        const summe = cent(b.posten.reduce((s, p) => s + p.betrag_eur, 0));
        if (Math.abs(summe - b.summe_eur) > 0.005) {
          melde(`${datei} ${schluessel}: Posten ergeben ${summe}, Feld sagt ${b.summe_eur}`);
        }
      }
      // b) Netto + Auslagen mal 1,19 muss das Brutto ergeben
      if (typeof b.anwalt_gebuehren_netto_eur === 'number' && typeof b.anwalt_brutto_eur === 'number') {
        beispiele++;
        const brutto = cent((b.anwalt_gebuehren_netto_eur + (b.auslagenpauschale_eur ?? 0)) * 1.19);
        if (Math.abs(brutto - b.anwalt_brutto_eur) > 0.005) {
          melde(`${datei} ${schluessel}: Brutto gerechnet ${brutto}, Feld sagt ${b.anwalt_brutto_eur}`);
        }
        if (typeof b.gerichtskosten_eur === 'number' && typeof b.summe_ein_anwalt_eur === 'number') {
          beispiele++;
          const summe = cent(b.gerichtskosten_eur + b.anwalt_brutto_eur);
          if (Math.abs(summe - b.summe_ein_anwalt_eur) > 0.005) {
            melde(`${datei} ${schluessel}: Summe gerechnet ${summe}, Feld sagt ${b.summe_ein_anwalt_eur}`);
          }
        }
      }
      // c) Verfahrenswert = Einkommen + Wert des Versorgungsausgleichs
      if (typeof b.drei_monats_nettoeinkommen_eur === 'number' && typeof b.verfahrenswert_eur === 'number') {
        beispiele++;
        const vw = cent(b.drei_monats_nettoeinkommen_eur + (b.wert_versorgungsausgleich_eur ?? 0));
        if (Math.abs(vw - b.verfahrenswert_eur) > 0.005) {
          melde(`${datei} ${schluessel}: Verfahrenswert gerechnet ${vw}, Feld sagt ${b.verfahrenswert_eur}`);
        }
      }
    }
  }
}
console.log(`${beispiele} Teilrechnungen in den Rechenbeispielen geprüft`);

if (fehler.length) {
  console.error(`\n${fehler.length} Abweichung(en).`);
  process.exit(1);
}
console.log('\nAlle Rechenbeispiele gehen auf. (Formel gegen Tabelle: siehe npm run check:tabellen.)');
