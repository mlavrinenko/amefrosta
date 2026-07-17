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

/**
 * Distinct uppercase letters that appear in the Alien's transmitted words. Both
 * sides highlight these: the Alien tracks the letters it has already spent, the
 * Scientist sees which cipher letters the Alien's words actually exercise.
 */
export function alienWordLetters(txs: Transmission[]): Set<string> {
  const s = new Set<string>();
  for (const tx of txs) {
    if (tx.from !== 'alien') continue;
    for (const ch of tx.word.toUpperCase()) s.add(ch);
  }
  return s;
}
