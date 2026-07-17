import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../i18n';
import { isCipherComplete, parseImport, scoreWord } from '../../engine';
import type { Cipher } from '../../engine/types';
import { CATEGORIES, type Category, type Side, type Transmission } from '../../state/state';
import { newId } from '../../state/id';
import type { GameApi } from '../../state/useGame';
import { QrModal } from '../QrModal';
import { formatScore, scoreMeaning } from '../score';
import { Icon } from '../icons/Icon';

const ScanModal = lazy(() =>
  import('../ScanModal').then((m) => ({ default: m.ScanModal })),
);

const anyLetter = (c: Cipher) =>
  [...c.trust, ...c.amplify, ...c.suspicion].some((l) => l.length > 0);

function ValueIcon({ value }: { value: number | null }) {
  if (value === null || value === 0) return null;
  return <Icon name={value > 0 ? 'signal' : 'suspicion'} size={13} />;
}

/** letter -> its role in the active cipher/hypothesis, for word highlighting. */
function roleMap(cipher: Cipher | null): Map<string, Category> {
  const m = new Map<string, Category>();
  if (!cipher) return m;
  for (const cat of CATEGORIES) {
    for (const l of cipher[cat]) {
      const L = (l ?? '').toUpperCase();
      if (L) m.set(L, cat);
    }
  }
  return m;
}

/** A word with each cipher letter tinted in its role colour. */
function CipherWord({ word, roles }: { word: string; roles: Map<string, Category> }) {
  return (
    <span className="tx-word">
      {[...word].map((ch, i) => {
        const role = roles.get(ch.toUpperCase());
        return role ? (
          <span key={i} className={`tx-ch tx-ch-${role}`}>{ch}</span>
        ) : (
          <span key={i}>{ch}</span>
        );
      })}
    </span>
  );
}

/** Empty, `?`, `+`, or `-` means unknown; otherwise a signed integer. */
function parseValue(text: string): number | null {
  const s = text.trim();
  return /^[+-]?\d+$/.test(s) ? Number(s) : null;
}

export function TransmissionsScreen({ game }: { game: GameApi }) {
  const { t } = useI18n();
  const { state, update } = game;

  const [word, setWord] = useState('');
  const [showQr, setShowQr] = useState<Transmission | null>(null);
  const [scan, setScan] = useState(false);
  const [explain, setExplain] = useState<string | null>(null);
  // Scientist-only inline score entry: faster than the QR round-trip.
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const skipBlur = useRef(false);

  const cipher = state.cipher;
  const roles = useMemo(() => roleMap(cipher), [cipher]);
  // A cipher (own for the Alien, hypothesis for the Scientist) can score words
  // even while incomplete; such scores are provisional until all 6 slots fill.
  const usable = cipher && anyLetter(cipher);
  const complete = cipher ? isCipherComplete(cipher) : false;
  const provisional = !!usable && !complete;

  const autoValue = useMemo(
    () => (usable && word.trim() ? scoreWord(cipher!, word.trim()) : null),
    [usable, word, cipher],
  );

  /** Create a transmission, or fold a repeat word into the existing one. */
  const add = () => {
    const w = word.trim().toUpperCase();
    if (!w) return;
    update((s) => {
      const idx = s.transmissions.findIndex((x) => x.word === w);
      // The Alien scores its own words; the Scientist logs theirs unscored.
      const mine = s.side === 'alien' && s.cipher ? scoreWord(s.cipher, w) : null;
      if (idx >= 0) {
        const copy = [...s.transmissions];
        copy[idx] = { ...copy[idx], value: mine ?? copy[idx].value };
        return { ...s, transmissions: copy };
      }
      const tx: Transmission = { id: newId(), word: w, value: mine, from: s.side, at: Date.now() };
      return { ...s, transmissions: [tx, ...s.transmissions] };
    });
    setWord('');
  };

  const remove = (id: string) => {
    if (!confirm(t('tx.deleteConfirm'))) return;
    update((s) => ({ ...s, transmissions: s.transmissions.filter((x) => x.id !== id) }));
  };

  const setValue = (id: string, value: number | null) =>
    update((s) => ({
      ...s,
      transmissions: s.transmissions.map((x) => (x.id === id ? { ...x, value } : x)),
    }));

  const openEditor = (tx: Transmission) => {
    setExplain(null);
    setDraft(tx.value === null ? '' : String(tx.value));
    setEditing(tx.id);
  };

  const commitEditor = () => {
    if (editing === null) return;
    setValue(editing, parseValue(draft));
    setEditing(null);
  };

  /**
   * Import a word (+ optional score). A word already logged is updated in place,
   * keeping its owner — so the Scientist can attach the score the Alien returns
   * for their own word without it flipping sides. A new word is the opponent's
   * transmission; the Alien auto-scores it from its cipher.
   */
  const importPayload = (raw: string) => {
    const p = parseImport(raw); // may throw -> surfaced by ScanModal
    const w = p.w.toUpperCase();
    update((s) => {
      const other: Side = s.side === 'alien' ? 'scientist' : 'alien';
      const idx = s.transmissions.findIndex((x) => x.word === w);
      if (idx >= 0) {
        const cur = s.transmissions[idx];
        let value = p.s !== null ? p.s : cur.value;
        if (value === null && s.side === 'alien' && s.cipher) value = scoreWord(s.cipher, w);
        const copy = [...s.transmissions];
        copy[idx] = { ...cur, value };
        return { ...s, transmissions: copy };
      }
      let value = p.s;
      if (value === null && s.side === 'alien' && s.cipher) value = scoreWord(s.cipher, w);
      const tx: Transmission = { id: newId(), word: w, value, from: other, at: Date.now() };
      return { ...s, transmissions: [tx, ...s.transmissions] };
    });
  };

  const isScientist = state.side === 'scientist';
  const calcFor = (tx: Transmission) => (usable ? scoreWord(cipher!, tx.word) : null);

  const matchState = (tx: Transmission): 'match' | 'mismatch' | null => {
    // Confident verdict only with a complete hypothesis; provisional scores can
    // still mismatch, but a partial "match" would be a false comfort. Every
    // scored word counts, the Scientist's own words included.
    if (!isScientist || !complete || tx.value === null) return null;
    return scoreWord(cipher!, tx.word) === tx.value ? 'match' : 'mismatch';
  };

  return (
    <section className="panel">
      <div className="tx-form">
        <input
          className="word-input"
          placeholder={t('tx.word')}
          value={word}
          onChange={(e) => setWord(e.target.value)}
        />
        <div className={`auto-value${provisional ? ' provisional' : ''}`} title={provisional ? t('tx.provisional') : undefined}>
          {word.trim() ? `${provisional ? '~' : ''}${formatScore(autoValue)}` : '—'}
        </div>
        <button type="button" className="primary" onClick={add}>
          {t('tx.add')}
        </button>
      </div>

      <div className="row">
        <button type="button" onClick={() => setScan(true)}>
          {t('tx.import')}
        </button>
      </div>

      {state.transmissions.length === 0 && <p className="muted">{t('tx.empty')}</p>}

      <ul className="tx-list">
        {state.transmissions.map((tx) => {
          const ms = matchState(tx);
          const calc = isScientist && usable ? calcFor(tx) : null;
          return (
            <li key={tx.id} className={`tx-item${ms ? ` tx-${ms}` : ''}`}>
              <div className="tx-row1">
                <span className={`side-mark side-${tx.from}`} title={t(`side.${tx.from}`)}>
                  <Icon name={tx.from} size={16} />
                </span>
                {/* Tap the word to unfold what its score means. */}
                <button
                  type="button"
                  className="tx-word-btn"
                  title={tx.value !== null ? scoreMeaning(tx.value, t) : undefined}
                  onClick={() => setExplain(explain === tx.id ? null : tx.id)}
                >
                  <CipherWord word={tx.word} roles={roles} />
                </button>
                {ms && <Icon name={ms} size={15} className={`tx-match-icon ${ms}`} />}
              </div>
              <div className="tx-row2">
                <div className="tx-scores">
                  {isScientist && usable && (
                    <span
                      className={`tx-calc${provisional ? ' provisional' : ''}`}
                      title={provisional ? t('tx.provisional') : t('cipher.consistency')}
                    >
                      {provisional ? '~' : ''}{formatScore(calc)}
                    </span>
                  )}
                  {isScientist && editing === tx.id ? (
                    <input
                      className="tx-value-input"
                      inputMode="numeric"
                      autoFocus
                      value={draft}
                      placeholder="?"
                      aria-label={t('tx.setValue')}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEditor();
                        else if (e.key === 'Escape') {
                          skipBlur.current = true;
                          setEditing(null);
                        }
                      }}
                      onBlur={() => {
                        if (skipBlur.current) {
                          skipBlur.current = false;
                          return;
                        }
                        commitEditor();
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className="tx-value-btn"
                      title={
                        isScientist
                          ? t('tx.setValue')
                          : tx.value !== null
                            ? scoreMeaning(tx.value, t)
                            : undefined
                      }
                      onClick={() =>
                        isScientist ? openEditor(tx) : setExplain(explain === tx.id ? null : tx.id)
                      }
                    >
                      <ValueIcon value={tx.value} />
                      <span className="tx-value">{formatScore(tx.value)}</span>
                    </button>
                  )}
                </div>
                <div className="tx-actions">
                  <button type="button" className="link" onClick={() => setShowQr(tx)}>
                    {t('tx.show')}
                  </button>
                  <button type="button" className="link danger" onClick={() => remove(tx.id)}>
                    ✕
                  </button>
                </div>
              </div>
              {explain === tx.id && tx.value !== null && (
                <div className="tx-explain small muted">{scoreMeaning(tx.value, t)}</div>
              )}
              {isScientist && editing === tx.id && parseValue(draft) !== null && (
                <div className="tx-explain small muted">{scoreMeaning(parseValue(draft)!, t)}</div>
              )}
            </li>
          );
        })}
      </ul>

      {showQr && <QrModal tx={showQr} side={state.side} cipher={state.cipher} onClose={() => setShowQr(null)} />}
      {scan && (
        <Suspense fallback={null}>
          <ScanModal
            onClose={() => setScan(false)}
            onImport={(raw) => {
              try {
                importPayload(raw);
                setScan(false);
              } catch (e) {
                alert(String(e));
              }
            }}
          />
        </Suspense>
      )}
    </section>
  );
}
