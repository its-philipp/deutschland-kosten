/** Every symbol in src/components/IconSprite.astro, by id without the `i-`. */
export type IconName =
  // Vertical marks (see data/verticals.ts for the accent that goes with each)
  | 'verkehr'
  | 'recht'
  | 'medizin'
  | 'handwerk'
  | 'wohnen'
  // interface
  | 'search'
  | 'check'
  | 'close'
  // per-topic marks
  | 'pass'
  | 'hund'
  | 'strom'
  | 'gas';
