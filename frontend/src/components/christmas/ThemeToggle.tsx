import { Tooltip } from 'antd';
import { useXmasTheme } from './themeContext';

/** Buton mic în navbar care comută între tema clasică și tema cu pisici. */
export default function ThemeToggle() {
  const { theme, setTheme } = useXmasTheme();
  const next = theme === 'classic' ? 'cats' : 'classic';
  const label = theme === 'classic' ? 'Treci la tema cu pisici' : 'Treci la tema clasică';

  return (
    <Tooltip title={label}>
      <button type="button" className="xmas-theme-toggle" onClick={() => setTheme(next)} aria-label={label}>
        <span aria-hidden="true">{theme === 'classic' ? '🐱' : '🎄'}</span>
      </button>
    </Tooltip>
  );
}
