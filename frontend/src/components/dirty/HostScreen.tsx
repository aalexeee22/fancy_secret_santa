import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { App, Button, ConfigProvider, Input, Modal, Popconfirm, Select } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { addDirtyPlayer, reconnectDirtyPlayer, removeDirtyPlayer, startDirtyGame, undoDirtyMove, type DirtyAuth } from '../../api/client';
import type { DirtyGameState } from '../../types';
import type { DirtyConnection } from '../../dirty/useDirtyGame';
import { setCurrentGame } from '../../dirty/storage';
import { useI18n } from '../../i18n/i18nContext';
import DirtyQr from './DirtyQr';
import ThiefCharacter from './ThiefCharacter';
import { ActionPanel, GiftChip, LiveDot, MoveHistory, Results } from './DirtyParts';
import { giftOf, nicknameOf } from '../../dirty/helpers';
import { useDirtyStage } from './useDirtyStage';
import { useSendMove } from './useSendMove';

const MIN_PLAYERS = 3;

const gameLink = (code: string) => `${window.location.origin}/dirty-santa/${code}`;

/**
 * Ecranul mare: televizor, proiector sau laptop. Arată tot jocul, cu animații,
 * și are controalele organizatorului. Nu e jucător: cine vrea să joace se
 * înscrie de pe telefon. Cine n-are telefon e adăugat de aici, iar când îi vine
 * rândul, organizatorul joacă pentru el direct pe ecranul mare.
 */
interface HostScreenProps {
  game: DirtyGameState;
  auth: DirtyAuth;
  connection: DirtyConnection;
  accept: (g: DirtyGameState) => void;
  refresh: () => void;
  alsoPlayer: boolean;
}

export default function HostScreen(props: HostScreenProps) {
  const screenRef = useRef<HTMLDivElement>(null);
  const container = () => screenRef.current ?? document.body;
  // În modul ecran complet se vede doar ecranul mare: confirmările, listele și
  // mesajele trebuie să apară înăuntrul lui, nu în <body>.
  return (
    <div ref={screenRef} className="dirty-tv-root">
      <ConfigProvider getPopupContainer={container}>
        <App message={{ getContainer: container }}>
          <HostBoard {...props} screenRef={screenRef} />
        </App>
      </ConfigProvider>
    </div>
  );
}

function HostBoard({ game, auth, connection, accept, refresh, alsoPlayer, screenRef }: HostScreenProps & {
  screenRef: RefObject<HTMLDivElement | null>;
}) {
  const { t, locale } = useI18n();
  const td = t.dirty;
  const { message } = App.useApp();
  const navigate = useNavigate();
  const stage = useDirtyStage(game, { big: true });
  const { send, busy } = useSendMove(game, auth, accept, refresh);
  const [fullscreen, setFullscreen] = useState(false);
  const [playingForTurn, setPlayingForTurn] = useState<string | null>(null);
  const [reconnectOpen, setReconnectOpen] = useState(false);
  const [reconnectFor, setReconnectFor] = useState<number | null>(null);
  const [reconnectLink, setReconnectLink] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [localName, setLocalName] = useState('');
  const limit = game.settings.steal_limit;
  const link = gameLink(game.code);

  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === screenRef.current);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, [screenRef]);

  useEffect(() => {
    if (game.status === 'finished') setCurrentGame(null);
  }, [game.status]);

  // Fereastra „Joacă în locul lui” ține doar cât tura pentru care a fost deschisă.
  const turnKey = `${game.turn?.player_id}-${game.moves.length}`;
  const playingFor = playingForTurn === turnKey;
  const setPlayingFor = (open: boolean) => setPlayingForTurn(open ? turnKey : null);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else screenRef.current?.requestFullscreen?.().catch(() => {});
  };

  const run = async (action: () => Promise<DirtyGameState>) => {
    setWorking(true);
    try {
      accept(await action());
    } catch (err: any) {
      message.error(err?.response?.data?.error || td.moveError);
      if (err?.response?.status === 409) refresh();
    } finally {
      setWorking(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      message.success(td.linkCopied);
    } catch {
      message.info(link);
    }
  };

  const share = () => navigator.share?.({ title: 'Dirty Santa', text: td.shareText(game.code), url: link }).catch(() => {});

  const createReconnect = async () => {
    if (reconnectFor == null) return;
    setWorking(true);
    try {
      const result = await reconnectDirtyPlayer(game.code, auth, reconnectFor);
      setReconnectLink(`${gameLink(game.code)}#t=${result.token}`);
    } catch (err: any) {
      message.error(err?.response?.data?.error || td.moveError);
    } finally {
      setWorking(false);
    }
  };

  const closeReconnect = () => {
    setReconnectOpen(false);
    setReconnectFor(null);
    setReconnectLink(null);
  };

  const addLocal = async () => {
    const name = localName.trim();
    if (!name) return;
    await run(() => addDirtyPlayer(game.code, auth, name));
    setLocalName('');
  };

  const newGame = () => {
    setCurrentGame(null);
    navigate('/dirty-santa');
  };

  const current = game.turn?.player_id;
  const currentIsLocal = game.players.find(p => p.id === current)?.local ?? false;
  const localMark = <span className="dirty-local" title={td.localBadge} aria-label={td.localBadge}>📺</span>;
  const startedAt = game.started_at ? new Date(game.started_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <div className={`dirty-tv ${fullscreen ? 'dirty-tv--fullscreen' : ''}`}>
      {stage.overlay}
      <header className="dirty-tv__bar">
        <div className="dirty-tv__brand">
          <ThiefCharacter role="santa" size={44} /> Dirty Santa
          <span className="dirty-tv__code">{game.code}</span>
        </div>
        {game.turn && (
          <div className="dirty-tv__round">
            {game.turn.phase === 'final' ? td.finalPhase : td.round(game.turn.round, game.turn.rounds)}
          </div>
        )}
        <div className="dirty-tv__tools">
          <LiveDot connection={connection} />
          {game.status === 'playing' && (
            <>
              <Popconfirm title={td.undoConfirm} okText={td.yesUndo} cancelText={td.no} onConfirm={() => run(() => undoDirtyMove(game.code, auth, game.version))}>
                <Button disabled={working || !game.moves.length}>↩️ {td.undo}</Button>
              </Popconfirm>
              <Button onClick={() => setReconnectOpen(true)}>📱 {td.reconnect}</Button>
            </>
          )}
          {game.status === 'finished' && game.moves.length > 0 && (
            <Popconfirm title={td.undoConfirm} okText={td.yesUndo} cancelText={td.no} onConfirm={() => run(() => undoDirtyMove(game.code, auth, game.version))}>
              <Button disabled={working}>↩️ {td.undo}</Button>
            </Popconfirm>
          )}
          <Button onClick={toggleFullscreen}>{fullscreen ? td.exitFullscreen : `⛶ ${td.fullscreen}`}</Button>
        </div>
      </header>

      {game.status === 'lobby' && (
        <div className="dirty-tv__lobby">
          <section className="dirty-tv__join">
            <h1>{td.scanToJoin}</h1>
            <DirtyQr value={link} size={fullscreen ? 340 : 280} label={td.scanToJoin} />
            <p className="dirty-muted">{td.orEnterCode(`${window.location.host}/dirty-santa`)}</p>
            <div className="dirty-tv__bigcode" aria-label={td.codeLabel}>{game.code}</div>
            <div className="dirty-tv__share">
              <Button onClick={copyLink}>🔗 {td.copyLink}</Button>
              {typeof navigator.share === 'function' && <Button onClick={share}>📤 {td.share}</Button>}
            </div>
          </section>
          <section className="dirty-tv__players">
            <ThiefCharacter role="santa" size={120} className="dirty-peek dirty-peek--side" />
            <h2>{game.players.length ? td.lobbyPlayers(game.players.length) : td.waitingPlayers}</h2>
            <ul className="dirty-tv__lobbylist">
              {game.players.map(p => (
                <li key={p.id} className="dirty-chip-pop">
                  <span className="dirty-avatar" aria-hidden="true">{p.nickname.slice(0, 1).toUpperCase()}</span>
                  <span>{p.nickname}</span>
                  {p.local && localMark}
                  <button
                    type="button"
                    className="dirty-x"
                    aria-label={`${td.remove}: ${p.nickname}`}
                    title={td.remove}
                    disabled={working}
                    onClick={() => run(() => removeDirtyPlayer(game.code, auth, p.id))}
                  >×</button>
                </li>
              ))}
            </ul>
            <div className="dirty-add-local">
              <label className="dirty-label" htmlFor="dirty-local-name">{td.addLocalLabel}</label>
              <div className="dirty-add-local__row">
                <Input
                  id="dirty-local-name"
                  size="large"
                  maxLength={20}
                  value={localName}
                  placeholder={td.addLocalPlaceholder}
                  onChange={e => setLocalName(e.target.value)}
                  onPressEnter={addLocal}
                  autoComplete="off"
                />
                <Button size="large" disabled={!localName.trim() || working} onClick={addLocal}>➕ {td.addLocal}</Button>
              </div>
            </div>
            <Button
              type="primary"
              size="large"
              className="dirty-start-btn"
              disabled={game.players.length < MIN_PLAYERS || working}
              loading={working}
              onClick={() => run(() => startDirtyGame(game.code, auth))}
            >
              🎲 {td.start}
            </Button>
            {game.players.length < MIN_PLAYERS && <p className="dirty-muted">{td.minPlayers(MIN_PLAYERS)}</p>}
            <p className="dirty-note">{td.notPlaying}</p>
            {alsoPlayer && <p className="dirty-note">{td.hostAlsoPlayer} <Link to={`/dirty-santa/${game.code}?as=player`}>{td.openAsPlayer}</Link></p>}
          </section>
        </div>
      )}

      {game.status === 'playing' && game.turn && (
        <>
          <div className="dirty-tv__turn" key={current}>
            <ThiefCharacter role="santa" size={64} className="dirty-wink" />
            <div>
              <h1>{td.turnOf(nicknameOf(game, current))}</h1>
              <p className="dirty-muted">
                {game.turn.phase === 'final' ? td.finalText : `${td.openOrSteal} · ${td.unopened(game.unopened)}`}
              </p>
            </div>
            {!currentIsLocal && (
              <Button size="large" onClick={() => setPlayingFor(true)}>🎮 {td.playFor(nicknameOf(game, current))}</Button>
            )}
          </div>
          {currentIsLocal && current != null && (
            // Jucător fără telefon: mutarea lui se face direct aici, fără fereastră în plus.
            <section className="dirty-card dirty-tv__local" key={turnKey}>
              <h2>📺 {td.playForTitle(nicknameOf(game, current))}</h2>
              <ActionPanel game={game} actorId={current} send={send} busy={busy} />
            </section>
          )}
          <ul className={`dirty-board ${stage.dealing ? 'dirty-board--dealing' : ''}`}>
            {game.players.map((p, index) => {
              const gift = giftOf(game, p.gift_id);
              return (
                <li
                  key={p.id}
                  data-dirty-player={p.id}
                  className={`dirty-seat dirty-seat--tv ${current === p.id ? 'dirty-seat--turn' : ''}`}
                  style={{ '--dirty-i': index } as CSSProperties}
                >
                  <span className="dirty-seat__order">{p.turn_order}</span>
                  <span className="dirty-avatar" aria-hidden="true">{p.nickname.slice(0, 1).toUpperCase()}</span>
                  <span className="dirty-seat__name">{p.nickname} {p.local && localMark}</span>
                  {gift
                    ? <GiftChip gift={gift} limit={limit} className={stage.giftClass(gift.id)} style={stage.giftStyle(gift.id)} />
                    : <span className="dirty-seat__empty" aria-hidden="true">🎁?</span>}
                </li>
              );
            })}
          </ul>
          <MoveHistory game={game} limit={6} />
          {startedAt && <p className="dirty-note">{td.startedAtShort(startedAt)}</p>}
        </>
      )}

      {game.status === 'finished' && (
        <div className="dirty-tv__finished">
          <h1>{td.resultsTitle}</h1>
          <Results game={game} big />
          <Button size="large" type="primary" onClick={newGame} className="dirty-new-btn">🎁 {td.newGame}</Button>
        </div>
      )}

      <Modal
        open={playingFor && game.status === 'playing' && current != null}
        onCancel={() => setPlayingFor(false)}
        footer={null}
        title={td.playForTitle(nicknameOf(game, current))}
        getContainer={() => screenRef.current ?? document.body}
        destroyOnHidden
      >
        {current != null && <ActionPanel game={game} actorId={current} send={send} busy={busy} />}
      </Modal>

      <Modal
        open={reconnectOpen}
        onCancel={closeReconnect}
        footer={null}
        title={td.reconnect}
        getContainer={() => screenRef.current ?? document.body}
        destroyOnHidden
      >
        {reconnectLink ? (
          <div className="dirty-center">
            <h3>{td.reconnectTitle(nicknameOf(game, reconnectFor))}</h3>
            <DirtyQr value={reconnectLink} size={240} label={td.reconnect} />
            <p className="dirty-muted">{td.reconnectText}</p>
          </div>
        ) : (
          <div className="dirty-reconnect">
            <Select
              size="large"
              style={{ width: '100%' }}
              placeholder={td.choosePlayer}
              value={reconnectFor ?? undefined}
              onChange={setReconnectFor}
              options={game.players.map(p => ({ value: p.id, label: p.nickname }))}
            />
            <p className="dirty-muted">{td.reconnectText}</p>
            <Button type="primary" block size="large" disabled={reconnectFor == null || working} onClick={createReconnect}>
              {td.reconnectCreate}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
