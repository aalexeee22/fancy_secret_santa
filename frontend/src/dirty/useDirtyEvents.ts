import { useEffect, useLayoutEffect, useRef } from 'react';
import type { DirtyGameState } from '../types';

/**
 * Ce s-a întâmplat între două stări ale jocului.
 *
 * Animațiile pornesc din mutările noi venite de la server, nu din butoane: așa,
 * ecranul mare și toate telefoanele arată aceleași animații, indiferent cine a
 * apăsat. La prima încărcare (și după refresh) nu se rejoacă nimic.
 */
export type DirtyEvent =
  | { kind: 'join'; playerId: number }
  | { kind: 'start' }
  | { kind: 'open'; actorId: number; giftId: number }
  | { kind: 'steal'; actorId: number; victimId: number; giftId: number; locked: boolean }
  | { kind: 'swap'; actorId: number; victimId: number; giftId: number; locked: boolean }
  | { kind: 'keep'; actorId: number }
  | { kind: 'your_turn' }
  | { kind: 'finish' }
  | { kind: 'undo' };

interface Snapshot {
  code: string;
  status: DirtyGameState['status'];
  lastSeq: number;
  playerIds: Set<number>;
  myTurn: boolean;
}

const snapshot = (game: DirtyGameState): Snapshot => ({
  code: game.code,
  status: game.status,
  lastSeq: game.moves.length ? game.moves[game.moves.length - 1].seq : 0,
  playerIds: new Set(game.players.map(p => p.id)),
  myTurn: game.me != null && game.turn?.player_id === game.me,
});

export function diffGames(before: Snapshot, game: DirtyGameState): DirtyEvent[] {
  const events: DirtyEvent[] = [];
  const after = snapshot(game);

  if (game.status === 'lobby') {
    game.players.filter(p => !before.playerIds.has(p.id)).forEach(p => events.push({ kind: 'join', playerId: p.id }));
  }
  if (before.status === 'lobby' && game.status !== 'lobby') events.push({ kind: 'start' });

  if (after.lastSeq < before.lastSeq) {
    events.push({ kind: 'undo' });
  } else {
    const gifts = new Map(game.gifts.map(g => [g.id, g]));
    for (const move of game.moves) {
      if (move.seq <= before.lastSeq) continue;
      if (move.kind === 'open' && move.gift_id != null) {
        events.push({ kind: 'open', actorId: move.actor_id, giftId: move.gift_id });
      } else if ((move.kind === 'steal' || move.kind === 'final_swap') && move.gift_id != null && move.victim_id != null) {
        events.push({
          kind: move.kind === 'steal' ? 'steal' : 'swap',
          actorId: move.actor_id,
          victimId: move.victim_id,
          giftId: move.gift_id,
          locked: gifts.get(move.gift_id)?.locked ?? false,
        });
      } else if (move.kind === 'keep') {
        events.push({ kind: 'keep', actorId: move.actor_id });
      }
    }
  }

  if (!before.myTurn && after.myTurn) events.push({ kind: 'your_turn' });
  if (before.status !== 'finished' && game.status === 'finished') events.push({ kind: 'finish' });
  return events;
}

/** Cheamă `onEvents` cu evenimentele noi de fiecare dată când se schimbă starea jocului. */
export function useDirtyEvents(game: DirtyGameState | null, onEvents: (events: DirtyEvent[], game: DirtyGameState) => void) {
  const previous = useRef<Snapshot | null>(null);
  const handler = useRef(onEvents);
  useLayoutEffect(() => { handler.current = onEvents; }, [onEvents]);

  useEffect(() => {
    if (!game) return;
    const before = previous.current;
    previous.current = snapshot(game);
    // Prima stare văzută (sau alt joc): nimic de animat.
    if (!before || before.code !== game.code) return;
    const events = diffGames(before, game);
    if (events.length) handler.current(events, game);
  }, [game]);
}
