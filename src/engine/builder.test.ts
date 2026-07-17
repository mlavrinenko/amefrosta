import { describe, it, expect } from 'vitest';
import { en } from '../packs/en';
import {
  emptyCipher,
  slotAllowed,
  legalLettersForSlot,
  pickableLettersForSlot,
  findLetter,
  allowedTiersForSlot,
  cipherSignature,
} from './builder';
import type { Cipher } from './types';

// en tiers: common=AEILNORST, uncommon=BCDFGHMPUWY, rare=JKQVXZ

describe('slotAllowed', () => {
  it('encodes the canonical per-slot tiers', () => {
    expect(slotAllowed('trust', 0)).toEqual(['common']);
    expect(slotAllowed('trust', 1)).toEqual(['uncommon']);
    expect(slotAllowed('trust', 2)).toEqual(['uncommon', 'rare']);
    expect(slotAllowed('amplify', 0)).toEqual(['common']);
    expect(slotAllowed('amplify', 1)).toEqual(['uncommon', 'rare']);
    expect(slotAllowed('suspicion', 0)).toEqual(['common', 'uncommon', 'rare']);
  });
});

describe('legalLettersForSlot', () => {
  it('offers only common letters for the trust common slot', () => {
    const legal = legalLettersForSlot(en, emptyCipher(), 'trust', 0);
    expect(legal).toEqual([...'AEILNORST']);
  });

  it('excludes letters already used elsewhere', () => {
    const c: Cipher = { trust: ['E', '', ''], amplify: ['', ''], suspicion: [''] };
    const legal = legalLettersForSlot(en, c, 'suspicion', 0);
    expect(legal).not.toContain('E');
  });

  it('drops rares once one rare is placed (max 1 rare overall)', () => {
    const c: Cipher = { trust: ['', '', ''], amplify: ['', 'X'], suspicion: [''] };
    const legal = legalLettersForSlot(en, c, 'trust', 2);
    expect(legal.every((l) => en.tiers[l] === 'uncommon')).toBe(true);
    expect(legal).not.toContain('J');
  });

  it('lets the slot keep replacing its own current letter', () => {
    const c: Cipher = { trust: ['', '', ''], amplify: ['', ''], suspicion: ['O'] };
    const legal = legalLettersForSlot(en, c, 'suspicion', 0);
    expect(legal).toContain('O'); // own letter is replaceable, not blocked as "used"
  });
});

describe('pickableLettersForSlot', () => {
  it('offers a letter already placed in another role (for relocation)', () => {
    const c: Cipher = { trust: ['E', '', ''], amplify: ['', ''], suspicion: [''] };
    // E sits in trust; it may still be picked into suspicion (moves it there).
    expect(pickableLettersForSlot(en, c, 'suspicion', 0)).toContain('E');
    // legalLettersForSlot still refuses it, guarding the non-relocation path.
    expect(legalLettersForSlot(en, c, 'suspicion', 0)).not.toContain('E');
  });

  it('still enforces the slot tier', () => {
    const c: Cipher = { trust: ['E', '', ''], amplify: ['', ''], suspicion: [''] };
    // E is common; the trust uncommon slot cannot take it even by relocation.
    expect(pickableLettersForSlot(en, c, 'trust', 1)).not.toContain('E');
  });

  it('lets a placed rare relocate but blocks a second rare', () => {
    const c: Cipher = { trust: ['', '', 'J'], amplify: ['', ''], suspicion: [''] };
    // J (rare) already placed — offer it in the amplify rare slot (relocation).
    expect(pickableLettersForSlot(en, c, 'amplify', 1)).toContain('J');
    // but a different rare stays blocked (one rare overall).
    expect(pickableLettersForSlot(en, c, 'amplify', 1)).not.toContain('K');
  });
});

describe('findLetter', () => {
  it('locates a letter across roles, or returns null', () => {
    const c: Cipher = { trust: ['E', '', ''], amplify: ['', 'X'], suspicion: [''] };
    expect(findLetter(c, 'E')).toEqual({ cat: 'trust', i: 0 });
    expect(findLetter(c, 'X')).toEqual({ cat: 'amplify', i: 1 });
    expect(findLetter(c, 'Z')).toBeNull();
  });
});

describe('allowedTiersForSlot', () => {
  it('fades rare once a rare is used elsewhere', () => {
    const c: Cipher = { trust: ['', '', ''], amplify: ['', 'X'], suspicion: [''] };
    expect(allowedTiersForSlot(en, c, 'trust', 2)).toEqual(['uncommon']);
  });

  it('keeps both tiers open when no rare is placed', () => {
    expect(allowedTiersForSlot(en, emptyCipher(), 'trust', 2)).toEqual(['uncommon', 'rare']);
  });
});

describe('cipherSignature', () => {
  it('is order-independent within a role', () => {
    const a: Cipher = { trust: ['E', 'P', 'H'], amplify: ['R', 'X'], suspicion: ['O'] };
    const b: Cipher = { trust: ['H', 'E', 'P'], amplify: ['X', 'R'], suspicion: ['O'] };
    expect(cipherSignature(a)).toBe(cipherSignature(b));
  });

  it('differs when a letter differs', () => {
    const a: Cipher = { trust: ['E', 'P', 'H'], amplify: ['R', 'X'], suspicion: ['O'] };
    const b: Cipher = { trust: ['E', 'P', 'H'], amplify: ['R', 'X'], suspicion: ['A'] };
    expect(cipherSignature(a)).not.toBe(cipherSignature(b));
  });
});
