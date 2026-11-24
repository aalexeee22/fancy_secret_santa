import { useEffect, useState } from 'react';
import { App, Button, Input, Spin } from 'antd';
import { Link } from 'react-router-dom';
import { getDirtyInfo, joinDirtyGame } from '../../api/client';
import type { DirtyGameInfo } from '../../types';
import { saveStoredGame, setCurrentGame, type StoredDirtyGame } from '../../dirty/storage';
import { useI18n } from '../../i18n/i18nContext';
import ThiefCharacter from './ThiefCharacter';

/** Intrarea în joc, prin QR, link sau cod. După start nu mai intră nimeni nou. */
export default function JoinScreen({ code, onJoined }: { code: string; onJoined: (stored: StoredDirtyGame) => void }) {
  const { t, locale } = useI18n();
  const td = t.dirty;
  const { message } = App.useApp();
  const [info, setInfo] = useState<DirtyGameInfo | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [nickname, setNickname] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let active = true;
    getDirtyInfo(code)
      .then(data => { if (active) { setInfo(data); setState('ready'); } })
      .catch(err => { if (active) setState(err?.response?.status === 404 ? 'missing' : 'error'); });
    return () => { active = false; };
  }, [code]);

  const join = async () => {
    const name = nickname.trim();
    if (!name) return;
    setJoining(true);
    try {
      const result = await joinDirtyGame(code, name);
      const stored = saveStoredGame(result.code, { playerToken: result.token, playerId: result.player_id, nickname: result.nickname });
      setCurrentGame(result.code);
      onJoined(stored);
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.status) setInfo(current => (current ? { ...current, status: data.status, started_at: data.started_at ?? null } : current));
      message.error(data?.error || td.joinError);
    } finally {
      setJoining(false);
    }
  };

  const back = <Link to="/dirty-santa"><Button size="large">{td.backToStart}</Button></Link>;

  if (state === 'loading') return <div className="dirty-center dirty-pad"><Spin size="large" /></div>;
  if (state === 'missing' || state === 'error' || !info) {
    return (
      <section className="dirty-card dirty-center">
        <ThiefCharacter role="santa" size={110} />
        <h2>{state === 'missing' ? td.notFound : td.loadError}</h2>
        <p className="dirty-muted">{td.checkCode}</p>
        {back}
      </section>
    );
  }

  if (info.status !== 'lobby') {
    const time = info.started_at
      ? new Date(info.started_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
      : '';
    return (
      <section className="dirty-card dirty-center">
        <ThiefCharacter role="santa" size={110} />
        <h2>{info.status === 'playing' ? td.startedAt(time) : td.finished}</h2>
        {back}
      </section>
    );
  }

  return (
    <section className="dirty-card dirty-join">
      <div className="dirty-center">
        <ThiefCharacter role="santa" size={120} className="dirty-wink" />
        <h1>Dirty Santa</h1>
        <div className="dirty-code-pill">{info.code}</div>
        <p className="dirty-muted">
          {td.playersWaiting(info.player_count)}
          {info.budget != null && <> · {td.budgetLine(info.budget)}</>}
        </p>
      </div>
      <label className="dirty-label" htmlFor="dirty-nickname">{td.nicknameLabel}</label>
      <Input
        id="dirty-nickname"
        size="large"
        maxLength={20}
        value={nickname}
        placeholder={td.nicknamePlaceholder}
        onChange={e => setNickname(e.target.value)}
        onPressEnter={join}
        autoComplete="nickname"
        autoFocus
      />
      <Button type="primary" size="large" block loading={joining} disabled={!nickname.trim()} onClick={join} className="dirty-reveal-btn">
        {td.enterGame}
      </Button>
      <p className="dirty-note">{td.privacyNote}</p>
    </section>
  );
}
