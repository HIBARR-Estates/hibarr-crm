import { useTranslationContext } from '@/contexts/TranslationContext';
import type { SupportedLocale, AvailableLocales } from '@/lib/i18n';

/**
 * Custom hook for accessing translations throughout the app
 * Provides a clean API for components to use translations
 *
 * @example
 * ```tsx
 * const { t, locale, isRtl, changeLanguage } = useTranslation();
 *
 * return (
 *   <div className={isRtl ? 'rtl' : 'ltr'}>
 *     <h1>{t('app.menu.dashboard')}</h1>
 *     <button onClick={() => changeLanguage('ar')}>
 *       {t('app.changeLanguage')}
 *     </button>
 *   </div>
 * );
 * ```
 */
export const useTranslation = () => {
    const {
        t,
        locale,
        isRtl,
        availableLocales,
        changeLanguage,
        isReady,
    } = useTranslationContext();

    return {
        /**
         * Translate a key to the current locale
         * Falls back to key if translation not found
         */
        t,

        /**
         * Current locale code (e.g., 'en', 'ar', 'ru')
         */
        locale: locale as SupportedLocale,

        /**
         * Whether current locale is RTL (Arabic, Persian, Hebrew)
         */
        isRtl,

        /**
         * Available locales for language switcher
         */
        availableLocales: availableLocales as AvailableLocales,

        /**
         * Change the application language
         * Triggers a server request to persist the change
         */
        changeLanguage,

        /**
         * Whether translations are loaded and ready
         */
        isReady,
    };
};

export default useTranslation;
