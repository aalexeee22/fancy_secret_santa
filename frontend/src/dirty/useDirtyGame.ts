import { useCallback, useEffect, useRef, useState } from 'react';
import { getDirtyGame, type DirtyAuth } from '../api/client';
import type { DirtyGameState } from '../types';

const VISIBLE_POLL_MS = 2000;
const HIDDEN_POLL_MS = 10000;

export type DirtyConnection = 'loading' | 'live' | 'reconnecting' | 'forbidden' | 'gone';

/**
 * Starea jocului, ținută la zi prin polling ușor: „s-a schimbat ceva după versiunea X?”.
 * Serverul răspunde 204 gol când nu s-a schimbat nimic. Când tabul nu se vede,
 * întrebăm mai rar.
 */
export function useDirtyGame(code: string, auth: DirtyAuth | null) {
  const [game, setGame] = useState<DirtyGameState | null>(null);
  const [connection, setConnection] = useState<DirtyConnection>('loading');
  const versionRef = useRef<number | undefined>(undefined);
  const timerRef = useRef<number | undefined>(undefined);
  const pollRef = useRef<() => void>(() => {});
  const hostToken = auth?.hostToken;
  const playerToken = auth?.playerToken;

  /** Starea primită direct de la o mutare, fără să așteptăm următorul polling. */
  const accept = useCallback((next: DirtyGameState) => {
    if (versionRef.current != null && next.version < versionRef.current) return;
    versionRef.current = next.version;
    setGame(next);
    setConnection('live');
  }, []);

  useEffect(() => {
    versionRef.current = undefined;
    setGame(null);
    if (!hostToken && !playerToken) return;
    setConnection('loading');
    let active = true;
    const currentAuth = { hostToken, playerToken };

    const schedule = () => {
      window.clearTimeout(timerRef.current);
      if (!active) return;
      timerRef.current = window.setTimeout(poll, document.hidden ? HIDDEN_POLL_MS : VISIBLE_POLL_MS);
    };

    const poll = async () => {
      try {
        const next = await getDirtyGame(code, currentAuth, versionRef.current);
        if (!active) return;
        if (next) accept(next);
        else setConnection('live');
        schedule();
      } catch (err: any) {
        if (!active) return;
        const status = err?.response?.status;
        if (status === 404) setConnection('gone');
        else if (status === 403) setConnection('forbidden');
        else {
          setConnection('reconnecting');
          schedule();
        }
      }
    };
    pollRef.current = () => { window.clearTimeout(timerRef.current); poll(); };

    poll();
    // Revenit în tab: verificăm imediat, nu după 10 secunde.
    const onVisible = () => { if (!document.hidden) pollRef.current(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      window.clearTimeout(timerRef.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [code, hostToken, playerToken, accept]);

  const refresh = useCallback(() => pollRef.current(), []);

  return { game, connection, accept, refresh };
}
