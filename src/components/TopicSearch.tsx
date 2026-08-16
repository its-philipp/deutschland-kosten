import { useState } from 'preact/hooks';
import type { IconName } from '../lib/icons';

/**
 * Plain data for one topic — reduced by the caller from `TopicConfig` so the
 * island's serialized props stay small (a full config carries sources and
 * option trees it does not need).
 */
export interface TopicSearchItem {
  slug: string;
  question: string;
  vertical: string;
  verticalLabel: string;
  accent: string;
  icon: IconName;
}

interface Props {
  items: TopicSearchItem[];
}

/** "Reisepass" and "reisepass" (and, if it ever comes up, "Fuehrerschein") must find the same page. */
function fold(s: string): string {
  return s
    .toLowerCase()
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Filters the topic list client-side (queue task 1.6). Astro server-renders
 * the complete list as this island's initial markup — the query starts empty,
 * so every link is real HTML before hydration and the page works with
 * JavaScript disabled. The island only narrows what is already there.
 */
export default function TopicSearch({ items }: Props) {
  const [query, setQuery] = useState('');

  const term = fold(query.trim());
  const matches = items.filter(
    (item) => term.length === 0 || fold(`${item.question} ${item.verticalLabel}`).includes(term),
  );

  const showEmpty = matches.length === 0;
  const list = showEmpty ? items : matches;

  return (
    <div>
      <div class="flex max-w-lg items-stretch overflow-hidden rounded-[4px] border-[1.5px] border-ink">
        <label class="sr-only" for="themen-suche">
          Wonach suchen Sie?
        </label>
        <input
          id="themen-suche"
          type="search"
          value={query}
          onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
          placeholder="z. B. Reisepass"
          class="w-full px-3 py-2.5 text-sm outline-none placeholder:text-ink-mute"
        />
        {/* Action colour, not a category accent — the search box is
            something you do, not a place you are (root CLAUDE.md → Design
            conventions). Signalgelb-on-Tiefschwarz, same pairing as buttons
            and links across the site. */}
        <span class="flex items-center bg-signal px-4 text-ink" aria-hidden="true">
          <svg class="h-[18px] w-[18px]">
            <use href="#i-search"></use>
          </svg>
        </span>
      </div>

      <p class="mt-3 text-sm text-ink-mute" role="status" aria-live="polite">
        {term.length === 0
          ? `${items.length} Themen`
          : matches.length === 1
            ? '1 Thema gefunden'
            : `${matches.length} Themen gefunden`}
      </p>

      {showEmpty && (
        <p class="mt-2 text-ink-soft">
          Dazu haben wir noch nichts gefunden. Hier ist die vollständige Liste unserer Themen:
        </p>
      )}

      <ul class="sheet mt-4 divide-y divide-rule">
        {list.map((item) => (
          <li key={item.slug}>
            <a
              href={`/was-kostet/${item.slug}/`}
              style={`--accent: ${item.accent}`}
              class="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-signal-tint"
            >
              <svg class="h-5 w-5 shrink-0 text-(--accent)" aria-hidden="true">
                <use href={`#i-${item.icon}`}></use>
              </svg>
              <span class="min-w-0 flex-1">
                <span class="block font-medium text-ink">{item.question}</span>
                <span class="mt-0.5 block text-xs text-(--accent)">{item.verticalLabel}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
