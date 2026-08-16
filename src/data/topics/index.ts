import type { Amount, TopicConfig } from './types';
import { ausweisPass } from './ausweis-pass';
import { notarGrundbuch } from './notar-grundbuch';
import { tuevHu } from './tuev-hu';
import { fuehrerschein } from './fuehrerschein';
import { zahnimplantat } from './zahnimplantat';
import { scheidung } from './scheidung';
import { hundTierarzt } from './hund-tierarzt';
import { stromkosten } from './stromkosten';
import { gaskosten } from './gaskosten';

/**
 * The topic registry. `src/pages/was-kostet/[topic].astro` generates one route
 * per entry, so adding a cost topic to the site is adding a config file here
 * and nothing else.
 *
 * Filled by queue tasks 1.5 (five pilot topics), 1.8 (wave 2) and 1.10 (the two
 * datasets that had been collected but never wired to a page).
 */
export const TOPICS: TopicConfig[] = [
  ausweisPass,
  notarGrundbuch,
  tuevHu,
  fuehrerschein,
  zahnimplantat,
  hundTierarzt,
  scheidung,
  stromkosten,
  gaskosten,
];

/**
 * Contract checks that TypeScript cannot express: ids are strings, so a typo in
 * `defaults` or `dependsOn` type-checks fine and then fails silently in the
 * browser — a `single` group with no option checked, or a surcharge that can
 * never be selected because it names a group that does not exist.
 *
 * Runs at build time (module scope) and throws, so a broken topic config fails
 * the build instead of shipping a quietly wrong estimator. Cheap insurance
 * before tasks 1.5 and 1.8 add topics in bulk.
 */
function assertTopic(topic: TopicConfig): void {
  const where = `Topic "${topic.slug}"`;
  const groupIds = new Set<string>();

  for (const group of topic.groups) {
    if (groupIds.has(group.id)) {
      throw new Error(`${where}: duplicate group id "${group.id}".`);
    }
    groupIds.add(group.id);

    if (!group.options.length) {
      throw new Error(`${where}, group "${group.id}": has no options.`);
    }

    const optionIds = new Set<string>();
    for (const option of group.options) {
      if (optionIds.has(option.id)) {
        throw new Error(`${where}, group "${group.id}": duplicate option id "${option.id}".`);
      }
      optionIds.add(option.id);
    }

    for (const id of group.defaults ?? []) {
      if (!optionIds.has(id)) {
        throw new Error(
          `${where}, group "${group.id}": default "${id}" is not one of its options.`,
        );
      }
    }

    if (group.kind === 'single' && (group.defaults?.length ?? 0) > 1) {
      throw new Error(
        `${where}, group "${group.id}": a single-choice group cannot have ${group.defaults!.length} defaults.`,
      );
    }
  }

  // Conditions are resolved after all groups are known, so an option may depend
  // on a group declared later in the file.
  for (const group of topic.groups) {
    for (const option of group.options) {
      const condition = option.dependsOn;
      if (!condition) continue;

      // A `single` group depending on itself is a paradox — its fallback would
      // have to pick an option whose availability depends on the pick. Within a
      // `multi` group it is both meaningful and needed: the deletion of an
      // Auflassungsvormerkung is only chargeable if a Vormerkung was entered,
      // and both are checkboxes in the same Grundbuch group.
      if (condition.group === group.id && group.kind === 'single') {
        throw new Error(
          `${where}, option "${option.id}": a single-choice group cannot depend on itself ("${group.id}").`,
        );
      }
      if (condition.group === group.id && condition.options.includes(option.id)) {
        throw new Error(
          `${where}, option "${option.id}": depends on itself.`,
        );
      }

      const target = topic.groups.find((g) => g.id === condition.group);
      if (!target) {
        throw new Error(
          `${where}, option "${option.id}": depends on unknown group "${condition.group}".`,
        );
      }
      if (!condition.options.length) {
        throw new Error(`${where}, option "${option.id}": dependsOn lists no options.`);
      }
      for (const id of condition.options) {
        if (!target.options.some((o) => o.id === id)) {
          throw new Error(
            `${where}, option "${option.id}": depends on "${id}", which is not an option of group "${condition.group}".`,
          );
        }
      }
    }
  }
}

/**
 * The same idea for the amount rules added in queue task 1.5. A `skala` naming
 * an input that does not exist would silently compute from 0 — a fee of zero
 * euro, rendered as confidently as a real one. A `faktor` naming an option that
 * is counted *later* resolves against nothing and quietly disappears, which is
 * how a VAT line would end up at 0,00 € on a live page.
 */
function assertAmounts(topic: TopicConfig): void {
  const where = `Topic "${topic.slug}"`;
  const inputIds = new Set((topic.inputs ?? []).map((i) => i.id));

  // Position of each option in evaluation order, so "must already be counted"
  // is checkable rather than a comment.
  const position = new Map<string, number>();
  let n = 0;
  for (const group of topic.groups) for (const option of group.options) position.set(option.id, n++);

  /** Recursive so a `summe` cannot smuggle an unchecked part past the guard. */
  function pruefeAmount(amount: Amount, optionId: string): void {
    if (!('kind' in amount)) return;

    if (amount.kind === 'skala') {
      if (!inputIds.has(amount.input)) {
        throw new Error(
          `${where}, option "${optionId}": scale reads input "${amount.input}", which the topic does not declare.`,
        );
      }
      if (!(amount.satz > 0)) {
        throw new Error(`${where}, option "${optionId}": scale has no positive Gebührensatz.`);
      }
      return;
    }

    if (amount.kind === 'proEinheit') {
      if (!inputIds.has(amount.input)) {
        throw new Error(
          `${where}, option "${optionId}": unit price reads input "${amount.input}", which the topic does not declare.`,
        );
      }
      if (!amount.stufen.length) {
        throw new Error(`${where}, option "${optionId}": unit price has no bands.`);
      }
      // Bands are matched by the first `bis` the quantity falls under, so an
      // unsorted list would silently price a household from the wrong class —
      // and an open band in the middle would make every band after it dead.
      let vorher = -Infinity;
      amount.stufen.forEach((stufe, i) => {
        const letzte = i === amount.stufen.length - 1;
        if (stufe.bis === undefined) {
          if (!letzte) {
            throw new Error(
              `${where}, option "${optionId}": band ${i + 1} is open-ended but is not the last one — every band after it is unreachable.`,
            );
          }
          return;
        }
        if (letzte) {
          throw new Error(
            `${where}, option "${optionId}": the last band ends at ${stufe.bis}, so a larger quantity has no price. Leave its "bis" out.`,
          );
        }
        if (stufe.bis <= vorher) {
          throw new Error(
            `${where}, option "${optionId}": bands must ascend; ${stufe.bis} follows ${vorher}.`,
          );
        }
        vorher = stufe.bis;
      });
      return;
    }

    if (amount.kind === 'summe') {
      if (!amount.teile.length) {
        throw new Error(`${where}, option "${optionId}": sum has no parts.`);
      }
      for (const teil of amount.teile) pruefeAmount(teil, optionId);
      return;
    }

    if (amount.von === 'zwischensumme') return;
    const refs = Array.isArray(amount.von) ? amount.von : [amount.von];
    if (!refs.length) {
      throw new Error(`${where}, option "${optionId}": amount refers to nothing.`);
    }
    for (const ref of refs) {
      if (!position.has(ref)) {
        throw new Error(`${where}, option "${optionId}": refers to unknown option "${ref}".`);
      }
      if (position.get(ref)! >= position.get(optionId)!) {
        throw new Error(
          `${where}, option "${optionId}": refers to "${ref}", which is evaluated later. Move its group earlier — an amount can only build on what is already counted.`,
        );
      }
    }
  }

  for (const group of topic.groups) {
    for (const option of group.options) pruefeAmount(option.amount, option.id);
  }
}

TOPICS.forEach((topic) => {
  assertTopic(topic);
  assertAmounts(topic);
});

export function topicBySlug(slug: string): TopicConfig | undefined {
  return TOPICS.find((topic) => topic.slug === slug);
}
