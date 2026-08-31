/**
 * Ein statischer Server über `dist/`, den die Browser-Prüfer selbst starten.
 *
 * **Warum das hier steht.** Die Prüfer verlangten den Server bisher von aussen
 * (`python3 -m http.server 4399 &` im Kopfkommentar). Am 2026-08-31 lief das
 * Portfolio damit auf die schlechteste aller Varianten: Fünf Prüfer starben mit
 * `ERR_CONNECTION_REFUSED`, und der sechste war **grün, weil auf Port 4321 seit
 * vier Wochen ein vergessener `http.server`-Prozess aus einer früheren Sitzung
 * lief.** Ein Prüfer, dessen Farbe von einem Handgriff abhängt, den niemand
 * dokumentiert wiederholt, misst nicht den Code — er misst den Zustand des
 * Laptops. Dieselbe Lehre wie bei `check-placeholders.mjs`: eine Regel, die nur
 * hält, wenn jemand sie erinnert, ist ein Wunsch.
 *
 * Bewusst **kein** SPA-Rewrite (MEMORY.md 2026-08-15: `serve -s` liefert für
 * jede URL die Startseite, dann misst man eine fremde Seite). Verzeichnisse
 * bekommen ihr `index.html`, alles andere geht als 404 hinaus.
 *
 * Port 0 = das Betriebssystem sucht einen freien Port. Damit kollidieren
 * parallele Läufe nicht mehr und ein Altprozess kann nichts mehr vortäuschen.
 *
 * Wie `check-placeholders.mjs` je Projekt dupliziert, weil die öffentlichen
 * Spiegel aus dem Projektordner allein bauen.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const TYPEN = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.pdf': 'application/pdf',
};

/**
 * Startet den Server über `wurzel` und liefert `{ base, schliessen }`.
 * `base` ist die fertige Adresse inklusive Port, z. B. `http://127.0.0.1:52341`.
 */
export async function statischerServer(wurzel = 'dist') {
  const server = createServer(async (req, res) => {
    try {
      const pfad = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
      // normalize() rechnet '..' heraus, bevor daraus ein Dateiname wird.
      let datei = join(wurzel, normalize(pfad).replace(/^(\.\.[/\\])+/, ''));
      const s = await stat(datei).catch(() => null);
      if (s?.isDirectory()) datei = join(datei, 'index.html');
      const inhalt = await readFile(datei);
      res.writeHead(200, {
        'Content-Type': TYPEN[extname(datei).toLowerCase()] ?? 'application/octet-stream',
        'Content-Length': inhalt.length,
      });
      res.end(inhalt);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404');
    }
  });
  await new Promise((gut) => server.listen(0, '127.0.0.1', gut));
  const { port } = server.address();
  return {
    base: `http://127.0.0.1:${port}`,
    schliessen: () => new Promise((gut) => server.close(gut)),
  };
}
