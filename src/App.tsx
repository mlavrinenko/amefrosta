import { useMemo, useState } from 'react';
import { useGame } from './state/useGame';
import { cipherConsistency } from './engine';
import { makeI18n, I18nProvider } from './i18n';
import { Tabs, type TabId } from './ui/Tabs';
import { HeaderCipher } from './ui/HeaderCipher';
import { MessageScreen } from './ui/screens/MessageScreen';
import { TerminalScreen } from './ui/screens/TerminalScreen';
import { TransmissionsScreen } from './ui/screens/TransmissionsScreen';
import { CipherSheet } from './ui/CipherSheet';
import { SettingsSheet } from './ui/SettingsSheet';
import { NotesSheet } from './ui/NotesSheet';
import { WelcomeSheet } from './ui/WelcomeSheet';
import { Icon } from './ui/icons/Icon';

type SheetId = 'cipher' | 'settings' | 'notes' | null;

const WELCOME_KEY = 'amefrosta:welcomed';

function isFresh(state: ReturnType<typeof useGame>['state']): boolean {
  return (
    !state.cipher &&
    state.transmissions.length === 0 &&
    state.message.dice === null &&
    state.message.words.every((w) => w === '') &&
    state.cipherArchive.length === 0 &&
    state.notes === '' &&
    Object.values(state.terminal).every((g) => Object.keys(g).length === 0)
  );
}

export function App() {
  const game = useGame();
  const i18n = useMemo(() => makeI18n(game.state.lang), [game.state.lang]);
  const [tab, setTab] = useState<TabId>('tx');
  const [sheet, setSheet] = useState<SheetId>(null);

  const fresh = isFresh(game.state);
  const [showWelcome, setShowWelcome] = useState(() => {
    if (!fresh) return false;
    if (typeof localStorage === 'undefined') return false;
    if (localStorage.getItem(WELCOME_KEY)) return false;
    return true;
  });
  const dismissWelcome = () => {
    try { localStorage.setItem(WELCOME_KEY, '1'); } catch { /* ignore */ }
    setShowWelcome(false);
  };

  const side = game.state.side;

  // Scientist-only: how many alien signals the current cipher guess reproduces.
  const tabBadges = useMemo(() => {
    const s = game.state;
    if (s.side !== 'scientist' || !s.cipher) return undefined;
    const hasLetters = [...s.cipher.trust, ...s.cipher.amplify, ...s.cipher.suspicion].some(
      (l) => l.length > 0,
    );
    const signals = s.transmissions
      .filter((tx) => tx.from === 'alien' && tx.value !== null)
      .map((tx) => ({ word: tx.word, value: tx.value as number }));
    if (!hasLetters || signals.length === 0) return undefined;
    const cons = cipherConsistency(s.cipher, signals);
    return { tx: `${cons.matches}/${cons.total}` };
  }, [game.state]);

  return (
    <I18nProvider value={i18n}>
      <div className="app" data-side={side}>
        <header className="topbar">
          <div className="topbar-row">
            <span className="brand">{i18n.t('app.title')}</span>
            <span className={`side-chip side-${side}`}>
              <Icon name={side} size={15} /> {i18n.t(`side.${side}`)}
            </span>
            <div className="topbar-actions">
              <button
                type="button"
                className="icon-btn"
                onClick={() => setSheet('notes')}
                title={i18n.t('nav.notes')}
              >
                <Icon name="notes" size={20} />
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setSheet('settings')}
                title={i18n.t('nav.setup')}
              >
                <Icon name="settings" size={20} />
              </button>
            </div>
          </div>
          <HeaderCipher game={game} onOpen={() => setSheet('cipher')} />
        </header>

        <main className="screen">
          {tab === 'message' && <MessageScreen game={game} />}
          {tab === 'terminal' && <TerminalScreen game={game} />}
          {tab === 'tx' && <TransmissionsScreen game={game} />}
        </main>

        <Tabs active={tab} onChange={setTab} badges={tabBadges} />

        {sheet === 'cipher' && <CipherSheet game={game} onClose={() => setSheet(null)} />}
        {sheet === 'settings' && <SettingsSheet game={game} onClose={() => setSheet(null)} />}
        {sheet === 'notes' && <NotesSheet game={game} onClose={() => setSheet(null)} />}

        {showWelcome && <WelcomeSheet game={game} onClose={dismissWelcome} />}
      </div>
    </I18nProvider>
  );
}
