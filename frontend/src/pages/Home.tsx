import { Card, Col, Row } from 'antd';
import type { CSSProperties } from 'react';
import { FestiveLink } from '../components/christmas/FestiveButton';
import ChristmasSnow from '../components/christmas/ChristmasSnow';
import FloatingOrnaments from '../components/christmas/FloatingOrnaments';
import RevealOnScroll from '../components/christmas/RevealOnScroll';
import Character from '../components/christmas/Character';
import { HangingBauble } from '../components/christmas/Ornaments';
import { useI18n } from '../i18n/i18nContext';

const NAVBAR_HEIGHT = 64;

// Textele pașilor și ale întrebărilor vin din fișierele de limbă, în aceeași ordine.
const STEP_STYLES = [
  { icon: '🎄', color: '#C0392B' },
  { icon: '🔗', color: '#27AE60' },
  { icon: '📝', color: '#F39C12' },
  { icon: '🎁', color: '#8E44AD' },
];

const FAQ_BAUBLES = ['#D5A538', '#C0392B', '#2a7a52'];

export default function Home() {
  const { t } = useI18n();
  const steps = t.home.steps.map((step, i) => ({ ...step, ...STEP_STYLES[i] }));
  const faqs = t.home.faqs.map((faq, i) => ({ ...faq, bauble: FAQ_BAUBLES[i] }));

  return (
    <div>
      {/* Hero */}
      <div className="home-hero" style={{
        background: 'linear-gradient(135deg, #8B0000 0%, #C0392B 40%, #1a5c2a 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <FloatingOrnaments variant="hero" />
        <ChristmasSnow tone="light" />

        <div style={{ textAlign: 'center', padding: '40px 20px 100px', position: 'relative', zIndex: 1, maxWidth: 700 }}>
          <div className="xmas-float" style={{ fontSize: 'clamp(4rem, 12vw, 6rem)', marginBottom: 8, filter: 'drop-shadow(0 8px 24px rgba(255, 214, 120, 0.45))' }}>
            <Character role="santa" />
          </div>
          <h1 style={{
            fontFamily: 'Georgia, "Playfair Display", serif',
            fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
            fontWeight: 900,
            color: '#fff',
            margin: '16px 0 8px',
            textShadow: '0 4px 20px rgba(0,0,0,0.3), 0 0 40px rgba(242, 205, 107, 0.35)',
            letterSpacing: '-1px',
          }}>
            Secret Santa
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 'clamp(1.05rem, 2.5vw, 1.3rem)', marginBottom: 40, lineHeight: 1.6 }}>
            {t.home.subtitle}
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <FestiveLink to="/create" tone="light" gift="🎁">{t.home.createGroup}</FestiveLink>
            <FestiveLink to="/advent" tone="ghost">{t.home.movies}</FestiveLink>
            <FestiveLink to="/stats" tone="ghost">{t.home.stats}</FestiveLink>
          </div>
        </div>

        {/* Scroll cue */}
        <a href="#cum-functioneaza" className="scroll-cue" style={{
          position: 'absolute',
          bottom: 28,
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'rgba(255,255,255,0.85)',
          textDecoration: 'none',
          fontSize: '0.9rem',
          fontWeight: 600,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          zIndex: 1,
        }}>
          {t.home.howItWorks}
          <span className="scroll-arrow" style={{ fontSize: '1.4rem', lineHeight: 1 }}>↓</span>
        </a>
      </div>

      {/* Cum funcționează: calendar de Advent cu patru ușițe */}
      <section id="cum-functioneaza" style={{ background: '#FFF8F0', padding: '90px 20px', scrollMarginTop: NAVBAR_HEIGHT }}>
        <div style={{ maxWidth: 980, margin: '0 auto' }}>
          <RevealOnScroll style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(2rem, 5vw, 2.5rem)', color: '#2c3e50', marginBottom: 8 }}>{t.home.howItWorks}</h2>
            <p style={{ color: '#7f8c8d', fontSize: '1.1rem' }}>{t.home.howItWorksIntro}</p>
          </RevealOnScroll>

          <Row gutter={[24, 24]}>
            {steps.map((step, i) => (
              <Col xs={24} md={12} key={i}>
                <RevealOnScroll delay={i * 120} style={{ height: '100%' }}>
                  <Card
                    className="advent-card xmas-hover-lift"
                    style={{ borderLeft: `4px solid ${step.color}`, boxShadow: '0 8px 32px rgba(0,0,0,0.06)', '--door': step.color } as CSSProperties}
                    styles={{ body: { padding: '24px 26px' } }}
                  >
                    <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 14 }}>
                      <div className="advent-door" aria-hidden="true">
                        <div className="advent-door__back">{step.icon}</div>
                        <div className="advent-door__front" style={{ transitionDelay: `${300 + i * 250}ms` }}>{i + 1}</div>
                      </div>
                      <div>
                        <span className="advent-number" style={{ animationDelay: `${300 + i * 250}ms` }}>{t.home.door(i + 1)}</span>
                        <h3 style={{ fontFamily: 'Georgia, serif', color: '#2c3e50', fontSize: '1.3rem', lineHeight: 1.25 }}>
                          {step.title}
                        </h3>
                      </div>
                    </div>
                    <p style={{ color: '#5d6d7e', lineHeight: 1.7, marginBottom: 12 }}>{step.desc}</p>
                    <p style={{
                      background: `${step.color}12`,
                      color: '#2c3e50',
                      borderRadius: 10,
                      padding: '10px 14px',
                      fontSize: '0.9rem',
                      lineHeight: 1.5,
                    }}>
                      💡 {step.tip}
                    </p>
                  </Card>
                </RevealOnScroll>
              </Col>
            ))}
          </Row>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ background: '#fff', padding: '80px 20px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <RevealOnScroll>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(1.8rem, 4.5vw, 2.2rem)', color: '#2c3e50', textAlign: 'center', marginBottom: 40 }}>
              {t.home.faqTitle}
            </h2>
          </RevealOnScroll>
          <div style={{ display: 'grid', gap: 16 }}>
            {faqs.map((faq, i) => (
              <RevealOnScroll key={i} delay={i * 80}>
                <div className="xmas-faq xmas-hover-lift" style={{ background: '#FFF8F0', borderRadius: 16, padding: '20px 70px 20px 24px' }}>
                  <HangingBauble className="xmas-faq__ornament" color={faq.bauble} size={20} string={22} />
                  <h3 style={{ fontSize: '1.05rem', color: '#2c3e50', marginBottom: 6 }}>{faq.q}</h3>
                  <p style={{ color: '#5d6d7e', lineHeight: 1.6 }}>{faq.a}</p>
                </div>
              </RevealOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{
        background: 'linear-gradient(135deg, #8B0000 0%, #C0392B 50%, #1a5c2a 100%)',
        padding: '80px 20px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <FloatingOrnaments variant="cta" />
        <ChristmasSnow tone="light" density={0.4} fall="420px" />
        <RevealOnScroll style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(1.8rem, 4.5vw, 2.4rem)', color: '#fff', marginBottom: 12 }}>
            {t.home.ctaTitle}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '1.1rem', marginBottom: 32 }}>
            {t.home.ctaText}
          </p>
          <FestiveLink to="/create" tone="light" gift="🎁">{t.home.createGroup}</FestiveLink>
        </RevealOnScroll>
      </section>

      <style>{`
        .home-hero {
          min-height: calc(100vh - ${NAVBAR_HEIGHT}px);
          min-height: calc(100svh - ${NAVBAR_HEIGHT}px);
        }
        .scroll-arrow { animation: cueBounce 1.6s ease-in-out infinite; }
        @keyframes cueBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(6px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .scroll-arrow { animation: none; }
        }
      `}</style>
    </div>
  );
}
