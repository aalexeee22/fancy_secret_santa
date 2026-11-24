import type { DirtyGameState } from '../types';

export const nicknameOf = (game: DirtyGameState, id: number | null | undefined) =>
  game.players.find(p => p.id === id)?.nickname ?? '?';

export const giftOf = (game: DirtyGameState, id: number | null | undefined) =>
  game.gifts.find(g => g.id === id) ?? null;
