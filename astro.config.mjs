// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import checkPlaceholders from './scripts/check-placeholders.mjs';
import { TOPICS } from './src/data/topics/index.ts';
import { VERTICALS } from './src/data/verticals.ts';

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
    preact(),
    // Bricht den Build ab, wenn ein Deploy-Platzhalter es ins `dist/` geschafft
    // hat. Cloudflare Pages baut mit `npm run build`, ein roter Build ist also
    // ein Deploy, der nicht stattfindet.
    checkPlaceholders(),
    // Impressum and Datenschutz will carry `noindex` once they exist (1.7) —
    // keep them out of the sitemap so we never ask Google to crawl what we
    // tell it not to index.
    sitemap({
      filter: (page) =>
        !page.includes('/impressum/') &&
        !page.includes('/datenschutz/') &&
        !noindexPaths.some((path) => page.includes(path)),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
