import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { App, Button, InputNumber, Input, Switch } from 'antd';
import { createDirtyGame } from '../api/client';
import { normalizeCode, readCurrentGame, saveStoredGame, setCurrentGame } from '../dirty/storage';
import { useI18n } from '../i18n/i18nContext';
import DirtyLayout from '../components/dirty/DirtyLayout';
import ThiefCharacter from '../components/dirty/ThiefCharacter';

/** Pagina de start: creează un joc pe ecranul mare sau intră cu un cod. */
export default function DirtySanta() {
  const { t } = useI18n();
  const td = t.dirty;
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [current] = useState(() => readCurrentGame());
  const [code, setCode] = useState('');
  const [stealLimit, setStealLimit] = useState(3);
  const [finalRound, setFinalRound] = useState(true);
  const [budget, setBudget] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const join = () => {
    const clean = normalizeCode(code);
    if (clean) navigate(`/dirty-santa/${clean}`);
  };

  const create = async () => {
    setCreating(true);
    try {
      const result = await createDirtyGame({ steal_limit: stealLimit, final_round: finalRound, budget: budget ?? undefined });
      saveStoredGame(result.code, { hostToken: result.host_token });
      setCurrentGame(result.code);
      navigate(`/dirty-santa/${result.code}`);
    } catch (err: any) {
      message.error(err?.response?.data?.error || td.createError);
    } finally {
      setCreating(false);
    }
  };

  return (
    <DirtyLayout>
      <section className="dirty-hero">
        <div className="dirty-hero__cast" aria-hidden="true">
          <ThiefCharacter role="santa" size={150} className="dirty-wink" />
          <ThiefCharacter role="elf" size={110} className="dirty-hero__elf" />
        </div>
        <h1>Dirty Santa</h1>
        <p>{td.subtitle}</p>
      </section>

      {current && (
        <Link to={`/dirty-santa/${current}`} className="dirty-resume">
          <span>{td.resume(current)}</span>
          <strong>{td.resumeButton}</strong>
        </Link>
      )}

      <div className="dirty-start-grid">
        <section className="dirty-card">
          <h2>📱 {td.joinTitle}</h2>
          <p className="dirty-muted">{td.joinIntro}</p>
          <Input
            size="large"
            className="dirty-code-input"
            value={code}
            maxLength={12}
            placeholder="XMAS24"
            aria-label={td.codeLabel}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onPressEnter={join}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
          <Button type="primary" size="large" block disabled={!normalizeCode(code)} onClick={join} className="dirty-reveal-btn">
            {td.joinButton}
          </Button>
        </section>

        <section className="dirty-card">
          <h2>📺 {td.createTitle}</h2>
          <p className="dirty-muted">{td.createIntro}</p>
          <label className="dirty-label" htmlFor="dirty-steal-limit">{td.stealLimit}</label>
          <InputNumber id="dirty-steal-limit" size="large" min={1} max={5} value={stealLimit} onChange={v => setStealLimit(v ?? 3)} style={{ width: '100%' }} />
          <p className="dirty-help">{td.stealLimitHelp}</p>
          <label className="dirty-switch">
            <Switch checked={finalRound} onChange={setFinalRound} />
            <span>{td.finalRound}</span>
          </label>
          <p className="dirty-help">{td.finalRoundHelp}</p>
          <label className="dirty-label" htmlFor="dirty-budget">{td.budget}</label>
          <InputNumber id="dirty-budget" size="large" min={1} max={100000} value={budget} onChange={v => setBudget(v)} placeholder="100" addonAfter="RON" style={{ width: '100%' }} />
          <Button type="primary" size="large" block loading={creating} onClick={create} className="dirty-reveal-btn">
            🎲 {td.create}
          </Button>
        </section>
      </div>

      <section className="dirty-card dirty-how">
        <h2>{td.howTitle}</h2>
        <ol>
          {td.how.map(step => <li key={step}>{step}</li>)}
        </ol>
        <p className="dirty-note">{td.privacyNote}</p>
      </section>
    </DirtyLayout>
  );
}
