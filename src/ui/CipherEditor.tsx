import { useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import {
  SLOT_COUNT,
  allowedTiersForSlot,
  emptyCipher,
  generateCipher,
  legalLettersForSlot,
  slotAllowed,
  validateCipher,
} from '../engine';
import type { Cipher, Tier } from '../engine/types';
import { CATEGORIES, type Category } from '../state/state';
import type { GameApi } from '../state/useGame';
import { TierGlyph } from './TierGlyph';
import { Icon } from './icons/Icon';

const ALL_TIERS: Tier[] = ['common', 'uncommon', 'rare'];

/** Constrained cipher editor: 6 tier-aware slots + a filtered letter picker. */
export function CipherEditor({ game }: { game: GameApi }) {
  const { t, pack } = useI18n();
  const { state, update } = game;
  const isScientist = state.side === 'scientist';
  const cipher = state.cipher ?? emptyCipher();
  const [sel, setSel] = useState<{ cat: Category; i: number } | null>(null);

  const errors = useMemo(() => validateCipher(pack, cipher), [pack, cipher]);
  const groupHasError = (cat: Category) =>
    errors.some((e) => e.startsWith(cat) || e.startsWith('letters') || e.startsWith('at most'));

  // Terminal marks steer the picker: confirmed = highlight, struck/elsewhere = flag.
  const confirmedRole = (L: string): Category | null =>
    CATEGORIES.find((c) => state.terminal[c][L]?.confirmed) ?? null;

  const setSlot = (cat: Category, i: number, letter: string) =>
    update((s) => {
      const base: Cipher = s.cipher ?? emptyCipher();
      const next: Cipher = {
        trust: [...base.trust],
        amplify: [...base.amplify],
        suspicion: [...base.suspicion],
      };
      next[cat][i] = letter;
      return { ...s, cipher: next };
    });

  const generate = () => {
    update((s) => ({ ...s, cipher: generateCipher(pack, Math.random) }));
    setSel(null);
  };

  const legalSet = new Set(sel ? legalLettersForSlot(pack, cipher, sel.cat, sel.i) : []);

  return (
    <div className="cipher-editor">
      {/* Regenerate is an Alien setup convenience; the Scientist builds by hand. */}
      {!isScientist && (
        <div className="row">
          <button type="button" className="primary" onClick={generate}>
            {state.cipher ? t('cipher.regenerate') : t('cipher.generate')}
          </button>
        </div>
      )}

      <div className="editor-groups">
        {CATEGORIES.map((cat) => (
          <div key={cat} className={`editor-group${groupHasError(cat) ? ' cipher-error' : ''}`}>
            <span className={`editor-label cat-${cat}`}>
              <Icon name={cat} size={15} className={`editor-label-icon`} />
              <span className={`editor-label-text`}>{t(`cipher.${cat}`)}</span>
            </span>
            <div className="editor-slots">
              {Array.from({ length: SLOT_COUNT[cat] }).map((_, i) => {
                const l = (cipher[cat][i] ?? '').toUpperCase();
                const tier = l ? pack.tiers[l] : undefined;
                const active = sel?.cat === cat && sel?.i === i;
                const possible = allowedTiersForSlot(pack, cipher, cat, i);
                const everAllowed = slotAllowed(cat, i);
                return (
                  <button
                    key={i}
                    type="button"
                    className={`slot${active ? ' active' : ''}${tier ? ` tier-${tier}` : ' empty'}`}
                    onClick={() => setSel(active ? null : { cat, i })}
                  >
                    {l ? (
                      <>
                        <span className="slot-letter">{l}</span>
                        {tier && <TierGlyph tier={tier} />}
                      </>
                    ) : (
                      <span className="slot-hint">
                        {ALL_TIERS.filter((tr) => everAllowed.includes(tr)).map((tr) => (
                          <TierGlyph key={tr} tier={tr} faded={!possible.includes(tr)} />
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {sel && (
        <div className="picker">
          <div className="picker-head">
            <span className="muted small">{t('cipher.pick')}</span>
            <button
              type="button"
              className="link"
              onClick={() => {
                setSlot(sel.cat, sel.i, '');
                setSel(null);
              }}
            >
              {t('cipher.clearSlot')}
            </button>
          </div>
          <div className="picker-grid">
            {pack.alphabet.map((letter) => {
              const tier = pack.tiers[letter];
              const ok = legalSet.has(letter);
              const role = confirmedRole(letter);
              const tConfirm = role === sel.cat;
              const tRuled = !!state.terminal[sel.cat][letter]?.struck || (!!role && role !== sel.cat);
              return (
                <button
                  key={letter}
                  type="button"
                  disabled={!ok}
                  className={
                    `pick tier-${tier}${ok ? '' : ' disabled'}` +
                    (tConfirm ? ' tconfirm' : '') +
                    (tRuled ? ' truled' : '')
                  }
                  onClick={() => {
                    setSlot(sel.cat, sel.i, letter);
                    setSel(null);
                  }}
                >
                  {letter}
                  <TierGlyph tier={tier} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {errors.length > 0 && <p className="error small">{errors.join('; ')}</p>}
    </div>
  );
}
