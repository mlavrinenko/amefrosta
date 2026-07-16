import type { LanguagePack } from '../engine/types';
import { buildTiers } from './util';

// Tiers taken from the console/letter-card art. See docs/data-requirements.md.
const COMMON = 'АВЕИЛНОРСТ'; // 10
const UNCOMMON = 'БГДЗЙКМПУЧЫЬЯ'; // 13
const RARE = 'ЁЖФХЦШЩЪЭЮ'; // 10

export const ru: LanguagePack = {
  code: 'ru',
  name: 'Русский',
  alphabet: [...'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'],
  tiers: buildTiers(COMMON, UNCOMMON, RARE),
};
