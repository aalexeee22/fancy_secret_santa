import { useMemo } from 'react';
import { HangingBauble, PineBranch } from './Ornaments';
import { seededRandom } from './random';

interface FloatingOrnamentsProps {
  /** hero = crenguțe în toate colțurile + globuri; cta = variantă mai discretă */
  variant?: 'hero' | 'cta';
}

const BAUBLES = [
  { left: '16%', color: '#D5A538', size: 30, string: 70, delay: '0s', hideMobile: false },
  { left: '30%', color: '#c0392b', size: 22, string: 40, delay: '-1.2s', hideMobile: true },
  { left: '72%', color: '#2a7a52', size: 26, string: 55, delay: '-2.1s', hideMobile: true },
  { left: '86%', color: '#D5A538', size: 32, string: 85, delay: '-0.6s', hideMobile: false },
];

const STARS = ['12%', '24%', '64%', '80%', '92%'];

/** Decor ambiental: lumini calde, crenguțe de brad, globuri suspendate și particule aurii. */
export default function FloatingOrnaments({ variant = 'hero' }: FloatingOrnamentsProps) {
  const particles = useMemo(() => {
    const rand = seededRandom(variant === 'hero' ? 7 : 11);
    return Array.from({ length: variant === 'hero' ? 16 : 8 }, (_, i) => ({
      id: i,
      left: `${rand() * 100}%`,
      bottom: `${rand() * 40}%`,
      duration: `${6 + rand() * 6}s`,
      delay: `${-rand() * 10}s`,
    }));
  }, [variant]);

  return (
    <div className="xmas-decor" aria-hidden="true">
      <div className="xmas-glow" style={{ width: 520, height: 520, top: '-12%', left: '-8%' }} />
      <div className="xmas-glow" style={{ width: 460, height: 460, bottom: '-18%', right: '-6%', animationDelay: '-3s' }} />
      {variant === 'hero' && <div className="xmas-glow" style={{ width: 360, height: 360, top: '30%', left: '40%', animationDelay: '-5s' }} />}

      <PineBranch className="xmas-branch xmas-branch--tl" />
      <PineBranch className="xmas-branch xmas-branch--tr" />
      {variant === 'hero' && (
        <>
          <PineBranch className="xmas-branch xmas-branch--bl" withBauble={false} />
          <PineBranch className="xmas-branch xmas-branch--br" withBauble={false} />
          {BAUBLES.map(b => (
            <HangingBauble
              key={b.left}
              className={b.hideMobile ? 'xmas-hide-mobile' : undefined}
              color={b.color}
              size={b.size}
              string={b.string}
              style={{ left: b.left, animationDelay: b.delay }}
            />
          ))}
          {STARS.map((left, i) => (
            <span
              key={left}
              className="xmas-twinkle"
              style={{ position: 'absolute', left, top: `${18 + (i % 3) * 22}%`, color: '#F2CD6B', fontSize: 12 + (i % 2) * 8, animationDelay: `${i * 0.5}s` }}
            >
              ✦
            </span>
          ))}
        </>
      )}

      {particles.map(p => (
        <span
          key={p.id}
          className="xmas-particle"
          style={{ left: p.left, bottom: p.bottom, animationDuration: p.duration, animationDelay: p.delay }}
        />
      ))}
    </div>
  );
}
