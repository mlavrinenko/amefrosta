import { useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import {
  SLOT_COUNT,
  allowedTiersForSlot,
  emptyCipher,
  findLetter,
  pickableLettersForSlot,
  slotAllowed,
  validateCipher,
} from '../engine';
import type { Cipher, Tier } from '../engine/types';
import { CATEGORIES, type Category } from '../state/state';
import { alienWordLetters } from '../state/signals';
import type { GameApi } from '../state/useGame';
import { TierGlyph } from './TierGlyph';
import { Icon } from './icons/Icon';

const ALL_TIERS: Tier[] = ['common', 'uncommon', 'rare'];

/** Constrained cipher editor: 6 tier-aware slots + a filtered letter picker. */
export function CipherEditor({ game }: { game: GameApi }) {
  const { t, pack } = useI18n();
  const { state, update } = game;
  const cipher = state.cipher ?? emptyCipher();
  const [sel, setSel] = useState<{ cat: Category; i: number } | null>(null);

  const errors = useMemo(() => validateCipher(pack, cipher), [pack, cipher]);
  const groupHasError = (cat: Category) =>
    errors.some((e) => e.startsWith(cat) || e.startsWith('letters') || e.startsWith('at most'));

  const used = useMemo(
    () => alienWordLetters(state.transmissions),
    [state.transmissions],
  );

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

  // Picking a letter already placed elsewhere relocates it: clear its old slot
  // (any role) so the same letter is never in two slots at once.
  const pickSlot = (cat: Category, i: number, letter: string) =>
    update((s) => {
      const base: Cipher = s.cipher ?? emptyCipher();
      const L = letter.toUpperCase();
      const strip = (xs: string[]) => xs.map((x) => (x.toUpperCase() === L ? '' : x));
      const next: Cipher = {
        trust: strip(base.trust),
        amplify: strip(base.amplify),
        suspicion: strip(base.suspicion),
      };
      next[cat][i] = letter;
      return { ...s, cipher: next };
    });

  const pickable = new Set(sel ? pickableLettersForSlot(pack, cipher, sel.cat, sel.i) : []);

  return (
    <div className="cipher-editor">
      {/* The dice-roll "Create random" lives in the sheet header (Alien only);
          the Scientist builds by hand. */}
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
                const isUsed = !!l && used.has(l);
                return (
                  <button
                    key={i}
                    type="button"
                    className={`slot${active ? ' active' : ''}${tier ? ` tier-${tier}` : ' empty'}${isUsed ? ' used' : ''}`}
                    title={isUsed ? t('cipher.usedInWords') : undefined}
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
              const ok = pickable.has(letter);
              const role = confirmedRole(letter);
              const tConfirm = role === sel.cat;
              const tRuled = !!state.terminal[sel.cat][letter]?.struck || (!!role && role !== sel.cat);
              // Placed in another slot: picking relocates it here.
              const at = findLetter(cipher, letter);
              const elsewhere = !!at && !(at.cat === sel.cat && at.i === sel.i);
              return (
                <button
                  key={letter}
                  type="button"
                  disabled={!ok}
                  title={elsewhere ? `${t(`cipher.${at!.cat}`)} → ${t(`cipher.${sel.cat}`)}` : undefined}
                  className={
                    `pick tier-${tier}${ok ? '' : ' disabled'}` +
                    (tConfirm ? ' tconfirm' : '') +
                    (tRuled ? ' truled' : '') +
                    (elsewhere ? ' placed' : '')
                  }
                  onClick={() => {
                    pickSlot(sel.cat, sel.i, letter);
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
