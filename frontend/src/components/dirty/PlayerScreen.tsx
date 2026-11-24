import { useEffect, useMemo, type CSSProperties } from 'react';
import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import type { DirtyAuth } from '../../api/client';
import type { DirtyGameState } from '../../types';
import type { DirtyConnection } from '../../dirty/useDirtyGame';
import { setCurrentGame } from '../../dirty/storage';
import { useI18n } from '../../i18n/i18nContext';
import ThiefCharacter from './ThiefCharacter';
import { ActionPanel, GiftChip, LiveDot, MoveHistory, Results } from './DirtyParts';
import { giftOf, nicknameOf } from '../../dirty/helpers';
import { useDirtyStage } from './useDirtyStage';
import { useSendMove } from './useSendMove';

/** Ecranul de pe telefonul unui jucător. */
export default function PlayerScreen({ game, auth, connection, accept, refresh }: {
  game: DirtyGameState;
  auth: DirtyAuth;
  connection: DirtyConnection;
  accept: (g: DirtyGameState) => void;
  refresh: () => void;
}) {
  const { t } = useI18n();
  const td = t.dirty;
  const navigate = useNavigate();
  const stage = useDirtyStage(game, { big: false });
  const { send, busy } = useSendMove(game, auth, accept, refresh);
  const me = game.players.find(p => p.id === game.me);
  const myGift = giftOf(game, me?.gift_id);
  const myTurn = game.turn?.player_id === game.me;
  const limit = game.settings.steal_limit;

  // Jocul s-a terminat: dispozitivul nu mai are un joc „în desfășurare” și poate intra în altul.
  useEffect(() => {
    if (game.status === 'finished') setCurrentGame(null);
  }, [game.status]);

  const holders = useMemo(
    () => game.players.filter(p => p.turn_order != null),
    [game.players],
  );

  const newGame = () => {
    setCurrentGame(null);
    navigate('/dirty-santa');
  };

  return (
    <div className="dirty-phone">
      {stage.overlay}
      <header className="dirty-phone__bar">
        <span className="dirty-phone__code">{game.code}</span>
        {game.turn && (
          <span>{game.turn.phase === 'final' ? td.finalPhase : td.round(game.turn.round, game.turn.rounds)}</span>
        )}
        <LiveDot connection={connection} />
      </header>

      {game.status === 'lobby' && (
        <section className="dirty-card dirty-center">
          <ThiefCharacter role="santa" size={110} className="dirty-peek" />
          <h2>{td.youAreIn(me?.nickname ?? '')}</h2>
          <p className="dirty-muted">{td.waitingStart}</p>
          <ul className="dirty-chips">
            {game.players.map(p => (
              <li key={p.id} className={`dirty-chip-pop ${p.id === game.me ? 'dirty-chip-pop--me' : ''}`}>{p.nickname}</li>
            ))}
          </ul>
        </section>
      )}

      {game.status === 'playing' && game.turn && (
        <>
          {myTurn ? (
            <section className="dirty-card dirty-myturn" key={`turn-${stage.turnPing}`}>
              <div className="dirty-myturn__head">
                <ThiefCharacter role="santa" size={72} className="dirty-wink" />
                <div>
                  <h2>🔥 {td.yourTurn}</h2>
                  {game.turn.phase !== 'final' && <p className="dirty-muted">{td.openOrSteal}</p>}
                </div>
              </div>
              <ActionPanel game={game} actorId={game.me!} send={send} busy={busy} />
            </section>
          ) : (
            <section className="dirty-card dirty-center">
              <h2>{td.turnOf(nicknameOf(game, game.turn.player_id))}</h2>
              <p className="dirty-muted dirty-waiting">{td.waitingFor(nicknameOf(game, game.turn.player_id))}</p>
            </section>
          )}

          <section className="dirty-card">
            <h3>{td.yourGift}</h3>
            {myGift
              ? <GiftChip gift={myGift} limit={limit} big className={stage.giftClass(myGift.id)} style={stage.giftStyle(myGift.id)} />
              : <p className="dirty-muted">{td.noGiftYet}</p>}
          </section>

          <section className="dirty-card">
            <ul className={`dirty-board dirty-board--phone ${stage.dealing ? 'dirty-board--dealing' : ''}`}>
              {holders.map((p, index) => {
                const gift = giftOf(game, p.gift_id);
                return (
                  <li
                    key={p.id}
                    data-dirty-player={p.id}
                    className={`dirty-seat ${game.turn?.player_id === p.id ? 'dirty-seat--turn' : ''} ${p.id === game.me ? 'dirty-seat--me' : ''}`}
                    style={{ '--dirty-i': index } as CSSProperties}
                  >
                    <span className="dirty-seat__order">{p.turn_order}</span>
                    <span className="dirty-seat__name">{p.nickname}</span>
                    {gift
                      ? <GiftChip gift={gift} limit={limit} className={stage.giftClass(gift.id)} style={stage.giftStyle(gift.id)} />
                      : <span className="dirty-seat__empty">—</span>}
                  </li>
                );
              })}
            </ul>
          </section>
          <MoveHistory game={game} limit={5} />
        </>
      )}

      {game.status === 'finished' && (
        <>
          <section className="dirty-card dirty-center">
            <h2>{td.resultsTitle}</h2>
            {myGift && (
              <>
                <p className="dirty-muted">{td.yourGift}</p>
                <GiftChip gift={myGift} limit={limit} big />
              </>
            )}
          </section>
          <Results game={game} />
          <Button size="large" type="primary" block onClick={newGame} className="dirty-new-btn">🎁 {td.newGame}</Button>
        </>
      )}
    </div>
  );
}
