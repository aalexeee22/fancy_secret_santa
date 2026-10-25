import { createContext, useContext } from 'react';

export type XmasTheme = 'classic' | 'cats';

export const THEME_STORAGE_KEY = 'secret-santa-theme';

export const XmasThemeContext = createContext<{ theme: XmasTheme; setTheme: (theme: XmasTheme) => void }>({
  theme: 'classic',
  setTheme: () => {},
});

export const useXmasTheme = () => useContext(XmasThemeContext);

// Emoji-urile din text (butoane, confetti, sanie) pentru fiecare temă.
const THEME_EMOJI = {
  classic: {
    santa: '🎅🏻',
    confetti: ['🎁', '🎄', '⭐', '✨', '🎅🏻', '❄️', '🍬', '🔔'],
    orbit: ['🎁', '⭐', '🎁', '✨', '🎁', '⭐'],
    team: '🦌🦌🛷',
    avatarBadge: '🎅🏻',
  },
  cats: {
    santa: '😺',
    confetti: ['🎁', '🧶', '⭐', '✨', '🐱', '❄️', '🐟', '🐾'],
    orbit: ['🎁', '🧶', '🎁', '🐟', '🎁', '🐾'],
    team: '🐈🐈🛷',
    avatarBadge: '🐾',
  },
};

export const useThemeEmoji = () => THEME_EMOJI[useXmasTheme().theme];
