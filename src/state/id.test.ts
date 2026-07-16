import { describe, it, expect, afterEach } from 'vitest';
import { newId } from './id';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const realCrypto = globalThis.crypto;

afterEach(() => {
  Object.defineProperty(globalThis, 'crypto', {
    value: realCrypto,
    configurable: true,
  });
});

describe('newId', () => {
  it('uses crypto.randomUUID when available', () => {
    expect(newId()).toMatch(UUID_RE);
  });

  it('falls back to getRandomValues in non-secure contexts', () => {
    // Simulate LAN-over-HTTP: randomUUID missing, getRandomValues present.
    Object.defineProperty(globalThis, 'crypto', {
      value: { getRandomValues: realCrypto.getRandomValues.bind(realCrypto) },
      configurable: true,
    });
    expect(newId()).toMatch(UUID_RE);
  });

  it('falls back to Math.random when crypto is unavailable', () => {
    Object.defineProperty(globalThis, 'crypto', {
      value: undefined,
      configurable: true,
    });
    const a = newId();
    const b = newId();
    expect(a).toMatch(UUID_RE);
    expect(a).not.toBe(b);
  });
});
