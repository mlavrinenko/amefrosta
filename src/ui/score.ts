/** Human-readable cipher score: `+N`, `N`, or `?` for unknown. */
export function formatScore(v: number | null): string {
  if (v === null) return '?';
  return v > 0 ? `+${v}` : String(v);
}

/** What a score reveals about the cipher, per the rulebook deduction tips. */
export function scoreMeaning(v: number, t: (k: string) => string): string {
  if (v === 0) return t('tx.meanZero');
  const parts: string[] = [];
  if (Math.abs(v) % 2 === 1) parts.push(t('tx.meanOdd'));
  parts.push(v < 0 ? t('tx.meanNeg') : t('tx.meanPos'));
  return parts.join('; ');
}
