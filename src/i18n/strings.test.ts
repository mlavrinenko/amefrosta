import { describe, it, expect } from 'vitest';
import { STRINGS } from './strings';
import { CATEGORIES, SIDES } from '../state/state';
import { SUGGESTION_REASONS } from '../engine';

/**
 * Guards the two directions the game can drift on: a phrase key used in code but
 * never defined (renders the raw key — the `suggest.why.column-full` bug), and a
 * defined phrase no code path reaches (dead weight). Both are caught here, plus
 * en/ru parity, by scanning source for every `t(...)` literal and expanding the
 * dynamic key families (`cipher.<cat>`, `side.<side>`, `suggest.why.<reason>`)
 * from the same runtime lists their types derive from.
 */

const modules = import.meta.glob('../**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

// The strings module is the definition, not a usage; test files aren't shipped.
const CODE = Object.entries(modules)
  .filter(([p]) => !/\.test\.tsx?$/.test(p) && !p.endsWith('/i18n/strings.ts'))
  .map(([, src]) => src)
  .join('\n');

const LITERAL = /'([^'\n]*)'|"([^"\n]*)"/g;
const KEYISH = (s: string) => /^[a-z][\w-]*(\.[\w-]+)+$/.test(s);

function literals(text: string): string[] {
  return [...text.matchAll(LITERAL)].map((m) => m[1] ?? m[2]);
}

/** Source of each `t(...)` argument, paren-balanced and quote-aware. */
function tCallArgs(text: string): string[] {
  const out: string[] = [];
  const re = /\bt\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    let i = m.index + m[0].length;
    const start = i;
    let depth = 1;
    let quote: string | null = null;
    for (; i < text.length && depth > 0; i++) {
      const c = text[i];
      if (quote) {
        if (c === '\\') i++;
        else if (c === quote) quote = null;
      } else if (c === '"' || c === "'" || c === '`') quote = c;
      else if (c === '(') depth++;
      else if (c === ')') depth--;
    }
    out.push(text.slice(start, i - 1));
  }
  return out;
}

const dynamicKeys = [
  ...CATEGORIES.map((c) => `cipher.${c}`),
  ...SIDES.map((s) => `side.${s}`),
  ...SUGGESTION_REASONS.map((r) => `suggest.why.${r}`),
];

const requested = new Set([
  ...tCallArgs(CODE).flatMap(literals).filter(KEYISH),
  ...dynamicKeys,
]);
const referenced = new Set([...literals(CODE).filter(KEYISH), ...dynamicKeys]);

describe('i18n strings', () => {
  it('en and ru define exactly the same keys', () => {
    expect(Object.keys(STRINGS.ru).sort()).toEqual(Object.keys(STRINGS.en).sort());
  });

  it('every key used in code is defined', () => {
    const missing = [...requested].filter((k) => !(k in STRINGS.en)).sort();
    expect(missing).toEqual([]);
  });

  it('every defined key is used somewhere', () => {
    const orphans = Object.keys(STRINGS.en)
      .filter((k) => !referenced.has(k))
      .sort();
    expect(orphans).toEqual([]);
  });
});
