import type { Tier } from '../engine/types';

/** Build a letter->tier map from three strings of letters. */
export function buildTiers(common: string, uncommon: string, rare: string): Record<string, Tier> {
  const t: Record<string, Tier> = {};
  for (const c of [...common]) t[c] = 'common';
  for (const c of [...uncommon]) t[c] = 'uncommon';
  for (const c of [...rare]) t[c] = 'rare';
  return t;
}
