import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { THEME_STORAGE_KEY, XmasThemeContext, type XmasTheme } from './themeContext';

// Iconița din tabul browserului, câte una pentru fiecare temă (în public/).
const FAVICONS: Record<XmasTheme, string> = {
  classic: '/favicon-classic.svg',
  cats: '/favicon-cats.svg',
};

function readStoredTheme(): XmasTheme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'cats' ? 'cats' : 'classic';
  } catch {
    return 'classic';
  }
}

/** Ține minte tema aleasă în browserul vizitatorului (preferință personală, nu a grupului). */
export default function XmasThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<XmasTheme>(readStoredTheme);

  // <link rel="icon"> stă în <head>, în afara arborelui React, așa că îl sincronizăm aici.
  useEffect(() => {
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (icon) icon.href = FAVICONS[theme];
  }, [theme]);

  const setTheme = useCallback((next: XmasTheme) => {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // stocare indisponibilă (mod privat): tema ține doar până la reîncărcare
    }
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <XmasThemeContext.Provider value={value}>{children}</XmasThemeContext.Provider>;
}
