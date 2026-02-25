import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    useMemo,
} from "react";
import { usePage } from "@inertiajs/react";
import { useTranslation as useI18nTranslation } from "react-i18next";
import {
    initI18n,
    type AvailableLocales,
    type SupportedLocale,
} from "@/lib/i18n";

/**
 * Translation context value type
 */
interface TranslationContextValue {
    /** Current locale code (e.g., 'en', 'ar') */
    locale: string;
    /** Whether the current locale is RTL */
    isRtl: boolean;
    /** Available locales for language switcher */
    availableLocales: AvailableLocales;
    /** Translation function */
    t: (key: string, options?: Record<string, any>) => string;
    /** Change the current language (triggers page reload) */
    changeLanguage: (locale: SupportedLocale) => void;
    /** Whether translations are loaded */
    isReady: boolean;
}

const TranslationContext = createContext<TranslationContextValue | null>(null);

/**
 * Translation Provider
 * Initializes i18next with server-provided translations
 */
export const TranslationProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const { props } = usePage();
    const [isReady, setIsReady] = useState(false);

    // Extract i18n props from Inertia shared props (type-safe access)
    const locale = (props.locale as string) || "en";
    const translations = (props.translations as Record<string, string>) || {};
    const fallbackTranslations =
        (props.fallbackTranslations as Record<string, string> | null) || null;
    const isRtl = (props.isRtl as boolean) || false;
    const availableLocales = (props.availableLocales as AvailableLocales) || {
        en: { name: "English", native: "English", dir: "ltr", flag: "gb" },
    };

    // Initialize i18next on mount or when locale/translations change
    useEffect(() => {
        initI18n(locale, translations, fallbackTranslations);
        setIsReady(true);

        // Update document direction and language
        document.documentElement.dir = isRtl ? "rtl" : "ltr";
        document.documentElement.lang = locale;
    }, [locale, translations, fallbackTranslations, isRtl]);

    // Get the t function from react-i18next
    const { t: i18nT } = useI18nTranslation();

    // Wrapper for t function that handles fallbacks gracefully
    const t = useCallback(
        (key: string, options?: Record<string, any>): string => {
            if (!isReady) return key;
            return i18nT(key, options) || key;
        },
        [i18nT, isReady],
    );

    // Change language by redirecting to the language change route
    const changeLanguage = useCallback((newLocale: SupportedLocale) => {
        // Use Inertia router or window.location to change language
        // This calls the Laravel route that updates user.locale and session
        window.location.href = `/account/settings/change-language?locale=${newLocale}`;
    }, []);

    const value = useMemo<TranslationContextValue>(
        () => ({
            locale,
            isRtl,
            availableLocales,
            t,
            changeLanguage,
            isReady,
        }),
        [locale, isRtl, availableLocales, t, changeLanguage, isReady],
    );

    return (
        <TranslationContext.Provider value={value}>
            {children}
        </TranslationContext.Provider>
    );
};

/**
 * Hook to access translation context
 * @throws Error if used outside TranslationProvider
 */
export const useTranslationContext = (): TranslationContextValue => {
    const context = useContext(TranslationContext);
    if (!context) {
        throw new Error(
            "useTranslationContext must be used within a TranslationProvider",
        );
    }
    return context;
};

export default TranslationContext;
