import { useEffect, useState, type CSSProperties } from 'react';
import { Card, Col, Result, Row, Spin } from 'antd';
import { getStats } from '../api/client';
import type { Stats } from '../types';
import StatCard from '../components/StatCard';
import BarChart from '../components/BarChart';
import AnimatedGift from '../components/christmas/AnimatedGift';
import ChristmasEmptyState from '../components/christmas/ChristmasEmptyState';
import { FestiveLink } from '../components/christmas/FestiveButton';
import RevealOnScroll from '../components/christmas/RevealOnScroll';
import SnowGlobe from '../components/christmas/SnowGlobe';
import Character from '../components/christmas/Character';

const BUDGET_ORDER = ['Fără buget', '0-50', '51-100', '101-200', '201-500', '500+'];
const SIZE_ORDER = ['1', '2-5', '6-10', '11-20', '20+'];

const TREE_DOTS = [
  { left: '38%', top: '42%', c: '#ff5b55', d: '0.9s' },
  { left: '58%', top: '55%', c: '#ffd166', d: '1.05s' },
  { left: '32%', top: '70%', c: '#91d5ff', d: '1.2s' },
  { left: '62%', top: '76%', c: '#ff5b55', d: '1.35s' },
];

// Fiecare card are povestea lui, care pornește când intră în ecran.
const TreeScene = () => (
  <span className="story-tree">
    🎄
    {TREE_DOTS.map(dot => (
      <span key={dot.left + dot.top} className="story-tree__dot" style={{ left: dot.left, top: dot.top, '--c': dot.c, animationDelay: dot.d } as CSSProperties} />
    ))}
    <span className="story-tree__star" style={{ animationDelay: '1.5s' }}>⭐</span>
  </span>
);

const ElvesScene = () => (
  <span className="story-elves">
    {['0.1s', '0.35s', '0.6s'].map(delay => <Character key={delay} role="elf" style={{ animationDelay: delay }} />)}
  </span>
);

function GiftScene({ open }: { open: boolean }) {
  return (
    <span style={{ display: 'inline-block', width: 70 }}>
      <AnimatedGift box ribbon open={open} />
    </span>
  );
}

const EnvelopeScene = () => <span className="story-envelope">✉️</span>;

const SledScene = () => (
  <span className="story-slope">
    <svg viewBox="0 0 96 60" aria-hidden="true">
      <path d="M0 58 L96 14 L96 60 L0 60 Z" fill="#eaf1f7" />
      <path d="M0 58 L96 14" stroke="#b8cbdd" strokeWidth="2" />
    </svg>
    <span className="story-slope__sled">🛷</span>
  </span>
);

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStats().then(setStats).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: '100px' }}><Spin size="large" description="Numărăm cadourile..."><div style={{ height: 60 }} /></Spin></div>;
  if (!stats) return <Result status="error" title="Nu s-au putut încărca statisticile." subTitle="Spiridușii nu au găsit registrul. Încearcă din nou mai târziu." />;

  const noGroups = stats.total_groups === 0;
  const createCta = <FestiveLink to="/create" tone="red" small gift="🎄">Grup nou</FestiveLink>;

  return (
    <div style={{ minHeight: '90vh', padding: '40px 20px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <SnowGlobe />
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(2rem, 5vw, 2.5rem)', color: '#2c3e50', marginTop: 12 }}>📊 Statistici Secret Santa</h1>
          <p style={{ color: '#7f8c8d' }}>O privire globală asupra tuturor grupurilor, direct din Fabrica de Cadouri</p>
        </div>

        {/* KPI Cards */}
        <Row gutter={[20, 20]} style={{ marginBottom: 40 }}>
          <Col xs={24} sm={12} lg={{ flex: '20%' }}>
            <StatCard scene={<TreeScene />} label="Grupuri create" value={stats.total_groups} color="#C0392B" delay={0} />
          </Col>
          <Col xs={24} sm={12} lg={{ flex: '20%' }}>
            <StatCard scene={<ElvesScene />} label="Participanți totali" value={stats.total_participants} color="#27AE60" delay={90} />
          </Col>
          <Col xs={24} sm={12} lg={{ flex: '20%' }}>
            <StatCard
              scene={visible => <GiftScene open={visible && stats.drawn_groups > 0} />}
              label="Trageri efectuate"
              value={stats.drawn_groups}
              color="#F39C12"
              sub={`${stats.pending_groups} în așteptare`}
              delay={180}
            />
          </Col>
          <Col xs={24} sm={12} lg={{ flex: '20%' }}>
            <StatCard scene={<EnvelopeScene />} label="Cu email auto" value={stats.groups_with_email} color="#3498DB" delay={270} />
          </Col>
          <Col xs={24} sm={24} lg={{ flex: '20%' }}>
            <StatCard scene={<SledScene />} label="Medie participanți" value={stats.avg_participants_per_group} decimals={1} color="#9B59B6" sub="per grup" delay={360} />
          </Col>
        </Row>

        {/* Charts */}
        <Row gutter={[24, 24]} style={{ marginBottom: 40 }}>
          <Col xs={24} lg={12}>
            <BarChart
              data={stats.budget_distribution}
              order={BUDGET_ORDER}
              title="📊 Distribuție bugete (RON)"
              color="#F39C12"
              empty={
                <ChristmasEmptyState
                  prop="🛷"
                  title="Sania e încă goală!"
                  description="Creează primul grup și aici vor apărea statisticile cadourilor."
                  action={createCta}
                />
              }
            />
          </Col>
          <Col xs={24} lg={12}>
            <BarChart
              data={stats.group_size_distribution}
              order={SIZE_ORDER}
              title="👥 Distribuție mărime grup"
              color="#27AE60"
              empty={
                <ChristmasEmptyState
                  sleeping
                  prop="🎒"
                  title="Spiridușii așteaptă prima lor misiune!"
                  description="Când apare primul grup, îi trezim și numărăm cine vine la petrecere."
                  action={createCta}
                />
              }
            />
          </Col>
        </Row>

        {/* Recent groups */}
        <RevealOnScroll>
          <Card style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }} styles={{ body: { padding: 28 } }}>
            <h2 style={{ fontFamily: 'Georgia, serif', marginBottom: 20, color: '#2c3e50', fontSize: '1.1rem' }}>🕐 Grupuri recente</h2>
            {noGroups || stats.recent_groups.length === 0 ? (
              <ChristmasEmptyState prop="📜" title="Niciun grup creat încă." description="Lista lui Moș Crăciun așteaptă primul nume." />
            ) : (
              <div>
                {stats.recent_groups.map((g, i) => (
                  <div key={i} className="xmas-participant" style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: '14px 0',
                    borderBottom: i < stats.recent_groups.length - 1 ? '1px solid #f0f0f0' : 'none',
                    animationDelay: `${i * 80}ms`,
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: g.is_drawn ? 'linear-gradient(135deg,#27AE60,#1E8449)' : 'linear-gradient(135deg,#C0392B,#922B21)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0,
                    }} aria-hidden="true">
                      {g.is_drawn ? '🎁' : '🎄'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: '#2c3e50' }}>{g.participant_count} participanți</div>
                      <div style={{ fontSize: '0.82rem', color: '#7f8c8d' }}>
                        Creat pe {new Date(g.created_at).toLocaleDateString('ro-RO')}
                      </div>
                    </div>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: 20,
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      background: g.is_drawn ? '#d5f5e3' : '#fdebd0',
                      color: g.is_drawn ? '#1E8449' : '#E67E22',
                    }}>
                      {g.is_drawn ? '✓ Tras' : '⏳ În așteptare'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </RevealOnScroll>
      </div>
    </div>
  );
}
