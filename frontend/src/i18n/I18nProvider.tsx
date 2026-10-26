import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import roRO from 'antd/locale/ro_RO';
import frFR from 'antd/locale/fr_FR';
import trTR from 'antd/locale/tr_TR';
import itIT from 'antd/locale/it_IT';
import { setApiLanguage } from '../api/client';
import { christmasTheme } from '../theme';
import { DEFAULT_LANG, I18nContext, LANGUAGES, LANG_STORAGE_KEY, isLang, type Lang } from './i18nContext';
import type { Messages } from './locales/en';
import en from './locales/en';
import ro from './locales/ro';
import fr from './locales/fr';
import tr from './locales/tr';
import it from './locales/it';

const MESSAGES: Record<Lang, Messages> = { en, ro, fr, tr, it };
const ANTD_LOCALES: Record<Lang, typeof enUS> = { en: enUS, ro: roRO, fr: frFR, tr: trTR, it: itIT };

function readStoredLang(): Lang {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    return isLang(stored) ? stored : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

/** Limba aleasă de vizitator: textele paginii, ale componentelor Ant Design și ale mesajelor de la server. */
export default function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang);

  // Serverul răspunde cu erori (și trimite emailuri) în limba din headerul Accept-Language.
  // Setat la randare, nu într-un efect: paginile copil cer date în propriile efecte, care rulează primele.
  setApiLanguage(lang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      // stocare indisponibilă (mod privat): limba ține doar până la reîncărcare
    }
  }, []);

  const value = useMemo(() => ({
    lang,
    setLang,
    t: MESSAGES[lang],
    locale: LANGUAGES.find(l => l.code === lang)!.locale,
  }), [lang, setLang]);

  return (
    <ConfigProvider theme={christmasTheme} locale={ANTD_LOCALES[lang]}>
      <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
    </ConfigProvider>
  );
}
