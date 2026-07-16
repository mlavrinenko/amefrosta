import { describe, it, expect } from 'vitest';
import { en } from './en';
import { ru } from './ru';
import type { LanguagePack } from '../engine/types';

const cases: Array<[LanguagePack, number, [number, number, number]]> = [
  [en, 26, [9, 11, 6]],
  [ru, 33, [10, 13, 10]],
];

for (const [pack, size, [common, uncommon, rare]] of cases) {
  describe(`${pack.code} pack`, () => {
    it('alphabet and tiers agree on size', () => {
      expect(pack.alphabet).toHaveLength(size);
      expect(Object.keys(pack.tiers)).toHaveLength(size);
    });
    it('every alphabet letter has a tier', () => {
      for (const l of pack.alphabet) expect(pack.tiers[l]).toBeDefined();
    });
    it('no duplicate letters in the alphabet', () => {
      expect(new Set(pack.alphabet).size).toBe(size);
    });
    it('tier counts match the rulebook', () => {
      const count = (t: string) => pack.alphabet.filter((l) => pack.tiers[l] === t).length;
      expect([count('common'), count('uncommon'), count('rare')]).toEqual([common, uncommon, rare]);
    });
  });
}
