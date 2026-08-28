import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Meldet Titel und Descriptions, die in der Trefferliste abgeschnitten werden.
 *
 * Warum das eine Build-Integration ist und keine Notiz: Am 2026-08-28 lagen
 * **60 von 4.497 Titeln** über 65 Zeichen — nicht durch Nachlässigkeit, sondern
 * weil sechzehn Länder und 1.500 Gemeinden sich eine Vorlage teilen und
 * „Hollingstedt (Schleswig-Flensburg)" nun einmal länger ist als „Kiel". Bei
 * einer Seite, deren ganzer Bauplan „eine Vorlage, tausende Seiten" lautet,
 * entsteht so ein Fehler **immer** aus einem Datensatz, nie aus einem Tippfehler
 * — und genau deshalb sieht ihn beim Schreiben niemand. Er zeigt sich erst,
 * wenn jemand alle 4.497 Ergebnisse nachmisst, und das tut niemand zweimal.
 *
 * Deshalb misst es jetzt der Build, bei jedem Lauf, über den ganzen Bestand.
 *
 * **Kein Abbruch, auch nicht unter CI.** Ein zu langer Titel ist ein
 * abgeschnittenes Snippet, keine falsche Zahl und keine Rechtsverletzung — ihn
 * wie einen Platzhalter zu behandeln hieße, einen Deploy an einer Kosmetik
 * scheitern zu lassen und damit rote Builds abzustumpfen. Die Warnung nennt
 * Anzahl und die drei schlimmsten Fälle; das reicht, um sie zu beheben.
 *
 * Wie `check-placeholders.mjs` bewusst je Projekt dupliziert statt aus dem
 * Monorepo geteilt: die öffentlichen Spiegel bauen aus dem Projektordner allein.
 */

/** Google zeigt je nach Pixelbreite ~55–60 Zeichen; 65 ist die übliche Grenze. */
const MAX_TITEL = 65;
/** Descriptions werden bei ~155–160 Zeichen gekappt. */
const MAX_BESCHREIBUNG = 160;

function htmlDateien(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...htmlDateien(p));
    else if (p.endsWith('.html')) out.push(p);
  }
  return out;
}

const entkommen = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

export default function checkMeta() {
  return {
    name: 'check-meta',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const wurzel = fileURLToPath(dir);
        const lang = [];

        for (const datei of htmlDateien(wurzel)) {
          const html = readFileSync(datei, 'utf8');
          const pfad = '/' + relative(wurzel, datei).replace(/index\.html$/, '');
          const titel = html.match(/<title>([\s\S]*?)<\/title>/)?.[1];
          const beschreibung = html.match(/<meta name="description" content="([^"]*)"/)?.[1];

          if (titel) {
            const t = entkommen(titel).trim();
            if (t.length > MAX_TITEL) lang.push({ pfad, art: 'Titel', n: t.length, text: t });
          }
          if (beschreibung) {
            const b = entkommen(beschreibung).trim();
            if (b.length > MAX_BESCHREIBUNG) {
              lang.push({ pfad, art: 'Description', n: b.length, text: b });
            }
          }
        }

        if (lang.length === 0) {
          logger.info(`Titel ≤ ${MAX_TITEL} und Descriptions ≤ ${MAX_BESCHREIBUNG} Zeichen — in Ordnung`);
          return;
        }

        lang.sort((a, b) => b.n - a.n);
        logger.warn(
          `${lang.length} Meta-Angabe(n) über der Grenze (Titel ${MAX_TITEL}, Description ${MAX_BESCHREIBUNG}) — Google schneidet dort ab.`,
        );
        for (const e of lang.slice(0, 3)) {
          logger.warn(`  ${e.art} ${e.n} Zeichen · ${e.pfad}`);
          logger.warn(`    ${e.text.slice(0, 100)}…`);
        }
        if (lang.length > 3) logger.warn(`  … und ${lang.length - 3} weitere.`);
      },
    },
  };
}
