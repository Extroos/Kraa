import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { en, TranslationKeys } from './en';
import { ar } from './ar';
import { fr } from './fr';

export type Language = 'en' | 'ar' | 'fr';

const dictionaries: Record<Language, TranslationKeys> = { en, ar, fr };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationKeys;
  dir: 'ltr' | 'rtl';
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: en,
  dir: 'ltr',
  isRTL: false,
});

const STORAGE_KEY = 'kraa_language';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'ar' || saved === 'fr') return saved;
    } catch {}
    return 'en';
  });

  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const isRTL = language === 'ar';
  const t = dictionaries[language];

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [language, dir]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dir, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => useContext(LanguageContext);
