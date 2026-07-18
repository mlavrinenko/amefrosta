import { useState } from 'react';
import { useI18n } from '../i18n';
import { PACKS, PACK_CODES, type PackCode } from '../packs';
import { CATEGORIES, defaultState, SIDES } from '../state/state';
import type { GameApi } from '../state/useGame';
import { Sheet } from './Sheet';
import { Icon } from './icons/Icon';
import { feedbackUrl } from './feedback';

import creditsMd from '../../CREDITS.md?raw';

export function SettingsSheet({ game, onClose }: { game: GameApi; onClose: () => void }) {
  const { t } = useI18n();
  const { state, update } = game;
  const [showCredits, setShowCredits] = useState(false);
  const setPref = (patch: Partial<typeof state.prefs>) =>
    update((s) => ({ ...s, prefs: { ...s.prefs, ...patch } }));

  // Reset is a no-op on a pristine game, so gate it: a disabled button both
  // avoids a pointless confirm and, right after a reset, flips to disabled —
  // the feedback that the wipe took. Any player-entered content counts.
  const hasMarks = CATEGORIES.some((c) =>
    Object.values(state.terminal[c]).some((m) => m.struck || m.confirmed),
  );
  const dirty =
    state.transmissions.length > 0 ||
    state.cipher !== null ||
    state.cipherArchive.length > 0 ||
    state.hiddenLetters.length > 0 ||
    state.notes.trim().length > 0 ||
    state.message.dice !== null ||
    state.message.words.some((w) => w.trim().length > 0) ||
    hasMarks;

  return (
    <Sheet title={t('nav.setup')} onClose={onClose}>
      <div className="panel">
        <label className="field">
          <span>{t('setup.language')}</span>
          <select
            value={state.lang}
            onChange={(e) => update((s) => ({ ...s, lang: e.target.value as PackCode }))}
          >
            {PACK_CODES.map((c) => (
              <option key={c} value={c}>
                {PACKS[c].name}
              </option>
            ))}
          </select>
        </label>

        <div className="field">
          <span>{t('setup.side')}</span>
          <div className="segmented">
            {SIDES.map((sd) => (
              <button
                key={sd}
                type="button"
                className={state.side === sd ? 'active' : ''}
                onClick={() => update((s) => ({ ...s, side: sd }))}
              >
                <Icon name={sd} size={16} /> {t(`side.${sd}`)}
              </button>
            ))}
          </div>
        </div>

        <label className="toggle">
          <input
            type="checkbox"
            checked={state.prefs.showTips}
            onChange={(e) => setPref({ showTips: e.target.checked })}
          />
          <span>{t('setup.showTips')}</span>
        </label>

        <label className="toggle">
          <input
            type="checkbox"
            checked={state.prefs.showHints}
            onChange={(e) => setPref({ showHints: e.target.checked })}
          />
          <span>{t('setup.showHints')}</span>
        </label>

        <button
          type="button"
          className="danger"
          disabled={!dirty}
          onClick={() => {
            if (confirm(t('setup.resetConfirm'))) {
              update((s) => ({ ...defaultState(), lang: s.lang, side: s.side }));
              try { localStorage.removeItem('amefrosta:welcomed'); } catch { /* ignore */ }
            }
          }}
        >
          {t('setup.reset')}
        </button>

        <hr />

        <p className="muted small">{t('setup.about')}<br />{t('setup.disclaimer')}</p>

        <button
          type="button"
          onClick={() =>
            window.open(feedbackUrl(state.lang), '_blank', 'noopener,noreferrer')
          }
        >
          {t('setup.feedback')}
        </button>

        <button type="button" onClick={() => setShowCredits(true)}>
          {t('setup.credits')}
        </button>
      </div>

      {showCredits && (
        <div className="modal-backdrop" onClick={() => setShowCredits(false)}>
          <div className="modal credits-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('setup.credits')}</h3>
            <pre className="credits-body">{creditsMd}</pre>
            <button type="button" onClick={() => setShowCredits(false)}>
              {t('common.close')}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
