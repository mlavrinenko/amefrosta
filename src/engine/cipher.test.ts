import { describe, it, expect } from 'vitest';
import { scoreWord, generateCipher, validateCipher } from './cipher';
import { mulberry32 } from './rng';
import type { Cipher } from './types';
import { en } from '../packs/en';
import { ru } from '../packs/ru';

const exEn: Cipher = { trust: ['E', 'P', 'H'], amplify: ['R', 'X'], suspicion: ['O'] };

describe('scoreWord — EN rulebook examples', () => {
  it('CHOPPER = -8', () => expect(scoreWord(exEn, 'CHOPPER')).toBe(-8));
  it('HORCRUXES = -16', () => expect(scoreWord(exEn, 'HORCRUXES')).toBe(-16));
  it('BORAX = 0 (negative zero normalized)', () => {
    const s = scoreWord(exEn, 'BORAX');
    expect(s).toBe(0);
    expect(Object.is(s, -0)).toBe(false);
  });
  it('is case-insensitive', () => expect(scoreWord(exEn, 'chopper')).toBe(-8));
  it('word with no cipher letters scores 0', () => expect(scoreWord(exEn, 'BID')).toBe(0));
});

const exRu: Cipher = { trust: ['О', 'Б', 'Й'], amplify: ['А', 'Х'], suspicion: ['Ь'] };

describe('scoreWord — RU rulebook examples', () => {
  it('БИОЛОГИЗИРОВАТЬ = -8', () => expect(scoreWord(exRu, 'БИОЛОГИЗИРОВАТЬ')).toBe(-8));
  it('АНАХРОННОСТЬ = -16', () => expect(scoreWord(exRu, 'АНАХРОННОСТЬ')).toBe(-16));
  it('РЫЧАТЬ = 0', () => expect(scoreWord(exRu, 'РЫЧАТЬ')).toBe(0));
});

describe('generateCipher produces legal ciphers', () => {
  for (const pack of [en, ru]) {
    it(`${pack.code}: 200 seeds all valid`, () => {
      for (let i = 1; i <= 200; i++) {
        const c = generateCipher(pack, mulberry32(i));
        expect(validateCipher(pack, c)).toEqual([]);
        expect(c.trust).toHaveLength(3);
        expect(c.amplify).toHaveLength(2);
        expect(c.suspicion).toHaveLength(1);
      }
    });
    it(`${pack.code}: deterministic for a given seed`, () => {
      expect(generateCipher(pack, mulberry32(42))).toEqual(generateCipher(pack, mulberry32(42)));
    });
  }
});

describe('validateCipher rejects illegal ciphers', () => {
  it('too many rare letters', () => {
    const bad: Cipher = { trust: ['E', 'J', 'K'], amplify: ['R', 'X'], suspicion: ['O'] };
    expect(validateCipher(en, bad)).toContain('at most 1 rare (red) letter overall');
  });
  it('trust with no common letter', () => {
    const bad: Cipher = { trust: ['B', 'C', 'D'], amplify: ['R', 'X'], suspicion: ['O'] };
    expect(validateCipher(en, bad)).toContain('trust needs exactly 1 common letter');
  });
  it('amplify with two common letters', () => {
    const bad: Cipher = { trust: ['E', 'B', 'C'], amplify: ['R', 'A'], suspicion: ['O'] };
    expect(validateCipher(en, bad)).toContain('amplify needs exactly 1 common letter');
  });
  it('duplicate letters', () => {
    const bad: Cipher = { trust: ['E', 'B', 'C'], amplify: ['R', 'X'], suspicion: ['E'] };
    expect(validateCipher(en, bad)).toContain('letters must be distinct');
  });
});

describe('validateCipher handles partial input', () => {
  it('empty cipher is valid', () => {
    const empty: Cipher = { trust: [], amplify: [], suspicion: [] };
    expect(validateCipher(en, empty)).toEqual([]);
  });
  it('partial cipher with empty slots is valid', () => {
    const partial: Cipher = { trust: ['E', '', ''], amplify: ['', ''], suspicion: [''] };
    expect(validateCipher(en, partial)).toEqual([]);
  });
  it('partial cipher with invalid letter shows error', () => {
    const partial: Cipher = { trust: ['E', '1', ''], amplify: ['', ''], suspicion: [''] };
    expect(validateCipher(en, partial)).toContain('unknown letter: 1');
  });
  it('partial cipher with duplicate letters shows error', () => {
    const partial: Cipher = { trust: ['E', 'E', ''], amplify: ['', ''], suspicion: [''] };
    expect(validateCipher(en, partial)).toContain('letters must be distinct');
  });
});
