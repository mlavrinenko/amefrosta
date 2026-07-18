import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../i18n';
import {
  deduceCipher,
  suggestMoves,
  ROLE_BUDGET,
  type Signal,
  type Suggestion,
  type Warning,
} from '../../engine';
import {
  CATEGORIES,
  emptyTerminal,
  TERMINAL_SORTS,
  type Category,
  type Mark,
  type Side,
} from '../../state/state';
import { scoredSignals, alienWordLetters } from '../../state/signals';
import type { GameApi } from '../../state/useGame';
import { MatrixCell } from '../MatrixCell';
import { TierGlyph } from '../TierGlyph';
import { Icon } from '../icons/Icon';
import { formatScore } from '../score';

const EMPTY_MARK: Mark = { struck: false, confirmed: false };
const EFFECT: Record<Category, string> = { trust: '+1', amplify: '×2', suspicion: '−' };

/** A zero count reads clearer as a dash than a 0 in the dense stat block. */
const dash = (n: number) => (n > 0 ? String(n) : '-');

const fmt = (tpl: string, params: Record<string, string | number>) =>
  tpl.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ''));

export function TerminalScreen({ game }: { game: GameApi }) {
  const { t, pack } = useI18n();
  const { state, update } = game;
  const { showTips, showHints } = state.prefs;
  const [hintsOpen, setHintsOpen] = useState(true);

  // Every scored transmission is an Alien cipher score, whoever typed the word:
  // the Scientist's own words carry the score the Alien returned, so they deduce
  // just the same. Both sides run this — the Alien previews what it has leaked.
  const signals = useMemo<Signal[]>(() => scoredSignals(state.transmissions), [state.transmissions]);

  // Per-letter word frequency, split by who transmitted the word: for each side,
  // how many distinct words hold the letter (docs) and its total occurrences.
  const freq = useMemo(() => {
    type Side2 = Record<Side, { docs: number; total: number }>;
    const blank = (): Side2 => ({ alien: { docs: 0, total: 0 }, scientist: { docs: 0, total: 0 } });
    const m: Record<string, Side2> = {};
    for (const l of pack.alphabet) m[l] = blank();
    for (const tx of state.transmissions) {
      const seen = new Set<string>();
      for (const ch of tx.word.toUpperCase()) {
        const cell = m[ch];
        if (!cell) continue;
        cell[tx.from].total++;
        if (!seen.has(ch)) {
          cell[tx.from].docs++;
          seen.add(ch);
        }
      }
    }
    return m;
  }, [state.transmissions, pack.alphabet]);

  // Letters that appear in the Alien's words — highlighted so the Alien tracks
  // its spent letters and the Scientist sees which cipher letters are exercised.
  const usedLetters = useMemo(
    () => alienWordLetters(state.transmissions),
    [state.transmissions],
  );

  const hiddenSet = useMemo(() => new Set(state.hiddenLetters), [state.hiddenLetters]);

  const deductions = useMemo(() => deduceCipher(pack, signals), [pack, signals]);

  const advice = useMemo(
    () => suggestMoves(pack, deductions, state.terminal, signals),
    [deductions, pack, state.terminal, signals],
  );

  const candidateSet = useMemo(
    () => new Set(deductions.suspicionCandidates ?? []),
    [deductions],
  );

  const trustCandidateSet = useMemo(
    () => new Set(deductions.trustCandidates ?? []),
    [deductions],
  );

  const mark = (cat: Category, l: string): Mark => state.terminal[cat][l] ?? EMPTY_MARK;
  const confirmedRole = (l: string): Category | null =>
    CATEGORIES.find((c) => mark(c, l).confirmed) ?? null;

  const excluded = (cat: Category, l: string): boolean => {
    const m = mark(cat, l);
    if (m.confirmed) return false;
    if (m.struck) return true;
    const role = confirmedRole(l);
    if (role && role !== cat) return true;
    if (deductions?.ruledOut[cat].has(l)) return true;
    if (cat === 'suspicion' && deductions?.suspicionCandidates && !candidateSet.has(l)) return true;
    return false;
  };

  const statusOf = (l: string): Category | 'junk' | 'open' => {
    const role = confirmedRole(l);
    if (role) return role;
    if (CATEGORIES.every((c) => excluded(c, l))) return 'junk';
    return 'open';
  };

  const rows = pack.alphabet.map((l) => ({ letter: l, status: statusOf(l) }));
  // A row is only ever hidden by an explicit "Hide junk" — and only while it is
  // still junk. Marking a letter out of every role never hides it on its own.
  const junkLetters = rows.filter((r) => r.status === 'junk').map((r) => r.letter);
  const hiddenJunk = junkLetters.filter((l) => hiddenSet.has(l));
  const visibleJunk = junkLetters.filter((l) => !hiddenSet.has(l));

  // Row order: alphabetical (pack order), used-first (letters in the Alien's
  // words float to the top), or by descending total frequency. Ties fall back
  // to the pack order so the active alphabet stays grouped and stable.
  const sort = state.prefs.terminalSort;
  const alphaIdx = (l: string) => pack.alphabet.indexOf(l);
  const totalFreq = (l: string) => freq[l].alien.total + freq[l].scientist.total;
  const sortedRows = [...rows];
  if (sort === 'used') {
    sortedRows.sort(
      (a, b) =>
        Number(usedLetters.has(b.letter)) - Number(usedLetters.has(a.letter)) ||
        alphaIdx(a.letter) - alphaIdx(b.letter),
    );
  } else if (sort === 'freq') {
    sortedRows.sort(
      (a, b) => totalFreq(b.letter) - totalFreq(a.letter) || alphaIdx(a.letter) - alphaIdx(b.letter),
    );
  }
  const visible = sortedRows.filter((r) => !(r.status === 'junk' && hiddenSet.has(r.letter)));

  const confirmedCount = (cat: Category) =>
    pack.alphabet.reduce((n, l) => n + (mark(cat, l).confirmed ? 1 : 0), 0);

  const setPref = (patch: Partial<typeof state.prefs>) =>
    update((s) => ({ ...s, prefs: { ...s.prefs, ...patch } }));

  const hideAllJunk = () =>
    update((s) => ({
      ...s,
      hiddenLetters: Array.from(new Set([...s.hiddenLetters, ...junkLetters])),
    }));
  const showAllJunk = () => update((s) => ({ ...s, hiddenLetters: [] }));

  // Wipe every terminal mark + fold state. Lives here (was in Setup) so it sits
  // by the grid it clears; disabled when there is nothing to clear.
  const terminalDirty =
    state.hiddenLetters.length > 0 ||
    CATEGORIES.some((c) => Object.values(state.terminal[c]).some((m) => m.struck || m.confirmed));
  const clearTerminal = () => {
    if (confirm(t('terminal.clearMarksConfirm'))) {
      update((s) => ({ ...s, terminal: emptyTerminal(), hiddenLetters: [] }));
    }
  };

  // Keep hidden ⊆ junk: a letter that stops being junk (its marks changed) drops
  // out of the hidden set, so it reappears and — crucially — never re-hides
  // itself if it later becomes junk again. Only an explicit "Hide junk" hides.
  const junkKey = junkLetters.join(',');
  useEffect(() => {
    const junk = new Set(junkLetters);
    if (state.hiddenLetters.some((l) => !junk.has(l))) {
      update((s) => ({ ...s, hiddenLetters: s.hiddenLetters.filter((l) => junk.has(l)) }));
    }
    // junkKey stands in for the junkLetters array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [junkKey, state.hiddenLetters, update]);

  const onTap = (cat: Category, l: string) =>
    update((s) => {
      const grid = { ...s.terminal[cat] };
      const cur = grid[l] ?? EMPTY_MARK;
      grid[l] = cur.confirmed ? { ...cur, confirmed: false } : { ...cur, struck: !cur.struck };
      return { ...s, terminal: { ...s.terminal, [cat]: grid } };
    });

  const onLong = (cat: Category, l: string) =>
    update((s) => {
      const grid = { ...s.terminal[cat] };
      const cur = grid[l] ?? EMPTY_MARK;
      grid[l] = { ...cur, confirmed: !cur.confirmed };
      return { ...s, terminal: { ...s.terminal, [cat]: grid } };
    });

  const apply = (sg: Suggestion) =>
    update((s) => {
      const grid = { ...s.terminal[sg.category] };
      for (const l of sg.letters) {
        const cur = grid[l] ?? EMPTY_MARK;
        grid[l] =
          sg.kind === 'confirm' ? { struck: false, confirmed: true } : { ...cur, struck: true };
      }
      return { ...s, terminal: { ...s.terminal, [sg.category]: grid } };
    });

  const reasonFor = (cat: Category, l: string): string | undefined => {
    const marks = deductions?.ruledOut[cat].get(l);
    if (!marks?.length) return undefined;
    const list = marks.map((m) => `${m.word} ${formatScore(m.value)}`).join(', ');
    return `${t('terminal.ruledOut')}: ${list}`;
  };

  const suggestText = (sg: Suggestion): string => {
    const role = t(`cipher.${sg.category}`);
    if (sg.reason === 'suspicion-unique') return fmt(t('suggest.suspicionUnique'), { letter: sg.letters[0] });
    if (sg.reason === 'trust-forced') return fmt(t('suggest.trustForced'), { letter: sg.letters[0] });
    if (sg.reason === 'ruled-out')
      return fmt(t('suggest.ruledOut'), { role, letters: sg.letters.join(' ') });
    if (sg.reason === 'column-forced')
      return fmt(t('suggest.columnForced'), { role, letters: sg.letters.join(' ') });
    return fmt(t('suggest.columnFull'), { role, n: sg.letters.length });
  };

  const warnText = (w: Warning): string =>
    fmt(t(w.reason === 'overfull' ? 'suggest.warnOverfull' : 'suggest.warnImpossible'), {
      role: t(`cipher.${w.category}`),
    });

  const suggestWhy = (sg: Suggestion): string => t(`suggest.why.${sg.reason}`);

  const hints = showHints ? advice : null;

  return (
    <section className="panel">
      {showTips && (
        <p className="muted small terminal-tip">
          <span>{t('terminal.hint')}</span>
          <button
            type="button"
            className="tip-close"
            title={t('terminal.hideTip')}
            onClick={() => setPref({ showTips: false })}
          >
            ✕
          </button>
        </p>
      )}

      {hints && (hints.suggestions.length > 0 || hints.warnings.length > 0) && (
        <div className="hints">
          <button type="button" className="hints-head" onClick={() => setHintsOpen((v) => !v)}>
            <span>{fmt(t('terminal.hints'), { n: hints.suggestions.length })}</span>
            <span className={`chevron${hintsOpen ? ' open' : ''}`} aria-hidden>⌄</span>
          </button>
          {hintsOpen && (
            <ul className="hint-list">
              {hints.warnings.map((w) => (
                <li key={w.id} className="hint-card warn">{warnText(w)}</li>
              ))}
              {hints.suggestions.map((sg) => (
                <li key={sg.id} className={`hint-card ${sg.kind}`}>
                  <div className="hint-body">
                    <span className="hint-text">{suggestText(sg)}</span>
                    <span className="hint-why muted small">{suggestWhy(sg)}</span>
                  </div>
                  <button type="button" className="hint-apply" onClick={() => apply(sg)}>
                    {t('terminal.apply')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="term-sort" role="group" aria-label={t('terminal.sort')}>
        <span className="muted small">{t('terminal.sort')}</span>
        {TERMINAL_SORTS.map((k) => (
          <button
            key={k}
            type="button"
            className={`sort-btn${sort === k ? ' active' : ''}`}
            onClick={() => setPref({ terminalSort: k })}
          >
            {t(`terminal.sort.${k}`)}
          </button>
        ))}
      </div>

      <table className="matrix">
        <thead>
          <tr>
            <th className="mcol-letter" aria-hidden />
            {CATEGORIES.map((cat) => (
              <th key={cat} className={`mhead cat-${cat}`}>
                <span className="mhead-effect">{EFFECT[cat]}</span>
                <span className="mhead-role">{t(`cipher.${cat}`)}</span>
                <span className="mhead-budget">{confirmedCount(cat)}/{ROLE_BUDGET[cat]}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map(({ letter, status }) => (
            <tr key={letter} className={status === 'junk' ? 'mrow junk' : 'mrow'}>
              <th
                scope="row"
                className={`mrow-label tier-${pack.tiers[letter]}${usedLetters.has(letter) ? ' used' : ''}`}
                title={usedLetters.has(letter) ? t('cipher.usedInWords') : undefined}
              >
                <TierGlyph tier={pack.tiers[letter]} />
                <span className="mrow-letter">{letter}</span>
                {status === 'junk' ? (
                  <Icon name="trash" size={13} className="mrow-junk" />
                ) : (
                  (freq[letter].alien.docs > 0 || freq[letter].scientist.docs > 0) && (
                    <span className="mrow-freq">
                      <span
                        className="mrow-freq-cell mrow-freq-ico-cell"
                        title={fmt(t('terminal.freqAlien'), {
                          docs: freq[letter].alien.docs,
                          total: freq[letter].alien.total,
                        })}
                      >
                        <Icon name="alien" size={10} className="mrow-freq-ico alien" />
                      </span>
                      <span className="mrow-freq-cell mrow-freq-docs">
                        {dash(freq[letter].alien.docs)}
                      </span>
                      <span className="mrow-freq-cell mrow-freq-total">
                        {dash(freq[letter].alien.total)}
                      </span>
                      <span
                        className="mrow-freq-cell mrow-freq-ico-cell"
                        title={fmt(t('terminal.freqScientist'), {
                          docs: freq[letter].scientist.docs,
                          total: freq[letter].scientist.total,
                        })}
                      >
                        <Icon name="scientist" size={10} className="mrow-freq-ico scientist" />
                      </span>
                      <span className="mrow-freq-cell mrow-freq-docs">
                        {dash(freq[letter].scientist.docs)}
                      </span>
                      <span className="mrow-freq-cell mrow-freq-total">
                        {dash(freq[letter].scientist.total)}
                      </span>
                    </span>
                  )
                )}
              </th>
              {CATEGORIES.map((cat) => {
                const m = mark(cat, letter);
                const role = confirmedRole(letter);
                const locked = !!role && role !== cat;
                const ruled = !m.struck && !m.confirmed && !locked && deductions.ruledOut[cat].has(letter);
                const open = !m.struck && !m.confirmed && !locked && !ruled;
                const candidate: 'trust' | 'suspicion' | false =
                  cat === 'suspicion' && open && candidateSet.has(letter)
                    ? 'suspicion'
                    : cat === 'trust' && open && trustCandidateSet.has(letter)
                      ? 'trust'
                      : false;
                return (
                  <td key={cat}>
                    <MatrixCell
                      mark={m}
                      locked={locked}
                      ruled={ruled}
                      candidate={candidate}
                      reason={reasonFor(cat, letter)}
                      onTap={() => onTap(cat, letter)}
                      onLong={() => onLong(cat, letter)}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {junkLetters.length > 0 && (
        <div className="junk-controls">
          <button
            type="button"
            className="junk-fold"
            disabled={visibleJunk.length === 0}
            onClick={hideAllJunk}
          >
            {fmt(t('terminal.hideJunk'), { n: visibleJunk.length })}
          </button>
          <button
            type="button"
            className="junk-fold"
            disabled={hiddenJunk.length === 0}
            onClick={showAllJunk}
          >
            {fmt(t('terminal.showJunk'), { n: hiddenJunk.length })}
          </button>
        </div>
      )}

      <div className="term-clear">
        <button type="button" className="link danger" disabled={!terminalDirty} onClick={clearTerminal}>
          {t('terminal.clearMarks')}
        </button>
      </div>
    </section>
  );
}
