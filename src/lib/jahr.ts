/**
 * Die Jahreszahl im Titel — aus dem Stand der Daten, nicht aus der Uhr.
 *
 * **Warum nicht `new Date().getFullYear()`.** Ein Titel, der am 1. Januar von
 * selbst auf das neue Jahr springt, behauptet Aktualität, die die Zahlen
 * darunter nicht haben: Sie wurden zu einem bestimmten Datum gegen ihre Quelle
 * geprüft. Solange niemand sie erneut geprüft hat, ist die neue Jahreszahl
 * keine veraltete Angabe mehr, sondern eine unwahre. **Ein hartkodiertes altes
 * Jahr ist ehrlich alt; ein mitlaufendes ist aktiv falsch.** Aus der Bauzeit
 * abzuleiten hätte ohnehin wenig gebracht — ein statischer Build ändert sich
 * nur, wenn jemand ihn anstößt.
 *
 * **Was die Kopplung leistet:** Titel und Datenstand können nicht mehr
 * auseinanderlaufen. Wer die Quelle neu liest, frischt den Titel mit auf; wer
 * es nicht tut, sieht die Jahreszahl stehen bleiben — und `check-seo` meldet
 * ab dem 1. Januar „Jahr X im Titel, laufendes Jahr ist Y". Diese Meldung ist
 * dann kein Fehlalarm, sondern die jährliche Erinnerung, die Quelle neu zu
 * lesen. (Eingeführt 2026-09-12 auf deutschland-pflegegeld, übertragen
 * 2026-09-13.)
 */

/**
 * Die vierstellige Jahreszahl aus einer Standangabe — ISO (`2026-08-03`),
 * Monat (`2026-07`) oder Klartext (`1. Juli 2026`).
 *
 * Wirft, statt auf das laufende Jahr zurückzufallen: Ein stiller Rückfall wäre
 * genau die mitlaufende Jahreszahl, gegen die diese Datei geschrieben ist. Eine
 * Standangabe ohne Jahr ist ein Datenfehler.
 */
export function jahrAus(stand: string): number {
  const treffer = stand.match(/\b(19\d\d|20\d\d|21\d\d)\b/);
  if (!treffer) {
    throw new Error(
      `Aus der Standangabe „${stand}" lässt sich keine Jahreszahl lesen. ` +
        `Ein Titel darf seine Jahreszahl nicht raten.`,
    );
  }
  return Number(treffer[1]);
}

/**
 * Das früheste Jahr unter mehreren Ständen — für Seiten, die mehrere
 * Datensätze zusammenfassen (Übersichten, Kategorien, Startseite).
 *
 * **Das früheste, nicht das jüngste.** Eine Übersicht mit „2027" im Titel
 * behauptet, *alles* auf ihr sei 2027 geprüft. Ist ein Eintrag aufgefrischt und
 * der Rest nicht, stimmt das nur für den einen. Die Übersicht springt deshalb
 * erst, wenn der letzte ihrer Einträge nachgezogen hat.
 */
export function fruehestesJahr(staende: string[]): number {
  if (staende.length === 0) {
    throw new Error('Keine Standangaben — eine leere Übersicht hat kein Jahr.');
  }
  return Math.min(...staende.map(jahrAus));
}

/**
 * Setzt die Jahreszahl in eine Titelvorlage mit dem Platzhalter `{jahr}`.
 *
 * `null` heißt „für diese Seite ist kein Stand belegt": Dann entfällt der
 * Platzhalter samt Leerzeichen davor, und der Titel behauptet kein Jahr.
 * Aus „Was kostet Gas {jahr}? Gaskosten berechnen" wird „Was kostet Gas?
 * Gaskosten berechnen" — ehrlicher als eine geratene Zahl.
 *
 * Einfache geschweifte Klammer und klein geschrieben mit Absicht: Der
 * Deploy-Prüfer `check-placeholders` bricht bei `{{GROSSBUCHSTABEN}}` ab, und
 * die Briefvorlagen benutzen `{{camelCase}}`. `{jahr}` kollidiert mit keinem
 * von beiden.
 */
export function mitJahr(vorlage: string, jahr: number | null): string {
  const ergebnis = jahr === null
    ? vorlage.replace(/ ?\{jahr\}/g, '')
    : vorlage.replace(/\{jahr\}/g, String(jahr));
  if (ergebnis.includes('{jahr}')) {
    throw new Error(`Platzhalter {jahr} nicht aufgelöst in „${vorlage}".`);
  }
  return ergebnis;
}
