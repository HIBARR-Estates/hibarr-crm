import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    useMemo,
} from "react";
import { router, usePage } from "@inertiajs/react";
import { useTranslation as useI18nTranslation } from "react-i18next";
import {
    default as i18n,
    clearI18nCache,
    loadI18n,
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
 * Loads dictionaries from /account/api/i18n/{locale}.json and syncs locale from Inertia props.
 */
export const TranslationProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const { props } = usePage();
    const [isReady, setIsReady] = useState(i18n.isInitialized);

    // Locale metadata still comes from Inertia shared props; dictionaries do not.
    const locale = (props.locale as string) || "en";
    const isRtl = (props.isRtl as boolean) || false;
    const availableLocales = (props.availableLocales as AvailableLocales) || {
        en: { name: "English", native: "English", dir: "ltr", flag: "gb" },
    };

    // Fetch/apply dictionaries whenever locale changes (boot + language switch).
    useEffect(() => {
        let cancelled = false;

        loadI18n(locale)
            .then(() => {
                if (cancelled) return;
                setIsReady(true);
                document.documentElement.dir = isRtl ? "rtl" : "ltr";
                document.documentElement.lang = locale;
            })
            .catch(() => {
                if (cancelled) return;
                setIsReady(i18n.isInitialized);
            });

        return () => {
            cancelled = true;
        };
    }, [locale, isRtl]);

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
        // Ensure the next load pulls fresh dictionaries for the target locale.
        clearI18nCache(newLocale);
        router.post(
            "/account/settings/profile/change-language",
            { locale: newLocale },
            {
                preserveScroll: true,
                preserveState: false,
                replace: true,
            },
        );
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
