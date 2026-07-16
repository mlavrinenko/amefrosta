import type { Category, Cipher, LanguagePack, Tier } from './types';
import { shuffle, type Rng } from './rng';

const upper = (s: string) => s.toUpperCase();

/**
 * Cipher score of a word:
 *   +1 per Trust-letter occurrence,
 *   then x2 per Amplify-letter occurrence,
 *   then negate if the Suspicion letter appears at all.
 * `-0` is normalized to `0`.
 */
export function scoreWord(cipher: Cipher, word: string): number {
  const trust = new Set(cipher.trust.map(upper));
  const amplify = new Set(cipher.amplify.map(upper));
  const suspicion = new Set(cipher.suspicion.map(upper));

  let score = 0;
  let hasSuspicion = false;
  for (const ch of upper(word)) {
    if (trust.has(ch)) score += 1;
  }
  for (const ch of upper(word)) {
    if (amplify.has(ch)) score *= 2;
  }
  for (const ch of upper(word)) {
    if (suspicion.has(ch)) {
      hasSuspicion = true;
      break;
    }
  }
  if (hasSuspicion) score = -score;
  return score === 0 ? 0 : score; // kill -0
}

interface Slot {
  cat: Category;
  allowed: Tier[];
}

/** Slots left-to-right across the physical screen: Trust | Amplify | Suspicion. */
const SLOTS: Slot[] = [
  { cat: 'trust', allowed: ['common'] },
  { cat: 'trust', allowed: ['uncommon'] },
  { cat: 'trust', allowed: ['uncommon', 'rare'] },
  { cat: 'amplify', allowed: ['common'] },
  { cat: 'amplify', allowed: ['uncommon', 'rare'] },
  { cat: 'suspicion', allowed: ['common', 'uncommon', 'rare'] },
];

/**
 * Faithful reproduction of the physical draw-and-place: shuffle the letter deck,
 * reveal one at a time, drop it into the leftmost empty slot whose required color
 * matches; otherwise bottom-deck it. At most one rare (red) letter overall;
 * extra rares are discarded.
 */
export function generateCipher(pack: LanguagePack, rng: Rng): Cipher {
  const queue = shuffle(pack.alphabet, rng);
  const filled: (string | null)[] = SLOTS.map(() => null);
  let redUsed = false;

  let guard = 0;
  const maxGuard = queue.length * 8 + 100;
  while (filled.some((f) => f === null)) {
    if (queue.length === 0 || guard++ > maxGuard) {
      throw new Error(`generateCipher: cannot fill a cipher from pack "${pack.code}"`);
    }
    const letter = queue.shift()!;
    const tier = pack.tiers[letter];
    if (tier === 'rare' && redUsed) continue; // discard extra reds
    const idx = SLOTS.findIndex((s, i) => filled[i] === null && s.allowed.includes(tier));
    if (idx === -1) {
      queue.push(letter); // no matching slot yet; recycle
      continue;
    }
    filled[idx] = letter;
    if (tier === 'rare') redUsed = true;
  }

  const cipher: Cipher = { trust: [], amplify: [], suspicion: [] };
  SLOTS.forEach((s, i) => cipher[s.cat].push(filled[i]!));
  return cipher;
}

const tierOf = (pack: LanguagePack, l: string): Tier | undefined => pack.tiers[upper(l)];

/** Returns a list of rule violations; empty means a legal cipher. */
export function validateCipher(pack: LanguagePack, cipher: Cipher): string[] {
  const errors: string[] = [];
  const { trust, amplify, suspicion } = cipher;

  const all = [...trust, ...amplify, ...suspicion].map(upper);
  const filled = all.filter((l) => l.length > 0);

  for (const l of filled) {
    if (!tierOf(pack, l)) errors.push(`unknown letter: ${l}`);
  }

  const filledSet = new Set(filled);
  if (filledSet.size !== filled.length) errors.push('letters must be distinct');

  const trustFilled = trust.filter((l) => l.length > 0);
  const amplifyFilled = amplify.filter((l) => l.length > 0);

  const tierCount = (xs: string[], t: Tier) =>
    xs.filter((l) => tierOf(pack, l) === t).length;

  if (trustFilled.length > 0) {
    const commons = tierCount(trustFilled, 'common');
    const uncommons = tierCount(trustFilled, 'uncommon');
    if (trustFilled.length === 3) {
      if (commons !== 1) errors.push('trust needs exactly 1 common letter');
      if (uncommons < 1) errors.push('trust needs at least 1 uncommon letter');
    }
  }

  if (amplifyFilled.length > 0) {
    const commons = tierCount(amplifyFilled, 'common');
    if (amplifyFilled.length === 2 && commons !== 1) {
      errors.push('amplify needs exactly 1 common letter');
    }
  }

  const reds = filled.filter((l) => tierOf(pack, l) === 'rare').length;
  if (reds > 1) errors.push('at most 1 rare (red) letter overall');

  return errors;
}
