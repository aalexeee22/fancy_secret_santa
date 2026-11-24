import type { ReactNode } from 'react';
import { ConfigProvider, theme } from 'antd';
import '../../styles/dirty.css';

const DIRTY = {
  ink: '#111116',
  panel: '#1c1c24',
  red: '#c8102e',
  gold: '#ffc83d',
  text: '#f4efe6',
};

/** Paleta Dirty Santa: negru, roșu închis și auriu, ca să se deosebească de roșu-verdele din Secret Santa. */
export default function DirtyLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: DIRTY.red,
          colorLink: DIRTY.gold,
          colorTextBase: DIRTY.text,
          colorBgBase: DIRTY.ink,
          colorBgContainer: DIRTY.panel,
          colorBgElevated: '#24242e',
        },
      }}
    >
      <div className={`dirty-page ${wide ? 'dirty-page--wide' : ''}`}>{children}</div>
    </ConfigProvider>
  );
}
