import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Card } from 'antd';
import { FestiveLink } from '../components/christmas/FestiveButton';
import { useChristmasConfetti } from '../components/christmas/confettiContext';

interface SuccessState {
  name: string;
  groupName: string;
  budget: number | null;
  count: number;
}

export default function Success() {
  const location = useLocation();
  const state = location.state as SuccessState | null;
  const fireConfetti = useChristmasConfetti();
  const fired = useRef(false);

  // Pagina e afișată doar după o înscriere reușită, deci aici e momentul sărbătorii.
  useEffect(() => {
    if (fired.current || !state) return;
    fired.current = true;
    fireConfetti();
  }, [fireConfetti, state]);

  return (
    <div style={{ minHeight: '90vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <div style={{ maxWidth: 520, width: '100%' }}>
        <Card className="xmas-fade-in" style={{ textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,0.08)' }} styles={{ body: { padding: 'clamp(28px, 6vw, 48px)' } }}>
          <span className="xmas-corner-star" aria-hidden="true">⭐</span>
          <div className="xmas-float" style={{ fontSize: '4rem' }} aria-hidden="true">🎉</div>
          <h1 style={{ fontFamily: 'Georgia, serif', color: '#27AE60', marginTop: 16 }}>Ești în echipă!</h1>
          <p role="status" style={{ color: '#7f8c8d', fontSize: '1.1rem', marginTop: 8 }}>
            <strong>{state?.name || 'Tu'}</strong>, te-ai înscris cu succes la <strong>{state?.groupName || 'Secret Santa'}</strong>!
          </p>
          <div style={{ background: 'linear-gradient(135deg,#EBF5FB,#D6EAF8)', borderRadius: 16, padding: '24px', margin: '24px 0' }}>
            <div style={{ fontSize: '2rem' }} aria-hidden="true">📬</div>
            <p style={{ fontWeight: 700, margin: '8px 0 4px', color: '#2c3e50' }}>Urmărește-ți emailul!</p>
            <p style={{ color: '#5d6d7e', fontSize: '0.9rem', margin: 0 }}>Când organizatorul trage la sorți, vei primi un email cu Secret Santa-ul tău.</p>
          </div>
          <div style={{ background: '#F0FFF4', borderRadius: 12, padding: '12px 20px', marginBottom: 28, borderLeft: '4px solid #27AE60' }}>
            👥 <strong>{state?.count || '?'}</strong> {state?.count === 1 ? 'persoană înscrisă' : 'persoane înscrise'} până acum
            {state?.budget != null && <> · 💰 min. <strong>{Math.round(state.budget)} RON</strong></>}
          </div>
          <FestiveLink to="/" tone="red" small>🏠 Pagina principală</FestiveLink>
        </Card>
      </div>
    </div>
  );
}
