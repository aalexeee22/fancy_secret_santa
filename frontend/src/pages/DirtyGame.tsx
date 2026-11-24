import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Button, Spin } from 'antd';
import { useDirtyGame } from '../dirty/useDirtyGame';
import {
  forgetStoredGame, normalizeCode, readStoredGame, saveStoredGame, setCurrentGame, type StoredDirtyGame,
} from '../dirty/storage';
import { useI18n } from '../i18n/i18nContext';
import DirtyLayout from '../components/dirty/DirtyLayout';
import HostScreen from '../components/dirty/HostScreen';
import JoinScreen from '../components/dirty/JoinScreen';
import PlayerScreen from '../components/dirty/PlayerScreen';
import ThiefCharacter from '../components/dirty/ThiefCharacter';

/**
 * Linkul de reconectare de pe ecranul mare (/dirty-santa/COD#t=token): telefonul
 * nou ia tokenul, îl salvează și îl scoate din bara de adresă.
 */
function takeReconnectToken(code: string) {
  const match = window.location.hash.match(/^#t=([\w-]+)$/);
  if (!match) return;
  saveStoredGame(code, { playerToken: match[1], playerId: undefined, nickname: undefined });
  setCurrentGame(code);
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}

export default function DirtyGameRoute() {
  const { code: rawCode = '' } = useParams<{ code: string }>();
  const code = normalizeCode(rawCode);
  return <DirtyGame key={code} code={code} />;
}

function DirtyGame({ code }: { code: string }) {
  const [searchParams] = useSearchParams();
  const asPlayer = searchParams.get('as') === 'player';
  const { t } = useI18n();
  const td = t.dirty;

  const [stored, setStored] = useState<StoredDirtyGame | null>(() => {
    takeReconnectToken(code);
    return readStoredGame(code);
  });

  // Ecranul mare are prioritate; ?as=player deschide jocul ca jucător pe același dispozitiv.
  const role = stored?.hostToken && !(asPlayer && stored.playerToken) ? 'host' : stored?.playerToken ? 'player' : null;
  const auth = useMemo(
    () => (role === 'host' ? { hostToken: stored?.hostToken } : role === 'player' ? { playerToken: stored?.playerToken } : null),
    [role, stored?.hostToken, stored?.playerToken],
  );
  const { game, connection, accept, refresh } = useDirtyGame(code, auth);

  // Jocul nu mai există (șters după petrecere): dispozitivul uită tot.
  useEffect(() => {
    if (connection === 'gone') forgetStoredGame(code);
  }, [connection, code]);

  // Tokenul nu mai e valid (scos din lobby sau reconectat pe alt telefon): îl uităm.
  useEffect(() => {
    if (connection !== 'forbidden' || !role) return;
    const next = saveStoredGame(code, role === 'host' ? { hostToken: undefined } : { playerToken: undefined, playerId: undefined });
    setStored(next);
  }, [connection, role, code]);

  // Ține minte jocul în desfășurare, pentru „Revino în joc”.
  useEffect(() => {
    if (!game) return;
    if (game.status !== 'finished') setCurrentGame(game.code);
    // După o reconectare, dispozitivul află abia acum cine e.
    if (role === 'player' && game.me != null) {
      const me = game.players.find(p => p.id === game.me);
      const saved = readStoredGame(code);
      if (me && (saved?.playerId !== me.id || saved?.nickname !== me.nickname)) {
        saveStoredGame(code, { playerId: me.id, nickname: me.nickname });
      }
    }
  }, [game, role, code]);

  const back = <Link to="/dirty-santa"><Button size="large">{td.backToStart}</Button></Link>;
  let content;
  if (connection === 'gone') {
    content = (
      <section className="dirty-card dirty-center">
        <ThiefCharacter role="santa" size={110} />
        <h2>{td.gone}</h2>
        {back}
      </section>
    );
  } else if (!role || !auth) {
    content = <JoinScreen code={code} onJoined={setStored} />;
  } else if (!game) {
    content = <div className="dirty-center dirty-pad"><Spin size="large" /></div>;
  } else if (role === 'host') {
    content = (
      <HostScreen game={game} auth={auth} connection={connection} accept={accept} refresh={refresh} alsoPlayer={!!stored?.playerToken} />
    );
  } else {
    content = <PlayerScreen game={game} auth={auth} connection={connection} accept={accept} refresh={refresh} />;
  }

  return <DirtyLayout wide={role === 'host'}>{content}</DirtyLayout>;
}
