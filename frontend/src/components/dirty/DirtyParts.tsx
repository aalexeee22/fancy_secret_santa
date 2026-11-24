import type { CSSProperties } from 'react';
import { Button } from 'antd';
import type { DirtyGameState, DirtyGift, DirtyMoveKind } from '../../types';
import { useI18n } from '../../i18n/i18nContext';
import { giftOf, nicknameOf } from '../../dirty/helpers';
import ThiefCharacter from './ThiefCharacter';

export type SendMove = (move: { kind: DirtyMoveKind; gift_id?: number }) => Promise<boolean>;

/** Bulinele de furt: ●●○ = furat de 2 ori din 3. */
export function StealDots({ steals, limit }: { steals: number; limit: number }) {
  const { t } = useI18n();
  return (
    <span className="dirty-dots" title={t.dirty.steals(steals, limit)} aria-label={t.dirty.steals(steals, limit)}>
      {Array.from({ length: limit }, (_, i) => (
        <span key={i} className={i < steals ? 'dirty-dots__on' : ''} />
      ))}
    </span>
  );
}

export function GiftChip({ gift, limit, className = '', style, big = false }: {
  gift: DirtyGift;
  limit: number;
  className?: string;
  style?: CSSProperties;
  big?: boolean;
}) {
  return (
    <div className={`dirty-gift ${gift.locked ? 'dirty-gift--is-locked' : ''} ${big ? 'dirty-gift--big' : ''} ${className}`} style={style}>
      <span className="dirty-gift__unwrap" aria-hidden="true">🎁</span>
      <span className="dirty-gift__name">🎁 #{gift.number}</span>
      <span className="dirty-gift__meta">
        {gift.locked ? <span className="dirty-gift__lock" aria-hidden="true">🔒</span> : null}
        <StealDots steals={gift.steals} limit={limit} />
      </span>
    </div>
  );
}

/**
 * Ce poate face jucătorul de la rând: desface un cadou nou sau fură unul.
 * Îl folosește telefonul jucătorului și ecranul mare, la „Joacă în locul lui”.
 */
export function ActionPanel({ game, actorId, send, busy }: {
  game: DirtyGameState;
  actorId: number;
  send: SendMove;
  busy: boolean;
}) {
  const { t } = useI18n();
  const td = t.dirty;
  const limit = game.settings.steal_limit;
  const phase = game.turn?.phase ?? 'main';
  const others = game.gifts.filter(g => g.holder_id !== actorId);
  const own = giftOf(game, game.players.find(p => p.id === actorId)?.gift_id);


  const giftRow = (gift: DirtyGift, action: 'steal' | 'final_swap') => {
    const holder = nicknameOf(game, gift.holder_id);
    let control;
    if (gift.locked) control = <span className="dirty-tag dirty-tag--locked">🔒 {td.locked}</span>;
    else if (!gift.can_take) control = <span className="dirty-tag dirty-tag--locked">🔒 {td.locked}</span>;
    else {
      // Fără „Sigur?”: dacă a apăsat, vrea să fure. O greșeală se repară cu „Anulează” de pe ecranul mare.
      control = (
        <Button
          danger
          type="primary"
          disabled={busy}
          className="dirty-steal-btn"
          onClick={() => send({ kind: action, gift_id: gift.id })}
        >
          {action === 'steal' ? `😈 ${td.steal}` : `🔁 ${td.swap}`}
        </Button>
      );
    }
    return (
      <li key={gift.id} className={`dirty-row ${gift.can_take ? '' : 'dirty-row--muted'}`}>
        <div className="dirty-row__main">
          <strong>{holder}</strong>
          <span className="dirty-row__sub">🎁 #{gift.number} · <StealDots steals={gift.steals} limit={limit} /></span>
        </div>
        {control}
      </li>
    );
  };

  if (phase === 'final') {
    return (
      <div className="dirty-actions">
        <h3 className="dirty-actions__title">⏳ {td.finalTitle}</h3>
        <p className="dirty-muted">{td.finalText}</p>
        <ul className="dirty-list">{others.map(g => giftRow(g, 'final_swap'))}</ul>
        <Button size="large" block disabled={busy} onClick={() => send({ kind: 'keep' })}>
          😌 {td.keep(own ? td.giftLabel(own.number) : '🎁')}
        </Button>
      </div>
    );
  }

  return (
    <div className="dirty-actions">
      <div className="dirty-open">
        <div className="dirty-open__head">
          <span className="dirty-open__icon" aria-hidden="true">🎁</span>
          <div>
            <strong>{td.openNew}</strong>
            <div className="dirty-muted">{td.unopened(game.unopened)}</div>
          </div>
        </div>
        <Button type="primary" size="large" block disabled={busy} loading={busy} onClick={() => send({ kind: 'open' })} className="dirty-reveal-btn">
          {td.reveal}
        </Button>
      </div>
      <div className="dirty-or">{td.orSteal}</div>
      {others.length ? <ul className="dirty-list">{others.map(g => giftRow(g, 'steal'))}</ul> : <p className="dirty-muted">{td.nothingToSteal}</p>}
    </div>
  );
}

export function MoveHistory({ game, limit = 8 }: { game: DirtyGameState; limit?: number }) {
  const { t } = useI18n();
  const td = t.dirty;
  const recent = [...game.moves].reverse().slice(0, limit);
  if (!recent.length) return null;
  return (
    <section className="dirty-history">
      <h3>{td.history}</h3>
      <ul>
        {recent.map(move => {
          const actor = nicknameOf(game, move.actor_id);
          const number = giftOf(game, move.gift_id)?.number;
          const gift = number ? td.giftLabel(number) : '🎁';
          let text;
          if (move.kind === 'open') text = `🎁 ${td.events.opened(actor, gift)}`;
          else if (move.kind === 'steal') text = `😈 ${td.events.stole(actor, nicknameOf(game, move.victim_id), gift)}`;
          else if (move.kind === 'final_swap') text = `🔁 ${td.events.swapped(actor, nicknameOf(game, move.victim_id), gift)}`;
          else text = `😌 ${td.events.kept(actor)}`;
          return <li key={move.seq}>{text}{move.by_host ? <span className="dirty-muted"> {td.byHost}</span> : null}</li>;
        })}
      </ul>
    </section>
  );
}

export function Results({ game, big = false }: { game: DirtyGameState; big?: boolean }) {
  const { t } = useI18n();
  const td = t.dirty;
  const limit = game.settings.steal_limit;
  const names = (ids: number[] | null | undefined) => (ids ?? []).map(id => nicknameOf(game, id)).join(', ');
  const awards = game.awards;
  const mostWanted = (awards?.most_wanted_gift ?? []).map(id => `🎁 #${giftOf(game, id)?.number ?? '?'}`).join(', ');
  const steals = (id: number) => game.gifts.find(g => g.id === id)?.steals ?? 0;

  const list = [
    awards?.biggest_thief && { icon: 'santa' as const, title: td.awards.biggestThief, who: names(awards.biggest_thief) },
    awards?.most_wanted_gift && { icon: '🏆', title: td.awards.mostWanted, who: `${mostWanted} · ${td.stolenTimes(steals(awards.most_wanted_gift[0]))}` },
    awards?.unlucky && { icon: '🥲', title: td.awards.unlucky, who: names(awards.unlucky) },
  ].filter(Boolean) as { icon: string; title: string; who: string }[];

  return (
    <section className={`dirty-results ${big ? 'dirty-results--big' : ''}`}>
      {list.length > 0 && (
        <div className="dirty-awards">
          {list.map((award, i) => (
            <div key={award.title} className="dirty-award" style={{ '--dirty-i': i } as CSSProperties}>
              <span className="dirty-award__icon">
                {award.icon === 'santa' ? <ThiefCharacter role="santa" size={big ? 96 : 56} /> : <span aria-hidden="true">{award.icon}</span>}
                {award.icon === 'santa' && <span className="dirty-award__medal" aria-hidden="true">🏅</span>}
              </span>
              <span className="dirty-award__title">{award.title}</span>
              <strong className="dirty-award__who">{award.who}</strong>
            </div>
          ))}
        </div>
      )}
      <ul className="dirty-final-list">
        {game.players.map(player => {
          const gift = giftOf(game, player.gift_id);
          return (
            <li key={player.id} className={player.id === game.me ? 'dirty-final-list__me' : ''} data-dirty-player={player.id}>
              <span className="dirty-avatar" aria-hidden="true">{player.nickname.slice(0, 1).toUpperCase()}</span>
              <span className="dirty-final-list__name">{player.nickname}</span>
              {gift && <GiftChip gift={gift} limit={limit} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function LiveDot({ connection }: { connection: string }) {
  const { t } = useI18n();
  const live = connection === 'live';
  return (
    <span className={`dirty-live ${live ? '' : 'dirty-live--off'}`}>
      <span className="dirty-live__dot" aria-hidden="true" />
      {live ? t.dirty.live : t.dirty.reconnecting}
    </span>
  );
}
