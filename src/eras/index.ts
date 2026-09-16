// The eras of this site, oldest first. Each is a self-contained page that
// draws over the shared backdrop; the selector in the top-right corner (on
// desktop) swaps them live. The backdrop canvas never remounts across a
// switch, so only its look changes.

import V1 from './v1';
import V2 from './v2';
import type { Era } from './types';

export type { Era, EraProps } from './types';

export const ERAS: Era[] = [
  {
    id: 'v1',
    label: 'v1',
    look: { trees: true, dim: 0, forceDark: false },
    Component: V1,
  },
  {
    id: 'v2',
    label: 'v2',
    look: { trees: false, dim: 0.85, forceDark: true },
    Component: V2,
  },
];

/** what a visitor with no preference gets: phones (no selector) get v2 */
export function defaultEra(): string {
  return window.innerWidth < 640 ? 'v2' : 'v1';
}

const KEY = 'lp-era';

/**
 * `?era=` wins over the saved choice, and is saved for next time. A phone
 * has no selector, so it never saved a choice of its own; a stale one from
 * an earlier build is ignored there.
 */
export function initialEra(): string {
  const fromUrl = new URLSearchParams(location.search).get('era');
  const saved = window.innerWidth < 640 ? null : localStorage.getItem(KEY);
  const id = fromUrl ?? saved ?? defaultEra();
  const era = ERAS.some((e) => e.id === id) ? id : defaultEra();
  if (fromUrl && era === fromUrl) localStorage.setItem(KEY, era);
  return era;
}

export function saveEra(id: string) {
  localStorage.setItem(KEY, id);
}
