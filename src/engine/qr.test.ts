import { describe, it, expect } from 'vitest';
import { encodeTx, parseImport, isSignalQr } from './qr';

describe('transmission encode', () => {
  it('encodes a scored word with the AMFS sentinel', () => {
    expect(encodeTx({ w: 'stars', s: 4 })).toBe('AMFS STARS 4');
  });

  it('encodes a negative score', () => {
    expect(encodeTx({ w: 'NOVA', s: -8 })).toBe('AMFS NOVA -8');
  });

  it('omits the value when the score is unknown', () => {
    expect(encodeTx({ w: 'MOVIES', s: null })).toBe('AMFS MOVIES');
  });

  it('round-trips through parseImport', () => {
    expect(parseImport(encodeTx({ w: 'СЛОНЫ', s: -8 }))).toEqual({ w: 'СЛОНЫ', s: -8 });
    expect(parseImport(encodeTx({ w: 'MOVIES', s: null }))).toEqual({ w: 'MOVIES', s: null });
  });
});

describe('isSignalQr', () => {
  it('accepts our QR payload', () => expect(isSignalQr('AMFS STARS 4')).toBe(true));
  it('is case-insensitive and whitespace-tolerant', () =>
    expect(isSignalQr('  amfs stars 4 ')).toBe(true));
  it('rejects a foreign QR (URL)', () =>
    expect(isSignalQr('https://example.com')).toBe(false));
  it('rejects a bare word that only starts like the sentinel', () =>
    expect(isSignalQr('AMFSTAR')).toBe(false));
});

describe('parseImport', () => {
  it('parses the QR form with sentinel', () => {
    expect(parseImport('AMFS STARS 4')).toEqual({ w: 'STARS', s: 4 });
  });

  it('parses the bare "WORD value" shorthand a human types', () => {
    expect(parseImport('STARS 4')).toEqual({ w: 'STARS', s: 4 });
  });

  it('parses a negative score', () => {
    expect(parseImport('NOVA -8')).toEqual({ w: 'NOVA', s: -8 });
  });

  it('parses a signed positive score', () => {
    expect(parseImport('NOVA +2')).toEqual({ w: 'NOVA', s: 2 });
  });

  it('treats a bare word as an unknown score', () => {
    expect(parseImport('MOVIES')).toEqual({ w: 'MOVIES', s: null });
  });

  it('treats a trailing ? as an unknown score', () => {
    expect(parseImport('MOVIES ?')).toEqual({ w: 'MOVIES', s: null });
  });

  it('strips the sentinel from a bare-word payload', () => {
    expect(parseImport('AMFS MOVIES')).toEqual({ w: 'MOVIES', s: null });
  });

  it('tolerates surrounding and inner whitespace', () => {
    expect(parseImport('  STARS   4  ')).toEqual({ w: 'STARS', s: 4 });
  });

  it('keeps a multi-word phrase when there is no numeric trailer', () => {
    expect(parseImport('MILKY WAY')).toEqual({ w: 'MILKY WAY', s: null });
  });

  it('splits the numeric trailer off a multi-word phrase', () => {
    expect(parseImport('MILKY WAY 3')).toEqual({ w: 'MILKY WAY', s: 3 });
  });

  it('rejects empty input', () => expect(() => parseImport('   ')).toThrow());
  it('rejects a bare sentinel with no word', () =>
    expect(() => parseImport('AMFS')).toThrow());
});
