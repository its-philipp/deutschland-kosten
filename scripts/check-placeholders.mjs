import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Fails the build when a `{{PLATZHALTER}}` reached the output.
 *
 * Why this exists: on 2026-08-16 this site went live with `{{DOMAIN}}` in every
 * canonical tag, every `og:url` and every sitemap entry, and with
 * `{{IMPRESSUM_NAME}}` and `{{IMPRESSUM_ADDRESS}}` standing publicly on the
 * Impressum. The portfolio rule that was supposed to prevent it — "before any
 * deploy, grep the project for `{{`, zero hits required" — had been written down
 * for a year. It failed the first time it mattered, because **it was an
 * instruction to a person, and a person has to remember it at exactly the wrong
 * moment: the one where they are excited that the domain finally resolves.**
 *
 * A rule that only holds when someone remembers it is not a rule, it is a wish.
 * So it moved into the build. `astro build` now refuses to finish, which means
 * the deploy provider's build refuses too — Cloudflare Pages runs `npm run
 * build`, so a red build is a deploy that never happens. That is the whole
 * point: the check has to sit *before* the artefact exists, not beside it.
 *
 * Deliberately duplicated in each project instead of shared from the monorepo
 * root: two of these sites publish a mirror that has to build from a clone of
 * the project folder alone. A shared import would make the public copy
 * unbuildable, and the mirror exists precisely so it can be built.
 */

/**
 * **Nur GROSSBUCHSTABEN.** Das ist keine Kosmetik, sondern die einzige
 * Unterscheidung, die es gibt: `deutschland-vorlagen` benutzt `{{…}}` als
 * eigene Ersetzungssyntax im Brieftext (`{{kundennummer}}`, `{{absenderName}}`)
 * und liefert sie absichtlich ins HTML aus. Ein Muster über alle Schreibweisen
 * hätte den Build der **live laufenden** Seite abgebrochen — beim ersten Lauf
 * genau so passiert.
 *
 * Die Konvention aus der Root-`CLAUDE.md` trägt das: Deploy-Platzhalter heißen
 * `{{DOMAIN}}` und `{{IMPRESSUM_*}}`, Vorlagen-Felder camelCase.
 */
const PLATZHALTER = /\{\{[A-Z][A-Z0-9_]*\}\}/g;

/** Text formats a placeholder can survive into. Binaries cannot carry one. */
const TEXTDATEI = /\.(html|xml|txt|json|css|js|mjs|svg|webmanifest)$/i;

function* dateien(verzeichnis) {
  for (const eintrag of readdirSync(verzeichnis)) {
    const pfad = join(verzeichnis, eintrag);
    if (statSync(pfad).isDirectory()) yield* dateien(pfad);
    else yield pfad;
  }
}

export default function checkPlaceholders() {
  return {
    name: 'check-placeholders',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const wurzel = fileURLToPath(dir);
        const funde = [];

        for (const datei of dateien(wurzel)) {
          if (!TEXTDATEI.test(datei)) continue;
          const treffer = readFileSync(datei, 'utf8').match(PLATZHALTER);
          if (treffer) {
            funde.push(`  ${relative(wurzel, datei)} → ${[...new Set(treffer)].join(', ')}`);
          }
        }

        if (!funde.length) {
          logger.info('keine Platzhalter im Build');
          return;
        }

        // Every file, not just the first: they always come in groups, and
        // fixing them one build at a time is its own kind of slow.
        const meldung =
          `Platzhalter im fertigen Build — dieser Stand darf nicht deployt werden.\n` +
          `${funde.length} Datei(en):\n${funde.join('\n')}\n\n` +
          `Die echten Werte gehören in src/lib/site.ts und astro.config.mjs ` +
          `(root CLAUDE.md → Placeholders).`;

        /**
         * Lokal eine Warnung, im Deploy ein Abbruch.
         *
         * Ein Projekt vor dem Launch *soll* Platzhalter tragen — das ist der
         * ausdrückliche Portfolio-Beschluss ("launch blockers, not build
         * blockers"). Würde der Build daran immer scheitern, könnte an den vier
         * unveröffentlichten Seiten niemand mehr arbeiten, und ein dauerhaft
         * roter Build bringt einem bei, rote Builds zu übersehen.
         *
         * `CI` setzen sowohl Cloudflare Pages als auch GitHub Actions. Damit
         * gilt die Regel genau dort, wo aus einem Build eine ausgelieferte
         * Seite wird — **und sie greift von selbst**: sobald jemand ein Projekt
         * an Pages hängt, scheitert dessen Build, bis die echten Werte da sind.
         * Niemand muss daran denken, hier etwas umzustellen.
         *
         * Lokal nachstellen: `CI=1 npm run build`.
         */
        if (process.env.CI) throw new Error(meldung);
        logger.warn(meldung);
        logger.warn('Lokaler Build — im Deploy (CI=1) wäre das ein Abbruch.');
      },
    },
  };
}
