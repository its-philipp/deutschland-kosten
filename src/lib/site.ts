// Site-wide constants. Keep SITE_URL in sync with `site` in astro.config.mjs
// (the sitemap integration reads it from there, canonical/OG tags from here).
export const SITE_URL = 'https://deutschland-kosten.de';
/**
 * One word, not two (Owner-Entscheidung 2026-08-16).
 *
 * "Deutschland kosten" read as a verb phrase — in the browser tab, where there
 * is no yellow ground and no typography to hold it together, it stopped looking
 * like a name at all. The Wortmarke on the homepage now sets `kosten` flush
 * against `Deutschland` on the Signalgelb ground (`.wortmarke` in global.css),
 * so the mark and this string say the same thing.
 */
export const SITE_NAME = 'Deutschlandkosten';

/**
 * Impressum/Datenschutz identity. Filled 2026-08-16, when the site went live on
 * deutschland-kosten.de — until then these were `{{…}}` placeholders that the
 * pre-deploy grep was meant to catch, and they reached production anyway.
 *
 * They live here rather than inline in the pages for two reasons: a literal
 * `{{` in Astro markup is a parse error, and one definition means the Impressum
 * and the Datenschutzerklärung cannot end up naming different people.
 *
 * Same identity as deutschland-vorlagen.de — private address, no
 * Impressumsservice (owner's decision 2026-08-01). That the two sites share an
 * Impressum is unavoidable and known: § 5 DDG wants the actual person.
 */
export const CONTACT_EMAIL = 'kontakt@deutschland-kosten.de';
export const IMPRESSUM_NAME = 'Philipp Trinh';
export const IMPRESSUM_ADDRESS = 'Döscherstraße 3, 22083 Hamburg';
/** Reads inside "Diese Website wird bei … gehostet", so it carries its own brackets. */
export const IMPRESSUM_HOSTER =
  'Cloudflare (Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107, USA)';

/**
 * Public mirror of this site's code (owner's decision 2026-08-16). Published
 * from the private monorepo by `scripts/publish-mirror.sh` behind an allowlist.
 *
 * The site links here for the same reason deutschland-vorlagen does — because
 * the claim the whole product rests on should be checkable. There it is "nothing
 * leaves your browser"; here it is "jede Zahl mit Quelle", and a reader who
 * wants to verify that can now read the fee tables and the check scripts that
 * prove them against the published values.
 */
export const GITHUB_REPO = 'https://github.com/its-philipp/deutschland-kosten';

export const CURRENT_YEAR = 2026;

/** Absolute URL for canonical/OG tags. `path` must start with '/'. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path}`;
}
