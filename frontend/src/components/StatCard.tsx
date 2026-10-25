import { Card } from 'antd';
import type { ReactNode } from 'react';
import CountUpStatistic from './christmas/CountUpStatistic';
import RevealOnScroll from './christmas/RevealOnScroll';

interface StatCardProps {
  /** mica poveste animată de deasupra cifrei */
  scene: ReactNode | ((visible: boolean) => ReactNode);
  label: string;
  value: number;
  decimals?: number;
  color: string;
  sub?: string;
  delay?: number;
}

export default function StatCard({ scene, label, value, decimals = 0, color, sub, delay = 0 }: StatCardProps) {
  return (
    <RevealOnScroll delay={delay} style={{ height: '100%' }}>
      {visible => (
        <Card
          className="xmas-stat xmas-hover-lift"
          style={{ borderTop: `4px solid ${color}`, boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}
          styles={{ body: { padding: '22px 16px' } }}
        >
          <div className="xmas-stat__scene" aria-hidden="true">
            <span className="xmas-stat__wiggle">{typeof scene === 'function' ? scene(visible) : scene}</span>
          </div>
          <CountUpStatistic value={value} start={visible} decimals={decimals} color={color} />
          <div style={{ fontWeight: 600, color: '#2c3e50', marginTop: 4 }}>{label}</div>
          {sub && <div style={{ fontSize: '0.8rem', color: '#95a5a6', marginTop: 4 }}>{sub}</div>}
        </Card>
      )}
    </RevealOnScroll>
  );
}
