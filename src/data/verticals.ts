import type { IconName } from '../lib/icons';

export type VerticalSlug = 'verkehr' | 'recht' | 'medizin' | 'handwerk' | 'wohnen';

export interface Vertical {
  slug: VerticalSlug;
  label: string;
}

/** The five ad verticals cost topics are grouped into (root CLAUDE.md → Design conventions). */
export const VERTICALS: Vertical[] = [
  { slug: 'verkehr', label: 'Verkehr' },
  { slug: 'recht', label: 'Recht' },
  { slug: 'medizin', label: 'Medizin' },
  { slug: 'handwerk', label: 'Handwerk' },
  { slug: 'wohnen', label: 'Wohnen' },
];

/** Sprite icon per vertical (src/components/IconSprite.astro). */
export const CATEGORY_ICONS: Record<string, IconName> = {
  verkehr: 'verkehr',
  recht: 'recht',
  medizin: 'medizin',
  handwerk: 'handwerk',
  wohnen: 'wohnen',
};

/**
 * Accent colour per vertical. Signalgelb is reserved for values and active
 * states (STATE.md → Design-Richtung), so these five cannot use it — instead
 * they sit at the same ink-heavy, low-chroma weight as Tiefschwarz, each
 * rotated to its own hue so a vertical still reads as "you are here" without
 * competing with the yellow that means "this is the price". All five clear
 * 4.5:1 on Papierweiß (#FFFFFF).
 *
 * Applies to tabs, card edges and icons — anything that files a page under a
 * vertical. Buttons, search and links stay Signalgelb-on-Tiefschwarz: one
 * colour means "you are here", the other means "you can do something".
 */
export const CATEGORY_ACCENTS: Record<string, string> = {
  verkehr: '#1D4E89', // Verkehrsblau
  recht: '#7A2E2E', // Siegelrot
  medizin: '#1F6F5C', // Kittelgrün
  handwerk: '#A14E17', // Baustellenrost
  wohnen: '#5B3A73', // Fliederdunkel
};

/** Fallback accent for anything not yet mapped to a vertical. */
export const DEFAULT_ACCENT = '#101112';

export function accentFor(verticalSlug: string): string {
  return CATEGORY_ACCENTS[verticalSlug] ?? DEFAULT_ACCENT;
}

/**
 * Icon for a specific topic slug (e.g. "fuehrerschein"), falling back to its
 * vertical's icon. Populated as topics land (queue task 1.5+ / 1.6).
 */
export const TOPIC_ICONS: Record<string, IconName> = {
  'ausweis-pass': 'pass',
  'hund-tierarzt': 'hund',
  stromkosten: 'strom',
  gaskosten: 'gas',
};

export function iconFor(topicSlug: string, verticalSlug: string): IconName {
  return TOPIC_ICONS[topicSlug] ?? CATEGORY_ICONS[verticalSlug] ?? 'search';
}
