import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { DirtyGameState } from '../../types';
import { useDirtyEvents, type DirtyEvent } from '../../dirty/useDirtyEvents';
import { useI18n } from '../../i18n/i18nContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useChristmasConfetti } from '../christmas/confettiContext';
import ElfRun, { type ElfRunSpec } from './ElfRun';
import ThiefCharacter from './ThiefCharacter';

interface Banner {
  id: number;
  icon: 'santa' | 'elf' | string;
  text: string;
  tone: 'steal' | 'open' | 'lock' | 'info' | 'turn';
}

type Highlight = { kind: 'opened' | 'arriving' | 'locked'; delay: number };

/**
 * Animațiile comune ecranului mare și telefoanelor: anunțul de sus, Elful Hoț
 * care duce cadoul furat, cadoul desfăcut sau blocat. Pe ecranul mare (`big`)
 * totul e mai lent și mai mare.
 */
export function useDirtyStage(game: DirtyGameState | null, { big }: { big: boolean }) {
  const { t } = useI18n();
  const td = t.dirty;
  const reduced = useReducedMotion();
  const fireConfetti = useChristmasConfetti();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [runs, setRuns] = useState<ElfRunSpec[]>([]);
  const [highlights, setHighlights] = useState<Record<number, Highlight>>({});
  const [dealing, setDealing] = useState(false);
  const [turnPing, setTurnPing] = useState(0);
  const nextId = useRef(0);
  const timers = useRef<number[]>([]);

  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const highlight = useCallback((giftId: number, kind: Highlight['kind'], delay: number, lasts: number) => {
    setHighlights(current => ({ ...current, [giftId]: { kind, delay } }));
    later(delay + lasts, () => setHighlights(current => {
      if (current[giftId]?.kind !== kind) return current;
      const next = { ...current };
      delete next[giftId];
      return next;
    }));
  }, [later]);

  const announce = useCallback((icon: Banner['icon'], text: string, tone: Banner['tone']) => {
    const id = ++nextId.current;
    setBanners(current => [...current, { id, icon, text, tone }]);
  }, []);

  // Un singur anunț pe rând; fiecare stă cât să poată fi citit.
  const showing = banners[0];
  useEffect(() => {
    if (!showing) return;
    const timer = window.setTimeout(() => setBanners(current => current.slice(1)), big ? 3200 : 2600);
    return () => clearTimeout(timer);
  }, [showing, big]);

  const onEvents = useCallback((events: DirtyEvent[], g: DirtyGameState) => {
    const name = (id: number) => g.players.find(p => p.id === id)?.nickname ?? '?';
    const number = (id: number) => g.gifts.find(x => x.id === id)?.number ?? 0;
    const gift = (id: number) => td.giftLabel(number(id));
    const runMs = reduced ? 0 : big ? 2000 : 1500;

    for (const event of events) {
      switch (event.kind) {
        case 'start': {
          setDealing(true);
          later(2400, () => setDealing(false));
          const me = g.players.find(p => p.id === g.me);
          announce('🎲', me?.turn_order ? td.events.yourPosition(me.turn_order) : td.events.started, 'info');
          break;
        }
        case 'open':
          highlight(event.giftId, 'opened', 0, 1800);
          announce('🎁', td.events.opened(name(event.actorId), gift(event.giftId)), 'open');
          break;
        case 'steal':
        case 'swap': {
          if (!reduced) {
            setRuns(current => [...current, {
              id: ++nextId.current,
              fromPlayer: event.victimId,
              toPlayer: event.actorId,
              label: `🎁 #${number(event.giftId)}`,
              duration: runMs,
            }]);
          }
          highlight(event.giftId, 'arriving', runMs, 900);
          const text = event.victimId === g.me
            ? td.events.stolenFromYou(gift(event.giftId))
            : event.actorId === g.me
              ? td.events.youStole(gift(event.giftId))
              : event.kind === 'steal'
                ? td.events.stole(name(event.actorId), name(event.victimId), gift(event.giftId))
                : td.events.swapped(name(event.actorId), name(event.victimId), gift(event.giftId));
          announce('elf', text, 'steal');
          if (event.locked) {
            later(runMs + 200, () => highlight(event.giftId, 'locked', 0, 1600));
            announce('santa', td.events.locked(gift(event.giftId), name(event.actorId)), 'lock');
          }
          break;
        }
        case 'keep':
          announce('😌', td.events.kept(name(event.actorId)), 'info');
          break;
        case 'your_turn':
          setTurnPing(n => n + 1);
          navigator.vibrate?.([150, 80, 150]);
          break;
        case 'finish':
          later(runMs + 300, () => fireConfetti({ y: 35 }));
          announce('🏆', td.events.finished, 'info');
          break;
        case 'undo':
          announce('↩️', td.events.undone, 'info');
          break;
        default:
          break;
      }
    }
  }, [announce, big, fireConfetti, highlight, later, reduced, td]);

  useDirtyEvents(game, onEvents);

  const giftClass = (giftId: number) => {
    const h = highlights[giftId];
    return h ? `dirty-gift--${h.kind}` : '';
  };
  const giftStyle = (giftId: number): CSSProperties | undefined => {
    const h = highlights[giftId];
    return h ? ({ '--dirty-delay': `${h.delay}ms` } as CSSProperties) : undefined;
  };

  const overlay: ReactNode = (
    <>
      {showing && (
        <div key={showing.id} className={`dirty-banner dirty-banner--${showing.tone}${big ? ' dirty-banner--big' : ''}`} role="status" aria-live="polite">
          <span className="dirty-banner__icon">
            {showing.icon === 'santa' || showing.icon === 'elf'
              ? <ThiefCharacter role={showing.icon} size={big ? 72 : 44} />
              : <span aria-hidden="true">{showing.icon}</span>}
          </span>
          <span className="dirty-banner__text">{showing.text}</span>
        </div>
      )}
      {runs.map(run => (
        <ElfRun key={run.id} run={run} onDone={() => setRuns(current => current.filter(r => r.id !== run.id))} />
      ))}
    </>
  );

  return { overlay, giftClass, giftStyle, dealing, turnPing };
}
