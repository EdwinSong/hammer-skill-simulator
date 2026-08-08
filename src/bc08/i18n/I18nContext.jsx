import { createContext, useContext, useState } from 'react';
import translations from './translations';

const I18nContext = createContext();

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};

export const I18nProvider = ({ children }) => {
  const [lang, setLang] = useState('en');

  const t = (key) => {
    return translations[lang][key] || key;
  };

  const changeLang = (newLang) => {
    setLang(newLang);
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t, changeLang }}>
      {children}
    </I18nContext.Provider>
  );
};

export default I18nProvider;