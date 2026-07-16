import { en } from './en';
import { ru } from './ru';

export const PACKS = { en, ru } as const;
export type PackCode = keyof typeof PACKS;
export const PACK_CODES = Object.keys(PACKS) as PackCode[];
