/**
 * Jede externe Adresse muss erreichbar sein — und jedes §-Zitat muss auf die
 * Norm zeigen, die es nennt.
 *
 * Zwei Ebenen:
 *   1. Jede externe Adresse im `dist/` und jede URL in den `_meta` der
 *      Quell-Datensätze antwortet mit 200.
 *   2. Wo ein Link auf eine Einzelnorm bei gesetze-im-internet.de zeigt und
 *      der Linktext einen Paragrafen nennt, müssen **Nummer und
 *      Gesetzeskürzel** im `<title>` der Zielseite vorkommen. Ein Link auf
 *      `__635.html` unter dem Text „§ 634 BGB" antwortet mit 200 und ist
 *      trotzdem falsch — Ebene 1 sieht das nicht.
 *
 * Drei Dinge, die beim Bau dieses Prüfers schiefgingen und deshalb hier stehen:
 *
 * - **Zeichensatz.** gesetze-im-internet.de nennt keinen Charset, liefert
 *   Latin-1 und schreibt „§" als `&#167;`. Naiv dekodiert meldet der Prüfer
 *   *jede* deutsche Fundstelle als falsch.
 * - **Das Gesetzeskürzel steht mal vorn, mal hinten.** „§ 36 Abs. 3 SGB XI"
 *   gegen „FamGKG § 28 – Wertgebühren". Eine Heuristik, die „das letzte
 *   großgeschriebene Wort" nimmt, erklärt 20 korrekte Links für falsch. Der
 *   Prüfer rät deshalb nicht, welches Wort das Kürzel ist, sondern nimmt alle
 *   Kandidaten und lässt den Titel entscheiden.
 * - **SGB-Ziffern.** gesetze-im-internet schreibt „SGB 11", der Rest der Welt
 *   „SGB XI".
 *
 * Und der Grund, warum eine Drosselung kein Fehler ist: Ein Prüfer muss
 * „kaputt" von „nicht prüfbar" trennen. 202/429/5xx werden wiederholt und
 * danach als unbelegt gemeldet. Fehlalarme bringen einen dazu, echte Funde
 * wegzuklicken.
 *
 * Bewusst KEINE Astro-Integration: hängt an fremden Servern, ein 503 dort darf
 * keinen Deploy scheitern lassen. Wie `check-placeholders.mjs` je Projekt
 * dupliziert, weil die Spiegel aus dem Projektordner allein bauen.
 *
 * Aufruf: npm run build && npm run check:links
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const TIMEOUT_MS = 25_000;
const UA = 'Mozilla/5.0 (compatible; link check)';
const SOFT = (s) => s === 202 || s === 429 || s >= 500;
/**
 * **Wiederholen ist nicht dasselbe wie durchwinken** (2026-08-30).
 *
 * Bis heute galt: 202, 429 und 5xx werden wiederholt und am Ende als „nicht
 * prüfbar" gemeldet — alles andere ist beim ersten Versuch ein Urteil. Zwei
 * Fehlalarme an einem Abend haben gezeigt, dass das zu grob ist:
 *
 *  - Ein **Verbindungsfehler** (Status 0) landete in der harten Kategorie. Er
 *    sagt aber nichts über die Adresse, nur über den Moment.
 *  - Ein **404** bekam gar keinen zweiten Versuch. vdek.com lieferte im
 *    Prüferlauf 404 für eine Seite, die einen Wimpernschlag später mit
 *    demselben User-Agent 200 antwortete.
 *
 * Deshalb jetzt zwei getrennte Begriffe: `WIEDERHOLEN` entscheidet, ob es
 * einen weiteren Versuch gibt — dazu gehört auch der 404. `SOFT` entscheidet,
 * ob das Ergebnis am Ende als „nicht prüfbar" durchgeht statt als Fehler; ein
 * 404, der drei Versuche übersteht, ist ein echter toter Link und bleibt rot.
 */
const WIEDERHOLEN = (s) => s === 0 || s === 202 || s === 404 || s === 429 || s >= 500;
const PAUSEN_MS = [3_000, 8_000];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SGB_ZIFFER = { I: '1', II: '2', III: '3', IV: '4', V: '5', VI: '6', VII: '7', VIII: '8', IX: '9', X: '10', XI: '11', XII: '12', XIV: '14' };
const KEIN_KUERZEL = new Set(['ABS', 'NR', 'SATZ', 'ANLAGE', 'KV', 'UND', 'VON', 'FÜR', 'DER', 'DIE', 'DAS', 'IM', 'IN']);

async function holenEinmal(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': UA } });
    if (!res.ok) return { status: res.status, body: '' };
    const charset = /charset=([\w-]+)/i.exec(res.headers.get('content-type') ?? '')?.[1] ?? 'iso-8859-1';
    const buf = await res.arrayBuffer();
    let body;
    try {
      body = new TextDecoder(charset.toLowerCase()).decode(buf);
    } catch {
      body = new TextDecoder('iso-8859-1').decode(buf);
    }
    return { status: res.status, body: body.replace(/&#167;|&sect;/g, '§').replace(/&nbsp;/g, ' ') };
  } catch {
    return { status: 0, body: '' };
  } finally {
    clearTimeout(t);
  }
}

async function holen(url) {
  let letzte = { status: 0, body: '' };
  for (let i = 0; i < PAUSEN_MS.length + 1; i++) {
    letzte = await holenEinmal(url);
    if (!WIEDERHOLEN(letzte.status)) return letzte;
    if (i < PAUSEN_MS.length) await sleep(PAUSEN_MS[i]);
  }
  return letzte;
}

function htmlDateien(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...htmlDateien(p));
    else if (p.endsWith('.html')) out.push(p);
  }
  return out;
}

/**
 * URLs aus den Quellen-Metadaten ziehen.
 *
 * Der naheliegende Ausdruck schließt `)` und `]` aus, damit ein Link am Ende
 * eines Satzes nicht die schließende Klammer mitnimmt. Bei deutschen
 * Behörden-URLs ist das falsch: Die KfW hostet unter
 * `.../Förderprogramme-(Inlandsförderung)/...`, und abgeschnitten meldete der
 * Prüfer eine **404 auf einen Link, den es gibt**. Ein Fehlalarm ist schlimmer
 * als eine Lücke — er bringt einen dazu, echte Funde wegzuklicken.
 *
 * Deshalb: Ist der ganze String eine URL, wird er ganz genommen. Nur wenn eine
 * URL in Fließtext eingebettet ist, greift der vorsichtige Ausdruck.
 */
function urlsAus(o, raus = new Set()) {
  if (typeof o === 'string') {
    const ganz = o.trim();
    if (/^https?:\/\/\S+$/.test(ganz)) raus.add(ganz.replace(/[.,;]$/, ''));
    else for (const u of ganz.match(/https?:\/\/[^\s"'<>)\]]+/g) ?? []) raus.add(u.replace(/[.,;]$/, ''));
  }
  else if (Array.isArray(o)) for (const v of o) urlsAus(v, raus);
  else if (o && typeof o === 'object') for (const v of Object.values(o)) urlsAus(v, raus);
  return raus;
}

const entkommen = (s) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

const fehler = [];
const nichtPruefbar = [];
const melden = (m) => {
  fehler.push(m);
  console.error(`✗ ${m}`);
};

// ---- sammeln ----------------------------------------------------------------
const eigene = process.argv[2];
if (!eigene) {
  console.error('Aufruf: node scripts/check-links.mjs <eigene-domain>');
  process.exit(2);
}
const adressen = new Set();
const zitate = []; // { url, text }
const ANKER = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;

for (const f of htmlDateien('dist')) {
  const html = readFileSync(f, 'utf8');
  for (const m of html.matchAll(ANKER)) {
    const url = entkommen(m[1]);
    if (url.includes(eigene)) continue;
    adressen.add(url);
    const text = entkommen(m[2].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
    if (/gesetze-im-internet\.de\/.+__[0-9a-z]+\.html/.test(url) && /§\s*[0-9]/.test(text)) {
      zitate.push({ url, text });
    }
  }
}
const quellDir = 'src/data/sources';
if (existsSync(quellDir)) {
  for (const f of readdirSync(quellDir).filter((n) => n.endsWith('.json'))) {
    const d = JSON.parse(readFileSync(join(quellDir, f), 'utf8'));
    for (const u of urlsAus(d._meta ?? d)) adressen.add(u);
  }
}

// ---- Ebene 1 ----------------------------------------------------------------
console.log(`${adressen.size} externe Adressen (dist/ und Quellen-Metadaten)`);
const koerper = new Map();
for (const u of [...adressen].sort()) {
  const { status, body } = await holen(u);
  if (status === 200) koerper.set(u, body);
  else if (SOFT(status) || status === 0) {
    nichtPruefbar.push(u);
    console.log(`· ${status} — ${u} (Dienst drosselt oder ist gestört)`);
  } else melden(`${status || 'Netzfehler'} — ${u}`);
}

// ---- Ebene 2 ----------------------------------------------------------------
const titelVon = (body) => (/<title>([\s\S]*?)<\/title>/i.exec(body)?.[1] ?? '').replace(/\s+/g, ' ').trim();
let geprueft = 0;
const gesehen = new Set();
for (const { url, text } of zitate) {
  const key = `${url}|${text}`;
  if (gesehen.has(key)) continue;
  gesehen.add(key);
  const body = koerper.get(url);
  if (!body) continue;
  const titel = titelVon(body);
  const nummer = /§\s*([0-9]+[a-z]?)/.exec(text)?.[1];
  if (!nummer) continue;
  if (!new RegExp(`§\\s*${nummer}\\b`).test(titel)) {
    melden(`„${text}" zeigt auf ${url} mit dem Titel „${titel}" — falscher Paragraf?`);
    continue;
  }
  // Kürzel nicht raten, sondern alle Kandidaten gegen den Titel halten.
  const kandidaten = (text.match(/\b[A-Za-zÄÖÜäöü]{2,}\b/g) ?? []).filter(
    (w) => !KEIN_KUERZEL.has(w.toUpperCase()) && /[A-ZÄÖÜ]/.test(w),
  );
  const sgb = /\bSGB\s+([IVX]+)\b/.exec(text);
  const passt =
    (sgb && new RegExp(`SGB\\s*(?:${sgb[1]}|${SGB_ZIFFER[sgb[1]] ?? sgb[1]})\\b`, 'i').test(titel)) ||
    kandidaten.some((k) => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(titel));
  if (!passt) melden(`„${text}" zeigt auf ${url} mit dem Titel „${titel}" — anderes Gesetz?`);
  else geprueft++;
}

console.log(`\n${geprueft} §-Zitate gegen den Titel der Zielseite geprüft`);
if (nichtPruefbar.length) console.log(`${nichtPruefbar.length} Adresse(n) nicht prüfbar — kein Fehler, aber auch kein Beleg.`);
if (fehler.length) {
  console.error(`\n${fehler.length} Problem(e).`);
  process.exit(1);
}
console.log('Alle erreichbaren Adressen in Ordnung, alle prüfbaren Zitate belegt.');
