import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, App, Card, Col, Form, Input, InputNumber, Row, Select } from 'antd';
import { createGroup, getEmailConfig } from '../api/client';
import AnimatedGift from '../components/christmas/AnimatedGift';
import FestiveButton from '../components/christmas/FestiveButton';
import Character from '../components/christmas/Character';
import EmailSetupHelp from '../components/EmailSetupHelp';
import { useChristmasConfetti } from '../components/christmas/confettiContext';
import { useI18n } from '../i18n/i18nContext';

const PROVIDERS = [
  { label: 'Gmail', value: 'gmail' },
  { label: 'Yahoo', value: 'yahoo' },
];

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

interface CreateForm {
  name?: string;
  budget?: number | null;
  smtp_provider?: string;
  smtp_email?: string;
  smtp_password?: string;
}

export default function Create() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { create: t } = useI18n().t;
  const fireConfetti = useChristmasConfetti();
  const [form] = Form.useForm<CreateForm>();
  const [loading, setLoading] = useState(false);
  const [emailConfig, setEmailConfig] = useState<{ unavailable_providers: string[]; blocked_smtp_ports: number[] } | null>(null);
  const [configError, setConfigError] = useState(false);
  useEffect(() => {
    let active = true;
    getEmailConfig().then(data => { if (active) setEmailConfig(data); })
      .catch(() => { if (active) setConfigError(true); });
    return () => { active = false; };
  }, []);

  const values = Form.useWatch([], form) ?? {};
  const provider = PROVIDERS.find(p => p.value === values.smtp_provider);
  const unsupportedProvider = (emailConfig?.unavailable_providers ?? []).includes(values.smtp_provider ?? '');
  const showEmailFields = Boolean(values.smtp_provider) && !unsupportedProvider;

  // Etapele cadoului urmăresc doar starea reală a câmpurilor.
  const nameValid = Boolean(values.name?.trim()) && (values.name?.trim().length ?? 0) <= 100;
  const budgetValid = typeof values.budget === 'number' && values.budget >= 1 && values.budget <= 100000;
  const emailReady = showEmailFields && EMAIL_RE.test(values.smtp_email ?? '') && Boolean(values.smtp_password);
  const stage = Number(nameValid) + Number(budgetValid) + Number(emailReady);

  const handleFinish = async (v: CreateForm) => {
    if (unsupportedProvider) return;
    setLoading(true);
    try {
      const group = await createGroup({
        name: v.name!.trim(),
        budget: v.budget ?? undefined,
        smtp_provider: v.smtp_provider,
        smtp_email: v.smtp_provider ? v.smtp_email : undefined,
        smtp_password: v.smtp_provider ? v.smtp_password : undefined,
      });
      fireConfetti();
      message.success(t.created);
      if (group.admin_email_sent) {
        message.success(t.adminLinkSent(v.smtp_email ?? ''), 6);
      } else if (v.smtp_provider) {
        message.warning(t.adminLinkNotSent, 8);
      }
      navigate(`/admin#${group.admin_code}`, { state: { justCreated: true } });
    } catch (err: any) {
      message.error(err.response?.data?.error || t.createError);
    } finally {
      setLoading(false);
    }
  };

  const labelStyle = { fontWeight: 600, color: '#2c3e50' };

  return (
    <div style={{ minHeight: '90vh', padding: '40px 20px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: '3rem' }} className="xmas-float">🎄</div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '2.2rem', marginTop: 12, color: '#2c3e50' }}>{t.title}</h1>
          <p style={{ color: '#7f8c8d' }}>{t.subtitle}</p>
        </div>

        <Row gutter={[32, 24]} align="top">
          {/* Cadoul: deasupra formularului pe mobil, în dreapta pe desktop */}
          <Col xs={{ span: 24, order: 1 }} lg={{ span: 9, order: 2 }}>
            <Card
              className="xmas-hover-lift"
              style={{ position: 'sticky', top: 100, textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,0.08)' }}
              styles={{ body: { padding: '24px 20px' } }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 4 }}>
                <Character key={stage} role="elf" className={`xmas-elf${stage ? ' xmas-elf--hop' : ''}`} />
                <div className="xmas-gift-panel__gift">
                  <AnimatedGift box={nameValid} ribbon={budgetValid} sparkles={emailReady} />
                </div>
              </div>
              <div aria-live="polite" style={{ fontWeight: 700, color: nameValid && emailReady ? '#1E8449' : '#7f8c8d', margin: '12px 0 8px' }}>
                {nameValid && emailReady ? t.giftReady : nameValid ? t.giftNeedsEmail : t.giftNeedsName}
              </div>
              <ul className="xmas-gift-panel__steps" style={{ listStyle: 'none', textAlign: 'left', display: 'grid', gap: 6, fontSize: '0.88rem', color: '#5d6d7e' }}>
                <li>{nameValid ? '✅' : '○'} {t.stepBox} <strong>{t.required}</strong></li>
                <li>{budgetValid ? '✅' : '○'} {t.stepRibbon}</li>
                <li>{emailReady ? '✅' : '○'} {t.stepSparkles} <strong>{t.required}</strong></li>
              </ul>
            </Card>
          </Col>

          <Col xs={{ span: 24, order: 2 }} lg={{ span: 15, order: 1 }}>
            <Card className="xmas-hover-lift" style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.08)' }} styles={{ body: { padding: 'clamp(22px, 5vw, 40px)' } }}>
              <span className="xmas-corner-star" aria-hidden="true">⭐</span>
              <Form form={form} layout="vertical" onFinish={handleFinish} requiredMark={false} size="large" validateTrigger={['onChange', 'onBlur']}>
                <Form.Item
                  name="name"
                  label={<span style={labelStyle}>{t.nameLabel}</span>}
                  hasFeedback
                  rules={[
                    { required: true, whitespace: true, message: t.nameRequired },
                    { max: 100, message: t.nameMax },
                  ]}
                >
                  <Input placeholder={t.namePlaceholder} maxLength={100} />
                </Form.Item>

                <Form.Item
                  name="budget"
                  label={<span style={labelStyle}>{t.budgetLabel} <span style={{ fontWeight: 400, color: '#95a5a6' }}>{t.optional}</span></span>}
                  hasFeedback={budgetValid}
                  extra={t.budgetExtra}
                  rules={[{ type: 'number', min: 1, max: 100000, message: t.budgetRange }]}
                >
                  <InputNumber placeholder={t.budgetPlaceholder} min={1} max={100000} step={10} suffix="RON" style={{ width: '100%' }} />
                </Form.Item>

                <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 24 }}>
                  <h2 style={{ color: '#2c3e50', fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>{t.emailHeading}</h2>
                  <p style={{ color: '#7f8c8d', fontSize: '0.85rem', marginBottom: 16 }}>
                    {t.emailIntro}
                  </p>

                  <Form.Item
                    name="smtp_provider"
                    label={<span style={labelStyle}>{t.providerLabel}</span>}
                    rules={[{ required: true, message: t.providerRequired }]}
                  >
                    <Select
                      loading={!emailConfig && !configError}
                      placeholder={t.providerPlaceholder}
                      options={PROVIDERS.map(p => ({ label: p.label, value: p.value, disabled: emailConfig?.unavailable_providers.includes(p.value) }))}
                      onChange={() => form.setFieldsValue({ smtp_password: undefined })}
                    />
                  </Form.Item>

                  {configError && <Alert type="warning" showIcon title={t.configError} style={{ marginBottom: 16 }} />}
                  {Boolean(emailConfig?.unavailable_providers.length) && <Alert type="info" showIcon title={t.providersBlocked} style={{ marginBottom: 16 }} />}

                  {values.smtp_provider && <EmailSetupHelp key={values.smtp_provider} provider={values.smtp_provider} />}

                  {showEmailFields && (
                    <>
                      {provider && <Alert type="info" showIcon title={t.providerHints[provider.value]} style={{ marginBottom: 16 }} />}
                      <Form.Item
                        name="smtp_email"
                        label={<span style={labelStyle}>{t.addressLabel}</span>}
                        hasFeedback
                        rules={[
                          { required: true, message: t.addressRequired },
                          { type: 'email', message: t.addressInvalid },
                        ]}
                      >
                        <Input type="email" placeholder="exemplu@email.com" autoComplete="email" />
                      </Form.Item>
                      <Form.Item
                        name="smtp_password"
                        label={<span style={labelStyle}>{t.passwordLabel}</span>}
                        extra={t.passwordExtra}
                        rules={[{ required: true, message: t.passwordRequired }]}
                      >
                        <Input.Password placeholder={t.passwordPlaceholder} autoComplete="new-password" />
                      </Form.Item>

                    </>
                  )}
                </div>

                <FestiveButton htmlType="submit" tone="red" block loading={loading} disabled={unsupportedProvider} gift={loading ? undefined : <Character role="santa" />} style={{ marginTop: 8 }}>
                  {loading ? t.submitting : t.submit}
                </FestiveButton>
              </Form>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
}
