// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import checkPlaceholders from './scripts/check-placeholders.mjs';
import checkUrls from './scripts/check-urls.mjs';
import { TOPICS } from './src/data/topics/index.ts';
import { VERTICALS } from './src/data/verticals.ts';
import checkMeta from './scripts/check-meta.mjs';

// Everything the site renders but tells crawlers not to index, derived from the
// registry itself so the sitemap and the pages' own robots meta cannot drift
// apart. Two cases today:
//   - a topic whose figures are not yet confirmed against a retrieved primary
//     source (it renders so it can be built on, but stays out of the index);
//   - a vertical hub with no topics yet, which would be thin content.
const noindexPaths = [
  ...TOPICS.filter((t) => !t.verified).map((t) => `/was-kostet/${t.slug}/`),
  ...VERTICALS.filter((v) => !TOPICS.some((t) => t.vertical === v.slug)).map(
    (v) => `/kategorie/${v.slug}/`,
  ),
];

// `site` feeds @astrojs/sitemap; canonical and OG tags are built from
// SITE_URL in src/lib/site.ts. **Keep the two in sync** — they are two
// definitions of one fact, and nothing checks them against each other.
export default defineConfig({
  site: 'https://deutschland-kosten.de',
  output: 'static',
  integrations: [
    checkMeta(),
    preact(),
    // Bricht den Build ab, wenn ein Deploy-Platzhalter es ins `dist/` geschafft
    // hat. Cloudflare Pages baut mit `npm run build`, ein roter Build ist also
    // ein Deploy, der nicht stattfindet.
    checkPlaceholders(),
    // Bricht den Build ab, wenn canonical, og:url, ein interner Link oder ein
    // Sitemap-Eintrag auf eine Adresse zeigt, die Pages weiterleitet — die
    // Ursache der Search-Console-Meldung „Page with redirect" vom 2026-08-23.
    checkUrls(),
    // Impressum and Datenschutz will carry `noindex` once they exist (1.7) —
    // keep them out of the sitemap so we never ask Google to crawl what we
    // tell it not to index.
/**
     * Impressum und Datenschutz sind seit 2026-08-28 indexierbar und in der
     * Sitemap. Die frühere Begründung — ein Rechtstext konkurriere um nichts und
     * verdünne nur die indexierte Fläche — war teuer: deutschland-vorlagen wurde
     * von AdSense mit „Low value content" abgelehnt, und der erste Befund der
     * Diagnose lautete, im Index stehe nirgends, wer die Seite betreibt. Googles
     * Mindestanforderungen nennen genau das. Der Fund war portfolioweit: alle
     * sechs Seiten trugen dieselbe Einstellung.
     */
    sitemap({
      filter: (page) =>
        !noindexPaths.some((path) => page.includes(path)),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
