import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { translations as enTranslations } from "./translations/en";
import { translations as deTranslations } from "./translations/de";

// Type for translation keys (helps with type safety)
export type TranslationKey = string;

const resources = {
  en: {
    translation: enTranslations,
  },
  de: {
    translation: deTranslations,
  },
};

// Configure i18next
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: ["en", "de"],
    defaultNS: "translation",
    ns: ["translation"],
    
    // Detection options
    detection: {
      // Order of detection methods
      order: ["localStorage", "navigator", "htmlTag"],
      // Keys to lookup language from
      lookupLocalStorage: "i18nextLng",
      // Cache user language preference
      caches: ["localStorage"],
    },

    // Interpolation options
    interpolation: {
      escapeValue: false, // React already escapes values
    },

    // React options
    react: {
      useSuspense: false, // Disable suspense for SSR compatibility
    },

    // Debug mode (set to false in production)
    debug: false,
  });

export default i18n;

