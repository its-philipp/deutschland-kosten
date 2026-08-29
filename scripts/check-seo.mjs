import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Der Technik-Audit, bei jedem Build, über den ganzen Bestand.
 *
 * Er ersetzt `check-meta.mjs` und kann mehr: Titel- und Description-Längen
 * waren nur der eine Fund vom 2026-08-28, gefunden mit einem Wegwerf-Skript
 * über das gebaute `dist/`. Ein Wegwerf-Skript findet einen Fehler genau
 * einmal — beim nächsten Mal muss sich jemand erinnern, dass es das gab. Genau
 * die Sorte Regel, die dieses Repo schon einmal teuer bezahlt hat
 * (`check-placeholders.mjs` erklärt es).
 *
 * Geprüft wird, was sich am fertigen HTML feststellen lässt und was still
 * kaputtgeht:
 *   - Titel eindeutig und ≤ 65 Zeichen, Description eindeutig und ≤ 160
 *   - genau ein `<h1>` je Seite
 *   - Canonical vorhanden und auf die eigene Adresse zeigend
 *   - JSON-LD parsebar
 *   - keine Überschriftensprünge (h2 → h4)
 *   - keine fremd geladene Ressource (Skript, Stylesheet, Bild, CSS-`url()`)
 *   - **Sackgassen und Waisen im internen Linkgraphen** (s. u.)
 *   - **veraltete Jahreszahl im Titel**, wenn `jahrImTitel` gesetzt ist (s. u.)
 *
 * **Der Linkgraph**, dazugekommen am 2026-08-28. Gezählt werden nur Links aus
 * dem `<main>`: Navigation und Fußzeile stehen auf jeder Seite und würden jede
 * Seite als verlinkt ausweisen. Eine *Sackgasse* führt nirgendwohin, eine
 * *Waise* wird von nirgends verlinkt und hängt damit allein an der Sitemap.
 *
 * Der Anlass war kein theoretischer: An diesem Tag waren neun von neunzehn
 * Seiten auf deutschland-kosten Sackgassen, und auf deutschland-zuschuss lagen
 * zwei fertige Inhaltsseiten, die von keiner einzigen Seite aus verlinkt waren.
 * Beides fällt niemandem auf, weil jede Seite für sich richtig aussieht.
 *

 * **Die Jahreszahl im Titel** (`jahrImTitel: true`, dazugekommen am
 * 2026-08-29). Die Root-`CLAUDE.md` verlangt das Jahr im Titel und eine
 * jährliche Auffrischung. Gemessen an diesem Tag: 110 Titel im Portfolio
 * tragen „2026", **kein einziges Projekt leitet die Zahl ab** — sie steht in
 * Datendateien und `.astro`-Seiten fest. Am 1. Januar werden sie alle
 * gleichzeitig falsch, und niemand merkt es, weil jede Seite für sich richtig
 * aussieht.
 *
 * Das ist genau die Regel, an der dieses Repo schon einmal gescheitert ist:
 * „vor dem Deploy nach `{{` greppen" war eine Anweisung an einen Menschen, und
 * am 2026-08-16 ging deutschland-kosten mit Platzhaltern live. Seither gibt es
 * `check-placeholders`. Eine Regel, die nur gilt, wenn sich jemand erinnert,
 * ist ein Wunsch — deshalb steht sie jetzt auch hier.
 *
 * **gemeindegebuehren schaltet das bewusst NICHT ein.** Dort ist die
 * Jahreszahl im Titel der Stichtag des Werts (2024 oder 2025, je Gemeinde) und
 * damit richtig, gerade weil sie nicht dem laufenden Jahr entspricht. Eine
 * Prüfung auf „aktuelles Jahr" würde dort 4.491 Fehlalarme erzeugen.
 *
 * Fußzeilenseiten (`impressum`, `datenschutz`, `kontakt`, `ueber-uns`) sind
 * ausgenommen: Sie werden absichtlich aus der Fußzeile erreicht und führen
 * absichtlich nicht weiter.
 *
 * **Warnt, bricht nie ab — auch nicht unter CI.** Ein abgeschnittenes Snippet
 * oder ein Überschriftensprung ist keine falsche Zahl und keine
 * Rechtsverletzung. Rote Builds bleiben Platzhaltern und falschen Daten
 * vorbehalten; wer sie für Kosmetik ausgibt, bringt sich bei, rote Builds zu
 * übersehen.
 *
 * `noindex`-Seiten werden übersprungen: Sie sollen gar nicht in den Index, und
 * eine interne Vorlage ohne `<h1>` ist kein Fehler.
 *
 * Wie `check-placeholders.mjs` je Projekt dupliziert statt aus dem Monorepo
 * geteilt — die öffentlichen Spiegel bauen aus dem Projektordner allein.
 */

const MAX_TITEL = 65;
const MAX_BESCHREIBUNG = 160;

function dateien(dir, endung) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...dateien(p, endung));
    else if (endung.some((e) => p.endsWith(e))) out.push(p);
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

/**
 * `erlaubteHosts`: Fremdhosts, die bewusst geladen werden. Ohne diese Liste
 * meldet der Prüfer bei jedem Build dasselbe gewollte Skript — und eine
 * Warnung, die immer erscheint und immer richtig ist, bringt man sich bei zu
 * übersehen. Wer hier etwas einträgt, entscheidet damit ausdrücklich, dass
 * dieser Host geladen werden soll.
 */
export default function checkSeo({ domain, erlaubteHosts = [], jahrImTitel = false } = {}) {
  return {
    name: 'check-seo',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const wurzel = fileURLToPath(dir);
        const befunde = [];
        const melde = (art, pfad, detail) => befunde.push({ art, pfad, detail });

        /* Interner Linkgraph: Ziel → Zahl der eingehenden Inhaltslinks. */
        const graph = new Map();
        const eingehend = new Map();
        const FUSSZEILE = /^\/(impressum|datenschutz|kontakt|ueber-uns)\/$/;

        const titel = new Map();
        const beschreibungen = new Map();
        let geprueft = 0;

        for (const datei of dateien(wurzel, ['.html'])) {
          const html = readFileSync(datei, 'utf8');
          if (/<meta[^>]+name="robots"[^>]+noindex/.test(html)) continue;
          geprueft++;
          const pfad = '/' + relative(wurzel, datei).replace(/index\.html$/, '');

          const t = html.match(/<title>([\s\S]*?)<\/title>/)?.[1];
          if (!t) melde('kein <title>', pfad);
          else {
            const s = entkommen(t).trim();
            if (s.length > MAX_TITEL) melde(`Titel ${s.length} Zeichen`, pfad, s);
            if (jahrImTitel) {
              const jahre = [...s.matchAll(/\b(20\d\d)\b/g)].map((m) => m[1]);
              const jetzt = String(new Date().getFullYear());
              for (const j of jahre) {
                if (j !== jetzt) melde(`Jahr ${j} im Titel, laufendes Jahr ist ${jetzt}`, pfad, s);
              }
            }
            titel.set(s, [...(titel.get(s) ?? []), pfad]);
          }

          const b = html.match(/<meta name="description" content="([^"]*)"/)?.[1];
          if (!b) melde('keine description', pfad);
          else {
            const s = entkommen(b).trim();
            if (s.length > MAX_BESCHREIBUNG) melde(`Description ${s.length} Zeichen`, pfad, s);
            beschreibungen.set(s, [...(beschreibungen.get(s) ?? []), pfad]);
          }

          const h1 = html.match(/<h1[^>]*>/g)?.length ?? 0;
          if (h1 !== 1) melde(`${h1} <h1>`, pfad);

          const can = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
          if (!can) melde('kein canonical', pfad);
          else if (domain && can.replace(/\/$/, '') + '/' !== `https://${domain}${pfad}`) {
            melde('canonical zeigt woandershin', pfad, can);
          }

          const inhaltsblock = html.match(/<main[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? '';
          const ziele = new Set(
            [...inhaltsblock.matchAll(/href="(\/[^"#?]*)"/g)].map((m) => m[1]).filter((z) => z !== pfad),
          );
          graph.set(pfad, ziele);
          for (const z of ziele) eingehend.set(z, (eingehend.get(z) ?? 0) + 1);

          let vorher = 0;
          for (const m of html.matchAll(/<h([1-6])[^>]*>/g)) {
            const stufe = Number(m[1]);
            if (vorher && stufe > vorher + 1) {
              melde(`Überschriftensprung h${vorher} → h${stufe}`, pfad);
              break;
            }
            vorher = stufe;
          }

          for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
            try {
              JSON.parse(m[1]);
            } catch {
              melde('JSON-LD nicht parsebar', pfad);
            }
          }
        }

        for (const [t, pfade] of titel) if (pfade.length > 1) melde(`Titel ${pfade.length}× doppelt`, pfade[0], t);
        for (const [b, pfade] of beschreibungen) {
          if (pfade.length > 1) melde(`Description ${pfade.length}× doppelt`, pfade[0], b);
        }

        const fremd = new Set();
        for (const datei of dateien(wurzel, ['.html', '.css', '.js'])) {
          const inhalt = readFileSync(datei, 'utf8');
          const muster = [
            /<script[^>]+src="(https?:\/\/[^"]+)"/g,
            /<link[^>]+href="(https?:\/\/[^"]+)"[^>]*rel="stylesheet"/g,
            /<img[^>]+src="(https?:\/\/[^"]+)"/g,
            /url\((https?:\/\/[^)]+)\)/g,
          ];
          for (const m of muster) {
            for (const treffer of inhalt.matchAll(m)) {
              const url = treffer[1];
              if (domain && url.includes(domain)) continue;
              if (erlaubteHosts.some((h) => url.includes(h))) continue;
              fremd.add(url);
            }
          }
        }
        for (const u of fremd) melde('fremd geladene Ressource', '—', u);

        for (const [pfad, ziele] of graph) {
          if (FUSSZEILE.test(pfad)) continue;
          if (ziele.size === 0) melde('Sackgasse (kein Link aus dem Inhalt)', pfad);
          if ((eingehend.get(pfad) ?? 0) === 0) melde('Waise (kein Link aus dem Inhalt darauf)', pfad);
        }

        if (befunde.length === 0) {
          logger.info(`${geprueft} indexierbare Seiten geprüft — ohne Befund`);
          return;
        }
        logger.warn(`${befunde.length} SEO-Befund(e) auf ${geprueft} indexierbaren Seiten:`);
        const nachArt = new Map();
        for (const b of befunde) nachArt.set(b.art, [...(nachArt.get(b.art) ?? []), b]);
        for (const [art, liste] of nachArt) {
          logger.warn(`  ${liste.length}× ${art}  z. B. ${liste[0].pfad}`);
          if (liste[0].detail) logger.warn(`      ${String(liste[0].detail).slice(0, 90)}`);
        }
      },
    },
  };
}
