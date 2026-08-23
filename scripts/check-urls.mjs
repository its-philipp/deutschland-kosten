import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Bricht den Build ab, wenn die Seite eine eigene Adresse nennt, die beim
 * Aufruf **weiterleitet** statt zu antworten.
 *
 * Warum das eine eigene Prüfung verdient: Am 2026-08-23 meldete die Google
 * Search Console den Indexierungsgrund „Page with redirect" (WNC-20237597).
 * Die Sitemap war sauber, jede darin genannte Adresse antwortete mit 200, und
 * kein interner Link war schief. Die Quelle war ein einziges Attribut: Die
 * 404-Seite trug `<link rel="canonical" href=".../404/">`, während Cloudflare
 * Pages sie aus `dist/404.html` unter `/404` ausliefert. **Jede** unbekannte
 * URL wies Google damit auf eine Adresse, die mit 308 weiterleitet, und Google
 * folgt einem canonical als Fundstelle. Ein falsches Zeichen in einem Attribut,
 * multipliziert mit jeder Fehlseite, die ein Crawler probiert.
 *
 * Von Hand ist so etwas nicht zu finden, weil es lokal nicht auffällt: `astro
 * dev` liefert `/404/` und `/404` gleichermaßen aus. Sichtbar wird es erst an
 * dem Verhalten, das der Hoster zeigt — also prüft diese Datei genau das, an
 * `dist/`, mit den Regeln, nach denen Cloudflare Pages statische Dateien
 * ausliefert:
 *
 * - `/` → `index.html`
 * - `/x/` → `x/index.html`; gibt es stattdessen `x.html`, leitet Pages auf `/x`
 * - `/x` → `x.html`; gibt es stattdessen `x/index.html`, leitet Pages auf `/x/`
 * - `/x/index.html` → Pages leitet immer auf `/x/`
 *
 * Geprüft wird alles, womit die Seite eine Adresse *behauptet*: `canonical`,
 * `og:url`, interne `href`s und jeder `<loc>` in der Sitemap. Fremde Hosts,
 * `mailto:`, `tel:` und reine Fragmente bleiben außen vor.
 *
 * Anders als die Platzhalter-Sperre gilt diese Prüfung **immer**, nicht nur
 * unter `CI`: Eine Adresse, die weiterleitet, ist kein Zustand vor dem Launch,
 * sondern ein Fehler in der ausgelieferten Datei.
 *
 * Wie `check-placeholders.mjs` bewusst je Projekt dupliziert statt geteilt —
 * der öffentliche Spiegel baut aus einem Klon des Projektordners allein.
 */

/** Adressen, die kein Ziel im Build haben können und keins haben sollen. */
const KEIN_ZIEL = /^(mailto:|tel:|javascript:|data:|#)/i;

function* dateien(verzeichnis) {
  for (const eintrag of readdirSync(verzeichnis)) {
    const pfad = join(verzeichnis, eintrag);
    if (statSync(pfad).isDirectory()) yield* dateien(pfad);
    else yield pfad;
  }
}

/**
 * Wie Cloudflare Pages auf diesen Pfad antworten wird: `'ok'`, `'weiterleitung'`
 * (mit dem Ziel) oder `'fehlt'`.
 */
function auslieferung(wurzel, pfad) {
  const rein = pfad.replace(/\/{2,}/g, '/');

  if (rein.endsWith('/index.html')) {
    return { art: 'weiterleitung', ziel: rein.slice(0, -'index.html'.length) };
  }
  if (rein === '/index.html') return { art: 'weiterleitung', ziel: '/' };

  const alsDatei = (relativ) => existsSync(join(wurzel, relativ));
  const segmente = rein.replace(/^\//, '');

  if (rein.endsWith('/')) {
    if (alsDatei(join(segmente, 'index.html'))) return { art: 'ok' };
    // `/x/` bei vorhandener `x.html`: Pages liefert die Datei unter `/x` aus.
    const ohneSlash = segmente.slice(0, -1);
    if (ohneSlash && alsDatei(`${ohneSlash}.html`)) {
      return { art: 'weiterleitung', ziel: `/${ohneSlash}` };
    }
    return { art: 'fehlt' };
  }

  if (alsDatei(segmente)) return { art: 'ok' };
  if (alsDatei(`${segmente}.html`)) return { art: 'ok' };
  if (alsDatei(join(segmente, 'index.html'))) {
    return { art: 'weiterleitung', ziel: `${rein}/` };
  }
  return { art: 'fehlt' };
}

/** Jede Adresse, die diese Datei über sich selbst oder über andere behauptet. */
function adressen(inhalt, istSitemap) {
  const gefunden = [];
  const nimm = (regex, quelle) => {
    for (const treffer of inhalt.matchAll(regex)) gefunden.push({ url: treffer[1], quelle });
  };

  if (istSitemap) {
    nimm(/<loc>([^<]+)<\/loc>/g, 'Sitemap <loc>');
    return gefunden;
  }

  nimm(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/g, 'canonical');
  nimm(/<meta[^>]+property="og:url"[^>]+content="([^"]+)"/g, 'og:url');
  nimm(/<a[^>]+href="([^"]+)"/g, 'Link');
  return gefunden;
}

export default function checkUrls() {
  let site;

  return {
    name: 'check-urls',
    hooks: {
      'astro:config:done': ({ config }) => {
        site = config.site;
      },
      'astro:build:done': ({ dir, logger }) => {
        if (!site) {
          logger.warn('kein `site` konfiguriert — Adressprüfung übersprungen');
          return;
        }
        const wurzel = fileURLToPath(dir);
        const basis = new URL(site);
        const funde = [];
        let geprueft = 0;

        for (const datei of dateien(wurzel)) {
          const istSitemap = datei.endsWith('.xml');
          if (!datei.endsWith('.html') && !istSitemap) continue;

          const inhalt = readFileSync(datei, 'utf8');
          for (const { url, quelle } of adressen(inhalt, istSitemap)) {
            if (KEIN_ZIEL.test(url)) continue;

            let ziel;
            try {
              ziel = new URL(url, basis);
            } catch {
              continue; // Keine auflösbare Adresse — nicht Sache dieser Prüfung.
            }
            // Fremde Hosts gehören uns nicht. `www` ist hier *nicht* fremd: Die
            // Weiterleitung auf die nackte Domain ist gewollt (astro.config),
            // aber eine eigene Seite darf trotzdem nicht darauf zeigen.
            if (ziel.protocol !== basis.protocol || ziel.host !== basis.host) {
              if (ziel.host === `www.${basis.host}` || `www.${ziel.host}` === basis.host) {
                funde.push(
                  `  ${relative(wurzel, datei)} → ${quelle}: ${url}\n` +
                    `      zeigt auf die nicht-kanonische Schreibweise des Hosts (Weiterleitung).`,
                );
              }
              continue;
            }

            geprueft += 1;
            const ergebnis = auslieferung(wurzel, ziel.pathname);
            if (ergebnis.art === 'weiterleitung') {
              funde.push(
                `  ${relative(wurzel, datei)} → ${quelle}: ${ziel.pathname}\n` +
                  `      Pages leitet auf ${ergebnis.ziel} weiter (308).`,
              );
            } else if (ergebnis.art === 'fehlt') {
              funde.push(
                `  ${relative(wurzel, datei)} → ${quelle}: ${ziel.pathname}\n` +
                  `      keine Datei im Build — antwortet mit 404.`,
              );
            }
          }
        }

        if (!funde.length) {
          logger.info(`${geprueft} interne Adressen geprüft, keine Weiterleitung`);
          return;
        }

        // Alle auf einmal, nicht nur die erste: sie treten in Gruppen auf, und
        // sie einzeln je Build zu finden ist seine eigene Art von langsam.
        const einmalig = [...new Set(funde)];
        throw new Error(
          `Interne Adressen, die weiterleiten oder ins Leere führen — ` +
            `die Search Console meldet so etwas als „Page with redirect".\n` +
            `${einmalig.length} Stelle(n):\n${einmalig.join('\n')}\n\n` +
            `Regel: Seitenadressen enden auf „/“, Dateiadressen auf ihre Endung. ` +
            `Eine Seite ohne eigene Adresse (404) bekommt „path={null}“ statt eines canonical.`,
        );
      },
    },
  };
}
