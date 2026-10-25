import { useEffect, useState, type CSSProperties } from 'react';

const SPARKS = Array.from({ length: 10 }, (_, i) => {
  const angle = (i / 10) * Math.PI * 2;
  const distance = 26 + (i % 3) * 10;
  return { dx: Math.cos(angle) * distance, dy: Math.sin(angle) * distance, char: i % 2 ? '✦' : '✧' };
});

/**
 * Explozie scurtă de steluțe în jurul părintelui (care trebuie să fie position: relative).
 * Se declanșează de fiecare dată când `trigger` crește, de exemplu după o copiere reușită.
 */
export default function HolidaySparkles({ trigger }: { trigger: number }) {
  // Burst-ul e vizibil până când timerul marchează declanșarea curentă ca terminată.
  const [finished, setFinished] = useState(0);

  useEffect(() => {
    if (!trigger) return;
    const timer = window.setTimeout(() => setFinished(trigger), 950);
    return () => window.clearTimeout(timer);
  }, [trigger]);

  if (!trigger || finished === trigger) return null;
  return (
    <span key={trigger} className="xmas-sparkles" aria-hidden="true">
      {SPARKS.map((s, i) => (
        <span key={i} className="xmas-sparkle" style={{ '--dx': `${s.dx}px`, '--dy': `${s.dy}px` } as CSSProperties}>
          {s.char}
        </span>
      ))}
    </span>
  );
}
