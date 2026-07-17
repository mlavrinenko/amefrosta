import { useState } from 'react';
import { useI18n } from '../i18n';
import { PACKS, PACK_CODES, type PackCode } from '../packs';
import { defaultState, emptyTerminal, SIDES } from '../state/state';
import type { GameApi } from '../state/useGame';
import { Sheet } from './Sheet';
import { Icon } from './icons/Icon';

import creditsMd from '../../CREDITS.md?raw';

export function SettingsSheet({ game, onClose }: { game: GameApi; onClose: () => void }) {
  const { t } = useI18n();
  const { state, update } = game;
  const [showCredits, setShowCredits] = useState(false);
  const setPref = (patch: Partial<typeof state.prefs>) =>
    update((s) => ({ ...s, prefs: { ...s.prefs, ...patch } }));

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
          onClick={() => {
            if (confirm(t('setup.clearTerminalConfirm'))) {
              update((s) => ({ ...s, terminal: emptyTerminal(), hiddenLetters: [] }));
            }
          }}
        >
          {t('setup.clearTerminal')}
        </button>

        <button
          type="button"
          className="danger"
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
