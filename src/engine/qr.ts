/**
 * A transmission encodes as human-readable text, not JSON:
 *   `AMFS WORD value`   e.g. `AMFS STARS 4`, `AMFS NOVA -8`
 *   `AMFS WORD`         value unknown (scientist -> alien, no score)
 * The `AMFS` sentinel ("A Message From The Stars") lets the camera reject
 * foreign QR codes; a human typing into the paste box may omit it.
 */
const PREFIX = 'AMFS';

/** A parsed transmission: the word and its score (null when unknown). */
export interface TxParse {
  w: string;
  s: number | null;
}

export function encodeTx(p: TxParse): string {
  const word = p.w.trim().toUpperCase();
  return p.s === null ? `${PREFIX} ${word}` : `${PREFIX} ${word} ${p.s}`;
}

/** True when a scanned string is one of our transmission QR codes. */
export function isSignalQr(raw: string): boolean {
  return new RegExp(`^${PREFIX}\\b`, 'i').test(raw.trim());
}

/**
 * Parse the Import / Scan box. Accepts the QR form (`AMFS WORD value`) and the
 * bare human shorthand (`WORD value`). The value is optional: a trailing `?` or
 * no trailing number means unknown.
 */
export function parseImport(raw: string): TxParse {
  const stripped = raw.trim().replace(new RegExp(`^${PREFIX}\\b\\s*`, 'i'), '');
  const parts = stripped.split(/\s+/).filter(Boolean);
  const last = parts[parts.length - 1];
  let s: number | null = null;
  let wordParts = parts;
  if (parts.length >= 2 && (last === '?' || /^[+-]?\d+$/.test(last))) {
    s = last === '?' ? null : Number(last);
    wordParts = parts.slice(0, -1);
  }
  const w = wordParts.join(' ');
  if (!w) throw new Error('word is required');
  return { w, s };
}
