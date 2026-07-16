import { useCallback, useEffect, useState } from 'react';
import { type GameState, loadState, saveState } from './state';

export interface GameApi {
  state: GameState;
  update: (fn: (s: GameState) => GameState) => void;
}

export function useGame(): GameApi {
  const [state, setState] = useState<GameState>(() => loadState());
  useEffect(() => {
    saveState(state);
  }, [state]);
  const update = useCallback((fn: (s: GameState) => GameState) => setState(fn), []);
  return { state, update };
}
