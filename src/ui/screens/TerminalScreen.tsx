import { useMemo, useState } from 'react';
import { useI18n } from '../../i18n';
import {
  deduceCipher,
  suggestMoves,
  ROLE_BUDGET,
  type Signal,
  type Suggestion,
  type Warning,
} from '../../engine';
import { CATEGORIES, type Category, type Mark } from '../../state/state';
import type { GameApi } from '../../state/useGame';
import { MatrixCell } from '../MatrixCell';
import { TierGlyph } from '../TierGlyph';
import { Icon } from '../icons/Icon';
import { formatScore } from '../score';

const EMPTY_MARK: Mark = { struck: false, confirmed: false };
const EFFECT: Record<Category, string> = { trust: '+1', amplify: '×2', suspicion: '−' };

const fmt = (tpl: string, params: Record<string, string | number>) =>
  tpl.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ''));

export function TerminalScreen({ game }: { game: GameApi }) {
  const { t, pack } = useI18n();
  const { state, update } = game;
  const { showTips, showHints, hideJunk } = state.prefs;
  const [hintsOpen, setHintsOpen] = useState(true);

  // Every scored transmission is an Alien cipher score, whoever typed the word:
  // the Scientist's own words carry the score the Alien returned, so they deduce
  // just the same. Both sides run this — the Alien previews what it has leaked.
  const signals = useMemo<Signal[]>(
    () =>
      state.transmissions
        .filter((tx) => tx.value !== null)
        .map((tx) => ({ word: tx.word, value: tx.value as number })),
    [state.transmissions],
  );

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
  const junkCount = rows.filter((r) => r.status === 'junk').length;
  const visible = hideJunk ? rows.filter((r) => r.status !== 'junk') : rows;

  const confirmedCount = (cat: Category) =>
    pack.alphabet.reduce((n, l) => n + (mark(cat, l).confirmed ? 1 : 0), 0);

  const setPref = (patch: Partial<typeof state.prefs>) =>
    update((s) => ({ ...s, prefs: { ...s.prefs, ...patch } }));

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
              <th scope="row" className={`mrow-label tier-${pack.tiers[letter]}`}>
                <TierGlyph tier={pack.tiers[letter]} />
                <span className="mrow-letter">{letter}</span>
                {status === 'junk' ? (
                  <Icon name="trash" size={13} className="mrow-junk" />
                ) : (
                  status !== 'open' && <span className={`mrow-chip chip-${status}`}>{EFFECT[status]}</span>
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

      {junkCount > 0 && (
        <button type="button" className="junk-fold" onClick={() => setPref({ hideJunk: !hideJunk })}>
          {fmt(t(hideJunk ? 'terminal.showJunk' : 'terminal.hideJunk'), { n: junkCount })}
        </button>
      )}
    </section>
  );
}
