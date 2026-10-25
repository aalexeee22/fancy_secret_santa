import type { ThemeConfig } from 'antd';

// Paleta din planul de Crăciun
export const XMAS = {
  red: '#990C0C',
  green: '#164B32',
  gold: '#D5A538',
  snow: '#FFF7EB',
  ink: '#2B3E50',
};

const focusGlow = '0 0 0 3px rgba(213, 165, 56, 0.35)';

export const christmasTheme: ThemeConfig = {
  token: {
    colorPrimary: XMAS.red,
    colorSuccess: '#1E8449',
    colorWarning: XMAS.gold,
    colorError: '#C0392B',
    colorLink: XMAS.red,
    colorTextBase: XMAS.ink,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    borderRadius: 12,
  },
  components: {
    // Inputuri „candy cane”: bordură roșie și strălucire aurie la focus
    Input: { activeBorderColor: XMAS.red, hoverBorderColor: '#c2413b', activeShadow: focusGlow },
    InputNumber: { activeBorderColor: XMAS.red, hoverBorderColor: '#c2413b', activeShadow: focusGlow },
    Select: { activeBorderColor: XMAS.red, hoverBorderColor: '#c2413b', activeOutlineColor: 'rgba(213, 165, 56, 0.35)' },
    Card: { borderRadiusLG: 20 },
    Modal: { borderRadiusLG: 20 },
  },
};
