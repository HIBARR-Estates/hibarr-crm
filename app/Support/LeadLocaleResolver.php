<?php

namespace App\Support;

use App\Models\Company;
use App\Models\Lead;
use App\Services\I18nTranslationService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\App;

class LeadLocaleResolver
{
    /**
     * Map language codes to Laravel lang directories (en → eng).
     */
    private const APP_LOCALE_MAP = [
        'en' => 'eng',
    ];

    public static function resolve(?Lead $lead, ?Company $company = null): string
    {
        $code = self::preferredLanguageCode($lead);
        if ($code !== null) {
            return self::toAppLocale($code);
        }

        $fallback = $company?->locale ?? (string) config('app.locale', 'en');

        return self::toAppLocale($fallback);
    }

    public static function apply(?Lead $lead, ?Company $company = null): string
    {
        $locale = self::resolve($lead, $company);
        App::setLocale($locale);
        Carbon::setLocale(self::carbonLocale($locale));

        return $locale;
    }

    public static function preferredLanguageCode(?Lead $lead): ?string
    {
        if ($lead === null) {
            return null;
        }

        $languages = $lead->languages;
        if (! is_array($languages) || $languages === []) {
            return null;
        }

        foreach ($languages as $language) {
            if (is_string($language) && $language !== '') {
                return $language;
            }
        }

        return null;
    }

    public static function toAppLocale(string $languageCode): string
    {
        $normalized = app(I18nTranslationService::class)->normalizeLocale($languageCode);

        return self::APP_LOCALE_MAP[$normalized] ?? $normalized;
    }

    public static function carbonLocale(string $appLocale): string
    {
        return $appLocale === 'eng' ? 'en' : $appLocale;
    }
}
