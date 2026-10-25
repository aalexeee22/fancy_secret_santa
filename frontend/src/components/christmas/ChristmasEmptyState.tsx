import type { ReactNode } from 'react';
import Character from './Character';

interface ChristmasEmptyStateProps {
  title: string;
  description?: ReactNode;
  /** obiectul de lângă spiriduș (sac, plic, sanie) */
  prop?: string;
  /** spiridușul doarme (pentru „încă nu s-a întâmplat nimic”) */
  sleeping?: boolean;
  action?: ReactNode;
}

/** Stare goală de Crăciun: un spiriduș care se leagănă (sau doarme) lângă un obiect. */
export default function ChristmasEmptyState({ title, description, prop = '🎒', sleeping, action }: ChristmasEmptyStateProps) {
  return (
    <div className="xmas-empty xmas-fade-in" role="status">
      <div className="xmas-empty__scene" aria-hidden="true">
        <Character role="elf" className={`xmas-elf${sleeping ? ' xmas-elf--sleeping' : ''}`} />
        <span className="xmas-empty__prop">{prop}</span>
        {sleeping && <span className="xmas-empty__zzz">z z z</span>}
      </div>
      <h3 style={{ fontFamily: 'Georgia, serif', color: '#2B3E50', fontSize: '1.2rem', marginBottom: 6 }}>{title}</h3>
      {description && <p style={{ color: '#7f8c8d', maxWidth: 380, margin: '0 auto', lineHeight: 1.6 }}>{description}</p>}
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
    </div>
  );
}
