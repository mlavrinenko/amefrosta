import { createContext, useContext } from 'react';
import { PACKS, type PackCode } from '../packs';
import type { LanguagePack } from '../engine/types';
import { STRINGS } from './strings';

export interface I18n {
  lang: PackCode;
  pack: LanguagePack;
  t: (key: string) => string;
}

export function makeI18n(lang: PackCode): I18n {
  const dict = STRINGS[lang];
  return {
    lang,
    pack: PACKS[lang],
    t: (key) => dict[key] ?? STRINGS.en[key] ?? key,
  };
}

const I18nContext = createContext<I18n | null>(null);
export const I18nProvider = I18nContext.Provider;

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used within I18nProvider');
  return value;
}
