import { Tooltip } from 'antd';
import { useXmasTheme } from './themeContext';
import { useI18n } from '../../i18n/i18nContext';

/** Buton mic în navbar care comută între tema clasică și tema cu pisici. */
export default function ThemeToggle() {
  const { theme, setTheme } = useXmasTheme();
  const { t } = useI18n();
  const next = theme === 'classic' ? 'cats' : 'classic';
  const label = theme === 'classic' ? t.theme.toCats : t.theme.toClassic;

  return (
    <Tooltip title={label}>
      <button type="button" className="xmas-theme-toggle" onClick={() => setTheme(next)} aria-label={label}>
        <span aria-hidden="true">{theme === 'classic' ? '🐱' : '🎄'}</span>
      </button>
    </Tooltip>
  );
}
