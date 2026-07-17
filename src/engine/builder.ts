import type { Category, Cipher, LanguagePack, Tier } from './types';

/**
 * Constrained cipher editor model. A cipher fills 6 canonical slots whose
 * allowed tiers reproduce the rulebook build rules exactly:
 *   Trust:     common | uncommon | (uncommon or rare)
 *   Amplify:   common | (uncommon or rare)
 *   Suspicion: any
 * plus: letters distinct, at most one rare across the whole cipher.
 * Array index within a category == its canonical slot (matches generateCipher).
 */
const ALL_TIERS: Tier[] = ['common', 'uncommon', 'rare'];
const upper = (s: string) => s.toUpperCase();

export const SLOT_COUNT: Record<Category, number> = { trust: 3, amplify: 2, suspicion: 1 };

export function slotAllowed(cat: Category, i: number): Tier[] {
  if (cat === 'trust') return i === 0 ? ['common'] : i === 1 ? ['uncommon'] : ['uncommon', 'rare'];
  if (cat === 'amplify') return i === 0 ? ['common'] : ['uncommon', 'rare'];
  return ['common', 'uncommon', 'rare'];
}

export function emptyCipher(): Cipher {
  return { trust: ['', '', ''], amplify: ['', ''], suspicion: [''] };
}

function usedLetters(cipher: Cipher, exceptCat: Category, exceptI: number): Set<string> {
  const used = new Set<string>();
  (['trust', 'amplify', 'suspicion'] as Category[]).forEach((c) => {
    cipher[c].forEach((l, idx) => {
      if (c === exceptCat && idx === exceptI) return;
      const L = upper(l);
      if (L) used.add(L);
    });
  });
  return used;
}

function rareUsedElsewhere(pack: LanguagePack, cipher: Cipher, cat: Category, i: number): boolean {
  return (['trust', 'amplify', 'suspicion'] as Category[]).some((c) =>
    cipher[c].some((l, idx) => {
      if (c === cat && idx === i) return false;
      return pack.tiers[upper(l)] === 'rare';
    }),
  );
}

/** Letters that may legally occupy slot (cat, i) given the rest of the cipher. */
export function legalLettersForSlot(
  pack: LanguagePack,
  cipher: Cipher,
  cat: Category,
  i: number,
): string[] {
  const allowed = new Set(slotAllowed(cat, i));
  const used = usedLetters(cipher, cat, i);
  const rareElsewhere = rareUsedElsewhere(pack, cipher, cat, i);
  return pack.alphabet.filter((l) => {
    const L = upper(l);
    const tier = pack.tiers[L];
    if (!tier || !allowed.has(tier)) return false;
    if (used.has(L)) return false;
    if (tier === 'rare' && rareElsewhere) return false;
    return true;
  });
}

/**
 * Letters offerable in slot (cat, i) when a letter already placed elsewhere may
 * be *relocated* into it. Unlike legalLettersForSlot this does not reject a
 * letter just because it sits in another slot — picking it moves it here (the
 * caller clears its old slot). Tier fit is still required, and the one-rare cap
 * still holds: a rare is offered only when no *other* slot (ignoring this
 * letter's own placement and the target) already holds a rare.
 */
export function pickableLettersForSlot(
  pack: LanguagePack,
  cipher: Cipher,
  cat: Category,
  i: number,
): string[] {
  const allowed = new Set(slotAllowed(cat, i));
  return pack.alphabet.filter((l) => {
    const L = upper(l);
    const tier = pack.tiers[L];
    if (!tier || !allowed.has(tier)) return false;
    if (tier === 'rare') {
      const otherRare = (['trust', 'amplify', 'suspicion'] as Category[]).some((c) =>
        cipher[c].some((x, idx) => {
          if (c === cat && idx === i) return false; // the target slot
          const X = upper(x);
          if (X === L) return false; // this letter's own placement — it moves
          return pack.tiers[X] === 'rare';
        }),
      );
      if (otherRare) return false;
    }
    return true;
  });
}

/** Where a letter currently sits, or null. Letters are distinct, so at most one. */
export function findLetter(cipher: Cipher, letter: string): { cat: Category; i: number } | null {
  const L = upper(letter);
  for (const c of ['trust', 'amplify', 'suspicion'] as Category[]) {
    const idx = cipher[c].findIndex((x) => upper(x) === L);
    if (idx >= 0) return { cat: c, i: idx };
  }
  return null;
}

/** Tiers still fillable in slot (cat, i) — for fading impossible ones in the UI. */
export function allowedTiersForSlot(
  pack: LanguagePack,
  cipher: Cipher,
  cat: Category,
  i: number,
): Tier[] {
  const legalTiers = new Set(legalLettersForSlot(pack, cipher, cat, i).map((l) => pack.tiers[upper(l)]));
  const base = new Set(slotAllowed(cat, i));
  return ALL_TIERS.filter((t) => base.has(t) && legalTiers.has(t));
}

/** Order-independent signature for deduplicating archived ciphers. */
export function cipherSignature(cipher: Cipher): string {
  const norm = (xs: string[]) => xs.map(upper).filter(Boolean).sort().join('');
  return `T${norm(cipher.trust)}|A${norm(cipher.amplify)}|S${norm(cipher.suspicion)}`;
}
