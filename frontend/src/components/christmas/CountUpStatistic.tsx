import { Statistic } from 'antd';
import type { CSSProperties } from 'react';
import { useCountUp } from '../../hooks/useCountUp';

interface CountUpStatisticProps {
  value: number;
  /** pornește numărătoarea (ex. când cardul a intrat în ecran) */
  start: boolean;
  decimals?: number;
  color?: string;
  title?: string;
}

/** Statistic Ant Design care numără de la 0 la valoarea reală, formatat ro-RO. */
export default function CountUpStatistic({ value, start, decimals = 0, color, title }: CountUpStatisticProps) {
  const animated = useCountUp(value, start);
  const format = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const valueStyle: CSSProperties = { color, fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: '2rem' };

  return (
    <Statistic
      title={title}
      value={animated}
      formatter={v => format.format(Number(v))}
      styles={{ content: valueStyle }}
    />
  );
}
