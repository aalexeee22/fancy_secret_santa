import { useId, type CSSProperties } from 'react';
import { YarnBall } from './CatCharacters';
import { useXmasTheme } from './themeContext';

// Ace de brad calculate o singură dată, de-a lungul unei curbe Bézier.
const STEM = { p0: [0, 14], p1: [150, 8], p2: [292, 120] } as const;

function bezier(t: number) {
  const { p0, p1, p2 } = STEM;
  const u = 1 - t;
  const x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0];
  const y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1];
  const dx = 2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
  const dy = 2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
  const len = Math.hypot(dx, dy);
  return { x, y, tx: dx / len, ty: dy / len };
}

const NEEDLES = (() => {
  const lines: { x1: number; y1: number; x2: number; y2: number; light: boolean }[] = [];
  for (let i = 0; i <= 46; i++) {
    const t = i / 46;
    const { x, y, tx, ty } = bezier(t);
    const length = 30 - t * 16;
    for (const side of [-1, 1]) {
      // ace înclinate spre vârf, pe ambele părți ale ramurii
      const angle = side * 0.75;
      const nx = tx * Math.cos(angle) - ty * Math.sin(angle);
      const ny = tx * Math.sin(angle) + ty * Math.cos(angle);
      lines.push({ x1: x, y1: y, x2: x + nx * length, y2: y + ny * length, light: (i + (side > 0 ? 1 : 0)) % 3 === 0 });
    }
  }
  return lines;
})();

const BERRIES = [0.28, 0.33, 0.62, 0.67].map((t, i) => ({ ...bezier(t), r: i % 2 ? 4.5 : 5.5 }));
const HANG = bezier(0.48);

export function PineBranch({ className, withBauble = true }: { className?: string; withBauble?: boolean }) {
  return (
    <svg className={className} viewBox="-10 -10 330 200" aria-hidden="true" focusable="false">
      <path d={`M${STEM.p0} Q${STEM.p1} ${STEM.p2}`} stroke="#4a3320" strokeWidth="5" fill="none" strokeLinecap="round" />
      {NEEDLES.map((n, i) => (
        <line key={i} x1={n.x1} y1={n.y1} x2={n.x2} y2={n.y2} stroke={n.light ? '#2a7a52' : '#164B32'} strokeWidth="3.2" strokeLinecap="round" />
      ))}
      {BERRIES.map((b, i) => (
        <circle key={i} cx={b.x + (i % 2 ? 6 : -4)} cy={b.y + 6} r={b.r} fill="#c0392b" stroke="#7a0a0a" strokeWidth="1" />
      ))}
      {withBauble && (
        <g transform={`translate(${HANG.x} ${HANG.y})`}>
          <g className="xmas-hanging" style={{ animationDuration: '5s' }}>
            <line x1="0" y1="0" x2="0" y2="34" stroke="#D5A538" strokeWidth="1.5" />
            <Bauble x={-14} y={30} size={28} color="#D5A538" />
          </g>
        </g>
      )}
    </svg>
  );
}

interface BaubleProps {
  color?: string;
  size?: number;
  x?: number;
  y?: number;
}

/** Glob de Crăciun SVG (ghem de lână în tema „Pisici”). Se pune direct într-un <svg>, cu x/y. */
export function Bauble({ color = '#D5A538', size = 28, x = 0, y = 0 }: BaubleProps) {
  const id = useId();
  const { theme } = useXmasTheme();
  const r = size / 2;
  if (theme === 'cats') return <YarnBall color={color} size={size} x={x} y={y} />;
  return (
    <g transform={`translate(${x} ${y})`}>
      <defs>
        <radialGradient id={`${id}-g`} cx="35%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="25%" stopColor={color} />
          <stop offset="100%" stopColor={color} stopOpacity="0.75" />
        </radialGradient>
      </defs>
      <rect x={r - 4} y="0" width="8" height="6" rx="1.5" fill="#b8941f" />
      <circle cx={r} cy={r + 6} r={r} fill={`url(#${id}-g)`} />
      <path d={`M${r * 0.35} ${r + 4} Q${r} ${r + 10} ${r * 1.65} ${r + 4}`} stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" fill="none" />
    </g>
  );
}

/** Glob agățat de un șnur, care se leagănă. Pentru folosire în HTML. */
export function HangingBauble({ color, size = 28, string = 35, className, style }: { color?: string; size?: number; string?: number; className?: string; style?: CSSProperties }) {
  const { theme } = useXmasTheme();
  // Ghemul atârnă de propriul fir de lână, care ajunge până la el.
  const isYarn = theme === 'cats';
  return (
    <svg
      className={`xmas-hanging ${className ?? ''}`}
      style={style}
      width={size + 4}
      height={string + size + 8}
      viewBox={`-2 0 ${size + 4} ${string + size + 8}`}
      aria-hidden="true"
      focusable="false"
      overflow="visible"
    >
      <line
        x1={size / 2}
        y1="0"
        x2={size / 2}
        y2={isYarn ? string + 5 : string}
        stroke={isYarn ? color ?? '#D5A538' : '#D5A538'}
        strokeWidth={isYarn ? 2 : 1.5}
      />
      <Bauble x={0} y={string - 2} size={size} color={color} />
    </svg>
  );
}

export function GoldLock({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 30 36" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="xmas-lock-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f6d77c" />
          <stop offset="100%" stopColor="#b8860b" />
        </linearGradient>
      </defs>
      <path d="M8 16 V11 a7 7 0 0 1 14 0 V16" stroke="url(#xmas-lock-gold)" strokeWidth="3.2" fill="none" />
      <rect x="3" y="15" width="24" height="19" rx="4" fill="url(#xmas-lock-gold)" />
      <circle cx="15" cy="23" r="2.6" fill="#6b4e05" />
      <rect x="14" y="24" width="2" height="5" rx="1" fill="#6b4e05" />
    </svg>
  );
}
