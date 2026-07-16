<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;

class I18nTranslationService
{
    public const SUPPORTED_LOCALES = ['en', 'de', 'ru', 'tr'];

    private const CACHE_TTL_SECONDS = 3600;

    private const TRANSLATION_FILES = ['app', 'modules', 'messages', 'permissions', 'placeholders', 'pages'];

    /**
     * Locale to language folder mapping
     */
    protected array $localeToFolder = [
        'en' => 'eng',
        'de' => 'de',
        'ru' => 'ru',
        'tr' => 'tr',
    ];

    public function normalizeLocale(?string $locale): string
    {
        $locale = $locale ?: 'en';

        return in_array($locale, self::SUPPORTED_LOCALES, true) ? $locale : 'en';
    }

    /**
     * Flattened translations for the given locale (English base + locale overlay).
     */
    public function getTranslations(string $locale): array
    {
        $locale = $this->normalizeLocale($locale);

        return Cache::remember(
            "translations_{$locale}",
            self::CACHE_TTL_SECONDS,
            function () use ($locale) {
                $baseTranslations = $this->loadLocaleFiles('eng');

                if ($locale === 'en') {
                    return $this->flattenTranslations($baseTranslations);
                }

                $folder = $this->localeToFolder[$locale] ?? 'eng';
                $path = lang_path($folder);

                if (is_dir($path)) {
                    foreach (self::TRANSLATION_FILES as $file) {
                        $filePath = $path . '/' . $file . '.php';
                        if (file_exists($filePath)) {
                            $localeData = require $filePath;
                            $baseTranslations[$file] = array_replace_recursive(
                                $baseTranslations[$file] ?? [],
                                $localeData
                            );
                        }
                    }
                }

                return $this->flattenTranslations($baseTranslations);
            }
        );
    }

    /**
     * English fallback bundle for i18next (null when locale is already English).
     */
    public function getFallbackTranslations(string $locale): ?array
    {
        $locale = $this->normalizeLocale($locale);

        if ($locale === 'en') {
            return null;
        }

        return Cache::remember('translations_en', self::CACHE_TTL_SECONDS, function () {
            return $this->flattenTranslations($this->loadLocaleFiles('eng'));
        });
    }

    /**
     * @return array{locale: string, translations: array<string, string>, fallbackTranslations: array<string, string>|null}
     */
    public function payloadForLocale(string $locale): array
    {
        $locale = $this->normalizeLocale($locale);

        return [
            'locale' => $locale,
            'translations' => $this->getTranslations($locale),
            'fallbackTranslations' => $this->getFallbackTranslations($locale),
        ];
    }

    public function getAvailableLocales(): array
    {
        return [
            'en' => ['name' => 'English', 'native' => 'English', 'dir' => 'ltr', 'flag' => 'gb'],
            'de' => ['name' => 'German', 'native' => 'Deutsch', 'dir' => 'ltr', 'flag' => 'de'],
            'ru' => ['name' => 'Russian', 'native' => 'Русский', 'dir' => 'ltr', 'flag' => 'ru'],
            'tr' => ['name' => 'Turkish', 'native' => 'Türkçe', 'dir' => 'ltr', 'flag' => 'tr'],
        ];
    }

    /**
     * @return array<string, array>
     */
    private function loadLocaleFiles(string $folder): array
    {
        $path = lang_path($folder);
        $translations = [];

        foreach (self::TRANSLATION_FILES as $file) {
            $filePath = $path . '/' . $file . '.php';
            if (file_exists($filePath)) {
                $translations[$file] = require $filePath;
            }
        }

        return $translations;
    }

    /**
     * Flatten nested translation arrays for i18next
     */
    private function flattenTranslations(array $translations, string $prefix = ''): array
    {
        $flat = [];

        foreach ($translations as $key => $value) {
            $newKey = $prefix ? "{$prefix}.{$key}" : $key;

            if (is_array($value)) {
                $flat = array_merge($flat, $this->flattenTranslations($value, $newKey));
            } else {
                $flat[$newKey] = $value;
            }
        }

        return $flat;
    }
}
