import type { APIRoute } from 'astro';
import roh from '../data/sources/notar-grundbuch.json';

/**
 * GNotKG Anlage 2 — die Gebührentabelle als CSV.
 *
 * **Warum gerade diese Tabelle.** Nach dem Muster der vdek-Ländertabelle auf
 * deutschland-pflegegeld wurde am 2026-09-12 geprüft, welche Datensätze des
 * Portfolios bei ihrer Quelle schlecht maschinenlesbar vorliegen. Die meisten
 * fallen durch: Die Hebesätze kommen aus der Genesis-API, die SGB-Beträge aus
 * dem Gesamt-XML von gesetze-im-internet.de — dort ist eine eigene Fassung kein
 * Gewinn. **Anlage 2 ist die Ausnahme**, und der Datensatz sagt selbst warum:
 * Sie musste „aus der XML-Tabellenstruktur geparst" werden, *nicht* aus dem
 * Fließtext, weil dort „die Tausender-Leerzeichen nicht von Spaltengrenzen zu
 * unterscheiden" sind. Wer die Tabelle braucht, kann sie nicht einfach
 * herunterladen — er tippt sie ab oder schreibt einen Parser.
 *
 * Das ist der Unterschied zwischen einer Seite, die man liest, und einer
 * Quelle, die man weitergibt. „notarkosten hauskauf" trägt 6.600 Abfragen im
 * Monat; die Leute, die dafür Rechner und Ratgeber bauen, brauchen genau diese
 * 92 Zeilen.
 *
 * **Die Werte sind die des Gesetzes, nicht die eigene Rechnung.** Das Projekt
 * *kann* die Gebühr aus der Stufenregel des § 34 Abs. 2 GNotKG berechnen
 * (`lib/gebuehrentabellen.ts`, gegen alle 92 Werte geprüft, null Abweichungen)
 * — aber eine Datei, die „GNotKG Anlage 2" heißt, muss wiedergeben, was im
 * Bundesgesetzblatt steht, und nicht, was eine Funktion daraus ableitet. Beide
 * stimmen überein; wenn sie es einmal nicht täten, wäre die veröffentlichte
 * Zahl die richtige.
 *
 * Formatentscheidungen wie bei der vdek-Tabelle und aus demselben Grund — eine
 * CSV wandert weiter und taucht ohne ihren Kontext wieder auf: Quellenangabe
 * als `#`-Zeilen **in** der Datei, Semikolon und BOM für Excel auf deutschem
 * Windows, Zahlen ohne Tausenderpunkt und Währungszeichen.
 */

interface Zeile {
  geschaeftswert_bis: number;
  tabelle_a: number;
  tabelle_b: number;
}

interface Quelle {
  label: string;
  url: string;
  retrieved: string;
}

const meta = roh._meta as {
  norm: string;
  norm_stand: string;
  anlage_2_fundstelle: string;
  retrieved: string;
  sources: Quelle[];
};

const tabelle = roh.tabelle_anlage_2 as Zeile[];

export function csv(): string {
  const anlage = meta.sources.find((s) => s.label.includes('Anlage 2'));

  const kopf = [
    `# ${meta.norm} — Anlage 2 (zu § 34 Abs. 3): Tabelle A und Tabelle B`,
    `# Fassung: ${meta.norm_stand}`,
    `# Fundstelle der Anlage: ${meta.anlage_2_fundstelle}`,
    `# Quelle: ${anlage?.url ?? 'https://www.gesetze-im-internet.de/gnotkg/anlage_2.html'}`,
    `# Abgerufen: ${meta.retrieved}`,
    '# Alle Betraege in Euro. "Geschaeftswert bis" ist die Obergrenze der Wertstufe',
    '# einschliesslich; fuer hoehere Werte gilt die Fortschreibungsregel des',
    '# § 34 Abs. 2 GNotKG, die Anlage 2 endet bei 3.000.000 Euro.',
    '# Geprueft: 91 Stufenuebergaenge, in jeder der sieben Wertstufen ein',
    '# konstanter Gebuehrenzuwachs, keine Ausnahme.',
    '# Massgeblich ist das Bundesgesetzblatt. Aufbereitung: deutschland-kosten.de',
  ];

  const spalten = ['Geschaeftswert bis', 'Tabelle A', 'Tabelle B'];
  const zeilen = tabelle.map((z) =>
    [z.geschaeftswert_bis, z.tabelle_a, z.tabelle_b].join(';'),
  );

  return [...kopf, spalten.join(';'), ...zeilen].join('\n') + '\n';
}

export const GET: APIRoute = () =>
  new Response('﻿' + csv(), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'inline; filename="gnotkg-anlage-2.csv"',
    },
  });
