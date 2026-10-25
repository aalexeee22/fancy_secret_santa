import { useEffect, useRef, useState, type CSSProperties } from 'react';

const COLORS = ['#ff5b55', '#ffd166', '#65e6a1', '#91d5ff', '#fff7da'];

/** Instalație de beculețe agățată sub elementul părinte (navbarul), după lățimea lui reală. */
export default function ChristmasLights() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const isMobile = width < 768;
  const count = width ? Math.max(8, Math.min(isMobile ? 17 : 38, Math.round(width / (isMobile ? 24 : 40)))) : 0;
  const wire = Array.from({ length: count }, (_, k) => `M${k} 1 Q${k + 0.5} 9 ${k + 1} 1`).join(' ');

  return (
    <div ref={ref} className="xmas-lights" aria-hidden="true">
      {count > 0 && (
        <>
          <svg className="xmas-lights__wire" viewBox={`0 0 ${count} 10`} preserveAspectRatio="none">
            <path d={wire} />
          </svg>
          {Array.from({ length: count }, (_, i) => (
            <span
              key={i}
              className="xmas-lights__bulb"
              style={{
                left: `${((i + 0.5) / count) * 100}%`,
                '--bulb': COLORS[i % COLORS.length],
                animationDelay: `${(i % 5) * 0.36 + (i % 3) * 0.12}s`,
              } as CSSProperties}
            />
          ))}
        </>
      )}
    </div>
  );
}
