import { Card } from 'antd';
import type { ReactNode } from 'react';
import RevealOnScroll from './christmas/RevealOnScroll';

interface BarChartProps {
  data: Record<string, number>;
  /** ordinea barelor; serverul trimite cheile sortate alfabetic */
  order: string[];
  /** etichete traduse pentru cheile care nu sunt simple intervale */
  labels?: Record<string, string>;
  title: string;
  color: string;
  /** afișat în locul graficului când toate valorile sunt 0 */
  empty: ReactNode;
}

export default function BarChart({ data, order, labels = {}, title, color, empty }: BarChartProps) {
  const entries = order.filter(label => label in data).map(label => [label, data[label]] as const);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  const isEmpty = entries.every(([, v]) => v === 0);

  return (
    <Card style={{ height: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }} styles={{ body: { padding: 24 } }}>
      <h2 style={{ fontFamily: 'Georgia, serif', marginBottom: 20, color: '#2c3e50', fontSize: '1.1rem' }}>{title}</h2>
      {isEmpty ? empty : (
        <RevealOnScroll>
          <div role="list" style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 160 }}>
            {entries.map(([label, val], i) => (
              <div role="listitem" key={label} aria-label={`${labels[label] ?? label}: ${val}`} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color }}>{val}</span>
                <div
                  className={val > 0 ? 'xmas-bar' : 'xmas-bar xmas-bar--zero'}
                  style={{
                    height: `${(val / max) * 100}%`,
                    minHeight: val > 0 ? 6 : 0,
                    background: `linear-gradient(180deg, ${color}, ${color}88)`,
                    transitionDelay: `${i * 90}ms`,
                  }}
                />
                <span style={{ fontSize: '0.7rem', color: '#7f8c8d', textAlign: 'center', lineHeight: 1.2, minHeight: '1.7em' }}>{labels[label] ?? label}</span>
              </div>
            ))}
          </div>
        </RevealOnScroll>
      )}
    </Card>
  );
}
