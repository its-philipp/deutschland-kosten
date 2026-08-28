/**
 * Die Rechenwerke der Quell-Datensätze gegen sich selbst prüfen.
 *
 * Dieses Projekt rechnet, statt Zahlen nur wiederzugeben — und die Grundlage
 * dieser Rechnungen steht in den Quell-JSONs: eine Stufenformel, eine
 * veröffentlichte Gebührentabelle, ausgerechnete Beispiele. Wenn eines davon
 * still auseinanderfällt, rechnet der Estimator weiter, nur falsch.
 *
 * Zwei Prüfungen, beide ohne einen einzigen Blick auf das gerenderte HTML:
 *
 *  1. **Formel gegen Tabelle.** `notar-grundbuch.json` führt die Stufenformel
 *     aus § 34 Abs. 2 GNotKG *und* alle 92 Zeilen der Anlage 2. Die Formel muss
 *     jede der 184 veröffentlichten Zahlen treffen. Das ist die stärkste
 *     Prüfung im Projekt: zwei unabhängig erhobene Darstellungen derselben
 *     Sache, die sich gegenseitig belegen.
 *  2. **Rechenbeispiele.** Wo ein Datensatz ein ausgerechnetes Beispiel führt,
 *     muss es aufgehen — Posten gegen Summe, Netto × 1,19 gegen Brutto.
 *
 * **Warum nicht die Summen der gerenderten Seiten:** Ein Versuch, „Summe =
 * Summe der Posten" aus dem flachen Seitentext zu prüfen, meldete am
 * 2026-08-28 fünf Abweichungen — alle falsch. Der Text enthält Beträge, die
 * keine Posten sind („2,0-Gebühr, **mindestens 120,00 €**"), und flach gelesen
 * ist ein Erklärsatz von einer Position nicht zu unterscheiden. Wer das prüfen
 * will, braucht die DOM-Struktur der Positionszeilen, nicht den Text.
 *
 * Aufruf: npm run check:rechnungen
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'src/data/sources';
const fehler = [];
let geprueft = 0;
const melde = (m) => {
  fehler.push(m);
  console.error(`✗ ${m}`);
};
const cent = (x) => Math.round(x * 100) / 100;

// ---- 1. Stufenformel gegen die veröffentlichte Tabelle ----------------------
const notar = JSON.parse(readFileSync(join(dir, 'notar-grundbuch.json'), 'utf8'));
const F = notar.wertgebuehr_formel;

/** § 34 Abs. 2 GNotKG: über 500 € je angefangener Stufenbreite ein Stufenbetrag. */
function wertgebuehr(wert, spalte) {
  if (wert <= F.grundbetrag.bis_geschaeftswert) return F.grundbetrag[spalte];
  let g = F.grundbetrag[spalte];
  let unten = F.grundbetrag.bis_geschaeftswert;
  for (const stufe of F.stufen) {
    if (wert <= unten) break;
    const oben = Math.min(wert, stufe.bis_wert);
    g += Math.ceil((oben - unten) / stufe.je_angefangene) * stufe[spalte];
    unten = stufe.bis_wert;
    if (wert <= stufe.bis_wert) break;
  }
  return cent(g);
}

for (const zeile of notar.tabelle_anlage_2) {
  for (const spalte of ['tabelle_a', 'tabelle_b']) {
    if (zeile[spalte] == null) continue;
    geprueft++;
    const gerechnet = wertgebuehr(zeile.geschaeftswert_bis, spalte);
    if (Math.abs(gerechnet - zeile[spalte]) > 0.005) {
      melde(
        `GNotKG Anlage 2, Geschäftswert ${zeile.geschaeftswert_bis} €, ${spalte}: Tabelle ${zeile[spalte]}, Formel ${gerechnet}`,
      );
    }
  }
}
console.log(`${geprueft} Werte der GNotKG-Tabelle gegen die Stufenformel geprüft`);

// ---- 2. Rechenbeispiele ------------------------------------------------------
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
console.log('\nFormel und Tabelle stimmen überein, alle Rechenbeispiele gehen auf.');
