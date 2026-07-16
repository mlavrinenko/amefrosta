import { useI18n } from '../../i18n';
import { rollDie } from '../../engine';
import type { GameApi } from '../../state/useGame';

export function MessageScreen({ game }: { game: GameApi }) {
  const { t } = useI18n();
  const { state, update } = game;

  const roll = () =>
    update((s) => ({
      ...s,
      message: { ...s.message, dice: [rollDie(6), rollDie(6), rollDie(6)] },
    }));

  const setWord = (i: number, v: string) =>
    update((s) => {
      const words = [...s.message.words] as [string, string, string];
      words[i] = v;
      return { ...s, message: { ...s.message, words } };
    });

  return (
    <section className="panel">
      <p className="muted small">{t('message.hint')}</p>

      <button type="button" className="primary" onClick={roll}>
        {t('message.roll')}
      </button>

      <div className="dice-row">
        {[0, 1, 2].map((i) => (
          <div key={i} className="die">
            {state.message.dice ? state.message.dice[i] : '?'}
          </div>
        ))}
      </div>

      <div className="words">
        {[0, 1, 2].map((i) => (
          <input
            key={i}
            className="word-input"
            placeholder={t('message.wordPlaceholder')}
            value={state.message.words[i]}
            onChange={(e) => setWord(i, e.target.value)}
          />
        ))}
      </div>
    </section>
  );
}
