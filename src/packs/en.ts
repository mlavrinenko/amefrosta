import type { LanguagePack } from '../engine/types';
import { buildTiers } from './util';

// Tiers taken from the console/letter-card art. See docs/data-requirements.md.
const COMMON = 'AEILNORST'; // 9
const UNCOMMON = 'BCDFGHMPUWY'; // 11
const RARE = 'JKQVXZ'; // 6

export const en: LanguagePack = {
  code: 'en',
  name: 'English',
  alphabet: [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'],
  tiers: buildTiers(COMMON, UNCOMMON, RARE),
};
