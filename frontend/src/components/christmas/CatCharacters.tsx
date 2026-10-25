import { useId, type CSSProperties } from 'react';
import santaCatUrl from '../../assets/cats/santa-cat.svg';
import elfCatUrl from '../../assets/cats/elf-cat.png';

// Personajele temei „Pisici”, desenate de utilizator. Au 1em, deci iau mărimea
// fontului din jur, exact ca emoji-urile pe care le înlocuiesc. Sunt afișate ca
// imagini, ca id-urile de gradient din SVG să nu se ciocnească între copii.
const characterStyle: CSSProperties = {
  display: 'inline-block',
  verticalAlign: '-0.12em',
  width: '1em',
  height: '1em',
  objectFit: 'contain',
};

/** Pisică roșcată îmbrăcată în Moș Crăciun. */
export function SantaCat() {
  return <img src={santaCatUrl} alt="" draggable={false} style={characterStyle} />;
}

/** Pisică albă îmbrăcată în spiriduș (PNG transparent, micșorat la 256px din originalul de 1254px). */
export function ElfCat() {
  return <img src={elfCatUrl} alt="" draggable={false} style={characterStyle} />;
}

interface YarnBallProps {
  color?: string;
  size?: number;
  x?: number;
  y?: number;
}

/** Ghem de lână: aceeași geometrie ca globul (agățat de sus, centrul la size/2 + 6). */
export function YarnBall({ color = '#D5A538', size = 28, x = 0, y = 0 }: YarnBallProps) {
  const id = useId();
  const r = size / 2;
  const cx = r;
  const cy = r + 6;
  const dark = { stroke: 'rgba(0,0,0,0.22)', strokeWidth: r * 0.13 };
  const light = { stroke: 'rgba(255,255,255,0.42)', strokeWidth: r * 0.1 };

  return (
    <g transform={`translate(${x} ${y})`}>
      <defs>
        <clipPath id={`${id}-ball`}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={color} />
      <g clipPath={`url(#${id}-ball)`} fill="none" strokeLinecap="round">
        <path d={`M${cx - r} ${cy - r * 0.35} Q${cx} ${cy - r * 1.15} ${cx + r} ${cy - r * 0.1}`} {...dark} />
        <path d={`M${cx - r} ${cy + r * 0.1} Q${cx} ${cy - r * 0.65} ${cx + r} ${cy + r * 0.4}`} {...dark} />
        <path d={`M${cx - r} ${cy + r * 0.55} Q${cx} ${cy - r * 0.1} ${cx + r} ${cy + r * 0.85}`} {...dark} />
        <path d={`M${cx - r * 0.25} ${cy - r} Q${cx + r * 0.7} ${cy} ${cx - r * 0.15} ${cy + r}`} {...light} />
        <path d={`M${cx + r * 0.3} ${cy - r} Q${cx + r * 1.15} ${cy} ${cx + r * 0.5} ${cy + r}`} {...light} />
      </g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth={r * 0.08} />
      {/* firul desprins */}
      <path
        d={`M${cx + r * 0.55} ${cy + r * 0.8} q${r * 0.55} ${r * 0.45} ${r * 0.1} ${r * 0.9} t${r * 0.45} ${r * 0.55}`}
        stroke={color}
        strokeWidth={r * 0.12}
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}
