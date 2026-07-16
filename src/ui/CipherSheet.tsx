import { useEffect } from 'react';
import { useI18n } from '../i18n';
import {
  cipherConsistency,
  cipherMarkStatus,
  cipherSignature,
  generateCipher,
  isCipherComplete,
  validateCipher,
  type SlotMark,
} from '../engine';
import type { Cipher } from '../engine/types';
import { CATEGORIES, type Terminal } from '../state/state';
import { scoredSignals } from '../state/signals';
import type { GameApi } from '../state/useGame';
import { Sheet } from './Sheet';
import { CipherEditor } from './CipherEditor';
import { Icon } from './icons/Icon';

const anyLetter = (c: Cipher) =>
  [...c.trust, ...c.amplify, ...c.suspicion].some((l) => l.length > 0);

function MiniCipher({
  cipher,
  tiers,
  status,
}: {
  cipher: Cipher;
  tiers: Record<string, string>;
  status?: Record<'trust' | 'amplify' | 'suspicion', SlotMark[]>;
}) {
  return (
    <span className="mini-cipher">
      {CATEGORIES.map((cat) => (
        <span key={cat} className="mini-group">
          {cipher[cat].map((l, i) => {
            const L = (l ?? '').toUpperCase();
            const tier = L ? tiers[L] : undefined;
            const mk = status?.[cat][i];
            return (
              <span
                key={i}
                className={`mini-slot${tier ? ` tier-${tier}` : ''}${mk && mk !== 'ok' ? ` mk-${mk}` : ''}`}
              >
                {L || '·'}
              </span>
            );
          })}
        </span>
      ))}
    </span>
  );
}

export function CipherSheet({ game, onClose }: { game: GameApi; onClose: () => void }) {
  const { t, pack } = useI18n();
  const { state, update } = game;
  const isScientist = state.side === 'scientist';
  // Accuracy counts every scored word, the Scientist's own included: each got a
  // real score back from the Alien, so each is a signal a hypothesis must fit.
  const signals = scoredSignals(state.transmissions);
  const terminal: Terminal = state.terminal;

  // Auto-archive a scientist's completed, valid hypothesis (deduped by signature).
  useEffect(() => {
    if (!isScientist || !state.cipher) return;
    if (!isCipherComplete(state.cipher) || validateCipher(pack, state.cipher).length) return;
    const sig = cipherSignature(state.cipher);
    if (state.cipherArchive.some((c) => cipherSignature(c) === sig)) return;
    update((s) => (s.cipher ? { ...s, cipherArchive: [...s.cipherArchive, s.cipher] } : s));
  }, [isScientist, state.cipher, state.cipherArchive, pack, update]);

  const activeSig = state.cipher ? cipherSignature(state.cipher) : null;
  const ranked = state.cipherArchive
    .map((c, idx) => ({
      c,
      idx,
      cons: cipherConsistency(c, signals),
      status: cipherMarkStatus(c, terminal),
    }))
    .sort((a, b) => b.cons.matches - a.cons.matches || a.idx - b.idx);

  const invalidCount = ranked.filter((r) => r.status.invalid).length;

  // Active guess fit (item 10): shown even for a partial hypothesis.
  const activeUsable = state.cipher && anyLetter(state.cipher) && signals.length > 0;
  const activeCons = activeUsable ? cipherConsistency(state.cipher!, signals) : null;
  const activePartial = !!state.cipher && anyLetter(state.cipher) && !isCipherComplete(state.cipher);

  const randomize = () => update((s) => ({ ...s, cipher: generateCipher(pack, Math.random) }));
  const activate = (c: Cipher) => update((s) => ({ ...s, cipher: c }));
  const remove = (c: Cipher) => {
    if (!confirm(t('cipher.deleteConfirm'))) return;
    const sig = cipherSignature(c);
    update((s) => ({ ...s, cipherArchive: s.cipherArchive.filter((x) => cipherSignature(x) !== sig) }));
  };
  const removeInvalid = () => {
    const kill = new Set(ranked.filter((r) => r.status.invalid).map((r) => cipherSignature(r.c)));
    update((s) => ({
      ...s,
      cipherArchive: s.cipherArchive.filter((c) => !kill.has(cipherSignature(c))),
    }));
  };

  return (
    <Sheet
      title={t(isScientist ? 'cipher.titleGuess' : 'cipher.titleSecret')}
      onClose={onClose}
      action={
        isScientist ? undefined : (
          <button
            type="button"
            className="sheet-action"
            onClick={randomize}
            title={t('cipher.random')}
          >
            <Icon name="dice" size={18} />
            <span>{t('cipher.random')}</span>
          </button>
        )
      }
    >
      <CipherEditor game={game} />

      {isScientist && activeCons && (
        <div className="active-fit">
          <span className="muted small">{t('cipher.activeRating')}</span>
          <span className="archive-stat" title={t('cipher.consistency')}>
            <Icon name="match" size={14} /> {activeCons.matches}/{activeCons.total}
          </span>
          {activePartial && <span className="tag">{t('cipher.partial')}</span>}
        </div>
      )}

      {isScientist && (
        <div className="archive">
          <div className="archive-head">
            <span className="cat-label">{t('cipher.archive')}</span>
            <span className="muted small">{t('cipher.archiveHint')}</span>
          </div>
          {ranked.length === 0 && <p className="muted small">{t('cipher.archiveEmpty')}</p>}
          <ul className="archive-list">
            {ranked.map(({ c, cons, status }) => {
              const sig = cipherSignature(c);
              const isActive = sig === activeSig;
              return (
                <li
                  key={sig}
                  className={`archive-item${isActive ? ' active' : ''}${status.invalid ? ' invalid' : ''}`}
                >
                  <MiniCipher cipher={c} tiers={pack.tiers} status={status.slots} />
                  <span className="archive-stat" title={t('cipher.consistency')}>
                    <Icon name="match" size={14} /> {cons.matches}/{cons.total}
                  </span>
                  {isActive ? (
                    <span className="tag">{t('cipher.active')}</span>
                  ) : (
                    <button type="button" className="link" onClick={() => activate(c)}>
                      {t('cipher.activate')}
                    </button>
                  )}
                  <button type="button" className="link danger" onClick={() => remove(c)}>
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
          {invalidCount > 0 && (
            <button type="button" className="link danger clear-invalid" onClick={removeInvalid}>
              <Icon name="trash" size={14} /> {t('cipher.deleteInvalid').replace('{n}', String(invalidCount))}
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}
