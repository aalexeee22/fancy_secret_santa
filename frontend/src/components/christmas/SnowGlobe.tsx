import { useEffect, useState, type CSSProperties } from 'react';
import { useI18n } from '../../i18n/i18nContext';

const FLAKES = [
  { cx: 20, cy: 18, sx: '6px' }, { cx: 34, cy: 14, sx: '-5px' }, { cx: 27, cy: 26, sx: '4px' },
  { cx: 16, cy: 30, sx: '-6px' }, { cx: 40, cy: 28, sx: '5px' }, { cx: 30, cy: 36, sx: '-3px' },
];

/** Glob de zăpadă mic care se agită la click. */
export default function SnowGlobe() {
  const { t } = useI18n();
  const [shakes, setShakes] = useState(0);
  const [settled, setSettled] = useState(0);
  const shaking = shakes !== settled;

  useEffect(() => {
    if (!shakes) return;
    const timer = window.setTimeout(() => setSettled(shakes), 820);
    return () => window.clearTimeout(timer);
  }, [shakes]);

  return (
    <button
      type="button"
      className={`xmas-globe${shaking ? ' is-shaking' : ''}`}
      onClick={() => setShakes(n => n + 1)}
      aria-label={t.stats.shakeGlobe}
      title={t.stats.shakeMe}
    >
      <svg width="56" height="64" viewBox="0 0 56 64" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="xmas-globe-glass" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="60%" stopColor="#d6ecff" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#9cc7ee" stopOpacity="0.8" />
          </radialGradient>
        </defs>
        <circle cx="28" cy="26" r="24" fill="url(#xmas-globe-glass)" stroke="#b9d6ef" strokeWidth="1.5" />
        <path d="M28 12 L36 26 L20 26 Z M28 20 L39 36 L17 36 Z" fill="#164B32" />
        <rect x="26" y="36" width="4" height="5" fill="#4a3320" />
        <path d="M8 40 Q28 34 48 40 L48 44 L8 44 Z" fill="#fff" />
        {FLAKES.map((f, i) => (
          <circle key={i} className="xmas-globe__flake" cx={f.cx} cy={f.cy} r="1.6" fill="#fff" style={{ '--sx': f.sx, animationDelay: `${i * 0.3}s` } as CSSProperties} />
        ))}
        <path d="M8 46 L48 46 L44 60 Q28 64 12 60 Z" fill="#990C0C" />
        <path d="M10 50 L46 50" stroke="#D5A538" strokeWidth="2" />
      </svg>
    </button>
  );
}
