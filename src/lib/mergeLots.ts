type Lot = Record<string, unknown>;

type MergeLotsFn = (lots: Lot[]) => Lot;

import '../../public/sankey/merge-lots.js';

const sharedMergeLots = (globalThis as Record<string, unknown>).mergeLots as
  | MergeLotsFn
  | undefined;

if (typeof sharedMergeLots !== 'function') {
  throw new Error('mergeLots non disponible dans le contexte global');
}

export const mergeLots = sharedMergeLots;

export type { MergeLotsFn, Lot };
