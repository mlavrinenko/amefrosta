import { useI18n } from '../i18n';
import { PACKS, PACK_CODES, type PackCode } from '../packs';
import { SIDES, type Side } from '../state/state';
import type { GameApi } from '../state/useGame';
import { Icon } from './icons/Icon';

export function WelcomeSheet({ game, onClose }: { game: GameApi; onClose: () => void }) {
  const { t } = useI18n();
  const { state, update } = game;

  const setLang = (l: PackCode) => update((s) => ({ ...s, lang: l }));
  const setSide = (sd: Side) => update((s) => ({ ...s, side: sd }));

  return (
    <div className="sheet-backdrop">
      <div className="sheet">
        <div className="sheet-head">
          <h2 className="sheet-title">{t('app.title')}</h2>
        </div>
        <div className="sheet-body welcome-body">
          <p className="muted small">{t('setup.disclaimer')}</p>

          <label className="field">
            <span>{t('setup.language')}</span>
            <select value={state.lang} onChange={(e) => setLang(e.target.value as PackCode)}>
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
                  onClick={() => setSide(sd)}
                >
                  <Icon name={sd} size={16} /> {t(`side.${sd}`)}
                </button>
              ))}
            </div>
          </div>

          <p className="muted small">{t('setup.about')}</p>

          <button type="button" className="primary" onClick={onClose}>
            {t('welcome.play')}
          </button>
        </div>
      </div>
    </div>
  );
}
