import { describe, it, expect } from 'vitest';
import { en } from '../packs/en';
import {
  emptyCipher,
  slotAllowed,
  legalLettersForSlot,
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
