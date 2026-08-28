/**
 * Jede Seite im Browser laden und auf Laufzeitfehler hören.
 *
 * MEMORY.md hält seit baustellen-info fest: *Ein grüner Astro-Build belegt
 * nichts über eine Client-Insel.* Der Build sieht keinen Fehler, der erst beim
 * Hydrieren auftritt — ein Rechner, der beim ersten Klick abstürzt, liefert ein
 * fehlerfreies `dist/`.
 *
 * Dieser Prüfer lädt **jede** gebaute Seite in Chromium und lässt jeden
 * `console.error`, jeden `pageerror` und jede unbehandelte Rejection
 * fehlschlagen. Bewusst schlicht und ohne Projektwissen: Er weiß nicht, was die
 * Insel rechnen soll — dafür gibt es je Projekt einen eigenen Prüfer
 * (`check:zahlen`, `check:fristen`, `check:rechnungen`). Er weiß nur, dass sie
 * nicht kaputtgehen darf, und das gilt überall gleich.
 *
 * Deliberately NOT an Astro integration: braucht Playwright und einen Server
 * ohne SPA-Rewrite. Wie `check-placeholders.mjs` je Projekt dupliziert, weil
 * die Spiegel aus dem Projektordner allein bauen.
 *
 * **Playwright ist bewusst keine Abhängigkeit dieses Projekts** — sein
 * Installationsschritt lädt Browser-Binaries, und Cloudflare Pages installiert
 * devDependencies bei jedem Deploy. Vor dem Lauf einmal
 * `npm i --no-save playwright` (der Browser liegt im gemeinsamen Cache, wenn ihn
 * ein anderes Projekt schon geholt hat), danach wieder entfernen.
 *
 * Aufruf:
 *   npm i --no-save playwright
 *   npm run build
 *   (cd dist && python3 -m http.server 4399) &
 *   npm run check:runtime -- http://127.0.0.1:4399
 */
import { chromium } from 'playwright';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const base = process.argv[2] ?? 'http://127.0.0.1:4399';

function seiten(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...seiten(p));
    else if (p.endsWith('index.html')) out.push(p);
  }
  return out;
}

const pfade = seiten('dist').map((f) => '/' + f.slice('dist'.length + 1).replace(/index\.html$/, ''));

const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const page = await browser.newPage();
const fehler = [];
let aktuell = '';
page.on('console', (m) => {
  if (m.type() === 'error') fehler.push(`${aktuell} — console.error: ${m.text().slice(0, 160)}`);
});
page.on('pageerror', (e) => fehler.push(`${aktuell} — pageerror: ${String(e).slice(0, 160)}`));

for (const p of pfade) {
  aktuell = p;
  await page.goto(base + p, { waitUntil: 'domcontentloaded' });
  // Kurz warten, damit die Insel hydrieren und ggf. scheitern kann.
  await page.waitForTimeout(350);
}
await browser.close();

console.log(`${pfade.length} Seiten im Browser geladen`);
if (fehler.length) {
  console.error(`\n${fehler.length} Laufzeitfehler:`);
  for (const f of fehler.slice(0, 20)) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log('Keine Konsolenfehler, keine unbehandelten Ausnahmen.');
