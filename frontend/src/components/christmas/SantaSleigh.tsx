import { useReducedMotion } from '../../hooks/useReducedMotion';
import { MOBILE_QUERY, useMediaQuery } from '../../hooks/useMediaQuery';
import Character from './Character';
import { useThemeEmoji } from './themeContext';

/** Sania trece rar prin partea de sus a ecranului (o dată la ~36 s). Doar pe ecrane mari. */
export default function SantaSleigh() {
  const reduced = useReducedMotion();
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const { team } = useThemeEmoji();
  if (reduced || isMobile) return null;

  return (
    <div className="xmas-sleigh-lane" aria-hidden="true">
      <div className="xmas-sleigh">
        <span>{team}<Character role="santa" /></span>
        <span className="xmas-sleigh__trail">✦✨✦</span>
      </div>
    </div>
  );
}
