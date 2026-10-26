import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Alert, App, Avatar, Button, Card, Checkbox, Col, Input, Popconfirm, Result, Row, Space, Spin, Tag } from 'antd';
import { getAdminGroup, drawNames, resendEmails, deleteParticipant } from '../api/client';
import type { SantaGroup } from '../types';
import AnimatedGift from '../components/christmas/AnimatedGift';
import ChristmasDrawModal, { type DrawOutcome, type DrawPhase } from '../components/christmas/ChristmasDrawModal';
import ChristmasEmptyState from '../components/christmas/ChristmasEmptyState';
import FestiveButton from '../components/christmas/FestiveButton';
import GiftSackProgress from '../components/christmas/GiftSackProgress';
import HolidaySparkles from '../components/christmas/HolidaySparkles';
import { GoldLock, HangingBauble, PineBranch } from '../components/christmas/Ornaments';
import { useChristmasConfetti } from '../components/christmas/confettiContext';
import Character from '../components/christmas/Character';
import { useThemeEmoji } from '../components/christmas/themeContext';
import { useI18n } from '../i18n/i18nContext';

// Pragul backendului (santa_service.py): minim 2 participanți.
const MIN_PARTICIPANTS = 2;
const REFRESH_MS = 15000;
const AVATAR_COLORS = ['#C0392B', '#27AE60', '#F39C12', '#3498DB', '#9B59B6', '#E91E63'];
const CARD_STARS = [
  { top: '18%', left: '62%', size: 12, delay: '0s' },
  { top: '58%', left: '84%', size: 16, delay: '1.3s' },
  { top: '80%', left: '56%', size: 10, delay: '2.4s' },
];

async function copyToClipboard(text: string) {
  if (!navigator.clipboard?.writeText) throw new Error('clipboard indisponibil');
  await navigator.clipboard.writeText(text);
}

// Fiecare cod de admin are pagina lui: altfel starea „expirat” a unui grup ar rămâne
// afișată și după ce se deschide linkul altui grup în același tab.
export default function Admin() {
  return <AdminPage key={useLocation().hash} />;
}

function AdminPage() {
  // Codul stă după "#": partea asta din URL nu e trimisă niciodată serverului.
  const location = useLocation();
  const adminCode = location.hash.slice(1);
  const justCreated = Boolean((location.state as { justCreated?: boolean } | null)?.justCreated);
  const { message } = App.useApp();
  const fireConfetti = useChristmasConfetti();
  const { avatarBadge } = useThemeEmoji();
  const { admin: t } = useI18n().t;

  const [group, setGroup] = useState<SantaGroup | null>(null);
  const [loading, setLoading] = useState(Boolean(adminCode));
  const [expired, setExpired] = useState(false);
  const [resending, setResending] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [retryUncertain, setRetryUncertain] = useState(false);
  const [joinSparks, setJoinSparks] = useState(0);
  const [adminSparks, setAdminSparks] = useState(0);
  const [showWelcome, setShowWelcome] = useState(justCreated);
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  const [drawOpen, setDrawOpen] = useState(false);
  const [drawPhase, setDrawPhase] = useState<DrawPhase>('confirm');
  const [drawError, setDrawError] = useState<string | null>(null);
  const [drawOutcome, setDrawOutcome] = useState<DrawOutcome | null>(null);

  // Participanții de la prima încărcare intră în cascadă; cei noi, imediat.
  const [initialIds, setInitialIds] = useState<Set<number> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!adminCode) return;
    try {
      const data: SantaGroup = await getAdminGroup(adminCode);
      setInitialIds(previous => previous ?? new Set(data.participants.map(p => p.id)));
      setGroup(data);
    } catch (err: any) {
      if (err.response?.status === 410) setExpired(true);
      else if (!silent) message.error(t.notFound);
    } finally {
      setLoading(false);
    }
  }, [adminCode, message, t]);

  useEffect(() => { load(); }, [load]);

  // Urmărim și livrarea în fundal, inclusiv o încercare întreruptă în curs de verificare.
  const waitingForJoins = Boolean(group && (!group.is_drawn || group.emails_pending > 0)) && !(drawOpen && drawPhase === 'drawing');
  useEffect(() => {
    if (!waitingForJoins) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load(true);
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [waitingForJoins, load]);

  // Cadoul de bun venit se deschide după ce pagina noului grup s-a încărcat.
  useEffect(() => {
    if (!showWelcome || !group) return;
    const timer = window.setTimeout(() => setWelcomeOpen(true), 350);
    return () => window.clearTimeout(timer);
  }, [showWelcome, group]);

  const openDraw = () => {
    setDrawPhase('confirm');
    setDrawError(null);
    setDrawOpen(true);
  };

  const confirmDraw = async () => {
    if (!adminCode) return;
    setDrawPhase('drawing');
    setDrawError(null);
    try {
      const data: SantaGroup = await drawNames(adminCode);
      setGroup(data);
      setDrawOutcome({ hasEmail: data.has_email, emailsSent: data.emails_sent, failedCount: data.failed_emails.length, pendingCount: data.emails_pending });
      setDrawPhase('success');
      fireConfetti();
    } catch (err: any) {
      setDrawError(err.response?.data?.error || t.drawError);
      setDrawPhase('error');
      if (err.response?.status === 409) load(true);
    }
  };

  const handleResend = async () => {
    if (!group) return;
    setResending(true);
    try {
      const data: SantaGroup = await resendEmails(adminCode, newPassword, retryUncertain);
      setGroup(data);
      setNewPassword('');
      setRetryUncertain(false);
      if (data.emails_pending > 0) {
        message.info(t.queued);
      } else if (data.failed_emails.length === 0) {
        message.success(t.allSent);
        fireConfetti();
      } else {
        message.error(t.stillFailed(data.failed_emails.length));
      }
    } catch (err: any) {
      message.error(err.response?.data?.error || t.resendError);
    } finally {
      setResending(false);
    }
  };

  const handleDelete = async (participantId: number, name: string) => {
    try {
      setGroup(await deleteParticipant(adminCode, participantId));
      message.success(t.removed(name));
    } catch (err: any) {
      message.error(err.response?.data?.error || t.removeError);
    }
  };

  const copyJoinLink = async () => {
    if (!group) return;
    try {
      await copyToClipboard(`${window.location.origin}/join/${group.code}`);
      setJoinSparks(n => n + 1);
      message.success(t.copied);
    } catch {
      message.error(t.copyFailed);
    }
  };

  const copyAdminLink = async () => {
    try {
      await copyToClipboard(window.location.href);
      setAdminSparks(n => n + 1);
      message.success(t.adminCopied);
    } catch {
      message.error(t.adminCopyFailed);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '100px 20px' }}><Spin size="large" /></div>;
  if (expired) return (
    <div style={{ minHeight: 'calc(100svh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <Card style={{ maxWidth: 480, boxShadow: '0 8px 32px rgba(0,0,0,0.06)' }}>
        <Result
          icon={<span style={{ fontSize: '3.5rem' }} aria-hidden="true">🎁</span>}
          title={<span style={{ fontFamily: 'Georgia, serif' }}>{t.expiredTitle}</span>}
          subTitle={t.expiredText}
        />
      </Card>
    </div>
  );
  if (!group) return (
    <Result status="warning" title={t.notFound} subTitle={t.notFoundText} />
  );

  const joinLink = `${window.location.origin}/join/${group.code}`;
  const ready = group.participant_count >= MIN_PARTICIPANTS;
  const missing = MIN_PARTICIPANTS - group.participant_count;

  return (
    <div style={{ minHeight: '90vh', padding: '40px 20px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {showWelcome && (
          <Card className="xmas-fade-in" style={{ marginBottom: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.06)' }} styles={{ body: { padding: '18px 22px' } }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
              <div style={{ width: 90, flexShrink: 0 }}>
                <AnimatedGift box ribbon sparkles open={welcomeOpen} />
              </div>
              <div style={{ flex: 1, minWidth: 220 }} role="status">
                <h2 style={{ fontFamily: 'Georgia, serif', color: '#1E8449', fontSize: '1.3rem' }}>{t.welcomeTitle}</h2>
                <p style={{ color: '#5d6d7e' }}>{t.welcomeText}</p>
              </div>
              <Button type="text" onClick={() => setShowWelcome(false)} aria-label={t.closeWelcome}>✕</Button>
            </div>
          </Card>
        )}

        <Row gutter={[30, 24]} align="top">
          {/* Sidebar */}
          <Col xs={24} lg={9}>
            <div className="xmas-greeting" style={{ marginBottom: 20 }}>
              <PineBranch className="xmas-greeting__branch" withBauble={false} />
              <HangingBauble className="xmas-greeting__bauble" size={28} string={35} color="#D5A538" />
              {CARD_STARS.map(s => (
                <span key={s.left} className="xmas-greeting__star" aria-hidden="true" style={{ top: s.top, left: s.left, fontSize: s.size, animationDelay: s.delay }}>✦</span>
              ))}
              <div style={{ position: 'relative' }}>
                <Character role="santa" style={{ display: 'block', fontSize: '2.5rem', marginBottom: 12 }} />
                <h1 style={{ fontFamily: 'Georgia, serif', margin: '0 0 8px', fontSize: '1.4rem', color: '#fff', paddingRight: 70 }}>{group.name}</h1>
                <Space wrap size={8} style={{ marginBottom: 16 }}>
                  <Tag color="rgba(255,255,255,0.2)" style={{ color: '#fff', borderRadius: 20, padding: '2px 12px', fontSize: '0.85rem' }}>
                    {t.participantsTag(group.participant_count)}
                  </Tag>
                  {group.is_drawn && (
                    <Tag color="#27AE60" style={{ borderRadius: 20, padding: '2px 12px', fontSize: '0.85rem' }}>{t.drawnTag}</Tag>
                  )}
                </Space>
                <div style={{ opacity: 0.85, fontSize: '0.9rem' }}>{t.budgetLabel}</div>
                <div className="xmas-budget-pill" style={{ fontSize: group.min_budget_ron != null ? '1.5rem' : '1.05rem' }}>
                  {group.min_budget_ron != null ? `${Math.round(group.min_budget_ron)} RON` : t.noBudget}
                </div>
              </div>
            </div>

            <Card title={t.joinLinkTitle} style={{ marginBottom: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
              <Space.Compact style={{ width: '100%' }}>
                <Input readOnly value={joinLink} aria-label={t.joinLinkAria} onFocus={e => e.target.select()} />
                <span style={{ position: 'relative', display: 'inline-flex' }}>
                  <Button type="primary" onClick={copyJoinLink} aria-label={t.copyJoinAria} className={joinSparks ? 'xmas-pop' : undefined} key={joinSparks}>
                    📋
                  </Button>
                  <HolidaySparkles trigger={joinSparks} />
                </span>
              </Space.Compact>
              <div style={{ marginTop: 8, color: '#7f8c8d', fontSize: '0.8rem' }}>{t.joinLinkHint}</div>

              <div className="xmas-parchment">
                <GoldLock className="xmas-parchment__lock" />
                <strong>{t.secretStrong}</strong>{t.secretText}
                <div style={{ position: 'relative', display: 'inline-block', marginTop: 10 }}>
                  <FestiveButton tone="gold" small onClick={copyAdminLink}>{t.copyAdmin}</FestiveButton>
                  <HolidaySparkles trigger={adminSparks} />
                </div>
              </div>
            </Card>

            {!group.is_drawn ? (
              <Card style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                <GiftSackProgress count={group.participant_count} minimum={MIN_PARTICIPANTS} />
                {!group.has_email && (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginTop: 16 }}
                    title={t.noEmailTitle}
                    description={t.noEmailText}
                  />
                )}
                <div style={{ marginTop: 16 }}>
                  {ready ? (
                    <FestiveButton tone="red" block gift="🎁" className="xmas-draw-ready" onClick={openDraw}>
                      {t.drawButton}
                    </FestiveButton>
                  ) : (
                    <FestiveButton tone="red" block disabled gift="⏳">
                      {t.missing(missing)}
                    </FestiveButton>
                  )}
                </div>
              </Card>
            ) : group.emails_pending > 0 || group.failed_emails.length > 0 ? (
              <Card style={{ border: '2px solid #F39C12' }}>
                {group.emails_pending > 0 && <Alert type="info" showIcon
                  title={t.sendingTitle(group.emails_sent, group.participant_count)}
                  description={t.sendingText(group.emails_pending)}
                  style={{ marginBottom: 12 }} />}
                {group.failed_emails.length > 0 && <>
                <Alert
                  type="warning"
                  showIcon
                  title={t.attentionTitle(group.failed_emails.length)}
                  description={t.attentionText(group.failed_emails.join(', '))}
                  style={{ marginBottom: 12 }}
                />
                {group.uncertain_emails.length > 0 && <>
                  <Alert type="warning" showIcon style={{ marginBottom: 12 }}
                    title={t.uncertainTitle}
                    description={t.uncertainText(group.uncertain_emails.join(', '))} />
                  <Checkbox checked={retryUncertain} onChange={e => setRetryUncertain(e.target.checked)} style={{ marginBottom: 12 }}>
                    {t.retryUncertain}
                  </Checkbox>
                </>}
                <Input.Password
                  placeholder={t.newPassword}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  style={{ marginBottom: 10 }}
                />
                <FestiveButton tone="gold" block small loading={resending} onClick={handleResend}>
                  {resending ? t.preparing : t.retry}
                </FestiveButton>
                </>}
                <p style={{ color: '#95a5a6', fontSize: '0.8rem', margin: '8px 0 0' }}>
                  {t.linkValidUntil}
                </p>
              </Card>
            ) : (
              <div className="xmas-fade-in" style={{ background: 'linear-gradient(135deg,#27AE60,#164B32)', borderRadius: 16, padding: 20, textAlign: 'center', color: '#fff' }}>
                <div style={{ fontSize: '2rem' }} aria-hidden="true">🎉</div>
                <strong>{t.doneTitle}</strong>
                <p style={{ opacity: 0.9, fontSize: '0.9rem', margin: '8px 0 0' }}>
                  {group.has_email ? t.doneWithEmail : t.doneNoEmail}
                </p>
              </div>
            )}
          </Col>

          {/* Main content — doar lista de nume, fără wishlist sau repartizări */}
          <Col xs={24} lg={15}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '1.3rem', marginBottom: 6, color: '#2c3e50' }}>
              {t.participantsHeading(group.participant_count)}
            </h2>
            {!group.is_drawn && (
              <p style={{ color: '#95a5a6', fontSize: '0.82rem', marginBottom: 16 }}>{t.autoRefresh}</p>
            )}

            {group.participants.length === 0 ? (
              <Card style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                <ChristmasEmptyState
                  prop="✉️"
                  title={t.emptyTitle}
                  description={t.emptyText}
                  action={<FestiveButton tone="green" small gift="🔗" onClick={copyJoinLink}>{t.copyInvite}</FestiveButton>}
                />
              </Card>
            ) : (
              <Row gutter={[16, 16]} style={{ marginBottom: 30 }}>
                {group.participants.map((p, i) => {
                  const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
                  const isInitial = initialIds?.has(p.id);
                  return (
                    <Col xs={24} sm={12} key={p.id}>
                      <Card
                        size="small"
                        className="xmas-participant xmas-hover-lift"
                        style={{ borderLeft: `4px solid ${color}`, boxShadow: '0 4px 16px rgba(0,0,0,0.06)', animationDelay: isInitial ? `${i * 70}ms` : '0ms' }}
                        styles={{ body: { padding: 16 } }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ position: 'relative', flexShrink: 0 }}>
                            <Avatar
                              size={44}
                              style={{ background: `linear-gradient(135deg, ${color}, ${AVATAR_COLORS[(i + 1) % AVATAR_COLORS.length]})`, fontWeight: 800, border: '2px solid #D5A538' }}
                            >
                              {p.name[0].toUpperCase()}
                            </Avatar>
                            <span aria-hidden="true" style={{ position: 'absolute', top: -10, left: 18, fontSize: 16, transform: 'rotate(18deg)' }}>{avatarBadge}</span>
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: '#2c3e50' }}>{p.name}</div>
                            <div style={{ fontSize: '0.8rem', color: '#7f8c8d', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.email}</div>
                          </div>
                          {!group.is_drawn && (
                            <Popconfirm
                              title={t.removeConfirm(p.name)}
                              okText={t.removeOk}
                              cancelText={t.removeCancel}
                              onConfirm={() => handleDelete(p.id, p.name)}
                            >
                              <Button type="text" aria-label={t.removeAria(p.name)} title={t.removeAria(p.name)} style={{ color: '#bdc3c7' }}>✕</Button>
                            </Popconfirm>
                          )}
                        </div>
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            )}

            {group.is_drawn && (
              <Card className="xmas-fade-in" style={{ textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }} styles={{ body: { padding: 32 } }}>
                <div style={{ fontSize: '3rem', marginBottom: 12 }} aria-hidden="true">🤫</div>
                <h2 style={{ fontFamily: 'Georgia, serif', color: '#2c3e50', fontSize: '1.2rem' }}>{t.secretTitle}</h2>
                <p style={{ color: '#7f8c8d', maxWidth: 400, margin: '8px auto 0', lineHeight: 1.7 }}>
                  {group.has_email ? t.secretWithEmail : t.secretNoEmail}
                  {t.secretEnd}
                </p>
              </Card>
            )}
          </Col>
        </Row>
      </div>

      <ChristmasDrawModal
        open={drawOpen}
        phase={drawPhase}
        participantCount={group.participant_count}
        hasEmail={group.has_email}
        outcome={drawOutcome}
        error={drawError}
        onConfirm={confirmDraw}
        onClose={() => setDrawOpen(false)}
      />
    </div>
  );
}
