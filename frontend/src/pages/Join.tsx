import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { App, Card, Form, Input, Result, Spin } from 'antd';
import { getGroup, addParticipant } from '../api/client';
import type { PublicGroup } from '../types';
import FestiveButton from '../components/christmas/FestiveButton';
import Character from '../components/christmas/Character';
import { useI18n } from '../i18n/i18nContext';

interface JoinForm {
  name: string;
  email: string;
  wishlist?: string;
}

export default function Join() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { t: messages } = useI18n();
  const t = messages.join;
  const notFound = messages.common.groupNotFound;
  const [group, setGroup] = useState<PublicGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!code) return;
    getGroup(code)
      .then(setGroup)
      .catch(() => message.error(notFound))
      .finally(() => setLoading(false));
  }, [code, message, notFound]);

  const handleFinish = async (values: JoinForm) => {
    if (!code) return;
    setSubmitting(true);
    try {
      const result = await addParticipant(code, { name: values.name.trim(), email: values.email.trim(), wishlist: values.wishlist?.trim() });
      navigate(`/join/${code}/success`, { state: { name: result.name, groupName: result.group_name, budget: result.min_budget_ron, count: result.participant_count } });
    } catch (err: any) {
      message.error(err.response?.data?.error || t.joinError);
    } finally {
      setSubmitting(false);
    }
  };

  const labelStyle = { fontWeight: 600, color: '#2c3e50' };

  if (loading) return <div style={{ textAlign: 'center', padding: '100px' }}><Spin size="large" /></div>;
  if (!group) return <Result status="warning" title={notFound} subTitle={t.notFoundText} />;

  return (
    <div style={{ minHeight: '90vh', padding: '40px 20px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 540 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div className="xmas-float" style={{ fontSize: '3rem' }} aria-hidden="true">🎁</div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '2rem', color: '#2c3e50', marginTop: 12 }}>{group.name}</h1>
          {group.min_budget_ron != null && (
            <div style={{ marginTop: 12 }}>
              <span className="xmas-budget-pill">💰 {messages.common.budgetMin(Math.round(group.min_budget_ron))}</span>
            </div>
          )}
          {!group.is_drawn && <p style={{ color: '#7f8c8d', marginTop: 12 }}>{t.joinIntro}</p>}
        </div>

        {group.is_drawn ? (
          <Card style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
            <Result
              icon={<span style={{ fontSize: '3rem' }} aria-hidden="true">🔒</span>}
              title={<span style={{ fontFamily: 'Georgia, serif' }}>{t.closedTitle}</span>}
              subTitle={t.closedText}
            />
          </Card>
        ) : (
          <Card className="xmas-hover-lift" style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.08)' }} styles={{ body: { padding: 'clamp(22px, 5vw, 40px)' } }}>
            <span className="xmas-corner-star" aria-hidden="true">⭐</span>
            <Form layout="vertical" onFinish={handleFinish} requiredMark={false} size="large">
              <Form.Item
                name="name"
                label={<span style={labelStyle}>{t.nameLabel}</span>}
                rules={[
                  { required: true, whitespace: true, message: t.nameRequired },
                  { max: 100, message: t.nameMax },
                ]}
              >
                <Input placeholder={t.namePlaceholder} maxLength={100} autoComplete="name" />
              </Form.Item>
              <Form.Item
                name="email"
                label={<span style={labelStyle}>{t.emailLabel}</span>}
                extra={t.emailExtra}
                rules={[
                  { required: true, message: t.emailRequired },
                  { type: 'email', message: t.emailInvalid },
                ]}
              >
                <Input type="email" placeholder="email@exemplu.com" autoComplete="email" />
              </Form.Item>
              <Form.Item
                name="wishlist"
                label={<span style={labelStyle}>{t.wishlistLabel}</span>}
                extra={t.wishlistExtra}
                rules={[{ max: 2000, message: t.wishlistMax }]}
              >
                <Input.TextArea
                  autoSize={{ minRows: 4, maxRows: 10 }}
                  maxLength={2000}
                  placeholder={t.wishlistPlaceholder}
                />
              </Form.Item>
              <FestiveButton htmlType="submit" tone="red" block loading={submitting} gift={submitting ? undefined : <Character role="santa" />}>
                {submitting ? t.submitting : t.submit}
              </FestiveButton>
            </Form>
          </Card>
        )}
      </div>
    </div>
  );
}
