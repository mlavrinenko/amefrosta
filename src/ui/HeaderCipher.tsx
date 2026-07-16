import { useI18n } from '../i18n';
import { emptyCipher, SLOT_COUNT } from '../engine';
import { CATEGORIES, type Category } from '../state/state';
import type { GameApi } from '../state/useGame';
import { TierGlyph } from './TierGlyph';
import { Icon } from './icons/Icon';

/** Always-visible cipher strip in the header. Tap to open the editor sheet. */
export function HeaderCipher({ game, onOpen }: { game: GameApi; onOpen: () => void }) {
  const { t, pack } = useI18n();
  const cipher = game.state.cipher ?? emptyCipher();

  return (
    <button type="button" className="cipher-strip" onClick={onOpen} title={t('cipher.edit')}>
      {CATEGORIES.map((cat: Category) => (
        <span key={cat} className={`strip-group cat-${cat}`}>
          <Icon name={cat} size={14} className="strip-cat-icon" />
          {Array.from({ length: SLOT_COUNT[cat] }).map((_, i) => {
            const l = (cipher[cat][i] ?? '').toUpperCase();
            const tier = l ? pack.tiers[l] : undefined;
            return (
              <span key={i} className={`strip-slot${tier ? ` tier-${tier}` : ' empty'}`}>
                {l || '·'}
                {tier && <TierGlyph tier={tier} />}
              </span>
            );
          })}
        </span>
      ))}
    </button>
  );
}
