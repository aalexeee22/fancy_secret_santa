import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { App, Card, Form, Input, Result, Spin } from 'antd';
import { getGroup, addParticipant } from '../api/client';
import type { PublicGroup } from '../types';
import FestiveButton from '../components/christmas/FestiveButton';
import Character from '../components/christmas/Character';

interface JoinForm {
  name: string;
  email: string;
  wishlist?: string;
}

export default function Join() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [group, setGroup] = useState<PublicGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!code) return;
    getGroup(code)
      .then(setGroup)
      .catch(() => message.error('Grupul nu a fost găsit!'))
      .finally(() => setLoading(false));
  }, [code, message]);

  const handleFinish = async (values: JoinForm) => {
    if (!code) return;
    setSubmitting(true);
    try {
      const result = await addParticipant(code, { name: values.name.trim(), email: values.email.trim(), wishlist: values.wishlist?.trim() });
      navigate(`/join/${code}/success`, { state: { name: result.name, groupName: result.group_name, budget: result.min_budget_ron, count: result.participant_count } });
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Eroare la înregistrare');
    } finally {
      setSubmitting(false);
    }
  };

  const labelStyle = { fontWeight: 600, color: '#2c3e50' };

  if (loading) return <div style={{ textAlign: 'center', padding: '100px' }}><Spin size="large" /></div>;
  if (!group) return <Result status="warning" title="Grupul nu a fost găsit." subTitle="Verifică linkul primit de la organizator." />;

  return (
    <div style={{ minHeight: '90vh', padding: '40px 20px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 540 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div className="xmas-float" style={{ fontSize: '3rem' }} aria-hidden="true">🎁</div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '2rem', color: '#2c3e50', marginTop: 12 }}>{group.name}</h1>
          {group.min_budget_ron != null && (
            <div style={{ marginTop: 12 }}>
              <span className="xmas-budget-pill">💰 Buget minim: {Math.round(group.min_budget_ron)} RON</span>
            </div>
          )}
          {!group.is_drawn && <p style={{ color: '#7f8c8d', marginTop: 12 }}>Alătură-te Secret Santa-ului! 🎄</p>}
        </div>

        {group.is_drawn ? (
          <Card style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
            <Result
              icon={<span style={{ fontSize: '3rem' }} aria-hidden="true">🔒</span>}
              title={<span style={{ fontFamily: 'Georgia, serif' }}>Înscrierea s-a închis</span>}
              subTitle="Tragerile au fost deja efectuate. Data viitoare!"
            />
          </Card>
        ) : (
          <Card className="xmas-hover-lift" style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.08)' }} styles={{ body: { padding: 'clamp(22px, 5vw, 40px)' } }}>
            <span className="xmas-corner-star" aria-hidden="true">⭐</span>
            <Form layout="vertical" onFinish={handleFinish} requiredMark={false} size="large">
              <Form.Item
                name="name"
                label={<span style={labelStyle}>👤 Numele tău *</span>}
                rules={[
                  { required: true, whitespace: true, message: 'Completează-ți numele!' },
                  { max: 100, message: 'Numele poate avea maxim 100 de caractere.' },
                ]}
              >
                <Input placeholder="Prenume și Nume" maxLength={100} autoComplete="name" />
              </Form.Item>
              <Form.Item
                name="email"
                label={<span style={labelStyle}>📧 Email *</span>}
                extra="Vei primi pe email cui îți este repartizat să îi faci cadou."
                rules={[
                  { required: true, message: 'Completează emailul!' },
                  { type: 'email', message: 'Adresa de email nu este validă.' },
                ]}
              >
                <Input type="email" placeholder="email@exemplu.com" autoComplete="email" />
              </Form.Item>
              <Form.Item
                name="wishlist"
                label={<span style={labelStyle}>📝 Lista de dorințe</span>}
                extra="Opțional, dar ajută mult Secret Santa-ul tău! 😊"
                rules={[{ max: 2000, message: 'Lista poate avea maxim 2000 de caractere.' }]}
              >
                <Input.TextArea
                  autoSize={{ minRows: 4, maxRows: 10 }}
                  maxLength={2000}
                  placeholder={'Ce ți-ar plăcea să primești de Crăciun? 🎄\nex: o carte bună, căști wireless, o lumânare parfumată...'}
                />
              </Form.Item>
              <FestiveButton htmlType="submit" tone="red" block loading={submitting} gift={submitting ? undefined : <Character role="santa" />}>
                {submitting ? 'Se înregistrează...' : 'Mă înscriu!'}
              </FestiveButton>
            </Form>
          </Card>
        )}
      </div>
    </div>
  );
}
