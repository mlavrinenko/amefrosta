import { useRef } from 'react';
import type { Mark } from '../state/state';

const LONG_PRESS_MS = 400;

/**
 * One role cell in the deduction matrix.
 *   tap        empty <-> struck; or clears a confirm back to its prior value
 *   long-press toggles confirm (the underlying struck is preserved)
 * A cell locked because the letter is confirmed in another role is inert.
 */
export function MatrixCell({
  mark,
  locked = false,
  ruled = false,
  candidate = false,
  reason,
  onTap,
  onLong,
}: {
  mark: Mark;
  locked?: boolean;
  ruled?: boolean;
  candidate?: 'trust' | 'suspicion' | false;
  reason?: string;
  onTap: () => void;
  onLong: () => void;
}) {
  const timer = useRef<number | undefined>(undefined);
  const long = useRef(false);

  const start = () => {
    if (locked) return;
    long.current = false;
    timer.current = window.setTimeout(() => {
      long.current = true;
      onLong();
    }, LONG_PRESS_MS);
  };
  const clear = () => {
    if (timer.current !== undefined) {
      clearTimeout(timer.current);
      timer.current = undefined;
    }
  };
  const up = () => {
    if (locked) return;
    clear();
    if (!long.current) onTap();
  };

  const symbol = mark.confirmed ? '✓' : mark.struck && !locked ? '✕' : '';

  return (
    <button
      type="button"
      title={reason}
      disabled={locked}
      className={
        'mcell' +
        (mark.confirmed ? ' confirmed' : '') +
        (locked ? ' locked' : '') +
        (mark.struck && !mark.confirmed && !locked ? ' struck' : '') +
        (ruled ? ' ruled' : '') +
        (candidate ? ` candidate-${candidate}` : '')
      }
      onPointerDown={start}
      onPointerUp={up}
      onPointerLeave={clear}
      onPointerCancel={clear}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="mcell-sym">{symbol}</span>
    </button>
  );
}
