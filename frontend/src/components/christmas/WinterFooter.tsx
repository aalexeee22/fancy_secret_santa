import { useMemo } from 'react';
import ChristmasSnow from './ChristmasSnow';
import Character from './Character';
import { seededRandom } from './random';
import { useI18n } from '../../i18n/i18nContext';

const TREES = [
  { x: 60, s: 1.1 }, { x: 140, s: 0.8 }, { x: 230, s: 1.3 }, { x: 330, s: 0.9 },
  { x: 900, s: 1.2 }, { x: 990, s: 0.85 }, { x: 1080, s: 1.35 }, { x: 1160, s: 0.9 },
];

function Tree({ x, s }: { x: number; s: number }) {
  return (
    <g transform={`translate(${x} 128) scale(${s})`}>
      <rect x="-4" y="-6" width="8" height="10" fill="#4a3320" />
      <path d="M0 -70 L22 -32 L-22 -32 Z M0 -52 L28 -12 L-28 -12 Z M0 -34 L34 0 L-34 0 Z" fill="#1f5a3d" />
      <path d="M0 -70 L8 -56 L-8 -56 Z M-16 -16 L-4 -24 L6 -16 Z" fill="#fff" opacity="0.85" />
    </g>
  );
}

/** Peisaj de iarnă în subsolul tuturor paginilor: brazi, o căsuță luminată și zăpadă. */
export default function WinterFooter() {
  const { t } = useI18n();
  const stars = useMemo(() => {
    const rand = seededRandom(3);
    return Array.from({ length: 30 }, (_, i) => ({ id: i, x: rand() * 1200, y: rand() * 70, r: 0.6 + rand() * 1.4, delay: `${rand() * 3}s` }));
  }, []);

  return (
    <footer className="xmas-footer">
      <ChristmasSnow tone="light" density={0.35} fall="170px" />
      <svg className="xmas-footer__scene" viewBox="0 0 1200 150" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
        {stars.map(s => (
          <circle key={s.id} className="xmas-twinkle" cx={s.x} cy={s.y} r={s.r} fill="#fff7da" style={{ animationDelay: s.delay, transformBox: 'fill-box', transformOrigin: 'center' }} />
        ))}
        <path d="M0 118 Q180 88 380 112 T800 104 T1200 110 V150 H0 Z" fill="#dfe8ef" />
        {TREES.map(t => <Tree key={t.x} {...t} />)}

        {/* Căsuța cu ferestre luminate */}
        <g transform="translate(600 72)">
          <rect x="-46" y="10" width="92" height="56" fill="#7a4a2a" />
          <path d="M-58 14 L0 -26 L58 14 Z" fill="#990C0C" />
          <path d="M-58 14 L0 -26 L58 14 L50 16 L0 -18 L-50 16 Z" fill="#fff" />
          <rect x="22" y="-22" width="12" height="22" fill="#5c3a17" />
          <rect className="xmas-footer__window" x="-34" y="24" width="20" height="18" rx="2" fill="#ffd166" />
          <rect className="xmas-footer__window" x="14" y="24" width="20" height="18" rx="2" fill="#ffd166" style={{ animationDelay: '-1.5s' }} />
          <rect x="-8" y="40" width="16" height="26" rx="2" fill="#4a2a14" />
          <circle cx="4" cy="54" r="1.6" fill="#D5A538" />
          <circle cx="-24" cy="33" r="28" fill="#ffd166" opacity="0.12" />
          <circle cx="24" cy="33" r="28" fill="#ffd166" opacity="0.12" />
        </g>
        <path d="M0 132 Q300 120 600 136 T1200 130 V150 H0 Z" fill="#FFF7EB" />
      </svg>
      <div className="xmas-footer__text">
        <Character role="santa" /> {t.footer}
      </div>
    </footer>
  );
}
