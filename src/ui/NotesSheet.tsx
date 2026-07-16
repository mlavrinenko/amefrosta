import { useI18n } from '../i18n';
import type { GameApi } from '../state/useGame';
import { Sheet } from './Sheet';

export function NotesSheet({ game, onClose }: { game: GameApi; onClose: () => void }) {
  const { t } = useI18n();
  const { state, update } = game;
  return (
    <Sheet title={t('nav.notes')} onClose={onClose}>
      <textarea
        className="notes tall"
        placeholder={t('notes.placeholder')}
        value={state.notes}
        onChange={(e) => update((s) => ({ ...s, notes: e.target.value }))}
      />
    </Sheet>
  );
}
