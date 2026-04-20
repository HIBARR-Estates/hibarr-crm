import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Ensure react-i18next always has an instance before any hook runs.
if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
        resources: { en: { translation: {} } },
        lng: "en",
        fallbackLng: "en",
        interpolation: {
            escapeValue: false,
        },
        returnEmptyString: false,
        react: {
            useSuspense: false,
        },
    });
}

/**
 * Supported languages configuration
 * Matches LanguageSetting::LANGUAGES in Laravel
 */
export const SUPPORTED_LANGUAGES = {
    en: { name: "English", native: "English", dir: "ltr", flag: "gb" },
    ru: { name: "Russian", native: "Русский", dir: "ltr", flag: "ru" },
    tr: { name: "Turkish", native: "Türkçe", dir: "ltr", flag: "tr" },
    de: { name: "German", native: "Deutsch", dir: "ltr", flag: "de" },
    fa: { name: "Persian", native: "فارسی", dir: "rtl", flag: "ir" },
    ar: { name: "Arabic", native: "العربية", dir: "rtl", flag: "sa" },
} as const;

export type SupportedLocale = keyof typeof SUPPORTED_LANGUAGES;

export type AvailableLocale = {
    name: string;
    native: string;
    dir: "ltr" | "rtl";
    flag: string;
};

export type AvailableLocales = Record<string, AvailableLocale>;

/**
 * Initialize i18next with translations from server
 * Called once when the app boots with Inertia shared props
 * @param locale - Current locale code
 * @param translations - Translations for the current locale (already merged with English on server)
 * @param fallbackTranslations - English translations for i18next fallback (null when locale is 'en')
 */
export const initI18n = (
    locale: string = "en",
    translations: Record<string, string> = {},
    fallbackTranslations: Record<string, string> | null = null,
) => {
    // Build resources object with current locale + English fallback
    const resources: Record<string, { translation: Record<string, string> }> = {
        [locale]: { translation: translations },
    };

    // Add English as fallback bundle when using a non-English locale
    if (fallbackTranslations && locale !== "en") {
        resources["en"] = { translation: fallbackTranslations };
    }

    // Only initialize if not already initialized
    if (!i18n.isInitialized) {
        i18n.use(initReactI18next).init({
            resources,
            lng: locale,
            fallbackLng: "en",
            interpolation: {
                escapeValue: false, // React already escapes values
            },
            // Return key if translation not found (for debugging)
            returnEmptyString: false,
            // Don't suspend on missing translations
            react: {
                useSuspense: false,
            },
        });
    } else {
        // If already initialized, add new resources and change language
        if (fallbackTranslations && locale !== "en") {
            i18n.addResourceBundle(
                "en",
                "translation",
                fallbackTranslations,
                true,
                true,
            );
        }
        i18n.addResourceBundle(locale, "translation", translations, true, true);
        i18n.changeLanguage(locale);
    }

    return i18n;
};

/**
 * Check if a locale is RTL
 */
export const isRtlLocale = (locale: string): boolean => {
    return ["ar", "fa", "he"].includes(locale);
};

export default i18n;
