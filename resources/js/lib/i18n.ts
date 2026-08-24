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
    de: { name: "German", native: "Deutsch", dir: "ltr", flag: "de" },
    ru: { name: "Russian", native: "Русский", dir: "ltr", flag: "ru" },
    tr: { name: "Turkish", native: "Türkçe", dir: "ltr", flag: "tr" },
} as const;

export type SupportedLocale = keyof typeof SUPPORTED_LANGUAGES;

export type AvailableLocale = {
    name: string;
    native: string;
    dir: "ltr" | "rtl";
    flag: string;
};

export type AvailableLocales = Record<string, AvailableLocale>;

export type I18nPayload = {
    locale: string;
    translations: Record<string, string>;
    fallbackTranslations?: Record<string, string> | null;
};

const dictionaryCache = new Map<string, I18nPayload>();

/**
 * Auth-gated JSON endpoint for flattened locale dictionaries.
 * Kept as a path (not ziggy) so boot can fetch before Ziggy is required.
 */
/** Bump when lang keys are added so browsers that cached the old JSON refetch. */
const I18N_DICT_VERSION = "9";

export const i18nEndpoint = (locale: string): string =>
    `/account/api/i18n/${encodeURIComponent(locale)}.json?v=${I18N_DICT_VERSION}`;

/**
 * Initialize i18next with translations from server
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
 * Fetch locale dictionaries (with in-memory cache) and apply them to i18next.
 */
export async function loadI18n(locale: string = "en"): Promise<typeof i18n> {
    const normalized = locale || "en";
    let payload = dictionaryCache.get(normalized);

    if (!payload) {
        const response = await fetch(i18nEndpoint(normalized), {
            credentials: "same-origin",
            cache: "no-store",
            headers: { Accept: "application/json" },
        });

        if (!response.ok) {
            throw new Error(
                `Failed to load i18n dictionaries for "${normalized}" (${response.status})`,
            );
        }

        payload = (await response.json()) as I18nPayload;
        dictionaryCache.set(normalized, payload);
        if (payload.locale && payload.locale !== normalized) {
            dictionaryCache.set(payload.locale, payload);
        }
    }

    return initI18n(
        payload.locale || normalized,
        payload.translations || {},
        payload.fallbackTranslations ?? null,
    );
}

/**
 * Drop a cached locale payload (e.g. after an explicit language switch).
 */
export function clearI18nCache(locale?: string): void {
    if (locale) {
        dictionaryCache.delete(locale);
        return;
    }
    dictionaryCache.clear();
}

/**
 * Check if a locale is RTL
 */
export const isRtlLocale = (_locale: string): boolean => {
    // None of the four supported languages (en, de, ru, tr) are RTL
    return false;
};

export default i18n;
