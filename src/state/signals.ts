import type { Signal } from '../engine';
import type { Transmission } from './state';

/**
 * Every scored transmission as a deduction signal, whoever typed the word. The
 * Alien scores its own words AND the Scientist's, so each carries a real cipher
 * score to reason from — hypothesis accuracy must count them all, not just the
 * Alien's own transmissions.
 */
export function scoredSignals(txs: Transmission[]): Signal[] {
  return txs
    .filter((tx) => tx.value !== null)
    .map((tx) => ({ word: tx.word, value: tx.value as number }));
}
