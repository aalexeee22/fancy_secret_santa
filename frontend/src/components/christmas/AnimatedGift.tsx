import { useId } from 'react';

interface AnimatedGiftProps {
  /** cutia apare (ex. după ce grupul are nume) */
  box: boolean;
  /** panglica și fundița (ex. buget setat) */
  ribbon?: boolean;
  /** steluțele (ex. email configurat) */
  sparkles?: boolean;
  /** capacul se ridică (ex. după crearea reușită) */
  open?: boolean;
  className?: string;
}

const STAR = 'M0 -9 L2.6 -2.6 L9 0 L2.6 2.6 L0 9 L-2.6 2.6 L-9 0 L-2.6 -2.6 Z';

/** Cadou SVG care se construiește pe etape, în funcție de starea reală a formularului. */
export default function AnimatedGift({ box, ribbon, sparkles, open, className }: AnimatedGiftProps) {
  const id = useId();
  const stateClass = [box && 'has-box', ribbon && 'has-ribbon', sparkles && 'has-sparkles', open && 'is-open']
    .filter(Boolean)
    .join(' ');

  return (
    <svg className={`xmas-gift ${stateClass} ${className ?? ''}`} viewBox="0 0 200 210" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-box`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c0392b" />
          <stop offset="100%" stopColor="#990C0C" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#f6d77c" />
          <stop offset="100%" stopColor="#D5A538" />
        </linearGradient>
        <radialGradient id={`${id}-light`} cx="50%" cy="100%" r="80%">
          <stop offset="0%" stopColor="#fff3c4" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#fff3c4" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="100" cy="196" rx="70" ry="8" fill="rgba(0,0,0,0.08)" />
      <rect className="xmas-gift__outline" x="40" y="76" width="120" height="112" rx="8" fill="none" stroke="#d9c7a8" strokeWidth="2.5" />

      <g className="xmas-gift__burst">
        <path d="M60 92 L100 10 L140 92 Z" fill={`url(#${id}-light)`} />
        <path transform="translate(70 40) scale(0.8)" d={STAR} fill="#F2CD6B" />
        <path transform="translate(132 30) scale(0.6)" d={STAR} fill="#fff" />
        <path transform="translate(104 18) scale(0.9)" d={STAR} fill="#F2CD6B" />
      </g>

      <g className="xmas-gift__box">
        <rect x="44" y="96" width="112" height="92" rx="6" fill={`url(#${id}-box)`} />
        <rect x="128" y="96" width="28" height="92" rx="6" fill="rgba(0,0,0,0.12)" />
        <rect className="xmas-gift__ribbon" x="92" y="96" width="16" height="92" fill={`url(#${id}-gold)`} />
      </g>

      <g className="xmas-gift__lid">
        <rect x="36" y="76" width="128" height="26" rx="6" fill="#7d0a0a" />
        <rect x="36" y="76" width="128" height="8" rx="4" fill="rgba(255,255,255,0.12)" />
        <rect className="xmas-gift__ribbon" x="92" y="76" width="16" height="26" fill={`url(#${id}-gold)`} />
      </g>

      <g className="xmas-gift__bow">
        <ellipse cx="82" cy="66" rx="20" ry="11" transform="rotate(-25 82 66)" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="7" />
        <ellipse cx="118" cy="66" rx="20" ry="11" transform="rotate(25 118 66)" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="7" />
        <circle cx="100" cy="74" r="7" fill="#D5A538" />
      </g>

      <g className="xmas-gift__stars">
        <path className="xmas-gift__star" transform="translate(28 70)" d={STAR} fill="#F2CD6B" />
        <path className="xmas-gift__star" transform="translate(176 92) scale(0.7)" d={STAR} fill="#F2CD6B" style={{ animationDelay: '0.5s' }} />
        <path className="xmas-gift__star" transform="translate(170 40) scale(0.55)" d={STAR} fill="#fff" style={{ animationDelay: '1s' }} />
        <path className="xmas-gift__star" transform="translate(24 150) scale(0.6)" d={STAR} fill="#F2CD6B" style={{ animationDelay: '1.4s' }} />
      </g>
    </svg>
  );
}
