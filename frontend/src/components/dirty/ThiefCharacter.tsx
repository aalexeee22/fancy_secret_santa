import type { CSSProperties } from 'react';
import { useXmasTheme } from '../christmas/themeContext';
import thiefSanta from '../../assets/thief/thief-santa.svg';
import thiefCat from '../../assets/thief/thief-cat.svg';
import thiefElf from '../../assets/thief/thief-elf.svg';
import thiefElfCat from '../../assets/thief/thief-elf-cat.svg';

const IMAGES = {
  classic: { santa: thiefSanta, elf: thiefElf },
  cats: { santa: thiefCat, elf: thiefElfCat },
};

interface ThiefCharacterProps {
  /** santa = Moșul Hoț (mascota); elf = Elful Hoț (face furturile) */
  role: 'santa' | 'elf';
  size?: number | string;
  className?: string;
  style?: CSSProperties;
}

/** Personajele Dirty Santa, după tema aleasă. Desenate provizoriu; pot fi înlocuite cu poze, cu același nume de fișier. */
export default function ThiefCharacter({ role, size = '1em', className, style }: ThiefCharacterProps) {
  const { theme } = useXmasTheme();
  return (
    <img
      src={IMAGES[theme][role]}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={className}
      style={{ width: size, height: size, objectFit: 'contain', display: 'inline-block', ...style }}
    />
  );
}
