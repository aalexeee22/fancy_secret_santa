import type { CSSProperties } from 'react';
import { ElfCat, SantaCat } from './CatCharacters';
import { useXmasTheme } from './themeContext';

interface CharacterProps {
  role: 'santa' | 'elf';
  className?: string;
  style?: CSSProperties;
}

/** Moș Crăciun sau spiriduș, după tema aleasă: emoji în tema clasică, pisici desenate în tema „Pisici”. */
export default function Character({ role, className, style }: CharacterProps) {
  const { theme } = useXmasTheme();

  if (theme === 'cats') {
    return (
      <span className={className} style={{ lineHeight: 1, ...style }} aria-hidden="true">
        {role === 'santa' ? <SantaCat /> : <ElfCat />}
      </span>
    );
  }
  return (
    <span className={className} style={style} aria-hidden="true">
      {role === 'santa' ? '🎅🏻' : '🧝🏻'}
    </span>
  );
}
