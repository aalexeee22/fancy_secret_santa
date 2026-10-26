import { createContext, useContext } from 'react';
import en, { type Messages } from './locales/en';

export type Lang = 'en' | 'ro' | 'fr' | 'tr' | 'it';

export const LANG_STORAGE_KEY = 'secret-santa-lang';
export const DEFAULT_LANG: Lang = 'en';

// Numele fiecărei limbi, scris în limba respectivă, ca oricine să și-o recunoască.
export const LANGUAGES: { code: Lang; label: string; locale: string }[] = [
  { code: 'en', label: 'English', locale: 'en-GB' },
  { code: 'ro', label: 'Română', locale: 'ro-RO' },
  { code: 'fr', label: 'Français', locale: 'fr-FR' },
  { code: 'tr', label: 'Türkçe', locale: 'tr-TR' },
  { code: 'it', label: 'Italiano', locale: 'it-IT' },
];

export const isLang = (value: unknown): value is Lang => LANGUAGES.some(l => l.code === value);

export const I18nContext = createContext<{ lang: Lang; setLang: (lang: Lang) => void; t: Messages; locale: string }>({
  lang: DEFAULT_LANG,
  setLang: () => {},
  t: en,
  locale: 'en-GB',
});

export const useI18n = () => useContext(I18nContext);
