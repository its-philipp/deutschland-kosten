import type { TopicConfig } from '../data/topics/types';
import { jahrAus } from './jahr';

/**
 * Welches Jahr ein Thema im Titel tragen darf.
 *
 * Das **früheste** Abrufjahr seiner Quellen: Der Titel „Gebühren 2026" steht
 * über allen Zahlen der Seite, also darf er nur behaupten, was für alle gilt.
 * Ist eine Quelle 2027 neu gelesen und eine andere nicht, sind die Zahlen der
 * Seite erst zum Stand der älteren vollständig bestätigt.
 *
 * `null` — kein Jahr im Titel — in zwei Fällen, und beide sind Absicht:
 *
 * - **Das Thema ist nicht `verified`.** Dann trägt die Seite ohnehin `noindex`
 *   und sagt selbst, dass ihre Zahlen unbestätigt sind (types.ts). Eine
 *   Jahreszahl im Titel wäre dort eine Bestätigung durch die Hintertür, auch
 *   wenn einzelne Quellen ein Abrufdatum haben.
 * - **Keine Quelle hat ein Abrufdatum.** Dann gibt es nichts, woraus sich ein
 *   Jahr ableiten ließe, und raten ist die eine Sache, die ein Titel hier nicht
 *   darf.
 */
export function standJahrThema(topic: TopicConfig): number | null {
  if (!topic.verified) return null;
  const abrufe = topic.sources.map((s) => s.retrieved).filter((r): r is string => Boolean(r));
  if (abrufe.length === 0) return null;
  return Math.min(...abrufe.map(jahrAus));
}

/**
 * Das Jahr einer Übersicht über mehrere Themen: das früheste unter den
 * bestätigten. Unbestätigte Themen zählen nicht mit — sie senken das Jahr
 * nicht und heben es nicht. Ohne ein einziges bestätigtes Thema: `null`.
 */
export function standJahrUebersicht(topics: TopicConfig[]): number | null {
  const jahre = topics.map(standJahrThema).filter((j): j is number => j !== null);
  return jahre.length === 0 ? null : Math.min(...jahre);
}
