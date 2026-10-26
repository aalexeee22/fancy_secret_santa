import { Progress } from 'antd';
import { useId } from 'react';
import { useI18n } from '../../i18n/i18nContext';

interface GiftSackProgressProps {
  count: number;
  /** pragul minim de participanți al backendului */
  minimum: number;
}

/** Sacul de cadouri se umple pe măsură ce vin participanții, până la pragul de tragere. */
export default function GiftSackProgress({ count, minimum }: GiftSackProgressProps) {
  const id = useId();
  const { t } = useI18n();
  const ratio = Math.min(count / minimum, 1);
  const ready = count >= minimum;
  const missing = minimum - count;
  const fillHeight = 70 * ratio;

  const message = ready
    ? t.sack.ready
    : t.admin.missing(missing);

  return (
    <div style={{ textAlign: 'center' }}>
      <svg
        className={`xmas-sack${ready ? ' is-ready' : count > 0 ? ' is-waiting' : ''}`}
        width="96"
        height="96"
        viewBox="0 0 120 120"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <clipPath id={`${id}-sack`}>
            <path d="M30 36 Q18 70 22 96 Q26 112 60 112 Q94 112 98 96 Q102 70 90 36 Z" />
          </clipPath>
        </defs>
        {ready && (
          <g>
            <text x="34" y="40" fontSize="22">🎁</text>
            <text x="62" y="34" fontSize="18">🎁</text>
          </g>
        )}
        <path d="M30 36 Q18 70 22 96 Q26 112 60 112 Q94 112 98 96 Q102 70 90 36 Z" fill="#8b5a2b" />
        <rect className="xmas-sack__fill" x="0" y={112 - fillHeight} width="120" height={fillHeight} fill="#990C0C" clipPath={`url(#${id}-sack)`} />
        <path d="M30 36 Q18 70 22 96 Q26 112 60 112 Q94 112 98 96 Q102 70 90 36 Z" fill="none" stroke="#5c3a17" strokeWidth="2.5" />
        <path d="M28 36 Q60 46 92 36" stroke="#D5A538" strokeWidth="5" fill="none" strokeLinecap="round" />
        <text x="50" y="86" fontSize="20" fill="#F2CD6B">✦</text>
      </svg>
      <Progress
        percent={Math.round(ratio * 100)}
        showInfo={false}
        strokeColor={{ '0%': '#990C0C', '100%': '#D5A538' }}
        aria-label={t.sack.progressAria(count, minimum)}
      />
      <div aria-live="polite" style={{ fontWeight: 700, color: ready ? '#1E8449' : '#7f8c8d', fontSize: '0.9rem' }}>
        {message}
      </div>
    </div>
  );
}
