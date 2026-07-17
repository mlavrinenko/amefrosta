import type { Cipher } from '../engine/types';
import type { PackCode } from '../packs';

export type Side = 'alien' | 'scientist';
export const SIDES: Side[] = ['alien', 'scientist'];
export type Category = 'trust' | 'amplify' | 'suspicion';
export const CATEGORIES: Category[] = ['trust', 'amplify', 'suspicion'];

export interface Mark {
  /** Ruled out of this role (tap). */
  struck: boolean;
  /** This letter IS this role (long-press). Overrides struck for display. */
  confirmed: boolean;
}
export type Grid = Record<string, Mark>;
export type Terminal = Record<Category, Grid>;

export interface Transmission {
  id: string;
  word: string;
  value: number | null;
  from: Side;
  at: number;
}

/** How the Terminal orders its letter rows. */
export type TerminalSort = 'alpha' | 'used' | 'freq';
export const TERMINAL_SORTS: TerminalSort[] = ['alpha', 'used', 'freq'];

/** Persisted UI preferences (survive tab switches and reloads). */
export interface Prefs {
  /** Show the one-line instruction tip on the Terminal. */
  showTips: boolean;
  /** Show the deduction suggestion panel on the Terminal. */
  showHints: boolean;
  /** Terminal row order: alphabetical, used-first, or by frequency. */
  terminalSort: TerminalSort;
}

export const defaultPrefs = (): Prefs => ({
  showTips: true,
  showHints: true,
  terminalSort: 'alpha',
});

export interface GameState {
  version: 5;
  lang: PackCode;
  side: Side;
  message: { dice: [number, number, number] | null; words: [string, string, string] };
  cipher: Cipher | null;
  /** Scientist's saved cipher hypotheses (complete + valid snapshots). */
  cipherArchive: Cipher[];
  terminal: Terminal;
  /** Letters the player folded away in the Terminal (only hidden while junk). */
  hiddenLetters: string[];
  prefs: Prefs;
  notes: string;
  transmissions: Transmission[];
}

export const emptyTerminal = (): Terminal => ({ trust: {}, amplify: {}, suspicion: {} });

/** Coerce any stored mark (incl. legacy `{struck,dot}`) to the current shape. */
const normalizeMark = (m: unknown): Mark => {
  const o = (m ?? {}) as Record<string, unknown>;
  return { struck: !!o.struck, confirmed: !!o.confirmed };
};

const normalizeTerminal = (t: Partial<Terminal> | undefined): Terminal => {
  const base = emptyTerminal();
  for (const cat of CATEGORIES) {
    const grid = t?.[cat];
    if (!grid) continue;
    for (const [letter, mark] of Object.entries(grid)) base[cat][letter] = normalizeMark(mark);
  }
  return base;
};

export function defaultState(): GameState {
  return {
    version: 5,
    lang: 'en',
    side: 'alien',
    message: { dice: null, words: ['', '', ''] },
    cipher: null,
    cipherArchive: [],
    terminal: emptyTerminal(),
    hiddenLetters: [],
    prefs: defaultPrefs(),
    notes: '',
    transmissions: [],
  };
}

const KEY = 'amefrosta:game:v1';

/** Older transmissions carried a `round`; strip it. */
type LegacyTx = Transmission & { round?: number };

const keepTx = (t: LegacyTx): Transmission => ({
  id: t.id,
  word: t.word,
  value: t.value,
  from: t.from,
  at: t.at,
});

interface Legacy {
  version?: number;
  transmissions?: LegacyTx[];
  terminal?: Terminal;
  prefs?: Partial<Prefs>;
  [k: string]: unknown;
}

export function loadState(): GameState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Legacy;
    // v1..v5 share the fields we still use; `round`/`rounds` are gone, the
    // terminal mark shape changed to `{struck,confirmed}`, and `prefs` was added.
    if (![1, 2, 3, 4, 5].includes(parsed?.version ?? 0)) {
      return defaultState();
    }
    return {
      ...defaultState(),
      ...(parsed as unknown as Partial<GameState>),
      version: 5,
      cipherArchive: Array.isArray(parsed.cipherArchive) ? (parsed.cipherArchive as Cipher[]) : [],
      terminal: normalizeTerminal(parsed.terminal),
      hiddenLetters: Array.isArray(parsed.hiddenLetters)
        ? (parsed.hiddenLetters as string[])
        : [],
      prefs: { ...defaultPrefs(), ...parsed.prefs },
      transmissions: (parsed.transmissions ?? []).map(keepTx),
    };
  } catch {
    return defaultState();
  }
}

export function saveState(s: GameState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore quota / private mode */
  }
}
