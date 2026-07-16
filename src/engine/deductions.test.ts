import { describe, it, expect } from 'vitest';
import { en } from '../packs/en';
import {
  deduceCipher,
  suggestMoves,
  cipherMarkStatus,
  cipherConsistency,
  isCipherComplete,
  type MarkGrid,
} from './deductions';
import type { Cipher } from './types';

const noMarks = (): MarkGrid => ({ trust: {}, amplify: {}, suspicion: {} });
const confirm = (m: MarkGrid, cat: keyof MarkGrid, ...ls: string[]) => {
  for (const l of ls) m[cat][l] = { struck: false, confirmed: true };
  return m;
};

// Reference cipher (matches docs/game-model.md worked examples):
// Trust E,P,H · Amplify R,X · Suspicion O.
const cipher: Cipher = { trust: ['E', 'P', 'H'], amplify: ['R', 'X'], suspicion: ['O'] };

const keys = (m: Map<string, unknown>) => [...m.keys()].sort();

describe('deduceCipher', () => {
  it('score 0 rules the word letters out of Trust', () => {
    const d = deduceCipher(en, [{ word: 'BORAX', value: 0 }]);
    expect(keys(d.ruledOut.trust)).toEqual(['A', 'B', 'O', 'R', 'X']);
    expect(d.ruledOut.amplify.size).toBe(0); // 0 is even, says nothing about amplify
  });

  it('odd score rules the word letters out of Amplify', () => {
    const d = deduceCipher(en, [{ word: 'HEP', value: 3 }]);
    expect(keys(d.ruledOut.amplify)).toEqual(['E', 'H', 'P']);
    expect(d.ruledOut.trust.size).toBe(0); // non-zero, says nothing about trust
  });

  it('positive score rules the word letters out of Suspicion', () => {
    const d = deduceCipher(en, [{ word: 'HEP', value: 3 }]);
    expect(keys(d.ruledOut.suspicion)).toEqual(['E', 'H', 'P']);
  });

  it('even negative score gives no amplify/trust facts', () => {
    const d = deduceCipher(en, [{ word: 'CHOPPER', value: -8 }]);
    expect(d.ruledOut.trust.size).toBe(0);
    expect(d.ruledOut.amplify.size).toBe(0);
    expect(d.ruledOut.suspicion.size).toBe(0);
  });

  it('negative scores intersect to Suspicion candidates', () => {
    const d = deduceCipher(en, [
      { word: 'CHOPPER', value: -8 },
      { word: 'HORCRUXES', value: -16 },
    ]);
    expect(d.suspicionCandidates?.sort()).toEqual(['C', 'E', 'H', 'O', 'R']);
  });

  it('positive signals prune the Suspicion candidate set', () => {
    const d = deduceCipher(en, [
      { word: 'CHOPPER', value: -8 },
      { word: 'HORCRUXES', value: -16 },
      { word: 'HE', value: 2 }, // rules H, E out of suspicion
    ]);
    expect(d.suspicionCandidates?.sort()).toEqual(['C', 'O', 'R']);
    expect(d.suspicionCandidates).toContain('O'); // the real one survives
  });

  it('no negative signal leaves candidates null', () => {
    const d = deduceCipher(en, [{ word: 'HEP', value: 3 }]);
    expect(d.suspicionCandidates).toBeNull();
  });

  it('records the source signal for each ruled-out letter', () => {
    const d = deduceCipher(en, [{ word: 'BORAX', value: 0 }]);
    expect(d.ruledOut.trust.get('O')).toEqual([{ rule: 'trust-zero', word: 'BORAX', value: 0 }]);
  });

  it('positive score marks the word letters as Trust candidates', () => {
    const d = deduceCipher(en, [{ word: 'HEP', value: 1 }]);
    expect(d.trustCandidates?.sort()).toEqual(['E', 'H', 'P']);
  });

  it('a later zero score drops those letters from Trust candidates', () => {
    const d = deduceCipher(en, [
      { word: 'HEP', value: 1 }, // H, E, P are possible Trust
      { word: 'HE', value: 0 }, // ...but H, E hold no Trust letter
    ]);
    expect(d.trustCandidates).toEqual(['P']);
  });

  it('no positive signal leaves Trust candidates null', () => {
    const d = deduceCipher(en, [{ word: 'BORAX', value: 0 }]);
    expect(d.trustCandidates).toBeNull();
  });
});

describe('suggestMoves', () => {
  it('confirms the Suspicion letter once negatives narrow it to one', () => {
    const ded = deduceCipher(en, [
      { word: 'CHOPPER', value: -8 },
      { word: 'HORCRUXES', value: -16 },
      { word: 'HE', value: 2 }, // rules H, E out of suspicion
      { word: 'CAR', value: 2 }, // rules C, A, R out of suspicion
    ]);
    expect(ded.suspicionCandidates).toEqual(['O']);
    const adv = suggestMoves(en, ded, noMarks());
    const s = adv.suggestions.find((x) => x.category === 'suspicion' && x.kind === 'confirm');
    expect(s?.letters).toEqual(['O']);
    expect(s?.reason).toBe('suspicion-unique');
  });

  it('strikes the rest of a role once it is full', () => {
    const ded = deduceCipher(en, []);
    const adv = suggestMoves(en, ded, confirm(noMarks(), 'trust', 'E', 'P', 'H'));
    const s = adv.suggestions.find((x) => x.category === 'trust' && x.kind === 'strike');
    expect(s?.reason).toBe('column-full');
    expect(s?.letters).toHaveLength(en.alphabet.length - 3);
    expect(s?.letters).not.toContain('E');
  });

  it('confirms the remaining candidates when only budget-many stay open', () => {
    // Strike every trust letter except E, P, H manually -> the three are forced.
    const marks = noMarks();
    for (const l of en.alphabet) {
      if (!['E', 'P', 'H'].includes(l)) marks.trust[l] = { struck: true, confirmed: false };
    }
    const adv = suggestMoves(en, deduceCipher(en, []), marks);
    const s = adv.suggestions.find((x) => x.category === 'trust' && x.kind === 'confirm');
    expect(s?.letters).toEqual(['E', 'H', 'P']);
    expect(s?.reason).toBe('column-forced');
  });

  it('warns when a role has more confirmed letters than it can hold', () => {
    const adv = suggestMoves(en, deduceCipher(en, []), confirm(noMarks(), 'amplify', 'A', 'B', 'C'));
    expect(adv.warnings.some((w) => w.category === 'amplify' && w.reason === 'overfull')).toBe(true);
  });

  it('offers nothing on a blank grid with no signals', () => {
    const adv = suggestMoves(en, deduceCipher(en, []), noMarks());
    expect(adv.suggestions).toEqual([]);
    expect(adv.warnings).toEqual([]);
  });

  it('offers to strike letters a 0-score word rules out of Trust', () => {
    const ded = deduceCipher(en, [{ word: 'BORAX', value: 0 }]);
    const adv = suggestMoves(en, ded, noMarks());
    const s = adv.suggestions.find((x) => x.category === 'trust' && x.reason === 'ruled-out');
    expect(s?.kind).toBe('strike');
    expect(s?.letters).toEqual(['A', 'B', 'O', 'R', 'X']);
  });

  it('offers to strike letters an odd score rules out of Amplify', () => {
    const ded = deduceCipher(en, [{ word: 'HEP', value: 3 }]);
    const adv = suggestMoves(en, ded, noMarks());
    const s = adv.suggestions.find((x) => x.category === 'amplify' && x.reason === 'ruled-out');
    expect(s?.kind).toBe('strike');
    expect(s?.letters).toEqual(['E', 'H', 'P']);
  });

  it('offers to strike letters a positive score rules out of Suspicion', () => {
    const ded = deduceCipher(en, [{ word: 'HEP', value: 3 }]);
    const adv = suggestMoves(en, ded, noMarks());
    const s = adv.suggestions.find((x) => x.category === 'suspicion' && x.reason === 'ruled-out');
    expect(s?.kind).toBe('strike');
    expect(s?.letters).toEqual(['E', 'H', 'P']);
  });

  it('drops already-struck letters from the ruled-out Trust strike', () => {
    const marks = noMarks();
    marks.trust.B = { struck: true, confirmed: false };
    const ded = deduceCipher(en, [{ word: 'BORAX', value: 0 }]);
    const s = suggestMoves(en, ded, marks).suggestions.find((x) => x.reason === 'ruled-out');
    expect(s?.letters).toEqual(['A', 'O', 'R', 'X']);
  });

  it('forces a Trust letter when a scored word has one un-eliminated letter', () => {
    const marks = noMarks();
    marks.trust.B = { struck: true, confirmed: false }; // B out of Trust
    const signals = [{ word: 'AB', value: 1 }];
    const adv = suggestMoves(en, deduceCipher(en, signals), marks, signals);
    const s = adv.suggestions.find((x) => x.reason === 'trust-forced');
    expect(s?.category).toBe('trust');
    expect(s?.letters).toEqual(['A']);
  });
});

describe('cipherMarkStatus', () => {
  const cipher: Cipher = { trust: ['E', 'P', 'H'], amplify: ['R', 'X'], suspicion: ['O'] };

  it('is valid with no conflicting marks', () => {
    expect(cipherMarkStatus(cipher, noMarks()).invalid).toBe(false);
  });

  it('flags a slot that uses a struck letter', () => {
    const m = noMarks();
    m.trust.E = { struck: true, confirmed: false };
    const st = cipherMarkStatus(cipher, m);
    expect(st.slots.trust[0]).toBe('ruled');
    expect(st.invalid).toBe(true);
  });

  it('flags a letter confirmed in another role', () => {
    const m = noMarks();
    m.suspicion.E = { struck: false, confirmed: true }; // E is Suspicion, not Trust
    const st = cipherMarkStatus(cipher, m);
    expect(st.slots.trust[0]).toBe('wrong');
    expect(st.invalid).toBe(true);
  });

  it('is invalid when a confirmed letter is absent from its role', () => {
    const m = noMarks();
    m.trust.Q = { struck: false, confirmed: true }; // Q must be Trust; cipher lacks it
    expect(cipherMarkStatus(cipher, m).invalid).toBe(true);
  });
});

describe('cipherConsistency', () => {
  const signals = [
    { word: 'CHOPPER', value: -8 },
    { word: 'HORCRUXES', value: -16 },
    { word: 'BORAX', value: 0 },
  ];

  it('counts all matches for the true cipher', () => {
    expect(cipherConsistency(cipher, signals)).toEqual({ matches: 3, total: 3 });
  });

  it('counts fewer matches for a wrong cipher', () => {
    const wrong: Cipher = { trust: ['A', 'B', 'C'], amplify: ['D', 'F'], suspicion: ['G'] };
    expect(cipherConsistency(wrong, signals).matches).toBeLessThan(3);
  });
});

describe('isCipherComplete', () => {
  it('true when all six slots filled', () => {
    expect(isCipherComplete(cipher)).toBe(true);
  });
  it('false when a slot is blank', () => {
    expect(isCipherComplete({ trust: ['E', '', 'H'], amplify: ['R', 'X'], suspicion: ['O'] })).toBe(false);
  });
});
