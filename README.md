# Deutschlandkosten

Quellcode von [deutschland-kosten.de](https://deutschland-kosten.de) —
interaktive Kostenrechner für Behördengänge, Recht, Medizin und Wohnen:
Optionen wählen, Spanne von niedrig bis hoch sehen, zu jeder Zahl die Quelle.

## Warum der Code offen liegt

Die Seite verspricht auf jeder Zeile dasselbe: **jede Zahl mit Quelle und
Stand-Datum.** Das ist genau die Art Versprechen, die man nicht glauben muss,
wenn man sie nachlesen kann. Konkret nachprüfbar:

- **Die Rohdaten liegen mit im Repo**, nicht nur die Ergebnisse. Unter
  `src/data/sources/` steht je Thema, aus welcher Norm welche Zahl stammt, wann
  sie gelesen wurde und was dabei aufgefallen ist — samt der Stellen, an denen
  eine frühere Erhebung danebenlag.
- **Wo eine Formel eine Tabelle ersetzt, wird die Übereinstimmung geprüft, nicht
  behauptet.** `npm run check` rechnet die Gebührenstaffeln gegen **268**
  veröffentlichte Werte aus GNotKG, FamGKG und RVG und die Energiepreise gegen
  **40** Werte der amtlichen Statistik. Weicht ein Wert ab, schlägt der Build
  fehl.
- **Eine Zahl ohne gelesene Primärquelle kommt nicht in den Index.** Ein Thema
  trägt `verified: false`, solange niemand die Vorschrift im Volltext geprüft
  hat; die Route setzt dann `noindex` und die Sitemap lässt sie weg
  (`astro.config.mjs`).
- **Ein Abrufdatum ist eine Behauptung über eine Handlung.** Steht bei einer
  Quelle kein „abgerufen am", sagt die Seite das ausdrücklich statt ein Datum
  zu erfinden (`src/data/topics/types.ts`).
- Kein Backend, keine Datenbank, kein Analytics. Die Rechner laufen vollständig
  im Browser; Schriften liegen im eigenen Bundle statt bei einem CDN.

## Was der Code nicht ist

Keine Rechts- und keine Steuerberatung. Die Rechner geben Orientierungswerte
auf Grundlage der genannten Vorschriften; was im Einzelfall gilt, entscheidet
die zuständige Stelle.

## Fehler gefunden?

Ein falscher Betrag, eine veraltete Fassung, eine Gebühr, die Ihre Rechnung
anders ausweist: bitte melden — formlos an kontakt@deutschland-kosten.de.
Hilfreich sind die Position, der Betrag und wer ihn festgesetzt hat.

## Lokal bauen

```bash
npm install
npm run check   # astro check + beide Datenprüfungen
npm run build
```

## Lizenz

MIT (siehe `LICENSE`). Die zitierten Rechtsvorschriften und amtlichen
Statistiken unterliegen ihren eigenen Bedingungen; Normtexte stammen von
[gesetze-im-internet.de](https://www.gesetze-im-internet.de), Preisdaten vom
[Statistischen Bundesamt](https://www-genesis.destatis.de).
