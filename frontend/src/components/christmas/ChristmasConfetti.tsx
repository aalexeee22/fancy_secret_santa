import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { MOBILE_QUERY, useMediaQuery } from '../../hooks/useMediaQuery';
import { ConfettiContext, type ConfettiOptions } from './confettiContext';
import { useThemeEmoji } from './themeContext';

interface Piece { emoji: string; dx: number; dy: number; rot: number; dur: number; size: number }
interface Burst { id: number; x: number; y: number; pieces: Piece[] }

/** Strat global pentru confetti: supraviețuiește schimbării de pagină. */
export default function ChristmasConfettiProvider({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const emoji = useThemeEmoji().confetti;
  const [bursts, setBursts] = useState<Burst[]>([]);
  const nextId = useRef(0);
  const timers = useRef<number[]>([]);

  const fire = useCallback((options: ConfettiOptions = {}) => {
    if (reduced) return;
    const id = ++nextId.current;
    const count = isMobile ? 22 : 30 + Math.floor(Math.random() * 16);
    const reach = isMobile ? 150 : 280;
    const pieces = Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2;
      const distance = 90 + Math.random() * reach;
      return {
        emoji: emoji[Math.floor(Math.random() * emoji.length)],
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance - 70,
        rot: Math.random() * 720 - 360,
        dur: 1.3 + Math.random() * 0.8,
        size: 18 + Math.random() * 14,
      };
    });
    setBursts(current => [...current, { id, x: options.x ?? 50, y: options.y ?? 42, pieces }]);
    timers.current.push(window.setTimeout(() => setBursts(current => current.filter(b => b.id !== id)), 2300));
  }, [reduced, isMobile, emoji]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  return (
    <ConfettiContext.Provider value={fire}>
      {children}
      <div className="xmas-confetti" aria-hidden="true">
        {bursts.map(burst => (
          <div key={burst.id} className="xmas-confetti__burst" style={{ left: `${burst.x}%`, top: `${burst.y}%` }}>
            {burst.pieces.map((p, i) => (
              <span
                key={i}
                className="xmas-confetti__piece"
                style={{ '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--rot': `${p.rot}deg`, '--dur': `${p.dur}s`, '--size': `${p.size}px` } as CSSProperties}
              >
                {p.emoji}
              </span>
            ))}
          </div>
        ))}
      </div>
    </ConfettiContext.Provider>
  );
}
