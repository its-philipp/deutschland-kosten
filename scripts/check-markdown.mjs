/**
 * Markdown-Syntax, die im gerenderten Text stehen bleibt.
 *
 * Entstanden am 2026-08-28 aus einem eigenen Fehler: Ich habe `**bei der
 * Behörde eingegangen**` in einen `deadline`-Text geschrieben, weil die
 * Auszeichnung in der Quelldatei richtig aussah. Die Erklärtexte werden aber
 * als Klartext ausgegeben, nicht als Markdown — auf der Seite standen die
 * Sternchen wörtlich. Kein bestehender Prüfer sah das: `check` prüft Typen,
 * `check:guides` Belege, `check:samples` das Rendern, `check-seo` Meta-Daten.
 * Formatierung, die sich in Text verwandelt, fiel durch jede Masche.
 *
 * Der Prüfer liest **das gebaute HTML**, nicht die Konfigurationen — genau
 * dort entscheidet sich, ob aus `**` Fettschrift oder ein Sternchen wird. Er
 * ruft dafür keinen Seitencode auf; eine Prüfung, die den Renderer benutzt,
 * könnte dessen Denkfehler nicht finden.
 *
 * Skript- und Style-Blöcke fliegen vorher heraus: Dort sind Sternchen
 * Multiplikation und Klammerpaare Syntax, keine verunglückte Auszeichnung.
 *
 * **Kein `__…__`.** Die erste Fassung prüfte auch die Unterstrich-Variante der
 * Fettschrift und meldete daraufhin 56 Treffer — allesamt falsch. Die
 * Musterbriefe setzen Leerstellen zum Ausfüllen als Unterstrichfolgen, und
 * zwischen zwei solchen Folgen steht regelmäßig Text („____ vom ____"). Das
 * Muster ist hier also nicht unterscheidbar von der Absicht der Seite und
 * fliegt raus; die Sternchen-Variante bleibt, weil kein Brief sie benutzt.
 * Gemessen am 2026-08-28: 58 Treffer, davon 56 aus diesem einen Muster.
 *
 * Aufruf:  npm run build && npm run check:markdown
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function seiten(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...seiten(p));
    else if (p.endsWith('index.html')) out.push(p);
  }
  return out;
}

const muster = [
  { name: 'Fettschrift **…**', re: /\*\*[^*\n]{1,120}\*\*/g },
  { name: 'Link [text](url)', re: /\[[^\]\n]{1,80}\]\((?:https?:|\/)[^)\s]{1,120}\)/g },
  { name: 'Code `…`', re: /`[^`\n]{1,80}`/g },
];

const dateien = seiten('dist');
if (dateien.length === 0) {
  console.error('check:markdown: dist/ enthält keine Seite. Erst `npm run build`.');
  process.exit(1);
}

const funde = [];
for (const datei of dateien) {
  const roh = readFileSync(datei, 'utf8');
  const ohneCode = roh
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const text = ohneCode.replace(/<[^>]+>/g, ' ');
  const route = '/' + datei.slice('dist'.length + 1).replace(/index\.html$/, '');
  for (const { name, re } of muster) {
    for (const treffer of text.match(re) ?? []) {
      funde.push(`${route} — ${name}: ${treffer.trim().slice(0, 90)}`);
    }
  }
}

console.log(`\n${dateien.length} gebaute Seiten auf sichtbare Markdown-Syntax gelesen`);
if (funde.length === 0) {
  console.log('Keine Auszeichnung, die als Zeichen auf der Seite landet.\n');
  process.exit(0);
}
console.log(`\n${funde.length} Stelle(n), an denen Markdown als Text erscheint:`);
for (const f of funde) console.log('  ✗ ' + f);
console.log();
process.exit(1);
