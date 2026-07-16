import type { Tier } from '../engine/types';

/** Colorblind-safe shape per tier (never color-only): common ●, uncommon ◆, rare ▲. */
export const TIER_GLYPH: Record<Tier, string> = {
  common: '●', // ●
  uncommon: '◆', // ◆
  rare: '▲', // ▲
};

export function TierGlyph({ tier, faded }: { tier: Tier; faded?: boolean }) {
  return (
    <span className={`tier-glyph tier-${tier}${faded ? ' faded' : ''}`} aria-hidden>
      {TIER_GLYPH[tier]}
    </span>
  );
}
