import { useMemo, useState, type CSSProperties } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { MOBILE_QUERY, useMediaQuery } from '../../hooks/useMediaQuery';
import { seededRandom } from './random';

interface ChristmasSnowProps {
  /** light = fulgi albi (peste fundal închis), ice = albastru-gheață (peste crem) */
  tone?: 'light' | 'ice';
  /** fixed = pe tot ecranul, în spatele conținutului; altfel umple părintele */
  fixed?: boolean;
  /** multiplicator pentru numărul de fulgi (1 = 65 desktop / 25 mobil) */
  density?: number;
  /** cât cad fulgii; pentru secțiuni scurte, înălțimea secțiunii */
  fall?: string;
}

export default function ChristmasSnow({ tone = 'light', fixed = false, density = 1, fall = '110vh' }: ChristmasSnowProps) {
  const reduced = useReducedMotion();
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const count = Math.max(4, Math.round((isMobile ? 25 : 65) * density));
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 31));

  const flakes = useMemo(() => {
    const rand = seededRandom(seed);
    return Array.from({ length: count }, (_, i) => {
      const size = 8 + rand() * 15;
      const depth = (size - 8) / 15; // 0 = departe, 1 = aproape: parallax discret
      return {
        id: i,
        left: rand() * 100,
        size,
        opacity: 0.35 + depth * 0.5,
        duration: 22 - depth * 13,
        delay: -rand() * 22,
        drift: (rand() - 0.5) * 90,
        char: rand() > 0.5 ? '❄' : '❅',
        glow: rand() > 0.85,
      };
    });
  }, [count, seed]);

  if (reduced) return null;

  return (
    <div
      className={`xmas-snow xmas-snow--${tone}${fixed ? ' xmas-snow--fixed' : ''}`}
      style={{ '--fall': fall } as CSSProperties}
      aria-hidden="true"
    >
      {flakes.map(f => (
        <span
          key={f.id}
          className={`xmas-snow__flake${f.glow ? ' xmas-snow__flake--glow' : ''}`}
          style={{
            left: `${f.left}%`,
            fontSize: f.size,
            opacity: f.opacity,
            animationDuration: `${f.duration}s`,
            animationDelay: `${f.delay}s`,
            '--drift': `${f.drift}px`,
          } as CSSProperties}
        >
          {f.char}
        </span>
      ))}
    </div>
  );
}
