import type { Category, Cipher, LanguagePack } from './types';
import { scoreWord } from './cipher';

/**
 * Deduction facts a Scientist can derive with certainty from the Alien's scored
 * signals (word + cipher score). Each rules a letter out of a cipher role:
 *   trust-zero:         score 0    => the word has no Trust letters.
 *   amplify-odd:        |score| odd => the word has no Amplify letters.
 *   suspicion-positive: score > 0  => the Suspicion letter is not in the word.
 * A score < 0 instead means the Suspicion letter IS one of the word's letters;
 * across all negative signals it lies in their intersection (`suspicionCandidates`).
 */
export type DeductionRule = 'trust-zero' | 'amplify-odd' | 'suspicion-positive';

export interface Signal {
  word: string;
  value: number;
}

export interface RuledOut {
  rule: DeductionRule;
  word: string;
  value: number;
}

export interface Deductions {
  /** category -> letter -> the signals that rule it out of that role */
  ruledOut: Record<Category, Map<string, RuledOut[]>>;
  /** Suspicion letter is one of these; null until a negative signal is seen. */
  suspicionCandidates: string[] | null;
  /**
   * Letters that could still be Trust with positive evidence: every letter seen
   * in a word scoring > 0 (such a word holds >=1 Trust letter), minus those a
   * zero-score word already ruled out. A hint, not a certainty — null until a
   * positive signal is seen.
   */
  trustCandidates: string[] | null;
}

const upper = (s: string) => s.toUpperCase();

function distinctLetters(pack: LanguagePack, word: string): string[] {
  const alpha = new Set(pack.alphabet.map(upper));
  const out = new Set<string>();
  for (const ch of upper(word)) if (alpha.has(ch)) out.add(ch);
  return [...out];
}

export function deduceCipher(pack: LanguagePack, signals: Signal[]): Deductions {
  const ruledOut: Record<Category, Map<string, RuledOut[]>> = {
    trust: new Map(),
    amplify: new Map(),
    suspicion: new Map(),
  };
  const add = (cat: Category, letter: string, mark: RuledOut) => {
    const list = ruledOut[cat].get(letter) ?? [];
    list.push(mark);
    ruledOut[cat].set(letter, list);
  };

  const negLetterSets: string[][] = [];
  const trustPos = new Set<string>();

  for (const sig of signals) {
    const letters = distinctLetters(pack, sig.word);
    if (letters.length === 0) continue;
    const v = sig.value;
    const w = upper(sig.word);

    if (v === 0) {
      for (const l of letters) add('trust', l, { rule: 'trust-zero', word: w, value: v });
    }
    if (Math.abs(v) % 2 === 1) {
      for (const l of letters) add('amplify', l, { rule: 'amplify-odd', word: w, value: v });
    }
    if (v > 0) {
      for (const l of letters) {
        add('suspicion', l, { rule: 'suspicion-positive', word: w, value: v });
        trustPos.add(l);
      }
    } else if (v < 0) {
      negLetterSets.push(letters);
    }
  }

  let suspicionCandidates: string[] | null = null;
  if (negLetterSets.length > 0) {
    let inter = new Set(negLetterSets[0]);
    for (let i = 1; i < negLetterSets.length; i++) {
      const s = new Set(negLetterSets[i]);
      inter = new Set([...inter].filter((l) => s.has(l)));
    }
    suspicionCandidates = [...inter].filter((l) => !ruledOut.suspicion.has(l));
  }

  let trustCandidates: string[] | null = null;
  if (trustPos.size > 0) {
    trustCandidates = [...trustPos].filter((l) => !ruledOut.trust.has(l));
  }

  return { ruledOut, suspicionCandidates, trustCandidates };
}

// --- Suggested moves ---------------------------------------------------------

const CATS: Category[] = ['trust', 'amplify', 'suspicion'];

/** How many letters each role holds in a complete cipher. */
export const ROLE_BUDGET: Record<Category, number> = { trust: 3, amplify: 2, suspicion: 1 };

/** One deduction cell as tracked on the Terminal grid. */
export interface CellMark {
  struck: boolean;
  confirmed: boolean;
}
export type MarkGrid = Record<Category, Record<string, CellMark>>;

/**
 * Runtime lists so callers (and the i18n coverage test) can enumerate every
 * reason; the string-union types are derived from them and stay in lockstep.
 * Each value maps to a `suggest.why.<reason>` phrase key.
 */
export const SUGGESTION_REASONS = [
  'suspicion-unique',
  'column-forced',
  'column-full',
  'trust-forced',
  'ruled-out',
] as const;
export type SuggestionReason = (typeof SUGGESTION_REASONS)[number];

export const WARNING_REASONS = ['overfull', 'impossible'] as const;
export type WarningReason = (typeof WARNING_REASONS)[number];

export interface Suggestion {
  /** Stable across renders while the same move is offered. */
  id: string;
  kind: 'confirm' | 'strike';
  category: Category;
  letters: string[];
  reason: SuggestionReason;
}

export interface Warning {
  id: string;
  category: Category;
  reason: WarningReason;
}

export interface Advice {
  suggestions: Suggestion[];
  warnings: Warning[];
}

const has = (grid: Record<string, CellMark>, l: string) => grid[l];

/**
 * Forced, always-correct moves derivable from the current marks plus the certain
 * facts in `ded`. Each is offered as an opt-in card; nothing is auto-applied.
 * Recompute on every state change — a move that no longer holds simply drops out.
 */
export function suggestMoves(
  pack: LanguagePack,
  ded: Deductions,
  marks: MarkGrid,
  signals: Signal[] = [],
): Advice {
  const alpha = pack.alphabet.map(upper);
  const suggestions: Suggestion[] = [];
  const warnings: Warning[] = [];

  const confirmedRole = (l: string): Category | null =>
    CATS.find((c) => has(marks[c], l)?.confirmed) ?? null;

  // A letter is "known out" of a role when: struck; ruled out by a signal;
  // (suspicion) outside the negative-word intersection; or confirmed elsewhere.
  const excluded = (cat: Category, l: string): boolean => {
    const m = has(marks[cat], l);
    if (m?.confirmed) return false;
    if (m?.struck) return true;
    const role = confirmedRole(l);
    if (role && role !== cat) return true;
    if (ded.ruledOut[cat].has(l)) return true;
    if (cat === 'suspicion' && ded.suspicionCandidates && !ded.suspicionCandidates.includes(l)) {
      return true;
    }
    return false;
  };

  for (const cat of CATS) {
    const budget = ROLE_BUDGET[cat];
    const confirmed = alpha.filter((l) => has(marks[cat], l)?.confirmed);
    const remaining = budget - confirmed.length;
    // Letters that could still take this role.
    const open = alpha.filter((l) => !has(marks[cat], l)?.confirmed && !excluded(cat, l));

    if (confirmed.length > budget) {
      warnings.push({ id: `warn:overfull:${cat}`, category: cat, reason: 'overfull' });
    } else if (confirmed.length + open.length < budget) {
      warnings.push({ id: `warn:impossible:${cat}`, category: cat, reason: 'impossible' });
    }

    // Exactly as many candidates as open slots -> they must all fill the role.
    if (remaining > 0 && open.length === remaining) {
      const letters = [...open].sort();
      const reason: SuggestionReason = cat === 'suspicion' ? 'suspicion-unique' : 'column-forced';
      suggestions.push({
        id: `confirm:${cat}:${letters.join('')}`,
        kind: 'confirm',
        category: cat,
        letters,
        reason,
      });
    }

    // Role already full -> every remaining candidate is ruled out of it.
    if (confirmed.length === budget && open.length > 0) {
      const letters = [...open].sort();
      suggestions.push({
        id: `strike:${cat}:${letters.join('')}`,
        kind: 'strike',
        category: cat,
        letters,
        reason: 'column-full',
      });
    }
  }

  // A signal can rule a letter out of a role for certain (trust-zero,
  // amplify-odd, suspicion-positive). Offer to strike the ones still open, as
  // an opt-in card (the faint `ruled` cell already hints at each).
  for (const cat of CATS) {
    const letters = [...ded.ruledOut[cat].keys()]
      .filter(
        (l) => !has(marks[cat], l)?.struck && !has(marks[cat], l)?.confirmed && !confirmedRole(l),
      )
      .sort();
    if (letters.length > 0) {
      suggestions.push({
        id: `strike:ruled:${cat}:${letters.join('')}`,
        kind: 'strike',
        category: cat,
        letters,
        reason: 'ruled-out',
      });
    }
  }

  // Forced Trust (naked single): a word scoring non-zero holds >=1 Trust letter;
  // if all but one of its letters are already out of Trust, that one is Trust.
  const trustConfirmed = alpha.filter((l) => has(marks.trust, l)?.confirmed);
  if (trustConfirmed.length < ROLE_BUDGET.trust) {
    const forced = new Set<string>();
    for (const sig of signals) {
      if (sig.value === 0) continue;
      const open = distinctLetters(pack, sig.word).filter(
        (l) => !has(marks.trust, l)?.confirmed && !excluded('trust', l),
      );
      if (open.length === 1) forced.add(open[0]);
    }
    for (const l of forced) {
      suggestions.push({
        id: `confirm:trust:forced:${l}`,
        kind: 'confirm',
        category: 'trust',
        letters: [l],
        reason: 'trust-forced',
      });
    }
  }

  // Confirms first (they collapse the most), then strikes.
  suggestions.sort((a, b) =>
    a.kind === b.kind ? 0 : a.kind === 'confirm' ? -1 : 1,
  );
  return { suggestions, warnings };
}

export type SlotMark = 'ok' | 'ruled' | 'wrong' | 'confirmed';

export interface CipherMarkStatus {
  /** Per-slot verdict against the Terminal marks, in cipher-array order. */
  slots: Record<Category, SlotMark[]>;
  /** True when the cipher contradicts a Terminal mark (safe to discard). */
  invalid: boolean;
}

/**
 * Cross-check a hypothesis against the Scientist's Terminal marks: a slot is
 * `ruled` (uses a struck letter), `wrong` (uses a letter confirmed in another
 * role), `confirmed` (matches a confirmed letter), or `ok`. A cipher is invalid
 * if any slot is ruled/wrong, or it omits a letter confirmed for that role.
 */
export function cipherMarkStatus(cipher: Cipher, marks: MarkGrid): CipherMarkStatus {
  const confirmedRole = (l: string): Category | null =>
    CATS.find((c) => marks[c][l]?.confirmed) ?? null;
  const slots = { trust: [], amplify: [], suspicion: [] } as Record<Category, SlotMark[]>;
  let invalid = false;

  for (const cat of CATS) {
    slots[cat] = cipher[cat].map((raw) => {
      const l = (raw ?? '').toUpperCase();
      if (!l) return 'ok';
      if (marks[cat][l]?.confirmed) return 'confirmed';
      const role = confirmedRole(l);
      if (role && role !== cat) {
        invalid = true;
        return 'wrong';
      }
      if (marks[cat][l]?.struck) {
        invalid = true;
        return 'ruled';
      }
      return 'ok';
    });
  }

  // A letter confirmed for a role must appear in that role.
  for (const cat of CATS) {
    const placed = new Set(cipher[cat].map((l) => (l ?? '').toUpperCase()));
    for (const [l, m] of Object.entries(marks[cat])) {
      if (m?.confirmed && !placed.has(l)) invalid = true;
    }
  }

  return { slots, invalid };
}

export function isCipherComplete(cipher: Cipher): boolean {
  return (
    cipher.trust.filter((l) => l.length > 0).length === 3 &&
    cipher.amplify.filter((l) => l.length > 0).length === 2 &&
    cipher.suspicion.filter((l) => l.length > 0).length === 1
  );
}

export interface Consistency {
  matches: number;
  total: number;
}

/** How many signals a candidate cipher reproduces (word re-scores to its value). */
export function cipherConsistency(cipher: Cipher, signals: Signal[]): Consistency {
  let matches = 0;
  for (const sig of signals) {
    if (scoreWord(cipher, sig.word) === sig.value) matches++;
  }
  return { matches, total: signals.length };
}
