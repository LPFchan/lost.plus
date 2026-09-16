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

/** what a visitor with no preference gets */
export const DEFAULT_ERA = 'v1';

const KEY = 'lp-era';

/** `?era=` wins over the saved choice, and is saved for next time */
export function initialEra(): string {
  const fromUrl = new URLSearchParams(location.search).get('era');
  const id = fromUrl ?? localStorage.getItem(KEY) ?? DEFAULT_ERA;
  const era = ERAS.some((e) => e.id === id) ? id : DEFAULT_ERA;
  if (fromUrl && era === fromUrl) localStorage.setItem(KEY, era);
  return era;
}

export function saveEra(id: string) {
  localStorage.setItem(KEY, id);
}
