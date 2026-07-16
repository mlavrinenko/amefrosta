export type Tier = 'common' | 'uncommon' | 'rare';

export type Category = 'trust' | 'amplify' | 'suspicion';

export interface LanguagePack {
  /** ISO-ish code, e.g. 'en' | 'ru' */
  code: string;
  /** Display name in its own language */
  name: string;
  /** Uppercase letters, in alphabet order */
  alphabet: string[];
  /** letter -> tier */
  tiers: Record<string, Tier>;
}

/** The Alien's secret. 3 trust + 2 amplify + 1 suspicion letters. */
export interface Cipher {
  trust: string[];
  amplify: string[];
  suspicion: string[];
}
